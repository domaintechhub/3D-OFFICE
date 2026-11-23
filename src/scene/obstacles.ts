import { COLX, ROOMS } from './constants';
import {
  DISTRICT_BUILDINGS,
  DISTRICT_BUILDING_MAP,
  type BuildingId,
  type DistrictBuildingSpec,
} from './districtData';

export interface BoxObstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  liftDoorSide?: -1 | 1;
  stairwellGate?: boolean;
}

export interface ObbObstacle {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  cos: number;
  sin: number;
}

export interface CircleObstacle {
  x: number;
  z: number;
  r: number;
}

export interface TrackedChairCollider {
  restX: number;
  restZ: number;
  curX: number;
  curZ: number;
  r: number;
}

export interface VehicleObb {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  cos: number;
  sin: number;
}

export interface FloorColliderSet {
  boxes: BoxObstacle[];
  obbs: ObbObstacle[];
  circles: CircleObstacle[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  curvedCounter?: { cx: number; cz: number; rIn: number; rOut: number; halfAngle: number };
}

export interface ResolveObstacleOptions {
  allowLiftShaft?: boolean;
  allowStairwell?: boolean;
  radius?: number;
  ignoreChair?: TrackedChairCollider;
  pedestrianOnly?: boolean;
  districtWalk?: boolean;
  extraVehicles?: ReadonlyArray<VehicleObb>;
}

export const CHAR_RADIUS = 0.24;
const FLOOR_CACHE = new Map<number, FloorColliderSet>();
const CHAIR_COLLIDERS_BY_FLOOR = new Map<number, TrackedChairCollider[]>();
const DISTRICT_FLOOR_CACHE = new Map<string, FloorColliderSet>();
const DISTRICT_CHAIRS_BY_FLOOR = new Map<string, TrackedChairCollider[]>();
let DISTRICT_WALK_CACHE: FloorColliderSet | null = null;

export function registerTrackedChairsForFloor(lv: number, chairs: TrackedChairCollider[]) {
  CHAIR_COLLIDERS_BY_FLOOR.set(lv, chairs);
}

export function registerDistrictChairs(buildingId: BuildingId, lv: number, chairs: TrackedChairCollider[]) {
  DISTRICT_CHAIRS_BY_FLOOR.set(`${buildingId}:${lv}`, chairs);
}

export function clearTrackedChairs() {
  CHAIR_COLLIDERS_BY_FLOOR.clear();
  DISTRICT_CHAIRS_BY_FLOOR.clear();
  DISTRICT_WALK_CACHE = null;
}

function addBox(
  list: BoxObstacle[],
  cx: number,
  cz: number,
  w: number,
  d: number,
  liftDoorSide?: -1 | 1,
  stairwellGate?: boolean
) {
  list.push({
    minX: cx - w * 0.5,
    maxX: cx + w * 0.5,
    minZ: cz - d * 0.5,
    maxZ: cz + d * 0.5,
    liftDoorSide,
    stairwellGate,
  });
}

function addObb(list: ObbObstacle[], cx: number, cz: number, w: number, d: number, rotY: number) {
  list.push({
    cx,
    cz,
    hx: w * 0.5,
    hz: d * 0.5,
    cos: Math.cos(rotY),
    sin: Math.sin(rotY),
  });
}

function buildCollidersForLevel(lv: number): FloorColliderSet {
  const boxes: BoxObstacle[] = [];
  const obbs: ObbObstacle[] = [];
  const circles: CircleObstacle[] = [];

  if (lv === -1) {
    // B1 · Server Room
    addBox(boxes, -8.55, 3.1, 7.6, 0.96);
    addBox(boxes, -8.55, 5.6, 7.6, 0.96);
    addBox(boxes, 5.65, 3.1, 7.6, 0.96);
    addBox(boxes, 5.65, 5.6, 7.6, 0.96);
    [-6.5, -2.5, 1.5].forEach((x) => addBox(boxes, x, 1.0, 1.52, 0.94));
    circles.push({ x: -12.9, z: 7.8, r: 0.22 }, { x: -12.3, z: 7.8, r: 0.22 });
    // Glazed lift security vestibule enclosures & shafts (solid in basement)
    boxes.push(
      { minX: -29.6, maxX: -25.5, minZ: 8.92, maxZ: 11.12 },
      { minX: 25.5, maxX: 29.6, minZ: 8.92, maxZ: 11.12 }
    );
    return { boxes, obbs, circles, minX: -29.2, maxX: 29.2, minZ: 0.72, maxZ: 10.15 };
  }

  if (lv === -2) {
    // B2 · Power Room
    boxes.push({ minX: -10.25, maxX: -2.2, minZ: 0.55, maxZ: 1.48 });
    boxes.push({ minX: 0.75, maxX: 4.85, minZ: 0.6, maxZ: 1.45 });
    [4.9, 6.9, 8.7].forEach((z) => boxes.push({ minX: -6.82, maxX: -0.58, minZ: z - 0.44, maxZ: z + 0.44 }));
    addBox(boxes, 2.2, 8.9, 1.55, 0.74);
    boxes.push({ minX: 7.95, maxX: 10.45, minZ: 2.6, maxZ: 4.25 });
    // Power & Battery Analytics Workstation Desk (x=4.5, z=5.65, w=3.28, d=1.08)
    addBox(boxes, 4.5, 5.65, 3.28, 1.08);
    circles.push({ x: 18, z: 0.5, r: 0.25 });
    boxes.push(
      { minX: -29.6, maxX: -25.5, minZ: 8.92, maxZ: 11.12 },
      { minX: 25.5, maxX: 29.6, minZ: 8.92, maxZ: 11.12 }
    );
    return { boxes, obbs, circles, minX: -29.2, maxX: 29.2, minZ: 0.72, maxZ: 10.15 };
  }

  // Above-ground levels (0..5): Glass lift shaft frames/walls + inner sliding door leaf
  // Only the sliding door leaf opens when allowLiftShaft is true.
  boxes.push(
    // West shaft north/south/outer glass walls
    { minX: -29.62, maxX: -27.46, minZ: 8.92, maxZ: 9.14 },
    { minX: -29.62, maxX: -27.46, minZ: 10.88, maxZ: 11.14 },
    { minX: -29.62, maxX: -29.4, minZ: 8.92, maxZ: 11.14 },
    { minX: -27.64, maxX: -27.44, minZ: 9.14, maxZ: 10.88, liftDoorSide: -1 },
    // East shaft north/south/outer glass walls
    { minX: 27.46, maxX: 29.62, minZ: 8.92, maxZ: 9.14 },
    { minX: 27.46, maxX: 29.62, minZ: 10.88, maxZ: 11.14 },
    { minX: 29.4, maxX: 29.62, minZ: 8.92, maxZ: 11.14 },
    { minX: 27.44, maxX: 27.64, minZ: 9.14, maxZ: 10.88, liftDoorSide: 1 }
  );

  // Front structural columns along balustrade line (60m = 7 grid lines [-30..+30])
  for (let i = 0; i <= 6; i++) {
    if (lv === 0 && i === 3) continue;
    circles.push({ x: -30 + i * 10, z: 10.5, r: 0.24 });
  }

  // East Wing Switchback Stairwell [20.0..24.5] x [1.0..8.4] (L0..L5)
  addBox(boxes, 20.06, 4.7, 0.18, 7.6);
  addBox(boxes, 24.44, 4.7, 0.18, 7.6);
  addBox(boxes, 22.25, 1.05, 4.3, 0.16);
  addBox(boxes, 22.25, 5.55, 0.14, 5.3);

  // East Wing Toilets [24.5..29.8] x [0.2..8.6] (L0..L5)
  addBox(boxes, 24.54, 4.4, 0.14, 8.2);
  addBox(boxes, 28.35, 8.45, 2.9, 0.18);
  addBox(boxes, 27.2, 3.25, 0.16, 6.1);
  boxes.push({ minX: 24.54, maxX: 26.25, minZ: 0.3, maxZ: 3.1 });
  boxes.push({ minX: 24.54, maxX: 25.05, minZ: 3.9, maxZ: 5.75 });
  addBox(boxes, 26.86, 4.8, 0.64, 2.48);
  boxes.push({ minX: 28.1, maxX: 29.8, minZ: 0.3, maxZ: 4.35 });
  addBox(boxes, 27.54, 5.4, 0.64, 2.48);
  circles.push({ x: 29.2, z: 7.6, r: 0.42 });

  // Department bays (Levels 0..3)
  ROOMS.forEach((d, idx) => {
    if (d.lv !== lv) return;
    const x0 = COLX[d.col];
    addBox(boxes, x0 + 4.94, 3.4, 0.22, 6.44);
    addBox(boxes, x0, 3.95, 6.3, 1.44);
    addBox(boxes, x0 + (d.col % 2 ? -1 : 1) * 4.15, 0.95, 1.58, 0.56);
    circles.push({ x: x0 + (d.col % 2 ? 1 : -1) * 4.05, z: 1.25, r: 0.42 });
    circles.push({ x: x0 + (d.col % 2 ? -1 : 1) * 4.55, z: 8.9, r: 0.46 });
    if (idx === 1 || idx === 9) {
      addObb(obbs, x0 + 3.5, 6.6, 1.28, 1.1, -0.5);
    }
    if (idx === 11) {
      addObb(obbs, x0 + 2.4, 7.2, 2.86, 1.12, -0.25);
    }
  });

  if (lv === 0) {
    // West Wing Security Room (cx = -25) partitions & furniture
    boxes.push(
      { minX: -20.14, maxX: -19.96, minZ: 0.3, maxZ: 8.6 },
      { minX: -29.85, maxX: -24.4, minZ: 8.46, maxZ: 8.64 },
      { minX: -22.2, maxX: -20.05, minZ: 8.46, maxZ: 8.64 }
    );
    addBox(boxes, -25.0, 3.6, 4.55, 1.26);
    addBox(boxes, -29.2, 5.4, 0.96, 1.06);
    addBox(boxes, -29.2, 2.0, 0.76, 1.56);
    circles.push({ x: -21.6, z: 5.4, r: 0.68 }, { x: -29.2, z: 7.6, r: 0.45 });

    // Ground Reception Lobby furnishings (exact OBB for armchairs) & Plaza planters
    addObb(obbs, -2.55, 8.5, 1.28, 1.1, Math.PI / 2);
    addObb(obbs, 2.55, 8.5, 1.28, 1.1, -Math.PI / 2);
    circles.push(
      { x: 0, z: 8.55, r: 0.84 },
      { x: -8.4, z: 1.3, r: 0.52 },
      { x: -8.6, z: 9.0, r: 0.5 },
      { x: 8.4, z: 1.3, r: 0.52 },
      { x: 8.6, z: 9.0, r: 0.5 }
    );
    addBox(boxes, -9.3, 7.6, 0.94, 3.65);
    addBox(boxes, 9.3, 7.6, 0.94, 3.65);
    addBox(boxes, -13, 11.2, 3.7, 2.3);
    addBox(boxes, 13, 11.2, 3.7, 2.3);
    addBox(boxes, -25, 11.2, 3.7, 2.3);
    addBox(boxes, 25, 11.2, 3.7, 2.3);
    addBox(boxes, -16.5, 13.4, 3.7, 2.3);
    addBox(boxes, 16.5, 13.4, 3.7, 2.3);
    // Exterior podium terrace edges outside stair span (|x| > 15) prevent drop-offs
    boxes.push(
      { minX: -29.6, maxX: -14.8, minZ: 10.65, maxZ: 11.45 },
      { minX: 14.8, maxX: 29.6, minZ: 10.65, maxZ: 11.45 }
    );
    // Approach planting beds along front plaza (y_plaza = -0.61)
    [
      [-13, 20],
      [13, 20],
      [-13, 40],
      [13, 40],
    ].forEach(([bx, bz]) => addBox(boxes, bx, bz, 4.28, 4.28));

    // Plaza approach street trees (matching architecture.ts)
    const rndT = (n: number) => (((Math.sin(n * 12.9898) * 43758.5453) % 1) + 1) % 1;
    for (let i = 0; i < 9; i++) {
      const tx = -34 + i * 8.6 + (rndT(i * 3.1) - 0.5) * 3;
      if (Math.abs(tx) < 7 || Math.abs(Math.abs(tx) - 36.5) < 4.5 || Math.abs(tx) > 29.0) continue;
      const r = rndT(i * 5.7);
      const tz = 44 + r * 8;
      circles.push({ x: tx, z: tz, r: 0.45 });
    }

    return {
      boxes,
      obbs,
      circles,
      minX: -29.2,
      maxX: 29.2,
      minZ: 0.72,
      maxZ: 54.0,
      curvedCounter: { cx: 0, cz: -2.5, rIn: 8.05, rOut: 9.14, halfAngle: 0.405 },
    };
  }

  if (lv === 4) {
    // Level 4 glass partitions & nearly-closed frameless door leaves [0.35..9.38] (corridor [9.40..10.30] is open)
    [-20, -10, 10].forEach((px) => {
      boxes.push({ minX: px - 0.1, maxX: px + 0.1, minZ: 0.35, maxZ: 9.38 });
    });
    // Strategy Room (cx = -25) credenza, table & easel
    addBox(boxes, -26.8, 0.85, 3.84, 0.58);
    addBox(boxes, -25.0, 4.7, 5.66, 1.96);
    addBox(boxes, -21.2, 1.8, 1.52, 0.22);
    circles.push({ x: -29.1, z: 7.6, r: 0.48 });

    // Board Room credenza & boat conference table
    addBox(boxes, 0, 0.62, 8.05, 0.54);
    boxes.push({ minX: -6.12, maxX: 6.12, minZ: 3.65, maxZ: 6.15 });
    // Executive Lounge espresso bar, stools, sofa, coffee table & armchairs
    boxes.push({ minX: -20.0, maxX: -15.18, minZ: 0.64, maxZ: 1.4 });
    [-18.8, -17.6, -16.4].forEach((sx) => circles.push({ x: sx, z: 2.1, r: 0.28 }));
    addBox(boxes, -12.6, 3.0, 2.86, 1.12);
    addBox(boxes, -12.6, 5.0, 1.74, 0.98);
    addObb(obbs, -14.3, 5.0, 1.28, 1.1, Math.PI / 2);
    addObb(obbs, -11.0, 5.0, 1.28, 1.1, -Math.PI / 2);
    circles.push(
      { x: -19.2, z: 8.6, r: 0.5 },
      { x: -10.8, z: 1.2, r: 0.42 }
    );
    // Board Secretary desk, armchairs, side table, shelf & plants
    addBox(boxes, 15, 3.4, 2.24, 1.24);
    addObb(obbs, 13.1, 6.6, 1.28, 1.1, Math.PI - 0.35);
    addObb(obbs, 16.9, 6.6, 1.28, 1.1, Math.PI + 0.35);
    circles.push(
      { x: 15, z: 6.7, r: 0.38 },
      { x: 19.1, z: 1.1, r: 0.44 },
      { x: 10.9, z: 8.9, r: 0.46 }
    );
    addBox(boxes, 19.0, 0.55, 1.32, 0.55);

    return { boxes, obbs, circles, minX: -29.2, maxX: 29.2, minZ: 0.32, maxZ: 10.3 };
  }

  if (lv === 5) {
    // Level 5 glass partitions & nearly-closed door leaves [0.35..9.38] (front atrium corridor [9.40..10.30] is open)
    [-20, -15, -10, -5, 0, 6].forEach((px) => {
      boxes.push({ minX: px - 0.1, maxX: px + 0.1, minZ: 0.35, maxZ: 9.38 });
    });
    // Executive Gallery (cx = -25) scale model plinth, chairs, shelf & table
    addBox(boxes, -25.0, 4.5, 3.74, 1.94);
    addObb(obbs, -21.8, 6.4, 1.28, 1.1, -Math.PI * 0.75);
    addObb(obbs, -28.2, 6.4, 1.28, 1.1, Math.PI * 0.75);
    addBox(boxes, -29.0, 1.8, 0.6, 1.44);
    circles.push({ x: -25.0, z: 7.2, r: 0.42 }, { x: -21.0, z: 1.4, r: 0.5 });

    // 4 HoD suites (desks, shelves, plants & visitor chairs; HoD chairs tracked dynamically)
    [-17.5, -12.5, -7.5, -2.5].forEach((cx) => {
      addBox(boxes, cx, 3.5, 2.24, 1.24);
      addBox(boxes, cx + 1.7, 0.55, 1.12, 0.55);
      circles.push(
        { x: cx - 0.8, z: 5.4, r: 0.33 },
        { x: cx + 0.8, z: 5.4, r: 0.33 },
        { x: cx - 1.9, z: 1.0, r: 0.38 }
      );
    });
    // Executive Assistant (x = 3)
    addBox(boxes, 3, 3.4, 2.24, 1.24);
    addObb(obbs, 1.1, 6.6, 1.28, 1.1, Math.PI - 0.35);
    addObb(obbs, 4.9, 6.6, 1.28, 1.1, Math.PI + 0.35);
    circles.push(
      { x: 3, z: 6.7, r: 0.38 },
      { x: 5.1, z: 1.1, r: 0.42 },
      { x: 0.9, z: 8.9, r: 0.46 }
    );
    // CEO suite (cx = 13)
    addBox(boxes, 13, 3.4, 3.44, 1.24);
    addBox(boxes, 7.7, 0.55, 1.32, 0.55);
    addBox(boxes, 19.0, 0.55, 1.32, 0.55);
    addBox(boxes, 17.8, 1.95, 2.86, 1.12);
    addBox(boxes, 17.8, 3.9, 1.74, 0.98);
    addObb(obbs, 16.0, 3.9, 1.28, 1.1, Math.PI / 2);
    addObb(obbs, 17.8, 5.8, 1.28, 1.1, Math.PI);
    circles.push(
      { x: 12.0, z: 5.5, r: 0.35 },
      { x: 14.0, z: 5.5, r: 0.35 },
      { x: 14.4, z: 3.05, r: 0.25 },
      { x: 11.6, z: 3.05, r: 0.25 },
      { x: 19.3, z: 3.9, r: 0.25 },
      { x: 9.6, z: 6.2, r: 0.48 },
      { x: 19.2, z: 8.6, r: 0.5 },
      { x: 7.0, z: 1.7, r: 0.25 },
      { x: 8.3, z: 1.7, r: 0.25 }
    );
    return { boxes, obbs, circles, minX: -29.2, maxX: 29.2, minZ: 0.72, maxZ: 10.3 };
  }

  // Levels 1..3 West Wing Rooms (cx = -25)
  boxes.push({ minX: -20.14, maxX: -19.96, minZ: 0.3, maxZ: 8.6 });
  if (lv === 1) {
    // HR Room
    boxes.push(
      { minX: -29.85, maxX: -24.5, minZ: 8.46, maxZ: 8.64 },
      { minX: -22.1, maxX: -20.05, minZ: 8.46, maxZ: 8.64 }
    );
    addBox(boxes, -26.9, 3.2, 2.16, 1.14);
    addBox(boxes, -23.0, 3.2, 2.16, 1.14);
    addBox(boxes, -29.2, 2.0, 0.64, 1.44);
    addObb(obbs, -23.75, 6.2, 1.24, 1.08, Math.PI / 2);
    addObb(obbs, -21.45, 6.2, 1.24, 1.08, -Math.PI / 2);
    circles.push({ x: -22.6, z: 6.2, r: 0.88 }, { x: -29.1, z: 6.8, r: 0.48 }, { x: -20.8, z: 1.2, r: 0.42 });
  } else if (lv === 2) {
    // Relax Room
    boxes.push(
      { minX: -29.85, maxX: -24.6, minZ: 8.46, maxZ: 8.64 },
      { minX: -22.2, maxX: -20.05, minZ: 8.46, maxZ: 8.64 }
    );
    addBox(boxes, -26.8, 2.2, 2.86, 1.12);
    addBox(boxes, -26.8, 5.4, 2.86, 1.12);
    addBox(boxes, -26.8, 3.8, 1.54, 0.94);
    addBox(boxes, -22.3, 4.2, 1.6, 2.78);
    addBox(boxes, -29.2, 6.8, 0.76, 2.52);
    addBox(boxes, -29.2, 5.1, 0.64, 0.68);
    circles.push(
      { x: -28.3, z: 6.3, r: 0.28 },
      { x: -28.3, z: 7.3, r: 0.28 },
      { x: -29.1, z: 2.0, r: 0.32 },
      { x: -20.8, z: 1.2, r: 0.46 }
    );
  } else if (lv === 3) {
    // Gym Room
    boxes.push(
      { minX: -29.85, maxX: -24.5, minZ: 8.46, maxZ: 8.64 },
      { minX: -22.2, maxX: -20.05, minZ: 8.46, maxZ: 8.64 }
    );
    addBox(boxes, -28.2, 2.5, 0.9, 1.96);
    addBox(boxes, -26.3, 2.5, 0.9, 1.96);
    addBox(boxes, -28.0, 5.7, 0.58, 1.22);
    addBox(boxes, -26.2, 5.7, 0.58, 1.22);
    addBox(boxes, -22.6, 1.5, 2.24, 0.56);
    addBox(boxes, -23.2, 3.2, 0.48, 1.36);
    addBox(boxes, -29.25, 7.2, 0.64, 1.84);
    addBox(boxes, -29.2, 1.6, 0.46, 0.46);
  }

  return { boxes, obbs, circles, minX: -29.2, maxX: 29.2, minZ: 0.72, maxZ: 10.3 };
}

export function getFloorColliders(lv: number): FloorColliderSet {
  let set = FLOOR_CACHE.get(lv);
  if (!set) {
    set = buildCollidersForLevel(lv);
    FLOOR_CACHE.set(lv, set);
  }
  return set;
}

function pushOutObb(
  nx: number,
  nz: number,
  r: number,
  obb: { cx: number; cz: number; hx: number; hz: number; cos: number; sin: number }
): { x: number; z: number; hit: boolean } {
  const dx = nx - obb.cx;
  const dz = nz - obb.cz;
  const lx = dx * obb.cos - dz * obb.sin;
  const lz = dx * obb.sin + dz * obb.cos;
  const ex = obb.hx + r;
  const ez = obb.hz + r;
  if (lx > -ex && lx < ex && lz > -ez && lz < ez) {
    const dl = lx - -ex;
    const dr = ex - lx;
    const db = lz - -ez;
    const df = ez - lz;
    const m = Math.min(dl, dr, db, df);
    let nlx = lx;
    let nlz = lz;
    if (m === dl) nlx = -ex;
    else if (m === dr) nlx = ex;
    else if (m === db) nlz = -ez;
    else nlz = ez;
    return {
      x: obb.cx + nlx * obb.cos + nlz * obb.sin,
      z: obb.cz - nlx * obb.sin + nlz * obb.cos,
      hit: true,
    };
  }
  return { x: nx, z: nz, hit: false };
}

export function resolveObstaclePosition(
  lv: number,
  x: number,
  z: number,
  options?: ResolveObstacleOptions
): { x: number; z: number; blocked: boolean } {
  const col = options?.districtWalk && lv === 0 ? getDistrictWalkColliders() : getFloorColliders(lv);
  const baseR = options?.radius ?? CHAR_RADIUS;
  const behindEspressoBar = lv === 4 && x < -14.8 && z < 0.72;
  const r = behindEspressoBar ? Math.min(baseR, 0.15) : baseR;
  const minZFloor = lv === 4 && !behindEspressoBar ? 0.62 : col.minZ;
  const maxZFloor = lv === 0 && options?.pedestrianOnly ? 18.6 : col.maxZ;

  let nx = Math.max(col.minX, Math.min(col.maxX, x));
  let nz = Math.max(minZFloor, Math.min(maxZFloor, z));
  let blocked = nx !== x || nz !== z;

  // Pedestrians on upper floors must stay out of the East stairwell core hole [20.1..24.4] x [1.0..8.5]
  if (lv >= 0 && options?.pedestrianOnly && nx > 19.85 && nx < 24.65 && nz < 8.65) {
    nz = 8.65;
    blocked = true;
  }

  // Pedestrians on ground floor outside porch stairs (z > 14) stick to main stone entrance walkway
  if (lv === 0 && options?.pedestrianOnly && nz > 14.0) {
    const clampedX = Math.max(-3.6, Math.min(3.6, nx));
    if (clampedX !== nx) {
      nx = clampedX;
      blocked = true;
    }
  }

  const floorChairs =
    options?.districtWalk && lv === 0
      ? getAllGroundChairsForDistrictWalk()
      : CHAIR_COLLIDERS_BY_FLOOR.get(lv);

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < col.boxes.length; i++) {
      const b = col.boxes[i];
      if (b.liftDoorSide !== undefined && options?.allowLiftShaft && nz >= 9.2 && nz <= 10.8) {
        continue;
      }
      if (b.stairwellGate && options?.allowStairwell) {
        continue;
      }
      const exMinX = b.minX - r;
      const exMaxX = b.maxX + r;
      const exMinZ = b.minZ - r;
      const exMaxZ = b.maxZ + r;
      if (nx > exMinX && nx < exMaxX && nz > exMinZ && nz < exMaxZ) {
        const dLeft = nx - exMinX;
        const dRight = exMaxX - nx;
        const dBack = nz - exMinZ;
        const dFront = exMaxZ - nz;
        const m = Math.min(dLeft, dRight, dBack, dFront);
        if (m === dLeft) nx = exMinX;
        else if (m === dRight) nx = exMaxX;
        else if (m === dBack) nz = exMinZ;
        else nz = exMaxZ;
        blocked = true;
      }
    }

