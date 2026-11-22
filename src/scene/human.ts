import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  build3DEyeballGeo,
  build3DEyelidGeo,
  buildContinuousArmGeo,
  buildContinuousLegGeo,
  buildContinuousTorsoPelvisGeo,
  buildPoolSlideStrapGeo,
  buildSculptedEarGeo,
  buildSculptedHandGeo,
  buildSculptedShoeGeo,
  buildSwimStrapsFemGeo,
  buildSwimTrunksLegGeo,
  buildSwimwearShellGeo,
  buildUnifiedHeadNeckGeo,
  normalizeForMerge,
  type DetailLevel,
} from './humanAnatomy';
import {
  buildContouredTieGeo,
  buildDrapedSkirtGeo,
  buildDressCollarGeo,
  buildFittedWaistBeltGeo,
  buildShirtCollarGeo,
  buildSleevelessShoulderCapGeo,
  buildTailoredBlazerOrCoatGeo,
} from './humanGarments';
import { buildSculptedBeardGeo, buildSculptedHairStyle, type BuiltHairParts } from './humanHair';
import type { CharacterBrain } from './characterMind';
import { getEyeIrisTexture, getHumanMicroMaps, getPhotorealFaceTexture } from './humanTextures';
import type { MaterialLibrary } from './materials';
import { contact, getRoundedBox } from './props';
import { DISTRICT_SOCIAL_DIRECTORY, socialNetwork } from './socialNetwork';
import { getMaxAnisotropy, makeCanvasTex, plateTex, rr } from './textures';

export type OutfitArchetype = 'suit' | 'dress' | 'blouseSkirt' | 'shirtTrousers' | 'smartCasual' | 'knit';
export type SleeveStyle = 'long' | 'rolled' | 'short' | 'sleeveless';
export type ShoeStyle = 'heel' | 'flat' | 'oxford' | 'sneaker';
export type HairStyleName = 'fade' | 'afro' | 'braids' | 'twists' | 'bun' | 'puff' | 'bob' | 'pixie';
export type BeardStyle = 'none' | 'stubble' | 'full';

/** Standard Mixamo/glTF Humanoid Bone Names (20 bones) */
export const BONE_NAMES = [
  'Hips', // 0
  'Spine', // 1
  'Spine1', // 2
  'Spine2', // 3
  'Neck', // 4
  'Head', // 5
  'LeftShoulder', // 6
  'LeftArm', // 7
  'LeftForeArm', // 8
  'LeftHand', // 9
  'RightShoulder', // 10
  'RightArm', // 11
  'RightForeArm', // 12
  'RightHand', // 13
  'LeftUpLeg', // 14
  'LeftLeg', // 15
  'LeftFoot', // 16
  'RightUpLeg', // 17
  'RightLeg', // 18
  'RightFoot', // 19
] as const;

export type BoneMap = Record<(typeof BONE_NAMES)[number], THREE.Bone>;

export interface PersonActor {
  g: THREE.Group;
  body: THREE.Group;
  hip: THREE.Group;
  bones: BoneMap;
  skeleton: THREE.Skeleton;
  skinnedMesh: THREE.SkinnedMesh;
  casualMesh?: THREE.SkinnedMesh;
  swimMesh?: THREE.SkinnedMesh;
  inSwimwear?: boolean;
  clips: THREE.AnimationClip[];
  thigh: THREE.Group[];
  knee: THREE.Group[];
  sh: THREE.Group[];
  el: THREE.Group[];
  eg: THREE.Group[];
  skirtGrp?: THREE.Group;
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
  peScreen: THREE.Mesh | null;
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
  brain?: CharacterBrain;
  shadow?: THREE.Mesh;
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

export const JK = [
  'hipY',
  'hipZ',
  'thigh',
  'knee',
  'lean',
  'spineTwist',
  'hx',
  'hy',
  'sLx',
  'sLz',
  'eL',
  'fLy',
  'hLz',
  'sRx',
  'sRz',
  'eR',
  'fRy',
  'hRz',
] as const;

export const SEATED_POSES: ReadonlySet<string> = new Set([
  'type',
  'sit',
  'sitTalk',
  'sitCollaborate',
  'meeting',
  'monitorLook',
  'sitReadDoc',
  'writeNotes',
  'think',
  'phone',
  'sitPhone',
  'leanScreen',
]);

export const POSES: Record<string, Record<string, number>> = {
  stand: {
    hipY: 0.9,
    hipZ: 0,
    thigh: 0,
    knee: 0,
    lean: 0.015,
    spineTwist: 0,
    hx: 0.02,
    hy: 0,
    sLx: 0.04,
    sLz: 0.055,
    eL: -0.22,
    fLy: 0,
    hLz: 0,
    sRx: 0.04,
    sRz: -0.055,
    eR: -0.22,
    fRy: 0,
    hRz: 0,
  },
};

const PZ = (o: Record<string, number>): Record<string, number> => ({ ...POSES.stand, ...o });

// Seated kinematics calibrated so soles rest flush at y=0.000, thighs sit squarely on cushions (~0.52m), knees clear under desks, and pronated hands/fingertips rest cleanly on top of keyboards/desktops
POSES.type = PZ({
  hipY: 0.562,
  hipZ: 0,
  thigh: -1.48,
  knee: 1.48,
  lean: 0.08,
  hx: 0.06,
  sLx: -0.61,
  sLz: -0.05,
  eL: -0.99,
  fLy: -1.36,
  hLz: 0.05,
  sRx: -0.61,
  sRz: 0.05,
  eR: -0.99,
  fRy: 1.36,
  hRz: -0.05,
});
POSES.sit = PZ({
  hipY: 0.562,
  hipZ: 0,
  thigh: -1.48,
  knee: 1.48,
  lean: 0.08,
  hx: 0.14,
  sLx: -0.61,
  sLz: -0.05,
  eL: -0.99,
  fLy: -1.36,
  hLz: 0.05,
  sRx: -0.61,
  sRz: 0.05,
  eR: -0.99,
  fRy: 1.36,
  hRz: -0.05,
});
POSES.present = PZ({ sRx: -1.26, sRz: -0.22, eR: -0.28, fRy: 0.55, sLx: -0.42, eL: -0.88, hy: -0.2, spineTwist: -0.1 });
POSES.talk = PZ({ sRx: -0.68, eR: -1.02, fRy: 0.45, sLx: -0.2, eL: -0.64, hy: 0.16, spineTwist: 0.08 });
POSES.sitTalk = {
  ...POSES.talk,
  hipY: 0.562,
  hipZ: 0,
  thigh: -1.48,
  knee: 1.48,
  lean: 0.04,
  sLx: -0.6,
  sLz: -0.05,
  eL: -0.98,
  fLy: -1.34,
  hLz: 0.04,
  sRx: -0.78,
  eR: -0.96,
};
POSES.sitCollaborate = PZ({
  hipY: 0.562,
  hipZ: 0,
  thigh: -1.48,
  knee: 1.48,
  lean: 0.07,
  spineTwist: -0.16,
  hy: -0.18,
  sLx: -0.62,
  sLz: -0.04,
  eL: -0.96,
  fLy: -1.34,
  hLz: 0.04,
  sRx: -0.78,
  sRz: 0.08,
  eR: -0.94,
  fRy: 0.62,
});
POSES.meeting = PZ({
  hipY: 0.562,
  hipZ: 0,
  thigh: -1.48,
  knee: 1.48,
  lean: 0.06,
  hx: 0.06,
  hy: 0.1,
  sLx: -0.6,
  sLz: -0.06,
  eL: -0.96,
  fLy: -1.34,
  hLz: 0.05,
  sRx: -0.6,
  sRz: 0.06,
  eR: -0.96,
  fRy: 1.34,
  hRz: -0.05,
});
POSES.monitorLook = PZ({
  hipY: 0.562,
  hipZ: 0,
  thigh: -1.48,
  knee: 1.48,
  lean: 0.05,
  hx: -0.04,
  sLx: -0.6,
  sLz: -0.04,
  eL: -0.96,
  fLy: -1.36,
  hLz: 0.04,
  sRx: -0.6,
  sRz: 0.04,
  eR: -0.96,
  fRy: 1.36,
  hRz: -0.04,
});
POSES.hold = PZ({
  sLx: -0.34,
  sLz: 0.04,
  eL: -0.58,
  fLy: -0.25,
  sRx: -0.78,
  sRz: 0.14,
  eR: -1.16,
  fRy: 0.65,
  hx: 0.26,
  hy: -0.06,
});
POSES.walk = PZ({ lean: 0.04, hx: 0.02, sLx: 0.04, sLz: 0.055, eL: -0.24, sRx: 0.04, sRz: -0.055, eR: -0.24 });
POSES.swim = PZ({
  hipY: 0.05,
  hipZ: 0,
  thigh: 0.08,
  knee: 0.16,
  lean: 0.02,
  hx: -0.58,
  sLx: -Math.PI * 0.42,
  sLz: 0.22,
  eL: -0.28,
  sRx: -Math.PI * 0.42,
  sRz: -0.22,
  eR: -0.28,
});
POSES.readDoc = PZ({
  lean: 0.04,
  hx: 0.26,
  sLx: -0.74,
  sLz: -0.14,
  eL: -1.1,
  fLy: -0.35,
  sRx: -0.74,
  sRz: 0.14,
  eR: -1.1,
  fRy: 0.35,
});
POSES.sitReadDoc = {
  ...POSES.readDoc,
  hipY: 0.562,
  hipZ: 0,
  thigh: -1.48,
  knee: 1.48,
};
POSES.writeNotes = PZ({
  hipY: 0.562,
  hipZ: 0,
  thigh: -1.48,
  knee: 1.48,
  lean: 0.12,
  hx: 0.2,
  sLx: -0.65,
  sLz: -0.06,
  eL: -0.97,
  fLy: -1.36,
  hLz: 0.05,
  sRx: -0.68,
  sRz: 0.06,
  eR: -0.97,
  fRy: 1.32,
  hRz: -0.05,
});
POSES.think = PZ({
  hipY: 0.562,
  hipZ: 0,
  thigh: -1.48,
  knee: 1.48,
  lean: 0.06,
  hx: 0.08,
  hy: -0.12,
  sLx: -0.6,
  sLz: -0.04,
  eL: -0.96,
  fLy: -1.34,
  hLz: 0.04,
  sRx: -1.32,
  sRz: 0.18,
  eR: -1.94,
  fRy: 0.25,
});
// Seated desk phone call
POSES.phone = { ...POSES.type, sRx: -1.46, sRz: 0.1, eR: -2.14, fRy: 0.15, hRz: 0, hx: -0.02, hy: 0.14 };
// Seated smartphone check / SwiftChat & HubPulse mobile dispatch at desk
POSES.sitPhone = {
  ...POSES.type,
  hx: 0.22,
  hy: -0.06,
  sLx: -0.6,
  sLz: -0.04,
  eL: -0.96,
  fLy: -1.34,
  hLz: 0.04,
  sRx: -0.78,
  sRz: 0.14,
  eR: -1.16,
  fRy: 0.65,
  hRz: 0,
};
// Standing mobile phone call (never bends legs into empty air)
POSES.standPhone = PZ({ sRx: -1.46, sRz: 0.1, eR: -2.14, fRy: 0.15, hx: -0.02, hy: 0.14 });
POSES.collaborate = PZ({
  lean: 0.08,
  spineTwist: -0.18,
  hy: -0.2,
  sLx: -0.4,
  eL: -0.72,
  sRx: -0.88,
  sRz: -0.14,
  eR: -0.86,
  fRy: 0.42,
});
POSES.leanScreen = PZ({
  hipY: 0.562,
  hipZ: 0,
  thigh: -1.48,
  knee: 1.48,
  lean: 0.14,
  hx: -0.08,
  sLx: -0.67,
  sLz: -0.05,
  eL: -0.98,
  fLy: -1.36,
  hLz: 0.05,
  sRx: -0.67,
  sRz: 0.05,
  eR: -0.98,
  fRy: 1.36,
  hRz: -0.05,
});
// Standing equipment/panel pointing (never bends knees into invisible chair)
POSES.point = PZ({ lean: 0.08, sRx: -1.35, sRz: -0.06, eR: -0.28, fRy: 0.25, hx: -0.04, hy: -0.06 });
// Standing counter typing at high reception desk (~1.10-1.14m)
POSES.standType = PZ({
  lean: 0.06,
  hx: 0.14,
  sLx: -0.52,
  sLz: -0.04,
  eL: -1.04,
  fLy: -1.36,
  hLz: 0.07,
  sRx: -0.52,
  sRz: 0.04,
  eR: -1.04,
  fRy: 1.36,
  hRz: -0.07,
});
// Standing counter work at ~1.01-1.08m (Espresso bar, Pharmacy, Kitchen pass)
POSES.standCounter = PZ({
  lean: 0.06,
  hx: 0.18,
  sLx: -0.44,
  sLz: -0.04,
  eL: -0.96,
  fLy: -1.32,
  hLz: 0.05,
  sRx: -0.44,
  sRz: 0.04,
  eR: -0.96,
  fRy: 1.32,
  hRz: -0.05,
});
// Standing low workbench / service trolley (~0.88m)
POSES.standLowCounter = PZ({
  lean: 0.12,
  hx: 0.24,
  sLx: -0.46,
  sLz: -0.04,
  eL: -0.62,
  fLy: -1.28,
  hLz: 0.04,
  sRx: -0.46,
  sRz: 0.04,
  eR: -0.62,
  fRy: 1.28,
  hRz: -0.04,
});
// Standing equipment panel inspection with right hand touching rack/cabinet faceplate (~1.32m)
POSES.inspectPanel = PZ({
  lean: 0.05,
  hx: 0.04,
  sLx: -0.34,
  sLz: 0.04,
  eL: -0.58,
  fLy: -0.25,
  sRx: -0.88,
  sRz: 0.03,
  eR: -0.88,
  fRy: 0.35,
});
POSES.coffee = PZ({ sRx: -0.68, eR: -0.96, fRy: 0.35, sLx: 0.06, eL: -0.3, sRz: -0.05, sLz: 0.06, hx: 0.04, hy: -0.1 });
POSES.carry = PZ({ lean: 0.06, sLx: -0.84, eL: -0.58, sRx: -0.84, eR: -0.58, sLz: -0.06, sRz: 0.06, fLy: -0.25, fRy: 0.25, hx: 0.14 });
POSES.radio = PZ({ sRx: -1.44, sRz: 0.1, eR: -2.14, fRy: 0.12, hx: -0.04, hy: 0.1 });

export const OFFICE_POSES_CATALOG: Array<{ key: string; label: string; description: string }> = [
  { key: 'type', label: '01 · Typing at Desk', description: 'Seated posture typing at office keyboard' },
  { key: 'sit', label: '02 · Laptop Work', description: 'Ergonomic chair working with laptop' },
  { key: 'present', label: '03 · Presenting Project', description: 'Standing open gesture presenting to team' },
  { key: 'talk', label: '04 · Talking to Colleague', description: 'Natural conversational standing posture' },
  { key: 'meeting', label: '05 · Conference Meeting', description: 'Seated upright around executive table' },
  { key: 'monitorLook', label: '06 · Looking at Monitor', description: 'Focused screen inspection at workstation' },
  { key: 'hold', label: '07 · Holding Smartphone', description: 'Standing & reviewing mobile app/messages' },
  { key: 'walk', label: '08 · Walking Corridor', description: 'Animated natural stride through office' },
  { key: 'readDoc', label: '09 · Reading Documents', description: 'Reviewing printed briefs & reports' },
  { key: 'writeNotes', label: '10 · Writing Notes', description: 'Taking notes in notebook at desk' },
  { key: 'think', label: '11 · Thinking at Desk', description: 'Contemplative hand-to-chin seated pose' },
  { key: 'phone', label: '12 · Telephone Call', description: 'Speaking on mobile call at desk' },
  { key: 'sitPhone', label: '13 · Smartphone Messaging', description: 'Sending SwiftChat & HubPulse tasks at desk' },
  { key: 'collaborate', label: '14 · Collaborating', description: 'Interactive discussion angled toward peer' },
  { key: 'leanScreen', label: '15 · Leaning to Screen', description: 'Leaning closer to examine workstation detail' },
  { key: 'stand', label: '16 · Relaxed Standing', description: 'Contrapposto weight distribution stance' },
];

export const MODES: Record<string, Array<[string, number]>> = {
  def: [
    ['type', 0.36],
    ['monitorLook', 0.18],
    ['leanScreen', 0.12],
    ['sitPhone', 0.14],
    ['writeNotes', 0.1],
    ['think', 0.05],
    ['phone', 0.05],
  ],
  wa: [
    ['type', 0.28],
    ['sitPhone', 0.28],
    ['phone', 0.24],
    ['monitorLook', 0.12],
    ['think', 0.08],
  ],
  ppc: [
    ['type', 0.38],
    ['leanScreen', 0.18],
    ['sitPhone', 0.16],
    ['phone', 0.14],
    ['writeNotes', 0.14],
  ],
  hand: [
    ['type', 0.3],
    ['sitPhone', 0.25],
    ['phone', 0.2],
    ['think', 0.12],
    ['writeNotes', 0.13],
  ],
  crm: [
    ['type', 0.4],
    ['monitorLook', 0.2],
    ['sitPhone', 0.16],
    ['phone', 0.12],
    ['leanScreen', 0.12],
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

/* =========================================================
   SKINNING WEIGHT SOLVERS
   ========================================================= */

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

type BoneWeightResult = [number, number, number, number, number, number, number, number];

function prepareSkinnedPart(
  srcGeo: THREE.BufferGeometry,
  weightFn: (x: number, y: number, z: number) => BoneWeightResult
): THREE.BufferGeometry {
  const g = normalizeForMerge(srcGeo);
  const pos = g.attributes.position;
  const count = pos.count;

  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const res = weightFn(pos.getX(i), pos.getY(i), pos.getZ(i));
    const sum = res[4] + res[5] + res[6] + res[7] || 1;
    skinIndices[i * 4] = res[0];
    skinIndices[i * 4 + 1] = res[1];
    skinIndices[i * 4 + 2] = res[2];
    skinIndices[i * 4 + 3] = res[3];
    skinWeights[i * 4] = res[4] / sum;
    skinWeights[i * 4 + 1] = res[5] / sum;
    skinWeights[i * 4 + 2] = res[6] / sum;
    skinWeights[i * 4 + 3] = res[7] / sum;
  }

  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  return g;
}

function weightTorsoSpine(y: number): BoneWeightResult {
  if (y < 0.96) {
    const k = smoothstep(0.88, 0.96, y);
    return [0, 1, 0, 0, 1 - k, k, 0, 0];
  }
  if (y < 1.1) {
    const k = smoothstep(0.96, 1.1, y);
    return [1, 2, 0, 0, 1 - k, k, 0, 0];
  }
  if (y < 1.26) {
    const k = smoothstep(1.1, 1.26, y);
    return [2, 3, 0, 0, 1 - k, k, 0, 0];
  }
  if (y < 1.46) {
    const k = smoothstep(1.4, 1.46, y);
    return [3, 4, 0, 0, 1 - k, k, 0, 0];
  }
  if (y < 1.55) {
    const k = smoothstep(1.47, 1.55, y);
    return [4, 5, 0, 0, 1 - k, k, 0, 0];
  }
  return [5, 0, 0, 0, 1, 0, 0, 0];
}

function weightLeg(sideLeft: boolean, y: number): BoneWeightResult {
  const upLeg = sideLeft ? 14 : 17;
  const leg = sideLeft ? 15 : 18;
  const foot = sideLeft ? 16 : 19;
  if (y > 0.84) {
    const k = smoothstep(0.84, 0.9, y);
    return [upLeg, 0, 0, 0, 1 - k * 0.45, k * 0.45, 0, 0];
  }
  if (y > 0.4 && y < 0.52) {
    const k = smoothstep(0.52, 0.4, y);
    return [upLeg, leg, 0, 0, 1 - k, k, 0, 0];
  }
  if (y >= 0.52) return [upLeg, 0, 0, 0, 1, 0, 0, 0];
  if (y > 0.08 && y < 0.16) {
    const k = smoothstep(0.16, 0.08, y);
    return [leg, foot, 0, 0, 1 - k, k, 0, 0];
  }
  if (y <= 0.08) return [foot, 0, 0, 0, 1, 0, 0, 0];
  return [leg, 0, 0, 0, 1, 0, 0, 0];
}

function weightArm(sideLeft: boolean, x: number, y: number, shoulderX: number): BoneWeightResult {
  const sh = sideLeft ? 6 : 10;
  const arm = sideLeft ? 7 : 11;
  const fore = sideLeft ? 8 : 12;
  const hand = sideLeft ? 9 : 13;

  const inward = Math.max(0, shoulderX - Math.abs(x));
  if (y > 1.32 && inward > 0.008) {
    // Inner deltoid socket blends smoothly into shoulder/torso so shoulder swings without shearing open
    const kSh = THREE.MathUtils.clamp((inward - 0.008) / 0.036, 0, 1) * smoothstep(1.32, 1.41, y);
    const wSpine = kSh * 0.45;
    const wSh = kSh * 0.35;
    const wArm = Math.max(0.15, 1 - wSpine - wSh);
    return [arm, sh, 3, 0, wArm, wSh, wSpine, 0];
  }
  if (y > 1.105 && y < 1.195) {
    const k = smoothstep(1.195, 1.105, y);
    return [arm, fore, 0, 0, 1 - k, k, 0, 0];
  }
  if (y >= 1.195) return [arm, 0, 0, 0, 1, 0, 0, 0];
  if (y > 0.88 && y < 0.93) {
    const k = smoothstep(0.93, 0.88, y);
    return [fore, hand, 0, 0, 1 - k, k, 0, 0];
  }
  if (y <= 0.88) return [hand, 0, 0, 0, 1, 0, 0, 0];
  return [fore, 0, 0, 0, 1, 0, 0, 0];
}

function weightSkirt(x: number, y: number, z: number): BoneWeightResult {
  // Transition front/sides into UpLeg by y=0.81 (where legBare is 100% UpLeg) so LBS never collapses skirt inside thigh,
  // while back/glute region anchors smoothly down onto the seat cushion (y=0.87 -> 0.72).
  const yStart = z >= -0.025 ? 0.945 : 0.87;
  const yEnd = z >= -0.025 ? 0.81 : 0.72;
  if (y >= yStart) return [0, 0, 0, 0, 1, 0, 0, 0];
  const legW = 0.99 * smoothstep(yStart, yEnd, y);
  const hipW = 1 - legW;
  const sideBias = THREE.MathUtils.clamp(x / 0.12, -1, 1);
  const lW = legW * (0.5 + sideBias * 0.45);
  const rW = legW - lW;
  return [0, 14, 17, 0, hipW, lW, rW, 0];
}

function latheFromProfile(pts: Array<[number, number]>, segs = 14): THREE.LatheGeometry {
  const curve = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(Math.max(0.001, x), y)));
  return new THREE.LatheGeometry(curve.getPoints(16), segs);
}

