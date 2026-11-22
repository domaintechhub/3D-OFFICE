import * as THREE from 'three';
import type { MaterialLibrary } from './materials';
import { ARCH_LEAF_GEO, CROSSED_SPRAY_GEO, contact } from './props';
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
  mulchEarth: THREE.MeshStandardMaterial;
  riverStoneLight: THREE.MeshStandardMaterial;
  riverStoneWarm: THREE.MeshStandardMaterial;
  foliageLush: THREE.MeshStandardMaterial;
  foliagePalm: THREE.MeshStandardMaterial;
  foliageShrub: THREE.MeshStandardMaterial;
  foliageBlossom: THREE.MeshStandardMaterial;
  foliageVine: THREE.MeshStandardMaterial;
  foliageAgave: THREE.MeshStandardMaterial;
}

let cachedArchMats: ArchitecturalMaterials | null = null;
const FORM_GEO_CACHE = new Map<string, THREE.BufferGeometry>();
let leafCardGeo: THREE.BufferGeometry | null = null;
let palmFrondGeo: THREE.BufferGeometry | null = null;
let boulderGeo: THREE.BufferGeometry | null = null;

function getLeafCardGeo(): THREE.BufferGeometry {
  return ARCH_LEAF_GEO;
}

/** Parabolic-arched, V-ribbed 3D palm frond extending radially along +X from 0 to 1.85m. */
function getPalmFrondGeo(): THREE.BufferGeometry {
  if (palmFrondGeo) return palmFrondGeo;
  const g = new THREE.PlaneGeometry(1.85, 0.66, 12, 3);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i); // -0.925 .. +0.925
    const py = pos.getY(i); // -0.33 .. +0.33 (becomes width Z after mapping)
    const t = (px + 0.925) / 1.85; // 0 at stem base -> 1 at frond tip
    const worldX = t * 1.85;
    // Natural parabolic arch upward near crown then graceful droop toward tip
    const archY = Math.sin(t * Math.PI * 0.72) * 0.34 - t * t * 0.68;
    // Leaflet V-droop away from central rachis rib
    const widthNorm = Math.abs(py) / 0.33;
    const vDroop = -widthNorm * (0.07 + 0.08 * t);
    const widthTaper = py * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(0.95, t * 0.88 + 0.08)));

    pos.setXYZ(i, worldX, archY + vDroop, widthTaper);
    // Remap UV so stem base is V=0 and frond tip is V=1 matching leafShapeDraw.frond
    uv.setXY(i, (py + 0.33) / 0.66, t);
  }
  g.computeVertexNormals();
  palmFrondGeo = g;
  return palmFrondGeo;
}

