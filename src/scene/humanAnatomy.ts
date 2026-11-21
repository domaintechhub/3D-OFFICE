import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ShoeStyle } from './human';

export type DetailLevel = 'office' | 'studio';

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Normalizes any BufferGeometry to clean non-indexed (position, normal, uv) attributes
 * so mergeGeometries never fails on mismatched attributes.
 */
export function normalizeForMerge(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const count = g.attributes.position.count;
    const uvs = new Float32Array(count * 2).fill(0.5);
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') {
      g.deleteAttribute(k);
    }
  }
  return g;
}

export interface LoftRingPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Lofts a closed organic mesh through an ordered stack of cross-sectional vertex rings.
 * Each ring must have identical radial count. Caps bottom/top optionally and computes smooth normals.
 */
export function loftRings(
  rings: LoftRingPoint[][],
  capBottom = false,
  capTop = false,
  uvVRange: [number, number] = [0, 1],
  uvUScale = 1
): THREE.BufferGeometry {
  const numRings = rings.length;
  const segs = rings[0].length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < numRings; r++) {
    const vNorm = numRings > 1 ? r / (numRings - 1) : 0;
    const v = THREE.MathUtils.lerp(uvVRange[0], uvVRange[1], vNorm);
    const ring = rings[r];
    for (let s = 0; s <= segs; s++) {
      const pt = ring[s % segs];
      positions.push(pt.x, pt.y, pt.z);
      uvs.push((s / segs) * uvUScale, v);
    }
  }

  // Detect whether (r -> r+1) x (s -> s+1) points outward or inward relative to each ring's centroid
  let outwardDotSum = 0;
  for (let r = 0; r < numRings - 1; r++) {
    const ring = rings[r];
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let s = 0; s < segs; s++) {
      cx += ring[s].x;
      cy += ring[s].y;
      cz += ring[s].z;
    }
    cx /= segs;
    cy /= segs;
    cz /= segs;
    for (let s = 0; s < segs; s++) {
      const a = ring[s];
      const b = ring[(s + 1) % segs];
      const c = rings[r + 1][s];
      const e1x = c.x - a.x;
      const e1y = c.y - a.y;
      const e1z = c.z - a.z;
      const e2x = b.x - a.x;
      const e2y = b.y - a.y;
      const e2z = b.z - a.z;
      // Normal of (a, c, b)
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      const mx = (a.x + b.x + c.x) / 3 - cx;
      const my = (a.y + b.y + c.y) / 3 - cy;
      const mz = (a.z + b.z + c.z) / 3 - cz;
      outwardDotSum += nx * mx + ny * my + nz * mz;
    }
  }
  const invertSide = outwardDotSum < 0;

  const stride = segs + 1;
  for (let r = 0; r < numRings - 1; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * stride + s;
      const b = a + 1;
      const c = (r + 1) * stride + s;
      const d = c + 1;
      if (invertSide) {
        indices.push(a, b, c);
        indices.push(b, d, c);
      } else {
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
  }

  const addCap = (ringIdx: number, flip: boolean) => {
    const ring = rings[ringIdx];
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const p of ring) {
      cx += p.x;
      cy += p.y;
      cz += p.z;
    }
    cx /= segs;
    cy /= segs;
    cz /= segs;
    const centerIdx = positions.length / 3;
    positions.push(cx, cy, cz);
    uvs.push(0.5, ringIdx === 0 ? uvVRange[0] : uvVRange[1]);

    const baseStart = positions.length / 3;
    for (let s = 0; s <= segs; s++) {
      const p = ring[s % segs];
      positions.push(p.x, p.y, p.z);
      uvs.push(0.5 + (p.x - cx) * 2, 0.5 + (p.z - cz) * 2);
    }
    for (let s = 0; s < segs; s++) {
      if (flip) {
        indices.push(centerIdx, baseStart + s + 1, baseStart + s);
      } else {
        indices.push(centerIdx, baseStart + s, baseStart + s + 1);
      }
    }
  };

  if (capBottom) addCap(0, invertSide);
  if (capTop) addCap(numRings - 1, !invertSide);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // Weld radial seam normals (column 0 and column segs) for smooth shading without a visible vertical crease
  const nAttr = geo.attributes.normal;
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  for (let r = 0; r < numRings; r++) {
    const i0 = r * stride;
    const i1 = r * stride + segs;
    vA.fromBufferAttribute(nAttr, i0);
    vB.fromBufferAttribute(nAttr, i1);
    vA.add(vB).normalize();
    nAttr.setXYZ(i0, vA.x, vA.y, vA.z);
    nAttr.setXYZ(i1, vA.x, vA.y, vA.z);
  }
  nAttr.needsUpdate = true;

  return geo;
}

/* =========================================================
   UNIFIED SCULPTED HEAD + NECK + 3D EYES + EARS
   ========================================================= */

/**
 * Builds a continuous sculpted neck + cranium + anatomical face in character-world coordinates
 * (neck base at y=1.445, jaw ~1.555, lips ~1.60, nose tip ~1.628, eyes ~1.657, crown ~1.758).
 * Maps face UVs accurately onto getPhotorealFaceTexture() (eyes py=0.482 -> v=0.518, lips py=0.659 -> v=0.341).
 */
