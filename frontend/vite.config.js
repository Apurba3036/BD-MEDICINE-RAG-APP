import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-geojson': {
        target: 'https://rapid.ddm.gov.bd',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-geojson/, '')
      }
    }
  }
})
