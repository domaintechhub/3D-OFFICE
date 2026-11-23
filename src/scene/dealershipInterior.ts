import * as THREE from 'three';
import {
  buildTropicalPalm,
  getRoundedSlabGeo,
  type ArchitecturalMaterials,
} from './architecturalForms';
import type { MonitorPickTarget } from './architecture';
import type { DistrictBuildingSpec } from './districtData';
import type { MaterialLibrary } from './materials';
import {
  armchair,
  boxAt,
  ceilingLinearLight,
  contact,
  cylAt,
  downlight,
  getRoundedBox,
  makeCar,
  plant,
  sofaWide,
} from './props';
import { createCustomBoardScreen, type ScreenRegistry } from './screens';
import { getMaxAnisotropy, makeCanvasTex, rr } from './textures';

import type { WarmLightAnchor } from './districtBuildings';

export interface DealershipBuildContext {
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

interface DealershipPalette {
  obsidianTerrazzo: THREE.MeshStandardMaterial;
  travertine: THREE.MeshStandardMaterial;
  chevronWalnut: THREE.MeshStandardMaterial;
  carbonWeave: THREE.MeshStandardMaterial;
  brushedTitanium: THREE.MeshStandardMaterial;
  saddleLeather: THREE.MeshStandardMaterial;
  alcantaraCharcoal: THREE.MeshStandardMaterial;
  crystalGlass: THREE.MeshPhysicalMaterial;
  smokedGlass: THREE.MeshPhysicalMaterial;
  copperCoil: THREE.MeshStandardMaterial;
  hvOrange: THREE.MeshStandardMaterial;
  warmLed: THREE.MeshBasicMaterial;
  crimsonLed: THREE.MeshBasicMaterial;
  cyanFlow: THREE.MeshBasicMaterial;
}

let cachedPalette: DealershipPalette | null = null;

function getDealershipPalette(): DealershipPalette {
  if (cachedPalette) return cachedPalette;

  const aniso = getMaxAnisotropy();

  // 1. Honed dark obsidian terrazzo with fine mineral aggregate & aluminum expansion joints
  const terrazzoTex = makeCanvasTex('apex_obsidian_terrazzo', 512, 512, (g, W, H) => {
    g.fillStyle = '#1b1f26';
    g.fillRect(0, 0, W, H);
    const chipCols = ['#333b48', '#525b68', '#8d867a', '#b83232', '#262b34', '#d4cdc0'];
    for (let i = 0; i < 620; i++) {
      const rx = ((Math.sin(i * 19.31 + 1.2) * 43758.5453) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 41.73 + 4.7) * 29431.1921) % 1 + 1) % 1;
      const rs = ((Math.sin(i * 73.17 + 0.5) * 18421.77) % 1 + 1) % 1;
      g.fillStyle = chipCols[i % chipCols.length];
      g.beginPath();
      g.ellipse(rx * W, ry * H, 1.4 + rs * 4.2, 1.0 + rs * 2.8, rs * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(182, 194, 210, 0.24)';
    g.lineWidth = 2;
    for (let k = 0; k <= W; k += 128) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k, H);
      g.stroke();
      g.beginPath();
      g.moveTo(0, k);
      g.lineTo(W, k);
      g.stroke();
    }
  });
  terrazzoTex.colorSpace = THREE.SRGBColorSpace;
  terrazzoTex.anisotropy = aniso;
  terrazzoTex.wrapS = terrazzoTex.wrapT = THREE.RepeatWrapping;
  terrazzoTex.repeat.set(4, 3);

  // 2. Warm Roman travertine with linear sedimentary veining
  const travertineTex = makeCanvasTex('apex_travertine', 256, 256, (g, W, H) => {
    g.fillStyle = '#d7cdba';
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 6) {
      const v = Math.sin(y * 0.085) * 0.5 + 0.5;
      g.fillStyle = v > 0.52 ? 'rgba(184, 168, 144, 0.28)' : 'rgba(244, 238, 226, 0.24)';
      g.fillRect(0, y, W, 3 + (y % 4));
    }
    for (let i = 0; i < 90; i++) {
      const rx = ((Math.sin(i * 23.1) * 43758.5) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 61.7) * 19432.3) % 1 + 1) % 1;
      g.fillStyle = 'rgba(145, 128, 106, 0.22)';
      g.fillRect(rx * W, ry * H, 14 + (i % 20), 1.6);
    }
  });
  travertineTex.colorSpace = THREE.SRGBColorSpace;
  travertineTex.anisotropy = aniso;
  travertineTex.wrapS = travertineTex.wrapT = THREE.RepeatWrapping;

  // 3. Smoked walnut herringbone / chevron gallery parquet
  const chevronTex = makeCanvasTex('apex_chevron_walnut', 512, 512, (g, W, H) => {
    g.fillStyle = '#4e3321';
    g.fillRect(0, 0, W, H);
    const cols = 8;
    const rows = 16;
    const cw = W / cols;
    const rh = H / rows;
    const tones = ['#5a3b27', '#67442d', '#4c311f', '#724d34', '#543724'];
    for (let r = -1; r < rows + 2; r++) {
      for (let c = 0; c < cols; c++) {
        const dir = c % 2 === 0 ? 1 : -1;
        const x0 = c * cw;
        const y0 = r * rh;
        g.fillStyle = tones[(Math.abs(r) * 3 + c) % tones.length];
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x0 + cw, y0 + dir * rh * 0.55);
        g.lineTo(x0 + cw, y0 + rh + dir * rh * 0.55);
        g.lineTo(x0, y0 + rh);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(28, 16, 10, 0.42)';
        g.lineWidth = 1.4;
        g.stroke();
      }
    }
  });
  chevronTex.colorSpace = THREE.SRGBColorSpace;
  chevronTex.anisotropy = aniso;
  chevronTex.wrapS = chevronTex.wrapT = THREE.RepeatWrapping;
  chevronTex.repeat.set(4, 3);

  // 4. 2x2 diagonal carbon fiber weave
  const carbonTex = makeCanvasTex('apex_carbon_weave', 128, 128, (g, W, H) => {
    g.fillStyle = '#14171c';
    g.fillRect(0, 0, W, H);
    const step = 16;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const diag = ((x / step) + (y / step)) % 2 === 0;
        g.fillStyle = diag ? '#252a33' : '#191d24';
        g.fillRect(x + 1, y + 1, step - 2, step * 0.5 - 1);
        g.fillStyle = diag ? '#1d2229' : '#2b313c';
        g.fillRect(x + 1, y + step * 0.5, step - 2, step * 0.5 - 1);
      }
    }
  });
  carbonTex.colorSpace = THREE.SRGBColorSpace;
  carbonTex.anisotropy = aniso;
  carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping;
  carbonTex.repeat.set(6, 6);

  cachedPalette = {
    obsidianTerrazzo: new THREE.MeshStandardMaterial({
      map: terrazzoTex,
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.08,
      envMapIntensity: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    travertine: new THREE.MeshStandardMaterial({
      map: travertineTex,
      color: 0xf4efe6,
      roughness: 0.58,
      metalness: 0.02,
      envMapIntensity: 0.25,
    }),
    chevronWalnut: new THREE.MeshStandardMaterial({
      map: chevronTex,
      color: 0xeedbc7,
      roughness: 0.48,
      metalness: 0.0,
      envMapIntensity: 0.26,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    carbonWeave: new THREE.MeshStandardMaterial({
      map: carbonTex,
      color: 0xffffff,
      roughness: 0.34,
      metalness: 0.28,
      envMapIntensity: 0.42,
    }),
    brushedTitanium: new THREE.MeshStandardMaterial({
      color: 0x9aa3ae,
      roughness: 0.26,
      metalness: 0.86,
      envMapIntensity: 0.55,
    }),
    saddleLeather: new THREE.MeshStandardMaterial({
      color: 0x9b542c,
      roughness: 0.52,
      metalness: 0.02,
      envMapIntensity: 0.24,
    }),
    alcantaraCharcoal: new THREE.MeshStandardMaterial({
      color: 0x252930,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.14,
    }),
    crystalGlass: new THREE.MeshPhysicalMaterial({
      color: 0xdff2fa,
      roughness: 0.07,
      metalness: 0.08,
      transparent: true,
      opacity: 0.24,
      envMapIntensity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    smokedGlass: new THREE.MeshPhysicalMaterial({
      color: 0x263240,
      roughness: 0.09,
      metalness: 0.12,
      transparent: true,
      opacity: 0.42,
      envMapIntensity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    copperCoil: new THREE.MeshStandardMaterial({
      color: 0xc9733c,
      roughness: 0.28,
      metalness: 0.88,
      envMapIntensity: 0.5,
    }),
    hvOrange: new THREE.MeshStandardMaterial({
      color: 0xf97316,
      roughness: 0.38,
      metalness: 0.1,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.28,
    }),
    warmLed: new THREE.MeshBasicMaterial({
      color: 0xffe4b8,
      toneMapped: false,
    }),
    crimsonLed: new THREE.MeshBasicMaterial({
      color: 0xef4444,
      toneMapped: false,
    }),
    cyanFlow: new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      toneMapped: false,
    }),
  };

  return cachedPalette;
}

/**
 * Custom cantilevered straight-flight carbon & walnut architectural gallery stair.
 * Totally unique to Apex Motors Showroom: floating treads cantilevered from an angled spine beam,
 * crimson racing under-stripe, recessed LED nosings, and frameless crystal glass balustrade.
 */
function buildCantileverSpineStair(
  parent: THREE.Object3D,
  xCenter: number,
  yBottom: number,
  yTop: number,
  zStart: number,
  zEnd: number,
  innerRailSide: -1 | 1,
  pal: DealershipPalette,
  picks: THREE.Object3D[]
) {
  const g = new THREE.Group();
  const rise = yTop - yBottom;
  const runZ = zEnd - zStart;
  const steps = 18;
  const stairW = 1.66;
  const treadD = Math.abs(runZ) / steps + 0.05;
  const railX = xCenter + innerRailSide * (stairW * 0.5 - 0.05);

  // Angled primary structural carbon box-spine stringer beneath treads
  const spineCurve = new THREE.LineCurve3(
    new THREE.Vector3(xCenter, yBottom + 0.04, zStart),
    new THREE.Vector3(xCenter, yTop - 0.1, zEnd)
  );
  const spineLen = Math.hypot(rise - 0.14, runZ);
  const pitchAngle = Math.atan2(rise - 0.14, -runZ);

  const spineBeam = new THREE.Mesh(
    getRoundedBox(0.32, 0.24, spineLen, 0.02, 2),
    pal.carbonWeave
  );
  spineBeam.position.set(xCenter, (yBottom + yTop) * 0.5 - 0.14, (zStart + zEnd) * 0.5);
  spineBeam.rotation.x = pitchAngle;
  spineBeam.castShadow = true;
  spineBeam.receiveShadow = true;
  g.add(spineBeam);

  // Crimson racing under-spine accent pinstripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.03, spineLen - 0.2),
    pal.crimsonLed
  );
  stripe.position.set(xCenter, (yBottom + yTop) * 0.5 - 0.265, (zStart + zEnd) * 0.5);
  stripe.rotation.x = pitchAngle;
  g.add(stripe);

  // 18 floating cantilevered smoked-walnut & titanium treads with recessed step LEDs
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    const ty = yBottom + (i + 1) * (rise / steps) - 0.032;
    const tz = zStart + t * runZ;

    // Titanium mounting bracket saddle on spine
    boxAt(g, 0.44, 0.06, 0.16, xCenter, ty - 0.055, tz, pal.brushedTitanium, false, false, 0.008);

    // Smoked walnut floating tread
    const tread = boxAt(g, stairW, 0.058, treadD, xCenter, ty, tz, pal.chevronWalnut, true, true, 0.012);
    picks.push(tread);

    // Brushed-titanium front nosing + warm LED micro-strip underneath nosing edge
    const noseSign = runZ < 0 ? 1 : -1;
    boxAt(g, stairW - 0.04, 0.024, 0.04, xCenter, ty + 0.019, tz + noseSign * (treadD * 0.46), pal.brushedTitanium, false, false, 0.004);
    boxAt(g, stairW - 0.22, 0.012, 0.018, xCenter, ty - 0.032, tz + noseSign * (treadD * 0.44), pal.warmLed, false, false);
  }

  // Sloped frameless crystal glass balustrade along open showroom side
  const glassSlopeLen = Math.hypot(rise, runZ);
  const glassH = 1.02;
  const midY = (yBottom + yTop) * 0.5 + glassH * 0.5 + 0.04;
  const midZ = (zStart + zEnd) * 0.5;
  const glassSlope = new THREE.Mesh(new THREE.BoxGeometry(0.035, glassH, glassSlopeLen), pal.crystalGlass);
  glassSlope.position.set(railX, midY, midZ);
  glassSlope.rotation.x = Math.atan2(rise, -runZ);
  g.add(glassSlope);

  // Continuous brushed-titanium & saddle-leather handrail
  const railCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(railX, yBottom + 1.04, zStart),
    new THREE.Vector3(railX, (yBottom + yTop) * 0.5 + 1.04, (zStart + zEnd) * 0.5),
    new THREE.Vector3(railX, yTop + 1.04, zEnd),
  ]);
  const handrail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 14, 0.032, 10, false), pal.brushedTitanium);
  handrail.castShadow = true;
  g.add(handrail);

  // Architectural glass standoff posts along inner stringer
  for (let p = 0; p <= 4; p++) {
    const t = p / 4;
    const py = yBottom + t * rise + 0.52;
    const pz = zStart + t * runZ;
    cylAt(g, 0.022, 0.026, 1.04, railX, py, pz, pal.brushedTitanium, false, false, 10);
  }

  // Keep spineCurve reference used cleanly
  void spineCurve;

  parent.add(g);
}

