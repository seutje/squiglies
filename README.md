# Physics Audio Visualizer

Browser-based visualizer that pairs a Rapier-driven rig with Web Audio feature extraction, cinematic Three.js lighting, and preset tooling. Everything ships as static ES modules so it can run from any static host.

## Feature Highlights

- Three.js scene with upgraded stage lighting, fog, and glow accents plus an auto-path camera that eases into cinematic orbits when idle.
- Rapier rig with audio-driven impulses/torques fed by a dynamic FFT analyser that automatically downshifts detail when performance drops.
- Track registry, transport controls, preset import/export/randomizer, and user-audio uploads wired into the UI shell from `mockup.png`.
- Console-level performance HUD (avg/min/max FPS) driven by the new `PerformanceMonitor`, so perf regressions are easy to spot without external tooling.

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Serve the static site:
   ```sh
   npm run start
   ```
   Visit `http://localhost:8000` (or point a different static server at the repo root).
3. Run the Jest suites:
   ```sh
   npm test
   ```

## Manual QA Script

Follow this quick loop before handing off a build:

1. `npm run start`, open the app, and press Play on the default bundled track. Verify the rig responds and the console logs FPS snapshots.
2. Use the preset dropdown to swap to a different track preset, then hit "Random Preset" and confirm the new lighting palette and camera glide react in real time.
3. Click the file input, load any local MP3, and ensure the analyser re-locks and the rig re-centers without console errors.
4. Export the current preset (JSON download), clear it via the UI, and import the saved file to confirm the configuration round-trips.

## Project Layout

```
index.html               # Static entry document (containers + inline styles)
src/
  main.js                # Boots App with DOM references
  core/App.js            # Orchestrates audio/physics/render loops
  audio/                 # AudioManager, FeatureExtractor, TrackRegistry
  physics/               # PhysicsWorld + AudioDrivenRig definitions
  render/                # SceneManager + CameraController polish
  config/                # PresetManager + rig definitions
  ui/                    # Transport/preset controls + track UI
  utils/                 # math helpers, download helper, PerformanceMonitor
audio/                   # Bundled MP3 catalog (11 mastered tracks)
presets/                 # Track-aligned preset JSON stubs
```

## Testing & Quality Gates

- `npm test` runs the math helper specs plus PresetManager regression coverage (random preset generation, track binding, imports, etc.).
- Manual QA (see above) covers the transport, preset lifecycle, user-audio uploads, and export/import flows.
- Runtime performance is traceable via the `PerformanceMonitor` console logs (avg/min/max FPS) plus the analyser auto-tuning messages.

For design, architecture, and module contracts, keep `DESIGN.md` and `PLAN.md` handy—they're the canonical references for future contributions.
