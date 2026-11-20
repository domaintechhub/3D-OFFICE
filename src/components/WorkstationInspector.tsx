import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
  Briefcase,
  Check,
  Code2,
  FolderGit2,
  Globe,
  Layout,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
  Terminal,
  X,
} from 'lucide-react';
import type { InspectedMonitor } from '../scene/constants';
import {
  getModeForDesk,
  getWorkstationProfile,
  type BrowserSession,
} from '../scene/workstations';

interface WorkstationInspectorProps {
  monitor: InspectedMonitor;
  onClose: () => void;
  getInspectedScreenCanvas: () => HTMLCanvasElement | null;
}

export const WorkstationInspector: React.FC<WorkstationInspectorProps> = ({
  monitor,
  onClose,
  getInspectedScreenCanvas,
}) => {
  const profile = useMemo(() => getWorkstationProfile(monitor.stationKey), [monitor.stationKey]);
  const activeMode = useMemo(
    () => getModeForDesk(monitor.stationKey, monitor.seatIndex),
    [monitor.stationKey, monitor.seatIndex]
  );

  const [autoPilot, setAutoPilot] = useState(true);
  const [tick, setTick] = useState(0);

  // Per-station persistent data-entry rows & custom browser queries
  const [rowsMap, setRowsMap] = useState<Record<string, Array<[string, string, string, string]>>>({});
  const [queueIdxMap, setQueueIdxMap] = useState<Record<string, number>>({});
  const [deliverablesMap, setDeliverablesMap] = useState<Record<string, boolean[]>>({});
  const [browserTabIdx, setBrowserTabIdx] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [customSession, setCustomSession] = useState<BrowserSession | null>(null);
  const [newRow, setNewRow] = useState<[string, string, string, string]>(['', '', '', '']);
  const [justSaved, setJustSaved] = useState(false);

  const screenMirrorRef = useRef<HTMLCanvasElement | null>(null);

  // Reset browser & draft state when switching to a different monitor
  useEffect(() => {
    setAutoPilot(true);
    setBrowserTabIdx(0);
    setCustomSession(null);
    setSearchInput('');
    setNewRow(['', '', '', '']);
    setJustSaved(false);
  }, [monitor.id]);

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

  // Browser session resolution (auto-cycles research pages in autoPilot unless user selected/searched)
  const sessions = profile.browserSessions;
  const autoBrowserIdx = Math.floor(tick / 110) % sessions.length;
  const activeBrowserSession =
    customSession ?? sessions[(autoPilot ? autoBrowserIdx : browserTabIdx) % sessions.length];
  const browserPhaseTick = tick % 110;
  const isTypingSearch = autoPilot && monitor.isOccupied && !customSession && browserPhaseTick < 32;
  const typedQuery = isTypingSearch
    ? activeBrowserSession.searchQuery.slice(0, Math.max(1, Math.floor(browserPhaseTick * 1.8)))
    : activeBrowserSession.searchQuery;

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
    setAutoPilot(false);
    setCustomSession({
      tabTitle: `Research: ${q.slice(0, 22)}`,
      url: `https://research.domaintechhub.co.ke/search?q=${encodeURIComponent(q)}`,
      searchQuery: q,
      articleTitle: `${q} — DomainTechHub Engineering & Market Dossier`,
      articleDomain: 'knowledge.domaintechhub.co.ke',
      sections: [
        {
          heading: `Live Investigation for ${profile.projectTitle}`,
          excerpt: `Cross-referencing "${q}" against ${profile.clientName} requirements, East Africa latency/compliance constraints, and internal production benchmarks.`,
          highlight: `Action item logged for ${monitor.zone}: verify implementation against ${profile.projectWork.fileName}.`,
        },
        ...activeBrowserSession.sections.slice(0, 1),
      ],
      researchNote: `Custom lookup "${q}" attached to ${profile.projectTitle} workspace.`,
    });
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
    <div className="pointer-events-auto fixed top-16 right-3 sm:right-4 w-[min(94vw,470px)] max-h-[calc(100vh-11.5rem)] flex flex-col border border-white/15 bg-[#0d121a]/96 rounded-md shadow-2xl overflow-hidden">
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
              onClick={() => setAutoPilot((v) => !v)}
              title={autoPilot ? 'Pause live worker auto-pilot' : 'Resume live worker auto-pilot'}
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
            <span className="shrink-0 text-[10px] font-medium text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded">
              ✓ Record saved
            </span>
          )}
        </div>
      </div>

      {/* Active Application Header (matches only what is open on this worker's monitor) */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2 border-b border-white/10 bg-[#0b1017] text-xs font-medium text-white">
        <div className="flex items-center gap-2 min-w-0">
          {activeMode === 'browser' && <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
          {activeMode === 'dataEntry' && <Table2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
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
                : profile.jobApp.appName}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-mono-tabular text-slate-400 shrink-0">
          {activeMode === 'browser' ? 'Research Window' : activeMode === 'dataEntry' ? 'Live Sheet' : 'Active App'}
        </span>
      </div>

      {/* Scrollable Active Workspace */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
        {activeMode === 'browser' && (
          <div className="space-y-2.5">
            {/* Open Browser Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {sessions.map((s, idx) => {
                const isActive = !customSession && (autoPilot ? autoBrowserIdx : browserTabIdx) === idx;
                return (
                  <button
                    key={s.tabTitle}
                    type="button"
                    onClick={() => {
                      setCustomSession(null);
                      setBrowserTabIdx(idx);
                      setAutoPilot(false);
                    }}
                    className={`px-2 py-1 text-[11px] rounded border truncate max-w-[180px] cursor-pointer transition-colors ${
                      isActive
                        ? 'border-sky-400/50 bg-sky-500/15 text-white font-medium'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.tabTitle}
                  </button>
                );
              })}
              {customSession && (
                <span className="px-2 py-1 text-[11px] rounded border border-emerald-400/50 bg-emerald-500/15 text-emerald-200 font-medium truncate max-w-[160px]">
                  {customSession.tabTitle}
                </span>
              )}
            </div>

            {/* Interactive Address / Research Search Bar */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    setCustomSession(null);
                    setBrowserTabIdx((i) => (i - 1 + sessions.length) % sessions.length);
                  }}
                  aria-label="Previous tab"
                  className="p-1 hover:text-white rounded hover:bg-white/10 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomSession(null);
                    setBrowserTabIdx((i) => (i + 1) % sessions.length);
                  }}
                  aria-label="Next tab"
                  className="p-1 hover:text-white rounded hover:bg-white/10 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setAutoPilot(true)}
                  aria-label="Sync with worker"
                  className="p-1 hover:text-white rounded hover:bg-white/10 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 flex items-center gap-1.5 bg-[#080c12] border border-white/15 rounded px-2 py-1">
                <Search className="w-3 h-3 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={activeBrowserSession.url}
                  className="w-full bg-transparent text-[11px] font-mono-tabular text-slate-100 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-2 py-1 text-[11px] font-medium rounded bg-sky-500/20 border border-sky-400/40 text-sky-200 hover:bg-sky-500/30 cursor-pointer"
              >
                Go
              </button>
            </form>

            {/* Browser Page Viewport */}
            <div className="rounded border border-white/12 bg-[#f8fafc] text-slate-900 p-3 space-y-2.5">
              {isTypingSearch ? (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Searching web documentation…
                  </div>
                  <div className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-xs">
                    {typedQuery}
                    <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-sky-600 align-middle" />
                  </div>
                  <div className="pt-1 space-y-1.5 opacity-80">
                    <div className="text-[11px] text-emerald-700 font-mono-tabular">
                      {activeBrowserSession.articleDomain}
                    </div>
                    <div className="text-xs font-semibold text-blue-700">
                      {activeBrowserSession.articleTitle}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular text-emerald-700">
                      <span className="truncate">{activeBrowserSession.articleDomain}</span>
                      <span className="shrink-0 flex items-center gap-1 text-slate-500">
                        <Bookmark className="w-3 h-3 text-amber-500" /> Saved to Research
                      </span>
                    </div>
                    <h3 className="mt-0.5 text-[13px] font-bold text-slate-900 leading-snug">
                      {activeBrowserSession.articleTitle}
                    </h3>
                  </div>

                  {activeBrowserSession.sections.map((sec) => (
                    <div key={sec.heading} className="space-y-1 pt-1 border-t border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-800">{sec.heading}</div>
                      <p className="text-[11px] leading-relaxed text-slate-600">{sec.excerpt}</p>
                      <div className="rounded bg-emerald-50 border-l-2 border-emerald-500 px-2.5 py-1.5 text-[10.5px] font-mono-tabular text-emerald-950">
                        {sec.highlight}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-2 text-[11px] text-emerald-200">
              <span className="font-semibold text-emerald-400">Research Note: </span>
              {activeBrowserSession.researchNote}
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
    </div>
  );
};
