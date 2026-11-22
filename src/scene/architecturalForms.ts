import * as THREE from 'three';
import type { MaterialLibrary } from './materials';
import { getMaxAnisotropy, heightCanvasToNormalTex, leafTex, makeCanvasTex } from './textures';

export interface ArchitecturalMaterials {
  stuccoWhite: THREE.MeshStandardMaterial;
  bullnoseConcrete: THREE.MeshStandardMaterial;
  timberSoffit: THREE.MeshStandardMaterial;
  timberFin: THREE.MeshStandardMaterial;
  ashlarStone: THREE.MeshStandardMaterial;
  standingSeam: THREE.MeshStandardMaterial;
  bronzeMullion: THREE.MeshStandardMaterial;
  poolWater: THREE.MeshPhysicalMaterial;
  planterBox: THREE.MeshStandardMaterial;
  foliageLush: THREE.MeshStandardMaterial;
  foliagePalm: THREE.MeshStandardMaterial;
}

let cachedArchMats: ArchitecturalMaterials | null = null;
const FORM_GEO_CACHE = new Map<string, THREE.BufferGeometry>();
let leafCardGeo: THREE.PlaneGeometry | null = null;
let palmFrondGeo: THREE.PlaneGeometry | null = null;

function getLeafCardGeo(): THREE.PlaneGeometry {
  if (!leafCardGeo) leafCardGeo = new THREE.PlaneGeometry(0.56, 0.44);
  return leafCardGeo;
}

function getPalmFrondGeo(): THREE.PlaneGeometry {
  if (!palmFrondGeo) palmFrondGeo = new THREE.PlaneGeometry(1.65, 0.62);
  return palmFrondGeo;
}

export function clearArchitecturalFormsCache() {
  if (cachedArchMats) {
    Object.values(cachedArchMats).forEach((m) => (m as THREE.Material).dispose());
    cachedArchMats = null;
  }
  FORM_GEO_CACHE.forEach((g) => g.dispose());
  FORM_GEO_CACHE.clear();
  if (leafCardGeo) {
    leafCardGeo.dispose();
    leafCardGeo = null;
  }
  if (palmFrondGeo) {
    palmFrondGeo.dispose();
    palmFrondGeo = null;
  }
}