/**
 * Mirrors geometry across X while reversing triangle winding so normals stay outward-facing.
 */
function mirrorGeometryX(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.scale(-1, 1, 1);
  if (geo.index) {
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const tmp = idx[i + 1];
      (idx as number[] | Uint16Array | Uint32Array)[i + 1] = idx[i + 2];
      (idx as number[] | Uint16Array | Uint32Array)[i + 2] = tmp;
    }
    geo.index.needsUpdate = true;
    geo.computeVertexNormals();
  } else {
    for (const key of Object.keys(geo.attributes)) {
      const attr = geo.attributes[key] as THREE.BufferAttribute;
      const itemSize = attr.itemSize;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < attr.count; i += 3) {
        const b = (i + 1) * itemSize;
        const c = (i + 2) * itemSize;
        for (let k = 0; k < itemSize; k++) {
          const tmp = arr[b + k];
          arr[b + k] = arr[c + k];
          arr[c + k] = tmp;
        }
      }
      attr.needsUpdate = true;
    }
  }
  return geo;
}

/* =========================================================
   SHARED STATIC GEOMETRY CACHE PER DETAIL TIER
   ========================================================= */
interface AnatomyGeos {
  torsoMale: THREE.BufferGeometry;
  torsoFem: THREE.BufferGeometry;
  torsoFemDress: THREE.BufferGeometry;
  torsoKnitMale: THREE.BufferGeometry;
  torsoKnitFem: THREE.BufferGeometry;
  blazerMale: THREE.BufferGeometry;
  blazerFem: THREE.BufferGeometry;
  coatMale: THREE.BufferGeometry;
  coatFem: THREE.BufferGeometry;
  skirtShort: THREE.BufferGeometry;
  skirtMidi: THREE.BufferGeometry;
  dressSkirtShort: THREE.BufferGeometry;
  dressSkirtMidi: THREE.BufferGeometry;
  sleevelessCapFem: THREE.BufferGeometry;
  sleevelessCapMale: THREE.BufferGeometry;
  legBare: THREE.BufferGeometry;
  legTrouser: THREE.BufferGeometry;
  armFullBare: THREE.BufferGeometry;
  armFullSleeve: THREE.BufferGeometry;
  armShortSleeve: THREE.BufferGeometry;
  armShortBare: THREE.BufferGeometry;
  armRolledUpper: THREE.BufferGeometry;
  armRolledBare: THREE.BufferGeometry;
  handSkin: THREE.BufferGeometry;
  handNails: THREE.BufferGeometry;
  heelSole: THREE.BufferGeometry;
  heelUpper: THREE.BufferGeometry;
  heelInstep?: THREE.BufferGeometry;
  flatSole: THREE.BufferGeometry;
  flatUpper: THREE.BufferGeometry;
  flatInstep?: THREE.BufferGeometry;
  oxfordSole: THREE.BufferGeometry;
  oxfordUpper: THREE.BufferGeometry;
  sneakerSole: THREE.BufferGeometry;
  sneakerUpper: THREE.BufferGeometry;
  headsMale: THREE.BufferGeometry[];
  headsFem: THREE.BufferGeometry[];
  eyeball: THREE.BufferGeometry;
  upperLidMale: THREE.BufferGeometry;
  upperLidFem: THREE.BufferGeometry;
  lowerLidMale: THREE.BufferGeometry;
  lowerLidFem: THREE.BufferGeometry;
  earLeft: THREE.BufferGeometry;
  earRight: THREE.BufferGeometry;
  hairMale: Record<HairStyleName, BuiltHairParts>;
  hairFem: Record<HairStyleName, BuiltHairParts>;
  beardFull: THREE.BufferGeometry | null;
  shirtCollarMale: THREE.BufferGeometry;
  shirtCollarFem: THREE.BufferGeometry;
  dressCollarMale: THREE.BufferGeometry;
  dressCollarFem: THREE.BufferGeometry;
  tieBladeMale: THREE.BufferGeometry;
  tieBladeFem: THREE.BufferGeometry;
  ribCollar: THREE.TorusGeometry;
  ribHem: THREE.TorusGeometry;
  pocketSquare: THREE.BufferGeometry;
  buttonDot: THREE.CylinderGeometry;
  glassesFrames: THREE.BufferGeometry;
  glassesLenses: THREE.BufferGeometry;
  earringStud: THREE.SphereGeometry;
  headphoneBand: THREE.TorusGeometry;
  headphoneCup: THREE.CylinderGeometry;
  dressBeltBand: THREE.BufferGeometry;
  dressBeltBuckle: THREE.BufferGeometry;
  trouserBeltFemBand: THREE.BufferGeometry;
  trouserBeltFemBuckle: THREE.BufferGeometry;
  trouserBeltMaleBand: THREE.BufferGeometry;
  trouserBeltMaleBuckle: THREE.BufferGeometry;
  lanyardStrap: THREE.BufferGeometry;
  badgeCard: THREE.BufferGeometry;
  watchStrap: THREE.CylinderGeometry;
  watchFace: THREE.BufferGeometry;
  phone: THREE.BufferGeometry;
  phoneScreenFace: THREE.BufferGeometry;
  laptop: THREE.BufferGeometry;
  boxProp: THREE.BufferGeometry;
  mugGeo: THREE.LatheGeometry;
  folderGeo: THREE.BufferGeometry;
  notebookGeo: THREE.BufferGeometry;
  hardHatDome: THREE.BufferGeometry;
  hardHatBrim: THREE.BufferGeometry;
  hardHatRidge: THREE.BufferGeometry;
  swimOnePieceFem: THREE.BufferGeometry;
  swimStrapsFem: THREE.BufferGeometry;
  swimTrunksBandMale: THREE.BufferGeometry;
  swimTrunksLeg: THREE.BufferGeometry;
  slideStrap: THREE.BufferGeometry;
}

