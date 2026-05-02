# Copilot Reference — Tetra Overflow Ultra

Quick-reference for AI assistants to navigate this codebase fast.

---

## Project Overview

Mobile-first Tetris PWA built with **React 19 + Vite 6**. Canvas 2D renderer, synthesized SFX, and MP3 BGM. PWA-ready.

- Base URL: `/tetra-overflow/` (keep in sync across `vite.config.js`, `public/manifest.json`, and `public/sw.js`)
- Build/dev: `npm install` · `npm run dev` · `npm run build` · `npm run preview`
- Service worker: `public/sw.js` (cache version must be bumped after production changes)
- Security: Vite 6 (patched esbuild). Firestore rules in `/firestore.rules`.

---

## File Structure (key)

```
src/
  App.jsx                — Monolithic: game loop, UI, SFX, input
  App.css                — Layout and component styles
  index.css, main.jsx    — App bootstrapping
  audio/
    musicManager.js      — BGM manager (Web Audio API + <audio>)
  components/
    GameCanvas.jsx       — Canvas renderer + multi-touch
    TouchControls.jsx    — Mobile portrait controls
    ThemeSwitcher.jsx    — Minor UI
    AboutPage.jsx        — In-game modal (legacy)
  contexts/
    ThemeContext.jsx     — Theme, color-mode, bgTheme, favorites
  logic/
    gameEngine.js        — Pure JS engine; safe to unit test
    randomBag.js, srs.js, tetrominoes.js, tetrisBot.js
    themeMappings.js     — BG→piece theme mapping (shared)
  pages/
    ThemePage.jsx        — Locks, purchases, favorites strip
    StorePage.jsx        — Store filtering (excludes story-unlocks)
    StoryLevelPage.jsx   — Story mode UI (uses theme override)
    ArtworkPage.jsx      — MP4 gallery + full-screen detail view + voting
    InfoPage.jsx         — Standalone info/support page
  styles/
    themes.css           — 20+ visual themes via CSS variables
public/
  manifest.json, sw.js, icons/
```

---

## Game Modes

Active modes (shown in UI):
| Constant | Label | Notes |
|---|---|---|
| `GAME_MODE.NORMAL` | Normal | Standard Tetris + Zone meter |
| `GAME_MODE.SPRINT` | Sprint | Clear 40 lines as fast as possible |
| `GAME_MODE.BLITZ` | Blitz | 2-minute score attack (1.25× gravity multiplier) |
| `GAME_MODE.PURIFY` | Purify | Clear infected rows; infection spreads on a timer |
| `GAME_MODE.ZEN` | Zen | No game-over; endless relaxed play |

`ULTIMATE` combines tower-climb floors + escalating garbage waves + chaos rising. `TOWER` mode was merged into `ULTIMATE` and no longer exists as a standalone mode.

---

## TetrisEngine (`src/logic/gameEngine.js`)

Pure JS class — no React deps.

Key methods:
- `reset(mode)` — start/restart a game
- `update(dt)` — advance game state by `dt` ms; returns new state
- `triggerAction(name)` — e.g. `'moveLeft'`, `'rotateCW'`, `'hardDrop'`, `'hold'`, `'softDrop'`
- `getState()` — returns snapshot object
- `setSettings(cfg)` — update ghost, DAS, vibration, etc.
- `addGarbage(lines)` — send garbage lines (Versus/Purify)
- `addInfectionLayer()` — Purify: spread infection from bottom
- `activateZone()` — start Zone mode (Normal only)

Key state fields (from `getState()`):
- `board`, `piece`, `hold`, `queue`, `score`, `level`, `lines`
- `gameOver`, `gameOverReason`, `paused`, `zoneActive`, `zoneMeter`
- `purifyTimer`, `infectedRows`, `infectionAdded` ← set each tick when infection was added
- `mode`, `elapsedMs`, `pendingGarbage`

Gravity: `0.8 * 1.22^(level-1)` cells/sec (cap 20). Lock delay 450ms, up to 15 reset moves.

---

## App.jsx Architecture

All game state lives in React `useState`/`useRef`. The game loop is a `requestAnimationFrame` loop inside a `useEffect`.

Key refs:
- `heldRef` — currently held keyboard keys
- `actionRef` — pending triggered actions
- `gameModeRef` — current mode (kept in sync with `gameMode` state)
- `musicOnRef` — kept in sync with `musicOn` state
- `countdownActiveRef` — prevents game loop running during 3-2-1 countdown

Key functions:
- `startGame(mode)` — resets engine, triggers countdown, starts BGM
- `handlePauseToggle()` — pauses/resumes + plays SFX + calls `musicManager.pause()`/`.resume()`
- `triggerAction(name)` — enqueues action into `actionRef`
- `playNote(freq, vol, dur, type, delay?)` — synthesized SFX via Web Audio
- `playNoise(freq, vol, dur, delay?)` — noise burst SFX
- Various SFX functions: `playLineClearSFX`, `playTetrisSFX`, `playPauseSFX`, `playResumeSFX`, `playInfectionSFX`, etc.

Rendering:
- Desktop: `renderDesktop()` — side flanks + board + controls
- Mobile portrait: `renderMobileNormal()` — HUD + board + `TouchControls` + bottom panel
- Mobile landscape: `renderMobileLandscape()` — condensed HUD + board + buttons