function getBoulderGeo(): THREE.BufferGeometry {
  if (boulderGeo) return boulderGeo;
  const g = new THREE.IcosahedronGeometry(0.5, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = 0.84 + 0.24 * Math.sin(x * 7.3 + y * 5.1) * Math.cos(z * 6.4);
    pos.setXYZ(i, x * n, y * 0.66 * (0.9 + 0.14 * Math.cos(x * 4.2)), z * n);
  }
  g.computeVertexNormals();
  boulderGeo = g;
  return boulderGeo;
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
  if (boulderGeo) {
    boulderGeo.dispose();
    boulderGeo = null;
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
      map: M.textures.concreteTex,
      normalMap: M.textures.concreteNormal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      color: 0xbcb7ae,
      roughness: 0.84,
      metalness: 0.03,
      envMapIntensity: 0.22,
    }),
    mulchEarth: new THREE.MeshStandardMaterial({
      normalMap: M.textures.concreteNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0x3b2c1e,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.08,
    }),
    riverStoneLight: new THREE.MeshStandardMaterial({
      map: stoneTex,
      normalMap: stoneNorm,
      normalScale: new THREE.Vector2(0.6, 0.6),
      color: 0xc2bcb0,
      roughness: 0.86,
      metalness: 0.02,
      envMapIntensity: 0.22,
    }),
    riverStoneWarm: new THREE.MeshStandardMaterial({
      map: stoneTex,
      normalMap: stoneNorm,
      normalScale: new THREE.Vector2(0.6, 0.6),
      color: 0x9b8e7c,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.2,
    }),
    foliageLush: new THREE.MeshStandardMaterial({
      map: leafTex('broad'),
      color: 0x5c9c46,
      transparent: true,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      roughness: 0.76,
    }),
    foliagePalm: new THREE.MeshStandardMaterial({
      map: leafTex('frond'),
      color: 0x8fc074,
      transparent: true,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.72,
    }),
    foliageShrub: new THREE.MeshStandardMaterial({
      map: leafTex('shrubCluster'),
      color: 0xdbe8c6,
      transparent: true,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.8,
      envMapIntensity: 0.16,
    }),
    foliageBlossom: new THREE.MeshStandardMaterial({
      map: leafTex('blossomCluster'),
      color: 0xf4f7eb,
      transparent: true,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.78,
      envMapIntensity: 0.18,
    }),
    foliageVine: new THREE.MeshStandardMaterial({
      map: leafTex('vineCluster'),
      color: 0xdce8c6,
      transparent: true,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.78,
      envMapIntensity: 0.16,
    }),
    foliageAgave: new THREE.MeshStandardMaterial({
      map: leafTex('strap'),
      color: 0x62964c,
      transparent: true,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      roughness: 0.68,
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
 * Lush cascading balcony planter trough with overflowing volumetric greenery & trailing ivy (Reference Image 3 & 4).
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
  g.userData.genericPlantBlock = { kind: 'planterTrough', len };

  const trough = new THREE.Mesh(
    getRoundedSlabGeo(len, 0.46, 0.12, 0.34, 0.03),
    archMats.planterBox
  );
  trough.position.y = 0.17;
  trough.castShadow = true;
  trough.receiveShadow = true;
  g.add(trough);

  // Dark soil bed top strip
  const soil = new THREE.Mesh(
    getRoundedSlabGeo(Math.max(0.3, len - 0.14), 0.32, 0.06, 0.05, 0.01),
    archMats.mulchEarth
  );
  soil.position.y = 0.33;
  g.add(soil);

  // Volumetric 3D bush sprays + trailing cascading ivy vines spilling over front edge
  const sprayN = Math.max(3, Math.round(len / 0.52));
  for (let i = 0; i < sprayN; i++) {
    const t = sprayN === 1 ? 0.5 : i / (sprayN - 1);
    const lx = (t - 0.5) * (len - 0.34);
    const r1 = seeded(seed * 17 + i * 3);
    const r2 = seeded(seed * 29 + i * 7);

    const mound = new THREE.Mesh(CROSSED_SPRAY_GEO, i % 3 === 0 ? archMats.foliageBlossom : archMats.foliageShrub);
    const sc = 0.55 + r1 * 0.25;
    mound.scale.set(sc * 1.1, sc * 0.9, sc);
    mound.position.set(lx, 0.44 + r1 * 0.12, (r2 - 0.5) * 0.14);
    mound.rotation.set((r1 - 0.5) * 0.25, r2 * Math.PI * 2, (r2 - 0.5) * 0.2);
    mound.userData.genericPlantPiece = true;
    g.add(mound);

    if (i % 2 === 0) {
      const drape = new THREE.Mesh(getLeafCardGeo(), archMats.foliageVine);
      drape.position.set(lx + (r2 - 0.5) * 0.12, 0.26 - r1 * 0.08, 0.24);
      drape.rotation.set(0.38, (r1 - 0.5) * 0.4, (r2 - 0.5) * 0.3);
      drape.scale.set(0.55 + r1 * 0.2, 0.58 + r2 * 0.25, 0.5);
      drape.userData.genericPlantPiece = true;
      g.add(drape);
    }
  }

  parent.add(g);
}

/**
 * Multi-frond tropical palm tree with ringed trunk, fibrous crownshaft & 17 arched 3D fronds (Reference Image 1, 2, 4).
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

  contact(g, 0, 0.02, 0, 2.8, 2.8, 0.45, M.textures.shadowTex);

  // Curved organically tapered & leaf-scar-ringed trunk
  const bendX = (seeded(seed + 1) - 0.5) * 0.58;
  const bendZ = (seeded(seed + 2) - 0.5) * 0.58;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bendX * 0.32, height * 0.44, bendZ * 0.32),
    new THREE.Vector3(bendX, height, bendZ),
  ]);
  const trunkGeo = new THREE.TubeGeometry(curve, 18, 0.145, 9, false);
  const pos = trunkGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    const t = Math.max(0, Math.min(1, py / Math.max(0.1, height)));
    const center = curve.getPointAt(t);
    const taper = 1.48 - t * 0.62 + 0.08 * Math.sin(t * Math.PI * 16); // realistic palm bark rings
    pos.setX(i, center.x + (pos.getX(i) - center.x) * taper);
    pos.setZ(i, center.z + (pos.getZ(i) - center.z) * taper);
  }
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, M.bark);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  // Fibrous green-brown crownshaft collar at summit
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.16, 0.42, 10), archMats.foliagePalm);
  shaft.position.set(bendX, height + 0.14, bendZ);
  g.add(shaft);

  const crown = new THREE.Group();
  crown.position.set(bendX, height + 0.24, bendZ);
  g.add(crown);

  // 3 tiers totaling 17 arching 3D fronds (lower heavy droop, mid lush spread, upper spears)
  const tiers = [
    { count: 6, elev: -0.22, sc: 1.05, yOff: -0.06, roll: 0.15 },
    { count: 7, elev: 0.18, sc: 0.96, yOff: 0.02, roll: 0.08 },
    { count: 4, elev: 0.56, sc: 0.78, yOff: 0.1, roll: 0.0 },
  ];
  const baseScale = 0.76 + (height / 4.2) * 0.28;
  tiers.forEach((tier, ti) => {
    for (let i = 0; i < tier.count; i++) {
      const ang = (i / tier.count) * Math.PI * 2 + ti * 0.45 + seeded(seed + i * 7 + ti * 13) * 0.26;
      const frondPivot = new THREE.Group();
      frondPivot.rotation.y = ang;
      const frond = new THREE.Mesh(getPalmFrondGeo(), archMats.foliagePalm);
      const ls = baseScale * tier.sc * (0.92 + seeded(seed + i * 11 + ti) * 0.18);
      frond.scale.set(ls, ls, ls);
      frond.position.set(0, tier.yOff, 0);
      frond.rotation.set(tier.roll * (i % 2 ? 1 : -1), 0, tier.elev);
      frond.castShadow = true;
      frondPivot.add(frond);
      crown.add(frondPivot);
    }
  });

  parent.add(g);
}

/**
 * Timber-beam vine-draped porte-cochère / pergola canopy on stone piers with spiral climbing vines (Reference Image 4).
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

  // Stone piers + climbing woody vine tendrils + cascading foliage sleeves
  for (let pi = 0; pi < pierOffsetsX.length; pi++) {
    const px = pierOffsetsX[pi];
    const pz = d * 0.42;
    const pier = new THREE.Mesh(
      getRoundedSlabGeo(0.68, 0.68, 0.1, h, 0.025),
      archMats.ashlarStone
    );
    pier.position.set(px, h * 0.5, pz);
    pier.castShadow = true;
    pier.receiveShadow = true;
    g.add(pier);

    // Climbing spiral vine spray clusters clinging up the stone column
    for (let vy = 0.55; vy < h - 0.15; vy += 0.72) {
      const va = vy * 2.2 + pi * 1.4;
      const cluster = new THREE.Mesh(CROSSED_SPRAY_GEO, archMats.foliageShrub);
      cluster.scale.set(0.54, 0.62, 0.54);
      cluster.position.set(px + Math.cos(va) * 0.24, vy, pz + Math.sin(va) * 0.24);
      cluster.rotation.y = va;
      g.add(cluster);
    }
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

  // Transverse pergola rafters + volumetric rooftop greenery bed
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
      const topBush = new THREE.Mesh(CROSSED_SPRAY_GEO, archMats.foliageShrub);
      const sc = 0.95 + seeded(seed + i * 7) * 0.45;
      topBush.scale.set(sc * 1.25, sc * 0.55, sc);
      topBush.position.set(rx, h + beamH + 0.24, (seeded(seed + i * 11) - 0.5) * d * 0.55);
      topBush.rotation.y = seeded(seed + i * 13) * Math.PI * 2;
      g.add(topBush);
    }
  }

  // Hanging trailing ivy curtains along front pergola fascia (Reference Image 4)
  const rimLeafCount = Math.max(7, Math.round(w * 0.9));
  for (let i = 0; i < rimLeafCount; i++) {
    const rx = -w * 0.46 + (i / Math.max(1, rimLeafCount - 1)) * (w * 0.92);
    const vine = new THREE.Mesh(CROSSED_SPRAY_GEO, archMats.foliageVine);
    const sc = 0.72 + seeded(seed + i * 5) * 0.38;
    vine.scale.set(sc, sc * 1.15, sc * 0.65);
    vine.position.set(rx, h + 0.02 - seeded(seed + i) * 0.18, d * 0.47);
    vine.rotation.set(0.15, (seeded(seed + i * 3) - 0.5) * 0.8, 0);
    g.add(vine);
  }

  parent.add(g);
}

/**
 * Multi-layered volumetric 3D organic shrub or white-flowering bush (Reference Image 4 foreground bushes).
 */
export function buildOrganicShrub(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  seed: number,
  M: MaterialLibrary,
  archMats: ArchitecturalMaterials,
  flowering = false
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.userData.genericPlantBlock = { kind: 'shrub', radius, height, flowering };

  contact(g, 0, 0.015, 0, radius * 2.1, radius * 2.1, 0.42, M.textures.shadowTex);
  const mat = flowering ? archMats.foliageBlossom : archMats.foliageShrub;

  const core = new THREE.Mesh(CROSSED_SPRAY_GEO, mat);
  core.scale.set(radius * 1.5, height * 1.15, radius * 1.5);
  core.position.set(0, height * 0.48, 0);
  core.rotation.y = seeded(seed) * Math.PI * 2;
  core.castShadow = true;
  core.userData.genericPlantPiece = true;
  g.add(core);

  const subCount = 4;
  for (let i = 0; i < subCount; i++) {
    const a = (i / subCount) * Math.PI * 2 + seeded(seed + i * 3) * 0.6;
    const sub = new THREE.Mesh(CROSSED_SPRAY_GEO, i === 0 && flowering ? archMats.foliageShrub : mat);
    const sc = 0.72 + seeded(seed + i * 7) * 0.34;
    sub.scale.set(radius * 1.15 * sc, height * 0.9 * sc, radius * 1.15 * sc);
    sub.position.set(
      Math.cos(a) * radius * 0.46,
      height * (0.34 + seeded(seed + i * 11) * 0.22),
      Math.sin(a) * radius * 0.46
    );
    sub.rotation.y = a + 0.5;
    sub.castShadow = true;
    sub.userData.genericPlantPiece = true;
    g.add(sub);
  }

  parent.add(g);
  return g;
}

/**
 * Natural river-boulder landscaped bed filled with dark mulch mound, agave rosettes & ornamental shrubs (Reference Image 1).
 */
export function buildRiverStoneBed(
  parent: THREE.Object3D,
  cx: number,
  y: number,
  cz: number,
  w: number,
  d: number,
  seed: number,
  M: MaterialLibrary,
  archMats: ArchitecturalMaterials,
  withFocalShrub = true
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(cx, y, cz);

  contact(g, 0, 0.015, 0, w * 1.06, d * 1.06, 0.46, M.textures.shadowTex);

  // Soft mounded dark mulch soil heart inside perimeter stones
  const mound = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    archMats.mulchEarth
  );
  mound.scale.set(w * 0.88, 0.32, d * 0.88);
  mound.position.y = 0.0;
  mound.receiveShadow = true;
  g.add(mound);

  // Perimeter ring of faceted natural river boulders (warm beige & slate granite)
  const bGeo = getBoulderGeo();
  const rx = w * 0.45;
  const rz = d * 0.45;
  const count = Math.max(12, Math.round((w + d) * 3.1));
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (seeded(seed + i) - 0.5) * 0.14;
    const jitter = 0.92 + seeded(seed + i * 5) * 0.14;
    const boulder = new THREE.Mesh(
      bGeo,
      i % 3 === 0 ? archMats.riverStoneWarm : archMats.riverStoneLight
    );
    const sw = 0.34 + seeded(seed + i * 7) * 0.24;
    const sh = 0.24 + seeded(seed + i * 11) * 0.16;
    const sd = 0.32 + seeded(seed + i * 13) * 0.2;
    boulder.scale.set(sw, sh, sd);
    boulder.position.set(Math.cos(a) * rx * jitter, sh * 0.34, Math.sin(a) * rz * jitter);
    boulder.rotation.set(seeded(seed + i * 17) * 0.4, a + seeded(seed + i * 19), seeded(seed + i * 23) * 0.3);
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    g.add(boulder);
  }

  // Agave rosette tufts + low flowering / lush shrubs nested inside the boulder bed
  const rosettePositions: Array<[number, number, number]> = [
    [-rx * 0.38, rz * 0.22, 0.72],
    [rx * 0.38, -rz * 0.2, 0.68],
    [0, rz * 0.35, 0.62],
  ];
  rosettePositions.forEach(([ax, az, sc], idx) => {
    const rg = new THREE.Group();
    rg.position.set(ax, 0.12, az);
    const blades = 9;
    for (let b = 0; b < blades; b++) {
      const ba = (b / blades) * Math.PI * 2 + seeded(seed + idx * 17 + b) * 0.3;
      const blade = new THREE.Mesh(ARCH_LEAF_GEO, archMats.foliageAgave);
      blade.scale.set(0.28 * sc, 0.68 * sc, 0.3 * sc);
      blade.position.set(Math.cos(ba) * 0.12 * sc, 0.24 * sc, Math.sin(ba) * 0.12 * sc);
      blade.rotation.set(-0.55 - (b % 2) * 0.22, -ba + Math.PI / 2, 0);
      rg.add(blade);
    }
    g.add(rg);
  });

  if (withFocalShrub) {
    buildOrganicShrub(
      g,
      (seeded(seed + 41) - 0.5) * rx * 0.3,
      0.12,
      (seeded(seed + 43) - 0.5) * rz * 0.3,
      Math.min(rx, rz) * 0.62,
      0.68 + seeded(seed + 47) * 0.28,
      seed + 53,
      M,
      archMats,
      seed % 2 === 0
    );
  }

  parent.add(g);
  return g;
}

