
# Browser-Based Physics Audio Visualizer – Design Document

## 1. Project Overview

A browser-based audio visualizer that:

- Runs entirely from a static HTML file + one ES module entrypoint (`main.js`).
- Uses **Three.js** for rendering and **Rapier** for physics (via CDN).
- Includes 11 prepackaged album tracks (MP3 files in a local folder).
- Allows the user to select those tracks **or** load their own local audio file.
- Drives a physics-based rig/model (joints and bodies) from **audio features**.
- Supports:
  - One **preset per track** (plus optional named presets).
  - A **“Random” preset** that randomly binds features to joints and parameters.
  - A **tweakable parameter UI** (sliders, dropdowns, etc) in-browser.
  - Configuration **export** (JSON) to package presets with the application.

Constraints:

- **No build step**. Pure ES modules, loaded via `<script type="module">`.
- Single top-level module referenced from HTML; that module can import from other local modules.
- No server-side code; “upload” is local only (via `File`/`Blob`).

The primary goal for this doc is to define clear module boundaries, data contracts, and function signatures so an AI coding agent can implement this in small, testable steps.

---

## 2. High-Level Requirements

### Functional

1. **Audio playback**
   - Play/pause/seek for:
     - Prepackaged album tracks (MP3s from `./audio/`).
     - User-selected local audio file.
   - Visual indication of current track time and duration.

2. **Audio analysis**
   - Extract:
     - Overall amplitude / RMS.
     - Frequency band energies (e.g., sub/bass/lowMid/mid/high).
     - Peak/bass emphasis, spectral centroid, rolloff.
   - Provide frame-based analysis data for the physics engine.

3. **Physics simulation**
   - 3D Rapier world with gravity.
   - A rig composed of multiple bodies and joints (e.g., a 3D chain, “ragdoll”, or articulated sculpture).
   - Ability to apply forces/impulses/constraints on joints based on audio-driven values.

4. **3D rendering**
   - Three.js scene, camera, and lighting.
   - One or more 3D models tied to the Rapier bodies (visual meshes follow physics bodies).
   - Basic camera controls (orbit or a simple animated camera path).

5. **Presets system**
   - Each track has an associated preset (mapping audio features → joint parameters).
   - “Random” preset generator.
   - Presets can be:
     - Loaded from static JSON (for prepackaged album tracks).
     - Edited via the UI and then exported as JSON.

6. **UI**
   - Track selector (list of bundled tracks + “Upload file…”).
   - Preset selector (per-track presets + “Random”).
   - Parameter panel:
     - Sliders, checkboxes, dropdowns for physics and mapping settings.
   - Buttons to:
     - Export current preset to JSON (download or copy-to-clipboard).
     - Import preset JSON from file or text.

### Non-Functional

- Runs at 60 fps on a typical laptop browser (Chrome, Firefox, Safari).
- Works offline once loaded (no external network except CDNs).
- Simple file structure. Easy to host as static site (e.g., GitHub Pages).

---

## 3. Tech Stack & External Dependencies

### Core

- **Three.js** (ESM) from a CDN.
  - Example (implementation may adjust version):
    - `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`
    - `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js`
- **Rapier** (3D) from CDN.
  - Example:
    - `https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0`
- **Web Audio API** built into browser (no external library).
- Optional UI helper (if desired):
  - `lil-gui` or similar from CDN; otherwise custom HTML/CSS.

### Browser Features

- ES Modules (`<script type="module" src="src/main.js"></script>`).
- `File` input and `URL.createObjectURL` for local audio.
- `fetch` for loading bundled tracks and preset JSONs.

---

## 4. File Structure & Module Overview

Proposed file tree:

