import * as THREE from 'three';

let maxAnisotropy = 4;
export function setMaxAnisotropy(a: number) {
  maxAnisotropy = Math.max(1, a);
}
export function getMaxAnisotropy(): number {
  return maxAnisotropy;
}

const TEX_CACHE = new Map<string, THREE.CanvasTexture>();

export function makeCanvasTex(
  key: string,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  srgb = true
): THREE.CanvasTexture {
  const cached = TEX_CACHE.get(key);
  if (cached) return cached;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAnisotropy;
  TEX_CACHE.set(key, t);
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

  const sample = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return img[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = tr + 2 * r + br - (tl + 2 * l + bl);
      const dy = bl + 2 * b + br - (tl + 2 * t + tr);
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const i = (y * w + x) * 4;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
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
  const marbleTex = makeCanvasTex('marble', 512, 512, (g, W, H) => {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#f4f0e8');
    bg.addColorStop(0.5, '#efeae0');
    bg.addColorStop(1, '#f5f2eb');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Soft cloudy mineral patches
    for (let i = 0; i < 42; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = 24 + Math.random() * 86;
      const rg = g.createRadialGradient(x, y, 2, x, y, r);
      rg.addColorStop(0, 'rgba(205,196,182,0.14)');
      rg.addColorStop(1, 'rgba(205,196,182,0)');
      g.fillStyle = rg;
      circ(g, x, y, r);
    }

    // Primary & secondary Calacatta slate + subtle warm gold mineral veins
    for (let i = 0; i < 46; i++) {
      const isWarm = i % 5 === 0;
      const a = isWarm ? 0.05 + Math.random() * 0.06 : 0.04 + Math.random() * 0.09;
      g.strokeStyle = isWarm ? `rgba(164,132,90,${a})` : `rgba(108,114,122,${a})`;
      g.lineWidth = isWarm ? 0.6 + Math.random() * 1.4 : 0.7 + Math.random() * 2.6;
      g.beginPath();
      let x = Math.random() * W;
      let y = -20;
      g.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        const nx = x + (Math.random() - 0.5) * 110;
        const ny = y + H / 7;
        g.quadraticCurveTo(x + (Math.random() - 0.5) * 70, y + 26, nx, ny);
        x = nx;
        y = ny;
      }
      g.stroke();
    }

    // Crisp honed architectural slab grout seams
    g.strokeStyle = 'rgba(126,120,112,0.16)';
    g.lineWidth = 1.5;
    for (let x = 0; x < W; x += 256) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y < H; y += 256) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
  });
  marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping;
  marbleTex.repeat.set(5, 3);

  const marbleNormal = heightCanvasToNormalTex('marble', 512, 512, (g, W, H) => {
    g.fillStyle = '#888888';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1200; i++) {
      const v = 128 + ((Math.random() * 16) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      circ(g, Math.random() * W, Math.random() * H, 2 + Math.random() * 7);
    }
    g.strokeStyle = '#303030';
    g.lineWidth = 4;
    for (let x = 0; x < W; x += 256) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y < H; y += 256) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
  }, 2.1);
  marbleNormal.repeat.set(5, 3);

  const marbleRoughness = makeCanvasTex('marble_rough', 512, 512, (g, W, H) => {
    g.fillStyle = '#303030';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 72; i++) {
      const v = 34 + ((Math.random() * 48) | 0);
      g.fillStyle = `rgba(${v},${v},${v},0.34)`;
      circ(g, Math.random() * W, Math.random() * H, 14 + Math.random() * 52);
    }
    g.strokeStyle = '#d8d8d8';
    g.lineWidth = 4;
    for (let x = 0; x < W; x += 256) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y < H; y += 256) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
  }, false);
  marbleRoughness.wrapS = marbleRoughness.wrapT = THREE.RepeatWrapping;
  marbleRoughness.repeat.set(5, 3);

  const woodTex = makeCanvasTex('wood', 512, 512, (g, W, H) => {
    const base = g.createLinearGradient(0, 0, W, 0);
    base.addColorStop(0, '#b98652');
    base.addColorStop(0.5, '#cc9961');
    base.addColorStop(1, '#b17e49');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 280; i++) {
      const x = Math.random() * W;
      const w = 0.8 + Math.random() * 4.8;
      g.fillStyle = `rgba(${78 + ((Math.random() * 52) | 0)},${46 + ((Math.random() * 34) | 0)},20,${0.04 + Math.random() * 0.1})`;
      g.fillRect(x, 0, w, H);
    }
    for (let i = 0; i < 42; i++) {
      g.strokeStyle = `rgba(92,56,26,${0.07 + Math.random() * 0.12})`;
      g.lineWidth = 0.6 + Math.random() * 1.4;
      g.beginPath();
      let x = Math.random() * W;
      g.moveTo(x, 0);
      for (let y = 0; y < H; y += 36) {
        x += (Math.random() - 0.5) * 6;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // Delicate open wood pores
    for (let i = 0; i < 900; i++) {
      g.fillStyle = 'rgba(58,34,14,0.14)';
      g.fillRect(Math.random() * W, Math.random() * H, 0.8, 3 + Math.random() * 9);
    }
  });
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;

  const woodNormal = heightCanvasToNormalTex('wood', 256, 256, (g, W, H) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 210; i++) {
      const v = 100 + ((Math.random() * 56) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * W, 0, 1 + Math.random() * 2.5, H);
    }
    for (let i = 0; i < 450; i++) {
      g.fillStyle = '#585858';
      g.fillRect(Math.random() * W, Math.random() * H, 1, 4 + Math.random() * 8);
    }
  }, 1.3);
  woodNormal.repeat.set(2, 2);

  // Architectural walnut parquet hardwood planks (albedo + V-groove normal + per-plank roughness)
  const parquetTex = makeCanvasTex('parquet', 512, 512, (g, W, H) => {
    g.fillStyle = '#745236';
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
        const tone = (((c * 37 + r * 91) % 24) - 12);
        g.fillStyle = `rgb(${128 + tone},${90 + Math.round(tone * 0.7)},${58 + Math.round(tone * 0.5)})`;
        g.fillRect(x + 1, y + 1, pw - 2, ph - 2);
        // longitudinal timber fiber
        for (let f = 0; f < 16; f++) {
          const fx = x + 3 + Math.random() * (pw - 6);
          g.fillStyle = `rgba(60,36,16,${0.08 + Math.random() * 0.14})`;
          g.fillRect(fx, y + 2, 1 + Math.random() * 2.5, ph - 4);
        }
        // bevel shadow seam
        g.strokeStyle = 'rgba(32,18,8,0.55)';
        g.lineWidth = 2;
        g.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
      }
    }
  });
  parquetTex.wrapS = parquetTex.wrapT = THREE.RepeatWrapping;

  const parquetNormal = heightCanvasToNormalTex('parquet', 512, 512, (g, W, H) => {
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
        g.fillRect(x + 2, y + 2, pw - 4, ph - 4);
        for (let f = 0; f < 14; f++) {
          const gv = pv - 16 + ((Math.random() * 24) | 0);
          g.fillStyle = `rgb(${gv},${gv},${gv})`;
          g.fillRect(x + 3 + Math.random() * (pw - 6), y + 2, 1 + Math.random() * 2, ph - 4);
        }
        g.strokeStyle = '#242424';
        g.lineWidth = 3;
        g.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
      }
    }
  }, 2.4);

  const parquetRoughness = makeCanvasTex('parquet_rough', 512, 512, (g, W, H) => {
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
        g.fillRect(x + 2, y + 2, pw - 4, ph - 4);
        g.strokeStyle = '#d4d4d4';
        g.lineWidth = 2.5;
        g.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
      }
    }
  }, false);
  parquetRoughness.wrapS = parquetRoughness.wrapT = THREE.RepeatWrapping;

  const slatTex = makeCanvasTex('slat', 512, 512, (g, W, H) => {
    g.fillStyle = '#4a321b';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 16) {
      const l = g.createLinearGradient(x, 0, x + 16, 0);
      l.addColorStop(0, '#362310');
      l.addColorStop(0.24, '#9a6b39');
      l.addColorStop(0.56, '#bb884c');
      l.addColorStop(1, '#311f0d');
      g.fillStyle = l;
      g.fillRect(x, 0, 13, H);
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

  const mossTex = makeCanvasTex('moss', 512, 512, (g, W, H) => {
    g.fillStyle = '#2c6432';
    g.fillRect(0, 0, W, H);
    const cs = ['#2e783a', '#3d8e46', '#215628', '#4ca657', '#1c4a23', '#5ab264'];
    for (let i = 0; i < 6200; i++) {
      g.fillStyle = cs[(Math.random() * cs.length) | 0];
      g.globalAlpha = 0.38 + Math.random() * 0.5;
      circ(g, Math.random() * W, Math.random() * H, 1.4 + Math.random() * 4.2);
    }
    g.globalAlpha = 1;
  });
  mossTex.wrapS = mossTex.wrapT = THREE.RepeatWrapping;
  mossTex.repeat.set(3, 1.4);

  const mossNormal = heightCanvasToNormalTex('moss', 256, 256, (g, W, H) => {
    g.fillStyle = '#606060';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2400; i++) {
      const v = 90 + ((Math.random() * 140) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      circ(g, Math.random() * W, Math.random() * H, 1.5 + Math.random() * 4.5);
    }
  }, 2.6);
  mossNormal.repeat.set(3, 1.4);

  // Architectural honed dark slate feature stone (for Reception hero wall & Board Room wall)
  const slateTex = makeCanvasTex('slate', 512, 512, (g, W, H) => {
    g.fillStyle = '#1e2228';
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
        const tone = (((r * 41 + c * 73) % 16) - 8);
        g.fillStyle = `rgb(${36 + tone},${41 + tone},${48 + tone})`;
        g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        for (let i = 0; i < 36; i++) {
          const v = 24 + ((Math.random() * 34) | 0);
          g.fillStyle = `rgba(${v},${v + 2},${v + 5},0.28)`;
          circ(g, x + 4 + Math.random() * (bw - 8), y + 4 + Math.random() * (bh - 8), 2 + Math.random() * 7);
        }
        g.strokeStyle = 'rgba(10,12,15,0.85)';
        g.lineWidth = 3;
        g.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
      }
    }
  });
  slateTex.wrapS = slateTex.wrapT = THREE.RepeatWrapping;
  slateTex.repeat.set(3, 1.6);

  const slateNormal = heightCanvasToNormalTex('slate', 512, 512, (g, W, H) => {
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
        g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        for (let i = 0; i < 32; i++) {
          const v = base - 16 + ((Math.random() * 32) | 0);
          g.fillStyle = `rgb(${v},${v},${v})`;
          circ(g, x + 4 + Math.random() * (bw - 8), y + 4 + Math.random() * (bh - 8), 2 + Math.random() * 6);
        }
        g.strokeStyle = '#202020';
        g.lineWidth = 3.5;
        g.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
      }
    }
  }, 2.8);
  slateNormal.repeat.set(3, 1.6);

  const slateRoughness = makeCanvasTex('slate_rough', 512, 512, (g, W, H) => {
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
        g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        g.strokeStyle = '#e5e5e5';
        g.lineWidth = 3;
        g.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
      }
    }
  }, false);
  slateRoughness.wrapS = slateRoughness.wrapT = THREE.RepeatWrapping;
  slateRoughness.repeat.set(3, 1.6);

  // Architectural gypsum / matte plaster wall relief (micro-roller texture + architectural panel shadow-gaps)
  const plasterNormal = heightCanvasToNormalTex('plaster', 256, 256, (g, W, H) => {
    g.fillStyle = '#868686';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4500; i++) {
      const v = 114 + ((Math.random() * 40) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      circ(g, Math.random() * W, Math.random() * H, 0.8 + Math.random() * 2.2);
    }
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
    for (let i = 0; i < 240; i++) {
      const v = 186 + ((Math.random() * 54) | 0);
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      circ(g, Math.random() * W, Math.random() * H, 6 + Math.random() * 24);
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
    g.fillStyle = '#e2dfd7';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 54; i++) {
      const v = 148 + ((Math.random() * 62) | 0);
      g.fillStyle = `rgba(${v},${v},${v - 4},0.04)`;
      circ(g, Math.random() * W, Math.random() * H, 12 + Math.random() * 46);
    }
    g.strokeStyle = 'rgba(90,88,82,0.16)';
    g.lineWidth = 1.2;
    for (let y = 0; y < H; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    for (let x = 32; x < W; x += 64) {
      for (let y = 32; y < H; y += 64) {
        g.fillStyle = 'rgba(72,70,64,0.22)';
        circ(g, x, y, 2.2);
      }
    }
    for (let i = 0; i < 64; i++) {
      const x = Math.random() * W;
      const w = 0.6 + Math.random() * 2.5;
      const a = 0.03 + Math.random() * 0.06;
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, 'rgba(90,92,88,0)');
      grd.addColorStop(0.25, `rgba(90,92,88,${a})`);
      grd.addColorStop(0.85, `rgba(90,92,88,${a * 0.65})`);
      grd.addColorStop(1, 'rgba(90,92,88,0)');
      g.fillStyle = grd;
      g.fillRect(x, Math.random() * H * 0.35, w, H * 0.65);
    }
    for (let i = 0; i < 2800; i++) {
      g.fillStyle = `rgba(155,153,147,${Math.random() * 0.07})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
  });
  concreteTex.wrapS = concreteTex.wrapT = THREE.RepeatWrapping;
  concreteTex.repeat.set(4, 2);

  const concreteNormal = heightCanvasToNormalTex('concrete', 256, 256, (g, W, H) => {
    g.fillStyle = '#848484';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 3600; i++) {
      const v = 104 + ((Math.random() * 54) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    // formwork panel joints & tie-cone dimples aligned with concreteTex
    g.strokeStyle = '#484848';
    g.lineWidth = 2;
    for (let y = 0; y < H; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    for (let x = 32; x < W; x += 64) {
      for (let y = 32; y < H; y += 64) {
        g.fillStyle = '#383838';
        circ(g, x, y, 2.5);
      }
    }
  }, 1.7);
  concreteNormal.repeat.set(4, 2);

  const roughTex = makeCanvasTex('rough', 256, 256, (g, W, H) => {
    g.fillStyle = '#c8c8c8';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 5200; i++) {
      const v = 148 + ((Math.random() * 100) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 9, 2 + Math.random() * 7);
    }
    for (let i = 0; i < 160; i++) {
      const v = 170 + ((Math.random() * 60) | 0);
      g.fillStyle = `rgba(${v},${v},${v},0.12)`;
      circ(g, Math.random() * W, Math.random() * H, 8 + Math.random() * 30);
    }
  }, false);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.set(6, 6);

  const fabricNormal = heightCanvasToNormalTex('fabric', 128, 128, (g, W, H) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 4) {
      for (let x = 0; x < W; x += 4) {
        const alt = ((x + y) / 4) % 2 === 0;
        g.fillStyle = alt ? '#9e9e9e' : '#626262';
        g.fillRect(x, y, 3, 3);
      }
    }
  }, 1.5);
  fabricNormal.repeat.set(8, 8);

  const acousticTex = makeCanvasTex('acoustic_felt', 256, 256, (g, W, H) => {
    g.fillStyle = '#4e555e';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4200; i++) {
      const v = 64 + ((Math.random() * 36) | 0);
      g.fillStyle = `rgba(${v},${v + 4},${v + 9},0.45)`;
      g.fillRect(Math.random() * W, Math.random() * H, 1.5, 2.5);
    }
    // Subtle architectural acoustic vertical ribbing
    for (let x = 0; x < W; x += 16) {
      g.fillStyle = 'rgba(20,24,28,0.16)';
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
    g.fillStyle = '#6c6a64';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 11000; i++) {
      const v = Math.random() < 0.5 ? 84 + ((Math.random() * 38) | 0) : 118 + ((Math.random() * 52) | 0);
      g.fillStyle = `rgba(${v},${v - 2},${v - 6},0.5)`;
      g.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6);
    }
    g.strokeStyle = 'rgba(42,40,38,0.12)';
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
    g.fillStyle = '#929292';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2400; i++) {
      const v = 104 + ((Math.random() * 52) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      circ(g, Math.random() * W, Math.random() * H, 0.9);
    }
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
    for (let i = 0; i < 26; i++) {
      const v = 190 + ((Math.random() * 30) | 0);
      g.fillStyle = `rgba(${v},${v - 3},${v - 10},0.25)`;
      circ(g, Math.random() * W, Math.random() * H, 4 + Math.random() * 24);
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

  // Exterior courtyard pavers (normal + roughness)
  const paveNormal = heightCanvasToNormalTex('pave', 256, 256, (g, W, H) => {
    g.fillStyle = '#909090';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2200; i++) {
      const v = 116 + ((Math.random() * 50) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    g.strokeStyle = '#242424';
    g.lineWidth = 4;
    g.strokeRect(2, 2, W - 4, H - 4);
  }, 2.5);

  const paveRoughness = makeCanvasTex('pave_rough', 256, 256, (g, W, H) => {
    g.fillStyle = '#bababa';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1200; i++) {
      const v = 158 + ((Math.random() * 75) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      circ(g, Math.random() * W, Math.random() * H, 2 + Math.random() * 6);
    }
    g.strokeStyle = '#ececec';
    g.lineWidth = 4;
    g.strokeRect(2, 2, W - 4, H - 4);
  }, false);
  paveRoughness.wrapS = paveRoughness.wrapT = THREE.RepeatWrapping;

  // Asphalt mineral aggregate (albedo + normal + roughness)
  const asphaltTex = makeCanvasTex('asphalt', 256, 256, (g, W, H) => {
    g.fillStyle = '#36393f';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 5600; i++) {
      const v = 42 + ((Math.random() * 48) | 0);
      g.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
      g.fillRect(Math.random() * W, Math.random() * H, 1.5 + Math.random() * 2, 1.5 + Math.random() * 2);
    }
  });
  asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
  asphaltTex.repeat.set(16, 4);

  const asphaltNormal = heightCanvasToNormalTex('asphalt', 256, 256, (g, W, H) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6000; i++) {
      const v = 80 + ((Math.random() * 110) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
  }, 2.2);
  asphaltNormal.repeat.set(16, 4);

  const asphaltRoughness = makeCanvasTex('asphalt_rough', 256, 256, (g, W, H) => {
    g.fillStyle = '#dcdcdc';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2400; i++) {
      const v = 165 + ((Math.random() * 80) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      circ(g, Math.random() * W, Math.random() * H, 2 + Math.random() * 8);
    }
  }, false);
  asphaltRoughness.wrapS = asphaltRoughness.wrapT = THREE.RepeatWrapping;
  asphaltRoughness.repeat.set(16, 4);

  // Exterior grass & urban masonry normals
  const grassNormal = heightCanvasToNormalTex('grass', 256, 256, (g, W, H) => {
    g.fillStyle = '#7c7c7c';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4200; i++) {
      const v = 70 + ((Math.random() * 125) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2, 3 + Math.random() * 4);
    }
  }, 2.0);
  grassNormal.repeat.set(24, 24);

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
    g.fillStyle = '#4e3c2d';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 180; i++) {
      const v = 46 + ((Math.random() * 52) | 0);
      g.fillStyle = `rgb(${v + 12},${v},${v - 12})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 14 + Math.random() * 38);
    }
  });
  barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping;
  barkTex.repeat.set(2, 3);

  const barkNormal = heightCanvasToNormalTex('bark', 128, 256, (g, W, H) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 200; i++) {
      const v = 50 + ((Math.random() * 160) | 0);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 14 + Math.random() * 40);
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
        const bw = 6 + Math.random() * 14;
        const bh = 34 + Math.random() * 20;
        g.fillStyle = cs[(Math.random() * cs.length) | 0];
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
    paveNormal,
    paveRoughness,
    asphaltTex,
    asphaltNormal,
    asphaltRoughness,
    grassNormal,
    facadeNormal,
    barkTex,
    barkNormal,
    glowTex,
    shadowTex,
    shelfTex,
  };
}

