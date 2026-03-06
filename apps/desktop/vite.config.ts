import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  clearScreen: false,
  plugins: [react(), tailwindcss()],
  server: {
    port: 47292,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  },
  build: {
    chunkSizeWarningLimit: 2000,
  }
})