const ANAT_CACHE: Partial<Record<DetailLevel, AnatomyGeos>> = {};

function markShared<T extends THREE.BufferGeometry>(g: T): T {
  g.userData.shared = true;
  return g;
}

function buildSleekGlassesGeo(): { frames: THREE.BufferGeometry; lenses: THREE.BufferGeometry } {
  const frameParts: THREE.BufferGeometry[] = [];
  const lensParts: THREE.BufferGeometry[] = [];
  const eyeX = 0.0255;
  const eyeY = 1.656;
  const eyeZ = 0.0895;

  for (const sx of [-1, 1]) {
    // Contoured sleek optical frame rim sitting forward of orbital brow & nasal bridge
    const pts: THREE.Vector3[] = [];
    const rw = 0.0155;
    const rh = 0.01;
    const segs = 20;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      const sqx = Math.sign(cosA) * Math.pow(Math.abs(cosA), 0.72) * rw;
      const sqy = Math.sign(sinA) * Math.pow(Math.abs(sinA), 0.78) * rh;
      const zCurve = -Math.abs(sqx) * 0.16;
      pts.push(new THREE.Vector3(sx * eyeX + sqx, eyeY + sqy, eyeZ + zCurve));
    }
    const rimTube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 24, 0.0014, 6, true);
    frameParts.push(normalizeForMerge(rimTube));

    const lens = new THREE.CircleGeometry(0.014, 16);
    lens.scale(1.06, 0.68, 1);
    lens.translate(sx * eyeX, eyeY, eyeZ - 0.0012);
    lensParts.push(normalizeForMerge(lens));

    // Sleek temple arm running smoothly horizontal over top of ear helix (y=1.662) with gentle behind-ear drop
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * (eyeX + rw), eyeY + 0.0045, eyeZ - 0.002),
      new THREE.Vector3(sx * 0.059, eyeY + 0.0052, 0.052),
      new THREE.Vector3(sx * 0.0685, eyeY + 0.0045, -0.002),
      new THREE.Vector3(sx * 0.0675, eyeY - 0.003, -0.019),
      new THREE.Vector3(sx * 0.066, eyeY - 0.015, -0.025),
    ]);
    const armTube = new THREE.TubeGeometry(armCurve, 14, 0.0014, 6, false);
    frameParts.push(normalizeForMerge(armTube));
  }

  // Contoured nose bridge clearing nasal dorsum cleanly
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.01, eyeY + 0.0025, eyeZ),
    new THREE.Vector3(0, eyeY + 0.0055, eyeZ + 0.0045),
    new THREE.Vector3(0.01, eyeY + 0.0025, eyeZ),
  ]);
  frameParts.push(normalizeForMerge(new THREE.TubeGeometry(bridgeCurve, 8, 0.0014, 6, false)));

  const frames = mergeGeometries(frameParts, false);
  const lenses = mergeGeometries(lensParts, false);
  frameParts.forEach((p) => p.dispose());
  lensParts.forEach((p) => p.dispose());
  return { frames, lenses };
}

function initAnatomyGeos(detail: DetailLevel = 'office'): AnatomyGeos {
  const existing = ANAT_CACHE[detail];
  if (existing) return existing;

  const heel = buildSculptedShoeGeo('heel', detail);
  const flat = buildSculptedShoeGeo('flat', detail);
  const oxford = buildSculptedShoeGeo('oxford', detail);
  const sneaker = buildSculptedShoeGeo('sneaker', detail);
  const hand = buildSculptedHandGeo(detail);
  const glasses = buildSleekGlassesGeo();
  const dressBelt = buildFittedWaistBeltGeo(true, 1.078, 0.014, 0.0125);
  const trouserBeltFem = buildFittedWaistBeltGeo(true, 0.916, 0.014, 0.0115);
  const trouserBeltMale = buildFittedWaistBeltGeo(false, 0.916, 0.015, 0.0115);

  const hairNames: HairStyleName[] = ['fade', 'afro', 'braids', 'twists', 'bun', 'puff', 'bob', 'pixie'];
  const hairMale = {} as Record<HairStyleName, BuiltHairParts>;
  const hairFem = {} as Record<HairStyleName, BuiltHairParts>;
  for (const hName of hairNames) {
    hairMale[hName] = buildSculptedHairStyle(hName, false, detail);
    hairFem[hName] = buildSculptedHairStyle(hName, true, detail);
  }

  const built: AnatomyGeos = {
    torsoMale: buildContinuousTorsoPelvisGeo(false, false, false, detail),
    torsoFem: buildContinuousTorsoPelvisGeo(true, false, false, detail),
    torsoFemDress: buildContinuousTorsoPelvisGeo(true, true, false, detail),
    torsoKnitMale: buildContinuousTorsoPelvisGeo(false, false, true, detail),
    torsoKnitFem: buildContinuousTorsoPelvisGeo(true, false, true, detail),
    blazerMale: buildTailoredBlazerOrCoatGeo(false, false, detail),
    blazerFem: buildTailoredBlazerOrCoatGeo(true, false, detail),
    coatMale: buildTailoredBlazerOrCoatGeo(false, true, detail),
    coatFem: buildTailoredBlazerOrCoatGeo(true, true, detail),
    skirtShort: buildDrapedSkirtGeo('short', true, detail, false),
    skirtMidi: buildDrapedSkirtGeo('midi', true, detail, false),
    dressSkirtShort: buildDrapedSkirtGeo('short', true, detail, true),
    dressSkirtMidi: buildDrapedSkirtGeo('midi', true, detail, true),
    sleevelessCapFem: buildSleevelessShoulderCapGeo(true),
    sleevelessCapMale: buildSleevelessShoulderCapGeo(false),
    legBare: buildContinuousLegGeo(false, detail),
    legTrouser: buildContinuousLegGeo(true, detail),
    armFullBare: buildContinuousArmGeo(1.445, 0.91, 'bare', detail),
    armFullSleeve: buildContinuousArmGeo(1.445, 0.91, 'sleeve', detail),
    armShortSleeve: buildContinuousArmGeo(1.445, 1.295, 'shortSleeve', detail),
    armShortBare: buildContinuousArmGeo(1.295, 0.91, 'bare', detail),
    armRolledUpper: buildContinuousArmGeo(1.445, 1.055, 'rolledUpper', detail),
    armRolledBare: buildContinuousArmGeo(1.055, 0.91, 'forearmBare', detail),
    handSkin: hand.skin,
    handNails: hand.nails,
    heelSole: heel.sole,
    heelUpper: heel.upper,
    heelInstep: heel.instep,
    flatSole: flat.sole,
    flatUpper: flat.upper,
    flatInstep: flat.instep,
    oxfordSole: oxford.sole,
    oxfordUpper: oxford.upper,
    sneakerSole: sneaker.sole,
    sneakerUpper: sneaker.upper,
    headsMale: [0, 1, 2, 3].map((v) => buildUnifiedHeadNeckGeo(false, v, detail)),
    headsFem: [0, 1, 2, 3].map((v) => buildUnifiedHeadNeckGeo(true, v, detail)),
    eyeball: build3DEyeballGeo(0.0114, detail),
    upperLidMale: markShared(build3DEyelidGeo(true, false, detail)),
    upperLidFem: markShared(build3DEyelidGeo(true, true, detail)),
    lowerLidMale: build3DEyelidGeo(false, false, detail),
    lowerLidFem: build3DEyelidGeo(false, true, detail),
    earLeft: buildSculptedEarGeo(false, detail),
    earRight: buildSculptedEarGeo(true, detail),
    hairMale,
    hairFem,
    beardFull: buildSculptedBeardGeo('full', detail),
    shirtCollarMale: buildShirtCollarGeo(false),
    shirtCollarFem: buildShirtCollarGeo(true),
    dressCollarMale: buildDressCollarGeo(false),
    dressCollarFem: buildDressCollarGeo(true),
    tieBladeMale: buildContouredTieGeo(false),
    tieBladeFem: buildContouredTieGeo(true),
    ribCollar: new THREE.TorusGeometry(0.054, 0.011, 8, 20),
    ribHem: new THREE.TorusGeometry(0.145, 0.011, 8, 24),
    pocketSquare: getRoundedBox(0.028, 0.014, 0.006, 0.001, 1),
    buttonDot: new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 8),
    glassesFrames: glasses.frames,
    glassesLenses: glasses.lenses,
    earringStud: new THREE.SphereGeometry(0.0036, 10, 8),
    headphoneBand: new THREE.TorusGeometry(0.088, 0.007, 8, 22, Math.PI * 1.08),
    headphoneCup: new THREE.CylinderGeometry(0.028, 0.028, 0.018, 16),
    dressBeltBand: dressBelt.band,
    dressBeltBuckle: dressBelt.buckle,
    trouserBeltFemBand: trouserBeltFem.band,
    trouserBeltFemBuckle: trouserBeltFem.buckle,
    trouserBeltMaleBand: trouserBeltMale.band,
    trouserBeltMaleBuckle: trouserBeltMale.buckle,
    lanyardStrap: getRoundedBox(0.005, 0.19, 0.003, 0.001, 1),
    badgeCard: getRoundedBox(0.036, 0.052, 0.004, 0.002, 1),
    watchStrap: new THREE.CylinderGeometry(0.024, 0.025, 0.014, 12),
    watchFace: getRoundedBox(0.01, 0.016, 0.018, 0.003, 1),
    phone: markShared(getRoundedBox(0.072, 0.142, 0.008, 0.0035, 2)),
    phoneScreenFace: markShared(new THREE.PlaneGeometry(0.062, 0.126)),
    laptop: markShared(getRoundedBox(0.28, 0.016, 0.2, 0.005, 2)),
    boxProp: markShared(getRoundedBox(0.36, 0.26, 0.3, 0.025, 2)),
    mugGeo: markShared(
      latheFromProfile(
        [
          [0.001, 0],
          [0.034, 0],
          [0.038, 0.085],
          [0.034, 0.09],
          [0.03, 0.015],
          [0.001, 0.015],
        ],
        12
      )
    ),
    folderGeo: markShared(getRoundedBox(0.22, 0.29, 0.014, 0.004, 2)),
    notebookGeo: markShared(getRoundedBox(0.19, 0.012, 0.25, 0.004, 2)),
    hardHatDome: latheFromProfile(
      [
        [0.001, 0.006],
        [0.088, 0.006],
        [0.108, 0.002],
        [0.114, 0.014],
        [0.105, 0.045],
        [0.088, 0.074],
        [0.056, 0.092],
        [0.001, 0.098],
      ],
      20
    ),
    hardHatBrim: getRoundedBox(0.138, 0.012, 0.068, 0.004, 2),
    hardHatRidge: getRoundedBox(0.024, 0.018, 0.165, 0.005, 2),
    swimOnePieceFem: buildSwimwearShellGeo(true, detail),
    swimStrapsFem: buildSwimStrapsFemGeo(),
    swimTrunksBandMale: buildSwimwearShellGeo(false, detail),
    swimTrunksLeg: buildSwimTrunksLegGeo(detail),
    slideStrap: buildPoolSlideStrapGeo(),
  };

  ANAT_CACHE[detail] = built;
  return built;
}

/* =========================================================
   PALETTE & PBR MATERIAL FACTORY
   ========================================================= */
export interface HumanPalette {
  skins: THREE.MeshStandardMaterial[];
  skinHexes: number[];
  shirts: THREE.MeshStandardMaterial[];
  knits: THREE.MeshStandardMaterial[];
  hairs: THREE.MeshStandardMaterial[];
  hairHexes: number[];
  trous: THREE.MeshStandardMaterial[];
  white: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  lips: THREE.MeshStandardMaterial;
  shoe: THREE.MeshStandardMaterial;
  shoeBrown: THREE.MeshStandardMaterial;
  shoeNude: THREE.MeshStandardMaterial;
  sneaker: THREE.MeshStandardMaterial;
  sneakerSole: THREE.MeshStandardMaterial;
  dressSole: THREE.MeshStandardMaterial;
  belt: THREE.MeshStandardMaterial;
  buckle: THREE.MeshStandardMaterial;
  irisHexes: number[];
  lanyard: THREE.MeshStandardMaterial;
  badge: THREE.MeshStandardMaterial;
  phone: THREE.MeshStandardMaterial;
  phoneScreen: THREE.MeshStandardMaterial;
  phoneScreenTex: THREE.CanvasTexture;
  phoneScreenCtx: CanvasRenderingContext2D;
  laptopProp: THREE.MeshStandardMaterial;
  boxProp: THREE.MeshStandardMaterial;
  folderProp: THREE.MeshStandardMaterial;
  glassesFrame: THREE.MeshStandardMaterial;
  glassesLens: THREE.MeshStandardMaterial;
  pearlStud: THREE.MeshStandardMaterial;
  watchMat: THREE.MeshStandardMaterial;
  headphoneMat: THREE.MeshStandardMaterial;
}

