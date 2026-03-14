import { resolve } from 'path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  root: 'engine/client',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  plugins: [basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    https: true,
    proxy: {
      '/ws': { target: 'ws://localhost:8800', ws: true },
      '/places/ws': { target: 'ws://localhost:8800', ws: true },
      '/api': { target: 'http://localhost:8800', changeOrigin: true },
      '/worlds': { target: 'http://localhost:8800', changeOrigin: true },
    },
  },
});
