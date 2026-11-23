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

function addBox(list: BoxObstacle[], cx: number, cz: number, w: number, d: number, liftDoorSide?: -1 | 1) {
  list.push({
    minX: cx - w * 0.5,
    maxX: cx + w * 0.5,
    minZ: cz - d * 0.5,
    maxZ: cz + d * 0.5,
    liftDoorSide,
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
      // Kitchen pass counter
      addBox(boxes, spec.cx - 2.2, spec.cz - 7.0, 9.8, 1.34);
      // Brick pizza oven
      circles.push({ x: spec.cx - 8.2, z: spec.cz - 7.8, r: 1.38 });
      // Espresso & cocktail bar
      addBox(boxes, spec.cx + 8.6, spec.cz - 2.2, 1.28, 6.84);
      // 4 indoor dining tables
      circles.push(
        { x: spec.cx - 5.2, z: spec.cz + 0.2, r: 0.75 },
        { x: spec.cx + 2.6, z: spec.cz + 0.2, r: 0.75 },
        { x: spec.cx - 5.2, z: spec.cz + 4.8, r: 0.75 },
        { x: spec.cx + 2.6, z: spec.cz + 4.8, r: 0.75 }
      );
      // Host desk
      addBox(boxes, spec.cx + 5.2, spec.cz + 6.4, 1.54, 0.9);
      // Outdoor terrace bistro tables
      circles.push(
        { x: spec.cx - 5.2, z: spec.cz + 12.1, r: 0.58 },
        { x: spec.cx + 5.2, z: spec.cz + 12.1, r: 0.58 }
      );
    } else if (spec.id === 'dealership') {
      // Center rotating turntable
      circles.push({ x: spec.cx, z: spec.cz + 0.4, r: 3.3 });
      // Flanking display vehicles
      addObb(obbs, spec.cx - 6.0, spec.cz + 2.0, 1.98, 4.5, 0.42);
      addObb(obbs, spec.cx + 6.0, spec.cz + 2.0, 1.98, 4.1, -0.42);
      // 2 sales desks
      addBox(boxes, spec.cx - 5.8, spec.cz - 5.5, 2.34, 1.08);
      addBox(boxes, spec.cx + 5.8, spec.cz - 5.5, 2.34, 1.08);
    } else if (spec.id === 'bank') {
      // 4 exterior portico columns
      [-3.8, -1.9, 1.9, 3.8].forEach((ox) => {
        circles.push({ x: spec.doorX + ox, z: spec.doorZ + 1.4, r: 0.42 });
      });
      // 3 ATM kiosks
      [-8.5, -6.5, -4.5].forEach((ox) => {
        addBox(boxes, spec.cx + ox, spec.cz + 6.2, 0.96, 0.94);
      });
      // Teller counter
      addBox(boxes, spec.cx - 2.4, spec.cz - 3.6, 9.4, 1.34);
      // Rear vault assembly
      addBox(boxes, spec.cx + 6.2, spec.cz - 9.35, 3.65, 0.95);
      // Customer waiting sofa (rotY = -PI/2)
      addBox(boxes, spec.cx + 6.4, spec.cz + 3.2, 1.14, 2.88);
    } else if (spec.id === 'crypto') {
      // Cold-storage vault pod
      addBox(boxes, spec.cx, spec.cz - 4.8, 4.45, 3.45);
      // 4 quant trading pods
      [
        [spec.cx - 6.6, spec.cz + 1.8],
        [spec.cx + 6.6, spec.cz + 1.8],
        [spec.cx - 6.6, spec.cz - 3.6],
        [spec.cx + 6.6, spec.cz - 3.6],
      ].forEach(([px, pz]) => addBox(boxes, px, pz, 2.64, 1.14));
    } else if (spec.id === 'travel') {
      // Rotating globe plinth
      circles.push({ x: spec.cx, z: spec.cz - 2.0, r: 1.22 });
      // Check-in counter
      addBox(boxes, spec.cx - 6.8, spec.cz + 3.2, 8.8, 1.32);
      // Terminal waiting sofas
      addBox(boxes, spec.cx + 7.2, spec.cz + 1.5, 2.88, 1.14);
      addBox(boxes, spec.cx + 7.2, spec.cz - 1.5, 2.88, 1.14);
    } else if (spec.id === 'tourism') {
      // Relief map table
      addBox(boxes, spec.cx - 5.8, spec.cz - 0.8, 4.44, 2.84);
      // Safari 4x4 Jeep plinth
      circles.push({ x: spec.cx + 7.2, z: spec.cz - 1.0, r: 2.95 });
      // 2 Safari planner desks
      addBox(boxes, spec.cx - 5.5, spec.cz + 5.2, 2.54, 1.08);
      addBox(boxes, spec.cx + 5.5, spec.cz + 5.2, 2.54, 1.08);
    } else if (spec.id === 'medical') {
      // Pharmacy counter & medicine racks
      addBox(boxes, spec.cx - 14.5, spec.cz - 2.2, 10.4, 1.3);
      addBox(boxes, spec.cx - 14.5, spec.cz - 7.1, 10.45, 0.56);
      // Central triage desk
      addBox(boxes, spec.cx, spec.cz - 1.2, 4.65, 1.14);
      // 2 diagnostic consult desks
      addBox(boxes, spec.cx + 10.5, spec.cz - 2.6, 2.44, 1.08);
      addBox(boxes, spec.cx + 17.5, spec.cz - 2.6, 2.44, 1.08);
      // 2 waiting armchairs
      addBox(boxes, spec.cx - 6.5, spec.cz + 3.2, 1.18, 1.18);
      addBox(boxes, spec.cx + 6.5, spec.cz + 3.2, 1.18, 1.18);
    } else if (spec.id === 'logistics') {
      // Parcel sorting conveyor belt
      addBox(boxes, spec.cx - 4.2, spec.cz + 1.2, 1.65, 9.8);
      // West pallet storage racks
      addBox(boxes, spec.cx - 12.2, spec.cz - 3.0, 2.8, 3.8);
      addBox(boxes, spec.cx - 12.2, spec.cz + 3.2, 2.8, 3.8);
      // Dispatch & Customs counter
      addBox(boxes, spec.cx + 5.8, spec.cz + 2.5, 6.6, 1.32);
      // East loading bay interior staging pallets
      addBox(boxes, spec.cx + 12.6, spec.cz - 3.5, 1.6, 1.7);
      addBox(boxes, spec.cx + 12.6, spec.cz + 3.5, 1.6, 1.7);
    } else if (spec.id === 'realestate') {
      // Outdoor West construction & material staging yard
      addBox(boxes, spec.cx - 16.2, spec.cz, 3.6, 7.4);
      // 3D masterplan scale-model table
      addBox(boxes, spec.cx - 6.8, spec.cz - 0.8, 4.34, 2.74);
      // Real Estate Broker desk
      addBox(boxes, spec.cx - 6.8, spec.cz + 5.2, 2.54, 1.08);
      // Central bi-level reception desk
      addBox(boxes, spec.cx + 0.2, spec.cz + 3.2, 4.9, 1.32);
      // Reception lounge armchairs
      addBox(boxes, spec.cx - 1.4, spec.cz - 2.6, 1.18, 1.18);
      addBox(boxes, spec.cx + 1.8, spec.cz - 2.6, 1.18, 1.18);
      // Construction CAD desk
      addBox(boxes, spec.cx + 7.4, spec.cz + 5.2, 2.54, 1.08);
      // Interior design material rack, sofa & coffee table
      addBox(boxes, spec.cx + 7.4, spec.cz - 5.2, 3.66, 0.56);
      addBox(boxes, spec.cx + 7.4, spec.cz - 1.6, 2.88, 1.14);
      addBox(boxes, spec.cx + 7.4, spec.cz - 0.3, 1.64, 0.88);
    }
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
    minX: -106.0,
    maxX: 106.0,
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
  // Dining chairs sit beside round tables at tx ± 1.15 -> step out perpendicular in Z
  if (buildingId === 'restaurant' && lv === 0 && homeZ < spec.cz + 5.8 && homeZ > spec.cz - 1.5) {
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