export function createHumanPalette(_M: MaterialLibrary): HumanPalette {
  const micro = getHumanMicroMaps();

  const badgeTex = makeCanvasTex('staffbadge_v3', 128, 160, (g, W, H) => {
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
  });

  // Natural matte PBR human skin with soft warm velvet sheen (zero plastic specular blowout)
  const mkSkin = (c: number) =>
    new THREE.MeshPhysicalMaterial({
      color: c,
      normalMap: micro.skinNormalTex,
      normalScale: new THREE.Vector2(0.14, 0.14),
      roughnessMap: micro.skinRoughTex,
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.1,
      sheen: 0.18,
      sheenRoughness: 0.86,
      sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffb899), 0.28),
    });

  const mkCloth = (c: number, r = 0.88) =>
    new THREE.MeshStandardMaterial({
      color: c,
      normalMap: micro.weaveNormalTex,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: micro.weaveRoughTex,
      roughness: r,
      metalness: 0,
      envMapIntensity: 0.2,
    });

  const mkKnit = (c: number) =>
    new THREE.MeshStandardMaterial({
      color: c,
      normalMap: micro.knitNormalTex,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: micro.knitRoughTex,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.16,
    });

  const mkHair = (c: number) =>
    new THREE.MeshStandardMaterial({
      color: c,
      map: micro.hairStrandTex,
      normalMap: micro.hairCoilNormalTex,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.66,
      metalness: 0,
      envMapIntensity: 0.05,
    });

  const skinHexes = [0x6e432b, 0x4f2e1d, 0x8b583c, 0x3f2416, 0x9e6a49, 0x7b4c33, 0xb8815b, 0x5c3622];
  const hairHexes = [0x070606, 0x16100d, 0x241812, 0x0b0b0d, 0x342318, 0x1c1614];
  const irisHexes = [0x2e1b10, 0x1f130b, 0x3d2616, 0x292214];

  const phoneCanvas = document.createElement('canvas');
  phoneCanvas.width = 256;
  phoneCanvas.height = 512;
  const phoneScreenCtx = phoneCanvas.getContext('2d')!;
  const phoneScreenTex = new THREE.CanvasTexture(phoneCanvas);
  phoneScreenTex.colorSpace = THREE.SRGBColorSpace;
  phoneScreenTex.anisotropy = getMaxAnisotropy();

  const palette: HumanPalette = {
    skins: skinHexes.map(mkSkin),
    skinHexes,
    shirts: [
      0x223654,
      0xedeae4,
      0x586270,
      0x525a3a,
      0x8b6f56,
      0x1e222a,
      0x708aa8,
      0xa6692e,
      0x682a38,
      0x244a3d,
      0x162030,
    ].map((c) => mkCloth(c, 0.87)),
    knits: [0x2b303a, 0x465242, 0x7a4832, 0x1c283e, 0x5c5349, 0x223832].map(mkKnit),
    hairs: hairHexes.map(mkHair),
    hairHexes,
    trous: [0x1f242e, 0x32353d, 0x4a4236, 0x223044, 0x181a20, 0x5e584e].map((c) => mkCloth(c, 0.9)),
    white: mkCloth(0xf2efe9, 0.82),
    dark: new THREE.MeshStandardMaterial({ color: 0x100e0c, roughness: 0.34 }),
    lips: new THREE.MeshStandardMaterial({ color: 0x703c35, roughness: 0.62 }),
    shoe: new THREE.MeshStandardMaterial({
      color: 0x181514,
      normalMap: micro.leatherNormalTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.48,
      metalness: 0.02,
      envMapIntensity: 0.22,
    }),
    shoeBrown: new THREE.MeshStandardMaterial({
      color: 0x623b21,
      normalMap: micro.leatherNormalTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.5,
      metalness: 0.02,
      envMapIntensity: 0.22,
    }),
    shoeNude: new THREE.MeshStandardMaterial({
      color: 0x9b775b,
      normalMap: micro.leatherNormalTex,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.54,
      envMapIntensity: 0.2,
    }),
    sneaker: new THREE.MeshStandardMaterial({
      color: 0xe6e4de,
      normalMap: micro.weaveNormalTex,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.72,
      metalness: 0.02,
      envMapIntensity: 0.18,
    }),
    sneakerSole: new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.68, metalness: 0.02 }),
    dressSole: new THREE.MeshStandardMaterial({ color: 0x151210, roughness: 0.76 }),
    belt: new THREE.MeshStandardMaterial({
      color: 0x161414,
      normalMap: micro.leatherNormalTex,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.46,
    }),
    buckle: new THREE.MeshStandardMaterial({ color: 0xc2b69e, metalness: 0.78, roughness: 0.32 }),
    irisHexes,
    lanyard: new THREE.MeshStandardMaterial({ color: 0x1a2842, roughness: 0.84 }),
    badge: new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.56 }),
    phone: new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.38, metalness: 0.25 }),
    phoneScreen: new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.32,
      metalness: 0.05,
      emissive: 0xffffff,
      emissiveMap: phoneScreenTex,
      emissiveIntensity: 1.05,
    }),
    phoneScreenTex,
    phoneScreenCtx,
    laptopProp: new THREE.MeshStandardMaterial({ color: 0x2d343e, roughness: 0.38, metalness: 0.62 }),
    boxProp: new THREE.MeshStandardMaterial({ color: 0xb8895a, roughness: 0.84 }),
    folderProp: new THREE.MeshStandardMaterial({ color: 0xebe6db, roughness: 0.8 }),
    glassesFrame: new THREE.MeshStandardMaterial({ color: 0x6e523c, metalness: 0.34, roughness: 0.36 }),
    glassesLens: new THREE.MeshStandardMaterial({
      color: 0xdff2ff,
      roughness: 0.1,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    }),
    pearlStud: new THREE.MeshStandardMaterial({ color: 0xf4efe8, roughness: 0.2, metalness: 0.05 }),
    watchMat: new THREE.MeshStandardMaterial({ color: 0xc2c8cf, metalness: 0.75, roughness: 0.34 }),
    headphoneMat: new THREE.MeshStandardMaterial({
      color: 0x1e222a,
      roughness: 0.52,
      metalness: 0.28,
    }),
  };
  refreshPhoneScreenTexture(palette, 0);
  return palette;
}

export function refreshPhoneScreenTexture(P_LIB: HumanPalette, t: number) {
  const g = P_LIB.phoneScreenCtx;
  const W = 256;
  const H = 512;
  g.fillStyle = '#090e16';
  g.fillRect(0, 0, W, H);

  // Header bar: SwiftChat / HubPulse mobile UI
  g.fillStyle = '#111a28';
  g.fillRect(0, 0, W, 62);
  g.fillStyle = '#4fe38a';
  g.fillRect(14, 18, 10, 26);
  g.fillStyle = '#f8fafc';
  g.font = '700 22px "Plus Jakarta Sans",sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('SwiftChat', 32, 31);

  const jobs = socialNetwork.getJobs().slice(0, 3);
  jobs.forEach((job, idx) => {
    const y = 78 + idx * 96;
    const dir = DISTRICT_SOCIAL_DIRECTORY[job.toBuilding];
    g.fillStyle = idx === Math.floor(t / 3) % 3 ? '#172438' : '#111824';
    rr(g, 12, y, W - 24, 84, 12);
    g.fill();
    g.fillStyle = dir.accent;
    g.font = '700 16px ui-monospace,monospace';
    g.fillText(`${job.code} → ${dir.shortName.slice(0, 12)}`, 22, y + 22);
    g.fillStyle = '#f8fafc';
    g.font = '600 17px "Plus Jakarta Sans",sans-serif';
    g.fillText(job.title.slice(0, 21), 22, y + 48);
    g.fillStyle = 'rgba(255,255,255,0.14)';
    rr(g, 22, y + 66, W - 48, 6, 3);
    g.fill();
    g.fillStyle = dir.accent;
    rr(g, 22, y + 66, Math.max(12, Math.round(((W - 48) * job.progress) / 100)), 6, 3);
    g.fill();
  });

  const post = socialNetwork.getPosts()[0];
  g.fillStyle = '#132032';
  rr(g, 12, 374, W - 24, 120, 12);
  g.fill();
  g.fillStyle = '#38bdf8';
  g.font = '700 16px "Plus Jakarta Sans",sans-serif';
  g.fillText(post ? `${post.authorHandle} · ${post.channel}` : 'HubPulse Feed', 22, 398);
  g.fillStyle = '#cbd5e1';
  g.font = '15px "Plus Jakarta Sans",sans-serif';
  const bodyText = post?.body || 'Cross-company channels synced across monitors & phones.';
  g.fillText(bodyText.slice(0, 24), 22, 430);
  g.fillText(bodyText.slice(24, 48), 22, 454);
  g.fillStyle = '#4fe38a';
  g.font = '700 14px ui-monospace,monospace';
  g.fillText('TAP TO DISPATCH JOB', 22, 480);

  P_LIB.phoneScreenTex.needsUpdate = true;
}

export interface MakePersonOptions {
  skin: THREE.MeshStandardMaterial;
  shirt: THREE.Material;
  hair: THREE.MeshStandardMaterial;
  trou: THREE.Material;
  s?: number;
  fem?: boolean;
  hs?: number;
  hairStyle?: HairStyleName;
  beardStyle?: BeardStyle;
  faceVariant?: number;
  freckleSeed?: number;
  warmSmile?: boolean;
  faceSize?: 512 | 768 | 1024;
  detail?: DetailLevel;
  sneakers?: boolean;
  blazer?: boolean;
  outfit?: OutfitArchetype;
  sleeve?: SleeveStyle;
  shoeStyle?: ShoeStyle;
  skirt?: 'none' | 'short' | 'midi';
  coat?: boolean;
  headphones?: boolean;
  glasses?: boolean;
  lanyard?: boolean;
  hardHat?: number;
  tie?: number;
  name?: string;
  withSwimwear?: boolean;
  swimColor?: number;
  startInSwimwear?: boolean;
}

/* =========================================================
   CHARACTER SKELETON & ANIMATION CLIPS FACTORY
   ========================================================= */
function createHumanoidRig(isFem: boolean): { bones: BoneMap; skeleton: THREE.Skeleton; rootBone: THREE.Bone } {
  const hipX = isFem ? 0.084 : 0.092;
  const shoulderX = isFem ? 0.138 : 0.164;
  const armOut = shoulderX - 0.05;

  const mkBone = (name: string, parent: THREE.Object3D | null, x: number, y: number, z: number) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    return b;
  };

  const Hips = mkBone('Hips', null, 0, 0.9, 0);
  const Spine = mkBone('Spine', Hips, 0, 0.12, 0);
  const Spine1 = mkBone('Spine1', Spine, 0, 0.16, 0);
  const Spine2 = mkBone('Spine2', Spine1, 0, 0.16, 0);
  const Neck = mkBone('Neck', Spine2, 0, 0.15, 0);
  const Head = mkBone('Head', Neck, 0, 0.1, 0);

  const LeftShoulder = mkBone('LeftShoulder', Spine2, 0.05, 0.075, 0);
  const LeftArm = mkBone('LeftArm', LeftShoulder, armOut, 0, 0);
  const LeftForeArm = mkBone('LeftForeArm', LeftArm, 0, -0.265, 0);
  const LeftHand = mkBone('LeftHand', LeftForeArm, 0, -0.25, 0);

  const RightShoulder = mkBone('RightShoulder', Spine2, -0.05, 0.075, 0);
  const RightArm = mkBone('RightArm', RightShoulder, -armOut, 0, 0);
  const RightForeArm = mkBone('RightForeArm', RightArm, 0, -0.265, 0);
  const RightHand = mkBone('RightHand', RightForeArm, 0, -0.25, 0);

  const LeftUpLeg = mkBone('LeftUpLeg', Hips, hipX, -0.02, 0);
  const LeftLeg = mkBone('LeftLeg', LeftUpLeg, 0, -0.42, 0);
  const LeftFoot = mkBone('LeftFoot', LeftLeg, 0, -0.42, 0);

  const RightUpLeg = mkBone('RightUpLeg', Hips, -hipX, -0.02, 0);
  const RightLeg = mkBone('RightLeg', RightUpLeg, 0, -0.42, 0);
  const RightFoot = mkBone('RightFoot', RightLeg, 0, -0.42, 0);

  const bones: BoneMap = {
    Hips,
    Spine,
    Spine1,
    Spine2,
    Neck,
    Head,
    LeftShoulder,
    LeftArm,
    LeftForeArm,
    LeftHand,
    RightShoulder,
    RightArm,
    RightForeArm,
    RightHand,
    LeftUpLeg,
    LeftLeg,
    LeftFoot,
    RightUpLeg,
    RightLeg,
    RightFoot,
  };

  const boneList = BONE_NAMES.map((n) => bones[n]);
  const skeleton = new THREE.Skeleton(boneList);
  return { bones, skeleton, rootBone: Hips };
}

