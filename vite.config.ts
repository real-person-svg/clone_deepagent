import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'apps/web',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:4317' },
  },
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('semi-') || id.includes('lodash') || id.includes('popper')) return 'ui';
          if (
            id.includes('remark') ||
            id.includes('markdown') ||
            id.includes('micromark') ||
            id.includes('mdast') ||
            id.includes('unified')
          )
            return 'markdown';
        },
      },
    },
  },
});
