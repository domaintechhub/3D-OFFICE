import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build as viteBuild } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedProdHtml: string | null = null;
let inflightBuild: Promise<string> | null = null;

// 91 printable ASCII chars (0x21..0x7E excluding '<', '>', '\') so HTML tags like </script> can never occur.
const B91_CHARS = (() => {
  let s = '';
  for (let i = 33; i < 127; i++) {
    if (i !== 60 && i !== 62 && i !== 92) {
      s += String.fromCharCode(i);
    }
  }
  return s;
})();

function encodeBase91(data: Uint8Array): string {
  let b = 0;
  let n = 0;
  let out = '';
  for (let i = 0; i < data.length; i++) {
    b |= data[i] << n;
    n += 8;
    if (n > 13) {
      let v = b & 8191;
      if (v > 88) {
        b >>= 13;
        n -= 13;
      } else {
        v = b & 16383;
        b >>= 14;
        n -= 14;
      }
      out += B91_CHARS[v % 91] + B91_CHARS[(v / 91) | 0];
    }
  }
  if (n > 0) {
    out += B91_CHARS[b % 91];
    if (n > 7 || b > 90) {
      out += B91_CHARS[(b / 91) | 0];
    }
  }
  return out;
}

export async function buildStandaloneHtml(useCache = false): Promise<string> {
  if (useCache && cachedProdHtml) {
    return cachedProdHtml;
  }

  const prebuiltPath = path.resolve(__dirname, 'dist', 'domaintechhub-office-3d.html');
  if (useCache) {
    try {
      const prebuilt = await fs.readFile(prebuiltPath, 'utf8');
      if (
        prebuilt.includes('<div id="root"></div>') &&
        prebuilt.includes('id="dth-z"') &&
        !prebuilt.includes('jsxDEV') &&
        !prebuilt.includes('_aistudio-iframe') &&
        !prebuilt.includes('fonts.googleapis')
      ) {
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
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const result = await viteBuild({
      root: __dirname,
      configFile: false,
      mode: 'production',
      base: './',
      logLevel: 'silent',
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      plugins: [
        react(),
        tailwindcss(),
      ],
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
        rolldownOptions: {
          output: {
            codeSplitting: false,
            minify: {
              compress: {
                dropConsole: true,
                dropDebugger: true,
              },
            },
          },
        },
      },
    }).finally(() => {
      if (prevNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = prevNodeEnv;
      }
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
        const fileName = String(item.fileName || '');
        const rawSource = item.source;
        if (fileName === 'index.html' || fileName.endsWith('.html')) {
          htmlSource = typeof rawSource === 'string' ? rawSource : Buffer.from(rawSource).toString('utf8');
        } else if (fileName.endsWith('.css')) {
          const cssText = typeof rawSource === 'string' ? rawSource : Buffer.from(rawSource).toString('utf8');
          cssChunks.push(cssText);
        }
      } else if (item.type === 'chunk' && item.isEntry) {
        jsChunks.push(String(item.code || ''));
      }
    }

    if (!htmlSource) {
      htmlSource = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf8');
    }

    // Strip any external scripts (including AI Studio dev harness), modulepreload links, Google Fonts links, and local stylesheets
    let inlined = htmlSource
      .replace(/<script\b[^>]*_aistudio-iframe[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<link\b[^>]*\brel\s*=\s*["']modulepreload["'][^>]*>/gi, '')
      .replace(/<link\b[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi, '')
      .replace(/<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*href\s*=\s*["'](?!https?:\/\/)[^"']+["'][^>]*>/gi, '');

    const cssBuf = Buffer.from(cssChunks.join('\n'), 'utf8');
    const jsBuf = Buffer.from(jsChunks.join('\n'), 'utf8');
    const packed = Buffer.concat([cssBuf, jsBuf]);
    const gzipped = zlib.gzipSync(packed, { level: 9, memLevel: 9 });
    const encodedPayload = encodeBase91(gzipped);

    const headInjection = `<script>window.__DTH_STANDALONE__=true;</script>\n</head>`;
    const bootScript = `(async()=>{var r=document.getElementById('root'),b=document.getElementById('dth-boot'),z=document.getElementById('dth-z');function fail(m){if(b)b.innerHTML='<div style="max-width:420px;padding:20px;border:1px solid rgba(255,255,255,.16);border-radius:8px;background:#0d121a;color:#f1f5f9;font-size:13px;line-height:1.5"><strong style="color:#f87171">Unable to launch offline viewer</strong><p style="margin:8px 0 0;color:#cbd5e1">'+m+'</p></div>';}try{if(typeof DecompressionStream!=='function'||!z){fail('Please open this file in a modern Chrome, Edge, Firefox, or Safari browser.');return;}var T=new Int8Array(128).fill(-1),i=33,k=0;for(;i<127;i++)if(i!=60&&i!=62&&i!=92)T[i]=k++;var s=z.textContent||'',cLen=Number(z.getAttribute('data-c')||0);z.textContent='';var len=s.length,out=new Uint8Array(Math.ceil((len*14)/16)+2),o=0,v=-1,bit=0,n=0;for(i=0;i<len;i++){var code=s.charCodeAt(i),c=code<128?T[code]:-1;if(c<0)continue;if(v<0){v=c;}else{v+=c*91;bit|=v<<n;n+=(v&8191)>88?13:14;do{out[o++]=bit&255;bit>>=8;n-=8;}while(n>7);v=-1;}}if(v>-1)out[o++]=(bit|(v<<n))&255;var gz=out.subarray(0,o),ds=new DecompressionStream('gzip'),ab=await new Response(new Blob([gz]).stream().pipeThrough(ds)).arrayBuffer(),raw=new Uint8Array(ab),td=new TextDecoder(),st=document.createElement('style');st.textContent=td.decode(raw.subarray(0,cLen));document.head.appendChild(st);var jsBlob=new Blob([raw.subarray(cLen)],{type:'text/javascript'}),url=URL.createObjectURL(jsBlob),sc=document.createElement('script');sc.type='module';sc.src=url;if(r&&typeof MutationObserver==='function'){var ob=new MutationObserver(function(){if(r.childNodes.length){ob.disconnect();if(b)b.remove();}});ob.observe(r,{childList:true});}sc.onload=function(){URL.revokeObjectURL(url);setTimeout(function(){if(b)b.remove();},300);};sc.onerror=function(){fail('Failed to initialize the 3D module runtime.');};document.body.appendChild(sc);}catch(e){fail(e&&e.message?e.message:'Decompression error.');}})();`;

    const bodyInjection =
      `<div id="dth-boot" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0b1322;color:#cbd5e1;font-family:system-ui,-apple-system,sans-serif;font-size:13px;z-index:9999">` +
      `<div style="text-align:center"><div style="color:#6fe3a1;font-weight:600;font-size:15px;margin-bottom:6px">DomainTechHub Office</div><div>Unpacking 3D scene…</div></div></div>\n` +
      `<script id="dth-z" type="text/plain" data-c="${cssBuf.length}">${encodedPayload}</script>\n` +
      `<script>${bootScript}</script>\n` +
      `</body>`;

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

export async function writeStandaloneDistFile(): Promise<string> {
  const html = await buildStandaloneHtml(false);
  const distDir = path.resolve(__dirname, 'dist');
  await fs.mkdir(distDir, { recursive: true });
  const outPath = path.join(distDir, 'domaintechhub-office-3d.html');
  await fs.writeFile(outPath, html, 'utf8');
  return outPath;
}
