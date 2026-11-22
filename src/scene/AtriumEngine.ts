import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clearArchitecturalFormsCache } from './architecturalForms';
import { buildSceneArchitecture, type ArchitectureHandles, type MonitorPickTarget } from './architecture';
import {
  BASE,
  COLX,
  EXEC,
  LV,
  ROOMS,
  VIEWS,
  type HudSnapshot,
  type InspectedMonitor,
  type RoomDef,
  type SelectedCharacterSnapshot,
  type WeatherMode,
} from './constants';
import type { PersonActor } from './human';
import {
  DISTRICT_BUILDING_MAP,
  getBuildingFloorView,
  getBuildingRoofView,
  type BuildingId,
} from './districtData';
import { createMaterials, type MaterialLibrary } from './materials';
import { synthesizeProceduralFoliage, type ProceduralFoliageResult } from './organicFoliage';
import { createScreenRegistry, renderWorkScreenFrame, updateAllScreens, type ScreenRegistry } from './screens';
import { AtriumSimulation } from './simulation';
import { AmbientAudioManager } from './audio';
import { getMaxAnisotropy, setMaxAnisotropy } from './textures';
import { WeatherSystem, type WeatherAtmosphereState } from './weather';

function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const rendererStr = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    return /SwiftShader|llvmpipe|Software Rasterizer|SoftPipe/i.test(rendererStr);
  } catch {
    return false;
  }
}

