# 🖌️ Sculpt Lab — 2D/3D Topological Editor with Three.js

An **interactive mesh editor** where you paint with a brush to expand or shrink 2D shapes in real-time. Perfect for prototyping clothing editors, design patterns, and CAD/mechanical tools.

---

## 🎯 What is it?

**Sculpt Lab** is a web application that simulates professional mesh editing tools (like those found in Roblox avatar editors, fashion design software, or parametric CAD).

### Main Features

- ✅ **Real-time painting**: Drag the mouse to expand a shape
- ✅ **Erase mode**: Remove matter from the mesh with 2D boolean operations
- ✅ **Axis lock**: Paint horizontally or vertically for precise results
- ✅ **3D visualization**: Switch to 3D mode to rotate and inspect the mesh
- ✅ **Wireframe**: See clean mesh topology without smoothing
- ✅ **Zero lag**: Operations <5ms even with long strokes
- ✅ **Intuitive interface**: Sliders and buttons in the GUI

---

## 🚀 Quick Start

### 1. Clone and install

```bash
git clone https://github.com/your-username/sculpt-lab.git
cd sculpt-lab
npm install
```

### 2. Install specific dependencies

```bash
npm install three clipper-lib lil-gui
```

### 3. Start the development server

```bash
npm run dev
```

### 4. Open in your browser

Visit <http://localhost:5173> (or the URL shown in the terminal)

---

## 🎮 How to Use

### Visualization Modes

| Mode | How to activate | What it does |
| --- | --- | --- |
| **2D (Painting)** | Default | Paint on the mesh with directed cursors |
| **3D (Visualization)** | Menu "Camera" → "3D Visualization Mode" | Rotate with mouse to see all angles |

### Painting Controls (2D Mode)

| Action | How to do it |
| --- | --- |
| **Paint (Expand)** | Click + drag over the blue mesh |
| **Erase (Shrink)** | Select "Erase (Cut)" in the GUI, then drag |
| **Change brush size** | Adjust "Brush Size" (0.5 to 5.0) |
| **Restrict movement** | Use "Axis Lock": Free / Horizontal / Vertical |
| **View wireframe** | Enable "Show Wireframe" for clean topology |
| **Reset** | Click "🗑️ Reset Shape" to return to original square |

### Practical Example

1. Open the project
2. See the blue square in the center
3. Click and drag downward → the shape expands with a smooth curve
4. Switch to "Erase (Cut)" and paint again → the shape shrinks
5. Switch to "Horizontal" and paint a straight line → perfectly horizontal expansion
6. Click on the camera and switch to "3D Visualization Mode" → rotate to see in 3D

---

## 🏗️ Technical Architecture

### Technology Stack

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

### Processing Pipeline

```
Mouse Move (pointermove)
    ↓
[Save point to strokePoints]
[Draw cursor/visual trail]
    ↓
Mouse Up (pointerup)
    ↓
strokeToClipperPath() — Polyline → Rounded 2D capsule
    ↓
applyStroke() — Boolean union/difference
    ↓
rebuildMesh() — ExtrudeGeometry 2D→3D
    ↓
Render updated mesh
```

### Main Functions

#### `rebuildMesh(paths)`

Rebuilds the 3D mesh from 2D Clipper polygons.

```javascript
function rebuildMesh(paths) {
  // Converts each Clipper polygon to THREE.Shape
  // Extruded with THREE.ExtrudeGeometry (thickness = 0.5)
  // Merges multiple geometries and creates Mesh
  // Result: renderable 3D mesh
}
```

#### `strokeToClipperPath(points, brushSize)`

Converts the mouse polyline into a 2D capsule with rounded edges.

```javascript
function strokeToClipperPath(points, brushSize) {
  // Uses ClipperOffset with JoinType.jtRound
  // Produces a polygon representing the painted area
  // Returns ClipperLib.Paths (array of integer coordinates)
}
```

#### `applyStroke(mode)`

Executes the 2D boolean operation.

```javascript
function applyStroke(mode) {
  // mode === 'add' → ClipType.ctUnion (expands)
  // mode === 'erase' → ClipType.ctDifference (shrinks)
  // Updates currentPolygons and rebuilds mesh
}
```

---

## ⚡ Performance

We replaced the initial **3D CSG** approach (which stalled at >200ms) with **Clipper.js 2D** (which processes in <5ms):

| Operation | Time | Status |
| --- | --- | --- |
| 10-point stroke | <2ms | ✅ Instant |
| 50-point stroke | <5ms | ✅ Smooth |
| 10 consecutive strokes | Stable | ✅ Zero lag |
| Mode change | <1ms | ✅ Fast response |

**Why so fast?**

