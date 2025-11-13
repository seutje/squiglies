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
mockup.png             # Visual reference for the planned UI layout/state
src/
  main.js              # Boots the App with DOM references
  core/App.js          # Minimal RAF loop placeholder (pre-render/physics wiring)
audio/                 # Bundled album tracks (11 total)
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
presets/
  track01.json ... track11.json  # Schema-aligned preset stubs keyed by track ID (01-11)
```

## Visual Reference

`mockup.png` in the repo root captures the intended arrangement of the transport controls, selectors, and visualizer chrome. Use it as the baseline when expanding the HTML/CSS or wiring up `UIController` so future iterations stay aligned with the approved layout.

### Next Steps

- Reference `mockup.png` as you build out the UI so control placement matches the approved layout.
- Keep the bundled MP3 list above in sync with any future asset swaps (filenames are part of the Track Registry contract).
- Flesh out rendering, physics, audio, and preset modules following the roadmap in `PLAN.md`.
- Add Jest test suites as features are implemented.
