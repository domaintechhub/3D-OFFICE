import * as THREE from 'three';

export type QualityMode = 'auto' | 'eco' | 'low' | 'med' | 'high';
export type QualityTier = 'eco' | 'low' | 'med' | 'high';

export const VISUAL_CONTRACT = {
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.04,
  outputColorSpace: THREE.SRGBColorSpace,
  maxRealtimeLights: 2, // 1 HemisphereLight + 1 DirectionalLight (sun)
  minTextTextureWidth: 1024,
  textTextureDpr: 2,
  minTextAnisotropy: 4,
} as const;

export interface TierConfig {
  tier: QualityTier;
  label: string;
  pixelRatioMin: number;
  pixelRatioMax: number;
  shadowMapSize: number;
  shadowsEnabled: boolean;
  shadowUpdateInterval: number; // frames between shadow map updates if > 1
  antialias: boolean;
  nonTextTexScale: number; // only scales non-text procedural textures
  rainCount: number;
  snowCount: number;
  splashCount: number;
  particlesEnabled: boolean;
  windowDropletShader: boolean;
  frameCapFps: number;
  animUpdateHz: number;
  roomCullDist: number;
  actorCullDist: number;
}

export interface BrowserCapabilities {
  webgl2: boolean;
  webgl1: boolean;
  webglAvailable: boolean;
  offscreenCanvas: boolean;
  createImageBitmap: boolean;
  workers: boolean;
  isMobile: boolean;
  isCoarsePointer: boolean;
  hardwareConcurrency: number;
  deviceMemoryGb: number | null;
  isLowEndDevice: boolean;
  fullscreenSupported: boolean;
}

export interface PerfTelemetry {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  jsHeapMb: number | null;
  mode: QualityMode;
  tier: QualityTier;
  pixelRatio: number;
  paused: boolean;
  pauseReason: string | null;
  benchmarking: boolean;
}

const STORAGE_KEY = 'dth_office_quality_mode_v1';
let inMemoryQualityMode: QualityMode = 'auto';

export function readStoredQualityMode(): QualityMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === 'auto' || raw === 'eco' || raw === 'low' || raw === 'med' || raw === 'high') {
        inMemoryQualityMode = raw;
        return raw;
      }
    }
  } catch {
    // localStorage may be blocked under file:// or strict sandboxed origins; fall back to memory
  }
  return inMemoryQualityMode;
}

export function writeStoredQualityMode(mode: QualityMode): void {
  inMemoryQualityMode = mode;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  } catch {
    // Fallback remains in memory
  }
}

