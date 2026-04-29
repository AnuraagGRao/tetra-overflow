# Copilot Reference — tetris-mobile-clone

> Quick-reference for AI assistants to understand the codebase and avoid re-discovery overhead.

---

## Project Overview

Mobile-first Tetris PWA built with **React 18 + Vite**. Deployed as a PWA with fullscreen mode on Android.

- Base URL: `/tetris-mobile-clone/`
- `manifest.json`: `"display": "fullscreen"`, `"orientation": "any"`
- Service worker: `public/sw.js`
- Build: `npm run dev` / `npm run build`

---

## File Structure

```
src/
  App.jsx               — Main component: all game state, game loop, UI rendering
  App.css               — Layout, component styles
  index.css             — Global resets, CSS variables
  main.jsx              — React root mount
  audio/
    musicManager.js     — BGM manager (MP3-based, Web Audio API)
    Full_Throttle_Logic.mp3
    Gravity_s_Last_Descent.mp3
    Perfect_Rotation.mp3
    The_Last_Key.mp3
    The_Winning_Move.mp3
  components/
    GameCanvas.jsx      — Canvas renderer for board, pieces, ghost
    TouchControls.jsx   — On-screen touch buttons (mobile portrait)
    ThemeSwitcher.jsx   — Theme picker UI
    AboutPage.jsx       — Info overlay
    SettingsPage.jsx    — Settings overlay (ghost, DAS, vibration, zoom)
  contexts/
    ThemeContext.jsx     — React context for current theme string
  logic/
    gameEngine.js       — TetrisEngine class (pure JS, no React)
    randomBag.js        — 7-bag random piece generator
    srs.js              — SRS rotation system + wall kick tables
    tetrominoes.js      — PIECES shape/color data
    tetrisBot.js        — Bot AI (unused in UI, kept for reference)
  styles/
    themes.css          — CSS variable themes
public/
  manifest.json
  sw.js
  icons/
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

Removed from UI (still in engine constants): `GAME_MODE.MASTER`, `GAME_MODE.VERSUS`

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

Gravity formula: `0.8 * Math.pow(1.22, level - 1)` cells/second, capped at 20.

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
- Desktop: `renderDesktop()` — left flank + game area + right flank
- Mobile portrait: `renderMobileNormal()` — HUD + board + `TouchControls`
- Mobile landscape: `renderMobileLandscape()` — side stats + board + buttons (swipe/gamepad only)

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

Tracks and their per-track gain values:
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

Defined SFX functions (all in App.jsx):
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

## Known Architecture Decisions (from session)

1. **MASTER/VERSUS removed from UI** — constants still exist in `gameEngine.js` but removed from all `MODES` arrays and render functions
2. **TetrisBot imported but unused** — `tetrisBot.js` kept, import removed from `App.jsx`
3. **musicManager pause ≠ stop** — always use `pause()`/`resume()` for game pause, `stop()` only on quit
4. **Gravity is exponential** — changed from linear in a session to give proper speed-up at higher levels
5. **Purify difficulty** — was easy/normal/hard, now always `'easy'` passed to `engine.reset()`
