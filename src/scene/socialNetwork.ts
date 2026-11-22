import type { BuildingId } from './districtData';

export type SocialPlatformId = 'hubpulse' | 'worklink' | 'swiftchat';
export type JobStatus = 'Queued' | 'In Progress' | 'Completed';
export type JobPriority = 'Normal' | 'Urgent';
export type DispatchDevice = 'Monitor' | 'Phone';

export interface CompanySocialDirectoryEntry {
  id: BuildingId;
  name: string;
  shortName: string;
  handle: string;
  channel: string;
  accent: string;
  niche: string;
}

export interface SocialJobUpdate {
  time: string;
  author: string;
  text: string;
}

export interface SocialJobTask {
  id: string;
  code: string;
  platform: SocialPlatformId;
  channel: string;
  title: string;
  brief: string;
  priority: JobPriority;
  fromBuilding: BuildingId;
  fromName: string;
  fromHandle: string;
  sourceDevice: DispatchDevice;
  toBuilding: BuildingId;
  toCompanyName: string;
  toChannel: string;
  assignedWorker: string;
  assignedRole: string;
  status: JobStatus;
  progress: number;
  createdAtLabel: string;
  updates: SocialJobUpdate[];
}

export interface SocialPost {
  id: string;
  platform: SocialPlatformId;
  channel: string;
  buildingId: BuildingId;
  buildingName: string;
  accent: string;
  authorName: string;
  authorHandle: string;
  authorRole: string;
  device: DispatchDevice;
  body: string;
  timeLabel: string;
  likes: number;
  replies: number;
  linkedJobCode?: string;
}

export interface DispatchJobInput {
  platform: SocialPlatformId;
  channel?: string;
  fromBuilding: BuildingId;
  fromName: string;
  sourceDevice: DispatchDevice;
  toBuilding: BuildingId;
  title: string;
  brief: string;
  priority?: JobPriority;
}

export interface PublishPostInput {
  platform: SocialPlatformId;
  channel?: string;
  buildingId: BuildingId;
  authorName: string;
  authorRole: string;
  device: DispatchDevice;
  body: string;
}

export const DISTRICT_SOCIAL_DIRECTORY: Record<BuildingId, CompanySocialDirectoryEntry> = {
  hub: {
    id: 'hub',
    name: 'DomainTechHub Office',
    shortName: 'DomainTechHub',
    handle: '@domaintechhub',
    channel: '#tech-dispatch',
    accent: '#6fe3a1',
    niche: 'Software & Digital Agency',
  },
  restaurant: {
    id: 'restaurant',
    name: 'Savanna Bistro & Grill',
    shortName: 'Savanna Bistro',
    handle: '@savannabistro',
    channel: '#bistro-catering',
    accent: '#f59e0b',
    niche: 'Fine Dining & Catering',
  },
  dealership: {
    id: 'dealership',
    name: 'Apex Motors Showroom',
    shortName: 'Apex Motors',
    handle: '@apexmotors.ke',
    channel: '#fleet-motors',
    accent: '#ef4444',
    niche: 'EV Sales & Fleet',
  },
  bank: {
    id: 'bank',
    name: 'Nairobi Trust Bank',
    shortName: 'Nairobi Trust',
    handle: '@nairobitrust',
    channel: '#bank-treasury',
    accent: '#3b82f6',
    niche: 'Banking & FX Treasury',
  },
  crypto: {
    id: 'crypto',
    name: 'BitVault Crypto Exchange',
    shortName: 'BitVault',
    handle: '@bitvault.dex',
    channel: '#crypto-desk',
    accent: '#10b981',
    niche: 'Digital Assets & Custody',
  },
  travel: {
    id: 'travel',
    name: 'Skyline Travel & Aviation',
    shortName: 'Skyline Travel',
    handle: '@skylinetravel',
    channel: '#travel-aviation',
    accent: '#38bdf8',
    niche: 'Flights & Visa Concierge',
  },
  tourism: {
    id: 'tourism',
    name: 'Kenya Safari & Tourism',
    shortName: 'Kenya Safari',
    handle: '@kenyasafari',
    channel: '#safari-tours',
    accent: '#84cc16',
    niche: 'Expeditions & Lodges',
  },
  medical: {
    id: 'medical',
    name: 'VitalCare Medical & Pharmacy',
    shortName: 'VitalCare Med',
    handle: '@vitalcare.rx',
    channel: '#vitalcare-rx',
    accent: '#2dd4bf',
    niche: 'Diagnostics & 24h Rx',
  },
  logistics: {
    id: 'logistics',
    name: 'SwiftPort Cargo & Logistics',
    shortName: 'SwiftPort',
    handle: '@swiftport.cargo',
    channel: '#swiftport-cargo',
    accent: '#f97316',
    niche: 'Freight & Express Fleet',
  },
};

