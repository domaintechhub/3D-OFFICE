import * as THREE from 'three';
import type { MaterialLibrary } from './materials';
import { ARCH_LEAF_GEO, CROSSED_SPRAY_GEO } from './props';
import { leafTex } from './textures';

export interface GenericPlantBlockMeta {
  kind: 'hedge' | 'planterTrough' | 'shrub' | 'mossWall' | 'pottedPlant';
  len?: number;
  depth?: number;
  height?: number;
  radius?: number;
  flowering?: boolean;
  w?: number;
  h?: number;
  safeClearXMin?: number;
  safeClearXMax?: number;
  species?: string;
  scale?: number;
}

export interface WindSwayItem {
  obj: THREE.Object3D;
  baseRotX: number;
  baseRotY: number;
  baseRotZ: number;
  phase: number;
  freq: number;
  amp: number;
}

export interface ProceduralFoliageResult {
  replacedHedges: number;
  replacedPlanters: number;
  replacedShrubs: number;
  replacedMossWalls: number;
  variedPottedPlants: number;
  variedTrees: number;
  windItems: WindSwayItem[];
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

/* =========================================================
   NON-REPEATING 3D SIMPLEX-STYLE VALUE NOISE + DOMAIN WARPING
   ========================================================= */

function fract(x: number): number {
  return x - Math.floor(x);
}

/** High-entropy irrational 3D spatial hash with zero axis-aligned grid repetition. */
function hash3(ix: number, iy: number, iz: number): number {
  const h = Math.sin(ix * 127.1 + iy * 311.7 + iz * 74.7) * 43758.5453123;
  return fract(h);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);

  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const fz = smooth(z - iz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const nx00 = n000 + (n100 - n000) * fx;
  const nx10 = n010 + (n110 - n010) * fx;
  const nx01 = n001 + (n101 - n001) * fx;
  const nx11 = n011 + (n111 - n011) * fx;

  const nxy0 = nx00 + (nx10 - nx00) * fy;
  const nxy1 = nx01 + (nx11 - nx01) * fy;

  return (nxy0 + (nxy1 - nxy0) * fz) * 2 - 1;
}

/** Multi-octave 3D FBM using non-integer golden/silver octave rotation so patterns never tile. */
export function fbm3(x: number, y: number, z: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.52;
  let freq = 1.0;
  let px = x;
  let py = y;
  let pz = z;

  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(px * freq, py * freq, pz * freq);
    // Rotate & skew axes by irrational constants between octaves to eliminate axial repetition
    const nx = px * 0.8 + pz * 0.6 + 13.371;
    const ny = py * 0.866 - px * 0.5 + 7.913;
    const nz = pz * 0.8 - px * 0.6 + 21.618;
    px = nx;
    py = ny;
    pz = nz;
    freq *= 2.07;
    amp *= 0.49;
  }
  return sum;
}

/** Domain-warped non-repeating 3D noise producing billowing organic foliage silhouettes. */
export function warpedNoise3(x: number, y: number, z: number, warp = 0.62): number {
  const wx = fbm3(x + 1.618, y + 2.414, z + 1.324, 2);
  const wy = fbm3(x + 17.32, y + 9.47, z + 31.14, 2);
  const wz = fbm3(x + 41.89, y + 3.17, z + 12.73, 2);
  return fbm3(x + wx * warp, y + wy * warp, z + wz * warp, 4);
}

/* =========================================================
   GEOMETRY MERGE & NOISE SCULPTING PRIMITIVES
   ========================================================= */

function ensureColorAttr(geo: THREE.BufferGeometry, baseColor: THREE.Color) {
  if (geo.attributes.color) return;
  const count = geo.attributes.position.count;
  const cols = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    cols[i * 3] = baseColor.r;
    cols[i * 3 + 1] = baseColor.g;
    cols[i * 3 + 2] = baseColor.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}

function mergeBufferGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pairs = geos.map((orig) => ({ orig, g: orig.index ? orig.toNonIndexed() : orig }));
  let totalVerts = 0;
  for (const { g } of pairs) {
    totalVerts += g.attributes.position.count;
  }

  const posOut = new Float32Array(totalVerts * 3);
  const normOut = new Float32Array(totalVerts * 3);
  const uvOut = new Float32Array(totalVerts * 2);
  const colOut = new Float32Array(totalVerts * 3);

  let offset = 0;
  for (const { orig, g } of pairs) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const uv = g.attributes.uv;
    const col = g.attributes.color;
    const count = pos.count;

    for (let i = 0; i < count; i++) {
      const i3 = (offset + i) * 3;
      const i2 = (offset + i) * 2;
      posOut[i3] = pos.getX(i);
      posOut[i3 + 1] = pos.getY(i);
      posOut[i3 + 2] = pos.getZ(i);

      normOut[i3] = norm.getX(i);
      normOut[i3 + 1] = norm.getY(i);
      normOut[i3 + 2] = norm.getZ(i);

      if (uv) {
        uvOut[i2] = uv.getX(i);
        uvOut[i2 + 1] = uv.getY(i);
      }

      if (col) {
        colOut[i3] = col.getX(i);
        colOut[i3 + 1] = col.getY(i);
        colOut[i3 + 2] = col.getZ(i);
      } else {
        colOut[i3] = 1;
        colOut[i3 + 1] = 1;
        colOut[i3 + 2] = 1;
      }
    }
    offset += count;
    if (g !== orig) {
      g.dispose();
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posOut, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normOut, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvOut, 2));
  merged.setAttribute('color', new THREE.BufferAttribute(colOut, 3));
  return merged;
}

