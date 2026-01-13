import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // CMS API endpoints (polls management)
      '/api/polls': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
      // Embed API endpoints (poll viewing, voting, streaming)
      '/api/poll': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      // Embed iframe HTML
      '/embed': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
