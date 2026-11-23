import * as THREE from 'three';
import { getMaxAnisotropy } from './textures';

const CACHE = new Map<string, THREE.CanvasTexture>();
const EYE_TEX_CACHE = new Map<string, THREE.CanvasTexture>();
const FACE_TEX_CACHE = new Map<string, THREE.CanvasTexture>();
let MOTTLE_LIGHT_STAMP: HTMLCanvasElement | null = null;
let MOTTLE_DARK_STAMP: HTMLCanvasElement | null = null;

function getMottleStamps(): [HTMLCanvasElement, HTMLCanvasElement] {
  if (MOTTLE_LIGHT_STAMP && MOTTLE_DARK_STAMP) {
    return [MOTTLE_LIGHT_STAMP, MOTTLE_DARK_STAMP];
  }
  const sz = 256;
  const [lc, lg] = makeCanvas(sz, sz);
  const [dc, dg] = makeCanvas(sz, sz);
  const prng = (i: number) => ((i * 9301 + 49297) % 233280) / 233280;
  lg.fillStyle = 'rgba(255,255,255,0.032)';
  dg.fillStyle = 'rgba(0,0,0,0.032)';
  for (let i = 0; i < 480; i++) {
    const x = prng(i * 2) * sz;
    const y = prng(i * 2 + 1) * sz;
    const r = 3.2 + prng(i + 99) * 14;
    const ctx = i % 2 === 0 ? lg : dg;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  MOTTLE_LIGHT_STAMP = lc;
  MOTTLE_DARK_STAMP = dc;
  return [lc, dc];
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  return [cv, ctx];
}

function buildNormalCanvasTex(
  key: string,
  w: number,
  h: number,
  drawHeight: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  strength = 1.8
): THREE.CanvasTexture {
  const fullKey = `cnrm_${key}`;
  const existing = CACHE.get(fullKey);
  if (existing) return existing;

  const [srcCv, srcCtx] = makeCanvas(w, h);
  drawHeight(srcCtx, w, h);
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const [outCv, outCtx] = makeCanvas(w, h);
  const imgData = outCtx.createImageData(w, h);
  const out = imgData.data;
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

      const tl = src[(rowU + xm1) << 2];
      const t = src[(rowU + x) << 2];
      const tr = src[(rowU + xp1) << 2];
      const l = src[(rowM + xm1) << 2];
      const r = src[(rowM + xp1) << 2];
      const bl = src[(rowD + xm1) << 2];
      const b = src[(rowD + x) << 2];
      const br = src[(rowD + xp1) << 2];

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
  outCtx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(outCv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = getMaxAnisotropy();
  tex.needsUpdate = true;
  CACHE.set(fullKey, tex);
  return tex;
}

function makeGreyTex(
  key: string,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat = 1
): THREE.CanvasTexture {
  const existing = CACHE.get(key);
  if (existing) return existing;
  const [cv, g] = makeCanvas(w, h);
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = getMaxAnisotropy();
  CACHE.set(key, tex);
  return tex;
}

function makeColorTex(
  key: string,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const existing = CACHE.get(key);
  if (existing) return existing;
  const [cv, g] = makeCanvas(w, h);
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = getMaxAnisotropy();
  CACHE.set(key, tex);
  return tex;
}

export interface HumanMicroMaps {
  skinNormalTex: THREE.CanvasTexture;
  skinRoughTex: THREE.CanvasTexture;
  weaveNormalTex: THREE.CanvasTexture;
  weaveRoughTex: THREE.CanvasTexture;
  knitNormalTex: THREE.CanvasTexture;
  knitRoughTex: THREE.CanvasTexture;
  leatherNormalTex: THREE.CanvasTexture;
  hairStrandTex: THREE.CanvasTexture;
  hairCoilNormalTex: THREE.CanvasTexture;
  hairStrandNormalTex: THREE.CanvasTexture;
  hairTipAlphaTex: THREE.CanvasTexture;
  hairCardAlphaTex: THREE.CanvasTexture;
  afroHaloAlphaTex: THREE.CanvasTexture;
}

let MICRO_MAPS: HumanMicroMaps | null = null;

export function getHumanMicroMaps(): HumanMicroMaps {
  if (MICRO_MAPS) return MICRO_MAPS;

  // 1. Skin micro-pores + fine dermal cross-creases (matte PBR dermal relief)
  const skinNormalTex = buildNormalCanvasTex(
    'skin_pores_v4',
    256,
    256,
    (g, W, H) => {
      const img = g.createImageData(W, H);
      const d = img.data;
      let seed = 1979;
      for (let i = 0; i < d.length; i += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const v = (seed >>> 24) % 9 === 0 ? 96 + ((seed >>> 16) % 44) : 128;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      g.strokeStyle = 'rgba(108,108,108,0.22)';
      g.lineWidth = 0.65;
      g.beginPath();
      for (let i = 0; i < 240; i++) {
        const x = (i * 37) % W;
        const y = (i * 53) % H;
        g.moveTo(x, y);
        g.lineTo(x + ((i % 5) - 2) * 5, y + ((i % 3) + 1) * 4);
      }
      g.stroke();
    },
    1.18
  );
  skinNormalTex.repeat.set(4, 4);

  const skinRoughTex = makeGreyTex(
    'skin_rough_v5',
    256,
    256,
    (g, W, H) => {
      const img = g.createImageData(W, H);
      const d = img.data;
      let seed = 4327;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const v = 198 + ((seed >>> 24) % 44);
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
    },
    3
  );

  // 2. Tailored wool/cotton suiting twill weave + realistic diagonal garment tension undulations
  const weaveNormalTex = buildNormalCanvasTex(
    'garment_twill_v4',
    256,
    256,
    (g, W, H) => {
      const img = g.createImageData(W, H);
      const d = img.data;
      for (let y = 0; y < H; y++) {
        const yMod = y % 3;
        for (let x = 0; x < W; x++) {
          const xMod = x % 3;
          const xBase = x - xMod;
          const yBase = y - yMod;
          const v = xMod === 2 || yMod === 2 ? 128 : (xBase + yBase) % 6 < 3 ? 142 : 114;
          const idx = (y * W + x) << 2;
          d[idx] = v;
          d[idx + 1] = v;
          d[idx + 2] = v;
          d[idx + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      for (let i = 0; i < 18; i++) {
        const y = (i / 18) * H;
        g.strokeStyle = i % 2 === 0 ? 'rgba(170,170,170,0.2)' : 'rgba(92,92,92,0.2)';
        g.lineWidth = 4 + (i % 3) * 2;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(W * 0.3, y + Math.sin(i) * 8, W * 0.7, y - Math.cos(i) * 8, W, y);
        g.stroke();
      }
    },
    1.5
  );
  weaveNormalTex.repeat.set(4, 4);

  const weaveRoughTex = makeGreyTex(
    'garment_twill_rough_v4',
    256,
    256,
    (g, W, H) => {
      const img = g.createImageData(W, H);
      const d = img.data;
      let seed = 5503;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const v = 198 + ((seed >>> 24) % 46);
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
    },
    4
  );

  // 3. Knitwear texture
  const knitNormalTex = buildNormalCanvasTex(
    'garment_knit_v4',
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#707070';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = '#bcbcbc';
      g.lineWidth = 2.2;
      g.beginPath();
      for (let x = 0; x < W; x += 8) {
        for (let y = 0; y < H; y += 6) {
          g.moveTo(x + 1, y);
          g.lineTo(x + 4, y + 5);
          g.moveTo(x + 7, y);
          g.lineTo(x + 4, y + 5);
        }
      }
      g.stroke();
    },
    2.1
  );
  knitNormalTex.repeat.set(5, 5);

  const knitRoughTex = makeGreyTex(
    'garment_knit_rough_v4',
    128,
    128,
    (g, W, H) => {
      g.fillStyle = '#e6e6e6';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#d8d8d8';
      for (let x = 0; x < W; x += 8) {
        g.fillRect(x, 0, 2, H);
      }
      g.fillStyle = '#eeeeee';
      for (let x = 4; x < W; x += 8) {
        g.fillRect(x, 0, 2, H);
      }
    },
    5
  );

  // 4. Pebble-grain leather for footwear & belts
  const leatherNormalTex = buildNormalCanvasTex(
    'leather_grain_v4',
    128,
    128,
    (g, W, H) => {
      const img = g.createImageData(W, H);
      const d = img.data;
      let seed = 2311;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const v = 108 + ((seed >>> 24) % 48);
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
    },
    1.2
  );
  leatherNormalTex.repeat.set(3, 3);

  // 5. Hair strand & curl maps
  const hairStrandTex = makeColorTex(
    'hair_strand_v6',
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#c8c8c8';
      g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 2) {
        const v = 186 + ((x * 29) % 36);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x, 0, 1.4, H);
      }
      g.fillStyle = 'rgba(255,255,255,0.04)';
      for (let i = 0; i < 400; i += 2) {
        const px = (((i * 1933) % 997) / 997) * W;
        const py = (((i * 4447) % 997) / 997) * H;
        g.fillRect(px, py, 1.4, 14);
      }
      g.fillStyle = 'rgba(18,18,18,0.06)';
      for (let i = 1; i < 400; i += 2) {
        const px = (((i * 1933) % 997) / 997) * W;
        const py = (((i * 4447) % 997) / 997) * H;
        g.fillRect(px, py, 1.4, 14);
      }
    },
    4,
    2
  );

  const hairCoilNormalTex = buildNormalCanvasTex(
    'hair_coils_v4',
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#707070';
      g.fillRect(0, 0, W, H);
      g.lineWidth = 1.5;
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass === 0 ? '#d2d2d2' : '#3c3c3c';
        g.beginPath();
        for (let i = pass; i < 1800; i += 2) {
          const px = (((i * 3911) % 997) / 997) * W;
          const py = (((i * 7129) % 997) / 997) * H;
          const r = 2.2 + (i % 4);
          const a0 = (i % 6) * 0.8;
          g.moveTo(px + Math.cos(a0) * r, py + Math.sin(a0) * r);
          g.arc(px, py, r, a0, a0 + Math.PI * 1.35);
        }
        g.stroke();
      }
    },
    2.6
  );
  hairCoilNormalTex.repeat.set(3, 3);

  const hairStrandNormalTex = buildNormalCanvasTex(
    'hair_strands_nrm_v4',
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 3) {
        const v = 90 + ((x * 53) % 92);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x, 0, 1.6, H);
      }
    },
    1.8
  );
  hairStrandNormalTex.repeat.set(5, 2);

  // Feathered alpha map for layered hair curtain tips
  const hairTipAlphaTex = makeGreyTex('hair_tip_alpha_v4', 128, 128, (g, W, H) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    const grad = g.createLinearGradient(0, H * 0.65, 0, H);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#101010');
    g.fillStyle = grad;
    g.fillRect(0, H * 0.65, W, H * 0.35);
    for (let x = 0; x < W; x += 3) {
      const tipLen = 14 + ((x * 29) % 26);
      g.fillStyle = '#ffffff';
      g.fillRect(x, H * 0.64, 1.6, tipLen);
    }
  });
  hairTipAlphaTex.wrapS = THREE.RepeatWrapping;
  hairTipAlphaTex.wrapT = THREE.ClampToEdgeWrapping;

  // Individual feathered strand-ribbon card alpha map (tapered tip + side soft fade)
  const hairCardAlphaTex = makeGreyTex('hair_card_alpha_v4', 128, 128, (g, W, H) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, W, H);
    for (let s = 0; s < 26; s++) {
      const sx = W * (0.08 + (s / 25) * 0.84);
      const len = H * (0.72 + ((s * 17) % 7) * 0.038);
      const gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, '#eaeaea');
      gr.addColorStop(0.68, '#ffffff');
      gr.addColorStop(1, '#000000');
      g.strokeStyle = gr;
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(sx, 0);
      g.quadraticCurveTo(sx + Math.sin(s) * 4, len * 0.5, sx + Math.cos(s) * 3, len);
      g.stroke();
    }
  });
  hairCardAlphaTex.wrapS = THREE.ClampToEdgeWrapping;
  hairCardAlphaTex.wrapT = THREE.ClampToEdgeWrapping;

  // Organic coily perimeter halo card alpha map for natural afro volume
  const afroHaloAlphaTex = makeGreyTex('afro_halo_alpha_v4', 128, 128, (g, W, H) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 220; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt(i / 220) * (W * 0.44);
      const px = W * 0.5 + Math.cos(a) * r;
      const py = H * 0.5 + Math.sin(a) * r;
      const alpha = Math.max(40, Math.round(255 * (1 - (r / (W * 0.48)) * 0.65)));
      g.strokeStyle = `rgb(${alpha},${alpha},${alpha})`;
      g.lineWidth = 2.6;
      g.beginPath();
      g.arc(px, py, 3.2 + (i % 4), a, a + Math.PI * 1.45);
      g.stroke();
    }
  });
  afroHaloAlphaTex.wrapS = THREE.ClampToEdgeWrapping;
  afroHaloAlphaTex.wrapT = THREE.ClampToEdgeWrapping;

  MICRO_MAPS = {
    skinNormalTex,
    skinRoughTex,
    weaveNormalTex,
    weaveRoughTex,
    knitNormalTex,
    knitRoughTex,
    leatherNormalTex,
    hairStrandTex,
    hairCoilNormalTex,
    hairStrandNormalTex,
    hairTipAlphaTex,
    hairCardAlphaTex,
    afroHaloAlphaTex,
  };
  return MICRO_MAPS;
}