Solo bottom panel CSS selector: `.pt-panel` (uses `var(--c-panel)` colors). Stacking is `z-index: 2` so it sits above world backgrounds.

---

## Audio (`src/audio/musicManager.js`)

MP3-based background music manager using Web Audio API.

```js
import musicManager from './audio/musicManager'
musicManager.start()     // begin BGM (fades in), loads tracks async
musicManager.stop()      // fade out and stop
musicManager.pause()     // mute without stopping playback (use for game pause)
musicManager.resume()    // restore volume
musicManager.setVolume(0..1)
musicManager.setZoneFx(true/false)  // LPF + duck for Zone mode
musicManager.playCountdownBeep(n)   // n = 3,2,1 → pitch varies
musicManager.playZoneReady()
musicManager.playZoneEnd(lines)
```

Tracks and gains:
```js
{ url: 'Full_Throttle_Logic.mp3',    gain: 0.85 }
{ url: 'Gravity_s_Last_Descent.mp3', gain: 0.75 }
{ url: 'Perfect_Rotation.mp3',       gain: 0.90 }
{ url: 'The_Last_Key.mp3',           gain: 0.80 }
{ url: 'The_Winning_Move.mp3',       gain: 0.85 }
```

Audio graph: `trackGain → masterGain → lpf → volumeGain → destination`

---

## SFX in App.jsx

All SFX use Web Audio oscillators/noise — no audio files needed.

```js
playNote(freq, vol, dur, type, delay?)  // oscillator note
playNoise(cutoff, vol, dur, delay?)     // filtered white noise
```

Defined SFX functions (subset):
- `playLineClearSFX(lines, isTSpin, isAllClear)`
- `playTetrisSFX()`
- `playLevelUpSFX()`
- `playPauseSFX()` / `playResumeSFX()`
- `playZenResetSFX()`
- `playInfectionSFX()` — triggered when `state.infectionAdded` is true in game loop

---

## Vibration

Uses `navigator.vibrate()` via inline calls in the game loop (inside `requestAnimationFrame`).

- All durations are ≥20ms for Android compatibility
- `startGame()` calls `navigator.vibrate(1)` as an unlock gesture
- Pattern example for Tetris: `[20, 15, 40]`

```js
try { navigator.vibrate?.(duration) } catch {}
```

---

## Purify Mode Details

- Infection spreads from bottom via `addInfectionLayer()` every N seconds
- Difficulty hardcoded to `'easy'` (no UI selector)
- Timer displayed in HUD as "Left" countdown
- `state.infectionAdded` is `true` for exactly one tick when a new layer is added → trigger `playInfectionSFX()`

---

## Theme System (critical)

- ThemeContext values: `{ theme, setTheme, colorMode, setColorMode, bgTheme, setBgTheme, favThemes, setFavThemes }`
- Piece (board) theming is handled inside `GameCanvas.jsx` using `PIECE_COLOR_MAPS`.
- World backgrounds use `BackgroundCanvas` and are controlled via `bgTheme`.
- Story Mode uses a BG→piece theme mapping to keep art coherent.

Shared mapping: `src/logic/themeMappings.js` exports `BG_TYPE_TO_PIECE_THEME`.

- Solo/Casual mode: when `bgTheme` is active, pieces automatically adopt the mapped piece theme (unless `themeOverride` is explicitly provided). This is done inside `GameCanvas.jsx`.
- Previews (hold/next) also mirror this mapping in `App.jsx` `PiecePreview`.
- Favorites strip (ThemePage/CasualGamePage):
  - Favorite entries can be a piece theme id (e.g. `terracotta`) or a background id (e.g. `bg_forest`).
  - Clicking a background favorite sets `bgTheme` (and pieces follow the mapping).
  - Clicking a piece theme favorite sets `theme` and clears `bgTheme`.

Add/adjust piece colors in `PIECE_COLOR_MAPS` (exported by `GameCanvas.jsx`). When adding a visual theme, ensure:
- CSS variables for panels in `src/styles/themes.css` (look for `[data-theme="NAME"]` blocks)
- Piece color map in `PIECE_COLOR_MAPS.NAME`
- Optional custom draw strokes in `drawCell` switch in `GameCanvas.jsx`

## Known Architecture Decisions

1. **MASTER/VERSUS removed from UI** — constants still exist in `gameEngine.js` but removed from all `MODES` arrays and render functions
2. **TetrisBot imported but unused** — `tetrisBot.js` kept, import removed from `App.jsx`
3. **musicManager pause ≠ stop** — use `pause()`/`resume()` for pause; `stop()` only on quit
4. **Vite glob** — use `import.meta.glob('.../*.mp4', { eager: true, query: '?url', import: 'default' })`
5. **Service worker** — bump cache version in `public/sw.js` after prod build changes
6. **Firestore rules** — see `/firestore.rules`; deploy with `firebase deploy --only firestore:rules`

## Troubleshooting quick hits

- Bottom panel invisible on mobile: check that `data-theme` is set and `themes.css` has a `[data-theme] .pt-panel` block. `.pt-panel` has `z-index: 2` to avoid background overlap.
- Pieces not using theme colors: confirm `themeOverride` or `bgTheme` mapping path, and ensure `PIECE_COLOR_MAPS[theme][type]` exists.
- Artwork page builds: use Vite 6 glob format with `query: '?url', import: 'default'`.
