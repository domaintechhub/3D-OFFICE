import type { BuildingId } from './districtData';

export interface RoomDef {
  n: string;
  c: number;
  lv: number;
  col: number;
  t: string;
  style: 'flat' | 'slat' | 'moss';
  soft: number;
  sub?: string;
  cx?: number;
  _ws?: WorkScreenRef[];
}

export interface ExecRoomDef {
  n: string;
  c: number;
  lv: number;
  cx: number;
  sub: string;
}

export interface WorkScreenRef {
  mat: unknown;
  mesh: unknown;
  g: CanvasRenderingContext2D;
  tx: unknown;
  next: number;
  off: number;
  lv?: number;
  stationKey?: string;
  fn: (g: CanvasRenderingContext2D, w: number, h: number, t: number) => void;
}

export interface TourStop {
  n: string;
  room?: RoomDef | ExecRoomDef;
  lv: number;
  cx: number;
  col: string;
  lab: string;
  text: string;
}

export interface FloorZoneActivity {
  zone: string;
  color: string;
  count: number;
  status: string;
}

export interface FloorActivitySummary {
  levelTitle: string;
  activeCount: number;
  zones: FloorZoneActivity[];
}

export interface InspectedMonitor {
  id: string;
  buildingId: BuildingId;
  stationKey: string;
  seatIndex: number;
  projectTitle: string;
  zone: string;
  role: string;
  levelLabel: string;
  color: string;
  workerActivity: string;
  screenTask: string;
  isOccupied: boolean;
}

export interface SelectedCharacterSnapshot {
  id: string;
  buildingId: BuildingId | 'street';
  name: string;
  role: string;
  department: string;
  seniority?: 'Senior' | 'Junior' | 'Lead' | 'Executive';
  accentColor: string;
  personality: string;
  mood: string;
  goal: string;
  actionLabel: string;
  thought: string;
  recentThoughts: string[];
  focus: number;
  energy: number;
  social: number;
  levelLabel: string;
  isFollowing: boolean;
  isGuide: boolean;
}

export type WeatherMode = 'auto' | 'clear' | 'overcast' | 'rain' | 'storm' | 'snow';
export type WeatherCondition = 'clear' | 'overcast' | 'rain' | 'storm' | 'snow';

export interface HudSnapshot {
  simMinutes: number;
  simRate: number;
  timeText: string;
  shiftLabel: string;
  statsLabel: string;
  weatherMode: WeatherMode;
  activeWeather: WeatherCondition;
  weatherLabel: string;
  weatherTimeFactor: number;
  activeBuilding: BuildingId;
  activeBuildingName: string;
  activeBuildingNiche: string;
  activeBuildingAccent: string;
  buildingFloors: number;
  activeLevel: string;
  staffVisible: boolean;
  walking: boolean;
  walkFloor: number;
  walkLocked: boolean;
  tourActive: boolean;
  tourPlaying: boolean;
  tourArrived: boolean;
  tourIndex: number;
  tourTotal: number;
  tourTitle: string;
  tourLab: string;
  tourText: string;
  tourColor: string;
  tourProgress: number;
  hoveredRoom: { title: string; sub: string; color: string; hint?: string } | null;
  floorActivity: FloorActivitySummary | null;
  inspectedMonitor: InspectedMonitor | null;
  selectedCharacter: SelectedCharacterSnapshot | null;
  audioEnabled: boolean;
  driving: boolean;
  driveSpeedKmh: number;
  driveGear: 'P' | 'R' | 'N' | 'D';
  driveCameraMode: 'chase' | 'hood';
  driveHeadlights: boolean;
  driveStreetLabel: string;
  driveTargetBuilding: BuildingId | null;
  driveTargetDistance: number;
  driveTargetBearingDeg: number;
  driveNearbyBuilding: BuildingId | null;
  driveNearbyName: string | null;
  nearPlayerCarInWalk: boolean;
}

export const BW = 10;
export const COLX = [-15, -5, 5, 15];
export const LV = [0, 5.6, 9.8, 14.0, 18.2, 22.4];
export const LH = [5.6, 4.2, 4.2, 4.2, 4.2, 4.2];
export const FLOORS = 6;
export const DEPTH = 11;
export const WIDTH = 60;
export const ROOF = 26.6;

export const BASE = [
  { key: 'b1', n: 'Server Room', y: -4.6, h: 4.2, sub: 'B1 · server hall · lift access only' },
  { key: 'b2', n: 'Power Room', y: -9.0, h: 4.0, sub: 'B2 · solar inverters · lift access only' },
] as const;

export const BASE_BOT = -9.4;
export const MIDY = ROOF * 0.489;

export const ceilY = (s: number): number => LV[s] + LH[s] - 0.4;
export const ceilHeight = (s: number): number => ceilY(s) - LV[s];

export const LANE = 10.05;
export const LIFTX = 28.55;
export const GATE = 26.2;
export const STAND = 3.2;
export const GATE_STOP = GATE - 1.05;

