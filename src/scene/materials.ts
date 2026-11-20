import * as THREE from 'three';
import { buildCoreTextures } from './textures';

export interface MaterialLibrary {
  textures: ReturnType<typeof buildCoreTextures>;
  marble: THREE.MeshPhysicalMaterial;
  concrete: THREE.MeshStandardMaterial;
  slab: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  bayFloor: THREE.MeshPhysicalMaterial;
  softCeil: THREE.MeshStandardMaterial;
  fascia: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  metal: THREE.MeshPhysicalMaterial;
  brass: THREE.MeshPhysicalMaterial;
  wood: THREE.MeshStandardMaterial;
  walnut: THREE.MeshPhysicalMaterial;
  parquet: THREE.MeshPhysicalMaterial;
  slat: THREE.MeshStandardMaterial;
  moss: THREE.MeshStandardMaterial;
  slate: THREE.MeshPhysicalMaterial;
  execCarpet: THREE.MeshPhysicalMaterial;
  pot: THREE.MeshStandardMaterial;
  fabricBlue: THREE.MeshPhysicalMaterial;
  fabricGrey: THREE.MeshPhysicalMaterial;
  fabricCognac: THREE.MeshPhysicalMaterial;
  black: THREE.MeshStandardMaterial;
  rug: THREE.MeshPhysicalMaterial;
  earth: THREE.MeshStandardMaterial;
  rackBody: THREE.MeshStandardMaterial;
  rackFace: THREE.MeshStandardMaterial;
  cabinet: THREE.MeshStandardMaterial;
  conduit: THREE.MeshStandardMaterial;
  tray: THREE.MeshStandardMaterial;
  warn: THREE.MeshStandardMaterial;
  pv: THREE.MeshPhysicalMaterial;
  pvFrame: THREE.MeshPhysicalMaterial;
  raised: THREE.MeshStandardMaterial;
  baseWall: THREE.MeshStandardMaterial;
  baseCeil: THREE.MeshStandardMaterial;
  baseSlab: THREE.MeshStandardMaterial;
  liftFloor: THREE.MeshPhysicalMaterial;
  ledGreen: THREE.MeshBasicMaterial;
  ledRed: THREE.MeshBasicMaterial;
  ledAmber: THREE.MeshBasicMaterial;
  ledCyan: THREE.MeshBasicMaterial;
  paint: THREE.MeshStandardMaterial;
  roofDeck: THREE.MeshStandardMaterial;
  asphalt: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  screen: THREE.MeshStandardMaterial;
  screenWarm: THREE.MeshStandardMaterial;
  lamp: THREE.MeshBasicMaterial;
  ledWarm: THREE.MeshBasicMaterial;
  ledCool: THREE.MeshBasicMaterial;
  bark: THREE.MeshStandardMaterial;
  barkDark: THREE.MeshStandardMaterial;
  leatherMat: THREE.MeshPhysicalMaterial;
  ceramicMat: THREE.MeshPhysicalMaterial;
  acousticFelt: THREE.MeshPhysicalMaterial;
  oakDesk: THREE.MeshPhysicalMaterial;
  chrome: THREE.MeshPhysicalMaterial;
  meshFabric: THREE.MeshPhysicalMaterial;
  kbMat: THREE.MeshStandardMaterial;
}

