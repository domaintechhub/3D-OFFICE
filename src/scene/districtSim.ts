import * as THREE from 'three';
import type { BuildingId, DistrictBuildingSpec } from './districtData';
import { DISTRICT_BUILDING_MAP } from './districtData';
import type { DistrictBuildingHandle, DistrictChairHandle } from './districtBuildings';
import {
  createCharacterBrain,
  generateCharacterName,
  pickPersonality,
  pickThoughtForGoal,
  setBrainThought,
  type CharacterIdentity,
  type FreeGoal,
} from './characterMind';
import { ROAD_Z, type FloorActivitySummary, type FloorZoneActivity, type WeatherCondition } from './constants';
import {
  makePerson,
  MODES,
  pickMode,
  SEATED_POSES,
  setPose,
  updatePersonKinematics,
  type HumanPalette,
  type MakePersonOptions,
  type PersonActor,
} from './human';
import type { MaterialLibrary } from './materials';
import {
  buildDistrictPath,
  getDistrictChairDockPoint,
  registerDistrictChairs,
  resolveDistrictObstacle,
  type TrackedChairCollider,
} from './obstacles';
import { socialNetwork } from './socialNetwork';
import type { TrafficLightSystem } from './trafficLights';

interface DistrictChairPair {
  handle: DistrictChairHandle;
  collider: TrackedChairCollider;
  occupants: DistrictActor[];
}

export type DistrictActor = PersonActor & {
  buildingId: BuildingId | 'street';
  lv: number;
  homeX: number;
  homeZ: number;
  homeFace: number;
  homePose: string;
  zoneName: string;
  roleLabel: string;
  walkSpeed: number;
  mode: 'home' | 'toGoal' | 'atGoal' | 'toHome';
  queue: Array<{ x: number; z: number }>;
  targetPose: string;
  targetFace: number;
  stuckTime: number;
  replanCount: number;
  lastX: number;
  lastZ: number;
  chair?: DistrictChairHandle;
  chairCollider?: TrackedChairCollider;
  waypoints?: Array<{ x: number; z: number; wait?: number }>;
  wpIndex?: number;
  waitTimer?: number;
  shelter?: {
    buildingId: BuildingId;
    entryX: number;
    entryZ: number;
    x: number;
    z: number;
    face: number;
    label: string;
  };
  shelterPhase?: 'patrol' | 'toEntry' | 'toShelter' | 'sheltered' | 'toExit';
};

export class DistrictSim {
  private readonly peopleGroup = new THREE.Group();
  private readonly P_LIB: HumanPalette;
  private readonly buildings: Map<BuildingId, DistrictBuildingHandle>;
  public readonly ACTORS: DistrictActor[] = [];
  private readonly chairPairs: DistrictChairPair[] = [];
  private readonly _v1 = new THREE.Vector3();

  private cutawayBuildingId: BuildingId = 'hub';
  private cutawayMinY: number | null = null;
  private cutawayMaxY: number | null = null;
  private staffVisible = true;
  private readonly trafficLights?: TrafficLightSystem;

  constructor(
    scene: THREE.Scene,
    M: MaterialLibrary,
    P_LIB: HumanPalette,
    buildings: Map<BuildingId, DistrictBuildingHandle>,
    trafficLights?: TrafficLightSystem
  ) {
    this.P_LIB = P_LIB;
    this.buildings = buildings;
    this.trafficLights = trafficLights;
    scene.add(this.peopleGroup);

    // Register all district chair handles per buildingId & floor
    const chairsByKey = new Map<string, TrackedChairCollider[]>();
    for (const [bId, handle] of buildings) {
      for (const ch of handle.chairs) {
        const collider: TrackedChairCollider = {
          restX: ch.restX,
          restZ: ch.restZ,
          curX: ch.curX,
          curZ: ch.curZ,
          r: 0.34,
        };
        this.chairPairs.push({ handle: ch, collider, occupants: [] });
        const key = `${bId}:${ch.lv}`;
        let list = chairsByKey.get(key);
        if (!list) {
          list = [];
          chairsByKey.set(key, list);
        }
        list.push(collider);
      }
      for (let lv = 0; lv < handle.spec.floors; lv++) {
        const list = chairsByKey.get(`${bId}:${lv}`);
        if (list) registerDistrictChairs(bId, lv, list);
      }
    }

    this.populateAllBuildings(M);
    this.populateStreetWalkers(M);
    this.snapAll(9 * 60 + 25);
  }

  private floorSurfaceY(spec: DistrictBuildingSpec, lv: number, x: number, z: number): number {
    if (lv > 0) return spec.groundY + lv * spec.floorH + 0.12;
    const hw = spec.w * 0.5;
    const hd = spec.d * 0.5;
    if (Math.abs(x - spec.cx) <= hw && Math.abs(z - spec.cz) <= hd) {
      return spec.groundY + 0.12;
    }
    return -0.608;
  }

  private findChairPair(bId: BuildingId, lv: number, x: number, z: number): DistrictChairPair | null {
    let best: DistrictChairPair | null = null;
    let bestD = 0.35;
    for (const pair of this.chairPairs) {
      if (pair.handle.buildingId !== bId || pair.handle.lv !== lv) continue;
      const d = Math.hypot(pair.handle.restX - x, pair.handle.restZ - z);
      if (d < bestD) {
        bestD = d;
        best = pair;
      }
    }
    return best;
  }

  private setSafePose(P: DistrictActor, requestedPose: string, snap = false) {
    let pose = requestedPose;
    if (SEATED_POSES.has(pose)) {
      const chair = P.chair;
      const floorY = chair ? chair.groundY + chair.lv * chair.floorH + 0.12 : 0;
      const onChair = Boolean(
        chair &&
          P.g.visible &&
          Math.abs(P.g.position.y - floorY) < 0.35 &&
          Math.hypot(P.g.position.x - chair.restX, P.g.position.z - chair.restZ) <= 0.18
      );
      if (!onChair) {
        if (pose === 'sitReadDoc') pose = 'readDoc';
        else if (pose === 'sitTalk') pose = 'talk';
        else if (pose === 'sitCollaborate') pose = 'collaborate';
        else if (pose === 'phone') pose = 'standPhone';
        else pose = 'stand';
      }
    }
    setPose(P, pose, this.P_LIB, snap);
  }

  private spawnActor(
    bId: BuildingId | 'street',
    lv: number,
    x: number,
    z: number,
    face: number,
    pose: string,
    opts: MakePersonOptions,
    identity: Omit<CharacterIdentity, 'homeLv' | 'homeX' | 'homeZ' | 'homeFace' | 'homePose'>,
    zoneName: string,
    M: MaterialLibrary,
    walkSpeed = 1.08
  ): DistrictActor {
    const spec = bId !== 'street' ? DISTRICT_BUILDING_MAP[bId] : null;
    const y = spec ? this.floorSurfaceY(spec, lv, x, z) : -0.608;
    const p = makePerson(opts, this.P_LIB, M) as DistrictActor;
    p.g.position.set(x, y, z);
    p.yaw = p.tyaw = face;
    p.g.rotation.y = face;
    p.look = 0.28;
    p.timer = 2 + Math.random() * 5;
    p.buildingId = bId;
    p.lv = lv;
    p.homeX = x;
    p.homeZ = z;
    p.homeFace = face;
    p.homePose = pose;
    p.zoneName = zoneName;
    p.roleLabel = identity.role;
    p.walkSpeed = walkSpeed;
    p.mode = 'home';
    p.queue = [];
    p.targetPose = pose;
    p.targetFace = face;
    p.stuckTime = 0;
    p.replanCount = 0;
    p.lastX = x;
    p.lastZ = z;

    if (bId !== 'street') {
      const pair = this.findChairPair(bId, lv, x, z);
      if (pair) {
        p.chair = pair.handle;
        p.chairCollider = pair.collider;
        pair.occupants.push(p);
      }
    }

    p.brain = createCharacterBrain({
      ...identity,
      homeLv: lv,
      homeX: x,
      homeZ: z,
      homeFace: face,
      homePose: pose,
    });

    if (bId !== 'street' && identity.topicKey !== 'diner' && identity.topicKey !== 'client') {
      socialNetwork.registerWorker(bId, identity.name, identity.role);
    }

    if (
      bId !== 'street' &&
      identity.topicKey !== 'diner' &&
      identity.topicKey !== 'client' &&
      SEATED_POSES.has(pose)
    ) {
      p.modes = [
        ['type', 0.34],
        ['monitorLook', 0.18],
        ['leanScreen', 0.14],
        ['sitPhone', 0.16],
        ['phone', 0.08],
        ['writeNotes', 0.1],
      ];
    }

    this.setSafePose(p, pose, true);
    this.peopleGroup.add(p.g);
    this.ACTORS.push(p);
    return p;
  }

