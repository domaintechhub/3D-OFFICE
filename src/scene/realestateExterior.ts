import * as THREE from 'three';
import {
  buildPlanterTrough,
  buildTropicalPalm,
  buildVinePergolaCanopy,
  getRoundedSlabGeo,
  getSlopedRoofBladeGeo,
} from './architecturalForms';
import { boxAt, cylAt, downlight } from './props';
import type { RealEstateBuildContext, RealEstatePalette } from './realestatePalette';

function addRodBetween(
  parent: THREE.Object3D,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
  radialSegments = 6
) {
  const len = p0.distanceTo(p1);
  if (len < 0.005) return;
  const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, radialSegments), mat);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  mesh.castShadow = true;
  parent.add(mesh);
}

function addIBeam(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  len: number,
  h: number,
  flangeW: number,
  axis: 'x' | 'z',
  mat: THREE.Material
) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (axis === 'z') g.rotation.y = Math.PI / 2;
  const thick = Math.max(0.018, h * 0.14);
  boxAt(g, len, thick, flangeW, 0, h * 0.5 - thick * 0.5, 0, mat, true, true);
  boxAt(g, len, thick, flangeW, 0, -h * 0.5 + thick * 0.5, 0, mat, true, true);
  boxAt(g, len, h - thick * 2, thick * 0.85, 0, 0, 0, mat, true, true);
  parent.add(g);
}

/**
 * Realistic exterior curtain-wall mullions, brise-soleil louvers, cantilevered porte-cochere,
 * construction staging yard, and bespoke rooftop sky-pavilion + open-lattice tower crane.
 */