function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function getArchitecturalMaterials(M: MaterialLibrary): ArchitecturalMaterials {
  if (cachedArchMats) return cachedArchMats;

  // 1. Natural Ashlar Stone (warm tropical-modern feature piers like Reference Image 4)
  const stoneTex = makeCanvasTex('arch_ashlar_stone_col', 512, 512, (g, W, H) => {
    g.fillStyle = '#8b7b66';
    g.fillRect(0, 0, W, H);
    const rows = 8;
    const rowH = H / rows;
    const palette = ['#b7a286', '#a89174', '#c5b194', '#9a8468', '#b0997b', '#8f7b62'];
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -48;
      let idx = r * 17;
      while (x < W) {
        const bw = 72 + Math.floor(seeded(idx++) * 68);
        const col = palette[Math.floor(seeded(idx * 3) * palette.length)];
        g.fillStyle = col;
        g.fillRect(x + 3, r * rowH + 3, bw - 6, rowH - 6);
        // Subtle mineral mottling
        for (let k = 0; k < 14; k++) {
          g.fillStyle =
            k % 2 === 0 ? 'rgba(255,248,236,0.08)' : 'rgba(55,44,32,0.10)';
          const mx = x + 6 + seeded(idx * 11 + k) * Math.max(8, bw - 14);
          const my = r * rowH + 5 + seeded(idx * 19 + k) * (rowH - 12);
          g.fillRect(mx, my, 10 + seeded(k) * 18, 6 + seeded(k + 3) * 10);
        }
        // Dark mortar recess shadow
        g.strokeStyle = 'rgba(42,34,26,0.55)';
        g.lineWidth = 3;
        g.strokeRect(x + 2, r * rowH + 2, bw - 4, rowH - 4);
        x += bw;
      }
    }
  });
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.repeat.set(0.32, 0.32);
  stoneTex.anisotropy = getMaxAnisotropy();

  const stoneNorm = heightCanvasToNormalTex(
    'arch_ashlar_stone_nrm',
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#383838';
      g.fillRect(0, 0, W, H);
      const rows = 8;
      const rowH = H / rows;
      for (let r = 0; r < rows; r++) {
        let x = (r % 2) * -24;
        let idx = r * 17;
        while (x < W) {
          const bw = 36 + Math.floor(seeded(idx++) * 34);
          const tone = 165 + Math.floor(seeded(idx * 5) * 65);
          g.fillStyle = `rgb(${tone},${tone},${tone})`;
          g.fillRect(x + 2, r * rowH + 2, bw - 4, rowH - 4);
          x += bw;
        }
      }
    },
    2.6
  );
  stoneNorm.wrapS = stoneNorm.wrapT = THREE.RepeatWrapping;
  stoneNorm.repeat.set(0.32, 0.32);

  // 2. Dark Standing-Seam Ribbed Architectural Cladding (Reference Image 1 & Image 3)
  const seamTex = makeCanvasTex('arch_standing_seam_col', 256, 256, (g, W, H) => {
    g.fillStyle = '#2b3036';
    g.fillRect(0, 0, W, H);
    const step = 16;
    for (let x = 0; x < W; x += step) {
      g.fillStyle = '#373d45';
      g.fillRect(x + 2, 0, step - 4, H);
      g.fillStyle = '#1b1f24';
      g.fillRect(x, 0, 2, H);
      g.fillStyle = '#4c535e';
      g.fillRect(x + 2, 0, 2, H);
    }
  });
  seamTex.wrapS = seamTex.wrapT = THREE.RepeatWrapping;
  seamTex.repeat.set(0.28, 0.28);
  seamTex.anisotropy = getMaxAnisotropy();

  const seamNorm = heightCanvasToNormalTex(
    'arch_standing_seam_nrm',
    256,
    256,
    (g, W, H) => {
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      const step = 16;
      for (let x = 0; x < W; x += step) {
        g.fillStyle = '#e8e8e8';
        g.fillRect(x + 1, 0, 3, H);
        g.fillStyle = '#444444';
        g.fillRect(x + 4, 0, 2, H);
      }
    },
    2.4
  );
  seamNorm.wrapS = seamNorm.wrapT = THREE.RepeatWrapping;
  seamNorm.repeat.set(0.28, 0.28);

  // 3. Warm Cedar Soffit Planks (Reference Image 1, 3, 4)
  const soffitTex = M.textures.woodTex.clone();
  soffitTex.needsUpdate = true;
  soffitTex.wrapS = soffitTex.wrapT = THREE.RepeatWrapping;
  soffitTex.repeat.set(0.45, 0.45);

  const soffitNorm = M.textures.woodNormal.clone();
  soffitNorm.needsUpdate = true;
  soffitNorm.wrapS = soffitNorm.wrapT = THREE.RepeatWrapping;
  soffitNorm.repeat.set(0.45, 0.45);

  cachedArchMats = {
    stuccoWhite: new THREE.MeshStandardMaterial({
      color: 0xf0ede6,
      roughness: 0.72,
      metalness: 0.02,
      envMapIntensity: 0.25,
    }),
    bullnoseConcrete: new THREE.MeshStandardMaterial({
      map: M.textures.concreteTex,
      normalMap: M.textures.concreteNormal,
      normalScale: new THREE.Vector2(0.32, 0.32),
      color: 0xeae6dd,
      roughness: 0.56,
      metalness: 0.04,
      envMapIntensity: 0.32,
    }),
    timberSoffit: new THREE.MeshStandardMaterial({
      map: soffitTex,
      normalMap: soffitNorm,
      normalScale: new THREE.Vector2(0.55, 0.55),
      color: 0xb97b49,
      roughness: 0.62,
      metalness: 0.03,
      envMapIntensity: 0.28,
    }),
    timberFin: new THREE.MeshStandardMaterial({
      map: M.textures.woodTex,
      normalMap: M.textures.woodNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      color: 0xa46c40,
      roughness: 0.64,
      metalness: 0.02,
      envMapIntensity: 0.24,
    }),
    ashlarStone: new THREE.MeshStandardMaterial({
      map: stoneTex,
      normalMap: stoneNorm,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.2,
    }),
    standingSeam: new THREE.MeshStandardMaterial({
      map: seamTex,
      normalMap: seamNorm,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0x3b424b,
      roughness: 0.48,
      metalness: 0.42,
      envMapIntensity: 0.48,
    }),
    bronzeMullion: new THREE.MeshStandardMaterial({
      color: 0x2a2623,
      roughness: 0.36,
      metalness: 0.54,
      envMapIntensity: 0.55,
    }),
    poolWater: new THREE.MeshPhysicalMaterial({
      color: 0x1ea7cb,
      roughness: 0.08,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.84,
      envMapIntensity: 1.0,
    }),
    planterBox: new THREE.MeshStandardMaterial({
      color: 0x5c574f,
      roughness: 0.86,
      metalness: 0.04,
      envMapIntensity: 0.2,
    }),
    foliageLush: new THREE.MeshStandardMaterial({
      map: leafTex('broad'),
      color: 0x478c39,
      transparent: true,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.78,
    }),
    foliagePalm: new THREE.MeshStandardMaterial({
      map: leafTex('fern'),
      color: 0x539941,
      transparent: true,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.74,
    }),
  };

  return cachedArchMats;
}