    for (let i = 0; i < col.obbs.length; i++) {
      const res = pushOutObb(nx, nz, r, col.obbs[i]);
      if (res.hit) {
        nx = res.x;
        nz = res.z;
        blocked = true;
      }
    }

    for (let i = 0; i < col.circles.length; i++) {
      const c = col.circles[i];
      const minD = c.r + r;
      const dx = nx - c.x;
      const dz = nz - c.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minD * minD) {
        const d = Math.sqrt(dSq);
        if (d > 0.0005) {
          nx = c.x + (dx / d) * minD;
          nz = c.z + (dz / d) * minD;
        } else {
          nz = c.z + minD;
        }
        blocked = true;
      }
    }

    if (floorChairs) {
      for (let i = 0; i < floorChairs.length; i++) {
        const ch = floorChairs[i];
        if (ch === options?.ignoreChair) continue;
        const minD = ch.r + r;
        const dx = nx - ch.curX;
        const dz = nz - ch.curZ;
        const dSq = dx * dx + dz * dz;
        if (dSq < minD * minD) {
          const d = Math.sqrt(dSq);
          if (d > 0.0005) {
            nx = ch.curX + (dx / d) * minD;
            nz = ch.curZ + (dz / d) * minD;
          } else {
            nz = ch.curZ + minD;
          }
          blocked = true;
        }
      }
    }

    if (col.curvedCounter) {
      const cc = col.curvedCounter;
      const dx = nx - cc.cx;
      const dz = nz - cc.cz;
      const dist = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz);
      const angPad = r / Math.max(1, dist);
      const maxAng = cc.halfAngle + angPad;
      const rInExp = cc.rIn - r;
      const rOutExp = cc.rOut + r;
      if (Math.abs(ang) <= maxAng && dist > rInExp && dist < rOutExp) {
        const dIn = dist - rInExp;
        const dOut = rOutExp - dist;
        const dAng = (maxAng - Math.abs(ang)) * dist;
        if (dAng < Math.min(dIn, dOut)) {
          const signA = ang >= 0 ? 1 : -1;
          const outAng = signA * maxAng;
          nx = cc.cx + Math.sin(outAng) * dist;
          nz = cc.cz + Math.cos(outAng) * dist;
        } else {
          const targetR = dIn < dOut ? rInExp : rOutExp;
          if (dist > 0.001) {
            nx = cc.cx + (dx / dist) * targetR;
            nz = cc.cz + (dz / dist) * targetR;
          }
        }
        blocked = true;
      }
    }

    if (options?.extraVehicles) {
      for (let i = 0; i < options.extraVehicles.length; i++) {
        const res = pushOutObb(nx, nz, r, options.extraVehicles[i]);
        if (res.hit) {
          nx = res.x;
          nz = res.z;
          blocked = true;
        }
      }
    }
  }

  nx = Math.max(col.minX, Math.min(col.maxX, nx));
  nz = Math.max(minZFloor, Math.min(maxZFloor, nz));
  if (lv === 0 && options?.pedestrianOnly && nz > 14.0) {
    nx = Math.max(-3.6, Math.min(3.6, nx));
  }
  return { x: nx, z: nz, blocked };
}

export function hasLineOfSight(
  lv: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  options?: ResolveObstacleOptions
): boolean {
  const dist = Math.hypot(x1 - x0, z1 - z0);
  if (dist < 0.04) return true;
  const steps = Math.ceil(dist / 0.08);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + (x1 - x0) * t;
    const pz = z0 + (z1 - z0) * t;
    const res = resolveObstaclePosition(lv, px, pz, options);
    if (res.blocked) return false;
  }
  return true;
}

/**
 * Side-aisle dock point next to a seated chair or behind a counter.
 * Characters step to the open side beside the chair (while the chair swivels & pulls back cleanly)
 * rather than walking through chair backrests.
 */
export function getChairDockPoint(
  lv: number,
  homeX: number,
  homeZ: number,
  swivelDir = 1
): { x: number; z: number } | null {
  if (lv === -2 && Math.abs(homeZ - 6.42) < 0.35 && homeX > 2.8 && homeX < 6.2) {
    const dir = homeX < 4.5 ? -1 : 1;
    return { x: homeX + dir * 0.62, z: 6.52 };
  }
  if (lv === 0 && homeX < -23 && homeZ >= 4.2 && homeZ <= 4.9) {
    const dir = homeX < -25 ? -1 : 1;
    return { x: homeX + dir * 0.62, z: 4.85 };
  }
  if (lv === 1 && homeX < -20) {
    if (homeZ < 2.8) {
      const dir = swivelDir >= 0 ? 1 : -1;
      return { x: homeX + dir * 0.62, z: 2.15 };
    }
    if (homeZ >= 4.9 && homeZ <= 5.4) {
      return { x: homeX, z: 4.9 };
    }
    if (homeZ >= 7.0 && homeZ <= 7.5) {
      return { x: homeX, z: 7.55 };
    }
  }
  if (lv === 0 && Math.abs(homeX) < 3.7 && homeZ < 5.7) {
    return { x: homeX < 0 ? -4.3 : 4.3, z: 4.4 };
  }
  if (lv >= 0 && lv <= 3 && homeX > -20 && homeZ >= 4.5 && homeZ <= 5.1) {
    // Bay chair facing -Z: open space beside chair at z = 4.96, side offset = +/-0.58m
    // Outer seats step inward if near pedestals; center seat uses swivelDir
    const relX = ((homeX % 10) + 15) % 10 - 5;
    const dir = Math.abs(relX) > 1.5 ? (relX < 0 ? 1 : -1) : swivelDir >= 0 ? 1 : -1;
    return { x: homeX + dir * 0.58, z: 4.96 };
  }
  if (lv === 4) {
    if (homeX < -20) {
      const dir = swivelDir >= 0 ? 1 : -1;
      if (homeZ <= 3.6) return { x: homeX + dir * 0.62, z: 2.66 };
      return { x: homeX + dir * 0.62, z: 6.72 };
    }
    if (homeX < -14.8 && homeZ < 0.75) {
      return { x: -14.55, z: 0.48 };
    }
    if (Math.abs(homeX) <= 6.2 && homeZ >= 3.0 && homeZ <= 3.6) {
      const dir = swivelDir >= 0 ? 1 : -1;
      return { x: homeX + dir * 0.62, z: 2.56 };
    }
    if (Math.abs(homeX) <= 6.2 && homeZ >= 6.2 && homeZ <= 6.8) {
      const dir = swivelDir >= 0 ? 1 : -1;
      return { x: homeX + dir * 0.62, z: 7.22 };
    }
    if (Math.abs(homeX) >= 6.3 && Math.abs(homeX) <= 7.0 && Math.abs(homeZ - 4.9) < 0.5) {
      return { x: homeX < 0 ? -7.2 : 7.2, z: 4.28 };
    }
    if (homeX > 13.5 && homeX < 16.5 && homeZ < 3.0) {
      const dir = swivelDir >= 0 ? 1 : -1;
      return { x: homeX + dir * 0.62, z: 2.36 };
    }
  }
  if (lv === 5 && homeZ >= 2.2 && homeZ <= 3.0) {
    const dir = homeX < -1 ? 1 : swivelDir >= 0 ? 1 : -1;
    return { x: homeX + dir * 0.62, z: 2.38 };
  }
  return null;
}

/* =========================================================
   2D A* GRID PATHFINDER WITH STRING-PULLING SMOOTHING
   ========================================================= */
const GRID_CELL = 0.25;

interface StaticFloorGrid {
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  blocked: Uint8Array;
}

const STATIC_GRIDS = new Map<number, StaticFloorGrid>();
const DISTRICT_STATIC_GRIDS = new Map<string, StaticFloorGrid>();
const A_CLOSED = new Uint32Array(65536);
const A_GSCORE = new Float32Array(65536);
const A_PARENT = new Int32Array(65536);
const A_INHEAP = new Uint32Array(65536);
let aStarRunId = 1;

// Min-heap for A* open set (zero per-call allocation)
const HEAP_NODE = new Int32Array(65536);
const HEAP_F = new Float32Array(65536);
let heapLen = 0;

function heapPush(node: number, f: number) {
  let i = heapLen++;
  HEAP_NODE[i] = node;
  HEAP_F[i] = f;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (HEAP_F[p] <= f) break;
    HEAP_NODE[i] = HEAP_NODE[p];
    HEAP_F[i] = HEAP_F[p];
    i = p;
  }
  HEAP_NODE[i] = node;
  HEAP_F[i] = f;
}

function heapPop(): number {
  const top = HEAP_NODE[0];
  heapLen--;
  if (heapLen > 0) {
    const node = HEAP_NODE[heapLen];
    const f = HEAP_F[heapLen];
    let i = 0;
    const half = heapLen >> 1;
    while (i < half) {
      let c = (i << 1) + 1;
      if (c + 1 < heapLen && HEAP_F[c + 1] < HEAP_F[c]) c++;
      if (f <= HEAP_F[c]) break;
      HEAP_NODE[i] = HEAP_NODE[c];
      HEAP_F[i] = HEAP_F[c];
      i = c;
    }
    HEAP_NODE[i] = node;
    HEAP_F[i] = f;
  }
  return top;
}

function getStaticFloorGrid(lv: number): StaticFloorGrid {
  let g = STATIC_GRIDS.get(lv);
  if (g) return g;

  const col = getFloorColliders(lv);
  const minX = col.minX;
  const maxX = col.maxX;
  const minZ = lv === 4 ? 0.32 : col.minZ;
  const maxZ = lv === 0 ? 18.75 : col.maxZ;
  const cols = Math.ceil((maxX - minX) / GRID_CELL);
  const rows = Math.ceil((maxZ - minZ) / GRID_CELL);
  const blocked = new Uint8Array(cols * rows);

  // Temporarily sample WITHOUT dynamic chairs so static wall/furniture grid caches cleanly
  const savedChairs = CHAIR_COLLIDERS_BY_FLOOR.get(lv);
  if (savedChairs) CHAIR_COLLIDERS_BY_FLOOR.delete(lv);

  for (let r = 0; r < rows; r++) {
    const wz = minZ + (r + 0.5) * GRID_CELL;
    for (let c = 0; c < cols; c++) {
      const wx = minX + (c + 0.5) * GRID_CELL;
      const res = resolveObstaclePosition(lv, wx, wz, {
        pedestrianOnly: true,
        radius: lv === 4 && wx < -14.8 && wz < 0.72 ? 0.14 : CHAR_RADIUS,
      });
      blocked[r * cols + c] = res.blocked ? 1 : 0;
    }
  }

  if (savedChairs) CHAIR_COLLIDERS_BY_FLOOR.set(lv, savedChairs);

  g = { minX, minZ, cols, rows, blocked };
  STATIC_GRIDS.set(lv, g);
  return g;
}

function isCellPassable(
  lv: number,
  grid: StaticFloorGrid,
  c: number,
  r: number,
  ignoreChair?: TrackedChairCollider
): boolean {
  if (c < 0 || c >= grid.cols || r < 0 || r >= grid.rows) return false;
  if (grid.blocked[r * grid.cols + c]) return false;

  const chairs = CHAIR_COLLIDERS_BY_FLOOR.get(lv);
  if (chairs && chairs.length > 0) {
    const wx = grid.minX + (c + 0.5) * GRID_CELL;
    const wz = grid.minZ + (r + 0.5) * GRID_CELL;
    for (let i = 0; i < chairs.length; i++) {
      const ch = chairs[i];
      if (ch === ignoreChair) continue;
      const minD = ch.r + CHAR_RADIUS;
      const dx = wx - ch.curX;
      const dz = wz - ch.curZ;
      if (dx * dx + dz * dz < minD * minD) return false;
    }
  }
  return true;
}

function findNearestPassableCell(
  lv: number,
  grid: StaticFloorGrid,
  wx: number,
  wz: number,
  ignoreChair?: TrackedChairCollider
): { c: number; r: number } | null {
  const c0 = Math.max(0, Math.min(grid.cols - 1, Math.floor((wx - grid.minX) / GRID_CELL)));
  const r0 = Math.max(0, Math.min(grid.rows - 1, Math.floor((wz - grid.minZ) / GRID_CELL)));
  if (isCellPassable(lv, grid, c0, r0, ignoreChair)) return { c: c0, r: r0 };

  let bestC = -1;
  let bestR = -1;
  let bestDist = Infinity;
  for (let rad = 1; rad <= 8; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
        const nc = c0 + dc;
        const nr = r0 + dr;
        if (!isCellPassable(lv, grid, nc, nr, ignoreChair)) continue;
        const cx = grid.minX + (nc + 0.5) * GRID_CELL;
        const cz = grid.minZ + (nr + 0.5) * GRID_CELL;
        const d = Math.hypot(cx - wx, cz - wz);
        if (d < bestDist) {
          bestDist = d;
          bestC = nc;
          bestR = nr;
        }
      }
    }
    if (bestC >= 0) return { c: bestC, r: bestR };
  }
  return null;
}

const NEIGHBORS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

export function buildObstacleAwarePath(
  lv: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  options?: { ignoreChair?: TrackedChairCollider }
): Array<{ x: number; z: number }> {
  const safeDest = resolveObstaclePosition(lv, toX, toZ, {
    ignoreChair: options?.ignoreChair,
    pedestrianOnly: true,
  });
  const dx = safeDest.x;
  const dz = safeDest.z;

  if (Math.hypot(dx - fromX, dz - fromZ) < 0.08) {
    return [{ x: dx, z: dz }];
  }

  const losOpts: ResolveObstacleOptions = {
    ignoreChair: options?.ignoreChair,
    pedestrianOnly: true,
  };
  if (hasLineOfSight(lv, fromX, fromZ, dx, dz, losOpts)) {
    return [{ x: dx, z: dz }];
  }

  const grid = getStaticFloorGrid(lv);
  const start = findNearestPassableCell(lv, grid, fromX, fromZ, options?.ignoreChair);
  const goal = findNearestPassableCell(lv, grid, dx, dz, options?.ignoreChair);
  if (!start || !goal) {
    return [{ x: dx, z: dz }];
  }

  const startIdx = start.r * grid.cols + start.c;
  const goalIdx = goal.r * grid.cols + goal.c;
  const runId = ++aStarRunId;
  heapLen = 0;

  A_GSCORE[startIdx] = 0;
  A_PARENT[startIdx] = -1;
  A_INHEAP[startIdx] = runId;
  heapPush(startIdx, Math.hypot(goal.c - start.c, goal.r - start.r));

  let found = false;
  while (heapLen > 0) {
    const cur = heapPop();
    if (cur === goalIdx) {
      found = true;
      break;
    }
    if (A_CLOSED[cur] === runId) continue;
    A_CLOSED[cur] = runId;

    const cc = cur % grid.cols;
    const cr = (cur / grid.cols) | 0;
    const gCur = A_GSCORE[cur];

    for (let k = 0; k < 8; k++) {
      const [dc, dr, cost] = NEIGHBORS[k];
      const nc = cc + dc;
      const nr = cr + dr;
      if (!isCellPassable(lv, grid, nc, nr, options?.ignoreChair)) continue;
      // Prevent diagonal corner clipping
      if (dc !== 0 && dr !== 0) {
        if (
          !isCellPassable(lv, grid, cc + dc, cr, options?.ignoreChair) ||
          !isCellPassable(lv, grid, cc, cr + dr, options?.ignoreChair)
        ) {
          continue;
        }
      }
      const nIdx = nr * grid.cols + nc;
      if (A_CLOSED[nIdx] === runId) continue;
      const candG = gCur + cost;
      if (A_INHEAP[nIdx] !== runId || candG < A_GSCORE[nIdx]) {
        A_GSCORE[nIdx] = candG;
        A_PARENT[nIdx] = cur;
        A_INHEAP[nIdx] = runId;
        const h = Math.hypot(goal.c - nc, goal.r - nr);
        heapPush(nIdx, candG + h * 1.001);
      }
    }
  }

  if (!found) {
    return [{ x: dx, z: dz }];
  }

  // Reconstruct cell centers
  const raw: Array<{ x: number; z: number }> = [];
  let trace = goalIdx;
  while (trace !== -1 && trace !== startIdx) {
    const tc = trace % grid.cols;
    const tr = (trace / grid.cols) | 0;
    raw.push({
      x: grid.minX + (tc + 0.5) * GRID_CELL,
      z: grid.minZ + (tr + 0.5) * GRID_CELL,
    });
    trace = A_PARENT[trace];
  }
  raw.reverse();
  if (raw.length > 0) {
    raw[raw.length - 1] = { x: dx, z: dz };
  } else {
    raw.push({ x: dx, z: dz });
  }

  // String-pull smoothing via 0.08m-stepped LOS checks
  const smoothed: Array<{ x: number; z: number }> = [];
  let anchorX = fromX;
  let anchorZ = fromZ;
  let i = 0;
  while (i < raw.length) {
    let farthest = i;
    for (let j = raw.length - 1; j > i; j--) {
      if (hasLineOfSight(lv, anchorX, anchorZ, raw[j].x, raw[j].z, losOpts)) {
        farthest = j;
        break;
      }
    }
    const chosen = raw[farthest];
    smoothed.push(chosen);
    anchorX = chosen.x;
    anchorZ = chosen.z;
    i = farthest + 1;
  }

  return smoothed;
}

/* =========================================================
   DISTRICT NICHE BUILDINGS COLLIDERS & PATHFINDING
   ========================================================= */
const DIST_WALL_THICK = 0.22;
const DIST_DOOR_HALF_W = 1.65;

