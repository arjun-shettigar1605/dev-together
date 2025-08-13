import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'global': 'window',
    'process.env': {},
    'process': '{}',
  },
  resolve: {
    alias: {
      events: 'events',
      util: 'util',
      buffer: 'buffer',
      stream: 'stream-browserify',
    },
  },
  optimizeDeps: {
    include: ['simple-peer', 'buffer', 'util'],
  },
})