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
  monitor,
  officeChair,
  plant,
  sofaWide,
} from './props';
import { createCustomBoardScreen, type ScreenRegistry } from './screens';
import { getMaxAnisotropy, makeCanvasTex, rr } from './textures';

export interface VitalCareBuildContext {
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

interface VitalCarePalette {
  terrazzoSeafoam: THREE.MeshStandardMaterial;
  hinokiAsh: THREE.MeshStandardMaterial;
  hinokiRib: THREE.MeshStandardMaterial;
  seafoamCeramic: THREE.MeshStandardMaterial;
  surgicalSteel: THREE.MeshStandardMaterial;
  porcelainWhite: THREE.MeshStandardMaterial;
  sageFelt: THREE.MeshStandardMaterial;
  eucalyptusFabric: THREE.MeshStandardMaterial;
  linenLeather: THREE.MeshStandardMaterial;
  livingMoss: THREE.MeshStandardMaterial;
  frostedPrivacyGlass: THREE.MeshPhysicalMaterial;
  sterileGlass: THREE.MeshPhysicalMaterial;
  cryoFrostGlass: THREE.MeshPhysicalMaterial;
  circadianGlow: THREE.MeshBasicMaterial;
  seafoamHaloGlow: THREE.MeshBasicMaterial;
  mriBoreGlow: THREE.MeshBasicMaterial;
  amberApothecaryGlass: THREE.MeshStandardMaterial;
  tealBottleGlass: THREE.MeshStandardMaterial;
  bambooCane: THREE.MeshStandardMaterial;
  calmAcousticMat: THREE.MeshStandardMaterial;
}

let cachedPalette: VitalCarePalette | null = null;

function getVitalCarePalette(): VitalCarePalette {
  if (cachedPalette) return cachedPalette;

  const aniso = getMaxAnisotropy();

  // 1. Honed Ivory Terrazzo Floor with Seafoam & Sage Aggregate Chips + Steel Divider Strips
  const terrazzoTex = makeCanvasTex('vitalcare_terrazzo_seafoam', 512, 512, (g, W, H) => {
    g.fillStyle = '#f2f4ef';
    g.fillRect(0, 0, W, H);
    const chips = ['#8fc9bc', '#53a698', '#cbd5ce', '#d8cec0', '#2dd4bf', '#a3b8ae', '#e2ded5'];
    for (let i = 0; i < 480; i++) {
      const rx = ((Math.sin(i * 12.989 + 4.1) * 43758.5453) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 78.233 + 9.2) * 24634.6345) % 1 + 1) % 1;
      const rrSz = 2 + (i % 7);
      g.fillStyle = chips[i % chips.length];
      g.beginPath();
      const px = rx * W;
      const py = ry * H;
      g.moveTo(px - rrSz, py);
      g.lineTo(px + rrSz * 0.4, py - rrSz * 0.8);
      g.lineTo(px + rrSz, py + rrSz * 0.3);
      g.lineTo(px - rrSz * 0.2, py + rrSz * 0.9);
      g.closePath();
      g.fill();
    }
    // Fine brushed surgical-steel terrazzo control joints every 256px
    g.strokeStyle = 'rgba(148, 163, 184, 0.36)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);
    g.beginPath();
    g.moveTo(W * 0.5, 0);
    g.lineTo(W * 0.5, H);
    g.moveTo(0, H * 0.5);
    g.lineTo(W, H * 0.5);
    g.stroke();
  });
  terrazzoTex.colorSpace = THREE.SRGBColorSpace;
  terrazzoTex.wrapS = terrazzoTex.wrapT = THREE.RepeatWrapping;
  terrazzoTex.repeat.set(9.0, 3.5);
  terrazzoTex.anisotropy = aniso;

  // 2. Scandinavian Fluted Hinoki Cypress & White-Ash Slats
  const hinokiTex = makeCanvasTex('vitalcare_hinoki_ash', 512, 512, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#e8d7bc');
    grad.addColorStop(0.5, '#f0e2ca');
    grad.addColorStop(1, '#dfc8a6');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 24) {
      g.fillStyle = 'rgba(130, 98, 62, 0.14)';
      g.fillRect(x, 0, 5, H);
      g.fillStyle = 'rgba(255, 250, 240, 0.24)';
      g.fillRect(x + 5, 0, 6, H);
    }
    g.strokeStyle = 'rgba(166, 132, 92, 0.12)';
    g.lineWidth = 1.2;
    for (let y = 0; y < H; y += 18) {
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(W * 0.33, y + Math.sin(y) * 4, W * 0.66, y - Math.cos(y) * 4, W, y);
      g.stroke();
    }
  });
  hinokiTex.colorSpace = THREE.SRGBColorSpace;
  hinokiTex.wrapS = hinokiTex.wrapT = THREE.RepeatWrapping;
  hinokiTex.repeat.set(2.5, 1.5);
  hinokiTex.anisotropy = aniso;

  // 3. Glazed Seafoam-Mint Clinical Ceramic Micro-Tiles
  const ceramicTex = makeCanvasTex('vitalcare_seafoam_ceramic', 512, 512, (g, W, H) => {
    g.fillStyle = '#d3ede6';
    g.fillRect(0, 0, W, H);
    const cols = 8;
    const rows = 12;
    const cw = W / cols;
    const rh = H / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const shade = ((r * 13 + c * 29) % 16) - 8;
        g.fillStyle = `rgb(${202 + shade}, ${236 + shade}, ${228 + shade})`;
        g.fillRect(c * cw + 2, r * rh + 2, cw - 4, rh - 4);
        g.fillStyle = 'rgba(255,255,255,0.28)';
        g.fillRect(c * cw + 3, r * rh + 3, cw - 6, 4);
      }
    }
  });
  ceramicTex.colorSpace = THREE.SRGBColorSpace;
  ceramicTex.wrapS = ceramicTex.wrapT = THREE.RepeatWrapping;
  ceramicTex.repeat.set(3.5, 2.0);
  ceramicTex.anisotropy = aniso;

  // 4. Preserved Biophilic Botanical Moss & Fern Wall Texture
  const mossTex = makeCanvasTex('vitalcare_living_moss', 512, 512, (g, W, H) => {
    g.fillStyle = '#245943';
    g.fillRect(0, 0, W, H);
    const tones = ['#2e6f52', '#3c8462', '#1d4936', '#4a9972', '#52ad80', '#276148'];
    for (let i = 0; i < 650; i++) {
      const rx = ((Math.sin(i * 41.3 + 2.7) * 43758.54) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 93.1 + 6.4) * 21345.67) % 1 + 1) % 1;
      const rad = 5 + (i % 14);
      g.fillStyle = tones[i % tones.length];
      g.beginPath();
      g.arc(rx * W, ry * H, rad, 0, Math.PI * 2);
      g.fill();
    }
  });
  mossTex.colorSpace = THREE.SRGBColorSpace;
  mossTex.wrapS = mossTex.wrapT = THREE.RepeatWrapping;
  mossTex.repeat.set(2, 2);
  mossTex.anisotropy = aniso;

  // 5. Woven Eucalyptus Acoustic Textile / Calm Lounge Mat
  const eucalyptusTex = makeCanvasTex('vitalcare_eucalyptus_weave', 256, 256, (g, W, H) => {
    g.fillStyle = '#dcebe6';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(71, 128, 117, 0.14)';
    g.lineWidth = 1.5;
    for (let i = 0; i < W; i += 8) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, H);
      g.moveTo(0, i);
      g.lineTo(W, i);
      g.stroke();
    }
  });
  eucalyptusTex.colorSpace = THREE.SRGBColorSpace;
  eucalyptusTex.wrapS = eucalyptusTex.wrapT = THREE.RepeatWrapping;
  eucalyptusTex.repeat.set(4, 4);
  eucalyptusTex.anisotropy = aniso;

  cachedPalette = {
    terrazzoSeafoam: new THREE.MeshStandardMaterial({
      map: terrazzoTex,
      roughness: 0.28,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    hinokiAsh: new THREE.MeshStandardMaterial({
      map: hinokiTex,
      roughness: 0.54,
      metalness: 0.04,
    }),
    hinokiRib: new THREE.MeshStandardMaterial({
      color: 0xe3cfaf,
      roughness: 0.56,
      metalness: 0.03,
    }),
    seafoamCeramic: new THREE.MeshStandardMaterial({
      map: ceramicTex,
      roughness: 0.22,
      metalness: 0.08,
    }),
    surgicalSteel: new THREE.MeshStandardMaterial({
      color: 0xdce4ec,
      roughness: 0.22,
      metalness: 0.88,
      envMapIntensity: 0.85,
    }),
    porcelainWhite: new THREE.MeshStandardMaterial({
      color: 0xf7faf9,
      roughness: 0.28,
      metalness: 0.04,
    }),
    sageFelt: new THREE.MeshStandardMaterial({
      color: 0x5c8f83,
      roughness: 0.88,
      metalness: 0.02,
    }),
    eucalyptusFabric: new THREE.MeshStandardMaterial({
      color: 0x7cb5a7,
      roughness: 0.82,
      metalness: 0.02,
    }),
    linenLeather: new THREE.MeshStandardMaterial({
      color: 0xe7ebe7,
      roughness: 0.44,
      metalness: 0.04,
    }),
    livingMoss: new THREE.MeshStandardMaterial({
      map: mossTex,
      roughness: 0.94,
      metalness: 0.0,
    }),
    frostedPrivacyGlass: new THREE.MeshPhysicalMaterial({
      color: 0xdef5f0,
      roughness: 0.34,
      metalness: 0.04,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    sterileGlass: new THREE.MeshPhysicalMaterial({
      color: 0xd8f6f2,
      roughness: 0.06,
      metalness: 0.06,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    cryoFrostGlass: new THREE.MeshPhysicalMaterial({
      color: 0xcbeeff,
      roughness: 0.18,
      metalness: 0.08,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    circadianGlow: new THREE.MeshBasicMaterial({ color: 0xe6fffb, toneMapped: false }),
    seafoamHaloGlow: new THREE.MeshBasicMaterial({ color: 0x2dd4bf, toneMapped: false }),
    mriBoreGlow: new THREE.MeshBasicMaterial({ color: 0x5eead4, toneMapped: false }),
    amberApothecaryGlass: new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.25, metalness: 0.1 }),
    tealBottleGlass: new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.22, metalness: 0.1 }),
    bambooCane: new THREE.MeshStandardMaterial({ color: 0x8da667, roughness: 0.56, metalness: 0.02 }),
    calmAcousticMat: new THREE.MeshStandardMaterial({
      map: eucalyptusTex,
      roughness: 0.92,
      metalness: 0.01,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  };

  return cachedPalette;
}

let cachedClinicalPlateMat: THREE.MeshStandardMaterial | null = null;

function addClinicalSign(
  parent: THREE.Object3D,
  code: string,
  title: string,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  width = 2.0
) {
  const tex = makeCanvasTex(`vital_sign_${code}_${title}`, 520, 96, (g, w, h) => {
    g.fillStyle = '#f4faf8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0f766e';
    g.fillRect(0, 0, 120, h);
    // Clean medical cross glyph inside teal crest
    g.fillStyle = '#ffffff';
    g.fillRect(52, 22, 16, 52);
    g.fillRect(34, 40, 52, 16);
    g.fillStyle = '#99f6e4';
    g.font = '700 13px "IBM Plex Mono", monospace';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(code, 136, 31);
    g.fillStyle = '#0f172a';
    g.font = '700 22px sans-serif';
    g.fillText(title, 136, 63);
    g.strokeStyle = '#99f6e4';
    g.lineWidth = 3;
    g.strokeRect(2, 2, w - 4, h - 4);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = getMaxAnisotropy();

  const plateH = width * (96 / 520);
  if (!cachedClinicalPlateMat) {
    cachedClinicalPlateMat = new THREE.MeshStandardMaterial({ color: 0xdce4ec, roughness: 0.24, metalness: 0.86 });
  }
  boxAt(
    parent,
    width + 0.06,
    plateH + 0.05,
    0.04,
    x,
    y,
    z,
    cachedClinicalPlateMat,
    false,
    false
  );
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, plateH),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
  );
  const eps = 0.025;
  mesh.position.set(x + Math.sin(rotY) * eps, y, z + Math.cos(rotY) * eps);
  mesh.rotation.y = rotY;
  parent.add(mesh);
}

/**
 * Custom Nordic Hinoki-Ash & Surgical-Steel Clinical Examination Desk
 */
function addClinicalDesk(
  parent: THREE.Object3D,
  x: number,
  fy: number,
  z: number,
  w: number,
  d: number,
  pal: VitalCarePalette,
  rotY = 0
) {
  const g = new THREE.Group();
  g.position.set(x, fy, z);
  g.rotation.y = rotY;
  // Curved waterfall terrazzo-top + hinoki slatted modesty front
  boxAt(g, w, 0.06, d, 0, 0.74, 0, pal.porcelainWhite, true, true, 0.02);
  boxAt(g, w - 0.14, 0.02, d - 0.14, 0, 0.775, 0, pal.seafoamCeramic, false, true, 0.01);
  // Slatted hinoki ash pedestal returns
  [-w * 0.45, w * 0.45].forEach((lx) => {
    boxAt(g, 0.1, 0.72, d - 0.16, lx, 0.36, 0, pal.hinokiAsh, true, true, 0.015);
  });
  boxAt(g, w - 0.2, 0.58, 0.08, 0, 0.42, d * 0.38, pal.hinokiAsh, true, true, 0.01);
  // Subtle recessed seafoam cove strip beneath front overhang
  boxAt(g, w - 0.4, 0.024, 0.03, 0, 0.69, d * 0.46, pal.seafoamHaloGlow, false, false);
  // Dual surgical-steel foot rails
  cylAt(g, 0.018, 0.018, w - 0.32, 0, 0.12, -d * 0.3, pal.surgicalSteel, false, false, 8);
  parent.add(g);
}

/**
 * Custom Multi-Part 3T MRI Scanner Sculpture (11 sub-components)
 */
function buildMriScanner(
  parent: THREE.Object3D,
  x: number,
  fy: number,
  z: number,
  pal: VitalCarePalette,
  shadowTex: THREE.Texture,
  rotY = 0
) {
  const mri = new THREE.Group();
  mri.position.set(x, fy, z);
  mri.rotation.y = rotY;

  // 1. Anchored anti-vibration surgical steel base plinth
  boxAt(mri, 2.35, 0.16, 1.55, 0, 0.08, -0.45, pal.surgicalSteel, true, true, 0.03);
  // 2. Main MRI magnet chassis shroud (soft rounded porcelain housing)
  boxAt(mri, 2.25, 2.15, 1.38, 0, 1.24, -0.45, pal.porcelainWhite, true, true, 0.24);
  // 3. Sculpted inner chamfered magnet bore drum (Torus aperture)
  const boreRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.2, 16, 36), pal.porcelainWhite);
  boreRing.position.set(0, 1.28, 0.2);
  boreRing.castShadow = true;
  mri.add(boreRing);
  // 4. Deep cylindrical magnet bore tunnel interior
  const tunnel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.54, 0.54, 1.48, 28, 1, true),
    pal.surgicalSteel
  );
  tunnel.rotation.x = Math.PI / 2;
  tunnel.position.set(0, 1.28, -0.45);
  mri.add(tunnel);
  // 5. Circadian calming teal/aqua halo light ring inside MRI bore
  const glowHalo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 10, 32), pal.mriBoreGlow);
  glowHalo.position.set(0, 1.28, 0.25);
  mri.add(glowHalo);
  // 6. Top cryogenic helium vent stack rising cleanly toward ceiling
  cylAt(mri, 0.16, 0.18, 1.65, 0, 2.82, -0.55, pal.surgicalSteel, true, false, 16);
  cylAt(mri, 0.22, 0.22, 0.1, 0, 2.32, -0.55, pal.seafoamCeramic, false, false, 16);
  // 7. Motorized patient table docking pedestal + cantilevered carbon cradle extending forward
  boxAt(mri, 0.72, 0.72, 1.85, 0, 0.36, 1.15, pal.porcelainWhite, true, true, 0.06);
  boxAt(mri, 0.8, 0.08, 2.45, 0, 0.78, 0.95, pal.surgicalSteel, true, true, 0.02);
  boxAt(mri, 0.68, 0.08, 2.3, 0, 0.86, 0.92, pal.eucalyptusFabric, true, true, 0.025);
  // 8. Digital gantry status visor & emergency quench indicator strip
  boxAt(mri, 0.92, 0.24, 0.06, 0, 2.08, 0.24, pal.seafoamHaloGlow, false, false);
  // 9. Articulated RF contrast injector stand beside gantry
  cylAt(mri, 0.22, 0.24, 0.05, 1.38, 0.025, 0.75, pal.surgicalSteel, false, true, 12);
  cylAt(mri, 0.028, 0.028, 1.35, 1.38, 0.7, 0.75, pal.surgicalSteel, true, false, 8);
  boxAt(mri, 0.32, 0.22, 0.18, 1.38, 1.38, 0.75, pal.seafoamCeramic, false, false, 0.03);

  contact(mri, 0, 0.01, 0.25, 2.8, 4.2, 0.32, shadowTex);
  parent.add(mri);
}