  private populateAllBuildings(M: MaterialLibrary) {
    const P = this.P_LIB;
    const sMat = (col: number) =>
      new THREE.MeshStandardMaterial({
        color: col,
        normalMap: M.textures.fabricNormal,
        normalScale: new THREE.Vector2(0.32, 0.32),
        roughness: 0.82,
      });

    const femHair = ['braids', 'bun', 'puff', 'afro', 'bob', 'pixie'] as const;
    const maleHair = ['fade', 'twists', 'afro', 'fade'] as const;

    let seedCounter = 200;
    const nextPersonOpts = (
      fem: boolean,
      coatCol?: number,
      extra?: Partial<MakePersonOptions>
    ): MakePersonOptions => {
      const id = ++seedCounter;
      const outfit = fem
        ? (['dress', 'blouseSkirt', 'knit', 'shirtTrousers', 'suit'] as const)[id % 5]
        : (['shirtTrousers', 'knit', 'smartCasual', 'suit'] as const)[id % 4];
      return {
        skin: P.skins[id % P.skins.length],
        shirt: coatCol ? sMat(coatCol) : P.shirts[(id * 3) % P.shirts.length],
        hair: P.hairs[(id * 5) % P.hairs.length],
        trou: P.trous[(id * 7) % P.trous.length],
        fem,
        hairStyle: fem ? femHair[id % femHair.length] : maleHair[id % maleHair.length],
        beardStyle: !fem && id % 2 === 0 ? 'stubble' : 'none',
        faceVariant: id % 4,
        outfit,
        shoeStyle: fem ? (id % 2 ? 'heel' : 'flat') : 'oxford',
        s: fem ? 0.96 : 1.02,
        ...extra,
      };
    };

    // 1. Savanna Bistro & Grill (Restaurant)
    const rest = DISTRICT_BUILDING_MAP.restaurant;
    this.spawnActor(
      'restaurant', 0, rest.cx - 0.5, rest.cz - 8.1, 0, 'standCounter',
      nextPersonOpts(false, 0xf4f6f9, { outfit: 'shirtTrousers', coat: true }),
      {
        id: 'rest-chef',
        name: generateCharacterName(false, 41),
        role: 'Head Chef',
        department: `${rest.name} · Kitchen Pass`,
        seniority: 'Lead',
        accentColor: rest.accent,
        personality: pickPersonality(41),
        topicKey: 'restaurant',
      },
      'Open Wood-Fired Kitchen', M
    );
    this.spawnActor(
      'restaurant', 0, rest.cx - 4.5, rest.cz - 8.2, 0, 'standCounter',
      nextPersonOpts(true, 0xf4f6f9, { outfit: 'shirtTrousers', coat: true }),
      {
        id: 'rest-pizzaiolo',
        name: generateCharacterName(true, 42),
        role: 'Wood-Oven Chef',
        department: `${rest.name} · Hearth Oven`,
        seniority: 'Senior',
        accentColor: rest.accent,
        personality: pickPersonality(42),
        topicKey: 'restaurant',
      },
      'Open Wood-Fired Kitchen', M
    );
    this.spawnActor(
      'restaurant', 0, rest.cx + 10.0, rest.cz - 2.2, -Math.PI / 2, 'standCounter',
      nextPersonOpts(false, 0x262930, { outfit: 'smartCasual', sleeve: 'rolled' }),
      {
        id: 'rest-barista',
        name: generateCharacterName(false, 43),
        role: 'Lead Barista & Sommelier',
        department: `${rest.name} · Espresso Bar`,
        accentColor: rest.accent,
        personality: pickPersonality(43),
        topicKey: 'restaurant',
      },
      'Espresso & Cocktail Bar', M
    );
    this.spawnActor(
      'restaurant', 0, rest.cx + 5.2, rest.cz + 7.25, Math.PI, 'type',
      nextPersonOpts(true, 0x1e293b, { outfit: 'suit', blazer: true }),
      {
        id: 'rest-host',
        name: generateCharacterName(true, 44),
        role: 'Maître D’ Host',
        department: `${rest.name} · Reception`,
        accentColor: rest.accent,
        personality: pickPersonality(44),
        topicKey: 'restaurant',
      },
      'Dining Hall & Reservations', M
    );
    const diners: Array<[number, number, number, string]> = [
      [rest.cx - 5.2 - 1.15, rest.cz + 0.2, Math.PI / 2, 'sitTalk'],
      [rest.cx - 5.2 + 1.15, rest.cz + 0.2, -Math.PI / 2, 'sitTalk'],
      [rest.cx + 2.6 - 1.15, rest.cz + 0.2, Math.PI / 2, 'sitReadDoc'],
      [rest.cx - 5.2 - 1.15, rest.cz + 4.8, Math.PI / 2, 'sitTalk'],
      [rest.cx + 2.6 + 1.15, rest.cz + 4.8, -Math.PI / 2, 'sitCollaborate'],
    ];
    diners.forEach(([dx, dz, df, dp], idx) => {
      const fem = idx % 2 === 1;
      this.spawnActor(
        'restaurant', 0, dx, dz, df, dp,
        nextPersonOpts(fem),
        {
          id: `rest-diner-${idx}`,
          name: generateCharacterName(fem, 50 + idx),
          role: 'Bistro Guest',
          department: `${rest.name} · Dining Hall`,
          accentColor: rest.accent,
          personality: pickPersonality(50 + idx),
          topicKey: 'diner',
        },
        'Dining Hall & Reservations', M, 0.96
      );
    });

    // 2. Apex Motors Showroom (Dealership)
    const dealer = DISTRICT_BUILDING_MAP.dealership;
    this.spawnActor(
      'dealership', 0, dealer.cx - 5.8, dealer.cz - 6.35, 0, 'type',
      nextPersonOpts(false, 0x1e2430, { outfit: 'suit', blazer: true, tie: 0x991b1b }),
      {
        id: 'deal-advisor-1',
        name: generateCharacterName(false, 61),
        role: 'EV Fleet Advisor',
        department: `${dealer.name} · Sales`,
        seniority: 'Senior',
        accentColor: dealer.accent,
        personality: pickPersonality(61),
        topicKey: 'dealership',
      },
      'Showroom Sales Gallery', M
    );
    this.spawnActor(
      'dealership', 0, dealer.cx + 5.8, dealer.cz - 6.35, 0, 'phone',
      nextPersonOpts(true, 0x262936, { outfit: 'suit', blazer: true }),
      {
        id: 'deal-advisor-2',
        name: generateCharacterName(true, 62),
        role: 'Finance & Lease Manager',
        department: `${dealer.name} · Financing`,
        seniority: 'Lead',
        accentColor: dealer.accent,
        personality: pickPersonality(62),
        topicKey: 'dealership',
      },
      'Showroom Sales Gallery', M
    );
    this.spawnActor(
      'dealership', 0, dealer.cx + 1.5, dealer.cz + 5.2, Math.PI, 'hold',
      nextPersonOpts(false, undefined, { outfit: 'smartCasual' }),
      {
        id: 'deal-guest-1',
        name: generateCharacterName(false, 63),
        role: 'Prospective EV Buyer',
        department: `${dealer.name} · Turntable Display`,
        accentColor: dealer.accent,
        personality: pickPersonality(63),
        topicKey: 'client',
      },
      'Turntable Display', M, 0.96
    );

    // 3. Nairobi Trust Bank
    const bank = DISTRICT_BUILDING_MAP.bank;
    [-4.6, -0.2].forEach((ox, i) => {
      const fem = i === 0;
      this.spawnActor(
        'bank', 0, bank.cx + ox, bank.cz - 4.75, 0, i === 0 ? 'type' : 'monitorLook',
        nextPersonOpts(fem, 0x1c2b46, { outfit: 'suit', blazer: true, lanyard: true }),
        {
          id: `bank-teller-${i}`,
          name: generateCharacterName(fem, 71 + i),
          role: `Branch Teller ${i + 1}`,
          department: `${bank.name} · Retail Hall`,
          accentColor: bank.accent,
          personality: pickPersonality(71 + i),
          topicKey: 'bank',
        },
        'Retail Banking & RTGS Hall', M
      );
    });
    this.spawnActor(
      'bank', 0, bank.cx - 2.4, bank.cz - 1.8, Math.PI, 'stand',
      nextPersonOpts(true),
      {
        id: 'bank-client-1',
        name: generateCharacterName(true, 74),
        role: 'Corporate Account Client',
        department: `${bank.name} · Teller Queue`,
        accentColor: bank.accent,
        personality: pickPersonality(74),
        topicKey: 'client',
      },
      'Retail Banking & RTGS Hall', M, 0.95
    );
    this.spawnActor(
      'bank', 0, bank.cx + 3.2, bank.cz - 7.4, -Math.PI / 4, 'radio',
      nextPersonOpts(false, 0x162238, { outfit: 'shirtTrousers', sleeve: 'short' }),
      {
        id: 'bank-guard',
        name: generateCharacterName(false, 75),
        role: 'Vault Security Officer',
        department: `${bank.name} · Treasury Vault`,
        seniority: 'Senior',
        accentColor: bank.accent,
        personality: pickPersonality(75),
        topicKey: 'bank',
      },
      'Biometric Main Vault', M, 0.94
    );

    // 4. BitVault Crypto Exchange
    const crypto = DISTRICT_BUILDING_MAP.crypto;
    [
      [crypto.cx - 6.6, crypto.cz + 2.72, Math.PI, 'type', false, 'Quant Spot Trader'],
      [crypto.cx + 6.6, crypto.cz + 2.72, Math.PI, 'monitorLook', true, 'Quant Spot Trader'],
      [crypto.cx - 6.6, crypto.cz - 4.52, 0, 'leanScreen', false, 'MPC Custody Auditor'],
      [crypto.cx + 6.6, crypto.cz - 4.52, 0, 'phone', true, 'Protocol Liquidity Lead'],
    ].forEach(([px, pz, pf, pp, fem, role], i) => {
      this.spawnActor(
        'crypto', 0, px as number, pz as number, pf as number, pp as string,
        nextPersonOpts(fem as boolean, undefined, { headphones: i % 2 === 0, sneakers: true }),
        {
          id: `crypto-trader-${i}`,
          name: generateCharacterName(fem as boolean, 81 + i),
          role: role as string,
          department: `${crypto.name} · Trading Floor`,
          seniority: i % 2 === 0 ? 'Senior' : 'Lead',
          accentColor: crypto.accent,
          personality: pickPersonality(81 + i),
          topicKey: 'crypto',
        },
        'BitVault Trading Floor', M
      );
    });
    this.spawnActor(
      'crypto', 0, crypto.cx, crypto.cz - 2.1, Math.PI, 'inspectPanel',
      nextPersonOpts(false, 0x18202c, { lanyard: true }),
      {
        id: 'crypto-vault-eng',
        name: generateCharacterName(false, 88),
        role: 'Hardware Security Engineer',
        department: `${crypto.name} · Cold Storage Pod`,
        seniority: 'Senior',
        accentColor: crypto.accent,
        personality: pickPersonality(88),
        topicKey: 'crypto',
      },
      'Cold Storage Pod', M
    );

    // 5. Skyline Travel & Aviation
    const travel = DISTRICT_BUILDING_MAP.travel;
    [-9.0, -4.6].forEach((ox, i) => {
      const fem = i === 0;
      this.spawnActor(
        'travel', 0, travel.cx + ox, travel.cz + 4.35, Math.PI, i === 0 ? 'type' : 'phone',
        nextPersonOpts(fem, 0x17325c, { outfit: 'suit', blazer: true }),
        {
          id: `travel-agent-${i}`,
          name: generateCharacterName(fem, 91 + i),
          role: `Flight & Visa Agent ${i + 1}`,
          department: `${travel.name} · Check-In Desk`,
          accentColor: travel.accent,
          personality: pickPersonality(91 + i),
          topicKey: 'travel',
        },
        'Check-In & Ticketing Counter', M
      );
    });
    this.spawnActor(
      'travel', 0, travel.cx - 6.8, travel.cz + 1.2, 0, 'hold',
      nextPersonOpts(false, undefined, { coat: true }),
      {
        id: 'travel-guest-1',
        name: generateCharacterName(false, 94),
        role: 'International Traveler',
        department: `${travel.name} · Departures Lobby`,
        accentColor: travel.accent,
        personality: pickPersonality(94),
        topicKey: 'client',
      },
      'Departures & Globe Lounge', M, 0.95
    );
    this.spawnActor(
      'travel', 0, travel.cx + 2.8, travel.cz - 2.0, -Math.PI / 2, 'stand',
      nextPersonOpts(true),
      {
        id: 'travel-guest-2',
        name: generateCharacterName(true, 95),
        role: 'Corporate Passenger',
        department: `${travel.name} · Departures Lobby`,
        accentColor: travel.accent,
        personality: pickPersonality(95),
        topicKey: 'client',
      },
      'Departures & Globe Lounge', M, 0.96
    );

    // 6. Kenya Safari & Tourism
    const tourism = DISTRICT_BUILDING_MAP.tourism;
    [-5.5, 5.5].forEach((ox, i) => {
      const fem = i === 1;
      this.spawnActor(
        'tourism', 0, tourism.cx + ox, tourism.cz + 6.08, Math.PI, i === 0 ? 'leanScreen' : 'type',
        nextPersonOpts(fem, 0x4b5c34, { outfit: 'smartCasual', sleeve: 'rolled' }),
        {
          id: `tourism-planner-${i}`,
          name: generateCharacterName(fem, 101 + i),
          role: i === 0 ? 'Safari Expedition Planner' : 'Eco-Lodge Concierge',
          department: `${tourism.name} · Expedition Desk`,
          seniority: 'Senior',
          accentColor: tourism.accent,
          personality: pickPersonality(101 + i),
          topicKey: 'tourism',
        },
        'Safari Gallery & Expeditions', M
      );
    });
    this.spawnActor(
      'tourism', 0, tourism.cx - 2.6, tourism.cz - 0.8, -Math.PI / 2, 'talk',
      nextPersonOpts(false, 0x6b5a3c, { outfit: 'shirtTrousers' }),
      {
        id: 'tourism-guide',
        name: generateCharacterName(false, 104),
        role: 'Lead Naturalist Guide',
        department: `${tourism.name} · Relief Map Gallery`,
        seniority: 'Lead',
        accentColor: tourism.accent,
        personality: pickPersonality(104),
        topicKey: 'tourism',
      },
      'Relief Map & 4x4 Showcase', M
    );
    this.spawnActor(
      'tourism', 0, tourism.cx - 1.3, tourism.cz - 0.8, Math.PI / 2, 'stand',
      nextPersonOpts(true),
      {
        id: 'tourism-guest',
        name: generateCharacterName(true, 105),
        role: 'Safari Guest',
        department: `${tourism.name} · Relief Map Gallery`,
        accentColor: tourism.accent,
        personality: pickPersonality(105),
        topicKey: 'client',
      },
      'Relief Map & 4x4 Showcase', M, 0.94
    );

    // 7. VitalCare Medical & Pharmacy
    const med = DISTRICT_BUILDING_MAP.medical;
    this.spawnActor(
      'medical', 0, med.cx, med.cz - 2.3, 0, 'type',
      nextPersonOpts(true, 0xf1f5f9, { coat: true, outfit: 'shirtTrousers', lanyard: true }),
      {
        id: 'med-triage',
        name: generateCharacterName(true, 111),
        role: 'Lead Pharmacist & Triage',
        department: `${med.name} · Triage Counter`,
        seniority: 'Lead',
        accentColor: med.accent,
        personality: pickPersonality(111),
        topicKey: 'medical',
      },
      '24h Pharmacy & Patient Intake', M
    );
    this.spawnActor(
      'medical', 0, med.cx + 10.5, med.cz - 3.48, 0, 'type',
      nextPersonOpts(false, 0xf8fafc, { coat: true, outfit: 'suit', glasses: true }),
      {
        id: 'med-doctor',
        name: `Dr. ${generateCharacterName(false, 112)}`,
        role: 'Attending Physician',
        department: `${med.name} · Consult Suite 1`,
        seniority: 'Senior',
        accentColor: med.accent,
        personality: pickPersonality(112),
        topicKey: 'medical',
      },
      'Outpatient & Diagnostic Suites', M
    );
    this.spawnActor(
      'medical', 0, med.cx + 17.5, med.cz - 3.48, 0, 'monitorLook',
      nextPersonOpts(true, 0xe2f5f2, { coat: true, outfit: 'shirtTrousers' }),
      {
        id: 'med-lab',
        name: generateCharacterName(true, 113),
        role: 'Clinical Lab Specialist',
        department: `${med.name} · Diagnostic Lab`,
        seniority: 'Senior',
        accentColor: med.accent,
        personality: pickPersonality(113),
        topicKey: 'medical',
      },
      'Outpatient & Diagnostic Suites', M
    );
    this.spawnActor(
      'medical', 0, med.cx - 14.5, med.cz - 4.6, 0, 'standCounter',
      nextPersonOpts(false, 0xf4f7fa, { coat: true, outfit: 'shirtTrousers' }),
      {
        id: 'med-pharm',
        name: generateCharacterName(false, 114),
        role: 'Dispensary Pharmacist',
        department: `${med.name} · 24h Pharmacy`,
        accentColor: med.accent,
        personality: pickPersonality(114),
        topicKey: 'medical',
      },
      '24h Pharmacy Dispensary', M
    );
    this.spawnActor(
      'medical', 0, med.cx - 2.4, med.cz + 1.0, Math.PI, 'hold',
      nextPersonOpts(true),
      {
        id: 'med-patient',
        name: generateCharacterName(true, 115),
        role: 'Outpatient Visitor',
        department: `${med.name} · Reception Lobby`,
        accentColor: med.accent,
        personality: pickPersonality(115),
        topicKey: 'client',
      },
      '24h Pharmacy & Patient Intake', M, 0.94
    );

    // 8. SwiftPort Cargo & Logistics
    const log = DISTRICT_BUILDING_MAP.logistics;
    [3.8, 7.8].forEach((ox, i) => {
      const fem = i === 1;
      this.spawnActor(
        'logistics', 0, log.cx + ox, log.cz + 3.65, Math.PI, i === 0 ? 'type' : 'sitPhone',
        nextPersonOpts(fem, 0x1f2937, { outfit: 'shirtTrousers', lanyard: true }),
        {
          id: `logistics-dispatch-${i}`,
          name: generateCharacterName(fem, 121 + i),
          role: i === 0 ? 'Freight Dispatch Manager' : 'Customs & Waybill Officer',
          department: `${log.name} · Dispatch Control`,
          seniority: i === 0 ? 'Lead' : 'Senior',
          accentColor: log.accent,
          personality: pickPersonality(121 + i),
          topicKey: 'logistics',
        },
        'Dispatch & Waybill Control', M
      );
    });
    this.spawnActor(
      'logistics', 0, log.cx - 2.3, log.cz + 1.2, -Math.PI / 2, 'inspectPanel',
      nextPersonOpts(false, 0x9a3412, { outfit: 'smartCasual', sleeve: 'rolled' }),
      {
        id: 'logistics-belt-sup',
        name: generateCharacterName(false, 124),
        role: 'Sortation Belt Supervisor',
        department: `${log.name} · Parcel Conveyor`,
        seniority: 'Senior',
        accentColor: log.accent,
        personality: pickPersonality(124),
        topicKey: 'logistics',
      },
      'Parcel Sortation Hall', M
    );
    this.spawnActor(
      'logistics', 0, log.cx + 10.6, log.cz - 2.6, Math.PI / 2, 'hold',
      nextPersonOpts(false, 0xc2410c, { outfit: 'shirtTrousers', sleeve: 'short', sneakers: true }),
      {
        id: 'logistics-courier',
        name: generateCharacterName(false, 125),
        role: 'Express Fleet Driver',
        department: `${log.name} · East Loading Docks`,
        accentColor: log.accent,
        personality: pickPersonality(125),
        topicKey: 'logistics',
      },
      'East Freight Loading Yard', M
    );
    this.spawnActor(
      'logistics', 0, log.cx + 4.4, log.cz + 0.4, 0, 'stand',
      nextPersonOpts(true),
      {
        id: 'logistics-client',
        name: generateCharacterName(true, 126),
        role: 'Parcel Drop-Off Client',
        department: `${log.name} · Dispatch Counter`,
        accentColor: log.accent,
        personality: pickPersonality(126),
        topicKey: 'client',
      },
      'Dispatch & Waybill Control', M, 0.95
    );

    // 9. TerraCraft Estates, Build & Interiors (Real Estate + Construction + Interior Design in 1 building)
    const re = DISTRICT_BUILDING_MAP.realestate;
    this.spawnActor(
      'realestate', 0, re.cx - 6.8, re.cz + 6.08, Math.PI, 'type',
      nextPersonOpts(true, 0x3b2f2f, { outfit: 'suit', lanyard: true }),
      {
        id: 'realestate-broker',
        name: generateCharacterName(true, 131),
        role: 'Senior Property Broker',
        department: `${re.name} · Real Estate Gallery`,
        seniority: 'Lead',
        accentColor: re.accent,
        personality: pickPersonality(131),
        topicKey: 'realestate',
      },
      'Real Estate Masterplan Gallery', M
    );
    this.spawnActor(
      'realestate', 0, re.cx + 7.4, re.cz + 6.08, Math.PI, 'monitorLook',
      nextPersonOpts(false, 0xd97706, { outfit: 'smartCasual', sleeve: 'rolled', lanyard: true }),
      {
        id: 'realestate-engineer',
        name: generateCharacterName(false, 132),
        role: 'Lead Structural Engineer',
        department: `${re.name} · Construction BIM`,
        seniority: 'Senior',
        accentColor: re.accent,
        personality: pickPersonality(132),
        topicKey: 'realestate',
      },
      'Construction CAD & Interior Atelier', M
    );
    this.spawnActor(
      'realestate', 0, re.cx + 5.6, re.cz - 3.6, Math.PI / 4, 'inspectPanel',
      nextPersonOpts(true, 0x8338ec, { outfit: 'blouseSkirt', lanyard: true }),
      {
        id: 'realestate-interior',
        name: generateCharacterName(true, 133),
        role: 'Interior Design Director',
        department: `${re.name} · Material Atelier`,
        seniority: 'Lead',
        accentColor: re.accent,
        personality: pickPersonality(133),
        topicKey: 'realestate',
      },
      'Construction CAD & Interior Atelier', M
    );
    this.spawnActor(
      'realestate', 0, re.cx + 0.2, re.cz + 3.9, Math.PI, 'standCounter',
      nextPersonOpts(false, 0x1e293b, { outfit: 'shirtTrousers', lanyard: true }),
      {
        id: 'realestate-concierge',
        name: generateCharacterName(false, 134),
        role: 'Turnkey Project Concierge',
        department: `${re.name} · Reception`,
        accentColor: re.accent,
        personality: pickPersonality(134),
        topicKey: 'realestate',
      },
      '3-in-1 Reception & Pipeline', M
    );
    this.spawnActor(
      'realestate', 0, re.cx - 4.1, re.cz - 0.8, -Math.PI / 2, 'stand',
      nextPersonOpts(true),
      {
        id: 'realestate-client',
        name: generateCharacterName(true, 135),
        role: 'Homebuyer & Fit-Out Client',
        department: `${re.name} · 3D Scale Model`,
        accentColor: re.accent,
        personality: pickPersonality(135),
        topicKey: 'client',
      },
      'Real Estate Masterplan Gallery', M, 0.96
    );

    // Upper floor office staff across all district buildings (staff every registered desk chair)
    const upperPoses = ['type', 'sitPhone', 'monitorLook'];
    for (const [bId, handle] of this.buildings) {
      const spec = handle.spec;
      for (let lv = 1; lv < spec.floors; lv++) {
        const floorChairs = handle.chairs.filter((c) => c.lv === lv);
        const count = floorChairs.length;
        for (let ci = 0; ci < count; ci++) {
          const ch = floorChairs[ci];
          const fem = (lv + ci) % 2 === 1;
          this.spawnActor(
            bId, lv, ch.restX, ch.restZ, ch.restRot, upperPoses[ci % upperPoses.length],
            nextPersonOpts(fem, undefined, { lanyard: true }),
            {
              id: `${bId}-u-${lv}-${ci}`,
              name: generateCharacterName(fem, seedCounter + lv * 11 + ci),
              role: `Operations & Comms · L${lv}`,
              department: `${spec.name} · Level ${lv}`,
              seniority: ci === 0 ? 'Senior' : 'Junior',
              accentColor: spec.accent,
              personality: pickPersonality(seedCounter + lv + ci),
              topicKey: bId,
            },
            `Level ${lv} Operations`, M
          );
        }
      }
    }
  }

