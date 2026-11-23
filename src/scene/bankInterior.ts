import * as THREE from 'three';
import type { ArchitecturalMaterials } from './architecturalForms';
import { getRoundedSlabGeo } from './architecturalForms';
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
  sofaWide,
} from './props';
import { createCustomBoardScreen, type ScreenRegistry } from './screens';
import { getMaxAnisotropy, makeCanvasTex, rr } from './textures';

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
  neroGoldMarble: THREE.MeshStandardMaterial;
  ivoryTravertine: THREE.MeshStandardMaterial;
  flutedTravertine: THREE.MeshStandardMaterial;
  midnightNavyFelt: THREE.MeshStandardMaterial;
  smokedWalnut: THREE.MeshStandardMaterial;
  sovereignBrass: THREE.MeshStandardMaterial;
  titaniumVault: THREE.MeshStandardMaterial;
  cognacLeather: THREE.MeshStandardMaterial;
  emeraldBankerGlass: THREE.MeshStandardMaterial;
  goldBullion: THREE.MeshStandardMaterial;
  warmCoveLed: THREE.MeshBasicMaterial;
  royalBlueLed: THREE.MeshBasicMaterial;
  smokedGlass: THREE.MeshPhysicalMaterial;
  frostedSecurityGlass: THREE.MeshPhysicalMaterial;
  lockerFaceMat: THREE.MeshStandardMaterial;
  stairTreadMat: THREE.MeshStandardMaterial;
}

let cachedPalette: BankPalette | null = null;

