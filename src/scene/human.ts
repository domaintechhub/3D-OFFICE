import * as THREE from 'three';
import type { MaterialLibrary } from './materials';
import { contact, getRoundedBox } from './props';
import { makeCanvasTex, plateTex } from './textures';

export interface PersonActor {
  g: THREE.Group;
  body: THREE.Group;
  hip: THREE.Group;
  thigh: THREE.Group[];
  knee: THREE.Group[];
  sh: THREE.Group[];
  el: THREE.Group[];
  eg: THREE.Group[];
  cur: Record<string, number>;
  tgt: Record<string, number>;
  moving: boolean;
  phase: number;
  yaw: number;
  tyaw: number;
  swing: number;
  typing: boolean;
  look: number;
  gest: boolean;
  fp: THREE.Mesh | null;
  pe: THREE.Mesh | null;
  tor: THREE.Group;
  head: THREE.Group;
  route: Array<{ x: number; z: number; wait?: number; pose?: string; face?: number }> | null;
  ri?: number;
  wait?: number;
  speed?: number;
  walkPose?: string;
  modes: Array<[string, number]> | null;
  timer: number;
  pose: string;
  asym: number;
  gl?: number;
  meshes: THREE.Mesh[];
  mk: (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    par: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    cast?: boolean
  ) => THREE.Mesh;
}

export const JK = ['hipY', 'thigh', 'knee', 'lean', 'hx', 'hy', 'sLx', 'sLz', 'eL', 'sRx', 'sRz', 'eR'] as const;

export const POSES: Record<string, Record<string, number>> = {
  stand: { hipY: 0.86, thigh: 0, knee: 0, lean: 0, hx: 0, hy: 0, sLx: 0, sLz: 0.07, eL: -0.12, sRx: 0, sRz: -0.07, eR: -0.12 },
};
const PZ = (o: Record<string, number>): Record<string, number> => ({ ...POSES.stand, ...o });
POSES.type = PZ({ hipY: 0.52, thigh: -1.5708, knee: 1.5708, lean: 0.1, hx: 0.12, sLx: -1.1, sLz: -0.07, eL: -0.38, sRx: -1.1, sRz: 0.07, eR: -0.38 });
POSES.phone = { ...POSES.type, sRx: -1.5, sRz: 0.12, eR: -2.2, hx: -0.05, hy: 0.15 };
POSES.point = { ...POSES.type, sRx: -1.6, sRz: 0.3, eR: -0.1, hx: 0, hy: -0.2 };
POSES.sit = PZ({ hipY: 0.5, thigh: -1.45, knee: 1.5, lean: -0.08, hx: 0.32, sLx: -0.7, eL: -1.0, sRx: -0.7, eR: -1.0, sLz: -0.05, sRz: 0.05 });
POSES.standType = PZ({ lean: 0.1, hx: 0.2, sLx: -1.0, sLz: -0.07, eL: -0.5, sRx: -1.0, sRz: 0.07, eR: -0.5 });
POSES.talk = PZ({ sRx: -0.8, eR: -1.0, sLx: -0.3, eL: -0.7, hy: 0.2 });
POSES.present = PZ({ sRx: -1.4, sRz: 0.35, eR: -0.15, sLx: -0.6, eL: -1.0, hy: -0.25 });
POSES.hold = PZ({ sLx: -0.8, eL: -1.3, sRx: -0.8, eR: -1.3, hx: 0.35, sLz: -0.05, sRz: 0.05 });
POSES.carry = PZ({ sLx: -0.9, eL: -0.35, sRx: -0.9, eR: -0.35, sLz: -0.1, sRz: 0.1, hx: 0.15 });
POSES.radio = PZ({ sRx: -1.5, sRz: 0.12, eR: -2.2, hx: -0.05, hy: 0.1 });

export const MODES: Record<string, Array<[string, number]>> = {
  def: [
    ['type', 0.8],
    ['phone', 0.1],
    ['point', 0.1],
  ],
  wa: [
    ['type', 0.45],
    ['phone', 0.5],
    ['point', 0.05],
  ],
  ppc: [
    ['type', 0.65],
    ['phone', 0.3],
    ['point', 0.05],
  ],
  hand: [
    ['type', 0.5],
    ['phone', 0.45],
    ['point', 0.05],
  ],
  crm: [
    ['type', 0.7],
    ['phone', 0.25],
    ['point', 0.05],
  ],
};

export function pickMode(m: Array<[string, number]>): string {
  let r = Math.random();
  for (const x of m) {
    r -= x[1];
    if (r <= 0) return x[0];
  }
  return 'type';
}

/* ---- Sculpted realistic anatomical geometries (shared across all staff) ---- */
let ANAT_GEOS: {
  torsoMale: THREE.BufferGeometry;
  torsoFem: THREE.BufferGeometry;
  blazerShell: THREE.BufferGeometry;
  thigh: THREE.LatheGeometry;
  calf: THREE.LatheGeometry;
  ankleSkin: THREE.LatheGeometry;
  upperArm: THREE.LatheGeometry;
  forearm: THREE.LatheGeometry;
  cuffRing: THREE.CylinderGeometry;
  hand: THREE.BufferGeometry;
  shoeUpper: THREE.ExtrudeGeometry;
  shoeSole: THREE.ExtrudeGeometry;
  head: THREE.BufferGeometry;
  neck: THREE.LatheGeometry;
  ear: THREE.BufferGeometry;
  pelvis: THREE.SphereGeometry;
  jointSph: THREE.SphereGeometry;
  hairShort: THREE.BufferGeometry;
  hairFull: THREE.BufferGeometry;
  hairBob: THREE.BufferGeometry;
  beardCap: THREE.BufferGeometry;
  bunGeo: THREE.LatheGeometry;
  ponytailGeo: THREE.TubeGeometry;
  locTube: THREE.TubeGeometry;
  browArc: THREE.TubeGeometry;
  upperLid: THREE.SphereGeometry;
  lipUpper: THREE.BufferGeometry;
  lipLower: THREE.BufferGeometry;
  phone: THREE.BufferGeometry;
  laptop: THREE.BufferGeometry;
  boxProp: THREE.BufferGeometry;
  collarTab: THREE.BufferGeometry;
  lapelGeo: THREE.ExtrudeGeometry;
} | null = null;

function latheFromProfile(pts: Array<[number, number]>, segs = 16): THREE.LatheGeometry {
  const curve = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(Math.max(0.001, x), y)));
  return new THREE.LatheGeometry(curve.getPoints(20), segs);
}