function shadeHex(hex: number, lumShift: number, satShift = 0): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    hsl.h,
    THREE.MathUtils.clamp(hsl.s + satShift, 0, 1),
    THREE.MathUtils.clamp(hsl.l + lumShift, 0.03, 0.96)
  );
  return `#${c.getHexString()}`;
}

/**
 * Generates an anatomical 3D eyeball texture (sclera, subtle outer capillary tint,
 * limbal ring, radially striated iris, golden collarette, pupil) mapped around +Z pole.
 */
export function getEyeIrisTexture(irisHex: number): THREE.CanvasTexture {
  const key = `eyev5_${irisHex.toString(16)}`;
  const existing = EYE_TEX_CACHE.get(key);
  if (existing) return existing;

  const W = 256;
  const H = 256;
  const [cv, g] = makeCanvas(W, H);
  const irisCss = `#${irisHex.toString(16).padStart(6, '0')}`;
  const irisBright = shadeHex(irisHex, 0.12, 0.08);
  const irisDark = shadeHex(irisHex, -0.1, 0.04);

  // Equirectangular map where +Z front pole sits at u=0.5, v=0.5
  const bg = g.createRadialGradient(W * 0.5, H * 0.5, 25, W * 0.5, H * 0.5, W * 0.45);
  bg.addColorStop(0, '#efe9e1');
  bg.addColorStop(0.55, '#e2d7cc');
  bg.addColorStop(1, '#c2aca0');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Subtle natural sclera micro-veins toward outer edges
  g.strokeStyle = 'rgba(175, 82, 74, 0.14)';
  g.lineWidth = 0.85;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    g.beginPath();
    g.moveTo(W * 0.5 + Math.cos(a) * 35, H * 0.5 + Math.sin(a) * 35);
    g.quadraticCurveTo(
      W * 0.5 + Math.cos(a + 0.18) * 58,
      H * 0.5 + Math.sin(a + 0.18) * 58,
      W * 0.5 + Math.cos(a - 0.1) * 90,
      H * 0.5 + Math.sin(a - 0.1) * 90
    );
    g.stroke();
  }

  const cx = W * 0.5;
  const cy = H * 0.5;
  const irisR = 26.5;

  // Dark limbal ring
  g.fillStyle = '#120d0a';
  g.beginPath();
  g.arc(cx, cy, irisR + 2.4, 0, Math.PI * 2);
  g.fill();

  // Iris base gradient
  const ig = g.createRadialGradient(cx, cy, 5, cx, cy, irisR);
  ig.addColorStop(0, irisBright);
  ig.addColorStop(0.58, irisCss);
  ig.addColorStop(1, irisDark);
  g.fillStyle = ig;
  g.beginPath();
  g.arc(cx, cy, irisR, 0, Math.PI * 2);
  g.fill();

  // Radial iris crypts & fibers
  for (let r = 0; r < 48; r++) {
    const a = (r / 48) * Math.PI * 2;
    g.strokeStyle = r % 2 === 0 ? 'rgba(255,220,175,0.2)' : 'rgba(18,10,6,0.25)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 9.5, cy + Math.sin(a) * 9.5);
    g.lineTo(cx + Math.cos(a) * (irisR - 1.5), cy + Math.sin(a) * (irisR - 1.5));
    g.stroke();
  }

  // Pupil
  g.fillStyle = '#060608';
  g.beginPath();
  g.arc(cx, cy, 9.2, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = getMaxAnisotropy();
  EYE_TEX_CACHE.set(key, tex);
  return tex;
}

