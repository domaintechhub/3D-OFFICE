import { lookup as dnsLookup } from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) DomainTechHub-Workspace/1.0 Safari/537.36';
const MAX_FETCH_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 8_000;

/* =========================================================
   SSRF & INPUT HARDENING UTILITIES
   ========================================================= */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast & reserved
  return false;
}

function isPrivateOrUnsafeIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase();
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('::ffff:')) {
      const mapped = ip.slice('::ffff:'.length);
      if (net.isIPv4(mapped)) return isPrivateIpv4(mapped);
    }
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // ULA fc00::/7
    if (ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) {
      return true; // fe80::/10 link-local
    }
    if (ip.startsWith('ff')) return true; // multicast
    return false;
  }
  return true;
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are allowed.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not permitted.');
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Private or local hostnames are blocked.');
  }

  const ipType = net.isIP(host);
  if (ipType !== 0) {
    if (isPrivateOrUnsafeIp(host)) {
      throw new Error('Direct private or loopback IP access is blocked.');
    }
    return parsed;
  }

  const records = await dnsLookup(host, { all: true });
  if (!records || records.length === 0) {
    throw new Error(`Could not resolve host "${host}".`);
  }
  for (const rec of records) {
    if (isPrivateOrUnsafeIp(rec.address)) {
      throw new Error(`Host "${host}" resolved to a blocked private network address.`);
    }
  }
  return parsed;
}

async function fetchPublicWithRedirects(
  initialUrl: string,
  accept = 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
): Promise<{ response: globalThis.Response; finalUrl: string; text: string; status: number; contentType: string }> {
  let currentUrl = initialUrl;
  let hop = 0;

  while (hop <= 4) {
    const safeUrl = await assertSafePublicUrl(currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let resp: globalThis.Response;
    try {
      resp = await fetch(safeUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: accept,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location');
      if (!loc) {
        throw new Error(`Redirect (${resp.status}) missing Location header.`);
      }
      currentUrl = new URL(loc, safeUrl).toString();
      hop++;
      continue;
    }

    const contentType = (resp.headers.get('content-type') || 'text/html').toLowerCase();
    const reader = resp.body?.getReader();
    if (!reader) {
      return { response: resp, finalUrl: safeUrl.toString(), text: '', status: resp.status, contentType };
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_FETCH_BYTES) {
          chunks.push(value.subarray(0, Math.max(0, value.byteLength - (total - MAX_FETCH_BYTES))));
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }

    const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.byteLength, 0));
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(combined);
    return { response: resp, finalUrl: safeUrl.toString(), text, status: resp.status, contentType };
  }

  throw new Error('Too many redirects (limit 4).');
}

/* =========================================================
   HTML CLEANUP & TEXT EXTRACTION (NO RAW HTML EXECUTION)
   ========================================================= */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
};

function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : ' ';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : ' ';
    })
    .replace(/&([a-zA-Z]+);/g, (full, name) => NAMED_ENTITIES[name.toLowerCase()] ?? full);
}

function stripTags(raw: string): string {
  return decodeEntities(raw.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetaAttr(html: string, keyName: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${keyName}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${keyName}["'][^>]*>`,
    'i'
  );
  const m = html.match(re);
  return m ? decodeEntities((m[1] || m[2] || '').trim()) : '';
}

function parseStructuredPage(html: string, finalUrl: string): {
  title: string;
  description: string;
  siteName: string;
  headings: string[];
  paragraphs: string[];
  links: Array<{ text: string; url: string }>;
} {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');

  const titleMatch = cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogTitle = extractMetaAttr(cleaned, 'og:title');
  const title = stripTags(titleMatch?.[1] || '') || ogTitle || new URL(finalUrl).hostname;

  const description =
    extractMetaAttr(cleaned, 'description') ||
    extractMetaAttr(cleaned, 'og:description') ||
    extractMetaAttr(cleaned, 'twitter:description');

  const siteName = extractMetaAttr(cleaned, 'og:site_name') || new URL(finalUrl).hostname.replace(/^www\./, '');

  const headings: string[] = [];
  const headingSeen = new Set<string>();
  const hRe = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hRe.exec(cleaned)) !== null && headings.length < 14) {
    const txt = stripTags(hm[1]);
    if (txt.length >= 3 && txt.length <= 160 && !headingSeen.has(txt)) {
      headingSeen.add(txt);
      headings.push(txt);
    }
  }

  const paragraphs: string[] = [];
  const paraSeen = new Set<string>();
  const pRe = /<(?:p|li|blockquote)[^>]*>([\s\S]*?)<\/(?:p|li|blockquote)>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(cleaned)) !== null && paragraphs.length < 22) {
    const txt = stripTags(pm[1]);
    if (txt.length >= 28 && !paraSeen.has(txt)) {
      paraSeen.add(txt);
      paragraphs.push(txt.slice(0, 620));
    }
  }

  const links: Array<{ text: string; url: string }> = [];
  const linkSeen = new Set<string>();
  const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = aRe.exec(cleaned)) !== null && links.length < 18) {
    const rawHref = am[1].trim();
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) {
      continue;
    }
    try {
      const resolved = new URL(rawHref, finalUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
      const text = stripTags(am[2]).slice(0, 90);
      const hrefStr = resolved.toString();
      if (text.length >= 3 && !linkSeen.has(hrefStr)) {
        linkSeen.add(hrefStr);
        links.push({ text, url: hrefStr });
      }
    } catch {
      // Ignore malformed href
    }
  }

  return { title, description, siteName, headings, paragraphs, links };
}

