import * as THREE from 'three';
import { ceilHeight, DEPTH, LV, ROOF, WIDTH, type WeatherCondition, type WeatherMode } from './constants';
import { createSeededRng } from './prng';

const weatherRng = createSeededRng(4099);

export interface WeatherAtmosphereState {
  activeWeather: WeatherCondition;
  label: string;
  timeFactor: number;
  cloudCover: number;
  fogDensity: number;
  sunMult: number;
  hemiMult: number;
  fillMult: number;
  skyMix: number;
  lightningFlash: number;
  wetness: number;
  rainAmount: number;
  snowAmount: number;
  skyTintZenith: THREE.Color;
  skyTintHorizon: THREE.Color;
  fogTint: THREE.Color;
}

const WEATHER_LABELS: Record<WeatherCondition, string> = {
  clear: 'Clear',
  overcast: 'Overcast',
  rain: 'Rain',
  storm: 'Thunderstorm',
  snow: 'Snow',
};

const WEATHER_TIME_FACTORS: Record<WeatherCondition, number> = {
  clear: 1.0,
  overcast: 0.95,
  rain: 0.85,
  storm: 0.7,
  snow: 0.8,
};

interface TargetProfile {
  cloudCover: number;
  fogDensity: number;
  sunMult: number;
  hemiMult: number;
  fillMult: number;
  skyMix: number;
  wetness: number;
  rain: number;
  snow: number;
  storm: number;
  zenith: number;
  horizon: number;
  fog: number;
}

const PROFILES: Record<WeatherCondition, TargetProfile> = {
  clear: {
    cloudCover: 0.08,
    fogDensity: 0.0021,
    sunMult: 1.0,
    hemiMult: 1.0,
    fillMult: 1.0,
    skyMix: 0.0,
    wetness: 0.0,
    rain: 0.0,
    snow: 0.0,
    storm: 0.0,
    zenith: 0x2d64a6,
    horizon: 0xc4dcf4,
    fog: 0x88a4c2,
  },
  overcast: {
    cloudCover: 0.76,
    fogDensity: 0.0046,
    sunMult: 0.42,
    hemiMult: 0.84,
    fillMult: 1.18,
    skyMix: 0.62,
    wetness: 0.2,
    rain: 0.0,
    snow: 0.0,
    storm: 0.0,
    zenith: 0x526273,
    horizon: 0x919fae,
    fog: 0x768594,
  },
  rain: {
    cloudCover: 0.9,
    fogDensity: 0.0066,
    sunMult: 0.26,
    hemiMult: 0.72,
    fillMult: 1.25,
    skyMix: 0.8,
    wetness: 0.92,
    rain: 0.85,
    snow: 0.0,
    storm: 0.0,
    zenith: 0x364759,
    horizon: 0x67798a,
    fog: 0x566879,
  },
  storm: {
    cloudCover: 0.98,
    fogDensity: 0.009,
    sunMult: 0.14,
    hemiMult: 0.56,
    fillMult: 1.05,
    skyMix: 0.92,
    wetness: 1.0,
    rain: 1.0,
    snow: 0.0,
    storm: 1.0,
    zenith: 0x1d2838,
    horizon: 0x414f61,
    fog: 0x354254,
  },
  snow: {
    cloudCover: 0.84,
    fogDensity: 0.0072,
    sunMult: 0.5,
    hemiMult: 1.06,
    fillMult: 1.35,
    skyMix: 0.76,
    wetness: 0.35,
    rain: 0.0,
    snow: 1.0,
    storm: 0.0,
    zenith: 0x70849c,
    horizon: 0xc2d0de,
    fog: 0xa6b6c7,
  },
};