/**
 * Custom glass & brushed-titanium balustrade with leather top cap (flat level guardrails).
 */
function addTitaniumBalustrade(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  pal: DealershipPalette,
  h = 1.04
) {
  // Base titanium shoe channel
  boxAt(parent, w, 0.06, d, x, y + 0.03, z, pal.brushedTitanium, false, true, 0.008);
  // Crystal glass panel
  boxAt(parent, Math.max(0.025, w - 0.02), h - 0.1, Math.max(0.025, d - 0.02), x, y + 0.06 + (h - 0.1) * 0.5, z, pal.crystalGlass, false, false);
  // Top saddle-leather & titanium cap rail
  boxAt(parent, w + 0.02, 0.05, d + 0.02, x, y + h - 0.02, z, pal.saddleLeather, true, false, 0.014);
}

/**
 * Custom TerraCraft Travertine & Carbon Concierge Desk.
 */
function buildConciergeDesk(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  pal: DealershipPalette,
  picks: THREE.Object3D[]
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Recessed shadow kick base
  boxAt(g, w - 0.16, 0.08, d - 0.16, 0, 0.04, 0, pal.alcantaraCharcoal, false, true);
  // Carbon-weave front modesty apron
  const apron = boxAt(g, w - 0.08, 0.66, 0.12, 0, 0.41, d * 0.34, pal.carbonWeave, true, true, 0.015);
  // Brushed titanium vertical reveal fins along front apron
  for (let fx = -w * 0.38; fx <= w * 0.38; fx += w * 0.19) {
    boxAt(g, 0.024, 0.62, 0.024, fx, 0.41, d * 0.34 + 0.068, pal.brushedTitanium, false, false);
  }
  // Travertine side waterfall piers
  [-1, 1].forEach((s) => {
    boxAt(g, 0.085, 0.74, d * 0.88, s * (w * 0.5 - 0.045), 0.37, 0, pal.travertine, true, true, 0.014);
  });
  // Honed travertine desktop slab
  const top = boxAt(g, w, 0.065, d, 0, 0.742, 0, pal.travertine, true, true, 0.016);
  // Recessed crimson pinstripe & saddle-leather desk blotter
  boxAt(g, w - 0.24, 0.01, 0.018, 0, 0.742, d * 0.495, pal.crimsonLed, false, false);
  boxAt(g, 0.92, 0.012, 0.42, 0, 0.78, -0.08, pal.saddleLeather, false, true, 0.004);

  picks.push(apron, top);
  parent.add(g);
}

/**
 * Multi-part Forged Alloy Wheel & Ceramic Brake Assembly mounted on an obsidian gallery plinth.
 */
function buildForgedWheelPedestal(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  pal: DealershipPalette,
  M: MaterialLibrary,
  picks: THREE.Object3D[]
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Obsidian cylinder podium + glowing titanium base collar
  const ped = cylAt(g, 0.42, 0.48, 0.92, 0, 0.46, 0, pal.carbonWeave, true, true, 24);
  cylAt(g, 0.49, 0.5, 0.04, 0, 0.02, 0, pal.brushedTitanium, false, true, 24);
  cylAt(g, 0.43, 0.43, 0.02, 0, 0.925, 0, pal.warmLed, false, false, 24);
  picks.push(ped);

  // Angled upright wheel mount cradle
  const wg = new THREE.Group();
  wg.position.set(0, 1.32, 0);
  wg.rotation.x = -0.18;
  g.add(wg);

  // Tire (Torus)
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.095, 16, 28), M.black);
  tire.castShadow = true;
  wg.add(tire);

  // Brushed alloy barrel & perforated brake disc
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.16, 24, 1, true), pal.brushedTitanium);
  barrel.rotation.x = Math.PI / 2;
  wg.add(barrel);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.025, 22), M.metal);
  disc.rotation.x = Math.PI / 2;
  wg.add(disc);

  // Crimson forged 6-piston brake caliper
  boxAt(wg, 0.075, 0.125, 0.07, 0.12, 0.05, 0.01, pal.crimsonLed, false, false, 0.015);

  // 7 forged spoke blades + center lock hub
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const sp = new THREE.Mesh(getRoundedBox(0.024, 0.21, 0.024, 0.005, 1), pal.brushedTitanium);
    sp.position.set(Math.cos(a) * 0.105, Math.sin(a) * 0.105, 0.045);
    sp.rotation.z = a - Math.PI / 2;
    wg.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.07, 16), pal.carbonWeave);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.042;
  wg.add(hub);

  parent.add(g);
}

