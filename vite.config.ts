import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Honor an externally assigned port (e.g. preview tooling); default 5173
    port: Number(process.env.PORT) || 5173,
    proxy: {
      // Dev-only: forward API calls to the Spring Boot backend
      '/api': 'http://localhost:8080',
    },
  },
})
