# 🤖 AI Agent Next Steps Guide

**Last Updated:** July 12, 2026  
**For:** Future AI assistants working on Tetra Overflow Ultra

This document tracks incomplete tasks, known limitations, and clear instructions for the next development phase.

---

## 📊 Project Status Summary

| Component | Status | Completion |
|-----------|--------|------------|
| **Season 4: The Genesis Protocol** | ✅ COMPLETE | 100% |
| Season 4 Map & Levels | ✅ Complete | Full gameplay, animations, modals |
| Season 4 Story Integration | ✅ Complete | Lore page shows S4 content after levels beaten |
| Season 4 Routing | ✅ Complete | `/s4` and `/s4/:sectorId/:levelId` routes |
| **StoryMapHUD Component** | 🔶 OPTIONAL | 0% integration (component created, not used) |
| Season 1-4 Map Unification | 🔶 OPTIONAL | Pending: wrap maps in StoryMapHUD |
| **Music Integration** | ✅ COMPLETE | 9 sector tracks with async preload/retry and pause/resume |
| **Season 4 Controls** | ✅ COMPLETE | Shared held/action loop, keyboard, touch, gamepad, DAS/ARR |
| **Season 4 Pause/Settings** | ✅ COMPLETE | Full pause menu and scrollable settings modal |
| **APK Build System** | ✅ COMPLETE | All scripts ready, builds working |
| **Firebase Setup** | ✅ COMPLETE | Auth, Firestore, Hosting configured |

---

## 🎯 Immediate Next Tasks (Priority Order)

### Completed: Season 4 Music and Controls

Season 4 now has sector playlists using the existing files in `src/audio/story_season_4/`. Playback waits for asynchronous decoding, resumes the AudioContext after level start, and supports pause/resume/previous/next controls.

The implemented tracks are in `src/audio/story_season_4/`; the manager is [season4MusicManager.js](src/audio/season4MusicManager.js), and gameplay initialization is in [Season4LevelPage.jsx](src/pages/Season4LevelPage.jsx).

---

### Task 2: Optional - Integrate StoryMapHUD for Unified Maps 🔶

**Why:** Reduces code duplication. Gives consistent header/nav across all 4 season maps.

**Current Status:**
- ✅ Component created: [StoryMapHUD.jsx](src/components/StoryMapHUD.jsx)
- ✅ Detailed docs: [STORY_MAP_HUD_INTEGRATION.md](STORY_MAP_HUD_INTEGRATION.md)
- ❌ Not integrated into any maps yet

**What to do:**
Wrap each season map's children with StoryMapHUD:

```jsx
// Example: Season4MapPage.jsx
<StoryMapHUD
  seasonTitle="THE GENESIS PROTOCOL"
  seasonSubtitle="Season 4"
  seasonColor="#a78bfa"
  currentProgress={completedLevelCount}
  totalProgress={14}
  onHome={() => navigate('/story')}
  onPreviousSeason={() => navigate('/s3')}
  onNextSeason={null}  // No Season 5 yet
  onZoomIn={zoomIn}
  onZoomOut={zoomOut}
  onResetView={resetZoom}
  currentZoom={mapZoom}
>
  {/* Existing map SVG/canvas goes here */}
</StoryMapHUD>
```

**Maps to update (in order):**
1. [Season4MapPage.jsx](src/pages/Season4MapPage.jsx) - newest, cleanest ref
2. [Season3MapPage.jsx](src/pages/Season3MapPage.jsx)
3. [ZodiacMapPage.jsx](src/pages/ZodiacMapPage.jsx)
4. [StoryMapPage.jsx](src/pages/StoryMapPage.jsx) - oldest, most complex

**Effort:** ~30 min per map, mostly copy-paste of prop values

**Files:**
- [Complete integration guide](STORY_MAP_HUD_INTEGRATION.md)
- [Visual reference](STORY_MAP_HUD_VISUAL.md)

---

## 🔧 Known Limitations & Design Decisions

### 1. Monolithic App.jsx
- **File:** [src/App.jsx](src/App.jsx) (~2500 lines)
- **Why:** Central game loop, all SFX synthesis, multiple game modes in one component
- **Impact:** Changes to core game mechanics touch this file
- **Mitigation:** Game engine logic is in pure-JS [gameEngine.js](src/logic/gameEngine.js) (safe to test)

### 2. Season 4 LevelPage Built from S3 Template
- **File:** [src/pages/Season4LevelPage.jsx](src/pages/Season4LevelPage.jsx)
- **Note:** Intentionally minimal; S4 mechanics are same as S3 (no time-travel specific tweaks yet)
- **If adding S4-specific mechanics:** Extend like Season 3 does with rewind/dilation logic

### 3. No Season 4 Music Yet
- **Status:** Level pages exist but music manager is a stub
- **Priority:** Medium (game works without it, but sounds repetitive if using S3 themes)

### 4. Landscape Layout Support
- **Status:** Works, tested on all pages
- **Caveat:** Relies on `isLandscape` hook detecting `window.innerWidth > window.innerHeight`
- **Mobile detection:** Always treats iOS/Android as `isMobile: true` even on iPad landscape