const C_SHADOW_GREEN = new THREE.Color(0x0f260d);
const C_MID_GREEN = new THREE.Color(0x214919);
const C_SUN_GREEN = new THREE.Color(0x3a6e28);
const C_WARM_TIP = new THREE.Color(0x528836);
const _tmpCol = new THREE.Color();

let UNIT_ICO_DETAIL_1: THREE.BufferGeometry | null = null;
function getUnitIcoDetail1(): THREE.BufferGeometry {
  if (!UNIT_ICO_DETAIL_1) {
    UNIT_ICO_DETAIL_1 = new THREE.IcosahedronGeometry(1, 1);
  }
  return UNIT_ICO_DETAIL_1;
}

/**
 * Sculpts a single organic foliage lobe volume deformed in world-space coordinates
 * with non-repeating domain-warped FBM noise & ambient-occlusion vertex coloring.
 */
function buildNoiseFoliageLobe(
  localX: number,
  localY: number,
  localZ: number,
  rx: number,
  ry: number,
  rz: number,
  worldAnchor: THREE.Vector3,
  detail = 1,
  noiseAmp = 0.42,
  baseHueShift = 0
): THREE.BufferGeometry {
  const g = detail <= 1 ? getUnitIcoDetail1().clone() : new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position;
  const cols = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    const sx = vx * rx;
    const sy = vy * ry;
    const sz = vz * rz;

    const wx = worldAnchor.x + localX + sx;
    const wy = worldAnchor.y + localY + sy;
    const wz = worldAnchor.z + localZ + sz;

    const n = warpedNoise3(wx * 1.45, wy * 1.55, wz * 1.45, 0.78);
    const radialScale = 1 + n * noiseAmp;

    // Flatten slightly under base to sit organically on earth/soil
    const flattenY = vy < -0.25 ? 0.74 : 1.0;

    const fx = localX + sx * radialScale;
    const fy = localY + sy * radialScale * flattenY;
    const fz = localZ + sz * radialScale;
    pos.setXYZ(i, fx, fy, fz);

    // Deep botanical crevice shading -> natural sunlit olive-forest tips
    const sunMix = THREE.MathUtils.clamp(0.42 + vy * 0.4 + n * 0.4 + baseHueShift * 0.14, 0, 1);
    if (sunMix < 0.5) {
      _tmpCol.copy(C_SHADOW_GREEN).lerp(C_MID_GREEN, sunMix * 2);
    } else if (sunMix < 0.84) {
      _tmpCol.copy(C_MID_GREEN).lerp(C_SUN_GREEN, (sunMix - 0.5) / 0.34);
    } else {
      _tmpCol.copy(C_SUN_GREEN).lerp(C_WARM_TIP, (sunMix - 0.84) / 0.16);
    }
    cols[i * 3] = _tmpCol.r;
    cols[i * 3 + 1] = _tmpCol.g;
    cols[i * 3 + 2] = _tmpCol.b;
  }

  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

/** Transforms a template geometry into a target coordinate/scale/rotation with per-vertex noise jitter. */
function stampSprayGeometry(
  template: THREE.BufferGeometry,
  lx: number,
  ly: number,
  lz: number,
  sx: number,
  sy: number,
  sz: number,
  rotX: number,
  rotY: number,
  rotZ: number,
  tint: THREE.Color
): THREE.BufferGeometry {
  const g = template.clone();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(lx, ly, lz), q, new THREE.Vector3(sx, sy, sz));
  g.applyMatrix4(m);
  ensureColorAttr(g, tint);
  return g;
}

function buildOrganicTwigGeometry(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  rBase: number,
  worldAnchor: THREE.Vector3
): THREE.BufferGeometry {
  const midX = (x0 + x1) * 0.5 + fbm3((worldAnchor.x + x0) * 2.1, worldAnchor.y * 2.1, (worldAnchor.z + z0) * 2.1, 2) * 0.16;
  const midY = (y0 + y1) * 0.52;
  const midZ = (z0 + z1) * 0.5 + fbm3((worldAnchor.x + x0) * 2.1 + 9, worldAnchor.y * 2.1, (worldAnchor.z + z0) * 2.1 + 5, 2) * 0.16;

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x0, y0, z0),
    new THREE.Vector3(midX, midY, midZ),
    new THREE.Vector3(x1, y1, z1),
  ]);
  const g = new THREE.TubeGeometry(curve, 3, rBase, 4, false);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    const t = THREE.MathUtils.clamp((py - y0) / Math.max(0.08, y1 - y0), 0, 1);
    const pt = curve.getPointAt(t);
    const taper = 1.25 - t * 0.72;
    pos.setX(i, pt.x + (pos.getX(i) - pt.x) * taper);
    pos.setZ(i, pt.z + (pos.getZ(i) - pt.z) * taper);
  }
  g.computeVertexNormals();
  return g;
}

/* =========================================================
   SPECIES / FORM REPLACEMENTS INVOKED BY AtriumEngine
   ========================================================= */