function populateDistrictBuildingGeometry(
  spec: DistrictBuildingSpec,
  lv: number,
  boxes: BoxObstacle[],
  obbs: ObbObstacle[],
  circles: CircleObstacle[]
) {
  const hw = spec.w * 0.5;
  const hd = spec.d * 0.5;
  const backZ = spec.doorSide === 'south' ? spec.cz - hd + DIST_WALL_THICK * 0.5 : spec.cz + hd - DIST_WALL_THICK * 0.5;
  const frontZ = spec.doorSide === 'south' ? spec.cz + hd - DIST_WALL_THICK * 0.5 : spec.cz - hd + DIST_WALL_THICK * 0.5;

  // Back wall
  addBox(boxes, spec.cx, backZ, spec.w, DIST_WALL_THICK + 0.08);
  // Side walls
  [-1, 1].forEach((side) => {
    const wx = spec.cx + side * (hw - DIST_WALL_THICK * 0.5);
    addBox(boxes, wx, spec.cz, DIST_WALL_THICK + 0.08, spec.d);
  });

  // Front facade wall: open 3.3m doorway on lv === 0, solid wall above
  if (lv === 0) {
    const leftSpan = spec.doorX - DIST_DOOR_HALF_W - (spec.cx - hw);
    const rightSpan = spec.cx + hw - (spec.doorX + DIST_DOOR_HALF_W);
    if (leftSpan > 0.3) {
      addBox(boxes, spec.cx - hw + leftSpan * 0.5, frontZ, leftSpan, DIST_WALL_THICK + 0.08);
    }
    if (rightSpan > 0.3) {
      addBox(boxes, spec.doorX + DIST_DOOR_HALF_W + rightSpan * 0.5, frontZ, rightSpan, DIST_WALL_THICK + 0.08);
    }
    // Door jambs + swung-out door leaves
    const dirZ = spec.doorSide === 'south' ? 1 : -1;
    [-1, 1].forEach((s) => {
      addBox(boxes, spec.doorX + s * (DIST_DOOR_HALF_W + 0.05), frontZ, 0.16, 0.28);
      addBox(boxes, spec.doorX + s * DIST_DOOR_HALF_W, frontZ + dirZ * 0.58, 0.08, 1.15);
    });
  } else {
    addBox(boxes, spec.cx, frontZ, spec.w, DIST_WALL_THICK + 0.08);
  }

  if (lv === 0) {
    if (spec.id === 'restaurant') {
      // Wood-fired copper pizza hearth
      circles.push({ x: spec.cx - 8.0, z: spec.cz - 7.0, r: 1.38 });
      // Kitchen pass counter
      addBox(boxes, spec.cx - 1.4, spec.cz - 6.4, 7.04, 1.32);
      // Espresso & cocktail bar + 3 bar stools
      addBox(boxes, spec.cx + 7.8, spec.cz - 2.2, 1.38, 6.4);
      [-4.0, -2.2, -0.4].forEach((bz) => circles.push({ x: spec.cx + 6.75, z: spec.cz + bz, r: 0.24 }));
      // 4 indoor dining tables
      circles.push(
        { x: spec.cx - 3.6, z: spec.cz - 1.6, r: 0.72 },
        { x: spec.cx + 2.2, z: spec.cz - 1.6, r: 0.72 },
        { x: spec.cx - 3.6, z: spec.cz + 3.2, r: 0.72 },
        { x: spec.cx + 2.2, z: spec.cz + 3.2, r: 0.72 },
        { x: spec.cx + 8.6, z: spec.cz + 7.4, r: 0.45 }
      );
      // Host desk
      addBox(boxes, spec.cx + 4.8, spec.cz + 6.4, 1.54, 0.9);
      // Outdoor terrace bistro tables
      circles.push(
        { x: spec.cx - 5.2, z: spec.cz + 12.1, r: 0.58 },
        { x: spec.cx + 5.2, z: spec.cz + 12.1, r: 0.58 }
      );
    } else if (spec.id === 'dealership') {
      // Exterior automotive porte-cochere columns
      circles.push(
        { x: spec.doorX - 4.8, z: spec.doorZ + 2.45, r: 0.24 },
        { x: spec.doorX + 4.8, z: spec.doorZ + 2.45, r: 0.24 }
      );
      // Center rotating turntable
      circles.push({ x: spec.cx, z: spec.cz + 0.4, r: 3.22 });
      // Flanking display vehicles on floating basalt plinths
      addObb(obbs, spec.cx - 5.9, spec.cz + 1.6, 2.05, 4.5, 0.4);
      addObb(obbs, spec.cx + 4.9, spec.cz + 1.0, 2.05, 4.15, -0.35);
      // 2 sculpted travertine & carbon advisory desks
      addBox(boxes, spec.cx - 6.0, spec.cz - 5.6, 2.45, 1.12);
      addBox(boxes, spec.cx + 4.2, spec.cz - 5.6, 2.45, 1.12);
      // SW Espresso hospitality lounge & barista pedestal
      circles.push(
        { x: spec.cx - 7.4, z: spec.cz + 6.3, r: 0.62 },
        { x: spec.cx - 8.55, z: spec.cz + 6.3, r: 0.56 },
        { x: spec.cx - 7.4, z: spec.cz + 7.45, r: 0.56 }
      );
      addBox(boxes, spec.cx - 8.75, spec.cz + 7.75, 0.85, 0.62);
      // SE 350 kW EV Ultra-Fast Hyper-Charger totem
      addObb(obbs, spec.cx + 5.6, spec.cz + 6.6, 1.1, 0.8, -0.35);
      // East under-stair glass gallery screen & stairwell foot NPC gate
      addBox(boxes, spec.cx + 7.82, spec.cz - 2.16, 0.14, 13.24);
      addBox(boxes, spec.cx + 8.77, spec.cz + 4.6, 1.85, 0.24, undefined, true);
    } else if (spec.id === 'bank') {
      // 4 exterior portico columns
      [-3.8, -1.9, 1.9, 3.8].forEach((ox) => {
        circles.push({ x: spec.doorX + ox, z: spec.doorZ + 1.4, r: 0.44 });
      });
      // Monumental interior fluted limestone columns framing Banking Hall & Rotunda
      [
        [-3.8, -0.8],
        [7.6, -1.6],
        [7.6, 5.4],
      ].forEach(([cx, cz]) => circles.push({ x: spec.cx + cx, z: spec.cz + cz, r: 0.36 }));
      // SW 24/7 Biometric ATM screen & 3 kiosks
      addBox(boxes, spec.cx - 3.3, spec.cz + 7.2, 0.2, 2.06);
      [-8.8, -6.8, -4.8].forEach((ox) => {
        addBox(boxes, spec.cx + ox, spec.cz + 7.4, 0.96, 0.92);
      });
      // North-Center Teller Counter (front -4.8 + rear work-deck -5.6) & queue stanchions
      addBox(boxes, spec.cx - 0.3, spec.cz - 5.2, 8.9, 1.8);
      addBox(boxes, spec.cx - 1.8, spec.cz - 2.7, 0.22, 1.75);
      addBox(boxes, spec.cx + 1.2, spec.cz - 2.7, 0.22, 1.75);
      // NE Geared Biometric Vault Portal, flanking iris pedestals & bullion showcase
      addBox(boxes, spec.cx + 7.2, spec.cz - 9.0, 4.46, 1.1);
      circles.push(
        { x: spec.cx + 5.35, z: spec.cz - 8.35, r: 0.28 },
        { x: spec.cx + 9.05, z: spec.cz - 8.35, r: 0.28 },
        { x: spec.cx + 9.1, z: spec.cz - 5.4, r: 0.56 }
      );
      // SE Savanna-Teal Banquette + Limestone Table + Specimen Planters
      addBox(boxes, spec.cx + 8.9, spec.cz + 6.2, 1.12, 3.06);
      circles.push(
        { x: spec.cx + 7.2, z: spec.cz + 6.2, r: 0.54 },
        { x: spec.cx - 9.4, z: spec.cz - 8.4, r: 0.45 },
        { x: spec.cx - 9.4, z: spec.cz + 3.0, r: 0.45 },
        { x: spec.cx + 2.0, z: spec.cz + 6.8, r: 0.45 },
        { x: spec.cx - 4.2, z: spec.cz + 1.2, r: 0.45 }
      );
    } else if (spec.id === 'crypto') {
      // Exterior cyber porte-cochere columns
      circles.push(
        { x: spec.doorX - 4.6, z: spec.doorZ + 2.25, r: 0.24 },
        { x: spec.doorX + 4.6, z: spec.doorZ + 2.25, r: 0.24 }
      );
      // Cold-storage MPC vault pod (cx, cz - 5.1)
      addBox(boxes, spec.cx, spec.cz - 5.1, 4.48, 3.48);
      // Two biometric check-in kiosks flanking south medallion
      addBox(boxes, spec.cx - 4.0, spec.cz + 6.4, 0.96, 0.66);
      addBox(boxes, spec.cx + 4.0, spec.cz + 6.4, 0.96, 0.66);
      // 4 quant trading & custody pods
      [
        [spec.cx - 6.8, spec.cz + 1.8],
        [spec.cx + 6.4, spec.cz + 2.6],
        [spec.cx - 6.8, spec.cz - 3.6],
        [spec.cx - 6.8, spec.cz + 6.4],
      ].forEach(([px, pz]) => addBox(boxes, px, pz, 2.64, 1.14));
      // NE Quarter-Turn Stair & 5-story Merkle Genesis pit ground screening + stair mouth NPC gate
      addBox(boxes, spec.cx + 3.82, spec.cz - 6.02, 0.14, 7.18);
      addBox(boxes, spec.cx + 6.12, spec.cz - 2.45, 4.6, 0.14);
      addBox(boxes, spec.cx + 9.5, spec.cz - 2.45, 2.1, 0.24, undefined, true);
      addBox(boxes, spec.cx + 8.38, spec.cz - 4.85, 0.12, 4.8);
      addBox(boxes, spec.cx + 6.42, spec.cz - 7.2, 4.0, 0.12);
      circles.push(
        { x: spec.cx - 9.6, z: spec.cz - 8.4, r: 0.45 },
        { x: spec.cx + 9.4, z: spec.cz + 7.8, r: 0.45 }
      );
    } else if (spec.id === 'travel') {
      // North compass-rose medallion globe plinth
      circles.push({ x: spec.cx, z: spec.cz - 2.2, r: 1.12 });
      // Aerodynamic curved-end ticketing & visa concierge island + rear luggage credenza
      addBox(boxes, spec.cx - 7.7, spec.cz + 3.16, 8.9, 1.38);
      addBox(boxes, spec.cx - 7.7, spec.cz + 7.9, 6.26, 0.72);
      // 3 NW self-check-in kiosks
      circles.push(
        { x: spec.cx - 11.4, z: spec.cz - 5.2, r: 0.42 },
        { x: spec.cx - 9.5, z: spec.cz - 5.9, r: 0.42 },
        { x: spec.cx - 7.6, z: spec.cz - 6.3, r: 0.42 }
      );
      // East Wing: Executive Jet Scale Model pylon, charter sofas, coffee table & plants
      circles.push(
        { x: spec.cx + 6.4, z: spec.cz - 4.8, r: 1.28 },
        { x: spec.cx + 6.2, z: spec.cz + 0.8, r: 0.54 },
        { x: spec.cx + 8.6, z: spec.cz - 6.8, r: 0.46 },
        { x: spec.cx + 8.6, z: spec.cz + 6.9, r: 0.46 }
      );
      addBox(boxes, spec.cx + 6.2, spec.cz + 2.2, 2.55, 0.96);
      addBox(boxes, spec.cx + 6.2, spec.cz - 0.6, 2.55, 0.96);
      // South cabin-window fuselage feature panels framing departures board
      addBox(boxes, spec.cx - 8.6, spec.cz + 8.32, 5.24, 0.24);
      addBox(boxes, spec.cx + 6.4, spec.cz + 8.32, 4.44, 0.24);
    } else if (spec.id === 'tourism') {
      // Monumental 3D Topographical Kenya & Mt. Kenya Relief Table
      addBox(boxes, spec.cx - 5.2, spec.cz - 1.2, 4.86, 2.86);
      // Basalt 4x4 Expedition Cruiser plinth
      circles.push({ x: spec.cx + 6.4, z: spec.cz - 2.8, r: 2.95 });
      // West Bush Camp Lounge, Bronze Giraffe Sculpture, Terracotta Urns & SE Olive Plant
      addBox(boxes, spec.cx - 12.6, spec.cz + 1.8, 0.96, 2.1);
      circles.push(
        { x: spec.cx - 11.8, z: spec.cz - 4.8, r: 0.68 },
        { x: spec.cx - 11.2, z: spec.cz + 1.8, r: 0.58 },
        { x: spec.cx - 10.2, z: spec.cz + 0.8, r: 0.46 },
        { x: spec.cx - 10.2, z: spec.cz + 2.8, r: 0.46 },
        { x: spec.cx - 13.6, z: spec.cz - 6.8, r: 0.36 },
        { x: spec.cx - 13.6, z: spec.cz + 7.0, r: 0.36 },
        { x: spec.cx + 8.6, z: spec.cz + 6.8, r: 0.46 }
      );
      // 3 South Acacia Safari Concierge Desks
      [-5.2, -0.8, 3.6].forEach((ox) => {
        addBox(boxes, spec.cx + ox, spec.cz + 5.2, 2.58, 1.08);
      });
    } else if (spec.id === 'medical') {
      // Exterior ambulance / patient drop-off porte-cochere columns
      circles.push(
        { x: spec.doorX - 5.8, z: spec.doorZ + 2.95, r: 0.26 },
        { x: spec.doorX + 5.8, z: spec.doorZ + 2.95, r: 0.26 }
      );
      // Pharmacy counter, backlit medicine racks, 2-8C vaccine fridge & automated Rx kiosk
      addBox(boxes, spec.cx - 14.5, spec.cz - 2.2, 10.4, 1.3);
      addBox(boxes, spec.cx - 14.5, spec.cz - 7.1, 10.45, 0.56);
      addBox(boxes, spec.cx - 21.4, spec.cz - 6.85, 1.76, 0.98);
      addBox(boxes, spec.cx - 6.2, spec.cz - 6.95, 1.7, 0.74);
      // West Phlebotomy frosted partition & donor recliner pod
      addBox(boxes, spec.cx - 18.2, spec.cz + 3.6, 0.24, 3.68);
      addBox(boxes, spec.cx - 21.0, spec.cz + 3.6, 1.54, 1.82);
      // Central triage desk
      addBox(boxes, spec.cx, spec.cz - 1.2, 4.65, 1.14);
      // East consult partition, 2 consult desks, exam plinths & self-check vitals kiosk
      addBox(boxes, spec.cx + 16.35, spec.cz - 4.4, 0.22, 4.48);
      addBox(boxes, spec.cx + 13.2, spec.cz - 2.6, 2.44, 1.08);
      addBox(boxes, spec.cx + 19.5, spec.cz - 2.6, 2.44, 1.08);
      addBox(boxes, spec.cx + 13.2, spec.cz - 6.45, 1.98, 0.86);
      addBox(boxes, spec.cx + 19.5, spec.cz - 6.45, 1.98, 0.86);
      addBox(boxes, spec.cx + 16.4, spec.cz + 4.5, 2.64, 1.64);
      // 2 waiting armchairs, side tables & corner plants
      addBox(boxes, spec.cx - 6.5, spec.cz + 3.2, 1.18, 1.18);
      addBox(boxes, spec.cx + 6.5, spec.cz + 3.2, 1.18, 1.18);
      circles.push(
        { x: spec.cx - 7.65, z: spec.cz + 3.2, r: 0.42 },
        { x: spec.cx + 7.65, z: spec.cz + 3.2, r: 0.42 },
        { x: spec.cx + 21.8, z: spec.cz + 5.8, r: 0.48 },
        { x: spec.cx - 22.0, z: spec.cz + 6.0, r: 0.48 }
      );
    } else if (spec.id === 'logistics') {
      // Parcel sorting conveyor belt
      addBox(boxes, spec.cx - 4.2, spec.cz + 0.8, 1.65, 9.6);
      // NW heavy pallet storage racks (strictly North of SW stairwell core)
      addBox(boxes, spec.cx - 12.2, spec.cz - 4.8, 2.8, 3.6);
      addBox(boxes, spec.cx - 12.2, spec.cz - 0.6, 2.8, 3.6);
      // Electric cargo forklift staged near NE dock lane
      addBox(boxes, spec.cx + 9.8, spec.cz - 5.2, 1.4, 2.2);
      // 3-Station Dispatch & Customs counter
      addBox(boxes, spec.cx + 5.8, spec.cz + 2.5, 7.8, 1.32);
      // East loading bay interior staging pallets
      addBox(boxes, spec.cx + 12.6, spec.cz - 3.5, 1.6, 1.7);
      addBox(boxes, spec.cx + 12.6, spec.cz + 3.5, 1.6, 1.7);
    } else if (spec.id === 'realestate') {
      // Outdoor West construction & material staging yard
      addBox(boxes, spec.cx - 16.2, spec.cz, 3.6, 7.4);

      // North exterior entrance canopy columns
      circles.push(
        { x: spec.doorX - 5.6, z: spec.doorZ - 2.45, r: 0.24 },
        { x: spec.doorX + 5.6, z: spec.doorZ - 2.45, r: 0.24 }
      );
      // Four interior/storefront cylindrical corner columns
      [-1, 1].forEach((side) => {
        circles.push(
          { x: spec.cx + side * 12.52, z: spec.cz - 8.47, r: 0.36 },
          { x: spec.cx + side * 12.52, z: spec.cz + 8.53, r: 0.32 }
        );
      });

      // NW corner lounge: 4 cognac leather armchairs + marble coffee table + corner plants
      circles.push(
        { x: spec.cx - 9.8, z: spec.cz - 6.7, r: 1.62 },
        { x: spec.cx - 11.8, z: spec.cz - 7.8, r: 0.45 },
        { x: spec.cx - 8.65, z: spec.cz - 2.15, r: 0.42 }
      );

      // Giant vertical LED property showcase screen along west entrance glass
      addBox(boxes, spec.cx - 12.25, spec.cz - 3.6, 0.28, 4.16);

      // Curved crescent marble reception counter (arc around recCx/recCz leaving SW chair bay open)
      const recCx = spec.cx - 5.1;
      const recCz = spec.cz - 4.8;
      [-0.24, -0.05, 0.14, 0.33, 0.52, 0.69].forEach((angFrac) => {
        const a = angFrac * Math.PI;
        circles.push({
          x: recCx + Math.cos(a) * 1.67,
          z: recCz - Math.sin(a) * 1.67,
          r: 0.38,
        });
      });
      // Inner receptionist desk
      addBox(boxes, recCx + 0.15, recCz - 0.18, 1.56, 0.66);

      // Illuminated 3D masterplan scale-model vitrine
      addBox(boxes, spec.cx - 0.25, spec.cz - 1.45, 3.45, 2.15);

      // Sage-green client consultation booth (mustard + teal sofas, table, credenza/kiosk, plant)
      addBox(boxes, spec.cx - 5.95, spec.cz + 2.2, 4.35, 0.22);
      addBox(boxes, spec.cx - 7.4, spec.cz + 0.55, 0.9, 2.05);
      addBox(boxes, spec.cx - 4.5, spec.cz + 0.55, 0.9, 2.05);
      circles.push(
        { x: spec.cx - 5.95, z: spec.cz + 0.55, r: 0.58 },
        { x: spec.cx - 3.7, z: spec.cz + 2.25, r: 0.42 }
      );
      addBox(boxes, spec.cx - 3.82, spec.cz + 0.55, 0.76, 1.5);

      // Central lounge (north/south sage dividers, coral sofa, armchairs, coffee table)
      addBox(boxes, spec.cx + 3.2, spec.cz - 2.45, 3.05, 0.22);
      addBox(boxes, spec.cx + 3.2, spec.cz + 2.15, 3.05, 0.22);
      addBox(boxes, spec.cx + 4.15, spec.cz - 0.1, 0.92, 2.15);
      addBox(boxes, spec.cx + 2.85, spec.cz - 0.1, 0.82, 1.15);
      addBox(boxes, spec.cx + 2.75, spec.cz - 1.35, 0.95, 0.9);
      addBox(boxes, spec.cx + 2.75, spec.cz + 1.15, 0.95, 0.9);

      // East open-plan workstation wing: 3 pods, secondary pod chairs & 2 Ficus trees
      [-5.4, -0.4, 5.0].forEach((pdz) => {
        const px = spec.cx + 8.9;
        const pz = spec.cz + pdz;
        addBox(boxes, px, pz, 2.84, 1.4);
        circles.push(
          { x: px + 0.68, z: pz - 1.05, r: 0.34 },
          { x: px - 0.68, z: pz + 1.05, r: 0.34 },
          { x: px + 0.68, z: pz + 1.05, r: 0.34 }
        );
      });
      circles.push(
        { x: spec.cx + 5.6, z: spec.cz - 3.0, r: 0.52 },
        { x: spec.cx + 5.6, z: spec.cz + 2.4, r: 0.52 }
      );

      // Two glass-fronted executive meeting rooms along south back wall
      [spec.cx - 1.9, spec.cx + 2.7].forEach((mx, mi) => {
        const mz = spec.cz + 6.4;
        const frontZRoom = spec.cz + 4.2;
        addBox(boxes, mx - 1.4, frontZRoom, 1.48, 0.14);
        addBox(boxes, mx + 1.4, frontZRoom, 1.48, 0.14);
        if (mi === 0) {
          addBox(boxes, spec.cx + 0.4, mz, 0.16, 4.4);
        }
        addBox(boxes, mi === 0 ? spec.cx - 4.15 : spec.cx + 4.95, mz, 0.18, 4.4);
        circles.push(
          { x: mx, z: mz, r: 0.96 },
          { x: mx - 1.12, z: mz, r: 0.32 },
          { x: mx + 1.12, z: mz, r: 0.32 },
          { x: mx, z: mz - 1.12, r: 0.32 },
          { x: mx, z: mz + 1.12, r: 0.32 },
          { x: mx - 1.65, z: spec.cz + 4.85, r: 0.36 }
        );
      });

      // SW Coffee Bar & Marble Island + 4 bar stools
      const barCx = spec.cx - 8.5;
      addBox(boxes, barCx, spec.cz + 8.15, 7.25, 0.95);
      addBox(boxes, barCx, spec.cz + 5.55, 3.72, 1.12);
      [-1.1, -0.36, 0.36, 1.1].forEach((sx) => {
        circles.push({ x: barCx + sx * 1.15, z: spec.cz + 4.6, r: 0.25 });
      });
    }
  } else if (spec.id === 'realestate' && lv === 1) {
    // NW double-height atrium stairwell void boundary (keeps L1 actors out of empty stair shaft drop)
    addBox(boxes, spec.cx - 6.35, spec.cz - 5.125, 11.6, 6.75);

    // Front-Left & Center-Left 4-Seat Workstation Pods
    [spec.cx + 8.9, spec.cx + 2.4].forEach((px) => {
      const pz = spec.cz - 5.3;
      addBox(boxes, px, pz, 2.84, 1.4);
      circles.push(
        { x: px + 0.68, z: pz - 1.05, r: 0.34 },
        { x: px - 0.68, z: pz + 1.05, r: 0.34 },
        { x: px + 0.68, z: pz + 1.05, r: 0.34 }
      );
    });
    addBox(boxes, spec.cx + 2.3, spec.cz - 2.85, 3.24, 0.22);
    circles.push(
      { x: spec.cx + 5.15, z: spec.cz - 4.1, r: 0.45 },
      { x: spec.cx + 5.15, z: spec.cz - 2.5, r: 0.45 },
      { x: spec.cx + 5.15, z: spec.cz - 0.9, r: 0.45 }
    );

    // East wall credenza, bookcase & corner plant
    addBox(boxes, spec.cx + 12.05, spec.cz - 4.8, 0.62, 3.24);
    addBox(boxes, spec.cx + 12.05, spec.cz - 2.35, 0.62, 1.56);
    circles.push({ x: spec.cx + 11.75, z: spec.cz - 7.8, r: 0.42 });

    // Mid-Left Enclosed Glass Studio Pod
    addBox(boxes, spec.cx + 9.0, spec.cz + 3.45, 6.74, 0.24);
    addBox(boxes, spec.cx + 5.6, spec.cz - 1.1, 0.14, 1.24);
    addBox(boxes, spec.cx + 5.6, spec.cz + 2.25, 0.14, 2.44);
    addBox(boxes, spec.cx + 10.6, spec.cz - 1.7, 3.64, 0.14);
    addBox(boxes, spec.cx + 9.2, spec.cz + 1.6, 2.24, 1.24);
    addBox(boxes, spec.cx + 7.45, spec.cz - 0.55, 1.68, 0.82);
    circles.push(
      { x: spec.cx + 9.85, z: spec.cz + 0.55, r: 0.34 },
      { x: spec.cx + 7.45, z: spec.cz - 1.28, r: 0.34 },
      { x: spec.cx + 9.25, z: spec.cz - 0.45, r: 0.46 },
      { x: spec.cx + 10.75, z: spec.cz - 0.45, r: 0.46 },
      { x: spec.cx + 10.0, z: spec.cz - 0.78, r: 0.4 },
      { x: spec.cx + 6.35, z: spec.cz + 2.55, r: 0.42 }
    );

    // Back-Left Executive Director Suite
    addBox(boxes, spec.cx + 5.45, spec.cz + 7.0, 0.2, 3.28);
    addBox(boxes, spec.cx + 6.95, spec.cz + 8.15, 1.6, 0.52);
    addBox(boxes, spec.cx + 10.85, spec.cz + 8.15, 1.6, 0.52);
    addBox(boxes, spec.cx + 8.9, spec.cz + 5.75, 2.54, 1.1);
    addBox(boxes, spec.cx + 12.08, spec.cz + 6.1, 0.58, 2.44);
    circles.push({ x: spec.cx + 11.7, z: spec.cz + 4.35, r: 0.46 });

    // Center Collaborative Review Table & Tall Sage Divider
    addBox(boxes, spec.cx + 2.25, spec.cz + 0.65, 3.6, 1.16);
    addBox(boxes, spec.cx + 2.25, spec.cz + 3.15, 4.64, 0.24);
    circles.push(
      { x: spec.cx + 0.85, z: spec.cz - 0.35, r: 0.32 },
      { x: spec.cx + 3.65, z: spec.cz - 0.35, r: 0.32 },
      { x: spec.cx + 0.85, z: spec.cz + 1.65, r: 0.32 },
      { x: spec.cx + 2.25, z: spec.cz + 1.65, r: 0.32 },
      { x: spec.cx + 3.65, z: spec.cz + 1.65, r: 0.32 }
    );

    // Back Center Two Glass-Fronted Executive Meeting Rooms
    [spec.cx - 1.9, spec.cx + 2.7].forEach((mx, mi) => {
      const mz = spec.cz + 6.4;
      const frontZRoom = spec.cz + 4.2;
      addBox(boxes, mx - 1.4, frontZRoom, 1.48, 0.14);
      addBox(boxes, mx + 1.4, frontZRoom, 1.48, 0.14);
      if (mi === 0) {
        addBox(boxes, spec.cx + 0.4, mz, 0.16, 4.4);
      }
      addBox(boxes, mi === 0 ? spec.cx - 4.15 : spec.cx + 4.95, mz, 0.18, 4.4);
      circles.push(
        { x: mx, z: mz, r: 0.96 },
        { x: mx - 1.12, z: mz, r: 0.32 },
        { x: mx + 1.12, z: mz, r: 0.32 },
        { x: mx, z: mz - 1.12, r: 0.32 },
        { x: mx, z: mz + 1.12, r: 0.32 },
        { x: mx - 1.65, z: spec.cz + 4.85, r: 0.36 }
      );
    });

    // Center-Right Collaboration Lounge & Bistro Nook
    addBox(boxes, spec.cx - 2.45, spec.cz + 1.53, 2.15, 0.9);
    addBox(boxes, spec.cx - 1.48, spec.cz + 0.7, 0.86, 1.72);
    circles.push(
      { x: spec.cx - 4.2, z: spec.cz + 0.5, r: 0.46 },
      { x: spec.cx - 3.0, z: spec.cz + 0.65, r: 0.58 },
      { x: spec.cx - 3.0, z: spec.cz + 2.95, r: 0.42 },
      { x: spec.cx - 3.88, z: spec.cz + 2.95, r: 0.44 },
      { x: spec.cx - 2.12, z: spec.cz + 2.95, r: 0.44 }
    );

    // SW Kitchenette, L-Peninsula, Bar Stools & West Corner Lounge
    addBox(boxes, spec.cx - 8.5, spec.cz + 8.15, 5.48, 0.96);
    addBox(boxes, spec.cx - 6.05, spec.cz + 6.05, 1.16, 3.78);
    [4.55, 5.3, 6.05, 6.8].forEach((szOff) => {
      circles.push({ x: spec.cx - 5.15, z: spec.cz + szOff, r: 0.25 });
    });
    circles.push(
      { x: spec.cx - 11.1, z: spec.cz + 4.45, r: 0.46 },
      { x: spec.cx - 11.1, z: spec.cz + 6.25, r: 0.46 },
      { x: spec.cx - 11.1, z: spec.cz + 5.35, r: 0.4 },
      { x: spec.cx - 8.45, z: spec.cz + 3.25, r: 0.48 }
    );
  } else if (spec.id === 'realestate' && lv === 2) {
    // Dual VR Experience Pods (cx + 10.95, cz - 6.35 / -4.15)
    circles.push(
      { x: spec.cx + 10.95, z: spec.cz - 6.35, r: 0.86 },
      { x: spec.cx + 10.95, z: spec.cz - 4.15, r: 0.86 }
    );

    // Two Angled Interactive Touchscreen Masterplan Kiosks (cx + 7.25, cz - 6.4 / -4.2)
    circles.push(
      { x: spec.cx + 7.25, z: spec.cz - 6.4, r: 0.52 },
      { x: spec.cx + 7.25, z: spec.cz - 4.2, r: 0.52 }
    );

    // Material Atelier Racks + Specifier Desk between Racks
    addBox(boxes, spec.cx + 9.4, spec.cz - 1.85, 2.84, 0.62);
    addBox(boxes, spec.cx + 9.4, spec.cz + 2.05, 2.88, 0.34);
    addBox(boxes, spec.cx + 9.5, spec.cz + 0.15, 1.78, 0.86);

    // Back-Left 4-Seat Styling Pod + Corner Ficus
    addBox(boxes, spec.cx + 8.9, spec.cz + 5.55, 2.84, 1.4);
    circles.push(
      { x: spec.cx + 9.58, z: spec.cz + 4.5, r: 0.34 },
      { x: spec.cx + 8.22, z: spec.cz + 6.6, r: 0.34 },
      { x: spec.cx + 5.7, z: spec.cz + 6.95, r: 0.48 }
    );

    // Front-Center-Left High-Rise Towers 3D Vitrine
    addBox(boxes, spec.cx + 3.1, spec.cz - 5.55, 3.45, 2.15);

    // Center Lounge + Tiered Tile/Wood Rack + Sage Dividers + Ficus
    addBox(boxes, spec.cx + 3.2, spec.cz - 2.65, 2.88, 0.62);
    addBox(boxes, spec.cx + 3.2, spec.cz - 2.25, 3.1, 0.22);
    addBox(boxes, spec.cx + 3.2, spec.cz + 2.2, 3.14, 0.22);
    addBox(boxes, spec.cx + 4.15, spec.cz - 0.1, 0.92, 2.15);
    addBox(boxes, spec.cx + 2.85, spec.cz - 0.1, 0.82, 1.15);
    addBox(boxes, spec.cx + 2.75, spec.cz - 1.2, 0.92, 0.9);
    addBox(boxes, spec.cx + 2.75, spec.cz + 1.05, 0.92, 0.9);
    circles.push({ x: spec.cx + 5.75, z: spec.cz - 1.15, r: 0.52 });

    // Center-Right Horizontal 3D Masterplan Vitrine + Model Concierge Desk
    addBox(boxes, spec.cx - 2.3, spec.cz - 0.85, 3.55, 2.2);
    addBox(boxes, spec.cx - 2.3, spec.cz - 3.05, 1.78, 0.82);

    // Front-Right Consultation Booth & Explorer Kiosk
    addBox(boxes, spec.cx - 7.6, spec.cz - 3.7, 5.45, 0.22);
    addBox(boxes, spec.cx - 9.35, spec.cz - 5.45, 0.9, 2.05);
    addBox(boxes, spec.cx - 5.85, spec.cz - 5.45, 0.9, 2.05);
    addBox(boxes, spec.cx - 4.7, spec.cz - 5.45, 0.72, 1.5);
    circles.push(
      { x: spec.cx - 7.6, z: spec.cz - 5.45, r: 0.58 },
      { x: spec.cx - 4.65, z: spec.cz - 3.67, r: 0.42 }
    );

    // Back Center Two Executive Closing Meeting Rooms
    [spec.cx - 1.9, spec.cx + 2.7].forEach((mx, mi) => {
      const mz = spec.cz + 6.4;
      const frontZRoom = spec.cz + 4.2;
      addBox(boxes, mx - 1.4, frontZRoom, 1.48, 0.14);
      addBox(boxes, mx + 1.4, frontZRoom, 1.48, 0.14);
      if (mi === 0) {
        addBox(boxes, spec.cx + 0.4, mz, 0.16, 4.4);
      }
      addBox(boxes, mi === 0 ? spec.cx - 4.15 : spec.cx + 4.95, mz, 0.18, 4.4);
      circles.push(
        { x: mx, z: mz, r: 0.96 },
        { x: mx - 1.12, z: mz, r: 0.32 },
        { x: mx + 1.12, z: mz, r: 0.32 },
        { x: mx, z: mz - 1.12, r: 0.32 },
        { x: mx, z: mz + 1.12, r: 0.32 },
        { x: mx - 1.65, z: spec.cz + 4.85, r: 0.36 }
      );
    });

    // Back-Right Refreshment Bar, Stools & Waiting Corner
    addBox(boxes, spec.cx - 7.8, spec.cz + 8.15, 6.2, 0.96);
    addBox(boxes, spec.cx - 8.5, spec.cz + 5.55, 3.54, 1.12);
    [-1.0, -0.32, 0.32, 1.0].forEach((sx) => {
      circles.push({ x: spec.cx - 8.5 + sx * 1.1, z: spec.cz + 4.65, r: 0.25 });
    });
    circles.push(
      { x: spec.cx - 3.55, z: spec.cz + 2.1, r: 0.46 },
      { x: spec.cx - 2.15, z: spec.cz + 2.1, r: 0.46 },
      { x: spec.cx - 2.85, z: spec.cz + 2.45, r: 0.4 },
      { x: spec.cx - 4.7, z: spec.cz + 2.45, r: 0.52 }
    );
  } else if (spec.id === 'realestate' && lv === 3) {
    // East wall foreground ficus
    circles.push({ x: spec.cx + 11.45, z: spec.cz - 7.75, r: 0.45 });

    // Front-Left (East Wing) 4-Seat Workstation Pod + secondary chairs
    addBox(boxes, spec.cx + 9.1, spec.cz - 4.8, 2.84, 1.4);
    circles.push(
      { x: spec.cx + 9.78, z: spec.cz - 5.85, r: 0.34 },
      { x: spec.cx + 8.42, z: spec.cz - 3.75, r: 0.34 }
    );

    // Back-Left (SE) Managing Partner Closing Suite
    addBox(boxes, spec.cx + 7.1, spec.cz + 6.85, 0.22, 3.45);
    addBox(boxes, spec.cx + 8.15, spec.cz + 8.34, 1.38, 0.5);
    addBox(boxes, spec.cx + 11.25, spec.cz + 8.34, 1.38, 0.5);
    addBox(boxes, spec.cx + 9.7, spec.cz + 6.0, 2.54, 1.1);
    circles.push(
      { x: spec.cx + 8.9, z: spec.cz + 4.78, r: 0.48 },
      { x: spec.cx + 10.5, z: spec.cz + 4.78, r: 0.48 },
      { x: spec.cx + 11.75, z: spec.cz + 4.25, r: 0.46 }
    );

    // Center-Left Marble/Oak/Stone Slab Feature Partition & Flanking Plants
    addBox(boxes, spec.cx + 3.4, spec.cz + 1.15, 3.7, 0.32);
    circles.push(
      { x: spec.cx + 5.58, z: spec.cz + 1.25, r: 0.46 },
      { x: spec.cx + 1.22, z: spec.cz + 1.25, r: 0.44 }
    );

    // Foreground Center-Left Cognac Club Lounge (Table + 4 Armchairs)
    circles.push(
      { x: spec.cx + 3.3, z: spec.cz - 4.4, r: 0.56 },
      { x: spec.cx + 3.3 - 1.05, z: spec.cz - 4.4 - 0.88, r: 0.46 },
      { x: spec.cx + 3.3 + 1.05, z: spec.cz - 4.4 - 0.88, r: 0.46 },
      { x: spec.cx + 3.3 - 1.05, z: spec.cz - 4.4 + 0.88, r: 0.46 },
      { x: spec.cx + 3.3 + 1.05, z: spec.cz - 4.4 + 0.88, r: 0.46 }
    );

    // Back Center Twin Glass-Fronted Executive Boardrooms
    [
      { mx: spec.cx + 4.0, w: 5.2, rectangular: true },
      { mx: spec.cx - 1.5, w: 5.5, rectangular: false },
    ].forEach((br, bi) => {
      const mz = spec.cz + 6.4;
      const frontZRoom = spec.cz + 4.2;
      const halfW = br.w * 0.5;
      const glassPaneW = (br.w - 1.5) * 0.5;
      addBox(boxes, br.mx - halfW + glassPaneW * 0.5, frontZRoom, glassPaneW + 0.08, 0.14);
      addBox(boxes, br.mx + halfW - glassPaneW * 0.5, frontZRoom, glassPaneW + 0.08, 0.14);
      addBox(boxes, br.mx - halfW, mz, 0.18, 4.44);
      if (bi === 0) {
        addBox(boxes, br.mx + halfW, mz, 0.18, 4.44);
      }
      if (br.rectangular) {
        addBox(boxes, br.mx, mz, 3.14, 1.2);
        [-1.05, 0, 1.05].forEach((ox) => {
          circles.push(
            { x: br.mx + ox, z: mz - 0.92, r: 0.34 },
            { x: br.mx + ox, z: mz + 0.92, r: 0.34 }
          );
        });
      } else {
        circles.push(
          { x: br.mx, z: mz, r: 1.04 },
          { x: br.mx - 1.2, z: mz, r: 0.34 },
          { x: br.mx + 1.2, z: mz, r: 0.34 },
          { x: br.mx, z: mz - 1.2, r: 0.34 },
          { x: br.mx, z: mz + 1.2, r: 0.34 }
        );
      }
      circles.push({ x: br.mx - halfW + 0.45, z: spec.cz + 4.85, r: 0.38 });
    });
    // Divider pedestal planter between boardrooms
    addBox(boxes, spec.cx + 1.25, spec.cz + 3.65, 0.72, 0.72);

    // Foreground Center Coral Sofa + Teal Armchairs Collaboration Lounge
    addBox(boxes, spec.cx - 0.15, spec.cz - 4.2, 0.92, 2.15);
    addBox(boxes, spec.cx - 1.2, spec.cz - 4.2, 0.86, 1.22);
    circles.push(
      { x: spec.cx - 2.05, z: spec.cz - 4.95, r: 0.46 },
      { x: spec.cx - 2.05, z: spec.cz - 3.45, r: 0.46 }
    );

    // Foreground Right Oval Deal Table + Non-Registered Swivel Chairs + NW Olive Tree
    circles.push(
      { x: spec.cx - 5.9, z: spec.cz - 4.6, r: 1.08 },
      { x: spec.cx - 5.9 - 1.25, z: spec.cz - 4.6, r: 0.34 },
      { x: spec.cx - 5.9 + 1.25, z: spec.cz - 4.6, r: 0.34 },
      { x: spec.cx - 5.9, z: spec.cz - 4.6 - 1.25, r: 0.34 },
      { x: spec.cx - 11.1, z: spec.cz - 6.8, r: 0.46 }
    );

    // Back-Right (SW) Architectural Blueprint/Print & Espresso Counter
    addBox(boxes, spec.cx - 8.5, spec.cz + 8.1, 5.26, 0.92);
    addBox(boxes, spec.cx - 8.5, spec.cz + 5.85, 2.44, 1.0);
    circles.push({ x: spec.cx - 5.2, z: spec.cz + 4.95, r: 0.46 });
  } else if (spec.id === 'realestate' && lv === 4) {
    // East Half: Grand 12-Seat Executive Boardroom
    addBox(boxes, spec.cx + 2.5, spec.cz - 4.3, 0.16, 4.24);
    addBox(boxes, spec.cx + 2.5, spec.cz + 4.05, 0.16, 8.94);
    addBox(boxes, spec.cx + 7.4, spec.cz + 8.02, 5.46, 0.68);
    addBox(boxes, spec.cx + 7.4, spec.cz + 0.2, 2.94, 7.04);
    const brTableZ = spec.cz + 0.2;
    circles.push({ x: spec.cx + 7.4, z: brTableZ + 4.05, r: 0.34 });
    [-2.6, -0.2, 1.0, 2.2].forEach((czo) => {
      circles.push({ x: spec.cx + 7.4 - 2.1, z: brTableZ + czo, r: 0.34 });
    });
    [-2.6, -1.4, -0.2, 1.0, 2.2].forEach((czo) => {
      circles.push({ x: spec.cx + 7.4 + 2.1, z: brTableZ + czo, r: 0.34 });
    });
    circles.push(
      { x: spec.cx + 11.4, z: spec.cz - 7.25, r: 0.46 },
      { x: spec.cx + 11.4, z: spec.cz + 7.1, r: 0.46 }
    );

    // Back Center: CEO Corner Penthouse Suite
    addBox(boxes, spec.cx - 3.45, spec.cz + 2.1, 2.34, 0.16);
    addBox(boxes, spec.cx + 0.7, spec.cz + 2.1, 3.24, 0.16);
    addBox(boxes, spec.cx - 4.6, spec.cz + 5.3, 0.16, 6.44);
    addBox(boxes, spec.cx - 1.15, spec.cz + 8.38, 6.4, 0.5);
    addBox(boxes, spec.cx - 1.15, spec.cz + 5.75, 2.74, 1.14);
    addBox(boxes, spec.cx + 0.55, spec.cz + 6.45, 0.9, 1.54);
    circles.push(
      { x: spec.cx - 1.85, z: spec.cz + 4.45, r: 0.48 },
      { x: spec.cx - 0.45, z: spec.cz + 4.45, r: 0.48 },
      { x: spec.cx + 1.45, z: spec.cz + 4.3, r: 0.46 },
      { x: spec.cx + 1.3, z: spec.cz + 3.45, r: 0.36 },
      { x: spec.cx + 1.65, z: spec.cz + 7.55, r: 0.46 }
    );

    // Back-Right / SW: CFO & Capital Strategy Head Office
    addBox(boxes, spec.cx - 10.19, spec.cz + 4.05, 4.22, 0.16);
    addBox(boxes, spec.cx - 5.6, spec.cz + 4.05, 2.04, 0.16);
    addBox(boxes, spec.cx - 8.5, spec.cz + 6.3, 2.44, 1.08);
    addBox(boxes, spec.cx - 8.5, spec.cz + 8.24, 3.84, 0.6);
    circles.push(
      { x: spec.cx - 9.25, z: spec.cz + 5.05, r: 0.46 },
      { x: spec.cx - 7.75, z: spec.cz + 5.05, r: 0.46 },
      { x: spec.cx - 11.45, z: spec.cz + 7.45, r: 0.46 }
    );

    // Front-Right / NW: Head of Developments & Architecture Office
    addBox(boxes, spec.cx - 9.85, spec.cz - 3.5, 4.94, 0.16);
    addBox(boxes, spec.cx - 5.5, spec.cz - 3.5, 1.04, 0.16);
    addBox(boxes, spec.cx - 5.0, spec.cz - 5.85, 0.16, 4.74);
    addBox(boxes, spec.cx - 8.7, spec.cz - 5.85, 2.54, 1.14);
    addBox(boxes, spec.cx - 11.55, spec.cz - 5.65, 0.86, 2.34);
    circles.push(
      { x: spec.cx - 9.45, z: spec.cz - 4.6, r: 0.46 },
      { x: spec.cx - 7.95, z: spec.cz - 4.6, r: 0.46 },
      { x: spec.cx - 11.45, z: spec.cz - 7.55, r: 0.46 }
    );

    // Center Executive Concierge, VIP Board Lounge & Espresso Console
    addBox(boxes, spec.cx - 1.2, spec.cz - 5.6, 2.26, 1.08);
    addBox(boxes, spec.cx - 2.35, spec.cz - 1.6, 0.9, 2.1);
    addBox(boxes, spec.cx - 8.75, spec.cz + 2.55, 0.64, 2.04);
    circles.push(
      { x: spec.cx - 0.85, z: spec.cz - 1.6, r: 0.54 },
      { x: spec.cx + 0.45, z: spec.cz - 2.45, r: 0.46 },
      { x: spec.cx + 0.45, z: spec.cz - 0.75, r: 0.46 },
      { x: spec.cx + 1.55, z: spec.cz + 1.2, r: 0.46 }
    );
  } else if (spec.id === 'travel' && lv === 1) {
    // Cabin-window acoustic partition (open doorway dz -1.2..+0.4)
    addBox(boxes, spec.cx - 3.6, spec.cz - 4.3, 0.22, 6.24);
    addBox(boxes, spec.cx - 3.6, spec.cz + 4.0, 0.22, 7.24);
    // Twin 4-seat charter pods + secondary non-registered seats
    const pod1X = spec.cx - 8.6;
    [spec.cz - 4.2, spec.cz + 3.0].forEach((pz, pi) => {
      addBox(boxes, pod1X, pz, 3.24, 1.4);
      if (pi === 0) {
        circles.push(
          { x: pod1X + 0.8, z: pz - 1.05, r: 0.34 },
          { x: pod1X - 0.8, z: pz + 1.05, r: 0.34 },
          { x: pod1X + 0.8, z: pz + 1.05, r: 0.34 }
        );
      } else {
        circles.push(
          { x: pod1X - 0.8, z: pz - 1.05, r: 0.34 },
          { x: pod1X + 0.8, z: pz - 1.05, r: 0.34 },
          { x: pod1X - 0.8, z: pz + 1.05, r: 0.34 }
        );
      }
    });
    circles.push({ x: spec.cx - 12.2, z: spec.cz - 7.1, r: 0.46 });
    // Center Visa Consultation Booth & Registered Visa Desk
    circles.push(
      { x: spec.cx + 0.2, z: spec.cz - 4.2, r: 0.82 },
      { x: spec.cx - 0.75, z: spec.cz - 4.2, r: 0.44 },
      { x: spec.cx + 1.15, z: spec.cz - 4.2, r: 0.44 },
      { x: spec.cx + 0.2, z: spec.cz - 3.25, r: 0.44 },
      { x: spec.cx - 0.55, z: spec.cz + 3.2, r: 0.44 },
      { x: spec.cx + 0.95, z: spec.cz + 3.2, r: 0.44 }
    );
    addBox(boxes, spec.cx + 0.2, spec.cz + 4.4, 2.64, 1.1);
    // East Gallery coffee credenza, lounge bench & plants
    addBox(boxes, spec.cx + 6.8, spec.cz - 4.8, 2.58, 0.96);
    addBox(boxes, spec.cx + 6.8, spec.cz + 7.2, 3.24, 0.78);
    circles.push(
      { x: spec.cx + 12.0, z: spec.cz - 7.1, r: 0.46 },
      { x: spec.cx + 12.0, z: spec.cz + 7.1, r: 0.46 }
    );
  } else if (spec.id === 'travel' && lv === 2) {
    // West Wing: 3 First-Class Aircraft Cabin Suite Pods
    addBox(boxes, spec.cx - 10.6, spec.cz - 5.2, 2.32, 2.32);
    addBox(boxes, spec.cx - 10.6, spec.cz - 0.8, 2.32, 2.32);
    addBox(boxes, spec.cx - 5.2, spec.cz - 3.0, 2.32, 2.32);
    // SW Champagne & Espresso Tasting Bar + 4 Barstools
    addBox(boxes, spec.cx - 8.2, spec.cz + 8.15, 4.44, 0.9);
    addBox(boxes, spec.cx - 8.2, spec.cz + 5.75, 4.34, 1.02);
    [-1.35, -0.45, 0.45, 1.35].forEach((ox) => {
      circles.push({ x: spec.cx - 8.2 + ox, z: spec.cz + 4.75, r: 0.24 });
    });
    // Center Operations Control Bridge desks
    addBox(boxes, spec.cx + 0.8, spec.cz - 3.6, 2.84, 1.18);
    addBox(boxes, spec.cx + 0.8, spec.cz + 1.8, 2.84, 1.18);
    // East Panorama Lounge & Quiet Rest Sofa
    circles.push(
      { x: spec.cx + 5.8, z: spec.cz - 5.2, r: 0.46 },
      { x: spec.cx + 7.8, z: spec.cz - 5.2, r: 0.46 },
      { x: spec.cx + 6.8, z: spec.cz - 5.2, r: 0.44 },
      { x: spec.cx + 11.8, z: spec.cz - 7.0, r: 0.46 },
      { x: spec.cx + 11.8, z: spec.cz + 7.0, r: 0.46 }
    );
    addBox(boxes, spec.cx + 6.8, spec.cz + 6.8, 2.64, 0.98);
  } else if (spec.id === 'travel' && lv === 3) {
    // 1. West Wing: Airline Alliances Boardroom (open portal dz -2.0..-0.2)
    addBox(boxes, spec.cx - 3.2, spec.cz - 4.3, 0.16, 4.64);
    addBox(boxes, spec.cx - 3.2, spec.cz + 4.15, 0.16, 8.74);
    const avBrX = spec.cx - 8.4;
    const avBrZ = spec.cz + 0.2;
    addBox(boxes, avBrX, avBrZ, 2.94, 6.84);
    circles.push({ x: avBrX, z: avBrZ + 3.85, r: 0.34 });
    [-2.5, -0.2, 1.0, 2.2].forEach((czo) => circles.push({ x: avBrX + 2.1, z: avBrZ + czo, r: 0.34 }));
    [-2.5, -1.4, -0.2, 1.0, 2.2].forEach((czo) => circles.push({ x: avBrX - 2.1, z: avBrZ + czo, r: 0.34 }));
    circles.push(
      { x: spec.cx - 12.2, z: spec.cz - 7.1, r: 0.46 },
      { x: spec.cx - 12.2, z: spec.cz + 7.1, r: 0.46 }
    );

    // 2. Back Center: CEO & Aviation Command Suite (portal dx -0.4..+1.1)
    const ceoAvX = spec.cx + 0.8;
    addBox(boxes, spec.cx - 1.6, spec.cz + 2.2, 2.44, 0.16);
    addBox(boxes, spec.cx + 2.75, spec.cz + 2.2, 3.34, 0.16);
    addBox(boxes, spec.cx + 4.4, spec.cz + 5.35, 0.16, 6.34);
    addBox(boxes, ceoAvX, spec.cz + 8.36, 5.44, 0.5);
    addBox(boxes, ceoAvX, spec.cz + 5.75, 2.84, 1.16);
    circles.push(
      { x: spec.cx + 0.05, z: spec.cz + 4.4, r: 0.46 },
      { x: spec.cx + 1.55, z: spec.cz + 4.4, r: 0.46 },
      { x: spec.cx + 3.7, z: spec.cz + 7.5, r: 0.46 }
    );

    // 3. SE Corner: Head of Fleet & Safety Office (portal dx +6.0..+7.5)
    addBox(boxes, spec.cx + 5.4, spec.cz + 4.3, 1.24, 0.16);
    addBox(boxes, spec.cx + 10.5, spec.cz + 4.3, 6.04, 0.16);
    const safX = spec.cx + 9.2;
    addBox(boxes, safX, spec.cz + 6.4, 2.44, 1.08);
    circles.push(
      { x: safX - 0.75, z: spec.cz + 5.15, r: 0.46 },
      { x: safX + 0.75, z: spec.cz + 5.15, r: 0.46 }
    );

    // 4. Front Center & NE: Concierge, Sky Lounge & Galley Espresso Bar
    addBox(boxes, ceoAvX, spec.cz - 5.65, 2.26, 1.1);
    addBox(boxes, spec.cx - 0.75, spec.cz - 1.6, 0.9, 2.1);
    circles.push(
      { x: spec.cx + 0.75, z: spec.cz - 1.6, r: 0.54 },
      { x: spec.cx + 2.05, z: spec.cz - 2.35, r: 0.46 },
      { x: spec.cx + 2.05, z: spec.cz - 0.85, r: 0.46 },
      { x: spec.cx + 3.6, z: spec.cz + 1.2, r: 0.46 }
    );
    addBox(boxes, spec.cx + 11.2, spec.cz - 5.8, 3.68, 0.96);
    circles.push(
      { x: spec.cx + 10.4, z: spec.cz - 4.7, r: 0.24 },
      { x: spec.cx + 12.0, z: spec.cz - 4.7, r: 0.24 }
    );
  } else if (spec.id === 'tourism' && lv === 1) {
    // Arched Terracotta & Acacia-Louver Partition (open central archway dz -1.2..+0.6)
    addBox(boxes, spec.cx - 3.5, spec.cz - 4.6, 0.24, 6.84);
    addBox(boxes, spec.cx - 3.5, spec.cz + 4.3, 0.24, 7.44);
    // Twin 4-seat Itinerary Design Pods & non-registered pod chairs
    const s1PodX = spec.cx - 9.0;
    [spec.cz - 4.0, spec.cz + 3.2].forEach((pz, pi) => {
      addBox(boxes, s1PodX, pz, 3.34, 1.42);
      if (pi === 0) {
        circles.push(
          { x: s1PodX + 0.8, z: pz - 1.05, r: 0.34 },
          { x: s1PodX - 0.8, z: pz + 1.05, r: 0.34 },
          { x: s1PodX + 0.8, z: pz + 1.05, r: 0.34 }
        );
      } else {
        circles.push(
          { x: s1PodX - 0.8, z: pz - 1.05, r: 0.34 },
          { x: s1PodX + 0.8, z: pz - 1.05, r: 0.34 },
          { x: s1PodX - 0.8, z: pz + 1.05, r: 0.34 }
        );
      }
    });
    // SW Safari Field Gear Rack & NW Terracotta Urn
    addBox(boxes, spec.cx - 12.2, spec.cz + 7.9, 3.24, 0.6);
    circles.push({ x: spec.cx - 13.4, z: spec.cz - 7.1, r: 0.36 });
    // Center Circular Bushcraft Hearth Table, 4 Rattan Chairs, Cartographer Desk & Visitor Chairs
    circles.push(
      { x: spec.cx + 1.0, z: spec.cz - 3.6, r: 1.0 },
      { x: spec.cx + 1.0 - 1.35, z: spec.cz - 3.6, r: 0.44 },
      { x: spec.cx + 1.0 + 1.35, z: spec.cz - 3.6, r: 0.44 },
      { x: spec.cx + 1.0, z: spec.cz - 3.6 - 1.35, r: 0.44 },
      { x: spec.cx + 1.0, z: spec.cz - 3.6 + 1.35, r: 0.44 },
      { x: spec.cx + 0.25, z: spec.cz + 3.2, r: 0.44 },
      { x: spec.cx + 1.75, z: spec.cz + 3.2, r: 0.44 }
    );
    addBox(boxes, spec.cx + 1.0, spec.cz + 4.4, 2.74, 1.12);
    // East-North Kenyan Highlands Coffee & Chai Bar, 3 Stools & Plants
    addBox(boxes, spec.cx + 9.4, spec.cz - 5.2, 4.36, 1.04);
    [-1.2, 0, 1.2].forEach((ox) => {
      circles.push({ x: spec.cx + 9.4 + ox, z: spec.cz - 4.1, r: 0.24 });
    });
    circles.push(
      { x: spec.cx + 13.2, z: spec.cz - 7.1, r: 0.46 },
      { x: spec.cx + 6.4, z: spec.cz + 6.9, r: 0.46 }
    );
  } else if (spec.id === 'tourism' && lv === 2) {
    // West North: Full-Scale Luxury Canvas Tent Suite Mockup
    addBox(boxes, spec.cx - 8.8, spec.cz - 4.4, 4.64, 3.84);
    // West South: Rift-Valley Live-Edge Bush Dining Table & 6 Rattan Chairs
    const dineX = spec.cx - 8.8;
    const dineZ = spec.cz + 3.8;
    addBox(boxes, dineX, dineZ, 4.24, 1.3);
    [-1.35, 0, 1.35].forEach((ox) => {
      circles.push(
        { x: dineX + ox, z: dineZ - 0.98, r: 0.42 },
        { x: dineX + ox, z: dineZ + 0.98, r: 0.42 }
      );
    });
    // Center: Eco-Lodge Architectural Scale Model, 2 Specialist Desks & Sustainable Material Rack
    addBox(boxes, spec.cx + 1.0, spec.cz - 3.6, 3.14, 1.94);
    addBox(boxes, spec.cx + 1.0, spec.cz + 2.4, 2.74, 1.12);
    addBox(boxes, spec.cx + 7.4, spec.cz - 5.2, 2.74, 1.12);
    addBox(boxes, spec.cx + 1.0, spec.cz + 7.2, 3.64, 0.48);
    // East Mid: Bronze Giraffe Gallery Sculpture, Viewing Chair & Corner Plants
    circles.push(
      { x: spec.cx + 7.4, z: spec.cz - 0.6, r: 0.68 },
      { x: spec.cx + 9.4, z: spec.cz - 0.6, r: 0.46 },
      { x: spec.cx + 13.0, z: spec.cz - 7.0, r: 0.46 },
      { x: spec.cx - 13.4, z: spec.cz + 7.0, r: 0.46 }
    );
  } else if (spec.id === 'tourism' && lv === 3) {
    // 1. West Wing: Wildlife & Conservation Boardroom (open portal dz -1.8..0.0)
    addBox(boxes, spec.cx - 3.4, spec.cz - 4.3, 0.16, 5.04);
    addBox(boxes, spec.cx - 3.4, spec.cz + 4.25, 0.16, 8.54);
    const sfBrX = spec.cx - 8.8;
    const sfBrZ = spec.cz + 0.2;
    addBox(boxes, sfBrX, sfBrZ, 2.84, 6.84);
    circles.push({ x: sfBrX, z: sfBrZ + 3.85, r: 0.34 });
    [-2.5, -0.2, 1.0, 2.2].forEach((czo) => circles.push({ x: sfBrX + 2.05, z: sfBrZ + czo, r: 0.34 }));
    [-2.5, -1.4, -0.2, 1.0, 2.2].forEach((czo) => circles.push({ x: sfBrX - 2.05, z: sfBrZ + czo, r: 0.34 }));
    circles.push(
      { x: spec.cx - 13.4, z: spec.cz - 7.1, r: 0.36 },
      { x: spec.cx - 13.4, z: spec.cz + 7.1, r: 0.46 }
    );

    // 2. Back Center: Founder & Chief Safari Officer Study (portal dx -0.2..+1.4)
    const ceoSfX = spec.cx + 1.0;
    addBox(boxes, spec.cx - 1.5, spec.cz + 2.0, 2.64, 0.16);
    addBox(boxes, spec.cx + 3.1, spec.cz + 2.0, 3.44, 0.16);
    addBox(boxes, spec.cx + 4.8, spec.cz + 5.2, 0.16, 6.44);
    addBox(boxes, ceoSfX, spec.cz + 8.36, 5.64, 0.5);
    addBox(boxes, ceoSfX, spec.cz + 5.75, 2.84, 1.18);
    circles.push(
      { x: spec.cx + 0.25, z: spec.cz + 4.4, r: 0.46 },
      { x: spec.cx + 1.75, z: spec.cz + 4.4, r: 0.46 },
      { x: spec.cx + 4.0, z: spec.cz + 7.5, r: 0.46 }
    );

    // 3. NE Corner: Head of Expeditions & Bush Aviation Office (portal dx +6.2..+7.8)
    addBox(boxes, spec.cx + 5.8, spec.cz - 1.8, 0.84, 0.16);
    addBox(boxes, spec.cx + 11.1, spec.cz - 1.8, 6.64, 0.16);
    addBox(boxes, spec.cx + 5.4, spec.cz - 5.0, 0.16, 6.44);
    const expX = spec.cx + 9.8;
    addBox(boxes, expX, spec.cz - 5.2, 2.54, 1.08);
    circles.push(
      { x: expX - 0.75, z: spec.cz - 3.9, r: 0.46 },
      { x: expX + 0.75, z: spec.cz - 3.9, r: 0.46 }
    );

    // 4. Front Center & South-Center: Reception, Sundowner Lounge & Kenyan Tea Bar
    addBox(boxes, ceoSfX, spec.cz - 5.6, 2.34, 1.0);
    addBox(boxes, spec.cx - 0.75, spec.cz - 1.6, 0.9, 2.1);
    circles.push(
      { x: spec.cx + 0.75, z: spec.cz - 1.6, r: 0.56 },
      { x: spec.cx + 2.05, z: spec.cz - 2.35, r: 0.46 },
      { x: spec.cx + 2.05, z: spec.cz - 0.85, r: 0.46 },
      { x: spec.cx + 4.0, z: spec.cz + 1.1, r: 0.46 }
    );
    addBox(boxes, spec.cx + 7.6, spec.cz + 5.8, 3.48, 0.96);
    circles.push(
      { x: spec.cx + 6.8, z: spec.cz + 4.7, r: 0.24 },
      { x: spec.cx + 8.4, z: spec.cz + 4.7, r: 0.24 }
    );
  } else if (spec.id === 'logistics' && lv === 1) {
    // Cutaway Navy Shipping Container Partition (open portal dz -1.2..+0.6)
    addBox(boxes, spec.cx - 3.4, spec.cz - 5.1, 0.28, 7.84);
    addBox(boxes, spec.cx - 3.4, spec.cz + 4.8, 0.28, 8.44);
    // Twin 4-seat Route Planning & Customs Pods + non-registered pod chairs
    const l1PodX = spec.cx - 8.6;
    [spec.cz - 4.6, spec.cz + 0.2].forEach((pz, pi) => {
      addBox(boxes, l1PodX, pz, 3.34, 1.42);
      if (pi === 0) {
        circles.push(
          { x: l1PodX + 0.8, z: pz - 1.05, r: 0.34 },
          { x: l1PodX - 0.8, z: pz + 1.05, r: 0.34 },
          { x: l1PodX + 0.8, z: pz + 1.05, r: 0.34 }
        );
      } else {
        circles.push(
          { x: l1PodX - 0.8, z: pz - 1.05, r: 0.34 },
          { x: l1PodX + 0.8, z: pz - 1.05, r: 0.34 },
          { x: l1PodX - 0.8, z: pz + 1.05, r: 0.34 }
        );
      }
    });
    // Stenciled Archive Crate Console East of SW stairwell
    addBox(boxes, spec.cx - 7.4, spec.cz + 6.8, 3.28, 0.84);
    // Center Drum Huddle Table, 4 Static Chairs, Cold-Chain Telemetry Desk & Visitor Chairs
    circles.push(
      { x: spec.cx + 1.4, z: spec.cz - 3.8, r: 1.0 },
      { x: spec.cx + 1.4 - 1.32, z: spec.cz - 3.8, r: 0.36 },
      { x: spec.cx + 1.4 + 1.32, z: spec.cz - 3.8, r: 0.36 },
      { x: spec.cx + 1.4, z: spec.cz - 3.8 - 1.32, r: 0.36 },
      { x: spec.cx + 1.4, z: spec.cz - 3.8 + 1.32, r: 0.36 },
      { x: spec.cx + 0.65, z: spec.cz + 3.1, r: 0.44 },
      { x: spec.cx + 2.15, z: spec.cz + 3.1, r: 0.44 }
    );
    addBox(boxes, spec.cx + 1.4, spec.cz + 4.4, 2.74, 1.12);
    // East Burnt-Orange Driver Briefing Bar, 3 Stools, Galvanized Phone Booth & Corner Plant
    addBox(boxes, spec.cx + 10.2, spec.cz - 4.8, 4.54, 1.04);
    [-1.2, 0, 1.2].forEach((ox) => {
      circles.push({ x: spec.cx + 10.2 + ox, z: spec.cz - 3.7, r: 0.24 });
    });
    addBox(boxes, spec.cx + 10.8, spec.cz + 4.8, 1.7, 1.7);
    circles.push({ x: spec.cx + 14.0, z: spec.cz - 7.8, r: 0.46 });
  } else if (spec.id === 'logistics' && lv === 2) {
    // West North: Scale Container Port & Vessel Diorama
    addBox(boxes, spec.cx - 8.8, spec.cz - 4.4, 4.86, 2.86);
    // Mid-West South: Autonomous AGV & Smart-Rack Demo Bay
    addBox(boxes, spec.cx - 6.8, spec.cz + 5.85, 3.46, 0.82);
    circles.push(
      { x: spec.cx - 7.45, z: spec.cz + 4.35, r: 0.68 },
      { x: spec.cx - 8.5, z: spec.cz + 4.35, r: 0.14 },
      { x: spec.cx - 5.1, z: spec.cz + 4.35, r: 0.14 }
    );
    // Center: Packaging Engineering Rack & 2 Automation Specialist Desks
    addBox(boxes, spec.cx + 1.8, spec.cz - 3.6, 3.44, 0.48);
    addBox(boxes, spec.cx + 1.8, spec.cz + 3.2, 2.74, 1.12);
    addBox(boxes, spec.cx + 9.8, spec.cz - 5.2, 2.74, 1.12);
    // East Mid: Barrel & Leather Lounge + Corner Plant
    addBox(boxes, spec.cx + 11.4, spec.cz + 1.8, 0.96, 2.1);
    circles.push(
      { x: spec.cx + 9.4, z: spec.cz + 1.8, r: 0.46 },
      { x: spec.cx + 8.0, z: spec.cz + 0.9, r: 0.46 },
      { x: spec.cx + 8.0, z: spec.cz + 2.7, r: 0.46 },
      { x: spec.cx + 14.0, z: spec.cz + 7.6, r: 0.46 }
    );
  } else if (spec.id === 'logistics' && lv === 3) {
    // 1. East Wing: Global Trade & Port Alliances Boardroom (open portal dz -1.6..+0.2)
    addBox(boxes, spec.cx + 4.4, spec.cz - 4.7, 0.16, 6.24);
    addBox(boxes, spec.cx + 4.4, spec.cz + 4.6, 0.16, 8.84);
    const lgBrX = spec.cx + 9.8;
    const lgBrZ = spec.cz + 0.0;
    addBox(boxes, lgBrX, lgBrZ, 2.94, 7.24);
    circles.push({ x: lgBrX, z: lgBrZ + 4.05, r: 0.34 });
    [-2.6, -0.2, 1.0, 2.2].forEach((czo) => circles.push({ x: lgBrX - 2.05, z: lgBrZ + czo, r: 0.34 }));
    [-2.6, -1.4, -0.2, 1.0, 2.2].forEach((czo) => circles.push({ x: lgBrX + 2.05, z: lgBrZ + czo, r: 0.34 }));
    circles.push(
      { x: spec.cx + 14.0, z: spec.cz - 7.8, r: 0.46 },
      { x: spec.cx + 14.0, z: spec.cz + 7.8, r: 0.46 }
    );

    // 2. Back Center: CEO & Chief Logistics Officer Command Suite (portal dx -1.2..+0.4)
    const ceoLgX = spec.cx - 0.3;
    addBox(boxes, spec.cx - 2.7, spec.cz + 2.2, 3.04, 0.16);
    addBox(boxes, spec.cx + 2.0, spec.cz + 2.2, 3.24, 0.16);
    addBox(boxes, spec.cx - 4.2, spec.cz + 5.7, 0.16, 7.04);
    addBox(boxes, ceoLgX, spec.cz + 9.05, 5.84, 0.5);
    addBox(boxes, ceoLgX, spec.cz + 5.8, 2.84, 1.18);
    circles.push(
      { x: spec.cx - 1.05, z: spec.cz + 4.4, r: 0.46 },
      { x: spec.cx + 0.45, z: spec.cz + 4.4, r: 0.46 }
    );

    // 3. NW Corner: Head of Fleet & Aviation Cargo Office (portal dx -7.6..-6.0)
    addBox(boxes, spec.cx - 11.4, spec.cz - 2.0, 7.64, 0.16);
    addBox(boxes, spec.cx - 5.6, spec.cz - 2.0, 0.84, 0.16);
    addBox(boxes, spec.cx - 5.2, spec.cz - 5.6, 0.16, 7.24);
    const fltX = spec.cx - 10.2;
    addBox(boxes, fltX, spec.cz - 5.6, 2.54, 1.08);
    circles.push(
      { x: fltX - 0.75, z: spec.cz - 4.3, r: 0.46 },
      { x: fltX + 0.75, z: spec.cz - 4.3, r: 0.46 }
    );

    // 4. Front Center & SW Cafe: Reception, Port Executive Lounge & Container Cafe Bar
    addBox(boxes, ceoLgX, spec.cz - 5.8, 2.34, 1.0);
    addBox(boxes, spec.cx + 1.4, spec.cz - 1.5, 0.9, 2.1);
    circles.push(
      { x: spec.cx - 0.2, z: spec.cz - 1.5, r: 0.46 },
      { x: spec.cx - 1.55, z: spec.cz - 2.25, r: 0.46 },
      { x: spec.cx - 1.55, z: spec.cz - 0.75, r: 0.46 }
    );
    addBox(boxes, spec.cx - 7.4, spec.cz + 6.4, 3.48, 0.96);
    circles.push(
      { x: spec.cx - 8.2, z: spec.cz + 5.2, r: 0.24 },
      { x: spec.cx - 6.6, z: spec.cz + 5.2, r: 0.24 }
    );
  } else if (spec.id === 'restaurant' && lv === 1) {
    // NW Artisan Copper Coffee Drum Roaster + Roasting Pod + Divider
    addBox(boxes, spec.cx - 7.8, spec.cz - 6.4, 1.4, 1.35);
    addBox(boxes, spec.cx - 4.2, spec.cz - 4.8, 2.44, 1.1);
    circles.push(
      { x: spec.cx - 4.85, z: spec.cz - 3.65, r: 0.44 },
      { x: spec.cx - 3.55, z: spec.cz - 3.65, r: 0.44 }
    );
    addBox(boxes, spec.cx - 1.2, spec.cz - 4.4, 0.26, 5.26);
    // NE Tapas Bar + 3 Stools + Pastry/Sommelier Desks
    addBox(boxes, spec.cx + 6.4, spec.cz - 6.4, 4.94, 1.14);
    [4.8, 6.4, 8.0].forEach((bx) => circles.push({ x: spec.cx + bx, z: spec.cz - 5.3, r: 0.24 }));
    addBox(boxes, spec.cx + 7.2, spec.cz - 1.8, 2.24, 1.04);
    addBox(boxes, spec.cx - 2.6, spec.cz + 4.7, 2.04, 1.0);
    // Mezzanine Velvet Dining Tables + Static Chairs + SE Olive Tree
    [
      [spec.cx + 1.2, spec.cz + 0.6],
      [spec.cx + 6.2, spec.cz + 4.8],
    ].forEach(([tx, tz]) => {
      circles.push(
        { x: tx, z: tz, r: 0.72 },
        { x: tx - 1.08, z: tz, r: 0.42 },
        { x: tx + 1.08, z: tz, r: 0.42 }
      );
    });
    circles.push({ x: spec.cx + 8.6, z: spec.cz + 7.4, r: 0.45 });
  } else if (spec.id === 'restaurant' && lv === 2) {
    // NW Amber-Glass Wine Vault Perimeter & Decanting Island (portal dz -3.2..-1.4)
    addBox(boxes, spec.cx - 6.3, spec.cz - 0.6, 6.24, 0.16);
    addBox(boxes, spec.cx - 3.2, spec.cz - 5.9, 0.16, 5.44);
    addBox(boxes, spec.cx - 3.2, spec.cz - 1.0, 0.16, 0.84);
    addBox(boxes, spec.cx - 6.3, spec.cz - 8.2, 5.24, 0.5);
    addBox(boxes, spec.cx - 9.1, spec.cz - 4.6, 0.5, 5.24);
    addBox(boxes, spec.cx - 6.4, spec.cz - 4.6, 2.24, 1.18);
    // East-North Chef's Interactive Tasting Table & Static Chairs
    const ctX = spec.cx + 5.2;
    const ctZ = spec.cz - 3.6;
    addBox(boxes, ctX, ctZ, 2.4, 5.46);
    circles.push({ x: ctX, z: ctZ + 3.35, r: 0.34 });
    [-1.8, 0.8, 2.0].forEach((czo) => circles.push({ x: ctX - 1.85, z: ctZ + czo, r: 0.34 }));
    [-1.8, -0.5, 0.8, 2.0].forEach((czo) => circles.push({ x: ctX + 1.85, z: ctZ + czo, r: 0.34 }));
    // South-Center Charcuterie Cabinet & SE Sommelier Lounge + Plants
    addBox(boxes, spec.cx - 2.6, spec.cz + 6.8, 3.04, 0.86);
    addBox(boxes, spec.cx + 7.2, spec.cz + 4.8, 0.9, 2.0);
    circles.push(
      { x: spec.cx + 5.2, z: spec.cz + 4.8, r: 0.48 },
      { x: spec.cx + 3.8, z: spec.cz + 3.9, r: 0.44 },
      { x: spec.cx + 3.8, z: spec.cz + 5.7, r: 0.44 },
      { x: spec.cx + 8.6, z: spec.cz - 7.6, r: 0.45 },
      { x: spec.cx + 8.6, z: spec.cz + 7.6, r: 0.45 }
    );
  } else if (spec.id === 'restaurant' && lv === 3) {
    // 1. East Wing: Private Dining Boardroom (portal dz -1.6..+0.2)
    addBox(boxes, spec.cx + 2.2, spec.cz - 5.0, 0.16, 6.84);
    addBox(boxes, spec.cx + 2.2, spec.cz + 4.3, 0.16, 8.24);
    const brX = spec.cx + 5.8;
    const brZ = spec.cz + 0.0;
    addBox(boxes, brX, brZ, 2.2, 6.3);
    circles.push({ x: brX, z: brZ + 3.75, r: 0.34 });
    [-2.4, 0.2, 1.6].forEach((czo) => circles.push({ x: brX - 1.65, z: brZ + czo, r: 0.34 }));
    [-2.4, -1.0, 0.4, 1.8].forEach((czo) => circles.push({ x: brX + 1.65, z: brZ + czo, r: 0.34 }));
    circles.push(
      { x: spec.cx + 8.6, z: spec.cz - 7.4, r: 0.45 },
      { x: spec.cx + 8.6, z: spec.cz + 7.4, r: 0.45 }
    );
    // 2. NW Culinary CEO Studio (portal dx -5.2..-3.6)
    addBox(boxes, spec.cx - 7.3, spec.cz - 2.4, 4.24, 0.16);
    addBox(boxes, spec.cx - 3.0, spec.cz - 2.4, 1.24, 0.16);
    addBox(boxes, spec.cx - 2.4, spec.cz - 5.4, 0.16, 6.04);
    const ceoBsX = spec.cx - 5.9;
    addBox(boxes, ceoBsX, spec.cz - 8.2, 4.64, 0.5);
    addBox(boxes, ceoBsX, spec.cz - 5.6, 2.54, 1.12);
    circles.push(
      { x: ceoBsX - 0.75, z: spec.cz - 4.35, r: 0.44 },
      { x: ceoBsX + 0.75, z: spec.cz - 4.35, r: 0.44 }
    );
    // 3. South-Center Head of Events Office (portal dx -2.2..-0.6)
    addBox(boxes, spec.cx - 3.2, spec.cz + 2.8, 2.04, 0.16);
    addBox(boxes, spec.cx + 0.6, spec.cz + 2.8, 2.44, 0.16);
    addBox(boxes, spec.cx - 4.2, spec.cz + 5.6, 0.16, 5.64);
    const evX = spec.cx - 1.2;
    addBox(boxes, evX, spec.cz + 5.6, 2.44, 1.08);
    circles.push(
      { x: evX - 0.75, z: spec.cz + 4.35, r: 0.44 },
      { x: evX + 0.75, z: spec.cz + 4.35, r: 0.44 }
    );
    // 4. Central Mezzanine Reception & Martini Lounge
    addBox(boxes, spec.cx - 0.1, spec.cz - 6.2, 2.08, 1.0);
    addBox(boxes, spec.cx + 1.0, spec.cz - 1.2, 0.88, 1.9);
    circles.push(
      { x: spec.cx - 0.3, z: spec.cz - 1.2, r: 0.46 },
      { x: spec.cx - 1.4, z: spec.cz - 2.0, r: 0.44 },
      { x: spec.cx - 1.4, z: spec.cz - 0.4, r: 0.44 },
      { x: spec.cx - 5.4, z: spec.cz + 7.4, r: 0.45 }
    );
  } else if (spec.id === 'dealership' && lv === 1) {
    // Central Sky-Oculus Atrium Void safety balustrades
    addBox(boxes, spec.cx, spec.cz - 2.45, 7.04, 0.14);
    addBox(boxes, spec.cx, spec.cz + 3.25, 7.04, 0.14);
    addBox(boxes, spec.cx - 3.45, spec.cz + 0.4, 0.14, 5.84);
    addBox(boxes, spec.cx + 3.45, spec.cz + 0.4, 0.14, 5.84);
    // East stair arrival void guardrails & north landing NPC gate
    addBox(boxes, spec.cx + 7.82, spec.cz + 0.46, 0.14, 8.46);
    addBox(boxes, spec.cx + 8.76, spec.cz + 4.65, 1.98, 0.14);
    addBox(boxes, spec.cx + 8.76, spec.cz - 3.72, 1.88, 0.24, undefined, true);
    // West stair entry (L1->L2) under-stair glass screen & north entry NPC gate
    addBox(boxes, spec.cx - 7.82, spec.cz + 2.55, 0.14, 12.24);
    addBox(boxes, spec.cx - 8.76, spec.cz - 3.72, 1.88, 0.24, undefined, true);
    // Zone 1A North Atelier: Paint Speed-Form Wall, Wheel Pedestals, Trim Table & Client Chair
    addBox(boxes, spec.cx, spec.cz - 8.45, 6.2, 0.56);
    circles.push(
      { x: spec.cx - 5.0, z: spec.cz - 6.0, r: 0.56 },
      { x: spec.cx + 5.0, z: spec.cz - 6.0, r: 0.56 },
      { x: spec.cx + 2.05, z: spec.cz - 5.5, r: 0.56 }
    );
    addBox(boxes, spec.cx, spec.cz - 5.5, 3.0, 1.28);
    // Zone 1B South Wing: Motorsport Simulator, EV Engineer Desk & Cutaway Vitrine
    addBox(boxes, spec.cx - 4.2, spec.cz + 6.1, 2.42, 1.54);
    addBox(boxes, spec.cx + 0.4, spec.cz + 6.2, 2.35, 1.06);
    addBox(boxes, spec.cx + 4.8, spec.cz + 6.2, 2.62, 1.44);
    // East & West Mezzanine Consoles & Olive Planters
    addBox(boxes, spec.cx + 7.2, spec.cz + 0.4, 0.68, 2.24);
    addBox(boxes, spec.cx - 7.2, spec.cz + 0.4, 0.68, 2.24);
    circles.push(
      { x: spec.cx + 5.8, z: spec.cz - 2.3, r: 0.46 },
      { x: spec.cx - 5.8, z: spec.cz + 2.8, r: 0.46 }
    );
  } else if (spec.id === 'dealership' && lv === 2) {
    // West stair arrival void guardrails & south landing NPC gate
    addBox(boxes, spec.cx - 7.82, spec.cz + 0.46, 0.14, 8.46);
    addBox(boxes, spec.cx - 8.76, spec.cz - 3.72, 1.98, 0.14);
    addBox(boxes, spec.cx - 8.76, spec.cz + 4.65, 1.88, 0.24, undefined, true);
    // Zone 2A South VIP Handover Sky-Lounge & Hospitality Bar
    addBox(boxes, spec.cx - 1.8, spec.cz + 6.8, 2.86, 1.1);
    addBox(boxes, spec.cx - 1.8, spec.cz + 5.0, 1.62, 0.9);
    circles.push(
      { x: spec.cx + 0.65, z: spec.cz + 5.2, r: 0.56 },
      { x: spec.cx + 4.5, z: spec.cz + 5.44, r: 0.25 },
      { x: spec.cx + 6.3, z: spec.cz + 5.44, r: 0.25 }
    );
    addBox(boxes, spec.cx + 5.4, spec.cz + 6.4, 3.64, 1.1);
    // Zone 2B North-East Glazed Fleet Financing Boardroom (doorway dx +4.8..+7.0 open)
    addBox(boxes, spec.cx + 2.0, spec.cz - 4.65, 0.14, 8.12);
    addBox(boxes, spec.cx + 3.4, spec.cz - 0.6, 2.82, 0.14);
    addBox(boxes, spec.cx + 8.4, spec.cz - 0.6, 2.82, 0.14);
    addBox(boxes, spec.cx + 5.9, spec.cz - 4.6, 4.1, 1.54);
    // Zone 2C North-West Managing Principal Suite & Aero Wind-Tunnel Vitrine
    addBox(boxes, spec.cx - 3.2, spec.cz - 5.8, 2.78, 1.2);
    addBox(boxes, spec.cx - 3.2, spec.cz - 8.42, 3.84, 0.58);
    addBox(boxes, spec.cx - 3.4, spec.cz + 0.2, 2.94, 1.38);
    // Botanical accents
    circles.push(
      { x: spec.cx - 6.4, z: spec.cz + 7.4, r: 0.46 },
      { x: spec.cx + 8.6, z: spec.cz + 7.4, r: 0.46 }
    );
  } else if (spec.id === 'crypto' && lv === 1) {
    // Stairwell & 5-story Merkle Void guardrails + arrival/entry NPC gates
    addBox(boxes, spec.cx + 4.35, spec.cz - 4.82, 0.14, 4.76);
    addBox(boxes, spec.cx + 4.35, spec.cz - 8.4, 0.22, 2.3, undefined, true);
    addBox(boxes, spec.cx + 6.38, spec.cz - 2.45, 4.08, 0.14);
    addBox(boxes, spec.cx + 9.5, spec.cz - 2.45, 2.1, 0.24, undefined, true);
    addBox(boxes, spec.cx + 8.38, spec.cz - 4.85, 0.12, 4.8);
    addBox(boxes, spec.cx + 6.42, spec.cz - 7.2, 4.0, 0.12);
    // NW Cryo-Immersion ASIC Tanks
    addBox(boxes, spec.cx - 7.4, spec.cz - 6.2, 2.6, 1.52);
    addBox(boxes, spec.cx - 3.0, spec.cz - 6.2, 2.6, 1.52);
    // Center Self-Custody Museum Vitrines
    addBox(boxes, spec.cx - 6.0, spec.cz - 0.8, 1.84, 1.24);
    addBox(boxes, spec.cx - 1.2, spec.cz - 0.8, 1.84, 1.24);
    // SW Hardware Advisory Pods
    addBox(boxes, spec.cx - 7.2, spec.cz + 5.6, 2.54, 1.12);
    addBox(boxes, spec.cx - 2.4, spec.cz + 5.6, 2.54, 1.12);
    // SE Espresso Bar & Sofa Lounge
    addBox(boxes, spec.cx + 6.8, spec.cz + 7.2, 3.94, 1.14);
    addBox(boxes, spec.cx + 4.4, spec.cz + 3.6, 2.42, 0.94);
    circles.push(
      { x: spec.cx + 4.4, z: spec.cz + 5.1, r: 0.64 },
      { x: spec.cx + 9.4, z: spec.cz + 7.8, r: 0.45 },
      { x: spec.cx - 9.4, z: spec.cz + 7.8, r: 0.45 }
    );
  } else if (spec.id === 'crypto' && lv === 2) {
    // Stairwell & 5-story Merkle Void guardrails + arrival/entry NPC gates
    addBox(boxes, spec.cx + 4.35, spec.cz - 4.82, 0.14, 4.76);
    addBox(boxes, spec.cx + 4.35, spec.cz - 8.4, 0.22, 2.3, undefined, true);
    addBox(boxes, spec.cx + 6.38, spec.cz - 2.45, 4.08, 0.14);
    addBox(boxes, spec.cx + 9.5, spec.cz - 2.45, 2.1, 0.24, undefined, true);
    addBox(boxes, spec.cx + 8.38, spec.cz - 4.85, 0.12, 4.8);
    addBox(boxes, spec.cx + 6.42, spec.cz - 7.2, 4.0, 0.12);
    // West Dual-Bank OTC Consoles
    addBox(boxes, spec.cx - 5.6, spec.cz - 3.5, 5.84, 1.16);
    addBox(boxes, spec.cx - 5.6, spec.cz - 0.8, 2.84, 1.1);
    // SW Acoustic Smoked-Glass Settlement Call Pods (North portals wide open)
    [-7.4, -2.2].forEach((bx) => {
      const px = spec.cx + bx;
      const pz = spec.cz + 6.6;
      addBox(boxes, px - 1.54, pz, 0.14, 3.22);
      addBox(boxes, px + 1.54, pz, 0.14, 3.22);
      addBox(boxes, px, pz + 1.54, 3.18, 0.16);
      addBox(boxes, px - 1.15, pz - 1.54, 0.8, 0.14);
      addBox(boxes, px + 1.15, pz - 1.54, 0.8, 0.14);
      circles.push({ x: px, z: pz + 0.15, r: 0.58 });
    });
    // SE Torus Sculpture Pedestal & Lounge
    circles.push(
      { x: spec.cx + 6.4, z: spec.cz + 2.6, r: 0.74 },
      { x: spec.cx + 9.4, z: spec.cz + 7.8, r: 0.45 }
    );
    addBox(boxes, spec.cx + 6.0, spec.cz + 7.2, 2.42, 0.94);
    addBox(boxes, spec.cx + 6.0, spec.cz + 5.6, 1.8, 0.92);
  } else if (spec.id === 'crypto' && lv === 3) {
    // Stairwell & 5-story Merkle Void guardrails + arrival/entry NPC gates
    addBox(boxes, spec.cx + 4.35, spec.cz - 4.82, 0.14, 4.76);
    addBox(boxes, spec.cx + 4.35, spec.cz - 8.4, 0.22, 2.3, undefined, true);
    addBox(boxes, spec.cx + 6.38, spec.cz - 2.45, 4.08, 0.14);
    addBox(boxes, spec.cx + 9.5, spec.cz - 2.45, 2.1, 0.24, undefined, true);
    addBox(boxes, spec.cx + 8.38, spec.cz - 4.85, 0.12, 4.8);
    addBox(boxes, spec.cx + 6.42, spec.cz - 7.2, 4.0, 0.12);
    // NW Air-Gapped Signing Enclave (open south portal dx -7.5..-5.3)
    addBox(boxes, spec.cx - 3.0, spec.cz - 6.38, 0.16, 6.32);
    addBox(boxes, spec.cx - 8.65, spec.cz - 3.2, 2.28, 0.16);
    addBox(boxes, spec.cx - 4.15, spec.cz - 3.2, 2.28, 0.16);
    circles.push({ x: spec.cx - 6.4, z: spec.cz - 6.4, r: 1.32 });
    // SW Theater Giant Screen & 3 Auditor Consoles
    addBox(boxes, spec.cx - 4.2, spec.cz + 9.15, 7.15, 0.28);
    [-7.4, -4.2, -1.0].forEach((ax) => addBox(boxes, spec.cx + ax, spec.cz + 4.8, 2.52, 1.1));
    // SE Research Collaboration Island & Plants
    addBox(boxes, spec.cx + 6.2, spec.cz + 4.2, 2.84, 1.14);
    circles.push(
      { x: spec.cx + 9.2, z: spec.cz + 7.8, r: 0.45 },
      { x: spec.cx + 1.8, z: spec.cz - 8.0, r: 0.45 }
    );
  } else if (spec.id === 'crypto' && lv === 4) {
    // L4 Penthouse Void Balustrades (SOLID South drop guard + East shaft guard + West arrival NPC gate)
    addBox(boxes, spec.cx + 4.35, spec.cz - 4.82, 0.14, 4.76);
    addBox(boxes, spec.cx + 4.35, spec.cz - 8.4, 0.22, 2.3, undefined, true);
    addBox(boxes, spec.cx + 7.5, spec.cz - 2.45, 6.3, 0.16);
    addBox(boxes, spec.cx + 8.36, spec.cz - 4.84, 0.14, 4.82);
    // West Sovereign Governance Boardroom (East portal dz -5.0..-2.6 open)
    addBox(boxes, spec.cx - 0.6, spec.cz - 7.3, 0.16, 4.52);
    addBox(boxes, spec.cx - 0.6, spec.cz - 0.68, 0.16, 3.72);
    addBox(boxes, spec.cx - 5.2, spec.cz + 1.2, 9.18, 0.16);
    addBox(boxes, spec.cx - 5.4, spec.cz - 3.8, 5.24, 1.84);
    // SW Founder & CEO Suite
    addBox(boxes, spec.cx - 5.8, spec.cz + 6.4, 2.84, 1.16);
    addBox(boxes, spec.cx - 9.5, spec.cz + 6.0, 0.62, 3.44);
    circles.push(
      { x: spec.cx - 2.9, z: spec.cz + 5.2, r: 0.54 },
      { x: spec.cx - 1.5, z: spec.cz + 6.4, r: 0.54 },
      { x: spec.cx - 2.3, z: spec.cz + 5.9, r: 0.48 }
    );
    // SE Sky-Lounge, Bookcase & Espresso Bar
    addBox(boxes, spec.cx + 6.6, spec.cz + 7.8, 4.34, 1.16);
    addBox(boxes, spec.cx + 4.4, spec.cz + 3.6, 2.42, 0.94);
    addBox(boxes, spec.cx + 4.4, spec.cz + 5.0, 1.8, 0.92);
    addBox(boxes, spec.cx + 9.6, spec.cz + 3.4, 0.72, 3.24);
    circles.push(
      { x: spec.cx + 9.4, z: spec.cz + 8.0, r: 0.45 },
      { x: spec.cx - 9.4, z: spec.cz + 8.4, r: 0.45 }
    );
  } else if (spec.id === 'medical' && lv === 1) {
    // 3T MRI cleanroom partition (south doorway dz +2.3..+4.8 open!) & gowning cabinet
    addBox(boxes, spec.cx - 11.8, spec.cz - 2.6, 0.22, 9.84);
    addBox(boxes, spec.cx - 11.8, spec.cz + 6.1, 0.22, 2.44);
    addBox(boxes, spec.cx - 17.8, spec.cz - 2.2, 2.6, 3.6);
    addBox(boxes, spec.cx - 23.25, spec.cz - 2.2, 0.7, 3.25);
    // Radiology control console & waiting lounge sofa + coffee table
    addBox(boxes, spec.cx - 7.8, spec.cz - 2.2, 2.84, 1.08);
    addBox(boxes, spec.cx - 6.4, spec.cz + 5.6, 2.4, 0.94);
    addBox(boxes, spec.cx - 6.4, spec.cz + 3.9, 1.48, 0.88);
    // East 64-Slice CT scanner, radiologist desk & 4D ultrasound bay
    addBox(boxes, spec.cx + 19.6, spec.cz - 2.2, 2.3, 3.4);
    addBox(boxes, spec.cx + 13.0, spec.cz - 3.4, 2.54, 1.08);
    addBox(boxes, spec.cx + 13.2, spec.cz + 4.4, 1.98, 0.86);
    addBox(boxes, spec.cx + 11.4, spec.cz + 3.8, 0.64, 0.6);
    addBox(boxes, spec.cx + 16.4, spec.cz + 4.0, 0.22, 3.64);
    circles.push(
      { x: spec.cx - 9.8, z: spec.cz + 5.8, r: 0.45 },
      { x: spec.cx + 22.0, z: spec.cz + 5.8, r: 0.45 }
    );
  } else if (spec.id === 'medical' && lv === 2) {
    // Dental Bay 1 & 2, privacy partition, north sterilization cabinetry, CAD/CAM desk
    addBox(boxes, spec.cx - 16.7, spec.cz - 2.0, 0.22, 4.46);
    addBox(boxes, spec.cx - 19.8, spec.cz - 1.8, 1.68, 2.18);
    addBox(boxes, spec.cx - 13.6, spec.cz - 1.8, 1.68, 2.18);
    addBox(boxes, spec.cx - 16.7, spec.cz - 7.1, 11.24, 0.72);
    addBox(boxes, spec.cx - 13.6, spec.cz + 4.4, 2.44, 1.04);
    // Ophthalmology slit-lamp pedestal, optometrist desk & eyewear fitting bar
    addBox(boxes, spec.cx - 6.8, spec.cz - 2.0, 1.5, 1.4);
    addBox(boxes, spec.cx - 3.2, spec.cz - 3.6, 2.24, 1.04);
    addBox(boxes, spec.cx - 5.8, spec.cz + 4.8, 4.48, 0.94);
    // East Longevity IV Infusion pods & biomarker nurse desk
    [13.0, 17.0, 21.0].forEach((ix) => {
      addBox(boxes, spec.cx + ix, spec.cz + 3.4, 1.56, 1.88);
    });
    addBox(boxes, spec.cx + 17.0, spec.cz - 3.6, 2.64, 1.08);
    circles.push({ x: spec.cx + 22.0, z: spec.cz - 5.8, r: 0.45 });
  } else if (spec.id === 'medical' && lv === 3) {
    // ISO-5 Cleanroom enclosure (south entry dx -20.2..-17.4 open!) & equipment
    addBox(boxes, spec.cx - 14.8, spec.cz - 2.8, 0.2, 9.24);
    addBox(boxes, spec.cx - 21.9, spec.cz + 1.8, 3.04, 0.2);
    addBox(boxes, spec.cx - 16.0, spec.cz + 1.8, 2.44, 0.2);
    addBox(boxes, spec.cx - 22.4, spec.cz - 4.6, 1.2, 2.3);
    addBox(boxes, spec.cx - 22.4, spec.cz - 0.8, 1.2, 2.3);
    addBox(boxes, spec.cx - 18.8, spec.cz - 2.8, 1.62, 2.72);
    // Geneticist & bioinformatician desks
    addBox(boxes, spec.cx - 11.8, spec.cz - 2.6, 2.44, 1.04);
    addBox(boxes, spec.cx - 11.8, spec.cz + 4.2, 2.44, 1.04);
    // Cryo-Biologics glass vault (south portal dx -6.8..-4.0 open!) & 3 LN2 dewar tanks
    addBox(boxes, spec.cx - 9.0, spec.cz - 3.2, 0.2, 7.64);
    addBox(boxes, spec.cx - 1.8, spec.cz - 3.2, 0.2, 7.64);
    addBox(boxes, spec.cx - 7.9, spec.cz + 0.6, 2.24, 0.2);
    addBox(boxes, spec.cx - 2.9, spec.cz + 0.6, 2.24, 0.2);
    [-7.2, -5.4, -3.6].forEach((tx) => {
      circles.push({ x: spec.cx + tx, z: spec.cz - 3.2, r: 0.56 });
    });
    // East Pathology desks, autoclave wall & specimen courier bar
    addBox(boxes, spec.cx + 14.2, spec.cz - 2.8, 2.54, 1.08);
    addBox(boxes, spec.cx + 20.0, spec.cz - 2.8, 2.54, 1.08);
    addBox(boxes, spec.cx + 17.0, spec.cz + 4.6, 6.26, 1.12);
    addBox(boxes, spec.cx + 23.25, spec.cz - 2.5, 0.7, 5.24);
    circles.push({ x: spec.cx + 21.8, z: spec.cz + 5.8, r: 0.45 });
  } else if (spec.id === 'medical' && lv === 4) {
    // Telehealth Broadcast Pod (south portal dx -18.6..-16.0 open!)
    addBox(boxes, spec.cx - 20.6, spec.cz - 3.6, 0.2, 7.64);
    addBox(boxes, spec.cx - 14.0, spec.cz - 3.6, 0.2, 7.64);
    addBox(boxes, spec.cx - 19.6, spec.cz + 0.2, 2.04, 0.2);
    addBox(boxes, spec.cx - 15.0, spec.cz + 0.2, 2.04, 0.2);
    addBox(boxes, spec.cx - 17.2, spec.cz - 3.5, 2.54, 1.04);
    circles.push({ x: spec.cx - 17.2, z: spec.cz - 2.35, r: 0.24 });
    // CMO Desk & Private Sofa
    addBox(boxes, spec.cx - 18.5, spec.cz + 4.6, 2.84, 1.14);
    addBox(boxes, spec.cx - 12.6, spec.cz + 4.8, 0.94, 2.4);
    // Clinical Case Review Boardroom (south portal dx -7.4..-4.2 open!) & 4.6m table
    addBox(boxes, spec.cx - 9.8, spec.cz - 3.0, 0.2, 8.84);
    addBox(boxes, spec.cx - 1.8, spec.cz - 3.0, 0.2, 8.84);
    addBox(boxes, spec.cx - 8.6, spec.cz + 1.4, 2.44, 0.2);
    addBox(boxes, spec.cx - 3.0, spec.cz + 1.4, 2.44, 0.2);
    addBox(boxes, spec.cx - 5.8, spec.cz - 2.8, 4.68, 1.78);
    // East Sky-Sanctuary Herbal Bar & Day-Lounges
    addBox(boxes, spec.cx + 18.8, spec.cz - 3.8, 3.64, 1.08);
    addBox(boxes, spec.cx + 14.0, spec.cz + 4.8, 2.4, 0.94);
    addBox(boxes, spec.cx + 19.2, spec.cz + 4.8, 2.4, 0.94);
    circles.push(
      { x: spec.cx + 16.6, z: spec.cz + 3.4, r: 0.62 },
      { x: spec.cx - 22.0, z: spec.cz + 6.0, r: 0.45 },
      { x: spec.cx + 22.2, z: spec.cz + 5.8, r: 0.45 },
      { x: spec.cx + 11.2, z: spec.cz + 5.8, r: 0.45 }
    );
  } else if (spec.id === 'bank' && lv === 1) {
    // Double-Height Rotunda Overlook Balustrades framing (+0.8..+6.8, -1.0..+5.0)
    addBox(boxes, spec.cx + 3.8, spec.cz - 1.0, 6.08, 0.16);
    addBox(boxes, spec.cx + 3.8, spec.cz + 5.0, 6.08, 0.16);
    addBox(boxes, spec.cx + 0.8, spec.cz + 2.0, 0.16, 6.08);
    addBox(boxes, spec.cx + 6.8, spec.cz + 2.0, 0.16, 6.08);
    // 2 Curved Acoustic Crescent Consultation Pods (dx -1.6 & +4.4, dz -5.4, open South entries)
    [-1.6, 4.4].forEach((podDx) => {
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * 0.12 + (i / 10) * Math.PI * 0.76;
        circles.push({
          x: spec.cx + podDx + Math.cos(a) * 2.35,
          z: spec.cz - 5.4 - Math.sin(a) * 2.35,
          r: 0.22,
        });
      }
      addBox(boxes, spec.cx + podDx, spec.cz - 5.6, 2.34, 1.04);
    });
    [-2.25, -0.95, 3.75, 5.05].forEach((ax) => circles.push({ x: spec.cx + ax, z: spec.cz - 4.1, r: 0.44 }));
    // SW East African Trade Corridor Table & South Diaspora Desk
    addBox(boxes, spec.cx - 6.2, spec.cz + 5.8, 2.98, 1.78);
    addBox(boxes, spec.cx - 2.2, spec.cz + 6.2, 2.44, 1.04);
    circles.push(
      { x: spec.cx + 9.2, z: spec.cz - 8.2, r: 0.45 },
      { x: spec.cx - 9.4, z: spec.cz - 8.2, r: 0.45 },
      { x: spec.cx + 9.2, z: spec.cz + 7.8, r: 0.45 }
    );
  } else if (spec.id === 'bank' && lv === 2) {
    // Center Sovereign Yield Totem Pillar & 4 Radial Horseshoe FX Dealing Consoles
    circles.push({ x: spec.cx + 3.2, z: spec.cz - 0.8, r: 0.72 });
    [-0.9, -0.3, 0.3, 0.9].forEach((a) => {
      addObb(
        obbs,
        spec.cx + 3.2 + Math.sin(a) * 3.45,
        spec.cz - 0.8 - Math.cos(a) * 3.45,
        2.18,
        1.08,
        -a
      );
    });
    // SW Quantitative Risk Strategist Desk
    addBox(boxes, spec.cx - 1.8, spec.cz + 5.8, 2.54, 1.08);
    circles.push(
      { x: spec.cx + 9.4, z: spec.cz - 8.2, r: 0.45 },
      { x: spec.cx - 9.4, z: spec.cz + 8.0, r: 0.45 }
    );
  } else if (spec.id === 'bank' && lv === 3) {
    // NE Circular Bullion Assay Rotunda (cx +4.4, cz -3.6, r 4.15m): 6 colonnade piers, North locker wall & assay table
    [0.2, 1.15, 2.25, 3.35, 4.35, 5.4].forEach((ang) => {
      circles.push({
        x: spec.cx + 4.4 + Math.cos(ang) * 4.15,
        z: spec.cz - 3.6 + Math.sin(ang) * 4.15,
        r: 0.38,
      });
    });
    addBox(boxes, spec.cx + 4.4, spec.cz - 9.0, 6.84, 0.56);
    circles.push({ x: spec.cx + 4.4, z: spec.cz - 3.6, r: 1.08 });
    // SE Private Wealth Parlor
    addBox(boxes, spec.cx + 10.0, spec.cz + 5.6, 0.62, 3.84);
    addBox(boxes, spec.cx + 0.8, spec.cz + 5.2, 2.44, 1.04);
    circles.push(
      { x: spec.cx + 5.6, z: spec.cz + 5.8, r: 0.52 },
      { x: spec.cx + 7.2, z: spec.cz + 7.2, r: 0.52 }
    );
    // West-Center Family Office Fiduciary Desks
    addBox(boxes, spec.cx - 2.2, spec.cz - 6.2, 2.34, 1.04);
    addBox(boxes, spec.cx - 2.2, spec.cz + 3.2, 2.34, 1.04);
    circles.push(
      { x: spec.cx - 9.4, z: spec.cz + 8.0, r: 0.45 },
      { x: spec.cx + 9.2, z: spec.cz - 8.2, r: 0.45 }
    );
  } else if (spec.id === 'bank' && lv === 4) {
    // Twin Open Clearing Consoles (dx +0.4 & +5.2, dz -4.2)
    addBox(boxes, spec.cx + 0.4, spec.cz - 4.2, 2.44, 1.08);
    addBox(boxes, spec.cx + 5.2, spec.cz - 4.2, 2.44, 1.08);
    // SE Audit Tribunal Table & Archive Cabinets
    addBox(boxes, spec.cx + 4.8, spec.cz + 5.4, 5.24, 1.84);
    addBox(boxes, spec.cx + 10.0, spec.cz + 5.4, 0.72, 3.84);
    // SW Operational Risk Desk
    addBox(boxes, spec.cx - 6.6, spec.cz + 5.8, 2.44, 1.04);
    circles.push(
      { x: spec.cx - 9.4, z: spec.cz + 8.0, r: 0.45 },
      { x: spec.cx + 9.2, z: spec.cz - 8.2, r: 0.45 }
    );
  } else if (spec.id === 'bank' && lv === 5) {
    // NE Diplomatic Boardroom Colonnade + North Acoustic Screen + Boardroom Table
    [-0.4, 6.8].forEach((px) => {
      [-7.4, -0.2].forEach((pz) => circles.push({ x: spec.cx + px, z: spec.cz + pz, r: 0.36 }));
    });
    addBox(boxes, spec.cx + 3.2, spec.cz - 8.8, 7.64, 0.24);
    addBox(boxes, spec.cx + 3.2, spec.cz - 3.8, 5.84, 2.04);
    // SW Governor / CEO Suite & Monetary Archive Credenza
    addBox(boxes, spec.cx - 10.0, spec.cz + 6.0, 0.62, 4.04);
    addBox(boxes, spec.cx - 5.8, spec.cz + 6.0, 2.84, 1.14);
    circles.push(
      { x: spec.cx - 2.2, z: spec.cz + 5.8, r: 0.56 },
      { x: spec.cx - 3.0, z: spec.cz + 5.8, r: 0.46 }
    );
    // SE CFO Desk & Ceremonial Kenyan Tea Credenza
    addBox(boxes, spec.cx + 6.4, spec.cz + 4.2, 1.04, 2.44);
    addBox(boxes, spec.cx + 6.6, spec.cz + 8.0, 3.48, 0.98);
    circles.push(
      { x: spec.cx - 9.2, z: spec.cz - 8.2, r: 0.45 },
      { x: spec.cx + 9.4, z: spec.cz + 8.0, r: 0.45 }
    );
  } else {
    // Upper floors: desks, shelf unit & 2 corner plants
    const deskXs = spec.w >= 30 ? [-10, 0, 10] : [-4.8, 4.8];
    deskXs.forEach((dx, di) => {
      const px = spec.cx + dx;
      const pz = spec.cz - spec.d * 0.12;
      addBox(boxes, px, pz, 2.44, 1.04);
      if (di === 0) {
        addBox(boxes, px - 2.1, spec.cz - spec.d * 0.42, 1.64, 0.46);
      }
    });
    circles.push(
      { x: spec.cx - spec.w * 0.42, z: spec.cz + spec.d * 0.34, r: 0.46 },
      { x: spec.cx + spec.w * 0.42, z: spec.cz + spec.d * 0.34, r: 0.46 }
    );
  }

  // Real Estate continuous G-L4 stairwell core colliders across every level (0..4)
  if (spec.id === 'realestate') {
    // Glazed stairwell shaft perimeter walls (West, North, South, East south-of-doorway)
    addBox(boxes, spec.cx - 12.28, spec.cz + 1.25, 0.16, 5.18);
    addBox(boxes, spec.cx - 10.73, spec.cz - 1.32, 3.14, 0.16);
    addBox(boxes, spec.cx - 10.73, spec.cz + 3.82, 3.14, 0.16);
    addBox(boxes, spec.cx - 9.18, spec.cz + 1.9, 0.16, 3.84);
    // Stairwell doorway gate: blocks autonomous NPC pathing while First-Person Walk passes freely
    addBox(boxes, spec.cx - 9.18, spec.cz - 0.63, 0.22, 1.22, undefined, true);
    // Center flight divider separating West (up) & East (arrival) lanes
    addBox(boxes, spec.cx - 10.71, spec.cz + 1.25, 0.12, 2.6);
    if (lv === 0) {
      // Ground-floor under-stair screen across East lane
      addBox(boxes, spec.cx - 9.96, spec.cz - 0.05, 1.48, 0.14);
    } else if (lv === spec.floors - 1) {
      // Top floor (L4) safety balustrade guarding the open West shaft drop
      addBox(boxes, spec.cx - 11.46, spec.cz - 0.05, 1.5, 0.14);
      addBox(boxes, spec.cx - 10.71, spec.cz + 3.15, 0.12, 1.2);
    }
  }

  // Skyline Travel & Aviation continuous G-L3 East Boarding Stairwell core colliders (0..3)
  if (spec.id === 'travel') {
    // Glazed stairwell shaft perimeter walls (East, North, South, West south-of-doorway)
    addBox(boxes, spec.cx + 13.32, spec.cz + 1.25, 0.16, 5.18);
    addBox(boxes, spec.cx + 11.77, spec.cz - 1.32, 3.14, 0.16);
    addBox(boxes, spec.cx + 11.77, spec.cz + 3.82, 3.14, 0.16);
    addBox(boxes, spec.cx + 10.22, spec.cz + 1.9, 0.16, 3.84);
    // Doorway gate: blocks autonomous NPCs while First-Person Walk passes freely
    addBox(boxes, spec.cx + 10.22, spec.cz - 0.63, 0.22, 1.22, undefined, true);
    // Center flight divider separating East (up) & West (arrival) lanes
    addBox(boxes, spec.cx + 11.75, spec.cz + 1.25, 0.12, 2.6);
    if (lv === 0) {
      // Ground-floor under-stair glass guard across West arrival lane
      addBox(boxes, spec.cx + 10.98, spec.cz - 0.05, 1.48, 0.14);
    } else if (lv === spec.floors - 1) {
      // Top floor (L3) safety balustrade guarding open East shaft drop
      addBox(boxes, spec.cx + 12.5, spec.cz - 0.05, 1.5, 0.14);
      addBox(boxes, spec.cx + 11.75, spec.cz + 3.15, 0.12, 1.2);
    }
  }

  // Kenya Safari & Tourism continuous G-L3 SE Acacia & Bronze Stairwell core colliders (0..3)
  if (spec.id === 'tourism') {
    // Glazed stairwell shaft perimeter walls (East, North, South, West south-of-doorway)
    addBox(boxes, spec.cx + 14.32, spec.cz + 5.4, 0.16, 5.24);
    addBox(boxes, spec.cx + 12.76, spec.cz + 2.8, 3.16, 0.16);
    addBox(boxes, spec.cx + 12.76, spec.cz + 8.0, 3.16, 0.16);
    addBox(boxes, spec.cx + 11.2, spec.cz + 6.06, 0.16, 3.88);
    // Doorway gate: blocks autonomous NPCs while First-Person Walk passes freely
    addBox(boxes, spec.cx + 11.2, spec.cz + 3.49, 0.22, 1.26, undefined, true);
    // Center flight divider separating East (up) & West (arrival) lanes
    addBox(boxes, spec.cx + 12.75, spec.cz + 5.45, 0.12, 2.6);
    if (lv === 0) {
      // Ground-floor under-stair screen across West arrival lane
      addBox(boxes, spec.cx + 11.98, spec.cz + 4.15, 1.48, 0.14);
    } else if (lv === spec.floors - 1) {
      // Top floor (L3) safety balustrade guarding open East shaft drop
      addBox(boxes, spec.cx + 13.52, spec.cz + 4.15, 1.5, 0.14);
      addBox(boxes, spec.cx + 12.75, spec.cz + 7.35, 0.12, 1.2);
    }
  }

  // SwiftPort Cargo & Logistics continuous G-L3 SW Steel-Mesh & Birch Stairwell core colliders (0..3)
  if (spec.id === 'logistics') {
    // Glazed & galvanized stairwell shaft perimeter walls (West, North, South, East south-of-doorway)
    addBox(boxes, spec.cx - 14.35, spec.cz + 5.4, 0.16, 5.24);
    addBox(boxes, spec.cx - 12.8, spec.cz + 2.8, 3.14, 0.16);
    addBox(boxes, spec.cx - 12.8, spec.cz + 8.0, 3.14, 0.16);
    addBox(boxes, spec.cx - 11.25, spec.cz + 6.06, 0.16, 3.88);
    // Doorway gate: blocks autonomous NPCs while First-Person Walk passes freely
    addBox(boxes, spec.cx - 11.25, spec.cz + 3.49, 0.22, 1.26, undefined, true);
    // Center flight divider separating West (up) & East (arrival) lanes
    addBox(boxes, spec.cx - 12.8, spec.cz + 5.45, 0.12, 2.6);
    if (lv === 0) {
      // Ground-floor under-stair screen across East arrival lane
      addBox(boxes, spec.cx - 12.03, spec.cz + 4.15, 1.48, 0.14);
    } else if (lv === spec.floors - 1) {
      // Top floor (L3) safety balustrade guarding open West shaft drop
      addBox(boxes, spec.cx - 13.57, spec.cz + 4.15, 1.5, 0.14);
      addBox(boxes, spec.cx - 12.8, spec.cz + 7.35, 0.12, 1.2);
    }
  }

  // Savanna Bistro & Grill continuous G-L3 SW Iron & Copper Stairwell core colliders (0..3)
  if (spec.id === 'restaurant') {
    // Amber-glass & iron shaft perimeter walls (West, North, South, East south-of-doorway)
    addBox(boxes, spec.cx - 9.55, spec.cz + 4.1, 0.16, 5.24);
    addBox(boxes, spec.cx - 8.0, spec.cz + 1.5, 3.14, 0.16);
    addBox(boxes, spec.cx - 8.0, spec.cz + 6.7, 3.14, 0.16);
    addBox(boxes, spec.cx - 6.45, spec.cz + 4.76, 0.16, 3.88);
    // Doorway gate: blocks autonomous NPCs while First-Person Walk passes freely
    addBox(boxes, spec.cx - 6.45, spec.cz + 2.19, 0.22, 1.26, undefined, true);
    // Center flight divider separating West (up) & East (arrival) lanes
    addBox(boxes, spec.cx - 8.0, spec.cz + 4.15, 0.12, 2.6);
    if (lv === 0) {
      // Ground-floor under-stair screen across East arrival lane
      addBox(boxes, spec.cx - 7.23, spec.cz + 2.85, 1.48, 0.14);
    } else if (lv === spec.floors - 1) {
      // Top floor (L3) safety balustrade guarding open West shaft drop
      addBox(boxes, spec.cx - 8.77, spec.cz + 2.85, 1.5, 0.14);
      addBox(boxes, spec.cx - 8.0, spec.cz + 6.05, 0.12, 1.2);
    }
  }

  // VitalCare Medical & Pharmacy continuous 5-Story C-Wrap Biophilic Stairwell & Bamboo Lightwell Colliders (0..4)
  if (spec.id === 'medical') {
    // North, East, South atrium void balustrades (dx +3.20..+8.80, dz -6.80..-0.60)
    addBox(boxes, spec.cx + 6.0, spec.cz - 6.8, 5.68, 0.14);
    addBox(boxes, spec.cx + 8.8, spec.cz - 3.7, 0.14, 6.28);
    addBox(boxes, spec.cx + 6.0, spec.cz - 0.6, 5.68, 0.14);
    // Inner 5-Story Living Bamboo & Moss Lightwell Core (solid on all 5 floors)
    addBox(boxes, spec.cx + 6.0, spec.cz - 3.7, 2.34, 2.94);
    // West Center Moss Guardrail (dz -5.15..-2.25)
    addBox(boxes, spec.cx + 3.2, spec.cz - 3.7, 0.14, 2.94);
    // West SW Ascent Threshold (dx +3.20, dz -2.25..-0.60): stairwellGate on lv < 4, solid on L4
    addBox(boxes, spec.cx + 3.2, spec.cz - 1.425, 0.22, 1.65, undefined, lv < spec.floors - 1);
    // West NW Arrival Threshold (dx +3.20, dz -6.80..-5.15): solid under-stair screen on G, stairwellGate on L1..L4
    addBox(boxes, spec.cx + 3.2, spec.cz - 5.975, 0.22, 1.65, undefined, lv >= 1);
  }

  // Nairobi Trust Bank continuous 6-Story West Reserve Stairwell & Light-Loom Spine Colliders (0..5)
  if (spec.id === 'bank') {
    // East shaft balustrade (dx -5.00) & North drop-guard balustrade (dz -6.50)
    addBox(boxes, spec.cx - 5.0, spec.cz - 2.5, 0.16, 8.08);
    addBox(boxes, spec.cx - 7.75, spec.cz - 6.5, 5.56, 0.16);
    // Center 6-story Makore & Bronze Light-Loom Spine separating East (up) & West (arrival) flights
    addBox(boxes, spec.cx - 7.75, spec.cz - 1.38, 0.18, 5.78);
    // South East-Lane Ascent Mouth (dz +1.50, dx -7.75..-5.00): stairwellGate on G..L4, solid safety glass on L5
    addBox(boxes, spec.cx - 6.38, spec.cz + 1.5, 2.66, 0.22, undefined, lv < spec.floors - 1);
    // South West-Lane Arrival Mouth (dz +1.50, dx -10.50..-7.75): solid relief wall on G, stairwellGate on L1..L5
    addBox(boxes, spec.cx - 9.12, spec.cz + 1.5, 2.68, 0.22, undefined, lv >= 1);
  }
}