### 5. Canvas Zoom System (50-200%)
- **File:** All 4 level pages have identical zoom logic
- **Persistence:** localStorage key `tetris-zoom`
- **UI:** Modal dialog (number input 50-200)
- **Note:** Not fully DRY; consider extracting to custom hook if more changes needed

---

## 📁 Critical Files for Future Work

### Game Logic
| File | Purpose | Size |
|------|---------|------|
| [src/logic/gameEngine.js](src/logic/gameEngine.js) | Core game state machine | ~1800 lines |
| [src/logic/storyData_s4.js](src/logic/storyData_s4.js) | S4 levels, mechanics, lore | ~350 lines |
| [src/logic/storyData_s3.js](src/logic/storyData_s3.js) | Temporal mechanics templates | ~400 lines |
| [src/logic/srs.js](src/logic/srs.js) | Wall-kick rotation tables | ~200 lines |
| [src/logic/tetrominoes.js](src/logic/tetrominoes.js) | Piece definitions, board constants | ~150 lines |

### Pages (Story Modes)
| File | Mode | Levels | Status |
|------|------|--------|--------|
| [src/pages/StoryLevelPage.jsx](src/pages/StoryLevelPage.jsx) | Season 1 | 21 | ✅ Complete |
| [src/pages/ZodiacLevelPage.jsx](src/pages/ZodiacLevelPage.jsx) | Season 2 | 13 | ✅ Complete |
| [src/pages/Season3LevelPage.jsx](src/pages/Season3LevelPage.jsx) | Season 3 | 15 | ✅ Complete |
| [src/pages/Season4LevelPage.jsx](src/pages/Season4LevelPage.jsx) | Season 4 | 14 | ✅ Complete |

### Maps
| File | Navigation | Status |
|------|-----------|--------|
| [src/pages/StoryMapPage.jsx](src/pages/StoryMapPage.jsx) | S1 chapters | ✅ Complete |
| [src/pages/ZodiacMapPage.jsx](src/pages/ZodiacMapPage.jsx) | S2 boss grid | ✅ Complete |
| [src/pages/Season3MapPage.jsx](src/pages/Season3MapPage.jsx) | S3 epochs | ✅ Complete |
| [src/pages/Season4MapPage.jsx](src/pages/Season4MapPage.jsx) | S4 sectors | ✅ Complete |

### Audio
| File | Purpose |
|------|---------|
| [src/audio/musicManager.js](src/audio/musicManager.js) | BGM playback for casual modes |
| [src/audio/season3MusicManager.js](src/audio/season3MusicManager.js) | ⭐ Use as template for S4 |
| [src/audio/gameSfx.js](src/audio/gameSfx.js) | SFX (synthesized) |
| [src/audio/uiSfx.js](src/audio/uiSfx.js) | UI clicks, alerts |

### Routing & Navigation
| File | Routes |
|------|--------|
| [src/AppRouter.jsx](src/AppRouter.jsx) | All routes, auth guards |
| [src/contexts/AuthContext.jsx](src/contexts/AuthContext.jsx) | Firebase auth state |

---

## 🚀 How to Add a New Feature

### Adding a New Traditional Season (Season 6+)
1. Create [src/logic/storyData_s6.js](src/logic/storyData_s6.js) with sectors/levels (copy S4 as template)
2. Create [src/pages/Season6MapPage.jsx](src/pages/Season6MapPage.jsx) (copy Season4MapPage)
3. Create [src/pages/Season6LevelPage.jsx](src/pages/Season6LevelPage.jsx) (copy Season4LevelPage, with all SFX fixes from Season 4)
4. Create [src/audio/season6MusicManager.js](src/audio/season6MusicManager.js) (copy season3/4 template)
5. Update [src/AppRouter.jsx](src/AppRouter.jsx): add imports + routes `/s6` and `/s6/:sectorId/:levelId`
6. Update [src/pages/StoryLorePage.jsx](src/pages/StoryLorePage.jsx): add S6 import + useMemo block
7. Update unlock condition in storyData_s6.js (require s5 pantheon completion)

### About Season 5 (Pantheon Arc)
Season 5 uses a **boss-encounter structure** (not traditional level/sector):
- [src/logic/storyData_s5.js](src/logic/storyData_s5.js) - 11 deity bosses with unique mechanics
- [src/pages/PantheonLevelPage.jsx](src/pages/PantheonLevelPage.jsx) - Single game page for all bosses
- [src/pages/PantheonMapPage.jsx](src/pages/PantheonMapPage.jsx) - Boss roster/progression
- [src/audio/season5MusicManager.js](src/audio/season5MusicManager.js) - Music management

