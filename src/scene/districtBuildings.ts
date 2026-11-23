import * as THREE from 'three';
import type { BuildingId, DistrictBuildingSpec } from './districtData';
import { DISTRICT_BUILDINGS } from './districtData';
import type { MonitorPickTarget, OfficeChairHandle } from './architecture';
import {
  buildOrganicShrub,
  buildPlanterTrough,
  buildTropicalPalm,
  buildVinePergolaCanopy,
  getArchitecturalMaterials,
  getAsymmetricShedRoofGeo,
  getGableClerestoryGeo,
  getRoundedPerimeterWallGeo,
  getRoundedRibbonGeo,
  getRoundedSlabGeo,
  getSlopedRoofBladeGeo,
  type ArchitecturalMaterials,
} from './architecturalForms';
import type { MaterialLibrary } from './materials';
import {
  armchair,
  boxAt,
  ceilingLinearLight,
  contact,
  cylAt,
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

type DistrictArchStyle = 'tower' | 'blade' | 'stone_pergola' | 'shed_seam';

function getBuildingArchStyle(id: BuildingId): DistrictArchStyle {
  if (id === 'bank' || id === 'crypto') return 'tower';
  if (id === 'medical' || id === 'travel') return 'blade';
  if (id === 'restaurant' || id === 'tourism' || id === 'realestate') return 'stone_pergola';
  return 'shed_seam';
}

function buildPerimeterWalls(
  parent: THREE.Group,
  spec: DistrictBuildingSpec,
  lv: number,
  glassMat: THREE.Material,
  wallMat: THREE.Material,
  frameMat: THREE.Material,
  archMats: ArchitecturalMaterials,
  style: DistrictArchStyle,
  doorOpen: boolean,
  picks: THREE.Object3D[]
) {
  const yFloor = spec.groundY + lv * spec.floorH;
  const hWall = spec.floorH - SLAB_THICK;
  const yMid = yFloor + SLAB_THICK * 0.5 + hWall * 0.5;
  const hw = spec.w * 0.5;
  const hd = spec.d * 0.5;
  const isGround = lv === 0;
  const dirZ = spec.doorSide === 'south' ? 1 : -1;

  const backZ = spec.doorSide === 'south' ? spec.cz - hd + WALL_THICK * 0.5 : spec.cz + hd - WALL_THICK * 0.5;
  const frontZ = spec.doorSide === 'south' ? spec.cz + hd - WALL_THICK * 0.5 : spec.cz - hd + WALL_THICK * 0.5;

  // Back wall solid base + transom glazing for clear architectural framing
  const backLower = boxAt(parent, spec.w - 0.8, hWall * 0.54, WALL_THICK, spec.cx, yFloor + SLAB_THICK * 0.5 + hWall * 0.27, backZ, wallMat, true, true, 0.03);
  const backGlass = boxAt(parent, spec.w - 1.2, hWall * 0.44, 0.06, spec.cx, yFloor + SLAB_THICK * 0.5 + hWall * 0.77, backZ, glassMat, false, false);
  picks.push(backLower, backGlass);

  // Side walls: sleek rounded cylindrical columns or ashlar stone feature piers + full-height glazing
  [-1, 1].forEach((side) => {
    const wx = spec.cx + side * (hw - WALL_THICK * 0.5);
    const gl = boxAt(parent, 0.06, hWall - 0.18, spec.d - 1.8, wx, yMid, spec.cz, glassMat, false, false);
    boxAt(parent, WALL_THICK * 0.75, 0.22, spec.d - 1.4, wx, yFloor + SLAB_THICK * 0.5 + 0.11, spec.cz, wallMat, false, true);
    boxAt(parent, WALL_THICK * 0.75, 0.14, spec.d - 1.4, wx, yFloor + spec.floorH - 0.18, spec.cz, frameMat, false, false);
    picks.push(gl);

    if (style === 'stone_pergola') {
      // Natural Ashlar Stone architectural corner piers (Reference Image 4)
      const pierF = boxAt(parent, 0.72, hWall, 0.72, wx - side * 0.12, yMid, frontZ - dirZ * 0.12, archMats.ashlarStone, true, true, 0.04);
      const pierB = boxAt(parent, 0.72, hWall, 0.72, wx - side * 0.12, yMid, backZ + dirZ * 0.12, archMats.ashlarStone, true, true, 0.04);
      picks.push(pierF, pierB);
      // Warm vertical timber privacy fin accents along flank wall
      for (let k = -2; k <= 2; k++) {
        boxAt(parent, 0.08, hWall - 0.14, 0.16, wx + side * 0.14, yMid, spec.cz + k * 0.36, archMats.timberFin, true, false, 0.01);
      }
    } else {
      // Sculpted cylindrical pilotis corner columns (avoiding boxy square corners)
      const colMat = style === 'tower' || style === 'blade' ? archMats.stuccoWhite : frameMat;
      const colS = cylAt(parent, 0.24, 0.24, hWall, wx - side * 0.15, yMid, frontZ - dirZ * 0.15, colMat, true, true, 16);
      const colB = cylAt(parent, 0.24, 0.24, hWall, wx - side * 0.15, yMid, backZ + dirZ * 0.15, colMat, true, true, 16);
      picks.push(colS, colB);
      // Mid-flank timber fin or bronze mullion screen
      for (let k = -1; k <= 1; k++) {
        boxAt(
          parent,
          0.08,
          hWall - 0.14,
          0.14,
          wx + side * 0.06,
          yMid,
          spec.cz + k * 0.42,
          style === 'tower' ? archMats.timberFin : archMats.bronzeMullion,
          false,
          false,
          0.01
        );
      }
    }
  });

  // Front facade facing street/plaza: doorway opening at (doorX - DOOR_HALF_W .. doorX + DOOR_HALF_W) on Ground floor
  if (isGround && doorOpen) {
    const leftSpan = (spec.doorX - DOOR_HALF_W) - (spec.cx - hw);
    const rightSpan = (spec.cx + hw) - (spec.doorX + DOOR_HALF_W);
    if (leftSpan > 0.3) {
      const lw = leftSpan;
      const lx = spec.cx - hw + lw * 0.5;
      const lg = boxAt(parent, lw - 0.5, hWall - 0.24, 0.06, lx, yMid, frontZ, glassMat, false, false);
      boxAt(parent, lw - 0.4, 0.18, WALL_THICK * 0.75, lx, yFloor + SLAB_THICK * 0.5 + 0.09, frontZ, wallMat, false, true);
      boxAt(parent, lw - 0.4, 0.14, WALL_THICK * 0.75, lx, yFloor + spec.floorH - 0.18, frontZ, frameMat, false, false);
      picks.push(lg);
    }
    if (rightSpan > 0.3) {
      const rw = rightSpan;
      const rx = spec.doorX + DOOR_HALF_W + rw * 0.5;
      const rg = boxAt(parent, rw - 0.5, hWall - 0.24, 0.06, rx, yMid, frontZ, glassMat, false, false);
      boxAt(parent, rw - 0.4, 0.18, WALL_THICK * 0.75, rx, yFloor + SLAB_THICK * 0.5 + 0.09, frontZ, wallMat, false, true);
      boxAt(parent, rw - 0.4, 0.14, WALL_THICK * 0.75, rx, yFloor + spec.floorH - 0.18, frontZ, frameMat, false, false);
      picks.push(rg);
    }
    // Door jambs, transom above 2.5m & propped-open glazed doors
    const transH = Math.max(0.45, hWall - 2.55);
    boxAt(parent, DOOR_HALF_W * 2, transH, 0.06, spec.doorX, yFloor + SLAB_THICK * 0.5 + 2.55 + transH * 0.5, frontZ, glassMat, false, false);
    boxAt(parent, DOOR_HALF_W * 2 + 0.28, 0.14, 0.24, spec.doorX, yFloor + SLAB_THICK * 0.5 + 2.55, frontZ, archMats.bronzeMullion, false, false);
    [-1, 1].forEach((s) => {
      boxAt(parent, 0.12, hWall, 0.24, spec.doorX + s * (DOOR_HALF_W + 0.05), yMid, frontZ, archMats.bronzeMullion, true, false);
      // Open double door leaves swung outward slightly
      boxAt(parent, 0.05, 2.38, 1.15, spec.doorX + s * DOOR_HALF_W, yFloor + SLAB_THICK * 0.5 + 1.19, frontZ + dirZ * 0.58, glassMat, false, false);
    });
  } else {
    const fg = boxAt(parent, spec.w - 1.2, hWall - 0.24, 0.06, spec.cx, yMid, frontZ, glassMat, false, false);
    boxAt(parent, spec.w - 0.9, 0.22, WALL_THICK * 0.75, spec.cx, yFloor + SLAB_THICK * 0.5 + 0.11, frontZ, wallMat, false, true);
    boxAt(parent, spec.w - 0.9, 0.14, WALL_THICK * 0.75, spec.cx, yFloor + spec.floorH - 0.18, frontZ, frameMat, false, false);
    picks.push(fg);
    // Vertical architectural mullions across front glazing
    for (let mx = spec.cx - hw + 4; mx < spec.cx + hw - 2; mx += 4.5) {
      boxAt(parent, 0.11, hWall, 0.14, mx, yMid, frontZ, archMats.bronzeMullion, false, false);
    }
  }
}

export function buildDistrictBuildings(
  cityGroup: THREE.Group,
  M: MaterialLibrary,
  screenReg: ScreenRegistry
): Map<BuildingId, DistrictBuildingHandle> {
  const handles = new Map<BuildingId, DistrictBuildingHandle>();
  const archMats = getArchitecturalMaterials(M);

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

  const mkTileTex = (t: THREE.Texture, rx: number, ry: number) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    return c;
  };

  const bankStoneMat = std({
    map: mkTileTex(M.textures.concreteTex, 3, 2),
    normalMap: mkTileTex(M.textures.concreteNormal, 3, 2),
    normalScale: new THREE.Vector2(0.45, 0.45),
    color: 0xc9c3b8,
    roughness: 0.84,
  });
  const cryptoWallMat = std({ color: 0x1b232e, roughness: 0.52, metalness: 0.32 });
  const medicalWallMat = std({
    normalMap: M.textures.plasterNormal,
    normalScale: new THREE.Vector2(0.32, 0.32),
    color: 0xe2ece9,
    roughness: 0.62,
  });
  const logisticsWallMat = std({ color: 0x2d3744, roughness: 0.58, metalness: 0.28 });
  const woodCedarMat = std({
    map: mkTileTex(M.textures.woodTex, 3, 2),
    normalMap: mkTileTex(M.textures.woodNormal, 3, 2),
    normalScale: new THREE.Vector2(0.48, 0.48),
    color: 0xa46c44,
    roughness: 0.72,
  });
  const terracottaMat = std({
    normalMap: M.textures.plasterNormal,
    normalScale: new THREE.Vector2(0.42, 0.42),
    color: 0x9b4d38,
    roughness: 0.78,
  });
  const frameDarkMat = std({ color: 0x2a333e, roughness: 0.44, metalness: 0.48 });

  const floorWarmOak = std({
    map: mkTileTex(M.textures.oakFloorTex, 4, 3),
    normalMap: mkTileTex(M.textures.oakFloorNormal, 4, 3),
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: mkTileTex(M.textures.roughTex, 4, 3),
    color: 0xdcc4a6,
    roughness: 0.54,
    metalness: 0.0,
    envMapIntensity: 0.24,
  });
  const floorTerrazzo = std({
    map: mkTileTex(M.textures.terrazzoTex, 4, 3),
    normalMap: mkTileTex(M.textures.terrazzoNormal, 4, 3),
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughnessMap: mkTileTex(M.textures.terrazzoRoughness, 4, 3),
    color: 0xf4f1ea,
    roughness: 0.52,
    metalness: 0.02,
    envMapIntensity: 0.3,
  });
  const floorSlate = std({
    map: mkTileTex(M.textures.slateFloorTex, 4, 3),
    normalMap: mkTileTex(M.textures.slateFloorNormal, 4, 3),
    normalScale: new THREE.Vector2(0.58, 0.58),
    roughnessMap: mkTileTex(M.textures.roughTex, 4, 3),
    color: 0x9aa4b2,
    roughness: 0.56,
    metalness: 0.05,
    envMapIntensity: 0.26,
  });
  const exteriorCobbleApronMat = std({
    map: mkTileTex(M.textures.paveTex, 6, 4),
    normalMap: mkTileTex(M.textures.paveNormal, 6, 4),
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: mkTileTex(M.textures.paveRoughness, 6, 4),
    color: 0xd0d4da,
    roughness: 0.84,
    metalness: 0.02,
    envMapIntensity: 0.24,
  });

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
          : spec.id === 'bank' || spec.id === 'realestate'
            ? bankStoneMat
            : spec.id === 'crypto'
              ? cryptoWallMat
              : spec.id === 'travel'
                ? floorTerrazzo
                : spec.id === 'tourism'
                  ? woodCedarMat
                  : spec.id === 'logistics'
                    ? logisticsWallMat
                    : medicalWallMat;

    const slabFloorMat =
      spec.id === 'restaurant' || spec.id === 'tourism' || spec.id === 'realestate'
        ? floorWarmOak
        : spec.id === 'crypto' || spec.id === 'logistics'
          ? floorSlate
          : floorTerrazzo;

    const buildingGlass =
      spec.id === 'restaurant' || spec.id === 'tourism' || spec.id === 'realestate' ? warmGlassMat : glassMat;

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

    const style = getBuildingArchStyle(spec.id);
    const dirZ = spec.doorSide === 'south' ? 1 : -1;
    const rotFacingDoor = spec.doorSide === 'south' ? 0 : Math.PI;
    let upperMonIdx = 2;

    // Build all floors (0 .. spec.floors - 1) with sculpted rounded slabs, cedar soffits & wraparound balconies
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

      // Sculpted rounded-corner floor slab (bullnose overhang on upper levels)
      if (lv === 0) {
        const slab = new THREE.Mesh(
          getRoundedSlabGeo(spec.w + 0.4, spec.d + 0.4, 2.2, SLAB_THICK, 0.05),
          slabFloorMat
        );
        slab.position.set(spec.cx, yFloor, spec.cz);
        slab.receiveShadow = true;
        lg.add(slab);
        pickMeshes.push(slab);
      } else if (style === 'tower') {
        // Sweeping rounded-corner wraparound bullnose balcony slab (Reference Image 2)
        const slab = new THREE.Mesh(
          getRoundedSlabGeo(spec.w + 2.4, spec.d + 2.4, 3.0, 0.34, 0.08),
          archMats.bullnoseConcrete
        );
        slab.position.set(spec.cx, yFloor - 0.03, spec.cz);
        slab.castShadow = true;
        slab.receiveShadow = true;
        lg.add(slab);
        pickMeshes.push(slab);

        // Warm cedar soffit ring underneath balcony overhang
        const soffit = new THREE.Mesh(
          getRoundedRibbonGeo(spec.w + 2.15, spec.d + 2.15, 2.85, 1.15, 1.15, 0.06, 0.015),
          archMats.timberSoffit
        );
        soffit.position.set(spec.cx, yFloor - 0.21, spec.cz);
        lg.add(soffit);

        // Curved-corner glass balustrade & bronze top rail
        const balGlass = new THREE.Mesh(
          getRoundedPerimeterWallGeo(spec.w + 2.0, spec.d + 2.0, 2.75, 0.92, 0.03),
          buildingGlass
        );
        balGlass.position.set(spec.cx, yFloor + 0.14, spec.cz);
        lg.add(balGlass);
        const balRail = new THREE.Mesh(
          getRoundedRibbonGeo(spec.w + 2.08, spec.d + 2.08, 2.8, 0.08, 0.08, 0.05, 0.012),
          archMats.bronzeMullion
        );
        balRail.position.set(spec.cx, yFloor + 1.07, spec.cz);
        lg.add(balRail);

        // Alternating balcony planter troughs with cascading greenery
        [-spec.w * 0.26, spec.w * 0.26].forEach((px, pi) => {
          if ((lv + pi) % 2 === 0) {
            buildPlanterTrough(
              lg,
              spec.cx + px,
              yFloor + 0.14,
              spec.cz + dirZ * (spec.d * 0.5 + 0.72),
              3.0,
              rotFacingDoor,
              lv * 17 + pi,
              archMats
            );
          }
        });
      } else if (style === 'blade') {
        // Cantilevered sculptural white rounded floor plate projecting toward doorSide + cedar soffit (Reference Image 3)
        const slab = new THREE.Mesh(
          getRoundedSlabGeo(spec.w + 1.8, spec.d + 2.0, 2.1, 0.3, 0.07),
          archMats.stuccoWhite
        );
        slab.position.set(spec.cx, yFloor - 0.02, spec.cz + dirZ * 0.42);
        slab.castShadow = true;
        slab.receiveShadow = true;
        lg.add(slab);
        pickMeshes.push(slab);

        const soffit = new THREE.Mesh(
          getRoundedRibbonGeo(spec.w + 1.55, spec.d + 1.75, 1.95, 1.05, 1.05, 0.06, 0.015),
          archMats.timberSoffit
        );
        soffit.position.set(spec.cx, yFloor - 0.18, spec.cz + dirZ * 0.42);
        lg.add(soffit);

        const balGlass = new THREE.Mesh(
          getRoundedPerimeterWallGeo(spec.w + 1.45, spec.d + 1.65, 1.85, 0.88, 0.028),
          buildingGlass
        );
        balGlass.position.set(spec.cx, yFloor + 0.12, spec.cz + dirZ * 0.42);
        lg.add(balGlass);
      } else if (style === 'stone_pergola') {
        // Deep cantilevered timber-soffit eaves + glass terrace + lush planters (Reference Image 4)
        const slab = new THREE.Mesh(
          getRoundedSlabGeo(spec.w + 2.2, spec.d + 2.2, 1.8, 0.3, 0.06),
          archMats.bullnoseConcrete
        );
        slab.position.set(spec.cx, yFloor - 0.02, spec.cz);
        slab.castShadow = true;
        slab.receiveShadow = true;
        lg.add(slab);
        pickMeshes.push(slab);

        const soffit = new THREE.Mesh(
          getRoundedRibbonGeo(spec.w + 2.0, spec.d + 2.0, 1.68, 1.1, 1.1, 0.065, 0.015),
          archMats.timberSoffit
        );
        soffit.position.set(spec.cx, yFloor - 0.18, spec.cz);
        lg.add(soffit);

        const balGlass = new THREE.Mesh(
          getRoundedPerimeterWallGeo(spec.w + 1.85, spec.d + 1.85, 1.55, 0.9, 0.028),
          buildingGlass
        );
        balGlass.position.set(spec.cx, yFloor + 0.12, spec.cz);
        lg.add(balGlass);

        if (lv % 2 === 1) {
          buildPlanterTrough(
            lg,
            spec.cx - spec.w * 0.25,
            yFloor + 0.12,
            spec.cz + dirZ * (spec.d * 0.5 + 0.65),
            3.4,
            rotFacingDoor,
            lv * 23,
            archMats
          );
          buildPlanterTrough(
            lg,
            spec.cx + spec.w * 0.25,
            yFloor + 0.12,
            spec.cz + dirZ * (spec.d * 0.5 + 0.65),
            3.4,
            rotFacingDoor,
            lv * 31,
            archMats
          );
        }
      } else {
        // 'shed_seam': Sleek rounded-corner slab wrapped by dark standing-seam ribbed architectural fascia (Reference Image 1)
        const slab = new THREE.Mesh(
          getRoundedSlabGeo(spec.w + 1.0, spec.d + 1.0, 1.4, 0.28, 0.05),
          slabFloorMat
        );
        slab.position.set(spec.cx, yFloor, spec.cz);
        slab.castShadow = true;
        slab.receiveShadow = true;
        lg.add(slab);
        pickMeshes.push(slab);

        const seamBand = new THREE.Mesh(
          getRoundedRibbonGeo(spec.w + 1.18, spec.d + 1.18, 1.5, 0.16, 0.16, 0.44, 0.02),
          archMats.standingSeam
        );
        seamBand.position.set(spec.cx, yFloor - 0.04, spec.cz);
        lg.add(seamBand);
      }

      // Ceiling slab & recessed linear lighting
      const cSlab = new THREE.Mesh(
        getRoundedSlabGeo(spec.w - 0.2, spec.d - 0.2, 1.5, 0.16, 0.02),
        M.white
      );
      cSlab.position.set(spec.cx, ceilY, spec.cz);
      cg.add(cSlab);
      pickMeshes.push(cSlab);
      const lxSpan = Math.max(4, spec.w - 8);
      [-spec.d * 0.22, spec.d * 0.22].forEach((dz) => {
        ceilingLinearLight(cg, spec.cx, ceilY - 0.08, spec.cz + dz, lxSpan, 0.26, M);
      });

      buildPerimeterWalls(lg, spec, lv, buildingGlass, wallMat, frameDarkMat, archMats, style, true, pickMeshes);

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
        // Upper floors populated cleanly with glass partition accents, desks, chairs, shelves & live monitors
        const deskXs = spec.w >= 30 ? [-10, 0, 10] : [-4.8, 4.8];
        const roleLabels = [
          `${spec.shortName} Operations Desk`,
          `${spec.shortName} Social & Comms Desk`,
          `${spec.shortName} Client Queue Desk`,
        ];
        deskXs.forEach((dx, di) => {
          const px = spec.cx + dx;
          const pz = spec.cz - spec.d * 0.12;
          makeDeskAt(lg, px, floorSurfaceY, pz, 2.4, 1.0, M);
          registerChair(lv, px, floorSurfaceY, pz + 0.85, Math.PI, di % 2 ? 1 : -1);
          registerMonitor(
            lv,
            upperMonIdx++,
            [px, floorSurfaceY + 0.77, pz - 0.15],
            0,
            px,
            pz + 0.85,
            `${roleLabels[di % roleLabels.length]} · L${lv}`,
            `Level ${lv} Operations`
          );
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
    const fy = spec.groundY + SLAB_THICK * 0.5;

    // Illuminated Entrance Fascia Sign (mounted cleanly on outer face of canopy / balcony rim)
    const signOutset =
      spec.id === 'travel'
        ? 3.56
        : style === 'tower'
          ? 1.32
          : style === 'blade'
            ? 1.48
            : style === 'stone_pergola'
              ? 3.56
              : 3.46;
    const signZ = spec.cz + dirZ * (spec.d * 0.5 + signOutset);
    const signY =
      spec.id === 'travel'
        ? spec.groundY + spec.floorH + 0.58
        : style === 'shed_seam'
          ? spec.groundY + spec.floorH + 0.16
          : style === 'stone_pergola'
            ? spec.groundY + spec.floorH + 0.34
            : spec.groundY + spec.floorH + 0.24;
    const signW = Math.min(10.8, spec.w * 0.54);
    const signBox = boxAt(g0, signW, 1.24, 0.18, spec.doorX, signY, signZ, frameDarkMat, true, false, 0.04);
    const signTex = makeSignTexture(spec.name, spec.niche, spec.accent);
    const signFace = new THREE.Mesh(
      new THREE.PlaneGeometry(signW - 0.16, 1.08),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    signFace.position.set(spec.doorX, signY, signZ + dirZ * 0.1);
    signFace.rotation.y = rotFacingDoor;
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
      registerMonitor(0, 1, [spec.cx - 0.5, fy + 1.1, spec.cz - 6.85], Math.PI, spec.cx - 0.5, spec.cz - 8.1, 'Head Chef KDS', 'Open Wood-Fired Kitchen');

      // Animated Kitchen Menu / KDS wall board mounted inside on rear wall (clear of exhaust hood)
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
      boxAt(g0, 5.8, 2.15, 0.14, spec.cx + 5.8, fy + 2.25, spec.cz - 8.7, frameDarkMat, false, false);
      const kdsMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.92), kdsScreen.mat);
      kdsMesh.position.set(spec.cx + 5.8, fy + 2.25, spec.cz - 8.62);
      g0.add(kdsMesh);
      kdsScreen.setMesh(kdsMesh);

      // Exterior vine-draped timber pergola porte-cochère on ashlar stone piers + 2 outdoor bistro tables (Reference Image 4)
      buildVinePergolaCanopy(
        g0,
        spec.doorX,
        spec.groundY,
        spec.doorZ + 1.75,
        spec.w - 1.6,
        3.5,
        spec.floorH - 0.36,
        [-4.6, 4.6],
        410,
        archMats
      );
      buildTropicalPalm(g0, spec.cx - spec.w * 0.44, spec.groundY, spec.doorZ + 2.8, 3.8, 412, M, archMats);
      makeDiningTable(g0, spec.cx - 5.2, spec.groundY, spec.cz + 12.1, M, 0.56);
      makeDiningTable(g0, spec.cx + 5.2, spec.groundY, spec.cz + 12.1, M, 0.56);
    } else if (spec.id === 'dealership') {
      // Cantilevered forecourt showroom canopy with cedar soffit (Reference Image 1)
      const foreCanopy = new THREE.Mesh(
        getRoundedSlabGeo(12.8, 3.4, 0.65, 0.34, 0.05),
        archMats.stuccoWhite
      );
      foreCanopy.position.set(spec.doorX, spec.groundY + spec.floorH - 0.18, spec.doorZ + 1.75);
      foreCanopy.castShadow = true;
      g0.add(foreCanopy);
      const foreSoffit = new THREE.Mesh(
        getRoundedSlabGeo(12.2, 2.9, 0.5, 0.07, 0.015),
        archMats.timberSoffit
      );
      foreSoffit.position.set(spec.doorX, spec.groundY + spec.floorH - 0.34, spec.doorZ + 1.75);
      g0.add(foreSoffit);
      [-5.2, 5.2].forEach((px) => {
        cylAt(g0, 0.16, 0.18, spec.floorH - 0.3, spec.doorX + px, spec.groundY + (spec.floorH - 0.3) * 0.5, spec.doorZ + 2.9, archMats.bronzeMullion, true, true, 14);
      });
      buildTropicalPalm(g0, spec.cx - spec.w * 0.45, spec.groundY, spec.doorZ + 2.5, 3.9, 515, M, archMats);

      // Apex Motors Showroom: Rotating center car turntable + 2 flanking display vehicles + sales desks
      const turnGrp = new THREE.Group();
      turnGrp.position.set(spec.cx, fy, spec.cz + 0.4);
      g0.add(turnGrp);
      cylAt(turnGrp, 3.15, 3.25, 0.16, 0, 0.08, 0, M.dark, true, true, 32);
      cylAt(turnGrp, 3.2, 3.2, 0.03, 0, 0.165, 0, accentMat, false, false, 32);
      const heroCar = makeCar(0x9e1b24, 'suv', { showroom: true, plateText: 'APEX GT' });
      heroCar.position.set(0, 0.17, 0);
      turnGrp.add(heroCar);
      rotatingProps.push({ obj: turnGrp, speed: 0.28, axis: 'y' });

      const carLeft = makeCar(0x1f3d6e, 'sedan', { showroom: true, plateText: 'APEX EV' });
      carLeft.position.set(spec.cx - 6.0, fy, spec.cz + 2.0);
      carLeft.rotation.y = 0.42;
      g0.add(carLeft);

      const carRight = makeCar(0xcfd6de, 'hatch', { showroom: true, plateText: 'APEX E4' });
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
      boxAt(g0, 5.8, 2.2, 0.14, spec.cx, fy + 2.3, spec.cz - 8.7, frameDarkMat, false, false);
      const cbMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.95), carBoard.mat);
      cbMesh.position.set(spec.cx, fy + 2.3, spec.cz - 8.62);
      g0.add(cbMesh);
      carBoard.setMesh(cbMesh);
    } else if (spec.id === 'bank') {
      // Sculpted rounded bullnose portico canopy over existing portico piers (preserving obstacles.ts column positions)
      [-3.8, -1.9, 1.9, 3.8].forEach((ox) => {
        cylAt(g0, 0.32, 0.36, spec.floorH - 0.12, spec.doorX + ox, spec.groundY + spec.floorH * 0.5, spec.doorZ + 1.4, archMats.stuccoWhite, true, true, 18);
      });
      const bankPortico = new THREE.Mesh(
        getRoundedSlabGeo(9.8, 2.8, 0.9, 0.36, 0.07),
        archMats.bullnoseConcrete
      );
      bankPortico.position.set(spec.doorX, spec.groundY + spec.floorH - 0.06, spec.doorZ + 1.0);
      bankPortico.castShadow = true;
      g0.add(bankPortico);
      const bankSoffit = new THREE.Mesh(
        getRoundedSlabGeo(9.2, 2.4, 0.75, 0.06, 0.015),
        archMats.timberSoffit
      );
      bankSoffit.position.set(spec.doorX, spec.groundY + spec.floorH - 0.24, spec.doorZ + 1.0);
      g0.add(bankSoffit);

      // 3 ATM Vestibule kiosks on front-west interior
      [-8.5, -6.5, -4.5].forEach((ox) => {
        makeAtmKiosk(g0, spec.cx + ox, fy, spec.cz + 6.2, Math.PI, M);
      });

      // Bi-level Teller Hall Counter: customer transaction ledge (1.14m) + rear staff work desk (0.78m)
      boxAt(g0, 9.2, 1.1, 0.54, spec.cx - 2.4, fy + 0.55, spec.cz - 3.24, bankStoneMat, true, true, 0.03);
      boxAt(g0, 9.4, 0.08, 0.64, spec.cx - 2.4, fy + 1.14, spec.cz - 3.24, M.walnut, false, true, 0.02);
      boxAt(g0, 8.8, 0.72, 0.05, spec.cx - 2.4, fy + 1.54, spec.cz - 2.98, glassMat, false, false);
      boxAt(g0, 9.2, 0.06, 0.94, spec.cx - 2.4, fy + 0.75, spec.cz - 3.98, M.walnut, true, true, 0.015);
      [-6.8, -2.4, 2.0].forEach((lx) => {
        boxAt(g0, 0.14, 0.72, 0.78, spec.cx + lx, fy + 0.36, spec.cz - 3.92, bankStoneMat, true, true, 0.01);
      });
      [-4.6, -0.2].forEach((ox, i) => {
        registerChair(0, spec.cx + ox, fy, spec.cz - 4.75, 0, i === 0 ? 1 : -1);
        registerMonitor(
          0,
          i,
          [spec.cx + ox, fy + 0.78, spec.cz - 4.02],
          Math.PI,
          spec.cx + ox,
          spec.cz - 4.75,
          `Branch Teller ${i + 1}`,
          'Retail Banking & RTGS Hall'
        );
      });

      // Heavy circular brushed-steel Bank Vault Door mounted inside on rear wall
      const vx = spec.cx + 6.2;
      const vz = spec.cz - 9.5;
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
      boxAt(g0, 5.8, 2.2, 0.14, spec.cx - 3.6, fy + 2.35, spec.cz - 9.7, frameDarkMat, false, false);
      const fxMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.95), fxBoard.mat);
      fxMesh.position.set(spec.cx - 3.6, fy + 2.35, spec.cz - 9.62);
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
      boxAt(g0, 16.4, 1.24, 0.22, spec.cx, spec.groundY + spec.floorH * 2 + 0.12, spec.cz + spec.d * 0.5 + 1.28, frameDarkMat, true, false, 0.04);
      [-5.8, 5.8].forEach((bx) => {
        boxAt(g0, 0.22, 0.26, 0.65, spec.cx + bx, spec.groundY + spec.floorH * 2 + 0.04, spec.cz + spec.d * 0.5 + 0.98, archMats.bronzeMullion, true, false);
      });
      const tkMesh = new THREE.Mesh(new THREE.PlaneGeometry(16.0, 1.06), ticker.mat);
      tkMesh.position.set(spec.cx, spec.groundY + spec.floorH * 2 + 0.12, spec.cz + spec.d * 0.5 + 1.4);
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
      boxAt(g0, 6.2, 2.3, 0.14, spec.cx, fy + 2.3, spec.cz - 9.7, frameDarkMat, false, false);
      const obMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 2.05), obBoard.mat);
      obMesh.position.set(spec.cx, fy + 2.3, spec.cz - 9.62);
      g0.add(obMesh);
      obBoard.setMesh(obMesh);
    } else if (spec.id === 'travel') {
      // Sculpted sloped cantilevered aviation wing canopy with cedar soffit (facing north street)
      const travelCanopy = new THREE.Mesh(
        getSlopedRoofBladeGeo(15.2, 3.8, 0.12, 0.34, 0.56, 0.78, 0.04),
        archMats.stuccoWhite
      );
      travelCanopy.position.set(spec.doorX, spec.groundY + spec.floorH - 0.1, spec.doorZ - 1.6);
      travelCanopy.rotation.y = Math.PI;
      travelCanopy.castShadow = true;
      g0.add(travelCanopy);
      const travelSoffit = new THREE.Mesh(
        getSlopedRoofBladeGeo(14.6, 3.4, 0.06, 0.12, 0.5, 0.56, 0.015),
        archMats.timberSoffit
      );
      travelSoffit.position.set(spec.doorX, spec.groundY + spec.floorH - 0.1, spec.doorZ - 1.55);
      travelSoffit.rotation.y = Math.PI;
      g0.add(travelSoffit);
      [-5.8, 5.8].forEach((px) => {
        cylAt(g0, 0.15, 0.17, spec.floorH + 0.42, spec.doorX + px, spec.groundY + (spec.floorH + 0.42) * 0.5, spec.doorZ - 2.95, archMats.bronzeMullion, true, true, 14);
      });

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

      // Bi-level Check-In Counter: customer luggage ledge (1.06m) + rear agent desk (0.78m)
      boxAt(g0, 8.6, 1.04, 0.52, spec.cx - 6.8, fy + 0.52, spec.cz + 2.86, M.white, true, true, 0.04);
      boxAt(g0, 8.8, 0.07, 0.6, spec.cx - 6.8, fy + 1.06, spec.cz + 2.86, accentMat, false, false);
      boxAt(g0, 8.6, 0.06, 0.94, spec.cx - 6.8, fy + 0.75, spec.cz + 3.59, M.walnut, true, true, 0.02);
      [-10.9, -6.8, -2.7].forEach((lx) => {
        boxAt(g0, 0.14, 0.72, 0.78, spec.cx + lx, fy + 0.36, spec.cz + 3.54, M.white, true, true, 0.01);
      });
      [-9.0, -4.6].forEach((ox, i) => {
        registerChair(0, spec.cx + ox, fy, spec.cz + 4.35, Math.PI, i === 0 ? 1 : -1);
        registerMonitor(
          0,
          i,
          [spec.cx + ox, fy + 0.78, spec.cz + 3.63],
          0,
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
      boxAt(g0, 7.6, 2.4, 0.14, spec.cx, fy + 2.35, spec.cz + 8.7, frameDarkMat, false, false);
      const flMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.3, 2.15), flBoard.mat);
      flMesh.position.set(spec.cx, fy + 2.35, spec.cz + 8.62);
      flMesh.rotation.y = Math.PI;
      g0.add(flMesh);
      flBoard.setMesh(flMesh);
    } else if (spec.id === 'tourism') {
      // Vine-draped cedar pergola entrance porte-cochère on ashlar stone piers (facing north street)
      const tourPergola = new THREE.Group();
      buildVinePergolaCanopy(
        tourPergola,
        0,
        0,
        0,
        14.0,
        3.4,
        spec.floorH - 0.32,
        [-4.8, 4.8],
        615,
        archMats
      );
      tourPergola.position.set(spec.doorX, spec.groundY, spec.doorZ - 1.7);
      tourPergola.rotation.y = Math.PI;
      g0.add(tourPergola);
      buildTropicalPalm(g0, spec.cx + spec.w * 0.44, spec.groundY, spec.doorZ - 2.6, 3.9, 620, M, archMats);

      // 3D Topographical Kenya / Mt. Kenya & Mara Relief Map Table
      const mapX = spec.cx - 5.8;
      const mapZ = spec.cz - 0.8;
      boxAt(g0, 4.4, 0.78, 2.8, mapX, fy + 0.39, mapZ, M.walnut, true, true, 0.04);
      boxAt(g0, 4.0, 0.08, 2.4, mapX, fy + 0.8, mapZ, std({ color: 0x3b6e3c, roughness: 0.85 }), false, true);
      // Terrain elevation tiers & snow-capped Mt. Kenya peak
      boxAt(g0, 1.5, 0.16, 1.1, mapX - 0.6, fy + 0.88, mapZ - 0.3, std({ color: 0x628c45, roughness: 0.88 }), false, false, 0.04);
      cylAt(g0, 0.12, 0.65, 0.42, mapX + 0.4, fy + 1.01, mapZ + 0.15, std({ color: 0x736857, roughness: 0.9 }), true, false, 7);
      cylAt(g0, 0.01, 0.22, 0.16, mapX + 0.4, fy + 1.24, mapZ + 0.15, M.white, false, false, 7);

      // Indoor Expedition 4x4 Safari SUV with full expedition rack, bullbar, snorkel & spare wheel
      const jeep = makeCar(0x4b5c34, 'suv', { safari: true, plateText: 'SAFARI 4X4' });
      jeep.position.set(spec.cx + 7.2, fy + 0.1, spec.cz - 1.0);
      jeep.rotation.y = -0.55;
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
          0,
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
      boxAt(g0, 7.2, 2.3, 0.14, spec.cx, fy + 2.35, spec.cz + 8.7, frameDarkMat, false, false);
      const sfMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.9, 2.05), sfBoard.mat);
      sfMesh.position.set(spec.cx, fy + 2.35, spec.cz + 8.62);
      sfMesh.rotation.y = Math.PI;
      g0.add(sfMesh);
      sfBoard.setMesh(sfMesh);
    } else if (spec.id === 'medical') {
      // VitalCare Medical & Pharmacy: Rotating 3D emerald cross beacon elevated cleanly on cantilevered sloped roof blade
      const crossBeacon = new THREE.Group();
      crossBeacon.position.set(spec.doorX, spec.groundY + spec.h + 4.45, spec.doorZ + 0.9);
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

      // Central Bi-level Patient Triage Counter: patient ledge (1.06m) + rear staff desk (0.78m)
      boxAt(g0, 4.6, 1.04, 0.5, spec.cx, fy + 0.52, spec.cz - 0.9, M.white, true, true, 0.03);
      boxAt(g0, 4.72, 0.06, 0.58, spec.cx, fy + 1.06, spec.cz - 0.9, accentMat, false, false, 0.02);
      boxAt(g0, 4.6, 0.06, 0.88, spec.cx, fy + 0.75, spec.cz - 1.59, M.walnut, true, true, 0.02);
      [-2.15, 2.15].forEach((lx) => {
        boxAt(g0, 0.14, 0.72, 0.76, spec.cx + lx, fy + 0.36, spec.cz - 1.54, M.white, true, true, 0.01);
      });
      registerChair(0, spec.cx, fy, spec.cz - 2.3, 0, 1);
      registerMonitor(0, 0, [spec.cx, fy + 0.78, spec.cz - 1.58], Math.PI, spec.cx, spec.cz - 2.3, 'Lead Pharmacist & Triage', '24h Pharmacy & Patient Intake');

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
      boxAt(g0, 7.6, 2.3, 0.14, spec.cx + 1.5, fy + 2.35, spec.cz - 7.7, frameDarkMat, false, false);
      const medMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.3, 2.05), medBoard.mat);
      medMesh.position.set(spec.cx + 1.5, fy + 2.35, spec.cz - 7.62);
      g0.add(medMesh);
      medBoard.setMesh(medMesh);
    } else if (spec.id === 'logistics') {
      // SwiftPort Cargo & Logistics: Rooftop radar mast elevated cleanly above asymmetric shed roof peak
      const radarMast = new THREE.Group();
      radarMast.position.set(spec.cx + 5.8, spec.groundY + spec.h + 2.95, spec.cz);
      cylAt(radarMast, 0.14, 0.22, 1.5, 0, 0.75, 0, frameDarkMat, true, false, 12);
      const radarSweep = new THREE.Group();
      radarSweep.position.set(0, 1.65, 0);
      boxAt(radarSweep, 1.85, 0.26, 0.24, 0, 0, 0, accentMat, true, false, 0.04);
      radarMast.add(radarSweep);
      roofShellGroup.add(radarMast);
      rotatingProps.push({ obj: radarSweep, speed: 1.4, axis: 'y' });

      // North cantilevered forecourt dispatch canopy with cedar timber soffit (Reference Image 1)
      const logCanopy = new THREE.Mesh(
        getRoundedSlabGeo(13.2, 3.4, 0.65, 0.34, 0.05),
        archMats.stuccoWhite
      );
      logCanopy.position.set(spec.doorX, spec.groundY + spec.floorH - 0.16, spec.doorZ - 1.65);
      logCanopy.castShadow = true;
      g0.add(logCanopy);
      const logSoffit = new THREE.Mesh(
        getRoundedSlabGeo(12.6, 2.9, 0.5, 0.07, 0.015),
        archMats.timberSoffit
      );
      logSoffit.position.set(spec.doorX, spec.groundY + spec.floorH - 0.32, spec.doorZ - 1.65);
      g0.add(logSoffit);
      [-5.2, 5.2].forEach((px) => {
        cylAt(g0, 0.16, 0.18, spec.floorH - 0.3, spec.doorX + px, spec.groundY + (spec.floorH - 0.3) * 0.5, spec.doorZ - 2.8, archMats.bronzeMullion, true, true, 14);
      });

      // Exterior East Loading Dock Roll-Up Bays (facing Freight Yard at x = 70..77)
      const dockX = spec.cx + spec.w * 0.5 + 0.06;
      const cartonMat = std({ color: 0xb9854c, roughness: 0.85 });
      const palletMat = std({ color: 0x7c5530, roughness: 0.88 });
      const steelShutterMat = std({ color: 0x64748b, roughness: 0.48, metalness: 0.42 });
      [-3.5, 3.5].forEach((dz) => {
        const bayZ = spec.cz + dz;
        // Overhang awning above loading dock bay
        boxAt(g0, 2.0, 0.18, 4.4, dockX + 0.9, fy + 3.45, bayZ, frameDarkMat, true, false, 0.04);
        boxAt(g0, 0.14, 0.12, 4.4, dockX + 1.9, fy + 3.45, bayZ, accentMat, false, false);
        // Roll-up steel shutter door
        boxAt(g0, 0.18, 2.9, 3.6, dockX, fy + 1.45, bayZ, steelShutterMat, true, true, 0.02);
        for (let rib = 0; rib < 6; rib++) {
          boxAt(g0, 0.22, 0.05, 3.45, dockX + 0.02, fy + 0.35 + rib * 0.46, bayZ, frameDarkMat, false, false);
        }
        // Yellow/orange dock safety bollards flanking each bay
        [-2.05, 2.05].forEach((bz) => {
          cylAt(g0, 0.11, 0.12, 0.95, dockX + 0.42, spec.groundY + 0.475, bayZ + bz, accentMat, true, true, 10);
        });
        // Interior staging pallets beside east loading bays
        boxAt(g0, 1.5, 0.14, 1.6, spec.cx + 12.6, fy + 0.07, bayZ, palletMat, true, true, 0.01);
        boxAt(g0, 1.1, 0.72, 1.2, spec.cx + 12.6, fy + 0.5, bayZ, cartonMat, true, true, 0.02);
      });

      // Automated Parcel Sorting Conveyor Belt (running N-S at cx - 4.2)
      const convX = spec.cx - 4.2;
      const convZ = spec.cz + 1.2;
      boxAt(g0, 1.45, 0.14, 9.6, convX, fy + 0.78, convZ, frameDarkMat, true, true, 0.02);
      boxAt(g0, 1.18, 0.05, 9.45, convX, fy + 0.87, convZ, M.dark, false, false);
      for (let zOff = -4.2; zOff <= 4.2; zOff += 2.1) {
        boxAt(g0, 1.24, 0.72, 0.1, convX, fy + 0.36, convZ + zOff, M.metal, true, false);
      }
      // Laser barcode scanner gate arch over conveyor
      boxAt(g0, 1.65, 0.95, 0.45, convX, fy + 1.32, convZ - 0.6, frameDarkMat, true, false, 0.02);
      boxAt(g0, 1.35, 0.08, 0.12, convX, fy + 1.55, convZ - 0.6, accentMat, false, false);
      // Parcels along belt
      [-3.4, -1.7, 0.6, 2.4, 3.8].forEach((pz, pi) => {
        const bw = 0.52 + (pi % 2) * 0.14;
        const bh = 0.34 + (pi % 3) * 0.08;
        boxAt(g0, bw, bh, 0.54, convX + ((pi % 2) - 0.5) * 0.18, fy + 0.9 + bh * 0.5, convZ + pz, pi === 2 ? accentMat : cartonMat, true, true, 0.015);
      });

      // Heavy Pallet Storage Racks along West Warehouse Wing
      [-3.0, 3.2].forEach((rz) => {
        const rx = spec.cx - 12.2;
        const rCz = spec.cz + rz;
        // 4 upright steel posts
        [-1.3, 1.3].forEach((ox) => {
          [-1.8, 1.8].forEach((oz) => {
            boxAt(g0, 0.1, 2.8, 0.1, rx + ox, fy + 1.4, rCz + oz, accentMat, true, false);
          });
        });
        [0.45, 1.55, 2.65].forEach((ry, li) => {
          boxAt(g0, 2.7, 0.08, 3.7, rx, fy + ry, rCz, frameDarkMat, true, true);
          if (li < 2) {
            boxAt(g0, 1.9, 0.65, 1.2, rx, fy + ry + 0.36, rCz - 0.85, cartonMat, true, true, 0.02);
            boxAt(g0, 1.9, 0.65, 1.2, rx, fy + ry + 0.36, rCz + 0.85, palletMat, true, true, 0.02);
          }
        });
      });

      // Bi-level Waybill Dispatch & Customs Counter: customer ledge (1.06m) + rear dispatch desk (0.78m)
      const deskZ = spec.cz + 2.5;
      boxAt(g0, 6.4, 1.04, 0.52, spec.cx + 5.8, fy + 0.52, deskZ - 0.34, frameDarkMat, true, true, 0.03);
      boxAt(g0, 6.6, 0.08, 0.6, spec.cx + 5.8, fy + 1.06, deskZ - 0.34, accentMat, false, false);
      boxAt(g0, 6.4, 0.06, 0.94, spec.cx + 5.8, fy + 0.75, deskZ + 0.39, M.walnut, true, true, 0.015);
      [2.7, 5.8, 8.9].forEach((lx) => {
        boxAt(g0, 0.14, 0.72, 0.78, spec.cx + lx, fy + 0.36, deskZ + 0.34, frameDarkMat, true, true, 0.01);
      });
      [3.8, 7.8].forEach((ox, i) => {
        const sx = spec.cx + ox;
        const sz = deskZ + 1.15;
        registerChair(0, sx, fy, sz, Math.PI, i === 0 ? 1 : -1);
        registerMonitor(
          0,
          i,
          [sx, fy + 0.78, deskZ + 0.43],
          0,
          sx,
          sz,
          i === 0 ? 'Freight Dispatch Manager' : 'Customs & Waybill Officer',
          'Dispatch & Waybill Control'
        );
      });

      // Live SwiftPort GPS Fleet & Freight Telemetry Board (facing north door -Z)
      const logBoard = createCustomBoardScreen(screenReg, 720, 230, (g, w, h, t) => {
        g.fillStyle = '#0d1117';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#f97316';
        g.fillRect(0, 0, w, 34);
        g.fillStyle = '#0d1117';
        g.font = '800 18px "Plus Jakarta Sans", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('SWIFTPORT CARGO & LOGISTICS · FLEET CORRIDOR & DOCK TELEMETRY', 16, 17);
        const loads = [
          ['SWP-9041', 'JKIA → Westlands', 'Dock A · Van 04', 'LOADING'],
          ['SWP-9042', 'Mombasa → Nairobi', 'Dock B · Van 02', 'CLEARED'],
          ['SWP-9043', 'Kigali Airfreight', 'Express Bay 03', 'EN ROUTE'],
          ['BELT-01', 'Automated Sortation', '420 parcels/hr', 'NOMINAL'],
        ];
        loads.forEach((l, i) => {
          const y = 52 + i * 42;
          g.fillStyle = i === Math.floor(t / 2.6) % 4 ? 'rgba(249,115,22,0.22)' : 'rgba(255,255,255,0.06)';
          rr(g, 14, y, w - 28, 36, 5);
          g.fill();
          g.fillStyle = '#fdba74';
          g.font = '700 15px monospace';
          g.fillText(l[0], 26, y + 18);
          g.fillStyle = '#f8fafc';
          g.font = '700 15px sans-serif';
          g.fillText(l[1], 145, y + 18);
          g.fillStyle = '#94a3b8';
          g.font = '600 14px sans-serif';
          g.fillText(l[2], 365, y + 18);
          g.fillStyle = i === 0 ? '#facc15' : '#4ade80';
          g.textAlign = 'right';
          g.font = '700 15px monospace';
          g.fillText(l[3], w - 26, y + 18);
          g.textAlign = 'left';
        });
      });
      boxAt(g0, 7.8, 2.35, 0.14, spec.cx + 1.5, fy + 2.35, spec.cz + 9.7, frameDarkMat, false, false);
      const logMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 2.1), logBoard.mat);
      logMesh.position.set(spec.cx + 1.5, fy + 2.35, spec.cz + 9.62);
      logMesh.rotation.y = Math.PI;
      g0.add(logMesh);
      logBoard.setMesh(logMesh);
    } else if (spec.id === 'realestate') {
      // TerraCraft Estates, Build & Interiors:
      // 1. North Cantilevered Architectural Portico & Cedar Soffit Canopy
      const reCanopy = new THREE.Mesh(
        getRoundedSlabGeo(12.8, 3.3, 0.7, 0.32, 0.05),
        archMats.stuccoWhite
      );
      reCanopy.position.set(spec.doorX, spec.groundY + spec.floorH - 0.15, spec.doorZ - 1.6);
      reCanopy.castShadow = true;
      g0.add(reCanopy);
      const reSoffit = new THREE.Mesh(
        getRoundedSlabGeo(12.2, 2.8, 0.55, 0.07, 0.015),
        archMats.timberSoffit
      );
      reSoffit.position.set(spec.doorX, spec.groundY + spec.floorH - 0.31, spec.doorZ - 1.6);
      g0.add(reSoffit);
      [-5.1, 5.1].forEach((px) => {
        cylAt(g0, 0.16, 0.18, spec.floorH - 0.3, spec.doorX + px, spec.groundY + (spec.floorH - 0.3) * 0.5, spec.doorZ - 2.7, archMats.ashlarStone, true, true, 14);
      });

      // 2. Rooftop Architectural Tower Crane (signals Construction & Development across the skyline)
      const craneYellow = std({ color: 0xf59e0b, roughness: 0.42, metalness: 0.28 });
      const craneSteel = std({ color: 0x334155, roughness: 0.46, metalness: 0.52 });
      const craneBaseX = spec.cx - spec.w * 0.24;
      const craneBaseZ = spec.cz - spec.d * 0.14;
      const roofBaseY = spec.groundY + spec.h + 0.18;
      boxAt(roofShellGroup, 1.9, 0.32, 1.9, craneBaseX, roofBaseY + 0.16, craneBaseZ, craneSteel, true, true, 0.03);
      // Mast lattice shaft
      boxAt(roofShellGroup, 0.72, 4.8, 0.72, craneBaseX, roofBaseY + 2.55, craneBaseZ, craneYellow, true, false, 0.02);
      const craneTop = new THREE.Group();
      craneTop.position.set(craneBaseX, roofBaseY + 5.05, craneBaseZ);
      // Operator cab + counter-jib + main slewing jib + trolley hook
      boxAt(craneTop, 0.85, 0.85, 0.95, 0.48, 0.25, 0.3, frameDarkMat, true, false, 0.03);
      boxAt(craneTop, 9.2, 0.36, 0.44, 2.2, 0.75, 0, craneYellow, true, false, 0.02);
      boxAt(craneTop, 1.25, 0.72, 0.82, -2.0, 0.75, 0, craneSteel, true, false, 0.03); // counterweight
      cylAt(craneTop, 0.04, 0.24, 1.05, 0, 1.38, 0, craneYellow, true, false, 4); // A-frame apex
      cylAt(craneTop, 0.025, 0.025, 1.4, 5.8, 0.0, 0, craneSteel, false, false, 8); // hoist cable
      boxAt(craneTop, 0.36, 0.22, 0.36, 5.8, -0.75, 0, accentMat, true, false, 0.02); // hook block
      roofShellGroup.add(craneTop);
      rotatingProps.push({ obj: craneTop, speed: 0.18, axis: 'y' });

      // 3. Outdoor West Construction & Material Staging Yard (x = cx - 16.2, grounded at spec.groundY)
      const yardX = spec.cx - 16.2;
      const yardMat = std({ color: 0x949aa1, roughness: 0.88 });
      const timberYardMat = std({ color: 0xb67b44, roughness: 0.72 });
      const coneMat = std({ color: 0xf97316, roughness: 0.45 });
      boxAt(g0, 3.4, 0.08, 7.2, yardX, spec.groundY + 0.04, spec.cz, yardMat, false, true, 0.02);
      // Timber beams stack
      for (let ti = 0; ti < 3; ti++) {
        boxAt(g0, 1.8, 0.18, 2.6, yardX - 0.3, spec.groundY + 0.17 + ti * 0.2, spec.cz - 1.8, timberYardMat, true, true, 0.015);
      }
      // Dressed stone block pallet + steel beams
      boxAt(g0, 1.6, 0.12, 1.8, yardX + 0.2, spec.groundY + 0.14, spec.cz + 1.4, woodCedarMat, true, true, 0.01);
      boxAt(g0, 1.25, 0.62, 1.35, yardX + 0.2, spec.groundY + 0.51, spec.cz + 1.4, bankStoneMat, true, true, 0.02);
      boxAt(g0, 0.45, 0.18, 3.2, yardX - 0.85, spec.groundY + 0.18, spec.cz + 1.5, craneSteel, true, true, 0.01);
      // Safety cones framing yard
      [spec.cz - 3.3, spec.cz + 3.3].forEach((czCone) => {
        cylAt(g0, 0.05, 0.22, 0.56, yardX + 1.4, spec.groundY + 0.28, czCone, coneMat, true, true, 12);
      });

      // 4. INTERIOR WEST WING: Real Estate 3D Masterplan Scale-Model Table & Broker Desk
      const modX = spec.cx - 6.8;
      const modZ = spec.cz - 0.8;
      boxAt(g0, 4.3, 0.78, 2.7, modX, fy + 0.39, modZ, M.walnut, true, true, 0.04);
      boxAt(g0, 4.0, 0.06, 2.4, modX, fy + 0.81, modZ, std({ color: 0x4b7447, roughness: 0.85 }), false, true);
      // Miniature architectural towers, pitched villas & turquoise pool on scale-model table
      boxAt(g0, 0.75, 1.15, 0.65, modX - 1.1, fy + 1.41, modZ - 0.35, M.white, true, false, 0.02);
      boxAt(g0, 0.62, 0.82, 0.62, modX - 0.15, fy + 1.25, modZ - 0.45, accentMat, true, false, 0.02);
      boxAt(g0, 0.85, 0.48, 0.7, modX + 0.95, fy + 1.08, modZ + 0.25, M.white, true, false, 0.02);
      boxAt(g0, 0.78, 0.04, 0.55, modX - 0.2, fy + 0.86, modZ + 0.55, std({ color: 0x38bdf8, roughness: 0.2, emissive: 0x0284c7, emissiveIntensity: 0.3 }), false, false);

      // Real Estate Broker Desk
      makeDeskAt(g0, spec.cx - 6.8, fy, spec.cz + 5.2, 2.5, 1.05, M);
      registerChair(0, spec.cx - 6.8, fy, spec.cz + 6.08, Math.PI, 1);
      registerMonitor(
        0,
        0,
        [spec.cx - 6.8, fy + 0.77, spec.cz + 5.05],
        0,
        spec.cx - 6.8,
        spec.cz + 6.08,
        'Senior Property Broker',
        'Real Estate Masterplan Gallery'
      );

      // 5. INTERIOR CENTER: Bi-Level Reception Desk & Client Lounge
      boxAt(g0, 4.8, 1.04, 0.52, spec.cx + 0.2, fy + 0.52, spec.cz + 2.86, bankStoneMat, true, true, 0.04);
      boxAt(g0, 4.95, 0.07, 0.6, spec.cx + 0.2, fy + 1.06, spec.cz + 2.86, accentMat, false, false);
      boxAt(g0, 4.8, 0.06, 0.88, spec.cx + 0.2, fy + 0.75, spec.cz + 3.55, M.walnut, true, true, 0.02);
      [-1.4, 1.8].forEach((ox) => {
        armchair(g0, spec.cx + ox, fy, spec.cz - 2.6, 0, M.fabricCognac, M);
      });

      // 6. INTERIOR EAST WING: Construction Engineering Desk + Interior Design Material Library
      makeDeskAt(g0, spec.cx + 7.4, fy, spec.cz + 5.2, 2.5, 1.05, M);
      registerChair(0, spec.cx + 7.4, fy, spec.cz + 6.08, Math.PI, -1);
      registerMonitor(
        0,
        1,
        [spec.cx + 7.4, fy + 0.77, spec.cz + 5.05],
        0,
        spec.cx + 7.4,
        spec.cz + 6.08,
        'Lead Structural Engineer',
        'Construction CAD & Interior Atelier'
      );
      // Yellow hard-hat & rolled blueprint tubes on Construction Desk
      cylAt(g0, 0.12, 0.18, 0.14, spec.cx + 8.15, fy + 0.84, spec.cz + 5.2, craneYellow, true, false, 12);
      boxAt(g0, 0.62, 0.07, 0.07, spec.cx + 6.5, fy + 0.8, spec.cz + 5.3, M.white, false, false);

      // Interior Design Material Library Rack & Designer Showcase Vignette
      shelfUnit(g0, spec.cx + 7.4, fy, spec.cz - 5.2, 3.6, M);
      const swatchCols = [0xe07a5f, 0xd4a373, 0x3d5a80, 0x81b29a, 0xf2cc8f, 0x6b7280];
      swatchCols.forEach((sc, si) => {
        boxAt(
          g0,
          0.42,
          0.46,
          0.12,
          spec.cx + 6.1 + si * 0.52,
          fy + 1.48,
          spec.cz - 5.08,
          std({ color: sc, roughness: 0.55 }),
          false,
          false
        );
      });
      sofaWide(g0, spec.cx + 7.4, fy, spec.cz - 1.6, Math.PI, M.fabricCognac, M);
      boxAt(g0, 1.6, 0.38, 0.85, spec.cx + 7.4, fy + 0.19, spec.cz - 0.3, M.walnut, true, true, 0.03);

      // 7. Live 3-in-1 Real Estate, Construction & Interiors Telemetry Wall Board
      const reBoard = createCustomBoardScreen(screenReg, 720, 230, (g, w, h, t) => {
        g.fillStyle = '#12100e';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#e07a5f';
        g.fillRect(0, 0, w, 34);
        g.fillStyle = '#12100e';
        g.font = '800 17px "Plus Jakarta Sans", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('TERRACRAFT · REAL ESTATE, CONSTRUCTION & INTERIOR DESIGN', 16, 17);
        const rows = [
          ['ESTATES', 'Karen Ridge Villa 04', 'KES 82.0M · Title Ready', 'UNDER OFFER'],
          ['CONSTRUCTION', 'Upper Hill Lofts B2', 'Slab & MEP Rough-In', '84% ON SPEC'],
          ['INTERIORS', 'Hub Exec Suite Refit', 'Travertine & Smoked Oak', 'INSTALLING'],
          ['TURNKEY 3-IN-1', 'Kilimani Sky Duplex', 'Full Build + Styling', 'HANDOVER'],
        ];
        rows.forEach((r, i) => {
          const y = 52 + i * 42;
          g.fillStyle = i === Math.floor(t / 2.8) % 4 ? 'rgba(224,122,95,0.22)' : 'rgba(255,255,255,0.05)';
          rr(g, 14, y, w - 28, 36, 5);
          g.fill();
          g.fillStyle = '#f4a261';
          g.font = '700 14px monospace';
          g.fillText(r[0], 24, y + 18);
          g.fillStyle = '#f8fafc';
          g.font = '700 15px sans-serif';
          g.fillText(r[1], 165, y + 18);
          g.fillStyle = '#cbd5e1';
          g.font = '600 14px sans-serif';
          g.fillText(r[2], 370, y + 18);
          g.fillStyle = i === 3 ? '#4ade80' : '#facc15';
          g.textAlign = 'right';
          g.font = '700 14px monospace';
          g.fillText(r[3], w - 24, y + 18);
          g.textAlign = 'left';
        });
      });
      boxAt(g0, 7.6, 2.35, 0.14, spec.cx, fy + 2.35, spec.cz + 8.7, frameDarkMat, false, false);
      const reMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.3, 2.1), reBoard.mat);
      reMesh.position.set(spec.cx, fy + 2.35, spec.cz + 8.62);
      reMesh.rotation.y = Math.PI;
      g0.add(reMesh);
      reBoard.setMesh(reMesh);
    }

    // Architectural Rooftop Crowns (4 cohesive tropical-modern silhouettes replacing boxy flat roofs)
    root.add(roofShellGroup);
    const roofY = spec.groundY + spec.h;

    if (style === 'tower') {
      // Reference Image 2: Rounded-corner rooftop bullnose terrace crown + infinity plunge pool + fluted timber pavilion + palms
      const roofDeck = new THREE.Mesh(
        getRoundedSlabGeo(spec.w + 2.6, spec.d + 2.6, 3.1, 0.36, 0.08),
        archMats.bullnoseConcrete
      );
      roofDeck.position.set(spec.cx, roofY + 0.05, spec.cz);
      roofDeck.castShadow = true;
      roofDeck.receiveShadow = true;
      roofShellGroup.add(roofDeck);
      pickMeshes.push(roofDeck);

      const roofRail = new THREE.Mesh(
        getRoundedPerimeterWallGeo(spec.w + 2.0, spec.d + 2.0, 2.75, 0.95, 0.032),
        buildingGlass
      );
      roofRail.position.set(spec.cx, roofY + 0.22, spec.cz);
      roofShellGroup.add(roofRail);

      // Rounded fluted rooftop crown pavilion
      const pavW = spec.w * 0.44;
      const pavD = spec.d * 0.38;
      const pavH = 2.6;
      const pavWall = new THREE.Mesh(
        getRoundedPerimeterWallGeo(pavW, pavD, 1.8, pavH, 0.16),
        archMats.timberFin
      );
      pavWall.position.set(spec.cx + spec.w * 0.12, roofY + 0.22, spec.cz - spec.d * 0.12);
      roofShellGroup.add(pavWall);
      const pavCap = new THREE.Mesh(
        getRoundedSlabGeo(pavW + 1.2, pavD + 1.2, 2.1, 0.26, 0.06),
        archMats.bullnoseConcrete
      );
      pavCap.position.set(spec.cx + spec.w * 0.12, roofY + 0.22 + pavH + 0.12, spec.cz - spec.d * 0.12);
      pavCap.castShadow = true;
      roofShellGroup.add(pavCap);
      pickMeshes.push(pavCap);

      // Rooftop infinity plunge pool & palms on street-facing rim
      const plungeDeck = new THREE.Mesh(
        getRoundedSlabGeo(7.2, 4.0, 0.9, 0.36, 0.05),
        archMats.bullnoseConcrete
      );
      plungeDeck.position.set(spec.cx - spec.w * 0.2, roofY + 0.36, spec.cz + dirZ * (spec.d * 0.22));
      roofShellGroup.add(plungeDeck);
      const plungeWater = new THREE.Mesh(
        getRoundedSlabGeo(6.2, 3.1, 0.7, 0.2, 0.02),
        archMats.poolWater
      );
      plungeWater.position.set(spec.cx - spec.w * 0.2, roofY + 0.5, spec.cz + dirZ * (spec.d * 0.22));
      roofShellGroup.add(plungeWater);

      buildTropicalPalm(roofShellGroup, spec.cx - spec.w * 0.4, roofY + 0.22, spec.cz - spec.d * 0.3, 3.4, 701 + spec.cx, M, archMats);
      buildTropicalPalm(roofShellGroup, spec.cx + spec.w * 0.38, roofY + 0.22, spec.cz + dirZ * spec.d * 0.28, 3.7, 709 + spec.cx, M, archMats);
      buildPlanterTrough(roofShellGroup, spec.cx, roofY + 0.24, spec.cz + dirZ * (spec.d * 0.5 + 0.7), 5.6, rotFacingDoor, 720, archMats);
    } else if (style === 'blade') {
      // Reference Image 3: Dramatic sloped cantilevered blade roof + warm cedar soffit + dark bronze louvre clerestory
      const baseDeck = new THREE.Mesh(
        getRoundedSlabGeo(spec.w + 1.8, spec.d + 2.0, 2.1, 0.28, 0.06),
        archMats.stuccoWhite
      );
      baseDeck.position.set(spec.cx, roofY, spec.cz + dirZ * 0.42);
      baseDeck.receiveShadow = true;
      roofShellGroup.add(baseDeck);

      const bladeGroup = new THREE.Group();
      bladeGroup.position.set(spec.cx, roofY, spec.cz + dirZ * 0.65);
      bladeGroup.rotation.y = rotFacingDoor;
      const bladeW = spec.w + 3.2;
      const bladeD = spec.d + 3.4;
      const bladeRoof = new THREE.Mesh(
        getSlopedRoofBladeGeo(bladeW, bladeD, 0.45, 0.88, 2.85, 3.3, 0.06),
        archMats.stuccoWhite
      );
      bladeRoof.castShadow = true;
      bladeRoof.receiveShadow = true;
      bladeGroup.add(bladeRoof);

      const bladeSoffit = new THREE.Mesh(
        getSlopedRoofBladeGeo(bladeW - 0.6, bladeD - 0.6, 0.38, 0.46, 2.78, 2.86, 0.02),
        archMats.timberSoffit
      );
      bladeGroup.add(bladeSoffit);

      // Vertical dark bronze architectural louvre clerestory fins beneath the high front eave
      for (let lx = -bladeW * 0.44; lx <= bladeW * 0.44; lx += 0.55) {
        boxAt(bladeGroup, 0.09, 1.45, 0.22, lx, 1.88, bladeD * 0.42, archMats.bronzeMullion, true, false, 0.01);
      }
      // Slender cylindrical columns holding front cantilevered blade eave
      [-bladeW * 0.42, -bladeW * 0.14, bladeW * 0.14, bladeW * 0.42].forEach((cx) => {
        cylAt(bladeGroup, 0.14, 0.14, 2.85, cx, 1.42, bladeD * 0.42, archMats.stuccoWhite, true, false, 14);
      });
      roofShellGroup.add(bladeGroup);
      pickMeshes.push(baseDeck, bladeRoof);

      buildTropicalPalm(roofShellGroup, spec.cx - spec.w * 0.38, roofY + 0.14, spec.cz + dirZ * (spec.d * 0.35), 3.3, 811 + spec.cx, M, archMats);
      buildTropicalPalm(roofShellGroup, spec.cx + spec.w * 0.38, roofY + 0.14, spec.cz + dirZ * (spec.d * 0.35), 3.5, 819 + spec.cx, M, archMats);
    } else if (style === 'stone_pergola') {
      // Reference Image 4: Sloped cantilevered timber-soffit eave + ashlar stone turret + rooftop vine pergola & tropical palms
      const baseDeck = new THREE.Mesh(
        getRoundedSlabGeo(spec.w + 2.2, spec.d + 2.2, 1.8, 0.28, 0.06),
        archMats.bullnoseConcrete
      );
      baseDeck.position.set(spec.cx, roofY, spec.cz);
      baseDeck.receiveShadow = true;
      roofShellGroup.add(baseDeck);

      const eaveGroup = new THREE.Group();
      eaveGroup.position.set(spec.cx - spec.w * 0.12, roofY, spec.cz);
      eaveGroup.rotation.y = rotFacingDoor;
      const eaveRoof = new THREE.Mesh(
        getSlopedRoofBladeGeo(spec.w * 0.72, spec.d + 2.8, 0.4, 0.76, 1.85, 2.22, 0.05),
        archMats.stuccoWhite
      );
      eaveRoof.castShadow = true;
      eaveGroup.add(eaveRoof);
      const eaveSoffit = new THREE.Mesh(
        getSlopedRoofBladeGeo(spec.w * 0.72 - 0.5, spec.d + 2.4, 0.34, 0.4, 1.79, 1.86, 0.015),
        archMats.timberSoffit
      );
      eaveGroup.add(eaveSoffit);
      // Ashlar stone chimney / feature tower anchoring the sloped roof
      boxAt(eaveGroup, 2.4, 2.55, 2.2, -spec.w * 0.28, 1.25, -spec.d * 0.22, archMats.ashlarStone, true, true, 0.04);
      roofShellGroup.add(eaveGroup);
      pickMeshes.push(baseDeck, eaveRoof);

      // Rooftop vine-draped lounge pergola on opposite terrace wing
      buildVinePergolaCanopy(
        roofShellGroup,
        spec.cx + spec.w * 0.26,
        roofY + 0.14,
        spec.cz,
        spec.w * 0.34,
        spec.d * 0.65,
        2.3,
        [-spec.w * 0.13, spec.w * 0.13],
        830,
        archMats
      );
      buildTropicalPalm(roofShellGroup, spec.cx + spec.w * 0.38, roofY + 0.14, spec.cz + dirZ * spec.d * 0.32, 3.6, 845, M, archMats);
    } else {
      // 'shed_seam' (Reference Image 1): Asymmetric sloped shed roof with warm cedar soffit + standing-seam cladding + glazed clerestory
      const baseDeck = new THREE.Mesh(
        getRoundedSlabGeo(spec.w + 1.1, spec.d + 1.1, 1.4, 0.26, 0.05),
        frameDarkMat
      );
      baseDeck.position.set(spec.cx, roofY, spec.cz);
      baseDeck.receiveShadow = true;
      roofShellGroup.add(baseDeck);

      const shedW = spec.w + 2.6;
      const shedD = spec.d + 2.2;
      const shedTop = new THREE.Mesh(
        getAsymmetricShedRoofGeo(shedW, shedD, 0.45, spec.w * 0.16, 2.95, 1.35, 0.36, 0.05),
        archMats.standingSeam
      );
      shedTop.position.set(spec.cx, roofY, spec.cz);
      shedTop.castShadow = true;
      shedTop.receiveShadow = true;
      roofShellGroup.add(shedTop);

      const shedSoffit = new THREE.Mesh(
        getAsymmetricShedRoofGeo(shedW - 0.5, shedD - 0.4, 0.38, spec.w * 0.16, 2.88, 1.28, 0.08, 0.015),
        archMats.timberSoffit
      );
      shedSoffit.position.set(spec.cx, roofY, spec.cz);
      roofShellGroup.add(shedSoffit);

      // Glazed gable clerestory & bronze mullions tailored strictly beneath the asymmetric shed soffit
      const clereW = spec.w - 1.6;
      const peakX = spec.w * 0.16;
      const halfShedW = shedW * 0.5;
      const shedHeightAt = (lx: number): number => {
        if (lx <= peakX) {
          return 0.38 + ((lx + halfShedW) / (peakX + halfShedW)) * (2.88 - 0.38);
        }
        return 2.88 + ((lx - peakX) / (halfShedW - peakX)) * (1.28 - 2.88);
      };
      const clereLeftY = shedHeightAt(-clereW * 0.5) - 0.04;
      const clereRightY = shedHeightAt(clereW * 0.5) - 0.04;
      const clereGeo = getGableClerestoryGeo(clereW, clereLeftY, peakX, 2.82, clereRightY, 0.05);
      [-spec.d * 0.47, spec.d * 0.47].forEach((dz) => {
        const clereZ = spec.cz + dz;
        const clereGlass = new THREE.Mesh(clereGeo, buildingGlass);
        clereGlass.position.set(spec.cx, roofY + 0.06, clereZ);
        roofShellGroup.add(clereGlass);
        for (let lx = -clereW * 0.45; lx <= clereW * 0.45; lx += 3.1) {
          const mh = Math.max(0.28, shedHeightAt(lx) - 0.1);
          boxAt(roofShellGroup, 0.12, mh, 0.14, spec.cx + lx, roofY + 0.06 + mh * 0.5, clereZ, archMats.bronzeMullion, true, false);
        }
      });
      pickMeshes.push(baseDeck, shedTop);
    }

    // Exterior beveled interlocking cobblestone forecourt apron + organic corner shrubs
    const apronPad = new THREE.Mesh(
      getRoundedSlabGeo(spec.w + 5.6, spec.d + 5.6, 2.2, 0.04, 0.018),
      exteriorCobbleApronMat
    );
    apronPad.position.set(spec.cx, spec.groundY - 0.012, spec.cz);
    apronPad.receiveShadow = true;
    cityGroup.add(apronPad);
    contact(cityGroup, spec.cx, spec.groundY - 0.002, spec.cz, spec.w + 9, spec.d + 9, 0.42, M.textures.shadowTex);

    // Organic foundation shrubs softening building corners without impinging on door walkways
    [-1, 1].forEach((side, si) => {
      buildOrganicShrub(
        cityGroup,
        spec.cx + side * (spec.w * 0.5 + 0.65),
        spec.groundY,
        spec.cz + dirZ * (spec.d * 0.5 - 0.9),
        0.58,
        0.74,
        spec.cx * 3 + si * 19,
        M,
        archMats,
        (spec.cx + si) % 2 === 0
      );
    });

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
