import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error — Vite resolves this at runtime without extension
import { timespentApiPlugin } from './server/plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), timespentApiPlugin()],
  server: {
    host: '0.0.0.0',
  },
})