function buildSculptedTorso(fem: boolean, offset = 0, openFront = false): THREE.BufferGeometry {
  // Anatomical torso spanning y = -0.04..0.60 with natural chest, waist, shoulders & spine curve
  const radialSegs = 24;
  const heightSegs = 16;
  const thetaStart = openFront ? 0.34 : 0;
  const thetaLength = openFront ? Math.PI * 2 - 0.68 : Math.PI * 2;
  const geo = new THREE.CylinderGeometry(1, 1, 0.64, radialSegs, heightSegs, openFront, thetaStart, thetaLength);
  geo.translate(0, 0.28, 0);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const r = Math.hypot(vx, vz);
    if (r < 0.0001) continue;

    const ang = Math.atan2(vz, vx);
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang); // +1 front, -1 back

    // Normalized height t: 0 = bottom (-0.04), 1 = neck base (+0.60)
    const t = THREE.MathUtils.clamp((vy + 0.04) / 0.64, 0, 1);

    let halfW: number;
    let halfD: number;
    if (fem) {
      // Sculpted female ribcage, waist curve, bust & hip taper
      const hipW = 0.16 * Math.exp(-Math.pow((t - 0.08) / 0.22, 2));
      const waistPinch = -0.036 * Math.exp(-Math.pow((t - 0.36) / 0.17, 2));
      const chestW = 0.165 * Math.exp(-Math.pow((t - 0.72) / 0.28, 2));
      const shoulderTaper = t > 0.84 ? 1 - ((t - 0.84) / 0.16) * 0.62 : 1;
      halfW = (0.12 + hipW * 0.3 + waistPinch + chestW * 0.34) * shoulderTaper;

      const bustProj = sinA > 0 ? 0.02 * sinA * Math.exp(-Math.pow((t - 0.64) / 0.16, 2)) : 0;
      const backCurve = sinA < 0 ? 0.01 * Math.sin(t * Math.PI * 1.4) : 0;
      halfD = (0.095 + 0.014 * Math.sin(t * Math.PI)) * shoulderTaper + bustProj + backCurve;
    } else {
      // Tailored athletic male V-taper
      const waistW = 0.154 + 0.034 * Math.exp(-Math.pow((t - 0.76) / 0.26, 2)) - 0.014 * Math.exp(-Math.pow((t - 0.32) / 0.18, 2));
      const shoulderTaper = t > 0.85 ? 1 - ((t - 0.85) / 0.15) * 0.62 : 1;
      halfW = waistW * shoulderTaper;

      const pecProj = sinA > 0 ? 0.012 * sinA * Math.exp(-Math.pow((t - 0.7) / 0.19, 2)) : 0;
      const spineCurve = sinA < 0 ? 0.009 * Math.sin(t * Math.PI * 1.3) : 0;
      halfD = (0.098 + 0.014 * Math.sin(t * Math.PI)) * shoulderTaper + pecProj + spineCurve;
    }

    // Subtle lumbar offset
    const spineShiftZ = Math.sin(t * Math.PI * 1.2) * 0.008;
    const radScale = r;
    pos.setXYZ(
      i,
      cosA * (halfW + offset) * radScale,
      vy,
      sinA * (halfD + offset) * radScale + spineShiftZ * radScale
    );
  }

  geo.computeVertexNormals();
  return geo;
}

