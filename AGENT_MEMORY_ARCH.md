# Tetris Mobile Clone Architecture Memory

## 1. Directory Structure & Core Systems

- **`src/`**
  - **`components/`**:
    - Core Gameplay: `GameCanvas.jsx` (2D Canvas Tetris board), `TouchControls.jsx` (virtual buttons & gesture overlays), `TetrominoMini.jsx` / `PiecePreview.jsx` (hold/next piece displays).
    - Layout & HUD: `LandscapeGameLayout.jsx`, `LandscapeLeftPanel.jsx`, `LandscapeRightPanel.jsx`, `FocusHud.jsx`, `FocusMiniHud.jsx`, `ZoomControl.jsx`, `StoryMapHUD.jsx`.
    - Visual FX: `BackgroundCanvas.jsx` (procedural Vanta/Three.js/CSS shaders), `SynesthesiaMotionLayer.jsx` (reactive particle emissions on clears), `GlitchOverlay.jsx`.
    - Modals & Utility: `SettingsPage.jsx`, `ErrorBoundary.jsx`, `ThemeSwitcher.jsx`, `LoadingScreen.jsx`.
  - **`pages/`**:
    - Season Levels: `StoryLevelPage.jsx` (Season 1), `ZodiacLevelPage.jsx` (Season 2), `Season3LevelPage.jsx` (Season 3), `Season4LevelPage.jsx` (Season 4), `PantheonLevelPage.jsx` (Pantheon).
    - Season Maps: `StoryMapPage.jsx` (S1), `ZodiacMapPage.jsx` (S2), `Season3MapPage.jsx` (S3), `Season4MapPage.jsx` (S4), `PantheonMapPage.jsx` (Pantheon).
    - Modes & Hubs: `MainMenuPage.jsx`, `CasualGamePage.jsx`, `MultiplayerPage.jsx`, `StorePage.jsx`, `StatsPage.jsx`, `ThemePage.jsx`, `StoryLorePage.jsx`, `StorySeasonSelectPage.jsx`.
  - **`logic/`**:
    - Core Engine: `gameEngine.js` (`TetrisEngine` class with 60Hz tick, lock delay, DAS/ARR, garbage queue, zone mechanics), `tetrominoes.js` (matrices & spawn offsets), `srs.js` (Super Rotation System wall kicks), `randomBag.js` (7-bag generator).
    - Configuration & Theming: `gameConfig.js` (user DAS/ARR/volume settings), `themeMappings.js` (palette mappings for classic, dmg, obsidian, frozen, inferno, stellar, warp), `backgroundProfiles.js`.
    - Season & Story Data: `storyData.js` (S1), `storyData_s2.js` (S2), `storyData_s3.js` (S3), `storyData_s4.js` (S4), `storyData_s5.js` (S5/Pantheon).
    - Event Bus: `synesthesiaBus.js` (pub/sub for line clears and audio-visual synchronization).
  - **`audio/`**:
    - Managers: `storyMusicManager.js` (S1), `season2MusicManager.js` (S2), `season3MusicManager.js` (S3), `season4MusicManager.js` (S4), `season5MusicManager.js` (S5).
    - Synthesizers: `gameSfx.js` (Web Audio API sound synthesis with ducking & pitch bends), `uiSfx.js`.
  - **`firebase/`**: `config.js`, `auth.js`, `db.js` (cloud save for progress, high scores, badges).
  - **`contexts/`**: `AuthContext.jsx`, `ThemeContext.jsx`.
  - **`hooks/`**: `useResponsiveHUD.js` (breakpoint & aspect ratio adaptation), `useStoryProgress.js`, `useGameAudio.js`.
  - **`AppRouter.jsx`**: Central React Router v7 configuration with code-splitting and legacy redirects.
  - **`App.jsx`**: Global wrapper with ErrorBoundary, theme initialization, and audio listener.

---

## 2. State Management & Data Flow

