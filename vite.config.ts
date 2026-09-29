import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_API_PROXY ?? 'http://127.0.0.1:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Pin the dev server to IPv4 loopback explicitly. Left unset, Vite binds
    // whatever `localhost` resolves to, which on Windows is `::1` (IPv6) first.
    // Browsers and tools that try IPv4 `127.0.0.1` then get connection refused,
    // so the app appears to "sometimes work" depending on resolution order.
    // 127.0.0.1 is the address every client falls back to, and it stays on
    // loopback so the app is not exposed to the local network.
    host: '127.0.0.1',
    // Proxying in dev means the browser only ever talks to one origin, so there
    // are no CORS preflights and no `VITE_API_URL` to keep in sync per machine.
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libraries out of the app bundle so a
        // code change does not force every user to re-download the charts.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
