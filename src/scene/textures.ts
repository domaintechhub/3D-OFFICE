import * as THREE from 'three';
import { onAppFontsReady } from './fonts';
import { createSeededRng } from './prng';

let maxAnisotropy = 4;
let nonTextTexMaxSize = 1024;

export function setMaxAnisotropy(a: number) {
  maxAnisotropy = Math.max(1, a);
  for (const tx of TEX_CACHE.values()) {
    const isText = Boolean(tx.userData?.isText);
    tx.anisotropy = isText ? Math.max(4, maxAnisotropy) : maxAnisotropy;
    tx.needsUpdate = true;
  }
}
export function getMaxAnisotropy(): number {
  return maxAnisotropy;
}

export function setNonTextTexMaxSize(sz: number) {
  nonTextTexMaxSize = Math.max(128, Math.min(1024, Math.floor(sz)));
}

export function clearTexturesCache() {
  for (const tx of TEX_CACHE.values()) {
    tx.dispose();
  }
  TEX_CACHE.clear();
  TEXT_REDRAW_QUEUE.length = 0;
}

const TEX_CACHE = new Map<string, THREE.CanvasTexture>();
const TEXT_REDRAW_QUEUE: Array<() => void> = [];
let fontHooksWired = false;

function ensureFontRedrawHook() {
  if (fontHooksWired) return;
  fontHooksWired = true;
  onAppFontsReady(() => {
    for (let i = 0; i < TEXT_REDRAW_QUEUE.length; i++) {
      TEXT_REDRAW_QUEUE[i]();
    }
  });
}

export function makeCanvasTex(
  key: string,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  srgb = true,
  isText = false
): THREE.CanvasTexture {
  const cached = TEX_CACHE.get(key);
  if (cached) return cached;

  let actualW = w;
  let actualH = h;
  if (!isText) {
    const maxDim = Math.max(w, h);
    if (maxDim > nonTextTexMaxSize) {
      const ratio = nonTextTexMaxSize / maxDim;
      actualW = Math.max(32, Math.round(w * ratio));
      actualH = Math.max(32, Math.round(h * ratio));
    }
  } else if (actualW < 1024) {
    const mult = Math.ceil(1024 / Math.max(1, actualW));
    actualW = actualW * mult;
    actualH = actualH * mult;
  }

  const cv = document.createElement('canvas');
  cv.width = actualW;
  cv.height = actualH;
  const g = cv.getContext('2d')!;
  const sx = actualW / w;
  const sy = actualH / h;

  const paint = () => {
    g.save();
    g.setTransform(sx, 0, 0, sy, 0, 0);
    g.clearRect(0, 0, w, h);
    draw(g, w, h);
    g.restore();
  };
  paint();

  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = isText ? Math.max(4, maxAnisotropy) : maxAnisotropy;
  t.userData = { isText };
  TEX_CACHE.set(key, t);

  if (isText) {
    ensureFontRedrawHook();
    TEXT_REDRAW_QUEUE.push(() => {
      paint();
      t.needsUpdate = true;
    });
  }
  return t;
}

/** Converts a grayscale height canvas into a tangent-space normal map DataTexture. */
export function heightCanvasToNormalTex(
  key: string,
  w: number,
  h: number,
  drawHeight: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  strength = 2.2
): THREE.DataTexture {
  const cacheKey = `nrm_${key}`;
  const existing = TEX_CACHE.get(cacheKey);
  if (existing) return existing as unknown as THREE.DataTexture;

  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  drawHeight(g, w, h);
  const img = g.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h * 4);
  const scale = strength * (1 / 255);
  const wMask = (w & (w - 1)) === 0 ? w - 1 : -1;
  const hMask = (h & (h - 1)) === 0 ? h - 1 : -1;

  for (let y = 0; y < h; y++) {
    const ym1 = hMask >= 0 ? (y - 1) & hMask : (y - 1 + h) % h;
    const yp1 = hMask >= 0 ? (y + 1) & hMask : (y + 1) % h;
    const rowU = ym1 * w;
    const rowM = y * w;
    const rowD = yp1 * w;

    for (let x = 0; x < w; x++) {
      const xm1 = wMask >= 0 ? (x - 1) & wMask : (x - 1 + w) % w;
      const xp1 = wMask >= 0 ? (x + 1) & wMask : (x + 1) % w;

      const tl = img[(rowU + xm1) << 2];
      const t = img[(rowU + x) << 2];
      const tr = img[(rowU + xp1) << 2];
      const l = img[(rowM + xm1) << 2];
      const r = img[(rowM + xp1) << 2];
      const bl = img[(rowD + xm1) << 2];
      const b = img[(rowD + x) << 2];
      const br = img[(rowD + xp1) << 2];

      const nx = -(tr + 2 * r + br - (tl + 2 * l + bl)) * scale;
      const ny = -(bl + 2 * b + br - (tl + 2 * t + tr)) * scale;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + 1);

      const i = (rowM + x) << 2;
      out[i] = ((nx * invLen * 0.5 + 0.5) * 255 + 0.5) | 0;
      out[i + 1] = ((ny * invLen * 0.5 + 0.5) * 255 + 0.5) | 0;
      out[i + 2] = ((invLen * 0.5 + 0.5) * 255 + 0.5) | 0;
      out[i + 3] = 255;
    }
  }

  const dt = new THREE.DataTexture(out, w, h, THREE.RGBAFormat);
  dt.colorSpace = THREE.NoColorSpace;
  dt.wrapS = dt.wrapT = THREE.RepeatWrapping;
  dt.anisotropy = maxAnisotropy;
  dt.needsUpdate = true;
  TEX_CACHE.set(cacheKey, dt as unknown as THREE.CanvasTexture);
  return dt;
}

export function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

export function circ(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  g.fill();
}

