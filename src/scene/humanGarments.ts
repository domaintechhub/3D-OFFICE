import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loftRings, normalizeForMerge, type DetailLevel, type LoftRingPoint } from './humanAnatomy';

function sampleTorsoRadii(
  vy: number,
  ang: number,
  isFem: boolean,
  offset: number
): { x: number; z: number } {
  const cosA = Math.cos(ang);
  const sinA = Math.sin(ang);
  const tTorso = THREE.MathUtils.clamp((vy - 0.86) / 0.62, 0, 1);
  const belowHip = vy < 0.86 ? THREE.MathUtils.clamp((0.86 - vy) / 0.22, 0, 1) : 0;

  let halfW: number;
  let halfD: number;
  if (isFem) {
    const hipFlare = 0.048 * Math.exp(-Math.pow((tTorso - 0.04) / 0.18, 2));
    const waistPinch = -0.04 * Math.exp(-Math.pow((tTorso - 0.35) / 0.16, 2));
    const ribChest = 0.036 * Math.exp(-Math.pow((tTorso - 0.72) / 0.23, 2));
    const shoulderTaper = tTorso > 0.84 ? 1 - ((tTorso - 0.84) / 0.16) * 0.64 : 1;
    halfW = (0.124 + hipFlare + waistPinch + ribChest + belowHip * 0.022) * shoulderTaper;
    halfD = (0.09 + 0.013 * Math.sin(tTorso * Math.PI) + belowHip * 0.016) * shoulderTaper;
  } else {
    const hipBase = 0.145 + 0.012 * Math.exp(-Math.pow((tTorso - 0.05) / 0.16, 2));
    const vTaper = 0.044 * Math.exp(-Math.pow((tTorso - 0.78) / 0.24, 2)) - 0.015 * Math.exp(-Math.pow((tTorso - 0.3) / 0.16, 2));
    const shoulderTaper = tTorso > 0.85 ? 1 - ((tTorso - 0.85) / 0.15) * 0.64 : 1;
    halfW = (hipBase + vTaper + belowHip * 0.018) * shoulderTaper;
    halfD = (0.098 + 0.014 * Math.sin(tTorso * Math.PI) + belowHip * 0.014) * shoulderTaper;
  }

  let rx = halfW + offset;
  let rz = halfD + offset;
  if (isFem) {
    if (sinA > 0) rz += 0.02 * sinA * Math.exp(-Math.pow((tTorso - 0.65) / 0.14, 2));
    else rz += 0.017 * (-sinA) * Math.exp(-Math.pow((tTorso - 0.03) / 0.13, 2));
  } else {
    if (sinA > 0) rz += 0.015 * sinA * Math.exp(-Math.pow((tTorso - 0.72) / 0.17, 2));
    else rz += 0.013 * (-sinA) * Math.exp(-Math.pow((tTorso - 0.74) / 0.19, 2));
  }

  const spineShiftZ = Math.sin(tTorso * Math.PI * 1.25) * 0.008;
  const sq = 1 + 0.05 * Math.pow(Math.sin(2 * ang), 2);
  return {
    x: cosA * rx * sq,
    z: sinA * rz * sq + spineShiftZ,
  };
}

/**
 * Tailored double-walled blazer or overcoat shell with collar stand, folded notched lapels,
 * contoured front V-closure, and real garment thickness (zero paper-thin edges).
 */
