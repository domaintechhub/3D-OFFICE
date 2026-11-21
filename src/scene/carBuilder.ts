import * as THREE from 'three';
import { getMaxAnisotropy } from './textures';

export type CarStyle = 'sedan' | 'suv' | 'hatch' | 'van';

export interface CarBuildOptions {
  /** Expedition 4x4 safari trim (roof basket, spare wheel, bullbar, snorkel) */
  safari?: boolean;
  /** Dealership showroom spec (extra high-gloss clearcoat + dealer showplates) */
  showroom?: boolean;
  /** Commercial courier/freight livery for logistics fleet vehicles */
  logistics?: boolean;
  /** Custom license plate text (auto-generated Kenyan plate if omitted) */
  plateText?: string;
}

export interface CarRig {
  root: THREE.Group;
  /** Suspended chassis & cabin pivot (rolls, pitches, heaves on springs) */
  bodyPivot: THREE.Group;
  /** All 4 rotating wheel/rim/rotor assemblies */
  wheelSpins: THREE.Group[];
  /** Front-left and front-right steering knuckle pivots */
  frontSteers: THREE.Group[];
  /** Wheel radius in meters (for exact angular velocity omega = v / R) */
  wheelRadius: number;
  /** Body paint material */
  bodyMat: THREE.MeshPhysicalMaterial;
  /** Dynamic headlamp / DRL material */
  headLampMat: THREE.MeshStandardMaterial;
  /** Dynamic tail / brake lamp material */
  tailLampMat: THREE.MeshStandardMaterial;
  /** Left & right turn-signal indicator materials */
  leftSignalMat: THREE.MeshStandardMaterial;
  rightSignalMat: THREE.MeshStandardMaterial;
  /** Ground headlight projection pool mesh (visible at dusk/night) */
  headlightPool: THREE.Mesh;
  /** Current visual state for throttled updates */
  style: CarStyle;
  isSafari: boolean;
}

export interface CarVisualState {
  /** Linear forward speed (m/s) */
  speed: number;
  /** Frame delta time (s) */
  dt: number;
  /** Accumulated elapsed time (s) for signal blinking */
  elapsed: number;
  /** Front wheel steering angle (rad, +left / -right) */
  steerAngle: number;
  /** Chassis pitch (rad, +nose down under braking) */
  pitch: number;
  /** Chassis roll (rad, body lean in corners) */
  roll: number;
  /** Chassis vertical heave offset (m) */
  heave: number;
  /** 0..1 brake light intensity */
  brakeIntensity: number;
  /** 0..1 dusk/night factor */
  nightFactor: number;
  /** Whether the vehicle engine/ignition is active (driving/idling vs parked off) */
  engineOn: boolean;
  /** -1 = left blinker, 0 = off, 1 = right blinker */
  signalDir: -1 | 0 | 1;
}

interface StyleSpec {
  halfLenFront: number;
  halfLenRear: number;
  halfW: number;
  wbZ: number;
  wheelR: number;
  wheelW: number;
  rideH: number;
  hoodY: number;
  beltY: number;
  roofY: number;
  trunkY: number;
  noseY: number;
  rearDeckY: number;
  windshieldBotZ: number;
  windshieldTopZ: number;
  rearGlassTopZ: number;
  rearGlassBotZ: number;
  cabinTaper: number;
  mirrorZ: number;
  mirrorY: number;
  grilleY: number;
  grilleW: number;
  grilleH: number;
  lampY: number;
  tailY: number;
}

const STYLE_SPECS: Record<CarStyle, StyleSpec> = {
  sedan: {
    halfLenFront: 2.24,
    halfLenRear: 2.18,
    halfW: 0.92,
    wbZ: 1.38,
    wheelR: 0.335,
    wheelW: 0.23,
    rideH: 0.20,
    hoodY: 0.82,
    beltY: 0.90,
    roofY: 1.40,
    trunkY: 0.89,
    noseY: 0.66,
    rearDeckY: 0.84,
    windshieldBotZ: 0.88,
    windshieldTopZ: 0.30,
    rearGlassTopZ: -0.78,
    rearGlassBotZ: -1.48,
    cabinTaper: 0.17,
    mirrorZ: 0.62,
    mirrorY: 0.93,
    grilleY: 0.43,
    grilleW: 0.94,
    grilleH: 0.20,
    lampY: 0.56,
    tailY: 0.74,
  },
  suv: {
    halfLenFront: 2.24,
    halfLenRear: 2.20,
    halfW: 0.96,
    wbZ: 1.40,
    wheelR: 0.375,
    wheelW: 0.26,
    rideH: 0.27,
    hoodY: 0.97,
    beltY: 1.03,
    roofY: 1.65,
    trunkY: 1.04,
    noseY: 0.81,
    rearDeckY: 0.99,
    windshieldBotZ: 0.92,
    windshieldTopZ: 0.42,
    rearGlassTopZ: -1.34,
    rearGlassBotZ: -1.84,
    cabinTaper: 0.15,
    mirrorZ: 0.68,
    mirrorY: 1.07,
    grilleY: 0.54,
    grilleW: 1.02,
    grilleH: 0.26,
    lampY: 0.70,
    tailY: 0.86,
  },
  hatch: {
    halfLenFront: 2.02,
    halfLenRear: 1.96,
    halfW: 0.89,
    wbZ: 1.24,
    wheelR: 0.325,
    wheelW: 0.22,
    rideH: 0.19,
    hoodY: 0.80,
    beltY: 0.89,
    roofY: 1.44,
    trunkY: 0.93,
    noseY: 0.64,
    rearDeckY: 0.88,
    windshieldBotZ: 0.82,
    windshieldTopZ: 0.26,
    rearGlassTopZ: -1.10,
    rearGlassBotZ: -1.64,
    cabinTaper: 0.16,
    mirrorZ: 0.56,
    mirrorY: 0.92,
    grilleY: 0.42,
    grilleW: 0.88,
    grilleH: 0.18,
    lampY: 0.55,
    tailY: 0.76,
  },
  van: {
    halfLenFront: 2.38,
    halfLenRear: 2.34,
    halfW: 0.98,
    wbZ: 1.50,
    wheelR: 0.36,
    wheelW: 0.24,
    rideH: 0.24,
    hoodY: 1.00,
    beltY: 1.04,
    roofY: 2.02,
    trunkY: 1.04,
    noseY: 0.88,
    rearDeckY: 1.04,
    windshieldBotZ: 1.54,
    windshieldTopZ: 0.94,
    rearGlassTopZ: 0.42,
    rearGlassBotZ: 0.36,
    cabinTaper: 0.10,
    mirrorZ: 1.24,
    mirrorY: 1.08,
    grilleY: 0.56,
    grilleW: 1.04,
    grilleH: 0.26,
    lampY: 0.75,
    tailY: 0.88,
  },
};

/* =========================================================
   SHARED PROCEDURAL TEXTURES & MATERIALS
   ========================================================= */
let sharedAssetsReady = false;
let tyreAlbedoTex!: THREE.CanvasTexture;
let tyreNormalTex!: THREE.DataTexture;
let grilleTex!: THREE.CanvasTexture;
let grilleNormalTex!: THREE.DataTexture;
let contactShadowTex!: THREE.CanvasTexture;
let headPoolTex!: THREE.CanvasTexture;

let matTyre!: THREE.MeshStandardMaterial;
let matAlloyRim!: THREE.MeshPhysicalMaterial;
let matRimPocket!: THREE.MeshStandardMaterial;
let matRotor!: THREE.MeshStandardMaterial;
let matTrim!: THREE.MeshStandardMaterial;
let matCladding!: THREE.MeshStandardMaterial;
let matChrome!: THREE.MeshPhysicalMaterial;
let matGlass!: THREE.MeshPhysicalMaterial;
let matSunroof!: THREE.MeshPhysicalMaterial;
let matMirrorGlass!: THREE.MeshPhysicalMaterial;
let matInterior!: THREE.MeshStandardMaterial;
let matGrille!: THREE.MeshStandardMaterial;
let matUnderbody!: THREE.MeshStandardMaterial;
let matContactShadow!: THREE.MeshBasicMaterial;
let matLensCover!: THREE.MeshPhysicalMaterial;
let matSafariRack!: THREE.MeshStandardMaterial;