function makePoseClip(
  name: string,
  duration: number,
  sampleFn: (tNorm: number) => Record<string, THREE.Euler>,
  hipPosFn?: (tNorm: number) => [number, number, number]
): THREE.AnimationClip {
  const times = [0, duration * 0.25, duration * 0.5, duration * 0.75, duration];
  const boneTracks = new Map<string, number[]>();
  const hipPositions: number[] = [];

  for (const t of times) {
    const tNorm = t / duration;
    const rots = sampleFn(tNorm);
    for (const [boneName, euler] of Object.entries(rots)) {
      const q = new THREE.Quaternion().setFromEuler(euler);
      const arr = boneTracks.get(boneName) || [];
      arr.push(q.x, q.y, q.z, q.w);
      boneTracks.set(boneName, arr);
    }
    if (hipPosFn) {
      const [hx, hy, hz] = hipPosFn(tNorm);
      hipPositions.push(hx, hy, hz);
    }
  }

  const tracks: THREE.KeyframeTrack[] = [];
  for (const [bName, vals] of boneTracks.entries()) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bName}.quaternion`, times, vals));
  }
  if (hipPosFn) {
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipPositions));
  }
  return new THREE.AnimationClip(name, duration, tracks);
}

function buildStandardClips(hipYStand = 0.9): THREE.AnimationClip[] {
  const idle = makePoseClip(
    'Idle',
    3.2,
    (k) => {
      const s = Math.sin(k * Math.PI * 2);
      return {
        Spine: new THREE.Euler(0.015 + s * 0.012, 0, 0),
        Head: new THREE.Euler(0.02 + s * 0.015, Math.sin(k * Math.PI * 2) * 0.04, 0),
        LeftArm: new THREE.Euler(0.04, 0, 0.055),
        LeftForeArm: new THREE.Euler(-0.24 + s * 0.02, 0, 0),
        RightArm: new THREE.Euler(0.04, 0, -0.055),
        RightForeArm: new THREE.Euler(-0.24 - s * 0.02, 0, 0),
      };
    },
    (k) => [0, hipYStand + Math.sin(k * Math.PI * 2) * 0.004, 0]
  );

  const walk = makePoseClip(
    'Walking',
    1.1,
    (k) => {
      const sw = Math.sin(k * Math.PI * 2);
      return {
        Hips: new THREE.Euler(0, sw * 0.06, 0),
        Spine2: new THREE.Euler(0.03, -sw * 0.08, 0),
        LeftUpLeg: new THREE.Euler(sw * 0.56, 0, 0),
        LeftLeg: new THREE.Euler(Math.max(0, -sw) * 0.68, 0, 0),
        RightUpLeg: new THREE.Euler(-sw * 0.56, 0, 0),
        RightLeg: new THREE.Euler(Math.max(0, sw) * 0.68, 0, 0),
        LeftArm: new THREE.Euler(-sw * 0.45, 0, 0.05),
        LeftForeArm: new THREE.Euler(-0.26 - Math.max(0, -sw) * 0.14, 0, 0),
        RightArm: new THREE.Euler(sw * 0.45, 0, -0.05),
        RightForeArm: new THREE.Euler(-0.26 - Math.max(0, sw) * 0.14, 0, 0),
      };
    },
    (k) => [0, hipYStand + Math.abs(Math.sin(k * Math.PI * 2)) * 0.022, 0]
  );

  const sitting = makePoseClip(
    'SittingWork',
    2.4,
    (k) => {
      const tL = Math.max(0, Math.sin(k * Math.PI * 4)) * 0.032;
      const tR = Math.max(0, -Math.sin(k * Math.PI * 4)) * 0.032;
      return {
        Spine: new THREE.Euler(0.027, 0, 0),
        Spine1: new THREE.Euler(0.027, 0, 0),
        Spine2: new THREE.Euler(0.027, 0, 0),
        Head: new THREE.Euler(0.06, Math.sin(k * Math.PI * 2) * 0.04, 0),
        LeftUpLeg: new THREE.Euler(-1.48, 0, 0),
        LeftLeg: new THREE.Euler(1.48, 0, 0),
        RightUpLeg: new THREE.Euler(-1.48, 0, 0),
        RightLeg: new THREE.Euler(1.48, 0, 0),
        LeftArm: new THREE.Euler(-0.61, 0, -0.05),
        LeftForeArm: new THREE.Euler(-0.99 - tL, -1.36, 0),
        LeftHand: new THREE.Euler(0, 0, 0.05 + tL * 1.8),
        RightArm: new THREE.Euler(-0.61, 0, 0.05),
        RightForeArm: new THREE.Euler(-0.99 - tR, 1.36, 0),
        RightHand: new THREE.Euler(0, 0, -0.05 - tR * 1.8),
      };
    },
    () => [0, 0.562, 0]
  );

  const talking = makePoseClip('Talking', 2.6, (k) => {
    const g = Math.sin(k * Math.PI * 2);
    return {
      Spine2: new THREE.Euler(0.02, 0.08 + g * 0.04, 0),
      Head: new THREE.Euler(0.02, 0.14 - g * 0.08, 0),
      LeftArm: new THREE.Euler(-0.22 + g * 0.1, 0, 0.06),
      LeftForeArm: new THREE.Euler(-0.64, 0, 0),
      RightArm: new THREE.Euler(-0.68 + g * 0.18, 0, -0.08),
      RightForeArm: new THREE.Euler(-1.02 + g * 0.22, 0.45, 0),
    };
  });

  return [idle, walk, sitting, talking];
}

/* =========================================================
   MAIN RIGGED SKINNED CHARACTER CONSTRUCTOR
   ========================================================= */
export function makePerson(
  o: MakePersonOptions,
  P_LIB: HumanPalette,
  M: MaterialLibrary
): PersonActor {
  const detail: DetailLevel = o.detail || 'office';
  const G = initAnatomyGeos(detail);
  const micro = getHumanMicroMaps();
  const isFem = !!o.fem;

  const g = new THREE.Group();
  if (o.name) g.name = o.name.replace(/\s+/g, '_');

  const body = new THREE.Group();
  body.scale.setScalar(o.s || 1);
  g.add(body);

  const { bones, skeleton, rootBone } = createHumanoidRig(isFem);
  body.add(rootBone);

  const tor = new THREE.Group();
  tor.position.set(0, -0.44, 0);
  bones.Spine2.add(tor);

  const headAnchor = new THREE.Group();
  headAnchor.position.set(0, 0.015, 0);
  bones.Head.add(headAnchor);

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

  // Clone material swatches cleanly (preserve exact curated colors in studio detail mode)
  const colorJitter = detail === 'studio' ? 0 : 1;
  const skin = o.skin.clone();
  skin.color.offsetHSL((Math.random() - 0.5) * 0.012 * colorJitter, 0, (Math.random() - 0.5) * 0.03 * colorJitter);
  const shirt = (o.shirt as THREE.MeshStandardMaterial).clone();
  shirt.color.offsetHSL((Math.random() - 0.5) * 0.018 * colorJitter, 0, (Math.random() - 0.5) * 0.04 * colorJitter);
  const trou = (o.trou as THREE.MeshStandardMaterial).clone();
  const hair = (o.hair as THREE.MeshStandardMaterial).clone();
  hair.color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.008 * colorJitter);

  const seed = Math.abs((shirt.color.getHex() >> 3) + (skin.color.getHex() >> 4) + (hair.color.getHex() >> 2));
  const hs = o.hs != null ? o.hs : seed % 6;

  const outfit: OutfitArchetype =
    o.outfit ||
    (o.blazer
      ? 'suit'
      : isFem
      ? (['dress', 'blouseSkirt', 'suit', 'knit', 'shirtTrousers'] as const)[seed % 5]
      : o.sneakers
      ? seed % 2 === 0
        ? 'knit'
        : 'smartCasual'
      : (['suit', 'shirtTrousers', 'knit'] as const)[seed % 3]);

  const isKnit = outfit === 'knit';
  const hasBlazer = outfit === 'suit' || !!o.blazer;
  const hasCoat = !!o.coat;
  const skirtKind: 'none' | 'short' | 'midi' =
    o.skirt ||
    (outfit === 'dress' || outfit === 'blouseSkirt'
      ? seed % 2 === 0
        ? 'short'
        : 'midi'
      : isFem && outfit === 'suit' && seed % 3 === 0
      ? 'short'
      : 'none');
  const hasSkirt = skirtKind !== 'none';

  const sleeve: SleeveStyle =
    o.sleeve ||
    (hasBlazer || hasCoat || isKnit
      ? 'long'
      : outfit === 'dress'
      ? isFem && seed % 3 !== 2
        ? 'sleeveless'
        : 'short'
      : outfit === 'blouseSkirt'
      ? seed % 2 === 0
        ? 'sleeveless'
        : 'rolled'
      : outfit === 'smartCasual'
      ? seed % 2 === 0
        ? 'short'
        : 'rolled'
      : seed % 3 === 1
      ? 'rolled'
      : 'long');

  const shoeStyle: ShoeStyle =
    o.shoeStyle ||
    (o.sneakers
      ? 'sneaker'
      : isFem
      ? hasSkirt || outfit === 'dress'
        ? seed % 3 === 0
          ? 'flat'
          : 'heel'
        : seed % 2 === 0
        ? 'heel'
        : 'flat'
      : 'oxford');

  const hairStyle: HairStyleName =
    o.hairStyle ||
    (isFem
      ? (['braids', 'bun', 'puff', 'afro', 'bob', 'pixie'] as const)[hs % 6]
      : (['fade', 'twists', 'afro', 'fade'] as const)[hs % 4]);

  const beardStyle: BeardStyle =
    o.beardStyle || (!isFem ? (hairStyle === 'fade' ? (seed % 2 === 0 ? 'full' : 'stubble') : seed % 3 === 0 ? 'stubble' : 'none') : 'none');

  const hasGlasses = o.glasses ?? (hasBlazer ? seed % 3 === 0 : seed % 6 === 0);
  const hasWatch = seed % 2 === 0;
  const hasHeadphones = !!o.headphones;

  const garmentTopMat = isKnit ? P_LIB.knits[seed % P_LIB.knits.length].clone() : shirt;
  if (isKnit && o.shirt !== P_LIB.shirts[seed % P_LIB.shirts.length]) {
    garmentTopMat.color.copy(shirt.color);
  }
  const innerShirtMat = hasBlazer || hasCoat ? P_LIB.white : garmentTopMat;

  // Photorealistic dermal face texture + 3D eyeball iris texture
  const irisHex = P_LIB.irisHexes[hs % P_LIB.irisHexes.length];
  const faceTex = getPhotorealFaceTexture({
    skinHex: skin.color.getHex(),
    hairHex: hair.color.getHex(),
    irisHex,
    fem: isFem,
    beardStyle,
    hasFadeHairline: hairStyle === 'fade' || hairStyle === 'twists',
    freckleSeed: o.freckleSeed ?? seed,
    warmSmile: o.warmSmile ?? (seed % 2 === 0),
    size: o.faceSize || (detail === 'studio' ? 512 : 256),
  });
  const faceMat = new THREE.MeshPhysicalMaterial({
    map: faceTex,
    normalMap: micro.skinNormalTex,
    normalScale: new THREE.Vector2(0.12, 0.12),
    roughnessMap: micro.skinRoughTex,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.1,
    sheen: 0.16,
    sheenRoughness: 0.86,
    sheenColor: skin.color.clone().lerp(new THREE.Color(0xffb899), 0.26),
  });

  // Glossy corneal eyeball material
  const eyeBallMat = new THREE.MeshStandardMaterial({
    map: getEyeIrisTexture(irisHex),
    roughness: 0.08,
    metalness: 0,
    envMapIntensity: 0.65,
  });

  // Subtle keratin fingernail material tinted gently to skin tone
  const nailMat = new THREE.MeshStandardMaterial({
    color: skin.color.clone().lerp(new THREE.Color(0xd9b8a6), 0.48),
    roughness: 0.42,
    metalness: 0,
    envMapIntensity: 0.24,
  });

  /* ---------------------------------------------------------
     BUILD SKINNED MESH HELPER (CASUAL OR SWIMWEAR ON SAME RIG)
     --------------------------------------------------------- */
  const headVariant = o.faceVariant ?? seed % 4;
  const headGeo = (isFem ? G.headsFem : G.headsMale)[headVariant % 4];
  const eyeZ = 0.0585;
  const eyeY = 1.657;
  const eyeX = 0.0260;
  const earOffsetX = isFem ? 0.0715 : 0.076;

  // Articulated 3D Upper Eyelids attached to Head bone for realistic rotational blink
  const eg: THREE.Group[] = [];
  const upLidGeo = isFem ? G.upperLidFem : G.upperLidMale;
  [1, -1].forEach((sx) => {
    const eyeGrp = new THREE.Group();
    eyeGrp.position.set(sx * eyeX, eyeY - 1.59, eyeZ); // Head bone sits at 1.59
    bones.Head.add(eyeGrp);
    const lid = new THREE.Mesh(upLidGeo, skin);
    lid.castShadow = false;
    eyeGrp.add(lid);
    eg.push(eyeGrp);
  });

  // Volumetric Hairstyles + Alpha-Cutout Hair Cards + 3D Facial Hair
  const builtHair = (isFem ? G.hairFem : G.hairMale)[hairStyle];
  const hairCoreMat = hair.clone();
  if (builtHair.isCoily) {
    hairCoreMat.map = null;
    hairCoreMat.normalMap = micro.hairCoilNormalTex;
    hairCoreMat.normalScale = new THREE.Vector2(0.32, 0.32);
    hairCoreMat.roughness = 0.66;
  } else {
    hairCoreMat.normalMap = micro.hairStrandNormalTex;
    hairCoreMat.normalScale = new THREE.Vector2(0.38, 0.38);
    hairCoreMat.roughness = 0.62;
  }
  hairCoreMat.envMapIntensity = 0.05;

  const cardMat = builtHair.cardGeo ? hairCoreMat.clone() : null;
  if (cardMat) {
    cardMat.alphaMap = builtHair.isCoily ? micro.afroHaloAlphaTex : micro.hairCardAlphaTex;
    cardMat.alphaTest = 0.28;
    cardMat.transparent = false;
    cardMat.side = THREE.DoubleSide;
  }
  const beardMat = !isFem && beardStyle === 'full' && G.beardFull ? hairCoreMat.clone() : null;
  if (beardMat) {
    beardMat.alphaMap = micro.afroHaloAlphaTex;
    beardMat.alphaTest = 0.22;
    beardMat.side = THREE.DoubleSide;
  }
  const bandMat = builtHair.bandGeo
    ? new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.45 })
    : null;

  const swimMat = o.withSwimwear
    ? new THREE.MeshStandardMaterial({
        color: o.swimColor ?? (isFem ? 0x0ea5e9 : 0x14b8a6),
        normalMap: micro.weaveNormalTex,
        normalScale: new THREE.Vector2(0.28, 0.28),
        roughness: 0.46,
        metalness: 0.02,
        envMapIntensity: 0.26,
      })
    : null;

  const hairWeight = (_x: number, y: number): BoneWeightResult => {
    if (y >= 1.56) return [5, 0, 0, 0, 1, 0, 0, 0];
    const k = smoothstep(1.56, 1.44, y);
    return [5, 4, 3, 0, 1 - k * 0.6, k * 0.35, k * 0.25, 0];
  };

  const hipX = isFem ? 0.084 : 0.092;
  const shoulderX = isFem ? 0.138 : 0.164;

  const buildSkinnedOutfit = (asSwimwear: boolean): THREE.SkinnedMesh => {
    const skinnedParts: THREE.BufferGeometry[] = [];
    const skinnedMats: THREE.Material[] = [];

    const pushPart = (
      rawGeo: THREE.BufferGeometry,
      mat: THREE.Material,
      wFn: (x: number, y: number, z: number) => BoneWeightResult
    ) => {
      skinnedParts.push(prepareSkinnedPart(rawGeo, wFn));
      skinnedMats.push(mat);
    };

    if (asSwimwear && swimMat) {
      // 1A. Bare torso + fitted swimwear garment (one-piece for female, swim trunks for male)
      pushPart(isFem ? G.torsoFem : G.torsoMale, skin, (_x, y) => weightTorsoSpine(y));
      if (isFem) {
        pushPart(G.swimOnePieceFem, swimMat, (_x, y) => weightTorsoSpine(y));
        pushPart(G.swimStrapsFem, swimMat, (_x, y) => weightTorsoSpine(y));
      } else {
        pushPart(G.swimTrunksBandMale, swimMat, (_x, y) => weightTorsoSpine(y));
      }
    } else {
      // 1B. Tailored street / lounge / office clothing torso
      const lowerMat = outfit === 'dress' ? garmentTopMat : trou;
      const torsoGeo =
        outfit === 'dress'
          ? G.torsoFemDress
          : isKnit
          ? isFem
            ? G.torsoKnitFem
            : G.torsoKnitMale
          : isFem
          ? G.torsoFem
          : G.torsoMale;
      pushPart(torsoGeo, innerShirtMat, (_x, y) => weightTorsoSpine(y));

      if (outfit !== 'dress') {
        const hipWrap = torsoGeo.clone();
        const hp = hipWrap.attributes.position;
        for (let i = 0; i < hp.count; i++) {
          const y = hp.getY(i);
          if (y > 0.915) hp.setY(i, 0.915);
          else hp.setXYZ(i, hp.getX(i) * 1.015, y, hp.getZ(i) * 1.015);
        }
        pushPart(hipWrap, trou, (_x, y) => weightTorsoSpine(y));
        hipWrap.dispose();
      }

      if (outfit === 'dress') {
        pushPart(isFem ? G.dressCollarFem : G.dressCollarMale, garmentTopMat, (_x, y) => weightTorsoSpine(y));
      }
      if (sleeve === 'sleeveless') {
        pushPart(isFem ? G.sleevelessCapFem : G.sleevelessCapMale, garmentTopMat, (_x, y) => weightTorsoSpine(y));
      }

      if (isKnit) {
        const col = G.ribCollar.clone().rotateX(Math.PI / 2).translate(0, 1.478, 0.004);
        const hem = G.ribHem.clone().rotateX(Math.PI / 2).scale(isFem ? 0.94 : 1.04, 0.74, 1).translate(0, 0.89, 0.004);
        pushPart(col, garmentTopMat, (_x, y) => weightTorsoSpine(y));
        pushPart(hem, garmentTopMat, (_x, y) => weightTorsoSpine(y));
        col.dispose();
        hem.dispose();
      } else if (outfit !== 'dress' && outfit !== 'smartCasual') {
        pushPart(isFem ? G.shirtCollarFem : G.shirtCollarMale, innerShirtMat, (_x, y) => weightTorsoSpine(y));
        for (let b = 0; b < 4; b++) {
          const by = 1.08 + b * 0.092;
          const bz = isFem ? 0.114 + (b === 2 ? 0.012 : 0) : 0.118 + (b > 1 ? 0.005 : 0);
          const btn = G.buttonDot.clone().rotateX(Math.PI / 2).translate(0, by, bz);
          pushPart(btn, P_LIB.buckle, (_x, y) => weightTorsoSpine(y));
          btn.dispose();
        }
      }

      if (hasCoat) {
        const coatM = shirt.clone();
        pushPart(isFem ? G.coatFem : G.coatMale, coatM, (_x, y) => weightTorsoSpine(y));
      } else if (hasBlazer) {
        const bMat = shirt.clone();
        pushPart(isFem ? G.blazerFem : G.blazerMale, bMat, (_x, y) => weightTorsoSpine(y));
        if (!isFem) {
          const ps = G.pocketSquare.clone().rotateZ(0.12).translate(0.088, 1.325, 0.118);
          pushPart(ps, P_LIB.white, (_x, y) => weightTorsoSpine(y));
          ps.dispose();
        }
      }

      if (outfit !== 'dress' && !hasCoat && !hasSkirt && !isKnit) {
        pushPart(isFem ? G.trouserBeltFemBand : G.trouserBeltMaleBand, P_LIB.belt, (_x, y) => weightTorsoSpine(y));
        pushPart(isFem ? G.trouserBeltFemBuckle : G.trouserBeltMaleBuckle, P_LIB.buckle, (_x, y) => weightTorsoSpine(y));
      } else if (outfit === 'dress') {
        pushPart(G.dressBeltBand, P_LIB.belt, (_x, y) => weightTorsoSpine(y));
        pushPart(G.dressBeltBuckle, P_LIB.buckle, (_x, y) => weightTorsoSpine(y));
      }

      if (o.tie != null && !isFem) {
        const tieMat = new THREE.MeshStandardMaterial({
          color: o.tie,
          normalMap: micro.weaveNormalTex,
          normalScale: new THREE.Vector2(0.25, 0.25),
          roughness: 0.44,
        });
        pushPart(G.tieBladeMale, tieMat, (_x, y) => weightTorsoSpine(y));
      }

      if (o.lanyard && !hasCoat && outfit !== 'dress') {
        const l1 = G.lanyardStrap.clone().rotateX(-0.1).rotateZ(0.19).translate(-0.038, 1.36, 0.122);
        const l2 = G.lanyardStrap.clone().rotateX(-0.1).rotateZ(-0.14).translate(-0.072, 1.36, 0.116);
        const card = G.badgeCard.clone().rotateX(-0.06).translate(-0.056, 1.24, 0.13);
        pushPart(l1, P_LIB.lanyard, (_x, y) => weightTorsoSpine(y));
        pushPart(l2, P_LIB.lanyard, (_x, y) => weightTorsoSpine(y));
        pushPart(card, P_LIB.badge, (_x, y) => weightTorsoSpine(y));
        l1.dispose();
        l2.dispose();
        card.dispose();
      }

      if (hasSkirt) {
        const skirtMat = lowerMat.clone();
        skirtMat.side = THREE.DoubleSide;
        const skirtGeo =
          outfit === 'dress'
            ? skirtKind === 'midi'
              ? G.dressSkirtMidi
              : G.dressSkirtShort
            : skirtKind === 'midi'
            ? G.skirtMidi
            : G.skirtShort;
        pushPart(skirtGeo, skirtMat, (x, y, z) => weightSkirt(x, y, z));
      }
    }

    // 2. Shared Sculpted Head, Neck, Eyeballs, Ears & Hair
    pushPart(headGeo, faceMat, (_x, y) => weightTorsoSpine(y));
    for (const sx of [-1, 1]) {
      const eb = G.eyeball.clone().translate(sx * eyeX, eyeY, eyeZ);
      const loLid = (isFem ? G.lowerLidFem : G.lowerLidMale).clone().translate(sx * eyeX, eyeY, eyeZ);
      pushPart(eb, eyeBallMat, () => [5, 0, 0, 0, 1, 0, 0, 0]);
      pushPart(loLid, skin, () => [5, 0, 0, 0, 1, 0, 0, 0]);
      eb.dispose();
      loLid.dispose();
    }

    const earL = G.earLeft.clone().translate(earOffsetX, 1.644, -0.008);
    const earR = G.earRight.clone().translate(-earOffsetX, 1.644, -0.008);
    pushPart(earL, skin, () => [5, 0, 0, 0, 1, 0, 0, 0]);
    pushPart(earR, skin, () => [5, 0, 0, 0, 1, 0, 0, 0]);
    earL.dispose();
    earR.dispose();

    if (isFem && o.hardHat == null && !asSwimwear) {
      for (const sx of [-1, 1]) {
        const stud = G.earringStud.clone().translate(sx * (earOffsetX + 0.002), 1.622, -0.004);
        pushPart(stud, P_LIB.pearlStud, () => [5, 0, 0, 0, 1, 0, 0, 0]);
        stud.dispose();
      }
    }

    if (hasGlasses && !asSwimwear) {
      pushPart(G.glassesFrames, P_LIB.glassesFrame, () => [5, 0, 0, 0, 1, 0, 0, 0]);
      pushPart(G.glassesLenses, P_LIB.glassesLens, () => [5, 0, 0, 0, 1, 0, 0, 0]);
    }

    if (hasHeadphones && !asSwimwear) {
      const band = G.headphoneBand.clone().rotateZ(-0.04).translate(0, 1.668, 0);
      pushPart(band, P_LIB.headphoneMat, () => [5, 0, 0, 0, 1, 0, 0, 0]);
      band.dispose();
      [-1, 1].forEach((sx) => {
        const cup = G.headphoneCup.clone().rotateZ(Math.PI / 2).translate(sx * 0.083, 1.647, -0.004);
        pushPart(cup, P_LIB.headphoneMat, () => [5, 0, 0, 0, 1, 0, 0, 0]);
        cup.dispose();
      });
    }

    if (o.hardHat != null && !asSwimwear) {
      const hatMat = new THREE.MeshStandardMaterial({
        color: o.hardHat,
        roughness: 0.34,
        metalness: 0.06,
        envMapIntensity: 0.35,
      });
      const dome = G.hardHatDome.clone().scale(0.95, 1.0, 1.06).translate(0, 1.69, -0.006);
      const brim = G.hardHatBrim.clone().rotateX(0.14).translate(0, 1.694, 0.095);
      const ridge = G.hardHatRidge.clone().translate(0, 1.78, -0.006);
      pushPart(dome, hatMat, () => [5, 0, 0, 0, 1, 0, 0, 0]);
      pushPart(brim, hatMat, () => [5, 0, 0, 0, 1, 0, 0, 0]);
      pushPart(ridge, hatMat, () => [5, 0, 0, 0, 1, 0, 0, 0]);
      dome.dispose();
      brim.dispose();
      ridge.dispose();
    }

    pushPart(builtHair.coreGeo, hairCoreMat, hairWeight);
    if (builtHair.cardGeo && cardMat) pushPart(builtHair.cardGeo, cardMat, hairWeight);
    if (builtHair.bandGeo && bandMat) pushPart(builtHair.bandGeo, bandMat, () => [5, 0, 0, 0, 1, 0, 0, 0]);
    if (beardMat && G.beardFull) pushPart(G.beardFull, beardMat, () => [5, 0, 0, 0, 1, 0, 0, 0]);

    // 3. Legs & Footwear (bare legs + pool slides in swimwear mode)
    const legMat = asSwimwear || hasSkirt ? skin : trou;
    const legGeoSrc = asSwimwear || hasSkirt ? G.legBare : G.legTrouser;
    const upperShoeMat =
      shoeStyle === 'sneaker'
        ? P_LIB.sneaker
        : shoeStyle === 'oxford' && seed % 3 === 1
        ? P_LIB.shoeBrown
        : shoeStyle === 'heel' && seed % 4 === 2
        ? P_LIB.shoeNude
        : P_LIB.shoe;
    const soleMat = shoeStyle === 'sneaker' ? P_LIB.sneakerSole : P_LIB.dressSole;
    const shoeUpperGeo =
      shoeStyle === 'heel'
        ? G.heelUpper
        : shoeStyle === 'flat'
        ? G.flatUpper
        : shoeStyle === 'sneaker'
        ? G.sneakerUpper
        : G.oxfordUpper;
    const shoeSoleGeo =
      shoeStyle === 'heel'
        ? G.heelSole
        : shoeStyle === 'flat'
        ? G.flatSole
        : shoeStyle === 'sneaker'
        ? G.sneakerSole
        : G.oxfordSole;
    const shoeInstepGeo = shoeStyle === 'heel' ? G.heelInstep : shoeStyle === 'flat' ? G.flatInstep : undefined;

    [true, false].forEach((sideLeft) => {
      const lx = (sideLeft ? 1 : -1) * hipX;
      const legClone = legGeoSrc.clone().translate(lx, 0, 0);
      pushPart(legClone, legMat, (_x, y) => weightLeg(sideLeft, y));
      legClone.dispose();

      if (asSwimwear && !isFem && swimMat) {
        const trunksSleeve = G.swimTrunksLeg.clone().translate(lx, 0, 0);
        pushPart(trunksSleeve, swimMat, (_x, y) => weightLeg(sideLeft, y));
        trunksSleeve.dispose();
      }

      const ankleG = latheFromProfile(
        [
          [0.001, 0.026],
          [0.028, 0.026],
          [0.031, 0.082],
          [0.001, 0.082],
        ],
        12
      ).translate(lx, 0, 0);
      pushPart(ankleG, skin, (_x, y) => weightLeg(sideLeft, y));
      ankleG.dispose();

      if (asSwimwear && swimMat) {
        const slideSole = G.flatSole.clone().translate(lx, 0, 0);
        const slideFoot = G.flatUpper.clone().translate(lx, 0, 0);
        const slideBand = G.slideStrap.clone().translate(lx, 0, 0);
        pushPart(slideSole, P_LIB.sneakerSole, (_x, y) => weightLeg(sideLeft, y));
        pushPart(slideFoot, skin, (_x, y) => weightLeg(sideLeft, y));
        pushPart(slideBand, swimMat, (_x, y) => weightLeg(sideLeft, y));
        if (G.flatInstep) {
          const ins = G.flatInstep.clone().translate(lx, 0, 0);
          pushPart(ins, skin, (_x, y) => weightLeg(sideLeft, y));
          ins.dispose();
        }
        slideSole.dispose();
        slideFoot.dispose();
        slideBand.dispose();
      } else {
        if (shoeInstepGeo) {
          const ins = shoeInstepGeo.clone().translate(lx, 0, 0);
          pushPart(ins, skin, (_x, y) => weightLeg(sideLeft, y));
          ins.dispose();
        }
        const soleG = shoeSoleGeo.clone().translate(lx, 0, 0);
        const upperG = shoeUpperGeo.clone().translate(lx, 0, 0);
        pushPart(soleG, soleMat, (_x, y) => weightLeg(sideLeft, y));
        pushPart(upperG, upperShoeMat, (_x, y) => weightLeg(sideLeft, y));
        soleG.dispose();
        upperG.dispose();
      }
    });

    // 4. Arms + Hands (always bare full arms when in swimwear)
    const topArmMat = hasBlazer || hasCoat || isKnit ? garmentTopMat : innerShirtMat;
    [true, false].forEach((sideLeft) => {
      const sx = sideLeft ? 1 : -1;
      const ax = sx * shoulderX;

      const addArmPart = (src: THREE.BufferGeometry, mat: THREE.Material) => {
        const c = src.clone();
        if (!sideLeft) mirrorGeometryX(c);
        c.translate(ax, 0, 0);
        pushPart(c, mat, (x, y) => weightArm(sideLeft, x, y, shoulderX));
        c.dispose();
      };

      if (asSwimwear || sleeve === 'sleeveless') {
        addArmPart(G.armFullBare, skin);
      } else if (sleeve === 'short') {
        addArmPart(G.armShortSleeve, topArmMat);
        addArmPart(G.armShortBare, skin);
      } else if (sleeve === 'rolled') {
        addArmPart(G.armRolledUpper, topArmMat);
        addArmPart(G.armRolledBare, skin);
      } else {
        addArmPart(G.armFullSleeve, topArmMat);
      }

      if (hasWatch && sideLeft && !asSwimwear) {
        const ws = G.watchStrap.clone().translate(ax, 0.935, 0);
        const wf = G.watchFace.clone().translate(ax + 0.022, 0.935, 0);
        pushPart(ws, P_LIB.belt, (x, y) => weightArm(sideLeft, x, y, shoulderX));
        pushPart(wf, P_LIB.watchMat, (x, y) => weightArm(sideLeft, x, y, shoulderX));
        ws.dispose();
        wf.dispose();
      }

      const handSkinG = G.handSkin.clone();
      const handNailG = G.handNails.clone();
      if (!sideLeft) {
        mirrorGeometryX(handSkinG);
        mirrorGeometryX(handNailG);
      }
      handSkinG.rotateZ(sx * 0.04).translate(ax, 0.91, 0.002);
      handNailG.rotateZ(sx * 0.04).translate(ax, 0.91, 0.002);
      pushPart(handSkinG, skin, (x, y) => weightArm(sideLeft, x, y, shoulderX));
      pushPart(handNailG, nailMat, (x, y) => weightArm(sideLeft, x, y, shoulderX));
      handSkinG.dispose();
      handNailG.dispose();
    });

    const mergedGeo = mergeGeometries(skinnedParts, true);
    for (const part of skinnedParts) part.dispose();

    const mesh = new THREE.SkinnedMesh(mergedGeo, skinnedMats);
    const suffix = asSwimwear ? 'SwimMesh' : 'Mesh';
    mesh.name = o.name ? `${o.name.replace(/\s+/g, '_')}_${suffix}` : `OfficeProfessional_${suffix}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    body.add(mesh);
    mesh.bind(skeleton);
    meshes.push(mesh);
    return mesh;
  };

  rootBone.updateMatrixWorld(true);
  const casualMesh = buildSkinnedOutfit(false);
  const swimMesh = o.withSwimwear ? buildSkinnedOutfit(true) : undefined;
  const startSwim = !!o.startInSwimwear && !!swimMesh;
  casualMesh.visible = !startSwim;
  if (swimMesh) swimMesh.visible = startSwim;
  const skinnedMesh = startSwim && swimMesh ? swimMesh : casualMesh;

  const shadow = contact(g, 0, 0.006, 0, 0.68, 0.68, 0.48, M.textures.shadowTex);

  const clips = buildStandardClips(0.9);

  return {
    g,
    body,
    hip: body,
    bones,
    skeleton,
    skinnedMesh,
    casualMesh,
    swimMesh,
    inSwimwear: startSwim,
    clips,
    thigh: [],
    knee: [],
    sh: [],
    el: [],
    eg,
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
    peScreen: null,
    tor,
    head: headAnchor,
    route: null,
    modes: null,
    timer: 0,
    pose: 'stand',
    asym: Math.random() - 0.5,
    shadow,
    meshes,
    mk,
  };
}