function buildDistrictBuildingColliders(buildingId: BuildingId, lv: number): FloorColliderSet {
  const spec = DISTRICT_BUILDING_MAP[buildingId];
  const boxes: BoxObstacle[] = [];
  const obbs: ObbObstacle[] = [];
  const circles: CircleObstacle[] = [];

  populateDistrictBuildingGeometry(spec, lv, boxes, obbs, circles);

  const hw = spec.w * 0.5;
  const hd = spec.d * 0.5;
  const apronFront = lv === 0 ? 4.4 : -0.28;
  const minX = spec.cx - hw + (lv === 0 ? -1.2 : 0.28);
  const maxX = spec.cx + hw + (lv === 0 ? 1.2 : -0.28);
  const minZ = spec.cz - hd + (spec.doorSide === 'north' && lv === 0 ? -apronFront : 0.28);
  const maxZ = spec.cz + hd + (spec.doorSide === 'south' && lv === 0 ? apronFront : -0.28);

  return { boxes, obbs, circles, minX, maxX, minZ, maxZ };
}

export function getDistrictFloorColliders(buildingId: BuildingId, lv: number): FloorColliderSet {
  const key = `${buildingId}:${lv}`;
  let set = DISTRICT_FLOOR_CACHE.get(key);
  if (!set) {
    set = buildDistrictBuildingColliders(buildingId, lv);
    DISTRICT_FLOOR_CACHE.set(key, set);
  }
  return set;
}