function createMaterialPool(M: MaterialLibrary) {
  const shrubLeafTex = leafTex('shrubCluster');
  const blossomTex = leafTex('blossomCluster');
  const vineTex = leafTex('vineCluster');
  const strapTex = leafTex('strap');
  const broadTex = leafTex('broad');

  // Vertex-colored organic foliage volume shader material
  const volumeFoliageMat = new THREE.MeshStandardMaterial({
    normalMap: M.textures.mossNormal,
    normalScale: new THREE.Vector2(1.0, 1.0),
    vertexColors: true,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
    envMapIntensity: 0.14,
  });

  const mulchMat = new THREE.MeshStandardMaterial({
    normalMap: M.textures.concreteNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    color: 0x38291d,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.08,
  });

  const sprayMat = new THREE.MeshStandardMaterial({
    map: shrubLeafTex,
    vertexColors: true,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.34,
    side: THREE.DoubleSide,
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 0.18,
  });

  const blossomMat = new THREE.MeshStandardMaterial({
    map: blossomTex,
    vertexColors: true,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.34,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0,
    envMapIntensity: 0.22,
  });

  const vineMat = new THREE.MeshStandardMaterial({
    map: vineTex,
    vertexColors: true,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.32,
    side: THREE.DoubleSide,
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 0.16,
  });

  const grassBladeMat = new THREE.MeshStandardMaterial({
    map: strapTex,
    vertexColors: true,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.32,
    side: THREE.DoubleSide,
    roughness: 0.74,
    metalness: 0,
    envMapIntensity: 0.18,
  });

  const fernMat = new THREE.MeshStandardMaterial({
    map: broadTex,
    vertexColors: true,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.34,
    side: THREE.DoubleSide,
    roughness: 0.75,
    metalness: 0,
    envMapIntensity: 0.2,
  });

  return {
    volumeFoliageMat,
    mulchMat,
    sprayMat,
    blossomMat,
    vineMat,
    grassBladeMat,
    fernMat,
    barkMat: M.barkDark,
    allMaterials: [volumeFoliageMat, mulchMat, sprayMat, blossomMat, vineMat, grassBladeMat, fernMat],
  };
}

function clearGenericPieces(group: THREE.Object3D) {
  const toRemove: THREE.Object3D[] = [];
  for (const child of group.children) {
    if (child.userData.genericPlantPiece) {
      toRemove.push(child);
    }
  }
  for (const c of toRemove) {
    group.remove(c);
  }
}

function tintForNoise(n: number, baseHex: number, brightHex: number): THREE.Color {
  return new THREE.Color(baseHex).lerp(new THREE.Color(brightHex), THREE.MathUtils.clamp((n + 1) * 0.5, 0, 1));
}

/**
 * Replaces the boxy manicured hedge block with an irregular wild-growing organic thicket:
 * noise-carved mulch trench + woody branching stems + continuous domain-warped FBM canopy lobes
 * + asymmetric protruding foliage clusters & wild blossoms.
 */
