import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LiftCabState } from './architecture';
import type { AmbientSource } from './audio';
import {
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
  type TourStop,
} from './constants';
import {
  createGuideActor,
  createHumanPalette,
  makePerson,
  MODES,
  pickMode,
  setPose,
  updatePersonKinematics,
  type HumanPalette,
  type PersonActor,
} from './human';
import type { MaterialLibrary } from './materials';
import { getRoundedBox, makeCar } from './props';
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

  // First-person walk state
  public walkOn = false;
  public walkLocked = false;
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
  private cutawayMaxY: number | null = null;

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
    onFootstep?: () => void
  ) {
    this.scene = scene;
    this.P_LIB = createHumanPalette(M);
    this.cabs = cabs;
    this.onFootstep = onFootstep;

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
    this.guideActor.g.position.set(14.5, 0, LANE);
    this.guideActor.tyaw = -0.3;
    setPose(this.guideActor, 'stand', this.P_LIB);
    this.peopleGroup.add(this.guideActor.g);

    this.STOPS = this.buildTourStops();
    this.populateOfficeStaff(M);
    this.populateTrafficAndParking();
    this.initAmbientSources();
    this.snapAll();
  }

  private addPerson(
    lv: number,
    x: number,
    z: number,
    face: number,
    pose: string,
    opts: {
      skin: THREE.MeshPhysicalMaterial;
      shirt: THREE.Material;
      hair: THREE.MeshStandardMaterial;
      trou: THREE.Material;
      s?: number;
      fem?: boolean;
      hs?: number;
      sneakers?: boolean;
      blazer?: boolean;
      look?: number;
      gest?: boolean;
      modes?: Array<[string, number]>;
      route?: Array<{ x: number; z: number; wait?: number; pose?: string; face?: number }>;
      walkPose?: string;
      speed?: number;
      tie?: number;
    },
    M: MaterialLibrary
  ): PersonActor {
    const P = makePerson(opts, this.P_LIB, M);
    P.g.position.set(x, LV[lv], z);
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
    if (opts.tie != null) {
      const sf = new THREE.Mesh(
        getRoundedBox(0.14, 0.4, 0.015, 0.005, 2),
        new THREE.MeshStandardMaterial({ color: 0xf4f4f6, roughness: 0.55 })
      );
      sf.position.set(0, 0.4, 0.132);
      P.tor.add(sf);

      const ti = new THREE.Mesh(
        getRoundedBox(0.044, 0.32, 0.016, 0.004, 2),
        new THREE.MeshStandardMaterial({ color: opts.tie, roughness: 0.42 })
      );
      ti.position.set(0, 0.36, 0.14);
      P.tor.add(ti);
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
      new THREE.MeshPhysicalMaterial({
        color: col,
        normalMap: M.textures.fabricNormal,
        normalScale: new THREE.Vector2(0.32, 0.32),
        roughness: 0.8,
        sheen: 0.45,
        sheenRoughness: 0.72,
      });

    // Desk workers across two shifts (Morning + Afternoon)
    ROOMS.forEach((d, idx) => {
      const cx = COLX[d.col];
      const modes = MODES[d.t] || MODES.def;
      [-2.05, 0, 2.05].forEach((ox, k) => {
        const seed = idx * 17 + k * 7;
        for (let sh = 0; sh < 2; sh++) {
          const id = seed + sh * 101;
          const fem = id % 3 === 1;
          const p = this.addPerson(
            d.lv,
            cx + ox,
            5.15,
            Math.PI,
            pickMode(modes),
            {
              skin: P_LIB.skins[h(id, 5)],
              shirt: P_LIB.shirts[h(id * 3, 10)],
              hair: P_LIB.hairs[h(id * 5, 4)],
              trou: P_LIB.trous[h(id * 7, 4)],
              fem,
              s: (fem ? 0.94 : 0.99) + (id % 5) * 0.015,
              modes,
              sneakers: id % 2 === 0,
            },
            M
          ) as WorkerActor;
          p.d = d;
          p.sh_shift = sh;
          p.sd = cx < 0 ? -1 : 1;
          p.seat = { x: cx + ox, z: 5.15 };
          p.state = sh === 0 ? 'atDesk' : 'away';
          p.cab = 0;
          p.ex = 0;
          p.want = 'desk';
          p.lunch = (idx * 3 + k) % 3;
          if (sh === 1) p.g.visible = false;
          this.WORKERS.push(p);
        }
      });
    });

    // Receptionist + Lounge concierge + Visitor
    const addDayVisitor = (
      lv: number,
      dx: number,
      dz: number,
      df: number,
      dpose: string,
      opts: Parameters<AtriumSimulation['addPerson']>[5]
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
      this.DAYONLY.push(p);
      return p;
    };

    addDayVisitor(0, -1.2, 4.9, 0, 'standType', {
      skin: P_LIB.skins[0],
      shirt: sMat(0xf4f4f6),
      hair: P_LIB.hairs[0],
      trou: P_LIB.trous[0],
      fem: true,
      hs: 1,
      look: 0.4,
      blazer: true,
    });
    addDayVisitor(0, 2.55, 8.5, -Math.PI / 2, 'hold', {
      skin: P_LIB.skins[2],
      shirt: P_LIB.shirts[4],
      hair: P_LIB.hairs[1],
      trou: P_LIB.trous[1],
      look: 0.3,
      sneakers: true,
    });

    // Ground Security Officer patrolling lobby
    const secOff = this.addPerson(
      0,
      -5,
      9.4,
      0.2,
      'radio',
      {
        skin: P_LIB.skins[1],
        shirt: sMat(0x1b2b4a),
        hair: P_LIB.hairs[3],
        trou: sMat(0x161b26),
        s: 1.07,
        speed: 0.9,
        route: [
          { x: -5, z: 9.4, wait: 3, pose: 'radio', face: 0.1 },
          { x: 5, z: 9.4, wait: 3, pose: 'stand', face: -0.1 },
          { x: 3.5, z: 7.2, wait: 2, pose: 'stand', face: 0 },
        ],
      },
      M
    );
    const badgeMesh = new THREE.Mesh(
      getRoundedBox(0.06, 0.08, 0.015, 0.004, 2),
      new THREE.MeshStandardMaterial({ color: 0xe6b83a, metalness: 0.9, roughness: 0.2 })
    );
    badgeMesh.position.set(0.1, 0.44, 0.145);
    secOff.tor.add(badgeMesh);

    // Executive Lounge barista
    addDayVisitor(4, -17.6, 0.4, 0, 'standType', {
      skin: P_LIB.skins[1],
      shirt: sMat(0x2a2d34),
      hair: P_LIB.hairs[0],
      trou: P_LIB.trous[0],
      fem: true,
      hs: 2,
      look: 0.3,
    });

    // Directors around Board Room table
    const dirCol = [0x1c2838, 0x3a2434, 0x283630, 0x24262e, 0x363024];
    const execSeats: Array<[number, number, number, string, number, number]> = [
      [-6.9, 4.9, Math.PI / 2, 'talk', 1, 0x9c282e],
      [-1.8, 3.0, 0, 'sit', 0, 0x284e86],
      [1.8, 3.0, 0, 'sit', 0, 0x326a5a],
      [-3.6, 6.8, Math.PI, 'sit', 1, 0],
      [3.6, 6.8, Math.PI, 'talk', 0, 0x5c3670],
    ];
    execSeats.forEach(([x, z, rot, pose, fem, tie], i) => {
      addDayVisitor(4, x, z, rot, pose, {
        skin: P_LIB.skins[i % 5],
        shirt: sMat(dirCol[i]),
        hair: P_LIB.hairs[i % 4],
        trou: sMat(dirCol[i]),
        fem: !!fem,
        s: fem ? 0.97 : 1.04,
        blazer: true,
        gest: pose === 'talk',
        look: 0.35,
        tie: fem ? undefined : tie,
      });
    });

    // Heads of Department & Board Secretary & EA & CEO
    (
      [
        [4, 15, 2.2, 0, 'type', 0x303846, 1, 0],
        [5, -17.5, 2.2, 0, 'type', 0x1e2c44, 0, 0x2e64b8],
        [5, -12.5, 2.2, 0, 'phone', 0x422238, 1, 0],
        [5, -7.5, 2.2, 0, 'type', 0x1c3a32, 0, 0x1e7a5e],
        [5, -2.5, 2.2, 0, 'type', 0x3c2e22, 1, 0],
        [5, 3, 2.2, 0, 'type', 0x2c3440, 1, 0],
        [5, 13, 2.2, 0, 'phone', 0x141a26, 0, 0x8a1f2e],
      ] as const
    ).forEach(([lv, x, z, rot, pose, col, fem, tie], i) => {
      addDayVisitor(lv, x, z, rot, pose, {
        skin: P_LIB.skins[(i + 2) % 5],
        shirt: sMat(col),
        hair: P_LIB.hairs[(i + 1) % 4],
        trou: sMat(col),
        fem: !!fem,
        blazer: true,
        s: lv === 5 && x === 13 ? 1.12 : fem ? 0.96 : 1.02,
        look: 0.35,
        tie: tie || undefined,
      });
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

  private walkPt(P: PersonActor, gx: number, gz: number, dt: number): boolean {
    const dx = gx - P.g.position.x;
    const dz = gz - P.g.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) {
      P.g.position.x = gx;
      P.g.position.z = gz;
      P.moving = false;
      return true;
    }
    const step = Math.min(dist, (P.speed || 2.3) * dt);
    P.g.position.x += (dx / dist) * step;
    P.g.position.z += (dz / dist) * step;
    P.tyaw = Math.atan2(dx, dz);
    P.moving = true;
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
          if (this.walkPt(p, cx - sd * 1.45, LANE, dt)) {
            slots[i] = null;
            p.cab = 0;
            p.g.position.y = c.y;
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
          if (this.walkPt(cand, cx, LANE + (empty ? 0.35 : -0.35), dt)) {
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

  private wThink(p: WorkerActor, dt: number) {
    const w = this.wantOf(p, this.simMin);
    p.want = w;
    const gx = p.sd * GATE_STOP;

    if (p.state === 'away') {
      if (w === 'desk') {
        p.g.visible = true;
        p.g.position.set(p.sd * (Math.random() * 3 + 2), 0, 14.5 + Math.random() * 4);
        p.state = 'toLift';
      }
      return;
    }

    if (p.state === 'out') {
      const tx = p.sd * (2 + Math.random() * 2);
      const tz = w === 'lunch' ? 12.5 : 17.5;
      if (this.walkPt(p, tx, tz, dt)) {
        if (w === 'home') {
          p.state = 'away';
          p.g.visible = false;
        }
      } else if (w === 'desk') {
        p.state = 'toLift';
      }
      return;
    }

    if (p.state === 'atDesk') {
      if (w !== 'desk') {
        p.state = 'toLift';
      } else if (p.modes) {
        p.timer -= dt;
        if (p.timer <= 0) {
          setPose(p, pickMode(p.modes), this.P_LIB);
          p.timer = 4 + Math.random() * 7;
        }
      }
      return;
    }

    if (p.state === 'toLift') {
      if (p.pose !== 'stand') setPose(p, 'stand', this.P_LIB);
      if (w === 'desk') {
        if (this.walkPt(p, p.sd * (LIFTX - p.sd * 1.45), LANE, dt)) {
          p.state = 'wait';
          p.tyaw = p.sd * Math.PI / 2;
        }
      } else {
        if (Math.abs(p.g.position.z - LANE) > 0.3) {
          this.walkPt(p, p.g.position.x, LANE, dt);
        } else if (this.walkPt(p, gx, LANE, dt)) {
          p.state = 'wait';
          p.tyaw = p.sd * Math.PI / 2;
        }
      }
      return;
    }

    if (p.state === 'toDesk') {
      if (p.pose !== 'stand') setPose(p, 'stand', this.P_LIB);
      if (Math.abs(p.g.position.x - p.seat.x) > 0.5 && Math.abs(p.g.position.z - LANE) > 0.35) {
        this.walkPt(p, p.g.position.x, LANE, dt);
      } else if (Math.abs(p.g.position.x - p.seat.x) > 0.2) {
        this.walkPt(p, p.seat.x, LANE, dt);
      } else if (this.walkPt(p, p.seat.x, p.seat.z, dt)) {
        p.state = 'atDesk';
        p.tyaw = Math.PI;
        setPose(p, p.modes ? pickMode(p.modes) : 'type', this.P_LIB);
      }
    }
  }

  private dThink(p: DayVisitorActor, dt: number) {
    const on = this.simMin >= 480 && this.simMin < 1050;
    const gx = p.sd * GATE_STOP;

    if (p.state === 'away') {
      if (on) {
        p.g.visible = true;
        p.g.position.set(p.sd * 3, 0, 15);
        p.state = 'in';
      }
      return;
    }
    if (p.state === 'in') {
      if (p.lv === 0) {
        if (this.walkPt(p, p.dx, p.dz, dt)) {
          p.state = 'atDesk';
          p.tyaw = p.df;
          setPose(p, p.dpose, this.P_LIB);
        }
      } else if (this.walkPt(p, p.sd * (LIFTX - p.sd * 1.45), LANE, dt)) {
        p.state = 'wait';
        p.tyaw = p.sd * Math.PI / 2;
      }
      return;
    }
    if (p.state === 'atDesk') {
      if (!on) p.state = p.lv === 0 ? 'out' : 'toLift';
      return;
    }
    if (p.state === 'toLift') {
      if (p.pose !== 'stand') setPose(p, 'stand', this.P_LIB);
      if (Math.abs(p.g.position.z - LANE) > 0.3) this.walkPt(p, p.g.position.x, LANE, dt);
      else if (this.walkPt(p, gx, LANE, dt)) {
        p.state = 'wait';
        p.tyaw = p.sd * Math.PI / 2;
      }
      return;
    }
    if (p.state === 'toDesk') {
      if (p.pose !== 'stand') setPose(p, 'stand', this.P_LIB);
      if (Math.abs(p.g.position.x - p.dx) > 0.4 && Math.abs(p.g.position.z - LANE) > 0.35) {
        this.walkPt(p, p.g.position.x, LANE, dt);
      } else if (Math.abs(p.g.position.x - p.dx) > 0.25) {
        this.walkPt(p, p.dx, LANE, dt);
      } else if (this.walkPt(p, p.dx, p.dz, dt)) {
        p.state = 'atDesk';
        p.tyaw = p.df;
        setPose(p, p.dpose, this.P_LIB);
      }
      return;
    }
    if (p.state === 'out') {
      if (this.walkPt(p, p.sd * 2.5, 17, dt)) {
        p.state = 'away';
        p.g.visible = false;
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
    for (const p of this.WORKERS) {
      const w = this.wantOf(p, m);
      p.want = w;
      if (w === 'desk') {
        p.state = 'atDesk';
        p.g.visible = true;
        p.g.position.set(p.seat.x, LV[p.d.lv], p.seat.z);
        p.yaw = p.tyaw = Math.PI;
        p.g.rotation.y = Math.PI;
        setPose(p, p.modes ? pickMode(p.modes) : 'type', this.P_LIB);
      } else {
        p.state = 'away';
        p.g.visible = false;
      }
    }
    const dayOn = m >= 480 && m < 1050;
    for (const p of this.DAYONLY) {
      if (dayOn) {
        p.state = 'atDesk';
        p.g.visible = true;
        p.g.position.set(p.dx, LV[p.lv], p.dz);
        p.yaw = p.tyaw = p.df;
        p.g.rotation.y = p.df;
        setPose(p, p.dpose, this.P_LIB);
      } else {
        p.state = 'away';
        p.g.visible = false;
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
    this.goStop(this.tourI, camera, controls);
  }

  public startTourAtRoom(roomName: string, camera: THREE.Camera, controls: OrbitControls) {
    const idx = this.STOPS.findIndex(
      (s) => s.n === roomName || s.room?.n === roomName || (roomName.startsWith('Head of ') && s.n === 'Heads of Department')
    );
    this.startTour(idx >= 0 ? idx : 0, camera, controls);
  }

  public endTour() {
    this.tourOn = false;
    this.tourPlay = false;
    this.tourSt = 'idle';
    this.tourCam.on = false;
    this.cabs[-1].guide = false;
    this.cabs[1].guide = false;
    this.cabs[-1].gw = false;
    this.cabs[1].gw = false;
    setPose(this.guideActor, 'stand', this.P_LIB);
  }

  public goStop(i: number, camera?: THREE.Camera, controls?: OrbitControls) {
    this.tourI = ((i % this.STOPS.length) + this.STOPS.length) % this.STOPS.length;
    const s = this.STOPS[this.tourI];
    this.tourArr = false;
    this.tourHold = 0;
    this.tourCab = s.cx < 0 ? -1 : 1;
    setPose(this.guideActor, 'stand', this.P_LIB);
    this.tourSt = this.tourLv === s.lv ? 'toDest' : 'toLift';
    this.cabs[-1].guide = false;
    this.cabs[1].guide = false;
    this.cabs[-1].gw = false;
    this.cabs[1].gw = false;

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
      updatePersonKinematics(this.guideActor, dt, t, 0);
      return;
    }

    const s = this.STOPS[this.tourI];
    const sd = this.tourCab;
    const cx = sd * LIFTX;
    const c = this.cabs[sd];

    if (this.tourSt === 'toLift') {
      const gx = sd * (LIFTX - sd * 1.45);
      if (this.walkPt(this.guideActor, gx, LANE, dt)) {
        this.tourSt = 'waitCab';
        this.guideActor.tyaw = (sd * Math.PI) / 2;
        c.guide = true;
        c.gw = false;
      }
    } else if (this.tourSt === 'waitCab') {
      if (c.ph === 'exchange' && Math.abs(c.y - liftY(this.tourLv)) < 0.1) {
        if (this.walkPt(this.guideActor, cx, LANE, dt)) {
          this.tourSt = 'toDest';
          this.tourLv = s.lv;
          this.guideActor.tyaw = (-sd * Math.PI) / 2;
          c.gw = false;
        }
      }
    } else if (this.tourSt === 'toDest') {
      if (Math.abs(this.guideActor.g.position.y - LV[s.lv]) > 0.1) {
        this.guideActor.g.position.y = c.y;
        if (c.ph === 'exchange' && Math.abs(c.y - LV[s.lv]) < 0.1) {
          this.walkPt(this.guideActor, sd * (LIFTX - sd * 1.55), LANE, dt);
        }
      } else {
        if (c.guide && Math.abs(this.guideActor.g.position.x) > GATE_STOP) {
          this.walkPt(this.guideActor, sd * (LIFTX - sd * 1.55), LANE, dt);
          if (Math.abs(this.guideActor.g.position.x - sd * (LIFTX - sd * 1.55)) < 0.15) {
            c.guide = false;
            c.gw = false;
          }
        } else {
          const destX = s.cx + (s.cx < 0 ? 1.8 : -1.8);
          const destZ = 8.4;
          if (Math.abs(this.guideActor.g.position.x - destX) > 0.4 && Math.abs(this.guideActor.g.position.z - LANE) > 0.35) {
            this.walkPt(this.guideActor, this.guideActor.g.position.x, LANE, dt);
          } else if (Math.abs(this.guideActor.g.position.x - destX) > 0.2) {
            this.walkPt(this.guideActor, destX, LANE, dt);
          } else if (this.walkPt(this.guideActor, destX, destZ, dt)) {
            this.tourSt = 'arrived';
            this.tourArr = true;
            this.tourHold = 0;
            this.guideActor.tyaw = 0.2;
            setPose(this.guideActor, 'present', this.P_LIB);
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

    return this.ambientSources;
  }

  private playFootstep() {
    this.onFootstep?.();
  }

  public enterWalk(camera: THREE.Camera, controls: OrbitControls) {
    if (this.tourOn) this.endTour();
    this.savedCamPos.copy(camera.position);
    this.savedCamTgt.copy(controls.target);
    controls.enabled = false;
    this.walkOn = true;
    this.walkFloor = 0;
    this.walkPos.set(0, LV[0] + 1.65, 22);
    this.walkYaw = 0;
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
    this.walkFloor = Math.max(0, Math.min(FLOORS - 1, lv));
    this.walkPos.y = LV[this.walkFloor] + 1.65;
  }

  public setTouchJoystick(nx: number, ny: number) {
    this.walkJoy.x = nx;
    this.walkJoy.y = ny;
  }

  public wireWalk(dom: HTMLElement, camera: THREE.Camera, controls: OrbitControls): () => void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.walkOn) return;
      this.walkKeys[e.code] = true;
      if (e.code === 'Escape') this.exitWalk(camera, controls);
      if (e.code.startsWith('Digit')) {
        const d = parseInt(e.code.slice(5), 10);
        if (d >= 0 && d < FLOORS) this.setWalkFloor(d);
      }
      if (e.code === 'KeyR' && this.walkFloor < FLOORS - 1) this.setWalkFloor(this.walkFloor + 1);
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

    // Gentle boundaries inside building + plaza
    this.walkPos.x = Math.max(-19.5, Math.min(19.5, this.walkPos.x));
    if (this.walkFloor > 0) {
      this.walkPos.z = Math.max(1.2, Math.min(DEPTH - 0.65, this.walkPos.z));
    } else {
      this.walkPos.z = Math.max(1.2, Math.min(54, this.walkPos.z));
    }

    // Soft collision against furnishings & seated staff
    for (const p of this.PLOCK) {
      const dx = this.walkPos.x - p.x;
      const dz = this.walkPos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < p.r && d > 0.001) {
        this.walkPos.x = p.x + (dx / d) * p.r;
        this.walkPos.z = p.z + (dz / d) * p.r;
      }
    }

    const baseY = LV[this.walkFloor] + 1.65;
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

  public setCutawayMaxY(maxY: number | null) {
    this.cutawayMaxY = maxY;
  }

  private applyActorCutaway(P: PersonActor) {
    const show = this.cutawayMaxY === null || P.g.position.y <= this.cutawayMaxY;
    for (let i = 0; i < P.g.children.length; i++) {
      P.g.children[i].visible = show;
    }
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
    }

    // Lift controllers & office staff simulation
    this.cabCtl(-1, dt);
    this.cabCtl(1, dt);
    for (const w of this.WORKERS) this.wThink(w, dt);
    for (const d of this.DAYONLY) this.dThink(d, dt);

    // Update all animated staff kinematics
    for (const P of this.STAFF) {
      if (!P.g.visible) continue;
      if (P.route && !this.tourOn) {
        const pt = P.route[P.ri || 0];
        if ((P.wait || 0) > 0) {
          P.wait = (P.wait || 0) - dt;
          if ((P.wait || 0) <= 0 && pt.pose) setPose(P, pt.pose, this.P_LIB);
        } else {
          if (P.pose !== (P.walkPose || 'stand')) setPose(P, P.walkPose || 'stand', this.P_LIB);
          if (this.walkPt(P, pt.x, pt.z, dt)) {
            P.ri = ((P.ri || 0) + 1) % P.route.length;
            P.wait = pt.wait || 2;
            if (pt.face != null) P.tyaw = pt.face;
          }
        }
      }

      // Subtle glance toward camera/player when nearby
      let glance = 0;
      this._v1.subVectors(camera.position, P.g.position);
      if (this._v1.lengthSq() < 49) {
        const ty = Math.atan2(this._v1.x, this._v1.z);
        const dy = Math.atan2(Math.sin(ty - P.yaw), Math.cos(ty - P.yaw));
        if (Math.abs(dy) < 1.1) glance = dy * 0.4;
      }

      updatePersonKinematics(P, dt, t, glance);
      this.applyActorCutaway(P);
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
    } else {
      controls.update();
    }
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
      } else if (a.pose === 'type' || a.pose === 'standType') {
        typing++;
      } else if (a.pose === 'talk') {
        talking++;
      } else if (a.pose === 'phone') {
        phone++;
      } else if (a.pose === 'coffee') {
        coffee++;
      } else if (a.pose === 'sit') {
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

  public getFloorActivity(activeLevel: string): FloorActivitySummary | null {
    if (activeLevel === 'overview' || activeLevel === 'tour' || activeLevel === 'walk') {
      return null;
    }

    if (activeLevel === 'b1') {
      return {
        levelTitle: 'Basement 1 · Server Room',
        activeCount: 0,
        zones: [
          {
            zone: 'Core NOC & Racks',
            color: '#6fe3a1',
            count: 0,
            status: '42 server nodes active · 18.4 TB/s · Lift access only',
          },
        ],
      };
    }

    if (activeLevel === 'b2') {
      return {
        levelTitle: 'Basement 2 · Power Room',
        activeCount: 0,
        zones: [
          {
            zone: 'Solar Inverters & Battery',
            color: '#ffb14a',
            count: 0,
            status: 'PV 18.4 kW · AC 17.9 kW · Grid 0',
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
        const secVisible = this.STAFF.some((p) => p.route && p.g.visible && Math.abs(p.g.position.y) < 0.5);
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
          status: barista.length > 0 ? 'Barista at espresso bar' : 'Lounge unattended',
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
    seatZ: number
  ): { workerActivity: string; isOccupied: boolean } {
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
      if (pose === 'standType') return 'Working at standing counter';
      if (pose === 'phone') return 'On a live client / team call';
      if (pose === 'point') return 'Reviewing & pointing on screen';
      if (pose === 'talk') return 'Collaborating at desk';
      if (pose === 'sit') return 'Reviewing reports at desk';
      return 'Working at workstation';
    };

    const worker = this.WORKERS.find(
      (w) => w.d.lv === lv && Math.hypot(w.seat.x - seatX, w.seat.z - seatZ) < 0.85 && w.g.visible
    );
    if (worker) {
      return {
        workerActivity: describePose(worker.pose, worker.state),
        isOccupied: worker.state === 'atDesk',
      };
    }

    const dayActor = this.DAYONLY.find(
      (d) => d.lv === lv && Math.hypot(d.dx - seatX, d.dz - seatZ) < 1.2 && d.g.visible
    );
    if (dayActor) {
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
    hoveredRoom: { title: string; sub: string; color: string } | null,
    audioEnabled: boolean,
    inspectedMonitor: InspectedMonitor | null
  ): HudSnapshot {
    const m = Math.floor(this.simMin) % 1440;
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');

    let shiftLabel = 'After hours';
    if (m >= 420 && m < 720) shiftLabel = 'Morning shift';
    else if (m >= 720 && m < 840) shiftLabel = 'Lunch window';
    else if (m >= 840 && m < 1050) shiftLabel = 'Afternoon shift';
    else if (m >= 1050 && m < 1340) shiftLabel = 'Evening shift';

    const activeStaff = this.WORKERS.filter((w) => w.g.visible).length + this.DAYONLY.filter((d) => d.g.visible).length;
    const activeCars = this.TRAF.filter((v) => v.state === 'street').length;

    const stop = this.STOPS[this.tourI] || this.STOPS[0];
    return {
      simMinutes: this.simMin,
      simRate: this.simRate,
      timeText: `${hh}:${mm}`,
      shiftLabel,
      statsLabel: `${activeStaff} staff on site · ${activeCars} street vehicles`,
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
      floorActivity: this.getFloorActivity(activeLevel),
      inspectedMonitor,
      audioEnabled,
    };
  }

  public dispose() {
    // Cleanup handled by AtriumEngine
  }
}
