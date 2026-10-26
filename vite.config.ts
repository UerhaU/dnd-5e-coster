import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/spellbook': 'http://127.0.0.1:3011',
      '/api': apiTarget,
    },
  },
  build: {
    rollupOptions: { input: { main: 'index.html', spellbook: 'spellbook.html', equipment: 'equipment.html',races:'races.html' } },
  },
});