function buildOrganicHedgeReplacement(
  group: THREE.Group,
  meta: GenericPlantBlockMeta,
  worldAnchor: THREE.Vector3,
  mats: ReturnType<typeof createMaterialPool>,
  createdGeos: THREE.BufferGeometry[],
  windItems: WindSwayItem[]
) {
  clearGenericPieces(group);
  const len = meta.len ?? 8;
  const depth = meta.depth ?? 0.95;
  const height = meta.height ?? 0.85;

  // 1. Irregular organic soil/mulch mound bed (displaced vertices along perimeter — no rectangle)
  const bedGeo = new THREE.PlaneGeometry(len + 0.22, depth + 0.26, Math.max(8, Math.round(len * 1.4)), 4);
  bedGeo.rotateX(-Math.PI / 2);
  const bPos = bedGeo.attributes.position;
  for (let i = 0; i < bPos.count; i++) {
    const px = bPos.getX(i);
    const pz = bPos.getZ(i);
    const wx = worldAnchor.x + px;
    const wz = worldAnchor.z + pz;
    const edge = Math.abs(pz) / ((depth + 0.26) * 0.5);
    const nEdge = fbm3(wx * 0.9, 1.3, wz * 0.9, 3);
    const archY = Math.max(0.006, (1 - edge * edge * 0.72) * (0.09 + nEdge * 0.04));
    bPos.setXYZ(i, px + nEdge * 0.08, archY, pz + nEdge * 0.14);
  }
  bedGeo.computeVertexNormals();
  createdGeos.push(bedGeo);
  const bedMesh = new THREE.Mesh(bedGeo, mats.mulchMat);
  bedMesh.receiveShadow = true;
  group.add(bedMesh);

  // 2. Sculpted continuous noise-carved shrubbery lobes + forked woody base twigs
  const lobeGeos: THREE.BufferGeometry[] = [];
  const twigGeos: THREE.BufferGeometry[] = [];
  const sprayGeos: THREE.BufferGeometry[] = [];
  const blossomGeos: THREE.BufferGeometry[] = [];

  let cursorX = -len * 0.46;
  let stepCount = 0;
  while (cursorX < len * 0.47) {
    const wx = worldAnchor.x + cursorX;
    const wz = worldAnchor.z;
    const nSize = warpedNoise3(wx * 0.55, worldAnchor.y * 0.55, wz * 0.55, 0.5);
    const nHeight = fbm3(wx * 0.82 + 4.1, 2.3, wz * 0.82, 3);
    const nLateral = fbm3(wx * 1.17 + 19.4, 7.2, wz * 1.17, 2);

    const rx = 0.44 + (nSize * 0.5 + 0.5) * 0.24;
    const ry = height * (0.34 + (nHeight * 0.5 + 0.5) * 0.22);
    const rz = depth * (0.32 + (nSize * 0.5 + 0.5) * 0.16);
    const cy = ry * 0.68 + 0.05;
    const cz = nLateral * depth * 0.16;

    // Dark sculpted interior volume core tucked inside dense overlapping leaf sprays
    lobeGeos.push(buildNoiseFoliageLobe(cursorX, cy, cz, rx, ry, rz, worldAnchor, 1, 0.44, nHeight));

    // Forked woody twigs peaking inside lower skirt
    if (stepCount % 2 === 0) {
      const twigTopY = cy + ry * 0.22;
      twigGeos.push(
        buildOrganicTwigGeometry(
          cursorX + nLateral * 0.08,
          0.04,
          cz,
          cursorX + nSize * 0.22,
          twigTopY,
          cz + (nSize > 0 ? 0.16 : -0.16),
          0.032,
          worldAnchor
        )
      );
    }

    // Protruding multi-angled alpha-cut leaf sprays defining the jagged outer foliage silhouette
    const spraySc = depth * 1.15 + Math.abs(nSize) * 0.46;
    const sprayTint = tintForNoise(nHeight, 0x628b4c, 0xa8ca7c);
    for (let layer = 0; layer < 2; layer++) {
      const offX = (layer === 0 ? -0.14 : 0.18) + nLateral * 0.14;
      const offY = layer === 0 ? cy + ry * 0.28 : cy + ry * 0.55;
      const offZ = (layer === 0 ? -0.12 : 0.14) * depth + nSize * 0.12;
      sprayGeos.push(
        stampSprayGeometry(
          CROSSED_SPRAY_GEO,
          cursorX + offX,
          offY,
          cz + offZ,
          spraySc * (1.1 - layer * 0.12),
          height * (0.85 + Math.abs(nHeight) * 0.35),
          spraySc * (1.05 - layer * 0.1),
          nSize * 0.32 + layer * 0.2,
          (nHeight + 1) * Math.PI + layer * 1.35,
          nLateral * 0.32,
          sprayTint
        )
      );
    }

    // Occasional natural white wild-jasmine accent bursts where noise spikes
    if (nSize > 0.22) {
      blossomGeos.push(
        stampSprayGeometry(
          CROSSED_SPRAY_GEO,
          cursorX + 0.12,
          cy + ry * 0.54,
          cz + depth * 0.26,
          spraySc * 0.62,
          spraySc * 0.58,
          spraySc * 0.62,
          0.18,
          nSize * 4.2,
          -0.12,
          new THREE.Color(0xf4f7ec)
        )
      );
    }

    cursorX += 0.66 + (nSize * 0.5 + 0.5) * 0.32;
    stepCount++;
  }

  if (twigGeos.length) {
    const mergedTwigs = mergeBufferGeometries(twigGeos);
    twigGeos.forEach((g) => g.dispose());
    createdGeos.push(mergedTwigs);
    const twigMesh = new THREE.Mesh(mergedTwigs, mats.barkMat);
    twigMesh.castShadow = true;
    group.add(twigMesh);
  }

  const mergedLobes = mergeBufferGeometries(lobeGeos);
  lobeGeos.forEach((g) => g.dispose());
  createdGeos.push(mergedLobes);
  const volumeMesh = new THREE.Mesh(mergedLobes, mats.volumeFoliageMat);
  volumeMesh.castShadow = true;
  volumeMesh.receiveShadow = true;
  group.add(volumeMesh);

  const canopySwayGroup = new THREE.Group();
  const mergedSprays = mergeBufferGeometries(sprayGeos);
  sprayGeos.forEach((g) => g.dispose());
  createdGeos.push(mergedSprays);
  const sprayMesh = new THREE.Mesh(mergedSprays, mats.sprayMat);
  sprayMesh.castShadow = true;
  canopySwayGroup.add(sprayMesh);

  if (blossomGeos.length) {
    const mergedBlossoms = mergeBufferGeometries(blossomGeos);
    blossomGeos.forEach((g) => g.dispose());
    createdGeos.push(mergedBlossoms);
    canopySwayGroup.add(new THREE.Mesh(mergedBlossoms, mats.blossomMat));
  }

  group.add(canopySwayGroup);
  windItems.push({
    obj: canopySwayGroup,
    baseRotX: 0,
    baseRotY: 0,
    baseRotZ: 0,
    phase: worldAnchor.x * 0.43 + worldAnchor.z * 0.71,
    freq: 1.55,
    amp: 0.012,
  });
}

/**
 * Replaces a boxy/uniform planter trough foliage row with overflowing multi-species clumps:
 * spiky grasses + noise-sculpted bushy cushions + cascading non-repeating ivy drapes.
 */