const plateTexCache = new Map<string, THREE.CanvasTexture>();
let plateCounter = 0;
const PLATE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function nextKenyanPlate(): string {
  plateCounter++;
  const series = 0x4b444e; // 'KDN' base idea; use deterministic readable plates
  void series;
  const prefixes = ['KDN', 'KDM', 'KDL', 'KDP', 'KDJ', 'KDK'];
  const p = prefixes[plateCounter % prefixes.length];
  const num = 114 + ((plateCounter * 137) % 860);
  const tail = PLATE_LETTERS[(plateCounter * 5) % PLATE_LETTERS.length];
  return `${p} ${num}${tail}`;
}

function getLicensePlateTexture(text: string, isRear: boolean, isShowroom: boolean): THREE.CanvasTexture {
  const key = `${text}|${isRear ? 'R' : 'F'}|${isShowroom ? 'S' : 'N'}`;
  const cached = plateTexCache.get(key);
  if (cached) return cached;

  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext('2d')!;

  if (isShowroom) {
    g.fillStyle = '#0f131a';
    g.fillRect(0, 0, 256, 64);
    g.strokeStyle = '#d4af37';
    g.lineWidth = 4;
    g.strokeRect(4, 4, 248, 56);
    g.fillStyle = '#f8fafc';
    g.font = '800 28px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 33);
  } else {
    g.fillStyle = isRear ? '#eab308' : '#f4f6f8';
    g.fillRect(0, 0, 256, 64);
    g.strokeStyle = '#1e293b';
    g.lineWidth = 4;
    g.strokeRect(3, 3, 250, 58);
    // Subtle Kenyan flag micro-badge on left
    g.fillStyle = '#111111';
    g.fillRect(10, 14, 16, 11);
    g.fillStyle = '#b91c1c';
    g.fillRect(10, 26, 16, 11);
    g.fillStyle = '#15803d';
    g.fillRect(10, 38, 16, 11);

    g.fillStyle = '#111827';
    g.font = '800 32px "IBM Plex Mono", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 138, 34);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = getMaxAnisotropy();
  plateTexCache.set(key, tex);
  return tex;
}

function buildHeightNormal(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  strength = 2.0
): THREE.DataTexture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  draw(g, w, h);
  const img = g.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h * 4);
  const sample = (x: number, y: number) => {
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
  dt.anisotropy = getMaxAnisotropy();
  dt.needsUpdate = true;
  return dt;
}

