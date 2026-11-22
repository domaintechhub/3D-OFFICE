import React, { useEffect, useRef, useState } from 'react';
import {
  Brain,
  Building2,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cloud,
  CloudLightning,
  CloudRain,
  Compass,
  Crosshair,
  DoorOpen,
  Eye,
  Footprints,
  Lightbulb,
  Megaphone,
  MessageSquare,
  Navigation,
  Pause,
  Play,
  Radio,
  Send,
  Smartphone,
  Snowflake,
  Sparkles,
  Sun,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  TOUR_TEXT,
  type HudSnapshot,
  type WeatherCondition,
  type WeatherMode,
} from '../scene/constants';
import { DISTRICT_BUILDINGS, type BuildingId } from '../scene/districtData';
import {
  DISTRICT_SOCIAL_DIRECTORY,
  socialNetwork,
  type SocialPlatformId,
} from '../scene/socialNetwork';
import { WorkstationInspector } from './WorkstationInspector';

interface HudOverlayProps {
  hud: HudSnapshot;
  onSelectBuilding: (id: BuildingId) => void;
  onSelectLevel: (key: string) => void;
  onStartTour: () => void;
  onEndTour: () => void;
  onPrevStop: () => void;
  onNextStop: () => void;
  onToggleTourPlay: () => void;
  onToggleWalk: () => void;
  onSetWalkFloor: (lv: number) => void;
  onTouchJoystick: (nx: number, ny: number) => void;
  onToggleStaff: () => void;
  onToggleAudio: () => void;
  onSetRate: (rate: number) => void;
  onJumpToTime: (minutes: number) => void;
  onSetWeatherMode: (mode: WeatherMode) => void;
  onCloseMonitor: () => void;
  getInspectedScreenCanvas: () => HTMLCanvasElement | null;
  onCloseCharacter: () => void;
  onFocusCharacter: () => void;
  onToggleFollowCharacter: () => void;
  onNudgeCharacter: () => void;
  onOpenCharacters: () => void;
  onOpenSocialChannels: () => void;
  onNotifyCompanyJob: (buildingId: BuildingId) => void;
  onToggleDrive: (targetBuilding?: BuildingId | null) => void;
  onStepOutOfCar: () => void;
  onEnterCarFromWalk: () => void;
  onToggleDriveCamera: () => void;
  onToggleDriveHeadlights: () => void;
  onSetDriveTarget: (bId: BuildingId | null) => void;
  onDriveTouch: (throttle: number, steer: number, brake: boolean) => void;
  onCarHorn: () => void;
  onForceRedrawMonitor: () => void;
  onApplyLiveNairobi: (minutes: number, cond: WeatherMode) => void;
}

function getFloorButtons(buildingId: BuildingId, totalFloors: number): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'roof', label: 'Roof' },
  ];
  for (let lv = totalFloors - 1; lv >= 1; lv--) {
    out.push({ key: String(lv), label: `L${lv}` });
  }
  out.push({ key: '0', label: 'G' });
  if (buildingId === 'hub') {
    out.push({ key: 'b1', label: 'B1' }, { key: 'b2', label: 'B2' });
  }
  return out;
}

const RATES = [
  { rate: 0, label: 'Pause' },
  { rate: 1, label: '1×' },
  { rate: 4, label: '4×' },
  { rate: 15, label: '15×' },
];

const TIME_PRESETS = [
  { label: 'Morning', minutes: 8 * 60 + 30 },
  { label: 'Lunch', minutes: 12 * 60 + 30 },
  { label: 'Handover', minutes: 15 * 60 + 30 },
  { label: 'Dinner', minutes: 19 * 60 },
  { label: 'Night', minutes: 22 * 60 + 15 },
];

const WEATHER_MODES: Array<{ mode: WeatherMode; label: string }> = [
  { mode: 'auto', label: 'Auto' },
  { mode: 'clear', label: 'Clear' },
  { mode: 'overcast', label: 'Clouds' },
  { mode: 'rain', label: 'Rain' },
  { mode: 'storm', label: 'Storm' },
  { mode: 'snow', label: 'Snow' },
];

