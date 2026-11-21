import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MaterialLibrary } from './materials';
import { leafTex, makeCanvasTex } from './textures';

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
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0,
      envMapIntensity: 0.16,
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
  palm: { h: 1.0, spread: 0.46, n: 7, leaf: 'frond', pot: 'concrete', potR: 0.26, potH: 0.42, potTaper: 0.74, greens: [0x2f6b2c, 0x3d8434, 0x285a26], leafScale: [0.95, 0.28] },
  ficus: { h: 1.05, spread: 0.4, n: 9, leaf: 'broad', pot: 'terracotta', potR: 0.27, potH: 0.4, potTaper: 0.72, greens: [0x2e6b30, 0x3f8a3a, 0x24572a], leafScale: [1.05, 0.62] },
  sanse: { h: 0.92, spread: 0.26, n: 11, leaf: 'strap', pot: 'dark', potR: 0.23, potH: 0.36, potTaper: 0.7, greens: [0x357a34, 0x2c6529], leafScale: [0.42, 1.5] },
  monst: { h: 0.78, spread: 0.52, n: 8, leaf: 'split', pot: 'concrete', potR: 0.3, potH: 0.36, potTaper: 0.8, greens: [0x2f7430, 0x276027], leafScale: [1.15, 0.85] },
  fern: { h: 0.62, spread: 0.56, n: 12, leaf: 'blade', pot: 'terracotta', potR: 0.26, potH: 0.34, potTaper: 0.78, greens: [0x4a8f3c, 0x3a7a34, 0x5aa044], leafScale: [0.9, 0.55] },
  grass: { h: 0.86, spread: 0.3, n: 14, leaf: 'blade', pot: 'dark', potR: 0.22, potH: 0.34, potTaper: 0.68, greens: [0x5da343, 0x4a8f3c, 0x6fb84e], leafScale: [0.5, 1.15] },
  olive: { h: 1.1, spread: 0.44, n: 10, leaf: 'broad', pot: 'brass', potR: 0.25, potH: 0.44, potTaper: 0.7, greens: [0x6b8a52, 0x5d7c47, 0x7d9a5e], leafScale: [0.55, 0.72] },
};
const SPECIES_KEYS = Object.keys(SPECIES);

const SOIL_MAT = new THREE.MeshStandardMaterial({ color: 0x382b1e, roughness: 1 });
const PEBBLE_MAT = new THREE.MeshStandardMaterial({ color: 0x6c6860, roughness: 0.88 });
const STEM_MAT = new THREE.MeshStandardMaterial({ color: 0x46682f, roughness: 0.85 });
const LEAF_CARD_GEO = (() => {
  // Arched botanical leaf card with slight V-fold midrib curvature
  const g = new THREE.PlaneGeometry(1, 1, 2, 5);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const t = 0.5 - ly; // 0 at tip/top, 1 at base
    const arch = -0.14 * (ly * ly) + 0.06 * (1 - t);
    const vfold = Math.abs(lx) * 0.08;
    pos.setZ(i, arch + vfold);
  }
  g.computeVertexNormals();
  return g;
})();