export function setSwimmerAttire(P: PersonActor, inSwimwear: boolean) {
  if (!P.casualMesh || !P.swimMesh) return;
  P.inSwimwear = inSwimwear;
  P.casualMesh.visible = !inSwimwear;
  P.swimMesh.visible = inSwimwear;
  P.skinnedMesh = inSwimwear ? P.swimMesh : P.casualMesh;
}

export function setPose(P: PersonActor, name: string, P_LIB: HumanPalette, snap = false) {
  const G = initAnatomyGeos('office');
  P.pose = name;
  P.tgt = POSES[name] || POSES.stand;
  if (snap) {
    for (let i = 0; i < JK.length; i++) {
      const q = JK[i];
      P.cur[q] = P.tgt[q];
    }
  }
  P.typing =
    name === 'type' ||
    name === 'standType' ||
    name === 'standCounter' ||
    name === 'standLowCounter' ||
    name === 'writeNotes';
  P.swing = name === 'stand' || name === 'walk' || name === 'talk' || name === 'present' || name === 'collaborate' ? 1 : 0;
  if (P.shadow) P.shadow.visible = name !== 'swim';

  // Two-handed or desk-supported props
  const frontPropPose = name === 'sit' || name === 'carry' || name === 'readDoc' || name === 'sitReadDoc';
  if (frontPropPose) {
    if (!P.fp) {
      P.fp = P.mk(G.laptop, P_LIB.laptopProp, P.tor, 0, 0, 0, 1, 1, 1, false);
    }
    if (name === 'sit') {
      // Rests squarely on desk surface (y=0.80 world -> center y=0.808 -> y_tor=0.246) directly under fingers
      P.fp.geometry = G.laptop;
      P.fp.material = P_LIB.laptopProp;
      P.fp.position.set(0, 0.246, 0.47);
      P.fp.rotation.set(0, 0, 0);
    } else if (name === 'readDoc' || name === 'sitReadDoc') {
      // Held between both left and right palms in front of torso
      P.fp.geometry = G.folderGeo;
      P.fp.material = P_LIB.folderProp;
      P.fp.position.set(0, 0.42, 0.46);
      P.fp.rotation.set(-0.72, 0, 0);
    } else {
      // Carry box gripped at x = +/-0.18 by both palms
      P.fp.geometry = G.boxProp;
      P.fp.material = P_LIB.boxProp;
      P.fp.position.set(0, 0.33, 0.45);
      P.fp.rotation.set(0, 0, 0);
    }
    P.fp.visible = true;
  } else if (P.fp) {
    P.fp.visible = false;
  }

  // Single-hand props locked directly onto RightHand bone so hands never touch air
  const ear = name === 'phone' || name === 'standPhone' || name === 'radio';
  const hasCup = name === 'coffee';
  const holdingPhone = name === 'hold' || name === 'sitPhone';
  if ((ear || hasCup || holdingPhone) && !P.pe) {
    P.pe = P.mk(G.phone, P_LIB.phone, P.bones.RightHand, 0.024, -0.05, 0.025, 1, 1, 1, false);
    const scr = new THREE.Mesh(G.phoneScreenFace, P_LIB.phoneScreen);
    scr.position.set(0, 0, 0.0044);
    P.pe.add(scr);
    P.peScreen = scr;
  }
  if (P.pe) {
    if (ear) {
      P.pe.geometry = G.phone;
      P.pe.material = P_LIB.phone;
      P.pe.position.set(0.028, -0.05, 0.022);
      P.pe.rotation.set(0.05, 0, -0.15);
      P.pe.visible = true;
      if (P.peScreen) P.peScreen.visible = true;
    } else if (holdingPhone) {
      P.pe.geometry = G.phone;
      P.pe.material = P_LIB.phone;
      P.pe.position.set(0.026, -0.055, 0.024);
      P.pe.rotation.set(Math.PI * 0.42, 0.18, 0);
      P.pe.visible = true;
      if (P.peScreen) P.peScreen.visible = true;
    } else if (hasCup) {
      P.pe.geometry = G.mugGeo;
      P.pe.material = P_LIB.white;
      P.pe.position.set(0.02, -0.055, 0.042);
      P.pe.rotation.set(1.58, 0, -0.15);
      P.pe.visible = true;
      if (P.peScreen) P.peScreen.visible = false;
    } else {
      P.pe.visible = false;
      if (P.peScreen) P.peScreen.visible = false;
    }
  }
  if (snap) {
    updatePersonKinematics(P, 0, 0, 0);
  }
}

