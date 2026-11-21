import * as THREE from 'three';
import { ROOMS, type RoomDef, type WorkScreenRef } from './constants';
import { getMaxAnisotropy, circ, rr } from './textures';
import {
  getModeForDesk,
  getWorkstationProfile,
  type BrowserSession,
  type DataEntrySpec,
  type WorkstationProfile,
} from './workstations';

const WS_LOGICAL_W = 384;
const WS_LOGICAL_H = 216;
const WS_SCALE = 2;
const WS_W = WS_LOGICAL_W * WS_SCALE;
const WS_H = WS_LOGICAL_H * WS_SCALE;
const WS_MONO = 'ui-monospace,Menlo,Consolas,"Courier New",monospace';
const WS_SANS = '"Plus Jakarta Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif';

const hr = (n: number) => Math.abs((Math.sin(n * 12.9898) * 43758.5453) % 1);
const wsTyped = (s: string, t: number, cps: number) => s.slice(0, Math.max(0, Math.min(s.length, Math.floor(t * cps))));
const wsEase = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : 1 - Math.pow(1 - x, 3));

function wsWrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let cur = '';
  words.forEach((w) => {
    const tryS = cur ? `${cur} ${w}` : w;
    if (g.measureText(tryS).width > maxW && cur) {
      out.push(cur);
      cur = w;
    } else cur = tryS;
  });
  if (cur) out.push(cur);
  return out;
}

export interface WallTVRef {
  d: RoomDef;
  idx: number;
  g: CanvasRenderingContext2D;
  tx: THREE.CanvasTexture;
  mat: THREE.MeshStandardMaterial;
  logo: HTMLCanvasElement;
  mesh: THREE.Mesh | null;
  data: { build: string[]; proj: Array<[string, number, string]>; news: string[] };
  accent: string;
}

export interface ScreenRegistry {
  wallTVs: WallTVRef[];
  workScreens: WorkScreenRef[];
  boardScreens: Array<{ g: CanvasRenderingContext2D; tx: THREE.CanvasTexture; mat: THREE.MeshStandardMaterial; w: number; h: number; mesh?: THREE.Mesh; fn: (g: CanvasRenderingContext2D, w: number, h: number, t: number) => void }>;
}

export function createScreenRegistry(): ScreenRegistry {
  return {
    wallTVs: [],
    workScreens: [],
    boardScreens: [],
  };
}

const LW = 768;
const LHc = 384;
const CX = LW / 2;
const CY = LHc / 2;

const LOGO: Record<string, (g: CanvasRenderingContext2D) => void> = {
  web(g) {
    g.fillStyle = '#0a1018';
    rr(g, 120, 72, 528, 240, 14);
    g.fill();
    g.strokeStyle = 'rgba(120,180,255,.35)';
    g.lineWidth = 2;
    rr(g, 120, 72, 528, 240, 14);
    g.stroke();
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      g.fillStyle = c;
      circ(g, 150 + i * 22, 96, 5);
    });
    const cols = ['#7ee787', '#79c0ff', '#ffa657', '#d2a8ff', '#a5d6ff', '#7ee787', '#ffa657'];
    for (let k = 0; k < 8; k++) {
      const indent = k % 4 === 3 ? 120 : (k % 3) * 26;
      g.fillStyle = cols[k % cols.length];
      g.globalAlpha = 0.92;
      rr(g, 150 + indent, 124 + k * 21, 150 + ((k * 97) % 190), 8, 4);
      g.fill();
    }
    g.globalAlpha = 0.5;
    g.fillStyle = '#79c0ff';
    rr(g, 560, 124, 52, 180, 8);
    g.fill();
    g.globalAlpha = 1;
  },
  front(g) {
    g.fillStyle = '#0d0f16';
    rr(g, 120, 72, 528, 240, 14);
    g.fill();
    const blobs: Array<[string, number, number, number]> = [
      ['#4facfe', 250, 160, 130],
      ['#f857a6', 500, 150, 110],
      ['#ffb75e', 380, 260, 90],
      ['#7f5cff', 300, 250, 80],
    ];
    g.globalCompositeOperation = 'lighter';
    blobs.forEach((b) => {
      const r = g.createRadialGradient(b[1], b[2], 0, b[1], b[2], b[3]);
      r.addColorStop(0, b[0]);
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r;
      g.fillRect(b[1] - b[3], b[2] - b[3], b[3] * 2, b[3] * 2);
    });
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(255,255,255,.85)';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(300, 200);
    g.bezierCurveTo(380, 120, 470, 270, 560, 170);
    g.stroke();
    g.lineCap = 'butt';
  },
  cart(g) {
    g.strokeStyle = '#fff';
    g.lineWidth = 13;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(232, 128);
    g.lineTo(278, 128);
    g.lineTo(322, 268);
    g.lineTo(530, 268);
    g.lineTo(566, 176);
    g.lineTo(268, 176);
    g.stroke();
    [
      [350, 306],
      [500, 306],
    ].forEach((p) => {
      g.fillStyle = '#fff';
      circ(g, p[0], p[1], 17);
    });
    g.lineCap = 'butt';
  },
  wp(g) {
    g.strokeStyle = '#fff';
    g.lineWidth = 11;
    g.beginPath();
    g.arc(CX, CY, 124, 0, 7);
    g.stroke();
    g.fillStyle = '#fff';
    g.font = '700 150px Georgia,"Times New Roman",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('W', CX, CY + 6);
  },
  seo(g) {
    g.fillStyle = '#fff';
    [
      [300, 120],
      [352, 86],
      [404, 150],
      [456, 64],
    ].forEach((b) => {
      rr(g, b[0], 268 - b[1], 42, b[1], 7);
      g.fill();
    });
    g.strokeStyle = '#fff';
    g.lineWidth = 12;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(300, 196);
    g.lineTo(372, 140);
    g.lineTo(438, 168);
    g.lineTo(512, 86);
    g.stroke();
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(524, 72);
    g.lineTo(478, 80);
    g.lineTo(510, 118);
    g.closePath();
    g.fill();
    g.lineCap = 'butt';
  },
  mkt(g) {
    g.fillStyle = '#fff';
    rr(g, 116, 86, 536, 212, 16);
    g.fill();
    g.fillStyle = '#4285f4';
    g.beginPath();
    g.moveTo(220, 192);
    g.arc(220, 192, 62, -Math.PI / 2, Math.PI * 0.9);
    g.closePath();
    g.fill();
    g.fillStyle = '#fbbc05';
    g.beginPath();
    g.moveTo(220, 192);
    g.arc(220, 192, 62, Math.PI * 0.9, Math.PI * 1.5);
    g.closePath();
    g.fill();
    g.fillStyle = '#34a853';
    [
      [300, 236, 34],
      [348, 206, 64],
      [396, 222, 48],
      [444, 176, 94],
      [492, 196, 74],
      [540, 150, 120],
    ].forEach((b) => rr(g, b[0], b[1], 26, b[2], 5));
    g.fill();
  },
  ppc(g) {
    g.save();
    g.translate(CX, CY);
    g.fillStyle = '#fbbc05';
    g.beginPath();
    g.moveTo(-96, 86);
    g.lineTo(-26, 44);
    g.lineTo(-26, 86);
    g.closePath();
    g.fill();
    g.fillStyle = '#4285f4';
    g.beginPath();
    g.moveTo(-14, 36);
    g.lineTo(-14, -84);
    g.lineTo(80, -26);
    g.closePath();
    g.fill();
    g.fillStyle = '#34a853';
    g.beginPath();
    g.moveTo(-14, 50);
    g.lineTo(80, -8);
    g.lineTo(-14, 106);
    g.closePath();
    g.fill();
    g.restore();
  },
  wa(g) {
    g.strokeStyle = '#fff';
    g.lineWidth = 13;
    g.lineJoin = 'round';
    g.beginPath();
    g.arc(CX, CY - 6, 110, Math.PI * 0.72, Math.PI * 2.18);
    g.stroke();
    g.beginPath();
    g.moveTo(196, 246);
    g.lineTo(168, 306);
    g.lineTo(238, 278);
    g.stroke();
  },
  social(g) {
    const items: Array<[string, string]> = [
      ['#1877f2', 'f'],
      ['#d6249f', '◎'],
      ['#ff0000', '▶'],
      ['#0f0f0f', 'X'],
    ];
    items.forEach((it, k) => {
      const x = 214 + k * 118;
      g.fillStyle = it[0];
      circ(g, x, CY, 52);
      g.fillStyle = '#fff';
      g.font = '700 54px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(it[1], x, CY + 4);
    });
  },
  crm(g) {
    const layers = [CY - 70, CY, CY + 70];
    layers.forEach((y, i) => {
      g.fillStyle = `rgba(255,255,255,${1 - i * 0.18})`;
      g.beginPath();
      g.ellipse(CX, y, 132, 38, 0, 0, 7);
      g.fill();
    });
  },
  ai(g) {
    g.strokeStyle = '#e4d8ff';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(CX - 58, 192, 58, Math.PI * 0.55, Math.PI * 1.85);
    g.stroke();
    g.beginPath();
    g.arc(CX + 58, 192, 58, Math.PI * 1.15, Math.PI * 2.45);
    g.stroke();
    g.beginPath();
    g.moveTo(CX, 138);
    g.lineTo(CX, 268);
    g.stroke();
  },
  hand(g) {
    g.strokeStyle = '#fff';
    g.lineWidth = 15;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(160, 150);
    g.lineTo(300, 196);
    g.stroke();
    g.beginPath();
    g.moveTo(608, 150);
    g.lineTo(468, 196);
    g.stroke();
    g.fillStyle = '#fff';
    rr(g, 286, 186, 196, 58, 26);
    g.fill();
  },
  sec(g) {
    g.strokeStyle = '#dbe7ff';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(CX, 120);
    g.lineTo(CX + 108, 158);
    g.lineTo(CX + 108, 222);
    g.quadraticCurveTo(CX + 96, 300, CX, 330);
    g.quadraticCurveTo(CX - 96, 300, CX - 108, 222);
    g.lineTo(CX - 108, 158);
    g.closePath();
    g.stroke();
  },
  mobile(g) {
    g.strokeStyle = '#fff';
    g.lineWidth = 9;
    [
      [-58, 0],
      [58, 20],
    ].forEach((p) => {
      const w = 96;
      const h = 196;
      const y = CY - p[1];
      rr(g, CX + p[0] - w / 2, y - h / 2, w, h, 18);
      g.stroke();
    });
  },
};