export function buildUnifiedHeadNeckGeo(
  fem: boolean,
  variant = 0,
  detail: DetailLevel = 'office'
): THREE.BufferGeometry {
  const segs = detail === 'studio' ? 56 : 40;
  const headRows = detail === 'studio' ? 44 : 32;
  const neckRows = detail === 'studio' ? 16 : 12;

  const jawMod = [1.0, 0.95, 1.05, 0.98][variant % 4];
  const cheekMod = [1.0, 1.1, 0.93, 1.05][(variant >> 1) % 4];
  const noseMod = [1.0, 1.06, 0.94, 1.02][(variant >> 2) % 4];

  const rxHead = (fem ? 0.0725 : 0.0775) * (0.985 + (variant % 3) * 0.015);
  const ryHead = (fem ? 0.105 : 0.1085) * (0.99 + ((variant + 1) % 3) * 0.012);
  const rzHead = fem ? 0.094 : 0.0975;
  const faceCenterY = 1.651;

  // 1. Continuous anatomical neck rising from upper clavicle/chest (y=1.445) cleanly up INSIDE skull base (y=1.592)
  const neckRings: LoftRingPoint[][] = [];
  for (let r = 0; r <= neckRows; r++) {
    const nk = r / neckRows;
    const y = THREE.MathUtils.lerp(1.445, 1.592, nk);
    // Natural trapezius/clavicle flare at base (nk < 0.35), slender mid-neck, tapering subtly inside skull base
    const clavicleFlare = Math.pow(Math.max(0, 1 - nk * 2.1), 1.6) * (fem ? 0.022 : 0.024);
    const skullTuck = nk > 0.78 ? smoothstep(0.78, 1.0, nk) * 0.005 : 0;
    const neckRx = (fem ? 0.0415 : 0.048) + clavicleFlare - skullTuck;
    const neckRz = (fem ? 0.043 : 0.049) + clavicleFlare * 0.85 - skullTuck;
    // Natural gentle forward cervical posture curve
    const neckShiftZ = THREE.MathUtils.lerp(-0.017, -0.008, nk) + Math.sin(nk * Math.PI) * 0.004;

    const ring: LoftRingPoint[] = [];
    for (let s = 0; s < segs; s++) {
      const phi = (s / segs) * Math.PI * 2;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);
      let x = sinP * neckRx;
      let z = cosP * neckRz + neckShiftZ;

      // Subtle sternocleidomastoid tendons & male laryngeal prominence
      if (cosP > 0.1) {
        const scm = Math.exp(-Math.pow((Math.abs(sinP) - (0.52 - nk * 0.14)) / 0.22, 2));
        z += scm * 0.002 * (1 - nk * 0.4);
        if (!fem && cosP > 0.72) {
          const adamsApple = Math.exp(-Math.pow((nk - 0.52) / 0.16, 2)) * Math.pow(cosP, 4);
          z += adamsApple * 0.003;
        }
      }
      // Trapezius slope at back-sides near base
      if (nk < 0.4 && cosP < 0.15) {
        const trap = (1 - nk / 0.4) * Math.abs(sinP) * 0.018;
        x += Math.sign(sinP) * trap;
      }
      ring.push({ x, y, z });
    }
    neckRings.push(ring);
  }
  const neckGeo = loftRings(neckRings, true, true, [0, 1], 1);
  const nPos = neckGeo.attributes.position;
  const nUv = neckGeo.attributes.uv;
  for (let i = 0; i < nPos.count; i++) {
    const ang = Math.atan2(nPos.getX(i), nPos.getZ(i));
    const u = 0.5 + ang / (Math.PI * 2);
    const v = THREE.MathUtils.lerp(0.04, 0.22, THREE.MathUtils.clamp((nPos.getY(i) - 1.445) / 0.14, 0, 1));
    nUv.setXY(i, u, v);
  }
  nUv.needsUpdate = true;

  // 2. Unified Cranium & Sculpted Face (lat from -PI*0.44 submental jaw/chin underside up to +PI*0.498 crown)
  const headRings: LoftRingPoint[][] = [];
  for (let r = 0; r <= headRows; r++) {
    const hk = r / headRows;
    const lat = THREE.MathUtils.lerp(-Math.PI * 0.44, Math.PI * 0.498, hk);
    const uy = Math.sin(lat);
    const cosLat = Math.max(0.0025, Math.cos(lat));
    const ring: LoftRingPoint[] = [];

    for (let s = 0; s < segs; s++) {
      const phi = (s / segs) * Math.PI * 2;
      const ux = Math.sin(phi) * cosLat;
      const uz = Math.cos(phi) * cosLat;

      let x = ux * rxHead;
      let y = uy * ryHead + faceCenterY;
      let z = uz * rzHead;

      // Occipital cranial length (back of skull curves smoothly rather than looking flat)
      if (uz < 0) {
        z *= 1.04;
      }

      // Temple & cranial parietal fullness
      if (uy > 0) {
        x *= 1 + uy * 0.048 * (1 - Math.abs(uy) * 0.35);
        z -= uy * 0.003;
      }

      // Smooth submental underside + mandibular jawline + chin projection
      const yLocal = y - 1.622;
      if (yLocal < 0.024) {
        const jt = THREE.MathUtils.clamp((0.024 - yLocal) / 0.095, 0, 1);
        const smoothJt = jt * jt * (3 - 2 * jt);
        const jawTaper = (fem ? 0.28 : 0.25) / jawMod;
        x *= 1 - smoothJt * jawTaper;

        if (uz > 0) {
          const chinLift = Math.exp(-Math.pow(x / 0.029, 2)) * Math.exp(-Math.pow((y - 1.566) / 0.024, 2));
          z += chinLift * (fem ? 0.017 : 0.019);
          z *= 1 - smoothJt * 0.03;
        } else {
          // Tuck rear underside smoothly toward cervical neck without pinching
          z *= 1 - smoothJt * 0.28;
          z -= smoothJt * 0.004;
        }

        // Gonial jaw corner definition running cleanly toward ear
        const jawAngle =
          Math.exp(-Math.pow((Math.abs(x) - 0.049) / 0.016, 2)) *
          Math.exp(-Math.pow((y - 1.588) / 0.02, 2));
        x += Math.sign(x) * jawAngle * (fem ? 0.0035 : 0.005) * jawMod;
      }

      // Front facial sculpt (eye sockets, brow, cheeks, nose bridge/tip/nostrils, philtrum, lips, chin crease)
      if (uz > 0.1) {
        const frontFade = Math.min(1, (uz - 0.1) / 0.42);
        z -= frontFade * 0.004;

        // Recessed orbital eye sockets (centered around y=1.657, x=±0.0265)
        const eyeL = Math.exp(-(Math.pow((x - 0.0265) / 0.014, 2) + Math.pow((y - 1.657) / 0.0105, 2)));
        const eyeR = Math.exp(-(Math.pow((x + 0.0265) / 0.014, 2) + Math.pow((y - 1.657) / 0.0105, 2)));
        z -= frontFade * (eyeL + eyeR) * 0.0185;

        // Supraorbital brow ridge
        const brow = Math.exp(-Math.pow(x / 0.046, 2)) * Math.exp(-Math.pow((y - 1.676) / 0.01, 2));
        z += frontFade * brow * (fem ? 0.0048 : 0.008);

        // Zygomatic cheekbones
        const cheekL = Math.exp(-(Math.pow((x - 0.038) / 0.018, 2) + Math.pow((y - 1.635) / 0.015, 2)));
        const cheekR = Math.exp(-(Math.pow((x + 0.038) / 0.018, 2) + Math.pow((y - 1.635) / 0.015, 2)));
        z += frontFade * (cheekL + cheekR) * 0.0075 * cheekMod;

        // Refined nasal bridge, nasion dip, tip & alar nostril wings
        const nasionDip = Math.exp(-Math.pow(x / 0.012, 2)) * Math.exp(-Math.pow((y - 1.664) / 0.008, 2));
        const noseBridge =
          y > 1.622 && y < 1.672
            ? Math.exp(-Math.pow(x / 0.0078, 2)) * Math.exp(-Math.pow((y - 1.641) / 0.019, 2))
            : 0;
        const noseTip = Math.exp(-Math.pow(x / 0.0095, 2)) * Math.exp(-Math.pow((y - 1.625) / 0.008, 2));
        const nostrilL = Math.exp(-(Math.pow((x - 0.0108) / 0.0052, 2) + Math.pow((y - 1.622) / 0.005, 2)));
        const nostrilR = Math.exp(-(Math.pow((x + 0.0108) / 0.0052, 2) + Math.pow((y - 1.622) / 0.005, 2)));
        const alarCrease =
          Math.exp(-Math.pow((Math.abs(x) - 0.0155) / 0.003, 2)) * Math.exp(-Math.pow((y - 1.623) / 0.005, 2));
        z +=
          frontFade *
          (-nasionDip * 0.002 +
            noseBridge * 0.0145 * noseMod +
            noseTip * 0.0145 +
            (nostrilL + nostrilR) * 0.0044 * noseMod -
            alarCrease * 0.002);

        // Philtrum + sculpted upper & lower lips + mentolabial fold
        const philtrum = Math.exp(-Math.pow(x / 0.0042, 2)) * Math.exp(-Math.pow((y - 1.613) / 0.0055, 2));
        const lipUp = Math.exp(-Math.pow(x / 0.018, 2)) * Math.exp(-Math.pow((y - 1.604) / 0.0046, 2));
        const lipLo = Math.exp(-Math.pow(x / 0.016, 2)) * Math.exp(-Math.pow((y - 1.595) / 0.0052, 2));
        const mouthCrease = Math.exp(-Math.pow(x / 0.019, 2)) * Math.exp(-Math.pow((y - 1.5995) / 0.0022, 2));
        const mentolabial = Math.exp(-Math.pow(x / 0.018, 2)) * Math.exp(-Math.pow((y - 1.584) / 0.0048, 2));
        z +=
          frontFade *
          (-philtrum * 0.002 + (lipUp * 0.0085 + lipLo * 0.0078) - mouthCrease * 0.0028 - mentolabial * 0.0016);
      }

      ring.push({ x, y, z });
    }
    headRings.push(ring);
  }

  const headGeo = loftRings(headRings, true, true, [0, 1], 1);
  const hPos = headGeo.attributes.position;
  const hUv = headGeo.attributes.uv;
  for (let i = 0; i < hPos.count; i++) {
    const ang = Math.atan2(hPos.getX(i), hPos.getZ(i));
    const u = 0.5 + ang / (Math.PI * 2);
    const uy = THREE.MathUtils.clamp((hPos.getY(i) - faceCenterY) / ryHead, -0.99, 0.99);
    const v = 0.5 + Math.asin(uy) / Math.PI;
    hUv.setXY(i, u, v);
  }
  hUv.needsUpdate = true;

  const merged = mergeGeometries([normalizeForMerge(neckGeo), normalizeForMerge(headGeo)], false);
  neckGeo.dispose();
  headGeo.dispose();
  // Preserve welded smooth vertex normals from loftRings (never call computeVertexNormals on non-indexed soup)
  return merged;
}

