import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
    host: true
  }
})
