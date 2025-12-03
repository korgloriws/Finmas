import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar bibliotecas pesadas em chunks próprios
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'recharts': ['recharts'],
          'framer-motion': ['framer-motion'],
          'react-query': ['@tanstack/react-query'],
          'lucide-icons': ['lucide-react']
        }
      }
    }
  },
  publicDir: 'public',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
}) 