function buildOrganicPlanterReplacement(
  group: THREE.Group,
  meta: GenericPlantBlockMeta,
  worldAnchor: THREE.Vector3,
  mats: ReturnType<typeof createMaterialPool>,
  createdGeos: THREE.BufferGeometry[],
  windItems: WindSwayItem[]
) {
  clearGenericPieces(group);
  const len = meta.len ?? 2.6;
  const lobeGeos: THREE.BufferGeometry[] = [];
  const sprayGeos: THREE.BufferGeometry[] = [];
  const grassGeos: THREE.BufferGeometry[] = [];
  const vineGeos: THREE.BufferGeometry[] = [];
  const blossomGeos: THREE.BufferGeometry[] = [];

  let cursorX = -len * 0.45;
  let stepIdx = 0;
  while (cursorX < len * 0.46) {
    const wx = worldAnchor.x + cursorX;
    const wy = worldAnchor.y;
    const wz = worldAnchor.z;
    const nA = warpedNoise3(wx * 1.15, wy * 0.9, wz * 1.15, 0.6);
    const nB = fbm3(wx * 1.7 + 7.4, wy * 1.2 + 3.1, wz * 1.7, 3);
    const speciesRoll = (nA + 1) * 0.5;

    const cz = nB * 0.08;
    const baseY = 0.35;

    // 1. Compact dark-foliage interior heart (tucked beneath crisp alpha-cut leaf sprays)
    const rx = 0.16 + speciesRoll * 0.09;
    const ry = 0.11 + (nB * 0.5 + 0.5) * 0.10;
    const rz = 0.14 + Math.abs(nB) * 0.07;
    lobeGeos.push(buildNoiseFoliageLobe(cursorX, baseY + ry * 0.45, cz, rx, ry, rz, worldAnchor, 1, 0.4, nB));

    // 2. Wild upper leafy spray or spiky fountain grass tuft
    if (speciesRoll > 0.52) {
      const blades = 5;
      for (let b = 0; b < blades; b++) {
        const ang = (b / blades) * Math.PI * 2 + nA * 1.7;
        const lean = 0.28 + (b % 3) * 0.18 + Math.abs(nB) * 0.2;
        const bLen = 0.44 + speciesRoll * 0.32;
        grassGeos.push(
          stampSprayGeometry(
            ARCH_LEAF_GEO,
            cursorX + Math.cos(ang) * 0.05,
            baseY + bLen * 0.32,
            cz + Math.sin(ang) * 0.05,
            0.14,
            bLen,
            0.15,
            lean,
            ang,
            nB * 0.25,
            tintForNoise(nB, 0x3b6d28, 0x76aa46)
          )
        );
      }
    } else {
      const sc = 0.58 + speciesRoll * 0.36;
      sprayGeos.push(
        stampSprayGeometry(
          CROSSED_SPRAY_GEO,
          cursorX,
          baseY + 0.18 + Math.abs(nB) * 0.1,
          cz,
          sc * 1.2,
          sc * 1.05,
          sc,
          nB * 0.32,
          nA * Math.PI * 2,
          nA * 0.22,
          tintForNoise(nA, 0x628c4a, 0xa3c674)
        )
      );
      if (speciesRoll < 0.24) {
        blossomGeos.push(
          stampSprayGeometry(
            CROSSED_SPRAY_GEO,
            cursorX + 0.05,
            baseY + 0.26,
            cz + 0.06,
            sc * 0.64,
            sc * 0.64,
            sc * 0.64,
            0.2,
            nB * 3.1,
            0,
            new THREE.Color(0xf2f6e9)
          )
        );
      }
    }

    // 3. Asymmetric cascading ivy trails spilling over the concrete trough rim
    if (nB > -0.15 || stepIdx % 2 === 0) {
      const dropLen = 0.38 + Math.abs(nA) * 0.46;
      const hangPitch = 0.48 + nB * 0.22;
      vineGeos.push(
        stampSprayGeometry(
          ARCH_LEAF_GEO,
          cursorX + nB * 0.06,
          0.26 - dropLen * 0.22,
          0.26 + Math.abs(nA) * 0.04,
          0.36 + speciesRoll * 0.22,
          dropLen,
          0.28,
          hangPitch,
          nB * 0.55,
          nA * 0.32,
          tintForNoise(nA, 0x4b7e34, 0x8dbd5a)
        )
      );
    }

    cursorX += 0.36 + speciesRoll * 0.18;
    stepIdx++;
  }

  const swayGroup = new THREE.Group();
  if (lobeGeos.length) {
    const mergedLobes = mergeBufferGeometries(lobeGeos);
    lobeGeos.forEach((g) => g.dispose());
    createdGeos.push(mergedLobes);
    const m = new THREE.Mesh(mergedLobes, mats.volumeFoliageMat);
    m.castShadow = true;
    swayGroup.add(m);
  }
  if (sprayGeos.length) {
    const mSpray = mergeBufferGeometries(sprayGeos);
    sprayGeos.forEach((g) => g.dispose());
    createdGeos.push(mSpray);
    swayGroup.add(new THREE.Mesh(mSpray, mats.sprayMat));
  }
  if (grassGeos.length) {
    const mGrass = mergeBufferGeometries(grassGeos);
    grassGeos.forEach((g) => g.dispose());
    createdGeos.push(mGrass);
    swayGroup.add(new THREE.Mesh(mGrass, mats.grassBladeMat));
  }
  if (vineGeos.length) {
    const mVine = mergeBufferGeometries(vineGeos);
    vineGeos.forEach((g) => g.dispose());
    createdGeos.push(mVine);
    swayGroup.add(new THREE.Mesh(mVine, mats.vineMat));
  }
  if (blossomGeos.length) {
    const mBloss = mergeBufferGeometries(blossomGeos);
    blossomGeos.forEach((g) => g.dispose());
    createdGeos.push(mBloss);
    swayGroup.add(new THREE.Mesh(mBloss, mats.blossomMat));
  }

  group.add(swayGroup);
  windItems.push({
    obj: swayGroup,
    baseRotX: 0,
    baseRotY: 0,
    baseRotZ: 0,
    phase: worldAnchor.x * 0.51 + worldAnchor.y * 0.29 + worldAnchor.z * 0.47,
    freq: 1.75,
    amp: 0.015,
  });
}

/**
 * Replaces a uniform crossed-plane shrub with a multi-branched, noise-sculpted asymmetrical organic bush
 * with woody radiating stems, vertex-shaded billowing lobes, and non-repeating floral/leaf sprays.
 */
