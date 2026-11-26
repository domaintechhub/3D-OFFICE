import * as THREE from 'three';
import type { ArchitecturalMaterials } from './architecturalForms';
import type { MonitorPickTarget } from './architecture';
import type { DistrictBuildingSpec } from './districtData';
import type { WarmLightAnchor } from './districtBuildings';
import type { MaterialLibrary } from './materials';
import { boxAt, cylAt } from './props';
import type { ScreenRegistry } from './screens';
import { getMaxAnisotropy, makeCanvasTex, rr } from './textures';

function mkTileTex(t: THREE.Texture, rx: number, ry: number): THREE.Texture {
  const c = t.clone();
  c.needsUpdate = true;
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  return c;
}

export interface RealEstateBuildContext {
  spec: DistrictBuildingSpec;
  levelGroups: THREE.Group[];
  levelCeilings: THREE.Group[];
  roofShellGroup: THREE.Group;
  M: MaterialLibrary;
  archMats: ArchitecturalMaterials;
  frameDarkMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  glassMat: THREE.Material;
  terracottaMat: THREE.MeshStandardMaterial;
  floorWarmOak: THREE.MeshStandardMaterial;
  floorTerrazzo: THREE.MeshStandardMaterial;
  woodCedarMat: THREE.MeshStandardMaterial;
  bankStoneMat: THREE.MeshStandardMaterial;
  screenReg: ScreenRegistry;
  registerChair: (lv: number, x: number, y: number, z: number, restRot: number, swivelDir?: number) => void;
  registerMonitor: (
    lv: number,
    idx: number,
    monPos: [number, number, number],
    rotY: number,
    seatX: number,
    seatZ: number,
    role: string,
    zone: string
  ) => void;
  pickMeshes: THREE.Object3D[];
  rotatingProps: Array<{ obj: THREE.Object3D; speed: number; axis: 'x' | 'y' | 'z' }>;
  warmLights: WarmLightAnchor[];
  monitors: MonitorPickTarget[];
}

export interface RealEstatePalette {
  honedTravertine: THREE.MeshStandardMaterial;
  flutedTravertine: THREE.MeshStandardMaterial;
  boardformedConcrete: THREE.MeshStandardMaterial;
  chevronOak: THREE.MeshStandardMaterial;
  slateCarpet: THREE.MeshStandardMaterial;
  wovenTaupeRug: THREE.MeshStandardMaterial;
  woolCharcoalRug: THREE.MeshStandardMaterial;
  walnutExec: THREE.MeshStandardMaterial;
  sageAcoustic: THREE.MeshStandardMaterial;
  kitchenCab: THREE.MeshStandardMaterial;
  mustardBoucle: THREE.MeshStandardMaterial;
  tealLinen: THREE.MeshStandardMaterial;
  coralBoucle: THREE.MeshStandardMaterial;
  emeraldVelvet: THREE.MeshStandardMaterial;
  darkSlateSlab: THREE.MeshStandardMaterial;
  gunmetalSteel: THREE.MeshStandardMaterial;
  galvanizedSteel: THREE.MeshStandardMaterial;
  craneAmber: THREE.MeshStandardMaterial;
  safetyOrange: THREE.MeshStandardMaterial;
  rebarIron: THREE.MeshStandardMaterial;
  lumberSpruce: THREE.MeshStandardMaterial;
  brushedBronze: THREE.MeshStandardMaterial;
  vitrineGlass: THREE.MeshStandardMaterial;
  warmCoveLed: THREE.MeshBasicMaterial;
  cyanBeaconLed: THREE.MeshBasicMaterial;
  slabRackMat: THREE.MeshStandardMaterial;
  vrDarkPad: THREE.MeshStandardMaterial;
}

let cachedPalette: RealEstatePalette | null = null;