export function buildRealEstateExteriorAndCrown(
  ctx: RealEstateBuildContext,
  pal: RealEstatePalette
) {
  const { spec, levelGroups, roofShellGroup, M, archMats, frameDarkMat, rotatingProps, pickMeshes } = ctx;
  const g0 = levelGroups[0];
  const hw = spec.w * 0.5;
  const hd = spec.d * 0.5;
  const frontZ = spec.cz - hd + 0.11; // doorSide = 'north'
  const cornerR = 2.4;

  // ---------------------------------------------------------------------------
  // 1. GRAND CANTILEVERED NORTH PORTE-COCHERE & STRUCTURAL ENTRANCE PORTAL
  // ---------------------------------------------------------------------------
  const canopyZ = spec.doorZ - 1.48;
  const canopyY = spec.groundY + spec.floorH - 0.12;
  const reCanopy = new THREE.Mesh(
    getSlopedRoofBladeGeo(14.2, 3.2, 0.24, 0.46, 0.08, 0.34, 0.045),
    archMats.stuccoWhite
  );
  reCanopy.position.set(spec.doorX, canopyY - 0.16, canopyZ);
  reCanopy.castShadow = true;
  reCanopy.receiveShadow = true;
  g0.add(reCanopy);
  pickMeshes.push(reCanopy);

  // Bronze fascia drip band & recessed Western Red Cedar plank soffit
  boxAt(g0, 14.25, 0.08, 0.08, spec.doorX, canopyY - 0.02, canopyZ - 1.56, archMats.bronzeMullion, false, false);
  const reSoffit = new THREE.Mesh(
    getRoundedSlabGeo(13.2, 2.55, 0.48, 0.06, 0.012),
    archMats.timberSoffit
  );
  reSoffit.position.set(spec.doorX, canopyY - 0.16, canopyZ + 0.06);
  g0.add(reSoffit);

  // Exposed tapered structural steel I-beam outriggers & 6 recessed canopy downlights
  [-5.2, -2.6, 0, 2.6, 5.2].forEach((bx) => {
    addIBeam(g0, spec.doorX + bx, canopyY - 0.22, canopyZ + 0.08, 2.5, 0.14, 0.11, 'z', pal.gunmetalSteel);
  });
  [-4.4, -2.2, 0, 2.2, 4.4].forEach((lx) => {
    downlight(g0, spec.doorX + lx, canopyY - 0.19, canopyZ - 0.25, M, 0.11);
  });

  // Composite architectural entrance piers with stone plinths, cast-iron base plates & seismic steel collars
  [-5.6, 5.6].forEach((px) => {
    const colX = spec.doorX + px;
    const colZ = spec.doorZ - 2.45;
    const pierH = spec.floorH - 0.26;
    // Chamfered travertine plinth & bolted steel base flange
    boxAt(g0, 0.66, 0.22, 0.66, colX, spec.groundY + 0.11, colZ, pal.honedTravertine, true, true, 0.03);
    boxAt(g0, 0.5, 0.045, 0.5, colX, spec.groundY + 0.24, colZ, pal.gunmetalSteel, true, true, 0.01);
    [-0.18, 0.18].forEach((bx) => {
      [-0.18, 0.18].forEach((bz) => {
        cylAt(g0, 0.02, 0.02, 0.035, colX + bx, spec.groundY + 0.275, colZ + bz, pal.galvanizedSteel, false, false, 6);
      });
    });
    // Tapered architectural concrete column shaft & upper steel collar bracket
    cylAt(g0, 0.175, 0.205, pierH - 0.28, colX, spec.groundY + 0.26 + (pierH - 0.28) * 0.5, colZ, archMats.stuccoWhite, true, true, 18);
    cylAt(g0, 0.24, 0.21, 0.18, colX, spec.groundY + pierH - 0.09, colZ, pal.gunmetalSteel, true, false, 16);
  });

  // Entry threshold travertine step & tactile granite framing strips
  boxAt(g0, 4.6, 0.04, 1.35, spec.doorX, spec.groundY + 0.02, spec.doorZ - 0.72, pal.honedTravertine, false, true, 0.015);

  // ---------------------------------------------------------------------------
  // 2. CURTAIN-WALL MULLIONS, TRANSOMS & BRISE-SOLEIL FINS ACROSS ALL FLOORS (G..L4)
  // ---------------------------------------------------------------------------
  const eastCurveCx = spec.cx + hw - 0.11 - cornerR;
  const westCurveCx = spec.cx - hw + 0.11 + cornerR;
  const frontCurveCz = frontZ + cornerR;

  for (let lv = 0; lv < spec.floors; lv++) {
    const lg = levelGroups[lv];
    if (!lg) continue;
    const yFloor = spec.groundY + lv * spec.floorH;
    const hWall = spec.floorH - 0.24;
    const yMid = yFloor + 0.12 + hWall * 0.5;

    // A. Vertical anodized bronze curtain-wall mullions along North front glazing
    const mullionXs = [-8.8, -6.2, -3.6, 3.6, 6.2, 8.8];
    if (lv > 0) mullionXs.push(-1.2, 1.2);
    mullionXs.forEach((mx) => {
      boxAt(lg, 0.075, hWall - 0.2, 0.13, spec.cx + mx, yMid, frontZ, archMats.bronzeMullion, true, false);
    });
    // Intermediate horizontal transom bar along straight North curtain wall
    boxAt(lg, spec.w - cornerR * 2 - 0.45, 0.065, 0.11, spec.cx, yFloor + 2.72, frontZ, archMats.bronzeMullion, false, false);

    // B. Radial mullions wrapping both curved front corners (NW & NE r=2.4m)
    [
      { cx: eastCurveCx, a0: Math.PI * 0.5, a1: Math.PI },
      { cx: westCurveCx, a0: Math.PI, a1: Math.PI * 1.5 },
    ].forEach(({ cx, a0, a1 }) => {
      for (let i = 1; i <= 3; i++) {
        const ang = THREE.MathUtils.lerp(a0, a1, i / 4);
        const mx = cx + Math.sin(ang) * cornerR;
        const mz = frontCurveCz + Math.cos(ang) * cornerR;
        const m = boxAt(lg, 0.065, hWall - 0.22, 0.11, mx, yMid, mz, archMats.bronzeMullion, true, false);
        m.rotation.y = ang;
      }
      // Curved bronze transom band on corner arc
      const arcBand = new THREE.Mesh(
        new THREE.CylinderGeometry(cornerR + 0.03, cornerR + 0.03, 0.06, 16, 1, false, a0, Math.PI * 0.5),
        archMats.bronzeMullion
      );
      arcBand.position.set(cx, yFloor + 2.72, frontCurveCz);
      lg.add(arcBand);
    });

    // C. Upper-level (L1..L4) Western Red Cedar Brise-Soleil Sun-Breaker Fins on West & East bays
    if (lv >= 1) {
      for (let fz = -5.6; fz <= 0.4; fz += 0.65) {
        const finW = boxAt(lg, 0.26, hWall - 0.34, 0.055, spec.cx - hw + 0.08, yMid, spec.cz + fz, archMats.timberFin, true, false);
        finW.rotation.y = 0.28;
      }
      // Exposed architectural seismic steel X-brace tension bay on upper NW glass flank (construction craftsmanship cue)
      if (lv === 2 || lv === 3) {
        const bx = spec.cx - hw + 0.16;
        const z0 = spec.cz - 5.9;
        const z1 = spec.cz - 2.3;
        const yBot = yFloor + 0.32;
        const yTop = yFloor + hWall - 0.18;
        addRodBetween(lg, new THREE.Vector3(bx, yBot, z0), new THREE.Vector3(bx, yTop, z1), 0.028, pal.gunmetalSteel, 8);
        addRodBetween(lg, new THREE.Vector3(bx, yTop, z0), new THREE.Vector3(bx, yBot, z1), 0.028, pal.gunmetalSteel, 8);
        // Gusset plate nodes at corners & central turnbuckle ring
        [yBot, yTop].forEach((gy) => {
          [z0, z1].forEach((gz) => {
            boxAt(lg, 0.05, 0.18, 0.18, bx, gy, gz, pal.gunmetalSteel, false, false);
          });
        });
        cylAt(lg, 0.07, 0.07, 0.06, bx, (yBot + yTop) * 0.5, (z0 + z1) * 0.5, pal.brushedBronze, false, false, 12);
      }
    }

    // D. Exposed composite structural column collars & anchor plates at perimeter corners
    const frontColZ = frontZ + 0.42;
    const backColZ = spec.cz + hd - 0.47;
    [-1, 1].forEach((side) => {
      const cxCol = spec.cx + side * (hw - 0.48);
      cylAt(lg, 0.35, 0.35, 0.12, cxCol, yFloor + 0.2, frontColZ, pal.gunmetalSteel, false, false, 16);
      cylAt(lg, 0.35, 0.35, 0.12, cxCol, yFloor + hWall + 0.02, frontColZ, pal.gunmetalSteel, false, false, 16);
      cylAt(lg, 0.31, 0.31, 0.1, cxCol, yFloor + 0.2, backColZ, pal.gunmetalSteel, false, false, 16);
    });
  }

  // ---------------------------------------------------------------------------
  // 3. REALISTIC WEST CONSTRUCTION ENGINEERING & STRUCTURAL MOCKUP YARD
  //    (Strictly inside cx - 16.2, 3.6m x 7.4m obstacle box from obstacles.ts)
  // ---------------------------------------------------------------------------
  const yardX = spec.cx - 16.2;
  const yardY = spec.groundY;

  // Cast concrete foundation slab & safety yellow/slate curb
  boxAt(g0, 3.45, 0.09, 7.25, yardX, yardY + 0.045, spec.cz, pal.boardformedConcrete, false, true, 0.02);
  boxAt(g0, 3.5, 0.03, 0.14, yardX, yardY + 0.1, spec.cz - 3.55, pal.craneAmber, false, false);
  boxAt(g0, 3.5, 0.03, 0.14, yardX, yardY + 0.1, spec.cz + 3.55, pal.craneAmber, false, false);

  // A. Cantilevered Steel Rack with True Flanged Structural I-Beams (North bay of yard)
  const rackX = yardX - 0.45;
  const rackZ = spec.cz - 1.95;
  [-0.95, 0.95].forEach((rz) => {
    boxAt(g0, 0.1, 1.32, 0.1, rackX - 0.55, yardY + 0.72, rackZ + rz, pal.gunmetalSteel, true, false);
    [0.35, 0.82, 1.28].forEach((ry) => {
      boxAt(g0, 1.25, 0.07, 0.08, rackX, yardY + ry, rackZ + rz, pal.gunmetalSteel, true, false);
    });
  });
  [0.48, 0.95].forEach((ry) => {
    addIBeam(g0, rackX + 0.1, yardY + ry, rackZ, 2.7, 0.16, 0.12, 'z', pal.rebarIron);
    addIBeam(g0, rackX + 0.36, yardY + ry, rackZ, 2.7, 0.16, 0.12, 'z', pal.gunmetalSteel);
  });

  // B. Tied Steel Rebar Cage & Timber Shuttered Concrete Formwork Mockup (South bay of yard)
  const formX = yardX - 0.45;
  const formZ = spec.cz + 1.55;
  // Shuttered concrete formwork panel with timber soldiers & tie-rod wing nuts
  boxAt(g0, 0.14, 1.45, 1.85, formX - 0.62, yardY + 0.8, formZ, pal.lumberSpruce, true, true, 0.015);
  [-0.6, 0, 0.6].forEach((sz) => {
    boxAt(g0, 0.09, 1.5, 0.08, formX - 0.72, yardY + 0.8, formZ + sz, pal.gunmetalSteel, false, false);
    [0.45, 1.15].forEach((ty) => {
      cylAt(g0, 0.018, 0.018, 0.24, formX - 0.66, yardY + ty, formZ + sz, pal.galvanizedSteel, false, false, 6);
    });
  });
  // Tied 3D steel rebar cage rising beside formwork
  const cageX = formX + 0.25;
  [
    [-0.22, -0.45],
    [0.22, -0.45],
    [-0.22, 0.45],
    [0.22, 0.45],
    [-0.22, 0],
    [0.22, 0],
  ].forEach(([rx, rz]) => {
    cylAt(g0, 0.02, 0.02, 1.65, cageX + rx, yardY + 0.9, formZ + rz, pal.rebarIron, true, false, 8);
  });
  [0.25, 0.65, 1.05, 1.45].forEach((sy) => {
    boxAt(g0, 0.48, 0.024, 0.024, cageX, yardY + sy, formZ - 0.45, pal.rebarIron, false, false);
    boxAt(g0, 0.48, 0.024, 0.024, cageX, yardY + sy, formZ + 0.45, pal.rebarIron, false, false);
    boxAt(g0, 0.024, 0.024, 0.94, cageX - 0.22, yardY + sy, formZ, pal.rebarIron, false, false);
    boxAt(g0, 0.024, 0.024, 0.94, cageX + 0.22, yardY + sy, formZ, pal.rebarIron, false, false);
  });

  // C. Strapped Hardwood Pallets + Masonry Blocks + Timber Joists (East side of yard)
  const palX = yardX + 0.85;
  boxAt(g0, 1.15, 0.12, 1.45, palX, yardY + 0.14, spec.cz + 1.25, pal.lumberSpruce, true, true, 0.01);
  for (let row = 0; row < 2; row++) {
    for (let bx = -0.32; bx <= 0.32; bx += 0.32) {
      for (let bz = -0.38; bz <= 0.38; bz += 0.38) {
        boxAt(g0, 0.28, 0.22, 0.34, palX + bx, yardY + 0.31 + row * 0.24, spec.cz + 1.25 + bz, ctx.bankStoneMat, true, true, 0.012);
      }
    }
  }
  // Stacked kiln-dried timber joists with black steel strapping bands
  boxAt(g0, 1.1, 0.1, 1.5, palX, yardY + 0.13, spec.cz - 1.35, pal.lumberSpruce, true, true);
  for (let l = 0; l < 3; l++) {
    for (let xOff = -0.35; xOff <= 0.35; xOff += 0.35) {
      boxAt(g0, 0.24, 0.14, 1.45, palX + xOff, yardY + 0.25 + l * 0.16, spec.cz - 1.35, ctx.woodCedarMat, true, true, 0.01);
    }
  }

  // D. Builder's Optical Theodolite Tripod & Site Blueprint Lectern + Safety Perimeter Rail
  const theoX = yardX + 1.05;
  const theoZ = spec.cz - 2.85;
  const theoHead = new THREE.Vector3(theoX, yardY + 1.32, theoZ);
  [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].forEach((a) => {
    addRodBetween(
      g0,
      new THREE.Vector3(theoX + Math.cos(a) * 0.34, yardY + 0.08, theoZ + Math.sin(a) * 0.34),
      theoHead,
      0.02,
      pal.galvanizedSteel,
      6
    );
  });
  boxAt(g0, 0.16, 0.18, 0.16, theoX, yardY + 1.4, theoZ, pal.craneAmber, true, false, 0.02);
  cylAt(g0, 0.04, 0.04, 0.22, theoX, yardY + 1.44, theoZ + 0.1, frameDarkMat, false, false, 10).rotation.x = Math.PI / 2;

  // Perimeter safety guardrails (West edge & North/South ends) + high-vis cones
  [-3.3, -1.1, 1.1, 3.3].forEach((gz) => {
    cylAt(g0, 0.032, 0.032, 0.98, yardX - 1.58, yardY + 0.55, spec.cz + gz, pal.craneAmber, true, false, 8);
  });
  boxAt(g0, 0.05, 0.05, 6.65, yardX - 1.58, yardY + 0.98, spec.cz, pal.craneAmber, false, false);
  boxAt(g0, 0.05, 0.05, 6.65, yardX - 1.58, yardY + 0.56, spec.cz, pal.craneAmber, false, false);
  [spec.cz - 3.35, spec.cz + 3.35].forEach((czCone) => {
    cylAt(g0, 0.045, 0.2, 0.56, yardX + 1.45, yardY + 0.34, czCone, pal.safetyOrange, true, true, 12);
    boxAt(g0, 0.36, 0.04, 0.36, yardX + 1.45, yardY + 0.1, czCone, frameDarkMat, false, false);
  });

  // ---------------------------------------------------------------------------
  // 4. BESPOKE ROOFTOP SKY-PAVILION, MEP CHILLER PLANT & LATTICE TOWER CRANE
  // ---------------------------------------------------------------------------
  const roofY = spec.groundY + spec.h;
  const deckGeo = getRoundedSlabGeo(spec.w + 2.2, spec.d + 2.2, 1.8, 0.3, 0.06);
  const baseDeck = new THREE.Mesh(deckGeo, archMats.bullnoseConcrete);
  baseDeck.position.set(spec.cx, roofY, spec.cz);
  baseDeck.castShadow = true;
  baseDeck.receiveShadow = true;
  roofShellGroup.add(baseDeck);
  pickMeshes.push(baseDeck);

  // Parapet coping ring with bronze cap flashing & perimeter safety glass balustrade
  const parapetRing = new THREE.Mesh(
    getRoundedSlabGeo(spec.w + 1.8, spec.d + 1.8, 1.6, 0.38, 0.04),
    pal.honedTravertine
  );
  parapetRing.position.set(spec.cx, roofY + 0.22, spec.cz);
  roofShellGroup.add(parapetRing);

  // Timber sky-terrace deck pad on East wing + vine-draped steel-and-timber rooftop pergola
  const deckSurfaceY = roofY + 0.42;
  const terraceDeck = new THREE.Mesh(
    getRoundedSlabGeo(spec.w * 0.48, spec.d * 0.76, 0.6, 0.08, 0.02),
    archMats.timberSoffit
  );
  terraceDeck.position.set(spec.cx + spec.w * 0.22, deckSurfaceY, spec.cz);
  terraceDeck.receiveShadow = true;
  roofShellGroup.add(terraceDeck);

  buildVinePergolaCanopy(
    roofShellGroup,
    spec.cx + spec.w * 0.24,
    deckSurfaceY + 0.04,
    spec.cz + 0.6,
    spec.w * 0.36,
    spec.d * 0.56,
    2.45,
    [-spec.w * 0.14, spec.w * 0.14],
    880,
    archMats
  );

  // Sloped photovoltaic solar louver canopy shading South-Center terrace
  const solarFrame = new THREE.Group();
  solarFrame.position.set(spec.cx + 1.4, deckSurfaceY + 2.4, spec.cz - 4.4);
  solarFrame.rotation.x = 0.22;
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x16243b, roughness: 0.22, metalness: 0.68 });
  boxAt(solarFrame, 6.4, 0.06, 2.8, 0, 0, 0, pal.gunmetalSteel, true, false);
  for (let px = -2.4; px <= 2.4; px += 1.6) {
    boxAt(solarFrame, 1.42, 0.04, 2.55, px, 0.045, 0, solarMat, false, false);
  }
  roofShellGroup.add(solarFrame);
  [-1.6, 4.4].forEach((px) => {
    cylAt(roofShellGroup, 0.07, 0.08, 2.4, spec.cx + px, deckSurfaceY + 1.2, spec.cz - 4.4, pal.gunmetalSteel, true, false, 10);
  });

  // Rooftop MEP HVAC Chiller Enclosure (SW terrace corner) with louvered screen & twin condenser fans
  const hvacX = spec.cx - spec.w * 0.3;
  const hvacZ = spec.cz + spec.d * 0.26;
  boxAt(roofShellGroup, 4.4, 0.18, 2.6, hvacX, deckSurfaceY + 0.09, hvacZ, pal.boardformedConcrete, true, true);
  boxAt(roofShellGroup, 3.8, 1.22, 1.8, hvacX, deckSurfaceY + 0.79, hvacZ, pal.galvanizedSteel, true, true, 0.03);
  [-0.95, 0.95].forEach((fx) => {
    cylAt(roofShellGroup, 0.56, 0.58, 0.18, hvacX + fx, deckSurfaceY + 1.48, hvacZ, pal.gunmetalSteel, true, false, 18);
    boxAt(roofShellGroup, 0.92, 0.04, 0.14, hvacX + fx, deckSurfaceY + 1.54, hvacZ, pal.galvanizedSteel, false, false);
  });

  // Rooftop landscape planters & tropical palms
  buildPlanterTrough(roofShellGroup, spec.cx + 4.8, deckSurfaceY, spec.cz - spec.d * 0.42, 4.8, Math.PI, 882, archMats);
  buildPlanterTrough(roofShellGroup, spec.cx - 4.8, deckSurfaceY, spec.cz - spec.d * 0.42, 4.4, Math.PI, 884, archMats);
  buildTropicalPalm(roofShellGroup, spec.cx + spec.w * 0.38, deckSurfaceY, spec.cz - spec.d * 0.3, 3.5, 891, M, archMats);
  buildTropicalPalm(roofShellGroup, spec.cx + spec.w * 0.36, deckSurfaceY, spec.cz + spec.d * 0.3, 3.2, 895, M, archMats);

  // ---------------------------------------------------------------------------
  // 5. OPEN-LATTICE STEEL ARCHITECTURAL TOWER CRANE (NW Rooftop Quadrant)
  // ---------------------------------------------------------------------------
  const craneBaseX = spec.cx - spec.w * 0.24;
  const craneBaseZ = spec.cz - spec.d * 0.12;
  const craneBaseY = deckSurfaceY;

  // Concrete ballast pad + 4 diagonal steel cruciform outrigger anchors
  boxAt(roofShellGroup, 2.9, 0.38, 2.9, craneBaseX, craneBaseY + 0.19, craneBaseZ, pal.boardformedConcrete, true, true, 0.04);
  for (let ci = 0; ci < 4; ci++) {
    const ang = (ci / 4) * Math.PI * 2 + Math.PI * 0.25;
    const footPos = new THREE.Vector3(craneBaseX + Math.cos(ang) * 1.35, craneBaseY + 0.4, craneBaseZ + Math.sin(ang) * 1.35);
    const mastPos = new THREE.Vector3(craneBaseX + Math.cos(ang) * 0.46, craneBaseY + 1.15, craneBaseZ + Math.sin(ang) * 0.46);
    boxAt(roofShellGroup, 0.36, 0.12, 0.36, footPos.x, footPos.y, footPos.z, pal.gunmetalSteel, true, false);
    addRodBetween(roofShellGroup, footPos, mastPos, 0.055, pal.gunmetalSteel, 8);
  }

  // Open 3D Steel Lattice Mast (4 vertical chords + multi-bay X-brace diagonals)
  const mastHalf = 0.42;
  const mastH = 5.4;
  const mastCorners: Array<[number, number]> = [
    [-mastHalf, -mastHalf],
    [mastHalf, -mastHalf],
    [mastHalf, mastHalf],
    [-mastHalf, mastHalf],
  ];
  mastCorners.forEach(([cx, cz]) => {
    boxAt(roofShellGroup, 0.09, mastH, 0.09, craneBaseX + cx, craneBaseY + 0.38 + mastH * 0.5, craneBaseZ + cz, pal.craneAmber, true, false);
  });
  const mastBays = 5;
  const bayH = mastH / mastBays;
  for (let b = 0; b < mastBays; b++) {
    const y0 = craneBaseY + 0.38 + b * bayH;
    const y1 = y0 + bayH;
    for (let f = 0; f < 4; f++) {
      const cA = mastCorners[f];
      const cB = mastCorners[(f + 1) % 4];
      const pA0 = new THREE.Vector3(craneBaseX + cA[0], y0, craneBaseZ + cA[1]);
      const pB0 = new THREE.Vector3(craneBaseX + cB[0], y0, craneBaseZ + cB[1]);
      const pA1 = new THREE.Vector3(craneBaseX + cA[0], y1, craneBaseZ + cA[1]);
      const pB1 = new THREE.Vector3(craneBaseX + cB[0], y1, craneBaseZ + cB[1]);
      addRodBetween(roofShellGroup, pA0, pB1, 0.025, pal.craneAmber, 6);
      addRodBetween(roofShellGroup, pB0, pA1, 0.025, pal.craneAmber, 6);
      addRodBetween(roofShellGroup, pA1, pB1, 0.026, pal.gunmetalSteel, 6);
    }
  }
  // Climbing cage collar, service rest platform & toothed slew ring
  const slewY = craneBaseY + 0.38 + mastH;
  boxAt(roofShellGroup, 1.38, 0.12, 1.38, craneBaseX, slewY - 0.52, craneBaseZ, pal.gunmetalSteel, true, false);
  cylAt(roofShellGroup, 0.58, 0.62, 0.24, craneBaseX, slewY + 0.12, craneBaseZ, pal.gunmetalSteel, true, false, 20);

  // Rotating Crane Superstructure (craneTop)
  const craneTop = new THREE.Group();
  craneTop.position.set(craneBaseX, slewY + 0.24, craneBaseZ);

  // Turntable deck frame
  boxAt(craneTop, 1.55, 0.22, 1.25, 0, 0.11, 0, pal.gunmetalSteel, true, false, 0.02);

  // Glazed Operator Cabin (offset to +Z starboard side of slew ring)
  const cabX = 0.42;
  const cabZ = 0.72;
  boxAt(craneTop, 1.15, 0.12, 0.92, cabX, 0.24, cabZ, pal.gunmetalSteel, true, false);
  boxAt(craneTop, 1.08, 1.05, 0.84, cabX, 0.82, cabZ, pal.vitrineGlass, false, false);
  boxAt(craneTop, 1.16, 0.12, 0.92, cabX, 1.38, cabZ, pal.craneAmber, true, false, 0.02);
  [-0.5, 0.5].forEach((cx) => {
    [-0.38, 0.38].forEach((cz) => {
      boxAt(craneTop, 0.07, 1.14, 0.07, cabX + cx, 0.82, cabZ + cz, pal.gunmetalSteel, false, false);
    });
  });
  // Interior control console & amber cabin roof beacon
  boxAt(craneTop, 0.34, 0.44, 0.48, cabX + 0.26, 0.52, cabZ, pal.vrDarkPad, false, false);
  cylAt(craneTop, 0.07, 0.09, 0.14, cabX, 1.5, cabZ, pal.safetyOrange, false, false, 10);

  // Open Triangular-Lattice Main Jib (extends +X = +8.8m)
  const jibStart = -0.6;
  const jibEnd = 8.8;
  const jibYBot = 0.45;
  const jibYTop = 1.05;
  const jibHalfZ = 0.28;
  // Top apex chord + two bottom chords
  boxAt(craneTop, jibEnd - jibStart, 0.075, 0.075, (jibStart + jibEnd) * 0.5, jibYTop, 0, pal.craneAmber, true, false);
  [-jibHalfZ, jibHalfZ].forEach((jz) => {
    boxAt(craneTop, jibEnd - jibStart, 0.075, 0.075, (jibStart + jibEnd) * 0.5, jibYBot, jz, pal.craneAmber, true, false);
  });
  const jibBays = 10;
  for (let b = 0; b < jibBays; b++) {
    const x0 = THREE.MathUtils.lerp(jibStart, jibEnd, b / jibBays);
    const x1 = THREE.MathUtils.lerp(jibStart, jibEnd, (b + 1) / jibBays);
    const xm = (x0 + x1) * 0.5;
    [-jibHalfZ, jibHalfZ].forEach((jz) => {
      addRodBetween(craneTop, new THREE.Vector3(x0, jibYBot, jz), new THREE.Vector3(xm, jibYTop, 0), 0.022, pal.craneAmber, 6);
      addRodBetween(craneTop, new THREE.Vector3(x1, jibYBot, jz), new THREE.Vector3(xm, jibYTop, 0), 0.022, pal.craneAmber, 6);
    });
    addRodBetween(craneTop, new THREE.Vector3(x1, jibYBot, -jibHalfZ), new THREE.Vector3(x1, jibYBot, jibHalfZ), 0.02, pal.gunmetalSteel, 6);
  }
  // Red/white aviation warning strobe at jib tip
  cylAt(craneTop, 0.08, 0.08, 0.16, jibEnd - 0.1, jibYTop + 0.12, 0, new THREE.MeshBasicMaterial({ color: 0xef4444 }), false, false, 10);

  // Counter-Jib (extends -X = -4.2m) with steel deck, safety handrail & 4 Precast Concrete Ballast Slabs
  boxAt(craneTop, 4.1, 0.16, 1.05, -2.2, 0.36, 0, pal.gunmetalSteel, true, false, 0.02);
  for (let bi = 0; bi < 4; bi++) {
    boxAt(craneTop, 0.36, 1.02, 0.88, -2.55 - bi * 0.42, 0.86, 0, pal.boardformedConcrete, true, true, 0.02);
    boxAt(craneTop, 0.06, 0.12, 0.12, -2.55 - bi * 0.42, 1.42, 0, pal.craneAmber, false, false);
  }

  // Cathead A-Frame Tower & Tensioned Steel Pendant Tie-Rods
  const apexPt = new THREE.Vector3(0, 2.38, 0);
  [
    [-0.36, -0.32],
    [0.36, -0.32],
    [-0.36, 0.32],
    [0.36, 0.32],
  ].forEach(([ax, az]) => {
    addRodBetween(craneTop, new THREE.Vector3(ax, 0.42, az), apexPt, 0.045, pal.craneAmber, 8);
  });
  addRodBetween(craneTop, apexPt, new THREE.Vector3(4.6, jibYTop + 0.04, 0), 0.022, pal.galvanizedSteel, 6);
  addRodBetween(craneTop, apexPt, new THREE.Vector3(8.3, jibYTop + 0.04, 0), 0.022, pal.galvanizedSteel, 6);
  addRodBetween(craneTop, apexPt, new THREE.Vector3(-3.8, 0.92, 0), 0.024, pal.galvanizedSteel, 6);

  // Motorized Trolley Carriage + Twin Wire-Rope Cables + Hook Block + Suspended Steel I-Beam Load
  const trolleyX = 6.0;
  boxAt(craneTop, 0.62, 0.18, 0.66, trolleyX, jibYBot - 0.04, 0, pal.gunmetalSteel, true, false);
  [-0.14, 0.14].forEach((rz) => {
    cylAt(craneTop, 0.015, 0.015, 1.85, trolleyX, jibYBot - 0.96, rz, pal.galvanizedSteel, false, false, 6);
  });
  // Sheave hook block & forged hook
  boxAt(craneTop, 0.28, 0.32, 0.38, trolleyX, jibYBot - 1.92, 0, pal.craneAmber, true, false, 0.02);
  cylAt(craneTop, 0.045, 0.03, 0.24, trolleyX, jibYBot - 2.18, 0, pal.gunmetalSteel, false, false, 8);
  // Rigged sling cables & suspended structural steel I-beam
  const beamY = jibYBot - 2.68;
  addRodBetween(craneTop, new THREE.Vector3(trolleyX, jibYBot - 2.26, 0), new THREE.Vector3(trolleyX - 0.95, beamY + 0.12, 0), 0.014, pal.galvanizedSteel, 6);
  addRodBetween(craneTop, new THREE.Vector3(trolleyX, jibYBot - 2.26, 0), new THREE.Vector3(trolleyX + 0.95, beamY + 0.12, 0), 0.014, pal.galvanizedSteel, 6);
  addIBeam(craneTop, trolleyX, beamY, 0, 2.4, 0.22, 0.16, 'x', pal.gunmetalSteel);

  roofShellGroup.add(craneTop);
  rotatingProps.push({ obj: craneTop, speed: 0.14, axis: 'y' });
}