/**
 * 350 kW EV Ultra-Fast DC Hyper-Charger Hardware Totem with coiled CCS2 cable.
 */
function buildEvHyperChargerTotem(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  rotY: number,
  pal: DealershipPalette,
  M: MaterialLibrary,
  screenReg: ScreenRegistry,
  picks: THREE.Object3D[]
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  // Plinth + dual-tone carbon monolith
  boxAt(g, 1.04, 0.09, 0.72, 0, 0.045, 0, pal.brushedTitanium, true, true, 0.02);
  const body = boxAt(g, 0.72, 2.08, 0.44, 0, 1.13, 0, pal.carbonWeave, true, true, 0.04);
  picks.push(body);

  // Brushed titanium arch halo & status bar
  boxAt(g, 0.78, 0.07, 0.48, 0, 2.18, 0, pal.brushedTitanium, false, false, 0.02);
  boxAt(g, 0.56, 0.045, 0.04, 0, 2.02, 0.215, pal.cyanFlow, false, false);

  // Interactive telemetry screen face
  const chBoard = createCustomBoardScreen(screenReg, 256, 320, (ctx, w, h, t) => {
    ctx.fillStyle = '#090d14';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('APEX 350 kW DC FAST', w * 0.5, 22);

    const pct = 52 + Math.floor((Math.sin(t * 0.65) * 0.5 + 0.5) * 34);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 54px monospace';
    ctx.fillText(`${pct}%`, w * 0.5, 118);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 14px sans-serif';
    ctx.fillText('800V ARCHITECTURE · 342 kW', w * 0.5, 152);

    ctx.fillStyle = '#1e293b';
    rr(ctx, 26, 182, w - 52, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    rr(ctx, 26, 182, ((w - 52) * pct) / 100, 22, 6);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 15px monospace';
    ctx.fillText('10–80% IN 14 MIN', w * 0.5, 252);
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('CCS2 LIQUID-COOLED', w * 0.5, 282);
  });
  const scrMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.62), chBoard.mat);
  scrMesh.position.set(0, 1.54, 0.225);
  g.add(scrMesh);
  chBoard.setMesh(scrMesh);

  // Side cable holster & coiled heavy CCS2 cable
  boxAt(g, 0.08, 0.24, 0.14, 0.39, 1.24, 0.04, pal.brushedTitanium, false, false, 0.015);
  const gun = boxAt(g, 0.09, 0.22, 0.09, 0.42, 1.32, 0.04, M.dark, false, false, 0.015);
  gun.rotation.z = -0.25;

  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.36, 1.66, 0.04),
    new THREE.Vector3(0.56, 1.32, 0.12),
    new THREE.Vector3(0.58, 0.62, 0.06),
    new THREE.Vector3(0.46, 0.38, -0.02),
    new THREE.Vector3(0.42, 1.18, 0.04),
  ]);
  const cableMesh = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 24, 0.026, 8, false), M.black);
  cableMesh.castShadow = true;
  g.add(cableMesh);

  parent.add(g);
}

/**
 * Level 1 Full-Motion Carbon Motorsport Telemetry Simulator Rig.
 */