function makeSculptedPotGeo(potR: number, potH: number, taper: number): THREE.LatheGeometry {
  const b = potR * taper;
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(b, 0),
    new THREE.Vector2(b * 1.03, potH * 0.14),
    new THREE.Vector2(potR * 0.98, potH * 0.84),
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

  contact(g, 0, 0.012, 0, sp.potR * 2.6 * s, sp.potR * 2.6 * s, 0.52, M.textures.shadowTex);

  const pm = getPotMat(sp.pot);
  const potR = sp.potR * s;
  const potH = sp.potH * s;
  const potMesh = new THREE.Mesh(makeSculptedPotGeo(potR, potH, sp.potTaper), pm);
  potMesh.castShadow = true;
  potMesh.receiveShadow = true;
  g.add(potMesh);

  cylAt(g, potR * 0.88, potR * 0.88, 0.02, 0, potH * 0.89, 0, SOIL_MAT, false, false, 16);
  const pebbleRing = new THREE.Mesh(new THREE.TorusGeometry(potR * 0.72, potR * 0.08, 6, 16), PEBBLE_MAT);
  pebbleRing.rotation.x = Math.PI / 2;
  pebbleRing.scale.set(1, 1, 0.45);
  pebbleRing.position.set(0, potH * 0.905, 0);
  g.add(pebbleRing);

  const leafMats = sp.greens.map((c) => getLeafMat(sp.leaf, c));
  const stems: Array<{ sg: THREE.Group; hh: number; a: number; i: number; len: number }> = [];
  const n = sp.n;
  for (let i = 0; i < n; i++) {
    const a = rnd(i + 21) * Math.PI * 2;
    const rad = (0.04 + rnd(i + 31) * sp.spread * 0.62) * scale;
    const hh = (0.34 + rnd(i + 41) * 0.72) * scale;
    const sg = new THREE.Group();
    sg.position.set(Math.cos(a) * rad, potH * 0.88, Math.sin(a) * rad);
    sg.rotation.z = (rnd(i + 51) - 0.5) * 0.55;
    sg.rotation.x = (rnd(i + 61) - 0.5) * 0.55;
    const stemLen = kind === 'grass' || kind === 'sanse' ? hh * 1.05 : hh * 0.86;
    cylAt(sg, 0.011 * scale, 0.006 * scale, stemLen, 0, stemLen / 2, 0, STEM_MAT, false, false, 7);
    g.add(sg);
    stems.push({ sg, hh, a, i, len: stemLen });
  }

  stems.forEach((st) => {
    const per = kind === 'grass' || kind === 'fern' || kind === 'sanse' ? 1 : 2;
    for (let k = 0; k < per; k++) {
      const mat = leafMats[(st.i + k) % leafMats.length];
      const card = new THREE.Mesh(LEAF_CARD_GEO, mat);
      const lw = (0.34 + rnd(st.i * 7 + k + 11) * 0.26) * scale;
      const lh = lw * sp.leafScale[1];
      card.scale.set(lw, lh, 1);
      const out = kind === 'grass' || kind === 'sanse' ? 0.01 * scale : (0.03 + rnd(st.i + k + 101) * 0.05) * scale;
      card.position.set(Math.cos(st.a) * out, st.len - (k ? 0.07 * scale : 0) - lh * 0.28, Math.sin(st.a) * out);
      const tilt = kind === 'grass' ? 0.22 : kind === 'sanse' ? 0.1 : 0.62;
      card.rotation.set(-tilt + (rnd(st.i + k + 71) - 0.5) * 0.3, -st.a + Math.PI / 2 + (rnd(st.i + k + 81) - 0.5) * 0.5, (rnd(st.i + k + 91) - 0.5) * 0.5);
      st.sg.add(card);
    }
  });

  const crownN = kind === 'grass' ? 0 : kind === 'sanse' ? 3 : 4;
  for (let i = 0; i < crownN; i++) {
    const a = rnd(i + 121) * Math.PI * 2;
    const rad = (0.08 + rnd(i + 131) * sp.spread * 0.5) * scale;
    const card = new THREE.Mesh(LEAF_CARD_GEO, leafMats[(i + 1) % leafMats.length]);
    const lw = (0.36 + rnd(i + 141) * 0.3) * scale;
    const lh = lw * sp.leafScale[1];
    card.scale.set(lw, lh, 1);
    card.position.set(Math.cos(a) * rad, potH + (0.3 + rnd(i + 151) * 0.42) * scale, Math.sin(a) * rad);
    card.rotation.set(-0.5 + (rnd(i + 161) - 0.5) * 0.6, -a + Math.PI / 2, (rnd(i + 171) - 0.5) * 0.5);
    g.add(card);
  }

  parent.add(g);
  return g;
}

