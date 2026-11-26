import { DISTRICT_WORK_THOUGHTS } from './districtData';
import { createSeededRng } from './prng';

const mindRng = createSeededRng(4201);

export type CharacterMood =
  | 'Focused'
  | 'Curious'
  | 'Restless'
  | 'Caffeinated'
  | 'Social'
  | 'Relaxed'
  | 'Alert'
  | 'Inspired';

export type FreeGoal =
  | 'work'
  | 'stretch'
  | 'balcony'
  | 'socialize'
  | 'coffeeBreak'
  | 'patrol'
  | 'inspect';

export interface CharacterIdentity {
  id: string;
  name: string;
  role: string;
  department: string;
  seniority?: 'Senior' | 'Junior' | 'Lead' | 'Executive';
  accentColor: string;
  personality: string;
  topicKey: string;
  homeLv: number;
  homeX: number;
  homeZ: number;
  homeFace: number;
  homePose: string;
}

export interface CharacterBrain {
  identity: CharacterIdentity;
  mood: CharacterMood;
  goal: FreeGoal;
  actionLabel: string;
  thought: string;
  recentThoughts: string[];
  focus: number;
  energy: number;
  social: number;
  nextDecisionIn: number;
}

const FEM_FIRST = [
  'Amina',
  'Faith',
  'Wanjiku',
  'Nadia',
  'Halima',
  'Njeri',
  'Makena',
  'Achieng',
  'Zawadi',
  'Neema',
  'Chebet',
  'Wambui',
  'Salma',
  'Imani',
  'Muthoni',
  'Sifa',
  'Risper',
  'Brenda',
  'Ivy',
  'Joy',
  'Mercy',
  'Esther',
  'Talia',
  'Kendi',
  'Pendo',
  'Lilian',
  'Farida',
  'Cynthia',
];

const MALE_FIRST = [
  'Brian',
  'Kevin',
  'Dennis',
  'Otieno',
  'Kamau',
  'Juma',
  'Hassan',
  'Kiprop',
  'Victor',
  'Samuel',
  'Mutua',
  'Collins',
  'Baraka',
  'Tariq',
  'Gideon',
  'Omondi',
  'Ian',
  'Trevor',
  'Derrick',
  'Edwin',
  'Nolan',
  'Allan',
  'George',
  'Peter',
  'Musa',
  'Kelvin',
  'Benson',
  'Faraji',
];

const SURNAMES = [
  'Ochieng',
  'Wanjiku',
  'Mwangi',
  'Kamau',
  'Otieno',
  'Kipchoge',
  'Njoroge',
  'Hassan',
  'Mutiso',
  'Auma',
  'Kariuki',
  'Kimani',
  'Omondi',
  'Chege',
  'Mburu',
  'Onyango',
  'Barasa',
  'Wafula',
  'Koech',
  'Ruto',
  'Odhiambo',
  'Ndegwa',
  'Gitonga',
  'Maina',
  'Kioko',
  'Abdalla',
  'Mohamed',
  'Gachanja',
  'Wekesa',
  'Cheruiyot',
  'Nyambura',
  'Mugo',
  'Langat',
  'Karanja',
  'Macharia',
  'Ouko',
];

const PERSONALITIES = [
  'Methodical problem-solver',
  'Coffee-fueled builder',
  'Curious team collaborator',
  'Calm systems thinker',
  'Detail-oriented craftsperson',
  'Upbeat early adopter',
  'Restless brainstormer',
  'Observant troubleshooter',
];

export function generateCharacterName(fem: boolean, seed: number): string {
  const firstPool = fem ? FEM_FIRST : MALE_FIRST;
  const f = firstPool[Math.abs(seed) % firstPool.length];
  const l = SURNAMES[Math.abs(seed * 7 + (fem ? 11 : 3)) % SURNAMES.length];
  return `${f} ${l}`;
}