export const LIFT_SVC = [BASE[1].y, BASE[0].y, ...LV];
export const liftY = (l: number): number => (l < 0 ? BASE[-l - 1].y : LV[l]);

export const ROOMS: RoomDef[] = [
  { n: 'Web Development', c: 0x34598f, lv: 3, col: 0, t: 'web', style: 'flat', soft: 0x7fb0ff },
  { n: 'Front-End', c: 0xb98050, lv: 3, col: 1, t: 'front', style: 'slat', soft: 0xffc078 },
  { n: 'E-Commerce', c: 0xc9762e, lv: 3, col: 2, t: 'cart', style: 'flat', soft: 0xffb45e },
  { n: 'CMS & WordPress', c: 0x2d5c9c, lv: 3, col: 3, t: 'wp', style: 'flat', soft: 0x8fc0ff },
  { n: 'SEO', c: 0x82b04c, lv: 2, col: 0, t: 'seo', style: 'moss', soft: 0xbfe87a },
  { n: 'Digital Marketing', c: 0xd6d2ca, lv: 2, col: 1, t: 'mkt', style: 'flat', soft: 0xffffff },
  { n: 'PPC · Google Ads', c: 0x3a3e48, lv: 2, col: 2, t: 'ppc', style: 'flat', soft: 0x7fb0ff },
  { n: 'WhatsApp Marketing', c: 0x3f8a45, lv: 2, col: 3, t: 'wa', style: 'moss', soft: 0x7cf59a },
  { n: 'Social Media', c: 0x7a2f5a, lv: 1, col: 0, t: 'social', style: 'flat', soft: 0xff8fc0 },
  { n: 'Custom CRM', c: 0x2a4a8a, lv: 1, col: 1, t: 'crm', style: 'flat', soft: 0x8ab4ff },
  { n: 'AI Solutions', c: 0x5a3a9a, lv: 1, col: 2, t: 'ai', style: 'flat', soft: 0xc0a8ff },
  { n: 'Consultancy', c: 0x1f8a9a, lv: 1, col: 3, t: 'hand', style: 'flat', soft: 0x7fe4ef },
  { n: 'Maintenance & Security', c: 0x2a3f6a, lv: 0, col: 0, t: 'sec', style: 'flat', soft: 0x9fc4ff },
  { n: 'Mobile Apps', c: 0x3f9a8a, lv: 0, col: 3, t: 'mobile', style: 'flat', soft: 0x7ff0dc },
];

export const EXEC: Record<string, ExecRoomDef> = {
  security: { n: 'Security Room', c: 0x243b55, lv: 0, cx: -25, sub: 'Level 0 · 24/7 CCTV & Access Control' },
  hr: { n: 'HR Room', c: 0x2e7d6b, lv: 1, cx: -25, sub: 'Level 1 · People, Talent & Culture' },
  relax: { n: 'Relax Room', c: 0xb07c4f, lv: 2, cx: -25, sub: 'Level 2 · Staff Lounge & Ping-Pong' },
  gym: { n: 'Gym Room', c: 0xd9534f, lv: 3, cx: -25, sub: 'Level 3 · Cardio, Weights & Yoga Studio' },
  strategy: { n: 'Strategy Room', c: 0x3b5998, lv: 4, cx: -25, sub: 'Level 4 · Corporate OKRs & Growth War Room' },
  board: { n: 'Board Room', c: 0xc9a24b, lv: 4, cx: 0, sub: 'Level 4 · Board Room' },
  lounge: { n: 'Executive Lounge', c: 0x7a5c3a, lv: 4, cx: -15, sub: 'Level 4 · Lounge & coffee bar' },
  secr: { n: 'Board Secretary', c: 0x5d6b7a, lv: 4, cx: 15, sub: 'Level 4 · Board secretariat' },
  gallery: { n: 'Executive Gallery', c: 0x6b5b47, lv: 5, cx: -25, sub: 'Level 5 · Partner Briefing & Model Lounge' },
  tech: { n: 'Head of Technology', c: 0x34598f, lv: 5, cx: -17.5, sub: 'Level 5 · Heads of department' },
  mkt: { n: 'Head of Marketing', c: 0x7a2f5a, lv: 5, cx: -12.5, sub: 'Level 5 · Heads of department' },
  fin: { n: 'Head of Finance', c: 0x2d7a5a, lv: 5, cx: -7.5, sub: 'Level 5 · Heads of department' },
  ops: { n: 'Head of Operations', c: 0xc9762e, lv: 5, cx: -2.5, sub: 'Level 5 · Heads of department' },
  ceo: { n: 'Chief Executive Officer', c: 0x8a1f2e, lv: 5, cx: 13, sub: 'Level 5 · CEO suite' },
  toilets: { n: 'Toilets', c: 0x64748b, lv: 0, cx: 27.1, sub: 'East Wing · Ladies & Gents Restrooms (L0–L5)' },
  stairs: { n: 'Stairwell Core', c: 0x475569, lv: 0, cx: 22.25, sub: 'East Core · Inter-floor Switchback Stairs (L0–Roof)' },
};

