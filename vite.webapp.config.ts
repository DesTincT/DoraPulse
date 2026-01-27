import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const postcssConfigPath = path.resolve(__dirname, 'postcss.webapp.config.cjs');
const postcssConfig = require(postcssConfigPath);
const postcssPluginsConfig = postcssConfig?.plugins;

const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');

const tailwindOptions = postcssPluginsConfig?.tailwindcss ?? {
  config: path.resolve(__dirname, 'tailwind.webapp.config.cjs'),
};
const autoprefixerOptions = postcssPluginsConfig?.autoprefixer ?? {};

export default defineConfig({
  root: path.resolve(__dirname, 'webapp'),
  base: '/',
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  build: {
    outDir: path.resolve(__dirname, 'webapp/dist'),
    assetsDir: 'assets',
    emptyOutDir: true,
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
    postcss: {
      plugins: [tailwindcss(tailwindOptions), autoprefixer(autoprefixerOptions)],
    },
  },
});