export function createMaterials(): MaterialLibrary {
  const T = buildCoreTextures();

  const slabTex = T.concreteTex.clone();
  slabTex.needsUpdate = true;
  slabTex.repeat.set(10, 3);

  const slabNorm = T.concreteNormal.clone();
  slabNorm.needsUpdate = true;
  slabNorm.repeat.set(10, 3);

  const slabRough = T.roughTex.clone();
  slabRough.needsUpdate = true;
  slabRough.repeat.set(10, 3);

  const walnutTex = T.woodTex.clone();
  walnutTex.needsUpdate = true;
  walnutTex.repeat.set(3, 2);

  const parquetMap = T.parquetTex.clone();
  parquetMap.needsUpdate = true;
  parquetMap.repeat.set(10, 3);

  const parquetNorm = T.parquetNormal.clone();
  parquetNorm.needsUpdate = true;
  parquetNorm.repeat.set(10, 3);

  const parquetRough = T.parquetRoughness.clone();
  parquetRough.needsUpdate = true;
  parquetRough.repeat.set(10, 3);

  const whitePlasterNorm = T.plasterNormal.clone();
  whitePlasterNorm.needsUpdate = true;
  whitePlasterNorm.repeat.set(2, 2);

  const whitePlasterRough = T.plasterRoughness.clone();
  whitePlasterRough.needsUpdate = true;
  whitePlasterRough.repeat.set(2, 2);

  return {
    textures: T,
    marble: new THREE.MeshPhysicalMaterial({
      map: T.marbleTex,
      normalMap: T.marbleNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: T.marbleRoughness,
      color: 0xe6e0d6,
      roughness: 0.58,
      metalness: 0.0,
      clearcoat: 0.06,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.25,
    }),
    concrete: new THREE.MeshStandardMaterial({
      map: T.concreteTex,
      normalMap: T.concreteNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: T.roughTex,
      color: 0xd0ccc3,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.16,
    }),
    slab: new THREE.MeshStandardMaterial({
      map: slabTex,
      normalMap: slabNorm,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughnessMap: slabRough,
      color: 0x948e83,
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0.16,
    }),
    white: new THREE.MeshStandardMaterial({
      normalMap: whitePlasterNorm,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: whitePlasterRough,
      color: 0xded9cf,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.16,
    }),
    bayFloor: new THREE.MeshPhysicalMaterial({
      map: T.carpetTex,
      normalMap: T.carpetNormal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: T.carpetRoughness,
      color: 0x85827a,
      roughness: 0.95,
      metalness: 0,
      sheen: 0.38,
      sheenRoughness: 0.82,
      sheenColor: new THREE.Color(0x9b9890),
      envMapIntensity: 0.16,
    }),
    softCeil: new THREE.MeshStandardMaterial({
      normalMap: T.ceilNormal,
      normalScale: new THREE.Vector2(0.48, 0.48),
      roughnessMap: T.ceilRoughness,
      color: 0xd6d2ca,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.16,
    }),
    fascia: new THREE.MeshStandardMaterial({
      map: T.fasciaTex,
      normalMap: T.concreteNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: T.roughTex,
      color: 0xe6e0d4,
      roughness: 0.72,
      metalness: 0.03,
      envMapIntensity: 0.28,
    }),
    dark: new THREE.MeshStandardMaterial({
      normalMap: T.roughTex as unknown as THREE.Texture,
      normalScale: new THREE.Vector2(0.14, 0.14),
      roughnessMap: T.roughTex,
      color: 0x20252c,
      roughness: 0.62,
      metalness: 0.42,
      envMapIntensity: 0.25,
    }),
    metal: new THREE.MeshPhysicalMaterial({
      color: 0xb6bec6,
      roughness: 0.48,
      metalness: 0.72,
      anisotropy: 0.35,
      envMapIntensity: 0.38,
    }),
    brass: new THREE.MeshPhysicalMaterial({
      color: 0xbc964e,
      roughness: 0.44,
      metalness: 0.76,
      anisotropy: 0.35,
      clearcoat: 0.0,
      envMapIntensity: 0.38,
    }),
    wood: new THREE.MeshStandardMaterial({
      map: T.woodTex,
      normalMap: T.woodNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: T.roughTex,
      color: 0xd8c6ac,
      roughness: 0.64,
      metalness: 0.0,
      envMapIntensity: 0.2,
    }),
    walnut: new THREE.MeshPhysicalMaterial({
      map: walnutTex,
      normalMap: T.woodNormal,
      normalScale: new THREE.Vector2(0.48, 0.48),
      roughnessMap: T.roughTex,
      color: 0x79553a,
      roughness: 0.55,
      metalness: 0.0,
      clearcoat: 0.05,
      clearcoatRoughness: 0.55,
      envMapIntensity: 0.22,
    }),
    parquet: new THREE.MeshPhysicalMaterial({
      map: parquetMap,
      normalMap: parquetNorm,
      normalScale: new THREE.Vector2(0.62, 0.62),
      roughnessMap: parquetRough,
      color: 0xa6805c,
      roughness: 0.56,
      metalness: 0.0,
      clearcoat: 0.06,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.25,
    }),
    slat: new THREE.MeshStandardMaterial({
      map: T.slatTex,
      normalMap: T.slatNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: T.roughTex,
      color: 0xf0e3d3,
      roughness: 0.76,
      metalness: 0.02,
      envMapIntensity: 0.2,
    }),
    moss: new THREE.MeshStandardMaterial({
      map: T.mossTex,
      normalMap: T.mossNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: T.roughTex,
      color: 0xd2dcc9,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.08,
    }),
    slate: new THREE.MeshPhysicalMaterial({
      map: T.slateTex,
      normalMap: T.slateNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: T.slateRoughness,
      color: 0x9aa3ae,
      roughness: 0.72,
      metalness: 0.04,
      clearcoat: 0.0,
      envMapIntensity: 0.22,
    }),
    execCarpet: new THREE.MeshPhysicalMaterial({
      map: T.carpetTex,
      normalMap: T.carpetNormal,
      normalScale: new THREE.Vector2(0.68, 0.68),
      roughnessMap: T.carpetRoughness,
      color: 0x565c68,
      roughness: 0.94,
      metalness: 0,
      sheen: 0.48,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color(0x8890a0),
      envMapIntensity: 0.15,
    }),
    pot: new THREE.MeshStandardMaterial({
      color: 0xd4cfc6,
      roughnessMap: T.roughTex,
      roughness: 0.62,
      metalness: 0.02,
      envMapIntensity: 0.35,
    }),
    fabricBlue: new THREE.MeshPhysicalMaterial({
      color: 0x26395e,
      normalMap: T.fabricNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.92,
      metalness: 0,
      sheen: 0.65,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(0x5571a3),
      envMapIntensity: 0.16,
    }),
    fabricGrey: new THREE.MeshPhysicalMaterial({
      color: 0x6b727d,
      normalMap: T.fabricNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.92,
      metalness: 0,
      sheen: 0.6,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(0x9ca3af),
      envMapIntensity: 0.16,
    }),
    fabricCognac: new THREE.MeshPhysicalMaterial({
      color: 0x8b4c2d,
      roughness: 0.58,
      metalness: 0.0,
      clearcoat: 0.0,
      sheen: 0.24,
      envMapIntensity: 0.22,
    }),
    black: new THREE.MeshStandardMaterial({
      color: 0x13161b,
      roughness: 0.6,
      metalness: 0.22,
      envMapIntensity: 0.28,
    }),
    rug: new THREE.MeshPhysicalMaterial({
      map: T.carpetTex,
      normalMap: T.carpetNormal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: T.carpetRoughness,
      color: 0xa2a6ae,
      roughness: 0.96,
      metalness: 0,
      sheen: 0.44,
      sheenRoughness: 0.84,
      envMapIntensity: 0.12,
    }),
    earth: new THREE.MeshStandardMaterial({
      normalMap: T.concreteNormal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughnessMap: T.roughTex,
      color: 0x4c3c2a,
      roughness: 0.98,
      metalness: 0,
      envMapIntensity: 0.05,
    }),
    rackBody: new THREE.MeshStandardMaterial({
      color: 0x1c2128,
      roughness: 0.5,
      metalness: 0.55,
      envMapIntensity: 0.55,
    }),
    rackFace: new THREE.MeshStandardMaterial({
      map: T.rackTex,
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.3,
    }),
    cabinet: new THREE.MeshStandardMaterial({
      color: 0xb1b9c0,
      roughness: 0.55,
      metalness: 0.35,
      envMapIntensity: 0.28,
    }),
    conduit: new THREE.MeshStandardMaterial({
      color: 0xb6792f,
      roughness: 0.52,
      metalness: 0.38,
      envMapIntensity: 0.32,
    }),
    tray: new THREE.MeshStandardMaterial({
      color: 0xb59a5c,
      roughness: 0.5,
      metalness: 0.55,
      envMapIntensity: 0.35,
    }),
    warn: new THREE.MeshStandardMaterial({
      map: T.warnTex,
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.05,
    }),
    pv: new THREE.MeshPhysicalMaterial({
      map: T.pvTex,
      color: 0xffffff,
      roughness: 0.36,
      metalness: 0.24,
      clearcoat: 0.2,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.32,
    }),
    pvFrame: new THREE.MeshPhysicalMaterial({
      color: 0x9ca5ad,
      roughness: 0.46,
      metalness: 0.75,
      anisotropy: 0.3,
      envMapIntensity: 0.38,
    }),
    raised: new THREE.MeshStandardMaterial({
      map: T.tileTex,
      normalMap: T.tileNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: T.tileRoughness,
      color: 0xbac2c8,
      roughness: 0.7,
      metalness: 0.12,
      envMapIntensity: 0.24,
    }),
    baseWall: new THREE.MeshStandardMaterial({
      map: T.concreteTex,
      normalMap: T.concreteNormal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: T.roughTex,
      color: 0x959a9f,
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0.14,
    }),
    baseCeil: new THREE.MeshStandardMaterial({
      normalMap: T.ceilNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: T.ceilRoughness,
      color: 0x5c6268,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.1,
    }),
    baseSlab: new THREE.MeshStandardMaterial({
      map: slabTex,
      normalMap: slabNorm,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: slabRough,
      color: 0x767c82,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.14,
    }),
    liftFloor: new THREE.MeshPhysicalMaterial({
      map: T.marbleTex,
      normalMap: T.marbleNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: T.marbleRoughness,
      color: 0xd0d5d9,
      roughness: 0.48,
      metalness: 0.06,
      clearcoat: 0.08,
      envMapIntensity: 0.28,
    }),
    ledGreen: new THREE.MeshBasicMaterial({ color: 0x5ef49a, toneMapped: false }),
    ledRed: new THREE.MeshBasicMaterial({ color: 0xff6a55, toneMapped: false }),
    ledAmber: new THREE.MeshBasicMaterial({ color: 0xffb14a, toneMapped: false }),
    ledCyan: new THREE.MeshBasicMaterial({ color: 0x8fd8ff, toneMapped: false }),
    paint: new THREE.MeshStandardMaterial({ color: 0xd9b53f, roughness: 0.68, metalness: 0.02 }),
    roofDeck: new THREE.MeshStandardMaterial({
      map: T.concreteTex,
      normalMap: T.concreteNormal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: T.roughTex,
      color: 0x7b8083,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.18,
    }),
    asphalt: new THREE.MeshStandardMaterial({
      map: T.asphaltTex,
      normalMap: T.asphaltNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: T.asphaltRoughness,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0.22,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xc8dad8,
      roughness: 0.18,
      metalness: 0.0,
      ior: 1.52,
      reflectivity: 0.35,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      envMapIntensity: 0.32,
      clearcoat: 0.0,
      depthWrite: false,
    }),
    screen: new THREE.MeshStandardMaterial({
      color: 0x0a1220,
      roughness: 0.28,
      metalness: 0.15,
      emissive: 0x2f6fbf,
      emissiveIntensity: 0.75,
    }),
    screenWarm: new THREE.MeshStandardMaterial({
      color: 0x14100a,
      roughness: 0.28,
      metalness: 0.15,
      emissive: 0xffa63c,
      emissiveIntensity: 0.55,
    }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xefe2c6 }),
    ledWarm: new THREE.MeshBasicMaterial({ color: 0xe6a256 }),
    ledCool: new THREE.MeshBasicMaterial({ color: 0xc2d8ec }),
    bark: new THREE.MeshStandardMaterial({
      map: T.barkTex,
      normalMap: T.barkNormal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      color: 0x6a5542,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.1,
    }),
    barkDark: new THREE.MeshStandardMaterial({
      map: T.barkTex,
      normalMap: T.barkNormal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: 0x564435,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.1,
    }),
    leatherMat: new THREE.MeshPhysicalMaterial({
      color: 0x26282d,
      normalMap: T.fabricNormal,
      normalScale: new THREE.Vector2(0.18, 0.18),
      roughness: 0.55,
      metalness: 0.02,
      clearcoat: 0.0,
      envMapIntensity: 0.22,
    }),
    ceramicMat: new THREE.MeshPhysicalMaterial({
      color: 0xeee9df,
      roughness: 0.36,
      metalness: 0.0,
      clearcoat: 0.15,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.28,
    }),
    acousticFelt: new THREE.MeshPhysicalMaterial({
      map: T.acousticTex,
      normalMap: T.fabricNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      color: 0x6f7782,
      roughness: 0.94,
      metalness: 0,
      sheen: 0.55,
      sheenRoughness: 0.85,
      envMapIntensity: 0.14,
    }),
    oakDesk: new THREE.MeshPhysicalMaterial({
      map: T.woodTex,
      normalMap: T.woodNormal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughnessMap: T.roughTex,
      color: 0xdecbb2,
      roughness: 0.62,
      metalness: 0.0,
      clearcoat: 0.0,
      envMapIntensity: 0.18,
    }),
    chrome: new THREE.MeshPhysicalMaterial({
      color: 0xc8cfd6,
      roughness: 0.36,
      metalness: 0.78,
      clearcoat: 0.0,
      envMapIntensity: 0.4,
    }),
    meshFabric: new THREE.MeshPhysicalMaterial({
      color: 0x2e343c,
      normalMap: T.fabricNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.86,
      metalness: 0.02,
      sheen: 0.4,
      sheenRoughness: 0.72,
      envMapIntensity: 0.18,
    }),
    kbMat: new THREE.MeshStandardMaterial({
      map: T.kbTex,
      roughness: 0.58,
      metalness: 0.12,
      envMapIntensity: 0.25,
    }),
  };
}