### Adding a New Game Mechanic to Season 4
1. Define mechanic type in [src/logic/storyData_s4.js](src/logic/storyData_s4.js) (add to `mechanic` tags array)
2. Add logic to [src/logic/gameEngine.js](src/logic/gameEngine.js) (update/physics/collision methods)
3. Add rendering in [src/components/GameCanvas.jsx](src/components/GameCanvas.jsx) (overlay after board draw)
4. Add visual effect in [src/pages/Season4LevelPage.jsx](src/pages/Season4LevelPage.jsx) if needed (state/animation)
5. Test on multiple themes (dmg, sketch, neon, etc.) — GameCanvas applies theme-specific rendering

### Adding a Custom Theme
1. Add CSS variables to [src/styles/themes.css](src/styles/themes.css)
2. Update [src/contexts/ThemeContext.jsx](src/contexts/ThemeContext.jsx) if adding new color mode
3. Add piece colors to [src/components/GameCanvas.jsx](src/components/GameCanvas.jsx) PIECE_COLOR_MAPS object
4. Optional: Add to [src/logic/themeMappings.js](src/logic/themeMappings.js) for BG→piece theme mapping

---

## 🧪 Testing Checklist for New Features

- [ ] Builds without errors: `npm run build`
- [ ] Dev server starts: `npm run dev` → http://localhost:5173/tetra-overflow/
- [ ] Mobile portrait: Works at 375×667px
- [ ] Mobile landscape: Works at 812×375px
- [ ] Desktop: Works at 1920×1080px
- [ ] Touch controls respond correctly
- [ ] Keyboard input works (arrow keys, Z, X, C, space)
- [ ] Progress saves to Firestore
- [ ] Service worker caches assets (check DevTools > Application > Service Workers)
- [ ] Theme switching works with new feature
- [ ] No console errors in DevTools

---

## 📝 Firebase Setup (Already Configured)

**Project:** tetra-overflow-ultra  
**Services:** Auth (email), Firestore, Hosting

### Key Collections
- `users/{uid}/progress` — Story completion, zone unlocks, theme purchases
- `leaderboard/` — Top scores (casual mode)
- `artwork/` — User voting on MP4 gallery

### Security Rules
- [firestore.rules](firestore.rules) — Read your own progress, leaderboard public read

### Deployment
- Use Firebase CLI: `npx -y firebase-tools@latest deploy`
- Updates `index.html`, service worker, and assets
- Base URL: `/tetra-overflow/` (hardcoded in Vite)

---

## 🐛 Debugging Tips

### Inspect Game State
```javascript
// In browser console during gameplay
window.gameState  // Current engine state snapshot
window.config     // Player settings
window.progress   // Firebase progress (async fetch)
```

### Check Service Worker
1. DevTools → Application → Service Workers
2. Scope: `/tetra-overflow/`
3. Cache name format: `tetra-overflow-v{timestamp}`
4. If cache stale, update version string at top of [public/sw.js](public/sw.js)

### Profile Canvas Performance
- DevTools → Performance → Record
- Look for "paint" and "composite" durations
- Target: <16ms per frame (60 FPS)
- If slow: check GameCanvas render loop in App.jsx

---

## 📚 Architecture Overview

```
┌─────────────────────────────────────┐
│     React 19 App (App.jsx)          │  Main loop: rAF, state mgmt
├─────────────────────────────────────┤
│                                     │
├─ Game Logic ─────────────────────┐  │
│  gameEngine.js (pure-JS)         │  │  Board state, collision, scoring
│  → update(dt) per frame          │  │  No React dependency ✓
│  → triggerAction(name)           │  │
└──────────────────────────────────┘  │
│                                     │
├─ Rendering ───────────────────────┐ │
│  GameCanvas (Canvas 2D)           │ │  Piece graphics, theme rendering
│  BackgroundCanvas (Canvas 2D)     │ │  Parallax BG patterns
│  SynesthesiaMotionLayer (React)   │ │  Haptic feedback overlay
└──────────────────────────────────┘  │
│                                     │
├─ Audio ──────────────────────────┐  │
│  musicManager (Web Audio API)     │  │  BGM playback
│  gameSfx (synthesized oscillators)│  │  SFX generation
└──────────────────────────────────┘  │
│                                     │
├─ Routing ────────────────────────┐  │
│  AppRouter (React Router)        │  │  Auth guards, lazy load pages
│  AuthContext                     │  │  Firebase auth state
└──────────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
      ↓
  [Firebase SDK]
  - Auth (email/password)
  - Firestore (progress, leaderboard)
  - Analytics (play events)
```

---

## 🎯 Before You Start

1. **Understand the codebase:** Read AGENTS.md (project conventions)
2. **Test locally:** `npm install` → `npm run dev`
3. **Know the patterns:**
   - Story data: See [storyData_s4.js](src/logic/storyData_s1.js) for structure
   - Level pages: Copy from [Season4LevelPage.jsx](src/pages/Season1LevelPage.jsx)
   - Maps: Copy from [Season4MapPage.jsx](src/pages/Season1MapPage.jsx)
4. **Check progress:** Always query Firestore before assuming a feature is done
5. **Save work:** Commit frequently to git

---

**Good luck! 🚀**

For questions about specific systems, refer to AGENTS.md or code comments.