function buildMotorsportSimulatorRig(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  pal: DealershipPalette,
  M: MaterialLibrary,
  screenReg: ScreenRegistry,
  picks: THREE.Object3D[]
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Heavy motion actuator frame base
  const base = boxAt(g, 2.35, 0.12, 1.48, 0, 0.06, 0, pal.brushedTitanium, true, true, 0.02);
  boxAt(g, 2.28, 0.015, 1.4, 0, 0.015, 0, pal.crimsonLed, false, false);
  picks.push(base);

  // 4 hydraulic cylinder actuators supporting carbon monocoque cockpit
  [
    [-0.86, -0.46],
    [0.86, -0.46],
    [-0.86, 0.46],
    [0.86, 0.46],
  ].forEach(([ax, az]) => {
    cylAt(g, 0.048, 0.055, 0.24, ax, 0.22, az, pal.carbonWeave, false, false, 12);
    cylAt(g, 0.028, 0.028, 0.14, ax, 0.34, az, pal.brushedTitanium, false, false, 10);
  });

  // Carbon monocoque chassis tub (facing East/+X cockpit or North/-Z; face North -Z toward visitor!)
  const tub = boxAt(g, 0.92, 0.32, 1.38, 0, 0.44, 0, pal.carbonWeave, true, true, 0.05);
  picks.push(tub);

  // Sculpted Alcantara racing bucket seat with crimson headrest bolsters (at +Z end facing -Z)
  boxAt(g, 0.54, 0.12, 0.5, 0, 0.62, 0.34, pal.alcantaraCharcoal, true, false, 0.04);
  const backrest = boxAt(g, 0.52, 0.68, 0.12, 0, 0.94, 0.56, pal.alcantaraCharcoal, true, false, 0.04);
  backrest.rotation.x = 0.22;
  [-0.22, 0.22].forEach((bx) => {
    const bolster = boxAt(g, 0.09, 0.48, 0.16, bx, 0.92, 0.5, pal.crimsonLed, false, false, 0.02);
    bolster.rotation.x = 0.22;
  });

  // Steering column & F1 yoke facing driver
  const col = cylAt(g, 0.026, 0.032, 0.44, 0, 0.84, -0.1, pal.brushedTitanium, false, false, 10);
  col.rotation.x = -0.68;
  boxAt(g, 0.28, 0.14, 0.04, 0, 0.94, 0.06, pal.carbonWeave, false, false, 0.02);
  boxAt(g, 0.12, 0.06, 0.045, 0, 0.94, 0.065, pal.cyanFlow, false, false);

  // Panoramic triple-panel curved telemetry screen rig mounted at front (-Z)
  const simScr = createCustomBoardScreen(screenReg, 512, 180, (ctx, w, h, t) => {
    ctx.fillStyle = '#070a10';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#181e29';
    ctx.fillRect(0, 0, w, 28);
    ctx.fillStyle = '#ef4444';
    ctx.font = '800 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('APEX GT TELEMETRY SIMULATOR · TRACK MODE', 14, 18);

    // Track horizon & telemetry curve
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(98, 106, 58, 36, 0.2, 0, Math.PI * 2);
    ctx.stroke();
    const dotA = t * 1.4;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(98 + Math.cos(dotA) * 58, 106 + Math.sin(dotA) * 36, 5, 0, Math.PI * 2);
    ctx.fill();

    const kmh = 186 + Math.round(Math.sin(t * 1.8) * 54);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 46px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${kmh}`, 275, 110);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px sans-serif';
    ctx.fillText('KM/H · GEAR 5 · DUAL-MOTOR', 275, 138);

    // Live G-meter & regen bars
    const bars = [0.76, 0.48, 0.88, 0.62];
    bars.forEach((b, i) => {
      const bx = 385 + i * 26;
      const bh = Math.round((b + Math.sin(t * 2 + i) * 0.14) * 76);
      ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#38bdf8';
      ctx.fillRect(bx, 148 - bh, 16, bh);
    });
  });

  // Three angled monitor frames
  const wings: Array<[number, number, number, number]> = [
    [0, 0, -0.44, 0],
    [-0.56, 0, -0.34, 0.42],
    [0.56, 0, -0.34, -0.42],
  ];
  wings.forEach(([wx, , wz, ry], wi) => {
    const f = boxAt(g, wi === 0 ? 0.68 : 0.56, 0.42, 0.03, wx, 1.18, wz, M.dark, true, false, 0.01);
    f.rotation.y = ry;
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(wi === 0 ? 0.64 : 0.52, 0.37), simScr.mat);
    sc.position.set(wx + Math.sin(ry) * 0.018, 1.18, wz + Math.cos(ry) * 0.018);
    sc.rotation.y = ry;
    g.add(sc);
    if (wi === 0) simScr.setMesh(sc);
  });

  parent.add(g);
}

/**
 * Level 1 EV Dual-Motor & Solid-State Battery Skate Cutaway Exhibit under glass vitrine.
 */
function buildEvPowertrainVitrine(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  pal: DealershipPalette,
  M: MaterialLibrary,
  picks: THREE.Object3D[]
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Obsidian pedestal base + brushed titanium top trim
  const plinth = boxAt(g, 2.55, 0.78, 1.36, 0, 0.39, 0, pal.carbonWeave, true, true, 0.03);
  boxAt(g, 2.6, 0.045, 1.4, 0, 0.79, 0, pal.brushedTitanium, false, true, 0.01);
  boxAt(g, 2.5, 0.015, 1.32, 0, 0.818, 0, pal.warmLed, false, false);
  picks.push(plinth);

  // Exposed EV Skateboard Chassis Frame
  boxAt(g, 2.15, 0.04, 0.92, 0, 0.87, 0, pal.brushedTitanium, false, true, 0.01);

  // Modular Solid-State Lithium Cell Packs (silver/blue prismatic modules)
  for (let r = -1; r <= 1; r += 2) {
    for (let c = -2; c <= 2; c++) {
      boxAt(g, 0.22, 0.11, 0.28, c * 0.26, 0.945, r * 0.22, M.metal, true, false, 0.008);
    }
  }

  // Front & Rear Dual-Motor Copper-Wound E-Axle Units
  [-0.84, 0.84].forEach((mx) => {
    const motorHousing = cylAt(g, 0.13, 0.13, 0.56, mx, 0.98, 0, pal.brushedTitanium, true, false, 18);
    motorHousing.rotation.x = Math.PI / 2;
    const copperWinding = cylAt(g, 0.136, 0.136, 0.16, mx, 0.98, 0, pal.copperCoil, false, false, 18);
    copperWinding.rotation.x = Math.PI / 2;
  });

  // High-Voltage Orange Busbar Conduits linking battery pack to both motors
  [-0.1, 0.1].forEach((bz) => {
    boxAt(g, 1.56, 0.03, 0.035, 0, 1.02, bz, pal.hvOrange, false, false, 0.008);
  });

  // Museum protective crystal-glass vitrine dome
  boxAt(g, 2.48, 0.52, 1.28, 0, 1.07, 0, pal.crystalGlass, false, false);
  boxAt(g, 2.5, 0.025, 1.3, 0, 1.335, 0, pal.brushedTitanium, false, false);

  parent.add(g);
}

/**
 * Level 2 Collector Aerodynamic Wind-Tunnel GT Speedform Sculpture Vitrine.
 */
function buildAeroWindTunnelVitrine(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  pal: DealershipPalette,
  M: MaterialLibrary,
  picks: THREE.Object3D[]
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Obsidian wind-tunnel plinth base & rolling belt deck
  const base = boxAt(g, 2.86, 0.82, 1.32, 0, 0.41, 0, pal.carbonWeave, true, true, 0.04);
  boxAt(g, 2.92, 0.05, 1.38, 0, 0.83, 0, pal.brushedTitanium, false, true, 0.015);
  boxAt(g, 2.45, 0.025, 0.95, 0, 0.865, 0, pal.alcantaraCharcoal, false, true);
  picks.push(base);

  // Twin titanium airfoil pylons elevating the GT speedform inside airflow
  [-0.52, 0.52].forEach((px) => {
    boxAt(g, 0.06, 0.22, 0.14, px, 0.98, 0, pal.brushedTitanium, false, false, 0.01);
  });

  // Sculpted liquid-crimson & clearcoat GT fastback aerodynamic speedform body
  const carPaint = new THREE.MeshPhysicalMaterial({
    color: 0xa61d24,
    metalness: 0.72,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.85,
  });
  const lowerBody = new THREE.Mesh(getRoundedBox(1.88, 0.24, 0.72, 0.09, 3), carPaint);
  lowerBody.position.set(0, 1.16, 0);
  lowerBody.castShadow = true;
  g.add(lowerBody);

  const canopyGeo = new THREE.SphereGeometry(0.42, 24, 14);
  canopyGeo.scale(1.65, 0.46, 0.72);
  const canopy = new THREE.Mesh(canopyGeo, M.black);
  canopy.position.set(-0.08, 1.29, 0);
  g.add(canopy);

  // Sculpted carbon rear aero wing
  boxAt(g, 0.22, 0.025, 0.74, 0.82, 1.36, 0, pal.carbonWeave, false, false, 0.005);

  // 5 luminous aerodynamic airflow streamline tubes curving smoothly over the GT silhouette
  [-0.28, -0.14, 0, 0.14, 0.28].forEach((fz, fi) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.22, 1.02, fz * 0.95),
      new THREE.Vector3(-0.72, 1.34 - Math.abs(fz) * 0.2, fz),
      new THREE.Vector3(-0.05, 1.56 - Math.abs(fz) * 0.24, fz),
      new THREE.Vector3(0.68, 1.42 - Math.abs(fz) * 0.16, fz),
      new THREE.Vector3(1.24, 1.22, fz * 1.08),
    ]);
    const mat = fi === 2 ? pal.crimsonLed : pal.cyanFlow;
    const stream = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.011, 6, false), mat);
    g.add(stream);
  });

  // Frameless museum vitrine enclosure
  boxAt(g, 2.76, 0.86, 1.22, 0, 1.28, 0, pal.crystalGlass, false, false);
  boxAt(g, 2.78, 0.03, 1.24, 0, 1.72, 0, pal.brushedTitanium, false, false);

  parent.add(g);
}

/**
 * Full 3-Level Bespoke TerraCraft Interior Build for Apex Motors Showroom ('dealership').
 */
export function buildApexDealershipWholeBuilding(ctx: DealershipBuildContext) {
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

  const pal = getDealershipPalette();
  const SLAB_THICK = 0.24;
  const g0 = levelGroups[0];
  const g1 = levelGroups[1];
  const g2 = levelGroups[2];

  const fy0 = spec.groundY + SLAB_THICK * 0.5;
  const fy1 = spec.groundY + spec.floorH + SLAB_THICK * 0.5;
  const fy2 = spec.groundY + spec.floorH * 2 + SLAB_THICK * 0.5;

  // =========================================================================
  // 0. EXTERIOR CANOPY & FORECOURT (preserving street walkway & door access)
  // =========================================================================
  const foreCanopy = new THREE.Mesh(
    getRoundedSlabGeo(12.8, 3.4, 0.65, 0.34, 0.05),
    archMats.stuccoWhite
  );
  foreCanopy.position.set(spec.doorX, spec.groundY + spec.floorH - 0.18, spec.doorZ + 1.75);
  foreCanopy.castShadow = true;
  g0.add(foreCanopy);
  const foreSoffit = new THREE.Mesh(
    getRoundedSlabGeo(12.2, 2.9, 0.5, 0.07, 0.015),
    archMats.timberSoffit
  );
  foreSoffit.position.set(spec.doorX, spec.groundY + spec.floorH - 0.34, spec.doorZ + 1.75);
  g0.add(foreSoffit);
  // Subtle crimson LED light reveal along outer forecourt soffit edge
  boxAt(g0, 11.4, 0.025, 0.04, spec.doorX, spec.groundY + spec.floorH - 0.35, spec.doorZ + 3.22, pal.crimsonLed, false, false);
  [-5.2, 5.2].forEach((px) => {
    cylAt(
      g0,
      0.16,
      0.18,
      spec.floorH - 0.3,
      spec.doorX + px,
      spec.groundY + (spec.floorH - 0.3) * 0.5,
      spec.doorZ + 2.9,
      archMats.bronzeMullion,
      true,
      true,
      14
    );
  });
  buildTropicalPalm(g0, spec.cx - spec.w * 0.45, spec.groundY, spec.doorZ + 2.5, 3.9, 515, M, archMats);

  // =========================================================================
  // LEVEL 0: THE APEX PODIUM & GRAND DELIVERY HALL
  // =========================================================================
  // Custom honed obsidian terrazzo inlay pad (polygonOffset eliminates Z-fighting cleanly)
  const g0FloorOverlay = new THREE.Mesh(new THREE.PlaneGeometry(spec.w - 1.2, spec.d - 1.2), pal.obsidianTerrazzo);
  g0FloorOverlay.rotation.x = -Math.PI / 2;
  g0FloorOverlay.position.set(spec.cx, fy0 + 0.008, spec.cz);
  g0FloorOverlay.receiveShadow = true;
  g0.add(g0FloorOverlay);

  // Brushed titanium paddock framing border beneath hero turntable
  const paddockRing = new THREE.Mesh(new THREE.RingGeometry(3.48, 3.62, 48), pal.brushedTitanium);
  paddockRing.rotation.x = -Math.PI / 2;
  paddockRing.position.set(spec.cx, fy0 + 0.014, spec.cz + 0.4);
  g0.add(paddockRing);

  // Center Hero Rotating Travertine & Carbon Turntable (directly beneath L1 Sky-Oculus void!)
  const turnGrp = new THREE.Group();
  turnGrp.position.set(spec.cx, fy0, spec.cz + 0.4);
  g0.add(turnGrp);
  cylAt(turnGrp, 3.05, 3.16, 0.14, 0, 0.07, 0, pal.carbonWeave, true, true, 40);
  cylAt(turnGrp, 2.86, 2.86, 0.035, 0, 0.155, 0, pal.travertine, false, true, 40);
  cylAt(turnGrp, 3.11, 3.11, 0.025, 0, 0.145, 0, pal.crimsonLed, false, false, 40);
  const heroCar = makeCar(0x9e1b24, 'suv', { showroom: true, plateText: 'APEX GT' });
  heroCar.position.set(0, 0.175, 0);
  turnGrp.add(heroCar);
  rotatingProps.push({ obj: turnGrp, speed: 0.28, axis: 'y' });

  // Sculpted Spec Plaque Stanchion front-left of Turntable
  cylAt(g0, 0.18, 0.2, 0.03, spec.cx - 2.35, fy0 + 0.015, spec.cz + 3.45, pal.brushedTitanium, false, true, 16);
  cylAt(g0, 0.024, 0.028, 0.92, spec.cx - 2.35, fy0 + 0.47, spec.cz + 3.45, pal.brushedTitanium, false, false, 10);
  const stanchionPlaque = boxAt(g0, 0.46, 0.03, 0.3, spec.cx - 2.35, fy0 + 0.94, spec.cz + 3.45, pal.carbonWeave, true, false, 0.008);
  stanchionPlaque.rotation.x = 0.48;

  // Flanking Bespoke Display Plinths + Vehicles
  const buildCarPlinth = (px: number, pz: number, rotY: number, pw: number, pd: number, carCol: number, style: 'sedan' | 'hatch', plate: string) => {
    const pg = new THREE.Group();
    pg.position.set(px, fy0, pz);
    pg.rotation.y = rotY;
    const base = boxAt(pg, pw, 0.068, pd, 0, 0.034, 0, pal.carbonWeave, true, true, 0.02);
    boxAt(pg, pw - 0.16, 0.014, pd - 0.16, 0, 0.008, 0, pal.warmLed, false, false);
    pickMeshes.push(base);
    const car = makeCar(carCol, style, { showroom: true, plateText: plate });
    car.position.set(0, 0.068, 0);
    pg.add(car);
    g0.add(pg);
  };
  buildCarPlinth(spec.cx - 5.9, spec.cz + 1.6, 0.4, 2.45, 4.7, 0x1b457a, 'sedan', 'APEX EV');
  buildCarPlinth(spec.cx + 4.9, spec.cz + 1.0, -0.35, 2.45, 4.3, 0xd4dce6, 'hatch', 'APEX E4');

  // North Rear Feature Wall: Acoustic Walnut Fin Rhythm + Carbon Monolith + Live Telemetry Board
  boxAt(g0, 6.4, 3.85, 0.12, spec.cx, fy0 + 1.92, spec.cz - 8.76, pal.carbonWeave, false, true);
  for (let fx = -7.2; fx <= 7.2; fx += 0.36) {
    if (Math.abs(fx) < 3.35) continue;
    boxAt(g0, 0.08, 3.85, 0.1, spec.cx + fx, fy0 + 1.92, spec.cz - 8.72, M.walnut, true, false, 0.01);
  }
  const carBoard = createCustomBoardScreen(screenReg, 640, 220, (g, w, h, t) => {
    g.fillStyle = '#0e1118';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ef4444';
    g.fillRect(0, 0, w, 34);
    g.fillStyle = '#ffffff';
    g.font = '800 18px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('APEX MOTORS · NAIROBI FLAGSHIP & EV TELEMETRY', 16, 17);
    const models = [
      ['Apex GT Crimson SUV', 'AWD Hybrid · 540 km', 'KES 8.4M'],
      ['Apex Executive Sedan', 'Dual Motor EV · 610 km', 'KES 6.2M'],
      ['Apex Urban E4 Hatch', '350kW Fast Charge 14m', 'KES 4.8M'],
    ];
    models.forEach((m, i) => {
      const y = 56 + i * 52;
      g.fillStyle = i === Math.floor(t / 3.5) % 3 ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.06)';
      rr(g, 16, y, w - 32, 42, 6);
      g.fill();
      g.fillStyle = '#f8fafc';
      g.font = '700 16px sans-serif';
      g.fillText(m[0], 28, y + 21);
      g.fillStyle = '#94a3b8';
      g.font = '500 14px sans-serif';
      g.fillText(m[1], 270, y + 21);
      g.fillStyle = '#fca5a5';
      g.textAlign = 'right';
      g.font = '700 16px monospace';
      g.fillText(m[2], w - 28, y + 21);
      g.textAlign = 'left';
    });
  });
  boxAt(g0, 5.8, 2.2, 0.14, spec.cx, fy0 + 2.32, spec.cz - 8.66, frameDarkMat, false, false);
  const cbMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.95), carBoard.mat);
  cbMesh.position.set(spec.cx, fy0 + 2.32, spec.cz - 8.58);
  g0.add(cbMesh);
  carBoard.setMesh(cbMesh);

  // Two Sculpted Travertine & Carbon Sales Desks + Chairs + Live Interactive Monitors
  [
    { dx: -6.0, role: 'EV Fleet Advisor', idx: 0, swiv: 1 },
    { dx: 4.2, role: 'Finance & Lease Manager', idx: 1, swiv: -1 },
  ].forEach(({ dx, role, idx, swiv }) => {
    const px = spec.cx + dx;
    const pz = spec.cz - 5.6;
    buildConciergeDesk(g0, px, fy0, pz, 2.4, 1.08, pal, pickMeshes);
    registerChair(0, px, fy0, pz - 0.9, 0, swiv);
    registerMonitor(0, idx, [px, fy0 + 0.775, pz + 0.14], Math.PI, px, pz - 0.9, role, 'Showroom Sales Gallery');
  });

  // SW Espresso Hospitality Lounge (Table, 2 Saddle-Tan Armchairs & Barista Pedestal)
  const swTx = spec.cx - 7.4;
  const swTz = spec.cz + 6.3;
  contact(g0, swTx, fy0 + 0.014, swTz, 1.2, 1.2, 0.42, M.textures.shadowTex);
  cylAt(g0, 0.28, 0.32, 0.035, swTx, fy0 + 0.018, swTz, pal.brushedTitanium, false, true, 18);
  cylAt(g0, 0.04, 0.048, 0.68, swTx, fy0 + 0.36, swTz, pal.brushedTitanium, true, false, 12);
  const swTop = cylAt(g0, 0.56, 0.56, 0.045, swTx, fy0 + 0.72, swTz, pal.travertine, true, true, 24);
  pickMeshes.push(swTop);
  // Espresso coffee cup & key tray on table
  cylAt(g0, 0.042, 0.035, 0.065, swTx - 0.12, fy0 + 0.775, swTz, M.ceramicMat, false, false, 12);
  boxAt(g0, 0.22, 0.018, 0.14, swTx + 0.14, fy0 + 0.752, swTz, pal.saddleLeather, false, false, 0.005);
  armchair(g0, spec.cx - 8.55, fy0, swTz, Math.PI / 2, pal.saddleLeather, M);
  armchair(g0, swTx, fy0, spec.cz + 7.45, Math.PI, pal.saddleLeather, M);

  // Compact Espresso Barista Totem in SW corner
  const espX = spec.cx - 8.75;
  const espZ = spec.cz + 7.75;
  boxAt(g0, 0.78, 0.92, 0.54, espX, fy0 + 0.46, espZ, pal.carbonWeave, true, true, 0.02);
  boxAt(g0, 0.82, 0.045, 0.58, espX, fy0 + 0.94, espZ, pal.travertine, false, true, 0.01);
  boxAt(g0, 0.38, 0.34, 0.32, espX, fy0 + 1.13, espZ, pal.brushedTitanium, true, false, 0.02);
  cylAt(g0, 0.04, 0.04, 0.08, espX - 0.22, fy0 + 1.0, espZ, M.ceramicMat, false, false, 10);

  // SE 350 kW EV Ultra-Fast DC Hyper-Charger Showcase
  buildEvHyperChargerTotem(g0, spec.cx + 5.6, fy0, spec.cz + 6.6, -0.35, pal, M, screenReg, pickMeshes);

  // East Under-Stair Glazed Rim Gallery Alcove (x = +7.82 separating showroom from stair foot & NE niche)
  boxAt(g0, 0.08, 3.85, 13.24, spec.cx + 7.82, fy0 + 1.925, spec.cz - 2.16, pal.crystalGlass, false, false);
  for (let mz = -8.4; mz <= 4.3; mz += 1.4) {
    boxAt(g0, 0.09, 3.85, 0.09, spec.cx + 7.82, fy0 + 1.925, spec.cz + mz, pal.brushedTitanium, true, false);
  }
  // 2 Illuminated Forged Motorsport Wheel Pedestals showcased behind under-stair glass!
  buildForgedWheelPedestal(g0, spec.cx + 8.75, fy0, spec.cz - 5.2, pal, M, pickMeshes);
  buildForgedWheelPedestal(g0, spec.cx + 8.75, fy0, spec.cz - 7.3, pal, M, pickMeshes);

  // Ground -> Level 1 Cantilevered Spine Stair (East Gallery Wing: x = +8.77, z = +4.6 -> -3.6)
  buildCantileverSpineStair(g0, spec.cx + 8.77, fy0, fy1, spec.cz + 4.6, spec.cz - 3.6, -1, pal, pickMeshes);

  // =========================================================================
  // LEVEL 1: BESPOKE ATELIER, DESIGN STUDIO & MOTORSPORT SIMULATOR
  // =========================================================================
  // Chevron smoked-walnut floor overlays on North & South Mezzanine wings (avoiding voids cleanly)
  const northFloor1 = new THREE.Mesh(new THREE.PlaneGeometry(spec.w - 1.4, 5.8), pal.chevronWalnut);
  northFloor1.rotation.x = -Math.PI / 2;
  northFloor1.position.set(spec.cx, fy1 + 0.008, spec.cz - 5.55);
  northFloor1.receiveShadow = true;
  g1.add(northFloor1);

  const southFloor1 = new THREE.Mesh(new THREE.PlaneGeometry(spec.w - 1.4, 5.1), pal.chevronWalnut);
  southFloor1.rotation.x = -Math.PI / 2;
  southFloor1.position.set(spec.cx, fy1 + 0.008, spec.cz + 5.95);
  southFloor1.receiveShadow = true;
  g1.add(southFloor1);

  // Central Sky-Oculus Atrium Balustrade ([-3.45, +3.45, -2.45, +3.25]) overlooking Ground turntable!
  addTitaniumBalustrade(g1, spec.cx, fy1, spec.cz - 2.45, 7.04, 0.1, pal);
  addTitaniumBalustrade(g1, spec.cx, fy1, spec.cz + 3.25, 7.04, 0.1, pal);
  addTitaniumBalustrade(g1, spec.cx - 3.45, fy1, spec.cz + 0.4, 0.1, 5.8, pal);
  addTitaniumBalustrade(g1, spec.cx + 3.45, fy1, spec.cz + 0.4, 0.1, 5.8, pal);
  // Warm perimeter atrium cove glow beneath slab rim
  boxAt(g1, 6.86, 0.03, 0.04, spec.cx, fy1 - 0.14, spec.cz - 2.44, pal.warmLed, false, false);
  boxAt(g1, 6.86, 0.03, 0.04, spec.cx, fy1 - 0.14, spec.cz + 3.24, pal.warmLed, false, false);

  // East Stair Arrival Guardrails on Level 1 (void [+7.84, +9.68, -3.72, +4.65]; North arrival open!)
  addTitaniumBalustrade(g1, spec.cx + 7.82, fy1, spec.cz + 0.46, 0.1, 8.46, pal);
  addTitaniumBalustrade(g1, spec.cx + 8.76, fy1, spec.cz + 4.65, 1.94, 0.1, pal);

  // Zone 1A: Paint Speed-Form Gallery Wall (North Wall: dx = 0, dz = -8.45)
  const paintWall = boxAt(g1, 6.1, 2.55, 0.16, spec.cx, fy1 + 1.275, spec.cz - 8.58, pal.carbonWeave, true, true, 0.02);
  boxAt(g1, 6.16, 0.72, 0.46, spec.cx, fy1 + 0.36, spec.cz - 8.42, M.walnut, true, true, 0.02);
  pickMeshes.push(paintWall);
  // Two horizontal backlit carbon shelves holding 10 high-gloss metallic automotive speedform blisters
  const speedformColors = [0x9e1b24, 0x166534, 0x1d4ed8, 0xc2410c, 0xd4d4d8, 0x334155, 0xca8a04, 0x111827, 0x0f766e, 0x7c2d12];
  [1.18, 1.88].forEach((sy, row) => {
    boxAt(g1, 5.4, 0.05, 0.24, spec.cx, fy1 + sy, spec.cz - 8.44, pal.brushedTitanium, false, false, 0.008);
    boxAt(g1, 5.2, 0.015, 0.02, spec.cx, fy1 + sy - 0.03, spec.cz - 8.48, pal.warmLed, false, false);
    for (let k = 0; k < 5; k++) {
      const fx = spec.cx - 2.1 + k * 1.05;
      const col = speedformColors[row * 5 + k];
      const paintMat = new THREE.MeshPhysicalMaterial({
        color: col,
        metalness: 0.78,
        roughness: 0.22,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        envMapIntensity: 0.85,
      });
      const frogGeo = new THREE.SphereGeometry(0.18, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
      frogGeo.scale(1.5, 0.75, 0.9);
      const frog = new THREE.Mesh(frogGeo, paintMat);
      frog.position.set(fx, fy1 + sy + 0.028, spec.cz - 8.42);
      frog.castShadow = true;
      g1.add(frog);
    }
  });

  // Flanking Forged Alloy Wheel & Ceramic Brake Caliper Display Pedestals (North Atelier)
  buildForgedWheelPedestal(g1, spec.cx - 5.0, fy1, spec.cz - 6.0, pal, M, pickMeshes);
  buildForgedWheelPedestal(g1, spec.cx + 5.0, fy1, spec.cz - 6.0, pal, M, pickMeshes);

  // Central Bespoke Trim & Leather Commissioning Table (North Atelier)
  const trimTable = boxAt(g1, 2.95, 0.065, 1.24, spec.cx, fy1 + 0.745, spec.cz - 5.5, M.walnut, true, true, 0.02);
  boxAt(g1, 2.75, 0.015, 0.42, spec.cx, fy1 + 0.78, spec.cz - 5.5, pal.saddleLeather, false, true, 0.005);
  [-1.15, 1.15].forEach((lx) => {
    boxAt(g1, 0.08, 0.72, 0.96, spec.cx + lx, fy1 + 0.36, spec.cz - 5.5, pal.brushedTitanium, true, true, 0.012);
  });
  // Leather swatch palette rolls & material sample tray (reusing palette materials)
  const swatchMats = [pal.saddleLeather, pal.alcantaraCharcoal, accentMat, pal.travertine];
  swatchMats.forEach((sMat, hi) => {
    const roll = cylAt(g1, 0.042, 0.042, 0.24, spec.cx - 0.86 + hi * 0.12, fy1 + 0.825, spec.cz - 5.45, sMat, false, false, 12);
    roll.rotation.x = Math.PI / 2;
  });
  pickMeshes.push(trimTable);
  registerChair(1, spec.cx, fy1, spec.cz - 6.5, 0, 1);
  registerMonitor(1, 2, [spec.cx, fy1 + 0.78, spec.cz - 5.35], Math.PI, spec.cx, spec.cz - 6.5, 'Bespoke Trim & Paint Specialist', 'Atelier Commissioning Studio');
  armchair(g1, spec.cx + 2.05, fy1, spec.cz - 5.5, -Math.PI / 2, pal.saddleLeather, M);

  // Zone 1B (South Wing): Motorsport Telemetry Simulator, EV Powertrain Desk & Cutaway Vitrine
  buildMotorsportSimulatorRig(g1, spec.cx - 4.2, fy1, spec.cz + 6.1, pal, M, screenReg, pickMeshes);
  buildConciergeDesk(g1, spec.cx + 0.4, fy1, spec.cz + 6.2, 2.3, 1.02, pal, pickMeshes);
  registerChair(1, spec.cx + 0.4, fy1, spec.cz + 5.3, 0, -1);
  registerMonitor(1, 3, [spec.cx + 0.4, fy1 + 0.775, spec.cz + 6.05], Math.PI, spec.cx + 0.4, spec.cz + 5.3, 'EV Powertrain & Telemetry Engineer', 'EV Engineering Lab');
  buildEvPowertrainVitrine(g1, spec.cx + 4.8, fy1, spec.cz + 6.2, pal, M, pickMeshes);

  // East & West Mezzanine Promenade Consoles & Olive Planters
  boxAt(g1, 0.64, 0.84, 2.2, spec.cx + 7.2, fy1 + 0.42, spec.cz + 0.4, M.walnut, true, true, 0.015);
  boxAt(g1, 0.64, 0.84, 2.2, spec.cx - 7.2, fy1 + 0.42, spec.cz + 0.4, M.walnut, true, true, 0.015);
  plant(g1, spec.cx + 5.8, fy1, spec.cz - 2.3, 1.05, 901, M, 'olive');
  plant(g1, spec.cx - 5.8, fy1, spec.cz + 2.8, 1.05, 902, M, 'olive');

  // Level 1 -> Level 2 Under-Stair Glass Screen (sealing West stair SW under-zone on L1)
  boxAt(g1, 0.08, 3.85, 12.2, spec.cx - 7.82, fy1 + 1.925, spec.cz + 2.55, pal.crystalGlass, false, false);
  for (let mz = -3.2; mz <= 8.2; mz += 1.42) {
    boxAt(g1, 0.09, 3.85, 0.09, spec.cx - 7.82, fy1 + 1.925, spec.cz + mz, pal.brushedTitanium, true, false);
  }
  buildCantileverSpineStair(g1, spec.cx - 8.77, fy1, fy2, spec.cz - 3.6, spec.cz + 4.6, 1, pal, pickMeshes);

  // =========================================================================
  // LEVEL 2: VIP HANDOVER SKY-LOUNGE, PRINCIPAL SUITE & COLLECTOR PAVILION
  // =========================================================================
  const l2FloorOverlay = new THREE.Mesh(new THREE.PlaneGeometry(spec.w - 1.2, spec.d - 1.2), pal.chevronWalnut);
  l2FloorOverlay.rotation.x = -Math.PI / 2;
  l2FloorOverlay.position.set(spec.cx, fy2 + 0.008, spec.cz);
  l2FloorOverlay.receiveShadow = true;
  g2.add(l2FloorOverlay);

  // West Stair Arrival Guardrails on Level 2 (void [-9.68, -7.84, -3.72, +4.65]; South arrival open!)
  addTitaniumBalustrade(g2, spec.cx - 7.82, fy2, spec.cz + 0.46, 0.1, 8.46, pal);
  addTitaniumBalustrade(g2, spec.cx - 8.76, fy2, spec.cz - 3.72, 1.94, 0.1, pal);

  // Zone 2A (South Sky-Lounge): VIP Handover Reveal Lounge & Espresso/Champagne Bar
  const loungeRug = boxAt(g2, 4.4, 0.018, 3.5, spec.cx - 1.8, fy2 + 0.012, spec.cz + 5.9, M.rug, false, true, 0.006);
  pickMeshes.push(loungeRug);
  sofaWide(g2, spec.cx - 1.8, fy2, spec.cz + 6.8, Math.PI, pal.saddleLeather, M);
  armchair(g2, spec.cx + 0.65, fy2, spec.cz + 5.2, -Math.PI * 0.68, pal.saddleLeather, M);

  // Travertine & Smoke-Glass VIP Coffee Table + Velvet GT Key Presentation Box
  const vipTable = boxAt(g2, 1.56, 0.055, 0.84, spec.cx - 1.8, fy2 + 0.4, spec.cz + 5.0, pal.travertine, true, true, 0.02);
  boxAt(g2, 1.32, 0.36, 0.62, spec.cx - 1.8, fy2 + 0.18, spec.cz + 5.0, pal.carbonWeave, true, true, 0.015);
  boxAt(g2, 0.24, 0.045, 0.16, spec.cx - 1.8, fy2 + 0.45, spec.cz + 5.0, pal.alcantaraCharcoal, false, false, 0.008);
  boxAt(g2, 0.08, 0.014, 0.04, spec.cx - 1.8, fy2 + 0.478, spec.cz + 5.0, accentMat, false, false);
  pickMeshes.push(vipTable);

  // Giant VIP Handover Reveal & Fleet Analytics Wall Display (South Sky-Lounge Wall)
  const vipRevealBoard = createCustomBoardScreen(screenReg, 540, 200, (g, w, h, t) => {
    g.fillStyle = '#0d1017';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ef4444';
    g.fillRect(0, 0, w, 6);
    g.fillRect(0, h - 6, w, 6);

    const pulse = 0.72 + Math.sin(t * 1.4) * 0.28;
    g.fillStyle = `rgba(239, 68, 68, ${0.15 * pulse})`;
    rr(g, 20, 20, w - 40, h - 40, 12);
    g.fill();

    g.fillStyle = '#fca5a5';
    g.font = '700 14px sans-serif';
    g.textAlign = 'center';
    g.fillText('APEX BESPOKE · VIP OWNER HANDOVER SUITE', w * 0.5, 48);

    g.fillStyle = '#ffffff';
    g.font = '800 28px "Plus Jakarta Sans", sans-serif';
    g.fillText('BAY 01 · APEX GT CRIMSON READY', w * 0.5, 96);

    g.fillStyle = '#cbd5e1';
    g.font = '500 15px monospace';
    g.fillText('CHASSIS KE-884-GT · FULL BATTERY 100% · KEYS PREPARED', w * 0.5, 134);

    g.fillStyle = '#6fe3a1';
    g.font = '700 14px sans-serif';
    g.fillText('5-YEAR CONCIERGE SERVICE & NAIROBI SUPERCHARGING ACTIVE', w * 0.5, 166);
  });
  boxAt(g2, 4.4, 1.82, 0.14, spec.cx - 1.8, fy2 + 1.82, spec.cz + 8.62, pal.carbonWeave, true, false, 0.02);
  const vipMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.15, 1.56), vipRevealBoard.mat);
  vipMesh.position.set(spec.cx - 1.8, fy2 + 1.82, spec.cz + 8.54);
  vipMesh.rotation.y = Math.PI;
  g2.add(vipMesh);
  vipRevealBoard.setMesh(vipMesh);

  // Owner Hospitality Espresso & Champagne Bar (SE Sky-Lounge)
  const barX = spec.cx + 5.4;
  const barZ = spec.cz + 6.4;
  const barBase = boxAt(g2, 3.5, 1.0, 0.94, barX, fy2 + 0.5, barZ, M.walnut, true, true, 0.025);
  boxAt(g2, 3.62, 0.065, 1.08, barX, fy2 + 1.03, barZ, pal.travertine, true, true, 0.018);
  boxAt(g2, 3.3, 0.025, 0.04, barX, fy2 + 0.18, barZ - 0.52, M.brass, false, false);
  pickMeshes.push(barBase);
  // Espresso tower & champagne bottle accents on bar counter
  boxAt(g2, 0.48, 0.38, 0.34, barX - 0.85, fy2 + 1.25, barZ, pal.brushedTitanium, true, false, 0.02);
  cylAt(g2, 0.045, 0.048, 0.28, barX + 0.85, fy2 + 1.2, barZ, M.brass, false, false, 12);
  cylAt(g2, 0.045, 0.048, 0.28, barX + 1.02, fy2 + 1.2, barZ - 0.08, M.brass, false, false, 12);
  // Twin barstools on North customer side of bar
  [barX - 0.9, barX + 0.9].forEach((sx) => {
    const stZ = barZ - 0.96;
    cylAt(g2, 0.2, 0.22, 0.025, sx, fy2 + 0.015, stZ, pal.brushedTitanium, false, true, 16);
    cylAt(g2, 0.026, 0.032, 0.72, sx, fy2 + 0.38, stZ, pal.brushedTitanium, false, false, 10);
    cylAt(g2, 0.2, 0.18, 0.08, sx, fy2 + 0.75, stZ, pal.saddleLeather, true, false, 16);
  });

  // Zone 2B (North-East): Glazed Fleet & Institutional Boardroom Suite
  // West glass partition (dx = +2.0, dz = -8.7..-0.6)
  boxAt(g2, 0.07, 3.85, 8.1, spec.cx + 2.0, fy2 + 1.925, spec.cz - 4.65, pal.crystalGlass, false, false);
  for (let mz = -8.4; mz <= -0.8; mz += 1.9) {
    boxAt(g2, 0.09, 3.85, 0.09, spec.cx + 2.0, fy2 + 1.925, spec.cz + mz, pal.brushedTitanium, false, false);
  }
  // South glass partition with 2.2m wide doorway (dx = +4.8..+7.0 open!)
  boxAt(g2, 2.8, 3.85, 0.07, spec.cx + 3.4, fy2 + 1.925, spec.cz - 0.6, pal.crystalGlass, false, false);
  boxAt(g2, 2.8, 3.85, 0.07, spec.cx + 8.4, fy2 + 1.925, spec.cz - 0.6, pal.crystalGlass, false, false);
  boxAt(g2, 0.09, 3.85, 0.11, spec.cx + 4.8, fy2 + 1.925, spec.cz - 0.6, pal.brushedTitanium, false, false);
  boxAt(g2, 0.09, 3.85, 0.11, spec.cx + 7.0, fy2 + 1.925, spec.cz - 0.6, pal.brushedTitanium, false, false);

  // Boat-shaped smoked-walnut & titanium conference table (dx = +5.9, dz = -4.6)
  const bTable = boxAt(g2, 4.05, 0.065, 1.5, spec.cx + 5.9, fy2 + 0.745, spec.cz - 4.6, M.walnut, true, true, 0.04);
  boxAt(g2, 2.8, 0.012, 0.34, spec.cx + 5.9, fy2 + 0.78, spec.cz - 4.6, pal.brushedTitanium, false, false, 0.008);
  [-1.35, 1.35].forEach((px) => {
    cylAt(g2, 0.16, 0.22, 0.72, spec.cx + 5.9 + px, fy2 + 0.36, spec.cz - 4.6, pal.carbonWeave, true, true, 16);
  });
  pickMeshes.push(bTable);
  // 4 Boardroom Chairs & 2 Interactive Fleet Monitors
  registerChair(2, spec.cx + 4.8, fy2, spec.cz - 5.75, 0, 1);
  registerChair(2, spec.cx + 7.0, fy2, spec.cz - 5.75, 0, -1);
  registerChair(2, spec.cx + 4.8, fy2, spec.cz - 3.45, Math.PI, 1);
  registerChair(2, spec.cx + 7.0, fy2, spec.cz - 3.45, Math.PI, -1);
  registerMonitor(2, 4, [spec.cx + 4.8, fy2 + 0.78, spec.cz - 4.9], Math.PI, spec.cx + 4.8, spec.cz - 5.75, 'Director of EV Fleet', 'Fleet Financing Boardroom');
  registerMonitor(2, 5, [spec.cx + 7.0, fy2 + 0.78, spec.cz - 4.3], 0, spec.cx + 7.0, spec.cz - 3.45, 'Institutional Finance Lead', 'Fleet Financing Boardroom');

  // Boardroom North Wall Telemetry Screen
  const fleetMapBoard = createCustomBoardScreen(screenReg, 480, 190, (g, w, h, t) => {
    g.fillStyle = '#090e17';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1e293b';
    g.fillRect(0, 0, w, 30);
    g.fillStyle = '#f8fafc';
    g.font = '800 14px sans-serif';
    g.textAlign = 'left';
    g.fillText('EAST AFRICA EV CORRIDOR & CORPORATE FLEET TELEMETRY', 14, 20);
    const hubs = [
      { n: 'NAIROBI HQ', x: 185, y: 112, c: '#ef4444' },
      { n: 'MOMBASA PORT', x: 350, y: 145, c: '#38bdf8' },
      { n: 'KIGALI', x: 75, y: 128, c: '#6fe3a1' },
      { n: 'NAKURU', x: 145, y: 72, c: '#f59e0b' },
    ];
    g.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    g.lineWidth = 2;
    hubs.slice(1).forEach((h2) => {
      g.beginPath();
      g.moveTo(hubs[0].x, hubs[0].y);
      g.lineTo(h2.x, h2.y);
      g.stroke();
    });
    hubs.forEach((h2, hi) => {
      const r = hi === 0 ? 7 + Math.sin(t * 2) * 1.8 : 5;
      g.fillStyle = h2.c;
      g.beginPath();
      g.arc(h2.x, h2.y, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e2e8f0';
      g.font = '700 11px monospace';
      g.fillText(h2.n, h2.x + 10, h2.y + 4);
    });
  });
  boxAt(g2, 4.2, 1.66, 0.1, spec.cx + 5.9, fy2 + 1.95, spec.cz - 8.72, frameDarkMat, false, false);
  const fmMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.96, 1.46), fleetMapBoard.mat);
  fmMesh.position.set(spec.cx + 5.9, fy2 + 1.95, spec.cz - 8.66);
  g2.add(fmMesh);
  fleetMapBoard.setMesh(fmMesh);

  // Zone 2C (North-West): Managing Principal Executive Suite & Aero Wind-Tunnel Sculpture
  // Monumental cantilevered travertine & walnut desk (dx = -3.2, dz = -5.8)
  buildConciergeDesk(g2, spec.cx - 3.2, fy2, spec.cz - 5.8, 2.75, 1.16, pal, pickMeshes);
  registerChair(2, spec.cx - 3.2, fy2, spec.cz - 6.78, 0, 1);
  registerMonitor(2, 6, [spec.cx - 3.2, fy2 + 0.775, spec.cz - 5.65], Math.PI, spec.cx - 3.2, spec.cz - 6.78, 'Managing Principal', 'Principal Executive Suite');
  // North executive library credenza with scale models
  const pCred = boxAt(g2, 3.8, 0.86, 0.5, spec.cx - 3.2, fy2 + 0.43, spec.cz - 8.42, M.walnut, true, true, 0.02);
  boxAt(g2, 3.86, 0.04, 0.54, spec.cx - 3.2, fy2 + 0.88, spec.cz - 8.42, pal.travertine, false, true, 0.01);
  pickMeshes.push(pCred);
  [-1.2, 0, 1.2].forEach((ox, oi) => {
    boxAt(g2, 0.42, 0.14, 0.2, spec.cx - 3.2 + ox, fy2 + 0.97, spec.cz - 8.42, oi === 1 ? accentMat : pal.brushedTitanium, false, false, 0.03);
  });

  // Sculpted Aerodynamic Wind-Tunnel GT Speedform Vitrine (dx = -3.4, dz = +0.2)
  buildAeroWindTunnelVitrine(g2, spec.cx - 3.4, fy2, spec.cz + 0.2, pal, M, pickMeshes);

  // Botanical accent palms/olives on L2
  plant(g2, spec.cx - 6.4, fy2, spec.cz + 7.4, 1.15, 910, M, 'olive');
  plant(g2, spec.cx + 8.6, fy2, spec.cz + 7.4, 1.15, 911, M, 'ficus');

  // =========================================================================
  // BESPOKE ARCHITECTURAL CEILING LIGHTING & WARM GALLERY ILLUMINATION
  // =========================================================================
  for (let lv = 0; lv < 3; lv++) {
    const cg = levelCeilings[lv];
    const yFloor = spec.groundY + lv * spec.floorH;
    const ceilY = yFloor + spec.floorH - 0.14;
    const fy = yFloor + SLAB_THICK * 0.5;

    // Signature recessed linear channels framed around voids cleanly
    if (lv === 0) {
      // Twin recessed channels framing North desks & South showroom entry + octagonal downlight halo around atrium
      ceilingLinearLight(cg, spec.cx - 1.2, ceilY - 0.08, spec.cz - 5.2, 11.2, 0.24, M);
      ceilingLinearLight(cg, spec.cx, ceilY - 0.08, spec.cz + 5.4, 11.8, 0.24, M);
      [-5.8, 4.6].forEach((lx) => downlight(cg, spec.cx + lx, ceilY - 0.08, spec.cz + 1.4, M, 0.16));
    } else if (lv === 1) {
      // Sculpted warm glow halo ring surrounding the Sky-Oculus void + North & South linear lighting
      boxAt(cg, 7.1, 0.03, 0.06, spec.cx, ceilY - 0.09, spec.cz - 2.6, pal.warmLed, false, false);
      boxAt(cg, 7.1, 0.03, 0.06, spec.cx, ceilY - 0.09, spec.cz + 3.4, pal.warmLed, false, false);
      ceilingLinearLight(cg, spec.cx, ceilY - 0.08, spec.cz - 5.4, 11.0, 0.24, M);
      ceilingLinearLight(cg, spec.cx, ceilY - 0.08, spec.cz + 5.8, 11.0, 0.24, M);
    } else {
      // Level 2 acoustic walnut ceiling baffle ribs & warm gallery lighting
      for (let bx = -5.4; bx <= 5.4; bx += 1.8) {
        boxAt(cg, 0.08, 0.16, spec.d - 2.6, spec.cx + bx, ceilY - 0.14, spec.cz, M.walnut, false, false);
      }
      ceilingLinearLight(cg, spec.cx, ceilY - 0.08, spec.cz - 4.6, 11.4, 0.24, M);
      ceilingLinearLight(cg, spec.cx, ceilY - 0.08, spec.cz + 5.4, 11.4, 0.24, M);
    }

    // Register interior light anchors for L1 & L2 (pooled at runtime for zero shader overhead)
    if (lv >= 1) {
      warmLights.push({
        x: spec.cx,
        y: fy + 3.1,
        z: spec.cz,
        color: 0xfff1dc,
        distance: spec.w + 8,
        baseScale: 0.96,
        floor: lv,
        buildingId: spec.id,
      });
    }
  }
}
