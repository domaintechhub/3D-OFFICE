import * as THREE from 'three';
import { RING_Z_NORTH, RING_Z_SOUTH, ROAD_Z } from './constants';
import type { MaterialLibrary } from './materials';

export type TrafficAspect = 'green' | 'amber' | 'red';

export interface SignalIntersection {
  id: 'west' | 'center' | 'east' | 'north' | 'south';
  label: string;
  roadZ: number;
  crosswalkX: number;
  westboundStopX: number;
  eastboundStopX: number;
  phaseOffsetSec: number;
}

interface SignalHeadRefs {
  redMat: THREE.MeshStandardMaterial;
  amberMat: THREE.MeshStandardMaterial;
  greenMat: THREE.MeshStandardMaterial;
  glowSprite: THREE.Sprite;
  glowColor: THREE.Color;
}

interface PedHeadRefs {
  walkMat: THREE.MeshStandardMaterial;
  stopMat: THREE.MeshStandardMaterial;
}

interface IntersectionAssembly {
  spec: SignalIntersection;
  vehicleAspect: TrafficAspect;
  pedWalk: boolean;
  heads: SignalHeadRefs[];
  pedHeads: PedHeadRefs[];
}

const CYCLE_SEC = 24;
const GREEN_END = 11.0;
const AMBER_END = 13.5;
const PED_WALK_END = 21.8;

function makeSignalGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.32, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class TrafficLightSystem {
  public readonly group = new THREE.Group();
  private readonly assemblies: IntersectionAssembly[] = [];
  private readonly glowTex: THREE.CanvasTexture;
  private cycleClock = 2.0; // Start on green wave for smooth initial traffic flow

  constructor(M: MaterialLibrary, yStreet = -0.62) {
    this.glowTex = makeSignalGlowTexture();

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x252b34,
      roughness: 0.36,
      metalness: 0.78,
    });
    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x15181e,
      roughness: 0.55,
      metalness: 0.32,
    });
    const baseMat = M.concrete;

    const specs: Array<{
      spec: SignalIntersection;
      northPoleX: number;
      southPoleX: number;
    }> = [
      {
        spec: {
          id: 'west',
          label: 'West Gate Crosswalk',
          roadZ: ROAD_Z,
          crosswalkX: -32,
          westboundStopX: -25.5,
          eastboundStopX: -41.0,
          phaseOffsetSec: 0,
        },
        northPoleX: -26.8,
        southPoleX: -26.8,
      },
      {
        spec: {
          id: 'center',
          label: 'DomainTechHub Plaza Crosswalk',
          roadZ: ROAD_Z,
          crosswalkX: 0,
          westboundStopX: 6.5,
          eastboundStopX: -6.5,
          phaseOffsetSec: 12,
        },
        northPoleX: -5.6,
        southPoleX: 5.6,
      },
      {
        spec: {
          id: 'east',
          label: 'East Gate Crosswalk',
          roadZ: ROAD_Z,
          crosswalkX: 32,
          westboundStopX: 41.0,
          eastboundStopX: 25.5,
          phaseOffsetSec: 0,
        },
        northPoleX: 26.8,
        southPoleX: 26.8,
      },
      {
        spec: {
          id: 'north',
          label: 'North Ring Crosswalk',
          roadZ: RING_Z_NORTH,
          crosswalkX: 0,
          westboundStopX: 6.5,
          eastboundStopX: -6.5,
          phaseOffsetSec: 6,
        },
        northPoleX: -5.6,
        southPoleX: 5.6,
      },
      {
        spec: {
          id: 'south',
          label: 'South Ring Crosswalk',
          roadZ: RING_Z_SOUTH,
          crosswalkX: 0,
          westboundStopX: 6.5,
          eastboundStopX: -6.5,
          phaseOffsetSec: 18,
        },
        northPoleX: -5.6,
        southPoleX: 5.6,
      },
    ];

    const poleGeo = new THREE.CylinderGeometry(0.11, 0.145, 5.75, 14);
    const armGeo = new THREE.CylinderGeometry(0.068, 0.095, 5.4, 12);
    const housingGeo = new THREE.BoxGeometry(0.36, 1.06, 0.3);
    const visorGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.16, 12, 1, true, -Math.PI * 0.55, Math.PI * 1.1);
    const lensGeo = new THREE.CircleGeometry(0.092, 16);
    const pedBoxGeo = new THREE.BoxGeometry(0.34, 0.52, 0.24);
    const pedLensGeo = new THREE.PlaneGeometry(0.18, 0.18);

    const buildAspectHead = (parent: THREE.Object3D, x: number, y: number, z: number, rotY: number): SignalHeadRefs => {
      const hg = new THREE.Group();
      hg.position.set(x, y, z);
      hg.rotation.y = rotY;
      parent.add(hg);

      const box = new THREE.Mesh(housingGeo, housingMat);
      box.castShadow = true;
      hg.add(box);

      const mkAspect = (ay: number, col: number) => {
        const mat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.08,
          roughness: 0.22,
          metalness: 0.1,
        });
        const lens = new THREE.Mesh(lensGeo, mat);
        lens.position.set(0, ay, 0.156);
        hg.add(lens);

        const visor = new THREE.Mesh(visorGeo, housingMat);
        visor.rotation.x = Math.PI / 2;
        visor.rotation.z = Math.PI;
        visor.position.set(0, ay + 0.02, 0.21);
        hg.add(visor);
        return mat;
      };

      const redMat = mkAspect(0.32, 0xff2b2b);
      const amberMat = mkAspect(0.0, 0xffaa00);
      const greenMat = mkAspect(-0.32, 0x16ea68);

      const glowMat = new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0x16ea68,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glowSprite = new THREE.Sprite(glowMat);
      glowSprite.position.set(0, -0.32, 0.24);
      glowSprite.scale.set(0.95, 0.95, 1);
      hg.add(glowSprite);

      return { redMat, amberMat, greenMat, glowSprite, glowColor: new THREE.Color(0x16ea68) };
    };

    const buildPedHead = (parent: THREE.Object3D, x: number, y: number, z: number, rotY: number): PedHeadRefs => {
      const pg = new THREE.Group();
      pg.position.set(x, y, z);
      pg.rotation.y = rotY;
      parent.add(pg);

      const box = new THREE.Mesh(pedBoxGeo, housingMat);
      box.castShadow = true;
      pg.add(box);

      const stopMat = new THREE.MeshStandardMaterial({
        color: 0xff4d1c,
        emissive: 0xff4d1c,
        emissiveIntensity: 1.6,
        roughness: 0.25,
      });
      const stopLens = new THREE.Mesh(pedLensGeo, stopMat);
      stopLens.position.set(0, 0.11, 0.125);
      pg.add(stopLens);

      const walkMat = new THREE.MeshStandardMaterial({
        color: 0xe2f8ff,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.08,
        roughness: 0.25,
      });
      const walkLens = new THREE.Mesh(pedLensGeo, walkMat);
      walkLens.position.set(0, -0.11, 0.125);
      pg.add(walkLens);

      return { walkMat, stopMat };
    };

    for (const item of specs) {
      const heads: SignalHeadRefs[] = [];
      const pedHeads: PedHeadRefs[] = [];

      // North curb pole (overhangs westbound lane, signals face East +X for westbound vehicles)
      {
        const poleGrp = new THREE.Group();
        poleGrp.position.set(item.northPoleX, yStreet, item.spec.roadZ - 8.55);
        this.group.add(poleGrp);

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.36, 14), baseMat);
        base.position.y = 0.18;
        base.castShadow = true;
        base.receiveShadow = true;
        poleGrp.add(base);

        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 2.875;
        pole.castShadow = true;
        poleGrp.add(pole);

        const arm = new THREE.Mesh(armGeo, poleMat);
        arm.rotation.x = Math.PI / 2;
        arm.position.set(0, 5.45, 2.7);
        arm.castShadow = true;
        poleGrp.add(arm);

        // Overhead signal over westbound lane facing East (+X)
        heads.push(buildAspectHead(poleGrp, 0, 5.05, 5.0, Math.PI / 2));
        // Post-mounted signal facing East (+X)
        heads.push(buildAspectHead(poleGrp, 0.24, 3.1, 0, Math.PI / 2));
        // Pedestrian signal facing South (+Z) across crosswalk
        pedHeads.push(buildPedHead(poleGrp, 0, 2.45, 0.24, 0));
      }

      // South curb pole (overhangs eastbound lane, signals face West -X for eastbound vehicles)
      {
        const poleGrp = new THREE.Group();
        poleGrp.position.set(item.southPoleX, yStreet, item.spec.roadZ + 8.55);
        this.group.add(poleGrp);

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.36, 14), baseMat);
        base.position.y = 0.18;
        base.castShadow = true;
        base.receiveShadow = true;
        poleGrp.add(base);

        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 2.875;
        pole.castShadow = true;
        poleGrp.add(pole);

        const arm = new THREE.Mesh(armGeo, poleMat);
        arm.rotation.x = -Math.PI / 2;
        arm.position.set(0, 5.45, -2.7);
        arm.castShadow = true;
        poleGrp.add(arm);

        // Overhead signal over LANE_EAST facing West (-X)
        heads.push(buildAspectHead(poleGrp, 0, 5.05, -5.0, -Math.PI / 2));
        // Post-mounted signal facing West (-X)
        heads.push(buildAspectHead(poleGrp, -0.24, 3.1, 0, -Math.PI / 2));
        // Pedestrian signal facing North (-Z) across crosswalk
        pedHeads.push(buildPedHead(poleGrp, 0, 2.45, -0.24, Math.PI));
      }

      this.assemblies.push({
        spec: item.spec,
        vehicleAspect: 'green',
        pedWalk: false,
        heads,
        pedHeads,
      });
    }

    this.applyVisuals(0);
  }

  public update(dt: number, simRate: number, nightFactor: number) {
    if (simRate > 0) {
      // Gently scale speed when simRate is high, clamped so signals remain legible
      const rateScale = simRate >= 10 ? 1.5 : 1.0;
      this.cycleClock = (this.cycleClock + dt * rateScale) % CYCLE_SEC;
    }
    this.applyVisuals(nightFactor);
  }

  private applyVisuals(nightFactor: number) {
    const glowScale = 0.85 + nightFactor * 0.45;
    const glowOpacity = 0.32 + nightFactor * 0.42;
    const onEmissive = 2.8 + nightFactor * 1.4;

    for (const a of this.assemblies) {
      const t = (this.cycleClock + a.spec.phaseOffsetSec) % CYCLE_SEC;
      let aspect: TrafficAspect = 'red';
      let pedWalk = false;
      if (t < GREEN_END) {
        aspect = 'green';
      } else if (t < AMBER_END) {
        aspect = 'amber';
      } else {
        aspect = 'red';
        pedWalk = t < PED_WALK_END;
      }

      a.vehicleAspect = aspect;
      a.pedWalk = pedWalk;

      for (const h of a.heads) {
        h.redMat.emissiveIntensity = aspect === 'red' ? onEmissive : 0.06;
        h.amberMat.emissiveIntensity = aspect === 'amber' ? onEmissive : 0.06;
        h.greenMat.emissiveIntensity = aspect === 'green' ? onEmissive : 0.06;

        const mat = h.glowSprite.material as THREE.SpriteMaterial;
        if (aspect === 'red') {
          h.glowColor.setHex(0xff3333);
          h.glowSprite.position.y = 0.32;
        } else if (aspect === 'amber') {
          h.glowColor.setHex(0xffb020);
          h.glowSprite.position.y = 0.0;
        } else {
          h.glowColor.setHex(0x20f078);
          h.glowSprite.position.y = -0.32;
        }
        mat.color.copy(h.glowColor);
        mat.opacity = glowOpacity;
        h.glowSprite.scale.set(glowScale, glowScale, 1);
      }

      for (const p of a.pedHeads) {
        p.walkMat.emissiveIntensity = pedWalk ? onEmissive : 0.06;
        p.stopMat.emissiveIntensity = !pedWalk ? onEmissive * 0.85 : 0.06;
      }
    }
  }

  public getNextStopSignal(
    x: number,
    dir: 1 | -1,
    z = ROAD_Z
  ): { stopX: number; aspect: TrafficAspect; dist: number; label: string } | null {
    let best: { stopX: number; aspect: TrafficAspect; dist: number; label: string } | null = null;
    for (const a of this.assemblies) {
      if (Math.abs(a.spec.roadZ - z) > 8.5) continue;
      const stopX = dir > 0 ? a.spec.eastboundStopX : a.spec.westboundStopX;
      const dist = (stopX - x) * dir;
      if (dist > -0.5 && dist < 32 && (!best || dist < best.dist)) {
        best = { stopX, aspect: a.vehicleAspect, dist, label: a.spec.label };
      }
    }
    return best;
  }

  public canPedestrianCross(x: number, z = ROAD_Z): boolean {
    let best: IntersectionAssembly | null = null;
    let bestD = 9;
    for (const a of this.assemblies) {
      if (Math.abs(a.spec.roadZ - z) > 10) continue;
      const d = Math.abs(x - a.spec.crosswalkX);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best ? best.pedWalk : true;
  }

  public getNearestPlayerSignal(
    x: number,
    z: number,
    yaw: number
  ): { label: string; aspect: TrafficAspect; distance: number } | null {
    const fx = Math.sin(yaw);
    if (Math.abs(fx) < 0.35) return null;
    const dir: 1 | -1 = fx >= 0 ? 1 : -1;
    const sig = this.getNextStopSignal(x, dir, z);
    if (!sig || sig.dist < -0.5 || sig.dist > 28) return null;
    return {
      label: sig.label,
      aspect: sig.aspect,
      distance: Math.max(0, Math.round(sig.dist)),
    };
  }

  public dispose() {
    this.glowTex.dispose();
  }
}