export const DISTRICT_SOCIAL_CHANNELS: string[] = [
  '#all-district',
  '#tech-dispatch',
  '#bistro-catering',
  '#fleet-motors',
  '#bank-treasury',
  '#crypto-desk',
  '#travel-aviation',
  '#safari-tours',
  '#vitalcare-rx',
  '#swiftport-cargo',
];

function formatSimClock(simMin: number): string {
  const m = ((Math.floor(simMin) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function makeHandle(name: string): string {
  const clean = name
    .toLowerCase()
    .replace(/^dr\.\s*/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.');
  return `@${clean || 'staff'}`;
}

const ORGANIC_JOB_TEMPLATES: Array<{
  platform: SocialPlatformId;
  from: BuildingId;
  to: BuildingId;
  title: string;
  brief: string;
  device: DispatchDevice;
  priority: JobPriority;
}> = [
  {
    platform: 'worklink',
    from: 'hub',
    to: 'bank',
    title: 'Sync M-Pesa Merchant Settlement Webhook',
    brief: 'Verify RTGS & mobile money API callback signatures on Teller Terminal 2.',
    device: 'Monitor',
    priority: 'Normal',
  },
  {
    platform: 'swiftchat',
    from: 'travel',
    to: 'tourism',
    title: 'Assign 4x4 Land Cruiser for Maasai Mara VIPs',
    brief: 'Flight KQ 100 passengers arriving 14:30 need safari guide & camp check-in.',
    device: 'Phone',
    priority: 'Urgent',
  },
  {
    platform: 'hubpulse',
    from: 'restaurant',
    to: 'logistics',
    title: 'Cold-Chain Nyeri Coffee Bean Express Pickup',
    brief: 'Dispatch 40 kg roasted beans from warehouse dock B before evening dinner rush.',
    device: 'Phone',
    priority: 'Normal',
  },
  {
    platform: 'worklink',
    from: 'dealership',
    to: 'hub',
    title: 'Update Apex EV Showroom Configurator Pricing',
    brief: 'Push Q3 KES lease calculator updates & charge-station map onto showroom kiosks.',
    device: 'Monitor',
    priority: 'Normal',
  },
  {
    platform: 'swiftchat',
    from: 'medical',
    to: 'logistics',
    title: 'Stat Refrigerated Vaccine & Reagent Transfer',
    brief: 'Keep carrier crate at 2–8°C from SwiftPort medical bay directly to Pharmacy Desk.',
    device: 'Phone',
    priority: 'Urgent',
  },
  {
    platform: 'worklink',
    from: 'crypto',
    to: 'bank',
    title: 'Clear Institutional KES Liquidity Settlement',
    brief: 'Match OTC desk wire reference NT-8841 against Nairobi Trust treasury desk.',
    device: 'Monitor',
    priority: 'Normal',
  },
];

class DistrictSocialNetwork {
  private jobs: SocialJobTask[] = [];
  private posts: SocialPost[] = [];
  private workerRoster = new Map<BuildingId, Array<{ name: string; role: string }>>();
  private listeners = new Set<() => void>();
  private nextJobNumber = 109;
  private nextPostNumber = 30;
  private currentSimMin = 9 * 60 + 25;
  private tickAccum = 0;
  private organicAccum = 0;
  private organicIdx = 0;

  constructor() {
    this.seedInitialState();
  }

  private seedInitialState() {
    const seededJobs: SocialJobTask[] = [
      {
        id: 'job-101',
        code: 'JOB-101',
        platform: 'worklink',
        channel: '#bistro-catering',
        title: 'Boardroom Executive Lunch & Espresso Order',
        brief: 'Prepare 12 wood-fired platters & Nyeri AA espresso service for DomainTechHub L4 Board Room.',
        priority: 'Urgent',
        fromBuilding: 'hub',
        fromName: 'Faith Nyambura',
        fromHandle: '@faith.nyambura',
        sourceDevice: 'Monitor',
        toBuilding: 'restaurant',
        toCompanyName: 'Savanna Bistro & Grill',
        toChannel: '#bistro-catering',
        assignedWorker: 'Maître D’ & Kitchen Pass',
        assignedRole: 'Hospitality & Kitchen Desk',
        status: 'In Progress',
        progress: 64,
        createdAtLabel: '09:05',
        updates: [
          { time: '09:06', author: 'Head Chef', text: 'Grill tickets queued at Hearth Pass.' },
          { time: '09:18', author: 'Maître D’ Host', text: 'Packaging hot platters & espresso flasks.' },
        ],
      },
      {
        id: 'job-102',
        code: 'JOB-102',
        platform: 'swiftchat',
        channel: '#bank-treasury',
        title: 'Approve Corporate EV Fleet Lease Facility',
        brief: 'Issue credit clearance & KES 18.4M wire facility for 3 Apex EV Fleet Sedans.',
        priority: 'Urgent',
        fromBuilding: 'dealership',
        fromName: 'Apex Lease Desk',
        fromHandle: '@apexmotors.ke',
        sourceDevice: 'Phone',
        toBuilding: 'bank',
        toCompanyName: 'Nairobi Trust Bank',
        toChannel: '#bank-treasury',
        assignedWorker: 'Branch Teller 1',
        assignedRole: 'Retail & RTGS Desk',
        status: 'In Progress',
        progress: 48,
        createdAtLabel: '09:10',
        updates: [
          { time: '09:12', author: 'Branch Teller 1', text: 'KYC docs verified via WorkLink channel.' },
        ],
      },
      {
        id: 'job-103',
        code: 'JOB-103',
        platform: 'worklink',
        channel: '#vitalcare-rx',
        title: 'Deploy Automated WhatsApp Triage & Rx Refills',
        brief: 'Connect DomainTechHub AI triage bot directly to VitalCare patient queue & lab alerts.',
        priority: 'Normal',
        fromBuilding: 'hub',
        fromName: 'AI Solutions Team',
        fromHandle: '@domaintechhub',
        sourceDevice: 'Monitor',
        toBuilding: 'medical',
        toCompanyName: 'VitalCare Medical & Pharmacy',
        toChannel: '#vitalcare-rx',
        assignedWorker: 'Lead Pharmacist & Triage',
        assignedRole: '24h Pharmacy & Intake',
        status: 'In Progress',
        progress: 72,
        createdAtLabel: '08:50',
        updates: [
          { time: '09:02', author: 'Clinical Lab', text: 'Diagnostic lab webhook tested OK.' },
        ],
      },
      {
        id: 'job-104',
        code: 'JOB-104',
        platform: 'hubpulse',
        channel: '#swiftport-cargo',
        title: 'Deliver LiFePO4 UPS Rack Modules to Hub B2',
        brief: 'Express van dispatch from East Loading Dock with 4 battery packs for Power Room telemetry.',
        priority: 'Urgent',
        fromBuilding: 'logistics',
        fromName: 'Freight Dispatch Manager',
        fromHandle: '@swiftport.cargo',
        sourceDevice: 'Monitor',
        toBuilding: 'hub',
        toCompanyName: 'DomainTechHub Office',
        toChannel: '#tech-dispatch',
        assignedWorker: 'George Gitonga',
        assignedRole: 'Power & Server Ops',
        status: 'In Progress',
        progress: 58,
        createdAtLabel: '09:12',
        updates: [
          { time: '09:16', author: 'SwiftPort Van 04', text: 'Cleared East gate — unloading at B2 dock.' },
        ],
      },
      {
        id: 'job-105',
        code: 'JOB-105',
        platform: 'swiftchat',
        channel: '#safari-tours',
        title: 'Coordinate JKIA Arrivals → Mara Eco-Lodge',
        brief: 'Sync Flight KQ 100 manifest with Kenya Safari 4x4 convoy & Amboseli lodge check-in.',
        priority: 'Normal',
        fromBuilding: 'travel',
        fromName: 'Skyline Check-In',
        fromHandle: '@skylinetravel',
        sourceDevice: 'Phone',
        toBuilding: 'tourism',
        toCompanyName: 'Kenya Safari & Tourism',
        toChannel: '#safari-tours',
        assignedWorker: 'Safari Expedition Planner',
        assignedRole: 'Expedition Desk',
        status: 'Queued',
        progress: 22,
        createdAtLabel: '09:20',
        updates: [
          { time: '09:21', author: 'Skyline Travel', text: 'Sent e-tickets via SwiftChat mobile.' },
        ],
      },
      {
        id: 'job-106',
        code: 'JOB-106',
        platform: 'worklink',
        channel: '#crypto-desk',
        title: 'Cross-Verify MPC Cold Vault Proof-of-Reserves',
        brief: 'Publish morning USDT/KES treasury liquidity snapshot across BitVault & Nairobi Trust channels.',
        priority: 'Normal',
        fromBuilding: 'bank',
        fromName: 'FX Treasury Desk',
        fromHandle: '@nairobitrust',
        sourceDevice: 'Monitor',
        toBuilding: 'crypto',
        toCompanyName: 'BitVault Crypto Exchange',
        toChannel: '#crypto-desk',
        assignedWorker: 'MPC Custody Auditor',
        assignedRole: 'Trading & Custody',
        status: 'In Progress',
        progress: 80,
        createdAtLabel: '08:58',
        updates: [
          { time: '09:14', author: 'Quant Spot Trader', text: '5/7 MPC shards signed & published.' },
        ],
      },
      {
        id: 'job-107',
        code: 'JOB-107',
        platform: 'hubpulse',
        channel: '#fleet-motors',
        title: 'Prepare 2 Test-Drive Apex EV Sedans for CEO Suite',
        brief: 'Charge Apex Executive EVs to 95% and send booking pass to DomainTechHub Reception.',
        priority: 'Normal',
        fromBuilding: 'hub',
        fromName: 'Samuel Njoroge',
        fromHandle: '@samuel.njoroge',
        sourceDevice: 'Phone',
        toBuilding: 'dealership',
        toCompanyName: 'Apex Motors Showroom',
        toChannel: '#fleet-motors',
        assignedWorker: 'EV Fleet Advisor',
        assignedRole: 'Showroom Sales',
        status: 'Queued',
        progress: 18,
        createdAtLabel: '09:22',
        updates: [
          { time: '09:22', author: 'CEO Phone', text: 'Dispatched via HubPulse mobile app.' },
        ],
      },
      {
        id: 'job-108',
        code: 'JOB-108',
        platform: 'worklink',
        channel: '#travel-aviation',
        title: 'Process Multi-City Tech Summit Visa Packet',
        brief: 'Fast-track Schengen & London LHR boarding confirmations for 4 Hub engineers.',
        priority: 'Normal',
        fromBuilding: 'hub',
        fromName: 'Lilian Mutua',
        fromHandle: '@lilian.mutua',
        sourceDevice: 'Monitor',
        toBuilding: 'travel',
        toCompanyName: 'Skyline Travel & Aviation',
        toChannel: '#travel-aviation',
        assignedWorker: 'Flight & Visa Agent 1',
        assignedRole: 'Ticketing Counter',
        status: 'Completed',
        progress: 100,
        createdAtLabel: '08:40',
        updates: [
          { time: '09:08', author: 'Flight & Visa Agent 1', text: 'Boarding passes synced to staff phones.' },
        ],
      },
    ];

    const seededPosts: SocialPost[] = [
      {
        id: 'post-1',
        platform: 'hubpulse',
        channel: '#all-district',
        buildingId: 'hub',
        buildingName: 'DomainTechHub Office',
        accent: '#6fe3a1',
        authorName: 'Amina Ochieng',
        authorHandle: '@amina.ochieng',
        authorRole: 'Lead Product Architect',
        device: 'Monitor',
        body: 'District-wide WorkLink & SwiftChat channels are live across every monitor and phone — tag any company #channel to dispatch jobs!',
        timeLabel: '09:20',
        likes: 34,
        replies: 8,
      },
      {
        id: 'post-2',
        platform: 'hubpulse',
        channel: '#bistro-catering',
        buildingId: 'restaurant',
        buildingName: 'Savanna Bistro & Grill',
        accent: '#f59e0b',
        authorName: 'Savanna Kitchen Pass',
        authorHandle: '@savannabistro',
        authorRole: 'Wood-Fired Kitchen',
        device: 'Monitor',
        body: 'Fresh sourdough flatbreads & single-origin Nyeri AA espresso bar open now. Ping #bistro-catering from your desk or phone for office drops.',
        timeLabel: '09:16',
        likes: 28,
        replies: 6,
        linkedJobCode: 'JOB-101',
      },
      {
        id: 'post-3',
        platform: 'swiftchat',
        channel: '#fleet-motors',
        buildingId: 'dealership',
        buildingName: 'Apex Motors Showroom',
        accent: '#ef4444',
        authorName: 'Apex Lease Concierge',
        authorHandle: '@apexmotors.ke',
        authorRole: 'EV Showroom',
        device: 'Phone',
        body: 'Mobile ping to @nairobitrust: Lease dossier #APX-44 uploaded — ready for RTGS treasury sign-off.',
        timeLabel: '09:14',
        likes: 15,
        replies: 3,
        linkedJobCode: 'JOB-102',
      },
      {
        id: 'post-4',
        platform: 'worklink',
        channel: '#crypto-desk',
        buildingId: 'crypto',
        buildingName: 'BitVault Crypto Exchange',
        accent: '#10b981',
        authorName: 'BitVault Custody Pod',
        authorHandle: '@bitvault.dex',
        authorRole: 'Quant Trading Floor',
        device: 'Monitor',
        body: 'BTC/USDT holding $94,280. Cold vault 5/7 MPC signatures verified; institutional FX bridge open with Nairobi Trust Bank.',
        timeLabel: '09:11',
        likes: 22,
        replies: 5,
        linkedJobCode: 'JOB-106',
      },
      {
        id: 'post-5',
        platform: 'swiftchat',
        channel: '#vitalcare-rx',
        buildingId: 'medical',
        buildingName: 'VitalCare Medical & Pharmacy',
        accent: '#2dd4bf',
        authorName: 'Triage Counter',
        authorHandle: '@vitalcare.rx',
        authorRole: '24h Clinic & Rx',
        device: 'Phone',
        body: 'Cold-chain telemetry nominal at 4.1°C. Receiving AI triage booking updates via SwiftChat mobile.',
        timeLabel: '09:07',
        likes: 19,
        replies: 4,
        linkedJobCode: 'JOB-103',
      },
      {
        id: 'post-6',
        platform: 'worklink',
        channel: '#swiftport-cargo',
        buildingId: 'logistics',
        buildingName: 'SwiftPort Cargo & Logistics',
        accent: '#f97316',
        authorName: 'East Dock Dispatch',
        authorHandle: '@swiftport.cargo',
        authorRole: 'Freight Control',
        device: 'Monitor',
        body: 'Automated conveyor belt sorting 420 parcels/hr. Express Van 04 en route across boulevard with Hub B2 rack batteries.',
        timeLabel: '09:03',
        likes: 17,
        replies: 2,
        linkedJobCode: 'JOB-104',
      },
      {
        id: 'post-7',
        platform: 'hubpulse',
        channel: '#safari-tours',
        buildingId: 'tourism',
        buildingName: 'Kenya Safari & Tourism',
        accent: '#84cc16',
        authorName: 'Safari Expedition Desk',
        authorHandle: '@kenyasafari',
        authorRole: 'Expeditions & Lodges',
        device: 'Phone',
        body: 'Amboseli skies crystal clear & Maasai Mara migration corridor active! Pairing with @skylinetravel for instant tarmac-to-trail transfers.',
        timeLabel: '08:58',
        likes: 41,
        replies: 9,
        linkedJobCode: 'JOB-105',
      },
    ];

    this.jobs = seededJobs;
    this.posts = seededPosts;
  }

  public registerWorker(buildingId: BuildingId, name: string, role: string) {
    let list = this.workerRoster.get(buildingId);
    if (!list) {
      list = [];
      this.workerRoster.set(buildingId, list);
    }
    if (!list.some((w) => w.name === name)) {
      list.push({ name, role });
    }
    // Reassign default placeholder jobs to real character names in this building
    for (const j of this.jobs) {
      if (j.toBuilding === buildingId && j.assignedRole !== 'Assigned Staff' && list.length > 0) {
        const picked = list[Math.abs(j.code.charCodeAt(j.code.length - 1)) % list.length];
        if (picked) {
          j.assignedWorker = picked.name;
          j.assignedRole = picked.role;
        }
      }
    }
  }

  private pickWorkerForBuilding(buildingId: BuildingId): { name: string; role: string } {
    const list = this.workerRoster.get(buildingId);
    if (list && list.length > 0) {
      return list[Math.floor(Math.random() * list.length)];
    }
    const dir = DISTRICT_SOCIAL_DIRECTORY[buildingId];
    return { name: `${dir.shortName} Specialist`, role: dir.niche };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const cb of this.listeners) {
      cb();
    }
  }

  public getJobs(filter?: { buildingId?: BuildingId; platform?: SocialPlatformId; channel?: string }): SocialJobTask[] {
    let out = this.jobs;
    if (filter?.buildingId) {
      out = out.filter((j) => j.toBuilding === filter.buildingId || j.fromBuilding === filter.buildingId);
    }
    if (filter?.platform) {
      out = out.filter((j) => j.platform === filter.platform);
    }
    if (filter?.channel && filter.channel !== '#all-district') {
      out = out.filter((j) => j.channel === filter.channel || j.toChannel === filter.channel);
    }
    return out;
  }

  public getBuildingQueue(buildingId: BuildingId): SocialJobTask[] {
    return this.jobs.filter((j) => j.toBuilding === buildingId);
  }

  public getActiveJobForBuilding(buildingId: BuildingId): SocialJobTask | undefined {
    return (
      this.jobs.find((j) => j.toBuilding === buildingId && j.status === 'In Progress') ||
      this.jobs.find((j) => j.toBuilding === buildingId && j.status === 'Queued') ||
      this.jobs.find((j) => j.toBuilding === buildingId)
    );
  }

  public getPosts(filter?: { platform?: SocialPlatformId; channel?: string; buildingId?: BuildingId }): SocialPost[] {
    let out = this.posts;
    if (filter?.platform) out = out.filter((p) => p.platform === filter.platform);
    if (filter?.channel && filter.channel !== '#all-district') out = out.filter((p) => p.channel === filter.channel);
    if (filter?.buildingId) out = out.filter((p) => p.buildingId === filter.buildingId);
    return out;
  }

  public getStatsSummary(): {
    totalJobs: number;
    activeJobs: number;
    queuedJobs: number;
    completedJobs: number;
    postCount: number;
  } {
    let activeJobs = 0;
    let queuedJobs = 0;
    let completedJobs = 0;
    for (const j of this.jobs) {
      if (j.status === 'In Progress') activeJobs++;
      else if (j.status === 'Queued') queuedJobs++;
      else completedJobs++;
    }
    return {
      totalJobs: this.jobs.length,
      activeJobs,
      queuedJobs,
      completedJobs,
      postCount: this.posts.length,
    };
  }

  public dispatchJob(input: DispatchJobInput): SocialJobTask {
    const targetDir = DISTRICT_SOCIAL_DIRECTORY[input.toBuilding];
    const fromDir = DISTRICT_SOCIAL_DIRECTORY[input.fromBuilding];
    const worker = this.pickWorkerForBuilding(input.toBuilding);
    const code = `JOB-${this.nextJobNumber++}`;
    const timeLabel = formatSimClock(this.currentSimMin);
    const channel = (input.channel || targetDir.channel).trim().slice(0, 40) || targetDir.channel;
    const safeTitle = input.title.trim().slice(0, 140) || 'District Task';
    const safeBrief = (input.brief.trim() || `Execute ${safeTitle} at ${targetDir.name}.`).slice(0, 320);
    const safeFromName = (input.fromName.trim() || fromDir.name).slice(0, 80);

    const job: SocialJobTask = {
      id: `job-${Date.now()}-${this.nextJobNumber}`,
      code,
      platform: input.platform,
      channel,
      title: safeTitle,
      brief: safeBrief,
      priority: input.priority || 'Normal',
      fromBuilding: input.fromBuilding,
      fromName: safeFromName,
      fromHandle: makeHandle(safeFromName || fromDir.shortName),
      sourceDevice: input.sourceDevice,
      toBuilding: input.toBuilding,
      toCompanyName: targetDir.name,
      toChannel: targetDir.channel,
      assignedWorker: worker.name,
      assignedRole: worker.role,
      status: 'In Progress',
      progress: 14,
      createdAtLabel: timeLabel,
      updates: [
        {
          time: timeLabel,
          author: safeFromName || fromDir.shortName,
          text: `Dispatched from ${input.sourceDevice} via ${input.platform.toUpperCase()} (${channel}).`,
        },
        {
          time: timeLabel,
          author: worker.name,
          text: `Accepted on workstation console — starting execution now.`,
        },
      ],
    };

    this.jobs = [job, ...this.jobs].slice(0, 32);

    const post: SocialPost = {
      id: `post-${this.nextPostNumber++}`,
      platform: input.platform,
      channel,
      buildingId: input.fromBuilding,
      buildingName: fromDir.name,
      accent: targetDir.accent,
      authorName: safeFromName || fromDir.shortName,
      authorHandle: makeHandle(safeFromName || fromDir.shortName),
      authorRole: `Sent via ${input.sourceDevice}`,
      device: input.sourceDevice,
      body: `[${code}] → ${targetDir.shortName} (${worker.name}): ${job.title}`,
      timeLabel,
      likes: 1,
      replies: 1,
      linkedJobCode: code,
    };
    this.posts = [post, ...this.posts].slice(0, 40);
    this.notify();
    return job;
  }

  public publishPost(input: PublishPostInput): SocialPost {
    const dir = DISTRICT_SOCIAL_DIRECTORY[input.buildingId];
    const timeLabel = formatSimClock(this.currentSimMin);
    const safeAuthorName = (input.authorName.trim() || dir.shortName).slice(0, 80);
    const safeAuthorRole = (input.authorRole.trim() || 'Team Member').slice(0, 80);
    const safeChannel = (input.channel || dir.channel).trim().slice(0, 40) || dir.channel;
    const safeBody = input.body.trim().slice(0, 400);

    const post: SocialPost = {
      id: `post-${this.nextPostNumber++}`,
      platform: input.platform,
      channel: safeChannel,
      buildingId: input.buildingId,
      buildingName: dir.name,
      accent: dir.accent,
      authorName: safeAuthorName,
      authorHandle: makeHandle(safeAuthorName),
      authorRole: safeAuthorRole,
      device: input.device,
      body: safeBody,
      timeLabel,
      likes: 1,
      replies: 0,
    };
    this.posts = [post, ...this.posts].slice(0, 40);
    this.notify();
    return post;
  }

  public advanceJob(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status === 'Completed') return;
    const timeLabel = formatSimClock(this.currentSimMin);
    if (job.status === 'Queued') {
      job.status = 'In Progress';
      job.progress = 38;
      job.updates.push({ time: timeLabel, author: job.assignedWorker, text: 'Picked up on monitor & actively processing.' });
    } else {
      job.progress = Math.min(100, job.progress + 34);
      if (job.progress >= 100) {
        this.completeJobInternal(job, timeLabel);
      } else {
        job.updates.push({ time: timeLabel, author: job.assignedWorker, text: `Milestone reached (${job.progress}%).` });
      }
    }
    this.notify();
  }

  public completeJob(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status === 'Completed') return;
    this.completeJobInternal(job, formatSimClock(this.currentSimMin));
    this.notify();
  }

  private completeJobInternal(job: SocialJobTask, timeLabel: string) {
    job.status = 'Completed';
    job.progress = 100;
    job.updates.push({
      time: timeLabel,
      author: job.assignedWorker,
      text: 'Task completed and synced across district channels.',
    });
    const toDir = DISTRICT_SOCIAL_DIRECTORY[job.toBuilding];
    const newPost: SocialPost = {
      id: `post-${this.nextPostNumber++}`,
      platform: job.platform,
      channel: job.channel,
      buildingId: job.toBuilding,
      buildingName: toDir.name,
      accent: toDir.accent,
      authorName: job.assignedWorker,
      authorHandle: makeHandle(job.assignedWorker),
      authorRole: job.assignedRole,
      device: 'Monitor',
      body: `Completed ${job.code}: ${job.title} for ${DISTRICT_SOCIAL_DIRECTORY[job.fromBuilding].shortName}.`,
      timeLabel,
      likes: 6,
      replies: 1,
      linkedJobCode: job.code,
    };
    this.posts = [newPost, ...this.posts].slice(0, 40);
  }

  public likePost(postId: string) {
    const p = this.posts.find((x) => x.id === postId);
    if (!p) return;
    p.likes += 1;
    this.notify();
  }

  public tick(dt: number, simMin: number) {
    this.currentSimMin = simMin;
    this.tickAccum += dt;
    this.organicAccum += dt;

    let changed = false;

    if (this.tickAccum >= 3.2) {
      this.tickAccum = 0;
      const timeLabel = formatSimClock(simMin);
      for (const job of this.jobs) {
        if (job.status === 'Queued') {
          job.progress = Math.min(35, job.progress + 8);
          if (job.progress >= 30) {
            job.status = 'In Progress';
            job.updates.push({
              time: timeLabel,
              author: job.assignedWorker,
              text: 'Claimed task on workstation console.',
            });
            changed = true;
          }
        } else if (job.status === 'In Progress') {
          job.progress = Math.min(100, job.progress + (job.priority === 'Urgent' ? 11 : 7));
          if (job.progress >= 100) {
            this.completeJobInternal(job, timeLabel);
            changed = true;
          } else {
            changed = true;
          }
        }
      }
    }

    // Periodically generate organic inter-company tasks if few active tasks remain
    if (this.organicAccum >= 18) {
      this.organicAccum = 0;
      const activeCount = this.jobs.filter((j) => j.status !== 'Completed').length;
      if (activeCount < 7) {
        const tpl = ORGANIC_JOB_TEMPLATES[this.organicIdx % ORGANIC_JOB_TEMPLATES.length];
        this.organicIdx++;
        const fromDir = DISTRICT_SOCIAL_DIRECTORY[tpl.from];
        const fromWorker = this.pickWorkerForBuilding(tpl.from);
        this.dispatchJob({
          platform: tpl.platform,
          fromBuilding: tpl.from,
          fromName: fromWorker.name || fromDir.shortName,
          sourceDevice: tpl.device,
          toBuilding: tpl.to,
          title: tpl.title,
          brief: tpl.brief,
          priority: tpl.priority,
        });
        changed = false; // dispatchJob already notifies
      }
    }

    if (changed) {
      this.notify();
    }
  }
}

export const socialNetwork = new DistrictSocialNetwork();