function buildSculptedHeadGeo(): THREE.BufferGeometry {
  // Anatomical cranium + tapered jaw + chin + eye sockets + nose bridge + cheekbones
  const geo = new THREE.SphereGeometry(1, 28, 22);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    let x = ux * 0.081;
    let y = uy * 0.118 + 0.032;
    let z = uz * 0.095;

    // 1. Cranium fullness slightly above midline & back occipital roundness
    if (uy > 0) {
      x *= 1 + uy * 0.05;
      z -= uy * 0.004;
    }

    // 2. Jawline & chin taper below y = 0.02
    if (y < 0.02) {
      const jt = THREE.MathUtils.clamp((0.02 - y) / 0.105, 0, 1);
      const smoothJt = jt * jt * (3 - 2 * jt);
      x *= 1 - smoothJt * 0.42;
      if (uz > 0) {
        // Subtle chin prominence, pulled slightly under at neck
        const chinLift = Math.exp(-Math.pow(ux / 0.38, 2)) * Math.exp(-Math.pow((y + 0.062) / 0.032, 2));
        z += chinLift * 0.012;
        z *= 1 - smoothJt * 0.12;
      } else {
        z *= 1 - smoothJt * 0.35;
      }
    }

    // 3. Facial mask modeling on front (+Z)
    if (uz > 0.15) {
      const frontFade = Math.min(1, (uz - 0.15) / 0.55);

      // Flatten face slightly relative to pure sphere
      z -= frontFade * 0.007;

      // Orbital eye sockets (recessed gently so eyes sit naturally inside skull)
      const eyeL = Math.exp(-(Math.pow((x - 0.031) / 0.019, 2) + Math.pow((y - 0.038) / 0.016, 2)));
      const eyeR = Math.exp(-(Math.pow((x + 0.031) / 0.019, 2) + Math.pow((y - 0.038) / 0.016, 2)));
      z -= frontFade * (eyeL + eyeR) * 0.013;

      // Brow ridge
      const brow =
        Math.exp(-Math.pow(x / 0.056, 2)) * Math.exp(-Math.pow((y - 0.061) / 0.012, 2));
      z += frontFade * brow * 0.0065;

      // Cheekbones
      const cheekL = Math.exp(-(Math.pow((x - 0.044) / 0.022, 2) + Math.pow((y - 0.014) / 0.018, 2)));
      const cheekR = Math.exp(-(Math.pow((x + 0.044) / 0.022, 2) + Math.pow((y - 0.014) / 0.018, 2)));
      z += frontFade * (cheekL + cheekR) * 0.0075;

      // Nasal bridge & tip
      const noseProfile =
        y > 0.004 && y < 0.062
          ? Math.exp(-Math.pow(x / 0.012, 2)) * Math.exp(-Math.pow((y - 0.018) / 0.024, 2))
          : 0;
      const noseTip =
        Math.exp(-Math.pow(x / 0.013, 2)) * Math.exp(-Math.pow((y - 0.008) / 0.011, 2));
      z += frontFade * (noseProfile * 0.016 + noseTip * 0.011);

      // Subtle philtrum / mouth mound
      const mouthMound =
        Math.exp(-Math.pow(x / 0.026, 2)) * Math.exp(-Math.pow((y + 0.022) / 0.015, 2));
      z += frontFade * mouthMound * 0.005;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildHairCapGeo(style: 'short' | 'full' | 'bob'): THREE.BufferGeometry {
  // Scalp-emergent hair volume: sits proud of skull where hair grows, dips gently inside below hairline
  const geo = new THREE.SphereGeometry(1, 26, 20);
  const pos = geo.attributes.position;

  const thickness = style === 'full' ? 0.018 : style === 'bob' ? 0.014 : 0.0095;
  const topCrown = style === 'full' ? 0.022 : style === 'bob' ? 0.009 : 0.012;

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    let x = ux * 0.082;
    let y = uy * 0.119 + 0.032;
    let z = uz * 0.096;

    // Determine hairline boundary in Y depending on front (+Z), temples (|X|), and back (-Z)
    const frontFactor = THREE.MathUtils.clamp(uz, -1, 1);
    const sideFactor = Math.abs(ux);
    // Front hairline around y = 0.086, dips at temples, descends to nape y = -0.02 in back
    let hairlineY =
      0.088 * Math.max(0, frontFactor) -
      0.028 * Math.max(0, -frontFactor) +
      0.028 * (1 - sideFactor * 0.7);
    if (style === 'bob') {
      // Bob drapes down past ears and nape
      hairlineY = frontFactor > 0.35 ? 0.082 : -0.055;
    }

    const aboveLine = y - hairlineY;
    if (aboveLine > -0.006) {
      const grow = THREE.MathUtils.clamp((aboveLine + 0.006) / 0.028, 0, 1);
      const lift = thickness * grow + (uy > 0.25 ? topCrown * ((uy - 0.25) / 0.75) : 0);
      x += ux * lift;
      y += Math.max(0, uy) * lift * 1.15;
      z += uz * lift;

      if (style === 'bob' && uy < 0.1 && frontFactor < 0.35) {
        // Gentle flare out at neck/cheek length
        const drop = THREE.MathUtils.clamp((0.1 - uy) * 0.55, 0, 1);
        x *= 1 + drop * 0.18;
        y -= drop * 0.048;
        z -= drop * 0.012;
      }
    } else {
      // Smoothly tuck inside head mesh so there is zero sharp edge or z-fighting
      x *= 0.84;
      y = Math.max(y, -0.02);
      z *= 0.84;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildBeardCapGeo(): THREE.BufferGeometry {
  // Contoured jawline beard + mustache hugging the lower jaw cleanly
  const geo = new THREE.SphereGeometry(1, 22, 16);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    let x = ux * 0.081;
    let y = uy * 0.118 + 0.032;
    let z = uz * 0.095;

    // Taper to match sculpted jaw
    if (y < 0.02) {
      const jt = THREE.MathUtils.clamp((0.02 - y) / 0.105, 0, 1);
      const smoothJt = jt * jt * (3 - 2 * jt);
      x *= 1 - smoothJt * 0.42;
      z *= uz > 0 ? 1 - smoothJt * 0.1 : 1 - smoothJt * 0.35;
    }

    // Grow beard strictly along lower jaw (y < -0.018, uz > -0.15) and subtle sideburn taper
    const inJaw = y < -0.008 && y > -0.095 && uz > -0.18;
    const isMouthOpening = Math.abs(x) < 0.022 && y > -0.032 && y < -0.014 && uz > 0.5;
    if (inJaw && !isMouthOpening) {
      const fade =
        THREE.MathUtils.clamp((-0.008 - y) / 0.025, 0, 1) *
        THREE.MathUtils.clamp((uz + 0.18) / 0.35, 0, 1);
      x += ux * 0.0055 * fade;
      y -= 0.006 * fade;
      z += Math.max(0, uz) * 0.009 * fade;
    } else {
      x *= 0.78;
      y = Math.min(y, -0.01);
      z *= 0.78;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildHandGeo(): THREE.BufferGeometry {
  // Sculpted organic hand silhouette (palm + tapered fingers + thumb)
  const sh = new THREE.Shape();
  sh.moveTo(-0.02, 0.01);
  sh.lineTo(0.02, 0.01);
  // Subtle thumb protrusion on +X side
  sh.quadraticCurveTo(0.032, -0.01, 0.03, -0.034);
  sh.quadraticCurveTo(0.024, -0.038, 0.021, -0.032);
  // Outer index finger & rounded fingertip cluster
  sh.lineTo(0.022, -0.072);
  sh.quadraticCurveTo(0.012, -0.095, 0.0, -0.094);
  sh.quadraticCurveTo(-0.016, -0.092, -0.021, -0.068);
  sh.lineTo(-0.022, -0.015);
  sh.closePath();

  const geo = new THREE.ExtrudeGeometry(sh, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -0.008);
  geo.rotateY(Math.PI / 2); // palm faces inward toward body
  geo.computeVertexNormals();
  return geo;
}

function initAnatomyGeos() {
  if (ANAT_GEOS) return ANAT_GEOS;

  const torsoMale = buildSculptedTorso(false, 0, false);
  const torsoFem = buildSculptedTorso(true, 0, false);
  const blazerShell = buildSculptedTorso(false, 0.009, true);

  // Sculpted trouser/leg geometries with crisp ankle taper
  const thigh = latheFromProfile(
    [
      [0.082, 0.02],
      [0.086, -0.09],
      [0.077, -0.24],
      [0.062, -0.38],
      [0.056, -0.43],
    ],
    16
  );

  const calf = latheFromProfile(
    [
      [0.056, 0.01],
      [0.065, -0.1],
      [0.061, -0.21],
      [0.047, -0.33],
      [0.044, -0.39],
    ],
    16
  );

  const ankleSkin = latheFromProfile(
    [
      [0.036, -0.37],
      [0.033, -0.42],
    ],
    12
  );

  const upperArm = latheFromProfile(
    [
      [0.048, 0.02],
      [0.051, -0.07],
      [0.043, -0.19],
      [0.037, -0.28],
    ],
    14
  );

  const forearm = latheFromProfile(
    [
      [0.038, 0.01],
      [0.04, -0.08],
      [0.031, -0.19],
      [0.024, -0.27],
    ],
    14
  );

  // Two-part sculpted shoe: sole welt + tailored upper
  const soleShape = new THREE.Shape();
  soleShape.moveTo(-0.058, 0);
  soleShape.lineTo(0.165, 0);
  soleShape.quadraticCurveTo(0.18, 0.006, 0.175, 0.02);
  soleShape.lineTo(-0.058, 0.022);
  soleShape.closePath();
  const shoeSole = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.078,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  shoeSole.translate(0, 0, -0.039);
  shoeSole.rotateY(-Math.PI / 2);

  const upperShape = new THREE.Shape();
  upperShape.moveTo(-0.055, 0.018);
  upperShape.lineTo(0.16, 0.016);
  upperShape.quadraticCurveTo(0.175, 0.03, 0.155, 0.045);
  upperShape.quadraticCurveTo(0.105, 0.068, 0.045, 0.078);
  upperShape.lineTo(-0.032, 0.092);
  upperShape.quadraticCurveTo(-0.064, 0.072, -0.058, 0.022);
  upperShape.closePath();
  const shoeUpper = new THREE.ExtrudeGeometry(upperShape, {
    depth: 0.072,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 3,
  });
  shoeUpper.translate(0, 0, -0.036);
  shoeUpper.rotateY(-Math.PI / 2);

  const head = buildSculptedHeadGeo();

  const neck = latheFromProfile(
    [
      [0.051, -0.02],
      [0.043, 0.05],
      [0.045, 0.115],
    ],
    14
  );

  // Sculpted blazer lapel strip
  const lapelShape = new THREE.Shape();
  lapelShape.moveTo(0, 0);
  lapelShape.lineTo(0.045, 0.24);
  lapelShape.lineTo(0.015, 0.25);
  lapelShape.lineTo(-0.014, 0.01);
  lapelShape.closePath();
  const lapelGeo = new THREE.ExtrudeGeometry(lapelShape, {
    depth: 0.01,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.003,
    bevelSegments: 2,
  });

  // Curved braided loc / ponytail tubes
  const locCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.1, -0.04),
    new THREE.Vector3(0, 0.02, -0.112),
    new THREE.Vector3(0, -0.085, -0.118),
    new THREE.Vector3(0, -0.17, -0.1),
  ]);

  const ponyCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.055, -0.095),
    new THREE.Vector3(0, -0.01, -0.135),
    new THREE.Vector3(0, -0.115, -0.145),
    new THREE.Vector3(0, -0.19, -0.125),
  ]);

  // Curved eyebrow arch
  const browCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.017, -0.002, 0),
    new THREE.Vector3(0, 0.004, 0.004),
    new THREE.Vector3(0.017, -0.003, -0.002),
  ]);

  // Sculpted high bun
  const bunGeo = latheFromProfile(
    [
      [0.001, -0.028],
      [0.042, -0.016],
      [0.048, 0.006],
      [0.036, 0.028],
      [0.001, 0.036],
    ],
    14
  );

  ANAT_GEOS = {
    torsoMale,
    torsoFem,
    blazerShell,
    thigh,
    calf,
    ankleSkin,
    upperArm,
    forearm,
    cuffRing: new THREE.CylinderGeometry(0.029, 0.031, 0.026, 12),
    hand: buildHandGeo(),
    shoeUpper,
    shoeSole,
    head,
    neck,
    ear: getRoundedBox(0.014, 0.036, 0.024, 0.007, 2),
    pelvis: new THREE.SphereGeometry(0.142, 16, 12),
    jointSph: new THREE.SphereGeometry(0.046, 12, 10),
    hairShort: buildHairCapGeo('short'),
    hairFull: buildHairCapGeo('full'),
    hairBob: buildHairCapGeo('bob'),
    beardCap: buildBeardCapGeo(),
    bunGeo,
    ponytailGeo: new THREE.TubeGeometry(ponyCurve, 10, 0.024, 8, false),
    locTube: new THREE.TubeGeometry(locCurve, 10, 0.015, 7, false),
    browArc: new THREE.TubeGeometry(browCurve, 6, 0.0032, 6, false),
    upperLid: new THREE.SphereGeometry(0.014, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.48),
    lipUpper: getRoundedBox(0.03, 0.007, 0.009, 0.003, 2),
    lipLower: getRoundedBox(0.026, 0.0075, 0.01, 0.003, 2),
    phone: getRoundedBox(0.072, 0.142, 0.009, 0.004, 2),
    laptop: getRoundedBox(0.28, 0.018, 0.2, 0.006, 2),
    boxProp: getRoundedBox(0.36, 0.26, 0.3, 0.025, 2),
    collarTab: getRoundedBox(0.028, 0.042, 0.01, 0.003, 2),
    lapelGeo,
  };
  return ANAT_GEOS;
}