/**
 * Real 3D anatomical eyeball with UV centered strictly on the +Z front pole
 * so getEyeIrisTexture() (iris at u=0.5, v=0.5) aligns pixel-accurately.
 */
export function build3DEyeballGeo(radius = 0.0114, detail: DetailLevel = 'office'): THREE.BufferGeometry {
  const segs = detail === 'studio' ? 24 : 14;
  const geo = new THREE.SphereGeometry(radius, segs, segs);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(x, z); // 0 at +Z front pole
    const u = 0.5 + ang / (Math.PI * 2);
    const v = 0.5 + Math.asin(THREE.MathUtils.clamp(y / radius, -1, 1)) / Math.PI;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Curved 3D upper & lower eyelid shells hugging the eyeball sphere tightly inside the orbital socket.
 * Local origin sits at eyeball center so rotating X smoothly blinks the upper lid over the iris.
 */
export function build3DEyelidGeo(isUpper: boolean, fem: boolean, detail: DetailLevel = 'office'): THREE.BufferGeometry {
  const r = 0.0121;
  const wSeg = detail === 'studio' ? 16 : 10;
  const hSeg = 6;
  const geo = new THREE.SphereGeometry(
    r,
    wSeg,
    hSeg,
    Math.PI * 0.25,
    Math.PI * 0.5,
    isUpper ? Math.PI * 0.16 : Math.PI * 0.55,
    isUpper ? Math.PI * 0.29 : Math.PI * 0.21
  );
  // Rotate so phi=0.5*PI aligns to +Z
  geo.rotateY(-Math.PI * 0.5);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * (fem ? 1.06 : 1.03);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    if (isUpper && y < 0.0035) {
      z += 0.0009; // subtle lash margin
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Curved anatomical ear (auricle helix rim, antihelix, concha recess & earlobe) built for right/left sides.
 */
export function buildSculptedEarGeo(sideRight: boolean, detail: DetailLevel = 'office'): THREE.BufferGeometry {
  const segs = detail === 'studio' ? 16 : 10;
  const rings: LoftRingPoint[][] = [];
  const stations = detail === 'studio' ? 12 : 8;
  const sign = sideRight ? -1 : 1;

  for (let i = 0; i <= stations; i++) {
    const t = i / stations; // 0 = bottom earlobe, 1 = upper helix
    const y = THREE.MathUtils.lerp(-0.02, 0.022, t);
    const w = 0.0055 + Math.sin(Math.pow(t, 0.72) * Math.PI) * 0.008;
    const zBack = -Math.sin(t * Math.PI) * 0.01 - t * 0.004;
    const flareOut = sign * (0.003 + Math.sin(t * Math.PI * 0.9) * 0.0065);
    const ring: LoftRingPoint[] = [];

    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      let lx = cosA * 0.0042 + flareOut;
      const lz = sinA * w + zBack;
      // Carve concha hollow on outer face
      if (cosA * sign > 0.25 && t > 0.22 && t < 0.82 && Math.abs(sinA) < 0.55) {
        lx -= sign * 0.0028;
      }
      ring.push({ x: lx, y, z: lz });
    }
    rings.push(ring);
  }
  return loftRings(rings, true, true);
}

/* =========================================================
   CONTINUOUS SCULPTED TORSO & PELVIS (NO CAPPED CYLINDERS)
   ========================================================= */

export function buildContinuousTorsoPelvisGeo(
  isFem: boolean,
  isDress: boolean,
  isKnit: boolean,
  detail: DetailLevel = 'office'
): THREE.BufferGeometry {
  const segs = detail === 'studio' ? 44 : 28;
  const rows = detail === 'studio' ? 36 : 24;
  // Sheath dress torso tucks cleanly inside the dress skirt starting at y=1.084 so hip-to-lap never tears open
  const yStart = isDress ? 1.015 : 0.81;
  const yEnd = 1.512;
  const rings: LoftRingPoint[][] = [];

  for (let r = 0; r <= rows; r++) {
    const t = r / rows; // 0 = lower torso/pelvis, 1 = collar/neck base
    const y = THREE.MathUtils.lerp(yStart, yEnd, t);
    const tTorso = THREE.MathUtils.clamp((y - 0.86) / 0.652, 0, 1);
    const belowHip = y < 0.86 ? smoothstep(0.86, yStart, y) : 0;
    const dressTuck = isDress && y < 1.06 ? smoothstep(1.06, yStart, y) * 0.01 : 0;
    const offset = isKnit ? 0.0055 : 0;

    let halfW: number;
    let halfD: number;
    if (isFem) {
      const hipFlare = 0.048 * Math.exp(-Math.pow((tTorso - 0.04) / 0.18, 2));
      const waistPinch = -0.042 * Math.exp(-Math.pow((tTorso - 0.34) / 0.16, 2));
      const ribChest = 0.036 * Math.exp(-Math.pow((tTorso - 0.7) / 0.23, 2));
      // For sleeveless dresses, carve clean armhole scye inside the deltoid socket so bare shoulders flow seamlessly
      const shoulderShelf = (isDress ? 0.008 : 0.022) * Math.exp(-Math.pow((tTorso - 0.85) / 0.08, 2));
      const armholeScye = isDress ? -0.015 * Math.exp(-Math.pow((tTorso - 0.84) / 0.11, 2)) : 0;
      const shoulderTaper = tTorso > 0.895 ? 1 - ((tTorso - 0.895) / 0.105) * (isDress ? 0.57 : 0.61) : 1;
      halfW =
        (0.124 + hipFlare + waistPinch + ribChest + shoulderShelf + armholeScye - belowHip * 0.025 - dressTuck) *
        shoulderTaper;
      halfD =
        (0.09 + 0.013 * Math.sin(tTorso * Math.PI) - belowHip * 0.015 - dressTuck) *
        (tTorso > 0.895 ? 1 - ((tTorso - 0.895) / 0.105) * 0.48 : 1);
    } else {
      const hipBase = 0.145 + 0.012 * Math.exp(-Math.pow((tTorso - 0.05) / 0.16, 2));
      const vTaper = 0.048 * Math.exp(-Math.pow((tTorso - 0.78) / 0.24, 2)) - 0.015 * Math.exp(-Math.pow((tTorso - 0.3) / 0.16, 2));
      const shoulderShelf = 0.022 * Math.exp(-Math.pow((tTorso - 0.86) / 0.08, 2));
      const shoulderTaper = tTorso > 0.895 ? 1 - ((tTorso - 0.895) / 0.105) * 0.62 : 1;
      halfW = (hipBase + vTaper + shoulderShelf - belowHip * 0.025) * shoulderTaper;
      halfD =
        (0.098 + 0.014 * Math.sin(tTorso * Math.PI) - belowHip * 0.015) *
        (tTorso > 0.895 ? 1 - ((tTorso - 0.895) / 0.105) * 0.48 : 1);
    }

    const spineShiftZ = Math.sin(tTorso * Math.PI * 1.25) * 0.008;
    const ring: LoftRingPoint[] = [];

    for (let s = 0; s < segs; s++) {
      const ang = (s / segs) * Math.PI * 2;
      const cosA = Math.cos(ang); // X
      const sinA = Math.sin(ang); // Z (+1 front, -1 back)

      let rx = halfW + offset;
      let rz = halfD + offset;

      if (isFem) {
        if (sinA > 0) {
          rz += (isDress ? 0.024 : 0.022) * sinA * Math.exp(-Math.pow((tTorso - 0.63) / 0.14, 2));
        } else {
          const glute = 0.018 * (-sinA) * Math.exp(-Math.pow((tTorso - 0.03) / 0.13, 2));
          const backHollow = -0.011 * (-sinA) * Math.exp(-Math.pow((tTorso - 0.34) / 0.15, 2));
          rz += glute + backHollow;
        }
      } else {
        if (sinA > 0) {
          rz += 0.016 * sinA * Math.exp(-Math.pow((tTorso - 0.72) / 0.17, 2));
        } else {
          rz += 0.013 * (-sinA) * Math.exp(-Math.pow((tTorso - 0.74) / 0.19, 2));
        }
      }

      // Subtle spinal hollow along back midline + sternum furrow
      if (sinA < -0.7 && tTorso > 0.2 && tTorso < 0.85) {
        rz -= Math.pow(-sinA, 3) * 0.0055;
      }

      // Natural tucked waist fabric tension creases
      const waistCrease =
        Math.exp(-Math.pow((tTorso - 0.18) / 0.1, 2)) * Math.sin(ang * 7 + tTorso * 14) * (isKnit ? 0.0026 : 0.0019);
      const knitRib = isKnit && tTorso < 0.09 ? Math.sin(ang * 24) * 0.0012 : 0;

      // Squircle-ellipse blend for realistic ribcage/shoulder silhouette (not pure mathematical ellipse)
      const sq = 1 + 0.05 * Math.pow(Math.sin(2 * ang), 2);
      ring.push({
        x: cosA * (rx * sq + waistCrease + knitRib),
        y,
        z: sinA * (rz * sq + waistCrease + knitRib) + spineShiftZ,
      });
    }
    rings.push(ring);
  }

  return loftRings(rings, true, true, [0, 1], 2);
}

/* =========================================================
   CONTINUOUS ARM + ARTICULATED 5-FINGER SCULPTED HAND
   ========================================================= */

/**
 * Lofts a single organic finger (thumb or finger) along 3 articulated phalanges with
 * realistic knuckle swells, rounded pad tip, and natural resting flexion curl.
 */
function buildSculptedFingerGeo(
  len: number,
  baseR: number,
  curl: number,
  detail: DetailLevel
): { finger: THREE.BufferGeometry; nail: THREE.BufferGeometry } {
  const segs = detail === 'studio' ? 12 : 8;
  const rows = detail === 'studio' ? 14 : 9;
  const rings: LoftRingPoint[][] = [];

  for (let r = 0; r <= rows; r++) {
    const t = r / rows; // 0 = MCP knuckle base, 1 = fingertip
    // Smooth resting phalanx flexion curve curling inward toward palm (-X)
    const xOffset = -(t * t * len * curl + Math.max(0, t - 0.45) * len * curl * 0.25);
    const yOffset = -t * len * (1 - curl * 0.08 * t);

    // Anatomical phalanx profile: base, PIP joint swell (t=0.42), DIP swell (t=0.76), rounded dome tip
    const pip = Math.exp(-Math.pow((t - 0.42) / 0.09, 2)) * 0.14;
    const dip = Math.exp(-Math.pow((t - 0.76) / 0.08, 2)) * 0.08;
    const tipRound = t > 0.88 ? Math.sqrt(Math.max(0.05, 1 - Math.pow((t - 0.88) / 0.12, 2))) : 1;
    const radScale = (THREE.MathUtils.lerp(1.0, 0.74, t) + pip + dip) * tipRound;

    const rx = baseR * radScale * 0.92;
    const rz = baseR * radScale * 1.04;
    const ring: LoftRingPoint[] = [];
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      ring.push({
        x: xOffset + Math.cos(a) * rx,
        y: yOffset,
        z: Math.sin(a) * rz,
      });
    }
    rings.push(ring);
  }
  const finger = loftRings(rings, true, true);

  // Subtle dorsal fingernail bed on distal phalanx (+X dorsal side)
  const nail = new THREE.SphereGeometry(baseR * 0.68, 8, 6, 0, Math.PI, 0, Math.PI);
  nail.scale(0.32, 1.45, 0.84);
  const tipCurlX = -(0.88 * 0.88 * len * curl);
  nail.rotateZ(curl * 1.15);
  nail.translate(tipCurlX + baseR * 0.62, -len * 0.86, 0);

  return { finger, nail };
}

/**
 * Builds an anatomical 5-finger sculpted hand (palm + opposable thumb + 4 curved phalanx fingers + nails)
 * centered at wrist y=0 (extending down to -0.105m). Side = Left (+X dorsal outside).
 */
export function buildSculptedHandGeo(detail: DetailLevel = 'office'): {
  skin: THREE.BufferGeometry;
  nails: THREE.BufferGeometry;
} {
  const skinParts: THREE.BufferGeometry[] = [];
  const nailParts: THREE.BufferGeometry[] = [];

  // 1. Lofted anatomical palm (oval wrist -> curved metacarpal arch -> knuckle ridge)
  const segs = detail === 'studio' ? 18 : 12;
  const rows = detail === 'studio' ? 10 : 7;
  const palmRings: LoftRingPoint[][] = [];

  for (let r = 0; r <= rows; r++) {
    const t = r / rows; // 0 = wrist (y=0.008), 1 = knuckles (y=-0.054)
    const y = THREE.MathUtils.lerp(0.008, -0.054, t);
    const wZ = THREE.MathUtils.lerp(0.022, 0.032, Math.pow(t, 0.7)) * (t > 0.88 ? 0.94 : 1);
    const tX = THREE.MathUtils.lerp(0.014, 0.011, t);
    const archX = Math.sin(t * Math.PI) * 0.003;
    const ring: LoftRingPoint[] = [];

    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const cosA = Math.cos(a); // X (+ dorsal, - palmar)
      const sinA = Math.sin(a); // Z (+ thumb side, - pinky side)
      let x = cosA * tX + archX;
      const z = sinA * wZ;
      // Thenar thumb muscle pad on front-inner palm
      if (cosA < 0 && sinA > 0.15) {
        x -= Math.sin(t * Math.PI * 0.85) * sinA * 0.0055;
      }
      // Subtle knuckle swell at dorsal ridge
      if (t > 0.72 && cosA > 0.3) {
        const kn = ((t - 0.72) / 0.28) * (0.5 + 0.5 * Math.cos(z * 190));
        x += kn * 0.0022;
      }
      ring.push({ x, y, z });
    }
    palmRings.push(ring);
  }
  const palm = loftRings(palmRings, true, true);
  skinParts.push(normalizeForMerge(palm));

  // 2. Four individually articulated sculpted fingers (Index, Middle, Ring, Pinky)
  const fingerDefs: Array<{ z: number; x: number; y: number; len: number; r: number; curl: number; splayZ: number }> = [
    { z: 0.021, x: 0.001, y: -0.049, len: 0.047, r: 0.0067, curl: 0.24, splayZ: 0.04 },
    { z: 0.007, x: 0.0015, y: -0.052, len: 0.053, r: 0.007, curl: 0.27, splayZ: 0.01 },
    { z: -0.0075, x: 0.001, y: -0.05, len: 0.048, r: 0.0064, curl: 0.3, splayZ: -0.02 },
    { z: -0.021, x: 0.0, y: -0.047, len: 0.039, r: 0.0055, curl: 0.34, splayZ: -0.06 },
  ];

  for (const f of fingerDefs) {
    const { finger, nail } = buildSculptedFingerGeo(f.len, f.r, f.curl, detail);
    finger.rotateX(f.splayZ);
    finger.translate(f.x, f.y, f.z);
    nail.rotateX(f.splayZ);
    nail.translate(f.x, f.y, f.z);
    skinParts.push(normalizeForMerge(finger));
    nailParts.push(normalizeForMerge(nail));
  }

  // 3. Opposable sculpted thumb angled naturally forward/inward
  const thumb = buildSculptedFingerGeo(0.04, 0.0078, 0.16, detail);
  thumb.finger.rotateX(0.52);
  thumb.finger.rotateZ(-0.34);
  thumb.finger.rotateY(-0.35);
  thumb.finger.translate(-0.005, -0.016, 0.028);
  thumb.nail.rotateX(0.52);
  thumb.nail.rotateZ(-0.34);
  thumb.nail.rotateY(-0.35);
  thumb.nail.translate(-0.005, -0.016, 0.028);
  skinParts.push(normalizeForMerge(thumb.finger));
  nailParts.push(normalizeForMerge(thumb.nail));

  const skin = mergeGeometries(skinParts, false);
  const nails = mergeGeometries(nailParts, false);
  skinParts.forEach((p) => p.dispose());
  nailParts.forEach((p) => p.dispose());
  return { skin, nails };
}