- Clipper.js works only with integer coordinates (no floating-point)
- Operations are O(contour), not O(triangles)
- ExtrudeGeometry triangulates once, no reprocessing

---

## 🔧 Technical Configuration

### Important Constants (src/main.js)

```javascript
const CLIPPER_SCALE = 1000;  // 1 world unit = 1000 Clipper units
const THICKNESS = 0.5;        // Mesh thickness on Z axis
```

**Why?**

- `CLIPPER_SCALE` ensures integer precision (no floating-point errors)
- `THICKNESS` keeps the mesh flat but with renderable volume

### Application State

```javascript
let currentPolygons = [[
  { X: -5000, Y: -5000 },  // Clipper coordinates
  { X: 5000, Y: -5000 },   // Integer for precision
  { X: 5000, Y: 5000 },
  { X: -5000, Y: 5000 }
]];

let shapeMesh = null;        // Rendered THREE.js mesh
```

**Note**: `currentPolygons` is an array of arrays. Each inner array is a contour (can have holes/islands).

---

## 📁 Project Structure

```
sculpt-lab/
├── src/
│   ├── main.js                 # Main logic (280 lines)
│   ├── style.css               # Styles
│   └── claude_context.md       # Technical documentation
├── index.html                  # HTML entry point
├── package.json                # Dependencies and scripts
├── vite.config.js              # Vite configuration
├── README.md                   # This file
└── docs/
    └── demo.gif                # Screenshot/animation to visualize
```

---

## 🐛 Troubleshooting

### "Blank page / Application doesn't load"

**Solution**: Check that all modules are installed:

```bash
npm install three clipper-lib lil-gui
npm run dev
```

### "Mesh doesn't appear when I paint"

**Cause**: Make sure you're in **Painting Mode (2D)** (default).

- Check the "Camera" menu in the GUI
- Should be in "Painting Mode (2D)", not "3D Visualization Mode"

### "Brush stroke is slow"

**Cause**: Brush size too large or polyline with too many points.

- Reduce "Brush Size" to 1.0-2.0
- The application has automatic distance filtering to avoid excess points

### Console errors

If you see `ClipperLib undefined`:

```bash
npm install clipper-lib --save
npm run dev
```

---

## 🎨 Use Cases

### Case 1: Avatar Clothing Editor

```
1. Start with a square (base mesh)
2. Paint on sides with Horizontal Axis Lock → sleeve increase/decrease
3. Switch to 3D to check proportions
4. Export final topology (future feature)
```

### Case 2: Pattern Design

```
1. Use Vertical Axis Lock for straight lines
2. Combine multiple strokes to create geometric patterns
3. Use Wireframe for topology analysis
4. Reset to start new pattern
```

### Case 3: CAD Prototyping

```
1. Paint basic shapes in 2D
2. Alternate between Paint and Erase to detail
3. Visualize in 3D to see proportions
4. Use Visualization Mode to inspect surfaces
```

---

## 🔮 Future Roadmap

- [ ] **Export mesh**: Save as GLTF/OBJ
- [ ] **Undo/Redo**: Operation history
- [ ] **Import mesh**: Load existing OBJ/GLTF file
- [ ] **3D Operations**: Extrude, bevel, smooth
- [ ] **Textures**: Import and apply images
- [ ] **Collaboration**: Real-time multiplayer editing
- [ ] **Performance**: Optimization for 1000+ strokes

---

## 📚 Technical Documentation

To better understand the implementation:

- Read [claude_context.md](./src/claude_context.md) — complete architecture
- Explore [main.js](./src/main.js) — commented lines explain each section
- Check the commit history to see the evolution (CSG → Clipper)

---

## 🤝 Contributing

Contributions are welcome! Follow these steps:

1. Fork the repository
2. Create a branch for your feature (`git checkout -b feature/MyFeature`)
3. Commit your changes (`git commit -m 'Add MyFeature'`)
4. Push to the branch (`git push origin feature/MyFeature`)
5. Open a Pull Request

### Guidelines

- Keep code readable and commented
- Test performance before submitting (use DevTools → Performance)
- Add tests if possible
- Update this README if you add features

---

## 📄 License

This project is under the **MIT** license. See [LICENSE](./LICENSE) for details.

---

## 🙋 Questions & Support

- **Issues**: Open an [Issue](https://github.com/your-username/sculpt-lab/issues)
- **Discussions**: Use [Discussions](https://github.com/your-username/sculpt-lab/discussions)
- **Email**: <your-email@example.com>

---

## 🎓 Credits

- **Three.js** — 3D Engine (<https://threejs.org>)
- **Clipper.js** — 2D Boolean Operations (<https://clipper2.org>)
- **lil-gui** — Control Interface (<https://lil-gui.georgealways.com>)
- **Vite** — Build Tool (<https://vitejs.dev>)

---
