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
2025-11-13 - Phase 6 UI + user audio
- Added `UIController` with bundled track selector, preset dropdown, parameter sliders, and status messaging wired into the new CSS/HTML block per the mockup.
- Enabled local audio uploads plus preset-driven gravity/drive/damping tuning by extending AudioManager, PhysicsWorld, SceneManager, and AudioDrivenRig, then piped preset changes back into those systems via App.
- Updated PLAN to close Phase 6 engineering items so the next agent can move straight into polish/perf work.

2025-11-14 - Scene cleanup
- Removed the torus-knot placeholder mesh from `SceneManager` so the center of the scene stays clear for the physics rig.
- Retained only the ground platform initialization so lighting/shadows still have a visual reference plane.
2025-11-14 - Phase 7 polish + QA prep
- Added a `PerformanceMonitor`, FPS console logging, and adaptive analyser FFT/downsampling so the loop stays near 60 fps even on lower-power machines.
- Rebuilt the lighting rig (fog, glow ring, themed palette hooks) plus a cinematic idle camera path so presets can tint the scene and the experience feels deliberate out of the box.
- Expanded Jest coverage for math utilities + PresetManager mutators/randomizer, refreshed README with the manual QA script, and marked the remaining Phase 7 engineering tasks complete in PLAN.md.

2025-11-14 - Spotlight shadow artifacts
- Rebuilt the floor into a stylized stage that ignores shadows plus a dedicated shadow-catcher mesh sitting above it, then hid the Rapier debug ground so overlapping receivers no longer produce the radial artifacts when the camera moves.
- Tuned the spotlight’s bias/normal bias for the new catcher so the rig keeps contact shadows without self-shadow acne.

2025-11-14 - Audio-reactive idle dampening
- Added a fast-release “activity” signal to the AudioFeatureExtractor plus Jest coverage so silence is detected immediately without disturbing the existing smoothed feature stream.
- Gated the AudioDrivenRig driver values with that activity signal, added a dynamic damping boost for near-silent frames, and introduced a movement floor so the rig stays still when the audio goes quiet.

2025-11-14 - Physics suspends when audio is idle
- Hooked App into AudioManager state so the RAF loop only advances Rapier when playback is actually running and the analyser reports an active frame; the rig now freezes instantly when there is no audio.
- Added playback-aware gating in AudioDrivenRig plus a residual-motion bleed so joints zero out (or reset to rest) whenever audio is paused or the analyser reports silence.
- Extended the AudioFeatureExtractor with an activation threshold + isActive flag that zeros the feature frame when RMS falls beneath the gate, with updated Jest coverage to lock in the behavior.

2025-11-14 - Physics idles under gravity
- Let the main RAF loop advance Rapier regardless of playback so the rig settles under gravity as soon as the scene loads, while still keeping joint actuation gated behind active audio frames.

2025-11-14 - Rig stays still before playback
- Reintroduced playback-aware gating in the RAF loop so Rapier only steps once the transport is actually running, preventing the rig from slumping under gravity before the user hits play.
- Always run the AudioDrivenRig update each frame (with null features when idle) so it can keep bleeding any residual motion without relying on the physics step.
- Verified the change by running `npm test` to confirm the existing Jest suites still pass.

2025-11-14 - Camera default zoom distance
- Doubled the camera’s baseline orbit radius and starting position so the visualizer loads with a wider framing, keeping the full rig in view before the auto-motion kicks in.

