import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/tetris/',
  root: '.',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});
