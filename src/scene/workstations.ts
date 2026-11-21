import { DISTRICT_WORKSTATIONS } from './districtData';

export type WorkstationMode = 'browser' | 'dataEntry' | 'project';
export type JobAppType = 'ide' | 'design' | 'marketing' | 'social' | 'security' | 'executive';

export interface ResearchSection {
  heading: string;
  excerpt: string;
  highlight: string;
}

export interface BrowserSession {
  tabTitle: string;
  url: string;
  searchQuery: string;
  articleTitle: string;
  articleDomain: string;
  sections: ResearchSection[];
  researchNote: string;
}

export interface DataEntrySpec {
  sheetTitle: string;
  columns: [string, string, string, string];
  initialRows: Array<[string, string, string, string]>;
  incomingQueue: Array<[string, string, string, string]>;
}

export interface ProjectWorkSpec {
  fileName: string;
  language: string;
  accent: string;
  codeLines: string[];
  terminalOutput: string;
  deliverables: Array<{ label: string; done: boolean }>;
}

export interface JobAppSpec {
  appType: JobAppType;
  appTabLabel: string;
  appName: string;
  kpis: Array<{ label: string; value: string; delta: string }>;
  chartBars: number[];
  chartLabels: string[];
  visualHeadline: string;
  visualSubline: string;
  visualItems: Array<{ title: string; meta: string; status: string }>;
}

export interface WorkstationProfile {
  stationKey: string;
  projectTitle: string;
  clientName: string;
  primaryMode: WorkstationMode;
  browserSessions: BrowserSession[];
  dataEntry: DataEntrySpec;
  projectWork: ProjectWorkSpec;
  jobApp: JobAppSpec;
}

