// Generates public/api/version.json from package.json version
// Also bumps CACHE_NAME in public/sw.js to invalidate old caches
import { mkdirSync, writeFileSync, readFileSync } from 'fs'
import { dirname } from 'path'

try {
  const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
  const version = String(pkg.version || '0.0.0')

  const outPath = 'public/api/version.json'
  mkdirSync(dirname(outPath), { recursive: true })
  const payload = {
    version,
    updatedAt: new Date().toISOString(),
  }
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')

  // Best-effort: bump SW cache name to include current version
  try {
    const swPath = 'public/sw.js'
    const swSrc = readFileSync(swPath, 'utf-8')
    const nextCacheName = `tetra-overflow-v${version}`
    const updated = swSrc.replace(/const\s+CACHE_NAME\s*=\s*['"][^'"]+['"]/,
      `const CACHE_NAME = '${nextCacheName}'`)
    if (updated !== swSrc) writeFileSync(swPath, updated, 'utf-8')
  } catch (e) {
    console.warn('[write-version-json] Skipped SW cache bump:', e?.message || e)
  }

  console.log(`[write-version-json] Wrote ${outPath} with version ${version}`)
} catch (e) {
  console.error('[write-version-json] Failed:', e)
  process.exitCode = 1
}
