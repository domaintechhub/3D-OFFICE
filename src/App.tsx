import { Component, lazy, Suspense, type ErrorInfo, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { HudOverlay } from './components/HudOverlay';
import { AtriumEngine, type SceneLoadProgress } from './scene/AtriumEngine';
import type { HudSnapshot } from './scene/constants';
import {
  probeBrowserCapabilities,
  writeStoredQualityMode,
  type PerfTelemetry,
  type QualityMode,
} from './scene/quality';
import { isOfflineMode } from './utils/standalone';

const CharacterStudioModal = lazy(() =>
  import('./components/CharacterStudioModal').then((m) => ({ default: m.CharacterStudioModal }))
);
const SocialChannelsPanel = lazy(() =>
  import('./components/SocialChannelsPanel').then((m) => ({ default: m.SocialChannelsPanel }))
);

const LOADING_TIPS = [
  'Drag to orbit, scroll to zoom, and click any floor chip or 3D office bay to focus.',
  'Press W to walk inside the lobby in first-person or Drive Car to tour the district avenue.',
  'Use the Quality menu (Auto / Eco / Low / Med / High) anytime; Auto adapts to your GPU FPS.',
  'Press F (when not walking or driving) or click Stats to inspect FPS, draw calls, and memory.',
];

function createInitialHud(): HudSnapshot {
  return {
    simMinutes: 9 * 60 + 25,
    simRate: 4,
    timeText: '09:25',
    shiftLabel: 'Morning shift',
    statsLabel: 'Preparing 3D district…',
    weatherMode: 'auto',
    activeWeather: 'clear',
    weatherLabel: 'Clear',
    weatherTimeFactor: 1,
    activeBuilding: 'hub',
    activeBuildingName: 'DomainTechHub Office',
    activeBuildingNiche: 'Software & Digital Agency',
    activeBuildingAccent: '#6fe3a1',
    buildingFloors: 6,
    activeLevel: 'overview',
    staffVisible: true,
    walking: false,
    walkFloor: 0,
    walkLocked: false,
    tourActive: false,
    tourPlaying: false,
    tourArrived: false,
    tourIndex: 0,
    tourTotal: 17,
    tourTitle: 'Maintenance & Security',
    tourLab: '',
    tourText: '',
    tourColor: '#6fe3a1',
    tourProgress: 1 / 17,
    hoveredRoom: null,
    floorActivity: null,
    inspectedMonitor: null,
    selectedCharacter: null,
    audioEnabled: true,
    driving: false,
    driveSpeedKmh: 0,
    driveGear: 'P',
    driveCameraMode: 'chase',
    driveHeadlights: true,
    driveStreetLabel: 'DomainTechHub Parking Court',
    driveTargetBuilding: 'bank',
    driveTargetDistance: 69,
    driveTargetBearingDeg: 0,
    driveNearbyBuilding: 'hub',
    driveNearbyName: 'DomainTechHub',
    nearPlayerCarInWalk: false,
    driveTrafficSignal: null,
    qualityMode: 'auto',
    activeTier: 'med',
    offlineMode: isOfflineMode(),
  };
}

interface BoundaryProps {
  children: ReactNode;
  onSwitchLowQuality: () => void;
}

interface BoundaryState {
  errorMessage: string | null;
}

class ViewportErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { errorMessage: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { errorMessage: error?.message || 'Unexpected viewport error.' };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Error captured safely in component state for recovery UI
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <div
          role="alert"
          className="w-full h-full flex items-center justify-center bg-[#0b1322] text-slate-200 p-6"
        >
          <div className="max-w-md border border-white/15 bg-slate-900 p-6 rounded-md shadow-2xl">
            <h1 className="text-lg font-semibold text-white">3D Viewport Recovery</h1>
            <p className="mt-2 text-sm text-slate-300">{this.state.errorMessage}</p>
            <p className="mt-2 text-xs text-slate-400">
              If your browser or GPU driver paused WebGL, switching to Low quality lowers texture size, shadow map load, and particle counts.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium bg-emerald-500 text-slate-950 rounded hover:bg-emerald-400 transition-colors cursor-pointer"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => {
                  writeStoredQualityMode('low');
                  this.setState({ errorMessage: null });
                  this.props.onSwitchLowQuality();
                }}
                className="px-4 py-2 text-sm font-medium border border-sky-400/50 bg-sky-500/20 text-sky-100 rounded hover:bg-sky-500/30 transition-colors cursor-pointer"
              >
                Switch to Low quality
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const FALLBACK_GALLERY_CARDS = [
  {
    id: 'plaza',
    title: 'DomainTechHub Plaza & Glass Facade',
    subtitle: 'Level 0–5 Flagship Campus · Nairobi Highland Daylight',
    accent: '#6fe3a1',
    svg: (
      <svg viewBox="0 0 360 180" className="w-full h-36 rounded border border-white/10 bg-[#0d192b]">
        <defs>
          <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e4976" />
            <stop offset="100%" stopColor="#89b8d8" />
          </linearGradient>
        </defs>
        <rect width="360" height="125" fill="url(#sky1)" />
        <rect y="125" width="360" height="55" fill="#232c37" />
        <rect x="70" y="34" width="220" height="92" fill="#1b3048" stroke="#6fe3a1" strokeWidth="2" />
        <line x1="70" y1="56" x2="290" y2="56" stroke="#7fb8de" strokeWidth="1" />
        <line x1="70" y1="78" x2="290" y2="78" stroke="#7fb8de" strokeWidth="1" />
        <line x1="70" y1="100" x2="290" y2="100" stroke="#7fb8de" strokeWidth="1" />
        <rect x="155" y="102" width="50" height="24" fill="#6fe3a1" fillOpacity="0.32" />
        <rect x="20" y="140" width="320" height="10" fill="#3a4554" />
      </svg>
    ),
  },
  {
    id: 'atrium',
    title: 'Engineering Floors & Cutaway Departments',
    subtitle: 'Web Dev, AI Solutions, Executive Boardroom & Workstations',
    accent: '#7fb0ff',
    svg: (
      <svg viewBox="0 0 360 180" className="w-full h-36 rounded border border-white/10 bg-[#101723]">
        <rect width="360" height="180" fill="#101826" />
        <rect x="28" y="30" width="144" height="52" fill="#1b2c44" stroke="#7fb0ff" strokeWidth="1.5" />
        <rect x="188" y="30" width="144" height="52" fill="#2b243c" stroke="#c0a8ff" strokeWidth="1.5" />
        <rect x="28" y="96" width="144" height="52" fill="#1d3228" stroke="#6fe3a1" strokeWidth="1.5" />
        <rect x="188" y="96" width="144" height="52" fill="#35281c" stroke="#ffc078" strokeWidth="1.5" />
        <circle cx="65" cy="56" r="8" fill="#7fb0ff" />
        <circle cx="225" cy="56" r="8" fill="#c0a8ff" />
        <circle cx="65" cy="122" r="8" fill="#6fe3a1" />
        <circle cx="225" cy="122" r="8" fill="#ffc078" />
      </svg>
    ),
  },
  {
    id: 'vault',
    title: 'Basement Server & Solar Power Vault (B1/B2)',
    subtitle: 'High-Density Compute Racks, Cooling & Solar Inverters',
    accent: '#38bdf8',
    svg: (
      <svg viewBox="0 0 360 180" className="w-full h-36 rounded border border-white/10 bg-[#080d16]">
        <rect width="360" height="180" fill="#080e17" />
        {[40, 96, 152, 208, 264].map((x) => (
          <g key={x}>
            <rect x={x} y="32" width="38" height="114" fill="#111b2a" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1={x + 8} y1="48" x2={x + 30} y2="48" stroke="#34d399" strokeWidth="2" />
            <line x1={x + 8} y1="64" x2={x + 30} y2="64" stroke="#38bdf8" strokeWidth="2" />
            <line x1={x + 8} y1="80" x2={x + 30} y2="80" stroke="#34d399" strokeWidth="2" />
            <line x1={x + 8} y1="96" x2={x + 30} y2="96" stroke="#38bdf8" strokeWidth="2" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    id: 'district',
    title: '8-Building Innovation District & Boulevard',
    subtitle: 'Horizon Bank, VitalCare Medical, Apex EV, BitVault & SwiftPort',
    accent: '#f59e0b',
    svg: (
      <svg viewBox="0 0 360 180" className="w-full h-36 rounded border border-white/10 bg-[#121927]">
        <rect width="360" height="180" fill="#131c2b" />
        <rect x="20" y="96" width="320" height="22" fill="#2c3543" />
        <rect x="34" y="42" width="54" height="50" fill="#2a4a8a" />
        <rect x="104" y="28" width="64" height="64" fill="#1e6f5c" />
        <rect x="184" y="38" width="64" height="54" fill="#8f5a2b" />
        <rect x="264" y="32" width="60" height="60" fill="#3a4c6e" />
        <rect x="52" y="128" width="68" height="34" fill="#4f356e" />
        <rect x="144" y="128" width="76" height="34" fill="#26647a" />
        <rect x="242" y="128" width="72" height="34" fill="#6f4325" />
      </svg>
    ),
  },
];

function WebglFallbackGallery({
  reason,
  onRetry,
  onSwitchLow,
}: {
  reason: string;
  onRetry: () => void;
  onSwitchLow: () => void;
}) {
  return (
    <div
      role="alert"
      className="w-full h-full overflow-y-auto bg-[#0b1322] text-slate-200 p-4 sm:p-8"
      style={{
        paddingTop: 'max(1.5rem, var(--sat))',
        paddingBottom: 'max(1.5rem, var(--sab))',
      }}
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-md border border-amber-400/35 bg-[#0d121a] p-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                WebGL Graphics Fallback Gallery
              </span>
              <h1 className="mt-1 text-xl font-bold text-white">
                DomainTechHub 3D Campus — Static Architectural Preview
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onSwitchLow}
                className="px-3.5 py-2 text-xs font-semibold rounded border border-sky-400/45 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30 cursor-pointer"
              >
                Switch to Low Quality &amp; Retry
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="px-3.5 py-2 text-xs font-semibold rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                Reload Viewport
              </button>
            </div>
          </div>
          <p className="mt-2.5 text-sm text-slate-300">{reason}</p>
          <p className="mt-1 text-xs text-slate-400">
            Enable hardware acceleration in browser settings or close extra tabs, then retry to launch the interactive 3D walkthrough.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FALLBACK_GALLERY_CARDS.map((card) => (
            <div
              key={card.id}
              className="rounded-md border border-white/12 bg-[#0d121a] p-4 shadow-xl space-y-2.5"
            >
              {card.svg}
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-xs"
                    style={{ backgroundColor: card.accent }}
                  />
                  <h2 className="text-sm font-semibold text-white">{card.title}</h2>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{card.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AtriumApp({ onSwitchLowQuality }: { onSwitchLowQuality: () => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AtriumEngine | null>(null);
  const caps = useMemo(() => probeBrowserCapabilities(), []);
  const [hud, setHud] = useState<HudSnapshot>(createInitialHud);
  const [webglError, setWebglError] = useState<string | null>(() =>
    caps.webglAvailable
      ? null
      : 'WebGL is unavailable or disabled on this device. Displaying architectural preview gallery instead.'
  );
  const [studioOpen, setStudioOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [showPerf, setShowPerf] = useState(false);
  const [telemetry, setTelemetry] = useState<PerfTelemetry | null>(null);
  const [loadProgress, setLoadProgress] = useState<SceneLoadProgress>({
    percent: 5,
    stage: 'Initializing 3D renderer…',
    loaded: 0,
    total: 5,
    done: false,
  });

  const hudRef = useRef(hud);
  hudRef.current = hud;
  const studioOpenRef = useRef(studioOpen);
  studioOpenRef.current = studioOpen;
  const socialOpenRef = useRef(socialOpen);
  socialOpenRef.current = socialOpen;

  // Keep --vvh synced to visualViewport / orientationchange / resize on mobile browsers
  useEffect(() => {
    const syncViewportHeight = () => {
      const h = window.visualViewport?.height || window.innerHeight || 720;
      document.documentElement.style.setProperty('--vvh', `${Math.round(h)}px`);
    };
    syncViewportHeight();
    window.addEventListener('resize', syncViewportHeight);
    window.addEventListener('orientationchange', syncViewportHeight);
    window.visualViewport?.addEventListener('resize', syncViewportHeight);
    window.visualViewport?.addEventListener('scroll', syncViewportHeight);
    return () => {
      window.removeEventListener('resize', syncViewportHeight);
      window.removeEventListener('orientationchange', syncViewportHeight);
      window.visualViewport?.removeEventListener('resize', syncViewportHeight);
      window.visualViewport?.removeEventListener('scroll', syncViewportHeight);
    };
  }, []);

  // Track live browser online/offline transitions
  useEffect(() => {
    const syncOnlineStatus = () => {
      setHud((prev) => ({ ...prev, offlineMode: isOfflineMode() }));
    };
    window.addEventListener('online', syncOnlineStatus);
    window.addEventListener('offline', syncOnlineStatus);
    return () => {
      window.removeEventListener('online', syncOnlineStatus);
      window.removeEventListener('offline', syncOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!caps.webglAvailable) return;
    const el = mountRef.current;
    if (!el) return;

    try {
      const engine = new AtriumEngine(
        el,
        (snapshot) => {
          setHud(snapshot);
        },
        (fatalMsg) => {
          setWebglError(fatalMsg);
        },
        (progress) => {
          setLoadProgress(progress);
        }
      );
      engineRef.current = engine;

      return () => {
        engine.dispose();
        engineRef.current = null;
      };
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'Unable to initialize 3D WebGL context.');
    }
  }, [caps.webglAvailable]);

  // Poll telemetry lightly for top-bar FPS & expanded Perf panel
  useEffect(() => {
    const intervalMs = showPerf ? 250 : 650;
    const id = window.setInterval(() => {
      const eng = engineRef.current;
      if (eng) {
        setTelemetry(eng.getPerfTelemetry());
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [showPerf]);

  useEffect(() => {
    const handleShortcutKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (studioOpenRef.current || socialOpenRef.current) return;

      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const engine = engineRef.current;
      if (!engine) return;

      const key = e.key.toLowerCase();
      const currentHud = hudRef.current;

      if (e.code === 'KeyW' || key === 'w') {
        if (!currentHud.driving && !currentHud.walking) {
          engine.toggleWalk();
        }
      } else if (e.code === 'KeyF' || key === 'f') {
        if (!currentHud.driving && !currentHud.walking) {
          setShowPerf((v) => !v);
        }
      } else if (e.code === 'KeyH' || key === 'h') {
        engine.soundCarHorn();
      } else if (e.code === 'KeyC' || key === 'c') {
        engine.cycleCameraMode();
      }
    };

    window.addEventListener('keydown', handleShortcutKeyDown);
    return () => window.removeEventListener('keydown', handleShortcutKeyDown);
  }, []);

  if (webglError) {
    return (
      <WebglFallbackGallery
        reason={webglError}
        onRetry={() => window.location.reload()}
        onSwitchLow={() => {
          writeStoredQualityMode('low');
          onSwitchLowQuality();
        }}
      />
    );
  }

  const tipIdx = Math.min(LOADING_TIPS.length - 1, Math.floor((loadProgress.percent / 100) * LOADING_TIPS.length));

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0b1322]">
      <div
        ref={mountRef}
        role="application"
        aria-label="Interactive 3D DomainTechHub Nairobi District Viewport"
        className="w-full h-full touch-none"
      />
      {!loadProgress.done && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading 3D office district"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#0b1322]/96 px-6"
        >
          <div className="w-full max-w-md rounded-md border border-white/15 bg-[#0d121a] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  DomainTechHub 3D Engine
                </span>
              </div>
              <span className="font-mono-tabular text-xs font-semibold text-white">
                {loadProgress.percent}%
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-200">{loadProgress.stage}</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={loadProgress.percent}
              aria-label="3D scene asset build progress"
              className="mt-3 h-2 w-full overflow-hidden rounded-xs bg-white/10"
            >
              <div
                className="h-full bg-emerald-400 transition-all duration-150"
                style={{ width: `${loadProgress.percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10.5px] font-mono-tabular text-slate-400">
              <span>{caps.webgl2 ? 'WebGL2 Pipeline' : 'WebGL1 Compatibility'}</span>
              <span>
                {loadProgress.loaded}/{Math.max(1, loadProgress.total)} stages
              </span>
            </div>
            <div className="mt-3 rounded border border-white/10 bg-[#080d14] px-3 py-2 text-[11px] text-slate-300 leading-relaxed">
              <span className="font-semibold text-emerald-300">Tip: </span>
              {LOADING_TIPS[tipIdx]}
            </div>
          </div>
        </div>
      )}
      <HudOverlay
        hud={hud}
        onSelectBuilding={(id) => engineRef.current?.selectBuilding(id)}
        onSelectLevel={(k) => engineRef.current?.selectLevel(k)}
        onStartTour={() => engineRef.current?.startTour(0)}
        onEndTour={() => engineRef.current?.endTour()}
        onPrevStop={() => engineRef.current?.prevStop()}
        onNextStop={() => engineRef.current?.nextStop()}
        onToggleTourPlay={() => engineRef.current?.toggleTourPlay()}
        onToggleWalk={() => engineRef.current?.toggleWalk()}
        onSetWalkFloor={(lv) => engineRef.current?.setWalkFloor(lv)}
        onTouchJoystick={(nx, ny) => engineRef.current?.setTouchJoystick(nx, ny)}
        onToggleStaff={() => engineRef.current?.toggleStaff()}
        onToggleAudio={() => engineRef.current?.toggleAudio()}
        onSetRate={(r) => engineRef.current?.setRate(r)}
        onJumpToTime={(m) => engineRef.current?.jumpToTime(m)}
        onSetWeatherMode={(mode) => engineRef.current?.setWeatherMode(mode)}
        onCloseMonitor={() => engineRef.current?.closeMonitorInspector()}
        getInspectedScreenCanvas={() => engineRef.current?.getInspectedScreenCanvas() ?? null}
        onCloseCharacter={() => engineRef.current?.closeCharacterInspector()}
        onFocusCharacter={() => engineRef.current?.focusSelectedCharacter()}
        onToggleFollowCharacter={() => engineRef.current?.toggleFollowCharacter()}
        onNudgeCharacter={() => engineRef.current?.nudgeSelectedCharacter()}
        onOpenCharacters={() => setStudioOpen(true)}
        onOpenSocialChannels={() => setSocialOpen(true)}
        onNotifyCompanyJob={(bId) => engineRef.current?.notifyCompanyJob(bId)}
        onToggleDrive={(bId) => engineRef.current?.toggleDrive(bId)}
        onStepOutOfCar={() => engineRef.current?.stepOutOfCar()}
        onEnterCarFromWalk={() => engineRef.current?.enterCarFromWalk()}
        onToggleDriveCamera={() => engineRef.current?.toggleDriveCamera()}
        onToggleDriveHeadlights={() => engineRef.current?.toggleDriveHeadlights()}
        onSetDriveTarget={(bId) => engineRef.current?.setDriveTarget(bId)}
        onDriveTouch={(t, s, b) => engineRef.current?.setDriveTouchInput(t, s, b)}
        onCarHorn={() => engineRef.current?.soundCarHorn()}
        onForceRedrawMonitor={() => engineRef.current?.forceRedrawInspectedMonitor()}
        onApplyLiveNairobi={(minutes, cond) => engineRef.current?.applyLiveNairobiSync(minutes, cond)}
        onSetQualityMode={(mode: QualityMode) => {
          engineRef.current?.setQualityMode(mode);
          setTelemetry(engineRef.current?.getPerfTelemetry() ?? null);
        }}
        telemetry={telemetry}
        showPerf={showPerf}
        onTogglePerf={() => setShowPerf((v) => !v)}
      />
      {studioOpen && (
        <Suspense fallback={null}>
          <CharacterStudioModal isOpen={studioOpen} onClose={() => setStudioOpen(false)} />
        </Suspense>
      )}
      {socialOpen && (
        <Suspense fallback={null}>
          <SocialChannelsPanel
            isOpen={socialOpen}
            activeBuilding={hud.activeBuilding}
            onClose={() => setSocialOpen(false)}
            onSelectBuilding={(id) => engineRef.current?.selectBuilding(id)}
            onJobDispatched={(bId) => engineRef.current?.notifyCompanyJob(bId)}
          />
        </Suspense>
      )}
    </main>
  );
}

export default function App() {
  const [mountKey, setMountKey] = useState(0);
  const handleSwitchLowQuality = () => {
    writeStoredQualityMode('low');
    setMountKey((k) => k + 1);
  };
  return (
    <ViewportErrorBoundary onSwitchLowQuality={handleSwitchLowQuality}>
      <AtriumApp key={mountKey} onSwitchLowQuality={handleSwitchLowQuality} />
    </ViewportErrorBoundary>
  );
}
