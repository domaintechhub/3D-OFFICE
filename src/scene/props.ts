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
  r = 0.17
): THREE.Mesh {
  // Architectural recessed trim ring + warm diffuser lens
  const trim = new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r * 1.24, 18), M.metal);
  trim.rotation.x = Math.PI / 2;
  trim.position.set(x, y + 0.002, z);
  parent.add(trim);

  const m = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 16), M.lamp);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);

  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: M.textures.glowTex,
      color: 0xffedd2,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  s.scale.set(0.95, 0.95, 1);
  s.position.set(x, y - 0.12, z);
  parent.add(s);
  return m;
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
const STEM_MAT = new THREE.MeshStandardMaterial({ color: 0x46682f, roughness: 0.85 });
const LEAF_CARD_GEO = new THREE.PlaneGeometry(1, 1);

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
   SCULPTED FURNITURE (NO BOXES!)
   ========================================================= */
let armchairSeatGeo: THREE.BufferGeometry | null = null;
let armchairBackGeo: THREE.BufferGeometry | null = null;
let armchairArmGeo: THREE.BufferGeometry | null = null;
let sofaSeatGeo: THREE.BufferGeometry | null = null;
let sofaBackGeo: THREE.BufferGeometry | null = null;
let pillowGeo: THREE.BufferGeometry | null = null;
let officeSeatGeo: THREE.BufferGeometry | null = null;
let officeBackGeo: THREE.BufferGeometry | null = null;

function initFurnitureGeos() {
  if (armchairSeatGeo) return;
  armchairSeatGeo = getRoundedBox(1.06, 0.22, 0.96, 0.09, 4);
  armchairBackGeo = getRoundedBox(1.24, 0.58, 0.22, 0.09, 4);
  armchairArmGeo = getRoundedBox(0.2, 0.4, 1.12, 0.08, 4);
  sofaSeatGeo = getRoundedBox(1.28, 0.22, 0.96, 0.09, 4);
  sofaBackGeo = getRoundedBox(2.86, 0.62, 0.24, 0.1, 4);
  pillowGeo = getRoundedBox(0.42, 0.36, 0.14, 0.06, 3);
  officeSeatGeo = getRoundedBox(0.54, 0.09, 0.52, 0.04, 3);

  // Curved ergonomic mesh backrest
  const backCurve = new THREE.Shape();
  backCurve.moveTo(-0.25, 0);
  backCurve.quadraticCurveTo(-0.27, 0.32, -0.22, 0.58);
  backCurve.quadraticCurveTo(0, 0.64, 0.22, 0.58);
  backCurve.quadraticCurveTo(0.27, 0.32, 0.25, 0);
  backCurve.quadraticCurveTo(0, -0.03, -0.25, 0);
  officeBackGeo = new THREE.ExtrudeGeometry(backCurve, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
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

  // Timber/metal base plinth
  const base = new THREE.Mesh(getRoundedBox(1.26, 0.1, 1.08, 0.04, 2), M.walnut);
  base.position.set(0, 0.26, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // Plush cushion, curved back, rounded arms, angled pillow
  const seat = new THREE.Mesh(armchairSeatGeo!, mat);
  seat.position.set(0, 0.39, 0.03);
  seat.castShadow = true;
  seat.receiveShadow = true;
  g.add(seat);

  const back = new THREE.Mesh(armchairBackGeo!, mat);
  back.position.set(0, 0.64, -0.46);
  back.rotation.x = -0.1;
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);

  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(armchairArmGeo!, mat);
    arm.position.set(s * 0.56, 0.48, 0);
    arm.castShadow = true;
    arm.receiveShadow = true;
    g.add(arm);
  });

  // Splayed cylindrical tapered legs
  [
    [-0.52, 0.42, -0.08, 0.08],
    [0.52, 0.42, 0.08, 0.08],
    [-0.52, -0.42, -0.08, -0.08],
    [0.52, -0.42, 0.08, -0.08],
  ].forEach(([lx, lz, rz, rx]) => {
    const leg = cylAt(g, 0.032, 0.02, 0.24, lx, 0.12, lz, M.metal, false, false, 10);
    leg.rotation.z = rz;
    leg.rotation.x = rx;
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

  const base = new THREE.Mesh(getRoundedBox(2.84, 0.1, 1.08, 0.04, 2), M.walnut);
  base.position.set(0, 0.26, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  [-0.66, 0.66].forEach((cx) => {
    const c = new THREE.Mesh(sofaSeatGeo!, mat);
    c.position.set(cx, 0.39, 0.03);
    c.castShadow = true;
    c.receiveShadow = true;
    g.add(c);
  });

  const back = new THREE.Mesh(sofaBackGeo!, mat);
  back.position.set(0, 0.64, -0.46);
  back.rotation.x = -0.1;
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);

  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(armchairArmGeo!, mat);
    arm.position.set(s * 1.32, 0.48, 0);
    arm.castShadow = true;
    arm.receiveShadow = true;
    g.add(arm);

    const pil = new THREE.Mesh(pillowGeo!, M.fabricGrey);
    pil.position.set(s * 1.04, 0.6, -0.18);
    pil.rotation.set(-0.24, s * 0.32, s * 0.12);
    pil.castShadow = true;
    g.add(pil);
  });

  [
    [-1.24, 0.42],
    [1.24, 0.42],
    [-1.24, -0.42],
    [1.24, -0.42],
  ].forEach(([lx, lz]) => {
    cylAt(g, 0.035, 0.022, 0.24, lx, 0.12, lz, M.metal, false, false, 10);
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

  const seat = new THREE.Mesh(officeSeatGeo!, M.leatherMat);
  seat.position.set(0, 0.49, 0);
  seat.castShadow = true;
  seat.receiveShadow = true;
  g.add(seat);

  const back = new THREE.Mesh(officeBackGeo!, M.fabricGrey);
  back.position.set(0, 0.54, -0.26);
  back.rotation.x = -0.09;
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);

  // Curved spine + armrests
  const spine = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.44, -0.04),
        new THREE.Vector3(0, 0.46, -0.24),
        new THREE.Vector3(0, 0.72, -0.28),
      ]),
      8,
      0.024,
      8,
      false
    ),
    M.black
  );
  g.add(spine);

  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(s * 0.25, 0.46, -0.06),
          new THREE.Vector3(s * 0.28, 0.62, -0.08),
          new THREE.Vector3(s * 0.28, 0.63, 0.12),
        ]),
        8,
        0.02,
        7,
        false
      ),
      M.black
    );
    g.add(arm);
  });

  cylAt(g, 0.03, 0.036, 0.34, 0, 0.3, 0, M.metal, false, false, 12);

  // 5-star splayed base + caster wheels
  for (let k = 0; k < 5; k++) {
    const a = (k * Math.PI * 2) / 5 + 0.3;
    const cx = Math.cos(a) * 0.27;
    const cz = Math.sin(a) * 0.27;
    const leg = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.13, 0), new THREE.Vector3(cx, 0.06, cz)]),
        3,
        0.018,
        6,
        false
      ),
      M.metal
    );
    g.add(leg);
    cylAt(g, 0.024, 0.024, 0.03, cx, 0.026, cz, M.black, false, false, 8);
  }

  parent.add(g);
  return g;
}