export interface HumanPalette {
  skins: THREE.MeshPhysicalMaterial[];
  shirts: THREE.MeshPhysicalMaterial[];
  hairs: THREE.MeshPhysicalMaterial[];
  trous: THREE.MeshPhysicalMaterial[];
  white: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshStandardMaterial;
  lips: THREE.MeshStandardMaterial;
  shoe: THREE.MeshPhysicalMaterial;
  sneaker: THREE.MeshPhysicalMaterial;
  sneakerSole: THREE.MeshStandardMaterial;
  dressSole: THREE.MeshStandardMaterial;
  belt: THREE.MeshStandardMaterial;
  buckle: THREE.MeshStandardMaterial;
  iris: THREE.MeshStandardMaterial[];
  catchLight: THREE.MeshBasicMaterial;
  lanyard: THREE.MeshStandardMaterial;
  badge: THREE.MeshStandardMaterial;
  phone: THREE.MeshStandardMaterial;
  boxProp: THREE.MeshStandardMaterial;
  glassesFrame: THREE.MeshStandardMaterial;
  glassesLens: THREE.MeshPhysicalMaterial;
  watchMat: THREE.MeshStandardMaterial;
}

export function createHumanPalette(M: MaterialLibrary): HumanPalette {
  // Subtle micro-grain normal/roughness for realistic skin & hair shading
  const skinRoughTex = makeCanvasTex('skinrough', 128, 128, (g, W, H) => {
    g.fillStyle = '#888';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1800; i++) {
      const v = 115 + Math.floor(Math.random() * 48);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
  });
  skinRoughTex.wrapS = skinRoughTex.wrapT = THREE.RepeatWrapping;
  skinRoughTex.repeat.set(3, 3);

  const hairTex = makeCanvasTex('hairstrand', 128, 128, (g, W, H) => {
    g.fillStyle = '#cfcfcf';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 2) {
      const v = 165 + Math.floor(Math.random() * 75);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, 0, 1, H);
    }
  });
  hairTex.wrapS = hairTex.wrapT = THREE.RepeatWrapping;
  hairTex.repeat.set(6, 2);

  const badgeTex = makeCanvasTex('staffbadge', 128, 160, (g, W, H) => {
    g.fillStyle = '#f3f1eb';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#1b8a5a';
    g.fillRect(0, 0, W, 24);
    g.fillStyle = '#334155';
    g.fillRect(16, 38, 42, 48);
    g.fillStyle = '#94a3b8';
    g.beginPath();
    g.arc(37, 54, 10, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1e293b';
    g.fillRect(68, 44, 46, 8);
    g.fillStyle = '#64748b';
    g.fillRect(68, 60, 38, 6);
    g.fillRect(68, 72, 30, 6);
    g.fillStyle = '#0f172a';
    for (let x = 16; x < W - 16; x += 5) {
      g.fillRect(x, 114, (x % 3) + 1, 24);
    }
  });

  const mkSkin = (c: number) =>
    new THREE.MeshPhysicalMaterial({
      color: c,
      roughnessMap: skinRoughTex,
      roughness: 0.56,
      metalness: 0,
      clearcoat: 0.06,
      clearcoatRoughness: 0.65,
      sheen: 0.28,
      sheenColor: new THREE.Color(0xffb494),
      sheenRoughness: 0.72,
      envMapIntensity: 0.28,
    });

  const mkCloth = (c: number, r = 0.86) =>
    new THREE.MeshPhysicalMaterial({
      color: c,
      normalMap: M.textures.fabricNormal,
      normalScale: new THREE.Vector2(0.36, 0.36),
      roughness: r,
      metalness: 0,
      sheen: 0.56,
      sheenRoughness: 0.74,
      envMapIntensity: 0.22,
    });

  const mkHair = (c: number) =>
    new THREE.MeshPhysicalMaterial({
      color: c,
      map: hairTex,
      roughness: 0.48,
      metalness: 0.04,
      sheen: 0.45,
      sheenRoughness: 0.48,
      sheenColor: new THREE.Color(0x8c7b6b),
      envMapIntensity: 0.42,
    });

  return {
    skins: [0x8a583b, 0x69422e, 0xb57f59, 0x543423, 0xcfa07b, 0x9b6848, 0x794d36, 0xd9b292].map(mkSkin),
    shirts: [
      0x2f5f9e,
      0xb84a39,
      0x2b7d5e,
      0x684ea8,
      0xc79434,
      0x2f8d9e,
      0x9e3f60,
      0x4e5c6b,
      0xe8e4dc,
      0x1d2942,
    ].map((c) => mkCloth(c, 0.85)),
    hairs: [0x151210, 0x261a12, 0x422d20, 0x0e0e12].map(mkHair),
    trous: [0x212834, 0x35363d, 0x463a30, 0x283747].map((c) => mkCloth(c, 0.9)),
    white: new THREE.MeshPhysicalMaterial({ color: 0xf4f1eb, roughness: 0.22, clearcoat: 0.75, clearcoatRoughness: 0.14 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x100e0c, roughness: 0.28 }),
    lips: new THREE.MeshStandardMaterial({ color: 0x7c453e, roughness: 0.48 }),
    shoe: new THREE.MeshPhysicalMaterial({
      color: 0x1b1714,
      roughness: 0.28,
      metalness: 0.05,
      clearcoat: 0.42,
      clearcoatRoughness: 0.25,
      envMapIntensity: 0.55,
    }),
    sneaker: new THREE.MeshPhysicalMaterial({
      color: 0x2c3648,
      normalMap: M.textures.fabricNormal,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughness: 0.68,
      metalness: 0.02,
      envMapIntensity: 0.28,
    }),
    sneakerSole: new THREE.MeshStandardMaterial({ color: 0xeeece6, roughness: 0.62, metalness: 0.02 }),
    dressSole: new THREE.MeshStandardMaterial({ color: 0x12100e, roughness: 0.72 }),
    belt: new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.48 }),
    buckle: new THREE.MeshStandardMaterial({ color: 0xc2c8cf, metalness: 0.88, roughness: 0.24 }),
    iris: [0x3b2415, 0x27180f, 0x243e4f, 0x3d3b1e].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.16 })),
    catchLight: new THREE.MeshBasicMaterial({ color: 0xf5f9ff }),
    lanyard: new THREE.MeshStandardMaterial({ color: 0x1a2842, roughness: 0.78 }),
    badge: new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.4 }),
    phone: new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.34, emissive: 0x2a6fc0, emissiveIntensity: 0.55 }),
    boxProp: new THREE.MeshStandardMaterial({ color: 0xb8895a, roughness: 0.78 }),
    glassesFrame: new THREE.MeshStandardMaterial({ color: 0x22201e, metalness: 0.65, roughness: 0.28 }),
    glassesLens: new THREE.MeshPhysicalMaterial({
      color: 0xdff2ff,
      roughness: 0.05,
      transparent: true,
      opacity: 0.22,
      clearcoat: 1,
      depthWrite: false,
    }),
    watchMat: new THREE.MeshStandardMaterial({ color: 0xc8cfd6, metalness: 0.88, roughness: 0.22 }),
  };
}