/**
 * Continuous arm segment from rounded deltoid cap (y=1.445) down through elbow (y=1.165)
 * to wrist (y=0.91) built via organic anatomical cross-sections.
 */
export function buildContinuousArmGeo(
  yTop: number,
  yBot: number,
  style: 'bare' | 'sleeve' | 'shortSleeve' | 'rolledUpper' | 'forearmBare',
  detail: DetailLevel = 'office'
): THREE.BufferGeometry {
  const segs = detail === 'studio' ? 24 : 16;
  const rows = detail === 'studio' ? 22 : 16;
  const rings: LoftRingPoint[][] = [];

  for (let r = 0; r <= rows; r++) {
    const kSeg = r / rows; // 0 = top, 1 = bottom
    const y = THREE.MathUtils.lerp(yTop, yBot, kSeg);
    const kTotal = THREE.MathUtils.clamp((1.445 - y) / 0.535, 0, 1);

    let rx: number;
    let rz: number;
    let shiftX = 0;
    let shiftZ = 0;

    if (style === 'sleeve' || style === 'rolledUpper') {
      const capRound = kTotal < 0.08 ? Math.sin((kTotal / 0.08) * (Math.PI * 0.5)) * 0.48 + 0.52 : 1;
      const base = THREE.MathUtils.lerp(0.047, 0.0285, Math.pow(kTotal, 0.85)) * capRound;
      const crease = Math.exp(-Math.pow((kTotal - 0.52) / 0.09, 2)) * Math.sin(y * 110) * 0.0022;
      const cuff =
        style === 'rolledUpper' && kSeg > 0.9
          ? 0.0045 * Math.sin(((kSeg - 0.9) / 0.1) * Math.PI)
          : style === 'sleeve' && kSeg > 0.94
          ? 0.0028
          : 0;
      rx = base + crease + cuff;
      rz = base + 0.003 + crease + cuff;
      if (kTotal < 0.18) shiftX = -0.024 * (1 - kTotal / 0.18); // tuck smoothly into shoulder socket
    } else if (style === 'shortSleeve') {
      const capRound = kSeg < 0.14 ? Math.sin((kSeg / 0.14) * (Math.PI * 0.5)) * 0.45 + 0.55 : 1;
      rx = THREE.MathUtils.lerp(0.049, 0.043, kSeg) * capRound;
      rz = THREE.MathUtils.lerp(0.052, 0.045, kSeg) * capRound;
      if (kSeg < 0.24) shiftX = -0.022 * (1 - kSeg / 0.24);
    } else {
      // Bare arm: smooth spherical deltoid cap tucked cleanly inside sleeveless armhole
      const capRound = kTotal < 0.11 ? Math.sin((kTotal / 0.11) * (Math.PI * 0.5)) * 0.68 + 0.32 : 1;
      const deltoid = Math.exp(-Math.pow((kTotal - 0.13) / 0.11, 2)) * 0.0085;
      const elbow = -Math.exp(-Math.pow((kTotal - 0.52) / 0.07, 2)) * 0.002;
      const forearm = Math.exp(-Math.pow((kTotal - 0.63) / 0.13, 2)) * 0.0042;
      rx = (THREE.MathUtils.lerp(0.038, 0.0175, Math.pow(kTotal, 0.9)) + deltoid + elbow + forearm) * capRound;
      rz = (THREE.MathUtils.lerp(0.042, 0.0225, Math.pow(kTotal, 0.9)) + deltoid + elbow + forearm) * capRound;
      if (kTotal < 0.24) shiftX = -0.028 * (1 - kTotal / 0.24);
      shiftZ = Math.sin(kTotal * Math.PI) * 0.002;
    }

    const ring: LoftRingPoint[] = [];
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      ring.push({
        x: Math.cos(a) * rx + shiftX,
        y,
        z: Math.sin(a) * rz + shiftZ,
      });
    }
    rings.push(ring);
  }

  return loftRings(rings, true, true, [0, 1], 1);
}