function getBankPalette(): BankPalette {
  if (cachedPalette) return cachedPalette;

  const aniso = getMaxAnisotropy();

  // 1. Bookmatched Kilimanjaro Nero Marquina Marble with Gold Calcite Veins & Brass Inlay Seams
  const neroTex = makeCanvasTex('bank_nero_gold_marble', 512, 512, (g, W, H) => {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#10141c');
    bg.addColorStop(0.5, '#161b25');
    bg.addColorStop(1, '#0c1017');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Subtle charcoal mineral clouding
    for (let i = 0; i < 42; i++) {
      const rx = ((Math.sin(i * 19.3 + 2.1) * 43758.5453) % 1 + 1) % 1;
      const ry = ((Math.sin(i * 73.7 + 5.9) * 24634.6345) % 1 + 1) % 1;
      const rad = 28 + (i % 5) * 18;
      const grad = g.createRadialGradient(rx * W, ry * H, 2, rx * W, ry * H, rad);
      grad.addColorStop(0, 'rgba(38, 48, 66, 0.22)');
      grad.addColorStop(1, 'rgba(12, 16, 23, 0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }

    // Crisp diagonal gold and warm ivory calcite veins
    for (let v = 0; v < 14; v++) {
      const gold = v % 3 !== 0;
      g.strokeStyle = gold ? 'rgba(217, 173, 88, 0.42)' : 'rgba(232, 224, 206, 0.24)';
      g.lineWidth = gold ? 1.4 + (v % 3) * 0.7 : 1.0;
      g.beginPath();
      let vx = (v * 57) % W;
      let vy = (v * 23) % (H * 0.4);
      g.moveTo(vx, vy);
      for (let s = 1; s <= 10; s++) {
        vx += 34 + Math.sin(v * 3.1 + s) * 18;
        vy += 32 + Math.cos(v * 2.4 + s * 1.3) * 14;
        g.lineTo(vx, vy);
      }
      g.stroke();
    }

    // Fine brushed brass architectural control-joint inlays
    g.strokeStyle = 'rgba(217, 173, 88, 0.48)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);
    g.beginPath();
    g.moveTo(W * 0.5, 0);
    g.lineTo(W * 0.5, H);
    g.moveTo(0, H * 0.5);
    g.lineTo(W, H * 0.5);
    g.stroke();
  });
  neroTex.colorSpace = THREE.SRGBColorSpace;
  neroTex.wrapS = neroTex.wrapT = THREE.RepeatWrapping;
  neroTex.repeat.set(4.5, 4.0);
  neroTex.anisotropy = aniso;

  // 2. Honed Ivory Roman Travertine Ashlar
  const travTex = makeCanvasTex('bank_ivory_travertine', 512, 512, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#ebe3d3');
    grad.addColorStop(0.5, '#e2d7c3');
    grad.addColorStop(1, '#ded2bc');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 6) {
      const a = 0.04 + (Math.sin(y * 0.21) + 1) * 0.035;
      g.fillStyle = `rgba(138, 118, 88, ${a.toFixed(3)})`;
      g.fillRect(0, y, W, 2 + (y % 3));
    }
    g.strokeStyle = 'rgba(122, 104, 78, 0.28)';
    g.lineWidth = 2;
    for (let r = 0; r < 4; r++) {
      const ry = r * (H / 4);
      g.beginPath();
      g.moveTo(0, ry);
      g.lineTo(W, ry);
      g.stroke();
      const offsetX = (r % 2) * (W * 0.25);
      for (let c = 0; c < 2; c++) {
        const cx = (offsetX + c * (W * 0.5)) % W;
        g.beginPath();
        g.moveTo(cx, ry);
        g.lineTo(cx, ry + H / 4);
        g.stroke();
      }
    }
  });
  travTex.colorSpace = THREE.SRGBColorSpace;
  travTex.wrapS = travTex.wrapT = THREE.RepeatWrapping;
  travTex.repeat.set(2.5, 2.5);
  travTex.anisotropy = aniso;

  // 3. Fluted Ivory Travertine Vertical Ribbing
  const fluteTex = makeCanvasTex('bank_fluted_travertine', 256, 256, (g, W, H) => {
    g.fillStyle = '#e6dcc8';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 16) {
      const f = g.createLinearGradient(x, 0, x + 16, 0);
      f.addColorStop(0, '#c8bba3');
      f.addColorStop(0.45, '#f2eadb');
      f.addColorStop(0.9, '#d6cab4');
      f.addColorStop(1, '#bcae94');
      g.fillStyle = f;
      g.fillRect(x, 0, 16, H);
    }
  });
  fluteTex.colorSpace = THREE.SRGBColorSpace;
  fluteTex.wrapS = fluteTex.wrapT = THREE.RepeatWrapping;
  fluteTex.repeat.set(2, 1);
  fluteTex.anisotropy = aniso;

  // 4. Midnight Sovereign Navy Acoustic Felt Slats
  const navyTex = makeCanvasTex('bank_midnight_navy_felt', 256, 256, (g, W, H) => {
    g.fillStyle = '#0f1c33';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 14) {
      g.fillStyle = '#091224';
      g.fillRect(x, 0, 3, H);
      g.fillStyle = '#182b4d';
      g.fillRect(x + 3, 0, 11, H);
    }
  });
  navyTex.colorSpace = THREE.SRGBColorSpace;
  navyTex.wrapS = navyTex.wrapT = THREE.RepeatWrapping;
  navyTex.repeat.set(3, 1.5);
  navyTex.anisotropy = aniso;

  // 5. Figured Honduran Smoked Walnut Burl
  const walnutTex = makeCanvasTex('bank_smoked_walnut_burl', 512, 256, (g, W, H) => {
    const base = g.createLinearGradient(0, 0, W, 0);
    base.addColorStop(0, '#3e2416');
    base.addColorStop(0.5, '#52301d');
    base.addColorStop(1, '#361e12');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = i % 2 === 0 ? 'rgba(28, 14, 7, 0.35)' : 'rgba(116, 72, 42, 0.25)';
      g.lineWidth = 2 + (i % 3);
      g.beginPath();
      const y0 = (i / 40) * H;
      g.moveTo(0, y0);
      g.bezierCurveTo(W * 0.33, y0 + Math.sin(i) * 14, W * 0.66, y0 - Math.cos(i) * 14, W, y0);
      g.stroke();
    }
  });
  walnutTex.colorSpace = THREE.SRGBColorSpace;
  walnutTex.wrapS = walnutTex.wrapT = THREE.RepeatWrapping;
  walnutTex.repeat.set(2, 1);
  walnutTex.anisotropy = aniso;

  // 6. Safe-Deposit Box Matrix Texture (Titanium & Brass Keyholes)
  const lockerTex = makeCanvasTex('bank_safe_deposit_wall', 512, 256, (g, W, H) => {
    g.fillStyle = '#717d8e';
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
        boxGrad.addColorStop(0, '#9aa6b8');
        boxGrad.addColorStop(0.5, '#8490a3');
        boxGrad.addColorStop(1, '#687385');
        g.fillStyle = boxGrad;
        g.fillRect(x, y, cw - 6, ch - 6);
        g.strokeStyle = '#1f2937';
        g.lineWidth = 2;
        g.strokeRect(x, y, cw - 6, ch - 6);
        // Dual brass key escutcheons
        g.fillStyle = '#d9ad58';
        g.beginPath();
        g.arc(x + cw * 0.28, y + ch * 0.45, 3.6, 0, Math.PI * 2);
        g.arc(x + cw * 0.52, y + ch * 0.45, 3.6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#1e293b';
        g.fillRect(x + cw * 0.27, y + ch * 0.41, 2, 7);
        g.fillRect(x + cw * 0.51, y + ch * 0.41, 2, 7);
      }
    }
  });
  lockerTex.colorSpace = THREE.SRGBColorSpace;
  lockerTex.anisotropy = aniso;

  cachedPalette = {
    neroGoldMarble: new THREE.MeshStandardMaterial({
      map: neroTex,
      roughness: 0.2,
      metalness: 0.08,
      envMapIntensity: 0.45,
    }),
    ivoryTravertine: new THREE.MeshStandardMaterial({
      map: travTex,
      roughness: 0.62,
      metalness: 0.02,
      envMapIntensity: 0.25,
    }),
    flutedTravertine: new THREE.MeshStandardMaterial({
      map: fluteTex,
      roughness: 0.58,
      metalness: 0.02,
      envMapIntensity: 0.24,
    }),
    midnightNavyFelt: new THREE.MeshStandardMaterial({
      map: navyTex,
      roughness: 0.84,
      metalness: 0.03,
      envMapIntensity: 0.18,
    }),
    smokedWalnut: new THREE.MeshStandardMaterial({
      map: walnutTex,
      roughness: 0.36,
      metalness: 0.04,
      envMapIntensity: 0.32,
    }),
    sovereignBrass: new THREE.MeshStandardMaterial({
      color: 0xd9ad58,
      roughness: 0.24,
      metalness: 0.88,
      envMapIntensity: 0.72,
    }),
    titaniumVault: new THREE.MeshStandardMaterial({
      color: 0x9aa6b8,
      roughness: 0.26,
      metalness: 0.9,
      envMapIntensity: 0.68,
    }),
    cognacLeather: new THREE.MeshStandardMaterial({
      color: 0x8a4b25,
      roughness: 0.44,
      metalness: 0.04,
      envMapIntensity: 0.24,
    }),
    emeraldBankerGlass: new THREE.MeshStandardMaterial({
      color: 0x16804b,
      emissive: 0x0b522e,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.1,
    }),
    goldBullion: new THREE.MeshStandardMaterial({
      color: 0xf6c945,
      roughness: 0.18,
      metalness: 0.94,
      envMapIntensity: 0.85,
    }),
    warmCoveLed: new THREE.MeshBasicMaterial({ color: 0xffdf9e, toneMapped: false }),
    royalBlueLed: new THREE.MeshBasicMaterial({ color: 0x60a5fa, toneMapped: false }),
    smokedGlass: new THREE.MeshPhysicalMaterial({
      color: 0x8ea4be,
      transparent: true,
      opacity: 0.34,
      roughness: 0.1,
      metalness: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    frostedSecurityGlass: new THREE.MeshPhysicalMaterial({
      color: 0xdbe6f2,
      transparent: true,
      opacity: 0.58,
      roughness: 0.42,
      metalness: 0.06,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    lockerFaceMat: new THREE.MeshStandardMaterial({
      map: lockerTex,
      roughness: 0.28,
      metalness: 0.72,
      envMapIntensity: 0.52,
    }),
    stairTreadMat: new THREE.MeshStandardMaterial({
      map: neroTex,
      roughness: 0.26,
      metalness: 0.08,
      envMapIntensity: 0.4,
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
  const tex = makeCanvasTex(`bank_plaque_${title}_${subtitle}`, 420, 88, (g, w, h) => {
    g.fillStyle = '#0e1726';
    rr(g, 2, 2, w - 4, h - 4, 8);
    g.fill();
    g.strokeStyle = '#d9ad58';
    g.lineWidth = 2.5;
    rr(g, 5, 5, w - 10, h - 10, 6);
    g.stroke();
    g.fillStyle = '#3b82f6';
    g.fillRect(16, 16, 6, h - 32);
    g.fillStyle = '#f8fafc';
    g.font = '800 18px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(title.toUpperCase(), 34, 31);
    g.fillStyle = '#d9ad58';
    g.font = '600 13px "IBM Plex Mono", monospace';
    g.fillText(subtitle, 34, 60);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = getMaxAnisotropy();

  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 0.37),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
  );
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  parent.add(m);
}

function buildBankersLamp(parent: THREE.Object3D, pal: BankPalette, x: number, y: number, z: number, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  cylAt(g, 0.08, 0.09, 0.025, 0, 0.012, 0, pal.sovereignBrass, false, false, 14);
  cylAt(g, 0.014, 0.018, 0.24, 0, 0.13, -0.02, pal.sovereignBrass, false, false, 10);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.22, 12, 1, false, 0, Math.PI),
    pal.emeraldBankerGlass
  );
  shade.rotation.z = Math.PI / 2;
  shade.position.set(0, 0.26, 0.01);
  g.add(shade);
  parent.add(g);
}

function buildExecutiveDesk(
  parent: THREE.Object3D,
  pal: BankPalette,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  rotY = 0,
  withLamp = true
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  // Smoked walnut bullnose top + brass apron trim
  boxAt(g, w, 0.06, d, 0, 0.74, 0, pal.smokedWalnut, true, true, 0.016);
  boxAt(g, w - 0.08, 0.024, d - 0.08, 0, 0.7, 0, pal.sovereignBrass, false, false, 0.006);
  // Modesty panel in midnight navy acoustic felt + travertine leg pedestals
  boxAt(g, w - 0.34, 0.66, 0.06, 0, 0.35, -d * 0.34, pal.midnightNavyFelt, false, true, 0.01);
  [-w * 0.42, w * 0.42].forEach((lx) => {
    boxAt(g, 0.14, 0.7, d * 0.76, lx, 0.35, 0, pal.ivoryTravertine, true, true, 0.012);
    boxAt(g, 0.16, 0.04, d * 0.78, lx, 0.02, 0, pal.sovereignBrass, false, false);
  });
  if (withLamp) {
    buildBankersLamp(g, pal, -w * 0.34, 0.77, -d * 0.22, 0);
  }
  parent.add(g);
}

function buildFlutedBankColumn(parent: THREE.Object3D, pal: BankPalette, x: number, fy: number, z: number, h: number) {
  boxAt(parent, 0.72, 0.16, 0.72, x, fy + 0.08, z, pal.neroGoldMarble, true, true, 0.02);
  boxAt(parent, 0.6, 0.06, 0.6, x, fy + 0.19, z, pal.sovereignBrass, false, false, 0.01);
  cylAt(parent, 0.24, 0.27, h - 0.34, x, fy + 0.22 + (h - 0.34) * 0.5, z, pal.flutedTravertine, true, true, 18);
  cylAt(parent, 0.29, 0.25, 0.09, x, fy + h - 0.08, z, pal.sovereignBrass, false, false, 18);
}

function buildCofferedCeiling(
  cg: THREE.Group,
  pal: BankPalette,
  spec: DistrictBuildingSpec,
  ceilY: number,
  skipStairVoid: boolean,
  warmLights: WarmLightAnchor[],
  lv: number
) {
  const cofferY = ceilY - 0.12;
  // Smoked walnut perimeter beam frame
  boxAt(cg, spec.w - 0.8, 0.14, 0.35, spec.cx, cofferY, spec.cz - 9.2, pal.smokedWalnut, false, false);
  boxAt(cg, spec.w - 0.8, 0.14, 0.35, spec.cx, cofferY, spec.cz + 9.2, pal.smokedWalnut, false, false);
  boxAt(cg, 0.35, 0.14, spec.d - 0.8, spec.cx - 10.2, cofferY, spec.cz, pal.smokedWalnut, false, false);

  // Longitudinal walnut coffer girders (avoiding East stair void dx +5.10..+10.60, dz -1.10..+6.90)
  [-6.8, -2.0, 2.8].forEach((dx) => {
    boxAt(cg, 0.22, 0.14, spec.d - 1.0, spec.cx + dx, cofferY, spec.cz, pal.smokedWalnut, false, false);
  });

  // Recessed Navy Coffer Bays + Brass Trim & Warm LED Cove Strips on West/Center Bays
  const bayCentersX = [-8.6, -4.4, 0.4];
  const bayCentersZ = [-5.8, 0.0, 5.8];
  bayCentersX.forEach((bx) => {
    bayCentersZ.forEach((bz) => {
      boxAt(cg, 3.6, 0.06, 4.6, spec.cx + bx, ceilY - 0.06, spec.cz + bz, pal.midnightNavyFelt, false, false);
      boxAt(cg, 3.72, 0.03, 0.06, spec.cx + bx, ceilY - 0.09, spec.cz + bz - 2.3, pal.sovereignBrass, false, false);
      boxAt(cg, 3.72, 0.03, 0.06, spec.cx + bx, ceilY - 0.09, spec.cz + bz + 2.3, pal.sovereignBrass, false, false);
      boxAt(cg, 2.8, 0.025, 0.05, spec.cx + bx, ceilY - 0.095, spec.cz + bz, pal.warmCoveLed, false, false);
    });
  });

  // North-East Coffer bay (north of stair void dz -8.8..-2.2)
  boxAt(cg, 4.2, 0.06, 4.8, spec.cx + 6.4, ceilY - 0.06, spec.cz - 5.6, pal.midnightNavyFelt, false, false);
  boxAt(cg, 3.2, 0.025, 0.05, spec.cx + 6.4, ceilY - 0.095, spec.cz - 5.6, pal.warmCoveLed, false, false);

  if (!skipStairVoid) {
    boxAt(cg, 4.2, 0.06, 4.8, spec.cx + 7.4, ceilY - 0.06, spec.cz + 3.0, pal.midnightNavyFelt, false, false);
  }

  // Push ceiling WarmLightAnchors (never spawn raw PointLight!)
  warmLights.push(
    {
      x: spec.cx - 3.6,
      y: ceilY - 0.45,
      z: spec.cz - 2.2,
      color: 0xffe4b2,
      distance: 18,
      baseScale: lv === 0 ? 1.05 : 0.95,
      floor: lv,
      buildingId: spec.id,
    },
    {
      x: spec.cx + 4.4,
      y: ceilY - 0.45,
      z: spec.cz - 5.2,
      color: 0xffdca0,
      distance: 14,
      baseScale: 0.85,
      floor: lv,
      buildingId: spec.id,
    }
  );
}

function buildReserveStairwellLevel(
  lg: THREE.Group,
  pal: BankPalette,
  spec: DistrictBuildingSpec,
  lv: number,
  fy: number,
  M: MaterialLibrary
) {
  const vx0 = spec.cx + 5.1;
  const vx1 = spec.cx + 10.6;
  const xSpine = spec.cx + 7.85;
  const zNorth = spec.cz - 1.1;
  const zTurn = spec.cz + 4.65;
  const zSouth = spec.cz + 6.9;

  // Vertical 6-story Sovereign Gold-Ledger Lightwell Spine between Flight 1 & Flight 2
  boxAt(lg, 0.14, spec.floorH, 5.75, xSpine, fy + spec.floorH * 0.5, spec.cz + 1.78, pal.smokedWalnut, true, true, 0.015);
  [-0.8, 1.0, 2.8, 4.4].forEach((dz) => {
    boxAt(lg, 0.22, spec.floorH - 0.2, 0.08, xSpine, fy + spec.floorH * 0.5, spec.cz + dz, pal.sovereignBrass, false, false);
  });
  boxAt(lg, 0.04, spec.floorH, 5.4, xSpine - 0.08, fy + spec.floorH * 0.5, spec.cz + 1.78, pal.warmCoveLed, false, false);
  boxAt(lg, 0.04, spec.floorH, 5.4, xSpine + 0.08, fy + spec.floorH * 0.5, spec.cz + 1.78, pal.royalBlueLed, false, false);

  // Smoked-glass + Sovereign Brass perimeter balustrades along West shaft edge (dx +5.10) and South edge (dz +6.90)
  const addStairScreen = (cx: number, cz: number, lenX: number, lenZ: number, h: number) => {
    const isX = lenX >= lenZ;
    boxAt(lg, lenX, h - 0.12, lenZ, cx, fy + (h - 0.12) * 0.5 + 0.06, cz, pal.smokedGlass, false, false);
    boxAt(lg, isX ? lenX + 0.04 : 0.08, 0.06, isX ? 0.08 : lenZ + 0.04, cx, fy + h, cz, pal.sovereignBrass, false, false, 0.01);
    const posts = Math.max(2, Math.round(Math.max(lenX, lenZ) / 1.8) + 1);
    for (let p = 0; p < posts; p++) {
      const f = posts === 1 ? 0.5 : p / (posts - 1);
      const px = isX ? cx - lenX * 0.5 + f * lenX : cx;
      const pz = isX ? cz : cz - lenZ * 0.5 + f * lenZ;
      boxAt(lg, 0.05, h, 0.05, px, fy + h * 0.5, pz, pal.sovereignBrass, false, false);
    }
  };

  // West shaft balustrade (full length along dx +5.10)
  addStairScreen(vx0, spec.cz + 2.9, 0.05, 8.0, 1.06);

  if (lv === 0) {
    // Under-stair Nero-Marble & Brass Treasury divider blocking East under-flight lane at North mouth
    boxAt(lg, 2.66, 2.15, 0.14, spec.cx + 9.22, fy + 1.08, zNorth, pal.neroGoldMarble, true, true, 0.015);
    boxAt(lg, 2.68, 0.08, 0.16, spec.cx + 9.22, fy + 2.18, zNorth, pal.sovereignBrass, false, false);
    // Decorative brass-framed floor planter tucked into SE corner beside stair
    plant(lg, spec.cx + 4.3, fy, spec.cz + 6.3, 1.05, 501, M);
  } else {
    // Upper levels: South edge glass drop-guard + North-West West-lane drop-guard on top floor L5
    addStairScreen((vx0 + vx1) * 0.5, zSouth, vx1 - vx0, 0.05, 1.06);
    if (lv === spec.floors - 1) {
      addStairScreen(spec.cx + 6.45, zNorth, 2.65, 0.05, 1.06);
    }
  }

  // Flights connecting lv -> lv + 1
  if (lv < spec.floors - 1) {
    const halfRise = spec.floorH * 0.5;
    const runLen = zTurn - zNorth; // 5.75m
    const steps = 12;
    const stepD = runLen / steps;
    const stepH = halfRise / steps;

    // Flight 1 (West Lane: dx +5.18 .. +7.72, climbing South zNorth -> zTurn)
    const f1X = spec.cx + 6.45;
    const f1W = 2.48;
    for (let s = 0; s < steps; s++) {
      const sy = fy + (s + 0.5) * stepH;
      const sz = zNorth + (s + 0.5) * stepD;
      boxAt(lg, f1W, 0.11, stepD + 0.04, f1X, sy, sz, pal.stairTreadMat, true, true, 0.01);
      boxAt(lg, f1W, 0.02, 0.04, f1X, sy + 0.06, sz + stepD * 0.44, pal.sovereignBrass, false, false);
    }
    // Twin angled Sovereign Brass structural stringers beneath Flight 1
    [-0.95, 0.95].forEach((ox) => {
      const strLen = Math.hypot(runLen, halfRise);
      const stringer = boxAt(lg, 0.1, 0.18, strLen, f1X + ox, fy + halfRise * 0.5 - 0.12, (zNorth + zTurn) * 0.5, pal.sovereignBrass, false, false);
      stringer.rotation.x = -Math.atan2(halfRise, runLen);
    });

    // Mid-Level Panoramic South Sky-Landing (dz +4.65 .. +6.90)
    const landW = vx1 - vx0 - 0.16;
    const landD = zSouth - zTurn;
    boxAt(lg, landW, 0.22, landD, (vx0 + vx1) * 0.5, fy + halfRise - 0.09, (zTurn + zSouth) * 0.5, pal.neroGoldMarble, true, true, 0.02);
    boxAt(lg, landW + 0.04, 0.06, landD + 0.04, (vx0 + vx1) * 0.5, fy + halfRise - 0.21, (zTurn + zSouth) * 0.5, pal.sovereignBrass, false, false);

    // Flight 2 (East Lane against Glass Curtain Wall: dx +7.98 .. +10.52, climbing North zTurn -> zNorth)
    const f2X = spec.cx + 9.22;
    const f2W = 2.48;
    for (let s = 0; s < steps; s++) {
      const sy = fy + halfRise + (s + 0.5) * stepH;
      const sz = zTurn - (s + 0.5) * stepD;
      boxAt(lg, f2W, 0.11, stepD + 0.04, f2X, sy, sz, pal.stairTreadMat, true, true, 0.01);
      boxAt(lg, f2W, 0.02, 0.04, f2X, sy + 0.06, sz - stepD * 0.44, pal.sovereignBrass, false, false);
    }
    [-0.95, 0.95].forEach((ox) => {
      const strLen = Math.hypot(runLen, halfRise);
      const stringer = boxAt(lg, 0.1, 0.18, strLen, f2X + ox, fy + halfRise * 1.5 - 0.12, (zNorth + zTurn) * 0.5, pal.sovereignBrass, false, false);
      stringer.rotation.x = Math.atan2(halfRise, runLen);
    });

    addZonePlaque(lg, 'Reserve Gallery Stairs', `Ascend to L${lv + 1}`, spec.cx + 6.45, fy + 2.38, zNorth + 0.14, Math.PI);
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
  // SHARED COFFERED CEILINGS & CONTINUOUS 6-FLOOR RESERVE STAIRWELL (G..L5)
  // ============================================================================
  for (let lv = 0; lv < spec.floors; lv++) {
    const fy = spec.groundY + lv * spec.floorH + 0.12;
    const ceilY = spec.groundY + lv * spec.floorH + spec.floorH - 0.14;
    buildCofferedCeiling(levelCeilings[lv], pal, spec, ceilY, lv < spec.floors - 1, warmLights, lv);
    buildReserveStairwellLevel(levelGroups[lv], pal, spec, lv, fy, M);

    // Architectural Nero-Gold floor runner overlay on upper levels (leaving stair void open)
    if (lv >= 1) {
      boxAt(levelGroups[lv], 14.8, 0.025, 18.2, spec.cx - 2.6, fy + 0.014, spec.cz, pal.neroGoldMarble, false, true);
      boxAt(levelGroups[lv], 5.6, 0.025, 7.6, spec.cx + 7.6, fy + 0.014, spec.cz - 5.2, pal.neroGoldMarble, false, true);
    }
  }

  // ============================================================================
  // L0 (G) — PORTICO, SOVEREIGN BANKING HALL, 24/7 ATM VESTIBULE & BIOMETRIC VAULT
  // ============================================================================
  {
    // Bespoke Fluted Ivory Travertine Portico Columns + Brass Collars (exact obstacle coords!)
    [-3.8, -1.9, 1.9, 3.8].forEach((ox) => {
      boxAt(g0, 0.88, 0.22, 0.88, spec.doorX + ox, spec.groundY + 0.11, spec.doorZ + 1.4, pal.neroGoldMarble, true, true, 0.03);
      cylAt(g0, 0.31, 0.36, spec.floorH - 0.36, spec.doorX + ox, spec.groundY + 0.22 + (spec.floorH - 0.36) * 0.5, spec.doorZ + 1.4, pal.flutedTravertine, true, true, 20);
      cylAt(g0, 0.38, 0.32, 0.14, spec.doorX + ox, spec.groundY + spec.floorH - 0.16, spec.doorZ + 1.4, pal.sovereignBrass, false, false, 20);
    });
    const bankPortico = new THREE.Mesh(getRoundedSlabGeo(10.2, 3.1, 0.9, 0.38, 0.07), pal.ivoryTravertine);
    bankPortico.position.set(spec.doorX, spec.groundY + spec.floorH - 0.06, spec.doorZ + 1.05);
    bankPortico.castShadow = true;
    g0.add(bankPortico);
    boxAt(g0, 9.6, 0.08, 0.12, spec.doorX, spec.groundY + spec.floorH - 0.14, spec.doorZ + 2.58, pal.sovereignBrass, false, false);
    const bankSoffit = new THREE.Mesh(getRoundedSlabGeo(9.4, 2.5, 0.75, 0.06, 0.015), pal.smokedWalnut);
    bankSoffit.position.set(spec.doorX, spec.groundY + spec.floorH - 0.25, spec.doorZ + 1.05);
    g0.add(bankSoffit);
    addZonePlaque(g0, 'Nairobi Trust Bank', 'Reserve Commercial HQ · Est. 1998', spec.doorX, spec.groundY + spec.floorH + 0.22, spec.doorZ + 2.62, 0);

    // Full Nero-Gold Marble G Floor + Inlaid Sovereign Compass-Shield Brass Medallion
    boxAt(g0, 21.4, 0.025, 19.4, spec.cx, fy0 + 0.012, spec.cz, pal.neroGoldMarble, false, true);
    cylAt(g0, 2.8, 2.8, 0.018, spec.cx - 0.6, fy0 + 0.026, spec.cz + 1.4, pal.sovereignBrass, false, true, 32);
    cylAt(g0, 2.38, 2.38, 0.022, spec.cx - 0.6, fy0 + 0.028, spec.cz + 1.4, pal.neroGoldMarble, false, true, 32);
    cylAt(g0, 0.72, 0.72, 0.026, spec.cx - 0.6, fy0 + 0.03, spec.cz + 1.4, pal.sovereignBrass, false, true, 24);

    // Suspended Sovereign Brass Halo Chandelier over Main Banking Hall
    const haloRing = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.075, 12, 36), pal.sovereignBrass);
    haloRing.rotation.x = Math.PI / 2;
    haloRing.position.set(spec.cx - 0.6, fy0 + 3.45, spec.cz + 1.4);
    g0.add(haloRing);
    const haloGlow = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.03, 8, 36), pal.warmCoveLed);
    haloGlow.rotation.x = Math.PI / 2;
    haloGlow.position.set(spec.cx - 0.6, fy0 + 3.39, spec.cz + 1.4);
    g0.add(haloGlow);
    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2;
      cylAt(g0, 0.012, 0.012, 0.65, spec.cx - 0.6 + Math.cos(ang) * 1.75, fy0 + 3.76, spec.cz + 1.4 + Math.sin(ang) * 1.75, pal.sovereignBrass, false, false, 8);
    }

    // Fluted Monumental Interior Columns framing Banking Hall
    [
      [-7.8, -0.6],
      [2.6, -0.6],
      [2.6, 5.2],
    ].forEach(([cx, cz]) => buildFlutedBankColumn(g0, pal, spec.cx + cx, fy0, spec.cz + cz, spec.floorH - 0.32));

    // SW 24/7 Express ATM Vestibule & Bespoke Brass-Clad ATM Kiosks (dx -8.5, -6.5, -4.5, dz +6.2)
    boxAt(g0, 6.8, 0.06, 2.2, spec.cx - 6.5, fy0 + 2.85, spec.cz + 6.4, pal.smokedWalnut, false, false, 0.01);
    boxAt(g0, 6.8, 0.05, 0.08, spec.cx - 6.5, fy0 + 2.88, spec.cz + 5.3, pal.royalBlueLed, false, false);
    boxAt(g0, 0.14, 2.85, 2.2, spec.cx - 3.3, fy0 + 1.425, spec.cz + 6.4, pal.smokedGlass, false, false);
    boxAt(g0, 0.16, 2.85, 0.12, spec.cx - 3.3, fy0 + 1.425, spec.cz + 5.3, pal.sovereignBrass, false, false);
    addZonePlaque(g0, '24/7 Express ATM', 'Biometric Card & Cash Deposit', spec.cx - 6.5, fy0 + 2.6, spec.cz + 5.25, Math.PI);

    [-8.5, -6.5, -4.5].forEach((ox) => {
      const kg = new THREE.Group();
      kg.position.set(spec.cx + ox, fy0, spec.cz + 6.2);
      kg.rotation.y = Math.PI;
      boxAt(kg, 0.92, 1.98, 0.78, 0, 0.99, 0, pal.neroGoldMarble, true, true, 0.04);
      boxAt(kg, 0.86, 1.9, 0.06, 0, 0.99, 0.37, pal.sovereignBrass, false, false, 0.015);
      boxAt(kg, 0.72, 0.22, 0.04, 0, 1.72, 0.4, pal.royalBlueLed, false, false);
      boxAt(kg, 0.56, 0.44, 0.04, 0, 1.32, 0.41, new THREE.MeshBasicMaterial({ color: 0x1d4ed8 }), false, false);
      boxAt(kg, 0.64, 0.08, 0.24, 0, 0.96, 0.44, pal.titaniumVault, false, false, 0.01);
      g0.add(kg);
    });

    // Bi-Level Curved-Shoulder Travertine & Walnut Teller Counter (dx -2.4, dz -3.24..-3.98)
    boxAt(g0, 9.2, 1.1, 0.54, spec.cx - 2.4, fy0 + 0.55, spec.cz - 3.24, pal.flutedTravertine, true, true, 0.03);
    boxAt(g0, 9.45, 0.08, 0.66, spec.cx - 2.4, fy0 + 1.14, spec.cz - 3.24, pal.smokedWalnut, false, true, 0.02);
    boxAt(g0, 9.48, 0.03, 0.68, spec.cx - 2.4, fy0 + 1.09, spec.cz - 3.24, pal.sovereignBrass, false, false);
    boxAt(g0, 8.8, 0.74, 0.05, spec.cx - 2.4, fy0 + 1.55, spec.cz - 2.98, pal.frostedSecurityGlass, false, false);
    // Brass acoustic speak-through transom bars
    [-6.6, -4.6, -2.4, -0.2, 1.8].forEach((bx) => {
      boxAt(g0, 0.06, 0.78, 0.08, spec.cx + bx, fy0 + 1.55, spec.cz - 2.98, pal.sovereignBrass, false, false);
    });
    boxAt(g0, 9.2, 0.06, 0.94, spec.cx - 2.4, fy0 + 0.75, spec.cz - 3.98, pal.smokedWalnut, true, true, 0.015);
    [-6.8, -2.4, 2.0].forEach((lx) => {
      boxAt(g0, 0.14, 0.72, 0.78, spec.cx + lx, fy0 + 0.36, spec.cz - 3.92, pal.ivoryTravertine, true, true, 0.01);
    });
    [-4.6, -0.2].forEach((ox, i) => {
      buildBankersLamp(g0, pal, spec.cx + ox + 0.55, fy0 + 0.78, spec.cz - 3.72, 0);
      registerChair(0, spec.cx + ox, fy0, spec.cz - 4.75, 0, i === 0 ? 1 : -1);
      registerMonitor(
        0,
        monIdx++,
        [spec.cx + ox, fy0 + 0.78, spec.cz - 4.02],
        Math.PI,
        spec.cx + ox,
        spec.cz - 4.75,
        `Branch Teller ${i + 1}`,
        'Retail Banking & RTGS Hall'
      );
    });

    // Queue Velvet Stanchions flanking client lane (leaves bank-client-1 at dx -2.4, dz -1.8 open!)
    [-4.2, -0.6].forEach((sx) => {
      [-2.1, -0.6].forEach((sz) => {
        cylAt(g0, 0.14, 0.16, 0.04, spec.cx + sx, fy0 + 0.02, spec.cz + sz, pal.sovereignBrass, false, true, 12);
        cylAt(g0, 0.028, 0.028, 0.92, spec.cx + sx, fy0 + 0.48, spec.cz + sz, pal.sovereignBrass, true, false, 10);
        cylAt(g0, 0.045, 0.045, 0.06, spec.cx + sx, fy0 + 0.96, spec.cz + sz, pal.sovereignBrass, false, false, 12);
      });
      cylAt(g0, 0.022, 0.022, 1.5, spec.cx + sx, fy0 + 0.84, spec.cz - 1.35, pal.midnightNavyFelt, false, false, 8).rotation.x = Math.PI / 2;
    });

    // Live Interbank FX & CBK Treasury Wall Screen (North Wall behind tellers)
    const fxBoard = createCustomBoardScreen(screenReg, 680, 240, (g, w, h, t) => {
      g.fillStyle = '#070e1b';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#14294a';
      g.fillRect(0, 0, w, 38);
      g.fillStyle = '#d9ad58';
      g.fillRect(0, 38, w, 3);
      g.fillStyle = '#f8fafc';
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
        g.fillStyle = i % 2 === 0 ? 'rgba(59,130,246,0.12)' : 'rgba(217,173,88,0.08)';
        rr(g, 16, y, w - 32, 36, 5);
        g.fill();
        g.fillStyle = '#f8fafc';
        g.font = '700 16px "IBM Plex Mono", monospace';
        g.fillText(r[0], 28, y + 18);
        g.fillStyle = '#93c5fd';
        g.fillText(r[1], 235, y + 18);
        g.fillStyle = '#d9ad58';
        g.fillText(r[2], 395, y + 18);
        g.fillStyle = r[3].startsWith('-') ? '#fca5a5' : '#4ade80';
        g.fillText(r[3], w - 102, y + 18);
      });
      void t;
    });
    boxAt(g0, 6.0, 2.3, 0.16, spec.cx - 3.6, fy0 + 2.35, spec.cz - 9.72, pal.smokedWalnut, false, false, 0.02);
    boxAt(g0, 5.78, 2.1, 0.08, spec.cx - 3.6, fy0 + 2.35, spec.cz - 9.65, pal.sovereignBrass, false, false);
    const fxMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.95), fxBoard.mat);
    fxMesh.position.set(spec.cx - 3.6, fy0 + 2.35, spec.cz - 9.6);
    g0.add(fxMesh);
    fxBoard.setMesh(fxMesh);

    // HERO 12-PART EXPOSED TITANIUM & BRASS CIRCULAR BIOMETRIC VAULT DOOR (NE Rear Wall dx +6.2, dz -9.45)
    const vx = spec.cx + 6.2;
    const vz = spec.cz - 9.45;
    boxAt(g0, 4.3, 3.45, 0.65, vx, fy0 + 1.72, vz, pal.ivoryTravertine, true, true, 0.05);
    boxAt(g0, 3.85, 3.1, 0.5, vx, fy0 + 1.64, vz + 0.12, pal.neroGoldMarble, true, true, 0.04);
    const vaultBezel = cylAt(g0, 1.44, 1.44, 0.24, vx, fy0 + 1.62, vz + 0.38, pal.sovereignBrass, true, false, 32);
    vaultBezel.rotation.x = Math.PI / 2;
    const vaultDoor = cylAt(g0, 1.32, 1.32, 0.34, vx, fy0 + 1.62, vz + 0.42, pal.titaniumVault, true, false, 32);
    vaultDoor.rotation.x = Math.PI / 2;
    // 6 heavy locking titanium bolts radiating from door perimeter
    for (let b = 0; b < 6; b++) {
      const ba = (b * Math.PI) / 3;
      const bolt = cylAt(g0, 0.08, 0.08, 0.36, vx + Math.cos(ba) * 1.18, fy0 + 1.62 + Math.sin(ba) * 1.18, vz + 0.56, pal.titaniumVault, false, false, 12);
      bolt.rotation.z = ba + Math.PI / 2;
    }
    // Dual articulated hinge crane on right side
    boxAt(g0, 0.22, 2.2, 0.26, vx + 1.48, fy0 + 1.62, vz + 0.44, pal.titaniumVault, true, false, 0.02);
    boxAt(g0, 0.9, 0.14, 0.14, vx + 1.05, fy0 + 2.25, vz + 0.54, pal.sovereignBrass, false, false);
    boxAt(g0, 0.9, 0.14, 0.14, vx + 1.05, fy0 + 0.98, vz + 0.54, pal.sovereignBrass, false, false);
    // Rotating Sovereign Brass 3-Spoke Capstan Wheel + Time-Lock Glass Drum
    const capstanGroup = new THREE.Group();
    capstanGroup.position.set(vx, fy0 + 1.62, vz + 0.64);
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.048, 10, 24), pal.sovereignBrass);
    capstanGroup.add(wheelRim);
    for (let s = 0; s < 3; s++) {
      const spoke = boxAt(capstanGroup, 0.9, 0.06, 0.06, 0, 0, 0, pal.sovereignBrass, false, false);
      spoke.rotation.z = (s * Math.PI) / 3;
    }
    cylAt(capstanGroup, 0.18, 0.18, 0.12, 0, 0, 0.02, pal.neroGoldMarble, false, false, 16).rotation.x = Math.PI / 2;
    g0.add(capstanGroup);
    rotatingProps.push({ obj: capstanGroup, speed: 0.28, axis: 'z' });

    // Biometric iris scanner pedestals flanking vault
    [-1.85, 1.85].forEach((ox) => {
      cylAt(g0, 0.14, 0.18, 1.32, vx + ox, fy0 + 0.66, vz + 0.85, pal.neroGoldMarble, true, true, 16);
      boxAt(g0, 0.24, 0.28, 0.16, vx + ox, fy0 + 1.42, vz + 0.85, pal.sovereignBrass, false, false, 0.01);
      boxAt(g0, 0.16, 0.14, 0.04, vx + ox, fy0 + 1.44, vz + 0.94, pal.royalBlueLed, false, false);
    });
    addZonePlaque(g0, 'Treasury Vault I', 'Class-III Time-Lock & Bullion Safe', vx, fy0 + 3.18, vz + 0.42, 0);

    // Central Waiting Rotunda Lounge (Cognac Chesterfield Bench + Marble Pedestal Table)
    sofaWide(g0, spec.cx + 1.9, fy0, spec.cz + 4.4, -Math.PI / 2, pal.cognacLeather, M);
    cylAt(g0, 0.56, 0.56, 0.05, spec.cx + 0.3, fy0 + 0.44, spec.cz + 4.4, pal.neroGoldMarble, true, true, 24);
    cylAt(g0, 0.07, 0.14, 0.42, spec.cx + 0.3, fy0 + 0.21, spec.cz + 4.4, pal.sovereignBrass, false, false, 14);
    plant(g0, spec.cx - 9.6, fy0, spec.cz - 8.4, 1.15, 502, M);
    plant(g0, spec.cx - 9.6, fy0, spec.cz + 1.8, 1.0, 503, M);
  }

  // ============================================================================
  // L1 — RETAIL CREDIT, MORTGAGE ATELIER & SME ADVISORY LOUNGE
  // ============================================================================
  {
    const g1 = levelGroups[1];
    const fy1 = spec.groundY + spec.floorH + 0.12;

    // 2 Private Brass-Framed Glass Mortgage & Credit Suites (dx -10.1..-5.6 and -5.6..-1.1, dz -8.8..-2.2, Open South portals!)
    const wallH = spec.floorH - 0.55;
    boxAt(g1, 0.16, wallH, 6.6, spec.cx - 10.1, fy1 + wallH * 0.5, spec.cz - 5.5, pal.smokedGlass, false, false);
    boxAt(g1, 0.18, wallH, 6.6, spec.cx - 5.6, fy1 + wallH * 0.5, spec.cz - 5.5, pal.smokedGlass, false, false);
    boxAt(g1, 0.16, wallH, 6.6, spec.cx - 1.1, fy1 + wallH * 0.5, spec.cz - 5.5, pal.smokedGlass, false, false);
    // Brass vertical mullions
    [-10.1, -5.6, -1.1].forEach((mx) => {
      [-8.7, -5.5, -2.3].forEach((mz) => boxAt(g1, 0.2, wallH, 0.12, spec.cx + mx, fy1 + wallH * 0.5, spec.cz + mz, pal.sovereignBrass, false, false));
    });
    // South glass front flanking wide open 2.2m portals centered at dx -7.85 & dx -3.35
    [-9.5, -6.2, -5.0, -1.7].forEach((fx) => {
      boxAt(g1, 1.15, wallH, 0.14, spec.cx + fx, fy1 + wallH * 0.5, spec.cz - 2.2, pal.frostedSecurityGlass, false, false);
    });
    addZonePlaque(g1, 'Mortgage Atelier', 'Home & Commercial Financing', spec.cx - 7.85, fy1 + 2.48, spec.cz - 2.12, 0);
    addZonePlaque(g1, 'SME Credit Suite', 'Trade & Working Capital', spec.cx - 3.35, fy1 + 2.48, spec.cz - 2.12, 0);

    // Inside Booth 1 & Booth 2: Walnut desks + Advisor chairs (idx 2, 3) + Client armchairs
    [
      { dx: -7.9, role: 'Mortgage Structuring Advisor · L1', zone: 'Mortgage Atelier' },
      { dx: -3.3, role: 'SME Credit Officer · L1', zone: 'SME Credit Suite' },
    ].forEach((b, bi) => {
      buildExecutiveDesk(g1, pal, spec.cx + b.dx, fy1, spec.cz - 5.6, 2.3, 1.0, 0, true);
      registerChair(1, spec.cx + b.dx, fy1, spec.cz - 6.6, 0, bi % 2 === 0 ? 1 : -1);
      registerMonitor(
        1,
        monIdx++,
        [spec.cx + b.dx, fy1 + 0.78, spec.cz - 5.65],
        Math.PI,
        spec.cx + b.dx,
        spec.cz - 6.6,
        b.role,
        b.zone
      );
      armchair(g1, spec.cx + b.dx - 0.65, fy1, spec.cz - 4.15, Math.PI, pal.cognacLeather, M);
      armchair(g1, spec.cx + b.dx + 0.65, fy1, spec.cz - 4.15, Math.PI, pal.cognacLeather, M);
    });

    // Illuminated Architectural Property Financing Scale-Model Vitrine Table (SW dx -5.8, dz +5.2)
    boxAt(g1, 3.6, 0.86, 2.2, spec.cx - 5.8, fy1 + 0.43, spec.cz + 5.2, pal.ivoryTravertine, true, true, 0.03);
    boxAt(g1, 3.66, 0.08, 2.26, spec.cx - 5.8, fy1 + 0.89, spec.cz + 5.2, pal.sovereignBrass, false, false, 0.015);
    boxAt(g1, 3.3, 0.04, 1.9, spec.cx - 5.8, fy1 + 0.94, spec.cz + 5.2, pal.neroGoldMarble, false, true);
    // 6 miniature financed skyscrapers on city grid
    [
      [-6.8, 4.9, 0.56, 0.56, 0.62],
      [-5.8, 4.8, 0.64, 0.64, 0.92],
      [-4.8, 5.0, 0.52, 0.52, 0.54],
      [-6.5, 5.6, 0.48, 0.48, 0.42],
      [-5.6, 5.6, 0.54, 0.54, 0.74],
      [-4.6, 5.6, 0.46, 0.46, 0.48],
    ].forEach(([tx, tz, tw, td, th], ti) => {
      boxAt(g1, tw, th, td, spec.cx + tx, fy1 + 0.96 + th * 0.5, spec.cz + tz, ti % 2 === 0 ? pal.sovereignBrass : pal.ivoryTravertine, true, false, 0.01);
      boxAt(g1, tw * 0.85, 0.04, td * 0.85, spec.cx + tx, fy1 + 0.98 + th, spec.cz + tz, pal.royalBlueLed, false, false);
    });
    boxAt(g1, 3.4, 0.62, 2.0, spec.cx - 5.8, fy1 + 1.26, spec.cz + 5.2, pal.smokedGlass, false, false);

    // Retail Relationship Manager Desk (South-Center dx +0.6, dz +5.4)
    buildExecutiveDesk(g1, pal, spec.cx + 0.6, fy1, spec.cz + 5.4, 2.4, 1.0, Math.PI, true);
    registerChair(1, spec.cx + 0.6, fy1, spec.cz + 6.4, Math.PI, 1);
    registerMonitor(
      1,
      monIdx++,
      [spec.cx + 0.6, fy1 + 0.78, spec.cz + 5.35],
      0,
      spec.cx + 0.6,
      spec.cz + 6.4,
      'Retail Relationship Manager · L1',
      'Retail Credit & Advisory'
    );

    // Live Mortgage & SME Credit Rate Wall Display (West Wall)
    const creditBoard = createCustomBoardScreen(screenReg, 540, 220, (g, w, h, t) => {
      g.fillStyle = '#0a1220';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#d9ad58';
      g.fillRect(0, 0, w, 34);
      g.fillStyle = '#09111e';
      g.font = '800 17px "Plus Jakarta Sans", sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('MORTGAGE & SME CAPITAL BENCHMARKS', 16, 17);
      const items = [
        ['PRIME MORTGAGE KES', '12.90% p.a.', 'UP TO 25 YRS'],
        ['USD DIASPORA HOME', '8.25% p.a.', '90% LTV'],
        ['SME GREEN CAPEX', '10.40% p.a.', 'FAST-TRACK 72H'],
      ];
      items.forEach((it, i) => {
        const y = 52 + i * 50;
        g.fillStyle = 'rgba(217, 173, 88, 0.12)';
        rr(g, 16, y, w - 32, 42, 6);
        g.fill();
        g.fillStyle = '#f8fafc';
        g.font = '700 15px "IBM Plex Mono", monospace';
        g.fillText(it[0], 26, y + 21);
        g.fillStyle = '#60a5fa';
        g.fillText(it[1], 240, y + 21);
        g.fillStyle = '#d9ad58';
        g.fillText(it[2], 385, y + 21);
      });
      void t;
    });
    boxAt(g1, 0.14, 2.0, 4.4, spec.cx - 10.45, fy1 + 2.25, spec.cz + 5.2, pal.smokedWalnut, false, false);
    const crMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 1.72), creditBoard.mat);
    crMesh.rotation.y = Math.PI / 2;
    crMesh.position.set(spec.cx - 10.36, fy1 + 2.25, spec.cz + 5.2);
    g1.add(crMesh);
    creditBoard.setMesh(crMesh);

    // NE Hospitality Espresso & Signing Lounge (dx +3.2..+9.4, dz -8.8..-3.8)
    boxAt(g1, 3.8, 1.04, 1.0, spec.cx + 7.2, fy1 + 0.52, spec.cz - 8.4, pal.neroGoldMarble, true, true, 0.02);
    boxAt(g1, 3.88, 0.07, 1.08, spec.cx + 7.2, fy1 + 1.06, spec.cz - 8.4, pal.sovereignBrass, false, false);
    boxAt(g1, 0.65, 0.52, 0.45, spec.cx + 8.0, fy1 + 1.34, spec.cz - 8.4, pal.titaniumVault, true, false, 0.02);
    sofaWide(g1, spec.cx + 6.4, fy1, spec.cz - 4.8, 0, pal.cognacLeather, M);
    plant(g1, spec.cx + 9.4, fy1, spec.cz - 8.2, 1.0, 511, M);
    plant(g1, spec.cx - 9.6, fy1, spec.cz + 8.2, 1.0, 512, M);
  }

  // ============================================================================
  // L2 — INSTITUTIONAL FX TREASURY & SOVEREIGN BOND DEALING ROOM
  // ============================================================================
  {
    const g2 = levelGroups[2];
    const fy2 = spec.groundY + 2 * spec.floorH + 0.12;
    const ceilY2 = spec.groundY + 2 * spec.floorH + spec.floorH - 0.14;

    // Suspended Overhead Acoustic Walnut & Brass Dealing Ticker Canopy
    boxAt(g2, 7.6, 0.42, 0.36, spec.cx - 4.2, ceilY2 - 0.58, spec.cz - 0.4, pal.smokedWalnut, false, false, 0.02);
    boxAt(g2, 7.4, 0.08, 0.4, spec.cx - 4.2, ceilY2 - 0.78, spec.cz - 0.4, pal.royalBlueLed, false, false);

    // Dual Institutional Curved-Edge Multi-Screen Dealing Consoles
    [
      { z: -3.6, seatZ: -4.7, rotChair: 0, rotMon: Math.PI, roles: ['Lead FX Spot Trader · L2', 'Money Markets Dealer · L2'] },
      { z: 2.8, seatZ: 3.9, rotChair: Math.PI, rotMon: 0, roles: ['Sovereign Bond Strategist · L2', 'Treasury Liquidity Analyst · L2'] },
    ].forEach((row, ri) => {
      boxAt(g2, 7.2, 0.76, 1.18, spec.cx - 4.2, fy2 + 0.38, spec.cz + row.z, pal.midnightNavyFelt, true, true, 0.02);
      boxAt(g2, 7.4, 0.07, 1.28, spec.cx - 4.2, fy2 + 0.78, spec.cz + row.z, pal.smokedWalnut, true, true, 0.015);
      boxAt(g2, 7.44, 0.03, 1.3, spec.cx - 4.2, fy2 + 0.73, spec.cz + row.z, pal.sovereignBrass, false, false);
      boxAt(g2, 6.8, 0.28, 0.06, spec.cx - 4.2, fy2 + 0.94, spec.cz + row.z, pal.sovereignBrass, false, false);

      [-6.2, -2.2].forEach((dx, ci) => {
        buildBankersLamp(g2, pal, spec.cx + dx + 0.72, fy2 + 0.82, spec.cz + row.z, row.rotChair);
        registerChair(2, spec.cx + dx, fy2, spec.cz + row.seatZ, row.rotChair, ci === 0 ? 1 : -1);
        registerMonitor(
          2,
          monIdx++,
          [spec.cx + dx, fy2 + 0.82, spec.cz + row.z + (ri === 0 ? -0.16 : 0.16)],
          row.rotMon,
          spec.cx + dx,
          spec.cz + row.seatZ,
          row.roles[ci],
          'FX Treasury & Bond Dealing Room'
        );
      });
    });

    // Giant Live CBK T-Bill Auction, SOFR & East Africa Yield Wall Display (West Wall)
    const yieldBoard = createCustomBoardScreen(screenReg, 680, 260, (g, w, h, t) => {
      g.fillStyle = '#070f1d';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#1e3a8a';
      g.fillRect(0, 0, w, 36);
      g.fillStyle = '#f8fafc';
      g.font = '800 18px "Plus Jakarta Sans", sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('KENYA SOVEREIGN BOND & EAST AFRICA FX TELEMETRY', 18, 18);
      // Animated yield curve bars
      const tenors = ['91D', '182D', '364D', '2YR', '5YR', '10YR', '15YR'];
      const vals = [15.4, 15.85, 16.25, 16.9, 17.35, 17.8, 18.1];
      tenors.forEach((ten, i) => {
        const bx = 34 + i * 90;
        const bh = 45 + (vals[i] - 14) * 26 + Math.sin(t * 0.9 + i) * 3;
        g.fillStyle = '#3b82f6';
        rr(g, bx, h - 42 - bh, 52, bh, 4);
        g.fill();
        g.fillStyle = '#d9ad58';
        g.font = '700 13px "IBM Plex Mono", monospace';
        g.fillText(`${vals[i].toFixed(2)}%`, bx, h - 50 - bh);
        g.fillStyle = '#cbd5e1';
        g.fillText(ten, bx + 8, h - 22);
      });
    });
    boxAt(g2, 0.16, 2.4, 5.8, spec.cx - 10.45, fy2 + 2.2, spec.cz - 0.4, pal.smokedWalnut, false, false, 0.02);
    const yMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 2.15), yieldBoard.mat);
    yMesh.rotation.y = Math.PI / 2;
    yMesh.position.set(spec.cx - 10.35, fy2 + 2.2, spec.cz - 0.4);
    g2.add(yMesh);
    yieldBoard.setMesh(yMesh);
    addZonePlaque(g2, 'FX Treasury Floor', 'Interbank Spot · Sovereign Bonds', spec.cx - 10.32, fy2 + 3.55, spec.cz - 0.4, Math.PI / 2);

    // NE Quantitative Risk & Treasury Settlement Desk (dx +5.2, dz -6.6)
    boxAt(g2, 0.14, 2.8, 5.4, spec.cx + 2.0, fy2 + 1.4, spec.cz - 6.6, pal.smokedGlass, false, false);
    buildExecutiveDesk(g2, pal, spec.cx + 5.2, fy2, spec.cz - 6.6, 2.5, 1.05, 0, true);
    registerChair(2, spec.cx + 5.2, fy2, spec.cz - 7.6, 0, 1);
    registerMonitor(
      2,
      monIdx++,
      [spec.cx + 5.2, fy2 + 0.78, spec.cz - 6.65],
      Math.PI,
      spec.cx + 5.2,
      spec.cz - 7.6,
      'Treasury Risk Quant · L2',
      'Quantitative Hedging Alcove'
    );
    plant(g2, spec.cx + 9.2, fy2, spec.cz - 8.2, 1.0, 521, M);
    plant(g2, spec.cx - 9.4, fy2, spec.cz + 8.0, 1.0, 522, M);
  }

  // ============================================================================
  // L3 — PRIVATE WEALTH MANAGEMENT, FAMILY OFFICE & GOLD-BULLION SAFE DEPOSIT GALLERY
  // ============================================================================
  {
    const g3 = levelGroups[3];
    const fy3 = spec.groundY + 3 * spec.floorH + 0.12;
    const wallH3 = spec.floorH - 0.55;

    // NW Safe Deposit Viewing Sanctuary (dx -10.2..-2.2, dz -9.2..-1.8, Open South Doorway dx -7.4..-5.0!)
    boxAt(g3, 0.18, wallH3, 7.4, spec.cx - 10.2, fy3 + wallH3 * 0.5, spec.cz - 5.5, pal.smokedGlass, false, false);
    boxAt(g3, 0.18, wallH3, 7.4, spec.cx - 2.2, fy3 + wallH3 * 0.5, spec.cz - 5.5, pal.smokedGlass, false, false);
    boxAt(g3, 2.8, wallH3, 0.18, spec.cx - 8.8, fy3 + wallH3 * 0.5, spec.cz - 1.8, pal.frostedSecurityGlass, false, false);
    boxAt(g3, 2.8, wallH3, 0.18, spec.cx - 3.6, fy3 + wallH3 * 0.5, spec.cz - 1.8, pal.frostedSecurityGlass, false, false);
    // Brass doorway pilasters
    [-7.4, -5.0].forEach((px) => boxAt(g3, 0.12, wallH3, 0.22, spec.cx + px, fy3 + wallH3 * 0.5, spec.cz - 1.8, pal.sovereignBrass, false, false));
    addZonePlaque(g3, 'Safe Deposit Gallery', 'Dual-Key Custody & Bullion Assay', spec.cx - 6.2, fy3 + 2.55, spec.cz - 1.66, 0);

    // Backlit Brushed-Titanium & Brass Safe-Deposit Locker Matrix Wall along North wall of enclosure
    boxAt(g3, 6.8, 2.72, 0.48, spec.cx - 6.2, fy3 + 1.36, spec.cz - 8.95, pal.titaniumVault, true, true, 0.03);
    boxAt(g3, 6.4, 2.42, 0.06, spec.cx - 6.2, fy3 + 1.36, spec.cz - 8.68, pal.lockerFaceMat, false, false);
    boxAt(g3, 6.5, 0.05, 0.12, spec.cx - 6.2, fy3 + 2.66, spec.cz - 8.65, pal.warmCoveLed, false, false);

    // Centered Dual-Key Nero-Marble Bullion Examination Table with Velvet Tray & 24K Gold Ingots!
    boxAt(g3, 1.85, 0.88, 1.1, spec.cx - 6.2, fy3 + 0.44, spec.cz - 5.4, pal.neroGoldMarble, true, true, 0.02);
    boxAt(g3, 1.9, 0.06, 1.15, spec.cx - 6.2, fy3 + 0.9, spec.cz - 5.4, pal.sovereignBrass, false, false, 0.01);
    boxAt(g3, 0.95, 0.04, 0.62, spec.cx - 6.2, fy3 + 0.95, spec.cz - 5.4, pal.midnightNavyFelt, false, false);
    // 4 stacked 24K bullion bars under acrylic vitrine
    [-0.22, 0.0, 0.22].forEach((bx) => {
      boxAt(g3, 0.14, 0.08, 0.34, spec.cx - 6.2 + bx, fy3 + 1.01, spec.cz - 5.4, pal.goldBullion, true, false, 0.01);
    });
    boxAt(g3, 0.14, 0.08, 0.34, spec.cx - 6.2, fy3 + 1.09, spec.cz - 5.4, pal.goldBullion, true, false, 0.01);
    boxAt(g3, 1.05, 0.36, 0.72, spec.cx - 6.2, fy3 + 1.12, spec.cz - 5.4, pal.smokedGlass, false, false);

    // SW Private Wealth Parlor: Walnut Library Credenza, Sofa Lounge & Wealth Director Desk
    boxAt(g3, 0.56, 2.7, 3.8, spec.cx - 9.95, fy3 + 1.35, spec.cz + 5.2, pal.smokedWalnut, true, true, 0.02);
    [0.75, 1.45, 2.15].forEach((shY) => {
      boxAt(g3, 0.58, 0.04, 3.6, spec.cx - 9.9, fy3 + shY, spec.cz + 5.2, pal.sovereignBrass, false, false);
    });
    sofaWide(g3, spec.cx - 6.8, fy3, spec.cz + 6.4, Math.PI, pal.cognacLeather, M);
    buildExecutiveDesk(g3, pal, spec.cx - 2.6, fy3, spec.cz + 4.6, 2.4, 1.0, Math.PI, true);
    registerChair(3, spec.cx - 2.6, fy3, spec.cz + 5.6, Math.PI, -1);
    registerMonitor(
      3,
      monIdx++,
      [spec.cx - 2.6, fy3 + 0.78, spec.cz + 4.55],
      0,
      spec.cx - 2.6,
      spec.cz + 5.6,
      'Private Wealth Director · L3',
      'Private Wealth Parlor'
    );

    // NE Family Office & Trust Fiduciary Pods (dx +3.2 & +7.2, dz -6.6)
    [
      { dx: 3.2, role: 'Trust & Estate Fiduciary · L3', zone: 'Family Office Advisory' },
      { dx: 7.2, role: 'Portfolio Strategist · L3', zone: 'Family Office Advisory' },
    ].forEach((p, pi) => {
      buildExecutiveDesk(g3, pal, spec.cx + p.dx, fy3, spec.cz - 6.6, 2.3, 1.0, 0, true);
      registerChair(3, spec.cx + p.dx, fy3, spec.cz - 7.6, 0, pi % 2 === 0 ? 1 : -1);
      registerMonitor(
        3,
        monIdx++,
        [spec.cx + p.dx, fy3 + 0.78, spec.cz - 6.65],
        Math.PI,
        spec.cx + p.dx,
        spec.cz - 7.6,
        p.role,
        p.zone
      );
    });
    plant(g3, spec.cx + 9.2, fy3, spec.cz - 8.4, 1.0, 531, M);
    plant(g3, spec.cx - 9.2, fy3, spec.cz + 8.2, 1.0, 532, M);
  }

  // ============================================================================
  // L4 — RISK GOVERNANCE, INTERNAL AUDIT, AML COMPLIANCE & SWIFT OPERATIONS HUB
  // ============================================================================
  {
    const g4 = levelGroups[4];
    const fy4 = spec.groundY + 4 * spec.floorH + 0.12;
    const wallH4 = spec.floorH - 0.55;

    // NW SWIFT & AML Screening Operations Center (dx -9.8..-0.6, dz -8.6..+0.6, open South portal dx -6.4..-4.0)
    boxAt(g4, 0.16, wallH4, 9.2, spec.cx - 9.8, fy4 + wallH4 * 0.5, spec.cz - 4.0, pal.smokedGlass, false, false);
    boxAt(g4, 0.16, wallH4, 9.2, spec.cx - 0.6, fy4 + wallH4 * 0.5, spec.cz - 4.0, pal.smokedGlass, false, false);
    boxAt(g4, 3.4, wallH4, 0.16, spec.cx - 8.1, fy4 + wallH4 * 0.5, spec.cz + 0.6, pal.frostedSecurityGlass, false, false);
    boxAt(g4, 3.4, wallH4, 0.16, spec.cx - 2.3, fy4 + wallH4 * 0.5, spec.cz + 0.6, pal.frostedSecurityGlass, false, false);
    [-6.4, -4.0].forEach((px) => boxAt(g4, 0.12, wallH4, 0.2, spec.cx + px, fy4 + wallH4 * 0.5, spec.cz + 0.6, pal.sovereignBrass, false, false));
    addZonePlaque(g4, 'SWIFT & AML Ops', 'ISO-20022 Clearing & Sanctions Hub', spec.cx - 5.2, fy4 + 2.55, spec.cz + 0.72, 0);

    // Live SWIFT & AML Regional Clearing Wall Display
    const swiftBoard = createCustomBoardScreen(screenReg, 640, 230, (g, w, h, t) => {
      g.fillStyle = '#07111e';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#0f2942';
      g.fillRect(0, 0, w, 34);
      g.fillStyle = '#60a5fa';
      g.font = '800 17px "Plus Jakarta Sans", sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('SWIFT ISO-20022 & AML COMPLIANCE SCREENING MATRIX', 16, 17);
      const metrics = [
        ['RTGS CLEARING VOLUME', 'KES 48.2B', '99.98% SLA'],
        ['SWIFT MT/MX MESSAGES', '14,820 / HR', 'ZERO QUEUE'],
        ['AML SANCTIONS ENGINE', '0 CRITICAL', 'AUTO-VERIFIED'],
      ];
      metrics.forEach((m, i) => {
        const y = 52 + i * 52;
        g.fillStyle = 'rgba(59, 130, 246, 0.14)';
        rr(g, 16, y, w - 32, 44, 6);
        g.fill();
        g.fillStyle = '#f8fafc';
        g.font = '700 15px "IBM Plex Mono", monospace';
        g.fillText(m[0], 28, y + 22);
        g.fillStyle = '#d9ad58';
        g.fillText(m[1], 300, y + 22);
        g.fillStyle = '#4ade80';
        g.fillText(m[2], 470, y + 22);
      });
      void t;
    });
    boxAt(g4, 5.8, 2.2, 0.16, spec.cx - 5.2, fy4 + 2.25, spec.cz - 8.38, pal.smokedWalnut, false, false, 0.02);
    const swMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.92), swiftBoard.mat);
    swMesh.position.set(spec.cx - 5.2, fy4 + 2.25, spec.cz - 8.28);
    g4.add(swMesh);
    swiftBoard.setMesh(swMesh);

    [
      { dx: -7.4, role: 'SWIFT Settlement Officer · L4' },
      { dx: -3.0, role: 'AML Sanctions Analyst · L4' },
    ].forEach((s, si) => {
      buildExecutiveDesk(g4, pal, spec.cx + s.dx, fy4, spec.cz - 4.2, 2.4, 1.0, Math.PI, true);
      registerChair(4, spec.cx + s.dx, fy4, spec.cz - 3.2, Math.PI, si === 0 ? 1 : -1);
      registerMonitor(
        4,
        monIdx++,
        [spec.cx + s.dx, fy4 + 0.78, spec.cz - 4.25],
        0,
        spec.cx + s.dx,
        spec.cz - 3.2,
        s.role,
        'SWIFT & AML Operations Hub'
      );
    });

    // SW Audit Committee Table + Archival Compliance Steel Cabinets
    boxAt(g4, 5.2, 0.08, 1.8, spec.cx - 4.6, fy4 + 0.74, spec.cz + 5.4, pal.smokedWalnut, true, true, 0.02);
    [-6.6, -2.6].forEach((px) => boxAt(g4, 0.24, 0.7, 1.1, spec.cx + px, fy4 + 0.35, spec.cz + 5.4, pal.ivoryTravertine, true, true, 0.02));
    boxAt(g4, 0.65, 2.35, 3.8, spec.cx - 10.1, fy4 + 1.175, spec.cz + 5.4, pal.titaniumVault, true, true, 0.02);

    registerChair(4, spec.cx - 6.4, fy4, spec.cz + 4.0, 0, 1);
    registerMonitor(
      4,
      monIdx++,
      [spec.cx - 6.4, fy4 + 0.8, spec.cz + 4.85],
      Math.PI,
      spec.cx - 6.4,
      spec.cz + 4.0,
      'Internal Audit Director · L4',
      'Audit Committee Chamber'
    );
    registerChair(4, spec.cx - 2.8, fy4, spec.cz + 6.8, Math.PI, -1);
    registerMonitor(
      4,
      monIdx++,
      [spec.cx - 2.8, fy4 + 0.8, spec.cz + 5.95],
      0,
      spec.cx - 2.8,
      spec.cz + 6.8,
      'Chief Compliance Officer · L4',
      'Audit Committee Chamber'
    );

    // NE Operational Risk Lead Desk (dx +5.8, dz -6.4)
    buildExecutiveDesk(g4, pal, spec.cx + 5.8, fy4, spec.cz - 6.4, 2.5, 1.05, 0, true);
    registerChair(4, spec.cx + 5.8, fy4, spec.cz - 7.4, 0, 1);
    registerMonitor(
      4,
      monIdx++,
      [spec.cx + 5.8, fy4 + 0.78, spec.cz - 6.45],
      Math.PI,
      spec.cx + 5.8,
      spec.cz - 7.4,
      'Operational Risk Lead · L4',
      'Regulatory Risk Directorate'
    );
    plant(g4, spec.cx + 9.2, fy4, spec.cz - 8.2, 1.0, 541, M);
    plant(g4, spec.cx + 2.6, fy4, spec.cz + 8.0, 1.0, 542, M);
  }

  // ============================================================================
  // L5 — EXECUTIVE BOARDROOM, GOVERNOR/CEO PENTHOUSE SUITE & RESERVE SKY-BAR
  // ============================================================================
  {
    const g5 = levelGroups[5];
    const fy5 = spec.groundY + 5 * spec.floorH + 0.12;
    const wallH5 = spec.floorH - 0.55;

    // Monumental West Executive Bank Boardroom Enclosure (dx -10.0..-0.8, dz -8.8..+1.2, open East doorway dz -5.0..-2.6)
    boxAt(g5, 9.2, wallH5, 0.18, spec.cx - 5.4, fy5 + wallH5 * 0.5, spec.cz - 8.8, pal.midnightNavyFelt, true, false);
    boxAt(g5, 9.2, wallH5, 0.18, spec.cx - 5.4, fy5 + wallH5 * 0.5, spec.cz + 1.2, pal.smokedGlass, false, false);
    boxAt(g5, 0.18, wallH5, 3.8, spec.cx - 0.8, fy5 + wallH5 * 0.5, spec.cz - 6.9, pal.smokedGlass, false, false);
    boxAt(g5, 0.18, wallH5, 3.8, spec.cx - 0.8, fy5 + wallH5 * 0.5, spec.cz - 0.7, pal.smokedGlass, false, false);
    [-5.0, -2.6].forEach((pz) => boxAt(g5, 0.22, wallH5, 0.12, spec.cx - 0.8, fy5 + wallH5 * 0.5, spec.cz + pz, pal.sovereignBrass, false, false));
    addZonePlaque(g5, 'Executive Boardroom', 'Bank Directorate & Monetary Policy', spec.cx - 0.66, fy5 + 2.55, spec.cz - 3.8, Math.PI / 2);

    // 5.6m Bookmatched Nero-Gold Marble & Brass-Inlay Boardroom Table
    boxAt(g5, 5.6, 0.08, 2.0, spec.cx - 5.4, fy5 + 0.75, spec.cz - 3.8, pal.neroGoldMarble, true, true, 0.025);
    boxAt(g5, 5.66, 0.03, 2.06, spec.cx - 5.4, fy5 + 0.7, spec.cz - 3.8, pal.sovereignBrass, false, false);
    boxAt(g5, 4.2, 0.02, 0.55, spec.cx - 5.4, fy5 + 0.8, spec.cz - 3.8, pal.midnightNavyFelt, false, false);
    [-7.2, -3.6].forEach((lx) => boxAt(g5, 0.36, 0.7, 1.15, spec.cx + lx, fy5 + 0.35, spec.cz - 3.8, pal.ivoryTravertine, true, true, 0.02));

    // 4 Registered Active Board Chairs + Monitors on Boardroom Table
    const boardRoles = [
      { dx: -7.0, dz: -5.2, mdz: -4.4, rotC: 0, rotM: Math.PI, role: 'Board Chairperson · L5' },
      { dx: -3.8, dz: -5.2, mdz: -4.4, rotC: 0, rotM: Math.PI, role: 'Chief Risk Officer · L5' },
      { dx: -7.0, dz: -2.4, mdz: -3.2, rotC: Math.PI, rotM: 0, role: 'Managing Director · L5' },
      { dx: -3.8, dz: -2.4, mdz: -3.2, rotC: Math.PI, rotM: 0, role: 'General Counsel · L5' },
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
        'Executive Bank Boardroom'
      );
    });

    // Sovereign Capital Strategy Boardroom Screen on West Boardroom Wall
    const execBoard = createCustomBoardScreen(screenReg, 620, 230, (g, w, h, t) => {
      g.fillStyle = '#080e1a';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#d9ad58';
      g.fillRect(0, 0, w, 34);
      g.fillStyle = '#080e1a';
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
        g.fillStyle = 'rgba(217, 173, 88, 0.12)';
        rr(g, 16, y, w - 32, 44, 6);
        g.fill();
        g.fillStyle = '#f8fafc';
        g.font = '700 15px "IBM Plex Mono", monospace';
        g.fillText(k[0], 26, y + 22);
        g.fillStyle = '#60a5fa';
        g.fillText(k[1], 295, y + 22);
        g.fillStyle = '#d9ad58';
        g.fillText(k[2], 445, y + 22);
      });
      void t;
    });
    boxAt(g5, 0.16, 2.2, 5.2, spec.cx - 9.88, fy5 + 2.2, spec.cz - 3.8, pal.smokedWalnut, false, false, 0.02);
    const ebMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 1.9), execBoard.mat);
    ebMesh.rotation.y = Math.PI / 2;
    ebMesh.position.set(spec.cx - 9.78, fy5 + 2.2, spec.cz - 3.8);
    g5.add(ebMesh);
    execBoard.setMesh(ebMesh);

    // SW Governor / Group CEO Corner Penthouse Suite (dx -6.2, dz +6.2)
    boxAt(g5, 0.56, 2.75, 4.0, spec.cx - 9.95, fy5 + 1.375, spec.cz + 6.0, pal.smokedWalnut, true, true, 0.02);
    [0.75, 1.45, 2.15].forEach((shY) => {
      boxAt(g5, 0.58, 0.04, 3.8, spec.cx - 9.9, fy5 + shY, spec.cz + 6.0, pal.sovereignBrass, false, false);
    });
    buildExecutiveDesk(g5, pal, spec.cx - 6.2, fy5, spec.cz + 6.2, 2.8, 1.12, Math.PI, true);
    registerChair(5, spec.cx - 6.2, fy5, spec.cz + 7.2, Math.PI, 1);
    registerMonitor(
      5,
      monIdx++,
      [spec.cx - 6.2, fy5 + 0.78, spec.cz + 6.15],
      0,
      spec.cx - 6.2,
      spec.cz + 7.2,
      'Group CEO · Nairobi Trust Bank · L5',
      'Governor & CEO Penthouse Suite'
    );
    armchair(g5, spec.cx - 2.8, fy5, spec.cz + 5.8, -Math.PI / 2, pal.cognacLeather, M);
    cylAt(g5, 0.42, 0.42, 0.04, spec.cx - 3.6, fy5 + 0.44, spec.cz + 5.8, pal.neroGoldMarble, false, true, 16);
    cylAt(g5, 0.05, 0.1, 0.42, spec.cx - 3.6, fy5 + 0.21, spec.cz + 5.8, pal.sovereignBrass, false, false, 12);

    // NE CFO Suite + Nero-Marble & Brass Private Hospitality Sky-Bar
    buildExecutiveDesk(g5, pal, spec.cx + 2.8, fy5, spec.cz - 6.6, 2.4, 1.0, 0, true);
    registerChair(5, spec.cx + 2.8, fy5, spec.cz - 7.6, 0, -1);
    registerMonitor(
      5,
      monIdx++,
      [spec.cx + 2.8, fy5 + 0.78, spec.cz - 6.65],
      Math.PI,
      spec.cx + 2.8,
      spec.cz - 7.6,
      'Chief Financial Officer · L5',
      'CFO Capital Directorate'
    );

    boxAt(g5, 3.8, 1.06, 0.96, spec.cx + 7.4, fy5 + 0.53, spec.cz - 7.6, pal.neroGoldMarble, true, true, 0.02);
    boxAt(g5, 3.88, 0.07, 1.04, spec.cx + 7.4, fy5 + 1.08, spec.cz - 7.6, pal.sovereignBrass, false, false);
    boxAt(g5, 0.65, 0.52, 0.45, spec.cx + 8.4, fy5 + 1.36, spec.cz - 7.6, pal.sovereignBrass, true, false, 0.02);
    plant(g5, spec.cx + 9.4, fy5, spec.cz - 5.2, 1.05, 551, M);
    plant(g5, spec.cx + 3.2, fy5, spec.cz + 7.4, 1.0, 552, M);
  }

  // ============================================================================
  // ROOFTOP CROWN — SOVEREIGN RESERVE SKY-ROTUNDA & BRASS VAULT LANTERN
  // ============================================================================
  {
    const roofY = spec.groundY + spec.h;
    const roofDeck = new THREE.Mesh(
      getRoundedSlabGeo(spec.w + 2.6, spec.d + 2.6, 3.1, 0.36, 0.08),
      pal.ivoryTravertine
    );
    roofDeck.position.set(spec.cx, roofY + 0.05, spec.cz);
    roofDeck.castShadow = true;
    roofDeck.receiveShadow = true;
    roofShellGroup.add(roofDeck);
    pickMeshes.push(roofDeck);

    // Smoked-glass rooftop balustrade with brass cap rail
    boxAt(roofShellGroup, spec.w + 1.8, 0.06, 0.12, spec.cx, roofY + 1.15, spec.cz + spec.d * 0.5 + 0.95, pal.sovereignBrass, false, false);
    boxAt(roofShellGroup, spec.w + 1.8, 0.06, 0.12, spec.cx, roofY + 1.15, spec.cz - spec.d * 0.5 - 0.95, pal.sovereignBrass, false, false);

    // Central Octagonal Travertine & Brass Reserve Lantern Cupola
    const rotX = spec.cx - 2.2;
    const rotZ = spec.cz - 1.2;
    cylAt(roofShellGroup, 4.4, 4.6, 0.24, rotX, roofY + 0.34, rotZ, pal.neroGoldMarble, true, true, 8);
    cylAt(roofShellGroup, 3.6, 3.6, 2.2, rotX, roofY + 1.56, rotZ, pal.smokedGlass, false, false, 8);
    for (let p = 0; p < 8; p++) {
      const ang = (p * Math.PI) / 4;
      cylAt(roofShellGroup, 0.14, 0.16, 2.4, rotX + Math.cos(ang) * 3.55, roofY + 1.58, rotZ + Math.sin(ang) * 3.55, pal.flutedTravertine, true, false, 12);
    }
    cylAt(roofShellGroup, 4.3, 3.8, 0.42, rotX, roofY + 2.86, rotZ, pal.ivoryTravertine, true, false, 8);
    cylAt(roofShellGroup, 2.8, 3.1, 0.34, rotX, roofY + 3.22, rotZ, pal.sovereignBrass, true, false, 8);
    // Illuminated Sovereign Vault Compass Crown atop Cupola
    const skyHalo = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 10, 28), pal.sovereignBrass);
    skyHalo.rotation.x = Math.PI / 2;
    skyHalo.position.set(rotX, roofY + 3.68, rotZ);
    roofShellGroup.add(skyHalo);
    rotatingProps.push({ obj: skyHalo, speed: 0.22, axis: 'y' });

    // Stairwell Penthouse Bulkhead above East Stair Void
    boxAt(roofShellGroup, 5.4, 2.1, 7.6, spec.cx + 7.85, roofY + 1.26, spec.cz + 2.9, pal.ivoryTravertine, true, true, 0.05);
    boxAt(roofShellGroup, 5.7, 0.22, 7.9, spec.cx + 7.85, roofY + 2.38, spec.cz + 2.9, pal.sovereignBrass, true, false, 0.03);

    // Sculpted Terrace Planters
    [-7.6, -2.2, 3.2].forEach((px, pi) => {
      boxAt(roofShellGroup, 1.4, 0.62, 1.4, spec.cx + px, roofY + 0.54, spec.cz + spec.d * 0.36, pal.neroGoldMarble, true, true, 0.02);
      plant(roofShellGroup, spec.cx + px, roofY + 0.86, spec.cz + spec.d * 0.36, 1.2, 560 + pi, M);
    });
    downlight(roofShellGroup, rotX, roofY + 2.6, rotZ, M, 0.35);
    void frameDarkMat;
    void archMats;
  }

  // Keep floor surface height aligned cleanly
  void getRoundedBox;
  void contact;
}
