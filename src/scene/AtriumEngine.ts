import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { buildSceneArchitecture, type ArchitectureHandles, type MonitorPickTarget } from './architecture';
import { BASE, COLX, EXEC, LV, ROOMS, VIEWS, type HudSnapshot, type InspectedMonitor } from './constants';
import { createMaterials } from './materials';
import { createScreenRegistry, updateAllScreens, type ScreenRegistry } from './screens';
import { AtriumSimulation } from './simulation';
import { AmbientAudioManager } from './audio';
import { setMaxAnisotropy } from './textures';

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
  private readonly sim: AtriumSimulation;
  private readonly audio = new AmbientAudioManager();
  private readonly isSoftwareGl: boolean;

  private readonly sunLight: THREE.DirectionalLight;
  private readonly skyFillLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly fog: THREE.FogExp2;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2(-9, -9);

  private activeLevel = 'overview';
  private hoveredRoom: { title: string; sub: string; color: string } | null = null;
  private inspectedMonitor: MonitorPickTarget | null = null;
  private readonly monitorMeshMap = new Map<THREE.Object3D, MonitorPickTarget>();
  private downX = 0;
  private downY = 0;
  private rafId = 0;
  private lastTs = 0;
  private elapsed = 0;
  private hudEmitAccum = 0;
  private onHudChange: (snapshot: HudSnapshot) => void;
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

  // Scratch vectors
  private readonly _sunCol = new THREE.Color();
  private readonly _zenith = new THREE.Color();
  private readonly _horizon = new THREE.Color();
  private readonly _fogCol = new THREE.Color();
  private readonly _skyGround = new THREE.Color();
  private readonly _camRight = new THREE.Vector3();

  constructor(container: HTMLElement, onHudChange: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudChange = onHudChange;
    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x1b2434, 0.0022);
    this.scene.fog = this.fog;

    // Room environment IBL for physically-based metals, glass & car clearcoat
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.2, 600);
    this.camera.position.set(0, 16, 49);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 12.2, 4);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 175;
    this.controls.maxPolarAngle = Math.PI * 0.488;
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.sim.cancelFlight();
    });

    // Procedural atmospheric gradient sky dome
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color(0x2a5488) },
        uHorizon: { value: new THREE.Color(0xb8d4f0) },
        uGround: { value: new THREE.Color(0x3a404a) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uGround;
        varying vec3 vWorldPos;
        void main() {
          vec3 d = normalize(vWorldPos);
          float h = d.y;
          vec3 col = h >= 0.0
            ? mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.52))
            : mix(uHorizon, uGround, pow(clamp(-h * 3.0, 0.0, 1.0), 0.7));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), this.skyMat);
    this.scene.add(skyDome);

    // Three-point + architectural sky/sun illumination
    this.hemiLight = new THREE.HemisphereLight(0xc8e0ff, 0x4b4640, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.9);
    this.sunLight.position.set(42, 64, 54);
    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
      this.sunLight.shadow.camera.near = 10;
      this.sunLight.shadow.camera.far = 210;
      this.sunLight.shadow.camera.left = -64;
      this.sunLight.shadow.camera.right = 64;
      this.sunLight.shadow.camera.top = 56;
      this.sunLight.shadow.camera.bottom = -36;
      this.sunLight.shadow.bias = -0.00035;
      this.sunLight.shadow.normalBias = 0.018;
      this.sunLight.shadow.radius = 2.4;
    }
    this.scene.add(this.sunLight);

    // Subtle cool northern sky-bounce fill light for realistic architectural shadow wrap
    this.skyFillLight = new THREE.DirectionalLight(0xbcd6f6, 0.36);
    this.skyFillLight.position.set(-40, 26, 46);
    this.scene.add(this.skyFillLight);

    // Build PBR material library & architectural shell
    const M = createMaterials();
    this.screenReg = createScreenRegistry();
    this.arch = buildSceneArchitecture(this.scene, M, this.screenReg);

    // Architectural softbox RectAreaLights for Reception Atrium, Board Room, & upper office bays
    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const recPanel = new THREE.RectAreaLight(0xfff3e0, 0.45, 13, 4.2);
      recPanel.position.set(0, 4.9, 4.8);
      recPanel.lookAt(0, 0, 5.2);
      this.scene.add(recPanel);

      const boardPanel = new THREE.RectAreaLight(0xfff5e6, 0.4, 11, 2.6);
      boardPanel.position.set(0, 21.8, 4.9);
      boardPanel.lookAt(0, 18.2, 4.9);
      this.scene.add(boardPanel);

      // Subtle architectural ceiling bounce strips on L1-L3 & L5 executive suite
      [LV[1], LV[2], LV[3], LV[5]].forEach((ly) => {
        [-10.2, 10.2].forEach((lx) => {
          const bayLight = new THREE.RectAreaLight(0xfff6ea, 0.22, 16, 2.2);
          bayLight.position.set(lx, ly + 3.55, 4.4);
          bayLight.lookAt(lx, ly, 4.4);
          this.scene.add(bayLight);
        });
      });
    }

    // Build dynamic office simulation (staff, Zuri, vehicles, walk controls)
    this.sim = new AtriumSimulation(this.scene, M, this.arch.cabs, () => this.audio.playFootstep());
    this.unwireWalk = this.sim.wireWalk(this.renderer.domElement, this.camera, this.controls);
    this.initOverheadBadges();
    for (const mp of this.arch.monitorPicks) {
      for (const m of mp.meshes) {
        this.monitorMeshMap.set(m, mp);
      }
    }

    // Wire events & audio gesture unlock
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('pointerdown', this.handleAudioUnlock, { passive: true });
    window.addEventListener('keydown', this.handleAudioUnlock, { passive: true });
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('click', this.handleClick);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);

    this.updateTimeOfDayLighting(this.sim.simMin);
    this.emitHud();
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private initOverheadBadges() {
    this.scene.add(this.overheadBadgesGroup);

    const addBadge = (lv: number, zone: string, x: number, y: number, z: number, color: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(x, y, z);
      sprite.scale.set(4.9, 1.22, 1);
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
    addBadge(4, 'Board Room', EXEC.board.cx, LV[4] + 3.45, 1.55, '#c9a24b');
    addBadge(4, 'Executive Lounge', EXEC.lounge.cx, LV[4] + 3.45, 1.55, '#7a5c3a');
    addBadge(4, 'Board Secretary', EXEC.secr.cx, LV[4] + 3.45, 1.55, '#5d6b7a');
    addBadge(5, EXEC.tech.n, EXEC.tech.cx, LV[5] + 3.45, 1.55, '#34598f');
    addBadge(5, EXEC.mkt.n, EXEC.mkt.cx, LV[5] + 3.45, 1.55, '#7a2f5a');
    addBadge(5, EXEC.fin.n, EXEC.fin.cx, LV[5] + 3.45, 1.55, '#2d7a5a');
    addBadge(5, EXEC.ops.n, EXEC.ops.cx, LV[5] + 3.45, 1.55, '#c9762e');
    addBadge(5, EXEC.ceo.n, EXEC.ceo.cx, LV[5] + 3.45, 1.55, '#8a1f2e');
  }

  private drawOverheadBadge(
    b: (typeof this.overheadBadges)[number],
    status: string
  ) {
    if (b.lastStatus === status) return;
    b.lastStatus = status;
    const { ctx, canvas, color, zone } = b;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Rounded dark card
    ctx.fillStyle = 'rgba(13, 18, 26, 0.9)';
    ctx.beginPath();
    ctx.roundRect(8, 12, W - 16, H - 24, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Color swatch dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(38, 46, 10, 0, Math.PI * 2);
    ctx.fill();

    // Zone title
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 26px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(zone, 60, 46, W - 82);

    // Activity status
    ctx.fillStyle = '#6fe3a1';
    ctx.font = '500 22px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(status, 30, 86, W - 56);

    b.tex.needsUpdate = true;
  }

  private getCutawayLevelIndex(): number | null {
    if (this.activeLevel === 'b1') return -1;
    if (this.activeLevel === 'b2') return -2;
    if (
      this.activeLevel === '0' ||
      this.activeLevel === '1' ||
      this.activeLevel === '2' ||
      this.activeLevel === '3' ||
      this.activeLevel === '4' ||
      this.activeLevel === '5'
    ) {
      return Number(this.activeLevel);
    }
    return null;
  }

  private updateFloorCutaway(dt: number) {
    const cut = this.getCutawayLevelIndex();

    if (cut === null) {
      this.arch.roofShellGroup.visible = true;
      this.arch.roofShellGroup.position.y = THREE.MathUtils.damp(
        this.arch.roofShellGroup.position.y,
        0,
        7.5,
        dt
      );
      for (let s = 0; s < this.arch.levelGroups.length; s++) {
        const lg = this.arch.levelGroups[s];
        lg.visible = true;
        lg.position.y = THREE.MathUtils.damp(lg.position.y, 0, 7.5, dt);
        this.arch.levelCeilings[s].visible = true;
      }
      this.arch.b1Group.visible = true;
      this.arch.b1Ceiling.visible = true;
      this.arch.b2Group.visible = true;
      this.arch.b2Ceiling.visible = true;
      this.sim.setCutawayMaxY(null);
      for (const b of this.overheadBadges) b.sprite.visible = false;
      return;
    }

    // Lift & clear roof when inspecting any floor below roof
    this.arch.roofShellGroup.position.y = THREE.MathUtils.damp(
      this.arch.roofShellGroup.position.y,
      26,
      7.0,
      dt
    );
    this.arch.roofShellGroup.visible = this.arch.roofShellGroup.position.y < 14;

    for (let s = 0; s < this.arch.levelGroups.length; s++) {
      const lg = this.arch.levelGroups[s];
      const isAbove = s > cut;
      const targetY = isAbove ? 26 : 0;
      lg.position.y = THREE.MathUtils.damp(lg.position.y, targetY, 7.0, dt);
      lg.visible = isAbove ? lg.position.y < 14 : true;
      this.arch.levelCeilings[s].visible = s !== cut;
    }

    if (cut === -1) {
      this.arch.basementGroup.visible = true;
      this.arch.b1Group.visible = true;
      this.arch.b1Ceiling.visible = false;
      this.arch.b2Group.visible = true;
      this.arch.b2Ceiling.visible = true;
      this.sim.setCutawayMaxY(BASE[0].y + 3.8);
    } else if (cut === -2) {
      this.arch.basementGroup.visible = true;
      this.arch.b1Group.visible = false;
      this.arch.b2Group.visible = true;
      this.arch.b2Ceiling.visible = false;
      this.sim.setCutawayMaxY(BASE[1].y + 3.8);
    } else {
      this.arch.basementGroup.visible = false;
      this.sim.setCutawayMaxY(LV[cut] + 3.7);
    }
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
    this.renderer.setSize(w, h);
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.sim.walkOn) {
      if (this.hoveredRoom) {
        this.hoveredRoom = null;
        this.emitHud();
      }
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const cut = this.getCutawayLevelIndex();
    const visiblePicks = this.arch.picks.filter((p) => cut === null || p.room.lv <= cut);
    const visibleMonitorMeshes = this.arch.monitorPicks
      .filter((m) => cut === null || m.lv <= cut)
      .flatMap((m) => m.meshes);
    const targets = [...visibleMonitorMeshes, ...this.sim.guideMeshes, ...visiblePicks.map((p) => p.mesh)];
    const hits = this.raycaster.intersectObjects(targets, false);
    let nextHover: { title: string; sub: string; color: string } | null = null;
    if (hits.length > 0) {
      const hitObj = hits[0].object;
      const monMatch = this.monitorMeshMap.get(hitObj);
      if (monMatch) {
        const ws = this.sim.getMonitorWorkerStatus(monMatch.lv, monMatch.seatX, monMatch.seatZ);
        nextHover = {
          title: monMatch.role,
          sub: `${monMatch.zone} · ${ws.workerActivity}`,
          color: monMatch.color,
        };
      } else if (this.sim.guideMeshes.includes(hitObj as THREE.Mesh)) {
        nextHover = {
          title: 'Zuri · Office Guide',
          sub: 'Click to start or resume the guided tour across all 17 stops',
          color: '#6fe3a1',
        };
      } else {
        const match = visiblePicks.find((p) => p.mesh === hitObj);
        if (match) {
          const r = match.room;
          nextHover = {
            title: r.n,
            sub: r.sub || `Level ${r.lv} · Department Bay`,
            color: `#${r.c.toString(16).padStart(6, '0')}`,
          };
        }
      }
    }

    const changed =
      (nextHover?.title || '') !== (this.hoveredRoom?.title || '') ||
      (nextHover?.sub || '') !== (this.hoveredRoom?.sub || '');
    this.hoveredRoom = nextHover;
    this.renderer.domElement.style.cursor = nextHover ? 'pointer' : 'grab';
    if (changed) this.emitHud();
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.downX = e.clientX;
    this.downY = e.clientY;
  };

  private handleClick = (e: MouseEvent) => {
    if (this.sim.walkOn) return;
    if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    const cut = this.getCutawayLevelIndex();
    const visiblePicks = this.arch.picks.filter((p) => cut === null || p.room.lv <= cut);
    const visibleMonitorMeshes = this.arch.monitorPicks
      .filter((m) => cut === null || m.lv <= cut)
      .flatMap((m) => m.meshes);
    const targets = [...visibleMonitorMeshes, ...this.sim.guideMeshes, ...visiblePicks.map((p) => p.mesh)];
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return;

    const hitObj = hits[0].object;
    const monMatch = this.monitorMeshMap.get(hitObj);
    if (monMatch) {
      this.inspectMonitor(monMatch);
      return;
    }

    if (this.sim.guideMeshes.includes(hitObj as THREE.Mesh)) {
      this.inspectedMonitor = null;
      this.startTour(this.sim.tourI);
      return;
    }
    const match = visiblePicks.find((p) => p.mesh === hitObj);
    if (match) {
      this.inspectedMonitor = null;
      this.selectLevel(String(match.room.lv));
      this.sim.startTourAtRoom(match.room.n, this.camera, this.controls);
      this.activeLevel = 'tour';
      this.emitHud();
    }
  };

  private inspectMonitor(mon: MonitorPickTarget) {
    if (this.sim.tourOn) this.sim.endTour();
    this.inspectedMonitor = mon;
    mon.screenRef.next = 0;
    // Fly camera to an angled 3/4 over-the-shoulder view so the worker and screen are both clearly visible with zero clipping
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
  };

  private updateTimeOfDayLighting(simMinutes: number) {
    // Solar elevation curve (sunrise ~06:20, zenith ~12:30, sunset ~18:40)
    const hr = simMinutes / 60;
    const dayPhase = Math.max(0, Math.min(1, (hr - 6.2) / 12.6));
    const sunElev = Math.sin(dayPhase * Math.PI); // 0 at night/horizon, 1 at solar noon
    const isDay = hr >= 6.0 && hr <= 18.8;
    const sunIntensity = isDay ? 0.32 + sunElev * 1.38 : 0.14;

    const az = (dayPhase - 0.5) * Math.PI * 0.85;
    this.sunLight.position.set(
      Math.sin(az) * 72,
      Math.max(12, sunElev * 74),
      Math.cos(az) * 58
    );
    this.sunLight.intensity = sunIntensity;

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

    this.sunLight.color.copy(this._sunCol);
    this.skyMat.uniforms.uZenith.value.copy(this._zenith);
    this.skyMat.uniforms.uHorizon.value.copy(this._horizon);
    this.skyMat.uniforms.uGround.value.copy(this._skyGround);
    this.fog.color.copy(this._fogCol);

    // Interior warm lights glow brighter after dusk
    const nightBoost = isDay ? 1.2 : 2.3;
    for (const l of this.arch.interiorWarmLights) {
      l.intensity = nightBoost;
    }
    for (const g of this.arch.streetGlows) {
      (g.material as THREE.SpriteMaterial).opacity = isDay ? 0.14 : 0.48;
    }
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTs) / 1000));
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

    // Dynamic Time-of-Day lighting & sky
    this.updateTimeOfDayLighting(this.sim.simMin);

    // Staff, lifts, traffic, tour & first-person walk
    this.sim.update(dt, this.elapsed, this.camera, this.controls);

    // Spatialized ambient office audio (HVAC hum, soft typing, distant chatter)
    this._camRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.audio.update(dt, this.camera.position, this._camRight, this.sim.getAmbientSources(), {
      walkOn: this.sim.walkOn,
      activeLevel: this.activeLevel,
      simRate: this.sim.simRate,
    });

    // Animated office screens & wall TVs (only draws screens inside camera frustum)
    updateAllScreens(this.screenReg, this.camera, this.elapsed);
    if (this.inspectedMonitor) {
      const s = this.inspectedMonitor.screenRef;
      if (this.elapsed >= s.next) {
        s.next = this.elapsed + 0.1;
        s.g.clearRect(0, 0, s.g.canvas.width, s.g.canvas.height);
        s.fn(s.g, s.g.canvas.width, s.g.canvas.height, this.elapsed + s.off);
        (s.tx as THREE.CanvasTexture).needsUpdate = true;
      }
    }

    this.renderer.render(this.scene, this.camera);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.1) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  };

  private buildInspectedMonitorHud(): InspectedMonitor | null {
    const m = this.inspectedMonitor;
    if (!m) return null;
    const ws = this.sim.getMonitorWorkerStatus(m.lv, m.seatX, m.seatZ);
    return {
      id: m.id,
      stationKey: m.stationKey,
      seatIndex: m.seatIndex,
      projectTitle: m.projectTitle,
      zone: m.zone,
      role: m.role,
      levelLabel: m.lv === 0 ? 'Ground (G)' : `Level ${m.lv}`,
      color: m.color,
      workerActivity: ws.workerActivity,
      screenTask: m.screenTask,
      isOccupied: ws.isOccupied,
    };
  }

  private emitHud() {
    const snap = this.sim.getSnapshot(
      this.activeLevel,
      this.hoveredRoom,
      this.audio.isEnabled(),
      this.buildInspectedMonitorHud()
    );
    const cut = this.getCutawayLevelIndex();
    if (cut !== null && cut >= 0 && snap.floorActivity && !this.sim.walkOn && !this.sim.tourOn) {
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

  public selectLevel(key: string) {
    if (this.sim.walkOn) this.sim.exitWalk(this.camera, this.controls);
    if (this.sim.tourOn) this.sim.endTour();
    this.inspectedMonitor = null;
    this.activeLevel = key;

    const isBasement = key === 'b1' || key === 'b2';
    this.arch.basementGroup.visible = isBasement;
    this.arch.plazaGroup.visible = !isBasement;

    if (key === 'overview') {
      this.sim.flyTo(new THREE.Vector3(0, 16, 49), new THREE.Vector3(0, 12.2, 4));
    } else if (VIEWS[key]) {
      const v = VIEWS[key];
      this.sim.flyTo(new THREE.Vector3(...v.p), new THREE.Vector3(...v.t));
    }
    this.emitHud();
  }

  public startTour(index = 0) {
    this.inspectedMonitor = null;
    this.arch.basementGroup.visible = false;
    this.arch.plazaGroup.visible = true;
    this.activeLevel = 'tour';
    this.sim.startTour(index, this.camera, this.controls);
    this.emitHud();
  }

  public endTour() {
    this.sim.endTour();
    this.activeLevel = 'overview';
    this.emitHud();
  }

  public prevStop() {
    this.sim.prevStop(this.camera, this.controls);
    this.emitHud();
  }

  public nextStop() {
    this.sim.nextStop(this.camera, this.controls);
    this.emitHud();
  }

  public toggleTourPlay() {
    this.sim.toggleTourPlay();
    this.emitHud();
  }

  public toggleWalk() {
    if (this.sim.walkOn) {
      this.sim.exitWalk(this.camera, this.controls);
      this.activeLevel = 'overview';
    } else {
      this.inspectedMonitor = null;
      this.arch.basementGroup.visible = false;
      this.arch.plazaGroup.visible = true;
      this.activeLevel = 'walk';
      this.sim.enterWalk(this.camera, this.controls);
    }
    this.emitHud();
  }

  public setWalkFloor(lv: number) {
    this.sim.setWalkFloor(lv);
    this.emitHud();
  }

  public setTouchJoystick(nx: number, ny: number) {
    this.sim.setTouchJoystick(nx, ny);
  }

  public toggleStaff() {
    this.sim.toggleStaff();
    this.emitHud();
  }

  public setRate(rate: number) {
    this.sim.setRate(rate);
    this.emitHud();
  }

  public jumpToTime(minutes: number) {
    this.sim.setClock(minutes);
    this.updateTimeOfDayLighting(this.sim.simMin);
    this.emitHud();
  }

  public toggleAudio() {
    this.audio.toggle();
    this.emitHud();
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointerdown', this.handleAudioUnlock);
    window.removeEventListener('keydown', this.handleAudioUnlock);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('click', this.handleClick);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.unwireWalk();
    this.sim.dispose();
    this.audio.dispose();
    for (const b of this.overheadBadges) {
      b.tex.dispose();
      (b.sprite.material as THREE.SpriteMaterial).dispose();
    }
    this.controls.dispose();

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