function WeatherIcon({ condition }: { condition: WeatherCondition }) {
  switch (condition) {
    case 'overcast':
      return <Cloud className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
    case 'rain':
      return <CloudRain className="w-3.5 h-3.5 text-sky-300 shrink-0" />;
    case 'storm':
      return <CloudLightning className="w-3.5 h-3.5 text-indigo-300 shrink-0" />;
    case 'snow':
      return <Snowflake className="w-3.5 h-3.5 text-cyan-200 shrink-0" />;
    default:
      return <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
  }
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  onSelectBuilding,
  onSelectLevel,
  onStartTour,
  onEndTour,
  onPrevStop,
  onNextStop,
  onToggleTourPlay,
  onToggleWalk,
  onSetWalkFloor,
  onTouchJoystick,
  onToggleStaff,
  onToggleAudio,
  onSetRate,
  onJumpToTime,
  onSetWeatherMode,
  onCloseMonitor,
  getInspectedScreenCanvas,
  onCloseCharacter,
  onFocusCharacter,
  onToggleFollowCharacter,
  onNudgeCharacter,
  onOpenCharacters,
  onOpenSocialChannels,
  onNotifyCompanyJob,
  onToggleDrive,
  onStepOutOfCar,
  onEnterCarFromWalk,
  onToggleDriveCamera,
  onToggleDriveHeadlights,
  onSetDriveTarget,
  onDriveTouch,
  onCarHorn,
  onForceRedrawMonitor,
  onApplyLiveNairobi,
}) => {
  const [dockOpen, setDockOpen] = useState(true);
  const [, setSocialVer] = useState(0);
  const [phoneTarget, setPhoneTarget] = useState<BuildingId>('bank');
  const [phonePlatform, setPhonePlatform] = useState<SocialPlatformId>('swiftchat');
  const [phoneJobText, setPhoneJobText] = useState('');
  const [phoneSentNote, setPhoneSentNote] = useState<string | null>(null);
  const [liveNairobiTemp, setLiveNairobiTemp] = useState<string | null>(null);
  const [nairobiLoading, setNairobiLoading] = useState(false);
  const [nairobiError, setNairobiError] = useState<string | null>(null);
  const joyRef = useRef<HTMLDivElement | null>(null);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const joyActive = useRef(false);
  const driveTouchState = useRef({ throttle: 0, steer: 0, brake: false });

  useEffect(() => socialNetwork.subscribe(() => setSocialVer((v) => v + 1)), []);

  useEffect(() => {
    setPhoneSentNote(null);
    setPhoneJobText('');
    if (hud.selectedCharacter) {
      const charBld: BuildingId =
        hud.selectedCharacter.buildingId === 'street' ? 'hub' : hud.selectedCharacter.buildingId;
      setPhoneTarget(charBld === 'hub' ? 'logistics' : 'hub');
    }
  }, [hud.selectedCharacter?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isTextTarget =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;
      if (e.code === 'KeyH' && !hud.walking && !hud.driving && !isTextTarget) {
        setDockOpen((v) => !v);
      } else if (e.code === 'Escape' && !hud.walking && !hud.driving) {
        if (hud.inspectedMonitor) onCloseMonitor();
        if (hud.selectedCharacter) onCloseCharacter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.walking, hud.driving, hud.inspectedMonitor, hud.selectedCharacter, onCloseMonitor, onCloseCharacter]);

  const syncLiveNairobi = async () => {
    if (nairobiLoading) return;
    setNairobiLoading(true);
    setNairobiError(null);
    try {
      const res = await fetch('/api/nairobi-live');
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const cond = (data.condition || 'clear') as WeatherMode;
      onApplyLiveNairobi(Number(data.minutesOfDay) || 12 * 60, cond);
      const tempPart = typeof data.temperatureC === 'number' ? `${data.temperatureC}°C` : '';
      const sumPart = typeof data.summary === 'string' ? data.summary : '';
      setLiveNairobiTemp([tempPart, sumPart].filter(Boolean).join(' · ') || 'EAT Live');
    } catch (err) {
      setNairobiError(err instanceof Error ? err.message : 'Live Nairobi sync failed');
    } finally {
      setNairobiLoading(false);
    }
  };

  const setDriveControl = (patch: Partial<{ throttle: number; steer: number; brake: boolean }>) => {
    const next = { ...driveTouchState.current, ...patch };
    driveTouchState.current = next;
    onDriveTouch(next.throttle, next.steer, next.brake);
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxR);
    const nx = dist > 0.01 ? (dx / dist) * (clamped / maxR) : 0;
    const ny = dist > 0.01 ? (dy / dist) * (clamped / maxR) : 0;
    setJoyKnob({ x: nx * maxR, y: ny * maxR });
    onTouchJoystick(nx, ny);
  };

  const resetJoystick = () => {
    joyActive.current = false;
    setJoyKnob({ x: 0, y: 0 });
    onTouchJoystick(0, 0);
  };

  const hoverDescription = hud.hoveredRoom ? TOUR_TEXT[hud.hoveredRoom.title] : undefined;
  const floorButtons = getFloorButtons(hud.activeBuilding, hud.buildingFloors);
  const walkFloorIndices = Array.from({ length: Math.max(1, hud.buildingFloors) }, (_, i) => i);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none text-slate-100">
      {/* Top Bar: Identity + Clock + Dock Toggle */}
      <div className="flex items-start justify-between gap-4 p-3 sm:p-4">
        <div className="pointer-events-auto border border-white/12 bg-[#0d121a]/92 px-3.5 py-2.5 rounded-md shadow-lg">
          <div className="flex flex-wrap items-center gap-2 text-xs tracking-wider uppercase font-semibold">
            <span
              className="inline-block h-2 w-2 rounded-xs shrink-0"
              style={{ backgroundColor: hud.activeBuildingAccent }}
            />
            <span style={{ color: hud.activeBuildingAccent }}>{hud.activeBuildingName}</span>
            <span className="text-slate-500 font-normal">·</span>
            <span className="text-[11px] font-medium normal-case tracking-normal text-slate-300">
              {hud.activeBuildingNiche}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-300">
            <span className="font-mono-tabular font-semibold text-white">{hud.timeText}</span>
            <span className="text-slate-500">·</span>
            <span>{hud.shiftLabel}</span>
            <span className="text-slate-500">·</span>
            <span className="inline-flex items-center gap-1 text-slate-200">
              <WeatherIcon condition={hud.activeWeather} />
              <span>{hud.weatherLabel}</span>
              {liveNairobiTemp && (
                <span className="font-mono-tabular text-emerald-300">({liveNairobiTemp})</span>
              )}
              {!liveNairobiTemp && hud.weatherMode === 'auto' && (
                <span className="text-slate-400">(Auto)</span>
              )}
              {hud.weatherTimeFactor < 0.99 && (
                <span className="font-mono-tabular text-sky-300">{hud.weatherTimeFactor.toFixed(2)}×</span>
              )}
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-mono-tabular text-slate-400">{hud.statsLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!hud.walking && !hud.driving && (
            <>
              <button
                type="button"
                onClick={onOpenSocialChannels}
                title="Open District Social Platforms & Cross-Company Dispatch"
                className="pointer-events-auto flex items-center gap-1.5 border border-sky-400/35 bg-[#0d121a]/92 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/20 hover:text-white rounded-md transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                <span>Social Channels</span>
                <span className="font-mono-tabular px-1.5 py-0.5 text-[10px] rounded bg-sky-500/20 text-sky-200">
                  {socialNetwork.getStatsSummary().activeJobs}
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenCharacters}
                title="Open 3D Character Studio"
                className="pointer-events-auto flex items-center gap-1.5 border border-emerald-400/35 bg-[#0d121a]/92 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 hover:text-white rounded-md transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Characters</span>
              </button>
              <button
                type="button"
                onClick={() => setDockOpen((v) => !v)}
                title="Toggle Controls (H)"
                className="pointer-events-auto flex items-center gap-1.5 border border-white/12 bg-[#0d121a]/92 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/95 hover:text-white rounded-md transition-colors cursor-pointer"
              >
                <span>Controls</span>
                <span className="font-mono-tabular text-[10px] text-slate-400">[H]</span>
                {dockOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Hovered Bay / Character / Monitor Card */}
      {hud.hoveredRoom && !hud.walking && !hud.driving && !hud.tourActive && (
        <div className="pointer-events-none fixed top-[88px] left-3 sm:left-4 w-[min(80vw,285px)] border border-white/15 bg-[#0d121a]/94 px-3 py-2.5 rounded-md shadow-xl">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
              style={{ backgroundColor: hud.hoveredRoom.color }}
            />
            <h2 className="text-sm font-semibold text-white tracking-tight truncate">{hud.hoveredRoom.title}</h2>
          </div>
          <p className="mt-0.5 text-[11px] font-medium text-slate-300 leading-snug break-words">
            {hud.hoveredRoom.sub}
          </p>
          {hoverDescription && <p className="mt-1.5 text-xs leading-relaxed text-slate-200">{hoverDescription}</p>}
          <div className="mt-1.5 text-[10px] uppercase tracking-wider text-emerald-400 font-medium">
            {hud.hoveredRoom.hint ||
              (hoverDescription
                ? 'Click room to go straight there'
                : 'Click computer to view live screen & activity')}
          </div>
        </div>
      )}

      {/* Autonomous Character Mind & Thought Inspector */}
      {hud.selectedCharacter && !hud.walking && !hud.driving && (
        <div className="pointer-events-auto fixed top-16 right-3 sm:right-4 w-[min(86vw,308px)] max-h-[calc(100vh-11.2rem)] overflow-y-auto border border-white/15 bg-[#0d121a]/95 px-3.5 py-3 rounded-md shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-400">
                <Brain className="w-3.5 h-3.5 shrink-0" />
                <span>Autonomous Mind</span>
                {hud.selectedCharacter.seniority && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-sky-300">{hud.selectedCharacter.seniority}</span>
                  </>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                  style={{ backgroundColor: hud.selectedCharacter.accentColor }}
                />
                <h2 className="text-sm font-semibold text-white tracking-tight truncate">
                  {hud.selectedCharacter.name}
                </h2>
              </div>
              <p className="text-xs font-medium text-slate-200 leading-snug">{hud.selectedCharacter.role}</p>
              <p className="text-[11px] text-slate-400 leading-snug break-words">
                {hud.selectedCharacter.department} · {hud.selectedCharacter.levelLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseCharacter}
              aria-label="Close Character Inspector"
              className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mood & Personality Badges */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-medium">
              Mood: {hud.selectedCharacter.mood}
            </span>
            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
              {hud.selectedCharacter.personality}
            </span>
          </div>

          {/* Current Free-Will Action & Live Thought */}
          <div className="mt-2.5 rounded border border-white/12 bg-white/4 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold leading-snug break-words">
              {hud.selectedCharacter.actionLabel}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-white italic break-words">
              “{hud.selectedCharacter.thought}”
            </p>
          </div>

          {/* Internal Need Bars */}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {[
              { label: 'Focus', val: hud.selectedCharacter.focus, bar: 'bg-sky-400' },
              { label: 'Energy', val: hud.selectedCharacter.energy, bar: 'bg-emerald-400' },
              { label: 'Social', val: hud.selectedCharacter.social, bar: 'bg-amber-400' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/4 border border-white/8 rounded px-2 py-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{stat.label}</span>
                  <span className="font-mono-tabular text-slate-200">{stat.val}%</span>
                </div>
                <div className="mt-1 h-1 w-full bg-white/10 rounded-xs overflow-hidden">
                  <div className={`h-full ${stat.bar} transition-all duration-300`} style={{ width: `${stat.val}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Recent Thoughts Stream */}
          {hud.selectedCharacter.recentThoughts.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-white/10">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Earlier Thoughts
              </div>
              <ul className="mt-1 space-y-1">
                {hud.selectedCharacter.recentThoughts.map((t, idx) => (
                  <li key={`${idx}-${t.slice(0, 16)}`} className="text-[11px] text-slate-400 leading-snug break-words">
                    • “{t}”
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Smartphone · SwiftChat & HubPulse Mobile Dispatch */}
          {(() => {
            const sc = hud.selectedCharacter;
            const charBuilding: BuildingId = sc.buildingId === 'street' ? 'hub' : sc.buildingId;
            const dir = DISTRICT_SOCIAL_DIRECTORY[charBuilding];
            const activeJob = socialNetwork.getActiveJobForBuilding(charBuilding);
            const handle = `@${sc.name.toLowerCase().replace(/^dr\.\s*/i, '').replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 2).join('.')}`;
            return (
              <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-sky-300">
                  <span className="inline-flex items-center gap-1">
                    <Smartphone className="w-3 h-3" />
                    <span>Phone · SwiftChat & HubPulse</span>
                  </span>
                  <span className="font-mono-tabular text-slate-400 normal-case">{handle}</span>
                </div>
                {activeJob && (
                  <div className="rounded border border-white/10 bg-[#080d14] px-2 py-1.5 text-[10.5px]">
                    <div className="flex items-center justify-between font-mono-tabular text-emerald-300">
                      <span>{activeJob.code} · {dir.channel}</span>
                      <span>{activeJob.progress}%</span>
                    </div>
                    <div className="text-slate-200 truncate">{activeJob.title}</div>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const txt = phoneJobText.trim();
                    if (!txt) return;
                    const created = socialNetwork.dispatchJob({
                      platform: phonePlatform,
                      fromBuilding: charBuilding,
                      fromName: sc.name,
                      sourceDevice: 'Phone',
                      toBuilding: phoneTarget,
                      title: txt,
                      brief: `Sent from ${sc.name}'s phone (${sc.role}) via ${phonePlatform.toUpperCase()}.`,
                    });
                    setPhoneJobText('');
                    setPhoneSentNote(`Sent ${created.code} → ${DISTRICT_SOCIAL_DIRECTORY[phoneTarget].shortName}`);
                    onNotifyCompanyJob(phoneTarget);
                  }}
                  className="space-y-1.5"
                >
                  <div className="grid grid-cols-2 gap-1">
                    <select
                      value={phoneTarget}
                      onChange={(e) => setPhoneTarget(e.target.value as BuildingId)}
                      className="rounded border border-white/15 bg-[#080c12] px-1.5 py-1 text-[10.5px] text-white focus:border-sky-400 focus:outline-none"
                    >
                      {DISTRICT_BUILDINGS.map((b) => (
                        <option key={b.id} value={b.id}>
                          To: {b.shortName}
                        </option>
                      ))}
                    </select>
                    <select
                      value={phonePlatform}
                      onChange={(e) => setPhonePlatform(e.target.value as SocialPlatformId)}
                      className="rounded border border-white/15 bg-[#080c12] px-1.5 py-1 text-[10.5px] text-white focus:border-sky-400 focus:outline-none"
                    >
                      <option value="swiftchat">SwiftChat</option>
                      <option value="hubpulse">HubPulse</option>
                      <option value="worklink">WorkLink</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={phoneJobText}
                      onChange={(e) => setPhoneJobText(e.target.value)}
                      placeholder="Send job or task via phone…"
                      className="flex-1 rounded border border-white/15 bg-[#080c12] px-2 py-1 text-[11px] text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-2 py-1 rounded bg-sky-500 text-slate-950 hover:bg-sky-400 text-[10.5px] font-semibold cursor-pointer inline-flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>Send</span>
                    </button>
                  </div>
                  {phoneSentNote && (
                    <div className="text-[10.5px] font-mono-tabular text-emerald-300">
                      {phoneSentNote}
                    </div>
                  )}
                </form>
              </div>
            );
          })()}

          {/* Controls */}
          <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5">
            {!(hud.selectedCharacter.isGuide && hud.tourActive) && (
              <button
                type="button"
                onClick={onNudgeCharacter}
                className="flex items-center gap-1 border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Decide Next</span>
              </button>
            )}
            <button
              type="button"
              onClick={onFocusCharacter}
              className="flex items-center gap-1 border border-white/12 bg-white/5 hover:bg-white/12 text-slate-200 px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer"
            >
              <Crosshair className="w-3 h-3" />
              <span>Focus</span>
            </button>
            <button
              type="button"
              onClick={onToggleFollowCharacter}
              className={`flex items-center gap-1 border px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                hud.selectedCharacter.isFollowing
                  ? 'border-sky-400/60 bg-sky-500/20 text-sky-200'
                  : 'border-white/12 bg-white/5 hover:bg-white/12 text-slate-200'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>{hud.selectedCharacter.isFollowing ? 'Following' : 'Follow'}</span>
            </button>
            {hud.selectedCharacter.isGuide && !hud.tourActive && (
              <button
                type="button"
                onClick={onStartTour}
                className="flex items-center gap-1 border border-emerald-400/50 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer"
              >
                <Compass className="w-3 h-3" />
                <span>Start Tour</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live Interactive Computer OS & Real Project / Research / Data Entry Inspector */}
      {hud.inspectedMonitor && !hud.walking && !hud.driving && (
        <WorkstationInspector
          monitor={hud.inspectedMonitor}
          onClose={onCloseMonitor}
          getInspectedScreenCanvas={getInspectedScreenCanvas}
          onNotifyCompanyJob={onNotifyCompanyJob}
          onForceRedrawMonitor={onForceRedrawMonitor}
        />
      )}

      {/* Active Floor Cutaway Activity Card */}
      {hud.floorActivity && !hud.walking && !hud.driving && !hud.tourActive && !hud.hoveredRoom && (
        <div
          className={`pointer-events-auto fixed top-[88px] left-3 sm:left-4 w-[min(80vw,268px)] max-h-[calc(100vh-12.5rem)] overflow-y-auto border border-white/15 bg-[#0d121a]/94 px-3 py-2.5 rounded-md shadow-xl ${
            hud.selectedCharacter || hud.inspectedMonitor ? 'hidden lg:block' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400">
                Floor Cutaway · Live Activity
              </div>
              <h2 className="mt-0.5 text-sm font-semibold text-white tracking-tight">
                {hud.floorActivity.levelTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onSelectLevel('overview')}
              className="shrink-0 border border-white/12 bg-white/6 hover:bg-white/14 text-slate-200 hover:text-white px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer"
            >
              Overview
            </button>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-300">
            <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono-tabular">
              {hud.floorActivity.activeCount === 0
                ? 'No staff currently on this floor'
                : `${hud.floorActivity.activeCount} ${hud.floorActivity.activeCount === 1 ? 'person' : 'people'} active`}
            </span>
          </div>

          {hud.floorActivity.zones.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5">
              {hud.floorActivity.zones.map((z) => (
                <div key={z.zone} className="flex items-start justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-xs"
                        style={{ backgroundColor: z.color }}
                      />
                      <span className="font-medium text-slate-100 truncate">{z.zone}</span>
                    </div>
                    <p className="mt-0.5 pl-3.5 text-[11px] text-slate-400 leading-snug">{z.status}</p>
                  </div>
                  <span className="shrink-0 font-mono-tabular text-[11px] font-semibold text-emerald-300 bg-white/5 px-1.5 py-0.5 rounded">
                    {z.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guided Tour Card */}
      {hud.tourActive && (
        <div className="pointer-events-auto fixed bottom-24 sm:bottom-20 left-1/2 -translate-x-1/2 w-[min(94vw,540px)] border border-white/15 bg-[#0d121a]/95 p-3.5 rounded-md shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-xs"
                  style={{ backgroundColor: hud.tourColor }}
                />
                <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400">
                  Zuri Guided Tour
                </span>
                <span className="text-slate-500">·</span>
                <span className="font-mono-tabular text-[11px] text-slate-400">
                  {hud.tourIndex + 1}/{hud.tourTotal}
                </span>
              </div>
              <h3 className="mt-1 text-base font-semibold text-white">{hud.tourTitle}</h3>
              <p className="text-[11px] text-slate-400">{hud.tourLab}</p>
            </div>
            <button
              type="button"
              onClick={onEndTour}
              aria-label="End Tour"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-200">
            {hud.tourArrived ? hud.tourText : 'Zuri is walking along the DomainTechHub corridor toward this department…'}
          </p>

          <div className="mt-2.5 h-1 w-full bg-white/10 overflow-hidden rounded-xs">
            <div
              className="h-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${Math.round(hud.tourProgress * 100)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onPrevStop}
                className="flex items-center gap-1 border border-white/12 bg-white/5 hover:bg-white/12 px-2.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={onToggleTourPlay}
                className="flex items-center gap-1 border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer"
              >
                {hud.tourPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{hud.tourPlaying ? 'Pause' : 'Play'}</span>
              </button>
              <button
                type="button"
                onClick={onNextStop}
                className="flex items-center gap-1 border border-white/12 bg-white/5 hover:bg-white/12 px-2.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onEndTour}
              className="text-xs text-slate-300 hover:text-white px-2 py-1 cursor-pointer"
            >
              Exit tour
            </button>
          </div>
        </div>
      )}

      {/* First-Person Walk HUD */}
      {hud.walking && (
        <>
          {hud.walkLocked && (
            <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-xs bg-white/75" />
          )}

          <div className="pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(95vw,600px)] border border-white/15 bg-[#0d121a]/94 px-4 py-3 rounded-md shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <Footprints className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-white">Walk Mode</span>
                <span className="text-slate-500">·</span>
                <span className="font-mono-tabular text-emerald-300">
                  {hud.walkFloor === 0 ? 'Ground (G)' : `Level ${hud.walkFloor}`}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {walkFloorIndices.map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => onSetWalkFloor(lv)}
                    className={`px-2 py-1 text-[11px] font-mono-tabular rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      hud.walkFloor === lv
                        ? 'bg-emerald-500 text-slate-950 font-semibold'
                        : 'bg-white/8 text-slate-300 hover:bg-white/15'
                    }`}
                  >
                    {lv === 0 ? 'G' : `L${lv}`}
                  </button>
                ))}
                {hud.nearPlayerCarInWalk && (
                  <button
                    type="button"
                    onClick={onEnterCarFromWalk}
                    className="ml-1 flex items-center gap-1 border border-emerald-400/60 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-2.5 py-1 text-xs font-semibold rounded cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>Get In Car [G]</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleWalk}
                  className="ml-2 border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 px-2.5 py-1 text-xs font-medium rounded cursor-pointer whitespace-nowrap shrink-0"
                >
                  Exit [Esc]
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400 font-mono-tabular">
              WASD move across plaza & into open doors · Shift run · 0–{Math.max(0, hud.buildingFloors - 1)} or R/F floor{hud.nearPlayerCarInWalk ? ' · G enter car' : ''} · Esc exit
            </p>
          </div>

          {/* Touch Joystick for mobile / tablet walkthrough */}
          <div
            ref={joyRef}
            onPointerDown={(e) => {
              joyActive.current = true;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              updateJoystick(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (joyActive.current) updateJoystick(e.clientX, e.clientY);
            }}
            onPointerUp={resetJoystick}
            onPointerCancel={resetJoystick}
            className="pointer-events-auto sm:hidden fixed bottom-28 left-4 h-24 w-24 rounded-full border border-white/20 bg-[#0d121a]/85 flex items-center justify-center touch-none"
          >
            <div
              className="h-9 w-9 rounded-full bg-emerald-400/90 border border-white/40 transition-transform duration-75"
              style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
            />
          </div>
        </>
      )}

      {/* Drivable Vehicle Instrument Cluster & GPS HUD */}
      {hud.driving && (
        <>
          <div className="pointer-events-auto fixed bottom-3 left-1/2 -translate-x-1/2 w-[min(96vw,860px)] border border-white/15 bg-[#0d121a]/94 px-3.5 py-3 rounded-md shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Speedometer, Gear, Street & GPS Distance */}
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-1.5 border border-white/12 bg-[#070b12] px-2.5 py-1.5 rounded">
                  <span className="font-mono-tabular text-2xl font-bold text-white leading-none">
                    {hud.driveSpeedKmh}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">km/h</span>
                </div>
                <div className="flex items-center gap-1 border border-white/12 bg-[#070b12] px-2 py-1.5 rounded font-mono-tabular text-xs font-bold">
                  {(['P', 'R', 'N', 'D'] as const).map((g) => (
                    <span
                      key={g}
                      className={`px-1 rounded ${
                        hud.driveGear === g
                          ? g === 'D'
                            ? 'bg-emerald-500 text-slate-950'
                            : g === 'R'
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-sky-400 text-slate-950'
                          : 'text-slate-600'
                      }`}
                    >
                      {g}
                    </span>
                  ))}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <Car className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate">{hud.driveStreetLabel}</span>
                  </div>
                  {hud.driveTargetBuilding && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-300 font-mono-tabular">
                      <Navigation
                        className="w-3 h-3 text-emerald-400 shrink-0 transition-transform duration-150"
                        style={{ transform: `rotate(${hud.driveTargetBearingDeg}deg)` }}
                      />
                      <span>
                        GPS: {DISTRICT_BUILDINGS.find((b) => b.id === hud.driveTargetBuilding)?.shortName} ·{' '}
                        {hud.driveTargetDistance}m
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleDriveCamera}
                  className="flex items-center gap-1 border border-white/15 bg-white/6 hover:bg-white/14 px-2 py-1.5 text-[11px] font-medium text-slate-200 rounded transition-colors cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5 text-sky-300" />
                  <span>{hud.driveCameraMode === 'hood' ? 'Hood' : 'Chase'} [V]</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleDriveHeadlights}
                  className={`flex items-center gap-1 border px-2 py-1.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                    hud.driveHeadlights
                      ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                      : 'border-white/15 bg-white/6 text-slate-300'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Lights [L]</span>
                </button>
                <button
                  type="button"
                  onClick={onCarHorn}
                  className="flex items-center gap-1 border border-white/15 bg-white/6 hover:bg-white/14 px-2 py-1.5 text-[11px] font-medium text-slate-200 rounded transition-colors cursor-pointer"
                >
                  <Megaphone className="w-3.5 h-3.5 text-slate-300" />
                  <span>Horn [B]</span>
                </button>
                <button
                  type="button"
                  onClick={onStepOutOfCar}
                  className={`flex items-center gap-1 border px-2.5 py-1.5 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                    hud.driveNearbyBuilding
                      ? 'border-emerald-400 bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      : 'border-emerald-400/45 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                  }`}
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>
                    {hud.driveNearbyName ? `Step Out at ${hud.driveNearbyName} [F]` : 'Park & Step Out [F]'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleDrive()}
                  className="border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 px-2 py-1.5 text-[11px] font-medium rounded cursor-pointer"
                >
                  Exit [Esc]
                </button>
              </div>
            </div>

            {/* GPS Destination Bar */}
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1 overflow-x-auto no-scrollbar">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1 shrink-0">
                GPS Target
              </span>
              {DISTRICT_BUILDINGS.map((b) => {
                const active = hud.driveTargetBuilding === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSetDriveTarget(active ? null : b.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-400 text-white font-semibold'
                        : 'bg-white/4 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-xs shrink-0"
                      style={{ backgroundColor: b.accent }}
                    />
                    <span>{b.shortName}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-1.5 text-[10.5px] text-slate-400 font-mono-tabular">
              W/Up accelerate · S/Down brake & reverse · A/D steer · Space handbrake · Drag viewport to look · F park & walk into office
            </p>
          </div>

          {/* Mobile Touch Driving Pedals & Steering */}
          <div className="pointer-events-auto sm:hidden fixed bottom-36 left-3 flex items-center gap-2 touch-none">
            <button
              type="button"
              onPointerDown={() => setDriveControl({ steer: -1 })}
              onPointerUp={() => setDriveControl({ steer: 0 })}
              onPointerLeave={() => setDriveControl({ steer: 0 })}
              onPointerCancel={() => setDriveControl({ steer: 0 })}
              className="h-12 w-12 rounded border border-white/20 bg-[#0d121a]/90 text-sm font-bold text-white active:bg-sky-500 active:text-slate-950"
            >
              ◀
            </button>
            <button
              type="button"
              onPointerDown={() => setDriveControl({ steer: 1 })}
              onPointerUp={() => setDriveControl({ steer: 0 })}
              onPointerLeave={() => setDriveControl({ steer: 0 })}
              onPointerCancel={() => setDriveControl({ steer: 0 })}
              className="h-12 w-12 rounded border border-white/20 bg-[#0d121a]/90 text-sm font-bold text-white active:bg-sky-500 active:text-slate-950"
            >
              ▶
            </button>
          </div>
          <div className="pointer-events-auto sm:hidden fixed bottom-36 right-3 flex items-center gap-2 touch-none">
            <button
              type="button"
              onPointerDown={() => setDriveControl({ throttle: -1, brake: true })}
              onPointerUp={() => setDriveControl({ throttle: 0, brake: false })}
              onPointerLeave={() => setDriveControl({ throttle: 0, brake: false })}
              onPointerCancel={() => setDriveControl({ throttle: 0, brake: false })}
              className="h-12 px-3 rounded border border-rose-400/40 bg-[#0d121a]/90 text-xs font-semibold text-rose-200 active:bg-rose-500 active:text-slate-950"
            >
              Rev/Brk
            </button>
            <button
              type="button"
              onPointerDown={() => setDriveControl({ throttle: 1, brake: false })}
              onPointerUp={() => setDriveControl({ throttle: 0 })}
              onPointerLeave={() => setDriveControl({ throttle: 0 })}
              onPointerCancel={() => setDriveControl({ throttle: 0 })}
              className="h-12 px-3.5 rounded border border-emerald-400/40 bg-[#0d121a]/90 text-xs font-semibold text-emerald-200 active:bg-emerald-500 active:text-slate-950"
            >
              Gas
            </button>
          </div>
        </>
      )}

      {/* Collapsible Bottom Control Dock */}
      {!hud.walking && !hud.driving && dockOpen && (
        <div className="pointer-events-auto fixed bottom-3 left-1/2 -translate-x-1/2 w-[min(96vw,1080px)] border border-white/12 bg-[#0d121a]/92 px-3 py-2.5 rounded-md shadow-2xl">
          {/* Building Switcher Row */}
          <div className="pb-2 mb-2 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 mr-1 shrink-0">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>District</span>
            </span>
            {DISTRICT_BUILDINGS.map((b) => {
              const active = hud.activeBuilding === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelectBuilding(b.id)}
                  title={`${b.name} · ${b.niche}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white/15 border-white/35 text-white font-semibold'
                      : 'bg-white/4 border-white/8 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-xs shrink-0"
                    style={{ backgroundColor: b.accent }}
                  />
                  <span>{b.shortName}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Floor Selector */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
              {floorButtons.map((lv) => {
                const active = hud.activeLevel === lv.key;
                return (
                  <button
                    key={lv.key}
                    type="button"
                    onClick={() => onSelectLevel(lv.key)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-emerald-500 text-slate-950 font-semibold'
                        : 'bg-white/5 text-slate-300 hover:bg-white/12 hover:text-white'
                    }`}
                  >
                    {lv.label}
                  </button>
                );
              })}
            </div>

            {/* Modes: Tour, Walk, Staff */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={hud.tourActive ? onEndTour : onStartTour}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                  hud.tourActive
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/12 bg-white/5 text-slate-200 hover:bg-white/12'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{hud.tourActive ? 'End Tour' : 'Zuri Tour'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleWalk}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-white/12 bg-white/5 text-slate-200 hover:bg-white/12 transition-colors cursor-pointer"
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>Walk In</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleDrive(hud.activeBuilding === 'hub' ? 'bank' : hud.activeBuilding)}
                title="Drive executive sedan to any company in the district"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-sky-400/40 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Car className="w-3.5 h-3.5 text-sky-400" />
                <span>Drive Car</span>
              </button>

              <button
                type="button"
                onClick={onToggleStaff}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  hud.staffVisible
                    ? 'border-white/18 bg-white/10 text-white'
                    : 'border-white/10 bg-white/3 text-slate-400'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{hud.staffVisible ? 'Staff ON' : 'Staff OFF'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleAudio}
                title="Toggle Ambient Office Audio"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                  hud.audioEnabled
                    ? 'border-white/18 bg-white/10 text-white'
                    : 'border-white/10 bg-white/3 text-slate-400'
                }`}
              >
                {hud.audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>{hud.audioEnabled ? 'Audio ON' : 'Muted'}</span>
              </button>
            </div>
          </div>

          {/* Second Row: Time Speed, Weather & Shift Presets */}
          <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 mr-1">Speed</span>
              {RATES.map((r) => (
                <button
                  key={r.rate}
                  type="button"
                  onClick={() => onSetRate(r.rate)}
                  className={`px-2 py-1 text-[11px] font-mono-tabular rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    hud.simRate === r.rate
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'bg-white/5 text-slate-300 hover:bg-white/12'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 mr-1 shrink-0">Weather</span>
              {WEATHER_MODES.map((w) => (
                <button
                  key={w.mode}
                  type="button"
                  onClick={() => {
                    setLiveNairobiTemp(null);
                    setNairobiError(null);
                    onSetWeatherMode(w.mode);
                  }}
                  className={`px-2 py-1 text-[11px] rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    hud.weatherMode === w.mode
                      ? 'bg-indigo-400 text-slate-950 font-semibold'
                      : 'bg-white/5 text-slate-300 hover:bg-white/12 hover:text-white'
                  }`}
                >
                  {w.label}
                </button>
              ))}
              <button
                type="button"
                onClick={syncLiveNairobi}
                disabled={nairobiLoading}
                title={nairobiError ? `Sync error: ${nairobiError}` : 'Sync real Africa/Nairobi time & live weather'}
                className={`ml-1 flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  nairobiError
                    ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
                    : liveNairobiTemp
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 font-semibold'
                      : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>{nairobiLoading ? 'Syncing…' : 'Live Nairobi'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 mr-1 shrink-0">Jump</span>
              {TIME_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setLiveNairobiTemp(null);
                    onJumpToTime(p.minutes);
                  }}
                  className="px-2 py-1 text-[11px] rounded bg-white/5 text-slate-300 hover:bg-white/12 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
