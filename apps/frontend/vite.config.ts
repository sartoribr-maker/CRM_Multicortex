import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3333';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
});