  private populateStreetWalkers(M: MaterialLibrary) {
    const P = this.P_LIB;
    const routes: Array<{
      name: string;
      fem: boolean;
      role: string;
      accent: string;
      pts: Array<{ x: number; z: number; wait?: number }>;
      shelter: NonNullable<DistrictActor['shelter']>;
    }> = [
      {
        name: generateCharacterName(true, 301),
        fem: true,
        role: 'District Visitor',
        accent: '#f59e0b',
        pts: [
          { x: -16, z: 14.5, wait: 1.5 },
          { x: 0, z: 15.2, wait: 2 },
          { x: 16, z: 14.5, wait: 1.5 },
          { x: 0, z: 15.2, wait: 1.5 },
        ],
        shelter: { buildingId: 'hub', entryX: 0, entryZ: 13.0, x: -4.8, z: 7.4, face: 0, label: 'DomainTechHub Lobby' },
      },
      {
        name: generateCharacterName(false, 302),
        fem: false,
        role: 'Banking & Bistro Pedestrian',
        accent: '#3b82f6',
        pts: [
          { x: -90, z: 9.6, wait: 2 },
          { x: -57, z: 9.8, wait: 1.5 },
          { x: -32, z: 9.8, wait: 1 },
          { x: -32, z: 54.5, wait: 1 },
          { x: -32, z: 83.0, wait: 2 },
          { x: -48, z: 83.0, wait: 2.5 },
          { x: -32, z: 83.0, wait: 1 },
          { x: -32, z: 9.8, wait: 1 },
        ],
        shelter: { buildingId: 'restaurant', entryX: -57, entryZ: 7.8, x: -58.2, z: 4.5, face: 0, label: 'Savanna Bistro Lobby' },
      },
      {
        name: generateCharacterName(true, 303),
        fem: true,
        role: 'Travel & Safari Guest',
        accent: '#84cc16',
        pts: [
          { x: -48, z: 83.0, wait: 2 },
          { x: 0, z: 83.0, wait: 2.5 },
          { x: 30, z: 83.0, wait: 1.5 },
          { x: 0, z: 83.0, wait: 1.5 },
        ],
        shelter: { buildingId: 'tourism', entryX: 0, entryZ: 83.4, x: 0, z: 86.4, face: Math.PI, label: 'Kenya Safari Lobby' },
      },
      {
        name: generateCharacterName(false, 304),
        fem: false,
        role: 'Crosswalk Commuter',
        accent: '#10b981',
        pts: [
          { x: 90, z: 9.6, wait: 2 },
          { x: 57, z: 9.8, wait: 1.5 },
          { x: 32, z: 9.8, wait: 1 },
          { x: 32, z: 54.5, wait: 1 },
          { x: 32, z: 83.0, wait: 2 },
          { x: 54, z: 83.0, wait: 2.5 },
          { x: 32, z: 83.0, wait: 1 },
          { x: 32, z: 9.8, wait: 1 },
        ],
        shelter: { buildingId: 'dealership', entryX: 57, entryZ: 7.8, x: 57, z: 4.4, face: 0, label: 'Apex Motors Showroom' },
      },
      {
        name: generateCharacterName(true, 305),
        fem: true,
        role: 'Healthcare Visitor',
        accent: '#2dd4bf',
        pts: [
          { x: -32.2, z: 13.5, wait: 1 },
          { x: -32.2, z: -18.5, wait: 1 },
          { x: 0, z: -18.5, wait: 2.5 },
          { x: 32.2, z: -18.5, wait: 1 },
          { x: 32.2, z: 13.5, wait: 1.5 },
          { x: -32.2, z: 13.5, wait: 1 },
        ],
        shelter: { buildingId: 'medical', entryX: 0, entryZ: -19.2, x: -2.2, z: -24.5, face: 0, label: 'VitalCare Medical Hall' },
      },
      {
        name: generateCharacterName(false, 306),
        fem: false,
        role: 'Courier & Dispatch Coordinator',
        accent: '#f97316',
        pts: [
          { x: 42, z: 83.0, wait: 2 },
          { x: 54, z: 83.0, wait: 2.5 },
          { x: 68, z: 83.0, wait: 2 },
          { x: 54, z: 83.0, wait: 1.5 },
        ],
        shelter: { buildingId: 'logistics', entryX: 54, entryZ: 83.4, x: 54, z: 86.6, face: Math.PI, label: 'SwiftPort Logistics Lobby' },
      },
      {
        name: generateCharacterName(true, 307),
        fem: true,
        role: 'Property & Design Client',
        accent: '#e07a5f',
        pts: [
          { x: -94, z: 84.0, wait: 2 },
          { x: -84, z: 84.0, wait: 2.5 },
          { x: -64, z: 84.0, wait: 1.5 },
          { x: -84, z: 84.0, wait: 1.5 },
        ],
        shelter: { buildingId: 'realestate', entryX: -84, entryZ: 84.4, x: -84, z: 87.2, face: Math.PI, label: 'TerraCraft Build & Estates' },
      },
    ];

    routes.forEach((rt, idx) => {
      const start = rt.pts[0];
      const p = this.spawnActor(
        'street', 0, start.x, start.z, Math.PI / 2, 'stand',
        {
          skin: P.skins[(idx + 1) % P.skins.length],
          shirt: P.shirts[(idx * 3) % P.shirts.length],
          hair: P.hairs[idx % P.hairs.length],
          trou: P.trous[(idx * 2) % P.trous.length],
          fem: rt.fem,
          hairStyle: rt.fem ? 'braids' : 'fade',
          outfit: rt.fem ? 'blouseSkirt' : 'smartCasual',
          sneakers: true,
          s: rt.fem ? 0.96 : 1.02,
        },
        {
          id: `street-walker-${idx}`,
          name: rt.name,
          role: rt.role,
          department: 'Upper Hill Promenade',
          accentColor: rt.accent,
          personality: pickPersonality(310 + idx),
          topicKey: 'client',
        },
        'District Promenade', M, 1.15
      );
      p.waypoints = rt.pts;
      p.wpIndex = 1 % rt.pts.length;
      p.waitTimer = 0;
      p.shelter = rt.shelter;
      p.shelterPhase = 'patrol';
    });
  }

