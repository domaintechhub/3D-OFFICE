import type dns from 'node:dns';
import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';

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
   SSRF, DNS-REBINDING & INPUT HARDENING UTILITIES
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

function parseIpv6Groups(raw: string): number[] | null {
  let ip = raw.trim().toLowerCase();
  const zoneIdx = ip.indexOf('%');
  if (zoneIdx !== -1) ip = ip.slice(0, zoneIdx);
  if (!net.isIPv6(ip)) return null;

  const lastColon = ip.lastIndexOf(':');
  if (lastColon !== -1 && ip.slice(lastColon + 1).includes('.')) {
    const octets = ip.slice(lastColon + 1).split('.').map(Number);
    if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return null;
    }
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    ip = `${ip.slice(0, lastColon)}:${hi}:${lo}`;
  }

  const parts = ip.split('::');
  if (parts.length > 2) return null;
  const left = parts[0] ? parts[0].split(':').filter(Boolean) : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(':').filter(Boolean) : [];
  const missing = 8 - (left.length + right.length);
  if ((parts.length === 1 && left.length !== 8) || (parts.length === 2 && missing < 0)) {
    return null;
  }
  const full = parts.length === 2 ? [...left, ...Array<string>(missing).fill('0'), ...right] : left;
  if (full.length !== 8) return null;
  const nums = full.map((g) => Number.parseInt(g, 16));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;
  return nums;
}

function groupsToIpv4(hi: number, lo: number): string {
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isPrivateOrUnsafeIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const zoneIdx = ip.indexOf('%');
  const cleanIp = zoneIdx !== -1 ? ip.slice(0, zoneIdx) : ip;
  if (zoneIdx !== -1) return true; // block any scoped/zone-qualified addresses

  if (net.isIPv4(cleanIp)) return isPrivateIpv4(cleanIp);

  const g = parseIpv6Groups(cleanIp);
  if (!g) return true;

  // ::/128 (unspecified) and ::1/128 (loopback)
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    if (g[6] === 0 && (g[7] === 0 || g[7] === 1)) return true;
    // ::/96 IPv4-compatible IPv6
    return isPrivateIpv4(groupsToIpv4(g[6], g[7]));
  }
  // ::ffff:0:0/96 IPv4-mapped IPv6 (both dotted and hex forms)
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
    return isPrivateIpv4(groupsToIpv4(g[6], g[7]));
  }
  // 64:ff9b::/96 & 64:ff9b:1::/48 (NAT64)
  if (g[0] === 0x0064 && g[1] === 0xff9b) return true;
  // 100::/64 (discard)
  if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true;
  // 2001::/32 (Teredo) & 2001:2::/48 & 2001:db8::/32
  if (g[0] === 0x2001 && (g[1] === 0 || g[1] === 2 || g[1] === 0x0db8)) return true;
  // 2002::/16 (6to4 tunneling)
  if (g[0] === 0x2002) {
    return isPrivateIpv4(groupsToIpv4(g[1], g[2]));
  }
  // fc00::/7 (ULA), fe80::/10 (link-local), fec0::/10 (site-local), ff00::/8 (multicast)
  if ((g[0] & 0xfe00) === 0xfc00) return true;
  if ((g[0] & 0xffc0) === 0xfe80) return true;
  if ((g[0] & 0xffc0) === 0xfec0) return true;
  if ((g[0] & 0xff00) === 0xff00) return true;

  return false;
}

interface ResolvedPublicTarget {
  parsed: URL;
  pinnedAddress: string;
  pinnedFamily: 4 | 6;
}

async function assertSafePublicUrl(rawUrl: string): Promise<ResolvedPublicTarget> {
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
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new Error('Only standard HTTP (80) and HTTPS (443) ports are allowed.');
  }

  const rawHost = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  const host = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost;
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home') ||
    host.endsWith('.arpa')
  ) {
    throw new Error('Private or local hostnames are blocked.');
  }

  const ipType = net.isIP(host);
  if (ipType !== 0) {
    if (isPrivateOrUnsafeIp(host)) {
      throw new Error('Direct private or loopback IP access is blocked.');
    }
    return { parsed, pinnedAddress: host, pinnedFamily: ipType === 6 ? 6 : 4 };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dnsLookup(host, { all: true });
  } catch {
    throw new Error('Could not resolve remote host.');
  }
  if (!records || records.length === 0) {
    throw new Error('Could not resolve remote host.');
  }
  for (const rec of records) {
    if (isPrivateOrUnsafeIp(rec.address)) {
      throw new Error('Host resolved to a blocked private network address.');
    }
  }
  const primary = records[0];
  return {
    parsed,
    pinnedAddress: primary.address,
    pinnedFamily: primary.family === 6 ? 6 : 4,
  };
}

