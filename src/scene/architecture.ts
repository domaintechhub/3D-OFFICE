import * as THREE from 'three';
import {
  BASE,
  BASE_BOT,
  BW,
  ceilHeight,
  ceilY,
  COLX,
  DEPTH,
  EXEC,
  FLOORS,
  FLOORS as FLOOR_COUNT,
  GATE,
  LANE,
  LH,
  LIFT_SVC,
  LIFTX,
  LV,
  ROAD_Z,
  ROOMS,
  ROOF,
  WIDTH,
  type ExecRoomDef,
  type RoomDef,
  type WorkScreenRef,
} from './constants';
import type { MaterialLibrary } from './materials';
import {
  armchair,
  boxAt,
  ceilingLinearLight,
  contact,
  cylAt,
  downlight,
  getRoundedBox,
  gooseneckLamp,
  hvacDiffuser,
  monitor,
  officeChair,
  planeAt,
  plant,
  shelfUnit,
  sofaWide,
  tree,
} from './props';
import {
  createBoardScreenMat,
  createDeskScreenMat,
  createExecScreen,
  createWallTvMat,
  type ScreenRegistry,
} from './screens';
import { getWorkstationProfile } from './workstations';
import { leafTex, makeCanvasTex, plateTex, svcSignTex } from './textures';

export interface PickTarget {
  mesh: THREE.Object3D;
  room: RoomDef | ExecRoomDef;
}

export interface MonitorPickTarget {
  id: string;
  stationKey: string;
  seatIndex: number;
  projectTitle: string;
  meshes: THREE.Object3D[];
  lv: number;
  zone: string;
  role: string;
  color: string;
  seatX: number;
  seatZ: number;
  monPos: [number, number, number];
  rotY: number;
  screenRef: WorkScreenRef;
  screenTask: string;
}

export interface LiftCabState {
  g: THREE.Group;
  y: number;
  target: number;
  speed: number;
  slots?: Array<unknown>;
  ph?: string;
  ex?: number;
  bd?: number;
  tm?: number;
  stop?: number;
  busy?: boolean;
  guide?: boolean;
  gw?: boolean;
}

export interface OfficeChairHandle {
  group: THREE.Group;
  lv: number;
  restX: number;
  restZ: number;
  restRot: number;
  maxPush: number;
  swivelDir: number;
  curX: number;
  curZ: number;
  curRot: number;
}

export interface ArchitectureHandles {
  picks: PickTarget[];
  monitorPicks: MonitorPickTarget[];
  plazaGroup: THREE.Group;
  basementGroup: THREE.Group;
  levelGroups: THREE.Group[];
  levelCeilings: THREE.Group[];
  roofShellGroup: THREE.Group;
  b1Group: THREE.Group;
  b1Ceiling: THREE.Group;
  b2Group: THREE.Group;
  b2Ceiling: THREE.Group;
  cabs: Record<number, LiftCabState>;
  officeChairs: OfficeChairHandle[];
  sculptureGroup: THREE.Group;
  sculptureRings: THREE.Mesh[];
  sculptureCore: THREE.Mesh;
  sculptureHalo: THREE.Sprite;
  streetGlows: THREE.Sprite[];
  interiorWarmLights: THREE.PointLight[];
  roofFans: THREE.Group[];
}

function rndN(n: number): number {
  return (((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1) + 1) % 1;
}

function annularSector(rIn: number, rOut: number, a0: number, a1: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, a0, a1, false);
  s.absarc(0, 0, rIn, a1, a0, true);
  s.closePath();
  return s;
}