  private streetElevationAt(x: number, z: number, shelter?: DistrictActor['shelter']): number {
    if (!shelter) return -0.608;
    if (shelter.buildingId === 'hub') {
      if (Math.abs(x) <= 12.5 && z <= 11.2) return 0;
      if (Math.abs(x) <= 12.5 && z < 14.0) {
        return THREE.MathUtils.lerp(0, -0.608, (z - 11.2) / 2.8);
      }
      return -0.608;
    }
    const spec = DISTRICT_BUILDING_MAP[shelter.buildingId];
    if (
      Math.abs(x - spec.cx) <= spec.w * 0.5 &&
      Math.abs(z - spec.cz) <= spec.d * 0.5
    ) {
      return spec.groundY + 0.12;
    }
    return -0.608;
  }

  private isBuildingOpen(bId: BuildingId, simMin: number): boolean {
    if (bId === 'medical' || bId === 'crypto') return true; // 24-hour facilities
    if (bId === 'restaurant') return simMin >= 420 && simMin < 1350; // 07:00 – 22:30
    return simMin >= 450 && simMin < 1110; // 07:30 – 18:30 commercial hours
  }

  public snapAll(simMin: number, weather: WeatherCondition = 'clear') {
    for (const pair of this.chairPairs) {
      const ch = pair.handle;
      ch.curX = ch.restX;
      ch.curZ = ch.restZ;
      ch.curRot = ch.restRot;
      ch.group.position.x = ch.restX;
      ch.group.position.z = ch.restZ;
      ch.group.rotation.y = ch.restRot;
      pair.collider.curX = ch.restX;
      pair.collider.curZ = ch.restZ;
    }

    const badWeather = weather === 'rain' || weather === 'storm' || weather === 'snow';
    const streetDaytime = simMin >= 390 && simMin < 1320;

    for (const a of this.ACTORS) {
      if (a.buildingId === 'street') {
        a.g.visible = streetDaytime;
        a.waitTimer = 0;
        if (badWeather && a.shelter) {
          a.shelterPhase = 'sheltered';
          const sy = this.streetElevationAt(a.shelter.x, a.shelter.z, a.shelter);
          a.g.position.set(a.shelter.x, sy, a.shelter.z);
          a.yaw = a.tyaw = a.shelter.face;
          a.g.rotation.y = a.shelter.face;
          this.setSafePose(a, 'standPhone');
          if (a.brain) {
            setBrainThought(
              a.brain,
              'Relaxed',
              `Sheltering inside ${a.shelter.label}`,
              weather === 'snow'
                ? `Waiting indoors out of the cold snowfall inside ${a.shelter.label}.`
                : `Stepped inside ${a.shelter.label} to stay dry while it passes.`
            );
          }
        } else {
          a.shelterPhase = 'patrol';
          a.g.position.set(a.homeX, -0.608, a.homeZ);
          a.wpIndex = 1;
          this.setSafePose(a, 'stand');
        }
        continue;
      }
      const open = this.isBuildingOpen(a.buildingId, simMin);
      a.mode = 'home';
      a.queue = [];
      a.stuckTime = 0;
      a.replanCount = 0;
      a.g.visible = open;
      if (open) {
        const spec = DISTRICT_BUILDING_MAP[a.buildingId];
        a.g.position.set(a.homeX, this.floorSurfaceY(spec, a.lv, a.homeX, a.homeZ), a.homeZ);
        a.yaw = a.tyaw = a.homeFace;
        a.g.rotation.y = a.homeFace;
        this.setSafePose(a, a.homePose);
      } else {
        this.setSafePose(a, 'stand');
      }
    }
  }

