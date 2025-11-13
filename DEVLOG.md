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
