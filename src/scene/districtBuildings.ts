import * as THREE from 'three';
import type { BuildingId, DistrictBuildingSpec } from './districtData';
import { DISTRICT_BUILDINGS } from './districtData';
import type { MonitorPickTarget, OfficeChairHandle } from './architecture';
import type { MaterialLibrary } from './materials';
import {
  armchair,
  boxAt,
  ceilingLinearLight,
  contact,
  cylAt,
  getRoundedBox,
  makeCar,
  monitor,
  officeChair,
  plant,
  shelfUnit,
  sofaWide,
} from './props';
import { createCustomBoardScreen, createExecScreen, type ScreenRegistry } from './screens';
import { getMaxAnisotropy, makeCanvasTex, rr } from './textures';
import { getWorkstationProfile } from './workstations';

export interface DistrictChairHandle extends OfficeChairHandle {
  buildingId: BuildingId;
  groundY: number;
  floorH: number;
}

export interface DistrictBuildingHandle {
  spec: DistrictBuildingSpec;
  root: THREE.Group;
  levelGroups: THREE.Group[];
  levelCeilings: THREE.Group[];
  roofShellGroup: THREE.Group;
  chairs: DistrictChairHandle[];
  monitors: MonitorPickTarget[];
  pickMeshes: THREE.Object3D[];
  rotatingProps: Array<{ obj: THREE.Object3D; speed: number; axis: 'x' | 'y' | 'z' }>;
  warmLights: THREE.PointLight[];
}

const SLAB_THICK = 0.24;
const WALL_THICK = 0.22;
const DOOR_HALF_W = 1.65;

function makeSignTexture(title: string, subtitle: string, accentHex: string): THREE.CanvasTexture {
  return makeCanvasTex(`sign_${title}`, 768, 160, (g, W, H) => {
    g.fillStyle = '#0b111c';
    g.fillRect(0, 0, W, H);
    g.fillStyle = accentHex;
    g.fillRect(0, 0, 14, H);
    g.fillRect(0, H - 5, W, 5);

    g.fillStyle = '#ffffff';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = '800 50px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    g.fillText(title.toUpperCase(), 34, 62, W - 54);

    g.fillStyle = accentHex;
    g.font = '600 26px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    g.fillText(subtitle, 36, 118, W - 54);
  });
}

function makeGlobeTexture(): THREE.CanvasTexture {
  return makeCanvasTex('travel_globe_map', 512, 256, (g, W, H) => {
    const sea = g.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#0f3c68');
    sea.addColorStop(0.5, '#195f99');
    sea.addColorStop(1, '#0e345a');
    g.fillStyle = sea;
    g.fillRect(0, 0, W, H);

    // Latitude / longitude hairlines
    g.strokeStyle = 'rgba(186, 230, 253, 0.22)';
    g.lineWidth = 1;
    for (let x = 0; x <= W; x += 32) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 0; y <= H; y += 32) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }

    // Stylized continents
    g.fillStyle = '#4e9b5c';
    const blobs: Array<[number, number, number, number]> = [
      [110, 82, 42, 30], // N America
      [148, 152, 24, 42], // S America
      [252, 74, 34, 22], // Europe
      [268, 134, 38, 48], // Africa (Kenya highlighted)
      [352, 82, 68, 36], // Asia
      [410, 174, 28, 20], // Australia
    ];
    for (const [bx, by, rx, ry] of blobs) {
      g.beginPath();
      g.ellipse(bx, by, rx, ry, 0.2, 0, Math.PI * 2);
      g.fill();
    }
    // Highlight Nairobi hub & flight arcs
    g.strokeStyle = '#fbbf24';
    g.lineWidth = 2;
    [
      [252, 74],
      [330, 96],
      [120, 88],
      [410, 170],
    ].forEach(([tx, ty]) => {
      g.beginPath();
      g.moveTo(282, 132);
      g.quadraticCurveTo((282 + tx) / 2, Math.min(132, ty) - 24, tx, ty);
      g.stroke();
    });
    g.fillStyle = '#facc15';
    g.beginPath();
    g.arc(282, 132, 4.5, 0, Math.PI * 2);
    g.fill();
  });
}

function makeDiningTable(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  M: MaterialLibrary,
  radius = 0.68
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  cylAt(g, 0.34, 0.38, 0.035, 0, 0.018, 0, M.dark, false, true, 18);
  cylAt(g, 0.045, 0.055, 0.71, 0, 0.37, 0, M.metal, true, false, 12);
  cylAt(g, radius, radius, 0.045, 0, 0.74, 0, M.walnut, true, true, 22);
  // Tableware: two ceramic plates, menu stand & warm candle lamp
  cylAt(g, 0.12, 0.1, 0.018, -0.28, 0.77, 0, M.white, false, true, 14);
  cylAt(g, 0.12, 0.1, 0.018, 0.28, 0.77, 0, M.white, false, true, 14);
  cylAt(g, 0.045, 0.055, 0.11, 0, 0.815, 0, M.brass, false, false, 12);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd27a })
  );
  glow.position.set(0, 0.89, 0);
  g.add(glow);
  parent.add(g);
}

function makeDeskAt(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  M: MaterialLibrary
) {
  boxAt(parent, w, 0.055, d, x, y + 0.74, z, M.walnut, true, true, 0.012);
  boxAt(parent, w - 0.18, 0.7, 0.05, x, y + 0.36, z - d * 0.34, M.dark, false, true, 0.008);
  [-w * 0.44, w * 0.44].forEach((lx) => {
    boxAt(parent, 0.06, 0.72, d * 0.82, x + lx, y + 0.36, z, M.metal, false, true, 0.008);
  });
}

function makeAtmKiosk(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  rotY: number,
  M: MaterialLibrary
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  boxAt(g, 0.92, 1.95, 0.76, 0, 0.975, 0, M.dark, true, true, 0.04);
  boxAt(g, 0.78, 0.26, 0.04, 0, 1.72, 0.38, new THREE.MeshBasicMaterial({ color: 0x2563eb }), false, false);
  boxAt(g, 0.56, 0.42, 0.03, 0, 1.32, 0.385, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), false, false);
  boxAt(g, 0.62, 0.08, 0.26, 0, 0.96, 0.42, M.metal, false, false, 0.01);
  parent.add(g);
}

