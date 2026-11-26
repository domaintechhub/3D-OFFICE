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
  getRoundedSlabWithVoidGeo,
  getRoundedSlabWithVoidsGeo,
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
import { buildApexDealershipWholeBuilding } from './dealershipInterior';
import { buildBitVaultWholeBuilding } from './cryptoInterior';
import { buildVitalCareWholeBuilding } from './medicalInterior';
import { buildNairobiTrustBankWholeBuilding } from './bankInterior';
import { buildRealEstateWholeBuilding } from './realestateInterior';
import { buildDistrictBuildingConstruction } from './districtConstruction';

export interface DistrictChairHandle extends OfficeChairHandle {
  buildingId: BuildingId;
  groundY: number;
  floorH: number;
}

export interface WarmLightAnchor {
  x: number;
  y: number;
  z: number;
  color: number;
  distance: number;
  baseScale: number;
  floor?: number;
  buildingId?: BuildingId;
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
  warmLights: WarmLightAnchor[];
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
  }, true, true);
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

  // Bespoke curved-corner glass entrance showcase & cylindrical white corner columns for Real Estate Ground Floor
  if (spec.id === 'realestate' && isGround) {
    const cornerR = 2.4;
    const clearGlass = new THREE.MeshStandardMaterial({
      color: 0xdaf0fa,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.2,
      envMapIntensity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const galleryBackMat = new THREE.MeshStandardMaterial({
      color: 0x3b424c,
      roughness: 0.68,
      metalness: 0.08,
      envMapIntensity: 0.3,
    });

    // 1. Back wall (South): solid warm-slate architectural wall for coffee bar, meeting rooms & timber slats
    const reBackSolid = boxAt(
      parent,
      spec.w - 0.8,
      hWall * 0.76,
      WALL_THICK,
      spec.cx,
      yFloor + SLAB_THICK * 0.5 + hWall * 0.38,
      backZ,
      wallMat,
      true,
      true,
      0.03
    );
    const reBackTransom = boxAt(
      parent,
      spec.w - 1.0,
      hWall * 0.22,
      0.06,
      spec.cx,
      yFloor + SLAB_THICK * 0.5 + hWall * 0.88,
      backZ,
      clearGlass,
      false,
      false
    );
    picks.push(reBackSolid, reBackTransom);

    // 2. White cylindrical structural corner columns (signature sleek storefront pillars)
    const frontColZ = frontZ - dirZ * 0.42;
    const backColZ = backZ + dirZ * 0.36;
    [-1, 1].forEach((side) => {
      const cxCol = spec.cx + side * (hw - 0.48);
      const cF = cylAt(parent, 0.32, 0.32, hWall, cxCol, yMid, frontColZ, archMats.stuccoWhite, true, true, 20);
      const cB = cylAt(parent, 0.28, 0.28, hWall, cxCol, yMid, backColZ, archMats.stuccoWhite, true, true, 18);
      picks.push(cF, cB);
    });

    // 3. Sweeping curved glass corner arcs at front NW & NE corners (r = 2.4m, tangent to front & flank glass)
    const curveH = hWall - 0.24;
    const eastCurveCx = spec.cx + hw - 0.11 - cornerR;
    const westCurveCx = spec.cx - hw + 0.11 + cornerR;
    const frontCurveCz = frontZ - dirZ * cornerR;

    const neArc = new THREE.Mesh(
      new THREE.CylinderGeometry(cornerR, cornerR, curveH, 18, 1, true, Math.PI * 0.5, Math.PI * 0.5),
      clearGlass
    );
    neArc.position.set(eastCurveCx, yMid, frontCurveCz);
    parent.add(neArc);
    picks.push(neArc);

    const nwArc = new THREE.Mesh(
      new THREE.CylinderGeometry(cornerR, cornerR, curveH, 18, 1, true, Math.PI, Math.PI * 0.5),
      clearGlass
    );
    nwArc.position.set(westCurveCx, yMid, frontCurveCz);
    parent.add(nwArc);
    picks.push(nwArc);

    // Slim white/bronze curved sill & header trim along front glass
    const frontSpanW = spec.w - cornerR * 2 - 0.4;
    boxAt(parent, frontSpanW, 0.12, 0.16, spec.cx, yFloor + SLAB_THICK * 0.5 + 0.06, frontZ, archMats.stuccoWhite, false, true);
    boxAt(parent, frontSpanW, 0.12, 0.16, spec.cx, yFloor + spec.floorH - 0.18, frontZ, archMats.stuccoWhite, false, false);

    // 4. Straight front glass panels flanking the open central entrance doorway
    const leftGlassW = Math.max(0.5, spec.doorX - DOOR_HALF_W - (spec.cx - hw + 0.11 + cornerR));
    const leftGlassX = spec.cx - hw + 0.11 + cornerR + leftGlassW * 0.5;
    const lgFront = boxAt(parent, leftGlassW, curveH, 0.055, leftGlassX, yMid, frontZ, clearGlass, false, false);

    const rightGlassW = Math.max(0.5, spec.cx + hw - 0.11 - cornerR - (spec.doorX + DOOR_HALF_W));
    const rightGlassX = spec.doorX + DOOR_HALF_W + rightGlassW * 0.5;
    const rgFront = boxAt(parent, rightGlassW, curveH, 0.055, rightGlassX, yMid, frontZ, clearGlass, false, false);
    picks.push(lgFront, rgFront);

    // Open frameless glass entrance portal & swung-out double doors
    const transH = Math.max(0.45, hWall - 2.65);
    boxAt(parent, DOOR_HALF_W * 2, transH, 0.055, spec.doorX, yFloor + SLAB_THICK * 0.5 + 2.65 + transH * 0.5, frontZ, clearGlass, false, false);
    boxAt(parent, DOOR_HALF_W * 2 + 0.24, 0.1, 0.2, spec.doorX, yFloor + SLAB_THICK * 0.5 + 2.65, frontZ, archMats.bronzeMullion, false, false);
    [-1, 1].forEach((s) => {
      boxAt(parent, 0.1, hWall, 0.2, spec.doorX + s * (DOOR_HALF_W + 0.05), yMid, frontZ, archMats.bronzeMullion, true, false);
      boxAt(parent, 0.05, 2.48, 1.15, spec.doorX + s * DOOR_HALF_W, yFloor + SLAB_THICK * 0.5 + 1.24, frontZ + dirZ * 0.58, clearGlass, false, false);
    });

    // 5. East flank wall (+X): Featured Properties Gallery backing wall + upper transom glazing
    const eastWx = spec.cx + hw - WALL_THICK * 0.5;
    const eastLen = spec.d - cornerR - 0.4;
    const eastCz = spec.cz - dirZ * (cornerR * 0.5);
    const eastWall = boxAt(parent, WALL_THICK, hWall * 0.78, eastLen, eastWx, yFloor + SLAB_THICK * 0.5 + hWall * 0.39, eastCz, galleryBackMat, true, true, 0.02);
    const eastTrans = boxAt(parent, 0.06, hWall * 0.2, eastLen, eastWx, yFloor + SLAB_THICK * 0.5 + hWall * 0.88, eastCz, clearGlass, false, false);
    picks.push(eastWall, eastTrans);

    // 6. West flank wall (-X): Open glass showcase up front + solid kitchenette backing at rear
    const westWx = spec.cx - hw + WALL_THICK * 0.5;
    const westFrontLen = 9.2;
    const westFrontCz = frontZ - dirZ * (cornerR + westFrontLen * 0.5);
    const westGlass = boxAt(parent, 0.055, curveH, westFrontLen, westWx, yMid, westFrontCz, clearGlass, false, false);
    boxAt(parent, WALL_THICK * 0.7, 0.14, westFrontLen, westWx, yFloor + SLAB_THICK * 0.5 + 0.07, westFrontCz, archMats.stuccoWhite, false, true);
    const westRearLen = spec.d - cornerR - westFrontLen - 0.3;
    const westRearCz = backZ + dirZ * (westRearLen * 0.5);
    const westRear = boxAt(parent, WALL_THICK, hWall * 0.78, westRearLen, westWx, yFloor + SLAB_THICK * 0.5 + hWall * 0.39, westRearCz, wallMat, true, true, 0.02);
    picks.push(westGlass, westRear);
    return;
  }

  // Bespoke Upper-Level Perimeter for Real Estate (L1-L4): Matching curved front glass corners & white cylindrical columns
  if (spec.id === 'realestate' && lv >= 1) {
    const cornerR = 2.4;
    const clearGlass = new THREE.MeshStandardMaterial({
      color: 0xdaf0fa,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.2,
      envMapIntensity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const curveH = hWall - 0.22;

    // 1. Back wall (South): crisp off-white architectural wall + upper clerestory glass
    const reBackSolid = boxAt(
      parent,
      spec.w - 0.8,
      hWall * 0.84,
      WALL_THICK,
      spec.cx,
      yFloor + SLAB_THICK * 0.5 + hWall * 0.42,
      backZ,
      archMats.stuccoWhite,
      true,
      true,
      0.03
    );
    const reBackTransom = boxAt(
      parent,
      spec.w - 1.0,
      hWall * 0.14,
      0.06,
      spec.cx,
      yFloor + SLAB_THICK * 0.5 + hWall * 0.91,
      backZ,
      clearGlass,
      false,
      false
    );
    picks.push(reBackSolid, reBackTransom);

    // 2. White cylindrical structural columns at all four corners (aligning cleanly over Ground Floor columns)
    const frontColZ = frontZ - dirZ * 0.42;
    const backColZ = backZ + dirZ * 0.36;
    [-1, 1].forEach((side) => {
      const cxCol = spec.cx + side * (hw - 0.48);
      const cF = cylAt(parent, 0.32, 0.32, hWall, cxCol, yMid, frontColZ, archMats.stuccoWhite, true, true, 20);
      const cB = cylAt(parent, 0.28, 0.28, hWall, cxCol, yMid, backColZ, archMats.stuccoWhite, true, true, 18);
      picks.push(cF, cB);
    });

    // 3. Curved front glass corners (NW & NE, r = 2.4m) + continuous clear front glass wall
    const eastCurveCx = spec.cx + hw - 0.11 - cornerR;
    const westCurveCx = spec.cx - hw + 0.11 + cornerR;
    const frontCurveCz = frontZ - dirZ * cornerR;

    const neArc = new THREE.Mesh(
      new THREE.CylinderGeometry(cornerR, cornerR, curveH, 18, 1, true, Math.PI * 0.5, Math.PI * 0.5),
      clearGlass
    );
    neArc.position.set(eastCurveCx, yMid, frontCurveCz);
    parent.add(neArc);
    picks.push(neArc);

    const nwArc = new THREE.Mesh(
      new THREE.CylinderGeometry(cornerR, cornerR, curveH, 18, 1, true, Math.PI, Math.PI * 0.5),
      clearGlass
    );
    nwArc.position.set(westCurveCx, yMid, frontCurveCz);
    parent.add(nwArc);
    picks.push(nwArc);

    const frontSpanW = spec.w - cornerR * 2 - 0.22;
    const frontGlass = boxAt(parent, frontSpanW, curveH, 0.055, spec.cx, yMid, frontZ, clearGlass, false, false);
    boxAt(parent, frontSpanW, 0.12, 0.14, spec.cx, yFloor + SLAB_THICK * 0.5 + 0.06, frontZ, archMats.stuccoWhite, false, true);
    boxAt(parent, frontSpanW, 0.12, 0.14, spec.cx, yFloor + spec.floorH - 0.18, frontZ, archMats.stuccoWhite, false, false);
    picks.push(frontGlass);

    // 4. East flank (+X): crisp white gallery wall supporting artworks & living green wall strips
    const eastWx = spec.cx + hw - WALL_THICK * 0.5;
    const eastLen = spec.d - cornerR - 0.35;
    const eastCz = spec.cz - dirZ * (cornerR * 0.5);
    const eastWall = boxAt(parent, WALL_THICK, hWall * 0.84, eastLen, eastWx, yFloor + SLAB_THICK * 0.5 + hWall * 0.42, eastCz, archMats.stuccoWhite, true, true, 0.02);
    const eastTrans = boxAt(parent, 0.06, hWall * 0.14, eastLen, eastWx, yFloor + SLAB_THICK * 0.5 + hWall * 0.91, eastCz, clearGlass, false, false);
    picks.push(eastWall, eastTrans);

    // 5. West flank (-X): Clear atrium glass up front + solid kitchenette rear corner wall
    const westWx = spec.cx - hw + WALL_THICK * 0.5;
    const westFrontLen = 9.0;
    const westFrontCz = frontZ - dirZ * (cornerR + westFrontLen * 0.5);
    const westGlass = boxAt(parent, 0.055, curveH, westFrontLen, westWx, yMid, westFrontCz, clearGlass, false, false);
    boxAt(parent, WALL_THICK * 0.7, 0.12, westFrontLen, westWx, yFloor + SLAB_THICK * 0.5 + 0.06, westFrontCz, archMats.stuccoWhite, false, true);
    const westRearLen = spec.d - cornerR - westFrontLen - 0.2;
    const westRearCz = backZ + dirZ * (westRearLen * 0.5);
    const westRear = boxAt(parent, WALL_THICK, hWall * 0.84, westRearLen, westWx, yFloor + SLAB_THICK * 0.5 + hWall * 0.42, westRearCz, archMats.stuccoWhite, true, true, 0.02);
    picks.push(westGlass, westRear);
    return;
  }

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
      const colMat =
        spec.id === 'bank' ? wallMat : style === 'tower' || style === 'blade' ? archMats.stuccoWhite : frameMat;
      const colS = cylAt(parent, 0.24, 0.24, hWall, wx - side * 0.15, yMid, frontZ - dirZ * 0.15, colMat, true, true, 16);
      const colB = cylAt(parent, 0.24, 0.24, hWall, wx - side * 0.15, yMid, backZ + dirZ * 0.15, colMat, true, true, 16);
      picks.push(colS, colB);
      // Mid-flank timber fin or champagne-bronze mullion screen
      for (let k = -1; k <= 1; k++) {
        boxAt(
          parent,
          0.08,
          hWall - 0.14,
          0.14,
          wx + side * 0.06,
          yMid,
          spec.cz + k * 0.42,
          style === 'tower' && spec.id !== 'bank' ? archMats.timberFin : archMats.bronzeMullion,
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

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xaad4eb,
    roughness: 0.14,
    metalness: 0.14,
    transparent: true,
    opacity: 0.28,
    envMapIntensity: 0.65,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const warmGlassMat = new THREE.MeshStandardMaterial({
    color: 0xd8cdb8,
    roughness: 0.16,
    metalness: 0.12,
    transparent: true,
    opacity: 0.27,
    envMapIntensity: 0.6,
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
  const bankLimestoneMat = std({
    map: mkTileTex(M.textures.concreteTex, 3, 2),
    normalMap: mkTileTex(M.textures.concreteNormal, 3, 2),
    normalScale: new THREE.Vector2(0.4, 0.4),
    color: 0xe3d8c3,
    roughness: 0.7,
  });
  const bankTerrazzoMat = std({
    map: mkTileTex(M.textures.terrazzoTex, 4, 3),
    normalMap: mkTileTex(M.textures.terrazzoNormal, 4, 3),
    normalScale: new THREE.Vector2(0.38, 0.38),
    roughnessMap: mkTileTex(M.textures.terrazzoRoughness, 4, 3),
    color: 0xebe2d0,
    roughness: 0.48,
    metalness: 0.03,
    envMapIntensity: 0.34,
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
    const warmLights: WarmLightAnchor[] = [];

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
            ? bankLimestoneMat
            : spec.id === 'realestate'
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
          : spec.id === 'bank'
            ? bankTerrazzoMat
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
        // Sweeping rounded-corner wraparound bullnose balcony slab (Bank opens both West Stairwell + L1 Rotunda Void)
        const towerSlabGeo =
          spec.id === 'crypto' && lv >= 1
            ? getRoundedSlabWithVoidGeo(spec.w + 2.4, spec.d + 2.4, 3.0, 0.34, 4.35, 10.65, -9.65, -2.45, 0.08)
            : spec.id === 'bank' && lv === 1
              ? getRoundedSlabWithVoidsGeo(
                  spec.w + 2.4,
                  spec.d + 2.4,
                  3.0,
                  0.34,
                  [
                    [-10.5, -5.0, -6.5, 1.5],
                    [0.8, 6.8, -1.0, 5.0],
                  ],
                  0.08
                )
              : spec.id === 'bank' && lv >= 2
                ? getRoundedSlabWithVoidGeo(spec.w + 2.4, spec.d + 2.4, 3.0, 0.34, -10.5, -5.0, -6.5, 1.5, 0.08)
                : getRoundedSlabGeo(spec.w + 2.4, spec.d + 2.4, 3.0, 0.34, 0.08);
        const slab = new THREE.Mesh(towerSlabGeo, spec.id === 'bank' ? bankTerrazzoMat : archMats.bullnoseConcrete);
        slab.position.set(spec.cx, spec.id === 'crypto' ? yFloor - 0.05 : yFloor - 0.03, spec.cz);
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
        // Note: blade slab sits at spec.cz + dirZ * 0.42; medical dirZ = +1 -> local void Z = worldZOff - 0.42
        const bladeSlabGeo =
          spec.id === 'travel' && lv >= 1
            ? getRoundedSlabWithVoidGeo(spec.w + 1.8, spec.d + 2.0, 2.1, 0.3, 10.25, 13.25, 0.37, 4.17, 0.07)
            : spec.id === 'medical' && lv >= 1
              ? getRoundedSlabWithVoidGeo(spec.w + 1.8, spec.d + 2.0, 2.1, 0.3, 3.2, 8.8, -7.22, -1.02, 0.07)
              : getRoundedSlabGeo(spec.w + 1.8, spec.d + 2.0, 2.1, 0.3, 0.07);
        const slab = new THREE.Mesh(bladeSlabGeo, archMats.stuccoWhite);
        slab.position.set(spec.cx, spec.id === 'medical' ? yFloor - 0.03 : yFloor - 0.02, spec.cz + dirZ * 0.42);
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
        // For Real Estate: L1 retains NW atrium overlook void + stairwell shaft; L2..L4 cut the continuous G->L4 stairwell shaft
        const slabGeo =
          spec.id === 'realestate' && lv === 1
            ? getRoundedSlabWithVoidsGeo(
                spec.w + 2.2,
                spec.d + 2.2,
                1.8,
                0.3,
                [
                  [-12.1, -0.6, -8.45, -1.8],
                  [-12.25, -9.25, -0.05, 3.75],
                ],
                0.06
              )
            : spec.id === 'realestate' && lv >= 2
              ? getRoundedSlabWithVoidGeo(spec.w + 2.2, spec.d + 2.2, 1.8, 0.3, -12.25, -9.25, -0.05, 3.75, 0.06)
              : spec.id === 'tourism' && lv >= 1
                ? getRoundedSlabWithVoidGeo(spec.w + 2.2, spec.d + 2.2, 1.8, 0.3, 11.22, 14.28, 4.15, 7.95, 0.06)
                : spec.id === 'restaurant' && lv >= 1
                  ? getRoundedSlabWithVoidGeo(spec.w + 2.2, spec.d + 2.2, 1.8, 0.3, -9.52, -6.48, 2.85, 6.65, 0.06)
                  : getRoundedSlabGeo(spec.w + 2.2, spec.d + 2.2, 1.8, 0.3, 0.06);
        const slab = new THREE.Mesh(slabGeo, archMats.bullnoseConcrete);
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

        if (lv % 2 === 1 && !(spec.id === 'realestate' && lv === 1)) {
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
        const seamSlabGeo =
          spec.id === 'logistics' && lv >= 1
            ? getRoundedSlabWithVoidGeo(spec.w + 1.0, spec.d + 1.0, 1.4, 0.28, -14.32, -11.28, 4.15, 7.95, 0.05)
            : spec.id === 'dealership' && lv === 1
              ? getRoundedSlabWithVoidsGeo(
                  spec.w + 1.0,
                  spec.d + 1.0,
                  1.4,
                  0.28,
                  [
                    [-3.45, 3.45, -2.45, 3.25],
                    [7.84, 9.68, -3.72, 4.65],
                  ],
                  0.05
                )
              : spec.id === 'dealership' && lv === 2
                ? getRoundedSlabWithVoidGeo(spec.w + 1.0, spec.d + 1.0, 1.4, 0.28, -9.68, -7.84, -3.72, 4.65, 0.05)
                : getRoundedSlabGeo(spec.w + 1.0, spec.d + 1.0, 1.4, 0.28, 0.05);
        const slab = new THREE.Mesh(seamSlabGeo, slabFloorMat);
        slab.position.set(spec.cx, spec.id === 'dealership' ? yFloor - 0.02 : yFloor, spec.cz);
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

      // Ceiling slab & recessed linear lighting (Real Estate lv=0..3 keep stairwell shaft open; lv=0 also keeps NW atrium overlook)
      const cSlabGeo =
        spec.id === 'realestate' && lv === 0
          ? getRoundedSlabWithVoidsGeo(
              spec.w - 0.2,
              spec.d - 0.2,
              1.5,
              0.16,
              [
                [-12.1, -0.6, -8.45, -1.8],
                [-12.25, -9.25, -0.05, 3.75],
              ],
              0.02
            )
          : spec.id === 'dealership' && lv === 0
            ? getRoundedSlabWithVoidsGeo(
                spec.w - 0.2,
                spec.d - 0.2,
                1.5,
                0.16,
                [
                  [-3.45, 3.45, -2.45, 3.25],
                  [7.84, 9.68, -3.72, 4.65],
                ],
                0.02
              )
            : spec.id === 'dealership' && lv === 1
              ? getRoundedSlabWithVoidGeo(spec.w - 0.2, spec.d - 0.2, 1.5, 0.16, -9.68, -7.84, -3.72, 4.65, 0.02)
              : (spec.id === 'realestate' && lv >= 1 && lv < spec.floors - 1)
                ? getRoundedSlabWithVoidGeo(spec.w - 0.2, spec.d - 0.2, 1.5, 0.16, -12.25, -9.25, -0.05, 3.75, 0.02)
                : spec.id === 'travel' && lv < spec.floors - 1
                  ? getRoundedSlabWithVoidGeo(spec.w - 0.2, spec.d - 0.2, 1.5, 0.16, 10.25, 13.25, -0.05, 3.75, 0.02)
                  : spec.id === 'tourism' && lv < spec.floors - 1
                    ? getRoundedSlabWithVoidGeo(spec.w - 0.2, spec.d - 0.2, 1.5, 0.16, 11.22, 14.28, 4.15, 7.95, 0.02)
                    : spec.id === 'logistics' && lv < spec.floors - 1
                      ? getRoundedSlabWithVoidGeo(spec.w - 0.2, spec.d - 0.2, 1.5, 0.16, -14.32, -11.28, 4.15, 7.95, 0.02)
                      : spec.id === 'restaurant' && lv < spec.floors - 1
                        ? getRoundedSlabWithVoidGeo(spec.w - 0.2, spec.d - 0.2, 1.5, 0.16, -9.52, -6.48, 2.85, 6.65, 0.02)
                        : spec.id === 'crypto' && lv < spec.floors - 1
                          ? getRoundedSlabWithVoidGeo(spec.w - 0.2, spec.d - 0.2, 1.5, 0.16, 4.35, 10.65, -9.65, -2.45, 0.02)
                          : spec.id === 'medical' && lv < spec.floors - 1
                            ? getRoundedSlabWithVoidGeo(spec.w - 0.2, spec.d - 0.2, 1.5, 0.16, 3.2, 8.8, -6.8, -0.6, 0.02)
                            : spec.id === 'bank' && lv === 0
                              ? getRoundedSlabWithVoidsGeo(
                                  spec.w - 0.2,
                                  spec.d - 0.2,
                                  1.5,
                                  0.16,
                                  [
                                    [-10.5, -5.0, -6.5, 1.5],
                                    [0.8, 6.8, -1.0, 5.0],
                                  ],
                                  0.02
                                )
                              : spec.id === 'bank' && lv >= 1 && lv < spec.floors - 1
                                ? getRoundedSlabWithVoidGeo(spec.w - 0.2, spec.d - 0.2, 1.5, 0.16, -10.5, -5.0, -6.5, 1.5, 0.02)
                                : getRoundedSlabGeo(spec.w - 0.2, spec.d - 0.2, 1.5, 0.16, 0.02);
      const cSlab = new THREE.Mesh(cSlabGeo, M.white);
      cSlab.position.set(spec.cx, ceilY, spec.cz);
      cg.add(cSlab);
      pickMeshes.push(cSlab);
      const lxSpan = Math.max(4, spec.w - 8);
      if (spec.id === 'dealership' || spec.id === 'crypto' || spec.id === 'medical' || spec.id === 'bank' || spec.id === 'realestate') {
        // Custom Apex, BitVault, VitalCare, Nairobi Trust Bank & TerraCraft Real Estate architectural ceilings are built by their whole-building interior modules
      } else {
        [-spec.d * 0.22, spec.d * 0.22].forEach((dz) => {
          ceilingLinearLight(cg, spec.cx, ceilY - 0.08, spec.cz + dz, lxSpan, 0.26, M);
        });
      }

      buildPerimeterWalls(lg, spec, lv, buildingGlass, wallMat, frameDarkMat, archMats, style, true, pickMeshes);

      // Floor 0 interior props per niche, OR upper floor office/lounge setups
      if (lv === 0) {
        warmLights.push({
          x: spec.cx,
          y: floorSurfaceY + 3.1,
          z: spec.cz,
          color:
            spec.id === 'restaurant'
              ? 0xffd2a0
              : spec.id === 'medical'
                ? 0xdffaf4
                : spec.id === 'crypto'
                  ? 0xe6fff5
                  : 0xfff3de,
          distance: spec.w + 8,
          baseScale: 1.0,
          floor: 0,
          buildingId: spec.id,
        });
      } else if (
        (spec.id === 'realestate' && lv >= 1 && lv <= 4) ||
        (spec.id === 'travel' && lv >= 1 && lv <= 3) ||
        (spec.id === 'tourism' && lv >= 1 && lv <= 3) ||
        (spec.id === 'logistics' && lv >= 1 && lv <= 3) ||
        (spec.id === 'restaurant' && lv >= 1 && lv <= 3) ||
        (spec.id === 'dealership' && lv >= 1 && lv <= 2) ||
        (spec.id === 'crypto' && lv >= 1 && lv <= 4) ||
        (spec.id === 'medical' && lv >= 1 && lv <= 4) ||
        (spec.id === 'bank' && lv >= 1 && lv <= 5)
      ) {
        // Custom-built upper floors below
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
        : spec.id === 'realestate'
          ? 2.98
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
        : spec.id === 'realestate'
          ? spec.groundY + spec.floorH + 0.16
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
      // =========================================================================
      // SAVANNA BISTRO & GRILL: BESPOKE CULINARY HOUSE (G - L3)
      // =========================================================================
      const bistroMosaicTex = makeCanvasTex('bistro_mosaic_floor', 256, 256, (g, W, H) => {
        g.fillStyle = '#25211f';
        g.fillRect(0, 0, W, H);
        const step = 32;
        for (let y = 0; y < H; y += step) {
          for (let x = 0; x < W; x += step) {
            const alt = ((x / step) + (y / step)) % 2 === 0;
            g.fillStyle = alt ? '#2e2724' : '#3a2d27';
            g.fillRect(x + 1, y + 1, step - 2, step - 2);
            if (((x / step) % 4 === 0) && ((y / step) % 4 === 0)) {
              g.fillStyle = '#b45309';
              g.fillRect(x + 8, y + 8, step - 16, step - 16);
            }
          }
        }
        g.strokeStyle = 'rgba(212,163,74,0.22)';
        g.lineWidth = 1.5;
        g.strokeRect(1, 1, W - 2, H - 2);
      });
      bistroMosaicTex.wrapS = bistroMosaicTex.wrapT = THREE.RepeatWrapping;
      bistroMosaicTex.repeat.set(6, 5);
      bistroMosaicTex.colorSpace = THREE.SRGBColorSpace;
      bistroMosaicTex.anisotropy = getMaxAnisotropy();
      const bistroMosaicFloor = std({ map: bistroMosaicTex, roughness: 0.42, metalness: 0.08, envMapIntensity: 0.34 });

      const flutedTerracottaTex = makeCanvasTex('bistro_fluted_terracotta', 256, 128, (g, W, H) => {
        g.fillStyle = '#9b4d38';
        g.fillRect(0, 0, W, H);
        for (let x = 0; x < W; x += 12) {
          const gr = g.createLinearGradient(x, 0, x + 12, 0);
          gr.addColorStop(0, '#743423');
          gr.addColorStop(0.4, '#bd644a');
          gr.addColorStop(0.85, '#8a402c');
          gr.addColorStop(1, '#6c3020');
          g.fillStyle = gr;
          g.fillRect(x, 0, 12, H);
        }
      });
      flutedTerracottaTex.wrapS = flutedTerracottaTex.wrapT = THREE.RepeatWrapping;
      flutedTerracottaTex.repeat.set(3, 1);
      flutedTerracottaTex.colorSpace = THREE.SRGBColorSpace;
      const flutedTerracotta = std({ map: flutedTerracottaTex, roughness: 0.72, metalness: 0.04 });

      const hammeredCopper = std({ color: 0xc86d44, roughness: 0.3, metalness: 0.84, envMapIntensity: 0.72 });
      const agedBrass = std({ color: 0xd4a34a, roughness: 0.34, metalness: 0.82, envMapIntensity: 0.7 });
      const charredIron = std({ color: 0x1b1e23, roughness: 0.52, metalness: 0.65, envMapIntensity: 0.45 });
      const smokedOak = std({ color: 0x4a2f1d, roughness: 0.56, metalness: 0.04 });
      const creamLinen = std({ color: 0xf3ece0, roughness: 0.88, metalness: 0.0 });
      const bistroBurgundy = std({ color: 0x6e202c, roughness: 0.86, metalness: 0.02 });
      const oliveVelvet = std({ color: 0x4e5d38, roughness: 0.86, metalness: 0.02 });
      const amberEmberGlow = new THREE.MeshBasicMaterial({ color: 0xff7b29 });
      const filamentBulbMat = new THREE.MeshBasicMaterial({ color: 0xffe4a1 });
      const amberWineGlass = new THREE.MeshStandardMaterial({
        color: 0xd99b4e,
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.26,
        envMapIntensity: 0.75,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const addBistroSign = (parent: THREE.Object3D, title: string, x: number, y: number, z: number, rotY = 0) => {
        const tex = makeCanvasTex(`bistro_sign_${title}`, 400, 74, (g, w, h) => {
          g.fillStyle = '#1b1411';
          g.fillRect(0, 0, w, h);
          g.strokeStyle = '#d4a34a';
          g.lineWidth = 3;
          g.strokeRect(4, 4, w - 8, h - 8);
          g.fillStyle = '#c86d44';
          g.fillRect(10, 10, 8, h - 20);
          g.fillStyle = '#fdf4e7';
          g.font = '700 17px "Plus Jakarta Sans", sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(title, w * 0.52, h * 0.5);
        }, true, true);
        tex.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.6, 0.3),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
        );
        mesh.position.set(x, y, z);
        mesh.rotation.y = rotY;
        parent.add(mesh);
      };

      const addBistroCeilingRig = (parent: THREE.Object3D, ceilTopY: number, zRows: number[], xCols: number[]) => {
        zRows.forEach((zr) => {
          boxAt(parent, spec.w - 2.6, 0.14, 0.14, spec.cx, ceilTopY - 0.14, zr, charredIron, true, false);
        });
        xCols.forEach((xc) => {
          zRows.forEach((zr) => {
            cylAt(parent, 0.012, 0.012, 0.56, xc, ceilTopY - 0.44, zr, agedBrass, false, false, 6);
            cylAt(parent, 0.11, 0.18, 0.09, xc, ceilTopY - 0.72, zr, hammeredCopper, true, false, 14);
            const globe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), filamentBulbMat);
            globe.position.set(xc, ceilTopY - 0.78, zr);
            parent.add(globe);
          });
        });
      };

      // Hero 1: Multi-Part Sculpted Wood-Fired Copper & Terracotta Pizza Hearth (8 parts)
      const addCopperPizzaHearth = (parent: THREE.Object3D, x: number, y: number, z: number) => {
        const hg = new THREE.Group();
        hg.position.set(x, y, z);
        cylAt(hg, 1.24, 1.32, 0.88, 0, 0.44, 0, bankStoneMat, true, true, 18);
        // Firewood alcove & stacked logs
        boxAt(hg, 0.72, 0.46, 0.14, 0, 0.25, 1.22, charredIron, false, false);
        [-0.14, 0, 0.14].forEach((lx) => cylAt(hg, 0.06, 0.06, 0.42, lx, 0.22, 1.24, smokedOak, false, false, 8));
        // Stone hearth ledge & brass rim
        cylAt(hg, 1.34, 1.3, 0.09, 0, 0.92, 0, creamLinen, true, true, 20);
        // Dome cladding & arched hearth mouth + glowing fire bed
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1.18, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), flutedTerracotta);
        dome.position.set(0, 0.96, 0);
        dome.castShadow = true;
        hg.add(dome);
        boxAt(hg, 0.86, 0.54, 0.26, 0, 1.22, 1.06, charredIron, true, false, 0.02);
        boxAt(hg, 0.64, 0.36, 0.16, 0, 1.18, 1.12, amberEmberGlow, false, false);
        // Copper flue collar & chimney pipe
        cylAt(hg, 0.32, 0.38, 0.22, 0, 2.08, 0, hammeredCopper, true, false, 16);
        cylAt(hg, 0.2, 0.22, 1.35, 0, 2.82, 0, charredIron, true, false, 14);
        parent.add(hg);
      };

      // Hero 2: Multi-Part Artisan Copper Drum Coffee Roaster (7 parts)
      const addCoffeeRoaster = (parent: THREE.Object3D, x: number, y: number, z: number) => {
        const rg = new THREE.Group();
        rg.position.set(x, y, z);
        boxAt(rg, 1.35, 0.72, 1.05, 0, 0.36, 0, charredIron, true, true, 0.03);
        // Horizontal copper roasting drum + brass end rings
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.05, 18), hammeredCopper);
        drum.rotation.z = Math.PI / 2;
        drum.position.set(0, 1.05, -0.1);
        drum.castShadow = true;
        rg.add(drum);
        [-0.5, 0.5].forEach((dx) => {
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.06, 18), agedBrass);
          ring.rotation.z = Math.PI / 2;
          ring.position.set(dx, 1.05, -0.1);
          rg.add(ring);
        });
        // Brass bean hopper funnel on top & cooling sieve basin in front
        cylAt(rg, 0.32, 0.1, 0.44, 0, 1.62, -0.1, agedBrass, true, false, 16);
        cylAt(rg, 0.48, 0.48, 0.24, 0, 0.78, 0.62, hammeredCopper, true, true, 20);
        cylAt(rg, 0.43, 0.43, 0.04, 0, 0.91, 0.62, smokedOak, false, false, 18);
        cylAt(rg, 0.09, 0.1, 1.75, -0.45, 1.9, -0.35, charredIron, true, false, 12);
        parent.add(rg);
      };

      // Hero 3: Illuminated Amber-Glass & Hammered-Copper Wine Vault Rack
      const addWineRack = (parent: THREE.Object3D, x: number, y: number, z: number, len: number, rotY = 0) => {
        const wg = new THREE.Group();
        wg.position.set(x, y, z);
        wg.rotation.y = rotY;
        boxAt(wg, len, 2.45, 0.46, 0, 1.225, 0, smokedOak, true, true, 0.02);
        [0.48, 1.05, 1.62, 2.15].forEach((sy) => {
          boxAt(wg, len - 0.16, 0.05, 0.42, 0, sy, 0.02, agedBrass, false, false);
          for (let bx = -len * 0.42; bx <= len * 0.42; bx += 0.34) {
            cylAt(wg, 0.045, 0.045, 0.28, bx, sy + 0.17, 0.04, M.dark, false, false, 8);
            boxAt(wg, 0.06, 0.07, 0.02, bx, sy + 0.16, 0.1, amberEmberGlow, false, false);
          }
        });
        parent.add(wg);
      };

      // Non-overlapping mosaic floor tile strips around SW stairwell void (-9.52..-6.48 x +2.85..+6.65)
      const addUpperBistroFloor = (parent: THREE.Object3D, floorY: number) => {
        boxAt(parent, 16.0, 0.018, 17.2, spec.cx + 1.6, floorY + 0.009, spec.cz, bistroMosaicFloor, false, true);
        boxAt(parent, 3.2, 0.018, 11.42, spec.cx - 8.0, floorY + 0.009, spec.cz - 2.89, bistroMosaicFloor, false, true);
        boxAt(parent, 3.2, 0.018, 1.92, spec.cx - 8.0, floorY + 0.009, spec.cz + 7.64, bistroMosaicFloor, false, true);
      };

      // Shared Bistro Screens (Live Kitchen KDS & Vintage Terroir / Tapas Tasting Board)
      const kdsScreen = createCustomBoardScreen(screenReg, 640, 220, (g, w, h, t) => {
        g.fillStyle = '#140f0c';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#c86d44';
        g.fillRect(0, 0, w, 34);
        g.fillStyle = '#fff9f0';
        g.font = '800 17px "Plus Jakarta Sans", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('SAVANNA BISTRO & GRILL · WOOD-FIRED HEARTH & KITCHEN KDS', 16, 17);
        const specials = [
          ['Wood-Fired Wagyu Ribeye', '390°C Oak Hearth', 'KES 3,850'],
          ['Lamu Red Snapper', 'Saffron Coconut Glaze', 'KES 2,950'],
          ['Nyeri Peaberry Espresso', 'Single-Estate Roast', 'KES 650'],
        ];
        specials.forEach((sp, i) => {
          const y = 56 + i * 50;
          g.fillStyle = i === Math.floor(t / 3) % 3 ? 'rgba(200,109,68,0.28)' : 'rgba(255,255,255,0.06)';
          rr(g, 16, y, w - 32, 42, 6);
          g.fill();
          g.fillStyle = '#fef3c7';
          g.font = '700 16px sans-serif';
          g.fillText(sp[0], 28, y + 21);
          g.fillStyle = '#cbd5e1';
          g.font = '500 15px sans-serif';
          g.fillText(sp[1], 295, y + 21);
          g.fillStyle = '#fbbf24';
          g.textAlign = 'right';
          g.font = '700 16px monospace';
          g.fillText(sp[2], w - 28, y + 21);
          g.textAlign = 'left';
        });
      });

      const cellarScreen = createCustomBoardScreen(screenReg, 520, 260, (g, w, h, t) => {
        g.fillStyle = '#18100d';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#d4a34a';
        g.fillRect(0, 0, w, 36);
        g.fillStyle = '#18100d';
        g.font = '800 16px "Plus Jakarta Sans", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('CELLAR RESERVE · ROASTERY & TASTING FLIGHT TELEMETRY', 14, 18);
        const vintages = [
          ['Rift Valley Reserve Syrah', '14.5°C Vault · 84% Hum', '96 PTS'],
          ['Stellenbosch Cabernet 2018', 'Tasting Flight Pairing', 'DECANTED'],
          ['Kirinyaga AA Honey Roast', 'Batch #42 · Medium-Dark', 'LIVE ROAST'],
          ['Chef’s 7-Course Degustation', '19:30 Seating · Table 01', 'CONFIRMED'],
        ];
        vintages.forEach((v, i) => {
          const y = 52 + i * 48;
          g.fillStyle = i === Math.floor(t / 2.8) % 4 ? 'rgba(212,163,74,0.22)' : 'rgba(255,255,255,0.05)';
          rr(g, 14, y, w - 28, 40, 5);
          g.fill();
          g.fillStyle = '#fffbeb';
          g.font = '700 14px sans-serif';
          g.fillText(v[0], 24, y + 20);
          g.fillStyle = '#d6d3d1';
          g.font = '500 13px sans-serif';
          g.fillText(v[1], 240, y + 20);
          g.fillStyle = '#f59e0b';
          g.textAlign = 'right';
          g.font = '700 13px monospace';
          g.fillText(v[2], w - 24, y + 20);
          g.textAlign = 'left';
        });
      });

      // -------------------------------------------------------------------------
      // FLOOR 0 (G): Wood-Fired Open Kitchen, Copper Hearth, Cocktail Bar & Dining Hall
      // -------------------------------------------------------------------------
      boxAt(g0, 19.2, 0.018, 17.2, spec.cx, fy + 0.009, spec.cz, bistroMosaicFloor, false, true);
      addBistroCeilingRig(levelCeilings[0], spec.groundY + spec.floorH - 0.12, [spec.cz - 4.2, spec.cz + 1.8], [spec.cx - 4.0, spec.cx + 2.2, spec.cx + 6.8]);

      // NW: Sculpted Copper & Terracotta Wood-Fired Hearth Oven (cx - 8.0, cz - 7.0)
      addCopperPizzaHearth(g0, spec.cx - 8.0, fy, spec.cz - 7.0);

      // North Center: Open Charcoal Grill & Fluted Terracotta Kitchen Pass (cx - 1.4, cz - 6.4)
      boxAt(g0, 6.8, 1.04, 1.15, spec.cx - 1.4, fy + 0.52, spec.cz - 6.4, flutedTerracotta, true, true, 0.03);
      boxAt(g0, 7.0, 0.08, 1.28, spec.cx - 1.4, fy + 1.06, spec.cz - 6.4, smokedOak, false, true, 0.02);
      boxAt(g0, 6.4, 0.58, 1.28, spec.cx - 1.4, fy + 2.68, spec.cz - 6.5, hammeredCopper, true, false, 0.04);
      boxAt(g0, 5.6, 0.04, 0.12, spec.cx - 1.4, fy + 2.38, spec.cz - 6.0, amberEmberGlow, false, false);

      // East Wall: Copper & Walnut Cocktail Bar + Overhead Glassware Rack + 3 Bar Stools (cx + 7.8, cz - 2.2)
      boxAt(g0, 1.2, 1.05, 6.2, spec.cx + 7.8, fy + 0.525, spec.cz - 2.2, flutedTerracotta, true, true, 0.03);
      boxAt(g0, 1.34, 0.07, 6.36, spec.cx + 7.8, fy + 1.07, spec.cz - 2.2, creamLinen, false, true, 0.02);
      boxAt(g0, 0.52, 0.48, 0.85, spec.cx + 7.8, fy + 1.32, spec.cz - 3.2, hammeredCopper, false, false, 0.03);
      boxAt(g0, 1.1, 0.08, 5.4, spec.cx + 7.8, fy + 2.65, spec.cz - 2.2, charredIron, true, false);
      [-4.0, -2.2, -0.4].forEach((bz) => {
        cylAt(g0, 0.2, 0.2, 0.09, spec.cx + 6.75, fy + 0.72, spec.cz + bz, bistroBurgundy, true, true, 16);
        cylAt(g0, 0.035, 0.035, 0.68, spec.cx + 6.75, fy + 0.34, spec.cz + bz, agedBrass, false, false, 10);
        cylAt(g0, 0.17, 0.2, 0.04, spec.cx + 6.75, fy + 0.02, spec.cz + bz, charredIron, false, true, 14);
      });

      // 4 Indoor Dining Tables clear of SW Stairwell Core (dx -9.55..-6.45, dz +1.50..+6.70)
      const diningPts: Array<[number, number]> = [
        [spec.cx - 3.6, spec.cz - 1.6],
        [spec.cx + 2.2, spec.cz - 1.6],
        [spec.cx - 3.6, spec.cz + 3.2],
        [spec.cx + 2.2, spec.cz + 3.2],
      ];
      diningPts.forEach(([tx, tz], ti) => {
        makeDiningTable(g0, tx, fy, tz, M, 0.68);
        registerChair(0, tx - 1.1, fy, tz, Math.PI / 2, ti % 2 ? 1 : -1);
        registerChair(0, tx + 1.1, fy, tz, -Math.PI / 2, ti % 2 ? -1 : 1);
      });

      // Host Reception Podium + Open Kitchen KDS Monitor
      makeDeskAt(g0, spec.cx + 4.8, fy, spec.cz + 6.4, 1.5, 0.85, M);
      registerChair(0, spec.cx + 4.8, fy, spec.cz + 7.25, Math.PI, 1);
      registerMonitor(0, 0, [spec.cx + 4.8, fy + 0.77, spec.cz + 6.25], 0, spec.cx + 4.8, spec.cz + 7.25, 'Maître D’ Host', 'Dining Hall & Reservations');
      registerMonitor(0, 1, [spec.cx - 0.5, fy + 1.1, spec.cz - 6.35], Math.PI, spec.cx - 0.5, spec.cz - 7.7, 'Head Chef KDS', 'Open Wood-Fired Kitchen');

      // Live Kitchen KDS Menu Board on North Wall
      boxAt(g0, 5.4, 2.05, 0.14, spec.cx + 5.6, fy + 2.25, spec.cz - 8.7, charredIron, false, false);
      const kdsMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 1.84), kdsScreen.mat);
      kdsMesh.position.set(spec.cx + 5.6, fy + 2.25, spec.cz - 8.62);
      g0.add(kdsMesh);
      kdsScreen.setMesh(kdsMesh);
      plant(g0, spec.cx + 8.6, fy, spec.cz + 7.4, 1.15, 1411, M, 'olive');

      // Exterior vine-draped timber pergola porte-cochère on ashlar stone piers + 2 outdoor bistro tables
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

      // -------------------------------------------------------------------------
      // FLOOR 1 (L1): Artisan Coffee Roastery, Tapas Bar & Velvet Banquette Hall
      // -------------------------------------------------------------------------
      const rg1 = levelGroups[1];
      if (rg1) {
        const rfy1 = spec.groundY + spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: rfy1 + 3.05,
          z: spec.cz,
          color: 0xffdfb8,
          distance: 24,
          baseScale: 1.03,
          floor: 1,
          buildingId: spec.id,
        });

        addUpperBistroFloor(rg1, rfy1);
        addBistroCeilingRig(levelCeilings[1], spec.groundY + 2 * spec.floorH - 0.12, [spec.cz - 4.0, spec.cz + 3.6], [spec.cx - 4.0, spec.cx + 4.8]);

        let r1MonIdx = 0;

        // NW Artisan Copper Coffee Drum Roaster + Roasting Q-Grader Pod
        addCoffeeRoaster(rg1, spec.cx - 7.8, rfy1, spec.cz - 6.4);
        makeDeskAt(rg1, spec.cx - 4.2, rfy1, spec.cz - 4.8, 2.4, 1.05, M);
        registerChair(1, spec.cx - 4.2, rfy1, spec.cz - 5.72, 0, 1);
        registerMonitor(1, r1MonIdx++, [spec.cx - 4.2, rfy1 + 0.77, spec.cz - 4.95], Math.PI, spec.cx - 4.2, spec.cz - 5.72, 'Head Coffee Roaster & Q-Grader · L1', 'Artisan Coffee Roastery');
        [spec.cx - 4.85, spec.cx - 3.55].forEach((vx) => {
          const gc = armchair(rg1, vx, rfy1, spec.cz - 3.65, Math.PI, oliveVelvet, M);
          gc.scale.set(0.72, 0.86, 0.72);
        });

        // Fluted Terracotta & Brass Feature Divider between Roastery & Tapas Hall
        boxAt(rg1, 0.22, 2.55, 5.2, spec.cx - 1.2, rfy1 + 1.275, spec.cz - 4.4, flutedTerracotta, true, true, 0.02);
        boxAt(rg1, 0.26, 0.08, 5.26, spec.cx - 1.2, rfy1 + 2.56, spec.cz - 4.4, agedBrass, false, false);
        boxAt(rg1, 0.08, 1.45, 3.0, spec.cx - 1.06, rfy1 + 1.55, spec.cz - 4.4, charredIron, false, false);
        const l1DivTv = new THREE.Mesh(new THREE.PlaneGeometry(2.85, 1.32), cellarScreen.mat);
        l1DivTv.position.set(spec.cx - 1.01, rfy1 + 1.55, spec.cz - 4.4);
        l1DivTv.rotation.y = Math.PI / 2;
        rg1.add(l1DivTv);

        // NE Tapas & Mezze Bar + Pastry Vitrine + 3 Oxblood Stools
        boxAt(rg1, 4.8, 1.02, 1.0, spec.cx + 6.4, rfy1 + 0.51, spec.cz - 6.4, flutedTerracotta, true, true, 0.02);
        boxAt(rg1, 4.92, 0.06, 1.1, spec.cx + 6.4, rfy1 + 1.04, spec.cz - 6.4, creamLinen, false, true, 0.02);
        boxAt(rg1, 1.4, 0.56, 0.72, spec.cx + 5.2, rfy1 + 1.35, spec.cz - 6.4, amberWineGlass, false, false);
        [4.8, 6.4, 8.0].forEach((bx) => {
          cylAt(rg1, 0.2, 0.2, 0.09, spec.cx + bx, rfy1 + 0.72, spec.cz - 5.3, bistroBurgundy, true, true, 16);
          cylAt(rg1, 0.035, 0.035, 0.68, spec.cx + bx, rfy1 + 0.34, spec.cz - 5.3, agedBrass, false, false, 10);
          cylAt(rg1, 0.17, 0.2, 0.04, spec.cx + bx, rfy1 + 0.02, spec.cz - 5.3, charredIron, false, true, 14);
        });

        // East Pastry & Tapas Chef Desk + South Sommelier Podium Desk
        makeDeskAt(rg1, spec.cx + 7.2, rfy1, spec.cz - 1.8, 2.2, 1.0, M);
        registerChair(1, spec.cx + 7.2, rfy1, spec.cz - 0.9, Math.PI, -1);
        registerMonitor(1, r1MonIdx++, [spec.cx + 7.2, rfy1 + 0.77, spec.cz - 1.95], 0, spec.cx + 7.2, spec.cz - 0.9, 'Executive Pastry & Tapas Chef · L1', 'Tapas & Pastry Kitchen');

        makeDeskAt(rg1, spec.cx - 2.6, rfy1, spec.cz + 4.7, 2.0, 0.95, M);
        registerChair(1, spec.cx - 2.6, rfy1, spec.cz + 5.6, Math.PI, 1);
        registerMonitor(1, r1MonIdx++, [spec.cx - 2.6, rfy1 + 0.77, spec.cz + 4.55], 0, spec.cx - 2.6, spec.cz + 5.6, 'Tapas Sommelier & Mixology Lead · L1', 'Mezzanine Cocktail Lounge');

        // Mezzanine Velvet Bistro Banquette Tables (SE & Center-East)
        [
          [spec.cx + 1.2, spec.cz + 0.6],
          [spec.cx + 6.2, spec.cz + 4.8],
        ].forEach(([tx, tz], ti) => {
          makeDiningTable(rg1, tx, rfy1, tz, M, 0.68);
          const chL = armchair(rg1, tx - 1.08, rfy1, tz, Math.PI / 2, ti === 0 ? bistroBurgundy : oliveVelvet, M);
          chL.scale.set(0.7, 0.86, 0.7);
          const chR = armchair(rg1, tx + 1.08, rfy1, tz, -Math.PI / 2, ti === 0 ? oliveVelvet : bistroBurgundy, M);
          chR.scale.set(0.7, 0.86, 0.7);
        });
        boxAt(rg1, 0.08, 1.85, 3.8, spec.cx + 9.54, rfy1 + 1.88, spec.cz + 4.8, charredIron, false, false);
        const l1EastTv = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.65), kdsScreen.mat);
        l1EastTv.position.set(spec.cx + 9.48, rfy1 + 1.88, spec.cz + 4.8);
        l1EastTv.rotation.y = -Math.PI / 2;
        rg1.add(l1EastTv);
        plant(rg1, spec.cx + 8.6, rfy1, spec.cz + 7.4, 1.15, 1412, M, 'olive');
      }

      // -------------------------------------------------------------------------
      // FLOOR 2 (L2): Climate-Controlled Amber Glass Wine Vault & Chef's Tasting Gallery
      // -------------------------------------------------------------------------
      const rg2 = levelGroups[2];
      if (rg2) {
        const rfy2 = spec.groundY + 2 * spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: rfy2 + 3.05,
          z: spec.cz,
          color: 0xffe4c2,
          distance: 24,
          baseScale: 1.05,
          floor: 2,
          buildingId: spec.id,
        });

        addUpperBistroFloor(rg2, rfy2);
        addBistroCeilingRig(levelCeilings[2], spec.groundY + 3 * spec.floorH - 0.12, [spec.cz - 4.0, spec.cz + 3.6], [spec.cx - 6.0, spec.cx + 5.2]);

        let r2MonIdx = 0;

        // NW Walk-In Amber-Glass Wine Vault (dx -9.4..-3.2, dz -8.6..-0.6, open East portal dz -3.2..-1.4)
        boxAt(rg2, 6.2, 2.75, 0.08, spec.cx - 6.3, rfy2 + 1.375, spec.cz - 0.6, amberWineGlass, false, false);
        boxAt(rg2, 0.08, 2.75, 5.4, spec.cx - 3.2, rfy2 + 1.375, spec.cz - 5.9, amberWineGlass, false, false);
        boxAt(rg2, 0.08, 2.75, 0.8, spec.cx - 3.2, rfy2 + 1.375, spec.cz - 1.0, amberWineGlass, false, false);
        boxAt(rg2, 0.12, 0.12, 8.0, spec.cx - 3.2, rfy2 + 2.76, spec.cz - 4.6, charredIron, true, false);
        boxAt(rg2, 6.2, 0.12, 0.12, spec.cx - 6.3, rfy2 + 2.76, spec.cz - 0.6, charredIron, true, false);
        addBistroSign(rg2, 'CLIMATE WINE VAULT · 14.5°C', spec.cx - 3.1, rfy2 + 2.52, spec.cz - 2.3, Math.PI / 2);

        addWineRack(rg2, spec.cx - 6.3, rfy2, spec.cz - 8.2, 5.2, 0);
        addWineRack(rg2, spec.cx - 9.1, rfy2, spec.cz - 4.6, 5.2, Math.PI / 2);
        // Marble Decanting Island inside Vault (cx - 6.4, cz - 4.6)
        boxAt(rg2, 2.1, 0.92, 1.05, spec.cx - 6.4, rfy2 + 0.46, spec.cz - 4.6, smokedOak, true, true, 0.02);
        boxAt(rg2, 2.2, 0.06, 1.14, spec.cx - 6.4, rfy2 + 0.95, spec.cz - 4.6, creamLinen, false, true, 0.02);
        cylAt(rg2, 0.12, 0.16, 0.28, spec.cx - 6.6, rfy2 + 1.12, spec.cz - 4.6, hammeredCopper, false, false, 14);
        cylAt(rg2, 0.1, 0.14, 0.24, spec.cx - 6.0, rfy2 + 1.1, spec.cz - 4.6, agedBrass, false, false, 12);

        // East-North: Grand 8-Seat Chef's Interactive Degustation Table (cx + 5.2, cz - 3.6)
        const ctX = spec.cx + 5.2;
        const ctZ = spec.cz - 3.6;
        boxAt(rg2, 2.35, 0.08, 5.4, ctX, rfy2 + 0.75, ctZ, smokedOak, true, true, 0.03);
        [-1.75, 1.75].forEach((tz) => boxAt(rg2, 1.25, 0.68, 0.22, ctX, rfy2 + 0.34, ctZ + tz, hammeredCopper, true, true, 0.02));
        registerChair(2, ctX, rfy2, ctZ - 3.35, 0, 1);
        registerMonitor(2, r2MonIdx++, [ctX, rfy2 + 0.8, ctZ - 2.45], Math.PI, ctX, ctZ - 3.35, 'Cellar Master & Head Sommelier · L2', 'Chef’s Tasting Gallery');
        registerChair(2, ctX - 1.85, rfy2, ctZ - 0.8, Math.PI / 2, -1);
        registerMonitor(2, r2MonIdx++, [ctX - 0.98, rfy2 + 0.8, ctZ - 0.8], -Math.PI / 2, ctX - 1.85, ctZ - 0.8, 'Chef’s Table Culinary Director · L2', 'Chef’s Tasting Gallery');
        officeChair(rg2, ctX, rfy2, ctZ + 3.35, Math.PI, M);
        [-1.8, 0.8, 2.0].forEach((czo) => officeChair(rg2, ctX - 1.85, rfy2, ctZ + czo, Math.PI / 2, M));
        [-1.8, -0.5, 0.8, 2.0].forEach((czo) => officeChair(rg2, ctX + 1.85, rfy2, ctZ + czo, -Math.PI / 2, M));

        // South-Center: Aged Charcuterie & Artisanal Fromage Glass Cabinet (cx - 2.6, cz + 6.8)
        boxAt(rg2, 3.0, 1.85, 0.82, spec.cx - 2.6, rfy2 + 0.925, spec.cz + 6.8, smokedOak, true, true, 0.02);
        boxAt(rg2, 2.75, 1.15, 0.14, spec.cx - 2.6, rfy2 + 1.12, spec.cz + 6.4, amberWineGlass, false, false);

        // South-East Sommelier Velvet Lounge + Terroir Screen + Olive Trees
        const l2Sofa = sofaWide(rg2, spec.cx + 7.2, rfy2, spec.cz + 4.8, -Math.PI / 2, oliveVelvet, M);
        l2Sofa.scale.set(0.76, 0.92, 0.82);
        cylAt(rg2, 0.44, 0.44, 0.04, spec.cx + 5.2, rfy2 + 0.44, spec.cz + 4.8, creamLinen, true, true, 20);
        cylAt(rg2, 0.24, 0.28, 0.42, spec.cx + 5.2, rfy2 + 0.21, spec.cz + 4.8, hammeredCopper, true, true, 16);
        const l2Arm1 = armchair(rg2, spec.cx + 3.8, rfy2, spec.cz + 3.9, Math.PI * 0.35, bistroBurgundy, M);
        l2Arm1.scale.set(0.72, 0.88, 0.72);
        const l2Arm2 = armchair(rg2, spec.cx + 3.8, rfy2, spec.cz + 5.7, Math.PI * 0.65, bistroBurgundy, M);
        l2Arm2.scale.set(0.72, 0.88, 0.72);
        boxAt(rg2, 0.08, 1.85, 3.8, spec.cx + 9.54, rfy2 + 1.88, spec.cz + 4.8, charredIron, false, false);
        const l2EastTv = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.65), cellarScreen.mat);
        l2EastTv.position.set(spec.cx + 9.48, rfy2 + 1.88, spec.cz + 4.8);
        l2EastTv.rotation.y = -Math.PI / 2;
        rg2.add(l2EastTv);
        plant(rg2, spec.cx + 8.6, rfy2, spec.cz - 7.6, 1.15, 1413, M, 'olive');
        plant(rg2, spec.cx + 8.6, rfy2, spec.cz + 7.6, 1.15, 1414, M, 'ficus');
      }

      // -------------------------------------------------------------------------
      // FLOOR 3 (L3): Private Sky-Grill Boardroom, Culinary CEO Studio & Head Offices
      // -------------------------------------------------------------------------
      const rg3 = levelGroups[3];
      if (rg3) {
        const rfy3 = spec.groundY + 3 * spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: rfy3 + 3.1,
          z: spec.cz,
          color: 0xffe7cb,
          distance: 25,
          baseScale: 1.08,
          floor: 3,
          buildingId: spec.id,
        });

        addUpperBistroFloor(rg3, rfy3);
        addBistroCeilingRig(levelCeilings[3], spec.groundY + 4 * spec.floorH - 0.12, [spec.cz - 4.0, spec.cz + 3.6], [spec.cx - 4.8, spec.cx + 5.8]);

        let r3MonIdx = 0;

        // 1. EAST WING (dx +2.2..+9.4): Private Savanna Boardroom & Wine-Tasting Dining Room (portal dz -1.6..+0.2)
        const brWallX = spec.cx + 2.2;
        boxAt(rg3, 0.08, 2.95, 6.8, brWallX, rfy3 + 1.475, spec.cz - 5.0, amberWineGlass, false, false);
        boxAt(rg3, 0.08, 2.95, 8.2, brWallX, rfy3 + 1.475, spec.cz + 4.3, amberWineGlass, false, false);
        boxAt(rg3, 0.12, 0.12, 16.8, brWallX, rfy3 + 2.96, spec.cz, charredIron, true, false);
        [-8.4, -1.6, 0.2, 4.2, 8.4].forEach((mz) => boxAt(rg3, 0.12, 2.96, 0.12, brWallX, rfy3 + 1.48, spec.cz + mz, agedBrass, true, false));
        addBistroSign(rg3, 'PRIVATE DINING BOARDROOM', brWallX - 0.09, rfy3 + 2.66, spec.cz - 0.7, -Math.PI / 2);

        const brX = spec.cx + 5.8;
        const brZ = spec.cz + 0.0;
        boxAt(rg3, 2.1, 0.08, 6.2, brX, rfy3 + 0.75, brZ, smokedOak, true, true, 0.03);
        boxAt(rg3, 2.16, 0.04, 6.26, brX, rfy3 + 0.71, brZ, agedBrass, true, true, 0.01);
        [-1.9, 1.9].forEach((pz) => boxAt(rg3, 1.15, 0.68, 0.24, brX, rfy3 + 0.34, brZ + pz, hammeredCopper, true, true, 0.02));
        registerChair(3, brX, rfy3, brZ - 3.75, 0, 1);
        registerMonitor(3, r3MonIdx++, [brX, rfy3 + 0.8, brZ - 2.85], Math.PI, brX, brZ - 3.75, 'Hospitality Group Director · L3', 'Private Dining Boardroom');
        registerChair(3, brX - 1.65, rfy3, brZ - 1.2, Math.PI / 2, -1);
        registerMonitor(3, r3MonIdx++, [brX - 0.85, rfy3 + 0.8, brZ - 1.2], -Math.PI / 2, brX - 1.65, brZ - 1.2, 'VP Culinary & Beverage · L3', 'Private Dining Boardroom');
        officeChair(rg3, brX, rfy3, brZ + 3.75, Math.PI, M);
        [-2.4, 0.2, 1.6].forEach((czo) => officeChair(rg3, brX - 1.65, rfy3, brZ + czo, Math.PI / 2, M));
        [-2.4, -1.0, 0.4, 1.8].forEach((czo) => officeChair(rg3, brX + 1.65, rfy3, brZ + czo, -Math.PI / 2, M));
        boxAt(rg3, 0.08, 1.95, 4.4, spec.cx + 9.54, rfy3 + 1.9, brZ, charredIron, false, false);
        const l3BrTv = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.75), cellarScreen.mat);
        l3BrTv.position.set(spec.cx + 9.48, rfy3 + 1.9, brZ);
        l3BrTv.rotation.y = -Math.PI / 2;
        rg3.add(l3BrTv);
        plant(rg3, spec.cx + 8.6, rfy3, spec.cz - 7.4, 1.15, 1415, M, 'olive');
        plant(rg3, spec.cx + 8.6, rfy3, spec.cz + 7.4, 1.15, 1416, M, 'ficus');

        // 2. NW CORNER (dx -9.4..-2.4, dz -8.4..-2.4): Founder & Culinary CEO Penthouse Studio (portal dx -5.2..-3.6)
        boxAt(rg3, 4.2, 2.95, 0.08, spec.cx - 7.3, rfy3 + 1.475, spec.cz - 2.4, amberWineGlass, false, false);
        boxAt(rg3, 1.2, 2.95, 0.08, spec.cx - 3.0, rfy3 + 1.475, spec.cz - 2.4, amberWineGlass, false, false);
        boxAt(rg3, 7.0, 0.12, 0.12, spec.cx - 5.9, rfy3 + 2.96, spec.cz - 2.4, charredIron, true, false);
        boxAt(rg3, 0.08, 2.95, 6.0, spec.cx - 2.4, rfy3 + 1.475, spec.cz - 5.4, amberWineGlass, false, false);
        [-9.4, -5.2, -3.6, -2.4].forEach((px) => boxAt(rg3, 0.12, 2.96, 0.12, spec.cx + px, rfy3 + 1.48, spec.cz - 2.4, agedBrass, true, false));
        addBistroSign(rg3, 'CULINARY CEO STUDIO', spec.cx - 7.2, rfy3 + 2.66, spec.cz - 2.3, 0);

        addWineRack(rg3, spec.cx - 5.9, rfy3, spec.cz - 8.2, 4.6, 0);
        const ceoBsX = spec.cx - 5.9;
        boxAt(rg3, 2.5, 0.065, 1.08, ceoBsX, rfy3 + 0.74, spec.cz - 5.6, smokedOak, true, true, 0.02);
        boxAt(rg3, 2.34, 0.72, 0.14, ceoBsX, rfy3 + 0.36, spec.cz - 5.18, hammeredCopper, true, true, 0.01);
        registerChair(3, ceoBsX, rfy3, spec.cz - 6.52, 0, 1);
        registerMonitor(3, r3MonIdx++, [ceoBsX, rfy3 + 0.77, spec.cz - 5.74], Math.PI, ceoBsX, spec.cz - 6.52, 'Founder & Culinary CEO · L3', 'Culinary CEO Studio');
        [ceoBsX - 0.75, ceoBsX + 0.75].forEach((gx) => {
          const gc = armchair(rg3, gx, rfy3, spec.cz - 4.35, Math.PI, bistroBurgundy, M);
          gc.scale.set(0.72, 0.86, 0.72);
        });

        // 3. SOUTH-CENTER (dx -4.2..+1.8, dz +2.8..+8.4): Head of Events & Culinary Ops Office (portal dx -2.2..-0.6)
        boxAt(rg3, 2.0, 2.95, 0.08, spec.cx - 3.2, rfy3 + 1.475, spec.cz + 2.8, amberWineGlass, false, false);
        boxAt(rg3, 2.4, 2.95, 0.08, spec.cx + 0.6, rfy3 + 1.475, spec.cz + 2.8, amberWineGlass, false, false);
        boxAt(rg3, 6.0, 0.12, 0.12, spec.cx - 1.2, rfy3 + 2.96, spec.cz + 2.8, charredIron, true, false);
        boxAt(rg3, 0.08, 2.95, 5.6, spec.cx - 4.2, rfy3 + 1.475, spec.cz + 5.6, amberWineGlass, false, false);
        [-4.2, -2.2, -0.6, 1.8].forEach((px) => boxAt(rg3, 0.12, 2.96, 0.12, spec.cx + px, rfy3 + 1.48, spec.cz + 2.8, agedBrass, true, false));
        addBistroSign(rg3, 'HEAD OF EVENTS & OPS', spec.cx - 1.2, rfy3 + 2.66, spec.cz + 2.7, Math.PI);

        const evX = spec.cx - 1.2;
        boxAt(rg3, 2.4, 0.06, 1.04, evX, rfy3 + 0.74, spec.cz + 5.6, smokedOak, true, true, 0.02);
        [-1.0, 1.0].forEach((lx) => boxAt(rg3, 0.08, 0.72, 0.84, evX + lx, rfy3 + 0.36, spec.cz + 5.6, charredIron, true, true, 0.01));
        registerChair(3, evX, rfy3, spec.cz + 6.52, Math.PI, -1);
        registerMonitor(3, r3MonIdx++, [evX, rfy3 + 0.77, spec.cz + 5.74], 0, evX, spec.cz + 6.52, 'Head of Events & Culinary Ops · L3', 'Head of Events Office');
        [evX - 0.75, evX + 0.75].forEach((vx) => {
          const vc = armchair(rg3, vx, rfy3, spec.cz + 4.35, 0, oliveVelvet, M);
          vc.scale.set(0.72, 0.86, 0.72);
        });

        // 4. CENTRAL MEZZANINE: Private Dining Concierge Reception & Brass Martini Lounge
        const recX = spec.cx - 0.1;
        boxAt(rg3, 2.0, 0.06, 0.92, recX, rfy3 + 0.74, spec.cz - 6.2, creamLinen, true, true, 0.02);
        boxAt(rg3, 2.04, 0.9, 0.14, recX, rfy3 + 0.45, spec.cz - 5.76, flutedTerracotta, true, true, 0.02);
        registerChair(3, recX, rfy3, spec.cz - 7.1, 0, 1);
        registerMonitor(3, r3MonIdx++, [recX, rfy3 + 0.77, spec.cz - 6.32], Math.PI, recX, spec.cz - 7.1, 'VIP Private Dining Concierge · L3', 'Sky-Grill Concierge');

        const mSofa = sofaWide(rg3, spec.cx + 1.0, rfy3, spec.cz - 1.2, -Math.PI / 2, oliveVelvet, M);
        mSofa.scale.set(0.74, 0.9, 0.8);
        cylAt(rg3, 0.42, 0.42, 0.04, spec.cx - 0.3, rfy3 + 0.44, spec.cz - 1.2, creamLinen, true, true, 20);
        cylAt(rg3, 0.22, 0.26, 0.42, spec.cx - 0.3, rfy3 + 0.21, spec.cz - 1.2, hammeredCopper, true, true, 16);
        const mArm1 = armchair(rg3, spec.cx - 1.4, rfy3, spec.cz - 2.0, Math.PI * 0.35, bistroBurgundy, M);
        mArm1.scale.set(0.7, 0.86, 0.7);
        const mArm2 = armchair(rg3, spec.cx - 1.4, rfy3, spec.cz - 0.4, Math.PI * 0.65, bistroBurgundy, M);
        mArm2.scale.set(0.7, 0.86, 0.7);
        plant(rg3, spec.cx - 5.4, rfy3, spec.cz + 7.4, 1.1, 1417, M, 'olive');
      }

      // -------------------------------------------------------------------------
      // CONTINUOUS SW IRON & HAMMERED-COPPER BISTRO STAIRWELL CORE (G -> L3)
      // -------------------------------------------------------------------------
      const bsXWest = spec.cx - 9.55;
      const bsXEast = spec.cx - 6.45;
      const bsXMid = spec.cx - 8.0;
      const bsZNorth = spec.cz + 1.5;
      const bsZSouth = spec.cz + 6.7;
      const bsW = bsXEast - bsXWest;
      const bsD = bsZSouth - bsZNorth;
      const bsCx = (bsXWest + bsXEast) * 0.5;
      const bsCz = (bsZNorth + bsZSouth) * 0.5;
      const bsBridgeZ = spec.cz + 2.85;
      const bsHalfStartZ = spec.cz + 5.45;
      const bsSigns = ['HEARTH STAIRS · G → L1', 'STAIRS · L1 ↔ L2', 'STAIRS · L2 ↔ L3', 'STAIRS · L3 SKY GRILL'];

      const addBistroRail = (parent: THREE.Object3D, x: number, y0: number, z0: number, y1: number, z1: number) => {
        const p0 = new THREE.Vector3(x, y0 + 0.94, z0);
        const p1 = new THREE.Vector3(x, y1 + 0.94, z1);
        const len = p0.distanceTo(p1);
        const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
        const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, len, 10), agedBrass);
        rail.position.copy(mid);
        rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        parent.add(rail);
        [0.15, 0.5, 0.85].forEach((t) => {
          const py = THREE.MathUtils.lerp(y0, y1, t);
          const pz = THREE.MathUtils.lerp(z0, z1, t);
          cylAt(parent, 0.015, 0.015, 0.94, x, py + 0.47, pz, charredIron, false, false, 8);
        });
      };

      for (let lv = 0; lv < spec.floors; lv++) {
        const rgS = levelGroups[lv];
        if (!rgS) continue;
        const fyS = spec.groundY + lv * spec.floorH + SLAB_THICK * 0.5;
        const wallH = spec.floorH - SLAB_THICK - 0.04;

        // North vestibule landing finish & warm brass threshold bar
        boxAt(rgS, 3.0, 0.018, 1.32, bsCx, fyS + 0.009, spec.cz + 2.18, bistroMosaicFloor, false, true);
        boxAt(rgS, 0.14, 0.018, 1.24, bsXEast, fyS + 0.012, spec.cz + 2.2, agedBrass, false, false);

        // West, North & South charred-iron & terracotta base + amber-glass shaft walls
        boxAt(rgS, 0.1, 0.24, bsD, bsXWest, fyS + 0.12, bsCz, hammeredCopper, true, true);
        boxAt(rgS, 0.05, wallH - 0.3, bsD, bsXWest, fyS + 0.24 + (wallH - 0.3) * 0.5, bsCz, amberWineGlass, false, false);
        boxAt(rgS, 0.12, 0.12, bsD, bsXWest, fyS + wallH - 0.02, bsCz, charredIron, false, false);
        [bsZNorth, spec.cz + 4.1, bsZSouth].forEach((mz) => boxAt(rgS, 0.1, wallH, 0.1, bsXWest, fyS + wallH * 0.5, mz, agedBrass, true, false));
        [bsZNorth, bsZSouth].forEach((wz) => {
          boxAt(rgS, bsW, 0.24, 0.1, bsCx, fyS + 0.12, wz, hammeredCopper, true, true);
          boxAt(rgS, bsW, wallH - 0.3, 0.05, bsCx, fyS + 0.24 + (wallH - 0.3) * 0.5, wz, amberWineGlass, false, false);
          boxAt(rgS, bsW, 0.12, 0.12, bsCx, fyS + wallH - 0.02, wz, charredIron, false, false);
          boxAt(rgS, 0.1, wallH, 0.1, bsXMid, fyS + wallH * 0.5, wz, agedBrass, true, false);
        });

        // East glass shaft wall south of doorway (dz = +2.82..+6.70 -> 3.88m)
        boxAt(rgS, 0.12, 0.36, 3.88, bsXEast, fyS + 0.18, spec.cz + 4.76, flutedTerracotta, true, true);
        boxAt(rgS, 0.05, wallH - 0.42, 3.88, bsXEast, fyS + 0.36 + (wallH - 0.42) * 0.5, spec.cz + 4.76, amberWineGlass, false, false);
        boxAt(rgS, 0.12, 0.12, 3.88, bsXEast, fyS + wallH - 0.02, spec.cz + 4.76, charredIron, false, false);
        boxAt(rgS, 0.1, wallH, 0.1, bsXEast, fyS + wallH * 0.5, spec.cz + 4.76, agedBrass, true, false);
        boxAt(rgS, 0.1, wallH, 0.1, bsXEast, fyS + wallH * 0.5, bsZSouth, agedBrass, true, false);

        // Framed open Brass-and-Iron Stairwell Door on East shaft face (dx = -6.45, dz = +1.56..+2.82)
        const doorZ = spec.cz + 2.19;
        const doorH = 2.48;
        [spec.cz + 1.56, spec.cz + 2.82].forEach((jz) => {
          boxAt(rgS, 0.15, wallH, 0.11, bsXEast, fyS + wallH * 0.5, jz, agedBrass, true, false, 0.01);
        });
        boxAt(rgS, 0.15, 0.12, 1.38, bsXEast, fyS + doorH + 0.06, doorZ, charredIron, true, false, 0.01);
        const transomH = Math.max(0.3, wallH - doorH - 0.16);
        boxAt(rgS, 0.05, transomH, 1.2, bsXEast, fyS + doorH + 0.12 + transomH * 0.5, doorZ, amberWineGlass, false, false);

        // Swung-open smoked-oak & brass wine-cellar style door leaf
        const doorLeaf = new THREE.Group();
        doorLeaf.position.set(bsXEast + 0.02, fyS, spec.cz + 2.78);
        doorLeaf.rotation.y = -2.22;
        boxAt(doorLeaf, 0.055, doorH - 0.04, 0.09, 0, (doorH - 0.04) * 0.5 + 0.02, -0.045, smokedOak, true, false);
        boxAt(doorLeaf, 0.055, doorH - 0.04, 0.09, 0, (doorH - 0.04) * 0.5 + 0.02, -1.08, smokedOak, true, false);
        boxAt(doorLeaf, 0.055, 0.14, 1.12, 0, 0.09, -0.56, hammeredCopper, true, false);
        boxAt(doorLeaf, 0.055, 0.12, 1.12, 0, doorH - 0.08, -0.56, hammeredCopper, true, false);
        boxAt(doorLeaf, 0.028, doorH - 0.3, 0.96, 0, doorH * 0.5, -0.56, amberWineGlass, false, false);
        cylAt(doorLeaf, 0.014, 0.014, 0.86, -0.055, 1.15, -0.98, agedBrass, false, false, 10);
        cylAt(doorLeaf, 0.014, 0.014, 0.86, 0.055, 1.15, -0.98, agedBrass, false, false, 10);
        rgS.add(doorLeaf);
        addBistroSign(rgS, bsSigns[lv] ?? `STAIRS · L${lv}`, bsXEast + 0.1, fyS + doorH + 0.36, doorZ, Math.PI / 2);

        // Two-Flight Switchback Charred-Iron & Smoked-Oak Stairs (G->L1, L1->L2, L2->L3)
        if (lv < spec.floors - 1) {
          const steps = 8;
          const runLen = bsHalfStartZ - bsBridgeZ;
          const stepDepth = runLen / steps;
          const halfRise = spec.floorH * 0.5;
          const stepRise = halfRise / steps;
          const yMidLv = fyS + halfRise;
          const yTopLv = fyS + spec.floorH;

          // Flight 1 (West lane dx = -8.77, climbs Southward +2.85 -> +5.45)
          for (let st = 0; st < steps; st++) {
            const ty = fyS + (st + 0.5) * stepRise;
            const tz = bsBridgeZ + (st + 0.5) * stepDepth;
            boxAt(rgS, 1.32, stepRise, stepDepth + 0.03, spec.cx - 8.77, ty, tz, charredIron, true, true, 0.008);
            boxAt(rgS, 1.35, 0.045, stepDepth + 0.04, spec.cx - 8.77, ty + stepRise * 0.5 + 0.01, tz, smokedOak, false, true, 0.008);
            boxAt(rgS, 1.35, 0.016, 0.035, spec.cx - 8.77, ty + stepRise * 0.5 + 0.028, tz - stepDepth * 0.45, agedBrass, false, false);
          }

          // South Half Landing (y = fyS + 2.10)
          boxAt(rgS, 2.94, 0.16, 1.22, bsCx, yMidLv - 0.07, spec.cz + 6.06, charredIron, true, true, 0.015);
          boxAt(rgS, 2.9, 0.04, 1.18, bsCx, yMidLv + 0.02, spec.cz + 6.06, smokedOak, false, true, 0.01);

          // Flight 2 (East lane dx = -7.23, climbs Northward +5.45 -> +2.85)
          for (let st = 0; st < steps; st++) {
            const ty = yMidLv + (st + 0.5) * stepRise;
            const tz = bsHalfStartZ - (st + 0.5) * stepDepth;
            boxAt(rgS, 1.32, stepRise * 0.55, stepDepth + 0.03, spec.cx - 7.23, ty + stepRise * 0.22, tz, charredIron, true, true, 0.008);
            boxAt(rgS, 1.35, 0.045, stepDepth + 0.04, spec.cx - 7.23, ty + stepRise * 0.5 + 0.01, tz, smokedOak, false, true, 0.008);
            boxAt(rgS, 1.35, 0.016, 0.035, spec.cx - 7.23, ty + stepRise * 0.5 + 0.028, tz + stepDepth * 0.45, agedBrass, false, false);
          }

          addBistroRail(rgS, spec.cx - 9.42, fyS, bsBridgeZ, yMidLv, bsHalfStartZ);
          addBistroRail(rgS, spec.cx - 8.08, fyS, bsBridgeZ, yMidLv, bsHalfStartZ);
          addBistroRail(rgS, spec.cx - 7.92, yMidLv, bsHalfStartZ, yTopLv, bsBridgeZ);
          addBistroRail(rgS, spec.cx - 6.58, yMidLv, bsHalfStartZ, yTopLv, bsBridgeZ);
        }

        // Shaft balustrades (ground under-stair guard + upper-floor drop guardrails)
        if (lv === 0) {
          boxAt(rgS, 1.44, 1.45, 0.06, spec.cx - 7.23, fyS + 0.725, bsBridgeZ, amberWineGlass, false, false);
          boxAt(rgS, 0.06, 1.04, 2.6, bsXMid, fyS + 0.52, spec.cz + 4.15, amberWineGlass, false, false);
        } else {
          boxAt(rgS, 0.06, 1.04, 3.8, bsXMid, fyS + 0.52, spec.cz + 4.75, amberWineGlass, false, false);
          boxAt(rgS, 0.05, 1.04, 3.8, spec.cx - 9.48, fyS + 0.52, spec.cz + 4.75, amberWineGlass, false, false);
          boxAt(rgS, 2.94, 1.04, 0.05, bsCx, fyS + 0.52, spec.cz + 6.64, amberWineGlass, false, false);
          if (lv === spec.floors - 1) {
            boxAt(rgS, 1.46, 1.04, 0.06, spec.cx - 8.77, fyS + 0.52, bsBridgeZ, amberWineGlass, false, false);
          }
        }
      }
    } else if (spec.id === 'dealership') {
      buildApexDealershipWholeBuilding({
        spec,
        levelGroups,
        levelCeilings,
        M,
        archMats,
        frameDarkMat,
        accentMat,
        glassMat,
        screenReg,
        registerChair,
        registerMonitor,
        pickMeshes,
        rotatingProps,
        warmLights,
        monitors,
      });
    } else if (spec.id === 'bank') {
      buildNairobiTrustBankWholeBuilding({
        spec,
        levelGroups,
        levelCeilings,
        roofShellGroup,
        M,
        archMats,
        frameDarkMat,
        accentMat,
        glassMat,
        screenReg,
        registerChair,
        registerMonitor,
        pickMeshes,
        rotatingProps,
        warmLights,
        monitors,
      });
    } else if (spec.id === 'crypto') {
      buildBitVaultWholeBuilding({
        spec,
        levelGroups,
        levelCeilings,
        M,
        archMats,
        frameDarkMat,
        accentMat,
        glassMat,
        screenReg,
        registerChair,
        registerMonitor,
        pickMeshes,
        rotatingProps,
        warmLights,
        monitors,
      });
    } else if (spec.id === 'travel') {
      // =========================================================================
      // SKYLINE TRAVEL & AVIATION: Bespoke Whole-Building Aviation Atelier (G -> L3)
      // (Cantilevered wing porte-cochere & ATC radar crown built by districtConstruction.ts)
      // =========================================================================

      // Signature Aviation Material Palette (unique to Skyline Travel & Aviation)
      const titaniumMat = std({ color: 0xc5cdd6, roughness: 0.32, metalness: 0.65, envMapIntensity: 0.7 });
      const navyJetMat = std({ color: 0x132238, roughness: 0.58, metalness: 0.18 });
      const birchSlatMat = std({
        map: mkTileTex(M.textures.woodTex, 2, 2),
        normalMap: mkTileTex(M.textures.woodNormal, 2, 2),
        normalScale: new THREE.Vector2(0.35, 0.35),
        color: 0xd9c7ad,
        roughness: 0.56,
      });
      const skyUpholstery = std({ color: 0x2563eb, roughness: 0.76 });
      const cobaltLightUpholstery = std({ color: 0x3b82f6, roughness: 0.74 });
      const amberFlightAccent = std({ color: 0xe67e22, roughness: 0.44, metalness: 0.18 });
      const cabinGlass = new THREE.MeshStandardMaterial({
        color: 0xd6eefc,
        roughness: 0.06,
        metalness: 0.1,
        transparent: true,
        opacity: 0.26,
        envMapIntensity: 0.78,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const travelCarpetTex = makeCanvasTex('travel_navy_runway_carpet', 256, 256, (g, W, H) => {
        g.fillStyle = '#182538';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#1e2f47';
        for (let y = 0; y < H; y += 16) {
          g.fillRect(0, y, W, 6);
        }
        g.strokeStyle = 'rgba(56,189,248,0.16)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, 128);
        g.lineTo(W, 128);
        g.stroke();
      });
      travelCarpetTex.wrapS = travelCarpetTex.wrapT = THREE.RepeatWrapping;
      travelCarpetTex.repeat.set(5, 5);
      const travelNavyCarpet = std({ map: travelCarpetTex, roughness: 0.94, metalness: 0.02 });

      const terrazzoTileTex = makeCanvasTex('travel_pearl_terrazzo', 256, 256, (g, W, H) => {
        g.fillStyle = '#ebe8e1';
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 110; i++) {
          const sx = ((i * 73) % 240) + 8;
          const sy = ((i * 137) % 240) + 8;
          g.fillStyle = i % 3 === 0 ? '#64748b' : i % 3 === 1 ? '#38bdf8' : '#c9bfa8';
          g.fillRect(sx, sy, 3 + (i % 4), 2 + (i % 3));
        }
      });
      terrazzoTileTex.wrapS = terrazzoTileTex.wrapT = THREE.RepeatWrapping;
      terrazzoTileTex.repeat.set(6, 6);
      const travelPearlTerrazzo = std({ map: terrazzoTileTex, roughness: 0.36, metalness: 0.06 });

      // Aviation Architectural Helpers
      const addTravelPlaque = (parent: THREE.Object3D, title: string, x: number, y: number, z: number, rotY = 0) => {
        const tex = makeCanvasTex(`travel_plaque_${title}`, 380, 76, (g, w, h) => {
          g.fillStyle = '#0f1c2e';
          rr(g, 2, 2, w - 4, h - 4, 10);
          g.fill();
          g.strokeStyle = '#38bdf8';
          g.lineWidth = 2.5;
          rr(g, 5, 5, w - 10, h - 10, 8);
          g.stroke();
          g.fillStyle = '#38bdf8';
          g.fillRect(16, 16, 6, h - 32);
          g.fillStyle = '#f8fafc';
          g.font = '800 19px "Plus Jakarta Sans", sans-serif';
          g.textAlign = 'left';
          g.textBaseline = 'middle';
          g.fillText(title, 34, h * 0.5);
        }, true, true);
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.48, 0.3),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
        );
        mesh.position.set(x, y, z);
        mesh.rotation.y = rotY;
        parent.add(mesh);
      };

      // Sculpted Swept Airfoil Ceiling Baffles for Aviation Levels
      const addAirfoilCeilingRibs = (parent: THREE.Object3D, baseCeilY: number, zPositions: number[]) => {
        const ribShape = new THREE.Shape();
        ribShape.moveTo(-7.2, 0.14);
        ribShape.quadraticCurveTo(0, -0.08, 7.2, 0.14);
        ribShape.lineTo(7.2, 0.24);
        ribShape.quadraticCurveTo(0, 0.04, -7.2, 0.24);
        ribShape.closePath();
        const ribGeo = new THREE.ExtrudeGeometry(ribShape, {
          depth: 0.18,
          bevelEnabled: true,
          bevelThickness: 0.015,
          bevelSize: 0.015,
          bevelSegments: 2,
          curveSegments: 14,
        });
        ribGeo.translate(0, 0, -0.09);
        zPositions.forEach((zPos) => {
          const m = new THREE.Mesh(ribGeo, M.white);
          m.position.set(spec.cx - 1.2, baseCeilY - 0.34, zPos);
          parent.add(m);
        });
      };

      // Rounded Aircraft-Cabin Porthole Window Partition Wall (ExtrudeGeometry)
      const addCabinWindowWall = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        len: number,
        h: number,
        winCount: number,
        rotY = 0
      ) => {
        const shape = new THREE.Shape();
        const hl = len * 0.5;
        shape.moveTo(-hl, 0);
        shape.lineTo(hl, 0);
        shape.lineTo(hl, h);
        shape.lineTo(-hl, h);
        shape.closePath();

        const spacing = len / (winCount + 0.4);
        for (let i = 0; i < winCount; i++) {
          const wx = -hl + spacing * (i + 0.7);
          const wy = h * 0.54;
          const ww = 0.26;
          const wh = 0.42;
          const r = 0.14;
          const hole = new THREE.Path();
          hole.moveTo(wx - ww + r, wy - wh);
          hole.lineTo(wx + ww - r, wy - wh);
          hole.absarc(wx + ww - r, wy - wh + r, r, -Math.PI / 2, 0, false);
          hole.lineTo(wx + ww, wy + wh - r);
          hole.absarc(wx + ww - r, wy + wh - r, r, 0, Math.PI / 2, false);
          hole.lineTo(wx - ww + r, wy + wh);
          hole.absarc(wx - ww + r, wy + wh - r, r, Math.PI / 2, Math.PI, false);
          hole.lineTo(wx - ww, wy - wh + r);
          hole.absarc(wx - ww + r, wy - wh + r, r, Math.PI, Math.PI * 1.5, false);
          shape.holes.push(hole);
        }

        const wallGeo = new THREE.ExtrudeGeometry(shape, {
          depth: 0.16,
          bevelEnabled: true,
          bevelThickness: 0.015,
          bevelSize: 0.015,
          bevelSegments: 2,
          curveSegments: 10,
        });
        wallGeo.translate(0, 0, -0.08);
        const wallMesh = new THREE.Mesh(wallGeo, M.white);
        wallMesh.position.set(x, y, z);
        wallMesh.rotation.y = rotY;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        parent.add(wallMesh);

        // Glazed strip sandwiched inside the porthole cutouts
        const glassPane = new THREE.Mesh(new THREE.BoxGeometry(len - 0.3, h * 0.45, 0.04), cabinGlass);
        glassPane.position.set(x, y + h * 0.54, z);
        glassPane.rotation.y = rotY;
        parent.add(glassPane);
      };

      // Multi-part Composite Swept-Wing Private Jet Scale Model (Group of 10 distinct parts)
      const buildJetScaleModel = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        sc: number,
        rotY: number,
        pitchRad = -0.18
      ) => {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        g.rotation.y = rotY;
        g.scale.setScalar(sc);

        // Titanium display pedestal
        cylAt(g, 0.56, 0.68, 0.14, 0, 0.07, 0, navyJetMat, true, true, 22);
        cylAt(g, 0.055, 0.09, 1.48, 0, 0.78, 0, titaniumMat, true, false, 12);

        const aircraft = new THREE.Group();
        aircraft.position.set(0, 1.56, 0);
        aircraft.rotation.x = pitchRad;
        // Fuselage body & nosecone
        const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 1.95, 16), M.white);
        fuse.rotation.x = Math.PI / 2;
        fuse.castShadow = true;
        aircraft.add(fuse);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.52, 16), M.white);
        nose.rotation.x = Math.PI / 2;
        nose.position.z = 1.23;
        aircraft.add(nose);
        // Dark cockpit windshield visor & cobalt livery belly stripe
        const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.24, 14, 1, false, -0.9, 1.8), navyJetMat);
        visor.rotation.x = Math.PI / 2;
        visor.position.set(0, 0.03, 0.96);
        aircraft.add(visor);
        boxAt(aircraft, 0.33, 0.04, 1.75, 0, -0.04, 0, skyUpholstery, false, false);
        // Swept main wings (left & right)
        [-1, 1].forEach((s) => {
          const wing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.035, 0.42), titaniumMat);
          wing.position.set(s * 0.64, -0.04, -0.05);
          wing.rotation.y = s * -0.44;
          wing.rotation.z = s * 0.06;
          wing.castShadow = true;
          aircraft.add(wing);
          // Winglet tip
          const wtip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.18), skyUpholstery);
          wtip.position.set(s * 1.16, 0.08, -0.3);
          aircraft.add(wtip);
          // Rear fuselage-mounted twin jet nacelles
          const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.062, 0.44, 12), titaniumMat);
          eng.rotation.x = Math.PI / 2;
          eng.position.set(s * 0.24, 0.07, -0.62);
          aircraft.add(eng);
        });
        // Swept vertical tail fin + horizontal T-tail
        const vTail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.52, 0.44), skyUpholstery);
        vTail.position.set(0, 0.32, -0.84);
        vTail.rotation.x = -0.38;
        aircraft.add(vTail);
        const hTail = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.03, 0.22), M.white);
        hTail.position.set(0, 0.52, -0.98);
        aircraft.add(hTail);

        g.add(aircraft);
        parent.add(g);
        return aircraft;
      };

      // Reusable aviation screens (for L1/L2/L3 walls & cabins)
      const radarScreen = createCustomBoardScreen(screenReg, 560, 260, (g, w, h, t) => {
        g.fillStyle = '#071322';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#0e2440';
        g.fillRect(0, 0, w, 34);
        g.fillStyle = '#38bdf8';
        g.fillRect(0, 0, 8, 34);
        g.fillStyle = '#f8fafc';
        g.font = '800 15px "Plus Jakarta Sans", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('SKYLINE OCC · LIVE GLOBAL FLIGHT RADAR & METAR TELEMETRY', 18, 17);

        // Stylized dark continent outlines + glowing great-circle flight arcs
        g.fillStyle = '#152d47';
        [
          [90, 95, 48, 32],
          [265, 130, 56, 62],
          [258, 72, 42, 22],
          [390, 96, 84, 42],
          [460, 185, 38, 22],
        ].forEach(([cxo, cyo, rx, ry]) => {
          g.beginPath();
          g.ellipse(cxo, cyo, rx, ry, 0.15, 0, Math.PI * 2);
          g.fill();
        });
        g.strokeStyle = '#38bdf8';
        g.lineWidth = 2;
        [
          [275, 145, 250, 70],
          [275, 145, 345, 118],
          [275, 145, 95, 92],
          [275, 145, 430, 128],
        ].forEach(([x0, y0, x1, y1], ai) => {
          g.beginPath();
          g.moveTo(x0, y0);
          g.quadraticCurveTo((x0 + x1) * 0.5, Math.min(y0, y1) - 36, x1, y1);
          g.stroke();
          const u = ((t * 0.25 + ai * 0.27) % 1);
          const qx = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * ((x0 + x1) * 0.5) + u * u * x1;
          const qy = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * (Math.min(y0, y1) - 36) + u * u * y1;
          g.fillStyle = '#facc15';
          g.beginPath();
          g.arc(qx, qy, 4.5, 0, Math.PI * 2);
          g.fill();
        });
        g.fillStyle = '#7dd3fc';
        g.font = '700 12px monospace';
        g.fillText('NBO HKJK 22°C · CAVOK · RWY 06 ACTIVE · 14 CHARTER LEGS AIRBORNE', 18, h - 18);
      });

      const allianceScreen = createCustomBoardScreen(screenReg, 520, 260, (g, w, h, t) => {
        g.fillStyle = '#091526';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#142b47';
        g.fillRect(0, 0, w, 38);
        g.fillStyle = '#e67e22';
        g.fillRect(0, 0, 8, 38);
        g.fillStyle = '#ffffff';
        g.font = '800 16px "Plus Jakarta Sans", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('SKYLINE AVIATION ALLIANCES · CHARTER & ROUTE NETWORK', 18, 19);
        const cards = [
          ['FLEET DISPATCH', '18 Aircraft', '99.4% OTP'],
          ['CORRIDOR PAX', '42.8K / Qtr', '+18.5% YoY'],
          ['GLOBAL HUBS', 'NBO · DXB · LHR', '24/7 Slots'],
        ];
        cards.forEach((c, ci) => {
          const x = 18 + ci * 165;
          g.fillStyle = '#112238';
          rr(g, x, 54, 152, 74, 8);
          g.fill();
          g.fillStyle = '#7dd3fc';
          g.font = '600 11px sans-serif';
          g.fillText(c[0], x + 10, 72);
          g.fillStyle = '#ffffff';
          g.font = '800 18px sans-serif';
          g.fillText(c[1], x + 10, 96);
          g.fillStyle = '#4ade80';
          g.font = '700 11px monospace';
          g.fillText(c[2], x + 10, 116);
        });
        const phase = Math.sin(t * 1.6) * 6;
        g.fillStyle = '#112238';
        rr(g, 18, 142, w - 36, 102, 8);
        g.fill();
        ['NBO-LHR', 'NBO-DXB', 'WIL-MRE', 'NBO-ZNZ', 'NBO-JNB'].forEach((lbl, bi) => {
          const bx = 36 + bi * 92;
          const bh = 42 + (bi % 3) * 14 + (bi % 2 === 0 ? phase : -phase);
          g.fillStyle = bi === 1 ? '#e67e22' : '#38bdf8';
          rr(g, bx, 224 - bh, 48, bh, 4);
          g.fill();
          g.fillStyle = '#cbd5e1';
          g.font = '600 11px monospace';
          g.textAlign = 'center';
          g.fillText(lbl, bx + 24, 236);
        });
        g.textAlign = 'left';
      });

      // -------------------------------------------------------------------------
      // FLOOR 0 (lv === 0): Departures Atrium, Compass Rotunda, Curved Check-In & Jet Gallery
      // -------------------------------------------------------------------------
      boxAt(g0, 27.4, 0.018, 17.4, spec.cx, fy + 0.009, spec.cz, travelPearlTerrazzo, false, true);
      // Aviation navy runway carpet strip under center & ticketing bays
      boxAt(g0, 10.6, 0.02, 5.8, spec.cx - 7.7, fy + 0.014, spec.cz + 4.4, travelNavyCarpet, false, true);
      boxAt(g0, 5.8, 0.02, 6.2, spec.cx + 6.2, fy + 0.014, spec.cz + 0.8, travelNavyCarpet, false, true);
      // Swept airfoil ceiling baffles across ground concourse
      addAirfoilCeilingRibs(levelCeilings[0], spec.groundY + spec.floorH - 0.14, [spec.cz - 4.8, spec.cz, spec.cz + 4.8]);

      // Center North Compass-Rose Medallion & Rotating Armillary World Globe
      const globeX = spec.cx;
      const globeZ = spec.cz - 2.2;
      cylAt(g0, 2.35, 2.35, 0.016, globeX, fy + 0.016, globeZ, navyJetMat, false, true, 32);
      cylAt(g0, 1.95, 1.95, 0.018, globeX, fy + 0.018, globeZ, travelPearlTerrazzo, false, true, 32);
      boxAt(g0, 4.1, 0.02, 0.08, globeX, fy + 0.022, globeZ, M.brass, false, false);
      boxAt(g0, 0.08, 0.02, 4.1, globeX, fy + 0.022, globeZ, M.brass, false, false);
      const globeMat = new THREE.MeshStandardMaterial({ map: globeTex, roughness: 0.34, metalness: 0.1 });
      const globe = new THREE.Mesh(new THREE.SphereGeometry(1.16, 28, 20), globeMat);
      globe.position.set(globeX, fy + 2.35, globeZ);
      globe.rotation.z = 0.22;
      g0.add(globe);
      const orbitalRing = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.032, 10, 40), M.brass);
      orbitalRing.position.set(globeX, fy + 2.35, globeZ);
      orbitalRing.rotation.set(Math.PI * 0.34, 0.4, 0);
      g0.add(orbitalRing);
      cylAt(g0, 0.05, 0.05, 1.1, globeX, fy + 3.4, globeZ, M.brass, false, false, 10);
      cylAt(g0, 0.9, 1.05, 0.22, globeX, fy + 0.11, globeZ, navyJetMat, true, true, 24);
      rotatingProps.push({ obj: globe, speed: 0.38, axis: 'y' });
      rotatingProps.push({ obj: orbitalRing, speed: -0.22, axis: 'y' });

      // West Wing: Aerodynamic Curved-End Ticketing & Visa Concierge Island + 3 Agents
      const chkX = spec.cx - 7.7;
      boxAt(g0, 8.8, 1.04, 0.56, chkX, fy + 0.52, spec.cz + 2.75, titaniumMat, true, true, 0.06);
      boxAt(g0, 9.0, 0.07, 0.64, chkX, fy + 1.06, spec.cz + 2.75, navyJetMat, false, false, 0.02);
      boxAt(g0, 8.6, 0.04, 0.04, chkX, fy + 0.52, spec.cz + 2.46, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), false, false);
      boxAt(g0, 8.8, 0.06, 0.92, chkX, fy + 0.75, spec.cz + 3.5, birchSlatMat, true, true, 0.02);
      [-11.8, -7.7, -3.6].forEach((lx) => {
        boxAt(g0, 0.14, 0.72, 0.78, spec.cx + lx, fy + 0.36, spec.cz + 3.45, titaniumMat, true, true, 0.01);
      });
      // Three recessed luggage weigh-in pads on front floor
      [-10.3, -7.7, -5.1].forEach((ox, i) => {
        boxAt(g0, 1.05, 0.04, 0.65, spec.cx + ox, fy + 0.025, spec.cz + 2.1, titaniumMat, false, true);
        registerChair(0, spec.cx + ox, fy, spec.cz + 4.35, Math.PI, i % 2 === 0 ? 1 : -1);
        registerMonitor(
          0,
          i,
          [spec.cx + ox, fy + 0.78, spec.cz + 3.56],
          0,
          spec.cx + ox,
          spec.cz + 4.35,
          i === 2 ? 'Corporate Ticketing Lead' : `Flight & Visa Agent ${i + 1}`,
          'Check-In & Ticketing Counter'
        );
      });
      addTravelPlaque(g0, 'CHECK-IN · BAGGAGE · VISA DESKS', chkX, fy + 2.6, spec.cz + 2.75, Math.PI);
      // 3 NW Self-Check-In Boarding Pass Kiosks along front-right glass
      [
        [spec.cx - 11.4, spec.cz - 5.2, Math.PI * 0.28],
        [spec.cx - 9.5, spec.cz - 5.9, Math.PI * 0.22],
        [spec.cx - 7.6, spec.cz - 6.3, Math.PI * 0.15],
      ].forEach(([kx, kz, krot]) => {
        const kg = new THREE.Group();
        kg.position.set(kx, fy, kz);
        kg.rotation.y = krot;
        boxAt(kg, 0.56, 1.38, 0.42, 0, 0.69, 0, titaniumMat, true, true, 0.04);
        boxAt(kg, 0.44, 0.34, 0.04, 0, 1.18, 0.22, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), false, false);
        boxAt(kg, 0.58, 0.08, 0.44, 0, 1.4, 0, amberFlightAccent, false, false);
        g0.add(kg);
      });
      // Rear luggage & travel brochure credenza along West South wall
      boxAt(g0, 6.2, 0.88, 0.68, chkX, fy + 0.44, spec.cz + 7.9, birchSlatMat, true, true, 0.02);

      // East Wing (dx +3.2..+9.4): Sculpted Executive Jet Scale Model + Charter Lounge Nook
      const jetModelTop = buildJetScaleModel(g0, spec.cx + 6.4, fy, spec.cz - 4.8, 1.08, -Math.PI * 0.72);
      rotatingProps.push({ obj: jetModelTop, speed: 0.24, axis: 'y' });
      const gcSofa1 = sofaWide(g0, spec.cx + 6.2, fy, spec.cz + 2.2, Math.PI, skyUpholstery, M);
      gcSofa1.scale.set(0.82, 0.94, 0.84);
      const gcSofa2 = sofaWide(g0, spec.cx + 6.2, fy, spec.cz - 0.6, 0, M.fabricCognac, M);
      gcSofa2.scale.set(0.82, 0.94, 0.84);
      cylAt(g0, 0.52, 0.52, 0.045, spec.cx + 6.2, fy + 0.42, spec.cz + 0.8, titaniumMat, true, true, 22);
      cylAt(g0, 0.08, 0.14, 0.4, spec.cx + 6.2, fy + 0.2, spec.cz + 0.8, navyJetMat, false, true, 14);
      plant(g0, spec.cx + 8.6, fy, spec.cz - 6.8, 1.25, 1201, M, 'olive');
      plant(g0, spec.cx + 8.6, fy, spec.cz + 6.9, 1.25, 1202, M, 'ficus');

      // South Feature Wall: Fuselage Cabin Window Art Panels + Live JKIA Departures Board
      addCabinWindowWall(g0, spec.cx - 8.6, fy, spec.cz + 8.32, 5.2, 3.05, 4, 0);
      addCabinWindowWall(g0, spec.cx + 6.4, fy, spec.cz + 8.32, 4.4, 3.05, 3, 0);
      const flBoard = createCustomBoardScreen(screenReg, 720, 240, (g, w, h, t) => {
        g.fillStyle = '#07111e';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#38bdf8';
        g.fillRect(0, 0, w, 36);
        g.fillStyle = '#07111e';
        g.font = '800 18px "Plus Jakarta Sans", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('SKYLINE TRAVEL & AVIATION · LIVE NBO (JKIA) DEPARTURES', 16, 18);
        const flights = [
          ['KQ 100', 'LONDON LHR', '23:15', 'GATE 04 · ON TIME'],
          ['EK 722', 'DUBAI DXB', '22:45', 'GATE 02 · CHECK-IN'],
          ['SA 185', 'JOHANNESBURG', '16:20', 'GATE 01 · BOARDING'],
          ['SKY 408', 'MARA CHOPPER', '14:10', 'CHARTER · READY'],
        ];
        flights.forEach((f, i) => {
          const y = 54 + i * 44;
          g.fillStyle = i === Math.floor(t / 2.5) % 4 ? 'rgba(56,189,248,0.2)' : 'rgba(56,189,248,0.08)';
          rr(g, 14, y, w - 28, 38, 6);
          g.fill();
          g.fillStyle = '#7dd3fc';
          g.font = '700 16px monospace';
          g.fillText(f[0], 26, y + 19);
          g.fillStyle = '#f8fafc';
          g.font = '700 16px sans-serif';
          g.fillText(f[1], 140, y + 19);
          g.fillStyle = '#cbd5e1';
          g.font = '600 16px monospace';
          g.fillText(f[2], 395, y + 19);
          g.fillStyle = i === Math.floor(t / 2.5) % 4 ? '#facc15' : '#4ade80';
          g.fillText(f[3], 490, y + 19);
        });
      });
      boxAt(g0, 7.6, 2.45, 0.14, spec.cx - 0.8, fy + 2.35, spec.cz + 8.65, frameDarkMat, false, false);
      const flMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.3, 2.2), flBoard.mat);
      flMesh.position.set(spec.cx - 0.8, fy + 2.35, spec.cz + 8.57);
      flMesh.rotation.y = Math.PI;
      g0.add(flMesh);
      flBoard.setMesh(flMesh);

      // -------------------------------------------------------------------------
      // FLOOR 1 (lv === 1): Private Jet Charter Atelier & Embassy Visa Concierge Suites
      // -------------------------------------------------------------------------
      const tg1 = levelGroups[1];
      if (tg1) {
        const tfy1 = spec.groundY + spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: tfy1 + 3.1,
          z: spec.cz,
          color: 0xf4f8ff,
          distance: 25,
          baseScale: 0.98,
          floor: 1,
          buildingId: spec.id,
        });

        // Non-overlapping flooring clearing East stair void (+10.25..+13.25 x -0.05..+3.75)
        boxAt(tg1, 27.0, 0.018, 8.45, spec.cx, tfy1 + 0.009, spec.cz - 4.375, travelPearlTerrazzo, false, true);
        boxAt(tg1, 23.6, 0.018, 4.2, spec.cx - 1.7, tfy1 + 0.009, spec.cz + 1.9, travelPearlTerrazzo, false, true);
        boxAt(tg1, 27.0, 0.018, 4.7, spec.cx, tfy1 + 0.009, spec.cz + 6.25, travelPearlTerrazzo, false, true);
        boxAt(tg1, 8.6, 0.02, 14.4, spec.cx - 8.6, tfy1 + 0.014, spec.cz + 0.2, travelNavyCarpet, false, true);
        boxAt(tg1, 5.4, 0.02, 5.4, spec.cx + 0.2, tfy1 + 0.014, spec.cz - 4.2, travelNavyCarpet, false, true);
        addAirfoilCeilingRibs(levelCeilings[1], spec.groundY + 2 * spec.floorH - 0.14, [spec.cz - 4.8, spec.cz + 4.8]);

        let t1MonIdx = 0;
        // West Wing: Aircraft Cabin-Window Acoustic Partition + 2 Flight Charter Pods
        addCabinWindowWall(tg1, spec.cx - 3.6, tfy1, spec.cz - 4.3, 6.2, 2.75, 4, Math.PI / 2);
        addCabinWindowWall(tg1, spec.cx - 3.6, tfy1, spec.cz + 4.0, 7.2, 2.75, 5, Math.PI / 2);
        addTravelPlaque(tg1, 'PRIVATE JET CHARTER ATELIER', spec.cx - 3.5, tfy1 + 2.48, spec.cz - 0.4, Math.PI / 2);

        const l1PodNorth = spec.cz - 4.2;
        const l1PodSouth = spec.cz + 3.0;
        const pod1X = spec.cx - 8.6;
        [l1PodNorth, l1PodSouth].forEach((pz, pi) => {
          makeDeskAt(tg1, pod1X, tfy1, pz, 3.2, 1.35, M);
          boxAt(tg1, 3.05, 0.3, 0.06, pod1X, tfy1 + 0.92, pz, skyUpholstery, false, false);
          boxAt(tg1, 2.8, 0.05, 0.12, pod1X, tfy1 + 2.68, pz, titaniumMat, false, false);
          boxAt(tg1, 2.68, 0.02, 0.07, pod1X, tfy1 + 2.65, pz, new THREE.MeshBasicMaterial({ color: 0xfff3d6 }), false, false);
          if (pi === 0) {
            registerChair(1, pod1X - 0.8, tfy1, pz - 1.05, 0, 1);
            registerMonitor(1, t1MonIdx++, [pod1X - 0.8, tfy1 + 0.77, pz - 0.25], Math.PI, pod1X - 0.8, pz - 1.05, 'Private Charter Director · L1', 'Charter Flight Atelier');
            officeChair(tg1, pod1X + 0.8, tfy1, pz - 1.05, 0, M);
            monitor(tg1, pod1X + 0.8, tfy1 + 0.77, pz - 0.25, true, Math.PI, M);
            officeChair(tg1, pod1X - 0.8, tfy1, pz + 1.05, Math.PI, M);
            monitor(tg1, pod1X - 0.8, tfy1 + 0.77, pz + 0.25, true, 0, M);
            officeChair(tg1, pod1X + 0.8, tfy1, pz + 1.05, Math.PI, M);
            monitor(tg1, pod1X + 0.8, tfy1 + 0.77, pz + 0.25, true, 0, M);
          } else {
            registerChair(1, pod1X + 0.8, tfy1, pz + 1.05, Math.PI, -1);
            registerMonitor(1, t1MonIdx++, [pod1X + 0.8, tfy1 + 0.77, pz + 0.25], 0, pod1X + 0.8, pz + 1.05, 'Group Aviation Coordinator · L1', 'Charter Flight Atelier');
            officeChair(tg1, pod1X - 0.8, tfy1, pz - 1.05, 0, M);
            monitor(tg1, pod1X - 0.8, tfy1 + 0.77, pz - 0.25, true, Math.PI, M);
            officeChair(tg1, pod1X + 0.8, tfy1, pz - 1.05, 0, M);
            monitor(tg1, pod1X + 0.8, tfy1 + 0.77, pz - 0.25, true, Math.PI, M);
            officeChair(tg1, pod1X - 0.8, tfy1, pz + 1.05, Math.PI, M);
            monitor(tg1, pod1X - 0.8, tfy1 + 0.77, pz + 0.25, true, 0, M);
          }
        });
        // West wall fleet matrix screen
        boxAt(tg1, 0.1, 1.9, 4.4, spec.cx - 13.7, tfy1 + 1.75, spec.cz - 0.6, frameDarkMat, false, false);
        const l1WestTv = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.74), allianceScreen.mat);
        l1WestTv.position.set(spec.cx - 13.63, tfy1 + 1.75, spec.cz - 0.6);
        l1WestTv.rotation.y = Math.PI / 2;
        tg1.add(l1WestTv);
        plant(tg1, spec.cx - 12.2, tfy1, spec.cz - 7.1, 1.25, 1203, M, 'olive');

        // Center Zone: Embassy Visa Consultation Booth & Registered Visa Desk
        cylAt(tg1, 0.78, 0.78, 0.05, spec.cx + 0.2, tfy1 + 0.74, spec.cz - 4.2, birchSlatMat, true, true, 24);
        cylAt(tg1, 0.14, 0.22, 0.72, spec.cx + 0.2, tfy1 + 0.36, spec.cz - 4.2, titaniumMat, true, true, 14);
        [
          [-0.95, 0, Math.PI / 2],
          [0.95, 0, -Math.PI / 2],
          [0, 0.95, Math.PI],
        ].forEach(([ox, oz, rot]) => {
          const ch = armchair(tg1, spec.cx + 0.2 + ox, tfy1, spec.cz - 4.2 + oz, rot, skyUpholstery, M);
          ch.scale.set(0.74, 0.88, 0.74);
        });
        makeDeskAt(tg1, spec.cx + 0.2, tfy1, spec.cz + 4.4, 2.6, 1.05, M);
        registerChair(1, spec.cx + 0.2, tfy1, spec.cz + 5.35, Math.PI, 1);
        registerMonitor(1, t1MonIdx++, [spec.cx + 0.2, tfy1 + 0.77, spec.cz + 4.55], 0, spec.cx + 0.2, spec.cz + 5.35, 'Senior Visa Specialist · L1', 'Embassy & Visa Concierge');
        [spec.cx - 0.55, spec.cx + 0.95].forEach((vx) => {
          const vc = armchair(tg1, vx, tfy1, spec.cz + 3.2, 0, M.fabricCognac, M);
          vc.scale.set(0.74, 0.88, 0.74);
        });

        // East Gallery: Route Map Display, Coffee Credenza & Lounge Bench (clear of East stairwell)
        boxAt(tg1, 4.4, 1.9, 0.1, spec.cx + 6.8, tfy1 + 1.85, spec.cz + 8.55, frameDarkMat, false, false);
        const l1RouteTv = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.74), radarScreen.mat);
        l1RouteTv.position.set(spec.cx + 6.8, tfy1 + 1.85, spec.cz + 8.48);
        l1RouteTv.rotation.y = Math.PI;
        tg1.add(l1RouteTv);
        boxAt(tg1, 3.2, 0.88, 0.72, spec.cx + 6.8, tfy1 + 0.44, spec.cz + 7.2, titaniumMat, true, true, 0.02);
        boxAt(tg1, 0.68, 0.46, 0.48, spec.cx + 6.8, tfy1 + 1.12, spec.cz + 7.2, M.dark, true, false, 0.02);
        const l1Bench = sofaWide(tg1, spec.cx + 6.8, tfy1, spec.cz - 4.8, 0, navyJetMat, M);
        l1Bench.scale.set(0.84, 0.92, 0.84);
        plant(tg1, spec.cx + 12.0, tfy1, spec.cz - 7.1, 1.25, 1204, M, 'ficus');
        plant(tg1, spec.cx + 12.0, tfy1, spec.cz + 7.1, 1.2, 1205, M, 'olive');
      }

      // -------------------------------------------------------------------------
      // FLOOR 2 (lv === 2): First-Class Cabin Experience Showroom & Live Dispatch Bridge
      // -------------------------------------------------------------------------
      const tg2 = levelGroups[2];
      if (tg2) {
        const tfy2 = spec.groundY + 2 * spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: tfy2 + 3.1,
          z: spec.cz,
          color: 0xf6f9ff,
          distance: 25,
          baseScale: 1.02,
          floor: 2,
          buildingId: spec.id,
        });

        boxAt(tg2, 27.0, 0.018, 8.45, spec.cx, tfy2 + 0.009, spec.cz - 4.375, travelPearlTerrazzo, false, true);
        boxAt(tg2, 23.6, 0.018, 4.2, spec.cx - 1.7, tfy2 + 0.009, spec.cz + 1.9, travelPearlTerrazzo, false, true);
        boxAt(tg2, 27.0, 0.018, 4.7, spec.cx, tfy2 + 0.009, spec.cz + 6.25, travelPearlTerrazzo, false, true);
        boxAt(tg2, 9.8, 0.02, 10.6, spec.cx - 8.2, tfy2 + 0.014, spec.cz - 2.6, travelNavyCarpet, false, true);
        boxAt(tg2, 5.2, 0.02, 6.8, spec.cx + 6.8, tfy2 + 0.014, spec.cz - 4.8, travelNavyCarpet, false, true);
        addAirfoilCeilingRibs(levelCeilings[2], spec.groundY + 3 * spec.floorH - 0.14, [spec.cz - 4.8, spec.cz + 4.8]);

        let t2MonIdx = 0;

        // West Wing: 3 Private First-Class Aircraft Suite Pods (reclined cognac sleeper seats, curved privacy shells & personal screens)
        const addFirstClassPod = (px: number, pz: number, rotY: number) => {
          const pod = new THREE.Group();
          pod.position.set(px, tfy2, pz);
          pod.rotation.y = rotY;
          // Curved privacy shell back + two side wings
          boxAt(pod, 2.25, 1.48, 0.14, 0, 0.74, -1.15, navyJetMat, true, true, 0.04);
          boxAt(pod, 0.14, 1.48, 2.25, -1.08, 0.74, -0.05, birchSlatMat, true, true, 0.03);
          boxAt(pod, 0.14, 1.48, 1.45, 1.08, 0.74, -0.45, birchSlatMat, true, true, 0.03);
          boxAt(pod, 2.22, 0.05, 0.18, 0, 1.5, -1.15, M.brass, false, false);
          // Flat-bed cognac lounger + ottoman + personal OLED entertainment screen
          const fcSeat = armchair(pod, -0.15, 0, -0.35, 0, M.fabricCognac, M);
          fcSeat.scale.set(0.95, 0.88, 1.08);
          boxAt(pod, 0.68, 0.36, 0.54, -0.15, 0.18, 0.72, M.fabricCognac, true, true, 0.04);
          boxAt(pod, 0.85, 0.48, 0.06, -0.15, 1.05, 1.02, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), false, false);
          cylAt(pod, 0.24, 0.24, 0.04, 0.68, 0.62, -0.25, titaniumMat, false, false, 14);
          tg2.add(pod);
        };
        addFirstClassPod(spec.cx - 10.6, spec.cz - 5.2, Math.PI / 2);
        addFirstClassPod(spec.cx - 10.6, spec.cz - 0.8, Math.PI / 2);
        addFirstClassPod(spec.cx - 5.2, spec.cz - 3.0, -Math.PI / 2);
        addTravelPlaque(tg2, 'FIRST-CLASS CABIN SHOWROOM', spec.cx - 8.2, tfy2 + 2.55, spec.cz - 8.1, 0);

        // SW In-Flight Champagne & Espresso Tasting Bar + 4 Barstools
        boxAt(tg2, 4.4, 0.92, 0.85, spec.cx - 8.2, tfy2 + 0.46, spec.cz + 8.15, navyJetMat, true, true, 0.02);
        boxAt(tg2, 4.2, 1.02, 0.88, spec.cx - 8.2, tfy2 + 0.51, spec.cz + 5.75, titaniumMat, true, true, 0.04);
        boxAt(tg2, 4.3, 0.06, 0.96, spec.cx - 8.2, tfy2 + 1.05, spec.cz + 5.75, birchSlatMat, false, true, 0.02);
        [-1.35, -0.45, 0.45, 1.35].forEach((ox) => {
          cylAt(tg2, 0.2, 0.2, 0.09, spec.cx - 8.2 + ox, tfy2 + 0.68, spec.cz + 4.75, cobaltLightUpholstery, true, true, 16);
          cylAt(tg2, 0.035, 0.035, 0.66, spec.cx - 8.2 + ox, tfy2 + 0.33, spec.cz + 4.75, titaniumMat, false, false, 10);
          cylAt(tg2, 0.17, 0.2, 0.04, spec.cx - 8.2 + ox, tfy2 + 0.02, spec.cz + 4.75, M.dark, false, true, 14);
        });

        // Center Bridge: Twin Wing-Shaped Air-Traffic & Operations Command Desks + Panoramic Radar Wall
        makeDeskAt(tg2, spec.cx + 0.8, tfy2, spec.cz - 3.6, 2.8, 1.15, M);
        registerChair(2, spec.cx + 0.8, tfy2, spec.cz - 4.55, 0, 1);
        registerMonitor(2, t2MonIdx++, [spec.cx + 0.8, tfy2 + 0.77, spec.cz - 3.75], Math.PI, spec.cx + 0.8, spec.cz - 4.55, 'Flight Dispatch Controller · L2', 'Operations Control Bridge');

        makeDeskAt(tg2, spec.cx + 0.8, tfy2, spec.cz + 1.8, 2.8, 1.15, M);
        registerChair(2, spec.cx + 0.8, tfy2, spec.cz + 2.75, Math.PI, -1);
        registerMonitor(2, t2MonIdx++, [spec.cx + 0.8, tfy2 + 0.77, spec.cz + 1.95], 0, spec.cx + 0.8, spec.cz + 2.75, 'Cabin Experience Curator · L2', 'Operations Control Bridge');

        boxAt(tg2, 5.4, 2.2, 0.12, spec.cx + 0.8, tfy2 + 2.0, spec.cz + 8.6, frameDarkMat, false, false);
        const l2RadarTv = new THREE.Mesh(new THREE.PlaneGeometry(5.15, 2.0), radarScreen.mat);
        l2RadarTv.position.set(spec.cx + 0.8, tfy2 + 2.0, spec.cz + 8.53);
        l2RadarTv.rotation.y = Math.PI;
        tg2.add(l2RadarTv);

        // East Panorama Observation Lounge & South Quiet Rest Alcove
        const l2Obs1 = armchair(tg2, spec.cx + 5.8, tfy2, spec.cz - 5.2, Math.PI * 0.82, cobaltLightUpholstery, M);
        l2Obs1.scale.set(0.76, 0.9, 0.76);
        const l2Obs2 = armchair(tg2, spec.cx + 7.8, tfy2, spec.cz - 5.2, -Math.PI * 0.82, cobaltLightUpholstery, M);
        l2Obs2.scale.set(0.76, 0.9, 0.76);
        cylAt(tg2, 0.42, 0.42, 0.04, spec.cx + 6.8, tfy2 + 0.44, spec.cz - 5.2, titaniumMat, true, true, 18);
        const l2RestSofa = sofaWide(tg2, spec.cx + 6.8, tfy2, spec.cz + 6.8, Math.PI, navyJetMat, M);
        l2RestSofa.scale.set(0.86, 0.94, 0.86);
        plant(tg2, spec.cx + 11.8, tfy2, spec.cz - 7.0, 1.25, 1206, M, 'olive');
        plant(tg2, spec.cx + 11.8, tfy2, spec.cz + 7.0, 1.25, 1207, M, 'ficus');
      }

      // -------------------------------------------------------------------------
      // FLOOR 3 (lv === 3): Executive Aviation Command, Alliances Boardroom, CEO & Head Office
      // -------------------------------------------------------------------------
      const tg3 = levelGroups[3];
      if (tg3) {
        const tfy3 = spec.groundY + 3 * spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: tfy3 + 3.15,
          z: spec.cz,
          color: 0xf6f9ff,
          distance: 26,
          baseScale: 1.07,
          floor: 3,
          buildingId: spec.id,
        });

        boxAt(tg3, 27.0, 0.018, 8.45, spec.cx, tfy3 + 0.009, spec.cz - 4.375, travelPearlTerrazzo, false, true);
        boxAt(tg3, 23.6, 0.018, 4.2, spec.cx - 1.7, tfy3 + 0.009, spec.cz + 1.9, travelPearlTerrazzo, false, true);
        boxAt(tg3, 27.0, 0.018, 4.7, spec.cx, tfy3 + 0.009, spec.cz + 6.25, travelPearlTerrazzo, false, true);
        boxAt(tg3, 7.6, 0.02, 10.6, spec.cx - 8.4, tfy3 + 0.014, spec.cz + 0.2, travelNavyCarpet, false, true);
        boxAt(tg3, 5.8, 0.02, 4.6, spec.cx + 0.8, tfy3 + 0.014, spec.cz + 5.4, travelNavyCarpet, false, true);
        boxAt(tg3, 4.2, 0.02, 3.6, spec.cx + 0.8, tfy3 + 0.014, spec.cz - 1.6, travelNavyCarpet, false, true);
        addAirfoilCeilingRibs(levelCeilings[3], spec.groundY + 4 * spec.floorH - 0.14, [spec.cz - 4.6, spec.cz + 4.6]);

        let t3MonIdx = 0;

        // 1. WEST WING (dx -13.5..-3.2): Airline Alliances & Routes Boardroom (12-seat elliptical airfoil table)
        const avBrWallX = spec.cx - 3.2;
        boxAt(tg3, 0.08, 2.95, 4.6, avBrWallX, tfy3 + 1.475, spec.cz - 4.3, cabinGlass, false, false);
        boxAt(tg3, 0.08, 2.95, 8.7, avBrWallX, tfy3 + 1.475, spec.cz + 4.15, cabinGlass, false, false);
        boxAt(tg3, 0.14, 0.14, 15.1, avBrWallX, tfy3 + 2.95, spec.cz + 0.95, titaniumMat, true, false);
        [-6.6, -2.0, -0.2, 2.4, 5.4, 8.5].forEach((mz) => {
          boxAt(tg3, 0.14, 2.96, 0.14, avBrWallX, tfy3 + 1.48, spec.cz + mz, navyJetMat, true, false);
        });
        addTravelPlaque(tg3, 'ALLIANCE BOARDROOM', avBrWallX + 0.1, tfy3 + 2.66, spec.cz - 1.1, Math.PI / 2);

        const avBrX = spec.cx - 8.4;
        const avBrZ = spec.cz + 0.2;
        // Elliptical satin-birch & navy inlay conference table (2.9m x 6.8m)
        const ellShape = new THREE.Shape();
        ellShape.absellipse(0, 0, 1.45, 3.4, 0, Math.PI * 2, false, 0);
        const ellGeo = new THREE.ExtrudeGeometry(ellShape, { depth: 0.075, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 24 });
        ellGeo.rotateX(-Math.PI / 2);
        const ellTop = new THREE.Mesh(ellGeo, birchSlatMat);
        ellTop.position.set(avBrX, tfy3 + 0.71, avBrZ);
        ellTop.castShadow = true;
        ellTop.receiveShadow = true;
        tg3.add(ellTop);
        boxAt(tg3, 0.42, 0.015, 5.0, avBrX, tfy3 + 0.79, avBrZ, navyJetMat, false, false);
        [-1.85, 1.85].forEach((pz) => {
          cylAt(tg3, 0.38, 0.5, 0.7, avBrX, tfy3 + 0.35, avBrZ + pz, titaniumMat, true, true, 16);
          // Circular halo titanium chandeliers
          const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.032, 10, 32), titaniumMat);
          halo.rotation.x = Math.PI / 2;
          halo.position.set(avBrX, tfy3 + 2.74, avBrZ + pz);
          tg3.add(halo);
          const haloGlow = new THREE.Mesh(new THREE.TorusGeometry(0.91, 0.016, 8, 28), new THREE.MeshBasicMaterial({ color: 0xe0f2fe }));
          haloGlow.rotation.x = Math.PI / 2;
          haloGlow.position.set(avBrX, tfy3 + 2.71, avBrZ + pz);
          tg3.add(haloGlow);
        });
        registerChair(3, avBrX, tfy3, avBrZ - 3.85, 0, 1);
        registerMonitor(3, t3MonIdx++, [avBrX, tfy3 + 0.79, avBrZ - 2.9], Math.PI, avBrX, avBrZ - 3.85, 'Airline Alliances Director · L3', 'Alliance Boardroom');
        registerChair(3, avBrX + 2.1, tfy3, avBrZ - 1.4, -Math.PI / 2, -1);
        registerMonitor(3, t3MonIdx++, [avBrX + 1.15, tfy3 + 0.79, avBrZ - 1.4], Math.PI / 2, avBrX + 2.1, avBrZ - 1.4, 'VP Flight Operations · L3', 'Alliance Boardroom');
        officeChair(tg3, avBrX, tfy3, avBrZ + 3.85, Math.PI, M);
        [-2.5, -0.2, 1.0, 2.2].forEach((czo) => officeChair(tg3, avBrX + 2.1, tfy3, avBrZ + czo, -Math.PI / 2, M));
        [-2.5, -1.4, -0.2, 1.0, 2.2].forEach((czo) => officeChair(tg3, avBrX - 2.1, tfy3, avBrZ + czo, Math.PI / 2, M));

        // West wall Alliance Network Screen & porthole flanking panels
        boxAt(tg3, 0.1, 2.0, 4.8, spec.cx - 13.7, tfy3 + 1.88, avBrZ, frameDarkMat, false, false);
        const l3BrTv = new THREE.Mesh(new THREE.PlaneGeometry(4.55, 1.82), allianceScreen.mat);
        l3BrTv.position.set(spec.cx - 13.63, tfy3 + 1.88, avBrZ);
        l3BrTv.rotation.y = Math.PI / 2;
        tg3.add(l3BrTv);
        plant(tg3, spec.cx - 12.2, tfy3, spec.cz - 7.1, 1.3, 1208, M, 'olive');
        plant(tg3, spec.cx - 12.2, tfy3, spec.cz + 7.1, 1.25, 1209, M, 'ficus');

        // 2. BACK CENTER (dx -2.8..+4.4, dz +2.2..+8.4): CEO & AVIATION COMMAND SUITE
        const ceoAvX = spec.cx + 0.8;
        const ceoAvFrontZ = spec.cz + 2.2;
        boxAt(tg3, 2.4, 2.95, 0.08, spec.cx - 1.6, tfy3 + 1.475, ceoAvFrontZ, cabinGlass, false, false);
        boxAt(tg3, 3.3, 2.95, 0.08, spec.cx + 2.75, tfy3 + 1.475, ceoAvFrontZ, cabinGlass, false, false);
        boxAt(tg3, 7.25, 0.14, 0.14, ceoAvX, tfy3 + 2.95, ceoAvFrontZ, titaniumMat, true, false);
        boxAt(tg3, 0.08, 2.95, 6.3, spec.cx + 4.4, tfy3 + 1.475, spec.cz + 5.35, cabinGlass, false, false);
        [-2.8, -0.4, 1.1, 4.4].forEach((px) => {
          boxAt(tg3, 0.14, 2.96, 0.14, spec.cx + px, tfy3 + 1.48, ceoAvFrontZ, navyJetMat, true, false);
        });
        addTravelPlaque(tg3, 'CEO · AVIATION COMMAND', spec.cx + 2.4, tfy3 + 2.66, ceoAvFrontZ - 0.09, Math.PI);

        // CEO South aircraft-model trophy wall + backlit shelving
        boxAt(tg3, 5.4, 2.9, 0.44, ceoAvX, tfy3 + 1.45, spec.cz + 8.36, navyJetMat, true, true, 0.02);
        [0.85, 1.65, 2.38].forEach((sy) => {
          boxAt(tg3, 4.8, 0.04, 0.36, ceoAvX, tfy3 + sy, spec.cz + 8.34, birchSlatMat, false, false);
        });
        buildJetScaleModel(tg3, spec.cx - 0.8, tfy3 + 1.67, spec.cz + 8.32, 0.32, Math.PI * 0.25, -0.1);
        buildJetScaleModel(tg3, spec.cx + 2.4, tfy3 + 1.67, spec.cz + 8.32, 0.32, -Math.PI * 0.25, -0.1);

        makeDeskAt(tg3, ceoAvX, tfy3, spec.cz + 5.75, 2.8, 1.12, M);
        boxAt(tg3, 2.9, 0.05, 0.12, ceoAvX, tfy3 + 0.77, spec.cz + 5.2, titaniumMat, false, false);
        registerChair(3, ceoAvX, tfy3, spec.cz + 6.72, Math.PI, -1);
        registerMonitor(3, t3MonIdx++, [ceoAvX, tfy3 + 0.77, spec.cz + 5.88], 0, ceoAvX, spec.cz + 6.72, 'Chief Aviation Officer & CEO · L3', 'CEO Aviation Command');
        [spec.cx + 0.05, spec.cx + 1.55].forEach((gx) => {
          const gc = armchair(tg3, gx, tfy3, spec.cz + 4.4, 0, M.fabricCognac, M);
          gc.scale.set(0.75, 0.88, 0.75);
        });
        plant(tg3, spec.cx + 3.7, tfy3, spec.cz + 7.5, 1.2, 1210, M, 'ficus');

        // 3. SOUTH-EAST CORNER (dx +4.8..+13.5, dz +4.3..+8.4): HEAD OF FLEET, SAFETY & CHARTER OFFICE
        const safetyZ = spec.cz + 4.3;
        boxAt(tg3, 1.2, 2.95, 0.08, spec.cx + 5.4, tfy3 + 1.475, safetyZ, cabinGlass, false, false);
        boxAt(tg3, 6.0, 2.95, 0.08, spec.cx + 10.5, tfy3 + 1.475, safetyZ, cabinGlass, false, false);
        boxAt(tg3, 8.75, 0.14, 0.14, spec.cx + 9.15, tfy3 + 2.95, safetyZ, titaniumMat, true, false);
        [4.8, 6.0, 7.5, 13.5].forEach((px) => {
          boxAt(tg3, 0.14, 2.96, 0.14, spec.cx + px, tfy3 + 1.48, safetyZ, navyJetMat, true, false);
        });
        addTravelPlaque(tg3, 'HEAD OF FLEET & SAFETY', spec.cx + 10.4, tfy3 + 2.66, safetyZ - 0.09, Math.PI);

        const safX = spec.cx + 9.2;
        makeDeskAt(tg3, safX, tfy3, spec.cz + 6.4, 2.4, 1.05, M);
        registerChair(3, safX, tfy3, spec.cz + 7.32, Math.PI, 1);
        registerMonitor(3, t3MonIdx++, [safX, tfy3 + 0.77, spec.cz + 6.48], 0, safX, spec.cz + 7.32, 'Head of Fleet & Safety · L3', 'Fleet & Safety Office');
        [safX - 0.75, safX + 0.75].forEach((vx) => {
          const vc = armchair(tg3, vx, tfy3, spec.cz + 5.15, 0, skyUpholstery, M);
          vc.scale.set(0.74, 0.88, 0.74);
        });
        boxAt(tg3, 2.1, 1.15, 0.08, safX, tfy3 + 1.85, spec.cz + 8.5, frameDarkMat, false, false);
        const safTv = new THREE.Mesh(new THREE.PlaneGeometry(1.94, 1.02), radarScreen.mat);
        safTv.position.set(safX, tfy3 + 1.85, spec.cz + 8.44);
        safTv.rotation.y = Math.PI;
        tg3.add(safTv);

        // 4. FRONT CENTER & NORTH-EAST: Flight Concierge, Sky Lounge & Galley Espresso Bar (clear of East stair core)
        makeDeskAt(tg3, ceoAvX, tfy3, spec.cz - 5.65, 2.2, 0.92, M);
        boxAt(tg3, 2.24, 0.96, 0.14, ceoAvX, tfy3 + 0.48, spec.cz - 5.18, titaniumMat, true, true, 0.02);
        registerChair(3, ceoAvX, tfy3, spec.cz - 6.55, 0, 1);
        registerMonitor(3, t3MonIdx++, [ceoAvX, tfy3 + 0.77, spec.cz - 5.75], Math.PI, ceoAvX, spec.cz - 6.55, 'Executive Flight Concierge · L3', 'Sky-Deck Reception');

        const skySofa = sofaWide(tg3, spec.cx - 0.75, tfy3, spec.cz - 1.6, Math.PI / 2, navyJetMat, M);
        skySofa.scale.set(0.76, 0.92, 0.84);
        cylAt(tg3, 0.5, 0.5, 0.04, spec.cx + 0.75, tfy3 + 0.41, spec.cz - 1.6, titaniumMat, true, true, 22);
        cylAt(tg3, 0.08, 0.14, 0.39, spec.cx + 0.75, tfy3 + 0.2, spec.cz - 1.6, navyJetMat, false, true, 14);
        const skyArm1 = armchair(tg3, spec.cx + 2.05, tfy3, spec.cz - 2.35, -Math.PI * 0.35, cobaltLightUpholstery, M);
        skyArm1.scale.set(0.74, 0.88, 0.74);
        const skyArm2 = armchair(tg3, spec.cx + 2.05, tfy3, spec.cz - 0.85, -Math.PI * 0.65, cobaltLightUpholstery, M);
        skyArm2.scale.set(0.74, 0.88, 0.74);
        plant(tg3, spec.cx + 3.6, tfy3, spec.cz + 1.2, 1.25, 1211, M, 'ficus');

        // North-East Galley Espresso Bar (cx + 11.2, cz - 5.8, safely 4.5m north of stair doorway)
        boxAt(tg3, 3.6, 0.94, 0.88, spec.cx + 11.2, tfy3 + 0.47, spec.cz - 5.8, navyJetMat, true, true, 0.03);
        boxAt(tg3, 3.68, 0.06, 0.94, spec.cx + 11.2, tfy3 + 0.97, spec.cz - 5.8, titaniumMat, false, true, 0.01);
        boxAt(tg3, 0.72, 0.48, 0.52, spec.cx + 11.2, tfy3 + 1.24, spec.cz - 5.8, M.dark, true, false, 0.02);
        [spec.cx + 10.4, spec.cx + 12.0].forEach((sx) => {
          cylAt(tg3, 0.2, 0.2, 0.09, sx, tfy3 + 0.68, spec.cz - 4.7, M.fabricCognac, true, true, 16);
          cylAt(tg3, 0.035, 0.035, 0.66, sx, tfy3 + 0.33, spec.cz - 4.7, titaniumMat, false, false, 10);
          cylAt(tg3, 0.17, 0.2, 0.04, sx, tfy3 + 0.02, spec.cz - 4.7, M.dark, false, true, 14);
        });
      }

      // -------------------------------------------------------------------------
      // CONTINUOUS EAST BOARDING STAIRWELL CORE (G -> L3) IN BRUSHED TITANIUM & BIRCH
      // -------------------------------------------------------------------------
      const avStairXWest = spec.cx + 10.22;
      const avStairXEast = spec.cx + 13.32;
      const avStairXMid = spec.cx + 11.75;
      const avStairZNorth = spec.cz - 1.32;
      const avStairZSouth = spec.cz + 3.82;
      const avStairW = avStairXEast - avStairXWest;
      const avStairD = avStairZSouth - avStairZNorth;
      const avStairCx = (avStairXWest + avStairXEast) * 0.5;
      const avStairCz = (avStairZNorth + avStairZSouth) * 0.5;
      const avBridgeZ = spec.cz - 0.05;
      const avHalfStartZ = spec.cz + 2.55;
      const avStairSigns = ['BOARDING STAIRS · G → L1', 'STAIRS · L1 ↔ L2', 'STAIRS · L2 ↔ L3', 'STAIRS · L3 SKY COMMAND'];

      const addAvRail = (parent: THREE.Object3D, x: number, y0: number, z0: number, y1: number, z1: number) => {
        const p0 = new THREE.Vector3(x, y0 + 0.92, z0);
        const p1 = new THREE.Vector3(x, y1 + 0.92, z1);
        const len = p0.distanceTo(p1);
        const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
        const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 10), titaniumMat);
        rail.position.copy(mid);
        rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        parent.add(rail);
        [0.15, 0.5, 0.85].forEach((t) => {
          const py = THREE.MathUtils.lerp(y0, y1, t);
          const pz = THREE.MathUtils.lerp(z0, z1, t);
          cylAt(parent, 0.014, 0.014, 0.92, x, py + 0.46, pz, titaniumMat, false, false, 8);
        });
      };

      for (let lv = 0; lv < spec.floors; lv++) {
        const lgS = levelGroups[lv];
        if (!lgS) continue;
        const fyS = spec.groundY + lv * spec.floorH + SLAB_THICK * 0.5;
        const wallH = spec.floorH - SLAB_THICK - 0.04;

        // North vestibule landing finish & cobalt-illuminated threshold strip
        boxAt(lgS, 3.0, 0.018, 1.24, avStairCx, fyS + 0.009, spec.cz - 0.68, travelPearlTerrazzo, false, true);
        boxAt(lgS, 0.14, 0.018, 1.2, avStairXWest, fyS + 0.012, spec.cz - 0.62, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), false, false);

        // East, North & South glazed titanium shaft walls
        boxAt(lgS, 0.1, 0.18, avStairD, avStairXEast, fyS + 0.09, avStairCz, navyJetMat, true, true);
        boxAt(lgS, 0.05, wallH - 0.24, avStairD, avStairXEast, fyS + 0.18 + (wallH - 0.24) * 0.5, avStairCz, cabinGlass, false, false);
        boxAt(lgS, 0.12, 0.12, avStairD, avStairXEast, fyS + wallH - 0.02, avStairCz, titaniumMat, false, false);
        [avStairZNorth, spec.cz + 1.25, avStairZSouth].forEach((mz) => {
          boxAt(lgS, 0.1, wallH, 0.1, avStairXEast, fyS + wallH * 0.5, mz, titaniumMat, true, false);
        });
        [avStairZNorth, avStairZSouth].forEach((wz) => {
          boxAt(lgS, avStairW, 0.18, 0.1, avStairCx, fyS + 0.09, wz, navyJetMat, true, true);
          boxAt(lgS, avStairW, wallH - 0.24, 0.05, avStairCx, fyS + 0.18 + (wallH - 0.24) * 0.5, wz, cabinGlass, false, false);
          boxAt(lgS, avStairW, 0.12, 0.12, avStairCx, fyS + wallH - 0.02, wz, titaniumMat, false, false);
          boxAt(lgS, 0.1, wallH, 0.1, avStairXMid, fyS + wallH * 0.5, wz, titaniumMat, true, false);
        });

        // West glass shaft wall south of doorway (dz = -0.02..+3.82 -> 3.84m)
        boxAt(lgS, 0.12, 0.36, 3.84, avStairXWest, fyS + 0.18, spec.cz + 1.9, navyJetMat, true, true);
        boxAt(lgS, 0.05, wallH - 0.42, 3.84, avStairXWest, fyS + 0.36 + (wallH - 0.42) * 0.5, spec.cz + 1.9, cabinGlass, false, false);
        boxAt(lgS, 0.12, 0.12, 3.84, avStairXWest, fyS + wallH - 0.02, spec.cz + 1.9, titaniumMat, false, false);
        boxAt(lgS, 0.1, wallH, 0.1, avStairXWest, fyS + wallH * 0.5, spec.cz + 1.9, titaniumMat, true, false);
        boxAt(lgS, 0.1, wallH, 0.1, avStairXWest, fyS + wallH * 0.5, avStairZSouth, titaniumMat, true, false);

        // Framed open Boarding Stairwell Door on West shaft face (dx = +10.22, dz = -1.25..+0.01)
        const doorZ = spec.cz - 0.62;
        const doorH = 2.42;
        [spec.cz - 1.25, spec.cz + 0.01].forEach((jz) => {
          boxAt(lgS, 0.15, wallH, 0.11, avStairXWest, fyS + wallH * 0.5, jz, titaniumMat, true, false, 0.01);
        });
        boxAt(lgS, 0.15, 0.12, 1.36, avStairXWest, fyS + doorH + 0.06, doorZ, navyJetMat, true, false, 0.01);
        const transomH = Math.max(0.3, wallH - doorH - 0.16);
        boxAt(lgS, 0.05, transomH, 1.18, avStairXWest, fyS + doorH + 0.12 + transomH * 0.5, doorZ, cabinGlass, false, false);

        // Swung-open titanium-stile & glazed door leaf (hinged at South jamb, swung out -X/+Z against glass)
        const doorLeaf = new THREE.Group();
        doorLeaf.position.set(avStairXWest - 0.02, fyS, spec.cz - 0.04);
        doorLeaf.rotation.y = 2.22;
        boxAt(doorLeaf, 0.055, doorH - 0.04, 0.09, 0, (doorH - 0.04) * 0.5 + 0.02, -0.045, titaniumMat, true, false);
        boxAt(doorLeaf, 0.055, doorH - 0.04, 0.09, 0, (doorH - 0.04) * 0.5 + 0.02, -1.08, titaniumMat, true, false);
        boxAt(doorLeaf, 0.055, 0.14, 1.12, 0, 0.09, -0.56, navyJetMat, true, false);
        boxAt(doorLeaf, 0.055, 0.12, 1.12, 0, doorH - 0.08, -0.56, navyJetMat, true, false);
        boxAt(doorLeaf, 0.028, doorH - 0.3, 0.96, 0, doorH * 0.5, -0.56, cabinGlass, false, false);
        cylAt(doorLeaf, 0.014, 0.014, 0.86, -0.055, 1.15, -0.98, M.brass, false, false, 10);
        cylAt(doorLeaf, 0.014, 0.014, 0.86, 0.055, 1.15, -0.98, M.brass, false, false, 10);
        lgS.add(doorLeaf);
        addTravelPlaque(lgS, avStairSigns[lv] ?? `STAIRS · L${lv}`, avStairXWest - 0.1, fyS + doorH + 0.34, doorZ, -Math.PI / 2);

        // Two-Flight Switchback Satin-Birch & Titanium Stairs (G->L1, L1->L2, L2->L3)
        if (lv < spec.floors - 1) {
          const steps = 8;
          const runLen = avHalfStartZ - avBridgeZ;
          const stepDepth = runLen / steps;
          const halfRise = spec.floorH * 0.5;
          const stepRise = halfRise / steps;
          const yMidLv = fyS + halfRise;
          const yTopLv = fyS + spec.floorH;

          // Flight 1 (East lane dx = +12.50, climbs Southward -0.05 -> +2.55)
          for (let st = 0; st < steps; st++) {
            const ty = fyS + (st + 0.5) * stepRise;
            const tz = avBridgeZ + (st + 0.5) * stepDepth;
            boxAt(lgS, 1.32, stepRise, stepDepth + 0.03, spec.cx + 12.5, ty, tz, navyJetMat, true, true, 0.008);
            boxAt(lgS, 1.35, 0.045, stepDepth + 0.04, spec.cx + 12.5, ty + stepRise * 0.5 + 0.01, tz, birchSlatMat, false, true, 0.008);
            boxAt(lgS, 1.35, 0.016, 0.035, spec.cx + 12.5, ty + stepRise * 0.5 + 0.028, tz - stepDepth * 0.45, skyUpholstery, false, false);
          }

          // South Half Landing (y = fyS + 2.10)
          boxAt(lgS, 2.94, 0.16, 1.22, avStairCx, yMidLv - 0.07, spec.cz + 3.16, navyJetMat, true, true, 0.015);
          boxAt(lgS, 2.9, 0.04, 1.18, avStairCx, yMidLv + 0.02, spec.cz + 3.16, birchSlatMat, false, true, 0.01);

          // Flight 2 (West lane dx = +10.98, climbs Northward +2.55 -> -0.05)
          for (let st = 0; st < steps; st++) {
            const ty = yMidLv + (st + 0.5) * stepRise;
            const tz = avHalfStartZ - (st + 0.5) * stepDepth;
            boxAt(lgS, 1.32, stepRise * 0.55, stepDepth + 0.03, spec.cx + 10.98, ty + stepRise * 0.22, tz, navyJetMat, true, true, 0.008);
            boxAt(lgS, 1.35, 0.045, stepDepth + 0.04, spec.cx + 10.98, ty + stepRise * 0.5 + 0.01, tz, birchSlatMat, false, true, 0.008);
            boxAt(lgS, 1.35, 0.016, 0.035, spec.cx + 10.98, ty + stepRise * 0.5 + 0.028, tz + stepDepth * 0.45, skyUpholstery, false, false);
          }

          addAvRail(lgS, spec.cx + 13.18, fyS, avBridgeZ, yMidLv, avHalfStartZ);
          addAvRail(lgS, spec.cx + 11.82, fyS, avBridgeZ, yMidLv, avHalfStartZ);
          addAvRail(lgS, spec.cx + 11.68, yMidLv, avHalfStartZ, yTopLv, avBridgeZ);
          addAvRail(lgS, spec.cx + 10.32, yMidLv, avHalfStartZ, yTopLv, avBridgeZ);
        }

        // Shaft balustrades (ground under-stair guard + upper-floor drop guardrails)
        if (lv === 0) {
          boxAt(lgS, 1.44, 1.45, 0.06, spec.cx + 10.98, fyS + 0.725, avBridgeZ, cabinGlass, false, false);
          boxAt(lgS, 0.06, 1.04, 2.6, avStairXMid, fyS + 0.52, spec.cz + 1.25, cabinGlass, false, false);
        } else {
          boxAt(lgS, 0.06, 1.04, 3.8, avStairXMid, fyS + 0.52, spec.cz + 1.85, cabinGlass, false, false);
          boxAt(lgS, 0.05, 1.04, 3.8, spec.cx + 13.24, fyS + 0.52, spec.cz + 1.85, cabinGlass, false, false);
          boxAt(lgS, 2.94, 1.04, 0.05, avStairCx, fyS + 0.52, spec.cz + 3.74, cabinGlass, false, false);
          if (lv === spec.floors - 1) {
            boxAt(lgS, 1.46, 1.04, 0.06, spec.cx + 12.5, fyS + 0.52, avBridgeZ, cabinGlass, false, false);
          }
        }
      }
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

      // -------------------------------------------------------------------------
      // SAFARI ARCHITECTURE PROCEDURAL TEXTURES & BESPOKE PBR MATERIALS
      // -------------------------------------------------------------------------
      const safariSandstoneTex = makeCanvasTex('safari_sandstone_floor', 256, 256, (g, W, H) => {
        g.fillStyle = '#d7c3a3';
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 160; i++) {
          const sx = ((i * 67) % 244) + 6;
          const sy = ((i * 113) % 244) + 6;
          g.fillStyle = i % 3 === 0 ? 'rgba(166,120,76,0.16)' : i % 3 === 1 ? 'rgba(242,228,204,0.22)' : 'rgba(130,94,58,0.12)';
          g.fillRect(sx, sy, 6 + (i % 8), 3 + (i % 5));
        }
        g.strokeStyle = 'rgba(122,95,66,0.28)';
        g.lineWidth = 2;
        [0, 128].forEach((p) => {
          g.beginPath();
          g.moveTo(p, 0);
          g.lineTo(p, H);
          g.stroke();
          g.beginPath();
          g.moveTo(0, p);
          g.lineTo(W, p);
          g.stroke();
        });
      });
      safariSandstoneTex.wrapS = safariSandstoneTex.wrapT = THREE.RepeatWrapping;
      safariSandstoneTex.repeat.set(7, 5);
      const safariStoneFloor = std({ map: safariSandstoneTex, roughness: 0.72, metalness: 0.03 });

      const acaciaWoodTex = makeCanvasTex('safari_acacia_wood', 256, 256, (g, W, H) => {
        const gr = g.createLinearGradient(0, 0, W, 0);
        gr.addColorStop(0, '#8f592c');
        gr.addColorStop(0.5, '#a86b38');
        gr.addColorStop(1, '#7c4b23');
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(54,28,10,0.26)';
        g.lineWidth = 1.6;
        for (let x = 8; x < W; x += 14) {
          g.beginPath();
          g.moveTo(x, 0);
          g.quadraticCurveTo(x + (x % 28 === 8 ? 5 : -5), H * 0.5, x, H);
          g.stroke();
        }
      });
      acaciaWoodTex.wrapS = acaciaWoodTex.wrapT = THREE.RepeatWrapping;
      acaciaWoodTex.repeat.set(3, 2);
      const safariAcaciaTimber = std({ map: acaciaWoodTex, roughness: 0.48, metalness: 0.04 });

      const sisalWeaveTex = makeCanvasTex('safari_sisal_weave', 256, 256, (g, W, H) => {
        g.fillStyle = '#c8b28e';
        g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(138,104,64,0.22)';
        for (let y = 0; y < H; y += 8) {
          g.fillRect(0, y, W, 3);
        }
        for (let x = 0; x < W; x += 12) {
          g.fillStyle = x % 24 === 0 ? 'rgba(92,66,38,0.16)' : 'rgba(235,218,188,0.18)';
          g.fillRect(x, 0, 4, H);
        }
        // Maasai crimson & olive border stripe accents
        g.fillStyle = '#8b2f21';
        g.fillRect(0, 8, W, 10);
        g.fillRect(0, H - 18, W, 10);
        g.fillStyle = '#4e6830';
        g.fillRect(0, 22, W, 5);
        g.fillRect(0, H - 27, W, 5);
      });
      sisalWeaveTex.wrapS = sisalWeaveTex.wrapT = THREE.RepeatWrapping;
      sisalWeaveTex.repeat.set(2, 2);
      const safariSisalRug = std({ map: sisalWeaveTex, roughness: 0.94, metalness: 0.01 });

      const wroughtBronze = std({ color: 0x2b231b, roughness: 0.34, metalness: 0.85 });
      const safariCanvasMat = std({ color: 0xefe6d4, roughness: 0.91, metalness: 0.01, side: THREE.DoubleSide });
      const terracottaClay = std({ color: 0xb45b36, roughness: 0.82, metalness: 0.03 });
      const savannaOlive = std({ color: 0x4f6632, roughness: 0.86, metalness: 0.02 });
      const wovenRattan = std({ color: 0xb88b52, roughness: 0.84, metalness: 0.02 });
      const safariCopper = std({ color: 0xb96a38, roughness: 0.28, metalness: 0.88 });
      const basaltRockMat = std({ color: 0x2c2b29, roughness: 0.86, metalness: 0.06 });
      const safariGlass = new THREE.MeshStandardMaterial({
        color: 0xdff2e4,
        roughness: 0.08,
        metalness: 0.1,
        transparent: true,
        opacity: 0.22,
        envMapIntensity: 0.78,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      // Architectural Helpers exclusive to Kenya Safari & Tourism
      const addSafariPlaque = (parent: THREE.Object3D, title: string, x: number, y: number, z: number, rotY = 0) => {
        const tex = makeCanvasTex(`safari_plaque_${title}`, 380, 76, (g, w, h) => {
          g.fillStyle = '#1e1914';
          rr(g, 2, 2, w - 4, h - 4, 8);
          g.fill();
          g.strokeStyle = '#84cc16';
          g.lineWidth = 2.5;
          rr(g, 5, 5, w - 10, h - 10, 6);
          g.stroke();
          g.fillStyle = '#b45b36';
          g.fillRect(14, 14, 7, h - 28);
          g.fillStyle = '#f5eedc';
          g.font = '800 18px "Plus Jakarta Sans", sans-serif';
          g.textAlign = 'left';
          g.textBaseline = 'middle';
          g.fillText(title, 32, h * 0.5);
        }, true, true);
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.48, 0.3),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
        );
        mesh.position.set(x, y, z);
        mesh.rotation.y = rotY;
        parent.add(mesh);
      };

      // Acacia Timber Pergola Ceiling Beams & Draped Canvas Sails
      const addSafariTimberCeiling = (parent: THREE.Object3D, ceilTopY: number, zBays: number[], withCanvasSails = false) => {
        zBays.forEach((zb) => {
          boxAt(parent, spec.w - 3.0, 0.16, 0.22, spec.cx, ceilTopY - 0.16, zb, safariAcaciaTimber, true, false);
        });
        [-9.5, -3.2, 3.2, 9.5].forEach((xb) => {
          boxAt(parent, 0.14, 0.1, spec.d - 2.6, spec.cx + xb, ceilTopY - 0.24, spec.cz, wroughtBronze, false, false);
        });
        if (withCanvasSails) {
          [-6.2, 0.8].forEach((sx) => {
            const sailShape = new THREE.Shape();
            sailShape.moveTo(-4.8, 0.12);
            sailShape.quadraticCurveTo(0, -0.34, 4.8, 0.12);
            const sailPts = sailShape.getPoints(14);
            const sailCurve = new THREE.CatmullRomCurve3(sailPts.map((p) => new THREE.Vector3(p.x, p.y, 0)));
            const extrudeGeo = new THREE.PlaneGeometry(9.6, 4.8, 12, 1);
            const pos = extrudeGeo.attributes.position;
            for (let vi = 0; vi < pos.count; vi++) {
              const px = pos.getX(vi);
              const tNorm = (px + 4.8) / 9.6;
              pos.setZ(vi, Math.sin(tNorm * Math.PI) * -0.28);
            }
            extrudeGeo.computeVertexNormals();
            const sail = new THREE.Mesh(extrudeGeo, safariCanvasMat);
            sail.rotation.x = Math.PI / 2;
            sail.position.set(spec.cx + sx, ceilTopY - 0.28, spec.cz - 1.2);
            parent.add(sail);
            void sailCurve;
          });
        }
      };

      // Arched Terracotta Adobe & Vertical Acacia Louver Partition (ExtrudeGeometry)
      const addArchedSafariWall = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        len: number,
        h: number,
        archCount: number,
        rotY = 0
      ) => {
        const shape = new THREE.Shape();
        const hl = len * 0.5;
        shape.moveTo(-hl, 0);
        shape.lineTo(hl, 0);
        shape.lineTo(hl, h);
        shape.lineTo(-hl, h);
        shape.closePath();

        const spacing = len / (archCount + 0.35);
        for (let i = 0; i < archCount; i++) {
          const ax = -hl + spacing * (i + 0.675);
          const aw = 0.42;
          const baseY = 0.62;
          const topY = h - 0.62;
          const hole = new THREE.Path();
          hole.moveTo(ax - aw, baseY);
          hole.lineTo(ax + aw, baseY);
          hole.lineTo(ax + aw, topY);
          hole.absarc(ax, topY, aw, 0, Math.PI, false);
          hole.lineTo(ax - aw, baseY);
          shape.holes.push(hole);
        }

        const wallGeo = new THREE.ExtrudeGeometry(shape, {
          depth: 0.2,
          bevelEnabled: true,
          bevelThickness: 0.02,
          bevelSize: 0.02,
          bevelSegments: 2,
          curveSegments: 12,
        });
        wallGeo.translate(0, 0, -0.1);
        const wallMesh = new THREE.Mesh(wallGeo, terracottaClay);
        wallMesh.position.set(x, y, z);
        wallMesh.rotation.y = rotY;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        parent.add(wallMesh);

        // Vertical acacia timber louver fins centered in each arch
        for (let i = 0; i < archCount; i++) {
          const ax = -hl + spacing * (i + 0.675);
          [-0.18, 0, 0.18].forEach((fo) => {
            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.045, h - 1.05, 0.08), safariAcaciaTimber);
            const lx = ax + fo;
            const sinR = Math.sin(rotY);
            const cosR = Math.cos(rotY);
            fin.position.set(x + lx * cosR, y + 0.62 + (h - 1.05) * 0.5, z - lx * sinR);
            fin.rotation.y = rotY;
            parent.add(fin);
          });
        }
      };

      // Sculpted Tiered Woven-Basket Bell Pendant Lamp (LatheGeometry)
      const addWovenBellLamp = (parent: THREE.Object3D, x: number, yCeil: number, z: number, scale = 1) => {
        const grp = new THREE.Group();
        grp.position.set(x, yCeil, z);
        grp.scale.setScalar(scale);
        cylAt(grp, 0.012, 0.012, 0.72, 0, -0.36, 0, wroughtBronze, false, false, 8);
        const pts = [
          new THREE.Vector2(0.06, 0.42),
          new THREE.Vector2(0.18, 0.34),
          new THREE.Vector2(0.38, 0.14),
          new THREE.Vector2(0.46, 0.0),
          new THREE.Vector2(0.42, 0.0),
          new THREE.Vector2(0.15, 0.32),
        ];
        const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), wovenRattan);
        bell.position.y = -1.08;
        bell.castShadow = true;
        grp.add(bell);
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 12, 10),
          new THREE.MeshBasicMaterial({ color: 0xffdf9e })
        );
        bulb.position.y = -0.98;
        grp.add(bulb);
        parent.add(grp);
      };

      // Multi-Part Sculpted Bronze Savannah Giraffe & Acacia Silhouette Sculpture (Group of 10 parts)
      const addBronzeGiraffeSculpture = (parent: THREE.Object3D, x: number, y: number, z: number, sc = 1, rotY = 0) => {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        g.rotation.y = rotY;
        g.scale.setScalar(sc);
        // Dark basalt + acacia museum plinth
        boxAt(g, 0.96, 0.78, 0.96, 0, 0.39, 0, basaltRockMat, true, true, 0.03);
        boxAt(g, 1.04, 0.06, 1.04, 0, 0.81, 0, safariAcaciaTimber, false, true, 0.015);
        // Sculpted bronze giraffe standing tall
        const bronzeMat = std({ color: 0x7b562e, roughness: 0.28, metalness: 0.86 });
        const fig = new THREE.Group();
        fig.position.y = 0.84;
        // 4 slender legs
        [
          [-0.1, 0.16],
          [0.1, 0.16],
          [-0.09, -0.18],
          [0.09, -0.18],
        ].forEach(([lx, lz]) => {
          cylAt(fig, 0.022, 0.028, 0.56, lx, 0.28, lz, bronzeMat, true, false, 8);
        });
        // Torso
        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.32, 6, 12), bronzeMat);
        torso.rotation.x = Math.PI / 2;
        torso.position.set(0, 0.58, 0);
        torso.castShadow = true;
        fig.add(torso);
        // Long graceful neck
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.08, 0.68, 12), bronzeMat);
        neck.position.set(0, 0.92, 0.24);
        neck.rotation.x = 0.22;
        neck.castShadow = true;
        fig.add(neck);
        // Head + ossicone horns
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.22), bronzeMat);
        head.position.set(0, 1.24, 0.36);
        head.rotation.x = 0.15;
        fig.add(head);
        [-0.025, 0.025].forEach((ox) => {
          cylAt(fig, 0.01, 0.012, 0.08, ox, 1.32, 0.31, safariCopper, false, false, 6);
        });
        g.add(fig);
        parent.add(g);
      };

      // Terracotta Amphora Urn with Tall Savannah Reeds
      const addTerracottaUrn = (parent: THREE.Object3D, x: number, y: number, z: number) => {
        const pts = [
          new THREE.Vector2(0.01, 0),
          new THREE.Vector2(0.18, 0.02),
          new THREE.Vector2(0.28, 0.28),
          new THREE.Vector2(0.24, 0.56),
          new THREE.Vector2(0.14, 0.7),
          new THREE.Vector2(0.19, 0.76),
        ];
        const urn = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), terracottaClay);
        urn.position.set(x, y, z);
        urn.castShadow = true;
        urn.receiveShadow = true;
        parent.add(urn);
        [-0.06, 0, 0.07].forEach((ro, ri) => {
          const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.75 + ri * 0.12, 6), savannaOlive);
          reed.position.set(x + ro, y + 0.96, z + (ri - 1) * 0.04);
          reed.rotation.z = (ri - 1) * 0.16;
          parent.add(reed);
        });
      };

      // Reusable Dynamic Safari Telemetry Screens
      const conservancyScreen = createCustomBoardScreen(screenReg, 680, 240, (g, w, h, t) => {
        g.fillStyle = '#121810';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#4f6632';
        g.fillRect(0, 0, w, 38);
        g.fillStyle = '#b45b36';
        g.fillRect(0, 0, 10, 38);
        g.fillStyle = '#f5eedc';
        g.font = '800 17px "Plus Jakarta Sans", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('KENYA SAFARI & TOURISM · CONSERVANCY, MIGRATION & LODGE TELEMETRY', 20, 19);
        const parks = [
          ['Maasai Mara Reserve', 'Great Migration Crossing', '94% Camp Occ.'],
          ['Amboseli & Kilimanjaro', 'Clear Peak Visibility', '6 Cruisers Out'],
          ['Samburu & Laikipia', 'Wild Dog Tracking Open', 'Guides Briefed'],
          ['Diani & Lamu Coast', 'Monsoon Calm · Dhow Ready', '88% Villa Occ.'],
        ];
        parks.forEach((p, i) => {
          const y = 54 + i * 44;
          g.fillStyle = i === Math.floor(t / 3.0) % 4 ? 'rgba(132,204,22,0.22)' : 'rgba(255,255,255,0.06)';
          rr(g, 16, y, w - 32, 36, 6);
          g.fill();
          g.fillStyle = '#f8fafc';
          g.font = '700 15px sans-serif';
          g.fillText(p[0], 28, y + 18);
          g.fillStyle = '#bef264';
          g.font = '600 14px sans-serif';
          g.fillText(p[1], 295, y + 18);
          g.fillStyle = '#fde68a';
          g.textAlign = 'right';
          g.fillText(p[2], w - 28, y + 18);
          g.textAlign = 'left';
        });
      });

      const migrationMapScreen = createCustomBoardScreen(screenReg, 520, 260, (g, w, h, t) => {
        g.fillStyle = '#181410';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#2c231a';
        g.fillRect(0, 0, w, 36);
        g.fillStyle = '#84cc16';
        g.fillRect(0, 0, 8, 36);
        g.fillStyle = '#f5eedc';
        g.font = '800 15px "Plus Jakarta Sans", sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('RIFT VALLEY EXPEDITION MATRIX · TRACKED 4X4 CONVOYS', 18, 18);
        // Stylized Kenya savanna silhouette & circuit trails
        g.fillStyle = '#2d3b20';
        g.beginPath();
        g.moveTo(110, 56);
        g.lineTo(310, 48);
        g.lineTo(410, 128);
        g.lineTo(335, 224);
        g.lineTo(145, 205);
        g.closePath();
        g.fill();
        const nodes: Array<[number, number, string]> = [
          [175, 165, 'MAASAI MARA'],
          [265, 132, 'NAIVASHA'],
          [295, 188, 'AMBOSELI'],
          [282, 92, 'SAMBURU'],
          [372, 206, 'DIANI COAST'],
        ];
        g.strokeStyle = '#d97706';
        g.lineWidth = 2.5;
        g.beginPath();
        nodes.forEach(([nx, ny], ni) => (ni === 0 ? g.moveTo(nx, ny) : g.lineTo(nx, ny)));
        g.stroke();
        nodes.forEach(([nx, ny, lbl], ni) => {
          const pulse = ni === Math.floor(t * 0.9) % nodes.length;
          g.fillStyle = pulse ? '#facc15' : '#84cc16';
          g.beginPath();
          g.arc(nx, ny, pulse ? 6.5 : 4.5, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#f5eedc';
          g.font = '700 11px monospace';
          g.fillText(lbl, nx + 10, ny + 3);
        });
      });

      // -------------------------------------------------------------------------
      // FLOOR 0 (G): Safari Arrival Pavilion, Kenya 3D Relief Table, 4x4 Cruiser & Bush Lounge
      // -------------------------------------------------------------------------
      boxAt(g0, 29.2, 0.018, 17.4, spec.cx, fy + 0.009, spec.cz, safariStoneFloor, false, true);
      boxAt(g0, 5.4, 0.02, 5.8, spec.cx - 11.4, fy + 0.014, spec.cz + 1.8, safariSisalRug, false, true);
      boxAt(g0, 11.6, 0.02, 4.0, spec.cx - 0.8, fy + 0.014, spec.cz + 5.6, safariSisalRug, false, true);
      addSafariTimberCeiling(levelCeilings[0], spec.groundY + spec.floorH - 0.14, [spec.cz - 5.2, spec.cz - 1.2, spec.cz + 2.8, spec.cz + 6.4], true);

      // Monumental 3D Topographical Kenya & Great Rift Valley Relief Table (cx - 5.2, cz - 1.2)
      const mapX = spec.cx - 5.2;
      const mapZ = spec.cz - 1.2;
      boxAt(g0, 4.8, 0.8, 2.8, mapX, fy + 0.4, mapZ, safariAcaciaTimber, true, true, 0.05);
      boxAt(g0, 4.92, 0.06, 2.92, mapX, fy + 0.81, mapZ, wroughtBronze, false, true, 0.02);
      boxAt(g0, 4.4, 0.08, 2.4, mapX, fy + 0.85, mapZ, std({ color: 0x4b773c, roughness: 0.88 }), false, true);
      // Great Rift Valley turquoise lake trench & stepped highland ridges + snow-capped Mt. Kenya
      boxAt(g0, 0.48, 0.03, 1.9, mapX - 0.85, fy + 0.895, mapZ, std({ color: 0x1e88a8, roughness: 0.22 }), false, false);
      boxAt(g0, 1.65, 0.16, 1.15, mapX - 0.4, fy + 0.96, mapZ - 0.35, std({ color: 0x6f9448, roughness: 0.88 }), false, false, 0.04);
      cylAt(g0, 0.14, 0.72, 0.48, mapX + 0.65, fy + 1.12, mapZ + 0.15, basaltRockMat, true, false, 7);
      cylAt(g0, 0.02, 0.26, 0.2, mapX + 0.65, fy + 1.38, mapZ + 0.15, M.white, false, false, 7);
      addSafariPlaque(g0, 'MT. KENYA & RIFT RELIEF', mapX, fy + 0.42, mapZ + 1.44, 0);

      // East-Front Raised Basalt Showcase Plinth + Expedition 4x4 Safari Cruiser
      const jeep = makeCar(0x4b5c34, 'suv', { safari: true, plateText: 'MARA 4X4' });
      jeep.position.set(spec.cx + 6.4, fy + 0.12, spec.cz - 2.8);
      jeep.rotation.y = -0.62;
      g0.add(jeep);
      cylAt(g0, 2.75, 2.9, 0.12, spec.cx + 6.4, fy + 0.06, spec.cz - 2.8, basaltRockMat, false, true, 24);

      // West Wing: Savannah Bush Camp Lounge, Sculpted Giraffe Pedestal & Terracotta Urns
      addBronzeGiraffeSculpture(g0, spec.cx - 11.8, fy, spec.cz - 4.8, 1.0, 0.35);
      const gSofa = sofaWide(g0, spec.cx - 12.6, fy, spec.cz + 1.8, Math.PI / 2, M.fabricCognac, M);
      gSofa.scale.set(0.84, 0.92, 0.84);
      const gArm1 = armchair(g0, spec.cx - 10.2, fy, spec.cz + 0.8, -Math.PI * 0.7, wovenRattan, M);
      gArm1.scale.set(0.76, 0.88, 0.76);
      const gArm2 = armchair(g0, spec.cx - 10.2, fy, spec.cz + 2.8, -Math.PI * 0.3, wovenRattan, M);
      gArm2.scale.set(0.76, 0.88, 0.76);
      cylAt(g0, 0.52, 0.56, 0.42, spec.cx - 11.2, fy + 0.21, spec.cz + 1.8, safariAcaciaTimber, true, true, 16);
      addTerracottaUrn(g0, spec.cx - 13.6, fy, spec.cz - 6.8);
      addTerracottaUrn(g0, spec.cx - 13.6, fy, spec.cz + 7.0);

      // South Zone: 3 Hand-Crafted Acacia Safari Concierge Desks (dx -5.2, -0.8, +3.6)
      [-5.2, -0.8, 3.6].forEach((ox, i) => {
        const dz = spec.cz + 5.2;
        boxAt(g0, 2.55, 0.065, 1.05, spec.cx + ox, fy + 0.75, dz, safariAcaciaTimber, true, true, 0.02);
        boxAt(g0, 2.38, 0.72, 0.14, spec.cx + ox, fy + 0.36, dz - 0.38, terracottaClay, true, true, 0.01);
        [-1.08, 1.08].forEach((lx) => {
          boxAt(g0, 0.08, 0.72, 0.82, spec.cx + ox + lx, fy + 0.36, dz, wroughtBronze, true, true, 0.01);
        });
        registerChair(0, spec.cx + ox, fy, dz + 0.88, Math.PI, i % 2 === 0 ? 1 : -1);
        registerMonitor(
          0,
          i,
          [spec.cx + ox, fy + 0.79, dz - 0.15],
          0,
          spec.cx + ox,
          dz + 0.88,
          i === 0 ? 'Safari Expedition Planner' : i === 1 ? 'Eco-Lodge Concierge' : 'Conservancy & Bush-Flight Specialist',
          'Safari Gallery & Expeditions'
        );
      });
      plant(g0, spec.cx + 8.6, fy, spec.cz + 6.8, 1.25, 1301, M, 'olive');

      // South Wall Live Kenya Wildlife & Conservancy Board (centered west of SE stairwell at cx - 0.8)
      boxAt(g0, 7.2, 2.35, 0.14, spec.cx - 0.8, fy + 2.35, spec.cz + 8.7, wroughtBronze, false, false);
      const sfMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.9, 2.1), conservancyScreen.mat);
      sfMesh.position.set(spec.cx - 0.8, fy + 2.35, spec.cz + 8.61);
      sfMesh.rotation.y = Math.PI;
      g0.add(sfMesh);
      conservancyScreen.setMesh(sfMesh);

      // -------------------------------------------------------------------------
      // FLOOR 1 (L1): Maasai Mara Conservancy Studio, Outfitter & Storyteller Hearth
      // -------------------------------------------------------------------------
      const sg1 = levelGroups[1];
      if (sg1) {
        const sfy1 = spec.groundY + spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: sfy1 + 3.1,
          z: spec.cz,
          color: 0xffe9c8,
          distance: 26,
          baseScale: 1.03,
          floor: 1,
          buildingId: spec.id,
        });

        // Non-overlapping flooring clearing SE stair void (+11.22..+14.28 x +4.15..+7.95)
        boxAt(sg1, 29.2, 0.018, 12.85, spec.cx, sfy1 + 0.009, spec.cz - 2.275, safariStoneFloor, false, true);
        boxAt(sg1, 25.8, 0.018, 4.55, spec.cx - 1.7, sfy1 + 0.009, spec.cz + 6.425, safariStoneFloor, false, true);
        boxAt(sg1, 3.4, 0.018, 0.75, spec.cx + 12.9, sfy1 + 0.009, spec.cz + 8.325, safariStoneFloor, false, true);
        boxAt(sg1, 8.6, 0.02, 13.4, spec.cx - 9.0, sfy1 + 0.014, spec.cz - 0.4, safariSisalRug, false, true);
        boxAt(sg1, 5.2, 0.02, 4.8, spec.cx + 1.0, sfy1 + 0.014, spec.cz - 3.6, safariSisalRug, false, true);
        addSafariTimberCeiling(levelCeilings[1], spec.groundY + 2 * spec.floorH - 0.14, [spec.cz - 4.8, spec.cz + 4.8]);

        let s1MonIdx = 0;

        // West Wing: Arched Terracotta & Acacia-Louver Partition (open archway dz -1.2..+0.6)
        addArchedSafariWall(sg1, spec.cx - 3.5, sfy1, spec.cz - 4.6, 6.8, 2.75, 4, Math.PI / 2);
        addArchedSafariWall(sg1, spec.cx - 3.5, sfy1, spec.cz + 4.3, 7.4, 2.75, 4, Math.PI / 2);
        addSafariPlaque(sg1, 'MARA ITINERARY ATELIER', spec.cx - 3.35, sfy1 + 2.48, spec.cz - 0.3, Math.PI / 2);

        const s1PodX = spec.cx - 9.0;
        [spec.cz - 4.0, spec.cz + 3.2].forEach((pz, pi) => {
          boxAt(sg1, 3.3, 0.06, 1.38, s1PodX, sfy1 + 0.74, pz, safariAcaciaTimber, true, true, 0.02);
          [-1.4, 1.4].forEach((lx) => {
            boxAt(sg1, 0.08, 0.72, 1.15, s1PodX + lx, sfy1 + 0.36, pz, wroughtBronze, true, true, 0.01);
          });
          boxAt(sg1, 3.1, 0.28, 0.05, s1PodX, sfy1 + 0.91, pz, savannaOlive, false, false);
          addWovenBellLamp(sg1, s1PodX, spec.groundY + 2 * spec.floorH - 0.18, pz, 0.92);
          if (pi === 0) {
            registerChair(1, s1PodX - 0.8, sfy1, pz - 1.05, 0, 1);
            registerMonitor(1, s1MonIdx++, [s1PodX - 0.8, sfy1 + 0.77, pz - 0.25], Math.PI, s1PodX - 0.8, pz - 1.05, 'Mara Itinerary Architect · L1', 'Maasai Mara Itinerary Studio');
            officeChair(sg1, s1PodX + 0.8, sfy1, pz - 1.05, 0, M);
            monitor(sg1, s1PodX + 0.8, sfy1 + 0.77, pz - 0.25, true, Math.PI, M);
            officeChair(sg1, s1PodX - 0.8, sfy1, pz + 1.05, Math.PI, M);
            monitor(sg1, s1PodX - 0.8, sfy1 + 0.77, pz + 0.25, true, 0, M);
            officeChair(sg1, s1PodX + 0.8, sfy1, pz + 1.05, Math.PI, M);
            monitor(sg1, s1PodX + 0.8, sfy1 + 0.77, pz + 0.25, true, 0, M);
          } else {
            registerChair(1, s1PodX + 0.8, sfy1, pz + 1.05, Math.PI, -1);
            registerMonitor(1, s1MonIdx++, [s1PodX + 0.8, sfy1 + 0.77, pz + 0.25], 0, s1PodX + 0.8, pz + 1.05, 'Coastal & Island Specialist · L1', 'Maasai Mara Itinerary Studio');
            officeChair(sg1, s1PodX - 0.8, sfy1, pz - 1.05, 0, M);
            monitor(sg1, s1PodX - 0.8, sfy1 + 0.77, pz - 0.25, true, Math.PI, M);
            officeChair(sg1, s1PodX + 0.8, sfy1, pz - 1.05, 0, M);
            monitor(sg1, s1PodX + 0.8, sfy1 + 0.77, pz - 0.25, true, Math.PI, M);
            officeChair(sg1, s1PodX - 0.8, sfy1, pz + 1.05, Math.PI, M);
            monitor(sg1, s1PodX - 0.8, sfy1 + 0.77, pz + 0.25, true, 0, M);
          }
        });
        // SW Safari Field Gear & Optics Outfitter Rack + West Trail Display
        boxAt(sg1, 3.2, 2.15, 0.56, spec.cx - 12.2, sfy1 + 1.075, spec.cz + 7.9, safariAcaciaTimber, true, true, 0.02);
        [-13.1, -12.2, -11.3].forEach((gx, gi) => {
          boxAt(sg1, 0.44, 0.3, 0.34, spec.cx + gx, sfy1 + 1.08, spec.cz + 7.86, gi === 1 ? savannaOlive : M.fabricCognac, false, false, 0.04);
          cylAt(sg1, 0.14, 0.18, 0.1, spec.cx + gx, sfy1 + 1.66, spec.cz + 7.86, safariCanvasMat, false, false, 14);
        });
        boxAt(sg1, 0.1, 1.95, 4.4, spec.cx - 14.65, sfy1 + 1.85, spec.cz - 0.4, wroughtBronze, false, false);
        const s1WestTv = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.76), migrationMapScreen.mat);
        s1WestTv.position.set(spec.cx - 14.58, sfy1 + 1.85, spec.cz - 0.4);
        s1WestTv.rotation.y = Math.PI / 2;
        sg1.add(s1WestTv);
        addTerracottaUrn(sg1, spec.cx - 13.4, sfy1, spec.cz - 7.1);

        // Center Zone: Circular Bushcraft Storytelling Hearth Table & Cartographer Desk
        cylAt(sg1, 0.96, 0.96, 0.06, spec.cx + 1.0, sfy1 + 0.72, spec.cz - 3.6, safariAcaciaTimber, true, true, 24);
        cylAt(sg1, 0.22, 0.34, 0.7, spec.cx + 1.0, sfy1 + 0.35, spec.cz - 3.6, wroughtBronze, true, true, 16);
        cylAt(sg1, 0.26, 0.3, 0.12, spec.cx + 1.0, sfy1 + 0.81, spec.cz - 3.6, safariCopper, false, false, 16);
        [
          [-1.35, 0, Math.PI / 2],
          [1.35, 0, -Math.PI / 2],
          [0, -1.35, 0],
          [0, 1.35, Math.PI],
        ].forEach(([ox, oz, rot]) => {
          const rc = armchair(sg1, spec.cx + 1.0 + ox, sfy1, spec.cz - 3.6 + oz, rot, wovenRattan, M);
          rc.scale.set(0.72, 0.86, 0.72);
        });

        boxAt(sg1, 2.7, 0.06, 1.08, spec.cx + 1.0, sfy1 + 0.74, spec.cz + 4.4, safariAcaciaTimber, true, true, 0.02);
        [-1.1, 1.1].forEach((lx) => {
          boxAt(sg1, 0.08, 0.72, 0.88, spec.cx + 1.0 + lx, sfy1 + 0.36, spec.cz + 4.4, wroughtBronze, true, true, 0.01);
        });
        registerChair(1, spec.cx + 1.0, sfy1, spec.cz + 5.32, Math.PI, 1);
        registerMonitor(1, s1MonIdx++, [spec.cx + 1.0, sfy1 + 0.77, spec.cz + 4.55], 0, spec.cx + 1.0, spec.cz + 5.32, 'Lead Safari Cartographer · L1', 'Cartography & Route Planning');
        [spec.cx + 0.25, spec.cx + 1.75].forEach((vx) => {
          const vc = armchair(sg1, vx, sfy1, spec.cz + 3.2, 0, savannaOlive, M);
          vc.scale.set(0.74, 0.88, 0.74);
        });

        // East-North Wing: Kenyan Highlands Coffee & Chai Tasting Bar + Wildlife Screen
        boxAt(sg1, 4.2, 0.96, 0.92, spec.cx + 9.4, sfy1 + 0.48, spec.cz - 5.2, terracottaClay, true, true, 0.03);
        boxAt(sg1, 4.32, 0.06, 1.0, spec.cx + 9.4, sfy1 + 0.99, spec.cz - 5.2, safariAcaciaTimber, false, true, 0.02);
        cylAt(sg1, 0.14, 0.18, 0.32, spec.cx + 8.6, sfy1 + 1.18, spec.cz - 5.2, safariCopper, false, false, 14);
        cylAt(sg1, 0.12, 0.16, 0.28, spec.cx + 10.2, sfy1 + 1.16, spec.cz - 5.2, safariCopper, false, false, 14);
        [-1.2, 0, 1.2].forEach((ox) => {
          cylAt(sg1, 0.2, 0.2, 0.09, spec.cx + 9.4 + ox, sfy1 + 0.68, spec.cz - 4.1, M.fabricCognac, true, true, 16);
          cylAt(sg1, 0.035, 0.035, 0.66, spec.cx + 9.4 + ox, sfy1 + 0.33, spec.cz - 4.1, wroughtBronze, false, false, 10);
          cylAt(sg1, 0.17, 0.2, 0.04, spec.cx + 9.4 + ox, sfy1 + 0.02, spec.cz - 4.1, wroughtBronze, false, true, 14);
        });
        boxAt(sg1, 0.1, 1.9, 4.2, spec.cx + 14.65, sfy1 + 1.85, spec.cz - 3.6, wroughtBronze, false, false);
        const s1EastTv = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.72), conservancyScreen.mat);
        s1EastTv.position.set(spec.cx + 14.58, sfy1 + 1.85, spec.cz - 3.6);
        s1EastTv.rotation.y = -Math.PI / 2;
        sg1.add(s1EastTv);
        plant(sg1, spec.cx + 13.2, sfy1, spec.cz - 7.1, 1.25, 1302, M, 'ficus');
        plant(sg1, spec.cx + 6.4, sfy1, spec.cz + 6.9, 1.2, 1303, M, 'olive');
      }

      // -------------------------------------------------------------------------
      // FLOOR 2 (L2): Luxury Tented Eco-Lodge Showroom & Sustainable Material Atelier
      // -------------------------------------------------------------------------
      const sg2 = levelGroups[2];
      if (sg2) {
        const sfy2 = spec.groundY + 2 * spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: sfy2 + 3.1,
          z: spec.cz,
          color: 0xffe9c8,
          distance: 26,
          baseScale: 1.05,
          floor: 2,
          buildingId: spec.id,
        });

        boxAt(sg2, 29.2, 0.018, 12.85, spec.cx, sfy2 + 0.009, spec.cz - 2.275, safariStoneFloor, false, true);
        boxAt(sg2, 25.8, 0.018, 4.55, spec.cx - 1.7, sfy2 + 0.009, spec.cz + 6.425, safariStoneFloor, false, true);
        boxAt(sg2, 3.4, 0.018, 0.75, spec.cx + 12.9, sfy2 + 0.009, spec.cz + 8.325, safariStoneFloor, false, true);
        boxAt(sg2, 9.8, 0.02, 14.2, spec.cx - 8.8, sfy2 + 0.014, spec.cz - 0.2, safariSisalRug, false, true);
        addSafariTimberCeiling(levelCeilings[2], spec.groundY + 3 * spec.floorH - 0.14, [spec.cz - 4.8, spec.cz + 4.8]);

        let s2MonIdx = 0;

        // West North: Full-Scale Luxury Canvas Tent Suite Mockup (cx - 8.8, cz - 4.4)
        const tentX = spec.cx - 8.8;
        const tentZ = spec.cz - 4.4;
        boxAt(sg2, 4.6, 0.14, 3.8, tentX, sfy2 + 0.07, tentZ, safariAcaciaTimber, true, true, 0.03);
        [
          [-2.1, -1.7],
          [2.1, -1.7],
          [-2.1, 1.7],
          [2.1, 1.7],
        ].forEach(([px, pz]) => {
          cylAt(sg2, 0.075, 0.09, 2.55, tentX + px, sfy2 + 1.34, tentZ + pz, safariAcaciaTimber, true, false, 10);
        });
        // Pitched safari canvas canopy roof over the mock tent suite
        const tentRoofL = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.05, 2.35), safariCanvasMat);
        tentRoofL.position.set(tentX, sfy2 + 2.86, tentZ - 0.96);
        tentRoofL.rotation.x = 0.28;
        sg2.add(tentRoofL);
        const tentRoofR = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.05, 2.35), safariCanvasMat);
        tentRoofR.position.set(tentX, sfy2 + 2.86, tentZ + 0.96);
        tentRoofR.rotation.x = -0.28;
        sg2.add(tentRoofR);
        // Daybed & woven kitenge cushions inside tent suite
        boxAt(sg2, 2.2, 0.42, 1.65, tentX - 0.6, sfy2 + 0.35, tentZ, safariAcaciaTimber, true, true, 0.03);
        boxAt(sg2, 2.05, 0.18, 1.5, tentX - 0.6, sfy2 + 0.65, tentZ, safariCanvasMat, true, true, 0.03);
        boxAt(sg2, 0.65, 0.06, 1.48, tentX + 0.05, sfy2 + 0.76, tentZ, terracottaClay, false, false);
        cylAt(sg2, 0.22, 0.22, 0.45, tentX + 1.25, sfy2 + 0.36, tentZ + 0.45, wroughtBronze, true, true, 12);
        cylAt(sg2, 0.08, 0.1, 0.24, tentX + 1.25, sfy2 + 0.7, tentZ + 0.45, safariCopper, false, false, 10);
        addSafariPlaque(sg2, 'CANVAS SUITE VILLA MOCKUP', tentX, sfy2 + 2.45, tentZ - 1.9, Math.PI);

        // West South: Rift-Valley Live-Edge Bush Dining & Sundowner Table (cx - 8.8, cz + 3.8)
        const dineX = spec.cx - 8.8;
        const dineZ = spec.cz + 3.8;
        boxAt(sg2, 4.2, 0.075, 1.25, dineX, sfy2 + 0.74, dineZ, safariAcaciaTimber, true, true, 0.025);
        [-1.55, 1.55].forEach((lx) => {
          boxAt(sg2, 0.12, 0.72, 0.96, dineX + lx, sfy2 + 0.36, dineZ, wroughtBronze, true, true, 0.01);
        });
        [-1.35, 0, 1.35].forEach((ox) => {
          cylAt(sg2, 0.14, 0.11, 0.02, dineX + ox, sfy2 + 0.79, dineZ - 0.32, M.white, false, false, 14);
          cylAt(sg2, 0.14, 0.11, 0.02, dineX + ox, sfy2 + 0.79, dineZ + 0.32, M.white, false, false, 14);
          const dch1 = armchair(sg2, dineX + ox, sfy2, dineZ - 0.98, 0, wovenRattan, M);
          dch1.scale.set(0.68, 0.85, 0.68);
          const dch2 = armchair(sg2, dineX + ox, sfy2, dineZ + 0.98, Math.PI, wovenRattan, M);
          dch2.scale.set(0.68, 0.85, 0.68);
        });
        addWovenBellLamp(sg2, dineX - 1.1, spec.groundY + 3 * spec.floorH - 0.18, dineZ, 0.9);
        addWovenBellLamp(sg2, dineX + 1.1, spec.groundY + 3 * spec.floorH - 0.18, dineZ, 0.9);

        // Center Zone: Eco-Lodge Architectural Scale Model Table + 2 Specialist Desks + Material Swatch Stand
        const lodgeModX = spec.cx + 1.0;
        const lodgeModZ = spec.cz - 3.6;
        boxAt(sg2, 3.1, 0.78, 1.9, lodgeModX, sfy2 + 0.39, lodgeModZ, basaltRockMat, true, true, 0.03);
        boxAt(sg2, 2.85, 0.05, 1.65, lodgeModX, sfy2 + 0.8, lodgeModZ, std({ color: 0x5c7c41, roughness: 0.88 }), false, true);
        boxAt(sg2, 0.9, 0.03, 0.56, lodgeModX, sfy2 + 0.83, lodgeModZ + 0.28, std({ color: 0x38bdf8, roughness: 0.2 }), false, false);
        [-0.85, 0, 0.85].forEach((lx) => {
          boxAt(sg2, 0.42, 0.22, 0.36, lodgeModX + lx, sfy2 + 0.93, lodgeModZ - 0.28, safariCanvasMat, false, false);
          const peak = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.24, 4), terracottaClay);
          peak.rotation.y = Math.PI / 4;
          peak.position.set(lodgeModX + lx, sfy2 + 1.14, lodgeModZ - 0.28);
          sg2.add(peak);
        });

        boxAt(sg2, 2.7, 0.06, 1.08, spec.cx + 1.0, sfy2 + 0.74, spec.cz + 2.4, safariAcaciaTimber, true, true, 0.02);
        [-1.1, 1.1].forEach((lx) => boxAt(sg2, 0.08, 0.72, 0.88, spec.cx + 1.0 + lx, sfy2 + 0.36, spec.cz + 2.4, wroughtBronze, true, true, 0.01));
        registerChair(2, spec.cx + 1.0, sfy2, spec.cz + 3.32, Math.PI, 1);
        registerMonitor(2, s2MonIdx++, [spec.cx + 1.0, sfy2 + 0.77, spec.cz + 2.55], 0, spec.cx + 1.0, spec.cz + 3.32, 'Eco-Lodge Architect · L2', 'Eco-Lodge Showroom');

        boxAt(sg2, 2.7, 0.06, 1.08, spec.cx + 7.4, sfy2 + 0.74, spec.cz - 5.2, safariAcaciaTimber, true, true, 0.02);
        [-1.1, 1.1].forEach((lx) => boxAt(sg2, 0.08, 0.72, 0.88, spec.cx + 7.4 + lx, sfy2 + 0.36, spec.cz - 5.2, wroughtBronze, true, true, 0.01));
        registerChair(2, spec.cx + 7.4, sfy2, spec.cz - 6.12, 0, -1);
        registerMonitor(2, s2MonIdx++, [spec.cx + 7.4, sfy2 + 0.77, spec.cz - 5.35], Math.PI, spec.cx + 7.4, spec.cz - 6.12, 'Conservation Impact Lead · L2', 'Eco-Lodge Showroom');

        // Sustainable Material Sample Rack (makuti thatch, coral block, mvule wood, woven kitenge)
        boxAt(sg2, 3.6, 1.85, 0.42, spec.cx + 1.0, sfy2 + 0.925, spec.cz + 7.2, wroughtBronze, true, true, 0.02);
        [safariCanvasMat, terracottaClay, safariAcaciaTimber, savannaOlive].forEach((sm, si) => {
          boxAt(sg2, 0.68, 0.82, 0.12, spec.cx - 0.25 + si * 0.84, sfy2 + 1.25, spec.cz + 7.12, sm, false, false);
        });

        // East Mid: Sculpted Giraffe Gallery Sculpture + Viewing Chairs
        addBronzeGiraffeSculpture(sg2, spec.cx + 7.4, sfy2, spec.cz - 0.6, 1.05, -0.45);
        const l2View1 = armchair(sg2, spec.cx + 9.4, sfy2, spec.cz - 0.6, -Math.PI / 2, M.fabricCognac, M);
        l2View1.scale.set(0.75, 0.88, 0.75);
        plant(sg2, spec.cx + 13.0, sfy2, spec.cz - 7.0, 1.25, 1304, M, 'olive');
        plant(sg2, spec.cx - 13.4, sfy2, spec.cz + 7.0, 1.25, 1305, M, 'ficus');
      }

      // -------------------------------------------------------------------------
      // FLOOR 3 (L3): Conservation Boardroom, Founder's Safari Penthouse & Head Offices
      // -------------------------------------------------------------------------
      const sg3 = levelGroups[3];
      if (sg3) {
        const sfy3 = spec.groundY + 3 * spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: sfy3 + 3.15,
          z: spec.cz,
          color: 0xffebd0,
          distance: 27,
          baseScale: 1.08,
          floor: 3,
          buildingId: spec.id,
        });

        boxAt(sg3, 29.2, 0.018, 12.85, spec.cx, sfy3 + 0.009, spec.cz - 2.275, safariStoneFloor, false, true);
        boxAt(sg3, 25.8, 0.018, 4.55, spec.cx - 1.7, sfy3 + 0.009, spec.cz + 6.425, safariStoneFloor, false, true);
        boxAt(sg3, 3.4, 0.018, 0.75, spec.cx + 12.9, sfy3 + 0.009, spec.cz + 8.325, safariStoneFloor, false, true);
        boxAt(sg3, 8.2, 0.02, 11.4, spec.cx - 8.8, sfy3 + 0.014, spec.cz + 0.2, safariSisalRug, false, true);
        boxAt(sg3, 5.8, 0.02, 4.8, spec.cx + 1.0, sfy3 + 0.014, spec.cz + 5.3, safariSisalRug, false, true);
        boxAt(sg3, 4.2, 0.02, 3.8, spec.cx + 0.8, sfy3 + 0.014, spec.cz - 1.6, safariSisalRug, false, true);
        addSafariTimberCeiling(levelCeilings[3], spec.groundY + 4 * spec.floorH - 0.14, [spec.cz - 4.8, spec.cz + 4.8]);

        let s3MonIdx = 0;

        // 1. WEST WING (dx -14.4..-3.4): Wildlife & Conservation Boardroom (boat-tapered acacia table + 3 basket lamps)
        const sfBrWallX = spec.cx - 3.4;
        boxAt(sg3, 0.08, 2.95, 5.0, sfBrWallX, sfy3 + 1.475, spec.cz - 4.3, safariGlass, false, false);
        boxAt(sg3, 0.08, 2.95, 8.5, sfBrWallX, sfy3 + 1.475, spec.cz + 4.25, safariGlass, false, false);
        boxAt(sg3, 0.14, 0.14, 15.3, sfBrWallX, sfy3 + 2.95, spec.cz + 0.85, safariAcaciaTimber, true, false);
        [-6.8, -1.8, 0.0, 2.6, 5.6, 8.5].forEach((mz) => {
          boxAt(sg3, 0.14, 2.96, 0.14, sfBrWallX, sfy3 + 1.48, spec.cz + mz, wroughtBronze, true, false);
        });
        addSafariPlaque(sg3, 'CONSERVATION BOARDROOM', sfBrWallX + 0.1, sfy3 + 2.66, spec.cz - 0.9, Math.PI / 2);

        const sfBrX = spec.cx - 8.8;
        const sfBrZ = spec.cz + 0.2;
        // Boat-tapered live-edge acacia boardroom table (2.8m x 6.8m)
        const boatShape = new THREE.Shape();
        boatShape.moveTo(-0.92, -3.4);
        boatShape.quadraticCurveTo(1.48, 0, 0.92, 3.4);
        boatShape.lineTo(-0.92, 3.4);
        boatShape.quadraticCurveTo(-1.48, 0, -0.92, -3.4);
        boatShape.closePath();
        const boatGeo = new THREE.ExtrudeGeometry(boatShape, {
          depth: 0.08,
          bevelEnabled: true,
          bevelThickness: 0.02,
          bevelSize: 0.02,
          bevelSegments: 2,
          curveSegments: 20,
        });
        boatGeo.rotateX(-Math.PI / 2);
        const boatTop = new THREE.Mesh(boatGeo, safariAcaciaTimber);
        boatTop.position.set(sfBrX, sfy3 + 0.71, sfBrZ);
        boatTop.castShadow = true;
        boatTop.receiveShadow = true;
        sg3.add(boatTop);
        [-2.0, 2.0].forEach((pz) => {
          cylAt(sg3, 0.36, 0.48, 0.7, sfBrX, sfy3 + 0.35, sfBrZ + pz, wroughtBronze, true, true, 16);
        });
        [-2.1, 0, 2.1].forEach((lz) => {
          addWovenBellLamp(sg3, sfBrX, spec.groundY + 4 * spec.floorH - 0.18, sfBrZ + lz, 1.0);
        });
        registerChair(3, sfBrX, sfy3, sfBrZ - 3.85, 0, 1);
        registerMonitor(3, s3MonIdx++, [sfBrX, sfy3 + 0.79, sfBrZ - 2.9], Math.PI, sfBrX, sfBrZ - 3.85, 'Director of Wildlife Partnerships · L3', 'Conservation Boardroom');
        registerChair(3, sfBrX + 2.05, sfy3, sfBrZ - 1.4, -Math.PI / 2, -1);
        registerMonitor(3, s3MonIdx++, [sfBrX + 1.15, sfy3 + 0.79, sfBrZ - 1.4], Math.PI / 2, sfBrX + 2.05, sfBrZ - 1.4, 'Head of Eco-Lodge Operations · L3', 'Conservation Boardroom');
        officeChair(sg3, sfBrX, sfy3, sfBrZ + 3.85, Math.PI, M);
        [-2.5, -0.2, 1.0, 2.2].forEach((czo) => officeChair(sg3, sfBrX + 2.05, sfy3, sfBrZ + czo, -Math.PI / 2, M));
        [-2.5, -1.4, -0.2, 1.0, 2.2].forEach((czo) => officeChair(sg3, sfBrX - 2.05, sfy3, sfBrZ + czo, Math.PI / 2, M));

        boxAt(sg3, 0.1, 2.0, 4.8, spec.cx - 14.65, sfy3 + 1.88, sfBrZ, wroughtBronze, false, false);
        const s3BrTv = new THREE.Mesh(new THREE.PlaneGeometry(4.55, 1.82), conservancyScreen.mat);
        s3BrTv.position.set(spec.cx - 14.58, sfy3 + 1.88, sfBrZ);
        s3BrTv.rotation.y = Math.PI / 2;
        sg3.add(s3BrTv);
        addTerracottaUrn(sg3, spec.cx - 13.4, sfy3, spec.cz - 7.1);
        plant(sg3, spec.cx - 13.4, sfy3, spec.cz + 7.1, 1.25, 1306, M, 'ficus');

        // 2. BACK CENTER (dx -2.8..+4.8, dz +2.0..+8.4): FOUNDER & CHIEF SAFARI OFFICER STUDY
        const ceoSfX = spec.cx + 1.0;
        const ceoSfFrontZ = spec.cz + 2.0;
        boxAt(sg3, 2.6, 2.95, 0.08, spec.cx - 1.5, sfy3 + 1.475, ceoSfFrontZ, safariGlass, false, false);
        boxAt(sg3, 3.4, 2.95, 0.08, spec.cx + 3.1, sfy3 + 1.475, ceoSfFrontZ, safariGlass, false, false);
        boxAt(sg3, 7.65, 0.14, 0.14, ceoSfX, sfy3 + 2.95, ceoSfFrontZ, safariAcaciaTimber, true, false);
        boxAt(sg3, 0.08, 2.95, 6.4, spec.cx + 4.8, sfy3 + 1.475, spec.cz + 5.2, safariGlass, false, false);
        [-2.8, -0.2, 1.4, 4.8].forEach((px) => {
          boxAt(sg3, 0.14, 2.96, 0.14, spec.cx + px, sfy3 + 1.48, ceoSfFrontZ, wroughtBronze, true, false);
        });
        addSafariPlaque(sg3, 'FOUNDER · SAFARI COMMAND', spec.cx + 2.8, sfy3 + 2.66, ceoSfFrontZ - 0.09, Math.PI);

        // South Hand-Carved Curio & Expedition Trophy Wall (Maasai shields, brass compasses, amphora shelves)
        boxAt(sg3, 5.6, 2.9, 0.44, ceoSfX, sfy3 + 1.45, spec.cz + 8.36, terracottaClay, true, true, 0.02);
        [0.88, 1.68, 2.4].forEach((sy) => {
          boxAt(sg3, 5.0, 0.05, 0.38, ceoSfX, sfy3 + sy, spec.cz + 8.34, safariAcaciaTimber, false, false);
        });
        [-0.8, 0.8].forEach((mx) => {
          cylAt(sg3, 0.28, 0.28, 0.06, ceoSfX + mx, sfy3 + 2.02, spec.cz + 8.2, savannaOlive, false, false, 16);
          cylAt(sg3, 0.12, 0.12, 0.07, ceoSfX + mx, sfy3 + 2.02, spec.cz + 8.17, safariCopper, false, false, 12);
        });

        boxAt(sg3, 2.8, 0.065, 1.14, ceoSfX, sfy3 + 0.74, spec.cz + 5.75, safariAcaciaTimber, true, true, 0.02);
        boxAt(sg3, 2.6, 0.72, 0.14, ceoSfX, sfy3 + 0.36, spec.cz + 5.34, wroughtBronze, true, true, 0.01);
        registerChair(3, ceoSfX, sfy3, spec.cz + 6.72, Math.PI, -1);
        registerMonitor(3, s3MonIdx++, [ceoSfX, sfy3 + 0.77, spec.cz + 5.88], 0, ceoSfX, spec.cz + 6.72, 'Founder & Chief Safari Officer · L3', 'Founder Safari Penthouse');
        [spec.cx + 0.25, spec.cx + 1.75].forEach((gx) => {
          const gc = armchair(sg3, gx, sfy3, spec.cz + 4.4, 0, M.fabricCognac, M);
          gc.scale.set(0.75, 0.88, 0.75);
        });
        plant(sg3, spec.cx + 4.0, sfy3, spec.cz + 7.5, 1.2, 1307, M, 'olive');

        // 3. NORTH-EAST CORNER (dx +5.4..+14.4, dz -8.2..-1.8): HEAD OF EXPEDITIONS & BUSH AVIATION OFFICE
        const expFrontZ = spec.cz - 1.8;
        boxAt(sg3, 0.8, 2.95, 0.08, spec.cx + 5.8, sfy3 + 1.475, expFrontZ, safariGlass, false, false);
        boxAt(sg3, 6.6, 2.95, 0.08, spec.cx + 11.1, sfy3 + 1.475, expFrontZ, safariGlass, false, false);
        boxAt(sg3, 9.0, 0.14, 0.14, spec.cx + 9.9, sfy3 + 2.95, expFrontZ, safariAcaciaTimber, true, false);
        boxAt(sg3, 0.08, 2.95, 6.4, spec.cx + 5.4, sfy3 + 1.475, spec.cz - 5.0, safariGlass, false, false);
        [5.4, 6.2, 7.8, 14.4].forEach((px) => {
          boxAt(sg3, 0.14, 2.96, 0.14, spec.cx + px, sfy3 + 1.48, expFrontZ, wroughtBronze, true, false);
        });
        addSafariPlaque(sg3, 'HEAD OF EXPEDITIONS & AIR', spec.cx + 10.6, sfy3 + 2.66, expFrontZ + 0.09, 0);

        const expX = spec.cx + 9.8;
        boxAt(sg3, 2.5, 0.06, 1.05, expX, sfy3 + 0.74, spec.cz - 5.2, safariAcaciaTimber, true, true, 0.02);
        [-1.05, 1.05].forEach((lx) => boxAt(sg3, 0.08, 0.72, 0.86, expX + lx, sfy3 + 0.36, spec.cz - 5.2, wroughtBronze, true, true, 0.01));
        registerChair(3, expX, sfy3, spec.cz - 6.12, 0, 1);
        registerMonitor(3, s3MonIdx++, [expX, sfy3 + 0.77, spec.cz - 5.32], Math.PI, expX, spec.cz - 6.12, 'Head of Expeditions & Bush Air · L3', 'Expeditions & Bush Air Office');
        [expX - 0.75, expX + 0.75].forEach((vx) => {
          const vc = armchair(sg3, vx, sfy3, spec.cz - 3.9, Math.PI, savannaOlive, M);
          vc.scale.set(0.74, 0.88, 0.74);
        });
        boxAt(sg3, 0.1, 1.45, 2.6, spec.cx + 14.65, sfy3 + 1.85, spec.cz - 5.2, wroughtBronze, false, false);
        const expTv = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), migrationMapScreen.mat);
        expTv.position.set(spec.cx + 14.58, sfy3 + 1.85, spec.cz - 5.2);
        expTv.rotation.y = -Math.PI / 2;
        sg3.add(expTv);

        // 4. FRONT CENTER & SOUTH-CENTER: Safari Reception Pavilion, Sundowner Lounge & Kenyan Tea Bar
        boxAt(sg3, 2.3, 0.06, 0.96, ceoSfX, sfy3 + 0.74, spec.cz - 5.6, safariAcaciaTimber, true, true, 0.02);
        boxAt(sg3, 2.34, 0.92, 0.14, ceoSfX, sfy3 + 0.46, spec.cz - 5.14, terracottaClay, true, true, 0.02);
        registerChair(3, ceoSfX, sfy3, spec.cz - 6.52, 0, 1);
        registerMonitor(3, s3MonIdx++, [ceoSfX, sfy3 + 0.77, spec.cz - 5.7], Math.PI, ceoSfX, spec.cz - 6.52, 'Executive Guest Relations Lead · L3', 'Penthouse Reception Pavilion');

        const sunSofa = sofaWide(sg3, spec.cx - 0.75, sfy3, spec.cz - 1.6, Math.PI / 2, savannaOlive, M);
        sunSofa.scale.set(0.76, 0.92, 0.84);
        cylAt(sg3, 0.52, 0.52, 0.04, spec.cx + 0.75, sfy3 + 0.41, spec.cz - 1.6, safariAcaciaTimber, true, true, 22);
        cylAt(sg3, 0.14, 0.18, 0.39, spec.cx + 0.75, sfy3 + 0.2, spec.cz - 1.6, wroughtBronze, false, true, 14);
        const sunArm1 = armchair(sg3, spec.cx + 2.05, sfy3, spec.cz - 2.35, -Math.PI * 0.35, M.fabricCognac, M);
        sunArm1.scale.set(0.74, 0.88, 0.74);
        const sunArm2 = armchair(sg3, spec.cx + 2.05, sfy3, spec.cz - 0.85, -Math.PI * 0.65, M.fabricCognac, M);
        sunArm2.scale.set(0.74, 0.88, 0.74);
        plant(sg3, spec.cx + 4.0, sfy3, spec.cz + 1.1, 1.25, 1308, M, 'ficus');

        // South-Center Kenyan Tea & Craft Spirits Veranda Bar (dx +7.6, dz +5.8 -> cleanly west of SE stair wall +11.2)
        boxAt(sg3, 3.4, 0.94, 0.88, spec.cx + 7.6, sfy3 + 0.47, spec.cz + 5.8, terracottaClay, true, true, 0.03);
        boxAt(sg3, 3.48, 0.06, 0.94, spec.cx + 7.6, sfy3 + 0.97, spec.cz + 5.8, safariAcaciaTimber, false, true, 0.01);
        cylAt(sg3, 0.14, 0.18, 0.32, spec.cx + 7.6, sfy3 + 1.16, spec.cz + 5.8, safariCopper, false, false, 14);
        [spec.cx + 6.8, spec.cx + 8.4].forEach((sx) => {
          cylAt(sg3, 0.2, 0.2, 0.09, sx, sfy3 + 0.68, spec.cz + 4.7, wovenRattan, true, true, 16);
          cylAt(sg3, 0.035, 0.035, 0.66, sx, sfy3 + 0.33, spec.cz + 4.7, wroughtBronze, false, false, 10);
          cylAt(sg3, 0.17, 0.2, 0.04, sx, sfy3 + 0.02, spec.cz + 4.7, wroughtBronze, false, true, 14);
        });
      }

      // -------------------------------------------------------------------------
      // CONTINUOUS SE ACACIA & HAMMERED-BRONZE SAFARI STAIRWELL CORE (G -> L3)
      // -------------------------------------------------------------------------
      const sfStairXWest = spec.cx + 11.2;
      const sfStairXEast = spec.cx + 14.32;
      const sfStairXMid = spec.cx + 12.75;
      const sfStairZNorth = spec.cz + 2.8;
      const sfStairZSouth = spec.cz + 8.0;
      const sfStairW = sfStairXEast - sfStairXWest;
      const sfStairD = sfStairZSouth - sfStairZNorth;
      const sfStairCx = (sfStairXWest + sfStairXEast) * 0.5;
      const sfStairCz = (sfStairZNorth + sfStairZSouth) * 0.5;
      const sfBridgeZ = spec.cz + 4.15;
      const sfHalfStartZ = spec.cz + 6.75;
      const sfStairSigns = ['SAFARI STAIRS · G → L1', 'STAIRS · L1 ↔ L2', 'STAIRS · L2 ↔ L3', 'STAIRS · L3 PENTHOUSE'];

      const addSfRail = (parent: THREE.Object3D, x: number, y0: number, z0: number, y1: number, z1: number) => {
        const p0 = new THREE.Vector3(x, y0 + 0.92, z0);
        const p1 = new THREE.Vector3(x, y1 + 0.92, z1);
        const len = p0.distanceTo(p1);
        const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
        const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, len, 10), safariAcaciaTimber);
        rail.position.copy(mid);
        rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        parent.add(rail);
        [0.15, 0.5, 0.85].forEach((t) => {
          const py = THREE.MathUtils.lerp(y0, y1, t);
          const pz = THREE.MathUtils.lerp(z0, z1, t);
          cylAt(parent, 0.015, 0.015, 0.92, x, py + 0.46, pz, wroughtBronze, false, false, 8);
        });
      };

      for (let lv = 0; lv < spec.floors; lv++) {
        const lgS = levelGroups[lv];
        if (!lgS) continue;
        const fyS = spec.groundY + lv * spec.floorH + SLAB_THICK * 0.5;
        const wallH = spec.floorH - SLAB_THICK - 0.04;

        // North vestibule landing finish & lime-amber safari threshold inlay
        boxAt(lgS, 3.0, 0.018, 1.32, sfStairCx, fyS + 0.009, spec.cz + 3.48, safariStoneFloor, false, true);
        boxAt(lgS, 0.14, 0.018, 1.24, sfStairXWest, fyS + 0.012, spec.cz + 3.5, new THREE.MeshBasicMaterial({ color: 0x84cc16 }), false, false);

        // East, North & South acacia-and-bronze glazed shaft perimeter
        boxAt(lgS, 0.1, 0.2, sfStairD, sfStairXEast, fyS + 0.1, sfStairCz, terracottaClay, true, true);
        boxAt(lgS, 0.05, wallH - 0.26, sfStairD, sfStairXEast, fyS + 0.2 + (wallH - 0.26) * 0.5, sfStairCz, safariGlass, false, false);
        boxAt(lgS, 0.12, 0.12, sfStairD, sfStairXEast, fyS + wallH - 0.02, sfStairCz, safariAcaciaTimber, false, false);
        [sfStairZNorth, spec.cz + 5.4, sfStairZSouth].forEach((mz) => {
          boxAt(lgS, 0.1, wallH, 0.1, sfStairXEast, fyS + wallH * 0.5, mz, wroughtBronze, true, false);
        });
        [sfStairZNorth, sfStairZSouth].forEach((wz) => {
          boxAt(lgS, sfStairW, 0.2, 0.1, sfStairCx, fyS + 0.1, wz, terracottaClay, true, true);
          boxAt(lgS, sfStairW, wallH - 0.26, 0.05, sfStairCx, fyS + 0.2 + (wallH - 0.26) * 0.5, wz, safariGlass, false, false);
          boxAt(lgS, sfStairW, 0.12, 0.12, sfStairCx, fyS + wallH - 0.02, wz, safariAcaciaTimber, false, false);
          boxAt(lgS, 0.1, wallH, 0.1, sfStairXMid, fyS + wallH * 0.5, wz, wroughtBronze, true, false);
        });

        // West glass shaft wall south of doorway (dz = +4.12..+8.00 -> 3.88m)
        boxAt(lgS, 0.12, 0.36, 3.88, sfStairXWest, fyS + 0.18, spec.cz + 6.06, terracottaClay, true, true);
        boxAt(lgS, 0.05, wallH - 0.42, 3.88, sfStairXWest, fyS + 0.36 + (wallH - 0.42) * 0.5, spec.cz + 6.06, safariGlass, false, false);
        boxAt(lgS, 0.12, 0.12, 3.88, sfStairXWest, fyS + wallH - 0.02, spec.cz + 6.06, safariAcaciaTimber, false, false);
        boxAt(lgS, 0.1, wallH, 0.1, sfStairXWest, fyS + wallH * 0.5, spec.cz + 6.06, wroughtBronze, true, false);
        boxAt(lgS, 0.1, wallH, 0.1, sfStairXWest, fyS + wallH * 0.5, sfStairZSouth, wroughtBronze, true, false);

        // Framed open Safari Stairwell Door on West shaft face (dx = +11.20, dz = +2.86..+4.12)
        const doorZ = spec.cz + 3.49;
        const doorH = 2.42;
        [spec.cz + 2.86, spec.cz + 4.12].forEach((jz) => {
          boxAt(lgS, 0.15, wallH, 0.11, sfStairXWest, fyS + wallH * 0.5, jz, wroughtBronze, true, false, 0.01);
        });
        boxAt(lgS, 0.15, 0.12, 1.38, sfStairXWest, fyS + doorH + 0.06, doorZ, safariAcaciaTimber, true, false, 0.01);
        const transomH = Math.max(0.3, wallH - doorH - 0.16);
        boxAt(lgS, 0.05, transomH, 1.2, sfStairXWest, fyS + doorH + 0.12 + transomH * 0.5, doorZ, safariGlass, false, false);

        // Swung-open acacia-stile & glazed door leaf (hinged at South jamb, swung out -X/+Z against glass)
        const doorLeaf = new THREE.Group();
        doorLeaf.position.set(sfStairXWest - 0.02, fyS, spec.cz + 4.08);
        doorLeaf.rotation.y = 2.22;
        boxAt(doorLeaf, 0.055, doorH - 0.04, 0.09, 0, (doorH - 0.04) * 0.5 + 0.02, -0.045, safariAcaciaTimber, true, false);
        boxAt(doorLeaf, 0.055, doorH - 0.04, 0.09, 0, (doorH - 0.04) * 0.5 + 0.02, -1.08, safariAcaciaTimber, true, false);
        boxAt(doorLeaf, 0.055, 0.14, 1.12, 0, 0.09, -0.56, wroughtBronze, true, false);
        boxAt(doorLeaf, 0.055, 0.12, 1.12, 0, doorH - 0.08, -0.56, wroughtBronze, true, false);
        boxAt(doorLeaf, 0.028, doorH - 0.3, 0.96, 0, doorH * 0.5, -0.56, safariGlass, false, false);
        cylAt(doorLeaf, 0.014, 0.014, 0.86, -0.055, 1.15, -0.98, safariCopper, false, false, 10);
        cylAt(doorLeaf, 0.014, 0.014, 0.86, 0.055, 1.15, -0.98, safariCopper, false, false, 10);
        lgS.add(doorLeaf);
        addSafariPlaque(lgS, sfStairSigns[lv] ?? `STAIRS · L${lv}`, sfStairXWest - 0.1, fyS + doorH + 0.34, doorZ, -Math.PI / 2);

        // Two-Flight Switchback Acacia & Bronze Stairs (G->L1, L1->L2, L2->L3)
        if (lv < spec.floors - 1) {
          const steps = 8;
          const runLen = sfHalfStartZ - sfBridgeZ;
          const stepDepth = runLen / steps;
          const halfRise = spec.floorH * 0.5;
          const stepRise = halfRise / steps;
          const yMidLv = fyS + halfRise;
          const yTopLv = fyS + spec.floorH;

          // Flight 1 (East lane dx = +13.52, climbs Southward +4.15 -> +6.75)
          for (let st = 0; st < steps; st++) {
            const ty = fyS + (st + 0.5) * stepRise;
            const tz = sfBridgeZ + (st + 0.5) * stepDepth;
            boxAt(lgS, 1.32, stepRise, stepDepth + 0.03, spec.cx + 13.52, ty, tz, wroughtBronze, true, true, 0.008);
            boxAt(lgS, 1.35, 0.045, stepDepth + 0.04, spec.cx + 13.52, ty + stepRise * 0.5 + 0.01, tz, safariAcaciaTimber, false, true, 0.008);
            boxAt(lgS, 1.35, 0.016, 0.035, spec.cx + 13.52, ty + stepRise * 0.5 + 0.028, tz - stepDepth * 0.45, safariCopper, false, false);
          }

          // South Half Landing (y = fyS + 2.10)
          boxAt(lgS, 2.94, 0.16, 1.22, sfStairCx, yMidLv - 0.07, spec.cz + 7.36, wroughtBronze, true, true, 0.015);
          boxAt(lgS, 2.9, 0.04, 1.18, sfStairCx, yMidLv + 0.02, spec.cz + 7.36, safariAcaciaTimber, false, true, 0.01);

          // Flight 2 (West lane dx = +11.98, climbs Northward +6.75 -> +4.15)
          for (let st = 0; st < steps; st++) {
            const ty = yMidLv + (st + 0.5) * stepRise;
            const tz = sfHalfStartZ - (st + 0.5) * stepDepth;
            boxAt(lgS, 1.32, stepRise * 0.55, stepDepth + 0.03, spec.cx + 11.98, ty + stepRise * 0.22, tz, wroughtBronze, true, true, 0.008);
            boxAt(lgS, 1.35, 0.045, stepDepth + 0.04, spec.cx + 11.98, ty + stepRise * 0.5 + 0.01, tz, safariAcaciaTimber, false, true, 0.008);
            boxAt(lgS, 1.35, 0.016, 0.035, spec.cx + 11.98, ty + stepRise * 0.5 + 0.028, tz + stepDepth * 0.45, safariCopper, false, false);
          }

          addSfRail(lgS, spec.cx + 14.18, fyS, sfBridgeZ, yMidLv, sfHalfStartZ);
          addSfRail(lgS, spec.cx + 12.82, fyS, sfBridgeZ, yMidLv, sfHalfStartZ);
          addSfRail(lgS, spec.cx + 12.68, yMidLv, sfHalfStartZ, yTopLv, sfBridgeZ);
          addSfRail(lgS, spec.cx + 11.32, yMidLv, sfHalfStartZ, yTopLv, sfBridgeZ);
        }

        // Shaft balustrades (ground under-stair guard + upper-floor drop guardrails)
        if (lv === 0) {
          boxAt(lgS, 1.44, 1.45, 0.06, spec.cx + 11.98, fyS + 0.725, sfBridgeZ, safariGlass, false, false);
          boxAt(lgS, 0.06, 1.04, 2.6, sfStairXMid, fyS + 0.52, spec.cz + 5.45, safariGlass, false, false);
        } else {
          boxAt(lgS, 0.06, 1.04, 3.8, sfStairXMid, fyS + 0.52, spec.cz + 6.05, safariGlass, false, false);
          boxAt(lgS, 0.05, 1.04, 3.8, spec.cx + 14.24, fyS + 0.52, spec.cz + 6.05, safariGlass, false, false);
          boxAt(lgS, 2.94, 1.04, 0.05, sfStairCx, fyS + 0.52, spec.cz + 7.94, safariGlass, false, false);
          if (lv === spec.floors - 1) {
            boxAt(lgS, 1.46, 1.04, 0.06, spec.cx + 13.52, fyS + 0.52, sfBridgeZ, safariGlass, false, false);
          }
        }
      }
    } else if (spec.id === 'medical') {
      // VitalCare Medical & Pharmacy: Rotating 3D emerald cross beacon elevated cleanly on cantilevered sloped roof blade
      const crossBeacon = new THREE.Group();
      crossBeacon.position.set(spec.doorX, spec.groundY + spec.h + 4.45, spec.doorZ + 0.9);
      boxAt(crossBeacon, 2.1, 0.68, 0.34, 0, 0, 0, accentMat, true, false, 0.04);
      boxAt(crossBeacon, 0.68, 2.1, 0.34, 0, 0, 0, accentMat, true, false, 0.04);
      roofShellGroup.add(crossBeacon);
      rotatingProps.push({ obj: crossBeacon, speed: 0.75, axis: 'y' });

      buildVitalCareWholeBuilding({
        spec,
        levelGroups,
        levelCeilings,
        M,
        archMats,
        frameDarkMat,
        accentMat,
        glassMat,
        screenReg,
        registerChair,
        registerMonitor,
        pickMeshes,
        rotatingProps,
        warmLights,
        monitors,
      });
    } else if (spec.id === 'logistics') {
      // SwiftPort Cargo & Logistics: Structural I-beam dispatch canopy & lattice radar tower built by districtConstruction.ts

      // Exterior East Loading Dock Roll-Up Bays (facing Freight Yard at x = 70..77)
      const dockX = spec.cx + spec.w * 0.5 + 0.06;
      const cartonMat = std({ color: 0xb9854c, roughness: 0.85 });
      const palletMat = std({ color: 0x7c5530, roughness: 0.88 });
      const steelShutterMat = std({ color: 0x64748b, roughness: 0.48, metalness: 0.42 });
      [-3.5, 3.5].forEach((dz) => {
        const bayZ = spec.cz + dz;
        boxAt(g0, 2.0, 0.18, 4.4, dockX + 0.9, fy + 3.45, bayZ, frameDarkMat, true, false, 0.04);
        boxAt(g0, 0.14, 0.12, 4.4, dockX + 1.9, fy + 3.45, bayZ, accentMat, false, false);
        boxAt(g0, 0.18, 2.9, 3.6, dockX, fy + 1.45, bayZ, steelShutterMat, true, true, 0.02);
        for (let rib = 0; rib < 6; rib++) {
          boxAt(g0, 0.22, 0.05, 3.45, dockX + 0.02, fy + 0.35 + rib * 0.46, bayZ, frameDarkMat, false, false);
        }
        [-2.05, 2.05].forEach((bz) => {
          cylAt(g0, 0.11, 0.12, 0.95, dockX + 0.42, spec.groundY + 0.475, bayZ + bz, accentMat, true, true, 10);
        });
        boxAt(g0, 1.5, 0.14, 1.6, spec.cx + 12.6, fy + 0.07, bayZ, palletMat, true, true, 0.01);
        boxAt(g0, 1.1, 0.72, 1.2, spec.cx + 12.6, fy + 0.5, bayZ, cartonMat, true, true, 0.02);
      });

      // -------------------------------------------------------------------------
      // BESPOKE PROCEDURAL MATERIALS & INDUSTRIAL PORT ARCHITECTURE (SWIFTPORT)
      // -------------------------------------------------------------------------
      const cargoEpoxyTex = makeCanvasTex('cargo_epoxy_floor', 256, 256, (g, W, H) => {
        g.fillStyle = '#38414d';
        g.fillRect(0, 0, W, H);
        // Industrial epoxy resin speckle & expansion seams
        for (let i = 0; i < 180; i++) {
          const sx = (i * 73) % W;
          const sy = (i * 137) % H;
          g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.16)';
          g.fillRect(sx, sy, 3, 3);
        }
        g.strokeStyle = 'rgba(249,115,22,0.28)';
        g.lineWidth = 2;
        g.strokeRect(2, 2, W - 4, H - 4);
      });
      cargoEpoxyTex.wrapS = cargoEpoxyTex.wrapT = THREE.RepeatWrapping;
      cargoEpoxyTex.repeat.set(8, 5);
      const cargoEpoxyFloor = std({ map: cargoEpoxyTex, roughness: 0.36, metalness: 0.12, envMapIntensity: 0.38 });

      const corrugatedSteelTex = makeCanvasTex('cargo_corrugated_steel', 256, 128, (g, W, H) => {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, W, H);
        for (let x = 0; x < W; x += 16) {
          const gr = g.createLinearGradient(x, 0, x + 16, 0);
          gr.addColorStop(0, '#c4cdd6');
          gr.addColorStop(0.35, '#ffffff');
          gr.addColorStop(0.75, '#94a3b8');
          gr.addColorStop(1, '#c4cdd6');
          g.fillStyle = gr;
          g.fillRect(x, 0, 16, H);
        }
        g.fillStyle = 'rgba(15,23,42,0.12)';
        g.fillRect(0, 4, W, 6);
        g.fillRect(0, H - 10, W, 6);
      });
      corrugatedSteelTex.wrapS = corrugatedSteelTex.wrapT = THREE.RepeatWrapping;
      corrugatedSteelTex.repeat.set(3, 1);
      const containerOrange = std({ map: corrugatedSteelTex, color: 0xe05d19, roughness: 0.44, metalness: 0.56 });
      const containerNavy = std({ map: corrugatedSteelTex, color: 0x1e3f66, roughness: 0.44, metalness: 0.56 });
      const containerTeal = std({ map: corrugatedSteelTex, color: 0x16697a, roughness: 0.44, metalness: 0.56 });
      const galvanizedSteel = std({ map: corrugatedSteelTex, color: 0x64748b, roughness: 0.38, metalness: 0.72 });

      const perforatedSteel = std({ color: 0x1e2530, roughness: 0.46, metalness: 0.72 });
      const brushedAluminum = std({ color: 0xc2ccd6, roughness: 0.26, metalness: 0.88 });
      const birchCrateWood = std({ color: 0xc89d66, roughness: 0.62, metalness: 0.04 });
      const safetyYellowMat = std({ color: 0xfacc15, roughness: 0.4, metalness: 0.22 });
      const cargoSteelGlass = new THREE.MeshStandardMaterial({
        color: 0xcfe7f7,
        roughness: 0.08,
        metalness: 0.1,
        transparent: true,
        opacity: 0.22,
        envMapIntensity: 0.78,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      // Exclusive Architectural Helpers for SwiftPort Cargo & Logistics
      const addCargoSign = (parent: THREE.Object3D, title: string, x: number, y: number, z: number, rotY = 0) => {
        const tex = makeCanvasTex(`cargo_sign_${title}`, 390, 74, (g, w, h) => {
          g.fillStyle = '#11161f';
          g.fillRect(0, 0, w, h);
          // Caution hazard diagonal stripes on left edge
          g.fillStyle = '#f97316';
          g.fillRect(0, 0, 22, h);
          g.fillStyle = '#11161f';
          for (let y = -16; y < h; y += 18) {
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(22, y + 14);
            g.lineTo(22, y + 22);
            g.lineTo(0, y + 8);
            g.closePath();
            g.fill();
          }
          g.strokeStyle = '#64748b';
          g.lineWidth = 3;
          g.strokeRect(2, 2, w - 4, h - 4);
          g.fillStyle = '#f8fafc';
          g.font = '800 17px "IBM Plex Mono", monospace';
          g.textAlign = 'left';
          g.textBaseline = 'middle';
          g.fillText(title, 36, h * 0.5);
        }, true, true);
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.56, 0.3),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
        );
        mesh.position.set(x, y, z);
        mesh.rotation.y = rotY;
        parent.add(mesh);
      };

      // Exposed Steel I-Beam Gantry Ceiling Grid & Suspended Industrial High-Bay Linear Lamps
      const addIndustrialCeilingRig = (parent: THREE.Object3D, ceilTopY: number, zBays: number[]) => {
        zBays.forEach((zb) => {
          boxAt(parent, spec.w - 2.4, 0.16, 0.16, spec.cx, ceilTopY - 0.16, zb, brushedAluminum, true, false);
          boxAt(parent, spec.w - 2.4, 0.04, 0.34, spec.cx, ceilTopY - 0.25, zb, perforatedSteel, false, false);
        });
        [-10.2, -3.4, 3.4, 10.2].forEach((xb) => {
          boxAt(parent, 0.12, 0.12, spec.d - 2.4, spec.cx + xb, ceilTopY - 0.22, spec.cz, perforatedSteel, false, false);
          // Suspended high-bay linear fixture pods
          [-4.2, 4.2].forEach((lz) => {
            cylAt(parent, 0.012, 0.012, 0.45, spec.cx + xb, ceilTopY - 0.46, spec.cz + lz, brushedAluminum, false, false, 6);
            boxAt(parent, 0.24, 0.08, 1.85, spec.cx + xb, ceilTopY - 0.68, spec.cz + lz, perforatedSteel, true, false);
            boxAt(parent, 0.16, 0.02, 1.72, spec.cx + xb, ceilTopY - 0.72, spec.cz + lz, new THREE.MeshBasicMaterial({ color: 0xf8fafc }), false, false);
          });
        });
      };

      // Architectural Re-Purposed 20ft Corrugated Container Cutaway Wall & Portal
      const addContainerDivider = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        len: number,
        h: number,
        mat: THREE.Material,
        rotY = 0
      ) => {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        g.rotation.y = rotY;
        boxAt(g, len, h, 0.22, 0, h * 0.5, 0, mat, true, true, 0.01);
        // Top & bottom ISO container structural corner castings & rails
        boxAt(g, len + 0.04, 0.14, 0.26, 0, 0.07, 0, perforatedSteel, true, false);
        boxAt(g, len + 0.04, 0.14, 0.26, 0, h - 0.07, 0, perforatedSteel, true, false);
        [-len * 0.5 + 0.08, len * 0.5 - 0.08].forEach((ex) => {
          boxAt(g, 0.16, h, 0.26, ex, h * 0.5, 0, perforatedSteel, true, false);
        });
        parent.add(g);
      };

      // Multi-Part Sculpted Electric Cargo Forklift (10-part THREE.Group)
      const addCargoForklift = (parent: THREE.Object3D, x: number, y: number, z: number, rotY = 0) => {
        const fl = new THREE.Group();
        fl.position.set(x, y, z);
        fl.rotation.y = rotY;
        // 4 Industrial rubber tires
        [
          [-0.48, 0.56, 0.22],
          [0.48, 0.56, 0.22],
          [-0.44, -0.58, 0.18],
          [0.44, -0.58, 0.18],
        ].forEach(([wx, wz, wr]) => {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.16, 16), M.dark);
          w.rotation.z = Math.PI / 2;
          w.position.set(wx, wr, wz);
          w.castShadow = true;
          fl.add(w);
        });
        // Counterweight body & cab hood
        boxAt(fl, 0.96, 0.62, 1.45, 0, 0.52, -0.05, accentMat, true, true, 0.04);
        boxAt(fl, 0.92, 0.24, 0.48, 0, 0.68, -0.55, perforatedSteel, true, true, 0.02);
        // Overhead roll cage (4 posts + roof guard + safety beacon)
        [
          [-0.4, 0.35],
          [0.4, 0.35],
          [-0.4, -0.45],
          [0.4, -0.45],
        ].forEach(([px, pz]) => {
          cylAt(fl, 0.028, 0.028, 1.15, px, 1.38, pz, perforatedSteel, true, false, 8);
        });
        boxAt(fl, 0.88, 0.05, 0.92, 0, 1.96, -0.05, perforatedSteel, true, false);
        cylAt(fl, 0.06, 0.07, 0.12, 0, 2.04, -0.35, safetyYellowMat, false, false, 10);
        // Twin vertical hydraulic mast channels & pallet forks + cargo crate
        [-0.24, 0.24].forEach((mx) => {
          boxAt(fl, 0.08, 1.85, 0.1, mx, 1.1, 0.78, brushedAluminum, true, false);
          boxAt(fl, 0.09, 0.04, 0.92, mx, 0.26, 1.24, brushedAluminum, true, false);
        });
        boxAt(fl, 0.9, 0.1, 0.85, 0, 0.33, 1.28, palletMat, true, true, 0.01);
        boxAt(fl, 0.78, 0.55, 0.74, 0, 0.65, 1.28, cartonMat, true, true, 0.02);
        parent.add(fl);
      };

      // Industrial Barrel Coffee / Side Table
      const addSteelDrumTable = (parent: THREE.Object3D, x: number, y: number, z: number, mat: THREE.Material) => {
        cylAt(parent, 0.28, 0.28, 0.56, x, y + 0.28, z, mat, true, true, 18);
        [0.14, 0.42].forEach((ry) => {
          cylAt(parent, 0.295, 0.295, 0.03, x, y + ry, z, brushedAluminum, false, false, 18);
        });
        cylAt(parent, 0.42, 0.42, 0.04, x, y + 0.58, z, birchCrateWood, true, true, 20);
      };

      // Reusable Dynamic Air-Sea Freight & Port Analytics Screens
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

      const corridorRadarScreen = createCustomBoardScreen(screenReg, 520, 260, (g, w, h, t) => {
        g.fillStyle = '#0c131c';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#1e293b';
        g.fillRect(0, 0, w, 36);
        g.fillStyle = '#f97316';
        g.fillRect(0, 0, 8, 36);
        g.fillStyle = '#f8fafc';
        g.font = '800 15px "IBM Plex Mono", monospace';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('MOMBASA PORT · JKIA AIR · NORTHERN CORRIDOR', 18, 18);
        // Freight network grid
        g.strokeStyle = 'rgba(148,163,184,0.16)';
        g.lineWidth = 1;
        for (let gx = 40; gx < w; gx += 48) {
          g.beginPath();
          g.moveTo(gx, 42);
          g.lineTo(gx, h - 12);
          g.stroke();
        }
        const hubs: Array<[number, number, string]> = [
          [78, 92, 'KAMPALA ICD'],
          [190, 128, 'ELDORET'],
          [275, 152, 'NAIROBI HUB'],
          [325, 140, 'JKIA CARGO'],
          [432, 212, 'MOMBASA PORT'],
        ];
        g.strokeStyle = '#38bdf8';
        g.lineWidth = 2.5;
        g.beginPath();
        hubs.forEach(([hx, hy], hi) => (hi === 0 ? g.moveTo(hx, hy) : g.lineTo(hx, hy)));
        g.stroke();
        hubs.forEach(([hx, hy, lbl], hi) => {
          const active = hi === Math.floor(t * 1.1) % hubs.length;
          g.fillStyle = active ? '#facc15' : '#f97316';
          g.beginPath();
          g.arc(hx, hy, active ? 6.5 : 4.5, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#e2e8f0';
          g.font = '700 11px monospace';
          g.fillText(lbl, hx - 24, hy - 12);
        });
      });

      // -------------------------------------------------------------------------
      // FLOOR 0 (G): Automated Freight Hall, Overhead Gantry Crane & Dispatch Counter
      // -------------------------------------------------------------------------
      boxAt(g0, 31.2, 0.018, 19.2, spec.cx, fy + 0.009, spec.cz, cargoEpoxyFloor, false, true);
      // Safety orange aisle strips framing the East dock walkway & automated belt
      boxAt(g0, 0.14, 0.02, 13.0, spec.cx + 10.6, fy + 0.012, spec.cz, accentMat, false, false);
      boxAt(g0, 0.14, 0.02, 10.2, spec.cx - 2.8, fy + 0.012, spec.cz + 0.8, safetyYellowMat, false, false);
      addIndustrialCeilingRig(levelCeilings[0], spec.groundY + spec.floorH - 0.12, [spec.cz - 5.6, spec.cz, spec.cz + 5.6]);

      // Overhead Bridge Gantry Crane above West-North staging & conveyor zone (dx -8.4, dz -4.2)
      [-5.6, -2.8].forEach((gz) => {
        boxAt(g0, 12.6, 0.22, 0.24, spec.cx - 7.8, fy + 3.42, spec.cz + gz, safetyYellowMat, true, false);
      });
      boxAt(g0, 1.15, 0.28, 3.2, spec.cx - 6.8, fy + 3.36, spec.cz - 4.2, containerOrange, true, false);
      cylAt(g0, 0.02, 0.02, 1.15, spec.cx - 6.8, fy + 2.75, spec.cz - 4.2, brushedAluminum, false, false, 8);
      boxAt(g0, 1.35, 0.12, 0.9, spec.cx - 6.8, fy + 2.15, spec.cz - 4.2, perforatedSteel, true, false);

      // Electric Cargo Forklift staged near NE loading dock lane (cx + 9.8, cz - 5.2)
      addCargoForklift(g0, spec.cx + 9.8, fy, spec.cz - 5.2, -0.55);

      // Automated Parcel Sorting Conveyor Belt (running N-S at cx - 4.2, cz + 0.8)
      const convX = spec.cx - 4.2;
      const convZ = spec.cz + 0.8;
      boxAt(g0, 1.45, 0.14, 9.4, convX, fy + 0.78, convZ, perforatedSteel, true, true, 0.02);
      boxAt(g0, 1.18, 0.05, 9.25, convX, fy + 0.87, convZ, M.dark, false, false);
      for (let zOff = -4.0; zOff <= 4.0; zOff += 2.0) {
        boxAt(g0, 1.24, 0.72, 0.1, convX, fy + 0.36, convZ + zOff, brushedAluminum, true, false);
      }
      boxAt(g0, 1.65, 0.95, 0.45, convX, fy + 1.32, convZ - 0.6, perforatedSteel, true, false, 0.02);
      boxAt(g0, 1.35, 0.08, 0.12, convX, fy + 1.55, convZ - 0.6, accentMat, false, false);
      [-3.3, -1.6, 0.6, 2.3, 3.7].forEach((pz, pi) => {
        const bw = 0.52 + (pi % 2) * 0.14;
        const bh = 0.34 + (pi % 3) * 0.08;
        boxAt(g0, bw, bh, 0.54, convX + ((pi % 2) - 0.5) * 0.18, fy + 0.9 + bh * 0.5, convZ + pz, pi === 2 ? containerOrange : cartonMat, true, true, 0.015);
      });

      // Heavy Pallet Storage Racks in NW Warehouse Wing (strictly North of SW stairwell dz + 2.80)
      [-4.8, -0.6].forEach((rz) => {
        const rx = spec.cx - 12.2;
        const rCz = spec.cz + rz;
        [-1.3, 1.3].forEach((ox) => {
          [-1.7, 1.7].forEach((oz) => {
            boxAt(g0, 0.1, 2.8, 0.1, rx + ox, fy + 1.4, rCz + oz, accentMat, true, false);
          });
        });
        [0.45, 1.55, 2.65].forEach((ry, li) => {
          boxAt(g0, 2.7, 0.08, 3.5, rx, fy + ry, rCz, perforatedSteel, true, true);
          if (li < 2) {
            boxAt(g0, 1.9, 0.65, 1.15, rx, fy + ry + 0.36, rCz - 0.8, cartonMat, true, true, 0.02);
            boxAt(g0, 1.9, 0.65, 1.15, rx, fy + ry + 0.36, rCz + 0.8, palletMat, true, true, 0.02);
          }
        });
      });

      // 3-Station Waybill Dispatch & Customs Counter (dx +5.8, dz +2.5)
      const deskZ = spec.cz + 2.5;
      boxAt(g0, 7.6, 1.04, 0.52, spec.cx + 5.8, fy + 0.52, deskZ - 0.34, containerNavy, true, true, 0.03);
      boxAt(g0, 7.8, 0.08, 0.6, spec.cx + 5.8, fy + 1.06, deskZ - 0.34, accentMat, false, false);
      boxAt(g0, 7.6, 0.06, 0.94, spec.cx + 5.8, fy + 0.75, deskZ + 0.39, birchCrateWood, true, true, 0.015);
      [2.1, 4.5, 7.1, 9.5].forEach((lx) => {
        boxAt(g0, 0.14, 0.72, 0.78, spec.cx + lx, fy + 0.36, deskZ + 0.34, perforatedSteel, true, true, 0.01);
      });
      [3.2, 5.8, 8.4].forEach((ox, i) => {
        const sx = spec.cx + ox;
        const sz = deskZ + 1.15;
        registerChair(0, sx, fy, sz, Math.PI, i % 2 === 0 ? 1 : -1);
        registerMonitor(
          0,
          i,
          [sx, fy + 0.78, deskZ + 0.43],
          0,
          sx,
          sz,
          i === 0 ? 'Freight Dispatch Manager' : i === 1 ? 'Customs & Waybill Officer' : 'Air-Cargo Clearance Coordinator',
          'Dispatch & Waybill Control'
        );
      });

      // Live SwiftPort GPS Fleet & Freight Telemetry Board (facing north door -Z)
      boxAt(g0, 7.8, 2.35, 0.14, spec.cx + 1.5, fy + 2.35, spec.cz + 9.7, perforatedSteel, false, false);
      const logMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 2.1), logBoard.mat);
      logMesh.position.set(spec.cx + 1.5, fy + 2.35, spec.cz + 9.62);
      logMesh.rotation.y = Math.PI;
      g0.add(logMesh);
      logBoard.setMesh(logMesh);

      // -------------------------------------------------------------------------
      // FLOOR 1 (L1): Global Route Planning, Customs Brokerage & Cold-Chain Ops
      // -------------------------------------------------------------------------
      const lg1 = levelGroups[1];
      if (lg1) {
        const lfy1 = spec.groundY + spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: lfy1 + 3.2,
          z: spec.cz,
          color: 0xeef6ff,
          distance: 28,
          baseScale: 1.03,
          floor: 1,
          buildingId: spec.id,
        });

        // Non-overlapping epoxy floor clearing SW stairwell void (-14.32..-11.28 x +4.15..+7.95)
        boxAt(lg1, 31.2, 0.018, 13.7, spec.cx, lfy1 + 0.009, spec.cz - 2.75, cargoEpoxyFloor, false, true);
        boxAt(lg1, 26.8, 0.018, 4.0, spec.cx + 2.2, lfy1 + 0.009, spec.cz + 6.1, cargoEpoxyFloor, false, true);
        boxAt(lg1, 1.3, 0.018, 4.0, spec.cx - 14.95, lfy1 + 0.009, spec.cz + 6.1, cargoEpoxyFloor, false, true);
        boxAt(lg1, 31.2, 0.018, 1.5, spec.cx, lfy1 + 0.009, spec.cz + 8.85, cargoEpoxyFloor, false, true);
        addIndustrialCeilingRig(levelCeilings[1], spec.groundY + 2 * spec.floorH - 0.12, [spec.cz - 5.2, spec.cz + 5.2]);

        let l1MonIdx = 0;

        // Cutaway Navy Shipping Container Partition dividing West Route Pods (open portal dz -1.2..+0.6)
        addContainerDivider(lg1, spec.cx - 3.4, lfy1, spec.cz - 5.1, 7.8, 2.75, containerNavy, Math.PI / 2);
        addContainerDivider(lg1, spec.cx - 3.4, lfy1, spec.cz + 4.8, 8.4, 2.75, containerNavy, Math.PI / 2);
        addCargoSign(lg1, 'CUSTOMS & PORT ROUTING', spec.cx - 3.22, lfy1 + 2.48, spec.cz - 0.3, Math.PI / 2);

        const l1PodX = spec.cx - 8.6;
        [spec.cz - 4.6, spec.cz + 0.2].forEach((pz, pi) => {
          boxAt(lg1, 3.3, 0.06, 1.38, l1PodX, lfy1 + 0.74, pz, birchCrateWood, true, true, 0.02);
          [-1.4, 1.4].forEach((lx) => {
            boxAt(lg1, 0.08, 0.72, 1.15, l1PodX + lx, lfy1 + 0.36, pz, perforatedSteel, true, true, 0.01);
          });
          boxAt(lg1, 3.1, 0.28, 0.05, l1PodX, lfy1 + 0.91, pz, containerOrange, false, false);
          if (pi === 0) {
            registerChair(1, l1PodX - 0.8, lfy1, pz - 1.05, 0, 1);
            registerMonitor(1, l1MonIdx++, [l1PodX - 0.8, lfy1 + 0.77, pz - 0.25], Math.PI, l1PodX - 0.8, pz - 1.05, 'Ocean & Port Routing Lead · L1', 'Global Route Planning');
            officeChair(lg1, l1PodX + 0.8, lfy1, pz - 1.05, 0, M);
            monitor(lg1, l1PodX + 0.8, lfy1 + 0.77, pz - 0.25, true, Math.PI, M);
            officeChair(lg1, l1PodX - 0.8, lfy1, pz + 1.05, Math.PI, M);
            monitor(lg1, l1PodX - 0.8, lfy1 + 0.77, pz + 0.25, true, 0, M);
            officeChair(lg1, l1PodX + 0.8, lfy1, pz + 1.05, Math.PI, M);
            monitor(lg1, l1PodX + 0.8, lfy1 + 0.77, pz + 0.25, true, 0, M);
          } else {
            registerChair(1, l1PodX + 0.8, lfy1, pz + 1.05, Math.PI, -1);
            registerMonitor(1, l1MonIdx++, [l1PodX + 0.8, lfy1 + 0.77, pz + 0.25], 0, l1PodX + 0.8, pz + 1.05, 'Customs Compliance Broker · L1', 'Global Route Planning');
            officeChair(lg1, l1PodX - 0.8, lfy1, pz - 1.05, 0, M);
            monitor(lg1, l1PodX - 0.8, lfy1 + 0.77, pz - 0.25, true, Math.PI, M);
            officeChair(lg1, l1PodX + 0.8, lfy1, pz - 1.05, 0, M);
            monitor(lg1, l1PodX + 0.8, lfy1 + 0.77, pz - 0.25, true, Math.PI, M);
            officeChair(lg1, l1PodX - 0.8, lfy1, pz + 1.05, Math.PI, M);
            monitor(lg1, l1PodX - 0.8, lfy1 + 0.77, pz + 0.25, true, 0, M);
          }
        });
        // Stenciled Archive Crate Console East of SW stairwell (cx - 7.4, cz + 6.8)
        boxAt(lg1, 3.2, 1.15, 0.78, spec.cx - 7.4, lfy1 + 0.575, spec.cz + 6.8, containerTeal, true, true, 0.02);
        boxAt(lg1, 3.28, 0.05, 0.84, spec.cx - 7.4, lfy1 + 1.17, spec.cz + 6.8, birchCrateWood, false, true);
        boxAt(lg1, 0.1, 1.9, 4.4, spec.cx - 15.65, lfy1 + 1.88, spec.cz - 2.4, perforatedSteel, false, false);
        const l1WestTv = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.72), corridorRadarScreen.mat);
        l1WestTv.position.set(spec.cx - 15.56, lfy1 + 1.88, spec.cz - 2.4);
        l1WestTv.rotation.y = Math.PI / 2;
        lg1.add(l1WestTv);

        // Center Zone: Steel-Drum & Birch Quick-Huddle Dispatch Table + Cold-Chain Telemetry Desk
        cylAt(lg1, 0.96, 0.96, 0.06, spec.cx + 1.4, lfy1 + 0.74, spec.cz - 3.8, birchCrateWood, true, true, 24);
        cylAt(lg1, 0.32, 0.34, 0.72, spec.cx + 1.4, lfy1 + 0.36, spec.cz - 3.8, containerOrange, true, true, 18);
        [
          [-1.32, 0, Math.PI / 2],
          [1.32, 0, -Math.PI / 2],
          [0, -1.32, 0],
          [0, 1.32, Math.PI],
        ].forEach(([ox, oz, rot]) => {
          const ch = officeChair(lg1, spec.cx + 1.4 + ox, lfy1, spec.cz - 3.8 + oz, rot, M);
          void ch;
        });

        boxAt(lg1, 2.7, 0.06, 1.08, spec.cx + 1.4, lfy1 + 0.74, spec.cz + 4.4, birchCrateWood, true, true, 0.02);
        [-1.1, 1.1].forEach((lx) => boxAt(lg1, 0.08, 0.72, 0.88, spec.cx + 1.4 + lx, lfy1 + 0.36, spec.cz + 4.4, perforatedSteel, true, true, 0.01));
        registerChair(1, spec.cx + 1.4, lfy1, spec.cz + 5.32, Math.PI, 1);
        registerMonitor(1, l1MonIdx++, [spec.cx + 1.4, lfy1 + 0.77, spec.cz + 4.55], 0, spec.cx + 1.4, spec.cz + 5.32, 'Cold-Chain Telemetry Lead · L1', 'Cold-Chain Telemetry');
        [spec.cx + 0.65, spec.cx + 2.15].forEach((vx) => {
          const vc = armchair(lg1, vx, lfy1, spec.cz + 3.1, 0, M.fabricGrey, M);
          vc.scale.set(0.74, 0.88, 0.74);
        });

        // East Wing: Burnt-Orange Container Driver Briefing & Espresso Counter + Corridor Map
        boxAt(lg1, 4.4, 0.96, 0.92, spec.cx + 10.2, lfy1 + 0.48, spec.cz - 4.8, containerOrange, true, true, 0.02);
        boxAt(lg1, 4.52, 0.06, 1.0, spec.cx + 10.2, lfy1 + 0.99, spec.cz - 4.8, birchCrateWood, false, true, 0.02);
        [-1.2, 0, 1.2].forEach((ox) => {
          cylAt(lg1, 0.2, 0.2, 0.09, spec.cx + 10.2 + ox, lfy1 + 0.68, spec.cz - 3.7, M.fabricCognac, true, true, 16);
          cylAt(lg1, 0.035, 0.035, 0.66, spec.cx + 10.2 + ox, lfy1 + 0.33, spec.cz - 3.7, perforatedSteel, false, false, 10);
          cylAt(lg1, 0.17, 0.2, 0.04, spec.cx + 10.2 + ox, lfy1 + 0.02, spec.cz - 3.7, perforatedSteel, false, true, 14);
        });
        // Acoustic Galvanized Container Phone Booth (cx + 10.8, cz + 4.8)
        boxAt(lg1, 1.65, 2.45, 1.65, spec.cx + 10.8, lfy1 + 1.225, spec.cz + 4.8, galvanizedSteel, true, true, 0.02);
        boxAt(lg1, 1.1, 1.85, 0.06, spec.cx + 10.8, lfy1 + 1.18, spec.cz + 3.96, cargoSteelGlass, false, false);
        boxAt(lg1, 0.1, 1.9, 4.2, spec.cx + 15.65, lfy1 + 1.88, spec.cz - 2.6, perforatedSteel, false, false);
        const l1EastTv = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.72), logBoard.mat);
        l1EastTv.position.set(spec.cx + 15.56, lfy1 + 1.88, spec.cz - 2.6);
        l1EastTv.rotation.y = -Math.PI / 2;
        lg1.add(l1EastTv);
        plant(lg1, spec.cx + 14.0, lfy1, spec.cz - 7.8, 1.2, 1401, M, 'ficus');
      }

      // -------------------------------------------------------------------------
      // FLOOR 2 (L2): Automated Warehouse Showroom, Port Diorama & Packaging Lab
      // -------------------------------------------------------------------------
      const lg2 = levelGroups[2];
      if (lg2) {
        const lfy2 = spec.groundY + 2 * spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: lfy2 + 3.2,
          z: spec.cz,
          color: 0xeef6ff,
          distance: 28,
          baseScale: 1.05,
          floor: 2,
          buildingId: spec.id,
        });

        boxAt(lg2, 31.2, 0.018, 13.7, spec.cx, lfy2 + 0.009, spec.cz - 2.75, cargoEpoxyFloor, false, true);
        boxAt(lg2, 26.8, 0.018, 4.0, spec.cx + 2.2, lfy2 + 0.009, spec.cz + 6.1, cargoEpoxyFloor, false, true);
        boxAt(lg2, 1.3, 0.018, 4.0, spec.cx - 14.95, lfy2 + 0.009, spec.cz + 6.1, cargoEpoxyFloor, false, true);
        boxAt(lg2, 31.2, 0.018, 1.5, spec.cx, lfy2 + 0.009, spec.cz + 8.85, cargoEpoxyFloor, false, true);
        addIndustrialCeilingRig(levelCeilings[2], spec.groundY + 3 * spec.floorH - 0.12, [spec.cz - 5.2, spec.cz + 5.2]);

        let l2MonIdx = 0;

        // West North: Scale Container Port, Ship & Gantry Crane Diorama (cx - 8.8, cz - 4.4)
        const portX = spec.cx - 8.8;
        const portZ = spec.cz - 4.4;
        boxAt(lg2, 4.8, 0.78, 2.8, portX, lfy2 + 0.39, portZ, perforatedSteel, true, true, 0.03);
        // Sea channel basin + berth apron
        boxAt(lg2, 4.5, 0.05, 1.25, portX, lfy2 + 0.8, portZ - 0.6, std({ color: 0x0c4a6e, roughness: 0.18 }), false, true);
        boxAt(lg2, 4.5, 0.07, 1.35, portX, lfy2 + 0.81, portZ + 0.65, std({ color: 0x64748b, roughness: 0.72 }), false, true);
        // Multi-part scale container vessel docked at quay
        boxAt(lg2, 3.2, 0.28, 0.68, portX - 0.2, lfy2 + 0.94, portZ - 0.56, containerNavy, true, false, 0.02);
        boxAt(lg2, 0.45, 0.44, 0.62, portX - 1.35, lfy2 + 1.24, portZ - 0.56, M.white, false, false);
        [-0.5, 0.15, 0.8].forEach((cxo, ci) => {
          boxAt(lg2, 0.52, 0.22, 0.52, portX + cxo, lfy2 + 1.18, portZ - 0.56, ci === 1 ? containerOrange : containerTeal, false, false);
        });
        // Two miniature red/orange ship-to-shore gantry cranes on berth
        [-0.6, 0.85].forEach((gx) => {
          boxAt(lg2, 0.14, 0.85, 0.42, portX + gx, lfy2 + 1.26, portZ + 0.32, containerOrange, false, false);
          boxAt(lg2, 0.18, 0.1, 1.45, portX + gx, lfy2 + 1.68, portZ - 0.15, safetyYellowMat, false, false);
        });
        addCargoSign(lg2, 'MOMBASA PORT SCALE MODEL', portX, lfy2 + 0.44, portZ + 1.44, 0);

        // Mid-West South: Autonomous AGV Warehouse Robot & Smart-Rack Demo Bay (cx - 6.8, cz + 4.8 — clear of SW stairwell)
        const agvX = spec.cx - 6.8;
        const agvZ = spec.cz + 4.8;
        boxAt(lg2, 4.4, 0.04, 3.2, agvX, lfy2 + 0.02, agvZ, std({ color: 0x1e293b, roughness: 0.5 }), false, true);
        // Smart RFID pallet rack + Autonomous Robot carrier
        boxAt(lg2, 3.4, 2.15, 0.72, agvX, lfy2 + 1.075, agvZ + 1.05, galvanizedSteel, true, true);
        boxAt(lg2, 1.05, 0.24, 0.85, agvX - 0.65, lfy2 + 0.14, agvZ - 0.45, containerOrange, true, true, 0.02);
        boxAt(lg2, 0.76, 0.44, 0.64, agvX - 0.65, lfy2 + 0.48, agvZ - 0.45, cartonMat, true, false, 0.02);
        boxAt(lg2, 3.6, 0.08, 0.12, agvX, lfy2 + 2.22, agvZ - 0.45, safetyYellowMat, false, false);
        [-1.7, 1.7].forEach((px) => boxAt(lg2, 0.1, 2.2, 0.1, agvX + px, lfy2 + 1.1, agvZ - 0.45, perforatedSteel, true, false));

        // Center Zone: Packaging & Pallet Engineering Atelier + 2 Specialist Stations
        boxAt(lg2, 3.4, 1.85, 0.42, spec.cx + 1.8, lfy2 + 0.925, spec.cz - 3.6, perforatedSteel, true, true, 0.02);
        [cartonMat, containerTeal, birchCrateWood, containerOrange].forEach((pm, pi) => {
          boxAt(lg2, 0.65, 0.72, 0.22, spec.cx + 0.62 + pi * 0.78, lfy2 + 1.2, spec.cz - 3.55, pm, false, false);
        });
        boxAt(lg2, 2.7, 0.06, 1.08, spec.cx + 1.8, lfy2 + 0.74, spec.cz + 3.2, birchCrateWood, true, true, 0.02);
        [-1.1, 1.1].forEach((lx) => boxAt(lg2, 0.08, 0.72, 0.88, spec.cx + 1.8 + lx, lfy2 + 0.36, spec.cz + 3.2, perforatedSteel, true, true, 0.01));
        registerChair(2, spec.cx + 1.8, lfy2, spec.cz + 4.12, Math.PI, 1);
        registerMonitor(2, l2MonIdx++, [spec.cx + 1.8, lfy2 + 0.77, spec.cz + 3.35], 0, spec.cx + 1.8, spec.cz + 4.12, 'Supply-Chain Systems Architect · L2', 'Logistics Automation Lab');

        boxAt(lg2, 2.7, 0.06, 1.08, spec.cx + 9.8, lfy2 + 0.74, spec.cz - 5.2, birchCrateWood, true, true, 0.02);
        [-1.1, 1.1].forEach((lx) => boxAt(lg2, 0.08, 0.72, 0.88, spec.cx + 9.8 + lx, lfy2 + 0.36, spec.cz - 5.2, perforatedSteel, true, true, 0.01));
        registerChair(2, spec.cx + 9.8, lfy2, spec.cz - 6.12, 0, -1);
        registerMonitor(2, l2MonIdx++, [spec.cx + 9.8, lfy2 + 0.77, spec.cz - 5.35], Math.PI, spec.cx + 9.8, spec.cz - 6.12, 'Fleet Electrification & Robotics Lead · L2', 'Logistics Automation Lab');

        // East Mid: Industrial Barrel & Leather Client Lounge + East Port Analytics Screen
        const l2Sofa = sofaWide(lg2, spec.cx + 11.4, lfy2, spec.cz + 1.8, -Math.PI / 2, M.fabricGrey, M);
        l2Sofa.scale.set(0.8, 0.92, 0.84);
        addSteelDrumTable(lg2, spec.cx + 9.4, lfy2, spec.cz + 1.8, containerOrange);
        const l2Arm1 = armchair(lg2, spec.cx + 8.0, lfy2, spec.cz + 0.9, Math.PI * 0.35, M.fabricCognac, M);
        l2Arm1.scale.set(0.74, 0.88, 0.74);
        const l2Arm2 = armchair(lg2, spec.cx + 8.0, lfy2, spec.cz + 2.7, Math.PI * 0.65, M.fabricCognac, M);
        l2Arm2.scale.set(0.74, 0.88, 0.74);
        boxAt(lg2, 0.1, 1.9, 4.2, spec.cx + 15.65, lfy2 + 1.88, spec.cz + 1.8, perforatedSteel, false, false);
        const l2EastTv = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.72), corridorRadarScreen.mat);
        l2EastTv.position.set(spec.cx + 15.56, lfy2 + 1.88, spec.cz + 1.8);
        l2EastTv.rotation.y = -Math.PI / 2;
        lg2.add(l2EastTv);
        plant(lg2, spec.cx + 14.0, lfy2, spec.cz + 7.6, 1.25, 1402, M, 'ficus');
      }

      // -------------------------------------------------------------------------
      // FLOOR 3 (L3): Maritime & Air-Freight Boardroom, CEO Control Deck & Head Offices
      // -------------------------------------------------------------------------
      const lg3 = levelGroups[3];
      if (lg3) {
        const lfy3 = spec.groundY + 3 * spec.floorH + SLAB_THICK * 0.5;
        warmLights.push({
          x: spec.cx,
          y: lfy3 + 3.25,
          z: spec.cz,
          color: 0xf1f7ff,
          distance: 29,
          baseScale: 1.08,
          floor: 3,
          buildingId: spec.id,
        });

        boxAt(lg3, 31.2, 0.018, 13.7, spec.cx, lfy3 + 0.009, spec.cz - 2.75, cargoEpoxyFloor, false, true);
        boxAt(lg3, 26.8, 0.018, 4.0, spec.cx + 2.2, lfy3 + 0.009, spec.cz + 6.1, cargoEpoxyFloor, false, true);
        boxAt(lg3, 1.3, 0.018, 4.0, spec.cx - 14.95, lfy3 + 0.009, spec.cz + 6.1, cargoEpoxyFloor, false, true);
        boxAt(lg3, 31.2, 0.018, 1.5, spec.cx, lfy3 + 0.009, spec.cz + 8.85, cargoEpoxyFloor, false, true);
        addIndustrialCeilingRig(levelCeilings[3], spec.groundY + 4 * spec.floorH - 0.12, [spec.cz - 5.2, spec.cz + 5.2]);

        let l3MonIdx = 0;

        // 1. EAST WING (dx +4.4..+15.2): Global Trade & Port Alliances Boardroom (open portal dz -1.6..+0.2)
        const lgBrWallX = spec.cx + 4.4;
        boxAt(lg3, 0.08, 3.05, 6.2, lgBrWallX, lfy3 + 1.525, spec.cz - 4.7, cargoSteelGlass, false, false);
        boxAt(lg3, 0.08, 3.05, 8.8, lgBrWallX, lfy3 + 1.525, spec.cz + 4.6, cargoSteelGlass, false, false);
        boxAt(lg3, 0.14, 0.14, 17.6, lgBrWallX, lfy3 + 3.05, spec.cz, perforatedSteel, true, false);
        [-7.8, -1.6, 0.2, 3.6, 8.8].forEach((mz) => {
          boxAt(lg3, 0.14, 3.06, 0.14, lgBrWallX, lfy3 + 1.53, spec.cz + mz, brushedAluminum, true, false);
        });
        addCargoSign(lg3, 'GLOBAL TRADE BOARDROOM', lgBrWallX - 0.1, lfy3 + 2.74, spec.cz - 0.7, -Math.PI / 2);

        const lgBrX = spec.cx + 9.8;
        const lgBrZ = spec.cz + 0.0;
        // Steel I-Beam & Smoked Birch 12-Seat Boardroom Table (2.9m x 7.2m)
        boxAt(lg3, 2.85, 0.08, 7.1, lgBrX, lfy3 + 0.75, lgBrZ, birchCrateWood, true, true, 0.03);
        boxAt(lg3, 2.94, 0.04, 7.2, lgBrX, lfy3 + 0.71, lgBrZ, perforatedSteel, true, true, 0.01);
        [-2.2, 2.2].forEach((pz) => {
          boxAt(lg3, 1.35, 0.68, 0.28, lgBrX, lfy3 + 0.34, lgBrZ + pz, containerNavy, true, true, 0.02);
        });
        registerChair(3, lgBrX, lfy3, lgBrZ - 4.05, 0, 1);
        registerMonitor(3, l3MonIdx++, [lgBrX, lfy3 + 0.8, lgBrZ - 3.1], Math.PI, lgBrX, lgBrZ - 4.05, 'VP Global Freight & Maritime · L3', 'Global Trade Boardroom');
        registerChair(3, lgBrX - 2.05, lfy3, lgBrZ - 1.4, Math.PI / 2, -1);
        registerMonitor(3, l3MonIdx++, [lgBrX - 1.15, lfy3 + 0.8, lgBrZ - 1.4], -Math.PI / 2, lgBrX - 2.05, lgBrZ - 1.4, 'Director of Customs & Trade Corridors · L3', 'Global Trade Boardroom');
        officeChair(lg3, lgBrX, lfy3, lgBrZ + 4.05, Math.PI, M);
        [-2.6, -0.2, 1.0, 2.2].forEach((czo) => officeChair(lg3, lgBrX - 2.05, lfy3, lgBrZ + czo, Math.PI / 2, M));
        [-2.6, -1.4, -0.2, 1.0, 2.2].forEach((czo) => officeChair(lg3, lgBrX + 2.05, lfy3, lgBrZ + czo, -Math.PI / 2, M));

        boxAt(lg3, 0.1, 2.1, 5.2, spec.cx + 15.65, lfy3 + 1.92, lgBrZ, perforatedSteel, false, false);
        const l3BrTv = new THREE.Mesh(new THREE.PlaneGeometry(4.95, 1.9), logBoard.mat);
        l3BrTv.position.set(spec.cx + 15.56, lfy3 + 1.92, lgBrZ);
        l3BrTv.rotation.y = -Math.PI / 2;
        lg3.add(l3BrTv);
        plant(lg3, spec.cx + 14.0, lfy3, spec.cz - 7.8, 1.25, 1403, M, 'ficus');
        plant(lg3, spec.cx + 14.0, lfy3, spec.cz + 7.8, 1.25, 1404, M, 'olive');

        // 2. BACK CENTER (dx -4.2..+3.6, dz +2.2..+9.2): CEO & CHIEF LOGISTICS OFFICER COMMAND SUITE (portal dx -1.2..+0.4)
        const ceoLgX = spec.cx - 0.3;
        const ceoLgFrontZ = spec.cz + 2.2;
        boxAt(lg3, 3.0, 3.05, 0.08, spec.cx - 2.7, lfy3 + 1.525, ceoLgFrontZ, cargoSteelGlass, false, false);
        boxAt(lg3, 3.2, 3.05, 0.08, spec.cx + 2.0, lfy3 + 1.525, ceoLgFrontZ, cargoSteelGlass, false, false);
        boxAt(lg3, 7.8, 0.14, 0.14, ceoLgX, lfy3 + 3.05, ceoLgFrontZ, perforatedSteel, true, false);
        boxAt(lg3, 0.08, 3.05, 7.0, spec.cx - 4.2, lfy3 + 1.525, spec.cz + 5.7, cargoSteelGlass, false, false);
        [-4.2, -1.2, 0.4, 3.6].forEach((px) => {
          boxAt(lg3, 0.14, 3.06, 0.14, spec.cx + px, lfy3 + 1.53, ceoLgFrontZ, brushedAluminum, true, false);
        });
        addCargoSign(lg3, 'CEO · LOGISTICS COMMAND', spec.cx + 1.8, lfy3 + 2.74, ceoLgFrontZ - 0.09, Math.PI);

        // Industrial Blueprint & Scale Container Trophy Wall
        boxAt(lg3, 5.8, 2.95, 0.44, ceoLgX, lfy3 + 1.475, spec.cz + 9.05, containerNavy, true, true, 0.02);
        [0.9, 1.72, 2.45].forEach((sy) => {
          boxAt(lg3, 5.2, 0.05, 0.38, ceoLgX, lfy3 + sy, spec.cz + 9.03, birchCrateWood, false, false);
        });
        [-1.0, 1.0].forEach((mx, mi) => {
          boxAt(lg3, 0.62, 0.28, 0.28, ceoLgX + mx, lfy3 + 1.88, spec.cz + 8.95, mi === 0 ? containerOrange : containerTeal, false, false);
        });
        boxAt(lg3, 2.8, 0.065, 1.14, ceoLgX, lfy3 + 0.74, spec.cz + 5.8, birchCrateWood, true, true, 0.02);
        boxAt(lg3, 2.6, 0.72, 0.14, ceoLgX, lfy3 + 0.36, spec.cz + 5.38, perforatedSteel, true, true, 0.01);
        registerChair(3, ceoLgX, lfy3, spec.cz + 6.76, Math.PI, -1);
        registerMonitor(3, l3MonIdx++, [ceoLgX, lfy3 + 0.77, spec.cz + 5.93], 0, ceoLgX, spec.cz + 6.76, 'Chief Executive Officer · L3', 'CEO Logistics Command Suite');
        [spec.cx - 1.05, spec.cx + 0.45].forEach((gx) => {
          const gc = armchair(lg3, gx, lfy3, spec.cz + 4.4, 0, M.fabricCognac, M);
          gc.scale.set(0.75, 0.88, 0.75);
        });

        // 3. NW CORNER (dx -15.2..-5.2, dz -9.2..-2.0): HEAD OF FLEET & AVIATION CARGO OFFICE (portal dx -7.6..-6.0)
        const fltFrontZ = spec.cz - 2.0;
        boxAt(lg3, 7.6, 3.05, 0.08, spec.cx - 11.4, lfy3 + 1.525, fltFrontZ, cargoSteelGlass, false, false);
        boxAt(lg3, 0.8, 3.05, 0.08, spec.cx - 5.6, lfy3 + 1.525, fltFrontZ, cargoSteelGlass, false, false);
        boxAt(lg3, 10.0, 0.14, 0.14, spec.cx - 10.2, lfy3 + 3.05, fltFrontZ, perforatedSteel, true, false);
        boxAt(lg3, 0.08, 3.05, 7.2, spec.cx - 5.2, lfy3 + 1.525, spec.cz - 5.6, cargoSteelGlass, false, false);
        [-15.2, -7.6, -6.0, -5.2].forEach((px) => {
          boxAt(lg3, 0.14, 3.06, 0.14, spec.cx + px, lfy3 + 1.53, fltFrontZ, brushedAluminum, true, false);
        });
        addCargoSign(lg3, 'HEAD OF FLEET & AIR CARGO', spec.cx - 11.4, lfy3 + 2.74, fltFrontZ + 0.09, 0);

        const fltX = spec.cx - 10.2;
        boxAt(lg3, 2.5, 0.06, 1.05, fltX, lfy3 + 0.74, spec.cz - 5.6, birchCrateWood, true, true, 0.02);
        [-1.05, 1.05].forEach((lx) => boxAt(lg3, 0.08, 0.72, 0.86, fltX + lx, lfy3 + 0.36, spec.cz - 5.6, perforatedSteel, true, true, 0.01));
        registerChair(3, fltX, lfy3, spec.cz - 6.52, 0, 1);
        registerMonitor(3, l3MonIdx++, [fltX, lfy3 + 0.77, spec.cz - 5.72], Math.PI, fltX, spec.cz - 6.52, 'Head of Fleet & Aviation Cargo · L3', 'Head of Fleet & Air Cargo');
        [fltX - 0.75, fltX + 0.75].forEach((vx) => {
          const vc = armchair(lg3, vx, lfy3, spec.cz - 4.3, Math.PI, M.fabricGrey, M);
          vc.scale.set(0.74, 0.88, 0.74);
        });
        boxAt(lg3, 0.1, 1.45, 2.6, spec.cx - 15.65, lfy3 + 1.88, spec.cz - 5.6, perforatedSteel, false, false);
        const fltTv = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), corridorRadarScreen.mat);
        fltTv.position.set(spec.cx - 15.56, lfy3 + 1.88, spec.cz - 5.6);
        fltTv.rotation.y = Math.PI / 2;
        lg3.add(fltTv);

        // 4. FRONT CENTER & SOUTH-CENTER WEST: C-Suite Reception, Port Executive Lounge & Container Cafe Bar
        boxAt(lg3, 2.3, 0.06, 0.96, ceoLgX, lfy3 + 0.74, spec.cz - 5.8, birchCrateWood, true, true, 0.02);
        boxAt(lg3, 2.34, 0.92, 0.14, ceoLgX, lfy3 + 0.46, spec.cz - 5.34, containerOrange, true, true, 0.02);
        registerChair(3, ceoLgX, lfy3, spec.cz - 6.72, 0, 1);
        registerMonitor(3, l3MonIdx++, [ceoLgX, lfy3 + 0.77, spec.cz - 5.9], Math.PI, ceoLgX, spec.cz - 6.72, 'Executive Operations Coordinator · L3', 'Control Tower Reception');

        const pSofa = sofaWide(lg3, spec.cx + 1.4, lfy3, spec.cz - 1.5, -Math.PI / 2, M.fabricGrey, M);
        pSofa.scale.set(0.76, 0.92, 0.84);
        addSteelDrumTable(lg3, spec.cx - 0.2, lfy3, spec.cz - 1.5, containerTeal);
        const pArm1 = armchair(lg3, spec.cx - 1.55, lfy3, spec.cz - 2.25, Math.PI * 0.35, M.fabricCognac, M);
        pArm1.scale.set(0.74, 0.88, 0.74);
        const pArm2 = armchair(lg3, spec.cx - 1.55, lfy3, spec.cz - 0.75, Math.PI * 0.65, M.fabricCognac, M);
        pArm2.scale.set(0.74, 0.88, 0.74);

        // Container Cafe & Refreshment Galley (dx -7.4, dz +6.4 -> 2m East of SW stairwell wall -11.25)
        boxAt(lg3, 3.4, 0.94, 0.88, spec.cx - 7.4, lfy3 + 0.47, spec.cz + 6.4, containerOrange, true, true, 0.02);
        boxAt(lg3, 3.48, 0.06, 0.94, spec.cx - 7.4, lfy3 + 0.97, spec.cz + 6.4, birchCrateWood, false, true, 0.01);
        [spec.cx - 8.2, spec.cx - 6.6].forEach((sx) => {
          cylAt(lg3, 0.2, 0.2, 0.09, sx, lfy3 + 0.68, spec.cz + 5.2, M.fabricCognac, true, true, 16);
          cylAt(lg3, 0.035, 0.035, 0.66, sx, lfy3 + 0.33, spec.cz + 5.2, perforatedSteel, false, false, 10);
          cylAt(lg3, 0.17, 0.2, 0.04, sx, lfy3 + 0.02, spec.cz + 5.2, perforatedSteel, false, true, 14);
        });
      }

      // -------------------------------------------------------------------------
      // CONTINUOUS SW STEEL-MESH & BIRCH-TREAD LOGISTICS STAIRWELL CORE (G -> L3)
      // -------------------------------------------------------------------------
      const swStairXWest = spec.cx - 14.35;
      const swStairXEast = spec.cx - 11.25;
      const swStairXMid = spec.cx - 12.8;
      const swStairZNorth = spec.cz + 2.8;
      const swStairZSouth = spec.cz + 8.0;
      const swStairW = swStairXEast - swStairXWest;
      const swStairD = swStairZSouth - swStairZNorth;
      const swStairCx = (swStairXWest + swStairXEast) * 0.5;
      const swStairCz = (swStairZNorth + swStairZSouth) * 0.5;
      const swBridgeZ = spec.cz + 4.15;
      const swHalfStartZ = spec.cz + 6.75;
      const swStairSigns = ['CARGO STAIRS · G → L1', 'STAIRS · L1 ↔ L2', 'STAIRS · L2 ↔ L3', 'STAIRS · L3 COMMAND'];

      const addSwRail = (parent: THREE.Object3D, x: number, y0: number, z0: number, y1: number, z1: number) => {
        const p0 = new THREE.Vector3(x, y0 + 0.94, z0);
        const p1 = new THREE.Vector3(x, y1 + 0.94, z1);
        const len = p0.distanceTo(p1);
        const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
        const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, len, 10), safetyYellowMat);
        rail.position.copy(mid);
        rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        parent.add(rail);
        [0.15, 0.5, 0.85].forEach((t) => {
          const py = THREE.MathUtils.lerp(y0, y1, t);
          const pz = THREE.MathUtils.lerp(z0, z1, t);
          cylAt(parent, 0.015, 0.015, 0.94, x, py + 0.47, pz, perforatedSteel, false, false, 8);
        });
      };

      for (let lv = 0; lv < spec.floors; lv++) {
        const lgS = levelGroups[lv];
        if (!lgS) continue;
        const fyS = spec.groundY + lv * spec.floorH + SLAB_THICK * 0.5;
        const wallH = spec.floorH - SLAB_THICK - 0.04;

        // North vestibule landing finish & safety-orange threshold bar
        boxAt(lgS, 3.0, 0.018, 1.32, swStairCx, fyS + 0.009, spec.cz + 3.48, cargoEpoxyFloor, false, true);
        boxAt(lgS, 0.14, 0.018, 1.24, swStairXEast, fyS + 0.012, spec.cz + 3.5, new THREE.MeshBasicMaterial({ color: 0xf97316 }), false, false);

        // West, North & South industrial galvanized-base & steel-glass shaft perimeter
        boxAt(lgS, 0.1, 0.24, swStairD, swStairXWest, fyS + 0.12, swStairCz, galvanizedSteel, true, true);
        boxAt(lgS, 0.05, wallH - 0.3, swStairD, swStairXWest, fyS + 0.24 + (wallH - 0.3) * 0.5, swStairCz, cargoSteelGlass, false, false);
        boxAt(lgS, 0.12, 0.12, swStairD, swStairXWest, fyS + wallH - 0.02, swStairCz, perforatedSteel, false, false);
        [swStairZNorth, spec.cz + 5.4, swStairZSouth].forEach((mz) => {
          boxAt(lgS, 0.1, wallH, 0.1, swStairXWest, fyS + wallH * 0.5, mz, brushedAluminum, true, false);
        });
        [swStairZNorth, swStairZSouth].forEach((wz) => {
          boxAt(lgS, swStairW, 0.24, 0.1, swStairCx, fyS + 0.12, wz, galvanizedSteel, true, true);
          boxAt(lgS, swStairW, wallH - 0.3, 0.05, swStairCx, fyS + 0.24 + (wallH - 0.3) * 0.5, wz, cargoSteelGlass, false, false);
          boxAt(lgS, swStairW, 0.12, 0.12, swStairCx, fyS + wallH - 0.02, wz, perforatedSteel, false, false);
          boxAt(lgS, 0.1, wallH, 0.1, swStairXMid, fyS + wallH * 0.5, wz, brushedAluminum, true, false);
        });

        // East glass shaft wall south of doorway (dz = +4.12..+8.00 -> 3.88m)
        boxAt(lgS, 0.12, 0.36, 3.88, swStairXEast, fyS + 0.18, spec.cz + 6.06, containerOrange, true, true);
        boxAt(lgS, 0.05, wallH - 0.42, 3.88, swStairXEast, fyS + 0.36 + (wallH - 0.42) * 0.5, spec.cz + 6.06, cargoSteelGlass, false, false);
        boxAt(lgS, 0.12, 0.12, 3.88, swStairXEast, fyS + wallH - 0.02, spec.cz + 6.06, perforatedSteel, false, false);
        boxAt(lgS, 0.1, wallH, 0.1, swStairXEast, fyS + wallH * 0.5, spec.cz + 6.06, brushedAluminum, true, false);
        boxAt(lgS, 0.1, wallH, 0.1, swStairXEast, fyS + wallH * 0.5, swStairZSouth, brushedAluminum, true, false);

        // Framed open Steel-Portal Stairwell Door on East shaft face (dx = -11.25, dz = +2.86..+4.12)
        const doorZ = spec.cz + 3.49;
        const doorH = 2.48;
        [spec.cz + 2.86, spec.cz + 4.12].forEach((jz) => {
          boxAt(lgS, 0.15, wallH, 0.11, swStairXEast, fyS + wallH * 0.5, jz, brushedAluminum, true, false, 0.01);
        });
        boxAt(lgS, 0.15, 0.12, 1.38, swStairXEast, fyS + doorH + 0.06, doorZ, perforatedSteel, true, false, 0.01);
        const transomH = Math.max(0.3, wallH - doorH - 0.16);
        boxAt(lgS, 0.05, transomH, 1.2, swStairXEast, fyS + doorH + 0.12 + transomH * 0.5, doorZ, cargoSteelGlass, false, false);

        // Swung-open industrial steel & wired-glass door leaf (hinged at South jamb, swung out +X/+Z)
        const doorLeaf = new THREE.Group();
        doorLeaf.position.set(swStairXEast + 0.02, fyS, spec.cz + 4.08);
        doorLeaf.rotation.y = -2.22;
        boxAt(doorLeaf, 0.055, doorH - 0.04, 0.09, 0, (doorH - 0.04) * 0.5 + 0.02, -0.045, containerOrange, true, false);
        boxAt(doorLeaf, 0.055, doorH - 0.04, 0.09, 0, (doorH - 0.04) * 0.5 + 0.02, -1.08, containerOrange, true, false);
        boxAt(doorLeaf, 0.055, 0.14, 1.12, 0, 0.09, -0.56, perforatedSteel, true, false);
        boxAt(doorLeaf, 0.055, 0.12, 1.12, 0, doorH - 0.08, -0.56, perforatedSteel, true, false);
        boxAt(doorLeaf, 0.028, doorH - 0.3, 0.96, 0, doorH * 0.5, -0.56, cargoSteelGlass, false, false);
        cylAt(doorLeaf, 0.014, 0.014, 0.86, -0.055, 1.15, -0.98, brushedAluminum, false, false, 10);
        cylAt(doorLeaf, 0.014, 0.014, 0.86, 0.055, 1.15, -0.98, brushedAluminum, false, false, 10);
        lgS.add(doorLeaf);
        addCargoSign(lgS, swStairSigns[lv] ?? `STAIRS · L${lv}`, swStairXEast + 0.1, fyS + doorH + 0.36, doorZ, Math.PI / 2);

        // Two-Flight Switchback Steel-Stringer & Birch-Tread Stairs (G->L1, L1->L2, L2->L3)
        if (lv < spec.floors - 1) {
          const steps = 8;
          const runLen = swHalfStartZ - swBridgeZ;
          const stepDepth = runLen / steps;
          const halfRise = spec.floorH * 0.5;
          const stepRise = halfRise / steps;
          const yMidLv = fyS + halfRise;
          const yTopLv = fyS + spec.floorH;

          // Flight 1 (West lane dx = -13.57, climbs Southward +4.15 -> +6.75)
          for (let st = 0; st < steps; st++) {
            const ty = fyS + (st + 0.5) * stepRise;
            const tz = swBridgeZ + (st + 0.5) * stepDepth;
            boxAt(lgS, 1.32, stepRise, stepDepth + 0.03, spec.cx - 13.57, ty, tz, perforatedSteel, true, true, 0.008);
            boxAt(lgS, 1.35, 0.045, stepDepth + 0.04, spec.cx - 13.57, ty + stepRise * 0.5 + 0.01, tz, birchCrateWood, false, true, 0.008);
            boxAt(lgS, 1.35, 0.016, 0.035, spec.cx - 13.57, ty + stepRise * 0.5 + 0.028, tz - stepDepth * 0.45, safetyYellowMat, false, false);
          }

          // South Half Landing (y = fyS + 2.20)
          boxAt(lgS, 2.94, 0.16, 1.22, swStairCx, yMidLv - 0.07, spec.cz + 7.36, perforatedSteel, true, true, 0.015);
          boxAt(lgS, 2.9, 0.04, 1.18, swStairCx, yMidLv + 0.02, spec.cz + 7.36, birchCrateWood, false, true, 0.01);

          // Flight 2 (East lane dx = -12.03, climbs Northward +6.75 -> +4.15)
          for (let st = 0; st < steps; st++) {
            const ty = yMidLv + (st + 0.5) * stepRise;
            const tz = swHalfStartZ - (st + 0.5) * stepDepth;
            boxAt(lgS, 1.32, stepRise * 0.55, stepDepth + 0.03, spec.cx - 12.03, ty + stepRise * 0.22, tz, perforatedSteel, true, true, 0.008);
            boxAt(lgS, 1.35, 0.045, stepDepth + 0.04, spec.cx - 12.03, ty + stepRise * 0.5 + 0.01, tz, birchCrateWood, false, true, 0.008);
            boxAt(lgS, 1.35, 0.016, 0.035, spec.cx - 12.03, ty + stepRise * 0.5 + 0.028, tz + stepDepth * 0.45, safetyYellowMat, false, false);
          }

          addSwRail(lgS, spec.cx - 14.22, fyS, swBridgeZ, yMidLv, swHalfStartZ);
          addSwRail(lgS, spec.cx - 12.88, fyS, swBridgeZ, yMidLv, swHalfStartZ);
          addSwRail(lgS, spec.cx - 12.72, yMidLv, swHalfStartZ, yTopLv, swBridgeZ);
          addSwRail(lgS, spec.cx - 11.38, yMidLv, swHalfStartZ, yTopLv, swBridgeZ);
        }

        // Shaft balustrades (ground under-stair guard + upper-floor drop guardrails)
        if (lv === 0) {
          boxAt(lgS, 1.44, 1.45, 0.06, spec.cx - 12.03, fyS + 0.725, swBridgeZ, cargoSteelGlass, false, false);
          boxAt(lgS, 0.06, 1.04, 2.6, swStairXMid, fyS + 0.52, spec.cz + 5.45, cargoSteelGlass, false, false);
        } else {
          boxAt(lgS, 0.06, 1.04, 3.8, swStairXMid, fyS + 0.52, spec.cz + 6.05, cargoSteelGlass, false, false);
          boxAt(lgS, 0.05, 1.04, 3.8, spec.cx - 14.28, fyS + 0.52, spec.cz + 6.05, cargoSteelGlass, false, false);
          boxAt(lgS, 2.94, 1.04, 0.05, swStairCx, fyS + 0.52, spec.cz + 7.94, cargoSteelGlass, false, false);
          if (lv === spec.floors - 1) {
            boxAt(lgS, 1.46, 1.04, 0.06, spec.cx - 13.57, fyS + 0.52, swBridgeZ, cargoSteelGlass, false, false);
          }
        }
      }
    } else if (spec.id === 'realestate') {
      buildRealEstateWholeBuilding({
        spec,
        levelGroups,
        levelCeilings,
        roofShellGroup,
        M,
        archMats,
        frameDarkMat,
        accentMat,
        glassMat,
        terracottaMat,
        floorWarmOak,
        floorTerrazzo,
        woodCedarMat,
        bankStoneMat,
        screenReg,
        registerChair,
        registerMonitor,
        pickMeshes,
        rotatingProps,
        warmLights,
        monitors,
      });
    }

    // Architectural Rooftop Crowns (4 cohesive tropical-modern silhouettes replacing boxy flat roofs)
    root.add(roofShellGroup);
    const roofY = spec.groundY + spec.h;

    if (spec.id === 'bank' || spec.id === 'realestate') {
      // Custom Nairobi Trust Bank Reserve Sky-Rotunda & TerraCraft Sky-Pavilion/Lattice Tower Crane already populated into roofShellGroup
    } else if (style === 'tower') {
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

    if (spec.id !== 'realestate') {
      buildDistrictBuildingConstruction({
        spec,
        levelGroups,
        roofShellGroup,
        M,
        archMats,
        frameDarkMat,
        accentMat,
        rotatingProps,
        pickMeshes,
      });
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