export function probeBrowserCapabilities(): BrowserCapabilities {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const win = typeof window !== 'undefined' ? window : undefined;
  const doc = typeof document !== 'undefined' ? document : undefined;

  let webgl2 = false;
  let webgl1 = false;
  if (doc) {
    try {
      const c = doc.createElement('canvas');
      webgl2 = Boolean(c.getContext('webgl2'));
      webgl1 = webgl2 || Boolean(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch {
      webgl2 = false;
      webgl1 = false;
    }
  }

  const ua = nav?.userAgent || '';
  const isTouchDevice =
    Boolean(win && ('ontouchstart' in win || (nav?.maxTouchPoints ?? 0) > 0));
  const isCoarsePointer = Boolean(
    win?.matchMedia?.('(pointer: coarse)')?.matches ||
    win?.matchMedia?.('(any-pointer: coarse)')?.matches
  );
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const smallViewport = Boolean(win && Math.min(win.innerWidth || 1280, win.innerHeight || 720) <= 900);
  const isMobile = isMobileUa || (isCoarsePointer && smallViewport) || (isTouchDevice && smallViewport);

  const hc = typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : 4;
  const dm = typeof (nav as { deviceMemory?: number } | undefined)?.deviceMemory === 'number'
    ? ((nav as { deviceMemory?: number }).deviceMemory ?? null)
    : null;

  const isLowEndDevice = isMobile || hc <= 4 || (dm !== null && dm <= 4);

  const fullscreenSupported = Boolean(
    doc &&
      (doc.fullscreenEnabled ||
        (doc as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled)
  );

  return {
    webgl2,
    webgl1,
    webglAvailable: webgl2 || webgl1,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    createImageBitmap: typeof createImageBitmap === 'function',
    workers: typeof Worker === 'function',
    isMobile,
    isCoarsePointer: isCoarsePointer || isMobile,
    hardwareConcurrency: hc,
    deviceMemoryGb: dm,
    isLowEndDevice,
    fullscreenSupported,
  };
}

export function getTierConfig(tier: QualityTier, caps: BrowserCapabilities): TierConfig {
  const mobileCap = caps.isMobile ? 30 : 60;
  switch (tier) {
    case 'eco':
      return {
        tier: 'eco',
        label: 'Eco',
        pixelRatioMin: 0.75,
        pixelRatioMax: 0.9,
        shadowMapSize: 512,
        shadowsEnabled: true,
        shadowUpdateInterval: 4,
        antialias: false,
        nonTextTexScale: 0.5,
        rainCount: 0,
        snowCount: 0,
        splashCount: 0,
        particlesEnabled: false,
        windowDropletShader: false,
        frameCapFps: 30,
        animUpdateHz: 30,
        roomCullDist: 44,
        actorCullDist: 28,
      };
    case 'low':
      return {
        tier: 'low',
        label: 'Low',
        pixelRatioMin: 0.75,
        pixelRatioMax: 1.0,
        shadowMapSize: 1024,
        shadowsEnabled: true,
        shadowUpdateInterval: 2,
        antialias: false,
        nonTextTexScale: 0.75,
        rainCount: 220, // < 300 on low tier
        snowCount: 200, // < 300 on low tier
        splashCount: 80, // < 300 on low tier
        particlesEnabled: true,
        windowDropletShader: false,
        frameCapFps: mobileCap,
        animUpdateHz: caps.isMobile ? 30 : 60,
        roomCullDist: 62,
        actorCullDist: 42,
      };
    case 'med':
      return {
        tier: 'med',
        label: 'Medium',
        pixelRatioMin: 0.9,
        pixelRatioMax: caps.isMobile ? 1.25 : 1.5,
        shadowMapSize: 1536,
        shadowsEnabled: true,
        shadowUpdateInterval: 1,
        antialias: !caps.isMobile,
        nonTextTexScale: 1.0,
        rainCount: 720,
        snowCount: 600,
        splashCount: 180,
        particlesEnabled: true,
        windowDropletShader: true,
        frameCapFps: mobileCap,
        animUpdateHz: caps.isMobile ? 30 : 60,
        roomCullDist: 88,
        actorCullDist: 68,
      };
    case 'high':
      return {
        tier: 'high',
        label: 'High',
        pixelRatioMin: 1.0,
        pixelRatioMax: caps.isMobile ? 1.5 : 2.0,
        shadowMapSize: 2048,
        shadowsEnabled: true,
        shadowUpdateInterval: 1,
        antialias: true,
        nonTextTexScale: 1.0,
        rainCount: 1400,
        snowCount: 1200,
        splashCount: 280,
        particlesEnabled: true,
        windowDropletShader: true,
        frameCapFps: mobileCap,
        animUpdateHz: caps.isMobile ? 30 : 60,
        roomCullDist: 145,
        actorCullDist: 120,
      };
  }
}

export function isReducedMotionPreferred(): boolean {
  try {
    return Boolean(
      typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    );
  } catch {
    return false;
  }
}

export function subscribeReducedMotion(cb: (reduced: boolean) => void): () => void {
  try {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return () => {};
    const handler = () => cb(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  } catch {
    return () => {};
  }
}

const TIER_ORDER: QualityTier[] = ['eco', 'low', 'med', 'high'];

export class AdaptiveQualityController {
  public mode: QualityMode;
  public currentTier: QualityTier;
  public pixelRatioScale = 1.0;
  public benchmarking = true;

  private readonly caps: BrowserCapabilities;
  private benchElapsed = 0;
  private benchFrames = 0;
  private rollingFrameMs: number[] = [];
  private highFpsHoldSeconds = 0;
  private cooldownSeconds = 0;

  constructor(caps: BrowserCapabilities, initialMode?: QualityMode) {
    this.caps = caps;
    this.mode = initialMode ?? readStoredQualityMode();
    if (this.mode === 'auto') {
      // Safe initial tier before 1s startup benchmark completes
      this.currentTier = caps.isMobile ? 'low' : caps.isLowEndDevice ? 'med' : 'high';
      this.benchmarking = true;
    } else {
      this.currentTier = this.mode;
      this.benchmarking = false;
    }
  }

  public setMode(mode: QualityMode): { tierChanged: boolean; tier: QualityTier } {
    this.mode = mode;
    writeStoredQualityMode(mode);
    const prev = this.currentTier;
    this.rollingFrameMs.length = 0;
    this.highFpsHoldSeconds = 0;
    this.cooldownSeconds = 2.0;
    if (mode === 'auto') {
      this.benchmarking = true;
      this.benchElapsed = 0;
      this.benchFrames = 0;
    } else {
      this.benchmarking = false;
      this.currentTier = mode;
      this.pixelRatioScale = 1.0;
    }
    return { tierChanged: prev !== this.currentTier, tier: this.currentTier };
  }

  /**
   * Called once per rendered active frame with frame delta in seconds.
   * Returns true if active quality tier or pixel ratio scale changed.
   */
  public recordFrame(dtSec: number, isSoftwareGl: boolean): boolean {
    if (dtSec <= 0 || dtSec > 0.5) return false;
    const ms = dtSec * 1000;
    this.rollingFrameMs.push(ms);
    if (this.rollingFrameMs.length > 60) {
      this.rollingFrameMs.shift();
    }

    if (this.mode !== 'auto') return false;

    if (this.cooldownSeconds > 0) {
      this.cooldownSeconds = Math.max(0, this.cooldownSeconds - dtSec);
    }

    // 1) Initial ~1 second startup benchmark
    if (this.benchmarking) {
      this.benchElapsed += dtSec;
      this.benchFrames += 1;
      if (this.benchElapsed >= 1.05 && this.benchFrames >= 12) {
        this.benchmarking = false;
        const avgFps = this.benchFrames / this.benchElapsed;
        const prev = this.currentTier;
        if (isSoftwareGl || avgFps < 26) {
          this.currentTier = 'eco';
        } else if (avgFps < 40) {
          this.currentTier = 'low';
        } else if (avgFps < 54) {
          this.currentTier = 'med';
        } else {
          this.currentTier = this.caps.isMobile ? 'med' : 'high';
        }
        this.cooldownSeconds = 3.0;
        return prev !== this.currentTier;
      }
      return false;
    }

    if (this.rollingFrameMs.length < 45 || this.cooldownSeconds > 0) return false;

    const avgMs =
      this.rollingFrameMs.reduce((acc, v) => acc + v, 0) / this.rollingFrameMs.length;
    const avgFps = avgMs > 0 ? 1000 / avgMs : 60;

    const idx = TIER_ORDER.indexOf(this.currentTier);
    // Step down if below 40 FPS
    if (avgFps < 40) {
      this.highFpsHoldSeconds = 0;
      if (this.pixelRatioScale > 0.8 && idx > 0) {
        // Step down tier cleanly
        this.currentTier = TIER_ORDER[idx - 1];
        this.pixelRatioScale = 0.9;
        this.cooldownSeconds = 4.0;
        this.rollingFrameMs.length = 0;
        return true;
      } else if (idx > 0) {
        this.currentTier = TIER_ORDER[idx - 1];
        this.cooldownSeconds = 4.0;
        this.rollingFrameMs.length = 0;
        return true;
      } else if (this.pixelRatioScale > 0.75) {
        this.pixelRatioScale = 0.75;
        this.cooldownSeconds = 4.0;
        return true;
      }
      return false;
    }

    // Step up if above 58 FPS continuously for 10s (and not capped at 30 FPS)
    const cfg = getTierConfig(this.currentTier, this.caps);
    if (cfg.frameCapFps >= 55 && avgFps > 58 && idx < TIER_ORDER.length - 1) {
      this.highFpsHoldSeconds += dtSec;
      if (this.highFpsHoldSeconds >= 10.0) {
        this.highFpsHoldSeconds = 0;
        this.currentTier = TIER_ORDER[idx + 1];
        this.pixelRatioScale = 1.0;
        this.cooldownSeconds = 5.0;
        this.rollingFrameMs.length = 0;
        return true;
      }
    } else {
      this.highFpsHoldSeconds = Math.max(0, this.highFpsHoldSeconds - dtSec * 0.5);
    }

    return false;
  }

  public getRollingFps(): number {
    if (this.rollingFrameMs.length === 0) return 60;
    const avgMs =
      this.rollingFrameMs.reduce((acc, v) => acc + v, 0) / this.rollingFrameMs.length;
    return avgMs > 0 ? Math.min(240, Math.round(1000 / avgMs)) : 60;
  }

  public getRollingFrameMs(): number {
    if (this.rollingFrameMs.length === 0) return 16.6;
    const avgMs =
      this.rollingFrameMs.reduce((acc, v) => acc + v, 0) / this.rollingFrameMs.length;
    return Math.round(avgMs * 10) / 10;
  }

  public computeEffectivePixelRatio(cfg: TierConfig): number {
    const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const target = rawDpr * this.pixelRatioScale;
    return Math.max(0.75, Math.min(cfg.pixelRatioMax, Math.max(cfg.pixelRatioMin, target)));
  }
}
