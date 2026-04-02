import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    open: true
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['sf-1-ee8q.onrender.com', 'localhost']
  }
})