let treeCanopyMats: THREE.MeshStandardMaterial[] | null = null;
function getTreeCanopyMats(): THREE.MeshStandardMaterial[] {
  if (treeCanopyMats) return treeCanopyMats;
  const cl = makeCanvasTex('treeleaf', 128, 128, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = 6 + Math.random() * 12;
      g.save();
      g.translate(x, y);
      g.rotate(Math.random() * 7);
      g.fillStyle = Math.random() < 0.45 ? 'rgba(116,170,80,0.96)' : 'rgba(72,134,58,0.96)';
      g.beginPath();
      g.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });
  const mk = (c: number) =>
    new THREE.MeshStandardMaterial({
      map: cl,
      color: c,
      transparent: true,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.14,
    });
  treeCanopyMats = [mk(0xffffff), mk(0xe6eed6), mk(0xcfdcB4), mk(0xf0f4e2)];
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
  const trunkR = h * 0.04;
  const canopyMats = getTreeCanopyMats();
  contact(g, 0, 0.02, 0, canopyR * 0.9, canopyR * 0.9, 0.48, M.textures.shadowTex);

  // Organic curved trunk via TubeGeometry + root buttress flare
  const leanX = (rnd(3) - 0.5) * 0.28;
  const leanZ = (rnd(4) - 0.5) * 0.24;
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(leanX * h * 0.08, h * 0.22, leanZ * h * 0.08),
    new THREE.Vector3(leanX * h * 0.2, h * 0.54, leanZ * h * 0.18),
  ]);
  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 10, trunkR, 8, false);
  // Taper the trunk vertices organically upward
  const pos = trunkGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    const t = Math.max(0, Math.min(1, py / (h * 0.54)));
    const scaleR = 1.45 - t * 0.85;
    const center = trunkCurve.getPointAt(t);
    pos.setX(i, center.x + (pos.getX(i) - center.x) * scaleR);
    pos.setZ(i, center.z + (pos.getZ(i) - center.z) * scaleR);
  }
  trunkGeo.computeVertexNormals();
  const trunkMesh = new THREE.Mesh(trunkGeo, M.bark);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  g.add(trunkMesh);

  const forkOrigin = trunkCurve.getPointAt(0.92);
  const limbs = 4 + Math.floor(rnd(9) * 3);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + rnd(i + 11) * 0.7;
    const spread = canopyR * (0.55 + rnd(i + 31) * 0.45);
    const tipY = h * (0.76 + rnd(i + 41) * 0.2);
    const mid = new THREE.Vector3(
      forkOrigin.x + Math.cos(a) * spread * 0.52,
      forkOrigin.y + (tipY - forkOrigin.y) * 0.62,
      forkOrigin.z + Math.sin(a) * spread * 0.52
    );
    const tip = new THREE.Vector3(
      forkOrigin.x + Math.cos(a) * spread,
      tipY,
      forkOrigin.z + Math.sin(a) * spread
    );
    const lCurve = new THREE.CatmullRomCurve3([forkOrigin.clone(), mid, tip]);
    const limbMesh = new THREE.Mesh(new THREE.TubeGeometry(lCurve, 6, trunkR * 0.36, 6, false), M.barkDark);
    limbMesh.castShadow = true;
    g.add(limbMesh);

    // Multi-angle foliage clusters along the limb and tip so the crown has full 3D volume
    for (let f = 0; f < 3; f++) {
      const pt = f === 0 ? mid : tip;
      const cm = new THREE.Mesh(LEAF_CARD_GEO, canopyMats[(i + f) % canopyMats.length]);
      const cw = canopyR * (0.68 + rnd(i * 11 + f) * 0.44);
      cm.scale.set(cw, cw * 0.82, 1);
      cm.position.set(
        pt.x + (rnd(i * 7 + f) - 0.5) * canopyR * 0.28,
        pt.y + (f === 2 ? canopyR * 0.2 : 0),
        pt.z + (rnd(i * 13 + f) - 0.5) * canopyR * 0.28
      );
      cm.rotation.set(-0.25 - f * 0.22, a + f * 1.1, (rnd(i + f) - 0.5) * 0.35);
      g.add(cm);
    }
  }

  for (let i = 0; i < 5; i++) {
    const a = rnd(i + 111) * Math.PI * 2;
    const cm = new THREE.Mesh(LEAF_CARD_GEO, canopyMats[(i + 2) % canopyMats.length]);
    const cw = canopyR * (0.76 + rnd(i + 121) * 0.4);
    cm.scale.set(cw, cw * 0.82, 1);
    cm.position.set(Math.cos(a) * canopyR * 0.22, h * 0.84 + rnd(i + 131) * h * 0.14, Math.sin(a) * canopyR * 0.22);
    cm.rotation.set(-0.22, a + Math.PI / 2, (rnd(i + 141) - 0.5) * 0.4);
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
  officeSeatGeo.rotateY(Math.PI / 2);

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
   SCULPTED VEHICLES (SEDAN, SUV, HATCHBACK — NO BOXES!)
   ========================================================= */
type CarStyle = 'sedan' | 'suv' | 'hatch';

interface CarGeos {
  body: THREE.ExtrudeGeometry;
  cabin: THREE.ExtrudeGeometry;
  grille: THREE.BufferGeometry;
  wheel: THREE.BufferGeometry;
  rim: THREE.BufferGeometry;
  lampBar: THREE.BufferGeometry;
  mirror: THREE.BufferGeometry;
}

const CAR_STYLE_CACHE = new Map<CarStyle, CarGeos>();
const CAR_GLASS_MAT = new THREE.MeshPhysicalMaterial({
  color: 0x16202a,
  roughness: 0.16,
  metalness: 0.08,
  clearcoat: 0.2,
  clearcoatRoughness: 0.18,
  envMapIntensity: 0.4,
});
const CAR_TYRE_MAT = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.88 });
const CAR_RIM_MAT = new THREE.MeshPhysicalMaterial({ color: 0xbcc4cc, roughness: 0.36, metalness: 0.78, envMapIntensity: 0.45 });
const CAR_TRIM_MAT = new THREE.MeshStandardMaterial({ color: 0x181b20, roughness: 0.58, metalness: 0.3 });
const CAR_HEAD_MAT = new THREE.MeshBasicMaterial({ color: 0xefe2c4 });
const CAR_TAIL_MAT = new THREE.MeshBasicMaterial({ color: 0xc8242e });

