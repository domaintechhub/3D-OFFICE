import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MaterialLibrary } from './materials';
import { leafTex } from './textures';

export const GEO_SHARED = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rbox: new RoundedBoxGeometry(1, 1, 1, 3, 0.08),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  sph: new THREE.SphereGeometry(0.5, 16, 12),
};

const RBOX_CACHE = new Map<string, THREE.BufferGeometry>();
export function getRoundedBox(w: number, h: number, d: number, r = 0.04, seg = 3): THREE.BufferGeometry {
  const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${r.toFixed(3)}_${seg}`;
  let g = RBOX_CACHE.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w * 0.45, h * 0.45, d * 0.45));
    RBOX_CACHE.set(key, g);
  }
  return g;
}

export function boxAt(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  cast = false,
  recv = false,
  bevelRadius = 0
): THREE.Mesh {
  const geo = bevelRadius > 0 ? getRoundedBox(w, h, d, bevelRadius, 2) : GEO_SHARED.box;
  const m = new THREE.Mesh(geo, mat);
  if (bevelRadius <= 0) m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = recv;
  parent.add(m);
  return m;
}

export function cylAt(
  parent: THREE.Object3D,
  r1: number,
  r2: number,
  h: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  cast = false,
  recv = false,
  segs = 20
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, segs), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = recv;
  parent.add(m);
  return m;
}

export function planeAt(
  parent: THREE.Object3D,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function contact(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  op: number | null,
  shadowTex: THREE.Texture
): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: op == null ? 0.6 : op,
      depthWrite: false,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y + 0.012, z);
  m.renderOrder = 1;
  parent.add(m);
  return m;
}

export function downlight(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  M: MaterialLibrary,
  r = 0.14
): THREE.Mesh {
  // Architectural recessed baffle collar + brushed aluminum outer trim + optical lens
  const baffle = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.9, r * 0.88, 0.07, 18, 1, true),
    M.dark
  );
  baffle.position.set(x, y + 0.032, z);
  parent.add(baffle);

  const trim = new THREE.Mesh(new THREE.RingGeometry(r * 0.88, r * 1.28, 20), M.metal);
  trim.rotation.x = Math.PI / 2;
  trim.position.set(x, y - 0.002, z);
  parent.add(trim);

  const m = new THREE.Mesh(new THREE.CircleGeometry(r * 0.86, 18), M.lamp);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y + 0.006, z);
  parent.add(m);
  return m;
}

const LINEAR_DIFFUSER_MAT = new THREE.MeshStandardMaterial({
  color: 0xf4efe5,
  emissive: 0xffe8c4,
  emissiveIntensity: 0.42,
  roughness: 0.6,
  metalness: 0.0,
});

export function ceilingLinearLight(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  len: number,
  width: number,
  M: MaterialLibrary
) {
  // Recessed anodized aluminum architectural linear channel + warm satin acrylic diffuser
  boxAt(parent, len, 0.055, width, x, y + 0.01, z, M.dark, false, false, 0.006);
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.06, width - 0.045), LINEAR_DIFFUSER_MAT);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(x, y - 0.019, z);
  parent.add(lens);
}

export function hvacDiffuser(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  M: MaterialLibrary,
  r = 0.24
) {
  // Circular multi-cone architectural ceiling supply air diffuser
  const outer = new THREE.Mesh(new THREE.RingGeometry(r * 0.62, r, 24), M.white);
  outer.rotation.x = Math.PI / 2;
  outer.position.set(x, y - 0.002, z);
  parent.add(outer);

  const gap = new THREE.Mesh(new THREE.RingGeometry(r * 0.38, r * 0.62, 24), M.dark);
  gap.rotation.x = Math.PI / 2;
  gap.position.set(x, y + 0.003, z);
  parent.add(gap);

  const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.38, 20), M.white);
  core.rotation.x = Math.PI / 2;
  core.position.set(x, y - 0.004, z);
  parent.add(core);
}

/* =========================================================
   BOTANICAL POTTED PLANTS & STREET TREES
   ========================================================= */
const potMats: Record<string, THREE.MeshStandardMaterial> = {};
function getPotMat(kind: string): THREE.MeshStandardMaterial {
  if (potMats[kind]) return potMats[kind];
  const o =
    kind === 'terracotta'
      ? { color: 0xb2623e, roughness: 0.86 }
      : kind === 'dark'
        ? { color: 0x34383e, roughness: 0.52, metalness: 0.18 }
        : kind === 'concrete'
          ? { color: 0xb0aca2, roughness: 0.92 }
          : kind === 'brass'
            ? { color: 0xb58d52, roughness: 0.3, metalness: 0.85 }
            : { color: 0xd4cfc6, roughness: 0.58, metalness: 0.02 };
  potMats[kind] = new THREE.MeshStandardMaterial({ envMapIntensity: 0.4, ...o });
  return potMats[kind];
}

const LEAF_MATS = new Map<string, THREE.MeshStandardMaterial>();
function getLeafMat(kind: string, color: number): THREE.MeshStandardMaterial {
  const k = `${kind}_${color}`;
  let m = LEAF_MATS.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: leafTex(kind),
      color,
      transparent: true,
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      roughness: 0.74,
      metalness: 0,
      envMapIntensity: 0.18,
    });
    LEAF_MATS.set(k, m);
  }
  return m;
}

interface SpeciesProfile {
  h: number;
  spread: number;
  n: number;
  leaf: string;
  pot: string;
  potR: number;
  potH: number;
  potTaper: number;
  greens: number[];
  leafScale: [number, number];
}

const SPECIES: Record<string, SpeciesProfile> = {
  palm: { h: 1.02, spread: 0.52, n: 12, leaf: 'frond', pot: 'concrete', potR: 0.27, potH: 0.42, potTaper: 0.74, greens: [0x3d7c33, 0x4b8f3b, 0x2f6629], leafScale: [0.95, 0.36] },
  ficus: { h: 1.08, spread: 0.45, n: 14, leaf: 'broad', pot: 'terracotta', potR: 0.27, potH: 0.4, potTaper: 0.72, greens: [0x367432, 0x488f3d, 0x295d28], leafScale: [1.0, 0.68] },
  sanse: { h: 0.94, spread: 0.28, n: 15, leaf: 'strap', pot: 'dark', potR: 0.23, potH: 0.36, potTaper: 0.7, greens: [0x3d8236, 0x316d2b, 0x4b933f], leafScale: [0.42, 1.45] },
  monst: { h: 0.82, spread: 0.56, n: 12, leaf: 'split', pot: 'concrete', potR: 0.3, potH: 0.36, potTaper: 0.8, greens: [0x367d33, 0x2c6829, 0x458d3e], leafScale: [1.1, 0.88] },
  fern: { h: 0.68, spread: 0.62, n: 18, leaf: 'blade', pot: 'terracotta', potR: 0.26, potH: 0.34, potTaper: 0.78, greens: [0x4f943e, 0x3e7f34, 0x62a847], leafScale: [0.88, 0.62] },
  grass: { h: 0.88, spread: 0.34, n: 22, leaf: 'blade', pot: 'dark', potR: 0.22, potH: 0.34, potTaper: 0.68, greens: [0x61a643, 0x4d913c, 0x76bd52], leafScale: [0.46, 1.15] },
  olive: { h: 1.12, spread: 0.48, n: 15, leaf: 'broad', pot: 'brass', potR: 0.25, potH: 0.44, potTaper: 0.7, greens: [0x719156, 0x607f49, 0x84a264], leafScale: [0.6, 0.78] },
};
const SPECIES_KEYS = Object.keys(SPECIES);

const SOIL_MAT = new THREE.MeshStandardMaterial({ color: 0x36281b, roughness: 0.98 });
const PEBBLE_MAT = new THREE.MeshStandardMaterial({ color: 0x716c63, roughness: 0.88 });
const STEM_MAT = new THREE.MeshStandardMaterial({ color: 0x45662d, roughness: 0.85 });

/** Shared deeply arched botanical leaf blade mesh (3x6 segments, cupped + drooping midrib). */
export const ARCH_LEAF_GEO = (() => {
  const g = new THREE.PlaneGeometry(1, 1, 3, 6);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i); // -0.5..0.5
    const ly = pos.getY(i); // -0.5..0.5
    const t = 0.5 - ly; // 0 at top tip, 1 at base
    const stemCurve = Math.sin(t * Math.PI) * 0.14 - 0.16 * (1 - t) * (1 - t);
    const vfold = Math.abs(lx) * 0.14 - (lx * lx) * 0.1;
    pos.setZ(i, stemCurve + vfold);
  }
  g.computeVertexNormals();
  return g;
})();

/**
 * Shared 3D crossed cambered foliage cluster geometry (3 intersecting curved sprays at 0°, 60°, 120° + horizontal cap tilt)
 * so trees, bushes, hedges, and planter canopies read lush & volumetric from every camera angle with 1 draw call.
 */
export const CROSSED_SPRAY_GEO: THREE.BufferGeometry = (() => {
  const planes: Array<{ rotY: number; tiltX: number; tiltZ: number; dy: number; scale: number }> = [
    { rotY: 0.0, tiltX: 0.26, tiltZ: 0.14, dy: 0.0, scale: 1.0 },
    { rotY: Math.PI / 3, tiltX: -0.24, tiltZ: 0.18, dy: 0.03, scale: 0.96 },
    { rotY: (Math.PI * 2) / 3, tiltX: 0.22, tiltZ: -0.2, dy: -0.02, scale: 0.94 },
    { rotY: 0.52, tiltX: 1.18, tiltZ: 0.08, dy: 0.06, scale: 0.88 }, // nearly horizontal sun-catching crown layer
  ];

  const base = new THREE.PlaneGeometry(1, 1, 2, 2);
  const bPos = base.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const px = bPos.getX(i);
    const py = bPos.getY(i);
    // Subtle spherical dome camber
    bPos.setZ(i, 0.12 - (px * px + py * py) * 0.24);
  }
  base.computeVertexNormals();

  const bNorm = base.attributes.normal;
  const bUv = base.attributes.uv;
  const bIdx = base.index!;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let p = 0; p < planes.length; p++) {
    const cfg = planes[p];
    e.set(cfg.tiltX, cfg.rotY, cfg.tiltZ);
    q.setFromEuler(e);
    const offset = positions.length / 3;
    for (let i = 0; i < bPos.count; i++) {
      v.set(bPos.getX(i) * cfg.scale, bPos.getY(i) * cfg.scale, bPos.getZ(i) * cfg.scale).applyQuaternion(q);
      v.y += cfg.dy;
      positions.push(v.x, v.y, v.z);
      n.set(bNorm.getX(i), bNorm.getY(i), bNorm.getZ(i)).applyQuaternion(q).normalize();
      normals.push(n.x, n.y, n.z);
      uvs.push(bUv.getX(i), bUv.getY(i));
    }
    for (let i = 0; i < bIdx.count; i++) {
      indices.push(offset + bIdx.getX(i));
    }
  }
  base.dispose();

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setIndex(indices);
  return out;
})();

function makeSculptedPotGeo(potR: number, potH: number, taper: number): THREE.LatheGeometry {
  const b = potR * taper;
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(b, 0),
    new THREE.Vector2(b * 1.04, potH * 0.14),
    new THREE.Vector2(potR * 0.99, potH * 0.82),
    new THREE.Vector2(potR * 1.07, potH * 0.91),
    new THREE.Vector2(potR * 1.07, potH),
    new THREE.Vector2(potR * 0.9, potH),
    new THREE.Vector2(potR * 0.86, potH * 0.88),
  ];
  return new THREE.LatheGeometry(pts, 20);
}

export function plant(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  s: number,
  seed: number,
  M: MaterialLibrary,
  forceKind?: string
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const rnd = (n: number) => (((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  const kind = forceKind || SPECIES_KEYS[Math.floor(rnd(7) * SPECIES_KEYS.length) % SPECIES_KEYS.length];
  const sp = SPECIES[kind];
  const scale = s * sp.h;
  g.userData.genericPlantBlock = { kind: 'pottedPlant', species: kind, scale };

  contact(g, 0, 0.012, 0, sp.potR * 2.7 * s, sp.potR * 2.7 * s, 0.52, M.textures.shadowTex);

  const pm = getPotMat(sp.pot);
  const potR = sp.potR * s;
  const potH = sp.potH * s;
  const potMesh = new THREE.Mesh(makeSculptedPotGeo(potR, potH, sp.potTaper), pm);
  potMesh.castShadow = true;
  potMesh.receiveShadow = true;
  g.add(potMesh);

  // Dark soil mound + natural pebble collar
  const soilMound = new THREE.Mesh(new THREE.SphereGeometry(potR * 0.87, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), SOIL_MAT);
  soilMound.scale.set(1, 0.22, 1);
  soilMound.position.set(0, potH * 0.87, 0);
  g.add(soilMound);

  const pebbleRing = new THREE.Mesh(new THREE.TorusGeometry(potR * 0.72, potR * 0.08, 6, 16), PEBBLE_MAT);
  pebbleRing.rotation.x = Math.PI / 2;
  pebbleRing.scale.set(1, 1, 0.48);
  pebbleRing.position.set(0, potH * 0.905, 0);
  g.add(pebbleRing);

  const leafMats = sp.greens.map((c) => getLeafMat(sp.leaf, c));
  const golden = 2.39996323; // golden angle phyllotaxis spiral
  const n = sp.n;

  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const a = i * golden + rnd(i + 21) * 0.35;
    const rad = (0.03 + Math.sqrt(t) * sp.spread * 0.56) * scale;
    const hh = (0.36 + (1 - t * 0.35) * 0.56 + rnd(i + 41) * 0.26) * scale;
    const sg = new THREE.Group();
    sg.position.set(Math.cos(a) * rad, potH * 0.88, Math.sin(a) * rad);
    const leanOut = kind === 'sanse' ? 0.14 : 0.25 + t * 0.48;
    sg.rotation.y = -a + Math.PI / 2;
    sg.rotation.x = leanOut;
    g.add(sg);

    const stemLen = kind === 'grass' || kind === 'sanse' ? hh * 0.78 : hh * 0.76;
    if (kind !== 'sanse') {
      cylAt(sg, 0.011 * scale, 0.005 * scale, stemLen, 0, stemLen * 0.5, 0, STEM_MAT, false, false, 6);
    }

    const per = kind === 'grass' || kind === 'sanse' ? 1 : 2;
    for (let k = 0; k < per; k++) {
      const mat = leafMats[(i + k) % leafMats.length];
      const card = new THREE.Mesh(ARCH_LEAF_GEO, mat);
      const lw = (0.32 + rnd(i * 7 + k + 11) * 0.22) * scale * (k === 1 ? 0.78 : 1);
      const lh = lw * sp.leafScale[1];
      card.scale.set(lw, lh, lw * 0.85);
      const dropY = k === 0 ? stemLen - lh * 0.18 : stemLen * 0.58;
      card.position.set(k === 1 ? (i % 2 ? 0.05 : -0.05) * scale : 0, dropY, lh * 0.14);
      const pitch = kind === 'grass' ? -0.35 : kind === 'sanse' ? -0.06 : -0.78 - t * 0.28;
      card.rotation.set(pitch, (k === 1 ? (i % 2 ? 0.5 : -0.5) : 0) + (rnd(i + k + 81) - 0.5) * 0.25, (rnd(i + k + 91) - 0.5) * 0.24);
      sg.add(card);
    }
  }

  // Olive / Ficus upper lush 3D shrub crown so canopy plants look rich from all eye angles
  if (kind === 'olive' || kind === 'ficus') {
    const sprayMat = getLeafMat('shrubCluster', sp.greens[1]);
    const crown = new THREE.Mesh(CROSSED_SPRAY_GEO, sprayMat);
    const cr = sp.spread * 1.45 * scale;
    crown.scale.set(cr, cr * 0.9, cr);
    crown.position.set(0, potH + 0.68 * scale, 0);
    g.add(crown);
  }

  parent.add(g);
  return g;
}

let treeCanopyMats: THREE.MeshStandardMaterial[] | null = null;
function getTreeCanopyMats(): THREE.MeshStandardMaterial[] {
  if (treeCanopyMats) return treeCanopyMats;
  const tex = leafTex('treeCanopy');
  const mk = (c: number) =>
    new THREE.MeshStandardMaterial({
      map: tex,
      color: c,
      transparent: true,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.84,
      metalness: 0,
      envMapIntensity: 0.18,
    });
  treeCanopyMats = [mk(0xffffff), mk(0xe9f2d5), mk(0xd4e2ba), mk(0xbccf9c)];
  return treeCanopyMats;
}

export function tree(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  h: number,
  canopyR: number,
  seed: number,
  M: MaterialLibrary
): THREE.Group {
  const rnd = (n: number) => (((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.userData.organicTree = { canopyR, height: h };
  const trunkR = h * 0.042;
  const canopyMats = getTreeCanopyMats();
  contact(g, 0, 0.02, 0, canopyR * 1.25, canopyR * 1.25, 0.5, M.textures.shadowTex);

  // Flared root buttresses gripping ground naturally
  for (let r = 0; r < 4; r++) {
    const ra = (r / 4) * Math.PI * 2 + rnd(r + 1) * 0.6;
    const rootCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(ra) * trunkR * 0.5, h * 0.11, Math.sin(ra) * trunkR * 0.5),
      new THREE.Vector3(Math.cos(ra) * trunkR * 1.5, h * 0.03, Math.sin(ra) * trunkR * 1.5),
      new THREE.Vector3(Math.cos(ra) * trunkR * 2.4, -0.02, Math.sin(ra) * trunkR * 2.4),
    ]);
    const rootMesh = new THREE.Mesh(new THREE.TubeGeometry(rootCurve, 5, trunkR * 0.42, 6, false), M.barkDark);
    rootMesh.castShadow = true;
    g.add(rootMesh);
  }

  // Organic curved tapered trunk via TubeGeometry
  const leanX = (rnd(3) - 0.5) * 0.28;
  const leanZ = (rnd(4) - 0.5) * 0.24;
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(leanX * h * 0.08, h * 0.24, leanZ * h * 0.08),
    new THREE.Vector3(leanX * h * 0.2, h * 0.56, leanZ * h * 0.18),
  ]);
  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 10, trunkR, 8, false);
  const pos = trunkGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    const t = Math.max(0, Math.min(1, py / (h * 0.56)));
    const scaleR = 1.55 - t * 0.92;
    const center = trunkCurve.getPointAt(t);
    pos.setX(i, center.x + (pos.getX(i) - center.x) * scaleR);
    pos.setZ(i, center.z + (pos.getZ(i) - center.z) * scaleR);
  }
  trunkGeo.computeVertexNormals();
  const trunkMesh = new THREE.Mesh(trunkGeo, M.bark);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  g.add(trunkMesh);

  const forkOrigin = trunkCurve.getPointAt(0.88);
  const limbs = 5 + Math.floor(rnd(9) * 2);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + rnd(i + 11) * 0.55;
    const spread = canopyR * (0.62 + rnd(i + 31) * 0.42);
    const tipY = h * (0.76 + rnd(i + 41) * 0.2);
    const mid = new THREE.Vector3(
      forkOrigin.x + Math.cos(a) * spread * 0.54,
      forkOrigin.y + (tipY - forkOrigin.y) * 0.62,
      forkOrigin.z + Math.sin(a) * spread * 0.54
    );
    const tip = new THREE.Vector3(
      forkOrigin.x + Math.cos(a) * spread,
      tipY,
      forkOrigin.z + Math.sin(a) * spread
    );
    const lCurve = new THREE.CatmullRomCurve3([forkOrigin.clone(), mid, tip]);
    const limbMesh = new THREE.Mesh(new THREE.TubeGeometry(lCurve, 6, trunkR * 0.34, 6, false), M.barkDark);
    limbMesh.castShadow = true;
    g.add(limbMesh);

    // Secondary forked sub-branch for organic feathery silhouette (Reference Image 2)
    const subAngle = a + (i % 2 ? 0.45 : -0.45);
    const subTip = new THREE.Vector3(
      mid.x + Math.cos(subAngle) * spread * 0.58,
      tipY + canopyR * (0.14 + rnd(i + 77) * 0.16),
      mid.z + Math.sin(subAngle) * spread * 0.58
    );
    const sCurve = new THREE.CatmullRomCurve3([mid, subTip]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(sCurve, 4, trunkR * 0.18, 5, false), M.barkDark));

    // Volumetric 3D crossed foliage clusters along mid, primary tip & secondary sub-tip
    const anchors = [mid, tip, subTip];
    for (let f = 0; f < anchors.length; f++) {
      const pt = anchors[f];
      const matIdx = f === 0 ? 3 : (i + f) % 3; // darker underside/interior, sunlit outer clusters
      const cm = new THREE.Mesh(CROSSED_SPRAY_GEO, canopyMats[matIdx]);
      const cw = canopyR * (0.86 + rnd(i * 11 + f) * 0.46);
      cm.scale.set(cw, cw * 0.85, cw);
      cm.position.set(
        pt.x + (rnd(i * 7 + f) - 0.5) * canopyR * 0.24,
        pt.y + (f === 2 ? canopyR * 0.12 : 0),
        pt.z + (rnd(i * 13 + f) - 0.5) * canopyR * 0.24
      );
      cm.rotation.set((rnd(i + f + 5) - 0.5) * 0.35, a + f * 1.05, (rnd(i + f + 9) - 0.5) * 0.35);
      cm.castShadow = true;
      g.add(cm);
    }
  }

  // Crown apex clusters closing the tree top cleanly from aerial/overview angles
  for (let i = 0; i < 4; i++) {
    const a = rnd(i + 111) * Math.PI * 2;
    const cm = new THREE.Mesh(CROSSED_SPRAY_GEO, canopyMats[i % 2]);
    const cw = canopyR * (0.94 + rnd(i + 121) * 0.38);
    cm.scale.set(cw, cw * 0.84, cw);
    cm.position.set(Math.cos(a) * canopyR * 0.26, h * 0.89 + rnd(i + 131) * h * 0.11, Math.sin(a) * canopyR * 0.26);
    cm.rotation.y = a + Math.PI * 0.4;
    cm.castShadow = true;
    g.add(cm);
  }

  parent.add(g);
  return g;
}

/* =========================================================
   SCULPTED ARCHITECTURAL FURNITURE & WORKSTATION HARDWARE
   ========================================================= */
let armchairSeatGeo: THREE.BufferGeometry | null = null;
let armchairCrownGeo: THREE.BufferGeometry | null = null;
let armchairBackGeo: THREE.BufferGeometry | null = null;
let armchairArmGeo: THREE.BufferGeometry | null = null;
let sofaSeatGeo: THREE.BufferGeometry | null = null;
let sofaCrownGeo: THREE.BufferGeometry | null = null;
let sofaBackGeo: THREE.BufferGeometry | null = null;
let pillowGeo: THREE.BufferGeometry | null = null;
let officeSeatGeo: THREE.BufferGeometry | null = null;
let officeBackGeo: THREE.BufferGeometry | null = null;

function initFurnitureGeos() {
  if (armchairSeatGeo) return;
  armchairSeatGeo = getRoundedBox(1.04, 0.19, 0.94, 0.085, 4);
  armchairCrownGeo = getRoundedBox(0.96, 0.06, 0.86, 0.03, 3);
  armchairBackGeo = getRoundedBox(1.22, 0.56, 0.21, 0.09, 4);
  armchairArmGeo = getRoundedBox(0.18, 0.38, 1.1, 0.08, 4);
  sofaSeatGeo = getRoundedBox(1.26, 0.19, 0.94, 0.085, 4);
  sofaCrownGeo = getRoundedBox(1.18, 0.06, 0.86, 0.03, 3);
  sofaBackGeo = getRoundedBox(2.84, 0.6, 0.22, 0.095, 4);
  pillowGeo = getRoundedBox(0.42, 0.36, 0.14, 0.06, 3);

  // Waterfall ergonomic office seat pan (extruded side profile -> contoured front lip)
  const seatProf = new THREE.Shape();
  seatProf.moveTo(-0.24, -0.01);
  seatProf.quadraticCurveTo(-0.26, 0.055, -0.18, 0.068);
  seatProf.quadraticCurveTo(0.02, 0.048, 0.21, 0.056);
  seatProf.quadraticCurveTo(0.27, 0.052, 0.275, 0.0);
  seatProf.quadraticCurveTo(0.26, -0.025, 0.21, -0.022);
  seatProf.lineTo(-0.22, -0.022);
  seatProf.closePath();
  officeSeatGeo = new THREE.ExtrudeGeometry(seatProf, {
    depth: 0.48,
    bevelEnabled: true,
    bevelThickness: 0.024,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 10,
  });
  officeSeatGeo.translate(0, 0, -0.24);
  officeSeatGeo.rotateY(-Math.PI / 2);

  // Curved ergonomic lumbar backrest hoop
  const backCurve = new THREE.Shape();
  backCurve.moveTo(-0.24, 0);
  backCurve.quadraticCurveTo(-0.26, 0.31, -0.21, 0.57);
  backCurve.quadraticCurveTo(0, 0.63, 0.21, 0.57);
  backCurve.quadraticCurveTo(0.26, 0.31, 0.24, 0);
  backCurve.quadraticCurveTo(0, -0.03, -0.24, 0);
  officeBackGeo = new THREE.ExtrudeGeometry(backCurve, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 2,
  });
}

export function armchair(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  rot: number,
  mat: THREE.Material,
  M: MaterialLibrary
): THREE.Group {
  initFurnitureGeos();
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rot || 0;

  // Recessed shadow reveal + chamfered walnut plinth
  const base = new THREE.Mesh(getRoundedBox(1.24, 0.085, 1.06, 0.035, 2), M.walnut);
  base.position.set(0, 0.255, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const reveal = new THREE.Mesh(getRoundedBox(1.16, 0.03, 0.98, 0.01, 1), M.dark);
  reveal.position.set(0, 0.305, 0);
  g.add(reveal);

  // Two-layer crowned seat cushion + angled backrest + armrests
  const seat = new THREE.Mesh(armchairSeatGeo!, mat);
  seat.position.set(0, 0.4, 0.03);
  seat.castShadow = true;
  seat.receiveShadow = true;
  g.add(seat);

  const crown = new THREE.Mesh(armchairCrownGeo!, mat);
  crown.position.set(0, 0.48, 0.03);
  g.add(crown);

  const back = new THREE.Mesh(armchairBackGeo!, mat);
  back.position.set(0, 0.65, -0.45);
  back.rotation.x = -0.12;
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);

  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(armchairArmGeo!, mat);
    arm.position.set(s * 0.55, 0.48, 0);
    arm.receiveShadow = true;
    g.add(arm);
  });

  // Splayed walnut legs with brass ferrules
  [
    [-0.51, 0.41, -0.08, 0.08],
    [0.51, 0.41, 0.08, 0.08],
    [-0.51, -0.41, -0.08, -0.08],
    [0.51, -0.41, 0.08, -0.08],
  ].forEach(([lx, lz, rz, rx]) => {
    const leg = cylAt(g, 0.03, 0.018, 0.23, lx, 0.115, lz, M.walnut, false, false, 10);
    leg.rotation.z = rz;
    leg.rotation.x = rx;
    const tip = cylAt(g, 0.02, 0.018, 0.045, lx * 1.03, 0.022, lz * 1.03, M.brass, false, false, 10);
    tip.rotation.z = rz;
    tip.rotation.x = rx;
  });

  parent.add(g);
  return g;
}

export function sofaWide(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  rot: number,
  mat: THREE.Material,
  M: MaterialLibrary
): THREE.Group {
  initFurnitureGeos();
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rot || 0;

  const base = new THREE.Mesh(getRoundedBox(2.82, 0.085, 1.06, 0.035, 2), M.walnut);
  base.position.set(0, 0.255, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  const reveal = new THREE.Mesh(getRoundedBox(2.72, 0.03, 0.98, 0.01, 1), M.dark);
  reveal.position.set(0, 0.305, 0);
  g.add(reveal);

  [-0.65, 0.65].forEach((cx) => {
    const c = new THREE.Mesh(sofaSeatGeo!, mat);
    c.position.set(cx, 0.4, 0.03);
    c.castShadow = true;
    c.receiveShadow = true;
    g.add(c);
    const cr = new THREE.Mesh(sofaCrownGeo!, mat);
    cr.position.set(cx, 0.48, 0.03);
    g.add(cr);
  });

  const back = new THREE.Mesh(sofaBackGeo!, mat);
  back.position.set(0, 0.65, -0.45);
  back.rotation.x = -0.12;
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);

  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(armchairArmGeo!, mat);
    arm.position.set(s * 1.32, 0.48, 0);
    arm.receiveShadow = true;
    g.add(arm);

    const pil = new THREE.Mesh(pillowGeo!, M.fabricGrey);
    pil.position.set(s * 1.04, 0.6, -0.17);
    pil.rotation.set(-0.26, s * 0.32, s * 0.12);
    g.add(pil);
  });

  [
    [-1.24, 0.42],
    [1.24, 0.42],
    [-1.24, -0.42],
    [1.24, -0.42],
  ].forEach(([lx, lz]) => {
    cylAt(g, 0.032, 0.02, 0.23, lx, 0.115, lz, M.walnut, false, false, 10);
    cylAt(g, 0.021, 0.019, 0.045, lx, 0.022, lz, M.brass, false, false, 10);
  });

  parent.add(g);
  return g;
}

export function officeChair(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  rot: number,
  M: MaterialLibrary
): THREE.Group {
  initFurnitureGeos();
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rot || 0;

  // Waterfall ergonomic seat cushion + under-seat synchronous tilt hub + paddle lever
  const seat = new THREE.Mesh(officeSeatGeo!, M.leatherMat);
  seat.position.set(0, 0.445, 0.01);
  seat.castShadow = true;
  seat.receiveShadow = true;
  g.add(seat);

  const hub = new THREE.Mesh(getRoundedBox(0.24, 0.055, 0.26, 0.018, 2), M.dark);
  hub.position.set(0, 0.4, -0.02);
  g.add(hub);

  const lever = new THREE.Mesh(getRoundedBox(0.14, 0.014, 0.032, 0.005, 1), M.dark);
  lever.position.set(0.17, 0.395, 0.03);
  g.add(lever);

  // Curved breathable mesh backrest + adjustable lumbar strap
  const back = new THREE.Mesh(officeBackGeo!, M.meshFabric);
  back.position.set(0, 0.515, -0.25);
  back.rotation.x = -0.1;
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);

  const lumbar = new THREE.Mesh(getRoundedBox(0.44, 0.075, 0.045, 0.02, 2), M.dark);
  lumbar.position.set(0, 0.655, -0.27);
  lumbar.rotation.x = -0.1;
  g.add(lumbar);

  // Brushed aluminum rear spine yoke
  const spine = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.405, -0.04),
        new THREE.Vector3(0, 0.425, -0.24),
        new THREE.Vector3(0, 0.715, -0.285),
      ]),
      10,
      0.022,
      8,
      false
    ),
    M.metal
  );
  g.add(spine);

  // T-post vertical armrests with soft-touch polyurethane arm pads
  [-1, 1].forEach((s) => {
    const post = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(s * 0.2, 0.4, -0.04),
          new THREE.Vector3(s * 0.275, 0.425, -0.04),
          new THREE.Vector3(s * 0.285, 0.61, -0.03),
        ]),
        8,
        0.017,
        8,
        false
      ),
      M.metal
    );
    g.add(post);

    const pad = new THREE.Mesh(getRoundedBox(0.088, 0.028, 0.24, 0.012, 2), M.dark);
    pad.position.set(s * 0.285, 0.62, 0.025);
    g.add(pad);
  });

  // Pneumatic gas cylinder + die-cast brushed aluminum 5-star base + dual-wheel casters
  cylAt(g, 0.028, 0.034, 0.28, 0, 0.26, 0, M.chrome, false, false, 12);
  cylAt(g, 0.048, 0.056, 0.06, 0, 0.13, 0, M.metal, false, false, 14);

  for (let k = 0; k < 5; k++) {
    const a = (k * Math.PI * 2) / 5 + 0.3;
    const cx = Math.cos(a) * 0.28;
    const cz = Math.sin(a) * 0.28;
    const leg = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(a) * 0.03, 0.135, Math.sin(a) * 0.03),
          new THREE.Vector3(cx * 0.55, 0.105, cz * 0.55),
          new THREE.Vector3(cx, 0.056, cz),
        ]),
        6,
        0.017,
        6,
        false
      ),
      M.metal
    );
    g.add(leg);
    // Hooded twin-wheel caster
    const wheelA = cylAt(g, 0.025, 0.025, 0.012, cx - Math.sin(a) * 0.011, 0.025, cz + Math.cos(a) * 0.011, M.black, false, false, 10);
    wheelA.rotation.z = Math.PI / 2;
    wheelA.rotation.y = a;
    const wheelB = cylAt(g, 0.025, 0.025, 0.012, cx + Math.sin(a) * 0.011, 0.025, cz - Math.cos(a) * 0.011, M.black, false, false, 10);
    wheelB.rotation.z = Math.PI / 2;
    wheelB.rotation.y = a;
    cylAt(g, 0.014, 0.018, 0.032, cx, 0.042, cz, M.dark, false, false, 8);
  }

  parent.add(g);
  return g;
}

let mugGeo: THREE.LatheGeometry | null = null;
let mugHandleGeo: THREE.TorusGeometry | null = null;
function getMugGeo(): THREE.LatheGeometry {
  if (mugGeo) return mugGeo;
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.035, 0),
    new THREE.Vector2(0.039, 0.082),
    new THREE.Vector2(0.035, 0.088),
    new THREE.Vector2(0.032, 0.015),
    new THREE.Vector2(0.001, 0.015),
  ];
  mugGeo = new THREE.LatheGeometry(pts, 16);
  return mugGeo;
}
function getMugHandleGeo(): THREE.TorusGeometry {
  if (mugHandleGeo) return mugHandleGeo;
  mugHandleGeo = new THREE.TorusGeometry(0.024, 0.0055, 8, 14, Math.PI);
  return mugHandleGeo;
}

export function monitor(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  warm: boolean,
  rotY: number,
  M: MaterialLibrary,
  smat?: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY || 0;

  // IMPORTANT: Preserve child indices [2] = bezel and [3] = screen for monitor raycasting & live canvas sync
  // 0: Brushed aluminum sculpted foot plate
  const base = new THREE.Mesh(getRoundedBox(0.24, 0.014, 0.16, 0.007, 2), M.metal);
  base.position.set(0, 0.007, -0.01);
  g.add(base);

  // 1: Swept brushed aluminum neck
  const neck = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.01, -0.04),
        new THREE.Vector3(0, 0.18, -0.05),
        new THREE.Vector3(0, 0.34, -0.012),
      ]),
      8,
      0.018,
      8,
      false
    ),
    M.metal
  );
  g.add(neck);

  // 2: Ultra-slim CNC anodized display chassis
  const bezel = new THREE.Mesh(getRoundedBox(0.76, 0.445, 0.02, 0.01, 2), M.dark);
  bezel.position.set(0, 0.36, 0);
  g.add(bezel);

  // 3: Live edge-to-edge display panel
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.724, 0.408), smat || (warm ? M.screenWarm : M.screen));
  sc.position.set(0, 0.36, 0.011);
  g.add(sc);

  // 4+: Rear VESA aluminum hub + felt desk mat + mechanical keyboard + mouse + mug + notebook
  const vesa = new THREE.Mesh(getRoundedBox(0.11, 0.11, 0.018, 0.008, 2), M.metal);
  vesa.position.set(0, 0.35, -0.015);
  g.add(vesa);

  const deskMat = new THREE.Mesh(getRoundedBox(0.84, 0.005, 0.34, 0.002, 1), M.acousticFelt);
  deskMat.position.set(0.02, 0.0025, 0.21);
  deskMat.receiveShadow = true;
  g.add(deskMat);

  const kbBase = new THREE.Mesh(getRoundedBox(0.37, 0.012, 0.128, 0.005, 2), M.metal);
  kbBase.position.set(-0.04, 0.011, 0.22);
  kbBase.rotation.x = 0.06;
  g.add(kbBase);

  const kbKeys = new THREE.Mesh(new THREE.PlaneGeometry(0.352, 0.114), M.kbMat);
  kbKeys.rotation.x = -Math.PI / 2 + 0.06;
  kbKeys.position.set(-0.04, 0.0175, 0.22);
  g.add(kbKeys);

  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 8), M.dark);
  mouse.scale.set(0.74, 0.4, 1.24);
  mouse.position.set(0.24, 0.015, 0.22);
  g.add(mouse);

  const scrollWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 8), M.metal);
  scrollWheel.rotation.z = Math.PI / 2;
  scrollWheel.position.set(0.24, 0.026, 0.245);
  g.add(scrollWheel);

  const mug = new THREE.Mesh(getMugGeo(), M.ceramicMat);
  mug.position.set(-0.35, 0.004, 0.18);
  g.add(mug);

  const handle = new THREE.Mesh(getMugHandleGeo(), M.ceramicMat);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(-0.312, 0.046, 0.18);
  g.add(handle);

  const notebook = new THREE.Mesh(getRoundedBox(0.16, 0.012, 0.21, 0.004, 1), M.leatherMat);
  notebook.position.set(-0.29, 0.009, 0.32);
  notebook.rotation.y = 0.14;
  g.add(notebook);

  parent.add(g);
  return g;
}

const BOOK_PALETTE = [
  new THREE.MeshStandardMaterial({ color: 0x8e3a32, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0x2c4b6e, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0x3b634b, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0xb68b44, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0xd8d1c4, roughness: 0.88 }),
  new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.86 }),
];

export function shelfUnit(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  M: MaterialLibrary
): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  const H = 2.34;
  const D = 0.36;
  const wallT = 0.028;
  const lowerH = 0.72;

  // Recessed shadow-gap toe-kick plinth
  boxAt(g, w - 0.04, 0.08, D - 0.06, 0, 0.04, -0.02, M.dark, false, true);

  // Back charcoal acoustic/veneer panel
  boxAt(g, w - wallT * 2, H - 0.08, 0.022, 0, 0.08 + (H - 0.08) / 2, -D / 2 + 0.014, M.dark, false, true);

  // Left, right & top mitered walnut gables
  boxAt(g, wallT, H - 0.08, D, -w / 2 + wallT / 2, 0.08 + (H - 0.08) / 2, 0, M.walnut, true, true, 0.008);
  boxAt(g, wallT, H - 0.08, D, w / 2 - wallT / 2, 0.08 + (H - 0.08) / 2, 0, M.walnut, true, true, 0.008);
  boxAt(g, w, wallT, D, 0, H - wallT / 2, 0, M.walnut, true, true, 0.008);

  // Lower closed credenza cabinetry with crisp door reveal seams & vertical brass pulls
  boxAt(g, w - wallT * 2, lowerH, D - 0.03, 0, 0.08 + lowerH / 2, -0.01, M.walnut, true, true, 0.01);
  const doors = w >= 1.4 ? 3 : 2;
  const doorW = (w - wallT * 2 - 0.01 * (doors + 1)) / doors;
  for (let d = 0; d < doors; d++) {
    const dx = -(w - wallT * 2) / 2 + 0.01 + doorW / 2 + d * (doorW + 0.01);
    boxAt(g, doorW, lowerH - 0.03, 0.02, dx, 0.08 + lowerH / 2, D / 2 - 0.008, M.walnut, false, true, 0.006);
    boxAt(g, 0.012, 0.14, 0.016, dx + (d % 2 === 0 ? doorW * 0.34 : -doorW * 0.34), 0.08 + lowerH * 0.72, D / 2 + 0.01, M.brass, false, false, 0.004);
  }

  // Open upper shelves (3 shelves above credenza) with real 3D books, archival boxes & ceramics
  const shelfYs = [0.08 + lowerH, 1.24, 1.68, 2.08];
  const innerW = w - wallT * 2;
  shelfYs.forEach((sy, si) => {
    boxAt(g, innerW, 0.026, D - 0.025, 0, sy, 0, M.walnut, true, true, 0.005);
    if (si >= 3) return;

    const baseObjY = sy + 0.013;
    if (si === 0) {
      // Lower open shelf: neat row of varied hardcover books + archival box
      let bx = -innerW / 2 + 0.05;
      let bi = 0;
      while (bx < innerW * 0.24) {
        const bt = 0.028 + ((bi * 17) % 14) * 0.0014;
        const bh = 0.23 + ((bi * 29) % 10) * 0.008;
        boxAt(g, bt, bh, 0.21, bx + bt / 2, baseObjY + bh / 2, 0.02, BOOK_PALETTE[bi % BOOK_PALETTE.length], true, true, 0.003);
        bx += bt + 0.006;
        bi++;
      }
      boxAt(g, 0.24, 0.16, 0.24, innerW * 0.28, baseObjY + 0.08, 0.02, M.acousticFelt, true, true, 0.008);
    } else if (si === 1) {
      // Mid open shelf: framed print + right book stack + brass bookend
      boxAt(g, 0.26, 0.3, 0.024, -innerW * 0.22, baseObjY + 0.15, -0.02, M.brass, true, false, 0.004);
      boxAt(g, 0.21, 0.25, 0.026, -innerW * 0.22, baseObjY + 0.15, -0.016, M.white, false, false);
      let bx = 0.04;
      for (let b = 0; b < 6; b++) {
        const bt = 0.032;
        const bh = 0.24 + (b % 3) * 0.022;
        boxAt(g, bt, bh, 0.2, bx + b * 0.038, baseObjY + bh / 2, 0.02, BOOK_PALETTE[(b + 2) % BOOK_PALETTE.length], true, true, 0.003);
      }
    } else {
      // Top open shelf: horizontal stacked art books + sculpted ceramic bowl
      boxAt(g, 0.26, 0.032, 0.2, -innerW * 0.18, baseObjY + 0.016, 0.02, BOOK_PALETTE[4], true, false, 0.004);
      boxAt(g, 0.22, 0.028, 0.18, -innerW * 0.18, baseObjY + 0.046, 0.02, BOOK_PALETTE[1], true, false, 0.004);
      cylAt(g, 0.095, 0.055, 0.09, innerW * 0.22, baseObjY + 0.045, 0.02, M.ceramicMat, true, false, 16);
    }
  });

  // Sculpted ceramic vase on top surface
  const vasePts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.056, 0),
    new THREE.Vector2(0.095, 0.13),
    new THREE.Vector2(0.046, 0.25),
    new THREE.Vector2(0.06, 0.31),
  ];
  const vase = new THREE.Mesh(new THREE.LatheGeometry(vasePts, 18), M.ceramicMat);
  vase.position.set(-w * 0.24, H, 0);
  g.add(vase);

  parent.add(g);
  return g;
}

export function gooseneckLamp(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  sideDir: number,
  M: MaterialLibrary
) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x525861, roughness: 0.42, metalness: 0.72 });
  const lampHead = new THREE.MeshBasicMaterial({ color: 0xfff0cf, toneMapped: false });

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 6.2, 0),
    new THREE.Vector3(0, 7.1, -sideDir * 0.55),
    new THREE.Vector3(0, 7.02, -sideDir * 1.35),
  ]);
  const pole = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.095, 8, false), poleMat);
  pole.position.set(x, y, z);
  pole.castShadow = true;
  parent.add(pole);

  // Flared base collar
  cylAt(parent, 0.13, 0.18, 0.65, x, y + 0.325, z, poleMat, true, true, 12);

  // Sculpted luminaire hood
  const hood = new THREE.Mesh(getRoundedBox(0.36, 0.12, 0.72, 0.04, 2), poleMat);
  hood.position.set(x, y + 7.05, z - sideDir * 1.35);
  parent.add(hood);

  const lens = new THREE.Mesh(getRoundedBox(0.28, 0.04, 0.56, 0.02, 2), lampHead);
  lens.position.set(x, y + 6.98, z - sideDir * 1.35);
  parent.add(lens);
}

/* =========================================================
   SCULPTED VEHICLES (SEDAN, SUV, HATCHBACK — MULTI-PART)
   ========================================================= */
export {
  makeCar,
  updateCarVisualState,
  type CarBuildOptions,
  type CarRig,
  type CarStyle,
  type CarVisualState,
} from './carBuilder';