```text
/
  index.html
  /audio/
    01 - Shiny City.mp3
    02 - Shadowline.mp3
    03 - Glass Feed.mp3
    04 - Pressure Line.mp3
    05 - Nobody's Brand.mp3
    06 - Reload Reload.mp3
    07 - Bit by Bit.mp3
    08 - Like Water.mp3
    09 - Grooving Out.mp3
    10 - Built Different.mp3
    11 - Cooking Up.mp3
  /presets/
    track01.json
    ...
    track11.json
  /src/
    main.js
    core/App.js
    audio/AudioManager.js
    audio/AudioFeatureExtractor.js
    audio/TrackRegistry.js
    physics/PhysicsWorld.js
    physics/AudioDrivenRig.js
    render/SceneManager.js
    render/CameraController.js
    config/PresetManager.js
    ui/UIController.js
    utils/EventBus.js
    utils/math.js
    utils/download.js
```

> **UI reference**: `mockup.png` in the repo root captures the approved transport + selector layout. Treat it as the visual contract when implementing Section 6 so control placement stays consistent.

### Bundled Audio Catalog

Track IDs stay `track01`–`track11`, but their filenames now reflect the supplied masters. TrackRegistry should expose at least `id`, `file`, `title`, and `defaultPresetId` for each entry.

| Track ID | Filename                    | Display Name     |
|----------|-----------------------------|------------------|
| track01  | `audio/01 - Shiny City.mp3` | Shiny City       |
| track02  | `audio/02 - Shadowline.mp3` | Shadowline       |
| track03  | `audio/03 - Glass Feed.mp3` | Glass Feed       |
| track04  | `audio/04 - Pressure Line.mp3` | Pressure Line  |
| track05  | `audio/05 - Nobody's Brand.mp3` | Nobody's Brand |
| track06  | `audio/06 - Reload Reload.mp3` | Reload Reload  |
| track07  | `audio/07 - Bit by Bit.mp3` | Bit by Bit       |
| track08  | `audio/08 - Like Water.mp3` | Like Water       |
| track09  | `audio/09 - Grooving Out.mp3` | Grooving Out   |
| track10  | `audio/10 - Built Different.mp3` | Built Different |
| track11  | `audio/11 - Cooking Up.mp3` | Cooking Up       |

High-level module responsibilities:

- `main.js`: Entry point. Bootstraps the `App`, sets up DOM event listeners.
- `core/App.js`: Application orchestrator; wires audio, physics, render, UI; main loop.
- `audio/*`: Track loading, playback control, feature extraction.
- `physics/*`: Rapier world and rigs that respond to audio.
- `render/*`: Three.js scene, camera, and object synchronization with physics.
- `config/PresetManager.js`: Load/store presets, JSON schema handling, random preset generation.
- `ui/UIController.js`: All DOM UI elements, event dispatch, reading/writing preset parameters.
- `utils/*`: Shared utilities (event bus, math helpers, download helpers).

---

## 5. Data Flow Overview

Per-frame pipeline:

1. **Audio** (from HTMLAudio/Web Audio) →
2. **AudioFeatureExtractor** (compute amplitude and bands) →
3. **Preset mapping** (from current preset config) →
4. **PhysicsWorld/AudioDrivenRig** (apply forces/constraints to joints) →
5. **SceneManager** (update Three.js meshes to match physics bodies) →
6. **Renderer** draws frame.

Configuration flow:

- UI changes → PresetManager updates current preset → App notifies AudioDrivenRig → subsequent frames use updated settings.

---

## 6. Audio Subsystem

### 6.1 AudioManager

**File**: `audio/AudioManager.js`

Responsibilities:

- Manage audio context and sources.
- Play/pause/seek.
- Handle both bundled tracks and user file input.
- Expose current playback status.

Key concepts:

- Use `AudioContext` + `MediaElementAudioSourceNode` tied to an `HTMLAudioElement`.
- For bundled tracks: set `audioElement.src` to relative path.
- For user track: use `URL.createObjectURL(file)` and set as `src`.

Possible class skeleton:

```js
export class AudioManager {
  constructor() {
    this.audioContext = null;
    this.audioElement = null;
    this.sourceNode = null;
    this.isReady = false;
  }

  async init() { /* create AudioContext, audio element, etc. */ }

  connectTo(node) {
    // Connect sourceNode -> node (e.g., analyser) -> audioContext.destination
  }

  loadTrackFromUrl(url, metadata) { /* sets audioElement.src and stores track metadata */ }

  loadTrackFromFile(file) { /* createObjectURL and load */ }

  play() { /* handle resume of AudioContext if suspended */ }
  pause() { /* pause audioElement */ }
  togglePlayPause() { /* ... */ }

  getCurrentTime() { /* return audioElement.currentTime */ }
  getDuration() { /* audioElement.duration */ }
}
```