function buildCarStyle(style: CarStyle): CarGeos {
  const existing = CAR_STYLE_CACHE.get(style);
  if (existing) return existing;

  // Profile drawn in X (Z along car length: +x = front) and Y (height), then rotated so +Z is front
  const s = new THREE.Shape();
  if (style === 'suv') {
    s.moveTo(-2.08, 0.24);
    s.lineTo(2.05, 0.24);
    s.quadraticCurveTo(2.14, 0.45, 2.08, 0.72);
    s.quadraticCurveTo(1.85, 0.88, 1.05, 0.92);
    s.lineTo(0.48, 1.44);
    s.quadraticCurveTo(0.15, 1.5, -1.48, 1.46);
    s.quadraticCurveTo(-1.92, 1.38, -2.06, 0.88);
    s.lineTo(-2.08, 0.24);
  } else if (style === 'hatch') {
    s.moveTo(-1.86, 0.22);
    s.lineTo(1.9, 0.22);
    s.quadraticCurveTo(2.02, 0.42, 1.94, 0.66);
    s.quadraticCurveTo(1.68, 0.82, 0.95, 0.86);
    s.lineTo(0.32, 1.34);
    s.quadraticCurveTo(-0.3, 1.38, -1.3, 1.3);
    s.quadraticCurveTo(-1.74, 1.12, -1.86, 0.68);
    s.lineTo(-1.86, 0.22);
  } else {
    // sleek executive sedan
    s.moveTo(-2.12, 0.22);
    s.lineTo(2.12, 0.22);
    s.quadraticCurveTo(2.22, 0.4, 2.12, 0.64);
    s.quadraticCurveTo(1.75, 0.8, 1.0, 0.84);
    s.lineTo(0.36, 1.28);
    s.quadraticCurveTo(-0.2, 1.33, -0.88, 1.26);
    s.lineTo(-1.58, 0.88);
    s.quadraticCurveTo(-2.02, 0.84, -2.12, 0.62);
    s.lineTo(-2.12, 0.22);
  }

  const body = new THREE.ExtrudeGeometry(s, {
    depth: 1.56,
    bevelEnabled: true,
    bevelThickness: 0.13,
    bevelSize: 0.08,
    bevelSegments: 4,
    curveSegments: 10,
  });
  body.translate(0, 0, -0.78);
  body.rotateY(-Math.PI / 2); // now +Z is front!

  // Recessed greenhouse cabin glass
  const cab = new THREE.Shape();
  if (style === 'suv') {
    cab.moveTo(-1.68, 0.86);
    cab.lineTo(0.95, 0.86);
    cab.lineTo(0.42, 1.38);
    cab.lineTo(-1.42, 1.38);
    cab.closePath();
  } else if (style === 'hatch') {
    cab.moveTo(-1.52, 0.82);
    cab.lineTo(0.86, 0.82);
    cab.lineTo(0.28, 1.28);
    cab.lineTo(-1.24, 1.24);
    cab.closePath();
  } else {
    cab.moveTo(-1.44, 0.8);
    cab.lineTo(0.92, 0.8);
    cab.lineTo(0.32, 1.23);
    cab.lineTo(-0.84, 1.21);
    cab.closePath();
  }
  const cabin = new THREE.ExtrudeGeometry(cab, {
    depth: 1.36,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  cabin.translate(0, 0, -0.68);
  cabin.rotateY(-Math.PI / 2);

  // Wheel tire profile via Lathe
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.255, 16);
  rimGeo.rotateZ(Math.PI / 2);

  const geos: CarGeos = {
    body,
    cabin,
    grille: getRoundedBox(0.92, 0.2, 0.08, 0.03, 2),
    wheel: wheelGeo,
    rim: rimGeo,
    lampBar: getRoundedBox(0.34, 0.09, 0.08, 0.03, 2),
    mirror: getRoundedBox(0.16, 0.09, 0.12, 0.03, 2),
  };
  CAR_STYLE_CACHE.set(style, geos);
  return geos;
}

export function makeCar(col: number, style: CarStyle = 'sedan'): THREE.Group {
  const car = new THREE.Group();
  const geos = buildCarStyle(style);

  const bm = new THREE.MeshPhysicalMaterial({
    color: col,
    roughness: 0.36,
    metalness: 0.45,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.45,
  });

  const bodyMesh = new THREE.Mesh(geos.body, bm);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  car.add(bodyMesh);

  const cabMesh = new THREE.Mesh(geos.cabin, CAR_GLASS_MAT);
  car.add(cabMesh);

  const frontZ = style === 'hatch' ? 1.97 : 2.15;
  const backZ = style === 'hatch' ? -1.9 : -2.14;
  const wbZ = style === 'hatch' ? 1.24 : 1.36;

  // Front grille + side mirrors
  const grille = new THREE.Mesh(geos.grille, CAR_TRIM_MAT);
  grille.position.set(0, 0.44, frontZ);
  car.add(grille);

  [-0.86, 0.86].forEach((mx) => {
    const mir = new THREE.Mesh(geos.mirror, bm);
    mir.position.set(mx, 0.88, 0.56);
    car.add(mir);
  });

  // Wheels + alloy rims
  [
    [-0.84, wbZ],
    [0.84, wbZ],
    [-0.84, -wbZ],
    [0.84, -wbZ],
  ].forEach(([wx, wz]) => {
    const wh = new THREE.Mesh(geos.wheel, CAR_TYRE_MAT);
    wh.position.set(wx, 0.34, wz);
    car.add(wh);
    const rm = new THREE.Mesh(geos.rim, CAR_RIM_MAT);
    rm.position.set(wx, 0.34, wz);
    car.add(rm);
  });

  // LED headlamps & ruby tail lamps
  [-0.64, 0.64].forEach((lx) => {
    const hl = new THREE.Mesh(geos.lampBar, CAR_HEAD_MAT);
    hl.position.set(lx, 0.57, frontZ - 0.03);
    car.add(hl);
    const tl = new THREE.Mesh(geos.lampBar, CAR_TAIL_MAT);
    tl.position.set(lx, 0.62, backZ + 0.02);
    car.add(tl);
  });

  car.userData.body = bm;
  return car;
}