function getAllGroundChairsForDistrictWalk(): TrackedChairCollider[] {
  const merged: TrackedChairCollider[] = [];
  const hubGround = CHAIR_COLLIDERS_BY_FLOOR.get(0);
  if (hubGround) merged.push(...hubGround);
  for (const spec of DISTRICT_BUILDINGS) {
    if (spec.id === 'hub') continue;
    const ch = DISTRICT_CHAIRS_BY_FLOOR.get(`${spec.id}:0`);
    if (ch) merged.push(...ch);
  }
  return merged;
}

function getDistrictWalkColliders(): FloorColliderSet {
  if (DISTRICT_WALK_CACHE) return DISTRICT_WALK_CACHE;
  const hubCol = getFloorColliders(0);
  const boxes: BoxObstacle[] = [...hubCol.boxes];
  const obbs: ObbObstacle[] = [...hubCol.obbs];
  const circles: CircleObstacle[] = [...hubCol.circles];

  // Add DomainTechHub outer perimeter walls (front stairs x = -14.8..14.8 stay open)
  boxes.push(
    { minX: -30.1, maxX: 30.1, minZ: -0.25, maxZ: 0.45 },
    { minX: -30.1, maxX: -29.55, minZ: 0.0, maxZ: 11.1 },
    { minX: 29.55, maxX: 30.1, minZ: 0.0, maxZ: 11.1 }
  );

  // Add street bollards at z = 55.5 outside center gap
  for (let x = -21; x <= 21; x += 3) {
    if (Math.abs(x) < 4) continue;
    circles.push({ x, z: 55.5, r: 0.16 });
  }

  // Merge all 8 district niche buildings' ground walls & interiors
  for (const spec of DISTRICT_BUILDINGS) {
    if (spec.id === 'hub') continue;
    populateDistrictBuildingGeometry(spec, 0, boxes, obbs, circles);
  }

  DISTRICT_WALK_CACHE = {
    boxes,
    obbs,
    circles,
    minX: -164.0,
    maxX: 164.0,
    minZ: -38.0,
    maxZ: 106.0,
    curvedCounter: hubCol.curvedCounter,
  };
  return DISTRICT_WALK_CACHE;
}