/**
 * Helper to create a rounded-rectangle 2D THREE.Shape centered at (0,0).
 */
function makeRoundedRectShape(w: number, d: number, r: number): THREE.Shape {
  const hw = w * 0.5;
  const hd = d * 0.5;
  const cr = Math.min(r, hw * 0.48, hd * 0.48);
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hd);
  s.lineTo(hw - cr, -hd);
  s.absarc(hw - cr, -hd + cr, cr, -Math.PI / 2, 0, false);
  s.lineTo(hw, hd - cr);
  s.absarc(hw - cr, hd - cr, cr, 0, Math.PI / 2, false);
  s.lineTo(-hw + cr, hd);
  s.absarc(-hw + cr, hd - cr, cr, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hd + cr);
  s.absarc(-hw + cr, -hd + cr, cr, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * Rounded-corner horizontal slab (ExtrudeGeometry with bullnose bevel), centered at Y=0.
 */
export function getRoundedSlabGeo(
  w: number,
  d: number,
  r: number,
  thick: number,
  bevel = 0.06
): THREE.BufferGeometry {
  const key = `rslab_${w.toFixed(2)}_${d.toFixed(2)}_${r.toFixed(2)}_${thick.toFixed(2)}_${bevel.toFixed(2)}`;
  const cached = FORM_GEO_CACHE.get(key);
  if (cached) return cached;

  const b = Math.min(bevel, thick * 0.36);
  const innerThick = Math.max(0.02, thick - b * 2);
  const shape = makeRoundedRectShape(Math.max(0.4, w - b * 2), Math.max(0.4, d - b * 2), Math.max(0.1, r - b));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerThick,
    bevelEnabled: b > 0.005,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 14,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -innerThick * 0.5, 0);
  FORM_GEO_CACHE.set(key, geo);
  return geo;
}

/**
 * Hollow rounded-corner wraparound balcony ribbon (keeps interior cutout open for stairwells & cutaway visibility).
 */