export function pickPersonality(seed: number): string {
  return PERSONALITIES[Math.abs(seed) % PERSONALITIES.length];
}

const WORK_THOUGHTS: Record<string, string[]> = {
  web: [
    'Those JSONB GIN indexes just cut checkout query latency down to 4ms.',
    'Checking M-Pesa callback idempotency before we merge to production.',
    'API throughput is looking solid—one more integration test and we ship.',
    'Wondering if we should batch these webhook retries through Redis.',
  ],
  front: [
    'Micro-interactions on the dashboard feel super smooth at 60fps now.',
    'Tweaking the contrast ratio on these typography tokens until it sings.',
    'Just spotted a tiny alignment offset on mobile—fixing it right away.',
    'Love how clean this component hierarchy turned out.',
  ],
  cart: [
    'Mobile checkout conversion bumped up 3.4% after simplifying step two.',
    'Syncing real-time Nairobi warehouse stock levels with the storefront.',
    'Testing automated split-settlement payouts for marketplace vendors.',
    'That cart recovery flow is already paying for itself today.',
  ],
  wp: [
    'Locking down WooCommerce transients so page loads stay under 600ms.',
    'Handing over clean Gutenberg blocks so the client can publish solo.',
    'Running automated visual regression diffs across all landing templates.',
    'Plugin audit is green across every managed client site.',
  ],
  seo: [
    'Structured JSON-LD schema pushed three product pages into rich snippets.',
    'Core Web Vitals CLS score dropped to 0.01 after preloading web fonts.',
    'Mapping internal link clusters for the East Africa fintech guide.',
    'Organic impressions are climbing steadily week over week.',
  ],
  mkt: [
    'Attribution shows Tuesday morning webinars bring the highest-value leads.',
    'Refining our Q4 campaign deck before the afternoon client sync.',
    'Retention metrics look strong—let us double down on case-study stories.',
    'Checking live GA4 funnel drop-offs across the enterprise landing page.',
  ],
  ppc: [
    'Negative keyword pruning shaved 14% off cost-per-acquisition today.',
    'Testing two fresh responsive search headlines for the B2B campaign.',
    'ROAS on the high-intent Nairobi search cluster just crossed 5.2×.',
    'Keeping an eye on afternoon bid pacing so budget stretches cleanly.',
  ],
  wa: [
    'Automated WhatsApp order updates cut support tickets almost in half.',
    'Designing a crisp 3-tap catalog flow inside Business API templates.',
    'Customer reply latency is averaging 18 seconds right now.',
    'Drafting bilingual Swahili/English quick-reply buttons for retail.',
  ],
  social: [
    'Behind-the-scenes office reel is already picking up great organic saves.',
    'Scheduling tomorrow’s creator collab posts across IG and LinkedIn.',
    'Community replies are super warm today—time to highlight a client win.',
    'Testing carousel hooks to boost read-through rate past slide four.',
  ],
  crm: [
    'Custom pipeline stages fit the sales team’s actual workflow much better.',
    'Syncing automated invoice reminders cleanly with the ERP bridge.',
    'Checking permission scopes before onboarding the next 40 sales reps.',
    'Zero duplicate lead records since turning on fuzzy domain matching.',
  ],
  ai: [
    'Tuning retrieval chunk sizes so domain citations stay razor-accurate.',
    'Evaluating latency vs. accuracy on the new workflow automation agent.',
    'Guardrails caught every edge-case prompt in our regression suite.',
    'Users love the one-click summary drawer—less manual triage for everyone.',
  ],
  hand: [
    'Clarifying technical scope now saves three weeks of rework later.',
    'Mapping client milestones into clear two-week delivery sprints.',
    'Preparing architecture tradeoffs for the 2 PM discovery workshop.',
    'Everyone is aligned on MVP priorities—great momentum this week.',
  ],
  sec: [
    'All 24 managed production endpoints passed automated TLS & backup checks.',
    'Zero anomalous auth bursts in the last 6 hours—quiet systems are good systems.',
    'Verifying encrypted off-site snapshot integrity before shift handover.',
    'Rotating staging deploy keys as part of our weekly hygiene pass.',
  ],
  mobile: [
    'Offline-first SQLite sync finally feels effortless on flaky 3G connections.',
    'Profiling cold start time on mid-range Android devices right now.',
    'Biometric M-Pesa confirmation sheet builds cleanly on both iOS and Android.',
    'Squashing a subtle gesture conflict inside the bottom sheet.',
  ],
  reception: [
    'Ready to welcome the afternoon client delegation—visitor badges printed.',
    'Coordinating courier deliveries and meeting room check-ins.',
    'Lobby looks crisp today with the morning sunlight hitting the atrium.',
  ],
  security: [
    'Perimeter access logs are clean—making another patrol pass by the lobby.',
    'Checking turnstile badge readers and ground-floor fire exits.',
    'Keeping an eye on visitor flow around reception and lift lobbies.',
  ],
  lounge: [
    'Pulling a fresh double espresso—the aroma always lifts the whole floor.',
    'Great energy in the lounge today while directors swap strategy notes.',
    'Keeping pastries and cold brew stocked for the afternoon break rush.',
  ],
  board: [
    'Q3 expansion numbers (+18% YoY) put us ahead of the Nairobi roadmap.',
    'Reviewing 96% client retention drivers across our enterprise accounts.',
    'Evaluating where to invest engineering headcount next quarter.',
    'Strong alignment around the table—time to lock in Q4 priorities.',
  ],
  secr: [
    'Compiling final board resolution minutes for executive sign-off.',
    'Coordinating calendar invites for next week’s governance review.',
    'Double-checking compliance filings ahead of Friday’s deadline.',
  ],
  hod: [
    'Checking department sprint velocity and team bandwidth for next month.',
    'Making sure senior leads have everything they need to unblock juniors.',
    'Balancing client delivery commitments with internal R&D time.',
    'Need to walk over and check in with the teams in a few minutes.',
  ],
  ceo: [
    'Reviewing the regional partnership brief before the 3 PM call.',
    'Proud of how cohesive the engineering and growth floors feel today.',
    'Mapping out next year’s East Africa enterprise hub expansion.',
  ],
  security_ops: [
    'All 6 perimeter and basement CCTV feeds are crystal clear with normal badge flow.',
    'Reconciling visitor access logs and B1 server vault biometric check-ins.',
    'Coordinating campus security patrols and main gate turnstile telemetry.',
  ],
  hr: [
    'Shortlisting senior full-stack and AI engineering candidates for next week.',
    'Finalizing onboarding welcome kits and mentoring pairs for Monday’s new hires.',
    'Reviewing quarterly wellbeing and wellness-gym participation metrics.',
  ],
  relax: [
    'Anyone up for a quick best-of-three table tennis match after standup?',
    'Restocking espresso beans and chilling sparkling water for the afternoon break.',
    'Nothing beats a ten-minute lounge reset before diving back into code.',
  ],
  gym: [
    'Logging a quick 20-minute cardio warm-up on the treadmill before lunch.',
    'Adjusting the dumbbell rack and booking this evening’s mobility session.',
    'Great energy in the studio today—fitness keeps the sprint momentum high.',
  ],
  strategy: [
    'Mapping 2026 East Africa expansion targets across Nairobi, Mombasa, and Kigali.',
    'Aligning enterprise ARR milestones with our Q4 engineering roadmap.',
    'Sharpening strategic priorities ahead of the afternoon Board Room briefing.',
  ],
  gallery: [
    'Preparing the campus architectural scale model for visiting enterprise partners.',
    'Walk-through guests love seeing how all nine campus buildings interconnect.',
  ],
  guide: [
    'Ready whenever someone wants a full 17-stop tour of DomainTechHub!',
    'Love watching every department hustle from the ground atrium.',
    'Checking the tour route notes—Board Room and B1/B2 look sharp today.',
  ],
  b1_senior: [
    'CRAC return-air temperatures are holding steady at 20.4°C across both aisles.',
    'Checking 42-node cluster load (18.4 TB/s)—making sure juniors have clean patch docs.',
    'Redundant fiber uplinks are balanced; verifying PSU failover metrics next.',
    'Mentoring the junior techs on airflow containment and hot-aisle labeling.',
  ],
  b1_junior: [
    'Double-checking Cat6A & OM4 fiber port labels on Rack Bank B.',
    'FM-200 suppression gauges are right in the green zone—logging serials now.',
    'Swapping out a flagged hot-swap drive tray and verifying RAID rebuild.',
    'Learning the senior team’s thermal inspection checklist step by step.',
  ],
  b2_senior: [
    'PV solar array is feeding 18.4 kW clean—zero grid draw right now.',
    'Analyzing HV transformer harmonic curves and inverter efficiency logs on the B2 workstation.',
    'Auditing main switchgear interlocks before authorizing afternoon battery test.',
    'Reviewing live LiFePO4 battery discharge trends at the Power Room analytics monitor.',
  ],
  b2_junior: [
    'Logging LiFePO4 cell balance voltages across all three battery rows at the telemetry desk.',
    'Comparing live SCADA load charts on the Power Room monitor against yesterday’s peak.',
    'Inverter #3 efficiency is reading 98%—jotting telemetry in the maintenance log.',
    'Organizing calibrated torque drivers and multimeter leads on the service trolley.',
  ],
  visitor: [
    'Really impressed by the open atrium design and live engineering bays.',
    'Catching up on messages while waiting for our project kickoff meeting.',
    'Grabbing a quick coffee before heading up to Level 4.',
  ],
  pool_swimmer: [
    'Nothing clears sprint fatigue like twenty crisp freestyle laps in the heated rooftop pool.',
    'The morning Nairobi skyline from the West Terrace infinity weir is unbeatable.',
    'Keeping a steady pace in the lap lane before heading down to my afternoon sync.',
    'Love that DomainTechHub built a full lap pool right next to the solar deck.',
  ],
  pool_lounge: [
    'Getting some fresh open-air sunshine by the rooftop infinity pool between reviews.',
    'Watching the lap swimmers while sketching out our next Q3 product sprint.',
    'Grabbed an iced drink and stepped onto the West Terrace deck to recharge.',
    'Best spot in the building—cool breeze off the pool and solar panels humming nearby.',
  ],
};

