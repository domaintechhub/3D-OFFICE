import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Standard Mixamo / glTF Humanoid 20-bone hierarchy used across DomainTechHub Office.
 */
export const RIG_BONE_NAMES = [
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

export type RigBoneName = (typeof RIG_BONE_NAMES)[number];
export type RigBoneMap = Record<RigBoneName, THREE.Bone>;

export interface CharacterGlbManifestEntry {
  presetId: string;
  displayName: string;
  /** Expected local path inside /public/models/characters/ when external rigged GLBs are supplied */
  expectedPath: string;
  rigConvention: 'mixamo' | 'rpm' | 'gltf-humanoid';
  targetHeightMeters: number;
  /** True only when a verified hosted .glb file has been placed in /public/models/characters/ */
  enabled: boolean;
}

/**
 * Manifest for optional external photorealistic rigged .glb human characters
 * (e.g. Renderpeople, AXYZ, Ready Player Me, or Mixamo-rigged Blender exports).
 * Note: entries remain `enabled: false` until the corresponding .glb binaries exist
 * under `/public/models/characters/` so the app never emits 404 network requests.
 */
export const CHARACTER_GLB_MANIFEST: CharacterGlbManifestEntry[] = [
  {
    presetId: 'amina-ochieng',
    displayName: 'Amina Ochieng',
    expectedPath: '/models/characters/amina-ochieng.glb',
    rigConvention: 'rpm',
    targetHeightMeters: 1.7,
    enabled: false,
  },
  {
    presetId: 'kamau-njoroge',
    displayName: 'Kamau Njoroge',
    expectedPath: '/models/characters/kamau-njoroge.glb',
    rigConvention: 'mixamo',
    targetHeightMeters: 1.79,
    enabled: false,
  },
  {
    presetId: 'wanjiku-kariuki',
    displayName: 'Wanjiku Kariuki',
    expectedPath: '/models/characters/wanjiku-kariuki.glb',
    rigConvention: 'rpm',
    targetHeightMeters: 1.71,
    enabled: false,
  },
  {
    presetId: 'kwame-mensah',
    displayName: 'Kwame Mensah',
    expectedPath: '/models/characters/kwame-mensah.glb',
    rigConvention: 'mixamo',
    targetHeightMeters: 1.76,
    enabled: false,
  },
  {
    presetId: 'zuri-mwangi',
    displayName: 'Zuri Mwangi',
    expectedPath: '/models/characters/zuri-mwangi.glb',
    rigConvention: 'rpm',
    targetHeightMeters: 1.74,
    enabled: false,
  },
  {
    presetId: 'chidi-okafor',
    displayName: 'Chidi Okafor',
    expectedPath: '/models/characters/chidi-okafor.glb',
    rigConvention: 'mixamo',
    targetHeightMeters: 1.81,
    enabled: false,
  },
];

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

const GLB_TEMPLATE_CACHE = new Map<string, { scene: THREE.Group; animations: THREE.AnimationClip[] }>();

let sharedLoader: GLTFLoader | null = null;
function getGlbLoader(): GLTFLoader {
  if (sharedLoader) return sharedLoader;
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  // Use standard Google-hosted Draco WASM decoder only if a compressed external GLB is explicitly loaded by the user
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);
  sharedLoader = loader;
  return loader;
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

/**
 * Retargets Mixamo, Ready Player Me, Blender Rigify, or generic glTF humanoid skeletons
 * onto our canonical 20-bone RigBoneMap.
 */
export function retargetBoneMap(root: THREE.Object3D): {
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
      // Substring fallback (handles namespaces like "Armature|mixamorig:LeftArm")
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

/**
 * Calibrates imported glTF/GLB PBR materials to remove glossy plastic skin or shiny fabric artifacts
 * and guarantee valid SRGB/Linear color spaces.
 */
export function calibrateImportedCharacterMaterials(root: THREE.Object3D): void {
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
        // Tailored garments: prevent metallic/plastic cloth artifacts
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

  // Measure unscaled bounds and normalize height + ground sole flush at y = 0
  const box = new THREE.Box3().setFromObject(clonedScene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

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

/**
 * Loads an external rigged .glb/.gltf human model from URL with SkeletonUtils cloning & caching.
 */
export async function loadRiggedGlbFromUrl(
  url: string,
  targetHeightMeters = 1.72
): Promise<LoadedGlbCharacter> {
  let cached = GLB_TEMPLATE_CACHE.get(url);
  if (!cached) {
    const loader = getGlbLoader();
    const gltf = await loader.loadAsync(url);
    cached = { scene: gltf.scene, animations: gltf.animations || [] };
    GLB_TEMPLATE_CACHE.set(url, cached);
  }
  const cloned = SkeletonUtils.clone(cached.scene) as THREE.Group;
  return finalizeNormalizedGlbRoot(cloned, cached.animations, url, targetHeightMeters);
}

/**
 * Parses a user-provided local .glb / .gltf File (via drag-and-drop or file picker in Character Studio).
 */
export async function loadRiggedGlbFromFile(
  file: File,
  targetHeightMeters = 1.72
): Promise<LoadedGlbCharacter> {
  const buffer = await file.arrayBuffer();
  const loader = getGlbLoader();
  const gltf = await loader.parseAsync(buffer, '');
  return finalizeNormalizedGlbRoot(gltf.scene, gltf.animations || [], file.name, targetHeightMeters);
}

export function getCharacterPipelineSummary(): {
  enabledExternalSlots: number;
  totalManifestSlots: number;
  expectedPaths: string[];
} {
  const enabled = CHARACTER_GLB_MANIFEST.filter((e) => e.enabled);
  return {
    enabledExternalSlots: enabled.length,
    totalManifestSlots: CHARACTER_GLB_MANIFEST.length,
    expectedPaths: CHARACTER_GLB_MANIFEST.map((e) => e.expectedPath),
  };
}