export function createGuideActor(
  P_LIB: HumanPalette,
  M: MaterialLibrary
): {
  actor: PersonActor;
  marker: THREE.Group;
  meshes: THREE.Mesh[];
} {
  const blazerMat = new THREE.MeshStandardMaterial({
    color: 0x22784e,
    normalMap: getHumanMicroMaps().weaveNormalTex,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.82,
    metalness: 0,
    envMapIntensity: 0.24,
  });

  const actor = makePerson(
    {
      name: 'Zuri Mwangi',
      skin: P_LIB.skins[0],
      shirt: blazerMat,
      hair: P_LIB.hairs[0],
      trou: P_LIB.trous[0],
      s: 1.05,
      fem: true,
      hs: 1,
      hairStyle: 'bun',
      outfit: 'suit',
      skirt: 'short',
      shoeStyle: 'flat',
      warmSmile: true,
      detail: 'studio',
      faceSize: 768,
    },
    P_LIB,
    M
  );

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
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  gl.scale.set(0.65, 0.65, 1);
  marker.add(gl);

  return { actor, marker, meshes: actor.meshes };
}

const _fpTorMat = new THREE.Matrix4();
const _fpInvMat = new THREE.Matrix4();
const _fpTargetPos = new THREE.Vector3();

/**
 * Updates skeletal humanoid bone transforms per frame from interpolated joint targets + gait/breathing/blinking.
 */
export function updatePersonKinematics(P: PersonActor, dt: number, t: number, glanceYaw: number) {
  const c = P.cur;
  const tg = P.tgt;
  const k = 1 - Math.exp(-dt * 5.8);
  for (let i = 0; i < JK.length; i++) {
    const q = JK[i];
    c[q] += (tg[q] - c[q]) * k;
  }

  const isSwimming = P.pose === 'swim';
  const isWalking = !isSwimming && (P.moving || P.pose === 'walk');
  let sw = 0;
  if (isSwimming) {
    P.phase += dt * 4.2;
  } else if (isWalking) {
    P.phase += dt * 7.2;
    sw = Math.sin(P.phase);
  }

  const isSeated = !isSwimming && c.thigh < -0.5;
  const strideBounce = isSwimming
    ? Math.sin(P.phase * 2) * 0.015
    : isWalking
      ? Math.abs(Math.sin(P.phase)) * 0.022
      : Math.sin(t * 1.5 + P.phase) * 0.003;
  const b = P.bones;

  b.Hips.position.y = c.hipY + strideBounce;
  b.Hips.position.z = c.hipZ || 0;
  if (isSwimming) {
    b.Hips.rotation.x = Math.PI * 0.45 + Math.sin(P.phase * 2) * 0.025;
    b.Hips.rotation.y = 0;
    b.Hips.rotation.z = Math.sin(P.phase) * 0.22;
  } else {
    b.Hips.rotation.x = 0;
    b.Hips.rotation.y = isWalking ? sw * 0.065 : 0;
    b.Hips.rotation.z = !isWalking && !isSeated ? P.asym * 0.032 : 0;
  }

  if (isSwimming) {
    const kick = Math.sin(P.phase * 3.0);
    b.LeftUpLeg.rotation.x = 0.1 + kick * 0.26;
    b.RightUpLeg.rotation.x = 0.1 - kick * 0.26;
    b.LeftLeg.rotation.x = 0.16 + Math.max(0, -kick) * 0.28;
    b.RightLeg.rotation.x = 0.16 + Math.max(0, kick) * 0.28;
    b.LeftFoot.rotation.x = 0.24 + kick * 0.14;
    b.RightFoot.rotation.x = 0.24 - kick * 0.14;
  } else {
    const lThigh = c.thigh + sw * 0.58;
    const rThigh = c.thigh - sw * 0.58;
    const lKnee = c.knee + Math.max(0, -sw) * 0.7;
    const rKnee = c.knee + Math.max(0, sw) * 0.7;
    b.LeftUpLeg.rotation.x = lThigh;
    b.RightUpLeg.rotation.x = rThigh;
    b.LeftLeg.rotation.x = lKnee;
    b.RightLeg.rotation.x = rKnee;
    b.LeftFoot.rotation.x = isWalking ? Math.max(-0.22, -sw * 0.25) : 0;
    b.RightFoot.rotation.x = isWalking ? Math.max(-0.22, sw * 0.25) : 0;
  }

  const breath = Math.sin(t * 1.6 + P.phase) * 0.011;
  const leanPart = isSwimming ? 0.02 : (c.lean + breath) * 0.34;
  const twistTotal = isSwimming ? -Math.sin(P.phase) * 0.18 : isWalking ? -sw * 0.085 : c.spineTwist || 0;
  const tiltZ = !isSwimming && !isWalking && !isSeated ? -P.asym * 0.012 : 0;

  b.Spine.rotation.set(leanPart, twistTotal * 0.3, tiltZ);
  b.Spine1.rotation.set(leanPart, twistTotal * 0.35, tiltZ * 0.5);
  b.Spine2.rotation.set(leanPart, twistTotal * 0.35, -tiltZ * 0.5);
  b.Spine2.scale.y = 1 + Math.sin(t * 1.6 + P.phase) * 0.009;

  // Keep desk-supported sit laptop resting flush on the y=0.80 tabletop regardless of torso lean or actor scale
  if (P.fp && P.fp.visible && P.pose === 'sit') {
    const s = P.body.scale.y || 1;
    b.Hips.updateMatrix();
    b.Spine.updateMatrix();
    b.Spine1.updateMatrix();
    b.Spine2.updateMatrix();
    P.tor.updateMatrix();
    _fpTorMat
      .copy(b.Hips.matrix)
      .multiply(b.Spine.matrix)
      .multiply(b.Spine1.matrix)
      .multiply(b.Spine2.matrix)
      .multiply(P.tor.matrix);
    _fpInvMat.copy(_fpTorMat).invert();
    _fpTargetPos.set(0, 0.808 / s, 0.46 / s).applyMatrix4(_fpInvMat);
    P.fp.position.copy(_fpTargetPos);
    P.fp.rotation.set(-leanPart * 3, -twistTotal, 0);
  }

  // Rotational 3D upper eyelid blink over spherical eyeballs
  if (P.eg.length >= 2) {
    const isBlink = ((t * 0.3 + P.phase * 0.37) % 1) < 0.036;
    const lidPitch = isBlink ? 0.48 : 0.1;
    P.eg[0].rotation.x = lidPitch;
    P.eg[1].rotation.x = lidPitch;
  }

  let hy = c.hy + P.look * Math.sin(t * 0.45 + P.phase);
  const hx = isSwimming ? -0.78 + Math.sin(P.phase * 2) * 0.06 : c.hx;
  if (isSwimming) {
    hy = Math.max(0, Math.sin(P.phase)) * 0.34;
  }
  const tapWave = P.typing ? Math.sin(t * 13 + P.phase) : 0;
  const wTapL = P.typing ? Math.max(0, tapWave) : 0;
  const wTapR = P.typing ? Math.max(0, -tapWave) : 0;
  let gx = 0;
  let ge = 0;
  if (P.gest && !isWalking && !isSwimming) {
    gx = Math.sin(t * 2.2 + P.phase) * 0.22;
    ge = Math.sin(t * 3.0 + P.phase) * 0.26;
    hy += Math.sin(t * 1.2 + P.phase) * 0.18;
  }

  b.Neck.rotation.set(hx * 0.35, (hy + glanceYaw) * 0.35, P.asym * 0.02);
  b.Head.rotation.set(hx * 0.65, (hy + glanceYaw) * 0.65, P.asym * 0.045);

  if (isSwimming) {
    const phL = P.phase;
    const phR = P.phase + Math.PI;
    b.LeftArm.rotation.x = phL;
    b.LeftArm.rotation.z = 0.24 + Math.sin(phL) * 0.08;
    b.RightArm.rotation.x = phR;
    b.RightArm.rotation.z = -0.24 - Math.sin(phR) * 0.08;
    b.LeftForeArm.rotation.x = -0.28 - Math.max(0, -Math.sin(phL)) * 0.55;
    b.LeftForeArm.rotation.y = 0;
    b.RightForeArm.rotation.x = -0.28 - Math.max(0, -Math.sin(phR)) * 0.55;
    b.RightForeArm.rotation.y = 0;
    b.LeftHand.rotation.z = 0;
    b.RightHand.rotation.z = 0;
  } else {
    // Height-scale compensation keeps hands strictly above fixed-height desks/keyboards across scales 0.94..1.10
    const s = P.body.scale.y || 1;
    const deltaS = 1 - s;
    const deskArmL = !isWalking && !P.gest && c.fLy < -1.1 ? 1 : 0;
    const deskArmR = !isWalking && !P.gest && c.fRy > 1.1 ? 1 : 0;
    const ds = deltaS * 1.4;
    const de = deltaS * 0.22;

    b.LeftArm.rotation.x = c.sLx - deskArmL * ds - sw * 0.46 * P.swing;
    b.LeftArm.rotation.z = c.sLz + P.asym * 0.025;
    b.RightArm.rotation.x = c.sRx - deskArmR * ds + sw * 0.46 * P.swing + gx;
    b.RightArm.rotation.z = c.sRz + P.asym * 0.025;
    b.LeftForeArm.rotation.x = c.eL - deskArmL * de - wTapL * 0.032;
    b.LeftForeArm.rotation.y = isWalking ? 0 : c.fLy || 0;
    b.RightForeArm.rotation.x = c.eR - deskArmR * de - wTapR * 0.032 + ge;
    b.RightForeArm.rotation.y = isWalking ? 0 : c.fRy || 0;
    b.LeftHand.rotation.z = isWalking ? 0 : (c.hLz || 0) + wTapL * 0.06;
    b.RightHand.rotation.z = isWalking ? 0 : (c.hRz || 0) - wTapR * 0.06;
  }

  let dy = P.tyaw - P.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  P.yaw += dy * (1 - Math.exp(-dt * 8.5));
  P.g.rotation.y = P.yaw;
}

