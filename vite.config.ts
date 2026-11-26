import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { writeStandaloneDistFile } from './standaloneExport.ts';

function emitStandaloneHtmlPlugin(): Plugin {
  let emitted = false;
  return {
    name: 'dth-emit-standalone-html',
    apply: 'build',
    async closeBundle() {
      if (emitted || process.env.DTH_SKIP_STANDALONE === '1') return;
      emitted = true;
      await writeStandaloneDistFile();
    },
  };
}

export default defineConfig(({ command }) => {
  if (command === 'build') {
    process.env.NODE_ENV = 'production';
  }
  return {
    base: './',
    define: command === 'build' ? { 'process.env.NODE_ENV': '"production"' } : undefined,
    plugins: [
      react(),
      tailwindcss(),
      emitStandaloneHtmlPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      minify: 'oxc',
      cssMinify: true,
      sourcemap: false,
      target: 'es2022',
      chunkSizeWarningLimit: 1200,
      rolldownOptions: {
        output: {
          minify: {
            compress: {
              dropConsole: true,
              dropDebugger: true,
            },
          },
          manualChunks(id) {
            if (id.includes('node_modules/three/')) return 'three-vendor';
            if (id.includes('node_modules/react') || id.includes('node_modules/lucide-react')) {
              return 'ui-vendor';
            }
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
