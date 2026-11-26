import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Download, FolderUp, Play, RotateCw, Square, User, X } from 'lucide-react';
import {
  loadRiggedGlbFromFile,
  type AssetLoadProgress,
  type LoadedGlbCharacter,
} from '../scene/characterAssets';
import { useDialogFocusTrap } from '../utils/useDialogFocusTrap';
import {
  BONE_NAMES,
  OFFICE_CHARACTER_ROSTER,
  OFFICE_POSES_CATALOG,
  createHumanPalette,
  exportActorToGLB,
  makePerson,
  setPose,
  updatePersonKinematics,
  type CharacterRosterPreset,
  type HumanPalette,
  type PersonActor,
} from '../scene/human';
import { getHumanMicroMaps } from '../scene/humanTextures';
import { createMaterials, type MaterialLibrary } from '../scene/materials';
import { getRoundedBox } from '../scene/props';

interface CharacterStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CameraFraming = 'full' | 'portrait' | 'tailoring';
type ClipMode = 'pose' | 'Idle' | 'Walking' | 'SittingWork' | 'Talking';

const SEATED_POSES = new Set([
  'type',
  'sit',
  'meeting',
  'monitorLook',
  'writeNotes',
  'think',
  'phone',
  'leanScreen',
]);

const FRAMING_TARGETS: Record<CameraFraming, { pos: [number, number, number]; target: [number, number, number] }> = {
  full: { pos: [0.65, 1.28, 2.55], target: [0, 0.92, 0] },
  portrait: { pos: [0.18, 1.67, 0.84], target: [0, 1.60, 0.02] },
  tailoring: { pos: [0.58, 1.12, 1.32], target: [0, 1.05, 0.04] },
};

function disposeObjectSubtree(root: THREE.Object3D): void {
  const seenGeos = new Set<THREE.BufferGeometry>();
  const seenMats = new Set<THREE.Material>();
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
      if (obj.geometry && !obj.geometry.userData?.shared && !seenGeos.has(obj.geometry)) {
        seenGeos.add(obj.geometry);
        obj.geometry.dispose();
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m && !seenMats.has(m)) {
          seenMats.add(m);
          m.dispose();
        }
      }
    }
  });
}