/**
 * Custom Multi-Part 64-Slice Spiral CT Angiography Ring Scanner (8 sub-components)
 */
function buildCtScanner(
  parent: THREE.Object3D,
  x: number,
  fy: number,
  z: number,
  pal: VitalCarePalette,
  shadowTex: THREE.Texture,
  rotY = 0
) {
  const ct = new THREE.Group();
  ct.position.set(x, fy, z);
  ct.rotation.y = rotY;

  boxAt(ct, 2.05, 0.14, 0.95, 0, 0.07, -0.35, pal.surgicalSteel, true, true, 0.02);
  // Sleek slim-arch gantry chassis
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.26, 16, 36), pal.porcelainWhite);
  arch.position.set(0, 1.18, -0.35);
  arch.scale.set(1.08, 1.05, 1.15);
  arch.castShadow = true;
  ct.add(arch);
  boxAt(ct, 1.85, 0.72, 0.56, 0, 0.42, -0.35, pal.porcelainWhite, true, true, 0.08);
  const scanRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.03, 10, 32), pal.seafoamHaloGlow);
  scanRing.position.set(0, 1.18, -0.08);
  ct.add(scanRing);
  // Motorized CT table
  boxAt(ct, 0.62, 0.68, 1.72, 0, 0.34, 1.1, pal.porcelainWhite, true, true, 0.05);
  boxAt(ct, 0.66, 0.07, 2.2, 0, 0.74, 0.95, pal.surgicalSteel, true, true, 0.02);
  boxAt(ct, 0.56, 0.07, 2.08, 0, 0.81, 0.92, pal.linenLeather, false, true, 0.02);
  // Ceiling-suspended acrylic radiation shield + dual boom arm
  cylAt(ct, 0.03, 0.03, 0.95, -1.05, 3.05, 0.45, pal.surgicalSteel, false, false, 8);
  boxAt(ct, 0.74, 0.56, 0.04, -1.05, 2.35, 0.45, pal.sterileGlass, false, false);

  contact(ct, 0, 0.01, 0.35, 2.4, 3.8, 0.28, shadowTex);
  parent.add(ct);
}

/**
 * Custom 7-Part Articulated Dental Operatory Chair + Overhead Surgical LED Lamp
 */
function buildDentalOperatory(
  parent: THREE.Object3D,
  x: number,
  fy: number,
  z: number,
  pal: VitalCarePalette,
  shadowTex: THREE.Texture,
  rotY = 0
) {
  const op = new THREE.Group();
  op.position.set(x, fy, z);
  op.rotation.y = rotY;

  // Hydraulic contoured footplate & lift column
  boxAt(op, 0.68, 0.06, 1.08, 0, 0.03, -0.1, pal.surgicalSteel, true, true, 0.03);
  cylAt(op, 0.14, 0.17, 0.48, 0, 0.28, -0.22, pal.porcelainWhite, true, true, 14);
  // Articulated eucalyptus ergonomic dental couch (seat, angled backrest, leg rest, headrest)
  boxAt(op, 0.64, 0.12, 0.72, 0, 0.56, 0.05, pal.eucalyptusFabric, true, true, 0.04);
  const backRest = new THREE.Mesh(getRoundedBox(0.58, 0.11, 0.86, 0.04), pal.eucalyptusFabric);
  backRest.position.set(0, 0.78, -0.58);
  backRest.rotation.x = 0.42;
  backRest.castShadow = true;
  op.add(backRest);
  const legRest = new THREE.Mesh(getRoundedBox(0.56, 0.1, 0.64, 0.035), pal.eucalyptusFabric);
  legRest.position.set(0, 0.42, 0.62);
  legRest.rotation.x = -0.38;
  op.add(legRest);
  boxAt(op, 0.28, 0.09, 0.22, 0, 0.98, -0.98, pal.linenLeather, false, true, 0.03);
  // Porcelain spittoon pedestal + delivery unit arm on left
  cylAt(op, 0.12, 0.15, 0.84, -0.56, 0.42, -0.1, pal.porcelainWhite, true, true, 12);
  cylAt(op, 0.18, 0.08, 0.14, -0.56, 0.88, -0.1, pal.seafoamCeramic, false, true, 14);
  // Instrument tray swing arm on right
  cylAt(op, 0.022, 0.022, 1.45, 0.62, 0.74, -0.35, pal.surgicalSteel, false, false, 8);
  boxAt(op, 0.46, 0.04, 0.34, 0.52, 0.98, 0.18, pal.porcelainWhite, true, false, 0.015);
  // Overhead articulated boom & surgical shadowless LED ring head
  cylAt(op, 0.024, 0.024, 0.68, 0.42, 1.72, -0.25, pal.surgicalSteel, false, false, 8);
  const boomArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.78, 8), pal.surgicalSteel);
  boomArm.rotation.z = 1.05;
  boomArm.position.set(0.22, 1.98, -0.18);
  op.add(boomArm);
  boxAt(op, 0.34, 0.06, 0.24, 0, 1.88, -0.15, pal.porcelainWhite, true, false, 0.03);
  boxAt(op, 0.26, 0.02, 0.16, 0, 1.84, -0.15, pal.circadianGlow, false, false);

  contact(op, 0, 0.01, 0, 1.7, 2.2, 0.28, shadowTex);
  parent.add(op);
}

/**
 * Custom 6-Part IV Infusion Botanical Recliner Pod + Stainless Smart Pump Stand
 */
