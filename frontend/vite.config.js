import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api calls to the Express backend on port 5000,
// so the frontend can use relative URLs and avoid CORS during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
