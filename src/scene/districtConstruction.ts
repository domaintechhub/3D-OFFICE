import * as THREE from 'three';
import { buildPlanterTrough, type ArchitecturalMaterials } from './architecturalForms';
import type { DistrictBuildingSpec } from './districtData';
import type { MaterialLibrary } from './materials';
import { boxAt, cylAt, downlight } from './props';
import { getMaxAnisotropy, makeCanvasTex } from './textures';

export interface DistrictConstructionContext {
  spec: DistrictBuildingSpec;
  levelGroups: THREE.Group[];
  roofShellGroup: THREE.Group;
  M: MaterialLibrary;
  archMats: ArchitecturalMaterials;
  frameDarkMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  rotatingProps: Array<{ obj: THREE.Object3D; speed: number; axis: 'x' | 'y' | 'z' }>;
  pickMeshes: THREE.Object3D[];
}

interface ConstructionPalette {
  galvanizedSteel: THREE.MeshStandardMaterial;
  structuralBlackSteel: THREE.MeshStandardMaterial;
  brushedTitanium: THREE.MeshStandardMaterial;
  copperFlashing: THREE.MeshStandardMaterial;
  concretePlinth: THREE.MeshStandardMaterial;
  louverAluminum: THREE.MeshStandardMaterial;
  solarPvCell: THREE.MeshStandardMaterial;
  safetyYellow: THREE.MeshStandardMaterial;
  hvacHousing: THREE.MeshStandardMaterial;
  ductSpiral: THREE.MeshStandardMaterial;
  dockRubber: THREE.MeshStandardMaterial;
  beaconRed: THREE.MeshBasicMaterial;
  beaconGreen: THREE.MeshBasicMaterial;
  beaconAmber: THREE.MeshBasicMaterial;
  emeraldLed: THREE.MeshBasicMaterial;
  medicalTealLed: THREE.MeshBasicMaterial;
  skyCyanLed: THREE.MeshBasicMaterial;
  helipadSurface: THREE.MeshStandardMaterial;
}

let cachedConstPal: ConstructionPalette | null = null;

function getConstructionPalette(M: MaterialLibrary): ConstructionPalette {
  if (cachedConstPal) return cachedConstPal;
  const aniso = getMaxAnisotropy();

  const solarTex = makeCanvasTex('dist_const_solar_pv', 256, 256, (g, W, H) => {
    g.fillStyle = '#0d1b2a';
    g.fillRect(0, 0, W, H);
    const cols = 6;
    const rows = 8;
    const cw = W / cols;
    const ch = H / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle = (r + c) % 2 === 0 ? '#142b47' : '#183354';
        g.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
      }
    }
    g.strokeStyle = 'rgba(186,230,253,0.34)';
    g.lineWidth = 1.5;
    for (let c = 1; c < cols; c++) {
      g.beginPath();
      g.moveTo(c * cw, 0);
      g.lineTo(c * cw, H);
      g.stroke();
    }
    for (let r = 1; r < rows; r++) {
      g.beginPath();
      g.moveTo(0, r * ch);
      g.lineTo(W, r * ch);
      g.stroke();
    }
  });
  solarTex.colorSpace = THREE.SRGBColorSpace;
  solarTex.anisotropy = aniso;

  const helipadTex = makeCanvasTex('dist_const_helipad_h', 256, 256, (g, W, H) => {
    g.fillStyle = '#334155';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#facc15';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(W * 0.5, H * 0.5, 102, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#e2e8f0';
    g.lineWidth = 4;
    g.setLineDash([14, 10]);
    g.beginPath();
    g.arc(W * 0.5, H * 0.5, 84, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#ffffff';
    g.fillRect(W * 0.34, H * 0.27, 20, H * 0.46);
    g.fillRect(W * 0.66 - 20, H * 0.27, 20, H * 0.46);
    g.fillRect(W * 0.34, H * 0.46, W * 0.32, 20);
  });
  helipadTex.colorSpace = THREE.SRGBColorSpace;
  helipadTex.anisotropy = aniso;

  const ductTex = makeCanvasTex('dist_const_spiral_duct', 128, 128, (g, W, H) => {
    g.fillStyle = '#adb7c2';
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 16) {
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(0, y, W, 3);
      g.fillStyle = 'rgba(30,41,59,0.24)';
      g.fillRect(0, y + 12, W, 2);
    }
  });
  ductTex.colorSpace = THREE.SRGBColorSpace;
  ductTex.wrapS = ductTex.wrapT = THREE.RepeatWrapping;
  ductTex.repeat.set(1, 3);
  ductTex.anisotropy = aniso;

  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);

  cachedConstPal = {
    galvanizedSteel: std({ color: 0x7c8794, roughness: 0.36, metalness: 0.78, envMapIntensity: 0.65 }),
    structuralBlackSteel: std({ color: 0x222933, roughness: 0.42, metalness: 0.76, envMapIntensity: 0.52 }),
    brushedTitanium: std({ color: 0xc2cbd4, roughness: 0.26, metalness: 0.86, envMapIntensity: 0.78 }),
    copperFlashing: std({ color: 0xc87144, roughness: 0.3, metalness: 0.86, envMapIntensity: 0.74 }),
    concretePlinth: std({
      map: M.textures.concreteTex,
      normalMap: M.textures.concreteNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
      color: 0xaab1b8,
      roughness: 0.82,
      metalness: 0.04,
    }),
    louverAluminum: std({ color: 0xd9e0e7, roughness: 0.32, metalness: 0.62, envMapIntensity: 0.58 }),
    solarPvCell: std({ map: solarTex, roughness: 0.2, metalness: 0.46, envMapIntensity: 0.76 }),
    safetyYellow: std({ color: 0xeab308, roughness: 0.42, metalness: 0.25 }),
    hvacHousing: std({ color: 0x9aa4af, roughness: 0.48, metalness: 0.45, envMapIntensity: 0.44 }),
    ductSpiral: std({ map: ductTex, roughness: 0.34, metalness: 0.74, envMapIntensity: 0.62 }),
    dockRubber: std({ color: 0x16191e, roughness: 0.88, metalness: 0.05 }),
    beaconRed: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
    beaconGreen: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    beaconAmber: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
    emeraldLed: new THREE.MeshBasicMaterial({ color: 0x10b981 }),
    medicalTealLed: new THREE.MeshBasicMaterial({ color: 0x2dd4bf }),
    skyCyanLed: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    helipadSurface: std({ map: helipadTex, roughness: 0.68, metalness: 0.08 }),
  };
  return cachedConstPal;
}

function addRodBetween(
  parent: THREE.Object3D,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
  radialSegments = 8
) {
  const len = p0.distanceTo(p1);
  if (len < 0.005) return;
  const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, radialSegments), mat);
  m.position.copy(mid);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  m.castShadow = true;
  parent.add(m);
}

function addIBeam(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  len: number,
  h: number,
  flangeW: number,
  axis: 'x' | 'z',
  mat: THREE.Material
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (axis === 'z') g.rotation.y = Math.PI / 2;
  const thick = Math.max(0.018, h * 0.14);
  boxAt(g, len, thick, flangeW, 0, h * 0.5 - thick * 0.5, 0, mat, true, true);
  boxAt(g, len, thick, flangeW, 0, -h * 0.5 + thick * 0.5, 0, mat, true, true);
  boxAt(g, len, h - thick * 2, thick * 0.85, 0, 0, 0, mat, true, true);
  parent.add(g);
}

function addBoltedBasePlate(
  parent: THREE.Object3D,
  x: number,
  groundY: number,
  z: number,
  plateSize: number,
  steelMat: THREE.Material,
  plinthMat: THREE.Material
) {
  boxAt(parent, plateSize + 0.12, 0.16, plateSize + 0.12, x, groundY + 0.08, z, plinthMat, true, true, 0.02);
  boxAt(parent, plateSize, 0.04, plateSize, x, groundY + 0.18, z, steelMat, true, true, 0.008);
  const bo = plateSize * 0.36;
  [-bo, bo].forEach((bx) => {
    [-bo, bo].forEach((bz) => {
      cylAt(parent, 0.024, 0.024, 0.06, x + bx, groundY + 0.21, z + bz, steelMat, false, false, 6);
    });
  });
}

