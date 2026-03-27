import './style.css';
import * as THREE from 'three'; // <-- Erro de digitação corrigido aqui!
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import ClipperLib from 'clipper-lib';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// ============ SETUP BÁSICO ============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a24);

// Câmera perfeitamente frontal (estilo 2D)
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 35);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false; // Trava a rotação para foco na edição plana
controls.enableDamping = true;

// Iluminação
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(0, 5, 10);
scene.add(dirLight);

// ============ AMBIENTE DE TRABALHO ============
// Chão invisível para o Raycaster (Sempre no Z = 0)
const invisiblePlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000),
  new THREE.MeshBasicMaterial({ visible: false })
);
scene.add(invisiblePlane);

// Grid de fundo
const grid = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

// ============ A MALHA (O OBJETO EDITÁVEL) ============
const material = new THREE.MeshStandardMaterial({
  color: 0x2e66ff,
  roughness: 0.5,
  wireframe: false,
  side: THREE.DoubleSide
});

const THICKNESS = 0.5; // Espessura fixa do nosso tecido/malha
const CLIPPER_SCALE = 1000; // 1 world unit = 1000 Clipper units para precisão inteira

// Polígono inicial: quadrado 10x10 em coordenadas Clipper (escala 1000)
let currentPolygons = [[
  { X: -5000, Y: -5000 },
  { X: 5000, Y: -5000 },
  { X: 5000, Y: 5000 },
  { X: -5000, Y: 5000 }
]];

let shapeMesh = null;

// Cursor 2D que segue o mouse
const cursorMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, depthTest: false });
const cursor = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 32), cursorMat);
scene.add(cursor);

// ============ INTERFACE (GUI) ============
const gui = new GUI({ title: '🖌️ Editor Topológico 2D/3D' });

const params = {
  viewMode: 'Modo Pintura (2D)', // Novo controle de Câmera
  brushSize: 1.5,
  mode: 'Adicionar (Pintar)',
  axisLock: 'Livre',
  wireframe: false,
  reset: () => {
    currentPolygons = [[
      { X: -5000, Y: -5000 },
      { X: 5000, Y: -5000 },
      { X: 5000, Y: 5000 },
      { X: -5000, Y: 5000 }
    ]];
    rebuildMesh(currentPolygons);
    visualTrailGroup.clear();
  }
};

// Toggle de Câmera
gui.add(params, 'viewMode', ['Modo Pintura (2D)', 'Modo Visualização (3D)']).name('Câmera').onChange(mode => {
  if (mode === 'Modo Visualização (3D)') {
    controls.enableRotate = true; // Libera o giro 3D
    cursor.visible = false;       // Esconde o pincel
  } else {
    controls.enableRotate = false; // Trava o giro
    // Força a câmera voltar perfeitamente para a visão frontal 2D
    camera.position.set(0, 0, 35);
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    cursor.visible = true;        // Mostra o pincel
  }
});

const toolsFolder = gui.addFolder('Ferramentas de Pintura');
toolsFolder.add(params, 'brushSize', 0.5, 5.0).name('Tamanho do Brush');
toolsFolder.add(params, 'mode', ['Adicionar (Pintar)', 'Apagar (Cortar)']).name('Ação');
toolsFolder.add(params, 'axisLock', ['Livre', 'Horizontal (Eixo X)', 'Vertical (Eixo Y)']).name('Travar Eixo');

gui.add(params, 'wireframe').name('Exibir Wireframe').onChange(v => material.wireframe = v);
gui.add(params, 'reset').name('🗑️ Resetar Formato');

// ============ LÓGICA DE PINTURA (RASTRO VISUAL) ============
rebuildMesh(currentPolygons);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let isPainting = false;
let startPoint = new THREE.Vector3();
let strokePoints = [];
const visualTrailGroup = new THREE.Group();
scene.add(visualTrailGroup);

window.addEventListener('pointerdown', (e) => {
  if (e.target.tagName !== 'CANVAS' || params.viewMode !== 'Modo Pintura (2D)') return;

  updateMousePos(e);
  const intersects = raycaster.intersectObject(invisiblePlane);

  if (intersects.length > 0) {
    isPainting = true;
    controls.enabled = false;
    visualTrailGroup.clear();
    strokePoints = [];

    startPoint.copy(intersects[0].point);
    startPoint.z = 0; // Força Z a ser zero
    addPointToStroke(startPoint);
  }
});

