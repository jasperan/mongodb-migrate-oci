import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev server proxies the Express API so the browser only ever talks to one origin.
// In production the same /api path is served by a reverse proxy (see nginx.conf).
const apiProxy = {
  '/api': {
    target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
    changeOrigin: true
  }
}

const socketProxy = {
  '/socket.io': {
    target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
    changeOrigin: true,
    ws: true
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 8080,
    strictPort: false,
    proxy: apiProxy
  },
  // `npm run preview` serves the production bundle with the same single-origin
  // contract as the dev server (and as nginx in a container deployment), so a
  // built app can be smoke-tested without Docker.
  preview: {
    port: 8080,
    strictPort: false,
    proxy: { ...apiProxy, ...socketProxy }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900
  }
})
