import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true, // fail loudly instead of silently using another port
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
})