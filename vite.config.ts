import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  // Pinned: the Google OAuth client registers http://localhost:5173 as its
  // origin, so dev must fail loudly rather than drift to another port.
  server: { port: 5173, strictPort: true },
})
