import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // relative Pfade: der Build läuft unter jedem Unterpfad (z. B. GitHub Pages /<repo>/)
  base: './',
  server: {
    port: 5173,
    // Dateiänderungen auf Windows-Volumes werden im Container nur per Polling erkannt
    watch: { usePolling: true },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