function curvedSlab(
  rIn: number,
  rOut: number,
  a0: number,
  a1: number,
  h: number,
  y: number,
  cx: number,
  cz: number,
  mat: THREE.Material,
  bevel = 0.015
): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(annularSector(rIn, rOut, a0, a1), {
    depth: h,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 44,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, y, cz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeBoatTableGeo(len: number, midW: number, endW: number, thick: number): THREE.ExtrudeGeometry {
  const hl = len / 2;
  const hw = midW / 2;
  const ew = endW / 2;
  const s = new THREE.Shape();
  s.moveTo(-hl, -ew);
  s.quadraticCurveTo(0, -hw * 1.12, hl, -ew);
  s.quadraticCurveTo(hl + 0.36, 0, hl, ew);
  s.quadraticCurveTo(0, hw * 1.12, -hl, ew);
  s.quadraticCurveTo(-hl - 0.36, 0, -hl, -ew);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.03,
    bevelSegments: 3,
    curveSegments: 24,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

let carafeGeo: THREE.LatheGeometry | null = null;
function getCarafeGeo(): THREE.LatheGeometry {
  if (carafeGeo) return carafeGeo;
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.068, 0),
    new THREE.Vector2(0.078, 0.08),
    new THREE.Vector2(0.042, 0.2),
    new THREE.Vector2(0.048, 0.27),
  ];
  carafeGeo = new THREE.LatheGeometry(pts, 16);
  return carafeGeo;
}

let lampShadeGeo: THREE.LatheGeometry | null = null;
function getLampShadeGeo(): THREE.LatheGeometry {
  if (lampShadeGeo) return lampShadeGeo;
  const pts = [
    new THREE.Vector2(0.28, 0),
    new THREE.Vector2(0.2, 0.34),
    new THREE.Vector2(0.04, 0.35),
  ];
  lampShadeGeo = new THREE.LatheGeometry(pts, 20);
  return lampShadeGeo;
}

export function buildSceneArchitecture(
  scene: THREE.Scene,
  M: MaterialLibrary,
  screenReg: ScreenRegistry
): ArchitectureHandles {
  const picks: PickTarget[] = [];
  const monitorPicks: MonitorPickTarget[] = [];
  const cabs: Record<number, LiftCabState> = {};
  const officeChairs: OfficeChairHandle[] = [];
  const interiorWarmLights: THREE.PointLight[] = [];
  const streetGlows: THREE.Sprite[] = [];
  const roofFans: THREE.Group[] = [];

  const addTrackedChair = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    rot: number,
    lv: number,
    scale = 1,
    maxPush = 0.48,
    swivelDir = 1
  ) => {
    const g = officeChair(parent, x, y, z, rot, M);
    if (scale !== 1) g.scale.setScalar(scale);
    officeChairs.push({
      group: g,
      lv,
      restX: x,
      restZ: z,
      restRot: rot,
      maxPush,
      swivelDir,
      curX: x,
      curZ: z,
      curRot: rot,
    });
    return g;
  };

  const exMon = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    rotY: number,
    key: string,
    k: number,
    meta?: {
      lv: number;
      zone: string;
      role: string;
      color: string;
      seatX: number;
      seatZ: number;
      screenTask: string;
    }
  ) => {
    const s = createExecScreen(screenReg, key, k);
    const mm = monitor(parent, x, y, z, false, rotY, M, s.mat as THREE.Material);
    s.mesh = mm.children[3];
    if (meta) {
      const stationKey =
        key === 'reception'
          ? k === 0
            ? 'reception-0'
            : 'reception-1'
          : key === 'ceo'
            ? k === 0
              ? 'ceo-0'
              : 'ceo-1'
            : key === 'mkt'
              ? 'mkt_head'
              : key;
      const profile = getWorkstationProfile(stationKey);
      monitorPicks.push({
        id: `exec-${key}-${meta.lv}-${k}`,
        stationKey,
        seatIndex: k,
        projectTitle: profile.projectTitle,
        meshes: [mm.children[2], mm.children[3]],
        lv: meta.lv,
        zone: meta.zone,
        role: meta.role,
        color: meta.color,
        seatX: meta.seatX,
        seatZ: meta.seatZ,
        monPos: [x, y + 0.36, z],
        rotY,
        screenRef: s,
        screenTask: meta.screenTask,
      });
    }
    return mm;
  };

  /* =========================================================
     1 · BUILDING SHELL (PER-LEVEL CUTAWAY GROUPS)
     ========================================================= */
  const levelGroups = Array.from({ length: FLOORS }, () => {
    const g = new THREE.Group();
    scene.add(g);
    return g;
  });
  const levelCeilings = levelGroups.map((lg) => {
    const cg = new THREE.Group();
    lg.add(cg);
    return cg;
  });
  const roofShellGroup = new THREE.Group();
  scene.add(roofShellGroup);

  const backWallMat = new THREE.MeshStandardMaterial({
    map: M.textures.concreteTex,
    normalMap: M.textures.concreteNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: M.textures.roughTex,
    color: 0x353b44,
    roughness: 0.9,
    metalness: 0.04,
  });

  const gapDark = new THREE.MeshStandardMaterial({ color: 0x454950, roughness: 0.9, envMapIntensity: 0.1 });
  for (let s = 0; s < FLOORS; s++) {
    const lg = levelGroups[s];
    boxAt(lg, WIDTH + 1, LH[s], 0.4, 0, LV[s] + LH[s] / 2, -0.35, backWallMat, false, false);
    boxAt(lg, WIDTH, 0.4, DEPTH + 0.4, 0, LV[s] - 0.2, DEPTH / 2, M.slab, false, true, 0.04);
    boxAt(lg, WIDTH, 0.46, 0.32, 0, LV[s] - 0.1, DEPTH + 0.12, M.fascia, true, false, 0.05);
    boxAt(lg, WIDTH, 0.14, 0.05, 0, LV[s] - 0.4, DEPTH + 0.3, gapDark, false, false);
  }
  boxAt(levelGroups[0], WIDTH, 0.64, DEPTH + 0.4, 0, -0.32, DEPTH / 2, M.concrete, false, true, 0.05);
  boxAt(roofShellGroup, WIDTH + 1, 0.9, 0.4, 0, ROOF + 0.45, -0.35, backWallMat, false, false);
  boxAt(roofShellGroup, WIDTH, 0.4, DEPTH + 0.4, 0, ROOF - 0.2, DEPTH / 2, M.slab, false, false, 0.05);
  boxAt(roofShellGroup, WIDTH, 0.7, 0.4, 0, ROOF - 0.2, DEPTH + 0.14, M.white, true, false, 0.06);

  // Side curtain walls with anodized mullions & low-iron architectural glazing (split per level for cutaway)
  const sideWinMat = new THREE.MeshStandardMaterial({
    color: 0x3b4d56,
    roughness: 0.2,
    metalness: 0.08,
    envMapIntensity: 0.35,
  });
  for (let s = 0; s < FLOORS; s++) {
    const lg = levelGroups[s];
    [-1, 1].forEach((sd) => {
      const x = sd * (WIDTH / 2) - sd * 0.12;
      boxAt(lg, 0.26, LH[s], 1.2, x, LV[s] + LH[s] / 2, -0.1, M.concrete, true, true, 0.04);
      boxAt(lg, 0.09, LH[s] - 0.35, 0.5, x, LV[s] + LH[s] / 2, DEPTH - 0.4, sideWinMat, false, false);
      boxAt(lg, 0.15, 0.06, 0.58, x, LV[s] + LH[s] * 0.52, DEPTH - 0.4, M.dark, false, false, 0.01);
      boxAt(lg, 0.15, 0.06, 0.58, x, LV[s] + 0.19, DEPTH - 0.4, M.dark, false, false, 0.01);
    });
  }

  // Structural columns with shadow-gap plinth collars & capital reveals
  for (let s = 0; s < FLOORS; s++) {
    const lg = levelGroups[s];
    for (let i = 0; i <= 4; i++) {
      const x = -WIDTH / 2 + i * BW;
      if (s === 0 && i === 2) continue;
      const ch = ceilHeight(s);
      boxAt(lg, 0.26, ch, 0.5, x, LV[s] + ch / 2, 0.25, M.white, true, false, 0.04);
      boxAt(lg, 0.285, 0.06, 0.52, x, LV[s] + 0.03, 0.25, M.dark, false, false, 0.01);
      boxAt(lg, 0.285, 0.05, 0.52, x, LV[s] + ch - 0.025, 0.25, M.dark, false, false, 0.01);

      boxAt(lg, 0.28, ch, 0.28, x, LV[s] + ch / 2, DEPTH - 0.5, M.white, true, false, 0.05);
      boxAt(lg, 0.305, 0.06, 0.305, x, LV[s] + 0.03, DEPTH - 0.5, M.dark, false, false, 0.01);
      boxAt(lg, 0.305, 0.05, 0.305, x, LV[s] + ch - 0.025, DEPTH - 0.5, M.dark, false, false, 0.01);
    }
  }

  // Upper floor low-iron glass balustrades with base shoe channels, spider clamps & stainless handrails
  const bw = WIDTH - 5.2;
  for (let s = 1; s < FLOORS; s++) {
    const lg = levelGroups[s];
    const h = 1.04;
    boxAt(lg, bw, 0.065, 0.07, 0, LV[s] + 0.032, DEPTH - 0.35, M.dark, false, true, 0.01);
    const gMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, h - 0.06, 0.024), M.glass);
    gMesh.position.set(0, LV[s] + 0.06 + (h - 0.06) / 2, DEPTH - 0.35);
    lg.add(gMesh);
    boxAt(lg, bw, 0.042, 0.068, 0, LV[s] + h, DEPTH - 0.35, M.metal, false, false, 0.018);
    for (let i = 0; i <= 8; i++) {
      const x = -bw / 2 + 0.6 + (i * (bw - 1.2)) / 8;
      cylAt(lg, 0.018, 0.018, h, x, LV[s] + h / 2, DEPTH - 0.35, M.metal, false, false, 10);
      boxAt(lg, 0.055, 0.055, 0.048, x, LV[s] + 0.22, DEPTH - 0.35, M.chrome, false, false, 0.008);
      boxAt(lg, 0.055, 0.055, 0.048, x, LV[s] + 0.84, DEPTH - 0.35, M.chrome, false, false, 0.008);
    }
  }

  // Ceiling warm linear cove strips (placed in levelCeilings so cutaway opens the view)
  for (let s = 0; s < FLOORS; s++) {
    const cg = levelCeilings[s];
    const y = ceilY(s) - 0.02;
    boxAt(cg, WIDTH - 1.4, 0.05, 0.12, 0, y, 1.1, M.ledWarm, false, false);
    boxAt(cg, WIDTH - 1.4, 0.05, 0.12, 0, y, 7.2, M.ledWarm, false, false);
  }

  // Recessed balconies with rounded timber louvers & lush botanical planters
  const timberMat = new THREE.MeshStandardMaterial({
    map: M.textures.woodTex,
    normalMap: M.textures.woodNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    color: 0xc2a07a,
    roughness: 0.65,
    metalness: 0.02,
    envMapIntensity: 0.26,
  });
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x675e53, roughness: 0.88, metalness: 0.03 });
  const balconyLeafMat = new THREE.MeshStandardMaterial({
    map: leafTex('broad'),
    color: 0x458838,
    transparent: true,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.8,
  });
  const leafCardGeo = new THREE.PlaneGeometry(0.54, 0.44);

  for (let s = 1; s < FLOORS; s++) {
    const lg = levelGroups[s];
    const cg = levelCeilings[s];
    const y = LV[s];
    for (let i = 0; i < 4; i++) {
      const bx = -WIDTH / 2 + BW / 2 + i * BW;
      const bd = 1.55;
      const zf = DEPTH + 0.06;
      const zb = zf - bd;
      boxAt(lg, BW - 1.0, 0.22, bd, bx, y + 0.11, (zf + zb) / 2, M.slab, true, true, 0.04);
      boxAt(cg, BW - 1.0, 0.16, bd, bx, y + ceilHeight(s) - 0.16, (zf + zb) / 2, M.slab, false, true, 0.03);

      boxAt(lg, BW - 1.0, 0.06, 0.068, bx, y + 0.25, zf - 0.06, M.dark, false, false, 0.01);
      const bal = new THREE.Mesh(new THREE.BoxGeometry(BW - 1.0, 0.92, 0.024), M.glass);
      bal.position.set(bx, y + 0.72, zf - 0.06);
      lg.add(bal);
      boxAt(lg, BW - 1.0, 0.046, 0.072, bx, y + 1.18, zf - 0.06, M.metal, false, false, 0.018);
      for (let k = 0; k <= 6; k++) {
        cylAt(
          lg,
          0.018,
          0.018,
          0.96,
          bx - (BW - 1.0) / 2 + 0.08 + (k * (BW - 1.16)) / 6,
          y + 0.7,
          zf - 0.06,
          M.metal,
          false,
          false,
          8
        );
      }

      const screenX = bx + (BW - 1.0) / 2 - 0.08;
      for (let k = 0; k < 9; k++) {
        boxAt(
          lg,
          0.08,
          ceilHeight(s) - 0.55,
          0.16,
          screenX - 0.32 + k * 0.08,
          y + (ceilHeight(s) - 0.55) / 2 + 0.2,
          zb + 0.35,
          timberMat,
          true,
          false,
          0.015
        );
      }

      boxAt(lg, 1.55, 0.36, 0.46, bx - 1.9, y + 0.4, zf - 0.42, planterMat, true, true, 0.05);
      for (let k = 0; k < 7; k++) {
        const cm = new THREE.Mesh(leafCardGeo, balconyLeafMat);
        cm.position.set(bx - 2.48 + k * 0.19, y + 0.68 + (k % 2) * 0.06, zf - 0.42 + ((k % 3) - 1) * 0.07);
        cm.rotation.set(-0.52, (s + i + k) * 0.9, (k % 2 ? 1 : -1) * 0.35);
        lg.add(cm);
      }
    }
  }

  // Roof parapets, louvered plant screen, pergola, & planter beds
  boxAt(roofShellGroup, WIDTH + 0.4, 0.9, 0.34, 0, ROOF + 0.42, DEPTH + 0.05, M.white, true, true, 0.06);
  boxAt(roofShellGroup, 0.34, 0.9, DEPTH + 0.4, -WIDTH / 2 - 0.05, ROOF + 0.42, DEPTH / 2, M.white, true, true, 0.06);
  boxAt(roofShellGroup, 0.34, 0.9, DEPTH + 0.4, WIDTH / 2 + 0.05, ROOF + 0.42, DEPTH / 2, M.white, true, true, 0.06);

  for (let x = -WIDTH / 2 + 2; x < WIDTH / 2 - 1; x += 0.42) {
    boxAt(roofShellGroup, 0.18, 1.7, 0.14, x, ROOF + 1.05, DEPTH - 1.4, timberMat, true, false, 0.02);
  }
  for (let k = 0; k < 2; k++) {
    const pg = new THREE.Group();
    pg.position.set(-9 + k * 18, ROOF + 0.1, 5.4);
    roofShellGroup.add(pg);
    const pw = 13;
    const pd = 5.4;
    for (let c = 0; c < 5; c++) {
      boxAt(pg, 0.18, 3.2, 0.18, -pw / 2 + 1 + (c * (pw - 2)) / 4, 1.6, -pd / 2 + 0.5, M.pvFrame, false, false, 0.03);
      boxAt(pg, 0.18, 3.2, 0.18, -pw / 2 + 1 + (c * (pw - 2)) / 4, 1.6, pd / 2 - 0.5, M.pvFrame, false, false, 0.03);
    }
    for (let s2 = 0; s2 < 16; s2++) {
      const sz = -pd / 2 + 0.5 + (s2 * (pd - 1)) / 15;
      boxAt(pg, pw, 0.12, 0.34, 0, 3.25, sz, M.pvFrame, false, false, 0.025);
    }
    boxAt(pg, pw, 0.22, 0.22, 0, 3.42, -pd / 2 + 0.5, M.pvFrame, false, false, 0.03);
    boxAt(pg, pw, 0.22, 0.22, 0, 3.42, pd / 2 - 0.5, M.pvFrame, false, false, 0.03);
  }

  [
    [-15, 8.4],
    [15, 8.4],
    [-15, 2.2],
    [15, 2.2],
  ].forEach((p, i) => {
    boxAt(roofShellGroup, 2.6, 0.5, 1.0, p[0], ROOF + 0.25, p[1], planterMat, true, true, 0.06);
    for (let k = 0; k < 3; k++) {
      plant(roofShellGroup, p[0] - 0.75 + k * 0.75, ROOF + 0.45, p[1], 0.65, i * 11 + k, M);
    }
  });

  /* =========================================================
     2 · 14 DEPARTMENT BAYS
     ========================================================= */
  ROOMS.forEach((d, idx) => {
    const roomsGrp = levelGroups[d.lv];
    const ceilGrp = levelCeilings[d.lv];
    const x0 = COLX[d.col];
    const y0 = LV[d.lv];
    const h = ceilY(d.lv) - y0;
    const wallH = h - 0.06;
    const wallW = BW - 0.42;

    let wallMat: THREE.MeshStandardMaterial;
    if (d.style === 'slat') {
      wallMat = new THREE.MeshStandardMaterial({
        map: M.textures.slatTex,
        normalMap: M.textures.slatNormal,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughnessMap: M.textures.roughTex,
        roughness: 0.74,
        metalness: 0.02,
        envMapIntensity: 0.24,
        emissive: 0x26170a,
        emissiveIntensity: 0.03,
      });
    } else if (d.style === 'moss') {
      wallMat = new THREE.MeshStandardMaterial({
        map: M.textures.mossTex,
        normalMap: M.textures.mossNormal,
        normalScale: new THREE.Vector2(0.95, 0.95),
        roughnessMap: M.textures.roughTex,
        roughness: 0.96,
        metalness: 0,
        envMapIntensity: 0.08,
        emissive: 0x0d2811,
        emissiveIntensity: 0.04,
      });
    } else {
      wallMat = new THREE.MeshStandardMaterial({
        color: d.c,
        normalMap: M.textures.plasterNormal,
        normalScale: new THREE.Vector2(0.62, 0.62),
        roughnessMap: M.textures.plasterRoughness,
        roughness: 0.9,
        metalness: 0.0,
        envMapIntensity: 0.18,
        emissive: d.c,
        emissiveIntensity: 0.015,
      });
    }

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH), wallMat);
    wall.position.set(x0, y0 + wallH / 2 + 0.03, 0.22);
    wall.receiveShadow = true;
    roomsGrp.add(wall);
    picks.push({ mesh: wall, room: d });

    // Anodized shadow-gap baseboard + ceiling reveal + brushed wall switch/thermostat control plate
    boxAt(roomsGrp, wallW, 0.052, 0.035, x0, y0 + 0.026, 0.238, M.dark, false, false);
    boxAt(roomsGrp, wallW, 0.036, 0.035, x0, ceilY(d.lv) - 0.04, 0.238, M.dark, false, false);
    boxAt(roomsGrp, 0.13, 0.19, 0.018, x0 + wallW * 0.44, y0 + 1.38, 0.232, M.metal, false, false, 0.004);
    boxAt(roomsGrp, 0.075, 0.095, 0.022, x0 + wallW * 0.44, y0 + 1.39, 0.235, M.dark, false, false, 0.003);

    const bf = new THREE.Mesh(new THREE.PlaneGeometry(wallW, 6.9), M.bayFloor);
    bf.rotation.x = -Math.PI / 2;
    bf.position.set(x0, y0 + 0.035, 3.45);
    bf.receiveShadow = true;
    roomsGrp.add(bf);
    picks.push({ mesh: bf, room: d });

    // Suspended acoustic ceiling bay + recessed architectural linear LED troffers + HVAC supply diffusers
    const cp = new THREE.Mesh(new THREE.PlaneGeometry(wallW, 6.9), M.softCeil);
    cp.rotation.x = Math.PI / 2;
    cp.position.set(x0, ceilY(d.lv) - 0.06, 3.45);
    ceilGrp.add(cp);

    ceilingLinearLight(ceilGrp, x0, ceilY(d.lv) - 0.065, 2.95, wallW * 0.56, 0.2, M);
    ceilingLinearLight(ceilGrp, x0, ceilY(d.lv) - 0.065, 5.15, wallW * 0.48, 0.18, M);
    hvacDiffuser(ceilGrp, x0 - 2.65, ceilY(d.lv) - 0.062, 5.2, M);
    hvacDiffuser(ceilGrp, x0 + 2.65, ceilY(d.lv) - 0.062, 2.1, M);
    boxAt(ceilGrp, wallW, 0.08, 0.14, x0, ceilY(d.lv) - 0.07, 0.3, M.dark, false, false, 0.015);

    // Architectural bay dividing pilaster + walnut cap + recessed base
    boxAt(roomsGrp, 0.13, wallH, 6.4, x0 + BW / 2 - 0.06, y0 + wallH / 2, 3.4, M.dark, false, true, 0.02);
    boxAt(roomsGrp, 0.04, wallH - 0.12, 6.32, x0 + BW / 2 - 0.12, y0 + wallH / 2, 3.4, M.walnut, false, false, 0.01);
    boxAt(roomsGrp, 0.17, 0.055, 6.42, x0 + BW / 2 - 0.06, y0 + 0.03, 3.4, M.dark, false, false);
    boxAt(ceilGrp, 0.17, 0.055, 6.42, x0 + BW / 2 - 0.06, ceilY(d.lv) - 0.08, 3.4, M.dark, false, false);

    // Live wall TV with slim anodized bezel, wall mount shadow gap & conference soundbar
    const tvW = 4.8;
    const tvH = 2.7;
    const tvY = y0 + 2.3;
    const tvHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: M.textures.glowTex,
        color: d.soft,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    tvHalo.scale.set(tvW * 1.4, tvH * 1.4, 1);
    tvHalo.position.set(x0, tvY, 0.24);
    tvHalo.visible = false;
    roomsGrp.add(tvHalo);

    boxAt(roomsGrp, tvW * 0.45, tvH * 0.36, 0.04, x0, tvY, 0.255, M.dark, false, false);
    boxAt(roomsGrp, tvW + 0.12, tvH + 0.12, 0.065, x0, tvY, 0.305, M.black, true, false, 0.018);
    const tvMat = createWallTvMat(screenReg, d, idx);
    const tvScr = new THREE.Mesh(new THREE.PlaneGeometry(tvW, tvH), tvMat);
    tvScr.position.set(x0, tvY, 0.342);
    roomsGrp.add(tvScr);
    screenReg.wallTVs[screenReg.wallTVs.length - 1].mesh = tvScr;

    boxAt(roomsGrp, tvW * 0.54, 0.075, 0.11, x0, tvY - tvH / 2 - 0.16, 0.295, M.dark, false, false, 0.025);
    boxAt(
      roomsGrp,
      0.045,
      0.02,
      0.015,
      x0 + tvW * 0.27 - 0.18,
      tvY - tvH / 2 - 0.16,
      0.352,
      new THREE.MeshBasicMaterial({ color: d.soft, toneMapped: false }),
      false,
      false
    );

    // Manufactured architectural workstation bench (chamfered oak top + steel A-frames + acoustic screen + rolling pedestals)
    const dz = 3.95;
    const rugb = new THREE.Mesh(
      new THREE.PlaneGeometry(6.2, 3.2),
      new THREE.MeshStandardMaterial({
        map: M.textures.carpetTex,
        normalMap: M.textures.carpetNormal,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughnessMap: M.textures.carpetRoughness,
        color: 0x626772,
        roughness: 0.94,
        metalness: 0,
      })
    );
    rugb.rotation.x = -Math.PI / 2;
    rugb.position.set(x0, y0 + 0.042, 4.95);
    rugb.receiveShadow = true;
    roomsGrp.add(rugb);

    // Single crisp chamfered oak benchtop (top face sits at y0 + 0.80, matching monitor stand!)
    boxAt(roomsGrp, 6.26, 0.036, 1.4, x0, y0 + 0.782, dz, M.oakDesk, true, true, 0.012);
    contact(roomsGrp, x0, y0, dz, 7.2, 2.4, 0.45, M.textures.shadowTex);
    contact(roomsGrp, x0, y0, dz + 1.35, 6.8, 1.5, 0.35, M.textures.shadowTex);

    // Powder-coated steel A-frame legs & horizontal structural stretcher rails
    [-2.95, -0.98, 0.98, 2.95].forEach((lx) => {
      boxAt(roomsGrp, 0.045, 0.75, 0.045, x0 + lx, y0 + 0.375, dz - 0.56, M.dark, true, false, 0.008);
      boxAt(roomsGrp, 0.045, 0.75, 0.045, x0 + lx, y0 + 0.375, dz + 0.56, M.dark, true, false, 0.008);
      boxAt(roomsGrp, 0.045, 0.04, 1.18, x0 + lx, y0 + 0.745, dz, M.dark, false, false, 0.008);
      boxAt(roomsGrp, 0.04, 0.035, 1.14, x0 + lx, y0 + 0.035, dz, M.dark, false, false, 0.008);
    });
    boxAt(roomsGrp, 5.9, 0.045, 0.045, x0, y0 + 0.72, dz - 0.34, M.dark, false, false, 0.006);

    // Perforated acoustic PET felt modesty & cable privacy screen + brushed aluminum top cap
    boxAt(roomsGrp, 6.14, 0.44, 0.032, x0, y0 + 0.54, dz - 0.66, M.acousticFelt, true, true, 0.008);
    boxAt(roomsGrp, 6.16, 0.022, 0.038, x0, y0 + 0.765, dz - 0.66, M.metal, false, false, 0.005);

    // Galvanized under-desk cable tray & vertical braided cable spine
    boxAt(roomsGrp, 5.84, 0.06, 0.14, x0, y0 + 0.67, dz - 0.42, M.metal, false, false, 0.008);
    cylAt(roomsGrp, 0.026, 0.026, 0.68, x0, y0 + 0.34, dz - 0.42, M.dark, false, false, 10);

    // Compact rolling 3-drawer under-desk pedestals at outer ends (recessed drawer reveals)
    [-2.68, 2.68].forEach((px) => {
      boxAt(roomsGrp, 0.42, 0.56, 0.54, x0 + px, y0 + 0.32, dz + 0.24, M.white, true, true, 0.014);
      [0.16, 0.34, 0.5].forEach((ry) => {
        boxAt(roomsGrp, 0.38, 0.012, 0.02, x0 + px, y0 + ry, dz + 0.515, M.dark, false, false);
        boxAt(roomsGrp, 0.11, 0.014, 0.018, x0 + px, y0 + ry - 0.035, dz + 0.518, M.metal, false, false, 0.004);
      });
      // Pedestal caster gliders
      [-0.15, 0.15].forEach((cx) =>
        [-0.2, 0.2].forEach((cz) => cylAt(roomsGrp, 0.018, 0.018, 0.035, x0 + px + cx, y0 + 0.018, dz + 0.24 + cz, M.black, false, false, 8))
      );
    });

    [-2.05, 0, 2.05].forEach((ox, k) => {
      // Flush aluminum desktop power/USB grommet strip
      boxAt(roomsGrp, 0.18, 0.008, 0.085, x0 + ox, y0 + 0.801, dz - 0.16, M.metal, false, false, 0.002);
      boxAt(roomsGrp, 0.13, 0.01, 0.045, x0 + ox, y0 + 0.802, dz - 0.16, M.dark, false, false);

      const mm = monitor(roomsGrp, x0 + ox, y0 + 0.8, dz + 0.12, k === 1, 0, M, createDeskScreenMat(screenReg, d, k));
      if (d._ws && d._ws[k]) {
        d._ws[k].mesh = mm.children[3];
        const profile = getWorkstationProfile(d.t);
        const roles = [`${d.n} · Research & Browsing`, `${d.n} · ${profile.jobApp.appTabLabel}`, `${d.n} · Data Entry & QA`];
        const tasks = [
          `Researching ${profile.browserSessions[0]?.tabTitle || 'technical docs'} for ${profile.projectTitle}`,
          `${profile.jobApp.appName} · ${profile.projectTitle}`,
          `Entering live records into ${profile.dataEntry.sheetTitle}`,
        ];
        monitorPicks.push({
          id: `bay-${idx}-${k}`,
          stationKey: d.t,
          seatIndex: k,
          projectTitle: profile.projectTitle,
          meshes: [mm.children[2], mm.children[3]],
          lv: d.lv,
          zone: d.n,
          role: roles[k],
          color: `#${d.c.toString(16).padStart(6, '0')}`,
          seatX: x0 + ox,
          seatZ: dz + 0.83,
          monPos: [x0 + ox, y0 + 1.16, dz + 0.12],
          rotY: 0,
          screenRef: d._ws[k],
          screenTask: tasks[k],
        });
      }
      addTrackedChair(roomsGrp, x0 + ox, y0, dz + 0.83, Math.PI, d.lv, 1, 0.48, (idx + k) % 2 ? 1 : -1);
    });

    shelfUnit(roomsGrp, x0 + (d.col % 2 ? -1 : 1) * 4.15, y0, 0.95, 1.55, M);
    plant(roomsGrp, x0 + (d.col % 2 ? 1 : -1) * 4.05, y0, 1.25, 1.05, idx + 1, M);
    plant(roomsGrp, x0 + (d.col % 2 ? -1 : 1) * 4.55, y0, 8.9, 1.35, idx + 7, M);

    if (idx === 1 || idx === 9) armchair(roomsGrp, x0 + 3.5, y0, 6.6, -0.5, M.fabricGrey, M);
    if (idx === 11) sofaWide(roomsGrp, x0 + 2.4, y0, 7.2, -0.25, M.fabricBlue, M);

    downlight(ceilGrp, x0 - 2.7, ceilY(d.lv) - 0.06, 2.2, M);
    downlight(ceilGrp, x0 + 2.7, ceilY(d.lv) - 0.06, 5.4, M);
    downlight(ceilGrp, x0, ceilY(d.lv) - 0.06, 8.4, M);
  });

  /* =========================================================
     3 · RECEPTION ATRIUM (CURVED FLUTED COUNTER + SCULPTURE)
     ========================================================= */
  const rec = new THREE.Group();
  levelGroups[0].add(rec);
  const cy0 = ceilY(0);

  const recFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(19.6, 10.9),
    new THREE.MeshStandardMaterial({
      map: M.textures.marbleTex,
      normalMap: M.textures.marbleNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: M.textures.marbleRoughness,
      color: 0xa6a198,
      roughness: 0.54,
      metalness: 0.0,
      envMapIntensity: 0.22,
    })
  );
  recFloor.rotation.x = -Math.PI / 2;
  recFloor.position.set(0, 0.022, 5.5);
  recFloor.receiveShadow = true;
  rec.add(recFloor);
  picks.push({
    mesh: recFloor,
    room: { n: 'Reception Atrium', c: 0x4ea8ff, lv: 0, cx: 0, sub: 'Level 0 · Ground Reception' },
  });

  boxAt(rec, 5.7, cy0, 0.18, -7.15, cy0 / 2, 0.2, M.slat, false, true);
  boxAt(rec, 5.7, cy0, 0.18, 7.15, cy0 / 2, 0.2, M.slat, false, true);
  boxAt(rec, 8.6, cy0, 0.22, 0, cy0 / 2, 0.24, M.slate, false, true);

  [-4.15, 4.15].forEach((x) => {
    boxAt(rec, 0.08, cy0 - 1.0, 0.045, x, cy0 / 2 - 0.1, 0.36, M.ledWarm, false, false);
  });

  const signTex = makeCanvasTex('brandsign', 2048, 304, (gc, W, H) => {
    const lW = W / 2;
    const lH = H / 2;
    gc.save();
    gc.setTransform(2, 0, 0, 2, 0, 0);
    gc.clearRect(0, 0, lW, lH);
    gc.fillStyle = '#ffffff';
    gc.textAlign = 'center';
    gc.textBaseline = 'middle';
    gc.font = '700 58px "Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif';
    gc.shadowColor = 'rgba(0, 0, 0, 0.75)';
    gc.shadowBlur = 8;
    gc.fillText('DOMAINTECHHUB OFFICE', lW / 2, lH / 2 + 2);
    gc.shadowBlur = 0;
    gc.fillStyle = '#6fe3a1';
    gc.fillRect(lW / 2 - 96, lH - 18, 192, 4);
    gc.restore();
  });
  const brandSign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 0.8),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false })
  );
  brandSign.position.set(0, 4.62, 0.4);
  rec.add(brandSign);

  // Sculptural rotating Earth globe centerpiece above Reception
  const sculptureGroup = new THREE.Group();
  sculptureGroup.position.set(0, 2.75, 0.95);
  rec.add(sculptureGroup);

  const earthTex = makeCanvasTex('earth-globe-color', 1024, 512, (gc, W, H) => {
    const oceanGrad = gc.createLinearGradient(0, 0, 0, H);
    oceanGrad.addColorStop(0, '#135ba8');
    oceanGrad.addColorStop(0.5, '#1974cc');
    oceanGrad.addColorStop(1, '#11549e');
    gc.fillStyle = oceanGrad;
    gc.fillRect(0, 0, W, H);

    // Subtle ocean bathymetry shimmer
    for (let i = 0; i < 60; i++) {
      const rx = rndN(i * 7 + 1) * W;
      const ry = H * (0.15 + rndN(i * 11 + 3) * 0.7);
      const rad = 28 + rndN(i * 13 + 5) * 65;
      const rg = gc.createRadialGradient(rx, ry, 2, rx, ry, rad);
      rg.addColorStop(0, 'rgba(52, 152, 232, 0.24)');
      rg.addColorStop(1, 'rgba(19, 91, 168, 0)');
      gc.fillStyle = rg;
      gc.fillRect(rx - rad, ry - rad, rad * 2, rad * 2);
    }

    const drawPoly = (pts: Array<[number, number]>, fill: string, shadow = false) => {
      gc.beginPath();
      pts.forEach(([lx, ly], idx) => {
        const px = lx * W;
        const py = ly * H;
        if (idx === 0) gc.moveTo(px, py);
        else gc.lineTo(px, py);
      });
      gc.closePath();
      if (shadow) {
        // Turquoise shallow coastal shelf halo
        gc.save();
        gc.strokeStyle = 'rgba(72, 188, 224, 0.42)';
        gc.lineWidth = 10;
        gc.lineJoin = 'round';
        gc.stroke();
        gc.restore();
      }
      gc.fillStyle = fill;
      gc.fill();
    };

    // North America
    drawPoly(
      [
        [0.08, 0.22], [0.16, 0.16], [0.26, 0.17], [0.33, 0.23], [0.3, 0.31],
        [0.26, 0.38], [0.23, 0.45], [0.27, 0.49], [0.24, 0.51], [0.19, 0.44],
        [0.14, 0.36], [0.1, 0.29],
      ],
      '#39964c',
      true
    );
    // Greenland
    drawPoly([[0.32, 0.11], [0.4, 0.1], [0.42, 0.18], [0.35, 0.21]], '#e8f2ec', true);
    // South America
    drawPoly(
      [
        [0.27, 0.52], [0.34, 0.54], [0.38, 0.62], [0.35, 0.72],
        [0.31, 0.84], [0.28, 0.85], [0.26, 0.7], [0.25, 0.58],
      ],
      '#359247',
      true
    );
    // Europe
    drawPoly(
      [
        [0.45, 0.21], [0.53, 0.18], [0.58, 0.22], [0.57, 0.3],
        [0.52, 0.33], [0.46, 0.32], [0.44, 0.26],
      ],
      '#46a355',
      true
    );
    // UK & Ireland
    drawPoly([[0.43, 0.23], [0.45, 0.23], [0.45, 0.27], [0.43, 0.27]], '#4aa659', true);
    // Africa
    drawPoly(
      [
        [0.45, 0.36], [0.54, 0.36], [0.59, 0.42], [0.62, 0.49],
        [0.59, 0.59], [0.55, 0.73], [0.51, 0.74], [0.48, 0.61],
        [0.44, 0.51], [0.43, 0.43],
      ],
      '#3e9b4e',
      true
    );
    // Madagascar
    drawPoly([[0.61, 0.63], [0.63, 0.63], [0.62, 0.7], [0.6, 0.69]], '#48a457', true);
    // Asia
    drawPoly(
      [
        [0.57, 0.18], [0.7, 0.16], [0.84, 0.2], [0.89, 0.27],
        [0.84, 0.37], [0.78, 0.44], [0.74, 0.51], [0.69, 0.48],
        [0.64, 0.43], [0.58, 0.37], [0.56, 0.28],
      ],
      '#379148',
      true
    );
    // SE Asia & Japan islands
    drawPoly([[0.86, 0.31], [0.89, 0.29], [0.88, 0.36], [0.85, 0.36]], '#4ca65a', true);
    drawPoly([[0.76, 0.53], [0.82, 0.54], [0.83, 0.58], [0.75, 0.57]], '#48a156', true);
    // Australia & New Zealand
    drawPoly(
      [
        [0.77, 0.64], [0.86, 0.63], [0.89, 0.71], [0.85, 0.78], [0.77, 0.75],
      ],
      '#58a852',
      true
    );
    drawPoly([[0.92, 0.76], [0.94, 0.75], [0.93, 0.81], [0.91, 0.8]], '#52a65c', true);

    // Lush green biome shading & highland variation inside continents
    gc.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 42; i++) {
      const lx = rndN(i * 19 + 4) * W;
      const ly = H * (0.18 + rndN(i * 23 + 9) * 0.64);
      const rad = 18 + rndN(i * 29 + 2) * 34;
      gc.fillStyle = i % 2 === 0 ? 'rgba(116, 196, 98, 0.22)' : 'rgba(28, 108, 48, 0.22)';
      gc.beginPath();
      gc.arc(lx, ly, rad, 0, Math.PI * 2);
      gc.fill();
    }
    gc.globalCompositeOperation = 'source-over';

    // White polar ice caps (Arctic & Antarctica)
    const iceTop = gc.createLinearGradient(0, 0, 0, H * 0.13);
    iceTop.addColorStop(0, '#f8fbff');
    iceTop.addColorStop(0.65, '#eef6ff');
    iceTop.addColorStop(1, 'rgba(238, 246, 255, 0)');
    gc.fillStyle = iceTop;
    gc.fillRect(0, 0, W, H * 0.13);

    const iceBot = gc.createLinearGradient(0, H * 0.85, 0, H);
    iceBot.addColorStop(0, 'rgba(238, 246, 255, 0)');
    iceBot.addColorStop(0.35, '#eef6ff');
    iceBot.addColorStop(1, '#f8fbff');
    gc.fillStyle = iceBot;
    gc.fillRect(0, H * 0.85, W, H * 0.15);

    // White atmospheric cloud bands swirling gently over oceans & continents
    for (let i = 0; i < 46; i++) {
      const cx = rndN(i * 31 + 2) * W;
      const cy = H * (0.14 + rndN(i * 37 + 5) * 0.72);
      const cw = 48 + rndN(i * 41 + 8) * 110;
      const ch = 10 + rndN(i * 43 + 11) * 18;
      const cg = gc.createRadialGradient(cx, cy, 2, cx, cy, cw * 0.55);
      cg.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
      cg.addColorStop(0.6, 'rgba(244, 249, 255, 0.34)');
      cg.addColorStop(1, 'rgba(255, 255, 255, 0)');
      gc.fillStyle = cg;
      gc.save();
      gc.translate(cx, cy);
      gc.rotate((rndN(i * 17) - 0.5) * 0.35);
      gc.scale(1, ch / cw);
      gc.beginPath();
      gc.arc(0, 0, cw * 0.55, 0, Math.PI * 2);
      gc.fill();
      gc.restore();
    }
  });
  earthTex.colorSpace = THREE.SRGBColorSpace;

  const sculptureCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 40, 24),
    new THREE.MeshStandardMaterial({
      map: earthTex,
      emissiveMap: earthTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.12,
      roughness: 0.62,
      metalness: 0.02,
      envMapIntensity: 0.28,
    })
  );
  sculptureGroup.add(sculptureCore);

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.03, 16, 48), M.brass);
  ring1.rotation.set(0.65, 0.2, 0.15);
  sculptureGroup.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.024, 14, 52), M.metal);
  ring2.rotation.set(-0.55, 0.4, 0.4);
  sculptureGroup.add(ring2);

  const sculptureHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: M.textures.glowTex,
      color: 0x4ea8ff,
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sculptureHalo.scale.set(3.2, 3.2, 1);
  sculptureHalo.position.copy(sculptureGroup.position);
  rec.add(sculptureHalo);

  // Sculptural brushed brass architectural wall cantilever struts anchoring the centerpiece
  [-1.08, 1.08].forEach((ox) => {
    boxAt(rec, 0.045, 0.045, 0.72, ox, 2.75, 0.59, M.brass, false, false, 0.008);
    cylAt(rec, 0.055, 0.055, 0.03, ox, 2.75, 0.25, M.dark, false, false, 12);
  });

  // Curved reception counter with vertical fluted walnut ribs & beveled marble top
  const a0 = -Math.PI / 2 - 0.39;
  const a1 = -Math.PI / 2 + 0.39;
  const cz = -2.5;
  rec.add(curvedSlab(8.15, 9.0, a0, a1, 1.02, 0, 0, cz, M.marble, 0.02));
  rec.add(curvedSlab(8.05, 9.12, a0, a1, 0.08, 1.02, 0, cz, M.white, 0.025));
  rec.add(curvedSlab(8.08, 8.12, a0, a1, 0.04, 0.6, 0, cz, M.ledWarm, 0.005));
  rec.add(curvedSlab(8.18, 8.22, a0, a1, 0.4, 0.24, 0, cz, M.brass, 0.01));

  // Individual physical walnut vertical flutes along the outer counter curve
  const fluteGeo = getRoundedBox(0.065, 0.96, 0.055, 0.015, 2);
  for (let i = 0; i <= 32; i++) {
    const a = a0 + ((a1 - a0) * i) / 32;
    const fx = Math.cos(a) * 9.04;
    const fz = cz - Math.sin(a) * 9.04;
    const flute = new THREE.Mesh(fluteGeo, M.walnut);
    flute.position.set(fx, 0.51, fz);
    flute.rotation.y = a + Math.PI / 2;
    flute.castShadow = true;
    rec.add(flute);
  }
  contact(rec, 0, 0.02, 5.9, 9.0, 3.4, 0.55, M.textures.shadowTex);

  exMon(rec, -1.35, 1.125, 6.02, Math.PI - 0.14, 'reception', 0, {
    lv: 0,
    zone: 'DomainTechHub Reception',
    role: 'Front Desk Receptionist',
    color: '#4ea8ff',
    seatX: -1.32,
    seatZ: 5.26,
    screenTask: 'Managing today’s visitor check-ins & lobby arrivals',
  });
  exMon(rec, 1.35, 1.125, 6.02, Math.PI + 0.14, 'reception', 1, {
    lv: 0,
    zone: 'DomainTechHub Reception',
    role: 'Front Desk Concierge',
    color: '#4ea8ff',
    seatX: -1.32,
    seatZ: 5.26,
    screenTask: 'Notifying department teams in #front-desk-arrivals',
  });

  const rp = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.29),
    new THREE.MeshBasicMaterial({ map: plateTex('Reception'), transparent: true, toneMapped: false, depthWrite: false })
  );
  rp.position.set(0, 1.86, 0.2);
  rec.add(rp);

  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.5, 40), M.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.scale.set(1.35, 1, 1);
  rug.position.set(0, 0.03, 8.3);
  rug.receiveShadow = true;
  rec.add(rug);

  armchair(rec, -2.55, 0, 8.5, Math.PI / 2, M.fabricBlue, M);
  armchair(rec, 2.55, 0, 8.5, -Math.PI / 2, M.fabricBlue, M);

  const lobbyTable = new THREE.Group();
  lobbyTable.position.set(0, 0, 8.55);
  cylAt(lobbyTable, 0.78, 0.78, 0.08, 0, 0.46, 0, M.walnut, true, true, 24);
  cylAt(lobbyTable, 0.09, 0.1, 0.42, 0, 0.23, 0, M.brass, false, false, 16);
  cylAt(lobbyTable, 0.34, 0.44, 0.05, 0, 0.025, 0, M.metal, false, false, 20);
  plant(lobbyTable, 0, 0.5, 0, 0.44, 3.3, M, 'olive');
  rec.add(lobbyTable);

  [
    [-8.4, 1.3, 1.55],
    [-8.6, 9.0, 1.35],
    [8.4, 1.3, 1.55],
    [8.6, 9.0, 1.35],
  ].forEach((p) => plant(rec, p[0], 0, p[1], p[2], p[1] * 3 + 2, M));

  [
    [-9.3, -1],
    [9.3, 1],
  ].forEach((p) => {
    boxAt(rec, 0.9, 0.5, 3.6, p[0], 0.25, 7.6, M.white, true, true, 0.06);
    for (let k = 0; k < 4; k++) plant(rec, p[0], 0.5, 6.5 + k * 0.75, 0.55, p[1] + k, M);
  });

  const warmL = new THREE.PointLight(0xffb469, 1.6, 20, 2);
  warmL.position.set(-5.2, 3.4, 3.2);
  rec.add(warmL);
  interiorWarmLights.push(warmL);

  const warmR = new THREE.PointLight(0xffb469, 1.6, 20, 2);
  warmR.position.set(5.2, 3.4, 3.2);
  rec.add(warmR);
  interiorWarmLights.push(warmR);

  const violetL = new THREE.PointLight(0x64b5ff, 1.15, 11, 2);
  violetL.position.set(0, 3.1, 1.7);
  rec.add(violetL);

  const cove = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffd9a8,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    })
  );
  cove.visible = false;
  cove.rotation.x = Math.PI / 2;
  cove.position.set(0, cy0 - 0.04, 5.0);
  levelCeilings[0].add(cove);

  /* =========================================================
     4 · LEVEL 4 BOARD ROOM & LEVEL 5 EXECUTIVE OFFICES
     ========================================================= */
  const ex4 = new THREE.Group();
  const ex5 = new THREE.Group();
  levelGroups[4].add(ex4);
  levelGroups[5].add(ex5);
  const exForY = (y: number) => (y >= LV[5] - 0.2 ? ex5 : ex4);
  const exCeilForY = (y: number) => (y >= LV[5] - 0.2 ? levelCeilings[5] : levelCeilings[4]);
  const CH = 3.8;
  const repTex = (t: THREE.Texture, rx: number, ry: number) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    return c;
  };
  const walnutFloorMat = M.parquet;
  const carpetExecMat = M.execCarpet;
  const stoneExecMat = M.slate;
  const glassWallMat = new THREE.MeshStandardMaterial({
    color: 0xc8dad8,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    envMapIntensity: 0.32,
    depthWrite: false,
  });
  const slatW = (w: number) =>
    new THREE.MeshStandardMaterial({
      map: repTex(M.textures.slatTex, Math.max(1, w * 0.42), 1),
      normalMap: repTex(M.textures.slatNormal, Math.max(1, w * 0.42), 1),
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: repTex(M.textures.roughTex, Math.max(1, w * 0.42), 1),
      roughness: 0.74,
      metalness: 0.02,
      envMapIntensity: 0.24,
      emissive: 0x26170a,
      emissiveIntensity: 0.03,
    });

  const exPlane = (w: number, h: number, x: number, y: number, z: number, mat: THREE.Material, rx?: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    exForY(y).add(m);
    return m;
  };
  const floorCeil = (y0: number, fmat: THREE.Material) => {
    exPlane(39.2, 10.4, 0, y0 + 0.035, 5.3, fmat, -Math.PI / 2).receiveShadow = true;
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(39.2, 10.4), M.softCeil);
    cm.position.set(0, y0 + CH - 0.06, 5.3);
    cm.rotation.x = Math.PI / 2;
    exCeilForY(y0).add(cm);
    boxAt(exCeilForY(y0), 39.2, 0.09, 0.14, 0, y0 + CH - 0.07, 0.3, M.dark, false, false, 0.015);
    [-14, -4, 6, 15].forEach((hx) => hvacDiffuser(exCeilForY(y0), hx, y0 + CH - 0.062, 7.6, M));
  };
  const execFloorPickMat = new THREE.MeshBasicMaterial({ visible: false });
  const exWall = (y0: number, cx: number, w: number, mat: THREE.Material, room?: ExecRoomDef | null) => {
    const h = CH - 0.06;
    const m = exPlane(w, h, cx, y0 + h / 2 + 0.03, 0.22, mat);
    m.receiveShadow = true;
    boxAt(exForY(y0), w, 0.05, 0.035, cx, y0 + 0.025, 0.238, M.dark, false, false);
    if (room) {
      picks.push({ mesh: m, room });
      const fp = exPlane(w, 9.6, cx, y0 + 0.07, 5.0, execFloorPickMat, -Math.PI / 2);
      picks.push({ mesh: fp, room });
    }
    return m;
  };
  const partition = (y0: number, x: number) => {
    const grp = exForY(y0);
    const h = CH - 0.1;
    const seg = (z0: number, z1: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.026, h, z1 - z0), glassWallMat);
      m.position.set(x, y0 + h / 2 + 0.03, (z0 + z1) / 2);
      grp.add(m);
    };
    seg(0.4, 4.0);
    seg(5.4, 9.4);
    // Frameless glass door leaf with tubular brushed-brass pull handles + hydraulic closer
    const doorPivot = new THREE.Group();
    doorPivot.position.set(x, y0 + 0.06, 4.02);
    doorPivot.rotation.y = 0.1;
    const doorPane = new THREE.Mesh(new THREE.BoxGeometry(0.024, h - 0.12, 1.34), glassWallMat);
    doorPane.position.set(0, (h - 0.12) / 2, 0.67);
    doorPivot.add(doorPane);
    cylAt(doorPivot, 0.014, 0.014, 0.88, -0.055, 1.15, 1.16, M.brass, false, false, 10);
    cylAt(doorPivot, 0.014, 0.014, 0.88, 0.055, 1.15, 1.16, M.brass, false, false, 10);
    boxAt(doorPivot, 0.07, 0.055, 0.22, 0, h - 0.15, 0.14, M.dark, false, false, 0.01);
    grp.add(doorPivot);

    // Dark anodized aluminum perimeter channels with brushed brass inlay strip
    boxAt(grp, 0.065, 0.055, 9.0, x, y0 + h + 0.03, 4.9, M.dark, false, false, 0.01);
    boxAt(grp, 0.065, 0.055, 9.0, x, y0 + 0.055, 4.9, M.dark, false, false, 0.01);
    [0.4, 4.0, 5.4, 9.4].forEach((z) => {
      boxAt(grp, 0.055, h, 0.045, x, y0 + h / 2 + 0.03, z, M.dark, false, false, 0.01);
      boxAt(grp, 0.062, 0.055, 0.06, x, y0 + 0.35, z, M.brass, false, false, 0.006);
      boxAt(grp, 0.062, 0.055, 0.06, x, y0 + h - 0.3, z, M.brass, false, false, 0.006);
    });
  };
  const exSign = (name: string, x: number, y: number) => {
    const pw = Math.min(3.8, name.length * 0.17 + 1.05);
    exPlane(
      pw,
      0.52,
      x,
      y,
      0.3,
      new THREE.MeshBasicMaterial({ map: plateTex(name), transparent: true, toneMapped: false, depthWrite: false })
    );
  };
  const exChair = (
    x: number,
    y0: number,
    z: number,
    rot: number,
    s = 1,
    track = false,
    maxPush = 0.48,
    swivelDir = 1
  ) => {
    const lv = y0 >= LV[5] - 0.2 ? 5 : 4;
    if (track) return addTrackedChair(exForY(y0), x, y0, z, rot, lv, s, maxPush, swivelDir);
    const c = officeChair(exForY(y0), x, y0, z, rot, M);
    c.scale.setScalar(s);
    return c;
  };
  const exDesk = (x: number, z: number, w: number, y0: number) => {
    const grp = exForY(y0);
    // Chamfered architectural walnut desktop (top sits at y0 + 0.80) + leather executive blotter
    boxAt(grp, w, 0.042, 1.2, x, y0 + 0.779, z, M.walnut, true, true, 0.014);
    boxAt(grp, 0.82, 0.006, 0.42, x, y0 + 0.802, z - 0.14, M.leatherMat, false, true, 0.002);
    // Recessed anodized steel blade legs + privacy panel
    boxAt(grp, w - 0.36, 0.44, 0.034, x, y0 + 0.51, z + 0.52, M.dark, false, false, 0.008);
    [-1, 1].forEach((s) => boxAt(grp, 0.048, 0.75, 0.96, x + s * (w / 2 - 0.2), y0 + 0.375, z, M.dark, true, false, 0.01));
    // Compact side credenza drawer pedestal with recessed reveals & brass pulls
    const pedX = x + (w / 2 - 0.38);
    boxAt(grp, 0.46, 0.58, 0.88, pedX, y0 + 0.34, z + 0.06, M.walnut, true, true, 0.014);
    [0.16, 0.35, 0.53].forEach((ry) => {
      boxAt(grp, 0.42, 0.012, 0.02, pedX, y0 + ry, z - 0.382, M.dark, false, false);
      boxAt(grp, 0.12, 0.014, 0.018, pedX, y0 + ry - 0.035, z - 0.386, M.brass, false, false, 0.004);
    });
    contact(grp, x, y0, z, w + 1.2, 2.2, 0.45, M.textures.shadowTex);
  };
  const exLights = (y0: number, xs: number[], zs: number[]) =>
    xs.forEach((x) => zs.forEach((z) => downlight(exCeilForY(y0), x, y0 + CH - 0.06, z, M)));
  const floorLamp = (x: number, y0: number, z: number) => {
    const grp = exForY(y0);
    cylAt(grp, 0.024, 0.028, 1.48, x, y0 + 0.75, z, M.brass, false, false, 12);
    const shade = new THREE.Mesh(getLampShadeGeo(), M.lamp);
    shade.position.set(x, y0 + 1.38, z);
    grp.add(shade);
    cylAt(grp, 0.2, 0.22, 0.03, x, y0 + 0.015, z, M.brass, false, true, 16);
  };
  const sideTable = (x: number, y0: number, z: number) => {
    const grp = exForY(y0);
    cylAt(grp, 0.36, 0.36, 0.05, x, y0 + 0.5, z, M.walnut, true, true, 20);
    cylAt(grp, 0.045, 0.05, 0.48, x, y0 + 0.25, z, M.brass, false, false, 12);
    cylAt(grp, 0.2, 0.22, 0.025, x, y0 + 0.015, z, M.brass, false, false, 16);
  };
  const paArea = (y0: number, cx: number, w: number, label: string, room: ExecRoomDef | null, seed: number) => {
    const grp = exForY(y0);
    exWall(y0, cx, w, slatW(w), room);
    exSign(label, cx, y0 + 3.15);
    exDesk(cx, 3.4, 2.2, y0);
    exChair(cx, y0, 2.58, 0, 1, true, 0.48, seed % 2 ? 1 : -1);
    exMon(grp, cx, y0 + 0.8, 3.3, Math.PI, 'pa', 0, {
      lv: y0 >= LV[5] - 0.2 ? 5 : 4,
      zone: label,
      role: label,
      color: '#5d6b7a',
      seatX: cx,
      seatZ: 2.58,
      screenTask: 'Managing weekly executive calendar & meeting prep',
    });
    armchair(grp, cx - 1.9, y0, 6.6, Math.PI - 0.35, M.fabricGrey, M);
    armchair(grp, cx + 1.9, y0, 6.6, Math.PI + 0.35, M.fabricGrey, M);
    sideTable(cx, y0, 6.7);
    plant(grp, cx + w / 2 - 0.9, y0, 1.1, 1.1, seed, M);
    plant(grp, cx - w / 2 + 0.9, y0, 8.9, 1.2, seed + 3, M);
    exLights(y0, [cx - 2, cx + 2], [2.4, 6.0]);
  };

  // Level 4 · Board Room, Executive Lounge & Secretary
  {
    const y0 = LV[4];
    floorCeil(y0, walnutFloorMat);
    exWall(y0, -15, 10, slatW(10), EXEC.lounge);
    exWall(y0, 0, 20, stoneExecMat, EXEC.board);
    partition(y0, -10);
    partition(y0, 10);

    const boardScrMat = createBoardScreenMat(screenReg);
    boxAt(ex4, 7.5, 2.55, 0.07, 0, y0 + 2.15, 0.3, M.black, false, false, 0.025);
    exPlane(7.2, 2.4, 0, y0 + 2.15, 0.34, boardScrMat);
    exSign('Board Room', 0, y0 + 3.5);
    boxAt(ex4, 8.0, 0.62, 0.5, 0, y0 + 0.31, 0.62, M.walnut, true, true, 0.035);
    boxAt(ex4, 8.0, 0.04, 0.52, 0, y0 + 0.64, 0.62, M.brass, false, false, 0.015);
    plant(ex4, -4.6, y0 + 0.64, 0.65, 0.7, 31, M);
    plant(ex4, 4.6, y0 + 0.64, 0.65, 0.7, 37, M);

    // Sculpted boat-shaped conference table
    const tz = 4.9;
    const tblMesh = new THREE.Mesh(makeBoatTableGeo(11.8, 2.55, 1.75, 0.075), M.walnut);
    tblMesh.position.set(0, y0 + 0.72, tz);
    tblMesh.castShadow = true;
    tblMesh.receiveShadow = true;
    ex4.add(tblMesh);
    [-4.3, 4.3].forEach((px) => cylAt(ex4, 0.42, 0.54, 0.7, px, y0 + 0.36, tz, M.dark, true, false, 20));
    contact(ex4, 0, y0, tz, 13.8, 3.8, 0.5, M.textures.shadowTex);

    for (let i = 0; i < 7; i++) {
      const x = -5.4 + i * 1.8;
      exChair(x, y0, 3.26, 0, 1.05, true, 0.44, i % 2 ? 1 : -1);
      exChair(x, y0, 6.54, Math.PI, 1.05, true, 0.44, i % 2 ? -1 : 1);
      // Leather desk blotter + crisp white portfolio notepad
      boxAt(ex4, 0.42, 0.01, 0.28, x, y0 + 0.805, tz - 0.72, M.leatherMat, false, false, 0.004);
      boxAt(ex4, 0.3, 0.014, 0.21, x, y0 + 0.815, tz - 0.72, M.white, false, false, 0.004);
      boxAt(ex4, 0.42, 0.01, 0.28, x, y0 + 0.805, tz + 0.72, M.leatherMat, false, false, 0.004);
      boxAt(ex4, 0.3, 0.014, 0.21, x, y0 + 0.815, tz + 0.72, M.white, false, false, 0.004);
    }
    exChair(-6.58, y0, tz, Math.PI / 2, 1.1, true, 0.44, 1);
    exChair(6.58, y0, tz, -Math.PI / 2, 1.1, true, 0.44, -1);
    cylAt(ex4, 0.22, 0.24, 0.05, 0, y0 + 0.825, tz, M.dark, false, false, 20);
    [-2.4, 2.4].forEach((x) => {
      const car = new THREE.Mesh(getCarafeGeo(), M.metal);
      car.position.set(x, y0 + 0.8, tz);
      car.castShadow = true;
      ex4.add(car);
    });
    ceilingLinearLight(levelCeilings[4], 0, y0 + CH - 0.28, tz, 8.2, 0.24, M);
    [-3.5, 3.5].forEach((x) => cylAt(levelCeilings[4], 0.01, 0.01, 0.24, x, y0 + CH - 0.14, tz, M.brass, false, false, 8));
    exLights(y0, [-7, -3.5, 0, 3.5, 7], [3.0, 6.8]);

    // Executive Lounge & Espresso Bar
    exSign('Executive Lounge', -15, y0 + 3.5);
    boxAt(ex4, 4.6, 0.95, 0.6, -17.6, y0 + 0.475, 1.0, M.dark, true, true, 0.035);
    boxAt(ex4, 4.8, 0.06, 0.76, -17.6, y0 + 0.98, 1.0, M.marble, true, true, 0.025);
    boxAt(ex4, 0.6, 0.44, 0.44, -19.0, y0 + 1.23, 1.0, M.metal, true, false, 0.04);
    [-17.8, -17.4, -17.0].forEach((x) => cylAt(ex4, 0.048, 0.036, 0.09, x, y0 + 1.05, 1.1, M.ceramicMat, false, false, 14));
    [-18.8, -17.6, -16.4].forEach((x) => {
      cylAt(ex4, 0.036, 0.042, 0.7, x, y0 + 0.38, 2.1, M.metal, false, false, 12);
      cylAt(ex4, 0.22, 0.2, 0.07, x, y0 + 0.76, 2.1, M.leatherMat, true, true, 18);
    });
    contact(ex4, -17.6, y0, 1.8, 5.4, 2.6, 0.5, M.textures.shadowTex);
    sofaWide(ex4, -12.6, y0, 3.0, 0, M.fabricBlue, M);
    boxAt(ex4, 1.7, 0.06, 0.95, -12.6, y0 + 0.42, 5.0, M.walnut, true, true, 0.03);
    [
      [-13.3, 4.65],
      [-11.9, 4.65],
      [-13.3, 5.35],
      [-11.9, 5.35],
    ].forEach((p) => cylAt(ex4, 0.024, 0.018, 0.4, p[0], y0 + 0.2, p[1], M.metal, false, false, 8));
    armchair(ex4, -14.3, y0, 5.0, Math.PI / 2, M.fabricGrey, M);
    armchair(ex4, -11.0, y0, 5.0, -Math.PI / 2, M.fabricGrey, M);
    exPlane(
      4.2,
      3.6,
      -12.6,
      y0 + 0.06,
      4.4,
      new THREE.MeshStandardMaterial({
        map: M.textures.carpetTex,
        normalMap: M.textures.carpetNormal,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughnessMap: M.textures.carpetRoughness,
        color: 0x525c70,
        roughness: 0.96,
      }),
      -Math.PI / 2
    );
    plant(ex4, -19.2, y0, 8.6, 1.35, 41, M);
    plant(ex4, -10.8, y0, 1.2, 1.0, 43, M);
    exLights(y0, [-17, -13], [2.4, 6.0]);

    paArea(y0, 15, 10, 'Board Secretary', EXEC.secr, 51);
    shelfUnit(ex4, 19.0, y0, 0.55, 1.3, M);
  }

  // Level 5 · CEO & Heads of Department
  {
    const y0 = LV[5];
    floorCeil(y0, carpetExecMat);
    exPlane(14, 10.4, 13, y0 + 0.045, 5.3, walnutFloorMat, -Math.PI / 2).receiveShadow = true;
    [-15, -10, -5, 0, 6].forEach((x) => partition(y0, x));

    (
      [
        ['tech', -17.5],
        ['mkt', -12.5],
        ['fin', -7.5],
        ['ops', -2.5],
      ] as const
    ).forEach(([key, cx], i) => {
      const room = EXEC[key];
      exWall(y0, cx, 5, slatW(5), room);
      boxAt(ex5, 4.4, 0.07, 0.05, cx, y0 + 3.62, 0.28, new THREE.MeshBasicMaterial({ color: room.c, toneMapped: false }), false, false);
      exSign(room.n, cx, y0 + 3.2);
      exDesk(cx, 3.5, 2.2, y0);
      exChair(cx, y0, 2.66, 0, 1.1, true, 0.48, i % 2 ? 1 : -1);
      exMon(ex5, cx, y0 + 0.8, 3.4, Math.PI, key, 0, {
        lv: 5,
        zone: room.n,
        role: room.n,
        color: `#${room.c.toString(16).padStart(6, '0')}`,
        seatX: cx,
        seatZ: 2.66,
        screenTask: `Reviewing ${room.n} weekly roadmap & executive calls`,
      });
      exChair(cx - 0.8, y0, 5.4, Math.PI, 1);
      exChair(cx + 0.8, y0, 5.4, Math.PI, 1);
      shelfUnit(ex5, cx + 1.7, y0, 0.55, 1.1, M);
      plant(ex5, cx - 1.9, y0, 1.0, 0.9, 60 + i * 5, M);
      exPlane(
        3.4,
        2.6,
        cx,
        y0 + 0.06,
        4.4,
        new THREE.MeshStandardMaterial({
          map: M.textures.carpetTex,
          normalMap: M.textures.carpetNormal,
          normalScale: new THREE.Vector2(0.65, 0.65),
          roughnessMap: M.textures.carpetRoughness,
          color: 0x525866,
          roughness: 0.96,
        }),
        -Math.PI / 2
      );
      exLights(y0, [cx], [2.6, 5.6]);
    });

    paArea(y0, 3, 6, 'Executive Assistant', null, 70);

    const cx = 13;
    exWall(y0, cx, 14, slatW(14), EXEC.ceo);
    boxAt(ex5, 13.2, 0.07, 0.05, cx, y0 + 3.62, 0.28, new THREE.MeshBasicMaterial({ color: EXEC.ceo.c, toneMapped: false }), false, false);
    exSign('Chief Executive Officer', cx, y0 + 3.2);

    const artTex = makeCanvasTex('ceoart', 200, 280, (c, W, H) => {
      const gr = c.createLinearGradient(0, 0, W, H);
      gr.addColorStop(0, '#0f2a44');
      gr.addColorStop(1, '#1f6a5a');
      c.fillStyle = gr;
      c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(201,162,75,0.9)';
      c.beginPath();
      c.arc(W * 0.62, H * 0.36, 46, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.14)';
      c.fillRect(0, H * 0.62, W, H * 0.38);
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.lineWidth = 3;
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.moveTo(0, H * 0.66 + k * 16);
        c.bezierCurveTo(W * 0.3, H * 0.6 + k * 16, W * 0.6, H * 0.76 + k * 16, W, H * 0.66 + k * 16);
        c.stroke();
      }
    });
    [10.2, 15.8].forEach((x) => {
      boxAt(ex5, 1.5, 2.0, 0.05, x, y0 + 1.95, 0.3, M.brass, false, false, 0.015);
      exPlane(1.38, 1.88, x, y0 + 1.95, 0.335, new THREE.MeshBasicMaterial({ map: artTex, toneMapped: false }));
    });
    shelfUnit(ex5, 7.7, y0, 0.55, 1.3, M);
    shelfUnit(ex5, 19.0, y0, 0.55, 1.3, M);

    // Sculpted draped Kenya & DTH flags (subdivided with cloth waves)
    const flagKE = makeCanvasTex('flag-ke', 300, 200, (c, W, H) => {
      c.fillStyle = '#111';
      c.fillRect(0, 0, W, H * 0.29);
      c.fillStyle = '#fff';
      c.fillRect(0, H * 0.29, W, H * 0.05);
      c.fillStyle = '#b3202a';
      c.fillRect(0, H * 0.34, W, H * 0.32);
      c.fillStyle = '#fff';
      c.fillRect(0, H * 0.66, W, H * 0.05);
      c.fillStyle = '#1b7a3c';
      c.fillRect(0, H * 0.71, W, H * 0.29);
      c.strokeStyle = '#fff';
      c.lineWidth = 4;
      [-1, 1].forEach((s) => {
        c.beginPath();
        c.moveTo(W / 2 + s * 46, H * 0.2);
        c.lineTo(W / 2 - s * 46, H * 0.8);
        c.stroke();
      });
      c.fillStyle = '#b3202a';
      c.beginPath();
      c.ellipse(W / 2, H / 2, 28, 50, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#111';
      c.lineWidth = 6;
      c.stroke();
      c.fillStyle = '#fff';
      c.fillRect(W / 2 - 4, H / 2 - 40, 8, 80);
    });
    const flagCo = makeCanvasTex('flag-co', 300, 200, (c, W, H) => {
      c.fillStyle = '#0d2a4a';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#4fe38a';
      c.beginPath();
      c.arc(W / 2, H / 2, 58, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#0d2a4a';
      c.font = '700 56px "Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('DTH', W / 2, H / 2 + 3);
    });
    const drapedFlagGeo = new THREE.PlaneGeometry(1.2, 0.8, 12, 8);
    const fPos = drapedFlagGeo.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const fx = fPos.getX(i);
      const fy = fPos.getY(i);
      fPos.setZ(i, Math.sin((fx + 0.6) * 6.5 - fy * 2.0) * 0.05 * ((fx + 0.6) / 1.2));
    }
    drapedFlagGeo.computeVertexNormals();
    [
      [7.0, flagKE] as const,
      [8.3, flagCo] as const,
    ].forEach(([fx, tex]) => {
      cylAt(ex5, 0.025, 0.028, 2.6, fx, y0 + 1.3, 1.7, M.brass, true, false, 12);
      cylAt(ex5, 0.22, 0.25, 0.05, fx, y0 + 0.03, 1.7, M.brass, false, true, 16);
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M.brass);
      finial.position.set(fx, y0 + 2.64, 1.7);
      ex5.add(finial);
      const fm = new THREE.Mesh(drapedFlagGeo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85 }));
      fm.position.set(fx + 0.61, y0 + 2.15, 1.7);
      ex5.add(fm);
    });

    exDesk(cx, 3.4, 3.4, y0);
    exChair(cx, y0, 2.58, 0, 1.3, true, 0.5, 1);
    exMon(ex5, cx - 0.75, y0 + 0.8, 3.3, Math.PI, 'ceo', 0, {
      lv: 5,
      zone: EXEC.ceo.n,
      role: 'Chief Executive Officer',
      color: `#${EXEC.ceo.c.toString(16).padStart(6, '0')}`,
      seatX: cx,
      seatZ: 2.58,
      screenTask: 'Reviewing company revenue & active project metrics',
    });
    exMon(ex5, cx + 0.75, y0 + 0.8, 3.3, Math.PI, 'ceo', 1, {
      lv: 5,
      zone: EXEC.ceo.n,
      role: 'Chief Executive Officer',
      color: `#${EXEC.ceo.c.toString(16).padStart(6, '0')}`,
      seatX: cx,
      seatZ: 2.58,
      screenTask: 'Reviewing executive schedule & board strategy',
    });
    floorLamp(14.4, y0, 3.05);
    floorLamp(11.6, y0, 3.05);
    boxAt(ex5, 0.48, 0.09, 0.14, cx, y0 + 0.82, 3.9, M.brass, false, false, 0.02);
    exChair(cx - 1.0, y0, 5.5, Math.PI, 1.1);
    exChair(cx + 1.0, y0, 5.5, Math.PI, 1.1);
    exPlane(
      6.2,
      3.8,
      cx,
      y0 + 0.06,
      4.2,
      new THREE.MeshStandardMaterial({
        map: M.textures.carpetTex,
        normalMap: M.textures.carpetNormal,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughnessMap: M.textures.carpetRoughness,
        color: 0x424a5a,
        roughness: 0.96,
      }),
      -Math.PI / 2
    );

    sofaWide(ex5, 17.8, y0, 1.95, 0, M.fabricBlue, M);
    boxAt(ex5, 1.7, 0.06, 0.95, 17.8, y0 + 0.42, 3.9, M.walnut, true, true, 0.03);
    [
      [17.0, 3.55],
      [18.6, 3.55],
      [17.0, 4.25],
      [18.6, 4.25],
    ].forEach((p) => cylAt(ex5, 0.024, 0.018, 0.4, p[0], y0 + 0.2, p[1], M.metal, false, false, 8));
    armchair(ex5, 16.0, y0, 3.9, Math.PI / 2, M.fabricGrey, M);
    armchair(ex5, 17.8, y0, 5.8, Math.PI, M.fabricGrey, M);
    exPlane(
      3.8,
      3.6,
      17.8,
      y0 + 0.06,
      3.9,
      new THREE.MeshStandardMaterial({
        map: M.textures.carpetTex,
        normalMap: M.textures.carpetNormal,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughnessMap: M.textures.carpetRoughness,
        color: 0x525c70,
        roughness: 0.96,
      }),
      -Math.PI / 2
    );
    floorLamp(19.3, y0, 3.9);
    plant(ex5, 9.6, y0, 6.2, 1.3, 81, M);
    plant(ex5, 19.2, y0, 8.6, 1.4, 87, M);
    exLights(y0, [9, 13, 17.5], [2.4, 5.6]);
  }

  /* =========================================================
     5 · GLASS LIFT SHAFTS & SCULPTED CABS
     ========================================================= */
  [-1, 1].forEach((sd) => {
    const g = new THREE.Group();
    scene.add(g);
    const cx = sd * LIFTX;
    const face = cx + sd * 1.0;
    const top = ROOF - 0.05;
    const bot = BASE_BOT - 0.3;
    const h = top - bot;
    const mid = (top + bot) / 2;

    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach((q) => boxAt(g, 0.09, h, 0.09, cx + q[0] * 0.98, mid, LANE + q[1] * 1.0, M.black, true, false, 0.02));
    boxAt(g, 0.04, h, 1.94, face, mid, LANE, M.glass, false, false);
    [-1, 1].forEach((q) => boxAt(g, 1.98, h, 0.04, cx, mid, LANE + q * 1.0, M.glass, false, false));
    boxAt(g, 2.06, 0.1, 2.12, cx, top, LANE, M.black, true, false, 0.03);

    LIFT_SVC.forEach((y0) => {
      const y = y0 - 0.1;
      const ground = y0 === 0;
      boxAt(g, 0.26, 0.14, 2.14, face, y, LANE, M.slab, false, true, 0.03);
      [-1, 1].forEach((q) => boxAt(g, 2.0, 0.14, 0.26, cx, y, LANE + q * 1.06, M.slab, false, true, 0.03));
      boxAt(g, 0.14, 0.05, 1.86, cx - sd * 0.9, y0 + 0.01, LANE, M.metal, false, false, 0.015);

      const px = cx - sd * 1.09;
      const pz = LANE + 0.62;
      boxAt(g, 0.07, 0.52, 0.26, px, y0 + 1.24, pz, M.black, false, false, 0.015);
      boxAt(g, 0.03, 0.1, 0.15, px - sd * 0.03, y0 + 1.42, pz, ground ? M.ledGreen : M.ledCyan, false, false);
      boxAt(g, 0.03, 0.03, 0.03, px - sd * 0.03, y0 + 1.02, pz, M.ledCyan, false, false);
    });

    const cab = new THREE.Group();
    cab.position.set(cx, 0, LANE);
    g.add(cab);
    boxAt(cab, 1.72, 0.1, 1.92, 0, -0.05, 0, M.liftFloor, true, true, 0.025);
    boxAt(cab, 1.8, 0.1, 2.0, 0, 2.45, 0, M.black, true, false, 0.03);
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach((q) => cylAt(cab, 0.026, 0.026, 2.45, q[0] * 0.84, 1.225, q[1] * 0.94, M.metal, false, false, 10));
    [-1, 1].forEach((q) => boxAt(cab, 0.07, 2.2, 0.09, -sd * 0.86, 1.1, q * 0.93, M.black, false, false, 0.02));
    boxAt(cab, 0.07, 0.1, 1.96, -sd * 0.86, 2.2, 0, M.black, false, false, 0.02);

    // Tubular stainless steel handrail inside the lift cab
    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sd * 0.72, 1.02, -0.74),
      new THREE.Vector3(sd * 0.78, 1.02, -0.74),
      new THREE.Vector3(sd * 0.78, 1.02, 0.74),
      new THREE.Vector3(sd * 0.72, 1.02, 0.74),
    ]);
    cab.add(new THREE.Mesh(new THREE.TubeGeometry(railCurve, 12, 0.022, 8, false), M.metal));

    const paneMat = new THREE.MeshStandardMaterial({
      color: 0xc8dad8,
      roughness: 0.18,
      metalness: 0.05,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      envMapIntensity: 0.32,
      depthWrite: false,
    });
    const mkPane = (w: number, hh: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), paneMat);
      m.position.set(x, 1.2, z);
      cab.add(m);
    };
    mkPane(1.7, 2.3, 0.024, 0, 0.95);
    mkPane(1.7, 2.3, 0.024, 0, -0.95);
    mkPane(0.024, 2.3, 1.9, sd * 0.85, 0);

    // Interior brushed stainless Car Operating Panel (COP) + illuminated floor indicator
    boxAt(cab, 0.18, 0.95, 0.025, -sd * 0.45, 1.22, 0.92, M.metal, false, false, 0.006);
    boxAt(cab, 0.1, 0.14, 0.03, -sd * 0.45, 1.56, 0.915, M.black, false, false, 0.003);
    boxAt(cab, 0.06, 0.04, 0.034, -sd * 0.45, 1.56, 0.914, M.ledCyan, false, false);

    const cLamp = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16), M.lamp);
    cLamp.rotation.x = Math.PI / 2;
    cLamp.position.y = 2.39;
    cab.add(cLamp);
    boxAt(cab, 1.16, 0.02, 1.16, 0, 2.36, 0, M.ledWarm, false, false);

    cabs[sd] = { g: cab, y: 0, target: 0, speed: 7 };
  });

  /* =========================================================
     6 · BASEMENTS (B1 SERVER ROOM & B2 POWER ROOM)
     ========================================================= */
  const basementGroup = new THREE.Group();
  scene.add(basementGroup);
  basementGroup.visible = false;
  const gB1 = new THREE.Group();
  const gB2 = new THREE.Group();
  const b1Ceiling = new THREE.Group();
  const b2Ceiling = new THREE.Group();
  gB1.add(b1Ceiling);
  gB2.add(b2Ceiling);
  basementGroup.add(gB1, gB2);

  boxAt(basementGroup, 1.6, 10.4, DEPTH + 2.6, -(WIDTH / 2 + 0.9), -5.6, DEPTH / 2 - 0.2, M.earth, false, false);
  boxAt(basementGroup, 1.6, 10.4, DEPTH + 2.6, WIDTH / 2 + 0.9, -5.6, DEPTH / 2 - 0.2, M.earth, false, false);
  boxAt(basementGroup, WIDTH + 3.4, 10.4, 1.6, 0, -5.6, -1.1, M.earth, false, false);
  boxAt(basementGroup, WIDTH + 3.4, 0.8, DEPTH + 2.6, 0, -10.1, DEPTH / 2 - 0.2, M.earth, false, false);

  BASE.forEach((b, bi) => {
    const bg = bi === 0 ? gB1 : gB2;
    const bc = bi === 0 ? b1Ceiling : b2Ceiling;
    const y = b.y;
    const ch = y + b.h;
    boxAt(bg, WIDTH + 0.8, 0.4, DEPTH + 0.8, 0, y - 0.2, DEPTH / 2, M.baseSlab, false, true);
    boxAt(bg, WIDTH + 0.8, 0.95, 0.34, 0, y - 0.72, DEPTH + 0.22, M.concrete, false, true, 0.04);
    boxAt(bg, WIDTH - 0.4, ch - y, 0.36, 0, y + (ch - y) / 2, 0.18, M.baseWall, false, true);
    [-1, 1].forEach((sd) =>
      boxAt(bg, 0.36, ch - y, DEPTH - 0.2, sd * (WIDTH / 2 - 0.18), y + (ch - y) / 2, DEPTH / 2 - 0.4, M.baseWall, false, true)
    );
    boxAt(bc, WIDTH - 0.8, 0.06, DEPTH - 1.4, 0, ch - 0.08, DEPTH / 2 + 0.3, M.baseCeil, false, false);
    [3.2, 6.6].forEach((z) => boxAt(bc, 10, 0.06, 0.14, -2, ch - 0.07, z, M.ledCool, false, false));
  });

  // B1 Server Room
  const b1 = BASE[0];
  const y1 = b1.y;
  const ch1 = b1.y + b1.h;
  boxAt(gB1, 24, 0.14, 8.8, -2, y1 + 0.07, 6.0, M.raised, false, true);
  for (let blk = 0; blk < 2; blk++) {
    for (let row = 0; row < 2; row++) {
      const z = 3.1 + row * 2.5;
      for (let i = 0; i < 7; i++) {
        const x = (blk ? 2.2 : -12.0) + i * 1.15;
        boxAt(gB1, 0.62, 1.95, 0.92, x, y1 + 0.14 + 0.98, z, M.rackBody, true, false, 0.03);
        planeAt(gB1, 0.56, 1.82, x, y1 + 0.14 + 0.99, z + 0.468, M.rackFace);
      }
    }
  }
  [-6.5, -2.5, 1.5].forEach((x, i) => {
    boxAt(gB1, 1.5, 2.1, 0.9, x, y1 + 1.05, 1.0, M.cabinet, true, false, 0.04);
    boxAt(gB1, 1.3, 0.5, 0.04, x, y1 + 1.42, 1.46, M.dark, false, false);
    boxAt(gB1, 0.46, 0.06, 0.03, x, y1 + 2.0, 1.47, i % 2 ? M.ledGreen : M.ledCyan, false, false);
  });
  [3.1, 5.6].forEach((z) => {
    boxAt(gB1, 25, 0.09, 0.5, -2, ch1 - 0.6, z, M.tray, false, false);
    for (let x = -13; x <= 9; x += 4) cylAt(gB1, 0.02, 0.02, 0.55, x, ch1 - 0.32, z, M.metal, false, false, 8);
  });
  const redCylMat = new THREE.MeshStandardMaterial({ color: 0xa8322a, roughness: 0.32, metalness: 0.25 });
  [-12.9, -12.3].forEach((x) => {
    cylAt(gB1, 0.17, 0.17, 1.4, x, y1 + 0.7, 7.8, redCylMat, true, false, 16);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10), redCylMat);
    cap.position.set(x, y1 + 1.4, 7.8);
    gB1.add(cap);
    cylAt(gB1, 0.05, 0.05, 0.14, x, y1 + 1.6, 7.8, M.brass, false, false, 10);
  });
  const nocTex = makeCanvasTex('noc', 1024, 512, (g, W2, H2) => {
    const lW = W2 / 2;
    const lH = H2 / 2;
    g.save();
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.fillStyle = '#08111a';
    g.fillRect(0, 0, lW, lH);
    g.strokeStyle = 'rgba(90,200,255,0.28)';
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        g.strokeRect(18 + i * 122, 16 + j * 118, 106, 100);
        g.fillStyle = 'rgba(90,235,160,0.85)';
        for (let k = 0; k < 7; k++) g.fillRect(30 + i * 122 + k * 13, 30 + j * 118 + (k % 3) * 22, 7, 34 + k * 3);
      }
    }
    g.fillStyle = '#bae6fd';
    g.font = '700 24px "Plus Jakarta Sans",ui-sans-serif,sans-serif';
    g.fillText('CORE · 42 NODES · 18.4 TB/s', 20, lH - 16);
    g.restore();
  });
  planeAt(gB1, 6.4, 1.9, -1.2, ch1 - 1.1, 0.38, new THREE.MeshBasicMaterial({ map: nocTex, toneMapped: false }));
  planeAt(
    gB1,
    4.2,
    0.92,
    9.6,
    ch1 - 0.72,
    0.38,
    new THREE.MeshBasicMaterial({ map: svcSignTex('b1sign', 'SERVER ROOM', b1.sub), transparent: true, toneMapped: false })
  );

  // B2 Power Room
  const b2 = BASE[1];
  const y2 = b2.y;
  const ch2 = b2.y + b2.h;
  boxAt(gB2, 27, 0.02, 0.2, -2, y2 + 0.021, 9.5, M.warn, false, false);
  boxAt(gB2, 27, 0.02, 0.08, -2, y2 + 0.021, 8.9, M.paint, false, false);
  for (let i = 0; i < 6; i++) {
    const x = -9.6 + i * 1.35;
    boxAt(gB2, 1.2, 2.2, 0.82, x, y2 + 1.1, 1.02, M.cabinet, true, false, 0.04);
    boxAt(gB2, 0.86, 0.32, 0.03, x, y2 + 1.56, 1.44, M.dark, false, false);
    boxAt(gB2, 0.06, 0.06, 0.03, x - 0.3, y2 + 1.76, 1.45, M.ledGreen, false, false);
    boxAt(gB2, 0.06, 0.06, 0.03, x + 0.3, y2 + 1.76, 1.45, M.ledRed, false, false);
  }
  const invTex = makeCanvasTex('inv', 512, 256, (g, W2, H2) => {
    const lW = W2 / 2;
    const lH = H2 / 2;
    g.save();
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.fillStyle = '#0a1016';
    g.fillRect(0, 0, lW, lH);
    g.fillStyle = '#79e6a6';
    g.font = '700 32px "Plus Jakarta Sans",ui-sans-serif,sans-serif';
    g.fillText('PV 18.4 kW', 18, 42);
    g.fillStyle = '#bae6fd';
    g.font = '600 24px "Plus Jakarta Sans",ui-sans-serif,sans-serif';
    g.fillText('AC 17.9 kW · 98%', 18, 82);
    g.fillStyle = '#ffb14a';
    g.fillText('GRID 0', 18, 110);
    g.restore();
  });
  for (let i = 0; i < 3; i++) {
    const x = 1.4 + i * 1.4;
    boxAt(gB2, 1.24, 2.0, 0.72, x, y2 + 1.0, 1.02, M.cabinet, true, false, 0.04);
    planeAt(gB2, 0.66, 0.33, x, y2 + 1.36, 1.39, new THREE.MeshBasicMaterial({ map: invTex, toneMapped: false }));
    boxAt(gB2, 0.9, 0.11, 0.03, x, y2 + 1.82, 1.39, M.warn, false, false);
  }
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 5; i++) {
      const x = -6.4 + i * 1.35;
      const z = 4.9 + row * 2.0;
      boxAt(gB2, 0.78, 1.8, 0.82, x, y2 + 0.9, z, M.rackBody, true, false, 0.03);
      boxAt(gB2, 0.56, 0.06, 0.03, x, y2 + 1.56, z + 0.42, M.ledGreen, false, false);
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = -6.4 + i * 1.35;
    boxAt(gB2, 0.78, 1.8, 0.82, x, y2 + 0.9, 8.7, M.rackBody, true, false, 0.03);
    boxAt(gB2, 0.56, 0.06, 0.03, x, y2 + 1.56, 9.12, M.ledGreen, false, false);
  }
  // Sculpted service trolley
  boxAt(gB2, 1.5, 0.72, 0.7, 2.2, y2 + 0.52, 8.9, M.cabinet, true, false, 0.04);
  [
    [-0.55, 8.9],
    [-0.55, 9.55],
    [0.55, 8.9],
    [0.55, 9.55],
  ].forEach((p) => cylAt(gB2, 0.06, 0.06, 0.16, p[0] + 1.0, y2 + 0.08, p[1], M.dark, false, false, 10));

  const txMat = new THREE.MeshStandardMaterial({ color: 0x33453c, roughness: 0.54, metalness: 0.35, envMapIntensity: 0.45 });
  boxAt(gB2, 2.4, 1.9, 1.5, 9.2, y2 + 0.95, 3.4, txMat, true, false, 0.06);
  for (let i = 0; i < 8; i++) boxAt(gB2, 0.05, 1.3, 0.06, 8.15 + i * 0.16, y2 + 0.95, 4.16, txMat, false, false, 0.01);
  // HV ceramic bushings on transformer top
  [-0.55, 0, 0.55].forEach((ox) => cylAt(gB2, 0.06, 0.08, 0.36, 9.2 + ox, y2 + 2.15, 3.4, M.ceramicMat, false, false, 12));
  boxAt(gB2, 2.5, 0.12, 1.6, 9.2, y2 + 1.96, 3.4, M.dark, false, false, 0.03);

  cylAt(gB2, 0.14, 0.14, ch2 - y2, 18, y2 + (ch2 - y2) / 2, 0.5, M.conduit, true, false, 14);
  boxAt(gB2, 0.55, 0.42, 0.24, 18, y2 + 3.5, 0.62, M.cabinet, false, false, 0.03);
  boxAt(gB2, 12.5, 0.12, 0.42, 11.4, ch2 - 0.72, 0.75, M.tray, false, false);
  for (let x = 6; x <= 17; x += 3.7) cylAt(gB2, 0.025, 0.025, 0.5, x, ch2 - 0.45, 0.75, M.metal, false, false, 8);
  planeAt(
    gB2,
    4.4,
    0.96,
    10.2,
    ch2 - 0.78,
    0.38,
    new THREE.MeshBasicMaterial({ map: svcSignTex('b2sign', 'POWER ROOM', b2.sub, '#ffb14a'), transparent: true, toneMapped: false })
  );
  boxAt(gB2, 0.34, 0.2, 0.12, 15.5, ch2 - 0.3, 0.6, M.ledGreen, false, false);

  // Basement lift-only glazed security lobbies
  [-1, 1].forEach((sd) => {
    const cx = sd * LIFTX;
    const dir = -sd;
    const x0 = cx + dir * 1.02;
    const x1 = cx + dir * 2.95;
    const midX = (x0 + x1) / 2;
    const run = Math.abs(x1 - x0);
    BASE.forEach((b, bi) => {
      const bg = bi === 0 ? gB1 : gB2;
      const y = b.y;
      [-1, 1].forEach((q) => {
        boxAt(bg, run, 1.0, 0.12, midX, y + 0.5, LANE + q * 0.96, M.baseWall, true, true, 0.02);
        boxAt(bg, run, 1.4, 0.05, midX, y + 1.72, LANE + q * 0.96, M.glass, false, false);
        boxAt(bg, run, 0.08, 0.16, midX, y + 2.44, LANE + q * 0.96, M.metal, false, false, 0.02);
      });
      boxAt(bg, 0.16, 2.42, 0.13, x1, y + 1.21, LANE - 0.67, M.metal, true, false, 0.02);
      boxAt(bg, 0.16, 2.42, 0.13, x1, y + 1.21, LANE + 0.67, M.metal, true, false, 0.02);
      boxAt(bg, 0.16, 0.14, 1.47, x1, y + 2.4, LANE, M.metal, true, false, 0.02);
      [-1, 1].forEach((q) => {
        boxAt(bg, 0.05, 2.26, 0.6, x1, y + 1.16, LANE + q * 0.3, M.glass, false, false);
        boxAt(bg, 0.07, 2.26, 0.05, x1, y + 1.16, LANE + q * 0.61, M.metal, false, false);
      });
      boxAt(bg, 0.06, 0.26, 0.14, x1 + dir * 0.12, y + 1.32, LANE + 0.82, M.black, false, false, 0.015);
      boxAt(bg, 0.03, 0.07, 0.06, x1 + dir * 0.15, y + 1.38, LANE + 0.82, M.ledGreen, false, false);
      boxAt(bg, 0.12, 0.3, 2.06, x0, y + 2.62, LANE, M.black, false, false);
      boxAt(bg, run - 0.2, 0.03, 1.78, midX, y + 0.02, LANE, M.raised, false, true);
    });
  });

  /* =========================================================
     7 · SOLAR ROOF & RISER
     ========================================================= */
  const roofGroup = new THREE.Group();
  roofShellGroup.add(roofGroup);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH - 1.6, DEPTH - 1.4), M.roofDeck);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, ROOF + 0.04, DEPTH / 2);
  deck.receiveShadow = true;
  roofGroup.add(deck);

  const MW = 1.52;
  const MD = 1.02;
  const MX = MW + 0.07;
  const COLS = 10;
  [2.1, 3.75, 5.4, 7.05].forEach((z) => {
    [-1, 1].forEach((sd) => {
      const grp = new THREE.Group();
      grp.position.set(sd * 8.55, ROOF + 0.36, z);
      grp.rotation.x = -0.3;
      roofGroup.add(grp);
      for (let c = 0; c < COLS; c++) {
        const x = (-(COLS - 1) * MX) / 2 + c * MX;
        boxAt(grp, MW, 0.045, MD, x, 0, 0, M.pv, false, false);
        boxAt(grp, MW + 0.05, 0.02, MD + 0.05, x, -0.037, 0, M.pvFrame, false, false);
      }
      boxAt(grp, COLS * MX, 0.06, 0.07, 0, -0.09, 0.44, M.pvFrame, false, false, 0.015);
      boxAt(grp, COLS * MX, 0.06, 0.07, 0, -0.09, -0.44, M.pvFrame, false, false, 0.015);
      for (let c = 0; c < COLS; c += 2) {
        const lx = sd * 8.55 + ((-(COLS - 1) * MX) / 2 + c * MX);
        [-0.42, 0.42].forEach((dz) => cylAt(roofGroup, 0.036, 0.04, 0.4, lx, ROOF + 0.19, z + dz, M.pvFrame, false, false, 8));
      }
    });
  });

  boxAt(roofGroup, 1.55, 0.03, 9.2, 0, ROOF + 0.02, 5.2, new THREE.MeshStandardMaterial({ color: 0xa9adb0, roughness: 0.9 }), false, true);
  boxAt(roofGroup, 1.5, 0.07, 0.32, 17.0, ROOF + 0.46, 1.5, M.tray, false, false);
  boxAt(roofGroup, 0.9, 1.1, 0.6, 18.0, ROOF + 0.56, 1.35, M.cabinet, true, false, 0.04);
  boxAt(roofGroup, 0.6, 0.09, 0.02, 18.0, ROOF + 0.9, 1.66, M.warn, false, false);
  // Curved conduit bend to PV riser
  const roofCondCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(18.0, ROOF + 0.5, 1.05),
    new THREE.Vector3(18.0, ROOF + 0.42, 0.72),
    new THREE.Vector3(18.0, ROOF + 0.12, 0.52),
  ]);
  roofGroup.add(new THREE.Mesh(new THREE.TubeGeometry(roofCondCurve, 8, 0.075, 10, false), M.conduit));

  // Cylindrical shrouded HVAC chillers
  [
    [-18.3, 4.6],
    [-18.3, 7.6],
  ].forEach((p) => {
    boxAt(roofGroup, 1.1, 0.9, 1.3, p[0], ROOF + 0.47, p[1], M.cabinet, true, true, 0.06);
    cylAt(roofGroup, 0.44, 0.46, 0.12, p[0], ROOF + 0.95, p[1], M.dark, false, false, 20);
    const fanGrp = new THREE.Group();
    fanGrp.position.set(p[0], ROOF + 0.97, p[1]);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(getRoundedBox(0.68, 0.015, 0.11, 0.006, 2), M.metal);
      blade.rotation.y = (b * Math.PI) / 4;
      fanGrp.add(blade);
    }
    roofGroup.add(fanGrp);
    roofFans.push(fanGrp);
  });

  // Back wall cylindrical PV riser conduit
  const riserGroup = new THREE.Group();
  scene.add(riserGroup);
  const rx = 18.0;
  const rz = 0.52;
  const rh = ROOF + 0.4;
  cylAt(riserGroup, 0.13, 0.13, rh, rx, rh / 2 - 0.4, rz, M.conduit, true, false, 14);
  cylAt(riserGroup, 0.045, 0.045, rh, rx - 0.14, rh / 2 - 0.4, rz + 0.15, M.conduit, false, false, 10);
  cylAt(riserGroup, 0.045, 0.045, rh, rx + 0.14, rh / 2 - 0.4, rz + 0.15, M.conduit, false, false, 10);
  for (let s = 0; s < FLOOR_COUNT; s++) {
    boxAt(riserGroup, 0.44, 0.34, 0.16, rx, LV[s] + 2.5, rz + 0.16, M.cabinet, false, false, 0.025);
    boxAt(riserGroup, 0.065, 0.065, 0.02, rx - 0.12, LV[s] + 2.56, rz + 0.25, M.ledGreen, false, false);
  }
  cylAt(riserGroup, 0.28, 0.32, 0.16, rx, ROOF + 0.08, rz, M.pvFrame, false, false, 16);

  /* =========================================================
     8 · PLAZA & GROUND APPROACH
     ========================================================= */
  const plazaGroup = new THREE.Group();
  scene.add(plazaGroup);

  const soilTex = makeCanvasTex('soil', 256, 256, (g, W, H) => {
    g.fillStyle = '#4e883c';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = Math.random() < 0.5 ? `rgba(24,60,22,${Math.random() * 0.25})` : `rgba(130,190,90,${Math.random() * 0.2})`;
      g.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 6, 3 + Math.random() * 6);
    }
  });
  soilTex.wrapS = soilTex.wrapT = THREE.RepeatWrapping;
  soilTex.repeat.set(24, 24);
  const grd = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({
      map: soilTex,
      normalMap: M.textures.grassNormal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughnessMap: M.textures.roughTex,
      color: 0xffffff,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.15,
    })
  );
  grd.rotation.x = -Math.PI / 2;
  grd.position.y = -0.64;
  grd.receiveShadow = true;
  plazaGroup.add(grd);

  const paveTex = makeCanvasTex('pave', 256, 256, (g, W, H) => {
    g.fillStyle = '#8c8f93';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(60,62,66,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    g.strokeStyle = 'rgba(50,52,56,0.22)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, W - 4, H - 4);
  });
  paveTex.wrapS = paveTex.wrapT = THREE.RepeatWrapping;
  const paveMat = new THREE.MeshStandardMaterial({
    map: paveTex,
    normalMap: M.textures.paveNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: M.textures.paveRoughness,
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.02,
    envMapIntensity: 0.28,
  });

  const layer = (w: number, d: number, cx: number, cz: number, y: number, mat: THREE.Material, lvl: number) => {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -lvl;
    mat.polygonOffsetUnits = -lvl * 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, y, cz);
    m.receiveShadow = true;
    plazaGroup.add(m);
    return m;
  };
  const pave = (w: number, d: number, cx: number, cz: number, lvl: number) => {
    const y = -0.62 + lvl * 0.004;
    const mc = new THREE.MeshStandardMaterial({
      normalMap: M.textures.concreteNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: M.textures.roughTex,
      color: 0xa9abae,
      roughness: 0.82,
      metalness: 0,
    });
    layer(w + 0.5, d + 0.5, cx, cz, y - 0.002, mc, lvl * 2);
    const rx = w / 4;
    const ry = d / 4;
    const mp = paveMat.clone();
    mp.map = repTex(paveTex, rx, ry);
    mp.normalMap = repTex(M.textures.paveNormal, rx, ry);
    mp.roughnessMap = repTex(M.textures.paveRoughness, rx, ry);
    layer(w, d, cx, cz, y, mp, lvl * 2 + 1);
  };
  pave(44, 10, 0, 16.2, 3);
  pave(8, 34, 0, 38, 2);
  pave(44, 5, 0, -3.2, 1);
  pave(22, 16.5, -16.2, 29, 2);
  pave(22, 16.5, 16.2, 29, 2);

  for (let k = 0; k < 3; k++) {
    boxAt(plazaGroup, 30, 0.2, 1.05, 0, -0.1 - k * 0.2, 11.55 + k * 0.95, M.white, false, true, 0.03);
    boxAt(plazaGroup, 30, 0.018, 0.045, 0, -0.005 - k * 0.2, 12.055 + k * 0.95, M.dark, false, false);
  }
  [
    [-13, 11.2],
    [13, 11.2],
    [-16.5, 13.4],
    [16.5, 13.4],
  ].forEach((p, i) => {
    boxAt(plazaGroup, 3.6, 0.7, 2.2, p[0], -0.29, p[1], M.white, true, true, 0.06);
    for (let k = 0; k < 5; k++) plant(plazaGroup, p[0] - 1.2 + k * 0.6, 0.06, p[1], 0.52, i * 5 + k, M);
  });
  [-6, 0, 6].forEach((x) => {
    boxAt(
      plazaGroup,
      0.06,
      0.01,
      7,
      x,
      -0.57,
      21,
      new THREE.MeshBasicMaterial({ color: 0xdfe7ee, transparent: true, opacity: 0.35 }),
      false,
      false
    );
  });

  /* =========================================================
     9 · NEIGHBOURING CITY BLOCKS & STREETSCAPE
     ========================================================= */
  const cityGroup = new THREE.Group();
  scene.add(cityGroup);
  const PAL = {
    glass: { base: '#8fa4b4', frame: '#3d4d5a', win: '#9dbccf', roof: 0x5a6470, sill: '#c8ccd0' },
    concrete: { base: '#cdc6b8', frame: '#9d968a', win: '#6b7c88', roof: 0x8a857d, sill: '#b8b3a8' },
    brick: { base: '#a86850', frame: '#7b4433', win: '#3d4a56', roof: 0x6a584e, sill: '#c4b4a6' },
  };
  const facadeTex = (style: 'glass' | 'concrete' | 'brick') =>
    makeCanvasTex(`nb_${style}`, 256, 256, (c, W, H) => {
      const p = PAL[style];
      c.fillStyle = p.base;
      c.fillRect(0, 0, W, H);
      if (style === 'brick') {
        const bh = 8;
        const bw = 20;
        for (let y = 0; y < H; y += bh) {
          const off = ((y / bh) % 2) * (bw / 2);
          for (let x = -bw; x < W + bw; x += bw) {
            c.fillStyle = `rgba(${168 + ((Math.random() * 36) | 0)},${104 + ((Math.random() * 30) | 0)},${80 + ((Math.random() * 26) | 0)},0.55)`;
            c.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
          }
        }
      } else {
        for (let i = 0; i < 40; i++) {
          const v = 180 + ((Math.random() * 45) | 0);
          c.fillStyle = `rgba(${v},${v - 3},${v - 9},0.16)`;
          c.beginPath();
          c.arc(Math.random() * W, Math.random() * H, 10 + Math.random() * 40, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.fillStyle = p.frame;
      c.fillRect(0, H - 16, W, 16);
      for (let x = 0; x <= W; x += 64) {
        c.fillStyle = p.frame;
        c.fillRect(x - 3, 0, 6, H);
      }
      for (let cx = 0; cx < 2; cx++) {
        for (let cy = 0; cy < 2; cy++) {
          const x = cx * 128 + 22;
          const y = cy * 128 + 18;
          const w = 84;
          const h = 92;
          c.fillStyle = 'rgba(0,0,0,0.34)';
          c.fillRect(x - 6, y - 6, w + 12, h + 12);
          c.fillStyle = p.frame;
          c.fillRect(x - 4, y - 4, w + 8, h + 8);
          c.fillStyle = p.win;
          c.fillRect(x, y, w, h);
          const gg = c.createLinearGradient(x, y, x + w * 0.4, y + h);
          gg.addColorStop(0, 'rgba(255,255,255,0.42)');
          gg.addColorStop(0.45, 'rgba(255,255,255,0.05)');
          gg.addColorStop(1, 'rgba(0,0,0,0.2)');
          c.fillStyle = gg;
          c.fillRect(x, y, w, h);
          c.fillStyle = p.frame;
          c.fillRect(x, y + h * 0.42, w, 4);
          c.fillRect(x + w * 0.5, y, 4, h);
          c.fillStyle = p.sill;
          c.fillRect(x - 9, y + h + 4, w + 18, 7);
          if (Math.random() < 0.34) {
            c.fillStyle = 'rgba(255,214,150,0.2)';
            c.fillRect(x + 3, y + 3, w - 6, h * 0.38);
          }
        }
      }
    });

  const std = (o: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.05, envMapIntensity: 0.48, ...o });

  // Neighbour towers imported later in constants - let's load dynamic array directly
  const NEIGHBOUR_LIST: Array<{ name: string; x: number; z: number; w: number; d: number; h: number; style: 'glass' | 'concrete' | 'brick' }> = [
    { name: 'Left neighbour', x: -36, z: 0, w: 22, d: 20, h: 22, style: 'glass' },
    { name: 'Right neighbour', x: 35, z: 1, w: 20, d: 18, h: 18, style: 'concrete' },
    { name: 'Far left tower', x: -62, z: -4, w: 24, d: 22, h: 40, style: 'glass' },
    { name: 'Far right block', x: 60, z: -2, w: 24, d: 20, h: 31, style: 'brick' },
    { name: 'Behind (rear lane)', x: 0, z: -24, w: 52, d: 16, h: 29, style: 'concrete' },
    { name: 'Across the street L', x: -30, z: 88, w: 30, d: 18, h: 22, style: 'brick' },
    { name: 'Across the street R', x: 28, z: 90, w: 34, d: 18, h: 34, style: 'glass' },
  ];

  const nbLeafMat = new THREE.MeshStandardMaterial({
    map: leafTex('broad'),
    color: 0x3b7b32,
    transparent: true,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.85,
  });
  const nbCardGeo = new THREE.PlaneGeometry(0.62, 0.52);

  NEIGHBOUR_LIST.forEach((n, ni) => {
    const p = PAL[n.style];
    const base = facadeTex(n.style);
    const fl = Math.max(1, Math.round(n.h / 4.2));
    const rxS = Math.max(1, Math.round(n.d / 8));
    const rxF = Math.max(1, Math.round(n.w / 8));
    const sideT = repTex(base, rxS, fl);
    const frontT = repTex(base, rxF, fl);
    const sideN = repTex(M.textures.facadeNormal, rxS, fl);
    const frontN = repTex(M.textures.facadeNormal, rxF, fl);
    const glassy = n.style === 'glass';
    const mkFace = (t: THREE.Texture, nrm: THREE.Texture) =>
      std({
        map: t,
        normalMap: nrm,
        normalScale: new THREE.Vector2(0.75, 0.75),
        roughnessMap: M.textures.roughTex,
        roughness: glassy ? 0.38 : 0.82,
        metalness: glassy ? 0.2 : 0.04,
        envMapIntensity: glassy ? 0.42 : 0.25,
      });
    const roofM = std({
      normalMap: M.textures.concreteNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughnessMap: M.textures.roughTex,
      color: p.roof,
      roughness: 0.9,
    });
    const b = new THREE.Mesh(getRoundedBox(n.w, n.h, n.d, 0.14, 2), [
      mkFace(sideT, sideN),
      mkFace(sideT, sideN),
      roofM,
      roofM,
      mkFace(frontT, frontN),
      mkFace(frontT, frontN),
    ]);
    b.position.set(n.x, -0.62 + n.h / 2, n.z);
    b.receiveShadow = true;
    cityGroup.add(b);

    if (n.w > 26) {
      const finMat = std({ color: p.base, roughness: 0.82 });
      for (let x = -n.w / 2 + 2.2; x < n.w / 2 - 1; x += 4.4) {
        boxAt(cityGroup, 0.48, n.h - 0.6, 0.52, n.x + x, -0.32 + n.h / 2, n.z + n.d / 2 + 0.2, finMat, true, true, 0.05);
        boxAt(cityGroup, 0.48, n.h - 0.6, 0.52, n.x + x, -0.32 + n.h / 2, n.z - n.d / 2 - 0.2, finMat, true, true, 0.05);
      }
    }

    boxAt(cityGroup, n.w + 0.8, 0.5, n.d + 0.8, n.x, -0.62 + n.h + 0.25, n.z, roofM, false, false, 0.06);
    boxAt(cityGroup, n.w + 0.4, 0.55, n.d + 0.4, n.x, -0.62 + n.h + 0.72, n.z, std({ color: p.base, roughness: 0.8 }), true, false, 0.06);
    boxAt(cityGroup, n.w, 0.9, n.d, n.x, -0.62 + n.h + 1.35, n.z, std({ color: p.base, roughness: 0.85 }), false, false, 0.08);
    boxAt(
      cityGroup,
      n.w * 0.26,
      2.6,
      n.d * 0.28,
      n.x + n.w * 0.14,
      -0.62 + n.h + 1.7,
      n.z - n.d * 0.08,
      std({ color: 0x767d86, roughness: 0.8 }),
      true,
      false,
      0.08
    );
    boxAt(
      cityGroup,
      3.4,
      3.4,
      3.0,
      n.x - n.w * 0.2,
      -0.62 + n.h + 1.7,
      n.z + n.d * 0.16,
      std({ color: 0x8b9199, roughness: 0.85 }),
      true,
      false,
      0.08
    );

    for (let k = 0; k < 2; k++) {
      const pw = Math.min(n.w * 0.34, 11);
      const pd = Math.min(n.d * 0.4, 7);
      const pg = new THREE.Group();
      pg.position.set(n.x + (k ? -n.w * 0.16 : n.w * 0.16), -0.62 + n.h + 1.8, n.z + n.d * 0.12);
      cityGroup.add(pg);
      for (let c = 0; c < 4; c++) {
        boxAt(pg, 0.16, 3.0, 0.16, -pw / 2 + 1 + (c * (pw - 2)) / 3, 1.5, -pd / 2 + 0.4, M.pvFrame, false, false, 0.02);
        boxAt(pg, 0.16, 3.0, 0.16, -pw / 2 + 1 + (c * (pw - 2)) / 3, 1.5, pd / 2 - 0.4, M.pvFrame, false, false, 0.02);
      }
      for (let s = 0; s < 13; s++) {
        const sz = -pd / 2 + 0.6 + (s * (pd - 1.2)) / 12;
        boxAt(pg, pw, 0.12, 0.34, 0, 3.05, sz, M.pvFrame, false, false, 0.02);
      }
    }

    boxAt(cityGroup, n.w + 0.16, 3.4, n.d + 0.16, n.x, -0.62 + 1.7, n.z, std({ color: 0x5f646b, roughness: 0.8 }), false, false, 0.08);
    const shopMat = std({ color: 0x243039, roughness: 0.48, metalness: 0.18, envMapIntensity: 0.35 });
    for (let x = -n.w / 2 + 2.2; x < n.w / 2 - 1.5; x += 5.4) {
      boxAt(cityGroup, 4.4, 2.5, 0.14, n.x + x, -0.62 + 1.55, n.z + n.d / 2 + 0.1, shopMat, false, false);
      boxAt(cityGroup, 4.4, 2.5, 0.14, n.x + x, -0.62 + 1.55, n.z - n.d / 2 - 0.1, shopMat, false, false);
    }

    if (Math.abs(n.z - ROAD_Z) < 50) {
      for (let s = 1; s < fl; s++) {
        for (let x = -n.w / 2 + 3; x < n.w / 2 - 2; x += 6.2) {
          const bx = n.x + x;
          const by = -0.62 + s * 4.2 - 0.55;
          if (Math.abs(bx - n.x) > n.w / 2 - 2) continue;
          boxAt(cityGroup, 2.0, 0.42, 0.6, bx, by, n.z + n.d / 2 + 0.35, planterMat, true, true, 0.05);
          boxAt(cityGroup, 2.0, 0.42, 0.6, bx, by, n.z - n.d / 2 - 0.35, planterMat, true, true, 0.05);
          const gr = rndN(ni * 97 + Math.round(bx) + s);
          for (let k = 0; k < 4; k++) {
            const cm = new THREE.Mesh(nbCardGeo, nbLeafMat);
            cm.position.set(bx - 0.7 + k * 0.46, by + 0.42, n.z + n.d / 2 + 0.36);
            cm.rotation.set(-0.5, gr * 6.28 + k, gr * 1.3);
            cityGroup.add(cm);
          }
        }
      }
    }

    if (Math.abs(n.z) < 40) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(n.w + 8, n.d + 8), std({ color: 0x8c8f93, roughness: 0.9 }));
      pl.rotation.x = -Math.PI / 2;
      pl.position.set(n.x, -0.625, n.z);
      pl.receiveShadow = true;
      cityGroup.add(pl);
    }
    contact(cityGroup, n.x, -0.62, n.z, n.w + 10, n.d + 10, 0.5, M.textures.shadowTex);
  });

  // Main street, link road, crosswalks, kerbs, gooseneck lamps, bollards, sculpted street trees
  const ySt = -0.62;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(260, 15), M.asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, ySt, ROAD_Z);
  road.receiveShadow = true;
  cityGroup.add(road);

  [-1, 1].forEach((s) => {
    const k = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 1.2),
      std({
        normalMap: M.textures.concreteNormal,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughnessMap: M.textures.roughTex,
        color: 0xa9abae,
        roughness: 0.82,
      })
    );
    k.rotation.x = -Math.PI / 2;
    k.position.set(0, ySt + 0.005, ROAD_Z + s * 8.1);
    cityGroup.add(k);
    boxAt(cityGroup, 240, 0.18, 0.34, 0, ySt + 0.09, ROAD_Z + s * 8.32, M.concrete, true, true, 0.04);
  });
  for (let x = -120; x <= 120; x += 8) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.25), new THREE.MeshBasicMaterial({ color: 0xe6e1c8 }));
    d.rotation.x = -Math.PI / 2;
    d.position.set(x, ySt + 0.01, ROAD_Z);
    cityGroup.add(d);
  }
  const link = new THREE.Mesh(
    new THREE.PlaneGeometry(8, ROAD_Z - 55),
    std({
      map: repTex(paveTex, 2, 4),
      normalMap: repTex(M.textures.paveNormal, 2, 4),
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: repTex(M.textures.paveRoughness, 2, 4),
      color: 0xa4a6aa,
      roughness: 0.86,
    })
  );
  link.rotation.x = -Math.PI / 2;
  link.position.set(0, ySt + 0.002, (ROAD_Z - 7.5 + 55) / 2);
  cityGroup.add(link);

  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf0ede0 });
  [-46, 46].forEach((cx) => {
    for (let k = 0; k < 8; k++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 13), stripeMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(cx - 4.2 + k * 1.2, ySt + 0.012, ROAD_Z);
      cityGroup.add(s);
    }
    const sl = new THREE.Mesh(new THREE.PlaneGeometry(13, 0.4), stripeMat);
    sl.rotation.x = -Math.PI / 2;
    sl.position.set(cx, ySt + 0.012, ROAD_Z - 7.4);
    cityGroup.add(sl);
  });

  const grassTex = makeCanvasTex('streetgrass', 256, 256, (c, W, H) => {
    c.fillStyle = '#4c7a35';
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 7000; i++) {
      c.fillStyle = Math.random() < 0.5 ? `rgba(30,72,26,${Math.random() * 0.4})` : `rgba(126,182,86,${Math.random() * 0.35})`;
      c.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 5, 3 + Math.random() * 5);
    }
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(40, 2);
  const grassMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    normalMap: M.textures.grassNormal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: M.textures.roughTex,
    color: 0xffffff,
    roughness: 0.96,
    envMapIntensity: 0.12,
  });
  [-1, 1].forEach((s) => {
    const verge = new THREE.Mesh(new THREE.PlaneGeometry(240, 4.2), grassMat);
    verge.rotation.x = -Math.PI / 2;
    verge.position.set(0, ySt + 0.004, ROAD_Z + s * 10.3);
    verge.receiveShadow = true;
    cityGroup.add(verge);
  });
  [
    [-72, 26],
    [72, 26],
    [-78, -18],
    [78, -18],
  ].forEach((p) => {
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), grassMat);
    gp.rotation.x = -Math.PI / 2;
    gp.position.set(p[0], ySt + 0.003, p[1]);
    gp.receiveShadow = true;
    cityGroup.add(gp);
  });

  // Curved gooseneck lamps along street
  for (let x = -78; x <= 78; x += 26) {
    if (Math.abs(x) < 7) continue;
    [-1, 1].forEach((s) => {
      gooseneckLamp(cityGroup, x, ySt, ROAD_Z + s * 10.9, s, M);
    });
  }

  // Stainless steel bollards with domed caps
  const bolMat = std({ color: 0x4c5259, roughness: 0.5, metalness: 0.45 });
  for (let x = -21; x <= 21; x += 3) {
    if (Math.abs(x) < 4) continue;
    cylAt(cityGroup, 0.09, 0.11, 0.92, x, ySt + 0.46, 55.5, bolMat, true, true, 12);
    const bCap = new THREE.Mesh(new THREE.SphereGeometry(0.092, 12, 8), M.metal);
    bCap.position.set(x, ySt + 0.92, 55.5);
    cityGroup.add(bCap);
  }

  const jointMat = new THREE.MeshBasicMaterial({ color: 0x6f7276, transparent: true, opacity: 0.35 });
  for (let x = -24; x <= 24; x += 3) {
    const j = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 34), jointMat);
    j.rotation.x = -Math.PI / 2;
    j.position.set(x, ySt + 0.02, 34);
    cityGroup.add(j);
  }

  // Approach path planting beds with botanical plants
  [
    [-13, 20],
    [13, 20],
    [-13, 30],
    [13, 30],
    [-13, 40],
    [13, 40],
  ].forEach((p, i) => {
    boxAt(cityGroup, 4.2, 0.45, 4.2, p[0], ySt + 0.22, p[1], planterMat, true, true, 0.06);
    plant(cityGroup, p[0] - 0.9, ySt + 0.42, p[1] - 0.6, 0.9, i * 3 + 1, M);
    plant(cityGroup, p[0] + 0.9, ySt + 0.42, p[1] + 0.6, 0.95, i * 3 + 2, M);
  });

  // Sculpted street trees with curved trunks and 3D canopies
  const rndT = (n: number) => (((Math.sin(n * 12.9898) * 43758.5453) % 1) + 1) % 1;
  let ti = 0;
  for (let x = -100; x <= 100; x += 13.5) {
    if (Math.abs(x) < 6 || Math.abs(Math.abs(x) - 30) < 5) continue;
    const r = rndT(x * 0.37 + ti * 1.7);
    tree(cityGroup, x, ySt, ROAD_Z - 10 + r * 1.2, 5.4 + r * 2.6, 2.0 + r * 0.9, ti * 7 + 3, M);
    ti++;
  }
  for (let x = -96; x <= 96; x += 15.5) {
    if (Math.abs(x) < 14) continue;
    const r = rndT(x * 0.71 + ti * 2.3);
    tree(cityGroup, x, ySt, ROAD_Z + 10.5 + r * 1.4, 6.2 + r * 3.0, 2.3 + r * 1.0, ti * 7 + 91, M);
    ti++;
  }
  for (let i = 0; i < 9; i++) {
    const x = -34 + i * 8.6 + (rndT(i * 3.1) - 0.5) * 3;
    if (Math.abs(x) < 7) continue;
    const r = rndT(i * 5.7);
    tree(cityGroup, x, ySt, 44 + r * 8, 4.2 + r * 2.4, 1.6 + r * 0.7, i * 11 + 5, M);
  }

  // Asphalt driveways & car-park bay markings
  const asphaltMat = M.asphalt.clone();
  asphaltMat.polygonOffset = true;
  asphaltMat.polygonOffsetFactor = -10;
  asphaltMat.polygonOffsetUnits = -40;
  const linePaintMat = new THREE.MeshBasicMaterial({
    color: 0xe9e6da,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    toneMapped: false,
  });
  linePaintMat.polygonOffset = true;
  linePaintMat.polygonOffsetFactor = -14;
  linePaintMat.polygonOffsetUnits = -56;

  const flat = (w: number, d: number, x: number, z: number, y: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    cityGroup.add(m);
  };
  const DRV_X = 30;
  const AISLE_Z = 29.75;
  const BAY_XS = [9, 12.5, 16, 19.5, 23];
  const BAY_ROWS = [25, 34.5];
  [-1, 1].forEach((sd) => {
    const xd = sd * DRV_X;
    flat(5, 60.5 - 27.1, xd, (60.5 + 27.1) / 2, -0.604, asphaltMat);
    flat(DRV_X + 2.5 - 5.2, 5.3, sd * ((5.2 + DRV_X + 2.5) / 2), AISLE_Z, -0.604, asphaltMat);
    for (let z = 57; z > 30; z -= 4) flat(0.14, 1.7, xd, z, -0.598, linePaintMat);
    BAY_ROWS.forEach((bz) => {
      for (let i = 0; i <= BAY_XS.length; i++) flat(0.1, 4.4, sd * (BAY_XS[0] - 1.75 + i * 3.5), bz, -0.598, linePaintMat);
    });
  });

  return {
    picks,
    monitorPicks,
    plazaGroup,
    basementGroup,
    levelGroups,
    levelCeilings,
    roofShellGroup,
    b1Group: gB1,
    b1Ceiling,
    b2Group: gB2,
    b2Ceiling,
    cabs,
    officeChairs,
    sculptureGroup,
    sculptureRings: [ring1, ring2],
    sculptureCore,
    sculptureHalo,
    streetGlows,
    interiorWarmLights,
    roofFans,
  };
}
