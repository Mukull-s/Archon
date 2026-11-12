import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Pinned deliberately. The API builds its OAuth `redirect_uri` from
    // CLIENT_URL (server/.env), and the callback page hands the result back to
    // its opener via postMessage to that same origin. If Vite silently drifts to
    // :5174 because :5173 was busy, the browser refuses the cross-origin
    // postMessage and the sign-in popup spins forever with no error.
    // `strictPort` makes that collision a loud failure instead of a silent one.
    port: 5173,
    strictPort: true,
  },
})
