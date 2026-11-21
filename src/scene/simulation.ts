import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LiftCabState, OfficeChairHandle } from './architecture';
import type { AmbientSource } from './audio';
import {
  BASE,
  COLX,
  DEPTH,
  EXEC,
  FLOORS,
  GATE,
  GATE_STOP,
  LANE,
  LIFTX,
  liftY,
  LV,
  ROAD_Z,
  ROOMS,
  TOUR_TEXT,
  type FloorActivitySummary,
  type FloorZoneActivity,
  type HudSnapshot,
  type InspectedMonitor,
  type SelectedCharacterSnapshot,
  type TourStop,
} from './constants';
import {
  DISTRICT_BUILDINGS,
  DISTRICT_BUILDING_MAP,
  type BuildingId,
} from './districtData';
import type { DistrictBuildingHandle } from './districtBuildings';
import { DistrictSim } from './districtSim';
import {
  createGuideActor,
  createHumanPalette,
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
import {
  createCharacterBrain,
  generateCharacterName,
  pickPersonality,
  pickThoughtForGoal,
  setBrainThought,
  type CharacterIdentity,
  type FreeGoal,
} from './characterMind';
import type { MaterialLibrary } from './materials';
import { getRoundedBox, makeCar, updateCarVisualState, type CarRig } from './props';
import {
  buildObstacleAwarePath,
  clearTrackedChairs,
  getChairDockPoint,
  hasLineOfSight,
  registerTrackedChairsForFloor,
  resolveDistrictObstacle,
  resolveObstaclePosition,
  type TrackedChairCollider,
  type VehicleObb,
} from './obstacles';
import { plateTex } from './textures';

type WorkerActor = PersonActor & {
  d: (typeof ROOMS)[number];
  sh_shift: number;
  sd: number;
  seat: { x: number; z: number };
  state: 'atDesk' | 'toLift' | 'wait' | 'inCab' | 'toStairs' | 'onStairs' | 'out' | 'away' | 'toDesk';
  cab: number;
  ex: number;
  want: 'desk' | 'lunch' | 'home';
  lunch?: number;
  _arr?: number;
  _w2?: number;
  navQueue?: Array<{ x: number; z: number }>;
  navKey?: string;
  chair?: OfficeChairHandle;
  chairCollider?: TrackedChairCollider;
  stairLv?: number;
  stairDir?: 1 | -1;
  stairTargetLv?: number;
  stairQueue?: Array<{ x: number; z: number }>;
  stairJitter?: number;
  laneZ?: number;
};

type DayVisitorActor = PersonActor & {
  lv: number;
  dx: number;
  dz: number;
  df: number;
  dpose: string;
  sd: number;
  state: 'in' | 'wait' | 'inCab' | 'toStairs' | 'onStairs' | 'toDesk' | 'atDesk' | 'toLift' | 'out' | 'away';
  cab: number;
  _arr?: number;
  _w2?: number;
  navQueue?: Array<{ x: number; z: number }>;
  navKey?: string;
  chair?: OfficeChairHandle;
  chairCollider?: TrackedChairCollider;
  stairLv?: number;
  stairDir?: 1 | -1;
  stairTargetLv?: number;
  stairQueue?: Array<{ x: number; z: number }>;
  stairJitter?: number;
  laneZ?: number;
};

type StairTraveller = PersonActor & {
  stairLv?: number;
  stairDir?: 1 | -1;
  stairTargetLv?: number;
  stairQueue?: Array<{ x: number; z: number }>;
  stairJitter?: number;
  laneZ?: number;
};

type BasementCrewActor = PersonActor & {
  lv: -1 | -2;
  seniority: 'senior' | 'junior';
  roleLabel: string;
};

interface FreeAgentState {
  lv: number;
  homeX: number;
  homeZ: number;
  homeFace: number;
  homePose: string;
  mode: 'home' | 'toGoal' | 'atGoal' | 'toHome';
  queue: Array<{ x: number; z: number }>;
  targetPose: string;
  targetFace: number;
  walkSpeed: number;
  isDeskWorker: boolean;
  stuckTime: number;
  replanCount: number;
  lastX: number;
  lastZ: number;
  chair?: OfficeChairHandle;
  chairCollider?: TrackedChairCollider;
}

const DEPT_ROLE: Record<string, string> = {
  web: 'Full-Stack Engineer',
  front: 'UI/UX Front-End Engineer',
  cart: 'E-Commerce Engineer',
  wp: 'CMS & WordPress Specialist',
  seo: 'Technical SEO Strategist',
  mkt: 'Digital Marketing Analyst',
  ppc: 'Paid Search & Ads Specialist',
  wa: 'WhatsApp Automation Specialist',
  social: 'Social Media Strategist',
  crm: 'CRM Solutions Engineer',
  ai: 'AI & Automation Engineer',
  hand: 'Technology Consultant',
  sec: 'Systems & Security Engineer',
  mobile: 'Mobile App Engineer',
};

type TrafficVehicle = {
  g: THREE.Group;
  rig: CarRig;
  bm: THREE.MeshPhysicalMaterial;
  spd: number;
  cruiseSpd: number;
  vel: number;
  lane: number;
  x: number;
  dir: number;
  state: 'street' | 'toBay' | 'parked' | 'toGate' | 'toStreet';
  bay: CompanyBay | null;
  phase: number;
  steer: number;
  pitch: number;
  roll: number;
  brakeGlow: number;
  signalDir: -1 | 0 | 1;
  pauseTimer: number;
  in_t?: number;
  out_t?: number;
  errand?: { cycleMin: number; parkMin: number; offset: number };
  _arr?: number;
};

interface CompanyBay {
  company: BuildingId;
  sd: number;
  x: number;
  z: number;
  face: number;
  gateX: number;
  gateLane: number;
  exitLane: number;
  entryPts: Array<[number, number]>;
  exitPts: Array<[number, number]>;
}

export interface GuideTourStep {
  stop: TourStop;
  x: number;
  z: number;
  lv: number;
  face: number;
  camPos: THREE.Vector3;
  camTgt: THREE.Vector3;
}

const standX = (cx: number) => (cx < 0 ? -1 : 1) * Math.min(Math.abs(cx) + 3.2, GATE_STOP);

const DRV_X = 36.5;
const AISLE_Z = 29.75;
const LANE_WEST = ROAD_Z - 3.2;
const LANE_EAST = ROAD_Z + 3.2;
const STREET_END = 124;
const BAY_XS = [8.2, 11.7, 15.2, 18.7, 22.0];
const BAY_ROWS = [25, 34.5];
const CAR_COLS = [0x1c2432, 0x7b2329, 0x3b4854, 0xcfd3d6, 0x2c4237, 0x16171a, 0x7a6a58, 0x2e4a76];
const CAR_STYLES: Array<'sedan' | 'suv' | 'hatch' | 'van'> = ['sedan', 'suv', 'hatch', 'van'];

export class AtriumSimulation {
  private readonly scene: THREE.Scene;
  private readonly P_LIB: HumanPalette;
  private readonly cabs: Record<number, LiftCabState>;
  private readonly peopleGroup = new THREE.Group();
  private readonly trafficGroup = new THREE.Group();

  public readonly STAFF: PersonActor[] = [];
  private readonly WORKERS: WorkerActor[] = [];
  private readonly DAYONLY: DayVisitorActor[] = [];
  private readonly BASEMENT_STAFF: BasementCrewActor[] = [];
  private secOffActor!: PersonActor;
  private readonly freeAgents = new Map<PersonActor, FreeAgentState>();
  private readonly chairPairs: Array<{
    handle: OfficeChairHandle;
    collider: TrackedChairCollider;
    occupants: PersonActor[];
  }> = [];
  private readonly _walkVehicles: VehicleObb[] = [];
  private readonly TRAF: TrafficVehicle[] = [];
  private readonly LOT: CompanyBay[] = [];
  private readonly PLOCK: Array<{ x: number; z: number; r: number }> = [];

  public readonly guideActor: PersonActor;
  public readonly guideMarker: THREE.Group;
  public readonly guideMeshes: THREE.Mesh[];
  private readonly STOPS: TourStop[];

  // Simulation time state
  public simMin = 9 * 60 + 25;
  public simRate = 4; // 4x default so motion feels alive immediately
  private staffVisible = true;
  private staffToggling = false;
  private staffFade = 1;
  private staffFadeTgt = 1;

  // Tour state
  public tourOn = false;
  public tourPlay = false;
  public tourI = 0;
  private tourLv = 0;
  private tourSt: 'idle' | 'toLift' | 'waitCab' | 'toStairs' | 'onStairs' | 'toDest' | 'arrived' = 'idle';
  private tourArr = false;
  private tourHold = 0;
  private tourCab = 1;
  private tourSnap: { cam: THREE.Vector3; tgt: THREE.Vector3 } | null = null;
  private tourCam = { on: false, pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
  private guideNavQueue: Array<{ x: number; z: number }> = [];
  private guideNavKey = '';
  private guideStairLv = 0;
  private guideStairDir: 1 | -1 = 1;
  private guideStairQueue: Array<{ x: number; z: number }> | undefined;

  // First-person walk state
  public walkOn = false;
  public walkLocked = false;
  private walkBuildingId: BuildingId = 'hub';
  private walkFloor = 0;
  private walkPos = new THREE.Vector3(0, 1.65, 22);
  private walkYaw = 0;
  private walkPitch = 0;
  private walkKeys: Record<string, boolean> = {};
  private walkDrag = false;
  private walkLX = 0;
  private walkLY = 0;
  private walkJoy = { x: 0, y: 0 };
  private walkStep = 0;
  private savedCamPos = new THREE.Vector3(0, 20, 64);
  private savedCamTgt = new THREE.Vector3(0, 12.2, 4);
  private readonly onFootstep?: () => void;
  private readonly ambientSources: AmbientSource[] = [];
  private cutawayMinY: number | null = null;
  private cutawayMaxY: number | null = null;
  private weatherTimeMultiplier = 1.0;
  private readonly districtSim: DistrictSim;

  // Pre-allocated scratch vectors for zero-GC update loops
  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _v3 = new THREE.Vector3();
  private readonly _camDir = new THREE.Vector3();

  private cameraFlight: {
    pos: THREE.Vector3;
    tgt: THREE.Vector3;
    active: boolean;
  } = {
    pos: new THREE.Vector3(),
    tgt: new THREE.Vector3(),
    active: false,
  };

  constructor(
    scene: THREE.Scene,
    M: MaterialLibrary,
    cabs: Record<number, LiftCabState>,
    officeChairs: OfficeChairHandle[],
    districtBuildings: Map<BuildingId, DistrictBuildingHandle>,
    onFootstep?: () => void
  ) {
    this.scene = scene;
    this.P_LIB = createHumanPalette(M);
    this.cabs = cabs;
    this.onFootstep = onFootstep;

    clearTrackedChairs();
    const byFloor = new Map<number, TrackedChairCollider[]>();
    for (const ch of officeChairs) {
      const r =
        ch.lv === 4 && Math.abs(ch.restX) > 6
          ? 0.36
          : ch.lv === 5 && Math.abs(ch.restX - 13) < 0.5
            ? 0.36
            : (ch.lv === 4 && Math.abs(ch.restX) <= 6.2) || ch.lv === 5
              ? 0.35
              : 0.34;
      const collider: TrackedChairCollider = {
        restX: ch.restX,
        restZ: ch.restZ,
        curX: ch.curX,
        curZ: ch.curZ,
        r,
      };
      this.chairPairs.push({ handle: ch, collider, occupants: [] });
      let list = byFloor.get(ch.lv);
      if (!list) {
        list = [];
        byFloor.set(ch.lv, list);
      }
      list.push(collider);
    }
    for (const [lv, list] of byFloor) {
      registerTrackedChairsForFloor(lv, list);
    }

    scene.add(this.peopleGroup);
    scene.add(this.trafficGroup);

    // Initialize Cabs queue state
    [-1, 1].forEach((sd) => {
      this.cabs[sd].slots = [null, null];
      this.cabs[sd].ph = 'idle';
      this.cabs[sd].ex = 0;
      this.cabs[sd].bd = 0;
      this.cabs[sd].tm = 0;
      this.cabs[sd].stop = 0;
      this.cabs[sd].busy = false;
      this.cabs[sd].guide = false;
      this.cabs[sd].gw = false;
    });

    // Zuri Guided Tour actor
    const guide = createGuideActor(this.P_LIB, M);
    this.guideActor = guide.actor;
    this.guideMarker = guide.marker;
    this.guideMeshes = guide.meshes;
    this.guideActor.g.position.set(14.5, 0, 9.65);
    this.guideActor.tyaw = -0.3;
    setPose(this.guideActor, 'stand', this.P_LIB);
    this.peopleGroup.add(this.guideActor.g);
    this.attachBrain(
      this.guideActor,
      {
        id: 'guide-zuri',
        name: 'Zuri Mwangi',
        role: 'Lead Office Guide',
        department: 'Ground Atrium · Hospitality',
        seniority: 'Lead',
        accentColor: '#6fe3a1',
        personality: 'Warm & energetic storyteller',
        topicKey: 'guide',
        homeLv: 0,
        homeX: 14.5,
        homeZ: 9.65,
        homeFace: -0.3,
        homePose: 'stand',
      },
      false,
      1.15
    );

    this.STOPS = this.buildTourStops();
    this.populateOfficeStaff(M);
    this.bindChairsToStaff();
    this.districtSim = new DistrictSim(scene, M, this.P_LIB, districtBuildings);
    this.populateTrafficAndParking();
    this.initAmbientSources();
    this.snapAll();
  }

  private bindChairsToStaff() {
    const findChairPair = (lv: number, x: number, z: number) => {
      let best: (typeof this.chairPairs)[number] | null = null;
      let bestDist = 0.35;
      for (const pair of this.chairPairs) {
        if (pair.handle.lv !== lv) continue;
        const d = Math.hypot(pair.handle.restX - x, pair.handle.restZ - z);
        if (d < bestDist) {
          bestDist = d;
          best = pair;
        }
      }
      return best;
    };

    for (const w of this.WORKERS) {
      const pair = findChairPair(w.d.lv, w.seat.x, w.seat.z);
      if (pair) {
        w.chair = pair.handle;
        w.chairCollider = pair.collider;
        pair.occupants.push(w);
        const ag = this.freeAgents.get(w);
        if (ag) {
          ag.chair = pair.handle;
          ag.chairCollider = pair.collider;
        }
      }
    }

    for (const d of this.DAYONLY) {
      const pair = findChairPair(d.lv, d.dx, d.dz);
      if (pair) {
        d.chair = pair.handle;
        d.chairCollider = pair.collider;
        pair.occupants.push(d);
        const ag = this.freeAgents.get(d);
        if (ag) {
          ag.chair = pair.handle;
          ag.chairCollider = pair.collider;
        }
      }
    }

    for (const b of this.BASEMENT_STAFF) {
      const ag = this.freeAgents.get(b);
      if (!ag) continue;
      const pair = findChairPair(b.lv, ag.homeX, ag.homeZ);
      if (pair) {
        ag.chair = pair.handle;
        ag.chairCollider = pair.collider;
        pair.occupants.push(b);
      }
    }
  }

  private attachBrain(
    actor: PersonActor,
    identity: CharacterIdentity,
    isDeskWorker: boolean,
    walkSpeed = 1.15
  ) {
    actor.brain = createCharacterBrain(identity);
    this.freeAgents.set(actor, {
      lv: identity.homeLv,
      homeX: identity.homeX,
      homeZ: identity.homeZ,
      homeFace: identity.homeFace,
      homePose: identity.homePose,
      mode: 'home',
      queue: [],
      targetPose: identity.homePose,
      targetFace: identity.homeFace,
      walkSpeed,
      isDeskWorker,
      stuckTime: 0,
      replanCount: 0,
      lastX: identity.homeX,
      lastZ: identity.homeZ,
    });
  }

  private addPerson(
    lv: number,
    x: number,
    z: number,
    face: number,
    pose: string,
    opts: MakePersonOptions & {
      look?: number;
      gest?: boolean;
      modes?: Array<[string, number]>;
      route?: Array<{ x: number; z: number; wait?: number; pose?: string; face?: number }>;
      walkPose?: string;
      speed?: number;
    },
    M: MaterialLibrary
  ): PersonActor {
    const P = makePerson(opts, this.P_LIB, M);
    P.g.position.set(x, liftY(lv), z);
    P.yaw = P.tyaw = face;
    P.g.rotation.y = face;
    P.look = opts.look || 0;
    P.gest = !!opts.gest;
    P.modes = opts.modes || null;
    P.timer = 2 + Math.random() * 6;
    if (opts.route) {
      P.route = opts.route;
      P.ri = 0;
      P.wait = opts.route[0].wait || 2;
      P.speed = opts.speed || 1.15;
      P.walkPose = opts.walkPose || 'stand';
    }
    setPose(P, pose, this.P_LIB);
    this.peopleGroup.add(P.g);
    this.STAFF.push(P);
    return P;
  }

  private populateOfficeStaff(M: MaterialLibrary) {
    const P_LIB = this.P_LIB;
    const h = (seed: number, mod: number) => Math.abs((seed * 73 + 19) % mod);
    const sMat = (col: number) =>
      new THREE.MeshStandardMaterial({
        color: col,
        normalMap: M.textures.fabricNormal,
        normalScale: new THREE.Vector2(0.32, 0.32),
        roughness: 0.82,
      });

    // Desk workers across two shifts (Morning + Afternoon)
    const femHairPool = ['braids', 'bun', 'puff', 'afro', 'bob', 'pixie'] as const;
    const maleHairPool = ['fade', 'twists', 'afro', 'fade'] as const;

    ROOMS.forEach((d, idx) => {
      const cx = COLX[d.col];
      const modes = MODES[d.t] || MODES.def;
      const isTechFloor = d.lv === 0 || d.lv === 1;
      [-2.05, 0, 2.05].forEach((ox, k) => {
        const seed = idx * 17 + k * 7;
        for (let sh = 0; sh < 2; sh++) {
          const id = seed + sh * 101;
          const fem = id % 2 === 1;
          const outfit = fem
            ? (['dress', 'blouseSkirt', 'knit', 'shirtTrousers', 'suit'] as const)[h(id * 3, 5)]
            : (['shirtTrousers', 'knit', 'smartCasual', 'suit'] as const)[h(id * 3, 4)];
          const hasHeadphones = (d.t === 'front' || d.t === 'ai' || d.t === 'social' || d.t === 'mobile') && id % 3 === 0;
          const shirtMat =
            outfit === 'knit'
              ? P_LIB.knits[h(id * 3, P_LIB.knits.length)]
              : P_LIB.shirts[h(id * 3, P_LIB.shirts.length)];
          const p = this.addPerson(
            d.lv,
            cx + ox,
            4.79,
            Math.PI,
            pickMode(modes),
            {
              skin: P_LIB.skins[h(id, P_LIB.skins.length)],
              shirt: shirtMat,
              hair: P_LIB.hairs[h(id * 5, P_LIB.hairs.length)],
              trou: P_LIB.trous[h(id * 7, P_LIB.trous.length)],
              fem,
              hs: h(id * 11, 6),
              hairStyle: fem ? femHairPool[h(id * 11, femHairPool.length)] : maleHairPool[h(id * 11, maleHairPool.length)],
              faceVariant: id % 4,
              freckleSeed: id,
              outfit,
              sneakers: isTechFloor ? id % 2 === 0 : id % 4 === 0,
              lanyard: outfit !== 'dress' && id % 3 === 0,
              headphones: hasHeadphones,
              s: (fem ? 0.94 : 0.99) + (id % 5) * 0.015,
              modes,
            },
            M
          ) as WorkerActor;
          p.d = d;
          p.sh_shift = sh;
          p.sd = cx < 0 ? -1 : 1;
          p.seat = { x: cx + ox, z: 4.79 };
          p.state = sh === 0 ? 'atDesk' : 'away';
          p.cab = 0;
          p.ex = 0;
          p.want = 'desk';
          p.lunch = (idx * 3 + k) % 3;
          p.stairJitter = (((idx * 3 + k) % 5) - 2) * 0.13;
          p.laneZ = 8.95 + ((idx + k + sh) % 5) * 0.22;
          if (sh === 1) p.g.visible = false;
          this.attachBrain(
            p,
            {
              id: `worker-${d.t}-${k}-${sh}`,
              name: generateCharacterName(fem, id + idx * 13 + k * 5),
              role: DEPT_ROLE[d.t] || 'Software Specialist',
              department: `${d.n} · ${d.lv === 0 ? 'Ground' : `Level ${d.lv}`}`,
              seniority: k === 1 ? 'Senior' : 'Junior',
              accentColor: `#${d.c.toString(16).padStart(6, '0')}`,
              personality: pickPersonality(id),
              topicKey: d.t,
              homeLv: d.lv,
              homeX: cx + ox,
              homeZ: 4.79,
              homeFace: Math.PI,
              homePose: p.pose,
            },
            true,
            1.58
          );
          this.WORKERS.push(p);
        }
      });
    });

    // Receptionist + Lounge concierge + Visitors & Guests
    let dayIdx = 0;
    const addDayVisitor = (
      lv: number,
      dx: number,
      dz: number,
      df: number,
      dpose: string,
      opts: Parameters<AtriumSimulation['addPerson']>[5],
      meta: {
        name: string;
        role: string;
        department: string;
        topicKey: string;
        accentColor: string;
        seniority?: 'Senior' | 'Junior' | 'Lead' | 'Executive';
      }
    ) => {
      const p = this.addPerson(lv, dx, dz, df, dpose, opts, M) as DayVisitorActor;
      p.lv = lv;
      p.dx = dx;
      p.dz = dz;
      p.df = df;
      p.dpose = dpose;
      p.sd = dx < 0 ? -1 : 1;
      p.state = 'atDesk';
      p.cab = 0;
      p.stairJitter = ((dayIdx % 5) - 2) * 0.13;
      p.laneZ = 8.95 + (dayIdx % 5) * 0.22;
      this.attachBrain(
        p,
        {
          id: `day-${++dayIdx}`,
          name: meta.name,
          role: meta.role,
          department: meta.department,
          seniority: meta.seniority,
          accentColor: meta.accentColor,
          personality: pickPersonality(dayIdx * 17),
          topicKey: meta.topicKey,
          homeLv: lv,
          homeX: dx,
          homeZ: dz,
          homeFace: df,
          homePose: dpose,
        },
        false,
        1.52
      );
      this.DAYONLY.push(p);
      return p;
    };

    // Receptionist (emerald/navy tailored blazer, low chignon bun & warm smile)
    addDayVisitor(
      0,
      -1.22,
      5.18,
      -0.14,
      'standType',
      {
        skin: P_LIB.skins[0],
        shirt: sMat(0x223654),
        hair: P_LIB.hairs[0],
        trou: P_LIB.trous[0],
        fem: true,
        hairStyle: 'bun',
        outfit: 'suit',
        skirt: 'short',
        shoeStyle: 'heel',
        warmSmile: true,
        look: 0.4,
        blazer: true,
      },
      {
        name: 'Grace Muthoni',
        role: 'Front Desk Receptionist',
        department: 'Ground Atrium · Reception',
        topicKey: 'reception',
        accentColor: '#4ea8ff',
      }
    );
    // Ground lobby visitor in tailored dark coat checking smartphone / reading briefs
    addDayVisitor(
      0,
      1.45,
      9.25,
      -Math.PI / 2 - 0.3,
      'hold',
      {
        skin: P_LIB.skins[2],
        shirt: sMat(0x1b212b),
        hair: P_LIB.hairs[1],
        trou: P_LIB.trous[4],
        hairStyle: 'fade',
        beardStyle: 'full',
        coat: true,
        outfit: 'shirtTrousers',
        shoeStyle: 'oxford',
        look: 0.3,
      },
      {
        name: 'Tariq Abdalla',
        role: 'Enterprise Client Partner',
        department: 'Ground Atrium · Visitor Lounge',
        topicKey: 'visitor',
        accentColor: '#60a5fa',
      }
    );
    // Ground lobby architect in sleek sleeveless dress + natural puff holding coffee
    addDayVisitor(
      0,
      5.4,
      9.8,
      -0.55,
      'coffee',
      {
        skin: P_LIB.skins[0],
        shirt: sMat(0x16181d),
        hair: P_LIB.hairs[0],
        trou: sMat(0x16181d),
        fem: true,
        hairStyle: 'puff',
        outfit: 'dress',
        skirt: 'short',
        sleeve: 'sleeveless',
        shoeStyle: 'heel',
        warmSmile: true,
        look: 0.35,
      },
      {
        name: 'Nadia Hassan',
        role: 'Solutions Architect',
        department: 'Ground Atrium · Lobby',
        seniority: 'Senior',
        topicKey: 'visitor',
        accentColor: '#60a5fa',
      }
    );

    // Ground Security Officer patrolling lobby freely
    const secOff = this.addPerson(
      0,
      -5,
      9.4,
      0.2,
      'radio',
      {
        skin: P_LIB.skins[3],
        shirt: sMat(0x1b2b4a),
        hair: P_LIB.hairs[3],
        trou: sMat(0x161b26),
        hairStyle: 'fade',
        beardStyle: 'none',
        outfit: 'shirtTrousers',
        sleeve: 'short',
        shoeStyle: 'oxford',
        s: 1.07,
        speed: 0.95,
      },
      M
    );
    this.secOffActor = secOff;
    this.attachBrain(
      secOff,
      {
        id: 'ground-security',
        name: 'David Kiprop',
        role: 'Campus Security Officer',
        department: 'Ground Atrium · Security',
        seniority: 'Senior',
        accentColor: '#38bdf8',
        personality: 'Vigilant & approachable guardian',
        topicKey: 'security',
        homeLv: 0,
        homeX: -5,
        homeZ: 9.4,
        homeFace: 0.2,
        homePose: 'radio',
      },
      false,
      0.95
    );
    const badgeMesh = new THREE.Mesh(
      getRoundedBox(0.052, 0.068, 0.012, 0.004, 2),
      new THREE.MeshStandardMaterial({ color: 0xe6b83a, metalness: 0.9, roughness: 0.2 })
    );
    badgeMesh.position.set(0.085, 0.43, 0.129);
    secOff.tor.add(badgeMesh);

    // Executive Lounge barista
    addDayVisitor(
      4,
      -17.6,
      0.44,
      0,
      'standCounter',
      {
        skin: P_LIB.skins[2],
        shirt: sMat(0x2a2d34),
        hair: P_LIB.hairs[0],
        trou: P_LIB.trous[0],
        fem: true,
        hairStyle: 'afro',
        outfit: 'blouseSkirt',
        sleeve: 'rolled',
        skirt: 'midi',
        shoeStyle: 'flat',
        warmSmile: true,
        look: 0.3,
      },
      {
        name: 'Beatrice Akinyi',
        role: 'Executive Barista',
        department: 'Level 4 · Executive Lounge',
        topicKey: 'lounge',
        accentColor: '#b08452',
      }
    );
    // Executive Lounge collaborating pair
    addDayVisitor(
      4,
      -14.9,
      3.95,
      Math.PI / 2 - 0.15,
      'coffee',
      {
        skin: P_LIB.skins[5],
        shirt: sMat(0x1c222d),
        hair: P_LIB.hairs[0],
        trou: sMat(0x16181e),
        hairStyle: 'fade',
        beardStyle: 'full',
        coat: true,
        outfit: 'shirtTrousers',
        shoeStyle: 'oxford',
        look: 0.3,
      },
      {
        name: 'Victor Kariuki',
        role: 'Advisory Partner',
        department: 'Level 4 · Executive Lounge',
        seniority: 'Senior',
        topicKey: 'lounge',
        accentColor: '#b08452',
      }
    );
    addDayVisitor(
      4,
      -13.4,
      4.05,
      -Math.PI / 2 + 0.15,
      'collaborate',
      {
        skin: P_LIB.skins[4],
        shirt: sMat(0xf0eee8),
        hair: P_LIB.hairs[0],
        trou: sMat(0x1e4c9a),
        fem: true,
        hairStyle: 'braids',
        outfit: 'blouseSkirt',
        sleeve: 'rolled',
        skirt: 'midi',
        shoeStyle: 'heel',
        headphones: true,
        warmSmile: true,
        gest: true,
        look: 0.35,
      },
      {
        name: 'Imani Achieng',
        role: 'Product Strategy Lead',
        department: 'Level 4 · Executive Lounge',
        seniority: 'Lead',
        topicKey: 'lounge',
        accentColor: '#b08452',
      }
    );

    // Directors around Board Room table
    const dirCol = [0x1c2838, 0x3a2434, 0x283630, 0x24262e, 0x363024];
    const dirNames = ['Salma Ndegwa', 'Peter Mwangi', 'Gideon Omondi', 'Chebet Koech', 'Baraka Mutiso'];
    const execSeats: Array<[number, number, number, string, number, number]> = [
      [-6.58, 4.9, Math.PI / 2, 'sitTalk', 1, 0x9c282e],
      [-1.8, 3.26, 0, 'meeting', 0, 0x284e86],
      [1.8, 3.26, 0, 'writeNotes', 0, 0x326a5a],
      [-3.6, 6.54, Math.PI, 'meeting', 1, 0],
      [3.6, 6.54, Math.PI, 'sitCollaborate', 0, 0x5c3670],
    ];
    execSeats.forEach(([x, z, rot, pose, fem, tie], i) => {
      addDayVisitor(
        4,
        x,
        z,
        rot,
        pose,
        {
          skin: P_LIB.skins[(i * 2) % P_LIB.skins.length],
          shirt: sMat(dirCol[i]),
          hair: P_LIB.hairs[(i * 2) % P_LIB.hairs.length],
          trou: sMat(dirCol[i]),
          fem: !!fem,
          hairStyle: fem ? (i === 0 ? 'bun' : 'bob') : i === 2 ? 'twists' : 'fade',
          beardStyle: !fem && i % 2 === 1 ? 'stubble' : 'none',
          faceVariant: i % 4,
          s: fem ? 0.97 : 1.04,
          outfit: 'suit',
          skirt: fem && i === 0 ? 'short' : 'none',
          shoeStyle: fem ? 'heel' : 'oxford',
          blazer: true,
          gest: pose === 'sitTalk' || pose === 'sitCollaborate',
          look: 0.35,
          tie: fem ? undefined : tie,
        },
        {
          name: dirNames[i],
          role: 'Board Director',
          department: 'Level 4 · Board Room',
          seniority: 'Executive',
          topicKey: 'board',
          accentColor: '#c9a24b',
        }
      );
    });

    // Heads of Department & Board Secretary & EA & CEO
    (
      [
        [4, 15, 2.58, 0, 'sitReadDoc', 0x165e4c, 1, 0, 'dress', 'braids', 'Faith Nyambura', 'Board Secretary', 'Level 4 · Secretariat', 'secr', '#64748b'],
        [5, -17.5, 2.66, 0, 'type', 0x1e2c44, 0, 0x2e64b8, 'suit', 'fade', 'Kelvin Ochieng', 'Head of Technology', 'Level 5 · Executive Suite', 'hod', '#34598f'],
        [5, -12.5, 2.66, 0, 'phone', 0x422238, 1, 0, 'suit', 'puff', 'Zawadi Kimani', 'Head of Marketing', 'Level 5 · Executive Suite', 'hod', '#7a2f5a'],
        [5, -7.5, 2.66, 0, 'think', 0x2b303a, 0, 0, 'knit', 'twists', 'Collins Kioko', 'Head of Finance', 'Level 5 · Executive Suite', 'hod', '#2d7a5a'],
        [5, -2.5, 2.66, 0, 'writeNotes', 0x3c2e22, 1, 0, 'blouseSkirt', 'bob', 'Makena Chege', 'Head of Operations', 'Level 5 · Executive Suite', 'hod', '#c9762e'],
        [5, 3, 2.58, 0, 'sit', 0x181a20, 1, 0, 'dress', 'pixie', 'Sifa Wambui', 'Executive Assistant', 'Level 5 · Executive Suite', 'secr', '#5d6b7a'],
        [5, 13, 2.58, 0, 'phone', 0x141a26, 0, 0x8a1f2e, 'suit', 'fade', 'Samuel Njoroge', 'Chief Executive Officer', 'Level 5 · CEO Office', 'ceo', '#c9a24b'],
      ] as const
    ).forEach(([lv, x, z, rot, pose, col, fem, tie, outfit, hairStyle, name, role, dept, topicKey, acc], i) => {
      addDayVisitor(
        lv,
        x,
        z,
        rot,
        pose,
        {
          skin: P_LIB.skins[(i + 2) % P_LIB.skins.length],
          shirt: outfit === 'knit' ? P_LIB.knits[0] : sMat(col),
          hair: P_LIB.hairs[(i + 1) % P_LIB.hairs.length],
          trou: sMat(col),
          fem: !!fem,
          hairStyle,
          beardStyle: !fem ? 'full' : 'none',
          faceVariant: i % 4,
          outfit,
          blazer: outfit === 'suit',
          sleeve: outfit === 'dress' ? 'sleeveless' : undefined,
          skirt: outfit === 'dress' || outfit === 'blouseSkirt' ? 'short' : 'none',
          shoeStyle: fem ? 'heel' : 'oxford',
          s: lv === 5 && x === 13 ? 1.1 : fem ? 0.96 : 1.02,
          look: 0.35,
          tie: tie || undefined,
        },
        {
          name,
          role,
          department: dept,
          seniority: 'Executive',
          topicKey,
          accentColor: acc,
        }
      );
    });

    // Expanded Wing Staff: L0 Security Room, L1 HR Room, L2 Relax Room, L3 Gym Room, L4 Strategy Room, L5 Executive Gallery
    addDayVisitor(
      0,
      -25.9,
      4.55,
      Math.PI,
      'type',
      {
        skin: P_LIB.skins[1],
        shirt: sMat(0x1b2b4a),
        hair: P_LIB.hairs[0],
        trou: sMat(0x141a26),
        hairStyle: 'fade',
        beardStyle: 'stubble',
        outfit: 'shirtTrousers',
        sleeve: 'short',
        shoeStyle: 'oxford',
        lanyard: true,
        look: 0.25,
      },
      {
        name: 'Marcus Odhiambo',
        role: 'Security Operations Lead',
        department: 'Level 0 · Security Room',
        seniority: 'Lead',
        topicKey: 'security_ops',
        accentColor: '#38bdf8',
      }
    );
    addDayVisitor(
      0,
      -24.1,
      4.55,
      Math.PI,
      'monitorLook',
      {
        skin: P_LIB.skins[4],
        shirt: sMat(0x1b2b4a),
        hair: P_LIB.hairs[0],
        trou: sMat(0x141a26),
        fem: true,
        hairStyle: 'bun',
        outfit: 'shirtTrousers',
        sleeve: 'short',
        shoeStyle: 'flat',
        lanyard: true,
        look: 0.25,
      },
      {
        name: 'Farida Karanja',
        role: 'Campus Patrol Officer',
        department: 'Level 0 · Security Room',
        topicKey: 'security_ops',
        accentColor: '#38bdf8',
      }
    );
    addDayVisitor(
      1,
      -26.9,
      2.4,
      0,
      'type',
      {
        skin: P_LIB.skins[2],
        shirt: sMat(0x2e6f64),
        hair: P_LIB.hairs[0],
        trou: P_LIB.trous[0],
        fem: true,
        hairStyle: 'braids',
        outfit: 'suit',
        skirt: 'none',
        blazer: true,
        shoeStyle: 'heel',
        warmSmile: true,
        look: 0.35,
      },
      {
        name: 'Lilian Mutua',
        role: 'HR Director',
        department: 'Level 1 · HR Room',
        seniority: 'Lead',
        topicKey: 'hr',
        accentColor: '#34d399',
      }
    );
    addDayVisitor(
      1,
      -23.0,
      2.4,
      0,
      'sitReadDoc',
      {
        skin: P_LIB.skins[3],
        shirt: sMat(0xf1f5f9),
        hair: P_LIB.hairs[2],
        trou: P_LIB.trous[2],
        hairStyle: 'twists',
        beardStyle: 'none',
        outfit: 'shirtTrousers',
        sleeve: 'rolled',
        shoeStyle: 'oxford',
        lanyard: true,
        look: 0.3,
      },
      {
        name: 'Dennis Kiprop',
        role: 'Talent & Onboarding Lead',
        department: 'Level 1 · HR Room',
        seniority: 'Senior',
        topicKey: 'hr',
        accentColor: '#34d399',
      }
    );
    addDayVisitor(
      2,
      -23.7,
      4.2,
      Math.PI / 2,
      'collaborate',
      {
        skin: P_LIB.skins[5],
        shirt: sMat(0x2a4a7f),
        hair: P_LIB.hairs[1],
        trou: P_LIB.trous[1],
        hairStyle: 'afro',
        outfit: 'smartCasual',
        sleeve: 'short',
        sneakers: true,
        gest: true,
        look: 0.3,
      },
      {
        name: 'Ian Omondi',
        role: 'Ping-Pong Break Coach',
        department: 'Level 2 · Relax Room',
        topicKey: 'relax',
        accentColor: '#f59e0b',
      }
    );
    addDayVisitor(
      2,
      -27.4,
      6.8,
      -Math.PI / 2,
      'coffee',
      {
        skin: P_LIB.skins[0],
        shirt: sMat(0xd97742),
        hair: P_LIB.hairs[0],
        trou: P_LIB.trous[3],
        fem: true,
        hairStyle: 'puff',
        outfit: 'knit',
        sneakers: true,
        warmSmile: true,
        look: 0.35,
      },
      {
        name: 'Joy Achieng',
        role: 'Developer Experience Host',
        department: 'Level 2 · Relax Room',
        topicKey: 'relax',
        accentColor: '#f59e0b',
      }
    );
    addDayVisitor(
      3,
      -25.0,
      4.1,
      Math.PI,
      'hold',
      {
        skin: P_LIB.skins[6],
        shirt: sMat(0x1f2937),
        hair: P_LIB.hairs[0],
        trou: sMat(0x111827),
        hairStyle: 'fade',
        outfit: 'smartCasual',
        sleeve: 'short',
        sneakers: true,
        look: 0.25,
      },
      {
        name: 'Trevor Kamau',
        role: 'Wellness & Fitness Coordinator',
        department: 'Level 3 · Gym Room',
        topicKey: 'gym',
        accentColor: '#f87171',
      }
    );
    addDayVisitor(
      3,
      -21.4,
      5.8,
      Math.PI,
      'stand',
      {
        skin: P_LIB.skins[1],
        shirt: sMat(0xd9465f),
        hair: P_LIB.hairs[0],
        trou: sMat(0x1e293b),
        fem: true,
        hairStyle: 'bob',
        outfit: 'smartCasual',
        sleeve: 'sleeveless',
        sneakers: true,
        warmSmile: true,
        look: 0.3,
      },
      {
        name: 'Halima Mohamed',
        role: 'Athletic Trainer',
        department: 'Level 3 · Gym Room',
        topicKey: 'gym',
        accentColor: '#f87171',
      }
    );
    addDayVisitor(
      4,
      -26.6,
      3.35,
      0,
      'type',
      {
        skin: P_LIB.skins[3],
        shirt: sMat(0x283e6e),
        hair: P_LIB.hairs[0],
        trou: sMat(0x1e293b),
        fem: true,
        hairStyle: 'bun',
        outfit: 'suit',
        blazer: true,
        shoeStyle: 'heel',
        warmSmile: true,
        look: 0.35,
      },
      {
        name: 'Pendo Barasa',
        role: 'Head of Corporate Strategy',
        department: 'Level 4 · Strategy Room',
        seniority: 'Lead',
        topicKey: 'strategy',
        accentColor: '#818cf8',
      }
    );
    addDayVisitor(
      4,
      -25.0,
      3.35,
      0,
      'sitTalk',
      {
        skin: P_LIB.skins[4],
        shirt: sMat(0xf8fafc),
        hair: P_LIB.hairs[1],
        trou: sMat(0x273244),
        hairStyle: 'fade',
        beardStyle: 'stubble',
        outfit: 'suit',
        blazer: true,
        tie: 0x3b5998,
        shoeStyle: 'oxford',
        gest: true,
        look: 0.35,
      },
      {
        name: 'Kamau Ouko',
        role: 'Growth & OKR Analyst',
        department: 'Level 4 · Strategy Room',
        seniority: 'Senior',
        topicKey: 'strategy',
        accentColor: '#818cf8',
      }
    );
    addDayVisitor(
      5,
      -25.0,
      2.3,
      0,
      'stand',
      {
        skin: P_LIB.skins[2],
        shirt: sMat(0x4b3d2d),
        hair: P_LIB.hairs[0],
        trou: sMat(0x1f242d),
        fem: true,
        hairStyle: 'pixie',
        outfit: 'blouseSkirt',
        skirt: 'midi',
        shoeStyle: 'heel',
        warmSmile: true,
        look: 0.35,
      },
      {
        name: 'Talia Mugo',
        role: 'Partner Relations Director',
        department: 'Level 5 · Executive Gallery',
        seniority: 'Executive',
        topicKey: 'gallery',
        accentColor: '#b08452',
      }
    );

    // B1 Server Room & B2 Power Room Maintenance Teams (Senior Engineers & Junior Technicians)
    let baseIdx = 0;
    const addBasementCrew = (
      lv: -1 | -2,
      seniority: 'senior' | 'junior',
      name: string,
      roleLabel: string,
      opts: Parameters<AtriumSimulation['addPerson']>[5] & {
        startX: number;
        startZ: number;
        startFace: number;
        startPose: string;
      }
    ) => {
      const speed = seniority === 'senior' ? 0.88 : 1.08;
      const p = this.addPerson(
        lv,
        opts.startX,
        opts.startZ,
        opts.startFace,
        opts.startPose,
        {
          speed,
          look: 0.25,
          lanyard: true,
          ...opts,
        },
        M
      ) as BasementCrewActor;
      p.lv = lv;
      p.seniority = seniority;
      p.roleLabel = roleLabel;
      const isDeskWorker = opts.startPose === 'type';
      this.attachBrain(
        p,
        {
          id: `base-${lv}-${++baseIdx}`,
          name,
          role: roleLabel,
          department: lv === -1 ? 'B1 · Server Room' : 'B2 · Power Room',
          seniority: seniority === 'senior' ? 'Senior' : 'Junior',
          accentColor:
            lv === -1
              ? seniority === 'senior'
                ? '#38bdf8'
                : '#6fe3a1'
              : seniority === 'senior'
                ? '#f8fafc'
                : '#f2b705',
          personality: pickPersonality(baseIdx * 23),
          topicKey: `${lv === -1 ? 'b1' : 'b2'}_${seniority}`,
          homeLv: lv,
          homeX: opts.startX,
          homeZ: opts.startZ,
          homeFace: opts.startFace,
          homePose: opts.startPose,
        },
        isDeskWorker,
        speed
      );
      this.BASEMENT_STAFF.push(p);
      return p;
    };

    // B1 · Server Room (2 Senior Infrastructure Engineers, 2 Junior Maintenance Technicians)
    addBasementCrew(-1, 'senior', 'Benson Kipchoge', 'Senior Cooling & Systems Engineer', {
      skin: P_LIB.skins[1],
      shirt: sMat(0x1b2b42),
      hair: P_LIB.hairs[0],
      trou: sMat(0x181c24),
      hairStyle: 'fade',
      beardStyle: 'full',
      coat: true,
      outfit: 'shirtTrousers',
      shoeStyle: 'oxford',
      glasses: true,
      s: 1.06,
      startX: -2.5,
      startZ: 1.88,
      startFace: Math.PI,
      startPose: 'readDoc',
    });
    addBasementCrew(-1, 'senior', 'Amina Odhiambo', 'Senior Server Infrastructure Engineer', {
      skin: P_LIB.skins[4],
      shirt: sMat(0x283242),
      hair: P_LIB.hairs[0],
      trou: sMat(0x1a1e28),
      fem: true,
      hairStyle: 'bun',
      outfit: 'suit',
      skirt: 'none',
      blazer: true,
      shoeStyle: 'flat',
      glasses: true,
      s: 1.01,
      startX: -1.6,
      startZ: 4.35,
      startFace: -Math.PI / 2,
      startPose: 'hold',
    });
    addBasementCrew(-1, 'junior', 'Kevin Mburu', 'Junior Network & Cabling Tech', {
      skin: P_LIB.skins[2],
      shirt: sMat(0x1d7a6e),
      hair: P_LIB.hairs[1],
      trou: sMat(0x222732),
      hairStyle: 'fade',
      beardStyle: 'stubble',
      outfit: 'smartCasual',
      sleeve: 'rolled',
      sneakers: true,
      s: 0.96,
      startX: -8.5,
      startZ: 3.96,
      startFace: Math.PI,
      startPose: 'inspectPanel',
    });
    addBasementCrew(-1, 'junior', 'Wanjiku Wafula', 'Junior Rack Maintenance Tech', {
      skin: P_LIB.skins[0],
      shirt: sMat(0x2a5ea8),
      hair: P_LIB.hairs[0],
      trou: sMat(0x1d222c),
      fem: true,
      hairStyle: 'braids',
      outfit: 'shirtTrousers',
      sleeve: 'short',
      sneakers: true,
      s: 0.94,
      startX: 5.6,
      startZ: 6.48,
      startFace: Math.PI,
      startPose: 'inspectPanel',
    });

    // B2 · Power Room (2 Senior Power Engineers in white hard hats, 2 Junior Technicians in yellow hard hats)
    addBasementCrew(-2, 'senior', 'George Gitonga', 'Senior High-Voltage Power Lead', {
      skin: P_LIB.skins[3],
      shirt: sMat(0x202732),
      hair: P_LIB.hairs[0],
      trou: sMat(0x181c22),
      hairStyle: 'fade',
      beardStyle: 'full',
      coat: true,
      outfit: 'shirtTrousers',
      shoeStyle: 'oxford',
      glasses: true,
      hardHat: 0xf4f6f9,
      s: 1.07,
      startX: 3.7,
      startZ: 6.42,
      startFace: Math.PI,
      startPose: 'type',
      modes: [
        ['type', 5],
        ['monitorLook', 2],
        ['leanScreen', 1.5],
        ['writeNotes', 1.5],
        ['think', 1],
      ],
    });
    addBasementCrew(-2, 'senior', 'Esther Karanja', 'Senior Solar & Inverter Engineer', {
      skin: P_LIB.skins[5],
      shirt: sMat(0x1e324d),
      hair: P_LIB.hairs[2],
      trou: sMat(0x191e27),
      fem: true,
      hairStyle: 'bun',
      outfit: 'suit',
      skirt: 'none',
      blazer: true,
      shoeStyle: 'flat',
      glasses: true,
      hardHat: 0xf4f6f9,
      s: 1.01,
      startX: 2.8,
      startZ: 1.8,
      startFace: Math.PI,
      startPose: 'inspectPanel',
    });
    addBasementCrew(-2, 'junior', 'Dennis Langat', 'Junior Battery & Storage Tech', {
      skin: P_LIB.skins[6],
      shirt: sMat(0x2f5b88),
      hair: P_LIB.hairs[1],
      trou: sMat(0x212630),
      hairStyle: 'fade',
      beardStyle: 'none',
      outfit: 'shirtTrousers',
      sleeve: 'rolled',
      shoeStyle: 'oxford',
      hardHat: 0xf2b705,
      s: 0.96,
      startX: 5.3,
      startZ: 6.42,
      startFace: Math.PI,
      startPose: 'type',
      modes: [
        ['type', 5],
        ['monitorLook', 2],
        ['leanScreen', 1.5],
        ['writeNotes', 1.5],
        ['think', 1],
      ],
    });
    addBasementCrew(-2, 'junior', 'Mercy Auma', 'Junior Electrical Maintenance Tech', {
      skin: P_LIB.skins[0],
      shirt: sMat(0xc87d28),
      hair: P_LIB.hairs[0],
      trou: sMat(0x1e232c),
      fem: true,
      hairStyle: 'braids',
      outfit: 'shirtTrousers',
      sleeve: 'short',
      shoeStyle: 'flat',
      hardHat: 0xf2b705,
      s: 0.94,
      startX: 3.24,
      startZ: 8.9,
      startFace: -Math.PI / 2,
      startPose: 'standLowCounter',
    });
  }

  private populateTrafficAndParking() {
    const pushBay = (bay: CompanyBay) => this.LOT.push(bay);

    // 1. DomainTechHub Lot (20 bays via x = ±26.5 inner drives)
    [-1, 1].forEach((sd) =>
      BAY_ROWS.forEach((bz) =>
        BAY_XS.forEach((bx) => {
          const x = sd * bx;
          const xg = sd * DRV_X;
          pushBay({
            company: 'hub',
            sd,
            x,
            z: bz,
            face: bz < AISLE_Z ? Math.PI : 0,
            gateX: xg,
            gateLane: LANE_WEST,
            exitLane: LANE_EAST,
            entryPts: [
              [xg, LANE_WEST],
              [xg, AISLE_Z],
              [x, AISLE_Z],
              [x, bz],
            ],
            exitPts: [
              [x, AISLE_Z],
              [xg, AISLE_Z],
              [xg, LANE_WEST],
              [xg, LANE_EAST],
            ],
          });
        })
      )
    );

    // 2. VitalCare Medical Clinic (4 bays along z = -15.0 ring road via ±36.5 inner drives)
    [-16.0, -11.0, 11.0, 16.0].forEach((bx) =>
      pushBay({
        company: 'medical',
        sd: bx < 0 ? -1 : 1,
        x: bx,
        z: -10.5,
        face: 0,
        gateX: -36.5,
        gateLane: LANE_WEST,
        exitLane: LANE_EAST,
        entryPts: [
          [-36.5, LANE_WEST],
          [-36.5, -15.0],
          [bx, -15.0],
          [bx, -10.5],
        ],
        exitPts: [
          [bx, -15.0],
          [36.5, -15.0],
          [36.5, LANE_WEST],
          [36.5, LANE_EAST],
        ],
      })
    );

    // 3. Meridian Reserve Bank (4 bays via West Commercial Ave x = -73.5 & NW Forecourt z = 18)
    [-96, -92, -88, -84].forEach((bx) =>
      pushBay({
        company: 'bank',
        sd: -1,
        x: bx,
        z: 13.8,
        face: Math.PI,
        gateX: -73.5,
        gateLane: LANE_WEST,
        exitLane: LANE_EAST,
        entryPts: [
          [-73.5, LANE_WEST],
          [-73.5, 18.0],
          [bx, 18.0],
          [bx, 13.8],
        ],
        exitPts: [
          [bx, 18.0],
          [-73.5, 18.0],
          [-73.5, LANE_WEST],
          [-73.5, LANE_EAST],
        ],
      })
    );

    // 4. Saffron & Ember Kitchen (4 bays via West Commercial Ave x = -73.5 -> exit via x = -36.5)
    [-63, -59, -55, -51].forEach((bx) =>
      pushBay({
        company: 'restaurant',
        sd: -1,
        x: bx,
        z: 13.8,
        face: Math.PI,
        gateX: -73.5,
        gateLane: LANE_WEST,
        exitLane: LANE_EAST,
        entryPts: [
          [-73.5, LANE_WEST],
          [-73.5, 18.0],
          [bx, 18.0],
          [bx, 13.8],
        ],
        exitPts: [
          [bx, 18.0],
          [-36.5, 18.0],
          [-36.5, LANE_WEST],
          [-36.5, LANE_EAST],
        ],
      })
    );

    // 5. Apex Motors Dealership (4 bays via East Commercial Ave x = +73.5 -> exit via x = +36.5)
    [51, 55, 59, 63].forEach((bx) =>
      pushBay({
        company: 'dealership',
        sd: 1,
        x: bx,
        z: 13.8,
        face: Math.PI,
        gateX: 73.5,
        gateLane: LANE_WEST,
        exitLane: LANE_EAST,
        entryPts: [
          [73.5, LANE_WEST],
          [73.5, 18.0],
          [bx, 18.0],
          [bx, 13.8],
        ],
        exitPts: [
          [bx, 18.0],
          [36.5, 18.0],
          [36.5, LANE_WEST],
          [36.5, LANE_EAST],
        ],
      })
    );

    // 6. KryptoNexus Exchange (4 bays via East Commercial Ave x = +73.5 & NE Forecourt z = 18)
    [84, 88, 92, 96].forEach((bx) =>
      pushBay({
        company: 'crypto',
        sd: 1,
        x: bx,
        z: 13.8,
        face: Math.PI,
        gateX: 73.5,
        gateLane: LANE_WEST,
        exitLane: LANE_EAST,
        entryPts: [
          [73.5, LANE_WEST],
          [73.5, 18.0],
          [bx, 18.0],
          [bx, 13.8],
        ],
        exitPts: [
          [bx, 18.0],
          [73.5, 18.0],
          [73.5, LANE_WEST],
          [73.5, LANE_EAST],
        ],
      })
    );

    // 7. Horizon Travel Hub (3 south bays via entry x = -60, lane z = 77.2, exit x = -36)
    [-54, -48, -42].forEach((bx) =>
      pushBay({
        company: 'travel',
        sd: -1,
        x: bx,
        z: 79.2,
        face: 0,
        gateX: -60.0,
        gateLane: LANE_EAST,
        exitLane: LANE_EAST,
        entryPts: [
          [-60.0, LANE_EAST],
          [-60.0, 77.2],
          [bx, 77.2],
          [bx, 79.2],
        ],
        exitPts: [
          [bx, 77.2],
          [-36.0, 77.2],
          [-36.0, LANE_EAST],
        ],
      })
    );

    // 8. Savannah Peaks Tourism (3 south bays via entry x = -14, lane z = 77.2, exit x = +14)
    [-8, 0, 8].forEach((bx) =>
      pushBay({
        company: 'tourism',
        sd: 1,
        x: bx,
        z: 79.2,
        face: 0,
        gateX: -14.0,
        gateLane: LANE_EAST,
        exitLane: LANE_EAST,
        entryPts: [
          [-14.0, LANE_EAST],
          [-14.0, 77.2],
          [bx, 77.2],
          [bx, 79.2],
        ],
        exitPts: [
          [bx, 77.2],
          [14.0, 77.2],
          [14.0, LANE_EAST],
        ],
      })
    );

    // 9. SwiftPort Cargo & Logistics (3 front bays z = 79.2 + 2 East Loading Dock bays x = 73.1)
    [44, 52, 60].forEach((bx) =>
      pushBay({
        company: 'logistics',
        sd: 1,
        x: bx,
        z: 79.2,
        face: 0,
        gateX: 38.0,
        gateLane: LANE_EAST,
        exitLane: LANE_EAST,
        entryPts: [
          [38.0, LANE_EAST],
          [38.0, 77.2],
          [bx, 77.2],
          [bx, 79.2],
        ],
        exitPts: [
          [bx, 77.2],
          [77.0, 77.2],
          [77.0, LANE_EAST],
        ],
      })
    );
    [90.5, 97.5].forEach((bz) =>
      pushBay({
        company: 'logistics',
        sd: 1,
        x: 73.1,
        z: bz,
        face: -Math.PI / 2,
        gateX: 38.0,
        gateLane: LANE_EAST,
        exitLane: LANE_EAST,
        entryPts: [
          [38.0, LANE_EAST],
          [38.0, 77.2],
          [77.0, 77.2],
          [77.0, bz],
          [73.1, bz],
        ],
        exitPts: [
          [77.0, bz],
          [77.0, LANE_EAST],
        ],
      })
    );

    const addLock = (x: number, z: number, r: number) => {
      if (!this.PLOCK.some((p) => Math.hypot(p.x - x, p.z - z) < 0.2)) {
        this.PLOCK.push({ x, z, r });
      }
    };
    ROOMS.forEach((d) => addLock(COLX[d.col], 3.95, 1.4));
    for (let x = -17.5; x <= 3; x += 5) addLock(x, 3.5, 1.3);
    addLock(13, 3.4, 2.1);
    addLock(15, 3.4, 1.3);
    addLock(0, 4.9, 6.4);
    addLock(-17.6, 1.0, 2.7);
    addLock(0, 5.4, 3.3);
    addLock(-25.0, 3.6, 2.3);
    addLock(-26.9, 3.2, 1.3);
    addLock(-23.0, 3.2, 1.3);
    addLock(-22.3, 4.2, 1.6);
    addLock(-25.0, 4.7, 2.8);
    addLock(-25.0, 4.5, 2.0);
    addLock(22.25, 4.7, 3.8);
    addLock(27.15, 4.4, 3.6);
    [-1, 1].forEach((s) => {
      addLock(s * LIFTX, LANE, 1.35);
      addLock(s * 13, 11.2, 2.0);
      addLock(s * 25, 11.2, 2.0);
      addLock(s * 16.5, 13.4, 2.0);
    });

    // Through-boulevard traffic (sedans, SUVs, hatchbacks + SwiftPort cargo transit van)
    for (let i = 0; i < 6; i++) {
      const dir = i % 2 ? 1 : -1;
      const lane = dir > 0 ? LANE_EAST : LANE_WEST;
      const laneIdx = Math.floor(i / 2);
      const x = -80 + laneIdx * 64 + (dir > 0 ? 12 : -8);
      const style = i === 4 ? 'van' : CAR_STYLES[i % 3];
      const car = makeCar(style === 'van' ? 0xf8fafc : CAR_COLS[i % CAR_COLS.length], style, {
        logistics: style === 'van',
      });
      const rig = car.userData.carRig as CarRig;
      const cruiseSpd = style === 'van' ? 7.8 : 8.4 + (i % 3) * 1.2;
      car.position.set(x, -0.62, lane);
      car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.trafficGroup.add(car);
      this.TRAF.push({
        g: car,
        rig,
        bm: car.userData.body as THREE.MeshPhysicalMaterial,
        spd: cruiseSpd,
        cruiseSpd,
        vel: cruiseSpd,
        lane,
        x,
        dir,
        state: 'street',
        bay: null,
        phase: Math.random() * 6,
        steer: 0,
        pitch: 0,
        roll: 0,
        brakeGlow: 0,
        signalDir: 0,
        pauseTimer: 0,
      });
    }

    const pickBay = (company: BuildingId, occurrence = 0): CompanyBay => {
      const matches = this.LOT.filter((b) => b.company === company);
      return matches[occurrence % matches.length];
    };

    const spawnAssignedVehicle = (
      bay: CompanyBay,
      style: 'sedan' | 'suv' | 'hatch' | 'van',
      color: number,
      idx: number,
      opts?: { in_t?: number; out_t?: number; errand?: { cycleMin: number; parkMin: number; offset: number }; logistics?: boolean }
    ) => {
      const car = makeCar(color, style, { logistics: opts?.logistics });
      const rig = car.userData.carRig as CarRig;
      car.position.set(bay.x, -0.604, bay.z);
      car.rotation.y = bay.face;
      this.trafficGroup.add(car);
      this.TRAF.push({
        g: car,
        rig,
        bm: car.userData.body as THREE.MeshPhysicalMaterial,
        spd: style === 'van' ? 4.4 : 4.8,
        cruiseSpd: style === 'van' ? 8.2 : 9.0 + (idx % 3) * 0.9,
        vel: 0,
        lane: bay.gateLane,
        x: bay.x,
        dir: bay.gateLane === LANE_EAST ? 1 : -1,
        state: 'parked',
        bay,
        phase: idx * 0.7,
        steer: 0,
        pitch: 0,
        roll: 0,
        brakeGlow: 0,
        signalDir: 0,
        pauseTimer: 0,
        in_t: opts?.in_t,
        out_t: opts?.out_t,
        errand: opts?.errand,
      });
    };

    // 10 Commuter / Tenant parked vehicles across all 9 companies
    const commuters: Array<{ company: BuildingId; occ: number; style: 'sedan' | 'suv' | 'hatch' | 'van'; color: number; logistics?: boolean }> = [
      { company: 'hub', occ: 1, style: 'sedan', color: 0x1c2432 },
      { company: 'hub', occ: 11, style: 'suv', color: 0x3b4854 },
      { company: 'medical', occ: 1, style: 'suv', color: 0xcfd3d6 },
      { company: 'bank', occ: 1, style: 'sedan', color: 0x16171a },
      { company: 'restaurant', occ: 1, style: 'hatch', color: 0x7b2329 },
      { company: 'dealership', occ: 1, style: 'suv', color: 0x2e4a76 },
      { company: 'crypto', occ: 1, style: 'sedan', color: 0x2c4237 },
      { company: 'travel', occ: 1, style: 'suv', color: 0x7a6a58 },
      { company: 'tourism', occ: 1, style: 'suv', color: 0x4b5c34 },
      { company: 'logistics', occ: 3, style: 'van', color: 0xf8fafc, logistics: true },
    ];
    commuters.forEach((cfg, idx) => {
      spawnAssignedVehicle(pickBay(cfg.company, cfg.occ), cfg.style, cfg.color, idx, {
        in_t: 440 + (idx % 6) * 12,
        out_t: 1030 + (idx % 6) * 18,
        logistics: cfg.logistics,
      });
    });

    // 9 Active errand / fleet vehicles entering & exiting every company road continuously during business hours
    const fleetErrands: Array<{
      company: BuildingId;
      occ: number;
      style: 'sedan' | 'suv' | 'hatch' | 'van';
      color: number;
      cycleMin: number;
      parkMin: number;
      offset: number;
      logistics?: boolean;
    }> = [
      { company: 'logistics', occ: 4, style: 'van', color: 0xf8fafc, cycleMin: 16, parkMin: 6, offset: 5, logistics: true },
      { company: 'logistics', occ: 0, style: 'van', color: 0xea580c, cycleMin: 18, parkMin: 6, offset: 12, logistics: true },
      { company: 'hub', occ: 6, style: 'van', color: 0xf8fafc, cycleMin: 20, parkMin: 6, offset: 8, logistics: true },
      { company: 'medical', occ: 2, style: 'suv', color: 0xeef2f6, cycleMin: 18, parkMin: 6, offset: 3 },
      { company: 'bank', occ: 2, style: 'sedan', color: 0x1e293b, cycleMin: 22, parkMin: 7, offset: 9 },
      { company: 'restaurant', occ: 2, style: 'hatch', color: 0x991b1b, cycleMin: 20, parkMin: 6, offset: 14 },
      { company: 'dealership', occ: 2, style: 'sedan', color: 0x1d4ed8, cycleMin: 20, parkMin: 6, offset: 4 },
      { company: 'crypto', occ: 2, style: 'hatch', color: 0x0f766e, cycleMin: 22, parkMin: 7, offset: 16 },
      { company: 'travel', occ: 0, style: 'suv', color: 0x7c2d12, cycleMin: 22, parkMin: 7, offset: 10 },
      { company: 'tourism', occ: 2, style: 'suv', color: 0x3f6212, cycleMin: 24, parkMin: 7, offset: 1 },
    ];
    fleetErrands.forEach((cfg, idx) => {
      spawnAssignedVehicle(pickBay(cfg.company, cfg.occ), cfg.style, cfg.color, idx + 20, {
        errand: { cycleMin: cfg.cycleMin, parkMin: cfg.parkMin, offset: cfg.offset },
        logistics: cfg.logistics,
      });
    });
  }

  private buildTourStops(): TourStop[] {
    const out: TourStop[] = [];
    const byName = new Map(ROOMS.map((r) => [r.n, r]));
    const totalStops = 23;
    const pushRoom = (name: string) => {
      const r = byName.get(name);
      if (!r) return;
      const cx = COLX[r.col];
      out.push({
        n: r.n,
        room: r,
        lv: r.lv,
        cx,
        col: `#${r.col >= 0 ? r.c.toString(16).padStart(6, '0') : '6fe3a1'}`,
        lab: `Level ${r.lv} · Bay ${r.col + 1} · Stop ${out.length + 1} of ${totalStops}`,
        text: TOUR_TEXT[r.n] || '',
      });
    };
    const pushWing = (title: string, room: (typeof EXEC)[keyof typeof EXEC], hex: string, labPrefix: string) => {
      out.push({
        n: title,
        room,
        lv: room.lv,
        cx: room.cx,
        col: hex,
        lab: `${labPrefix} · Stop ${out.length + 1} of ${totalStops}`,
        text: TOUR_TEXT[title] || room.sub,
      });
    };

    pushWing('Security Room', EXEC.security, '#38bdf8', 'Ground Floor · West Wing');
    pushRoom('Maintenance & Security');
    pushRoom('Mobile Apps');

    pushWing('HR Room', EXEC.hr, '#34d399', 'Level 1 · West Wing');
    pushRoom('Consultancy');
    pushRoom('AI Solutions');
    pushRoom('Custom CRM');
    pushRoom('Social Media');

    pushWing('Relax Room', EXEC.relax, '#f59e0b', 'Level 2 · West Wing');
    pushRoom('SEO');
    pushRoom('Digital Marketing');
    pushRoom('PPC · Google Ads');
    pushRoom('WhatsApp Marketing');

    pushWing('Gym Room', EXEC.gym, '#f87171', 'Level 3 · West Wing');
    pushRoom('CMS & WordPress');
    pushRoom('E-Commerce');
    pushRoom('Front-End');
    pushRoom('Web Development');

    pushWing('Strategy Room', EXEC.strategy, '#818cf8', 'Level 4 · West Wing');
    pushWing('Board Room', EXEC.board, '#c9a24b', 'Level 4 · Executive Floor');
    pushWing('Executive Gallery', EXEC.gallery, '#b08452', 'Level 5 · West Wing');
    pushWing('Heads of Department', EXEC.tech, '#5b8ee8', 'Level 5 · Heads of Department');
    out.push({
      n: 'CEO Office',
      room: EXEC.ceo,
      lv: 5,
      cx: 13,
      col: '#c9a24b',
      lab: 'Level 5 · CEO Suite · Final Stop',
      text: TOUR_TEXT['CEO Office'],
    });
    return out;
  }

  private levelFromY(y: number): number {
    if (y < -6.5) return -2;
    if (y < -2.0) return -1;
    let bestLv = 0;
    let bestDiff = Math.abs(LV[0] - y);
    for (let i = 1; i < LV.length; i++) {
      const diff = Math.abs(LV[i] - y);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestLv = i;
      }
    }
    return bestLv;
  }

  private groundElevationAt(lv: number, x: number, z: number, buildingId: BuildingId = 'hub'): number {
    if (buildingId === 'hub' && lv >= 0 && lv < FLOORS && x >= 20.14 && x <= 24.36 && z >= 1.05 && z <= 7.85) {
      const y0 = LV[lv];
      const halfRise = (lv === 0 ? 5.6 : 4.2) * 0.5;
      const flightZStart = 7.75;
      const flightZEnd = 2.85;
      if (z <= flightZEnd) {
        return y0 + halfRise + 0.04;
      }
      if (x <= 22.25) {
        const t = Math.max(0, Math.min(1, (flightZStart - z) / (flightZStart - flightZEnd)));
        return y0 + t * halfRise;
      }
      const t = Math.max(0, Math.min(1, (z - flightZEnd) / (flightZStart - flightZEnd)));
      return y0 + halfRise + t * halfRise + 0.02;
    }
    if (lv !== 0) {
      if (buildingId !== 'hub') {
        const spec = DISTRICT_BUILDING_MAP[buildingId];
        return spec.groundY + lv * spec.floorH + 0.12;
      }
      return liftY(lv);
    }
    if (Math.abs(x) <= 30.0 && z >= 0 && z <= 11.025) return 0;
    if (Math.abs(x) <= 15.0 && z > 11.025 && z <= 13.975) {
      if (z <= 12.025) return 0;
      if (z <= 12.975) return -0.2;
      return -0.4;
    }
    for (let i = 0; i < DISTRICT_BUILDINGS.length; i++) {
      const b = DISTRICT_BUILDINGS[i];
      if (b.id === 'hub') continue;
      if (Math.abs(x - b.cx) <= b.w * 0.5 && Math.abs(z - b.cz) <= b.d * 0.5) {
        return b.groundY + 0.12;
      }
    }
    return -0.608;
  }

  private setSafePose(P: PersonActor, requestedPose: string) {
    let pose = requestedPose;
    if (SEATED_POSES.has(pose)) {
      const ag = this.freeAgents.get(P);
      const chair = ag?.chair;
      const actorState = (P as { state?: string }).state;
      const onChair = Boolean(
        chair &&
          P.g.visible &&
          (actorState === undefined || actorState === 'atDesk') &&
          Math.abs(P.g.position.y - liftY(chair.lv)) < 0.35 &&
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
    setPose(P, pose, this.P_LIB);
  }

  private updateChairs(dt: number) {
    const k = 1 - Math.exp(-dt * 6.5);
    for (let i = 0; i < this.chairPairs.length; i++) {
      const pair = this.chairPairs[i];
      const ch = pair.handle;
      const col = pair.collider;
      const floorY = liftY(ch.lv);

      let targetPull = 0;
      let targetSwivel = 0;

      for (let j = 0; j < pair.occupants.length; j++) {
        const occ = pair.occupants[j];
        if (!occ.g.visible) continue;
        const st = (occ as { state?: string }).state;
        if (st === 'away' || st === 'inCab') continue;
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

      // Hard bound: chair can never deviate beyond maxPush
      const offX = ch.curX - ch.restX;
      const offZ = ch.curZ - ch.restZ;
      const offLen = Math.hypot(offX, offZ);
      if (offLen > ch.maxPush) {
        const scale = ch.maxPush / offLen;
        ch.curX = ch.restX + offX * scale;
        ch.curZ = ch.restZ + offZ * scale;
      }

      ch.group.position.x = ch.curX;
      ch.group.position.z = ch.curZ;
      ch.group.rotation.y = ch.curRot;
      col.curX = ch.curX;
      col.curZ = ch.curZ;
    }
  }

  private resolveCharacterSeparation(
    actor: PersonActor,
    lv: number,
    nx: number,
    nz: number,
    allowLiftShaft?: boolean,
    ignoreChair?: TrackedChairCollider,
    radius?: number
  ): { x: number; z: number } {
    const inStairwell = lv >= 0 && nx >= 20.1 && nx <= 24.4 && nz <= 8.45;
    const minDist = inStairwell ? 0.34 : 0.48;
    const minDistSq = minDist * minDist;
    const py = actor.g.position.y;
    let rx = nx;
    let rz = nz;

    const pushFrom = (other: PersonActor) => {
      if (other === actor || !other.g.visible) return;
      const st = (other as { state?: string }).state;
      if (st === 'inCab' || st === 'away') return;
      if (Math.abs(other.g.position.y - py) > (inStairwell ? 0.52 : 0.65)) return;
      const dx = rx - other.g.position.x;
      const dz = rz - other.g.position.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        const d = Math.sqrt(dSq);
        if (d > 0.001) {
          rx = other.g.position.x + (dx / d) * minDist;
          rz = other.g.position.z + (dz / d) * minDist;
        } else {
          rx += 0.22;
        }
      }
    };

    for (let i = 0; i < this.STAFF.length; i++) pushFrom(this.STAFF[i]);
    pushFrom(this.guideActor);

    const safe = resolveObstaclePosition(lv, rx, rz, {
      allowLiftShaft,
      ignoreChair,
      radius,
      pedestrianOnly: true,
    });
    return { x: safe.x, z: safe.z };
  }

  private walkPt(
    P: PersonActor,
    gx: number,
    gz: number,
    dt: number,
    opts?: { allowLiftShaft?: boolean; ignoreChair?: TrackedChairCollider; radius?: number; elevationLv?: number }
  ): boolean {
    const dx = gx - P.g.position.x;
    const dz = gz - P.g.position.z;
    const dist = Math.hypot(dx, dz);
    const actorState = (P as { state?: string }).state;
    const lv = this.levelFromY(P.g.position.y);

    if (dist < 0.09) {
      let fx = gx;
      let fz = gz;
      if (actorState !== 'inCab') {
        const safe = resolveObstaclePosition(lv, gx, gz, {
          allowLiftShaft: opts?.allowLiftShaft,
          ignoreChair: opts?.ignoreChair,
          radius: opts?.radius,
          pedestrianOnly: true,
        });
        fx = safe.x;
        fz = safe.z;
      }
      P.g.position.x = fx;
      P.g.position.z = fz;
      if (actorState !== 'inCab' && (opts?.elevationLv !== undefined || lv === 0)) {
        const elevLv = opts?.elevationLv ?? 0;
        const effLv = opts?.elevationLv !== undefined && fx > 22.25 && fz > 7.85 ? elevLv + 1 : elevLv;
        P.g.position.y = this.groundElevationAt(effLv, fx, fz);
      }
      P.moving = false;
      return true;
    }

    const totalStep = Math.min(dist, (P.speed || 2.5) * dt);
    const subs = Math.max(1, Math.ceil(totalStep / 0.08));
    const subLen = totalStep / subs;
    const ux = dx / dist;
    const uz = dz / dist;

    let nx = P.g.position.x;
    let nz = P.g.position.z;

    for (let s = 0; s < subs; s++) {
      nx += ux * subLen;
      nz += uz * subLen;
      if (actorState !== 'inCab') {
        const safe = resolveObstaclePosition(lv, nx, nz, {
          allowLiftShaft: opts?.allowLiftShaft,
          ignoreChair: opts?.ignoreChair,
          radius: opts?.radius,
          pedestrianOnly: true,
        });
        nx = safe.x;
        nz = safe.z;
      }
    }

    if (actorState !== 'inCab') {
      const sep = this.resolveCharacterSeparation(
        P,
        lv,
        nx,
        nz,
        opts?.allowLiftShaft,
        opts?.ignoreChair,
        opts?.radius
      );
      nx = sep.x;
      nz = sep.z;
      if (opts?.elevationLv !== undefined || lv === 0) {
        const elevLv = opts?.elevationLv ?? 0;
        const effLv = opts?.elevationLv !== undefined && nx > 22.25 && nz > 7.85 ? elevLv + 1 : elevLv;
        P.g.position.y = this.groundElevationAt(effLv, nx, nz);
      }
    }

    P.g.position.x = nx;
    P.g.position.z = nz;
    P.tyaw = Math.atan2(dx, dz);
    P.moving = true;

    if (Math.hypot(gx - nx, gz - nz) < 0.11) {
      P.moving = false;
      return true;
    }
    return false;
  }

  private followNavPath(
    P: PersonActor & { navQueue?: Array<{ x: number; z: number }>; navKey?: string; laneZ?: number },
    lv: number,
    key: string,
    toX: number,
    toZ: number,
    dt: number,
    options?: {
      useHomeDock?: { homeX: number; homeZ: number; chairCollider?: TrackedChairCollider; behindCounter?: boolean };
      endBeforeDock?: boolean;
      allowLiftShaftAtEnd?: boolean;
      walkSpeed?: number;
    }
  ): boolean {
    if (P.navKey !== key || !P.navQueue) {
      let fromX = P.g.position.x;
      let fromZ = P.g.position.z;
      const prefix: Array<{ x: number; z: number }> = [];
      const dock = options?.useHomeDock
        ? getChairDockPoint(lv, options.useHomeDock.homeX, options.useHomeDock.homeZ)
        : null;
      if (dock && Math.hypot(fromX - options!.useHomeDock!.homeX, fromZ - options!.useHomeDock!.homeZ) < 0.72) {
        prefix.push(dock);
        fromX = dock.x;
        fromZ = dock.z;
      }
      const targetDock = options?.endBeforeDock && dock ? dock : { x: toX, z: toZ };
      // Spread corridor travel across personal Z lanes (8.95..9.83) so hallway traffic never queues single-file
      let body: Array<{ x: number; z: number }>;
      const laneZ = P.laneZ;
      if (
        laneZ !== undefined &&
        lv >= 0 &&
        Math.abs(targetDock.x - fromX) > 7.0 &&
        targetDock.z >= 8.2 &&
        fromZ >= 7.0
      ) {
        const midX = (fromX + targetDock.x) * 0.5;
        const midCheck = resolveObstaclePosition(lv, midX, laneZ, { pedestrianOnly: true });
        if (!midCheck.blocked) {
          body = [
            ...buildObstacleAwarePath(lv, fromX, fromZ, midCheck.x, midCheck.z, {
              ignoreChair: options?.useHomeDock?.chairCollider,
            }),
            ...buildObstacleAwarePath(lv, midCheck.x, midCheck.z, targetDock.x, targetDock.z, {
              ignoreChair: options?.useHomeDock?.chairCollider,
            }),
          ];
        } else {
          body = buildObstacleAwarePath(lv, fromX, fromZ, targetDock.x, targetDock.z, {
            ignoreChair: options?.useHomeDock?.chairCollider,
          });
        }
      } else {
        body = buildObstacleAwarePath(lv, fromX, fromZ, targetDock.x, targetDock.z, {
          ignoreChair: options?.useHomeDock?.chairCollider,
        });
      }
      if (options?.endBeforeDock && dock) {
        body.push({ x: toX, z: toZ });
      }
      P.navQueue = [...prefix, ...body];
      P.navKey = key;
    }

    while (P.navQueue.length > 0 && Math.hypot(P.navQueue[0].x - P.g.position.x, P.navQueue[0].z - P.g.position.z) < 0.1) {
      P.navQueue.shift();
    }
    if (P.navQueue.length === 0) {
      P.moving = false;
      return true;
    }

    const wp = P.navQueue[0];
    const isLast = P.navQueue.length === 1;
    const nearHomeSeat = options?.useHomeDock
      ? Math.hypot(P.g.position.x - options.useHomeDock.homeX, P.g.position.z - options.useHomeDock.homeZ) < 0.85 ||
        Math.hypot(wp.x - options.useHomeDock.homeX, wp.z - options.useHomeDock.homeZ) < 0.25
      : false;
    const ignoreChair = nearHomeSeat ? options?.useHomeDock?.chairCollider : undefined;
    const radius = ignoreChair
      ? 0.11
      : nearHomeSeat && options?.useHomeDock?.behindCounter
        ? 0.14
        : undefined;

    const prevSpd = P.speed;
    if (options?.walkSpeed !== undefined) P.speed = options.walkSpeed;
    const reached = this.walkPt(P, wp.x, wp.z, dt, {
      allowLiftShaft: isLast && options?.allowLiftShaftAtEnd,
      ignoreChair,
      radius,
    });
    P.speed = prevSpd;
    if (reached) {
      P.navQueue.shift();
    }
    if (P.navQueue.length === 0) {
      P.moving = false;
      return true;
    }
    return false;
  }

  private buildSingleFlightWaypoints(
    flightLv: number,
    dir: 1 | -1,
    targetLv: number,
    jitter = 0
  ): Array<{ x: number; z: number }> {
    const xLeft = Math.max(20.65, Math.min(21.72, 21.18 + jitter));
    const xRight = Math.max(22.8, Math.min(23.85, 23.32 + jitter));
    if (dir === 1) {
      const pts = [
        { x: xLeft, z: 7.75 },
        { x: xLeft, z: 1.98 },
        { x: xRight, z: 1.98 },
        { x: xRight, z: 7.75 },
        { x: xRight, z: 8.55 },
      ];
      if (flightLv + 1 < targetLv) {
        pts.push({ x: xRight, z: 8.75 }, { x: xLeft, z: 8.75 });
      }
      return pts;
    }
    const pts = [
      { x: xRight, z: 7.75 },
      { x: xRight, z: 1.98 },
      { x: xLeft, z: 1.98 },
      { x: xLeft, z: 7.75 },
      { x: xLeft, z: 8.55 },
    ];
    if (flightLv > targetLv) {
      pts.push({ x: xLeft, z: 8.75 }, { x: xRight, z: 8.75 });
    }
    return pts;
  }

  private stepStairTravel(p: StairTraveller, dt: number): boolean {
    if (p.stairLv === undefined || p.stairDir === undefined || p.stairTargetLv === undefined) {
      return true;
    }
    if (!p.stairQueue || p.stairQueue.length === 0) {
      p.stairQueue = this.buildSingleFlightWaypoints(
        p.stairLv,
        p.stairDir,
        p.stairTargetLv,
        p.stairJitter || 0
      );
    }

    while (
      p.stairQueue.length > 0 &&
      Math.hypot(p.stairQueue[0].x - p.g.position.x, p.stairQueue[0].z - p.g.position.z) < 0.1
    ) {
      p.stairQueue.shift();
    }

    if (p.stairQueue.length > 0) {
      const wp = p.stairQueue[0];
      const prevSpd = p.speed;
      p.speed = 3.35; // Brisk faster stair climbing/descending speed
      const reached = this.walkPt(p, wp.x, wp.z, dt, {
        elevationLv: p.stairLv,
        radius: 0.14,
      });
      p.speed = prevSpd;
      if (reached) {
        p.stairQueue.shift();
      }
    }

    if (!p.stairQueue || p.stairQueue.length === 0) {
      if (p.stairDir === 1) {
        const arrivedLv = p.stairLv + 1;
        if (arrivedLv < p.stairTargetLv) {
          p.stairLv = arrivedLv;
          p.stairQueue = undefined;
          return false;
        }
        p.g.position.y = LV[p.stairTargetLv];
        p.stairLv = undefined;
        p.stairDir = undefined;
        p.stairTargetLv = undefined;
        p.stairQueue = undefined;
        return true;
      }
      const arrivedLv = p.stairLv;
      if (arrivedLv > p.stairTargetLv) {
        p.stairLv = arrivedLv - 1;
        p.stairQueue = undefined;
        return false;
      }
      p.g.position.y = LV[p.stairTargetLv];
      p.stairLv = undefined;
      p.stairDir = undefined;
      p.stairTargetLv = undefined;
      p.stairQueue = undefined;
      return true;
    }
    return false;
  }

  private cabCtl(sd: number, dt: number) {
    const c = this.cabs[sd];
    const slots = c.slots!;
    const cx = sd * LIFTX;
    const stopY = liftY(c.stop!);

    if (c.ph === 'idle') {
      const wait: number[] = [];
      for (let l = -2; l < FLOORS; l++) {
        if (this.hasWait(sd, l)) wait.push(l);
      }
      if (wait.length) {
        c.stop = wait.reduce((a, b) => (Math.abs(liftY(a) - c.y) < Math.abs(liftY(b) - c.y) ? a : b));
        c.ph = 'move';
      } else if (c.guide && this.tourSt === 'waitCab' && this.tourCab === sd) {
        c.stop = this.tourLv;
        c.ph = 'move';
      } else if (slots[0] || slots[1]) {
        const tgts: number[] = [];
        slots.forEach((p) => {
          if (p) {
            const w = p as WorkerActor & DayVisitorActor;
            tgts.push(w.state === 'inCab' ? (w.want === 'desk' && w.d ? w.d.lv : 0) : w.lv || 0);
          }
        });
        c.stop = tgts[0];
        c.ph = 'move';
      } else return;
    }

    if (c.ph === 'move') {
      const dy = stopY - c.y;
      if (Math.abs(dy) < 0.06) {
        c.y = stopY;
        c.g.position.y = stopY;
        c.ph = 'open';
        c.tm = 0.3;
        c.ex = 0;
        c.bd = 0;
        return;
      }
      const s = Math.min(Math.abs(dy), c.speed * dt);
      c.y += Math.sign(dy) * s;
      c.g.position.y = c.y;
      slots.forEach((p, i) => {
        if (p) (p as PersonActor).g.position.y = c.y;
        void i;
      });
      if (c.guide) this.guideActor.g.position.y = c.y;
      return;
    }

    if (c.ph === 'open') {
      c.tm = (c.tm || 0) - dt;
      if ((c.tm || 0) <= 0) {
        c.ph = 'exchange';
        c.busy = false;
      }
      return;
    }

    if (c.ph === 'exchange') {
      if (c.guide && !c.gw) {
        if (this.tourSt === 'waitCab' && Math.abs(c.y - liftY(this.tourLv)) < 0.1) {
          c.gw = true;
          return;
        }
        const dst = this.STOPS[this.tourI].lv;
        if (this.tourSt === 'toDest' && Math.abs(c.y - liftY(dst)) < 0.1) {
          c.gw = true;
          return;
        }
      }
      if (c.guide && c.gw) return;

      for (let i = 0; i < 2; i++) {
        const p = slots[i] as (WorkerActor & DayVisitorActor) | null;
        if (!p) continue;
        const tgt = p.want === 'desk' ? (p.d ? p.d.lv : p.lv) : 0;
        if (Math.abs(c.y - liftY(tgt)) < 0.1) {
          if (this.walkPt(p, cx - sd * 1.45, LANE, dt, { allowLiftShaft: true })) {
            slots[i] = null;
            p.cab = 0;
            p.g.position.y = c.y;
            p.navQueue = undefined;
            p.navKey = undefined;
            p.state = tgt === 0 ? 'out' : 'toDesk';
            c.ex = (c.ex || 0) + 1;
          }
          return;
        }
      }

      const empty = slots[0] ? (slots[1] ? -1 : 1) : 0;
      if (empty >= 0) {
        const cand = this.findWaiting(sd, c.stop!);
        if (cand) {
          c.busy = true;
          if (this.walkPt(cand, cx, LANE + (empty ? 0.35 : -0.35), dt, { allowLiftShaft: true })) {
            slots[empty] = cand;
            cand.state = 'inCab';
            cand.g.position.y = c.y;
            cand.tyaw = -sd * Math.PI / 2;
            c.bd = (c.bd || 0) + 1;
            c.busy = false;
          }
          return;
        }
      }

      if (c.ex || c.bd) {
        c.ph = 'close';
        c.tm = 0.25;
      } else {
        c.ph = 'idle';
      }
      return;
    }

    if (c.ph === 'close') {
      c.tm = (c.tm || 0) - dt;
      if ((c.tm || 0) <= 0) {
        if (c.guide) {
          c.stop = this.STOPS[this.tourI].lv;
          c.ph = 'move';
          return;
        }
        let next: number | null = null;
        slots.forEach((p) => {
          if (p) {
            const w = p as WorkerActor & DayVisitorActor;
            const tg = w.want === 'desk' ? (w.d ? w.d.lv : w.lv) : 0;
            if (next == null) next = tg;
          }
        });
        if (next != null) {
          c.stop = next;
          c.ph = 'move';
        } else {
          c.ph = 'idle';
        }
      }
    }
  }

  private hasWait(sd: number, lv: number): boolean {
    for (const p of this.WORKERS) {
      if (p.sd !== sd || p.state !== 'wait') continue;
      if ((p.want === 'desk' ? 0 : p.d.lv) === lv) return true;
    }
    for (const p of this.DAYONLY) {
      if (p.sd !== sd || p.state !== 'wait') continue;
      if ((p.state === 'wait' ? p.lv : 0) === lv) return true;
    }
    return false;
  }

  private findWaiting(sd: number, lv: number): (WorkerActor | DayVisitorActor) | null {
    for (const p of this.WORKERS) {
      if (p.sd !== sd || p.state !== 'wait') continue;
      if ((p.want === 'desk' ? 0 : p.d.lv) === lv) return p;
    }
    for (const p of this.DAYONLY) {
      if (p.sd !== sd || p.state !== 'wait') continue;
      if (p.lv === lv) return p;
    }
    return null;
  }

  private wantOf(p: WorkerActor, m: number): 'desk' | 'lunch' | 'home' {
    if (p.sh_shift === 0) {
      if (m < 450 || m >= 1030) return 'home';
      const ls = 740 + (p.lunch || 0) * 35;
      if (m >= ls && m < ls + 60) return 'lunch';
      return 'desk';
    }
    if (m < 870 || m >= 1340) return 'home';
    const ls = 1090 + (p.lunch || 0) * 30;
    if (m >= ls && m < ls + 50) return 'lunch';
    return 'desk';
  }

  private getDesignatedSpotsForActor(
    lv: number,
    homeX: number,
    homeZ: number,
    goal: 'stretch' | 'balcony' | 'coffeeBreak'
  ): Array<{ x: number; z: number; face: number }> {
    const out: Array<{ x: number; z: number; face: number }> = [];
    const dock = getChairDockPoint(lv, homeX, homeZ);

    if (goal === 'stretch') {
      if (dock) {
        out.push(
          { x: dock.x, z: dock.z, face: (Math.random() - 0.5) * 1.2 },
          { x: dock.x, z: Math.min(9.8, dock.z + 0.45), face: 0 }
        );
      } else if (lv === 0 && Math.abs(homeX) < 3.7 && homeZ < 5.7) {
        out.push({ x: homeX < 0 ? -4.3 : 4.3, z: 4.4, face: 0 });
      } else if (lv >= 0) {
        out.push(
          { x: homeX, z: Math.min(9.75, Math.max(2.0, homeZ + 0.7)), face: 0 },
          { x: homeX < 0 ? homeX + 0.8 : homeX - 0.8, z: Math.min(9.75, Math.max(2.0, homeZ)), face: 0 }
        );
      } else {
        out.push({ x: homeX, z: homeZ, face: 0 });
      }
      return out;
    }

    if (goal === 'coffeeBreak') {
      if (lv === 4) {
        out.push(
          { x: -16.2, z: 2.8, face: Math.PI },
          { x: -17.4, z: 2.85, face: Math.PI },
          { x: -15.6, z: 3.3, face: -Math.PI * 0.75 },
          { x: -13.8, z: 6.8, face: Math.PI },
          { x: -24.8, z: 7.2, face: Math.PI }
        );
      } else if (lv === 2) {
        out.push(
          { x: -27.4, z: 6.8, face: -Math.PI / 2 },
          { x: -25.2, z: 7.2, face: -Math.PI / 2 },
          { x: -23.7, z: 4.2, face: Math.PI / 2 },
          { x: -14.2, z: 6.8, face: 0 },
          { x: -5.8, z: 6.8, face: 0 },
          { x: 4.2, z: 6.8, face: 0 },
          { x: 14.2, z: 6.8, face: 0 }
        );
      } else if (lv === 3) {
        out.push(
          { x: -28.4, z: 2.1, face: -Math.PI / 2 },
          { x: -24.8, z: 4.2, face: Math.PI },
          { x: -22.2, z: 6.2, face: 0 },
          { x: -14.2, z: 6.8, face: 0 },
          { x: -5.8, z: 6.8, face: 0 },
          { x: 4.2, z: 6.8, face: 0 },
          { x: 14.2, z: 6.8, face: 0 }
        );
      } else if (lv === 1) {
        out.push(
          { x: -22.6, z: 4.9, face: Math.PI },
          { x: -23.8, z: 7.4, face: -Math.PI / 2 },
          { x: -14.2, z: 6.8, face: 0 },
          { x: -5.8, z: 6.8, face: 0 },
          { x: 4.2, z: 6.8, face: 0 },
          { x: 14.2, z: 6.8, face: 0 }
        );
      } else if (lv === 0) {
        out.push(
          { x: -5.4, z: 7.4, face: 0 },
          { x: 5.4, z: 7.4, face: 0 },
          { x: -14.2, z: 6.8, face: 0 },
          { x: 14.2, z: 6.8, face: 0 },
          { x: -23.3, z: 7.2, face: 0 }
        );
      } else if (lv === 5) {
        out.push(
          { x: -25.0, z: 6.4, face: Math.PI },
          { x: -22.8, z: 6.6, face: -Math.PI / 2 },
          { x: -17.5, z: 7.2, face: 0 },
          { x: -7.5, z: 7.2, face: 0 },
          { x: 17.6, z: 5.8, face: 0 }
        );
      }
      return out;
    }

    // 'balcony' — well-spaced open atrium viewpoints (never densely bunched)
    if (lv === 0) {
      out.push(
        { x: -25.8, z: 9.55, face: 0 },
        { x: -6.2, z: 9.55, face: 0 },
        { x: 6.2, z: 9.55, face: 0 },
        { x: 25.5, z: 9.55, face: 0 }
      );
    } else if (lv === 4) {
      out.push(
        { x: -26.2, z: 9.65, face: 0 },
        { x: -13.4, z: 9.65, face: 0 },
        { x: 0.0, z: 9.65, face: 0 },
        { x: 13.4, z: 9.65, face: 0 },
        { x: 25.8, z: 9.65, face: 0 }
      );
    } else if (lv === 5) {
      out.push(
        { x: -26.2, z: 9.65, face: 0 },
        { x: -12.5, z: 9.65, face: 0 },
        { x: -2.5, z: 9.65, face: 0 },
        { x: 12.6, z: 9.65, face: 0 },
        { x: 25.8, z: 9.65, face: 0 }
      );
    } else {
      out.push(
        { x: -26.0, z: 9.6, face: 0 },
        { x: -14.8, z: 9.6, face: 0 },
        { x: -4.8, z: 9.6, face: 0 },
        { x: 4.8, z: 9.6, face: 0 },
        { x: 14.8, z: 9.6, face: 0 },
        { x: 25.6, z: 9.6, face: 0 }
      );
    }
    return out;
  }

  private countHallwayLingerers(lv: number): number {
    if (lv < 0) return 0;
    let n = 0;
    const fy = LV[lv] ?? 0;
    for (let i = 0; i < this.STAFF.length; i++) {
      const other = this.STAFF[i];
      if (!other.g.visible || Math.abs(other.g.position.y - fy) > 0.6) continue;
      const oag = this.freeAgents.get(other);
      if (oag && oag.lv === lv && (oag.mode === 'toGoal' || oag.mode === 'atGoal') && other.g.position.z >= 8.65) {
        n++;
      }
    }
    return n;
  }

  private decideFreeWill(actor: PersonActor, forceMove = false) {
    const ag = this.freeAgents.get(actor);
    const brain = actor.brain;
    if (!ag || !brain) return;

    // Drift internal needs realistically
    if (ag.mode === 'home') {
      brain.energy = Math.max(18, brain.energy - (6 + Math.random() * 8));
      brain.social = Math.max(15, brain.social - (4 + Math.random() * 7));
      brain.focus = Math.min(98, brain.focus + 5);
    } else {
      brain.energy = Math.min(98, brain.energy + (8 + Math.random() * 10));
      brain.social = Math.min(98, brain.social + 6);
    }

    const r = Math.random();
    let goal: FreeGoal = 'work';
    const hallwayBusy = this.countHallwayLingerers(ag.lv) >= 2;

    if (ag.lv < 0) {
      if (ag.isDeskWorker) {
        if (ag.mode !== 'home') {
          goal = r < 0.68 && !forceMove ? 'work' : r < 0.85 ? 'inspect' : 'socialize';
        } else {
          goal = r < 0.54 && !forceMove ? 'work' : r < 0.8 ? 'inspect' : r < 0.92 ? 'socialize' : 'stretch';
        }
      } else if (forceMove || r < 0.72) {
        goal = r < 0.4 ? 'inspect' : r < 0.62 ? 'patrol' : 'socialize';
      } else {
        goal = 'stretch';
      }
    } else if (brain.identity.topicKey === 'security') {
      goal = r < 0.56 ? 'patrol' : r < 0.8 ? 'socialize' : hallwayBusy ? 'coffeeBreak' : 'balcony';
    } else {
      const tired = brain.energy < 46;
      const lonely = brain.social < 42;
      if (forceMove || ag.mode === 'home') {
        const wStay = forceMove ? 0 : tired ? 0.34 : 0.6;
        if (r < wStay) {
          goal = 'work';
        } else if (r < wStay + (tired ? 0.24 : 0.14)) {
          goal = 'stretch';
        } else if (r < wStay + (tired ? 0.32 : 0.2)) {
          goal = hallwayBusy ? 'stretch' : 'balcony';
        } else if (r < wStay + (lonely ? 0.74 : 0.44)) {
          goal = 'socialize';
        } else {
          goal = 'coffeeBreak';
        }
      } else {
        goal = r < 0.8 && !forceMove ? 'work' : hallwayBusy ? 'socialize' : r < 0.9 ? 'balcony' : 'socialize';
      }
    }

    const curX = actor.g.position.x;
    const curZ = actor.g.position.z;
    const homeDock = getChairDockPoint(ag.lv, ag.homeX, ag.homeZ);
    const leaveWithDock = (destX: number, destZ: number) => {
      if (homeDock && Math.hypot(curX - ag.homeX, curZ - ag.homeZ) < 0.72) {
        return [
          homeDock,
          ...buildObstacleAwarePath(ag.lv, homeDock.x, homeDock.z, destX, destZ, {
            ignoreChair: ag.chairCollider,
          }),
        ];
      }
      return buildObstacleAwarePath(ag.lv, curX, curZ, destX, destZ, {
        ignoreChair: ag.chairCollider,
      });
    };

    ag.stuckTime = 0;
    ag.replanCount = 0;
    ag.lastX = curX;
    ag.lastZ = curZ;

    if (goal === 'work') {
      brain.goal = 'work';
      const thoughtPack = pickThoughtForGoal(brain, 'work');
      setBrainThought(brain, thoughtPack.mood, thoughtPack.actionLabel, thoughtPack.thought);
      brain.nextDecisionIn = 12 + Math.random() * 16;
      const distHome = Math.hypot(curX - ag.homeX, curZ - ag.homeZ);
      if (distHome > 0.22) {
        ag.mode = 'toHome';
        if (homeDock) {
          ag.queue = [
            ...buildObstacleAwarePath(ag.lv, curX, curZ, homeDock.x, homeDock.z, {
              ignoreChair: ag.chairCollider,
            }),
            { x: ag.homeX, z: ag.homeZ },
          ];
        } else {
          ag.queue = buildObstacleAwarePath(ag.lv, curX, curZ, ag.homeX, ag.homeZ, {
            ignoreChair: ag.chairCollider,
          });
        }
        ag.targetPose = actor.modes ? pickMode(actor.modes) : ag.homePose;
        ag.targetFace = ag.homeFace;
        this.setSafePose(actor, 'stand');
      } else {
        ag.mode = 'home';
        ag.queue = [];
        actor.g.position.x = ag.homeX;
        actor.g.position.z = ag.homeZ;
        actor.tyaw = ag.homeFace;
        this.setSafePose(actor, actor.modes ? pickMode(actor.modes) : ag.homePose);
      }
      return;
    }

    if (goal === 'socialize') {
      const peers = this.STAFF.filter(
        (other) =>
          other !== actor &&
          other.g.visible &&
          other.brain &&
          Math.abs(other.g.position.y - actor.g.position.y) < 0.6 &&
          Math.hypot(other.g.position.x - curX, other.g.position.z - curZ) > 0.8
      );
      if (peers.length > 0) {
        const shuffled = peers.slice().sort(() => Math.random() - 0.5).slice(0, 4);
        for (const peer of shuffled) {
          const px = peer.g.position.x;
          const pz = peer.g.position.z;
          const peerAg = this.freeAgents.get(peer);
          const peerDock = getChairDockPoint(ag.lv, px, pz);
          const candidates = peerDock
            ? [peerDock]
            : [
                { x: px + 0.85, z: pz },
                { x: px - 0.85, z: pz },
                { x: px, z: pz + 0.85 },
                { x: px, z: pz - 0.85 },
              ];
          let pickedStand: { x: number; z: number } | null = null;
          for (const c of candidates) {
            const check = resolveObstaclePosition(ag.lv, c.x, c.z, { pedestrianOnly: true });
            if (
              !check.blocked &&
              Math.hypot(check.x - px, check.z - pz) >= 0.55 &&
              hasLineOfSight(ag.lv, check.x, check.z, px, pz, {
                pedestrianOnly: true,
                ignoreChair: peerAg?.chairCollider,
                radius: 0.12,
              })
            ) {
              pickedStand = { x: check.x, z: check.z };
              break;
            }
          }
          if (pickedStand) {
            brain.goal = 'socialize';
            const faceToPeer = Math.atan2(px - pickedStand.x, pz - pickedStand.z);
            const thoughtPack = pickThoughtForGoal(brain, 'socialize', peer.brain!.identity.name);
            setBrainThought(brain, thoughtPack.mood, thoughtPack.actionLabel, thoughtPack.thought);
            brain.nextDecisionIn = 10 + Math.random() * 9;
            ag.mode = 'toGoal';
            ag.queue = leaveWithDock(pickedStand.x, pickedStand.z);
            ag.targetPose = Math.random() < 0.55 ? 'talk' : 'collaborate';
            ag.targetFace = faceToPeer;
            this.setSafePose(actor, 'stand');
            return;
          }
        }
      }
      goal = ag.lv < 0 ? 'inspect' : 'balcony';
    }

    if (goal === 'stretch' || goal === 'balcony' || goal === 'coffeeBreak') {
      brain.goal = goal;
      const thoughtPack = pickThoughtForGoal(brain, goal);
      setBrainThought(brain, thoughtPack.mood, thoughtPack.actionLabel, thoughtPack.thought);
      brain.nextDecisionIn = goal === 'stretch' ? 8 + Math.random() * 8 : 10 + Math.random() * 10;

      const spots = this.getDesignatedSpotsForActor(ag.lv, ag.homeX, ag.homeZ, goal);
      // Shuffle and prefer spots nearest to same wing/half when possible
      const validSpots: Array<{ x: number; z: number; face: number }> = [];
      for (const sp of spots) {
        const check = resolveObstaclePosition(ag.lv, sp.x, sp.z, { pedestrianOnly: true });
        if (!check.blocked) {
          validSpots.push({ x: check.x, z: check.z, face: sp.face });
        }
      }
      const chosen =
        validSpots.length > 0
          ? validSpots[Math.floor(Math.random() * validSpots.length)]
          : homeDock
            ? { x: homeDock.x, z: homeDock.z, face: 0 }
            : { x: curX, z: curZ, face: 0 };

      ag.mode = 'toGoal';
      ag.queue =
        Math.hypot(curX - chosen.x, curZ - chosen.z) > 0.25 ? leaveWithDock(chosen.x, chosen.z) : [];
      ag.targetPose =
        goal === 'stretch'
          ? Math.random() < 0.5
            ? 'hold'
            : 'stand'
          : goal === 'coffeeBreak' || Math.random() < 0.35
            ? 'coffee'
            : 'stand';
      ag.targetFace = chosen.face;
      if (ag.queue.length === 0) {
        ag.mode = 'atGoal';
        actor.tyaw = ag.targetFace;
        this.setSafePose(actor, ag.targetPose);
      } else {
        this.setSafePose(actor, 'stand');
      }
      return;
    }

    // Basement 'inspect' or 'patrol' (or ground security 'patrol')
    brain.goal = goal;
    const thoughtPack = pickThoughtForGoal(brain, goal);
    setBrainThought(brain, thoughtPack.mood, thoughtPack.actionLabel, thoughtPack.thought);
    brain.nextDecisionIn = 9 + Math.random() * 9;

    const stations: Array<{ x: number; z: number; face: number; pose: string }> =
      ag.lv === -1
        ? [
            { x: -6.5, z: 1.88, face: Math.PI, pose: 'inspectPanel' },
            { x: -2.5, z: 1.88, face: Math.PI, pose: 'readDoc' },
            { x: 1.5, z: 1.88, face: Math.PI, pose: 'hold' },
            { x: -1.6, z: 4.35, face: -Math.PI / 2, pose: 'hold' },
            { x: -8.5, z: 3.96, face: Math.PI, pose: 'inspectPanel' },
            { x: -5.4, z: 3.96, face: Math.PI, pose: 'readDoc' },
            { x: 5.6, z: 3.96, face: Math.PI, pose: 'inspectPanel' },
            { x: 5.6, z: 6.48, face: Math.PI, pose: 'inspectPanel' },
            { x: -8.5, z: 6.48, face: Math.PI, pose: 'inspectPanel' },
            { x: -11.82, z: 7.8, face: -Math.PI / 2, pose: 'inspectPanel' },
            { x: 8.6, z: 7.3, face: -Math.PI / 2, pose: 'carry' },
            { x: 0.6, z: 7.4, face: Math.PI, pose: 'radio' },
          ]
        : ag.lv === -2
          ? [
              { x: 7.55, z: 3.4, face: Math.PI / 2, pose: 'readDoc' },
              { x: 7.1, z: 5.3, face: 0, pose: 'radio' },
              { x: 9.2, z: 4.62, face: Math.PI, pose: 'inspectPanel' },
              { x: 2.8, z: 1.8, face: Math.PI, pose: 'inspectPanel' },
              { x: -3.5, z: 1.86, face: Math.PI, pose: 'inspectPanel' },
              { x: -7.5, z: 1.86, face: Math.PI, pose: 'readDoc' },
              { x: -3.5, z: 4.02, face: 0, pose: 'hold' },
              { x: -3.5, z: 5.82, face: Math.PI, pose: 'inspectPanel' },
              { x: 0.4, z: 7.4, face: -Math.PI / 2, pose: 'readDoc' },
              { x: 3.24, z: 8.9, face: -Math.PI / 2, pose: 'standLowCounter' },
              { x: 4.5, z: 6.85, face: Math.PI, pose: 'point' },
              { x: 4.4, z: 4.6, face: 0, pose: 'writeNotes' },
            ]
          : [
              { x: -5.2, z: 9.4, face: 0.15, pose: 'radio' },
              { x: 5.2, z: 9.4, face: -0.15, pose: 'stand' },
              { x: 4.6, z: 7.2, face: 0, pose: 'readDoc' },
              { x: -4.6, z: 7.4, face: 0.3, pose: 'hold' },
              { x: -23.3, z: 7.4, face: Math.PI, pose: 'radio' },
              { x: -23.3, z: 8.95, face: Math.PI, pose: 'stand' },
              { x: 0.2, z: 10.2, face: 0, pose: 'stand' },
            ];

    const pick = stations[Math.floor(Math.random() * stations.length)];
    ag.mode = 'toGoal';
    ag.queue = leaveWithDock(pick.x, pick.z);
    ag.targetPose = pick.pose;
    ag.targetFace = pick.face;
    this.setSafePose(actor, ag.targetPose === 'carry' ? 'carry' : 'stand');
  }

  private stepFreeAgent(actor: PersonActor, dt: number) {
    const ag = this.freeAgents.get(actor);
    const brain = actor.brain;
    if (!ag || !brain) return;

    if (ag.queue.length > 0) {
      const next = ag.queue[0];
      const dock = getChairDockPoint(ag.lv, ag.homeX, ag.homeZ);
      const distHome = Math.hypot(actor.g.position.x - ag.homeX, actor.g.position.z - ag.homeZ);
      const nearDockTarget = Math.hypot(next.x - ag.homeX, next.z - ag.homeZ) < 0.25;
      const nearSeat = Boolean(dock && (distHome < 0.85 || nearDockTarget));
      const ignoreChair = nearSeat ? ag.chairCollider : undefined;
      const behindCounter = ag.lv === 4 && ag.homeX < -14.8 && ag.homeZ < 0.72;
      const radius = ignoreChair ? 0.11 : nearSeat && behindCounter ? 0.14 : undefined;

      const prevSpd = actor.speed;
      actor.speed = ag.walkSpeed;
      const reached = this.walkPt(actor, next.x, next.z, dt, {
        ignoreChair,
        radius,
      });
      actor.speed = prevSpd;

      const moved = Math.hypot(actor.g.position.x - ag.lastX, actor.g.position.z - ag.lastZ);
      ag.lastX = actor.g.position.x;
      ag.lastZ = actor.g.position.z;
      if (moved < 0.08 * dt) {
        ag.stuckTime += dt;
      } else {
        ag.stuckTime = 0;
      }

      if (reached) {
        ag.stuckTime = 0;
        ag.replanCount = 0;
        ag.queue.shift();
        if (ag.queue.length === 0) {
          if (ag.mode === 'toHome') {
            actor.g.position.x = ag.homeX;
            actor.g.position.z = ag.homeZ;
          }
          actor.tyaw = ag.targetFace;
          this.setSafePose(actor, ag.targetPose);
          ag.mode = ag.mode === 'toHome' ? 'home' : 'atGoal';
        }
      } else if (ag.stuckTime > 0.9) {
        ag.stuckTime = 0;
        ag.replanCount++;
        const finalDest = ag.queue[ag.queue.length - 1];
        if (ag.replanCount <= 2 && finalDest) {
          if (ag.mode === 'toHome' && dock) {
            ag.queue = [
              ...buildObstacleAwarePath(ag.lv, actor.g.position.x, actor.g.position.z, dock.x, dock.z, {
                ignoreChair: ag.chairCollider,
              }),
              { x: ag.homeX, z: ag.homeZ },
            ];
          } else {
            ag.queue = buildObstacleAwarePath(ag.lv, actor.g.position.x, actor.g.position.z, finalDest.x, finalDest.z, {
              ignoreChair: ag.chairCollider,
            });
          }
        } else {
          ag.replanCount = 0;
          if (ag.mode === 'toHome' && distHome < 0.72) {
            ag.queue = [{ x: ag.homeX, z: ag.homeZ }];
          } else {
            this.decideFreeWill(actor, false);
          }
        }
      }
      return;
    }

    brain.nextDecisionIn -= dt;
    if (brain.nextDecisionIn <= 0) {
      this.decideFreeWill(actor, false);
    }
  }

  public nudgeCharacterFreeWill(actor: PersonActor) {
    const ag = this.freeAgents.get(actor);
    if (!ag || !actor.brain) {
      this.districtSim.nudgeCharacter(actor);
      return;
    }
    if (actor === this.guideActor && this.tourOn) return;
    this.decideFreeWill(actor, true);
  }

  public getAllActors(): PersonActor[] {
    return [...this.STAFF, ...this.districtSim.ACTORS, this.guideActor];
  }

  public isStaffVisible(): boolean {
    return this.peopleGroup.visible;
  }

  private wThink(p: WorkerActor, dt: number) {
    const w = this.wantOf(p, this.simMin);
    p.want = w;
    const gx = p.sd * GATE_STOP;
    const useStairs = p.d.lv > 0; // All L1-L3 department staff use the stairs for fast uncongested vertical travel

    if (p.state === 'away') {
      if (w === 'desk') {
        const sx = p.sd * (1.2 + Math.random() * 2.0);
        const sz = 15.0 + Math.random() * 3.0;
        p.g.visible = true;
        p.g.position.set(sx, this.groundElevationAt(0, sx, sz), sz);
        p.navQueue = undefined;
        p.navKey = undefined;
        p.stairQueue = undefined;
        this.setSafePose(p, 'stand');
        if (useStairs) {
          p.stairDir = 1;
          p.stairLv = 0;
          p.stairTargetLv = p.d.lv;
          p.state = 'toStairs';
        } else {
          p.state = 'toLift';
        }
        if (p.brain) {
          setBrainThought(
            p.brain,
            'Focused',
            'Arriving for shift',
            useStairs
              ? `Just arrived at DomainTechHub—taking the East stairs up to ${p.d.n}.`
              : `Just arrived at DomainTechHub—heading up to ${p.d.n}.`
          );
        }
      }
      return;
    }

    if (p.state === 'out') {
      if (SEATED_POSES.has(p.pose)) this.setSafePose(p, 'stand');
      const tx = p.sd * 2.2;
      const tz = w === 'lunch' ? 12.5 : 17.5;
      if (this.followNavPath(p, 0, `w-out-${w}-${p.sd}`, tx, tz, dt, { walkSpeed: 2.75 })) {
        if (w === 'home') {
          p.state = 'away';
          p.g.visible = false;
          p.navQueue = undefined;
          p.navKey = undefined;
        }
      } else if (w === 'desk') {
        p.navQueue = undefined;
        p.navKey = undefined;
        if (useStairs) {
          p.stairDir = 1;
          p.stairLv = 0;
          p.stairTargetLv = p.d.lv;
          p.stairQueue = undefined;
          p.state = 'toStairs';
        } else {
          p.state = 'toLift';
        }
      }
      return;
    }

    if (p.state === 'atDesk') {
      if (w !== 'desk') {
        const ag = this.freeAgents.get(p);
        if (ag) {
          ag.mode = 'home';
          ag.queue = [];
        }
        if (p.brain) {
          setBrainThought(
            p.brain,
            w === 'lunch' ? 'Relaxed' : 'Caffeinated',
            w === 'lunch' ? 'Taking stairs to lunch' : 'Wrapping up shift',
            w === 'lunch'
              ? 'Lunch window is open—heading down the East stairs for a proper meal.'
              : 'Great day’s work—heading down the stairs to catch my ride home.'
          );
        }
        p.navQueue = undefined;
        p.navKey = undefined;
        p.stairQueue = undefined;
        this.setSafePose(p, 'stand');
        if (useStairs) {
          p.stairDir = -1;
          p.stairLv = p.d.lv - 1;
          p.stairTargetLv = 0;
          p.state = 'toStairs';
        } else {
          p.state = 'toLift';
        }
      } else {
        this.stepFreeAgent(p, dt);
      }
      return;
    }

    if (p.state === 'toStairs') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      const goingUp = (p.stairDir ?? 1) === 1;
      const fromLv = goingUp ? 0 : p.d.lv;
      const entryX = (goingUp ? 21.18 : 23.32) + (p.stairJitter || 0);
      const entryZ = 8.55;
      if (
        this.followNavPath(p, fromLv, `w-stairs-${fromLv}-${p.stairDir}`, entryX, entryZ, dt, {
          walkSpeed: 2.85,
          useHomeDock: goingUp ? undefined : { homeX: p.seat.x, homeZ: p.seat.z, chairCollider: p.chairCollider },
        })
      ) {
        p.navQueue = undefined;
        p.navKey = undefined;
        p.stairLv = goingUp ? 0 : p.d.lv - 1;
        p.stairTargetLv = goingUp ? p.d.lv : 0;
        p.stairQueue = undefined;
        p.state = 'onStairs';
      }
      return;
    }

    if (p.state === 'onStairs') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      const goingUp = (p.stairDir ?? 1) === 1;
      if (this.stepStairTravel(p, dt)) {
        p.navQueue = undefined;
        p.navKey = undefined;
        p.state = goingUp ? 'toDesk' : 'out';
      }
      return;
    }

    if (p.state === 'toLift') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      const liftLv = w === 'desk' ? 0 : p.d.lv;
      if (
        this.followNavPath(p, liftLv, `w-lift-${liftLv}-${p.sd}`, gx, LANE, dt, {
          walkSpeed: 2.7,
          useHomeDock:
            w === 'desk'
              ? undefined
              : { homeX: p.seat.x, homeZ: p.seat.z, chairCollider: p.chairCollider },
        })
      ) {
        p.state = 'wait';
        p.tyaw = (p.sd * Math.PI) / 2;
        p.navQueue = undefined;
        p.navKey = undefined;
      }
      return;
    }

    if (p.state === 'toDesk') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      if (
        this.followNavPath(p, p.d.lv, `w-desk-${p.d.lv}`, p.seat.x, p.seat.z, dt, {
          walkSpeed: 2.75,
          useHomeDock: { homeX: p.seat.x, homeZ: p.seat.z, chairCollider: p.chairCollider },
          endBeforeDock: true,
        })
      ) {
        p.g.position.x = p.seat.x;
        p.g.position.z = p.seat.z;
        p.state = 'atDesk';
        p.tyaw = Math.PI;
        p.navQueue = undefined;
        p.navKey = undefined;
        this.setSafePose(p, p.modes ? pickMode(p.modes) : 'type');
        if (p.brain) {
          const tp = pickThoughtForGoal(p.brain, 'work');
          setBrainThought(p.brain, tp.mood, tp.actionLabel, tp.thought);
        }
      }
    }
  }

  private dThink(p: DayVisitorActor, dt: number) {
    const on = this.simMin >= 480 && this.simMin < 1050;
    const gx = p.sd * GATE_STOP;
    const behindCounter = p.lv === 4 && p.dx < -14.8 && p.dz < 0.72;
    const useStairs = p.lv > 0 && (p.lv <= 4 || p.dx >= -4);

    if (p.state === 'away') {
      if (on) {
        const sx = p.sd * 2.2;
        p.g.visible = true;
        p.g.position.set(sx, this.groundElevationAt(0, sx, 15.2), 15.2);
        p.navQueue = undefined;
        p.navKey = undefined;
        p.stairQueue = undefined;
        this.setSafePose(p, 'stand');
        if (useStairs) {
          p.stairDir = 1;
          p.stairLv = 0;
          p.stairTargetLv = p.lv;
          p.state = 'toStairs';
        } else {
          p.state = 'in';
        }
      }
      return;
    }
    if (p.state === 'in') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      if (p.lv === 0) {
        if (
          this.followNavPath(p, 0, `d-in0-${p.dx}-${p.dz}`, p.dx, p.dz, dt, {
            walkSpeed: 2.65,
            useHomeDock: { homeX: p.dx, homeZ: p.dz, chairCollider: p.chairCollider },
            endBeforeDock: true,
          })
        ) {
          p.g.position.x = p.dx;
          p.g.position.z = p.dz;
          p.state = 'atDesk';
          p.tyaw = p.df;
          p.navQueue = undefined;
          p.navKey = undefined;
          this.setSafePose(p, p.dpose);
        }
      } else if (this.followNavPath(p, 0, `d-inlift-${p.sd}`, gx, LANE, dt, { walkSpeed: 2.65 })) {
        p.state = 'wait';
        p.tyaw = (p.sd * Math.PI) / 2;
        p.navQueue = undefined;
        p.navKey = undefined;
      }
      return;
    }
    if (p.state === 'atDesk') {
      if (!on) {
        const ag = this.freeAgents.get(p);
        if (ag) {
          ag.mode = 'home';
          ag.queue = [];
        }
        p.navQueue = undefined;
        p.navKey = undefined;
        p.stairQueue = undefined;
        this.setSafePose(p, 'stand');
        if (p.lv === 0) {
          p.state = 'out';
        } else if (useStairs) {
          p.stairDir = -1;
          p.stairLv = p.lv - 1;
          p.stairTargetLv = 0;
          p.state = 'toStairs';
        } else {
          p.state = 'toLift';
        }
      } else {
        this.stepFreeAgent(p, dt);
      }
      return;
    }
    if (p.state === 'toStairs') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      const goingUp = (p.stairDir ?? 1) === 1;
      const fromLv = goingUp ? 0 : p.lv;
      const entryX = (goingUp ? 21.18 : 23.32) + (p.stairJitter || 0);
      const entryZ = 8.55;
      if (
        this.followNavPath(p, fromLv, `d-stairs-${fromLv}-${p.stairDir}`, entryX, entryZ, dt, {
          walkSpeed: 2.8,
          useHomeDock: goingUp
            ? undefined
            : {
                homeX: p.dx,
                homeZ: p.dz,
                chairCollider: p.chairCollider,
                behindCounter,
              },
        })
      ) {
        p.navQueue = undefined;
        p.navKey = undefined;
        p.stairLv = goingUp ? 0 : p.lv - 1;
        p.stairTargetLv = goingUp ? p.lv : 0;
        p.stairQueue = undefined;
        p.state = 'onStairs';
      }
      return;
    }
    if (p.state === 'onStairs') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      const goingUp = (p.stairDir ?? 1) === 1;
      if (this.stepStairTravel(p, dt)) {
        p.navQueue = undefined;
        p.navKey = undefined;
        p.state = goingUp ? 'toDesk' : 'out';
      }
      return;
    }
    if (p.state === 'toLift') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      if (
        this.followNavPath(p, p.lv, `d-lift-${p.lv}-${p.sd}`, gx, LANE, dt, {
          walkSpeed: 2.65,
          useHomeDock: {
            homeX: p.dx,
            homeZ: p.dz,
            chairCollider: p.chairCollider,
            behindCounter,
          },
        })
      ) {
        p.state = 'wait';
        p.tyaw = (p.sd * Math.PI) / 2;
        p.navQueue = undefined;
        p.navKey = undefined;
      }
      return;
    }
    if (p.state === 'toDesk') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      if (
        this.followNavPath(p, p.lv, `d-desk-${p.lv}`, p.dx, p.dz, dt, {
          walkSpeed: 2.75,
          useHomeDock: {
            homeX: p.dx,
            homeZ: p.dz,
            chairCollider: p.chairCollider,
            behindCounter,
          },
          endBeforeDock: true,
        })
      ) {
        p.g.position.x = p.dx;
        p.g.position.z = p.dz;
        p.state = 'atDesk';
        p.tyaw = p.df;
        p.navQueue = undefined;
        p.navKey = undefined;
        this.setSafePose(p, p.dpose);
      }
      return;
    }
    if (p.state === 'out') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      if (
        this.followNavPath(p, 0, `d-out-${p.sd}`, p.sd * 2.2, 17, dt, {
          walkSpeed: 2.75,
          useHomeDock: { homeX: p.dx, homeZ: p.dz, chairCollider: p.chairCollider },
        })
      ) {
        p.state = 'away';
        p.g.visible = false;
        p.navQueue = undefined;
        p.navKey = undefined;
      }
    }
  }

  private getTrafficNightFactor(m: number): number {
    const hr = m / 60;
    const dayPhase = Math.max(0, Math.min(1, (hr - 6.2) / 12.6));
    const sunElev = Math.sin(dayPhase * Math.PI);
    const isDay = hr >= 6.0 && hr <= 18.8;
    if (!isDay) return 1.0;
    if (sunElev < 0.28) return 1.0 - sunElev / 0.28;
    return 0.0;
  }

  private getStreetStopTarget(v: TrafficVehicle): number {
    let desiredSpd = v.cruiseSpd;

    // 1. Car-following distance keeping along the same street lane
    for (let j = 0; j < this.TRAF.length; j++) {
      const other = this.TRAF[j];
      if (other === v) continue;
      if (other.state !== 'street' && other.state !== 'toGate') continue;
      if (Math.abs(other.g.position.z - v.lane) > 2.3) continue;

      const ox = other.state === 'street' ? other.x : other.g.position.x;
      let fwdDist = (ox - v.x) * v.dir;
      if (fwdDist < -STREET_END) fwdDist += STREET_END * 2;
      if (fwdDist < 0 && other.state === 'street') fwdDist += STREET_END * 2;
      if (fwdDist <= 0.1 || fwdDist > 20) continue;

      const bumperGap = fwdDist - 4.9;
      if (bumperGap < 3.0) {
        desiredSpd = 0;
      } else if (bumperGap < 15.0) {
        const ratio = (bumperGap - 3.0) / 12.0;
        const followSpd = other.vel + (v.cruiseSpd - other.vel) * ratio;
        desiredSpd = Math.min(desiredSpd, Math.max(0, followSpd));
      }
    }

    // 2. Yield to player in Walk Mode or pedestrians crossing the street
    if (this.walkOn && Math.abs(this.walkPos.z - v.lane) < 2.6) {
      const pedAhead = (this.walkPos.x - v.x) * v.dir;
      if (pedAhead > 1.5 && pedAhead < 14.0) {
        desiredSpd = Math.min(desiredSpd, pedAhead < 5.5 ? 0 : v.cruiseSpd * ((pedAhead - 5.5) / 8.5));
      }
    }
    const npcActors = this.districtSim.ACTORS;
    for (let k = 0; k < npcActors.length; k++) {
      const npc = npcActors[k];
      if (!npc.g.visible) continue;
      if (Math.abs(npc.g.position.z - v.lane) > 2.1) continue;
      const pedAhead = (npc.g.position.x - v.x) * v.dir;
      if (pedAhead > 1.5 && pedAhead < 12.5) {
        desiredSpd = Math.min(desiredSpd, pedAhead < 5.0 ? 0 : v.cruiseSpd * ((pedAhead - 5.0) / 7.5));
      }
    }

    return desiredSpd;
  }

  private stepVeh(
    v: TrafficVehicle,
    pts: Array<[number, number]>,
    nxt: TrafficVehicle['state'],
    dt: number,
    onArrive?: () => void
  ): { yawRate: number; targetBrake: number; signalDir: -1 | 0 | 1 } {
    v._arr = v._arr || 0;
    const p = pts[v._arr];
    const dx = p[0] - v.g.position.x;
    const dz = p[1] - v.g.position.z;
    const dist = Math.hypot(dx, dz);

    // Yield briefly at driveway mouth before merging onto street
    if (v.pauseTimer > 0) {
      v.pauseTimer = Math.max(0, v.pauseTimer - dt);
      v.vel = Math.max(0, v.vel - 8.5 * dt);
      return { yawRate: 0, targetBrake: 0.9, signalDir: 1 };
    }

    if (dist < 0.28) {
      v.g.position.x = p[0];
      v.g.position.z = p[1];
      v._arr++;
      if (v._arr >= pts.length) {
        v._arr = 0;
        v.state = nxt;
        if (nxt === 'parked' && v.bay) {
          v.g.rotation.y = v.bay.face;
          v.vel = 0;
        }
        onArrive?.();
        return { yawRate: 0, targetBrake: 0.5, signalDir: 0 };
      }
      // Brief pause at street exit threshold (penultimate point before merging onto lane)
      if (nxt === 'street' && v._arr === pts.length - 1) {
        v.pauseTimer = 0.65;
      }
      return { yawRate: 0, targetBrake: 0.25, signalDir: 0 };
    }

    const ty = Math.atan2(dx, dz);
    const dy = Math.atan2(Math.sin(ty - v.g.rotation.y), Math.cos(ty - v.g.rotation.y));
    // Slow down smoothly for tight turns & final parking bay entry
    const isFinalBay = nxt === 'parked' && v._arr === pts.length - 1;
    const cornerFactor = Math.max(0.38, 1 - Math.abs(dy) * 0.55);
    let desiredSpd = v.spd * cornerFactor;
    if (isFinalBay && dist < 3.2) {
      desiredSpd = Math.max(1.2, (dist / 3.2) * v.spd * 0.75);
    }

    const prevVel = v.vel;
    if (v.vel < desiredSpd) {
      v.vel = Math.min(desiredSpd, v.vel + 3.4 * dt);
    } else {
      v.vel = Math.max(desiredSpd, v.vel - 6.2 * dt);
    }
    const accel = (v.vel - prevVel) / Math.max(0.001, dt);

    const step = Math.min(dist, v.vel * dt);
    v.g.position.x += (dx / dist) * step;
    v.g.position.z += (dz / dist) * step;

    const rotDelta = dy * Math.min(1, dt * (3.2 + v.vel * 0.65));
    v.g.rotation.y += rotDelta;
    const yawRate = rotDelta / Math.max(0.001, dt);

    const signalDir: -1 | 0 | 1 = dy > 0.16 ? -1 : dy < -0.16 ? 1 : 0;
    const targetBrake = accel < -0.5 || (isFinalBay && dist < 2.2) ? Math.min(1, Math.max(0.35, -accel / 4.5)) : 0;
    return { yawRate, targetBrake, signalDir };
  }

  private wantsVehicleParked(v: TrafficVehicle, m: number): boolean {
    if (!v.bay) return false;
    if (v.errand) {
      if (m < 420 || m >= 1140) return false;
      return ((m + v.errand.offset) % v.errand.cycleMin) < v.errand.parkMin;
    }
    return m >= (v.in_t || 0) && m < (v.out_t || 9999);
  }

  private updateTraffic(dt: number, m: number, elapsed: number) {
    const nightFactor = this.getTrafficNightFactor(m);

    for (const v of this.TRAF) {
      let yawRate = 0;
      let accel = 0;
      let targetBrake = 0;
      let targetSteer = 0;
      let signalDir: -1 | 0 | 1 = 0;
      let engineOn = true;

      const wantsPark = this.wantsVehicleParked(v, m);

      if (v.state === 'street') {
        if (
          v.bay &&
          wantsPark &&
          v.lane === v.bay.gateLane &&
          Math.abs(v.x - v.bay.gateX) < 3.4
        ) {
          v.state = 'toBay';
          v._arr = 0;
        } else {
          const desiredSpd = this.getStreetStopTarget(v);
          const prevVel = v.vel;
          if (v.vel < desiredSpd) {
            v.vel = Math.min(desiredSpd, v.vel + 3.8 * dt);
          } else {
            v.vel = Math.max(desiredSpd, v.vel - 7.8 * dt);
          }
          accel = (v.vel - prevVel) / Math.max(0.001, dt);
          v.x += v.dir * v.vel * dt;
          let wrapped = false;
          if (v.x > STREET_END) {
            v.x = -STREET_END;
            wrapped = true;
          } else if (v.x < -STREET_END) {
            v.x = STREET_END;
            wrapped = true;
          }
          if (wrapped && v.bay && v.lane !== v.bay.gateLane) {
            v.lane = v.bay.gateLane;
            v.dir = v.lane === LANE_EAST ? 1 : -1;
            v.x = v.dir > 0 ? -STREET_END : STREET_END;
          }
          v.g.position.x = v.x;
          v.g.position.z = v.lane;
          v.g.rotation.y = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

          // Signal slightly before turning into company entrance if bay is approaching
          if (v.bay && wantsPark && v.lane === v.bay.gateLane) {
            const dGate = (v.bay.gateX - v.x) * v.dir;
            if (dGate > 0 && dGate < 16) {
              signalDir = v.dir > 0 ? 1 : -1;
            }
          }

          targetBrake = accel < -0.45 || (v.vel < 0.8 && desiredSpd < 0.5) ? Math.min(1, Math.max(0.45, -accel / 4.5)) : 0;
        }
      } else if (v.state === 'parked' && v.bay) {
        v.vel = 0;
        engineOn = false;
        if (!wantsPark) {
          v.state = 'toGate';
          v._arr = 0;
          v.pauseTimer = 0.4;
        }
      } else if (v.state === 'toBay' && v.bay) {
        const b = v.bay;
        const prevVel = v.vel;
        const res = this.stepVeh(v, b.entryPts, 'parked', dt);
        accel = (v.vel - prevVel) / Math.max(0.001, dt);
        yawRate = res.yawRate;
        targetBrake = res.targetBrake;
        signalDir = res.signalDir;
      } else if (v.state === 'toGate' && v.bay) {
        const b = v.bay;
        const prevVel = v.vel;
        const res = this.stepVeh(v, b.exitPts, 'street', dt, () => {
          v.x = v.g.position.x;
          v.lane = b.exitLane;
          v.dir = b.exitLane === LANE_EAST ? 1 : -1;
          v.g.position.z = b.exitLane;
        });
        accel = (v.vel - prevVel) / Math.max(0.001, dt);
        yawRate = res.yawRate;
        targetBrake = res.targetBrake;
        signalDir = res.signalDir;
      }

      // Smooth ground surface height transition (-0.62 boulevard vs -0.604 company roads & lots)
      const onBoulevard = v.g.position.z >= 59.5 && v.g.position.z <= 73.5;
      const targetGroundY = onBoulevard ? -0.62 : -0.604;
      v.g.position.y += (targetGroundY - v.g.position.y) * Math.min(1, dt * 12);

      // Suspension kinematics (pitch on accel/brake, body roll in corners, subtle road ripple heave)
      const targetPitch =
        accel < -0.3
          ? Math.min(0.032, -accel * 0.0052)
          : accel > 0.3
            ? -Math.min(0.022, accel * 0.004)
            : 0;
      const targetRoll = Math.max(-0.045, Math.min(0.045, yawRate * v.vel * 0.0038));
      targetSteer = Math.max(-0.52, Math.min(0.52, yawRate * 0.16));

      const kSpr = Math.min(1, dt * 9);
      v.pitch += (targetPitch - v.pitch) * kSpr;
      v.roll += (targetRoll - v.roll) * kSpr;
      v.steer += (targetSteer - v.steer) * Math.min(1, dt * 11);
      v.brakeGlow += (targetBrake - v.brakeGlow) * Math.min(1, dt * 14);
      v.signalDir = signalDir;

      const roadHeave =
        v.vel > 0.5 ? Math.sin(elapsed * (5.0 + v.vel * 0.55) + v.phase) * 0.0035 * Math.min(1, v.vel / 4) : 0;

      updateCarVisualState(v.rig, {
        speed: v.vel,
        dt,
        elapsed,
        steerAngle: v.steer,
        pitch: v.pitch,
        roll: v.roll,
        heave: roadHeave,
        brakeIntensity: v.brakeGlow,
        nightFactor,
        engineOn,
        signalDir: v.signalDir,
      });
    }
  }

  public snapAll() {
    const m = this.simMin;
    this.guideNavQueue = [];
    this.guideNavKey = '';

    for (let i = 0; i < this.chairPairs.length; i++) {
      const { handle: ch, collider: col } = this.chairPairs[i];
      ch.curX = ch.restX;
      ch.curZ = ch.restZ;
      ch.curRot = ch.restRot;
      ch.group.position.x = ch.restX;
      ch.group.position.z = ch.restZ;
      ch.group.rotation.y = ch.restRot;
      col.curX = ch.restX;
      col.curZ = ch.restZ;
    }

    for (const p of this.WORKERS) {
      const w = this.wantOf(p, m);
      p.want = w;
      p.navQueue = undefined;
      p.navKey = undefined;
      p.stairQueue = undefined;
      p.stairLv = undefined;
      p.stairDir = undefined;
      p.stairTargetLv = undefined;
      const ag = this.freeAgents.get(p);
      if (ag) {
        ag.mode = 'home';
        ag.queue = [];
        ag.stuckTime = 0;
        ag.replanCount = 0;
      }
      if (w === 'desk') {
        p.state = 'atDesk';
        p.g.visible = true;
        p.g.position.set(p.seat.x, LV[p.d.lv], p.seat.z);
        p.yaw = p.tyaw = Math.PI;
        p.g.rotation.y = Math.PI;
        this.setSafePose(p, p.modes ? pickMode(p.modes) : 'type');
      } else {
        p.state = 'away';
        p.g.visible = false;
        this.setSafePose(p, 'stand');
      }
    }
    const dayOn = m >= 480 && m < 1050;
    for (const p of this.DAYONLY) {
      p.navQueue = undefined;
      p.navKey = undefined;
      p.stairQueue = undefined;
      p.stairLv = undefined;
      p.stairDir = undefined;
      p.stairTargetLv = undefined;
      const ag = this.freeAgents.get(p);
      if (ag) {
        ag.mode = 'home';
        ag.queue = [];
        ag.stuckTime = 0;
        ag.replanCount = 0;
      }
      if (dayOn) {
        p.state = 'atDesk';
        p.g.visible = true;
        p.g.position.set(p.dx, liftY(p.lv), p.dz);
        p.yaw = p.tyaw = p.df;
        p.g.rotation.y = p.df;
        this.setSafePose(p, p.dpose);
      } else {
        p.state = 'away';
        p.g.visible = false;
        this.setSafePose(p, 'stand');
      }
    }
    if (this.secOffActor) {
      const ag = this.freeAgents.get(this.secOffActor);
      if (ag) {
        ag.mode = 'home';
        ag.queue = [];
        ag.stuckTime = 0;
        ag.replanCount = 0;
        this.secOffActor.g.position.set(ag.homeX, liftY(ag.lv), ag.homeZ);
        this.secOffActor.yaw = this.secOffActor.tyaw = ag.homeFace;
        this.secOffActor.g.rotation.y = ag.homeFace;
        this.setSafePose(this.secOffActor, ag.homePose);
      }
    }
    for (const b of this.BASEMENT_STAFF) {
      const ag = this.freeAgents.get(b);
      if (ag) {
        ag.mode = 'home';
        ag.queue = [];
        ag.stuckTime = 0;
        ag.replanCount = 0;
        b.g.position.set(ag.homeX, liftY(ag.lv), ag.homeZ);
        b.yaw = b.tyaw = ag.homeFace;
        b.g.rotation.y = ag.homeFace;
        this.setSafePose(b, ag.homePose);
      }
    }
    const nightFactor = this.getTrafficNightFactor(m);
    for (const v of this.TRAF) {
      v.steer = 0;
      v.pitch = 0;
      v.roll = 0;
      v.brakeGlow = 0;
      v.signalDir = 0;
      v.pauseTimer = 0;
      v._arr = 0;
      if (!v.bay) {
        v.vel = v.cruiseSpd;
        updateCarVisualState(v.rig, {
          speed: 0,
          dt: 0,
          elapsed: 0,
          steerAngle: 0,
          pitch: 0,
          roll: 0,
          heave: 0,
          brakeIntensity: 0,
          nightFactor,
          engineOn: true,
          signalDir: 0,
        });
        continue;
      }
      if (this.wantsVehicleParked(v, m)) {
        v.state = 'parked';
        v.vel = 0;
        v.g.position.set(v.bay.x, -0.604, v.bay.z);
        v.g.rotation.y = v.bay.face;
        updateCarVisualState(v.rig, {
          speed: 0,
          dt: 0,
          elapsed: 0,
          steerAngle: 0,
          pitch: 0,
          roll: 0,
          heave: 0,
          brakeIntensity: 0,
          nightFactor,
          engineOn: false,
          signalDir: 0,
        });
      } else {
        v.state = 'street';
        v.vel = v.cruiseSpd;
        v.lane = v.bay.gateLane;
        v.dir = v.bay.gateLane === LANE_EAST ? 1 : -1;
        // Start errand fleet cars close to their company road gate so entries happen promptly
        v.x = v.errand ? v.bay.gateX - v.dir * (10 + (Math.abs(v.bay.gateX) & 7)) : (Math.random() - 0.5) * 210;
        v.g.position.set(v.x, -0.62, v.lane);
        v.g.rotation.y = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        updateCarVisualState(v.rig, {
          speed: 0,
          dt: 0,
          elapsed: 0,
          steerAngle: 0,
          pitch: 0,
          roll: 0,
          heave: 0,
          brakeIntensity: 0,
          nightFactor,
          engineOn: true,
          signalDir: 0,
        });
      }
    }
    this.districtSim.snapAll(m);
  }

  /* =========================================================
     TOUR CONTROL
     ========================================================= */
  private setTourCameraToStop(s: TourStop, camera: THREE.Camera, controls: OrbitControls) {
    const dist = s.n === 'Board Room' ? 17.5 : s.n === 'CEO Office' ? 16 : 15;
    const y0 = LV[s.lv];
    const camPos = new THREE.Vector3(s.cx + (s.cx > 8 ? -2 : 0), y0 + 2.8, dist);
    const camTgt = new THREE.Vector3(s.cx, y0 + 1.85, 3.4);
    this.tourCam = { on: true, pos: camPos, tgt: camTgt };
    void camera;
    void controls;
  }

  public startTour(index = 0, camera?: THREE.Camera, controls?: OrbitControls) {
    if (this.walkOn) this.exitWalk(camera, controls);
    this.tourOn = true;
    this.tourPlay = true;
    this.tourI = Math.max(0, Math.min(this.STOPS.length - 1, index));
    this.tourSt = 'idle';
    this.tourArr = false;
    this.tourHold = 0;
    this.guideActor.g.visible = true;
    this.guideNavQueue = [];
    this.guideNavKey = '';
    const gag = this.freeAgents.get(this.guideActor);
    if (gag) {
      gag.mode = 'home';
      gag.queue = [];
    }
    this.goStop(this.tourI, camera, controls);
  }

  public startTourAtRoom(roomName: string, camera: THREE.Camera, controls: OrbitControls) {
    const idx = this.STOPS.findIndex(
      (s) =>
        s.n === roomName ||
        s.room?.n === roomName ||
        (roomName === 'Reception Atrium' && s.n === 'Maintenance & Security') ||
        (roomName === 'Toilets' && s.n === 'Maintenance & Security') ||
        (roomName === 'Stairwell Core' && s.n === 'Maintenance & Security') ||
        (roomName.startsWith('Head of ') && s.n === 'Heads of Department') ||
        (roomName === 'Chief Executive Officer' && s.n === 'CEO Office') ||
        ((roomName === 'Executive Lounge' || roomName === 'Board Secretary') && s.n === 'Board Room')
    );
    this.startTour(idx >= 0 ? idx : 0, camera, controls);
  }

  public endTour() {
    this.tourOn = false;
    this.tourPlay = false;
    this.tourSt = 'idle';
    this.tourCam.on = false;
    this.guideNavQueue = [];
    this.guideNavKey = '';
    this.cabs[-1].guide = false;
    this.cabs[1].guide = false;
    this.cabs[-1].gw = false;
    this.cabs[1].gw = false;
    this.tourLv = 0;
    this.guideActor.g.position.set(14.5, 0, 9.65);
    this.guideActor.yaw = this.guideActor.tyaw = -0.3;
    setPose(this.guideActor, 'stand', this.P_LIB);
    const gag = this.freeAgents.get(this.guideActor);
    if (gag) {
      gag.lv = 0;
      gag.mode = 'home';
      gag.queue = [];
    }
    if (this.guideActor.brain) {
      const tp = pickThoughtForGoal(this.guideActor.brain, 'work');
      setBrainThought(this.guideActor.brain, tp.mood, tp.actionLabel, tp.thought);
    }
  }

  public goStop(i: number, camera?: THREE.Camera, controls?: OrbitControls) {
    this.tourI = ((i % this.STOPS.length) + this.STOPS.length) % this.STOPS.length;
    const s = this.STOPS[this.tourI];
    this.tourArr = false;
    this.tourHold = 0;
    this.tourCab = s.cx < 0 ? -1 : 1;
    this.guideNavQueue = [];
    this.guideNavKey = '';
    this.guideStairQueue = undefined;
    setPose(this.guideActor, 'stand', this.P_LIB);
    const floorDiff = Math.abs(s.lv - this.tourLv);
    if (this.tourLv === s.lv) {
      this.tourSt = 'toDest';
    } else if (floorDiff <= 3 && s.lv >= 0 && this.tourLv >= 0) {
      this.tourSt = 'toStairs';
      this.guideStairDir = s.lv > this.tourLv ? 1 : -1;
      this.guideStairLv = this.guideStairDir === 1 ? this.tourLv : this.tourLv - 1;
    } else {
      this.tourSt = 'toLift';
    }
    this.cabs[-1].guide = false;
    this.cabs[1].guide = false;
    this.cabs[-1].gw = false;
    this.cabs[1].gw = false;
    if (this.guideActor.brain) {
      setBrainThought(
        this.guideActor.brain,
        'Social',
        `Guiding tour to ${s.n}`,
        `Heading over to ${s.n}—let me show you what this team builds.`
      );
    }

    if (camera && controls) {
      this.setTourCameraToStop(s, camera, controls);
    }
  }

  public prevStop(camera: THREE.Camera, controls: OrbitControls) {
    this.goStop(this.tourI - 1, camera, controls);
  }

  public nextStop(camera: THREE.Camera, controls: OrbitControls) {
    this.goStop(this.tourI + 1, camera, controls);
  }

  public toggleTourPlay() {
    this.tourPlay = !this.tourPlay;
  }

  private guideStep(dt: number, t: number, camera: THREE.Camera, controls: OrbitControls) {
    this.guideMarker.position.y = 2.65 + Math.sin(t * 2.5) * 0.08;
    this.guideMarker.rotation.y += dt * 1.4;

    if (!this.tourOn) {
      this.stepFreeAgent(this.guideActor, dt);
      updatePersonKinematics(this.guideActor, dt, t, 0);
      return;
    }

    const s = this.STOPS[this.tourI];
    const sd = this.tourCab;
    const cx = sd * LIFTX;
    const c = this.cabs[sd];

    const stepGuideAlong = (lv: number, key: string, toX: number, toZ: number): boolean => {
      if (this.guideNavKey !== key) {
        this.guideNavQueue = buildObstacleAwarePath(lv, this.guideActor.g.position.x, this.guideActor.g.position.z, toX, toZ);
        this.guideNavKey = key;
      }
      while (
        this.guideNavQueue.length > 0 &&
        Math.hypot(this.guideNavQueue[0].x - this.guideActor.g.position.x, this.guideNavQueue[0].z - this.guideActor.g.position.z) < 0.1
      ) {
        this.guideNavQueue.shift();
      }
      if (this.guideNavQueue.length === 0) return true;
      const wp = this.guideNavQueue[0];
      const prevSpd = this.guideActor.speed;
      this.guideActor.speed = 2.95;
      const reached = this.walkPt(this.guideActor, wp.x, wp.z, dt);
      this.guideActor.speed = prevSpd;
      if (reached) {
        this.guideNavQueue.shift();
      }
      return this.guideNavQueue.length === 0;
    };

    if (this.tourSt === 'toStairs') {
      const goingUp = this.guideStairDir === 1;
      const entryX = goingUp ? 21.18 : 23.32;
      if (stepGuideAlong(this.tourLv, `g-stairs-${this.tourI}-${this.tourLv}`, entryX, 8.55)) {
        this.tourSt = 'onStairs';
        this.guideStairLv = goingUp ? this.tourLv : this.tourLv - 1;
        this.guideStairQueue = undefined;
        this.guideNavQueue = [];
        this.guideNavKey = '';
      }
    } else if (this.tourSt === 'onStairs') {
      if (!this.guideStairQueue || this.guideStairQueue.length === 0) {
        this.guideStairQueue = this.buildSingleFlightWaypoints(this.guideStairLv, this.guideStairDir, s.lv, 0);
      }
      while (
        this.guideStairQueue.length > 0 &&
        Math.hypot(this.guideStairQueue[0].x - this.guideActor.g.position.x, this.guideStairQueue[0].z - this.guideActor.g.position.z) < 0.1
      ) {
        this.guideStairQueue.shift();
      }
      if (this.guideStairQueue.length > 0) {
        const wp = this.guideStairQueue[0];
        const prevSpd = this.guideActor.speed;
        this.guideActor.speed = 3.35;
        const reached = this.walkPt(this.guideActor, wp.x, wp.z, dt, {
          elevationLv: this.guideStairLv,
          radius: 0.14,
        });
        this.guideActor.speed = prevSpd;
        if (reached) this.guideStairQueue.shift();
      }
      if (this.guideStairQueue.length === 0) {
        if (this.guideStairDir === 1) {
          const arrivedLv = this.guideStairLv + 1;
          if (arrivedLv < s.lv) {
            this.guideStairLv = arrivedLv;
            this.guideStairQueue = undefined;
          } else {
            this.tourLv = s.lv;
            this.guideActor.g.position.y = LV[s.lv];
            this.tourSt = 'toDest';
            this.guideNavQueue = [];
            this.guideNavKey = '';
          }
        } else {
          const arrivedLv = this.guideStairLv;
          if (arrivedLv > s.lv) {
            this.guideStairLv = arrivedLv - 1;
            this.guideStairQueue = undefined;
          } else {
            this.tourLv = s.lv;
            this.guideActor.g.position.y = LV[s.lv];
            this.tourSt = 'toDest';
            this.guideNavQueue = [];
            this.guideNavKey = '';
          }
        }
      }
    } else if (this.tourSt === 'toLift') {
      const gx = sd * (LIFTX - sd * 1.45);
      if (stepGuideAlong(this.tourLv, `g-lift-${this.tourI}-${this.tourLv}`, gx, LANE)) {
        this.tourSt = 'waitCab';
        this.guideActor.tyaw = (sd * Math.PI) / 2;
        c.guide = true;
        c.gw = false;
      }
    } else if (this.tourSt === 'waitCab') {
      if (c.ph === 'exchange' && Math.abs(c.y - liftY(this.tourLv)) < 0.1) {
        if (this.walkPt(this.guideActor, cx, LANE, dt, { allowLiftShaft: true })) {
          this.tourSt = 'toDest';
          this.tourLv = s.lv;
          this.guideNavQueue = [];
          this.guideNavKey = '';
          this.guideActor.tyaw = (-sd * Math.PI) / 2;
          c.gw = false;
        }
      }
    } else if (this.tourSt === 'toDest') {
      if (Math.abs(this.guideActor.g.position.y - LV[s.lv]) > 0.1) {
        this.guideActor.g.position.y = c.y;
        if (c.ph === 'exchange' && Math.abs(c.y - LV[s.lv]) < 0.1) {
          this.walkPt(this.guideActor, sd * (LIFTX - sd * 1.55), LANE, dt, { allowLiftShaft: true });
        }
      } else {
        if (c.guide && Math.abs(this.guideActor.g.position.x) > GATE_STOP) {
          this.walkPt(this.guideActor, sd * (LIFTX - sd * 1.55), LANE, dt, { allowLiftShaft: true });
          if (Math.abs(this.guideActor.g.position.x - sd * (LIFTX - sd * 1.55)) < 0.15) {
            c.guide = false;
            c.gw = false;
          }
        } else {
          const destX = s.cx + (s.cx < 0 ? 1.8 : -1.8);
          const destZ = 8.95;
          if (stepGuideAlong(s.lv, `g-dest-${this.tourI}`, destX, destZ)) {
            this.tourSt = 'arrived';
            this.tourArr = true;
            this.tourHold = 0;
            this.guideActor.tyaw = 0.2;
            setPose(this.guideActor, 'present', this.P_LIB);
            if (this.guideActor.brain) {
              setBrainThought(
                this.guideActor.brain,
                'Inspired',
                `Presenting ${s.n}`,
                s.text || `Welcome to ${s.n}!`
              );
            }
          }
        }
      }
    } else if (this.tourSt === 'arrived') {
      if (this.tourPlay) {
        this.tourHold += dt;
        if (this.tourHold > 6.5) {
          this.nextStop(camera, controls);
        }
      }
    }

    let glance = 0;
    this._camDir.subVectors(camera.position, this.guideActor.g.position);
    if (this._camDir.lengthSq() < 196 && this.tourSt === 'arrived') {
      const targetYaw = Math.atan2(this._camDir.x, this._camDir.z);
      let dYaw = Math.atan2(Math.sin(targetYaw - this.guideActor.yaw), Math.cos(targetYaw - this.guideActor.yaw));
      glance = Math.max(-0.5, Math.min(0.5, dYaw)) * 0.7;
    }

    updatePersonKinematics(this.guideActor, dt, t, glance);
  }

  /* =========================================================
     FIRST-PERSON WALKTHROUGH & AMBIENT ACTIVITY TELEMETRY
     ========================================================= */
  private initAmbientSources() {
    // 14 Department bays (L0-L3)
    for (const r of ROOMS) {
      const isChatty =
        r.t === 'hand' || r.t === 'social' || r.t === 'wa' || r.t === 'mkt' || r.t === 'cart';
      this.ambientSources.push({
        x: COLX[r.col],
        y: LV[r.lv] + 1.5,
        z: 4.8,
        activity: 1,
        typingWeight: isChatty ? 0.62 : 1.0,
        chatterWeight: isChatty ? 0.95 : 0.42,
        hvacWeight: 0.25,
      });
    }
    // Index 14: Ground Reception Lobby
    this.ambientSources.push({
      x: 0,
      y: LV[0] + 1.5,
      z: 6.4,
      activity: 1,
      typingWeight: 0.38,
      chatterWeight: 0.85,
      hvacWeight: 0.2,
    });
    // Index 15: L4 Board Room
    this.ambientSources.push({
      x: EXEC.board.cx,
      y: LV[4] + 1.5,
      z: 4.9,
      activity: 1,
      typingWeight: 0.2,
      chatterWeight: 1.0,
      hvacWeight: 0.25,
    });
    // Index 16: L4 Executive Lounge
    this.ambientSources.push({
      x: EXEC.lounge.cx,
      y: LV[4] + 1.5,
      z: 2.5,
      activity: 1,
      typingWeight: 0.25,
      chatterWeight: 0.72,
      hvacWeight: 0.22,
    });
    // Index 17: L4 Board Secretary
    this.ambientSources.push({
      x: EXEC.secr.cx,
      y: LV[4] + 1.5,
      z: 2.5,
      activity: 1,
      typingWeight: 0.85,
      chatterWeight: 0.35,
      hvacWeight: 0.2,
    });
    // Index 18: L5 HoDs + EA cluster
    this.ambientSources.push({
      x: -7.5,
      y: LV[5] + 1.5,
      z: 2.8,
      activity: 1,
      typingWeight: 0.78,
      chatterWeight: 0.55,
      hvacWeight: 0.22,
    });
    // Index 19: L5 CEO Suite
    this.ambientSources.push({
      x: EXEC.ceo.cx,
      y: LV[5] + 1.5,
      z: 2.8,
      activity: 1,
      typingWeight: 0.35,
      chatterWeight: 0.65,
      hvacWeight: 0.22,
    });
    // Index 20 & 21: B1 Server Hall & B2 Power Room (HVAC / cooling hum)
    this.ambientSources.push({
      x: 0,
      y: -3.1,
      z: 4.5,
      activity: 0,
      typingWeight: 0,
      chatterWeight: 0,
      hvacWeight: 1.0,
    });
    this.ambientSources.push({
      x: 0,
      y: -7.5,
      z: 4.5,
      activity: 0,
      typingWeight: 0,
      chatterWeight: 0,
      hvacWeight: 0.9,
    });
    // Index 22: Roof HVAC fans
    this.ambientSources.push({
      x: 0,
      y: 27.4,
      z: 5.0,
      activity: 0,
      typingWeight: 0,
      chatterWeight: 0,
      hvacWeight: 0.85,
    });
    // Indices 23..28 (base + 9 .. base + 14): West Wing rooms (Security, HR, Relax, Gym, Strategy, Gallery)
    [
      { x: -25, y: LV[0] + 1.5, z: 4.0, t: 0.7, c: 0.4, h: 0.25 },
      { x: -25, y: LV[1] + 1.5, z: 4.0, t: 0.75, c: 0.65, h: 0.2 },
      { x: -25, y: LV[2] + 1.5, z: 4.0, t: 0.15, c: 0.9, h: 0.18 },
      { x: -25, y: LV[3] + 1.5, z: 4.0, t: 0.1, c: 0.55, h: 0.3 },
      { x: -25, y: LV[4] + 1.5, z: 4.0, t: 0.5, c: 0.85, h: 0.22 },
      { x: -25, y: LV[5] + 1.5, z: 4.0, t: 0.2, c: 0.6, h: 0.18 },
    ].forEach((w) =>
      this.ambientSources.push({
        x: w.x,
        y: w.y,
        z: w.z,
        activity: 1,
        typingWeight: w.t,
        chatterWeight: w.c,
        hvacWeight: w.h,
      })
    );
  }

  public getAmbientSources(): readonly AmbientSource[] {
    // Update activity scores for each department based on live visible staff at desks/rooms
    for (let i = 0; i < ROOMS.length; i++) {
      const r = ROOMS[i];
      let present = 0;
      let typing = 0;
      let talking = 0;
      if (this.staffVisible) {
        for (let j = 0; j < this.WORKERS.length; j++) {
          const w = this.WORKERS[j];
          if (w.d === r && w.g.visible && w.state !== 'away') {
            const weight = w.state === 'atDesk' ? 1.0 : 0.45;
            present += weight;
            if (w.pose === 'type' || w.pose === 'standType') typing += weight;
            else if (w.pose === 'talk' || w.pose === 'phone') talking += weight;
            else typing += weight * 0.4;
          }
        }
      }
      const src = this.ambientSources[i];
      src.activity = Math.min(1, present / 2.2);
      if (present > 0.1) {
        src.typingWeight = Math.min(1, 0.35 + (typing / present) * 0.65);
        src.chatterWeight = Math.min(1, 0.25 + (talking / present) * 0.75);
      }
    }

    // Executive, reception & West Wing day-visitor zones
    let recAct = 0;
    let boardAct = 0;
    let loungeAct = 0;
    let secrAct = 0;
    let hodAct = 0;
    let ceoAct = 0;
    let secRoomAct = 0;
    let hrAct = 0;
    let relaxAct = 0;
    let gymAct = 0;
    let stratAct = 0;
    let galAct = 0;
    if (this.staffVisible) {
      for (let i = 0; i < this.DAYONLY.length; i++) {
        const d = this.DAYONLY[i];
        if (!d.g.visible || d.state === 'away') continue;
        const w = d.state === 'atDesk' ? 1 : 0.4;
        if (d.lv === 0) {
          if (d.dx < -20) secRoomAct += w;
          else recAct += w;
        } else if (d.lv === 1 && d.dx < -20) {
          hrAct += w;
        } else if (d.lv === 2 && d.dx < -20) {
          relaxAct += w;
        } else if (d.lv === 3 && d.dx < -20) {
          gymAct += w;
        } else if (d.lv === 4) {
          if (d.dx < -20) stratAct += w;
          else if (Math.abs(d.dx) < 8) boardAct += w;
          else if (d.dx < -10) loungeAct += w;
          else secrAct += w;
        } else if (d.lv === 5) {
          if (d.dx < -20) galAct += w;
          else if (d.dx > 8) ceoAct += w;
          else hodAct += w;
        }
      }
    }
    const base = ROOMS.length;
    this.ambientSources[base].activity = Math.min(1, recAct / 1.5);
    this.ambientSources[base + 1].activity = Math.min(1, boardAct / 3.0);
    this.ambientSources[base + 2].activity = Math.min(1, loungeAct);
    this.ambientSources[base + 3].activity = Math.min(1, secrAct);
    this.ambientSources[base + 4].activity = Math.min(1, hodAct / 3.0);
    this.ambientSources[base + 5].activity = Math.min(1, ceoAct);

    const b1Count = this.staffVisible
      ? this.BASEMENT_STAFF.filter((b) => b.lv === -1 && b.g.visible).length
      : 0;
    const b2Count = this.staffVisible
      ? this.BASEMENT_STAFF.filter((b) => b.lv === -2 && b.g.visible).length
      : 0;
    this.ambientSources[base + 6].activity = Math.min(1, b1Count / 4);
    this.ambientSources[base + 6].chatterWeight = b1Count > 0 ? 0.22 : 0;
    this.ambientSources[base + 7].activity = Math.min(1, b2Count / 4);
    this.ambientSources[base + 7].chatterWeight = b2Count > 0 ? 0.22 : 0;
    this.ambientSources[base + 9].activity = Math.min(1, secRoomAct / 1.5);
    this.ambientSources[base + 10].activity = Math.min(1, hrAct / 1.5);
    this.ambientSources[base + 11].activity = Math.min(1, relaxAct / 1.5);
    this.ambientSources[base + 12].activity = Math.min(1, gymAct / 1.5);
    this.ambientSources[base + 13].activity = Math.min(1, stratAct / 1.5);
    this.ambientSources[base + 14].activity = Math.min(1, galAct);

    return this.ambientSources;
  }

  private readonly _trafficHint = { level: 0, pan: 0, speedNorm: 0 };

  public getTrafficAudioHint(listenerPos: THREE.Vector3, listenerRight: THREE.Vector3) {
    let bestProx = 0;
    let panSum = 0;
    let spdSum = 0;
    let wSum = 0;

    for (let i = 0; i < this.TRAF.length; i++) {
      const v = this.TRAF[i];
      if (v.vel < 0.4) continue;
      const dx = v.g.position.x - listenerPos.x;
      const dy = v.g.position.y - listenerPos.y;
      const dz = v.g.position.z - listenerPos.z;
      const d = Math.hypot(dx, dy * 1.4, dz);
      const spdNorm = Math.min(1, v.vel / 12);
      const prox = (1 / (1 + Math.pow(d / 13.5, 2.1))) * (0.35 + 0.65 * spdNorm);
      if (prox < 0.01) continue;
      if (prox > bestProx) bestProx = prox;
      const invD = d > 0.001 ? 1 / d : 0;
      const pan = (dx * listenerRight.x + dy * listenerRight.y + dz * listenerRight.z) * invD;
      panSum += pan * prox;
      spdSum += spdNorm * prox;
      wSum += prox;
    }

    this._trafficHint.level = Math.min(1, bestProx * 1.15);
    this._trafficHint.pan = wSum > 0.001 ? panSum / wSum : 0;
    this._trafficHint.speedNorm = wSum > 0.001 ? spdSum / wSum : 0;
    return this._trafficHint;
  }

  private playFootstep() {
    this.onFootstep?.();
  }

  public enterWalk(camera: THREE.Camera, controls: OrbitControls, buildingId: BuildingId = 'hub') {
    if (this.tourOn) this.endTour();
    this.savedCamPos.copy(camera.position);
    this.savedCamTgt.copy(controls.target);
    controls.enabled = false;
    this.walkOn = true;
    this.walkBuildingId = buildingId;
    this.walkFloor = 0;
    if (buildingId === 'hub') {
      this.walkPos.set(0, LV[0] + 1.65, 22);
      this.walkYaw = 0;
    } else {
      const spec = DISTRICT_BUILDING_MAP[buildingId];
      const signZ = spec.doorSide === 'north' ? -1 : 1;
      this.walkPos.set(spec.doorX, -0.608 + 1.65, spec.doorZ + signZ * 3.8);
      this.walkYaw = spec.doorSide === 'north' ? Math.PI : 0;
    }
    this.walkPitch = 0;
    this.walkStep = 0;
  }

  public exitWalk(camera?: THREE.Camera, controls?: OrbitControls) {
    if (!this.walkOn) return;
    this.walkOn = false;
    this.walkLocked = false;
    this.walkKeys = {};
    this.walkJoy = { x: 0, y: 0 };
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (camera && controls) {
      controls.enabled = true;
      this.flyTo(this.savedCamPos.clone(), this.savedCamTgt.clone());
    }
  }

  public setWalkFloor(lv: number) {
    if (!this.walkOn) return;
    const spec = DISTRICT_BUILDING_MAP[this.walkBuildingId];
    const maxLv = spec.floors - 1;
    this.walkFloor = Math.max(0, Math.min(maxLv, lv));
    if (this.walkFloor === 0) {
      this.walkPos.y = this.groundElevationAt(0, this.walkPos.x, this.walkPos.z, this.walkBuildingId) + 1.65;
    } else if (this.walkBuildingId === 'hub') {
      this.walkPos.x = Math.max(-29.0, Math.min(29.0, this.walkPos.x));
      this.walkPos.z = Math.max(0.85, Math.min(DEPTH - 0.65, this.walkPos.z));
      this.walkPos.y = LV[this.walkFloor] + 1.65;
    } else {
      this.walkPos.x = spec.cx;
      this.walkPos.z = spec.cz + spec.d * 0.25;
      this.walkPos.y = spec.groundY + this.walkFloor * spec.floorH + 0.12 + 1.65;
    }
  }

  public setTouchJoystick(nx: number, ny: number) {
    this.walkJoy.x = nx;
    this.walkJoy.y = ny;
  }

  public wireWalk(dom: HTMLElement, camera: THREE.Camera, controls: OrbitControls): () => void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.walkOn) return;
      this.walkKeys[e.code] = true;
      const maxLv = DISTRICT_BUILDING_MAP[this.walkBuildingId].floors - 1;
      if (e.code === 'Escape') this.exitWalk(camera, controls);
      if (e.code.startsWith('Digit')) {
        const d = parseInt(e.code.slice(5), 10);
        if (d >= 0 && d <= maxLv) this.setWalkFloor(d);
      }
      if (e.code === 'KeyR' && this.walkFloor < maxLv) this.setWalkFloor(this.walkFloor + 1);
      if (e.code === 'KeyF' && this.walkFloor > 0) this.setWalkFloor(this.walkFloor - 1);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.walkKeys[e.code] = false;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!this.walkOn) return;
      if (e.button === 0) {
        this.walkDrag = true;
        this.walkLX = e.clientX;
        this.walkLY = e.clientY;
        if (!document.pointerLockElement && dom.requestPointerLock) {
          try {
            dom.requestPointerLock();
          } catch {
            // Pointer lock may fail in sandboxed iframe; fallback drag still works
          }
        }
      }
    };
    const onMouseUp = () => {
      this.walkDrag = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!this.walkOn) return;
      if (document.pointerLockElement === dom) {
        this.walkYaw -= e.movementX * 0.0024;
        this.walkPitch = Math.max(-1.15, Math.min(1.15, this.walkPitch - e.movementY * 0.0024));
      } else if (this.walkDrag) {
        const dx = e.clientX - this.walkLX;
        const dy = e.clientY - this.walkLY;
        this.walkLX = e.clientX;
        this.walkLY = e.clientY;
        this.walkYaw -= dx * 0.004;
        this.walkPitch = Math.max(-1.15, Math.min(1.15, this.walkPitch - dy * 0.004));
      }
    };
    const onLockChange = () => {
      this.walkLocked = document.pointerLockElement === dom;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }

  private updateWalk(dt: number, camera: THREE.Camera) {
    let fwd = 0;
    let strafe = 0;
    if (this.walkKeys.KeyW || this.walkKeys.ArrowUp) fwd += 1;
    if (this.walkKeys.KeyS || this.walkKeys.ArrowDown) fwd -= 1;
    if (this.walkKeys.KeyD || this.walkKeys.ArrowRight) strafe += 1;
    if (this.walkKeys.KeyA || this.walkKeys.ArrowLeft) strafe -= 1;
    fwd -= this.walkJoy.y;
    strafe += this.walkJoy.x;

    const prevWalkX = this.walkPos.x;
    const prevWalkZ = this.walkPos.z;
    const mag = Math.hypot(fwd, strafe);
    if (mag > 0.01) {
      const spd = (this.walkKeys.ShiftLeft || this.walkKeys.ShiftRight ? 7.2 : 3.9) * Math.min(1, mag);
      const sx = Math.sin(this.walkYaw);
      const cx = Math.cos(this.walkYaw);
      const nf = fwd / Math.max(1, mag);
      const ns = strafe / Math.max(1, mag);
      this.walkPos.x += (-sx * nf + cx * ns) * spd * dt;
      this.walkPos.z += (-cx * nf - sx * ns) * spd * dt;

      this.walkStep += spd * dt * 2.2;
      if (Math.sin(this.walkStep) > 0.96 && Math.sin(this.walkStep - spd * dt * 2.2) <= 0.96) {
        this.playFootstep();
      }
    }

    // Clamp & collide against active building or full district ground plaza/streets
    if (this.walkFloor === 0) {
      this.walkPos.x = Math.max(-104.0, Math.min(104.0, this.walkPos.x));
      this.walkPos.z = Math.max(-37.0, Math.min(105.0, this.walkPos.z));

      let extraVehicles: VehicleObb[] | undefined;
      if (this.walkPos.z >= -17.0 && this.walkPos.z <= 101.0) {
        let count = 0;
        for (let i = 0; i < this.TRAF.length; i++) {
          const v = this.TRAF[i];
          if (!v.g.visible) continue;
          const ry = v.g.rotation.y;
          let slot = this._walkVehicles[count];
          if (!slot) {
            slot = { cx: 0, cz: 0, hx: 0.98, hz: 2.25, cos: 1, sin: 0 };
            this._walkVehicles.push(slot);
          }
          slot.cx = v.g.position.x;
          slot.cz = v.g.position.z;
          slot.cos = Math.cos(ry);
          slot.sin = Math.sin(ry);
          count++;
        }
        this._walkVehicles.length = count;
        extraVehicles = this._walkVehicles;
      }

      const stepDist = Math.hypot(this.walkPos.x - prevWalkX, this.walkPos.z - prevWalkZ);
      const substeps = Math.max(1, Math.min(8, Math.ceil(stepDist / 0.12)));
      let cx = prevWalkX;
      let cz = prevWalkZ;
      const dxSub = (this.walkPos.x - prevWalkX) / substeps;
      const dzSub = (this.walkPos.z - prevWalkZ) / substeps;
      for (let s = 0; s < substeps; s++) {
        const res = resolveObstaclePosition(0, cx + dxSub, cz + dzSub, {
          radius: 0.38,
          districtWalk: true,
          extraVehicles,
        });
        cx = res.x;
        cz = res.z;
      }
      this.walkPos.x = cx;
      this.walkPos.z = cz;
    } else {
      const stepDist = Math.hypot(this.walkPos.x - prevWalkX, this.walkPos.z - prevWalkZ);
      const substeps = Math.max(1, Math.min(8, Math.ceil(stepDist / 0.12)));
      let cx = prevWalkX;
      let cz = prevWalkZ;
      const dxSub = (this.walkPos.x - prevWalkX) / substeps;
      const dzSub = (this.walkPos.z - prevWalkZ) / substeps;
      for (let s = 0; s < substeps; s++) {
        const res = resolveDistrictObstacle(this.walkBuildingId, this.walkFloor, cx + dxSub, cz + dzSub, {
          radius: 0.38,
        });
        cx = res.x;
        cz = res.z;
      }
      this.walkPos.x = cx;
      this.walkPos.z = cz;
    }

    // Seamless switchback stairwell floor transitions (walk up/down L0 <-> L5)
    if (this.walkBuildingId === 'hub' && this.walkPos.x > 22.25 && this.walkPos.x <= 24.36) {
      if (prevWalkZ <= 7.85 && this.walkPos.z > 7.85) {
        if (this.walkFloor < 5) {
          this.walkFloor++;
        } else {
          // On L5 stairwell top-out to Roof, keep on upper flight so player doesn't drop 4.2m onto L5 corridor
          this.walkPos.z = 7.82;
        }
      } else if (prevWalkZ > 7.85 && this.walkPos.z <= 7.85 && this.walkFloor > 0) {
        this.walkFloor--;
      }
    }

    // Collide against active standing/walking staff, district NPCs & guide on current floor
    if (this.peopleGroup.visible) {
      const floorY = this.groundElevationAt(this.walkFloor, this.walkPos.x, this.walkPos.z, this.walkBuildingId);
      const charMinR = 0.62;
      const pushOutFromActor = (P: PersonActor) => {
        if (!P.g.visible || Math.abs(P.g.position.y - floorY) > 1.1) return;
        const dx = this.walkPos.x - P.g.position.x;
        const dz = this.walkPos.z - P.g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < charMinR) {
          if (d > 0.001) {
            this.walkPos.x = P.g.position.x + (dx / d) * charMinR;
            this.walkPos.z = P.g.position.z + (dz / d) * charMinR;
          } else {
            this.walkPos.z = P.g.position.z + charMinR;
          }
        }
      };
      for (const P of this.STAFF) pushOutFromActor(P);
      for (const P of this.districtSim.ACTORS) pushOutFromActor(P);
      pushOutFromActor(this.guideActor);
    }

    const baseY = this.groundElevationAt(this.walkFloor, this.walkPos.x, this.walkPos.z, this.walkBuildingId) + 1.65;
    const bob = mag > 0.05 ? Math.sin(this.walkStep) * 0.042 : 0;
    camera.position.set(this.walkPos.x, baseY + bob, this.walkPos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.walkYaw;
    camera.rotation.x = this.walkPitch;
    camera.rotation.z = 0;
  }

  /* =========================================================
     CAMERA FLIGHTS & CLOCK
     ========================================================= */
  public flyTo(pos: THREE.Vector3, tgt: THREE.Vector3) {
    this.cameraFlight.pos.copy(pos);
    this.cameraFlight.tgt.copy(tgt);
    this.cameraFlight.active = true;
  }

  public cancelFlight() {
    this.cameraFlight.active = false;
    this.tourCam.on = false;
  }

  public setClock(minutes: number) {
    this.simMin = ((minutes % 1440) + 1440) % 1440;
    this.snapAll();
  }

  public setRate(rate: number) {
    this.simRate = rate;
  }

  public toggleStaff(): boolean {
    this.staffVisible = !this.staffVisible;
    this.staffFadeTgt = this.staffVisible ? 1 : 0;
    this.staffToggling = true;
    return this.staffVisible;
  }

  public isCameraFlying(): boolean {
    return this.cameraFlight.active;
  }

  public setCutawayRange(minY: number | null, maxY: number | null, buildingId: BuildingId = 'hub') {
    if (buildingId === 'hub') {
      this.cutawayMinY = minY;
      this.cutawayMaxY = maxY;
      this.districtSim.setCutaway('hub', null, null);
    } else {
      this.cutawayMinY = -0.5;
      this.cutawayMaxY = null;
      this.districtSim.setCutaway(buildingId, minY, maxY);
    }
  }

  private applyActorCutaway(P: PersonActor): boolean {
    const py = P.g.position.y;
    const aboveMin = this.cutawayMinY === null || py >= this.cutawayMinY;
    const belowMax = this.cutawayMaxY === null || py <= this.cutawayMaxY;
    const show = aboveMin && belowMax;
    for (let i = 0; i < P.g.children.length; i++) {
      P.g.children[i].visible = show;
    }
    return show;
  }
  public setWeatherTimeMultiplier(mult: number) {
    this.weatherTimeMultiplier = Math.max(0.25, Math.min(2.0, mult));
  }

  /* =========================================================
     PER-FRAME SIMULATION TICK
     ========================================================= */
  public update(dt: number, t: number, camera: THREE.Camera, controls: OrbitControls) {
    if (this.simRate > 0) {
      this.simMin = (this.simMin + (dt * this.simRate * this.weatherTimeMultiplier) / 4) % 1440;
    }

    // Staff fade in/out
    if (this.staffToggling) {
      const k = 1 - Math.exp(-dt * 8);
      this.staffFade += (this.staffFadeTgt - this.staffFade) * k;
      if (Math.abs(this.staffFade - this.staffFadeTgt) < 0.02) {
        this.staffFade = this.staffFadeTgt;
        this.staffToggling = false;
      }
      this.peopleGroup.visible = this.staffFade > 0.03;
      this.peopleGroup.scale.setScalar(0.85 + 0.15 * this.staffFade);
      this.districtSim.setStaffVisible(this.peopleGroup.visible);
    }

    // Lift controllers, office staff simulation & smooth non-throwing chair kinematics
    this.cabCtl(-1, dt);
    this.cabCtl(1, dt);
    for (const w of this.WORKERS) this.wThink(w, dt);
    for (const d of this.DAYONLY) this.dThink(d, dt);
    if (this.secOffActor && this.secOffActor.g.visible) {
      this.stepFreeAgent(this.secOffActor, dt);
    }
    for (const b of this.BASEMENT_STAFF) {
      if (!b.g.visible) continue;
      this.stepFreeAgent(b, dt);
      const ag = this.freeAgents.get(b);
      if (ag && ag.mode === 'home' && b.modes && ag.queue.length === 0) {
        b.timer -= dt;
        if (b.timer <= 0) {
          b.timer = 5 + Math.random() * 6;
          this.setSafePose(b, pickMode(b.modes));
        }
      }
    }
    this.updateChairs(dt);
    this.districtSim.update(dt, t, this.simMin, camera);

    // Update all animated staff kinematics
    for (const P of this.STAFF) {
      if (!P.g.visible) continue;
      if (P.route && !this.tourOn) {
        const pt = P.route[P.ri || 0];
        if ((P.wait || 0) > 0) {
          P.wait = (P.wait || 0) - dt;
          if ((P.wait || 0) <= 0) {
            P.ri = ((P.ri || 0) + 1) % P.route.length;
            setPose(P, P.walkPose || 'stand', this.P_LIB);
          }
        } else {
          if (P.pose !== (P.walkPose || 'stand')) setPose(P, P.walkPose || 'stand', this.P_LIB);
          if (this.walkPt(P, pt.x, pt.z, dt)) {
            P.wait = pt.wait || 2;
            if (pt.face != null) P.tyaw = pt.face;
            if (pt.pose) setPose(P, pt.pose, this.P_LIB);
          }
        }
      }

      if (!this.applyActorCutaway(P)) continue;

      // Subtle glance toward camera/player when nearby
      let glance = 0;
      this._v1.subVectors(camera.position, P.g.position);
      if (this._v1.lengthSq() < 49) {
        const ty = Math.atan2(this._v1.x, this._v1.z);
        const dy = Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw));
        if (Math.abs(dy) < 1.1) glance = dy * 0.4;
      }

      updatePersonKinematics(P, dt, t, glance);
    }

    // Vehicle traffic
    this.updateTraffic(dt, this.simMin, t);

    // Zuri Guided Tour
    this.guideStep(dt, t, camera, controls);
    this.applyActorCutaway(this.guideActor);

    // Camera flight interpolation
    if (this.walkOn) {
      this.updateWalk(dt, camera);
    } else if (this.tourCam.on) {
      const k = 1 - Math.exp(-dt * 2.8);
      camera.position.lerp(this.tourCam.pos, k);
      controls.target.lerp(this.tourCam.tgt, k);
      if (camera.position.distanceTo(this.tourCam.pos) < 0.08 && controls.target.distanceTo(this.tourCam.tgt) < 0.08) {
        this.tourCam.on = false;
      }
      controls.update();
      this.pushCameraOutsideCharacters(camera.position);
    } else if (this.cameraFlight.active) {
      const k = 1 - Math.exp(-dt * 3.8);
      camera.position.lerp(this.cameraFlight.pos, k);
      controls.target.lerp(this.cameraFlight.tgt, k);
      if (camera.position.distanceTo(this.cameraFlight.pos) < 0.08 && controls.target.distanceTo(this.cameraFlight.tgt) < 0.08) {
        camera.position.copy(this.cameraFlight.pos);
        controls.target.copy(this.cameraFlight.tgt);
        this.cameraFlight.active = false;
      }
      controls.update();
      this.pushCameraOutsideCharacters(camera.position);
    } else {
      controls.update();
      this.pushCameraOutsideCharacters(camera.position);
    }
  }

  private pushCameraOutsideCharacters(camPos: THREE.Vector3) {
    if (!this.peopleGroup.visible) return;
    const minR = 0.54;
    const checkActor = (P: PersonActor) => {
      if (!P.g.visible) return;
      const py = P.g.position.y;
      if (this.cutawayMinY !== null && py < this.cutawayMinY) return;
      if (this.cutawayMaxY !== null && py > this.cutawayMaxY) return;
      if (camPos.y < py - 0.15 || camPos.y > py + 2.0) return;
      const dx = camPos.x - P.g.position.x;
      const dz = camPos.z - P.g.position.z;
      const d = Math.hypot(dx, dz);
      if (d < minR) {
        if (d > 0.001) {
          camPos.x = P.g.position.x + (dx / d) * minR;
          camPos.z = P.g.position.z + (dz / d) * minR;
        } else {
          camPos.z = P.g.position.z + minR;
        }
      }
    };
    for (const P of this.STAFF) checkActor(P);
    for (const P of this.districtSim.ACTORS) checkActor(P);
    checkActor(this.guideActor);
  }

  private describePoseBucket(actors: Array<{ pose: string; state?: string }>): string {
    if (actors.length === 0) return 'Off shift · Empty';
    let typing = 0;
    let talking = 0;
    let phone = 0;
    let coffee = 0;
    let transit = 0;
    let seated = 0;
    for (const a of actors) {
      if (a.state && a.state !== 'atDesk') {
        transit++;
      } else if (a.pose === 'type' || a.pose === 'standType' || a.pose === 'standCounter' || a.pose === 'standLowCounter' || a.pose === 'writeNotes') {
        typing++;
      } else if (a.pose === 'talk' || a.pose === 'sitTalk' || a.pose === 'collaborate' || a.pose === 'sitCollaborate' || a.pose === 'meeting') {
        talking++;
      } else if (a.pose === 'phone' || a.pose === 'standPhone') {
        phone++;
      } else if (a.pose === 'coffee') {
        coffee++;
      } else if (
        a.pose === 'sit' ||
        a.pose === 'think' ||
        a.pose === 'monitorLook' ||
        a.pose === 'leanScreen' ||
        a.pose === 'readDoc' ||
        a.pose === 'sitReadDoc' ||
        a.pose === 'inspectPanel'
      ) {
        seated++;
      } else {
        typing++;
      }
    }
    const parts: string[] = [];
    if (typing > 0) parts.push(`${typing} typing`);
    if (talking > 0) parts.push(`${talking} discussing`);
    if (phone > 0) parts.push(`${phone} on call`);
    if (coffee > 0) parts.push(`${coffee} coffee break`);
    if (seated > 0) parts.push(`${seated} reviewing`);
    if (transit > 0) parts.push(`${transit} in transit`);
    return parts.join(' · ') || `${actors.length} active`;
  }

  public getFloorActivity(activeLevel: string, activeBuilding: BuildingId = 'hub'): FloorActivitySummary | null {
    if (activeBuilding !== 'hub') {
      return this.districtSim.getFloorActivity(activeBuilding, activeLevel);
    }
    if (activeLevel === 'overview' || activeLevel === 'tour' || activeLevel === 'walk') {
      return null;
    }

    if (activeLevel === 'b1') {
      const b1Crew = this.staffVisible ? this.BASEMENT_STAFF.filter((b) => b.lv === -1 && b.g.visible) : [];
      const senior = b1Crew.filter((b) => b.seniority === 'senior');
      const junior = b1Crew.filter((b) => b.seniority === 'junior');
      const describeCrew = (list: BasementCrewActor[], fallback: string) => {
        if (!this.staffVisible) return 'Staff hidden (Staff OFF)';
        if (list.length === 0) return 'Off duty';
        const walking = list.filter((b) => b.moving).length;
        const inspecting = list.length - walking;
        const parts: string[] = [];
        if (inspecting > 0) parts.push(`${inspecting} ${fallback}`);
        if (walking > 0) parts.push(`${walking} patrolling racks`);
        return parts.join(' · ');
      };
      return {
        levelTitle: 'Basement 1 · Server Room',
        activeCount: b1Crew.length,
        zones: [
          {
            zone: 'Senior Server Engineers',
            color: '#38bdf8',
            count: senior.length,
            status: `${describeCrew(senior, 'checking CRAC & NOC')} · 42 nodes`,
          },
          {
            zone: 'Junior Maintenance Techs',
            color: '#6fe3a1',
            count: junior.length,
            status: `${describeCrew(junior, 'servicing racks & FM-200')}`,
          },
        ],
      };
    }

    if (activeLevel === 'b2') {
      const b2Crew = this.staffVisible ? this.BASEMENT_STAFF.filter((b) => b.lv === -2 && b.g.visible) : [];
      const senior = b2Crew.filter((b) => b.seniority === 'senior');
      const junior = b2Crew.filter((b) => b.seniority === 'junior');
      const describeCrew = (list: BasementCrewActor[], fallback: string) => {
        if (!this.staffVisible) return 'Staff hidden (Staff OFF)';
        if (list.length === 0) return 'Off duty';
        const walking = list.filter((b) => b.moving).length;
        const seated = list.filter((b) => !b.moving && SEATED_POSES.has(b.pose)).length;
        const inspecting = list.length - walking - seated;
        const parts: string[] = [];
        if (seated > 0) parts.push(`${seated} analyzing telemetry at desk`);
        if (inspecting > 0) parts.push(`${inspecting} ${fallback}`);
        if (walking > 0) parts.push(`${walking} patrolling bay`);
        return parts.join(' · ');
      };
      return {
        levelTitle: 'Basement 2 · Power Room',
        activeCount: b2Crew.length,
        zones: [
          {
            zone: 'Senior Power Engineers',
            color: '#f8fafc',
            count: senior.length,
            status: `${describeCrew(senior, 'auditing HV & inverters')} · PV 18.4 kW`,
          },
          {
            zone: 'Junior Electrical Techs',
            color: '#f2b705',
            count: junior.length,
            status: `${describeCrew(junior, 'maintaining battery & gear')}`,
          },
        ],
      };
    }

    if (activeLevel === 'roof') {
      return {
        levelTitle: 'Solar Roof Deck',
        activeCount: 0,
        zones: [
          {
            zone: 'PV Array & Chillers',
            color: '#7fb0ff',
            count: 0,
            status: '80 solar panels generating · 2 HVAC chillers running',
          },
        ],
      };
    }

    const lv = Number(activeLevel);
    if (!Number.isInteger(lv) || lv < 0 || lv > 5) return null;

    const zones: FloorZoneActivity[] = [];
    let activeCount = 0;

    if (!this.staffVisible) {
      if (lv <= 3) {
        if (lv === 0) zones.push({ zone: 'Security Room', color: '#38bdf8', count: 0, status: 'Staff hidden (Staff OFF)' });
        if (lv === 1) zones.push({ zone: 'HR Room', color: '#34d399', count: 0, status: 'Staff hidden (Staff OFF)' });
        if (lv === 2) zones.push({ zone: 'Relax Room', color: '#f59e0b', count: 0, status: 'Staff hidden (Staff OFF)' });
        if (lv === 3) zones.push({ zone: 'Gym Room', color: '#f87171', count: 0, status: 'Staff hidden (Staff OFF)' });
        ROOMS.filter((r) => r.lv === lv).forEach((r) => {
          zones.push({
            zone: r.n,
            color: `#${r.c.toString(16).padStart(6, '0')}`,
            count: 0,
            status: 'Staff hidden (Staff OFF)',
          });
        });
        zones.push({ zone: 'Toilets', color: '#94a3b8', count: 0, status: 'East Wing · Restrooms open' });
      } else if (lv === 4) {
        zones.push(
          { zone: 'Strategy Room', color: '#818cf8', count: 0, status: 'Staff hidden' },
          { zone: 'Board Room', color: '#c9a24b', count: 0, status: 'Staff hidden' },
          { zone: 'Executive Lounge', color: '#7a5c3a', count: 0, status: 'Staff hidden' },
          { zone: 'Board Secretary', color: '#5d6b7a', count: 0, status: 'Staff hidden' },
          { zone: 'Toilets', color: '#94a3b8', count: 0, status: 'East Wing · Restrooms open' }
        );
      } else {
        zones.push(
          { zone: 'Executive Gallery', color: '#b08452', count: 0, status: 'Staff hidden' },
          { zone: 'Executive Suite', color: '#8a1f2e', count: 0, status: 'Staff hidden' },
          { zone: 'Toilets', color: '#94a3b8', count: 0, status: 'East Wing · Restrooms open' }
        );
      }
      return {
        levelTitle: lv === 0 ? 'Ground Floor (G) · Lobby, Security & Bays' : `Level ${lv}`,
        activeCount: 0,
        zones,
      };
    }

    if (lv <= 3) {
      if (lv === 0) {
        const lobbyActors = this.DAYONLY.filter((d) => d.lv === 0 && d.dx > -20 && d.g.visible && d.state !== 'away');
        const secRoomActors = this.DAYONLY.filter((d) => d.lv === 0 && d.dx < -20 && d.g.visible && d.state !== 'away');
        const secVisible =
          Boolean(this.secOffActor) &&
          this.secOffActor.g.visible &&
          Math.abs(this.secOffActor.g.position.y) < 0.5;
        const lobbyCount = lobbyActors.length + (secVisible ? 1 : 0);
        activeCount += lobbyCount + secRoomActors.length;
        const lobbyParts: string[] = [];
        const recOn = lobbyActors.some((d) => d.dx < 0);
        const visOn = lobbyActors.some((d) => d.dx > 0);
        if (recOn) lobbyParts.push('Receptionist at desk');
        if (secVisible) lobbyParts.push('Security patrolling');
        if (visOn) lobbyParts.push('Visitor in lounge');
        zones.push({
          zone: 'DomainTechHub Reception',
          color: '#4ea8ff',
          count: lobbyCount,
          status: lobbyParts.join(' · ') || 'Lobby clear',
        });
        zones.push({
          zone: 'Security Room',
          color: '#38bdf8',
          count: secRoomActors.length,
          status: secRoomActors.length > 0 ? `${this.describePoseBucket(secRoomActors)} · CCTV live` : 'CCTV auto-armed',
        });
      } else if (lv === 1) {
        const hrActors = this.DAYONLY.filter((d) => d.lv === 1 && d.dx < -20 && d.g.visible && d.state !== 'away');
        activeCount += hrActors.length;
        zones.push({
          zone: 'HR Room',
          color: '#34d399',
          count: hrActors.length,
          status: hrActors.length > 0 ? this.describePoseBucket(hrActors) : 'HR office closed',
        });
      } else if (lv === 2) {
        const relaxActors = this.DAYONLY.filter((d) => d.lv === 2 && d.dx < -20 && d.g.visible && d.state !== 'away');
        activeCount += relaxActors.length;
        zones.push({
          zone: 'Relax Room',
          color: '#f59e0b',
          count: relaxActors.length,
          status: relaxActors.length > 0 ? `${this.describePoseBucket(relaxActors)} · Ping-pong & espresso` : 'Lounge open',
        });
      } else if (lv === 3) {
        const gymActors = this.DAYONLY.filter((d) => d.lv === 3 && d.dx < -20 && d.g.visible && d.state !== 'away');
        activeCount += gymActors.length;
        zones.push({
          zone: 'Gym Room',
          color: '#f87171',
          count: gymActors.length,
          status: gymActors.length > 0 ? `${gymActors.length} active · Cardio & weights` : 'Gym studio open',
        });
      }

      ROOMS.filter((r) => r.lv === lv).forEach((r) => {
        const workers = this.WORKERS.filter((w) => w.d === r && w.g.visible && w.state !== 'away');
        activeCount += workers.length;
        zones.push({
          zone: r.n,
          color: `#${r.c.toString(16).padStart(6, '0')}`,
          count: workers.length,
          status: this.describePoseBucket(workers),
        });
      });

      zones.push({
        zone: 'Toilets',
        color: '#94a3b8',
        count: 0,
        status: 'Ladies & Gents · East Core Stairs',
      });

      const levelTitles: Record<number, string> = {
        0: 'Ground Floor (G) · Security, Lobby & Bays',
        1: 'Level 1 · HR Room & Department Bays',
        2: 'Level 2 · Relax Room & Department Bays',
        3: 'Level 3 · Gym Room & Department Bays',
      };
      return {
        levelTitle: levelTitles[lv] || `Level ${lv} · Department Bays`,
        activeCount,
        zones,
      };
    }

    if (lv === 4) {
      const l4 = this.DAYONLY.filter((d) => d.lv === 4 && d.g.visible && d.state !== 'away');
      const strategy = l4.filter((d) => d.dx < -20);
      const directors = l4.filter((d) => Math.abs(d.dx) < 8);
      const barista = l4.filter((d) => d.dx >= -20 && d.dx < -10);
      const secr = l4.filter((d) => d.dx > 10);
      activeCount = l4.length;
      zones.push(
        {
          zone: 'Strategy Room',
          color: '#818cf8',
          count: strategy.length,
          status: strategy.length > 0 ? `${this.describePoseBucket(strategy)} · OKR review` : 'War room clear',
        },
        {
          zone: 'Board Room',
          color: '#c9a24b',
          count: directors.length,
          status:
            directors.length > 0
              ? `${directors.length} directors in quarterly review`
              : 'Board Room empty',
        },
        {
          zone: 'Executive Lounge',
          color: '#7a5c3a',
          count: barista.length,
          status:
            barista.length > 1
              ? `Barista & ${barista.length - 1} guests in lounge`
              : barista.length === 1
              ? 'Barista at espresso bar'
              : 'Lounge unattended',
        },
        {
          zone: 'Board Secretary',
          color: '#5d6b7a',
          count: secr.length,
          status: secr.length > 0 ? this.describePoseBucket(secr) : 'Off shift',
        },
        {
          zone: 'Toilets',
          color: '#94a3b8',
          count: 0,
          status: 'Ladies & Gents · East Core Stairs',
        }
      );
      return {
        levelTitle: 'Level 4 · Strategy, Board & Executive Lounge',
        activeCount,
        zones,
      };
    }

    // Level 5 · Executive Gallery, CEO & Heads of Department
    const l5 = this.DAYONLY.filter((d) => d.lv === 5 && d.g.visible && d.state !== 'away');
    activeCount = l5.length;
    const gallery = l5.filter((d) => d.dx < -20);
    zones.push({
      zone: EXEC.gallery.n,
      color: '#b08452',
      count: gallery.length,
      status: gallery.length > 0 ? 'Hosting partner model briefing' : 'Gallery ready',
    });
    const execDefs = [
      { key: EXEC.tech, x: -17.5 },
      { key: EXEC.mkt, x: -12.5 },
      { key: EXEC.fin, x: -7.5 },
      { key: EXEC.ops, x: -2.5 },
      { key: { n: 'Executive Assistant', c: 0x5d6b7a }, x: 3 },
      { key: EXEC.ceo, x: 13 },
    ];
    for (const ex of execDefs) {
      const match = l5.filter((d) => Math.abs(d.dx - ex.x) < 1.5);
      zones.push({
        zone: ex.key.n,
        color: `#${ex.key.c.toString(16).padStart(6, '0')}`,
        count: match.length,
        status:
          match.length === 0
            ? 'Out of office'
            : match[0].state !== 'atDesk'
            ? 'In transit via lift'
            : match[0].pose === 'phone'
            ? 'On executive call'
            : 'Working at desk',
      });
    }
    zones.push({
      zone: 'Toilets',
      color: '#94a3b8',
      count: 0,
      status: 'Ladies & Gents · East Core Stairs',
    });

    return {
      levelTitle: 'Level 5 · Gallery, CEO & Heads of Department',
      activeCount,
      zones,
    };
  }

  public getMonitorWorkerStatus(
    lv: number,
    seatX: number,
    seatZ: number,
    buildingId: BuildingId = 'hub'
  ): { workerActivity: string; isOccupied: boolean } {
    if (buildingId !== 'hub') {
      return this.districtSim.getMonitorWorkerStatus(buildingId, lv, seatX, seatZ);
    }
    const describePose = (pose: string, state: string): string => {
      if (state !== 'atDesk') {
        if (state === 'toLunch' || state === 'lunch' || state === 'fromLunch') {
          return 'Stepped out for lunch break';
        }
        if (state === 'toLift' || state === 'inLift' || state === 'walk') {
          return 'In transit along corridor / lift';
        }
        return 'Temporarily away from desk';
      }
      if (pose === 'type') return 'Actively typing at desk';
      if (pose === 'standType' || pose === 'standCounter') return 'Working at standing counter';
      if (pose === 'standLowCounter') return 'Servicing hardware at maintenance trolley';
      if (pose === 'inspectPanel') return 'Inspecting equipment control panel';
      if (pose === 'phone' || pose === 'standPhone') return 'On a live client / team call';
      if (pose === 'point') return 'Reviewing & pointing on screen';
      if (pose === 'talk' || pose === 'sitTalk' || pose === 'collaborate' || pose === 'sitCollaborate') return 'Collaborating with colleague';
      if (pose === 'sit') return 'Working on laptop in ergonomic chair';
      if (pose === 'monitorLook') return 'Examining computer monitor';
      if (pose === 'leanScreen') return 'Leaning forward inspecting screen';
      if (pose === 'think') return 'Thinking through architecture at desk';
      if (pose === 'writeNotes') return 'Writing notes in notebook';
      if (pose === 'readDoc' || pose === 'sitReadDoc') return 'Reviewing printed documents';
      if (pose === 'meeting') return 'Participating in conference meeting';
      return 'Working at workstation';
    };

    const worker = this.WORKERS.find(
      (w) => w.d.lv === lv && Math.hypot(w.seat.x - seatX, w.seat.z - seatZ) < 0.85 && w.g.visible
    );
    if (worker) {
      const ag = this.freeAgents.get(worker);
      if (ag && ag.mode !== 'home' && worker.brain) {
        return {
          workerActivity: worker.brain.actionLabel,
          isOccupied: false,
        };
      }
      return {
        workerActivity: describePose(worker.pose, worker.state),
        isOccupied: worker.state === 'atDesk',
      };
    }

    const dayActor = this.DAYONLY.find(
      (d) => d.lv === lv && Math.hypot(d.dx - seatX, d.dz - seatZ) < 1.2 && d.g.visible
    );
    if (dayActor) {
      const ag = this.freeAgents.get(dayActor);
      if (ag && ag.mode !== 'home' && dayActor.brain) {
        return {
          workerActivity: dayActor.brain.actionLabel,
          isOccupied: false,
        };
      }
      return {
        workerActivity: describePose(dayActor.pose, dayActor.state),
        isOccupied: dayActor.state === 'atDesk',
      };
    }

    const baseActor = this.BASEMENT_STAFF.find((b) => {
      if (b.lv !== lv || !b.g.visible || !b.brain) return false;
      return Math.hypot(b.brain.identity.homeX - seatX, b.brain.identity.homeZ - seatZ) < 1.2;
    });
    if (baseActor) {
      const ag = this.freeAgents.get(baseActor);
      if (ag && ag.mode !== 'home' && baseActor.brain) {
        return {
          workerActivity: baseActor.brain.actionLabel,
          isOccupied: false,
        };
      }
      return {
        workerActivity: describePose(baseActor.pose, 'atDesk'),
        isOccupied: true,
      };
    }

    return {
      workerActivity: 'Workstation idle · off shift',
      isOccupied: false,
    };
  }

  public getSnapshot(
    activeLevel: string,
    hoveredRoom: { title: string; sub: string; color: string; hint?: string } | null,
    audioEnabled: boolean,
    inspectedMonitor: InspectedMonitor | null,
    selectedCharacter: SelectedCharacterSnapshot | null,
    activeBuilding: BuildingId = 'hub'
  ): HudSnapshot {
    const m = Math.floor(this.simMin) % 1440;
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');

    let shiftLabel = 'After hours';
    if (m >= 420 && m < 720) shiftLabel = 'Morning shift';
    else if (m >= 720 && m < 840) shiftLabel = 'Lunch window';
    else if (m >= 840 && m < 1050) shiftLabel = 'Afternoon shift';
    else if (m >= 1050 && m < 1340) shiftLabel = 'Evening shift';

    const activeStaff =
      this.WORKERS.filter((w) => w.g.visible).length +
      this.DAYONLY.filter((d) => d.g.visible).length +
      this.BASEMENT_STAFF.filter((b) => b.g.visible).length +
      (this.secOffActor?.g.visible ? 1 : 0) +
      this.districtSim.getActiveCount();
    const activeCars = this.TRAF.filter((v) => v.state === 'street').length;

    const bSpec = DISTRICT_BUILDING_MAP[activeBuilding];
    const stop = this.STOPS[this.tourI] || this.STOPS[0];
    return {
      simMinutes: this.simMin,
      simRate: this.simRate,
      timeText: `${hh}:${mm}`,
      shiftLabel,
      statsLabel: `${activeStaff} people in district · ${activeCars} street vehicles`,
      weatherMode: 'auto',
      activeWeather: 'clear',
      weatherLabel: 'Clear',
      weatherTimeFactor: this.weatherTimeMultiplier,
      activeBuilding,
      activeBuildingName: bSpec.name,
      activeBuildingNiche: bSpec.niche,
      activeBuildingAccent: bSpec.accent,
      buildingFloors: bSpec.floors,
      activeLevel,
      staffVisible: this.staffVisible,
      walking: this.walkOn,
      walkFloor: this.walkFloor,
      walkLocked: this.walkLocked,
      tourActive: this.tourOn,
      tourPlaying: this.tourPlay,
      tourArrived: this.tourArr,
      tourIndex: this.tourI,
      tourTotal: this.STOPS.length,
      tourTitle: stop.n,
      tourLab: stop.lab,
      tourText: stop.text,
      tourColor: stop.col,
      tourProgress: (this.tourI + 1) / this.STOPS.length,
      hoveredRoom,
      floorActivity: this.getFloorActivity(activeLevel, activeBuilding),
      inspectedMonitor,
      selectedCharacter,
      audioEnabled,
    };
  }

  public dispose() {
    clearTrackedChairs();
  }
}