const TVDATA: Record<string, { build: string[]; proj: Array<[string, number, string]>; news: string[] }> = {
  web: {
    build: ['Business websites', 'Custom web apps', 'Client portals & APIs'],
    proj: [
      ['Retail group website', 82, 'Build'],
      ['Client portal v2', 61, 'Testing'],
      ['Booking platform', 96, 'Launching'],
    ],
    news: ['Booking platform goes live this week', '3 sites shipped this sprint', 'Page speed up 24% across client sites'],
  },
  front: {
    build: ['Design systems', 'Responsive interfaces', 'Prototypes & motion'],
    proj: [
      ['Brand site redesign', 74, 'Build'],
      ['Component library', 58, 'Review'],
      ['Mobile checkout UI', 91, 'Polish'],
    ],
    news: ['Component library hits v1.0 soon', 'New landing page kit approved', 'Accessibility audit passed'],
  },
  cart: {
    build: ['Online stores', 'M-Pesa & card payments', 'Inventory sync'],
    proj: [
      ['Fashion store', 68, 'Build'],
      ['Grocery delivery shop', 85, 'Testing'],
      ['Marketplace checkout', 47, 'Build'],
    ],
    news: ['Grocery shop passes load test', 'M-Pesa checkout live on 2 stores', 'Cart conversion up 11%'],
  },
  wp: {
    build: ['WordPress websites', 'Custom themes & plugins', 'Hosting & care plans'],
    proj: [
      ['Law firm website', 88, 'Review'],
      ['NGO donation site', 63, 'Build'],
      ['Theme migration', 95, 'Launching'],
    ],
    news: ['12 care-plan sites updated today', 'Theme migration launching', 'All plugins patched'],
  },
  seo: {
    build: ['Technical SEO', 'Keyword & content plans', 'Local search rankings'],
    proj: [
      ['Retail keyword push', 71, 'Ranking'],
      ['Site speed overhaul', 56, 'Build'],
      ['Local listings', 89, 'Review'],
    ],
    news: ['6 keywords reached page one', 'Core Web Vitals now green', 'Backlink campaign on track'],
  },
  mkt: {
    build: ['Campaign strategy', 'Email & content', 'Analytics reports'],
    proj: [
      ['Q4 brand campaign', 77, 'Live'],
      ['Email nurture flow', 52, 'Build'],
      ['Monthly insights', 93, 'Review'],
    ],
    news: ['Q4 campaign reach up 31%', 'New email flow in testing', 'Report pack sent to clients'],
  },
  ppc: {
    build: ['Google Search ads', 'Display & remarketing', 'Conversion tracking'],
    proj: [
      ['Festive season ads', 84, 'Live'],
      ['Lead-gen campaign', 66, 'Optimising'],
      ['Tracking setup', 97, 'Done'],
    ],
    news: ['Cost per lead down 18%', 'Festive ads running', 'Conversion tracking verified'],
  },
  wa: {
    build: ['WhatsApp Business API', 'Chatbots', 'Broadcast campaigns'],
    proj: [
      ['Support chatbot', 79, 'Testing'],
      ['Order-updates bot', 59, 'Build'],
      ['Promo broadcast', 92, 'Live'],
    ],
    news: ['Chatbot answering 70% of queries', 'Promo broadcast delivered', 'New order-alerts bot in build'],
  },
  social: {
    build: ['Content calendars', 'Reels & short video', 'Community management'],
    proj: [
      ['Festive content pack', 86, 'Scheduling'],
      ['Reels series', 64, 'Editing'],
      ['Brand refresh posts', 45, 'Design'],
    ],
    news: ['Reels reach doubled this month', 'Content pack scheduled', 'Engagement up 22%'],
  },
  crm: {
    build: ['Custom CRM systems', 'Sales pipelines', 'Automation & reports'],
    proj: [
      ['Sales CRM v2', 73, 'Build'],
      ['Lead scoring', 55, 'Testing'],
      ['Dashboard reports', 90, 'Review'],
    ],
    news: ['CRM v2 beta with first client', 'Lead scoring in testing', 'Pipeline reports automated'],
  },
  ai: {
    build: ['AI assistants', 'Workflow automation', 'Data & insights'],
    proj: [
      ['Customer-support AI', 69, 'Training'],
      ['Invoice automation', 81, 'Testing'],
      ['Sales forecasting', 48, 'Build'],
    ],
    news: ['Support AI resolves 60% of tickets', 'Invoice bot saves 20 hrs/week', 'New forecasting model training'],
  },
  hand: {
    build: ['Digital strategy', 'Tech audits', 'Roadmaps & training'],
    proj: [
      ['Digital roadmap, retail', 80, 'Workshop'],
      ['Systems audit', 62, 'Review'],
      ['Team training', 94, 'Delivering'],
    ],
    news: ['Roadmap workshop this Thursday', 'Systems audit findings ready', 'Training day fully booked'],
  },
  sec: {
    build: ['Maintenance plans', 'Security hardening', 'Backups & uptime'],
    proj: [
      ['Security sweep', 87, 'Scanning'],
      ['Server upgrades', 60, 'Build'],
      ['Backup automation', 96, 'Done'],
    ],
    news: ['99.98% uptime this month', 'All backups verified', 'Zero open critical issues'],
  },
  mobile: {
    build: ['iOS & Android apps', 'Cross-platform builds', 'App store launches'],
    proj: [
      ['Delivery app', 75, 'Build'],
      ['Fitness tracker app', 57, 'Testing'],
      ['Banking app UI', 90, 'Review'],
    ],
    news: ['Delivery app beta released', 'Store review passed', 'Crash-free rate at 99.7%'],
  },
};