### 6.2 AudioFeatureExtractor

**File**: `audio/AudioFeatureExtractor.js`

Responsibilities:

- Wrap a Web Audio `AnalyserNode`.
- Provide simple feature data per frame for the physics engine.

Features (per frame):

- `rms`: Root-mean-square amplitude.
- `peak`: Max absolute sample.
- `bands`: E.g. `[low, mid, high]` from FFT.
- Optional: `bass`, `treble`, or more bands.

API shape:

```js
export class AudioFeatureExtractor {
  constructor(audioContext) {
    this.analyser = audioContext.createAnalyser();
    this.fftSize = 1024;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.analyser.fftSize);
  }

  connectSource(audioNode) {
    audioNode.connect(this.analyser);
  }

  /**
   * Returns an object with all feature values for this frame.
   * Called once per animation frame.
   */
  update() {
    this.analyser.getByteTimeDomainData(this.timeDomainData);
    this.analyser.getByteFrequencyData(this.frequencyData);

    const rms = /* compute RMS */;
    const peak = /* compute peak */;
    const bands = /* aggregate frequencyData into N bands */;

    return {
      rms,
      peak,
      bands,
      // optional more...
    };
  }
}
```

The data returned here is what the preset system will map to physics parameters.

### 6.3 TrackRegistry

**File**: `audio/TrackRegistry.js`

Responsibility:

- Keep a list of bundled tracks with metadata and default preset IDs.

Example data structure:

```js
export const TRACKS = [
  {
    id: "track01",
    title: "Shiny City",
    file: "audio/01 - Shiny City.mp3",
    defaultPresetId: "track01-default"
  },
  {
    id: "track02",
    title: "Shadowline",
    file: "audio/02 - Shadowline.mp3",
    defaultPresetId: "track02-default"
  },
  // ...
];
```

---

## 7. Physics & Visualization

### 7.1 PhysicsWorld

**File**: `physics/PhysicsWorld.js`

Responsibilities:

- Initialize Rapier.
- Maintain the physics world and integration steps.
- Provide helpers to create bodies, colliders, and joints.

Initialization steps:

1. `await RAPIER.init()` (if needed by chosen build).
2. Create `world = new RAPIER.World(gravityVector)`.
3. Keep arrays/maps of:
   - Rigid bodies.
   - Colliders.
   - Joints.
   - Mapping from body handle → mesh (in `AudioDrivenRig`).

API shape:

```js
export class PhysicsWorld {
  constructor() {
    this.world = null;
    this.rapier = null;
    this.lastStepTime = 0;
  }

  async init() {
    this.rapier = await importRapierFromGlobalOrModule();
    this.world = new this.rapier.World({ x: 0.0, y: -9.81, z: 0.0 });
  }

  step(deltaTime) {
    this.world.timestep = deltaTime;
    this.world.step();
  }

  createRigidBody(desc) {
    return this.world.createRigidBody(desc);
  }

  createCollider(desc, body) {
    return this.world.createCollider(desc, body);
  }

  createImpulseJoint(jointDesc, bodyA, bodyB) {
    return this.world.createImpulseJoint(jointDesc, bodyA, bodyB, true);
  }
}
```

> The exact Rapier API calls will be implemented by the coding agent based on the specific Rapier build.

### 7.2 AudioDrivenRig

**File**: `physics/AudioDrivenRig.js`

Responsibilities:

- Build an articulated rig of bodies & joints.
- Store mapping between:
  - Physics joints/bodies, and
  - Three.js meshes.
- Apply audio-driven controls each frame based on preset.

Concept:

- A rig is defined by a **rig definition object** (can be hardcoded for v1):
  - Example: chain of N segments with hinge joints.
- Each **joint** has a name (string) used by the preset mappings.

Example rig definition type (not necessarily runtime code):

