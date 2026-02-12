import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: './client',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        // Suppress EPIPE/ECONNRESET errors when backend restarts (node --watch)
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (['ECONNRESET', 'EPIPE', 'ECONNREFUSED'].includes(err.code)) {
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Backend restarting...' }));
              }
            }
          });
        },
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        // Suppress WebSocket proxy errors during backend restarts
        configure: (proxy) => {
          proxy.on('error', () => {});
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
