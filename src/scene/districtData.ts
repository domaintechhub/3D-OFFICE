import type { WorkstationProfile } from './workstations';

export type BuildingId =
  | 'hub'
  | 'restaurant'
  | 'dealership'
  | 'bank'
  | 'crypto'
  | 'travel'
  | 'tourism'
  | 'medical'
  | 'logistics'
  | 'realestate';

export interface DistrictBuildingSpec {
  id: BuildingId;
  name: string;
  shortName: string;
  niche: string;
  accent: string;
  accentHex: number;
  cx: number;
  cz: number;
  w: number;
  d: number;
  h: number;
  floors: number;
  floorH: number;
  groundY: number;
  doorX: number;
  doorZ: number;
  doorSide: 'south' | 'north';
  description: string;
  overviewCam: { p: [number, number, number]; t: [number, number, number] };
}

export const DISTRICT_BUILDINGS: DistrictBuildingSpec[] = [
  {
    id: 'hub',
    name: 'DomainTechHub Office',
    shortName: 'DomainTechHub',
    niche: 'Software & Digital Agency',
    accent: '#6fe3a1',
    accentHex: 0x6fe3a1,
    cx: 0,
    cz: 5.5,
    w: 60,
    d: 11,
    h: 26.6,
    floors: 6,
    floorH: 4.2,
    groundY: 0,
    doorX: 0,
    doorZ: 11.0,
    doorSide: 'south',
    description: '6-floor digital engineering, AI, marketing, wellness gym, security, HR, strategy & dual basement hub.',
    overviewCam: { p: [0, 20, 64], t: [0, 12.2, 4] },
  },
  {
    id: 'restaurant',
    name: 'Savanna Bistro & Grill',
    shortName: 'Restaurant',
    niche: 'Fine Dining & Terrace Kitchen',
    accent: '#f59e0b',
    accentHex: 0xf59e0b,
    cx: -57,
    cz: -2,
    w: 20,
    d: 18,
    h: 16.8,
    floors: 4,
    floorH: 4.2,
    groundY: -0.62,
    doorX: -57,
    doorZ: 7.0,
    doorSide: 'south',
    description: 'Wood-fired open kitchen, espresso & cocktail bar, valet forecourt road and private dining floors.',
    overviewCam: { p: [-57, 13.5, 34], t: [-57, 4.2, 1] },
  },
  {
    id: 'dealership',
    name: 'Apex Motors Showroom',
    shortName: 'Car Dealership',
    niche: 'Luxury Auto & EV Dealership',
    accent: '#ef4444',
    accentHex: 0xef4444,
    cx: 57,
    cz: -2,
    w: 20,
    d: 18,
    h: 13.6,
    floors: 3,
    floorH: 4.4,
    groundY: -0.62,
    doorX: 57,
    doorZ: 7.0,
    doorSide: 'south',
    description: 'TerraCraft-curated 3-level automotive pavilion: obsidian terrazzo turntable under a Sky-Oculus void, cantilevered spine stairs, bespoke paint & powertrain atelier, simulator rig and VIP Sky-Lounge.',
    overviewCam: { p: [57, 12.5, 34], t: [57, 3.8, 1] },
  },
  {
    id: 'bank',
    name: 'Nairobi Trust Bank',
    shortName: 'Bank',
    niche: 'Commercial Banking & Vault HQ',
    accent: '#3b82f6',
    accentHex: 0x3b82f6,
    cx: -90,
    cz: -3,
    w: 22,
    d: 20,
    h: 25.2,
    floors: 6,
    floorH: 4.2,
    groundY: -0.62,
    doorX: -90,
    doorZ: 7.0,
    doorSide: 'south',
    description: 'Six-level TerraCraft reserve HQ featuring warm Rift-limestone & champagne-bronze architecture, a double-height banknote-guilloché rotunda with kinetic astrolabe, geared planetary vault, continuous West Reserve Stairwell, acoustic crescent trade pods, radial FX horseshoe, circular bullion assay rotunda, ISO-20022 clearing bridge & diplomatic sky-astrolabe crown.',
    overviewCam: { p: [-90, 15.5, 35], t: [-90, 7.2, -2] },
  },
  {
    id: 'crypto',
    name: 'BitVault Crypto Exchange',
    shortName: 'Crypto',
    niche: 'Digital Assets & Quant Trading',
    accent: '#10b981',
    accentHex: 0x10b981,
    cx: 90,
    cz: -3,
    w: 22,
    d: 20,
    h: 21.0,
    floors: 5,
    floorH: 4.2,
    groundY: -0.62,
    doorX: 90,
    doorZ: 7.0,
    doorSide: 'south',
    description: 'Five-level TerraCraft exchange atrium with Quarter-Turn Gallery Staircase, 5-story Merkle Genesis pillar, MPC cold vault, immersion ASIC gallery, OTC liquidity hall, ZK audit theater & sovereign penthouse.',
    overviewCam: { p: [90, 14.5, 35], t: [90, 6.2, -2] },
  },
  {
    id: 'travel',
    name: 'Skyline Travel & Aviation',
    shortName: 'Travel',
    niche: 'Global Flights & Visa Concierge',
    accent: '#38bdf8',
    accentHex: 0x38bdf8,
    cx: -48,
    cz: 93,
    w: 28,
    d: 18,
    h: 16.8,
    floors: 4,
    floorH: 4.2,
    groundY: -0.62,
    doorX: -48,
    doorZ: 84.0,
    doorSide: 'north',
    description: 'Airport-inspired terminal lounge with curbside drop-off loop, live departure board, rotating globe and check-in.',
    overviewCam: { p: [-48, 13.5, 56], t: [-48, 4.8, 90] },
  },
  {
    id: 'tourism',
    name: 'Kenya Safari & Tourism',
    shortName: 'Tourism',
    niche: 'Expeditions & Eco-Lodges',
    accent: '#84cc16',
    accentHex: 0x84cc16,
    cx: 0,
    cz: 93,
    w: 30,
    d: 18,
    h: 16.8,
    floors: 4,
    floorH: 4.2,
    groundY: -0.62,
    doorX: 0,
    doorZ: 84.0,
    doorSide: 'north',
    description: 'Topographical Mt. Kenya & Mara relief map gallery, 4x4 showcase, expedition drive-up forecourt and planning desks.',
    overviewCam: { p: [0, 14, 56], t: [0, 4.8, 90] },
  },
  {
    id: 'medical',
    name: 'VitalCare Medical & Pharmacy',
    shortName: 'Medical',
    niche: 'Diagnostics & 24h Pharmacy',
    accent: '#2dd4bf',
    accentHex: 0x2dd4bf,
    cx: 0,
    cz: -28,
    w: 48,
    d: 16,
    h: 21.0,
    floors: 5,
    floorH: 4.2,
    groundY: -0.62,
    doorX: 0,
    doorZ: -20.0,
    doorSide: 'south',
    description: '24-hour biophilic clinical sanctuary with seafoam-terrazzo apothecary, C-wrap bamboo sky-well, 3T MRI & CT bays, dental & longevity suites, ISO-5 genomics cleanroom & sky sanctuary.',
    overviewCam: { p: [36, 17.5, -2.5], t: [0, 7.5, -26] },
  },
  {
    id: 'logistics',
    name: 'SwiftPort Cargo & Logistics',
    shortName: 'Logistics',
    niche: 'Freight Hub & Express Fleet',
    accent: '#f97316',
    accentHex: 0xf97316,
    cx: 54,
    cz: 94,
    w: 32,
    d: 20,
    h: 17.6,
    floors: 4,
    floorH: 4.4,
    groundY: -0.62,
    doorX: 54,
    doorZ: 84.0,
    doorSide: 'north',
    description: 'Automated parcel sorting conveyor, east loading dock freight yard, GPS fleet control tower and customs dispatch.',
    overviewCam: { p: [54, 15, 55], t: [56, 4.8, 92] },
  },
  {
    id: 'realestate',
    name: 'TerraCraft Estates, Build & Interiors',
    shortName: 'Real Estate',
    niche: 'Real Estate, Construction & Interiors',
    accent: '#e07a5f',
    accentHex: 0xe07a5f,
    cx: -84,
    cz: 94,
    w: 26,
    d: 18,
    h: 21.0,
    floors: 5,
    floorH: 4.2,
    groundY: -0.62,
    doorX: -84,
    doorZ: 85.0,
    doorSide: 'north',
    description: 'Integrated property brokerage, structural construction engineering & bespoke interior design atelier with 3D masterplan gallery and rooftop crane.',
    overviewCam: { p: [-84, 15.5, 52], t: [-84, 6.2, 92] },
  },
];

