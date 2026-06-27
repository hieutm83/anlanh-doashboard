import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Set VITE_BASE_PATH=/repository-name/ in GitHub Actions when needed.
  base: mode === 'production' ? (process.env.VITE_BASE_PATH || './') : '/',
  build: { sourcemap: true, chunkSizeWarningLimit: 900 },
}));
