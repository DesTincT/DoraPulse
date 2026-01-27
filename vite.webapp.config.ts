import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'webapp'),
  base: '/webapp/',
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom/client'],
        },
      },
    },
  },
  css: {
    postcss: path.resolve(__dirname, 'postcss.webapp.config.js'),
  },
});