let mugGeo: THREE.LatheGeometry | null = null;
function getMugGeo(): THREE.LatheGeometry {
  if (mugGeo) return mugGeo;
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.036, 0),
    new THREE.Vector2(0.04, 0.085),
    new THREE.Vector2(0.036, 0.09),
    new THREE.Vector2(0.033, 0.015),
    new THREE.Vector2(0.001, 0.015),
  ];
  mugGeo = new THREE.LatheGeometry(pts, 14);
  return mugGeo;
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

  // Brushed metal sculpted Y-stand
  const base = new THREE.Mesh(getRoundedBox(0.26, 0.018, 0.16, 0.008, 2), M.metal);
  base.position.set(0, 0.009, 0);
  g.add(base);

  const neck = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.01, -0.02), new THREE.Vector3(0, 0.18, -0.03), new THREE.Vector3(0, 0.34, 0)]),
      6,
      0.022,
      8,
      false
    ),
    M.metal
  );
  g.add(neck);

  // Slim beveled display housing
  const bezel = new THREE.Mesh(getRoundedBox(0.76, 0.45, 0.036, 0.014, 2), M.black);
  bezel.position.set(0, 0.36, 0);
  bezel.castShadow = true;
  g.add(bezel);

  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.39), smat || (warm ? M.screenWarm : M.screen));
  sc.position.set(0, 0.36, 0.019);
  g.add(sc);

  // Keyboard, wireless mouse, and ceramic coffee mug on the desk surface
  const kb = new THREE.Mesh(getRoundedBox(0.38, 0.014, 0.13, 0.006, 2), M.dark);
  kb.position.set(-0.04, 0.007, 0.22);
  g.add(kb);

  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M.dark);
  mouse.scale.set(0.75, 0.42, 1.2);
  mouse.position.set(0.24, 0.012, 0.22);
  g.add(mouse);

  const mug = new THREE.Mesh(getMugGeo(), M.ceramicMat);
  mug.position.set(-0.34, 0, 0.18);
  g.add(mug);

  parent.add(g);
  return g;
}

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

  // Beveled walnut cabinet + ceramic vase on top shelf
  const body = new THREE.Mesh(getRoundedBox(w, 2.35, 0.36, 0.025, 2), M.walnut);
  body.position.set(0, 1.175, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.08, 2.26),
    new THREE.MeshStandardMaterial({ map: M.textures.shelfTex, roughness: 0.84, metalness: 0.02 })
  );
  face.position.set(0, 1.175, 0.182);
  g.add(face);

  // Sculpted ceramic vase on top
  const vasePts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.06, 0),
    new THREE.Vector2(0.1, 0.14),
    new THREE.Vector2(0.05, 0.26),
    new THREE.Vector2(0.065, 0.32),
  ];
  const vase = new THREE.Mesh(new THREE.LatheGeometry(vasePts, 16), M.ceramicMat);
  vase.position.set(-w * 0.24, 2.35, 0);
  vase.castShadow = true;
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

  const gl = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: M.textures.glowTex,
      color: 0xffdca0,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  gl.scale.set(3.2, 3.2, 1);
  gl.position.set(x, y + 6.85, z - sideDir * 1.35);
  parent.add(gl);
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
  roughness: 0.05,
  metalness: 0.12,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  envMapIntensity: 1.6,
});
const CAR_TYRE_MAT = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.88 });
const CAR_RIM_MAT = new THREE.MeshPhysicalMaterial({ color: 0xc8cfd6, roughness: 0.22, metalness: 0.9, envMapIntensity: 1.2 });
const CAR_TRIM_MAT = new THREE.MeshStandardMaterial({ color: 0x181b20, roughness: 0.5, metalness: 0.4 });
const CAR_HEAD_MAT = new THREE.MeshBasicMaterial({ color: 0xfff3d4, toneMapped: false });
const CAR_TAIL_MAT = new THREE.MeshBasicMaterial({ color: 0xd92630, toneMapped: false });

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
    roughness: 0.24,
    metalness: 0.65,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.15,
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
