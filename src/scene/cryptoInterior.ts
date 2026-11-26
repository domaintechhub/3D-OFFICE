import * as THREE from 'three';
import type { ArchitecturalMaterials } from './architecturalForms';
import type { MonitorPickTarget } from './architecture';
import type { DistrictBuildingSpec } from './districtData';
import type { MaterialLibrary } from './materials';
import type { WarmLightAnchor } from './districtBuildings';
import {
  armchair,
  boxAt,
  contact,
  cylAt,
  downlight,
  getRoundedBox,
  plant,
  sofaWide,
} from './props';
import { createCustomBoardScreen, type ScreenRegistry } from './screens';
import { getMaxAnisotropy, makeCanvasTex, rr } from './textures';

export interface BitVaultBuildContext {
  spec: DistrictBuildingSpec;
  levelGroups: THREE.Group[];
  levelCeilings: THREE.Group[];
  M: MaterialLibrary;
  archMats: ArchitecturalMaterials;
  frameDarkMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  glassMat: THREE.Material;
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

interface BitVaultPalette {
  basaltHex: THREE.MeshStandardMaterial;
  verdeOnyx: THREE.MeshStandardMaterial;
  charredAsh: THREE.MeshStandardMaterial;
  champagneTitanium: THREE.MeshStandardMaterial;
  matteGunmetal: THREE.MeshStandardMaterial;
  emeraldFelt: THREE.MeshStandardMaterial;
  obsidianLeather: THREE.MeshStandardMaterial;
  emeraldSmokedGlass: THREE.MeshStandardMaterial;
  dielectricFluid: THREE.MeshStandardMaterial;
  copperCoil: THREE.MeshStandardMaterial;
  emeraldGlow: THREE.MeshBasicMaterial;
  amberGoldGlow: THREE.MeshBasicMaterial;
  warmCove: THREE.MeshBasicMaterial;
  darkAcousticRug: THREE.MeshStandardMaterial;
}

let cachedPalette: BitVaultPalette | null = null;

function getBitVaultPalette(): BitVaultPalette {
  if (cachedPalette) return cachedPalette;

  const aniso = getMaxAnisotropy();

  // 1. Hexagonal Basalt Crystallographic Floor Tile with Champagne-Titanium Micro-Grout
  const hexTex = makeCanvasTex('bitvault_basalt_hex', 512, 512, (g, W, H) => {
    g.fillStyle = '#14181e';
    g.fillRect(0, 0, W, H);
    const rad = 32;
    const dx = rad * 1.5;
    const dy = rad * Math.sqrt(3);
    for (let col = -1; col <= Math.ceil(W / dx) + 1; col++) {
      for (let row = -1; row <= Math.ceil(H / dy) + 1; row++) {
        const cx = col * dx;
        const cy = row * dy + (col % 2 === 0 ? 0 : dy * 0.5);
        const tone = 20 + ((col * 17 + row * 31) & 11);
        g.fillStyle = `rgb(${tone},${tone + 4},${tone + 9})`;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const px = cx + Math.cos(a) * (rad - 1.5);
          const py = cy + Math.sin(a) * (rad - 1.5);
          if (k === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fill();
        g.strokeStyle = ((col + row) % 7 === 0) ? 'rgba(16, 185, 129, 0.24)' : 'rgba(205, 184, 142, 0.16)';
        g.lineWidth = 1.4;
        g.stroke();
      }
    }
  });
  hexTex.colorSpace = THREE.SRGBColorSpace;
  hexTex.wrapS = hexTex.wrapT = THREE.RepeatWrapping;
  hexTex.repeat.set(5.5, 5.0);
  hexTex.anisotropy = aniso;

  // 2. Emerald-Veined Dark Verde Marble / Jade Onyx Stone
  const onyxTex = makeCanvasTex('bitvault_verde_onyx', 512, 512, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0c241d');
    grad.addColorStop(0.5, '#123329');
    grad.addColorStop(1, '#091a15');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // Cloudy jade mineral pools
    for (let i = 0; i < 16; i++) {
      const rx = ((Math.sin(i * 19.7 + 1.3) * 43758.5) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 41.3 + 2.9) * 29431.2) % 1 + 1) % 1;
      const rad = 45 + (i % 5) * 22;
      const rg = g.createRadialGradient(rx * W, ry * H, 4, rx * W, ry * H, rad);
      rg.addColorStop(0, i % 3 === 0 ? 'rgba(42, 146, 108, 0.16)' : 'rgba(18, 84, 62, 0.22)');
      rg.addColorStop(1, 'rgba(9, 26, 21, 0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(rx * W, ry * H, rad, 0, Math.PI * 2);
      g.fill();
    }

    // Fine white-jade & champagne-gold mineral veins
    for (let v = 0; v < 18; v++) {
      g.strokeStyle = v % 4 === 0 ? 'rgba(218, 194, 142, 0.34)' : 'rgba(154, 234, 198, 0.28)';
      g.lineWidth = v % 4 === 0 ? 1.5 : 1.0;
      g.beginPath();
      let px = 0;
      let py = ((v * 67) % H);
      g.moveTo(px, py);
      for (let s = 1; s <= 8; s++) {
        px = (s / 8) * W;
        py += Math.sin(v * 2.1 + s * 1.4) * 34;
        g.lineTo(px, py);
      }
      g.stroke();
    }
  });
  onyxTex.colorSpace = THREE.SRGBColorSpace;
  onyxTex.wrapS = onyxTex.wrapT = THREE.RepeatWrapping;
  onyxTex.repeat.set(1.6, 1.6);
  onyxTex.anisotropy = aniso;

