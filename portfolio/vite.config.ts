import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    // Fonts stay separate files so they cache independently.
    assetsInlineLimit: 0,
  },
});