function buildOrganicShrubReplacement(
  group: THREE.Group,
  meta: GenericPlantBlockMeta,
  worldAnchor: THREE.Vector3,
  mats: ReturnType<typeof createMaterialPool>,
  createdGeos: THREE.BufferGeometry[],
  windItems: WindSwayItem[]
) {
  clearGenericPieces(group);
  const radius = meta.radius ?? 0.9;
  const height = meta.height ?? 1.0;
  const flowering = !!meta.flowering;

  const twigGeos: THREE.BufferGeometry[] = [];
  const lobeGeos: THREE.BufferGeometry[] = [];
  const sprayGeos: THREE.BufferGeometry[] = [];
  const blossomGeos: THREE.BufferGeometry[] = [];

  const nCore = warpedNoise3(worldAnchor.x * 0.9, worldAnchor.y * 0.9, worldAnchor.z * 0.9, 0.65);

  // Compact deeply shaded inner foliage core tucked beneath crisp outer leaf clusters
  lobeGeos.push(
    buildNoiseFoliageLobe(
      0,
      height * 0.38,
      0,
      radius * 0.48,
      height * 0.34,
      radius * 0.46,
      worldAnchor,
      1,
      0.44,
      nCore
    )
  );

  // Asymmetric outer radiating foliage sub-lobes + woody stems + overlapping leafy outward clusters
  const branchCount = 5 + (nCore > 0.15 ? 1 : 0);
  for (let i = 0; i < branchCount; i++) {
    const baseAngle = (i / branchCount) * Math.PI * 2;
    const nAng = fbm3(worldAnchor.x * 1.4 + i * 3.7, worldAnchor.y + i, worldAnchor.z * 1.4 + i * 2.1, 2);
    const nDist = fbm3(worldAnchor.x * 2.1 + i * 7.1, 3.3, worldAnchor.z * 2.1 + i * 5.3, 2);
    const a = baseAngle + nAng * 0.55;
    const dist = radius * (0.36 + (nDist * 0.5 + 0.5) * 0.36);
    const lx = Math.cos(a) * dist;
    const lz = Math.sin(a) * dist;
    const lobeY = height * (0.30 + (nDist * 0.5 + 0.5) * 0.28);

    twigGeos.push(buildOrganicTwigGeometry(0, 0.02, 0, lx * 0.85, lobeY * 0.72, lz * 0.85, radius * 0.04, worldAnchor));

    const lScale = 0.34 + (nAng * 0.5 + 0.5) * 0.18;
    lobeGeos.push(
      buildNoiseFoliageLobe(
        lx,
        lobeY,
        lz,
        radius * lScale,
        height * lScale * 0.68,
        radius * lScale,
        worldAnchor,
        1,
        0.44,
        nDist
      )
    );

    const sc = radius * (1.28 + (nDist * 0.5 + 0.5) * 0.54);
    sprayGeos.push(
      stampSprayGeometry(
        CROSSED_SPRAY_GEO,
        lx * 0.95,
        lobeY + height * 0.12,
        lz * 0.95,
        sc,
        height * (0.86 + Math.abs(nAng) * 0.28),
        sc,
        nDist * 0.35,
        a + nAng,
        nAng * 0.28,
        tintForNoise(nDist, 0x5c8646, 0x9ec272)
      )
    );

    if (flowering && (nAng > -0.22 || i % 2 === 0)) {
      blossomGeos.push(
        stampSprayGeometry(
          CROSSED_SPRAY_GEO,
          lx * 1.08,
          lobeY + height * 0.22,
          lz * 1.08,
          sc * 0.76,
          height * 0.64,
          sc * 0.76,
          0.26,
          a * 1.7 + nDist,
          0,
          new THREE.Color(0xf5f8ef)
        )
      );
    }
  }

  // Crown canopy spray breaking top silhouette organically
  sprayGeos.push(
    stampSprayGeometry(
      CROSSED_SPRAY_GEO,
      nCore * 0.08,
      height * 0.62,
      -nCore * 0.08,
      radius * 1.48,
      height * 0.92,
      radius * 1.48,
      0.18,
      nCore * 3.1,
      -0.14,
      tintForNoise(nCore, 0x6b9552, 0xa8cc7a)
    )
  );

  const mTwig = mergeBufferGeometries(twigGeos);
  twigGeos.forEach((g) => g.dispose());
  createdGeos.push(mTwig);
  const twigMesh = new THREE.Mesh(mTwig, mats.barkMat);
  twigMesh.castShadow = true;
  group.add(twigMesh);

  const canopyPivot = new THREE.Group();
  const mLobes = mergeBufferGeometries(lobeGeos);
  lobeGeos.forEach((g) => g.dispose());
  createdGeos.push(mLobes);
  const lobeMesh = new THREE.Mesh(mLobes, mats.volumeFoliageMat);
  lobeMesh.castShadow = true;
  lobeMesh.receiveShadow = true;
  canopyPivot.add(lobeMesh);

  const mSpray = mergeBufferGeometries(sprayGeos);
  sprayGeos.forEach((g) => g.dispose());
  createdGeos.push(mSpray);
  const sprayMesh = new THREE.Mesh(mSpray, mats.sprayMat);
  sprayMesh.castShadow = true;
  canopyPivot.add(sprayMesh);

  if (blossomGeos.length) {
    const mBloss = mergeBufferGeometries(blossomGeos);
    blossomGeos.forEach((g) => g.dispose());
    createdGeos.push(mBloss);
    canopyPivot.add(new THREE.Mesh(mBloss, mats.blossomMat));
  }

  group.add(canopyPivot);
  windItems.push({
    obj: canopyPivot,
    baseRotX: 0,
    baseRotY: 0,
    baseRotZ: 0,
    phase: worldAnchor.x * 0.37 + worldAnchor.z * 0.59,
    freq: 1.65,
    amp: 0.018,
  });
}