export function getRoundedRibbonGeo(
  outerW: number,
  outerD: number,
  outerR: number,
  rimX: number,
  rimZ: number,
  thick: number,
  bevel = 0.055
): THREE.BufferGeometry {
  const key = `rrib_${outerW.toFixed(2)}_${outerD.toFixed(2)}_${outerR.toFixed(2)}_${rimX.toFixed(2)}_${rimZ.toFixed(2)}_${thick.toFixed(2)}`;
  const cached = FORM_GEO_CACHE.get(key);
  if (cached) return cached;

  const b = Math.min(bevel, thick * 0.35);
  const innerThick = Math.max(0.02, thick - b * 2);
  const shape = makeRoundedRectShape(outerW - b * 2, outerD - b * 2, Math.max(0.2, outerR - b));

  const holeW = Math.max(1, outerW - rimX * 2);
  const holeD = Math.max(1, outerD - rimZ * 2);
  const holeR = Math.max(0.15, outerR - Math.max(rimX, rimZ));
  const hw = holeW * 0.5;
  const hd = holeD * 0.5;
  const cr = Math.min(holeR, hw * 0.45, hd * 0.45);
  const hole = new THREE.Path();
  // Clockwise winding for hole
  hole.moveTo(-hw + cr, -hd);
  hole.absarc(-hw + cr, -hd + cr, cr, -Math.PI / 2, -Math.PI, true);
  hole.lineTo(-hw, hd - cr);
  hole.absarc(-hw + cr, hd - cr, cr, Math.PI, Math.PI / 2, true);
  hole.lineTo(hw - cr, hd);
  hole.absarc(hw - cr, hd - cr, cr, Math.PI / 2, 0, true);
  hole.lineTo(hw, -hd + cr);
  hole.absarc(hw - cr, -hd + cr, cr, 0, -Math.PI / 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerThick,
    bevelEnabled: b > 0.005,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 14,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -innerThick * 0.5, 0);
  FORM_GEO_CACHE.set(key, geo);
  return geo;
}

/**
 * Curved-corner vertical glass band or balustrade ring (hollow thin perimeter wall with rounded corners).
 */
export function getRoundedPerimeterWallGeo(
  w: number,
  d: number,
  r: number,
  h: number,
  wallThick = 0.04
): THREE.BufferGeometry {
  const key = `rwall_${w.toFixed(2)}_${d.toFixed(2)}_${r.toFixed(2)}_${h.toFixed(2)}_${wallThick.toFixed(3)}`;
  const cached = FORM_GEO_CACHE.get(key);
  if (cached) return cached;

  const shape = makeRoundedRectShape(w, d, r);
  const iw = Math.max(0.2, w - wallThick * 2);
  const id = Math.max(0.2, d - wallThick * 2);
  const ir = Math.max(0.08, r - wallThick);
  const hw = iw * 0.5;
  const hd = id * 0.5;
  const cr = Math.min(ir, hw * 0.45, hd * 0.45);
  const hole = new THREE.Path();
  hole.moveTo(-hw + cr, -hd);
  hole.absarc(-hw + cr, -hd + cr, cr, -Math.PI / 2, -Math.PI, true);
  hole.lineTo(-hw, hd - cr);
  hole.absarc(-hw + cr, hd - cr, cr, Math.PI, Math.PI / 2, true);
  hole.lineTo(hw - cr, hd);
  hole.absarc(hw - cr, hd - cr, cr, Math.PI / 2, 0, true);
  hole.lineTo(hw, -hd + cr);
  hole.absarc(hw - cr, -hd + cr, cr, 0, -Math.PI / 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: false,
    curveSegments: 14,
  });
  geo.rotateX(-Math.PI / 2);
  FORM_GEO_CACHE.set(key, geo);
  return geo;
}

/**
 * Sweeping cantilevered sloped blade roof (cross-section in Z/Y extruded along X) like Reference Image 3.
 * Back Z = -d/2, Front Z = +d/2.
 */
export function getSlopedRoofBladeGeo(
  w: number,
  d: number,
  backBotY: number,
  backTopY: number,
  frontBotY: number,
  frontTopY: number,
  bevel = 0.04
): THREE.BufferGeometry {
  const key = `blade_${w.toFixed(2)}_${d.toFixed(2)}_${backBotY.toFixed(2)}_${backTopY.toFixed(2)}_${frontBotY.toFixed(2)}_${frontTopY.toFixed(2)}`;
  const cached = FORM_GEO_CACHE.get(key);
  if (cached) return cached;

  const hd = d * 0.5;
  const s = new THREE.Shape();
  // Note: rotateY(PI/2) maps shape X -> -Z, so shape x = -z
  s.moveTo(-hd, frontBotY);
  s.lineTo(hd, backBotY);
  s.lineTo(hd, backTopY);
  s.lineTo(-hd, frontTopY);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.2, w - bevel * 2),
    bevelEnabled: bevel > 0.005,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(-(w - bevel * 2) * 0.5, 0, 0);
  FORM_GEO_CACHE.set(key, geo);
  return geo;
}

