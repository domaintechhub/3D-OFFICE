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
import { getRoundedBox, makeCar } from './props';
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
  state: 'atDesk' | 'toLift' | 'wait' | 'inCab' | 'out' | 'away' | 'toDesk';
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
};

type DayVisitorActor = PersonActor & {
  lv: number;
  dx: number;
  dz: number;
  df: number;
  dpose: string;
  sd: number;
  state: 'in' | 'wait' | 'inCab' | 'toDesk' | 'atDesk' | 'toLift' | 'out' | 'away';
  cab: number;
  _arr?: number;
  _w2?: number;
  navQueue?: Array<{ x: number; z: number }>;
  navKey?: string;
  chair?: OfficeChairHandle;
  chairCollider?: TrackedChairCollider;
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
  bm: THREE.MeshPhysicalMaterial;
  spd: number;
  lane: number;
  x: number;
  dir: number;
  state: 'street' | 'toBay' | 'parked' | 'toGate' | 'toStreet';
  bay: { sd: number; x: number; z: number; face: number } | null;
  phase: number;
  in_t?: number;
  out_t?: number;
  _arr?: number;
};

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

const DRV_X = 30;
const AISLE_Z = 29.75;
const LANE_E = 64;
const LANE_W = 68;
const STREET_END = 112;
const BAY_XS = [9, 12.5, 16, 19.5, 23];
const BAY_ROWS = [25, 34.5];
const CAR_COLS = [0x1c2432, 0x7b2329, 0x3b4854, 0xcfd3d6, 0x2c4237, 0x16171a, 0x7a6a58, 0x2e4a76];
const CAR_STYLES: Array<'sedan' | 'suv' | 'hatch'> = ['sedan', 'suv', 'hatch'];

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
  private readonly LOT: Array<{ sd: number; x: number; z: number; face: number }> = [];
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
  private tourSt: 'idle' | 'toLift' | 'waitCab' | 'toDest' | 'arrived' = 'idle';
  private tourArr = false;
  private tourHold = 0;
  private tourCab = 1;
  private tourSnap: { cam: THREE.Vector3; tgt: THREE.Vector3 } | null = null;
  private tourCam = { on: false, pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
  private guideNavQueue: Array<{ x: number; z: number }> = [];
  private guideNavKey = '';

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
  private savedCamPos = new THREE.Vector3(0, 16, 49);
  private savedCamTgt = new THREE.Vector3(0, 12.2, 4);
  private readonly onFootstep?: () => void;
  private readonly ambientSources: AmbientSource[] = [];
  private cutawayMinY: number | null = null;
  private cutawayMaxY: number | null = null;
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
            1.18
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
        1.12
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
        false,
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
      startX: 7.55,
      startZ: 3.4,
      startFace: Math.PI / 2,
      startPose: 'readDoc',
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
      startX: -3.5,
      startZ: 4.02,
      startFace: 0,
      startPose: 'hold',
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
    [-1, 1].forEach((sd) =>
      BAY_ROWS.forEach((bz) =>
        BAY_XS.forEach((bx) =>
          this.LOT.push({
            sd,
            x: sd * bx,
            z: bz,
            face: bz < AISLE_Z ? Math.PI : 0,
          })
        )
      )
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
    [-1, 1].forEach((s) => {
      addLock(s * LIFTX, LANE, 1.35);
      addLock(s * 13, 11.2, 2.0);
      addLock(s * 16.5, 13.4, 2.0);
    });

    // Through-street traffic (using sedan, suv & hatchback profiles)
    for (let i = 0; i < 6; i++) {
      const dir = i % 2 ? 1 : -1;
      const lane = ROAD_Z + (dir > 0 ? 3.2 : -3.2);
      const x = -96 + i * 34 + Math.random() * 14;
      const style = CAR_STYLES[i % CAR_STYLES.length];
      const car = makeCar(CAR_COLS[i % CAR_COLS.length], style);
      car.position.set(x, -0.62, lane);
      car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.trafficGroup.add(car);
      this.TRAF.push({
        g: car,
        bm: car.userData.body as THREE.MeshPhysicalMaterial,
        spd: 7 + Math.random() * 4,
        lane,
        x,
        dir,
        state: 'street',
        bay: null,
        phase: Math.random() * 6,
      });
    }

    // Commuting staff vehicles mapped to parking bays
    for (let i = 0; i < 12; i++) {
      const bay = this.LOT[i];
      const style = CAR_STYLES[(i + 1) % CAR_STYLES.length];
      const car = makeCar(CAR_COLS[(i + 3) % CAR_COLS.length], style);
      car.position.set(bay.x, -0.62, bay.z);
      car.rotation.y = bay.face;
      this.trafficGroup.add(car);
      this.TRAF.push({
        g: car,
        bm: car.userData.body as THREE.MeshPhysicalMaterial,
        spd: 5.5,
        lane: ROAD_Z + 3.2,
        x: bay.x,
        dir: 1,
        state: 'parked',
        bay,
        phase: 0,
        in_t: 440 + (i % 6) * 14,
        out_t: 1030 + (i % 6) * 20,
      });
    }
  }

  private buildTourStops(): TourStop[] {
    const out: TourStop[] = [];
    const byName = new Map(ROOMS.map((r) => [r.n, r]));
    const order = [
      'Maintenance & Security',
      'Mobile Apps',
      'Consultancy',
      'AI Solutions',
      'Custom CRM',
      'Social Media',
      'SEO',
      'Digital Marketing',
      'PPC · Google Ads',
      'WhatsApp Marketing',
      'CMS & WordPress',
      'E-Commerce',
      'Front-End',
      'Web Development',
    ];
    for (const n of order) {
      const r = byName.get(n);
      if (!r) continue;
      const cx = COLX[r.col];
      out.push({
        n: r.n,
        room: r,
        lv: r.lv,
        cx,
        col: `#${r.col >= 0 ? r.c.toString(16).padStart(6, '0') : '6fe3a1'}`,
        lab: `Level ${r.lv} · Bay ${r.col + 1} · Department ${out.length + 1} of 17`,
        text: TOUR_TEXT[r.n] || '',
      });
    }
    out.push({
      n: 'Board Room',
      room: EXEC.board,
      lv: 4,
      cx: 0,
      col: '#c9a24b',
      lab: 'Level 4 · Executive Floor · Stop 15 of 17',
      text: TOUR_TEXT['Board Room'],
    });
    out.push({
      n: 'Heads of Department',
      room: EXEC.tech,
      lv: 5,
      cx: -10,
      col: '#5b8ee8',
      lab: 'Level 5 · Heads of Department · Stop 16 of 17',
      text: TOUR_TEXT['Heads of Department'],
    });
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
    if (lv !== 0) {
      if (buildingId !== 'hub') {
        const spec = DISTRICT_BUILDING_MAP[buildingId];
        return spec.groundY + lv * spec.floorH + 0.12;
      }
      return liftY(lv);
    }
    if (Math.abs(x) <= 20.0 && z >= 0 && z <= 11.025) return 0;
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
    const minDist = 0.48;
    const minDistSq = minDist * minDist;
    const py = actor.g.position.y;
    let rx = nx;
    let rz = nz;

    const pushFrom = (other: PersonActor) => {
      if (other === actor || !other.g.visible) return;
      const st = (other as { state?: string }).state;
      if (st === 'inCab' || st === 'away') return;
      if (Math.abs(other.g.position.y - py) > 0.65) return;
      const dx = rx - other.g.position.x;
      const dz = rz - other.g.position.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        const d = Math.sqrt(dSq);
        if (d > 0.001) {
          rx = other.g.position.x + (dx / d) * minDist;
          rz = other.g.position.z + (dz / d) * minDist;
        } else {
          rx += 0.25;
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
    opts?: { allowLiftShaft?: boolean; ignoreChair?: TrackedChairCollider; radius?: number }
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
      if (actorState !== 'inCab' && lv === 0) {
        P.g.position.y = this.groundElevationAt(0, fx, fz);
      }
      P.moving = false;
      return true;
    }

    const totalStep = Math.min(dist, (P.speed || 2.3) * dt);
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
      if (lv === 0) {
        P.g.position.y = this.groundElevationAt(0, nx, nz);
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
    P: PersonActor & { navQueue?: Array<{ x: number; z: number }>; navKey?: string },
    lv: number,
    key: string,
    toX: number,
    toZ: number,
    dt: number,
    options?: {
      useHomeDock?: { homeX: number; homeZ: number; chairCollider?: TrackedChairCollider; behindCounter?: boolean };
      endBeforeDock?: boolean;
      allowLiftShaftAtEnd?: boolean;
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
      const body = buildObstacleAwarePath(lv, fromX, fromZ, targetDock.x, targetDock.z, {
        ignoreChair: options?.useHomeDock?.chairCollider,
      });
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

    const reached = this.walkPt(P, wp.x, wp.z, dt, {
      allowLiftShaft: isLast && options?.allowLiftShaftAtEnd,
      ignoreChair,
      radius,
    });
    if (reached) {
      P.navQueue.shift();
    }
    if (P.navQueue.length === 0) {
      P.moving = false;
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
          { x: -13.8, z: 6.8, face: Math.PI }
        );
      } else if (lv === 0) {
        out.push(
          { x: -5.4, z: 9.55, face: 0 },
          { x: 5.4, z: 9.55, face: 0 },
          { x: -6.8, z: 9.45, face: 0.2 },
          { x: 6.8, z: 9.45, face: -0.2 }
        );
      } else if (lv === 5) {
        out.push(
          { x: homeX < 0 ? Math.max(-17.8, Math.min(-2.2, homeX)) : 3.2, z: 9.72, face: 0 },
          { x: -12.6, z: 9.75, face: 0 },
          { x: 13.0, z: 9.75, face: 0 }
        );
      } else {
        out.push(
          { x: homeX < 0 ? -13.6 : 13.6, z: 9.72, face: 0 },
          { x: homeX < 0 ? -5.8 : 5.8, z: 9.72, face: 0 },
          { x: -15.4, z: 9.72, face: 0 },
          { x: 15.4, z: 9.72, face: 0 }
        );
      }
      return out;
    }

    // 'balcony' — curated open atrium walkway viewpoints per floor
    if (lv === 0) {
      out.push(
        { x: -6.5, z: 9.65, face: 0 },
        { x: -4.8, z: 9.65, face: 0 },
        { x: 4.8, z: 9.65, face: 0 },
        { x: 6.5, z: 9.65, face: 0 },
        { x: -13.6, z: 9.65, face: 0 },
        { x: 13.6, z: 9.65, face: 0 }
      );
    } else if (lv === 4) {
      out.push(
        { x: -15.4, z: 9.75, face: 0 },
        { x: -12.8, z: 9.75, face: 0 },
        { x: -5.4, z: 9.75, face: 0 },
        { x: 0.0, z: 9.75, face: 0 },
        { x: 5.4, z: 9.75, face: 0 },
        { x: 13.4, z: 9.75, face: 0 },
        { x: 16.2, z: 9.75, face: 0 }
      );
    } else if (lv === 5) {
      out.push(
        { x: -17.4, z: 9.75, face: 0 },
        { x: -12.5, z: 9.75, face: 0 },
        { x: -7.5, z: 9.75, face: 0 },
        { x: -2.5, z: 9.75, face: 0 },
        { x: 3.0, z: 9.75, face: 0 },
        { x: 12.6, z: 9.75, face: 0 },
        { x: 15.8, z: 9.75, face: 0 }
      );
    } else {
      out.push(
        { x: -16.2, z: 9.72, face: 0 },
        { x: -13.5, z: 9.72, face: 0 },
        { x: -6.5, z: 9.72, face: 0 },
        { x: -3.5, z: 9.72, face: 0 },
        { x: 3.5, z: 9.72, face: 0 },
        { x: 6.5, z: 9.72, face: 0 },
        { x: 13.5, z: 9.72, face: 0 },
        { x: 16.2, z: 9.72, face: 0 }
      );
    }
    return out;
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

    if (ag.lv < 0) {
      if (forceMove || r < 0.72) {
        goal = r < 0.4 ? 'inspect' : r < 0.62 ? 'patrol' : 'socialize';
      } else {
        goal = 'stretch';
      }
    } else if (brain.identity.topicKey === 'security') {
      goal = r < 0.48 ? 'patrol' : r < 0.72 ? 'socialize' : r < 0.88 ? 'balcony' : 'coffeeBreak';
    } else {
      const tired = brain.energy < 46;
      const lonely = brain.social < 42;
      if (forceMove || ag.mode === 'home') {
        const wStay = forceMove ? 0 : tired ? 0.25 : 0.5;
        if (r < wStay) {
          goal = 'work';
        } else if (r < wStay + (tired ? 0.26 : 0.16)) {
          goal = 'stretch';
        } else if (r < wStay + (tired ? 0.52 : 0.34)) {
          goal = 'balcony';
        } else if (r < wStay + (lonely ? 0.76 : 0.52)) {
          goal = 'socialize';
        } else {
          goal = 'coffeeBreak';
        }
      } else {
        goal = r < 0.72 && !forceMove ? 'work' : r < 0.86 ? 'balcony' : 'socialize';
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
              { x: 4.4, z: 5.8, face: Math.PI, pose: 'carry' },
            ]
          : [
              { x: -5.2, z: 9.4, face: 0.15, pose: 'radio' },
              { x: 5.2, z: 9.4, face: -0.15, pose: 'stand' },
              { x: 4.6, z: 7.2, face: 0, pose: 'readDoc' },
              { x: -4.6, z: 7.4, face: 0.3, pose: 'hold' },
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

    if (p.state === 'away') {
      if (w === 'desk') {
        const sx = p.sd * (1.2 + Math.random() * 2.0);
        const sz = 15.0 + Math.random() * 3.0;
        p.g.visible = true;
        p.g.position.set(sx, this.groundElevationAt(0, sx, sz), sz);
        p.navQueue = undefined;
        p.navKey = undefined;
        this.setSafePose(p, 'stand');
        p.state = 'toLift';
        if (p.brain) {
          setBrainThought(
            p.brain,
            'Focused',
            'Arriving for shift',
            `Just arrived at DomainTechHub—heading up to ${p.d.n}.`
          );
        }
      }
      return;
    }

    if (p.state === 'out') {
      if (SEATED_POSES.has(p.pose)) this.setSafePose(p, 'stand');
      const tx = p.sd * 2.2;
      const tz = w === 'lunch' ? 12.5 : 17.5;
      if (this.followNavPath(p, 0, `w-out-${w}-${p.sd}`, tx, tz, dt)) {
        if (w === 'home') {
          p.state = 'away';
          p.g.visible = false;
          p.navQueue = undefined;
          p.navKey = undefined;
        }
      } else if (w === 'desk') {
        p.navQueue = undefined;
        p.navKey = undefined;
        p.state = 'toLift';
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
            w === 'lunch' ? 'Heading out for lunch' : 'Wrapping up shift',
            w === 'lunch'
              ? 'Lunch window is open—taking the lift down for a proper meal.'
              : 'Great day’s work—heading downstairs to catch my ride home.'
          );
        }
        p.navQueue = undefined;
        p.navKey = undefined;
        this.setSafePose(p, 'stand');
        p.state = 'toLift';
      } else {
        this.stepFreeAgent(p, dt);
      }
      return;
    }

    if (p.state === 'toLift') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      const liftLv = w === 'desk' ? 0 : p.d.lv;
      if (
        this.followNavPath(p, liftLv, `w-lift-${liftLv}-${p.sd}`, gx, LANE, dt, {
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

    if (p.state === 'away') {
      if (on) {
        const sx = p.sd * 2.2;
        p.g.visible = true;
        p.g.position.set(sx, this.groundElevationAt(0, sx, 15.2), 15.2);
        p.navQueue = undefined;
        p.navKey = undefined;
        this.setSafePose(p, 'stand');
        p.state = 'in';
      }
      return;
    }
    if (p.state === 'in') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      if (p.lv === 0) {
        if (
          this.followNavPath(p, 0, `d-in0-${p.dx}-${p.dz}`, p.dx, p.dz, dt, {
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
      } else if (this.followNavPath(p, 0, `d-inlift-${p.sd}`, gx, LANE, dt)) {
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
        this.setSafePose(p, 'stand');
        p.state = p.lv === 0 ? 'out' : 'toLift';
      } else {
        this.stepFreeAgent(p, dt);
      }
      return;
    }
    if (p.state === 'toLift') {
      if (p.pose !== 'stand') this.setSafePose(p, 'stand');
      if (
        this.followNavPath(p, p.lv, `d-lift-${p.lv}-${p.sd}`, gx, LANE, dt, {
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

  private stepVeh(v: TrafficVehicle, pts: Array<[number, number]>, nxt: TrafficVehicle['state'], dt: number) {
    v._arr = v._arr || 0;
    const p = pts[v._arr];
    const dx = p[0] - v.g.position.x;
    const dz = p[1] - v.g.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.2) {
      v.g.position.x = p[0];
      v.g.position.z = p[1];
      v._arr++;
      if (v._arr >= pts.length) {
        v._arr = 0;
        v.state = nxt;
        if (nxt === 'parked' && v.bay) v.g.rotation.y = v.bay.face;
      }
      return;
    }
    const step = Math.min(dist, v.spd * dt);
    v.g.position.x += (dx / dist) * step;
    v.g.position.z += (dz / dist) * step;
    const ty = Math.atan2(dx, dz);
    const dy = Math.atan2(Math.sin(ty - v.g.rotation.y), Math.cos(ty - v.g.rotation.y));
    v.g.rotation.y += dy * Math.min(1, dt * 8);
  }

  private updateTraffic(dt: number, m: number) {
    for (const v of this.TRAF) {
      if (v.state === 'street') {
        v.x += v.dir * v.spd * dt;
        if (v.x > STREET_END) v.x = -STREET_END;
        if (v.x < -STREET_END) v.x = STREET_END;
        v.g.position.set(v.x, -0.62, v.lane);
        v.g.rotation.y = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else if (v.state === 'parked' && v.bay) {
        if (m >= (v.out_t || 9999) || m < (v.in_t || 0)) {
          v.state = 'toGate';
          v._arr = 0;
        }
      } else if (v.state === 'toBay' && v.bay) {
        const b = v.bay;
        const xg = b.sd * DRV_X;
        this.stepVeh(
          v,
          [
            [xg, LANE_E],
            [xg, AISLE_Z],
            [b.x, AISLE_Z],
            [b.x, b.z],
          ],
          'parked',
          dt
        );
      } else if (v.state === 'toGate' && v.bay) {
        const b = v.bay;
        const xg = b.sd * DRV_X;
        this.stepVeh(
          v,
          [
            [b.x, AISLE_Z],
            [xg, AISLE_Z],
            [xg, LANE_E],
            [xg, LANE_W],
          ],
          'street',
          dt
        );
      }
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
    for (const v of this.TRAF) {
      if (!v.bay) continue;
      if (m >= (v.in_t || 0) && m < (v.out_t || 9999)) {
        v.state = 'parked';
        v.g.position.set(v.bay.x, -0.62, v.bay.z);
        v.g.rotation.y = v.bay.face;
      } else {
        v.state = 'street';
        v.x = (Math.random() - 0.5) * 180;
        v.g.position.set(v.x, -0.62, v.lane);
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
    setPose(this.guideActor, 'stand', this.P_LIB);
    this.tourSt = this.tourLv === s.lv ? 'toDest' : 'toLift';
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
      if (this.walkPt(this.guideActor, wp.x, wp.z, dt)) {
        this.guideNavQueue.shift();
      }
      return this.guideNavQueue.length === 0;
    };

    if (this.tourSt === 'toLift') {
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
          const destZ = 8.4;
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

    // Executive & reception day-visitor zones
    let recAct = 0;
    let boardAct = 0;
    let loungeAct = 0;
    let secrAct = 0;
    let hodAct = 0;
    let ceoAct = 0;
    if (this.staffVisible) {
      for (let i = 0; i < this.DAYONLY.length; i++) {
        const d = this.DAYONLY[i];
        if (!d.g.visible || d.state === 'away') continue;
        const w = d.state === 'atDesk' ? 1 : 0.4;
        if (d.lv === 0) recAct += w;
        else if (d.lv === 4) {
          if (Math.abs(d.dx) < 8) boardAct += w;
          else if (d.dx < -10) loungeAct += w;
          else secrAct += w;
        } else if (d.lv === 5) {
          if (d.dx > 8) ceoAct += w;
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

    return this.ambientSources;
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
      this.walkPos.x = Math.max(-19.0, Math.min(19.0, this.walkPos.x));
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
      this.walkPos.x = Math.max(-76.5, Math.min(76.5, this.walkPos.x));
      this.walkPos.z = Math.max(-34.0, Math.min(102.0, this.walkPos.z));

      let extraVehicles: VehicleObb[] | undefined;
      if (this.walkPos.z > 14.0 && this.walkPos.z < 76.0) {
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
  /* =========================================================
     PER-FRAME SIMULATION TICK
     ========================================================= */
  public update(dt: number, t: number, camera: THREE.Camera, controls: OrbitControls) {
    if (this.simRate > 0) {
      this.simMin = (this.simMin + (dt * this.simRate) / 4) % 1440;
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
      if (b.g.visible) this.stepFreeAgent(b, dt);
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
    this.updateTraffic(dt, this.simMin);

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
        const inspecting = list.length - walking;
        const parts: string[] = [];
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
        ROOMS.filter((r) => r.lv === lv).forEach((r) => {
          zones.push({
            zone: r.n,
            color: `#${r.c.toString(16).padStart(6, '0')}`,
            count: 0,
            status: 'Staff hidden (Staff OFF)',
          });
        });
      } else if (lv === 4) {
        zones.push(
          { zone: 'Board Room', color: '#c9a24b', count: 0, status: 'Staff hidden' },
          { zone: 'Executive Lounge', color: '#7a5c3a', count: 0, status: 'Staff hidden' },
          { zone: 'Board Secretary', color: '#5d6b7a', count: 0, status: 'Staff hidden' }
        );
      } else {
        zones.push({ zone: 'Executive Suite', color: '#8a1f2e', count: 0, status: 'Staff hidden' });
      }
      return {
        levelTitle: lv === 0 ? 'Ground Floor (G) · Lobby & Bays' : `Level ${lv}`,
        activeCount: 0,
        zones,
      };
    }

    if (lv <= 3) {
      if (lv === 0) {
        const lobbyActors = this.DAYONLY.filter((d) => d.lv === 0 && d.g.visible && d.state !== 'away');
        const secVisible =
          Boolean(this.secOffActor) &&
          this.secOffActor.g.visible &&
          Math.abs(this.secOffActor.g.position.y) < 0.5;
        const lobbyCount = lobbyActors.length + (secVisible ? 1 : 0);
        activeCount += lobbyCount;
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

      return {
        levelTitle: lv === 0 ? 'Ground Floor (G) · Lobby & Bays' : `Level ${lv} · Department Bays`,
        activeCount,
        zones,
      };
    }

    if (lv === 4) {
      const l4 = this.DAYONLY.filter((d) => d.lv === 4 && d.g.visible && d.state !== 'away');
      const directors = l4.filter((d) => Math.abs(d.dx) < 8);
      const barista = l4.filter((d) => d.dx < -10);
      const secr = l4.filter((d) => d.dx > 10);
      activeCount = l4.length;
      zones.push(
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
        }
      );
      return {
        levelTitle: 'Level 4 · Board & Executive Lounge',
        activeCount,
        zones,
      };
    }

    // Level 5 · CEO & Heads of Department
    const l5 = this.DAYONLY.filter((d) => d.lv === 5 && d.g.visible && d.state !== 'away');
    activeCount = l5.length;
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

    return {
      levelTitle: 'Level 5 · CEO & Heads of Department',
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