const stageCol: Record<string, string> = {
  Live: '#4fe38a',
  Done: '#4fe38a',
  Launching: '#ffd27a',
  Review: '#ffd27a',
  Testing: '#7fb0ff',
  Build: '#c0a8ff',
};

const TV_W = 1280;
const TV_H = 720;

export function createWallTvMat(reg: ScreenRegistry, d: RoomDef, idx: number): THREE.MeshStandardMaterial {
  const cv = document.createElement('canvas');
  cv.width = TV_W;
  cv.height = TV_H;
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = getMaxAnisotropy();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.65,
    metalness: 0.0,
    emissive: 0xffffff,
    emissiveMap: tx,
    emissiveIntensity: 1.05,
  });

  const lc = document.createElement('canvas');
  lc.width = 192;
  lc.height = 96;
  const lg = lc.getContext('2d')!;
  lg.scale(0.25, 0.25);
  try {
    (LOGO[d.t] || LOGO.web)(lg);
  } catch {
    // ignore
  }

  const tv: WallTVRef = {
    d,
    idx,
    g: cv.getContext('2d')!,
    tx,
    mat,
    logo: lc,
    mesh: null,
    data: TVDATA[d.t] || TVDATA.web,
    accent: '#' + d.soft.toString(16).padStart(6, '0'),
  };
  reg.wallTVs.push(tv);
  drawWallTV(tv, 0);
  return mat;
}

