import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath, URL } from 'node:url'

// `npm run build:demo` produces a fully static build (hash routing + bundled
// sample data) that can be hosted anywhere without the Python backend.
export default defineConfig(({ mode }) => ({
  // Demo build = one self-contained HTML file (JS, CSS and fonts inlined) + /images.
  plugins: mode === 'demo' ? [react(), viteSingleFile()] : [react()],
  base: mode === 'demo' ? './' : '/',
  build: mode === 'demo' ? { outDir: 'dist-demo', assetsInlineLimit: 100000000 } : {},
  resolve: {
    alias: {
      '@seed': fileURLToPath(new URL('../backend/app/seed/seed_data.json', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8000' },
  },
}))
