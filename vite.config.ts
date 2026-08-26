import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          anthropic: ['@anthropic-ai/sdk'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: { usePolling: true },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
