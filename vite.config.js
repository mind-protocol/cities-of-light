import { resolve } from 'path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  root: 'src/client',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/client/index.html'),
        place: resolve(__dirname, 'src/client/place.html'),
      },
    },
  },
  plugins: [basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    https: true,
    // Proxy WebSocket to spatial state server
    proxy: {
      '/ws': {
        target: 'ws://localhost:8800',
        ws: true,
      },
      '/places/ws': {
        target: 'ws://localhost:8800',
        ws: true,
      },
      '/api/places': {
        target: 'http://localhost:8800',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8800',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/services': {
        target: 'http://localhost:8800',
        changeOrigin: true,
      },
      '/vault-media': {
        target: 'http://localhost:8800',
        changeOrigin: true,
      },
    },
  },
});