export function makePerson(
  o: {
    skin: THREE.MeshPhysicalMaterial;
    shirt: THREE.Material;
    hair: THREE.MeshStandardMaterial;
    trou: THREE.Material;
    s?: number;
    fem?: boolean;
    hs?: number;
    sneakers?: boolean;
    blazer?: boolean;
  },
  P_LIB: HumanPalette,
  M: MaterialLibrary
): PersonActor {
  const G = initAnatomyGeos();
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(o.s || 1);
  g.add(body);
  const hip = new THREE.Group();
  body.add(hip);

  const meshes: THREE.Mesh[] = [];
  const mk = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    par: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    cast = false
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = cast;
    par.add(m);
    meshes.push(m);
    return m;
  };

  const P: PersonActor = {
    g,
    body,
    hip,
    thigh: [],
    knee: [],
    sh: [],
    el: [],
    eg: [],
    cur: { ...POSES.stand },
    tgt: POSES.stand,
    moving: false,
    phase: Math.random() * 6,
    yaw: 0,
    tyaw: 0,
    swing: 1,
    typing: false,
    look: 0,
    gest: false,
    fp: null,
    pe: null,
    tor: new THREE.Group(),
    head: new THREE.Group(),
    route: null,
    modes: null,
    timer: 0,
    pose: 'stand',
    asym: Math.random() - 0.5,
    meshes,
    mk,
  };

  const skin = o.skin.clone();
  skin.color.offsetHSL((Math.random() - 0.5) * 0.018, 0, (Math.random() - 0.5) * 0.045);
  const shirt = o.shirt.clone() as THREE.MeshPhysicalMaterial;
  shirt.color.offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.055);
  const hair = o.hair.clone();
  hair.color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.035);

  const seed = Math.abs((shirt.color.getHex() >> 3) + (skin.color.getHex() >> 4) + (hair.color.getHex() >> 2));
  const hs = o.hs != null ? o.hs : seed % 5;
  const hasBlazer = !!o.blazer || (!o.sneakers && seed % 4 === 0);
  const longSleeve = hasBlazer || seed % 3 !== 1;
  const hasGlasses = o.blazer ? seed % 3 === 0 : seed % 5 === 0;
  const hasWatch = seed % 2 === 0;

  // Natural skin-harmonized lip tint
  const lipMat = P_LIB.lips.clone();
  lipMat.color.copy(skin.color).lerp(new THREE.Color(0x6e312b), 0.42);

  // Sculpted pelvis
  mk(G.pelvis, o.trou, hip, 0, 0.02, 0, 1.06, 0.72, 0.78, false);

  // Sculpted legs, ankle transition & two-part tailored footwear
  const upperShoeMat = o.sneakers ? P_LIB.sneaker : P_LIB.shoe;
  const soleMat = o.sneakers ? P_LIB.sneakerSole : P_LIB.dressSole;
  [1, -1].forEach((sx) => {
    const th = new THREE.Group();
    th.position.set(sx * 0.09, 0, 0);
    hip.add(th);
    mk(G.thigh, o.trou, th, 0, 0, 0, 1, 1, 1.04, false);

    const kn = new THREE.Group();
    kn.position.y = -0.42;
    th.add(kn);
    mk(G.jointSph, o.trou, kn, 0, 0, 0, 1.15, 1.15, 1.15, false);
    mk(G.calf, o.trou, kn, 0, 0, 0, 1, 1, 1.04, false);
    mk(G.ankleSkin, skin, kn, 0, 0, 0, 1, 1, 1, false);

    const shSole = new THREE.Mesh(G.shoeSole, soleMat);
    shSole.position.set(0, -0.438, 0.02);
    shSole.castShadow = true;
    kn.add(shSole);
    meshes.push(shSole);

    const shUp = new THREE.Mesh(G.shoeUpper, upperShoeMat);
    shUp.position.set(0, -0.438, 0.02);
    shUp.castShadow = true;
    kn.add(shUp);
    meshes.push(shUp);

    P.thigh.push(th);
    P.knee.push(kn);
  });

  // Sculpted anatomical torso (or crisp inner shirt + tailored outer blazer)
  const tor = P.tor;
  hip.add(tor);
  const torsoGeo = o.fem ? G.torsoFem : G.torsoMale;
  const innerShirtMat = hasBlazer ? P_LIB.white : shirt;
  mk(torsoGeo, innerShirtMat, tor, 0, 0, 0, 1, 1, 1, true);

  if (hasBlazer) {
    // Open-front outer blazer jacket shell + sculpted lapels flanking the center shirt
    const blazerCoatMat = shirt.clone();
    blazerCoatMat.side = THREE.DoubleSide;
    const blazerM = mk(G.blazerShell, blazerCoatMat, tor, 0, -0.005, -0.004, 1.02, 0.99, 0.99, true);
    blazerM.castShadow = true;
    [-1, 1].forEach((sd) => {
      const lap = new THREE.Mesh(G.lapelGeo, shirt);
      lap.position.set(sd * 0.032, 0.34, 0.114);
      lap.rotation.set(-0.08, sd * 0.15, -sd * 0.12);
      lap.scale.set(sd, 1, 1);
      tor.add(lap);
      meshes.push(lap);
    });
  }

  // Tailored belt + metallic clasp
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.136, 0.013, 8, 20), P_LIB.belt);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.06, 0.78, 1);
  belt.position.set(0, 0.025, 0.006);
  tor.add(belt);
  mk(getRoundedBox(0.036, 0.024, 0.014, 0.004, 1), P_LIB.buckle, tor, 0, 0.025, 0.112, 1, 1, 1, false);

  // Neck + tailored V-collar points
  mk(G.neck, skin, tor, 0, 0.59, 0, 1, 1, 1, false);
  [-1, 1].forEach((sd) => {
    const tab = mk(G.collarTab, innerShirtMat, tor, sd * 0.034, 0.575, 0.044, 1, 1, 1, false);
    tab.rotation.set(0.55, sd * 0.42, -sd * 0.45);
  });

  // Lanyard & printed photo ID card resting on chest
  if (o.blazer || hs % 3 !== 0) {
    const l1 = mk(getRoundedBox(0.013, 0.21, 0.008, 0.003, 2), P_LIB.lanyard, tor, -0.044, 0.47, 0.112, 1, 1, 1, false);
    l1.rotation.set(-0.1, 0, 0.2);
    const l2 = mk(getRoundedBox(0.013, 0.21, 0.008, 0.003, 2), P_LIB.lanyard, tor, -0.082, 0.47, 0.105, 1, 1, 1, false);
    l2.rotation.set(-0.1, 0, -0.14);
    const card = mk(getRoundedBox(0.046, 0.066, 0.007, 0.003, 2), P_LIB.badge, tor, -0.066, 0.34, 0.128, 1, 1, 1, false);
    card.rotation.x = -0.06;
  }

  // Sculpted anatomical head + recessed lidded eyes + sculpted eyebrows & lips
  const head = P.head;
  head.position.set(0, 0.745, 0);
  tor.add(head);

  mk(G.head, skin, head, 0, 0, 0, 1, 1, 1, true);

  [1, -1].forEach((sx) => {
    // Eye sits naturally inside sculpted orbital socket
    const eye = new THREE.Group();
    eye.position.set(sx * 0.031, 0.038, 0.075);
    head.add(eye);
    P.eg.push(eye);

    mk(G.jointSph, P_LIB.white, eye, 0, 0, 0, 0.3, 0.18, 0.18, false);
    mk(G.jointSph, P_LIB.iris[hs % 4], eye, 0, 0, 0.0065, 0.145, 0.145, 0.08, false);
    mk(G.jointSph, P_LIB.dark, eye, 0, 0, 0.0085, 0.07, 0.07, 0.05, false);
    mk(G.jointSph, P_LIB.catchLight, eye, -0.003, 0.004, 0.01, 0.03, 0.03, 0.02, false);

    // Subtle upper eyelid cap so eyes look calm & natural rather than staring
    const lid = new THREE.Mesh(G.upperLid, skin);
    lid.position.set(0, 0.001, 0);
    lid.scale.set(1.06, 0.72, 0.75);
    lid.rotation.x = -0.35;
    eye.add(lid);

    // Curved anatomical brow arch
    const brow = new THREE.Mesh(G.browArc, hair);
    brow.position.set(sx * 0.031, 0.057, 0.083);
    brow.rotation.set(0.1, sx * 0.18, -sx * 0.08);
    head.add(brow);

    // Sculpted ears tucked naturally at sides of skull
    const ear = new THREE.Mesh(G.ear, skin);
    ear.position.set(sx * 0.081, 0.025, -0.008);
    ear.rotation.set(-0.1, sx * 0.25, -sx * 0.1);
    head.add(ear);
  });

  // Contoured upper & lower lips
  mk(G.lipUpper, lipMat, head, 0, -0.019, 0.086, 1, 1, 1, false);
  mk(G.lipLower, lipMat, head, 0, -0.027, 0.085, 1, 1, 1, false);

  // Optional stylish eyeglasses
  if (hasGlasses) {
    [-1, 1].forEach((sx) => {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.0022, 6, 16), P_LIB.glassesFrame);
      rim.position.set(sx * 0.031, 0.038, 0.094);
      rim.scale.set(1.15, 0.85, 1);
      head.add(rim);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.016, 12), P_LIB.glassesLens);
      lens.position.set(sx * 0.031, 0.038, 0.094);
      lens.scale.set(1.12, 0.82, 1);
      head.add(lens);
      const arm = new THREE.Mesh(getRoundedBox(0.0025, 0.003, 0.095, 0.001, 1), P_LIB.glassesFrame);
      arm.position.set(sx * 0.052, 0.041, 0.048);
      arm.rotation.y = sx * 0.22;
      head.add(arm);
    });
    const bridge = new THREE.Mesh(getRoundedBox(0.022, 0.0028, 0.0028, 0.001, 1), P_LIB.glassesFrame);
    bridge.position.set(0, 0.042, 0.095);
    head.add(bridge);
  }

  // Realistic scalp-hugging hairstyles (no giant floating spheres!)
  if (o.fem) {
    if (hs === 0 || hs === 3) {
      mk(G.hairShort, hair, head, 0, 0, 0, 1, 1, 1, false);
      for (let b = -3; b <= 3; b++) {
        const loc = new THREE.Mesh(G.locTube, hair);
        loc.position.set(b * 0.02, 0.02, -0.005);
        loc.rotation.y = b * 0.1;
        head.add(loc);
      }
    } else if (hs === 1) {
      mk(G.hairShort, hair, head, 0, 0, 0, 1, 1, 1, false);
      const bun = new THREE.Mesh(G.bunGeo, hair);
      bun.position.set(0, 0.145, -0.045);
      bun.rotation.x = -0.35;
      head.add(bun);
    } else if (hs === 2) {
      mk(G.hairBob, hair, head, 0, 0, 0, 1, 1, 1, false);
    } else {
      mk(G.hairShort, hair, head, 0, 0, 0, 1, 1, 1, false);
      const pony = new THREE.Mesh(G.ponytailGeo, hair);
      pony.position.set(0, 0, 0);
      head.add(pony);
    }
  } else {
    if (hs === 3) {
      mk(G.hairFull, hair, head, 0, 0, 0, 1, 1, 1, false);
    } else {
      mk(G.hairShort, hair, head, 0, 0, 0, 1, 1, 1, false);
      if (hs === 1) {
        // Subtle swept executive top lock
        const wave = mk(getRoundedBox(0.078, 0.028, 0.105, 0.012, 2), hair, head, 0.012, 0.132, 0.012, 1, 1, 1, false);
        wave.rotation.set(-0.08, 0.1, -0.14);
      }
      if (hs === 2) {
        // Contoured jawline beard hugging the chin
        mk(G.beardCap, hair, head, 0, 0, 0, 1, 1, 1, false);
      }
    }
  }

  // Sculpted shoulders, tailored sleeves, cuffs, wristwatch & anatomical hands
  [1, -1].forEach((sx, idxArm) => {
    const sh = new THREE.Group();
    sh.position.set(sx * 0.2, 0.53, 0);
    tor.add(sh);

    mk(G.jointSph, shirt, sh, 0, 0, 0, 1.12, 1.12, 1.1, false);
    mk(G.upperArm, shirt, sh, 0, 0, 0, 1, 1, 1, false);

    const el = new THREE.Group();
    el.position.y = -0.28;
    sh.add(el);

    const forearmMat = longSleeve ? shirt : skin;
    mk(G.jointSph, forearmMat, el, 0, 0, 0, 0.78, 0.78, 0.78, false);
    mk(G.forearm, forearmMat, el, 0, 0, 0, 1, 1, 1, false);

    if (hasBlazer) {
      // Crisp white dress shirt cuff peeking at wrist
      mk(G.cuffRing, P_LIB.white, el, 0, -0.262, 0, 0.94, 1, 0.94, false);
    } else if (longSleeve) {
      // Subtle buttoned sleeve cuff
      mk(G.cuffRing, shirt, el, 0, -0.258, 0, 1.02, 0.85, 1.02, false);
    }

    // Left wristwatch
    if (hasWatch && idxArm === 0) {
      mk(G.cuffRing, P_LIB.belt, el, 0, -0.242, 0, 0.96, 0.48, 0.96, false);
      mk(getRoundedBox(0.012, 0.018, 0.02, 0.004, 1), P_LIB.watchMat, el, 0.025, -0.242, 0, 1, 1, 1, false);
    }

    // Anatomical hand (mirror on opposite arm)
    const handM = mk(G.hand, skin, el, 0, -0.275, 0.006, sx, 1, 1, false);
    handM.rotation.z = sx * 0.06;

    P.sh.push(sh);
    P.el.push(el);
  });

  contact(g, 0, 0.006, 0, 0.74, 0.74, 0.5, M.textures.shadowTex);
  return P;
}