  private walkStep(a: DistrictActor, gx: number, gz: number, dt: number, ignoreChair?: TrackedChairCollider): boolean {
    const dx = gx - a.g.position.x;
    const dz = gz - a.g.position.z;
    const dist = Math.hypot(dx, dz);

    const clampSafe = (x: number, z: number): { x: number; z: number } => {
      if (a.buildingId === 'street') return { x, z };
      const res = resolveDistrictObstacle(a.buildingId, a.lv, x, z, { ignoreChair });
      return { x: res.x, z: res.z };
    };

    if (dist < 0.09) {
      const safe = clampSafe(gx, gz);
      a.g.position.x = safe.x;
      a.g.position.z = safe.z;
      if (a.buildingId !== 'street') {
        a.g.position.y = this.floorSurfaceY(DISTRICT_BUILDING_MAP[a.buildingId], a.lv, safe.x, safe.z);
      }
      a.moving = false;
      return true;
    }

    const totalStep = Math.min(dist, a.walkSpeed * dt);
    const subs = Math.max(1, Math.ceil(totalStep / 0.08));
    const subLen = totalStep / subs;
    const ux = dx / dist;
    const uz = dz / dist;

    let nx = a.g.position.x;
    let nz = a.g.position.z;
    for (let s = 0; s < subs; s++) {
      const safe = clampSafe(nx + ux * subLen, nz + uz * subLen);
      nx = safe.x;
      nz = safe.z;
    }

    // Gentle separation from nearby actors on same floor
    const minSep = 0.48;
    const minSepSq = minSep * minSep;
    for (let i = 0; i < this.ACTORS.length; i++) {
      const o = this.ACTORS[i];
      if (o === a || !o.g.visible || Math.abs(o.g.position.y - a.g.position.y) > 0.6) continue;
      const sx = nx - o.g.position.x;
      const sz = nz - o.g.position.z;
      const dSq = sx * sx + sz * sz;
      if (dSq < minSepSq) {
        const d = Math.sqrt(dSq);
        if (d > 0.002) {
          const pushed = clampSafe(o.g.position.x + (sx / d) * minSep, o.g.position.z + (sz / d) * minSep);
          nx = pushed.x;
          nz = pushed.z;
        }
      }
    }

    a.g.position.x = nx;
    a.g.position.z = nz;
    if (a.buildingId === 'street') {
      a.g.position.y = this.streetElevationAt(nx, nz, a.shelter);
    } else {
      a.g.position.y = this.floorSurfaceY(DISTRICT_BUILDING_MAP[a.buildingId], a.lv, nx, nz);
    }
    a.tyaw = Math.atan2(dx, dz);
    a.moving = true;

    if (Math.hypot(gx - nx, gz - nz) < 0.11) {
      a.moving = false;
      return true;
    }
    return false;
  }

