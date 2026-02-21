import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Production build configuration for Hostinger
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  base: '/', // Change this if your app is in a subdirectory
})