export interface FaceTextureOptions {
  skinHex: number;
  hairHex: number;
  irisHex: number;
  fem: boolean;
  beardStyle: 'none' | 'stubble' | 'full';
  hasFadeHairline: boolean;
  freckleSeed: number;
  warmSmile: boolean;
  size?: 256 | 512 | 768 | 1024;
}

/**
 * Generates an individually characterized dermal face & neck CanvasTexture mapped to our
 * sculpted 3D head topology (with 3D eye sockets/eyeballs, 3D sculpted lips, and 3D nose).
 * Orbital zones shade smoothly into the 3D eyelids and lashlines rather than flat 2D sticker eyes.
 */
export function getPhotorealFaceTexture(opts: FaceTextureOptions): THREE.CanvasTexture {
  const size = opts.size || 512;
  const freckleKind = opts.freckleSeed % 3 === 1 ? 1 : opts.freckleSeed % 4 === 2 ? 2 : 0;
  const key = [
    'facev6',
    size,
    opts.skinHex.toString(16),
    opts.hairHex.toString(16),
    opts.fem ? 'f' : 'm',
    opts.beardStyle,
    opts.hasFadeHairline ? 'fd' : 'nf',
    freckleKind,
    opts.warmSmile ? 'sm' : 'nt',
  ].join('_');

  const cached = FACE_TEX_CACHE.get(key);
  if (cached) return cached;

  const W = size;
  const H = size;
  const sc = W / 512;
  const [cv, g] = makeCanvas(W, H);

  const baseCss = `#${opts.skinHex.toString(16).padStart(6, '0')}`;
  const shadowCss = shadeHex(opts.skinHex, -0.1, 0.04);
  const deepShadowCss = shadeHex(opts.skinHex, -0.2, 0.05);
  const warmSubsurfaceCss = shadeHex(opts.skinHex, -0.01, 0.14);
  const highlightCss = shadeHex(opts.skinHex, 0.038, -0.01);
  const hairCss = `#${opts.hairHex.toString(16).padStart(6, '0')}`;

  // 1. Base dermal tone + subtle organic melanin mottling (single cached stamp blit instead of 820 arc calls)
  g.fillStyle = baseCss;
  g.fillRect(0, 0, W, H);
  const [mottleLight, mottleDark] = getMottleStamps();
  g.drawImage(mottleLight, 0, 0, W, H);
  g.drawImage(mottleDark, 0, 0, W, H);

  const prng = (i: number) => ((i * 9301 + 49297 + opts.freckleSeed * 233) % 233280) / 233280;

  const addRadial = (cx: number, cy: number, rx: number, ry: number, col: string, alpha: number) => {
    g.save();
    g.translate(cx, cy);
    g.scale(1, ry / Math.max(0.01, rx));
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, col);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha;
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };

  // Forehead, nasal bridge, cheekbone flush, chin warmth
  addRadial(W * 0.5, H * 0.34, 52 * sc, 28 * sc, highlightCss, 0.22);
  addRadial(W * 0.5, H * 0.49, 9 * sc, 28 * sc, highlightCss, 0.22);
  addRadial(W * 0.415, H * 0.555, 28 * sc, 18 * sc, warmSubsurfaceCss, opts.fem ? 0.28 : 0.2);
  addRadial(W * 0.585, H * 0.555, 28 * sc, 18 * sc, warmSubsurfaceCss, opts.fem ? 0.28 : 0.2);
  addRadial(W * 0.5, H * 0.568, 12 * sc, 9 * sc, warmSubsurfaceCss, 0.2);
  addRadial(W * 0.5, H * 0.725, 16 * sc, 11 * sc, highlightCss, 0.16);

  // Subtle forehead expression lines & nasolabial crease cues
  g.strokeStyle = shadowCss;
  g.globalAlpha = 0.22;
  g.lineWidth = 2.4 * sc;
  g.lineCap = 'round';
  g.beginPath();
  for (const side of [-1, 1]) {
    g.moveTo(W * (0.5 + side * 0.032), H * 0.578);
    g.quadraticCurveTo(W * (0.5 + side * 0.054), H * 0.625, W * (0.5 + side * 0.048), H * 0.67);
  }
  g.stroke();
  g.globalAlpha = 1;

  // Individual beauty mark / subtle skin freckles
  if (freckleKind === 1) {
    g.fillStyle = '#24140d';
    g.globalAlpha = 0.55;
    g.beginPath();
    g.arc(W * 0.428, H * 0.59, 1.5 * sc, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  } else if (freckleKind === 2) {
    g.fillStyle = deepShadowCss;
    g.globalAlpha = 0.24;
    g.beginPath();
    for (let f = 0; f < 18; f++) {
      const fx = W * (0.405 + prng(f + 700) * 0.19);
      const fy = H * (0.52 + prng(f + 800) * 0.06);
      g.moveTo(fx + 1.05 * sc, fy);
      g.arc(fx, fy, 1.05 * sc, 0, Math.PI * 2);
    }
    g.fill();
    g.globalAlpha = 1;
  }

  // Natural hairline edge feathering + temple sideburn taper
  if (opts.hasFadeHairline) {
    const fadeGrd = g.createLinearGradient(0, H * 0.25, 0, H * 0.375);
    fadeGrd.addColorStop(0, hairCss);
    fadeGrd.addColorStop(0.55, hairCss);
    fadeGrd.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.68;
    g.fillStyle = fadeGrd;
    g.fillRect(0, 0, W, H * 0.375);
    addRadial(W * 0.305, H * 0.48, 28 * sc, 54 * sc, hairCss, 0.46);
    addRadial(W * 0.695, H * 0.48, 28 * sc, 54 * sc, hairCss, 0.46);
    g.globalAlpha = 1;
  } else {
    // Subtle baby-hair / edge transition along upper forehead & nape so scalp cap blends seamlessly
    const edgeGrd = g.createLinearGradient(0, H * 0.12, 0, H * 0.285);
    edgeGrd.addColorStop(0, hairCss);
    edgeGrd.addColorStop(0.65, hairCss);
    edgeGrd.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.72;
    g.fillStyle = edgeGrd;
    g.fillRect(0, 0, W, H * 0.285);
    g.globalAlpha = 1;
  }

  // Groomed stubble / beard shadow + micro hair strokes
  if (!opts.fem && opts.beardStyle !== 'none') {
    const bAlpha = opts.beardStyle === 'full' ? 0.56 : 0.28;
    addRadial(W * 0.5, H * 0.705, 72 * sc, 44 * sc, hairCss, bAlpha);
    addRadial(W * 0.5, H * 0.622, 24 * sc, 7.5 * sc, hairCss, bAlpha * 0.88);
    g.strokeStyle = hairCss;
    g.globalAlpha = bAlpha * 0.75;
    g.lineWidth = 0.9 * sc;
    g.beginPath();
    for (let i = 0; i < 240; i++) {
      const bx = W * (0.36 + prng(i + 200) * 0.28);
      const by = H * (0.635 + prng(i + 300) * 0.13);
      g.moveTo(bx, by);
      g.lineTo(bx + (prng(i) - 0.5) * 2 * sc, by + 3.2 * sc);
    }
    g.stroke();
    g.globalAlpha = 1;
  }

  // Submental jaw & clavicle neck ambient shadow
  const neckGrd = g.createLinearGradient(0, H * 0.75, 0, H * 0.96);
  neckGrd.addColorStop(0, 'rgba(0,0,0,0)');
  neckGrd.addColorStop(0.45, deepShadowCss);
  neckGrd.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.36;
  g.fillStyle = neckGrd;
  g.fillRect(0, H * 0.75, W, H * 0.21);
  g.globalAlpha = 1;

  // Orbital eye socket AO, tear trough, philtrum & shaded nostril recesses
  addRadial(W * 0.437, H * 0.482, 20 * sc, 13 * sc, shadowCss, 0.54);
  addRadial(W * 0.563, H * 0.482, 20 * sc, 13 * sc, shadowCss, 0.54);
  addRadial(W * 0.5, H * 0.582, 15 * sc, 7 * sc, deepShadowCss, 0.36);
  addRadial(W * 0.484, H * 0.576, 4.4 * sc, 3.0 * sc, '#140b08', 0.65);
  addRadial(W * 0.516, H * 0.576, 4.4 * sc, 3.0 * sc, '#140b08', 0.65);
  addRadial(W * 0.5, H * 0.62, 4 * sc, 11 * sc, shadowCss, 0.28);

  // Subtle lashline & socket-rim shading around 3D eyeball openings (no painted 2D eyeballs!)
  for (const side of [-1, 1]) {
    const ex = W * (0.5 + side * 0.063);
    const ey = H * 0.482;
    const ew = 12.2 * sc;
    const eh = 5.2 * sc;

    // Socket interior dark shading (so eye sits naturally deep behind lids)
    addRadial(ex, ey, ew * 0.88, eh * 1.15, deepShadowCss, 0.55);

    // Upper eyelid crease
    g.strokeStyle = deepShadowCss;
    g.globalAlpha = 0.62;
    g.lineWidth = 1.6 * sc;
    g.beginPath();
    g.moveTo(ex - ew * 0.94, ey - eh * 0.48);
    g.quadraticCurveTo(ex, ey - eh * 1.52, ex + ew * 0.94, ey - eh * 0.38);
    g.stroke();

    // Under-eye tear trough
    g.globalAlpha = 0.24;
    g.lineWidth = 1.3 * sc;
    g.beginPath();
    g.moveTo(ex - ew * 0.78, ey + eh * 1.15);
    g.quadraticCurveTo(ex, ey + eh * 1.55, ex + ew * 0.72, ey + eh * 1.12);
    g.stroke();

    // Lashline accent
    g.strokeStyle = '#16110f';
    g.globalAlpha = opts.fem ? 0.82 : 0.66;
    g.lineWidth = (opts.fem ? 1.9 : 1.4) * sc;
    g.beginPath();
    g.moveTo(ex - ew * 0.94, ey);
    g.quadraticCurveTo(ex, ey - eh * 1.16, ex + ew * 0.94, ey);
    g.stroke();

    // Feathered individual eyebrow strokes (by = H * 0.402)
    const bx = ex;
    const by = H * 0.402;
    g.strokeStyle = hairCss;
    g.lineCap = 'round';
    g.globalAlpha = 0.78;
    g.lineWidth = (opts.fem ? 1.15 : 1.45) * sc;
    g.beginPath();
    for (let h = 0; h < 28; h++) {
      const k = h / 27;
      const sx = THREE.MathUtils.lerp(bx - side * 12.8 * sc, bx + side * 13.8 * sc, k);
      const sy = by + 2.2 * sc - Math.sin(k * Math.PI) * (opts.fem ? 4.3 : 2.5) * sc;
      g.moveTo(sx, sy + 1.4 * sc);
      g.lineTo(sx + side * 2.2 * sc, sy - 2.2 * sc);
    }
    g.stroke();
  }
  g.globalAlpha = 1;

  // Natural lips (mapped seamlessly over our sculpted 3D lip geometry)
  const mx = W * 0.5;
  const my = H * 0.659;
  const lipColor = new THREE.Color(opts.skinHex).lerp(
    new THREE.Color(opts.fem ? 0x5c2623 : 0x592f2a),
    opts.fem ? 0.52 : 0.36
  );
  const lipUpperCss = `#${lipColor.clone().multiplyScalar(0.82).getHexString()}`;
  const lipLowerCss = `#${lipColor.getHexString()}`;

  g.fillStyle = lipUpperCss;
  g.globalAlpha = 0.88;
  g.beginPath();
  g.moveTo(mx - 19 * sc, my);
  g.quadraticCurveTo(mx - 9 * sc, my - 5.4 * sc, mx - 3 * sc, my - 4.1 * sc);
  g.quadraticCurveTo(mx, my - 2.5 * sc, mx + 3 * sc, my - 4.1 * sc);
  g.quadraticCurveTo(mx + 9 * sc, my - 5.4 * sc, mx + 19 * sc, my);
  g.quadraticCurveTo(mx, my + 1.1 * sc, mx - 19 * sc, my);
  g.closePath();
  g.fill();

  g.fillStyle = lipLowerCss;
  g.globalAlpha = 0.84;
  g.beginPath();
  g.moveTo(mx - 17 * sc, my + 0.5 * sc);
  g.quadraticCurveTo(mx, my + 8.6 * sc, mx + 17 * sc, my + 0.5 * sc);
  g.quadraticCurveTo(mx, my + 1.6 * sc, mx - 17 * sc, my + 0.5 * sc);
  g.closePath();
  g.fill();

  if (opts.warmSmile) {
    g.fillStyle = '#e8e2d8';
    g.globalAlpha = 0.78;
    g.beginPath();
    g.ellipse(mx, my + 0.7 * sc, 9.0 * sc, 1.5 * sc, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.strokeStyle = '#281311';
  g.globalAlpha = 0.58;
  g.lineWidth = 1.4 * sc;
  g.beginPath();
  g.moveTo(mx - 18.5 * sc, my + 0.4 * sc);
  g.quadraticCurveTo(mx, my + (opts.warmSmile ? 2.1 : 1.3) * sc, mx + 18.5 * sc, my + 0.4 * sc);
  g.stroke();

  g.strokeStyle = deepShadowCss;
  g.globalAlpha = 0.09;
  g.lineWidth = 0.7 * sc;
  g.beginPath();
  for (let l = -4; l <= 4; l++) {
    g.moveTo(mx + l * 3.1 * sc, my + 2.1 * sc);
    g.lineTo(mx + l * 2.8 * sc, my + 5.4 * sc);
  }
  g.stroke();
  addRadial(mx, my + 9.2 * sc, 14 * sc, 5 * sc, deepShadowCss, 0.12);
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = getMaxAnisotropy();
  FACE_TEX_CACHE.set(key, tex);
  return tex;
}