```ts
type RigJoint = {
  name: string;           // e.g. "hip", "spine", "arm_left"
  bodyA: string;          // name of first body
  bodyB: string;          // name of second body
  jointType: "revolute" | "spherical" | "fixed";
};

type RigBody = {
  name: string;
  shape: "box" | "sphere" | "capsule";
  size: [number, number, number];
  initialPosition: [number, number, number];
};

type RigDefinition = {
  bodies: RigBody[];
  joints: RigJoint[];
};
```

`AudioDrivenRig` responsibilities in detail:

- On `init`:
  - Use `PhysicsWorld` to create bodies and joints.
  - Create corresponding Three.js meshes for bodies.
  - Keep maps:
    - `bodyName → rigidBodyHandle`
    - `jointName → jointHandle`
    - `bodyHandle → mesh`.

- On `update(audioFeatures, preset)` each frame:
  - For each `joint` mapping defined in the preset:
    - Read the mapped feature value (e.g., `audioFeatures.bands[0]`).
    - Apply scaling / smoothing (from preset).
    - Apply torque/impulse or set the motor target/limit on the joint/body.

Pseudo-API:

```js
export class AudioDrivenRig {
  constructor(physicsWorld, sceneManager) {
    this.physicsWorld = physicsWorld;
    this.sceneManager = sceneManager;
    this.bodiesByName = new Map();
    this.jointsByName = new Map();
    this.meshesByBodyHandle = new Map();
  }

  init() {
    // Build the rig using a hardcoded RigDefinition or loaded config.
  }

  update(audioFeatures, preset, deltaTime) {
    // Apply audio-driven logic to joints.
  }

  syncVisuals() {
    // For each body: get transform from Rapier and update corresponding Three.js mesh.
  }
}
```

---

## 8. Rendering Subsystem

### 8.1 SceneManager

**File**: `render/SceneManager.js`

Responsibilities:

- Create Three.js `Scene`, `Renderer`, and basic lights.
- Add meshes that represent rig bodies.
- Provide accessors for camera and renderer.

Pseudo-API:

```js
export class SceneManager {
  constructor(containerElement) {
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.container = containerElement;
  }

  init() {
    // Create scene, renderer, camera, lighting, etc.
  }

  addMesh(mesh) {
    this.scene.add(mesh);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
```

### 8.2 CameraController

**File**: `render/CameraController.js`

Responsibilities:

- Handle camera controls (OrbitControls or custom).
- Respond to window resize if needed.

---

## 9. Presets & Configuration

### 9.1 PresetManager

**File**: `config/PresetManager.js`

Responsibilities:

- Load presets from:
  - Local JSON files for bundled tracks.
  - UI imports (file or text).
- Provide current preset object for current track.
- Handle preset mutations from UI.
- Generate random presets.

#### Preset Schema

Define a JSON schema-like structure (for documentation; an AI agent will implement actual validation as needed):

```ts
type FeatureSource =
  | { type: "rms" }
  | { type: "peak" }
  | { type: "band"; index: number }; // e.g. bands[0] = bass

type JointMapping = {
  jointName: string;          // must match rig joint name
  feature: FeatureSource;     // which audio feature drives this joint
  scale: number;              // multiplier for feature value
  offset: number;             // added after scaling
  smoothing: number;          // 0..1; low = snappy, high = smooth
  mode: "torque" | "position" | "angle"; // how to apply to joint
  min?: number;               // optional clamp
  max?: number;               // optional clamp
};

type PhysicsParams = {
  gravity: [number, number, number];
  damping: number;
  stiffness: number;          // if used for spring-like joints
};

type RenderingParams = {
  backgroundColor: string;    // e.g. "#000000"
  bloom?: boolean;
  colorPalette?: string[];    // e.g. ["#ff0000","#00ff00"]
};

type Preset = {
  id: string;
  name: string;
  description?: string;
  trackId?: string | null;    // null for generic presets
  physics: PhysicsParams;
  rendering: RenderingParams;
  mappings: JointMapping[];   // one or more mappings
};
```

#### Random Preset Generation

