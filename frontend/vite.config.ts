import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        // Preserve the browser's real Host header (localhost:5173) instead of
        // rewriting it to the proxy target — the backend's OAuth login flow
        // derives its own redirect/callback URLs from the incoming Host
        // header, so this needs to reach it unchanged, the same way IIS's
        // reverse proxy is configured to preserve it in production.
        changeOrigin: false,
      },
    },
  },
})
