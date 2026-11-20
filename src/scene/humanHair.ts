import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BeardStyle, HairStyleName } from './human';
import { loftRings, normalizeForMerge, smoothstep, type DetailLevel, type LoftRingPoint } from './humanAnatomy';

export interface BuiltHairParts {
  /** Opaque sculpted scalp / braids / twists / sculpted crown geometry */
  coreGeo: THREE.BufferGeometry;
  /** Feathered alpha-cutout hair cards (strand ribbons or coily halo cards) */
  cardGeo?: THREE.BufferGeometry;
  /** Optional headband / satin wrap accent (e.g. high puff band) */
  bandGeo?: THREE.BufferGeometry;
  /** True if style uses coily afro texture maps vs smooth strand maps */
  isCoily: boolean;
}

/**
 * Fits a scalp root skull cap cleanly over our unified head geometry in world character coords
 * (faceCenterY = 1.651).
 */
function buildFittedScalpBase(
  fem: boolean,
  mode: 'tight' | 'parted' | 'fade' | 'crop',
  detail: DetailLevel
): THREE.BufferGeometry {
  const segs = detail === 'studio' ? 32 : 22;
  const rows = detail === 'studio' ? 20 : 14;
  const rx = (fem ? 0.0745 : 0.079) * 1.01;
  const ry = (fem ? 0.106 : 0.110) * 1.01;
  const rz = (fem ? 0.092 : 0.096) * 1.01;
  const cy = 1.651;

  const rings: LoftRingPoint[][] = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows; // 0 = hairline base, 1 = top crown pole
    const ring: LoftRingPoint[] = [];

    for (let s = 0; s < segs; s++) {
      const phi = (s / segs) * Math.PI * 2;
      const sinP = Math.sin(phi); // +X side
      const cosP = Math.cos(phi); // +Z front

      // Asymmetric realistic hairline latitude: higher on forehead, lower on nape & sideburns
      const frontWeight = Math.max(0, cosP);
      const backWeight = Math.max(0, -cosP);
      const sideWeight = Math.abs(sinP);
      let baseLat =
        mode === 'fade'
          ? 0.42 * frontWeight - 0.16 * backWeight + 0.14 * sideWeight
          : mode === 'parted'
          ? 0.44 * frontWeight - 0.34 * backWeight - 0.02 * sideWeight
          : 0.43 * frontWeight - 0.3 * backWeight + 0.04 * sideWeight;

      const lat = THREE.MathUtils.lerp(baseLat, Math.PI * 0.495, t);
      const cosL = Math.max(0.002, Math.cos(lat));
      const sinL = Math.sin(lat);

      const ux = sinP * cosL;
      const uy = sinL;
      const uz = cosP * cosL;

      // Subtle hairline taper so edge hugs skin seamlessly, swelling out smoothly over crown
      const edgeBlend = THREE.MathUtils.clamp(t / 0.18, 0, 1);
      const lift =
        mode === 'fade'
          ? edgeBlend * 0.0045
          : mode === 'crop'
          ? edgeBlend * 0.0075
          : edgeBlend * 0.0065;

      // Subtle parting groove for parted/sleek styles
      const partGroove =
        mode === 'parted' && cosP > 0.15 && t > 0.15
          ? -Math.exp(-Math.pow((ux - 0.22) / 0.045, 2)) * 0.0032
          : 0;

      // Parietal flare matching buildUnifiedHeadNeckGeo
      const xFlare = uy > 0 ? 1 + uy * 0.055 * (1 - Math.abs(uy) * 0.35) : 1;
      const zShift = uy > 0 ? -uy * 0.003 : 0;

      ring.push({
        x: ux * rx * xFlare + ux * lift,
        y: uy * ry + cy + uy * (lift + partGroove),
        z: uz * rz + zShift + uz * lift,
      });
    }
    rings.push(ring);
  }
  return loftRings(rings, false, true, [0, 1], 2);
}

/**
 * Generates an organic curved ribbon strip geometry along a 3D spline with variable width & natural twist.
 */
