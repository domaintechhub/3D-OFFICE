import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  Check,
  Code2,
  ExternalLink,
  FolderGit2,
  Globe,
  Layout,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Table2,
  Terminal,
  Wifi,
  X,
} from 'lucide-react';
import type { InspectedMonitor } from '../scene/constants';
import { DISTRICT_BUILDINGS, type BuildingId } from '../scene/districtData';
import { setLiveBrowserOverride } from '../scene/screens';
import {
  DISTRICT_SOCIAL_DIRECTORY,
  socialNetwork,
  type JobPriority,
  type SocialPlatformId,
} from '../scene/socialNetwork';
import {
  getModeForDesk,
  getWorkstationProfile,
  type BrowserSession,
  type WorkstationMode,
} from '../scene/workstations';
import { browseOfflineUrl, searchOfflineWeb } from '../data/offlineWeb';
import { isOfflineMode, isStandaloneMode } from '../utils/standalone';

interface BrowsePageData {
  ok: boolean;
  url: string;
  finalUrl: string;
  domain: string;
  status: number;
  latencyMs: number;
  contentType: string;
  title: string;
  description: string;
  siteName: string;
  headings: string[];
  paragraphs: string[];
  links: Array<{ text: string; url: string }>;
  error?: string;
}

interface SearchResultItem {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  source: string;
}

interface SearchPageData {
  ok: boolean;
  query: string;
  latencyMs: number;
  instantAbstract: string;
  instantSource: string;
  instantUrl: string;
  results: SearchResultItem[];
  error?: string;
}

type BrowserHistoryEntry =
  | { kind: 'browse'; data: BrowsePageData; inputLabel: string }
  | { kind: 'search'; data: SearchPageData; inputLabel: string };

const QUICK_REAL_BOOKMARKS: Array<{ label: string; url: string }> = [
  { label: 'Wikipedia · Nairobi', url: 'https://en.wikipedia.org/wiki/Nairobi' },
  { label: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/API' },
  { label: 'Hacker News', url: 'https://news.ycombinator.com/' },
];

function looksLikeUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return true;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#]|$)/i.test(s);
}

interface WorkstationInspectorProps {
  monitor: InspectedMonitor;
  onClose: () => void;
  getInspectedScreenCanvas: () => HTMLCanvasElement | null;
  onNotifyCompanyJob?: (buildingId: BuildingId) => void;
  onForceRedrawMonitor?: () => void;
}