export const DISTRICT_BUILDING_MAP: Record<BuildingId, DistrictBuildingSpec> = Object.fromEntries(
  DISTRICT_BUILDINGS.map((b) => [b.id, b])
) as Record<BuildingId, DistrictBuildingSpec>;

export function getBuildingFloorView(
  spec: DistrictBuildingSpec,
  lv: number
): { p: [number, number, number]; t: [number, number, number] } {
  const floorY = spec.groundY + lv * spec.floorH;
  const distZ = Math.max(22, spec.d + 10);
  const signZ = spec.doorSide === 'north' ? -1 : 1;
  return {
    p: [spec.cx, floorY + 25.5, spec.cz + signZ * distZ],
    t: [spec.cx, floorY + 1.0, spec.cz],
  };
}

export function getBuildingRoofView(
  spec: DistrictBuildingSpec
): { p: [number, number, number]; t: [number, number, number] } {
  const roofY = spec.groundY + spec.h;
  const signZ = spec.doorSide === 'north' ? -1 : 1;
  return {
    p: [spec.cx + 12, roofY + 12, spec.cz + signZ * 20],
    t: [spec.cx, roofY, spec.cz],
  };
}

export const DISTRICT_WORK_THOUGHTS: Record<string, string[]> = {
  restaurant: [
    'Table 4 ribeye & grilled tilapia tickets just hit the pass—plating fresh herbs now.',
    'Pulling a double shot of Nyeri AA espresso while checking evening table bookings.',
    'Wood-fired oven is holding 390°C cleanly—sourdough flatbreads look crisp.',
    'Checking cold-room produce inventory before the dinner rush arrives.',
  ],
  diner: [
    'That wood-fired spiced flatbread smells incredible—glad we grabbed a window table.',
    'Reviewing the tasting menu pairings with fresh mango passion mocktails.',
    'Great natural light inside the bistro—perfect spot for a working lunch.',
  ],
  dealership: [
    'Preparing the crimson Apex GT beneath the Level 1 Sky-Oculus for a 2:00 PM executive handover.',
    'Matching saddle-tan stitch swatches with forged split-spoke wheels in the Level 1 Bespoke Atelier.',
    'Reviewing 800V dual-motor battery skate telemetry and track-mode simulator lap splits.',
    'Welcoming a fleet buyer in the Level 2 VIP Sky-Lounge beside the wind-tunnel GT speedform.',
  ],
  bank: [
    'Clearing RTGS commercial settlements beneath the double-height guilloché banking rotunda.',
    'Pricing live EAC FX spreads and CBK sovereign bond auctions across the Level 2 Horseshoe.',
    'Verifying 24K gold ingot provenance inside the Level 3 Bullion Assay Rotunda.',
    'Reviewing ISO-20022 cross-border trade letters of credit in the curved Makore crescent pods.',
  ],
  crypto: [
    'Monitoring BTC/USDT orderbook depth and cold-storage 5/7 MPC quorum beside the Merkle Genesis core.',
    'Inspecting dielectric coolant flow across the Level 1 immersion-cooled ASIC tanks holding 34.2°C.',
    'Routing institutional OTC block liquidity along East African stablecoin and FX corridors on Level 2.',
    'Verifying zero-knowledge Merkle proof-of-reserves attestations inside the Level 3 audit theater.',
  ],
  travel: [
    'Confirming seat upgrades on the evening NBO → LHR Dreamliner departure.',
    'Checking Schengen visa processing turnaround for next week’s group delegation.',
    'Monitoring regional flight schedules across Mombasa, Zanzibar, and Kigali.',
    'Printing boarding passes and lounge vouchers at check-in counter two.',
  ],
  tourism: [
    'Plotting a 7-day Maasai Mara & Amboseli photography itinerary on the relief map.',
    'Inspecting the expedition 4x4 roof rack, recovery gear, and satellite radio.',
    'Confirming eco-lodge availability for peak wildebeest migration season.',
    'Briefing international guests on Mt. Kenya highland trail weather.',
  ],
  medical: [
    'Verifying 2–8°C vaccine cold-chain racks across the 24-hour ground apothecary dispensary.',
    'Reviewing 3T MRI & 64-slice CT angiography reconstructions on Level 1 Diagnostic Imaging.',
    'Preparing cellular IV infusion biomarkers inside the Level 2 Longevity Conservatory.',
    'Confirming -196.4°C liquid-nitrogen cryo-biobank integrity in the Level 3 Genomics Lab.',
  ],
  logistics: [
    'Two express cargo vans just backed into Dock B—scanning inbound Mombasa freight.',
    'Parcel sorting conveyor is moving 420 waybills per hour with zero jam alerts.',
    'Updating GPS corridor ETAs along the Nairobi–Mombasa and Kampala freight routes.',
    'Clearing customs airway bills before the afternoon JKIA cargo transfer.',
  ],
  realestate: [
    'Walking a buyer around the 3D Karen masterplan scale model before site handover.',
    'Reviewing structural rebar schedules and concrete cure strength for Block C.',
    'Matching honed travertine marble, smoked oak, and brushed bronze swatches for the penthouse fit-out.',
    'Coordinating real estate escrow, building permits, and turnkey interior styling under one roof.',
  ],
  client: [
    'Reviewing my service options and waiting comfortably in the main hall.',
    'Checking the live status display board while my request is processed.',
    'Comparing packages at the consultation counter before confirming.',
  ],
};

