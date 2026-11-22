import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Standard Mixamo / glTF Humanoid 20-bone hierarchy used across DomainTechHub Office.
 */
const RIG_BONE_NAMES = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Neck',
  'Head',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
] as const;

type RigBoneName = (typeof RIG_BONE_NAMES)[number];
type RigBoneMap = Record<RigBoneName, THREE.Bone>;

export interface LoadedGlbCharacter {
  root: THREE.Group;
  skinnedMeshes: THREE.SkinnedMesh[];
  bones: Partial<RigBoneMap>;
  clips: THREE.AnimationClip[];
  sourceName: string;
  triangleCount: number;
  boneCount: number;
  heightMeters: number;
  missingBones: RigBoneName[];
}

let sharedLoader: GLTFLoader | null = null;
function getGlbLoader(): GLTFLoader {
  if (!sharedLoader) {
    sharedLoader = new GLTFLoader();
  }
  return sharedLoader;
}

const BONE_ALIAS_TABLE: Record<RigBoneName, string[]> = {
  Hips: ['hips', 'pelvis', 'root_hips', 'mixamorighips', 'bip01_pelvis'],
  Spine: ['spine', 'spine01', 'mixamorigspine', 'torso_01'],
  Spine1: ['spine1', 'spine02', 'chest', 'mixamorigspine1'],
  Spine2: ['spine2', 'spine03', 'upperchest', 'mixamorigspine2'],
  Neck: ['neck', 'neck01', 'mixamorigneck'],
  Head: ['head', 'mixamorighead'],
  LeftShoulder: ['leftshoulder', 'clavicle_l', 'shoulder_l', 'mixamorigleftshoulder'],
  LeftArm: ['leftarm', 'leftupperarm', 'upperarm_l', 'arm_l', 'mixamorigleftarm'],
  LeftForeArm: ['leftforearm', 'leftlowerarm', 'lowerarm_l', 'forearm_l', 'mixamorigleftforearm'],
  LeftHand: ['lefthand', 'hand_l', 'wrist_l', 'mixamoriglefthand'],
  RightShoulder: ['rightshoulder', 'clavicle_r', 'shoulder_r', 'mixamorigrightshoulder'],
  RightArm: ['rightarm', 'rightupperarm', 'upperarm_r', 'arm_r', 'mixamorigrightarm'],
  RightForeArm: ['rightforearm', 'rightlowerarm', 'lowerarm_r', 'forearm_r', 'mixamorigrightforearm'],
  RightHand: ['righthand', 'hand_r', 'wrist_r', 'mixamorigrighthand'],
  LeftUpLeg: ['leftupleg', 'leftthigh', 'thigh_l', 'upleg_l', 'mixamorigleftupleg'],
  LeftLeg: ['leftleg', 'leftcalf', 'leftshin', 'calf_l', 'leg_l', 'mixamorigleftleg'],
  LeftFoot: ['leftfoot', 'foot_l', 'ankle_l', 'mixamorigleftfoot'],
  RightUpLeg: ['rightupleg', 'rightthigh', 'thigh_r', 'upleg_r', 'mixamorigrightupleg'],
  RightLeg: ['rightleg', 'rightcalf', 'rightshin', 'calf_r', 'leg_r', 'mixamorigrightleg'],
  RightFoot: ['rightfoot', 'foot_r', 'ankle_r', 'mixamorigrightfoot'],
};

function normalizeBoneKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function retargetBoneMap(root: THREE.Object3D): {
  bones: Partial<RigBoneMap>;
  totalBones: number;
  missingBones: RigBoneName[];
} {
  const discovered: THREE.Bone[] = [];
  root.traverse((obj) => {
    if (obj instanceof THREE.Bone) discovered.push(obj);
  });

  const byKey = new Map<string, THREE.Bone>();
  for (const b of discovered) {
    byKey.set(normalizeBoneKey(b.name), b);
  }

  const bones: Partial<RigBoneMap> = {};
  const missingBones: RigBoneName[] = [];

  for (const canonical of RIG_BONE_NAMES) {
    const candidates = BONE_ALIAS_TABLE[canonical];
    let match: THREE.Bone | undefined;
    for (const alias of candidates) {
      const normalizedAlias = normalizeBoneKey(alias);
      if (byKey.has(normalizedAlias)) {
        match = byKey.get(normalizedAlias);
        break;
      }
      for (const [k, b] of byKey.entries()) {
        if (k.endsWith(normalizedAlias)) {
          match = b;
          break;
        }
      }
      if (match) break;
    }
    if (match) {
      bones[canonical] = match;
    } else {
      missingBones.push(canonical);
    }
  }

  return { bones, totalBones: discovered.length, missingBones };
}

function calibrateImportedCharacterMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.frustumCulled = false;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
      if (m.normalMap) m.normalMap.colorSpace = THREE.NoColorSpace;
      if (m.roughnessMap) m.roughnessMap.colorSpace = THREE.NoColorSpace;

      const matName = (m.name || obj.name || '').toLowerCase();
      const isEye = /eye|cornea|iris|sclera/.test(matName);
      const isSkin = /skin|head|face|body|hand|arm|leg|neck/.test(matName);
      const isHair = /hair|brow|beard|braid|lash/.test(matName);

      if (isEye) {
        m.roughness = Math.min(m.roughness, 0.14);
        m.metalness = 0;
        m.envMapIntensity = 0.65;
      } else if (isSkin) {
        m.roughness = Math.max(m.roughness, 0.62);
        m.metalness = 0;
        m.envMapIntensity = Math.min(m.envMapIntensity ?? 0.25, 0.22);
        if (m instanceof THREE.MeshPhysicalMaterial) {
          m.clearcoat = 0;
          m.sheen = Math.max(m.sheen, 0.25);
          m.sheenRoughness = 0.78;
        }
      } else if (isHair) {
        m.roughness = Math.max(m.roughness, 0.56);
        m.metalness = 0;
        m.envMapIntensity = Math.min(m.envMapIntensity ?? 0.25, 0.25);
      } else {
        if (m.metalness < 0.35) m.metalness = 0;
        m.roughness = Math.max(m.roughness, 0.68);
        m.envMapIntensity = Math.min(m.envMapIntensity ?? 0.25, 0.24);
      }
      m.needsUpdate = true;
    }
  });
}

function finalizeNormalizedGlbRoot(
  clonedScene: THREE.Group,
  animations: THREE.AnimationClip[],
  sourceName: string,
  targetHeightMeters = 1.72
): LoadedGlbCharacter {
  const wrapper = new THREE.Group();
  wrapper.add(clonedScene);
  clonedScene.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(clonedScene);
  const size = new THREE.Vector3();
  box.getSize(size);

  const rawHeight = Math.max(0.01, size.y);
  const scaleFactor = targetHeightMeters / rawHeight;
  clonedScene.scale.multiplyScalar(scaleFactor);
  clonedScene.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(clonedScene);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);
  clonedScene.position.x -= scaledCenter.x;
  clonedScene.position.z -= scaledCenter.z;
  clonedScene.position.y -= scaledBox.min.y;
  clonedScene.updateMatrixWorld(true);

  calibrateImportedCharacterMaterials(clonedScene);

  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  let triangleCount = 0;
  clonedScene.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh) {
      skinnedMeshes.push(obj);
    }
    if (obj instanceof THREE.Mesh && obj.geometry) {
      const geo = obj.geometry;
      triangleCount += geo.index ? Math.floor(geo.index.count / 3) : Math.floor(geo.attributes.position.count / 3);
    }
  });

  const { bones, totalBones, missingBones } = retargetBoneMap(clonedScene);
  const finalBox = new THREE.Box3().setFromObject(wrapper);

  return {
    root: wrapper,
    skinnedMeshes,
    bones,
    clips: animations.map((c) => c.clone()),
    sourceName,
    triangleCount,
    boneCount: totalBones,
    heightMeters: Number((finalBox.max.y - finalBox.min.y).toFixed(2)),
    missingBones,
  };
}

const MAX_CHARACTER_MODEL_BYTES = 50 * 1024 * 1024; // 50 MB safety cap

/**
 * Parses a user-provided local .glb / .gltf File (via drag-and-drop or file picker in Character Studio).
 */
export async function loadRiggedGlbFromFile(
  file: File,
  targetHeightMeters = 1.72
): Promise<LoadedGlbCharacter> {
  const lowerName = file.name.trim().toLowerCase();
  const isGlb = lowerName.endsWith('.glb');
  const isGltf = lowerName.endsWith('.gltf');
  if (!isGlb && !isGltf) {
    throw new Error('Only .glb or .gltf character model files are supported.');
  }
  if (file.size <= 0 || file.size > MAX_CHARACTER_MODEL_BYTES) {
    throw new Error('Character model file must be between 1 byte and 50 MB.');
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (isGlb) {
    // Binary glTF magic: 0x67 0x6C 0x54 0x46 ("glTF" little-endian 0x46546C67)
    const magicOk =
      bytes.byteLength >= 12 &&
      bytes[0] === 0x67 &&
      bytes[1] === 0x6c &&
      bytes[2] === 0x54 &&
      bytes[3] === 0x46;
    if (!magicOk) {
      throw new Error('Invalid .glb file header.');
    }
  } else {
    const head = new TextDecoder().decode(bytes.subarray(0, 64)).trimStart();
    if (!head.startsWith('{')) {
      throw new Error('Invalid .gltf JSON header.');
    }
  }

  const loader = getGlbLoader();
  try {
    const gltf = await loader.parseAsync(buffer, '');
    return finalizeNormalizedGlbRoot(gltf.scene, gltf.animations || [], file.name, targetHeightMeters);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/draco/i.test(msg)) {
      throw new Error('This .glb uses Draco compression. Export without Draco compression to load locally.');
    }
    throw err;
  }
}