  // 3. Fluted Charred Black-Ash Architectural Wood Slatting
  const ashTex = makeCanvasTex('bitvault_charred_ash', 256, 256, (g, W, H) => {
    g.fillStyle = '#181617';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 12) {
      g.fillStyle = '#242021';
      g.fillRect(x + 2, 0, 8, H);
      g.fillStyle = '#0e0d0e';
      g.fillRect(x, 0, 2, H);
      g.fillStyle = 'rgba(210, 190, 155, 0.08)';
      g.fillRect(x + 3, 0, 2, H);
    }
  });
  ashTex.colorSpace = THREE.SRGBColorSpace;
  ashTex.wrapS = ashTex.wrapT = THREE.RepeatWrapping;
  ashTex.repeat.set(3.0, 2.0);
  ashTex.anisotropy = aniso;

  // 4. Acoustic Charcoal-Emerald Woven Wool Carpet
  const rugTex = makeCanvasTex('bitvault_acoustic_rug', 256, 256, (g, W, H) => {
    g.fillStyle = '#10221d';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(16, 185, 129, 0.14)';
    g.lineWidth = 1;
    for (let i = -H; i < W + H; i += 14) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + H, H);
      g.stroke();
    }
  });
  rugTex.colorSpace = THREE.SRGBColorSpace;
  rugTex.wrapS = rugTex.wrapT = THREE.RepeatWrapping;
  rugTex.repeat.set(4, 3);
  rugTex.anisotropy = aniso;

  cachedPalette = {
    basaltHex: new THREE.MeshStandardMaterial({
      map: hexTex,
      roughness: 0.42,
      metalness: 0.14,
      envMapIntensity: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    verdeOnyx: new THREE.MeshStandardMaterial({
      map: onyxTex,
      roughness: 0.18,
      metalness: 0.1,
      envMapIntensity: 0.82,
    }),
    charredAsh: new THREE.MeshStandardMaterial({
      map: ashTex,
      roughness: 0.56,
      metalness: 0.06,
      envMapIntensity: 0.34,
    }),
    champagneTitanium: new THREE.MeshStandardMaterial({
      color: 0xcab693,
      roughness: 0.28,
      metalness: 0.86,
      envMapIntensity: 0.92,
    }),
    matteGunmetal: new THREE.MeshStandardMaterial({
      color: 0x1b2028,
      roughness: 0.44,
      metalness: 0.68,
      envMapIntensity: 0.62,
    }),
    emeraldFelt: new THREE.MeshStandardMaterial({
      color: 0x0f3b2e,
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: 0.22,
    }),
    obsidianLeather: new THREE.MeshStandardMaterial({
      color: 0x181b20,
      roughness: 0.46,
      metalness: 0.08,
      envMapIntensity: 0.44,
    }),
    emeraldSmokedGlass: new THREE.MeshStandardMaterial({
      color: 0x8ad9be,
      roughness: 0.09,
      metalness: 0.12,
      transparent: true,
      opacity: 0.36,
      envMapIntensity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    dielectricFluid: new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      emissiveIntensity: 0.28,
      roughness: 0.07,
      metalness: 0.08,
      transparent: true,
      opacity: 0.42,
      envMapIntensity: 0.98,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    copperCoil: new THREE.MeshStandardMaterial({
      color: 0xb87333,
      roughness: 0.26,
      metalness: 0.88,
      envMapIntensity: 0.9,
    }),
    emeraldGlow: new THREE.MeshBasicMaterial({ color: 0x34d399 }),
    amberGoldGlow: new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    warmCove: new THREE.MeshBasicMaterial({ color: 0xfef3c7 }),
    darkAcousticRug: new THREE.MeshStandardMaterial({
      map: rugTex,
      roughness: 0.9,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  };

  return cachedPalette;
}

/**
 * Helper to create etched champagne-titanium & emerald architectural zone signage plaques
 */
function addCryptoPlaque(
  parent: THREE.Object3D,
  text: string,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  width = 2.5,
  sub = 'BITVAULT EXCHANGE'
) {
  const tex = makeCanvasTex(`bv_plaque_${text}_${sub}`, 512, 128, (g, W, H) => {
    g.fillStyle = '#0c1118';
    rr(g, 6, 6, W - 12, H - 12, 12);
    g.fill();
    g.strokeStyle = '#cab693';
    g.lineWidth = 3;
    rr(g, 8, 8, W - 16, H - 16, 10);
    g.stroke();
    g.fillStyle = '#10b981';
    g.fillRect(24, 24, 6, H - 48);
    g.fillStyle = '#a7f3d0';
    g.font = '700 18px "IBM Plex Mono", monospace';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(sub, 44, 42);
    g.fillStyle = '#f8fafc';
    g.font = '800 32px "Plus Jakarta Sans", sans-serif';
    g.fillText(text, 44, 84);
  }, true, true);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = getMaxAnisotropy();

  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;
  boxAt(grp, width + 0.08, width * 0.25 + 0.06, 0.04, 0, 0, -0.02, getBitVaultPalette().matteGunmetal, true, false);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * 0.25),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  face.position.z = 0.005;
  grp.add(face);
  parent.add(grp);
}

/**
 * Custom BitVault sculpted architectural desk (chamfered charred ash deck, verde-onyx modesty screen, champagne-bronze legs)
 */
function buildCryptoPodDesk(
  parent: THREE.Object3D,
  x: number,
  fy: number,
  z: number,
  w: number,
  d: number,
  rotY: number,
  pal: BitVaultPalette,
  accentMat: THREE.Material
) {
  const g = new THREE.Group();
  g.position.set(x, fy, z);
  g.rotation.y = rotY;
  // Sculpted cantilevered desk deck
  boxAt(g, w, 0.065, d, 0, 0.745, 0, pal.charredAsh, true, true, 0.02);
  // Subtle emerald hairline edge strip on front visitor side
  boxAt(g, w - 0.16, 0.018, 0.02, 0, 0.745, -d * 0.5 - 0.004, accentMat, false, false);
  // Faceted Verde-Onyx front privacy fascia
  boxAt(g, w - 0.24, 0.62, 0.08, 0, 0.4, -d * 0.34, pal.verdeOnyx, true, true, 0.015);
  // Twin splayed champagne-titanium cantilever legs
  [-w * 0.41, w * 0.41].forEach((lx) => {
    boxAt(g, 0.075, 0.72, d * 0.72, lx, 0.36, 0.04, pal.champagneTitanium, true, true, 0.015);
  });
  parent.add(g);
}

/**
 * Bespoke Hexagonal & Linear Champagne-Bronze Acoustic Ceiling Coffer System (Zero generic bars)
 */
function buildBitVaultCeilingCoffers(
  cg: THREE.Group,
  cx: number,
  ceilY: number,
  cz: number,
  pal: BitVaultPalette,
  M: MaterialLibrary
) {
  const yBaffle = ceilY - 0.16;
  // Longitudinal sculpted acoustic ash ribs (West half & SE zone, avoiding NE stair void [+4.35..+10.65, -9.65..-2.45])
  [-7.2, -3.6, 0.2].forEach((ox) => {
    boxAt(cg, 0.14, 0.18, 16.8, cx + ox, yBaffle, cz, pal.charredAsh, false, false, 0.01);
  });
  // East-wing ribs stop cleanly south of stair void (dz +0.2 .. +8.4)
  [4.8, 8.0].forEach((ox) => {
    boxAt(cg, 0.14, 0.18, 8.2, cx + ox, yBaffle, cz + 4.3, pal.charredAsh, false, false, 0.01);
  });

  // Hexagonal Champagne-Titanium Suspended Halo Chandeliers (3 architectural nodes)
  const hexCenters: Array<[number, number, number]> = [
    [cx - 4.4, cz - 4.2, 1.55],
    [cx - 4.4, cz + 3.8, 1.55],
    [cx + 5.8, cz + 4.4, 1.35],
  ];
  hexCenters.forEach(([hx, hz, rad]) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(rad, 0.042, 8, 6),
      pal.champagneTitanium
    );
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = Math.PI / 6;
    ring.position.set(hx, yBaffle - 0.04, hz);
    cg.add(ring);

    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(rad - 0.055, 0.018, 6, 6),
      pal.warmCove
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.rotation.z = Math.PI / 6;
    glowRing.position.set(hx, yBaffle - 0.06, hz);
    cg.add(glowRing);

    downlight(cg, hx, ceilY - 0.08, hz, M, 0.14);
  });

  // Architectural recessed perimeter downlights
  [
    [-8.4, -7.2],
    [-8.4, 0.0],
    [-8.4, 7.2],
    [0.0, 6.8],
    [7.4, 7.2],
  ].forEach(([dx, dz]) => {
    downlight(cg, cx + dx, ceilY - 0.08, cz + dz, M, 0.13);
  });
}

/**
 * Quarter-Turn Cantilevered Gallery Staircase (G->L1, L1->L2, L2->L3, L3->L4) + 5-Story Merkle Genesis Pillar
 */
function buildQuarterTurnGalleryStairAndMerkleCore(
  ctx: BitVaultBuildContext,
  lv: number,
  pal: BitVaultPalette
) {
  const { spec, levelGroups, rotatingProps, accentMat } = ctx;
  const g = levelGroups[lv];
  const fy = spec.groundY + lv * spec.floorH + 0.12;
  const cx = spec.cx;
  const cz = spec.cz;
  const halfRise = spec.floorH * 0.5; // 2.10m

  // -----------------------------------------------------------------------
  // 1. 5-Story Illuminated "Merkle Genesis" Cryo-Quartz Pillar & Astrolabe (at dx +6.38, dz -4.82)
  // -----------------------------------------------------------------------
  const mx = cx + 6.38;
  const mz = cz - 4.82;

  if (lv === 0) {
    // Ground octagonal Verde-Onyx reflection pool & emitter base
    cylAt(g, 1.56, 1.66, 0.28, mx, fy + 0.14, mz, pal.verdeOnyx, true, true, 8);
    cylAt(g, 1.24, 1.24, 0.04, mx, fy + 0.29, mz, pal.dielectricFluid, false, false, 8);
    const baseHalo = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.032, 8, 8), pal.emeraldGlow);
    baseHalo.rotation.x = Math.PI / 2;
    baseHalo.position.set(mx, fy + 0.32, mz);
    g.add(baseHalo);
  }

  // Per-floor continuous cryo-glass pillar core + 3 vertical emerald optical fins
  const coreH = spec.floorH - 0.18;
  const coreMidY = fy + spec.floorH * 0.5;
  cylAt(g, 0.24, 0.24, coreH, mx, coreMidY, mz, pal.emeraldSmokedGlass, false, false, 12);
  cylAt(g, 0.08, 0.08, coreH, mx, coreMidY, mz, pal.emeraldGlow, false, false, 8);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + lv * 0.35;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, coreH - 0.1, 0.36), pal.champagneTitanium);
    fin.position.set(mx + Math.cos(a) * 0.24, coreMidY, mz + Math.sin(a) * 0.24);
    fin.rotation.y = -a + Math.PI / 2;
    g.add(fin);
  }

  // Slowly counter-rotating octagonal Merkle Hash Astrolabe ring suspended in each floor stratum
  const astro = new THREE.Group();
  astro.position.set(mx, fy + spec.floorH * 0.62, mz);
  const outerOct = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.028, 8, 8), pal.champagneTitanium);
  outerOct.rotation.x = Math.PI * 0.36 * (lv % 2 === 0 ? 1 : -1);
  astro.add(outerOct);
  const innerOct = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.018, 6, 8), accentMat);
  innerOct.rotation.x = -Math.PI * 0.28;
  innerOct.rotation.z = 0.4;
  astro.add(innerOct);
  g.add(astro);
  rotatingProps.push({ obj: astro, speed: lv % 2 === 0 ? 0.34 : -0.34, axis: 'y' });

  // -----------------------------------------------------------------------
  // 2. Perimeter Void Guardrails & Portal Frames (lv = 0..4)
  // -----------------------------------------------------------------------
  if (lv === 0) {
    // Under-stair / Merkle Void smoked-emerald acoustic screen on West side (dx +3.82)
    boxAt(g, 0.06, 3.88, 7.12, cx + 3.82, fy + 1.94, cz - 6.02, pal.emeraldSmokedGlass, false, false);
    boxAt(g, 0.14, 0.14, 7.18, cx + 3.82, fy + 0.07, cz - 6.02, pal.champagneTitanium, true, true);
    boxAt(g, 0.14, 0.14, 7.18, cx + 3.82, fy + 3.88, cz - 6.02, pal.champagneTitanium, false, false);
    // South Merkle Void front glass shield (dx +3.82 .. +8.40 at dz -2.45)
    boxAt(g, 4.55, 1.15, 0.06, cx + 6.12, fy + 0.58, cz - 2.45, pal.emeraldSmokedGlass, false, false);
    boxAt(g, 4.62, 0.06, 0.1, cx + 6.12, fy + 1.16, cz - 2.45, pal.champagneTitanium, false, false);
    // Sculpted Champagne-Titanium Entrance Portal framing Stair Flight 1 Mouth (dx +8.45 .. +10.55 at dz -2.45)
    boxAt(g, 0.14, 3.3, 0.16, cx + 8.42, fy + 1.65, cz - 2.45, pal.champagneTitanium, true, false, 0.02);
    boxAt(g, 0.14, 3.3, 0.16, cx + 10.55, fy + 1.65, cz - 2.45, pal.champagneTitanium, true, false, 0.02);
    boxAt(g, 2.25, 0.16, 0.2, cx + 9.48, fy + 3.32, cz - 2.45, pal.matteGunmetal, true, false, 0.02);
    addCryptoPlaque(g, 'GALLERY STAIR · L1–L4', cx + 9.48, fy + 3.04, cz - 2.34, 0, 1.95, 'ASCENT CORE');
  } else {
    // Upper level safety glass balustrades (West Merkle Void edge + South Void edge)
    boxAt(g, 0.055, 1.04, 4.74, cx + 4.35, fy + 0.52, cz - 4.82, pal.emeraldSmokedGlass, false, false);
    boxAt(g, 0.09, 0.05, 4.78, cx + 4.35, fy + 1.05, cz - 4.82, pal.champagneTitanium, false, false);

    if (lv < spec.floors - 1) {
      // L1..L3: South Merkle Void guardrail stops at dx +8.40, keeping dx +8.45..+10.55 open to climb next flight
      boxAt(g, 4.05, 1.04, 0.055, cx + 6.38, fy + 0.52, cz - 2.45, pal.emeraldSmokedGlass, false, false);
      boxAt(g, 4.1, 0.05, 0.09, cx + 6.38, fy + 1.05, cz - 2.45, pal.champagneTitanium, false, false);
      // Stanchions framing Flight 1 up-portal
      boxAt(g, 0.12, 2.6, 0.14, cx + 8.42, fy + 1.3, cz - 2.45, pal.champagneTitanium, true, false);
      boxAt(g, 0.12, 2.6, 0.14, cx + 10.55, fy + 1.3, cz - 2.45, pal.champagneTitanium, true, false);
    } else {
      // L4 Penthouse: Full closed glass balustrade across South edge & inner East arrival drop edge
      boxAt(g, 6.22, 1.04, 0.055, cx + 7.46, fy + 0.52, cz - 2.45, pal.emeraldSmokedGlass, false, false);
      boxAt(g, 6.26, 0.05, 0.09, cx + 7.46, fy + 1.05, cz - 2.45, pal.champagneTitanium, false, false);
      boxAt(g, 0.055, 1.04, 4.78, cx + 8.36, fy + 0.52, cz - 4.84, pal.emeraldSmokedGlass, false, false);
      boxAt(g, 0.09, 0.05, 4.82, cx + 8.36, fy + 1.05, cz - 4.84, pal.champagneTitanium, false, false);
    }
  }

  // -----------------------------------------------------------------------
  // 3. Cantilevered Quarter-Turn Floating Treads (lv = 0..3)
  // -----------------------------------------------------------------------
  if (lv >= spec.floors - 1) return;

  // Flight 1 (Lower Half-Rise 0 -> +2.10m): South (dz -2.55) -> North (dz -7.25) along dx = +9.50
  const steps1 = 10;
  const f1X = cx + 9.5;
  const f1Z0 = cz - 2.68;
  const f1Z1 = cz - 7.05;
  const f1Len = Math.hypot(f1Z0 - f1Z1, halfRise);
  const f1Ang = Math.atan2(halfRise, f1Z0 - f1Z1);
  // Central dark gunmetal spine beam under Flight 1
  const f1Spine = new THREE.Mesh(getRoundedBox(0.28, 0.24, f1Len, 0.02, 2), pal.matteGunmetal);
  f1Spine.position.set(f1X, fy + halfRise * 0.5 - 0.14, (f1Z0 + f1Z1) * 0.5);
  f1Spine.rotation.x = f1Ang;
  f1Spine.castShadow = true;
  g.add(f1Spine);

  for (let i = 0; i < steps1; i++) {
    const t = (i + 0.5) / steps1;
    const sz = f1Z0 + (f1Z1 - f1Z0) * t;
    const sy = fy + t * halfRise;
    boxAt(g, 2.02, 0.09, 0.44, f1X, sy - 0.02, sz, pal.basaltHex, true, true, 0.015);
    boxAt(g, 2.04, 0.024, 0.04, f1X, sy + 0.02, sz + 0.2, pal.champagneTitanium, false, false);
    boxAt(g, 1.82, 0.012, 0.02, f1X, sy - 0.068, sz + 0.12, accentMat, false, false);
  }
  // Inner inclined smoked-glass balustrade along Flight 1 West edge (dx +8.38)
  const f1Rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.02, f1Len), pal.emeraldSmokedGlass);
  f1Rail.position.set(cx + 8.38, fy + halfRise * 0.5 + 0.52, (f1Z0 + f1Z1) * 0.5);
  f1Rail.rotation.x = f1Ang;
  g.add(f1Rail);
  const f1TopRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, f1Len + 0.12), pal.champagneTitanium);
  f1TopRail.position.set(cx + 8.38, fy + halfRise * 0.5 + 1.04, (f1Z0 + f1Z1) * 0.5);
  f1TopRail.rotation.x = f1Ang;
  g.add(f1TopRail);

  // NE Corner Floating Mid-Landing (+2.10m) at (dx +9.50, dz -8.40)
  boxAt(g, 2.12, 0.18, 2.3, cx + 9.5, fy + halfRise - 0.09, cz - 8.4, pal.matteGunmetal, true, true, 0.02);
  boxAt(g, 2.04, 0.04, 2.22, cx + 9.5, fy + halfRise + 0.01, cz - 8.4, pal.verdeOnyx, false, true, 0.01);

  // Flight 2 (Upper Half-Rise +2.10m -> +4.20m): East (dx +8.24) -> West (dx +4.46) along dz = -8.40
  const steps2 = 10;
  const f2Z = cz - 8.4;
  const f2X0 = cx + 8.24;
  const f2X1 = cx + 4.46;
  const f2Len = Math.hypot(f2X0 - f2X1, halfRise);
  const f2Ang = Math.atan2(halfRise, f2X0 - f2X1);
  const f2Spine = new THREE.Mesh(getRoundedBox(f2Len, 0.24, 0.28, 0.02, 2), pal.matteGunmetal);
  f2Spine.position.set((f2X0 + f2X1) * 0.5, fy + halfRise * 1.5 - 0.14, f2Z);
  f2Spine.rotation.z = -f2Ang;
  f2Spine.castShadow = true;
  g.add(f2Spine);

  for (let i = 0; i < steps2; i++) {
    const t = (i + 0.5) / steps2;
    const sx = f2X0 + (f2X1 - f2X0) * t;
    const sy = fy + halfRise + t * halfRise;
    boxAt(g, 0.4, 0.09, 2.22, sx, sy - 0.02, f2Z, pal.basaltHex, true, true, 0.015);
    boxAt(g, 0.04, 0.024, 2.24, sx + 0.18, sy + 0.02, f2Z, pal.champagneTitanium, false, false);
    boxAt(g, 0.02, 0.012, 1.96, sx + 0.1, sy - 0.068, f2Z, accentMat, false, false);
  }
  // Inner inclined smoked-glass balustrade along Flight 2 South edge (dz -7.20)
  const f2Rail = new THREE.Mesh(new THREE.BoxGeometry(f2Len, 1.02, 0.05), pal.emeraldSmokedGlass);
  f2Rail.position.set((f2X0 + f2X1) * 0.5, fy + halfRise * 1.5 + 0.52, cz - 7.2);
  f2Rail.rotation.z = -f2Ang;
  g.add(f2Rail);
  const f2TopRail = new THREE.Mesh(new THREE.BoxGeometry(f2Len + 0.12, 0.05, 0.08), pal.champagneTitanium);
  f2TopRail.position.set((f2X0 + f2X1) * 0.5, fy + halfRise * 1.5 + 1.04, cz - 7.2);
  f2TopRail.rotation.z = -f2Ang;
  g.add(f2TopRail);
}

