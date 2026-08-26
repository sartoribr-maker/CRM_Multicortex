import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3333';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  // O repositório ainda contém artefatos .js antigos ao lado dos fontes
  // TypeScript. Priorize os fontes para que o Vite não carregue essas cópias
  // desatualizadas em imports sem extensão.
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
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