export function svcSignTex(key: string, title: string, sub: string, accent?: string): THREE.CanvasTexture {
  return makeCanvasTex(key, 768, 168, (g, W, H) => {
    g.fillStyle = 'rgba(9,13,18,0.92)';
    g.fillRect(0, 0, W, H);
    g.fillStyle = accent || '#6fe3a1';
    g.fillRect(0, 0, 10, H);
    g.fillStyle = '#eef6fb';
    g.textBaseline = 'middle';
    g.font = '700 52px "Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif';
    g.fillText(title, 44, 62);
    g.fillStyle = '#8fa7b8';
    g.font = '400 30px "Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif';
    g.fillText(sub || '', 44, 116);
  });
}

export function plateTex(name: string): THREE.CanvasTexture {
  return makeCanvasTex(`plate-${name}`, 640, 96, (g, W) => {
    g.clearRect(0, 0, W, 96);
    g.fillStyle = 'rgba(8,12,18,0.78)';
    rr(g, 2, 10, W - 4, 72, 36);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 2;
    rr(g, 2, 10, W - 4, 72, 36);
    g.stroke();
    g.fillStyle = '#f2f7fb';
    g.font = '600 38px "Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, W / 2, 48);
  });
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
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 4; i++) {
      const y = H * (0.22 + i * 0.17);
      const w = W * 0.16 + Math.random() * W * 0.08;
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
    g.strokeStyle = '#4a7f33';
    g.lineWidth = W * 0.045;
    g.beginPath();
    g.moveTo(cx, H * 0.99);
    g.quadraticCurveTo(cx * 0.56, H * 0.42, cx * 0.44, H * 0.03);
    g.stroke();
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      const y = H * (0.99 - t * 0.93);
      const px = cx - cx * 0.56 * t * t;
      const len = W * (0.4 * Math.sin(Math.PI * Math.min(0.96, t * 0.92 + 0.06)) + 0.06);
      const a = -0.55 + t * 0.95;
      for (const sd of [-1, 1]) {
        g.save();
        g.translate(px, y);
        g.rotate(sd * len * 0.06 + a);
        g.fillStyle = i % 2 ? '#3f8434' : '#336e2b';
        g.beginPath();
        g.ellipse(sd * len * 0.46, 0, len * 0.48, W * 0.016, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  },
};

export function leafTex(kind: string): THREE.CanvasTexture {
  return makeCanvasTex(`leaf_${kind}`, 128, 128, (g, W, H) => {
    (leafShapeDraw[kind] || leafShapeDraw.broad)(g, W, H);
  });
}
