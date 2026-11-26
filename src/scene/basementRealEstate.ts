import * as THREE from 'three';
import { buildPlanterTrough, getArchitecturalMaterials } from './architecturalForms';
import { BASE, DEPTH, LANE, LIFTX, WIDTH } from './constants';
import type { MaterialLibrary } from './materials';
import { armchair, boxAt, cylAt, officeChair, planeAt, plant, shelfUnit } from './props';
import { addPendantFixture, addRealEstatePlaque } from './realestatePalette';
import { createCustomBoardScreen, type ScreenRegistry } from './screens';
import { makeCanvasTex, rr, svcSignTex } from './textures';

export interface BasementRealEstateContext {
  basementGroup: THREE.Group;
  gB1: THREE.Group;
  b1Ceiling: THREE.Group;
  gB2: THREE.Group;
  b2Ceiling: THREE.Group;
  M: MaterialLibrary;
  screenReg: ScreenRegistry;
  addTrackedChair: (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    rot: number,
    lv: number,
    scale?: number,
    maxPush?: number,
    swivelDir?: number
  ) => THREE.Group;
  exMon: (
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
  ) => THREE.Group;
}

function mkTileTex(t: THREE.Texture, rx: number, ry: number): THREE.Texture {
  const c = t.clone();
  c.needsUpdate = true;
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  return c;
}

