# Physics Audio Visualizer – Scaffold

This repository hosts the static ES-module based playground described in `DESIGN.md`. Phase 0 establishes the HTML/JS skeleton so later phases can focus on rendering, physics, audio, and presets.

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Launch the local static server (uses `http-server` under the hood):
   ```sh
   npm run start
   ```
   The site serves on `http://localhost:8000`. Because this is a static build, any other dev server (Vite preview, `python -m http.server`, etc.) will also work if preferred.

## Available Scripts

- `npm run start` – Runs `http-server` to serve the repo root for local development.
- `npm test` – Executes the Jest test runner (currently no suites are defined; future phases will add them alongside source modules).

## Project Layout

```
index.html             # Entry document per DESIGN.md (containers + inline styles)
src/
  main.js              # Boots the App with DOM references
  core/App.js          # Minimal RAF loop placeholder (pre-render/physics wiring)
audio/trackXX.mp3      # Placeholder filenames for bundled album tracks
presets/trackXX.json   # Schema-aligned preset stubs (mirrors audio naming)
```

### Next Steps

- Replace placeholder MP3s in `audio/` with the real bundled tracks.
- Flesh out rendering, physics, audio, and preset modules following the roadmap in `PLAN.md`.
- Add Jest test suites as features are implemented.