function buildIvInfusionPod(
  parent: THREE.Object3D,
  x: number,
  fy: number,
  z: number,
  pal: VitalCarePalette,
  shadowTex: THREE.Texture,
  rotY = Math.PI
) {
  const pod = new THREE.Group();
  pod.position.set(x, fy, z);
  pod.rotation.y = rotY;

  // Curved eucalyptus medical recliner with hinoki armrests & ottoman
  boxAt(pod, 0.86, 0.22, 0.92, 0, 0.32, 0, pal.eucalyptusFabric, true, true, 0.06);
  const back = new THREE.Mesh(getRoundedBox(0.84, 0.78, 0.22, 0.06), pal.eucalyptusFabric);
  back.position.set(0, 0.68, -0.38);
  back.rotation.x = -0.24;
  back.castShadow = true;
  pod.add(back);
  [-0.46, 0.46].forEach((ax) => {
    boxAt(pod, 0.12, 0.44, 0.78, ax, 0.46, -0.02, pal.hinokiAsh, true, true, 0.03);
  });
  boxAt(pod, 0.68, 0.16, 0.48, 0, 0.26, 0.74, pal.linenLeather, true, true, 0.04);
  // Stainless IV Pole & glowing smart infusion pump + backlit drip bag
  cylAt(pod, 0.18, 0.2, 0.04, 0.7, 0.02, -0.22, pal.surgicalSteel, false, true, 10);
  cylAt(pod, 0.018, 0.018, 1.92, 0.7, 0.96, -0.22, pal.surgicalSteel, true, false, 8);
  boxAt(pod, 0.18, 0.24, 0.14, 0.7, 1.18, -0.18, pal.porcelainWhite, false, false, 0.02);
  boxAt(pod, 0.12, 0.08, 0.02, 0.7, 1.22, -0.1, pal.seafoamHaloGlow, false, false);
  boxAt(pod, 0.12, 0.22, 0.05, 0.62, 1.72, -0.22, pal.sterileGlass, false, false);

  contact(pod, 0, 0.01, 0.15, 1.65, 1.95, 0.25, shadowTex);
  parent.add(pod);
}

/**
 * Custom 6-Part Liquid-Nitrogen Cryo-Biologics Dewar Tank (LN2 -196°C)
 */
function buildCryoDewarTank(
  parent: THREE.Object3D,
  x: number,
  fy: number,
  z: number,
  pal: VitalCarePalette,
  shadowTex: THREE.Texture
) {
  const t = new THREE.Group();
  t.position.set(x, fy, z);
  cylAt(t, 0.46, 0.48, 0.1, 0, 0.05, 0, pal.surgicalSteel, true, true, 20);
  cylAt(t, 0.42, 0.42, 1.25, 0, 0.72, 0, pal.surgicalSteel, true, true, 24);
  cylAt(t, 0.435, 0.435, 0.09, 0, 1.18, 0, pal.seafoamCeramic, false, false, 24);
  cylAt(t, 0.18, 0.26, 0.26, 0, 1.46, 0, pal.porcelainWhite, true, false, 18);
  boxAt(t, 0.24, 0.16, 0.08, 0, 1.38, 0.24, pal.seafoamHaloGlow, false, false, 0.01);
  // Frosted brass pressure relief wheel on top neck
  cylAt(t, 0.08, 0.08, 0.04, 0.14, 1.62, 0, pal.hinokiAsh, false, false, 10);
  contact(t, 0, 0.01, 0, 1.15, 1.15, 0.28, shadowTex);
  parent.add(t);
}

/**
 * Bespoke VitalCare Luminous Pill-Oval Barrisol Daylight Ceiling Rig + Hinoki Acoustic Baffles
 */
function buildVitalCareCeilingRig(
  cg: THREE.Group,
  cx: number,
  cz: number,
  ceilY: number,
  voidSkipEast: boolean,
  pal: VitalCarePalette
) {
  // Architectural hinoki acoustic slats along ceiling bays + glowing rounded-pill circadian diffusers
  const wingOffsets = voidSkipEast ? [-17.5, -9.2, 16.5] : [-17.5, -9.2, 16.5];
  wingOffsets.forEach((ox) => {
    const px = cx + ox;
    // Hinoki ash timber drop frame border
    boxAt(cg, 6.2, 0.08, 6.4, px, ceilY - 0.06, cz, pal.hinokiAsh, false, false, 0.02);
    // Recessed luminous circadian Barrisol soft-daylight diffuser panel
    boxAt(cg, 5.4, 0.04, 5.6, px, ceilY - 0.1, cz, pal.circadianGlow, false, false, 0.02);
    // Delicate seafoam architectural perimeter cove trim
    boxAt(cg, 5.55, 0.025, 0.06, px, ceilY - 0.12, cz - 2.82, pal.seafoamHaloGlow, false, false);
    boxAt(cg, 5.55, 0.025, 0.06, px, ceilY - 0.12, cz + 2.82, pal.seafoamHaloGlow, false, false);
  });
  // Transverse hinoki acoustic baffles running smoothly along main promenade corridor
  for (let bx = -22.2; bx <= 22.2; bx += 2.4) {
    if (bx >= 2.6 && bx <= 9.4) continue; // keep stair lightwell unobstructed
    boxAt(cg, 0.14, 0.12, 13.6, cx + bx, ceilY - 0.09, cz, pal.hinokiRib, false, false);
  }
}

