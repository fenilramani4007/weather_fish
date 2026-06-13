import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      // All /api/* requests are forwarded to the FastAPI backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Keep the existing POST endpoint accessible via proxy too
      '/generate-documents': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