function buildPerimeterWalls(
  parent: THREE.Group,
  spec: DistrictBuildingSpec,
  lv: number,
  glassMat: THREE.Material,
  wallMat: THREE.Material,
  frameMat: THREE.Material,
  doorOpen: boolean,
  picks: THREE.Object3D[]
) {
  const yFloor = spec.groundY + lv * spec.floorH;
  const hWall = spec.floorH - SLAB_THICK;
  const yMid = yFloor + SLAB_THICK * 0.5 + hWall * 0.5;
  const hw = spec.w * 0.5;
  const hd = spec.d * 0.5;
  const isGround = lv === 0;

  // Back wall (opposite doorSide): solid masonry piers + upper clear glass band
  const backZ = spec.doorSide === 'south' ? spec.cz - hd + WALL_THICK * 0.5 : spec.cz + hd - WALL_THICK * 0.5;
  const frontZ = spec.doorSide === 'south' ? spec.cz + hd - WALL_THICK * 0.5 : spec.cz - hd + WALL_THICK * 0.5;

  // Back wall solid base + transom glazing for clear architectural framing
  const backLower = boxAt(parent, spec.w, hWall * 0.62, WALL_THICK, spec.cx, yFloor + SLAB_THICK * 0.5 + hWall * 0.31, backZ, wallMat, true, true, 0.03);
  const backGlass = boxAt(parent, spec.w - 0.8, hWall * 0.36, 0.06, spec.cx, yFloor + SLAB_THICK * 0.5 + hWall * 0.81, backZ, glassMat, false, false);
  picks.push(backLower, backGlass);

  // Side walls: corner piers + expansive full-height glass panes so interiors remain visible
  [-1, 1].forEach((side) => {
    const wx = spec.cx + side * (hw - WALL_THICK * 0.5);
    const gl = boxAt(parent, 0.07, hWall - 0.18, spec.d - 1.6, wx, yMid, spec.cz, glassMat, false, false);
    boxAt(parent, WALL_THICK, 0.28, spec.d, wx, yFloor + SLAB_THICK * 0.5 + 0.14, spec.cz, wallMat, false, true);
    boxAt(parent, WALL_THICK, 0.16, spec.d, wx, yFloor + spec.floorH - 0.2, spec.cz, frameMat, false, false);
    picks.push(gl);
    // Corner columns
    const colS = boxAt(parent, 0.42, hWall, 0.42, wx, yMid, frontZ, frameMat, true, true, 0.03);
    const colB = boxAt(parent, 0.42, hWall, 0.42, wx, yMid, backZ, frameMat, true, true, 0.03);
    picks.push(colS, colB);
    // Mid mullion
    boxAt(parent, 0.18, hWall, 0.18, wx, yMid, spec.cz, frameMat, false, false);
  });

  // Front facade facing street/plaza: doorway opening at (doorX - DOOR_HALF_W .. doorX + DOOR_HALF_W) on Ground floor
  if (isGround && doorOpen) {
    const leftSpan = (spec.doorX - DOOR_HALF_W) - (spec.cx - hw);
    const rightSpan = (spec.cx + hw) - (spec.doorX + DOOR_HALF_W);
    if (leftSpan > 0.3) {
      const lw = leftSpan;
      const lx = spec.cx - hw + lw * 0.5;
      const lg = boxAt(parent, lw - 0.3, hWall - 0.24, 0.07, lx, yMid, frontZ, glassMat, false, false);
      boxAt(parent, lw, 0.22, WALL_THICK, lx, yFloor + SLAB_THICK * 0.5 + 0.11, frontZ, wallMat, false, true);
      boxAt(parent, lw, 0.16, WALL_THICK, lx, yFloor + spec.floorH - 0.2, frontZ, frameMat, false, false);
      picks.push(lg);
    }
    if (rightSpan > 0.3) {
      const rw = rightSpan;
      const rx = spec.doorX + DOOR_HALF_W + rw * 0.5;
      const rg = boxAt(parent, rw - 0.3, hWall - 0.24, 0.07, rx, yMid, frontZ, glassMat, false, false);
      boxAt(parent, rw, 0.22, WALL_THICK, rx, yFloor + SLAB_THICK * 0.5 + 0.11, frontZ, wallMat, false, true);
      boxAt(parent, rw, 0.16, WALL_THICK, rx, yFloor + spec.floorH - 0.2, frontZ, frameMat, false, false);
      picks.push(rg);
    }
    // Door jambs, transom above 2.5m & propped-open glazed doors
    const transH = Math.max(0.45, hWall - 2.55);
    boxAt(parent, DOOR_HALF_W * 2, transH, 0.08, spec.doorX, yFloor + SLAB_THICK * 0.5 + 2.55 + transH * 0.5, frontZ, glassMat, false, false);
    boxAt(parent, DOOR_HALF_W * 2 + 0.28, 0.16, 0.28, spec.doorX, yFloor + SLAB_THICK * 0.5 + 2.55, frontZ, frameMat, false, false);
    [-1, 1].forEach((s) => {
      boxAt(parent, 0.14, hWall, 0.28, spec.doorX + s * (DOOR_HALF_W + 0.05), yMid, frontZ, frameMat, true, false);
      // Open double door leaves swung outward slightly
      const dirZ = spec.doorSide === 'south' ? 1 : -1;
      boxAt(parent, 0.06, 2.38, 1.15, spec.doorX + s * DOOR_HALF_W, yFloor + SLAB_THICK * 0.5 + 1.19, frontZ + dirZ * 0.58, glassMat, false, false);
    });
  } else {
    const fg = boxAt(parent, spec.w - 0.8, hWall - 0.26, 0.07, spec.cx, yMid, frontZ, glassMat, false, false);
    boxAt(parent, spec.w, 0.32, WALL_THICK, spec.cx, yFloor + SLAB_THICK * 0.5 + 0.16, frontZ, wallMat, false, true);
    boxAt(parent, spec.w, 0.18, WALL_THICK, spec.cx, yFloor + spec.floorH - 0.2, frontZ, frameMat, false, false);
    picks.push(fg);
    // Vertical architectural mullions across front glazing
    for (let mx = spec.cx - hw + 4; mx < spec.cx + hw - 2; mx += 4.5) {
      boxAt(parent, 0.14, hWall, 0.18, mx, yMid, frontZ, frameMat, false, false);
    }
  }
}

