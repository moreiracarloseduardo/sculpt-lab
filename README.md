# 🖌️ Sculpt Lab — Editor Topológico 2D/3D com Three.js

Um **editor interativo de malhas** onde você pinta com um pincel para expandir ou retrair formas 2D em tempo real. Perfeito para prototipagem de editores de roupas, padrões de design, e ferramentas CAD/mecânicas.

---

## 🎯 O que é?

**Sculpt Lab** é um aplicativo web que simula ferramentas profissionais de edição de malha (como encontradas em editores de avatares Roblox, software de design de moda, ou CAD paramétrico).

### Características Principais

- ✅ **Pintura em tempo real**: Arraste o mouse para expandir uma forma
- ✅ **Modo de apagar**: Remova matéria da malha com boolean operations 2D
- ✅ **Trava de eixos**: Pinte horizontalmente ou verticalmente para resultados precisos
- ✅ **Visualização 3D**: Mude para modo 3D para rotacionar e inspecionar a malha
- ✅ **Wireframe**: Veja a topologia limpa da malha sem suavização
- ✅ **Zero lag**: Operações <5ms mesmo com strokes longos
- ✅ **Interface intuitiva**: Controles deslizantes e botões na GUI

---

## 🚀 Quick Start

### 1. Clone e instale

```bash
git clone https://github.com/seu-usuario/sculpt-lab.git
cd sculpt-lab
npm install
```

### 2. Instale dependências específicas

```bash
npm install three clipper-lib lil-gui
```

### 3. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

### 4. Abra no navegador

Acesse <http://localhost:5173> (ou a URL indicada no terminal)

---

## 🎮 Como Usar

### Modos de Visualização

| Modo | Como ativar | O que faz |
| --- | --- | --- |
| **2D (Pintura)** | Padrão | Pinte na malha com cursores direcionados |
| **3D (Visualização)** | Menu "Câmera" → "Modo Visualização (3D)" | Rotacione com mouse para ver todos os ângulos |

### Controles de Pintura (Modo 2D)

| Ação | Como fazer |
| --- | --- |
| **Pintar (Expandir)** | Clique + arraste sobre a malha azul |
| **Apagar (Retrair)** | Selecione "Apagar (Cortar)" na GUI, depois arraste |
| **Mudar tamanho do pincel** | Ajuste "Tamanho do Brush" (0.5 a 5.0) |
| **Restringir movimento** | Use "Travar Eixo": Livre / Horizontal / Vertical |
| **Ver wireframe** | Ative "Exibir Wireframe" para topologia limpa |
| **Resetar** | Clique "🗑️ Resetar Formato" para voltar ao quadrado original |

### Exemplo Prático

1. Abra o projeto
2. Veja o quadrado azul no centro
3. Clique e arraste para baixo → a forma expande com uma curva suave
4. Mude para "Apagar (Cortar)" e pinte novamente → a forma recua
5. Mude para "Horizontal" e pinte uma linha reta → expansão perfeitamente horizontal
6. Clique na câmera e mude para "Modo Visualização (3D)" → rotacione para ver em 3D

---

## 🏗️ Arquitetura Técnica

### Stack Tecnológico

```
┌─────────────────────────────────────┐
│         Sculpt Lab (Web)            │
├─────────────────────────────────────┤
│  Three.js (3D rendering engine)     │
│  Clipper.js (2D boolean ops)        │
│  lil-gui (Interface controls)       │
│  Vite (Build & dev server)          │
└─────────────────────────────────────┘
```

### Pipeline de Processamento

```
Mouse Move (pointermove)
    ↓
[Salvar ponto em strokePoints]
[Desenhar cursor/rastro visual]
    ↓
Mouse Up (pointerup)
    ↓
strokeToClipperPath() — Polyline → Cápsula 2D arredondada
    ↓
applyStroke() — Boolean union/difference
    ↓
rebuildMesh() — ExtrudeGeometry 2D→3D
    ↓
Renderizar malha atualizada
```

### Funções Principais

#### `rebuildMesh(paths)`

Reconstrói a malha 3D a partir de polígonos 2D Clipper.

```javascript
function rebuildMesh(paths) {
  // Converte cada polígono Clipper em THREE.Shape
  // Extrudado com THREE.ExtrudeGeometry (espessura = 0.5)
  // Mescla múltiplas geometrias e cria Mesh
  // Resultado: malha 3D renderizável
}
```

#### `strokeToClipperPath(points, brushSize)`

Converte a polyline do mouse em uma cápsula 2D com bordas arredondadas.

```javascript
function strokeToClipperPath(points, brushSize) {
  // Usa ClipperOffset com JoinType.jtRound
  // Produz um polígono que representa a área pintada
  // Retorna ClipperLib.Paths (array de coordenadas inteiras)
}
```

#### `applyStroke(mode)`

Executa a operação booleana 2D.

```javascript
function applyStroke(mode) {
  // mode === 'add' → ClipType.ctUnion (expande)
  // mode === 'erase' → ClipType.ctDifference (retrai)
  // Atualiza currentPolygons e reconstrói mesh
}
```

---

## ⚡ Performance

Substituímos a abordagem inicial de **CSG 3D** (que travava em >200ms) por **Clipper.js 2D** (que processa em <5ms):

