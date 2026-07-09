import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api/data': 'http://127.0.0.1:3001',
      '/api/projects': 'http://127.0.0.1:3001',
      '/runtime-data': 'http://127.0.0.1:3001',
    },
  },
});