const GOAL_THOUGHTS: Record<Exclude<FreeGoal, 'work'>, string[]> = {
  stretch: [
    'Been sitting way too long—time to stand up and stretch my shoulders.',
    'My eyes need a 30-second break from pixels—quick stretch right here.',
    'Checking a quick message on my phone while shaking off desk stiffness.',
    'Taking a deep breath and reviewing what I want to tackle next.',
  ],
  balcony: [
    'Going to walk out to the balcony railing and enjoy the view for a minute.',
    'Fresh perspective always helps when debugging—strolling along the glass corridor.',
    'Love looking down into the atrium from here—helps clear the mind.',
    'Pacing gently down the walkway while planning the next hour.',
  ],
  socialize: [
    'Heading over to say hi to a teammate and see what they are building.',
    'Want to bounce an idea off a colleague instead of sending another Slack message.',
    'Walking across the floor for a quick face-to-face check-in.',
    'Great chance to share what I just found with the team.',
  ],
  coffeeBreak: [
    'Definitely time for coffee—my mug has been empty for an hour.',
    'Strolling toward the lounge area to recharge with a quick caffeine break.',
    'Need a warm drink before diving into the next sprint task.',
    'Taking five minutes to grab water and reset my focus.',
  ],
  patrol: [
    'Doing a spontaneous walk-through to make sure everything looks clean and safe.',
    'Checking another corner of the floor on my own initiative.',
    'Following up on a faint vibration I noticed earlier—just being thorough.',
    'Making rounds along the main corridor to keep eyes on everything.',
  ],
  inspect: [
    'Running a closer hands-on check on this unit while I am nearby.',
    'Want to verify these readings with my own eyes before signing off.',
    'Logging a fresh diagnostic measurement into the maintenance tablet.',
    'Comparing current sensor output against this morning’s baseline.',
  ],
};