/* =========================================================
   CONTINUOUS SCULPTED LEGS & ANATOMICAL SHOE LASTS
   ========================================================= */

export function buildContinuousLegGeo(isTrouser: boolean, detail: DetailLevel = 'office'): THREE.BufferGeometry {
  const segs = detail === 'studio' ? 28 : 20;
  const rows = detail === 'studio' ? 32 : 22;
  const rings: LoftRingPoint[][] = [];

  for (let r = 0; r <= rows; r++) {
    const t = r / rows; // 0 = hip y=0.89, 0.5 = knee y=0.46, 1 = ankle y=0.045
    const y = THREE.MathUtils.lerp(0.89, 0.045, t);
    let rx: number;
    let rz: number;
    let oz = 0;

    if (t <= 0.5) {
      const k = t / 0.5;
      const topTuck = t < 0.08 ? smoothstep(0.08, 0, t) * 0.18 : 0;
      if (isTrouser) {
        rx = THREE.MathUtils.lerp(0.088, 0.062, Math.pow(k, 0.8)) * (1 - topTuck * 0.4);
        rz = THREE.MathUtils.lerp(0.092, 0.066, Math.pow(k, 0.8)) * (1 - topTuck * 0.4);
        const kneeFold = Math.exp(-Math.pow((k - 0.92) / 0.14, 2)) * Math.sin(y * 95) * 0.0024;
        rx += kneeFold;
        rz += kneeFold;
      } else {
        rx = THREE.MathUtils.lerp(0.074, 0.048, Math.pow(k, 0.85)) * (1 - topTuck);
        rz = THREE.MathUtils.lerp(0.08, 0.052, Math.pow(k, 0.85)) * (1 - topTuck);
        oz = Math.sin(k * Math.PI) * 0.0065;
      }
    } else {
      const k = (t - 0.5) / 0.5;
      if (isTrouser) {
        const taper = THREE.MathUtils.lerp(0.062, 0.046, Math.pow(k, 0.72));
        const fold = Math.exp(-Math.pow((k - 0.1) / 0.15, 2)) * Math.sin(y * 95) * 0.002;
        const hemLip = k > 0.95 ? 0.002 : 0;
        rx = taper + fold + hemLip;
        rz = taper + 0.005 + fold + hemLip;
        oz = -Math.sin(k * Math.PI) * 0.003;
      } else {
        const gastroc = Math.exp(-Math.pow((k - 0.3) / 0.23, 2));
        const achilles = k > 0.78 ? -0.003 * smoothstep(0.78, 0.92, k) : 0;
        rx = THREE.MathUtils.lerp(0.048, 0.0285, k) + gastroc * 0.009 + achilles * 0.4;
        rz = THREE.MathUtils.lerp(0.052, 0.032, k) + gastroc * 0.0115 + achilles;
        oz = -gastroc * 0.0095;
      }
    }

    const ring: LoftRingPoint[] = [];
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      ring.push({
        x: Math.cos(a) * rx,
        y,
        z: Math.sin(a) * rz + oz,
      });
    }
    rings.push(ring);
  }

  return loftRings(rings, true, true, [0, 1], 1);
}