export const WorkstationInspector: React.FC<WorkstationInspectorProps> = ({
  monitor,
  onClose,
  getInspectedScreenCanvas,
  onNotifyCompanyJob,
  onForceRedrawMonitor,
}) => {
  const profile = useMemo(() => getWorkstationProfile(monitor.stationKey), [monitor.stationKey]);
  const defaultMode = useMemo(
    () => getModeForDesk(monitor.stationKey, monitor.seatIndex),
    [monitor.stationKey, monitor.seatIndex]
  );

  const [activeMode, setActiveMode] = useState<WorkstationMode>(defaultMode);
  const [autoPilot, setAutoPilot] = useState(true);
  const [tick, setTick] = useState(0);
  const [, setSocialVer] = useState(0);

  // Per-station persistent data-entry rows & real web browser navigation state
  const [rowsMap, setRowsMap] = useState<Record<string, Array<[string, string, string, string]>>>({});
  const [queueIdxMap, setQueueIdxMap] = useState<Record<string, number>>({});
  const [deliverablesMap, setDeliverablesMap] = useState<Record<string, boolean[]>>({});
  const [browserTabIdx, setBrowserTabIdx] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [liveHistory, setLiveHistory] = useState<BrowserHistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [newRow, setNewRow] = useState<[string, string, string, string]>(['', '', '', '']);
  const [justSaved, setJustSaved] = useState(false);

  // Inline Monitor Social Job Dispatch state
  const [monTargetBuilding, setMonTargetBuilding] = useState<BuildingId>(
    monitor.buildingId === 'hub' ? 'bank' : 'hub'
  );
  const [monPlatform, setMonPlatform] = useState<SocialPlatformId>('worklink');
  const [monPriority, setMonPriority] = useState<JobPriority>('Normal');
  const [monJobTitle, setMonJobTitle] = useState('');

  const screenMirrorRef = useRef<HTMLCanvasElement | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const autoFetchedStationRef = useRef<string>('');
  const isStandalone = isStandaloneMode();
  const offlineActive = isStandalone || isOfflineMode();

  useEffect(() => socialNetwork.subscribe(() => setSocialVer((v) => v + 1)), []);

  // Reset browser & draft state when switching to a different monitor
  useEffect(() => {
    fetchAbortRef.current?.abort();
    setActiveMode(defaultMode);
    setAutoPilot(true);
    setBrowserTabIdx(0);
    setLiveHistory([]);
    setHistoryIdx(-1);
    setBrowseLoading(false);
    setBrowseError(null);
    setSearchInput('');
    setNewRow(['', '', '', '']);
    setJustSaved(false);
    setMonTargetBuilding(monitor.buildingId === 'hub' ? 'bank' : 'hub');
    setMonJobTitle('');
    autoFetchedStationRef.current = '';
  }, [monitor.id, monitor.buildingId, defaultMode]);

  useEffect(() => () => fetchAbortRef.current?.abort(), []);

  // Initialize station rows & deliverables once per station id
  useEffect(() => {
    setRowsMap((prev) => {
      if (prev[monitor.id]) return prev;
      return { ...prev, [monitor.id]: [...profile.dataEntry.initialRows] };
    });
    setDeliverablesMap((prev) => {
      if (prev[monitor.id]) return prev;
      return { ...prev, [monitor.id]: profile.projectWork.deliverables.map((d) => d.done) };
    });
  }, [monitor.id, profile]);

  // 100ms ticker drives live typing, research scrolling, and 3D canvas mirror
  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      const dst = screenMirrorRef.current;
      const src = getInspectedScreenCanvas();
      if (dst && src) {
        const ctx = dst.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, dst.width, dst.height);
          ctx.drawImage(src, 0, 0, dst.width, dst.height);
        }
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [monitor.id, getInspectedScreenCanvas]);

  // Live worker auto-commits a new data-entry record every 6.5 seconds while occupied & in Auto-Pilot
  const committedCycleRef = useRef<string>('');
  const currentQueueIdx = queueIdxMap[monitor.id] ?? 0;
  const draftRecord =
    profile.dataEntry.incomingQueue[currentQueueIdx % profile.dataEntry.incomingQueue.length];
  const entryCycle = Math.floor(tick / 65);
  const entrySubTick = tick % 65; // 6.5 seconds per record

  useEffect(() => {
    if (activeMode !== 'dataEntry' || !autoPilot || !monitor.isOccupied) return;
    if (entrySubTick < 64) return;
    const cycleKey = `${monitor.id}:${entryCycle}`;
    if (committedCycleRef.current === cycleKey) return;
    committedCycleRef.current = cycleKey;

    const qIdx = queueIdxMap[monitor.id] ?? 0;
    const rec = profile.dataEntry.incomingQueue[qIdx % profile.dataEntry.incomingQueue.length];
    setRowsMap((prev) => {
      const existing = prev[monitor.id] ?? profile.dataEntry.initialRows;
      return { ...prev, [monitor.id]: [rec, ...existing].slice(0, 12) };
    });
    setQueueIdxMap((prev) => ({ ...prev, [monitor.id]: (prev[monitor.id] ?? 0) + 1 }));
    setJustSaved(true);
  }, [activeMode, entrySubTick, entryCycle, autoPilot, monitor.isOccupied, monitor.id, profile, queueIdxMap]);

  useEffect(() => {
    if (!justSaved) return;
    const clearTimer = window.setTimeout(() => setJustSaved(false), 1200);
    return () => window.clearTimeout(clearTimer);
  }, [justSaved]);

  const rows = rowsMap[monitor.id] ?? profile.dataEntry.initialRows;
  const deliverablesDone =
    deliverablesMap[monitor.id] ?? profile.projectWork.deliverables.map((d) => d.done);

  const sessions = profile.browserSessions;
  const activeHistoryEntry =
    historyIdx >= 0 && historyIdx < liveHistory.length ? liveHistory[historyIdx] : null;
  const activeBrowserSession = sessions[browserTabIdx % sessions.length];

  const syncLiveSessionTo3dMonitor = (session: BrowserSession) => {
    setLiveBrowserOverride(monitor.stationKey, session);
    onForceRedrawMonitor?.();
  };

  const syncHistoryEntryTo3dMonitor = (entry: BrowserHistoryEntry) => {
    if (entry.kind === 'browse') {
      const json = entry.data;
      syncLiveSessionTo3dMonitor({
        tabTitle: json.title.slice(0, 28) || json.domain,
        url: json.finalUrl,
        searchQuery: json.finalUrl,
        articleTitle: json.title || json.domain,
        articleDomain: `${json.domain} · HTTP ${json.status} (${json.latencyMs}ms)`,
        sections: [
          {
            heading: json.headings[0] || json.siteName || json.domain,
            excerpt: json.description || json.paragraphs[0] || 'Loaded live page content.',
            highlight: json.headings.slice(0, 3).join(' · ') || `${json.links.length} links extracted`,
          },
          ...json.paragraphs.slice(0, 2).map((p, i) => ({
            heading: json.headings[i + 1] || `Section ${i + 2}`,
            excerpt: p,
            highlight: json.finalUrl,
          })),
        ],
        researchNote: `Live page loaded (${json.latencyMs}ms) for ${monitor.zone}.`,
      });
    } else {
      const json = entry.data;
      syncLiveSessionTo3dMonitor({
        tabTitle: `Search: ${json.query.slice(0, 20)}`,
        url: `search://${encodeURIComponent(json.query)}`,
        searchQuery: json.query,
        articleTitle: `${json.query} — Live Web Search (${json.results.length} results)`,
        articleDomain: `Web & Wikipedia · ${json.latencyMs}ms`,
        sections: json.results.slice(0, 3).map((r) => ({
          heading: `${r.domain} · ${r.title}`,
          excerpt: r.snippet || r.url,
          highlight: r.url,
        })),
        researchNote: json.instantAbstract || `Live web search executed in ${json.latencyMs}ms.`,
      });
    }
  };

  const pushHistory = (entry: BrowserHistoryEntry) => {
    setLiveHistory((prev) => {
      const head = prev.slice(0, historyIdx + 1);
      const next = [...head, entry];
      setHistoryIdx(next.length - 1);
      return next;
    });
  };

  const decodeTextEntities = (raw: string): string =>
    raw
      .replace(/&#(\d+);/g, (_, n) => {
        const code = Number(n);
        return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : ' ';
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        const code = Number.parseInt(hex, 16);
        return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : ' ';
      })
      .replace(/&(quot|amp|apos|lt|gt|nbsp);/gi, (_, ent: string) => {
        const k = ent.toLowerCase();
        if (k === 'quot') return '"';
        if (k === 'amp') return '&';
        if (k === 'apos') return "'";
        if (k === 'lt') return '<';
        if (k === 'gt') return '>';
        return ' ';
      });

  const browseLiveUrl = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.length > 2048) {
      setBrowseError('Enter a valid http(s) URL (max 2048 characters).');
      return;
    }
    const hasExplicitScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
    const normalized = hasExplicitScheme ? trimmed : `https://${trimmed}`;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalized);
    } catch {
      setBrowseError('Invalid URL format.');
      return;
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      setBrowseError('Only http:// and https:// URLs are permitted.');
      return;
    }
    const safeNormalized = parsedUrl.toString();

    if (offlineActive) {
      setAutoPilot(false);
      setSearchInput(safeNormalized);
      setBrowseLoading(false);
      setBrowseError(null);
      const offlinePage = browseOfflineUrl(safeNormalized);
      const data: BrowsePageData = {
        ok: true,
        url: safeNormalized,
        finalUrl: offlinePage.finalUrl,
        domain: `${offlinePage.domain} (Offline mode)`,
        status: 200,
        latencyMs: 1,
        contentType: 'text/html',
        title: offlinePage.title,
        description: offlinePage.excerpt,
        siteName: offlinePage.domain,
        headings: offlinePage.headings,
        paragraphs: offlinePage.paragraphs,
        links: offlinePage.links,
      };
      const entry: BrowserHistoryEntry = { kind: 'browse', data, inputLabel: data.finalUrl };
      pushHistory(entry);
      setSearchInput(data.finalUrl);
      syncHistoryEntryTo3dMonitor(entry);
      return;
    }

    fetchAbortRef.current?.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;
    setBrowseLoading(true);
    setBrowseError(null);
    setAutoPilot(false);
    setSearchInput(safeNormalized);

    try {
      const resp = await fetch(`/api/browse?url=${encodeURIComponent(safeNormalized)}`, {
        signal: ac.signal,
      });
      const isJson = (resp.headers.get('content-type') || '').includes('application/json');
      if (!isJson) {
        const offlinePage = browseOfflineUrl(safeNormalized);
        const fallbackEntry: BrowserHistoryEntry = {
          kind: 'browse',
          data: {
            ok: true,
            url: safeNormalized,
            finalUrl: offlinePage.finalUrl,
            domain: `${offlinePage.domain} (Offline mode)`,
            status: 200,
            latencyMs: 1,
            contentType: 'text/html',
            title: offlinePage.title,
            description: offlinePage.excerpt,
            siteName: offlinePage.domain,
            headings: offlinePage.headings,
            paragraphs: offlinePage.paragraphs,
            links: offlinePage.links,
          },
          inputLabel: offlinePage.finalUrl,
        };
        pushHistory(fallbackEntry);
        syncHistoryEntryTo3dMonitor(fallbackEntry);
        return;
      }
      const json = (await resp.json()) as BrowsePageData;
      if (!resp.ok || !json.ok) {
        setBrowseError(json.error || `HTTP ${resp.status} while loading ${safeNormalized}`);
        return;
      }
      const entry: BrowserHistoryEntry = { kind: 'browse', data: json, inputLabel: json.finalUrl };
      pushHistory(entry);
      setSearchInput(json.finalUrl);
      syncHistoryEntryTo3dMonitor(entry);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setBrowseError(err instanceof Error ? err.message : 'Unable to reach live URL.');
    } finally {
      if (fetchAbortRef.current === ac) {
        setBrowseLoading(false);
      }
    }
  };

  const searchLiveWeb = async (rawQuery: string) => {
    const q = rawQuery.trim().slice(0, 180);
    if (!q) return;

    if (offlineActive) {
      setBrowseLoading(false);
      setBrowseError(null);
      setAutoPilot(false);
      setSearchInput(q);
      const offlineHits = searchOfflineWeb(q);
      const offlineSearch: SearchPageData = {
        ok: true,
        query: q,
        latencyMs: 1,
        instantAbstract: offlineHits[0]?.snippet || 'Offline mode local district index active.',
        instantSource: 'Offline Mode Index',
        instantUrl: offlineHits[0]?.url || '',
        results: offlineHits.map((hit) => ({
          title: hit.title,
          url: hit.url,
          domain: hit.domain,
          snippet: hit.snippet,
          source: 'Offline Archive',
        })),
      };
      const entry: BrowserHistoryEntry = { kind: 'search', data: offlineSearch, inputLabel: q };
      pushHistory(entry);
      syncHistoryEntryTo3dMonitor(entry);
      return;
    }

    fetchAbortRef.current?.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;
    setBrowseLoading(true);
    setBrowseError(null);
    setAutoPilot(false);
    setSearchInput(q);
    const started = performance.now();

    try {
      let json: SearchPageData | null = null;
      try {
        const resp = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ac.signal });
        if (resp.ok && (resp.headers.get('content-type') || '').includes('application/json')) {
          const parsed = (await resp.json()) as SearchPageData;
          if (parsed.ok) json = parsed;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
      }

      if (!json) {
        const wikiResp = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=8&utf8=1&origin=*`,
          { signal: ac.signal }
        );
        if (!wikiResp.ok) {
          setBrowseError(`Wikipedia search failed (HTTP ${wikiResp.status}).`);
          return;
        }
        const wikiJson = (await wikiResp.json()) as {
          query?: { search?: Array<{ title: string; snippet: string }> };
        };
        const results: SearchResultItem[] = (wikiJson.query?.search || []).map((item) => ({
          title: `${item.title} — Wikipedia`,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
          domain: 'en.wikipedia.org',
          snippet: decodeTextEntities(item.snippet.replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim(),
          source: 'Wikipedia',
        }));
        json = {
          ok: true,
          query: q,
          latencyMs: Math.round(performance.now() - started),
          instantAbstract: results[0]?.snippet || '',
          instantSource: 'Wikipedia',
          instantUrl: results[0]?.url || '',
          results,
        };
      }

      const entry: BrowserHistoryEntry = { kind: 'search', data: json, inputLabel: q };
      pushHistory(entry);
      syncHistoryEntryTo3dMonitor(entry);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const offlineHits = searchOfflineWeb(q);
      const fallbackSearch: SearchPageData = {
        ok: true,
        query: q,
        latencyMs: 1,
        instantAbstract: offlineHits[0]?.snippet || '',
        instantSource: 'Offline Mode Fallback',
        instantUrl: offlineHits[0]?.url || '',
        results: offlineHits.map((hit) => ({
          title: hit.title,
          url: hit.url,
          domain: hit.domain,
          snippet: hit.snippet,
          source: 'Offline Fallback',
        })),
      };
      const entry: BrowserHistoryEntry = { kind: 'search', data: fallbackSearch, inputLabel: q };
      pushHistory(entry);
      syncHistoryEntryTo3dMonitor(entry);
      setBrowseError('Live network unavailable — showing offline mode results.');
    } finally {
      if (fetchAbortRef.current === ac) {
        setBrowseLoading(false);
      }
    }
  };

  // Fetch starter URL live automatically when opening the Browser tab (online server mode only)
  useEffect(() => {
    if (activeMode !== 'browser' || offlineActive) return;
    if (liveHistory.length > 0 || browseLoading) return;
    const starterUrl = sessions[browserTabIdx % sessions.length]?.url;
    if (!starterUrl || autoFetchedStationRef.current === `${monitor.id}:${starterUrl}`) return;
    autoFetchedStationRef.current = `${monitor.id}:${starterUrl}`;
    void browseLiveUrl(starterUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode, monitor.id, offlineActive]);

  // Live typing calculation for Data Entry active draft row
  const draftCharsTotal = draftRecord.reduce((s, cell) => s + cell.length + 2, 0);
  const typedDraftCells = useMemo(() => {
    if (!autoPilot || !monitor.isOccupied) return null;
    let rem = Math.min(draftCharsTotal, Math.floor(entrySubTick * 1.4));
    return draftRecord.map((val) => {
      const slice = val.slice(0, Math.max(0, rem));
      const active = rem >= 0 && rem <= val.length;
      rem -= val.length + 2;
      return { slice, active };
    });
  }, [autoPilot, monitor.isOccupied, draftRecord, draftCharsTotal, entrySubTick]);

  // Live typing lines for Project Work code/document editor
  const totalCodeChars = useMemo(
    () => profile.projectWork.codeLines.reduce((acc, ln) => acc + ln.length + 1, 0),
    [profile]
  );
  const shownCodeLines = useMemo(() => {
    if (!autoPilot || !monitor.isOccupied) return profile.projectWork.codeLines;
    const cycleChars = totalCodeChars + 60;
    let rem = (tick * 3) % cycleChars;
    const out: string[] = [];
    for (const line of profile.projectWork.codeLines) {
      if (rem >= line.length + 1) {
        out.push(line);
        rem -= line.length + 1;
      } else {
        out.push(line.slice(0, Math.max(0, rem)));
        break;
      }
    }
    return out;
  }, [autoPilot, monitor.isOccupied, profile, totalCodeChars, tick]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    if (looksLikeUrl(q)) {
      void browseLiveUrl(q);
    } else {
      void searchLiveWeb(q);
    }
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRow[0].trim()) return;
    const entry: [string, string, string, string] = [
      newRow[0].trim(),
      newRow[1].trim() || monitor.zone,
      newRow[2].trim() || 'Now',
      newRow[3].trim() || '▲ Logged',
    ];
    setRowsMap((prev) => ({
      ...prev,
      [monitor.id]: [entry, ...(prev[monitor.id] ?? profile.dataEntry.initialRows)].slice(0, 14),
    }));
    setNewRow(['', '', '', '']);
    setJustSaved(true);
  };

  return (
    <aside
      role="region"
      aria-label={`Workstation Inspector: ${monitor.role}`}
      className="pointer-events-auto fixed top-16 right-3 sm:right-4 w-[min(94vw,470px)] max-h-[calc(var(--vvh,100dvh)-11.5rem)] flex flex-col border border-white/15 bg-[#0d121a]/96 rounded-md shadow-2xl overflow-hidden"
    >
      {/* OS Window Title Bar */}
      <div className="shrink-0 px-3.5 py-2.5 border-b border-white/10 bg-[#121923]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                style={{ backgroundColor: monitor.color }}
              />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400">
                {monitor.levelLabel} · {monitor.zone}
              </span>
            </div>
            <h2 className="mt-0.5 text-sm font-semibold text-white tracking-tight truncate">
              {monitor.role}
            </h2>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-300 truncate">
              <FolderGit2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="font-medium text-sky-200 truncate">{profile.projectTitle}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 truncate">{profile.clientName}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              aria-pressed={autoPilot}
              onClick={() => setAutoPilot((v) => !v)}
              title={autoPilot ? 'Pause live worker auto-pilot' : 'Resume live worker auto-pilot'}
              aria-label={autoPilot ? 'Pause live worker auto-pilot' : 'Resume live worker auto-pilot'}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border transition-colors cursor-pointer ${
                autoPilot
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-white/15 bg-white/5 text-slate-300 hover:text-white'
              }`}
            >
              {autoPilot ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{autoPilot ? 'Live Auto' : 'Manual'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Workstation Inspector"
              className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live operator badge */}
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                monitor.isOccupied ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            <span className="font-medium text-slate-100 truncate">{monitor.workerActivity}</span>
          </div>
          {justSaved && (
            <span
              role="status"
              aria-live="polite"
              className="shrink-0 text-[10px] font-medium text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded"
            >
              ✓ Record saved
            </span>
          )}
        </div>
      </div>

      {/* Active Application Header & Window Switcher */}
      <div className="shrink-0 px-3.5 py-2 border-b border-white/10 bg-[#0b1017] space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-white">
          <div className="flex items-center gap-2 min-w-0">
            {activeMode === 'browser' && <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
            {activeMode === 'dataEntry' && <Table2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            {activeMode === 'social' && <MessageSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
            {activeMode === 'project' && (
              <>
                {profile.jobApp.appType === 'design' && <Layout className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                {profile.jobApp.appType === 'marketing' && <BarChart3 className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                {profile.jobApp.appType === 'social' && <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                {profile.jobApp.appType === 'security' && <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                {profile.jobApp.appType === 'executive' && <Briefcase className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                {profile.jobApp.appType === 'ide' && <Code2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              </>
            )}
            <span className="truncate">
              {activeMode === 'browser'
                ? 'Browser & Research'
                : activeMode === 'dataEntry'
                  ? `Data Entry · ${profile.dataEntry.sheetTitle}`
                  : activeMode === 'social'
                    ? `WorkLink & HubPulse · ${DISTRICT_SOCIAL_DIRECTORY[monitor.buildingId].channel}`
                    : profile.jobApp.appName}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-mono-tabular text-slate-400 shrink-0">
            {activeMode === 'social' ? 'Social Channels' : activeMode === 'browser' ? 'Research' : activeMode === 'dataEntry' ? 'Live Sheet' : 'Active App'}
          </span>
        </div>

        <div role="tablist" aria-label="Workstation applications" className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'project', label: 'Project App' },
              { id: 'social', label: 'Social & Channels' },
              { id: 'dataEntry', label: 'Data Entry' },
              { id: 'browser', label: 'Browser' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeMode === tab.id}
              onClick={() => setActiveMode(tab.id)}
              className={`px-2 py-0.5 text-[10.5px] rounded border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeMode === tab.id
                  ? 'border-emerald-400/50 bg-emerald-500/18 text-white font-semibold'
                  : 'border-white/10 bg-white/4 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Active Workspace */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
        {activeMode === 'browser' && (
          <div className="space-y-2.5">
            {/* Bookmark Tabs & Quick Live Web Links */}
            <div role="group" aria-label="Workstation research bookmarks" className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {sessions.map((s, idx) => {
                const isActive =
                  activeHistoryEntry?.kind === 'browse'
                    ? activeHistoryEntry.data.url === s.url
                    : !activeHistoryEntry && browserTabIdx === idx;
                return (
                  <button
                    key={s.tabTitle}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setBrowserTabIdx(idx);
                      if (offlineActive) {
                        setHistoryIdx(-1);
                        setBrowseError(null);
                        setSearchInput(s.url);
                        syncLiveSessionTo3dMonitor(s);
                      } else {
                        void browseLiveUrl(s.url);
                      }
                    }}
                    title={s.url}
                    className={`px-2 py-1 text-[11px] rounded border truncate max-w-[165px] cursor-pointer transition-colors ${
                      isActive
                        ? 'border-sky-400/50 bg-sky-500/15 text-white font-medium'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
                    }`}
                  >
                    {s.tabTitle}
                  </button>
                );
              })}
              {QUICK_REAL_BOOKMARKS.map((bm) => (
                <button
                  key={bm.url}
                  type="button"
                  onClick={() => {
                    if (offlineActive) {
                      void browseLiveUrl(bm.url);
                    } else {
                      void browseLiveUrl(bm.url);
                    }
                  }}
                  title={bm.url}
                  className="px-2 py-1 text-[10.5px] rounded border border-emerald-400/25 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  {bm.label}
                </button>
              ))}
            </div>

            {/* Real Address & Live Search Bar */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 text-slate-400">
                <button
                  type="button"
                  disabled={historyIdx <= 0}
                  onClick={() => {
                    if (historyIdx > 0) {
                      const prevIdx = historyIdx - 1;
                      const entry = liveHistory[prevIdx];
                      setHistoryIdx(prevIdx);
                      setBrowseError(null);
                      setSearchInput(entry.inputLabel);
                      syncHistoryEntryTo3dMonitor(entry);
                    }
                  }}
                  aria-label="Back"
                  className="p-1 rounded hover:bg-white/10 hover:text-white disabled:opacity-35 cursor-pointer disabled:cursor-default"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={historyIdx >= liveHistory.length - 1}
                  onClick={() => {
                    if (historyIdx < liveHistory.length - 1) {
                      const nextIdx = historyIdx + 1;
                      const entry = liveHistory[nextIdx];
                      setHistoryIdx(nextIdx);
                      setBrowseError(null);
                      setSearchInput(entry.inputLabel);
                      syncHistoryEntryTo3dMonitor(entry);
                    }
                  }}
                  aria-label="Forward"
                  className="p-1 rounded hover:bg-white/10 hover:text-white disabled:opacity-35 cursor-pointer disabled:cursor-default"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeHistoryEntry?.kind === 'browse') {
                      void browseLiveUrl(activeHistoryEntry.data.finalUrl);
                    } else if (activeHistoryEntry?.kind === 'search') {
                      void searchLiveWeb(activeHistoryEntry.data.query);
                    } else {
                      void browseLiveUrl(activeBrowserSession.url);
                    }
                  }}
                  aria-label="Reload"
                  className="p-1 hover:text-white rounded hover:bg-white/10 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${browseLoading ? 'animate-spin text-sky-400' : ''}`} />
                </button>
              </div>
              <div className="flex-1 flex items-center gap-1.5 bg-[#080c12] border border-white/15 rounded px-2 py-1">
                <Search className="w-3 h-3 text-slate-400 shrink-0" />
                <input
                  type="text"
                  aria-label="Enter URL or web search query"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Enter https:// URL or search the live web…"
                  className="w-full bg-transparent text-[11px] font-mono-tabular text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-2 py-1 text-[11px] font-medium rounded bg-sky-500/20 border border-sky-400/40 text-sky-200 hover:bg-sky-500/30 cursor-pointer"
              >
                Go
              </button>
            </form>

            {/* Live HTTP Error Banner */}
            {browseError && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded border border-rose-400/40 bg-rose-500/12 px-2.5 py-2 text-[11px] text-rose-200 space-y-1.5"
              >
                <div className="font-semibold">
                  {isStandalone ? 'Standalone Mode Notice' : 'Unable to fetch remote site directly'}
                </div>
                <div className="text-rose-200/90 break-words">{browseError}</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const q = searchInput.trim() || activeBrowserSession.searchQuery;
                      void searchLiveWeb(q.replace(/^https?:\/\//i, ''));
                    }}
                    className="px-2 py-0.5 rounded bg-white/12 hover:bg-white/20 text-white text-[10.5px] font-medium cursor-pointer"
                  >
                    Search Wikipedia
                  </button>
                  <a
                    href={activeBrowserSession.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/25 hover:bg-sky-500/35 text-sky-100 text-[10.5px] font-medium"
                  >
                    <span>Open External Tab</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Live Browser Viewport */}
            <div className="rounded border border-white/12 bg-[#f8fafc] text-slate-900 p-3 space-y-2.5">
              {browseLoading ? (
                <div className="flex items-center gap-2 py-6 justify-center text-slate-600 text-xs font-medium">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                  <span>Fetching live response from server…</span>
                </div>
              ) : activeHistoryEntry?.kind === 'search' ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular text-slate-500">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <Wifi className="w-3 h-3" /> LIVE SEARCH · “{activeHistoryEntry.data.query}”
                    </span>
                    <span>{activeHistoryEntry.data.latencyMs}ms</span>
                  </div>
                  {activeHistoryEntry.data.instantAbstract && (
                    <div className="rounded border border-sky-200 bg-sky-50 p-2 text-[11px] text-slate-800 space-y-1">
                      <div className="font-semibold text-sky-900">
                        Instant Summary ({activeHistoryEntry.data.instantSource})
                      </div>
                      <p className="leading-relaxed">{activeHistoryEntry.data.instantAbstract}</p>
                      {activeHistoryEntry.data.instantUrl && (
                        <button
                          type="button"
                          onClick={() => void browseLiveUrl(activeHistoryEntry.data.instantUrl)}
                          className="inline-flex items-center gap-1 text-[10.5px] font-medium text-sky-700 hover:underline cursor-pointer"
                        >
                          <span>Open source article</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    {activeHistoryEntry.data.results.length === 0 ? (
                      <div className="text-[11px] text-slate-500 py-2">No live results returned for that query.</div>
                    ) : (
                      activeHistoryEntry.data.results.map((r) => (
                        <div key={r.url} className="pt-1.5 border-t border-slate-200 first:border-t-0 first:pt-0">
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular text-emerald-700">
                            <span className="truncate">{r.domain}</span>
                            <span className="shrink-0 text-slate-400">{r.source}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void browseLiveUrl(r.url)}
                            className="text-left text-[12px] font-semibold text-blue-700 hover:underline cursor-pointer"
                          >
                            {r.title}
                          </button>
                          {r.snippet && (
                            <p className="mt-0.5 text-[11px] text-slate-600 leading-snug">{r.snippet}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : activeHistoryEntry?.kind === 'browse' ? (
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular text-emerald-700">
                      <span className="inline-flex items-center gap-1 truncate">
                        <Wifi className="w-3 h-3 shrink-0" />
                        <span className="truncate">{activeHistoryEntry.data.domain}</span>
                      </span>
                      <span className="shrink-0 text-slate-500">
                        HTTP {activeHistoryEntry.data.status} · {activeHistoryEntry.data.latencyMs}ms
                      </span>
                    </div>
                    <h3 className="mt-0.5 text-[13px] font-bold text-slate-900 leading-snug">
                      {activeHistoryEntry.data.title}
                    </h3>
                    {activeHistoryEntry.data.description && (
                      <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                        {activeHistoryEntry.data.description}
                      </p>
                    )}
                  </div>

                  {activeHistoryEntry.data.headings.length > 0 && (
                    <div className="rounded bg-slate-100 border border-slate-200 px-2.5 py-1.5">
                      <div className="text-[9.5px] uppercase tracking-wider font-semibold text-slate-500">
                        Page Headings
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {activeHistoryEntry.data.headings.slice(0, 6).map((h, i) => (
                          <span
                            key={`${i}-${h.slice(0, 14)}`}
                            className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] text-slate-700"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeHistoryEntry.data.paragraphs.length > 0 && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-200">
                      {activeHistoryEntry.data.paragraphs.slice(0, 5).map((p, idx) => (
                        <p key={idx} className="text-[11px] leading-relaxed text-slate-700">
                          {p}
                        </p>
                      ))}
                    </div>
                  )}

                  {activeHistoryEntry.data.links.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-200 space-y-1">
                      <div className="text-[9.5px] uppercase tracking-wider font-semibold text-slate-500">
                        Navigable Page Links
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activeHistoryEntry.data.links.slice(0, 8).map((lnk) => (
                          <button
                            key={lnk.url}
                            type="button"
                            onClick={() => void browseLiveUrl(lnk.url)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[10px] font-medium text-blue-700 cursor-pointer"
                          >
                            <span className="truncate max-w-[160px]">{lnk.text}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5 text-[11px] text-slate-700 py-1">
                  {offlineActive && (
                    <div className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[10.5px] text-amber-900">
                      Offline mode — showing built-in district documentation &amp; cached search with zero network requests.
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-sky-700 font-semibold">
                      {activeBrowserSession.articleDomain}
                    </div>
                    <h3 className="mt-0.5 text-[13px] font-bold text-slate-900 leading-snug">
                      {activeBrowserSession.articleTitle}
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {activeBrowserSession.sections.map((sec) => (
                      <div key={sec.heading} className="rounded border border-slate-200 bg-white p-2 space-y-1">
                        <div className="text-[11px] font-semibold text-slate-900">{sec.heading}</div>
                        <p className="text-[10.5px] text-slate-600 leading-relaxed">{sec.excerpt}</p>
                        <div className="rounded bg-slate-100 px-1.5 py-1 font-mono-tabular text-[10px] text-slate-800 break-words">
                          {sec.highlight}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10.5px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
                    Desk Note: {activeBrowserSession.researchNote}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {!offlineActive && (
                      <button
                        type="button"
                        onClick={() => void browseLiveUrl(activeBrowserSession.url)}
                        className="px-2.5 py-1 rounded bg-sky-600 text-white text-[11px] font-medium hover:bg-sky-500 cursor-pointer"
                      >
                        Load Live Page
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void searchLiveWeb(activeBrowserSession.searchQuery)}
                      className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-800 text-[11px] font-medium hover:bg-slate-100 cursor-pointer"
                    >
                      {offlineActive ? 'Search Offline Index' : 'Search Wikipedia'}
                    </button>
                    <a
                      href={activeBrowserSession.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-sky-300 bg-sky-50 text-sky-800 text-[11px] font-medium hover:bg-sky-100"
                    >
                      <span>Open External</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeMode === 'dataEntry' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-white">{profile.dataEntry.sheetTitle}</h3>
              <span className="text-[10px] font-mono-tabular text-slate-400">{rows.length} rows</span>
            </div>

            {/* Live Typing Draft Row */}
            {typedDraftCells && (
              <div className="rounded border border-sky-400/50 bg-sky-500/10 p-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                  <span>Live Entry In Progress…</span>
                  <span className="font-mono-tabular">
                    {entrySubTick > 55 ? 'Validating ✓' : 'Typing'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono-tabular">
                  {typedDraftCells.map((cell, idx) => (
                    <div
                      key={idx}
                      className={`truncate rounded px-1.5 py-1 border ${
                        cell.active
                          ? 'border-sky-400 bg-[#080e16] text-white'
                          : 'border-white/10 bg-[#0a111a] text-slate-200'
                      }`}
                    >
                      {cell.slice}
                      {cell.active && <span className="text-sky-400">|</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Operational Table */}
            <div className="rounded border border-white/12 overflow-hidden bg-[#080d14]">
              <div className="grid grid-cols-4 gap-1 px-2.5 py-1.5 bg-[#121a24] border-b border-white/10 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {profile.dataEntry.columns.map((col) => (
                  <div key={col} className="truncate">
                    {col}
                  </div>
                ))}
              </div>
              <div className="divide-y divide-white/8 max-h-44 overflow-y-auto">
                {rows.map((r, ri) => (
                  <div
                    key={`${r[0]}-${ri}`}
                    className={`grid grid-cols-4 gap-1 px-2.5 py-1.5 text-[11px] ${
                      ri === 0 ? 'bg-emerald-500/6' : ''
                    }`}
                  >
                    {r.map((val, ci) => (
                      <div
                        key={ci}
                        className={`truncate ${
                          val.startsWith('▲')
                            ? 'text-emerald-400 font-medium'
                            : ci === 0
                              ? 'text-slate-100 font-medium'
                              : 'text-slate-300'
                        }`}
                      >
                        {val}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Manual Data Entry Form */}
            <form onSubmit={handleAddRecord} className="space-y-1.5 pt-1 border-t border-white/10">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                Enter New Record Manually
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {profile.dataEntry.columns.map((col, idx) => (
                  <input
                    key={col}
                    type="text"
                    aria-label={col}
                    value={newRow[idx]}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewRow((prev) => {
                        const next: [string, string, string, string] = [...prev];
                        next[idx] = val;
                        return next;
                      });
                    }}
                    placeholder={col}
                    className="rounded border border-white/15 bg-[#080c12] px-2 py-1 text-[11px] text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                ))}
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30 text-[11px] font-medium cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Entry to {profile.dataEntry.sheetTitle}</span>
              </button>
            </form>
          </div>
        )}

        {activeMode === 'project' && (
          <div className="space-y-2.5">
            {/* Real-Life Tool Title & 3 Live KPIs */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-white truncate">{profile.jobApp.appName}</span>
              <span className="text-[10px] font-mono-tabular text-emerald-400 shrink-0">LIVE WORKSPACE</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {profile.jobApp.kpis.map((kp) => (
                <div key={kp.label} className="rounded border border-white/10 bg-[#0b1119] px-2 py-1.5">
                  <div className="text-[9.5px] uppercase tracking-wider text-slate-400 truncate">{kp.label}</div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-1">
                    <span className="text-xs font-bold text-white font-mono-tabular">{kp.value}</span>
                    <span className="text-[9.5px] text-emerald-400 font-medium">{kp.delta}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Job-Specific Visual Workspace */}
            {profile.jobApp.appType === 'ide' && (
              <div className="space-y-2">
                <div className="rounded border border-white/12 bg-[#070b10] overflow-hidden">
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#111822] border-b border-white/10 text-[11px]">
                    <span className="font-mono-tabular text-slate-200 truncate">{profile.projectWork.fileName}</span>
                    <span className="text-[10px] font-semibold text-sky-300 shrink-0">{profile.projectWork.language}</span>
                  </div>
                  <pre className="p-2.5 text-[10.5px] leading-relaxed font-mono-tabular text-slate-200 overflow-x-auto">
                    {shownCodeLines.map((ln, idx) => (
                      <div key={idx} className="flex gap-2.5">
                        <span className="w-4 text-right text-slate-600 select-none">{idx + 1}</span>
                        <span className="whitespace-pre">
                          {ln}
                          {autoPilot && monitor.isOccupied && idx === shownCodeLines.length - 1 && (
                            <span className="inline-block w-1.5 h-3 ml-0.5 bg-amber-400 align-middle" />
                          )}
                        </span>
                      </div>
                    ))}
                  </pre>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0b1219] border-t border-white/10 text-[10.5px] font-mono-tabular text-emerald-300">
                    <Terminal className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span className="truncate">{profile.projectWork.terminalOutput}</span>
                  </div>
                </div>
                <div className="rounded border border-sky-400/25 bg-sky-500/8 px-2.5 py-2 text-[11px]">
                  <div className="font-mono-tabular font-semibold text-sky-200">{profile.jobApp.visualHeadline}</div>
                  <div className="mt-0.5 font-mono-tabular text-[10px] text-slate-300">{profile.jobApp.visualSubline}</div>
                </div>
              </div>
            )}

            {profile.jobApp.appType === 'design' && (
              <div className="space-y-2">
                <div className="rounded border border-white/15 bg-[#f8fafc] text-slate-900 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <span>Artboard / Live Storefront Canvas</span>
                    <span className="text-emerald-700">1440px · Desktop</span>
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-2.5 shadow-xs">
                    <div className="text-xs font-bold text-slate-900">{profile.jobApp.visualHeadline}</div>
                    <div className="mt-0.5 text-[11px] text-slate-600">{profile.jobApp.visualSubline}</div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {profile.jobApp.visualItems.map((it) => (
                        <div key={it.title} className="rounded bg-slate-100 p-1.5 border border-slate-200">
                          <div className="text-[10px] font-semibold text-slate-800 truncate">{it.title}</div>
                          <div className="text-[9.5px] text-slate-500 truncate">{it.meta}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {profile.jobApp.appType === 'marketing' && (
              <div className="space-y-2">
                <div className="rounded border border-white/12 bg-[#080d14] p-2.5">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
                    Performance Trend
                  </div>
                  <div className="flex items-end gap-2 h-20 pt-2">
                    {profile.jobApp.chartBars.map((v, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: `${Math.round(v * 100)}%`,
                            backgroundColor: idx === profile.jobApp.chartBars.length - 1 ? '#4fe38a' : monitor.color,
                          }}
                        />
                        <span className="text-[9px] font-mono-tabular text-slate-400">
                          {profile.jobApp.chartLabels[idx] || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-white text-slate-900 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700">
                    Live Search / Campaign Snippet
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-blue-700">{profile.jobApp.visualHeadline}</div>
                  <div className="mt-0.5 text-[10.5px] text-slate-600">{profile.jobApp.visualSubline}</div>
                </div>
              </div>
            )}

            {profile.jobApp.appType === 'social' && (
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2 rounded-lg border border-white/20 bg-[#070a10] p-2 flex flex-col justify-between min-h-[140px]">
                  <div
                    className="rounded p-2 text-[10.5px] font-semibold text-white leading-snug"
                    style={{ background: `linear-gradient(135deg, ${monitor.color}, #1e293b)` }}
                  >
                    {profile.jobApp.visualHeadline}
                  </div>
                  <div className="mt-1.5 rounded bg-white/8 p-1.5 text-[10px] text-slate-200 leading-snug">
                    {profile.jobApp.visualSubline}
                  </div>
                </div>
                <div className="col-span-3 space-y-1.5">
                  {profile.jobApp.visualItems.map((it) => (
                    <div key={it.title} className="rounded border border-white/10 bg-[#080d14] px-2 py-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-white truncate">{it.title}</span>
                        <span className="text-[10px] text-emerald-400 shrink-0">{it.status}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{it.meta}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.jobApp.appType === 'security' && (
              <div className="space-y-2">
                <div className="rounded border border-white/12 bg-[#080d14] p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <span>Infrastructure Health Grid (24 Cluster Shards)</span>
                    <span className="text-emerald-400">ALL SYSTEMS NOMINAL</span>
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2.5 rounded-xs ${
                          (i + tick) % 17 === 0 ? 'bg-sky-400' : 'bg-emerald-500'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="rounded bg-[#05080d] px-2 py-1.5 font-mono-tabular text-[10px] text-emerald-300">
                    <div>{profile.jobApp.visualHeadline}</div>
                    <div className="text-slate-400 mt-0.5">{profile.jobApp.visualSubline}</div>
                  </div>
                </div>
              </div>
            )}

            {profile.jobApp.appType === 'executive' && (
              <div className="space-y-2">
                <div className="rounded border border-amber-400/25 bg-[#0a111a] p-2.5 space-y-1.5">
                  <div className="text-xs font-semibold text-white">{profile.jobApp.visualHeadline}</div>
                  <div className="text-[11px] text-slate-300 leading-snug">{profile.jobApp.visualSubline}</div>
                </div>
                <div className="space-y-1">
                  {profile.jobApp.visualItems.map((it) => (
                    <div
                      key={it.title}
                      className="flex items-center justify-between gap-2 rounded border border-white/10 bg-[#080d14] px-2.5 py-1.5"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-white truncate">{it.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">{it.meta}</div>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold text-emerald-400">{it.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Project Deliverables Checklist */}
            <div className="space-y-1 pt-1">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                Active Job Deliverables
              </div>
              {profile.projectWork.deliverables.map((d, i) => {
                const done = deliverablesDone[i] ?? d.done;
                return (
                  <button
                    key={d.label}
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    onClick={() =>
                      setDeliverablesMap((prev) => {
                        const base = prev[monitor.id] ?? profile.projectWork.deliverables.map((x) => x.done);
                        const next = [...base];
                        next[i] = !next[i];
                        return { ...prev, [monitor.id]: next };
                      })
                    }
                    className="w-full flex items-center gap-2 rounded border border-white/10 bg-white/4 hover:bg-white/8 px-2.5 py-1.5 text-left text-[11px] cursor-pointer transition-colors"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        done
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                          : 'border-slate-500 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </span>
                    <span className={done ? 'text-slate-300 line-through' : 'text-white'}>{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeMode === 'social' && (
          <div className="space-y-2.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const title = monJobTitle.trim();
                if (!title) return;
                socialNetwork.dispatchJob({
                  platform: monPlatform,
                  fromBuilding: monitor.buildingId,
                  fromName: monitor.role,
                  sourceDevice: 'Monitor',
                  toBuilding: monTargetBuilding,
                  title,
                  brief: `Dispatched from ${monitor.zone} (${monitor.role}) desktop monitor.`,
                  priority: monPriority,
                });
                setMonJobTitle('');
                setJustSaved(true);
                onNotifyCompanyJob?.(monTargetBuilding);
              }}
              className="rounded border border-white/12 bg-[#0b1119] p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between text-[10.5px] font-semibold text-white">
                <span>Dispatch Job from This Monitor</span>
                <span className="font-mono-tabular text-emerald-400">
                  {DISTRICT_SOCIAL_DIRECTORY[monitor.buildingId].handle}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <select
                  aria-label="Target company"
                  value={monTargetBuilding}
                  onChange={(e) => setMonTargetBuilding(e.target.value as BuildingId)}
                  className="rounded border border-white/15 bg-[#070b10] px-1.5 py-1 text-[11px] text-white focus:border-emerald-400 focus:outline-none"
                >
                  {DISTRICT_BUILDINGS.map((b) => (
                    <option key={b.id} value={b.id}>
                      To: {b.shortName}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Social platform"
                  value={monPlatform}
                  onChange={(e) => setMonPlatform(e.target.value as SocialPlatformId)}
                  className="rounded border border-white/15 bg-[#070b10] px-1.5 py-1 text-[11px] text-white focus:border-emerald-400 focus:outline-none"
                >
                  <option value="worklink">WorkLink</option>
                  <option value="hubpulse">HubPulse</option>
                  <option value="swiftchat">SwiftChat</option>
                </select>
                <select
                  aria-label="Job priority"
                  value={monPriority}
                  onChange={(e) => setMonPriority(e.target.value as JobPriority)}
                  className="rounded border border-white/15 bg-[#070b10] px-1.5 py-1 text-[11px] text-white focus:border-emerald-400 focus:outline-none"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  aria-label="Task message"
                  value={monJobTitle}
                  onChange={(e) => setMonJobTitle(e.target.value)}
                  placeholder={`Send task to ${DISTRICT_SOCIAL_DIRECTORY[monTargetBuilding].shortName}…`}
                  className="flex-1 rounded border border-white/15 bg-[#070b10] px-2 py-1 text-[11px] text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-[11px] font-semibold cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </button>
              </div>
            </form>

            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                {DISTRICT_SOCIAL_DIRECTORY[monitor.buildingId].shortName} Channel Queue
              </div>
              {socialNetwork.getBuildingQueue(monitor.buildingId).map((job) => {
                const toDir = DISTRICT_SOCIAL_DIRECTORY[job.toBuilding];
                return (
                  <div
                    key={job.id}
                    className="rounded border border-white/10 bg-[#080d14] p-2 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-[10.5px]">
                      <span className="font-mono-tabular font-semibold text-white">
                        {job.code} → {toDir.shortName}
                      </span>
                      <span className="font-mono-tabular text-emerald-300">
                        {job.status} · {job.progress}%
                      </span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-100">{job.title}</div>
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                      <span>
                        {job.platform.toUpperCase()} · {job.assignedWorker}
                      </span>
                      {job.status !== 'Completed' && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => socialNetwork.advanceJob(job.id)}
                            className="px-1.5 py-0.5 rounded bg-white/8 hover:bg-white/15 text-slate-200 cursor-pointer"
                          >
                            Step
                          </button>
                          <button
                            type="button"
                            onClick={() => socialNetwork.completeJob(job.id)}
                            className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Synced 3D Monitor Feed Strip */}
        <div className="pt-2 border-t border-white/10 flex items-center gap-2.5">
          <canvas
            ref={screenMirrorRef}
            width={384}
            height={216}
            className="w-24 aspect-video rounded border border-white/15 bg-[#05070a] shrink-0"
          />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
              3D Monitor Feed Sync
            </div>
            <p className="text-[11px] text-slate-200 leading-snug line-clamp-2">{monitor.screenTask}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