/* =========================================================
   CURATED AFRICAN TECH TEAM ROSTER & GLB EXPORTER
   ========================================================= */
export interface CharacterRosterPreset {
  id: string;
  name: string;
  age: number;
  role: string;
  bio: string;
  defaultPose: string;
  options: (P_LIB: HumanPalette) => MakePersonOptions;
}

export const OFFICE_CHARACTER_ROSTER: CharacterRosterPreset[] = [
  {
    id: 'amina-ochieng',
    name: 'Amina Ochieng',
    age: 31,
    role: 'Lead Product Architect',
    bio: 'Tailored slate-navy collared sheath dress, coiled topknot bun, sleek eyewear & leather belt',
    defaultPose: 'present',
    options: (P) => ({
      name: 'Amina Ochieng',
      skin: P.skins[0],
      shirt: P.shirts[10],
      hair: P.hairs[0],
      trou: P.trous[4],
      fem: true,
      hairStyle: 'bun',
      outfit: 'dress',
      skirt: 'short',
      sleeve: 'sleeveless',
      shoeStyle: 'flat',
      glasses: true,
      faceVariant: 1,
      warmSmile: false,
      detail: 'studio',
      faceSize: 1024,
    }),
  },
  {
    id: 'kamau-njoroge',
    name: 'Kamau Njoroge',
    age: 36,
    role: 'Chief Technology Officer',
    bio: 'Tailored charcoal wool blazer, open crisp white shirt, tapered fade & groomed beard',
    defaultPose: 'talk',
    options: (P) => ({
      name: 'Kamau Njoroge',
      skin: P.skins[1],
      shirt: P.shirts[2],
      hair: P.hairs[1],
      trou: P.trous[0],
      fem: false,
      hairStyle: 'fade',
      beardStyle: 'full',
      outfit: 'suit',
      blazer: true,
      shoeStyle: 'oxford',
      faceVariant: 2,
      warmSmile: true,
      detail: 'studio',
      faceSize: 1024,
      s: 1.04,
    }),
  },
  {
    id: 'wanjiku-kariuki',
    name: 'Wanjiku Kariuki',
    age: 34,
    role: 'Head of Engineering',
    bio: 'Ivory rolled-sleeve blouse, cobalt midi skirt, shoulder-length box braids & heels',
    defaultPose: 'collaborate',
    options: (P) => ({
      name: 'Wanjiku Kariuki',
      skin: P.skins[4],
      shirt: P.shirts[1],
      hair: P.hairs[0],
      trou: P.trous[3],
      fem: true,
      hairStyle: 'braids',
      outfit: 'blouseSkirt',
      sleeve: 'rolled',
      skirt: 'midi',
      shoeStyle: 'heel',
      faceVariant: 0,
      warmSmile: true,
      detail: 'studio',
      faceSize: 1024,
    }),
  },
  {
    id: 'kwame-mensah',
    name: 'Kwame Mensah',
    age: 29,
    role: 'Senior AI Engineer',
    bio: 'Textured charcoal ribbed knit sweater, smart chinos, coily twists & court sneakers',
    defaultPose: 'type',
    options: (P) => ({
      name: 'Kwame Mensah',
      skin: P.skins[3],
      shirt: P.knits[0],
      hair: P.hairs[0],
      trou: P.trous[2],
      fem: false,
      hairStyle: 'twists',
      beardStyle: 'stubble',
      outfit: 'knit',
      shoeStyle: 'sneaker',
      glasses: true,
      faceVariant: 0,
      detail: 'studio',
      faceSize: 1024,
    }),
  },
  {
    id: 'zuri-mwangi',
    name: 'Zuri Mwangi',
    age: 27,
    role: 'Experience & Brand Guide',
    bio: 'Emerald tailored blazer & skirt suit, sculpted low chignon bun & leather flats',
    defaultPose: 'present',
    options: (P) => ({
      name: 'Zuri Mwangi',
      skin: P.skins[0],
      shirt: P.shirts[9],
      hair: P.hairs[0],
      trou: P.trous[0],
      fem: true,
      hairStyle: 'bun',
      outfit: 'suit',
      blazer: true,
      skirt: 'short',
      shoeStyle: 'flat',
      warmSmile: true,
      detail: 'studio',
      faceSize: 1024,
      s: 1.03,
    }),
  },
  {
    id: 'chidi-okafor',
    name: 'Chidi Okafor',
    age: 41,
    role: 'VP Strategy & Advisory',
    bio: 'Navy bespoke suit, burgundy silk tie, eyewear, clean crop & salt-and-pepper stubble',
    defaultPose: 'meeting',
    options: (P) => ({
      name: 'Chidi Okafor',
      skin: P.skins[5],
      shirt: P.shirts[0],
      hair: P.hairs[5],
      trou: P.trous[3],
      fem: false,
      hairStyle: 'fade',
      beardStyle: 'stubble',
      outfit: 'suit',
      blazer: true,
      tie: 0x8a1f2e,
      shoeStyle: 'oxford',
      glasses: true,
      faceVariant: 3,
      detail: 'studio',
      faceSize: 1024,
      s: 1.05,
    }),
  },
  {
    id: 'nia-adebayo',
    name: 'Nia Adebayo',
    age: 25,
    role: 'Front-End Developer',
    bio: 'Olive ribbed knit sweater, tailored trousers, voluminous natural afro & studio headphones',
    defaultPose: 'leanScreen',
    options: (P) => ({
      name: 'Nia Adebayo',
      skin: P.skins[2],
      shirt: P.knits[1],
      hair: P.hairs[0],
      trou: P.trous[1],
      fem: true,
      hairStyle: 'afro',
      outfit: 'knit',
      shoeStyle: 'sneaker',
      headphones: true,
      faceVariant: 2,
      detail: 'studio',
      faceSize: 1024,
      s: 0.96,
    }),
  },
  {
    id: 'tariq-hassan',
    name: 'Tariq Hassan',
    age: 33,
    role: 'Solutions Consultant',
    bio: 'Long tailored slate coat over dark knitwear, smart trousers, oxfords & coffee cup',
    defaultPose: 'coffee',
    options: (P) => ({
      name: 'Tariq Hassan',
      skin: P.skins[6],
      shirt: P.shirts[5],
      hair: P.hairs[2],
      trou: P.trous[4],
      fem: false,
      hairStyle: 'fade',
      beardStyle: 'full',
      coat: true,
      outfit: 'shirtTrousers',
      shoeStyle: 'oxford',
      faceVariant: 1,
      detail: 'studio',
      faceSize: 1024,
      s: 1.02,
    }),
  },
  {
    id: 'faith-mutua',
    name: 'Faith Mutua',
    age: 28,
    role: 'Digital Marketing Lead',
    bio: 'Ochre tailored blazer, ivory shell top, dark trousers, layered bob & pointed heels',
    defaultPose: 'phone',
    options: (P) => ({
      name: 'Faith Mutua',
      skin: P.skins[7],
      shirt: P.shirts[7],
      hair: P.hairs[1],
      trou: P.trous[0],
      fem: true,
      hairStyle: 'bob',
      outfit: 'suit',
      blazer: true,
      shoeStyle: 'heel',
      warmSmile: true,
      faceVariant: 3,
      detail: 'studio',
      faceSize: 1024,
    }),
  },
  {
    id: 'juma-otieno',
    name: 'Juma Otieno',
    age: 43,
    role: 'Managing Director',
    bio: 'Deep navy suit, executive silk tie, brown derby oxfords & thoughtful standing poise',
    defaultPose: 'readDoc',
    options: (P) => ({
      name: 'Juma Otieno',
      skin: P.skins[1],
      shirt: P.shirts[0],
      hair: P.hairs[0],
      trou: P.trous[0],
      fem: false,
      hairStyle: 'fade',
      beardStyle: 'full',
      outfit: 'suit',
      blazer: true,
      tie: 0x2e64b8,
      shoeStyle: 'oxford',
      faceVariant: 2,
      detail: 'studio',
      faceSize: 1024,
      s: 1.08,
    }),
  },
  {
    id: 'sanaa-diallo',
    name: 'Sanaa Diallo',
    age: 26,
    role: 'UI/UX Designer',
    bio: 'Sleeveless slate blouse, warm camel midi skirt, cropped textured pixie & heels',
    defaultPose: 'writeNotes',
    options: (P) => ({
      name: 'Sanaa Diallo',
      skin: P.skins[4],
      shirt: P.shirts[2],
      hair: P.hairs[0],
      trou: P.trous[2],
      fem: true,
      hairStyle: 'pixie',
      outfit: 'blouseSkirt',
      sleeve: 'sleeveless',
      skirt: 'midi',
      shoeStyle: 'heel',
      glasses: true,
      faceVariant: 0,
      detail: 'studio',
      faceSize: 1024,
      s: 0.97,
    }),
  },
  {
    id: 'bramwell-kiprop',
    name: 'Bramwell Kiprop',
    age: 30,
    role: 'Infrastructure & Security Lead',
    bio: 'Navy short-sleeve tailored uniform shirt, utility trousers, ID badge & leather oxfords',
    defaultPose: 'hold',
    options: (P) => ({
      name: 'Bramwell Kiprop',
      skin: P.skins[3],
      shirt: P.shirts[0],
      hair: P.hairs[3],
      trou: P.trous[4],
      fem: false,
      hairStyle: 'fade',
      beardStyle: 'none',
      outfit: 'shirtTrousers',
      sleeve: 'short',
      shoeStyle: 'oxford',
      lanyard: true,
      faceVariant: 1,
      detail: 'studio',
      faceSize: 1024,
      s: 1.06,
    }),
  },
];

export async function exportActorToGLB(actor: PersonActor, filename = 'character.glb'): Promise<void> {
  const exporter = new GLTFExporter();

  const shadowChildren: THREE.Object3D[] = [];
  actor.g.traverse((obj) => {
    if (obj !== actor.skinnedMesh && obj instanceof THREE.Mesh && obj.geometry instanceof THREE.PlaneGeometry) {
      shadowChildren.push(obj);
      obj.visible = false;
    }
  });

  try {
    const buffer = await exporter.parseAsync(actor.body, {
      binary: true,
      animations: actor.clips,
      onlyVisible: true,
    });
    if (buffer instanceof ArrayBuffer) {
      const blob = new Blob([buffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } finally {
    for (const c of shadowChildren) c.visible = true;
  }
}