interface SearchResultItem {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  source: 'Web' | 'Wikipedia';
}

function unwrapDdgHref(rawHref: string): string | null {
  try {
    const full = rawHref.startsWith('//') ? `https:${rawHref}` : rawHref;
    const u = new URL(full, 'https://html.duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    const target = uddg ? decodeURIComponent(uddg) : u.toString();
    const parsed = new URL(target);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.hostname.includes('duckduckgo.com')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/* =========================================================
   EXPRESS APP + REAL BACKEND ROUTES
   ========================================================= */
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'DomainTechHub Full-Stack Server', time: new Date().toISOString() });
  });

  app.get('/api/browse', async (req: Request, res: Response) => {
    const raw = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!raw || raw.length > 2048) {
      res.status(400).json({ ok: false, error: 'Provide a valid http(s) URL.' });
      return;
    }

    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const started = Date.now();
    try {
      const { finalUrl, text, status, contentType } = await fetchPublicWithRedirects(withScheme);
      const latencyMs = Date.now() - started;
      const u = new URL(finalUrl);
      const domain = u.hostname.replace(/^www\./, '');

      if (contentType.includes('application/json')) {
        let pretty = text.slice(0, 4000);
        try {
          pretty = JSON.stringify(JSON.parse(text), null, 2).slice(0, 4000);
        } catch {
          // Keep raw snippet
        }
        res.json({
          ok: true,
          url: withScheme,
          finalUrl,
          domain,
          status,
          latencyMs,
          contentType: 'application/json',
          title: `JSON Feed · ${domain}`,
          description: `Live JSON response (${text.length} bytes) from ${finalUrl}`,
          siteName: domain,
          headings: [u.pathname || '/'],
          paragraphs: pretty.split('\n').slice(0, 20),
          links: [],
        });
        return;
      }

      if (contentType.startsWith('text/plain')) {
        const lines = text
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 24);
        res.json({
          ok: true,
          url: withScheme,
          finalUrl,
          domain,
          status,
          latencyMs,
          contentType: 'text/plain',
          title: `${domain}${u.pathname}`,
          description: `Plaintext response from ${domain}`,
          siteName: domain,
          headings: [domain],
          paragraphs: lines,
          links: [],
        });
        return;
      }

      const parsed = parseStructuredPage(text, finalUrl);
      res.json({
        ok: true,
        url: withScheme,
        finalUrl,
        domain,
        status,
        latencyMs,
        contentType: 'text/html',
        title: parsed.title,
        description: parsed.description,
        siteName: parsed.siteName,
        headings: parsed.headings,
        paragraphs: parsed.paragraphs,
        links: parsed.links,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load remote webpage.';
      res.status(400).json({ ok: false, error: message });
    }
  });

  app.get('/api/search', async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query || query.length > 180) {
      res.status(400).json({ ok: false, error: 'Search query must be 1–180 characters.' });
      return;
    }

    const started = Date.now();
    const results: SearchResultItem[] = [];
    const seenUrls = new Set<string>();
    let instantAbstract = '';
    let instantSource = '';
    let instantUrl = '';

    const ddgPromise = fetchPublicWithRedirects(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      'text/html'
    ).then(({ text }) => {
      const blockRe =
        /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]{0,900}?(?:<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>|<div[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>)/gi;
      let m: RegExpExecArray | null;
      while ((m = blockRe.exec(text)) !== null && results.length < 10) {
        const resolved = unwrapDdgHref(m[1]);
        if (!resolved || seenUrls.has(resolved)) continue;
        const title = stripTags(m[2]);
        const snippet = stripTags(m[3] || m[4] || '');
        if (!title) continue;
        seenUrls.add(resolved);
        results.push({
          title,
          url: resolved,
          domain: new URL(resolved).hostname.replace(/^www\./, ''),
          snippet: snippet || `Result on ${new URL(resolved).hostname}`,
          source: 'Web',
        });
      }
    });

    const wikiPromise = fetchPublicWithRedirects(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5&utf8=1`,
      'application/json'
    ).then(({ text }) => {
      const json = JSON.parse(text) as {
        query?: { search?: Array<{ title: string; snippet: string }> };
      };
      for (const item of json.query?.search || []) {
        const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
        if (seenUrls.has(pageUrl)) continue;
        seenUrls.add(pageUrl);
        results.push({
          title: `${item.title} — Wikipedia`,
          url: pageUrl,
          domain: 'en.wikipedia.org',
          snippet: stripTags(item.snippet),
          source: 'Wikipedia',
        });
      }
    });

    const instantPromise = fetchPublicWithRedirects(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      'application/json'
    ).then(({ text }) => {
      const json = JSON.parse(text) as {
        AbstractText?: string;
        AbstractSource?: string;
        AbstractURL?: string;
      };
      if (json.AbstractText) {
        instantAbstract = json.AbstractText;
        instantSource = json.AbstractSource || '';
        instantUrl = json.AbstractURL || '';
      }
    });

    await Promise.allSettled([ddgPromise, wikiPromise, instantPromise]);

    res.json({
      ok: true,
      query,
      latencyMs: Date.now() - started,
      instantAbstract,
      instantSource,
      instantUrl,
      results: results.slice(0, 12),
    });
  });

  app.get('/api/nairobi-live', async (_req: Request, res: Response) => {
    const now = new Date();
    const nairobiParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Nairobi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).formatToParts(now);

    const getPart = (type: string) => nairobiParts.find((p) => p.type === type)?.value || '';
    const hour = Number(getPart('hour')) || 0;
    const minute = Number(getPart('minute')) || 0;
    const minutesOfDay = hour * 60 + minute;
    const timeText = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const dateLabel = `${getPart('weekday')}, ${getPart('day')} ${getPart('month')}`;

    let temperatureC: number | null = null;
    let windKmh: number | null = null;
    let humidityPct: number | null = null;
    let precipitationMm = 0;
    let cloudCoverPct: number | null = null;
    let weatherCode: number | null = null;
    let condition: 'clear' | 'overcast' | 'rain' | 'storm' = 'clear';
    let summary = 'Nairobi EAT';

    try {
      const { text } = await fetchPublicWithRedirects(
        'https://api.open-meteo.com/v1/forecast?latitude=-1.286389&longitude=36.817223&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m&timezone=Africa%2FNairobi',
        'application/json'
      );
      const data = JSON.parse(text) as {
        current?: {
          temperature_2m?: number;
          relative_humidity_2m?: number;
          precipitation?: number;
          weather_code?: number;
          cloud_cover?: number;
          wind_speed_10m?: number;
        };
      };
      const cur = data.current;
      if (cur) {
        temperatureC = typeof cur.temperature_2m === 'number' ? Math.round(cur.temperature_2m * 10) / 10 : null;
        humidityPct = typeof cur.relative_humidity_2m === 'number' ? Math.round(cur.relative_humidity_2m) : null;
        windKmh = typeof cur.wind_speed_10m === 'number' ? Math.round(cur.wind_speed_10m) : null;
        precipitationMm = typeof cur.precipitation === 'number' ? cur.precipitation : 0;
        cloudCoverPct = typeof cur.cloud_cover === 'number' ? Math.round(cur.cloud_cover) : null;
        weatherCode = typeof cur.weather_code === 'number' ? cur.weather_code : null;

        if (weatherCode !== null) {
          if (weatherCode >= 95) {
            condition = 'storm';
            summary = 'Thunderstorm';
          } else if (
            (weatherCode >= 51 && weatherCode <= 67) ||
            (weatherCode >= 80 && weatherCode <= 82) ||
            precipitationMm > 0.2
          ) {
            condition = 'rain';
            summary = 'Rain Showers';
          } else if (weatherCode === 2 || weatherCode === 3 || weatherCode === 45 || weatherCode === 48 || (cloudCoverPct ?? 0) >= 60) {
            condition = 'overcast';
            summary = weatherCode === 45 || weatherCode === 48 ? 'Mist & Clouds' : 'Mostly Cloudy';
          } else {
            condition = 'clear';
            summary = weatherCode === 1 ? 'Mostly Clear' : 'Clear Sky';
          }
        }
      }
    } catch {
      // Weather fetch failed; return accurate Nairobi clock cleanly without failing endpoint
    }

    res.json({
      ok: true,
      city: 'Nairobi, Kenya',
      timezone: 'Africa/Nairobi',
      minutesOfDay,
      timeText,
      dateLabel,
      temperatureC,
      windKmh,
      humidityPct,
      precipitationMm,
      cloudCoverPct,
      condition,
      summary,
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DomainTechHub full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