export class AtriumEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly screenReg: ScreenRegistry;
  private readonly arch: ArchitectureHandles;
  private readonly proceduralFoliage: ProceduralFoliageResult;
  private readonly sim: AtriumSimulation;
  private readonly weather: WeatherSystem;
  private readonly asphaltMat: THREE.MeshStandardMaterial;
  private readonly audio = new AmbientAudioManager();
  private readonly isSoftwareGl: boolean;

  private readonly sunLight: THREE.DirectionalLight;
  private readonly skyFillLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly skyDome: THREE.Mesh;
  private readonly fog: THREE.FogExp2;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2(-9, -9);

  private activeBuilding: BuildingId = 'hub';
  private activeLevel = 'overview';
  private hoveredRoom: { title: string; sub: string; color: string; hint?: string } | null = null;
  private inspectedMonitor: MonitorPickTarget | null = null;
  private selectedActor: PersonActor | null = null;
  private followSelectedActor = false;
  private readonly monitorMeshMap = new Map<THREE.Object3D, MonitorPickTarget>();
  private readonly buildingPickMap = new Map<THREE.Object3D, BuildingId>();
  private readonly buildingPickList: Array<{ mesh: THREE.Object3D; buildingId: BuildingId }> = [];
  private readonly playerCarPickSet = new Set<THREE.Object3D>();
  private downX = 0;
  private downY = 0;
  private rafId = 0;
  private timerId = 0;
  private lastTs = 0;
  private lastRenderTs = 0;
  private lastInteractionTs = 0;
  private lastMoveRayTs = 0;
  private elapsed = 0;
  private hudEmitAccum = 0;
  private cutawayAnimating = false;
  private onHudChange: (snapshot: HudSnapshot) => void;
  private onFatalError?: (message: string) => void;
  private resizeObserver: ResizeObserver | null = null;
  private unwireWalk: () => void;
  private disposed = false;

  // Overhead 3D floor activity badges
  private readonly overheadBadgesGroup = new THREE.Group();
  private readonly overheadBadges: Array<{
    lv: number;
    zone: string;
    sprite: THREE.Sprite;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    tex: THREE.CanvasTexture;
    lastStatus: string;
    color: string;
  }> = [];

  // 3D Thought bubble & selection ring for clicked autonomous character
  private readonly thoughtBubbleCanvas: HTMLCanvasElement;
  private readonly thoughtBubbleCtx: CanvasRenderingContext2D | null;
  private readonly thoughtBubbleTex: THREE.CanvasTexture;
  private readonly thoughtBubbleSprite: THREE.Sprite;
  private lastDrawnThoughtKey = '';
  private readonly selectionRing: THREE.Mesh;

  // Scratch vectors
  private readonly _sunCol = new THREE.Color();
  private readonly _zenith = new THREE.Color();
  private readonly _horizon = new THREE.Color();
  private readonly _fogCol = new THREE.Color();
  private readonly _skyGround = new THREE.Color();
  private readonly _wZenith = new THREE.Color();
  private readonly _wHorizon = new THREE.Color();
  private readonly _wFog = new THREE.Color();
  private readonly _lightningCol = new THREE.Color(0xcbdcff);
  private readonly _camRight = new THREE.Vector3();
  private readonly _segA = new THREE.Vector3();
  private readonly _segB = new THREE.Vector3();
  private readonly _rayPt = new THREE.Vector3();
  private readonly _segPt = new THREE.Vector3();
  private readonly _lastActorPos = new THREE.Vector3();

  constructor(
    container: HTMLElement,
    onHudChange: (snapshot: HudSnapshot) => void,
    onFatalError?: (message: string) => void
  ) {
    this.container = container;
    this.onHudChange = onHudChange;
    this.onFatalError = onFatalError;
    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: this.isSoftwareGl ? 'low-power' : 'high-performance',
      });
    } catch {
      this.renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'default',
      });
    }
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.shadowMap.enabled = false;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    setMaxAnisotropy(this.isSoftwareGl ? 1 : Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x1b2434, 0.0022);
    this.scene.fog = this.fog;

    // Room environment IBL for physically-based metals, glass & car clearcoat (safe fallback if GPU driver rejects PMREM)
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch {
      this.scene.environment = null;
    }

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.08, 1200);
    this.camera.position.set(0, 20, 64);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 12.2, 4);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 175;
    this.controls.maxPolarAngle = Math.PI * 0.488;
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.markInteraction();
      this.sim.cancelFlight();
    });
    this.controls.addEventListener('change', () => {
      this.markInteraction();
    });

    // Procedural atmospheric gradient sky dome with animated FBM cloud strata & storm lightning
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color(0x2a5488) },
        uHorizon: { value: new THREE.Color(0xb8d4f0) },
        uGround: { value: new THREE.Color(0x3a404a) },
        uTime: { value: 0 },
        uCloudCover: { value: 0.08 },
        uLightning: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uGround;
        uniform float uTime;
        uniform float uCloudCover;
        uniform float uLightning;
        varying vec3 vDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) {
            v += amp * noise2(p);
            p = p * 2.04 + vec2(17.3, 9.2);
            amp *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = h >= 0.0
            ? mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.52))
            : mix(uHorizon, uGround, pow(clamp(-h * 3.0, 0.0, 1.0), 0.7));

          if (h > 0.005 && uCloudCover > 0.05) {
            vec2 cloudUv = (d.xz / (h + 0.20)) * 1.45 + vec2(uTime * 0.018, uTime * 0.008);
            float n = fbm(cloudUv);
            float threshold = mix(0.76, 0.20, clamp(uCloudCover, 0.0, 1.0));
            float cloudMask = smoothstep(threshold, threshold + 0.32, n) * smoothstep(0.005, 0.14, h);
            float skyLum = dot(uHorizon, vec3(0.299, 0.587, 0.114));
            vec3 brightCloud = mix(vec3(0.22, 0.26, 0.34), vec3(0.92, 0.95, 0.98), clamp(skyLum * 1.25, 0.0, 1.0));
            vec3 shadowCloud = mix(vec3(0.09, 0.12, 0.17), vec3(0.45, 0.51, 0.58), clamp(skyLum, 0.0, 1.0));
            vec3 cloudCol = mix(shadowCloud, brightCloud, smoothstep(0.35, 0.82, n) * (1.0 - uCloudCover * 0.45));
            col = mix(col, cloudCol, cloudMask * clamp(uCloudCover * 1.12, 0.0, 0.94));
          }

          if (uLightning > 0.01 && h > 0.0) {
            col += vec3(0.72, 0.82, 1.0) * uLightning * 0.55 * smoothstep(0.0, 0.35, h);
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(520, 48, 32), this.skyMat);
    this.skyDome.frustumCulled = false;
    this.skyDome.renderOrder = -1000;
    this.skyDome.position.copy(this.camera.position);
    this.scene.add(this.skyDome);

    // Three-point + architectural sky/sun illumination (zero real-time shadow pass overhead)
    this.hemiLight = new THREE.HemisphereLight(0xc8e0ff, 0x565048, 0.84);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
    this.sunLight.position.set(42, 64, 54);
    this.sunLight.castShadow = false;
    this.scene.add(this.sunLight);

    // Subtle cool northern sky-bounce fill light for realistic architectural shadow wrap
    this.skyFillLight = new THREE.DirectionalLight(0xbcd6f6, 0.4);
    this.skyFillLight.position.set(-40, 26, 46);
    this.scene.add(this.skyFillLight);

    // Build PBR material library & architectural shell
    const M = createMaterials();
    this.asphaltMat = M.asphalt;
    this.screenReg = createScreenRegistry();
    this.arch = buildSceneArchitecture(this.scene, M, this.screenReg);
    this.proceduralFoliage = this.runProceduralFoliageScript(M);
    this.weather = new WeatherSystem(this.scene, this.arch.levelGroups);

    // Build dynamic office simulation (staff, district NPCs, Zuri, vehicles, walk & drive controls)
    this.sim = new AtriumSimulation(
      this.scene,
      M,
      this.arch.cabs,
      this.arch.officeChairs,
      this.arch.districtBuildings,
      () => this.audio.playFootstep(),
      () => this.audio.playCarHorn(),
      (high) => this.audio.playRelayClick(high)
    );
    for (const m of this.sim.getPlayerCarPickMeshes()) {
      this.playerCarPickSet.add(m);
    }
    this.unwireWalk = this.sim.wireWalk(this.renderer.domElement, this.camera, this.controls);
    this.initOverheadBadges();

    // 3D Floating Thought Bubble & Selection Ring
    this.thoughtBubbleCanvas = document.createElement('canvas');
    this.thoughtBubbleCanvas.width = 1024;
    this.thoughtBubbleCanvas.height = 300;
    this.thoughtBubbleCtx = this.thoughtBubbleCanvas.getContext('2d');
    this.thoughtBubbleTex = new THREE.CanvasTexture(this.thoughtBubbleCanvas);
    this.thoughtBubbleTex.colorSpace = THREE.SRGBColorSpace;
    this.thoughtBubbleTex.anisotropy = getMaxAnisotropy();
    this.thoughtBubbleSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.thoughtBubbleTex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      })
    );
    this.thoughtBubbleSprite.scale.set(1.85, 0.54, 1);
    this.thoughtBubbleSprite.renderOrder = 26;
    this.thoughtBubbleSprite.visible = false;
    this.scene.add(this.thoughtBubbleSprite);

    const ringGeo = new THREE.RingGeometry(0.32, 0.42, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this.selectionRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0x6fe3a1,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.selectionRing.renderOrder = 10;
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);

    for (const mp of this.arch.monitorPicks) {
      for (const m of mp.meshes) {
        this.monitorMeshMap.set(m, mp);
      }
    }
    for (const [bId, db] of this.arch.districtBuildings) {
      for (const m of db.pickMeshes) {
        this.buildingPickMap.set(m, bId);
        this.buildingPickList.push({ mesh: m, buildingId: bId });
      }
    }

    // Wire events & audio gesture unlock
    window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('pointerdown', this.handleAudioUnlock, { passive: true });
    window.addEventListener('keydown', this.handleAudioUnlock, { passive: true });
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: true });
    this.renderer.domElement.addEventListener('click', this.handleClick);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    const initW = this.weather.update(0.016, this.elapsed, this.sim.simMin, this.activeLevel, this.arch.roofShellGroup.visible);
    this.sim.setWeatherTimeMultiplier(this.weather.getTimeMultiplier());
    this.updateTimeOfDayLighting(this.sim.simMin, initW);
    this.emitHud();
    const now = performance.now();
    this.lastTs = now;
    this.lastRenderTs = 0;
    this.lastInteractionTs = now;
    this.rafId = requestAnimationFrame(() => {
      if (this.disposed) return;
      this.handleResize();
      this.loop(performance.now());
    });
  }

  private runProceduralFoliageScript(M: MaterialLibrary): ProceduralFoliageResult {
    return synthesizeProceduralFoliage(this.scene, M);
  }

  private markInteraction() {
    this.lastInteractionTs = performance.now();
  }

  private handleWheel = () => {
    this.markInteraction();
  };

  private handleVisibilityChange = () => {
    if (this.disposed) return;
    if (document.hidden) {
      cancelAnimationFrame(this.rafId);
      clearTimeout(this.timerId);
    } else {
      const now = performance.now();
      this.lastTs = now;
      this.lastRenderTs = 0;
      this.markInteraction();
      this.scheduleNextTick();
    }
  };

  private scheduleNextTick() {
    if (this.disposed || document.hidden) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed && !document.hidden) {
          this.loop(performance.now());
        }
      });
    } else {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = typeof gl.fenceSync === 'function' ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      this.timerId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed || document.hidden) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.timerId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.timerId = window.setTimeout(cb, 80);
      }
    };
    this.timerId = window.setTimeout(poll, 5);
  }

  private initOverheadBadges() {
    this.scene.add(this.overheadBadgesGroup);

    const addBadge = (lv: number, zone: string, x: number, y: number, z: number, color: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = getMaxAnisotropy();
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(x, y, z);
      sprite.scale.set(3.4, 0.85, 1);
      sprite.renderOrder = 20;
      sprite.visible = false;
      this.overheadBadgesGroup.add(sprite);
      this.overheadBadges.push({ lv, zone, sprite, canvas, ctx, tex, lastStatus: '', color });
    };

    for (const r of ROOMS) {
      addBadge(
        r.lv,
        r.n,
        COLX[r.col],
        LV[r.lv] + 3.55,
        1.45,
        `#${r.c.toString(16).padStart(6, '0')}`
      );
    }
    addBadge(0, 'DomainTechHub Reception', 0, LV[0] + 4.3, 2.2, '#4ea8ff');
    addBadge(0, 'Security Room', EXEC.security.cx, LV[0] + 3.55, 2.0, '#38bdf8');
    addBadge(0, 'Toilets', EXEC.toilets.cx, LV[0] + 3.55, 4.4, '#94a3b8');
    addBadge(1, 'HR Room', EXEC.hr.cx, LV[1] + 3.55, 2.0, '#34d399');
    addBadge(2, 'Relax Room', EXEC.relax.cx, LV[2] + 3.55, 2.0, '#f59e0b');
    addBadge(3, 'Gym Room', EXEC.gym.cx, LV[3] + 3.55, 2.0, '#f87171');
    addBadge(4, 'Strategy Room', EXEC.strategy.cx, LV[4] + 3.45, 1.55, '#818cf8');
    addBadge(4, 'Board Room', EXEC.board.cx, LV[4] + 3.45, 1.55, '#c9a24b');
    addBadge(4, 'Executive Lounge', EXEC.lounge.cx, LV[4] + 3.45, 1.55, '#7a5c3a');
    addBadge(4, 'Board Secretary', EXEC.secr.cx, LV[4] + 3.45, 1.55, '#5d6b7a');
    addBadge(5, 'Executive Gallery', EXEC.gallery.cx, LV[5] + 3.45, 1.55, '#b08452');
    addBadge(5, EXEC.tech.n, EXEC.tech.cx, LV[5] + 3.45, 1.55, '#34598f');
    addBadge(5, EXEC.mkt.n, EXEC.mkt.cx, LV[5] + 3.45, 1.55, '#7a2f5a');
    addBadge(5, EXEC.fin.n, EXEC.fin.cx, LV[5] + 3.45, 1.55, '#2d7a5a');
    addBadge(5, EXEC.ops.n, EXEC.ops.cx, LV[5] + 3.45, 1.55, '#c9762e');
    addBadge(5, EXEC.ceo.n, EXEC.ceo.cx, LV[5] + 3.45, 1.55, '#8a1f2e');
    addBadge(-1, 'Senior Server Engineers', -7.2, BASE[0].y + 3.45, 2.2, '#38bdf8');
    addBadge(-1, 'Junior Maintenance Techs', 4.5, BASE[0].y + 3.45, 2.2, '#6fe3a1');
    addBadge(-2, 'Senior Power Engineers', -6.0, BASE[1].y + 3.35, 2.2, '#f8fafc');
    addBadge(-2, 'Junior Electrical Techs', 4.5, BASE[1].y + 3.35, 2.2, '#f2b705');
  }

  private drawOverheadBadge(
    b: (typeof this.overheadBadges)[number],
    status: string
  ) {
    if (b.lastStatus === status) return;
    b.lastStatus = status;
    const { ctx, canvas, color, zone } = b;
    const W = 512;
    const H = 128;
    ctx.save();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Rounded dark card
    ctx.fillStyle = 'rgba(7, 11, 18, 0.96)';
    ctx.beginPath();
    ctx.roundRect(8, 12, W - 16, H - 24, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.36)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Color swatch dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(38, 46, 10, 0, Math.PI * 2);
    ctx.fill();

    // Zone title
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 28px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(zone, 60, 46, W - 82);

    // Activity status
    ctx.fillStyle = '#86efac';
    ctx.font = '600 22px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(status, 30, 88, W - 56);
    ctx.restore();

    b.tex.needsUpdate = true;
  }

  private getCutawayLevelIndex(): number | null {
    if (this.activeLevel === 'b1') return -1;
    if (this.activeLevel === 'b2') return -2;
    if (/^\d+$/.test(this.activeLevel)) {
      return Number(this.activeLevel);
    }
    return null;
  }

  private updateFloorCutaway(dt: number) {
    const cut = this.getCutawayLevelIndex();
    let moving = false;

    // 1. Animate Hub floors & roof (only active when activeBuilding === 'hub' and cut !== null)
    const hubCut = this.activeBuilding === 'hub' ? cut : null;
    if (hubCut === null) {
      this.arch.roofShellGroup.visible = true;
      const prevRoofY = this.arch.roofShellGroup.position.y;
      this.arch.roofShellGroup.position.y =
        Math.abs(prevRoofY) < 0.01 ? 0 : THREE.MathUtils.damp(prevRoofY, 0, 7.5, dt);
      if (Math.abs(this.arch.roofShellGroup.position.y) > 0.01) moving = true;
      for (let s = 0; s < this.arch.levelGroups.length; s++) {
        const lg = this.arch.levelGroups[s];
        lg.visible = true;
        lg.position.y = Math.abs(lg.position.y) < 0.01 ? 0 : THREE.MathUtils.damp(lg.position.y, 0, 7.5, dt);
        if (Math.abs(lg.position.y) > 0.01) moving = true;
        this.arch.levelCeilings[s].visible = true;
      }
      if (this.activeBuilding !== 'hub') {
        this.arch.basementGroup.visible = false;
      } else {
        this.arch.b1Group.visible = true;
        this.arch.b1Ceiling.visible = true;
        this.arch.b2Group.visible = true;
        this.arch.b2Ceiling.visible = true;
      }
    } else {
      this.arch.roofShellGroup.position.y =
        Math.abs(26 - this.arch.roofShellGroup.position.y) < 0.02
          ? 26
          : THREE.MathUtils.damp(this.arch.roofShellGroup.position.y, 26, 7.0, dt);
      this.arch.roofShellGroup.visible = this.arch.roofShellGroup.position.y < 14;
      if (Math.abs(26 - this.arch.roofShellGroup.position.y) > 0.02) moving = true;

      for (let s = 0; s < this.arch.levelGroups.length; s++) {
        const lg = this.arch.levelGroups[s];
        const isAbove = s > hubCut;
        const targetY = isAbove ? 26 : 0;
        lg.position.y =
          Math.abs(targetY - lg.position.y) < 0.02 ? targetY : THREE.MathUtils.damp(lg.position.y, targetY, 7.0, dt);
        if (Math.abs(targetY - lg.position.y) > 0.02) moving = true;
        lg.visible = isAbove ? lg.position.y < 14 : true;
        this.arch.levelCeilings[s].visible = s !== hubCut;
      }

      if (hubCut === -1) {
        this.arch.basementGroup.visible = true;
        this.arch.b1Group.visible = true;
        this.arch.b1Ceiling.visible = false;
        this.arch.b2Group.visible = true;
        this.arch.b2Ceiling.visible = true;
        this.sim.setCutawayRange(BASE[0].y - 0.5, BASE[0].y + 3.8, 'hub');
      } else if (hubCut === -2) {
        this.arch.basementGroup.visible = true;
        this.arch.b1Group.visible = false;
        this.arch.b2Group.visible = true;
        this.arch.b2Ceiling.visible = false;
        this.sim.setCutawayRange(BASE[1].y - 0.5, BASE[1].y + 3.8, 'hub');
      } else {
        this.arch.basementGroup.visible = false;
        this.sim.setCutawayRange(-0.5, LV[hubCut] + 3.7, 'hub');
      }
    }

    // 2. Animate all 7 district buildings (open selected building when cut >= 0, close others)
    let activeDistrictCutApplied = false;
    for (const [bId, db] of this.arch.districtBuildings) {
      const bCut = this.activeBuilding === bId && cut !== null && cut >= 0 ? cut : null;
      if (bCut === null) {
        db.roofShellGroup.visible = true;
        const py = db.roofShellGroup.position.y;
        db.roofShellGroup.position.y = Math.abs(py) < 0.01 ? 0 : THREE.MathUtils.damp(py, 0, 7.5, dt);
        if (Math.abs(db.roofShellGroup.position.y) > 0.01) moving = true;
        for (let s = 0; s < db.levelGroups.length; s++) {
          const lg = db.levelGroups[s];
          const cg = db.levelCeilings[s];
          lg.visible = true;
          lg.position.y = Math.abs(lg.position.y) < 0.01 ? 0 : THREE.MathUtils.damp(lg.position.y, 0, 7.5, dt);
          if (cg) {
            cg.position.y = lg.position.y;
            cg.visible = true;
          }
          if (Math.abs(lg.position.y) > 0.01) moving = true;
        }
      } else {
        activeDistrictCutApplied = true;
        db.roofShellGroup.position.y =
          Math.abs(24 - db.roofShellGroup.position.y) < 0.02
            ? 24
            : THREE.MathUtils.damp(db.roofShellGroup.position.y, 24, 7.0, dt);
        db.roofShellGroup.visible = db.roofShellGroup.position.y < 14;
        if (Math.abs(24 - db.roofShellGroup.position.y) > 0.02) moving = true;

        for (let s = 0; s < db.levelGroups.length; s++) {
          const lg = db.levelGroups[s];
          const cg = db.levelCeilings[s];
          const isAbove = s > bCut;
          const targetY = isAbove ? 24 : 0;
          lg.position.y =
            Math.abs(targetY - lg.position.y) < 0.02 ? targetY : THREE.MathUtils.damp(lg.position.y, targetY, 7.0, dt);
          if (Math.abs(targetY - lg.position.y) > 0.02) moving = true;
          lg.visible = isAbove ? lg.position.y < 14 : true;
          if (cg) {
            cg.position.y = lg.position.y;
            cg.visible = isAbove ? cg.position.y < 14 : s !== bCut;
          }
        }
        const minY = db.spec.groundY - 0.3;
        const maxY = db.spec.groundY + (bCut + 1) * db.spec.floorH - 0.15;
        this.sim.setCutawayRange(minY, maxY, bId);
      }
    }

    if (!activeDistrictCutApplied && hubCut === null) {
      this.sim.setCutawayRange(-0.5, null, 'hub');
      for (const b of this.overheadBadges) b.sprite.visible = false;
    } else if (this.activeBuilding !== 'hub') {
      for (const b of this.overheadBadges) b.sprite.visible = false;
    }

    this.cutawayAnimating = moving;
  }

  private handleAudioUnlock = () => {
    if (this.audio.isEnabled()) {
      this.audio.unlock();
    }
    if (this.audio.isUnlocked()) {
      window.removeEventListener('pointerdown', this.handleAudioUnlock);
      window.removeEventListener('keydown', this.handleAudioUnlock);
    }
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
  };

  private pickActorUnderPointer(): { actor: PersonActor; distance: number } | null {
    if (!this.sim.isStaffVisible()) return null;
    const actors = this.sim.getAllActors();
    const maxRadiusSq = 0.34 * 0.34;
    let bestActor: PersonActor | null = null;
    let bestDistSq = Infinity;

    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      if (!a.g.visible || !a.brain) continue;
      if (a.g.children.length > 0 && !a.g.children[0].visible) continue;
      const st = (a as { state?: string }).state;
      if (st === 'away' || st === 'inCab') continue;

      const px = a.g.position.x;
      const py = a.g.position.y;
      const pz = a.g.position.z;
      this._segA.set(px, py + 0.06, pz);
      this._segB.set(px, py + 1.78, pz);
      const dSq = this.raycaster.ray.distanceSqToSegment(this._segA, this._segB, this._rayPt, this._segPt);
      if (dSq <= maxRadiusSq) {
        const camDistSq = this._rayPt.distanceToSquared(this.camera.position);
        if (camDistSq > 0.04 && camDistSq < bestDistSq) {
          bestDistSq = camDistSq;
          bestActor = a;
        }
      }
    }

    return bestActor ? { actor: bestActor, distance: Math.sqrt(bestDistSq) } : null;
  }

  private drawThoughtBubble(actor: PersonActor) {
    const brain = actor.brain;
    const ctx = this.thoughtBubbleCtx;
    if (!brain || !ctx) return;

    const key = `${brain.identity.id}:${brain.mood}:${brain.thought}`;
    if (this.lastDrawnThoughtKey === key) return;
    this.lastDrawnThoughtKey = key;

    const W = 512;
    const H = 150;
    ctx.save();
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Solid dark card + thought tail pointer (no background bleed-through)
    ctx.fillStyle = '#090e18';
    ctx.beginPath();
    ctx.roundRect(10, 8, W - 20, H - 30, 18);
    ctx.fill();
    ctx.strokeStyle = brain.identity.accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pointer triangle at bottom center
    ctx.fillStyle = '#090e18';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 11, H - 23);
    ctx.lineTo(W / 2 + 11, H - 23);
    ctx.lineTo(W / 2, H - 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = brain.identity.accentColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 10, H - 22);
    ctx.lineTo(W / 2, H - 6);
    ctx.lineTo(W / 2 + 10, H - 22);
    ctx.stroke();

    // Accent dot + Name
    ctx.fillStyle = brain.identity.accentColor;
    ctx.beginPath();
    ctx.arc(32, 32, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 20px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(brain.identity.name, 48, 32, 270);

    // Mood tag on right
    ctx.fillStyle = '#86efac';
    ctx.font = '600 15px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(brain.mood.toUpperCase(), W - 28, 32, 145);

    // Multi-line wrapped quoted thought
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '500 18px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    const maxLineW = W - 56;
    const words = `"${brain.thought}"`.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width > maxLineW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    const displayLines = lines.slice(0, 3);
    if (lines.length > 3) {
      displayLines[2] = displayLines[2].replace(/\s+\S*$/, '') + '…"';
    }
    for (let i = 0; i < displayLines.length; i++) {
      ctx.fillText(displayLines[i], 28, 66 + i * 24, maxLineW);
    }

    ctx.restore();
    this.thoughtBubbleTex.needsUpdate = true;
  }

  private updateSelectedVisuals() {
    const a = this.selectedActor;
    if (
      !a ||
      !a.brain ||
      !this.sim.isStaffVisible() ||
      !a.g.visible ||
      (a.g.children.length > 0 && !a.g.children[0].visible) ||
      (a as { state?: string }).state === 'away' ||
      this.sim.walkOn
    ) {
      this.thoughtBubbleSprite.visible = false;
      this.selectionRing.visible = false;
      return;
    }

    const pos = a.g.position;
    this.selectionRing.visible = true;
    this.selectionRing.position.set(pos.x, pos.y + 0.03, pos.z);
    (this.selectionRing.material as THREE.MeshBasicMaterial).color.set(a.brain.identity.accentColor);

    this.thoughtBubbleSprite.visible = true;
    const camDist = this.camera.position.distanceTo(pos);
    const bubbleW = THREE.MathUtils.clamp(camDist * 0.21, 0.9, 2.6);
    const bubbleH = bubbleW * (300 / 1024);
    this.thoughtBubbleSprite.scale.set(bubbleW, bubbleH, 1);
    this.thoughtBubbleSprite.position.set(pos.x, pos.y + 1.88 + bubbleH * 0.56, pos.z);
    this.drawThoughtBubble(a);
  }

  private selectActor(actor: PersonActor) {
    this.markInteraction();
    this.inspectedMonitor = null;
    this.selectedActor = actor;
    this.followSelectedActor = true;
    this.lastDrawnThoughtKey = '';
    this.updateSelectedVisuals();
    this.focusSelectedCharacter();
    this.emitHud();
  }

  private handlePointerMove = (e: PointerEvent) => {
    if (this.sim.walkOn || this.sim.isDriving()) {
      if (this.hoveredRoom) {
        this.hoveredRoom = null;
        this.emitHud();
      }
      return;
    }
    const now = performance.now();
    if (now - this.lastMoveRayTs < 65) return;
    this.lastMoveRayTs = now;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const cut = this.getCutawayLevelIndex();
    const visiblePicks =
      this.activeBuilding === 'hub' ? this.arch.picks.filter((p) => cut === null || p.room.lv <= cut) : [];
    const visibleMonitorMeshes = this.arch.monitorPicks
      .filter((m) => {
        const bId = m.buildingId ?? 'hub';
        if (cut !== null) {
          if (bId !== this.activeBuilding) return false;
          return cut < 0 ? m.lv === cut : m.lv >= 0 && m.lv <= cut;
        }
        return m.lv >= 0;
      })
      .flatMap((m) => m.meshes);
    const visibleBuildingMeshes = this.buildingPickList
      .filter((b) => b.buildingId !== this.activeBuilding)
      .map((b) => b.mesh);
    const visibleCarMeshes = cut === null ? this.sim.getPlayerCarPickMeshes() : [];
    const targets = [
      ...visibleMonitorMeshes,
      ...visibleCarMeshes,
      ...visiblePicks.map((p) => p.mesh),
      ...visibleBuildingMeshes,
    ];
    const hits = this.raycaster.intersectObjects(targets, false);
    const actorHit = this.pickActorUnderPointer();

    let nextHover: { title: string; sub: string; color: string; hint?: string } | null = null;
    const firstHit = hits[0];
    const firstMonMatch = firstHit ? this.monitorMeshMap.get(firstHit.object) : undefined;
    const firstCarMatch = firstHit ? this.playerCarPickSet.has(firstHit.object) : false;
    const firstBuildingId = firstHit ? this.buildingPickMap.get(firstHit.object) : undefined;

    if (actorHit && (!firstMonMatch || actorHit.distance <= firstHit.distance + 0.15)) {
      const brain = actorHit.actor.brain!;
      nextHover = {
        title: brain.identity.name,
        sub: `${brain.identity.role} · "${brain.thought}"`,
        color: brain.identity.accentColor,
        hint: 'Click character to read thoughts & follow',
      };
    } else if (firstHit) {
      const hitObj = firstHit.object;
      if (firstMonMatch) {
        const bId = firstMonMatch.buildingId ?? 'hub';
        const ws = this.sim.getMonitorWorkerStatus(firstMonMatch.lv, firstMonMatch.seatX, firstMonMatch.seatZ, bId);
        nextHover = {
          title: firstMonMatch.role,
          sub: `${firstMonMatch.zone} · ${ws.workerActivity}`,
          color: firstMonMatch.color,
          hint: 'Click computer to view live screen & activity',
        };
      } else if (firstCarMatch) {
        nextHover = {
          title: 'Executive Sedan · KDP 300D',
          sub: 'Drivable district vehicle · Full GPS navigation to all 9 companies',
          color: '#38bdf8',
          hint: 'Click car to drive to any office',
        };
      } else {
        const match = visiblePicks.find((p) => p.mesh === hitObj);
        if (match) {
          const r = match.room;
          nextHover = {
            title: r.n,
            sub: r.sub || `Level ${r.lv} · Department Bay`,
            color: `#${r.c.toString(16).padStart(6, '0')}`,
            hint: 'Click room to go straight there',
          };
        } else if (firstBuildingId) {
          const bSpec = DISTRICT_BUILDING_MAP[firstBuildingId];
          nextHover = {
            title: bSpec.name,
            sub: `${bSpec.niche} · ${bSpec.floors} Floors`,
            color: bSpec.accent,
            hint: 'Click building to enter & explore floors',
          };
        }
      }
    }

    const changed =
      (nextHover?.title || '') !== (this.hoveredRoom?.title || '') ||
      (nextHover?.sub || '') !== (this.hoveredRoom?.sub || '') ||
      (nextHover?.hint || '') !== (this.hoveredRoom?.hint || '');
    this.hoveredRoom = nextHover;
    this.renderer.domElement.style.cursor = nextHover ? 'pointer' : 'grab';
    if (changed) this.emitHud();
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.markInteraction();
    this.downX = e.clientX;
    this.downY = e.clientY;
  };

  private handleClick = (e: MouseEvent) => {
    if (this.sim.walkOn || this.sim.isDriving()) return;
    if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const cut = this.getCutawayLevelIndex();
    const visiblePicks =
      this.activeBuilding === 'hub' ? this.arch.picks.filter((p) => cut === null || p.room.lv <= cut) : [];
    const visibleMonitorMeshes = this.arch.monitorPicks
      .filter((m) => {
        const bId = m.buildingId ?? 'hub';
        if (cut !== null) {
          if (bId !== this.activeBuilding) return false;
          return cut < 0 ? m.lv === cut : m.lv >= 0 && m.lv <= cut;
        }
        return m.lv >= 0;
      })
      .flatMap((m) => m.meshes);
    const visibleBuildingMeshes = this.buildingPickList
      .filter((b) => b.buildingId !== this.activeBuilding)
      .map((b) => b.mesh);
    const visibleCarMeshes = cut === null ? this.sim.getPlayerCarPickMeshes() : [];
    const targets = [
      ...visibleMonitorMeshes,
      ...visibleCarMeshes,
      ...visiblePicks.map((p) => p.mesh),
      ...visibleBuildingMeshes,
    ];
    const hits = this.raycaster.intersectObjects(targets, false);
    const actorHit = this.pickActorUnderPointer();
    const firstHit = hits[0];
    const firstMonMatch = firstHit ? this.monitorMeshMap.get(firstHit.object) : undefined;
    const firstCarMatch = firstHit ? this.playerCarPickSet.has(firstHit.object) : false;
    const firstBuildingId = firstHit ? this.buildingPickMap.get(firstHit.object) : undefined;

    if (actorHit && (!firstMonMatch || actorHit.distance <= firstHit.distance + 0.15)) {
      this.selectActor(actorHit.actor);
      return;
    }

    if (!firstHit) return;

    const hitObj = firstHit.object;
    if (firstMonMatch) {
      this.inspectMonitor(firstMonMatch);
      return;
    }
    if (firstCarMatch) {
      this.toggleDrive();
      return;
    }

    const match = visiblePicks.find((p) => p.mesh === hitObj);
    if (match) {
      this.markInteraction();
      if (this.sim.tourOn) this.sim.endTour();
      this.inspectedMonitor = null;
      this.selectedActor = null;
      this.followSelectedActor = false;
      this.arch.basementGroup.visible = false;
      this.arch.plazaGroup.visible = true;
      this.activeBuilding = 'hub';
      this.activeLevel = String(match.room.lv);
      const cx =
        'cx' in match.room && match.room.cx != null
          ? match.room.cx
          : COLX[(match.room as RoomDef).col];
      const y0 = LV[match.room.lv];
      const dist =
        match.room.n === 'Board Room'
          ? 16.5
          : match.room.n === 'Chief Executive Officer'
            ? 15.5
            : match.room.n === 'Reception Atrium'
              ? 16.0
              : 13.8;
      this.sim.flyTo(
        new THREE.Vector3(cx + (cx > 8 ? -1.2 : cx < -8 ? 1.2 : 0), y0 + 2.8, dist),
        new THREE.Vector3(cx, y0 + 1.45, 3.8)
      );
      this.emitHud();
      return;
    }

    if (firstBuildingId) {
      this.selectBuilding(firstBuildingId);
    }
  };

  private inspectMonitor(mon: MonitorPickTarget) {
    this.markInteraction();
    if (this.sim.tourOn) this.sim.endTour();
    this.selectedActor = null;
    this.followSelectedActor = false;
    this.inspectedMonitor = mon;
    const isBasement = mon.lv < 0;
    this.arch.basementGroup.visible = isBasement;
    this.arch.plazaGroup.visible = !isBasement;
    this.activeBuilding = mon.buildingId ?? 'hub';
    this.activeLevel = mon.lv === -1 ? 'b1' : mon.lv === -2 ? 'b2' : String(mon.lv);
    mon.screenRef.next = 0;
    // Fly camera straight to an angled 3/4 over-the-shoulder view so the worker and screen are clearly visible
    const fx = Math.sin(mon.rotY);
    const fz = Math.cos(mon.rotY);
    const rx = Math.cos(mon.rotY);
    const rz = -Math.sin(mon.rotY);
    const [mx, my, mz] = mon.monPos;
    this.sim.flyTo(
      new THREE.Vector3(mx + fx * 1.55 + rx * 0.64, my + 0.36, mz + fz * 1.55 + rz * 0.64),
      new THREE.Vector3(mx + rx * 0.08, my - 0.06, mz + rz * 0.08)
    );
    this.emitHud();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.timerId);
  };

  private handleContextRestored = () => {
    if (this.disposed) return;
    const now = performance.now();
    this.lastTs = now;
    this.lastRenderTs = 0;
    this.handleResize();
    this.scheduleNextTick();
  };

  private updateTimeOfDayLighting(simMinutes: number, weatherState?: WeatherAtmosphereState) {
    // Solar elevation curve (sunrise ~06:20, zenith ~12:30, sunset ~18:40)
    const hr = simMinutes / 60;
    const dayPhase = Math.max(0, Math.min(1, (hr - 6.2) / 12.6));
    const sunElev = Math.sin(dayPhase * Math.PI); // 0 at night/horizon, 1 at solar noon
    const isDay = hr >= 6.0 && hr <= 18.8;
    const baseSunIntensity = isDay ? 0.32 + sunElev * 1.38 : 0.14;

    const az = (dayPhase - 0.5) * Math.PI * 0.85;
    this.sunLight.position.set(
      Math.sin(az) * 72,
      Math.max(12, sunElev * 74),
      Math.cos(az) * 58
    );

    // Warm golden hour vs crisp equatorial noon vs indigo dusk
    if (!isDay) {
      this._sunCol.setHex(0x8aa8e8);
      this._zenith.setHex(0x0b1322);
      this._horizon.setHex(0x1b2940);
      this._fogCol.setHex(0x121b2b);
      this._skyGround.setHex(0x0c1118);
      this.hemiLight.intensity = 0.26;
      this.skyFillLight.intensity = 0.12;
    } else if (sunElev < 0.35) {
      const k = sunElev / 0.35;
      this._sunCol.setHex(0xffa968).lerp(new THREE.Color(0xfff1d6), k);
      this._zenith.setHex(0x213b64).lerp(new THREE.Color(0x2f63a2), k);
      this._horizon.setHex(0xe89e74).lerp(new THREE.Color(0xbcd8f4), k);
      this._fogCol.setHex(0x3a3242).lerp(new THREE.Color(0x7c97b8), k);
      this._skyGround.setHex(0x252832);
      this.hemiLight.intensity = 0.4 + k * 0.24;
      this.skyFillLight.intensity = 0.18 + k * 0.1;
    } else {
      this._sunCol.setHex(0xfff4e0);
      this._zenith.setHex(0x2d64a6);
      this._horizon.setHex(0xc4dcf4);
      this._fogCol.setHex(0x88a4c2);
      this._skyGround.setHex(0x3a404a);
      this.hemiLight.intensity = 0.64;
      this.skyFillLight.intensity = 0.28;
    }

    const w = weatherState ?? this.weather.state;
    const nightDarken = isDay ? 0.45 + 0.55 * sunElev : 0.22;
    this._wZenith.copy(w.skyTintZenith).multiplyScalar(nightDarken);
    this._wHorizon.copy(w.skyTintHorizon).multiplyScalar(nightDarken);
    this._wFog.copy(w.fogTint).multiplyScalar(nightDarken);

    if (w.skyMix > 0.005) {
      this._zenith.lerp(this._wZenith, w.skyMix);
      this._horizon.lerp(this._wHorizon, w.skyMix);
      this._fogCol.lerp(this._wFog, w.skyMix);
      this._skyGround.lerp(this._wFog, w.skyMix * 0.45);
    }

    const flash = w.lightningFlash;
    if (flash > 0.01) {
      this._fogCol.lerp(this._lightningCol, flash * 0.28);
      this._sunCol.lerp(this._lightningCol, flash * 0.55);
    }

    this.sunLight.intensity = baseSunIntensity * w.sunMult + flash * 2.25;
    this.hemiLight.intensity = this.hemiLight.intensity * w.hemiMult + flash * 0.55;
    this.skyFillLight.intensity = this.skyFillLight.intensity * w.fillMult + flash * 0.35;
    this.fog.density = w.fogDensity;

    this.sunLight.color.copy(this._sunCol);
    this.skyMat.uniforms.uZenith.value.copy(this._zenith);
    this.skyMat.uniforms.uHorizon.value.copy(this._horizon);
    this.skyMat.uniforms.uGround.value.copy(this._skyGround);
    this.skyMat.uniforms.uTime.value = this.elapsed;
    this.skyMat.uniforms.uCloudCover.value = w.cloudCover;
    this.skyMat.uniforms.uLightning.value = flash;
    this.fog.color.copy(this._fogCol);
    this.renderer.setClearColor(this._fogCol, 1);

    // Wet plaza / street asphalt response during rain, thunderstorm, or snowmelt
    this.asphaltMat.roughness = THREE.MathUtils.lerp(0.92, 0.24, w.wetness);
    this.asphaltMat.envMapIntensity = THREE.MathUtils.lerp(0.22, 0.65, w.wetness);

    // Interior warm lights glow brighter after dusk and under overcast/storm skies
    const weatherGlow = w.skyMix * 0.72;
    const interiorIntensity = (isDay ? 1.2 : 2.3) + weatherGlow;
    for (const l of this.arch.interiorWarmLights) {
      l.intensity = interiorIntensity;
    }
    for (const g of this.arch.streetGlows) {
      (g.material as THREE.SpriteMaterial).opacity = isDay ? 0.14 + w.skyMix * 0.24 : 0.48;
    }
  }

  private loop = (now: number) => {
    if (this.disposed || document.hidden) return;

    if (!this.isSoftwareGl) {
      this.rafId = requestAnimationFrame(this.loop);
      const isActive =
        now - this.lastInteractionTs < 1400 ||
        this.sim.walkOn ||
        this.sim.isDriving() ||
        this.sim.tourOn ||
        this.sim.isCameraFlying() ||
        this.cutawayAnimating;
      const minFrameMs = isActive ? 33 : this.sim.simRate === 0 ? 333 : 66;
      if (this.lastRenderTs > 0 && now - this.lastRenderTs < minFrameMs) {
        return;
      }
      this.lastRenderTs = now;
    }

    try {
      const dt = Math.min(0.15, Math.max(0.001, (now - this.lastTs) / 1000));
      this.lastTs = now;
      this.elapsed += dt;

      // Kinetic atrium centerpiece + roof ventilator fans
      this.arch.sculptureCore.rotation.y += dt * 0.35;
      this.arch.sculptureCore.rotation.x = 0.26 + Math.sin(this.elapsed * 0.35) * 0.04;
      if (this.arch.sculptureRings[0]) this.arch.sculptureRings[0].rotation.z += dt * 0.45;
      if (this.arch.sculptureRings[1]) this.arch.sculptureRings[1].rotation.x -= dt * 0.32;
      this.arch.sculptureHalo.material.opacity = 0.04 + Math.sin(this.elapsed * 1.9) * 0.015;
      for (const f of this.arch.roofFans) {
        f.rotation.y += dt * 4.5;
      }

      // Floor cutaway peel-off animation from above
      this.updateFloorCutaway(dt);

      // Dynamic weather particles, window droplets/frost & time-of-day atmosphere
      const wState = this.weather.update(
        dt,
        this.elapsed,
        this.sim.simMin,
        this.activeLevel,
        this.arch.roofShellGroup.visible
      );
      this.sim.setWeatherTimeMultiplier(this.weather.getTimeMultiplier());
      this.updateTimeOfDayLighting(this.sim.simMin, wState);

      // Organic foliage breeze modulated by current weather atmosphere
      const windMul =
        wState.activeWeather === 'storm'
          ? 2.4
          : wState.activeWeather === 'rain'
            ? 1.75
            : wState.activeWeather === 'overcast'
              ? 1.35
              : 1.0;
      const windSpeed = wState.activeWeather === 'storm' ? 1.55 : 1.0;
      const tWind = this.elapsed * windSpeed;
      for (const item of this.proceduralFoliage.windItems) {
        const w = Math.sin(tWind * item.freq + item.phase);
        const w2 = Math.cos(tWind * item.freq * 0.83 + item.phase * 1.27);
        item.obj.rotation.x = item.baseRotX + w * item.amp * windMul;
        item.obj.rotation.z = item.baseRotZ + w2 * item.amp * 0.78 * windMul;
      }

      // Staff, lifts, traffic, tour & first-person walk
      if (this.selectedActor) {
        this._lastActorPos.copy(this.selectedActor.g.position);
      }
      this.sim.update(dt, this.elapsed, this.camera, this.controls);

      if (this.selectedActor) {
        if (
          this.followSelectedActor &&
          !this.sim.walkOn &&
          !this.sim.tourOn &&
          !this.sim.isCameraFlying()
        ) {
          const curPos = this.selectedActor.g.position;
          const dx = curPos.x - this._lastActorPos.x;
          const dy = curPos.y - this._lastActorPos.y;
          const dz = curPos.z - this._lastActorPos.z;
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 0.0001) {
            this.controls.target.x += dx;
            this.controls.target.y += dy;
            this.controls.target.z += dz;
            this.camera.position.x += dx;
            this.camera.position.y += dy;
            this.camera.position.z += dz;
            this.controls.update();
          }
        }
        this.updateSelectedVisuals();
      } else {
        this.thoughtBubbleSprite.visible = false;
        this.selectionRing.visible = false;
      }

      // Spatialized ambient office audio + drivable vehicle engine RPM / tire noise
      this._camRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      this.audio.update(dt, this.camera.position, this._camRight, this.sim.getAmbientSources(), {
        walkOn: this.sim.walkOn,
        activeLevel: this.activeLevel,
        simRate: this.sim.simRate,
        trafficHint: this.sim.getTrafficAudioHint(this.camera.position, this._camRight),
      });
      this.audio.updateDriveEngine(this.sim.getDriveAudioState());

      // Animated office screens & wall TVs (only draws visible screens on active floors)
      const cut = this.getCutawayLevelIndex();
      updateAllScreens(this.screenReg, this.camera, this.elapsed, cut);
      if (this.inspectedMonitor) {
        const s = this.inspectedMonitor.screenRef;
        if (this.elapsed >= s.next) {
          s.next = this.elapsed + 0.18;
          renderWorkScreenFrame(s, this.elapsed);
        }
      }

      this.skyDome.position.copy(this.camera.position);
      this.renderer.render(this.scene, this.camera);

      this.hudEmitAccum += dt;
      if (this.hudEmitAccum >= 0.18) {
        this.hudEmitAccum = 0;
        this.emitHud();
      }

      if (this.isSoftwareGl) {
        this.scheduleNextTick();
      }
    } catch (err) {
      cancelAnimationFrame(this.rafId);
      clearTimeout(this.timerId);
      this.onFatalError?.(err instanceof Error ? err.message : '3D render loop encountered an unexpected error.');
    }
  };

  private buildInspectedMonitorHud(): InspectedMonitor | null {
    const m = this.inspectedMonitor;
    if (!m) return null;
    const ws = this.sim.getMonitorWorkerStatus(m.lv, m.seatX, m.seatZ, m.buildingId ?? 'hub');
    return {
      id: m.id,
      buildingId: m.buildingId ?? 'hub',
      stationKey: m.stationKey,
      seatIndex: m.seatIndex,
      projectTitle: m.projectTitle,
      zone: m.zone,
      role: m.role,
      levelLabel:
        m.lv === -1
          ? 'Basement 1 (B1)'
          : m.lv === -2
            ? 'Basement 2 (B2)'
            : m.lv === 0
              ? 'Ground (G)'
              : `Level ${m.lv}`,
      color: m.color,
      workerActivity: ws.workerActivity,
      screenTask: m.screenTask,
      isOccupied: ws.isOccupied,
    };
  }

  private buildSelectedCharacterHud(): SelectedCharacterSnapshot | null {
    const a = this.selectedActor;
    if (!a || !a.brain || !this.sim.isStaffVisible()) return null;
    const b = a.brain;
    const distActor = a as PersonActor & { buildingId?: string; lv?: number };
    let levelLabel = 'Ground (G)';
    if (distActor.buildingId === 'street') {
      levelLabel = 'Street Promenade (G)';
    } else if (distActor.buildingId && distActor.buildingId !== 'hub') {
      const dlv = distActor.lv ?? 0;
      levelLabel = dlv === 0 ? 'Ground (G)' : `Level ${dlv}`;
    } else {
      const y = a.g.position.y;
      if (y < -6.5) levelLabel = 'Basement 2 (B2)';
      else if (y < -2.0) levelLabel = 'Basement 1 (B1)';
      else {
        let bestLv = 0;
        let bestDiff = Infinity;
        for (let i = 0; i < LV.length; i++) {
          const d = Math.abs(y - LV[i]);
          if (d < bestDiff) {
            bestDiff = d;
            bestLv = i;
          }
        }
        levelLabel = bestLv === 0 ? 'Ground (G)' : `Level ${bestLv}`;
      }
    }
    return {
      id: b.identity.id,
      buildingId: (distActor.buildingId as BuildingId | 'street') ?? 'hub',
      name: b.identity.name,
      role: b.identity.role,
      department: b.identity.department,
      seniority: b.identity.seniority,
      accentColor: b.identity.accentColor,
      personality: b.identity.personality,
      mood: b.mood,
      goal: b.goal,
      actionLabel: b.actionLabel,
      thought: b.thought,
      recentThoughts: [...b.recentThoughts],
      focus: Math.round(b.focus),
      energy: Math.round(b.energy),
      social: Math.round(b.social),
      levelLabel,
      isFollowing: this.followSelectedActor,
      isGuide: a === this.sim.guideActor,
    };
  }

  private emitHud() {
    const snap = this.sim.getSnapshot(
      this.activeLevel,
      this.hoveredRoom,
      this.audio.isEnabled(),
      this.buildInspectedMonitorHud(),
      this.buildSelectedCharacterHud(),
      this.activeBuilding
    );
    const cut = this.getCutawayLevelIndex();
    if (
      this.activeBuilding === 'hub' &&
      cut !== null &&
      snap.floorActivity &&
      !this.sim.walkOn &&
      !this.sim.tourOn &&
      !this.selectedActor &&
      !this.inspectedMonitor
    ) {
      const zoneMap = new Map(snap.floorActivity.zones.map((z) => [z.zone, z.status]));
      for (const b of this.overheadBadges) {
        const show = b.lv === cut;
        b.sprite.visible = show;
        if (show) {
          this.drawOverheadBadge(b, zoneMap.get(b.zone) || 'Active');
        }
      }
    } else {
      for (const b of this.overheadBadges) {
        b.sprite.visible = false;
      }
    }
    snap.weatherMode = this.weather.getMode();
    snap.activeWeather = this.weather.state.activeWeather;
    snap.weatherLabel = this.weather.state.label;
    snap.weatherTimeFactor = this.weather.state.timeFactor;
    this.onHudChange(snap);
  }

  /* =========================================================
     PUBLIC API FOR REACT CONTROLS
     ========================================================= */
  public closeMonitorInspector() {
    this.inspectedMonitor = null;
    this.emitHud();
  }

  public getInspectedScreenCanvas(): HTMLCanvasElement | null {
    return (this.inspectedMonitor?.screenRef.g.canvas as HTMLCanvasElement) || null;
  }

  public closeCharacterInspector() {
    this.selectedActor = null;
    this.followSelectedActor = false;
    this.thoughtBubbleSprite.visible = false;
    this.selectionRing.visible = false;
    this.emitHud();
  }

  public focusSelectedCharacter() {
    const a = this.selectedActor;
    if (!a) return;
    this.markInteraction();
    const pos = a.g.position;
    const cut = this.getCutawayLevelIndex();
    const distA = a as PersonActor & { buildingId?: BuildingId };
    const bSpec = distA.buildingId && DISTRICT_BUILDING_MAP[distA.buildingId];
    const zOffset = bSpec && bSpec.doorSide === 'north' ? -7.6 : 7.6;
    const camX = pos.x + (pos.x > 0 ? -0.55 : 0.55);
    const camY = pos.y + (cut !== null ? 3.2 : 2.35);
    const camZ = pos.z + zOffset;
    this.sim.flyTo(
      new THREE.Vector3(camX, camY, camZ),
      new THREE.Vector3(pos.x + 0.55, pos.y + 1.25, pos.z)
    );
  }

  public toggleFollowCharacter() {
    if (!this.selectedActor) return;
    this.followSelectedActor = !this.followSelectedActor;
    if (this.followSelectedActor) {
      this.focusSelectedCharacter();
    }
    this.emitHud();
  }

  public nudgeSelectedCharacter() {
    if (!this.selectedActor) return;
    this.markInteraction();
    this.sim.nudgeCharacterFreeWill(this.selectedActor);
    this.lastDrawnThoughtKey = '';
    this.updateSelectedVisuals();
    this.emitHud();
  }

  public notifyCompanyJob(buildingId: BuildingId) {
    this.sim.nudgeCompanyForJob(buildingId);
    this.lastDrawnThoughtKey = '';
    if (this.selectedActor) this.updateSelectedVisuals();
    this.emitHud();
  }

  public selectBuilding(id: BuildingId) {
    this.markInteraction();
    if (this.sim.walkOn) this.sim.exitWalk(this.camera, this.controls);
    if (this.sim.isDriving()) this.sim.exitDrive(this.camera, this.controls);
    if (this.sim.tourOn) this.sim.endTour();
    this.inspectedMonitor = null;
    this.selectedActor = null;
    this.followSelectedActor = false;
    this.activeBuilding = id;
    this.activeLevel = 'overview';
    this.arch.basementGroup.visible = false;
    this.arch.plazaGroup.visible = true;
    const spec = DISTRICT_BUILDING_MAP[id];
    this.sim.flyTo(new THREE.Vector3(...spec.overviewCam.p), new THREE.Vector3(...spec.overviewCam.t));
    this.weather.update(0.001, this.elapsed, this.sim.simMin, this.activeLevel, this.arch.roofShellGroup.visible);
    this.emitHud();
  }

  public selectLevel(key: string) {
    this.markInteraction();
    if (this.sim.walkOn) this.sim.exitWalk(this.camera, this.controls);
    if (this.sim.isDriving()) this.sim.exitDrive(this.camera, this.controls);
    if (this.sim.tourOn) this.sim.endTour();
    this.inspectedMonitor = null;
    this.selectedActor = null;
    this.followSelectedActor = false;
    this.activeLevel = key;

    if (this.activeBuilding === 'hub') {
      const isBasement = key === 'b1' || key === 'b2';
      this.arch.basementGroup.visible = isBasement;
      this.arch.plazaGroup.visible = !isBasement;

      if (key === 'overview') {
        this.sim.flyTo(new THREE.Vector3(0, 20, 64), new THREE.Vector3(0, 12.2, 4));
      } else if (VIEWS[key]) {
        const v = VIEWS[key];
        this.sim.flyTo(new THREE.Vector3(...v.p), new THREE.Vector3(...v.t));
      }
    } else {
      this.arch.basementGroup.visible = false;
      this.arch.plazaGroup.visible = true;
      const spec = DISTRICT_BUILDING_MAP[this.activeBuilding];
      if (key === 'overview') {
        this.sim.flyTo(new THREE.Vector3(...spec.overviewCam.p), new THREE.Vector3(...spec.overviewCam.t));
      } else if (key === 'roof') {
        const rv = getBuildingRoofView(spec);
        this.sim.flyTo(new THREE.Vector3(...rv.p), new THREE.Vector3(...rv.t));
      } else {
        const lv = Math.max(0, Math.min(spec.floors - 1, Number(key) || 0));
        this.activeLevel = String(lv);
        const fv = getBuildingFloorView(spec, lv);
        this.sim.flyTo(new THREE.Vector3(...fv.p), new THREE.Vector3(...fv.t));
      }
    }
    this.weather.update(0.001, this.elapsed, this.sim.simMin, this.activeLevel, this.arch.roofShellGroup.visible);
    this.emitHud();
  }

  public startTour(index = 0) {
    this.markInteraction();
    this.inspectedMonitor = null;
    this.selectedActor = null;
    this.followSelectedActor = false;
    this.activeBuilding = 'hub';
    this.arch.basementGroup.visible = false;
    this.arch.plazaGroup.visible = true;
    this.activeLevel = 'tour';
    this.sim.startTour(index, this.camera, this.controls);
    this.emitHud();
  }

  public endTour() {
    this.markInteraction();
    this.sim.endTour();
    this.activeLevel = 'overview';
    this.emitHud();
  }

  public prevStop() {
    this.markInteraction();
    this.sim.prevStop(this.camera, this.controls);
    this.emitHud();
  }

  public nextStop() {
    this.markInteraction();
    this.sim.nextStop(this.camera, this.controls);
    this.emitHud();
  }

  public toggleTourPlay() {
    this.markInteraction();
    this.sim.toggleTourPlay();
    this.emitHud();
  }

  public toggleWalk() {
    this.markInteraction();
    if (this.sim.walkOn) {
      this.sim.exitWalk(this.camera, this.controls);
      this.activeLevel = 'overview';
    } else {
      this.inspectedMonitor = null;
      this.selectedActor = null;
      this.followSelectedActor = false;
      this.arch.basementGroup.visible = false;
      this.arch.plazaGroup.visible = true;
      this.activeLevel = 'walk';
      this.sim.enterWalk(this.camera, this.controls, this.activeBuilding);
    }
    this.emitHud();
  }

  public setWalkFloor(lv: number) {
    this.markInteraction();
    this.sim.setWalkFloor(lv);
    this.emitHud();
  }

  public setTouchJoystick(nx: number, ny: number) {
    this.markInteraction();
    this.sim.setTouchJoystick(nx, ny);
  }

  public toggleStaff() {
    this.markInteraction();
    const visible = this.sim.toggleStaff();
    if (!visible) {
      this.selectedActor = null;
      this.followSelectedActor = false;
      this.thoughtBubbleSprite.visible = false;
      this.selectionRing.visible = false;
    }
    this.emitHud();
  }

  public setRate(rate: number) {
    this.markInteraction();
    this.sim.setRate(rate);
    this.emitHud();
  }

  public jumpToTime(minutes: number) {
    this.markInteraction();
    this.sim.setClock(minutes);
    const wState = this.weather.update(
      0.016,
      this.elapsed,
      this.sim.simMin,
      this.activeLevel,
      this.arch.roofShellGroup.visible
    );
    this.sim.setWeatherTimeMultiplier(this.weather.getTimeMultiplier());
    this.updateTimeOfDayLighting(this.sim.simMin, wState);
    this.emitHud();
  }

  public setWeatherMode(mode: WeatherMode) {
    this.markInteraction();
    this.weather.setMode(mode);
    const wState = this.weather.update(
      0.016,
      this.elapsed,
      this.sim.simMin,
      this.activeLevel,
      this.arch.roofShellGroup.visible
    );
    this.sim.setWeatherTimeMultiplier(this.weather.getTimeMultiplier());
    this.updateTimeOfDayLighting(this.sim.simMin, wState);
    this.emitHud();
  }

  public toggleAudio() {
    this.audio.toggle();
    this.emitHud();
  }

  public toggleDrive(targetBuilding?: BuildingId | null) {
    this.markInteraction();
    this.audio.unlock();
    if (this.sim.isDriving()) {
      this.sim.exitDrive(this.camera, this.controls);
      this.activeLevel = 'overview';
    } else {
      this.inspectedMonitor = null;
      this.selectedActor = null;
      this.followSelectedActor = false;
      this.arch.basementGroup.visible = false;
      this.arch.plazaGroup.visible = true;
      this.activeLevel = 'overview';
      this.sim.enterDrive(this.camera, this.controls, targetBuilding);
    }
    this.emitHud();
  }

  public stepOutOfCar() {
    this.markInteraction();
    const nearby = this.sim.stepOutOfCar(this.camera, this.controls);
    this.activeBuilding = nearby;
    this.activeLevel = 'walk';
    this.emitHud();
  }

  public enterCarFromWalk() {
    this.markInteraction();
    this.audio.unlock();
    this.sim.enterCarFromWalk(this.camera, this.controls);
    this.activeLevel = 'overview';
    this.emitHud();
  }

  public toggleDriveCamera() {
    this.markInteraction();
    this.sim.toggleDriveCamera();
    this.emitHud();
  }

  public cycleCameraMode() {
    this.markInteraction();
    if (this.sim.isDriving()) {
      this.sim.toggleDriveCamera();
      this.emitHud();
      return;
    }
    if (this.sim.walkOn) {
      return;
    }
    const spec = DISTRICT_BUILDING_MAP[this.activeBuilding];
    const views: string[] = ['overview', 'roof'];
    for (let lv = 0; lv < spec.floors; lv++) {
      views.push(String(lv));
    }
    const idx = views.indexOf(this.activeLevel);
    const nextView = views[(idx + 1) % views.length];
    this.selectLevel(nextView);
  }

  public toggleDriveHeadlights() {
    this.markInteraction();
    this.sim.toggleDriveHeadlights();
    this.emitHud();
  }

  public setDriveTarget(bId: BuildingId | null) {
    this.markInteraction();
    this.sim.setDriveTarget(bId);
    this.emitHud();
  }

  public setDriveTouchInput(throttle: number, steer: number, brake: boolean) {
    this.markInteraction();
    this.sim.setDriveTouchInput(throttle, steer, brake);
  }

  public soundCarHorn() {
    this.markInteraction();
    this.audio.unlock();
    this.audio.playCarHorn();
  }

  public forceRedrawInspectedMonitor() {
    if (this.inspectedMonitor) {
      this.inspectedMonitor.screenRef.next = 0;
      renderWorkScreenFrame(this.inspectedMonitor.screenRef, this.elapsed);
    }
  }

  public applyLiveNairobiSync(minutes: number, weatherMode: WeatherMode) {
    this.markInteraction();
    this.sim.setClock(minutes);
    this.sim.setRate(1);
    this.weather.setMode(weatherMode);
    const wState = this.weather.update(
      0.016,
      this.elapsed,
      this.sim.simMin,
      this.activeLevel,
      this.arch.roofShellGroup.visible
    );
    this.sim.setWeatherTimeMultiplier(this.weather.getTimeMultiplier());
    this.updateTimeOfDayLighting(this.sim.simMin, wState);
    this.emitHud();
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.timerId);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pointerdown', this.handleAudioUnlock);
    window.removeEventListener('keydown', this.handleAudioUnlock);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel);
    this.renderer.domElement.removeEventListener('click', this.handleClick);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.unwireWalk();
    this.weather.dispose();
    this.sim.dispose();
    this.audio.dispose();
    for (const b of this.overheadBadges) {
      b.tex.dispose();
      (b.sprite.material as THREE.SpriteMaterial).dispose();
    }
    this.thoughtBubbleTex.dispose();
    (this.thoughtBubbleSprite.material as THREE.SpriteMaterial).dispose();
    this.selectionRing.geometry.dispose();
    (this.selectionRing.material as THREE.Material).dispose();
    this.controls.dispose();
    clearArchitecturalFormsCache();
    for (const g of this.proceduralFoliage.geometries) g.dispose();
    for (const mat of this.proceduralFoliage.materials) mat.dispose();

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) geometries.add(m.geometry);
      if (m.material) {
        if (Array.isArray(m.material)) m.material.forEach((mm) => materials.add(mm));
        else materials.add(m.material);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
