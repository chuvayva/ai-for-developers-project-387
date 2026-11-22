import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The end-to-end run sets API_ORIGIN to point the proxy at its own server.
const apiOrigin = process.env.API_ORIGIN ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiOrigin,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