export function buildDistrictBuildings(
  cityGroup: THREE.Group,
  M: MaterialLibrary,
  screenReg: ScreenRegistry
): Map<BuildingId, DistrictBuildingHandle> {
  const handles = new Map<BuildingId, DistrictBuildingHandle>();

  const std = (o: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.08, envMapIntensity: 0.45, ...o });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xaad4eb,
    roughness: 0.14,
    metalness: 0.12,
    transparent: true,
    opacity: 0.28,
    envMapIntensity: 0.6,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const warmGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8cdb8,
    roughness: 0.16,
    metalness: 0.1,
    transparent: true,
    opacity: 0.27,
    envMapIntensity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const bankStoneMat = std({ color: 0xc9c3b8, roughness: 0.84 });
  const cryptoWallMat = std({ color: 0x1b232e, roughness: 0.52, metalness: 0.32 });
  const medicalWallMat = std({ color: 0xe2ece9, roughness: 0.62 });
  const woodCedarMat = std({ color: 0x8b5836, roughness: 0.76 });
  const terracottaMat = std({ color: 0x9b4d38, roughness: 0.78 });
  const frameDarkMat = std({ color: 0x2a333e, roughness: 0.44, metalness: 0.48 });
  const floorWarmOak = std({ color: 0x946b48, roughness: 0.62 });
  const floorTerrazzo = std({ color: 0xd8dce0, roughness: 0.52 });
  const floorSlate = std({ color: 0x2c3440, roughness: 0.56 });

  const globeTex = makeGlobeTexture();
  globeTex.colorSpace = THREE.SRGBColorSpace;
  globeTex.anisotropy = getMaxAnisotropy();

  for (const spec of DISTRICT_BUILDINGS) {
    if (spec.id === 'hub') continue;

    const root = new THREE.Group();
    root.name = `district_${spec.id}`;
    cityGroup.add(root);

    const levelGroups: THREE.Group[] = [];
    const levelCeilings: THREE.Group[] = [];
    const roofShellGroup = new THREE.Group();
    const chairs: DistrictChairHandle[] = [];
    const monitors: MonitorPickTarget[] = [];
    const pickMeshes: THREE.Object3D[] = [];
    const rotatingProps: DistrictBuildingHandle['rotatingProps'] = [];
    const warmLights: THREE.PointLight[] = [];

    const accentMat = new THREE.MeshStandardMaterial({
      color: spec.accentHex,
      emissive: spec.accentHex,
      emissiveIntensity: 0.45,
      roughness: 0.38,
      metalness: 0.2,
    });

    const wallMat =
      spec.id === 'restaurant'
        ? terracottaMat
        : spec.id === 'dealership'
          ? frameDarkMat
          : spec.id === 'bank'
            ? bankStoneMat
            : spec.id === 'crypto'
              ? cryptoWallMat
              : spec.id === 'travel'
                ? floorTerrazzo
                : spec.id === 'tourism'
                  ? woodCedarMat
                  : medicalWallMat;

    const slabFloorMat =
      spec.id === 'restaurant' || spec.id === 'tourism'
        ? floorWarmOak
        : spec.id === 'crypto'
          ? floorSlate
          : floorTerrazzo;

    const buildingGlass = spec.id === 'restaurant' || spec.id === 'tourism' ? warmGlassMat : glassMat;

    const registerMonitor = (
      lv: number,
      idx: number,
      monPos: [number, number, number],
      rotY: number,
      seatX: number,
      seatZ: number,
      role: string,
      zone: string
    ) => {
      const monGroup = monitor(levelGroups[lv], monPos[0], monPos[1], monPos[2], true, rotY, M);
      const sRef = createExecScreen(screenReg, spec.id, idx);
      sRef.lv = lv;
      const scrMesh = monGroup.children[3] as THREE.Mesh;
      const bezMesh = monGroup.children[2] as THREE.Mesh;
      if (scrMesh) {
        scrMesh.material = sRef.mat as THREE.Material;
        sRef.mesh = scrMesh;
      }
      const profile = getWorkstationProfile(spec.id);
      monitors.push({
        id: `${spec.id}-mon-${lv}-${idx}`,
        buildingId: spec.id,
        stationKey: spec.id,
        seatIndex: idx,
        projectTitle: profile.projectTitle,
        meshes: [bezMesh, scrMesh].filter(Boolean),
        lv,
        zone,
        role,
        color: spec.accent,
        seatX,
        seatZ,
        monPos,
        rotY,
        screenRef: sRef,
        screenTask: profile.jobApp.visualHeadline,
      });
    };

    const registerChair = (
      lv: number,
      x: number,
      y: number,
      z: number,
      restRot: number,
      swivelDir = 1
    ) => {
      const grp = officeChair(levelGroups[lv], x, y, z, restRot, M);
      chairs.push({
        buildingId: spec.id,
        groundY: spec.groundY,
        floorH: spec.floorH,
        group: grp,
        lv,
        restX: x,
        restZ: z,
        restRot,
        maxPush: 0.42,
        swivelDir,
        curX: x,
        curZ: z,
        curRot: restRot,
      });
    };

    // Build all floors (0 .. spec.floors - 1)
    for (let lv = 0; lv < spec.floors; lv++) {
      const lg = new THREE.Group();
      const cg = new THREE.Group();
      root.add(lg);
      root.add(cg);
      levelGroups.push(lg);
      levelCeilings.push(cg);

      const yFloor = spec.groundY + lv * spec.floorH;
      const floorSurfaceY = yFloor + SLAB_THICK * 0.5;
      const ceilY = yFloor + spec.floorH - 0.14;

      // Floor slab
      const slab = boxAt(lg, spec.w, SLAB_THICK, spec.d, spec.cx, yFloor, spec.cz, slabFloorMat, false, true, 0.03);
      pickMeshes.push(slab);

      // Ceiling slab & recessed linear lighting
      const cSlab = boxAt(cg, spec.w - 0.1, 0.16, spec.d - 0.1, spec.cx, ceilY, spec.cz, M.white, false, false);
      pickMeshes.push(cSlab);
      const lxSpan = Math.max(4, spec.w - 8);
      [-spec.d * 0.22, spec.d * 0.22].forEach((dz) => {
        ceilingLinearLight(cg, spec.cx, ceilY - 0.08, spec.cz + dz, lxSpan, 0.26, M);
      });

      buildPerimeterWalls(lg, spec, lv, buildingGlass, wallMat, frameDarkMat, true, pickMeshes);

      // Floor 0 interior props per niche, OR upper floor office/lounge setups
      if (lv === 0) {
        const light = new THREE.PointLight(
          spec.id === 'restaurant' ? 0xffd2a0 : spec.id === 'medical' ? 0xdffaf4 : 0xfff3de,
          1.2,
          spec.w + 8
        );
        light.position.set(spec.cx, floorSurfaceY + 3.1, spec.cz);
        lg.add(light);
        warmLights.push(light);
      } else {
        // Upper floors populated cleanly with glass partition accents, desks, chairs, shelves & plants
        const deskXs = spec.w >= 30 ? [-10, 0, 10] : [-4.8, 4.8];
        deskXs.forEach((dx, di) => {
          const px = spec.cx + dx;
          const pz = spec.cz - spec.d * 0.12;
          makeDeskAt(lg, px, floorSurfaceY, pz, 2.4, 1.0, M);
          registerChair(lv, px, floorSurfaceY, pz + 0.85, Math.PI, di % 2 ? 1 : -1);
          monitor(lg, px, floorSurfaceY + 0.77, pz - 0.15, true, 0, M);
          if (di === 0) {
            shelfUnit(lg, px - 2.1, floorSurfaceY, spec.cz - spec.d * 0.42, 1.6, M);
          }
        });
        plant(lg, spec.cx - spec.w * 0.42, floorSurfaceY, spec.cz + spec.d * 0.34, 1.0, lv * 13 + 3, M);
        plant(lg, spec.cx + spec.w * 0.42, floorSurfaceY, spec.cz + spec.d * 0.34, 1.0, lv * 17 + 7, M);
      }
    }

    // Populate unique hero Ground floor interiors & exterior signatures
    const g0 = levelGroups[0];
    const fy = spec.groundY + SLAB_THICK * 0.5; // -0.50m inside ground hall? Wait: -0.62 + 0.12 = -0.50; let's adjust groundY slab top cleanly!
    // Wait: let's keep floor surface flush at -0.56 or -0.50 consistently.
    // Let's check: slab center is at yFloor = -0.62, thickness SLAB_THICK = 0.08 so slab top = -0.58!
    //Wait! Above we used boxAt(..., yFloor, ..., slabFloorMat) with height SLAB_THICK = 0.24, which makes top at -0.50.
    // Let's keep SLAB_THICK at 0.24 for visual slab thickness, or sink ground floor slab slightly?
    // Even simpler: let groundY in districtData be -0.62, and for lv=0 place floor top at -0.56 (by offsetting yFloor slab center to -0.68 on lv=0 and -0.62+lv*floorH on upper floors), OR use `fy = spec.groundY + SLAB_THICK * 0.5 = -0.50` everywhere!
    // Yes! Using `fy = spec.groundY + SLAB_THICK * 0.5` (-0.50 on Ground, and `-0.50 + lv * floorH` on upper floors) guarantees 100% flush seating and standing in both buildings and sim!

    // Illuminated Entrance Fascia Sign (mounted on door side above Ground lintel)
    const signZ = spec.doorSide === 'south' ? spec.cz + spec.d * 0.5 + 0.16 : spec.cz - spec.d * 0.5 - 0.16;
    const signRotY = spec.doorSide === 'south' ? 0 : Math.PI;
    const signW = Math.min(11.5, spec.w * 0.58);
    const signBox = boxAt(g0, signW, 1.32, 0.18, spec.doorX, spec.groundY + spec.floorH + 0.18, signZ, frameDarkMat, true, false, 0.04);
    const signTex = makeSignTexture(spec.name, spec.niche, spec.accent);
    const signFace = new THREE.Mesh(
      new THREE.PlaneGeometry(signW - 0.16, 1.16),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    signFace.position.set(spec.doorX, spec.groundY + spec.floorH + 0.18, signZ + (spec.doorSide === 'south' ? 0.1 : -0.1));
    signFace.rotation.y = signRotY;
    g0.add(signFace);
    pickMeshes.push(signBox, signFace);

    if (spec.id === 'restaurant') {
      // Savanna Bistro & Grill: Kitchen pass, brick pizza oven, espresso bar, dining tables & terrace awning
      boxAt(g0, 9.6, 1.05, 1.2, spec.cx - 2.2, fy + 0.525, spec.cz - 7.0, bankStoneMat, true, true, 0.03);
      boxAt(g0, 9.8, 0.08, 1.34, spec.cx - 2.2, fy + 1.06, spec.cz - 7.0, M.walnut, false, true, 0.02);
      // Stainless exhaust hood above kitchen pass
      boxAt(g0, 8.8, 0.62, 1.4, spec.cx - 2.2, fy + 2.65, spec.cz - 7.2, M.metal, true, false, 0.04);
      // Brick wood-fired pizza oven + glowing hearth
      cylAt(g0, 1.25, 1.35, 1.5, spec.cx - 8.2, fy + 0.75, spec.cz - 7.8, terracottaMat, true, true, 18);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.24, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        terracottaMat
      );
      dome.position.set(spec.cx - 8.2, fy + 1.5, spec.cz - 7.8);
      g0.add(dome);
      cylAt(g0, 0.22, 0.26, 1.4, spec.cx - 8.2, fy + 2.8, spec.cz - 7.8, M.metal, false, false, 12);
      boxAt(g0, 0.68, 0.42, 0.16, spec.cx - 8.2, fy + 0.92, spec.cz - 6.52, new THREE.MeshBasicMaterial({ color: 0xff6b2b }), false, false);

      // Espresso & cocktail bar on east wall
      boxAt(g0, 1.25, 1.06, 6.8, spec.cx + 8.6, fy + 0.53, spec.cz - 2.2, M.walnut, true, true, 0.03);
      boxAt(g0, 0.52, 0.48, 0.75, spec.cx + 8.6, fy + 1.3, spec.cz - 3.0, M.chrome, false, false, 0.04);

      // 4 indoor dining tables + chairs facing inward
      const diningPts: Array<[number, number]> = [
        [spec.cx - 5.2, spec.cz + 0.2],
        [spec.cx + 2.6, spec.cz + 0.2],
        [spec.cx - 5.2, spec.cz + 4.8],
        [spec.cx + 2.6, spec.cz + 4.8],
      ];
      diningPts.forEach(([tx, tz], ti) => {
        makeDiningTable(g0, tx, fy, tz, M, 0.72);
        registerChair(0, tx - 1.15, fy, tz, Math.PI / 2, ti % 2 ? 1 : -1);
        registerChair(0, tx + 1.15, fy, tz, -Math.PI / 2, ti % 2 ? -1 : 1);
      });

      // Host reception podium + Kitchen pass monitor
      makeDeskAt(g0, spec.cx + 5.2, fy, spec.cz + 6.4, 1.5, 0.85, M);
      registerChair(0, spec.cx + 5.2, fy, spec.cz + 7.25, Math.PI, 1);
      registerMonitor(0, 0, [spec.cx + 5.2, fy + 0.77, spec.cz + 6.25], 0, spec.cx + 5.2, spec.cz + 7.25, 'Maître D’ Host', 'Dining Hall & Reservations');
      registerMonitor(0, 1, [spec.cx - 0.5, fy + 1.1, spec.cz - 7.0], 0, spec.cx - 0.5, spec.cz - 8.1, 'Head Chef KDS', 'Open Wood-Fired Kitchen');

      // Animated Kitchen Menu / KDS wall board on rear wall
      const kdsScreen = createCustomBoardScreen(screenReg, 640, 220, (g, w, h, t) => {
        g.fillStyle = '#120d0a';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#f59e0b';
        g.fillRect(0, 0, w, 34);
        g.fillStyle = '#120d0a';
        g.font = '800 18px "Plus Jakarta Sans", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('SAVANNA BISTRO & GRILL · LIVE KITCHEN KDS & MENU', 16, 17);
        const specials = [
          ['Wood-Fired Ribeye', '390°C Hearth', 'KES 3,400'],
          ['Swahili Red Snapper', 'Coconut Lime', 'KES 2,850'],
          ['Nyeri AA Cold Brew', 'Single Origin', 'KES 620'],
        ];
        specials.forEach((sp, i) => {
          const y = 58 + i * 50;
          g.fillStyle = i === Math.floor(t / 3) % 3 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)';
          rr(g, 16, y, w - 32, 42, 6);
          g.fill();
          g.fillStyle = '#fff';
          g.font = '700 17px sans-serif';
          g.fillText(sp[0], 28, y + 21);
          g.fillStyle = '#cbd5e1';
          g.font = '500 15px sans-serif';
          g.fillText(sp[1], 280, y + 21);
          g.fillStyle = '#fbbf24';
          g.textAlign = 'right';
          g.font = '700 16px monospace';
          g.fillText(sp[2], w - 28, y + 21);
          g.textAlign = 'left';
        });
      });
      boxAt(g0, 6.2, 2.25, 0.14, spec.cx + 1.2, fy + 2.3, spec.cz - 9.4, frameDarkMat, false, false);
      const kdsMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 2.0), kdsScreen.mat);
      kdsMesh.position.set(spec.cx + 1.2, fy + 2.3, spec.cz - 9.31);
      g0.add(kdsMesh);
      kdsScreen.setMesh(kdsMesh);

      // Exterior striped terrace awning & 2 outdoor bistro tables
      for (let i = 0; i < 9; i++) {
        const aw = boxAt(
          g0,
          1.9,
          0.14,
          3.4,
          spec.cx - 7.6 + i * 1.9,
          fy + 2.9,
          spec.cz + 11.7,
          i % 2 === 0 ? terracottaMat : M.white,
          true,
          false
        );
        aw.rotation.x = 0.18;
      }
      makeDiningTable(g0, spec.cx - 5.2, spec.groundY, spec.cz + 12.1, M, 0.56);
      makeDiningTable(g0, spec.cx + 5.2, spec.groundY, spec.cz + 12.1, M, 0.56);
    } else if (spec.id === 'dealership') {
      // Apex Motors Showroom: Rotating center car turntable + 2 flanking display vehicles + sales desks
      const turnGrp = new THREE.Group();
      turnGrp.position.set(spec.cx, fy, spec.cz + 0.4);
      g0.add(turnGrp);
      cylAt(turnGrp, 3.15, 3.25, 0.16, 0, 0.08, 0, M.dark, true, true, 32);
      cylAt(turnGrp, 3.2, 3.2, 0.03, 0, 0.165, 0, accentMat, false, false, 32);
      const heroCar = makeCar(0x9e1b24, 'suv');
      heroCar.position.set(0, 0.17, 0);
      turnGrp.add(heroCar);
      rotatingProps.push({ obj: turnGrp, speed: 0.28, axis: 'y' });

      const carLeft = makeCar(0x1f3d6e, 'sedan');
      carLeft.position.set(spec.cx - 6.0, fy, spec.cz + 2.0);
      carLeft.rotation.y = 0.42;
      g0.add(carLeft);

      const carRight = makeCar(0xcfd6de, 'hatch');
      carRight.position.set(spec.cx + 6.0, fy, spec.cz + 2.0);
      carRight.rotation.y = -0.42;
      g0.add(carRight);

      // 2 Sales & Leasing Desks at rear corners
      [spec.cx - 5.8, spec.cx + 5.8].forEach((dx, i) => {
        const dz = spec.cz - 5.5;
        makeDeskAt(g0, dx, fy, dz, 2.3, 1.05, M);
        registerChair(0, dx, fy, dz - 0.85, 0, i === 0 ? 1 : -1);
        registerMonitor(
          0,
          i,
          [dx, fy + 0.77, dz + 0.15],
          Math.PI,
          dx,
          dz - 0.85,
          i === 0 ? 'EV Fleet Advisor' : 'Finance & Lease Manager',
          'Showroom Sales Gallery'
        );
      });

      // Live Showroom Fleet Spec Board
      const carBoard = createCustomBoardScreen(screenReg, 640, 220, (g, w, h, t) => {
        g.fillStyle = '#0e1118';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#ef4444';
        g.fillRect(0, 0, w, 34);
        g.fillStyle = '#ffffff';
        g.font = '800 18px "Plus Jakarta Sans", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('APEX MOTORS · 2026 SHOWROOM FLEET & EV TELEMETRY', 16, 17);
        const models = [
          ['Apex GT Crimson SUV', 'AWD Hybrid · 540 km', 'KES 8.4M'],
          ['Apex Executive Sedan', 'Dual Motor EV · 610 km', 'KES 6.2M'],
          ['Apex Urban EV Hatch', 'Fast Charge 24m', 'KES 4.8M'],
        ];
        models.forEach((m, i) => {
          const y = 56 + i * 52;
          g.fillStyle = i === Math.floor(t / 3.5) % 3 ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.06)';
          rr(g, 16, y, w - 32, 42, 6);
          g.fill();
          g.fillStyle = '#f8fafc';
          g.font = '700 16px sans-serif';
          g.fillText(m[0], 28, y + 21);
          g.fillStyle = '#94a3b8';
          g.font = '500 14px sans-serif';
          g.fillText(m[1], 270, y + 21);
          g.fillStyle = '#fca5a5';
          g.textAlign = 'right';
          g.font = '700 16px monospace';
          g.fillText(m[2], w - 28, y + 21);
          g.textAlign = 'left';
        });
      });
      boxAt(g0, 5.8, 2.2, 0.14, spec.cx, fy + 2.3, spec.cz - 8.4, frameDarkMat, false, false);
      const cbMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.95), carBoard.mat);
      cbMesh.position.set(spec.cx, fy + 2.3, spec.cz - 8.31);
      g0.add(cbMesh);
      carBoard.setMesh(cbMesh);
    } else if (spec.id === 'bank') {
      // Nairobi Trust Bank: Portico columns, 3 ATM kiosks, teller counter, heavy steel circular vault door, FX board
      [-3.8, -1.9, 1.9, 3.8].forEach((ox) => {
        cylAt(g0, 0.34, 0.38, spec.floorH - 0.1, spec.doorX + ox, spec.groundY + spec.floorH * 0.5, spec.doorZ + 1.4, bankStoneMat, true, true, 18);
      });
      boxAt(g0, 9.6, 0.42, 2.4, spec.doorX, spec.groundY + spec.floorH - 0.1, spec.doorZ + 0.9, bankStoneMat, true, false, 0.04);

      // 3 ATM Vestibule kiosks on front-west interior
      [-8.5, -6.5, -4.5].forEach((ox) => {
        makeAtmKiosk(g0, spec.cx + ox, fy, spec.cz + 6.2, Math.PI, M);
      });

      // Teller hall counter + glass divider screens
      boxAt(g0, 9.2, 1.12, 1.15, spec.cx - 2.4, fy + 0.56, spec.cz - 3.6, bankStoneMat, true, true, 0.03);
      boxAt(g0, 9.4, 0.08, 1.32, spec.cx - 2.4, fy + 1.14, spec.cz - 3.6, M.walnut, false, true, 0.02);
      boxAt(g0, 8.8, 0.72, 0.05, spec.cx - 2.4, fy + 1.54, spec.cz - 3.1, glassMat, false, false);
      [-4.6, -0.2].forEach((ox, i) => {
        registerChair(0, spec.cx + ox, fy, spec.cz - 4.75, 0, i === 0 ? 1 : -1);
        registerMonitor(
          0,
          i,
          [spec.cx + ox, fy + 1.18, spec.cz - 3.55],
          0,
          spec.cx + ox,
          spec.cz - 4.75,
          `Branch Teller ${i + 1}`,
          'Retail Banking & RTGS Hall'
        );
      });

      // Heavy circular brushed-steel Bank Vault Door mounted on rear wall
      const vx = spec.cx + 6.2;
      const vz = spec.cz - 10.35;
      boxAt(g0, 3.6, 3.2, 0.55, vx, fy + 1.6, vz, frameDarkMat, true, true, 0.05);
      const vaultDoor = cylAt(g0, 1.28, 1.28, 0.34, vx, fy + 1.55, vz + 0.32, M.chrome, true, false, 28);
      vaultDoor.rotation.x = Math.PI / 2;
      const wheelRing = cylAt(g0, 0.44, 0.44, 0.14, vx, fy + 1.55, vz + 0.52, M.brass, false, false, 18);
      wheelRing.rotation.x = Math.PI / 2;
      for (let s = 0; s < 3; s++) {
        const spoke = boxAt(g0, 0.84, 0.06, 0.06, vx, fy + 1.55, vz + 0.56, M.brass, false, false);
        spoke.rotation.z = (s * Math.PI) / 3;
      }

      // Customer waiting sofas & FX Treasury Board
      sofaWide(g0, spec.cx + 6.4, fy, spec.cz + 3.2, -Math.PI / 2, M.leatherMat, M);
      const fxBoard = createCustomBoardScreen(screenReg, 640, 220, (g, w, h, t) => {
        g.fillStyle = '#08101c';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#3b82f6';
        g.fillRect(0, 0, w, 34);
        g.fillStyle = '#ffffff';
        g.font = '800 18px sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('NAIROBI TRUST BANK · LIVE INTERBANK FX & QUEUE', 16, 17);
        const rows = [
          ['USD / KES', '128.40', '129.85', '+0.12%'],
          ['EUR / KES', '139.10', '141.05', '+0.24%'],
          ['GBP / KES', '163.20', '165.40', '-0.08%'],
        ];
        rows.forEach((r, i) => {
          const y = 58 + i * 50;
          g.fillStyle = 'rgba(59,130,246,0.12)';
          rr(g, 16, y, w - 32, 42, 6);
          g.fill();
          g.fillStyle = '#f8fafc';
          g.font = '700 17px monospace';
          g.fillText(r[0], 28, y + 21);
          g.fillStyle = '#93c5fd';
          g.fillText(`BUY ${r[1]}`, 200, y + 21);
          g.fillStyle = '#86efac';
          g.fillText(`SELL ${r[2]}`, 380, y + 21);
          g.fillStyle = r[3].startsWith('+') ? '#4ade80' : '#fca5a5';
          g.fillText(r[3], w - 95, y + 21);
        });
        void t;
      });
      boxAt(g0, 5.8, 2.2, 0.14, spec.cx - 3.6, fy + 2.35, spec.cz - 10.4, frameDarkMat, false, false);
      const fxMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.95), fxBoard.mat);
      fxMesh.position.set(spec.cx - 3.6, fy + 2.35, spec.cz - 10.31);
      g0.add(fxMesh);
      fxBoard.setMesh(fxMesh);
    } else if (spec.id === 'crypto') {
      // BitVault Crypto Exchange: Exterior scrolling ticker + cold-storage vault pod + quant trading pods
      const ticker = createCustomBoardScreen(screenReg, 960, 128, (g, w, h, t) => {
        g.fillStyle = '#060a10';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#10b981';
        g.fillRect(0, 0, w, 4);
        g.fillRect(0, h - 4, w, 4);
        const text =
          'BTC/USDT $94,280 ▲ +3.4%   ·   ETH/USDT $3,415 ▲ +2.2%   ·   SOL/USDT $198.40 ▲ +5.6%   ·   USDT/KES 129.45   ·   COLD VAULT 5/7 MPC SEALED   ·   ';
        g.font = '800 38px "IBM Plex Mono", monospace';
        g.textBaseline = 'middle';
        const offset = (t * 70) % 1400;
        g.fillStyle = '#6ee7b7';
        g.fillText(text + text, 20 - offset, h / 2);
      });
      boxAt(g0, 16.4, 1.35, 0.24, spec.cx, spec.groundY + spec.floorH * 2 - 0.1, spec.cz + spec.d * 0.5 + 0.16, frameDarkMat, true, false);
      const tkMesh = new THREE.Mesh(new THREE.PlaneGeometry(16.0, 1.15), ticker.mat);
      tkMesh.position.set(spec.cx, spec.groundY + spec.floorH * 2 - 0.1, spec.cz + spec.d * 0.5 + 0.29);
      g0.add(tkMesh);
      ticker.setMesh(tkMesh);

      // Central Cold-Storage Hardware Vault Pod
      boxAt(g0, 4.2, 2.9, 3.2, spec.cx, fy + 1.45, spec.cz - 4.8, glassMat, false, false);
      boxAt(g0, 4.4, 0.16, 3.4, spec.cx, fy + 2.95, spec.cz - 4.8, frameDarkMat, true, false);
      [-1.0, 0, 1.0].forEach((ox) => {
        boxAt(g0, 0.68, 2.2, 0.72, spec.cx + ox, fy + 1.1, spec.cz - 4.8, M.dark, true, false, 0.02);
        boxAt(g0, 0.44, 0.08, 0.04, spec.cx + ox, fy + 1.85, spec.cz - 4.42, accentMat, false, false);
        boxAt(g0, 0.44, 0.08, 0.04, spec.cx + ox, fy + 1.45, spec.cz - 4.42, accentMat, false, false);
      });

      // 4 Quant Trading Pods with monitors & chairs
      const pods: Array<[number, number, number]> = [
        [spec.cx - 6.6, spec.cz + 1.8, 0],
        [spec.cx + 6.6, spec.cz + 1.8, 0],
        [spec.cx - 6.6, spec.cz - 3.6, Math.PI],
        [spec.cx + 6.6, spec.cz - 3.6, Math.PI],
      ];
      pods.forEach(([px, pz, rot], i) => {
        makeDeskAt(g0, px, fy, pz, 2.6, 1.1, M);
        const czSeat = rot === 0 ? pz + 0.92 : pz - 0.92;
        const monZ = rot === 0 ? pz - 0.2 : pz + 0.2;
        const faceSeat = rot === 0 ? Math.PI : 0;
        registerChair(0, px, fy, czSeat, faceSeat, i % 2 ? 1 : -1);
        registerMonitor(
          0,
          i,
          [px, fy + 0.77, monZ],
          rot,
          px,
          czSeat,
          i < 2 ? 'Quant Spot Trader' : 'MPC Custody Auditor',
          'BitVault Trading Floor'
        );
      });

      // Giant Spot Orderbook Screen on back wall
      const obBoard = createCustomBoardScreen(screenReg, 640, 220, (g, w, h, t) => {
        g.fillStyle = '#070b12';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#10b981';
        g.fillRect(0, 0, w, 34);
        g.fillStyle = '#070b12';
        g.font = '800 18px sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('BITVAULT EXCHANGE · ORDERBOOK DEPTH & VALIDATOR NODES', 16, 17);
        for (let i = 0; i < 6; i++) {
          const bidW = 90 + Math.abs(Math.sin(t + i)) * 150;
          const askW = 80 + Math.abs(Math.cos(t * 1.1 + i)) * 145;
          const y = 50 + i * 26;
          g.fillStyle = 'rgba(16,185,129,0.28)';
          g.fillRect(280 - bidW, y, bidW, 20);
          g.fillStyle = 'rgba(239,68,68,0.28)';
          g.fillRect(360, y, askW, 20);
          g.fillStyle = '#6ee7b7';
          g.font = '600 13px monospace';
          g.fillText(`$${(94280 - i * 15).toLocaleString()}`, 26, y + 10);
          g.fillStyle = '#fca5a5';
          g.fillText(`$${(94295 + i * 15).toLocaleString()}`, w - 120, y + 10);
        }
      });
      boxAt(g0, 6.2, 2.3, 0.14, spec.cx, fy + 2.3, spec.cz - 9.4, frameDarkMat, false, false);
      const obMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 2.05), obBoard.mat);
      obMesh.position.set(spec.cx, fy + 2.3, spec.cz - 9.31);
      g0.add(obMesh);
      obBoard.setMesh(obMesh);
    } else if (spec.id === 'travel') {
      // Skyline Travel & Aviation: Curved aviation canopy, rotating hanging 3D globe, live flight board, check-in desks
      const canopy = boxAt(g0, 14.5, 0.24, 3.8, spec.doorX, spec.groundY + spec.floorH + 0.55, spec.doorZ - 1.4, M.white, true, false, 0.08);
      canopy.rotation.x = -0.14;

      // Suspended rotating 3D globe in main lobby
      const globeMat = new THREE.MeshStandardMaterial({
        map: globeTex,
        roughness: 0.35,
        metalness: 0.1,
      });
      const globe = new THREE.Mesh(new THREE.SphereGeometry(1.18, 28, 20), globeMat);
      globe.position.set(spec.cx, fy + 2.35, spec.cz - 2.0);
      globe.rotation.z = 0.22;
      g0.add(globe);
      cylAt(g0, 0.05, 0.05, 1.1, spec.cx, fy + 3.4, spec.cz - 2.0, M.brass, false, false, 10);
      cylAt(g0, 0.9, 1.05, 0.18, spec.cx, fy + 0.09, spec.cz - 2.0, M.dark, false, true, 24);
      rotatingProps.push({ obj: globe, speed: 0.38, axis: 'y' });

      // Check-in counter & travel agent desks (remember north entrance = doorSide:'north')
      boxAt(g0, 8.6, 1.04, 1.15, spec.cx - 6.8, fy + 0.52, spec.cz + 3.2, M.white, true, true, 0.04);
      boxAt(g0, 8.8, 0.07, 1.28, spec.cx - 6.8, fy + 1.06, spec.cz + 3.2, accentMat, false, false);
      [-9.0, -4.6].forEach((ox, i) => {
        registerChair(0, spec.cx + ox, fy, spec.cz + 4.35, Math.PI, i === 0 ? 1 : -1);
        registerMonitor(
          0,
          i,
          [spec.cx + ox, fy + 1.1, spec.cz + 3.15],
          Math.PI,
          spec.cx + ox,
          spec.cz + 4.35,
          `Flight & Visa Agent ${i + 1}`,
          'Check-In & Ticketing Counter'
        );
      });

      // Terminal waiting seating & side lounge
      sofaWide(g0, spec.cx + 7.2, fy, spec.cz + 1.5, Math.PI, M.fabricBlue, M);
      sofaWide(g0, spec.cx + 7.2, fy, spec.cz - 1.5, 0, M.fabricBlue, M);

      // Live JKIA Departures Board facing north entrance (-Z)
      const flBoard = createCustomBoardScreen(screenReg, 680, 230, (g, w, h, t) => {
        g.fillStyle = '#07111e';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#38bdf8';
        g.fillRect(0, 0, w, 34);
        g.fillStyle = '#07111e';
        g.font = '800 18px sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('SKYLINE TRAVEL · LIVE NBO (JKIA) DEPARTURES BOARD', 16, 17);
        const flights = [
          ['KQ 100', 'LONDON LHR', '23:15', 'ON TIME'],
          ['EK 722', 'DUBAI DXB', '22:45', 'CHECK-IN'],
          ['SA 185', 'JOHANNESBURG', '16:20', 'BOARDING'],
          ['PW 712', 'ZANZIBAR ZNZ', '14:10', 'CONFIRMED'],
        ];
        flights.forEach((f, i) => {
          const y = 52 + i * 42;
          g.fillStyle = 'rgba(56,189,248,0.1)';
          rr(g, 14, y, w - 28, 36, 5);
          g.fill();
          g.fillStyle = '#7dd3fc';
          g.font = '700 16px monospace';
          g.fillText(f[0], 26, y + 18);
          g.fillStyle = '#f8fafc';
          g.font = '700 16px sans-serif';
          g.fillText(f[1], 140, y + 18);
          g.fillStyle = '#cbd5e1';
          g.font = '600 16px monospace';
          g.fillText(f[2], 410, y + 18);
          g.fillStyle = i === Math.floor(t / 2.5) % 4 ? '#facc15' : '#4ade80';
          g.fillText(f[3], 520, y + 18);
        });
      });
      boxAt(g0, 7.6, 2.4, 0.14, spec.cx, fy + 2.35, spec.cz + 8.4, frameDarkMat, false, false);
      const flMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.3, 2.15), flBoard.mat);
      flMesh.position.set(spec.cx, fy + 2.35, spec.cz + 8.31);
      flMesh.rotation.y = Math.PI;
      g0.add(flMesh);
      flBoard.setMesh(flMesh);
    } else if (spec.id === 'tourism') {
      // Kenya Safari & Tourism: Cedar pergola entrance, 3D topographical Kenya relief map table, 4x4 Jeep showcase
      for (let i = 0; i < 7; i++) {
        boxAt(g0, 0.24, 0.24, 3.2, spec.doorX - 4.5 + i * 1.5, spec.groundY + spec.floorH + 0.1, spec.doorZ - 1.2, woodCedarMat, true, false);
      }

      // 3D Topographical Kenya / Mt. Kenya & Mara Relief Map Table
      const mapX = spec.cx - 5.8;
      const mapZ = spec.cz - 0.8;
      boxAt(g0, 4.4, 0.78, 2.8, mapX, fy + 0.39, mapZ, M.walnut, true, true, 0.04);
      boxAt(g0, 4.0, 0.08, 2.4, mapX, fy + 0.8, mapZ, std({ color: 0x3b6e3c, roughness: 0.85 }), false, true);
      // Terrain elevation tiers & snow-capped Mt. Kenya peak
      boxAt(g0, 1.5, 0.16, 1.1, mapX - 0.6, fy + 0.88, mapZ - 0.3, std({ color: 0x628c45, roughness: 0.88 }), false, false, 0.04);
      cylAt(g0, 0.12, 0.65, 0.42, mapX + 0.4, fy + 1.01, mapZ + 0.15, std({ color: 0x736857, roughness: 0.9 }), true, false, 7);
      cylAt(g0, 0.01, 0.22, 0.16, mapX + 0.4, fy + 1.24, mapZ + 0.15, M.white, false, false, 7);

      // Indoor Expedition 4x4 Safari SUV with roof rack
      const jeep = makeCar(0x4b5c34, 'suv');
      jeep.position.set(spec.cx + 7.2, fy + 0.1, spec.cz - 1.0);
      jeep.rotation.y = -0.55;
      boxAt(jeep, 1.22, 0.08, 1.85, 0, 1.54, -0.35, M.dark, false, false, 0.02);
      g0.add(jeep);
      cylAt(g0, 2.8, 2.9, 0.1, spec.cx + 7.2, fy + 0.05, spec.cz - 1.0, bankStoneMat, false, true, 24);

      // 2 Safari Planner Desks
      [-5.5, 5.5].forEach((ox, i) => {
        const dz = spec.cz + 5.2;
        makeDeskAt(g0, spec.cx + ox, fy, dz, 2.5, 1.05, M);
        registerChair(0, spec.cx + ox, fy, dz + 0.88, Math.PI, i === 0 ? 1 : -1);
        registerMonitor(
          0,
          i,
          [spec.cx + ox, fy + 0.77, dz - 0.15],
          Math.PI,
          spec.cx + ox,
          dz + 0.88,
          i === 0 ? 'Safari Expedition Planner' : 'Eco-Lodge Concierge',
          'Safari Gallery & Expeditions'
        );
      });

      // Live Safari Park Trail & Conservancy Board
      const sfBoard = createCustomBoardScreen(screenReg, 680, 220, (g, w, h, t) => {
        g.fillStyle = '#0e170e';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#84cc16';
        g.fillRect(0, 0, w, 34);
        g.fillStyle = '#0e170e';
        g.font = '800 18px sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('KENYA SAFARI & TOURISM · CONSERVANCY & LODGE STATUS', 16, 17);
        const parks = [
          ['Maasai Mara Reserve', 'Migration Active', '91% Lodge Occ.'],
          ['Amboseli & Kilimanjaro', 'Clear Peaks', '4x4 Ready'],
          ['Mt. Kenya Highlands', 'Alpine Trails Open', 'Guides Briefed'],
        ];
        parks.forEach((p, i) => {
          const y = 56 + i * 50;
          g.fillStyle = i === Math.floor(t / 3.2) % 3 ? 'rgba(132,204,22,0.18)' : 'rgba(255,255,255,0.05)';
          rr(g, 14, y, w - 28, 42, 6);
          g.fill();
          g.fillStyle = '#f8fafc';
          g.font = '700 17px sans-serif';
          g.fillText(p[0], 26, y + 21);
          g.fillStyle = '#bef264';
          g.font = '600 15px sans-serif';
          g.fillText(p[1], 300, y + 21);
          g.fillStyle = '#e2e8f0';
          g.textAlign = 'right';
          g.fillText(p[2], w - 26, y + 21);
          g.textAlign = 'left';
        });
      });
      boxAt(g0, 7.2, 2.3, 0.14, spec.cx, fy + 2.35, spec.cz + 8.4, frameDarkMat, false, false);
      const sfMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.9, 2.05), sfBoard.mat);
      sfMesh.position.set(spec.cx, fy + 2.35, spec.cz + 8.31);
      sfMesh.rotation.y = Math.PI;
      g0.add(sfMesh);
      sfBoard.setMesh(sfMesh);
    } else if (spec.id === 'medical') {
      // VitalCare Medical & Pharmacy: Rotating 3D emerald cross beacon, pharmacy shelves, triage desk, diagnostic board
      const crossBeacon = new THREE.Group();
      crossBeacon.position.set(spec.doorX, spec.groundY + spec.h + 1.85, spec.doorZ);
      boxAt(crossBeacon, 2.1, 0.68, 0.34, 0, 0, 0, accentMat, true, false, 0.04);
      boxAt(crossBeacon, 0.68, 2.1, 0.34, 0, 0, 0, accentMat, true, false, 0.04);
      roofShellGroup.add(crossBeacon);
      rotatingProps.push({ obj: crossBeacon, speed: 0.75, axis: 'y' });

      // 24h Pharmacy Dispensary Counter & Backlit Medicine Racks on west wing
      boxAt(g0, 10.2, 1.06, 1.15, spec.cx - 14.5, fy + 0.53, spec.cz - 2.2, M.white, true, true, 0.03);
      boxAt(g0, 10.4, 0.08, 1.28, spec.cx - 14.5, fy + 1.08, spec.cz - 2.2, accentMat, false, false);
      // Backlit medicine racks
      boxAt(g0, 10.4, 2.55, 0.45, spec.cx - 14.5, fy + 1.28, spec.cz - 7.1, M.white, true, true, 0.03);
      for (let r = 0; r < 3; r++) {
        for (let b = 0; b < 12; b++) {
          const bottleCol = b % 3 === 0 ? 0x2dd4bf : b % 3 === 1 ? 0x38bdf8 : 0xf59e0b;
          boxAt(
            g0,
            0.22,
            0.28,
            0.18,
            spec.cx - 18.8 + b * 0.78,
            fy + 0.68 + r * 0.62,
            spec.cz - 6.82,
            std({ color: bottleCol, roughness: 0.35 }),
            false,
            false
          );
        }
      }

      // Central Patient Triage Desk + Waiting Armchairs
      boxAt(g0, 4.6, 1.04, 1.1, spec.cx, fy + 0.52, spec.cz - 1.2, M.white, true, true, 0.03);
      registerChair(0, spec.cx, fy, spec.cz - 2.3, 0, 1);
      registerMonitor(0, 0, [spec.cx, fy + 1.08, spec.cz - 1.1], 0, spec.cx, spec.cz - 2.3, 'Lead Pharmacist & Triage', '24h Pharmacy & Patient Intake');

      // Diagnostic Consult Desks on east wing
      [spec.cx + 10.5, spec.cx + 17.5].forEach((dx, i) => {
        const dz = spec.cz - 2.6;
        makeDeskAt(g0, dx, fy, dz, 2.4, 1.05, M);
        registerChair(0, dx, fy, dz - 0.88, 0, i === 0 ? 1 : -1);
        registerMonitor(
          0,
          i + 1,
          [dx, fy + 0.77, dz + 0.15],
          Math.PI,
          dx,
          dz - 0.88,
          i === 0 ? 'Attending Physician' : 'Clinical Lab Specialist',
          'Outpatient & Diagnostic Suites'
        );
      });

      [-6.5, 6.5].forEach((ox) => {
        armchair(g0, spec.cx + ox, fy, spec.cz + 3.2, Math.PI, M.fabricBlue, M);
      });

      // Live Diagnostic Vitals & Queue Display Board
      const medBoard = createCustomBoardScreen(screenReg, 680, 220, (g, w, h, t) => {
        g.fillStyle = '#071516';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#2dd4bf';
        g.fillRect(0, 0, w, 34);
        g.fillStyle = '#071516';
        g.font = '800 18px sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('VITALCARE MEDICAL · 24H TRIAGE, LAB & COLD-CHAIN TELEMETRY', 16, 17);
        // Animated ECG waveform
        g.strokeStyle = '#4ade80';
        g.lineWidth = 3;
        g.beginPath();
        for (let x = 20; x < 360; x += 4) {
          const ph = ((x + t * 80) % 90) / 90;
          const ecg = ph > 0.42 && ph < 0.48 ? -26 : ph >= 0.48 && ph < 0.54 ? 18 : 0;
          const py = 105 + ecg;
          if (x === 20) g.moveTo(x, py);
          else g.lineTo(x, py);
        }
        g.stroke();
        const stats = [
          ['Cold Chain', '4.1 °C OK'],
          ['Lab Panel', '18 min'],
          ['Queue Wait', '4 min'],
        ];
        stats.forEach((st, i) => {
          const y = 56 + i * 50;
          g.fillStyle = 'rgba(45,212,191,0.14)';
          rr(g, 390, y, 270, 42, 6);
          g.fill();
          g.fillStyle = '#99f6e4';
          g.font = '600 15px sans-serif';
          g.fillText(st[0], 404, y + 21);
          g.fillStyle = '#ffffff';
          g.textAlign = 'right';
          g.font = '700 16px monospace';
          g.fillText(st[1], 646, y + 21);
          g.textAlign = 'left';
        });
      });
      boxAt(g0, 7.6, 2.3, 0.14, spec.cx + 1.5, fy + 2.35, spec.cz - 7.4, frameDarkMat, false, false);
      const medMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.3, 2.05), medBoard.mat);
      medMesh.position.set(spec.cx + 1.5, fy + 2.35, spec.cz - 7.31);
      g0.add(medMesh);
      medBoard.setMesh(medMesh);
    }

    // Roof shell + parapet + HVAC machinery + skylight frame
    root.add(roofShellGroup);
    const roofY = spec.groundY + spec.h;
    const roofSlab = boxAt(roofShellGroup, spec.w + 0.6, 0.34, spec.d + 0.6, spec.cx, roofY, spec.cz, wallMat, true, true, 0.05);
    const roofCap = boxAt(roofShellGroup, spec.w + 0.8, 0.18, spec.d + 0.8, spec.cx, roofY + 0.24, spec.cz, frameDarkMat, false, false, 0.03);
    boxAt(roofShellGroup, spec.w * 0.24, 1.4, spec.d * 0.26, spec.cx - spec.w * 0.18, roofY + 0.85, spec.cz, std({ color: 0x6f7884, roughness: 0.72 }), true, false, 0.05);
    boxAt(roofShellGroup, spec.w * 0.32, 0.28, spec.d * 0.34, spec.cx + spec.w * 0.14, roofY + 0.28, spec.cz, accentMat, false, false, 0.04);
    pickMeshes.push(roofSlab, roofCap);

    // Exterior paved apron & soft contact shadow
    const pl = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.w + 6, spec.d + 6),
      std({ color: 0x8b8f94, roughness: 0.9 })
    );
    pl.rotation.x = -Math.PI / 2;
    pl.position.set(spec.cx, spec.groundY - 0.004, spec.cz);
    pl.receiveShadow = true;
    cityGroup.add(pl);
    contact(cityGroup, spec.cx, spec.groundY, spec.cz, spec.w + 9, spec.d + 9, 0.45, M.textures.shadowTex);

    handles.set(spec.id, {
      spec,
      root,
      levelGroups,
      levelCeilings,
      roofShellGroup,
      chairs,
      monitors,
      pickMeshes,
      rotatingProps,
      warmLights,
    });
  }

  return handles;
}