export function setPose(P: PersonActor, name: string, P_LIB: HumanPalette) {
  const G = initAnatomyGeos();
  P.pose = name;
  P.tgt = POSES[name] || POSES.stand;
  P.typing = name === 'type' || name === 'standType';
  P.swing = name === 'stand' || name === 'talk' || name === 'present' ? 1 : 0;

  if (name === 'hold' || name === 'sit' || name === 'carry') {
    if (!P.fp) {
      const geo = name === 'hold' ? G.phone : name === 'sit' ? G.laptop : G.boxProp;
      const mat = name === 'carry' ? P_LIB.boxProp : P_LIB.phone;
      P.fp = P.mk(geo, mat, P.tor, 0, 0, 0, 1, 1, 1, false);
    }
    if (name === 'hold') {
      P.fp.geometry = G.phone;
      P.fp.material = P_LIB.phone;
      P.fp.position.set(0, 0.38, 0.35);
      P.fp.rotation.x = -0.4;
    } else if (name === 'sit') {
      P.fp.geometry = G.laptop;
      P.fp.material = P_LIB.phone;
      P.fp.position.set(0, 0.05, 0.4);
      P.fp.rotation.x = 0;
    } else {
      P.fp.geometry = G.boxProp;
      P.fp.material = P_LIB.boxProp;
      P.fp.position.set(0, 0.22, 0.42);
      P.fp.rotation.x = 0;
    }
    P.fp.visible = true;
  } else if (P.fp) {
    P.fp.visible = false;
  }

  const ear = name === 'phone' || name === 'radio';
  if (ear && !P.pe) {
    P.pe = P.mk(G.phone, P_LIB.phone, P.el[1], 0, -0.29, 0.04, 1, 1, 1, false);
  }
  if (P.pe) P.pe.visible = ear;
}