function resolveWithColliderSet(
  col: FloorColliderSet,
  chairs: TrackedChairCollider[] | undefined,
  x: number,
  z: number,
  options?: ResolveObstacleOptions
): { x: number; z: number; blocked: boolean } {
  const r = options?.radius ?? CHAR_RADIUS;
  let nx = Math.max(col.minX, Math.min(col.maxX, x));
  let nz = Math.max(col.minZ, Math.min(col.maxZ, z));
  let blocked = nx !== x || nz !== z;

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < col.boxes.length; i++) {
      const b = col.boxes[i];
      if (b.stairwellGate && options?.allowStairwell) {
        continue;
      }
      const exMinX = b.minX - r;
      const exMaxX = b.maxX + r;
      const exMinZ = b.minZ - r;
      const exMaxZ = b.maxZ + r;
      if (nx > exMinX && nx < exMaxX && nz > exMinZ && nz < exMaxZ) {
        const dLeft = nx - exMinX;
        const dRight = exMaxX - nx;
        const dBack = nz - exMinZ;
        const dFront = exMaxZ - nz;
        const m = Math.min(dLeft, dRight, dBack, dFront);
        if (m === dLeft) nx = exMinX;
        else if (m === dRight) nx = exMaxX;
        else if (m === dBack) nz = exMinZ;
        else nz = exMaxZ;
        blocked = true;
      }
    }

    for (let i = 0; i < col.obbs.length; i++) {
      const res = pushOutObb(nx, nz, r, col.obbs[i]);
      if (res.hit) {
        nx = res.x;
        nz = res.z;
        blocked = true;
      }
    }

    for (let i = 0; i < col.circles.length; i++) {
      const c = col.circles[i];
      const minD = c.r + r;
      const dx = nx - c.x;
      const dz = nz - c.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minD * minD) {
        const d = Math.sqrt(dSq);
        if (d > 0.0005) {
          nx = c.x + (dx / d) * minD;
          nz = c.z + (dz / d) * minD;
        } else {
          nz = c.z + minD;
        }
        blocked = true;
      }
    }

    if (chairs) {
      for (let i = 0; i < chairs.length; i++) {
        const ch = chairs[i];
        if (ch === options?.ignoreChair) continue;
        const minD = ch.r + r;
        const dx = nx - ch.curX;
        const dz = nz - ch.curZ;
        const dSq = dx * dx + dz * dz;
        if (dSq < minD * minD) {
          const d = Math.sqrt(dSq);
          if (d > 0.0005) {
            nx = ch.curX + (dx / d) * minD;
            nz = ch.curZ + (dz / d) * minD;
          } else {
            nz = ch.curZ + minD;
          }
          blocked = true;
        }
      }
    }
  }

  nx = Math.max(col.minX, Math.min(col.maxX, nx));
  nz = Math.max(col.minZ, Math.min(col.maxZ, nz));
  return { x: nx, z: nz, blocked };
}