function buildStudioChairProp(): THREE.Group {
  const grp = new THREE.Group();
  const micro = getHumanMicroMaps();

  const shellMat = new THREE.MeshStandardMaterial({ color: 0x161a21, roughness: 0.62, metalness: 0.14 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd0d6de, roughness: 0.2, metalness: 0.88 });
  const cushionMat = new THREE.MeshStandardMaterial({
    color: 0x1c2028,
    normalMap: micro.leatherNormalTex,
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughness: 0.7,
    metalness: 0.04,
    envMapIntensity: 0.4,
  });

  // Waterfall ergonomic leather seat cushion (top surface ~0.428m, bottom ~0.342m, centered at z=-0.04m)
  const seatProf = new THREE.Shape();
  seatProf.moveTo(-0.22, -0.014);
  seatProf.quadraticCurveTo(-0.24, 0.036, -0.17, 0.044);
  seatProf.quadraticCurveTo(0.02, 0.036, 0.19, 0.042);
  seatProf.quadraticCurveTo(0.245, 0.038, 0.25, -0.008);
  seatProf.quadraticCurveTo(0.235, -0.026, 0.18, -0.024);
  seatProf.lineTo(-0.20, -0.024);
  seatProf.closePath();

  const seatGeo = new THREE.ExtrudeGeometry(seatProf, {
    depth: 0.44,
    bevelEnabled: true,
    bevelThickness: 0.024,
    bevelSize: 0.022,
    bevelSegments: 4,
    curveSegments: 12,
  });
  seatGeo.translate(0, 0, -0.22);
  seatGeo.rotateY(Math.PI / 2);

  const seat = new THREE.Mesh(seatGeo, cushionMat);
  seat.position.set(0, 0.386, -0.03);
  seat.receiveShadow = true;
  seat.castShadow = true;
  grp.add(seat);

  // Under-seat pan & synchronous tilt housing + height adjustment lever
  const underPan = new THREE.Mesh(getRoundedBox(0.34, 0.028, 0.34, 0.012, 2), shellMat);
  underPan.position.set(0, 0.335, -0.04);
  grp.add(underPan);

  const hub = new THREE.Mesh(getRoundedBox(0.16, 0.056, 0.20, 0.014, 2), shellMat);
  hub.position.set(0, 0.302, -0.05);
  grp.add(hub);

  const paddle = new THREE.Mesh(getRoundedBox(0.12, 0.012, 0.028, 0.004, 1), shellMat);
  paddle.position.set(0.15, 0.312, 0.01);
  grp.add(paddle);

  // Tall contoured upholstered backrest (side-profile ergonomic lumbar curve)
  const backFrontShape = new THREE.Shape();
  backFrontShape.moveTo(-0.20, 0);
  backFrontShape.quadraticCurveTo(-0.22, 0.24, -0.17, 0.48);
  backFrontShape.quadraticCurveTo(0, 0.53, 0.17, 0.48);
  backFrontShape.quadraticCurveTo(0.22, 0.24, 0.20, 0);
  backFrontShape.quadraticCurveTo(0, -0.025, -0.20, 0);

  const backGeo = new THREE.ExtrudeGeometry(backFrontShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.018,
    bevelSegments: 3,
    curveSegments: 12,
  });
  backGeo.computeVertexNormals();

  const backGroup = new THREE.Group();
  backGroup.position.set(0, 0.47, -0.26);
  backGroup.rotation.x = -0.10;
  grp.add(backGroup);

  const backCushion = new THREE.Mesh(backGeo, cushionMat);
  backCushion.castShadow = true;
  backCushion.receiveShadow = true;
  backGroup.add(backCushion);

  // Molded rear polymer outer shell backing
  const rearShellGeo = new THREE.ExtrudeGeometry(backFrontShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 2,
    curveSegments: 10,
  });
  const rearShell = new THREE.Mesh(rearShellGeo, shellMat);
  rearShell.position.set(0, 0, -0.016);
  rearShell.scale.set(0.98, 0.99, 1);
  rearShell.castShadow = true;
  backGroup.add(rearShell);

  // Curved rear L-spine bracket connecting backrest to under-seat tilt hub
  const spineGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.305, -0.07),
      new THREE.Vector3(0, 0.315, -0.25),
      new THREE.Vector3(0, 0.46, -0.295),
      new THREE.Vector3(0, 0.68, -0.305),
    ]),
    14,
    0.021,
    10,
    false
  );
  const spine = new THREE.Mesh(spineGeo, shellMat);
  spine.castShadow = true;
  grp.add(spine);

  // Chrome pneumatic gas lift cylinder + telescoping dark shroud collar
  const gasCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.22, 16), chromeMat);
  gasCylinder.position.set(0, 0.20, -0.05);
  grp.add(gasCylinder);

  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.11, 16), shellMat);
  shroud.position.set(0, 0.145, -0.05);
  grp.add(shroud);

  // 5-star sculpted base with twin-wheel hooded casters resting at y = 0.000
  for (let k = 0; k < 5; k++) {
    const a = (k * Math.PI * 2) / 5 + 0.25;
    const cx = Math.cos(a) * 0.26;
    const cz = -0.05 + Math.sin(a) * 0.26;
    const leg = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(a) * 0.03, 0.11, -0.05 + Math.sin(a) * 0.03),
          new THREE.Vector3(cx * 0.56, 0.088, -0.05 + Math.sin(a) * 0.26 * 0.56),
          new THREE.Vector3(cx, 0.054, cz),
        ]),
        8,
        0.016,
        8,
        false
      ),
      shellMat
    );
    grp.add(leg);

    const casterPost = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.028, 8), shellMat);
    casterPost.position.set(cx, 0.04, cz);
    grp.add(casterPost);

    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.011, 12), shellMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.rotation.y = a;
      wheel.position.set(cx + side * Math.sin(a) * 0.01, 0.024, cz - side * Math.cos(a) * 0.01);
      grp.add(wheel);
    }
  }

  return grp;
}