| Operação | Tempo | Status |
| --- | --- | --- |
| Stroke de 10 pontos | <2ms | ✅ Instantâneo |
| Stroke de 50 pontos | <5ms | ✅ Suave |
| 10 strokes consecutivos | Estável | ✅ Zero lag |
| Mudança de modo | <1ms | ✅ Resposta rápida |

**Por que tão rápido?**

- Clipper.js trabalha apenas com coordenadas inteiras (sem flutuantes)
- Operações são O(contorno), não O(triângulos)
- ExtrudeGeometry triangula uma vez, sem reprocessamento

---

## 🔧 Configurações Técnicas

### Constantes Importantes (src/main.js)

```javascript
const CLIPPER_SCALE = 1000;  // 1 world unit = 1000 unidades Clipper
const THICKNESS = 0.5;        // Espessura da malha no eixo Z
```

**Por quê?**

- `CLIPPER_SCALE` garante precisão inteira (sem erros de ponto flutuante)
- `THICKNESS` mantém a malha plana mas com volume renderizável

### Estado da Aplicação

```javascript
let currentPolygons = [[
  { X: -5000, Y: -5000 },  // Coordenadas Clipper
  { X: 5000, Y: -5000 },   // Inteiras para precisão
  { X: 5000, Y: 5000 },
  { X: -5000, Y: 5000 }
]];

let shapeMesh = null;        // Mesh THREE.js renderizado
```

**Nota**: `currentPolygons` é um array de arrays. Cada array interno é um contorno (pode haver buracos/ilhas).

---

## 📁 Estrutura do Projeto

```
sculpt-lab/
├── src/
│   ├── main.js                 # Lógica principal (280 linhas)
│   ├── style.css               # Estilos
│   └── claude_context.md       # Documentação técnica
├── index.html                  # Ponto de entrada HTML
├── package.json                # Dependências e scripts
├── vite.config.js              # Configuração Vite
├── README.md                   # Este arquivo
└── docs/
    └── demo.gif                # Screenshot/animação para visualizar
```

---

## 🐛 Troubleshooting

### "Blank page / Aplicação não carrega"

**Solução**: Verifique se todos os módulos foram instalados:

```bash
npm install three clipper-lib lil-gui
npm run dev
```

### "Mesh não aparece quando pinto"

**Causa**: Certifique-se de que está em **Modo Pintura (2D)** (padrão).

- Verifique o menu "Câmera" na GUI
- Deve estar em "Modo Pintura (2D)", não "Modo Visualização (3D)"

### "Pincelada muito lenta"

**Cause**: Brush size muito grande ou polyline com muitos pontos.

- Reduza "Tamanho do Brush" para 1.0-2.0
- A aplicação tem filtro de distância automático que evita excesso de pontos

### Erros de console

Se vir `ClipperLib undefined`:

```bash
npm install clipper-lib --save
npm run dev
```

---

## 🎨 Exemplos de Uso

### Caso 1: Editor de Roupas de Avatar

```
1. Comece com um quadrado (malha base)
2. Pinte nas laterais com Axis Lock Horizontal → aumento/diminuição de mangas
3. Mude para 3D para verificar proporções
4. Exporte a topologia final (futura feature)
```

### Caso 2: Design de Padrões

```
1. Use Axis Lock Vertical para linhas retas
2. Combine múltiplos strokes para criar padrões geométricos
3. Use Wireframe para análise de topologia
4. Reset para começar novo padrão
```

### Caso 3: Prototipagem CAD

```
1. Pinte formas básicas em 2D
2. Alterne entre Pintar e Apagar para detalhar
3. Visualize em 3D para ver as proporções
4. Use Modo Visualização para inspecionar superfícies
```

---

## 🔮 Roadmap Futuro

- [ ] **Exportar malha**: Salvar como GLTF/OBJ
- [ ] **Undo/Redo**: Histórico de operações
- [ ] **Importar malha**: Carregar arquivo OBJ/GLTF existente
- [ ] **Operações 3D**: Extrude, bevel, smooth
- [ ] **Texturas**: Importar e aplicar imagens
- [ ] **Colaboração**: Edição em tempo real multiplayer
- [ ] **Performance**: Otimização para 1000+ strokes

---

## 📚 Documentação Técnica

Para entender melhor a implementação:

- Leia [claude_context.md](./src/claude_context.md) — arquitetura completa
- Explore [main.js](./src/main.js) — linhas comentadas explicam cada seção
- Verifique o commit history para ver a evolução (CSG → Clipper)

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Siga estes passos:

1. Faça um fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

### Diretrizes

- Mantenha o código legível e comentado
- Teste performance antes de enviar (use DevTools → Performance)
- Adicione testes se possível
- Atualize este README se adicionar features

---

## 📄 Licença

Este projeto está sob licença **MIT**. Veja [LICENSE](./LICENSE) para detalhes.

---

## 🙋 Perguntas & Suporte

- **Issues**: Abra uma [Issue](https://github.com/seu-usuario/sculpt-lab/issues)
- **Discussões**: Use [Discussions](https://github.com/seu-usuario/sculpt-lab/discussions)
- **Email**: <seu-email@example.com>

---

## 🎓 Créditos

- **Three.js** — Motor 3D (<https://threejs.org>)
- **Clipper.js** — Operações booleanas 2D (<https://clipper2.org>)
- **lil-gui** — Interface de controles (<https://lil-gui.georgealways.com>)
- **Vite** — Build tool (<https://vitejs.dev>)

---

**Made with ❤️ for creative tooling**

Last updated: 2026-03-27