/**
 * Manicured dark-green leafy perimeter hedge broken with organic protruding foliage clusters (Reference Image 2).
 */
export function buildManicuredHedge(
  parent: THREE.Object3D,
  cx: number,
  y: number,
  cz: number,
  len: number,
  depth: number,
  height: number,
  rotY: number,
  seed: number,
  M: MaterialLibrary,
  archMats: ArchitecturalMaterials
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(cx, y, cz);
  g.rotation.y = rotY;
  g.userData.genericPlantBlock = { kind: 'hedge', len, depth, height };

  // Soft beveled mossy interior hedge mass (tagged for replacement by procedural thicket)
  const core = new THREE.Mesh(
    getRoundedSlabGeo(Math.max(0.4, len - 0.18), Math.max(0.32, depth - 0.14), 0.18, height * 0.84, 0.08),
    M.moss
  );
  core.position.y = height * 0.42;
  core.castShadow = true;
  core.receiveShadow = true;
  core.userData.genericPlantPiece = true;
  g.add(core);

  // Dense overlapping 3D shrub sprays encasing the top & outer silhouette organically
  const n = Math.max(4, Math.round(len / 0.72));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const px = (t - 0.5) * (len - 0.35);
    const r1 = seeded(seed + i * 7);
    const spray = new THREE.Mesh(CROSSED_SPRAY_GEO, archMats.foliageShrub);
    const sw = depth * (1.28 + r1 * 0.26);
    const sh = height * (0.98 + r1 * 0.24);
    spray.scale.set(sw, sh, sw);
    spray.position.set(px, height * 0.48 + r1 * 0.05, (seeded(seed + i * 11) - 0.5) * 0.1);
    spray.rotation.y = r1 * Math.PI * 2;
    spray.castShadow = true;
    spray.userData.genericPlantPiece = true;
    g.add(spray);
  }

  parent.add(g);
  return g;
}
