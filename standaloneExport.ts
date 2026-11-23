import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build as viteBuild } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedProdHtml: string | null = null;
let inflightBuild: Promise<string> | null = null;

function escapeScriptClose(js: string): string {
  return js.replace(/<\/(script)/gi, '<\\/$1');
}

function escapeStyleClose(css: string): string {
  return css.replace(/<\/(style)/gi, '<\\/$1');
}

export async function buildStandaloneHtml(useCache = false): Promise<string> {
  if (useCache && cachedProdHtml) {
    return cachedProdHtml;
  }

  const prebuiltPath = path.resolve(__dirname, 'dist', 'domaintechhub-office-3d.html');
  if (useCache) {
    try {
      const prebuilt = await fs.readFile(prebuiltPath, 'utf8');
      if (prebuilt.includes('<div id="root"></div>')) {
        cachedProdHtml = prebuilt;
        return prebuilt;
      }
    } catch {
      // Prebuilt file not present; fall back to in-memory Vite single-file build
    }
  }

  if (inflightBuild) {
    return inflightBuild;
  }

  inflightBuild = (async () => {
    const result = await viteBuild({
      root: __dirname,
      configFile: false,
      base: './',
      logLevel: 'silent',
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': __dirname,
        },
      },
      build: {
        write: false,
        outDir: 'dist-standalone',
        emptyOutDir: false,
        minify: 'oxc',
        cssMinify: true,
        sourcemap: false,
        target: 'es2022',
        assetsInlineLimit: 100_000_000,
        cssCodeSplit: false,
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
      },
    });

    const outputs = Array.isArray(result)
      ? result.flatMap((r) => r.output)
      : 'output' in result
        ? result.output
        : [];

    let htmlSource = '';
    const cssChunks: string[] = [];
    const jsChunks: string[] = [];

    for (const item of outputs) {
      if (item.type === 'asset') {
        if (item.fileName === 'index.html' || item.fileName.endsWith('.html')) {
          htmlSource = typeof item.source === 'string' ? item.source : Buffer.from(item.source).toString('utf8');
        } else if (item.fileName.endsWith('.css')) {
          const cssText = typeof item.source === 'string' ? item.source : Buffer.from(item.source).toString('utf8');
          cssChunks.push(cssText);
        }
      } else if (item.type === 'chunk' && item.isEntry) {
        jsChunks.push(item.code);
      }
    }

    if (!htmlSource) {
      htmlSource = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf8');
    }

    // Strip Vite-injected external module/preload/stylesheet tags so everything is inline
    let inlined = htmlSource
      .replace(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi, '')
      .replace(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi, '')
      .replace(/<link\b[^>]*\brel=["']stylesheet["'][^>]*href=["'](?!https?:\/\/)[^"']+["'][^>]*>/gi, '');

    const combinedCss = escapeStyleClose(cssChunks.join('\n'));
    const combinedJs = escapeScriptClose(jsChunks.join('\n'));

    const headInjection = `<script>window.__DTH_STANDALONE__=true;</script>\n<style>\n${combinedCss}\n</style>\n</head>`;
    const bodyInjection = `<script type="module">\n${combinedJs}\n</script>\n</body>`;

    if (inlined.includes('</head>')) {
      inlined = inlined.replace('</head>', () => headInjection);
    } else {
      inlined = `${headInjection}${inlined}`;
    }

    if (inlined.includes('</body>')) {
      inlined = inlined.replace('</body>', () => bodyInjection);
    } else {
      inlined = `${inlined}\n${bodyInjection}`;
    }

    if (useCache) {
      cachedProdHtml = inlined;
    }
    return inlined;
  })();

  try {
    return await inflightBuild;
  } finally {
    inflightBuild = null;
  }
}