/**
 * Replaces the flat rectangular green moss accent wall in the Relax Lounge with
 * a dense, dark biophilic vertical moss-and-fern tapestry without grid rows or TV overlap.
 */
function buildOrganicMossWallReplacement(
  mesh: THREE.Mesh,
  meta: GenericPlantBlockMeta,
  worldAnchor: THREE.Vector3,
  mats: ReturnType<typeof createMaterialPool>,
  createdGeos: THREE.BufferGeometry[],
  M: MaterialLibrary
) {
  const parent = mesh.parent;
  if (!parent) return;

  const w = meta.w ?? 9.6;
  const h = meta.h ?? 3.6;
  const clearMinX = (meta.safeClearXMin ?? -999) - 0.35;
  const clearMaxX = (meta.safeClearXMax ?? -999) + 0.25;

  const group = new THREE.Group();
  group.position.copy(mesh.position);

  const mossPillows: THREE.BufferGeometry[] = [];
  const fernTufts: THREE.BufferGeometry[] = [];
  const wallSprays: THREE.BufferGeometry[] = [];

  // Staggered organic sampling (jittered offsets warped by continuous 3D FBM -> zero grid, fine living foliage tapestry)
  let row = 0;
  for (let gy = -h * 0.43; gy <= h * 0.43; gy += 0.54) {
    const rowShift = (row % 2) * 0.34;
    for (let gx = -w * 0.46 + rowShift; gx <= w * 0.46; gx += 0.66) {
      const n1 = warpedNoise3((worldAnchor.x + gx) * 1.45, (worldAnchor.y + gy) * 1.45, worldAnchor.z * 1.45, 0.65);
      const n2 = fbm3((worldAnchor.x + gx) * 2.3 + 7.1, (worldAnchor.y + gy) * 2.3 + 3.4, 1.9, 2);

      const jx = gx + n1 * 0.24;
      const jy = gy + n2 * 0.2;
      const wx = worldAnchor.x + jx;
      const wy = worldAnchor.y + jy;

      const inTVZone = wx >= clearMinX && wx <= clearMaxX && wy > worldAnchor.y - 1.25 && wy < worldAnchor.y + 1.05;
      const inSignZone = Math.abs(jx) < 1.75 && jy > 0.6 && jy < 1.5;
      if (inTVZone || inSignZone) continue;

      // Subtle low-relief moss pockets (no protruding round blobs)
      if (n1 > -0.25) {
        const pillowDepth = 0.022 + (n1 * 0.5 + 0.5) * 0.032;
        mossPillows.push(
          buildNoiseFoliageLobe(
            jx,
            jy,
            0.05,
            0.22 + Math.abs(n1) * 0.12,
            0.19 + Math.abs(n2) * 0.10,
            pillowDepth,
            worldAnchor,
            1,
            0.42,
            n1 - 0.42
          )
        );
      }

      // Rich layered leafy pockets & draping ferns in continuous noise drifts
      if (n1 > -0.28) {
        const spraySc = 0.52 + (n1 * 0.5 + 0.5) * 0.44;
        wallSprays.push(
          stampSprayGeometry(
            CROSSED_SPRAY_GEO,
            jx,
            jy,
            0.085,
            spraySc * 1.25,
            spraySc * 0.9,
            0.18,
            0.48 + n2 * 0.28,
            n1 * 2.8,
            n2 * 0.45,
            tintForNoise(n2, 0x356426, 0x6ea044)
          )
        );
      }

      if (n2 > -0.12) {
        const fernSc = 0.34 + (n2 * 0.5 + 0.5) * 0.28;
        const count = n1 > 0.15 ? 4 : 3;
        for (let f = 0; f < count; f++) {
          const fa = (f / count) * Math.PI * 2 + n1 * 2.5;
          fernTufts.push(
            stampSprayGeometry(
              ARCH_LEAF_GEO,
              jx + Math.cos(fa) * 0.10,
              jy + Math.sin(fa) * 0.08,
              0.095,
              fernSc * 0.55,
              fernSc * 1.05,
              fernSc * 0.42,
              0.94 + f * 0.12,
              fa * 0.45,
              fa * 0.35,
              tintForNoise(n1, 0x26541d, 0x5d903a)
            )
          );
        }
      }
    }
    row++;
  }

  // Deep forest moss textured backing panel (matches biophilic wall seamlessly behind all pockets)
  const backGeo = new THREE.BoxGeometry(w, h, 0.11);
  createdGeos.push(backGeo);
  const backMesh = new THREE.Mesh(backGeo, M.moss);
  backMesh.receiveShadow = true;
  group.add(backMesh);

  if (mossPillows.length) {
    const mPillows = mergeBufferGeometries(mossPillows);
    mossPillows.forEach((g) => g.dispose());
    createdGeos.push(mPillows);
    const pMesh = new THREE.Mesh(mPillows, mats.volumeFoliageMat);
    pMesh.receiveShadow = true;
    group.add(pMesh);
  }
  if (wallSprays.length) {
    const mWallSprays = mergeBufferGeometries(wallSprays);
    wallSprays.forEach((g) => g.dispose());
    createdGeos.push(mWallSprays);
    group.add(new THREE.Mesh(mWallSprays, mats.sprayMat));
  }
  if (fernTufts.length) {
    const mFerns = mergeBufferGeometries(fernTufts);
    fernTufts.forEach((g) => g.dispose());
    createdGeos.push(mFerns);
    group.add(new THREE.Mesh(mFerns, mats.fernMat));
  }

  parent.add(group);
  parent.remove(mesh);
}