const PROFILES: Record<string, WorkstationProfile> = {
  // Web Development (Level 3)
  web: {
    stationKey: 'web',
    projectTitle: 'Safaricom B2B Merchant Portal',
    clientName: 'Safaricom Enterprise',
    primaryMode: 'project',
    browserSessions: [
      {
        tabTitle: 'PostgreSQL 16 JSONB Indexes',
        url: 'https://www.postgresql.org/docs/16/datatype-json.html#JSON-INDEXING',
        searchQuery: 'postgresql gin index jsonb_path_ops benchmark',
        articleTitle: 'GIN Indexes & jsonb_path_ops for High-Throughput Ledgers',
        articleDomain: 'postgresql.org/docs/16',
        sections: [
          {
            heading: 'Operator Class Selection',
            excerpt: 'The non-default jsonb_path_ops operator class supports indexing @> containment queries with ~60% smaller index footprint and 3x faster lookups.',
            highlight: 'CREATE INDEX idx_tx_meta ON merchant_ledger USING GIN (payload jsonb_path_ops);',
          },
          {
            heading: 'Connection Pooling Under Burst Load',
            excerpt: 'Combine PgBouncer transaction pooling with prepared statements disabled or protocol-level caching for 10k req/s checkout webhooks.',
            highlight: 'Target p99 query latency: < 4.2ms across 2.8M settlement rows.',
          },
        ],
        researchNote: 'Applying jsonb_path_ops reduced merchant settlement query p99 from 38ms to 3.9ms.',
      },
      {
        tabTitle: 'Daraja 2.0 C2B Signature Spec',
        url: 'https://developer.safaricom.co.ke/APIs/MpesaExpressSimulate',
        searchQuery: 'mpesa daraja stk push idempotency callback verification',
        articleTitle: 'M-Pesa Express STK Push Callback Idempotency Guide',
        articleDomain: 'developer.safaricom.co.ke',
        sections: [
          {
            heading: 'CheckoutRequestID Deduplication',
            excerpt: 'Always key settlement ledger writes on CheckoutRequestID inside a SERIALIZABLE transaction to prevent double-crediting retries.',
            highlight: 'Verify ResultCode === 0 and Amount matches original CheckoutIntent before marking Paid.',
          },
        ],
        researchNote: 'Added Redis + Postgres unique constraint guard on CheckoutRequestID.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Merchant API Settlement & UAT Log',
      columns: ['Merchant', 'Endpoint', 'Latency', 'Status'],
      initialRows: [
        ['Naivas Supermarkets', 'POST /stk/push', '41ms', '▲ Verified'],
        ['TotalEnergies KE', 'POST /b2b/settle', '58ms', '▲ Verified'],
        ['Carrefour Hub', 'GET /ledger/sync', '29ms', '▲ Verified'],
        ['Chandarana Foods', 'POST /webhook/cb', '64ms', '▲ Verified'],
      ],
      incomingQueue: [
        ['Quickmart Group', 'POST /stk/push', '37ms', '▲ Verified'],
        ['Java House Ltd', 'POST /b2b/settle', '49ms', '▲ Verified'],
        ['Airtel B2B Gateway', 'POST /recon/batch', '72ms', 'In QA'],
        ['Rubis Energy KE', 'GET /tx/status', '33ms', '▲ Verified'],
        ['Goodlife Pharmacy', 'POST /stk/refund', '52ms', '▲ Verified'],
      ],
    },
    projectWork: {
      fileName: 'src/services/darajaWebhook.ts',
      language: 'TypeScript',
      accent: '#7fb0ff',
      codeLines: [
        "import { db } from '../db/pool';",
        'export async function handleStkCallback(payload: StkCallback) {',
        '  const { CheckoutRequestID, ResultCode, Amount } = payload;',
        '  return db.tx(async (t) => {',
        '    const intent = await t.findIntent(CheckoutRequestID);',
        '    if (!intent || intent.settled) return { idempotent: true };',
        '    if (ResultCode === 0 && Number(Amount) === intent.amount) {',
        "      await t.markSettled(intent.id, 'PAID_MPESA');",
        '    }',
        '    return { ok: true, ref: CheckoutRequestID };',
        '  });',
        '}',
      ],
      terminalOutput: 'PASS src/services/darajaWebhook.test.ts · 14/14 assertions passed (42ms)',
      deliverables: [
        { label: 'Daraja STK callback idempotency lock', done: true },
        { label: 'PostgreSQL jsonb_path_ops settlement index', done: true },
        { label: 'Automated daily CSV reconciliation export', done: false },
      ],
    },
    jobApp: {
      appType: 'ide',
      appTabLabel: 'IDE & APIs',
      appName: 'VS Code + Daraja API Inspector',
      kpis: [
        { label: 'API p99 Latency', value: '41ms', delta: '-68%' },
        { label: 'Webhook Success', value: '99.94%', delta: '+0.4%' },
        { label: 'PRs Merged', value: '14', delta: 'This wk' },
      ],
      chartBars: [0.42, 0.58, 0.66, 0.78, 0.85, 0.94],
      chartLabels: ['M', 'T', 'W', 'T', 'F', 'S'],
      visualHeadline: 'POST /api/v2/mpesa/stk/callback -> 200 OK',
      visualSubline: '{ "idempotent": true, "ledger": "SETTLED", "latencyMs": 38 }',
      visualItems: [
        { title: 'darajaWebhook.ts', meta: 'TypeScript · 14 tests pass', status: 'Active' },
        { title: 'merchantPool.sql', meta: 'PostgreSQL GIN index', status: 'Deployed' },
        { title: 'reconExportJob.ts', meta: 'Cron CSV batcher', status: 'In Dev' },
      ],
    },
  },

  // Front-End (Level 3)
  front: {
    stationKey: 'front',
    projectTitle: 'Nairobi Hospital Telemedicine UI',
    clientName: 'Nairobi Hospital Group',
    primaryMode: 'project',
    browserSessions: [
      {
        tabTitle: 'W3C WCAG 2.2 APG Datepicker',
        url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/',
        searchQuery: 'wcag 2.2 accessible appointment slot picker keyboard focus',
        articleTitle: 'ARIA Authoring Practices: Accessible Scheduling Grids',
        articleDomain: 'w3.org/WAI/ARIA',
        sections: [
          {
            heading: 'Roving Tabindex in Slot Grids',
            excerpt: 'Arrow keys move focus within time-slot rows while Tab exits cleanly to the Confirm Booking CTA, preventing 40-tab-stop fatigue.',
            highlight: 'Announce selected doctor, clinic branch, and slot via aria-live="polite".',
          },
          {
            heading: 'Contrast Target for Clinical Forms',
            excerpt: 'Maintain >= 4.5:1 text contrast on muted secondary labels and clear 2px focus outlines over light slate surfaces.',
            highlight: 'Verified #0f172a on #f8fafc achieves 17.4:1 AAA rating.',
          },
        ],
        researchNote: 'Refactored booking calendar to roving tabindex + aria-live slot status announcer.',
      },
      {
        tabTitle: 'WebRTC Simulcast Adaptive Bitrate',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/setParameters',
        searchQuery: 'webrtc low bandwidth 3g kenya mobile video consultation',
        articleTitle: 'Adaptive Video Quality on Constrained Mobile Networks',
        articleDomain: 'developer.mozilla.org',
        sections: [
          {
            heading: 'Audio-First Degradation',
            excerpt: 'Cap doctor/patient video layer to 360p@15fps when RTT exceeds 260ms so voice consultation stays crystal clear.',
            highlight: 'degradationPreference: "maintain-framerate" with Opus DTX enabled.',
          },
        ],
        researchNote: 'Configured Opus DTX fallback for rural patient consultations.',
      },
    ],
    dataEntry: {
      sheetTitle: 'UI Accessibility & Viewport Audit Matrix',
      columns: ['Component', 'Viewport', 'WCAG', 'Status'],
      initialRows: [
        ['AppointmentGrid', '390×844 Mobile', 'AAA 7.4:1', '▲ Passed'],
        ['PatientIntakeForm', '1440×900 Web', 'AA 5.2:1', '▲ Passed'],
        ['VideoConsultHUD', '768×1024 Tab', 'AA 4.9:1', '▲ Passed'],
        ['PrescriptionCard', '390×844 Mobile', 'AAA 8.1:1', '▲ Passed'],
      ],
      incomingQueue: [
        ['LabResultsDrawer', '1280×800 Web', 'AA 5.6:1', '▲ Passed'],
        ['TriageStepWizard', '375×812 Mobile', 'AA 4.8:1', '▲ Passed'],
        ['InsuranceVerify', '1440×900 Web', 'AAA 7.1:1', 'In Review'],
        ['ClinicBranchMap', '390×844 Mobile', 'AA 4.7:1', '▲ Passed'],
      ],
    },
    projectWork: {
      fileName: 'src/components/AppointmentSlotGrid.tsx',
      language: 'TSX',
      accent: '#ffc078',
      codeLines: [
        'export function AppointmentSlotGrid({ slots, selectedId, onPick }: Props) {',
        '  return (',
        '    <div role="grid" aria-label="Doctor time slots" className="grid grid-cols-3 gap-2">',
        '      {slots.map((slot) => (',
        '        <button key={slot.id} aria-pressed={slot.id === selectedId}',
        '          onClick={() => onPick(slot.id)}',
        '          className="rounded border px-3 py-2 text-sm focus-visible:ring-2">',
        '          {slot.timeLabel} · {slot.room}',
        '        </button>',
        '      ))}',
        '    </div>',
        '  );',
        '}',
      ],
      terminalOutput: 'axe-core accessibility check: 0 critical violations across 18 screens',
      deliverables: [
        { label: 'Keyboard-navigable time slot selector', done: true },
        { label: 'Low-bandwidth WebRTC consult banner', done: true },
        { label: 'Swahili / English i18n copy pass', done: false },
      ],
    },
    jobApp: {
      appType: 'design',
      appTabLabel: 'UI Studio',
      appName: 'Figma + Live UI Component Canvas',
      kpis: [
        { label: 'Lighthouse UI', value: '99/100', delta: 'Perf' },
        { label: 'WCAG Contrast', value: 'AAA 7.4:1', delta: '0 issues' },
        { label: 'Breakpoints', value: '4 views', delta: 'Synced' },
      ],
      chartBars: [0.7, 0.78, 0.82, 0.91, 0.96, 0.99],
      chartLabels: ['320', '390', '768', '1024', '1280', '1440'],
      visualHeadline: 'Book Cardiology Consultation · Nairobi Hospital',
      visualSubline: 'Dr. Amina O. · Today 14:30 · Room 4B · Telehealth Ready',
      visualItems: [
        { title: 'SlotButton / Selected', meta: '#0f766e · Focus Ring 2px', status: 'Ready' },
        { title: 'PatientIntakeCard', meta: 'Responsive 2-col Grid', status: 'Ready' },
        { title: 'Swahili Copy Tokens', meta: 'i18n.sw.json review', status: 'Draft' },
      ],
    },
  },

  // E-Commerce (Level 3)
  cart: {
    stationKey: 'cart',
    projectTitle: 'Savanna Roasters Export Storefront',
    clientName: 'Savanna Roasters Kenya',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'DHL Express East Africa Tariff API',
        url: 'https://developer.dhl.com/api-reference/dhl-express-mydhl-api',
        searchQuery: 'dhl express mydhl volumetric weight coffee export kenya eu',
        articleTitle: 'MyDHL Rate Quote Integration for Perishable Exports',
        articleDomain: 'developer.dhl.com',
        sections: [
          {
            heading: 'Customs HS Code 0901.21',
            excerpt: 'Roasted coffee exports require HS 09012100 declaration and phytosanitary certificate flag in commercial invoice payload.',
            highlight: 'Auto-split orders > 25kg into multi-piece airwaybill pallets.',
          },
        ],
        researchNote: 'Mapped HS 09012100 & automated EU VAT landed-cost breakdown.',
      },
      {
        tabTitle: 'Baymard Checkout Abandonment Study',
        url: 'https://baymard.com/lists/cart-abandonment-rate',
        searchQuery: 'ecommerce checkout express mpese paystack conversion uplift',
        articleTitle: 'Reducing Checkout Steps from 5 Screens to 2',
        articleDomain: 'baymard.com',
        sections: [
          {
            heading: 'Inline Shipping Estimator',
            excerpt: 'Showing exact DHL + M-Pesa Express total inside the slide-over cart cuts drop-off by 22% before address entry.',
            highlight: 'Default local Nairobi deliveries to same-day rider flat rate KES 350.',
          },
        ],
        researchNote: 'Enabled guest M-Pesa Express checkout directly from cart drawer.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Coffee Export SKU & Inventory Ledger',
      columns: ['SKU / Roast', 'Weight', 'Price (KES)', 'Stock'],
      initialRows: [
        ['Nyeri AA Peaberry', '500g', 'KES 1,850', '▲ 142 bags'],
        ['Kirinyaga Reserve', '1kg', 'KES 3,400', '▲ 88 bags'],
        ['Mt. Kenya Espresso', '250g', 'KES 980', '▲ 215 bags'],
        ['Wholesale Cafe Tin', '5kg', 'KES 14,500', '▲ 34 tins'],
      ],
      incomingQueue: [
        ['Rift Valley Honey', '500g', 'KES 2,100', '▲ 96 bags'],
        ['Cold Brew Concentrate', '750ml', 'KES 1,250', '▲ 64 btls'],
        ['Decaf Swiss Water', '250g', 'KES 1,150', '▲ 52 bags'],
        ['Barista Tasting Box', '4×200g', 'KES 3,200', 'Low (14)'],
      ],
    },
    projectWork: {
      fileName: 'src/lib/checkoutShippingCalc.ts',
      language: 'TypeScript',
      accent: '#ffb45e',
      codeLines: [
        'export function quoteExportOrder(items: CartItem[], destCountry: string) {',
        '  const totalKg = items.reduce((s, i) => s + i.grams * i.qty, 0) / 1000;',
        "  const isLocal = destCountry === 'KE';",
        '  const freight = isLocal ? 350 : Math.ceil(totalKg) * 2450;',
        '  const vatRate = isLocal ? 0.16 : 0; // zero-rated export',
        '  return { totalKg, freight, vatRate, currency: isLocal ? "KES" : "USD" };',
        '}',
      ],
      terminalOutput: 'Build complete · Storefront bundle 118 kB gzipped · Paystack & M-Pesa live',
      deliverables: [
        { label: 'Multi-currency KES/USD storefront toggle', done: true },
        { label: 'DHL Express real-time export rate API', done: true },
        { label: 'Wholesale B2B invoice net-30 portal', done: false },
      ],
    },
    jobApp: {
      appType: 'design',
      appTabLabel: 'Storefront',
      appName: 'E-Commerce Catalog & Checkout Builder',
      kpis: [
        { label: 'Cart Conversion', value: '4.6%', delta: '+1.2%' },
        { label: 'Orders Today', value: '128', delta: 'KES 412k' },
        { label: 'DHL Quote API', value: 'Live', delta: 'EU/US/KE' },
      ],
      chartBars: [0.45, 0.52, 0.61, 0.74, 0.83, 0.92],
      chartLabels: ['Wk1', 'Wk2', 'Wk3', 'Wk4', 'Wk5', 'Now'],
      visualHeadline: 'Nyeri AA Peaberry (500g) · KES 1,850',
      visualSubline: 'M-Pesa Express + DHL Export Calc · 142 bags in stock',
      visualItems: [
        { title: 'Hero Product Card', meta: 'KES / USD live switcher', status: 'Live' },
        { title: 'Slide-Over Cart Drawer', meta: '1-Tap STK Checkout', status: 'Live' },
        { title: 'Wholesale Net-30 Tier', meta: 'Cafe bulk pricing rules', status: 'QA' },
      ],
    },
  },

  // CMS & WordPress (Level 3)
  wp: {
    stationKey: 'wp',
    projectTitle: 'East Africa Law Society Portal',
    clientName: 'East Africa Law Society',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'WP REST API Transient Caching',
        url: 'https://developer.wordpress.org/rest-api/extending-the-rest-api/',
        searchQuery: 'wordpress rest api custom endpoint redis object cache',
        articleTitle: 'High-Scale Member Directory Endpoints in WordPress',
        articleDomain: 'developer.wordpress.org',
        sections: [
          {
            heading: 'Indexed Custom Table for 18,000 Advocates',
            excerpt: 'Avoid slow wp_postmeta joins for directory search by syncing practice-area filters to a dedicated indexed SQL table.',
            highlight: 'Query time dropped from 1,420ms to 18ms for regional bar filtering.',
          },
        ],
        researchNote: 'Migrated advocate search from wp_meta_query to custom indexed table.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Regional Advocate Directory Migration',
      columns: ['Advocate', 'Bar / City', 'Practice Area', 'License'],
      initialRows: [
        ['Grace Mutua', 'LSK · Nairobi', 'Commercial Law', '▲ Active'],
        ['Daniel Okello', 'ULS · Kampala', 'Arbitration', '▲ Active'],
        ['Amina Hassan', 'TLS · Arusha', 'IP & Tech Law', '▲ Active'],
        ['Jean-Luc N.', 'RBA · Kigali', 'Cross-Border Tax', '▲ Active'],
      ],
      incomingQueue: [
        ['Samuel Kiptoo', 'LSK · Eldoret', 'Conveyancing', '▲ Active'],
        ['Beatrice Mushi', 'TLS · Dar', 'Maritime Law', '▲ Active'],
        ['Miriam Wambui', 'LSK · Mombasa', 'Energy & PPP', 'Pending CLE'],
        ['Patrick Ochieng', 'LSK · Kisumu', 'Banking & Fin', '▲ Active'],
      ],
    },
    projectWork: {
      fileName: 'wp-content/plugins/eals-dir/advocate_sync.php',
      language: 'PHP 8.3',
      accent: '#8fc0ff',
      codeLines: [
        '<?php',
        'function eals_search_advocates(WP_REST_Request $req) {',
        '  global $wpdb;',
        "  $city = sanitize_text_field($req->get_param('city'));",
        '  $sql = $wpdb->prepare(',
        '    "SELECT full_name, bar_id, area FROM {$wpdb->prefix}eals_members WHERE city = %s LIMIT 50",',
        '    $city',
        '  );',
        '  return rest_ensure_response($wpdb->get_results($sql));',
        '}',
      ],
      terminalOutput: 'PHPStan level 8 clean · 18,420 advocate records indexed in staging',
      deliverables: [
        { label: 'Custom indexed SQL advocate directory', done: true },
        { label: 'Annual CLE CPD credit verification sync', done: true },
        { label: 'Gazette PDF archive full-text search', done: false },
      ],
    },
    jobApp: {
      appType: 'design',
      appTabLabel: 'CMS Builder',
      appName: 'WordPress Block Editor & Directory CMS',
      kpis: [
        { label: 'Advocates Live', value: '18,420', delta: 'Indexed' },
        { label: 'Page Speed', value: '18ms', delta: 'Redis OK' },
        { label: 'Plugins Updated', value: '12/12', delta: 'Clean' },
      ],
      chartBars: [0.55, 0.64, 0.71, 0.82, 0.89, 0.95],
      chartLabels: ['KE', 'UG', 'TZ', 'RW', 'BI', 'SS'],
      visualHeadline: 'EALS Regional Advocate Directory · Block Template',
      visualSubline: 'Filter by Bar Association (LSK / ULS / TLS) & Practice Area',
      visualItems: [
        { title: 'DirectorySearchBlock', meta: 'Custom Gutenberg React', status: 'Published' },
        { title: 'CLE Credit Badge', meta: 'ACF Field Group Sync', status: 'Published' },
        { title: 'Gazette PDF Archive', meta: 'Full-text Elasticsearch', status: 'Staging' },
      ],
    },
  },

  // SEO (Level 2)
  seo: {
    stationKey: 'seo',
    projectTitle: 'Kilimani Dental & MedSpa Organic Growth',
    clientName: 'Kilimani Dental Studio',
    primaryMode: 'browser',
    browserSessions: [
      {
        tabTitle: 'Google Search Central · MedicalClinic Schema',
        url: 'https://developers.google.com/search/docs/appearance/structured-data/local-business',
        searchQuery: 'schema org Dentist MedicalClinic JSON-LD local pack nairobi',
        articleTitle: 'LocalBusiness & Dentist Structured Data Guidelines',
        articleDomain: 'developers.google.com/search',
        sections: [
          {
            heading: 'OpeningHours & MedicalSpecialty Properties',
            excerpt: 'Include exact geo coordinates, accepted insurance providers, and verified patient review aggregateRating JSON-LD.',
            highlight: 'Rich snippet impression share grew +46% in 21 days post-deployment.',
          },
        ],
        researchNote: 'Deploying DentalClinic JSON-LD across all 6 Nairobi service pages.',
      },
      {
        tabTitle: 'SEMrush SERP Gap · Nairobi Orthodontics',
        url: 'https://www.semrush.com/analytics/keywordgap/',
        searchQuery: 'dental implants nairobi cost clear aligners search volume ke',
        articleTitle: 'Competitor Keyword Gap: Cosmetic Dentistry Kenya',
        articleDomain: 'semrush.com',
        sections: [
          {
            heading: 'High-Intent Local Queries',
            excerpt: '"Invisalign Nairobi price" (1,900/mo, KD 24) has no localized cost calculator page on top 3 domains.',
            highlight: 'Opportunity: publish interactive treatment estimator guide targeting KD 24.',
          },
        ],
        researchNote: 'Briefed content team on Aligners Cost Estimator landing page.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Organic Keyword Rank & On-Page Audit',
      columns: ['Keyword (KE)', 'Vol / mo', 'Rank', 'Action'],
      initialRows: [
        ['dentist in kilimani', '3,600', '#2 (▲+4)', 'Schema live'],
        ['dental implants nairobi', '2,400', '#3 (▲+6)', 'H1 tuned'],
        ['teeth whitening cost ke', '1,900', '#4 (▲+3)', 'FAQ added'],
        ['pediatric dentist westlands', '1,300', '#5 (▲+7)', 'CWV fixed'],
      ],
      incomingQueue: [
        ['clear aligners nairobi', '1,900', '#6 (▲+9)', 'Guide draft'],
        ['emergency dentist 24hr ke', '880', '#1 (▲+2)', 'GMB synced'],
        ['root canal price nairobi', '1,600', '#4 (▲+5)', 'Schema live'],
        ['veneers kenya clinic', '1,100', '#5 (▲+4)', 'Alt tags OK'],
      ],
    },
    projectWork: {
      fileName: 'public/schema/dental-clinic-jsonld.json',
      language: 'JSON-LD',
      accent: '#bfe87a',
      codeLines: [
        '{',
        '  "@context": "https://schema.org",',
        '  "@type": "Dentist",',
        '  "name": "Kilimani Dental Studio",',
        '  "address": { "@type": "PostalAddress", "addressLocality": "Nairobi", "addressCountry": "KE" },',
        '  "telephone": "+254-711-402-890",',
        '  "medicalSpecialty": ["Orthodontics", "Implantology", "CosmeticDentistry"]',
        '}',
      ],
      terminalOutput: 'Google Rich Results Test: Valid Dentist & FAQPage markup detected',
      deliverables: [
        { label: 'Core Web Vitals LCP < 1.8s on mobile', done: true },
        { label: 'MedicalClinic & FAQ JSON-LD rollout', done: true },
        { label: 'Google Business Profile Q&A optimization', done: false },
      ],
    },
    jobApp: {
      appType: 'marketing',
      appTabLabel: 'Search Console',
      appName: 'Google Search Console & SERP Audit',
      kpis: [
        { label: 'Organic Clicks', value: '14.8k/mo', delta: '+46%' },
        { label: 'Avg Position', value: '#2.8', delta: '+4 spots' },
        { label: 'Core Web Vitals', value: '1.5s LCP', delta: 'Good' },
      ],
      chartBars: [0.32, 0.44, 0.56, 0.69, 0.84, 0.95],
      chartLabels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
      visualHeadline: 'Kilimani Dental Studio — Implants & Clear Aligners Nairobi',
      visualSubline: 'kilimanidental.co.ke › treatments › dental-implants · ★ 4.9 (214)',
      visualItems: [
        { title: 'Dentist JSON-LD Schema', meta: 'Rich Snippets Validated', status: 'Indexed' },
        { title: '"dentist in kilimani"', meta: '3,600 searches/mo · Pos #2', status: 'Top 3' },
        { title: 'Aligners Cost Guide', meta: 'On-page H1 + FAQ draft', status: 'In Edit' },
      ],
    },
  },

  // Digital Marketing (Level 2)
  mkt: {
    stationKey: 'mkt',
    projectTitle: 'Mombasa Coastal Estates Q4 Lead Funnel',
    clientName: 'Pwani Luxury Residences',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'GA4 Multi-Touch Attribution Guide',
        url: 'https://support.google.com/analytics/answer/10596866',
        searchQuery: 'ga4 data driven attribution real estate lead scoring',
        articleTitle: 'Measuring Cross-Channel Assisted Conversions in GA4',
        articleDomain: 'support.google.com/analytics',
        sections: [
          {
            heading: 'WhatsApp Click + Viewing Form Attribution',
            excerpt: '62% of diaspora villa buyers first discover listings via YouTube/Meta, then convert 9 days later via Branded Search.',
            highlight: 'Shift 20% budget from generic display to retargeting virtual-tour leads.',
          },
        ],
        researchNote: 'Updated GA4 custom conversion event on virtual tour completion.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Q4 Multi-Channel Lead & CPL Ledger',
      columns: ['Channel', 'Spend', 'MQLs', 'Cost / Lead'],
      initialRows: [
        ['Google Search KE', 'KES 145,000', '118', '▲ KES 1,228'],
        ['Diaspora UK/US Ads', 'KES 210,000', '94', '▲ KES 2,234'],
        ['Email Nurture Drip', 'KES 28,000', '76', '▲ KES 368'],
        ['LinkedIn Executive', 'KES 95,000', '41', 'KES 2,317'],
      ],
      incomingQueue: [
        ['YouTube Villa Tours', 'KES 112,000', '69', '▲ KES 1,623'],
        ['Instagram Carousels', 'KES 74,000', '82', '▲ KES 902'],
        ['WhatsApp VIP List', 'KES 19,500', '61', '▲ KES 319'],
        ['Property24 Listing', 'KES 48,000', '39', '▲ KES 1,230'],
      ],
    },
    projectWork: {
      fileName: 'campaigns/pwani-q4-utm-taxonomy.ts',
      language: 'TypeScript',
      accent: '#ffffff',
      codeLines: [
        'export const PWANI_UTM_RULES = {',
        "  campaign: 'q4_nyali_beachfront_2026',",
        "  sources: ['google_cpc', 'meta_diaspora', 'youtube_tour', 'wa_vip'],",
        "  conversionEvents: ['book_site_visit', 'download_brochure', 'wa_agent_chat'],",
        '  targetCplKes: 1450,',
        '};',
      ],
      terminalOutput: 'GA4 Measurement Protocol active · 437 verified leads synced to HubSpot CRM',
      deliverables: [
        { label: 'Diaspora investor landing page + brochure gate', done: true },
        { label: 'HubSpot 7-day automated WhatsApp follow-up', done: true },
        { label: 'Monthly executive ROAS deck for client', done: false },
      ],
    },
    jobApp: {
      appType: 'marketing',
      appTabLabel: 'GA4 Funnel',
      appName: 'GA4 Attribution & Campaign Manager',
      kpis: [
        { label: 'Qualified Leads', value: '437 MQLs', delta: '+31%' },
        { label: 'Blended CPL', value: 'KES 1,190', delta: '-19%' },
        { label: 'Site Visits Booked', value: '68', delta: 'Q4 Goal' },
      ],
      chartBars: [0.38, 0.51, 0.62, 0.74, 0.86, 0.91],
      chartLabels: ['Search', 'Diasp', 'Email', 'Video', 'IG', 'WA'],
      visualHeadline: 'Pwani Luxury Residences · Nyali Beachfront Q4 Funnel',
      visualSubline: 'GA4 Event: book_site_visit · HubSpot Auto-Follow-Up Active',
      visualItems: [
        { title: 'Diaspora UK/US Funnel', meta: '94 MQLs · KES 2,234 CPL', status: 'Scaling' },
        { title: 'WhatsApp VIP Drip', meta: '61 MQLs · KES 319 CPL', status: 'Top ROI' },
        { title: 'Investor ROI Deck', meta: 'Q4 channel mix review', status: 'Drafting' },
      ],
    },
  },

  // PPC Google Ads (Level 2)
  ppc: {
    stationKey: 'ppc',
    projectTitle: 'Rift Valley Logistics Freight Search Ads',
    clientName: 'Rift Valley Cargo & Fleet',
    primaryMode: 'project',
    browserSessions: [
      {
        tabTitle: 'Google Ads Scripts · ROAS Anomaly Guard',
        url: 'https://developers.google.com/google-ads/scripts/docs/solutions/anomaly-detector',
        searchQuery: 'google ads script pause high cpa keyword hourly anomaly check',
        articleTitle: 'Automated Budget & CPA Guardrails Using Ads Scripts',
        articleDomain: 'developers.google.com/google-ads',
        sections: [
          {
            heading: 'Hourly Spend Spike Protection',
            excerpt: 'Check campaign spend velocity every 60 minutes against 14-day trailing averages and alert Slack if CPC spikes > 35%.',
            highlight: 'Saved KES 84,000/month in irrelevant job-seeker search terms via negative lists.',
          },
        ],
        researchNote: 'Added 42 logistics-career negative keywords across Nairobi-Mombasa corridor.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Live Google Ads Bid & Quality Score Sheet',
      columns: ['Ad Group', 'Max CPC', 'QS / CTR', 'Conversions'],
      initialRows: [
        ['Nairobi–Mombasa Haulage', 'KES 48', '9/10 · 8.4%', '▲ 46 quotes'],
        ['Cold Chain Transport', 'KES 62', '8/10 · 6.9%', '▲ 29 quotes'],
        ['Container Clearing ICD', 'KES 55', '9/10 · 7.5%', '▲ 34 quotes'],
        ['Cross-Border Kampala', 'KES 70', '8/10 · 6.1%', '▲ 21 quotes'],
      ],
      incomingQueue: [
        ['20ft Reefer Charter', 'KES 58', '9/10 · 7.2%', '▲ 19 quotes'],
        ['JKIA Air Cargo Clear', 'KES 64', '8/10 · 6.4%', '▲ 27 quotes'],
        ['Bulk Grain Logistics', 'KES 41', '9/10 · 8.9%', '▲ 31 quotes'],
      ],
    },
    projectWork: {
      fileName: 'scripts/roas_anomaly_guard.js',
      language: 'Google Ads JS',
      accent: '#7fb0ff',
      codeLines: [
        'function main() {',
        "  const iter = AdsApp.campaigns().withCondition('Status = ENABLED').get();",
        '  while (iter.hasNext()) {',
        '    const c = iter.next();',
        "    const stats = c.getStatsFor('TODAY');",
        '    if (stats.getCost() > 15000 && stats.getConversions() === 0) {',
        "      MailApp.sendEmail('ppc@domaintechhub.co.ke', 'CPA Alert', c.getName());",
        '    }',
        '  }',
        '}',
      ],
      terminalOutput: 'Hourly Ads Script executed · Blended Cost/Quote improved -18.4% WoW',
      deliverables: [
        { label: 'Mombasa Corridor Exact-Match keyword tree', done: true },
        { label: 'Offline CRM quote-won conversion import', done: true },
        { label: 'Performance Max freight retargeting assets', done: false },
      ],
    },
    jobApp: {
      appType: 'marketing',
      appTabLabel: 'Google Ads',
      appName: 'Google Ads Manager & Bid Optimizer',
      kpis: [
        { label: 'Avg CTR', value: '7.8%', delta: '+1.9%' },
        { label: 'Cost / Quote', value: 'KES 640', delta: '-18%' },
        { label: 'Quality Score', value: '9 / 10', delta: 'Exact' },
      ],
      chartBars: [0.48, 0.56, 0.68, 0.75, 0.88, 0.93],
      chartLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      visualHeadline: 'Ad · Rift Valley Cargo — Mombasa–Nairobi Fleet Dispatch',
      visualSubline: 'GPS-tracked 20ft/40ft haulage & cold chain · Instant quote in 5 mins',
      visualItems: [
        { title: 'Mombasa Haulage Exact', meta: 'CPC KES 48 · 46 quotes', status: 'Active' },
        { title: 'Negative List Guard', meta: '42 job-seeker terms blocked', status: 'Running' },
        { title: 'PMax Asset Group', meta: 'Fleet banners & headlines', status: 'In Review' },
      ],
    },
  },

  // WhatsApp Marketing (Level 2)
  wa: {
    stationKey: 'wa',
    projectTitle: 'QuickMart Order-Ahead & Loyalty Bot',
    clientName: 'QuickMart Retail Kenya',
    primaryMode: 'project',
    browserSessions: [
      {
        tabTitle: 'Meta WhatsApp Cloud API · Flows',
        url: 'https://developers.facebook.com/docs/whatsapp/flows',
        searchQuery: 'whatsapp cloud api interactive list message mpesa paybill trigger',
        articleTitle: 'Building Zero-Drop Checkout Inside WhatsApp Flows',
        articleDomain: 'developers.facebook.com',
        sections: [
          {
            heading: 'Template Approval Category: UTILITY',
            excerpt: 'Order confirmation & M-Pesa receipt templates under UTILITY avoid marketing per-message throttling and achieve 99.2% delivery.',
            highlight: 'Average order completion time inside WhatsApp chat: 48 seconds.',
          },
        ],
        researchNote: 'Submitted 4 utility order-status templates for Kilimani & Westlands branches.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Broadcast Segment & Delivery Register',
      columns: ['Segment', 'Recipients', 'Delivered', 'Opt-in Rate'],
      initialRows: [
        ['Westlands Fresh VIP', '14,200', '98.9%', '▲ 41.2%'],
        ['Kilimani Weekend Deals', '19,850', '98.4%', '▲ 36.8%'],
        ['Bakery Order Alerts', '8,410', '99.4%', '▲ 52.0%'],
        ['Loyalty Points Expiry', '11,600', '99.1%', '▲ 44.5%'],
      ],
      incomingQueue: [
        ['Karen Organic Basket', '6,920', '99.2%', '▲ 47.6%'],
        ['Lavington Baby Care', '5,340', '98.7%', '▲ 39.4%'],
        ['Roysambu Flash Promo', '16,100', '98.1%', '▲ 33.9%'],
      ],
    },
    projectWork: {
      fileName: 'src/bots/waOrderWebhook.ts',
      language: 'TypeScript',
      accent: '#7cf59a',
      codeLines: [
        'export async function onInteractiveReply(from: string, replyId: string) {',
        "  if (replyId.startsWith('BASKET_ADD_')) {",
        '    const sku = replyId.replace("BASKET_ADD_", "");',
        '    const total = await addCartItem(from, sku);',
        '    return sendMpesaPayPrompt(from, total);',
        '  }',
        "  return sendBranchSelector(from, ['Westlands', 'Kilimani', 'Karen']);",
        '}',
      ],
      terminalOutput: 'Webhook healthy · 3,412 active grocery sessions today · 99.1% delivery',
      deliverables: [
        { label: 'Branch inventory sync into WhatsApp catalog', done: true },
        { label: 'One-tap M-Pesa STK prompt inside chat', done: true },
        { label: 'Automated rider ETA status ping', done: false },
      ],
    },
    jobApp: {
      appType: 'social',
      appTabLabel: 'WhatsApp Flows',
      appName: 'Meta WhatsApp Cloud Flow Builder',
      kpis: [
        { label: 'Delivery Rate', value: '99.1%', delta: 'Utility' },
        { label: 'Live Orders', value: '3,412', delta: 'Today' },
        { label: 'Avg Checkout', value: '48 sec', delta: 'In-chat' },
      ],
      chartBars: [0.52, 0.68, 0.74, 0.81, 0.92, 0.98],
      chartLabels: ['8am', '10am', '12pm', '2pm', '4pm', '6pm'],
      visualHeadline: 'QuickMart Bot: Tap to select Westlands Fresh Basket',
      visualSubline: 'Customer replied: "2kg Basmati + Milk" -> Sent M-Pesa STK KES 1,140',
      visualItems: [
        { title: 'Branch Stock Sync', meta: 'Westlands / Kilimani / Karen', status: 'Live' },
        { title: 'STK Pay Template', meta: 'Meta Utility Approved', status: 'Active' },
        { title: 'Rider ETA Webhook', meta: 'Live GPS dispatch ping', status: 'Testing' },
      ],
    },
  },

  // Social Media (Level 1)
  social: {
    stationKey: 'social',
    projectTitle: 'Nairobi Design Week Social Campaign',
    clientName: 'East Africa Craft Collective',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'TikTok & Reels Creative Benchmarks',
        url: 'https://ads.tiktok.com/business/creativecenter/inspiration/topads',
        searchQuery: 'east africa retail short form video 3 second hook retention stats',
        articleTitle: '2026 Short-Form Video Retention Benchmarks for Retail Brands',
        articleDomain: 'ads.tiktok.com/creativecenter',
        sections: [
          {
            heading: '3-Second Visual Hook Window',
            excerpt: 'Opening Reels with studio craftsmanship motion + bold Swahili/English kinetic captions raises 3-second hold rate from 29% to 54%.',
            highlight: 'Batch-schedule vertical 9:16 cuts for Thu 18:30 EAT peak scroll window.',
          },
        ],
        researchNote: 'Updated video brief templates to require kinetic caption hook in first 2.5s.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Creator Deliverable & Reach Tracker',
      columns: ['Campaign Post', 'Platform', 'Reach', 'Save Rate'],
      initialRows: [
        ['Studio Behind-Scenes', 'IG Reels', '84,200', '▲ 6.4%'],
        ['Nairobi Maker Tour', 'TikTok', '142,500', '▲ 8.1%'],
        ['Lookbook Carousel #3', 'Instagram', '39,400', '▲ 4.9%'],
        ['Founder Q&A Clip', 'LinkedIn', '21,800', '▲ 3.7%'],
      ],
      incomingQueue: [
        ['Pop-Up Countdown Reel', 'IG Reels', '67,900', '▲ 7.2%'],
        ['Designer Fit Check', 'TikTok', '196,400', '▲ 9.3%'],
        ['Weekend Event Map', 'X / Threads', '28,600', '▲ 4.1%'],
      ],
    },
    projectWork: {
      fileName: 'content/ndw-reel-schedule.json',
      language: 'JSON',
      accent: '#ff8fc0',
      codeLines: [
        '{',
        '  "campaign": "Nairobi Design Week Pop-Up",',
        '  "publishWindowEAT": "18:30",',
        '  "formats": ["9:16 Reels", "TikTok Cut", "LinkedIn Carousel"],',
        '  "trackingLink": "https://ea-craft.co.ke/?utm_source=ig_reels&utm_camp=ndw26"',
        '}',
      ],
      terminalOutput: 'Creator assets approved: 14/16 · Scheduled across Meta & TikTok Business',
      deliverables: [
        { label: 'Creator briefing packs & UTM links', done: true },
        { label: 'Reel audio stems & subtitle burn-ins', done: true },
        { label: 'Live weekend pop-up story coverage', done: false },
      ],
    },
    jobApp: {
      appType: 'social',
      appTabLabel: 'Content Studio',
      appName: 'Meta & TikTok Creator Publishing Suite',
      kpis: [
        { label: 'Total Reach', value: '488k', delta: '+62%' },
        { label: '3s Hold Rate', value: '54%', delta: '+25pt' },
        { label: 'Scheduled Posts', value: '14/16', delta: 'EAT 18:30' },
      ],
      chartBars: [0.4, 0.58, 0.72, 0.65, 0.88, 0.96],
      chartLabels: ['IG', 'Reels', 'TikTok', 'LI', 'X', 'YT'],
      visualHeadline: 'Nairobi Design Week · Kinetic Studio Craftsmanship Reel',
      visualSubline: 'Caption: "Hand-loomed in Kilimani — Pop-Up opens Fri 10AM #NDW26"',
      visualItems: [
        { title: '9:16 TikTok Cut', meta: '196k views · 9.3% saves', status: 'Scheduled' },
        { title: 'IG Lookbook Carousel', meta: 'Swahili/English hook', status: 'Approved' },
        { title: 'Live Pop-Up Stories', meta: 'Creator briefing pack', status: 'Next' },
      ],
    },
  },

  // Custom CRM (Level 1)
  crm: {
    stationKey: 'crm',
    projectTitle: 'Apex Insurance Policy & Claims CRM',
    clientName: 'Apex Insurance Brokers',
    primaryMode: 'project',
    browserSessions: [
      {
        tabTitle: 'PostgreSQL Row-Level Security Policies',
        url: 'https://www.postgresql.org/docs/16/ddl-rowsecurity.html',
        searchQuery: 'postgresql rls multi branch broker agent policy isolation',
        articleTitle: 'Isolating Regional Broker Portfolios with PostgreSQL RLS',
        articleDomain: 'postgresql.org/docs/16',
        sections: [
          {
            heading: 'Session Tenant Context',
            excerpt: 'Enforce SET LOCAL app.branch_id inside every API transaction so branch underwriters never read cross-region claims.',
            highlight: 'Zero accidental data leakage even under ad-hoc reporting queries.',
          },
        ],
        researchNote: 'Verified RLS policy test suite across Nairobi, Mombasa, and Kisumu branches.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Corporate Policy & Claims Intake Sheet',
      columns: ['Policyholder', 'Cover Type', 'Premium', 'Claim SLA'],
      initialRows: [
        ['Highland Tea Co.', 'Fleet Motor (42)', 'KES 2.8M', '▲ 1.4h avg'],
        ['Metro Logistics', 'Goods in Transit', 'KES 1.4M', '▲ 2.1h avg'],
        ['Kilimani Medical', 'Med Malpractice', 'KES 3.1M', '▲ 0.9h avg'],
        ['Rift Solar Farm', 'Industrial Asset', 'KES 4.6M', '▲ 1.8h avg'],
      ],
      incomingQueue: [
        ['Safari Air Charter', 'Aviation Hull', 'KES 8.2M', '▲ 0.6h avg'],
        ['Savanna Roasters', 'Marine Cargo', 'KES 940k', '▲ 1.5h avg'],
        ['Athi River Steel', 'Work Injury WIBA', 'KES 1.9M', 'Pending Docs'],
      ],
    },
    projectWork: {
      fileName: 'src/workflows/claimEscalation.ts',
      language: 'TypeScript',
      accent: '#8ab4ff',
      codeLines: [
        'export function evaluateClaimSla(claim: PolicyClaim, nowMs: number) {',
        '  const ageHours = (nowMs - claim.openedAt) / 3_600_000;',
        "  const urgent = claim.amountKes > 500_000 || claim.tier === 'VIP';",
        '  const slaLimit = urgent ? 2 : 8;',
        '  return { overdue: ageHours > slaLimit, assignTo: urgent ? "SENIOR_ADJUSTER" : "DESK" };',
        '}',
      ],
      terminalOutput: 'CRM Integration Tests: 26/26 passing · IRA Compliance Export ready',
      deliverables: [
        { label: 'Automated renewal alert 30/14/3 days prior', done: true },
        { label: 'Broker commission split ledger', done: true },
        { label: 'IRA regulatory quarterly PDF generator', done: false },
      ],
    },
    jobApp: {
      appType: 'ide',
      appTabLabel: 'CRM Pipeline',
      appName: 'VS Code + Broker Policy Pipeline',
      kpis: [
        { label: 'Policies Synced', value: '1,840', delta: 'RLS Safe' },
        { label: 'Avg Claim SLA', value: '1.4 hrs', delta: '-42%' },
        { label: 'Renewals Due', value: '24', delta: '30 days' },
      ],
      chartBars: [0.6, 0.71, 0.69, 0.82, 0.87, 0.93],
      chartLabels: ['Motor', 'Med', 'Marine', 'Asset', 'WIBA', 'Life'],
      visualHeadline: 'Claim #CLM-8821 · Highland Tea Fleet -> Auto-Escalated (VIP)',
      visualSubline: 'Assigned Senior Adjuster · SLA Countdown: 01h 42m remaining',
      visualItems: [
        { title: 'claimEscalation.ts', meta: '26/26 integration tests pass', status: 'Deployed' },
        { title: 'BrokerSplitLedger', meta: 'KES 12.8M premiums active', status: 'Live' },
        { title: 'IRA Quarterly Export', meta: 'Automated PDF compliance', status: 'Building' },
      ],
    },
  },

  // AI Solutions (Level 1)
  ai: {
    stationKey: 'ai',
    projectTitle: 'AgriPulse Swahili Crop Advisory RAG',
    clientName: 'AgriPulse East Africa',
    primaryMode: 'browser',
    browserSessions: [
      {
        tabTitle: 'Hybrid Retrieval · BM25 + Dense Rerank',
        url: 'https://arxiv.org/abs/2402.03367',
        searchQuery: 'hybrid bm25 dense vector rerank low resource swahili agriculture rag',
        articleTitle: 'Reciprocal Rank Fusion for Multilingual Agronomy Knowledge Bases',
        articleDomain: 'arxiv.org · ML Research',
        sections: [
          {
            heading: 'Bilingual Pest & Soil Terminology',
            excerpt: 'Combining sparse BM25 lexical matching with multilingual embeddings improves Swahili crop-disease recall by +19.4%.',
            highlight: 'Ground every advisory dosage recommendation to verified KALRO PDF page numbers.',
          },
        ],
        researchNote: 'Tuned RRF k=60 + cross-encoder reranker on 1,200 KALRO extension manuals.',
      },
      {
        tabTitle: 'KALRO Maize Pest Management Bulletin',
        url: 'https://www.kalro.org/publications/maize-fall-armyworm-control',
        searchQuery: 'kalro fall armyworm maize organic biological control dosage',
        articleTitle: 'Integrated Pest Management for Smallholder Maize Farms',
        articleDomain: 'kalro.org',
        sections: [
          {
            heading: 'Early Scouting Thresholds',
            excerpt: 'Recommend neem-based biopesticide spray when >= 20% of whorl leaves show fresh window-pane feeding damage.',
            highlight: 'Include safe pre-harvest interval and protective gear guidance in Swahili.',
          },
        ],
        researchNote: 'Added 48 verified maize & coffee disease dosage citations into gold eval set.',
      },
    ],
    dataEntry: {
      sheetTitle: 'RAG Grounded Evaluation & Latency Log',
      columns: ['Farmer Query (SW/EN)', 'Citation', 'Grounded', 'Latency'],
      initialRows: [
        ['Dawa ya kiwavi jeshi', 'KALRO #14 p.8', '▲ 98.4%', '410ms'],
        ['Coffee berry disease', 'CRI Manual #3', '▲ 97.9%', '385ms'],
        ['Udongo tindikali pH', 'SoilLab #22', '▲ 96.8%', '442ms'],
        ['Avocado Hass pruning', 'HCDA Guide #9', '▲ 99.1%', '360ms'],
      ],
      incomingQueue: [
        ['Tomato blight rain', 'KALRO #19 p.4', '▲ 97.5%', '395ms'],
        ['Mahindi mbolea DAP', 'NPK Chart #2', '▲ 98.8%', '340ms'],
        ['Dairy silage ratio', 'ILRI Brief #7', '▲ 96.2%', '465ms'],
      ],
    },
    projectWork: {
      fileName: 'pipeline/rag_retriever.py',
      language: 'Python 3.12',
      accent: '#c0a8ff',
      codeLines: [
        'def hybrid_retrieve(query: str, lang: str, top_k: int = 5):',
        '    dense = vector_store.search(embed(query), k=20)',
        '    lexical = bm25_index.query(tokenize_sw_en(query), k=20)',
        '    fused = reciprocal_rank_fusion(dense, lexical, k=60)',
        '    return reranker.score(query, fused)[:top_k]',
      ],
      terminalOutput: 'Eval Harness: Faithfulness 0.974 · Zero ungrounded dosage hallucinations',
      deliverables: [
        { label: 'Swahili/English voice & WhatsApp query pipeline', done: true },
        { label: 'KALRO citation verification guardrail', done: true },
        { label: 'Offline USSD summary fallback mode', done: false },
      ],
    },
    jobApp: {
      appType: 'ide',
      appTabLabel: 'RAG Lab',
      appName: 'Python ML + Hybrid RAG Eval Harness',
      kpis: [
        { label: 'Faithfulness', value: '97.4%', delta: '0 Halluc.' },
        { label: 'Query Latency', value: '385ms', delta: 'RRF k=60' },
        { label: 'KALRO Docs', value: '1,200', delta: 'Indexed' },
      ],
      chartBars: [0.62, 0.71, 0.79, 0.86, 0.93, 0.97],
      chartLabels: ['v1', 'v2', 'BM25', 'Dense', 'RRF', 'Rerank'],
      visualHeadline: 'Query: "Dawa ya kiwavi jeshi kwenye mahindi?" -> Grounded',
      visualSubline: 'Cited: KALRO Maize Manual #14 p.8 · Neem dosage verified (395ms)',
      visualItems: [
        { title: 'rag_retriever.py', meta: 'BM25 + Multilingual Embeds', status: 'Running' },
        { title: 'Swahili Gold Evals', meta: '240 verified farmer Q&As', status: '97.4% OK' },
        { title: 'USSD Fallback Mode', meta: '160-char SMS summarizer', status: 'In Dev' },
      ],
    },
  },

  // Consultancy (Level 1)
  hand: {
    stationKey: 'hand',
    projectTitle: 'Pan-African Fintech ISO-27001 Roadmap',
    clientName: 'PesaLink Horizon Partners',
    primaryMode: 'browser',
    browserSessions: [
      {
        tabTitle: 'Central Bank Digital Credit Compliance',
        url: 'https://www.centralbank.go.ke/licensing/digital-credit-providers/',
        searchQuery: 'cbk digital credit providers data protection odpc audit checklist',
        articleTitle: 'CBK & Kenya ODPC Data Protection Assessment Matrix',
        articleDomain: 'centralbank.go.ke',
        sections: [
          {
            heading: 'Data Localization & Encryption Keys',
            excerpt: 'Customer KYC records and credit scoring logs require AES-256 encryption at rest with audited key rotation every 90 days.',
            highlight: 'Map 34 technical controls directly to ISO-27001 Annex A.8 & A.12.',
          },
        ],
        researchNote: 'Completed gap assessment for 14 Annex A controls ahead of external audit.',
      },
    ],
    dataEntry: {
      sheetTitle: 'ISO-27001 & Cloud Migration Control Matrix',
      columns: ['Control / Wave', 'Owner', 'Budget', 'Status'],
      initialRows: [
        ['A.8 IAM & MFA', 'CISO / Tech', 'USD 14,200', '▲ Compliant'],
        ['Wave 1 Core Ledger', 'Cloud Ops', 'USD 38,500', '▲ Cutover'],
        ['ODPC KYC Vault', 'Legal & DB', 'USD 19,000', '▲ Verified'],
        ['DR Failover Drill', 'SRE Team', 'USD 11,400', '▲ Passed'],
      ],
      incomingQueue: [
        ['A.12 SIEM Logging', 'SecOps', 'USD 16,800', '▲ Compliant'],
        ['Wave 2 Partner APIs', 'Platform', 'USD 27,000', 'In Review'],
        ['Vendor Risk Audit', 'Compliance', 'USD 8,500', '▲ Signed'],
      ],
    },
    projectWork: {
      fileName: 'deliverables/cloud_migration_wave2.md',
      language: 'Markdown',
      accent: '#7fe4ef',
      codeLines: [
        '# PesaLink Horizon · Wave 2 Zero-Downtime Cutover',
        '- Active-Active PostgreSQL logical replication across eu-west-1 & af-south-1',
        '- Dual-write shadow verification for 72h prior to DNS weighted switch',
        '- Target RTO: < 4 minutes | Target RPO: 0 transactions',
      ],
      terminalOutput: 'Steering Committee pack exported · Risk register 100% signed off',
      deliverables: [
        { label: 'Current-state infrastructure & cost audit', done: true },
        { label: 'CBK / ODPC regulatory compliance matrix', done: true },
        { label: 'Board final sign-off presentation', done: false },
      ],
    },
    jobApp: {
      appType: 'executive',
      appTabLabel: 'Advisory Deck',
      appName: 'ISO-27001 Roadmap & Client Architecture Brief',
      kpis: [
        { label: 'ISO Controls', value: '34 / 34', delta: 'Mapped' },
        { label: 'Target RTO', value: '< 4 min', delta: '0 RPO' },
        { label: 'Cloud Savings', value: '24%', delta: 'Wave 2' },
      ],
      chartBars: [0.45, 0.62, 0.75, 0.88, 0.95, 1.0],
      chartLabels: ['Audit', 'IAM', 'KYC', 'DR', 'SIEM', 'Sign'],
      visualHeadline: 'PesaLink Horizon · Wave 2 Zero-Downtime Cutover Blueprint',
      visualSubline: 'Active-Active eu-west-1 & af-south-1 · ODPC Encrypted KYC Vault Ready',
      visualItems: [
        { title: 'Annex A.8 IAM & MFA', meta: 'Verified hardware key MFA', status: 'Compliant' },
        { title: 'Shadow DB Replication', meta: '72h dual-write check', status: 'Verified' },
        { title: 'Steering Deck Final', meta: 'Executive sign-off Friday', status: 'Review' },
      ],
    },
  },

  // Maintenance & Security (Ground)
  sec: {
    stationKey: 'sec',
    projectTitle: 'Managed Hosting Fleet (84 Client Sites)',
    clientName: 'DomainTechHub Infrastructure',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'NVD CVE Security Advisories',
        url: 'https://nvd.nist.gov/vuln/search',
        searchQuery: 'openssl nginx http2 rapid reset advisory ubuntu 24.04 lts',
        articleTitle: 'CVE Mitigation: Edge WAF Rate Limiting & TLS 1.3 Pinning',
        articleDomain: 'nvd.nist.gov',
        sections: [
          {
            heading: 'HTTP/2 Stream Limit Hardening',
            excerpt: 'Enforce http2_max_concurrent_streams 64 and Cloudflare connection burst throttling across all 84 managed ingress nodes.',
            highlight: 'Patch kernel & OpenSSL libraries automatically during 02:00 EAT window.',
          },
        ],
        researchNote: 'Rolled out OpenSSL security patch across 84/84 managed client containers.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Live Fleet Patch, SSL & Backup Register',
      columns: ['Client Node', 'SSL Expiry', 'Uptime 30d', 'Backup'],
      initialRows: [
        ['safaricom-b2b.ke', '248 days', '▲ 99.99%', '▲ S3 OK'],
        ['nairobihosp-tele.org', '192 days', '▲ 99.98%', '▲ S3 OK'],
        ['savannaroasters.co.ke', '310 days', '▲ 99.99%', '▲ S3 OK'],
        ['ealawsociety.org', '144 days', '▲ 99.97%', '▲ S3 OK'],
      ],
      incomingQueue: [
        ['kilimanidental.co.ke', '275 days', '▲ 99.99%', '▲ S3 OK'],
        ['apexbrokers.co.ke', '214 days', '▲ 99.99%', '▲ S3 OK'],
        ['riftcargo.co.ke', '181 days', '▲ 99.96%', '▲ S3 OK'],
      ],
    },
    projectWork: {
      fileName: 'ops/nginx_waf_audit.sh',
      language: 'Bash',
      accent: '#9fc4ff',
      codeLines: [
        '#!/usr/bin/env bash',
        'for host in $(cat /etc/dth/fleet_hosts.txt); do',
        '  expiry=$(echo | openssl s_client -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate)',
        '  echo "[$host] TLS 1.3 OK · $expiry"',
        'done',
      ],
      terminalOutput: 'Fleet Audit: 84/84 nodes green · Zero open CVEs · Nightly S3 checksum verified',
      deliverables: [
        { label: 'Automated SSL cert renewal monitor', done: true },
        { label: 'Offsite encrypted S3 restore drill', done: true },
        { label: 'Zero-trust SSH hardware key rollout', done: false },
      ],
    },
    jobApp: {
      appType: 'security',
      appTabLabel: 'Fleet NOC',
      appName: 'Hosted Fleet Security, SSL & Backup NOC',
      kpis: [
        { label: 'Nodes Online', value: '84 / 84', delta: '99.99%' },
        { label: 'Open CVEs', value: '0 Crit', delta: 'Patched' },
        { label: 'Nightly S3', value: '100% OK', delta: 'Verified' },
      ],
      chartBars: [0.99, 0.99, 0.98, 1.0, 0.99, 1.0],
      chartLabels: ['Web', 'DB', 'WAF', 'SSL', 'Auth', 'B1'],
      visualHeadline: 'Fleet Scan: TLS 1.3 + HTTP/2 Stream Hardening Active',
      visualSubline: 'Last S3 encrypted snapshot verified 03:14 EAT · Zero WAF anomalies',
      visualItems: [
        { title: 'safaricom-b2b.ke', meta: 'SSL 248d · Uptime 99.99%', status: 'Healthy' },
        { title: 'nairobihosp-tele.org', meta: 'OpenSSL 3.2 patched', status: 'Healthy' },
        { title: 'SSH YubiKey Rollout', meta: 'Bastion policy enforcing', status: '64/84' },
      ],
    },
  },

  // Mobile Apps (Ground)
  mobile: {
    stationKey: 'mobile',
    projectTitle: 'MatatuPay NFC Commuter Wallet',
    clientName: 'Metro Transit Kenya',
    primaryMode: 'project',
    browserSessions: [
      {
        tabTitle: 'Android NFC Host Card Emulation (HCE)',
        url: 'https://developer.android.com/develop/connectivity/nfc/hce',
        searchQuery: 'android hce apdu transit tap offline ecda signature latency',
        articleTitle: 'Sub-250ms Offline APDU Exchange for Transit Validators',
        articleDomain: 'developer.android.com',
        sections: [
          {
            heading: 'Pre-Signed Token Batching',
            excerpt: 'Cache 10 single-use ECDSA commuter fare tokens locally so tap-on succeeds in 180ms even inside dead cellular zones.',
            highlight: 'Sync settled tap receipts automatically when 4G connectivity returns.',
          },
        ],
        researchNote: 'Reduced NFC validator handshake roundtrip to 176ms on Pixel 8 & Galaxy A54.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Physical Device QA & Cold-Start Matrix',
      columns: ['Device Model', 'OS Build', 'Tap / Boot', 'Crash-Free'],
      initialRows: [
        ['Samsung Galaxy A54', 'Android 14', '184ms · 1.1s', '▲ 99.94%'],
        ['Google Pixel 8', 'Android 15', '162ms · 0.9s', '▲ 99.98%'],
        ['iPhone 15 Pro', 'iOS 18.1', '158ms · 0.8s', '▲ 99.97%'],
        ['Tecno Camon 30', 'Android 14', '205ms · 1.4s', '▲ 99.89%'],
      ],
      incomingQueue: [
        ['Redmi Note 13', 'Android 14', '196ms · 1.3s', '▲ 99.91%'],
        ['iPhone 13 Mini', 'iOS 18.0', '171ms · 0.9s', '▲ 99.96%'],
        ['Infinix Zero 40', 'Android 14', '212ms · 1.5s', 'In QA'],
      ],
    },
    projectWork: {
      fileName: 'lib/services/nfc_fare_tap.dart',
      language: 'Dart / Flutter',
      accent: '#7ff0dc',
      codeLines: [
        'Future<TapReceipt> processCommuterTap(NfcTag tag, int fareKes) async {',
        '  final token = await tokenVault.popOfflineEcdsaToken();',
        '  final apdu = buildSelectAidCommand(AID_MATATUPAY, token, fareKes);',
        '  final response = await tag.transceive(apdu);',
        '  return TapReceipt.verifyAndQueueSync(response);',
        '}',
      ],
      terminalOutput: 'Flutter Integration Suite: 32/32 tests green · Play Store Internal Track v2.4.1',
      deliverables: [
        { label: 'Offline ECDSA transit fare token vault', done: true },
        { label: 'M-Pesa instant wallet top-up flow', done: true },
        { label: 'Conductor route settlement dashboard', done: false },
      ],
    },
    jobApp: {
      appType: 'ide',
      appTabLabel: 'App Emulator',
      appName: 'Flutter Studio + Android/iOS NFC Emulator',
      kpis: [
        { label: 'NFC Tap Speed', value: '176ms', delta: 'Offline' },
        { label: 'Crash-Free', value: '99.96%', delta: 'v2.4.1' },
        { label: 'Cold Start', value: '0.9s', delta: 'Target <1s' },
      ],
      chartBars: [0.55, 0.68, 0.79, 0.85, 0.94, 0.98],
      chartLabels: ['v1.9', 'v2.0', 'v2.1', 'v2.2', 'v2.3', 'v2.4'],
      visualHeadline: 'MatatuPay Commuter Tap · Route 46 Westlands -> KES 80 Paid',
      visualSubline: 'Offline ECDSA token #8921 verified · Queued for 4G reconciliation',
      visualItems: [
        { title: 'nfc_fare_tap.dart', meta: '32/32 integration tests pass', status: 'Green' },
        { title: 'Pixel 8 & Galaxy A54', meta: 'Hardware HCE tap suite', status: 'Passed' },
        { title: 'Conductor Route Dash', meta: 'Real-time trip totals', status: 'In QA' },
      ],
    },
  },

  // Reception Desk 0 (Front Desk Receptionist)
  'reception-0': {
    stationKey: 'reception-0',
    projectTitle: 'DomainTechHub Lobby Visitor & Access Control',
    clientName: 'Front Desk Operations',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'DTH Building Directory & Room Availability',
        url: 'https://intranet.domaintechhub.co.ke/lobby/directory',
        searchQuery: 'level 4 board room booking visitor parking bay 3',
        articleTitle: 'Live Floor Directory & Visitor Badge Policy',
        articleDomain: 'intranet.domaintechhub.co.ke',
        sections: [
          {
            heading: 'Today’s Scheduled Client Briefings',
            excerpt: 'Level 4 Board Room reserved 11:00–13:00 for Savanna Foods Export Launch; Ground Pod B free until 15:30.',
            highlight: 'Escort external guests requiring B1/B2 access via Security Officer badge.',
          },
        ],
        researchNote: 'Pre-issued NFC visitor badges for Savanna Foods & Law Firm guests.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Live Visitor Check-In & Badge Log',
      columns: ['Visitor', 'Host / Dept', 'Time', 'Status'],
      initialRows: [
        ['Wanjiru K.', 'Consultancy (L1)', '09:30', '▲ Arrived'],
        ['Peter O.', 'Web Dev (L3)', '10:00', '▲ Arrived'],
        ['Savanna Foods (2)', 'E-Commerce (L3)', '11:15', '▲ Checked In'],
        ['Apex Legal Rep', 'Board Sec (L4)', '13:00', 'Expected'],
      ],
      incomingQueue: [
        ['KCB Tech Partner', 'CEO Suite (L5)', '14:00', '▲ Badge #18'],
        ['DHL Courier #4092', 'Front Desk', '14:15', '▲ Signed'],
        ['AgriPulse Agron.', 'AI Solutions (L1)', '15:00', 'Expected'],
        ['Rift Cargo Ops', 'PPC Ads (L2)', '15:45', 'Pre-Booked'],
      ],
    },
    projectWork: {
      fileName: 'lobby/visitor-badges-manifest.json',
      language: 'Access Log',
      accent: '#4ea8ff',
      codeLines: [
        '{ "shift": "Morning-Afternoon", "desk": "DomainTechHub Ground Lobby",',
        '  "activeBadges": 7, "parkingBaysReserved": ["Bay 3", "Bay 5"],',
        '  "nextVipArrival": "KCB Tech Partner · 14:00 -> Level 5 CEO Suite" }',
      ],
      terminalOutput: 'NFC Badge Printer Online · Turnstile sync 12ms · 7 guests on-site',
      deliverables: [
        { label: 'Morning check-in verification & parking bays', done: true },
        { label: 'Courier manifest & department notifications', done: true },
        { label: 'Afternoon VIP lobby escort readiness', done: false },
      ],
    },
    jobApp: {
      appType: 'executive',
      appTabLabel: 'Check-In Desk',
      appName: 'Lobby Reception & NFC Visitor Terminal',
      kpis: [
        { label: 'Guests On-Site', value: '7 Active', delta: 'Badges' },
        { label: 'Next VIP', value: '14:00', delta: 'KCB Team' },
        { label: 'Parking Bays', value: '4 Free', delta: 'Lot A/B' },
      ],
      chartBars: [0.4, 0.7, 0.85, 0.65, 0.5, 0.35],
      chartLabels: ['8am', '10am', '12pm', '2pm', '4pm', '5pm'],
      visualHeadline: 'NFC Visitor Badge #18 · Savanna Foods -> Escorted to L3',
      visualSubline: 'Turnstile Access: Ground + L3 E-Commerce · Parking Bay 3 Validated',
      visualItems: [
        { title: 'Wanjiru K. (Badge #14)', meta: 'Consultancy L1 · Arrived 09:30', status: 'On-Site' },
        { title: 'Savanna Foods (2)', meta: 'E-Commerce L3 · Brian notified', status: 'Checked In' },
        { title: 'KCB Innovation Team', meta: 'CEO Suite L5 · 14:00 VIP', status: 'Expected' },
      ],
    },
  },

  // Reception Desk 1 (Concierge)
  'reception-1': {
    stationKey: 'reception-1',
    projectTitle: 'Guest Escort & Courier Dispatch Portal',
    clientName: 'Front Desk Concierge',
    primaryMode: 'browser',
    browserSessions: [
      {
        tabTitle: 'Meeting Pod & Escort Queue',
        url: 'https://intranet.domaintechhub.co.ke/concierge/arrivals',
        searchQuery: 'savanna foods lobby arrival lift dispatch brian e-commerce',
        articleTitle: 'Concierge Dispatch & Lobby Arrival Protocol',
        articleDomain: 'intranet.domaintechhub.co.ke',
        sections: [
          {
            heading: 'Active Arrival Queue',
            excerpt: 'Notified Brian (E-Commerce) via #front-desk-arrivals; lift cab #1 queued to Ground for Savanna Foods briefing.',
            highlight: 'Express coffee bar & cold water trays staged in Lounge B.',
          },
        ],
        researchNote: 'Confirmed parking validation & lift priority for afternoon partner demo.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Courier & Pod Dispatch Log',
      columns: ['Item / Guest', 'Destination', 'Courier / Host', 'Status'],
      initialRows: [
        ['DHL Parcel #4092', 'Finance (L5)', 'Amina · Finance', '▲ Delivered'],
        ['Savanna Guests', 'Meeting Pod B', 'Brian · E-Comm', '▲ Escorted'],
        ['Signed NDA Pack', 'Board Sec (L4)', 'Grace · Legal', '▲ Logged'],
      ],
      incomingQueue: [
        ['Fibre Router Spare', 'Server Hall (B1)', 'Security + SRE', '▲ Dispatched'],
        ['Catering Coffee Tray', 'Board Room (L4)', 'Executive Lounge', '▲ Staged'],
      ],
    },
    projectWork: {
      fileName: 'dispatch/front-desk-arrivals.log',
      language: 'Live Feed',
      accent: '#71e0a4',
      codeLines: [
        '[09:32] Wanjiru K. -> Escorted to L1 Consultancy Bay',
        '[10:04] Peter O. -> Escorted to L3 Web Development',
        '[11:16] Savanna Foods -> Brian notified, Visitor Bay 3 assigned',
      ],
      terminalOutput: 'Slack #front-desk-arrivals connected · 0 guests waiting > 2 min',
      deliverables: [
        { label: 'Lobby arrival notifications active', done: true },
        { label: 'Parcel & NDA intake signed', done: true },
      ],
    },
    jobApp: {
      appType: 'executive',
      appTabLabel: 'Lobby Dispatch',
      appName: 'Concierge Room & Courier Dispatch Console',
      kpis: [
        { label: 'Wait Time', value: '< 90s', delta: 'Avg' },
        { label: 'Meeting Pods', value: '2 Free', delta: 'Pod A/C' },
        { label: 'Parcels Signed', value: '11', delta: 'Today' },
      ],
      chartBars: [0.6, 0.8, 0.9, 0.75, 0.65, 0.45],
      chartLabels: ['Pod A', 'Pod B', 'Board', 'Lounge', 'Lifts', 'Bay'],
      visualHeadline: '#front-desk-arrivals · Notified Brian (E-Commerce) for Lobby',
      visualSubline: 'Courier DHL #4092 signed & routed to Level 5 Finance',
      visualItems: [
        { title: 'Meeting Pod B', meta: 'Savanna Foods · 11:15–12:30', status: 'Occupied' },
        { title: 'Board Room (L4)', meta: 'Prep complete · Coffee staged', status: 'Ready' },
        { title: 'Lift Priority #1', meta: 'Queued for Ground VIPs', status: 'Standby' },
      ],
    },
  },

  // Board Secretary / PA (L4 & L5)
  pa: {
    stationKey: 'pa',
    projectTitle: 'Q4 Board Secretariat & Executive Calendar',
    clientName: 'Board & Executive Office',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'Kenya Companies Act · Board Resolution Pack',
        url: 'https://brs.go.ke/resources/company-resolutions-templates',
        searchQuery: 'kenya companies act special board resolution minute signing rules',
        articleTitle: 'Statutory Requirements for Quarterly Board Resolutions',
        articleDomain: 'brs.go.ke',
        sections: [
          {
            heading: 'Quorum & E-Signature Attestation',
            excerpt: 'Circulate board pack 7 days prior and archive signed PDF minutes alongside attendance roll & conflict-of-interest declarations.',
            highlight: 'Board Resolution #2026-Q4-03 ready for chair & secretary attestation.',
          },
        ],
        researchNote: 'Compiled 24-page Q4 Board Pack with audited finance & SLA appendices.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Executive Schedule & Resolution Register',
      columns: ['Item / Meeting', 'Day & Time', 'Participants', 'Status'],
      initialRows: [
        ['Q4 Budget Review', 'Mon 10:00', 'CEO + CFO + Ops', '▲ Minutes Filed'],
        ['KCB Partner Sync', 'Tue 14:00', 'CEO + Tech Head', '▲ Deck Ready'],
        ['Heads Alignment', 'Thu 09:00', 'All 4 Dept Heads', 'Confirmed'],
        ['Board Meeting Q4', 'Fri 10:30', 'Board of Directors', 'Pack Sent'],
      ],
      incomingQueue: [
        ['ISO-27001 Sign-Off', 'Mon 15:00', 'Consultancy + Sec', 'Scheduled'],
        ['Investor Briefing', 'Wed 11:00', 'CEO + Board Chair', 'Brief Ready'],
      ],
    },
    projectWork: {
      fileName: 'secretariat/Q4-Board-Agenda.md',
      language: 'Markdown',
      accent: '#c9a45a',
      codeLines: [
        '# DomainTechHub Office · Q4 Board Meeting Agenda',
        '1. FY26 Revenue & 96% Client Retention Review (Head of Finance)',
        '2. Managed Cloud SLA & B1 Server Expansion (Head of Tech)',
        '3. Pan-African Enterprise Pipeline Approval (CEO)',
      ],
      terminalOutput: 'Board portal encrypted PDF compiled · 7/7 directors confirmed attendance',
      deliverables: [
        { label: 'Board pack distributed to all directors', done: true },
        { label: 'CEO weekly briefing notes finalized', done: true },
        { label: 'Archive signed attendance roll', done: false },
      ],
    },
    jobApp: {
      appType: 'executive',
      appTabLabel: 'Board Portal',
      appName: 'Executive Secretariat & Board Pack Suite',
      kpis: [
        { label: 'Board Pack', value: '24 pgs', delta: '7/7 Sent' },
        { label: 'Resolutions', value: '3 Ready', delta: 'Q4 Sign' },
        { label: 'Action Items', value: '92% Done', delta: 'Tracked' },
      ],
      chartBars: [0.85, 0.9, 1.0, 0.78, 0.95, 1.0],
      chartLabels: ['Min', 'Fin', 'SLA', 'Risk', 'Pack', 'Quorum'],
      visualHeadline: 'Board Resolution #2026-Q4-03 · Cloud Expansion & Q1 Budget',
      visualSubline: 'Friday 10:30 EAT · Level 4 Board Room · 7/7 Directors Confirmed',
      visualItems: [
        { title: 'Q4 Audit Appendices', meta: 'Signed by Head of Finance', status: 'Filed' },
        { title: 'KCB Partner Brief', meta: 'CEO briefing Tue 14:00', status: 'Ready' },
        { title: 'Attendance Roll', meta: 'Digital signatures queued', status: 'Pending' },
      ],
    },
  },

  // Heads of Department (Level 5)
  tech: {
    stationKey: 'tech',
    projectTitle: 'Engineering Velocity & Cloud Architecture',
    clientName: 'Technology Directorate',
    primaryMode: 'project',
    browserSessions: [
      {
        tabTitle: 'Kubernetes Cluster Autoscaler Cost Study',
        url: 'https://kubernetes.io/docs/concepts/cluster-administration/node-autoscaling/',
        searchQuery: 'karpenter spot node consolidation multi tenant workload cost reduction',
        articleTitle: 'Right-Sizing Production Node Pools Without Tail-Latency Spikes',
        articleDomain: 'kubernetes.io/docs',
        sections: [
          {
            heading: 'Pod Disruption Budgets',
            excerpt: 'Set minAvailable: 80% on Daraja payment pods before enabling automated node bin-packing.',
            highlight: 'Projected monthly AWS/GCP spend savings: 28% (~KES 340k/mo).',
          },
        ],
        researchNote: 'Approving Wave 2 cluster consolidation PR after staging load test.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Engineering Sprint & SLA Ledger',
      columns: ['Team Bay', 'Active PRs', 'Deploy Rate', 'SLA'],
      initialRows: [
        ['Web Development', '14 merged', '4.2 / day', '▲ 99.98%'],
        ['Mobile Apps', '9 merged', '2.1 / day', '▲ 99.95%'],
        ['AI Solutions', '11 merged', '3.0 / day', '▲ 99.92%'],
        ['Custom CRM', '8 merged', '2.4 / day', '▲ 99.97%'],
      ],
      incomingQueue: [
        ['Front-End UI', '16 merged', '5.1 / day', '▲ 99.99%'],
        ['Security & SRE', '7 patched', 'Daily audit', '▲ 100.0%'],
      ],
    },
    projectWork: {
      fileName: 'roadmap/Q4-Architecture-Review.md',
      language: 'Architecture Spec',
      accent: '#34598f',
      codeLines: [
        '## Engineering OKRs · Q4',
        '- Zero-downtime schema migrations across all 14 client SaaS tenants',
        '- Sub-200ms p95 API latency on Daraja + MatatuPay edge gateways',
        '- 100% automated S3 backup restore verification in B1 NOC',
      ],
      terminalOutput: 'GitHub Org Health: 58 PRs merged this week · 0 P1 production incidents',
      deliverables: [
        { label: 'Q4 Kubernetes cost optimization approval', done: true },
        { label: 'B1 Server Room capacity upgrade sign-off', done: true },
      ],
    },
    jobApp: {
      appType: 'security',
      appTabLabel: 'Eng Telemetry',
      appName: 'Technology Directorate · GitHub & Cloud Ops',
      kpis: [
        { label: 'Weekly PRs', value: '58 Merged', delta: '0 P1s' },
        { label: 'Cloud Cost', value: '-28%', delta: 'Karpenter' },
        { label: 'Fleet SLA', value: '99.97%', delta: 'All Bays' },
      ],
      chartBars: [0.75, 0.82, 0.88, 0.91, 0.95, 0.98],
      chartLabels: ['Web', 'Front', 'Mob', 'AI', 'CRM', 'SRE'],
      visualHeadline: 'Architecture Review: Zero-Downtime Multi-Tenant Migrations',
      visualSubline: '58 PRs merged across 6 engineering bays · B1 NOC at 64% load',
      visualItems: [
        { title: 'Daraja Edge Gateway', meta: '41ms p99 · High Load OK', status: 'Approved' },
        { title: 'B1 Rack Expansion', meta: '42 active nodes healthy', status: 'Signed' },
        { title: 'Q1 Voice AI Spec', meta: 'Swahili ASR latency <300ms', status: 'In Review' },
      ],
    },
  },

  mkt_head: {
    stationKey: 'mkt_head',
    projectTitle: 'Agency Growth & Multi-Channel ROAS Portfolio',
    clientName: 'Marketing Directorate',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'East Africa Digital Ad Spend Benchmark 2026',
        url: 'https://www.thinkwithgoogle.com/intl/en-africa/',
        searchQuery: 'east africa b2b saas cpc benchmarks search vs linkedin 2026',
        articleTitle: 'Digital Customer Acquisition Benchmarks in East Africa',
        articleDomain: 'thinkwithgoogle.com',
        sections: [
          {
            heading: 'WhatsApp Conversational Retargeting',
            excerpt: 'Combining Search Ads with direct-to-WhatsApp landing flows cuts B2B inquiry response time under 90 seconds.',
            highlight: 'Cross-sell WhatsApp Bot packages to 9 active Digital Marketing retainers.',
          },
        ],
        researchNote: 'Reallocating 15% Q4 spend toward Search + WhatsApp conversion pairs.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Department Retainer & ROAS Portfolio',
      columns: ['Client Portfolio', 'Budget / mo', 'Blended ROAS', 'Status'],
      initialRows: [
        ['SEO Retainers (8)', 'KES 1.2M', '▲ 5.4×', 'On Track'],
        ['PPC Freight & B2B', 'KES 1.8M', '▲ 4.7×', 'On Track'],
        ['Social & Creators', 'KES 950k', '▲ 3.9×', 'Scaling'],
        ['WhatsApp Commerce', 'KES 780k', '▲ 6.2×', 'Top Tier'],
      ],
      incomingQueue: [
        ['Pwani Luxury Q4', 'KES 620k', '▲ 4.9×', 'On Track'],
        ['Kilimani Dental', 'KES 410k', '▲ 5.8×', 'Expanding'],
      ],
    },
    projectWork: {
      fileName: 'strategy/Q4-Media-Allocation.csv',
      language: 'Strategy Sheet',
      accent: '#7a2f5a',
      codeLines: [
        'Channel,BudgetShare,TargetROAS,LeadSLA',
        'Google_Search_PPC,38%,4.8x,<15min',
        'SEO_Organic_Content,24%,6.0x,Inbound',
        'WhatsApp_Automation,22%,5.9x,<2min',
      ],
      terminalOutput: 'Marketing Portfolio: 42 active campaigns · Client retention 96.4%',
      deliverables: [
        { label: 'Q4 agency media mix budget sign-off', done: true },
        { label: 'New B2B enterprise case study launch', done: false },
      ],
    },
    jobApp: {
      appType: 'marketing',
      appTabLabel: 'Growth Portfolio',
      appName: 'Marketing Directorate · Retainer & ROAS Suite',
      kpis: [
        { label: 'Active Campaigns', value: '42 Live', delta: '96% Ret.' },
        { label: 'Blended ROAS', value: '5.1×', delta: '+0.8×' },
        { label: 'Monthly Media', value: 'KES 4.7M', delta: 'On Plan' },
      ],
      chartBars: [0.64, 0.72, 0.81, 0.89, 0.92, 0.96],
      chartLabels: ['SEO', 'PPC', 'Soc', 'WA', 'Email', 'B2B'],
      visualHeadline: 'Q4 Agency Growth Mix · Search + WhatsApp Retargeting Pairs',
      visualSubline: 'Cross-sell pipeline +9 accounts · B2B response SLA < 90 seconds',
      visualItems: [
        { title: 'WhatsApp Commerce', meta: '6.2× ROAS · Highest Margin', status: 'Scaling' },
        { title: 'SEO Retainer Book', meta: '5.4× ROAS · 8 active', status: 'On Track' },
        { title: 'Enterprise Case Study', meta: 'Savanna & Rift Logistics', status: 'Editing' },
      ],
    },
  },

  fin: {
    stationKey: 'fin',
    projectTitle: 'Monthly P&L, KRA eTIMS & Cashflow Ledger',
    clientName: 'Finance Directorate',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'KRA eTIMS API Invoice Validation',
        url: 'https://www.kra.go.ke/etims',
        searchQuery: 'kra etims osccu api automatic sales invoice qr signing',
        articleTitle: 'Automated eTIMS Tax Invoice Signing for SaaS Retainers',
        articleDomain: 'kra.go.ke/etims',
        sections: [
          {
            heading: 'Automated Credit Notes & VAT Returns',
            excerpt: 'Sync monthly retainer invoices via eTIMS Virtual Sales Control Unit (VSCU) to eliminate manual CSV uploads.',
            highlight: '100% of October client invoices digitally stamped & VAT reconciled.',
          },
        ],
        researchNote: 'Completed monthly VAT reconciliation ahead of 20th statutory filing.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Corporate Invoice & Retainer Reconciliation',
      columns: ['Client Account', 'Invoice', 'Amount (KES)', 'Status'],
      initialRows: [
        ['Safaricom Ent.', 'INV-2041', 'KES 1,450,000', '▲ Paid'],
        ['Nairobi Hospital', 'INV-2042', 'KES 980,000', '▲ Paid'],
        ['Apex Brokers', 'INV-2043', 'KES 760,000', '▲ eTIMS OK'],
        ['Savanna Roasters', 'INV-2044', 'KES 540,000', 'Due Fri'],
      ],
      incomingQueue: [
        ['Rift Cargo Ltd', 'INV-2045', 'KES 485,000', '▲ Paid'],
        ['East Africa Law', 'INV-2046', 'KES 620,000', '▲ eTIMS OK'],
        ['QuickMart Retail', 'INV-2047', 'KES 890,000', '▲ Paid'],
      ],
    },
    projectWork: {
      fileName: 'finance/Q4-Cashflow-Forecast.ts',
      language: 'Ledger Model',
      accent: '#2d7a5a',
      codeLines: [
        'const Q4_FORECAST = {',
        '  recurringRetainersKes: 8_420_000,',
        '  projectMilestonesKes: 5_180_000,',
        '  operatingMarginPct: 31.4,',
        '  runwayMonths: 24,',
        '};',
      ],
      terminalOutput: 'KRA eTIMS sync clean · Payroll & statutory deductions verified',
      deliverables: [
        { label: 'Monthly client retainer billing cycle', done: true },
        { label: 'Board Q4 financial variance report', done: true },
      ],
    },
    jobApp: {
      appType: 'executive',
      appTabLabel: 'Finance & eTIMS',
      appName: 'KRA eTIMS & Corporate P&L Accounting',
      kpis: [
        { label: 'MRR Retainers', value: 'KES 8.42M', delta: '+18%' },
        { label: 'Op Margin', value: '31.4%', delta: '+2.1pt' },
        { label: 'eTIMS VAT', value: '100% Sync', delta: 'Filed' },
      ],
      chartBars: [0.58, 0.66, 0.73, 0.81, 0.89, 0.96],
      chartLabels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
      visualHeadline: 'KRA eTIMS VSCU · All October Retainer Invoices Digitally Stamped',
      visualSubline: 'Cash runway: 24 months · Payroll & statutory deductions cleared',
      visualItems: [
        { title: 'INV-2041 Safaricom', meta: 'KES 1,450,000 settled', status: 'Paid' },
        { title: 'INV-2042 Nairobi Hosp', meta: 'KES 980,000 settled', status: 'Paid' },
        { title: 'Board Variance Pack', meta: 'Q4 cashflow forecast ready', status: 'Signed' },
      ],
    },
  },

  ops: {
    stationKey: 'ops',
    projectTitle: '14-Bay Resource Allocation & Delivery SLA',
    clientName: 'Operations Directorate',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'Solar Microgrid & Facility Telemetry',
        url: 'https://intranet.domaintechhub.co.ke/b2/power-telemetry',
        searchQuery: 'domaintechhub solar pv inverter b2 battery autonomy load',
        articleTitle: 'Building Facility Autonomy: Roof PV + B2 Inverter Bank',
        articleDomain: 'intranet.domaintechhub.co.ke',
        sections: [
          {
            heading: 'Zero Grid Dependency During Peak Work Hours',
            excerpt: '80-panel solar array feeds 18.4 kW to workstations & B1 Server Room UPS with 98% inverter conversion efficiency.',
            highlight: 'Grid draw: 0 kW between 08:15 and 17:45 EAT.',
          },
        ],
        researchNote: 'Facility HVAC & solar load balanced at 98% efficiency across all 6 floors.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Cross-Department Capacity & Delivery SLA',
      columns: ['Floor / Bay', 'Projects', 'Utilization', 'On-Time'],
      initialRows: [
        ['L3 Engineering (4)', '15 active', '86%', '▲ 96%'],
        ['L2 Growth & Ads (4)', '18 active', '84%', '▲ 95%'],
        ['L1 CRM / AI / Soc (4)', '14 active', '88%', '▲ 97%'],
        ['G Mobile & Sec (2)', '9 active', '82%', '▲ 99%'],
      ],
      incomingQueue: [
        ['B1 Server NOC', '42 nodes', '64% load', '▲ 100%'],
        ['B2 Solar Plant', '18.4 kW', '98% eff.', '▲ Nominal'],
      ],
    },
    projectWork: {
      fileName: 'ops/bay-capacity-roster.json',
      language: 'Operations',
      accent: '#c9762e',
      codeLines: [
        '{ "building": "DomainTechHub Office", "activeBays": 14,',
        '  "staffOnSite": 47, "avgDeliverySla": "96.4%",',
        '  "nextNewHireOnboarding": "Monday 09:00 · Front-End Bay" }',
      ],
      terminalOutput: 'All 14 bays staffed · Solar grid self-sufficiency 100% today',
      deliverables: [
        { label: 'Weekly sprint capacity rebalancing', done: true },
        { label: 'B1/B2 preventative maintenance checklist', done: true },
      ],
    },
    jobApp: {
      appType: 'security',
      appTabLabel: 'Building & SLA',
      appName: 'Operations Directorate · Capacity & Power Telemetry',
      kpis: [
        { label: 'Delivery SLA', value: '96.4%', delta: '14 Bays' },
        { label: 'Solar Output', value: '18.4 kW', delta: '0 Grid' },
        { label: 'Staff On-Site', value: '47', delta: '85% Util' },
      ],
      chartBars: [0.86, 0.84, 0.88, 0.82, 0.96, 0.98],
      chartLabels: ['L3', 'L2', 'L1', 'G', 'B1', 'Solar'],
      visualHeadline: 'Facility Microgrid: 100% Solar Autonomy Across All 6 Floors',
      visualSubline: 'B2 Inverter efficiency 98% · All 14 service bays meeting sprint SLAs',
      visualItems: [
        { title: 'L3 Engineering Bays', meta: '15 projects · 96% on-time', status: 'Optimal' },
        { title: 'L2 Growth Bays', meta: '18 campaigns · 84% load', status: 'Optimal' },
        { title: 'B2 Solar Inverters', meta: '18.4 kW PV · Grid 0 kW', status: 'Nominal' },
      ],
    },
  },

  // CEO Suite (Level 5)
  'ceo-0': {
    stationKey: 'ceo-0',
    projectTitle: 'Company Executive P&L & Strategic Accounts',
    clientName: 'Chief Executive Officer',
    primaryMode: 'dataEntry',
    browserSessions: [
      {
        tabTitle: 'East Africa Enterprise Cloud Report 2026',
        url: 'https://www.gsma.com/africa/enterprise-digital-transformation',
        searchQuery: 'kenya enterprise cloud ai fintech adoption forecast 2026',
        articleTitle: 'Enterprise Digital Transformation & Managed Cloud Outlook',
        articleDomain: 'gsma.com/africa',
        sections: [
          {
            heading: 'Fastest Growing Verticals',
            excerpt: 'B2B Fintech infrastructure, healthcare portals, and WhatsApp commerce show 42% YoY enterprise budget expansion across East Africa.',
            highlight: 'Prioritize AI RAG + Custom CRM bundled retainers for Q1 expansion.',
          },
        ],
        researchNote: 'Preparing Q1 market expansion pitch for regional banking partners.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Executive Portfolio & Revenue Dashboard',
      columns: ['Division', 'Projects', 'On Track', 'Monthly Rev'],
      initialRows: [
        ['Web & Cloud Eng.', '12', '▲ 11', 'KES 2.45M'],
        ['Mobile & AI Sol.', '7', '▲ 7', 'KES 1.88M'],
        ['Growth & SEO/PPC', '18', '▲ 17', 'KES 1.64M'],
        ['Consultancy & CRM', '6', '▲ 6', 'KES 1.42M'],
      ],
      incomingQueue: [
        ['Managed Security', '84 sites', '▲ 84', 'KES 960k'],
        ['WhatsApp Comm.', '9 bots', '▲ 9', 'KES 740k'],
      ],
    },
    projectWork: {
      fileName: 'executive/Q4-Board-Keynote.md',
      language: 'Executive Brief',
      accent: '#c9a45a',
      codeLines: [
        '# DomainTechHub Office · Executive Quarter Summary',
        '- Revenue growth: +18% QoQ | Client retention: 96%',
        '- 56 active client engagements across East Africa',
        '- Strategic goal Q1: Launch Swahili Enterprise Voice AI suite',
      ],
      terminalOutput: 'Live Board Feed Synced · 96% client retention · +18% QoQ growth',
      deliverables: [
        { label: 'Board Q4 strategy keynote deck', done: true },
        { label: 'KCB & Safaricom partner MOU review', done: true },
        { label: 'Q1 headcount expansion budget sign-off', done: false },
      ],
    },
    jobApp: {
      appType: 'executive',
      appTabLabel: 'CEO Cockpit',
      appName: 'Chief Executive Strategic Portfolio Cockpit',
      kpis: [
        { label: 'QoQ Revenue', value: '+18%', delta: 'KES 9.1M' },
        { label: 'Client Retention', value: '96%', delta: '56 Proj' },
        { label: 'Enterprise Pipe', value: 'KES 29M', delta: 'Q1 Ready' },
      ],
      chartBars: [0.55, 0.64, 0.72, 0.81, 0.9, 0.98],
      chartLabels: ['Q1', 'Q2', 'Q3', 'Q4e', 'Ret', 'Net'],
      visualHeadline: 'DomainTechHub Office · Quarterly Executive Portfolio Review',
      visualSubline: '56 active client engagements · Regional expansion into Kampala & Kigali',
      visualItems: [
        { title: 'Web & Cloud Eng.', meta: '12 projects · KES 2.45M/mo', status: 'On Track' },
        { title: 'KCB Innovation MOU', meta: 'KES 6.4M B2B API Portal', status: 'Signing' },
        { title: 'Q1 Voice AI Suite', meta: 'Swahili enterprise launch', status: 'Approved' },
      ],
    },
  },

  'ceo-1': {
    stationKey: 'ceo-1',
    projectTitle: 'Partner Briefings & Regional Expansion Research',
    clientName: 'CEO Strategy & Partnerships',
    primaryMode: 'browser',
    browserSessions: [
      {
        tabTitle: 'African Continental Free Trade Tech Report',
        url: 'https://au-afcfta.org/digital-trade-protocol',
        searchQuery: 'afcfta digital trade protocol cross border saas payments east africa',
        articleTitle: 'AfCFTA Digital Trade Protocol: Cross-Border SaaS Rules',
        articleDomain: 'au-afcfta.org',
        sections: [
          {
            heading: 'Cross-Border Payment & Data Flows',
            excerpt: 'Harmonized digital identity & cross-border merchant APIs open direct enterprise delivery across Kenya, Uganda, Tanzania, and Rwanda.',
            highlight: 'Position DomainTechHub Consultancy as regional ISO-27001 readiness partner.',
          },
        ],
        researchNote: 'Added Kigali & Kampala partner outreach milestones to Q1 roadmap.',
      },
    ],
    dataEntry: {
      sheetTitle: 'Strategic Partnership & VIP Pipeline',
      columns: ['Partner / Client', 'Scope', 'Stage', 'Est. Value'],
      initialRows: [
        ['KCB Innovation Lab', 'B2B API Portal', '▲ MOU Review', 'KES 6.4M'],
        ['Safaricom Ent.', 'Merchant Scale', '▲ Live Phase 2', 'KES 8.2M'],
        ['EAC Trade Desk', 'Legal Directory', '▲ Signed', 'KES 4.1M'],
      ],
      incomingQueue: [
        ['Rwanda FinHub', 'CRM + Compliance', 'Proposal Sent', 'KES 5.5M'],
        ['Mombasa Port Logistics', 'Fleet AI Ops', 'Discovery', 'KES 4.8M'],
      ],
    },
    projectWork: {
      fileName: 'executive/Partner-Schedule-Week.md',
      language: 'Agenda',
      accent: '#c9a45a',
      codeLines: [
        'Tue 14:00 · KCB Innovation Lab Technical Briefing (Board Room)',
        'Wed 11:00 · Investor & Expansion Strategy Call',
        'Fri 10:30 · Full Q4 Board Review & Sign-Off',
      ],
      terminalOutput: 'Executive briefing dossiers synced with Board Secretary (L4)',
      deliverables: [
        { label: 'AfCFTA cross-border legal & fintech brief', done: true },
        { label: 'Friday Board Meeting opening remarks', done: false },
      ],
    },
    jobApp: {
      appType: 'executive',
      appTabLabel: 'Partner Desk',
      appName: 'CEO Partnerships & Regional Strategy Brief',
      kpis: [
        { label: 'Active MOUs', value: '4 Tiers', delta: 'KES 24M' },
        { label: 'Board Sync', value: 'Fri 10:30', delta: 'L4 Room' },
        { label: 'EAC Markets', value: 'KE·UG·RW', delta: 'Active' },
      ],
      chartBars: [0.65, 0.78, 0.84, 0.9, 0.94, 0.98],
      chartLabels: ['KCB', 'Saf', 'EAC', 'Rwanda', 'Port', 'Q1'],
      visualHeadline: 'AfCFTA Cross-Border SaaS Expansion & Partner Deal Desk',
      visualSubline: 'Tue 14:00 KCB Technical Briefing · Fri 10:30 Quarterly Board Review',
      visualItems: [
        { title: 'KCB Innovation Lab', meta: 'B2B API Portal · KES 6.4M', status: 'MOU Review' },
        { title: 'Rwanda FinHub', meta: 'CRM + ISO Compliance Pitch', status: 'Proposal' },
        { title: 'Board Opening Brief', meta: 'Strategic milestones deck', status: 'In Edit' },
      ],
    },
  },
};

export function getWorkstationProfile(stationKey: string): WorkstationProfile {
  return PROFILES[stationKey] || DISTRICT_WORKSTATIONS[stationKey] || PROFILES.web;
}

export function getModeForDesk(stationKey: string, seatIndex: number): WorkstationMode {
  if (DISTRICT_WORKSTATIONS[stationKey]) return DISTRICT_WORKSTATIONS[stationKey].primaryMode;
  if (stationKey === 'reception-0') return 'dataEntry';
  if (stationKey === 'reception-1') return 'project';
  if (stationKey === 'ceo-0') return 'project';
  if (stationKey === 'ceo-1') return 'browser';
  if (stationKey === 'pa' || stationKey === 'fin') return 'dataEntry';
  if (stationKey === 'tech' || stationKey === 'mkt_head' || stationKey === 'ops') return 'project';

  // Department 3-desk bays:
  // Seat 0 = Browser & Web Research
  // Seat 1 = Job-Specific Real-Life Tool (IDE, UI Studio, Search Console, Ads, Social Studio, NOC)
  // Seat 2 = Live Data Entry (Records / Sheets / Metrics / QA)
  if (seatIndex === 0) return 'browser';
  if (seatIndex === 2) return 'dataEntry';
  return 'project';
}