function createBasementPalette(M: MaterialLibrary) {
  const std = (opts: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(opts);

  const flutedTex = makeCanvasTex('re_basement_fluted_trav', 256, 256, (g, W, H) => {
    g.fillStyle = '#e7dfd1';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 16) {
      const grad = g.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, '#c8bca6');
      grad.addColorStop(0.45, '#f5efe4');
      grad.addColorStop(0.85, '#ddd2be');
      grad.addColorStop(1, '#b8ab93');
      g.fillStyle = grad;
      g.fillRect(x, 0, 16, H);
    }
  });
  flutedTex.wrapS = flutedTex.wrapT = THREE.RepeatWrapping;
  flutedTex.repeat.set(6, 1);

  const boardConcTex = makeCanvasTex('re_basement_board_conc', 256, 256, (g, W, H) => {
    g.fillStyle = '#9aa1a8';
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 24) {
      g.fillStyle = y % 48 === 0 ? '#a6adb4' : '#8f969d';
      g.fillRect(0, y + 1, W, 22);
      g.fillStyle = 'rgba(30,41,59,0.18)';
      g.fillRect(0, y, W, 1.5);
    }
    g.fillStyle = '#475569';
    for (let y = 36; y < H; y += 72) {
      for (let x = 32; x < W; x += 64) {
        g.beginPath();
        g.arc(x, y, 3.2, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
  boardConcTex.wrapS = boardConcTex.wrapT = THREE.RepeatWrapping;
  boardConcTex.repeat.set(4, 1.5);

  const chevronTex = makeCanvasTex('re_basement_chevron_oak', 256, 256, (g, W, H) => {
    g.fillStyle = '#ba8f60';
    g.fillRect(0, 0, W, H);
    const cols = 4;
    const cw = W / cols;
    const step = 28;
    for (let c = 0; c < cols; c++) {
      const dir = c % 2 === 0 ? 1 : -1;
      for (let y = -step; y < H + step; y += step) {
        g.fillStyle = (c + Math.floor(y / step)) % 3 === 0 ? '#c79b6a' : '#ad8252';
        g.beginPath();
        const x0 = c * cw;
        const x1 = x0 + cw;
        g.moveTo(x0, y);
        g.lineTo(x1, y + dir * 24);
        g.lineTo(x1, y + dir * 24 + step - 2);
        g.lineTo(x0, y + step - 2);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(68,44,24,0.22)';
        g.lineWidth = 1.4;
        g.stroke();
      }
    }
  });
  chevronTex.wrapS = chevronTex.wrapT = THREE.RepeatWrapping;
  chevronTex.repeat.set(4, 3);

  const carpetTex = makeCanvasTex('re_basement_slate_carpet', 256, 256, (g, W, H) => {
    g.fillStyle = '#555f6b';
    g.fillRect(0, 0, W, H);
    const tile = 64;
    for (let ty = 0; ty < H; ty += tile) {
      for (let tx = 0; tx < W; tx += tile) {
        const alt = ((tx / tile + ty / tile) % 2) === 0;
        g.fillStyle = alt ? '#606b78' : '#4f5965';
        g.fillRect(tx + 1, ty + 1, tile - 2, tile - 2);
        g.fillStyle = 'rgba(255,255,255,0.04)';
        for (let s = 4; s < tile - 2; s += 6) {
          if (alt) g.fillRect(tx + s, ty + 2, 2, tile - 4);
          else g.fillRect(tx + 2, ty + s, tile - 4, 2);
        }
      }
    }
  });
  carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
  carpetTex.repeat.set(4, 3);

  return {
    honedTravertine: std({
      map: mkTileTex(M.textures.marbleTex, 10, 2.5),
      normalMap: mkTileTex(M.textures.marbleNormal, 10, 2.5),
      normalScale: new THREE.Vector2(0.32, 0.32),
      color: 0xf2ece2,
      roughness: 0.34,
      metalness: 0.04,
      envMapIntensity: 0.38,
    }),
    flutedTravertine: std({
      map: flutedTex,
      normalMap: mkTileTex(M.textures.marbleNormal, 6, 1),
      normalScale: new THREE.Vector2(0.4, 0.28),
      roughness: 0.44,
      metalness: 0.04,
      envMapIntensity: 0.34,
    }),
    boardformedConcrete: std({
      map: boardConcTex,
      normalMap: M.textures.concreteNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.78,
      metalness: 0.04,
      envMapIntensity: 0.22,
    }),
    chevronOak: std({
      map: chevronTex,
      normalMap: M.textures.woodNormal,
      normalScale: new THREE.Vector2(0.36, 0.36),
      roughness: 0.46,
      metalness: 0.03,
      envMapIntensity: 0.28,
    }),
    slateCarpet: std({
      map: carpetTex,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.14,
    }),
    wovenTaupeRug: std({ color: 0xb9b4aa, roughness: 0.96, envMapIntensity: 0.12 }),
    woolCharcoalRug: std({ color: 0x3b4048, roughness: 0.94, envMapIntensity: 0.14 }),
    walnutExec: std({
      map: M.textures.woodTex,
      normalMap: M.textures.woodNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      color: 0x4b3222,
      roughness: 0.44,
      metalness: 0.06,
      envMapIntensity: 0.34,
    }),
    sageAcoustic: std({ color: 0x3b634b, roughness: 0.78, metalness: 0.02, envMapIntensity: 0.18 }),
    darkSlateSlab: std({ color: 0x2a313b, roughness: 0.48, metalness: 0.1, envMapIntensity: 0.28 }),
    gunmetalSteel: std({ color: 0x2c3542, roughness: 0.4, metalness: 0.62, envMapIntensity: 0.5 }),
    brushedBronze: std({ color: 0x9a7b4f, roughness: 0.34, metalness: 0.76, envMapIntensity: 0.62 }),
    copperBusbar: std({ color: 0xb87344, roughness: 0.3, metalness: 0.82, envMapIntensity: 0.65 }),
    amberInlay: std({ color: 0xd49b42, roughness: 0.46, metalness: 0.35, envMapIntensity: 0.35 }),
    mustardBoucle: std({ color: 0xd9a74a, roughness: 0.82, envMapIntensity: 0.16 }),
    tealLinen: std({ color: 0x3f888f, roughness: 0.78, envMapIntensity: 0.16 }),
    coralBoucle: std({ color: 0xcf5d52, roughness: 0.82, envMapIntensity: 0.16 }),
    emeraldVelvet: std({ color: 0x2e5e4e, roughness: 0.78, envMapIntensity: 0.18 }),
    crimsonMatte: std({ color: 0xa8322a, roughness: 0.34, metalness: 0.24, envMapIntensity: 0.38 }),
    txSageSteel: std({ color: 0x33453c, roughness: 0.5, metalness: 0.38, envMapIntensity: 0.45 }),
    vitrineGlass: std({
      color: 0xe6f4fa,
      roughness: 0.06,
      metalness: 0.08,
      transparent: true,
      opacity: 0.24,
      envMapIntensity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    warmCoveLed: new THREE.MeshBasicMaterial({ color: 0xffe8c2, toneMapped: false }),
    cyanBeaconLed: new THREE.MeshBasicMaterial({ color: 0x38bdf8, toneMapped: false }),
    emeraldBeaconLed: new THREE.MeshBasicMaterial({ color: 0x4ade80, toneMapped: false }),
    amberBeaconLed: new THREE.MeshBasicMaterial({ color: 0xf59e0b, toneMapped: false }),
  };
}

type BasementPal = ReturnType<typeof createBasementPalette>;

function buildArchitecturalWallShell(
  bg: THREE.Group,
  bc: THREE.Group,
  y: number,
  h: number,
  pal: BasementPal,
  M: MaterialLibrary
) {
  const ch = y + h;

  // Structural retaining slab, front lip & perimeter concrete shell
  boxAt(bg, WIDTH + 0.8, 0.4, DEPTH + 0.8, 0, y - 0.2, DEPTH / 2, M.baseSlab, false, true);
  boxAt(bg, WIDTH + 0.8, 0.95, 0.34, 0, y - 0.72, DEPTH + 0.22, M.concrete, false, true, 0.04);
  boxAt(bg, WIDTH - 0.4, h, 0.36, 0, y + h / 2, 0.18, pal.boardformedConcrete, false, true);
  [-1, 1].forEach((sd) => {
    boxAt(
      bg,
      0.36,
      h,
      DEPTH - 0.2,
      sd * (WIDTH / 2 - 0.18),
      y + h / 2,
      DEPTH / 2 - 0.4,
      pal.boardformedConcrete,
      false,
      true
    );
  });

  // Full-width Honed Travertine architectural gallery floor
  boxAt(bg, WIDTH - 0.8, 0.016, DEPTH - 0.5, 0, y + 0.008, DEPTH / 2, pal.honedTravertine, false, true);

  // Subtle brushed bronze bay expansion inlays aligned with building column grid
  [-20, -10, 0, 10, 20].forEach((bx) => {
    boxAt(bg, 0.045, 0.006, DEPTH - 0.7, bx, y + 0.018, DEPTH / 2, pal.brushedBronze, false, false);
  });

  // Rear wall architectural wainscoting: Fluted travertine dado (0..1.38m) + bronze rail + walnut/sage rhythm
  boxAt(bg, WIDTH - 0.9, 1.38, 0.06, 0, y + 0.69, 0.39, pal.flutedTravertine, false, true);
  boxAt(bg, WIDTH - 0.9, 0.045, 0.08, 0, y + 1.4, 0.4, pal.brushedBronze, false, false);

  // Alternating walnut acoustic slat pilasters & sage acoustic panels across upper rear wall
  for (let bay = 0; bay < 6; bay++) {
    const bx = -25 + bay * 10;
    // Column pilaster at bay boundary
    if (bay > 0) {
      const px = -30 + bay * 10;
      boxAt(bg, 0.34, h - 0.15, 0.2, px, y + (h - 0.15) / 2, 0.44, pal.walnutExec, true, true, 0.02);
      boxAt(bg, 0.38, 0.04, 0.22, px, y + 0.02, 0.44, pal.brushedBronze, false, false);
      boxAt(bg, 0.38, 0.04, 0.22, px, ch - 0.18, 0.44, pal.brushedBronze, false, false);
    }
    // Acoustic sage felt recessed panel + vertical walnut acoustic ribs on outer wings
    if (bay === 0 || bay === 5) {
      boxAt(bg, 6.6, 1.65, 0.04, bx, y + 2.38, 0.38, pal.sageAcoustic, false, true, 0.015);
      for (let s = -3.0; s <= 3.0; s += 0.3) {
        boxAt(bg, 0.045, 1.65, 0.055, bx + s, y + 2.38, 0.41, pal.walnutExec, false, false);
      }
    }
  }

  // Side wall fluted travertine wainscoting + bronze sconce rails
  [-1, 1].forEach((sd) => {
    const sx = sd * (WIDTH / 2 - 0.39);
    boxAt(bg, 0.05, 1.38, DEPTH - 1.2, sx, y + 0.69, DEPTH / 2 - 0.3, pal.flutedTravertine, false, true);
    boxAt(bg, 0.07, 0.045, DEPTH - 1.2, sx - sd * 0.01, y + 1.4, DEPTH / 2 - 0.3, pal.brushedBronze, false, false);
    // Side wall vertical walnut cove sconce frames
    [2.8, 6.2].forEach((sz) => {
      boxAt(bg, 0.06, 1.6, 0.24, sx - sd * 0.02, y + 2.35, sz, pal.walnutExec, false, false, 0.01);
      boxAt(bg, 0.03, 1.45, 0.05, sx - sd * 0.05, y + 2.35, sz, pal.warmCoveLed, false, false);
    });
  });

  // Cantilevered rear walnut cove pelmet washing warm LED light down onto the travertine wall
  boxAt(bg, WIDTH - 0.9, 0.14, 0.22, 0, ch - 0.28, 0.47, pal.walnutExec, false, false, 0.015);
  boxAt(bg, WIDTH - 1.2, 0.03, 0.08, 0, ch - 0.35, 0.45, pal.warmCoveLed, false, false);

  // Cutaway Ceiling System (parented cleanly to bc = b1Ceiling / b2Ceiling so top-down B1/B2 hides cleanly)
  boxAt(bc, WIDTH - 0.8, 0.06, DEPTH - 1.4, 0, ch - 0.08, DEPTH / 2 + 0.3, M.baseCeil, false, false);
  // Warm perimeter recessed ceiling coves
  boxAt(bc, WIDTH - 2.2, 0.03, 0.09, 0, ch - 0.11, 1.15, pal.warmCoveLed, false, false);
  boxAt(bc, WIDTH - 2.2, 0.03, 0.09, 0, ch - 0.11, 9.25, pal.warmCoveLed, false, false);
  // 5 Acoustic walnut baffle clouds with suspended brushed-bronze linear pendants
  [-20, -10, -2, 6, 16].forEach((cx) => {
    boxAt(bc, 7.6, 0.06, 5.8, cx, ch - 0.12, 4.9, pal.walnutExec, false, false, 0.02);
    for (let r = -2.2; r <= 2.2; r += 0.55) {
      boxAt(bc, 7.2, 0.08, 0.04, cx, ch - 0.18, 4.9 + r, pal.walnutExec, false, false);
    }
    addPendantFixture(bc, cx, ch - 0.48, ch - 0.12, 3.2, 4.6, pal as never, pal.brushedBronze);
    addPendantFixture(bc, cx, ch - 0.48, ch - 0.12, 6.8, 4.6, pal as never, pal.brushedBronze);
  });
}

function addArchitecturalSlatDivider(
  parent: THREE.Object3D,
  x: number,
  y: number,
  zCenter: number,
  zLen: number,
  h: number,
  pal: BasementPal
) {
  boxAt(parent, 0.12, 0.06, zLen, x, y + 0.03, zCenter, pal.brushedBronze, false, true, 0.01);
  boxAt(parent, 0.12, 0.08, zLen, x, y + h - 0.04, zCenter, pal.walnutExec, true, false, 0.01);
  const count = Math.max(4, Math.round(zLen / 0.24));
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const sz = zCenter - zLen * 0.46 + t * (zLen * 0.92);
    boxAt(parent, 0.05, h - 0.12, 0.12, x, y + h * 0.5, sz, pal.walnutExec, true, true, 0.008);
  }
}

function addBespokeWallScreen(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  mat: THREE.Material,
  pal: BasementPal
) {
  // Deep architectural walnut shadow-box + brushed bronze bezel + warm perimeter halo
  boxAt(parent, w + 0.34, h + 0.34, 0.1, x, y, z, pal.walnutExec, true, false, 0.025);
  boxAt(parent, w + 0.12, h + 0.12, 0.06, x, y, z + 0.04, pal.brushedBronze, false, false, 0.01);
  boxAt(parent, w + 0.24, 0.024, 0.025, x, y + h * 0.5 + 0.14, z + 0.06, pal.warmCoveLed, false, false);
  planeAt(parent, w, h, x, y, z + 0.075, mat);
}

function addBronzeDeskLamp(parent: THREE.Object3D, x: number, y: number, z: number, pal: BasementPal) {
  cylAt(parent, 0.09, 0.11, 0.025, x, y + 0.0125, z, pal.honedTravertine, false, true, 16);
  cylAt(parent, 0.014, 0.014, 0.44, x, y + 0.23, z - 0.02, pal.brushedBronze, false, false, 10);
  boxAt(parent, 0.52, 0.032, 0.055, x, y + 0.45, z + 0.03, pal.brushedBronze, true, false, 0.008);
  boxAt(parent, 0.46, 0.012, 0.03, x, y + 0.432, z + 0.03, pal.warmCoveLed, false, false);
}

export function buildRealEstateRedesignedBasements(ctx: BasementRealEstateContext) {
  const { basementGroup, gB1, b1Ceiling, gB2, b2Ceiling, M, screenReg, addTrackedChair, exMon } = ctx;
  const pal = createBasementPalette(M);
  const archMats = getArchitecturalMaterials(M);

  // Exterior subterranean earth berm (unchanged envelope)
  boxAt(basementGroup, 1.6, 10.4, DEPTH + 2.6, -(WIDTH / 2 + 0.9), -5.6, DEPTH / 2 - 0.2, M.earth, false, false);
  boxAt(basementGroup, 1.6, 10.4, DEPTH + 2.6, WIDTH / 2 + 0.9, -5.6, DEPTH / 2 - 0.2, M.earth, false, false);
  boxAt(basementGroup, WIDTH + 3.4, 10.4, 1.6, 0, -5.6, -1.1, M.earth, false, false);
  boxAt(basementGroup, WIDTH + 3.4, 0.8, DEPTH + 2.6, 0, -10.1, DEPTH / 2 - 0.2, M.earth, false, false);

  /* =========================================================
     B1 · THE COMPUTE SANCTUARY & NOC GALLERY (TerraCraft Redesign)
     ========================================================= */
  const b1 = BASE[0];
  const y1 = b1.y;
  const ch1 = y1 + b1.h;
  buildArchitecturalWallShell(gB1, b1Ceiling, y1, b1.h, pal, M);

  // Architectural floor zoning: Central Chevron Oak Spine & South Gallery Promenade
  boxAt(gB1, 5.2, 0.012, 5.4, -1.45, y1 + 0.022, 4.35, pal.chevronOak, false, true);
  boxAt(gB1, 50.0, 0.012, 2.35, 0, y1 + 0.022, 8.35, pal.chevronOak, false, true);
  boxAt(gB1, 50.0, 0.014, 0.05, 0, y1 + 0.023, 7.16, pal.brushedBronze, false, false);
  boxAt(gB1, 50.0, 0.014, 0.05, 0, y1 + 0.023, 9.54, pal.brushedBronze, false, false);

  // Raised Dark-Slate Server Plinths (flush top at y1 + 0.14 matching rack bases, warm under-plinth LED kick)
  [
    { cx: -8.55, w: 9.2 },
    { cx: 5.65, w: 9.2 },
  ].forEach(({ cx, w }) => {
    boxAt(gB1, w - 0.28, 0.04, 4.3, cx, y1 + 0.036, 4.35, pal.gunmetalSteel, false, false);
    boxAt(gB1, w - 0.18, 0.018, 4.42, cx, y1 + 0.026, 4.35, pal.warmCoveLed, false, false);
    boxAt(gB1, w, 0.088, 4.65, cx, y1 + 0.096, 4.35, pal.darkSlateSlab, false, true, 0.015);
    // Brushed bronze edge trim around raised gallery deck
    boxAt(gB1, w + 0.08, 0.028, 0.05, cx, y1 + 0.132, 2.02, pal.brushedBronze, false, false);
    boxAt(gB1, w + 0.08, 0.028, 0.05, cx, y1 + 0.132, 6.68, pal.brushedBronze, false, false);
  });

  // 28 Architectural Glass-Contained Server Racks (exact x/z preserved for staff waypoints & obstacles)
  for (let blk = 0; blk < 2; blk++) {
    const startX = blk ? 2.2 : -12.0;
    const bankCx = startX + 3 * 1.15;
    for (let row = 0; row < 2; row++) {
      const z = 3.1 + row * 2.5;
      for (let i = 0; i < 7; i++) {
        const x = startX + i * 1.15;
        boxAt(gB1, 0.64, 1.95, 0.92, x, y1 + 0.14 + 0.98, z, pal.gunmetalSteel, true, false, 0.03);
        planeAt(gB1, 0.56, 1.82, x, y1 + 0.14 + 0.99, z + 0.468, M.rackFace);
        // Brushed bronze cabinet stile trim & emerald/cyan rack health strip
        boxAt(gB1, 0.66, 0.04, 0.95, x, y1 + 0.14 + 1.96, z, pal.brushedBronze, false, false);
        boxAt(
          gB1,
          0.44,
          0.026,
          0.02,
          x,
          y1 + 0.14 + 1.89,
          z + 0.465,
          (i + row) % 2 === 0 ? pal.cyanBeaconLed : pal.emeraldBeaconLed,
          false,
          false
        );
      }
      // Walnut end-cheek architectural monoliths flanking each rack row
      [-0.52, 6 * 1.15 + 0.52].forEach((ox) => {
        boxAt(gB1, 0.12, 2.02, 0.96, startX + ox, y1 + 0.14 + 1.01, z, pal.walnutExec, true, true, 0.015);
      });
      // Continuous bronze top cornice spanning across the 7-rack bank
      boxAt(gB1, 7.85, 0.06, 0.98, bankCx, y1 + 0.14 + 2.01, z, pal.brushedBronze, false, false, 0.01);
    }

    // Overhead Cold-Aisle Glass Containment Canopy (open z=3.6..5.1 aisle at walk height!)
    const canopyY = y1 + 2.38;
    boxAt(gB1, 7.9, 0.035, 1.68, bankCx, canopyY, 4.35, pal.vitrineGlass, false, false);
    [-3.95, 3.95].forEach((ox) => {
      boxAt(gB1, 0.06, 0.24, 1.65, bankCx + ox, y1 + 2.26, 4.35, pal.brushedBronze, false, false);
    });
    boxAt(gB1, 7.6, 0.025, 0.1, bankCx, canopyY - 0.025, 4.35, pal.warmCoveLed, false, false);
  }

  // Architectural bronze overhead busways replacing raw industrial cable trays
  [3.1, 5.6].forEach((z) => {
    boxAt(gB1, 25.0, 0.09, 0.52, -2, ch1 - 0.62, z, pal.brushedBronze, false, false, 0.01);
    boxAt(gB1, 24.8, 0.03, 0.36, -2, ch1 - 0.56, z, pal.gunmetalSteel, false, false);
    for (let x = -13; x <= 9; x += 4) {
      cylAt(gB1, 0.022, 0.022, 0.55, x, ch1 - 0.32, z, pal.brushedBronze, false, false, 8);
    }
  });

  // 3 Rear Core Cooling & CRAC Consoles (exact x = -6.5, -2.5, 1.5, z = 1.0)
  [-6.5, -2.5, 1.5].forEach((x, i) => {
    boxAt(gB1, 1.5, 2.1, 0.9, x, y1 + 1.05, 1.0, pal.gunmetalSteel, true, false, 0.04);
    [-0.77, 0.77].forEach((ox) => {
      boxAt(gB1, 0.06, 2.12, 0.92, x + ox, y1 + 1.06, 1.0, pal.walnutExec, true, false, 0.01);
    });
    boxAt(gB1, 1.58, 0.055, 0.94, x, y1 + 2.12, 1.0, pal.brushedBronze, false, false, 0.01);
    boxAt(gB1, 1.3, 0.52, 0.04, x, y1 + 1.42, 1.46, M.dark, false, false);
    boxAt(gB1, 1.34, 0.56, 0.02, x, y1 + 1.42, 1.47, pal.vitrineGlass, false, false);
    boxAt(
      gB1,
      0.56,
      0.045,
      0.03,
      x,
      y1 + 1.98,
      1.47,
      i % 2 ? pal.emeraldBeaconLed : pal.cyanBeaconLed,
      false,
      false
    );
  });

  // Framed Architectural NOC Telemetry Display (crisp isText: true)
  const nocTex = makeCanvasTex(
    'noc',
    1024,
    512,
    (g, W2, H2) => {
      const lW = W2 / 2;
      const lH = H2 / 2;
      g.save();
      g.setTransform(2, 0, 0, 2, 0, 0);
      g.fillStyle = '#0a121c';
      g.fillRect(0, 0, lW, lH);
      g.fillStyle = '#141e2b';
      g.fillRect(0, 0, lW, 38);
      g.fillStyle = '#d4aa62';
      g.fillRect(0, 36, lW, 2);
      g.fillStyle = '#f8fafc';
      g.font = '700 15px "Plus Jakarta Sans",system-ui,sans-serif';
      g.fillText('DOMAINTECHHUB · B1 COMPUTE SANCTUARY & NOC TELEMETRY', 18, 23);
      g.strokeStyle = 'rgba(111,227,161,0.38)';
      g.lineWidth = 1.8;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 2; j++) {
          const rx = 18 + i * 121;
          const ry = 50 + j * 86;
          rr(g, rx, ry, 108, 76, 6);
          g.stroke();
          g.fillStyle = 'rgba(111,227,161,0.85)';
          for (let k = 0; k < 7; k++) {
            g.fillRect(rx + 12 + k * 13, ry + 14 + (k % 3) * 14, 7, 28 + k * 2);
          }
        }
      }
      g.fillStyle = '#bae6fd';
      g.font = '700 20px "IBM Plex Mono",monospace';
      g.fillText('CORE · 42 NODES · 18.4 TB/s · PUE 1.18', 18, lH - 16);
      g.restore();
    },
    true,
    true
  );
  addBespokeWallScreen(
    gB1,
    -4.8,
    ch1 - 1.12,
    0.45,
    6.2,
    1.85,
    new THREE.MeshBasicMaterial({ map: nocTex, toneMapped: false }),
    pal
  );
  planeAt(
    gB1,
    4.2,
    0.92,
    5.0,
    ch1 - 0.72,
    0.46,
    new THREE.MeshBasicMaterial({ map: svcSignTex('b1sign', 'SERVER ROOM', b1.sub), transparent: true, toneMapped: false })
  );

  // Architectural FM-200 Clean-Agent Suppression Alcove (exact cylinder positions -12.9, -12.3, z=7.8; east side open)
  boxAt(gB1, 1.55, 0.08, 1.0, -12.6, y1 + 0.04, 7.8, pal.honedTravertine, false, true, 0.015);
  boxAt(gB1, 1.58, 0.02, 1.03, -12.6, y1 + 0.085, 7.8, pal.brushedBronze, false, false);
  [-12.9, -12.3].forEach((x) => {
    cylAt(gB1, 0.17, 0.17, 1.4, x, y1 + 0.74, 7.8, pal.crimsonMatte, true, false, 16);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10), pal.crimsonMatte);
    cap.position.set(x, y1 + 1.44, 7.8);
    gB1.add(cap);
    cylAt(gB1, 0.185, 0.185, 0.04, x, y1 + 1.12, 7.8, pal.brushedBronze, false, false, 16);
    cylAt(gB1, 0.05, 0.05, 0.2, x, y1 + 1.62, 7.8, pal.brushedBronze, false, false, 10);
  });
  boxAt(gB1, 1.05, 0.05, 0.06, -12.6, y1 + 1.72, 7.8, pal.copperBusbar, false, false);
  // Open-east bronze & glass guard enclosure around FM-200 cylinders
  boxAt(gB1, 0.05, 1.85, 1.02, -13.38, y1 + 0.92, 7.8, pal.vitrineGlass, false, false);
  boxAt(gB1, 1.42, 1.85, 0.05, -12.68, y1 + 0.92, 7.3, pal.vitrineGlass, false, false);
  boxAt(gB1, 1.42, 1.85, 0.05, -12.68, y1 + 0.92, 8.3, pal.vitrineGlass, false, false);
  [
    [-13.38, 7.3],
    [-13.38, 8.3],
    [-11.98, 7.3],
    [-11.98, 8.3],
  ].forEach(([px, pz]) => {
    boxAt(gB1, 0.045, 1.88, 0.045, px, y1 + 0.94, pz, pal.brushedBronze, false, false);
  });

  // B1 West Wing: Subterranean NOC Briefing & Infrastructure Lounge (x = -24.5 .. -14.8)
  addArchitecturalSlatDivider(gB1, -14.8, y1, 3.2, 4.4, 3.1, pal);
  boxAt(gB1, 7.4, 0.014, 5.2, -19.8, y1 + 0.024, 4.6, pal.wovenTaupeRug, false, true, 0.01);
  // Honed Travertine Circular Briefing Table + Walnut Pedestal
  cylAt(gB1, 1.18, 1.18, 0.06, -19.8, y1 + 0.74, 4.6, pal.honedTravertine, true, true, 28);
  cylAt(gB1, 0.44, 0.52, 0.7, -19.8, y1 + 0.35, 4.6, pal.walnutExec, true, true, 20);
  cylAt(gB1, 0.56, 0.58, 0.03, -19.8, y1 + 0.03, 4.6, pal.brushedBronze, false, true, 20);
  [
    [-1.45, -1.05, Math.PI * 0.25, pal.mustardBoucle],
    [1.45, -1.05, -Math.PI * 0.25, pal.emeraldVelvet],
    [-1.45, 1.05, Math.PI * 0.75, pal.emeraldVelvet],
    [1.45, 1.05, -Math.PI * 0.75, pal.mustardBoucle],
  ].forEach(([ox, oz, rot, mat]) => {
    const ch = armchair(gB1, -19.8 + (ox as number), y1, 4.6 + (oz as number), rot as number, mat as THREE.Material, M);
    ch.scale.set(0.78, 0.88, 0.78);
  });
  // Rear Credenza, Shelf & Architectural Wall Display (centered inside bays, clear of pilasters)
  boxAt(gB1, 3.6, 0.84, 0.56, -17.4, y1 + 0.42, 0.88, pal.walnutExec, true, true, 0.02);
  boxAt(gB1, 3.68, 0.045, 0.6, -17.4, y1 + 0.86, 0.88, pal.honedTravertine, false, true, 0.01);
  shelfUnit(gB1, -23.5, y1, 0.88, 1.8, M);
  const b1StudioBoard = createCustomBoardScreen(screenReg, 640, 260, (g, w, h) => {
    g.fillStyle = '#121923';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d4aa62';
    g.fillRect(0, 0, w, 6);
    g.fillStyle = '#f8fafc';
    g.font = '700 22px "Plus Jakarta Sans",sans-serif';
    g.fillText('TERRACRAFT INTERIORS · B1 COMPUTE GALLERY', 22, 42);
    g.fillStyle = '#94a3b8';
    g.font = '500 15px "IBM Plex Mono",monospace';
    g.fillText('FLUTED TRAVERTINE · WALNUT ACOUSTIC BAFFLES · GLASS COLD AISLE', 22, 72);
    g.fillStyle = '#243242';
    rr(g, 22, 94, 280, 140, 8);
    g.fill();
    g.fillStyle = '#38bdf8';
    g.fillRect(42, 120, 96, 86);
    g.fillStyle = '#6fe3a1';
    g.fillRect(156, 120, 126, 86);
    g.fillStyle = '#e2e8f0';
    g.font = '600 16px "Plus Jakarta Sans",sans-serif';
    g.fillText('HOT/COLD CONTAINMENT: ACTIVE', 326, 128);
    g.fillText('SUBTERRANEAN TEMP: 19.2 °C', 326, 162);
    g.fillStyle = '#d4aa62';
    g.fillText('ACOUSTIC RATING: NRC 0.85', 326, 196);
  });
  addBespokeWallScreen(gB1, -17.4, y1 + 2.25, 0.45, 3.6, 1.5, b1StudioBoard.mat, pal);
  addRealEstatePlaque(gB1, 'B1 · COMPUTE GALLERY', -26.2, y1 + 2.45, 0.46, 0);
  buildPlanterTrough(gB1, -21.6, y1, 0.92, 2.2, 0, 101, archMats);
  plant(gB1, -24.4, y1, 6.2, 1.15, 201, M, 'monst');
  plant(gB1, -15.4, y1, 6.4, 0.95, 202, M, 'olive');

  // B1 East Wing: Client Viewing Gallery & Acoustic Pod (x = 12.6 .. 23.6)
  boxAt(gB1, 8.2, 0.014, 5.4, 17.8, y1 + 0.024, 4.4, pal.slateCarpet, false, true, 0.01);
  boxAt(gB1, 8.28, 0.016, 0.05, 17.8, y1 + 0.024, 1.68, pal.brushedBronze, false, false);
  boxAt(gB1, 8.28, 0.016, 0.05, 17.8, y1 + 0.024, 7.12, pal.brushedBronze, false, false);
  addArchitecturalSlatDivider(gB1, 13.0, y1, 3.2, 4.4, 3.1, pal);
  // Honed Travertine Standing Briefing Island + Walnut Fluted Base + Brass Footrail
  boxAt(gB1, 3.4, 0.96, 1.05, 17.6, y1 + 0.48, 4.4, pal.walnutExec, true, true, 0.03);
  boxAt(gB1, 3.56, 0.06, 1.2, 17.6, y1 + 0.99, 4.4, pal.honedTravertine, true, true, 0.018);
  cylAt(gB1, 0.018, 0.018, 3.3, 17.6, y1 + 0.22, 5.02, pal.brushedBronze, false, false, 10).rotation.z = Math.PI / 2;
  addBronzeDeskLamp(gB1, 18.8, y1 + 1.02, 4.3, pal);
  [16.8, 18.4].forEach((sx) => officeChair(gB1, sx, y1, 5.45, Math.PI, M));
  shelfUnit(gB1, 21.8, y1, 0.88, 1.8, M);
  boxAt(gB1, 3.2, 0.84, 0.56, 16.4, y1 + 0.42, 0.88, pal.walnutExec, true, true, 0.02);
  boxAt(gB1, 3.28, 0.045, 0.6, 16.4, y1 + 0.86, 0.88, pal.honedTravertine, false, true, 0.01);
  addRealEstatePlaque(gB1, 'TERRACRAFT · VIEWING BAY', 16.4, y1 + 2.45, 0.46, 0);
  buildPlanterTrough(gB1, 21.8, y1, 6.4, 2.4, 0, 103, archMats);
  plant(gB1, 13.8, y1, 6.4, 0.95, 205, M, 'ficus');

  /* =========================================================
     B2 · THE MICROGRID ATELIER & ENERGY VAULT (TerraCraft Redesign)
     ========================================================= */
  const b2 = BASE[1];
  const y2 = b2.y;
  const ch2 = y2 + b2.h;
  buildArchitecturalWallShell(gB2, b2Ceiling, y2, b2.h, pal, M);

  // Flooring inlays: Chevron Oak under Workstation & West Lounge; Dark Slate Plinths under Battery & Switchgear
  boxAt(gB2, 4.6, 0.012, 3.3, 4.5, y2 + 0.022, 5.9, pal.chevronOak, false, true);
  boxAt(gB2, 8.2, 0.012, 5.4, -19.2, y2 + 0.022, 4.6, pal.chevronOak, false, true);
  boxAt(gB2, 7.6, 0.016, 5.3, -3.7, y2 + 0.024, 6.8, pal.darkSlateSlab, false, true, 0.01);
  boxAt(gB2, 16.0, 0.016, 1.35, -2.7, y2 + 0.024, 1.02, pal.darkSlateSlab, false, true, 0.01);
  boxAt(gB2, 3.2, 0.016, 2.2, 9.2, y2 + 0.024, 3.4, pal.darkSlateSlab, false, true, 0.01);

  // Subtle architectural amber & bronze floor promenade inlay lines (replacing stark industrial tape)
  boxAt(gB2, 38.0, 0.008, 0.075, 0, y2 + 0.02, 9.52, pal.amberInlay, false, false);
  boxAt(gB2, 38.0, 0.008, 0.045, 0, y2 + 0.02, 7.65, pal.brushedBronze, false, false);

  // 6 Switchgear / Microgrid Breaker Cabinets (exact x = -9.6 + i*1.35, z = 1.02)
  for (let i = 0; i < 6; i++) {
    const x = -9.6 + i * 1.35;
    boxAt(gB2, 1.2, 2.2, 0.82, x, y2 + 1.12, 1.02, pal.gunmetalSteel, true, false, 0.04);
    [-0.61, 0.61].forEach((ox) => {
      boxAt(gB2, 0.05, 2.22, 0.84, x + ox, y2 + 1.13, 1.02, pal.walnutExec, false, false, 0.01);
    });
    boxAt(gB2, 1.26, 0.05, 0.86, x, y2 + 2.24, 1.02, pal.brushedBronze, false, false);
    boxAt(gB2, 0.86, 0.34, 0.03, x, y2 + 1.56, 1.44, M.dark, false, false);
    boxAt(gB2, 0.9, 0.38, 0.02, x, y2 + 1.56, 1.45, pal.vitrineGlass, false, false);
    boxAt(gB2, 0.08, 0.04, 0.03, x - 0.3, y2 + 1.82, 1.45, pal.emeraldBeaconLed, false, false);
    boxAt(gB2, 0.08, 0.04, 0.03, x + 0.3, y2 + 1.82, 1.45, pal.amberBeaconLed, false, false);
  }

  // 3 Solar Inverter Monoliths with crisp high-res telemetry screens (exact x = 1.4 + i*1.4, z = 1.02)
  const invTex = makeCanvasTex(
    'inv',
    512,
    256,
    (g, W2, H2) => {
      const lW = W2 / 2;
      const lH = H2 / 2;
      g.save();
      g.setTransform(2, 0, 0, 2, 0, 0);
      g.fillStyle = '#0a1016';
      g.fillRect(0, 0, lW, lH);
      g.fillStyle = '#79e6a6';
      g.font = '700 30px "Plus Jakarta Sans",sans-serif';
      g.fillText('PV 18.4 kW', 18, 42);
      g.fillStyle = '#bae6fd';
      g.font = '600 22px "IBM Plex Mono",monospace';
      g.fillText('AC 17.9 kW · 98%', 18, 80);
      g.fillStyle = '#ffb14a';
      g.fillText('GRID 0 · ISLAND READY', 18, 110);
      g.restore();
    },
    true,
    true
  );
  for (let i = 0; i < 3; i++) {
    const x = 1.4 + i * 1.4;
    boxAt(gB2, 1.24, 2.0, 0.72, x, y2 + 1.02, 1.02, pal.gunmetalSteel, true, false, 0.04);
    [-0.63, 0.63].forEach((ox) => {
      boxAt(gB2, 0.05, 2.02, 0.74, x + ox, y2 + 1.03, 1.02, pal.walnutExec, false, false, 0.01);
    });
    boxAt(gB2, 1.3, 0.05, 0.76, x, y2 + 2.04, 1.02, pal.brushedBronze, false, false);
    boxAt(gB2, 0.74, 0.4, 0.03, x, y2 + 1.36, 1.39, pal.brushedBronze, false, false);
    planeAt(gB2, 0.66, 0.33, x, y2 + 1.36, 1.41, new THREE.MeshBasicMaterial({ map: invTex, toneMapped: false }));
    boxAt(gB2, 0.9, 0.06, 0.03, x, y2 + 1.82, 1.39, pal.amberInlay, false, false);
  }

  // Bespoke Architectural Microgrid Wall Schematic above Solar Inverters
  const microgridScreen = createCustomBoardScreen(screenReg, 768, 220, (g, w, h, t) => {
    g.fillStyle = '#0c141d';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d4aa62';
    g.fillRect(0, 0, w, 5);
    g.fillStyle = '#f8fafc';
    g.font = '700 20px "Plus Jakarta Sans",sans-serif';
    g.fillText('B2 · SOLAR MICROGRID & LiFePO4 STORAGE ARCHITECTURE', 24, 38);
    const blocks = [
      { label: 'ROOFTOP PV', val: '18.4 kW', col: '#38bdf8', x: 24 },
      { label: 'HYBRID INVERTERS', val: '98.2% EFF', col: '#d4aa62', x: 212 },
      { label: 'LiFePO4 VAULT', val: '94% SOC', col: '#4ade80', x: 400 },
      { label: 'HV TRANSFORMER', val: '11 kV / 415 V', col: '#f59e0b', x: 588 },
    ];
    blocks.forEach((b, idx) => {
      g.fillStyle = '#172230';
      rr(g, b.x, 66, 156, 118, 8);
      g.fill();
      g.strokeStyle = b.col;
      g.lineWidth = 2;
      rr(g, b.x, 66, 156, 118, 8);
      g.stroke();
      g.fillStyle = '#cbd5e1';
      g.font = '600 13px "Plus Jakarta Sans",sans-serif';
      g.fillText(b.label, b.x + 14, 96);
      g.fillStyle = b.col;
      g.font = '700 20px "IBM Plex Mono",monospace';
      g.fillText(b.val, b.x + 14, 138);
      if (idx < blocks.length - 1) {
        const pulse = 0.45 + 0.55 * Math.sin(t * 2.8 - idx * 0.9);
        g.fillStyle = `rgba(212,170,98,${pulse.toFixed(2)})`;
        g.fillRect(b.x + 162, 122, 22, 6);
      }
    });
  });
  addBespokeWallScreen(gB2, -5.0, ch2 - 0.98, 0.45, 7.2, 1.45, microgridScreen.mat, pal);

  // 15 Architectural LiFePO4 Battery Racks (exact x = -6.4 + i*1.35, z = 4.9, 6.9, 8.7)
  [4.9, 6.9, 8.7].forEach((z) => {
    for (let i = 0; i < 5; i++) {
      const x = -6.4 + i * 1.35;
      boxAt(gB2, 0.78, 1.8, 0.82, x, y2 + 0.92, z, pal.gunmetalSteel, true, false, 0.03);
      [-0.4, 0.4].forEach((ox) => {
        boxAt(gB2, 0.04, 1.82, 0.84, x + ox, y2 + 0.93, z, pal.walnutExec, false, false, 0.008);
      });
      boxAt(gB2, 0.84, 0.04, 0.86, x, y2 + 1.84, z, pal.brushedBronze, false, false);
      planeAt(gB2, 0.62, 1.46, x, y2 + 0.88, z + 0.418, pal.vitrineGlass);
      boxAt(gB2, 0.54, 0.05, 0.03, x, y2 + 1.56, z + 0.425, pal.emeraldBeaconLed, false, false);
    }
    // Continuous copper & bronze busbar bridge above each battery row
    boxAt(gB2, 6.3, 0.05, 0.16, -3.7, y2 + 1.9, z, pal.copperBusbar, false, false);
  });

  // Redesigned Rolling Service Console Trolley (centered cleanly at 2.2, 8.9 matching obstacles.ts)
  boxAt(gB2, 1.5, 0.68, 0.7, 2.2, y2 + 0.5, 8.9, pal.gunmetalSteel, true, false, 0.035);
  boxAt(gB2, 1.54, 0.045, 0.74, 2.2, y2 + 0.86, 8.9, pal.walnutExec, true, true, 0.012);
  boxAt(gB2, 0.38, 0.03, 0.26, 2.05, y2 + 0.9, 8.9, pal.brushedBronze, false, false, 0.008);
  boxAt(gB2, 0.34, 0.02, 0.22, 2.05, y2 + 0.918, 8.9, pal.cyanBeaconLed, false, false);
  [
    [-0.6, -0.26],
    [-0.6, 0.26],
    [0.6, -0.26],
    [0.6, 0.26],
  ].forEach(([ox, oz]) => {
    cylAt(gB2, 0.06, 0.06, 0.16, 2.2 + ox, y2 + 0.08, 8.9 + oz, pal.brushedBronze, false, false, 10);
  });

  // Glazed HV Transformer Acoustic Gallery Bay (exact center x = 9.2, z = 3.4; west & south clear for staff)
  boxAt(gB2, 2.4, 1.9, 1.5, 9.2, y2 + 0.97, 3.4, pal.txSageSteel, true, false, 0.06);
  for (let i = 0; i < 8; i++) {
    boxAt(gB2, 0.05, 1.3, 0.06, 8.15 + i * 0.16, y2 + 0.97, 4.16, pal.brushedBronze, false, false, 0.01);
  }
  boxAt(gB2, 2.5, 0.12, 1.6, 9.2, y2 + 1.98, 3.4, pal.gunmetalSteel, false, false, 0.03);
  [-0.55, 0, 0.55].forEach((ox) => {
    cylAt(gB2, 0.06, 0.08, 0.36, 9.2 + ox, y2 + 2.17, 3.4, M.ceramicMat, false, false, 12);
  });
  // Architectural bronze & vitrine glass gallery guard on north & east flanks
  boxAt(gB2, 2.86, 2.1, 0.05, 9.2, y2 + 1.07, 2.52, pal.vitrineGlass, false, false);
  boxAt(gB2, 0.05, 2.1, 1.88, 10.62, y2 + 1.07, 3.46, pal.vitrineGlass, false, false);
  [
    [7.78, 2.52],
    [10.62, 2.52],
    [10.62, 4.4],
  ].forEach(([px, pz]) => {
    boxAt(gB2, 0.05, 2.18, 0.05, px, y2 + 1.11, pz, pal.brushedBronze, false, false);
  });

  // Redesigned Power & Battery Analytics Executive Desk (exact dx = 4.5, dz = 5.65, seats 3.7 & 5.3, z = 6.42)
  {
    const dx = 4.5;
    const dz = 5.65;
    // Honed travertine desktop (top at y2 + 0.80) with walnut waterfall edge & bronze architectural legs
    boxAt(gB2, 3.24, 0.045, 1.05, dx, y2 + 0.778, dz, pal.honedTravertine, true, true, 0.014);
    boxAt(gB2, 3.26, 0.025, 1.07, dx, y2 + 0.75, dz, pal.walnutExec, false, true, 0.01);
    [-1.48, 1.48].forEach((lx) => {
      boxAt(gB2, 0.055, 0.74, 0.055, dx + lx, y2 + 0.37, dz - 0.42, pal.brushedBronze, true, false, 0.008);
      boxAt(gB2, 0.055, 0.74, 0.055, dx + lx, y2 + 0.37, dz + 0.42, pal.brushedBronze, true, false, 0.008);
      boxAt(gB2, 0.055, 0.04, 0.9, dx + lx, y2 + 0.73, dz, pal.brushedBronze, false, false, 0.008);
      boxAt(gB2, 0.05, 0.035, 0.88, dx + lx, y2 + 0.035, dz, pal.brushedBronze, false, false, 0.008);
    });
    // Sage acoustic modesty screen + walnut drawer pedestal
    boxAt(gB2, 3.05, 0.42, 0.035, dx, y2 + 0.54, dz - 0.48, pal.sageAcoustic, true, true, 0.008);
    boxAt(gB2, 3.08, 0.024, 0.04, dx, y2 + 0.76, dz - 0.48, pal.brushedBronze, false, false, 0.005);
    boxAt(gB2, 0.46, 0.56, 0.54, dx, y2 + 0.3, dz + 0.14, pal.walnutExec, true, true, 0.015);
    boxAt(gB2, 0.48, 0.03, 0.56, dx, y2 + 0.58, dz + 0.14, pal.brushedBronze, false, false);
    // Centered diagnostic oscilloscope & brass architectural desk lamp
    boxAt(gB2, 0.34, 0.2, 0.18, dx, y2 + 0.9, dz - 0.2, pal.gunmetalSteel, true, false, 0.012);
    boxAt(gB2, 0.2, 0.12, 0.015, dx - 0.04, y2 + 0.91, dz - 0.105, pal.cyanBeaconLed, false, false);
    boxAt(gB2, 0.04, 0.04, 0.02, dx + 0.11, y2 + 0.94, dz - 0.105, pal.emeraldBeaconLed, false, false);
    addBronzeDeskLamp(gB2, dx, y2 + 0.8, dz + 0.22, pal);

    // Dual tracked ergonomic chairs + clickable Power & Battery SCADA monitors (preserved exact contract!)
    [
      { sx: 3.7, role: 'Senior High-Voltage Power Lead', task: 'Analyzing solar PV generation, HV transformer load & switchgear curves', sw: 1 },
      { sx: 5.3, role: 'Junior Battery & Storage Tech', task: 'Logging LiFePO4 battery row cell balance & inverter efficiency', sw: -1 },
    ].forEach((seat, k) => {
      addTrackedChair(gB2, seat.sx, y2, 6.42, Math.PI, -2, 1, 0.45, seat.sw);
      exMon(gB2, seat.sx, y2 + 0.8, dz - 0.18, 0, 'power', k, {
        lv: -2,
        zone: 'Power Room',
        role: seat.role,
        color: '#ffb14a',
        seatX: seat.sx,
        seatZ: 6.42,
        screenTask: seat.task,
      });
    });

    // Overhead linear bronze pendant over the B2 analytics desk (parented to b2Ceiling!)
    addPendantFixture(b2Ceiling, dx, ch2 - 0.54, ch2 - 0.12, dz, 3.2, pal as never, pal.brushedBronze);
  }

  // Exposed Copper Conduit Riser Feature Chase (exact center x = 18, z = 0.5) & Overhead Bronze Busway
  boxAt(gB2, 0.72, b2.h - 0.2, 0.18, 18, y2 + (b2.h - 0.2) / 2, 0.44, pal.walnutExec, false, true);
  cylAt(gB2, 0.14, 0.14, b2.h, 18, y2 + b2.h / 2, 0.5, pal.copperBusbar, true, false, 14);
  [1.0, 2.2, 3.4].forEach((hy) => {
    cylAt(gB2, 0.17, 0.17, 0.06, 18, y2 + hy, 0.5, pal.brushedBronze, false, false, 14);
  });
  boxAt(gB2, 0.55, 0.42, 0.24, 18, y2 + 3.5, 0.62, pal.gunmetalSteel, false, false, 0.03);
  boxAt(gB2, 12.5, 0.12, 0.42, 11.4, ch2 - 0.72, 0.75, pal.brushedBronze, false, false);
  for (let x = 6; x <= 17; x += 3.7) {
    cylAt(gB2, 0.025, 0.025, 0.5, x, ch2 - 0.45, 0.75, pal.brushedBronze, false, false, 8);
  }
  planeAt(
    gB2,
    4.4,
    0.96,
    5.0,
    ch2 - 0.78,
    0.46,
    new THREE.MeshBasicMaterial({ map: svcSignTex('b2sign', 'POWER ROOM', b2.sub, '#ffb14a'), transparent: true, toneMapped: false })
  );

  // B2 West Wing: Chief Engineer Energy Lounge & Material Archive (x = -24.5 .. -12.6)
  addArchitecturalSlatDivider(gB2, -12.6, y2, 3.2, 4.4, 3.0, pal);
  boxAt(gB2, 7.2, 0.014, 4.8, -19.2, y2 + 0.026, 4.6, pal.woolCharcoalRug, false, true, 0.01);
  // Honed Travertine Briefing Table + Sculpted Bronze Twin Pedestals
  boxAt(gB2, 3.1, 0.06, 1.32, -19.2, y2 + 0.74, 4.6, pal.honedTravertine, true, true, 0.025);
  [-0.95, 0.95].forEach((ox) => {
    cylAt(gB2, 0.18, 0.26, 0.7, -19.2 + ox, y2 + 0.35, 4.6, pal.brushedBronze, true, true, 18);
  });
  [
    [-0.9, -1.15, 0, pal.tealLinen],
    [0.9, -1.15, 0, pal.coralBoucle],
    [-0.9, 1.15, Math.PI, pal.coralBoucle],
    [0.9, 1.15, Math.PI, pal.tealLinen],
  ].forEach(([ox, oz, rot, mat]) => {
    const ch = armchair(gB2, -19.2 + (ox as number), y2, 4.6 + (oz as number), rot as number, mat as THREE.Material, M);
    ch.scale.set(0.76, 0.88, 0.76);
  });
  // Illuminated Solar-Cell & Battery Specimen Vitrine against North Wall
  boxAt(gB2, 3.2, 0.78, 0.72, -18.8, y2 + 0.39, 0.92, pal.walnutExec, true, true, 0.025);
  boxAt(gB2, 3.0, 0.62, 0.56, -18.8, y2 + 1.09, 0.92, pal.vitrineGlass, false, false);
  boxAt(gB2, 3.04, 0.035, 0.58, -18.8, y2 + 1.4, 0.92, pal.brushedBronze, false, false);
  boxAt(gB2, 2.8, 0.025, 0.4, -18.8, y2 + 1.38, 0.92, pal.warmCoveLed, false, false);
  // Miniature solar cell wafer & cylindrical lithium cell specimen inside vitrine
  boxAt(gB2, 0.9, 0.04, 0.38, -19.4, y2 + 0.82, 0.92, M.pv, false, false);
  for (let c = 0; c < 4; c++) {
    cylAt(gB2, 0.06, 0.06, 0.24, -18.25 + c * 0.18, y2 + 0.92, 0.92, pal.copperBusbar, false, false, 12);
  }
  shelfUnit(gB2, -23.2, y2, 0.88, 1.8, M);
  addRealEstatePlaque(gB2, 'B2 · ENERGY VAULT', -14.5, y2 + 2.45, 0.46, 0);
  buildPlanterTrough(gB2, -15.4, y2, 0.92, 2.2, 0, 108, archMats);
  plant(gB2, -24.2, y2, 6.2, 1.15, 211, M, 'monst');
  plant(gB2, -14.2, y2, 6.4, 0.95, 212, M, 'olive');

  // B2 East Wing: PPE Calibration Gallery & Viewing Alcove (x = 13.4 .. 23.6)
  addArchitecturalSlatDivider(gB2, 13.4, y2, 3.2, 4.4, 3.0, pal);
  boxAt(gB2, 2.8, 0.88, 0.62, 15.6, y2 + 0.44, 0.9, pal.walnutExec, true, true, 0.02);
  boxAt(gB2, 2.86, 0.045, 0.66, 15.6, y2 + 0.9, 0.9, pal.honedTravertine, false, true, 0.01);
  addRealEstatePlaque(gB2, 'TERRACRAFT · MICROGRID', 15.6, y2 + 2.45, 0.46, 0);
  boxAt(gB2, 6.8, 0.014, 4.6, 18.8, y2 + 0.024, 4.8, pal.slateCarpet, false, true, 0.01);
  boxAt(gB2, 2.6, 0.44, 0.88, 19.6, y2 + 0.22, 4.8, pal.tealLinen, true, true, 0.03);
  boxAt(gB2, 2.68, 0.08, 0.94, 19.6, y2 + 0.06, 4.8, pal.walnutExec, false, true, 0.015);
  buildPlanterTrough(gB2, 21.8, y2, 6.4, 2.4, 0, 112, archMats);
  plant(gB2, 14.2, y2, 6.4, 0.95, 215, M, 'ficus');

  /* =========================================================
     REDESIGNED GLAZED TRAVERTINE & BRONZE LIFT SECURITY VESTIBULES
     ========================================================= */
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
        boxAt(bg, run, 1.0, 0.12, midX, y + 0.5, LANE + q * 0.96, pal.flutedTravertine, true, true, 0.02);
        boxAt(bg, run + 0.04, 0.05, 0.16, midX, y + 1.01, LANE + q * 0.96, pal.brushedBronze, false, false, 0.01);
        boxAt(bg, run, 1.4, 0.05, midX, y + 1.72, LANE + q * 0.96, pal.vitrineGlass, false, false);
        boxAt(bg, run, 0.09, 0.16, midX, y + 2.44, LANE + q * 0.96, pal.walnutExec, false, false, 0.02);
      });
      // Architectural bronze door jambs & header
      boxAt(bg, 0.16, 2.42, 0.13, x1, y + 1.21, LANE - 0.67, pal.brushedBronze, true, false, 0.02);
      boxAt(bg, 0.16, 2.42, 0.13, x1, y + 1.21, LANE + 0.67, pal.brushedBronze, true, false, 0.02);
      boxAt(bg, 0.16, 0.14, 1.47, x1, y + 2.4, LANE, pal.walnutExec, true, false, 0.02);
      [-1, 1].forEach((q) => {
        boxAt(bg, 0.05, 2.26, 0.6, x1, y + 1.16, LANE + q * 0.3, pal.vitrineGlass, false, false);
        boxAt(bg, 0.07, 2.26, 0.05, x1, y + 1.16, LANE + q * 0.61, pal.brushedBronze, false, false);
      });
      // Sculpted bronze & walnut biometric access reader
      boxAt(bg, 0.07, 0.28, 0.14, x1 + dir * 0.12, y + 1.32, LANE + 0.82, pal.walnutExec, false, false, 0.015);
      boxAt(bg, 0.03, 0.08, 0.06, x1 + dir * 0.16, y + 1.38, LANE + 0.82, pal.emeraldBeaconLed, false, false);
      // Warm backlit arrival header & chevron oak lobby threshold
      boxAt(bg, 0.14, 0.3, 2.08, x0, y + 2.62, LANE, pal.walnutExec, false, false);
      boxAt(bg, 0.06, 0.04, 1.9, x1 + dir * 0.06, y + 2.52, LANE, pal.warmCoveLed, false, false);
      boxAt(bg, run - 0.2, 0.03, 1.78, midX, y + 0.022, LANE, pal.chevronOak, false, true);
    });
  });
}
