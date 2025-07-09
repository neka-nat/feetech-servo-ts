import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist'
  },
  server: {
    port: 3000,
    host: true
  }
});