export function buildVitalCareWholeBuilding(ctx: VitalCareBuildContext): void {
  const {
    spec,
    levelGroups,
    levelCeilings,
    M,
    frameDarkMat,
    accentMat,
    screenReg,
    registerChair,
    registerMonitor,
    pickMeshes,
    warmLights,
  } = ctx;

  const pal = getVitalCarePalette();
  const cx = spec.cx;
  const cz = spec.cz;
  const wallH = spec.floorH - 0.24;

  const fyOf = (lv: number) => spec.groundY + lv * spec.floorH + 0.12;

  const addSignage = (
    parent: THREE.Object3D,
    code: string,
    title: string,
    x: number,
    y: number,
    z: number,
    rotY = 0
  ) => addClinicalSign(parent, code, title, x, y, z, rotY);

  // ---------------------------------------------------------------------------
  // 1. ALL 5 FLOOR TERRAZZO SURFACES & LUMINOUS DAYLIGHT CEILINGS (G..L4)
  // ---------------------------------------------------------------------------
  for (let lv = 0; lv < spec.floors; lv++) {
    const lg = levelGroups[lv];
    const cg = levelCeilings[lv];
    const fy = fyOf(lv);
    const ceilY = spec.groundY + lv * spec.floorH + spec.floorH - 0.14;

    // Split honed ivory seafoam-chip terrazzo floor overlay neatly around stairwell void (dx +3.20..+8.80, dz -6.80..-0.60) on lv >= 1
    if (lv === 0) {
      const fMesh = new THREE.Mesh(new THREE.BoxGeometry(spec.w - 0.65, 0.018, spec.d - 0.65), pal.terrazzoSeafoam);
      fMesh.position.set(cx, fy + 0.009, cz);
      fMesh.receiveShadow = true;
      lg.add(fMesh);
      pickMeshes.push(fMesh);
    } else {
      // West zone (dx -23.65 .. +3.20 -> w 26.85)
      const fWest = new THREE.Mesh(new THREE.BoxGeometry(26.85, 0.018, spec.d - 0.65), pal.terrazzoSeafoam);
      fWest.position.set(cx - 10.225, fy + 0.009, cz);
      fWest.receiveShadow = true;
      lg.add(fWest);
      // East zone (dx +8.80 .. +23.65 -> w 14.85)
      const fEast = new THREE.Mesh(new THREE.BoxGeometry(14.85, 0.018, spec.d - 0.65), pal.terrazzoSeafoam);
      fEast.position.set(cx + 16.225, fy + 0.009, cz);
      fEast.receiveShadow = true;
      lg.add(fEast);
      // South Promenade Bridge past stairwell void (dx +3.20 .. +8.80, dz -0.60 .. +7.67 -> w 5.60, d 8.27)
      const fSouth = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.018, 8.27), pal.terrazzoSeafoam);
      fSouth.position.set(cx + 6.0, fy + 0.009, cz + 3.535);
      fSouth.receiveShadow = true;
      lg.add(fSouth);
      // North thin rim (dx +3.20 .. +8.80, dz -7.67 .. -6.80 -> w 5.60, d 0.87)
      const fNorth = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.018, 0.87), pal.terrazzoSeafoam);
      fNorth.position.set(cx + 6.0, fy + 0.009, cz - 7.235);
      fNorth.receiveShadow = true;
      lg.add(fNorth);
      pickMeshes.push(fWest, fEast, fSouth, fNorth);
    }

    // Calming daylight interior fill anchors on every level (evaluated via 4-light pool)
    [-14.5, 0, 15.5].forEach((lx) => {
      warmLights.push({
        x: cx + lx,
        y: fy + 3.25,
        z: cz,
        color: 0xdffaf4,
        distance: 22,
        baseScale: lv === 0 ? 0.88 : 0.96,
        floor: lv,
        buildingId: spec.id,
      });
    });

    buildVitalCareCeilingRig(cg, cx, cz, ceilY, true, pal);
  }

  // ---------------------------------------------------------------------------
  // 2. SIGNATURE 5-STORY C-WRAP BIOPHILIC ATRIUM STAIRCASE & LIVING BAMBOO WELL
  //    Void: dx +3.20 .. +8.80 (5.60m wide), dz -6.80 .. -0.60 (6.20m deep)
  //    Central Living Moss & Bamboo Lightwell Core: dx +4.85..+7.15, dz -5.15..-2.25
  // ---------------------------------------------------------------------------
  const addBalustrade = (
    parent: THREE.Object3D,
    x: number,
    z: number,
    w: number,
    d: number,
    fy: number,
    h = 1.04
  ) => {
    boxAt(parent, w, 0.12, d, x, fy + 0.06, z, pal.surgicalSteel, true, true, 0.01);
    boxAt(parent, Math.max(0.03, w - 0.02), h - 0.18, Math.max(0.03, d - 0.02), x, fy + 0.12 + (h - 0.18) * 0.5, z, pal.sterileGlass, false, false);
    boxAt(parent, w + 0.04, 0.06, d + 0.04, x, fy + h, z, pal.hinokiAsh, true, false, 0.015);
  };

  const addSlopedHandrail = (
    parent: THREE.Object3D,
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number
  ) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dy, dz);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, len, 10), pal.hinokiAsh);
    rail.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5 + 0.94, (z0 + z1) * 0.5);
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    rail.quaternion.setFromUnitVectors(up, dir);
    rail.castShadow = true;
    parent.add(rail);
  };

  for (let lv = 0; lv < spec.floors; lv++) {
    const lgS = levelGroups[lv];
    const fy = fyOf(lv);

    // 2A. Central 5-Story Living Botanical Sky-Well Shaft (dx +4.85..+7.15, dz -5.15..-2.25)
    //     Preserved green moss cladding, glowing seafoam circadian halo band, tall indoor bamboo canes
    const coreW = 2.26;
    const coreD = 2.86;
    const coreX = cx + 6.0;
    const coreZ = cz - 3.7;
    if (lv === 0) {
      // Sculpted porcelain planter plinth on Ground floor
      boxAt(lgS, coreW + 0.14, 0.56, coreD + 0.14, coreX, fy + 0.28, coreZ, pal.porcelainWhite, true, true, 0.06);
      boxAt(lgS, coreW - 0.05, 0.14, coreD - 0.05, coreX, fy + 0.58, coreZ, pal.livingMoss, false, true);
    }
    // Illuminated vertical botanical core column rising cleanly per floor (inner architectural spine)
    boxAt(lgS, 0.96, wallH + 0.22, 1.38, coreX, fy + (wallH + 0.22) * 0.5, coreZ, pal.livingMoss, true, true, 0.04);
    // Vertical hinoki fins & seafoam halo ring around botanical spine at ceiling level
    [-0.4, 0.4].forEach((fz) => {
      boxAt(lgS, 1.04, wallH + 0.22, 0.08, coreX, fy + (wallH + 0.22) * 0.5, coreZ + fz, pal.hinokiAsh, false, false);
    });
    boxAt(lgS, 2.38, 0.08, 2.98, coreX, fy + spec.floorH - 0.12, coreZ, pal.surgicalSteel, false, false);
    boxAt(lgS, 2.42, 0.035, 3.02, coreX, fy + spec.floorH - 0.16, coreZ, pal.seafoamHaloGlow, false, false);

    // Tall bamboo stalks climbing along perimeter inside the atrium well on every floor
    [
      [-0.78, -0.98],
      [0.78, -0.98],
      [-0.78, 0.98],
      [0.78, 0.98],
      [-0.86, 0.0],
      [0.86, 0.0],
    ].forEach(([bx, bz], bi) => {
      const stalkH = spec.floorH - 0.22;
      cylAt(lgS, 0.036, 0.044, stalkH, coreX + bx, fy + stalkH * 0.5 + 0.12, coreZ + bz, pal.bambooCane, true, false, 8);
      if (lv === 0 || bi % 2 === 0) {
        plant(lgS, coreX + bx * 0.85, fy + (lv === 0 ? 0.55 : 0.02), coreZ + bz * 0.85, 0.95, 310 + lv * 13 + bi, M, 'fern');
      }
    });

    // 2B. Void Edge Framing & Glass Safety Balustrades
    // North edge (dz = -6.80), East edge (dx = +8.80), South edge (dz = -0.60)
    addBalustrade(lgS, cx + 6.0, cz - 6.8, 5.6, 0.06, fy);
    addBalustrade(lgS, cx + 8.8, cz - 3.7, 0.06, 6.2, fy);
    addBalustrade(lgS, cx + 6.0, cz - 0.6, 5.6, 0.06, fy);

    // West Rim (dx = +3.20): Center moss & glass guardrail always closed (dz -5.15..-2.25)
    addBalustrade(lgS, cx + 3.2, cz - 3.7, 0.06, 2.9, fy);

    if (lv === 0) {
      // Ground floor: under-stair moss privacy screen beneath Flight 3 (dz -6.80..-5.15)
      boxAt(lgS, 0.12, 2.2, 1.65, cx + 3.2, fy + 1.1, cz - 5.975, pal.hinokiAsh, true, true);
      boxAt(lgS, 1.56, 1.5, 0.08, cx + 4.02, fy + 0.75, cz - 5.15, pal.frostedPrivacyGlass, false, false);
      // SW Entry Wayfinding Totem & Sign (dx +3.20, dz -2.25..-0.60 open!)
      addSignage(lgS, 'ATRIUM STAIRS', 'L1 MRI · L2 DENTAL · L3 LAB · L4 SKY', cx + 3.08, fy + 2.45, cz - 3.7, -Math.PI / 2);
    } else if (lv < spec.floors - 1) {
      // Intermediate floors (L1..L3): Both NW Arrival (dz -6.80..-5.15) AND SW Ascent (dz -2.25..-0.60) remain open!
      addSignage(lgS, `LEVEL ${lv}`, 'CONTINUOUS WELLNESS PROMENADE', cx + 3.08, fy + 2.45, cz - 3.7, -Math.PI / 2);
    } else {
      // Top floor (L4): NW Arrival open for descent L4->L3; SW edge closed safely with glass balustrade!
      addBalustrade(lgS, cx + 3.2, cz - 1.425, 0.06, 1.65, fy);
      addSignage(lgS, 'LEVEL 4 · SKY', 'DESCEND TO L3 LABS & CLINICS', cx + 3.08, fy + 2.45, cz - 3.7, -Math.PI / 2);
    }

    // 2C. Continuous 3-Flight Floating Terrazzo & Surgical-Steel C-Wrap Staircase (lv -> lv + 1)
    if (lv < spec.floors - 1) {
      const fRise = spec.floorH / 3; // 1.40m per flight
      const yMid1 = fy + fRise;
      const yMid2 = fy + fRise * 2;
      const yTop = fy + spec.floorH;

      // Twin cantilevered surgical-steel carriage beams beneath each run
      const flight1Steps = 6;
      const dx1 = 3.95; // cx+3.20 -> cx+7.15
      for (let s = 0; s < flight1Steps; s++) {
        const tx = cx + 3.2 + ((s + 0.5) / flight1Steps) * dx1;
        const ty = fy + ((s + 0.5) / flight1Steps) * fRise;
        boxAt(lgS, dx1 / flight1Steps - 0.04, 0.09, 1.56, tx, ty, cz - 1.425, pal.porcelainWhite, true, true, 0.018);
        boxAt(lgS, dx1 / flight1Steps - 0.08, 0.03, 1.52, tx, ty + 0.055, cz - 1.425, pal.hinokiAsh, false, true, 0.01);
      }
      addSlopedHandrail(lgS, cx + 3.2, fy, cz - 2.2, cx + 7.15, yMid1, cz - 2.2);
      addSlopedHandrail(lgS, cx + 3.2, fy, cz - 0.65, cx + 7.15, yMid1, cz - 0.65);

      // SE Half-Landing (dx +7.15..+8.80, dz -2.25..-0.60, elev yMid1)
      boxAt(lgS, 1.65, 0.14, 1.65, cx + 7.975, yMid1 - 0.04, cz - 1.425, pal.surgicalSteel, true, true, 0.02);
      boxAt(lgS, 1.58, 0.04, 1.58, cx + 7.975, yMid1 + 0.03, cz - 1.425, pal.porcelainWhite, false, true, 0.01);

      // Flight 2: East Run climbing South -> North (dz -2.25 -> -5.15, len = 2.90m)
      const flight2Steps = 6;
      const dz2 = 2.9;
      for (let s = 0; s < flight2Steps; s++) {
        const tz = cz - 2.25 - ((s + 0.5) / flight2Steps) * dz2;
        const ty = yMid1 + ((s + 0.5) / flight2Steps) * fRise;
        boxAt(lgS, 1.56, 0.09, dz2 / flight2Steps - 0.04, cx + 7.975, ty, tz, pal.porcelainWhite, true, true, 0.018);
        boxAt(lgS, 1.52, 0.03, dz2 / flight2Steps - 0.08, cx + 7.975, ty + 0.055, tz, pal.hinokiAsh, false, true, 0.01);
      }
      addSlopedHandrail(lgS, cx + 7.2, yMid1, cz - 2.25, cx + 7.2, yMid2, cz - 5.15);
      addSlopedHandrail(lgS, cx + 8.74, yMid1, cz - 2.25, cx + 8.74, yMid2, cz - 5.15);

      // NE Half-Landing (dx +7.15..+8.80, dz -6.80..-5.15, elev yMid2)
      boxAt(lgS, 1.65, 0.14, 1.65, cx + 7.975, yMid2 - 0.04, cz - 5.975, pal.surgicalSteel, true, true, 0.02);
      boxAt(lgS, 1.58, 0.04, 1.58, cx + 7.975, yMid2 + 0.03, cz - 5.975, pal.porcelainWhite, false, true, 0.01);

      // Flight 3: North Run climbing East -> West (dx +7.15 -> +3.20, len = 3.95m)
      const flight3Steps = 6;
      for (let s = 0; s < flight3Steps; s++) {
        const tx = cx + 7.15 - ((s + 0.5) / flight3Steps) * dx1;
        const ty = yMid2 + ((s + 0.5) / flight3Steps) * fRise;
        boxAt(lgS, dx1 / flight3Steps - 0.04, 0.09, 1.56, tx, ty, cz - 5.975, pal.porcelainWhite, true, true, 0.018);
        boxAt(lgS, dx1 / flight3Steps - 0.08, 0.03, 1.52, tx, ty + 0.055, cz - 5.975, pal.hinokiAsh, false, true, 0.01);
      }
      addSlopedHandrail(lgS, cx + 7.15, yMid2, cz - 6.74, cx + 3.2, yTop, cz - 6.74);
      addSlopedHandrail(lgS, cx + 7.15, yMid2, cz - 5.2, cx + 3.2, yTop, cz - 5.2);

      // Inner botanical well guardrails on landings
      boxAt(lgS, 0.05, 0.96, 2.9, cx + 7.15, yMid1 + 0.48, cz - 3.7, pal.sterileGlass, false, false);
      boxAt(lgS, 2.3, 0.96, 0.05, cx + 6.0, fy + 1.15, cz - 2.25, pal.sterileGlass, false, false);
    }
  }

  // ===========================================================================
  // GROUND FLOOR (lv = 0): 24H BOTANICAL APOTHECARY, TRIAGE & CONSULT SUITES
  // ===========================================================================
  const g0 = levelGroups[0];
  const fy0 = fyOf(0);

  // Sculpted Exterior Welcome Totem beside South Entrance (outside doorway path)
  addSignage(g0, 'VITALCARE 24H', 'DIAGNOSTICS · APOTHECARY · WELLNESS', spec.doorX + 3.6, fy0 + 2.55, spec.doorZ + 0.2, 0);

  // --- ZONE 0A: Central Bi-Level Patient Triage Pavilion & Live ECG Telemetry Wall ---
  boxAt(g0, 4.6, 1.04, 0.5, cx, fy0 + 0.52, cz - 0.9, pal.porcelainWhite, true, true, 0.04);
  boxAt(g0, 4.72, 0.06, 0.58, cx, fy0 + 1.06, cz - 0.9, pal.seafoamCeramic, false, false, 0.02);
  boxAt(g0, 4.5, 0.025, 0.04, cx, fy0 + 0.14, cz - 0.63, pal.seafoamHaloGlow, false, false);
  boxAt(g0, 4.6, 0.06, 0.88, cx, fy0 + 0.75, cz - 1.59, pal.hinokiAsh, true, true, 0.02);
  [-2.15, 2.15].forEach((lx) => {
    boxAt(g0, 0.14, 0.72, 0.76, cx + lx, fy0 + 0.36, cz - 1.54, pal.porcelainWhite, true, true, 0.01);
  });
  registerChair(0, cx, fy0, cz - 2.3, 0, 1);
  registerMonitor(
    0,
    0,
    [cx, fy0 + 0.78, cz - 1.58],
    Math.PI,
    cx,
    cz - 2.3,
    'Lead Pharmacist & Triage',
    '24h Pharmacy & Patient Intake'
  );

  // Live ECG & Cold-Chain Telemetry Screen on North Central Wall (flanked by hinoki & living moss fins)
  const medBoard = createCustomBoardScreen(screenReg, 680, 220, (g, w, h, t) => {
    g.fillStyle = '#061a19';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2dd4bf';
    g.fillRect(0, 0, w, 34);
    g.fillStyle = '#061a19';
    g.font = '800 17px sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('VITALCARE MEDICAL · 24H TRIAGE, MRI & COLD-CHAIN TELEMETRY', 16, 17);
    g.strokeStyle = '#4ade80';
    g.lineWidth = 3;
    g.beginPath();
    for (let px = 20; px < 360; px += 4) {
      const ph = ((px + t * 80) % 90) / 90;
      const ecg = ph > 0.42 && ph < 0.48 ? -26 : ph >= 0.48 && ph < 0.54 ? 18 : 0;
      const py = 108 + ecg;
      if (px === 20) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    const stats = [
      ['Cold Chain LN2', '4.1 °C OK'],
      ['3T MRI · L1', 'ACTIVE · 18m'],
      ['Triage Wait', '4 min'],
    ];
    stats.forEach((st, i) => {
      const y = 56 + i * 50;
      g.fillStyle = 'rgba(45,212,191,0.14)';
      rr(g, 390, y, 270, 42, 6);
      g.fill();
      g.fillStyle = '#99f6e4';
      g.font = '600 15px sans-serif';
      g.fillText(st[0], 404, y + 21);
      g.fillStyle = '#ffffff';
      g.textAlign = 'right';
      g.font = '700 16px monospace';
      g.fillText(st[1], 646, y + 21);
      g.textAlign = 'left';
    });
  });
  boxAt(g0, 6.2, 2.15, 0.14, cx - 0.3, fy0 + 2.35, cz - 7.66, frameDarkMat, false, false);
  const medMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 1.92), medBoard.mat);
  medMesh.position.set(cx - 0.3, fy0 + 2.35, cz - 7.57);
  g0.add(medMesh);
  medBoard.setMesh(medMesh);
  [-3.85, 2.95].forEach((mx) => {
    boxAt(g0, 0.52, 3.25, 0.12, cx + mx, fy0 + 1.62, cz - 7.64, pal.livingMoss, false, true);
  });

  // Flanking South Lobby Eucalyptus Waiting Armchairs & Terrazzo Tea Tables
  [-6.5, 6.5].forEach((ox, idx) => {
    armchair(g0, cx + ox, fy0, cz + 3.2, Math.PI, pal.eucalyptusFabric, M);
    cylAt(g0, 0.36, 0.32, 0.44, cx + ox + (idx === 0 ? -1.15 : 1.15), fy0 + 0.22, cz + 3.2, pal.porcelainWhite, true, true, 16);
    plant(g0, cx + ox + (idx === 0 ? -1.15 : 1.15), fy0 + 0.44, cz + 3.2, 0.45, 512 + idx, M, 'fern');
  });
  boxAt(g0, 6.4, 0.015, 3.6, cx, fy0 + 0.016, cz + 3.2, pal.calmAcousticMat, false, true);

  // --- ZONE 0B: West Wing 24h Botanical Apothecary Dispensary & Phlebotomy Pod ---
  // Sculpted Fluted Hinoki & Porcelain Pharmacy Counter (dx -14.5, dz -2.2, 10.2m span)
  boxAt(g0, 10.2, 1.06, 1.15, cx - 14.5, fy0 + 0.53, cz - 2.2, pal.porcelainWhite, true, true, 0.03);
  boxAt(g0, 10.4, 0.08, 1.28, cx - 14.5, fy0 + 1.08, cz - 2.2, pal.seafoamCeramic, false, false);
  boxAt(g0, 10.0, 0.54, 0.06, cx - 14.5, fy0 + 0.46, cz - 1.59, pal.hinokiAsh, false, false);
  boxAt(g0, 10.0, 0.025, 0.04, cx - 14.5, fy0 + 0.14, cz - 1.58, pal.seafoamHaloGlow, false, false);
  // Frosted pharmacy consultation glass dividers along counter top
  [-17.8, -14.5, -11.2].forEach((gx) => {
    boxAt(g0, 2.2, 0.66, 0.035, cx + gx, fy0 + 1.44, cz - 1.9, pal.frostedPrivacyGlass, false, false);
  });
  // Backlit Seafoam Apothecary Medicine Racks (dx -14.5, dz -7.1)
  boxAt(g0, 10.4, 2.65, 0.45, cx - 14.5, fy0 + 1.325, cz - 7.1, pal.porcelainWhite, true, true, 0.03);
  boxAt(g0, 10.1, 2.45, 0.04, cx - 14.5, fy0 + 1.35, cz - 6.86, pal.seafoamCeramic, false, false);
  for (let r = 0; r < 3; r++) {
    boxAt(g0, 9.8, 0.04, 0.32, cx - 14.5, fy0 + 0.52 + r * 0.64, cz - 6.8, pal.hinokiAsh, false, false);
    for (let b = 0; b < 12; b++) {
      const mat = b % 3 === 0 ? pal.tealBottleGlass : b % 3 === 1 ? pal.amberApothecaryGlass : pal.porcelainWhite;
      cylAt(g0, 0.09, 0.09, 0.26, cx - 18.8 + b * 0.78, fy0 + 0.67 + r * 0.64, cz - 6.8, mat, false, false, 10);
    }
  }
  addSignage(g0, 'PHARMACY · 24H', 'BOTANICAL APOTHECARY & RX', cx - 14.5, fy0 + 2.95, cz - 7.25, 0);

  // 2-8°C Glass-Front Vaccine Cold-Chain Unit (dx -21.4, dz -6.8)
  boxAt(g0, 1.7, 2.35, 0.92, cx - 21.4, fy0 + 1.175, cz - 6.85, pal.surgicalSteel, true, true, 0.03);
  boxAt(g0, 1.44, 1.72, 0.04, cx - 21.4, fy0 + 1.28, cz - 6.37, pal.cryoFrostGlass, false, false);
  boxAt(g0, 1.2, 0.16, 0.04, cx - 21.4, fy0 + 2.22, cz - 6.37, pal.seafoamHaloGlow, false, false);

  // Automated Smart Rx Pickup Kiosk (dx -6.2, dz -6.9)
  boxAt(g0, 1.65, 2.15, 0.68, cx - 6.2, fy0 + 1.075, cz - 6.95, pal.porcelainWhite, true, true, 0.04);
  boxAt(g0, 0.9, 0.65, 0.04, cx - 6.2, fy0 + 1.48, cz - 6.59, pal.seafoamHaloGlow, false, false);
  boxAt(g0, 0.56, 0.28, 0.18, cx - 6.2, fy0 + 0.78, cz - 6.62, frameDarkMat, false, false);

  // Rapid Phlebotomy & Donor Alcove (dx -20.8, dz +3.6)
  boxAt(g0, 0.12, 2.25, 3.6, cx - 18.2, fy0 + 1.125, cz + 3.6, pal.frostedPrivacyGlass, false, false);
  boxAt(g0, 0.14, 2.3, 0.14, cx - 18.2, fy0 + 1.15, cz + 1.82, pal.hinokiAsh, true, false);
  boxAt(g0, 0.14, 2.3, 0.14, cx - 18.2, fy0 + 1.15, cz + 5.38, pal.hinokiAsh, true, false);
  buildIvInfusionPod(g0, cx - 21.0, fy0, cz + 3.6, pal, M.textures.shadowTex, Math.PI / 2);
  addSignage(g0, 'LAB DRAW', 'RAPID PHLEBOTOMY', cx - 21.0, fy0 + 2.45, cz + 7.5, Math.PI);

  // --- ZONE 0C: East Wing Diagnostic Consult Suites & Self-Check Vitals Kiosk ---
  // Acoustic frosted partition dividing Consult 1 (+13.2) and Consult 2 (+19.5)
  boxAt(g0, 0.12, 2.35, 4.4, cx + 16.35, fy0 + 1.175, cz - 4.4, pal.frostedPrivacyGlass, false, false);
  [cz - 6.55, cz - 2.25].forEach((pz) => {
    boxAt(g0, 0.14, 2.4, 0.14, cx + 16.35, fy0 + 1.2, pz, pal.hinokiAsh, true, false);
  });

  [cx + 13.2, cx + 19.5].forEach((dx, i) => {
    const dz = cz - 2.6;
    addClinicalDesk(g0, dx, fy0, dz, 2.4, 1.05, pal, 0);
    registerChair(0, dx, fy0, dz - 0.88, 0, i === 0 ? 1 : -1);
    registerMonitor(
      0,
      i + 1,
      [dx, fy0 + 0.77, dz + 0.15],
      Math.PI,
      dx,
      dz - 0.88,
      i === 0 ? 'Attending Physician' : 'Clinical Lab Specialist',
      'Outpatient & Diagnostic Suites'
    );
    // Clean outpatient exam plinth against north wall (dz - 6.2)
    boxAt(g0, 1.95, 0.48, 0.82, dx, fy0 + 0.24, cz - 6.45, pal.porcelainWhite, true, true, 0.04);
    boxAt(g0, 1.88, 0.12, 0.76, dx, fy0 + 0.54, cz - 6.45, pal.eucalyptusFabric, true, true, 0.04);
    addSignage(g0, `SUITE 0${i + 1}`, i === 0 ? 'OUTPATIENT CONSULT' : 'CLINICAL DIAGNOSTICS', dx, fy0 + 2.55, cz - 7.55, 0);
  });

  // Self-Check Blood Pressure & BMI Vitals Station (dx +16.4, dz +4.5)
  boxAt(g0, 2.6, 0.14, 1.6, cx + 16.4, fy0 + 0.07, cz + 4.5, pal.hinokiAsh, true, true, 0.03);
  boxAt(g0, 0.85, 1.55, 0.46, cx + 16.4, fy0 + 0.84, cz + 5.0, pal.porcelainWhite, true, true, 0.04);
  boxAt(g0, 0.56, 0.36, 0.04, cx + 16.4, fy0 + 1.24, cz + 4.76, pal.seafoamHaloGlow, false, false);
  cylAt(g0, 0.24, 0.24, 0.48, cx + 16.4, fy0 + 0.32, cz + 4.05, pal.eucalyptusFabric, true, true, 14);
  plant(g0, cx + 21.8, fy0, cz + 5.8, 1.35, 514, M, 'olive');
  plant(g0, cx - 22.0, fy0, cz + 6.0, 1.25, 515, M, 'ficus');

  // ===========================================================================
  // LEVEL 1 (lv = 1): DIAGNOSTIC IMAGING SANCTUARY (3T MRI, 64-SLICE CT, ECHO)
  // ===========================================================================
  const g1 = levelGroups[1];
  const fy1 = fyOf(1);
  let l1MonIdx = 10;

  // --- ZONE 1A: West Glazed Shielded 3T MRI Cleanroom (dx -23.4 .. -11.8) ---
  // North-West observation partition with wide clear glass window facing Radiology Control Desk
  boxAt(g1, 0.14, 0.92, 9.8, cx - 11.8, fy1 + 0.46, cz - 2.6, pal.porcelainWhite, true, true);
  boxAt(g1, 0.06, 2.1, 9.8, cx - 11.8, fy1 + 1.98, cz - 2.6, pal.sterileGlass, false, false);
  boxAt(g1, 0.16, 0.16, 9.8, cx - 11.8, fy1 + 3.1, cz - 2.6, pal.hinokiAsh, false, false);
  // Open entry portal on South side (dz +2.3 .. +4.8 open!) + short return screen
  boxAt(g1, 0.14, wallH * 0.72, 2.4, cx - 11.8, fy1 + wallH * 0.36, cz + 6.1, pal.frostedPrivacyGlass, false, false);
  // Hero 11-Part 3T MRI Scanner centered inside shielded bay
  buildMriScanner(g1, cx - 17.8, fy1, cz - 2.2, pal, M.textures.shadowTex, 0.32);
  addSignage(g1, 'MRI · 3.0T', 'MAGNETIC RESONANCE BAY', cx - 17.8, fy1 + 2.75, cz - 7.55, 0);
  // Linen gowning & sterile prep cabinet on West wall
  boxAt(g1, 0.65, 2.15, 3.2, cx - 23.25, fy1 + 1.075, cz - 2.2, pal.hinokiAsh, true, true, 0.02);

  // --- ZONE 1B: Radiology Control Desk & Animated DICOM Scan Wall (dx -11.0 .. -2.5) ---
  addClinicalDesk(g1, cx - 7.8, fy1, cz - 2.2, 2.8, 1.05, pal, Math.PI);
  registerChair(1, cx - 7.8, fy1, cz - 1.32, Math.PI, 1);
  registerMonitor(
    1,
    l1MonIdx++,
    [cx - 7.8, fy1 + 0.78, cz - 2.35],
    0,
    cx - 7.8,
    cz - 1.32,
    'Lead MRI Technologist · L1',
    '3T MRI Control Bay'
  );

  // Live Animated DICOM MRI Reconstruction Wall Display (dx -6.4, dz -7.52)
  const dicomBoard = createCustomBoardScreen(screenReg, 640, 260, (g, w, h, t) => {
    g.fillStyle = '#041214';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#14b8a6';
    g.fillRect(0, 0, w, 34);
    g.fillStyle = '#041214';
    g.font = '800 16px sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('VITALCARE RADIOLOGY · 3T MRI & 64-SLICE CT RECONSTRUCTION', 14, 17);
    // Animated Axial MRI Brain Slice Scan
    const cxImg = 135;
    const cyImg = 150;
    g.strokeStyle = '#2dd4bf';
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(cxImg, cyImg, 68, 84, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(94, 234, 212, 0.45)';
    for (let r = 18; r <= 60; r += 14) {
      g.beginPath();
      g.ellipse(cxImg, cyImg, r * 0.85, r, 0, 0, Math.PI * 2);
      g.stroke();
    }
    const scanY = 66 + ((t * 48) % 168);
    g.strokeStyle = '#5eead4';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(55, scanY);
    g.lineTo(215, scanY);
    g.stroke();
    const metrics = [
      ['3T Field Strength', '2.999 T LOCK'],
      ['Cryogen Shield', '4.1 K NOMINAL'],
      ['CT Angio Queue', 'SCAN COMPLETE'],
      ['AI Triage Flag', 'CLEAR · 0 ALERT'],
    ];
    metrics.forEach((m, i) => {
      const y = 54 + i * 48;
      g.fillStyle = 'rgba(45, 212, 191, 0.12)';
      rr(g, 265, y, 355, 38, 6);
      g.fill();
      g.fillStyle = '#99f6e4';
      g.font = '600 14px sans-serif';
      g.fillText(m[0], 278, y + 19);
      g.fillStyle = '#ffffff';
      g.textAlign = 'right';
      g.font = '700 15px monospace';
      g.fillText(m[1], 605, y + 19);
      g.textAlign = 'left';
    });
  });
  boxAt(g1, 5.2, 2.2, 0.14, cx - 6.4, fy1 + 2.32, cz - 7.64, frameDarkMat, false, false);
  const dicomMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.95, 1.98), dicomBoard.mat);
  dicomMesh.position.set(cx - 6.4, fy1 + 2.32, cz - 7.55);
  g1.add(dicomMesh);
  dicomBoard.setMesh(dicomMesh);

  // Calm Radiology Patient Preparation Lounge (dx -6.4, dz +4.6)
  boxAt(g1, 5.6, 0.015, 3.4, cx - 6.4, fy1 + 0.016, cz + 4.6, pal.calmAcousticMat, false, true);
  sofaWide(g1, cx - 6.4, fy1, cz + 5.6, Math.PI, pal.sageFelt, M);
  boxAt(g1, 1.45, 0.38, 0.85, cx - 6.4, fy1 + 0.19, cz + 3.9, pal.hinokiAsh, true, true, 0.03);
  plant(g1, cx - 9.8, fy1, cz + 5.8, 1.15, 521, M, 'fern');

  // --- ZONE 1C: East Wing 64-Slice CT Angiography & 4D Ultrasound Pod ---
  buildCtScanner(g1, cx + 19.6, fy1, cz - 2.2, pal, M.textures.shadowTex, -0.22);
  addSignage(g1, 'CT · 64-SLICE', 'SPIRAL ANGIOGRAPHY SUITE', cx + 19.6, fy1 + 2.75, cz - 7.55, 0);

  // Radiologist Workstation (dx +13.0, dz -3.4)
  addClinicalDesk(g1, cx + 13.0, fy1, cz - 3.4, 2.5, 1.05, pal, 0);
  registerChair(1, cx + 13.0, fy1, cz - 4.28, 0, -1);
  registerMonitor(
    1,
    l1MonIdx++,
    [cx + 13.0, fy1 + 0.78, cz - 3.25],
    Math.PI,
    cx + 13.0,
    cz - 4.28,
    'Diagnostic Radiologist · L1',
    'CT & Ultrasound Reporting'
  );

  // 4D Ultrasound & Echo Bay (dx +13.2, dz +4.0)
  boxAt(g1, 1.95, 0.46, 0.82, cx + 13.2, fy1 + 0.23, cz + 4.4, pal.porcelainWhite, true, true, 0.04);
  boxAt(g1, 1.88, 0.12, 0.76, cx + 13.2, fy1 + 0.52, cz + 4.4, pal.eucalyptusFabric, true, true, 0.04);
  // Multi-part Ultrasound Cart beside exam bed
  boxAt(g1, 0.58, 0.86, 0.54, cx + 11.4, fy1 + 0.43, cz + 3.8, pal.porcelainWhite, true, true, 0.03);
  boxAt(g1, 0.52, 0.38, 0.05, cx + 11.4, fy1 + 1.12, cz + 3.85, frameDarkMat, false, false);
  boxAt(g1, 0.46, 0.32, 0.02, cx + 11.4, fy1 + 1.12, cz + 3.88, pal.seafoamHaloGlow, false, false);
  boxAt(g1, 0.12, 2.25, 3.6, cx + 16.4, fy1 + 1.125, cz + 4.0, pal.frostedPrivacyGlass, false, false);
  plant(g1, cx + 22.0, fy1, cz + 5.8, 1.25, 522, M, 'olive');

  // ===========================================================================
  // LEVEL 2 (lv = 2): DENTAL STUDIO, OPHTHALMOLOGY & IV LONGEVITY CONSERVATORY
  // ===========================================================================
  const g2 = levelGroups[2];
  const fy2 = fyOf(2);
  let l2MonIdx = 20;

  // --- ZONE 2A: West Wing Digital Dentistry Atelier (2 Operatories + CAD/CAM) ---
  // Frosted acoustic privacy fin separating Dental Bay 1 (-19.8) and Bay 2 (-13.6)
  boxAt(g2, 0.12, 2.25, 4.4, cx - 16.7, fy2 + 1.125, cz - 2.0, pal.frostedPrivacyGlass, false, false);
  boxAt(g2, 0.14, 2.3, 0.14, cx - 16.7, fy2 + 1.15, cz - 4.2, pal.hinokiAsh, true, false);
  boxAt(g2, 0.14, 2.3, 0.14, cx - 16.7, fy2 + 1.15, cz + 0.2, pal.hinokiAsh, true, false);

  buildDentalOperatory(g2, cx - 19.8, fy2, cz - 1.8, pal, M.textures.shadowTex, 0.12);
  buildDentalOperatory(g2, cx - 13.6, fy2, cz - 1.8, pal, M.textures.shadowTex, -0.12);
  // Sterilization cabinetry along North wall behind dental bays
  boxAt(g2, 11.2, 0.92, 0.68, cx - 16.7, fy2 + 0.46, cz - 7.1, pal.porcelainWhite, true, true, 0.02);
  boxAt(g2, 11.2, 0.06, 0.72, cx - 16.7, fy2 + 0.94, cz - 7.1, pal.seafoamCeramic, false, false);
  addSignage(g2, 'DENTAL STUDIO', '3D SMILE DESIGN & IMPLANTS', cx - 16.7, fy2 + 2.55, cz - 7.55, 0);

  // Dental CAD/CAM Workstation (dx -13.6, dz +4.4)
  addClinicalDesk(g2, cx - 13.6, fy2, cz + 4.4, 2.4, 1.0, pal, Math.PI);
  registerChair(2, cx - 13.6, fy2, cz + 5.28, Math.PI, 1);
  registerMonitor(
    2,
    l2MonIdx++,
    [cx - 13.6, fy2 + 0.78, cz + 4.25],
    0,
    cx - 13.6,
    cz + 5.28,
    'Cosmetic Dental Surgeon · L2',
    'Digital Dental Studio'
  );

  // --- ZONE 2B: Center-West Ophthalmology & Retinal Suite (dx -9.8 .. -1.6) ---
  // Slit-Lamp Microscope Diagnostic Pedestal (dx -6.8, dz -2.2)
  boxAt(g2, 1.45, 0.78, 0.75, cx - 6.8, fy2 + 0.39, cz - 2.2, pal.porcelainWhite, true, true, 0.03);
  cylAt(g2, 0.04, 0.04, 0.45, cx - 6.8, fy2 + 1.0, cz - 2.2, pal.surgicalSteel, false, false, 10);
  boxAt(g2, 0.28, 0.28, 0.36, cx - 6.8, fy2 + 1.24, cz - 2.2, frameDarkMat, true, false, 0.02);
  boxAt(g2, 0.14, 0.14, 0.08, cx - 6.8, fy2 + 1.24, cz - 2.0, pal.seafoamHaloGlow, false, false);
  cylAt(g2, 0.22, 0.22, 0.46, cx - 6.8, fy2 + 0.23, cz - 1.25, pal.eucalyptusFabric, true, true, 12);

  // Backlit Optical Snellen & Retinal Projection Panel (dx -6.4, dz -7.52)
  addSignage(g2, 'OPHTHALMOLOGY', 'OPTICAL RETINAL IMAGING', cx - 6.4, fy2 + 2.55, cz - 7.55, 0);
  boxAt(g2, 2.2, 1.4, 0.1, cx - 6.4, fy2 + 1.55, cz - 7.62, pal.seafoamCeramic, false, false, 0.02);
  boxAt(g2, 1.85, 1.08, 0.04, cx - 6.4, fy2 + 1.55, cz - 7.55, pal.circadianGlow, false, false);

  // Optometrist Consultation Console (dx -3.2, dz -3.6)
  addClinicalDesk(g2, cx - 3.2, fy2, cz - 3.6, 2.2, 1.0, pal, 0);
  registerChair(2, cx - 3.2, fy2, cz - 4.48, 0, -1);
  registerMonitor(
    2,
    l2MonIdx++,
    [cx - 3.2, fy2 + 0.78, cz - 3.45],
    Math.PI,
    cx - 3.2,
    cz - 4.48,
    'Lead Optometrist · L2',
    'Ophthalmology & Retinal Lab'
  );

  // Designer Eyewear Fitting Bar (dx -5.8, dz +4.8)
  boxAt(g2, 4.4, 0.92, 0.88, cx - 5.8, fy2 + 0.46, cz + 4.8, pal.hinokiAsh, true, true, 0.03);
  boxAt(g2, 4.48, 0.05, 0.94, cx - 5.8, fy2 + 0.94, cz + 4.8, pal.porcelainWhite, false, true, 0.015);
  [-7.2, -5.8, -4.4].forEach((ox) => {
    boxAt(g2, 0.96, 0.42, 0.56, cx + ox, fy2 + 1.18, cz + 4.8, pal.sterileGlass, false, false);
  });

  // --- ZONE 2C: East Wing Longevity & IV Infusion Botanical Conservatory ---
  // Preserved Living Botanical Moss Acoustic Wall along East boundary (dx +23.5)
  boxAt(g2, 0.14, 2.85, 12.2, cx + 23.5, fy2 + 1.425, cz, pal.livingMoss, false, true);
  boxAt(g2, 0.18, 2.95, 0.18, cx + 23.48, fy2 + 1.475, cz - 6.1, pal.hinokiAsh, false, false);
  boxAt(g2, 0.18, 2.95, 0.18, cx + 23.48, fy2 + 1.475, cz + 6.1, pal.hinokiAsh, false, false);

  // 3 Sculpted Longevity IV Infusion Recliner Pods (dx +13.0, +17.0, +21.0, dz +3.4)
  [13.0, 17.0, 21.0].forEach((ix) => {
    buildIvInfusionPod(g2, cx + ix, fy2, cz + 3.4, pal, M.textures.shadowTex, Math.PI);
  });
  boxAt(g2, 11.4, 0.015, 4.2, cx + 17.0, fy2 + 0.016, cz + 3.4, pal.calmAcousticMat, false, true);

  // Longevity Biomarker & Infusion Nurse Desk (dx +17.0, dz -3.6)
  addClinicalDesk(g2, cx + 17.0, fy2, cz - 3.6, 2.6, 1.05, pal, 0);
  registerChair(2, cx + 17.0, fy2, cz - 4.48, 0, 1);
  registerMonitor(
    2,
    l2MonIdx++,
    [cx + 17.0, fy2 + 0.78, cz - 3.45],
    Math.PI,
    cx + 17.0,
    cz - 4.48,
    'Longevity Nurse Specialist · L2',
    'Cellular IV & Recovery Lounge'
  );
  addSignage(g2, 'LONGEVITY IV', 'CELLULAR INFUSION CONSERVATORY', cx + 17.0, fy2 + 2.55, cz - 7.55, 0);
  plant(g2, cx + 22.0, fy2, cz - 5.8, 1.4, 531, M, 'olive');

  // ===========================================================================
  // LEVEL 3 (lv = 3): GENOMICS CLEANROOM, BIOBANK & LN2 CRYO-BIOLOGICS VAULT
  // ===========================================================================
  const g3 = levelGroups[3];
  const fy3 = fyOf(3);
  let l3MonIdx = 30;

  // --- ZONE 3A: West ISO-5 Sterile Compounding Cleanroom & Biosafety Cabinets ---
  // Glazed ISO-5 Positive-Pressure Cleanroom Envelope (dx -23.4 .. -14.8, dz -7.4 .. +1.8)
  // Wide open airlock entry along South facade (dx -20.2 .. -17.4 open!)
  boxAt(g3, 0.14, wallH, 9.2, cx - 14.8, fy3 + wallH * 0.5, cz - 2.8, pal.sterileGlass, false, false);
  boxAt(g3, 3.0, wallH, 0.14, cx - 21.9, fy3 + wallH * 0.5, cz + 1.8, pal.sterileGlass, false, false);
  boxAt(g3, 2.4, wallH, 0.14, cx - 16.0, fy3 + wallH * 0.5, cz + 1.8, pal.sterileGlass, false, false);
  boxAt(g3, 8.6, 0.14, 0.14, cx - 19.1, fy3 + 2.55, cz + 1.8, pal.surgicalSteel, false, false);
  addSignage(g3, 'ISO-5 CLEANROOM', 'STERILE BIOSAFETY LAB', cx - 18.8, fy3 + 2.85, cz + 1.92, 0);

  // Dual-Sash Laminar-Flow Biosafety Cabinets against West cleanroom wall (dx -22.5, dz -4.6 & -0.8)
  [-4.6, -0.8].forEach((bz) => {
    boxAt(g3, 1.15, 0.88, 2.25, cx - 22.4, fy3 + 0.44, cz + bz, pal.surgicalSteel, true, true, 0.02);
    boxAt(g3, 1.12, 1.25, 2.2, cx - 22.4, fy3 + 1.5, cz + bz, pal.porcelainWhite, true, false, 0.02);
    boxAt(g3, 0.04, 0.92, 2.02, cx - 21.82, fy3 + 1.48, cz + bz, pal.sterileGlass, false, false);
    boxAt(g3, 0.85, 0.16, 1.95, cx - 22.4, fy3 + 1.96, cz + bz, pal.circadianGlow, false, false);
  });
  // Central Robotic Automated Hematology Centrifuge Island (dx -18.8, dz -2.8)
  boxAt(g3, 1.55, 0.88, 2.65, cx - 18.8, fy3 + 0.44, cz - 2.8, pal.porcelainWhite, true, true, 0.03);
  boxAt(g3, 1.62, 0.06, 2.72, cx - 18.8, fy3 + 0.9, cz - 2.8, pal.seafoamCeramic, false, false);
  cylAt(g3, 0.34, 0.38, 0.36, cx - 18.8, fy3 + 1.11, cz - 3.4, pal.surgicalSteel, true, false, 16);
  cylAt(g3, 0.24, 0.24, 0.28, cx - 18.8, fy3 + 1.07, cz - 2.1, accentMat, false, false, 14);

  // Outside-Cleanroom Geneticist & Bioinformatician Workstations (dx -11.8, dz -2.6 & +4.2)
  addClinicalDesk(g3, cx - 11.8, fy3, cz - 2.6, 2.4, 1.0, pal, 0);
  registerChair(3, cx - 11.8, fy3, cz - 3.48, 0, -1);
  registerMonitor(
    3,
    l3MonIdx++,
    [cx - 11.8, fy3 + 0.78, cz - 2.45],
    Math.PI,
    cx - 11.8,
    cz - 3.48,
    'Clinical Geneticist · L3',
    'Genomics Sequencing Lab'
  );

  addClinicalDesk(g3, cx - 11.8, fy3, cz + 4.2, 2.4, 1.0, pal, Math.PI);
  registerChair(3, cx - 11.8, fy3, cz + 5.08, Math.PI, 1);
  registerMonitor(
    3,
    l3MonIdx++,
    [cx - 11.8, fy3 + 0.78, cz + 4.05],
    0,
    cx - 11.8,
    cz + 5.08,
    'Bioinformatics Lead · L3',
    'Genomics Analytics Bench'
  );

  // --- ZONE 3B: Center-West Cryo-Biologics LN2 Vault & Genomic Matrix Display ---
  // Framed Cryo Vault (dx -9.0 .. -1.8, dz -7.0 .. +0.6, open south portal dx -6.8..-4.0)
  boxAt(g3, 0.14, wallH, 7.6, cx - 9.0, fy3 + wallH * 0.5, cz - 3.2, pal.cryoFrostGlass, false, false);
  boxAt(g3, 0.14, wallH, 7.6, cx - 1.8, fy3 + wallH * 0.5, cz - 3.2, pal.cryoFrostGlass, false, false);
  boxAt(g3, 2.2, wallH, 0.14, cx - 7.9, fy3 + wallH * 0.5, cz + 0.6, pal.cryoFrostGlass, false, false);
  boxAt(g3, 2.2, wallH, 0.14, cx - 2.9, fy3 + wallH * 0.5, cz + 0.6, pal.cryoFrostGlass, false, false);
  boxAt(g3, 7.2, 0.14, 0.14, cx - 5.4, fy3 + 2.55, cz + 0.6, pal.surgicalSteel, false, false);

  // 3 Polished Stainless LN2 Cryo-Dewars inside Vault
  [-7.2, -5.4, -3.6].forEach((tx) => {
    buildCryoDewarTank(g3, cx + tx, fy3, cz - 3.2, pal, M.textures.shadowTex);
  });

  // Live Animated Genomics Sequencing & Cryo Stability Screen (dx -5.4, dz -7.52)
  const genBoard = createCustomBoardScreen(screenReg, 620, 240, (g, w, h, t) => {
    g.fillStyle = '#07171c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2dd4bf';
    g.fillRect(0, 0, w, 34);
    g.fillStyle = '#07171c';
    g.font = '800 16px sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('VITALCARE GENOMICS & LN2 CRYO-BIOBANK (-196.4°C LOCK)', 14, 17);
    const bases = ['A', 'T', 'G', 'C'];
    const cols = ['#2dd4bf', '#38bdf8', '#a7f3d0', '#f59e0b'];
    for (let i = 0; i < 18; i++) {
      const bx = 28 + i * 32;
      const barH = 42 + Math.sin(t * 2.2 + i * 0.55) * 28;
      g.fillStyle = cols[i % 4];
      g.fillRect(bx, 150 - barH, 18, barH);
      g.fillStyle = '#ffffff';
      g.font = '700 13px monospace';
      g.fillText(bases[i % 4], bx + 4, 172);
    }
    g.fillStyle = '#99f6e4';
    g.font = '600 15px monospace';
    g.fillText('DEWAR A: -196.4°C  |  DEWAR B: -196.2°C  |  ISO-5 PRESS: +18 Pa', 28, 212);
  });
  boxAt(g3, 4.8, 2.1, 0.14, cx - 5.4, fy3 + 2.3, cz - 7.64, frameDarkMat, false, false);
  const genMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.56, 1.88), genBoard.mat);
  genMesh.position.set(cx - 5.4, fy3 + 2.3, cz - 7.55);
  g3.add(genMesh);
  genBoard.setMesh(genMesh);

  // --- ZONE 3C: East Wing Clinical Pathology & Biologics QA Lab ---
  [14.2, 20.0].forEach((px, i) => {
    addClinicalDesk(g3, cx + px, fy3, cz - 2.8, 2.5, 1.05, pal, 0);
    // Custom pathology optical microscope rig on desk corner
    boxAt(g3, 0.24, 0.05, 0.28, cx + px - 0.72, fy3 + 0.8, cz - 2.75, pal.surgicalSteel, false, false);
    cylAt(g3, 0.04, 0.05, 0.34, cx + px - 0.72, fy3 + 0.98, cz - 2.75, pal.porcelainWhite, false, false, 10);
    registerChair(3, cx + px, fy3, cz - 3.68, 0, i === 0 ? 1 : -1);
    registerMonitor(
      3,
      l3MonIdx++,
      [cx + px, fy3 + 0.78, cz - 2.65],
      Math.PI,
      cx + px,
      cz - 3.68,
      i === 0 ? 'Chief Pathologist · L3' : 'QA Biologics Auditor · L3',
      'Clinical Pathology & QA Lab'
    );
  });
  // Specimen Pass-Through Autoclave Wall & Cold-Chain Couriers Counter (dx +17.0, dz +4.6)
  boxAt(g3, 6.2, 1.02, 1.08, cx + 17.0, fy3 + 0.51, cz + 4.6, pal.porcelainWhite, true, true, 0.03);
  boxAt(g3, 6.3, 0.06, 1.14, cx + 17.0, fy3 + 1.04, cz + 4.6, pal.seafoamCeramic, false, false);
  boxAt(g3, 0.65, 2.35, 5.2, cx + 23.25, fy3 + 1.175, cz - 2.5, pal.surgicalSteel, true, true, 0.02);
  addSignage(g3, 'PATHOLOGY', 'BIOLOGICS QA & HISTOLOGY', cx + 17.0, fy3 + 2.55, cz - 7.55, 0);
  plant(g3, cx + 21.8, fy3, cz + 5.8, 1.2, 541, M, 'fern');

  // ===========================================================================
  // LEVEL 4 (lv = 4): MEDICAL DIRECTORATE, TELEHEALTH STUDIO & SKY-SANCTUARY
  // ===========================================================================
  const g4 = levelGroups[4];
  const fy4 = fyOf(4);
  let l4MonIdx = 40;

  // --- ZONE 4A: West Wing Telehealth Acoustic Studio & CMO Suite ---
  // Telehealth Studio Acoustic Pod (dx -20.6 .. -14.0, dz -7.4 .. +0.2, South opening at dz +0.2!)
  boxAt(g4, 0.14, wallH, 7.6, cx - 20.6, fy4 + wallH * 0.5, cz - 3.6, pal.hinokiAsh, true, false);
  boxAt(g4, 0.14, wallH, 7.6, cx - 14.0, fy4 + wallH * 0.5, cz - 3.6, pal.sterileGlass, false, false);
  boxAt(g4, 2.0, wallH, 0.14, cx - 19.6, fy4 + wallH * 0.5, cz + 0.2, pal.frostedPrivacyGlass, false, false);
  boxAt(g4, 2.0, wallH, 0.14, cx - 15.0, fy4 + wallH * 0.5, cz + 0.2, pal.frostedPrivacyGlass, false, false);
  boxAt(g4, 6.6, 0.14, 0.14, cx - 17.3, fy4 + 2.55, cz + 0.2, pal.hinokiAsh, false, false);

  addClinicalDesk(g4, cx - 17.2, fy4, cz - 3.5, 2.5, 1.0, pal, 0);
  // Studio Ring-Light Telemedicine Camera Rig facing chair
  cylAt(g4, 0.18, 0.2, 0.04, cx - 17.2, fy4 + 0.02, cz - 2.35, pal.surgicalSteel, false, true, 12);
  cylAt(g4, 0.025, 0.025, 1.48, cx - 17.2, fy4 + 0.76, cz - 2.35, pal.surgicalSteel, true, false, 8);
  const ringLight = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.024, 8, 24), pal.circadianGlow);
  ringLight.position.set(cx - 17.2, fy4 + 1.54, cz - 2.35);
  g4.add(ringLight);
  registerChair(4, cx - 17.2, fy4, cz - 4.38, 0, -1);
  registerMonitor(
    4,
    l4MonIdx++,
    [cx - 17.2, fy4 + 0.78, cz - 3.35],
    Math.PI,
    cx - 17.2,
    cz - 4.38,
    'Telehealth Medical Anchor · L4',
    'Telehealth Broadcast Studio'
  );
  addSignage(g4, 'TELEHEALTH', '4K VIRTUAL CLINIC STUDIO', cx - 17.3, fy4 + 2.55, cz - 7.55, 0);

  // Chief Medical Director Office (dx -18.5, dz +4.6)
  addClinicalDesk(g4, cx - 18.5, fy4, cz + 4.6, 2.8, 1.1, pal, Math.PI);
  registerChair(4, cx - 18.5, fy4, cz + 5.48, Math.PI, 1);
  registerMonitor(
    4,
    l4MonIdx++,
    [cx - 18.5, fy4 + 0.78, cz + 4.45],
    0,
    cx - 18.5,
    cz + 5.48,
    'Chief Medical Director · L4',
    'Medical Directorate Suite'
  );
  sofaWide(g4, cx - 12.6, fy4, cz + 4.8, -Math.PI / 2, pal.eucalyptusFabric, M);
  plant(g4, cx - 22.0, fy4, cz + 6.0, 1.4, 551, M, 'olive');

  // --- ZONE 4B: Center-West Clinical Case Review Boardroom (dx -9.8 .. -1.8) ---
  boxAt(g4, 0.14, wallH, 8.8, cx - 9.8, fy4 + wallH * 0.5, cz - 3.0, pal.sterileGlass, false, false);
  boxAt(g4, 0.14, wallH, 8.8, cx - 1.8, fy4 + wallH * 0.5, cz - 3.0, pal.sterileGlass, false, false);
  boxAt(g4, 2.4, wallH, 0.14, cx - 8.6, fy4 + wallH * 0.5, cz + 1.4, pal.frostedPrivacyGlass, false, false);
  boxAt(g4, 2.4, wallH, 0.14, cx - 3.0, fy4 + wallH * 0.5, cz + 1.4, pal.frostedPrivacyGlass, false, false);
  boxAt(g4, 8.0, 0.14, 0.14, cx - 5.8, fy4 + 2.55, cz + 1.4, pal.hinokiAsh, false, false);

  // 4.6m Seafoam-Terrazzo & Hinoki-Ash Clinical Board Table (dx -5.8, dz -2.8)
  boxAt(g4, 4.6, 0.08, 1.72, cx - 5.8, fy4 + 0.74, cz - 2.8, pal.porcelainWhite, true, true, 0.04);
  boxAt(g4, 4.2, 0.02, 1.32, cx - 5.8, fy4 + 0.79, cz - 2.8, pal.seafoamCeramic, false, true, 0.02);
  [-7.2, -4.4].forEach((px) => {
    cylAt(g4, 0.18, 0.24, 0.7, cx + px, fy4 + 0.35, cz - 2.8, pal.hinokiAsh, true, true, 16);
  });

  // 4 Registered Board Seats with 2.6m spacing (>= ±0.66m clear X dock)
  const boardRoles = [
    'Clinical Governance Chair · L4',
    'Head of Surgical Review · L4',
    'Chief Pharmacy Officer · L4',
    'Bioethics & Patient Safety · L4',
  ];
  [
    [-7.1, -4.25, 0, -1],
    [-4.5, -4.25, 0, 1],
    [-7.1, -1.35, Math.PI, -1],
    [-4.5, -1.35, Math.PI, 1],
  ].forEach(([bx, bz, rot, sw], bi) => {
    registerChair(4, cx + bx, fy4, cz + bz, rot, sw);
    if (bi < 2) {
      registerMonitor(
        4,
        l4MonIdx++,
        [cx + bx, fy4 + 0.79, cz - 3.3],
        Math.PI,
        cx + bx,
        cz + bz,
        boardRoles[bi],
        'Clinical Case Review Boardroom'
      );
    } else {
      monitor(g4, cx + bx, fy4 + 0.79, cz - 2.3, true, 0, M);
    }
  });
  // Extra clean decorative boardroom chairs on ends
  officeChair(g4, cx - 8.75, fy4, cz - 2.8, Math.PI / 2, M);
  officeChair(g4, cx - 2.85, fy4, cz - 2.8, -Math.PI / 2, M);

  // Dual 4K Hospital Readiness Board inside Boardroom (dx -5.8, dz -7.52)
  const opsBoard = createCustomBoardScreen(screenReg, 640, 240, (g, w, h, t) => {
    g.fillStyle = '#061918';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2dd4bf';
    g.fillRect(0, 0, w, 34);
    g.fillStyle = '#061918';
    g.font = '800 16px sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('VITALCARE DIRECTORATE · CLINICAL OUTCOMES & SKY WELLNESS OPS', 14, 17);
    const kpis = [
      ['Diagnostic SLA', '17.4 min', '+4% FASTER'],
      ['3T MRI Utilization', '94.2%', 'NOMINAL'],
      ['Cold-Chain Compliance', '100.0%', '4.1°C LOCKED'],
      ['Telehealth Consults', `${142 + Math.floor(Math.sin(t * 0.4) * 3 + 3)} TODAY`, 'LIVE 4K'],
    ];
    kpis.forEach((k, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const kx = 24 + col * 304;
      const ky = 54 + row * 86;
      g.fillStyle = 'rgba(45,212,191,0.12)';
      rr(g, kx, ky, 286, 72, 8);
      g.fill();
      g.fillStyle = '#99f6e4';
      g.font = '600 13px sans-serif';
      g.fillText(k[0], kx + 14, ky + 20);
      g.fillStyle = '#ffffff';
      g.font = '800 22px monospace';
      g.fillText(k[1], kx + 14, ky + 48);
      g.fillStyle = '#4ade80';
      g.font = '700 12px monospace';
      g.textAlign = 'right';
      g.fillText(k[2], kx + 272, ky + 20);
      g.textAlign = 'left';
    });
  });
  boxAt(g4, 5.2, 2.05, 0.14, cx - 5.8, fy4 + 2.25, cz - 7.64, frameDarkMat, false, false);
  const opsMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.95, 1.85), opsBoard.mat);
  opsMesh.position.set(cx - 5.8, fy4 + 2.25, cz - 7.55);
  g4.add(opsMesh);
  opsBoard.setMesh(opsMesh);

  // --- ZONE 4C: East Wing Therapeutic Sky-Sanctuary, Botanical Tea Bar & Recovery Lounge ---
  // Herbal Tea & Electrolyte Dispensary Counter (dx +18.8, dz -3.8)
  addClinicalDesk(g4, cx + 18.8, fy4, cz - 3.8, 3.6, 1.05, pal, 0);
  registerChair(4, cx + 18.8, fy4, cz - 4.68, 0, 1);
  registerMonitor(
    4,
    l4MonIdx++,
    [cx + 18.8, fy4 + 0.78, cz - 3.65],
    Math.PI,
    cx + 18.8,
    cz - 4.68,
    'Recovery & Nutrition Lead · L4',
    'Botanical Sky-Sanctuary'
  );
  // Glass apothecary herbal tea dispensers on counter
  [-0.9, 0.9].forEach((tx) => {
    cylAt(g4, 0.14, 0.14, 0.36, cx + 18.8 + tx, fy4 + 0.96, cz - 3.55, pal.sterileGlass, false, false, 12);
    cylAt(g4, 0.12, 0.12, 0.04, cx + 18.8 + tx, fy4 + 1.16, cz - 3.55, pal.hinokiAsh, false, false, 12);
  });

  // Biophilic Recovery Day-Lounges & Bamboo Pergola Canopy (dx +15.8, dz +3.6)
  boxAt(g4, 9.8, 0.015, 4.4, cx + 16.4, fy4 + 0.016, cz + 3.6, pal.calmAcousticMat, false, true);
  sofaWide(g4, cx + 14.0, fy4, cz + 4.8, Math.PI, pal.sageFelt, M);
  sofaWide(g4, cx + 19.2, fy4, cz + 4.8, Math.PI, pal.eucalyptusFabric, M);
  cylAt(g4, 0.56, 0.52, 0.38, cx + 16.6, fy4 + 0.19, cz + 3.4, pal.porcelainWhite, true, true, 20);
  plant(g4, cx + 16.6, fy4 + 0.38, cz + 3.4, 0.48, 558, M, 'fern');
  plant(g4, cx + 22.2, fy4, cz + 5.8, 1.45, 559, M, 'olive');
  plant(g4, cx + 11.2, fy4, cz + 5.8, 1.3, 560, M, 'ficus');

  // Living Moss Wall & Calm Sky-Sanctuary Sign (dx +16.4, dz -7.55)
  boxAt(g4, 4.6, 2.8, 0.12, cx + 16.4, fy4 + 1.4, cz - 7.64, pal.livingMoss, false, true);
  addSignage(g4, 'SKY SANCTUARY', 'PATIENT RECOVERY & HERBAL ATRIUM', cx + 16.4, fy4 + 2.55, cz - 7.5, 0);

  // Subtle ceiling downlights at main reception & stairwell entry
  downlight(g0, cx, fy0 + spec.floorH - 0.16, cz + 2.2, M);
  downlight(g0, cx + 3.2, fy0 + spec.floorH - 0.16, cz - 1.4, M);
}
