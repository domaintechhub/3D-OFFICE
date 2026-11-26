import * as THREE from 'three';
import {
  buildPlanterTrough,
  buildTropicalPalm,
  getRoundedSlabGeo,
  type ArchitecturalMaterials,
} from './architecturalForms';
import type { MonitorPickTarget } from './architecture';
import type { DistrictBuildingSpec } from './districtData';
import type { WarmLightAnchor } from './districtBuildings';
import type { MaterialLibrary } from './materials';
import {
  armchair,
  boxAt,
  contact,
  cylAt,
  downlight,
  getRoundedBox,
  plant,
} from './props';
import { createCustomBoardScreen, type ScreenRegistry } from './screens';
import { circ, getMaxAnisotropy, makeCanvasTex, rr } from './textures';

export interface BankBuildContext {
  spec: DistrictBuildingSpec;
  levelGroups: THREE.Group[];
  levelCeilings: THREE.Group[];
  roofShellGroup: THREE.Group;
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

interface BankPalette {
  riftLimestone: THREE.MeshStandardMaterial;
  flutedLimestone: THREE.MeshStandardMaterial;
  kilimanjaroSlate: THREE.MeshStandardMaterial;
  makoreWood: THREE.MeshStandardMaterial;
  guillocheMosaic: THREE.MeshStandardMaterial;
  parchmentLinen: THREE.MeshStandardMaterial;
  savannaTealVelvet: THREE.MeshStandardMaterial;
  ochreSaddleHide: THREE.MeshStandardMaterial;
  champagneBronze: THREE.MeshStandardMaterial;
  obsidianBronze: THREE.MeshStandardMaterial;
  bullionVaultSteel: THREE.MeshStandardMaterial;
  goldSpecie: THREE.MeshStandardMaterial;
  banknoteCopper: THREE.MeshStandardMaterial;
  lockerFaceMat: THREE.MeshStandardMaterial;
  stairTreadMat: THREE.MeshStandardMaterial;
  warmCoveLed: THREE.MeshBasicMaterial;
  cobaltLedgerLed: THREE.MeshBasicMaterial;
  tealSignalLed: THREE.MeshBasicMaterial;
  bronzeTintedGlass: THREE.MeshStandardMaterial;
  frostedLoomGlass: THREE.MeshStandardMaterial;
  clearArmorGlass: THREE.MeshStandardMaterial;
}

let cachedPalette: BankPalette | null = null;

function getBankPalette(): BankPalette {
  if (cachedPalette) return cachedPalette;

  const aniso = getMaxAnisotropy();

  // 1. Warm Rift-Valley Stratified Honey Limestone Terrazzo with Flush Satin-Bronze Joints
  const limestoneTex = makeCanvasTex('ntb_rift_limestone_floor', 512, 512, (g, W, H) => {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#ebe2d0');
    bg.addColorStop(0.5, '#e2d7c2');
    bg.addColorStop(1, '#dfd2ba');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Sedimentary travertine / limestone bands
    for (let y = 0; y < H; y += 5) {
      const wave = Math.sin(y * 0.09) * 0.5 + 0.5;
      g.fillStyle = wave > 0.55 ? 'rgba(176, 149, 108, 0.14)' : 'rgba(255, 249, 238, 0.16)';
      g.fillRect(0, y, W, 2 + (y % 3));
    }

    // Fine ochre, quartz, and slate limestone aggregate flecks
    const flecks = ['#c8b799', '#a68d68', '#f5efe2', '#70685b', '#d4b783'];
    for (let i = 0; i < 340; i++) {
      const rx = ((Math.sin(i * 17.31 + 1.1) * 43758.5453) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 63.17 + 3.4) * 29143.1279) % 1 + 1) % 1;
      g.fillStyle = flecks[i % flecks.length];
      g.fillRect(rx * W, ry * H, 2 + (i % 4), 1.5 + (i % 3));
    }

    // Flush champagne-bronze architectural expansion joints
    g.strokeStyle = 'rgba(180, 146, 86, 0.36)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);
    g.beginPath();
    g.moveTo(W * 0.5, 0);
    g.lineTo(W * 0.5, H);
    g.moveTo(0, H * 0.5);
    g.lineTo(W, H * 0.5);
    g.stroke();
  });
  limestoneTex.colorSpace = THREE.SRGBColorSpace;
  limestoneTex.wrapS = limestoneTex.wrapT = THREE.RepeatWrapping;
  limestoneTex.repeat.set(4.5, 4.0);
  limestoneTex.anisotropy = aniso;

  // 2. Fluted Rift Limestone Architectural Wall Cladding
  const fluteLimestoneTex = makeCanvasTex('ntb_fluted_limestone', 256, 256, (g, W, H) => {
    g.fillStyle = '#e5dac5';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 16) {
      const gr = g.createLinearGradient(x, 0, x + 16, 0);
      gr.addColorStop(0, '#c7b89c');
      gr.addColorStop(0.45, '#f4ecdc');
      gr.addColorStop(0.88, '#d9cbb1');
      gr.addColorStop(1, '#b7a688');
      g.fillStyle = gr;
      g.fillRect(x, 0, 16, H);
    }
  });
  fluteLimestoneTex.colorSpace = THREE.SRGBColorSpace;
  fluteLimestoneTex.wrapS = fluteLimestoneTex.wrapT = THREE.RepeatWrapping;
  fluteLimestoneTex.repeat.set(2.5, 1);
  fluteLimestoneTex.anisotropy = aniso;

  // 3. Honed Kilimanjaro Slate (deep basaltic charcoal-indigo with fine silver-mica grain)
  const slateTex = makeCanvasTex('ntb_kilimanjaro_slate', 512, 512, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#1e252e');
    gr.addColorStop(0.5, '#252e3a');
    gr.addColorStop(1, '#181e26');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 45; i++) {
      const rx = ((Math.sin(i * 29.1 + 0.7) * 43758.5) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 51.3 + 2.2) * 19283.4) % 1 + 1) % 1;
      const rad = 24 + (i % 4) * 20;
      const rg = g.createRadialGradient(rx * W, ry * H, 2, rx * W, ry * H, rad);
      rg.addColorStop(0, 'rgba(72, 88, 108, 0.16)');
      rg.addColorStop(1, 'rgba(24, 30, 38, 0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    }
    for (let i = 0; i < 240; i++) {
      const rx = ((Math.sin(i * 91.7) * 43758.5) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 41.9) * 31823.1) % 1 + 1) % 1;
      g.fillStyle = i % 3 === 0 ? 'rgba(201, 169, 110, 0.22)' : 'rgba(188, 202, 218, 0.16)';
      g.fillRect(rx * W, ry * H, 2, 2);
    }
  });
  slateTex.colorSpace = THREE.SRGBColorSpace;
  slateTex.wrapS = slateTex.wrapT = THREE.RepeatWrapping;
  slateTex.repeat.set(3, 3);
  slateTex.anisotropy = aniso;

  // 4. Figured East African Makore / Mvule Timber Grain
  const makoreTex = makeCanvasTex('ntb_makore_wood', 512, 256, (g, W, H) => {
    const base = g.createLinearGradient(0, 0, W, 0);
    base.addColorStop(0, '#6a3822');
    base.addColorStop(0.5, '#7e4429');
    base.addColorStop(1, '#5d301d');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 48; i++) {
      g.strokeStyle = i % 2 === 0 ? 'rgba(42, 18, 10, 0.28)' : 'rgba(164, 96, 56, 0.24)';
      g.lineWidth = 1.6 + (i % 3);
      g.beginPath();
      const y0 = (i / 48) * H;
      g.moveTo(0, y0);
      g.bezierCurveTo(W * 0.3, y0 + Math.sin(i * 1.4) * 10, W * 0.7, y0 - Math.cos(i * 1.1) * 10, W, y0);
      g.stroke();
    }
  });
  makoreTex.colorSpace = THREE.SRGBColorSpace;
  makoreTex.wrapS = makoreTex.wrapT = THREE.RepeatWrapping;
  makoreTex.repeat.set(2, 1);
  makoreTex.anisotropy = aniso;

  // 5. Custom Banknote-Guilloché Radial Compass Medallion Mosaic (Zero overlap with any other district building!)
  const guillocheTex = makeCanvasTex('ntb_guilloche_medallion', 512, 512, (g, W, H) => {
    const cx = W * 0.5;
    const cy = H * 0.5;
    g.fillStyle = '#e7dcc8';
    g.fillRect(0, 0, W, H);

    // Outer slate & savanna-teal stone rings
    g.fillStyle = '#1e252e';
    circ(g, cx, cy, 240);
    g.fillStyle = '#134e5e';
    circ(g, cx, cy, 206);
    g.fillStyle = '#e7dcc8';
    circ(g, cx, cy, 182);

    // Precision banknote spirograph guilloché petals in champagne-bronze
    g.strokeStyle = '#b48a48';
    g.lineWidth = 2.2;
    for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * Math.PI * 2;
      g.beginPath();
      g.ellipse(
        cx + Math.cos(ang) * 76,
        cy + Math.sin(ang) * 76,
        92,
        36,
        ang,
        0,
        Math.PI * 2
      );
      g.stroke();
    }

    // Center compass rose & 1998 heritage seal
    g.fillStyle = '#1e252e';
    circ(g, cx, cy, 56);
    g.strokeStyle = '#d9b56b';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, 56, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#d9b56b';
    g.font = '800 22px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('NTB', cx, cy - 8);
    g.font = '600 11px "IBM Plex Mono", monospace';
    g.fillText('1998', cx, cy + 14);
  });
  guillocheTex.colorSpace = THREE.SRGBColorSpace;
  guillocheTex.anisotropy = aniso;

  // 6. Parchment Acoustic Linen Weave
  const linenTex = makeCanvasTex('ntb_parchment_linen', 256, 256, (g, W, H) => {
    g.fillStyle = '#ebe3d5';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 8) {
      g.fillStyle = 'rgba(138, 120, 96, 0.1)';
      g.fillRect(x, 0, 2, H);
    }
    for (let y = 0; y < H; y += 8) {
      g.fillStyle = 'rgba(138, 120, 96, 0.08)';
      g.fillRect(0, y, W, 2);
    }
  });
  linenTex.colorSpace = THREE.SRGBColorSpace;
  linenTex.wrapS = linenTex.wrapT = THREE.RepeatWrapping;
  linenTex.repeat.set(3, 2);
  linenTex.anisotropy = aniso;

  // 7. Safe-Deposit Vault Locker Matrix (Cobalt-Steel & Champagne-Bronze Dual-Key)
  const lockerTex = makeCanvasTex('ntb_safe_deposit_wall', 512, 256, (g, W, H) => {
    g.fillStyle = '#2a3442';
    g.fillRect(0, 0, W, H);
    const cols = 10;
    const rows = 5;
    const cw = W / cols;
    const ch = H / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + 3;
        const y = r * ch + 3;
        const boxGrad = g.createLinearGradient(x, y, x + cw, y + ch);
        boxGrad.addColorStop(0, '#5a687c');
        boxGrad.addColorStop(0.5, '#465366');
        boxGrad.addColorStop(1, '#313c4d');
        g.fillStyle = boxGrad;
        g.fillRect(x, y, cw - 6, ch - 6);
        g.strokeStyle = '#c9a96e';
        g.lineWidth = 1.4;
        g.strokeRect(x, y, cw - 6, ch - 6);
        // Dual champagne-bronze key escutcheons
        g.fillStyle = '#d9b56b';
        circ(g, x + cw * 0.28, y + ch * 0.48, 3.2);
        circ(g, x + cw * 0.56, y + ch * 0.48, 3.2);
      }
    }
  });
  lockerTex.colorSpace = THREE.SRGBColorSpace;
  lockerTex.anisotropy = aniso;

  cachedPalette = {
    riftLimestone: new THREE.MeshStandardMaterial({
      map: limestoneTex,
      roughness: 0.48,
      metalness: 0.04,
      envMapIntensity: 0.32,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    flutedLimestone: new THREE.MeshStandardMaterial({
      map: fluteLimestoneTex,
      roughness: 0.58,
      metalness: 0.02,
      envMapIntensity: 0.25,
    }),
    kilimanjaroSlate: new THREE.MeshStandardMaterial({
      map: slateTex,
      roughness: 0.42,
      metalness: 0.08,
      envMapIntensity: 0.38,
    }),
    makoreWood: new THREE.MeshStandardMaterial({
      map: makoreTex,
      roughness: 0.5,
      metalness: 0.03,
      envMapIntensity: 0.28,
    }),
    guillocheMosaic: new THREE.MeshStandardMaterial({
      map: guillocheTex,
      roughness: 0.36,
      metalness: 0.08,
      envMapIntensity: 0.38,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    parchmentLinen: new THREE.MeshStandardMaterial({
      map: linenTex,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.16,
    }),
    savannaTealVelvet: new THREE.MeshStandardMaterial({
      color: 0x134e5e,
      roughness: 0.84,
      metalness: 0.02,
      envMapIntensity: 0.18,
    }),
    ochreSaddleHide: new THREE.MeshStandardMaterial({
      color: 0x9e5a2b,
      roughness: 0.52,
      metalness: 0.04,
      envMapIntensity: 0.22,
    }),
    champagneBronze: new THREE.MeshStandardMaterial({
      color: 0xc9a96e,
      roughness: 0.3,
      metalness: 0.85,
      envMapIntensity: 0.7,
    }),
    obsidianBronze: new THREE.MeshStandardMaterial({
      color: 0x22201d,
      roughness: 0.44,
      metalness: 0.68,
      envMapIntensity: 0.5,
    }),
    bullionVaultSteel: new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      roughness: 0.32,
      metalness: 0.88,
      envMapIntensity: 0.65,
    }),
    goldSpecie: new THREE.MeshStandardMaterial({
      color: 0xf2c94c,
      roughness: 0.26,
      metalness: 0.92,
      envMapIntensity: 0.82,
    }),
    banknoteCopper: new THREE.MeshStandardMaterial({
      color: 0xb8734b,
      roughness: 0.32,
      metalness: 0.84,
      envMapIntensity: 0.68,
    }),
    lockerFaceMat: new THREE.MeshStandardMaterial({
      map: lockerTex,
      roughness: 0.34,
      metalness: 0.72,
      envMapIntensity: 0.48,
    }),
    stairTreadMat: new THREE.MeshStandardMaterial({
      map: limestoneTex,
      roughness: 0.52,
      metalness: 0.03,
      envMapIntensity: 0.28,
    }),
    warmCoveLed: new THREE.MeshBasicMaterial({ color: 0xffe4ad, toneMapped: false }),
    cobaltLedgerLed: new THREE.MeshBasicMaterial({ color: 0x38bdf8, toneMapped: false }),
    tealSignalLed: new THREE.MeshBasicMaterial({ color: 0x2dd4bf, toneMapped: false }),
    bronzeTintedGlass: new THREE.MeshStandardMaterial({
      color: 0xc2b298,
      transparent: true,
      opacity: 0.26,
      roughness: 0.1,
      metalness: 0.14,
      envMapIntensity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    frostedLoomGlass: new THREE.MeshStandardMaterial({
      color: 0xe6dfd3,
      transparent: true,
      opacity: 0.52,
      roughness: 0.42,
      metalness: 0.06,
      envMapIntensity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    clearArmorGlass: new THREE.MeshStandardMaterial({
      color: 0xdff2fa,
      transparent: true,
      opacity: 0.22,
      roughness: 0.08,
      metalness: 0.12,
      envMapIntensity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };

  return cachedPalette;
}

function addZonePlaque(
  parent: THREE.Object3D,
  title: string,
  subtitle: string,
  x: number,
  y: number,
  z: number,
  rotY = 0
) {
  const tex = makeCanvasTex(`ntb_plaque_${title}_${subtitle}`, 440, 90, (g, w, h) => {
    g.fillStyle = '#181e26';
    rr(g, 2, 2, w - 4, h - 4, 8);
    g.fill();
    g.strokeStyle = '#c9a96e';
    g.lineWidth = 2.5;
    rr(g, 5, 5, w - 10, h - 10, 6);
    g.stroke();
    g.fillStyle = '#134e5e';
    g.fillRect(14, 14, 10, h - 28);
    g.fillStyle = '#f5efe2';
    g.font = '800 18px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(title.toUpperCase(), 36, 32);
    g.fillStyle = '#d9b56b';
    g.font = '600 13px "IBM Plex Mono", monospace';
    g.fillText(subtitle, 36, 61);
  }, true, true);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = getMaxAnisotropy();

  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.37),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
  );
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  parent.add(m);
}

/** Custom 5-part Champagne-Bronze & Parchment Atelier Desk (distinct from old executive walnut+navy desk). */
function buildReserveDesk(
  parent: THREE.Object3D,
  pal: BankPalette,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  rotY = 0,
  withSconce = true
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  // Tapered Makore desktop + champagne-bronze chamfer collar
  boxAt(g, w, 0.055, d, 0, 0.74, 0, pal.makoreWood, true, true, 0.018);
  boxAt(g, w - 0.1, 0.022, d - 0.1, 0, 0.704, 0, pal.champagneBronze, false, false, 0.006);
  // Parchment-linen acoustic modesty screen with bronze reveal
  boxAt(g, w - 0.42, 0.58, 0.06, 0, 0.39, -d * 0.34, pal.parchmentLinen, false, true, 0.012);
  // Sculpted cylindrical limestone & bronze-shod end piers
  [-w * 0.4, w * 0.4].forEach((lx) => {
    boxAt(g, 0.16, 0.68, d * 0.74, lx, 0.35, 0, pal.flutedLimestone, true, true, 0.02);
    boxAt(g, 0.18, 0.04, d * 0.76, lx, 0.02, 0, pal.champagneBronze, false, false, 0.008);
  });

  if (withSconce) {
    // Bespoke brass & linen cylinder desk lantern (replacing repeated green banker's lamp)
    const lx = -w * 0.33;
    const lz = -d * 0.2;
    cylAt(g, 0.065, 0.075, 0.024, lx, 0.78, lz, pal.champagneBronze, false, false, 14);
    cylAt(g, 0.012, 0.015, 0.22, lx, 0.89, lz, pal.obsidianBronze, false, false, 10);
    cylAt(g, 0.085, 0.105, 0.12, lx, 1.01, lz, pal.parchmentLinen, false, false, 16);
    cylAt(g, 0.088, 0.088, 0.016, lx, 1.07, lz, pal.champagneBronze, false, false, 16);
  }
  parent.add(g);
}

/** Custom Rift-Limestone & Champagne-Bronze Acoustic Fluted Column. */
function buildLimestoneColumn(parent: THREE.Object3D, pal: BankPalette, x: number, fy: number, z: number, h: number) {
  cylAt(parent, 0.36, 0.4, 0.18, x, fy + 0.09, z, pal.kilimanjaroSlate, true, true, 16);
  cylAt(parent, 0.32, 0.34, 0.06, x, fy + 0.21, z, pal.champagneBronze, false, false, 16);
  cylAt(parent, 0.25, 0.28, h - 0.36, x, fy + 0.24 + (h - 0.36) * 0.5, z, pal.flutedLimestone, true, true, 20);
  cylAt(parent, 0.32, 0.26, 0.1, x, fy + h - 0.06, z, pal.champagneBronze, false, false, 16);
}

/** Bespoke Curved Acoustic Crescent Consultation Booth (open entry, zero boxy walls). */
function buildAcousticCrescentPod(
  parent: THREE.Object3D,
  pal: BankPalette,
  cx: number,
  fy: number,
  cz: number,
  radius: number,
  h: number
) {
  // Semi-circular Makore timber rib colonnade arcing North behind advisor
  const ribCount = 11;
  for (let i = 0; i < ribCount; i++) {
    const a = Math.PI * 0.12 + (i / (ribCount - 1)) * Math.PI * 0.76; // North half arc (-Z)
    const rx = cx + Math.cos(a) * radius;
    const rz = cz - Math.sin(a) * radius;
    const fin = boxAt(parent, 0.11, h, 0.24, rx, fy + h * 0.5, rz, i % 2 === 0 ? pal.makoreWood : pal.flutedLimestone, true, true, 0.015);
    fin.rotation.y = a - Math.PI / 2;
  }
  // Curved champagne-bronze top header ring linking all acoustic ribs
  const capArc = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.07, 8, 28, Math.PI * 0.8),
    pal.champagneBronze
  );
  capArc.rotation.x = Math.PI / 2;
  capArc.rotation.z = Math.PI * 0.1;
  capArc.position.set(cx, fy + h + 0.02, cz);
  parent.add(capArc);
}

/** Custom Lamu-Inspired Makore Beam & Parchment Acoustic Baffle Ceiling. */
function buildBespokeBankCeiling(
  cg: THREE.Group,
  pal: BankPalette,
  spec: DistrictBuildingSpec,
  ceilY: number,
  lv: number,
  warmLights: WarmLightAnchor[]
) {
  const skipStair = lv < spec.floors - 1;
  const skipRotunda = lv === 0; // L0 ceiling opens into L1 Double-Height Banking Rotunda (+0.8..+6.8, -1.0..+5.0)!

  // Sculpted Makore transverse beams spanning East of West Stairwell (dx -4.5 .. +10.2)
  [-8.6, -5.6, -2.6, 0.4, 3.4, 6.4, 8.8].forEach((dz) => {
    const insideRotundaZ = skipRotunda && dz > -1.2 && dz < 5.2;
    if (insideRotundaZ) {
      // Split beam cleanly at rotunda void edges
      boxAt(cg, 5.2, 0.13, 0.22, spec.cx - 2.0, ceilY - 0.1, spec.cz + dz, pal.makoreWood, false, false, 0.01);
      boxAt(cg, 3.2, 0.13, 0.22, spec.cx + 8.6, ceilY - 0.1, spec.cz + dz, pal.makoreWood, false, false, 0.01);
    } else {
      boxAt(cg, 14.8, 0.13, 0.22, spec.cx + 2.8, ceilY - 0.1, spec.cz + dz, pal.makoreWood, false, false, 0.01);
    }
  });

  // Acoustic parchment-linen baffles & linear bronze light strips along main East/Center ceiling bays
  [
    { x: -1.8, z: -6.8, w: 4.8, d: 3.4 },
    { x: 4.8, z: -6.8, w: 4.8, d: 3.4 },
    { x: -1.8, z: 6.8, w: 4.8, d: 3.4 },
    { x: 4.8, z: 6.8, w: 4.8, d: 3.4 },
  ].forEach((bay) => {
    boxAt(cg, bay.w, 0.05, bay.d, spec.cx + bay.x, ceilY - 0.06, spec.cz + bay.z, pal.parchmentLinen, false, false);
    boxAt(cg, bay.w - 0.6, 0.02, 0.06, spec.cx + bay.x, ceilY - 0.09, spec.cz + bay.z, pal.warmCoveLed, false, false);
  });

  // South-West & North-West ceiling bays flanking West Stairwell (dx -10.2..-5.2)
  boxAt(cg, 4.4, 0.06, 2.4, spec.cx - 7.75, ceilY - 0.06, spec.cz - 8.1, pal.parchmentLinen, false, false);
  boxAt(cg, 4.4, 0.06, 6.2, spec.cx - 7.75, ceilY - 0.06, spec.cz + 5.6, pal.parchmentLinen, false, false);
  boxAt(cg, 3.2, 0.02, 0.06, spec.cx - 7.75, ceilY - 0.09, spec.cz + 5.6, pal.warmCoveLed, false, false);

  if (!skipStair) {
    boxAt(cg, 4.4, 0.06, 6.4, spec.cx - 7.75, ceilY - 0.06, spec.cz - 2.5, pal.parchmentLinen, false, false);
  }

  // Rotunda Skylight Bronze Trim Collar on L1 ceiling (framing downlight into G/L1 void)
  if (lv === 1) {
    boxAt(cg, 6.1, 0.16, 0.14, spec.cx + 3.8, ceilY - 0.12, spec.cz - 1.0, pal.champagneBronze, false, false);
    boxAt(cg, 6.1, 0.16, 0.14, spec.cx + 3.8, ceilY - 0.12, spec.cz + 5.0, pal.champagneBronze, false, false);
    boxAt(cg, 0.14, 0.16, 6.1, spec.cx + 0.8, ceilY - 0.12, spec.cz + 2.0, pal.champagneBronze, false, false);
    boxAt(cg, 0.14, 0.16, 6.1, spec.cx + 6.8, ceilY - 0.12, spec.cz + 2.0, pal.champagneBronze, false, false);
  }

  warmLights.push(
    {
      x: spec.cx + 3.6,
      y: ceilY - 0.45,
      z: spec.cz + 1.8,
      color: 0xffe4b8,
      distance: 18,
      baseScale: lv === 0 ? 1.1 : 0.95,
      floor: lv,
      buildingId: spec.id,
    },
    {
      x: spec.cx - 3.6,
      y: ceilY - 0.45,
      z: spec.cz - 4.2,
      color: 0xffdfa8,
      distance: 15,
      baseScale: 0.88,
      floor: lv,
      buildingId: spec.id,
    }
  );
}

/**
 * Custom 6-Story West-Wing Grand Reserve Stairwell & Illuminated Makore/Bronze Light-Loom Spine.
 * Footprint: dx -10.50 .. -5.00, dz -6.50 .. +1.50
 * - East Lane (dx -7.75 .. -5.00): Flight 1 climbs NORTH (dz +1.50 -> -4.25)
 * - North Panoramic Landing (dz -6.50 .. -4.25): Full-width balcony against North/West windows
 * - West Lane (dx -10.50 .. -7.75): Flight 2 climbs SOUTH (dz -4.25 -> +1.50) arriving at L(lv+1)
 */
function buildWestReserveStairwellLevel(
  lg: THREE.Group,
  pal: BankPalette,
  spec: DistrictBuildingSpec,
  lv: number,
  fy: number,
  M: MaterialLibrary
) {
  const vx0 = spec.cx - 10.5;
  const vx1 = spec.cx - 5.0;
  const xSpine = spec.cx - 7.75;
  const zNorth = spec.cz - 6.5;
  const zTurn = spec.cz - 4.25;
  const zSouth = spec.cz + 1.5;

  // Vertical 6-story Makore & Champagne-Bronze Woven Guilloché Light-Loom Spine between lanes
  boxAt(lg, 0.14, spec.floorH, 5.75, xSpine, fy + spec.floorH * 0.5, spec.cz - 1.38, pal.makoreWood, true, true, 0.015);
  [-3.8, -2.0, -0.2, 1.2].forEach((dz) => {
    boxAt(lg, 0.22, spec.floorH - 0.18, 0.08, xSpine, fy + spec.floorH * 0.5, spec.cz + dz, pal.champagneBronze, false, false);
  });
  boxAt(lg, 0.04, spec.floorH, 5.4, xSpine - 0.08, fy + spec.floorH * 0.5, spec.cz - 1.38, pal.warmCoveLed, false, false);
  boxAt(lg, 0.04, spec.floorH, 5.4, xSpine + 0.08, fy + spec.floorH * 0.5, spec.cz - 1.38, pal.tealSignalLed, false, false);

  const addStairGuard = (cx: number, cz: number, lenX: number, lenZ: number, h: number) => {
    const isX = lenX >= lenZ;
    boxAt(lg, lenX, h - 0.12, lenZ, cx, fy + (h - 0.12) * 0.5 + 0.06, cz, pal.bronzeTintedGlass, false, false);
    boxAt(lg, isX ? lenX + 0.04 : 0.08, 0.06, isX ? 0.08 : lenZ + 0.04, cx, fy + h, cz, pal.champagneBronze, false, false, 0.01);
    const posts = Math.max(2, Math.round(Math.max(lenX, lenZ) / 1.8) + 1);
    for (let p = 0; p < posts; p++) {
      const f = posts === 1 ? 0.5 : p / (posts - 1);
      const px = isX ? cx - lenX * 0.5 + f * lenX : cx;
      const pz = isX ? cz : cz - lenZ * 0.5 + f * lenZ;
      boxAt(lg, 0.05, h, 0.05, px, fy + h * 0.5, pz, pal.champagneBronze, false, false);
    }
  };

  // East shaft balustrade along dx = -5.00
  addStairGuard(vx1, spec.cz - 2.5, 0.05, 8.0, 1.06);

  if (lv === 0) {
    // Ground floor under-stair sculpted Limestone & Bronze Treasury Relief Wall blocking West under-flight lane at zSouth
    boxAt(lg, 2.68, 2.18, 0.16, spec.cx - 9.12, fy + 1.09, zSouth, pal.flutedLimestone, true, true, 0.02);
    boxAt(lg, 2.7, 0.08, 0.18, spec.cx - 9.12, fy + 2.2, zSouth, pal.champagneBronze, false, false);
    // Decorative olive specimen flanking East entry portal
    plant(lg, spec.cx - 4.2, fy, spec.cz + 1.2, 1.0, 601, M, 'olive');
  } else {
    // Upper levels: North edge drop-guard (dz = -6.50) + East-Lane safety guard on L5
    addStairGuard((vx0 + vx1) * 0.5, zNorth, vx1 - vx0, 0.05, 1.06);
    if (lv === spec.floors - 1) {
      addStairGuard(spec.cx - 6.38, zSouth, 2.66, 0.05, 1.06);
    }
  }

  // Flights ascending lv -> lv + 1
  if (lv < spec.floors - 1) {
    const halfRise = spec.floorH * 0.5;
    const runLen = zSouth - zTurn; // 5.75m
    const steps = 12;
    const stepD = runLen / steps;
    const stepH = halfRise / steps;

    // Flight 1 (East Lane: dx -7.75 .. -5.00, climbing North zSouth -> zTurn)
    const f1X = spec.cx - 6.38;
    const f1W = 2.48;
    for (let s = 0; s < steps; s++) {
      const sy = fy + (s + 0.5) * stepH;
      const sz = zSouth - (s + 0.5) * stepD;
      boxAt(lg, f1W, 0.11, stepD + 0.04, f1X, sy, sz, pal.stairTreadMat, true, true, 0.01);
      boxAt(lg, f1W, 0.02, 0.04, f1X, sy + 0.06, sz - stepD * 0.44, pal.champagneBronze, false, false);
    }
    [-0.95, 0.95].forEach((ox) => {
      const strLen = Math.hypot(runLen, halfRise);
      const stringer = boxAt(lg, 0.1, 0.18, strLen, f1X + ox, fy + halfRise * 0.5 - 0.12, (zSouth + zTurn) * 0.5, pal.obsidianBronze, false, false);
      stringer.rotation.x = Math.atan2(halfRise, runLen);
    });

    // Mid-Level Panoramic North Landing (dz -6.50 .. -4.25)
    const landW = vx1 - vx0 - 0.16;
    const landD = zTurn - zNorth;
    boxAt(lg, landW, 0.22, landD, (vx0 + vx1) * 0.5, fy + halfRise - 0.09, (zNorth + zTurn) * 0.5, pal.kilimanjaroSlate, true, true, 0.02);
    boxAt(lg, landW + 0.04, 0.06, landD + 0.04, (vx0 + vx1) * 0.5, fy + halfRise - 0.21, (zNorth + zTurn) * 0.5, pal.champagneBronze, false, false);

    // Flight 2 (West Lane: dx -10.50 .. -7.75, climbing South zTurn -> zSouth)
    const f2X = spec.cx - 9.12;
    const f2W = 2.48;
    for (let s = 0; s < steps; s++) {
      const sy = fy + halfRise + (s + 0.5) * stepH;
      const sz = zTurn + (s + 0.5) * stepD;
      boxAt(lg, f2W, 0.11, stepD + 0.04, f2X, sy, sz, pal.stairTreadMat, true, true, 0.01);
      boxAt(lg, f2W, 0.02, 0.04, f2X, sy + 0.06, sz + stepD * 0.44, pal.champagneBronze, false, false);
    }
    [-0.95, 0.95].forEach((ox) => {
      const strLen = Math.hypot(runLen, halfRise);
      const stringer = boxAt(lg, 0.1, 0.18, strLen, f2X + ox, fy + halfRise * 1.5 - 0.12, (zSouth + zTurn) * 0.5, pal.obsidianBronze, false, false);
      stringer.rotation.x = -Math.atan2(halfRise, runLen);
    });

    addZonePlaque(lg, 'Reserve Gallery Stairs', `Ascend to Level ${lv + 1}`, spec.cx - 6.38, fy + 2.42, zSouth - 0.12, 0);
  }
}

export function buildNairobiTrustBankWholeBuilding(ctx: BankBuildContext) {
  const {
    spec,
    levelGroups,
    levelCeilings,
    roofShellGroup,
    M,
    archMats,
    frameDarkMat,
    screenReg,
    registerChair,
    registerMonitor,
    pickMeshes,
    rotatingProps,
    warmLights,
  } = ctx;

  const pal = getBankPalette();
  const g0 = levelGroups[0];
  const fy0 = spec.groundY + 0.12;
  let monIdx = 0;

  // ============================================================================
  // SHARED ACOUSTIC CEILINGS, CONTINUOUS WEST STAIRWELL & NON-OVERLAPPING FLOORS
  // ============================================================================
  for (let lv = 0; lv < spec.floors; lv++) {
    const fy = spec.groundY + lv * spec.floorH + 0.12;
    const ceilY = spec.groundY + lv * spec.floorH + spec.floorH - 0.14;
    buildBespokeBankCeiling(levelCeilings[lv], pal, spec, ceilY, lv, warmLights);
    buildWestReserveStairwellLevel(levelGroups[lv], pal, spec, lv, fy, M);

    // Non-overlapping Rift-Limestone floor overlays framing voids cleanly
    if (lv === 1) {
      // L1 keeps BOTH West Stair Void (-10.5..-5.0 x -6.5..+1.5) & Double-Height Rotunda Void (+0.8..+6.8 x -1.0..+5.0) open
      boxAt(levelGroups[lv], 5.5, 0.022, 3.0, spec.cx - 7.75, fy + 0.011, spec.cz - 8.0, pal.riftLimestone, false, true);
      boxAt(levelGroups[lv], 5.5, 0.022, 8.0, spec.cx - 7.75, fy + 0.011, spec.cz + 5.5, pal.riftLimestone, false, true);
      boxAt(levelGroups[lv], 5.8, 0.022, 19.0, spec.cx - 2.1, fy + 0.011, spec.cz, pal.riftLimestone, false, true);
      boxAt(levelGroups[lv], 6.0, 0.022, 8.5, spec.cx + 3.8, fy + 0.011, spec.cz - 5.25, pal.riftLimestone, false, true);
      boxAt(levelGroups[lv], 6.0, 0.022, 4.5, spec.cx + 3.8, fy + 0.011, spec.cz + 7.25, pal.riftLimestone, false, true);
      boxAt(levelGroups[lv], 3.7, 0.022, 19.0, spec.cx + 8.65, fy + 0.011, spec.cz, pal.riftLimestone, false, true);
    } else if (lv >= 2) {
      // L2..L5 keep West Stair Void (-10.5..-5.0 x -6.5..+1.5) open
      boxAt(levelGroups[lv], 15.5, 0.022, 19.0, spec.cx + 2.75, fy + 0.011, spec.cz, pal.riftLimestone, false, true);
      boxAt(levelGroups[lv], 5.5, 0.022, 3.0, spec.cx - 7.75, fy + 0.011, spec.cz - 8.0, pal.riftLimestone, false, true);
      boxAt(levelGroups[lv], 5.5, 0.022, 8.0, spec.cx - 7.75, fy + 0.011, spec.cz + 5.5, pal.riftLimestone, false, true);
    }
  }

  // ============================================================================
  // L0 (G) — DOUBLE-HEIGHT ROTUNDA, STEPPED TELLER ARC, 24/7 BIOMETRIC ARCADE & GEARED VAULT
  // ============================================================================
  {
    // Stepped Fluted-Limestone Portico Colonnade + Makore Soffit Canopy
    [-3.8, -1.9, 1.9, 3.8].forEach((ox) => {
      cylAt(g0, 0.42, 0.46, 0.24, spec.doorX + ox, spec.groundY + 0.12, spec.doorZ + 1.4, pal.kilimanjaroSlate, true, true, 16);
      cylAt(g0, 0.31, 0.35, spec.floorH - 0.38, spec.doorX + ox, spec.groundY + 0.24 + (spec.floorH - 0.38) * 0.5, spec.doorZ + 1.4, pal.flutedLimestone, true, true, 20);
      cylAt(g0, 0.39, 0.32, 0.14, spec.doorX + ox, spec.groundY + spec.floorH - 0.15, spec.doorZ + 1.4, pal.champagneBronze, false, false, 20);
    });
    const bankPortico = new THREE.Mesh(getRoundedSlabGeo(10.4, 3.2, 0.95, 0.38, 0.07), pal.flutedLimestone);
    bankPortico.position.set(spec.doorX, spec.groundY + spec.floorH - 0.06, spec.doorZ + 1.05);
    bankPortico.castShadow = true;
    g0.add(bankPortico);
    boxAt(g0, 9.8, 0.08, 0.14, spec.doorX, spec.groundY + spec.floorH - 0.13, spec.doorZ + 2.62, pal.champagneBronze, false, false);
    const bankSoffit = new THREE.Mesh(getRoundedSlabGeo(9.5, 2.5, 0.75, 0.06, 0.015), pal.makoreWood);
    bankSoffit.position.set(spec.doorX, spec.groundY + spec.floorH - 0.25, spec.doorZ + 1.05);
    g0.add(bankSoffit);
    addZonePlaque(g0, 'Nairobi Trust Bank', 'TerraCraft Sovereign Reserve HQ', spec.doorX, spec.groundY + spec.floorH + 0.22, spec.doorZ + 2.66, 0);

    // Full Warm Rift-Limestone Ground Floor + Banknote Guilloché Compass Medallion under Double-Height Rotunda (+3.8, +2.0)
    boxAt(g0, 21.4, 0.025, 19.4, spec.cx, fy0 + 0.012, spec.cz, pal.riftLimestone, false, true);
    const medDisc = cylAt(g0, 2.7, 2.7, 0.016, spec.cx + 3.8, fy0 + 0.026, spec.cz + 2.0, pal.guillocheMosaic, false, true, 36);
    medDisc.rotation.y = -Math.PI / 2;

    // 2-Story Suspended Kinetic Sovereign Astrolabe Chandelier hanging through G/L1 Rotunda Void (+3.8, +2.0)
    const astroGroup = new THREE.Group();
    astroGroup.position.set(spec.cx + 3.8, fy0 + 4.35, spec.cz + 2.0);
    const outerGimbal = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.055, 12, 42), pal.champagneBronze);
    outerGimbal.rotation.x = Math.PI / 2 - 0.18;
    astroGroup.add(outerGimbal);
    const midGimbal = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.045, 10, 36), pal.banknoteCopper);
    midGimbal.rotation.y = 0.6;
    midGimbal.rotation.x = 0.48;
    astroGroup.add(midGimbal);
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.036, 10, 28), pal.warmCoveLed);
    innerRing.rotation.x = -0.35;
    astroGroup.add(innerRing);
    // Warm sunlit core lantern suspended from L1 ceiling
    const coreOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 1), pal.goldSpecie);
    astroGroup.add(coreOrb);
    g0.add(astroGroup);
    rotatingProps.push({ obj: astroGroup, speed: 0.16, axis: 'y' });
    // Vertical brass suspension cable up to L1 ceiling
    cylAt(g0, 0.015, 0.015, 3.6, spec.cx + 3.8, fy0 + 6.15, spec.cz + 2.0, pal.champagneBronze, false, false, 8);

    // Monumental Fluted Limestone Interior Columns framing the Banking Hall & Rotunda
    [
      [-3.8, -0.8],
      [7.6, -1.6],
      [7.6, 5.4],
    ].forEach(([cx, cz]) => buildLimestoneColumn(g0, pal, spec.cx + cx, fy0, spec.cz + cz, spec.floorH - 0.32));

    // SW 24/7 Biometric ATM & Digital Concierge Crescent (dx -8.8, -6.8, -4.8, dz +7.4 facing North)
    boxAt(g0, 6.4, 0.08, 2.0, spec.cx - 6.8, fy0 + 2.86, spec.cz + 7.2, pal.makoreWood, false, false, 0.02);
    boxAt(g0, 6.4, 0.04, 0.06, spec.cx - 6.8, fy0 + 2.89, spec.cz + 6.2, pal.warmCoveLed, false, false);
    boxAt(g0, 0.12, 2.86, 2.0, spec.cx - 3.3, fy0 + 1.43, spec.cz + 7.2, pal.frostedLoomGlass, false, false);
    boxAt(g0, 0.14, 2.86, 0.12, spec.cx - 3.3, fy0 + 1.43, spec.cz + 6.2, pal.champagneBronze, false, false);
    addZonePlaque(g0, '24/7 Biometric ATM', 'Cash, Cheque & Card Concierge', spec.cx - 6.8, fy0 + 2.58, spec.cz + 6.12, Math.PI);

    [-8.8, -6.8, -4.8].forEach((ox) => {
      const kg = new THREE.Group();
      kg.position.set(spec.cx + ox, fy0, spec.cz + 7.4);
      kg.rotation.y = Math.PI;
      boxAt(kg, 0.92, 1.98, 0.76, 0, 0.99, 0, pal.kilimanjaroSlate, true, true, 0.04);
      boxAt(kg, 0.86, 1.9, 0.06, 0, 0.99, 0.36, pal.champagneBronze, false, false, 0.015);
      boxAt(kg, 0.72, 0.18, 0.04, 0, 1.74, 0.39, pal.tealSignalLed, false, false);
      boxAt(kg, 0.56, 0.44, 0.04, 0, 1.32, 0.4, new THREE.MeshBasicMaterial({ color: 0x0f766e }), false, false);
      boxAt(kg, 0.64, 0.08, 0.24, 0, 0.96, 0.43, pal.bullionVaultSteel, false, false, 0.01);
      g0.add(kg);
    });

    // North-Center Sculpted Fluted-Makore & Rift-Limestone Teller Counter (dx -0.3, dz -4.8..-5.6)
    boxAt(g0, 8.6, 1.1, 0.54, spec.cx - 0.3, fy0 + 0.55, spec.cz - 4.8, pal.flutedLimestone, true, true, 0.03);
    boxAt(g0, 8.85, 0.08, 0.66, spec.cx - 0.3, fy0 + 1.14, spec.cz - 4.8, pal.makoreWood, false, true, 0.02);
    boxAt(g0, 8.88, 0.03, 0.68, spec.cx - 0.3, fy0 + 1.09, spec.cz - 4.8, pal.champagneBronze, false, false);
    boxAt(g0, 8.2, 0.74, 0.05, spec.cx - 0.3, fy0 + 1.55, spec.cz - 4.54, pal.clearArmorGlass, false, false);
    [-4.3, -2.4, -0.3, 1.8, 3.7].forEach((bx) => {
      boxAt(g0, 0.06, 0.78, 0.08, spec.cx + bx, fy0 + 1.55, spec.cz - 4.54, pal.champagneBronze, false, false);
    });
    // Rear teller work-deck at dz -5.6
    boxAt(g0, 8.6, 0.06, 0.92, spec.cx - 0.3, fy0 + 0.75, spec.cz - 5.6, pal.makoreWood, true, true, 0.015);
    [-4.3, -0.3, 3.7].forEach((lx) => {
      boxAt(g0, 0.14, 0.72, 0.78, spec.cx + lx, fy0 + 0.36, spec.cz - 5.54, pal.flutedLimestone, true, true, 0.01);
    });
    [-2.4, 1.8].forEach((ox, i) => {
      registerChair(0, spec.cx + ox, fy0, spec.cz - 6.4, 0, i === 0 ? 1 : -1);
      registerMonitor(
        0,
        monIdx++,
        [spec.cx + ox, fy0 + 0.78, spec.cz - 5.65],
        Math.PI,
        spec.cx + ox,
        spec.cz - 6.4,
        `Branch Teller ${i + 1}`,
        'Retail Banking & RTGS Hall'
      );
    });

    // Bronze & Savanna-Teal Queue Stanchions flanking bank-client-1 at (cx - 0.3, cz - 2.6)
    [-1.8, 1.2].forEach((sx) => {
      [-3.5, -1.9].forEach((sz) => {
        cylAt(g0, 0.14, 0.16, 0.04, spec.cx + sx, fy0 + 0.02, spec.cz + sz, pal.champagneBronze, false, true, 12);
        cylAt(g0, 0.028, 0.028, 0.92, spec.cx + sx, fy0 + 0.48, spec.cz + sz, pal.champagneBronze, true, false, 10);
        cylAt(g0, 0.045, 0.045, 0.06, spec.cx + sx, fy0 + 0.96, spec.cz + sz, pal.champagneBronze, false, false, 12);
      });
      cylAt(g0, 0.022, 0.022, 1.6, spec.cx + sx, fy0 + 0.84, spec.cz - 2.7, pal.savannaTealVelvet, false, false, 8).rotation.x = Math.PI / 2;
    });

    // Live Interbank FX & CBK Rates Wall Screen (North Wall behind tellers)
    const fxBoard = createCustomBoardScreen(screenReg, 680, 240, (g, w, h, t) => {
      g.fillStyle = '#121820';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#134e5e';
      g.fillRect(0, 0, w, 38);
      g.fillStyle = '#c9a96e';
      g.fillRect(0, 38, w, 3);
      g.fillStyle = '#f5efe2';
      g.font = '800 18px "Plus Jakarta Sans", sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('NAIROBI TRUST BANK · INTERBANK FX & CBK SOVEREIGN RATES', 18, 19);
      const rows = [
        ['USD / KES', '128.45', '129.90', '+0.14%'],
        ['EUR / KES', '139.20', '141.10', '+0.26%'],
        ['GBP / KES', '163.30', '165.50', '-0.06%'],
        ['CBK 182D T-BILL', '15.85%', 'AAA SOV', 'LIVE'],
      ];
      rows.forEach((r, i) => {
        const y = 52 + i * 44;
        g.fillStyle = i % 2 === 0 ? 'rgba(19,78,94,0.28)' : 'rgba(201,169,110,0.12)';
        rr(g, 16, y, w - 32, 36, 5);
        g.fill();
        g.fillStyle = '#f8fafc';
        g.font = '700 16px "IBM Plex Mono", monospace';
        g.fillText(r[0], 28, y + 18);
        g.fillStyle = '#5eead4';
        g.fillText(r[1], 235, y + 18);
        g.fillStyle = '#e5c583';
        g.fillText(r[2], 395, y + 18);
        g.fillStyle = r[3].startsWith('-') ? '#fca5a5' : '#4ade80';
        g.fillText(r[3], w - 102, y + 18);
      });
      void t;
    });
    boxAt(g0, 6.2, 2.3, 0.16, spec.cx - 0.3, fy0 + 2.35, spec.cz - 9.7, pal.makoreWood, false, false, 0.02);
    boxAt(g0, 5.95, 2.1, 0.08, spec.cx - 0.3, fy0 + 2.35, spec.cz - 9.63, pal.champagneBronze, false, false);
    const fxMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.75, 1.95), fxBoard.mat);
    fxMesh.position.set(spec.cx - 0.3, fy0 + 2.35, spec.cz - 9.58);
    g0.add(fxMesh);
    fxBoard.setMesh(fxMesh);

    // NE Open-Gear Cobalt-Steel & Champagne-Bronze Biometric Vault Portal (dx +7.2, dz -9.2)
    const vx = spec.cx + 7.2;
    const vz = spec.cz - 9.2;
    boxAt(g0, 4.4, 3.48, 0.66, vx, fy0 + 1.74, vz, pal.flutedLimestone, true, true, 0.05);
    boxAt(g0, 3.9, 3.12, 0.5, vx, fy0 + 1.64, vz + 0.14, pal.kilimanjaroSlate, true, true, 0.04);
    const vaultBezel = cylAt(g0, 1.44, 1.44, 0.24, vx, fy0 + 1.62, vz + 0.4, pal.champagneBronze, true, false, 32);
    vaultBezel.rotation.x = Math.PI / 2;
    const vaultDoor = cylAt(g0, 1.32, 1.32, 0.32, vx, fy0 + 1.62, vz + 0.44, pal.bullionVaultSteel, true, false, 32);
    vaultDoor.rotation.x = Math.PI / 2;
    // 8 radial steel locking bolts
    for (let b = 0; b < 8; b++) {
      const ba = (b * Math.PI) / 4;
      const bolt = cylAt(g0, 0.075, 0.075, 0.34, vx + Math.cos(ba) * 1.18, fy0 + 1.62 + Math.sin(ba) * 1.18, vz + 0.56, pal.bullionVaultSteel, false, false, 12);
      bolt.rotation.z = ba + Math.PI / 2;
    }
    // Armored glass window revealing exposed planetary brass gears
    const gearWindow = cylAt(g0, 0.62, 0.62, 0.08, vx, fy0 + 1.62, vz + 0.6, pal.clearArmorGlass, false, false, 24);
    gearWindow.rotation.x = Math.PI / 2;
    const gearRig = new THREE.Group();
    gearRig.position.set(vx, fy0 + 1.62, vz + 0.66);
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.048, 10, 24), pal.champagneBronze);
    gearRig.add(wheelRim);
    for (let s = 0; s < 4; s++) {
      const spoke = boxAt(gearRig, 0.9, 0.055, 0.055, 0, 0, 0, pal.champagneBronze, false, false);
      spoke.rotation.z = (s * Math.PI) / 4;
    }
    cylAt(gearRig, 0.18, 0.18, 0.12, 0, 0, 0.02, pal.kilimanjaroSlate, false, false, 16).rotation.x = Math.PI / 2;
    g0.add(gearRig);
    rotatingProps.push({ obj: gearRig, speed: 0.28, axis: 'z' });
    // Dual biometric iris pedestals flanking vault
    [-1.85, 1.85].forEach((ox) => {
      cylAt(g0, 0.14, 0.18, 1.32, vx + ox, fy0 + 0.66, vz + 0.85, pal.kilimanjaroSlate, true, true, 16);
      boxAt(g0, 0.24, 0.28, 0.16, vx + ox, fy0 + 1.42, vz + 0.85, pal.champagneBronze, false, false, 0.01);
      boxAt(g0, 0.16, 0.14, 0.04, vx + ox, fy0 + 1.44, vz + 0.94, pal.tealSignalLed, false, false);
    });
    addZonePlaque(g0, 'Treasury Vault II', 'Planetary Time-Lock & Bullion Safe', vx, fy0 + 3.22, vz + 0.44, 0);

    // Adjacent Bullion Specie Showcase Pedestal (dx +9.1, dz -5.4)
    cylAt(g0, 0.48, 0.56, 1.02, spec.cx + 9.1, fy0 + 0.51, spec.cz - 5.4, pal.kilimanjaroSlate, true, true, 18);
    cylAt(g0, 0.5, 0.5, 0.05, spec.cx + 9.1, fy0 + 1.04, spec.cz - 5.4, pal.champagneBronze, false, false, 18);
    boxAt(g0, 0.14, 0.08, 0.32, spec.cx + 9.0, fy0 + 1.11, spec.cz - 5.4, pal.goldSpecie, true, false, 0.01);
    boxAt(g0, 0.14, 0.08, 0.32, spec.cx + 9.2, fy0 + 1.11, spec.cz - 5.4, pal.goldSpecie, true, false, 0.01);
    boxAt(g0, 0.52, 0.34, 0.52, spec.cx + 9.1, fy0 + 1.24, spec.cz - 5.4, pal.clearArmorGlass, false, false);

    // SE Sculpted Curved Savanna-Teal Lobby Banquette & Limestone Table (dx +8.6, dz +6.2)
    boxAt(g0, 1.05, 0.44, 3.0, spec.cx + 8.9, fy0 + 0.22, spec.cz + 6.2, pal.makoreWood, true, true, 0.04);
    boxAt(g0, 0.92, 0.14, 2.84, spec.cx + 8.85, fy0 + 0.48, spec.cz + 6.2, pal.savannaTealVelvet, true, true, 0.04);
    boxAt(g0, 0.24, 0.56, 2.84, spec.cx + 9.3, fy0 + 0.72, spec.cz + 6.2, pal.savannaTealVelvet, true, true, 0.04);
    cylAt(g0, 0.48, 0.48, 0.05, spec.cx + 7.2, fy0 + 0.46, spec.cz + 6.2, pal.riftLimestone, true, true, 20);
    cylAt(g0, 0.07, 0.14, 0.44, spec.cx + 7.2, fy0 + 0.22, spec.cz + 6.2, pal.champagneBronze, false, false, 14);

    plant(g0, spec.cx - 9.4, fy0, spec.cz - 8.4, 1.15, 602, M, 'ficus');
    plant(g0, spec.cx - 9.4, fy0, spec.cz + 3.0, 1.0, 603, M, 'olive');
    plant(g0, spec.cx + 2.0, fy0, spec.cz + 6.8, 1.05, 604, M, 'ficus');
  }

  // ============================================================================
  // L1 — DOUBLE-HEIGHT ROTUNDA GALLERY, TRADE CORRIDORS & CRESCENT PODS
  // ============================================================================
  {
    const g1 = levelGroups[1];
    const fy1 = spec.groundY + spec.floorH + 0.12;

    // 1. Double-Height Rotunda Balustrade Ring framing (+0.8..+6.8, -1.0..+5.0)
    const addRotundaRail = (cx: number, cz: number, lx: number, lz: number) => {
      const isX = lx >= lz;
      boxAt(g1, lx, 0.14, lz, cx, fy1 + 0.07, cz, pal.flutedLimestone, true, true);
      boxAt(g1, lx, 0.94, lz, cx, fy1 + 0.61, cz, pal.clearArmorGlass, false, false);
      boxAt(g1, isX ? lx + 0.08 : 0.09, 0.06, isX ? 0.09 : lz + 0.08, cx, fy1 + 1.09, cz, pal.champagneBronze, false, false, 0.01);
    };
    addRotundaRail(spec.cx + 3.8, spec.cz - 1.0, 6.0, 0.08);
    addRotundaRail(spec.cx + 3.8, spec.cz + 5.0, 6.0, 0.08);
    addRotundaRail(spec.cx + 0.8, spec.cz + 2.0, 0.08, 6.0);
    addRotundaRail(spec.cx + 6.8, spec.cz + 2.0, 0.08, 6.0);
    addZonePlaque(g1, 'Rotunda Overlook', 'Kinetic Astrolabe & Trade Hall', spec.cx + 3.8, fy1 + 0.72, spec.cz + 5.08, 0);

    // 2. Open-Plan Makore-Rib Acoustic Crescent Consultation Pods (North Wing: dx -1.6 & +4.4, dz -5.8)
    [
      { dx: -1.6, role: 'Trade Finance Structuring Lead · L1', zone: 'Trade Finance Pavilion' },
      { dx: 4.4, role: 'Corridor LC Officer · L1', zone: 'Export Letters of Credit' },
    ].forEach((pod, pi) => {
      buildAcousticCrescentPod(g1, pal, spec.cx + pod.dx, fy1, spec.cz - 5.4, 2.35, 2.75);
      buildReserveDesk(g1, pal, spec.cx + pod.dx, fy1, spec.cz - 5.6, 2.3, 1.0, 0, true);
      registerChair(1, spec.cx + pod.dx, fy1, spec.cz - 6.6, 0, pi % 2 === 0 ? 1 : -1);
      registerMonitor(
        1,
        monIdx++,
        [spec.cx + pod.dx, fy1 + 0.78, spec.cz - 5.65],
        Math.PI,
        spec.cx + pod.dx,
        spec.cz - 6.6,
        pod.role,
        pod.zone
      );
      armchair(g1, spec.cx + pod.dx - 0.65, fy1, spec.cz - 4.1, Math.PI, pal.savannaTealVelvet, M);
      armchair(g1, spec.cx + pod.dx + 0.65, fy1, spec.cz - 4.1, Math.PI, pal.savannaTealVelvet, M);
    });
    addZonePlaque(g1, 'Trade Finance Pods', 'Documentary Credits & Export Finance', spec.cx + 1.4, fy1 + 2.95, spec.cz - 3.3, 0);

    // 3. SW East African Trade Corridor Wall Relief & Digital Briefing Console (Original!)
    const tradeBoard = createCustomBoardScreen(screenReg, 580, 240, (g, w, h, t) => {
      g.fillStyle = '#121820';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9a96e';
      g.fillRect(0, 0, w, 34);
      g.fillStyle = '#121820';
      g.font = '800 17px "Plus Jakarta Sans", sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('EAST AFRICA EXPORT CORRIDOR & TRADE LC TELEMETRY', 16, 17);
      const corridors = [
        ['MOMBASA PORT -> KAMPALA', 'USD 42.8M', '18 ACTIVE LCS'],
        ['NAIROBI -> KIGALI SGR', 'USD 26.4M', '94% CLEARED'],
        ['DAR -> NAIROBI TEA/AGRI', 'USD 19.1M', '72H DISBURSE'],
      ];
      corridors.forEach((it, i) => {
        const y = 52 + i * 54;
        g.fillStyle = i === Math.floor(t / 2.5) % 3 ? 'rgba(19,78,94,0.45)' : 'rgba(201,169,110,0.12)';
        rr(g, 16, y, w - 32, 44, 6);
        g.fill();
        g.fillStyle = '#f8fafc';
        g.font = '700 15px "IBM Plex Mono", monospace';
        g.fillText(it[0], 26, y + 22);
        g.fillStyle = '#5eead4';
        g.fillText(it[1], 295, y + 22);
        g.fillStyle = '#e5c583';
        g.fillText(it[2], 425, y + 22);
      });
    });
    boxAt(g1, 0.14, 2.05, 4.6, spec.cx - 10.45, fy1 + 2.25, spec.cz + 5.8, pal.makoreWood, false, false);
    const trMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.75), tradeBoard.mat);
    trMesh.rotation.y = Math.PI / 2;
    trMesh.position.set(spec.cx - 10.35, fy1 + 2.25, spec.cz + 5.8);
    g1.add(trMesh);
    tradeBoard.setMesh(trMesh);

    // Sculpted Copper & Slate Corridor Table (dx -6.2, dz +5.8 — ZERO miniature buildings!)
    boxAt(g1, 2.8, 0.82, 1.6, spec.cx - 6.2, fy1 + 0.41, spec.cz + 5.8, pal.flutedLimestone, true, true, 0.03);
    boxAt(g1, 2.92, 0.07, 1.72, spec.cx - 6.2, fy1 + 0.85, spec.cz + 5.8, pal.kilimanjaroSlate, true, true, 0.015);
    // Bronze corridor node pylons connected by copper trade rails
    [
      [-0.9, -0.35],
      [-0.1, 0.12],
      [0.85, 0.4],
    ].forEach(([nx, nz]) => {
      cylAt(g1, 0.06, 0.08, 0.18, spec.cx - 6.2 + nx, fy1 + 0.98, spec.cz + 5.8 + nz, pal.banknoteCopper, false, false, 12);
      cylAt(g1, 0.04, 0.04, 0.03, spec.cx - 6.2 + nx, fy1 + 1.09, spec.cz + 5.8 + nz, pal.tealSignalLed, false, false, 12);
    });
    boxAt(g1, 1.8, 0.03, 0.04, spec.cx - 6.2, fy1 + 0.92, spec.cz + 5.8, pal.champagneBronze, false, false);

    // South-Center Diaspora & Commercial Advisory Desk (dx -2.2, dz +6.2)
    buildReserveDesk(g1, pal, spec.cx - 2.2, fy1, spec.cz + 6.2, 2.4, 1.0, Math.PI, true);
    registerChair(1, spec.cx - 2.2, fy1, spec.cz + 7.2, Math.PI, 1);
    registerMonitor(
      1,
      monIdx++,
      [spec.cx - 2.2, fy1 + 0.78, spec.cz + 6.15],
      0,
      spec.cx - 2.2,
      spec.cz + 7.2,
      'Diaspora & Commercial Advisor · L1',
      'Trade & Commercial Advisory'
    );

    // East Gallery Specimens & Seating
    plant(g1, spec.cx + 9.2, fy1, spec.cz - 8.2, 1.1, 611, M, 'olive');
    plant(g1, spec.cx - 9.4, fy1, spec.cz - 8.2, 1.05, 612, M, 'ficus');
    plant(g1, spec.cx + 9.2, fy1, spec.cz + 7.8, 1.05, 613, M, 'olive');
  }

  // ============================================================================
  // L2 — CAPITAL MARKETS & CURVED HORSESHOE FX DEALING AMPHITHEATER
  // ============================================================================
  {
    const g2 = levelGroups[2];
    const fy2 = spec.groundY + 2 * spec.floorH + 0.12;
    const ceilY2 = spec.groundY + 2 * spec.floorH + spec.floorH - 0.14;

    // Circular Acoustic Halo Canopy suspended above the Horseshoe Dealing Floor (cx + 3.2, cz - 0.8)
    const canopyRing = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 10, 36), pal.makoreWood);
    canopyRing.rotation.x = Math.PI / 2;
    canopyRing.position.set(spec.cx + 3.2, ceilY2 - 0.45, spec.cz - 0.8);
    g2.add(canopyRing);
    const canopyLed = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.035, 8, 36), pal.cobaltLedgerLed);
    canopyLed.rotation.x = Math.PI / 2;
    canopyLed.position.set(spec.cx + 3.2, ceilY2 - 0.56, spec.cz - 0.8);
    g2.add(canopyLed);

    // Center Sculpted Sovereign Yield Totem Pillar inside Horseshoe (cx + 3.2, cz - 0.8)
    cylAt(g2, 0.58, 0.66, 0.28, spec.cx + 3.2, fy2 + 0.14, spec.cz - 0.8, pal.kilimanjaroSlate, true, true, 20);
    cylAt(g2, 0.26, 0.34, 2.35, spec.cx + 3.2, fy2 + 1.45, spec.cz - 0.8, pal.flutedLimestone, true, false, 18);
    const yieldRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.04, 8, 28), pal.champagneBronze);
    yieldRing.rotation.x = Math.PI / 2;
    yieldRing.position.set(spec.cx + 3.2, fy2 + 2.25, spec.cz - 0.8);
    g2.add(yieldRing);
    rotatingProps.push({ obj: yieldRing, speed: 0.35, axis: 'y' });

    // 4 Radial Dealing Consoles arranged in Horseshoe Arc centered at (cx + 3.2, cz - 0.8)
    const hx = spec.cx + 3.2;
    const hz = spec.cz - 0.8;
    const horseshoeAngles = [
      { a: -0.9, role: 'Lead FX Spot Trader · L2' },
      { a: -0.3, role: 'Money Markets Dealer · L2' },
      { a: 0.3, role: 'Sovereign Bond Strategist · L2' },
      { a: 0.9, role: 'Treasury Liquidity Analyst · L2' },
    ];
    horseshoeAngles.forEach((h, hi) => {
      const rDesk = 3.45;
      const rChair = 2.45;
      const dx = hx + Math.sin(h.a) * rDesk;
      const dz = hz - Math.cos(h.a) * rDesk;
      const chX = hx + Math.sin(h.a) * rChair;
      const chZ = hz - Math.cos(h.a) * rChair;
      const monX = hx + Math.sin(h.a) * (rDesk - 0.16);
      const monZ = hz - Math.cos(h.a) * (rDesk - 0.16);

      const deskGrp = new THREE.Group();
      deskGrp.position.set(dx, fy2, dz);
      deskGrp.rotation.y = -h.a;
      boxAt(deskGrp, 2.05, 0.74, 0.96, 0, 0.37, 0, pal.kilimanjaroSlate, true, true, 0.02);
      boxAt(deskGrp, 2.15, 0.06, 1.04, 0, 0.76, 0, pal.makoreWood, true, true, 0.015);
      boxAt(deskGrp, 2.18, 0.03, 1.06, 0, 0.71, 0, pal.champagneBronze, false, false);
      boxAt(deskGrp, 1.8, 0.24, 0.05, 0, 0.9, -0.4, pal.bronzeTintedGlass, false, false);
      g2.add(deskGrp);

      registerChair(2, chX, fy2, chZ, Math.PI - h.a, hi % 2 === 0 ? 1 : -1);
      registerMonitor(
        2,
        monIdx++,
        [monX, fy2 + 0.79, monZ],
        -h.a,
        chX,
        chZ,
        h.role,
        'FX & Sovereign Yield Horseshoe'
      );
    });

    // Panoramic 3-Bay Capital Markets & CBK T-Bill Telemetry Wall along North Wall (cx + 2.8, cz - 9.4)
    const bondBoard = createCustomBoardScreen(screenReg, 720, 260, (g, w, h, t) => {
      g.fillStyle = '#0d141d';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9a96e';
      g.fillRect(0, 0, w, 36);
      g.fillStyle = '#0d141d';
      g.font = '800 18px "Plus Jakarta Sans", sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('SOVEREIGN BOND AUCTION & EAC FX LIQUIDITY MONITOR', 18, 18);
      const bars = [0.68, 0.78, 0.85, 0.92, 0.88, 0.94, 0.81];
      const lbls = ['91D', '182D', '364D', '2Y IFB', '5Y FXD', '10Y FXD', 'EUROBOND'];
      bars.forEach((b, i) => {
        const bx = 42 + i * 94;
        const wave = 0.04 * Math.sin(t * 2 + i);
        const bh = (b + wave) * 145;
        g.fillStyle = i % 2 === 0 ? '#38bdf8' : '#2dd4bf';
        rr(g, bx, h - 42 - bh, 52, bh, 5);
        g.fill();
        g.fillStyle = '#e2e8f0';
        g.font = '700 13px "IBM Plex Mono", monospace';
        g.fillText(lbls[i], bx + 4, h - 22);
      });
    });
    boxAt(g2, 7.6, 2.45, 0.16, spec.cx + 2.8, fy2 + 2.15, spec.cz - 9.6, pal.makoreWood, false, false, 0.02);
    boxAt(g2, 7.35, 2.24, 0.08, spec.cx + 2.8, fy2 + 2.15, spec.cz - 9.52, pal.champagneBronze, false, false);
    const bMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.1, 2.05), bondBoard.mat);
    bMesh.position.set(spec.cx + 2.8, fy2 + 2.15, spec.cz - 9.46);
    g2.add(bMesh);
    bondBoard.setMesh(bMesh);

    // Quantitative Risk Strategist Alcove (SW dx -1.8, dz +5.8)
    buildReserveDesk(g2, pal, spec.cx - 1.8, fy2, spec.cz + 5.8, 2.5, 1.05, Math.PI, true);
    registerChair(2, spec.cx - 1.8, fy2, spec.cz + 6.8, Math.PI, 1);
    registerMonitor(
      2,
      monIdx++,
      [spec.cx - 1.8, fy2 + 0.78, spec.cz + 5.75],
      0,
      spec.cx - 1.8,
      spec.cz + 6.8,
      'Treasury Risk Quant · L2',
      'Quantitative Hedging Alcove'
    );
    plant(g2, spec.cx + 9.4, fy2, spec.cz - 8.2, 1.05, 621, M, 'olive');
    plant(g2, spec.cx - 9.4, fy2, spec.cz + 8.0, 1.05, 622, M, 'ficus');
  }

  // ============================================================================
  // L3 — PRIVATE BANKING SANCTUARY & CIRCULAR BULLION ASSAY ROTUNDA
  // ============================================================================
  {
    const g3 = levelGroups[3];
    const fy3 = spec.groundY + 3 * spec.floorH + 0.12;

    // 1. NE Circular Bronze-Colonnade Safe Deposit & Assay Rotunda (centered at cx + 4.4, cz - 3.6, r = 4.2m)
    const rx = spec.cx + 4.4;
    const rz = spec.cz - 3.6;
    const rotRad = 4.15;
    // Circular Kilimanjaro-Slate floor plinth inlay
    cylAt(g3, rotRad + 0.25, rotRad + 0.25, 0.025, rx, fy3 + 0.028, rz, pal.kilimanjaroSlate, false, true, 36);
    // 6 fluted limestone colonnade piers framing generous NW & SW walking portals
    [0.2, 1.15, 2.25, 3.35, 4.35, 5.4].forEach((ang) => {
      buildLimestoneColumn(g3, pal, rx + Math.cos(ang) * rotRad, fy3, rz + Math.sin(ang) * rotRad, spec.floorH - 0.55);
    });
    // Overhead circular bronze frieze crowning the rotunda
    const rotCap = new THREE.Mesh(new THREE.TorusGeometry(rotRad, 0.14, 10, 40), pal.champagneBronze);
    rotCap.rotation.x = Math.PI / 2;
    rotCap.position.set(rx, fy3 + spec.floorH - 0.58, rz);
    g3.add(rotCap);
    addZonePlaque(g3, 'Bullion Assay Rotunda', '24K Specie & Dual-Key Custody', rx - 2.6, fy3 + 2.55, rz + 3.2, -0.5);

    // Curved Safe-Deposit Locker Matrix along North-East Arc behind Rotunda (dz -9.2)
    boxAt(g3, 6.8, 2.72, 0.48, spec.cx + 4.4, fy3 + 1.36, spec.cz - 9.0, pal.bullionVaultSteel, true, true, 0.03);
    boxAt(g3, 6.4, 2.42, 0.06, spec.cx + 4.4, fy3 + 1.36, spec.cz - 8.72, pal.lockerFaceMat, false, false);
    boxAt(g3, 6.5, 0.05, 0.12, spec.cx + 4.4, fy3 + 2.68, spec.cz - 8.7, pal.warmCoveLed, false, false);

    // Center Circular Bullion Assay Precision Balance Table (rx, rz)
    cylAt(g3, 0.96, 1.04, 0.9, rx, fy3 + 0.45, rz, pal.kilimanjaroSlate, true, true, 24);
    cylAt(g3, 1.04, 1.04, 0.06, rx, fy3 + 0.93, rz, pal.champagneBronze, false, false, 24);
    // 24K Gold Ingot Triad + Precision Apothecary Balance Beam under Glass Dome
    [-0.32, 0.0, 0.32].forEach((bx) => {
      boxAt(g3, 0.14, 0.075, 0.3, rx + bx, fy3 + 1.0, rz + 0.24, pal.goldSpecie, true, false, 0.01);
    });
    cylAt(g3, 0.025, 0.04, 0.44, rx, fy3 + 1.18, rz - 0.18, pal.champagneBronze, false, false, 12);
    boxAt(g3, 0.54, 0.025, 0.025, rx, fy3 + 1.38, rz - 0.18, pal.champagneBronze, false, false);
    [-0.24, 0.24].forEach((px) => {
      cylAt(g3, 0.11, 0.09, 0.02, rx + px, fy3 + 1.16, rz - 0.18, pal.goldSpecie, false, false, 14);
    });
    cylAt(g3, 0.62, 0.62, 0.56, rx, fy3 + 1.24, rz, pal.clearArmorGlass, false, false, 24);

    // 2. SE Private Wealth Parlor: Makore Heritage Library Wall + Wealth Director Desk
    boxAt(g3, 0.56, 2.7, 3.8, spec.cx + 10.0, fy3 + 1.35, spec.cz + 5.6, pal.makoreWood, true, true, 0.02);
    [0.75, 1.45, 2.15].forEach((shY) => {
      boxAt(g3, 0.58, 0.04, 3.6, spec.cx + 9.94, fy3 + shY, spec.cz + 5.6, pal.champagneBronze, false, false);
    });
    buildReserveDesk(g3, pal, spec.cx + 0.8, fy3, spec.cz + 5.2, 2.4, 1.0, Math.PI, true);
    registerChair(3, spec.cx + 0.8, fy3, spec.cz + 6.2, Math.PI, -1);
    registerMonitor(
      3,
      monIdx++,
      [spec.cx + 0.8, fy3 + 0.78, spec.cz + 5.15],
      0,
      spec.cx + 0.8,
      spec.cz + 6.2,
      'Private Wealth Director · L3',
      'Private Wealth Parlor'
    );
    armchair(g3, spec.cx + 5.6, fy3, spec.cz + 5.8, -Math.PI / 2, pal.savannaTealVelvet, M);
    armchair(g3, spec.cx + 7.2, fy3, spec.cz + 7.2, Math.PI, pal.ochreSaddleHide, M);

    // 3. West-Center Family Office Fiduciary Stations (clear of West Stairwell dx -5.00)
    [
      { dz: -6.2, seatDz: -7.2, rotC: 0, rotM: Math.PI, role: 'Trust & Estate Fiduciary · L3' },
      { dz: 3.2, seatDz: 4.2, rotC: Math.PI, rotM: 0, role: 'Diaspora Custody Strategist · L3' },
    ].forEach((f, fi) => {
      buildReserveDesk(g3, pal, spec.cx - 2.2, fy3, spec.cz + f.dz, 2.3, 1.0, f.rotC, true);
      registerChair(3, spec.cx - 2.2, fy3, spec.cz + f.seatDz, f.rotC, fi % 2 === 0 ? 1 : -1);
      registerMonitor(
        3,
        monIdx++,
        [spec.cx - 2.2, fy3 + 0.78, spec.cz + f.dz + (fi === 0 ? -0.05 : 0.05)],
        f.rotM,
        spec.cx - 2.2,
        spec.cz + f.seatDz,
        f.role,
        'Family Office Advisory'
      );
    });
    plant(g3, spec.cx - 9.4, fy3, spec.cz + 8.0, 1.05, 631, M, 'ficus');
    plant(g3, spec.cx + 9.2, fy3, spec.cz - 8.2, 1.0, 632, M, 'olive');
  }

  // ============================================================================
  // L4 — CLEARINGHOUSE COMMAND BRIDGE, CYBER-FRAUD DEFENSE & AUDIT TRIBUNAL
  // ============================================================================
  {
    const g4 = levelGroups[4];
    const fy4 = spec.groundY + 4 * spec.floorH + 0.12;

    // 1. Live Panoramic ISO-20022 Clearing & Sanctions Command Wall (North Wing: dx +2.8, dz -9.4)
    const swiftBoard = createCustomBoardScreen(screenReg, 680, 240, (g, w, h, t) => {
      g.fillStyle = '#0d141d';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#134e5e';
      g.fillRect(0, 0, w, 36);
      g.fillStyle = '#5eead4';
      g.font = '800 17px "Plus Jakarta Sans", sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('SWIFT ISO-20022 CLEARINGHOUSE & CYBER-FRAUD TELEMETRY', 18, 18);
      const metrics = [
        ['RTGS CLEARING VOLUME', 'KES 48.2B', '99.98% SLA'],
        ['ISO-20022 MESSAGES', '14,820 / HR', 'ZERO QUEUE'],
        ['AML ANOMALY SHIELD', '0 CRITICAL', 'VERIFIED'],
      ];
      metrics.forEach((m, i) => {
        const y = 54 + i * 54;
        g.fillStyle = i === Math.floor(t / 3) % 3 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(201, 169, 110, 0.1)';
        rr(g, 16, y, w - 32, 44, 6);
        g.fill();
        g.fillStyle = '#f8fafc';
        g.font = '700 15px "IBM Plex Mono", monospace';
        g.fillText(m[0], 28, y + 22);
        g.fillStyle = '#e5c583';
        g.fillText(m[1], 325, y + 22);
        g.fillStyle = '#4ade80';
        g.fillText(m[2], 495, y + 22);
      });
    });
    boxAt(g4, 6.8, 2.35, 0.16, spec.cx + 2.8, fy4 + 2.25, spec.cz - 9.5, pal.makoreWood, false, false, 0.02);
    boxAt(g4, 6.55, 2.15, 0.08, spec.cx + 2.8, fy4 + 2.25, spec.cz - 9.42, pal.champagneBronze, false, false);
    const swMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.35, 1.98), swiftBoard.mat);
    swMesh.position.set(spec.cx + 2.8, fy4 + 2.25, spec.cz - 9.36);
    g4.add(swMesh);
    swiftBoard.setMesh(swMesh);
    addZonePlaque(g4, 'Clearinghouse Bridge', 'ISO-20022 & Fraud Telemetry', spec.cx + 2.8, fy4 + 3.62, spec.cz - 9.3, 0);

    // Twin Open Clearing Consoles facing North toward Command Wall (dx +0.4 & +5.2, dz -4.2)
    [
      { dx: 0.4, role: 'SWIFT Settlement Officer · L4' },
      { dx: 5.2, role: 'Cyber-Fraud Defense Lead · L4' },
    ].forEach((s, si) => {
      buildReserveDesk(g4, pal, spec.cx + s.dx, fy4, spec.cz - 4.2, 2.4, 1.0, Math.PI, true);
      boxAt(g4, 2.3, 0.36, 0.05, spec.cx + s.dx, fy4 + 0.96, spec.cz - 4.72, pal.bronzeTintedGlass, false, false);
      registerChair(4, spec.cx + s.dx, fy4, spec.cz - 3.2, Math.PI, si === 0 ? 1 : -1);
      registerMonitor(
        4,
        monIdx++,
        [spec.cx + s.dx, fy4 + 0.78, spec.cz - 4.25],
        0,
        spec.cx + s.dx,
        spec.cz - 3.2,
        s.role,
        'Clearinghouse Command Bridge'
      );
    });

    // 2. SE Regulatory Audit & Compliance Tribunal Chamber (Boat-shaped Makore & Limestone Table at dx +4.8, dz +5.4)
    boxAt(g4, 5.2, 0.08, 1.8, spec.cx + 4.8, fy4 + 0.74, spec.cz + 5.4, pal.makoreWood, true, true, 0.025);
    boxAt(g4, 4.4, 0.025, 0.44, spec.cx + 4.8, fy4 + 0.79, spec.cz + 5.4, pal.champagneBronze, false, false);
    [2.8, 6.8].forEach((px) => boxAt(g4, 0.24, 0.7, 1.1, spec.cx + px, fy4 + 0.35, spec.cz + 5.4, pal.flutedLimestone, true, true, 0.02));
    boxAt(g4, 0.65, 2.35, 3.8, spec.cx + 10.0, fy4 + 1.175, spec.cz + 5.4, pal.bullionVaultSteel, true, true, 0.02);

    registerChair(4, spec.cx + 3.2, fy4, spec.cz + 4.0, 0, 1);
    registerMonitor(
      4,
      monIdx++,
      [spec.cx + 3.2, fy4 + 0.8, spec.cz + 4.85],
      Math.PI,
      spec.cx + 3.2,
      spec.cz + 4.0,
      'Internal Audit Director · L4',
      'Audit Tribunal Chamber'
    );
    registerChair(4, spec.cx + 6.4, fy4, spec.cz + 6.8, Math.PI, -1);
    registerMonitor(
      4,
      monIdx++,
      [spec.cx + 6.4, fy4 + 0.8, spec.cz + 5.95],
      0,
      spec.cx + 6.4,
      spec.cz + 6.8,
      'Chief Compliance Officer · L4',
      'Audit Tribunal Chamber'
    );

    // 3. SW Operational Risk Directorate Alcove (dx -6.6, dz +5.8)
    buildReserveDesk(g4, pal, spec.cx - 6.6, fy4, spec.cz + 5.8, 2.4, 1.0, Math.PI, true);
    registerChair(4, spec.cx - 6.6, fy4, spec.cz + 6.8, Math.PI, 1);
    registerMonitor(
      4,
      monIdx++,
      [spec.cx - 6.6, fy4 + 0.78, spec.cz + 5.75],
      0,
      spec.cx - 6.6,
      spec.cz + 6.8,
      'Operational Risk Director · L4',
      'Regulatory Risk Directorate'
    );
    plant(g4, spec.cx - 9.4, fy4, spec.cz + 8.0, 1.05, 641, M, 'ficus');
    plant(g4, spec.cx + 9.2, fy4, spec.cz - 8.2, 1.0, 642, M, 'olive');
  }

  // ============================================================================
  // L5 — DIPLOMATIC BOARDROOM, GOVERNOR SUITE & MONETARY HERITAGE ARCHIVE
  // ============================================================================
  {
    const g5 = levelGroups[5];
    const fy5 = spec.groundY + 5 * spec.floorH + 0.12;
    const wallH5 = spec.floorH - 0.55;

    // 1. NE Diplomatic Boardroom framed by Fluted Makore Colonnade (cx +3.2, cz -3.8 — open West & South circulation)
    [-0.4, 6.8].forEach((px) => {
      [-7.4, -0.2].forEach((pz) => {
        buildLimestoneColumn(g5, pal, spec.cx + px, fy5, spec.cz + pz, wallH5);
      });
    });
    // Vertical bronze-and-parchment acoustic baffle screen on North perimeter (dz -8.8)
    boxAt(g5, 7.6, wallH5, 0.18, spec.cx + 3.2, fy5 + wallH5 * 0.5, spec.cz - 8.8, pal.parchmentLinen, true, false);
    addZonePlaque(g5, 'Diplomatic Boardroom', 'Bank Directorate & Reserve Policy', spec.cx + 3.2, fy5 + 2.8, spec.cz - 8.66, 0);

    // 5.8m Kilimanjaro-Slate & Makore Executive Boardroom Table (cx +3.2, cz -3.8)
    boxAt(g5, 5.8, 0.08, 2.0, spec.cx + 3.2, fy5 + 0.75, spec.cz - 3.8, pal.kilimanjaroSlate, true, true, 0.03);
    boxAt(g5, 5.2, 0.022, 1.2, spec.cx + 3.2, fy5 + 0.8, spec.cz - 3.8, pal.makoreWood, false, false);
    boxAt(g5, 4.2, 0.025, 0.36, spec.cx + 3.2, fy5 + 0.815, spec.cz - 3.8, pal.champagneBronze, false, false);
    [1.4, 5.0].forEach((lx) => boxAt(g5, 0.34, 0.7, 1.15, spec.cx + lx, fy5 + 0.35, spec.cz - 3.8, pal.flutedLimestone, true, true, 0.02));

    // 4 Board Members (Chairs 0..3)
    const boardRoles = [
      { dx: 1.6, dz: -5.2, mdz: -4.4, rotC: 0, rotM: Math.PI, role: 'Board Chairperson · L5' },
      { dx: 4.8, dz: -5.2, mdz: -4.4, rotC: 0, rotM: Math.PI, role: 'Chief Risk Officer · L5' },
      { dx: 1.6, dz: -2.4, mdz: -3.2, rotC: Math.PI, rotM: 0, role: 'Managing Director · L5' },
      { dx: 4.8, dz: -2.4, mdz: -3.2, rotC: Math.PI, rotM: 0, role: 'General Counsel · L5' },
    ];
    boardRoles.forEach((b, bi) => {
      registerChair(5, spec.cx + b.dx, fy5, spec.cz + b.dz, b.rotC, bi % 2 === 0 ? 1 : -1);
      registerMonitor(
        5,
        monIdx++,
        [spec.cx + b.dx, fy5 + 0.8, spec.cz + b.mdz],
        b.rotM,
        spec.cx + b.dx,
        spec.cz + b.dz,
        b.role,
        'Diplomatic Boardroom'
      );
    });

    // Reserve Capital Strategy Boardroom Screen on East Wall (cx +10.0, cz -3.8)
    const execBoard = createCustomBoardScreen(screenReg, 620, 230, (g, w, h, t) => {
      g.fillStyle = '#121820';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9a96e';
      g.fillRect(0, 0, w, 34);
      g.fillStyle = '#121820';
      g.font = '800 18px "Plus Jakarta Sans", sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('NAIROBI TRUST BANK · CAPITAL ADEQUACY & RESERVE BRIEF', 16, 17);
      const kpis = [
        ['TIER-1 CAR RATIO', '19.4%', '+140 BPS'],
        ['BALANCE SHEET ASSETS', 'KES 412B', '+14.8% YOY'],
        ['LIQUIDITY COVERAGE', '162.0%', 'AAA STABLE'],
      ];
      kpis.forEach((k, i) => {
        const y = 52 + i * 52;
        g.fillStyle = 'rgba(201, 169, 110, 0.14)';
        rr(g, 16, y, w - 32, 44, 6);
        g.fill();
        g.fillStyle = '#f8fafc';
        g.font = '700 15px "IBM Plex Mono", monospace';
        g.fillText(k[0], 26, y + 22);
        g.fillStyle = '#5eead4';
        g.fillText(k[1], 295, y + 22);
        g.fillStyle = '#e5c583';
        g.fillText(k[2], 445, y + 22);
      });
      void t;
    });
    boxAt(g5, 0.16, 2.2, 5.2, spec.cx + 10.1, fy5 + 2.2, spec.cz - 3.8, pal.makoreWood, false, false, 0.02);
    const ebMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 1.9), execBoard.mat);
    ebMesh.rotation.y = -Math.PI / 2;
    ebMesh.position.set(spec.cx + 9.98, fy5 + 2.2, spec.cz - 3.8);
    g5.add(ebMesh);
    execBoard.setMesh(ebMesh);

    // 2. SW Governor / Group CEO Corner Suite & Illuminated Kenyan Monetary Heritage Archive (dx -5.8, dz +6.0)
    boxAt(g5, 0.56, 2.75, 4.0, spec.cx - 10.0, fy5 + 1.375, spec.cz + 6.0, pal.makoreWood, true, true, 0.02);
    // Illuminated archive vitrines housing sovereign gold medals & historic mint plates
    [0.85, 1.65].forEach((shY) => {
      boxAt(g5, 0.58, 0.04, 3.8, spec.cx - 9.94, fy5 + shY, spec.cz + 6.0, pal.champagneBronze, false, false);
      [-1.0, 0.0, 1.0].forEach((oz) => {
        cylAt(g5, 0.09, 0.09, 0.04, spec.cx - 9.88, fy5 + shY + 0.06, spec.cz + 6.0 + oz, pal.goldSpecie, false, false, 16);
      });
    });
    buildReserveDesk(g5, pal, spec.cx - 5.8, fy5, spec.cz + 6.0, 2.8, 1.1, Math.PI, true);
    registerChair(5, spec.cx - 5.8, fy5, spec.cz + 7.0, Math.PI, 1);
    registerMonitor(
      5,
      monIdx++,
      [spec.cx - 5.8, fy5 + 0.78, spec.cz + 5.95],
      0,
      spec.cx - 5.8,
      spec.cz + 7.0,
      'Group CEO · Nairobi Trust Bank · L5',
      'Governor & CEO Penthouse Suite'
    );
    armchair(g5, spec.cx - 2.2, fy5, spec.cz + 5.8, -Math.PI / 2, pal.ochreSaddleHide, M);
    cylAt(g5, 0.42, 0.42, 0.04, spec.cx - 3.0, fy5 + 0.44, spec.cz + 5.8, pal.kilimanjaroSlate, false, true, 16);
    cylAt(g5, 0.05, 0.1, 0.42, spec.cx - 3.0, fy5 + 0.21, spec.cz + 5.8, pal.champagneBronze, false, false, 12);

    // 3. SE Chief Financial Officer Directorate & Ceremonial Kenyan Tea Signing Terrace (dx +6.4, dz +4.2)
    buildReserveDesk(g5, pal, spec.cx + 6.4, fy5, spec.cz + 4.2, 2.4, 1.0, -Math.PI / 2, true);
    registerChair(5, spec.cx + 7.4, fy5, spec.cz + 4.2, -Math.PI / 2, -1);
    registerMonitor(
      5,
      monIdx++,
      [spec.cx + 6.35, fy5 + 0.78, spec.cz + 4.2],
      Math.PI / 2,
      spec.cx + 7.4,
      spec.cz + 4.2,
      'Chief Financial Officer · L5',
      'CFO Capital Directorate'
    );
    // Ceremonial Rift-Limestone Tea & Signing Credenza (dz +8.0)
    boxAt(g5, 3.4, 0.96, 0.9, spec.cx + 6.6, fy5 + 0.48, spec.cz + 8.0, pal.flutedLimestone, true, true, 0.02);
    boxAt(g5, 3.48, 0.06, 0.98, spec.cx + 6.6, fy5 + 0.99, spec.cz + 8.0, pal.champagneBronze, false, false);
    // Ceramic Kericho tea carafe & bronze tray (unique Kenyan hospitality touch)
    cylAt(g5, 0.28, 0.28, 0.02, spec.cx + 6.2, fy5 + 1.03, spec.cz + 8.0, pal.champagneBronze, false, false, 16);
    cylAt(g5, 0.07, 0.09, 0.22, spec.cx + 6.14, fy5 + 1.15, spec.cz + 8.0, M.ceramicMat, false, false, 14);
    cylAt(g5, 0.035, 0.03, 0.07, spec.cx + 6.32, fy5 + 1.07, spec.cz + 8.04, M.ceramicMat, false, false, 12);

    plant(g5, spec.cx - 9.2, fy5, spec.cz - 8.2, 1.1, 651, M, 'olive');
    plant(g5, spec.cx + 9.4, fy5, spec.cz + 8.0, 1.05, 652, M, 'ficus');
  }

  // ============================================================================
  // ROOFTOP CROWN — RIFT-LIMESTONE COLONNADE, WEST STAIR BULKHEAD & SKY ASTROLABE
  // ============================================================================
  {
    const roofY = spec.groundY + spec.h;
    const roofDeck = new THREE.Mesh(
      getRoundedSlabGeo(spec.w + 2.6, spec.d + 2.6, 3.1, 0.36, 0.08),
      pal.riftLimestone
    );
    roofDeck.position.set(spec.cx, roofY + 0.05, spec.cz);
    roofDeck.castShadow = true;
    roofDeck.receiveShadow = true;
    roofShellGroup.add(roofDeck);
    pickMeshes.push(roofDeck);

    // Bronze perimeter terrace rail
    boxAt(roofShellGroup, spec.w + 1.8, 0.06, 0.12, spec.cx, roofY + 1.15, spec.cz + spec.d * 0.5 + 0.95, pal.champagneBronze, false, false);
    boxAt(roofShellGroup, spec.w + 1.8, 0.06, 0.12, spec.cx, roofY + 1.15, spec.cz - spec.d * 0.5 - 0.95, pal.champagneBronze, false, false);

    // Dodecagonal Fluted-Limestone & Champagne-Bronze Reserve Lantern Pavilion (cx + 2.8, cz - 0.8)
    const rotX = spec.cx + 2.8;
    const rotZ = spec.cz - 0.8;
    cylAt(roofShellGroup, 4.4, 4.6, 0.24, rotX, roofY + 0.34, rotZ, pal.kilimanjaroSlate, true, true, 12);
    cylAt(roofShellGroup, 3.6, 3.6, 2.2, rotX, roofY + 1.56, rotZ, pal.bronzeTintedGlass, false, false, 12);
    for (let p = 0; p < 12; p++) {
      const ang = (p * Math.PI) / 6;
      cylAt(roofShellGroup, 0.13, 0.15, 2.4, rotX + Math.cos(ang) * 3.55, roofY + 1.58, rotZ + Math.sin(ang) * 3.55, pal.flutedLimestone, true, false, 12);
    }
    cylAt(roofShellGroup, 4.3, 3.8, 0.42, rotX, roofY + 2.86, rotZ, pal.riftLimestone, true, false, 12);
    cylAt(roofShellGroup, 2.8, 3.1, 0.34, rotX, roofY + 3.22, rotZ, pal.champagneBronze, true, false, 12);

    const skyAstrolabe = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 10, 28), pal.champagneBronze);
    skyAstrolabe.rotation.x = Math.PI / 2 - 0.22;
    skyAstrolabe.position.set(rotX, roofY + 3.85, rotZ);
    roofShellGroup.add(skyAstrolabe);
    rotatingProps.push({ obj: skyAstrolabe, speed: 0.24, axis: 'y' });

    // Stairwell Penthouse Bulkhead accurately capping NEW West Stairwell Void (dx -7.75, dz -2.5)
    boxAt(roofShellGroup, 5.4, 2.1, 7.8, spec.cx - 7.75, roofY + 1.26, spec.cz - 2.5, pal.flutedLimestone, true, true, 0.05);
    boxAt(roofShellGroup, 5.7, 0.22, 8.1, spec.cx - 7.75, roofY + 2.38, spec.cz - 2.5, pal.champagneBronze, true, false, 0.03);

    // Rooftop Tropical Palms & Terrace Planter Troughs
    buildTropicalPalm(roofShellGroup, spec.cx + 8.6, roofY + 0.22, spec.cz + 6.8, 3.5, 661, M, archMats);
    buildTropicalPalm(roofShellGroup, spec.cx - 8.2, roofY + 0.22, spec.cz + 6.8, 3.2, 662, M, archMats);
    buildPlanterTrough(roofShellGroup, spec.cx + 2.4, roofY + 0.24, spec.cz + spec.d * 0.5 + 0.65, 5.4, 0, 663, archMats);
    downlight(roofShellGroup, rotX, roofY + 2.6, rotZ, M, 0.35);
    void frameDarkMat;
    void getRoundedBox;
    void contact;
  }
}
