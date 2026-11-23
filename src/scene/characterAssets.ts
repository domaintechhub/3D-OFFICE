import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

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

export interface AssetLoadProgress {
  percent: number;
  stage: string;
  loaded: number;
  total: number;
}

export interface ManagedGltfOptions {
  renderer?: THREE.WebGLRenderer | null;
  dracoDecoderPath?: string;
  ktx2TranscoderPath?: string;
  onProgress?: (progress: AssetLoadProgress) => void;
}

/**
 * Creates a GLTFLoader backed by a THREE.LoadingManager (with DRACOLoader & KTX2Loader)
 * so callers receive unified onProgress telemetry across geometry, textures, and buffers.
 */
export function createManagedGltfLoader(options: ManagedGltfOptions = {}): {
  manager: THREE.LoadingManager;
  loader: GLTFLoader;
  dispose: () => void;
} {
  const manager = new THREE.LoadingManager();
  let lastStage = 'Preparing 3D assets…';

  manager.onStart = (_url, itemsLoaded, itemsTotal) => {
    const pct = itemsTotal > 0 ? Math.round((itemsLoaded / itemsTotal) * 100) : 0;
    options.onProgress?.({
      percent: pct,
      stage: lastStage,
      loaded: itemsLoaded,
      total: itemsTotal,
    });
  };

  manager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const cleanName = url ? url.split('/').pop() || url : lastStage;
    const pct = itemsTotal > 0 ? Math.min(99, Math.round((itemsLoaded / itemsTotal) * 100)) : 50;
    options.onProgress?.({
      percent: pct,
      stage: `Loading ${cleanName}`,
      loaded: itemsLoaded,
      total: itemsTotal,
    });
  };

  manager.onLoad = () => {
    options.onProgress?.({
      percent: 100,
      stage: '3D assets ready',
      loaded: 1,
      total: 1,
    });
  };

  const loader = new GLTFLoader(manager);

  const draco = new DRACOLoader(manager);
  if (options.dracoDecoderPath) {
    draco.setDecoderPath(options.dracoDecoderPath);
  }
  loader.setDRACOLoader(draco);

  const ktx2 = new KTX2Loader(manager);
  if (options.ktx2TranscoderPath) {
    ktx2.setTranscoderPath(options.ktx2TranscoderPath);
  }
  if (options.renderer) {
    try {
      ktx2.detectSupport(options.renderer);
    } catch {
      // Software WebGL or headless context without compressed texture support
    }
  }
  loader.setKTX2Loader(ktx2);

  return {
    manager,
    loader,
    dispose: () => {
      draco.dispose();
      ktx2.dispose();
    },
  };
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
const FILE_SLICE_BYTES = 512 * 1024;

async function readFileWithProgress(
  file: File,
  onSlice: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
  if (file.size <= FILE_SLICE_BYTES) {
    const buf = await file.arrayBuffer();
    onSlice(file.size, file.size);
    return buf;
  }

  const combined = new Uint8Array(file.size);
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(file.size, offset + FILE_SLICE_BYTES);
    const sliceBuf = await file.slice(offset, end).arrayBuffer();
    combined.set(new Uint8Array(sliceBuf), offset);
    offset = end;
    onSlice(offset, file.size);
  }
  return combined.buffer;
}

/**
 * Parses a user-provided local .glb / .gltf File (via drag-and-drop or file picker in Character Studio)
 * with LoadingManager + GLTF/DRACO/KTX2 pipeline progress feedback.
 */
export async function loadRiggedGlbFromFile(
  file: File,
  targetHeightMeters = 1.72,
  onProgress?: (progress: AssetLoadProgress) => void,
  renderer?: THREE.WebGLRenderer | null
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

  onProgress?.({ percent: 4, stage: `Reading ${file.name}…`, loaded: 0, total: file.size });

  const buffer = await readFileWithProgress(file, (loaded, total) => {
    const pct = Math.min(58, Math.max(5, Math.round((loaded / Math.max(1, total)) * 58)));
    onProgress?.({
      percent: pct,
      stage: `Reading ${file.name}…`,
      loaded,
      total,
    });
  });

  const bytes = new Uint8Array(buffer);
  if (isGlb) {
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

  onProgress?.({ percent: 68, stage: 'Decoding glTF / mesh buffers…', loaded: file.size, total: file.size });

  const managed = createManagedGltfLoader({
    renderer,
    onProgress: (p) => {
      onProgress?.({
        percent: Math.max(70, Math.min(95, Math.round(70 + p.percent * 0.25))),
        stage: p.stage,
        loaded: p.loaded,
        total: p.total,
      });
    },
  });

  try {
    managed.manager.itemStart(file.name);
    const gltf = await managed.loader.parseAsync(buffer, '');
    onProgress?.({ percent: 94, stage: 'Retargeting 20-bone rig…', loaded: file.size, total: file.size });
    const normalized = finalizeNormalizedGlbRoot(
      gltf.scene,
      gltf.animations || [],
      file.name,
      targetHeightMeters
    );
    managed.manager.itemEnd(file.name);
    onProgress?.({ percent: 100, stage: `Loaded ${file.name}`, loaded: file.size, total: file.size });
    return normalized;
  } catch (err) {
    managed.manager.itemError(file.name);
    const msg = err instanceof Error ? err.message : String(err);
    if (/draco/i.test(msg)) {
      throw new Error('This .glb uses external Draco wasm decoders. Export uncompressed .glb or provide decoder assets.');
    }
    throw err;
  } finally {
    managed.dispose();
  }
}

/**
 * Loads a rigged .glb/.gltf model from a URL using THREE.LoadingManager onProgress telemetry.
 */
export async function loadRiggedGlbFromUrl(
  url: string,
  targetHeightMeters = 1.72,
  options: ManagedGltfOptions = {}
): Promise<LoadedGlbCharacter> {
  const managed = createManagedGltfLoader(options);
  try {
    const gltf: GLTF = await new Promise((resolve, reject) => {
      managed.loader.load(
        url,
        (parsed) => resolve(parsed),
        (evt) => {
          if (evt.lengthComputable && evt.total > 0) {
            const pct = Math.min(96, Math.round((evt.loaded / evt.total) * 96));
            options.onProgress?.({
              percent: pct,
              stage: `Downloading ${url.split('/').pop() || 'model'}…`,
              loaded: evt.loaded,
              total: evt.total,
            });
          }
        },
        (err) => reject(err instanceof Error ? err : new Error(String(err)))
      );
    });
    const sourceName = url.split('/').pop() || 'character.glb';
    const res = finalizeNormalizedGlbRoot(gltf.scene, gltf.animations || [], sourceName, targetHeightMeters);
    options.onProgress?.({ percent: 100, stage: `Loaded ${sourceName}`, loaded: 1, total: 1 });
    return res;
  } finally {
    managed.dispose();
  }
}