/**
 * Full 5-Level TerraCraft Interior Design for BitVault Crypto Exchange (`crypto`, G..L4)
 */
export function buildBitVaultWholeBuilding(ctx: BitVaultBuildContext) {
  const {
    spec,
    levelGroups,
    levelCeilings,
    M,
    archMats,
    frameDarkMat,
    accentMat,
    screenReg,
    registerChair,
    registerMonitor,
    pickMeshes,
    rotatingProps,
    warmLights,
  } = ctx;

  const pal = getBitVaultPalette();
  const cx = spec.cx;
  const cz = spec.cz;

  // Build bespoke ceiling coffers, Quarter-Turn Gallery Stairs & Merkle Pillar modules across G..L4
  for (let lv = 0; lv < spec.floors; lv++) {
    const yFloor = spec.groundY + lv * spec.floorH;
    const ceilY = yFloor + spec.floorH - 0.14;
    buildBitVaultCeilingCoffers(levelCeilings[lv], cx, ceilY, cz, pal, M);
    buildQuarterTurnGalleryStairAndMerkleCore(ctx, lv, pal);
  }

  // Register emerald architectural fill light anchors on L1..L4
  for (let lv = 1; lv < spec.floors; lv++) {
    const fy = spec.groundY + lv * spec.floorH + 0.12;
    warmLights.push({
      x: cx - 2.2,
      y: fy + 3.15,
      z: cz + 0.6,
      color: 0xe6fff5,
      distance: spec.w + 8,
      baseScale: 1.04,
      floor: lv,
      buildingId: spec.id,
    });
  }

  // =========================================================================
  // DYNAMIC CANVAS SCREENS (Custom Per-Floor Cryptographic Visualizations)
  // =========================================================================
  const orderbookScreen = createCustomBoardScreen(screenReg, 680, 240, (g, w, h, t) => {
    g.fillStyle = '#060a10';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0c231c';
    g.fillRect(0, 0, w, 36);
    g.fillStyle = '#10b981';
    g.fillRect(0, 0, 10, 36);
    g.fillStyle = '#ecfdf5';
    g.font = '800 16px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('BITVAULT EXCHANGE · ORDERBOOK DEPTH & MPC QUORUM', 20, 18);
    for (let i = 0; i < 6; i++) {
      const bidW = 95 + Math.abs(Math.sin(t + i * 0.7)) * 155;
      const askW = 85 + Math.abs(Math.cos(t * 1.15 + i * 0.6)) * 150;
      const y = 52 + i * 28;
      g.fillStyle = 'rgba(16,185,129,0.28)';
      g.fillRect(300 - bidW, y, bidW, 21);
      g.fillStyle = 'rgba(239,68,68,0.28)';
      g.fillRect(380, y, askW, 21);
      g.fillStyle = '#6ee7b7';
      g.font = '700 13px monospace';
      g.fillText(`$${(94280 - i * 15).toLocaleString()}`, 26, y + 11);
      g.fillStyle = '#fca5a5';
      g.fillText(`$${(94295 + i * 15).toLocaleString()}`, w - 122, y + 11);
    }
  });

  const immersionScreen = createCustomBoardScreen(screenReg, 560, 220, (g, w, h, t) => {
    g.fillStyle = '#070c12';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0d2620';
    g.fillRect(0, 0, w, 34);
    g.fillStyle = '#10b981';
    g.fillRect(0, 0, 8, 34);
    g.fillStyle = '#f8fafc';
    g.font = '800 15px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('CRYO-IMMERSION ASIC ARRAY · DIELECTRIC COOLING TELEMETRY', 18, 17);
    const tanks = [
      ['TANK ALPHA', '34.2°C', '1.42 EH/s', '99.8% PUE 1.03'],
      ['TANK BETA', '33.8°C', '1.38 EH/s', '99.9% PUE 1.02'],
    ];
    tanks.forEach((tk, ti) => {
      const y = 52 + ti * 78;
      g.fillStyle = '#101c26';
      rr(g, 18, y, w - 36, 64, 8);
      g.fill();
      g.fillStyle = '#6ee7b7';
      g.font = '800 15px monospace';
      g.fillText(tk[0], 34, y + 22);
      g.fillStyle = '#fbbf24';
      g.fillText(tk[1], 190, y + 22);
      g.fillStyle = '#e2e8f0';
      g.fillText(tk[2], 310, y + 22);
      g.fillStyle = '#34d399';
      g.font = '600 13px sans-serif';
      g.fillText(tk[3], 34, y + 46);
      const pulseW = 120 + Math.sin(t * 2 + ti) * 28;
      g.fillStyle = 'rgba(16,185,129,0.35)';
      g.fillRect(310, y + 38, pulseW, 12);
    });
  });

  const otcLiquidityScreen = createCustomBoardScreen(screenReg, 640, 240, (g, w, h, t) => {
    g.fillStyle = '#070b11';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#122622';
    g.fillRect(0, 0, w, 36);
    g.fillStyle = '#cab693';
    g.fillRect(0, 0, 8, 36);
    g.fillStyle = '#f8fafc';
    g.font = '800 16px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('INSTITUTIONAL OTC DESK · CROSS-BORDER LIQUIDITY CORRIDORS', 18, 18);
    const corridors = [
      ['KES / USDT', '129.45', '+$14.8M Vol', 'Instant M-Pesa / RTGS'],
      ['BTC / USD', '$94,280', '+$42.1M Block', 'T+0 Prime Custody'],
      ['ETH / EUR', '€3,142', '+$18.6M Vol', 'SEPA Instant Rail'],
      ['SOL / USDC', '$198.40', '+$9.4M Vol', 'Low-Slippage RFQ'],
    ];
    corridors.forEach((c, ci) => {
      const y = 52 + ci * 44;
      g.fillStyle = ci === Math.floor(t * 0.7) % 4 ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.05)';
      rr(g, 18, y, w - 36, 36, 6);
      g.fill();
      g.fillStyle = '#f8fafc';
      g.font = '800 14px monospace';
      g.fillText(c[0], 30, y + 18);
      g.fillStyle = '#6ee7b7';
      g.fillText(c[1], 185, y + 18);
      g.fillStyle = '#fde68a';
      g.fillText(c[2], 305, y + 18);
      g.fillStyle = '#94a3b8';
      g.font = '600 13px sans-serif';
      g.fillText(c[3], 455, y + 18);
    });
  });

  const zkTheaterScreen = createCustomBoardScreen(screenReg, 720, 240, (g, w, h, t) => {
    g.fillStyle = '#060a0f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0d261f';
    g.fillRect(0, 0, w, 36);
    g.fillStyle = '#10b981';
    g.fillRect(0, 0, 10, 36);
    g.fillStyle = '#ffffff';
    g.font = '800 16px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('ZERO-KNOWLEDGE PROOF OF RESERVES · LIVE MERKLE & VALIDATOR TREE', 20, 18);

    // Animated Merkle Tree visualization on left
    const rootX = 180;
    const rootY = 64;
    const lvl1 = [110, 250];
    const lvl2 = [75, 145, 215, 285];
    g.strokeStyle = 'rgba(16, 185, 129, 0.55)';
    g.lineWidth = 2;
    lvl1.forEach((nx, i) => {
      g.beginPath();
      g.moveTo(rootX, rootY);
      g.lineTo(nx, 122);
      g.stroke();
      g.beginPath();
      g.moveTo(nx, 122);
      g.lineTo(lvl2[i * 2], 184);
      g.stroke();
      g.beginPath();
      g.moveTo(nx, 122);
      g.lineTo(lvl2[i * 2 + 1], 184);
      g.stroke();
    });
    const pulseIdx = Math.floor(t * 2) % 4;
    g.fillStyle = '#fbbf24';
    g.beginPath();
    g.arc(rootX, rootY, 10, 0, Math.PI * 2);
    g.fill();
    lvl1.forEach((nx) => {
      g.fillStyle = '#10b981';
      g.beginPath();
      g.arc(nx, 122, 8, 0, Math.PI * 2);
      g.fill();
    });
    lvl2.forEach((nx, li) => {
      g.fillStyle = li === pulseIdx ? '#fbbf24' : '#34d399';
      g.beginPath();
      g.arc(nx, 184, 7, 0, Math.PI * 2);
      g.fill();
    });

    // Right column attestations
    g.fillStyle = '#0f1c24';
    rr(g, 355, 52, 345, 170, 8);
    g.fill();
    g.fillStyle = '#a7f3d0';
    g.font = '700 13px monospace';
    g.fillText('MERKLE ROOT: 0x9F4B...E81C VERIFIED', 375, 80);
    g.fillStyle = '#f8fafc';
    g.fillText('SOLVENCY RATIO: 104.6% BACKED', 375, 114);
    g.fillText('VALIDATORS ONLINE: 64 / 64 (14ms)', 375, 148);
    g.fillStyle = '#fbbf24';
    g.fillText('STARK PROOF: 0.42s GENERATED', 375, 182);
  });

  const govTreasuryScreen = createCustomBoardScreen(screenReg, 560, 220, (g, w, h, t) => {
    g.fillStyle = '#080c12';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#142620';
    g.fillRect(0, 0, w, 34);
    g.fillStyle = '#cab693';
    g.fillRect(0, 0, 8, 34);
    g.fillStyle = '#f8fafc';
    g.font = '800 15px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('SOVEREIGN GOVERNANCE · PROTOCOL TREASURY & QUORUM', 18, 17);
    const items = [
      ['RESERVE AUM', '$2.84B Cold', 'Multi-Region MPC'],
      ['EAST AFRICA RAIL', '412K Tx/Day', '99.99% Settlement'],
      ['GOVERNANCE VOTE', 'BIP-48 Passed', '6 / 7 Quorum Signed'],
    ];
    items.forEach((it, idx) => {
      const y = 52 + idx * 54;
      g.fillStyle = '#111b24';
      rr(g, 18, y, w - 36, 44, 6);
      g.fill();
      g.fillStyle = '#cab693';
      g.font = '700 13px sans-serif';
      g.fillText(it[0], 30, y + 22);
      g.fillStyle = '#6ee7b7';
      g.font = '800 16px monospace';
      g.fillText(it[1], 210, y + 22);
      g.fillStyle = '#cbd5e1';
      g.font = '600 12px sans-serif';
      g.fillText(it[2], 385, y + 22);
    });
    void t;
  });

  // =========================================================================
  // LEVEL 0 (G): SOVEREIGN EXCHANGE ATRIUM, CRYO-VAULT POD & QUANT HALL
  // =========================================================================
  const g0 = levelGroups[0];
  const fy0 = spec.groundY + 0.12;

  // Hexagonal basalt floor plane + entrance octagonal Verde-Onyx medallion
  boxAt(g0, 21.5, 0.018, 19.5, cx, fy0 + 0.009, cz, pal.basaltHex, false, true);
  cylAt(g0, 2.3, 2.3, 0.022, cx, fy0 + 0.014, cz + 5.4, pal.verdeOnyx, false, true, 8);
  const entryRing = new THREE.Mesh(new THREE.RingGeometry(2.22, 2.38, 8), pal.champagneTitanium);
  entryRing.rotation.x = -Math.PI / 2;
  entryRing.position.set(cx, fy0 + 0.028, cz + 5.4);
  g0.add(entryRing);

  // Exterior Live Market Ticker mounted above South balcony (elevated with champagne-titanium housing)
  const ticker = createCustomBoardScreen(screenReg, 960, 128, (g, w, h, t) => {
    g.fillStyle = '#060a10';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#10b981';
    g.fillRect(0, 0, w, 4);
    g.fillStyle = '#cab693';
    g.fillRect(0, h - 4, w, 4);
    const text =
      'BTC/USDT $94,280 ▲ +3.4%   ·   ETH/USDT $3,415 ▲ +2.2%   ·   SOL/USDT $198.40 ▲ +5.6%   ·   USDT/KES 129.45   ·   COLD VAULT 5/7 MPC SEALED   ·   ';
    g.font = '800 38px "IBM Plex Mono", monospace';
    g.textBaseline = 'middle';
    const offset = (t * 70) % 1400;
    g.fillStyle = '#6ee7b7';
    g.fillText(text + text, 20 - offset, h / 2);
  });
  boxAt(g0, 16.4, 1.24, 0.22, cx, spec.groundY + spec.floorH * 2 + 0.12, cz + spec.d * 0.5 + 1.28, frameDarkMat, true, false, 0.04);
  boxAt(g0, 16.56, 0.08, 0.28, cx, spec.groundY + spec.floorH * 2 + 0.76, cz + spec.d * 0.5 + 1.28, pal.champagneTitanium, false, false);
  [-5.8, 5.8].forEach((bx) => {
    boxAt(g0, 0.22, 0.26, 0.65, cx + bx, spec.groundY + spec.floorH * 2 + 0.04, cz + spec.d * 0.5 + 0.98, pal.champagneTitanium, true, false);
  });
  const tkMesh = new THREE.Mesh(new THREE.PlaneGeometry(16.0, 1.06), ticker.mat);
  tkMesh.position.set(cx, spec.groundY + spec.floorH * 2 + 0.12, cz + spec.d * 0.5 + 1.4);
  g0.add(tkMesh);
  ticker.setMesh(tkMesh);

  // Central Biometric Cold-Storage MPC Vault Pavilion (at cx, cz - 5.1)
  const vx = cx;
  const vz = cz - 5.1;
  boxAt(g0, 4.4, 0.16, 3.4, vx, fy0 + 0.08, vz, pal.verdeOnyx, true, true, 0.04);
  boxAt(g0, 4.18, 2.95, 3.16, vx, fy0 + 1.62, vz, pal.emeraldSmokedGlass, false, false);
  boxAt(g0, 4.48, 0.18, 3.48, vx, fy0 + 3.14, vz, pal.matteGunmetal, true, false, 0.04);
  boxAt(g0, 4.54, 0.05, 3.54, vx, fy0 + 3.24, vz, pal.champagneTitanium, false, false);
  // Corner titanium vault mullions
  [-2.05, 2.05].forEach((ox) => {
    [-1.52, 1.52].forEach((oz) => {
      boxAt(g0, 0.12, 3.04, 0.12, vx + ox, fy0 + 1.6, vz + oz, pal.champagneTitanium, true, false);
    });
  });
  // 3 Air-Gapped HSM Key-Signing Monolith Racks inside chamber
  [-1.08, 0, 1.08].forEach((ox, ri) => {
    boxAt(g0, 0.68, 2.28, 0.72, vx + ox, fy0 + 1.3, vz, pal.matteGunmetal, true, false, 0.02);
    boxAt(g0, 0.48, 0.07, 0.04, vx + ox, fy0 + 2.02, vz + 0.37, pal.emeraldGlow, false, false);
    boxAt(g0, 0.48, 0.07, 0.04, vx + ox, fy0 + 1.56, vz + 0.37, ri === 1 ? pal.amberGoldGlow : pal.emeraldGlow, false, false);
  });
  addCryptoPlaque(g0, 'COLD MPC VAULT · 5/7 QUORUM', vx, fy0 + 2.86, vz + 1.74, 0, 2.5, 'AIR-GAPPED CUSTODY');

  // Giant Spot Orderbook & Validator Telemetry Wall (shifted left of Merkle void at cx - 2.6, cz - 9.65)
  boxAt(g0, 6.6, 2.5, 0.16, cx - 2.6, fy0 + 2.25, cz - 9.68, pal.charredAsh, true, false, 0.02);
  boxAt(g0, 6.72, 0.08, 0.22, cx - 2.6, fy0 + 3.52, cz - 9.66, pal.champagneTitanium, false, false);
  const obMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.24, 2.2), orderbookScreen.mat);
  obMesh.position.set(cx - 2.6, fy0 + 2.25, cz - 9.58);
  g0.add(obMesh);
  orderbookScreen.setMesh(obMesh);

  // Two Biometric Exchange Check-In Kiosks flanking entry medallion
  [-4.0, 4.0].forEach((kx) => {
    boxAt(g0, 0.92, 1.15, 0.62, cx + kx, fy0 + 0.575, cz + 6.4, pal.matteGunmetal, true, true, 0.04);
    boxAt(g0, 0.96, 0.08, 0.66, cx + kx, fy0 + 1.16, cz + 6.4, pal.champagneTitanium, false, false);
    const kScr = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.42), pal.emeraldGlow);
    kScr.position.set(cx + kx, fy0 + 1.38, cz + 6.4);
    kScr.rotation.x = -0.35;
    g0.add(kScr);
  });

  // 4 Quant Trading & Custody Pods (all chairs have unobstructed ±0.66m X dock clearance)
  const g0Pods: Array<{ x: number; z: number; rot: number; role: string; zone: string }> = [
    { x: cx - 6.8, z: cz + 1.8, rot: 0, role: 'Quant Spot Trader', zone: 'BitVault Trading Floor' },
    { x: cx + 6.4, z: cz + 2.6, rot: 0, role: 'Institutional Desk Lead', zone: 'BitVault Trading Floor' },
    { x: cx - 6.8, z: cz - 3.6, rot: Math.PI, role: 'MPC Custody Auditor', zone: 'Vault Telemetry Zone' },
    { x: cx - 6.8, z: cz + 6.4, rot: 0, role: 'Exchange Concierge & KYC', zone: 'Atrium Onboarding Desk' },
  ];
  g0Pods.forEach((p, i) => {
    buildCryptoPodDesk(g0, p.x, fy0, p.z, 2.6, 1.1, p.rot, pal, accentMat);
    const seatZ = p.rot === 0 ? p.z + 0.95 : p.z - 0.95;
    const monZ = p.rot === 0 ? p.z - 0.22 : p.z + 0.22;
    const faceSeat = p.rot === 0 ? Math.PI : 0;
    registerChair(0, p.x, fy0, seatZ, faceSeat, i % 2 ? 1 : -1);
    registerMonitor(0, i, [p.x, fy0 + 0.78, monZ], p.rot, p.x, seatZ, p.role, p.zone);
  });

  // Architectural corner plants on Ground
  plant(g0, cx - 9.6, fy0, cz - 8.4, 1.08, 41, M);
  plant(g0, cx + 9.4, fy0, cz + 7.8, 1.05, 43, M);

  // =========================================================================
  // LEVEL 1 (L1): IMMERSION ASIC MINING & HARDWARE SECURITY GALLERY
  // =========================================================================
  const g1 = levelGroups[1];
  const fy1 = spec.groundY + 1 * spec.floorH + 0.12;
  let monIdx = 4;

  boxAt(g1, 21.5, 0.018, 19.5, cx, fy1 + 0.009, cz, pal.basaltHex, false, true);
  boxAt(g1, 10.6, 0.02, 5.2, cx - 5.0, fy1 + 0.016, cz + 5.6, pal.darkAcousticRug, false, true);

  // NW Cryo-Immersion ASIC Tank Showcase (2 tanks at cx - 7.4 and cx - 3.0, cz - 6.2)
  [-7.4, -3.0].forEach((tx, ti) => {
    const px = cx + tx;
    const pz = cz - 6.2;
    boxAt(g1, 2.55, 0.42, 1.48, px, fy1 + 0.21, pz, pal.matteGunmetal, true, true, 0.04);
    boxAt(g1, 2.46, 0.88, 1.38, px, fy1 + 0.86, pz, pal.dielectricFluid, false, false);
    boxAt(g1, 2.58, 0.06, 1.5, px, fy1 + 1.32, pz, pal.champagneTitanium, true, false);
    // 6 submerged copper/titanium ASIC blade racks inside dielectric bath
    for (let b = -2; b <= 2; b++) {
      boxAt(g1, 0.18, 0.62, 1.02, px + b * 0.42, fy1 + 0.82, pz, pal.copperCoil, true, false);
      boxAt(g1, 0.14, 0.04, 0.88, px + b * 0.42, fy1 + 1.15, pz, pal.emeraldGlow, false, false);
    }
    // Overhead cryo manifold riser pipe
    cylAt(g1, 0.075, 0.075, 2.65, px + (ti === 0 ? -1.05 : 1.05), fy1 + 2.6, pz - 0.48, pal.champagneTitanium, true, false, 12);
    contact(g1, px, fy1 + 0.01, pz, 2.8, 1.7, 0.38, M.textures.shadowTex);
  });
  // Overhead horizontal cryo manifold trunk connecting tanks toward NW wall
  cylAt(g1, 0.09, 0.09, 6.2, cx - 5.2, fy1 + 3.65, cz - 6.68, pal.copperCoil, false, false, 12).rotation.z = Math.PI / 2;
  addCryptoPlaque(g1, 'IMMERSION ASIC GALLERY', cx - 5.2, fy1 + 1.45, cz - 7.12, 0, 2.6, 'LEVEL 1 · HARDWARE LAB');

  // Immersion Thermal & Hashrate Telemetry Screen on NW Wall
  boxAt(g1, 5.1, 2.0, 0.14, cx - 5.2, fy1 + 2.25, cz - 9.65, pal.charredAsh, true, false, 0.02);
  const imMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.8), immersionScreen.mat);
  imMesh.position.set(cx - 5.2, fy1 + 2.25, cz - 9.56);
  g1.add(imMesh);
  immersionScreen.setMesh(imMesh);

  // Two Museum Self-Custody & Multi-Sig Hardware Vitrines (cx - 6.0 & cx - 1.2, cz - 0.8)
  [-6.0, -1.2].forEach((vxOff, vi) => {
    const px = cx + vxOff;
    const pz = cz - 0.8;
    boxAt(g1, 1.76, 0.92, 1.16, px, fy1 + 0.46, pz, pal.verdeOnyx, true, true, 0.03);
    boxAt(g1, 1.82, 0.05, 1.22, px, fy1 + 0.94, pz, pal.champagneTitanium, false, false);
    boxAt(g1, 1.62, 0.72, 1.02, px, fy1 + 1.32, pz, pal.emeraldSmokedGlass, false, false);
    // Display artifact: titanium seed plate & cryptographic hardware vault
    boxAt(g1, 0.72, 0.14, 0.46, px, fy1 + 1.05, pz, vi === 0 ? pal.champagneTitanium : pal.copperCoil, true, false, 0.01);
    boxAt(g1, 0.24, 0.24, 0.24, px + 0.48, fy1 + 1.1, pz, pal.emeraldGlow, false, false);
  });

  // SW Hardware Security Consultation Pods (2 chairs + monitors)
  [-7.2, -2.4].forEach((dx) => {
    const px = cx + dx;
    const pz = cz + 5.6;
    buildCryptoPodDesk(g1, px, fy1, pz, 2.5, 1.08, 0, pal, accentMat);
    const seatZ = pz + 0.95;
    registerChair(1, px, fy1, seatZ, Math.PI, dx < -4 ? 1 : -1);
    registerMonitor(
      1,
      monIdx++,
      [px, fy1 + 0.78, pz - 0.22],
      0,
      px,
      seatZ,
      dx < -4 ? 'Hardware Security Architect · L1' : 'Self-Custody Engineer · L1',
      'Hardware Security Gallery'
    );
  });

  // SE Espresso Hospitality Counter & Investor Lounge
  boxAt(g1, 3.8, 1.02, 1.02, cx + 6.8, fy1 + 0.51, cz + 7.2, pal.charredAsh, true, true, 0.04);
  boxAt(g1, 3.92, 0.07, 1.12, cx + 6.8, fy1 + 1.04, cz + 7.2, pal.verdeOnyx, false, true, 0.02);
  boxAt(g1, 0.65, 0.42, 0.5, cx + 6.8, fy1 + 1.28, cz + 7.2, pal.champagneTitanium, true, false, 0.03);
  const l1Sofa = sofaWide(g1, cx + 4.4, fy1, cz + 3.6, 0, pal.emeraldFelt, M);
  l1Sofa.scale.set(0.84, 0.92, 0.84);
  cylAt(g1, 0.6, 0.54, 0.4, cx + 4.4, fy1 + 0.2, cz + 5.1, pal.verdeOnyx, true, true, 16);
  plant(g1, cx + 9.4, fy1, cz + 7.8, 1.0, 51, M);
  plant(g1, cx - 9.4, fy1, cz + 7.8, 1.02, 53, M);

  // =========================================================================
  // LEVEL 2 (L2): INSTITUTIONAL OTC DESK & CROSS-BORDER LIQUIDITY HALL
  // =========================================================================
  const g2 = levelGroups[2];
  const fy2 = spec.groundY + 2 * spec.floorH + 0.12;

  boxAt(g2, 21.5, 0.018, 19.5, cx, fy2 + 0.009, cz, pal.basaltHex, false, true);
  boxAt(g2, 9.2, 0.02, 6.2, cx - 5.4, fy2 + 0.016, cz - 2.2, pal.darkAcousticRug, false, true);

  // NW Live Institutional FX & Liquidity Matrix Video Wall
  boxAt(g2, 6.4, 2.4, 0.16, cx - 5.2, fy2 + 2.28, cz - 9.66, pal.charredAsh, true, false, 0.02);
  boxAt(g2, 6.52, 0.07, 0.22, cx - 5.2, fy2 + 3.5, cz - 9.64, pal.champagneTitanium, false, false);
  const otcMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.08, 2.15), otcLiquidityScreen.mat);
  otcMesh.position.set(cx - 5.2, fy2 + 2.28, cz - 9.56);
  g2.add(otcMesh);
  otcLiquidityScreen.setMesh(otcMesh);

  // West Dual-Bank Institutional OTC Trading Console (3 operator desks with full X clearance)
  buildCryptoPodDesk(g2, cx - 5.6, fy2, cz - 3.5, 5.8, 1.12, Math.PI, pal, accentMat);
  [-7.2, -4.0].forEach((ox, oi) => {
    const seatX = cx + ox;
    const seatZ = cz - 4.45;
    registerChair(2, seatX, fy2, seatZ, 0, oi === 0 ? 1 : -1);
    registerMonitor(
      2,
      monIdx++,
      [seatX, fy2 + 0.78, cz - 3.28],
      Math.PI,
      seatX,
      seatZ,
      oi === 0 ? 'Head of Institutional OTC · L2' : 'FX Liquidity Strategist · L2',
      'Institutional OTC Desk'
    );
  });
  buildCryptoPodDesk(g2, cx - 5.6, fy2, cz - 0.8, 2.8, 1.06, 0, pal, accentMat);
  registerChair(2, cx - 5.6, fy2, cz + 0.15, Math.PI, 1);
  registerMonitor(
    2,
    monIdx++,
    [cx - 5.6, fy2 + 0.78, cz - 1.02],
    0,
    cx - 5.6,
    cz + 0.15,
    'Cross-Border Treasury Structurer · L2',
    'Institutional OTC Desk'
  );

  // SW Acoustic Smoked-Glass Client Call Pods (2 enclosed booths at cx - 7.4 & cx - 2.2, cz + 6.6)
  [-7.4, -2.2].forEach((bx, bi) => {
    const px = cx + bx;
    const pz = cz + 6.6;
    // Left, Right & South acoustic/glass booth walls (North portal wide open at dz +5.0)
    boxAt(g2, 0.12, 2.75, 3.2, px - 1.54, fy2 + 1.38, pz, pal.emeraldSmokedGlass, false, false);
    boxAt(g2, 0.12, 2.75, 3.2, px + 1.54, fy2 + 1.38, pz, pal.emeraldSmokedGlass, false, false);
    boxAt(g2, 3.16, 2.75, 0.14, px, fy2 + 1.38, pz + 1.54, pal.charredAsh, true, false);
    boxAt(g2, 3.2, 0.12, 3.24, px, fy2 + 2.82, pz, pal.matteGunmetal, true, false);
    boxAt(g2, 0.78, 2.75, 0.1, px - 1.15, fy2 + 1.38, pz - 1.54, pal.emeraldSmokedGlass, false, false);
    boxAt(g2, 0.78, 2.75, 0.1, px + 1.15, fy2 + 1.38, pz - 1.54, pal.emeraldSmokedGlass, false, false);
    // Inside pod: round onyx deal table + warm lamp
    cylAt(g2, 0.56, 0.52, 0.06, px, fy2 + 0.74, pz + 0.15, pal.verdeOnyx, true, true, 18);
    cylAt(g2, 0.08, 0.22, 0.72, px, fy2 + 0.36, pz + 0.15, pal.champagneTitanium, true, false, 14);
    addCryptoPlaque(g2, `SETTLEMENT POD 0${bi + 1}`, px, fy2 + 2.55, pz - 1.62, Math.PI, 1.55, 'ACOUSTIC CALL BOOTH');
  });

  // SE Institutional Lounge + Rotating Anodized Champagne-Bronze Genesis Torus Knot Sculpture
  cylAt(g2, 0.66, 0.72, 1.06, cx + 6.4, fy2 + 0.53, cz + 2.6, pal.verdeOnyx, true, true, 16);
  const torusKnot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.42, 0.11, 72, 12, 2, 3),
    pal.champagneTitanium
  );
  torusKnot.position.set(cx + 6.4, fy2 + 1.72, cz + 2.6);
  torusKnot.castShadow = true;
  g2.add(torusKnot);
  rotatingProps.push({ obj: torusKnot, speed: 0.48, axis: 'y' });

  const l2Sofa = sofaWide(g2, cx + 6.0, fy2, cz + 7.2, Math.PI, pal.obsidianLeather, M);
  l2Sofa.scale.set(0.84, 0.92, 0.84);
  boxAt(g2, 1.75, 0.38, 0.88, cx + 6.0, fy2 + 0.19, cz + 5.6, pal.verdeOnyx, true, true, 0.04);
  plant(g2, cx + 9.4, fy2, cz + 7.8, 1.0, 61, M);

  // =========================================================================
  // LEVEL 3 (L3): ZERO-KNOWLEDGE PROOF-OF-RESERVES AUDIT LAB & OPS THEATER
  // =========================================================================
  const g3 = levelGroups[3];
  const fy3 = spec.groundY + 3 * spec.floorH + 0.12;

  boxAt(g3, 21.5, 0.018, 19.5, cx, fy3 + 0.009, cz, pal.basaltHex, false, true);
  boxAt(g3, 10.6, 0.02, 5.2, cx - 4.2, fy3 + 0.016, cz + 5.4, pal.darkAcousticRug, false, true);

  // NW Air-Gapped Signing Ceremony Enclave (dx -9.8 .. -3.0, dz -9.6 .. -3.2; open portal dx -7.5..-5.3 at dz -3.2)
  boxAt(g3, 0.14, 3.1, 6.3, cx - 3.0, fy3 + 1.55, cz - 6.38, pal.emeraldSmokedGlass, false, false);
  boxAt(g3, 2.25, 3.1, 0.14, cx - 8.65, fy3 + 1.55, cz - 3.2, pal.emeraldSmokedGlass, false, false);
  boxAt(g3, 2.25, 3.1, 0.14, cx - 4.15, fy3 + 1.55, cz - 3.2, pal.emeraldSmokedGlass, false, false);
  boxAt(g3, 2.32, 0.14, 0.18, cx - 6.4, fy3 + 3.04, cz - 3.2, pal.champagneTitanium, false, false);
  addCryptoPlaque(g3, 'AIR-GAPPED KEY CEREMONY', cx - 6.4, fy3 + 2.72, cz - 3.1, 0, 2.15, 'MPC SIGNING ENCLAVE');

  // Inside Enclave: Hexagonal Jade-Onyx Quorum Table + Rotating ZK Crystal Prism
  cylAt(g3, 1.24, 1.1, 0.78, cx - 6.4, fy3 + 0.39, cz - 6.4, pal.verdeOnyx, true, true, 6);
  cylAt(g3, 1.28, 1.28, 0.05, cx - 6.4, fy3 + 0.8, cz - 6.4, pal.champagneTitanium, false, false, 6);
  const zkPrism = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), pal.emeraldGlow);
  zkPrism.position.set(cx - 6.4, fy3 + 1.48, cz - 6.4);
  g3.add(zkPrism);
  rotatingProps.push({ obj: zkPrism, speed: 0.65, axis: 'y' });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    boxAt(
      g3,
      0.18,
      0.06,
      0.24,
      cx - 6.4 + Math.cos(a) * 0.92,
      fy3 + 0.85,
      cz - 6.4 + Math.sin(a) * 0.92,
      pal.matteGunmetal,
      false,
      false
    );
  }

  // SW Proof-of-Reserves Ops Theater: Giant Curved-Frame ZK & Mainnet Finality Screen (South Wall)
  boxAt(g3, 7.1, 2.45, 0.24, cx - 4.2, fy3 + 2.05, cz + 9.15, pal.charredAsh, true, false, 0.03);
  boxAt(g3, 7.22, 0.08, 0.28, cx - 4.2, fy3 + 3.3, cz + 9.14, pal.champagneTitanium, false, false);
  const zkMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.75, 2.18), zkTheaterScreen.mat);
  zkMesh.rotation.y = Math.PI;
  zkMesh.position.set(cx - 4.2, fy3 + 2.05, cz + 9.01);
  g3.add(zkMesh);
  zkTheaterScreen.setMesh(zkMesh);

  // Three Theater Auditor Consoles facing South (chairs north at cz + 3.85 facing 0 South)
  [-7.4, -4.2, -1.0].forEach((ax, ai) => {
    const px = cx + ax;
    const pz = cz + 4.8;
    buildCryptoPodDesk(g3, px, fy3, pz, 2.48, 1.06, Math.PI, pal, accentMat);
    const seatZ = pz - 0.95;
    registerChair(3, px, fy3, seatZ, 0, ai % 2 === 0 ? 1 : -1);
    registerMonitor(
      3,
      monIdx++,
      [px, fy3 + 0.78, pz + 0.22],
      Math.PI,
      px,
      seatZ,
      ai === 0 ? 'Zero-Knowledge Cryptographer · L3' : ai === 1 ? 'Proof-of-Reserves Lead · L3' : 'Validator Consensus SRE · L3',
      'ZK Audit Ops Theater'
    );
  });

  // SE Research & Telemetry Collaboration Island
  boxAt(g3, 2.8, 0.08, 1.1, cx + 6.2, fy3 + 1.04, cz + 4.2, pal.verdeOnyx, true, true, 0.02);
  boxAt(g3, 2.4, 1.0, 0.72, cx + 6.2, fy3 + 0.5, cz + 4.2, pal.matteGunmetal, true, true, 0.03);
  plant(g3, cx + 9.2, fy3, cz + 7.8, 1.0, 71, M);
  plant(g3, cx + 1.8, fy3, cz - 8.0, 0.98, 73, M);

  // =========================================================================
  // LEVEL 4 (L4): SOVEREIGN GOVERNANCE PENTHOUSE, BOARDROOM & FOUNDER SUITE
  // =========================================================================
  const g4 = levelGroups[4];
  const fy4 = spec.groundY + 4 * spec.floorH + 0.12;

  boxAt(g4, 21.5, 0.018, 19.5, cx, fy4 + 0.009, cz, pal.basaltHex, false, true);
  boxAt(g4, 8.6, 0.02, 7.6, cx - 5.4, fy4 + 0.016, cz - 3.8, pal.darkAcousticRug, false, true);
  boxAt(g4, 7.8, 0.02, 5.8, cx - 5.2, fy4 + 0.016, cz + 5.8, pal.darkAcousticRug, false, true);

  // Merkle Skylight Halo Canopy directly overhead the 5-Story Merkle Void
  const ceil4 = levelCeilings[4];
  const yCeil4 = spec.groundY + 4 * spec.floorH + spec.floorH - 0.14;
  cylAt(ceil4, 2.35, 2.55, 0.14, cx + 6.38, yCeil4 - 0.06, cz - 4.82, pal.champagneTitanium, false, false, 8);
  cylAt(ceil4, 2.05, 2.05, 0.04, cx + 6.38, yCeil4 - 0.12, cz - 4.82, pal.warmCove, false, false, 8);

  // West Sovereign Governance Boardroom Enclosure (dx -9.8 .. -0.6, dz -9.6 .. +1.2; open portal dz -5.0..-2.6 on East wall)
  boxAt(g4, 0.14, 3.25, 4.5, cx - 0.6, fy4 + 1.62, cz - 7.3, pal.emeraldSmokedGlass, false, false);
  boxAt(g4, 0.14, 3.25, 3.7, cx - 0.6, fy4 + 1.62, cz - 0.68, pal.emeraldSmokedGlass, false, false);
  boxAt(g4, 9.15, 3.25, 0.14, cx - 5.2, fy4 + 1.62, cz + 1.2, pal.emeraldSmokedGlass, false, false);
  boxAt(g4, 0.18, 0.16, 2.48, cx - 0.6, fy4 + 3.16, cz - 3.8, pal.champagneTitanium, false, false);
  addCryptoPlaque(g4, 'GOVERNANCE BOARDROOM', cx - 0.45, fy4 + 2.86, cz - 3.8, Math.PI / 2, 2.15, 'LEVEL 4 · EXECUTIVE');

  // Monumental 5.2m x 1.8m Jade-Onyx & Bronze Boardroom Table (cx - 5.4, cz - 3.8)
  boxAt(g4, 5.2, 0.09, 1.8, cx - 5.4, fy4 + 0.74, cz - 3.8, pal.verdeOnyx, true, true, 0.08);
  boxAt(g4, 4.4, 0.02, 0.12, cx - 5.4, fy4 + 0.79, cz - 3.8, pal.emeraldGlow, false, false);
  [-1.6, 1.6].forEach((px) => {
    boxAt(g4, 0.68, 0.68, 0.96, cx - 5.4 + px, fy4 + 0.35, cz - 3.8, pal.champagneTitanium, true, true, 0.04);
  });

  // 4 Boardroom Executive Chairs (2 North, 2 South — all ±0.66 X dock clear!)
  [
    [-6.8, -5.15, 0, Math.PI, -3.12, 'Protocol Governance Chair · L4'],
    [-4.0, -5.15, 0, Math.PI, -3.12, 'Chief Risk & Treasury Officer · L4'],
    [-6.8, -2.45, Math.PI, 0, -4.48, 'Managing Director · L4'],
    [-4.0, -2.45, Math.PI, 0, -4.48, 'General Counsel & Compliance · L4'],
  ].forEach(([ox, oz, cRot, mRot, mzOff, role], bi) => {
    const sx = cx + (ox as number);
    const sz = cz + (oz as number);
    registerChair(4, sx, fy4, sz, cRot as number, bi % 2 === 0 ? 1 : -1);
    registerMonitor(
      4,
      monIdx++,
      [sx, fy4 + 0.79, cz + (mzOff as number)],
      mRot as number,
      sx,
      sz,
      role as string,
      'Governance Boardroom'
    );
  });

  // Protocol Treasury Quorum Screen on West Boardroom Wall (cx - 9.85, cz - 3.8)
  boxAt(g4, 0.16, 1.95, 4.7, cx - 9.88, fy4 + 2.15, cz - 3.8, pal.charredAsh, true, false, 0.02);
  const govMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.72), govTreasuryScreen.mat);
  govMesh.rotation.y = Math.PI / 2;
  govMesh.position.set(cx - 9.78, fy4 + 2.15, cz - 3.8);
  g4.add(govMesh);
  govTreasuryScreen.setMesh(govMesh);

  // SW Founder & CEO Sovereign Suite (desk at cx - 5.8, cz + 6.4)
  buildCryptoPodDesk(g4, cx - 5.8, fy4, cz + 6.4, 2.8, 1.12, 0, pal, accentMat);
  registerChair(4, cx - 5.8, fy4, cz + 7.45, Math.PI, 1);
  registerMonitor(
    4,
    monIdx++,
    [cx - 5.8, fy4 + 0.78, cz + 6.18],
    0,
    cx - 5.8,
    cz + 7.45,
    'Founder & Chief Executive · L4',
    'Sovereign Founder Suite'
  );
  // Founder Suite lounge club armchairs & tea pedestal (cx - 2.4, cz + 5.8)
  const fArm1 = armchair(g4, cx - 2.9, fy4, cz + 5.2, 0.5, pal.obsidianLeather, M);
  fArm1.scale.set(0.78, 0.88, 0.78);
  const fArm2 = armchair(g4, cx - 1.5, fy4, cz + 6.4, -Math.PI * 0.6, pal.obsidianLeather, M);
  fArm2.scale.set(0.78, 0.88, 0.78);
  cylAt(g4, 0.44, 0.4, 0.42, cx - 2.3, fy4 + 0.21, cz + 5.9, pal.verdeOnyx, true, true, 16);
  // Rear archival bookcase credenza (cx - 9.5, cz + 6.0)
  boxAt(g4, 0.58, 1.55, 3.4, cx - 9.5, fy4 + 0.78, cz + 6.0, pal.charredAsh, true, true, 0.02);

  // SE Penthouse Sky-Lounge, Crypto Research Archive & Espresso Bar
  boxAt(g4, 4.2, 1.02, 1.05, cx + 6.6, fy4 + 0.51, cz + 7.8, pal.charredAsh, true, true, 0.04);
  boxAt(g4, 4.32, 0.07, 1.14, cx + 6.6, fy4 + 1.04, cz + 7.8, pal.verdeOnyx, false, true, 0.02);
  boxAt(g4, 0.62, 0.42, 0.48, cx + 7.2, fy4 + 1.28, cz + 7.8, pal.champagneTitanium, true, false, 0.03);
  const l4Sofa = sofaWide(g4, cx + 4.4, fy4, cz + 3.6, 0, pal.emeraldFelt, M);
  l4Sofa.scale.set(0.84, 0.92, 0.84);
  boxAt(g4, 1.75, 0.38, 0.88, cx + 4.4, fy4 + 0.19, cz + 5.0, pal.verdeOnyx, true, true, 0.04);
  // Crypto Archive Glass Bookcase along East SE wall
  boxAt(g4, 0.66, 2.35, 3.2, cx + 9.6, fy4 + 1.18, cz + 3.4, pal.charredAsh, true, true, 0.02);
  boxAt(g4, 0.04, 2.2, 3.05, cx + 9.25, fy4 + 1.18, cz + 3.4, pal.emeraldSmokedGlass, false, false);
  plant(g4, cx + 9.4, fy4, cz + 8.0, 1.05, 81, M);
  plant(g4, cx - 9.4, fy4, cz + 8.4, 1.0, 83, M);

  void pickMeshes;
}
