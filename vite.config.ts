import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { bridgePlugin } from './server/middleware.js'

// The Node bridge is mounted as Vite middleware → single process, single port,
// same-origin → zero CORS config in dev.
export default defineConfig({
  plugins: [vue(), bridgePlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: true,
  },
})