export function buildTailoredBlazerOrCoatGeo(
  isFem: boolean,
  isLongCoat: boolean,
  detail: DetailLevel = 'office'
): THREE.BufferGeometry {
  const yBot = isLongCoat ? 0.63 : 0.79;
  const yTop = 1.485;
  const rows = detail === 'studio' ? 24 : 16;
  const uSegs = detail === 'studio' ? 28 : 20;
  const thickness = isLongCoat ? 0.0075 : 0.0055;
  const shellOffset = isLongCoat ? 0.016 : 0.011;

  // Sweep around from right front lapel edge -> right side -> back -> left side -> left front lapel edge
  // Front centerline is ang = +PI/2 (+Z). We open around front V-gap!
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const getFrontGapHalfAngle = (vy: number): number => {
    if (vy < 1.16) {
      // Lower cutaway hem flare slightly below button line
      const k = THREE.MathUtils.clamp((1.16 - vy) / (1.16 - yBot), 0, 1);
      return 0.08 + k * 0.14;
    }
    // Deep V opening toward collar
    const k = THREE.MathUtils.clamp((vy - 1.16) / (yTop - 1.16), 0, 1);
    return 0.08 + Math.pow(k, 0.85) * 0.36;
  };

  // Build closed thick jacket shell (outer surface + inner lining + folded front edge rim)
  // Ring cross section in UV-V goes from outer (0..uSegs) and back along inner (uSegs..2*uSegs+1)
  const ringVerts = (uSegs + 1) * 2;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const vy = THREE.MathUtils.lerp(yBot, yTop, t);
    const gap = getFrontGapHalfAngle(vy);
    const startAng = Math.PI * 0.5 + gap;
    const sweepAng = Math.PI * 2 - gap * 2;

    // Outer face
    for (let s = 0; s <= uSegs; s++) {
      const u = s / uSegs;
      const ang = startAng + u * sweepAng;
      const p = sampleTorsoRadii(vy, ang, isFem, shellOffset);
      // Slight tailored shoulder pad & hemline ease
      const foldRipple = Math.sin(ang * 5 + t * 8) * 0.0012;
      positions.push(p.x * (1 + foldRipple), vy, p.z + (vy < 0.86 ? -0.002 : 0));
      uvs.push(u * 2, t);
    }
    // Inner face (reversed order back to startAng so ring forms closed loop!)
    for (let s = uSegs; s >= 0; s--) {
      const u = s / uSegs;
      const ang = startAng + u * sweepAng;
      const p = sampleTorsoRadii(vy, ang, isFem, shellOffset - thickness);
      positions.push(p.x, vy, p.z + (vy < 0.86 ? -0.002 : 0));
      uvs.push(u * 2, t);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let s = 0; s < ringVerts; s++) {
      const sNext = (s + 1) % ringVerts;
      const a = r * ringVerts + s;
      const b = r * ringVerts + sNext;
      const c = (r + 1) * ringVerts + s;
      const d = (r + 1) * ringVerts + sNext;
      indices.push(a, c, b, b, c, d);
    }
  }

  // Seal bottom hem (r = 0, outward -Y) and top collar/shoulder rim (r = rows, outward +Y)
  const topBase = rows * ringVerts;
  for (let s = 0; s < uSegs; s++) {
    const o0 = s;
    const o1 = s + 1;
    const i0 = ringVerts - 1 - s;
    const i1 = ringVerts - 2 - s;
    indices.push(o0, o1, i0, o1, i1, i0);

    const to0 = topBase + o0;
    const to1 = topBase + o1;
    const ti0 = topBase + i0;
    const ti1 = topBase + i1;
    indices.push(to0, ti0, to1, to1, ti0, ti1);
  }

  const jacketShell = new THREE.BufferGeometry();
  jacketShell.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  jacketShell.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  jacketShell.setIndex(indices);
  jacketShell.computeVertexNormals();

  const parts: THREE.BufferGeometry[] = [normalizeForMerge(jacketShell)];

  // Folded Collar Stand wrapping back/sides of neck (y=1.475..1.51)
  const collarRings: LoftRingPoint[][] = [];
  const cSegs = 14;
  for (let r = 0; r <= 3; r++) {
    const k = r / 3;
    const cy = THREE.MathUtils.lerp(1.475, 1.508, k);
    const radOut = shellOffset + 0.004 + k * 0.004;
    const ring: LoftRingPoint[] = [];
    for (let s = 0; s <= cSegs; s++) {
      const u = s / cSegs;
      const ang = THREE.MathUtils.lerp(Math.PI * 0.72, Math.PI * 2.28, u);
      const pt = sampleTorsoRadii(1.475, ang, isFem, radOut);
      ring.push({ x: pt.x, y: cy, z: pt.z - 0.006 });
    }
    // Thickness return loop
    for (let s = cSegs; s >= 0; s--) {
      const u = s / cSegs;
      const ang = THREE.MathUtils.lerp(Math.PI * 0.72, Math.PI * 2.28, u);
      const pt = sampleTorsoRadii(1.475, ang, isFem, radOut - 0.0055);
      ring.push({ x: pt.x, y: cy, z: pt.z - 0.006 });
    }
    collarRings.push(ring);
  }
  parts.push(normalizeForMerge(loftRings(collarRings, true, true)));

  // Rolled notched lapels contoured directly over front chest curves (Left & Right)
  for (const side of [-1, 1]) {
    const lapelRings: LoftRingPoint[][] = [];
    const lRows = 8;
    for (let r = 0; r <= lRows; r++) {
      const k = r / lRows; // 0 = button waist closure (y=1.16), 1 = upper collar notch (y=1.47)
      const vy = THREE.MathUtils.lerp(1.17, 1.475, k);
      const gap = getFrontGapHalfAngle(vy);
      const innerAng = Math.PI * 0.5 + side * gap;
      const outerAng = innerAng + side * (0.04 + Math.sin(k * Math.PI * 0.85) * 0.22);
      // Notch indent near k=0.78
      const notch = Math.exp(-Math.pow((k - 0.78) / 0.06, 2)) * 0.065;
      const pIn = sampleTorsoRadii(vy, innerAng, isFem, shellOffset + 0.002);
      const pOut = sampleTorsoRadii(vy, outerAng - side * notch, isFem, shellOffset + 0.006);

      lapelRings.push([
        { x: pIn.x, y: vy, z: pIn.z + 0.002 },
        { x: (pIn.x + pOut.x) * 0.5, y: vy, z: (pIn.z + pOut.z) * 0.5 + 0.005 },
        { x: pOut.x, y: vy, z: pOut.z + 0.003 },
        { x: pOut.x, y: vy, z: pOut.z - 0.002 },
        { x: pIn.x, y: vy, z: pIn.z - 0.002 },
      ]);
    }
    parts.push(normalizeForMerge(loftRings(lapelRings, true, true)));
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Draped pencil (`short`) or A-line (`midi`) skirt with natural waist-band and subtle vertical cloth folds.
 */
export function buildDrapedSkirtGeo(
  kind: 'short' | 'midi',
  isFem: boolean,
  detail: DetailLevel = 'office'
): THREE.BufferGeometry {
  const length = kind === 'midi' ? 0.55 : 0.42;
  const flare = kind === 'midi' ? 0.032 : 0.004;
  const segs = detail === 'studio' ? 36 : 24;
  const rows = detail === 'studio' ? 20 : 14;
  const rings: LoftRingPoint[][] = [];

  for (let r = 0; r <= rows; r++) {
    const t = r / rows; // 0 = waist (0.91), 1 = hem
    const y = 0.91 - t * length;
    const hipCurve = Math.sin(Math.min(1, t / 0.25) * (Math.PI * 0.5));
    const hemMod = t > 0.25 ? (t - 0.25) * flare : 0;
    const wBase = (isFem ? 0.125 : 0.14) + hipCurve * 0.045 + hemMod;
    const dBase = (isFem ? 0.093 : 0.1) + hipCurve * 0.033 + hemMod * 0.85;

    const ring: LoftRingPoint[] = [];
    for (let s = 0; s < segs; s++) {
      const ang = (s / segs) * Math.PI * 2;
      const fold = 1 + (kind === 'midi' ? 0.036 : 0.018) * Math.sin(ang * 7 + t * 2.5) * Math.pow(t, 1.3);
      ring.push({
        x: Math.cos(ang) * wBase * fold,
        y,
        z: Math.sin(ang) * dBase * fold - 0.004,
      });
    }
    rings.push(ring);
  }
  return loftRings(rings, true, true, [0, 1], 2);
}

/**
 * Tailored shirt collar band & crisp folded collar points wrapping around Neck (y=1.465..1.50).
 */
export function buildShirtCollarGeo(isFem: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const band = new THREE.CylinderGeometry(isFem ? 0.047 : 0.052, isFem ? 0.054 : 0.059, 0.026, 20, 1, false);
  band.translate(0, 1.472, -0.005);
  parts.push(normalizeForMerge(band));

  for (const sd of [-1, 1]) {
    const ptRings: LoftRingPoint[][] = [
      [
        { x: sd * 0.012, y: 1.48, z: 0.046 },
        { x: sd * 0.046, y: 1.482, z: 0.032 },
        { x: sd * 0.046, y: 1.476, z: 0.027 },
        { x: sd * 0.012, y: 1.474, z: 0.041 },
      ],
      [
        { x: sd * 0.016, y: 1.452, z: 0.068 },
        { x: sd * 0.043, y: 1.458, z: 0.052 },
        { x: sd * 0.043, y: 1.454, z: 0.048 },
        { x: sd * 0.016, y: 1.448, z: 0.064 },
      ],
    ];
    parts.push(normalizeForMerge(loftRings(ptRings, true, true)));
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/**
 * Contoured silk necktie (Windsor knot + curved blade following torso sternum curve).
 */
export function buildContouredTieGeo(isFem: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Knot at collar base
  const knot = new THREE.CylinderGeometry(0.015, 0.01, 0.022, 8);
  knot.scale(1.1, 1, 0.72);
  knot.translate(0, 1.455, isFem ? 0.072 : 0.076);
  parts.push(normalizeForMerge(knot));

  // Blade hugging front chest contour (y=1.45 down to 1.04)
  const bladeRings: LoftRingPoint[][] = [];
  const rows = 10;
  for (let r = 0; r <= rows; r++) {
    const t = r / rows; // 0 = knot, 1 = pointed tip
    const vy = THREE.MathUtils.lerp(1.448, 1.03, t);
    const surf = sampleTorsoRadii(vy, Math.PI * 0.5, isFem, 0.005);
    const halfW = t > 0.88 ? THREE.MathUtils.lerp(0.024, 0.002, (t - 0.88) / 0.12) : THREE.MathUtils.lerp(0.01, 0.024, t);
    bladeRings.push([
      { x: -halfW, y: vy, z: surf.z },
      { x: halfW, y: vy, z: surf.z },
      { x: halfW * 0.9, y: vy, z: surf.z + 0.004 },
      { x: -halfW * 0.9, y: vy, z: surf.z + 0.004 },
    ]);
  }
  parts.push(normalizeForMerge(loftRings(bladeRings, true, true)));

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}