window.addEventListener('pointermove', (e) => {
  if (params.viewMode !== 'Modo Pintura (2D)') return;

  updateMousePos(e);
  const intersects = raycaster.intersectObject(invisiblePlane);

  if (intersects.length > 0) {
    let hitPoint = intersects[0].point;
    hitPoint.z = 0;

    // TRAVA DE EIXOS RIGOROSA
    if (isPainting) {
      if (params.axisLock === 'Horizontal (Eixo X)') hitPoint.y = startPoint.y;
      if (params.axisLock === 'Vertical (Eixo Y)') hitPoint.x = startPoint.x;
    }

    // Atualiza cursor
    cursor.position.copy(hitPoint);
    cursor.scale.setScalar(params.brushSize);

    if (isPainting) {
      const lastPoint = strokePoints[strokePoints.length - 1];
      // Só adiciona um novo ponto se o mouse se afastou o suficiente
      if (hitPoint.distanceTo(lastPoint) > params.brushSize * 0.4) {
        addPointToStroke(hitPoint.clone());
      }
    }
  }
});

window.addEventListener('pointerup', () => {
  if (!isPainting || params.viewMode !== 'Modo Pintura (2D)') return;
  isPainting = false;
  controls.enabled = true;

  if (strokePoints.length > 0) {
    applyStroke(params.mode.includes('Adicionar') ? 'add' : 'erase');
  }
});

function updateMousePos(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
}

function addPointToStroke(point) {
  strokePoints.push(point);
  const circle = new THREE.Mesh(
    new THREE.CircleGeometry(params.brushSize, 16),
    new THREE.MeshBasicMaterial({ color: params.mode.includes('Apagar') ? 0xff0000 : 0x00ff88, depthTest: false })
  );
  circle.position.copy(point);
  circle.position.z = 0.1;
  visualTrailGroup.add(circle);
}

// ============ MOTOR CLIPPER 2D + EXTRUDE (SEM TRAVAMENTOS) ============

// Reconstrói a malha 3D a partir de polígonos Clipper
function rebuildMesh(paths) {
  if (shapeMesh) scene.remove(shapeMesh);
  if (!paths || paths.length === 0) return;

  const geometries = [];

  for (const path of paths) {
    const shape = new THREE.Shape();

    // Converter Clipper coordinates para world coordinates
    path.forEach((pt, i) => {
      const x = pt.X / CLIPPER_SCALE;
      const y = pt.Y / CLIPPER_SCALE;
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    });

    shape.closePath();

    // Extrudar para 3D
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: THICKNESS,
      bevelEnabled: false,
      steps: 1
    });

    // Centralizar a extrusão no eixo Z
    geo.translate(0, 0, -THICKNESS / 2);
    geometries.push(geo);
  }

  // Mesclar geometrias (Requer BufferGeometryUtils)
  let merged;
  try {
    merged = geometries.length === 1
      ? geometries[0]
      : BufferGeometryUtils.mergeGeometries(geometries);
  } catch (e) {
    console.warn("Erro ao mesclar geometrias, ignorando esta pincelada.");
    return;
  }

  shapeMesh = new THREE.Mesh(merged, material);
  scene.add(shapeMesh);
}

// Converte polyline de stroke em cápsula 2D via ClipperOffset
function strokeToClipperPath(points, brushSize) {
  const path = points.map(p => ({
    X: Math.round(p.x * CLIPPER_SCALE),
    Y: Math.round(p.y * CLIPPER_SCALE)
  }));

  const co = new ClipperLib.ClipperOffset();
  co.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);

  const result = new ClipperLib.Paths();
  co.Execute(result, brushSize * CLIPPER_SCALE);

  return result;
}

// Aplica operação booleana 2D (union para add, difference para erase)
function applyStroke(mode) {
  if (strokePoints.length === 0) return;

  const strokePaths = strokeToClipperPath(strokePoints, params.brushSize);

  if (!strokePaths || strokePaths.length === 0) {
    visualTrailGroup.clear();
    strokePoints = [];
    return;
  }

  const clipper = new ClipperLib.Clipper();

  clipper.AddPaths(currentPolygons, ClipperLib.PolyType.ptSubject, true);
  clipper.AddPaths(strokePaths, ClipperLib.PolyType.ptClip, true);

  const solution = new ClipperLib.Paths();
  const operation = mode === 'add'
    ? ClipperLib.ClipType.ctUnion
    : ClipperLib.ClipType.ctDifference;

  const fillType = ClipperLib.PolyFillType.pftNonZero;
  const success = clipper.Execute(operation, solution, fillType, fillType);

  if (success && solution.length > 0) {
    currentPolygons = solution;
    rebuildMesh(solution);
  } else if (mode === 'erase') {
    currentPolygons = [];
    if (shapeMesh) scene.remove(shapeMesh);
    shapeMesh = null;
  }

  visualTrailGroup.clear();
  strokePoints = [];
}

// ============ RENDER LOOP ============
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();