function ensureSharedAssets() {
  if (sharedAssetsReady) return;
  sharedAssetsReady = true;

  // 1. Tyre rubber texture + tread/sidewall normal map
  const tCv = document.createElement('canvas');
  tCv.width = 256;
  tCv.height = 256;
  const tg = tCv.getContext('2d')!;
  tg.fillStyle = '#1a1c20';
  tg.fillRect(0, 0, 256, 256);
  // Subtle sidewall sheen ring & tread grooves along horizontal V bands
  tg.fillStyle = '#101215';
  for (let x = 0; x < 256; x += 16) {
    tg.fillRect(x, 84, 5, 88);
    tg.fillRect(x + 8, 96, 4, 64);
  }
  // Circumferential water channels
  tg.fillRect(0, 108, 256, 5);
  tg.fillRect(0, 144, 256, 5);
  // Sidewall ribs
  tg.strokeStyle = '#25282e';
  tg.lineWidth = 2;
  tg.beginPath();
  tg.moveTo(0, 50);
  tg.lineTo(256, 50);
  tg.moveTo(0, 206);
  tg.lineTo(256, 206);
  tg.stroke();

  tyreAlbedoTex = new THREE.CanvasTexture(tCv);
  tyreAlbedoTex.colorSpace = THREE.SRGBColorSpace;
  tyreAlbedoTex.wrapS = tyreAlbedoTex.wrapT = THREE.RepeatWrapping;
  tyreAlbedoTex.repeat.set(3, 1);
  tyreAlbedoTex.anisotropy = getMaxAnisotropy();

  tyreNormalTex = buildHeightNormal(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#c8c8c8';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#262626';
      for (let x = 0; x < w; x += 16) {
        g.fillRect(x, 84, 5, 88);
        g.fillRect(x + 8, 96, 4, 64);
      }
      g.fillRect(0, 108, w, 5);
      g.fillRect(0, 144, w, 5);
      g.strokeStyle = '#707070';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 48);
      g.lineTo(w, 48);
      g.moveTo(0, 208);
      g.lineTo(w, 208);
      g.stroke();
    },
    2.4
  );
  tyreNormalTex.repeat.set(3, 1);

  // 2. Hexagonal honeycomb front grille texture & normal map
  const gCv = document.createElement('canvas');
  gCv.width = 128;
  gCv.height = 64;
  const gg = gCv.getContext('2d')!;
  gg.fillStyle = '#0d0f13';
  gg.fillRect(0, 0, 128, 64);
  gg.strokeStyle = '#2d333d';
  gg.lineWidth = 2.5;
  for (let y = 0; y <= 64; y += 12) {
    for (let x = 0; x <= 128; x += 16) {
      const ox = (Math.floor(y / 12) % 2) * 8;
      gg.strokeRect(x + ox - 4, y - 4, 12, 9);
    }
  }
  grilleTex = new THREE.CanvasTexture(gCv);
  grilleTex.colorSpace = THREE.SRGBColorSpace;
  grilleTex.wrapS = grilleTex.wrapT = THREE.RepeatWrapping;
  grilleTex.repeat.set(3, 1.5);
  grilleTex.anisotropy = getMaxAnisotropy();

  grilleNormalTex = buildHeightNormal(
    128,
    64,
    (g, w, h) => {
      g.fillStyle = '#1c1c1c';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e5e5e5';
      g.lineWidth = 3;
      for (let y = 0; y <= h; y += 12) {
        for (let x = 0; x <= w; x += 16) {
          const ox = (Math.floor(y / 12) % 2) * 8;
          g.strokeRect(x + ox - 4, y - 4, 12, 9);
        }
      }
    },
    2.6
  );
  grilleNormalTex.repeat.set(3, 1.5);

  // 3. Soft elliptical contact shadow under car
  const sCv = document.createElement('canvas');
  sCv.width = 128;
  sCv.height = 256;
  const sg = sCv.getContext('2d')!;
  sg.clearRect(0, 0, 128, 256);
  const rg = sg.createRadialGradient(64, 128, 12, 64, 128, 62);
  rg.addColorStop(0, 'rgba(6, 8, 12, 0.85)');
  rg.addColorStop(0.55, 'rgba(6, 8, 12, 0.56)');
  rg.addColorStop(0.84, 'rgba(6, 8, 12, 0.18)');
  rg.addColorStop(1, 'rgba(6, 8, 12, 0)');
  sg.save();
  sg.translate(64, 128);
  sg.scale(0.95, 1.85);
  sg.translate(-64, -128);
  sg.fillStyle = rg;
  sg.fillRect(0, 0, 128, 256);
  sg.restore();
  contactShadowTex = new THREE.CanvasTexture(sCv);
  contactShadowTex.colorSpace = THREE.SRGBColorSpace;

  // 4. Dual headlight beam ground projection texture
  const hCv = document.createElement('canvas');
  hCv.width = 128;
  hCv.height = 256;
  const hg = hCv.getContext('2d')!;
  hg.clearRect(0, 0, 128, 256);
  [-28, 28].forEach((ox) => {
    const cx = 64 + ox;
    const grad = hg.createLinearGradient(cx, 252, cx, 10);
    grad.addColorStop(0, 'rgba(255, 246, 212, 0.88)');
    grad.addColorStop(0.38, 'rgba(255, 243, 200, 0.48)');
    grad.addColorStop(1, 'rgba(255, 240, 190, 0)');
    hg.fillStyle = grad;
    hg.beginPath();
    hg.moveTo(cx - 11, 250);
    hg.lineTo(cx - 38, 12);
    hg.lineTo(cx + 38, 12);
    hg.lineTo(cx + 11, 250);
    hg.closePath();
    hg.fill();
  });
  headPoolTex = new THREE.CanvasTexture(hCv);
  headPoolTex.colorSpace = THREE.SRGBColorSpace;

  // Shared physical & standard materials
  matTyre = new THREE.MeshStandardMaterial({
    map: tyreAlbedoTex,
    normalMap: tyreNormalTex,
    normalScale: new THREE.Vector2(0.75, 0.75),
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.02,
    envMapIntensity: 0.28,
  });
  matAlloyRim = new THREE.MeshPhysicalMaterial({
    color: 0xd4dbe3,
    metalness: 0.88,
    roughness: 0.19,
    clearcoat: 0.65,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.25,
  });
  matRimPocket = new THREE.MeshStandardMaterial({
    color: 0x22262e,
    metalness: 0.72,
    roughness: 0.42,
    envMapIntensity: 0.65,
  });
  matRotor = new THREE.MeshStandardMaterial({
    color: 0x9aa2ab,
    metalness: 0.84,
    roughness: 0.34,
    envMapIntensity: 0.75,
  });
  matTrim = new THREE.MeshStandardMaterial({
    color: 0x15181e,
    roughness: 0.42,
    metalness: 0.25,
    envMapIntensity: 0.55,
  });
  matCladding = new THREE.MeshStandardMaterial({
    color: 0x1a1d22,
    roughness: 0.78,
    metalness: 0.06,
    envMapIntensity: 0.28,
  });
  matChrome = new THREE.MeshPhysicalMaterial({
    color: 0xe6ecf2,
    metalness: 0.94,
    roughness: 0.12,
    clearcoat: 0.4,
    envMapIntensity: 1.35,
  });
  matGlass = new THREE.MeshPhysicalMaterial({
    color: 0x0e1824,
    roughness: 0.04,
    metalness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.45,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
  });
  matSunroof = new THREE.MeshPhysicalMaterial({
    color: 0x090f17,
    roughness: 0.05,
    metalness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.5,
  });
  matMirrorGlass = new THREE.MeshPhysicalMaterial({
    color: 0xaab8c8,
    metalness: 0.96,
    roughness: 0.05,
    envMapIntensity: 1.5,
  });
  matInterior = new THREE.MeshStandardMaterial({
    color: 0x181b21,
    roughness: 0.88,
    metalness: 0.05,
    envMapIntensity: 0.15,
  });
  matGrille = new THREE.MeshStandardMaterial({
    map: grilleTex,
    normalMap: grilleNormalTex,
    normalScale: new THREE.Vector2(0.8, 0.8),
    color: 0xffffff,
    roughness: 0.48,
    metalness: 0.45,
    envMapIntensity: 0.6,
  });
  matUnderbody = new THREE.MeshStandardMaterial({
    color: 0x0e1014,
    roughness: 0.92,
    metalness: 0.08,
    envMapIntensity: 0.1,
  });
  matContactShadow = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -16,
  });
  matLensCover = new THREE.MeshPhysicalMaterial({
    color: 0xeaf4ff,
    roughness: 0.06,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.2,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  matSafariRack = new THREE.MeshStandardMaterial({
    color: 0x202428,
    roughness: 0.62,
    metalness: 0.58,
    envMapIntensity: 0.5,
  });
}

/* =========================================================
   PARAMETRIC LOFTED AUTOMOTIVE GEOMETRY
   ========================================================= */
interface StyleGeoCache {
  bodyHull: THREE.BufferGeometry;
  cabinGlass: THREE.BufferGeometry;
  roofCap: THREE.BufferGeometry;
  lowerTrim: THREE.BufferGeometry;
  tyre: THREE.BufferGeometry;
  rimBarrel: THREE.BufferGeometry;
  rimFace: THREE.BufferGeometry;
  rotor: THREE.BufferGeometry;
  caliper: THREE.BufferGeometry;
  wheelLiner: THREE.BufferGeometry;
  fenderArch: THREE.BufferGeometry;
  contactShadow: THREE.BufferGeometry;
  headPool: THREE.BufferGeometry;
}

const STYLE_GEO_CACHE = new Map<CarStyle, StyleGeoCache>();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Generates a lofted 3D BufferGeometry from closed 2D cross-section rings along Z.
 * Duplicates rings at hard-edge crease transitions or uses smooth vertex normals.
 */
function buildLoftedHull(rings: Array<{ z: number; pts: Array<[number, number]> }>): THREE.BufferGeometry {
  const nRings = rings.length;
  const nPts = rings[0].pts.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < nRings; r++) {
    const ring = rings[r];
    const v = r / Math.max(1, nRings - 1);
    for (let p = 0; p < nPts; p++) {
      const [x, y] = ring.pts[p];
      positions.push(x, y, ring.z);
      uvs.push(p / nPts, v);
    }
  }

  for (let r = 0; r < nRings - 1; r++) {
    const aBase = r * nPts;
    const bBase = (r + 1) * nPts;
    for (let p = 0; p < nPts; p++) {
      const pNext = (p + 1) % nPts;
      const a0 = aBase + p;
      const a1 = aBase + pNext;
      const b0 = bBase + p;
      const b1 = bBase + pNext;
      indices.push(a0, a1, b0);
      indices.push(a1, b1, b0);
    }
  }

  // Cap rear (ring 0) and front (ring nRings - 1) using centroid fan
  const rearCenterIdx = positions.length / 3;
  let rcx = 0;
  let rcy = 0;
  for (let p = 0; p < nPts; p++) {
    rcx += rings[0].pts[p][0];
    rcy += rings[0].pts[p][1];
  }
  positions.push(rcx / nPts, rcy / nPts, rings[0].z);
  uvs.push(0.5, 0);
  for (let p = 0; p < nPts; p++) {
    const pNext = (p + 1) % nPts;
    indices.push(rearCenterIdx, pNext, p);
  }

  const lastR = nRings - 1;
  const frontCenterIdx = positions.length / 3;
  let fcx = 0;
  let fcy = 0;
  for (let p = 0; p < nPts; p++) {
    fcx += rings[lastR].pts[p][0];
    fcy += rings[lastR].pts[p][1];
  }
  positions.push(fcx / nPts, fcy / nPts, rings[lastR].z);
  uvs.push(0.5, 1);
  const lastBase = lastR * nPts;
  for (let p = 0; p < nPts; p++) {
    const pNext = (p + 1) % nPts;
    indices.push(frontCenterIdx, lastBase + p, lastBase + pNext);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildCreasedBodyGeometry(rings: Array<{ z: number; pts: Array<[number, number]> }>): THREE.BufferGeometry {
  const nRings = rings.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Emit an open strip with isolated vertices so crease normals stay sharp and sheet-metal reflections stay glassy-smooth
  const addStrip = (ptOrder: number[]) => {
    const baseVert = positions.length / 3;
    const stride = ptOrder.length;
    for (let r = 0; r < nRings; r++) {
      const ring = rings[r];
      const tNorm = r / Math.max(1, nRings - 1);
      const frontSweep = smoothstep(0.84, 1.0, tNorm);
      const rearSweep = 1.0 - smoothstep(0.0, 0.14, tNorm);
      for (let j = 0; j < stride; j++) {
        const [x, y] = ring.pts[ptOrder[j]];
        const xSq = Math.min(1, Math.abs(x) / 0.96);
        const zCurved = ring.z - frontSweep * 0.13 * xSq * xSq + rearSweep * 0.10 * xSq * xSq;
        positions.push(x, y, zCurved);
        uvs.push(j / Math.max(1, stride - 1), tNorm);
      }
    }
    for (let r = 0; r < nRings - 1; r++) {
      const aBase = baseVert + r * stride;
      const bBase = baseVert + (r + 1) * stride;
      for (let j = 0; j < stride - 1; j++) {
        const a0 = aBase + j;
        const a1 = aBase + j + 1;
        const b0 = bBase + j;
        const b1 = bBase + j + 1;
        indices.push(a0, a1, b0);
        indices.push(a1, b1, b0);
      }
    }
  };

  // Strip A: Right flank (underbody edge -> rocker/arch -> mid door -> right beltline shoulder)
  addStrip([1, 2, 3, 4]);
  // Strip B: Upper hood, beltline deck & trunk top (right shoulder -> center -> left shoulder)
  addStrip([4, 5, 6, 7, 8]);
  // Strip C: Left flank (left beltline shoulder -> mid door -> rocker/arch -> underbody edge)
  addStrip([8, 9, 10, 11]);
  // Strip D: Underbody floorpan
  addStrip([11, 0, 1]);

  // Isolated Rear Bumper / Tailgate cap (ring 0)
  const rearRing = rings[0];
  const nPts = rearRing.pts.length;
  const rearRimStart = positions.length / 3;
  let rcx = 0;
  let rcy = 0;
  for (let p = 0; p < nPts; p++) {
    const [x, y] = rearRing.pts[p];
    const xSq = Math.min(1, Math.abs(x) / 0.96);
    positions.push(x, y, rearRing.z + 0.10 * xSq * xSq);
    uvs.push(0.5 + x * 0.4, y * 0.5);
    rcx += x;
    rcy += y;
  }
  const rearCenterIdx = positions.length / 3;
  positions.push(rcx / nPts, rcy / nPts, rearRing.z);
  uvs.push(0.5, 0.5);
  for (let p = 0; p < nPts; p++) {
    const pNext = (p + 1) % nPts;
    indices.push(rearCenterIdx, rearRimStart + pNext, rearRimStart + p);
  }

  // Isolated Front Bumper Fascia cap (ring nRings - 1)
  const frontRing = rings[nRings - 1];
  const frontRimStart = positions.length / 3;
  let fcx = 0;
  let fcy = 0;
  for (let p = 0; p < nPts; p++) {
    const [x, y] = frontRing.pts[p];
    const xSq = Math.min(1, Math.abs(x) / 0.96);
    positions.push(x, y, frontRing.z - 0.13 * xSq * xSq);
    uvs.push(0.5 + x * 0.4, y * 0.5);
    fcx += x;
    fcy += y;
  }
  const frontCenterIdx = positions.length / 3;
  positions.push(fcx / nPts, fcy / nPts, frontRing.z);
  uvs.push(0.5, 0.5);
  for (let p = 0; p < nPts; p++) {
    const pNext = (p + 1) % nPts;
    indices.push(frontCenterIdx, frontRimStart + p, frontRimStart + pNext);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildBodyHullGeometry(spec: StyleSpec, style: CarStyle): THREE.BufferGeometry {
  const zBack = -spec.halfLenRear;
  const zFront = spec.halfLenFront;
  const archCutR = spec.wheelR + 0.088;
  const archApexY = 2 * spec.wheelR + 0.085;

  // Uniform Z stations eliminate triangle-aspect normal banding across hood & doors
  const zSteps = 56;
  const rings: Array<{ z: number; pts: Array<[number, number]> }> = [];

  for (let i = 0; i <= zSteps; i++) {
    const tNorm = i / zSteps; // 0 = rear, 1 = front
    const z = zBack + (zFront - zBack) * tNorm;

    // Smooth plan-view taper at nose & tail corners
    const frontTaper = smoothstep(0.74, 1.0, tNorm);
    const rearTaper = style === 'van' ? 0 : 1.0 - smoothstep(0.0, 0.20, tNorm);
    const cornerTaper = 1.0 - 0.13 * frontTaper * frontTaper - 0.10 * rearTaper * rearTaper;

    // Muscular fender hip bulge over front and rear wheel arches (kept on mid-flank so hood stays ripple-free)
    const dFrontAxle = Math.abs(z - spec.wbZ);
    const dRearAxle = Math.abs(z + spec.wbZ);
    const fenderFlare =
      0.030 * Math.exp(-Math.pow(dFrontAxle / (archCutR * 1.2), 2)) +
      0.036 * Math.exp(-Math.pow(dRearAxle / (archCutR * 1.2), 2));

    const wUpperShoulder = (spec.halfW - (style === 'van' ? 0.038 : 0.055)) * cornerTaper + fenderFlare * 0.25;
    const wBelt = spec.halfW * cornerTaper + fenderFlare;
    const wRocker = (spec.halfW - 0.035) * cornerTaper + fenderFlare * 0.45;

    // Smooth height profile along Z
    let yBelt = spec.beltY;
    if (z > spec.windshieldBotZ) {
      const hoodT = (z - spec.windshieldBotZ) / Math.max(0.1, zFront - spec.windshieldBotZ);
      yBelt = spec.beltY - (spec.beltY - spec.noseY) * Math.pow(hoodT, 1.72);
    } else if (z < spec.rearGlassBotZ) {
      if (style === 'van') {
        yBelt = spec.beltY;
      } else {
        const tailT = (spec.rearGlassBotZ - z) / Math.max(0.1, spec.rearGlassBotZ - zBack);
        yBelt = spec.trunkY - (spec.trunkY - spec.rearDeckY) * Math.pow(tailT, 1.45);
      }
    } else {
      const midT = (spec.windshieldBotZ - z) / Math.max(0.1, spec.windshieldBotZ - spec.rearGlassBotZ);
      yBelt = spec.beltY + (style === 'hatch' ? 0.04 : style === 'van' ? 0 : 0.02) * midT;
    }

    // Centerline hood/deck crown
    const crownBoost =
      z > spec.windshieldBotZ
        ? 0.046 * (1 - Math.pow((z - spec.windshieldBotZ) / (zFront - spec.windshieldBotZ), 2))
        : 0.024;
    const yTopCenter = yBelt + crownBoost;

    // Lower sill height with approach/departure bumper rake
    let yBot = spec.rideH;
    if (tNorm > 0.88) yBot += 0.065 * smoothstep(0.88, 1.0, tNorm);
    if (tNorm < 0.11) yBot += 0.075 * (1 - smoothstep(0.0, 0.11, tNorm));

    // Full wheel-well arch cutout clearing the entire top of each tyre (2 * wheelR + suspension gap)
    let archLift = 0;
    if (dFrontAxle < archCutR) {
      const u = dFrontAxle / archCutR;
      archLift = Math.max(archLift, (archApexY - yBot) * Math.sqrt(Math.max(0, 1 - u * u)));
    }
    if (dRearAxle < archCutR) {
      const u = dRearAxle / archCutR;
      archLift = Math.max(archLift, (archApexY - yBot) * Math.sqrt(Math.max(0, 1 - u * u)));
    }
    const ySideBot = Math.min(yBelt - 0.045, yBot + archLift);
    const yMidSide = ySideBot + (yBelt - ySideBot) * 0.54;

    // Closed cross-section ring (clockwise around +Z so outward normals face out)
    const pts: Array<[number, number]> = [
      [0, yBot], // 0: bottom center
      [wRocker * 0.66, yBot], // 1: underbody right edge (strictly inboard of tyre inner wall)
      [wRocker, ySideBot], // 2: lower rocker / arch lip right
      [wBelt, yMidSide], // 3: mid door bulge right
      [wUpperShoulder, yBelt], // 4: beltline shoulder right
      [wUpperShoulder * 0.56, yTopCenter - 0.008], // 5: hood/deck crown right
      [0, yTopCenter], // 6: top center ridge
      [-wUpperShoulder * 0.56, yTopCenter - 0.008], // 7: hood/deck crown left
      [-wUpperShoulder, yBelt], // 8: beltline shoulder left
      [-wBelt, yMidSide], // 9: mid door bulge left
      [-wRocker, ySideBot], // 10: lower rocker / arch lip left
      [-wRocker * 0.66, yBot], // 11: underbody left edge
    ];

    rings.push({ z, pts });
  }

  return buildCreasedBodyGeometry(rings);
}

function buildCabinGlassGeometry(spec: StyleSpec): THREE.BufferGeometry {
  const baseW = spec.halfW - 0.11;
  const topW = baseW - spec.cabinTaper;
  const yBase = spec.beltY - 0.05;
  const yTop = spec.roofY - 0.025;

  const zStations = [
    { z: spec.rearGlassBotZ, wBot: baseW * 0.94, wTop: baseW * 0.86, yTop: yBase + 0.05 },
    { z: spec.rearGlassTopZ, wBot: baseW * 0.97, wTop: topW * 0.96, yTop },
    { z: (spec.rearGlassTopZ + spec.windshieldTopZ) * 0.5, wBot: baseW, wTop: topW, yTop: yTop + 0.015 },
    { z: spec.windshieldTopZ, wBot: baseW * 0.98, wTop: topW * 0.96, yTop },
    { z: spec.windshieldBotZ, wBot: baseW * 0.95, wTop: baseW * 0.88, yTop: yBase + 0.04 },
  ];

  const rings = zStations.map((st) => ({
    z: st.z,
    pts: [
      [0, yBase],
      [st.wBot, yBase],
      [st.wTop, st.yTop],
      [0, st.yTop + 0.018],
      [-st.wTop, st.yTop],
      [-st.wBot, yBase],
    ] as Array<[number, number]>,
  }));

  return buildLoftedHull(rings);
}

function buildRoofCapGeometry(spec: StyleSpec, style: CarStyle): THREE.BufferGeometry {
  const topW = spec.halfW - 0.11 - spec.cabinTaper + 0.032;
  const yRoof = spec.roofY - 0.022;
  const yCrown = spec.roofY + 0.018;
  const zBack = style === 'van' ? -spec.halfLenRear + 0.03 : spec.rearGlassTopZ - 0.06;
  const zFront = spec.windshieldTopZ + 0.06;
  const zMid = (zBack + zFront) * 0.5;

  const rings = [
    {
      z: zBack,
      pts: [
        [0, yRoof - 0.01],
        [topW * 0.94, yRoof - 0.01],
        [topW * 0.92, yRoof + 0.018],
        [0, yCrown + 0.008],
        [-topW * 0.92, yRoof + 0.018],
        [-topW * 0.94, yRoof - 0.01],
      ] as Array<[number, number]>,
    },
    {
      z: zMid,
      pts: [
        [0, yRoof],
        [topW, yRoof],
        [topW * 0.97, yRoof + 0.025],
        [0, yCrown + 0.02],
        [-topW * 0.97, yRoof + 0.025],
        [-topW, yRoof],
      ] as Array<[number, number]>,
    },
    {
      z: zFront,
      pts: [
        [0, yRoof - 0.01],
        [topW * 0.94, yRoof - 0.01],
        [topW * 0.92, yRoof + 0.016],
        [0, yCrown + 0.005],
        [-topW * 0.92, yRoof + 0.016],
        [-topW * 0.94, yRoof - 0.01],
      ] as Array<[number, number]>,
    },
  ];
  return buildLoftedHull(rings);
}

function buildTyreLatheGeometry(radius: number, width: number): THREE.BufferGeometry {
  const rimR = radius * 0.61;
  const hw = width * 0.5;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(rimR, -hw * 0.86),
    new THREE.Vector2(rimR + (radius - rimR) * 0.45, -hw * 1.03),
    new THREE.Vector2(radius * 0.96, -hw * 0.92),
    new THREE.Vector2(radius, -hw * 0.72),
    new THREE.Vector2(radius, 0),
    new THREE.Vector2(radius, hw * 0.72),
    new THREE.Vector2(radius * 0.96, hw * 0.92),
    new THREE.Vector2(rimR + (radius - rimR) * 0.45, hw * 1.03),
    new THREE.Vector2(rimR, hw * 0.86),
  ];
  const geo = new THREE.LatheGeometry(pts, 28);
  // Rotate so wheel axle aligns with X axis
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function getStyleGeos(style: CarStyle): StyleGeoCache {
  const cached = STYLE_GEO_CACHE.get(style);
  if (cached) return cached;

  const spec = STYLE_SPECS[style];
  const rimR = spec.wheelR * 0.62;
  const hw = spec.wheelW * 0.5;

  // Rim barrel (recessed inner lip + outer rim ring)
  const barrelPts = [
    new THREE.Vector2(rimR * 0.88, -hw * 0.82),
    new THREE.Vector2(rimR, -hw * 0.86),
    new THREE.Vector2(rimR, hw * 0.86),
    new THREE.Vector2(rimR * 0.92, hw * 0.88),
    new THREE.Vector2(rimR * 0.84, hw * 0.55),
    new THREE.Vector2(rimR * 0.84, -hw * 0.55),
  ];
  const rimBarrel = new THREE.LatheGeometry(barrelPts, 24);
  rimBarrel.rotateZ(Math.PI / 2);
  rimBarrel.computeVertexNormals();

  // Rim inner center backing disc
  const rimFace = new THREE.CylinderGeometry(rimR * 0.34, rimR * 0.34, spec.wheelW * 0.38, 16);
  rimFace.rotateZ(Math.PI / 2);

  // Brake rotor disc
  const rotor = new THREE.CylinderGeometry(spec.wheelR * 0.47, spec.wheelR * 0.47, 0.028, 20);
  rotor.rotateZ(Math.PI / 2);

  // Brake caliper block
  const caliper = new THREE.BoxGeometry(0.065, spec.wheelR * 0.28, spec.wheelR * 0.18);

  // Inner dark wheel-well liner drum (open-ended upper semicircle arch wrapping strictly above axle)
  const wheelLiner = new THREE.CylinderGeometry(
    spec.wheelR + 0.072,
    spec.wheelR + 0.072,
    spec.wheelW + 0.14,
    24,
    1,
    true,
    Math.PI,
    Math.PI
  );
  wheelLiner.rotateZ(-Math.PI / 2);

  // Fender arch flare lip (semicircle torus arch matching hull arch cutout)
  const fenderArch = new THREE.TorusGeometry(spec.wheelR + 0.086, 0.032, 10, 26, Math.PI);
  fenderArch.rotateY(Math.PI / 2);

  // Lower rocker/splitter trim bar (tucked strictly inboard of wheel wells)
  const len = spec.halfLenFront + spec.halfLenRear;
  const lowerTrim = new THREE.BoxGeometry(spec.halfW * 1.18, 0.07, len * 0.94);

  const contactShadow = new THREE.PlaneGeometry(spec.halfW * 2.45, len * 1.08);
  contactShadow.rotateX(-Math.PI / 2);

  const headPool = new THREE.PlaneGeometry(2.6, 5.8);
  headPool.rotateX(-Math.PI / 2);

  const geos: StyleGeoCache = {
    bodyHull: buildBodyHullGeometry(spec, style),
    cabinGlass: buildCabinGlassGeometry(spec),
    roofCap: buildRoofCapGeometry(spec, style),
    lowerTrim,
    tyre: buildTyreLatheGeometry(spec.wheelR, spec.wheelW),
    rimBarrel,
    rimFace,
    rotor,
    caliper,
    wheelLiner,
    fenderArch,
    contactShadow,
    headPool,
  };
  STYLE_GEO_CACHE.set(style, geos);
  return geos;
}

/* =========================================================
   BUILD CAR ASSEMBLY
   ========================================================= */
function addPillar(
  parent: THREE.Object3D,
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  w: number,
  d: number,
  mat: THREE.Material
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.01) return;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), mat);
  mesh.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5, (z1 + z2) * 0.5);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  parent.add(mesh);
}