export function buildCoreTextures() {
  const marbleTex = makeCanvasTex('marble', 256, 256, (g, W, H) => {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#f4f0e8');
    bg.addColorStop(0.5, '#efeae0');
    bg.addColorStop(1, '#f5f2eb');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const rng = createSeededRng(1001);
    // Soft cloudy mineral patches
    for (let i = 0; i < 24; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const r = 12 + rng() * 44;
      const rg = g.createRadialGradient(x, y, 1, x, y, r);
      rg.addColorStop(0, 'rgba(205,196,182,0.14)');
      rg.addColorStop(1, 'rgba(205,196,182,0)');
      g.fillStyle = rg;
      circ(g, x, y, r);
    }

    // Primary & secondary Calacatta slate + subtle warm gold mineral veins
    for (let i = 0; i < 28; i++) {
      const isWarm = i % 5 === 0;
      const a = isWarm ? 0.05 + rng() * 0.06 : 0.04 + rng() * 0.09;
      g.strokeStyle = isWarm ? `rgba(164,132,90,${a})` : `rgba(108,114,122,${a})`;
      g.lineWidth = isWarm ? 0.5 + rng() * 1.0 : 0.6 + rng() * 1.6;
      g.beginPath();
      let x = rng() * W;
      let y = -10;
      g.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        const nx = x + (rng() - 0.5) * 56;
        const ny = y + H / 7;
        g.quadraticCurveTo(x + (rng() - 0.5) * 35, y + 13, nx, ny);
        x = nx;
        y = ny;
      }
      g.stroke();
    }

    // Crisp honed architectural slab grout seams
    g.strokeStyle = 'rgba(126,120,112,0.16)';
    g.lineWidth = 1;
    for (let x = 0; x < W; x += W / 2) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y < H; y += H / 2) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
  });
  marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping;
  marbleTex.repeat.set(5, 3);

  const marbleNormal = heightCanvasToNormalTex('marble', 256, 256, (g, W, H) => {
    g.fillStyle = '#888888';
    g.fillRect(0, 0, W, H);
    const rngN = createSeededRng(1002);
    for (let i = 0; i < 500; i++) {
      const v = 128 + ((rngN() * 16) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      circ(g, rngN() * W, rngN() * H, 1 + rngN() * 4);
    }
    g.strokeStyle = '#303030';
    g.lineWidth = 2;
    for (let x = 0; x < W; x += W / 2) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y < H; y += H / 2) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
  }, 2.1);
  marbleNormal.repeat.set(5, 3);

  const marbleRoughness = makeCanvasTex('marble_rough', 256, 256, (g, W, H) => {
    const rngR = createSeededRng(1003);
    g.fillStyle = '#303030';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const v = 34 + ((rngR() * 48) | 0);
      g.fillStyle = `rgba(${v},${v},${v},0.34)`;
      circ(g, rngR() * W, rngR() * H, 8 + rngR() * 26);
    }
    g.strokeStyle = '#d8d8d8';
    g.lineWidth = 2;
    for (let x = 0; x < W; x += W / 2) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y < H; y += H / 2) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
  }, false);
  marbleRoughness.wrapS = marbleRoughness.wrapT = THREE.RepeatWrapping;
  marbleRoughness.repeat.set(5, 3);

  const woodTex = makeCanvasTex('wood', 256, 256, (g, W, H) => {
    const base = g.createLinearGradient(0, 0, W, 0);
    base.addColorStop(0, '#b98652');
    base.addColorStop(0.5, '#cc9961');
    base.addColorStop(1, '#b17e49');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    const rngW = createSeededRng(1004);
    for (let i = 0; i < 280; i++) {
      const x = rngW() * W;
      const w = 0.8 + rngW() * 4.8;
      g.fillStyle = `rgba(${78 + ((rngW() * 52) | 0)},${46 + ((rngW() * 34) | 0)},20,${0.04 + rngW() * 0.1})`;
      g.fillRect(x, 0, w, H);
    }
    for (let i = 0; i < 42; i++) {
      g.strokeStyle = `rgba(92,56,26,${0.07 + rngW() * 0.12})`;
      g.lineWidth = 0.6 + rngW() * 1.4;
      g.beginPath();
      let x = rngW() * W;
      g.moveTo(x, 0);
      for (let y = 0; y < H; y += 36) {
        x += (rngW() - 0.5) * 6;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // Delicate open wood pores
    for (let i = 0; i < 900; i++) {
      g.fillStyle = 'rgba(58,34,14,0.14)';
      g.fillRect(rngW() * W, rngW() * H, 0.8, 3 + rngW() * 9);
    }
  });
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;

  const woodNormal = heightCanvasToNormalTex('wood', 256, 256, (g, W, H) => {
    const rngWN = createSeededRng(1005);
    g.fillStyle = '#808080';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 210; i++) {
      const v = 100 + ((rngWN() * 56) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rngWN() * W, 0, 1 + rngWN() * 2.5, H);
    }
    for (let i = 0; i < 450; i++) {
      g.fillStyle = '#585858';
      g.fillRect(rngWN() * W, rngWN() * H, 1, 4 + rngWN() * 8);
    }
  }, 1.3);
  woodNormal.repeat.set(2, 2);

  // Architectural walnut parquet hardwood planks (albedo + V-groove normal + per-plank roughness)
  const parquetTex = makeCanvasTex('parquet', 256, 256, (g, W, H) => {
    g.fillStyle = '#745236';
    g.fillRect(0, 0, W, H);
    const cols = 4;
    const rows = 8;
    const pw = W / cols;
    const ph = H / rows;
    const rngP = createSeededRng(1006);
    for (let c = 0; c < cols; c++) {
      const stagger = (c % 2) * (ph * 0.5);
      for (let r = -1; r <= rows; r++) {
        const y = r * ph + stagger;
        const x = c * pw;
        const tone = (((c * 37 + r * 91) % 24) - 12);
        g.fillStyle = `rgb(${128 + tone},${90 + Math.round(tone * 0.7)},${58 + Math.round(tone * 0.5)})`;
        g.fillRect(x + 1, y + 1, pw - 2, ph - 2);
        // longitudinal timber fiber
        for (let f = 0; f < 10; f++) {
          const fx = x + 2 + rngP() * (pw - 4);
          g.fillStyle = `rgba(60,36,16,${0.08 + rngP() * 0.14})`;
          g.fillRect(fx, y + 1, 1 + rngP() * 1.5, ph - 2);
        }
        // bevel shadow seam
        g.strokeStyle = 'rgba(32,18,8,0.55)';
        g.lineWidth = 1.5;
        g.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
      }
    }
  });
  parquetTex.wrapS = parquetTex.wrapT = THREE.RepeatWrapping;

  const parquetNormal = heightCanvasToNormalTex('parquet', 256, 256, (g, W, H) => {
    const rngPN = createSeededRng(1007);
    g.fillStyle = '#9a9a9a';
    g.fillRect(0, 0, W, H);
    const cols = 4;
    const rows = 8;
    const pw = W / cols;
    const ph = H / rows;
    for (let c = 0; c < cols; c++) {
      const stagger = (c % 2) * (ph * 0.5);
      for (let r = -1; r <= rows; r++) {
        const y = r * ph + stagger;
        const x = c * pw;
        const pv = 148 + (((c * 19 + r * 43) % 24) - 12);
        g.fillStyle = `rgb(${pv},${pv},${pv})`;
        g.fillRect(x + 1, y + 1, pw - 2, ph - 2);
        for (let f = 0; f < 8; f++) {
          const gv = pv - 16 + ((rngPN() * 24) | 0);
          g.fillStyle = `rgb(${gv},${gv},${gv})`;
          g.fillRect(x + 2 + rngPN() * (pw - 4), y + 1, 1 + rngPN() * 1.5, ph - 2);
        }
        g.strokeStyle = '#242424';
        g.lineWidth = 2;
        g.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
      }
    }
  }, 2.4);

  const parquetRoughness = makeCanvasTex('parquet_rough', 256, 256, (g, W, H) => {
    g.fillStyle = '#767676';
    g.fillRect(0, 0, W, H);
    const cols = 4;
    const rows = 8;
    const pw = W / cols;
    const ph = H / rows;
    for (let c = 0; c < cols; c++) {
      const stagger = (c % 2) * (ph * 0.5);
      for (let r = -1; r <= rows; r++) {
        const y = r * ph + stagger;
        const x = c * pw;
        const rv = 78 + (((c * 29 + r * 53) % 44));
        g.fillStyle = `rgb(${rv},${rv},${rv})`;
        g.fillRect(x + 1, y + 1, pw - 2, ph - 2);
        g.strokeStyle = '#d4d4d4';
        g.lineWidth = 2;
        g.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
      }
    }
  }, false);
  parquetRoughness.wrapS = parquetRoughness.wrapT = THREE.RepeatWrapping;

  const slatTex = makeCanvasTex('slat', 256, 256, (g, W, H) => {
    g.fillStyle = '#4a321b';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 8) {
      const l = g.createLinearGradient(x, 0, x + 8, 0);
      l.addColorStop(0, '#362310');
      l.addColorStop(0.24, '#9a6b39');
      l.addColorStop(0.56, '#bb884c');
      l.addColorStop(1, '#311f0d');
      g.fillStyle = l;
      g.fillRect(x, 0, 6.5, H);
    }
  });
  slatTex.wrapS = slatTex.wrapT = THREE.RepeatWrapping;
  slatTex.repeat.set(4, 1);

  const slatNormal = heightCanvasToNormalTex('slat', 256, 256, (g, W, H) => {
    g.fillStyle = '#202020';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 8) {
      const grd = g.createLinearGradient(x, 0, x + 6.5, 0);
      grd.addColorStop(0, '#404040');
      grd.addColorStop(0.5, '#e8e8e8');
      grd.addColorStop(1, '#404040');
      g.fillStyle = grd;
      g.fillRect(x, 0, 6.5, H);
    }
  }, 3.2);
  slatNormal.repeat.set(4, 1);

  const mossTex = makeCanvasTex('moss', 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    const palette: Array<[number, number, number]> = [
      [46, 120, 58],
      [61, 142, 70],
      [33, 86, 40],
      [76, 166, 87],
      [28, 74, 35],
      [90, 178, 100],
    ];
    let seed = 1723;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const c = palette[(seed >>> 24) % palette.length];
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const idx = ((y + dy) * W + (x + dx)) << 2;
            d[idx] = c[0];
            d[idx + 1] = c[1];
            d[idx + 2] = c[2];
            d[idx + 3] = 255;
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
    const cs = ['#2e783a', '#3d8e46', '#4ca657', '#5ab264'];
    const rngM = createSeededRng(1008);
    g.globalAlpha = 0.55;
    for (let i = 0; i < 160; i++) {
      g.fillStyle = cs[i % cs.length];
      circ(g, rngM() * W, rngM() * H, 2.0 + rngM() * 3.0);
    }
    g.globalAlpha = 1;
  });
  mossTex.wrapS = mossTex.wrapT = THREE.RepeatWrapping;
  mossTex.repeat.set(3, 1.4);

  const mossNormal = heightCanvasToNormalTex('moss', 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 4919;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const v = 90 + ((seed >>> 24) % 140);
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const idx = ((y + dy) * W + (x + dx)) << 2;
            d[idx] = v;
            d[idx + 1] = v;
            d[idx + 2] = v;
            d[idx + 3] = 255;
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
  }, 2.6);
  mossNormal.repeat.set(3, 1.4);

  // Architectural honed dark slate feature stone (for Reception hero wall & Board Room wall)
  const slateTex = makeCanvasTex('slate', 256, 256, (g, W, H) => {
    g.fillStyle = '#1e2228';
    g.fillRect(0, 0, W, H);
    const rows = 8;
    const cols = 4;
    const bh = H / rows;
    const bw = W / cols;
    const rngS = createSeededRng(1009);
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + off;
        const y = r * bh;
        const tone = (((r * 41 + c * 73) % 16) - 8);
        g.fillStyle = `rgb(${36 + tone},${41 + tone},${48 + tone})`;
        g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
        for (let i = 0; i < 18; i++) {
          const v = 24 + ((rngS() * 34) | 0);
          g.fillStyle = `rgba(${v},${v + 2},${v + 5},0.28)`;
          circ(g, x + 2 + rngS() * (bw - 4), y + 2 + rngS() * (bh - 4), 1.5 + rngS() * 4);
        }
        g.strokeStyle = 'rgba(10,12,15,0.85)';
        g.lineWidth = 2;
        g.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
      }
    }
  });
  slateTex.wrapS = slateTex.wrapT = THREE.RepeatWrapping;
  slateTex.repeat.set(3, 1.6);

  const slateNormal = heightCanvasToNormalTex('slate', 256, 256, (g, W, H) => {
    const rngSN = createSeededRng(1010);
    g.fillStyle = '#909090';
    g.fillRect(0, 0, W, H);
    const rows = 8;
    const cols = 4;
    const bh = H / rows;
    const bw = W / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + off;
        const y = r * bh;
        const base = 136 + (((r * 31 + c * 59) % 28) - 14);
        g.fillStyle = `rgb(${base},${base},${base})`;
        g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
        for (let i = 0; i < 16; i++) {
          const v = base - 16 + ((rngSN() * 32) | 0);
          g.fillStyle = `rgb(${v},${v},${v})`;
          circ(g, x + 2 + rngSN() * (bw - 4), y + 2 + rngSN() * (bh - 4), 1.5 + rngSN() * 4);
        }
        g.strokeStyle = '#202020';
        g.lineWidth = 2;
        g.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
      }
    }
  }, 2.8);
  slateNormal.repeat.set(3, 1.6);

  const slateRoughness = makeCanvasTex('slate_rough', 256, 256, (g, W, H) => {
    g.fillStyle = '#7a7a7a';
    g.fillRect(0, 0, W, H);
    const rows = 8;
    const cols = 4;
    const bh = H / rows;
    const bw = W / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + off;
        const y = r * bh;
        const rv = 84 + ((r * 23 + c * 47) % 58);
        g.fillStyle = `rgb(${rv},${rv},${rv})`;
        g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
        g.strokeStyle = '#e5e5e5';
        g.lineWidth = 2;
        g.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
      }
    }
  }, false);
  slateRoughness.wrapS = slateRoughness.wrapT = THREE.RepeatWrapping;
  slateRoughness.repeat.set(3, 1.6);

  // Architectural gypsum / matte plaster wall relief (micro-roller texture + architectural panel shadow-gaps)
  const plasterNormal = heightCanvasToNormalTex('plaster', 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 7713;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const v = 114 + ((seed >>> 24) % 40);
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const idx = ((y + dy) * W + (x + dx)) << 2;
            d[idx] = v;
            d[idx + 1] = v;
            d[idx + 2] = v;
            d[idx + 3] = 255;
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
    // subtle vertical architectural shadow-gap seams every 128px
    g.strokeStyle = '#383838';
    g.lineWidth = 2.5;
    for (let x = 0; x < W; x += 128) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
  }, 1.9);
  plasterNormal.repeat.set(4, 2);

  const plasterRoughness = makeCanvasTex('plaster_rough', 256, 256, (g, W, H) => {
    g.fillStyle = '#d4d4d4';
    g.fillRect(0, 0, W, H);
    const rngPR = createSeededRng(1011);
    for (let i = 0; i < 120; i++) {
      const v = 186 + ((rngPR() * 54) | 0);
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      circ(g, rngPR() * W, rngPR() * H, 6 + rngPR() * 24);
    }
    g.strokeStyle = '#f2f2f2';
    g.lineWidth = 2.5;
    for (let x = 0; x < W; x += 128) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
  }, false);
  plasterRoughness.wrapS = plasterRoughness.wrapT = THREE.RepeatWrapping;
  plasterRoughness.repeat.set(4, 2);

  const concreteTex = makeCanvasTex('concrete', 256, 256, (g, W, H) => {
    const rngC = createSeededRng(1012);
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 2029;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = ((seed >>> 24) & 7) - 3;
      d[i] = 226 + n;
      d[i + 1] = 223 + n;
      d[i + 2] = 215 + n;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 42; i++) {
      const v = 148 + ((rngC() * 62) | 0);
      g.fillStyle = `rgba(${v},${v},${v - 4},0.04)`;
      circ(g, rngC() * W, rngC() * H, 14 + rngC() * 44);
    }
    g.strokeStyle = 'rgba(90,88,82,0.16)';
    g.lineWidth = 1.2;
    for (let y = 0; y < H; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(72,70,64,0.22)';
    for (let x = 32; x < W; x += 64) {
      for (let y = 32; y < H; y += 64) {
        circ(g, x, y, 2.2);
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = rngC() * W;
      const w = 0.6 + rngC() * 2.5;
      const a = 0.03 + rngC() * 0.06;
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, 'rgba(90,92,88,0)');
      grd.addColorStop(0.25, `rgba(90,92,88,${a})`);
      grd.addColorStop(0.85, `rgba(90,92,88,${a * 0.65})`);
      grd.addColorStop(1, 'rgba(90,92,88,0)');
      g.fillStyle = grd;
      g.fillRect(x, rngC() * H * 0.35, w, H * 0.65);
    }
  });
  concreteTex.wrapS = concreteTex.wrapT = THREE.RepeatWrapping;
  concreteTex.repeat.set(4, 2);

  const concreteNormal = heightCanvasToNormalTex('concrete', 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 6553;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const v = 104 + ((seed >>> 24) % 54);
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const idx = ((y + dy) * W + (x + dx)) << 2;
            d[idx] = v;
            d[idx + 1] = v;
            d[idx + 2] = v;
            d[idx + 3] = 255;
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
    // formwork panel joints & tie-cone dimples aligned with concreteTex
    g.strokeStyle = '#484848';
    g.lineWidth = 2;
    for (let y = 0; y < H; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.fillStyle = '#383838';
    for (let x = 32; x < W; x += 64) {
      for (let y = 32; y < H; y += 64) {
        circ(g, x, y, 2.5);
      }
    }
  }, 1.7);
  concreteNormal.repeat.set(4, 2);

  const roughTex = makeCanvasTex('rough', 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 9187;
    for (let y = 0; y < H; y += 4) {
      for (let x = 0; x < W; x += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const v = 152 + ((seed >>> 24) % 92);
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 4; dx++) {
            const idx = ((y + dy) * W + (x + dx)) << 2;
            d[idx] = v;
            d[idx + 1] = v;
            d[idx + 2] = v;
            d[idx + 3] = 255;
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
    const rngRg = createSeededRng(1013);
    for (let i = 0; i < 64; i++) {
      const v = 170 + ((i * 19) % 60);
      g.fillStyle = `rgba(${v},${v},${v},0.14)`;
      circ(g, rngRg() * W, rngRg() * H, 10 + rngRg() * 28);
    }
  }, false);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.set(6, 6);

  const fabricNormal = heightCanvasToNormalTex('fabric', 128, 128, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      const ym = y & 3;
      for (let x = 0; x < W; x++) {
        const xm = x & 3;
        const v = xm === 3 || ym === 3 ? 128 : ((((x >> 2) + (y >> 2)) & 1) === 0 ? 158 : 98);
        const idx = (y * W + x) << 2;
        d[idx] = v;
        d[idx + 1] = v;
        d[idx + 2] = v;
        d[idx + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }, 1.5);
  fabricNormal.repeat.set(8, 8);

  const acousticTex = makeCanvasTex('acoustic_felt', 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 3371;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = 72 + ((seed >>> 24) % 24);
      d[i] = v;
      d[i + 1] = v + 6;
      d[i + 2] = v + 14;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // Subtle architectural acoustic vertical ribbing
    g.fillStyle = 'rgba(20,24,28,0.16)';
    for (let x = 0; x < W; x += 16) {
      g.fillRect(x, 0, 2, H);
    }
  });
  acousticTex.wrapS = acousticTex.wrapT = THREE.RepeatWrapping;
  acousticTex.repeat.set(4, 1);

  const kbTex = makeCanvasTex('keyboard_keys', 256, 96, (g, W, H) => {
    g.fillStyle = '#22262c';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#15181c';
    rr(g, 4, 4, W - 8, H - 8, 6);
    g.fill();
    const rows = 5;
    const cols = 15;
    const kw = (W - 22) / cols;
    const kh = (H - 18) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === 4 && c >= 4 && c <= 9) {
          if (c === 4) {
            g.fillStyle = '#2d333b';
            rr(g, 11 + c * kw, 9 + r * kh, kw * 6 - 3, kh - 3, 2);
            g.fill();
          }
          continue;
        }
        g.fillStyle = r === 0 && c === 0 ? '#d95b43' : '#313740';
        rr(g, 11 + c * kw, 9 + r * kh, kw - 3, kh - 3, 2);
        g.fill();
      }
    }
  });

  const carpetTex = makeCanvasTex('carpet', 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 4219;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = 90 + ((seed >>> 24) % 48);
      d[i] = v;
      d[i + 1] = v - 2;
      d[i + 2] = v - 6;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(42,40,38,0.14)';
    g.lineWidth = 1;
    for (let i = 0; i < W; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
  });
  carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
  carpetTex.repeat.set(3, 3);

  // Commercial carpet tile normal & roughness maps (alternating quarter-turn weave + tile bevels)
  const carpetNormal = heightCanvasToNormalTex('carpet', 256, 256, (g, W, H) => {
    g.fillStyle = '#828282';
    g.fillRect(0, 0, W, H);
    const tile = 64;
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const ox = tx * tile;
        const oy = ty * tile;
        const horiz = (tx + ty) % 2 === 0;
        for (let k = 0; k < tile; k += 4) {
          const v = 122 + ((k % 8 === 0) ? 26 : -22);
          g.fillStyle = `rgb(${v},${v},${v})`;
          if (horiz) g.fillRect(ox + 1, oy + k, tile - 2, 2);
          else g.fillRect(ox + k, oy + 1, 2, tile - 2);
        }
        g.strokeStyle = '#3c3c3c';
        g.lineWidth = 1.5;
        g.strokeRect(ox + 0.5, oy + 0.5, tile - 1, tile - 1);
      }
    }
  }, 1.8);
  carpetNormal.repeat.set(3, 3);

  const carpetRoughness = makeCanvasTex('carpet_rough', 256, 256, (g, W, H) => {
    g.fillStyle = '#d4d4d4';
    g.fillRect(0, 0, W, H);
    const tile = 64;
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const rv = (tx + ty) % 2 === 0 ? 202 : 232;
        g.fillStyle = `rgb(${rv},${rv},${rv})`;
        g.fillRect(tx * tile + 1, ty * tile + 1, tile - 2, tile - 2);
      }
    }
  }, false);
  carpetRoughness.wrapS = carpetRoughness.wrapT = THREE.RepeatWrapping;
  carpetRoughness.repeat.set(3, 3);

  // Acoustic suspended ceiling tile grid (normal + roughness)
  const ceilNormal = heightCanvasToNormalTex('ceil', 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 8291;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = 108 + ((seed >>> 24) % 48);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = '#383838';
    g.lineWidth = 3;
    for (let i = 0; i < W; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
  }, 1.8);
  ceilNormal.repeat.set(8, 3);

  const ceilRoughness = makeCanvasTex('ceil_rough', 256, 256, (g, W, H) => {
    g.fillStyle = '#dfdfdf';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#707070'; // painted aluminum T-bar ceiling grid reflects slightly more than mineral tiles
    g.lineWidth = 3;
    for (let i = 0; i < W; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
  }, false);
  ceilRoughness.wrapS = ceilRoughness.wrapT = THREE.RepeatWrapping;
  ceilRoughness.repeat.set(8, 3);

  const fasciaTex = makeCanvasTex('fascia', 256, 64, (g, W, H) => {
    g.fillStyle = '#ccc5b7';
    g.fillRect(0, 0, W, H);
    const rngF = createSeededRng(1014);
    for (let i = 0; i < 26; i++) {
      const v = 190 + ((rngF() * 30) | 0);
      g.fillStyle = `rgba(${v},${v - 3},${v - 10},0.25)`;
      circ(g, rngF() * W, rngF() * H, 4 + rngF() * 24);
    }
    g.fillStyle = 'rgba(94,92,86,0.5)';
    g.fillRect(0, 0, 2, H);
    g.fillStyle = 'rgba(255,255,255,0.34)';
    g.fillRect(2, 0, 1, H);
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, 'rgba(110,108,102,0.12)');
    grd.addColorStop(1, 'rgba(110,108,102,0)');
    g.fillStyle = grd;
    g.fillRect(3, 0, 10, H);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(0, 0, W, 2);
    g.fillStyle = 'rgba(70,68,62,0.16)';
    g.fillRect(0, H - 4, W, 4);
  });
  fasciaTex.wrapS = fasciaTex.wrapT = THREE.RepeatWrapping;
  fasciaTex.repeat.set(8, 1);

  const pvTex = makeCanvasTex('pv', 256, 128, (g, W, H) => {
    g.fillStyle = '#0b1524';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#16324f';
    g.fillRect(3, 3, W / 2 - 5, H - 6);
    g.fillRect(W / 2 + 2, 3, W / 2 - 5, H - 6);
    g.strokeStyle = 'rgba(150,178,205,0.32)';
    g.lineWidth = 1;
    for (let x = 0; x < W / 2 - 4; x += 15) {
      g.beginPath();
      g.moveTo(3 + x, 3);
      g.lineTo(3 + x, H - 3);
      g.stroke();
    }
    for (let y = 0; y < H; y += 13) {
      g.beginPath();
      g.moveTo(3, y);
      g.lineTo(W / 2 - 2, y);
      g.stroke();
      g.beginPath();
      g.moveTo(W / 2 + 2, y);
      g.lineTo(W - 3, y);
      g.stroke();
    }
    const gl = g.createLinearGradient(0, 0, W, H);
    gl.addColorStop(0, 'rgba(190,220,245,0.22)');
    gl.addColorStop(0.45, 'rgba(190,220,245,0.02)');
    gl.addColorStop(1, 'rgba(190,220,245,0.14)');
    g.fillStyle = gl;
    g.fillRect(0, 0, W, H);
  });
  pvTex.wrapS = pvTex.wrapT = THREE.RepeatWrapping;

  const warnTex = makeCanvasTex('warn', 128, 64, (g, W, H) => {
    g.fillStyle = '#e0b32c';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#1b1c18';
    for (let x = -H; x < W + H; x += 34) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + H, 0);
      g.lineTo(x + H + 16, 0);
      g.lineTo(x + 16, H);
      g.closePath();
      g.fill();
    }
  });
  warnTex.wrapS = warnTex.wrapT = THREE.RepeatWrapping;

  const rackTex = makeCanvasTex('rack', 128, 256, (g, W, H) => {
    g.fillStyle = '#20262e';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#171c22';
    g.fillRect(6, 6, W - 12, H - 12);
    for (let s = 0; s < 8; s++) {
      const y = 12 + s * 30;
      g.fillStyle = '#2b333d';
      g.fillRect(12, y, W - 24, 20);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(12, y + 16, W - 24, 4);
      for (let k = 0; k < 3; k++) {
        g.fillStyle = k === 0 ? '#59f2a0' : k === 1 ? '#4fa8ff' : '#ffb648';
        g.fillRect(16 + k * 8, y + 5, 4, 4);
      }
    }
  });

  const tileTex = makeCanvasTex('raised', 256, 256, (g, W, H) => {
    g.fillStyle = '#5c6166';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const x = i * 64;
        const y = j * 64;
        g.fillStyle = '#6a7076';
        g.fillRect(x + 2, y + 2, 60, 60);
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.fillRect(x + 2, y + 2, 60, 2);
        g.fillRect(x + 2, y + 2, 2, 60);
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(x + 2, y + 58, 60, 2);
        for (let k = 0; k < 9; k++) {
          g.fillStyle = 'rgba(0,0,0,0.30)';
          g.fillRect(x + 12 + (k % 3) * 16, y + 14 + ((k / 3) | 0) * 14, 4, 4);
        }
      }
    }
  });
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  tileTex.repeat.set(6, 3);

  const tileNormal = heightCanvasToNormalTex('raised', 256, 256, (g, W, H) => {
    g.fillStyle = '#909090';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const x = i * 64;
        const y = j * 64;
        g.fillStyle = '#a4a4a4';
        g.fillRect(x + 2, y + 2, 60, 60);
        g.strokeStyle = '#303030';
        g.lineWidth = 3;
        g.strokeRect(x + 1, y + 1, 62, 62);
        for (let k = 0; k < 9; k++) {
          g.fillStyle = '#202020';
          g.fillRect(x + 12 + (k % 3) * 16, y + 14 + ((k / 3) | 0) * 14, 4, 4);
        }
      }
    }
  }, 2.4);
  tileNormal.repeat.set(6, 3);

  const tileRoughness = makeCanvasTex('raised_rough', 256, 256, (g, W, H) => {
    g.fillStyle = '#888888';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const rv = ((i + j) % 2 === 0) ? 105 : 132;
        g.fillStyle = `rgb(${rv},${rv},${rv})`;
        g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
      }
    }
  }, false);
  tileRoughness.wrapS = tileRoughness.wrapT = THREE.RepeatWrapping;
  tileRoughness.repeat.set(6, 3);

  // Exterior interlocking charcoal/slate cobblestone pavers (fast tileable 256x256)
  const paveTex = makeCanvasTex('pave_cobble', 256, 256, (g, W, H) => {
    g.fillStyle = '#33363b';
    g.fillRect(0, 0, W, H);
    const rows = 6;
    const cols = 3;
    const rh = H / rows;
    const cw = W / cols;
    const tones = ['#575c63', '#60666e', '#4f545b', '#676d75', '#545860', '#5d6169'];
    let seed = 11;
    const nextR = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let r = 0; r < rows; r++) {
      const xOff = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const bx = c * cw + xOff;
        const by = r * rh;
        g.fillStyle = tones[Math.floor(nextR() * tones.length)];
        rr(g, bx + 2, by + 2, cw - 4, rh - 4, 3);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(bx + 3, by + 2.5, cw - 6, 2);
        g.fillStyle = 'rgba(12,14,18,0.18)';
        g.fillRect(bx + 3, by + rh - 4.5, cw - 6, 2);
      }
    }
  });
  paveTex.wrapS = paveTex.wrapT = THREE.RepeatWrapping;

  const paveNormal = heightCanvasToNormalTex('pave_cobble', 256, 256, (g, W, H) => {
    g.fillStyle = '#262626';
    g.fillRect(0, 0, W, H);
    const rows = 6;
    const cols = 3;
    const rh = H / rows;
    const cw = W / cols;
    let seed = 23;
    const nextR = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let r = 0; r < rows; r++) {
      const xOff = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const bx = c * cw + xOff;
        const by = r * rh;
        const base = 172 + Math.floor(nextR() * 34);
        g.fillStyle = `rgb(${base},${base},${base})`;
        rr(g, bx + 2, by + 2, cw - 4, rh - 4, 3);
        g.fill();
      }
    }
  }, 2.4);

  const paveRoughness = makeCanvasTex('pave_cobble_rough', 256, 256, (g, W, H) => {
    g.fillStyle = '#ececec';
    g.fillRect(0, 0, W, H);
    const rows = 6;
    const cols = 3;
    const rh = H / rows;
    const cw = W / cols;
    let seed = 41;
    const nextR = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let r = 0; r < rows; r++) {
      const xOff = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const bx = c * cw + xOff;
        const by = r * rh;
        const rv = 152 + Math.floor(nextR() * 44);
        g.fillStyle = `rgb(${rv},${rv},${rv})`;
        rr(g, bx + 2, by + 2, cw - 4, rh - 4, 3);
        g.fill();
      }
    }
  }, false);
  paveRoughness.wrapS = paveRoughness.wrapT = THREE.RepeatWrapping;

  // Warm terracotta / clay herringbone promenade border brick (fast tileable 256x256)
  const brickPaverTex = makeCanvasTex('brick_paver', 256, 256, (g, W, H) => {
    g.fillStyle = '#6c5a4f';
    g.fillRect(0, 0, W, H);
    const rows = 8;
    const cols = 4;
    const rh = H / rows;
    const cw = W / cols;
    const tones = ['#a4634c', '#b37159', '#945640', '#ab6a53', '#8c4f3b', '#ba7961'];
    let seed = 67;
    const nextR = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let r = 0; r < rows; r++) {
      const xOff = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const bx = c * cw + xOff;
        const by = r * rh;
        g.fillStyle = tones[Math.floor(nextR() * tones.length)];
        rr(g, bx + 1.5, by + 1.5, cw - 3, rh - 3, 2);
        g.fill();
      }
    }
  });
  brickPaverTex.wrapS = brickPaverTex.wrapT = THREE.RepeatWrapping;

  const brickPaverNormal = heightCanvasToNormalTex('brick_paver', 256, 256, (g, W, H) => {
    g.fillStyle = '#303030';
    g.fillRect(0, 0, W, H);
    const rows = 8;
    const cols = 4;
    const rh = H / rows;
    const cw = W / cols;
    for (let r = 0; r < rows; r++) {
      const xOff = (r % 2) * (cw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const bx = c * cw + xOff;
        const by = r * rh;
        const v = 178 + (((r * 7 + c * 13) & 3) * 10);
        g.fillStyle = `rgb(${v},${v},${v})`;
        rr(g, bx + 2, by + 2, cw - 4, rh - 4, 2);
        g.fill();
      }
    }
  }, 2.2);

  // Asphalt mineral aggregate via fast direct ImageData synthesis (100x faster than 16,000 fillRect calls)
  const asphaltTex = makeCanvasTex('asphalt_v2', 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 8817;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = 36 + ((seed >>> 24) % 44);
      d[i] = v;
      d[i + 1] = v + 2;
      d[i + 2] = v + 5;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
  asphaltTex.repeat.set(20, 5);

  const asphaltNormal = heightCanvasToNormalTex('asphalt_v2', 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 3191;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = 80 + ((seed >>> 24) % 96);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, 2.1);
  asphaltNormal.repeat.set(20, 5);

  const asphaltRoughness = makeCanvasTex('asphalt_rough_v2', 256, 256, (g, W, H) => {
    const rngAR = createSeededRng(1015);
    g.fillStyle = '#c8c8c8';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 650; i++) {
      const v = 138 + ((rngAR() * 98) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      circ(g, rngAR() * W, rngAR() * H, 2 + rngAR() * 8);
    }
  }, false);
  asphaltRoughness.wrapS = asphaltRoughness.wrapT = THREE.RepeatWrapping;
  asphaltRoughness.repeat.set(20, 5);

  // Natural organic sunlit grass turf (fast crisp 256x256 blades using batched paths)
  const lawnTex = makeCanvasTex('natural_lawn', 256, 256, (g, W, H) => {
    const rngL = createSeededRng(1016);
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 5101;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = (seed >>> 24) & 31;
      d[i] = 62 + n;
      d[i + 1] = 94 + n;
      d[i + 2] = 44 + (n >> 1);
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 18; i++) {
      const x = rngL() * W;
      const y = rngL() * H;
      const rg = g.createRadialGradient(x, y, 2, x, y, 26 + rngL() * 34);
      rg.addColorStop(0, i % 3 === 0 ? 'rgba(116,136,64,0.28)' : 'rgba(54,82,38,0.28)');
      rg.addColorStop(1, 'rgba(72,102,50,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    }
    const bladeCols = ['#3c5928', '#527337', '#6a8742', '#7d924b', '#334c22', '#8fa059'];
    g.globalAlpha = 0.55;
    g.lineWidth = 1.2;
    for (let c = 0; c < bladeCols.length; c++) {
      g.strokeStyle = bladeCols[c];
      g.beginPath();
      for (let i = 0; i < 220; i++) {
        const x = rngL() * W;
        const y = rngL() * H;
        g.moveTo(x, y);
        g.lineTo(x + (rngL() - 0.5) * 3.5, y - (3 + rngL() * 5));
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
  lawnTex.wrapS = lawnTex.wrapT = THREE.RepeatWrapping;

  const grassNormal = heightCanvasToNormalTex('grass_v2', 256, 256, (g, W, H) => {
    const rngGN = createSeededRng(1017);
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 6089;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const v = 74 + ((seed >>> 24) % 108);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.lineWidth = 1.4;
    for (let c = 0; c < 4; c++) {
      const v = 64 + c * 42;
      g.strokeStyle = `rgb(${v},${v},${v})`;
      g.beginPath();
      for (let i = 0; i < 240; i++) {
        const x = rngGN() * W;
        const y = rngGN() * H;
        g.moveTo(x, y);
        g.lineTo(x + (rngGN() - 0.5) * 3, y - (3 + rngGN() * 4));
      }
      g.stroke();
    }
  }, 2.1);
  grassNormal.repeat.set(24, 24);

  // Honed architectural Terrazzo floor (fast 256x256 without save/restore churn)
  const terrazzoTex = makeCanvasTex('terrazzo_floor', 256, 256, (g, W, H) => {
    const rngT = createSeededRng(1018);
    g.fillStyle = '#dad7cf';
    g.fillRect(0, 0, W, H);
    const chips = ['#767a80', '#b5afa2', '#9b8d7a', '#ebe8e0', '#5b6068', '#c6b497'];
    for (let i = 0; i < 640; i++) {
      g.fillStyle = chips[i % chips.length];
      const cx = rngT() * W;
      const cy = rngT() * H;
      g.fillRect(cx, cy, 1.5 + rngT() * 3.2, 1.2 + rngT() * 2.8);
    }
    g.strokeStyle = 'rgba(128,118,100,0.32)';
    g.lineWidth = 1.5;
    for (let i = 0; i < W; i += 128) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
  });
  terrazzoTex.wrapS = terrazzoTex.wrapT = THREE.RepeatWrapping;

  const terrazzoNormal = heightCanvasToNormalTex('terrazzo_floor', 256, 256, (g, W, H) => {
    g.fillStyle = '#929292';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#383838';
    g.lineWidth = 2;
    for (let i = 0; i < W; i += 128) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
  }, 1.5);

  const terrazzoRoughness = makeCanvasTex('terrazzo_rough', 256, 256, (g, W, H) => {
    const rngTR = createSeededRng(1019);
    g.fillStyle = '#5c5c5c';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) {
      const v = 74 + ((rngTR() * 36) | 0);
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      circ(g, rngTR() * W, rngTR() * H, 10 + rngTR() * 26);
    }
    g.strokeStyle = '#c8c8c8';
    g.lineWidth = 2;
    for (let i = 0; i < W; i += 128) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
  }, false);
  terrazzoRoughness.wrapS = terrazzoRoughness.wrapT = THREE.RepeatWrapping;

  // Wide-plank natural honey oak timber floor (Restaurant / Tourism)
  const oakFloorTex = makeCanvasTex('oak_floor', 512, 512, (g, W, H) => {
    g.fillStyle = '#8b623f';
    g.fillRect(0, 0, W, H);
    const planks = 8;
    const ph = H / planks;
    const tones = ['#9c7049', '#8f6540', '#a97c52', '#865d3a', '#a1754c'];
    let seed = 93;
    const nextR = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let r = 0; r < planks; r++) {
      const y = r * ph;
      const joint = 90 + nextR() * (W - 180);
      const segments = [
        [0, joint],
        [joint, W],
      ];
      for (const [x0, x1] of segments) {
        g.fillStyle = tones[Math.floor(nextR() * tones.length)];
        g.fillRect(x0, y + 1, x1 - x0, ph - 2);
        // Fine grain streaks
        for (let k = 0; k < 28; k++) {
          const gy = y + 3 + nextR() * (ph - 6);
          g.fillStyle = nextR() < 0.5 ? 'rgba(62,38,18,0.12)' : 'rgba(220,185,138,0.08)';
          g.fillRect(x0 + 2, gy, x1 - x0 - 4, 1 + nextR() * 1.4);
        }
      }
      g.fillStyle = 'rgba(42,26,12,0.52)';
      g.fillRect(0, y, W, 2);
      g.fillRect(joint - 1, y, 2, ph);
    }
  });
  oakFloorTex.wrapS = oakFloorTex.wrapT = THREE.RepeatWrapping;

  const oakFloorNormal = heightCanvasToNormalTex('oak_floor', 512, 512, (g, W, H) => {
    g.fillStyle = '#929292';
    g.fillRect(0, 0, W, H);
    const planks = 8;
    const ph = H / planks;
    let seed = 109;
    const nextR = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let r = 0; r < planks; r++) {
      const y = r * ph;
      const joint = 90 + nextR() * (W - 180);
      for (let k = 0; k < 40; k++) {
        const v = 128 + Math.floor((nextR() - 0.5) * 40);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(0, y + nextR() * ph, W, 1.5);
      }
      g.fillStyle = '#323232';
      g.fillRect(0, y, W, 2.5);
      g.fillRect(joint - 1.5, y, 3, ph);
    }
  }, 1.8);

  // Dark basalt/slate tile floor (Crypto / Logistics)
  const slateFloorTex = makeCanvasTex('slate_floor', 512, 512, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    const grid = 4;
    const ts = W / grid;
    let seed = 3917;
    for (let y = 0; y < H; y++) {
      const r = (y / ts) | 0;
      for (let x = 0; x < W; x++) {
        const c = (x / ts) | 0;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const base = 36 + (((r * 11 + c * 17) % 5) * 3) + ((seed >>> 24) & 7);
        const idx = (y * W + x) << 2;
        d[idx] = base;
        d[idx + 1] = base + 6;
        d[idx + 2] = base + 14;
        d[idx + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(15,18,24,0.65)';
    g.lineWidth = 2;
    for (let i = 0; i <= W; i += ts) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
  });
  slateFloorTex.wrapS = slateFloorTex.wrapT = THREE.RepeatWrapping;

  const slateFloorNormal = heightCanvasToNormalTex('slate_floor', 512, 512, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    let seed = 8821;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const v = 124 + ((seed >>> 24) % 30);
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const idx = ((y + dy) * W + (x + dx)) << 2;
            d[idx] = v;
            d[idx + 1] = v;
            d[idx + 2] = v;
            d[idx + 3] = 255;
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = '#323232';
    g.lineWidth = 3;
    for (let i = 0; i <= W; i += W / 4) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
  }, 1.9);

  const facadeNormal = heightCanvasToNormalTex('facade_nb', 256, 256, (g, W, H) => {
    g.fillStyle = '#a0a0a0';
    g.fillRect(0, 0, W, H);
    for (let cx = 0; cx < 2; cx++) {
      for (let cy = 0; cy < 2; cy++) {
        const x = cx * 128 + 22;
        const y = cy * 128 + 18;
        g.fillStyle = '#404040';
        g.fillRect(x, y, 84, 92);
        g.fillStyle = '#d4d4d4';
        g.fillRect(x - 9, y + 96, 102, 7);
      }
    }
  }, 2.4);

  const barkTex = makeCanvasTex('bark', 128, 256, (g, W, H) => {
    const rngB = createSeededRng(1020);
    g.fillStyle = '#4e3c2d';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 180; i++) {
      const v = 46 + ((rngB() * 52) | 0);
      g.fillStyle = `rgb(${v + 12},${v},${v - 12})`;
      g.fillRect(rngB() * W, rngB() * H, 2 + rngB() * 4, 14 + rngB() * 38);
    }
  });
  barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping;
  barkTex.repeat.set(2, 3);

  const barkNormal = heightCanvasToNormalTex('bark', 128, 256, (g, W, H) => {
    const rngBN = createSeededRng(1021);
    g.fillStyle = '#808080';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 200; i++) {
      const v = 50 + ((rngBN() * 160) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rngBN() * W, rngBN() * H, 2 + rngBN() * 4, 14 + rngBN() * 40);
    }
  }, 2.4);
  barkNormal.repeat.set(2, 3);

  const glowTex = makeCanvasTex('glow', 128, 128, (g, W, H) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    r.addColorStop(0.55, 'rgba(255,255,255,0.14)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, W, H);
  });

  const shadowTex = makeCanvasTex('cshadow', 128, 128, (g, W, H) => {
    const r = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    r.addColorStop(0, 'rgba(0,0,0,0.60)');
    r.addColorStop(0.45, 'rgba(0,0,0,0.26)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, W, H);
  });

  const shelfTex = makeCanvasTex('shelf', 256, 384, (g, W, H) => {
    const rngSh = createSeededRng(1022);
    g.fillStyle = '#5a3d22';
    g.fillRect(0, 0, W, H);
    for (let s = 0; s < 5; s++) {
      const y = 18 + s * 73;
      g.fillStyle = '#7d5530';
      g.fillRect(6, y + 56, W - 12, 9);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(6, y + 65, W - 12, 8);
      let x = 12;
      const cs = ['#b94a48', '#487fb8', '#c9a63b', '#4fa05a', '#dfd9ce', '#8f5cb0', '#c87734'];
      while (x < W - 16) {
        const bw = 6 + rngSh() * 14;
        const bh = 34 + rngSh() * 20;
        g.fillStyle = cs[(rngSh() * cs.length) | 0];
        g.fillRect(x, y + 56 - bh, bw, bh);
        g.fillStyle = 'rgba(255,255,255,0.2)';
        g.fillRect(x, y + 56 - bh, 2, bh);
        x += bw + 2;
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, 6, H);
    g.fillRect(W - 6, 0, 6, H);
  });

  const gymRubberTex = makeCanvasTex('gym_rubber', 256, 256, (g, W, H) => {
    const img = g.createImageData(W, H);
    const d = img.data;
    const specks: Array<[number, number, number]> = [
      [58, 67, 82],
      [82, 96, 114],
      [79, 227, 138],
      [59, 130, 246],
      [148, 163, 184],
    ];
    let seed = 4457;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const roll = (seed >>> 24) & 31;
      if (roll < 5) {
        const sp = specks[roll];
        d[i] = (30 + sp[0]) >> 1;
        d[i + 1] = (34 + sp[1]) >> 1;
        d[i + 2] = (40 + sp[2]) >> 1;
      } else {
        d[i] = 30;
        d[i + 1] = 34;
        d[i + 2] = 40;
      }
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(10,12,16,0.55)';
    g.lineWidth = 2;
    for (let x = 0; x <= W; x += 128) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y <= H; y += 128) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
  });
  gymRubberTex.wrapS = gymRubberTex.wrapT = THREE.RepeatWrapping;
  gymRubberTex.repeat.set(4, 4);

  const restroomTileTex = makeCanvasTex('restroom_tile', 256, 256, (g, W, H) => {
    const rngRT = createSeededRng(1023);
    g.fillStyle = '#dce2e6';
    g.fillRect(0, 0, W, H);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const shade = 218 + ((r + c) % 2) * 8 + ((rngRT() * 8) | 0);
        g.fillStyle = `rgb(${shade},${shade + 4},${shade + 8})`;
        g.fillRect(c * 64 + 2, r * 64 + 2, 60, 60);
      }
    }
    g.strokeStyle = '#9aa4ad';
    g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
  });
  restroomTileTex.wrapS = restroomTileTex.wrapT = THREE.RepeatWrapping;
  restroomTileTex.repeat.set(3, 4);

  const restroomTileNormal = heightCanvasToNormalTex('restroom_tile', 256, 256, (g, W, H) => {
    g.fillStyle = '#c8c8c8';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#505050';
    g.lineWidth = 4;
    for (let i = 0; i <= 256; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
  }, 1.8);
  restroomTileNormal.repeat.set(3, 4);

  const hrBoardTex = makeCanvasTex('hr_board', 512, 256, (g, W, H) => {
    g.fillStyle = '#132226';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#2e7d6b';
    g.fillRect(0, 0, W, 38);
    g.fillStyle = '#ffffff';
    g.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
    g.fillText('PEOPLE & CULTURE · NAIROBI HQ ORG CHART', 18, 25);
    const boxes = [
      { x: 196, y: 54, w: 120, t: 'Executive Team', c: '#0f766e' },
      { x: 36, y: 124, w: 132, t: 'Engineering (22)', c: '#1d4ed8' },
      { x: 190, y: 124, w: 132, t: 'Growth & Ads (16)', c: '#b45309' },
      { x: 344, y: 124, w: 132, t: 'People & Ops (12)', c: '#047857' },
      { x: 36, y: 190, w: 206, t: 'Q2 Hiring Pipeline: 6 Open Roles', c: '#334155' },
      { x: 266, y: 190, w: 210, t: 'Wellness & Onboarding: 98% eNPS', c: '#334155' },
    ];
    g.strokeStyle = 'rgba(148,163,184,0.45)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(256, 92);
    g.lineTo(256, 108);
    g.moveTo(102, 108);
    g.lineTo(410, 108);
    g.moveTo(102, 108);
    g.lineTo(102, 124);
    g.moveTo(256, 108);
    g.lineTo(256, 124);
    g.moveTo(410, 108);
    g.lineTo(410, 124);
    g.stroke();
    for (const b of boxes) {
      g.fillStyle = b.c;
      rr(g, b.x, b.y, b.w, 38, 6);
      g.fill();
      g.fillStyle = '#f8fafc';
      g.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
      g.fillText(b.t, b.x + 10, b.y + 23);
    }
  }, true, true);

  return {
    marbleTex,
    marbleNormal,
    marbleRoughness,
    woodTex,
    woodNormal,
    parquetTex,
    parquetNormal,
    parquetRoughness,
    slatTex,
    slatNormal,
    mossTex,
    mossNormal,
    slateTex,
    slateNormal,
    slateRoughness,
    plasterNormal,
    plasterRoughness,
    concreteTex,
    concreteNormal,
    roughTex,
    fabricNormal,
    acousticTex,
    kbTex,
    carpetTex,
    carpetNormal,
    carpetRoughness,
    ceilNormal,
    ceilRoughness,
    fasciaTex,
    pvTex,
    warnTex,
    rackTex,
    tileTex,
    tileNormal,
    tileRoughness,
    paveTex,
    paveNormal,
    paveRoughness,
    brickPaverTex,
    brickPaverNormal,
    asphaltTex,
    asphaltNormal,
    asphaltRoughness,
    lawnTex,
    grassNormal,
    terrazzoTex,
    terrazzoNormal,
    terrazzoRoughness,
    oakFloorTex,
    oakFloorNormal,
    slateFloorTex,
    slateFloorNormal,
    facadeNormal,
    barkTex,
    barkNormal,
    glowTex,
    shadowTex,
    shelfTex,
    gymRubberTex,
    restroomTileTex,
    restroomTileNormal,
    hrBoardTex,
  };
}

export function svcSignTex(key: string, title: string, sub: string, accent?: string): THREE.CanvasTexture {
  return makeCanvasTex(key, 1536, 336, (g, W, H) => {
    const lW = W / 2;
    const lH = H / 2;
    g.save();
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.fillStyle = 'rgba(7,11,18,0.97)';
    g.fillRect(0, 0, lW, lH);
    g.fillStyle = accent || '#6fe3a1';
    g.fillRect(0, 0, 12, lH);
    g.fillStyle = '#ffffff';
    g.textBaseline = 'middle';
    g.font = '700 54px "Plus Jakarta Sans",system-ui,sans-serif';
    g.fillText(title, 44, 60);
    g.fillStyle = '#cbd5e1';
    g.font = '500 32px "Plus Jakarta Sans",system-ui,sans-serif';
    g.fillText(sub || '', 44, 118);
    g.restore();
  }, true, true);
}

export function plateTex(name: string): THREE.CanvasTexture {
  return makeCanvasTex(`plate-${name}`, 1280, 192, (g, W) => {
    const lW = W / 2;
    g.save();
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, lW, 96);
    g.fillStyle = 'rgba(7,11,18,0.96)';
    rr(g, 2, 8, lW - 4, 80, 38);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.44)';
    g.lineWidth = 2.5;
    rr(g, 2, 8, lW - 4, 80, 38);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.font = '700 42px "Plus Jakarta Sans",system-ui,sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, lW / 2, 49, lW - 48);
    g.restore();
  }, true, true);
}