export function resolveAutoWeather(simMinutes: number): WeatherCondition {
  const m = ((simMinutes % 1440) + 1440) % 1440;
  if (m < 270) return 'snow'; // 00:00 - 04:30 crisp night snowfall
  if (m < 390) return 'overcast'; // 04:30 - 06:30 dawn mist
  if (m < 750) return 'clear'; // 06:30 - 12:30 bright morning
  if (m < 885) return 'overcast'; // 12:30 - 14:45 midday clouds gathering
  if (m < 945) return 'rain'; // 14:45 - 15:45 afternoon rain
  if (m < 1005) return 'storm'; // 15:45 - 16:45 late-afternoon thunderstorm
  if (m < 1095) return 'rain'; // 16:45 - 18:15 tapering evening rain
  if (m < 1290) return 'clear'; // 18:15 - 21:30 clear evening lights
  return 'snow'; // 21:30 - 24:00 winter night snowfall
}

function seededRand(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export class WeatherSystem {
  private mode: WeatherMode = 'auto';
  private activeWeather: WeatherCondition = 'clear';
  private timeFactor = 1.0;

  private rainAmount = 0;
  private snowAmount = 0;
  private cloudCover = 0.08;
  private fogDensity = 0.0021;
  private sunMult = 1.0;
  private hemiMult = 1.0;
  private fillMult = 1.0;
  private skyMix = 0.0;
  private wetness = 0.0;
  private stormAmount = 0.0;
  private lightningTimer = 6.5;
  private lightningFlash = 0.0;

  private readonly _tgtZenith = new THREE.Color(0x2d64a6);
  private readonly _tgtHorizon = new THREE.Color(0xc4dcf4);
  private readonly _tgtFog = new THREE.Color(0x88a4c2);

  public readonly state: WeatherAtmosphereState = {
    activeWeather: 'clear',
    label: 'Clear',
    timeFactor: 1.0,
    cloudCover: 0.08,
    fogDensity: 0.0021,
    sunMult: 1.0,
    hemiMult: 1.0,
    fillMult: 1.0,
    skyMix: 0.0,
    lightningFlash: 0.0,
    wetness: 0.0,
    rainAmount: 0.0,
    snowAmount: 0.0,
    skyTintZenith: new THREE.Color(0x2d64a6),
    skyTintHorizon: new THREE.Color(0xc4dcf4),
    fogTint: new THREE.Color(0x88a4c2),
  };

  private readonly particleGroup = new THREE.Group();
  private readonly rainMat: THREE.ShaderMaterial;
  private readonly snowMat: THREE.ShaderMaterial;
  private readonly splashMat: THREE.ShaderMaterial;
  private readonly rainPoints: THREE.Points;
  private readonly snowPoints: THREE.Points;
  private readonly splashPoints: THREE.Points;

  private readonly windowMat: THREE.ShaderMaterial;
  private readonly windowOverlaysByLevel: THREE.Group[] = [];
  private maxRainCount = 3000;
  private maxSnowCount = 2400;
  private maxSplashCount = 420;
  private particlesEnabled = true;
  private windowOverlayEnabled = true;
  private reducedMotion = false;

  constructor(scene: THREE.Scene, levelGroups: THREE.Group[]) {
    scene.add(this.particleGroup);

    // 1. Exterior + Office-Window Rain Particle Curtain (GPU animated, zero per-frame JS allocations)
    const rainCount = 3000;
    const rainPos = new Float32Array(rainCount * 3);
    const rainSeed = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      const i3 = i * 3;
      const isWindowCurtain = i < 1100;
      if (isWindowCurtain) {
        // Dense curtain skimming DomainTechHub's front & side office windows
        rainPos[i3] = (seededRand(i * 3 + 1) - 0.5) * (WIDTH + 6);
        rainPos[i3 + 1] = seededRand(i * 3 + 2) * (ROOF + 4);
        rainPos[i3 + 2] = 8.4 + seededRand(i * 3 + 3) * 5.2;
      } else {
        // Campus-wide rainfall covering courtyard, road, plaza & neighboring buildings
        rainPos[i3] = (seededRand(i * 3 + 1) - 0.5) * 165;
        rainPos[i3 + 1] = seededRand(i * 3 + 2) * 44;
        rainPos[i3 + 2] = -28 + seededRand(i * 3 + 3) * 136;
      }
      rainSeed[i3] = seededRand(i * 7 + 11);
      rainSeed[i3 + 1] = 0.8 + seededRand(i * 7 + 13) * 0.45;
      rainSeed[i3 + 2] = isWindowCurtain ? 0.9 + seededRand(i * 7 + 17) * 0.5 : 0.75 + seededRand(i * 7 + 17) * 0.6;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    rainGeo.setAttribute('aSeed', new THREE.BufferAttribute(rainSeed, 3));

    this.rainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAlpha: { value: 0 },
        uSpeed: { value: 0.85 },
        uWindX: { value: -1.4 },
        uWindZ: { value: 0.5 },
        uClipMaxY: { value: 60 },
        uPixelScale: { value: 360 },
      },
      vertexShader: `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uSpeed;
        uniform float uWindX;
        uniform float uWindZ;
        uniform float uClipMaxY;
        uniform float uPixelScale;
        varying float vAlpha;
        void main() {
          float spanY = 44.0;
          float t = fract(uTime * uSpeed * aSeed.y + aSeed.x);
          vec3 p = position;
          p.y = spanY * (1.0 - t);
          p.x += uWindX * t * 3.8;
          p.z += uWindZ * t * 1.8;
          float inBounds = step(p.y, uClipMaxY);
          vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPos;
          float dist = max(2.0, -mvPos.z);
          gl_PointSize = inBounds * clamp((aSeed.z * uPixelScale) / dist, 5.0, 34.0);
          vAlpha = inBounds * smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.9, t);
        }
      `,
      fragmentShader: `
        uniform float uAlpha;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          // Crisp tilted rain streak inside sprite quad
          float slant = uv.x + uv.y * 0.16;
          float streak = smoothstep(0.11, 0.015, abs(slant)) * smoothstep(0.5, 0.04, abs(uv.y));
          float a = streak * uAlpha * vAlpha * 0.74;
          if (a < 0.01) discard;
          gl_FragColor = vec4(0.80, 0.90, 1.0, a);
        }
      `,
    });
    this.rainPoints = new THREE.Points(rainGeo, this.rainMat);
    this.rainPoints.frustumCulled = false;
    this.rainPoints.renderOrder = 14;
    this.rainPoints.visible = false;
    this.particleGroup.add(this.rainPoints);

    // 2. Exterior + Office-Window Snow Particle System
    const snowCount = 2400;
    const snowPos = new Float32Array(snowCount * 3);
    const snowSeed = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      const i3 = i * 3;
      const isWindowCurtain = i < 950;
      if (isWindowCurtain) {
        snowPos[i3] = (seededRand(i * 5 + 3) - 0.5) * (WIDTH + 6);
        snowPos[i3 + 1] = seededRand(i * 5 + 4) * (ROOF + 4);
        snowPos[i3 + 2] = 8.2 + seededRand(i * 5 + 5) * 5.8;
      } else {
        snowPos[i3] = (seededRand(i * 5 + 3) - 0.5) * 165;
        snowPos[i3 + 1] = seededRand(i * 5 + 4) * 44;
        snowPos[i3 + 2] = -28 + seededRand(i * 5 + 5) * 136;
      }
      snowSeed[i3] = seededRand(i * 11 + 2);
      snowSeed[i3 + 1] = 0.65 + seededRand(i * 11 + 5) * 0.65;
      snowSeed[i3 + 2] = isWindowCurtain ? 0.95 + seededRand(i * 11 + 9) * 0.55 : 0.75 + seededRand(i * 11 + 9) * 0.6;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(snowSeed, 3));

    this.snowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAlpha: { value: 0 },
        uClipMaxY: { value: 60 },
        uPixelScale: { value: 300 },
      },
      vertexShader: `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uClipMaxY;
        uniform float uPixelScale;
        varying float vAlpha;
        void main() {
          float spanY = 44.0;
          float t = fract(uTime * 0.11 * aSeed.y + aSeed.x);
          vec3 p = position;
          p.y = spanY * (1.0 - t);
          float phase = aSeed.x * 62.83 + uTime * 1.15 * aSeed.y;
          p.x += sin(phase + p.y * 0.22) * 1.15 - t * 2.2;
          p.z += cos(phase * 0.85 + p.x * 0.15) * 0.75;
          float inBounds = step(p.y, uClipMaxY);
          vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPos;
          float dist = max(2.0, -mvPos.z);
          gl_PointSize = inBounds * clamp((aSeed.z * uPixelScale) / dist, 4.0, 22.0);
          vAlpha = inBounds * smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.88, t);
        }
      `,
      fragmentShader: `
        uniform float uAlpha;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float flake = smoothstep(0.49, 0.08, d);
          float a = flake * uAlpha * vAlpha * 0.92;
          if (a < 0.01) discard;
          gl_FragColor = vec4(0.96, 0.98, 1.0, a);
        }
      `,
    });
    this.snowPoints = new THREE.Points(snowGeo, this.snowMat);
    this.snowPoints.frustumCulled = false;
    this.snowPoints.renderOrder = 15;
    this.snowPoints.visible = false;
    this.particleGroup.add(this.snowPoints);

    // 3. Window Sill & Plaza Ground Rain Splash Particles
    const splashCount = 420;
    const splashPos = new Float32Array(splashCount * 3);
    const splashSeed = new Float32Array(splashCount * 3);
    for (let i = 0; i < splashCount; i++) {
      const i3 = i * 3;
      if (i < 240) {
        // Balcony & window-sill splashes across L1..L5 & Roof
        const lvIdx = 1 + (i % 5);
        splashPos[i3] = (seededRand(i * 9 + 1) - 0.5) * (WIDTH - 2);
        splashPos[i3 + 1] = LV[lvIdx] + 0.12;
        splashPos[i3 + 2] = 9.9 + seededRand(i * 9 + 2) * 1.2;
      } else {
        // Forecourt plaza & street ground splashes
        splashPos[i3] = (seededRand(i * 9 + 1) - 0.5) * 90;
        splashPos[i3 + 1] = 0.06;
        splashPos[i3 + 2] = 12 + seededRand(i * 9 + 2) * 62;
      }
      splashSeed[i3] = seededRand(i * 13 + 3);
      splashSeed[i3 + 1] = 1.4 + seededRand(i * 13 + 7) * 1.1;
      splashSeed[i3 + 2] = 0.8 + seededRand(i * 13 + 11) * 0.6;
    }
    const splashGeo = new THREE.BufferGeometry();
    splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPos, 3));
    splashGeo.setAttribute('aSeed', new THREE.BufferAttribute(splashSeed, 3));

    this.splashMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uAlpha: { value: 0 },
        uClipMaxY: { value: 60 },
      },
      vertexShader: `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uClipMaxY;
        varying float vLife;
        void main() {
          float life = fract(uTime * aSeed.y + aSeed.x);
          vec3 p = position;
          p.y += sin(life * 3.14159) * 0.24 * aSeed.z;
          float inBounds = step(p.y, uClipMaxY);
          vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPos;
          float dist = max(2.0, -mvPos.z);
          gl_PointSize = inBounds * clamp((115.0 * aSeed.z) / dist, 2.5, 11.0);
          vLife = inBounds * sin(life * 3.14159);
        }
      `,
      fragmentShader: `
        uniform float uAlpha;
        varying float vLife;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float ring = smoothstep(0.5, 0.25, d) * smoothstep(0.04, 0.24, d);
          float a = ring * uAlpha * vLife * 0.55;
          if (a < 0.01) discard;
          gl_FragColor = vec4(0.84, 0.92, 1.0, a);
        }
      `,
    });
    this.splashPoints = new THREE.Points(splashGeo, this.splashMat);
    this.splashPoints.frustumCulled = false;
    this.splashPoints.renderOrder = 14;
    this.splashPoints.visible = false;
    this.particleGroup.add(this.splashPoints);

    // 4. Office Window Glass Weather Overlay Shader (Raindrop rivulets + Frost on glass panes per floor)
    this.windowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      uniforms: {
        uTime: { value: 0 },
        uRain: { value: 0 },
        uSnow: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uRain;
        uniform float uSnow;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        void main() {
          float a = 0.0;
          vec3 col = vec3(0.82, 0.91, 0.99);

          if (uRain > 0.01) {
            // World-scale droplet grid so streaks glide downward naturally at consistent physical size
            vec2 st = vec2(vWorldPos.x + vWorldPos.z * 0.7, vWorldPos.y) * vec2(3.6, 1.15);
            vec2 id = floor(st);
            float colRand = hash21(vec2(id.x, 17.3));
            float t = uTime * (0.65 + colRand * 0.55) + colRand * 19.0;
            vec2 gv = fract(vec2(st.x, st.y + t)) - 0.5;
            float dropX = sin(st.y * 4.0 + colRand * 12.0) * 0.14;
            float dHead = length(vec2((gv.x - dropX) * 1.8, gv.y + 0.15));
            float drop = smoothstep(0.18, 0.04, dHead);
            float trail = smoothstep(0.08, 0.01, abs(gv.x - dropX)) * smoothstep(-0.18, 0.48, gv.y) * smoothstep(0.5, 0.15, gv.y);
            // Fine micro-beads across the pane
            vec2 ms = vec2(vWorldPos.x + vWorldPos.z, vWorldPos.y) * 14.0;
            vec2 mid = floor(ms);
            float mr = hash21(mid);
            float micro = step(0.72, mr) * smoothstep(0.28, 0.08, length(fract(ms) - 0.5));
            float rainPattern = clamp(drop * 0.95 + trail * 0.62 + micro * 0.36, 0.0, 1.0);
            a += rainPattern * uRain * 0.54;
            col = mix(col, vec3(0.92, 0.97, 1.0), drop);
          }

          if (uSnow > 0.01) {
            // Soft winter frost border along window perimeter + clinging ice crystals
            float bayMod = abs(fract(vWorldPos.x * 0.1) - 0.5) * 2.0;
            float mullionFrost = smoothstep(0.84, 1.0, bayMod);
            float edge = max(
              smoothstep(0.24, 0.0, vUv.y),
              smoothstep(0.76, 1.0, vUv.y)
            );
            float sideEdge = max(smoothstep(0.06, 0.0, vUv.x), smoothstep(0.94, 1.0, vUv.x));
            float frostMask = clamp(edge * 0.8 + sideEdge * 0.55 + mullionFrost * 0.42, 0.0, 1.0);
            vec2 cs = vec2(vWorldPos.x + vWorldPos.z, vWorldPos.y) * 7.5;
            float cr = hash21(floor(cs));
            float crystal = step(0.68, cr) * smoothstep(0.32, 0.05, length(fract(cs) - 0.5));
            float snowPattern = clamp(frostMask * 0.55 + crystal * 0.52, 0.0, 1.0);
            a += snowPattern * uSnow * 0.48;
            col = mix(col, vec3(0.95, 0.98, 1.0), 0.78);
          }

          if (a < 0.01) discard;
          gl_FragColor = vec4(col, clamp(a, 0.0, 0.68));
        }
      `,
    });

    // Attach glass weather overlays into each floor's cutaway levelGroup so they move/peel cleanly
    for (let s = 0; s < levelGroups.length; s++) {
      const grp = new THREE.Group();
      grp.visible = false;
      levelGroups[s].add(grp);
      this.windowOverlaysByLevel.push(grp);

      const y0 = LV[s];
      const ch = ceilHeight(s);
      // Full-height office front glazing weather layer (leaves crisp interior clear between rivulets/frost)
      const facadeGlass = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH - 1.2, ch - 0.16), this.windowMat);
      facadeGlass.position.set(0, y0 + ch / 2, DEPTH + 0.03);
      facadeGlass.renderOrder = 6;
      grp.add(facadeGlass);

      const westGlass = new THREE.Mesh(new THREE.PlaneGeometry(7.3, ch - 0.2), this.windowMat);
      westGlass.position.set(-25.0, y0 + ch / 2, 8.59);
      westGlass.renderOrder = 6;
      grp.add(westGlass);

      // Side curtain wall windows (East & West returns)
      [-1, 1].forEach((sd) => {
        const sidePane = new THREE.Mesh(new THREE.PlaneGeometry(0.54, ch - 0.4), this.windowMat);
        sidePane.position.set(sd * (WIDTH / 2 + 0.02), y0 + ch / 2, DEPTH - 0.4);
        sidePane.rotation.y = sd * (Math.PI / 2);
        sidePane.renderOrder = 6;
        grp.add(sidePane);
      });
    }
  }

  public getMode(): WeatherMode {
    return this.mode;
  }

  public setMode(mode: WeatherMode) {
    this.mode = mode;
  }

  public applyTierConfig(opts: {
    rainCount: number;
    snowCount: number;
    splashCount: number;
    enableWindowOverlay: boolean;
    reducedMotion: boolean;
  }) {
    this.maxRainCount = Math.max(0, Math.min(3000, opts.rainCount));
    this.maxSnowCount = Math.max(0, Math.min(2400, opts.snowCount));
    this.maxSplashCount = Math.max(0, Math.min(420, opts.splashCount));
    this.windowOverlayEnabled = opts.enableWindowOverlay;
    this.reducedMotion = opts.reducedMotion;
    this.particlesEnabled =
      !opts.reducedMotion &&
      (this.maxRainCount > 0 || this.maxSnowCount > 0 || this.maxSplashCount > 0);
    this.rainPoints.geometry.setDrawRange(0, this.reducedMotion ? 0 : this.maxRainCount);
    this.snowPoints.geometry.setDrawRange(0, this.reducedMotion ? 0 : this.maxSnowCount);
    this.splashPoints.geometry.setDrawRange(0, this.reducedMotion ? 0 : this.maxSplashCount);
  }

  public getTimeMultiplier(): number {
    return this.timeFactor;
  }

  public update(
    dt: number,
    elapsed: number,
    simMinutes: number,
    activeLevel: string,
    roofVisible: boolean
  ): WeatherAtmosphereState {
    const resolved: WeatherCondition = this.mode === 'auto' ? resolveAutoWeather(simMinutes) : this.mode;
    this.activeWeather = resolved;
    const p = PROFILES[resolved];

    const dampK = 3.4;
    this.cloudCover = THREE.MathUtils.damp(this.cloudCover, p.cloudCover, dampK, dt);
    this.fogDensity = THREE.MathUtils.damp(this.fogDensity, p.fogDensity, dampK, dt);
    this.sunMult = THREE.MathUtils.damp(this.sunMult, p.sunMult, dampK, dt);
    this.hemiMult = THREE.MathUtils.damp(this.hemiMult, p.hemiMult, dampK, dt);
    this.fillMult = THREE.MathUtils.damp(this.fillMult, p.fillMult, dampK, dt);
    this.skyMix = THREE.MathUtils.damp(this.skyMix, p.skyMix, dampK, dt);
    this.wetness = THREE.MathUtils.damp(this.wetness, p.wetness, 2.4, dt);
    this.rainAmount = THREE.MathUtils.damp(this.rainAmount, p.rain, 3.6, dt);
    this.snowAmount = THREE.MathUtils.damp(this.snowAmount, p.snow, 3.0, dt);
    this.stormAmount = THREE.MathUtils.damp(this.stormAmount, p.storm, 3.2, dt);
    this.timeFactor = THREE.MathUtils.damp(this.timeFactor, WEATHER_TIME_FACTORS[resolved], 3.8, dt);

    this._tgtZenith.setHex(p.zenith);
    this._tgtHorizon.setHex(p.horizon);
    this._tgtFog.setHex(p.fog);
    const colLerp = 1 - Math.exp(-dt * dampK);
    this.state.skyTintZenith.lerp(this._tgtZenith, colLerp);
    this.state.skyTintHorizon.lerp(this._tgtHorizon, colLerp);
    this.state.fogTint.lerp(this._tgtFog, colLerp);

    // Occasional distant sheet lightning during thunderstorms (seeded deterministic)
    if (this.stormAmount > 0.35 && !this.reducedMotion) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningFlash = 0.85 + weatherRng() * 0.15;
        this.lightningTimer = 7.5 + weatherRng() * 9.0;
      }
    }
    this.lightningFlash = this.reducedMotion ? 0 : Math.max(0, this.lightningFlash - dt * 4.5);

    // Hide exterior precipitation when viewing underground B1/B2 basement cutaways
    const isBasement = activeLevel === 'b1' || activeLevel === 'b2';
    let clipMaxY = 60;
    if (!isBasement && /^\d+$/.test(activeLevel)) {
      const lv = Number(activeLevel);
      if (Number.isInteger(lv) && lv >= 0 && lv < LV.length && !roofVisible) {
        clipMaxY = LV[lv] + ceilHeight(lv) + 0.5;
      }
    }

    // Update GPU rain, snow, splash & office glass overlay uniforms
    this.particleGroup.visible = !isBasement && this.particlesEnabled;
    this.rainPoints.visible = !isBasement && this.particlesEnabled && this.maxRainCount > 0 && this.rainAmount > 0.015;
    if (this.rainPoints.visible) {
      this.rainMat.uniforms.uTime.value = elapsed;
      this.rainMat.uniforms.uAlpha.value = this.rainAmount;
      this.rainMat.uniforms.uSpeed.value = 0.82 + this.stormAmount * 0.32;
      this.rainMat.uniforms.uWindX.value = -1.2 - this.stormAmount * 2.2;
      this.rainMat.uniforms.uClipMaxY.value = clipMaxY;
    }

    this.splashPoints.visible = !isBasement && this.particlesEnabled && this.maxSplashCount > 0 && this.rainAmount > 0.04;
    if (this.splashPoints.visible) {
      this.splashMat.uniforms.uTime.value = elapsed;
      this.splashMat.uniforms.uAlpha.value = this.rainAmount;
      this.splashMat.uniforms.uClipMaxY.value = clipMaxY;
    }

    this.snowPoints.visible = !isBasement && this.particlesEnabled && this.maxSnowCount > 0 && this.snowAmount > 0.015;
    if (this.snowPoints.visible) {
      this.snowMat.uniforms.uTime.value = elapsed;
      this.snowMat.uniforms.uAlpha.value = this.snowAmount;
      this.snowMat.uniforms.uClipMaxY.value = clipMaxY;
    }

    const showWindowWeather =
      !isBasement &&
      this.windowOverlayEnabled &&
      (this.rainAmount > 0.015 || this.snowAmount > 0.015);
    this.windowMat.uniforms.uTime.value = this.reducedMotion ? 0 : elapsed;
    this.windowMat.uniforms.uRain.value = this.rainAmount;
    this.windowMat.uniforms.uSnow.value = this.snowAmount;
    for (let i = 0; i < this.windowOverlaysByLevel.length; i++) {
      this.windowOverlaysByLevel[i].visible = showWindowWeather;
    }

    this.state.activeWeather = resolved;
    this.state.label = WEATHER_LABELS[resolved];
    this.state.timeFactor = Number(this.timeFactor.toFixed(2));
    this.state.cloudCover = this.cloudCover;
    this.state.fogDensity = this.fogDensity;
    this.state.sunMult = this.sunMult;
    this.state.hemiMult = this.hemiMult;
    this.state.fillMult = this.fillMult;
    this.state.skyMix = this.skyMix;
    this.state.lightningFlash = this.lightningFlash;
    this.state.wetness = this.wetness;
    this.state.rainAmount = this.rainAmount;
    this.state.snowAmount = this.snowAmount;

    return this.state;
  }

  public dispose() {
    this.rainPoints.geometry.dispose();
    this.rainMat.dispose();
    this.snowPoints.geometry.dispose();
    this.snowMat.dispose();
    this.splashPoints.geometry.dispose();
    this.splashMat.dispose();
    this.windowMat.dispose();
    for (const g of this.windowOverlaysByLevel) {
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    }
  }
}