/**
 * Multi-station sculpted 3D shoe last with contoured heel cup, arch curve, almond/round toe box,
 * and separate outsole — strictly grounded with bottom at y = 0.000m in character space!
 */
export function buildSculptedShoeGeo(
  style: ShoeStyle,
  detail: DetailLevel = 'office'
): { sole: THREE.BufferGeometry; upper: THREE.BufferGeometry; instep?: THREE.BufferGeometry } {
  const segs = detail === 'studio' ? 22 : 14;
  const lenStations = detail === 'studio' ? 16 : 10;

  const isHeel = style === 'heel';
  const isSneaker = style === 'sneaker';
  const isFlat = style === 'flat';

  const zHeel = -0.054;
  const zToe = isHeel ? 0.168 : isSneaker ? 0.175 : 0.172;
  const soleThick = isSneaker ? 0.022 : isFlat ? 0.011 : 0.013;

  // Build contoured upper shoe last along foot Z axis
  const upperRings: LoftRingPoint[][] = [];
  for (let i = 0; i <= lenStations; i++) {
    const t = i / lenStations; // 0 = heel back, 1 = toe tip
    const z = THREE.MathUtils.lerp(zHeel, zToe, t);

    // Width profile across foot length: narrow heel -> slender midfoot arch -> wide ball -> rounded almond toe
    const widthProfile =
      0.026 +
      Math.exp(-Math.pow((t - 0.64) / 0.24, 2)) * 0.014 +
      Math.exp(-Math.pow((t - 0.12) / 0.12, 2)) * 0.004;
    const toeTaper = t > 0.78 ? Math.sqrt(Math.max(0.06, 1 - Math.pow((t - 0.78) / 0.22, 2))) : 1;
    const heelTaper = t < 0.08 ? Math.sqrt(Math.max(0.15, t / 0.08)) : 1;
    const rx = widthProfile * toeTaper * heelTaper * (isSneaker ? 1.08 : 0.96);

    // Top-of-vamp & outsole height profile
    const heelLift = isHeel ? Math.max(0, 1 - t * 2.2) * 0.048 : 0;
    const yBot = soleThick * 0.75 + heelLift + (t > 0.85 ? Math.pow((t - 0.85) / 0.15, 2) * 0.008 : 0);
    let yTop: number;
    if (isHeel || isFlat) {
      // Open-top pump/flat collar dipping low over midfoot vamp
      const heelCollar = (1 - smoothstep(0.0, 0.28, t)) * 0.062;
      const toeCap = smoothstep(0.6, 0.85, t) * 0.032 + (1 - smoothstep(0.85, 1, t)) * 0.01;
      yTop = yBot + 0.018 + heelCollar + (t > 0.58 ? toeCap : 0);
    } else {
      // Oxford / Sneaker closed lacing vamp rising toward ankle tongue
      const tongue = Math.exp(-Math.pow((t - 0.32) / 0.24, 2)) * (isSneaker ? 0.072 : 0.064);
      const collar = (1 - smoothstep(0.0, 0.35, t)) * 0.064;
      yTop = yBot + 0.022 + Math.max(tongue, collar) * toeTaper;
    }

    const yMid = (yBot + yTop) * 0.5;
    const ry = Math.max(0.003, (yTop - yBot) * 0.5);
    const ring: LoftRingPoint[] = [];
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      // Flatter sole bottom, domed top vamp
      const yPt = sinA < 0 ? yMid + sinA * ry * 0.85 : yMid + sinA * ry;
      ring.push({ x: cosA * rx, y: yPt, z });
    }
    upperRings.push(ring);
  }
  const upper = loftRings(upperRings, true, true);

  // Build matching sculpted outsole + stacked heel grounded at y = 0.000
  const soleParts: THREE.BufferGeometry[] = [];
  const soleRings: LoftRingPoint[][] = [];
  for (let i = 0; i <= lenStations; i++) {
    const t = i / lenStations;
    const z = THREE.MathUtils.lerp(zHeel - 0.002, zToe + 0.002, t);
    const widthProfile =
      0.028 +
      Math.exp(-Math.pow((t - 0.64) / 0.24, 2)) * 0.0145 +
      Math.exp(-Math.pow((t - 0.12) / 0.12, 2)) * 0.004;
    const toeTaper = t > 0.78 ? Math.sqrt(Math.max(0.06, 1 - Math.pow((t - 0.78) / 0.22, 2))) : 1;
    const heelTaper = t < 0.08 ? Math.sqrt(Math.max(0.15, t / 0.08)) : 1;
    const rx = widthProfile * toeTaper * heelTaper * (isSneaker ? 1.12 : 1.0);

    const heelLift = isHeel ? Math.max(0, 1 - t * 2.2) * 0.048 : 0;
    const y0 = heelLift + (t > 0.86 ? Math.pow((t - 0.86) / 0.14, 2) * 0.006 : 0);
    const y1 = y0 + soleThick;
    const yMid = (y0 + y1) * 0.5;
    const ry = soleThick * 0.5;

    const ring: LoftRingPoint[] = [];
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      ring.push({ x: Math.cos(a) * rx, y: yMid + Math.sin(a) * ry, z });
    }
    soleRings.push(ring);
  }
  soleParts.push(normalizeForMerge(loftRings(soleRings, true, true)));

  if (isHeel) {
    // Tapered stiletto / architectural block heel resting strictly at y = 0.000
    const heelPin = new THREE.CylinderGeometry(0.012, 0.0075, 0.056, 10);
    heelPin.translate(0, 0.028, zHeel + 0.016);
    soleParts.push(normalizeForMerge(heelPin));
  }

  const sole = mergeGeometries(soleParts, false);
  soleParts.forEach((p) => p.dispose());

  let instep: THREE.BufferGeometry | undefined;
  if (isHeel || isFlat) {
    instep = new THREE.SphereGeometry(0.028, 12, 10);
    instep.scale(0.86, 0.65, 1.85);
    instep.rotateX(isHeel ? 0.44 : 0.16);
    instep.translate(0, isHeel ? 0.048 : 0.029, 0.036);
  }

  return { sole, upper, instep };
}