export function createCharacterBrain(identity: CharacterIdentity): CharacterBrain {
  const workList = WORK_THOUGHTS[identity.topicKey] || DISTRICT_WORK_THOUGHTS[identity.topicKey] || WORK_THOUGHTS.web;
  const seed = Math.abs(Math.round(identity.homeX * 13 + identity.homeZ * 7 + identity.homeLv * 31));
  const initialThought = workList[seed % workList.length];
  const startsAtDesk = identity.homeLv >= 0 || identity.homePose === 'type';
  return {
    identity,
    mood: startsAtDesk ? 'Focused' : 'Alert',
    goal: startsAtDesk ? 'work' : 'inspect',
    actionLabel:
      identity.homeLv < 0 && startsAtDesk
        ? 'Analyzing power & battery work at desk'
        : startsAtDesk
          ? 'Working at station'
          : 'Inspecting equipment',
    thought: initialThought,
    recentThoughts: [],
    focus: 62 + (seed % 32),
    energy: 65 + ((seed * 3) % 30),
    social: 45 + ((seed * 5) % 40),
    nextDecisionIn: 6 + (seed % 14),
  };
}

export function setBrainThought(
  brain: CharacterBrain,
  mood: CharacterMood,
  actionLabel: string,
  thought: string
) {
  if (brain.thought && brain.thought !== thought) {
    brain.recentThoughts.unshift(brain.thought);
    if (brain.recentThoughts.length > 3) brain.recentThoughts.length = 3;
  }
  brain.mood = mood;
  brain.actionLabel = actionLabel;
  brain.thought = thought;
}