export function makeCar(col: number, style: CarStyle = 'sedan', options?: CarBuildOptions): THREE.Group {
  ensureSharedAssets();
  const spec = STYLE_SPECS[style];
  const geos = getStyleGeos(style);
  const isSafari = Boolean(options?.safari);
  const isShowroom = Boolean(options?.showroom);
  const plateStr = options?.plateText || (isShowroom ? (style === 'suv' ? 'APEX GT' : style === 'sedan' ? 'APEX EV' : 'APEX E4') : nextKenyanPlate());

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Metallic automotive clearcoat paint
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: col,
    roughness: isSafari ? 0.34 : isShowroom ? 0.18 : 0.24,
    metalness: isSafari ? 0.25 : 0.62,
    clearcoat: isSafari ? 0.45 : 1.0,
    clearcoatRoughness: isSafari ? 0.26 : isShowroom ? 0.04 : 0.08,
    envMapIntensity: isShowroom ? 1.35 : 1.15,
  });

  // Per-vehicle dynamic lighting materials
  const headLampMat = new THREE.MeshStandardMaterial({
    color: 0xeef5ff,
    emissive: new THREE.Color(0xf8fbff),
    emissiveIntensity: 0.75,
    roughness: 0.15,
    metalness: 0.2,
  });
  const tailLampMat = new THREE.MeshStandardMaterial({
    color: 0x7a0d16,
    emissive: new THREE.Color(0xc81822),
    emissiveIntensity: 0.35,
    roughness: 0.2,
    metalness: 0.15,
  });
  const leftSignalMat = new THREE.MeshStandardMaterial({
    color: 0x5c3608,
    emissive: new THREE.Color(0xff9b1a),
    emissiveIntensity: 0.0,
    roughness: 0.25,
  });
  const rightSignalMat = new THREE.MeshStandardMaterial({
    color: 0x5c3608,
    emissive: new THREE.Color(0xff9b1a),
    emissiveIntensity: 0.0,
    roughness: 0.25,
  });

  // 1. Contact shadow grounded on asphalt / showroom floor
  const shadowPlane = new THREE.Mesh(geos.contactShadow, matContactShadow);
  shadowPlane.position.set(0, 0.012, (spec.halfLenFront - spec.halfLenRear) * 0.5);
  root.add(shadowPlane);

  // 2. Night headlight projection beam pool ahead of car
  const poolMat = new THREE.MeshBasicMaterial({
    map: headPoolTex,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -20,
  });
  const headlightPool = new THREE.Mesh(geos.headPool, poolMat);
  headlightPool.position.set(0, 0.018, spec.halfLenFront + 2.75);
  headlightPool.visible = false;
  root.add(headlightPool);

  // 3. Sculpted main body hull + dark lower chassis trim
  const bodyMesh = new THREE.Mesh(geos.bodyHull, bodyMat);
  bodyPivot.add(bodyMesh);

  const lowerSkirt = new THREE.Mesh(geos.lowerTrim, matUnderbody);
  lowerSkirt.position.set(0, spec.rideH + 0.03, (spec.halfLenFront - spec.halfLenRear) * 0.5);
  bodyPivot.add(lowerSkirt);

  // Inner dark wheel-well liners + wheel-arch flare trim
  const linerMat = matUnderbody.clone();
  linerMat.side = THREE.DoubleSide;
  [
    [-1, spec.wbZ],
    [1, spec.wbZ],
    [-1, -spec.wbZ],
    [1, -spec.wbZ],
  ].forEach(([sx, wz]) => {
    const liner = new THREE.Mesh(geos.wheelLiner, linerMat);
    liner.position.set(sx * (spec.halfW - spec.wheelW * 0.52), spec.wheelR + 0.005, wz);
    bodyPivot.add(liner);

    const flare = new THREE.Mesh(geos.fenderArch, style === 'suv' ? matCladding : bodyMat);
    flare.position.set(sx * (spec.halfW + 0.006), spec.wheelR + 0.005, wz);
    bodyPivot.add(flare);
  });

  // 4. Interior cabin silhouette (seats, headrests, dashboard & RHD steering wheel)
  const interiorGrp = new THREE.Group();
  const dash = new THREE.Mesh(new THREE.BoxGeometry(spec.halfW * 1.45, 0.22, 0.34), matInterior);
  dash.position.set(0, spec.beltY - 0.04, spec.windshieldBotZ - 0.28);
  interiorGrp.add(dash);

  // Steering wheel (right-hand drive for Nairobi!)
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.018, 8, 16), matTrim);
  sw.position.set(0.32, spec.beltY + 0.07, spec.windshieldBotZ - 0.44);
  sw.rotation.x = 0.42;
  interiorGrp.add(sw);

  // Front & rear seat backs + headrests
  [-0.32, 0.32].forEach((sx) => {
    const fBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.12), matInterior);
    fBack.position.set(sx, spec.beltY + 0.06, -0.08);
    fBack.rotation.x = -0.18;
    interiorGrp.add(fBack);
    const fHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.09), matInterior);
    fHead.position.set(sx, spec.beltY + 0.34, -0.12);
    interiorGrp.add(fHead);

    const rBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.12), matInterior);
    rBack.position.set(sx, spec.beltY + 0.05, -0.82);
    rBack.rotation.x = -0.14;
    interiorGrp.add(rBack);
  });
  bodyPivot.add(interiorGrp);

  // 5. Tapered tinted glass cabin + painted roof + panoramic sunroof + A/B/C pillars
  const cabinMesh = new THREE.Mesh(geos.cabinGlass, matGlass);
  cabinMesh.renderOrder = 2;
  bodyPivot.add(cabinMesh);

  const roofMesh = new THREE.Mesh(geos.roofCap, bodyMat);
  bodyPivot.add(roofMesh);

  // Enclosed tapered Sprinter cargo shell + rear double doors + courier livery for commercial vans
  if (style === 'van') {
    const cargoBotW = spec.halfW - 0.042;
    const cargoTopW = spec.halfW - 0.11 - spec.cabinTaper + 0.024;
    const cargoYBot = spec.beltY - 0.035;
    const cargoYTop = spec.roofY - 0.018;
    const zRearCargo = -spec.halfLenRear + 0.02;
    const zFrontCargo = spec.rearGlassBotZ + 0.10;
    const cargoRings = [zRearCargo, zFrontCargo].map((zPos) => ({
      z: zPos,
      pts: [
        [0, cargoYBot],
        [cargoBotW, cargoYBot],
        [cargoTopW, cargoYTop],
        [0, cargoYTop + 0.014],
        [-cargoTopW, cargoYTop],
        [-cargoBotW, cargoYBot],
      ] as Array<[number, number]>,
    }));
    const cargoHull = new THREE.Mesh(buildLoftedHull(cargoRings), bodyMat);
    cargoHull.castShadow = true;
    cargoHull.receiveShadow = true;
    bodyPivot.add(cargoHull);

    // Flat rear cargo bulkhead cap closing the back face cleanly
    const rearPanelW = cargoBotW * 1.94;
    const cargoH = cargoYTop - cargoYBot;
    const rearCap = new THREE.Mesh(
      new THREE.BoxGeometry(rearPanelW, cargoH * 0.96, 0.04),
      bodyMat
    );
    rearCap.position.set(0, cargoYBot + cargoH * 0.48, zRearCargo + 0.015);
    bodyPivot.add(rearCap);

    // Side logistics accent stripe tilted cleanly along the upper van flank angle
    const stripeMat = new THREE.MeshStandardMaterial({
      color: options?.logistics ? 0xf97316 : 0x334155,
      roughness: 0.35,
      metalness: 0.2,
    });
    const cargoLen = zFrontCargo - zRearCargo;
    const cargoZ = (zRearCargo + zFrontCargo) * 0.5;
    const flankTilt = Math.atan2(cargoBotW - cargoTopW, cargoH);
    const stripeY = cargoYBot + cargoH * 0.32;
    const stripeX = cargoBotW - (cargoBotW - cargoTopW) * 0.32 + 0.008;
    [-1, 1].forEach((side) => {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.13, cargoLen * 0.86), stripeMat);
      stripe.position.set(side * stripeX, stripeY, cargoZ);
      stripe.rotation.z = side * flankTilt;
      bodyPivot.add(stripe);
    });

    // Rear double cargo door seam + high-mount brake strip
    const doorSeam = new THREE.Mesh(new THREE.BoxGeometry(0.018, cargoH * 0.92, 0.025), matTrim);
    doorSeam.position.set(0, cargoYBot + cargoH * 0.48, zRearCargo - 0.006);
    bodyPivot.add(doorSeam);
    const highBrake = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.036, 0.025), tailLampMat);
    highBrake.position.set(0, spec.roofY - 0.055, zRearCargo - 0.006);
    bodyPivot.add(highBrake);
  } else {
    // Panoramic sunroof glass inset on passenger cars
    const sunW = (spec.halfW - 0.11 - spec.cabinTaper) * 1.48;
    const sunL = (spec.windshieldTopZ - spec.rearGlassTopZ) * 0.64;
    const sunroof = new THREE.Mesh(new THREE.BoxGeometry(sunW, 0.018, sunL), matSunroof);
    sunroof.position.set(0, spec.roofY + 0.022, (spec.windshieldTopZ + spec.rearGlassTopZ) * 0.5);
    bodyPivot.add(sunroof);

    // Shark-fin roof antenna
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.065, 0.14), bodyMat);
    fin.position.set(0, spec.roofY + 0.045, spec.rearGlassTopZ + 0.12);
    fin.rotation.x = 0.28;
    bodyPivot.add(fin);
  }

  // Sculpted A, B, C pillars (tucked cleanly into roof cap so zero tips protrude)
  const baseW = spec.halfW - 0.105;
  const topW = baseW - spec.cabinTaper;
  const bPillarZ = style === 'van' ? spec.rearGlassBotZ + 0.08 : (spec.windshieldTopZ + spec.rearGlassTopZ) * 0.45;
  [-1, 1].forEach((side) => {
    // A-pillar (body color)
    addPillar(
      bodyPivot,
      side * baseW * 0.94,
      spec.beltY - 0.03,
      spec.windshieldBotZ - 0.03,
      side * topW * 0.90,
      spec.roofY - 0.018,
      spec.windshieldTopZ - 0.02,
      0.044,
      0.052,
      bodyMat
    );
    // B-pillar (gloss black window divider)
    addPillar(
      bodyPivot,
      side * baseW * 0.97,
      spec.beltY - 0.03,
      bPillarZ,
      side * topW * 0.92,
      spec.roofY - 0.018,
      bPillarZ,
      0.032,
      0.082,
      matTrim
    );
    if (style !== 'van') {
      // C-pillar (body color)
      addPillar(
        bodyPivot,
        side * baseW * 0.94,
        spec.beltY - 0.03,
        spec.rearGlassBotZ + 0.06,
        side * topW * 0.90,
        spec.roofY - 0.018,
        spec.rearGlassTopZ + 0.02,
        0.048,
        0.086,
        bodyMat
      );
    }
  });

  // 6. Front Fascia: Honeycomb grille + chrome bezel + emblem + lower air dam + flush headlights + front plate
  const frontZ = spec.halfLenFront;
  const grilleBezel = new THREE.Mesh(new THREE.BoxGeometry(spec.grilleW * 0.84 + 0.05, spec.grilleH + 0.04, 0.048), matChrome);
  grilleBezel.position.set(0, spec.grilleY, frontZ - 0.008);
  bodyPivot.add(grilleBezel);

  const grilleMesh = new THREE.Mesh(new THREE.BoxGeometry(spec.grilleW * 0.84, spec.grilleH, 0.052), matGrille);
  grilleMesh.position.set(0, spec.grilleY, frontZ - 0.002);
  bodyPivot.add(grilleMesh);

  // Center front brand emblem badge
  const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.022, 16), matChrome);
  emblem.rotation.x = Math.PI / 2;
  emblem.position.set(0, spec.grilleY + spec.grilleH * 0.5 + 0.052, frontZ + 0.012);
  bodyPivot.add(emblem);

  // Lower chin air intake + splitter lip
  const airDam = new THREE.Mesh(new THREE.BoxGeometry(spec.grilleW * 1.02, 0.068, 0.065), matTrim);
  airDam.position.set(0, spec.rideH + 0.075, frontZ - 0.012);
  bodyPivot.add(airDam);

  // Front license plate
  const frontPlateTex = getLicensePlateTexture(plateStr, false, isShowroom);
  const frontPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.096, 0.02),
    new THREE.MeshStandardMaterial({ map: frontPlateTex, roughness: 0.35, metalness: 0.1 })
  );
  frontPlate.position.set(0, spec.rideH + 0.145, frontZ + 0.014);
  bodyPivot.add(frontPlate);

  // Wraparound Headlight housings, dual projector lenses, LED DRL blades & amber turn indicators
  [-1, 1].forEach((side) => {
    const lx = side * (spec.halfW * 0.65);
    const sigMat = side < 0 ? leftSignalMat : rightSignalMat;
    const hlZ = frontZ - 0.068;
    const hlRot = side * -0.34;

    const hlHousing = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.078, 0.11), matTrim);
    hlHousing.position.set(lx, spec.lampY, hlZ);
    hlHousing.rotation.y = hlRot;
    bodyPivot.add(hlHousing);

    const hlGlass = new THREE.Mesh(new THREE.BoxGeometry(0.315, 0.082, 0.024), matLensCover);
    hlGlass.position.set(lx + side * 0.014, spec.lampY, hlZ + 0.048);
    hlGlass.rotation.y = hlRot;
    bodyPivot.add(hlGlass);

    const drl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.022, 0.03), headLampMat);
    drl.position.set(lx + side * 0.008, spec.lampY - 0.02, hlZ + 0.044);
    drl.rotation.y = hlRot;
    bodyPivot.add(drl);

    [-0.046, 0.046].forEach((ox) => {
      const proj = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.036, 12), headLampMat);
      proj.rotation.x = Math.PI / 2;
      proj.position.set(lx + ox * 0.9, spec.lampY + 0.01, hlZ + 0.038);
      proj.rotation.y = hlRot;
      bodyPivot.add(proj);
    });

    const fSig = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.038, 0.055), sigMat);
    fSig.position.set(lx + side * 0.125, spec.lampY, hlZ + 0.008);
    fSig.rotation.y = hlRot;
    bodyPivot.add(fSig);
  });

  // 7. Rear Fascia: Smoked tail lamp housings, LED blades, center light bar, rear diffuser, exhausts & rear plate
  const backZ = -spec.halfLenRear;
  if (style !== 'hatch' && style !== 'van') {
    const centerBar = new THREE.Mesh(new THREE.BoxGeometry(spec.halfW * 0.94, 0.024, 0.025), tailLampMat);
    centerBar.position.set(0, spec.tailY, backZ - 0.008);
    bodyPivot.add(centerBar);
  }

  [-1, 1].forEach((side) => {
    const tx = side * (spec.halfW * 0.65);
    const sigMat = side < 0 ? leftSignalMat : rightSignalMat;
    const tlZ = backZ + 0.058;
    const tlRot = side * 0.34;

    const tlHousing = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.088, 0.11), matTrim);
    tlHousing.position.set(tx, spec.tailY, tlZ);
    tlHousing.rotation.y = tlRot;
    bodyPivot.add(tlHousing);

    const tlBlade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.038, 0.038), tailLampMat);
    tlBlade.position.set(tx + side * 0.008, spec.tailY + 0.008, tlZ - 0.048);
    tlBlade.rotation.y = tlRot;
    bodyPivot.add(tlBlade);

    const rSig = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.026, 0.048), sigMat);
    rSig.position.set(tx + side * 0.082, spec.tailY - 0.022, tlZ - 0.042);
    rSig.rotation.y = tlRot;
    bodyPivot.add(rSig);

    if (style !== 'van') {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.044, 0.11, 12), matChrome);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(side * 0.48, spec.rideH + 0.065, backZ - 0.01);
      bodyPivot.add(exhaust);
    }
  });

  // Rear lower diffuser valence
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(spec.halfW * 1.18, 0.11, 0.07), matTrim);
  diffuser.position.set(0, spec.rideH + 0.06, backZ + 0.015);
  bodyPivot.add(diffuser);

  // Rear license plate (Kenyan yellow-amber plate or showroom plate)
  const rearPlateTex = getLicensePlateTexture(plateStr, true, isShowroom);
  const rearPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.096, 0.02),
    new THREE.MeshStandardMaterial({ map: rearPlateTex, roughness: 0.35, metalness: 0.1 })
  );
  rearPlate.position.set(0, spec.tailY - 0.17, backZ - 0.012);
  rearPlate.rotation.y = Math.PI;
  bodyPivot.add(rearPlate);

  // 8. Sculpted Aerodynamic Wing Mirrors + Flush Door Handles
  const mirrorShellGeo = new THREE.SphereGeometry(0.068, 12, 10);
  [-1, 1].forEach((side) => {
    const mx = side * (spec.halfW - 0.05);
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.034, 0.046), matTrim);
    stalk.position.set(mx + side * 0.02, spec.mirrorY - 0.015, spec.mirrorZ);
    stalk.rotation.z = side * 0.28;
    bodyPivot.add(stalk);

    const mirrorCap = new THREE.Mesh(mirrorShellGeo, bodyMat);
    mirrorCap.scale.set(1.25, 0.68, 0.88);
    mirrorCap.position.set(mx + side * 0.085, spec.mirrorY + 0.01, spec.mirrorZ - 0.015);
    mirrorCap.rotation.y = side * -0.18;
    bodyPivot.add(mirrorCap);

    const mirrorFace = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.058), matMirrorGlass);
    mirrorFace.position.set(mx + side * 0.085, spec.mirrorY + 0.01, spec.mirrorZ - 0.072);
    mirrorFace.rotation.y = Math.PI + side * -0.18;
    bodyPivot.add(mirrorFace);

    [0.14, -0.66].forEach((hz) => {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.024, 0.15), matChrome);
      handle.position.set(side * (spec.halfW - 0.008), spec.beltY - 0.10, hz);
      bodyPivot.add(handle);
    });
  });

  // 9. SUV Roof Rails & Safari 4x4 Expedition Equipment
  if (style === 'suv') {
    const railLen = (spec.windshieldTopZ - spec.rearGlassTopZ) * 0.85;
    const railZ = (spec.windshieldTopZ + spec.rearGlassTopZ) * 0.5;
    const railX = (spec.halfW - 0.11 - spec.cabinTaper) * 0.84;
    [-1, 1].forEach((side) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, railLen), matChrome);
      rail.position.set(side * railX, spec.roofY + 0.032, railZ);
      bodyPivot.add(rail);
    });
  }

  if (isSafari) {
    // Roof expedition rack basket + 4 auxiliary LED off-road spotlights
    const rackW = 1.24;
    const rackL = 1.75;
    const rackY = spec.roofY + 0.085;
    const rackZ = -0.38;
    const rackBase = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.03, rackL), matSafariRack);
    rackBase.position.set(0, rackY, rackZ);
    bodyPivot.add(rackBase);
    [-rackW * 0.48, rackW * 0.48].forEach((rx) => {
      const sideRail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.085, rackL), matSafariRack);
      sideRail.position.set(rx, rackY + 0.04, rackZ);
      bodyPivot.add(sideRail);
    });
    [-rackL * 0.48, rackL * 0.48].forEach((rz) => {
      const crossRail = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.085, 0.04), matSafariRack);
      crossRail.position.set(0, rackY + 0.04, rackZ + rz);
      bodyPivot.add(crossRail);
    });
    [-0.36, -0.12, 0.12, 0.36].forEach((lx) => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12), matSafariRack);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(lx, rackY + 0.10, rackZ + rackL * 0.48);
      bodyPivot.add(pod);
      const podLens = new THREE.Mesh(new THREE.CircleGeometry(0.044, 12), headLampMat);
      podLens.position.set(lx, rackY + 0.10, rackZ + rackL * 0.48 + 0.027);
      bodyPivot.add(podLens);
    });

    // Front tubular A-bar nudge guard + silver skid plate
    [-0.32, 0.32].forEach((bx) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.36, 10), matSafariRack);
      post.position.set(bx, spec.rideH + 0.25, frontZ + 0.058);
      post.rotation.x = 0.10;
      bodyPivot.add(post);
    });
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.68, 10), matSafariRack);
    topBar.rotation.z = Math.PI / 2;
    topBar.position.set(0, spec.rideH + 0.42, frontZ + 0.072);
    bodyPivot.add(topBar);
    const midBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 10), matSafariRack);
    midBar.rotation.z = Math.PI / 2;
    midBar.position.set(0, spec.rideH + 0.27, frontZ + 0.062);
    bodyPivot.add(midBar);
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.13, 0.05), matChrome);
    skid.position.set(0, spec.rideH + 0.06, frontZ + 0.015);
    skid.rotation.x = -0.35;
    bodyPivot.add(skid);

    // Snorkel intake on right A-pillar
    const snork = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.68, 10), matSafariRack);
    snork.position.set(spec.halfW - 0.06, spec.beltY + 0.24, spec.windshieldBotZ - 0.08);
    snork.rotation.x = -0.45;
    bodyPivot.add(snork);

    // Tailgate-mounted spare wheel!
    const spare = new THREE.Mesh(geos.tyre, matTyre);
    spare.rotation.y = Math.PI / 2;
    spare.position.set(0, spec.tailY - 0.02, backZ - 0.11);
    spare.scale.setScalar(0.88);
    bodyPivot.add(spare);
    const spareRim = new THREE.Mesh(geos.rimBarrel, matAlloyRim);
    spareRim.rotation.y = Math.PI / 2;
    spareRim.position.set(0, spec.tailY - 0.02, backZ - 0.11);
    spareRim.scale.setScalar(0.88);
    bodyPivot.add(spareRim);
    const spareHub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14), matChrome);
    spareHub.rotation.x = Math.PI / 2;
    spareHub.position.set(0, spec.tailY - 0.02, backZ - 0.17);
    bodyPivot.add(spareHub);
  }

  // 10. Four Multi-Part Wheel, Tyre, 5-Twin-Spoke Alloy Rim, Rotor & Caliper Assemblies
  const wheelSpins: THREE.Group[] = [];
  const frontSteers: THREE.Group[] = [];
  const wheelTrackX = spec.halfW - spec.wheelW * 0.42;
  const calMat = new THREE.MeshStandardMaterial({
    color: isShowroom || col === 0x9e1b24 ? 0xd92632 : 0x5c6470,
    roughness: 0.35,
    metalness: 0.55,
  });

  const wheelCoords: Array<{ x: number; z: number; isFront: boolean; side: number }> = [
    { x: -wheelTrackX, z: spec.wbZ, isFront: true, side: -1 },
    { x: wheelTrackX, z: spec.wbZ, isFront: true, side: 1 },
    { x: -wheelTrackX, z: -spec.wbZ, isFront: false, side: -1 },
    { x: wheelTrackX, z: -spec.wbZ, isFront: false, side: 1 },
  ];

  for (const wc of wheelCoords) {
    const steerGrp = new THREE.Group();
    steerGrp.position.set(wc.x, spec.wheelR, wc.z);
    root.add(steerGrp);
    if (wc.isFront) {
      frontSteers.push(steerGrp);
    }

    // Stationary brake caliper mounted on steering knuckle
    const cal = new THREE.Mesh(geos.caliper, calMat);
    cal.position.set(wc.side * 0.018, spec.wheelR * 0.14, wc.isFront ? -spec.wheelR * 0.32 : spec.wheelR * 0.32);
    steerGrp.add(cal);

    // Spinning wheel assembly (tyre + rim barrel + 5-twin spokes + rotor + lug hub)
    const spinGrp = new THREE.Group();
    steerGrp.add(spinGrp);
    wheelSpins.push(spinGrp);

    const tyreMesh = new THREE.Mesh(geos.tyre, matTyre);
    spinGrp.add(tyreMesh);

    const barrelMesh = new THREE.Mesh(geos.rimBarrel, matAlloyRim);
    spinGrp.add(barrelMesh);

    const pocketBacking = new THREE.Mesh(geos.rimFace, matRimPocket);
    spinGrp.add(pocketBacking);

    const rotorMesh = new THREE.Mesh(geos.rotor, matRotor);
    rotorMesh.position.x = -wc.side * 0.018;
    spinGrp.add(rotorMesh);

    // Center hub cap
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.032, 14), matChrome);
    hubCap.rotation.z = Math.PI / 2;
    hubCap.position.x = wc.side * (spec.wheelW * 0.42);
    spinGrp.add(hubCap);

    // 5 twin-spoke metallic Y-spokes on outward face (collinear with radial angle a)
    const outX = wc.side * (spec.wheelW * 0.37);
    const rimSpokeR = spec.wheelR * 0.59;
    const twinLen = rimSpokeR * 0.68;
    const rMid = rimSpokeR * 0.58;
    for (let k = 0; k < 5; k++) {
      const a0 = (k * Math.PI * 2) / 5;
      [-0.12, 0.12].forEach((offsetA) => {
        const a = a0 + offsetA;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.022, twinLen, 0.024), matAlloyRim);
        spoke.position.set(outX, Math.cos(a) * rMid, Math.sin(a) * rMid);
        spoke.rotation.x = a;
        spinGrp.add(spoke);
      });
    }
  }

  const rig: CarRig = {
    root,
    bodyPivot,
    wheelSpins,
    frontSteers,
    wheelRadius: spec.wheelR,
    bodyMat,
    headLampMat,
    tailLampMat,
    leftSignalMat,
    rightSignalMat,
    headlightPool,
    style,
    isSafari,
  };

  root.userData.body = bodyMat;
  root.userData.carRig = rig;
  return root;
}

