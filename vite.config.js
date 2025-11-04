import { defineConfig } from 'vite';

// Multi-page build: index, privacy, tos
export default defineConfig({
  root: 'public',
  base: '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: 'public/index.html',
        privacy: 'public/privacy.html',
        tos: 'public/tos.html',
      },
    },
  },
});