export const leafShapeDraw: Record<string, (g: CanvasRenderingContext2D, W: number, H: number) => void> = {
  broad: (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const cx = W / 2;
    g.beginPath();
    g.moveTo(cx, H * 0.02);
    g.bezierCurveTo(W * 0.96, H * 0.3, W * 0.88, H * 0.78, cx, H * 0.99);
    g.bezierCurveTo(W * 0.12, H * 0.78, W * 0.04, H * 0.3, cx, H * 0.02);
    g.closePath();
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#53943e');
    grd.addColorStop(0.5, '#3b7731');
    grd.addColorStop(1, '#2a5a24');
    g.fillStyle = grd;
    g.fill();
    g.strokeStyle = 'rgba(226,240,205,0.55)';
    g.lineWidth = W * 0.035;
    g.beginPath();
    g.moveTo(cx, H * 0.04);
    g.lineTo(cx, H * 0.96);
    g.stroke();
    g.strokeStyle = 'rgba(226,240,205,0.26)';
    g.lineWidth = W * 0.018;
    for (let i = 1; i < 8; i++) {
      const y = H * (0.06 + i * 0.115);
      const sp = H * 0.86 * (0.055 * Math.sin(i * 0.9) + 0.075);
      g.beginPath();
      g.moveTo(cx, y);
      g.quadraticCurveTo(cx + sp * 0.5, y - H * 0.03, cx + sp, y - H * 0.07);
      g.stroke();
      g.beginPath();
      g.moveTo(cx, y);
      g.quadraticCurveTo(cx - sp * 0.5, y - H * 0.03, cx - sp, y - H * 0.07);
      g.stroke();
    }
  },
  strap: (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const cx = W / 2;
    g.beginPath();
    g.moveTo(cx * 0.35, H * 0.02);
    g.bezierCurveTo(W * 1.05, H * 0.28, W * 0.86, H * 0.8, cx * 0.62, H * 0.99);
    g.bezierCurveTo(W * 0.14, H * 0.8, W * 0.02, H * 0.28, cx * 0.35, H * 0.02);
    g.closePath();
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#3f7a34');
    grd.addColorStop(0.45, '#2f6b2c');
    grd.addColorStop(1, '#23531f');
    g.fillStyle = grd;
    g.fill();
    g.strokeStyle = 'rgba(224,214,120,0.62)';
    g.lineWidth = W * 0.055;
    g.beginPath();
    g.moveTo(cx * 0.35, H * 0.03);
    g.bezierCurveTo(W * 0.05, H * 0.3, W * 0.15, H * 0.78, cx * 0.62, H * 0.98);
    g.stroke();
    g.beginPath();
    g.moveTo(cx * 0.35, H * 0.03);
    g.bezierCurveTo(W * 1.0, H * 0.3, W * 0.84, H * 0.78, cx * 0.62, H * 0.98);
    g.stroke();
  },
  split: (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const cx = W / 2;
    g.beginPath();
    g.moveTo(cx, H * 0.03);
    g.bezierCurveTo(W * 0.98, H * 0.28, W * 0.9, H * 0.76, cx, H * 0.98);
    g.bezierCurveTo(W * 0.1, H * 0.76, W * 0.02, H * 0.28, cx, H * 0.03);
    g.closePath();
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#357a33');
    grd.addColorStop(0.55, '#27652a');
    grd.addColorStop(1, '#1d4f21');
    g.fillStyle = grd;
    g.fill();
    const rngLeaf = createSeededRng(1024);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 4; i++) {
      const y = H * (0.22 + i * 0.17);
      const w = W * 0.16 + rngLeaf() * W * 0.08;
      g.beginPath();
      g.moveTo(cx, y);
      g.lineTo(cx + w, y - H * 0.06);
      g.lineTo(cx + w * 0.9, y + H * 0.05);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(cx, y);
      g.lineTo(cx - w, y - H * 0.06);
      g.lineTo(cx - w * 0.9, y + H * 0.05);
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(214,232,190,0.42)';
    g.lineWidth = W * 0.03;
    g.beginPath();
    g.moveTo(cx, H * 0.05);
    g.lineTo(cx, H * 0.95);
    g.stroke();
  },
  blade: (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const cx = W / 2;
    g.beginPath();
    g.moveTo(cx * 0.62, H * 0.98);
    g.bezierCurveTo(cx * 0.86, H * 0.6, cx * 0.72, H * 0.22, cx * 0.4, H * 0.02);
    g.lineTo(cx * 0.58, H * 0.02);
    g.bezierCurveTo(cx * 0.86, H * 0.26, cx * 0.98, H * 0.62, cx * 0.74, H * 0.98);
    g.closePath();
    const grd = g.createLinearGradient(W * 0.3, 0, W * 0.7, H);
    grd.addColorStop(0, '#5da343');
    grd.addColorStop(1, '#2e6b2c');
    g.fillStyle = grd;
    g.fill();
  },
  frond: (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const cx = W / 2;
    g.strokeStyle = '#538236';
    g.lineWidth = W * 0.032;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx, H * 0.99);
    g.quadraticCurveTo(cx * 0.98, H * 0.5, cx, H * 0.02);
    g.stroke();
    for (let i = 1; i < 34; i++) {
      const t = i / 34;
      const y = H * (0.98 - t * 0.94);
      const archEnv = Math.sin(Math.PI * Math.min(0.96, t * 0.92 + 0.05));
      const len = W * (0.44 * archEnv + 0.04);
      for (const sd of [-1, 1]) {
        g.save();
        g.translate(cx, y);
        g.rotate(sd * (0.58 - t * 0.25));
        const lg = g.createLinearGradient(0, 0, sd * len, 0);
        lg.addColorStop(0, i % 2 ? '#346929' : '#3d7930');
        lg.addColorStop(0.65, '#4c8e39');
        lg.addColorStop(1, '#68aa49');
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(0, -W * 0.012);
        g.quadraticCurveTo(sd * len * 0.52, -W * 0.02, sd * len, 0);
        g.quadraticCurveTo(sd * len * 0.52, W * 0.014, 0, W * 0.012);
        g.closePath();
        g.fill();
        g.restore();
      }
    }
  },
  // Airy organic tree foliage spray with gaps so sunlight filters through (Reference Image 2 & 3)
  treeCanopy: (g, W, H) => {
    g.clearRect(0, 0, W, H);
    let seed = 313;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    // Subtle dark woody twigs in cluster center
    g.strokeStyle = 'rgba(72,56,38,0.65)';
    g.lineWidth = W * 0.014;
    for (let b = 0; b < 7; b++) {
      const ang = rnd() * Math.PI * 2;
      const r = W * (0.18 + rnd() * 0.22);
      g.beginPath();
      g.moveTo(W * 0.5, H * 0.52);
      g.lineTo(W * 0.5 + Math.cos(ang) * r, H * 0.52 + Math.sin(ang) * r);
      g.stroke();
    }
    const cols = ['#2c5924', '#386e2e', '#468236', '#56953e', '#6ea649', '#83b554'];
    for (let i = 0; i < 165; i++) {
      const ang = rnd() * Math.PI * 2;
      const rad = Math.pow(rnd(), 0.62) * (W * 0.44);
      const lx = W * 0.5 + Math.cos(ang) * rad;
      const ly = H * 0.5 + Math.sin(ang) * rad;
      const lSize = W * (0.045 + rnd() * 0.05);
      const rot = ang + (rnd() - 0.5) * 1.4;
      g.save();
      g.translate(lx, ly);
      g.rotate(rot);
      const shadeIdx = Math.min(cols.length - 1, Math.floor((1 - ly / H) * 3.5 + rnd() * 2.5));
      g.fillStyle = cols[shadeIdx];
      g.beginPath();
      g.moveTo(-lSize * 0.55, 0);
      g.quadraticCurveTo(0, -lSize * 0.38, lSize * 0.6, 0);
      g.quadraticCurveTo(0, lSize * 0.38, -lSize * 0.55, 0);
      g.fill();
      g.restore();
    }
  },
  // Dense organic hedge / bush spray (Reference Image 2 & 4)
  shrubCluster: (g, W, H) => {
    g.clearRect(0, 0, W, H);
    let seed = 419;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const cols = ['#23491c', '#2e5d25', '#3b732d', '#4d8a36', '#67a041', '#7cb34c'];
    for (let i = 0; i < 230; i++) {
      const ang = rnd() * Math.PI * 2;
      const rad = Math.pow(rnd(), 0.55) * (W * 0.46);
      const lx = W * 0.5 + Math.cos(ang) * rad;
      const ly = H * 0.52 + Math.sin(ang) * rad * 0.88;
      const lSize = W * (0.045 + rnd() * 0.055);
      g.save();
      g.translate(lx, ly);
      g.rotate(rnd() * Math.PI * 2);
      const cIdx = Math.min(cols.length - 1, Math.floor((1 - ly / H) * 3.2 + rnd() * 2.8));
      g.fillStyle = cols[cIdx];
      g.beginPath();
      g.ellipse(0, 0, lSize * 0.55, lSize * 0.32, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  },
  // Variegated green + delicate white flower blossom cluster (Reference Image 4 foreground shrub)
  blossomCluster: (g, W, H) => {
    g.clearRect(0, 0, W, H);
    let seed = 521;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const cols = ['#2e5b24', '#40742f', '#578d39', '#75a646', '#91b85c'];
    for (let i = 0; i < 170; i++) {
      const ang = rnd() * Math.PI * 2;
      const rad = Math.pow(rnd(), 0.58) * (W * 0.45);
      const lx = W * 0.5 + Math.cos(ang) * rad;
      const ly = H * 0.52 + Math.sin(ang) * rad * 0.9;
      const lSize = W * (0.05 + rnd() * 0.05);
      g.save();
      g.translate(lx, ly);
      g.rotate(rnd() * Math.PI * 2);
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      g.beginPath();
      g.ellipse(0, 0, lSize * 0.58, lSize * 0.34, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // Fine white blossom clusters along upper & outer sprigs
    for (let i = 0; i < 42; i++) {
      const ang = rnd() * Math.PI * 2;
      const rad = W * (0.1 + rnd() * 0.35);
      const bx = W * 0.5 + Math.cos(ang) * rad;
      const by = H * 0.44 + Math.sin(ang) * rad * 0.78;
      const br = W * (0.015 + rnd() * 0.014);
      g.fillStyle = rnd() < 0.3 ? '#fff7e6' : '#f8fafc';
      circ(g, bx, by, br);
      circ(g, bx + br * 0.8, by + br * 0.4, br * 0.72);
      circ(g, bx - br * 0.7, by + br * 0.5, br * 0.68);
    }
  },
  // Cascading creeping-fig & pergola vine curtain spray (Reference Images 3 & 4)
  vineCluster: (g, W, H) => {
    g.clearRect(0, 0, W, H);
    let seed = 643;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const cols = ['#1f461a', '#2c5b22', '#3a712b', '#4d8835', '#649e41'];
    // Vertical trailing stems
    g.strokeStyle = 'rgba(66,78,36,0.72)';
    g.lineWidth = W * 0.014;
    for (let s = 0; s < 9; s++) {
      const sx = W * (0.12 + (s / 8) * 0.76);
      const botY = H * (0.62 + rnd() * 0.34);
      g.beginPath();
      g.moveTo(sx, H * 0.04);
      g.quadraticCurveTo(sx + (rnd() - 0.5) * W * 0.12, botY * 0.5, sx + (rnd() - 0.5) * W * 0.08, botY);
      g.stroke();
      const count = 14 + Math.floor(rnd() * 8);
      for (let k = 0; k < count; k++) {
        const t = k / count;
        const lx = sx + (rnd() - 0.5) * W * 0.1;
        const ly = H * 0.05 + t * (botY - H * 0.05);
        const sz = W * (0.042 + rnd() * 0.036);
        g.save();
        g.translate(lx, ly);
        g.rotate((rnd() - 0.5) * 1.4);
        g.fillStyle = cols[Math.floor(rnd() * cols.length)];
        g.beginPath();
        g.ellipse(0, 0, sz * 0.5, sz * 0.36, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  },
};

export function leafTex(kind: string): THREE.CanvasTexture {
  const sz = 256;
  return makeCanvasTex(`leaf_v2_${kind}`, sz, sz, (g, W, H) => {
    (leafShapeDraw[kind] || leafShapeDraw.broad)(g, W, H);
  });
}
