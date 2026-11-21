import { COLX, ROOMS } from './constants';

export interface BoxObstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CircleObstacle {
  x: number;
  z: number;
  r: number;
}

export interface FloorColliderSet {
  boxes: BoxObstacle[];
  circles: CircleObstacle[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  curvedCounter?: { cx: number; cz: number; rIn: number; rOut: number; halfX: number; minZ: number };
}

const CHAR_RADIUS = 0.24;
const FLOOR_CACHE = new Map<number, FloorColliderSet>();

function addBox(list: BoxObstacle[], cx: number, cz: number, w: number, d: number) {
  list.push({
    minX: cx - w * 0.5,
    maxX: cx + w * 0.5,
    minZ: cz - d * 0.5,
    maxZ: cz + d * 0.5,
  });
}

function buildCollidersForLevel(lv: number): FloorColliderSet {
  const boxes: BoxObstacle[] = [];
  const circles: CircleObstacle[] = [];

  if (lv === -1) {
    // B1 · Server Room
    addBox(boxes, -8.55, 3.1, 7.6, 0.96);
    addBox(boxes, -8.55, 5.6, 7.6, 0.96);
    addBox(boxes, 5.65, 3.1, 7.6, 0.96);
    addBox(boxes, 5.65, 5.6, 7.6, 0.96);
    [-6.5, -2.5, 1.5].forEach((x) => addBox(boxes, x, 1.0, 1.52, 0.94));
    circles.push({ x: -12.9, z: 7.8, r: 0.22 }, { x: -12.3, z: 7.8, r: 0.22 });
    // Glazed lift security vestibule enclosures & shafts
    boxes.push(
      { minX: -19.6, maxX: -15.5, minZ: 8.9, maxZ: 11.1 },
      { minX: 15.5, maxX: 19.6, minZ: 8.9, maxZ: 11.1 },
      { minX: -17.6, maxX: -15.48, minZ: 6.94, maxZ: 7.14 },
      { minX: 15.48, maxX: 17.6, minZ: 6.94, maxZ: 7.14 }
    );
    return { boxes, circles, minX: -19.2, maxX: 19.2, minZ: 0.72, maxZ: 10.15 };
  }

  if (lv === -2) {
    // B2 · Power Room
    boxes.push({ minX: -10.25, maxX: -2.2, minZ: 0.55, maxZ: 1.48 });
    boxes.push({ minX: 0.75, maxX: 4.85, minZ: 0.6, maxZ: 1.45 });
    [4.9, 6.9, 8.7].forEach((z) => boxes.push({ minX: -6.82, maxX: -0.58, minZ: z - 0.44, maxZ: z + 0.44 }));
    addBox(boxes, 2.2, 8.9, 1.55, 0.74);
    boxes.push({ minX: 7.95, maxX: 10.45, minZ: 2.6, maxZ: 4.25 });
    circles.push({ x: 18, z: 0.5, r: 0.25 });
    boxes.push(
      { minX: -19.6, maxX: -15.5, minZ: 8.9, maxZ: 11.1 },
      { minX: 15.5, maxX: 19.6, minZ: 8.9, maxZ: 11.1 },
      { minX: -17.6, maxX: -15.48, minZ: 6.94, maxZ: 7.14 },
      { minX: 15.48, maxX: 17.6, minZ: 6.94, maxZ: 7.14 }
    );
    return { boxes, circles, minX: -19.2, maxX: 19.2, minZ: 0.72, maxZ: 10.15 };
  }

  // Above-ground levels (0..5): Lift shaft enclosures at east & west ends
  boxes.push(
    { minX: -19.6, maxX: -17.52, minZ: 9.0, maxZ: 11.1 },
    { minX: 17.52, maxX: 19.6, minZ: 9.0, maxZ: 11.1 }
  );

  // Front structural columns along balustrade line
  for (let i = 0; i <= 4; i++) {
    if (lv === 0 && i === 2) continue;
    circles.push({ x: -20 + i * 10, z: 10.5, r: 0.24 });
  }

  // Department bays (Levels 0..3)
  ROOMS.forEach((d, idx) => {
    if (d.lv !== lv) return;
    const x0 = COLX[d.col];
    addBox(boxes, x0 + 4.94, 3.4, 0.2, 6.44);
    addBox(boxes, x0, 3.95, 6.3, 1.44);
    [-2.05, 0, 2.05].forEach((ox) => circles.push({ x: x0 + ox, z: 4.78, r: 0.34 }));
    addBox(boxes, x0 + (d.col % 2 ? -1 : 1) * 4.15, 0.95, 1.58, 0.56);
    circles.push({ x: x0 + (d.col % 2 ? 1 : -1) * 4.05, z: 1.25, r: 0.42 });
    circles.push({ x: x0 + (d.col % 2 ? -1 : 1) * 4.55, z: 8.9, r: 0.46 });
    if (idx === 1 || idx === 9) {
      circles.push({ x: x0 + 3.5, z: 6.6, r: 0.68 });
    }
    if (idx === 11) {
      addBox(boxes, x0 + 2.4, 7.2, 2.86, 1.12);
    }
  });

  if (lv === 0) {
    // Ground Reception Lobby furnishings & Plaza planters
    circles.push(
      { x: -2.55, z: 8.5, r: 0.68 },
      { x: 2.55, z: 8.5, r: 0.68 },
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
    addBox(boxes, -16.5, 13.4, 3.7, 2.3);
    addBox(boxes, 16.5, 13.4, 3.7, 2.3);
    // Approach planting beds along front plaza (y_plaza = -0.61)
    [
      [-13, 20],
      [13, 20],
      [-13, 30],
      [13, 30],
      [-13, 40],
      [13, 40],
    ].forEach(([bx, bz]) => addBox(boxes, bx, bz, 4.28, 4.28));

    return {
      boxes,
      circles,
      minX: -19.2,
      maxX: 19.2,
      minZ: 0.72,
      maxZ: 54.0,
      curvedCounter: { cx: 0, cz: -2.5, rIn: 8.14, rOut: 9.14, halfX: 3.55, minZ: 5.3 },
    };
  }

  if (lv === 4) {
    // Level 4 glass partitions with open doorway [4.0..5.4] and front corridor [9.4..10.3]
    [-10, 10].forEach((px) => {
      boxes.push({ minX: px - 0.08, maxX: px + 0.08, minZ: 0.35, maxZ: 3.96 });
      boxes.push({ minX: px - 0.08, maxX: px + 0.08, minZ: 5.44, maxZ: 9.38 });
    });
    // Board Room credenza & boat conference table + all 16 board chairs
    addBox(boxes, 0, 0.62, 8.05, 0.54);
    boxes.push({ minX: -6.12, maxX: 6.12, minZ: 3.65, maxZ: 6.15 });
    for (let i = 0; i < 7; i++) {
      const cx = -5.4 + i * 1.8;
      circles.push({ x: cx, z: 3.26, r: 0.35 }, { x: cx, z: 6.54, r: 0.35 });
    }
    circles.push({ x: -6.58, z: 4.9, r: 0.36 }, { x: 6.58, z: 4.9, r: 0.36 });
    // Executive Lounge espresso bar, stools, sofa, coffee table & armchairs
    boxes.push({ minX: -20.0, maxX: -15.15, minZ: 0.7, maxZ: 1.42 });
    [-18.8, -17.6, -16.4].forEach((sx) => circles.push({ x: sx, z: 2.1, r: 0.28 }));
    addBox(boxes, -12.6, 3.0, 2.86, 1.12);
    addBox(boxes, -12.6, 5.0, 1.74, 0.98);
    circles.push(
      { x: -14.3, z: 5.0, r: 0.68 },
      { x: -11.0, z: 5.0, r: 0.68 },
      { x: -19.2, z: 8.6, r: 0.5 },
      { x: -10.8, z: 1.2, r: 0.42 }
    );
    // Board Secretary desk, chair, armchairs, side table & plants
    addBox(boxes, 15, 3.4, 2.24, 1.24);
    circles.push(
      { x: 15, z: 2.58, r: 0.34 },
      { x: 13.1, z: 6.6, r: 0.68 },
      { x: 16.9, z: 6.6, r: 0.68 },
      { x: 15, z: 6.7, r: 0.38 },
      { x: 19.1, z: 1.1, r: 0.44 },
      { x: 10.9, z: 8.9, r: 0.46 }
    );
    addBox(boxes, 19.0, 0.55, 1.32, 0.55);

    return { boxes, circles, minX: -19.2, maxX: 19.2, minZ: 0.36, maxZ: 10.3 };
  }

  if (lv === 5) {
    // Level 5 glass partitions with doorways [4.0..5.4]
    [-15, -10, -5, 0, 6].forEach((px) => {
      boxes.push({ minX: px - 0.08, maxX: px + 0.08, minZ: 0.35, maxZ: 3.96 });
      boxes.push({ minX: px - 0.08, maxX: px + 0.08, minZ: 5.44, maxZ: 9.38 });
    });
    // 4 HoD suites (desks, shelves, plants, main chairs & visitor chairs)
    [-17.5, -12.5, -7.5, -2.5].forEach((cx) => {
      addBox(boxes, cx, 3.5, 2.24, 1.24);
      addBox(boxes, cx + 1.7, 0.55, 1.12, 0.55);
      circles.push(
        { x: cx, z: 2.66, r: 0.35 },
        { x: cx - 0.8, z: 5.4, r: 0.33 },
        { x: cx + 0.8, z: 5.4, r: 0.33 },
        { x: cx - 1.9, z: 1.0, r: 0.38 }
      );
    });
    // Executive Assistant (x = 3)
    addBox(boxes, 3, 3.4, 2.24, 1.24);
    circles.push(
      { x: 3, z: 2.58, r: 0.34 },
      { x: 1.1, z: 6.6, r: 0.68 },
      { x: 4.9, z: 6.6, r: 0.68 },
      { x: 3, z: 6.7, r: 0.38 },
      { x: 5.1, z: 1.1, r: 0.42 },
      { x: 0.9, z: 8.9, r: 0.46 }
    );
    // CEO suite (cx = 13) including chair, visitor chairs, floor lamps, lounge sofa & armchairs
    addBox(boxes, 13, 3.4, 3.44, 1.24);
    addBox(boxes, 7.7, 0.55, 1.32, 0.55);
    addBox(boxes, 19.0, 0.55, 1.32, 0.55);
    addBox(boxes, 17.8, 1.95, 2.86, 1.12);
    addBox(boxes, 17.8, 3.9, 1.74, 0.98);
    circles.push(
      { x: 13, z: 2.58, r: 0.36 },
      { x: 12.0, z: 5.5, r: 0.35 },
      { x: 14.0, z: 5.5, r: 0.35 },
      { x: 14.4, z: 3.05, r: 0.25 },
      { x: 11.6, z: 3.05, r: 0.25 },
      { x: 19.3, z: 3.9, r: 0.25 },
      { x: 16.0, z: 3.9, r: 0.68 },
      { x: 17.8, z: 5.8, r: 0.68 },
      { x: 9.6, z: 6.2, r: 0.48 },
      { x: 19.2, z: 8.6, r: 0.5 },
      { x: 7.0, z: 1.7, r: 0.25 },
      { x: 8.3, z: 1.7, r: 0.25 }
    );
    return { boxes, circles, minX: -19.2, maxX: 19.2, minZ: 0.72, maxZ: 10.3 };
  }

  // Levels 1..3
  return { boxes, circles, minX: -19.2, maxX: 19.2, minZ: 0.72, maxZ: 10.3 };
}

export function getFloorColliders(lv: number): FloorColliderSet {
  let set = FLOOR_CACHE.get(lv);
  if (!set) {
    set = buildCollidersForLevel(lv);
    FLOOR_CACHE.set(lv, set);
  }
  return set;
}

export interface IgnoreChairCircle {
  x: number;
  z: number;
  r?: number;
}

export function resolveObstaclePosition(
  lv: number,
  x: number,
  z: number,
  options?: { allowLiftShaft?: boolean; radius?: number; ignoreCircle?: IgnoreChairCircle }
): { x: number; z: number; blocked: boolean } {
  const col = getFloorColliders(lv);
  const baseR = options?.radius ?? CHAR_RADIUS;
  const r = lv === 4 && x < -14.8 && z < 0.72 ? Math.min(baseR, 0.16) : baseR;
  let nx = Math.max(col.minX, Math.min(col.maxX, x));
  let nz = Math.max(col.minZ, Math.min(col.maxZ, z));
  let blocked = nx !== x || nz !== z;
  const ign = options?.ignoreCircle;
  const ignR = ign?.r ?? 0.44;

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < col.boxes.length; i++) {
      const b = col.boxes[i];
      if (options?.allowLiftShaft && (b.minX <= -17.5 || b.maxX >= 17.5) && b.minZ >= 8.8) {
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

    for (let i = 0; i < col.circles.length; i++) {
      const c = col.circles[i];
      if (ign && Math.hypot(c.x - ign.x, c.z - ign.z) <= ignR) {
        continue;
      }
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

    if (col.curvedCounter) {
      const cc = col.curvedCounter;
      if (Math.abs(nx) <= cc.halfX + r && nz >= cc.minZ - r) {
        const dx = nx - cc.cx;
        const dz = nz - cc.cz;
        const dist = Math.hypot(dx, dz);
        const rInExp = cc.rIn - r;
        const rOutExp = cc.rOut + r;
        if (dist > rInExp && dist < rOutExp) {
          const targetR = dist - rInExp < rOutExp - dist ? rInExp : rOutExp;
          if (dist > 0.001) {
            nx = cc.cx + (dx / dist) * targetR;
            nz = cc.cz + (dz / dist) * targetR;
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

export function hasLineOfSight(
  lv: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  ignoreCircle?: IgnoreChairCircle
): boolean {
  const dist = Math.hypot(x1 - x0, z1 - z0);
  if (dist < 0.05) return true;
  const steps = Math.ceil(dist / 0.22);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + (x1 - x0) * t;
    const pz = z0 + (z1 - z0) * t;
    const res = resolveObstaclePosition(lv, px, pz, { ignoreCircle });
    if (res.blocked) return false;
  }
  return true;
}

/**
 * Returns a clean collision-free step-out / dock point right outside a seated chair or behind a counter,
 * so actors step squarely off a chair before turning down aisles (never through backrests or desks).
 */
export function getChairDockPoint(lv: number, homeX: number, homeZ: number): { x: number; z: number } | null {
  if (lv === 0 && Math.abs(homeX) < 3.7 && homeZ < 5.7) {
    // Receptionist behind curved counter steps out past the counter edge cleanly
    return { x: homeX < 0 ? -4.3 : 4.3, z: 4.4 };
  }
  if (lv >= 0 && lv <= 3 && homeZ >= 4.5 && homeZ <= 5.1) {
    // Department bay chair facing -Z: step clear behind backrest at z = 5.56
    return { x: homeX, z: 5.56 };
  }
  if (lv === 4) {
    if (homeX < -14.8 && homeZ < 0.75) {
      return { x: -14.55, z: 0.52 };
    }
    if (Math.abs(homeX) <= 6.2 && homeZ >= 3.0 && homeZ <= 3.6) {
      // North side Board Room chair -> step north behind chair
      return { x: homeX, z: 2.35 };
    }
    if (Math.abs(homeX) <= 6.2 && homeZ >= 6.2 && homeZ <= 6.8) {
      // South side Board Room chair -> step south behind chair
      return { x: homeX, z: 7.45 };
    }
    if (Math.abs(homeX) >= 6.3 && Math.abs(homeX) <= 7.0 && Math.abs(homeZ - 4.9) < 0.5) {
      return { x: homeX < 0 ? -7.48 : 7.48, z: 4.9 };
    }
    if (homeX > 13.5 && homeX < 16.5 && homeZ < 3.0) {
      return { x: 15, z: 1.78 };
    }
  }
  if (lv === 5 && homeZ >= 2.2 && homeZ <= 3.0) {
    // HoD, EA, or CEO executive chair facing +Z: step back behind chair into clear aisle
    return { x: homeX, z: 1.82 };
  }
  return null;
}

function findDeskBypassX(lv: number, x: number, z: number): number {
  if (lv >= 0 && lv <= 3 && z < 4.95) {
    for (const d of ROOMS) {
      if (d.lv !== lv) continue;
      const cx = COLX[d.col];
      if (Math.abs(x - cx) < 3.55) {
        return x < cx ? cx - 3.68 : cx + 3.68;
      }
    }
  }
  if (lv === 4) {
    // Board table [-6.12..6.12, 3.65..6.15] & north/south chairs
    if (Math.abs(x) < 6.8 && z < 6.9) {
      return x < 0 ? -7.45 : 7.45;
    }
    // Board Secretary suite (cx=15): clear corridor west of desk & armchairs at x = 12.0
    if (x > 12.1 && x < 17.5 && z < 7.6) {
      return 12.0;
    }
  }
  if (lv === 5) {
    for (const cx of [-17.5, -12.5, -7.5, -2.5]) {
      if (Math.abs(x - cx) < 1.45 && z < 4.2) {
        return x < cx ? cx - 1.6 : cx + 1.6;
      }
    }
    // Executive Assistant (cx=3): route west around desk then between left armchair & side table (x = 2.2)
    if (x > 1.3 && x < 4.7 && z < 5.2) {
      return 1.55;
    }
    if (x > 1.3 && x < 4.7 && z >= 5.2 && z < 7.6) {
      return 2.2;
    }
    // CEO desk + flanking floor lamps at 11.6 & 14.4 + lounge armchair at (16.0, 3.9)
    if (x > 10.6 && x < 15.4 && z < 5.5) {
      return x <= 13.5 ? 10.65 : 14.98;
    }
  }
  return x;
}

export function buildObstacleAwarePath(
  lv: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  options?: { ignoreCircle?: IgnoreChairCircle }
): Array<{ x: number; z: number }> {
  const safeDest = resolveObstaclePosition(lv, toX, toZ, { ignoreCircle: options?.ignoreCircle });
  const dx = safeDest.x;
  const dz = safeDest.z;

  if (Math.hypot(dx - fromX, dz - fromZ) < 0.08) {
    return [{ x: dx, z: dz }];
  }

  if (hasLineOfSight(lv, fromX, fromZ, dx, dz, options?.ignoreCircle)) {
    return [{ x: dx, z: dz }];
  }

  if (lv === 0) {
    const pts: Array<{ x: number; z: number }> = [];
    const behindCounterFrom = Math.abs(fromX) < 3.7 && fromZ < 5.7;
    const behindCounterTo = Math.abs(dx) < 3.7 && dz < 5.7;
    if (behindCounterFrom && !behindCounterTo) {
      const exitX = fromX < 0 ? -4.3 : 4.3;
      pts.push({ x: exitX, z: 4.4 }, { x: exitX, z: 7.4 });
      if (dz > 11.0) {
        pts.push({ x: exitX, z: 10.2 });
        const apronX = Math.max(-9.0, Math.min(9.0, dx));
        if (Math.abs(apronX - exitX) > 0.4) pts.push({ x: apronX, z: 10.2 });
        if (dz > 18.2) {
          pts.push({ x: Math.max(-3.4, Math.min(3.4, dx)), z: 16.5 });
        }
      }
      pts.push({ x: dx, z: dz });
      return pts;
    } else if (!behindCounterFrom && behindCounterTo) {
      const entryX = dx < 0 ? -4.3 : 4.3;
      if (fromZ > 11.0) {
        if (fromZ > 18.2 && Math.abs(fromX) > 3.6) {
          pts.push({ x: Math.max(-3.4, Math.min(3.4, fromX)), z: 16.5 });
        }
        pts.push({ x: entryX, z: 10.2 });
      }
      pts.push({ x: entryX, z: 7.4 }, { x: entryX, z: 4.4 }, { x: dx, z: dz });
      return pts;
    }

    // Standard lobby / plaza routing
    let curX = fromX;
    let curZ = fromZ;
    if (curZ > 18.2 && dz <= 18.2 && Math.abs(curX) > 3.6) {
      curX = Math.max(-3.4, Math.min(3.4, curX));
      pts.push({ x: curX, z: Math.min(curZ, 20.5) });
    }
    if (curZ > 10.6 && dz <= 10.6 && Math.abs(curX) > 10.0) {
      curX = curX < 0 ? -9.5 : 9.5;
      pts.push({ x: curX, z: Math.min(curZ, 15.5) });
    }

    const corrZ = curZ > 10.6 && dz > 10.6 ? 15.6 : 9.8;
    const startBypassX = findDeskBypassX(0, curX, curZ);
    if (Math.abs(startBypassX - curX) > 0.25) {
      pts.push({ x: startBypassX, z: curZ });
    }
    if (Math.abs(curZ - corrZ) > 0.7) pts.push({ x: startBypassX, z: corrZ });
    const endBypassX = findDeskBypassX(0, dx, dz);
    if (Math.abs(endBypassX - startBypassX) > 0.7) pts.push({ x: endBypassX, z: corrZ });
    if (dz > 18.2 && Math.abs(dx) > 3.6) {
      pts.push({ x: Math.max(-3.4, Math.min(3.4, dx)), z: 16.5 });
    }
    if (Math.abs(endBypassX - dx) > 0.25) pts.push({ x: endBypassX, z: dz });
    pts.push({ x: dx, z: dz });
    return pts;
  }

  if (lv >= 1) {
    const pts: Array<{ x: number; z: number }> = [];
    let curX = fromX;
    let curZ = fromZ;

    // Level 4 Executive Lounge: exit/enter behind espresso bar cleanly past x = -14.55
    if (lv === 4) {
      const fromBehindBar = curX < -14.8 && curZ < 0.75;
      const toBehindBar = dx < -14.8 && dz < 0.75;
      if (fromBehindBar && !toBehindBar) {
        pts.push({ x: -14.55, z: 0.52 }, { x: -14.55, z: 2.3 });
        curX = -14.55;
        curZ = 2.3;
      } else if (!fromBehindBar && toBehindBar) {
        const corrZ = 9.82;
        if (Math.abs(curZ - corrZ) > 0.65) {
          const sx = findDeskBypassX(4, curX, curZ);
          if (Math.abs(sx - curX) > 0.25) pts.push({ x: sx, z: curZ });
          pts.push({ x: sx, z: corrZ });
          curX = sx;
        }
        pts.push({ x: -14.55, z: corrZ }, { x: -14.55, z: 2.3 }, { x: -14.55, z: 0.52 }, { x: dx, z: dz });
        return pts;
      }
    }

    // Main front atrium corridor z = 9.82 clears both glass partitions (maxZ=9.38) and columns (z=10.5)
    const corridorZ = 9.82;
    let startBypassX = findDeskBypassX(lv, curX, curZ);
    if (lv === 1 && curX > 15.65 && curZ < 7.8) {
      // Bay Consultancy sofa occupies [15.97..18.83, 6.64..7.76]
      startBypassX = 15.5;
    }
    if (Math.abs(startBypassX - curX) > 0.25) {
      pts.push({ x: startBypassX, z: curZ });
    }
    if (lv === 5 && startBypassX < 2.0 && curX > 1.2 && curZ < 5.2 && Math.abs(dx - startBypassX) > 0.5) {
      // EA room: transition horizontally along clear z = 5.0 lane between desk and armchairs
      pts.push({ x: startBypassX, z: 5.0 });
      startBypassX = 2.2;
      pts.push({ x: startBypassX, z: 5.0 });
    }
    if (Math.abs(curZ - corridorZ) > 0.55) {
      const sCorr = resolveObstaclePosition(lv, startBypassX, corridorZ);
      pts.push({ x: sCorr.x, z: sCorr.z });
    }
    const endBypassX =
      lv === 5 && dx > 1.3 && dx < 4.7 && dz < 5.2
        ? 2.2
        : lv === 1 && dx > 15.65 && dz < 7.8
          ? 15.5
          : findDeskBypassX(lv, dx, dz);
    const eCorr = resolveObstaclePosition(lv, endBypassX, corridorZ);
    pts.push({ x: eCorr.x, z: eCorr.z });
    if (lv === 5 && dx > 1.3 && dx < 4.7 && dz < 5.2) {
      pts.push({ x: 2.2, z: 5.0 }, { x: 1.55, z: 5.0 }, { x: 1.55, z: dz });
    } else if (lv === 1 && dx > 15.65 && dz < 7.8) {
      pts.push({ x: 15.5, z: dz });
    } else if (Math.abs(endBypassX - dx) > 0.25) {
      pts.push({ x: endBypassX, z: dz });
    }
    pts.push({ x: dx, z: dz });
    return pts;
  }

  if (lv === -1) {
    // B1 Server Room: clear aisles z = 2.15, z = 4.35, z = 7.35, and center corridors x = -1.6 / 1.0
    const aisleX = fromX > 0.5 && dx > 0.5 ? 1.0 : -1.6;
    const exitZ = fromZ < 2.9 ? 2.15 : fromZ < 5.0 ? 4.35 : 7.35;
    const enterZ = dz < 2.9 ? 2.15 : dz < 5.0 ? 4.35 : 7.35;
    const pts: Array<{ x: number; z: number }> = [];
    if (Math.abs(fromZ - exitZ) > 0.35) pts.push({ x: fromX, z: exitZ });
    if (Math.abs(fromX - aisleX) > 0.4) pts.push({ x: aisleX, z: exitZ });
    if (Math.abs(exitZ - enterZ) > 0.4) pts.push({ x: aisleX, z: enterZ });
    if (Math.abs(dx - aisleX) > 0.4 && Math.abs(dz - enterZ) > 0.35) pts.push({ x: dx, z: enterZ });
    pts.push({ x: dx, z: dz });
    return pts;
  }

  // B2 Power Room: north aisle z = 2.25, open corridors x = 0.4 / 5.2, battery-row aisles 3.75 / 5.9 / 7.8 / 9.55
  const pickB2AisleZ = (px: number, pz: number) => {
    if (px >= 7.6 && pz >= 4.25) return 5.2;
    if (pz < 2.7) return 2.25;
    if (pz < 4.9) return 3.75;
    if (pz < 6.9) return 5.9;
    if (pz < 8.7) return 7.8;
    return 9.55;
  };
  const safeX = fromX > 3.2 || dx > 3.2 ? 5.2 : 0.4;
  const exitZ = pickB2AisleZ(fromX, fromZ);
  const enterZ = pickB2AisleZ(dx, dz);
  const pts: Array<{ x: number; z: number }> = [];
  if (Math.abs(fromZ - exitZ) > 0.35) pts.push({ x: fromX, z: exitZ });
  if (Math.abs(fromX - safeX) > 0.45) pts.push({ x: safeX, z: exitZ });
  if (Math.abs(exitZ - enterZ) > 0.4) pts.push({ x: safeX, z: enterZ });
  if (Math.abs(dx - safeX) > 0.45 && Math.abs(dz - enterZ) > 0.35) pts.push({ x: dx, z: enterZ });
  pts.push({ x: dx, z: dz });
  return pts;
}


