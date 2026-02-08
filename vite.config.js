import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  root: 'src/client',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  plugins: [basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    https: true,
    // Proxy WebSocket to spatial state server
    proxy: {
      '/ws': {
        target: 'ws://localhost:8801',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:8800',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
