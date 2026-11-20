import * as THREE from 'three';

export interface AmbientSource {
  x: number;
  y: number;
  z: number;
  /** 0..1 overall staff activity in this zone (0 when empty/off-shift) */
  activity: number;
  /** 0..1 relative keyboard typing density */
  typingWeight: number;
  /** 0..1 relative soft conversation/chatter density */
  chatterWeight: number;
  /** 0..1 relative mechanical/HVAC/server hum boost */
  hvacWeight: number;
}

export class AmbientAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // HVAC / building hum bus
  private hvacGain: GainNode | null = null;

  // Distant office chatter bus
  private chatterGain: GainNode | null = null;
  private chatterPanner: StereoPannerNode | null = null;

  private enabled = true;
  private unlocked = false;
  private disposed = false;

  // Zero-GC scratch vectors
  private readonly _toSrc = new THREE.Vector3();

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isUnlocked(): boolean {
    return this.unlocked && this.ctx?.state === 'running';
  }

  public setEnabled(next: boolean) {
    this.enabled = next;
    if (next) {
      this.unlock();
    }
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.enabled ? 1 : 0, now, 0.12);
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /**
   * Must be invoked from or after a user gesture for browser autoplay compliance.
   */
  public unlock() {
    if (this.disposed) return;
    if (!this.ctx) {
      this.initGraph();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx
        .resume()
        .then(() => {
          this.unlocked = this.ctx?.state === 'running';
        })
        .catch(() => {
          // Will retry on next user gesture
        });
    } else if (this.ctx && this.ctx.state === 'running') {
      this.unlocked = true;
    }
  }

  private initGraph() {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    try {
      const ctx = new AC();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.enabled ? 1 : 0;
      master.connect(ctx.destination);
      this.masterGain = master;

      this.buildHvacLayer(ctx, master);
      this.buildChatterLayer(ctx, master);

      this.unlocked = ctx.state === 'running';
    } catch {
      // Web Audio blocked or unavailable
    }
  }

  private createLoopingBrownNoise(ctx: AudioContext, seconds: number, warmth: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + warmth * white) / (1 + warmth);
      data[i] = last;
    }
    // Crossfade end into start for click-free looping
    const fadeSamples = Math.min(Math.floor(ctx.sampleRate * 0.15), Math.floor(len / 4));
    for (let i = 0; i < fadeSamples; i++) {
      const k = i / fadeSamples;
      const tailIdx = len - fadeSamples + i;
      data[i] = data[i] * k + data[tailIdx] * (1 - k);
    }
    // Normalize gently
    let max = 0.001;
    for (let i = 0; i < len; i++) {
      const a = Math.abs(data[i]);
      if (a > max) max = a;
    }
    const norm = 0.85 / max;
    for (let i = 0; i < len; i++) {
      data[i] *= norm;
    }
    return buf;
  }

  private buildHvacLayer(ctx: AudioContext, dest: AudioNode) {
    const hvacGain = ctx.createGain();
    hvacGain.gain.value = 0;
    hvacGain.connect(dest);
    this.hvacGain = hvacGain;

    // 1. Warm low-frequency air-handling duct rumble
    const noiseBuf = this.createLoopingBrownNoise(ctx, 4, 0.022);
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = noiseBuf;
    rumbleSrc.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 145;
    lp.Q.value = 0.75;

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.82;

    rumbleSrc.connect(lp);
    lp.connect(rumbleGain);
    rumbleGain.connect(hvacGain);
    rumbleSrc.start();

    // 2. Soft ceiling diffuser airflow hiss
    const airSrc = ctx.createBufferSource();
    airSrc.buffer = noiseBuf;
    airSrc.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 460;
    bp.Q.value = 0.65;

    const airGain = ctx.createGain();
    airGain.gain.value = 0.24;

    airSrc.connect(bp);
    bp.connect(airGain);
    airGain.connect(hvacGain);
    airSrc.start(ctx.currentTime, 1.3);

    // 3. Subtle 58 Hz + 116 Hz fan/transformer fundamental
    const hum58 = ctx.createOscillator();
    hum58.type = 'sine';
    hum58.frequency.value = 58;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.045;
    hum58.connect(humGain);
    humGain.connect(hvacGain);
    hum58.start();
  }

  private buildChatterLayer(ctx: AudioContext, dest: AudioNode) {
    const chatterGain = ctx.createGain();
    chatterGain.gain.value = 0;

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      chatterGain.connect(panner);
      panner.connect(dest);
      this.chatterPanner = panner;
    } else {
      chatterGain.connect(dest);
    }
    this.chatterGain = chatterGain;

    // Create modulated syllabic murmur buffer (two overlapping voices of unintelligible room talk)
    const seconds = 5;
    const len = Math.floor(ctx.sampleRate * seconds);
    const murmurBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = murmurBuf.getChannelData(0);
    let last = 0;
    let envA = 0.5;
    let envB = 0.5;
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      const white = Math.random() * 2 - 1;
      last = (last + 0.06 * white) / 1.06;

      // Two slow syllabic cadence envelopes (smooth speech rhythm without distinct words)
      const modA =
        0.5 +
        0.5 *
          Math.sin(t * 2 * Math.PI * 2.2 + Math.sin(t * 0.7) * 1.9) *
          (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 0.31));
      const modB =
        0.5 +
        0.5 *
          Math.sin(t * 2 * Math.PI * 1.65 + 2.1 + Math.cos(t * 0.55) * 2.3) *
          (0.6 + 0.4 * Math.cos(t * 2 * Math.PI * 0.23));
      envA += (modA - envA) * 0.0025;
      envB += (modB - envB) * 0.0025;
      data[i] = last * (0.45 * envA + 0.45 * envB);
    }
    const fadeSamples = Math.floor(ctx.sampleRate * 0.2);
    for (let i = 0; i < fadeSamples; i++) {
      const k = i / fadeSamples;
      const tailIdx = len - fadeSamples + i;
      data[i] = data[i] * k + data[tailIdx] * (1 - k);
    }

    // Route through warm vocal formant bandpass filters + room lowpass
    const roomLp = ctx.createBiquadFilter();
    roomLp.type = 'lowpass';
    roomLp.frequency.value = 1650;
    roomLp.Q.value = 0.6;
    roomLp.connect(chatterGain);

    const formants = [
      { freq: 340, q: 2.3, gain: 0.72, offset: 0, lfoHz: 0.19, lfoDepth: 55 },
      { freq: 690, q: 2.8, gain: 0.52, offset: 1.7, lfoHz: 0.27, lfoDepth: 95 },
      { freq: 1180, q: 3.1, gain: 0.34, offset: 3.1, lfoHz: 0.34, lfoDepth: 120 },
    ];

    for (const f of formants) {
      const src = ctx.createBufferSource();
      src.buffer = murmurBuf;
      src.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f.freq;
      bp.Q.value = f.q;

      const fg = ctx.createGain();
      fg.gain.value = f.gain;

      // Subtle formant drift so voices breathe organically
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = f.lfoHz;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = f.lfoDepth;
      lfo.connect(lfoGain);
      lfoGain.connect(bp.frequency);
      lfo.start();

      src.connect(bp);
      bp.connect(fg);
      fg.connect(roomLp);
      src.start(ctx.currentTime, f.offset);
    }
  }

  /**
   * Synthesize a soft footstep sound for first-person walkthrough mode.
   */
  public playFootstep() {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(108 + Math.random() * 22, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.07);
      gain.gain.setValueAtTime(0.052, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);
      osc.start(now);
      osc.stop(now + 0.085);
    } catch {
      // Ignore transient audio failure
    }
  }

  /**
   * Update spatialized ambient audio levels based on camera/listener proximity to active departments.
   */
  public update(
    _dt: number,
    listenerPos: THREE.Vector3,
    listenerRight: THREE.Vector3,
    sources: readonly AmbientSource[],
    options: {
      walkOn: boolean;
      activeLevel: string;
      simRate: number;
    }
  ) {
    if (!this.ctx || this.disposed) return;

    const activeAudio = this.enabled && this.ctx.state === 'running';
    if (!activeAudio) {
      return;
    }

    // 1. Proximity to building envelope for baseline architectural HVAC hum
    const clampedX = Math.max(-20, Math.min(20, listenerPos.x));
    const clampedY = Math.max(-9.5, Math.min(27, listenerPos.y));
    const clampedZ = Math.max(0, Math.min(11.5, listenerPos.z));
    const dxB = listenerPos.x - clampedX;
    const dyB = listenerPos.y - clampedY;
    const dzB = listenerPos.z - clampedZ;
    const distToBuilding = Math.hypot(dxB, dyB, dzB);
    const inBuilding = distToBuilding < 2.2;
    const buildingProx = 1 / (1 + Math.pow(distToBuilding / 15, 1.8));

    // 2. Accumulate proximity-weighted activity across active departments
    let chatterAccum = 0;
    let hvacBoostAccum = 0;
    let chatterPanNum = 0;
    let chatterPanDen = 0;

    // Stronger floor isolation when inside the building or viewing a specific level
    const verticalWeight = inBuilding || options.walkOn ? 2.45 : 1.35;

    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      this._toSrc.set(s.x - listenerPos.x, s.y - listenerPos.y, s.z - listenerPos.z);
      const effDist = Math.hypot(this._toSrc.x, this._toSrc.y * verticalWeight, this._toSrc.z);

      // Smooth acoustic falloff: strong inside/adjacent (<8m), audible on floor (~18m), faint at overview (>40m)
      const prox = 1 / (1 + Math.pow(effDist / 8.2, 2.05));
      if (prox < 0.004) continue;

      const invDist = effDist > 0.001 ? 1 / effDist : 0;
      const pan =
        (this._toSrc.x * listenerRight.x +
          this._toSrc.y * listenerRight.y +
          this._toSrc.z * listenerRight.z) *
        invDist;

      const act = s.activity;
      if (act > 0.01) {
        const cContrib = prox * act * s.chatterWeight;
        chatterAccum += cContrib;
        chatterPanNum += pan * cContrib;
        chatterPanDen += cContrib;
      }

      if (s.hvacWeight > 0) {
        hvacBoostAccum += prox * s.hvacWeight;
      }
    }

    // Soft-saturating curves keep dense floor clusters natural and never harsh
    const chatterLevel = Math.min(1, 1 - Math.exp(-chatterAccum * 1.25));
    const hvacBoost = Math.min(1, 1 - Math.exp(-hvacBoostAccum * 0.9));

    // Target gains (subtle, cozy, non-fatiguing studio levels)
    const walkBoost = options.walkOn ? 1.18 : 1.0;
    const basementBoost =
      options.activeLevel === 'b1' || options.activeLevel === 'b2' ? 1.35 : 1.0;

    const targetHvac =
      (0.006 + 0.024 * buildingProx + 0.022 * hvacBoost) * basementBoost * walkBoost;
    const targetChatter = (0.002 + 0.082 * chatterLevel) * walkBoost;

    const now = this.ctx.currentTime;
    if (this.hvacGain) {
      this.hvacGain.gain.setTargetAtTime(targetHvac, now, 0.22);
    }
    if (this.chatterGain) {
      this.chatterGain.gain.setTargetAtTime(chatterLevel > 0.012 ? targetChatter : 0, now, 0.24);
    }

    if (this.chatterPanner && chatterPanDen > 0.001) {
      const p = Math.max(-0.65, Math.min(0.65, chatterPanNum / chatterPanDen));
      this.chatterPanner.pan.setTargetAtTime(p, now, 0.15);
    }
  }

  public dispose() {
    this.disposed = true;
    try {
      this.masterGain?.disconnect();
      void this.ctx?.close();
    } catch {
      // Ignore cleanup failure
    }
    this.ctx = null;
    this.masterGain = null;
    this.hvacGain = null;
    this.chatterGain = null;
    this.chatterPanner = null;
  }
}
