# PLAN – Browser-Based Physics Audio Visualizer

This plan is scoped for AI agents. Update checkboxes as work lands. Default assumption: humans only supply media assets (audio/preset JSON) and sign off on completed phases.

## Phase 0 – Scaffolding & Baseline (Foundational)
- [x] Create repo skeleton per `DESIGN.md` (index.html, src tree, audio/, presets/).
- [x] Stub `src/main.js` and `core/App.js` to boot a minimal RAF loop targeting the DOM containers described in `DESIGN.md`.
- [x] Add placeholder bundled tracks list in `audio/` (filenames only) and preset JSON stubs that mirror the naming convention.
- [x] Document npm scripts (if any) and how to serve locally (e.g., `npm install`, `npm run dev` or plain `http-server`).
- [x] Human: drop actual MP3 assets into `audio/` once stubs are in place.

## Phase 1 – Rendering & Physics Shell
- [ ] Implement `render/SceneManager.js` with Three.js scene, renderer, lighting, placeholder mesh.
- [ ] Implement `render/CameraController.js` (OrbitControls) and expose resize handling.
- [ ] Create `physics/PhysicsWorld.js` that initializes Rapier, steps simulation, and syncs debug primitives.
- [ ] Ensure App ties render + physics loops together with a single RAF tick.

## Phase 2 – Audio Playback Core
- [ ] Build `audio/TrackRegistry.js` to enumerate bundled tracks + metadata.
- [ ] Implement `audio/AudioManager.js` with Web Audio playback, play/pause, seek, and progress events.
- [ ] Wire DOM transport controls (play/pause button, scrub bar, time display) to AudioManager.
- [ ] Add fail-soft handling for autoplay restrictions and surface UI messages when unlocking audio context is required.

## Phase 3 – Audio Feature Extraction
- [ ] Implement `audio/AudioFeatureExtractor.js` that computes RMS, band energies (sub→high), spectral centroid, and rolloff each frame.
- [ ] Create smoothing/utility helpers per `DESIGN.md` (math.js) and unit-test them.
- [ ] Expose feature frames via an event emitter or shared state the physics rig can consume.
- [ ] Add Jest tests covering basic feature calculations (mocked analyser data).

## Phase 4 – Rig & Physics Integration
- [ ] Implement `physics/AudioDrivenRig.js` that instantiates the articulated body/joint structure described in `DESIGN.md`.
- [ ] Map baseline audio features to rig parameters (e.g., bass → root body impulse) to prove loop works.
- [ ] Add configuration schema for how presets drive joints (weights, damping, target angles).
- [ ] Validate physics stability (cap bodies ≤ 50, handle reset when switching tracks).

## Phase 5 – Presets System
- [ ] Build `config/PresetManager.js` with load/save/export/import APIs.
- [ ] Autoload preset JSON matching each bundled track and fall back gracefully if missing.
- [ ] Implement “Random” preset generator and expose hook in UI.
- [ ] Provide JSON download (using `download.js`) and import-from-file/text flows.
- [ ] Human: curate per-track preset JSON once tooling stabilizes (optional creative task).

## Phase 6 – UI/UX Layer
- [ ] Create `ui/UIController.js` (or equivalent) that renders track selector, preset selector, parameter controls, and messages.
- [ ] Integrate lil-gui or custom controls for live tweaking of physics/audio parameters.
- [ ] Add file input for user-provided audio; verify analysis + rig mapping works end-to-end.
- [ ] Surface minimal status/error messaging in the UI per Section 14 of `DESIGN.md`.

## Phase 7 – Polish, Performance, and QA
- [ ] Tune FFT size / update cadence to maintain 60 fps; add simple performance metrics logging.
- [ ] Implement camera polish (auto-path or cinematic motion) and improved lighting/scene theming.
- [ ] Add automated Jest regression tests for PresetManager and math helpers; document manual test script (play bundled track, load preset, switch to user file, export preset).
- [ ] Finalize DEVLOG entry + update documentation (README/usage notes) for release packaging.
- [ ] Human: run full experience review, confirm visual/physics vibe, and officially check off the phase.

## Ongoing Maintenance Tasks
- [ ] Keep `PLAN.md` and `DEVLOG.md` current whenever tasks move.
- [ ] Log assumptions or scope tweaks inline so future agents inherit context.
- [ ] Preserve modular boundaries (audio ↔ physics ↔ render ↔ config) as features grow.