export function resolveDistrictObstacle(
  buildingId: BuildingId,
  lv: number,
  x: number,
  z: number,
  options?: ResolveObstacleOptions
): { x: number; z: number; blocked: boolean } {
  if (buildingId === 'hub') {
    return resolveObstaclePosition(lv, x, z, options);
  }
  const col = getDistrictFloorColliders(buildingId, lv);
  const chairs = DISTRICT_CHAIRS_BY_FLOOR.get(`${buildingId}:${lv}`);
  return resolveWithColliderSet(col, chairs, x, z, options);
}

export function getDistrictChairDockPoint(
  buildingId: BuildingId,
  lv: number,
  homeX: number,
  homeZ: number,
  swivelDir = 1
): { x: number; z: number } | null {
  if (buildingId === 'hub') return getChairDockPoint(lv, homeX, homeZ, swivelDir);
  const spec = DISTRICT_BUILDING_MAP[buildingId];
  const chairs = DISTRICT_CHAIRS_BY_FLOOR.get(`${buildingId}:${lv}`);
  const isRegisteredChair = chairs?.some((c) => Math.hypot(c.restX - homeX, c.restZ - homeZ) < 0.25);
  if (!isRegisteredChair) return null;

  const dir = swivelDir >= 0 ? 1 : -1;
  // Dining chairs sit beside round tables at tx ± 1.1 -> step out perpendicular in Z
  if (buildingId === 'restaurant' && lv === 0 && homeZ < spec.cz + 5.8 && homeZ > spec.cz - 2.4) {
    const cand = { x: homeX, z: homeZ + dir * 0.68 };
    const chk = resolveDistrictObstacle(buildingId, lv, cand.x, cand.z, { radius: 0.2 });
    return !chk.blocked ? cand : { x: homeX, z: homeZ - dir * 0.68 };
  }
  // Standard desk/counter chairs -> step out laterally in X
  const cand = { x: homeX + dir * 0.66, z: homeZ };
  const chk = resolveDistrictObstacle(buildingId, lv, cand.x, cand.z, { radius: 0.2 });
  if (!chk.blocked) return cand;
  return { x: homeX - dir * 0.66, z: homeZ };
}

