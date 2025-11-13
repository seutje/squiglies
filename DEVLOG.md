2025-11-13 - Phase 0 scaffolding
- Added the static HTML shell plus placeholder canvas loop to start the render pipeline.
- Stubbed `src/main.js`/`core/App.js`, seeded audio + preset placeholders, and documented npm scripts.

2025-11-13 - Asset + doc refresh
- Captured the new mockup reference and real MP3 filenames in README/DESIGN so UI work stays aligned with the provided art direction.
- Added the eleventh preset stub, marked the asset drop complete in PLAN.md, and reiterated the audio catalog for TrackRegistry.

2025-11-13 - Phase 1 rendering + physics shell
- Introduced SceneManager, CameraController, and PhysicsWorld modules that stand up the Three.js scene, OrbitControls camera, and Rapier-backed debug stack.
- Replaced the placeholder canvas loop in `App` with a combined physics + render RAF tick, plus resize handling and on-canvas debug meshes.
2025-11-13 - Phase 2 audio core
- Added TrackRegistry, AudioManager, and TransportControls to cover playback, seek, and DOM wiring with unlock messaging per the plan.
- Updated the HTML/CSS shell plus PLAN to reflect the completed transport UX, and seeded Jest coverage for the registry metadata contract.
2025-11-13 - Import map fix for CDN modules
- Added an import map plus normalized Three.js imports so OrbitControls resolves without bare specifier errors in the browser.
2025-11-13 - Rapier import stabilization
- Added Rapier to the project dependencies and wired it into the HTML import map so the browser resolves the module locally instead of failing at runtime.
- Updated PhysicsWorld to load the module via the shared specifier, eliminating the 404 and ensuring the wasm asset stays colocated.
- 2025-11-13: Removed the Rapier npm dependency and added a CDN loader so the physics module downloads in the browser just like Neuromorphs does, keeping local installs lean while preventing 404s.
2025-11-13 - Viewport-clamped canvas
- Limited the Three.js renderer and camera aspect calculation to the viewport bounds so the canvas never grows beyond the visible window.
2025-11-13 - Phase 3 audio features
- Implemented the AudioFeatureExtractor with per-frame RMS/band/centroid/rolloff data plus a feature subscriber API on App so the physics rig can tap the latest frame.
- Added math smoothing helpers with Jest coverage alongside analyser-focused tests to secure the new analysis stack, then marked Phase 3 complete in PLAN.md.
2025-11-13 - Phase 4 rig integration
- Added a rig definition/config schema that caps the body count, encodes joint driver metadata (weights/damping/target angles), and exposes a baseline preset for mapping audio features.
- Built `AudioDrivenRig` to instantiate the articulated Rapier chain with matching Three.js meshes, apply feature-driven impulses/torques each frame, and reset the pose when tracks change.
- Updated the App + PhysicsWorld loop so feature frames drive the rig before stepping physics, visuals stay synced, and PLAN.md reflects the completed phase.
2025-11-13 - Rig joint compatibility hotfix
- Swapped the spherical joint creation over to Rapier’s `JointData.spherical` API (with a `ball` fallback) so the browser build on `0.11.2` initializes cleanly instead of throwing at startup.
- Added guardrails for Rapier step stability: clamped impulse/torque magnitudes, cloned mapping configs defensively, and wrapped the physics step/event queue draining so runaway forces no longer crash the wasm pipeline.
2025-11-13 - Phase 5 presets tooling
- Built `PresetManager` with track-aware loading, random generation, import/export, and download helpers, plus Jest coverage for the new config layer.
- Integrated the manager into App so track changes swap presets automatically, exposed the data to `AudioDrivenRig`, and added the PresetControls UI (randomize/export/download/import) with JSON textarea + file flow.
- Updated PLAN.md to close out Phase 5 engineering items and documented the new workflow in DEVLOG for the next agent.
