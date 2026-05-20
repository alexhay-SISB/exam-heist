import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/exam-heist/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0
  },
  optimizeDeps: {
    include: ['pdfjs-dist']
  }
});