function requestPinnedPublic(
  target: ResolvedPublicTarget,
  accept: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; text: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const isHttps = target.parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const customLookup = ((
      _hostname: string,
      options: dns.LookupOptions | ((err: NodeJS.ErrnoException | null, address: string, family: number) => void),
      callback?: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
    ) => {
      if (typeof options === 'function') {
        options(null, target.pinnedAddress, target.pinnedFamily);
        return;
      }
      if (callback) {
        if ((options as dns.LookupAllOptions)?.all) {
          callback(null, [{ address: target.pinnedAddress, family: target.pinnedFamily }]);
        } else {
          callback(null, target.pinnedAddress, target.pinnedFamily);
        }
      }
    }) as unknown as NonNullable<http.RequestOptions['lookup']>;

    let settled = false;
    const finishErr = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const req = transport.request(
      target.parsed,
      {
        method: 'GET',
        lookup: customLookup,
        timeout: FETCH_TIMEOUT_MS,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: accept,
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers['content-type'] || 'text/html').toLowerCase();

        if (status >= 300 && status < 400) {
          res.resume();
          if (!settled) {
            settled = true;
            resolve({ status, headers: res.headers, text: '', contentType });
          }
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.byteLength;
          if (total <= MAX_FETCH_BYTES) {
            chunks.push(chunk);
          } else {
            const keep = chunk.byteLength - (total - MAX_FETCH_BYTES);
            if (keep > 0) chunks.push(chunk.subarray(0, keep));
            res.destroy();
          }
        });
        res.on('end', () => {
          if (settled) return;
          settled = true;
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status, headers: res.headers, text, contentType });
        });
        res.on('close', () => {
          if (settled) return;
          settled = true;
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status, headers: res.headers, text, contentType });
        });
        res.on('error', () => finishErr(new Error('Failed while reading remote response.')));
      }
    );

    req.on('timeout', () => {
      req.destroy();
      finishErr(new Error('Remote request timed out.'));
    });
    req.on('error', () => finishErr(new Error('Unable to connect to remote host.')));
    req.end();
  });
}

async function fetchPublicWithRedirects(
  initialUrl: string,
  accept = 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
): Promise<{ finalUrl: string; text: string; status: number; contentType: string }> {
  let currentUrl = initialUrl;
  let hop = 0;

  while (hop <= 4) {
    const target = await assertSafePublicUrl(currentUrl);
    const { status, headers, text, contentType } = await requestPinnedPublic(target, accept);

    if (status >= 300 && status < 400) {
      const loc = typeof headers.location === 'string' ? headers.location : '';
      if (!loc) {
        throw new Error(`Redirect (${status}) missing Location header.`);
      }
      currentUrl = new URL(loc, target.parsed).toString();
      hop++;
      continue;
    }

    return { finalUrl: target.parsed.toString(), text, status, contentType };
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
   RATE LIMITING & EXPRESS APP
   ========================================================= */
function createRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    if (hits.size > 2000) {
      for (const [k, v] of hits.entries()) {
        if (v.resetAt <= now) hits.delete(k);
      }
      if (hits.size > 2000) hits.clear();
    }
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (entry.count >= maxRequests) {
      res.status(429).json({ ok: false, error: 'Too many requests. Please wait a moment.' });
      return;
    }
    entry.count += 1;
    next();
  };
}

function isAllowedTextContentType(contentType: string): boolean {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/xhtml+xml' ||
    mime.endsWith('+json') ||
    mime.endsWith('+xml')
  );
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  const apiBrowseLimiter = createRateLimiter(30, 60_000);
  const apiLiveLimiter = createRateLimiter(60, 60_000);

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'DomainTechHub Full-Stack Server', time: new Date().toISOString() });
  });

  app.get('/api/browse', apiBrowseLimiter, async (req: Request, res: Response) => {
    const raw = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!raw || raw.length > 2048) {
      res.status(400).json({ ok: false, error: 'Provide a valid http(s) URL.' });
      return;
    }

    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const started = Date.now();
    try {
      const { finalUrl, text, status, contentType } = await fetchPublicWithRedirects(withScheme);
      if (!isAllowedTextContentType(contentType)) {
        res.status(415).json({ ok: false, error: 'Only HTML, JSON, and text webpages are supported.' });
        return;
      }
      const latencyMs = Date.now() - started;
      const u = new URL(finalUrl);
      const domain = u.hostname.replace(/^www\./, '');

      if (contentType.includes('application/json') || contentType.includes('+json')) {
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

  app.get('/api/search', apiBrowseLimiter, async (req: Request, res: Response) => {
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

  app.get('/api/nairobi-live', apiLiveLimiter, async (_req: Request, res: Response) => {
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