/* =========================================================
   PUBLIC ORCHESTRATOR CALLED INSIDE AtriumEngine
   ========================================================= */

export function synthesizeProceduralFoliage(scene: THREE.Scene, M: MaterialLibrary): ProceduralFoliageResult {
  const mats = createMaterialPool(M);
  const createdGeos: THREE.BufferGeometry[] = [];
  const windItems: WindSwayItem[] = [];

  let replacedHedges = 0;
  let replacedPlanters = 0;
  let replacedShrubs = 0;
  let replacedMossWalls = 0;
  let variedPottedPlants = 0;
  let variedTrees = 0;

  scene.updateMatrixWorld(true);

  const targets: Array<{ obj: THREE.Object3D; meta: GenericPlantBlockMeta }> = [];
  const trees: THREE.Object3D[] = [];

  scene.traverse((obj) => {
    const meta = obj.userData?.genericPlantBlock as GenericPlantBlockMeta | undefined;
    if (meta) {
      targets.push({ obj, meta });
    } else if (obj.userData?.organicTree) {
      trees.push(obj);
    }
  });

  const wp = new THREE.Vector3();

  for (const { obj, meta } of targets) {
    obj.getWorldPosition(wp);
    if (meta.kind === 'hedge' && obj instanceof THREE.Group) {
      buildOrganicHedgeReplacement(obj, meta, wp.clone(), mats, createdGeos, windItems);
      replacedHedges++;
    } else if (meta.kind === 'planterTrough' && obj instanceof THREE.Group) {
      buildOrganicPlanterReplacement(obj, meta, wp.clone(), mats, createdGeos, windItems);
      replacedPlanters++;
    } else if (meta.kind === 'shrub' && obj instanceof THREE.Group) {
      buildOrganicShrubReplacement(obj, meta, wp.clone(), mats, createdGeos, windItems);
      replacedShrubs++;
    } else if (meta.kind === 'mossWall' && obj instanceof THREE.Mesh) {
      buildOrganicMossWallReplacement(obj, meta, wp.clone(), mats, createdGeos, M);
      replacedMossWalls++;
    } else if (meta.kind === 'pottedPlant' && obj instanceof THREE.Group) {
      // Infuse non-repeating world-space organic asymmetry across potted office plants
      const nYaw = fbm3(wp.x * 1.3, wp.y * 0.7, wp.z * 1.3, 3);
      const nLeanX = fbm3(wp.x * 2.1 + 9.2, wp.y, wp.z * 2.1 + 4.7, 2);
      const nLeanZ = fbm3(wp.x * 2.1 + 17.5, wp.y, wp.z * 2.1 + 11.3, 2);
      obj.rotation.y += nYaw * Math.PI;
      let childIdx = 0;
      for (const ch of obj.children) {
        // Leave base pot/soil/pebble intact; vary stem/leaf sub-groups organically
        if (ch instanceof THREE.Group) {
          const nLeaf = warpedNoise3(wp.x * 2.7 + childIdx * 1.9, wp.y, wp.z * 2.7 + childIdx * 2.3, 0.5);
          ch.rotation.x += nLeaf * 0.14 + nLeanX * 0.05;
          ch.rotation.z += nLeanZ * 0.08;
          ch.scale.multiplyScalar(0.92 + (nLeaf * 0.5 + 0.5) * 0.22);
          childIdx++;
        }
      }
      variedPottedPlants++;
    }
  }

  // Enrich street trees & canopy clusters with continuous world-space noise asymmetry & gentle breeze anchors
  for (const tObj of trees) {
    tObj.getWorldPosition(wp);
    const nYaw = fbm3(wp.x * 0.45, 1.2, wp.z * 0.45, 3);
    tObj.rotation.y += nYaw * 0.65;
    let idx = 0;
    for (const ch of tObj.children) {
      if (ch instanceof THREE.Mesh && ch.geometry === CROSSED_SPRAY_GEO) {
        const nCluster = warpedNoise3(
          (wp.x + ch.position.x) * 0.85,
          (wp.y + ch.position.y) * 0.85,
          (wp.z + ch.position.z) * 0.85,
          0.55
        );
        const sMod = 0.88 + (nCluster * 0.5 + 0.5) * 0.34;
        ch.scale.multiply(new THREE.Vector3(sMod, 0.86 + Math.abs(nCluster) * 0.32, sMod));
        ch.rotation.x += nCluster * 0.24;
        ch.rotation.z += fbm3(wp.x + idx, wp.y, wp.z + idx, 2) * 0.22;

        // Register upper outer canopy clusters for subtle wind sway
        if (idx % 3 === 0) {
          windItems.push({
            obj: ch,
            baseRotX: ch.rotation.x,
            baseRotY: ch.rotation.y,
            baseRotZ: ch.rotation.z,
            phase: (wp.x + ch.position.x) * 0.31 + (wp.z + ch.position.z) * 0.47,
            freq: 1.2 + (idx % 5) * 0.14,
            amp: 0.022,
          });
        }
        idx++;
      }
    }
    variedTrees++;
  }

  return {
    replacedHedges,
    replacedPlanters,
    replacedShrubs,
    replacedMossWalls,
    variedPottedPlants,
    variedTrees,
    windItems,
    geometries: createdGeos,
    materials: mats.allMaterials,
  };
}