function addSeismicXBraceBay(
  parent: THREE.Object3D,
  x: number,
  yBottom: number,
  z0: number,
  z1: number,
  bayH: number,
  steelMat: THREE.Material,
  gussetMat: THREE.Material
) {
  const pBL = new THREE.Vector3(x, yBottom + 0.08, z0);
  const pTR = new THREE.Vector3(x, yBottom + bayH - 0.08, z1);
  const pTL = new THREE.Vector3(x, yBottom + bayH - 0.08, z0);
  const pBR = new THREE.Vector3(x, yBottom + 0.08, z1);
  addRodBetween(parent, pBL, pTR, 0.032, steelMat, 8);
  addRodBetween(parent, pTL, pBR, 0.032, steelMat, 8);
  [pBL, pTR, pTL, pBR].forEach((p) => {
    boxAt(parent, 0.06, 0.22, 0.22, p.x, p.y, p.z, gussetMat, false, false, 0.01);
  });
  const turn = cylAt(parent, 0.11, 0.11, 0.07, x, yBottom + bayH * 0.5, (z0 + z1) * 0.5, gussetMat, false, false, 12);
  turn.rotation.z = Math.PI / 2;
}

function addHvacChillerUnit(
  parent: THREE.Object3D,
  x: number,
  baseY: number,
  z: number,
  w: number,
  h: number,
  d: number,
  pal: ConstructionPalette,
  rotatingProps: Array<{ obj: THREE.Object3D; speed: number; axis: 'x' | 'y' | 'z' }>,
  fanCount = 2
) {
  const g = new THREE.Group();
  g.position.set(x, baseY, z);
  // Steel channel skid rails
  [-d * 0.36, d * 0.36].forEach((rz) => {
    boxAt(g, w + 0.18, 0.14, 0.12, 0, 0.07, rz, pal.structuralBlackSteel, true, true);
  });
  // Insulated louvered cabinet
  boxAt(g, w, h, d, 0, 0.14 + h * 0.5, 0, pal.hvacHousing, true, true, 0.03);
  // Louver grille slats along front/back
  for (let ly = 0.32; ly < h; ly += 0.22) {
    boxAt(g, w * 0.86, 0.04, d + 0.04, 0, 0.14 + ly, 0, pal.structuralBlackSteel, false, false);
  }
  // Electrical disconnect box & copper refrigerant pipe header
  boxAt(g, 0.38, 0.52, 0.18, w * 0.42, 0.14 + h * 0.55, d * 0.5 + 0.08, pal.safetyYellow, false, false, 0.015);
  // Top condenser fan shrouds + rotating axial blades
  const spacing = w / Math.max(1, fanCount);
  for (let i = 0; i < fanCount; i++) {
    const fx = -w * 0.5 + spacing * (i + 0.5);
    cylAt(g, 0.48, 0.54, 0.22, fx, 0.14 + h + 0.11, 0, pal.galvanizedSteel, true, false, 16);
    const fanHub = new THREE.Group();
    fanHub.position.set(fx, 0.14 + h + 0.15, 0);
    cylAt(fanHub, 0.11, 0.11, 0.08, 0, 0, 0, pal.structuralBlackSteel, false, false, 10);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.11), pal.brushedTitanium);
      blade.rotation.y = (b * Math.PI) / 2;
      blade.rotation.x = 0.28;
      blade.position.set(Math.cos((b * Math.PI) / 2) * 0.2, 0, Math.sin((b * Math.PI) / 2) * 0.2);
      fanHub.add(blade);
    }
    g.add(fanHub);
    rotatingProps.push({ obj: fanHub, speed: 3.4 + i * 0.4, axis: 'y' });
  }
  parent.add(g);
}

function addSolarPvRack(
  parent: THREE.Object3D,
  x: number,
  baseY: number,
  z: number,
  w: number,
  d: number,
  tiltX: number,
  tiltZ: number,
  legH: number,
  pal: ConstructionPalette
) {
  const g = new THREE.Group();
  g.position.set(x, baseY, z);
  const hw = w * 0.42;
  const hd = d * 0.38;
  [-hw, hw].forEach((lx) => {
    [-hd, hd].forEach((lz) => {
      const hOff = -Math.sin(tiltX) * lz + Math.sin(tiltZ) * lx;
      const h = Math.max(0.25, legH + hOff);
      cylAt(g, 0.045, 0.055, h, lx, h * 0.5, lz, pal.galvanizedSteel, true, false, 8);
      boxAt(g, 0.18, 0.03, 0.18, lx, 0.015, lz, pal.structuralBlackSteel, false, true);
    });
  });
  const array = new THREE.Group();
  array.position.set(0, legH, 0);
  array.rotation.x = tiltX;
  array.rotation.z = tiltZ;
  boxAt(array, w, 0.06, d, 0, 0, 0, pal.brushedTitanium, true, true, 0.01);
  boxAt(array, w - 0.14, 0.075, d - 0.14, 0, 0.008, 0, pal.solarPvCell, false, true);
  g.add(array);
  parent.add(g);
}

function addStairPenthouseBulkhead(
  parent: THREE.Object3D,
  x: number,
  baseY: number,
  z: number,
  w: number,
  d: number,
  h: number,
  wallMat: THREE.Material,
  trimMat: THREE.Material,
  pal: ConstructionPalette,
  doorSide: 'north' | 'south' | 'east' | 'west' = 'south'
) {
  boxAt(parent, w, h, d, x, baseY + h * 0.5, z, wallMat, true, true, 0.04);
  boxAt(parent, w + 0.24, 0.14, d + 0.24, x, baseY + h + 0.07, z, trimMat, true, false, 0.02);
  // Steel roof-hatch door + gooseneck vent + safety caged access ladder
  const isZ = doorSide === 'north' || doorSide === 'south';
  const sign = doorSide === 'south' || doorSide === 'east' ? 1 : -1;
  if (isZ) {
    boxAt(parent, 1.04, 2.05, 0.08, x, baseY + 1.025, z + sign * (d * 0.5 + 0.03), pal.galvanizedSteel, false, false);
    boxAt(parent, 0.18, 0.05, 0.06, x + 0.34, baseY + 1.04, z + sign * (d * 0.5 + 0.08), pal.structuralBlackSteel, false, false);
  } else {
    boxAt(parent, 0.08, 2.05, 1.04, x + sign * (w * 0.5 + 0.03), baseY + 1.025, z, pal.galvanizedSteel, false, false);
    boxAt(parent, 0.06, 0.05, 0.18, x + sign * (w * 0.5 + 0.08), baseY + 1.04, z + 0.34, pal.structuralBlackSteel, false, false);
  }
  cylAt(parent, 0.07, 0.07, 0.55, x - w * 0.28, baseY + h + 0.35, z, pal.galvanizedSteel, false, false, 10);
}

function addSatelliteDishMast(
  parent: THREE.Object3D,
  x: number,
  baseY: number,
  z: number,
  rotY: number,
  pal: ConstructionPalette
) {
  const g = new THREE.Group();
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;
  boxAt(g, 0.88, 0.14, 0.88, 0, 0.07, 0, pal.concretePlinth, true, true, 0.02);
  cylAt(g, 0.08, 0.1, 1.35, 0, 0.81, 0, pal.galvanizedSteel, true, false, 10);
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.76, 18, 10, 0, Math.PI * 2, 0, 0.72),
    pal.louverAluminum
  );
  dish.position.set(0, 1.62, 0.16);
  dish.rotation.x = Math.PI * 0.68;
  dish.castShadow = true;
  g.add(dish);
  addRodBetween(g, new THREE.Vector3(0, 1.62, 0.16), new THREE.Vector3(0, 1.88, 0.78), 0.018, pal.structuralBlackSteel, 6);
  cylAt(g, 0.055, 0.04, 0.14, 0, 1.88, 0.78, pal.structuralBlackSteel, false, false, 10);
  parent.add(g);
}

function addGeneratorUnit(
  parent: THREE.Object3D,
  x: number,
  baseY: number,
  z: number,
  pal: ConstructionPalette
) {
  const g = new THREE.Group();
  g.position.set(x, baseY, z);
  boxAt(g, 3.0, 0.12, 1.45, 0, 0.06, 0, pal.concretePlinth, true, true, 0.02);
  boxAt(g, 2.7, 1.28, 1.2, 0, 0.76, 0, pal.structuralBlackSteel, true, true, 0.03);
  // Acoustic exhaust silencer & chrome stack
  cylAt(g, 0.18, 0.18, 1.35, -0.65, 1.56, 0, pal.galvanizedSteel, true, false, 12);
  cylAt(g, 0.075, 0.075, 0.65, -0.65, 1.72, 0, pal.brushedTitanium, true, false, 10);
  // Access panel ribs & warning stripe
  boxAt(g, 2.74, 0.07, 1.24, 0, 0.22, 0, pal.safetyYellow, false, false);
  [-0.7, 0, 0.7].forEach((px) => {
    boxAt(g, 0.62, 0.85, 0.04, px, 0.78, 0.61, pal.galvanizedSteel, false, false);
  });
  parent.add(g);
}

