import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const raiz = (f: string) => fileURLToPath(new URL(f, import.meta.url));
export default defineConfig({
  server: { port: 5310, host: true, proxy: { '/api': 'http://127.0.0.1:8810', '/webhook': 'http://127.0.0.1:8810' } },
  appType: 'spa',
  build: { target: 'es2020', chunkSizeWarningLimit: 1500, rollupOptions: { input: { main: raiz('./index.html'), admin: raiz('./admin.html') } } },
});
