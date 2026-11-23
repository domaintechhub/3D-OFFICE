import * as THREE from 'three';
import { buildPlanterTrough } from './architecturalForms';
import {
  armchair,
  boxAt,
  ceilingLinearLight,
  cylAt,
  downlight,
  monitor,
  officeChair,
  plant,
  shelfUnit,
  sofaWide,
} from './props';
import { buildRealEstateExteriorAndCrown } from './realestateExterior';
import {
  addPendantFixture,
  addRealEstatePlaque,
  buildMasterplanVitrine,
  getRealEstatePalette,
  type RealEstateBuildContext,
  type RealEstatePalette,
} from './realestatePalette';
import { createCustomBoardScreen } from './screens';
import { makeCanvasTex, rr } from './textures';

const SLAB_THICK = 0.24;

function makeDesk(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  topMat: THREE.Material,
  frameMat: THREE.Material
) {
  boxAt(parent, w, 0.055, d, x, y + 0.74, z, topMat, true, true, 0.012);
  boxAt(parent, w - 0.18, 0.7, 0.05, x, y + 0.36, z - d * 0.34, frameMat, false, true, 0.008);
  [-w * 0.44, w * 0.44].forEach((lx) => {
    boxAt(parent, 0.06, 0.72, d * 0.82, x + lx, y + 0.36, z, frameMat, false, true, 0.008);
  });
}

/**
 * Full 5-Level Realistic Architectural Construction & Interior Build for
 * TerraCraft Estates, Build & Interiors (`realestate`: G -> L4 + Stairwell + Ceilings + Crown).
 */