2025-11-15 - Preset mapping controls
- Added a mappings folder to the lil-gui overlay with live dropdowns/sliders for every mapping parameter so the current preset routing is visible at a glance.
- Wired those controls back into PresetManager updates (feature type/index, axis, scale, clamps, target angles, etc.) so edits immediately persist like the other physics tuning knobs.
2025-11-15 - Preset cache busting
- Added cache-busting tokens to every track preset JSON URL so browsers always fetch the latest file instead of serving a stale cached copy.
- Ensured the helper works for all preset path variants (explicit filename, slug, or custom file) without impacting other PresetManager APIs.
2025-11-15 - Mapping panel sync
- Fixed the lil-gui synchronization path so dropdowns/sliders update even when their backing values change programmatically, letting the Feature/Drive controls follow whichever mapping is selected.
- Verified the regression fix by running the full Jest suite (`npm test`).
2025-11-15 - Audio feature monitor panel
- Added a dedicated lil-gui panel on the left edge of the scene that subscribes to App’s audio feature stream and surfaces RMS, peak, centroid, rolloff, and per-band energies in real time.
- Hooked the panel into the analyser initialization so band labels follow the current extractor configuration, then ran `npm test` to confirm nothing regressed.
2025-11-15 - Raw analyser frames
- Removed the feature-level smoothing logic from AudioFeatureExtractor so presets receive the analyser’s instantaneous RMS, band, centroid, rolloff, and energy data with no artificial lag.
- Updated the corresponding Jest coverage and App bootstrap path, then re-ran `npm test` to verify the analyser + preset suites still pass.
2025-11-15 - Normalized centroid/rolloff features
- Normalized the spectral centroid and rolloff features to 0–1 inside AudioFeatureExtractor (while keeping Hz readouts for the GUI) so presets can treat them like other normalized signals.
- Updated the AudioDrivenRig feature resolver, feature monitor panel, and accompanying Jest coverage to consume the normalized values.
2025-11-15 - Simplified rig silhouette
- Removed the articulated arm bodies and their spherical joints from `rigDefinition.js` to keep the physics rig closer to the core spine/tail/orbital forms requested for this pass.
- Re-ran the Jest suite (`npm test`) to confirm PresetManager and other modules continue to pass without the removed bodies.
2025-11-15 - Quieter rig response floor
- Raised the analyser silence gate and rig activity floors so RMS values below roughly 0.02 no longer trigger physics drive and the rig stays calm when audio is near-silent.
- Synced the rig’s frame activation threshold/movement floor with the new analyser defaults, then ran `npm test` to verify the suites still pass.
2025-11-14 - Rig respawn safety net
- Added a rig bounds helper with Jest coverage so we can quickly detect when any Rapier body dips well below the ground plane.
- Updated AudioDrivenRig/App to use the helper and automatically reset the pose whenever the rig falls off the floor, keeping the scene recoverable without manual reloads.
2025-11-15 - Softer audio drive response
- Introduced a rig-wide drive attenuation multiplier and lowered the default drive intensity so impulses/torque from audio features stay more subtle even when presets run at their previous stiffness levels.
- Dropped the lil-gui “Rig drive” slider floor plus all preset/default stiffness values to keep newly generated and bundled presets in the calmer response range, then re-ran `npm test` to confirm everything still passes.
2025-11-15 - Rig jitter limiter
- Added a per-mapping drive history with a delta-aware limiter in `AudioDrivenRig` so torque/impulse inputs ease between frames instead of snapping to analyser noise.
- Reset the limiter alongside other smoothing state whenever playback stops or the rig respawns so the stabilizer never holds on to stale offsets.
2025-11-15 - Impulse zero-centering helper
- Added an `ImpulseZeroCenter` utility plus Jest coverage so impulse-driven mappings continuously subtract their running baselin
es (or explicit neutral values) before hitting the rig.
- Routed AudioDrivenRig impulse paths through the helper, clearing its state during resets/transport toggles so gravity finally
 wins when the music stops.
- Documented the new optional `neutral` schema property for presets so curated mappings can define their own baselines, then rer
an `npm test` to confirm everything still passes.
2025-11-16 - Softer baseline spine + tail mappings
- Dialed back the baseline preset's mid-spiral torque and tail whip drive (lower scale/weight, tighter target angles, heavier damping) so the rig sways smoothly instead of snapping when those bands spike.
- Re-ran the Jest suite (`npm test`) to ensure the preset schema + helpers still behave as expected.
2025-11-16 - Curated per-track presets
- Regenerated every bundled track preset from the baseline rig mapping with track-specific tweaks (physics, rendering palettes, and mapping weights/bands) so each song now feels distinct while staying within the proven schema.
- Updated PLAN.md to mark the preset curation task complete and ran `npm test` to verify the preset + config suites continue to pass.
2025-11-16 - Rig cloning control
- Added an “Add rig” button to the lil-gui Presets folder that calls back into App so users can duplicate the current rig configuration right from the preset controls.
- Updated App/AudioDrivenRig to support multiple simultaneously simulated rigs with per-instance offsets, then re-ran `npm test` to confirm all suites continue to pass.
2025-11-16 - Track lead-in silence buffer
- Added a configurable one-second start delay inside AudioManager so every track begins with a short silent lead-in, giving the rig time to settle under gravity before audio-driven impulses kick in.
- Covered the new scheduling logic with dedicated Jest tests for fresh starts, paused resumes, and seek-to-zero flows, then re-ran `npm test` to confirm the full suite still passes.
2025-11-16 - Automatic track sequencing
- Added a TrackRegistry helper plus AudioManager.next-track workflow so playback automatically advances to the next bundled song and loops after the last entry while skipping user-loaded files.
- Expanded the AudioManager and TrackRegistry Jest suites to lock in the sequencing behavior, then re-ran `npm test` to confirm everything still passes.
2025-11-16 - Rebalanced rig alignment
- Repositioned every body in `rigDefinition` so capsule extents actually meet at their neighbors, updated the joint anchors to the real endcaps, and lowered the tail stack so the rig no longer spawns with compressed segments that immediately snap apart under physics.
- Re-ran `npm test` to make sure the config helpers and mapping schema still pass their suites after the rig geometry shift.
2025-11-15 - Sideways rig drop
- Added a global rig-orientation quaternion and spawn elevation inside `AudioDrivenRig` so every body is rotated 90° onto its side, translated into that sideways pose, and lifted slightly before the simulation runs.
- Updated the translation/rotation helpers to apply the shared orientation plus offset, then executed `npm test` to confirm the existing suites still pass with the new spawn logic.
2025-11-15 - Symmetric drive mapping
- Remapped the AudioDrivenRig drive helper so normalized 0/1 feature values now interpolate between each mapping's min/max, letting torque-driven joints swing both directions instead of staying positive.
- Added a dedicated driveMapping helper plus Jest coverage for the 0→min / 1→max behavior, then ran `npm test` to confirm all suites continue to pass.