export function drawWallTV(tv: WallTVRef, t: number) {
  const g = tv.g;
  const A = tv.accent;
  const D = tv.data;
  g.save();
  g.setTransform(TV_W / 800, 0, 0, TV_H / 450, 0, 0);
  g.fillStyle = '#0a0f18';
  g.fillRect(0, 0, 800, 450);

  const hg = g.createLinearGradient(0, 0, 800, 0);
  hg.addColorStop(0, '#1a2740');
  hg.addColorStop(1, '#0a0f18');
  g.fillStyle = hg;
  g.fillRect(0, 0, 800, 60);
  g.fillStyle = A;
  g.fillRect(0, 58, 800, 3);
  g.drawImage(tv.logo, 10, 8, 88, 44);

  g.fillStyle = '#ffffff';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.font = `700 34px ${WS_SANS}`;
  g.fillText(tv.d.n, 108, 31);

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  g.textAlign = 'right';
  g.fillStyle = '#cbd5e1';
  g.font = `600 20px ${WS_SANS}`;
  g.fillText(hh, 780, 31);

  g.fillStyle = Math.sin(t * 4) > -0.2 ? '#ff4d4d' : '#7a2a2a';
  circ(g, 676, 31, 6);
  g.fillStyle = '#ffffff';
  g.font = `700 17px ${WS_SANS}`;
  g.fillText('LIVE', 716, 32);

  g.textAlign = 'left';
  g.fillStyle = A;
  g.font = `700 17px ${WS_SANS}`;
  g.fillText('WHAT WE BUILD', 28, 88);
  D.build.forEach((b, i) => {
    const y = 104 + i * 46;
    g.fillStyle = 'rgba(255,255,255,.09)';
    rr(g, 24, y, 270, 38, 8);
    g.fill();
    g.fillStyle = A;
    rr(g, 34, y + 11, 16, 16, 4);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `600 20px ${WS_SANS}`;
    g.fillText(b, 62, y + 20);
  });

  g.fillStyle = A;
  g.font = `700 17px ${WS_SANS}`;
  g.fillText('DELIVERED THIS WEEK', 28, 260);
  const k = tv.idx * 7 + 1;
  for (let i = 0; i < 7; i++) {
    let v = 0.3 + 0.6 * hr(k + i);
    if (i === 6) v = 0.55 + 0.35 * Math.sin(t * 1.3) * 0.5 + 0.15;
    const bh = v * 84;
    const x = 30 + i * 38;
    g.fillStyle = i === 6 ? A : 'rgba(255,255,255,.32)';
    rr(g, x, 372 - bh, 26, bh, 4);
    g.fill();
    g.fillStyle = '#cbd5e1';
    g.font = `600 14px ${WS_SANS}`;
    g.textAlign = 'center';
    g.fillText('MTWTFSS'[i], x + 13, 386);
    g.textAlign = 'left';
  }

  g.fillStyle = A;
  g.font = `700 17px ${WS_SANS}`;
  g.fillText("HOW IT'S GOING", 330, 88);
  const cyc = (t + tv.idx * 1.7) % 16;
  const ease = Math.min(1, cyc / 2.4);
  const e = 1 - Math.pow(1 - ease, 3);
  D.proj.forEach((p, i) => {
    const y = 104 + i * 88;
    const col = stageCol[p[2]] || A;
    g.fillStyle = 'rgba(255,255,255,.09)';
    rr(g, 326, y, 452, 78, 10);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `700 22px ${WS_SANS}`;
    g.fillText(p[0], 342, y + 22);
    g.font = `700 15px ${WS_SANS}`;
    const tw = g.measureText(p[2]).width + 22;
    g.fillStyle = col;
    g.globalAlpha = 0.24;
    rr(g, 762 - tw, y + 10, tw, 24, 12);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = col;
    g.textAlign = 'center';
    g.fillText(p[2], 762 - tw / 2, y + 23);
    g.textAlign = 'left';
    g.fillStyle = 'rgba(255,255,255,.14)';
    rr(g, 342, y + 48, 360, 14, 7);
    g.fill();
    const pg = (p[1] / 100) * e;
    const bg = g.createLinearGradient(342, 0, 702, 0);
    bg.addColorStop(0, A);
    bg.addColorStop(1, col);
    g.fillStyle = bg;
    if (pg > 0.01) {
      rr(g, 342, y + 48, Math.max(14, 360 * pg), 14, 7);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    g.font = `700 21px ${WS_SANS}`;
    g.textAlign = 'right';
    g.fillText(Math.round(p[1] * e) + '%', 764, y + 55);
    g.textAlign = 'left';
  });

  g.fillStyle = '#070b12';
  g.fillRect(0, 402, 800, 48);
  g.fillStyle = A;
  g.fillRect(0, 402, 800, 2);
  g.fillStyle = A;
  rr(g, 16, 414, 74, 24, 12);
  g.fill();
  g.fillStyle = '#0a0f18';
  g.font = `800 14px ${WS_SANS}`;
  g.textAlign = 'center';
  g.fillText('LATEST', 53, 427);
  g.textAlign = 'left';
  g.fillStyle = '#ffffff';
  g.font = `600 21px ${WS_SANS}`;
  g.fillText(D.news[Math.floor(t / 5 + tv.idx) % D.news.length], 104, 427);
  g.fillStyle = '#4fe38a';
  circ(g, 688, 427, 6);
  g.font = `700 17px ${WS_SANS}`;
  g.fillText('On track', 700, 428);
  g.restore();
  tv.tx.needsUpdate = true;
}

/* ---- Desk monitors ---- */
function wsBrowser(g: CanvasRenderingContext2D, w: number, h: number, t: number, sessions: BrowserSession[]) {
  const item = sessions[Math.floor(t / 12) % sessions.length];
  const tt = t % 12;

  // Browser chrome
  g.fillStyle = '#f3f6fa';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#dfe5ee';
  g.fillRect(0, 0, w, 20);
  g.fillStyle = '#ffffff';
  rr(g, 6, 3, 170, 17, 5);
  g.fill();
  g.fillStyle = '#1e293b';
  g.font = `600 8.5px ${WS_SANS}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(item.tabTitle.slice(0, 28), 12, 11.5);

  if (tt < 4.5) {
    // Stage 1: Typing real search query + results appearing
    const tq = wsTyped(item.searchQuery, tt, 16);
    g.fillStyle = '#ffffff';
    rr(g, 8, 23, w - 16, 17, 8);
    g.fill();
    g.fillStyle = '#64748b';
    g.font = `8.5px ${WS_MONO}`;
    g.fillText('https://search.web/?q=' + tq.slice(0, 38), 16, 31.5);

    g.fillStyle = '#ffffff';
    rr(g, 14, 46, w - 28, 22, 11);
    g.fill();
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 1;
    rr(g, 14, 46, w - 28, 22, 11);
    g.stroke();
    g.fillStyle = '#0f172a';
    g.font = `10px ${WS_SANS}`;
    g.fillText(tq.slice(0, 44) + (Math.floor(t * 2) % 2 ? '|' : ''), 24, 57);

    const rev = wsEase((tt - 1.6) / 0.6);
    if (rev > 0) {
      g.globalAlpha = rev;
      g.fillStyle = '#15803d';
      g.font = `8.5px ${WS_SANS}`;
      g.fillText(item.articleDomain, 18, 84);
      g.fillStyle = tt > 3.6 ? '#1d4ed8' : '#0369a1';
      g.font = `700 11px ${WS_SANS}`;
      wsWrap(g, item.articleTitle, w - 36)
        .slice(0, 2)
        .forEach((ln, idx) => g.fillText(ln, 18, 99 + idx * 13));
      g.fillStyle = '#475569';
      g.font = `9px ${WS_SANS}`;
      wsWrap(g, item.sections[0]?.excerpt || '', w - 36)
        .slice(0, 2)
        .forEach((ln, idx) => g.fillText(ln, 18, 130 + idx * 12));
      g.globalAlpha = 1;
    }
  } else {
    // Stage 2: Reading opened research page & highlighting excerpt
    g.fillStyle = '#ffffff';
    rr(g, 8, 23, w - 16, 17, 8);
    g.fill();
    g.fillStyle = '#0f766e';
    g.font = `8.5px ${WS_MONO}`;
    g.fillText(item.url.slice(0, 48), 16, 31.5);

    g.fillStyle = '#0f172a';
    g.font = `700 11.5px ${WS_SANS}`;
    wsWrap(g, item.articleTitle, w - 24)
      .slice(0, 2)
      .forEach((ln, idx) => g.fillText(ln, 12, 52 + idx * 13));

    const sec = item.sections[Math.floor((tt - 4.5) / 3.8) % item.sections.length];
    g.fillStyle = '#334155';
    g.font = `700 9px ${WS_SANS}`;
    g.fillText(sec.heading, 12, 84);

    g.fillStyle = '#475569';
    g.font = `9px ${WS_SANS}`;
    wsWrap(g, sec.excerpt, w - 24)
      .slice(0, 3)
      .forEach((ln, idx) => g.fillText(ln, 12, 98 + idx * 11));

    // Highlighted research citation box
    g.fillStyle = '#ecfdf5';
    rr(g, 10, 136, w - 20, 34, 5);
    g.fill();
    g.fillStyle = '#10b981';
    g.fillRect(10, 136, 3, 34);
    g.fillStyle = '#065f46';
    g.font = `600 8.5px ${WS_MONO}`;
    wsWrap(g, sec.highlight, w - 34)
      .slice(0, 2)
      .forEach((ln, idx) => g.fillText(ln, 18, 147 + idx * 11));

    // Bottom research note bar
    g.fillStyle = '#1e293b';
    g.fillRect(0, h - 22, w, 22);
    g.fillStyle = '#6fe3a1';
    g.font = `700 8.5px ${WS_SANS}`;
    g.fillText('NOTE: ' + item.researchNote.slice(0, 52), 10, h - 11);
  }
}

function wsEditor(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  c: { file: string; lang: string; lines: string[]; accent: string }
) {
  g.fillStyle = '#0f141b';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1a212b';
  g.fillRect(0, 0, w, 18);
  g.fillStyle = '#0f141b';
  g.fillRect(6, 3, c.file.length * 5.4 + 26, 15);
  g.fillStyle = '#c9d4e3';
  g.font = `9px ${WS_SANS}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(c.file, 14, 11);
  g.fillStyle = '#161d26';
  g.fillRect(0, 18, 26, h - 34);
  const total = c.lines.reduce((a, l) => a + l.length + 1, 0);
  const cps = 24;
  const cyc = total / cps + 5;
  const tt = t % cyc;
  let chars = Math.floor(tt * cps);
  const shown: string[] = [];
  let cur = 0;
  for (let i = 0; i < c.lines.length; i++) {
    const L = c.lines[i];
    if (chars >= L.length + 1) {
      shown.push(L);
      chars -= L.length + 1;
      cur = i + 1;
    } else {
      shown.push(L.slice(0, Math.max(0, chars)));
      cur = i;
      break;
    }
  }
  const lh = 12;
  const maxL = Math.floor((h - 36) / lh);
  const start = Math.max(0, shown.length - maxL);
  g.font = `10px ${WS_MONO}`;
  for (let i = start; i < shown.length; i++) {
    const y = 18 + 6 + (i - start) * lh + 5;
    g.fillStyle = '#5b6a7c';
    g.textAlign = 'right';
    g.fillText(String(i + 1), 20, y);
    g.textAlign = 'left';
    g.fillStyle = '#d5deea';
    g.fillText(shown[i], 32, y);
  }
  g.fillStyle = c.accent;
  g.fillRect(0, h - 16, w, 16);
  g.fillStyle = '#0a0f18';
  g.font = `700 9px ${WS_SANS}`;
  g.textBaseline = 'middle';
  g.fillText(`${c.lang}   Ln ${cur + 1}   UTF-8`, 8, h - 8);
}

function wsDataEntry(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  accent: string,
  spec: DataEntrySpec
) {
  g.fillStyle = '#0d141d';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#182230';
  g.fillRect(0, 0, w, 22);
  g.fillStyle = '#e8f0ff';
  g.font = `700 9.5px ${WS_SANS}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(spec.sheetTitle, 10, 11);
  g.fillStyle = accent;
  circ(g, w - 12, 11, 3.5);

  const cols = [0.3, 0.27, 0.21, 0.22];
  let cx = 10;
  const xs = cols.map((f) => {
    const v = cx;
    cx += f * (w - 20);
    return v;
  });

  g.fillStyle = '#7d8da0';
  g.font = `700 8px ${WS_SANS}`;
  spec.columns.forEach((hd, i) => g.fillText(hd.toUpperCase(), xs[i], 33));
  g.fillStyle = '#253244';
  g.fillRect(8, 40, w - 16, 1);

  const allPool = [...spec.initialRows, ...spec.incomingQueue];
  const stepDur = 5.5;
  const cycleIdx = Math.floor(t / stepDur);
  const tt = t % stepDur;
  const committedOffset = cycleIdx % spec.incomingQueue.length;
  const visibleRows: Array<[string, string, string, string]> = [];
  for (let i = 0; i < 4; i++) {
    visibleRows.push(allPool[(committedOffset + i) % allPool.length]);
  }
  const activeDraft = allPool[(committedOffset + 4) % allPool.length];

  visibleRows.forEach((r, ri) => {
    const y = 52 + ri * 23;
    if (ri % 2 === 0) {
      g.fillStyle = 'rgba(255,255,255,.04)';
      g.fillRect(8, y - 9, w - 16, 21);
    }
    r.forEach((val, ci) => {
      let col = '#cbd5e1';
      if (val.startsWith('▲')) col = '#4fe38a';
      else if (ci === 0) col = '#f8fafc';
      g.fillStyle = col;
      g.font = `${ci === 0 ? '600 ' : ''}9px ${WS_SANS}`;
      g.fillText(val.slice(0, 16), xs[ci], y + 1);
    });
  });

  // Live active data-entry row typing character-by-character
  const dy = 148;
  g.fillStyle = 'rgba(56, 189, 248, 0.12)';
  rr(g, 8, dy - 10, w - 16, 24, 4);
  g.fill();
  g.strokeStyle = tt > 4.5 ? '#4fe38a' : '#38bdf8';
  g.lineWidth = 1;
  rr(g, 8, dy - 10, w - 16, 24, 4);
  g.stroke();

  let charsLeft = Math.floor(tt * 14);
  activeDraft.forEach((cellVal, ci) => {
    const typed = cellVal.slice(0, Math.max(0, charsLeft));
    const isTypingHere = charsLeft >= 0 && charsLeft <= cellVal.length;
    charsLeft -= cellVal.length + 2;
    g.fillStyle = ci === 3 && tt > 4.2 ? '#4fe38a' : '#f8fafc';
    g.font = `600 9px ${WS_MONO}`;
    const cursor = isTypingHere && Math.floor(t * 2.5) % 2 ? '|' : '';
    g.fillText((typed + cursor).slice(0, 15), xs[ci], dy + 2);
  });

  g.fillStyle = '#141c26';
  g.fillRect(0, h - 18, w, 18);
  g.fillStyle = tt > 4.5 ? '#4fe38a' : '#7dd3fc';
  g.font = `700 8.5px ${WS_SANS}`;
  g.fillText(
    tt > 4.5 ? '✓ Record validated & saved to live database' : 'Entering live record · Row #' + (committedOffset + 5),
    10,
    h - 9
  );
}

function wsJobScreen(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  accent: string,
  profile: WorkstationProfile
) {
  const job = profile.jobApp;

  if (job.appType === 'ide') {
    wsEditor(g, w, h, t, {
      file: profile.projectWork.fileName,
      lang: `${profile.projectWork.language} · ${job.kpis[0]?.value || 'OK'}`,
      accent,
      lines: profile.projectWork.codeLines,
    });
    // Live right-hand API / emulator status pill
    g.fillStyle = 'rgba(16, 185, 129, 0.16)';
    rr(g, w - 122, 22, 114, 22, 4);
    g.fill();
    g.fillStyle = '#4fe38a';
    g.font = `700 8px ${WS_MONO}`;
    g.textAlign = 'left';
    g.fillText(`PASS · ${job.kpis[1]?.value || '100%'}`, w - 116, 33);
    return;
  }

  if (job.appType === 'design') {
    // Visual Figma / E-Commerce Storefront / WordPress Block Canvas
    g.fillStyle = '#151922';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f2532';
    g.fillRect(0, 0, w, 20);
    g.fillStyle = '#f8fafc';
    g.font = `700 9px ${WS_SANS}`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText(job.appName, 10, 10);

    // Canvas Artboard Preview (left 64%)
    g.fillStyle = '#f8fafc';
    rr(g, 10, 28, 226, h - 40, 6);
    g.fill();
    g.fillStyle = accent;
    rr(g, 18, 36, 210, 26, 4);
    g.fill();
    g.fillStyle = '#0f172a';
    g.font = `700 9.5px ${WS_SANS}`;
    g.fillText(job.visualHeadline.slice(0, 32), 24, 49);

    g.fillStyle = '#475569';
    g.font = `8px ${WS_SANS}`;
    g.fillText(job.visualSubline.slice(0, 38), 18, 74);

    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    job.chartBars.slice(0, 3).forEach((v, idx) => {
      const bx = 18 + idx * 70;
      g.fillStyle = '#e2e8f0';
      rr(g, bx, 88, 64, 54, 5);
      g.fill();
      g.fillStyle = idx === Math.floor(t / 2) % 3 ? accent : '#38bdf8';
      rr(g, bx + 6, 94, 52, 24, 3);
      g.fill();
      g.fillStyle = '#1e293b';
      g.font = `700 8px ${WS_SANS}`;
      g.fillText(job.chartLabels[idx] || `Card ${idx + 1}`, bx + 8, 130);
      g.fillStyle = '#64748b';
      g.fillRect(bx + 8, 136, Math.round(44 * (0.6 + v * 0.4 * pulse)), 3);
    });

    g.fillStyle = '#0f172a';
    rr(g, 18, 152, 210, 22, 4);
    g.fill();
    g.fillStyle = '#6fe3a1';
    g.font = `700 8.5px ${WS_SANS}`;
    g.fillText(`LIVE PREVIEW · ${job.kpis[0]?.value} ${job.kpis[0]?.label}`, 26, 163);

    // Inspector Panel (right)
    g.fillStyle = '#1e2533';
    rr(g, 244, 28, w - 254, h - 40, 5);
    g.fill();
    g.fillStyle = '#94a3b8';
    g.font = `700 8px ${WS_SANS}`;
    g.fillText('INSPECTOR', 252, 40);
    job.visualItems.forEach((it, idx) => {
      const iy = 54 + idx * 42;
      g.fillStyle = 'rgba(255,255,255,0.06)';
      rr(g, 250, iy, w - 266, 36, 4);
      g.fill();
      g.fillStyle = '#f8fafc';
      g.font = `600 8.5px ${WS_SANS}`;
      g.fillText(it.title.slice(0, 18), 256, iy + 12);
      g.fillStyle = '#4fe38a';
      g.font = `700 8px ${WS_SANS}`;
      g.fillText(it.status, 256, iy + 26);
    });
    return;
  }

  if (job.appType === 'social') {
    // Social Media / WhatsApp Flow Studio (Phone mockup + metrics)
    g.fillStyle = '#101622';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a2334';
    g.fillRect(0, 0, w, 20);
    g.fillStyle = '#f8fafc';
    g.font = `700 9px ${WS_SANS}`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText(job.appName, 10, 10);

    // Phone mockup on left
    g.fillStyle = '#070a10';
    rr(g, 14, 26, 114, h - 34, 12);
    g.fill();
    g.strokeStyle = accent;
    g.lineWidth = 1.5;
    rr(g, 14, 26, 114, h - 34, 12);
    g.stroke();

    const grad = g.createLinearGradient(20, 34, 122, 140);
    grad.addColorStop(0, accent);
    grad.addColorStop(1, '#1e293b');
    g.fillStyle = grad;
    rr(g, 20, 34, 102, 104, 7);
    g.fill();

    g.fillStyle = '#ffffff';
    g.font = `700 8.5px ${WS_SANS}`;
    wsWrap(g, job.visualHeadline, 90)
      .slice(0, 3)
      .forEach((ln, idx) => g.fillText(ln, 26, 54 + idx * 12));

    g.fillStyle = 'rgba(255,255,255,0.14)';
    rr(g, 20, 144, 102, 54, 5);
    g.fill();
    g.fillStyle = '#e2e8f0';
    g.font = `8px ${WS_SANS}`;
    wsWrap(g, job.visualSubline, 94)
      .slice(0, 3)
      .forEach((ln, idx) => g.fillText(ln, 25, 155 + idx * 11));

    // KPI tiles + queue on right
    job.kpis.forEach((kp, idx) => {
      const kx = 140 + idx * 78;
      g.fillStyle = 'rgba(255,255,255,0.06)';
      rr(g, kx, 28, 74, 42, 5);
      g.fill();
      g.fillStyle = '#94a3b8';
      g.font = `700 7.5px ${WS_SANS}`;
      g.fillText(kp.label.toUpperCase(), kx + 6, 39);
      g.fillStyle = '#ffffff';
      g.font = `700 11px ${WS_SANS}`;
      g.fillText(kp.value, kx + 6, 56);
    });

    job.visualItems.forEach((it, idx) => {
      const iy = 80 + idx * 42;
      g.fillStyle = 'rgba(255,255,255,0.05)';
      rr(g, 140, iy, w - 150, 36, 5);
      g.fill();
      g.fillStyle = '#f8fafc';
      g.font = `600 9px ${WS_SANS}`;
      g.fillText(it.title, 148, iy + 13);
      g.fillStyle = '#94a3b8';
      g.font = `8px ${WS_SANS}`;
      g.fillText(it.meta, 148, iy + 26);
      g.fillStyle = '#4fe38a';
      g.font = `700 8px ${WS_SANS}`;
      g.textAlign = 'right';
      g.fillText(it.status, w - 18, iy + 19);
      g.textAlign = 'left';
    });
    return;
  }

  if (job.appType === 'security') {
    // Fleet NOC, Server Health Grid & Infrastructure Telemetry
    g.fillStyle = '#090f17';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#121c2a';
    g.fillRect(0, 0, w, 20);
    g.fillStyle = '#e2e8f0';
    g.font = `700 9px ${WS_SANS}`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText(job.appName, 10, 10);
    g.fillStyle = '#4fe38a';
    circ(g, w - 12, 10, 3.5);

    // 24-node health matrix
    g.fillStyle = 'rgba(255,255,255,0.04)';
    rr(g, 10, 28, 148, 86, 5);
    g.fill();
    g.fillStyle = '#94a3b8';
    g.font = `700 8px ${WS_SANS}`;
    g.fillText('FLEET HEALTH MATRIX', 18, 39);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const pulseOn = ((r * 6 + c + Math.floor(t * 2)) % 19) === 0;
        g.fillStyle = pulseOn ? '#38bdf8' : '#22c55e';
        rr(g, 18 + c * 22, 50 + r * 14, 17, 10, 2);
        g.fill();
      }
    }

    // Performance / Load Bars
    g.fillStyle = 'rgba(255,255,255,0.04)';
    rr(g, 166, 28, w - 176, 86, 5);
    g.fill();
    job.chartBars.forEach((v, idx) => {
      const bx = 178 + idx * 32;
      const bh = Math.round(48 * v * (0.94 + 0.06 * Math.sin(t * 2 + idx)));
      g.fillStyle = '#38bdf8';
      rr(g, bx, 96 - bh, 18, bh, 3);
      g.fill();
      g.fillStyle = '#94a3b8';
      g.font = `700 7.5px ${WS_SANS}`;
      g.fillText(job.chartLabels[idx] || '', bx + 1, 106);
    });

    // Live audit log bottom
    g.fillStyle = '#0e1722';
    rr(g, 10, 122, w - 20, h - 130, 5);
    g.fill();
    g.fillStyle = '#4fe38a';
    g.font = `700 8.5px ${WS_MONO}`;
    g.fillText(job.visualHeadline.slice(0, 46), 18, 136);
    g.fillStyle = '#cbd5e1';
    g.font = `8.5px ${WS_MONO}`;
    g.fillText(job.visualSubline.slice(0, 50), 18, 154);
    job.visualItems.slice(0, 2).forEach((it, idx) => {
      g.fillStyle = '#7dd3fc';
      g.fillText(`• ${it.title}: ${it.meta} [${it.status}]`.slice(0, 52), 18, 174 + idx * 15);
    });
    return;
  }

  // Marketing (Search Console / GA4 / Google Ads) & Executive (Finance / CEO / Advisory)
  g.fillStyle = '#0d141e';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#172232';
  g.fillRect(0, 0, w, 20);
  g.fillStyle = '#f8fafc';
  g.font = `700 9px ${WS_SANS}`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(job.appName, 10, 10);
  g.fillStyle = accent;
  circ(g, w - 12, 10, 3.5);

  // 3 KPI tiles
  job.kpis.forEach((kp, idx) => {
    const kx = 10 + idx * 123;
    g.fillStyle = 'rgba(255,255,255,0.06)';
    rr(g, kx, 26, 117, 42, 5);
    g.fill();
    g.fillStyle = '#94a3b8';
    g.font = `700 7.5px ${WS_SANS}`;
    g.fillText(kp.label.toUpperCase(), kx + 8, 37);
    g.fillStyle = '#ffffff';
    g.font = `700 12px ${WS_SANS}`;
    g.fillText(kp.value, kx + 8, 54);
    g.fillStyle = '#4fe38a';
    g.font = `700 8px ${WS_SANS}`;
    g.textAlign = 'right';
    g.fillText(kp.delta, kx + 110, 54);
    g.textAlign = 'left';
  });

  // Animated 6-bar performance chart on left
  g.fillStyle = 'rgba(255,255,255,0.04)';
  rr(g, 10, 74, 168, h - 82, 5);
  g.fill();
  const grow = Math.min(1, ((t % 10) / 1.8) + 0.25);
  job.chartBars.forEach((v, idx) => {
    const bx = 20 + idx * 25;
    const bh = Math.round(92 * v * grow);
    g.fillStyle = idx === job.chartBars.length - 1 ? '#4fe38a' : accent;
    rr(g, bx, h - 28 - bh, 16, bh, 3);
    g.fill();
    g.fillStyle = '#94a3b8';
    g.font = `700 7.5px ${WS_SANS}`;
    g.fillText((job.chartLabels[idx] || '').slice(0, 4), bx, h - 16);
  });

  // Right-side Live Snippet / Deliverable Feed
  g.fillStyle = 'rgba(255,255,255,0.05)';
  rr(g, 184, 74, w - 194, h - 82, 5);
  g.fill();
  g.fillStyle = '#7dd3fc';
  g.font = `700 8.5px ${WS_SANS}`;
  wsWrap(g, job.visualHeadline, w - 210)
    .slice(0, 2)
    .forEach((ln, idx) => g.fillText(ln, 192, 88 + idx * 11));
  g.fillStyle = '#94a3b8';
  g.font = `8px ${WS_SANS}`;
  wsWrap(g, job.visualSubline, w - 210)
    .slice(0, 2)
    .forEach((ln, idx) => g.fillText(ln, 192, 114 + idx * 10));

  job.visualItems.slice(0, 2).forEach((it, idx) => {
    const iy = 144 + idx * 30;
    g.fillStyle = 'rgba(255,255,255,0.05)';
    rr(g, 192, iy, w - 210, 24, 4);
    g.fill();
    g.fillStyle = '#f8fafc';
    g.font = `600 8px ${WS_SANS}`;
    g.fillText(it.title.slice(0, 18), 198, iy + 12);
    g.fillStyle = '#4fe38a';
    g.textAlign = 'right';
    g.fillText(it.status, w - 22, iy + 12);
    g.textAlign = 'left';
  });
}

export function createDeskScreenMat(reg: ScreenRegistry, d: RoomDef, k: number): THREE.MeshStandardMaterial {
  d._ws = d._ws || [];
  if (d._ws[k]) return (d._ws[k] as WorkScreenRef).mat as THREE.MeshStandardMaterial;

  const cv = document.createElement('canvas');
  cv.width = WS_W;
  cv.height = WS_H;
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = getMaxAnisotropy();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.6,
    metalness: 0.0,
    emissive: 0xffffff,
    emissiveMap: tx,
    emissiveIntensity: 1.02,
  });

  const acc = '#' + d.soft.toString(16).padStart(6, '0');
  const profile = getWorkstationProfile(d.t);
  const mode = getModeForDesk(d.t, k);

  const fn = (g: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    g.save();
    g.setTransform(WS_SCALE, 0, 0, WS_SCALE, 0, 0);
    if (mode === 'browser') {
      wsBrowser(g, w, h, t, profile.browserSessions);
    } else if (mode === 'dataEntry') {
      wsDataEntry(g, w, h, t, acc, profile.dataEntry);
    } else {
      wsJobScreen(g, w, h, t, acc, profile);
    }
    g.restore();
  };

  const s: WorkScreenRef = {
    g: cv.getContext('2d')!,
    tx,
    mat,
    mesh: null,
    next: 0,
    off: (ROOMS.indexOf(d) + 1) * 2.9 + k * 4.3,
    lv: d.lv,
    fn,
  };
  d._ws[k] = s;
  reg.workScreens.push(s);
  s.fn(s.g, WS_LOGICAL_W, WS_LOGICAL_H, s.off);
  tx.needsUpdate = true;
  return mat;
}

let exN = 0;
export function createExecScreen(reg: ScreenRegistry, key: string, k: number): WorkScreenRef {
  const cv = document.createElement('canvas');
  cv.width = WS_W;
  cv.height = WS_H;
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = getMaxAnisotropy();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.6,
    metalness: 0.0,
    emissive: 0xffffff,
    emissiveMap: tx,
    emissiveIntensity: 1.02,
  });

  const stationKey =
    key === 'reception'
      ? k === 0
        ? 'reception-0'
        : 'reception-1'
      : key === 'ceo'
        ? k === 0
          ? 'ceo-0'
          : 'ceo-1'
        : key === 'mkt'
          ? 'mkt_head'
          : key;
  const profile = getWorkstationProfile(stationKey);
  const mode = getModeForDesk(stationKey, k);

  const fn = (g: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    g.save();
    g.setTransform(WS_SCALE, 0, 0, WS_SCALE, 0, 0);
    if (mode === 'browser') {
      wsBrowser(g, w, h, t, profile.browserSessions);
    } else if (mode === 'dataEntry') {
      wsDataEntry(g, w, h, t, profile.projectWork.accent, profile.dataEntry);
    } else {
      wsJobScreen(g, w, h, t, profile.projectWork.accent, profile);
    }
    g.restore();
  };

  const s: WorkScreenRef = {
    g: cv.getContext('2d')!,
    tx,
    mat,
    mesh: null,
    next: 0,
    off: ++exN * 3.7 + k * 4.3,
    lv: key === 'reception' ? 0 : key === 'secr' ? 4 : 5,
    fn,
  };
  reg.workScreens.push(s);
  s.fn(s.g, WS_LOGICAL_W, WS_LOGICAL_H, s.off);
  tx.needsUpdate = true;
  return s;
}

export function createBoardScreenMat(reg: ScreenRegistry): THREE.MeshStandardMaterial {
  const LWb = 768;
  const LHb = 256;
  const cv = document.createElement('canvas');
  cv.width = LWb * 2;
  cv.height = LHb * 2;
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = getMaxAnisotropy();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.65,
    metalness: 0.0,
    emissive: 0xffffff,
    emissiveMap: tx,
    emissiveIntensity: 1.08,
  });

  const fn = (g: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    g.save();
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.fillStyle = '#09101d';
    g.fillRect(0, 0, w, h);
    const hd = g.createLinearGradient(0, 0, w, 0);
    hd.addColorStop(0, '#1d3a6b');
    hd.addColorStop(1, '#09101d');
    g.fillStyle = hd;
    g.fillRect(0, 0, w, 40);
    g.fillStyle = '#ffffff';
    g.font = `700 22px ${WS_SANS}`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('DomainTechHub Office · Quarterly board review', 18, 21);

    const grow = Math.min(1, (t % 12) / 2.5 + 0.15);
    for (let i = 0; i < 8; i++) {
      const v = (0.3 + (0.55 * i) / 7 + 0.05 * Math.sin(t * 1.1 + i)) * grow;
      const bh = v * 165;
      const x = 28 + i * 54;
      const bg = g.createLinearGradient(0, h - 22 - bh, 0, h - 22);
      bg.addColorStop(0, '#7fb0ff');
      bg.addColorStop(1, '#2f6fbf');
      g.fillStyle = bg;
      g.fillRect(x, h - 22 - bh, 38, bh);
    }
    [
      ['Revenue', '+18%', '#7cf59a'],
      ['Live projects', '64', '#7fb0ff'],
      ['Client retention', '96%', '#ffd27a'],
    ].forEach((k, i) => {
      const x = 480;
      const y = 52 + i * 64;
      g.fillStyle = 'rgba(255,255,255,.1)';
      g.fillRect(x, y, 270, 54);
      g.fillStyle = '#cbd5e1';
      g.font = `600 17px ${WS_SANS}`;
      g.fillText(k[0], x + 14, y + 17);
      g.fillStyle = k[2];
      g.font = `700 30px ${WS_SANS}`;
      g.fillText(k[1], x + 14, y + 38);
    });
    g.restore();
  };

  const entry = { g: cv.getContext('2d')!, tx, mat, w: LWb, h: LHb, fn };
  reg.boardScreens.push(entry);
  fn(entry.g, LWb, LHb, 0);
  tx.needsUpdate = true;
  return mat;
}

export function createCustomBoardScreen(
  reg: ScreenRegistry,
  logicalW: number,
  logicalH: number,
  fn: (g: CanvasRenderingContext2D, w: number, h: number, t: number) => void
): { mat: THREE.MeshStandardMaterial; setMesh: (m: THREE.Mesh) => void } {
  const cv = document.createElement('canvas');
  cv.width = logicalW * 2;
  cv.height = logicalH * 2;
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = getMaxAnisotropy();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.55,
    metalness: 0.05,
    emissive: 0xffffff,
    emissiveMap: tx,
    emissiveIntensity: 1.15,
  });

  const entry: ScreenRegistry['boardScreens'][number] = {
    g: cv.getContext('2d')!,
    tx,
    mat,
    w: logicalW,
    h: logicalH,
    fn,
  };
  reg.boardScreens.push(entry);
  fn(entry.g, logicalW, logicalH, 0);
  tx.needsUpdate = true;
  return {
    mat,
    setMesh: (m: THREE.Mesh) => {
      entry.mesh = m;
    },
  };
}

const _tvFr = new THREE.Frustum();
const _tvM = new THREE.Matrix4();
const _wsV = new THREE.Vector3();
let tvLast = 0;
let tvTick = 0;
let scrLast = 0;

export function updateAllScreens(
  reg: ScreenRegistry,
  camera: THREE.Camera,
  t: number,
  cutawayMaxLv: number | null = null
) {
  camera.updateMatrixWorld();
  _tvM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _tvFr.setFromProjectionMatrix(_tvM);

  if (t - scrLast >= 0.65) {
    scrLast = t;
    for (const b of reg.boardScreens) {
      if (b.mesh && (!_tvFr.intersectsObject(b.mesh) || b.mesh.position.distanceTo(camera.position) > 135)) {
        continue;
      }
      b.fn(b.g, b.w, b.h, t);
      b.tx.needsUpdate = true;
    }
  }

  if (t - tvLast >= 0.5) {
    tvLast = t;
    tvTick++;
    for (let i = 0; i < reg.wallTVs.length; i++) {
      const tv = reg.wallTVs[i];
      if ((i + tvTick) % 2) continue;
      if (tv.mesh && !_tvFr.intersectsObject(tv.mesh)) continue;
      drawWallTV(tv, t);
    }
  }

  for (let i = 0; i < reg.workScreens.length; i++) {
    const s = reg.workScreens[i];
    if (t < s.next || !s.mesh) continue;
    if (cutawayMaxLv !== null && s.lv != null && s.lv > cutawayMaxLv) {
      s.next = t + 0.8;
      continue;
    }
    const mesh = s.mesh as THREE.Mesh;
    if (!_tvFr.intersectsObject(mesh)) {
      s.next = t + 0.75;
      continue;
    }
    mesh.getWorldPosition(_wsV);
    const dist = _wsV.distanceTo(camera.position);
    if (dist > 45) {
      s.next = t + 2.5;
      continue;
    }
    s.next = t + (dist < 8 ? 0.55 : dist < 20 ? 1.2 : 2.2);
    s.g.setTransform(1, 0, 0, 1, 0, 0);
    s.g.clearRect(0, 0, WS_W, WS_H);
    s.fn(s.g, WS_LOGICAL_W, WS_LOGICAL_H, t + s.off);
    (s.tx as THREE.CanvasTexture).needsUpdate = true;
  }
}
