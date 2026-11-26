/**
 * Built-in zero-network offline data fallbacks for standalone / file:// / offline usage.
 * Keeps Nairobi live clock & weather deterministic from the local system clock and
 * powers workstation Search/Browser without requiring any external HTTP requests.
 */

export interface OfflineWeatherSnapshot {
  nairobiTime: string;
  nairobiDate: string;
  nairobiHour: number;
  nairobiMinute: number;
  isDay: boolean;
  temperatureC: number;
  cloudCoverPct: number;
  precipitationMm: number;
  weatherCode: number;
  conditionLabel: string;
  presetSuggestion: 'clear' | 'overcast' | 'rain';
  offline: true;
  syncedAtIso: string;
}

export interface OfflineSearchResult {
  title: string;
  snippet: string;
  url: string;
  domain: string;
}

export interface OfflinePageData {
  url: string;
  finalUrl: string;
  title: string;
  domain: string;
  mode: 'article';
  excerpt: string;
  paragraphs: string[];
  headings: string[];
  links: Array<{ text: string; url: string }>;
  offlineFallback: true;
}

function getNairobiClockParts(now = new Date()): {
  hour: number;
  minute: number;
  timeStr: string;
  dateStr: string;
} {
  try {
    const timeFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Nairobi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const dateFmt = new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const parts = timeFmt.formatToParts(now);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '12');
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    const hh = String(Number.isFinite(h) ? h % 24 : 12).padStart(2, '0');
    const mm = String(Number.isFinite(m) ? m % 60 : 0).padStart(2, '0');
    return {
      hour: Number.isFinite(h) ? h % 24 : 12,
      minute: Number.isFinite(m) ? m % 60 : 0,
      timeStr: `${hh}:${mm} EAT`,
      dateStr: dateFmt.format(now),
    };
  } catch {
    // Manual UTC+3 EAT offset fallback
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const eat = new Date(utcMs + 3 * 3600 * 1000);
    const h = eat.getHours();
    const m = eat.getMinutes();
    return {
      hour: h,
      minute: m,
      timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} EAT`,
      dateStr: eat.toDateString(),
    };
  }
}

export function getOfflineNairobiWeather(now = new Date()): OfflineWeatherSnapshot {
  const { hour, minute, timeStr, dateStr } = getNairobiClockParts(now);
  const isDay = hour >= 6 && hour < 19;
  // Diurnal Nairobi highland curve (cool crisp morning ~17C, warm afternoon ~25C)
  const phase = ((hour + minute / 60 - 5) / 24) * Math.PI * 2;
  const temp = Math.round((21.2 + Math.sin(phase - 0.5) * 3.8) * 10) / 10;
  const cloud = hour >= 14 && hour <= 18 ? 38 : 22;

  return {
    nairobiTime: timeStr,
    nairobiDate: dateStr,
    nairobiHour: hour,
    nairobiMinute: minute,
    isDay,
    temperatureC: temp,
    cloudCoverPct: cloud,
    precipitationMm: 0,
    weatherCode: cloud > 30 ? 2 : 1,
    conditionLabel: isDay
      ? cloud > 30
        ? 'Partly cloudy highland sun (Offline)'
        : 'Clear Nairobi daylight (Offline)'
      : 'Clear highland evening (Offline)',
    presetSuggestion: 'clear',
    offline: true,
    syncedAtIso: now.toISOString(),
  };
}

const OFFLINE_KNOWLEDGE_PAGES: OfflinePageData[] = [
  {
    url: 'https://domaintechhub.co.ke/',
    finalUrl: 'https://domaintechhub.co.ke/',
    title: 'DomainTechHub Nairobi — Engineering, AI & Enterprise Systems',
    domain: 'domaintechhub.co.ke',
    mode: 'article',
    excerpt:
      'Central glass atrium headquarters of the DomainTechHub Innovation District in Upper Hill, Nairobi.',
    headings: ['Campus Directory', 'Platform Reliability', 'Nairobi Engineering Teams'],
    paragraphs: [
      'DomainTechHub serves as the anchor technology campus spanning ground reception, software engineering desks, cloud server telemetry racks, executive boardrooms, and a landscaped rooftop terrace.',
      'All district companies connect over an internal low-latency fiber ring serving Banking, Healthcare, Aviation, Sustainable Real Estate, Electric Mobility, Digital Custody, and Safari Expeditions.',
      'Offline Mode Active: displaying built-in local documentation and district knowledge.',
    ],
    links: [
      { text: 'Nairobi, Kenya Overview', url: 'https://en.wikipedia.org/wiki/Nairobi' },
      { text: 'Horizon Treasury Bank', url: 'https://horizontreasury.co.ke/' },
      { text: 'VitalCare Medical Center', url: 'https://vitalcare.co.ke/' },
      { text: 'Apex Motors EV Gallery', url: 'https://apexmotors.co.ke/' },
    ],
    offlineFallback: true,
  },
  {
    url: 'https://en.wikipedia.org/wiki/Nairobi',
    finalUrl: 'https://en.wikipedia.org/wiki/Nairobi',
    title: 'Nairobi — Capital & Technology Hub of Kenya (Offline Reference)',
    domain: 'en.wikipedia.org',
    mode: 'article',
    excerpt:
      'Nairobi is the capital and largest city of Kenya, situated at 1,795 m elevation in the East African highlands (EAT / UTC+3).',
    headings: ['Geography & Highland Climate', 'Silicon Savannah Economy', 'District Connections'],
    paragraphs: [
      'Known globally as the Silicon Savannah, Nairobi hosts major East African fintech, mobility, clean-energy, logistics, and hospitality headquarters across Upper Hill, Westlands, and Kilimani.',
      'Thanks to its 1,795-meter altitude near the equator, Nairobi enjoys mild sunny afternoons averaging 22-26 C and crisp evenings around 13-16 C year-round.',
      'Offline Mode Active: showing bundled encyclopedia excerpt without internet access.',
    ],
    links: [
      { text: 'DomainTechHub HQ', url: 'https://domaintechhub.co.ke/' },
      { text: 'Kenya Safari & Tourism', url: 'https://kenyasafari.co.ke/' },
      { text: 'SwiftPort Cargo Logistics', url: 'https://swiftport.co.ke/' },
    ],
    offlineFallback: true,
  },
  {
    url: 'https://horizontreasury.co.ke/',
    finalUrl: 'https://horizontreasury.co.ke/',
    title: 'Horizon Treasury Bank — Institutional Liquidity & Trade Finance',
    domain: 'horizontreasury.co.ke',
    mode: 'article',
    excerpt:
      'East African treasury desk, East African bond clearinghouse, and dual-key bullion custody vaults.',
    headings: ['FX & Treasury Desk', 'Safe Deposit & Bullion Vault', 'Retail & Premier Banking'],
    paragraphs: [
      'Horizon Treasury Bank operates four architectural levels featuring Rift limestone colonnades, sound-isolated wealth advisory suites, and a basement bullion vault.',
      'Real-time KES, USD, EUR, and GBP settlement flows are mirrored inside the district workstation dashboard.',
    ],
    links: [
      { text: 'BitVault Crypto Exchange', url: 'https://bitvault.co.ke/' },
      { text: 'DomainTechHub HQ', url: 'https://domaintechhub.co.ke/' },
    ],
    offlineFallback: true,
  },
  {
    url: 'https://vitalcare.co.ke/',
    finalUrl: 'https://vitalcare.co.ke/',
    title: 'VitalCare Medical Center — Diagnostics, Pharmacy & Biophilic Care',
    domain: 'vitalcare.co.ke',
    mode: 'article',
    excerpt:
      'Circadian-lit outpatient clinic, imaging MRI suite, compounding apothecary, and surgical triage.',
    headings: ['Outpatient & Apothecary', 'MRI & Radiology Diagnostics', 'Biophilic Recovery Suites'],
    paragraphs: [
      'VitalCare combines Japanese hinoki timber serenity, seafoam ceramic clinical bays, and living moss acoustic walls to lower patient stress.',
      'Physicians review lab panels and telemetry schedules directly from floor-level diagnostic workstations.',
    ],
    links: [
      { text: 'DomainTechHub HQ', url: 'https://domaintechhub.co.ke/' },
      { text: 'Kenya Safari & Tourism', url: 'https://kenyasafari.co.ke/' },
    ],
    offlineFallback: true,
  },
  {
    url: 'https://apexmotors.co.ke/',
    finalUrl: 'https://apexmotors.co.ke/',
    title: 'Apex Motors — EV Showroom & 350 kW Fast-Charging Hub',
    domain: 'apexmotors.co.ke',
    mode: 'article',
    excerpt:
      'Flagship electric SUVs, executive sedans, motorsport telemetry studio, and solar-backed hyper-chargers.',
    headings: ['Showroom Turntable Gallery', 'Bespoke Paint & Wheel Atelier', '350 kW DC Charging'],
    paragraphs: [
      'Apex Motors pairs obsidian terrazzo showfloors and sky-oculus mezzanine balconies with live EV battery range and drivetrain diagnostics.',
      'Visitors can step directly into the district test-drive vehicle on the central avenue.',
    ],
    links: [
      { text: 'SwiftPort Cargo Logistics', url: 'https://swiftport.co.ke/' },
      { text: 'DomainTechHub HQ', url: 'https://domaintechhub.co.ke/' },
    ],
    offlineFallback: true,
  },
  {
    url: 'https://bitvault.co.ke/',
    finalUrl: 'https://bitvault.co.ke/',
    title: 'BitVault Crypto — Quantitative Trading & Immersion Cooling Vault',
    domain: 'bitvault.co.ke',
    mode: 'article',
    excerpt:
      'Institutional digital-asset liquidity desk, biometric cold-storage vault, and emerald dielectric compute nodes.',
    headings: ['Quant Orderbook Ops', 'Cold Storage & Key Ceremony', 'Dielectric Immersion Compute'],
    paragraphs: [
      'BitVault runs multi-party computation signing rooms and low-power immersion-cooled validator racks inside hexagonal basalt halls.',
    ],
    links: [
      { text: 'Horizon Treasury Bank', url: 'https://horizontreasury.co.ke/' },
      { text: 'DomainTechHub HQ', url: 'https://domaintechhub.co.ke/' },
    ],
    offlineFallback: true,
  },
  {
    url: 'https://kenyasafari.co.ke/',
    finalUrl: 'https://kenyasafari.co.ke/',
    title: 'Kenya Safari & Tourism — Conservancy Flights & Eco-Lodge Atelier',
    domain: 'kenyasafari.co.ke',
    mode: 'article',
    excerpt:
      'Maasai Mara, Amboseli, Samburu, and Diani Coast bespoke conservation expeditions.',
    headings: ['Great Rift Relief Studio', 'Eco-Lodge Materials Atelier', 'Bush Aviation Dispatch'],
    paragraphs: [
      'Specialists coordinate solar tented camp stays, 4x4 Land Cruiser convoys, and wildlife conservancy partnerships across Kenya.',
    ],
    links: [
      { text: 'Skyline Travel & Aviation', url: 'https://skylinetravel.co.ke/' },
      { text: 'Nairobi, Kenya Overview', url: 'https://en.wikipedia.org/wiki/Nairobi' },
    ],
    offlineFallback: true,
  },
  {
    url: 'https://skylinetravel.co.ke/',
    finalUrl: 'https://skylinetravel.co.ke/',
    title: 'Skyline Travel & Aviation — Corporate Charters & Lounge Concierge',
    domain: 'skylinetravel.co.ke',
    mode: 'article',
    excerpt:
      'Regional flight dispatch, JKIA private terminal transfers, and global corporate travel management.',
    headings: ['Flight Dispatch Matrix', 'Cabin Experience Suite', 'Global Partner Network'],
    paragraphs: [
      'Skyline coordinates regional commuter hops to Mombasa, Kisumu, Eldoret, Maasai Mara, and international long-haul connections.',
    ],
    links: [
      { text: 'Kenya Safari & Tourism', url: 'https://kenyasafari.co.ke/' },
      { text: 'SwiftPort Cargo Logistics', url: 'https://swiftport.co.ke/' },
    ],
    offlineFallback: true,
  },
  {
    url: 'https://swiftport.co.ke/',
    finalUrl: 'https://swiftport.co.ke/',
    title: 'SwiftPort Cargo & Logistics — Mombasa-Nairobi Freight Corridor',
    domain: 'swiftport.co.ke',
    mode: 'article',
    excerpt:
      'Intermodal port customs clearance, cold-chain air freight, and East African container fleet routing.',
    headings: ['Intermodal Container Control', 'Cold-Chain Telemetry', 'Regional Fleet Operations'],
    paragraphs: [
      'SwiftPort monitors SGR rail freight, Mombasa berth turnaround, and inland ICD depot inventories in real time.',
    ],
    links: [
      { text: 'Apex Motors EV Gallery', url: 'https://apexmotors.co.ke/' },
      { text: 'DomainTechHub HQ', url: 'https://domaintechhub.co.ke/' },
    ],
    offlineFallback: true,
  },
  {
    url: 'https://kibuukarealestate.co.ke/',
    finalUrl: 'https://kibuukarealestate.co.ke/',
    title: 'Kibuuka Real Estate & Urban Architecture — Sustainable Developments',
    domain: 'kibuukarealestate.co.ke',
    mode: 'article',
    excerpt:
      'Commercial green buildings, curved-glass storefronts, residential towers, and architectural material labs.',
    headings: ['Architectural Model Gallery', 'Interior Material Library', 'Urban Masterplanning'],
    paragraphs: [
      'Kibuuka Real Estate designs daylight-optimized offices, timber soffits, and biophilic podium terraces across Nairobi and Kampala.',
    ],
    links: [
      { text: 'Savanna Bistro & Roastery', url: 'https://savannabistro.co.ke/' },
      { text: 'DomainTechHub HQ', url: 'https://domaintechhub.co.ke/' },
    ],
    offlineFallback: true,
  },
  {
    url: 'https://savannabistro.co.ke/',
    finalUrl: 'https://savannabistro.co.ke/',
    title: 'Savanna Bistro & Coffee Roastery — Single-Origin Kenyan Cuisine',
    domain: 'savannabistro.co.ke',
    mode: 'article',
    excerpt:
      'Wood-fired artisanal kitchen, AA Nyeri pour-over bar, and courtyard terrace dining.',
    headings: ['Highland Coffee Roastery', 'Wood-Fired Tasting Menu', 'Private Chef Lounge'],
    paragraphs: [
      'Serving freshly roasted Mt. Kenya & Nyeri AA espresso alongside contemporary East African cuisine overlooking the central square.',
    ],
    links: [
      { text: 'DomainTechHub HQ', url: 'https://domaintechhub.co.ke/' },
      { text: 'Nairobi, Kenya Overview', url: 'https://en.wikipedia.org/wiki/Nairobi' },
    ],
    offlineFallback: true,
  },
];

export function searchOfflineWeb(rawQuery: string): OfflineSearchResult[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return OFFLINE_KNOWLEDGE_PAGES.slice(0, 6).map((p) => ({
      title: p.title,
      snippet: p.excerpt,
      url: p.url,
      domain: p.domain,
    }));
  }
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = OFFLINE_KNOWLEDGE_PAGES.map((p) => {
    const hay = `${p.title} ${p.domain} ${p.excerpt} ${p.headings.join(' ')} ${p.paragraphs.join(' ')}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (p.title.toLowerCase().includes(term)) score += 4;
      if (p.domain.toLowerCase().includes(term)) score += 3;
      if (hay.includes(term)) score += 1;
    }
    return { page: p, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const list = scored.length > 0 ? scored.map((s) => s.page) : OFFLINE_KNOWLEDGE_PAGES.slice(0, 5);
  return list.slice(0, 8).map((p) => ({
    title: p.title,
    snippet: p.excerpt,
    url: p.url,
    domain: p.domain,
  }));
}