function addCurvedOrStraightMullions(
  lg: THREE.Group,
  spec: DistrictBuildingSpec,
  lv: number,
  mullionMat: THREE.Material,
  spandrelMat: THREE.Material,
  colSteelMat: THREE.Material,
  plinthMat: THREE.Material,
  hasLouvers: boolean,
  louverMat: THREE.Material,
  seismics: boolean,
  seamMat: THREE.Material
) {
  const hw = spec.w * 0.5;
  const hd = spec.d * 0.5;
  const dirZ = spec.doorSide === 'south' ? 1 : -1;
  const frontZ = spec.doorSide === 'south' ? spec.cz + hd - 0.11 : spec.cz - hd + 0.11;
  const backZ = spec.doorSide === 'south' ? spec.cz - hd + 0.11 : spec.cz + hd - 0.11;
  const yFloor = spec.groundY + lv * spec.floorH;
  const floorSurfaceY = yFloor + 0.12;
  const hWall = spec.floorH - 0.24;
  const yMid = floorSurfaceY + hWall * 0.5;

  // 1. Exterior Structural Column Base Plates (lv=0) & Top Seismic Shear Collars (all levels)
  const frontColZ = frontZ - dirZ * 0.15;
  const backColZ = backZ + dirZ * 0.15;
  [-1, 1].forEach((side) => {
    const colX = spec.cx + side * (hw - 0.26);
    if (lv === 0) {
      addBoltedBasePlate(lg, colX, spec.groundY, frontColZ, 0.64, colSteelMat, plinthMat);
      addBoltedBasePlate(lg, colX, spec.groundY, backColZ, 0.64, colSteelMat, plinthMat);
    }
    // Seismic upper & lower collar rings around structural corner piers
    cylAt(lg, 0.29, 0.29, 0.1, colX, floorSurfaceY + 0.05, frontColZ, colSteelMat, false, false, 16);
    cylAt(lg, 0.29, 0.29, 0.12, colX, floorSurfaceY + hWall - 0.06, frontColZ, colSteelMat, false, false, 16);
    cylAt(lg, 0.29, 0.29, 0.1, colX, floorSurfaceY + 0.05, backColZ, colSteelMat, false, false, 16);
    cylAt(lg, 0.29, 0.29, 0.12, colX, floorSurfaceY + hWall - 0.06, backColZ, colSteelMat, false, false, 16);
  });

  // 2. Floor-edge Architectural Drip Flashing / Spandrel Channel on Front & Flanks
  boxAt(lg, spec.w - 0.6, 0.065, 0.16, spec.cx, floorSurfaceY + hWall - 0.03, frontZ + dirZ * 0.05, spandrelMat, false, false);
  [-1, 1].forEach((side) => {
    const wx = spec.cx + side * (hw - 0.11);
    boxAt(lg, 0.16, 0.065, spec.d - 0.8, wx + side * 0.04, floorSurfaceY + hWall - 0.03, spec.cz, spandrelMat, false, false);
  });

  // 3. Intermediate Front Curtain-Wall Mullions & Horizontal Transoms (strictly clearing ground doorway)
  const transomY = floorSurfaceY + 2.65;
  const mulStep = spec.w >= 30 ? 3.2 : 2.8;
  for (let mx = spec.cx - hw + 2.4; mx <= spec.cx + hw - 2.3; mx += mulStep) {
    if (lv === 0 && Math.abs(mx - spec.doorX) < 1.98) continue;
    boxAt(lg, 0.075, hWall - 0.14, 0.15, mx, yMid, frontZ, mullionMat, true, false);
  }
  if (lv === 0) {
    const leftEdge = spec.cx - hw + 0.8;
    const rightEdge = spec.cx + hw - 0.8;
    const lEnd = spec.doorX - 1.78;
    const rStart = spec.doorX + 1.78;
    if (lEnd - leftEdge > 0.6) {
      boxAt(lg, lEnd - leftEdge, 0.065, 0.13, (leftEdge + lEnd) * 0.5, transomY, frontZ, mullionMat, false, false);
    }
    if (rightEdge - rStart > 0.6) {
      boxAt(lg, rightEdge - rStart, 0.065, 0.13, (rStart + rightEdge) * 0.5, transomY, frontZ, mullionMat, false, false);
    }
  } else {
    boxAt(lg, spec.w - 1.4, 0.065, 0.13, spec.cx, transomY, frontZ, mullionMat, false, false);
  }

  // 4. Side Flank Curtain-Wall Mullions, Transoms & Optional Brise-Soleil Sun Fins / Seismic Bracing
  [-1, 1].forEach((side) => {
    const wx = spec.cx + side * (hw - 0.11);
    for (let mz = spec.cz - hd + 2.4; mz <= spec.cz + hd - 2.3; mz += 2.8) {
      if (Math.abs(mz - spec.cz) < 1.1) continue;
      boxAt(lg, 0.15, hWall - 0.14, 0.075, wx, yMid, mz, mullionMat, true, false);
    }
    boxAt(lg, 0.13, 0.065, spec.d - 1.5, wx, transomY, spec.cz, mullionMat, false, false);

    // Architectural Brise-Soleil Shading Louvers on upper levels (lv >= 1)
    if (hasLouvers && lv >= 1) {
      const bayZ0 = spec.cz - hd + 2.5;
      const bayZ1 = spec.cz - 2.6;
      for (let lz = bayZ0; lz <= bayZ1; lz += 0.48) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.24, hWall - 0.42, 0.045), louverMat);
        fin.position.set(wx + side * 0.2, yMid, lz);
        fin.rotation.y = side * 0.36;
        fin.castShadow = true;
        lg.add(fin);
      }
    }
  });

  // Back wall transom & intermediate mullions
  for (let mx = spec.cx - hw + 3.0; mx <= spec.cx + hw - 2.9; mx += 3.4) {
    boxAt(lg, 0.08, hWall * 0.46, 0.14, mx, floorSurfaceY + hWall * 0.77, backZ, mullionMat, false, false);
  }

  // Optional Exposed Structural Seismic Steel X-Brace Tension Bay on upper flanks
  if (seismics && (lv === 1 || lv === 2)) {
    addSeismicXBraceBay(
      lg,
      spec.cx - hw + 0.02,
      floorSurfaceY + 0.1,
      spec.cz + hd - 5.2,
      spec.cz + hd - 2.2,
      hWall - 0.25,
      seamMat,
      colSteelMat
    );
  }
}

/**
 * Adds realistic structural curtain-wall construction, engineered porte-cocheres,
 * exterior dock/facade equipment, and bespoke MEP/architectural rooftop crowns to every
 * building in the district EXCEPT `hub` and `realestate`.
 */