export function buildRealEstateWholeBuilding(ctx: RealEstateBuildContext) {
  const {
    spec,
    levelGroups,
    levelCeilings,
    M,
    archMats,
    frameDarkMat,
    accentMat,
    floorWarmOak,
    floorTerrazzo,
    woodCedarMat,
    screenReg,
    registerChair,
    registerMonitor,
    pickMeshes,
    warmLights,
  } = ctx;

  const pal = getRealEstatePalette(M);

  // 1. Exterior Curtain-Wall Envelope, Porte-Cochere, West Construction Yard & Lattice Tower Crane
  buildRealEstateExteriorAndCrown(ctx, pal);

  // Shared Dynamic Canvas Screens (reused cleanly on secondary displays)
  const boothScreen = createCustomBoardScreen(screenReg, 480, 240, (g, w, h) => {
    g.fillStyle = '#0f172a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3b634b';
    g.fillRect(0, 0, w, 34);
    g.fillStyle = '#ffffff';
    g.font = '800 16px sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('ESTATE MASTERPLAN · PHASE II AVAILABILITY', 14, 17);
    g.fillStyle = '#6ba368';
    rr(g, 24, 52, 230, 164, 8);
    g.fill();
    g.fillStyle = '#e2e8f0';
    g.fillRect(54, 78, 70, 52);
    g.fillRect(148, 92, 82, 48);
    g.fillStyle = '#38bdf8';
    g.fillRect(72, 152, 110, 34);
    g.fillStyle = '#e07a5f';
    g.font = '700 15px monospace';
    g.fillText('VILLA 04 · KES 82M', 274, 84);
    g.fillStyle = '#cbd5e1';
    g.font = '600 13px sans-serif';
    g.fillText('4 Bed + Pool · Ready Title', 274, 112);
    g.fillStyle = '#4ade80';
    g.fillText('LOFT B2 · AVAILABLE', 274, 154);
  });

  const kioskBoard = createCustomBoardScreen(screenReg, 360, 260, (g, w, h, t) => {
    g.fillStyle = '#0c1522';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e07a5f';
    g.fillRect(0, 0, w, 30);
    g.fillStyle = '#ffffff';
    g.font = '800 14px sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('TOUCHSCREEN PROPERTY EXPLORER', 12, 15);
    g.fillStyle = '#334e3a';
    rr(g, 14, 42, w - 28, h - 56, 8);
    g.fill();
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 3;
    g.strokeRect(30, 62, w - 60, h - 96);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
    [
      [95, 110],
      [185, 145],
      [265, 102],
    ].forEach(([px, py]) => {
      g.fillStyle = `rgba(224,122,95,${0.55 + pulse * 0.4})`;
      g.beginPath();
      g.arc(px, py, 9, 0, Math.PI * 2);
      g.fill();
    });
  });

  const propGridTex = makeCanvasTex('re_v2_prop_grid', 512, 320, (g, w, h) => {
    g.fillStyle = '#e8e4dc';
    g.fillRect(0, 0, w, h);
    const cols = 4;
    const rows = 3;
    const cw = (w - 30) / cols;
    const ch = (h - 28) / rows;
    const skyCols = ['#3b82f6', '#0ea5e9', '#6366f1', '#14b8a6', '#f59e0b', '#e07a5f'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 12 + c * (cw + 2);
        const y = 10 + r * (ch + 2);
        g.fillStyle = '#ffffff';
        g.fillRect(x, y, cw - 6, ch - 6);
        g.fillStyle = skyCols[(r * cols + c) % skyCols.length];
        g.fillRect(x + 4, y + 4, cw - 14, ch * 0.56);
        g.fillStyle = '#334155';
        g.fillRect(x + 12, y + ch * 0.28, cw - 30, ch * 0.34);
        g.fillStyle = '#7ea16b';
        g.fillRect(x + 4, y + ch * 0.58, cw - 14, ch * 0.22);
        g.fillStyle = '#1e293b';
        g.fillRect(x + 6, y + ch * 0.84, cw * 0.62, 5);
      }
    }
  });
  propGridTex.colorSpace = THREE.SRGBColorSpace;

  const buildDualMeetingRooms = (lg: THREE.Group, fyLv: number, seedBase: number, screenMat: THREE.Material) => {
    [spec.cx - 1.9, spec.cx + 2.7].forEach((mx, mi) => {
      const mz = spec.cz + 6.4;
      const frontZRoom = spec.cz + 4.2;
      boxAt(lg, 1.45, 2.75, 0.06, mx - 1.4, fyLv + 1.375, frontZRoom, pal.vitrineGlass, false, false);
      boxAt(lg, 1.45, 2.75, 0.06, mx + 1.4, fyLv + 1.375, frontZRoom, pal.vitrineGlass, false, false);
      boxAt(lg, 4.4, 0.14, 0.14, mx, fyLv + 2.75, frontZRoom, archMats.timberFin, false, false);
      if (mi === 0) {
        boxAt(lg, 0.08, 2.75, 4.4, spec.cx + 0.4, fyLv + 1.375, mz, archMats.timberFin, true, false);
      }
      boxAt(lg, 0.12, 2.75, 4.4, mi === 0 ? spec.cx - 4.15 : spec.cx + 4.95, fyLv + 1.375, mz, archMats.timberFin, true, false);
      for (let sx = mx - 1.8; sx <= mx + 1.8; sx += 0.24) {
        boxAt(lg, 0.07, 2.75, 0.06, sx, fyLv + 1.375, spec.cz + 8.58, archMats.timberFin, false, false);
      }
      boxAt(lg, 2.2, 1.25, 0.08, mx, fyLv + 1.7, spec.cz + 8.5, frameDarkMat, false, false);
      const mtv = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 1.1), screenMat);
      mtv.position.set(mx, fyLv + 1.7, spec.cz + 8.44);
      mtv.rotation.y = Math.PI;
      lg.add(mtv);

      cylAt(lg, 0.92, 0.92, 0.055, mx, fyLv + 0.74, mz, M.walnut, true, true, 24);
      cylAt(lg, 0.16, 0.22, 0.72, mx, fyLv + 0.36, mz, M.dark, true, true, 14);
      [
        [-1.12, 0, Math.PI / 2],
        [1.12, 0, -Math.PI / 2],
        [0, -1.12, 0],
        [0, 1.12, Math.PI],
      ].forEach(([cxo, czo, crot]) => {
        officeChair(lg, mx + cxo, fyLv, mz + czo, crot, M);
      });
      plant(lg, mx - 1.65, fyLv, spec.cz + 4.85, 0.72, seedBase + mi, M, 'olive');
    });
  };

  // ===========================================================================
  // GROUND FLOOR (lv === 0): Arrival Hall, Reception, 3D Masterplan & Gallery
  // ===========================================================================
  const g0 = levelGroups[0];
  const fy = spec.groundY + SLAB_THICK * 0.5;
  const ceilY0 = spec.groundY + spec.floorH - 0.14;

  warmLights.push({
    x: spec.cx - 2.5,
    y: fy + 3.1,
    z: spec.cz - 3.6,
    color: 0xfff1dc,
    distance: 19,
    baseScale: 0.98,
    floor: 0,
    buildingId: spec.id,
  });

  // Flooring inlays: Chevron European Oak entrance + Slate Carpet zones
  boxAt(g0, 12.6, 0.015, 16.4, spec.cx - 1.8, fy + 0.008, spec.cz, pal.chevronOak, false, true);
  boxAt(g0, 7.4, 0.02, 16.8, spec.cx + 8.9, fy + 0.014, spec.cz, pal.slateCarpet, false, true);
  boxAt(g0, 8.1, 0.02, 5.0, spec.cx - 8.45, fy + 0.014, spec.cz + 6.1, pal.slateCarpet, false, true);

  // NW Corner Lounge (4 Cognac Leather Armchairs + Honed Travertine Table + Corner Plants)
  const cornerCx = spec.cx - 9.8;
  const cornerCz = spec.cz - 6.7;
  cylAt(g0, 0.52, 0.52, 0.045, cornerCx, fy + 0.42, cornerCz, pal.honedTravertine, true, true, 24);
  cylAt(g0, 0.08, 0.14, 0.4, cornerCx, fy + 0.2, cornerCz, pal.brushedBronze, false, true, 16);
  [
    [-0.95, -0.82, Math.PI * 0.22],
    [0.95, -0.82, -Math.PI * 0.22],
    [-0.95, 0.82, Math.PI * 0.78],
    [0.95, 0.82, -Math.PI * 0.78],
  ].forEach(([ox, oz, rot]) => {
    const ch = armchair(g0, cornerCx + ox, fy, cornerCz + oz, rot, M.fabricCognac, M);
    ch.scale.set(0.74, 0.88, 0.74);
  });
  plant(g0, spec.cx - 11.8, fy, spec.cz - 7.8, 1.15, 901, M, 'monst');
  plant(g0, spec.cx - 8.65, fy, spec.cz - 2.15, 1.05, 902, M, 'ficus');

  // West Entrance Showcase Wall: Vertical Architectural Property LED Wall
  const showcaseBoard = createCustomBoardScreen(screenReg, 520, 360, (g, w, h, t) => {
    const slide = Math.floor(t / 4.5) % 2;
    const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, slide === 0 ? '#1e3a5f' : '#2b3d54');
    sky.addColorStop(1, '#8fb8d8');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d5e3a';
    g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle = '#d6cfc2';
    g.fillRect(0, h * 0.74, w, h * 0.14);
    g.fillStyle = '#f5f1e8';
    g.fillRect(54, 98, 260, 130);
    g.fillStyle = '#3b2b20';
    g.fillRect(42, 90, 290, 14);
    g.fillRect(150, 148, 220, 12);
    g.fillStyle = '#7dd3fc';
    g.fillRect(74, 118, 92, 98);
    g.fillRect(184, 168, 118, 62);
    g.fillStyle = '#0ea5e9';
    g.fillRect(80, h * 0.76, 220, 24);
    g.fillStyle = 'rgba(11,17,28,0.88)';
    g.fillRect(0, h - 58, w, 58);
    g.fillStyle = '#e07a5f';
    g.fillRect(0, h - 58, 8, 58);
    g.fillStyle = '#ffffff';
    g.font = '800 20px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(slide === 0 ? 'KAREN RIDGE SIGNATURE VILLAS' : 'UPPER HILL SKYLINE RESIDENCES', 22, h - 37);
    g.fillStyle = '#cbd5e1';
    g.font = '600 13px sans-serif';
    g.fillText('TERRACRAFT ESTATES · ARCHITECTURE & TURNKEY INTERIORS', 22, h - 16);
  });
  boxAt(g0, 0.16, 2.75, 4.1, spec.cx - 12.25, fy + 1.42, spec.cz - 3.6, frameDarkMat, true, false, 0.03);
  const showMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.88, 2.52), showcaseBoard.mat);
  showMesh.position.set(spec.cx - 12.16, fy + 1.42, spec.cz - 3.6);
  showMesh.rotation.y = Math.PI / 2;
  g0.add(showMesh);
  showcaseBoard.setMesh(showMesh);

  // Curved Fluted-Travertine & Brushed-Bronze Reception Desk
  const recCx = spec.cx - 5.1;
  const recCz = spec.cz - 4.8;
  const recShape = new THREE.Shape();
  const a0 = -Math.PI * 0.28;
  const a1 = Math.PI * 0.72;
  recShape.absarc(0, 0, 2.02, a0, a1, false);
  recShape.absarc(0, 0, 1.32, a1, a0, true);
  recShape.closePath();
  const recCounterGeo = new THREE.ExtrudeGeometry(recShape, {
    depth: 0.94,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 24,
  });
  recCounterGeo.rotateX(-Math.PI / 2);
  const recCounter = new THREE.Mesh(recCounterGeo, pal.flutedTravertine);
  recCounter.position.set(recCx, fy + 0.07, recCz);
  recCounter.castShadow = true;
  recCounter.receiveShadow = true;
  g0.add(recCounter);
  pickMeshes.push(recCounter);

  const recCapGeo = new THREE.ExtrudeGeometry(recShape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, curveSegments: 24 });
  recCapGeo.rotateX(-Math.PI / 2);
  const recCap = new THREE.Mesh(recCapGeo, pal.honedTravertine);
  recCap.position.set(recCx, fy + 1.01, recCz);
  g0.add(recCap);

  const recPlinthGeo = new THREE.ExtrudeGeometry(recShape, { depth: 0.07, bevelEnabled: false, curveSegments: 20 });
  recPlinthGeo.rotateX(-Math.PI / 2);
  const recPlinth = new THREE.Mesh(recPlinthGeo, pal.brushedBronze);
  recPlinth.position.set(recCx, fy, recCz);
  g0.add(recPlinth);

  const recEmblemTex = makeCanvasTex('re_v2_rec_emblem', 256, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#c59b52';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(96, 36);
    g.lineTo(128, 12);
    g.lineTo(160, 36);
    g.stroke();
    g.fillStyle = '#b4873e';
    g.font = '800 26px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('TERRACRAFT', w / 2, 60);
    g.font = '600 12px sans-serif';
    g.fillText('ESTATES · BUILD · INTERIORS', w / 2, 82);
  });
  const recEmblem = new THREE.Mesh(
    new THREE.PlaneGeometry(1.12, 0.42),
    new THREE.MeshStandardMaterial({ map: recEmblemTex, transparent: true, roughness: 0.35, metalness: 0.55 })
  );
  recEmblem.position.set(recCx + 1.56, fy + 0.56, recCz - 1.32);
  recEmblem.rotation.y = Math.PI * 0.72;
  g0.add(recEmblem);

  boxAt(g0, 1.55, 0.06, 0.72, recCx + 0.15, fy + 0.74, recCz - 0.15, M.walnut, true, true, 0.015);
  registerChair(0, recCx - 0.45, fy, recCz + 0.55, Math.PI * 0.75, 1);
  registerMonitor(
    0,
    0,
    [recCx + 0.35, fy + 0.77, recCz - 0.25],
    -Math.PI * 0.25,
    recCx - 0.45,
    recCz + 0.55,
    'Front Desk Concierge',
    'Curved Marble Reception'
  );

  // Center Entrance Promenade: Bespoke Illuminated 3D Masterplan Vitrine
  buildMasterplanVitrine(g0, spec.cx - 0.25, fy, spec.cz - 1.45, 3.45, 2.15, 'mixed', ctx, pal);

  // Sage-Green Partitioned Client Consultation Booth
  const boothX = spec.cx - 5.95;
  const boothZ = spec.cz + 0.55;
  boxAt(g0, 4.3, 2.05, 0.18, boothX, fy + 1.025, boothZ + 1.65, pal.sageAcoustic, true, true, 0.02);
  boxAt(g0, 2.1, 1.15, 0.08, boothX, fy + 1.4, boothZ + 1.54, frameDarkMat, false, false);
  const boothTvMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.02), boothScreen.mat);
  boothTvMesh.position.set(boothX, fy + 1.4, boothZ + 1.49);
  boothTvMesh.rotation.y = Math.PI;
  g0.add(boothTvMesh);
  boothScreen.setMesh(boothTvMesh);

  const mustardSofa = sofaWide(g0, boothX - 1.45, fy, boothZ, Math.PI / 2, pal.mustardBoucle, M);
  mustardSofa.scale.set(0.72, 0.94, 0.85);
  const tealSofa = sofaWide(g0, boothX + 1.45, fy, boothZ, -Math.PI / 2, pal.tealLinen, M);
  tealSofa.scale.set(0.72, 0.94, 0.85);
  cylAt(g0, 0.54, 0.54, 0.05, boothX, fy + 0.42, boothZ, M.walnut, true, true, 22);
  cylAt(g0, 0.08, 0.14, 0.4, boothX, fy + 0.2, boothZ, M.dark, false, true, 14);
  boxAt(g0, 0.26, 0.02, 0.34, boothX - 0.14, fy + 0.455, boothZ + 0.06, M.white, false, false);
  boxAt(g0, 0.24, 0.02, 0.3, boothX + 0.16, fy + 0.455, boothZ - 0.08, accentMat, false, false);

  boxAt(g0, 0.62, 0.92, 1.45, spec.cx - 3.9, fy + 0.46, boothZ, M.walnut, true, true, 0.02);
  boxAt(g0, 0.1, 0.88, 1.18, spec.cx - 3.58, fy + 1.32, boothZ, frameDarkMat, true, false, 0.02);
  const kioskMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.78), kioskBoard.mat);
  kioskMesh.position.set(spec.cx - 3.52, fy + 1.32, boothZ);
  kioskMesh.rotation.y = Math.PI / 2;
  g0.add(kioskMesh);
  kioskBoard.setMesh(kioskMesh);
  plant(g0, spec.cx - 3.7, fy, spec.cz + 2.25, 0.95, 903, M, 'olive');

  // Center-Left Collaboration Lounge
  const loungeX = spec.cx + 3.2;
  const loungeZ = spec.cz - 0.1;
  boxAt(g0, 2.75, 0.02, 3.6, loungeX, fy + 0.02, loungeZ, pal.wovenTaupeRug, false, true);
  boxAt(g0, 3.0, 2.0, 0.18, loungeX, fy + 1.0, loungeZ - 2.35, pal.sageAcoustic, true, true, 0.02);
  boxAt(g0, 3.0, 1.4, 0.18, loungeX, fy + 0.7, loungeZ + 2.25, pal.sageAcoustic, true, true, 0.02);
  const loungeTv = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.94), boothScreen.mat);
  loungeTv.position.set(loungeX, fy + 1.38, loungeZ - 2.24);
  g0.add(loungeTv);
  boxAt(g0, 1.88, 1.04, 0.06, loungeX, fy + 1.38, loungeZ - 2.26, frameDarkMat, false, false);

  const coralSofa = sofaWide(g0, loungeX + 0.95, fy, loungeZ, -Math.PI / 2, pal.coralBoucle, M);
  coralSofa.scale.set(0.76, 0.94, 0.85);
  const tealClub = armchair(g0, loungeX - 0.45, fy, loungeZ - 1.25, 0, pal.tealLinen, M);
  tealClub.scale.set(0.78, 0.9, 0.78);
  const mustardClub = armchair(g0, loungeX - 0.45, fy, loungeZ + 1.25, Math.PI, pal.mustardBoucle, M);
  mustardClub.scale.set(0.78, 0.9, 0.78);
  boxAt(g0, 0.78, 0.38, 1.12, loungeX - 0.35, fy + 0.19, loungeZ, M.oakDesk, true, true, 0.03);

  // East Wing Featured Properties Illuminated Gallery Wall & Nairobi Portfolio Map
  const galX = spec.cx + 12.56;
  boxAt(g0, 0.24, 0.48, 15.2, galX - 0.12, fy + 2.95, spec.cz, new THREE.MeshStandardMaterial({ color: 0x3f7a38, roughness: 0.88 }), false, false);
  const galHeaderTex = makeCanvasTex('re_v2_featured_hdr', 1024, 96, (g, w, h) => {
    g.fillStyle = '#2d333b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.font = '800 38px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('FEATURED PROPERTIES   ·   TERRACRAFT PORTFOLIO   ·   FEATURED PROPERTIES', w / 2, h / 2);
  });
  galHeaderTex.colorSpace = THREE.SRGBColorSpace;
  const galHdr = new THREE.Mesh(new THREE.PlaneGeometry(14.8, 0.56), new THREE.MeshBasicMaterial({ map: galHeaderTex }));
  galHdr.position.set(galX - 0.04, fy + 2.52, spec.cz);
  galHdr.rotation.y = -Math.PI / 2;
  g0.add(galHdr);

  const propMapTex = makeCanvasTex('re_v2_region_map', 512, 320, (g, w, h) => {
    g.fillStyle = '#f3efe6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d7e6c9';
    g.beginPath();
    g.ellipse(120, 120, 85, 55, 0.3, 0, Math.PI * 2);
    g.ellipse(390, 210, 95, 65, -0.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#93c5fd';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(0, 210);
    g.quadraticCurveTo(220, 150, 512, 95);
    g.stroke();
    [
      [110, 95],
      [165, 160],
      [245, 130],
      [290, 200],
      [365, 115],
      [420, 185],
    ].forEach(([px, py]) => {
      g.fillStyle = '#dc2626';
      g.beginPath();
      g.arc(px, py, 8, 0, Math.PI * 2);
      g.fill();
    });
  });
  propMapTex.colorSpace = THREE.SRGBColorSpace;

  [-4.9, 4.9].forEach((dz) => {
    boxAt(g0, 0.08, 1.85, 4.4, galX - 0.05, fy + 1.32, spec.cz + dz, frameDarkMat, false, false);
    const gm = new THREE.Mesh(
      new THREE.PlaneGeometry(4.25, 1.72),
      new THREE.MeshStandardMaterial({ map: propGridTex, emissive: 0xffffff, emissiveMap: propGridTex, emissiveIntensity: 0.22, roughness: 0.4 })
    );
    gm.position.set(galX - 0.1, fy + 1.32, spec.cz + dz);
    gm.rotation.y = -Math.PI / 2;
    g0.add(gm);
  });
  boxAt(g0, 0.08, 1.85, 4.2, galX - 0.05, fy + 1.32, spec.cz, frameDarkMat, false, false);
  const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.05, 1.72), new THREE.MeshStandardMaterial({ map: propMapTex, roughness: 0.55 }));
  mapMesh.position.set(galX - 0.1, fy + 1.32, spec.cz);
  mapMesh.rotation.y = -Math.PI / 2;
  g0.add(mapMesh);

  // East Wing: 3 Open-Plan 4-Seat Workstation Pods
  const g0PodMeta = [
    { role: 'Senior Property Broker', zone: 'Real Estate Masterplan Gallery' },
    { role: 'Lead Structural Engineer', zone: 'Construction CAD & Interior Atelier' },
    { role: 'Interior Design Director', zone: 'Construction CAD & Interior Atelier' },
  ];
  [-5.4, -0.4, 5.0].forEach((pdz, pi) => {
    const px = spec.cx + 8.9;
    const pz = spec.cz + pdz;
    makeDesk(g0, px, fy, pz, 2.8, 1.36, M.oakDesk, pal.gunmetalSteel);
    boxAt(g0, 2.7, 0.28, 0.05, px, fy + 0.91, pz, M.dark, false, false);
    addPendantFixture(g0, px, fy + 2.68, ceilY0, pz, 2.5, pal, frameDarkMat);

    const seatZN = pz - 1.05;
    const seatZS = pz + 1.05;
    registerChair(0, px - 0.68, fy, seatZN, 0, 1);
    registerMonitor(0, pi + 1, [px - 0.68, fy + 0.77, pz - 0.25], Math.PI, px - 0.68, seatZN, g0PodMeta[pi].role, g0PodMeta[pi].zone);
    officeChair(g0, px + 0.68, fy, seatZN, 0, M);
    monitor(g0, px + 0.68, fy + 0.77, pz - 0.25, true, Math.PI, M);
    officeChair(g0, px - 0.68, fy, seatZS, Math.PI, M);
    monitor(g0, px - 0.68, fy + 0.77, pz + 0.25, true, 0, M);
    officeChair(g0, px + 0.68, fy, seatZS, Math.PI, M);
    monitor(g0, px + 0.68, fy + 0.77, pz + 0.25, true, 0, M);
  });
  plant(g0, spec.cx + 5.6, fy, spec.cz - 3.0, 1.45, 910, M, 'ficus');
  plant(g0, spec.cx + 5.6, fy, spec.cz + 2.4, 1.35, 911, M, 'ficus');

  for (let sx = spec.cx + 5.6; sx <= spec.cx + 12.2; sx += 0.28) {
    boxAt(g0, 0.09, 3.0, 0.07, sx, fy + 1.5, spec.cz + 8.68, archMats.timberFin, false, false);
  }
  [spec.cx + 7.4, spec.cx + 8.9, spec.cx + 10.4].forEach((hx, hi) => {
    cylAt(g0, 0.012, 0.012, 0.75, hx, fy + 3.45, spec.cz + 7.9, M.dark, false, false, 6);
    plant(g0, hx, fy + 2.65, spec.cz + 7.9, 0.48, 920 + hi, M, 'fern');
  });

  // Back Center: 2 Glass-Fronted Executive Meeting Rooms
  buildDualMeetingRooms(g0, fy, 930, boothScreen.mat);

  // SW Hospitality Coffee Bar & Kitchenette
  const barCx = spec.cx - 8.5;
  boxAt(g0, 5.2, 0.92, 0.85, barCx, fy + 0.46, spec.cz + 8.15, pal.kitchenCab, true, true, 0.02);
  boxAt(g0, 5.26, 0.06, 0.9, barCx, fy + 0.94, spec.cz + 8.15, pal.honedTravertine, false, true, 0.01);
  boxAt(g0, 4.8, 0.78, 0.42, barCx, fy + 2.25, spec.cz + 8.36, pal.kitchenCab, true, false, 0.02);
  [-3.1, 3.1].forEach((fx) => {
    boxAt(g0, 0.96, 2.35, 0.85, barCx + fx, fy + 1.175, spec.cz + 8.15, M.chrome, true, true, 0.03);
  });
  boxAt(g0, 0.82, 0.52, 0.56, barCx - 1.2, fy + 1.23, spec.cz + 8.12, M.dark, true, false, 0.02);
  boxAt(g0, 0.72, 0.14, 0.4, barCx - 1.2, fy + 1.48, spec.cz + 8.12, M.chrome, false, false);

  const islZ = spec.cz + 5.55;
  boxAt(g0, 3.5, 0.94, 0.92, barCx, fy + 0.47, islZ, pal.kitchenCab, true, true, 0.02);
  boxAt(g0, 3.68, 0.07, 1.08, barCx, fy + 0.975, islZ, pal.honedTravertine, true, true, 0.02);
  boxAt(g0, 2.8, 0.05, 0.08, barCx, fy + 2.65, islZ, M.dark, false, false);
  [-1.1, -0.36, 0.36, 1.1].forEach((sx) => {
    cylAt(g0, 0.012, 0.012, 0.55, barCx + sx, fy + 2.36, islZ, M.dark, false, false, 6);
    cylAt(g0, 0.07, 0.09, 0.11, barCx + sx, fy + 2.08, islZ, pal.warmCoveLed, false, false, 10);
    const stoolX = barCx + sx * 1.15;
    const stoolZ = islZ - 0.95;
    cylAt(g0, 0.21, 0.2, 0.06, stoolX, fy + 0.68, stoolZ, M.walnut, true, true, 16);
    cylAt(g0, 0.035, 0.035, 0.66, stoolX, fy + 0.33, stoolZ, M.dark, false, false, 10);
    cylAt(g0, 0.18, 0.22, 0.04, stoolX, fy + 0.02, stoolZ, M.dark, false, true, 14);
  });

  // ===========================================================================
  // LEVEL 1 (lv === 1): Double-Height Atrium Overlook & Design-Build Studio
  // ===========================================================================
  const g1 = levelGroups[1];
  const fy1 = spec.groundY + spec.floorH + SLAB_THICK * 0.5;
  const ceilY1 = spec.groundY + 2 * spec.floorH - 0.14;
  warmLights.push({
    x: spec.cx + 1.5,
    y: fy1 + 3.1,
    z: spec.cz,
    color: 0xfff4e0,
    distance: 22,
    baseScale: 0.96,
    floor: 1,
    buildingId: spec.id,
  });

  boxAt(g1, 13.0, 0.018, 1.25, spec.cx + 5.9, fy1 + 0.009, spec.cz - 8.2, pal.chevronOak, false, true);
  boxAt(g1, 2.95, 0.018, 5.6, spec.cx - 7.675, fy1 + 0.009, spec.cz + 1.0, pal.chevronOak, false, true);
  boxAt(g1, 7.2, 0.02, 16.1, spec.cx + 8.8, fy1 + 0.014, spec.cz + 0.45, pal.slateCarpet, false, true);
  boxAt(g1, 5.75, 0.02, 16.1, spec.cx + 2.325, fy1 + 0.014, spec.cz + 0.45, pal.slateCarpet, false, true);
  boxAt(g1, 5.65, 0.02, 5.95, spec.cx - 3.375, fy1 + 0.014, spec.cz + 1.225, pal.slateCarpet, false, true);
  boxAt(g1, 3.65, 0.02, 4.3, spec.cx - 2.375, fy1 + 0.014, spec.cz + 6.35, pal.slateCarpet, false, true);
  boxAt(g1, 8.2, 0.02, 4.7, spec.cx - 8.3, fy1 + 0.014, spec.cz + 6.15, floorTerrazzo, false, true);

  buildPlanterTrough(g1, spec.cx + 13.55, fy1 - 0.02, spec.cz - 3.2, 6.2, Math.PI / 2, 951, archMats);
  buildPlanterTrough(g1, spec.cx + 13.55, fy1 - 0.02, spec.cz + 3.4, 6.2, Math.PI / 2, 952, archMats);

  // Atrium Void Spider-Fitted Glass Balustrade & Tiered Brass Halo Chandelier over NW Void
  const addBalustrade = (bx: number, bz: number, bw: number, bd: number, h = 1.04) => {
    boxAt(g1, bw, h, bd, bx, fy1 + h * 0.5, bz, pal.vitrineGlass, false, false);
    boxAt(
      g1,
      bw > bd ? bw + 0.04 : 0.06,
      0.05,
      bd > bw ? bd + 0.04 : 0.06,
      bx,
      fy1 + h + 0.025,
      bz,
      archMats.bronzeMullion,
      true,
      false
    );
  };
  addBalustrade(spec.cx - 0.6, spec.cz - 5.125, 0.045, 6.65);
  addBalustrade(spec.cx - 6.35, spec.cz - 1.8, 11.5, 0.045);
  addBalustrade(spec.cx - 6.35, spec.cz - 8.45, 11.5, 0.045);
  addBalustrade(spec.cx - 12.1, spec.cz - 5.125, 0.045, 6.65);

  // Tiered architectural brass ring chandelier suspended in the double-height atrium opening
  const haloX = spec.cx - 6.2;
  const haloZ = spec.cz - 5.1;
  [1.45, 0.95].forEach((r, ri) => {
    const ringY = ceilY1 - 1.55 - ri * 0.65;
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.032, 10, 36),
      pal.brushedBronze
    );
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(haloX, ringY, haloZ);
    g1.add(ringMesh);
    const ledRing = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.018, 8, 36),
      pal.warmCoveLed
    );
    ledRing.rotation.x = Math.PI / 2;
    ledRing.position.set(haloX, ringY - 0.025, haloZ);
    g1.add(ledRing);
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2;
      const drop = ceilY1 - ringY;
      cylAt(g1, 0.008, 0.008, drop, haloX + Math.cos(ang) * r, ringY + drop * 0.5, haloZ + Math.sin(ang) * r, frameDarkMat, false, false, 6);
    }
  });

  // East wall living strips, credenza & live BIM display
  const eastWallX = spec.cx + 12.42;
  [-7.0, -0.8].forEach((gz) => {
    boxAt(g1, 0.16, 2.55, 1.35, eastWallX, fy1 + 1.32, spec.cz + gz, frameDarkMat, false, false);
    boxAt(g1, 0.2, 2.35, 1.18, eastWallX - 0.04, fy1 + 1.32, spec.cz + gz, new THREE.MeshStandardMaterial({ color: 0x3b7a38, roughness: 0.88 }), false, false);
  });
  boxAt(g1, 0.56, 0.68, 3.2, spec.cx + 12.05, fy1 + 0.34, spec.cz - 4.8, M.oakDesk, true, true, 0.02);
  const l1EastTv = createCustomBoardScreen(screenReg, 480, 260, (g, w, h, t) => {
    g.fillStyle = '#111827';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0ea5e9';
    g.fillRect(14, 14, w - 28, h * 0.52);
    g.fillStyle = '#4c7c48';
    g.fillRect(14, h * 0.52, w - 28, h * 0.34);
    g.fillStyle = '#f8fafc';
    g.fillRect(60, 48, 175, 112);
    g.fillRect(260, 66, 130, 94);
    g.fillStyle = '#e07a5f';
    g.font = '700 15px sans-serif';
    g.fillText(`TERRACRAFT DEVELOPMENT PIPELINE · LIVE BIM ${Math.floor(t % 60)}`, 20, h - 18);
  });
  boxAt(g1, 0.08, 1.24, 2.18, spec.cx + 12.36, fy1 + 1.62, spec.cz - 4.8, frameDarkMat, false, false);
  const l1TvMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.04, 1.12), l1EastTv.mat);
  l1TvMesh.position.set(spec.cx + 12.3, fy1 + 1.62, spec.cz - 4.8);
  l1TvMesh.rotation.y = -Math.PI / 2;
  g1.add(l1TvMesh);
  l1EastTv.setMesh(l1TvMesh);
  shelfUnit(g1, spec.cx + 12.05, fy1, spec.cz - 2.35, 1.5, M);
  plant(g1, spec.cx + 11.75, fy1, spec.cz - 7.8, 1.15, 960, M, 'ficus');

  let l1MonIdx = 0;
  [
    { px: spec.cx + 8.9, role: 'Acquisitions Analyst · L1', zone: 'Acquisitions & Valuation Pod' },
    { px: spec.cx + 2.4, role: 'Urban Masterplanner · L1', zone: 'Masterplanning & Design Pod' },
  ].forEach(({ px, role, zone }) => {
    const pz = spec.cz - 5.3;
    makeDesk(g1, px, fy1, pz, 2.8, 1.36, M.oakDesk, pal.gunmetalSteel);
    boxAt(g1, 2.7, 0.28, 0.05, px, fy1 + 0.91, pz, M.dark, false, false);
    addPendantFixture(g1, px, fy1 + 2.68, ceilY1, pz, 2.5, pal, frameDarkMat);
    const seatZN = pz - 1.05;
    const seatZS = pz + 1.05;
    registerChair(1, px - 0.68, fy1, seatZN, 0, -1);
    registerMonitor(1, l1MonIdx++, [px - 0.68, fy1 + 0.77, pz - 0.25], Math.PI, px - 0.68, seatZN, role, zone);
    officeChair(g1, px + 0.68, fy1, seatZN, 0, M);
    monitor(g1, px + 0.68, fy1 + 0.77, pz - 0.25, true, Math.PI, M);
    officeChair(g1, px - 0.68, fy1, seatZS, Math.PI, M);
    monitor(g1, px - 0.68, fy1 + 0.77, pz + 0.25, true, 0, M);
    officeChair(g1, px + 0.68, fy1, seatZS, Math.PI, M);
    monitor(g1, px + 0.68, fy1 + 0.77, pz + 0.25, true, 0, M);
  });
  boxAt(g1, 3.2, 1.32, 0.16, spec.cx + 2.3, fy1 + 0.66, spec.cz - 2.85, pal.sageAcoustic, true, true, 0.02);
  plant(g1, spec.cx + 5.15, fy1, spec.cz - 4.1, 1.35, 961, M, 'ficus');
  plant(g1, spec.cx + 5.15, fy1, spec.cz - 2.5, 1.25, 962, M, 'ficus');
  plant(g1, spec.cx + 5.15, fy1, spec.cz - 0.9, 1.15, 963, M, 'monst');

  // Glass Studio BIM Pod
  boxAt(g1, 6.7, 2.15, 0.18, spec.cx + 9.0, fy1 + 1.075, spec.cz + 3.45, pal.sageAcoustic, true, true, 0.02);
  boxAt(g1, 0.06, 2.45, 1.2, spec.cx + 5.6, fy1 + 1.225, spec.cz - 1.1, pal.vitrineGlass, false, false);
  boxAt(g1, 0.06, 2.45, 2.4, spec.cx + 5.6, fy1 + 1.225, spec.cz + 2.25, pal.vitrineGlass, false, false);
  boxAt(g1, 0.12, 0.12, 5.2, spec.cx + 5.6, fy1 + 2.48, spec.cz + 0.85, archMats.bronzeMullion, true, false);
  boxAt(g1, 3.6, 2.45, 0.06, spec.cx + 10.6, fy1 + 1.225, spec.cz - 1.7, pal.vitrineGlass, false, false);
  boxAt(g1, 6.8, 0.12, 0.12, spec.cx + 9.0, fy1 + 2.48, spec.cz - 1.7, archMats.bronzeMullion, true, false);

  makeDesk(g1, spec.cx + 9.2, fy1, spec.cz + 1.6, 2.2, 1.2, M.oakDesk, pal.gunmetalSteel);
  boxAt(g1, 2.1, 0.28, 0.05, spec.cx + 9.2, fy1 + 0.91, spec.cz + 1.6, M.dark, false, false);
  registerChair(1, spec.cx + 8.55, fy1, spec.cz + 0.55, 0, 1);
  registerMonitor(1, l1MonIdx++, [spec.cx + 8.55, fy1 + 0.77, spec.cz + 1.35], Math.PI, spec.cx + 8.55, spec.cz + 0.55, 'BIM Project Architect · L1', 'Glass Studio Atelier');
  officeChair(g1, spec.cx + 9.85, fy1, spec.cz + 0.55, 0, M);
  monitor(g1, spec.cx + 9.85, fy1 + 0.77, spec.cz + 1.35, true, Math.PI, M);
  makeDesk(g1, spec.cx + 7.45, fy1, spec.cz - 0.55, 1.65, 0.78, M.oakDesk, pal.gunmetalSteel);
  officeChair(g1, spec.cx + 7.45, fy1, spec.cz - 1.28, 0, M);
  const stTeal = armchair(g1, spec.cx + 9.25, fy1, spec.cz - 0.45, Math.PI * 0.25, pal.tealLinen, M);
  stTeal.scale.set(0.76, 0.9, 0.76);
  const stMust = armchair(g1, spec.cx + 10.75, fy1, spec.cz - 0.45, -Math.PI * 0.25, pal.mustardBoucle, M);
  stMust.scale.set(0.76, 0.9, 0.76);
  cylAt(g1, 0.36, 0.36, 0.04, spec.cx + 10.0, fy1 + 0.44, spec.cz - 0.78, pal.honedTravertine, true, true, 18);
  cylAt(g1, 0.05, 0.09, 0.42, spec.cx + 10.0, fy1 + 0.21, spec.cz - 0.78, M.dark, false, true, 12);
  plant(g1, spec.cx + 6.35, fy1, spec.cz + 2.55, 0.95, 964, M, 'ficus');

  // L1 SE Managing Director Suite
  boxAt(g1, 0.16, 2.75, 3.25, spec.cx + 5.45, fy1 + 1.375, spec.cz + 7.0, archMats.stuccoWhite, true, true, 0.02);
  for (let sx = spec.cx + 5.75; sx <= spec.cx + 12.2; sx += 0.26) {
    boxAt(g1, 0.09, 2.85, 0.07, sx, fy1 + 1.425, spec.cz + 8.54, archMats.timberFin, false, false);
  }
  shelfUnit(g1, spec.cx + 6.95, fy1, spec.cz + 8.15, 1.55, M);
  shelfUnit(g1, spec.cx + 10.85, fy1, spec.cz + 8.15, 1.55, M);
  makeDesk(g1, spec.cx + 8.9, fy1, spec.cz + 5.75, 2.5, 1.05, pal.walnutExec, pal.gunmetalSteel);
  addPendantFixture(g1, spec.cx + 8.9, fy1 + 2.68, ceilY1, spec.cz + 5.75, 2.2, pal, frameDarkMat);
  registerChair(1, spec.cx + 8.9, fy1, spec.cz + 6.9, Math.PI, -1);
  registerMonitor(1, l1MonIdx++, [spec.cx + 8.9, fy1 + 0.77, spec.cz + 5.9], 0, spec.cx + 8.9, spec.cz + 6.9, 'Managing Director · L1', 'Executive Director Suite');
  boxAt(g1, 0.52, 0.72, 2.4, spec.cx + 12.08, fy1 + 0.36, spec.cz + 6.1, M.oakDesk, true, true, 0.02);
  boxAt(g1, 0.06, 1.05, 1.65, spec.cx + 12.36, fy1 + 1.68, spec.cz + 6.1, frameDarkMat, false, false);
  const execArt = new THREE.Mesh(new THREE.PlaneGeometry(1.52, 0.92), l1EastTv.mat);
  execArt.position.set(spec.cx + 12.32, fy1 + 1.68, spec.cz + 6.1);
  execArt.rotation.y = -Math.PI / 2;
  g1.add(execArt);
  plant(g1, spec.cx + 11.7, fy1, spec.cz + 4.35, 1.25, 965, M, 'ficus');

  // Center Collaborative Architectural Review Table (with rolled drawings & scale massing blocks)
  boxAt(g1, 3.9, 0.02, 2.6, spec.cx + 2.25, fy1 + 0.022, spec.cz + 0.65, pal.wovenTaupeRug, false, true);
  makeDesk(g1, spec.cx + 2.25, fy1, spec.cz + 0.65, 3.55, 1.12, M.oakDesk, pal.gunmetalSteel);
  boxAt(g1, 0.95, 0.02, 0.62, spec.cx + 2.25, fy1 + 0.775, spec.cz + 0.65, M.white, false, false);
  cylAt(g1, 0.04, 0.04, 0.58, spec.cx + 3.2, fy1 + 0.805, spec.cz + 0.72, pal.honedTravertine, false, false, 10).rotation.z = Math.PI / 2;
  boxAt(g1, 0.32, 0.24, 0.28, spec.cx + 1.15, fy1 + 0.89, spec.cz + 0.75, accentMat, false, false);
  registerChair(1, spec.cx + 2.25, fy1, spec.cz - 0.35, 0, -1);
  registerMonitor(1, l1MonIdx++, [spec.cx + 2.25, fy1 + 0.77, spec.cz + 0.45], Math.PI, spec.cx + 2.25, spec.cz - 0.35, 'Senior Development Lead · L1', 'Collaborative Review Table');
  [spec.cx + 0.85, spec.cx + 3.65].forEach((chx) => officeChair(g1, chx, fy1, spec.cz - 0.35, 0, M));
  [spec.cx + 0.85, spec.cx + 2.25, spec.cx + 3.65].forEach((chx) => officeChair(g1, chx, fy1, spec.cz + 1.65, Math.PI, M));
  boxAt(g1, 4.6, 2.05, 0.18, spec.cx + 2.25, fy1 + 1.025, spec.cz + 3.15, pal.sageAcoustic, true, true, 0.02);

  buildDualMeetingRooms(g1, fy1, 970, boothScreen.mat);

  // L1 Hospitality Lounge & Espresso Peninsula
  const l1LoungeX = spec.cx - 3.1;
  const l1LoungeZ = spec.cz + 0.85;
  boxAt(g1, 3.3, 0.02, 2.75, l1LoungeX, fy1 + 0.022, l1LoungeZ, pal.wovenTaupeRug, false, true);
  const l1CoralBack = sofaWide(g1, l1LoungeX + 0.65, fy1, l1LoungeZ + 0.68, Math.PI, pal.coralBoucle, M);
  l1CoralBack.scale.set(0.78, 0.92, 0.84);
  const l1CoralSide = sofaWide(g1, l1LoungeX + 1.62, fy1, l1LoungeZ - 0.15, -Math.PI / 2, pal.coralBoucle, M);
  l1CoralSide.scale.set(0.62, 0.92, 0.84);
  const l1TealClub = armchair(g1, l1LoungeX - 1.1, fy1, l1LoungeZ - 0.35, Math.PI * 0.4, pal.tealLinen, M);
  l1TealClub.scale.set(0.76, 0.9, 0.76);
  cylAt(g1, 0.56, 0.56, 0.045, l1LoungeX + 0.1, fy1 + 0.4, l1LoungeZ - 0.2, M.oakDesk, true, true, 22);
  cylAt(g1, 0.08, 0.14, 0.38, l1LoungeX + 0.1, fy1 + 0.19, l1LoungeZ - 0.2, M.dark, false, true, 12);

  cylAt(g1, 0.38, 0.38, 0.04, spec.cx - 3.0, fy1 + 0.46, spec.cz + 2.95, M.oakDesk, true, true, 18);
  cylAt(g1, 0.05, 0.09, 0.44, spec.cx - 3.0, fy1 + 0.22, spec.cz + 2.95, M.dark, false, true, 12);
  const l1GreenArm = armchair(g1, spec.cx - 3.88, fy1, spec.cz + 2.95, Math.PI / 2, pal.sageAcoustic, M);
  l1GreenArm.scale.set(0.72, 0.88, 0.72);
  const l1MustArm = armchair(g1, spec.cx - 2.12, fy1, spec.cz + 2.95, -Math.PI / 2, pal.mustardBoucle, M);
  l1MustArm.scale.set(0.72, 0.88, 0.72);

  const k1Cx = spec.cx - 8.5;
  boxAt(g1, 5.4, 0.92, 0.85, k1Cx, fy1 + 0.46, spec.cz + 8.15, pal.kitchenCab, true, true, 0.02);
  boxAt(g1, 5.46, 0.06, 0.9, k1Cx, fy1 + 0.94, spec.cz + 8.15, pal.honedTravertine, false, true, 0.01);
  boxAt(g1, 4.6, 0.08, 0.42, k1Cx, fy1 + 1.98, spec.cz + 8.35, M.oakDesk, true, false, 0.015);
  [-1.4, 0.0, 1.4].forEach((px, pi) => plant(g1, k1Cx + px, fy1 + 2.02, spec.cz + 8.32, 0.42, 980 + pi, M, 'fern'));
  boxAt(g1, 0.82, 0.52, 0.56, k1Cx - 1.5, fy1 + 1.23, spec.cz + 8.12, M.dark, true, false, 0.02);
  boxAt(g1, 2.2, 1.15, 0.06, k1Cx, fy1 + 2.45, spec.cz + 8.6, frameDarkMat, false, false);
  const k1Art = new THREE.Mesh(new THREE.PlaneGeometry(2.04, 1.0), new THREE.MeshStandardMaterial({ map: propGridTex, roughness: 0.55 }));
  k1Art.position.set(k1Cx, fy1 + 2.45, spec.cz + 8.56);
  k1Art.rotation.y = Math.PI;
  g1.add(k1Art);
  boxAt(g1, 0.95, 0.94, 3.6, spec.cx - 6.05, fy1 + 0.47, spec.cz + 6.05, archMats.timberFin, true, true, 0.02);
  boxAt(g1, 1.12, 0.07, 3.75, spec.cx - 6.05, fy1 + 0.975, spec.cz + 6.05, pal.honedTravertine, true, true, 0.02);
  [4.55, 5.3, 6.05, 6.8].forEach((szOff) => {
    const sx = spec.cx - 5.15;
    const sz = spec.cz + szOff;
    cylAt(g1, 0.21, 0.2, 0.06, sx, fy1 + 0.68, sz, M.walnut, true, true, 16);
    cylAt(g1, 0.035, 0.035, 0.66, sx, fy1 + 0.33, sz, M.dark, false, false, 10);
    cylAt(g1, 0.18, 0.22, 0.04, sx, fy1 + 0.02, sz, M.dark, false, true, 14);
  });
  const wc1 = armchair(g1, spec.cx - 11.1, fy1, spec.cz + 4.45, 0, M.fabricCognac, M);
  wc1.scale.set(0.76, 0.9, 0.76);
  const wc2 = armchair(g1, spec.cx - 11.1, fy1, spec.cz + 6.25, Math.PI, M.fabricCognac, M);
  wc2.scale.set(0.76, 0.9, 0.76);
  cylAt(g1, 0.36, 0.36, 0.04, spec.cx - 11.1, fy1 + 0.44, spec.cz + 5.35, pal.honedTravertine, true, true, 18);
  cylAt(g1, 0.05, 0.09, 0.42, spec.cx - 11.1, fy1 + 0.21, spec.cz + 5.35, pal.brushedBronze, false, true, 12);
  plant(g1, spec.cx - 8.45, fy1, spec.cz + 3.25, 1.35, 985, M, 'ficus');

  // ===========================================================================
  // LEVEL 2 (lv === 2): Material Atelier, VR Showcase & 3D Masterplans
  // ===========================================================================
  const g2 = levelGroups[2];
  const fy2 = spec.groundY + 2 * spec.floorH + SLAB_THICK * 0.5;
  const ceilY2 = spec.groundY + 3 * spec.floorH - 0.14;
  warmLights.push({
    x: spec.cx,
    y: fy2 + 3.1,
    z: spec.cz,
    color: 0xfff4e2,
    distance: 24,
    baseScale: 1.0,
    floor: 2,
    buildingId: spec.id,
  });

  boxAt(g2, 24.8, 0.018, 1.3, spec.cx + 0.1, fy2 + 0.009, spec.cz - 8.15, pal.chevronOak, false, true);
  boxAt(g2, 5.4, 0.018, 9.2, spec.cx - 1.8, fy2 + 0.01, spec.cz - 0.3, pal.chevronOak, false, true);
  boxAt(g2, 11.6, 0.02, 16.0, spec.cx + 6.6, fy2 + 0.014, spec.cz + 0.45, pal.slateCarpet, false, true);
  boxAt(g2, 7.8, 0.02, 6.1, spec.cx - 8.4, fy2 + 0.014, spec.cz - 4.4, pal.slateCarpet, false, true);
  boxAt(g2, 4.65, 0.02, 5.3, spec.cx - 6.825, fy2 + 0.014, spec.cz + 1.3, pal.slateCarpet, false, true);
  boxAt(g2, 13.0, 0.02, 4.4, spec.cx - 5.8, fy2 + 0.014, spec.cz + 6.3, pal.slateCarpet, false, true);

  [-5.6, -1.6, 2.2].forEach((dz) => {
    boxAt(g2, 0.08, 1.78, 3.3, spec.cx + 12.42, fy2 + 1.38, spec.cz + dz, frameDarkMat, false, false);
    const gm2 = new THREE.Mesh(
      new THREE.PlaneGeometry(3.15, 1.65),
      new THREE.MeshStandardMaterial({ map: propGridTex, emissive: 0xffffff, emissiveMap: propGridTex, emissiveIntensity: 0.22, roughness: 0.4 })
    );
    gm2.position.set(spec.cx + 12.37, fy2 + 1.38, spec.cz + dz);
    gm2.rotation.y = -Math.PI / 2;
    g2.add(gm2);
  });

  // Dual Immersive VR Property Experience Pods
  [-6.35, -4.15].forEach((vz) => {
    const vrPod = new THREE.Group();
    vrPod.position.set(spec.cx + 10.95, fy2, spec.cz + vz);
    vrPod.rotation.y = -Math.PI * 0.42;
    cylAt(vrPod, 0.78, 0.82, 0.07, 0, 0.035, 0, M.white, true, true, 24);
    cylAt(vrPod, 0.83, 0.83, 0.025, 0, 0.02, 0, pal.cyanBeaconLed, false, false, 24);
    cylAt(vrPod, 0.14, 0.18, 0.36, 0, 0.22, 0, M.dark, false, true, 14);
    const shellMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.56, 0.86, 20, 1, false, Math.PI * 0.38, Math.PI * 1.24), M.white);
    shellMesh.position.set(0, 0.78, 0);
    shellMesh.castShadow = true;
    vrPod.add(shellMesh);
    cylAt(vrPod, 0.48, 0.48, 0.12, 0, 0.42, 0.05, pal.vrDarkPad, true, true, 18);
    boxAt(vrPod, 0.76, 0.62, 0.14, 0, 0.76, -0.34, pal.vrDarkPad, false, false, 0.04);
    g2.add(vrPod);
  });

  // Angled Interactive Touchscreen Masterplan Kiosks
  [-6.4, -4.2].forEach((kz) => {
    const kGroup = new THREE.Group();
    kGroup.position.set(spec.cx + 7.25, fy2, spec.cz + kz);
    kGroup.rotation.y = -Math.PI * 0.28;
    boxAt(kGroup, 0.54, 0.06, 0.54, 0, 0.03, 0, M.white, true, true, 0.02);
    boxAt(kGroup, 0.28, 1.05, 0.24, 0, 0.55, 0, M.white, true, true, 0.02);
    const topPad = new THREE.Group();
    topPad.position.set(0, 1.08, 0);
    topPad.rotation.x = -0.52;
    boxAt(topPad, 0.92, 0.06, 0.68, 0, 0, 0, frameDarkMat, true, false, 0.015);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.6), kioskBoard.mat);
    scr.position.set(0, 0.035, 0);
    scr.rotation.x = -Math.PI / 2;
    topPad.add(scr);
    kGroup.add(topPad);
    g2.add(kGroup);
  });

  // Material Atelier Sample Racks (with physical 3D stone/timber sample boards!)
  boxAt(g2, 2.75, 0.72, 0.56, spec.cx + 9.4, fy2 + 0.36, spec.cz - 1.85, M.oakDesk, true, true, 0.02);
  boxAt(g2, 2.8, 1.55, 0.14, spec.cx + 9.4, fy2 + 1.5, spec.cz - 1.85, frameDarkMat, true, true, 0.02);
  [-1, 1].forEach((side) => {
    const rm = new THREE.Mesh(new THREE.PlaneGeometry(2.68, 1.42), pal.slabRackMat);
    rm.position.set(spec.cx + 9.4, fy2 + 1.5, spec.cz - 1.85 + side * 0.08);
    if (side < 0) rm.rotation.y = Math.PI;
    g2.add(rm);
  });
  boxAt(g2, 2.85, 2.38, 0.18, spec.cx + 9.4, fy2 + 1.19, spec.cz + 2.05, frameDarkMat, true, true, 0.02);
  [
    [-0.88, pal.honedTravertine],
    [0, woodCedarMat],
    [0.88, pal.darkSlateSlab],
  ].forEach(([ox, mat]) => {
    boxAt(g2, 0.8, 2.22, 0.22, spec.cx + 9.4 + (ox as number), fy2 + 1.18, spec.cz + 2.05, mat as THREE.Material, false, false);
  });

  let l2MonIdx = 0;
  makeDesk(g2, spec.cx + 9.5, fy2, spec.cz + 0.15, 1.75, 0.82, M.oakDesk, pal.gunmetalSteel);
  registerChair(2, spec.cx + 9.5, fy2, spec.cz - 0.62, 0, -1);
  registerMonitor(2, l2MonIdx++, [spec.cx + 9.5, fy2 + 0.77, spec.cz + 0.02], Math.PI, spec.cx + 9.5, spec.cz - 0.62, 'Bespoke Kitchen & Stone Advisor · L2', 'Material Slab Atelier');

  for (let sx = spec.cx + 5.75; sx <= spec.cx + 12.2; sx += 0.26) {
    boxAt(g2, 0.09, 2.85, 0.07, sx, fy2 + 1.425, spec.cz + 8.54, archMats.timberFin, false, false);
  }
  [spec.cx + 7.4, spec.cx + 8.9, spec.cx + 10.4].forEach((hx, hi) => {
    cylAt(g2, 0.012, 0.012, 0.75, hx, fy2 + 3.45, spec.cz + 7.9, M.dark, false, false, 6);
    plant(g2, hx, fy2 + 2.65, spec.cz + 7.9, 0.48, 990 + hi, M, 'fern');
  });

  const l2BackPodX = spec.cx + 8.9;
  const l2BackPodZ = spec.cz + 5.55;
  makeDesk(g2, l2BackPodX, fy2, l2BackPodZ, 2.8, 1.36, M.oakDesk, pal.gunmetalSteel);
  boxAt(g2, 2.7, 0.28, 0.05, l2BackPodX, fy2 + 0.91, l2BackPodZ, M.dark, false, false);
  addPendantFixture(g2, l2BackPodX, fy2 + 2.68, ceilY2, l2BackPodZ, 2.5, pal, frameDarkMat);
  registerChair(2, l2BackPodX - 0.68, fy2, l2BackPodZ - 1.05, 0, -1);
  registerMonitor(2, l2MonIdx++, [l2BackPodX - 0.68, fy2 + 0.77, l2BackPodZ - 0.25], Math.PI, l2BackPodX - 0.68, l2BackPodZ - 1.05, 'Lead Material Stylist · L2', 'Finish & Material Atelier');
  registerChair(2, l2BackPodX + 0.68, fy2, l2BackPodZ + 1.05, Math.PI, 1);
  registerMonitor(2, l2MonIdx++, [l2BackPodX + 0.68, fy2 + 0.77, l2BackPodZ + 0.25], 0, l2BackPodX + 0.68, l2BackPodZ + 1.05, 'Senior Interior Designer · L2', 'Finish & Material Atelier');
  officeChair(g2, l2BackPodX + 0.68, fy2, l2BackPodZ - 1.05, 0, M);
  monitor(g2, l2BackPodX + 0.68, fy2 + 0.77, l2BackPodZ - 0.25, true, Math.PI, M);
  officeChair(g2, l2BackPodX - 0.68, fy2, l2BackPodZ + 1.05, Math.PI, M);
  monitor(g2, l2BackPodX - 0.68, fy2 + 0.77, l2BackPodZ + 0.25, true, 0, M);
  plant(g2, spec.cx + 5.7, fy2, spec.cz + 6.95, 1.35, 994, M, 'ficus');

  // L2 High-Rise & Horizontal Villa 3D Masterplan Vitrines
  buildMasterplanVitrine(g2, spec.cx + 3.1, fy2, spec.cz - 5.55, 3.45, 2.15, 'towers', ctx, pal);

  boxAt(g2, 2.75, 0.02, 3.3, spec.cx + 3.2, fy2 + 0.02, spec.cz - 0.05, pal.wovenTaupeRug, false, true);
  boxAt(g2, 3.05, 1.15, 0.18, spec.cx + 3.2, fy2 + 0.575, spec.cz - 2.25, pal.sageAcoustic, true, true, 0.02);
  boxAt(g2, 2.85, 0.72, 0.56, spec.cx + 3.2, fy2 + 0.36, spec.cz - 2.65, M.oakDesk, true, true, 0.02);
  const angledRack = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.78, 0.06), pal.slabRackMat);
  angledRack.position.set(spec.cx + 3.2, fy2 + 0.88, spec.cz - 2.62);
  angledRack.rotation.x = 0.25;
  g2.add(angledRack);
  boxAt(g2, 3.1, 2.05, 0.18, spec.cx + 3.2, fy2 + 1.025, spec.cz + 2.2, pal.sageAcoustic, true, true, 0.02);
  boxAt(g2, 1.88, 1.04, 0.06, spec.cx + 3.2, fy2 + 1.38, spec.cz + 2.09, frameDarkMat, false, false);
  const l2LoungeTv = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.94), boothScreen.mat);
  l2LoungeTv.position.set(spec.cx + 3.2, fy2 + 1.38, spec.cz + 2.05);
  l2LoungeTv.rotation.y = Math.PI;
  g2.add(l2LoungeTv);
  const l2Coral = sofaWide(g2, spec.cx + 4.15, fy2, spec.cz - 0.1, -Math.PI / 2, pal.coralBoucle, M);
  l2Coral.scale.set(0.76, 0.94, 0.85);
  const l2Teal = armchair(g2, spec.cx + 2.75, fy2, spec.cz - 1.2, 0, pal.tealLinen, M);
  l2Teal.scale.set(0.76, 0.9, 0.76);
  const l2Must = armchair(g2, spec.cx + 2.75, fy2, spec.cz + 1.05, Math.PI, pal.mustardBoucle, M);
  l2Must.scale.set(0.76, 0.9, 0.76);
  boxAt(g2, 0.78, 0.38, 1.12, spec.cx + 2.85, fy2 + 0.19, spec.cz - 0.1, M.oakDesk, true, true, 0.03);
  plant(g2, spec.cx + 5.75, fy2, spec.cz - 1.15, 1.55, 995, M, 'ficus');

  const m2RightX = spec.cx - 2.3;
  buildMasterplanVitrine(g2, m2RightX, fy2, spec.cz - 0.85, 3.55, 2.2, 'villas', ctx, pal);
  makeDesk(g2, m2RightX, fy2, spec.cz - 3.05, 1.75, 0.78, M.oakDesk, pal.gunmetalSteel);
  registerChair(2, m2RightX, fy2, spec.cz - 3.85, 0, -1);
  registerMonitor(2, l2MonIdx++, [m2RightX, fy2 + 0.77, spec.cz - 3.2], Math.PI, m2RightX, spec.cz - 3.85, 'Showroom Model Specialist · L2', '3D Masterplan Gallery');

  const b2X = spec.cx - 7.6;
  const b2Z = spec.cz - 5.45;
  boxAt(g2, 5.4, 2.05, 0.18, b2X, fy2 + 1.025, b2Z + 1.75, pal.sageAcoustic, true, true, 0.02);
  boxAt(g2, 2.1, 1.15, 0.08, b2X, fy2 + 1.4, b2Z + 1.64, frameDarkMat, false, false);
  const b2Tv = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.02), boothScreen.mat);
  b2Tv.position.set(b2X, fy2 + 1.4, b2Z + 1.59);
  b2Tv.rotation.y = Math.PI;
  g2.add(b2Tv);
  const b2Must = sofaWide(g2, b2X - 1.75, fy2, b2Z, Math.PI / 2, pal.mustardBoucle, M);
  b2Must.scale.set(0.72, 0.94, 0.85);
  const b2Teal = sofaWide(g2, b2X + 1.75, fy2, b2Z, -Math.PI / 2, pal.tealLinen, M);
  b2Teal.scale.set(0.72, 0.94, 0.85);
  cylAt(g2, 0.54, 0.54, 0.05, b2X, fy2 + 0.42, b2Z, M.walnut, true, true, 22);
  cylAt(g2, 0.08, 0.14, 0.4, b2X, fy2 + 0.2, b2Z, M.dark, false, true, 14);
  boxAt(g2, 0.62, 0.92, 1.45, spec.cx - 4.7, fy2 + 0.46, b2Z, M.walnut, true, true, 0.02);
  boxAt(g2, 0.1, 0.88, 1.18, spec.cx - 4.38, fy2 + 1.32, b2Z, frameDarkMat, true, false, 0.02);
  const b2Kiosk = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.78), kioskBoard.mat);
  b2Kiosk.position.set(spec.cx - 4.32, fy2 + 1.32, b2Z);
  b2Kiosk.rotation.y = Math.PI / 2;
  g2.add(b2Kiosk);
  plant(g2, spec.cx - 4.65, fy2, b2Z + 1.78, 0.95, 996, M, 'olive');

  buildDualMeetingRooms(g2, fy2, 997, boothScreen.mat);

  const bar2Cx = spec.cx - 8.5;
  boxAt(g2, 5.2, 0.92, 0.85, bar2Cx, fy2 + 0.46, spec.cz + 8.15, pal.kitchenCab, true, true, 0.02);
  boxAt(g2, 5.26, 0.06, 0.9, bar2Cx, fy2 + 0.94, spec.cz + 8.15, pal.honedTravertine, false, true, 0.01);
  boxAt(g2, 0.96, 2.35, 0.85, spec.cx - 5.3, fy2 + 1.175, spec.cz + 8.15, M.chrome, true, true, 0.03);
  boxAt(g2, 0.82, 0.52, 0.56, bar2Cx - 0.8, fy2 + 1.23, spec.cz + 8.12, M.dark, true, false, 0.02);
  boxAt(g2, 3.3, 0.94, 0.92, bar2Cx, fy2 + 0.47, spec.cz + 5.55, pal.kitchenCab, true, true, 0.02);
  boxAt(g2, 3.48, 0.07, 1.08, bar2Cx, fy2 + 0.975, spec.cz + 5.55, pal.honedTravertine, true, true, 0.02);
  [-1.0, -0.32, 0.32, 1.0].forEach((sx) => {
    const stoolX = bar2Cx + sx * 1.1;
    const stoolZ = spec.cz + 4.65;
    cylAt(g2, 0.21, 0.2, 0.06, stoolX, fy2 + 0.68, stoolZ, M.walnut, true, true, 16);
    cylAt(g2, 0.035, 0.035, 0.66, stoolX, fy2 + 0.33, stoolZ, M.dark, false, false, 10);
    cylAt(g2, 0.18, 0.22, 0.04, stoolX, fy2 + 0.02, stoolZ, M.dark, false, true, 14);
  });
  const w2Grn = armchair(g2, spec.cx - 3.55, fy2, spec.cz + 2.1, Math.PI * 0.25, pal.sageAcoustic, M);
  w2Grn.scale.set(0.74, 0.88, 0.74);
  const w2Must = armchair(g2, spec.cx - 2.15, fy2, spec.cz + 2.1, -Math.PI * 0.25, pal.mustardBoucle, M);
  w2Must.scale.set(0.74, 0.88, 0.74);
  cylAt(g2, 0.36, 0.36, 0.04, spec.cx - 2.85, fy2 + 0.44, spec.cz + 2.45, M.oakDesk, true, true, 18);
  plant(g2, spec.cx - 4.7, fy2, spec.cz + 2.45, 1.45, 999, M, 'ficus');

  // ===========================================================================
  // LEVEL 3 (lv === 3): Executive Advisory, Material Slabs & Twin Boardrooms
  // ===========================================================================
  const g3 = levelGroups[3];
  const fy3 = spec.groundY + 3 * spec.floorH + SLAB_THICK * 0.5;
  const ceilY3 = spec.groundY + 4 * spec.floorH - 0.14;
  warmLights.push({
    x: spec.cx,
    y: fy3 + 3.1,
    z: spec.cz,
    color: 0xfff4e2,
    distance: 24,
    baseScale: 1.0,
    floor: 3,
    buildingId: spec.id,
  });

  boxAt(g3, 24.4, 0.018, 7.05, spec.cx, fy3 + 0.009, spec.cz - 4.875, pal.chevronOak, false, true);
  boxAt(g3, 21.35, 0.018, 5.6, spec.cx + 1.525, fy3 + 0.009, spec.cz + 1.45, pal.chevronOak, false, true);
  boxAt(g3, 24.4, 0.018, 4.7, spec.cx, fy3 + 0.009, spec.cz + 6.2, pal.chevronOak, false, true);
  boxAt(g3, 4.8, 0.02, 4.8, spec.cx + 9.1, fy3 + 0.014, spec.cz - 4.8, pal.slateCarpet, false, true);
  boxAt(g3, 3.6, 0.02, 3.4, spec.cx + 3.3, fy3 + 0.014, spec.cz - 4.4, pal.wovenTaupeRug, false, true);
  boxAt(g3, 3.4, 0.02, 3.1, spec.cx - 1.1, fy3 + 0.014, spec.cz - 4.2, pal.wovenTaupeRug, false, true);

  const eastW3X = spec.cx + 12.42;
  boxAt(g3, 0.14, 3.25, 9.6, eastW3X, fy3 + 1.625, spec.cz - 3.6, archMats.timberFin, true, true);
  [-7.55, -1.65].forEach((gz) => {
    boxAt(g3, 0.18, 3.15, 1.18, eastW3X - 0.04, fy3 + 1.58, spec.cz + gz, frameDarkMat, false, false);
    boxAt(g3, 0.22, 2.98, 1.02, eastW3X - 0.08, fy3 + 1.58, spec.cz + gz, new THREE.MeshStandardMaterial({ color: 0x3b7a38, roughness: 0.88 }), false, false);
  });
  const l3VillaScreen = createCustomBoardScreen(screenReg, 512, 280, (g, w, h, t) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.58);
    sky.addColorStop(0, '#385d8a');
    sky.addColorStop(1, '#b8d4ea');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#4e7346';
    g.fillRect(0, h * 0.58, w, h * 0.42);
    g.fillStyle = '#f5f0e4';
    g.fillRect(82, 84, 240, 108);
    g.fillStyle = '#473628';
    g.fillRect(68, 76, 268, 12);
    g.fillStyle = '#7dd3fc';
    g.fillRect(104, 102, 86, 82);
    g.fillStyle = '#0ea5e9';
    g.fillRect(110, h * 0.72, 210, 22);
    g.fillStyle = 'rgba(15,23,42,0.86)';
    g.fillRect(0, h - 42, w, 42);
    g.fillStyle = '#e07a5f';
    g.fillRect(0, h - 42, 7, 42);
    g.fillStyle = '#ffffff';
    g.font = '700 15px sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(`TERRACRAFT EXECUTIVE PORTFOLIO · PHASE ${Math.floor(t / 6) % 2 === 0 ? 'III' : 'IV'}`, 18, h - 21);
  });
  boxAt(g3, 0.08, 1.85, 3.35, eastW3X - 0.08, fy3 + 1.72, spec.cz - 4.6, frameDarkMat, false, false);
  const l3ArtMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.18, 1.7), l3VillaScreen.mat);
  l3ArtMesh.position.set(eastW3X - 0.13, fy3 + 1.72, spec.cz - 4.6);
  l3ArtMesh.rotation.y = -Math.PI / 2;
  g3.add(l3ArtMesh);
  l3VillaScreen.setMesh(l3ArtMesh);
  plant(g3, spec.cx + 11.45, fy3, spec.cz - 7.75, 1.2, 1001, M, 'ficus');

  let l3MonIdx = 0;
  const l3PodX = spec.cx + 9.1;
  const l3PodZ = spec.cz - 4.8;
  makeDesk(g3, l3PodX, fy3, l3PodZ, 2.8, 1.36, M.oakDesk, pal.gunmetalSteel);
  boxAt(g3, 2.7, 0.28, 0.05, l3PodX, fy3 + 0.91, l3PodZ, M.dark, false, false);
  addPendantFixture(g3, l3PodX, fy3 + 2.68, ceilY3, l3PodZ, 2.5, pal, frameDarkMat);
  registerChair(3, l3PodX - 0.68, fy3, l3PodZ - 1.05, 0, -1);
  registerMonitor(3, l3MonIdx++, [l3PodX - 0.68, fy3 + 0.77, l3PodZ - 0.25], Math.PI, l3PodX - 0.68, l3PodZ - 1.05, 'Senior Acquisitions Manager · L3', 'Real Estate Investment Studio');
  registerChair(3, l3PodX + 0.68, fy3, l3PodZ + 1.05, Math.PI, 1);
  registerMonitor(3, l3MonIdx++, [l3PodX + 0.68, fy3 + 0.77, l3PodZ + 0.25], 0, l3PodX + 0.68, l3PodZ + 1.05, 'Development Finance Lead · L3', 'Real Estate Investment Studio');
  officeChair(g3, l3PodX + 0.68, fy3, l3PodZ - 1.05, 0, M);
  monitor(g3, l3PodX + 0.68, fy3 + 0.77, l3PodZ - 0.25, true, Math.PI, M);
  officeChair(g3, l3PodX - 0.68, fy3, l3PodZ + 1.05, Math.PI, M);
  monitor(g3, l3PodX - 0.68, fy3 + 0.77, l3PodZ + 0.25, true, 0, M);

  // SE Managing Partner Closing Suite
  boxAt(g3, 0.16, 2.9, 3.35, spec.cx + 7.1, fy3 + 1.45, spec.cz + 6.85, archMats.stuccoWhite, true, true, 0.02);
  boxAt(g3, 0.18, 2.9, 0.14, spec.cx + 7.1, fy3 + 1.45, spec.cz + 5.15, M.oakDesk, true, false);
  boxAt(g3, 0.18, 2.9, 0.14, spec.cx + 7.1, fy3 + 1.45, spec.cz + 3.85, M.oakDesk, true, false);
  boxAt(g3, 0.18, 0.14, 1.44, spec.cx + 7.1, fy3 + 2.85, spec.cz + 4.5, M.oakDesk, false, false);
  const execBackZ = spec.cz + 8.42;
  boxAt(g3, 1.65, 2.85, 0.16, spec.cx + 9.7, fy3 + 1.425, execBackZ + 0.06, pal.flutedTravertine, true, true);
  [spec.cx + 8.15, spec.cx + 11.25].forEach((bx) => {
    boxAt(g3, 1.35, 2.85, 0.44, bx, fy3 + 1.425, execBackZ - 0.08, M.oakDesk, true, true, 0.02);
    [0.65, 1.32, 1.98, 2.55].forEach((sy) => {
      boxAt(g3, 1.22, 0.04, 0.36, bx, fy3 + sy, execBackZ - 0.08, M.walnut, false, false);
      boxAt(g3, 1.15, 0.025, 0.04, bx, fy3 + sy + 0.34, execBackZ - 0.2, pal.warmCoveLed, false, false);
    });
  });
  makeDesk(g3, spec.cx + 9.7, fy3, spec.cz + 6.0, 2.5, 1.05, pal.walnutExec, pal.gunmetalSteel);
  addPendantFixture(g3, spec.cx + 9.7, fy3 + 2.68, ceilY3, spec.cz + 6.0, 2.2, pal, frameDarkMat);
  registerChair(3, spec.cx + 9.7, fy3, spec.cz + 6.95, Math.PI, -1);
  registerMonitor(3, l3MonIdx++, [spec.cx + 9.7, fy3 + 0.77, spec.cz + 6.12], 0, spec.cx + 9.7, spec.cz + 6.95, 'Managing Partner · L3', 'Executive Closing Suite');
  const execVis1 = armchair(g3, spec.cx + 8.9, fy3, spec.cz + 4.78, 0, pal.sageAcoustic, M);
  execVis1.scale.set(0.76, 0.9, 0.76);
  const execVis2 = armchair(g3, spec.cx + 10.5, fy3, spec.cz + 4.78, 0, pal.sageAcoustic, M);
  execVis2.scale.set(0.76, 0.9, 0.76);
  plant(g3, spec.cx + 11.75, fy3, spec.cz + 4.25, 1.2, 1002, M, 'ficus');

  // Book-matched Marble, Oak & Stone Feature Partition
  const slabWallX = spec.cx + 3.4;
  const slabWallZ = spec.cz + 1.15;
  boxAt(g3, 3.66, 2.86, 0.22, slabWallX, fy3 + 1.43, slabWallZ, frameDarkMat, true, true, 0.02);
  boxAt(g3, 1.14, 2.7, 0.26, slabWallX + 1.18, fy3 + 1.43, slabWallZ, pal.honedTravertine, false, true, 0.01);
  boxAt(g3, 1.14, 2.7, 0.26, slabWallX, fy3 + 1.43, slabWallZ, woodCedarMat, false, true, 0.01);
  boxAt(g3, 1.14, 1.32, 0.26, slabWallX - 1.18, fy3 + 2.1, slabWallZ, pal.flutedTravertine, false, true, 0.01);
  boxAt(g3, 1.14, 1.32, 0.26, slabWallX - 1.18, fy3 + 0.74, slabWallZ, pal.darkSlateSlab, false, true, 0.01);
  plant(g3, slabWallX + 2.18, fy3, slabWallZ + 0.1, 1.25, 1003, M, 'ficus');
  plant(g3, slabWallX - 2.18, fy3, slabWallZ + 0.1, 1.1, 1004, M, 'monst');

  const l3ClubX = spec.cx + 3.3;
  const l3ClubZ = spec.cz - 4.4;
  cylAt(g3, 0.52, 0.52, 0.04, l3ClubX, fy3 + 0.42, l3ClubZ, pal.honedTravertine, true, true, 22);
  cylAt(g3, 0.08, 0.14, 0.4, l3ClubX, fy3 + 0.2, l3ClubZ, M.dark, false, true, 14);
  [
    [-1.05, -0.88, Math.PI * 0.24],
    [1.05, -0.88, -Math.PI * 0.24],
    [-1.05, 0.88, Math.PI * 0.76],
    [1.05, 0.88, -Math.PI * 0.76],
  ].forEach(([ox, oz, rot]) => {
    const ch = armchair(g3, l3ClubX + ox, fy3, l3ClubZ + oz, rot, M.fabricCognac, M);
    ch.scale.set(0.75, 0.88, 0.75);
  });

  // L3 Twin Executive Boardrooms
  [
    { mx: spec.cx + 4.0, w: 5.2, rectangular: true },
    { mx: spec.cx - 1.5, w: 5.5, rectangular: false },
  ].forEach((br, bi) => {
    const mz = spec.cz + 6.4;
    const frontZ = spec.cz + 4.2;
    const halfW = br.w * 0.5;
    const glassPaneW = (br.w - 1.5) * 0.5;
    boxAt(g3, glassPaneW, 2.75, 0.06, br.mx - halfW + glassPaneW * 0.5, fy3 + 1.375, frontZ, pal.vitrineGlass, false, false);
    boxAt(g3, glassPaneW, 2.75, 0.06, br.mx + halfW - glassPaneW * 0.5, fy3 + 1.375, frontZ, pal.vitrineGlass, false, false);
    boxAt(g3, br.w, 0.14, 0.14, br.mx, fy3 + 2.75, frontZ, M.oakDesk, false, false);
    boxAt(g3, br.w, 0.06, 0.12, br.mx, fy3 + 0.04, frontZ, archMats.bronzeMullion, false, false);
    boxAt(g3, 0.14, 2.78, 4.4, br.mx - halfW, fy3 + 1.39, mz, M.oakDesk, true, false);
    if (bi === 0) boxAt(g3, 0.14, 2.78, 4.4, br.mx + halfW, fy3 + 1.39, mz, M.oakDesk, true, false);
    for (let sx = br.mx - halfW + 0.3; sx <= br.mx + halfW - 0.3; sx += 0.24) {
      boxAt(g3, 0.07, 2.75, 0.06, sx, fy3 + 1.375, spec.cz + 8.56, archMats.timberFin, false, false);
    }
    boxAt(g3, 2.35, 1.32, 0.08, br.mx, fy3 + 1.72, spec.cz + 8.48, frameDarkMat, false, false);
    const brTv = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.18), bi === 0 ? boothScreen.mat : l3VillaScreen.mat);
    brTv.position.set(br.mx, fy3 + 1.72, spec.cz + 8.42);
    brTv.rotation.y = Math.PI;
    g3.add(brTv);
    if (br.rectangular) {
      makeDesk(g3, br.mx, fy3, mz, 3.1, 1.15, M.oakDesk, pal.gunmetalSteel);
      [-1.05, 0, 1.05].forEach((ox) => {
        officeChair(g3, br.mx + ox, fy3, mz - 0.92, 0, M);
        officeChair(g3, br.mx + ox, fy3, mz + 0.92, Math.PI, M);
      });
    } else {
      cylAt(g3, 1.0, 1.0, 0.055, br.mx, fy3 + 0.74, mz, M.walnut, true, true, 24);
      cylAt(g3, 0.16, 0.22, 0.72, br.mx, fy3 + 0.36, mz, M.dark, true, true, 14);
      [
        [-1.2, 0, Math.PI / 2],
        [1.2, 0, -Math.PI / 2],
        [0, -1.2, 0],
        [0, 1.2, Math.PI],
      ].forEach(([cxo, czo, crot]) => officeChair(g3, br.mx + cxo, fy3, mz + czo, crot, M));
    }
    plant(g3, br.mx - halfW + 0.45, fy3, spec.cz + 4.85, 0.78, 1010 + bi, M, 'olive');
  });
  boxAt(g3, 0.68, 0.72, 0.68, spec.cx + 1.25, fy3 + 0.36, spec.cz + 3.65, M.oakDesk, true, true, 0.02);
  plant(g3, spec.cx + 1.25, fy3 + 0.7, spec.cz + 3.65, 0.82, 1014, M, 'ficus');

  const l3Coral = sofaWide(g3, spec.cx - 0.15, fy3, spec.cz - 4.2, -Math.PI / 2, pal.coralBoucle, M);
  l3Coral.scale.set(0.78, 0.94, 0.86);
  const l3Teal1 = armchair(g3, spec.cx - 2.05, fy3, spec.cz - 4.95, Math.PI * 0.28, pal.tealLinen, M);
  l3Teal1.scale.set(0.75, 0.88, 0.75);
  const l3Teal2 = armchair(g3, spec.cx - 2.05, fy3, spec.cz - 3.45, Math.PI * 0.72, pal.tealLinen, M);
  l3Teal2.scale.set(0.75, 0.88, 0.75);
  boxAt(g3, 0.82, 0.38, 1.18, spec.cx - 1.2, fy3 + 0.19, spec.cz - 4.2, M.oakDesk, true, true, 0.03);

  const ovalX = spec.cx - 5.9;
  const ovalZ = spec.cz - 4.6;
  cylAt(g3, 1.05, 1.05, 0.055, ovalX, fy3 + 0.74, ovalZ, M.oakDesk, true, true, 26);
  cylAt(g3, 0.18, 0.24, 0.72, ovalX, fy3 + 0.36, ovalZ, M.oakDesk, true, true, 16);
  registerChair(3, ovalX, fy3, ovalZ + 1.22, Math.PI, 1);
  registerMonitor(3, l3MonIdx++, [ovalX, fy3 + 0.77, ovalZ + 0.35], 0, ovalX, ovalZ + 1.22, 'Project Legal Counsel · L3', 'Advisory & Deal Table');
  [
    [-1.25, 0, Math.PI / 2],
    [1.25, 0, -Math.PI / 2],
    [0, -1.25, 0],
  ].forEach(([cxo, czo, crot]) => officeChair(g3, ovalX + cxo, fy3, ovalZ + czo, crot, M));
  plant(g3, spec.cx - 11.1, fy3, spec.cz - 6.8, 1.3, 1018, M, 'olive');

  const sw3X = spec.cx - 8.5;
  boxAt(g3, 5.2, 0.92, 0.85, sw3X, fy3 + 0.46, spec.cz + 8.1, pal.kitchenCab, true, true, 0.02);
  boxAt(g3, 5.26, 0.06, 0.9, sw3X, fy3 + 0.94, spec.cz + 8.1, pal.honedTravertine, false, true, 0.01);
  boxAt(g3, 4.4, 0.08, 0.42, sw3X, fy3 + 1.98, spec.cz + 8.32, M.oakDesk, true, false, 0.015);
  boxAt(g3, 0.82, 0.52, 0.56, sw3X - 1.4, fy3 + 1.23, spec.cz + 8.08, M.dark, true, false, 0.02);
  makeDesk(g3, sw3X, fy3, spec.cz + 5.85, 2.4, 0.96, M.oakDesk, pal.gunmetalSteel);
  plant(g3, spec.cx - 5.2, fy3, spec.cz + 4.95, 1.2, 1019, M, 'ficus');

  // ===========================================================================
  // LEVEL 4 (lv === 4): Executive Boardroom, CEO Penthouse & Head Offices
  // ===========================================================================
  const g4 = levelGroups[4];
  const fy4 = spec.groundY + 4 * spec.floorH + SLAB_THICK * 0.5;
  const ceilY4 = spec.groundY + 5 * spec.floorH - 0.14;
  warmLights.push({
    x: spec.cx,
    y: fy4 + 3.15,
    z: spec.cz,
    color: 0xfff2dc,
    distance: 25,
    baseScale: 1.07,
    floor: 4,
    buildingId: spec.id,
  });

  boxAt(g4, 24.4, 0.018, 7.05, spec.cx, fy4 + 0.009, spec.cz - 4.875, pal.chevronOak, false, true);
  boxAt(g4, 21.35, 0.018, 5.6, spec.cx + 1.525, fy4 + 0.009, spec.cz + 1.45, pal.chevronOak, false, true);
  boxAt(g4, 24.4, 0.018, 4.7, spec.cx, fy4 + 0.009, spec.cz + 6.2, pal.chevronOak, false, true);
  boxAt(g4, 6.4, 0.02, 10.6, spec.cx + 7.4, fy4 + 0.014, spec.cz + 0.2, pal.woolCharcoalRug, false, true);
  boxAt(g4, 5.4, 0.02, 4.4, spec.cx - 1.15, fy4 + 0.014, spec.cz + 5.4, pal.wovenTaupeRug, false, true);
  boxAt(g4, 3.6, 0.02, 3.2, spec.cx - 0.85, fy4 + 0.014, spec.cz - 1.6, pal.wovenTaupeRug, false, true);
  boxAt(g4, 4.6, 0.02, 3.3, spec.cx - 8.5, fy4 + 0.014, spec.cz + 6.1, pal.slateCarpet, false, true);
  boxAt(g4, 4.8, 0.02, 3.5, spec.cx - 8.7, fy4 + 0.014, spec.cz - 5.8, pal.slateCarpet, false, true);

  let l4MonIdx = 0;

  // Grand 12-Seat Executive Boardroom
  const brGlassX = spec.cx + 2.5;
  boxAt(g4, 0.08, 2.95, 4.2, brGlassX, fy4 + 1.475, spec.cz - 4.3, pal.vitrineGlass, false, false);
  boxAt(g4, 0.08, 2.95, 8.9, brGlassX, fy4 + 1.475, spec.cz + 4.05, pal.vitrineGlass, false, false);
  boxAt(g4, 0.14, 0.14, 15.0, brGlassX, fy4 + 2.95, spec.cz + 1.0, pal.walnutExec, true, false);
  boxAt(g4, 0.12, 0.06, 15.0, brGlassX, fy4 + 0.03, spec.cz + 1.0, archMats.bronzeMullion, false, false);
  [-6.4, -2.2, -0.4, 2.2, 5.4, 8.5].forEach((mz) => {
    boxAt(g4, 0.14, 2.96, 0.14, brGlassX, fy4 + 1.48, spec.cz + mz, pal.walnutExec, true, false);
  });
  addRealEstatePlaque(g4, 'EXECUTIVE BOARDROOM', brGlassX - 0.1, fy4 + 2.66, spec.cz - 1.3, -Math.PI / 2);

  const brCenterX = spec.cx + 7.4;
  for (let sx = spec.cx + 3.0; sx <= spec.cx + 12.1; sx += 0.24) {
    boxAt(g4, 0.08, 3.05, 0.07, sx, fy4 + 1.525, spec.cz + 8.52, archMats.timberFin, false, false);
  }
  boxAt(g4, 5.4, 0.82, 0.62, brCenterX, fy4 + 0.41, spec.cz + 8.02, pal.walnutExec, true, true, 0.02);
  boxAt(g4, 5.46, 0.05, 0.66, brCenterX, fy4 + 0.84, spec.cz + 8.02, pal.honedTravertine, false, true, 0.01);

  const l4BoardScreen = createCustomBoardScreen(screenReg, 640, 320, (g, w, h, t) => {
    g.fillStyle = '#0b121e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#182436';
    g.fillRect(0, 0, w, 46);
    g.fillStyle = '#d4aa62';
    g.fillRect(0, 0, 10, 46);
    g.fillStyle = '#ffffff';
    g.font = '800 18px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('TERRACRAFT HOLDINGS · BOARD OF DIRECTORS BRIEFING', 24, 23);

    [
      { lbl: 'AUM PORTFOLIO', val: 'KES 48.6B', sub: '+14.2% YoY', col: '#6fe3a1' },
      { lbl: 'NET IRR TARGET', val: '22.8%', sub: 'Q4 Approved', col: '#38bdf8' },
      { lbl: 'ACTIVE TOWERS', val: '9 Sites', sub: 'Nairobi & Coast', col: '#f59e0b' },
    ].forEach((m, mi) => {
      const x = 24 + mi * 200;
      g.fillStyle = '#131d2d';
      rr(g, x, 64, 186, 86, 8);
      g.fill();
      g.fillStyle = '#94a3b8';
      g.font = '600 12px sans-serif';
      g.fillText(m.lbl, x + 14, 84);
      g.fillStyle = '#ffffff';
      g.font = '800 24px "Plus Jakarta Sans", sans-serif';
      g.fillText(m.val, x + 14, 112);
      g.fillStyle = m.col;
      g.font = '700 12px sans-serif';
      g.fillText(m.sub, x + 14, 136);
    });

    g.fillStyle = '#131d2d';
    rr(g, 24, 166, w - 48, 132, 8);
    g.fill();
    const bars = [0.64, 0.82, 0.74, 0.94, 0.68, 0.88];
    const labels = ['KAREN', 'WESTLANDS', 'KILIMANI', 'UPPER HILL', 'RUNDA', 'DIANI'];
    const pulse = 0.04 * Math.sin(t * 1.4);
    bars.forEach((b, bi) => {
      const bx = 48 + bi * 92;
      const bh = Math.round((b + (bi % 2 === 0 ? pulse : -pulse)) * 78);
      g.fillStyle = bi === 3 ? '#d4aa62' : '#3b82f6';
      rr(g, bx, 268 - bh, 52, bh, 4);
      g.fill();
      g.fillStyle = '#cbd5e1';
      g.font = '600 11px sans-serif';
      g.textAlign = 'center';
      g.fillText(labels[bi], bx + 26, 284);
    });
  });
  boxAt(g4, 4.3, 2.05, 0.09, brCenterX, fy4 + 1.98, spec.cz + 8.42, frameDarkMat, false, false);
  const l4BoardTv = new THREE.Mesh(new THREE.PlaneGeometry(4.12, 1.9), l4BoardScreen.mat);
  l4BoardTv.position.set(brCenterX, fy4 + 1.98, spec.cz + 8.36);
  l4BoardTv.rotation.y = Math.PI;
  g4.add(l4BoardTv);
  l4BoardScreen.setMesh(l4BoardTv);

  const brTableZ = spec.cz + 0.2;
  boxAt(g4, 2.9, 0.08, 7.0, brCenterX, fy4 + 0.74, brTableZ, pal.walnutExec, true, true, 0.04);
  boxAt(g4, 0.28, 0.014, 5.8, brCenterX, fy4 + 0.785, brTableZ, M.brass, false, false, 0.005);
  [-2.0, 2.0].forEach((pz) => {
    cylAt(g4, 0.42, 0.56, 0.7, brCenterX, fy4 + 0.35, brTableZ + pz, archMats.bronzeMullion, true, true, 18);
  });
  [-1.7, 1.7].forEach((pz) => {
    boxAt(g4, 1.35, 0.055, 2.4, brCenterX, fy4 + 2.75, brTableZ + pz, pal.brushedBronze, false, false);
    boxAt(g4, 1.22, 0.025, 2.28, brCenterX, fy4 + 2.71, brTableZ + pz, pal.warmCoveLed, false, false);
    [
      [-0.55, -1.0],
      [0.55, -1.0],
      [-0.55, 1.0],
      [0.55, 1.0],
    ].forEach(([rx, rz]) => {
      cylAt(g4, 0.01, 0.01, ceilY4 - (fy4 + 2.75), brCenterX + rx, (ceilY4 + fy4 + 2.75) * 0.5, brTableZ + pz + rz, M.dark, false, false, 6);
    });
  });

  registerChair(4, brCenterX, fy4, brTableZ - 4.05, 0, 1);
  registerMonitor(4, l4MonIdx++, [brCenterX, fy4 + 0.785, brTableZ - 3.05], Math.PI, brCenterX, brTableZ - 4.05, 'Board Chairperson · L4', 'Executive Boardroom');
  registerChair(4, brCenterX - 2.1, fy4, brTableZ - 1.4, Math.PI / 2, -1);
  registerMonitor(4, l4MonIdx++, [brCenterX - 1.15, fy4 + 0.785, brTableZ - 1.4], -Math.PI / 2, brCenterX - 2.1, brTableZ - 1.4, 'Chief Operating Officer · L4', 'Executive Boardroom');
  officeChair(g4, brCenterX, fy4, brTableZ + 4.05, Math.PI, M);
  [-2.6, -0.2, 1.0, 2.2].forEach((czo) => officeChair(g4, brCenterX - 2.1, fy4, brTableZ + czo, Math.PI / 2, M));
  [-2.6, -1.4, -0.2, 1.0, 2.2].forEach((czo) => officeChair(g4, brCenterX + 2.1, fy4, brTableZ + czo, -Math.PI / 2, M));
  [-2.1, -0.6, 0.9, 2.3].forEach((tz) => {
    boxAt(g4, 0.32, 0.016, 0.24, brCenterX - 0.95, fy4 + 0.79, brTableZ + tz, M.white, false, false);
    boxAt(g4, 0.32, 0.016, 0.24, brCenterX + 0.95, fy4 + 0.79, brTableZ + tz, pal.darkSlateSlab, false, false);
  });
  plant(g4, spec.cx + 11.4, fy4, spec.cz - 7.25, 1.35, 1101, M, 'olive');
  plant(g4, spec.cx + 11.4, fy4, spec.cz + 7.1, 1.25, 1102, M, 'ficus');

  // CEO Corner Penthouse Suite
  const ceoCenterX = spec.cx - 1.15;
  const ceoFrontZ = spec.cz + 2.1;
  boxAt(g4, 2.3, 2.95, 0.08, spec.cx - 3.45, fy4 + 1.475, ceoFrontZ, pal.vitrineGlass, false, false);
  boxAt(g4, 3.2, 2.95, 0.08, spec.cx + 0.7, fy4 + 1.475, ceoFrontZ, pal.vitrineGlass, false, false);
  boxAt(g4, 6.95, 0.14, 0.14, ceoCenterX, fy4 + 2.95, ceoFrontZ, pal.walnutExec, true, false);
  boxAt(g4, 6.95, 0.06, 0.12, ceoCenterX, fy4 + 0.03, ceoFrontZ, archMats.bronzeMullion, false, false);
  [-4.6, -2.3, -0.9, 2.3].forEach((px) => boxAt(g4, 0.14, 2.96, 0.14, spec.cx + px, fy4 + 1.48, ceoFrontZ, pal.walnutExec, true, false));
  boxAt(g4, 0.08, 2.95, 6.4, spec.cx - 4.6, fy4 + 1.475, spec.cz + 5.3, pal.vitrineGlass, false, false);
  boxAt(g4, 0.14, 0.14, 6.4, spec.cx - 4.6, fy4 + 2.95, spec.cz + 5.3, pal.walnutExec, true, false);
  addRealEstatePlaque(g4, 'CEO PENTHOUSE SUITE', spec.cx + 0.55, fy4 + 2.66, ceoFrontZ - 0.09, Math.PI);

  const ceoBackZ = spec.cz + 8.44;
  boxAt(g4, 2.25, 2.95, 0.16, ceoCenterX, fy4 + 1.475, ceoBackZ + 0.06, pal.darkSlateSlab, true, true, 0.02);
  boxAt(g4, 1.38, 0.42, 0.04, ceoCenterX, fy4 + 2.05, ceoBackZ - 0.03, M.brass, false, false, 0.01);
  [spec.cx - 3.3, spec.cx + 1.0].forEach((bx) => {
    boxAt(g4, 1.55, 2.9, 0.44, bx, fy4 + 1.45, ceoBackZ - 0.08, pal.walnutExec, true, true, 0.02);
    [0.65, 1.32, 1.98, 2.55].forEach((sy) => {
      boxAt(g4, 1.4, 0.04, 0.36, bx, fy4 + sy, ceoBackZ - 0.08, M.oakDesk, false, false);
      boxAt(g4, 1.32, 0.025, 0.04, bx, fy4 + sy + 0.33, ceoBackZ - 0.2, pal.warmCoveLed, false, false);
    });
  });

  makeDesk(g4, ceoCenterX, fy4, spec.cz + 5.75, 2.7, 1.1, pal.walnutExec, pal.gunmetalSteel);
  boxAt(g4, 0.86, 0.72, 1.5, spec.cx + 0.55, fy4 + 0.36, spec.cz + 6.45, pal.walnutExec, true, true, 0.02);
  addPendantFixture(g4, ceoCenterX, fy4 + 2.68, ceilY4, spec.cz + 5.75, 2.3, pal, pal.brushedBronze);
  registerChair(4, ceoCenterX, fy4, spec.cz + 6.72, Math.PI, -1);
  registerMonitor(4, l4MonIdx++, [ceoCenterX, fy4 + 0.77, spec.cz + 5.88], 0, ceoCenterX, spec.cz + 6.72, 'Chief Executive Officer · L4', 'CEO Penthouse Suite');
  const ceoGuest1 = armchair(g4, spec.cx - 1.85, fy4, spec.cz + 4.45, 0, M.fabricCognac, M);
  ceoGuest1.scale.set(0.76, 0.9, 0.76);
  const ceoGuest2 = armchair(g4, spec.cx - 0.45, fy4, spec.cz + 4.45, 0, M.fabricCognac, M);
  ceoGuest2.scale.set(0.76, 0.9, 0.76);
  const ceoRead = armchair(g4, spec.cx + 1.45, fy4, spec.cz + 4.3, -Math.PI * 0.45, pal.emeraldVelvet, M);
  ceoRead.scale.set(0.75, 0.88, 0.75);
  cylAt(g4, 0.32, 0.32, 0.04, spec.cx + 1.3, fy4 + 0.45, spec.cz + 3.45, pal.honedTravertine, true, true, 16);
  cylAt(g4, 0.06, 0.1, 0.43, spec.cx + 1.3, fy4 + 0.22, spec.cz + 3.45, M.brass, false, true, 12);
  plant(g4, spec.cx + 1.65, fy4, spec.cz + 7.55, 1.2, 1103, M, 'ficus');

  // SW CFO & Capital Strategy Office
  const cfoFrontZ = spec.cz + 4.05;
  boxAt(g4, 4.18, 2.95, 0.08, spec.cx - 10.19, fy4 + 1.475, cfoFrontZ, pal.vitrineGlass, false, false);
  boxAt(g4, 2.0, 2.95, 0.08, spec.cx - 5.6, fy4 + 1.475, cfoFrontZ, pal.vitrineGlass, false, false);
  boxAt(g4, 7.68, 0.14, 0.14, spec.cx - 8.44, fy4 + 2.95, cfoFrontZ, pal.walnutExec, true, false);
  boxAt(g4, 7.68, 0.06, 0.12, spec.cx - 8.44, fy4 + 0.03, cfoFrontZ, archMats.bronzeMullion, false, false);
  [-12.28, -8.1, -6.6].forEach((px) => boxAt(g4, 0.14, 2.96, 0.14, spec.cx + px, fy4 + 1.48, cfoFrontZ, pal.walnutExec, true, false));
  addRealEstatePlaque(g4, 'CFO · HEAD OF FINANCE', spec.cx - 10.1, fy4 + 2.66, cfoFrontZ - 0.09, Math.PI);

  const cfoX = spec.cx - 8.5;
  makeDesk(g4, cfoX, fy4, spec.cz + 6.3, 2.4, 1.05, pal.walnutExec, pal.gunmetalSteel);
  registerChair(4, cfoX, fy4, spec.cz + 7.22, Math.PI, 1);
  registerMonitor(4, l4MonIdx++, [cfoX, fy4 + 0.77, spec.cz + 6.38], 0, cfoX, spec.cz + 7.22, 'Chief Financial Officer · L4', 'CFO & Capital Strategy Office');
  const cfoVis1 = armchair(g4, cfoX - 0.75, fy4, spec.cz + 5.05, 0, pal.sageAcoustic, M);
  cfoVis1.scale.set(0.74, 0.88, 0.74);
  const cfoVis2 = armchair(g4, cfoX + 0.75, fy4, spec.cz + 5.05, 0, pal.sageAcoustic, M);
  cfoVis2.scale.set(0.74, 0.88, 0.74);
  boxAt(g4, 3.8, 0.82, 0.56, cfoX, fy4 + 0.41, spec.cz + 8.24, pal.walnutExec, true, true, 0.02);
  boxAt(g4, 2.05, 1.15, 0.07, cfoX, fy4 + 1.82, spec.cz + 8.46, frameDarkMat, false, false);
  const cfoTv = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.02), boothScreen.mat);
  cfoTv.position.set(cfoX, fy4 + 1.82, spec.cz + 8.41);
  cfoTv.rotation.y = Math.PI;
  g4.add(cfoTv);
  plant(g4, spec.cx - 11.45, fy4, spec.cz + 7.45, 1.15, 1104, M, 'ficus');

  // NW Head of Developments & Architecture Office
  const devFrontZ = spec.cz - 3.5;
  const devEastX = spec.cx - 5.0;
  boxAt(g4, 4.9, 2.95, 0.08, spec.cx - 9.85, fy4 + 1.475, devFrontZ, pal.vitrineGlass, false, false);
  boxAt(g4, 1.0, 2.95, 0.08, spec.cx - 5.5, fy4 + 1.475, devFrontZ, pal.vitrineGlass, false, false);
  boxAt(g4, 7.36, 0.14, 0.14, spec.cx - 8.65, fy4 + 2.95, devFrontZ, pal.walnutExec, true, false);
  boxAt(g4, 7.36, 0.06, 0.12, spec.cx - 8.65, fy4 + 0.03, devFrontZ, archMats.bronzeMullion, false, false);
  boxAt(g4, 0.08, 2.95, 4.7, devEastX, fy4 + 1.475, spec.cz - 5.85, pal.vitrineGlass, false, false);
  boxAt(g4, 0.14, 0.14, 4.7, devEastX, fy4 + 2.95, spec.cz - 5.85, pal.walnutExec, true, false);
  [-12.28, -7.4, -6.0, -5.0].forEach((px) => boxAt(g4, 0.14, 2.96, 0.14, spec.cx + px, fy4 + 1.48, devFrontZ, pal.walnutExec, true, false));
  addRealEstatePlaque(g4, 'HEAD OF DEVELOPMENTS', spec.cx - 9.8, fy4 + 2.66, devFrontZ + 0.09, 0);

  const devX = spec.cx - 8.7;
  makeDesk(g4, devX, fy4, spec.cz - 5.85, 2.5, 1.1, pal.walnutExec, pal.gunmetalSteel);
  registerChair(4, devX, fy4, spec.cz - 6.82, 0, -1);
  registerMonitor(4, l4MonIdx++, [devX, fy4 + 0.77, spec.cz - 5.95], Math.PI, devX, spec.cz - 6.82, 'Head of Developments · L4', 'Developments & Architecture Office');
  const devVis1 = armchair(g4, devX - 0.75, fy4, spec.cz - 4.6, Math.PI, pal.tealLinen, M);
  devVis1.scale.set(0.74, 0.88, 0.74);
  const devVis2 = armchair(g4, devX + 0.75, fy4, spec.cz - 4.6, Math.PI, pal.tealLinen, M);
  devVis2.scale.set(0.74, 0.88, 0.74);
  boxAt(g4, 0.82, 0.82, 2.3, spec.cx - 11.55, fy4 + 0.41, spec.cz - 5.65, pal.walnutExec, true, true, 0.02);
  boxAt(g4, 0.45, 0.52, 0.45, spec.cx - 11.55, fy4 + 1.08, spec.cz - 5.65, pal.honedTravertine, true, false, 0.02);
  boxAt(g4, 0.28, 0.72, 0.28, spec.cx - 11.55, fy4 + 1.18, spec.cz - 6.3, M.brass, true, false, 0.015);
  plant(g4, spec.cx - 11.45, fy4, spec.cz - 7.55, 1.2, 1105, M, 'olive');

  // Center C-Suite EA Reception, VIP Board Waiting Lounge & Espresso Console
  const eaX = spec.cx - 1.2;
  const eaZ = spec.cz - 5.65;
  makeDesk(g4, eaX, fy4, eaZ, 2.2, 0.92, pal.walnutExec, pal.gunmetalSteel);
  boxAt(g4, 2.24, 0.96, 0.14, eaX, fy4 + 0.48, eaZ + 0.48, pal.flutedTravertine, true, true, 0.02);
  addPendantFixture(g4, eaX, fy4 + 2.68, ceilY4, eaZ, 2.0, pal, frameDarkMat);
  registerChair(4, eaX, fy4, spec.cz - 6.55, 0, 1);
  registerMonitor(4, l4MonIdx++, [eaX, fy4 + 0.77, eaZ - 0.1], Math.PI, eaX, spec.cz - 6.55, 'Executive Assistant to CEO · L4', 'C-Suite Reception');

  const vipSofa = sofaWide(g4, spec.cx - 2.35, fy4, spec.cz - 1.6, Math.PI / 2, pal.emeraldVelvet, M);
  vipSofa.scale.set(0.76, 0.92, 0.84);
  cylAt(g4, 0.5, 0.5, 0.04, spec.cx - 0.85, fy4 + 0.41, spec.cz - 1.6, pal.honedTravertine, true, true, 22);
  cylAt(g4, 0.08, 0.14, 0.39, spec.cx - 0.85, fy4 + 0.2, spec.cz - 1.6, M.brass, false, true, 14);
  const vipArm1 = armchair(g4, spec.cx + 0.45, fy4, spec.cz - 2.45, -Math.PI * 0.35, M.fabricCognac, M);
  vipArm1.scale.set(0.75, 0.88, 0.75);
  const vipArm2 = armchair(g4, spec.cx + 0.45, fy4, spec.cz - 0.75, -Math.PI * 0.65, M.fabricCognac, M);
  vipArm2.scale.set(0.75, 0.88, 0.75);
  plant(g4, spec.cx + 1.55, fy4, spec.cz + 1.2, 1.25, 1106, M, 'ficus');

  boxAt(g4, 0.58, 0.92, 2.0, spec.cx - 8.75, fy4 + 0.46, spec.cz + 2.55, pal.walnutExec, true, true, 0.02);
  boxAt(g4, 0.62, 0.05, 2.04, spec.cx - 8.75, fy4 + 0.94, spec.cz + 2.55, pal.honedTravertine, false, true, 0.01);
  boxAt(g4, 0.42, 0.46, 0.62, spec.cx - 8.75, fy4 + 1.19, spec.cz + 2.35, M.dark, true, false, 0.02);
  boxAt(g4, 0.34, 0.06, 1.8, spec.cx - 8.82, fy4 + 1.92, spec.cz + 2.55, M.oakDesk, true, false, 0.01);

  // ===========================================================================
  // CONTINUOUS ARCHITECTURAL STAIRWELL CORE (G -> L4) & COFFERED CEILINGS
  // ===========================================================================
  const stairXWest = spec.cx - 12.28;
  const stairXEast = spec.cx - 9.18;
  const stairXMid = spec.cx - 10.71;
  const stairZNorth = spec.cz - 1.32;
  const stairZSouth = spec.cz + 3.82;
  const stairSpanW = stairXEast - stairXWest;
  const stairSpanD = stairZSouth - stairZNorth;
  const stairCenterX = (stairXWest + stairXEast) * 0.5;
  const stairCenterZ = (stairZNorth + stairZSouth) * 0.5;
  const stairZBridgeEnd = spec.cz - 0.05;
  const stairZHalfStart = spec.cz + 2.55;
  const stairSigns = ['STAIRS · G → L1', 'STAIRS · L1 ↔ L2', 'STAIRS · L2 ↔ L3', 'STAIRS · L3 ↔ L4', 'STAIRS · L4'];

  const addStairBalustrade = (parent: THREE.Object3D, bx: number, bz: number, bw: number, bd: number, yBase: number, h = 1.04) => {
    boxAt(parent, bw, h, bd, bx, yBase + h * 0.5, bz, pal.vitrineGlass, false, false);
    boxAt(
      parent,
      bw > bd ? bw + 0.04 : 0.06,
      0.05,
      bd > bw ? bd + 0.04 : 0.06,
      bx,
      yBase + h + 0.025,
      bz,
      archMats.bronzeMullion,
      true,
      false
    );
  };

  const addSlopedRail = (parent: THREE.Object3D, x: number, y0: number, z0: number, y1: number, z1: number) => {
    const p0 = new THREE.Vector3(x, y0 + 0.92, z0);
    const p1 = new THREE.Vector3(x, y1 + 0.92, z1);
    const len = p0.distanceTo(p1);
    const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
    const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 10), archMats.bronzeMullion);
    rail.position.copy(mid);
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    parent.add(rail);
    [0.15, 0.5, 0.85].forEach((t) => {
      const py = THREE.MathUtils.lerp(y0, y1, t);
      const pz = THREE.MathUtils.lerp(z0, z1, t);
      cylAt(parent, 0.014, 0.014, 0.92, x, py + 0.46, pz, archMats.bronzeMullion, false, false, 8);
    });
  };

  for (let lv = 0; lv < spec.floors; lv++) {
    const lgStair = levelGroups[lv];
    const cg = levelCeilings[lv];
    const yFloor = spec.groundY + lv * spec.floorH;
    const fyLv = yFloor + SLAB_THICK * 0.5;
    const ceilY = yFloor + spec.floorH - 0.14;
    const wallH = spec.floorH - SLAB_THICK - 0.04;

    // 1. Bespoke Coffered Timber-Baffle Ceiling & Recessed Cove Lighting
    if (cg) {
      if (lv === 0) {
        ceilingLinearLight(cg, spec.cx, ceilY - 0.08, spec.cz + spec.d * 0.22, spec.w - 8, 0.26, M);
        ceilingLinearLight(cg, spec.cx + 5.8, ceilY - 0.08, spec.cz - spec.d * 0.22, 10.5, 0.26, M);
        for (let bx = spec.cx + 1.0; bx <= spec.cx + 11.5; bx += 2.1) {
          boxAt(cg, 0.08, 0.14, spec.d - 2.4, bx, ceilY - 0.14, spec.cz, archMats.timberFin, false, false);
        }
      } else {
        [-spec.d * 0.22, spec.d * 0.22].forEach((dz) => {
          ceilingLinearLight(cg, spec.cx, ceilY - 0.08, spec.cz + dz, spec.w - 8, 0.26, M);
        });
        for (let bx = spec.cx - 7.5; bx <= spec.cx + 11.0; bx += 2.3) {
          boxAt(cg, 0.075, 0.14, spec.d - 2.8, bx, ceilY - 0.14, spec.cz, archMats.timberFin, false, false);
        }
        downlight(cg, spec.cx - 10.7, ceilY - 0.08, spec.cz - 0.65, M, 0.14);
      }
    }

    if (!lgStair) continue;

    // 2. Stairwell Core Vestibule, Glazing, Framed Doorway & Switchback Oak/Bronze Flights
    boxAt(lgStair, 3.0, 0.018, 1.24, stairCenterX, fyLv + 0.009, spec.cz - 0.68, floorWarmOak, false, true);
    boxAt(lgStair, 0.16, 0.018, 1.2, stairXEast, fyLv + 0.011, spec.cz - 0.62, M.brass, false, true);

    boxAt(lgStair, 0.1, 0.18, stairSpanD, stairXWest, fyLv + 0.09, stairCenterZ, archMats.stuccoWhite, true, true);
    boxAt(lgStair, 0.05, wallH - 0.24, stairSpanD, stairXWest, fyLv + 0.18 + (wallH - 0.24) * 0.5, stairCenterZ, pal.vitrineGlass, false, false);
    boxAt(lgStair, 0.12, 0.12, stairSpanD, stairXWest, fyLv + wallH - 0.02, stairCenterZ, archMats.bronzeMullion, false, false);
    [stairZNorth, spec.cz + 1.25, stairZSouth].forEach((mz) => {
      boxAt(lgStair, 0.1, wallH, 0.1, stairXWest, fyLv + wallH * 0.5, mz, archMats.bronzeMullion, true, false);
    });

    [stairZNorth, stairZSouth].forEach((wz) => {
      boxAt(lgStair, stairSpanW, 0.18, 0.1, stairCenterX, fyLv + 0.09, wz, archMats.stuccoWhite, true, true);
      boxAt(lgStair, stairSpanW, wallH - 0.24, 0.05, stairCenterX, fyLv + 0.18 + (wallH - 0.24) * 0.5, wz, pal.vitrineGlass, false, false);
      boxAt(lgStair, stairSpanW, 0.12, 0.12, stairCenterX, fyLv + wallH - 0.02, wz, archMats.bronzeMullion, false, false);
      boxAt(lgStair, 0.1, wallH, 0.1, stairXMid, fyLv + wallH * 0.5, wz, archMats.bronzeMullion, true, false);
    });

    const eastGlZ = spec.cz + 1.9;
    const eastGlLen = 3.84;
    boxAt(lgStair, 0.12, 0.36, eastGlLen, stairXEast, fyLv + 0.18, eastGlZ, archMats.stuccoWhite, true, true);
    boxAt(lgStair, 0.05, wallH - 0.42, eastGlLen, stairXEast, fyLv + 0.36 + (wallH - 0.42) * 0.5, eastGlZ, pal.vitrineGlass, false, false);
    boxAt(lgStair, 0.12, 0.12, eastGlLen, stairXEast, fyLv + wallH - 0.02, eastGlZ, archMats.bronzeMullion, false, false);
    boxAt(lgStair, 0.1, wallH, 0.1, stairXEast, fyLv + wallH * 0.5, spec.cz + 1.9, archMats.bronzeMullion, true, false);
    boxAt(lgStair, 0.1, wallH, 0.1, stairXEast, fyLv + wallH * 0.5, stairZSouth, archMats.bronzeMullion, true, false);

    const doorCenterZ = spec.cz - 0.62;
    const doorH = 2.42;
    [spec.cz - 1.25, spec.cz + 0.01].forEach((jz) => {
      boxAt(lgStair, 0.15, wallH, 0.11, stairXEast, fyLv + wallH * 0.5, jz, M.oakDesk, true, false, 0.01);
    });
    boxAt(lgStair, 0.15, 0.12, 1.36, stairXEast, fyLv + doorH + 0.06, doorCenterZ, archMats.bronzeMullion, true, false, 0.01);
    const transomH = Math.max(0.3, wallH - doorH - 0.16);
    boxAt(lgStair, 0.05, transomH, 1.18, stairXEast, fyLv + doorH + 0.12 + transomH * 0.5, doorCenterZ, pal.vitrineGlass, false, false);
    boxAt(lgStair, 0.13, 0.1, 1.32, stairXEast, fyLv + wallH - 0.02, doorCenterZ, archMats.bronzeMullion, false, false);

    const doorPivot = new THREE.Group();
    doorPivot.position.set(stairXEast + 0.02, fyLv, spec.cz - 0.04);
    doorPivot.rotation.y = -2.22;
    boxAt(doorPivot, 0.055, doorH - 0.04, 0.09, 0, (doorH - 0.04) * 0.5 + 0.02, -0.045, M.oakDesk, true, false);
    boxAt(doorPivot, 0.055, doorH - 0.04, 0.09, 0, (doorH - 0.04) * 0.5 + 0.02, -1.08, M.oakDesk, true, false);
    boxAt(doorPivot, 0.055, 0.14, 1.12, 0, 0.09, -0.56, M.oakDesk, true, false);
    boxAt(doorPivot, 0.055, 0.12, 1.12, 0, doorH - 0.08, -0.56, M.oakDesk, true, false);
    boxAt(doorPivot, 0.028, doorH - 0.3, 0.96, 0, doorH * 0.5, -0.56, pal.vitrineGlass, false, false);
    cylAt(doorPivot, 0.014, 0.014, 0.86, -0.055, 1.15, -0.98, M.brass, false, false, 10);
    cylAt(doorPivot, 0.014, 0.014, 0.86, 0.055, 1.15, -0.98, M.brass, false, false, 10);
    boxAt(doorPivot, 0.08, 0.055, 0.24, 0, doorH - 0.12, -0.18, archMats.bronzeMullion, false, false, 0.01);
    lgStair.add(doorPivot);

    addRealEstatePlaque(lgStair, stairSigns[lv] ?? `STAIRS · L${lv}`, stairXEast + 0.1, fyLv + doorH + 0.34, doorCenterZ, Math.PI / 2);

    if (lv < spec.floors - 1) {
      const steps = 8;
      const runLen = stairZHalfStart - stairZBridgeEnd;
      const stepDepth = runLen / steps;
      const halfRise = spec.floorH * 0.5;
      const stepRise = halfRise / steps;
      const yMidLv = fyLv + halfRise;
      const yTopLv = fyLv + spec.floorH;

      for (let st = 0; st < steps; st++) {
        const ty = fyLv + (st + 0.5) * stepRise;
        const tz = stairZBridgeEnd + (st + 0.5) * stepDepth;
        boxAt(lgStair, 1.32, stepRise, stepDepth + 0.03, spec.cx - 11.46, ty, tz, archMats.bronzeMullion, true, true, 0.008);
        boxAt(lgStair, 1.35, 0.045, stepDepth + 0.04, spec.cx - 11.46, ty + stepRise * 0.5 + 0.01, tz, M.oakDesk, false, true, 0.008);
        boxAt(lgStair, 1.35, 0.016, 0.035, spec.cx - 11.46, ty + stepRise * 0.5 + 0.028, tz - stepDepth * 0.45, M.brass, false, false);
      }

      boxAt(lgStair, 2.94, 0.16, 1.22, stairCenterX, yMidLv - 0.07, spec.cz + 3.16, archMats.bronzeMullion, true, true, 0.015);
      boxAt(lgStair, 2.9, 0.04, 1.18, stairCenterX, yMidLv + 0.02, spec.cz + 3.16, M.oakDesk, false, true, 0.01);

      for (let st = 0; st < steps; st++) {
        const ty = yMidLv + (st + 0.5) * stepRise;
        const tz = stairZHalfStart - (st + 0.5) * stepDepth;
        boxAt(lgStair, 1.32, stepRise * 0.55, stepDepth + 0.03, spec.cx - 9.96, ty + stepRise * 0.22, tz, archMats.bronzeMullion, true, true, 0.008);
        boxAt(lgStair, 1.35, 0.045, stepDepth + 0.04, spec.cx - 9.96, ty + stepRise * 0.5 + 0.01, tz, M.oakDesk, false, true, 0.008);
        boxAt(lgStair, 1.35, 0.016, 0.035, spec.cx - 9.96, ty + stepRise * 0.5 + 0.028, tz + stepDepth * 0.45, M.brass, false, false);
      }

      addSlopedRail(lgStair, spec.cx - 12.14, fyLv, stairZBridgeEnd, yMidLv, stairZHalfStart);
      addSlopedRail(lgStair, spec.cx - 10.78, fyLv, stairZBridgeEnd, yMidLv, stairZHalfStart);
      addSlopedRail(lgStair, spec.cx - 10.64, yMidLv, stairZHalfStart, yTopLv, stairZBridgeEnd);
      addSlopedRail(lgStair, spec.cx - 9.28, yMidLv, stairZHalfStart, yTopLv, stairZBridgeEnd);
    }

    if (lv === 0) {
      addStairBalustrade(lgStair, spec.cx - 9.96, stairZBridgeEnd, 1.44, 0.06, fyLv, 1.45);
      addStairBalustrade(lgStair, stairXMid, spec.cz + 1.25, 0.06, 2.6, fyLv, 1.04);
    } else {
      addStairBalustrade(lgStair, stairXMid, spec.cz + 1.85, 0.06, 3.8, fyLv, 1.04);
      addStairBalustrade(lgStair, spec.cx - 12.22, spec.cz + 1.85, 0.05, 3.8, fyLv, 1.04);
      addStairBalustrade(lgStair, stairCenterX, spec.cz + 3.74, 2.94, 0.05, fyLv, 1.04);
      if (lv === spec.floors - 1) {
        addStairBalustrade(lgStair, spec.cx - 11.46, stairZBridgeEnd, 1.46, 0.06, fyLv, 1.04);
      }
    }
  }
}
