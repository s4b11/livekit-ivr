import path from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// One dev server runs both halves: the React app and the Worker (worker/index.ts),
// with a local D1 database. `vite build` produces what `wrangler deploy` ships.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
