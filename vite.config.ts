import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Bu satır GitHub Pages'te 404 hatalarını çözer (Dosya yollarını göreceli yapar)
  build: {
    outDir: 'dist',
  },
});