  private getFloorWalkSpots(bId: BuildingId, lv: number): Array<{ x: number; z: number; face: number; pose: string }> {
    const spec = DISTRICT_BUILDING_MAP[bId];
    if (lv > 0) {
      return [
        { x: spec.cx - spec.w * 0.25, z: spec.cz + spec.d * 0.22, face: 0, pose: 'stand' },
        { x: spec.cx, z: spec.cz + spec.d * 0.24, face: Math.PI, pose: 'hold' },
        { x: spec.cx + spec.w * 0.25, z: spec.cz + spec.d * 0.22, face: 0, pose: 'readDoc' },
      ];
    }
    if (bId === 'restaurant') {
      return [
        { x: spec.cx - 1.2, z: spec.cz + 6.5, face: 0, pose: 'stand' },
        { x: spec.cx + 6.8, z: spec.cz - 2.2, face: Math.PI / 2, pose: 'coffee' },
        { x: spec.cx - 1.5, z: spec.cz + 2.5, face: Math.PI, pose: 'hold' },
        { x: spec.doorX, z: spec.doorZ + 1.8, face: 0, pose: 'stand' },
      ];
    }
    if (bId === 'dealership') {
      return [
        { x: spec.cx - 3.8, z: spec.cz + 0.4, face: Math.PI / 2, pose: 'hold' },
        { x: spec.cx + 3.8, z: spec.cz + 0.4, face: -Math.PI / 2, pose: 'stand' },
        { x: spec.cx, z: spec.cz + 6.4, face: Math.PI, pose: 'readDoc' },
      ];
    }
    if (bId === 'bank') {
      return [
        { x: spec.cx - 6.5, z: spec.cz + 4.4, face: 0, pose: 'stand' },
        { x: spec.cx + 2.5, z: spec.cz + 2.2, face: Math.PI, pose: 'hold' },
        { x: spec.cx + 4.2, z: spec.cz + 3.2, face: Math.PI / 2, pose: 'standPhone' },
      ];
    }
    if (bId === 'crypto') {
      return [
        { x: spec.cx, z: spec.cz + 4.2, face: Math.PI, pose: 'hold' },
        { x: spec.cx - 3.4, z: spec.cz - 4.8, face: Math.PI / 2, pose: 'inspectPanel' },
        { x: spec.cx + 3.4, z: spec.cz - 4.8, face: -Math.PI / 2, pose: 'readDoc' },
      ];
    }
    if (bId === 'travel') {
      return [
        { x: spec.cx + 2.6, z: spec.cz - 2.0, face: -Math.PI / 2, pose: 'stand' },
        { x: spec.cx - 2.6, z: spec.cz - 2.0, face: Math.PI / 2, pose: 'hold' },
        { x: spec.cx, z: spec.cz + 4.6, face: 0, pose: 'standPhone' },
      ];
    }
    if (bId === 'tourism') {
      return [
        { x: spec.cx - 2.6, z: spec.cz - 0.8, face: -Math.PI / 2, pose: 'talk' },
        { x: spec.cx + 2.2, z: spec.cz - 1.0, face: Math.PI / 2, pose: 'hold' },
        { x: spec.cx, z: spec.cz + 4.5, face: 0, pose: 'readDoc' },
      ];
    }
    if (bId === 'logistics') {
      return [
        { x: spec.cx - 1.5, z: spec.cz - 3.5, face: -Math.PI / 2, pose: 'inspectPanel' },
        { x: spec.cx + 1.0, z: spec.cz + 1.5, face: 0, pose: 'hold' },
        { x: spec.cx + 9.2, z: spec.cz - 2.0, face: Math.PI / 2, pose: 'readDoc' },
      ];
    }
    // medical
    return [
      { x: medX(spec, -10.5), z: spec.cz + 1.4, face: Math.PI, pose: 'hold' },
      { x: medX(spec, -2.5), z: spec.cz + 2.8, face: Math.PI, pose: 'stand' },
      { x: medX(spec, 6.0), z: spec.cz - 2.2, face: 0, pose: 'readDoc' },
    ];
  }