- `generateRandomPreset(rigDefinition, featureSpace): Preset`
  - `featureSpace` describes available features (e.g., `["rms", "peak", "band:0", "band:1", ...]`).
  - For each joint:
    - Pick a random feature.
    - Random scale within a range (e.g., `0.5..3.0`).
    - Random mode (torque/position/angle).
    - Random smoothing (0..0.8).

Pseudo-API:

```js
export class PresetManager {
  constructor() {
    this.presets = new Map(); // id -> Preset
    this.currentPresetId = null;
  }

  async loadPresetFromUrl(url) { /* fetch & parse */ }

  setCurrentPreset(presetId) { /* ... */ }

  getCurrentPreset() { /* returns current preset object */ }

  updateCurrentPresetPart(path, value) {
    // e.g. path = "physics.gravity[1]" or "mappings[0].scale"
    // Option: simpler direct assignment via callbacks from UI.
  }

  generateRandomPreset(rigDefinition) { /* ... */ }

  exportPreset(presetId) {
    const preset = this.presets.get(presetId);
    return JSON.stringify(preset, null, 2);
  }

  importPresetFromJson(jsonString) { /* parse and add */ }
}
```

---

## 10. UI / UX

### 10.1 UIController

**File**: `ui/UIController.js`

Responsibilities:

- Build and manage all HTML controls (either via:
  - direct DOM manipulation, or
  - simple creation in `index.html` + event binding).
- Mirror the layout shown in `mockup.png` (transport at top, selectors + parameter column underneath) so the shipped UI matches the approved reference.
- Emit events for:
  - Track selection.
  - User file selection.
  - Play/pause.
  - Preset selection.
  - Random preset generation.
  - Parameter changes (physics/rendering/mappings).
  - Export/import actions.

Use a central `EventBus` to decouple UI from App logic.

Example UI structure in `index.html`:

```html
<div id="app">
  <div id="visualizer-container"></div>
  <div id="controls">
    <select id="track-select"></select>
    <input type="file" id="track-upload" accept="audio/*" />
    <button id="play-pause">Play</button>

    <select id="preset-select"></select>
    <button id="random-preset">Random</button>

    <div id="parameters-panel">
      <!-- dynamically filled by UIController -->
    </div>

    <button id="export-preset">Export Preset</button>
    <button id="import-preset">Import Preset</button>
    <textarea id="preset-json-input"></textarea>
  </div>
</div>
```

`UIController` listens to DOM events and emits semantic events:

```js
// utils/EventBus.js
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, callback) {
    // subscribe
  }

  emit(eventName, payload) {
    // notify listeners
  }
}
```

Example events:

- `"track:selected"` → `{ trackId }`
- `"track:fileSelected"` → `{ file }`
- `"playPause:toggle"` → `{}`
- `"preset:selected"` → `{ presetId }`
- `"preset:randomRequested"` → `{}`
- `"preset:exportRequested"` → `{}`
- `"preset:importRequested"` → `{ jsonString }`
- `"preset:paramChanged"` → `{ path, value }`

---

## 11. App Orchestration & Lifecycle

### 11.1 App

**File**: `core/App.js`

Responsibilities:

- Initialize all subsystems in correct order.
- Coordinate communication via EventBus.
- Run main loop: audio analysis → physics update → render.

Initialization sequence:

1. Create `EventBus`.
2. Create `SceneManager` and initialize Three.js.
3. Create `PhysicsWorld` and initialize Rapier.
4. Create `AudioManager` and `AudioFeatureExtractor`.
5. Create `PresetManager` and load default presets for bundled tracks.
6. Create `AudioDrivenRig` with `PhysicsWorld` + `SceneManager`.
7. Create `UIController`, passing `EventBus` and initial data (track list, preset list).
8. Wire events:
   - On track selection → `AudioManager.loadTrackFromUrl(...)` + set preset.
   - On file upload → `AudioManager.loadTrackFromFile(...)` + maybe use generic preset.
   - On play/pause → call `AudioManager.togglePlayPause()`.
   - On preset changes → `PresetManager.updateCurrentPreset...`.
   - On “Random preset” → `PresetManager.generateRandomPreset(...)`.
