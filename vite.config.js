import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  // Base path for GitHub Pages deployment at root
  base: process.env.BASE_URL || '/',
  plugins: [react()],
  server: {
    hmr: {
      path: '/@vite',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