export const CharacterStudioModal: React.FC<CharacterStudioModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const [selectedPreset, setSelectedPreset] = useState<CharacterRosterPreset>(OFFICE_CHARACTER_ROSTER[0]);
  const [selectedPose, setSelectedPose] = useState<string>(OFFICE_CHARACTER_ROSTER[0].defaultPose);
  const [clipMode, setClipMode] = useState<ClipMode>('pose');
  const [framing, setFraming] = useState<CameraFraming>('full');
  const [turntable, setTurntable] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [importedGlb, setImportedGlb] = useState<LoadedGlbCharacter | null>(null);
  const [glbLoading, setGlbLoading] = useState(false);
  const [glbProgress, setGlbProgress] = useState<AssetLoadProgress | null>(null);

  const studioRef = useRef<{
    scene: THREE.Scene;
    actor: PersonActor | null;
    externalRoot: THREE.Group | null;
    mixer: THREE.AnimationMixer | null;
    activeAction: THREE.AnimationAction | null;
    palette: HumanPalette;
    materials: MaterialLibrary;
    chairProp: THREE.Group;
    camTargetPos: THREE.Vector3;
    ctrlTargetPos: THREE.Vector3;
    lerpFrames: number;
    turntable: boolean;
    clipMode: ClipMode;
    selectedPose: string;
  } | null>(null);

  useDialogFocusTrap(isOpen, dialogRef, onClose);

  // Initialize isolated 3-Point Studio Three.js Viewport
  useEffect(() => {
    if (!isOpen) return;
    const container = mountRef.current;
    if (!container) return;

    setContextLost(false);
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      setContextLost(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1520);
    scene.fog = new THREE.Fog(0x0f1520, 4.5, 11);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.08, 25);
    camera.position.set(...FRAMING_TARGETS.full.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.42;
    controls.maxDistance = 4.2;
    controls.maxPolarAngle = Math.PI * 0.51;
    controls.target.set(...FRAMING_TARGETS.full.target);
    controls.update();

    // Balanced 2-Light Studio Portrait Rig (1 HemisphereLight + 1 DirectionalLight + RoomEnvironment IBL)
    const hemi = new THREE.HemisphereLight(0xdce8ff, 0x333844, 1.12);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1e0, 1.9);
    keyLight.position.set(2.3, 3.2, 2.7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 9;
    keyLight.shadow.camera.left = -1.4;
    keyLight.shadow.camera.right = 1.4;
    keyLight.shadow.camera.top = 2.2;
    keyLight.shadow.camera.bottom = -0.4;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.015;
    scene.add(keyLight);

    // Architectural studio turntable disc + soft shadow floor
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x161d2a,
      roughness: 0.88,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.6, 56), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0x2a3a52, transparent: true, opacity: 0.55 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.732, 64), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    scene.add(ring);

    const chairProp = buildStudioChairProp();
    chairProp.visible = false;
    scene.add(chairProp);

    const materials = createMaterials();
    const palette = createHumanPalette(materials);

    const state = {
      scene,
      actor: null as PersonActor | null,
      externalRoot: null as THREE.Group | null,
      mixer: null as THREE.AnimationMixer | null,
      activeAction: null as THREE.AnimationAction | null,
      palette,
      materials,
      chairProp,
      camTargetPos: new THREE.Vector3(...FRAMING_TARGETS.full.pos),
      ctrlTargetPos: new THREE.Vector3(...FRAMING_TARGETS.full.target),
      lerpFrames: 0,
      turntable: true,
      clipMode: 'pose' as ClipMode,
      selectedPose: selectedPreset.defaultPose,
    };
    studioRef.current = state;

    // Pause auto-turntable gently while user interacts with controls
    let userDragging = false;
    const onControlStart = () => {
      userDragging = true;
      state.lerpFrames = 0;
    };
    const onControlEnd = () => {
      userDragging = false;
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('end', onControlEnd);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 240);
      const h = Math.max(container.clientHeight, 240);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    let rafId = 0;
    let lastMs = performance.now();
    let elapsed = 0;

    const tick = (nowMs: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min((nowMs - lastMs) * 0.001, 0.05);
      lastMs = nowMs;
      elapsed += dt;

      if (state.lerpFrames > 0) {
        const alpha = 1 - Math.exp(-dt * 7.5);
        camera.position.lerp(state.camTargetPos, alpha);
        controls.target.lerp(state.ctrlTargetPos, alpha);
        state.lerpFrames -= 1;
      }

      controls.update();

      const extRoot = state.externalRoot;
      if (extRoot) {
        if (state.turntable && !userDragging) {
          extRoot.rotation.y += dt * 0.36;
        }
        if (state.mixer) {
          state.mixer.update(dt);
        }
        chairProp.visible = false;
      } else {
        const actor = state.actor;
        if (actor) {
          if (state.turntable && !userDragging) {
            actor.tyaw += dt * 0.36;
            actor.yaw = actor.tyaw;
            actor.g.rotation.y = actor.yaw;
          }

          if (state.clipMode !== 'pose' && state.mixer) {
            state.mixer.update(dt);
            if (state.clipMode === 'SittingWork') {
              chairProp.visible = true;
              chairProp.rotation.y = actor.g.rotation.y;
            } else {
              chairProp.visible = false;
            }
          } else {
            actor.moving = state.selectedPose === 'walk';
            updatePersonKinematics(actor, dt, elapsed, 0);
            const seated = SEATED_POSES.has(state.selectedPose);
            chairProp.visible = seated;
            chairProp.rotation.y = actor.g.rotation.y;
          }
        }
      }

      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('end', onControlEnd);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);

      if (state.actor) {
        scene.remove(state.actor.g);
        disposeObjectSubtree(state.actor.g);
        state.actor = null;
      }
      if (state.externalRoot) {
        scene.remove(state.externalRoot);
        disposeObjectSubtree(state.externalRoot);
        state.externalRoot = null;
      }
      disposeObjectSubtree(chairProp);
      floor.geometry.dispose();
      floorMat.dispose();
      ring.geometry.dispose();
      ringMat.dispose();
      envTex.dispose();
      pmrem.dispose();

      // Dispose modal-local materials
      Object.values(materials).forEach((val) => {
        if (val instanceof THREE.Material) val.dispose();
      });
      palette.skins.forEach((m) => m.dispose());
      palette.shirts.forEach((m) => m.dispose());
      palette.knits.forEach((m) => m.dispose());
      palette.hairs.forEach((m) => m.dispose());
      palette.trous.forEach((m) => m.dispose());

      renderer.dispose();
      rendererRef.current = null;
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      studioRef.current = null;
    };
    // Intentionally initialize WebGL studio once per modal open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Swap character when selectedPreset changes
  useEffect(() => {
    const st = studioRef.current;
    if (!isOpen || !st) return;

    if (st.mixer) {
      st.mixer.stopAllAction();
      st.mixer = null;
      st.activeAction = null;
    }
    if (st.externalRoot) {
      st.scene.remove(st.externalRoot);
      disposeObjectSubtree(st.externalRoot);
      st.externalRoot = null;
    }
    setImportedGlb(null);

    if (st.actor) {
      st.scene.remove(st.actor.g);
      disposeObjectSubtree(st.actor.g);
      st.actor = null;
    }

    const opts = selectedPreset.options(st.palette);
    const actor = makePerson({ ...opts, detail: 'studio', faceSize: 1024 }, st.palette, st.materials);
    actor.yaw = 0.25;
    actor.tyaw = 0.25;
    actor.g.rotation.y = 0.25;
    setPose(actor, selectedPreset.defaultPose, st.palette);
    st.scene.add(actor.g);
    st.actor = actor;
    st.selectedPose = selectedPreset.defaultPose;
    setSelectedPose(selectedPreset.defaultPose);
    setClipMode('pose');
    st.clipMode = 'pose';
    setExportNote(null);
  }, [isOpen, selectedPreset]);

  // Update pose or animation clip
  useEffect(() => {
    const st = studioRef.current;
    if (!isOpen || !st) return;
    st.selectedPose = selectedPose;
    st.clipMode = clipMode;
    st.turntable = turntable;

    if (!st.actor) return;
    if (clipMode === 'pose') {
      if (st.activeAction) {
        st.activeAction.stop();
        st.activeAction = null;
      }
      setPose(st.actor, selectedPose, st.palette);
    } else {
      const clip = st.actor.clips.find((c) => c.name === clipMode);
      if (clip) {
        if (!st.mixer) st.mixer = new THREE.AnimationMixer(st.actor.body);
        if (st.activeAction) st.activeAction.stop();
        const act = st.mixer.clipAction(clip);
        act.reset().play();
        st.activeAction = act;
        setPose(st.actor, clipMode === 'SittingWork' ? 'type' : 'stand', st.palette);
      }
    }
  }, [isOpen, selectedPose, clipMode, turntable]);

  // Update camera framing target cleanly
  useEffect(() => {
    const st = studioRef.current;
    if (!isOpen || !st) return;
    const cfg = FRAMING_TARGETS[framing];
    st.camTargetPos.set(...cfg.pos);
    st.ctrlTargetPos.set(...cfg.target);
    st.lerpFrames = 45;
  }, [isOpen, framing]);

  const handleImportGlbFile = async (file: File) => {
    const st = studioRef.current;
    if (!st || glbLoading) return;
    setGlbLoading(true);
    setGlbProgress({ percent: 2, stage: `Opening ${file.name}…`, loaded: 0, total: file.size });
    setExportNote(null);
    try {
      const loaded = await loadRiggedGlbFromFile(
        file,
        1.74,
        (prog) => setGlbProgress(prog),
        rendererRef.current
      );
      if (st.mixer) {
        st.mixer.stopAllAction();
        st.mixer = null;
        st.activeAction = null;
      }
      if (st.actor) {
        st.scene.remove(st.actor.g);
        disposeObjectSubtree(st.actor.g);
        st.actor = null;
      }
      if (st.externalRoot) {
        st.scene.remove(st.externalRoot);
        disposeObjectSubtree(st.externalRoot);
        st.externalRoot = null;
      }
      st.externalRoot = loaded.root;
      loaded.root.rotation.y = 0.25;
      st.scene.add(loaded.root);
      if (loaded.clips.length > 0) {
        st.mixer = new THREE.AnimationMixer(loaded.root);
        st.activeAction = st.mixer.clipAction(loaded.clips[0]);
        st.activeAction.reset().play();
      }
      setImportedGlb(loaded);
      setExportNote(`Loaded ${loaded.sourceName}`);
    } catch (err) {
      setExportNote(err instanceof Error ? `GLB error: ${err.message}` : 'Failed to parse .glb');
    } finally {
      setGlbLoading(false);
      setGlbProgress(null);
    }
  };

  const handleExportGLB = async () => {
    const st = studioRef.current;
    if (!st?.actor || exporting) return;
    setExporting(true);
    setExportNote(null);
    try {
      await exportActorToGLB(st.actor, `${selectedPreset.id}.glb`);
      setExportNote(`Exported ${selectedPreset.id}.glb`);
    } catch {
      setExportNote('Export failed — please try again');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#06090f]/82 backdrop-blur-sm p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-studio-title"
        tabIndex={-1}
        className="flex h-[min(94dvh,860px)] w-[min(97vw,1360px)] flex-col overflow-hidden rounded-md border border-white/15 bg-[#0d121a] shadow-2xl focus:outline-none"
      >
        {/* Studio Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/12 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <User className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="character-studio-title"
                  className="text-sm font-semibold tracking-tight text-white truncate"
                >
                  Photorealistic 3D Character Studio
                </h2>
                <span className="hidden sm:inline text-slate-600">·</span>
                <span className="hidden sm:inline font-mono-tabular text-[11px] text-slate-400">
                  {BONE_NAMES.length} Rigged Bones · PBR Skin & Garments · glTF 2.0
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {exportNote && (
              <span
                role="status"
                aria-live="polite"
                className="hidden md:inline font-mono-tabular text-[11px] text-emerald-300"
              >
                {exportNote}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf"
              aria-label="Upload custom rigged GLB or glTF character model"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportGlbFile(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={glbLoading || contextLost}
              aria-label="Import custom GLB or glTF character model"
              className="flex items-center gap-1.5 rounded border border-sky-500/45 bg-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-500/30 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>{glbLoading && glbProgress ? `${glbProgress.percent}%` : 'Load .GLB'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportGLB}
              disabled={exporting || contextLost || !!importedGlb}
              aria-label={`Export ${selectedPreset.name} as GLB file`}
              className="flex items-center gap-1.5 rounded border border-emerald-500/45 bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting…' : 'Export .GLB'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Character Studio"
              className="rounded border border-white/12 bg-white/5 p-1.5 text-slate-300 hover:bg-white/12 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main 3-Column Studio Body */}
        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
          {/* Left Panel: 12 Diverse Professionals */}
          <aside
            aria-label="Office Team Roster"
            className="lg:w-72 border-b lg:border-b-0 lg:border-r border-white/12 overflow-y-auto max-h-44 lg:max-h-none bg-[#0a0e15]"
          >
            <div className="px-3.5 py-2.5 border-b border-white/10 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              Office Team Roster ({OFFICE_CHARACTER_ROSTER.length})
            </div>
            <div className="divide-y divide-white/6">
              {OFFICE_CHARACTER_ROSTER.map((person) => {
                const active = person.id === selectedPreset.id && !importedGlb;
                return (
                  <button
                    key={person.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedPreset(person)}
                    className={`w-full text-left px-3.5 py-2.5 transition-colors cursor-pointer ${
                      active ? 'bg-emerald-500/12 text-white' : 'hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`text-xs font-semibold truncate ${active ? 'text-emerald-300' : 'text-slate-100'}`}>
                        {person.name}
                      </span>
                      <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">{person.age}y</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{person.role}</div>
                    <div className="mt-1 text-[10px] leading-snug text-slate-500 line-clamp-2">{person.bio}</div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Center Panel: 3-Point Lit Studio WebGL Viewport */}
          <div
            className="relative flex-1 min-h-[280px] bg-[#0f1520]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && /\.(glb|gltf)$/i.test(file.name)) {
                void handleImportGlbFile(file);
              }
            }}
          >
            <div
              ref={mountRef}
              role="img"
              aria-label={`3D studio preview of ${importedGlb ? importedGlb.sourceName : selectedPreset.name}`}
              className="h-full w-full"
            />

            {glbLoading && glbProgress && (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 flex items-center justify-center bg-[#0d121a]/88 p-6"
              >
                <div className="w-full max-w-xs rounded border border-sky-400/35 bg-[#090d14] p-4 shadow-xl">
                  <div className="flex items-center justify-between text-xs font-semibold text-white">
                    <span>Importing 3D Character</span>
                    <span className="font-mono-tabular text-sky-300">{glbProgress.percent}%</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-300 truncate">{glbProgress.stage}</p>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={glbProgress.percent}
                    aria-label="GLB asset load progress"
                    className="mt-2.5 h-1.5 w-full overflow-hidden rounded-xs bg-white/10"
                  >
                    <div
                      className="h-full bg-sky-400 transition-all duration-100"
                      style={{ width: `${glbProgress.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {contextLost && (
              <div role="alert" className="absolute inset-0 flex items-center justify-center bg-[#0d121a]/95 p-6 text-center">
                <p className="text-xs text-slate-300">
                  WebGL context was paused by browser GPU limits. Close and reopen the Character Studio to restore.
                </p>
              </div>
            )}

            {/* Viewport Camera Framing Controls */}
            <div className="pointer-events-auto absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'full', label: 'Full Body' },
                  { id: 'portrait', label: 'Face & Hair' },
                  { id: 'tailoring', label: 'Hands & Outfit' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={framing === f.id}
                  onClick={() => setFraming(f.id)}
                  className={`rounded border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    framing === f.id
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                      : 'border-white/12 bg-[#0d121a]/85 text-slate-300 hover:bg-white/12'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              <button
                type="button"
                aria-pressed={turntable}
                onClick={() => setTurntable((v) => !v)}
                className={`flex items-center gap-1 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  turntable
                    ? 'border-sky-400/60 bg-sky-500/18 text-sky-100'
                    : 'border-white/12 bg-[#0d121a]/85 text-slate-300 hover:bg-white/12'
                }`}
              >
                <RotateCw className="w-3 h-3" />
                <span>{turntable ? 'Turntable ON' : 'Turntable OFF'}</span>
              </button>
            </div>

            {/* Bottom-Left Selected Subject Readout */}
            <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-white/12 bg-[#0d121a]/88 px-3 py-2 max-w-xs">
              {importedGlb ? (
                <>
                  <div className="text-xs font-semibold text-sky-300 truncate">{importedGlb.sourceName}</div>
                  <div className="text-[11px] text-slate-300 font-mono-tabular">
                    {Object.keys(importedGlb.bones).length}/{BONE_NAMES.length} retargeted bones ·{' '}
                    {importedGlb.triangleCount.toLocaleString()} tris · {importedGlb.heightMeters}m
                  </div>
                  <div className="mt-1 font-mono-tabular text-[10px] text-slate-500">
                    Click any roster character to switch back
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs font-semibold text-white">{selectedPreset.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {selectedPreset.role} · Age {selectedPreset.age}
                  </div>
                  <div className="mt-1 font-mono-tabular text-[10px] text-slate-500">
                    Drag to orbit · Scroll to zoom · {clipMode === 'pose' ? `Pose: ${selectedPose}` : `Clip: ${clipMode}`}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Panel: 15 Office Positions & Animation Clips */}
          <aside
            aria-label="Poses and Animation Clips"
            className="lg:w-80 border-t lg:border-t-0 lg:border-l border-white/12 flex flex-col bg-[#0a0e15] max-h-64 lg:max-h-none"
          >
            <div className="p-3 border-b border-white/10">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
                Animation Clips (Rigged glTF)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'pose', label: 'Pose Mode' },
                    { id: 'Idle', label: 'Idle Clip' },
                    { id: 'Walking', label: 'Walking Clip' },
                    { id: 'SittingWork', label: 'Sitting Work' },
                    { id: 'Talking', label: 'Talking Clip' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={clipMode === m.id}
                    onClick={() => setClipMode(m.id)}
                    className={`flex items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      clipMode === m.id
                        ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/12'
                    } ${m.id === 'pose' ? 'col-span-2' : ''}`}
                  >
                    {m.id === 'pose' ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-3.5 py-2 border-b border-white/10 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              15 Natural Office Positions
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/6">
              {OFFICE_POSES_CATALOG.map((item) => {
                const active = clipMode === 'pose' && selectedPose === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setClipMode('pose');
                      setSelectedPose(item.key);
                    }}
                    className={`w-full text-left px-3.5 py-2 transition-colors cursor-pointer ${
                      active ? 'bg-emerald-500/14 text-white' : 'hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <div className={`text-xs font-medium font-mono-tabular ${active ? 'text-emerald-300' : 'text-slate-100'}`}>
                      {item.label}
                    </div>
                    <div className="text-[10px] text-slate-400">{item.description}</div>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
