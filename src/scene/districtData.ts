import type { WorkstationProfile } from './workstations';

export type BuildingId =
  | 'hub'
  | 'restaurant'
  | 'dealership'
  | 'bank'
  | 'crypto'
  | 'travel'
  | 'tourism'
  | 'medical';

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
    w: 40,
    d: 11,
    h: 26.6,
    floors: 6,
    floorH: 4.2,
    groundY: 0,
    doorX: 0,
    doorZ: 11.0,
    doorSide: 'south',
    description: '6-floor digital engineering, AI, marketing, executive suite & dual basement infrastructure hub.',
    overviewCam: { p: [0, 16, 49], t: [0, 12.2, 4] },
  },
  {
    id: 'restaurant',
    name: 'Savanna Bistro & Grill',
    shortName: 'Restaurant',
    niche: 'Fine Dining & Terrace Kitchen',
    accent: '#f59e0b',
    accentHex: 0xf59e0b,
    cx: -36,
    cz: 0,
    w: 22,
    d: 20,
    h: 16.8,
    floors: 4,
    floorH: 4.2,
    groundY: -0.62,
    doorX: -36,
    doorZ: 10.0,
    doorSide: 'south',
    description: 'Wood-fired open kitchen, espresso & cocktail bar, sidewalk dining terrace and private dining floors.',
    overviewCam: { p: [-36, 12.5, 34], t: [-36, 4.5, 2] },
  },
  {
    id: 'dealership',
    name: 'Apex Motors Showroom',
    shortName: 'Car Dealership',
    niche: 'Luxury Auto & EV Dealership',
    accent: '#ef4444',
    accentHex: 0xef4444,
    cx: 35,
    cz: 1,
    w: 20,
    d: 18,
    h: 13.6,
    floors: 3,
    floorH: 4.4,
    groundY: -0.62,
    doorX: 35,
    doorZ: 10.0,
    doorSide: 'south',
    description: 'Glass automotive pavilion with rotating hero turntable, EV & SUV fleet display, and financing lounge.',
    overviewCam: { p: [35, 11.5, 32], t: [35, 3.8, 1.5] },
  },
  {
    id: 'bank',
    name: 'Nairobi Trust Bank',
    shortName: 'Bank',
    niche: 'Commercial Banking & Vault HQ',
    accent: '#3b82f6',
    accentHex: 0x3b82f6,
    cx: -62,
    cz: -4,
    w: 24,
    d: 22,
    h: 25.2,
    floors: 6,
    floorH: 4.2,
    groundY: -0.62,
    doorX: -62,
    doorZ: 7.0,
    doorSide: 'south',
    description: 'Granite portico bank hall with 24/7 ATM vestibule, curved teller desks, steel vault and FX treasury.',
    overviewCam: { p: [-62, 15, 34], t: [-62, 7.5, -3] },
  },
  {
    id: 'crypto',
    name: 'BitVault Crypto Exchange',
    shortName: 'Crypto',
    niche: 'Digital Assets & Quant Trading',
    accent: '#10b981',
    accentHex: 0x10b981,
    cx: 60,
    cz: -2,
    w: 24,
    d: 20,
    h: 21.0,
    floors: 5,
    floorH: 4.2,
    groundY: -0.62,
    doorX: 60,
    doorZ: 8.0,
    doorSide: 'south',
    description: 'Live market ticker facade, dual-screen quant trading pods, cold-storage vault pod and validator nodes.',
    overviewCam: { p: [60, 14, 34], t: [60, 6.2, -1] },
  },
  {
    id: 'travel',
    name: 'Skyline Travel & Aviation',
    shortName: 'Travel',
    niche: 'Global Flights & Visa Concierge',
    accent: '#38bdf8',
    accentHex: 0x38bdf8,
    cx: -30,
    cz: 88,
    w: 30,
    d: 18,
    h: 16.8,
    floors: 4,
    floorH: 4.2,
    groundY: -0.62,
    doorX: -30,
    doorZ: 79.0,
    doorSide: 'north',
    description: 'Airport-inspired terminal lounge with live flight departure board, rotating globe and ticket counters.',
    overviewCam: { p: [-30, 13.5, 53], t: [-30, 5.2, 86] },
  },
  {
    id: 'tourism',
    name: 'Kenya Safari & Tourism',
    shortName: 'Tourism',
    niche: 'Expeditions & Eco-Lodges',
    accent: '#84cc16',
    accentHex: 0x84cc16,
    cx: 28,
    cz: 90,
    w: 34,
    d: 18,
    h: 16.8,
    floors: 4,
    floorH: 4.2,
    groundY: -0.62,
    doorX: 28,
    doorZ: 81.0,
    doorSide: 'north',
    description: 'Topographical Mt. Kenya & Mara relief map gallery, expedition 4x4 showcase and safari planning desks.',
    overviewCam: { p: [28, 14, 54], t: [28, 5.2, 88] },
  },
  {
    id: 'medical',
    name: 'VitalCare Medical & Pharmacy',
    shortName: 'Medical',
    niche: 'Diagnostics & 24h Pharmacy',
    accent: '#2dd4bf',
    accentHex: 0x2dd4bf,
    cx: 0,
    cz: -24,
    w: 52,
    d: 16,
    h: 21.0,
    floors: 5,
    floorH: 4.2,
    groundY: -0.62,
    doorX: 0,
    doorZ: -16.0,
    doorSide: 'south',
    description: 'Illuminated pharmacy dispensary, patient triage lobby, diagnostic imaging labs and 24-hour wellness care.',
    overviewCam: { p: [0, 18, 12], t: [0, 6.0, -24] },
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
    'Preparing the hybrid SUV on the turntable for a 2:00 PM executive test drive.',
    'Comparing lease-to-own financing terms and 5-year battery warranty coverage.',
    'Polishing the crimson showroom flagship and verifying tire pressure telemetry.',
    'Walking a fleet buyer through EV charging efficiency across Nairobi.',
  ],
  bank: [
    'Clearing RTGS commercial settlements and balancing branch teller cash drawers.',
    'Updating live KES / USD / EUR treasury spreads on the main banking hall board.',
    'Verifying biometric dual-custody lock protocols on the main steel vault.',
    'Helping a corporate client structure cross-border trade letters of credit.',
  ],
  crypto: [
    'Monitoring BTC/USDT orderbook depth and cold-storage multi-sig quorum.',
    'Validator node consensus latency is steady at 14ms with zero missed blocks.',
    'Auditing smart-contract treasury sweeps before London session volatility.',
    'Comparing spot liquidity spreads across East African stablecoin rails.',
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
    'Verifying cold-chain vaccine storage temperatures across pharmacy rack B.',
    'Reviewing CBC blood panel results and preparing patient consultation notes.',
    'Dispensing prescriptions cleanly at window one with zero queue backlog.',
    'Calibrating diagnostic vitals telemetry for the afternoon wellness checkups.',
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
        tabTitle: 'Kenya Highland Coffee & Produce Sourcing',
        url: 'https://kitchen.savannabistro.co.ke/suppliers',
        searchQuery: 'nyeri aa espresso roast profile organic farms nairobi',
        articleTitle: 'Seasonal Highland Harvest & Farm-to-Table Cold Chain',
        articleDomain: 'kitchen.savannabistro.co.ke',
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
        tabTitle: '2026 Hybrid & EV Fleet Specs',
        url: 'https://portal.apexmotors.co.ke/models/flagship-ev',
        searchQuery: 'awd hybrid suv torque range warranty specifications kenya',
        articleTitle: 'Apex Flagship AWD Hybrid & Zero-Emission Fleet Benchmarks',
        articleDomain: 'portal.apexmotors.co.ke',
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
        tabTitle: 'Central Bank FX & Interbank Rates',
        url: 'https://treasury.nairobitrust.co.ke/fx-desk',
        searchQuery: 'cbk interbank rate kes usd eur gbp settlement liquidity',
        articleTitle: 'East Africa Interbank FX & RTGS Settlement Window',
        articleDomain: 'treasury.nairobitrust.co.ke',
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
      visualHeadline: 'Nairobi Trust Bank · Retail Hall & Treasury Operations',
      visualSubline: 'Curved teller hall serving clients · Biometric main vault monitored',
      visualItems: [
        { title: 'Retail Teller Hall', meta: 'Avg wait time 2m 40s', status: 'Open' },
        { title: 'FX & Trade Finance Desk', meta: 'USD / EUR / GBP quotes live', status: 'Active' },
        { title: 'Main Steel Vault', meta: 'Time-lock & seismic sensors nominal', status: 'Secure' },
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
        tabTitle: 'Validator Consensus & Cold Custody Monitor',
        url: 'https://ops.bitvault.exchange/validators',
        searchQuery: 'multi-sig hardware security module ethereum solana validator finality',
        articleTitle: 'Multi-Sig MPC Cold Custody & High-Frequency Matching Engine',
        articleDomain: 'ops.bitvault.exchange',
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
        tabTitle: 'JKIA Flight Schedules & Visa Advisory',
        url: 'https://gds.skylinetravel.co.ke/departures',
        searchQuery: 'nbo jkia departures london dubai johannesburg kigali visa status',
        articleTitle: 'Live JKIA International Departures & Corporate Fare Classes',
        articleDomain: 'gds.skylinetravel.co.ke',
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
        tabTitle: 'Maasai Mara & Mt. Kenya Trail Conditions',
        url: 'https://dispatch.kenyasafari.co.ke/parks-2026',
        searchQuery: 'maasai mara amboseli conservancy lodge availability safari 4x4',
        articleTitle: 'National Park Wildlife Corridors & 4x4 Expedition Dispatch',
        articleDomain: 'dispatch.kenyasafari.co.ke',
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
        tabTitle: 'Clinical Diagnostics & Cold-Chain Pharmacy',
        url: 'https://ehr.vitalcare.co.ke/clinical-ops',
        searchQuery: 'automated hematology lab panel cold chain pharmacy storage 2-8c',
        articleTitle: '24-Hour Clinical Triage & Automated Dispensary Protocols',
        articleDomain: 'ehr.vitalcare.co.ke',
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
};