/**
 * Asymmetric sloped shed/gable roof shell (extruded along Z from -d/2 to +d/2), like Reference Image 1 right wing.
 */
export function getAsymmetricShedRoofGeo(
  w: number,
  d: number,
  leftY: number,
  peakX: number,
  peakY: number,
  rightY: number,
  thick = 0.34,
  bevel = 0.04
): THREE.BufferGeometry {
  const key = `shed_${w.toFixed(2)}_${d.toFixed(2)}_${leftY.toFixed(2)}_${peakX.toFixed(2)}_${peakY.toFixed(2)}_${rightY.toFixed(2)}_${thick.toFixed(2)}`;
  const cached = FORM_GEO_CACHE.get(key);
  if (cached) return cached;

  const hw = w * 0.5;
  const s = new THREE.Shape();
  s.moveTo(-hw, leftY);
  s.lineTo(peakX, peakY);
  s.lineTo(hw, rightY);
  s.lineTo(hw, rightY + thick);
  s.lineTo(peakX, peakY + thick);
  s.lineTo(-hw, leftY + thick);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.2, d - bevel * 2),
    bevelEnabled: bevel > 0.005,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -(d - bevel * 2) * 0.5);
  FORM_GEO_CACHE.set(key, geo);
  return geo;
}

/**
 * Asymmetric pentagon gable clerestory wall fitting strictly beneath getAsymmetricShedRoofGeo.
 */
export function getGableClerestoryGeo(
  w: number,
  leftY: number,
  peakX: number,
  peakY: number,
  rightY: number,
  depth = 0.06
): THREE.BufferGeometry {
  const key = `gable_clere_${w.toFixed(2)}_${leftY.toFixed(2)}_${peakX.toFixed(2)}_${peakY.toFixed(2)}_${rightY.toFixed(2)}_${depth.toFixed(2)}`;
  const cached = FORM_GEO_CACHE.get(key);
  if (cached) return cached;

  const hw = w * 0.5;
  const clampedPeakX = Math.max(-hw + 0.1, Math.min(hw - 0.1, peakX));
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, Math.max(0.15, rightY));
  s.lineTo(clampedPeakX, Math.max(0.2, peakY));
  s.lineTo(-hw, Math.max(0.15, leftY));
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -depth * 0.5);
  FORM_GEO_CACHE.set(key, geo);
  return geo;
}

/**
 * Lush cascading balcony planter trough with broadleaf greenery (Reference Image 2 & 4).
 */
export function buildPlanterTrough(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  len: number,
  rotY: number,
  seed: number,
  archMats: ArchitecturalMaterials
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  const trough = new THREE.Mesh(
    getRoundedSlabGeo(len, 0.44, 0.12, 0.34, 0.03),
    archMats.planterBox
  );
  trough.position.y = 0.17;
  trough.castShadow = true;
  trough.receiveShadow = true;
  g.add(trough);

  const count = Math.max(4, Math.floor(len * 4.5));
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const lx = (t - 0.5) * (len - 0.32);
    const card = new THREE.Mesh(getLeafCardGeo(), archMats.foliageLush);
    const r1 = seeded(seed * 17 + i * 3);
    const r2 = seeded(seed * 29 + i * 7);
    card.position.set(lx, 0.42 + r1 * 0.18, (r2 - 0.5) * 0.22);
    card.rotation.set(-0.48 + (r1 - 0.5) * 0.4, r2 * Math.PI * 2, (i % 2 ? 1 : -1) * 0.32);
    card.scale.setScalar(0.85 + r1 * 0.45);
    g.add(card);
  }

  parent.add(g);
}

/**
 * Multi-frond tropical palm tree for rooftop gardens & forecourt plazas (Reference Image 1, 2, 4).
 */