export function createGuideActor(P_LIB: HumanPalette, M: MaterialLibrary): {
  actor: PersonActor;
  marker: THREE.Group;
  meshes: THREE.Mesh[];
} {
  const blazerMat = new THREE.MeshPhysicalMaterial({
    color: 0x26925c,
    normalMap: M.textures.fabricNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.78,
    metalness: 0,
    sheen: 0.65,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0x70e8a8),
    envMapIntensity: 0.25,
  });

  const actor = makePerson(
    {
      skin: P_LIB.skins[0],
      shirt: blazerMat,
      hair: P_LIB.hairs[0],
      trou: P_LIB.trous[0],
      s: 1.08,
      fem: true,
      hs: 1,
      sneakers: true,
      blazer: true,
    },
    P_LIB,
    M
  );

  // Floating nameplate & subtle emerald architectural locator diamond above Zuri
  const nm = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: plateTex('Zuri · Guide'),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
  );
  nm.scale.set(1.5, 0.225, 1);
  nm.position.set(0, 2.25, 0);
  actor.g.add(nm);

  const marker = new THREE.Group();
  marker.position.set(0, 2.65, 0);
  actor.g.add(marker);
  marker.add(
    new THREE.Mesh(
      new THREE.OctahedronGeometry(0.11),
      new THREE.MeshBasicMaterial({ color: 0x6fe3a1, toneMapped: false })
    )
  );
  const gl = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: M.textures.glowTex,
      color: 0x4fe38a,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  gl.scale.set(0.95, 0.95, 1);
  marker.add(gl);

  return { actor, marker, meshes: actor.meshes };
}