function buildCurvedHairRibbon(
  points: THREE.Vector3[],
  widthBase: number,
  widthTip: number,
  steps = 10,
  normalTilt = 0
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const upRef = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const center = new THREE.Vector3(0, 1.655, 0);
  const radial = new THREE.Vector3();

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPoint(t);
    curve.getTangent(t, tan);
    radial.subVectors(p, center).normalize();
    side.crossVectors(tan, radial).normalize();
    if (side.lengthSq() < 0.01) side.crossVectors(tan, upRef).normalize();

    if (normalTilt !== 0) {
      side.applyAxisAngle(tan, normalTilt);
    }
    const w = THREE.MathUtils.lerp(widthBase, widthTip, t) * 0.5;
    // Slight parabolic curl across ribbon width so cards never look paper-flat
    const midLift = radial.clone().multiplyScalar(w * 0.24);

    const pL = p.clone().addScaledVector(side, -w);
    const pM = p.clone().add(midLift);
    const pR = p.clone().addScaledVector(side, w);

    positions.push(pL.x, pL.y, pL.z, pM.x, pM.y, pM.z, pR.x, pR.y, pR.z);
    uvs.push(0, t, 0.5, t, 1, t);
  }

  for (let i = 0; i < steps; i++) {
    const row0 = i * 3;
    const row1 = (i + 1) * 3;
    indices.push(row0, row1, row0 + 1, row0 + 1, row1, row1 + 1);
    indices.push(row0 + 1, row1 + 1, row0 + 2, row0 + 2, row1 + 1, row1 + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates curved intersecting alpha-card tufts for coily afro / puff volume (zero sphere balls).
 */
function buildCoilyHaloCard(width: number, height: number, bend = 0.012): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, 3, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r2 = (x / (width * 0.5)) ** 2 + (y / (height * 0.5)) ** 2;
    pos.setZ(i, -r2 * bend);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds braided or two-strand twisted spline lock with organic rope helical undulation.
 */
function buildBraidedLockGeo(
  points: THREE.Vector3[],
  baseR: number,
  tipR: number,
  radialSegs: number,
  lenSegs: number,
  twistFreq: number
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(lenSegs, false);
  const rings: LoftRingPoint[][] = [];

  for (let i = 0; i <= lenSegs; i++) {
    const t = i / lenSegs;
    const p = curve.getPoint(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const rad = THREE.MathUtils.lerp(baseR, tipR, Math.pow(t, 1.35)) * (t > 0.94 ? 0.55 : 1);
    const ring: LoftRingPoint[] = [];

    for (let s = 0; s < radialSegs; s++) {
      const a = (s / radialSegs) * Math.PI * 2;
      // 2-strand or 3-strand helical rope cross-section modulation
      const rope = 1 + 0.16 * Math.cos(a * 2 + t * twistFreq);
      const r = rad * rope;
      const ca = Math.cos(a) * r;
      const sa = Math.sin(a) * r;
      ring.push({
        x: p.x + N.x * ca + B.x * sa,
        y: p.y + N.y * ca + B.y * sa,
        z: p.z + N.z * ca + B.z * sa,
      });
    }
    rings.push(ring);
  }

  return loftRings(rings, true, true, [0, 1], 1);
}

/**
 * Generates any of the 8 realistic studio/office hairstyles in character world coordinates.
 */
export function buildSculptedHairStyle(
  style: HairStyleName,
  fem: boolean,
  detail: DetailLevel = 'office'
): BuiltHairParts {
  const hi = detail === 'studio';

  if (style === 'fade') {
    // Crisp architectural barber fade: smooth scalp taper + sculpted directional wave/coil crown loft (never a flat cylinder!)
    const coreParts: THREE.BufferGeometry[] = [normalizeForMerge(buildFittedScalpBase(fem, 'fade', detail))];
    const segs = hi ? 32 : 22;
    const rows = hi ? 12 : 8;
    const crownRings: LoftRingPoint[][] = [];

    for (let r = 0; r <= rows; r++) {
      const t = r / rows; // 0 = fade edge around temple/upper nape, 1 = top crown
      const lat = THREE.MathUtils.lerp(0.46, Math.PI * 0.495, t);
      const cosL = Math.max(0.003, Math.cos(lat));
      const sinL = Math.sin(lat);
      const thickness = smoothstep(0.0, 0.35, t) * (0.015 + Math.sin(t * Math.PI * 0.8) * 0.008);
      const ring: LoftRingPoint[] = [];

      for (let s = 0; s < segs; s++) {
        const phi = (s / segs) * Math.PI * 2;
        const ux = Math.sin(phi) * cosL;
        const uz = Math.cos(phi) * cosL;
        const wave = Math.sin(ux * 110 + uz * 95) * Math.cos(t * 22) * 0.0022 * smoothstep(0.1, 0.5, t);
        const rx = 0.079 * (1 + sinL * 0.055) + thickness + wave;
        const ry = 0.110 + thickness * 1.15;
        const rz = 0.096 + thickness + wave;
        ring.push({
          x: ux * rx,
          y: sinL * ry + 1.651,
          z: uz * rz - sinL * 0.003,
        });
      }
      crownRings.push(ring);
    }
    coreParts.push(normalizeForMerge(loftRings(crownRings, false, true)));
    const coreGeo = mergeGeometries(coreParts, false);
    coreParts.forEach((p) => p.dispose());
    coreGeo.computeVertexNormals();
    return { coreGeo, isCoily: true };
  }

  if (style === 'afro') {
    // Dense organic crown core + radial intersecting coily alpha halo cards breaking the entire silhouette
    const coreParts: THREE.BufferGeometry[] = [normalizeForMerge(buildFittedScalpBase(fem, 'crop', detail))];
    // Sculpted organic pillowed afro core with organic frequency ripple
    const coreGeoRaw = new THREE.SphereGeometry(1, hi ? 26 : 18, hi ? 20 : 14);
    const cPos = coreGeoRaw.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const ux = cPos.getX(i);
      const uy = cPos.getY(i);
      const uz = cPos.getZ(i);
      const n = Math.sin(ux * 14 + uz * 11) * Math.cos(uy * 13) * 0.007;
      // Cut out lower front face opening cleanly around forehead & cheekbones
      const cutFace = uz > 0.35 && uy < 0.32 ? smoothstep(0.35, 0.65, uz) * smoothstep(0.32, -0.2, uy) : 0;
      const radScale = (0.112 + n) * (1 - cutFace * 0.42);
      cPos.setXYZ(i, ux * radScale * 0.98, uy * radScale * 0.94 + 1.688, uz * radScale * 1.02 - 0.015);
    }
    coreGeoRaw.computeVertexNormals();
    coreParts.push(normalizeForMerge(coreGeoRaw));
    const coreGeo = mergeGeometries(coreParts, false);
    coreParts.forEach((p) => p.dispose());

    // Radial layered coily halo cards around perimeter silhouette
    const cards: THREE.BufferGeometry[] = [];
    const cardCount = hi ? 56 : 32;
    for (let i = 0; i < cardCount; i++) {
      const k = (i + 0.5) / cardCount;
      const phi = Math.acos(1 - 1.42 * k); // upper hemisphere + back nape
      const theta = i * 2.399963;
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      ).normalize();
      // Skip cards blocking the front face
      if (dir.z > 0.48 && dir.y < 0.42) continue;

      const c = buildCoilyHaloCard(0.068 + (i % 3) * 0.01, 0.068 + (i % 2) * 0.01, 0.014);
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      // Randomize in-plane spin & slightly tangentially tilt to break regular grid
      const tangentQuat = new THREE.Quaternion().setFromAxisAngle(dir, i * 1.37);
      const tiltAxis = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      if (tiltAxis.lengthSq() > 0.01) {
        c.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(tiltAxis, 0.45));
      }
      c.applyQuaternion(tangentQuat);
      c.applyQuaternion(quat);
      c.translate(dir.x * 0.112, dir.y * 0.106 + 1.688, dir.z * 0.114 - 0.015);
      cards.push(normalizeForMerge(c));
    }
    const cardGeo = mergeGeometries(cards, false);
    cards.forEach((p) => p.dispose());
    cardGeo.computeVertexNormals();
    return { coreGeo, cardGeo, isCoily: true };
  }

  if (style === 'puff') {
    const coreParts: THREE.BufferGeometry[] = [normalizeForMerge(buildFittedScalpBase(fem, 'tight', detail))];
    // Subtle brushed inner core for top puff
    const puffCore = new THREE.SphereGeometry(0.068, hi ? 20 : 14, hi ? 16 : 12);
    const pPos = puffCore.attributes.position;
    for (let i = 0; i < pPos.count; i++) {
      const ux = pPos.getX(i);
      const uy = pPos.getY(i);
      const uz = pPos.getZ(i);
      const n = Math.sin(ux * 65 + uy * 75) * 0.004;
      pPos.setXYZ(i, ux * 1.06 + n, uy * 0.92 + 1.775, uz * 1.02 - 0.042 + n);
    }
    puffCore.computeVertexNormals();
    coreParts.push(normalizeForMerge(puffCore));
    const coreGeo = mergeGeometries(coreParts, false);
    coreParts.forEach((p) => p.dispose());

    // Satin hair band at puff base
    const bandGeo = new THREE.TorusGeometry(0.044, 0.0065, 8, hi ? 24 : 16);
    bandGeo.rotateX(Math.PI / 2 - 0.46);
    bandGeo.translate(0, 1.734, -0.028);

    // Coily halo puff cards
    const cards: THREE.BufferGeometry[] = [];
    const cardCount = hi ? 38 : 22;
    for (let i = 0; i < cardCount; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / cardCount);
      const theta = i * 2.399963;
      const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).normalize();
      const c = buildCoilyHaloCard(0.056, 0.056, 0.01);
      c.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), i * 1.1));
      c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
      c.translate(dir.x * 0.068, dir.y * 0.062 + 1.775, dir.z * 0.066 - 0.042);
      cards.push(normalizeForMerge(c));
    }
    const cardGeo = mergeGeometries(cards, false);
    cards.forEach((p) => p.dispose());
    cardGeo.computeVertexNormals();

    return { coreGeo, cardGeo, bandGeo, isCoily: true };
  }

  if (style === 'twists') {
    const coreParts: THREE.BufferGeometry[] = [normalizeForMerge(buildFittedScalpBase(fem, 'fade', detail))];
    const count = hi ? 42 : 26;
    const radSegs = hi ? 6 : 5;
    const lenSegs = hi ? 7 : 5;

    for (let i = 0; i < count; i++) {
      const k = (i + 0.5) / count;
      const phi = Math.acos(1 - 0.88 * k); // upper crown hemisphere
      const theta = i * 2.399963;
      const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).normalize();
      if (dir.z > 0.65 && dir.y < 0.35) continue;

      const root = new THREE.Vector3(dir.x * 0.068, dir.y * 0.092 + 1.662, dir.z * 0.082 - 0.004);
      const len = 0.042 + (i % 4) * 0.007;
      const mid = root.clone().addScaledVector(dir, len * 0.52);
      mid.x += Math.sin(theta * 3) * 0.005;
      mid.y += 0.004;
      const tip = root.clone().addScaledVector(dir, len);
      tip.y -= 0.008 * Math.sin(phi); // gentle gravity droop on outer twists

      const lock = buildBraidedLockGeo([root, mid, tip], 0.0072, 0.0045, radSegs, lenSegs, 14);
      coreParts.push(normalizeForMerge(lock));
    }
    const coreGeo = mergeGeometries(coreParts, false);
    coreParts.forEach((p) => p.dispose());
    coreGeo.computeVertexNormals();
    return { coreGeo, isCoily: true };
  }

  if (style === 'braids') {
    const coreParts: THREE.BufferGeometry[] = [normalizeForMerge(buildFittedScalpBase(fem, 'parted', detail))];
    const numBraids = hi ? 28 : 18;
    const radSegs = hi ? 6 : 5;
    const lenSegs = hi ? 14 : 10;

    for (let b = 0; b < numBraids; b++) {
      const k = b / (numBraids - 1);
      // Sweep around back + sides from behind right temple (-0.68PI) to behind left temple (+0.68PI)
      const azim = THREE.MathUtils.lerp(-Math.PI * 0.72, Math.PI * 0.72, k); // 0 = back (-Z), ±PI/2 = sides
      const layer = b % 2;
      const sinA = Math.sin(azim);
      const cosA = -Math.cos(azim); // -Z at azim=0

      const rootR = layer === 0 ? 0.064 : 0.044;
      const rootY = layer === 0 ? 1.715 : 1.745;
      const lengthDrop = 0.24 + (b % 3) * 0.025;

      const p0 = new THREE.Vector3(sinA * rootR * 0.65, rootY, cosA * rootR - 0.01);
      const p1 = new THREE.Vector3(sinA * 0.082, 1.675, cosA * 0.098 - 0.008);
      const p2 = new THREE.Vector3(sinA * 0.094, 1.575, cosA * 0.092 - 0.015);
      const p3 = new THREE.Vector3(
        sinA * (0.098 + Math.abs(sinA) * 0.03),
        1.715 - lengthDrop,
        cosA * 0.088 - (Math.abs(sinA) > 0.6 ? -0.022 : 0.018)
      );

      const lock = buildBraidedLockGeo([p0, p1, p2, p3], 0.0078, 0.0048, radSegs, lenSegs, 28);
      coreParts.push(normalizeForMerge(lock));
    }

    const coreGeo = mergeGeometries(coreParts, false);
    coreParts.forEach((p) => p.dispose());
    coreGeo.computeVertexNormals();
    return { coreGeo, isCoily: false };
  }

  if (style === 'bun') {
    const coreParts: THREE.BufferGeometry[] = [normalizeForMerge(buildFittedScalpBase(fem, 'parted', detail))];
    // Sculpted coiled chignon bun at upper nape / crown back wrapped in braided strands
    const bunCenter = new THREE.Vector3(0, 1.682, -0.104);
    const bunRings: LoftRingPoint[][] = [];
    const bSegs = hi ? 22 : 14;
    const bRows = hi ? 12 : 8;
    for (let r = 0; r <= bRows; r++) {
      const v = r / bRows;
      const lat = THREE.MathUtils.lerp(-Math.PI * 0.45, Math.PI * 0.45, v);
      const rad = Math.cos(lat) * 0.038;
      const yOff = Math.sin(lat) * 0.032;
      const ring: LoftRingPoint[] = [];
      for (let s = 0; s < bSegs; s++) {
        const a = (s / bSegs) * Math.PI * 2;
        const twistMod = 1 + 0.08 * Math.sin(a * 4 + v * 10);
        ring.push({
          x: bunCenter.x + Math.cos(a) * rad * twistMod,
          y: bunCenter.y + yOff * 0.85 - Math.sin(a) * rad * 0.25,
          z: bunCenter.z + Math.sin(a) * rad * 0.68 * twistMod,
        });
      }
      bunRings.push(ring);
    }
    coreParts.push(normalizeForMerge(loftRings(bunRings, true, true)));

    // Two wrapped braid coils framing the chignon
    for (const sign of [-1, 1]) {
      const coil = buildBraidedLockGeo(
        [
          new THREE.Vector3(0, 1.716, -0.095),
          new THREE.Vector3(sign * 0.036, 1.69, -0.105),
          new THREE.Vector3(sign * 0.025, 1.652, -0.112),
          new THREE.Vector3(0, 1.65, -0.102),
        ],
        0.008,
        0.007,
        6,
        10,
        18
      );
      coreParts.push(normalizeForMerge(coil));
    }

    const coreGeo = mergeGeometries(coreParts, false);
    coreParts.forEach((p) => p.dispose());
    coreGeo.computeVertexNormals();
    return { coreGeo, isCoily: false };
  }

  if (style === 'bob') {
    const coreParts: THREE.BufferGeometry[] = [normalizeForMerge(buildFittedScalpBase(fem, 'parted', detail))];
    const coreGeo = mergeGeometries(coreParts, false);
    coreParts.forEach((p) => p.dispose());

    // Sleek layered chin-length curved hair strand ribbons draped from crown part
    const cards: THREE.BufferGeometry[] = [];
    const strandCount = hi ? 36 : 22;
    for (let i = 0; i < strandCount; i++) {
      const k = i / (strandCount - 1);
      const azim = THREE.MathUtils.lerp(-Math.PI * 0.78, Math.PI * 0.78, k); // leave open over front face
      const sinA = Math.sin(azim);
      const cosA = -Math.cos(azim);
      const layer = i % 2;
      const topR = 0.056 - layer * 0.012;
      const midR = 0.088 + layer * 0.006;
      const tipR = 0.082 + layer * 0.004; // subtle natural inward bob curl at chin!

      const p0 = new THREE.Vector3(sinA * topR * 0.8, 1.738 + layer * 0.008, cosA * topR - 0.006);
      const p1 = new THREE.Vector3(sinA * midR * 0.96, 1.655, cosA * midR - 0.005);
      const p2 = new THREE.Vector3(sinA * tipR * 0.96, 1.565 - (layer === 0 ? 0.015 : 0), cosA * tipR - 0.006);

      const rib = buildCurvedHairRibbon([p0, p1, p2], 0.028, 0.024, hi ? 10 : 7);
      cards.push(normalizeForMerge(rib));
    }
    // Soft side-swept curtain fringe framing forehead
    for (const sign of [-1, 1]) {
      const bang = buildCurvedHairRibbon(
        [
          new THREE.Vector3(0.016, 1.742, 0.048),
          new THREE.Vector3(sign * 0.045, 1.712, 0.078),
          new THREE.Vector3(sign * 0.072, 1.652, 0.056),
        ],
        0.024,
        0.014,
        8
      );
      cards.push(normalizeForMerge(bang));
    }

    const cardGeo = mergeGeometries(cards, false);
    cards.forEach((p) => p.dispose());
    cardGeo.computeVertexNormals();
    return { coreGeo, cardGeo, isCoily: false };
  }

  // 'pixie': Tapered sleek crop + textured layered asymmetrical crown & feathered fringe cards
  const coreParts: THREE.BufferGeometry[] = [normalizeForMerge(buildFittedScalpBase(fem, 'crop', detail))];
  const coreGeo = mergeGeometries(coreParts, false);
  coreParts.forEach((p) => p.dispose());

  const cards: THREE.BufferGeometry[] = [];
  const crownRibs = hi ? 24 : 14;
  for (let i = 0; i < crownRibs; i++) {
    const k = i / (crownRibs - 1);
    const xOff = THREE.MathUtils.lerp(-0.058, 0.058, k);
    const zBack = -0.05 + (i % 3) * 0.028;
    const p0 = new THREE.Vector3(xOff * 0.65, 1.758, zBack);
    const p1 = new THREE.Vector3(xOff * 0.9 + 0.012, 1.745, zBack + 0.042);
    const p2 = new THREE.Vector3(xOff * 0.95 + 0.02, 1.702, zBack + 0.075);
    cards.push(normalizeForMerge(buildCurvedHairRibbon([p0, p1, p2], 0.024, 0.014, 7)));
  }
  const cardGeo = mergeGeometries(cards, false);
  cards.forEach((p) => p.dispose());
  cardGeo.computeVertexNormals();
  return { coreGeo, cardGeo, isCoily: false };
}