9. Start animation loop using `requestAnimationFrame`.

Main loop pseudocode (inside `App`):

```js
update(timestamp) {
  const deltaTime = (timestamp - this.lastTimestamp) / 1000;
  this.lastTimestamp = timestamp;

  const features = this.audioFeatureExtractor.update();
  const preset = this.presetManager.getCurrentPreset();

  this.audioDrivenRig.update(features, preset, deltaTime);
  this.physicsWorld.step(deltaTime);
  this.audioDrivenRig.syncVisuals();
  this.sceneManager.render();

  requestAnimationFrame(this.update.bind(this));
}
```

---

## 12. Index HTML & Script Loading

**File**: `index.html`

Key requirements:

- Include Three.js and Rapier via `<script>` or import via URL in `main.js`.
- Include the `main.js` module:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Physics Audio Visualizer</title>
  <style>
    /* Basic layout styles, full-window canvas, control panel, etc. */
  </style>
</head>
<body>
  <div id="app">
    <div id="visualizer-container"></div>
    <div id="controls">
      <!-- See UI section for structure -->
    </div>
  </div>

  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

**File**: `src/main.js`

Responsibilities:

- Locate DOM elements (container, controls root).
- Instantiate `App` with DOM references.
- Call `app.init()` then `app.start()`.

```js
import { App } from "./core/App.js";

const container = document.getElementById("visualizer-container");
const controlsRoot = document.getElementById("controls");

const app = new App({
  visualizerContainer: container,
  controlsRoot
});

app.init().then(() => {
  app.start();
});
```

---

## 13. Utilities

### 13.1 download.js

Helpers for exporting preset:

```js
export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### 13.2 math.js

Helpers for smoothing, clamping, mapping:

```js
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

export function smoothValue(previous, target, smoothingFactor) {
  // smoothingFactor in [0, 1], higher = smoother
  return lerp(target, previous, smoothingFactor);
}
```

---

## 14. Error Handling & Logging

- Provide `console.warn` for non-fatal issues (missing preset, invalid mapping).
- Provide `console.error` for critical issues (couldn’t init Rapier, audio context errors).
- UI should show minimal messages:
  - “Failed to load audio file.”
  - “Invalid preset JSON.”

An AI coding agent should:
- Wrap async init steps with `try/catch`.
- Fail gracefully, e.g. show a message but keep UI responsive.

---

## 15. Performance Considerations

- Use a reasonable `fftSize` (e.g., 1024 or 2048) to balance precision and performance.
- Limit number of physics bodies and joints (e.g., ≤ 50 bodies).
- Avoid excessive DOM updates per frame:
  - UI updates should be event-based, not per animation frame.
- Use RAF only for render loop (no `setInterval` for physics).

---

## 16. Implementation Roadmap (For Coding Agents)

Suggested step-by-step tasks:

1. **Skeleton setup**
   - Create `index.html`, `main.js`, `App.js`, basic folder structure.
   - Implement a blank Three.js scene with a rotating cube.
2. **Rapier integration**
   - Initialize Rapier via CDN.
   - Create a single falling cube in Rapier, sync to a cube mesh in Three.js.
3. **Audio playback**
   - Implement `AudioManager` with play/pause and a basic audio element.
   - Hardcode one bundled track.
4. **Audio analysis**
   - Add `AudioFeatureExtractor`, log RMS and bands each frame to console.
5. **Rig & physics**
   - Implement `PhysicsWorld` fully.
   - Implement `AudioDrivenRig` with a simple chain or multiple bodies.
   - Map one audio feature to a joint for testing.
6. **Presets**
   - Implement `PresetManager`, load simple default preset JSON.
   - Add “Random” preset generator.
7. **UI**
   - Implement `UIController` with track selector, play/pause, preset selector.
   - Wire up parameter sliders for a subset of physics parameters.
8. **User audio**
   - Add file input support and confirm that analysis + physics works with user tracks.
9. **Export/import**
   - Implement preset export via download and import via textarea/file.
10. **Polish**
    - Add camera controls, nicer lighting, configurable background color, etc.
    - Optimize audio-band mapping and smoothing.