export function updatePersonKinematics(P: PersonActor, dt: number, t: number, glanceYaw: number) {
  const c = P.cur;
  const tg = P.tgt;
  const k = 1 - Math.exp(-dt * 5.5);
  for (let i = 0; i < JK.length; i++) {
    const q = JK[i];
    c[q] += (tg[q] - c[q]) * k;
  }

  let sw = 0;
  if (P.moving) {
    P.phase += dt * 7.6;
    sw = Math.sin(P.phase);
  }

  P.hip.position.y = c.hipY + (P.moving ? Math.abs(Math.sin(P.phase)) * 0.026 : Math.sin(t * 1.6 + P.phase) * 0.004);
  P.thigh[0].rotation.x = c.thigh + sw * 0.68;
  P.thigh[1].rotation.x = c.thigh - sw * 0.68;
  P.knee[0].rotation.x = c.knee + Math.max(0, -sw) * 0.78;
  P.knee[1].rotation.x = c.knee + Math.max(0, sw) * 0.78;
  P.tor.rotation.x = c.lean + Math.sin(t * 1.6 + P.phase) * 0.012;
  P.tor.rotation.y = sw * 0.11;
  P.tor.scale.y = 1 + Math.sin(t * 1.6 + P.phase) * 0.012;

  if (P.eg.length >= 2) {
    const bl = ((t * 0.3 + P.phase * 0.37) % 1) < 0.035 ? 0.12 : 1;
    P.eg[0].scale.y = bl;
    P.eg[1].scale.y = bl;
  }

  let hy = c.hy + P.look * Math.sin(t * 0.45 + P.phase);
  const hx = c.hx;
  const w = P.typing ? Math.sin(t * 13 + P.phase) * 0.05 : 0;
  let gx = 0;
  let ge = 0;
  if (P.gest && !P.moving) {
    gx = Math.sin(t * 2.3 + P.phase) * 0.25;
    ge = Math.sin(t * 3.1 + P.phase) * 0.3;
    hy += Math.sin(t * 1.3 + P.phase) * 0.2;
  }

  P.head.rotation.x = hx;
  P.head.rotation.y = hy + glanceYaw;
  P.head.rotation.z = P.asym * 0.08;
  P.sh[0].rotation.x = c.sLx - sw * 0.58 * P.swing;
  P.sh[0].rotation.z = c.sLz + P.asym * 0.03;
  P.sh[1].rotation.x = c.sRx + sw * 0.58 * P.swing + gx;
  P.sh[1].rotation.z = c.sRz + P.asym * 0.03;
  P.el[0].rotation.x = c.eL + w;
  P.el[1].rotation.x = c.eR - w + ge;

  let dy = P.tyaw - P.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  P.yaw += dy * (1 - Math.exp(-dt * 8.5));
  P.g.rotation.y = P.yaw;
}
