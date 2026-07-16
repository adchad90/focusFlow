import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  publicDir: path.resolve(__dirname, '../../src/public'),
  build: {
    outDir: path.resolve(__dirname, '../../dist/web'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api/': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req) => {
            if (req.url?.startsWith('/api/auth/discord/callback')) {
              const loc = proxyRes.headers.location;
              if (loc && loc.includes('localhost:5000')) {
                proxyRes.headers.location = loc.replace('localhost:5000', 'localhost:5173');
              }
            }
          });
        },
      },
    },
  },
});
