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
    boxes.push(
      { minX: -19.6, maxX: -15.5, minZ: 8.9, maxZ: 11.1 },
      { minX: 15.5, maxX: 19.6, minZ: 8.9, maxZ: 11.1 }
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
      { minX: 15.5, maxX: 19.6, minZ: 8.9, maxZ: 11.1 }
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
    addBox(boxes, x0 + (d.col % 2 ? -1 : 1) * 4.15, 0.95, 1.58, 0.56);
    circles.push({ x: x0 + (d.col % 2 ? 1 : -1) * 4.05, z: 1.25, r: 0.42 });
    circles.push({ x: x0 + (d.col % 2 ? -1 : 1) * 4.55, z: 8.9, r: 0.46 });
    if (idx === 1 || idx === 9) {
      circles.push({ x: x0 + 3.5, z: 6.6, r: 0.54 });
    }
    if (idx === 11) {
      addBox(boxes, x0 + 2.4, 7.2, 2.05, 0.95);
    }
  });

  if (lv === 0) {
    // Ground Reception Lobby furnishings & Plaza planters
    circles.push(
      { x: -2.55, z: 8.5, r: 0.56 },
      { x: 2.55, z: 8.5, r: 0.56 },
      { x: 0, z: 8.55, r: 0.84 },
      { x: -8.4, z: 1.3, r: 0.52 },
      { x: -8.6, z: 9.0, r: 0.5 },
      { x: 8.4, z: 1.3, r: 0.52 },
      { x: 8.6, z: 9.0, r: 0.5 }
    );
    addBox(boxes, -9.3, 7.6, 0.94, 3.65);
    addBox(boxes, 9.3, 7.6, 0.94, 3.65);
    addBox(boxes, -13, 11.2, 3.65, 2.25);
    addBox(boxes, 13, 11.2, 3.65, 2.25);
    addBox(boxes, -16.5, 13.4, 3.65, 2.25);
    addBox(boxes, 16.5, 13.4, 3.65, 2.25);

    return {
      boxes,
      circles,
      minX: -19.2,
      maxX: 19.2,
      minZ: 0.72,
      maxZ: 18.8,
      curvedCounter: { cx: 0, cz: -2.5, rIn: 7.98, rOut: 9.16, halfX: 3.55, minZ: 5.3 },
    };
  }

  if (lv === 4) {
    // Level 4 glass partitions with open doorway [4.0..5.4] and front corridor [9.4..10.3]
    [-10, 10].forEach((px) => {
      boxes.push({ minX: px - 0.08, maxX: px + 0.08, minZ: 0.35, maxZ: 3.96 });
      boxes.push({ minX: px - 0.08, maxX: px + 0.08, minZ: 5.44, maxZ: 9.38 });
    });
    // Board Room credenza & boat conference table
    addBox(boxes, 0, 0.62, 8.05, 0.54);
    boxes.push({ minX: -6.12, maxX: 6.12, minZ: 3.65, maxZ: 6.15 });
    // Executive Lounge espresso bar, sofa, coffee table & armchairs
    boxes.push({ minX: -20.0, maxX: -15.15, minZ: 0.7, maxZ: 1.42 });
    [-18.8, -17.6, -16.4].forEach((sx) => circles.push({ x: sx, z: 2.1, r: 0.28 }));
    addBox(boxes, -12.6, 3.0, 2.15, 0.95);
    addBox(boxes, -12.6, 5.0, 1.74, 0.98);
    circles.push(
      { x: -14.3, z: 5.0, r: 0.52 },
      { x: -11.0, z: 5.0, r: 0.52 },
      { x: -19.2, z: 8.6, r: 0.5 },
      { x: -10.8, z: 1.2, r: 0.42 }
    );
    // Board Secretary desk, armchairs, side table & plants
    addBox(boxes, 15, 3.4, 2.24, 1.24);
    circles.push(
      { x: 13.1, z: 6.6, r: 0.52 },
      { x: 16.9, z: 6.6, r: 0.52 },
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
    // 4 HoD suites
    [-17.5, -12.5, -7.5, -2.5].forEach((cx) => {
      addBox(boxes, cx, 3.5, 2.24, 1.24);
      addBox(boxes, cx + 1.7, 0.55, 1.12, 0.55);
      circles.push({ x: cx - 1.9, z: 1.0, r: 0.38 });
    });
    // Executive Assistant (x = 3)
    addBox(boxes, 3, 3.4, 2.24, 1.24);
    circles.push(
      { x: 1.1, z: 6.6, r: 0.52 },
      { x: 4.9, z: 6.6, r: 0.52 },
      { x: 3, z: 6.7, r: 0.38 },
      { x: 5.1, z: 1.1, r: 0.42 },
      { x: 0.9, z: 8.9, r: 0.46 }
    );
    // CEO suite (cx = 13)
    addBox(boxes, 13, 3.4, 3.44, 1.24);
    addBox(boxes, 7.7, 0.55, 1.32, 0.55);
    addBox(boxes, 19.0, 0.55, 1.32, 0.55);
    addBox(boxes, 17.8, 1.95, 2.15, 0.95);
    addBox(boxes, 17.8, 3.9, 1.74, 0.98);
    circles.push(
      { x: 16.0, z: 3.9, r: 0.52 },
      { x: 17.8, z: 5.8, r: 0.52 },
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

export function resolveObstaclePosition(
  lv: number,
  x: number,
  z: number,
  options?: { allowLiftShaft?: boolean; radius?: number }
): { x: number; z: number; blocked: boolean } {
  const col = getFloorColliders(lv);
  const baseR = options?.radius ?? CHAR_RADIUS;
  const r = lv === 4 && x < -14.8 && z < 0.72 ? Math.min(baseR, 0.16) : baseR;
  let nx = Math.max(col.minX, Math.min(col.maxX, x));
  let nz = Math.max(col.minZ, Math.min(col.maxZ, z));
  let blocked = nx !== x || nz !== z;

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

function findDeskBypassX(lv: number, x: number, z: number): number {
  if (lv >= 0 && lv <= 3 && z < 4.7) {
    for (const cx of COLX) {
      if (Math.abs(x - cx) < 3.45) {
        return x < cx ? cx - 3.65 : cx + 3.65;
      }
    }
  }
  if (lv === 4) {
    // Board table [-6.12..6.12, 3.65..6.15]
    if (Math.abs(x) < 6.4 && z < 6.3) {
      return x < 0 ? -6.85 : 6.85;
    }
    // Board Secretary desk [13.88..16.12, 2.78..4.02]
    if (x > 13.4 && x < 16.6 && z < 4.1) {
      return x < 15 ? 13.2 : 16.8;
    }
  }
  if (lv === 5) {
    for (const cx of [-17.5, -12.5, -7.5, -2.5, 3]) {
      if (Math.abs(x - cx) < 1.35 && z < 4.15) {
        return x < cx ? cx - 1.58 : cx + 1.58;
      }
    }
    if (x > 10.9 && x < 15.1 && z < 4.15) {
      return x < 13 ? 10.75 : 15.25;
    }
  }
  return x;
}

export function buildObstacleAwarePath(
  lv: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number
): Array<{ x: number; z: number }> {
  const safeDest = resolveObstaclePosition(lv, toX, toZ);
  const dx = safeDest.x;
  const dz = safeDest.z;

  if (lv === 0) {
    const pts: Array<{ x: number; z: number }> = [];
    const behindCounterFrom = Math.abs(fromX) < 3.7 && fromZ < 5.7;
    const behindCounterTo = Math.abs(dx) < 3.7 && dz < 5.7;
    if (behindCounterFrom && !behindCounterTo) {
      const exitX = fromX < 0 ? -4.3 : 4.3;
      pts.push({ x: exitX, z: 4.8 }, { x: exitX, z: 7.4 });
    } else if (!behindCounterFrom && behindCounterTo) {
      const entryX = dx < 0 ? -4.3 : 4.3;
      pts.push({ x: entryX, z: 7.4 }, { x: entryX, z: 4.8 });
    } else {
      const sameBay =
        (fromX < -10 && dx < -10) || (fromX > 10 && dx > 10) || (Math.abs(fromX) < 8.5 && Math.abs(dx) < 8.5);
      if (sameBay && Math.abs(fromZ - dz) < 2.2) {
        return [{ x: dx, z: dz }];
      }
      // Route plaza entries/exits cleanly through central courtyard (|x| <= 10.2)
      const corrZ = fromZ > 10.6 && dz > 10.6 ? 15.6 : 9.8;
      if (fromZ > 10.6 && Math.abs(fromX) > 10.4 && dz <= 10.6) {
        pts.push({ x: fromX < 0 ? -9.5 : 9.5, z: fromZ });
      }
      const startBypassX = findDeskBypassX(0, fromX, fromZ);
      if (Math.abs(startBypassX - fromX) > 0.25) {
        pts.push({ x: startBypassX, z: fromZ });
      }
      if (Math.abs(fromZ - corrZ) > 0.7) pts.push({ x: startBypassX, z: corrZ });
      const endBypassX = findDeskBypassX(0, dx, dz);
      if (Math.abs(endBypassX - startBypassX) > 0.7) pts.push({ x: endBypassX, z: corrZ });
      if (Math.abs(endBypassX - dx) > 0.25) pts.push({ x: endBypassX, z: dz });
    }
    pts.push({ x: dx, z: dz });
    return pts;
  }

  if (lv >= 1) {
    const sameBay =
      lv === 4 || lv === 5
        ? Math.abs(fromX - dx) < 2.2 && Math.abs(fromZ - dz) < 2.4
        : Math.floor((fromX + 20) / 10) === Math.floor((dx + 20) / 10);

    if (sameBay && Math.abs(fromZ - dz) < 1.8 && fromZ > 4.2 && dz > 4.2) {
      return [{ x: dx, z: dz }];
    }

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
    const startBypassX = findDeskBypassX(lv, curX, curZ);
    if (Math.abs(startBypassX - curX) > 0.25) {
      pts.push({ x: startBypassX, z: curZ });
    }

    if (!sameBay || Math.abs(curZ - dz) >= 1.8 || startBypassX !== curX) {
      if (Math.abs(curZ - corridorZ) > 0.55) {
        const sCorr = resolveObstaclePosition(lv, startBypassX, corridorZ);
        pts.push({ x: sCorr.x, z: sCorr.z });
      }
      const endBypassX = findDeskBypassX(lv, dx, dz);
      const eCorr = resolveObstaclePosition(lv, endBypassX, corridorZ);
      pts.push({ x: eCorr.x, z: eCorr.z });
      if (Math.abs(endBypassX - dx) > 0.25) {
        pts.push({ x: endBypassX, z: dz });
      }
    }

    pts.push({ x: dx, z: dz });
    return pts;
  }

  if (lv === -1) {
    // B1 Server Room: clear aisles z = 2.15, z = 4.35, z = 7.35, and center corridors x = -1.6 / 1.0
    if (fromZ < 2.6 && dz < 2.6) {
      return Math.abs(fromX - dx) > 0.6 ? [{ x: dx, z: 2.15 }, { x: dx, z: dz }] : [{ x: dx, z: dz }];
    }
    if (Math.abs(fromZ - dz) < 0.65 && Math.abs(fromX - dx) < 5.5) return [{ x: dx, z: dz }];
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

  // B2 Power Room: north aisle z = 2.25, aisles x = 0.4 or x = 5.2, open bay z = 3.7 or 7.8
  if (fromZ < 2.7 && dz < 2.7) {
    return Math.abs(fromX - dx) > 0.6 ? [{ x: dx, z: 2.25 }, { x: dx, z: dz }] : [{ x: dx, z: dz }];
  }
  const safeX = fromX > 3.2 || dx > 3.2 ? 5.2 : 0.4;
  const exitZ = fromZ < 2.7 ? 2.25 : fromZ < 6.0 ? 3.7 : 7.8;
  const enterZ = dz < 2.7 ? 2.25 : dz < 6.0 ? 3.7 : 7.8;
  const pts: Array<{ x: number; z: number }> = [];
  if (Math.abs(fromZ - exitZ) > 0.35) pts.push({ x: fromX, z: exitZ });
  if (Math.abs(fromX - safeX) > 0.45) pts.push({ x: safeX, z: exitZ });
  if (Math.abs(exitZ - enterZ) > 0.4) pts.push({ x: safeX, z: enterZ });
  if (Math.abs(dx - safeX) > 0.45 && Math.abs(dz - enterZ) > 0.35) pts.push({ x: dx, z: enterZ });
  pts.push({ x: dx, z: dz });
  return pts;
}