- **Game Engine Isolation**: `TetrisEngine` in `src/logic/gameEngine.js` is a headless, framework-agnostic state machine. It manages piece physics, gravity, line detection, SRS kicks, and T-spin validations.
- **Rendering Loop**: Run inside `requestAnimationFrame` using delta-time capping (`MAX_FRAME_MS = 34`). Engine updates take user actions (held DAS/ARR state and action triggers) and output immutable snapshots (`engine.getState()`).
- **Canvas Rendering**: `GameCanvas.jsx` receives `state` via props/ref and draws to an HTML5 `<canvas>` with DPR scaling, ghost projection, lock delay flashes, and row-clear dissolve animations.
- **Input Flow**:
  - Desktop: Keyboard listener maps key codes to held directions (DAS/ARR auto-repeat) and single actions (`hardDrop`, `hold`, `rotateCW`).
  - Mobile: `TouchControls.jsx` and touch gesture handlers in `GameCanvas.jsx` dispatch the same held/action payloads.
- **Audio & Visual Synchronization**: Line clears publish `SYNESTHESIA_EVENT.LINE_CLEAR` to `synesthesiaBus.js`, causing `SynesthesiaMotionLayer.jsx` to spawn reactive shockwaves, while `musicManager.getBeatEnergy()` drives HUD pulse animations.

---

## 3. High-Standard Component-Based Architecture Plan

### The Problem with Monolithic Pages & Failed Pseudo-Hook Container
Prior to refactoring, level pages (`StoryLevelPage`, `ZodiacLevelPage`, `Season3LevelPage`, `Season4LevelPage`, `PantheonLevelPage`) duplicated 1,200–1,800 lines of identical boilerplate (rAF game loop, touch controls, responsive landscape layouts, zoom controls, pause modal, settings modal).
A previous naive attempt tried to create a single 1,400-line "God Component" (`GameLevelContainer.jsx`) by copy-pasting Season 3 and passing pseudo-hooks (`useMechanicsHook`) as props. This failed because:
1. It violated React's Rules of Hooks (calling hooks conditionally and inside helper callbacks).
2. It hardcoded Season 3 routes and victory text (`← Season 3 Map`, `SEASON 3 COMPLETE ✦`, `/s3`), obliterating Zodiac boss concession speeches, Chapter milestone endings, and Pantheon overlays.
3. It left missing variables and 38 ESLint errors.

### The Correct Component-Based Solution
Refactor using clean, industry-standard React architectural patterns (Hooks + Compound Components + Slots):

1. **`useTetrisGame` Custom Hook (`src/hooks/useTetrisGame.js`)**:
   - Centralizes the game engine lifecycle, DAS/ARR auto-repeat, keyboard event listeners, pause toggle, synesthesia emissions, and rAF animation frame loop.
   - Decoupled from any season: exposes pure state (`state`, `engine`, `paused`, `phase`, `isLandscape`, `zoom`, `focus`, `triggerAction`, `handlePress`, `handleRelease`, `togglePause`, `restartGame`).
2. **`GameShell` Presentation Component (`src/components/game/GameShell.jsx`)**:
   - Encapsulates `BackgroundCanvas`, `SynesthesiaMotionLayer`, `LandscapeGameLayout`, `GameCanvas`, `TouchControls`, `ZoomControl`, and responsive sizing.
   - Provides slots (`leftPanelAddon`, `rightPanelAddon`, `hudTopAddon`) so unique season mechanics (Zodiac Boss Attack HUD, Season 3 Rewind Gauge) can be injected cleanly without coupling.
3. **Reusable Modals & Overlays (`src/components/game/`)**:
   - `PauseMenu.jsx`: Resume, Restart, Settings, Audio volume controls, Exit to Map.
   - `SettingsModal.jsx`: Wraps `SettingsPage` with uniform backdrop and close handlers.
   - `StoryBriefingModal.jsx`: Handles pre-level story dialogue, character art, and 13-second auto-start countdown.
   - `LevelResultModal.jsx`: Themeable victory/defeat screen supporting boss dialogues, rewards, retry, next-level routing, and custom milestone overlays.
4. **Season Pages as Clean Orchestrators**:
   - Each season page (`StoryLevelPage`, `ZodiacLevelPage`, `Season3LevelPage`, `Season4LevelPage`, `PantheonLevelPage`) drops from 1,800 lines to ~150–250 lines.
   - Season-specific mechanics hooks (e.g. `useBossAbility` in Zodiac, `useS3Mechanics` in S3) are called directly at the top level of their own page where React Rules of Hooks are strictly respected.
