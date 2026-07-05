import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuration Vite du backoffice Endirek.
// Documentation : https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Port de développement du backoffice (l'API écoute sur le port 3001).
    port: 5173,
  },
})
