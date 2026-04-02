import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Dev + `vite preview`: forward Yjs and API to the Node server on :4000 */
const apiProxy = {
  '/shared': { target: 'http://127.0.0.1:4000', changeOrigin: true, ws: true },
  '/health': { target: 'http://127.0.0.1:4000', changeOrigin: true },
  '/document': { target: 'http://127.0.0.1:4000', changeOrigin: true }
} as const

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          yjs: ['yjs', 'y-websocket', 'y-codemirror.next'],
          codemirror: [
            'codemirror',
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/commands',
            '@codemirror/lang-markdown',
            '@codemirror/theme-one-dark'
          ],
          markdown: ['marked', 'dompurify']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true,
    proxy: apiProxy
  },
  preview: {
    port: 4173,
    host: true,
    proxy: apiProxy
  }
})
