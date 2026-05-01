# Tetra Overflow Ultra — Agent Instructions

## Project Overview
Mobile-first Tetris PWA built with **React 19 + Vite + Canvas 2D + Web Audio API**.  
See [README.md](README.md) for feature list and [public/manifest.json](public/manifest.json) for PWA config.

## Commands
```bash
npm install       # install deps
npm run dev       # dev server (http://localhost:5173/tetra-overflow/)
npm run build     # production build
npm run preview   # preview build
npm run lint      # ESLint 9
```

> **No test framework** (Jest/Vitest not installed). Game logic is testable but untested.

## Critical: Base URL
Vite base is hardcoded to `/tetra-overflow/`. All asset paths, service worker scope, and PWA `start_url` are relative to this. Do **not** change it without updating `vite.config.js`, `public/manifest.json`, and `public/sw.js`.

## Architecture

### Key Files
| File | Role |
|------|------|
| [src/App.jsx](src/App.jsx) | Monolithic: game loop (`requestAnimationFrame`), all UI, keyboard/DAS/ARR input, SFX synthesis (~1500 lines) |
| [src/logic/gameEngine.js](src/logic/gameEngine.js) | Pure-JS class; no React dependency; safe to unit-test |
| [src/logic/tetrominoes.js](src/logic/tetrominoes.js) | Board constants (`BOARD_WIDTH=10`, `BOARD_HEIGHT=22`), piece definitions |
| [src/logic/srs.js](src/logic/srs.js) | SRS wall-kick tables; 180° rotation uses custom logic |
| [src/logic/tetrisBot.js](src/logic/tetrisBot.js) | Dellacherie heuristic AI — **present but not wired into the UI** |
| [src/components/GameCanvas.jsx](src/components/GameCanvas.jsx) | Canvas 2D renderer + multi-touch pointer events |
| [src/components/TouchControls.jsx](src/components/TouchControls.jsx) | Button grid using PointerEvent API |
| [src/audio/musicManager.js](src/audio/musicManager.js) | BGM manager (5 MP3 tracks, lazy AudioContext, Zone LPF effect) |
| [src/contexts/ThemeContext.jsx](src/contexts/ThemeContext.jsx) | Theme + color-mode context; persists to localStorage |
| [src/styles/themes.css](src/styles/themes.css) | CSS variables per `data-theme` / `data-mode` |

### Game Engine API (key methods)
```js
engine.reset(mode)          // init board, spawn first piece
engine.update(dt)           // advance one frame (call from rAF loop)
engine.triggerAction(name)  // one-shot actions: moveLeft, rotateCW, hardDrop, hold, activateZone…
engine.getState()           // snapshot for rendering
engine.setSettings(cfg)     // update DAS/ARR/lockDelay
engine.addGarbage(lines)    // inject garbage rows
```

### Game Modes
`NORMAL` · `SPRINT` (40 lines) · `BLITZ` (120s, 1.25× gravity) · `PURIFY` (180s, infection mechanic) · `ZEN` (no topout)

## Conventions & Gotchas

- **`App.jsx` is monolithic** — game loop, state, all audio SFX, and UI live here. New features almost always touch this file.
- **Board is always 22 rows** (rows 0–1 are hidden spawn buffer). Zone rows accumulate at the bottom rather than clearing.
- **SFX are synthesized** via Web Audio API oscillators directly in `App.jsx` (~2000 lines of synth code). There are no audio asset files for SFX.
- **Theme-aware rendering** — `GameCanvas.jsx` switches drawing style per theme (e.g., `dmg` → inset rects, `sketch` → wavy outlines). When adding visual features, add a case per theme or a sensible fallback.
- **Lock delay:** 450ms, max 15 move/rotate resets per piece. Do not raise the cap; it prevents infinite stalling.
- **Gravity formula:** `0.8 × 1.22^(level-1)` cells/sec, capped at 20.
- **ESLint allows uppercase variable names** (`varsIgnorePattern: '^[A-Z_]'`) — constants like `BOARD_WIDTH` won't produce lint errors.
- **Old theme name migration** — `zen` and `neon` map to `classic` in `ThemeContext`. Don't reuse those names.
- **Canvas renders every frame** with no dirty-rect optimization — keep per-frame work lightweight on the main thread.
- **AudioContext is lazily created** and shared globally. SFX volume is controlled via `_sfxVol` closure variable in `App.jsx`.

## PWA / Service Worker
`public/sw.js` uses cache-first strategy. After any build output change, bump the cache version string at the top of `sw.js` so users get fresh assets.
