# tetra-overflow-ultra

A mobile-first Tetris Progressive Web App built with React + canvas.

## Features

- Modern Guideline-inspired gameplay (7-bag, SRS rotation, hold, lock delay, ghost piece)
- Responsive touch controls for thumb play
- DAS/ARR speed tuning sliders
- Neon dark UI inspired by tetr.io aesthetics
- PWA support (`manifest.json` + offline service worker)
- Looping NCS track playback and lightweight action SFX
- **Native Android APK packaging** (Trusted Web Activity)

## 📱 Android APK

This project includes a complete Android APK build system using Trusted Web Activity (TWA) technology. Package your PWA as a native Android app that can be distributed outside the Play Store!

**Quick Start:**
```bash
# Build a debug APK for testing
npm run build:apk:debug

# Build a production release APK
npm run build:apk
```

**Documentation:**
- 🚀 [Quick Start Guide](QUICK_START_APK.md) - Get building in 5 minutes
- 📚 [Full Setup Guide](APK_SETUP.md) - Complete instructions
- ✅ [Checklist](APK_CHECKLIST.md) - Step-by-step tracking
- 📋 [Summary](APK_SUMMARY.md) - What was created

**Features:**
- Trusted Web Activity (TWA) wrapper
- Full-screen native app experience
- Custom app icon and splash screen
- Digital Asset Links integration
- Automated build scripts for Windows, Mac, and Linux
- Optional build server for on-demand APK generation
- Download page UI at `/download` route

See the documentation for complete setup instructions including keystore generation, signing configuration, and deployment.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```
