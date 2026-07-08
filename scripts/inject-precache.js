// Post-build script: injects a precache list of all built assets into dist/sw.js
// This ensures the service worker caches all JS/CSS/image assets on install,
// enabling true offline support after the first visit.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const DIST = 'dist'
const SW_PATH = join(DIST, 'sw.js')
const ASSETS_DIR = join(DIST, 'assets')
// Respect BASE_URL from environment (matches vite.config.js default)
const RAW_BASE = process.env.BASE_URL || '/'
// Normalize to have leading and trailing slashes
const BASE = ('/' + RAW_BASE.replace(/^\/+|\/+$/g, '') + '/').replace(/^\/\//, '/')

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
    .map(f => `${BASE}assets/${f}`)
}

// Also precache the app shell root + manifest
const precacheList = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}manifest.json`,
  ...assetFiles,
]

const swSrc = readFileSync(SW_PATH, 'utf-8')

// Replace the APP_SHELL constant to include all build assets
const precacheJson = JSON.stringify(precacheList, null, 2)
  .split('\n')
  .join('\n  ')

let updated = swSrc.replace(
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

// Patch dist/manifest.json to reflect the actual BASE at deploy time
try {
  const MANIFEST_PATH = join(DIST, 'manifest.json')
  if (existsSync(MANIFEST_PATH)) {
    const manifestSrc = readFileSync(MANIFEST_PATH, 'utf-8')
    const manifest = JSON.parse(manifestSrc)
    const stripOldBase = (p) => String(p).replace(/^\.?\/+/, '').replace(/^tetra-overflow\//, '')
    const applyBase = (p) => {
      if (!p) return p
      if (typeof p === 'string' && p.startsWith(BASE)) return p
      const rel = stripOldBase(p)
      return `${BASE}${rel}`
    }
    // Force start_url/scope/id to the actual base
    manifest.start_url = BASE
    manifest.scope = BASE
    manifest.id = BASE
    if (Array.isArray(manifest.icons)) {
      manifest.icons = manifest.icons.map(icon => ({
        ...icon,
        src: applyBase(icon.src)
      }))
    }
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8')
    console.log(`[inject-precache] Updated manifest.json for base ${BASE}`)
  }
} catch (e) {
  console.warn('[inject-precache] Skipped manifest base patch:', e?.message || e)
}