export function getRealEstatePalette(M: MaterialLibrary): RealEstatePalette {
  if (cachedPalette) return cachedPalette;

  const aniso = getMaxAnisotropy();

  const carpetTex = makeCanvasTex('re_v2_carpet_slate', 256, 256, (g, W, H) => {
    g.fillStyle = '#58626e';
    g.fillRect(0, 0, W, H);
    const tile = 64;
    for (let ty = 0; ty < H; ty += tile) {
      for (let tx = 0; tx < W; tx += tile) {
        const alt = ((tx / tile + ty / tile) % 2) === 0;
        g.fillStyle = alt ? '#626c79' : '#535d69';
        g.fillRect(tx + 1, ty + 1, tile - 2, tile - 2);
        g.fillStyle = 'rgba(255,255,255,0.04)';
        for (let s = 4; s < tile - 2; s += 6) {
          if (alt) g.fillRect(tx + s, ty + 2, 2, tile - 4);
          else g.fillRect(tx + 2, ty + s, tile - 4, 2);
        }
      }
    }
  });
  carpetTex.colorSpace = THREE.SRGBColorSpace;
  carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
  carpetTex.repeat.set(4, 6);
  carpetTex.anisotropy = aniso;

  const flutedTravTex = makeCanvasTex('re_v2_fluted_trav', 256, 256, (g, W, H) => {
    g.fillStyle = '#e7dfd1';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 16) {
      const grad = g.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, '#c8bca6');
      grad.addColorStop(0.45, '#f5efe4');
      grad.addColorStop(0.85, '#ddd2be');
      grad.addColorStop(1, '#b8ab93');
      g.fillStyle = grad;
      g.fillRect(x, 0, 16, H);
    }
  });
  flutedTravTex.colorSpace = THREE.SRGBColorSpace;
  flutedTravTex.wrapS = flutedTravTex.wrapT = THREE.RepeatWrapping;
  flutedTravTex.repeat.set(4, 1);
  flutedTravTex.anisotropy = aniso;

  const boardConcTex = makeCanvasTex('re_v2_board_concrete', 256, 256, (g, W, H) => {
    g.fillStyle = '#9aa1a8';
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 24) {
      g.fillStyle = y % 48 === 0 ? '#a6adb4' : '#8f969d';
      g.fillRect(0, y + 1, W, 22);
      g.fillStyle = 'rgba(30,41,59,0.18)';
      g.fillRect(0, y, W, 1.5);
    }
    g.fillStyle = '#475569';
    for (let y = 36; y < H; y += 72) {
      for (let x = 32; x < W; x += 64) {
        g.beginPath();
        g.arc(x, y, 3.2, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
  boardConcTex.colorSpace = THREE.SRGBColorSpace;
  boardConcTex.wrapS = boardConcTex.wrapT = THREE.RepeatWrapping;
  boardConcTex.repeat.set(2, 2);
  boardConcTex.anisotropy = aniso;

  const chevronTex = makeCanvasTex('re_v2_chevron_oak', 256, 256, (g, W, H) => {
    g.fillStyle = '#ba8f60';
    g.fillRect(0, 0, W, H);
    const cols = 4;
    const cw = W / cols;
    const step = 28;
    for (let c = 0; c < cols; c++) {
      const dir = c % 2 === 0 ? 1 : -1;
      for (let y = -step; y < H + step; y += step) {
        g.fillStyle = ((c + Math.floor(y / step)) % 3 === 0) ? '#c79b6a' : '#ad8252';
        g.beginPath();
        const x0 = c * cw;
        const x1 = x0 + cw;
        g.moveTo(x0, y);
        g.lineTo(x1, y + dir * 24);
        g.lineTo(x1, y + dir * 24 + step - 2);
        g.lineTo(x0, y + step - 2);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(68,44,24,0.22)';
        g.lineWidth = 1.4;
        g.stroke();
      }
    }
  });
  chevronTex.colorSpace = THREE.SRGBColorSpace;
  chevronTex.wrapS = chevronTex.wrapT = THREE.RepeatWrapping;
  chevronTex.repeat.set(5, 4);
  chevronTex.anisotropy = aniso;

  const matSampleTex = makeCanvasTex('re_v2_material_samples', 512, 256, (g, w, h) => {
    g.fillStyle = '#262b33';
    g.fillRect(0, 0, w, h);
    const cols = 5;
    const rows = 2;
    const cw = (w - 34) / cols;
    const ch = (h - 28) / rows;
    const swatches = ['#f4efe6', '#c29263', '#4e5864', '#dbd3c5', '#8b5e3c', '#3b634b', '#e6dfd3', '#334155', '#d4aa62', '#64748b'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 12 + c * (cw + 2);
        const y = 10 + r * (ch + 4);
        g.fillStyle = swatches[(r * cols + c) % swatches.length];
        rr(g, x, y, cw - 6, ch - 6, 4);
        g.fill();
        if ((r + c) % 2 === 0) {
          g.strokeStyle = 'rgba(255,255,255,0.28)';
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(x + 8, y + ch - 12);
          g.lineTo(x + cw - 14, y + 10);
          g.stroke();
        }
      }
    }
  });
  matSampleTex.colorSpace = THREE.SRGBColorSpace;
  matSampleTex.anisotropy = aniso;

  const std = (opts: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(opts);

  cachedPalette = {
    honedTravertine: std({
      map: mkTileTex(M.textures.marbleTex, 2, 2),
      normalMap: mkTileTex(M.textures.marbleNormal, 2, 2),
      normalScale: new THREE.Vector2(0.32, 0.32),
      color: 0xf4efe6,
      roughness: 0.3,
      metalness: 0.04,
      envMapIntensity: 0.42,
    }),
    flutedTravertine: std({
      map: flutedTravTex,
      normalMap: mkTileTex(M.textures.marbleNormal, 2, 2),
      normalScale: new THREE.Vector2(0.42, 0.28),
      roughness: 0.42,
      metalness: 0.04,
      envMapIntensity: 0.36,
    }),
    boardformedConcrete: std({
      map: boardConcTex,
      normalMap: M.textures.concreteNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.78,
      metalness: 0.04,
      envMapIntensity: 0.24,
    }),
    chevronOak: std({
      map: chevronTex,
      normalMap: M.textures.woodNormal,
      normalScale: new THREE.Vector2(0.38, 0.38),
      roughness: 0.46,
      metalness: 0.03,
      envMapIntensity: 0.3,
    }),
    slateCarpet: std({
      map: carpetTex,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.14,
    }),
    wovenTaupeRug: std({ color: 0xb9b4aa, roughness: 0.96, envMapIntensity: 0.12 }),
    woolCharcoalRug: std({ color: 0x3b4048, roughness: 0.94, envMapIntensity: 0.14 }),
    walnutExec: std({
      map: M.textures.woodTex,
      normalMap: M.textures.woodNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      color: 0x4b3222,
      roughness: 0.44,
      metalness: 0.06,
      envMapIntensity: 0.35,
    }),
    sageAcoustic: std({ color: 0x3b634b, roughness: 0.76, metalness: 0.02 }),
    kitchenCab: std({ color: 0x37433c, roughness: 0.56, metalness: 0.08 }),
    mustardBoucle: std({ color: 0xd9a74a, roughness: 0.82 }),
    tealLinen: std({ color: 0x3f888f, roughness: 0.78 }),
    coralBoucle: std({ color: 0xcf5d52, roughness: 0.82 }),
    emeraldVelvet: std({ color: 0x2e5e4e, roughness: 0.78 }),
    darkSlateSlab: std({ color: 0x2f3640, roughness: 0.48, metalness: 0.08 }),
    gunmetalSteel: std({ color: 0x2f3846, roughness: 0.42, metalness: 0.62, envMapIntensity: 0.52 }),
    galvanizedSteel: std({ color: 0x94a3b8, roughness: 0.38, metalness: 0.72, envMapIntensity: 0.58 }),
    craneAmber: std({ color: 0xf59e0b, roughness: 0.4, metalness: 0.3, envMapIntensity: 0.46 }),
    safetyOrange: std({ color: 0xf97316, roughness: 0.45, metalness: 0.1 }),
    rebarIron: std({ color: 0x4b5563, roughness: 0.58, metalness: 0.68 }),
    lumberSpruce: std({
      map: M.textures.woodTex,
      color: 0xc28a52,
      roughness: 0.74,
      metalness: 0.02,
    }),
    brushedBronze: std({ color: 0x9a7b4f, roughness: 0.34, metalness: 0.76, envMapIntensity: 0.65 }),
    vitrineGlass: new THREE.MeshStandardMaterial({
      color: 0xe6f4fa,
      roughness: 0.06,
      metalness: 0.08,
      transparent: true,
      opacity: 0.24,
      envMapIntensity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    warmCoveLed: new THREE.MeshBasicMaterial({ color: 0xffe8c2 }),
    cyanBeaconLed: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    slabRackMat: std({ map: matSampleTex, roughness: 0.46, metalness: 0.06 }),
    vrDarkPad: std({ color: 0x1e293b, roughness: 0.62, metalness: 0.1 }),
  };

  return cachedPalette;
}

export function addPendantFixture(
  parent: THREE.Object3D,
  x: number,
  yBar: number,
  yCeil: number,
  z: number,
  len: number,
  pal: RealEstatePalette,
  frameMat: THREE.Material
) {
  boxAt(parent, len, 0.055, 0.12, x, yBar, z, frameMat, false, false, 0.01);
  boxAt(parent, len - 0.08, 0.02, 0.08, x, yBar - 0.032, z, pal.warmCoveLed, false, false);
  const drop = Math.max(0.2, yCeil - yBar);
  [-len * 0.4, len * 0.4].forEach((ox) => {
    cylAt(parent, 0.01, 0.01, drop, x + ox, yBar + drop * 0.5, z, frameMat, false, false, 6);
  });
}

export function addRealEstatePlaque(
  parent: THREE.Object3D,
  title: string,
  x: number,
  y: number,
  z: number,
  rotY = 0
) {
  const tex = makeCanvasTex(`re_plaque_${title}`, 360, 76, (g, w, h) => {
    g.fillStyle = '#141b24';
    rr(g, 2, 2, w - 4, h - 4, 8);
    g.fill();
    g.strokeStyle = '#d4aa62';
    g.lineWidth = 2.5;
    rr(g, 5, 5, w - 10, h - 10, 6);
    g.stroke();
    g.fillStyle = '#d4aa62';
    g.fillRect(16, 16, 6, h - 32);
    g.fillStyle = '#f8fafc';
    g.font = '800 20px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(title, 34, h * 0.5);
  }, true, true);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.42, 0.3),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  parent.add(mesh);
}

/**
 * Multi-tier illuminated architectural 3D masterplan vitrine with stepped terrain,
 * glass-balconied condominiums, pitched villas, pool court & brass vitrine frame.
 */
export function buildMasterplanVitrine(
  parent: THREE.Object3D,
  x: number,
  fy: number,
  z: number,
  w: number,
  d: number,
  variant: 'mixed' | 'towers' | 'villas',
  ctx: RealEstateBuildContext,
  pal: RealEstatePalette
) {
  const { M, archMats, accentMat, terracottaMat } = ctx;
  // Plinth base with recessed bronze shadow reveal
  boxAt(parent, w - 0.1, 0.72, d - 0.1, x, fy + 0.36, z, pal.walnutExec, true, true, 0.035);
  boxAt(parent, w - 0.24, 0.06, d - 0.24, x, fy + 0.03, z, archMats.bronzeMullion, false, true);
  boxAt(parent, w, 0.055, d, x, fy + 0.75, z, pal.brushedBronze, false, true, 0.015);

  const terrainGreen = new THREE.MeshStandardMaterial({ color: 0x5c7f4d, roughness: 0.85 });
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.72 });
  const miniGlass = new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.18, metalness: 0.25 });
  const miniWhite = M.white;

  // Base terrain & miniature estate road grid
  boxAt(parent, w - 0.3, 0.045, d - 0.3, x, fy + 0.79, z, terrainGreen, false, true);
  boxAt(parent, w - 0.42, 0.02, 0.26, x, fy + 0.82, z + 0.1, roadMat, false, false);
  boxAt(parent, 0.24, 0.02, d - 0.42, x - 0.34, fy + 0.82, z, roadMat, false, false);

  const hoodH = variant === 'towers' ? 1.24 : 0.58;
  if (variant === 'towers') {
    const towers: Array<[number, number, number, number, number]> = [
      [-0.95, -0.35, 0.56, 0.94, 0.48],
      [-0.12, 0.28, 0.66, 1.14, 0.52],
      [0.78, -0.25, 0.58, 0.86, 0.48],
      [0.86, 0.48, 0.52, 0.54, 0.42],
    ];
    towers.forEach(([bx, bz, bw, bh, bd], bi) => {
      boxAt(parent, bw, bh, bd, x + bx, fy + 0.82 + bh * 0.5, z + bz, bi === 1 ? miniWhite : miniGlass, true, false, 0.015);
      // Cantilevered architectural balcony bands on miniature towers
      for (let tier = 0.22; tier < bh - 0.1; tier += 0.22) {
        boxAt(parent, bw + 0.07, 0.022, bd + 0.07, x + bx, fy + 0.82 + tier, z + bz, miniWhite, false, false);
      }
      boxAt(parent, bw + 0.04, 0.04, bd + 0.04, x + bx, fy + 0.82 + bh + 0.02, z + bz, accentMat, false, false);
    });
  } else {
    const units: Array<[number, number, number, number, number]> =
      variant === 'mixed'
        ? [
            [-1.05, -0.45, 0.58, 0.72, 0.46],
            [-0.95, 0.52, 0.54, 0.56, 0.42],
            [0.18, -0.48, 0.65, 0.86, 0.48],
            [0.88, -0.42, 0.52, 0.44, 0.44],
            [0.92, 0.48, 0.62, 0.4, 0.46],
          ]
        : [
            [-1.05, -0.45, 0.56, 0.45, 0.44],
            [-0.95, 0.48, 0.56, 0.45, 0.44],
            [0.05, -0.45, 0.62, 0.52, 0.46],
            [0.95, -0.4, 0.54, 0.42, 0.44],
            [0.92, 0.48, 0.62, 0.42, 0.46],
          ];
    units.forEach(([bx, bz, bw, bh, bd], bi) => {
      boxAt(parent, bw, bh, bd, x + bx, fy + 0.82 + bh * 0.5, z + bz, bi === 2 && variant === 'mixed' ? accentMat : miniWhite, true, false, 0.015);
      boxAt(parent, bw - 0.08, bh * 0.55, bd + 0.02, x + bx, fy + 0.82 + bh * 0.5, z + bz, miniGlass, false, false);
      boxAt(parent, bw + 0.06, 0.05, bd + 0.06, x + bx, fy + 0.82 + bh + 0.025, z + bz, terracottaMat, false, false);
    });
    // Miniature turquoise pool & cypress foliage tufts
    boxAt(parent, 0.68, 0.03, 0.4, x + 0.2, fy + 0.83, z + 0.54, new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.35 }), false, false);
  }

  // Vitrine corner bronze posts, glass enclosure & warm top gallery frame
  const vw = w - 0.22;
  const vd = d - 0.22;
  boxAt(parent, vw, hoodH, vd, x, fy + 0.78 + hoodH * 0.5, z, pal.vitrineGlass, false, false);
  [-1, 1].forEach((sx) => {
    [-1, 1].forEach((sz) => {
      boxAt(parent, 0.035, hoodH, 0.035, x + sx * (vw * 0.5), fy + 0.78 + hoodH * 0.5, z + sz * (vd * 0.5), pal.brushedBronze, false, false);
    });
  });
  boxAt(parent, vw + 0.03, 0.035, vd + 0.03, x, fy + 0.78 + hoodH, z, pal.warmCoveLed, false, false);
}