  private decideFreeWill(a: DistrictActor, forceMove = false) {
    if (a.buildingId === 'street' || !a.brain) return;
    const bId = a.buildingId;
    const brain = a.brain;

    if (a.mode === 'home') {
      brain.energy = Math.max(22, brain.energy - 6);
      brain.focus = Math.min(98, brain.focus + 4);
    } else {
      brain.energy = Math.min(98, brain.energy + 9);
    }

    const r = Math.random();
    let goal: FreeGoal = 'work';
    if (forceMove || a.mode === 'home') {
      if (!forceMove && r < 0.52) goal = 'work';
      else if (r < 0.72) goal = 'stretch';
      else if (r < 0.88) goal = 'balcony';
      else goal = 'socialize';
    } else {
      goal = r < 0.75 && !forceMove ? 'work' : 'balcony';
    }

    const curX = a.g.position.x;
    const curZ = a.g.position.z;
    const dock = a.chair ? getDistrictChairDockPoint(bId, a.lv, a.homeX, a.homeZ, a.chair.swivelDir) : null;
    const leaveWithDock = (dx: number, dz: number) => {
      if (dock && Math.hypot(curX - a.homeX, curZ - a.homeZ) < 0.7) {
        return [dock, ...buildDistrictPath(bId, a.lv, dock.x, dock.z, dx, dz, { ignoreChair: a.chairCollider })];
      }
      return buildDistrictPath(bId, a.lv, curX, curZ, dx, dz, { ignoreChair: a.chairCollider });
    };

    a.stuckTime = 0;
    a.replanCount = 0;
    a.lastX = curX;
    a.lastZ = curZ;

    if (goal === 'work') {
      brain.goal = 'work';
      const tp = pickThoughtForGoal(brain, 'work');
      setBrainThought(brain, tp.mood, tp.actionLabel, tp.thought);
      brain.nextDecisionIn = 12 + Math.random() * 14;
      if (Math.hypot(curX - a.homeX, curZ - a.homeZ) > 0.2) {
        a.mode = 'toHome';
        a.queue = dock
          ? [...buildDistrictPath(bId, a.lv, curX, curZ, dock.x, dock.z, { ignoreChair: a.chairCollider }), { x: a.homeX, z: a.homeZ }]
          : buildDistrictPath(bId, a.lv, curX, curZ, a.homeX, a.homeZ, { ignoreChair: a.chairCollider });
        a.targetPose = a.homePose;
        a.targetFace = a.homeFace;
        this.setSafePose(a, 'stand');
      } else {
        a.mode = 'home';
        a.queue = [];
        a.g.position.x = a.homeX;
        a.g.position.z = a.homeZ;
        a.tyaw = a.homeFace;
        this.setSafePose(a, a.homePose);
      }
      return;
    }

    brain.goal = goal;
    const tp = pickThoughtForGoal(brain, goal);
    setBrainThought(brain, tp.mood, tp.actionLabel, tp.thought);
    brain.nextDecisionIn = 8 + Math.random() * 10;

    if (goal === 'stretch' && dock) {
      a.mode = 'toGoal';
      a.queue = Math.hypot(curX - dock.x, curZ - dock.z) > 0.2 ? leaveWithDock(dock.x, dock.z) : [];
      a.targetPose = 'hold';
      a.targetFace = 0;
    } else {
      const spots = this.getFloorWalkSpots(bId, a.lv);
      const valid = spots.filter((s) => !resolveDistrictObstacle(bId, a.lv, s.x, s.z).blocked);
      const chosen = valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)] : spots[0];
      a.mode = 'toGoal';
      a.queue = Math.hypot(curX - chosen.x, curZ - chosen.z) > 0.25 ? leaveWithDock(chosen.x, chosen.z) : [];
      a.targetPose = chosen.pose;
      a.targetFace = chosen.face;
    }

    if (a.queue.length === 0) {
      a.mode = 'atGoal';
      a.tyaw = a.targetFace;
      this.setSafePose(a, a.targetPose);
    } else {
      this.setSafePose(a, 'stand');
    }
  }

  public nudgeCharacter(actor: PersonActor) {
    const a = actor as DistrictActor;
    if (!a || a.buildingId === 'street' || !a.brain) return;
    this.decideFreeWill(a, true);
  }

  public nudgeCompany(bId: BuildingId) {
    const job = socialNetwork.getActiveJobForBuilding(bId);
    const candidates = this.ACTORS.filter(
      (a) => a.buildingId === bId && a.g.visible && a.brain && a.mode === 'home' && a.modes
    );
    const actor = candidates[0];
    if (!actor || !actor.brain) return;
    if (actor.modes) {
      this.setSafePose(actor, Math.random() < 0.55 ? 'type' : 'sitPhone');
    }
    if (job) {
      setBrainThought(
        actor.brain,
        job.priority === 'Urgent' ? 'Alert' : 'Focused',
        `Processing ${job.code} via ${job.platform.toUpperCase()}`,
        `Picked up ${job.code} (${job.title}) from ${job.fromName} on my console.`
      );
    }
  }

  private updateChairs(dt: number) {
    const k = 1 - Math.exp(-dt * 6.5);
    for (let i = 0; i < this.chairPairs.length; i++) {
      const pair = this.chairPairs[i];
      const ch = pair.handle;
      const col = pair.collider;
      const floorY = ch.groundY + ch.lv * ch.floorH + 0.12;

      let targetPull = 0;
      let targetSwivel = 0;

      for (let j = 0; j < pair.occupants.length; j++) {
        const occ = pair.occupants[j];
        if (!occ.g.visible) continue;
        if (Math.abs(occ.g.position.y - floorY) > 0.45) continue;
        const d = Math.hypot(occ.g.position.x - ch.restX, occ.g.position.z - ch.restZ);
        if (SEATED_POSES.has(occ.pose) && d < 0.16) {
          targetPull = 0;
          targetSwivel = 0;
          break;
        }
        if (d < 1.05 && !SEATED_POSES.has(occ.pose)) {
          targetPull = Math.min(ch.maxPush * 0.78, 0.36);
          targetSwivel = ch.swivelDir * 0.55;
        }
      }

      const backX = -Math.sin(ch.restRot);
      const backZ = -Math.cos(ch.restRot);
      const tx = ch.restX + backX * targetPull;
      const tz = ch.restZ + backZ * targetPull;
      const trot = ch.restRot + targetSwivel;

      ch.curX += (tx - ch.curX) * k;
      ch.curZ += (tz - ch.curZ) * k;
      ch.curRot += (trot - ch.curRot) * k;

      const offX = ch.curX - ch.restX;
      const offZ = ch.curZ - ch.restZ;
      const offLen = Math.hypot(offX, offZ);
      if (offLen > ch.maxPush) {
        const sc = ch.maxPush / offLen;
        ch.curX = ch.restX + offX * sc;
        ch.curZ = ch.restZ + offZ * sc;
      }

      ch.group.position.x = ch.curX;
      ch.group.position.z = ch.curZ;
      ch.group.rotation.y = ch.curRot;
      col.curX = ch.curX;
      col.curZ = ch.curZ;
    }
  }

  public setCutaway(buildingId: BuildingId, minY: number | null, maxY: number | null) {
    this.cutawayBuildingId = buildingId;
    this.cutawayMinY = minY;
    this.cutawayMaxY = maxY;
  }

  public setStaffVisible(visible: boolean) {
    this.staffVisible = visible;
    this.peopleGroup.visible = visible;
  }

  public update(dt: number, t: number, simMin: number, camera: THREE.Camera, weather: WeatherCondition = 'clear') {
    // Animate showroom car turntable, travel globe & medical cross beacon
    for (const [, handle] of this.buildings) {
      for (const rp of handle.rotatingProps) {
        rp.obj.rotation[rp.axis] += dt * rp.speed;
      }
    }

    if (!this.staffVisible) return;

    this.updateChairs(dt);

    const badWeather = weather === 'rain' || weather === 'storm' || weather === 'snow';
    const streetDaytime = simMin >= 390 && simMin < 1320;

    for (let i = 0; i < this.ACTORS.length; i++) {
      const a = this.ACTORS[i];

      if (a.buildingId === 'street') {
        a.g.visible = streetDaytime;
        if (!streetDaytime) continue;
        for (let c = 0; c < a.g.children.length; c++) a.g.children[c].visible = true;

        const sh = a.shelter;
        const moveWithSignal = (tx: number, tz: number, speedMult = 1): boolean => {
          const curX = a.g.position.x;
          const curZ = a.g.position.z;
          // Check if crossing boulevard (ROAD_Z = 66, curbs at 58.5 and 73.5)
          const northOfRoad = curZ < ROAD_Z - 7.8;
          const southOfRoad = curZ > ROAD_Z + 7.8;
          const wantsSouth = northOfRoad && tz > ROAD_Z - 5.5;
          const wantsNorth = southOfRoad && tz < ROAD_Z + 5.5;
          if ((wantsSouth || wantsNorth) && this.trafficLights && !this.trafficLights.canPedestrianCross(curX)) {
            const curbZ = wantsSouth ? ROAD_Z - 8.15 : ROAD_Z + 8.15;
            if (Math.abs(curZ - curbZ) > 0.35) {
              const prevSpd = a.walkSpeed;
              a.walkSpeed = prevSpd * speedMult;
              this.walkStep(a, tx, curbZ, dt);
              a.walkSpeed = prevSpd;
            } else {
              a.moving = false;
              a.tyaw = wantsSouth ? 0 : Math.PI;
              this.setSafePose(a, 'stand');
              if (a.brain && a.brain.actionLabel !== 'Waiting at pedestrian signal') {
                setBrainThought(
                  a.brain,
                  'Focused',
                  'Waiting at pedestrian signal',
                  'Holding on the curb at the red Walk signal until boulevard traffic stops.'
                );
              }
            }
            return false;
          }
          const prevSpd = a.walkSpeed;
          a.walkSpeed = prevSpd * speedMult;
          const done = this.walkStep(a, tx, tz, dt);
          a.walkSpeed = prevSpd;
          return done;
        };

        if (badWeather && sh) {
          if (a.shelterPhase !== 'sheltered') {
            if (a.shelterPhase === 'patrol' || a.shelterPhase === 'toExit') {
              a.shelterPhase = 'toEntry';
              if (a.brain) {
                setBrainThought(
                  a.brain,
                  'Alert',
                  `Hurrying inside ${sh.label}`,
                  weather === 'snow'
                    ? `Snow started falling—heading inside ${sh.label} to warm up.`
                    : `Caught in the ${weather}—hurrying indoors into ${sh.label}.`
                );
              }
            }
            if (a.shelterPhase === 'toEntry') {
              if (a.pose !== 'stand') this.setSafePose(a, 'stand');
              if (moveWithSignal(sh.entryX, sh.entryZ, 1.45)) {
                a.shelterPhase = 'toShelter';
              }
            } else if (a.shelterPhase === 'toShelter') {
              if (a.pose !== 'stand') this.setSafePose(a, 'stand');
              if (this.walkStep(a, sh.x, sh.z, dt)) {
                a.shelterPhase = 'sheltered';
                a.moving = false;
                a.tyaw = sh.face;
                this.setSafePose(a, 'standPhone');
                if (a.brain) {
                  setBrainThought(
                    a.brain,
                    'Relaxed',
                    `Sheltering inside ${sh.label}`,
                    weather === 'snow'
                      ? `Waiting comfortably inside ${sh.label} out of the snowfall.`
                      : `Waiting comfortably inside ${sh.label} until the ${weather} lets up.`
                  );
                }
              }
            }
          } else {
            a.moving = false;
            a.tyaw = sh.face;
            if (a.pose !== 'standPhone') this.setSafePose(a, 'standPhone');
          }
        } else {
          if (a.shelterPhase === 'sheltered' || a.shelterPhase === 'toShelter' || a.shelterPhase === 'toEntry') {
            a.shelterPhase = 'toExit';
            if (a.brain) {
              setBrainThought(
                a.brain,
                'Relaxed',
                'Stepping back outside to promenade',
                'Skies cleared up—heading back out onto the Upper Hill promenade.'
              );
            }
          }
          if (a.shelterPhase === 'toExit' && sh) {
            if (a.pose !== 'stand') this.setSafePose(a, 'stand');
            if (this.walkStep(a, sh.entryX, sh.entryZ, dt)) {
              a.shelterPhase = 'patrol';
            }
          } else if (a.waypoints && a.waypoints.length > 0) {
            if ((a.waitTimer || 0) > 0) {
              a.waitTimer! -= dt;
              a.moving = false;
            } else {
              if (a.pose !== 'stand') this.setSafePose(a, 'stand');
              const pt = a.waypoints[a.wpIndex || 0];
              if (moveWithSignal(pt.x, pt.z, 1)) {
                a.waitTimer = pt.wait || 1.5;
                a.wpIndex = ((a.wpIndex || 0) + 1) % a.waypoints.length;
              }
            }
          }
        }
        updatePersonKinematics(a, dt, t, 0);
        continue;
      }

      const shouldBeOpen = this.isBuildingOpen(a.buildingId, simMin);
      a.g.visible = shouldBeOpen;
      if (!shouldBeOpen) continue;

      // Step autonomous behavior inside building
      if (a.queue.length > 0) {
        const next = a.queue[0];
        const distHome = Math.hypot(a.g.position.x - a.homeX, a.g.position.z - a.homeZ);
        const nearHomeTarget = Math.hypot(next.x - a.homeX, next.z - a.homeZ) < 0.25;
        const ignoreChair = distHome < 0.85 || nearHomeTarget ? a.chairCollider : undefined;

        const reached = this.walkStep(a, next.x, next.z, dt, ignoreChair);
        const moved = Math.hypot(a.g.position.x - a.lastX, a.g.position.z - a.lastZ);
        a.lastX = a.g.position.x;
        a.lastZ = a.g.position.z;
        a.stuckTime = moved < 0.08 * dt ? a.stuckTime + dt : 0;

        if (reached) {
          a.stuckTime = 0;
          a.replanCount = 0;
          a.queue.shift();
          if (a.queue.length === 0) {
            if (a.mode === 'toHome') {
              a.g.position.x = a.homeX;
              a.g.position.z = a.homeZ;
            }
            a.tyaw = a.targetFace;
            this.setSafePose(a, a.targetPose);
            a.mode = a.mode === 'toHome' ? 'home' : 'atGoal';
          }
        } else if (a.stuckTime > 1.0) {
          a.stuckTime = 0;
          a.replanCount++;
          const dest = a.queue[a.queue.length - 1];
          if (a.replanCount <= 2 && dest) {
            a.queue = buildDistrictPath(a.buildingId, a.lv, a.g.position.x, a.g.position.z, dest.x, dest.z, {
              ignoreChair: a.chairCollider,
            });
          } else {
            this.decideFreeWill(a, false);
          }
        }
      } else if (a.brain) {
        if (a.mode === 'home' && a.modes) {
          a.timer -= dt;
          if (a.timer <= 0) {
            a.timer = 4.5 + Math.random() * 5.0;
            this.setSafePose(a, pickMode(a.modes));
          }
        }
        a.brain.nextDecisionIn -= dt;
        if (a.brain.nextDecisionIn <= 0) {
          this.decideFreeWill(a, false);
        }
      }

      // Floor cutaway hiding on active inspected district building
      let visibleInCutaway = true;
      if (this.cutawayBuildingId === a.buildingId && this.cutawayMaxY !== null) {
        const py = a.g.position.y;
        visibleInCutaway =
          (this.cutawayMinY === null || py >= this.cutawayMinY) && py <= this.cutawayMaxY;
      }
      for (let c = 0; c < a.g.children.length; c++) {
        a.g.children[c].visible = visibleInCutaway;
      }
      if (!visibleInCutaway) continue;

      let glance = 0;
      this._v1.subVectors(camera.position, a.g.position);
      if (this._v1.lengthSq() < 49) {
        const ty = Math.atan2(this._v1.x, this._v1.z);
        const dy = Math.atan2(Math.sin(ty - a.yaw), Math.cos(ty - a.yaw));
        if (Math.abs(dy) < 1.1) glance = dy * 0.4;
      }
      updatePersonKinematics(a, dt, t, glance);
    }
  }

  public getActiveCount(): number {
    if (!this.staffVisible) return 0;
    let c = 0;
    for (const a of this.ACTORS) if (a.g.visible) c++;
    return c;
  }

  public getFloorActivity(bId: BuildingId, activeLevel: string): FloorActivitySummary | null {
    if (activeLevel === 'overview' || activeLevel === 'tour' || activeLevel === 'walk') return null;
    const spec = DISTRICT_BUILDING_MAP[bId];
    if (activeLevel === 'roof') {
      return {
        levelTitle: `${spec.shortName} · Roof Deck`,
        activeCount: 0,
        zones: [
          {
            zone: `${spec.name} Roof`,
            color: spec.accent,
            count: 0,
            status:
              bId === 'medical'
                ? 'Rotating 24h Medical Cross Beacon active'
                : bId === 'realestate'
                  ? 'Rooftop tower crane & green pergola terrace active'
                  : 'HVAC plant & skylight housing',
          },
        ],
      };
    }
    const lv = Number(activeLevel);
    if (!Number.isInteger(lv) || lv < 0 || lv >= spec.floors) return null;

    const floorActors = this.staffVisible
      ? this.ACTORS.filter((a) => a.buildingId === bId && a.lv === lv && a.g.visible)
      : [];
    const byZone = new Map<string, DistrictActor[]>();
    for (const a of floorActors) {
      let arr = byZone.get(a.zoneName);
      if (!arr) {
        arr = [];
        byZone.set(a.zoneName, arr);
      }
      arr.push(a);
    }

    const zones: FloorZoneActivity[] = [];
    for (const [zone, list] of byZone) {
      const moving = list.filter((x) => x.moving).length;
      const seated = list.filter((x) => SEATED_POSES.has(x.pose)).length;
      const standing = list.length - moving - seated;
      const parts: string[] = [];
      if (seated > 0) parts.push(`${seated} at station`);
      if (standing > 0) parts.push(`${standing} serving`);
      if (moving > 0) parts.push(`${moving} moving`);
      zones.push({
        zone,
        color: spec.accent,
        count: list.length,
        status: parts.join(' · ') || 'Active',
      });
    }

    if (zones.length === 0) {
      zones.push({
        zone: lv === 0 ? `${spec.shortName} Main Hall` : `Level ${lv}`,
        color: spec.accent,
        count: 0,
        status: this.staffVisible ? 'Closed / after hours' : 'Staff hidden',
      });
    }

    return {
      levelTitle: lv === 0 ? `${spec.shortName} · Ground (G)` : `${spec.shortName} · Level ${lv}`,
      activeCount: floorActors.length,
      zones,
    };
  }

  public getMonitorWorkerStatus(
    bId: BuildingId,
    lv: number,
    seatX: number,
    seatZ: number
  ): { workerActivity: string; isOccupied: boolean } {
    const match = this.ACTORS.find(
      (a) =>
        a.buildingId === bId &&
        a.lv === lv &&
        a.g.visible &&
        Math.hypot(a.homeX - seatX, a.homeZ - seatZ) < 1.15
    );
    if (!match) {
      return { workerActivity: 'Workstation idle · after hours', isOccupied: false };
    }
    const atHome = match.mode === 'home';
    const activeJob = socialNetwork.getActiveJobForBuilding(bId);
    const jobSuffix = activeJob ? ` · ${activeJob.code} (${activeJob.progress}%)` : '';
    return {
      workerActivity: atHome
        ? `${match.roleLabel} operating console${jobSuffix}`
        : match.brain?.actionLabel || 'Stepped away briefly',
      isOccupied: atHome,
    };
  }
}

function medX(spec: DistrictBuildingSpec, ox: number): number {
  return spec.cx + ox;
}