/**
 * Builds a fitted 3D jawline/chin/mustache beard shell for characters with beardStyle === 'full'.
 */
export function buildSculptedBeardGeo(beardStyle: BeardStyle, detail: DetailLevel = 'office'): THREE.BufferGeometry | null {
  if (beardStyle !== 'full') return null;

  const segs = detail === 'studio' ? 22 : 14;
  const rows = detail === 'studio' ? 10 : 7;
  const rings: LoftRingPoint[][] = [];

  for (let r = 0; r <= rows; r++) {
    const t = r / rows; // 0 = underchin/neck edge (y=1.552), 1 = upper cheek/mustache line (y=1.608)
    const y = THREE.MathUtils.lerp(1.552, 1.608, t);
    const ring: LoftRingPoint[] = [];

    for (let s = 0; s < segs; s++) {
      // Sweep strictly across front jaw arc (-100 deg to +100 deg)
      const k = s / (segs - 1);
      const phi = THREE.MathUtils.lerp(-Math.PI * 0.54, Math.PI * 0.54, k);
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      const x = sinP * THREE.MathUtils.lerp(0.048, 0.068, Math.pow(t, 0.7));
      let z = cosP * THREE.MathUtils.lerp(0.068, 0.081, t) + 0.008;

      // Sculpted lower chin beard thickness + carved opening around mouth lips
      const mouthOpen =
        Math.exp(-Math.pow(x / 0.022, 2)) * Math.exp(-Math.pow((y - 1.599) / 0.009, 2));
      const thickness = (0.0045 + Math.sin(t * Math.PI) * 0.003) * (1 - mouthOpen);
      z += cosP * thickness;
      ring.push({ x, y, z });
    }
    // Open half-ring strip -> turn into ribbon strip via open quad grid
    rings.push(ring);
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rows; r++) {
    for (let s = 0; s < segs; s++) {
      const p = rings[r][s];
      positions.push(p.x, p.y, p.z);
      uvs.push(s / (segs - 1), r / rows);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let s = 0; s < segs - 1; s++) {
      const a = r * segs + s;
      const b = a + 1;
      const c = (r + 1) * segs + s;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