export const VIEWS: Record<string, { p: [number, number, number]; t: [number, number, number] }> = {
  '5': { p: [0, 22.4 + 34.0, 27.0], t: [0, 22.4 + 0.8, 5.2] },
  '4': { p: [0, 18.2 + 34.0, 27.0], t: [0, 18.2 + 0.8, 5.2] },
  '3': { p: [0, 14.0 + 34.0, 27.0], t: [0, 14.0 + 0.8, 5.2] },
  '2': { p: [0, 9.8 + 34.0, 27.0], t: [0, 9.8 + 0.8, 5.2] },
  '1': { p: [0, 5.6 + 34.0, 27.0], t: [0, 5.6 + 0.8, 5.2] },
  '0': { p: [0, 0.0 + 35.0, 28.0], t: [0, 0.0 + 1.0, 5.4] },
  b1: { p: [0, -4.6 + 31.0, 25.0], t: [0, -4.6 + 1.0, 5.0] },
  b2: { p: [0, -9.0 + 31.0, 25.0], t: [0, -9.0 + 1.0, 5.0] },
  roof: { p: [18, 41, 26], t: [0, 27.0, 4.8] },
};

export const NEIGHBOURS = [
  { name: 'Left neighbour', x: -36, z: 0, w: 22, d: 20, h: 22, style: 'glass' as const },
  { name: 'Right neighbour', x: 35, z: 1, w: 20, d: 18, h: 18, style: 'concrete' as const },
  { name: 'Far left tower', x: -62, z: -4, w: 24, d: 22, h: 40, style: 'glass' as const },
  { name: 'Far right block', x: 60, z: -2, w: 24, d: 20, h: 31, style: 'brick' as const },
  { name: 'Behind (rear lane)', x: 0, z: -24, w: 52, d: 16, h: 29, style: 'concrete' as const },
  { name: 'Across the street L', x: -30, z: 88, w: 30, d: 18, h: 22, style: 'brick' as const },
  { name: 'Across the street R', x: 28, z: 90, w: 34, d: 18, h: 34, style: 'glass' as const },
];

export const ROAD_Z = 66;

export const TOUR_TEXT: Record<string, string> = {
  'Security Room':
    'The Ground Floor Security Control Room monitors 24/7 CCTV feeds, biometric turnstiles, and building access across the entire campus.',
  'HR Room':
    'Level 1 People & Culture hub handling technical hiring, onboarding interviews, and employee wellbeing.',
  'Relax Room':
    'Level 2 recharge lounge with espresso bar, cozy sofas, television screen, and a full-size table tennis court.',
  'Gym Room':
    'Level 3 fitness studio fitted with treadmills, stationary bikes, free weights, mirrors, and yoga mats.',
  'Strategy Room':
    'Level 4 war room with live East Africa OKR roadmaps and strategic planning displays right beside the Board Room.',
  Toilets:
    'Dedicated Ladies and Gents restrooms on every floor from Ground to Level 5 beside the East stairwell core.',
  'Stairwell Core':
    'Continuous architectural switchback staircase connecting every floor from Ground Reception up to the Rooftop Pavilion.',
  'Executive Gallery':
    'Level 5 partner briefing lounge displaying architectural models and company milestones.',
  'Maintenance & Security': 'Keeps client sites patched, backed up and monitored around the clock.',
  'Mobile Apps': 'Native and cross-platform apps for iOS and Android, from prototype to store release.',
  Consultancy: 'Scoping, roadmaps and technology choices, settled before any code is written.',
  'AI Solutions': 'Chatbots, automation and custom models woven into the way clients already work.',
  'Custom CRM': 'Bespoke customer-management systems shaped around how a business really sells.',
  'Social Media': 'Content, community and paid social that grows brand reach across every platform.',
  SEO: 'Technical and content optimisation so customers find you when they search.',
  'Digital Marketing': 'Campaign strategy and analytics that tie every channel back to measurable growth.',
  'PPC · Google Ads': 'Paid search and display campaigns tuned for the lowest cost per conversion.',
  'WhatsApp Marketing': 'Business messaging, broadcasts and automated chat flows on WhatsApp.',
  'CMS & WordPress': 'WordPress and other CMS builds that clients can manage on their own.',
  'E-Commerce': 'Online stores with payments, inventory and a checkout built to convert.',
  'Front-End': 'Interface design and build: responsive, accessible and fast.',
  'Web Development': 'Custom web applications and APIs, the engineering core of the hub.',
  'Board Room':
    'Where strategy is set: quarterly reviews, investment decisions and client roadmaps are agreed around this table.',
  'Heads of Department':
    'Technology, Marketing, Finance and Operations each have a private office, one corridor from the CEO.',
  'CEO Office':
    'The corner suite: the chief executive meets partners and key clients here, with the Kenyan flag beside the desk.',
};