export function pickThoughtForGoal(
  brain: CharacterBrain,
  goal: FreeGoal,
  peerName?: string
): { mood: CharacterMood; actionLabel: string; thought: string } {
  const pool =
    goal === 'work'
      ? WORK_THOUGHTS[brain.identity.topicKey] || DISTRICT_WORK_THOUGHTS[brain.identity.topicKey] || WORK_THOUGHTS.web
      : GOAL_THOUGHTS[goal];
  const raw = pool[Math.floor(mindRng() * pool.length)];

  if (goal === 'socialize' && peerName) {
    return {
      mood: 'Social',
      actionLabel: `Chatting with ${peerName}`,
      thought: `Having a quick catch-up with ${peerName}—nothing beats thinking through problems together.`,
    };
  }
  if (goal === 'balcony') {
    return {
      mood: 'Relaxed',
      actionLabel: 'Taking in the corridor view',
      thought: raw,
    };
  }
  if (goal === 'stretch') {
    return {
      mood: 'Restless',
      actionLabel: 'Stretching & taking a breather',
      thought: raw,
    };
  }
  if (goal === 'coffeeBreak') {
    return {
      mood: 'Caffeinated',
      actionLabel: 'On a quick coffee / recharge break',
      thought: raw,
    };
  }
  if (goal === 'patrol') {
    return {
      mood: 'Alert',
      actionLabel: 'Patrolling & checking floor status',
      thought: raw,
    };
  }
  if (goal === 'inspect') {
    return {
      mood: 'Focused',
      actionLabel: 'Inspecting systems & telemetry',
      thought: raw,
    };
  }
  return {
    mood: mindRng() < 0.35 ? 'Inspired' : 'Focused',
    actionLabel: 'Working at station',
    thought: raw,
  };
}
