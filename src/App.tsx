import { Component, lazy, Suspense, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from 'react';
import { HudOverlay } from './components/HudOverlay';
import { AtriumEngine, type SceneLoadProgress } from './scene/AtriumEngine';
import type { HudSnapshot } from './scene/constants';

const CharacterStudioModal = lazy(() =>
  import('./components/CharacterStudioModal').then((m) => ({ default: m.CharacterStudioModal }))
);
const SocialChannelsPanel = lazy(() =>
  import('./components/SocialChannelsPanel').then((m) => ({ default: m.SocialChannelsPanel }))
);

const INITIAL_HUD: HudSnapshot = {
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
};

interface BoundaryState {
  errorMessage: string | null;
}

class ViewportErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { errorMessage: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { errorMessage: error?.message || 'Unexpected viewport error.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ViewportErrorBoundary caught error:', error, info);
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
            <p className="mt-2 text-sm text-slate-400">{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-sm font-medium bg-emerald-500 text-slate-950 rounded hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              Reload 3D Viewport
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AtriumApp() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AtriumEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [loadProgress, setLoadProgress] = useState<SceneLoadProgress>({
    percent: 5,
    stage: 'Initializing WebGL context…',
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

  useEffect(() => {
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
  }, []);

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
      <div
        role="alert"
        className="w-full h-full flex items-center justify-center bg-[#0b1322] text-slate-200 p-6"
      >
        <div className="max-w-md border border-white/15 bg-slate-900 p-6 rounded-md shadow-2xl">
          <h1 className="text-lg font-semibold text-white">3D Viewport Unavailable</h1>
          <p className="mt-2 text-sm text-slate-400">{webglError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm font-medium bg-emerald-500 text-slate-950 rounded hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            Reload 3D Viewport
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0b1322]">
      <div
        ref={mountRef}
        role="application"
        aria-label="Interactive 3D DomainTechHub Nairobi District Viewport"
        className="w-full h-full"
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
            <p className="mt-2 text-xs text-slate-300">{loadProgress.stage}</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={loadProgress.percent}
              aria-label="3D scene asset build progress"
              className="mt-3 h-1.5 w-full overflow-hidden rounded-xs bg-white/10"
            >
              <div
                className="h-full bg-emerald-400 transition-all duration-150"
                style={{ width: `${loadProgress.percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10.5px] font-mono-tabular text-slate-400">
              <span>THREE.LoadingManager pipeline</span>
              <span>
                {loadProgress.loaded}/{Math.max(1, loadProgress.total)} stages
              </span>
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
  return (
    <ViewportErrorBoundary>
      <AtriumApp />
    </ViewportErrorBoundary>
  );
}