/**
 * Updates wheels rotation, front steering angle, chassis suspension pitch/roll/heave,
 * headlights/DRLs, brake lights, and turn signals without allocating objects.
 */
export function updateCarVisualState(rig: CarRig, state: CarVisualState) {
  // 1. Wheel spin matching exact ground distance traveled (omega = v / R)
  const dSpin = (state.speed * state.dt) / rig.wheelRadius;
  for (let i = 0; i < rig.wheelSpins.length; i++) {
    rig.wheelSpins[i].rotation.x += dSpin;
  }

  // 2. Front steering knuckle angle (+Z is front, +Y up, so +rotY turns nose left)
  for (let i = 0; i < rig.frontSteers.length; i++) {
    rig.frontSteers[i].rotation.y = state.steerAngle;
  }

  // 3. Suspension pitch (nose dive on braking / squat on launch), cornering roll, & road heave
  rig.bodyPivot.rotation.x = state.pitch;
  rig.bodyPivot.rotation.z = state.roll;
  rig.bodyPivot.position.y = state.heave;

  // 4. Headlights, DRLs & night ground beam projection
  const headIntensity = state.engineOn ? (0.85 + state.nightFactor * 2.8) : 0.0;
  rig.headLampMat.emissiveIntensity = headIntensity;
  const poolOpacity = state.engineOn ? state.nightFactor * 0.68 : 0.0;
  if (poolOpacity > 0.01) {
    rig.headlightPool.visible = true;
    (rig.headlightPool.material as THREE.MeshBasicMaterial).opacity = poolOpacity;
  } else {
    rig.headlightPool.visible = false;
  }

  // 5. Tail running lights + dynamic brake light flare
  const runningTail = state.engineOn ? (0.28 + state.nightFactor * 0.72) : 0.0;
  const brakeTail = state.brakeIntensity * 2.4;
  rig.tailLampMat.emissiveIntensity = runningTail + brakeTail;

  // 6. Left / right turn-signal blink (~1.8 Hz automotive flasher)
  const blinkOn = state.signalDir !== 0 && Math.sin(state.elapsed * 11.2) > 0;
  rig.leftSignalMat.emissiveIntensity = state.signalDir === -1 && blinkOn ? 2.4 : 0.0;
  rig.rightSignalMat.emissiveIntensity = state.signalDir === 1 && blinkOn ? 2.4 : 0.0;
}
