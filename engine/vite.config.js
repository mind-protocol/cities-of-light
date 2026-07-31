import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const engineDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: 'engine/client',
  build: {
    outDir: '../../dist-engine',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        world: resolve(engineDir, 'client/index.html'),
        loopStudio: resolve(engineDir, 'client/loop-studio.html'),
      },
    },
  },
  plugins: [basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    https: true,
    proxy: {
      '/ws': {
        target: 'ws://localhost:8800',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:8800',
        changeOrigin: true,
      },
      '/world': {
        target: 'http://localhost:8800',
        changeOrigin: true,
      },
      '/voice': {
        target: 'http://localhost:8800',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8800',
        changeOrigin: true,
      },
    },
  },
  // Allow importing from src/client/ (existing modules)
  resolve: {
    alias: {
      '@client': '/../../src/client',
    },
  },
});
