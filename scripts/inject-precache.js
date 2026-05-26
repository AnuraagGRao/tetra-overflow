// Post-build script: injects a precache list of all built assets into dist/sw.js
// This ensures the service worker caches all JS/CSS/image assets on install,
// enabling true offline support after the first visit.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const DIST = 'dist'
const SW_PATH = join(DIST, 'sw.js')
const ASSETS_DIR = join(DIST, 'assets')

if (!existsSync(SW_PATH)) {
  console.warn('[inject-precache] dist/sw.js not found — skipping')
  process.exit(0)
}

// Collect all files in dist/assets/ (hashed JS, CSS, fonts, key images)
const ASSET_EXTENSIONS = new Set(['.js', '.css', '.woff', '.woff2', '.ttf'])
let assetFiles = []
if (existsSync(ASSETS_DIR)) {
  assetFiles = readdirSync(ASSETS_DIR)
    .filter(f => {
      const ext = f.slice(f.lastIndexOf('.'))
      return ASSET_EXTENSIONS.has(ext)
    })
    .map(f => `/tetra-overflow/assets/${f}`)
}

// Also precache the app shell root + manifest
const precacheList = [
  '/tetra-overflow/',
  '/tetra-overflow/index.html',
  '/tetra-overflow/manifest.json',
  ...assetFiles,
]

const swSrc = readFileSync(SW_PATH, 'utf-8')

// Replace the APP_SHELL constant to include all build assets
const precacheJson = JSON.stringify(precacheList, null, 2)
  .split('\n')
  .join('\n  ')

const updated = swSrc.replace(
  /const APP_SHELL = \[.*?\]\.map\(p => new URL\(p, BASE\)\.href\)/s,
  `const APP_SHELL = ${precacheJson}`
)

if (updated === swSrc) {
  // Fallback: inject just a comment noting the precache was computed
  console.warn('[inject-precache] Could not patch APP_SHELL in sw.js — check the pattern')
} else {
  writeFileSync(SW_PATH, updated, 'utf-8')
  console.log(`[inject-precache] Precached ${precacheList.length} assets in dist/sw.js`)
}