export const DISTRICT_WORKSTATIONS: Record<string, WorkstationProfile> = {
  restaurant: {
    stationKey: 'restaurant',
    projectTitle: 'Savanna Bistro · Kitchen Display & Floor POS',
    clientName: 'Savanna Bistro & Grill',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'Nairobi Culinary & Coffee — Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Kenyan_cuisine',
        searchQuery: 'Kenyan coffee Nyeri AA specialty roast',
        articleTitle: 'Seasonal Highland Harvest & Farm-to-Table Cold Chain',
        articleDomain: 'en.wikipedia.org',
        sections: [
          {
            heading: 'Morning Farm Delivery',
            excerpt: 'Fresh avocados, heirloom tomatoes, and Nyeri AA micro-lot beans arrived at 06:30 with full temperature compliance.',
            highlight: 'Chef specials locked for lunch & evening service: Swahili spiced sea bass & wood-fired flatbreads.',
          },
        ],
        researchNote: 'Updated allergen tags across all digital table menus.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Live Kitchen Order Queue & Table Service',
      columns: ['Table', 'Order Ticket', 'Station', 'Status'],
      initialRows: [
        ['T-02', '2x Nyeri Espresso + Croissant', 'Barista', 'Served'],
        ['T-04', 'Wood-Fired Herb Flatbread', 'Oven', 'Firing 4m'],
        ['T-05', 'Swahili Coconut Sea Bass', 'Grill', 'Plating'],
        ['T-01', 'Mango Passion Tasting Flight', 'Bar', 'Ready'],
      ],
      incomingQueue: [
        ['T-06', 'Chargrilled Ribeye Med-Rare', 'Grill', 'Queued'],
        ['T-03', 'Truffle Mushroom Risotto', 'Sauté', 'Prepping'],
      ],
    },
    projectWork: {
      fileName: 'menu/dinner-tasting-2026.json',
      language: 'POS Menu',
      accent: '#f59e0b',
      codeLines: [
        '{ "venue": "Savanna Bistro & Grill", "ovenTempC": 390,',
        '  "activeTables": 6, "avgTicketTimeMin": 11.4,',
        '  "featuredSpecial": "Coastal Spiced Red Snapper" }',
      ],
      terminalOutput: 'Kitchen KDS synced · 6 active tables · Avg ticket 11.4 min',
      deliverables: [
        { label: 'Morning pastry & sourdough bake complete', done: true },
        { label: 'Lunch cover prep & herb station mise-en-place', done: true },
        { label: 'Evening tasting pairing menu live on POS', done: false },
      ],
    },
    jobApp: {
      appType: 'executive',
      appTabLabel: 'KDS & Tables',
      appName: 'Savanna Bistro Live Floor & Kitchen Operations',
      kpis: [
        { label: 'Covers Today', value: '148', delta: '+16%' },
        { label: 'Avg Ticket', value: '11.4m', delta: 'On Pace' },
        { label: 'Guest Rating', value: '4.9 ★', delta: '640 rev' },
      ],
      chartBars: [0.42, 0.78, 0.92, 0.56, 0.88, 0.96],
      chartLabels: ['8a', '12p', '1p', '4p', '7p', '9p'],
      visualHeadline: 'Savanna Bistro · Wood-Fired Kitchen & Terrace Dining Live Status',
      visualSubline: 'Oven holding 390°C · 6 indoor tables + sidewalk terrace seating active',
      visualItems: [
        { title: 'Grill & Wood Oven Pass', meta: '4 active tickets · 0 overdue', status: 'Firing' },
        { title: 'Espresso & Pastry Bar', meta: 'Nyeri AA single-origin dial-in', status: 'Active' },
        { title: 'Evening Reservations', meta: '38 bookings confirmed tonight', status: 'Ready' },
      ],
    },
  },
  dealership: {
    stationKey: 'dealership',
    projectTitle: 'Apex Motors · Vehicle Configurator & Sales Desk',
    clientName: 'Apex Motors Showroom',
    primaryMode: 'project',
    browserSessions: [
      {
        tabTitle: 'Electric Vehicle Architecture — Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Electric_vehicle',
        searchQuery: 'electric vehicle battery range awd specs',
        articleTitle: 'Apex Flagship AWD Hybrid & Zero-Emission Fleet Benchmarks',
        articleDomain: 'en.wikipedia.org',
        sections: [
          {
            heading: 'Showroom Turntable Highlight',
            excerpt: '540 km combined range, dual-motor AWD traction control, and fast-charge compatibility across Nairobi charging corridors.',
            highlight: '3 showroom vehicles inspected and ready for same-day test drives.',
          },
        ],
        researchNote: 'Prepared tailored corporate lease quote for 6 executive SUVs.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Showroom Inventory & Test Drive Schedule',
      columns: ['VIN / Bay', 'Model & Finish', 'List Price', 'Status'],
      initialRows: [
        ['TURNTBL-01', 'Apex GT Crimson Hybrid', 'KES 8.4M', 'On Display'],
        ['SHOW-W02', 'Apex Executive Sedan Blue', 'KES 6.2M', 'Reserved'],
        ['SHOW-E03', 'Apex Trail SUV Silver', 'KES 9.1M', 'Test Drive'],
        ['FLEET-04', 'Apex EV Urban Hatch', 'KES 4.8M', 'In Stock'],
      ],
      incomingQueue: [
        ['SHOW-E05', 'Apex Overland 4x4 Pearl', 'KES 10.2M', 'Incoming'],
        ['LEASE-19', 'Corporate 5-Car Fleet Quote', 'KES 31.0M', 'Approved'],
      ],
    },
    projectWork: {
      fileName: 'dms/test-drive-dispatch.ts',
      language: 'DMS Config',
      accent: '#ef4444',
      codeLines: [
        'export const showroomStatus = {',
        '  turntableModel: "Apex GT Crimson Hybrid",',
        '  testDrivesBookedToday: 9, unitsReadyForDelivery: 14',
        '};',
      ],
      terminalOutput: 'Turntable telemetry nominal · 9 test drives scheduled today',
      deliverables: [
        { label: 'Showroom turntable flagship detailed & charged', done: true },
        { label: 'Corporate fleet financing matrix updated', done: true },
        { label: 'Afternoon VIP handover paperwork signed', done: false },
      ],
    },
    jobApp: {
      appType: 'design',
      appTabLabel: 'Showroom DMS',
      appName: 'Apex Motors Showroom & Vehicle Configurator',
      kpis: [
        { label: 'Units on Floor', value: '3 Hero', delta: '14 Stock' },
        { label: 'Test Drives', value: '9 Today', delta: '+3 VIP' },
        { label: 'Deliveries Mo.', value: '28 Cars', delta: '+22%' },
      ],
      chartBars: [0.62, 0.71, 0.79, 0.84, 0.91, 0.95],
      chartLabels: ['Sedan', 'SUV', 'Hybrid', 'EV', 'Fleet', 'Service'],
      visualHeadline: 'Apex Motors · Active Showroom Floor & Financing Desk',
      visualSubline: 'Center turntable active · Battery diagnostic & lease calculator live',
      visualItems: [
        { title: 'Turntable Flagship SUV', meta: 'Metallic Crimson · 540 km range', status: 'Live' },
        { title: 'Executive Blue Sedan', meta: 'Test drive booked at 14:30', status: 'Booked' },
        { title: 'Fleet Leasing Desk', meta: '3 corporate quotes in review', status: 'Active' },
      ],
    },
  },
  bank: {
    stationKey: 'bank',
    projectTitle: 'Nairobi Trust Bank · Core Teller & FX Treasury',
    clientName: 'Nairobi Trust Bank HQ',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'Real-Time Gross Settlement & Banking',
        url: 'https://en.wikipedia.org/wiki/Real-time_gross_settlement',
        searchQuery: 'real time gross settlement banking kenya',
        articleTitle: 'East Africa Interbank FX & RTGS Settlement Window',
        articleDomain: 'en.wikipedia.org',
        sections: [
          {
            heading: 'Live Currency Desk',
            excerpt: 'KES/USD spot quotes refreshed every 30 seconds across retail teller windows and corporate trade desks.',
            highlight: 'Biometric vault audit cleared at 08:00 · 100% liquidity reserve compliance.',
          },
        ],
        researchNote: 'Verified corporate SWIFT & M-Pesa B2B clearing rails.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Live FX Rates & Commercial Settlement Ledger',
      columns: ['Pair / Ref', 'Buy Rate', 'Sell Rate', 'Channel'],
      initialRows: [
        ['USD / KES', '128.40', '129.85', 'Treasury'],
        ['EUR / KES', '139.10', '141.05', 'SWIFT'],
        ['GBP / KES', '163.20', '165.40', 'Corporate'],
        ['RTGS-8841', 'KES 4.20M', 'Cleared', 'Teller 1'],
      ],
      incomingQueue: [
        ['LC-2049', 'USD 85,000', 'Approved', 'Trade Fin.'],
        ['ATM-VEST', 'KES 6.50M', 'Loaded', 'Vault Ops'],
      ],
    },
    projectWork: {
      fileName: 'core/vault-settlement-audit.sql',
      language: 'Core Banking',
      accent: '#3b82f6',
      codeLines: [
        'SELECT branch_code, teller_id, COUNT(*) AS cleared_tx,',
        '       SUM(amount_kes) AS volume_kes',
        'FROM rtgs_settlements WHERE settled_today = TRUE;',
      ],
      terminalOutput: 'Vault seal verified · 3 ATM kiosks online · RTGS clearing active',
      deliverables: [
        { label: 'Morning vault dual-custody opening check', done: true },
        { label: 'ATM vestibule cash cassettes balanced', done: true },
        { label: 'End-of-day FX treasury reconciliation', done: false },
      ],
    },
    jobApp: {
      appType: 'security',
      appTabLabel: 'Treasury & Vault',
      appName: 'Nairobi Trust Bank · Branch & Treasury Console',
      kpis: [
        { label: 'USD / KES', value: '129.10', delta: 'Live Spot' },
        { label: 'Vault Status', value: 'Sealed', delta: 'Dual Key' },
        { label: 'ATM Uptime', value: '100%', delta: '3 Kiosks' },
      ],
      chartBars: [0.88, 0.92, 0.85, 0.94, 0.97, 0.99],
      chartLabels: ['Teller 1', 'Teller 2', 'FX', 'Trade', 'ATMs', 'Vault'],
      visualHeadline: 'Nairobi Trust Bank · Sovereign Reserve & Treasury Operations',
      visualSubline: 'Stepped Makore teller gallery & kinetic astrolabe rotunda · Planetary geared vault sealed',
      visualItems: [
        { title: 'Retail Banking Rotunda', meta: 'Avg wait time 2m 40s · 3 biometric ATMs live', status: 'Open' },
        { title: 'Trade Crescent & FX Horseshoe', meta: 'USD / EUR / GBP & sovereign yield curves live', status: 'Active' },
        { title: 'Planetary Vault & Assay', meta: 'Dual-iris lock & 24K custody telemetry nominal', status: 'Secure' },
      ],
    },
  },
  crypto: {
    stationKey: 'crypto',
    projectTitle: 'BitVault Exchange · Orderbook & Validator Console',
    clientName: 'BitVault Crypto Exchange',
    primaryMode: 'project',
    browserSessions: [
      {
        tabTitle: 'Blockchain Consensus & Validators',
        url: 'https://en.wikipedia.org/wiki/Proof_of_stake',
        searchQuery: 'blockchain validator consensus finality custody',
        articleTitle: 'Multi-Sig MPC Cold Custody & High-Frequency Matching Engine',
        articleDomain: 'en.wikipedia.org',
        sections: [
          {
            heading: 'Sub-Millisecond Order Matching',
            excerpt: 'Spot BTC/USDT, ETH/USDT, and SOL/USDT orderbooks maintain deep regional liquidity with zero-knowledge proof of reserves.',
            highlight: 'Cold-storage pod quorum 5/7 hardware keys verified · 99.99% validator uptime.',
          },
        ],
        researchNote: 'Auditing mempool priority fees during New York market overlap.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Live Spot Orderbook & Cold-Custody Sweeps',
      columns: ['Market Pair', 'Last Price', '24h Change', 'Liquidity'],
      initialRows: [
        ['BTC / USDT', '$94,280', '+3.42%', '$18.4M'],
        ['ETH / USDT', '$3,415', '+2.18%', '$9.2M'],
        ['SOL / USDT', '$198.40', '+5.64%', '$5.1M'],
        ['USDT / KES', '129.45', '+0.12%', '$4.8M'],
      ],
      incomingQueue: [
        ['VAULT-MPC', '24.5 BTC', 'Confirmed', 'Cold Pod'],
        ['NODE-VAL4', '14ms Finality', 'Synced', 'Mainnet'],
      ],
    },
    projectWork: {
      fileName: 'engine/orderbook-matcher.rs',
      language: 'Rust Engine',
      accent: '#10b981',
      codeLines: [
        'pub fn match_limit_order(book: &mut OrderBook, order: Order) -> Vec<Fill> {',
        '  let spread_bps = book.best_ask() - book.best_bid();',
        '  verify_mpc_custody_threshold(5, 7)?;',
        '  book.execute_atomic(order)',
        '}',
      ],
      terminalOutput: 'Matching engine: 18,400 tx/s · Proof-of-Reserves merkle root published',
      deliverables: [
        { label: 'Hourly proof-of-reserves Merkle attestation', done: true },
        { label: 'Glass cold-storage node pod cooling check', done: true },
        { label: 'KES instant mobile-money on-ramp rebalance', done: false },
      ],
    },
    jobApp: {
      appType: 'ide',
      appTabLabel: 'Market Terminal',
      appName: 'BitVault Exchange · Live Market & Node Terminal',
      kpis: [
        { label: 'BTC / USDT', value: '$94,280', delta: '+3.4%' },
        { label: 'Node Latency', value: '14 ms', delta: 'Synced' },
        { label: 'Cold Vault', value: '94% MPC', delta: '5/7 Keys' },
      ],
      chartBars: [0.58, 0.67, 0.74, 0.86, 0.82, 0.97],
      chartLabels: ['BTC', 'ETH', 'SOL', 'AVAX', 'KES', 'Nodes'],
      visualHeadline: 'BitVault Crypto · Live Matching Engine & Hardware Vault Pod',
      visualSubline: 'Exterior ticker live · Quant trading pods & validator racks green',
      visualItems: [
        { title: 'Spot Orderbook Engine', meta: 'BTC / ETH / SOL / KES rails', status: 'Live' },
        { title: 'Cold-Storage Glass Pod', meta: 'MPC HSM hardware quorum locked', status: 'Verified' },
        { title: 'Validator Cluster', meta: '100% attestation efficiency', status: 'Synced' },
      ],
    },
  },
  travel: {
    stationKey: 'travel',
    projectTitle: 'Skyline Travel · GDS Flight Booking & Visa Desk',
    clientName: 'Skyline Travel & Aviation',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'Jomo Kenyatta International Airport (NBO)',
        url: 'https://en.wikipedia.org/wiki/Jomo_Kenyatta_International_Airport',
        searchQuery: 'Jomo Kenyatta International Airport NBO routes',
        articleTitle: 'Live JKIA International Departures & Corporate Fare Classes',
        articleDomain: 'en.wikipedia.org',
        sections: [
          {
            heading: 'Peak International Corridors',
            excerpt: 'Direct evening wide-body departures from Nairobi (NBO) to London Heathrow, Dubai, Amsterdam, and regional hubs.',
            highlight: 'Automated seat-map hold & e-visa compliance checker active at all desks.',
          },
        ],
        researchNote: 'Confirmed group itinerary & airport lounge access for 14 travelers.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Live Departure Board & Ticket Issue Queue',
      columns: ['Flight', 'Route', 'Departure', 'Gate / Status'],
      initialRows: [
        ['KQ 100', 'NBO → LHR London', '23:15', 'On Time'],
        ['EK 722', 'NBO → DXB Dubai', '22:45', 'Check-In'],
        ['SA 185', 'NBO → JNB Joburg', '16:20', 'Boarding'],
        ['PW 712', 'NBO → ZNZ Zanzibar', '14:10', 'Confirmed'],
      ],
      incomingQueue: [
        ['WB 109', 'NBO → KGL Kigali', '17:50', 'E-Ticketed'],
        ['KQ 612', 'NBO → MBA Mombasa', '15:30', 'Seat Assigned'],
      ],
    },
    projectWork: {
      fileName: 'gds/corporate-pnr-manifest.json',
      language: 'GDS Manifest',
      accent: '#38bdf8',
      codeLines: [
        '{ "hub": "JKIA-NBO", "activeBookings": 42,',
        '  "visaApprovalsPending": 3, "loungePassesIssued": 19 }',
      ],
      terminalOutput: 'Amadeus GDS live · 42 active bookings · Departure board updated',
      deliverables: [
        { label: 'Evening NBO → LHR executive PNR ticketing', done: true },
        { label: 'Baggage allowance & lounge vouchers printed', done: true },
        { label: 'Corporate travel policy quarterly audit', done: false },
      ],
    },
    jobApp: {
      appType: 'marketing',
      appTabLabel: 'Flight Board',
      appName: 'Skyline Travel · Aviation Dispatch & Ticketing',
      kpis: [
        { label: 'Active PNRs', value: '42', delta: '+11 Today' },
        { label: 'On-Time Hubs', value: '96%', delta: 'NBO Ops' },
        { label: 'Visas Cleared', value: '18', delta: 'Fast Track' },
      ],
      chartBars: [0.9, 0.84, 0.78, 0.72, 0.88, 0.94],
      chartLabels: ['DXB', 'LHR', 'MBA', 'ZNZ', 'KGL', 'JNB'],
      visualHeadline: 'Skyline Travel · Live Terminal Check-In & Global Routes',
      visualSubline: 'Overhead departure screen live · Visa concierge desks assisting travelers',
      visualItems: [
        { title: 'NBO → DXB / LHR Trunk', meta: 'Dreamliner & A380 connections', status: 'Check-In' },
        { title: 'East Africa Coastal', meta: 'Mombasa, Diani & Zanzibar hops', status: 'On Time' },
        { title: 'Visa & Passport Desk', meta: 'Express document verification', status: 'Open' },
      ],
    },
  },
  tourism: {
    stationKey: 'tourism',
    projectTitle: 'Kenya Safari · Expedition & Eco-Lodge Dispatch',
    clientName: 'Kenya Safari & Tourism',
    primaryMode: 'browser',
    browserSessions: [
      {
        tabTitle: 'Maasai Mara National Reserve — Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Maasai_Mara',
        searchQuery: 'Maasai Mara wildlife migration Kenya safari',
        articleTitle: 'National Park Wildlife Corridors & 4x4 Expedition Dispatch',
        articleDomain: 'en.wikipedia.org',
        sections: [
          {
            heading: 'Conservancy Field Telemetry',
            excerpt: 'Clear morning visibility on Mt. Kenya & Kilimanjaro from Amboseli; high lion & elephant sightings along Mara River crossings.',
            highlight: 'Floor relief map updated with live GPS positions for 8 safari Land Cruisers.',
          },
        ],
        researchNote: 'Finalized 7-day photography expedition with private naturalist guide.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Safari Departures & Eco-Lodge Reservations',
      columns: ['Expedition', 'Park / Region', 'Guests', 'Fleet Status'],
      initialRows: [
        ['SAF-401', 'Maasai Mara Reserve', '6 Guests', '4x4 Ready'],
        ['SAF-402', 'Amboseli & Tsavo W.', '4 Guests', 'En Route'],
        ['SAF-403', 'Mt. Kenya Naro Moru', '8 Guests', 'Briefing'],
        ['SAF-404', 'Diani & Lamu Coast', '2 Guests', 'Booked'],
      ],
      incomingQueue: [
        ['SAF-405', 'Samburu Conservancy', '5 Guests', 'Permits OK'],
        ['SAF-406', 'Lake Nakuru Flamingo', '4 Guests', 'Confirmed'],
      ],
    },
    projectWork: {
      fileName: 'expeditions/mara-7day-route.gpx',
      language: 'Expedition GPX',
      accent: '#84cc16',
      codeLines: [
        '<route name="Mara-Amboseli-2026" vehicle="LandCruiser-4x4">',
        '  <waypoint name="Narok Gate" elev="1920m" />',
        '  <waypoint name="Talek Conservancy Camp" elev="1610m" />',
        '</route>',
      ],
      terminalOutput: 'Relief map telemetry synced · 8 safari 4x4 units tracked',
      deliverables: [
        { label: 'KWS park entry smart-cards issued', done: true },
        { label: 'Showroom expedition 4x4 gear inspection', done: true },
        { label: 'Guest binocular & field guide kit handover', done: false },
      ],
    },
    jobApp: {
      appType: 'social',
      appTabLabel: 'Safari Planner',
      appName: 'Kenya Safari & Tourism · Expedition Planning Studio',
      kpis: [
        { label: 'Active Tours', value: '8', delta: '34 Guests' },
        { label: 'Park Permits', value: '100%', delta: 'KWS Sync' },
        { label: 'Lodge Occ.', value: '91%', delta: 'Peak' },
      ],
      chartBars: [0.95, 0.86, 0.78, 0.84, 0.74, 0.9],
      chartLabels: ['Mara', 'Amboseli', 'Mt.KE', 'Samburu', 'Tsavo', 'Lamu'],
      visualHeadline: 'Kenya Safari Hub · 3D Topographical Relief Map & 4x4 Showcase',
      visualSubline: 'Naturalist guides briefing guests · Direct eco-lodge reservations live',
      visualItems: [
        { title: 'Maasai Mara Migration', meta: 'Private 4x4 pop-top cruisers', status: 'Active' },
        { title: 'Amboseli Kilimanjaro View', meta: 'Sunrise photography camp', status: 'Booked' },
        { title: 'Coastal Diani & Lamu', meta: 'Dhow & reef eco-retreat', status: 'Open' },
      ],
    },
  },
  medical: {
    stationKey: 'medical',
    projectTitle: 'VitalCare Medical · Clinical EHR & Pharmacy Console',
    clientName: 'VitalCare Medical & Pharmacy',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'Electronic Health Record — Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Electronic_health_record',
        searchQuery: 'electronic health record clinical diagnostics cold chain',
        articleTitle: '24-Hour Clinical Triage & Automated Dispensary Protocols',
        articleDomain: 'en.wikipedia.org',
        sections: [
          {
            heading: 'Pharmacy & Lab Turnaround',
            excerpt: 'Rapid blood chemistry panels complete in 18 minutes while barcode-verified pharmacy racks dispense prescriptions with zero wait.',
            highlight: 'Cold-chain biologics holding 4.1°C · 2 physicians & pharmacist on floor.',
          },
        ],
        researchNote: 'Updated afternoon preventive health screening roster.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Patient Triage & Pharmacy Dispensing Queue',
      columns: ['Ticket', 'Service / Rx', 'Clinician', 'Status'],
      initialRows: [
        ['VC-104', 'Annual Wellness Panel', 'Dr. Auma', 'In Consult'],
        ['RX-882', 'Amoxicillin + Electrolytes', 'Pharm. Kamau', 'Dispensed'],
        ['VC-105', 'ECG & Blood Pressure Check', 'Nurse Chebet', 'Vitals OK'],
        ['LAB-49', 'Full Lipid & Glucose Screen', 'Diag. Lab', 'Ready'],
      ],
      incomingQueue: [
        ['RX-883', 'Travel Yellow Fever Cert', 'Cold Rack B', 'Prepping'],
        ['VC-106', 'Pediatric Follow-Up', 'Suite 2', 'Waiting'],
      ],
    },
    projectWork: {
      fileName: 'ehr/cold-chain-telemetry.log',
      language: 'Clinical Log',
      accent: '#2dd4bf',
      codeLines: [
        '[09:24:10] PHARMACY-FRIDGE-B: 4.1°C (Target 2.0-8.0°C) OK',
        '[09:25:02] LAB-ANALYZER-02: Batch #49 complete, 0 flags',
        '[09:25:40] TRIAGE-DESK: Avg wait time 4m 15s',
      ],
      terminalOutput: 'Clinical EHR synced · Pharmacy cold chain 4.1°C nominal',
      deliverables: [
        { label: 'Morning pharmacy narcotic & cold-chain audit', done: true },
        { label: 'Diagnostic hematology analyzer calibration', done: true },
        { label: 'Afternoon corporate wellness checkups', done: false },
      ],
    },
    jobApp: {
      appType: 'security',
      appTabLabel: 'Clinical EHR',
      appName: 'VitalCare Medical · Triage, Lab & Pharmacy Dashboard',
      kpis: [
        { label: 'Wait Time', value: '4.2m', delta: 'Fast Triage' },
        { label: 'Cold Chain', value: '4.1°C', delta: 'Nominal' },
        { label: 'Rx Ready', value: '98%', delta: '24h Open' },
      ],
      chartBars: [0.85, 0.92, 0.88, 0.95, 0.9, 0.96],
      chartLabels: ['Triage', 'Pharmacy', 'Lab', 'Consult', 'Vaccines', '24h ER'],
      visualHeadline: 'VitalCare Medical · 24/7 Pharmacy Dispensary & Diagnostics',
      visualSubline: 'Triage reception open · Consultation suites & lab vitals synced',
      visualItems: [
        { title: '24h Glass Pharmacy Counter', meta: 'Barcode-verified dispensing racks', status: 'Open' },
        { title: 'Diagnostic Imaging & Lab', meta: '18-minute rapid blood panel', status: 'Active' },
        { title: 'Outpatient Consult Suites', meta: 'Physicians seeing scheduled visits', status: 'Serving' },
      ],
    },
  },
  logistics: {
    stationKey: 'logistics',
    projectTitle: 'SwiftPort Logistics · Freight Dispatch & Fleet Telemetry',
    clientName: 'SwiftPort Cargo & Logistics',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'Freight Transport & Supply Chain — Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Freight_transport',
        searchQuery: 'Nairobi Mombasa standard gauge freight logistics',
        articleTitle: 'Automated Parcel Sortation & Express Fleet Routing',
        articleDomain: 'en.wikipedia.org',
        sections: [
          {
            heading: 'Live Loading Dock Utilization',
            excerpt: 'Dock Bays 1 and 2 active with automated barcode conveyor sortation and live GPS courier dispatch across Nairobi.',
            highlight: '14 express vans active on regional routes · 99.2% on-time SLA.',
          },
        ],
        researchNote: 'Prioritized cold-chain medical courier manifest for VitalCare.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Live Freight Manifest & Loading Dock Queue',
      columns: ['Waybill', 'Route / Cargo', 'Dock / Van', 'Status'],
      initialRows: [
        ['SWP-9041', 'JKIA → Westlands Tech Cargo', 'Dock A · Van 04', 'Loading'],
        ['SWP-9042', 'Mombasa → Nairobi Cold Chain', 'Dock B · Van 02', 'Cleared'],
        ['SWP-9043', 'Kigali Cross-Border Airfreight', 'Bay 03', 'Dispatched'],
        ['SWP-9044', 'CBD Same-Day Parcel Batch', 'Conveyor 1', 'Sorting'],
      ],
      incomingQueue: [
        ['SWP-9045', 'Nakuru Solar Inverter Pallets', 'Dock A · Van 01', 'Arriving'],
        ['SWP-9046', 'Medical Diagnostic Reagents', 'Express Van 05', 'Priority'],
      ],
    },
    projectWork: {
      fileName: 'dispatch/route-optimizer.ts',
      language: 'Dispatch TS',
      accent: '#f97316',
      codeLines: [
        'export const fleetTelemetry = {',
        '  activeVans: 14, conveyorThroughputHr: 420,',
        '  dockBaysOccupied: ["Dock-A", "Dock-B"], slaOnTimePct: 99.2',
        '};',
      ],
      terminalOutput: 'Conveyor sortation active · 420 parcels/hr · 2 loading docks green',
      deliverables: [
        { label: 'Morning JKIA cargo manifest cleared', done: true },
        { label: 'Automated conveyor laser scanner calibrated', done: true },
        { label: 'Afternoon Kampala express convoy dispatch', done: false },
      ],
    },
    jobApp: {
      appType: 'executive',
      appTabLabel: 'Fleet Dispatch',
      appName: 'SwiftPort Cargo & Logistics · Operations Control Tower',
      kpis: [
        { label: 'Active Fleet', value: '14 Vans', delta: '+2 Docks' },
        { label: 'Sort Rate', value: '420/hr', delta: 'Belt Live' },
        { label: 'On-Time SLA', value: '99.2%', delta: 'Nominal' },
      ],
      chartBars: [0.76, 0.88, 0.94, 0.85, 0.91, 0.97],
      chartLabels: ['Dock A', 'Dock B', 'Belt', 'Customs', 'JKIA', 'CBD'],
      visualHeadline: 'SwiftPort Logistics · Automated Parcel Sortation & Freight Yard',
      visualSubline: 'East loading docks active · Fleet vans entering & exiting freight road',
      visualItems: [
        { title: 'Parcel Sorting Conveyor', meta: 'High-speed barcode scan belt live', status: 'Running' },
        { title: 'East Freight Loading Yard', meta: '2 roll-up dock bays & pallet staging', status: 'Active' },
        { title: 'Customs & Waybill Desk', meta: 'Real-time corridor GPS tracking', status: 'Online' },
      ],
    },
  },
  realestate: {
    stationKey: 'realestate',
    projectTitle: 'TerraCraft · Property Brokerage, Construction BIM & Interiors',
    clientName: 'TerraCraft Estates, Build & Interiors',
    primaryMode: 'project',
    browserSessions: [
      {
        tabTitle: 'Sustainable Architecture & Mixed-Use Development',
        url: 'https://en.wikipedia.org/wiki/Sustainable_architecture',
        searchQuery: 'tropical modern architecture structural concrete interiors nairobi',
        articleTitle: 'Turnkey Real Estate Development, Structural Build & Interior Fit-Out',
        articleDomain: 'en.wikipedia.org',
        sections: [
          {
            heading: 'Integrated Design-Build Delivery',
            excerpt: 'Combining land acquisition, structural engineering, and bespoke interior curation cuts residential & commercial handover timelines by 28%.',
            highlight: 'Karen Ridge Villa Phase II structural frame 100% topped out; interior travertine & cedar joinery underway.',
          },
        ],
        researchNote: 'Updated material BoQ & apartment yield projections for Q4 investor pack.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Unified Property Listings, Site Works & Interior Fit-Outs',
      columns: ['Project / Unit', 'Division', 'Milestone', 'Status'],
      initialRows: [
        ['Karen Ridge Villa 04', 'Real Estate', 'KES 82.0M · Title Ready', 'Under Offer'],
        ['Upper Hill Lofts B2', 'Construction', 'Slab Pour & MEP Rough-In', 'On Track 84%'],
        ['Hub Exec Suite Refit', 'Interiors', 'Smoked Oak & Marble Joinery', 'Installing'],
        ['Kilimani Sky Duplex', 'Turnkey 3-in-1', 'Staging & Handover Pack', 'Ready'],
      ],
      incomingQueue: [
        ['Westlands Office Pod', 'Interiors', 'Acoustic Baffles & Lighting', 'Approved'],
        ['Lavington Townhouse 9', 'Construction', 'Structural Steel Roof Truss', 'Inspection OK'],
      ],
    },
    projectWork: {
      fileName: 'bim/terracraft-turnkey-schedule.ts',
      language: 'BIM & Costing',
      accent: '#e07a5f',
      codeLines: [
        'export const turnkeyProject = {',
        '  asset: "Karen Ridge Villa 04", grossYieldPct: 9.4,',
        '  structuralPhase: "Roof & Glazing Complete",',
        '  interiorPackage: "Travertine + Cedar + Warm Bronze"',
        '};',
      ],
      terminalOutput: 'BIM clash check: 0 conflicts · 14 active builds · 9 turnkey units listed',
      deliverables: [
        { label: '3D masterplan scale model updated with Phase II villas', done: true },
        { label: 'Structural steel & concrete cube strength sign-off', done: true },
        { label: 'Bespoke furniture & lighting installation schedule', done: false },
      ],
    },
    jobApp: {
      appType: 'design',
      appTabLabel: '3-in-1 Studio',
      appName: 'TerraCraft · Real Estate, Construction & Interior Pipeline',
      kpis: [
        { label: 'Portfolio', value: 'KES 1.4B', delta: '9 Active' },
        { label: 'Sites Active', value: '14 Builds', delta: '96% SLA' },
        { label: 'Fit-Outs', value: '11 Studios', delta: 'On Spec' },
      ],
      chartBars: [0.82, 0.91, 0.76, 0.94, 0.88, 0.96],
      chartLabels: ['Listings', 'Escrow', 'Excavation', 'Structure', 'Joinery', 'Styling'],
      visualHeadline: 'TerraCraft Hub · Brokerage Gallery, Construction BIM & Material Atelier',
      visualSubline: '3D property scale model live · Structural & interior fit-out teams synced',
      visualItems: [
        { title: 'Real Estate & Masterplan Desk', meta: 'Commercial & luxury villa portfolio', status: 'Closing' },
        { title: 'Structural Build & Yard Ops', meta: 'Tower crane & concrete QA active', status: 'Building' },
        { title: 'Interior Design Material Atelier', meta: 'Stone, oak & bespoke furniture curation', status: 'Styling' },
      ],
    },
  },
};
