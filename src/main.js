import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import ClipperLib from 'clipper-lib';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// ============ BASIC SETUP ============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a24);

// Perfectly frontal camera (2D style)
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 35);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false; // Lock rotation to focus on flat editing
controls.enableDamping = true;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(0, 5, 10);
scene.add(dirLight);

// ============ WORK ENVIRONMENT ============
// Invisible plane for Raycaster (Always at Z = 0)
const invisiblePlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000),
  new THREE.MeshBasicMaterial({ visible: false })
);
scene.add(invisiblePlane);

// Background grid
const grid = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

// ============ THE MESH (THE EDITABLE OBJECT) ============
const material = new THREE.MeshStandardMaterial({
  color: 0x2e66ff,
  roughness: 0.5,
  wireframe: false,
  side: THREE.DoubleSide
});

const THICKNESS = 0.5; // Fixed thickness of our mesh/fabric
const CLIPPER_SCALE = 1000; // 1 world unit = 1000 Clipper units for integer precision

// Initial polygon: 10x10 square in Clipper coordinates (scale 1000)
let currentPolygons = [[
  { X: -5000, Y: -5000 },
  { X: 5000, Y: -5000 },
  { X: 5000, Y: 5000 },
  { X: -5000, Y: 5000 }
]];

let shapeMesh = null;

// 2D cursor that follows the mouse
const cursorMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, depthTest: false });
const cursor = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 32), cursorMat);
scene.add(cursor);

// ============ INTERFACE (GUI) ============
const gui = new GUI({ title: '🖌️ 2D/3D Topological Editor' });

const params = {
  viewMode: 'Painting Mode (2D)', // New camera control
  brushSize: 1.5,
  mode: 'Add (Paint)',
  axisLock: 'Free',
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

// Camera toggle
gui.add(params, 'viewMode', ['Painting Mode (2D)', '3D Visualization Mode']).name('Camera').onChange(mode => {
  if (mode === '3D Visualization Mode') {
    controls.enableRotate = true; // Enable 3D rotation
    cursor.visible = false;       // Hide brush
  } else {
    controls.enableRotate = false; // Lock rotation
    // Force camera back to perfect 2D frontal view
    camera.position.set(0, 0, 35);
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    cursor.visible = true;        // Show brush
  }
});

const toolsFolder = gui.addFolder('Painting Tools');
toolsFolder.add(params, 'brushSize', 0.5, 5.0).name('Brush Size');
toolsFolder.add(params, 'mode', ['Add (Paint)', 'Erase (Cut)']).name('Action');
toolsFolder.add(params, 'axisLock', ['Free', 'Horizontal (X Axis)', 'Vertical (Y Axis)']).name('Axis Lock');

gui.add(params, 'wireframe').name('Show Wireframe').onChange(v => material.wireframe = v);
gui.add(params, 'reset').name('🗑️ Reset Shape');

// ============ PAINTING LOGIC (VISUAL TRAIL) ============
rebuildMesh(currentPolygons);
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let isPainting = false;
let startPoint = new THREE.Vector3();
let strokePoints = [];
const visualTrailGroup = new THREE.Group();
scene.add(visualTrailGroup);

window.addEventListener('pointerdown', (e) => {
  if (e.target.tagName !== 'CANVAS' || params.viewMode !== 'Painting Mode (2D)') return;

  updateMousePos(e);
  const intersects = raycaster.intersectObject(invisiblePlane);

  if (intersects.length > 0) {
    isPainting = true;
    controls.enabled = false;
    visualTrailGroup.clear();
    strokePoints = [];

    startPoint.copy(intersects[0].point);
    startPoint.z = 0; // Force Z to be zero
    addPointToStroke(startPoint);
  }
});

window.addEventListener('pointermove', (e) => {
  if (params.viewMode !== 'Painting Mode (2D)') return;

  updateMousePos(e);
  const intersects = raycaster.intersectObject(invisiblePlane);

  if (intersects.length > 0) {
    let hitPoint = intersects[0].point;
    hitPoint.z = 0;

    // STRICT AXIS LOCK
    if (isPainting) {
      if (params.axisLock === 'Horizontal (X Axis)') hitPoint.y = startPoint.y;
      if (params.axisLock === 'Vertical (Y Axis)') hitPoint.x = startPoint.x;
    }

    // Update cursor
    cursor.position.copy(hitPoint);
    cursor.scale.setScalar(params.brushSize);

    if (isPainting) {
      const lastPoint = strokePoints[strokePoints.length - 1];
      // Only add a new point if the mouse moved far enough
      if (hitPoint.distanceTo(lastPoint) > params.brushSize * 0.4) {
        addPointToStroke(hitPoint.clone());
      }
    }
  }
});

window.addEventListener('pointerup', () => {
  if (!isPainting || params.viewMode !== 'Painting Mode (2D)') return;
  isPainting = false;
  controls.enabled = true;

  if (strokePoints.length > 0) {
    applyStroke(params.mode.includes('Add') ? 'add' : 'erase');
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
    new THREE.MeshBasicMaterial({ color: params.mode.includes('Erase') ? 0xff0000 : 0x00ff88, depthTest: false })
  );
  circle.position.copy(point);
  circle.position.z = 0.1;
  visualTrailGroup.add(circle);
}

// ============ CLIPPER 2D + EXTRUDE ENGINE (NO FREEZING) ============

// Rebuilds the 3D mesh from Clipper polygons
function rebuildMesh(paths) {
  if (shapeMesh) scene.remove(shapeMesh);
  if (!paths || paths.length === 0) return;

  const geometries = [];

  for (const path of paths) {
    const shape = new THREE.Shape();

    // Convert Clipper coordinates to world coordinates
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

    // Extrude to 3D
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: THICKNESS,
      bevelEnabled: false,
      steps: 1
    });

    // Center the extrusion on Z axis
    geo.translate(0, 0, -THICKNESS / 2);
    geometries.push(geo);
  }

  // Merge geometries (Requires BufferGeometryUtils)
  let merged;
  try {
    merged = geometries.length === 1
      ? geometries[0]
      : BufferGeometryUtils.mergeGeometries(geometries);
  } catch (e) {
    console.warn("Error merging geometries, ignoring this stroke.");
    return;
  }

  shapeMesh = new THREE.Mesh(merged, material);
  scene.add(shapeMesh);
}

// Converts stroke polyline to 2D capsule via ClipperOffset
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

// Applies 2D boolean operation (union for add, difference for erase)
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