export function buildDistrictBuildingConstruction(ctx: DistrictConstructionContext) {
  const { spec, levelGroups, roofShellGroup, M, archMats, frameDarkMat, accentMat, rotatingProps, pickMeshes } = ctx;

  // Explicitly skip DomainTechHub (`hub`) and TerraCraft Real Estate (`realestate`)
  if (spec.id === 'hub' || spec.id === 'realestate') return;

  const pal = getConstructionPalette(M);
  const g0 = levelGroups[0];
  const roofY = spec.groundY + spec.h;
  const dirZ = spec.doorSide === 'south' ? 1 : -1;

  // --------------------------------------------------------------------------
  // 1. MULTI-LEVEL FACADE STRUCTURAL CONSTRUCTION (MULLIONS, TRANSOMS, FINS)
  // --------------------------------------------------------------------------
  for (let lv = 0; lv < spec.floors; lv++) {
    const lg = levelGroups[lv];
    if (!lg) continue;

    const useLouver = spec.id === 'medical' || spec.id === 'crypto' || spec.id === 'travel';
    const louverMat =
      spec.id === 'medical'
        ? pal.louverAluminum
        : spec.id === 'crypto'
          ? pal.structuralBlackSteel
          : pal.brushedTitanium;
    const mullionMat =
      spec.id === 'logistics'
        ? pal.structuralBlackSteel
        : spec.id === 'travel'
          ? pal.brushedTitanium
          : spec.id === 'crypto'
            ? pal.structuralBlackSteel
            : archMats.bronzeMullion;
    const spandrelMat =
      spec.id === 'bank'
        ? archMats.bronzeMullion
        : spec.id === 'restaurant'
          ? pal.copperFlashing
          : spec.id === 'dealership' || spec.id === 'logistics'
            ? pal.structuralBlackSteel
            : pal.galvanizedSteel;

    addCurvedOrStraightMullions(
      lg,
      spec,
      lv,
      mullionMat,
      spandrelMat,
      pal.structuralBlackSteel,
      pal.concretePlinth,
      useLouver,
      louverMat,
      spec.id === 'crypto' || spec.id === 'logistics' || spec.id === 'dealership',
      spec.id === 'logistics' ? pal.copperFlashing : pal.galvanizedSteel
    );
  }

  // --------------------------------------------------------------------------
  // 2. BUILDING-SPECIFIC PORTE-COCHERES, ENTRY ENGINEERING & ROOFTOP CROWNS
  // --------------------------------------------------------------------------
  if (spec.id === 'bank') {
    // Bank Portico Bolt Collars & Recessed Downlights around existing 4 piers
    [-3.8, -1.9, 1.9, 3.8].forEach((ox) => {
      const px = spec.doorX + ox;
      const pz = spec.doorZ + 1.4;
      cylAt(g0, 0.45, 0.48, 0.04, px, spec.groundY + 0.25, pz, archMats.bronzeMullion, false, false, 16);
      [-0.32, 0.32].forEach((bx) => {
        cylAt(g0, 0.02, 0.02, 0.06, px + bx, spec.groundY + 0.27, pz + 0.28, pal.structuralBlackSteel, false, false, 6);
        cylAt(g0, 0.02, 0.02, 0.06, px + bx, spec.groundY + 0.27, pz - 0.28, pal.structuralBlackSteel, false, false, 6);
      });
    });
    [-2.8, 0, 2.8].forEach((dx) => {
      downlight(g0, spec.doorX + dx, spec.groundY + spec.floorH - 0.29, spec.doorZ + 1.25, M, 0.14);
    });
    // Rooftop Reserve MEP Plant & Encrypted SWIFT Satellite Array (top of bank roofDeck = roofY + 0.23)
    const rY = roofY + 0.23;
    // West stairwell penthouse ribbed door & louver vents
    boxAt(roofShellGroup, 1.05, 1.85, 0.08, spec.cx - 7.75, rY + 0.94, spec.cz + 1.44, pal.galvanizedSteel, false, false);
    boxAt(roofShellGroup, 1.6, 0.55, 0.08, spec.cx - 5.02, rY + 1.55, spec.cz - 2.5, pal.structuralBlackSteel, false, false);
    // North Reserve MEP Chiller Plant + Acoustic Screen
    addHvacChillerUnit(roofShellGroup, spec.cx - 1.2, rY, spec.cz - 7.2, 3.4, 1.28, 1.65, pal, rotatingProps, 2);
    // North-East Emergency Standby Diesel Generator
    addGeneratorUnit(roofShellGroup, spec.cx + 7.4, rY, spec.cz - 6.8, pal);
    // Encrypted Ka-Band SWIFT Satellite Dish & Lightning Arrestor Mast
    addSatelliteDishMast(roofShellGroup, spec.cx + 8.6, rY, spec.cz + 1.2, -0.45, pal);
    cylAt(roofShellGroup, 0.03, 0.06, 2.6, spec.cx - 8.4, rY + 3.45, spec.cz - 2.5, pal.galvanizedSteel, false, false, 8);
    const bankBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), pal.beaconRed);
    bankBeacon.position.set(spec.cx - 8.4, rY + 4.82, spec.cz - 2.5);
    roofShellGroup.add(bankBeacon);
    return;
  }

  if (spec.id === 'dealership') {
    // Cantilevered Automotive Showroom Steel-and-Glass Porte-Cochere (clear of +-1.65m doorway)
    const canopyY = spec.groundY + spec.floorH - 0.48;
    const canZ = spec.doorZ + 1.6;
    const canMesh = boxAt(g0, 11.4, 0.16, 3.1, spec.doorX, canopyY, canZ, pal.structuralBlackSteel, true, true, 0.02);
    boxAt(g0, 11.0, 0.04, 2.75, spec.doorX, canopyY - 0.09, canZ, archMats.timberSoffit, false, false);
    boxAt(g0, 11.55, 0.07, 0.08, spec.doorX, canopyY + 0.09, canZ + 1.54, accentMat, false, false);
    pickMeshes.push(canMesh);
    [-4.8, -2.4, 0, 2.4, 4.8].forEach((ox) => {
      addIBeam(g0, spec.doorX + ox, canopyY - 0.12, canZ, 2.95, 0.18, 0.12, 'z', pal.structuralBlackSteel);
    });
    [-3.2, 0, 3.2].forEach((dx) => {
      downlight(g0, spec.doorX + dx, canopyY - 0.14, canZ, M, 0.15);
    });
    // Wide-flange collared showroom canopy piers cleanly outside vehicle/pedestrian path
    [-4.8, 4.8].forEach((px) => {
      const colX = spec.doorX + px;
      const colZ = spec.doorZ + 2.45;
      addBoltedBasePlate(g0, colX, spec.groundY, colZ, 0.56, pal.structuralBlackSteel, pal.concretePlinth);
      const cH = canopyY - spec.groundY - 0.24;
      cylAt(g0, 0.16, 0.18, cH, colX, spec.groundY + 0.2 + cH * 0.5, colZ, pal.structuralBlackSteel, true, true, 16);
      cylAt(g0, 0.24, 0.24, 0.1, colX, canopyY - 0.14, colZ, pal.brushedTitanium, false, false, 16);
    });

    // Rooftop EV Solar Microgrid + VRF Chiller Plant + Twin Dealer Flagpoles + Stair Bulkhead
    // Note: dealership is 'shed_seam' (peakX = +3.2m at y = roofY + 2.95; x=-10 -> 0.45; x=+10 -> 1.35)
    const shedHeightAt = (lx: number): number => {
      const peakX = spec.w * 0.16;
      const halfShedW = (spec.w + 2.6) * 0.5;
      if (lx <= peakX) {
        return 0.45 + ((lx + halfShedW) / (peakX + halfShedW)) * (2.95 - 0.45);
      }
      return 2.95 + ((lx - peakX) / (halfShedW - peakX)) * (1.35 - 2.95);
    };
    // Solar PV panels pitched parallel to the West shed slope feeding EV hyper-chargers
    const westSlopeTilt = Math.atan2(2.95 - 0.45, spec.w * 0.16 + (spec.w + 2.6) * 0.5);
    [-3.8, 3.6].forEach((pz) => {
      addSolarPvRack(
        roofShellGroup,
        spec.cx - 3.6,
        roofY + shedHeightAt(-3.6),
        spec.cz + pz,
        5.8,
        3.4,
        0,
        westSlopeTilt,
        0.48,
        pal
      );
    });
    // Leveled Structural Steel Dunnage Frame on East shed slope carrying Twin VRF HVAC Chillers
    const dunnageX = spec.cx + 5.8;
    const dunnageTopY = roofY + 2.85;
    [4.4, 7.2].forEach((lx) => {
      [-5.4, -2.6].forEach((lz) => {
        const legBase = roofY + shedHeightAt(lx);
        const legH = Math.max(0.25, dunnageTopY - legBase);
        cylAt(roofShellGroup, 0.075, 0.085, legH, spec.cx + lx, legBase + legH * 0.5, spec.cz + lz, pal.structuralBlackSteel, true, false, 10);
      });
    });
    addIBeam(roofShellGroup, dunnageX, dunnageTopY, spec.cz - 4.0, 3.6, 0.2, 0.14, 'x', pal.structuralBlackSteel);
    addHvacChillerUnit(roofShellGroup, dunnageX, dunnageTopY + 0.1, spec.cz - 4.0, 2.8, 1.15, 1.55, pal, rotatingProps, 2);
    // West Stair Bulkhead cap peeking on West slope + Dealer Flagpoles at South parapet corners
    addStairPenthouseBulkhead(roofShellGroup, spec.cx - 8.6, roofY + shedHeightAt(-8.6) - 0.25, spec.cz + 0.4, 2.4, 3.6, 1.55, archMats.standingSeam, pal.brushedTitanium, pal, 'east');
    [-8.4, 8.4].forEach((fx, fi) => {
      const fBaseY = roofY + 0.13;
      const fpX = spec.cx + fx;
      const fpZ = spec.cz + spec.d * 0.5 + 0.3;
      addBoltedBasePlate(roofShellGroup, fpX, fBaseY, fpZ, 0.42, pal.structuralBlackSteel, pal.concretePlinth);
      cylAt(roofShellGroup, 0.055, 0.08, 4.4, fpX, fBaseY + 2.2, fpZ, pal.brushedTitanium, true, false, 10);
      boxAt(roofShellGroup, 1.2, 0.72, 0.03, fpX + 0.62, fBaseY + 3.9, fpZ, fi === 0 ? accentMat : pal.structuralBlackSteel, false, false);
    });
    return;
  }

  if (spec.id === 'crypto') {
    // Glowing Titanium & Emerald Cyber Porte-Cochere (clear of +-1.65m doorway & below signBox)
    const canopyY = spec.groundY + spec.floorH - 0.48;
    const canZ = spec.doorZ + 1.48;
    const cSlab = boxAt(g0, 10.6, 0.18, 2.9, spec.doorX, canopyY, canZ, pal.structuralBlackSteel, true, true, 0.03);
    boxAt(g0, 10.72, 0.05, 0.08, spec.doorX, canopyY + 0.08, canZ + 1.44, pal.emeraldLed, false, false);
    boxAt(g0, 10.2, 0.04, 2.5, spec.doorX, canopyY - 0.1, canZ, pal.brushedTitanium, false, false);
    pickMeshes.push(cSlab);
    [-4.6, 4.6].forEach((px) => {
      const colX = spec.doorX + px;
      const colZ = spec.doorZ + 2.25;
      addBoltedBasePlate(g0, colX, spec.groundY, colZ, 0.54, pal.structuralBlackSteel, pal.concretePlinth);
      const cH = canopyY - spec.groundY - 0.24;
      cylAt(g0, 0.17, 0.2, cH, colX, spec.groundY + 0.2 + cH * 0.5, colZ, pal.structuralBlackSteel, true, true, 16);
      cylAt(g0, 0.25, 0.25, 0.08, colX, canopyY - 0.14, colZ, pal.emeraldLed, false, false, 16);
    });
    [-2.8, 0, 2.8].forEach((dx) => {
      downlight(g0, spec.doorX + dx, canopyY - 0.15, canZ, M, 0.14);
    });

    // Rooftop Immersion Dry-Cooler Heat Rejection Plant & Ka-Band Financial Dishes (top of tower deck = roofY + 0.23)
    const rY = roofY + 0.23;
    // NW Liquid-Cooling Dry-Cooler Bank with twin rotating condenser fans & insulated manifolds
    addHvacChillerUnit(roofShellGroup, spec.cx - 5.2, rY, spec.cz - 6.0, 4.4, 1.35, 1.85, pal, rotatingProps, 3);
    addHvacChillerUnit(roofShellGroup, spec.cx - 5.2, rY, spec.cz - 3.6, 4.4, 1.35, 1.85, pal, rotatingProps, 3);
    // Insulated stainless chilled-water supply/return pipe bridge feeding core below
    [-4.8, 0].forEach((pz, pi) => {
      const pipe = cylAt(roofShellGroup, 0.09, 0.09, 3.2, spec.cx - 1.6, rY + 0.45 + pi * 0.22, spec.cz - 4.8 + pz * 0.1, pal.brushedTitanium, false, false, 10);
      pipe.rotation.z = Math.PI / 2;
    });
    // SE Solar Microgrid Array + Dual Financial Satellite Dishes
    addSolarPvRack(roofShellGroup, spec.cx + 4.4, rY, spec.cz + 6.4, 5.2, 3.2, 0.24, 0, 0.85, pal);
    addSatelliteDishMast(roofShellGroup, spec.cx - 1.2, rY, spec.cz + 6.8, 0.35, pal);
    addSatelliteDishMast(roofShellGroup, spec.cx + 0.8, rY, spec.cz + 6.8, -0.25, pal);
    // Aviation Beacon Mast atop the fluted rooftop pavilion (pavilion cap sits around roofY + 2.95)
    cylAt(roofShellGroup, 0.045, 0.08, 2.4, spec.cx + 2.64, roofY + 4.15, spec.cz - 2.4, pal.brushedTitanium, false, false, 10);
    const cryptoBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), pal.emeraldLed);
    cryptoBeacon.position.set(spec.cx + 2.64, roofY + 5.4, spec.cz - 2.4);
    roofShellGroup.add(cryptoBeacon);
    return;
  }

  if (spec.id === 'medical') {
    // Cantilevered Ambulance & Patient Drop-Off Porte-Cochere Canopy (clear of +-1.65m doorway, 3.75m headroom)
    const canopyY = spec.groundY + spec.floorH - 0.48;
    const canZ = spec.doorZ + 1.85;
    const medCanopy = boxAt(g0, 14.2, 0.22, 3.6, spec.doorX, canopyY, canZ, archMats.stuccoWhite, true, true, 0.04);
    boxAt(g0, 14.3, 0.06, 0.08, spec.doorX, canopyY + 0.08, canZ + 1.81, pal.medicalTealLed, false, false);
    boxAt(g0, 13.6, 0.05, 3.1, spec.doorX, canopyY - 0.12, canZ, archMats.timberSoffit, false, false);
    pickMeshes.push(medCanopy);
    [-6.0, -3.0, 0, 3.0, 6.0].forEach((ox) => {
      addIBeam(g0, spec.doorX + ox, canopyY - 0.16, canZ, 3.4, 0.2, 0.14, 'z', pal.galvanizedSteel);
    });
    [-4.2, 0, 4.2].forEach((dx) => {
      downlight(g0, spec.doorX + dx, canopyY - 0.17, canZ, M, 0.16);
    });
    [-5.8, 5.8].forEach((px) => {
      const colX = spec.doorX + px;
      const colZ = spec.doorZ + 2.95;
      addBoltedBasePlate(g0, colX, spec.groundY, colZ, 0.62, pal.galvanizedSteel, pal.concretePlinth);
      const cH = canopyY - spec.groundY - 0.24;
      cylAt(g0, 0.19, 0.22, cH, colX, spec.groundY + 0.2 + cH * 0.5, colZ, archMats.stuccoWhite, true, true, 18);
      cylAt(g0, 0.27, 0.27, 0.1, colX, canopyY - 0.18, colZ, pal.medicalTealLed, false, false, 16);
    });

    // Rooftop Clinical HEPA AHU Plant, Twin Chillers, Generator, Solar Thermal & Emergency Helipad Deck
    // Blade roof height formula: back (cz - d/2 - 1.05) = 0.88, front (cz + d/2 + 2.35) = 3.30
    const bladeZMin = spec.cz + 0.65 - (spec.d + 3.4) * 0.5;
    const bladeZSpan = spec.d + 3.4;
    const bladeTopAt = (worldZ: number): number => {
      const t = THREE.MathUtils.clamp((worldZ - bladeZMin) / bladeZSpan, 0, 1);
      return roofY + THREE.MathUtils.lerp(0.88, 3.3, t);
    };

    // Level Steel Dunnage Grillage on West Wing (cx - 13.5, cz - 1.0) supporting HEPA AHU + Chillers
    const westDeckY = roofY + 2.85;
    [-17.2, -9.8].forEach((lx) => {
      [-4.2, 2.2].forEach((lz) => {
        const legBase = bladeTopAt(spec.cz + lz);
        const legH = Math.max(0.25, westDeckY - legBase);
        cylAt(roofShellGroup, 0.08, 0.09, legH, spec.cx + lx, legBase + legH * 0.5, spec.cz + lz, pal.galvanizedSteel, true, false, 10);
      });
    });
    boxAt(roofShellGroup, 8.4, 0.16, 7.2, spec.cx - 13.5, westDeckY, spec.cz - 1.0, pal.structuralBlackSteel, true, true, 0.02);
    addHvacChillerUnit(roofShellGroup, spec.cx - 14.8, westDeckY + 0.08, spec.cz - 2.6, 4.2, 1.32, 1.8, pal, rotatingProps, 3);
    // Galvanized Spiral HEPA Cleanroom Supply Ductwork
    boxAt(roofShellGroup, 4.2, 1.15, 1.65, spec.cx - 14.8, westDeckY + 0.65, spec.cz + 0.8, pal.louverAluminum, true, true, 0.03);
    const hvacDuct = cylAt(roofShellGroup, 0.34, 0.34, 4.8, spec.cx - 11.4, westDeckY + 0.72, spec.cz + 0.8, pal.ductSpiral, true, false, 14);
    hvacDuct.rotation.z = Math.PI / 2;
    cylAt(roofShellGroup, 0.34, 0.34, 1.4, spec.cx - 9.2, westDeckY + 0.02, spec.cz + 0.8, pal.ductSpiral, true, false, 14);

    // Center-East Standby Generator + Solar Thermal Array
    const midDeckY = roofY + 2.75;
    [1.8, 5.2].forEach((lx) => {
      [-3.8, -1.2].forEach((lz) => {
        const legBase = bladeTopAt(spec.cz + lz);
        const legH = Math.max(0.25, midDeckY - legBase);
        cylAt(roofShellGroup, 0.07, 0.08, legH, spec.cx + lx, legBase + legH * 0.5, spec.cz + lz, pal.galvanizedSteel, true, false, 10);
      });
    });
    addIBeam(roofShellGroup, spec.cx + 3.5, midDeckY, spec.cz - 2.5, 4.2, 0.18, 0.14, 'x', pal.structuralBlackSteel);
    addGeneratorUnit(roofShellGroup, spec.cx + 3.5, midDeckY + 0.09, spec.cz - 2.5, pal);

    // Elevated Emergency Medical Drone / Helipad Touchdown Deck on East Wing (cx + 15.0, cz + 0.4)
    const padX = spec.cx + 15.0;
    const padZ = spec.cz + 0.4;
    const padY = roofY + 3.65;
    [-3.6, 3.6].forEach((lx) => {
      [-3.6, 3.6].forEach((lz) => {
        const legBase = bladeTopAt(padZ + lz);
        const legH = Math.max(0.3, padY - legBase);
        cylAt(roofShellGroup, 0.11, 0.13, legH, padX + lx, legBase + legH * 0.5, padZ + lz, pal.galvanizedSteel, true, false, 12);
      });
    });
    const padDeck = cylAt(roofShellGroup, 4.75, 4.75, 0.22, padX, padY, padZ, pal.structuralBlackSteel, true, true, 24);
    cylAt(roofShellGroup, 4.55, 4.55, 0.04, padX, padY + 0.12, padZ, pal.helipadSurface, false, true, 24);
    pickMeshes.push(padDeck);
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI) / 6;
      const lx = padX + Math.cos(ang) * 4.55;
      const lz = padZ + Math.sin(ang) * 4.55;
      cylAt(roofShellGroup, 0.075, 0.075, 0.1, lx, padY + 0.15, lz, i % 2 === 0 ? pal.beaconGreen : pal.beaconAmber, false, false, 8);
    }
    // Windsock mast beside helipad
    cylAt(roofShellGroup, 0.035, 0.045, 2.2, padX + 4.9, padY + 1.0, padZ - 2.8, pal.galvanizedSteel, false, false, 8);
    const sock = cylAt(roofShellGroup, 0.06, 0.14, 0.65, padX + 5.25, padY + 1.98, padZ - 2.8, accentMat, false, false, 10);
    sock.rotation.z = -Math.PI / 2 + 0.18;
    return;
  }

  if (spec.id === 'restaurant') {
    // Cantilevered Hammered-Copper & Forged-Iron Dining Awning over South Patio (zero ground columns)
    const canopyY = spec.groundY + spec.floorH - 0.44;
    const canZ = spec.doorZ + 1.2;
    const awMesh = boxAt(g0, 12.6, 0.12, 2.35, spec.doorX, canopyY, canZ, pal.copperFlashing, true, true, 0.02);
    boxAt(g0, 12.2, 0.04, 2.05, spec.doorX, canopyY - 0.07, canZ, archMats.timberSoffit, false, false);
    pickMeshes.push(awMesh);
    [-5.4, -2.7, 2.7, 5.4].forEach((kx) => {
      addRodBetween(
        g0,
        new THREE.Vector3(spec.doorX + kx, canopyY - 0.72, spec.doorZ + 0.02),
        new THREE.Vector3(spec.doorX + kx, canopyY - 0.08, spec.doorZ + 2.15),
        0.032,
        pal.structuralBlackSteel,
        8
      );
      downlight(g0, spec.doorX + kx, canopyY - 0.1, canZ, M, 0.12);
    });

    // Copper Chimney Flue Stack + Commercial Kitchen Exhaust Hood + Chef's Herb Beds
    // Stone turret sits around (cx - w*0.12 - w*0.28, cz - d*0.22) = (cx - 8.0, cz - 3.96), top at roofY + 2.525
    const turX = spec.cx - spec.w * 0.4;
    const turZ = spec.cz - spec.d * 0.22;
    cylAt(roofShellGroup, 0.42, 0.48, 1.55, turX, roofY + 3.25, turZ, pal.copperFlashing, true, true, 14);
    cylAt(roofShellGroup, 0.56, 0.56, 0.12, turX, roofY + 3.85, turZ, pal.structuralBlackSteel, false, false, 14);
    cylAt(roofShellGroup, 0.72, 0.16, 0.34, turX, roofY + 4.18, turZ, pal.copperFlashing, true, false, 14);

    // Commercial Kitchen Exhaust Centrifugal Hood & Galvanized Ductwork over West Eave
    const kitchX = spec.cx - 2.6;
    const kitchZ = spec.cz - 5.0;
    const kitchY = roofY + 2.18;
    [-1.4, 1.4].forEach((lx) => {
      [-0.7, 0.7].forEach((lz) => {
        cylAt(roofShellGroup, 0.06, 0.07, 1.25, kitchX + lx, roofY + 1.55, kitchZ + lz, pal.galvanizedSteel, true, false, 8);
      });
    });
    boxAt(roofShellGroup, 3.2, 0.12, 1.8, kitchX, kitchY, kitchZ, pal.galvanizedSteel, true, true);
    boxAt(roofShellGroup, 2.2, 1.05, 1.4, kitchX - 0.3, kitchY + 0.58, kitchZ, pal.louverAluminum, true, true, 0.03);
    cylAt(roofShellGroup, 0.45, 0.52, 0.52, kitchX + 0.85, kitchY + 0.92, kitchZ, pal.ductSpiral, true, false, 14);
    const exhPipe = cylAt(roofShellGroup, 0.26, 0.26, 2.8, kitchX - 2.6, kitchY + 0.52, kitchZ + 0.4, pal.ductSpiral, true, false, 12);
    exhPipe.rotation.z = Math.PI / 2;

    // Rooftop Chef's Herb & Citrus Planter Troughs on East Deck
    buildPlanterTrough(roofShellGroup, spec.cx + 5.2, roofY + 0.14, spec.cz + 4.4, 3.6, 0, 912, archMats);
    buildPlanterTrough(roofShellGroup, spec.cx + 5.2, roofY + 0.14, spec.cz - 4.4, 3.6, 0, 913, archMats);
    return;
  }

  if (spec.id === 'travel') {
    // Aviation Wing Porte-Cochere Canopy (replaces basic travelCanopy removed in districtBuildings.ts)
    const wingY = spec.groundY + spec.floorH - 0.36;
    const wingZ = spec.doorZ - 1.75;
    const wingCanopy = boxAt(g0, 15.6, 0.18, 3.6, spec.doorX, wingY, wingZ, pal.louverAluminum, true, true, 0.04);
    boxAt(g0, 15.7, 0.07, 0.14, spec.doorX, wingY, wingZ - 1.8, pal.brushedTitanium, false, false);
    boxAt(g0, 14.8, 0.05, 3.1, spec.doorX, wingY - 0.11, wingZ, archMats.timberSoffit, false, false);
    pickMeshes.push(wingCanopy);
    [-6.0, -3.0, 0, 3.0, 6.0].forEach((ox) => {
      addIBeam(g0, spec.doorX + ox, wingY - 0.15, wingZ, 3.45, 0.2, 0.12, 'z', pal.brushedTitanium);
    });
    // Stainless steel tension tie-rods connecting L1 spandrel out to leading wing edge
    [-5.8, 5.8].forEach((px) => {
      const colX = spec.doorX + px;
      const colZ = spec.doorZ - 2.95;
      addBoltedBasePlate(g0, colX, spec.groundY, colZ, 0.56, pal.brushedTitanium, pal.concretePlinth);
      const cH = wingY - spec.groundY - 0.24;
      cylAt(g0, 0.16, 0.19, cH, colX, spec.groundY + 0.2 + cH * 0.5, colZ, pal.brushedTitanium, true, true, 16);
      cylAt(g0, 0.25, 0.25, 0.1, colX, wingY - 0.14, colZ, pal.structuralBlackSteel, false, false, 16);
      addRodBetween(
        g0,
        new THREE.Vector3(colX, wingY + 1.45, spec.doorZ - 0.12),
        new THREE.Vector3(colX, wingY + 0.08, wingZ - 1.55),
        0.026,
        pal.brushedTitanium,
        8
      );
    });
    [-4.2, 0, 4.2].forEach((dx) => {
      downlight(g0, spec.doorX + dx, wingY - 0.15, wingZ, M, 0.15);
    });

    // Rooftop ATC Control Observation Lantern, Rotating SSR Radar, Weather Radome & Solar Fins
    // Note: travel 'blade' roof faces North (dirZ=-1, rot=Math.PI): high eave is at North (cz - 0.65 - bladeD/2) = 3.30, rear South = 0.88
    const bladeZMax = spec.cz - 0.65 + (spec.d + 3.4) * 0.5;
    const bladeSpan = spec.d + 3.4;
    const bladeTopAt = (worldZ: number): number => {
      const t = THREE.MathUtils.clamp((bladeZMax - worldZ) / bladeSpan, 0, 1);
      return roofY + THREE.MathUtils.lerp(0.88, 3.3, t);
    };
    // Canted Glazed ATC Control Observation Lantern centered above North blade roof
    const atcX = spec.cx;
    const atcZ = spec.cz - 3.6;
    const atcBaseY = roofY + 3.35;
    [-1.8, 1.8].forEach((lx) => {
      [-1.5, 1.5].forEach((lz) => {
        const bY = bladeTopAt(atcZ + lz);
        const h = Math.max(0.25, atcBaseY - bY);
        cylAt(roofShellGroup, 0.1, 0.12, h, atcX + lx, bY + h * 0.5, atcZ + lz, pal.brushedTitanium, true, false, 12);
      });
    });
    boxAt(roofShellGroup, 4.4, 0.2, 3.8, atcX, atcBaseY, atcZ, pal.structuralBlackSteel, true, true, 0.03);
    const cab = cylAt(roofShellGroup, 2.35, 1.85, 1.85, atcX, atcBaseY + 1.02, atcZ, ctx.M.glass, false, false, 10);
    pickMeshes.push(cab);
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const mx = atcX + Math.cos(ang) * 2.08;
      const mz = atcZ + Math.sin(ang) * 2.08;
      boxAt(roofShellGroup, 0.08, 1.9, 0.08, mx, atcBaseY + 1.02, mz, pal.structuralBlackSteel, false, false);
    }
    cylAt(roofShellGroup, 2.65, 2.3, 0.24, atcX, atcBaseY + 2.05, atcZ, pal.louverAluminum, true, false, 12);
    // Rotating Dual-Beam Airport Surveillance Radar (SSR)
    cylAt(roofShellGroup, 0.12, 0.18, 0.95, atcX, atcBaseY + 2.6, atcZ, pal.galvanizedSteel, true, false, 10);
    const ssrBar = new THREE.Group();
    ssrBar.position.set(atcX, atcBaseY + 3.18, atcZ);
    boxAt(ssrBar, 3.1, 0.34, 0.28, 0, 0, 0, pal.brushedTitanium, true, false, 0.03);
    boxAt(ssrBar, 3.18, 0.08, 0.1, 0, 0.22, 0, pal.skyCyanLed, false, false);
    roofShellGroup.add(ssrBar);
    rotatingProps.push({ obj: ssrBar, speed: 1.15, axis: 'y' });

    // Geodesic White Doppler Weather Radome on East Wing + Chillers on West Wing
    const domX = spec.cx + 8.6;
    const domZ = spec.cz + 1.2;
    const domY = bladeTopAt(domZ) + 0.45;
    cylAt(roofShellGroup, 0.85, 0.95, 0.9, domX, domY - 0.15, domZ, pal.galvanizedSteel, true, true, 16);
    const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), archMats.stuccoWhite);
    dome.position.set(domX, domY + 0.82, domZ);
    dome.castShadow = true;
    roofShellGroup.add(dome);

    const westChY = roofY + 2.65;
    [-10.2, -7.2].forEach((lx) => {
      [0.2, 2.8].forEach((lz) => {
        const bY = bladeTopAt(spec.cz + lz);
        const h = Math.max(0.25, westChY - bY);
        cylAt(roofShellGroup, 0.075, 0.085, h, spec.cx + lx, bY + h * 0.5, spec.cz + lz, pal.galvanizedSteel, true, false, 8);
      });
    });
    boxAt(roofShellGroup, 3.8, 0.14, 3.2, spec.cx - 8.7, westChY, spec.cz + 1.5, pal.structuralBlackSteel, true, true);
    addHvacChillerUnit(roofShellGroup, spec.cx - 8.7, westChY + 0.07, spec.cz + 1.5, 3.1, 1.15, 1.65, pal, rotatingProps, 2);
    return;
  }

  if (spec.id === 'tourism') {
    // Stone Masonry Plinths & Bronze Saddle Tie Brackets around existing North Safari Pergola piers (+-4.8)
    [-4.8, 4.8].forEach((px) => {
      [spec.doorZ - 2.95, spec.doorZ - 0.45].forEach((pz) => {
        boxAt(g0, 0.68, 0.42, 0.68, spec.doorX + px, spec.groundY + 0.21, pz, archMats.ashlarStone, true, true, 0.03);
        boxAt(g0, 0.42, 0.16, 0.42, spec.doorX + px, spec.groundY + 0.48, pz, archMats.bronzeMullion, false, false, 0.01);
        boxAt(g0, 0.44, 0.16, 0.44, spec.doorX + px, spec.groundY + spec.floorH - 0.42, pz, pal.copperFlashing, false, false, 0.01);
      });
    });
    // Copper Drip Trim along North Pergola Beam
    boxAt(g0, 14.1, 0.06, 0.12, spec.doorX, spec.groundY + spec.floorH - 0.24, spec.doorZ - 3.38, pal.copperFlashing, false, false);

    // Rooftop Off-Grid Eco-Lodge Solar PV Array, Twin Rainwater Cisterns & Brass Observation Telescope
    // 'stone_pergola' roof: eaveRoof on West (-spec.w * 0.12) sloping from South (0.76) up toward North (2.22) because rotFacingDoor=PI
    const solY = roofY + 2.32;
    addSolarPvRack(roofShellGroup, spec.cx - 2.8, solY - 0.4, spec.cz - 2.2, 6.8, 4.2, -0.14, 0, 0.85, pal);
    // Twin Galvanized Rainwater Harvesting Cisterns on Steel Cradles beside West Ashlar Turret
    const cisX = spec.cx - 11.4;
    [-5.0, -3.2].forEach((czOff) => {
      const cy = roofY + 1.65;
      boxAt(roofShellGroup, 1.45, 0.45, 1.35, cisX, roofY + 0.36, spec.cz + czOff, pal.structuralBlackSteel, true, true);
      const tank = cylAt(roofShellGroup, 0.62, 0.62, 1.55, cisX, cy - 0.4, spec.cz + czOff, pal.galvanizedSteel, true, true, 18);
      tank.rotation.z = Math.PI / 2;
      cylAt(roofShellGroup, 0.045, 0.045, 1.2, cisX + 0.85, roofY + 0.74, spec.cz + czOff, pal.copperFlashing, false, false, 8);
    });
    // Brass Safari Spotting Telescope on East Observation Terrace (top of baseDeck = roofY + 0.14)
    const telX = spec.cx + 8.0;
    const telZ = spec.cz - 5.6;
    cylAt(roofShellGroup, 0.04, 0.22, 1.18, telX, roofY + 0.73, telZ, archMats.bronzeMullion, false, false, 12);
    const scope = cylAt(roofShellGroup, 0.06, 0.095, 0.72, telX, roofY + 1.38, telZ - 0.14, pal.copperFlashing, false, false, 14);
    scope.rotation.x = Math.PI / 2 - 0.16;
    return;
  }

  if (spec.id === 'logistics') {
    // 1. Upgraded Cantilevered Steel I-Beam Dispatch Canopy & Safety Bollards (replaces basic logCanopy)
    const canY = spec.groundY + spec.floorH - 0.36;
    const canZ = spec.doorZ - 1.72;
    const logCan = boxAt(g0, 13.6, 0.2, 3.45, spec.doorX, canY, canZ, archMats.standingSeam, true, true, 0.03);
    boxAt(g0, 13.7, 0.08, 0.12, spec.doorX, canY + 0.08, canZ - 1.7, accentMat, false, false);
    boxAt(g0, 13.0, 0.05, 2.95, spec.doorX, canY - 0.11, canZ, archMats.timberSoffit, false, false);
    pickMeshes.push(logCan);
    [-5.2, -2.6, 0, 2.6, 5.2].forEach((ox) => {
      addIBeam(g0, spec.doorX + ox, canY - 0.15, canZ, 3.2, 0.22, 0.14, 'z', pal.structuralBlackSteel);
    });
    [-5.2, 5.2].forEach((px) => {
      const colX = spec.doorX + px;
      const colZ = spec.doorZ - 2.8;
      addBoltedBasePlate(g0, colX, spec.groundY, colZ, 0.58, pal.structuralBlackSteel, pal.concretePlinth);
      const cH = canY - spec.groundY - 0.24;
      cylAt(g0, 0.17, 0.2, cH, colX, spec.groundY + 0.2 + cH * 0.5, colZ, pal.galvanizedSteel, true, true, 14);
      cylAt(g0, 0.26, 0.26, 0.12, colX, canY - 0.14, colZ, accentMat, false, false, 14);
      // Protective corner safety bollards around column plinths
      [-0.45, 0.45].forEach((bx) => {
        cylAt(g0, 0.08, 0.08, 0.85, colX + bx, spec.groundY + 0.425, colZ - 0.42, pal.safetyYellow, true, true, 10);
      });
    });
    [-3.4, 0, 3.4].forEach((dx) => {
      downlight(g0, spec.doorX + dx, canY - 0.15, canZ, M, 0.15);
    });

    // 2. Heavy Steel East Freight Loading Dock Hardware (rubber bumpers, hydraulic dock levelers, hoist beams & signals)
    const dockX = spec.cx + spec.w * 0.5 + 0.06;
    const dockFloorY = spec.groundY + 0.12;
    [-3.5, 3.5].forEach((dz) => {
      const bayZ = spec.cz + dz;
      // Overhead steel hoist I-beam outrigger extending over truck apron
      addIBeam(g0, dockX + 0.95, dockFloorY + 3.28, bayZ, 1.85, 0.18, 0.12, 'x', pal.safetyYellow);
      // Heavy molded black rubber dock bumpers flanking shutter frame
      [-1.78, 1.78].forEach((bz) => {
        boxAt(g0, 0.24, 0.65, 0.26, dockX + 0.12, dockFloorY + 0.36, bayZ + bz, pal.dockRubber, true, true, 0.02);
      });
      // Diamond-plate hydraulic dock leveler lip ramp
      boxAt(g0, 0.62, 0.05, 2.2, dockX + 0.32, dockFloorY + 0.03, bayZ, pal.galvanizedSteel, false, true);
      // Red/Green Loading Dock Status Traffic Light mounted beside each bay
      boxAt(g0, 0.14, 0.42, 0.18, dockX + 0.1, dockFloorY + 2.55, bayZ + 2.02, pal.structuralBlackSteel, false, false);
      cylAt(g0, 0.045, 0.045, 0.06, dockX + 0.18, dockFloorY + 2.65, bayZ + 2.02, pal.beaconGreen, false, false, 10).rotation.z = Math.PI / 2;
      cylAt(g0, 0.045, 0.045, 0.06, dockX + 0.18, dockFloorY + 2.46, bayZ + 2.02, pal.beaconRed, false, false, 10).rotation.z = Math.PI / 2;
    });

    // 3. Rooftop Open-Lattice Port Radar Tower, Solar Shed Array, Dish & Turbine Ventilators
    const peakX = spec.w * 0.16; // +5.12m
    const halfShedW = (spec.w + 2.6) * 0.5;
    const shedHeightAt = (lx: number): number => {
      if (lx <= peakX) {
        return 0.45 + ((lx + halfShedW) / (peakX + halfShedW)) * (2.95 - 0.45);
      }
      return 2.95 + ((lx - peakX) / (halfShedW - peakX)) * (1.35 - 2.95);
    };

    // Open-Lattice Galvanized Radar & Telemetry Tower mounted cleanly on roof ridge (lx = +5.12m)
    const towX = spec.cx + peakX;
    const towZ = spec.cz;
    const towBaseY = roofY + 2.95;
    const towH = 3.6;
    [-0.55, 0.55].forEach((ox) => {
      [-0.55, 0.55].forEach((oz) => {
        addRodBetween(
          roofShellGroup,
          new THREE.Vector3(towX + ox, towBaseY - 0.05, towZ + oz),
          new THREE.Vector3(towX + ox * 0.65, towBaseY + towH, towZ + oz * 0.65),
          0.045,
          pal.galvanizedSteel,
          8
        );
      });
    });
    for (let b = 0; b < 3; b++) {
      const y0 = towBaseY + b * (towH / 3);
      const y1 = y0 + towH / 3;
      const r0 = THREE.MathUtils.lerp(0.55, 0.36, b / 3);
      const r1 = THREE.MathUtils.lerp(0.55, 0.36, (b + 1) / 3);
      addRodBetween(roofShellGroup, new THREE.Vector3(towX - r0, y0, towZ + r0), new THREE.Vector3(towX + r1, y1, towZ + r1), 0.02, pal.structuralBlackSteel, 6);
      addRodBetween(roofShellGroup, new THREE.Vector3(towX + r0, y0, towZ + r0), new THREE.Vector3(towX - r1, y1, towZ + r1), 0.02, pal.structuralBlackSteel, 6);
      addRodBetween(roofShellGroup, new THREE.Vector3(towX - r0, y0, towZ - r0), new THREE.Vector3(towX + r1, y1, towZ - r1), 0.02, pal.structuralBlackSteel, 6);
      addRodBetween(roofShellGroup, new THREE.Vector3(towX + r0, y0, towZ - r0), new THREE.Vector3(towX - r1, y1, towZ - r1), 0.02, pal.structuralBlackSteel, 6);
    }
    boxAt(roofShellGroup, 1.1, 0.1, 1.1, towX, towBaseY + towH + 0.05, towZ, pal.structuralBlackSteel, true, false);
    const portRadar = new THREE.Group();
    portRadar.position.set(towX, towBaseY + towH + 0.45, towZ);
    boxAt(portRadar, 2.45, 0.3, 0.26, 0, 0, 0, accentMat, true, false, 0.04);
    boxAt(portRadar, 2.52, 0.08, 0.08, 0, 0.18, 0, pal.brushedTitanium, false, false);
    roofShellGroup.add(portRadar);
    rotatingProps.push({ obj: portRadar, speed: 1.45, axis: 'y' });

    // Pitched PV Solar Microgrid Panels parallel to the West Shed Slope
    const westPitch = Math.atan2(2.95 - 0.45, peakX + halfShedW);
    [-4.6, 4.6].forEach((pz) => {
      addSolarPvRack(roofShellGroup, spec.cx - 4.8, roofY + shedHeightAt(-4.8), spec.cz + pz, 7.4, 4.0, 0, westPitch, 0.45, pal);
    });

    // Twin Spinning Industrial Turbine Roof Ventilators on East Shed Slope + Microwave Dispatch Dish
    [-3.6, 3.6].forEach((vz) => {
      const vx = spec.cx + 10.6;
      const vy = roofY + shedHeightAt(10.6);
      cylAt(roofShellGroup, 0.46, 0.56, 0.42, vx, vy + 0.15, spec.cz + vz, pal.galvanizedSteel, true, false, 14);
      const rotor = new THREE.Group();
      rotor.position.set(vx, vy + 0.52, spec.cz + vz);
      cylAt(rotor, 0.44, 0.36, 0.42, 0, 0, 0, pal.brushedTitanium, true, false, 12);
      for (let f = 0; f < 6; f++) {
        const ang = (f * Math.PI) / 3;
        boxAt(rotor, 0.04, 0.38, 0.12, Math.cos(ang) * 0.42, 0, Math.sin(ang) * 0.42, pal.structuralBlackSteel, false, false);
      }
      roofShellGroup.add(rotor);
      rotatingProps.push({ obj: rotor, speed: 2.2, axis: 'y' });
    });

    addSatelliteDishMast(roofShellGroup, spec.cx + 10.6, roofY + shedHeightAt(10.6) - 0.05, spec.cz, -Math.PI / 2, pal);
    addStairPenthouseBulkhead(roofShellGroup, spec.cx - 12.8, roofY + shedHeightAt(-12.8) - 0.25, spec.cz + 5.8, 2.8, 3.6, 1.55, archMats.standingSeam, accentMat, pal, 'east');
  }
}