function hasDistrictLineOfSight(
  buildingId: BuildingId,
  lv: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  options?: ResolveObstacleOptions
): boolean {
  const dist = Math.hypot(x1 - x0, z1 - z0);
  if (dist < 0.04) return true;
  const steps = Math.ceil(dist / 0.08);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + (x1 - x0) * t;
    const pz = z0 + (z1 - z0) * t;
    const res = resolveDistrictObstacle(buildingId, lv, px, pz, options);
    if (res.blocked) return false;
  }
  return true;
}

function getDistrictStaticGrid(buildingId: BuildingId, lv: number): StaticFloorGrid {
  const key = `${buildingId}:${lv}`;
  let g = DISTRICT_STATIC_GRIDS.get(key);
  if (g) return g;

  const col = getDistrictFloorColliders(buildingId, lv);
  const cols = Math.ceil((col.maxX - col.minX) / GRID_CELL);
  const rows = Math.ceil((col.maxZ - col.minZ) / GRID_CELL);
  const blocked = new Uint8Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    const wz = col.minZ + (r + 0.5) * GRID_CELL;
    for (let c = 0; c < cols; c++) {
      const wx = col.minX + (c + 0.5) * GRID_CELL;
      const res = resolveWithColliderSet(col, undefined, wx, wz, { radius: CHAR_RADIUS });
      blocked[r * cols + c] = res.blocked ? 1 : 0;
    }
  }

  g = { minX: col.minX, minZ: col.minZ, cols, rows, blocked };
  DISTRICT_STATIC_GRIDS.set(key, g);
  return g;
}

function isDistrictCellPassable(
  buildingId: BuildingId,
  lv: number,
  grid: StaticFloorGrid,
  c: number,
  r: number,
  ignoreChair?: TrackedChairCollider
): boolean {
  if (c < 0 || c >= grid.cols || r < 0 || r >= grid.rows) return false;
  if (grid.blocked[r * grid.cols + c]) return false;

  const chairs = DISTRICT_CHAIRS_BY_FLOOR.get(`${buildingId}:${lv}`);
  if (chairs && chairs.length > 0) {
    const wx = grid.minX + (c + 0.5) * GRID_CELL;
    const wz = grid.minZ + (r + 0.5) * GRID_CELL;
    for (let i = 0; i < chairs.length; i++) {
      const ch = chairs[i];
      if (ch === ignoreChair) continue;
      const minD = ch.r + CHAR_RADIUS;
      const dx = wx - ch.curX;
      const dz = wz - ch.curZ;
      if (dx * dx + dz * dz < minD * minD) return false;
    }
  }
  return true;
}

function findNearestDistrictPassableCell(
  buildingId: BuildingId,
  lv: number,
  grid: StaticFloorGrid,
  wx: number,
  wz: number,
  ignoreChair?: TrackedChairCollider
): { c: number; r: number } | null {
  const c0 = Math.max(0, Math.min(grid.cols - 1, Math.floor((wx - grid.minX) / GRID_CELL)));
  const r0 = Math.max(0, Math.min(grid.rows - 1, Math.floor((wz - grid.minZ) / GRID_CELL)));
  if (isDistrictCellPassable(buildingId, lv, grid, c0, r0, ignoreChair)) return { c: c0, r: r0 };

  let bestC = -1;
  let bestR = -1;
  let bestDist = Infinity;
  for (let rad = 1; rad <= 8; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
        const nc = c0 + dc;
        const nr = r0 + dr;
        if (!isDistrictCellPassable(buildingId, lv, grid, nc, nr, ignoreChair)) continue;
        const cx = grid.minX + (nc + 0.5) * GRID_CELL;
        const cz = grid.minZ + (nr + 0.5) * GRID_CELL;
        const d = Math.hypot(cx - wx, cz - wz);
        if (d < bestDist) {
          bestDist = d;
          bestC = nc;
          bestR = nr;
        }
      }
    }
    if (bestC >= 0) return { c: bestC, r: bestR };
  }
  return null;
}

export function buildDistrictPath(
  buildingId: BuildingId,
  lv: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  options?: { ignoreChair?: TrackedChairCollider }
): Array<{ x: number; z: number }> {
  if (buildingId === 'hub') {
    return buildObstacleAwarePath(lv, fromX, fromZ, toX, toZ, options);
  }
  const losOpts: ResolveObstacleOptions = { ignoreChair: options?.ignoreChair };
  const safeDest = resolveDistrictObstacle(buildingId, lv, toX, toZ, losOpts);
  const dx = safeDest.x;
  const dz = safeDest.z;

  if (Math.hypot(dx - fromX, dz - fromZ) < 0.08) {
    return [{ x: dx, z: dz }];
  }
  if (hasDistrictLineOfSight(buildingId, lv, fromX, fromZ, dx, dz, losOpts)) {
    return [{ x: dx, z: dz }];
  }

  const grid = getDistrictStaticGrid(buildingId, lv);
  const start = findNearestDistrictPassableCell(buildingId, lv, grid, fromX, fromZ, options?.ignoreChair);
  const goal = findNearestDistrictPassableCell(buildingId, lv, grid, dx, dz, options?.ignoreChair);
  if (!start || !goal || grid.cols * grid.rows > 32768) {
    return [{ x: dx, z: dz }];
  }

  const startIdx = start.r * grid.cols + start.c;
  const goalIdx = goal.r * grid.cols + goal.c;
  const runId = ++aStarRunId;
  heapLen = 0;

  A_GSCORE[startIdx] = 0;
  A_PARENT[startIdx] = -1;
  A_INHEAP[startIdx] = runId;
  heapPush(startIdx, Math.hypot(goal.c - start.c, goal.r - start.r));

  let found = false;
  while (heapLen > 0) {
    const cur = heapPop();
    if (cur === goalIdx) {
      found = true;
      break;
    }
    if (A_CLOSED[cur] === runId) continue;
    A_CLOSED[cur] = runId;

    const cc = cur % grid.cols;
    const cr = (cur / grid.cols) | 0;
    const gCur = A_GSCORE[cur];

    for (let k = 0; k < 8; k++) {
      const [dc, dr, cost] = NEIGHBORS[k];
      const nc = cc + dc;
      const nr = cr + dr;
      if (!isDistrictCellPassable(buildingId, lv, grid, nc, nr, options?.ignoreChair)) continue;
      if (dc !== 0 && dr !== 0) {
        if (
          !isDistrictCellPassable(buildingId, lv, grid, cc + dc, cr, options?.ignoreChair) ||
          !isDistrictCellPassable(buildingId, lv, grid, cc, cr + dr, options?.ignoreChair)
        ) {
          continue;
        }
      }
      const nIdx = nr * grid.cols + nc;
      if (A_CLOSED[nIdx] === runId) continue;
      const candG = gCur + cost;
      if (A_INHEAP[nIdx] !== runId || candG < A_GSCORE[nIdx]) {
        A_GSCORE[nIdx] = candG;
        A_PARENT[nIdx] = cur;
        A_INHEAP[nIdx] = runId;
        const h = Math.hypot(goal.c - nc, goal.r - nr);
        heapPush(nIdx, candG + h * 1.001);
      }
    }
  }

  if (!found) {
    return [{ x: dx, z: dz }];
  }

  const raw: Array<{ x: number; z: number }> = [];
  let trace = goalIdx;
  while (trace !== -1 && trace !== startIdx) {
    const tc = trace % grid.cols;
    const tr = (trace / grid.cols) | 0;
    raw.push({
      x: grid.minX + (tc + 0.5) * GRID_CELL,
      z: grid.minZ + (tr + 0.5) * GRID_CELL,
    });
    trace = A_PARENT[trace];
  }
  raw.reverse();
  if (raw.length > 0) {
    raw[raw.length - 1] = { x: dx, z: dz };
  } else {
    raw.push({ x: dx, z: dz });
  }

  const smoothed: Array<{ x: number; z: number }> = [];
  let anchorX = fromX;
  let anchorZ = fromZ;
  let i = 0;
  while (i < raw.length) {
    let farthest = i;
    for (let j = raw.length - 1; j > i; j--) {
      if (hasDistrictLineOfSight(buildingId, lv, anchorX, anchorZ, raw[j].x, raw[j].z, losOpts)) {
        farthest = j;
        break;
      }
    }
    const chosen = raw[farthest];
    smoothed.push(chosen);
    anchorX = chosen.x;
    anchorZ = chosen.z;
    i = farthest + 1;
  }

  return smoothed;
}