export function buildTropicalPalm(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  height: number,
  seed: number,
  M: MaterialLibrary,
  archMats: ArchitecturalMaterials
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Curved multi-segment trunk
  const bendX = (seeded(seed + 1) - 0.5) * 0.45;
  const bendZ = (seeded(seed + 2) - 0.5) * 0.45;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bendX * 0.35, height * 0.42, bendZ * 0.35),
    new THREE.Vector3(bendX, height, bendZ),
  ]);
  const trunk = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 10, 0.13, 8, false),
    M.bark
  );
  trunk.castShadow = true;
  g.add(trunk);

  const crown = new THREE.Group();
  crown.position.set(bendX, height, bendZ);
  g.add(crown);

  const frondCount = 9;
  for (let i = 0; i < frondCount; i++) {
    const ang = (i / frondCount) * Math.PI * 2 + seeded(seed + i * 5) * 0.3;
    const frondPivot = new THREE.Group();
    frondPivot.rotation.y = ang;
    const frond = new THREE.Mesh(getPalmFrondGeo(), archMats.foliagePalm);
    frond.position.set(0.75, 0.08, 0);
    frond.rotation.set(0.18, 0, -0.35 - (i % 3) * 0.14);
    frond.scale.set(0.82 + (height / 4) * 0.32, 0.9, 1);
    frondPivot.add(frond);
    crown.add(frondPivot);
  }

  parent.add(g);
}

/**
 * Timber-beam vine-draped porte-cochère / pergola canopy on stone piers (Reference Image 4).
 */
export function buildVinePergolaCanopy(
  parent: THREE.Object3D,
  cx: number,
  baseY: number,
  cz: number,
  w: number,
  d: number,
  h: number,
  pierOffsetsX: number[],
  seed: number,
  archMats: ArchitecturalMaterials
) {
  const g = new THREE.Group();
  g.position.set(cx, baseY, cz);

  // Stone piers at front edge, clear of central entrance doorway
  for (const px of pierOffsetsX) {
    const pier = new THREE.Mesh(
      getRoundedSlabGeo(0.68, 0.68, 0.1, h, 0.025),
      archMats.ashlarStone
    );
    pier.position.set(px, h * 0.5, d * 0.42);
    pier.castShadow = true;
    pier.receiveShadow = true;
    g.add(pier);
  }

  // Primary longitudinal timber header beams
  const beamH = 0.24;
  [-d * 0.42, d * 0.42].forEach((bz) => {
    const beam = new THREE.Mesh(
      getRoundedSlabGeo(w, 0.22, 0.04, beamH, 0.015),
      archMats.timberFin
    );
    beam.position.set(0, h + beamH * 0.5, bz);
    beam.castShadow = true;
    g.add(beam);
  });

  // Transverse pergola rafters + warm vine drapery
  const rafterCount = Math.max(6, Math.round(w / 0.85));
  for (let i = 0; i < rafterCount; i++) {
    const rx = -w * 0.47 + (i / Math.max(1, rafterCount - 1)) * (w * 0.94);
    const rafter = new THREE.Mesh(
      getRoundedSlabGeo(0.11, d, 0.02, 0.2, 0.01),
      archMats.timberSoffit
    );
    rafter.position.set(rx, h + beamH + 0.08, 0);
    rafter.castShadow = true;
    g.add(rafter);

    if (i % 2 === 0) {
      const vine = new THREE.Mesh(getLeafCardGeo(), archMats.foliageLush);
      vine.position.set(rx, h + beamH + 0.22, (seeded(seed + i * 7) - 0.5) * d * 0.65);
      vine.rotation.set(-0.35, seeded(seed + i * 13) * Math.PI * 2, 0.22);
      vine.scale.set(1.25, 1.1, 1);
      g.add(vine);
    }
  }

  // Trailing greenery along outer pergola rim
  const rimLeafCount = Math.max(8, Math.round(w * 1.4));
  for (let i = 0; i < rimLeafCount; i++) {
    const rx = -w * 0.46 + (i / Math.max(1, rimLeafCount - 1)) * (w * 0.92);
    const leaf = new THREE.Mesh(getLeafCardGeo(), archMats.foliageLush);
    leaf.position.set(rx, h + 0.08 - seeded(seed + i) * 0.14, d * 0.47);
    leaf.rotation.set(0.32, (seeded(seed + i * 3) - 0.5) * 1.1, (i % 2 ? 1 : -1) * 0.28);
    leaf.scale.set(0.95, 0.95, 1);
    g.add(leaf);
  }

  parent.add(g);
}