export function browseOfflineUrl(rawUrl: string): OfflinePageData {
  const normalized = rawUrl.trim().toLowerCase();
  const direct = OFFLINE_KNOWLEDGE_PAGES.find(
    (p) =>
      p.url.toLowerCase() === normalized ||
      normalized.includes(p.domain.toLowerCase()) ||
      p.title.toLowerCase().includes(normalized.replace(/^https?:\/\//, '').split('/')[0])
  );
  if (direct) return direct;

  let domain = 'offline.local';
  try {
    domain = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).hostname;
  } catch {
    // keep default
  }

  return {
    url: rawUrl,
    finalUrl: rawUrl,
    title: `${domain} — Offline Mode Cached Reader`,
    domain,
    mode: 'article',
    excerpt:
      'Live internet requests are disabled in standalone / offline mode so the 3D campus runs cleanly with zero network dependencies.',
    headings: ['Offline Mode Enabled', 'Available Local Pages'],
    paragraphs: [
      `Requested address (${rawUrl}) cannot be fetched externally in standalone/offline mode.`,
      'Select any curated local district company, Nairobi reference article, or keyword search below to inspect built-in documentation.',
    ],
    links: OFFLINE_KNOWLEDGE_PAGES.slice(0, 6).map((p) => ({
      text: p.title.split('—')[0].trim(),
      url: p.url,
    })),
    offlineFallback: true,
  };
}
