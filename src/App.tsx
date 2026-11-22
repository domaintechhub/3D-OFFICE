import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from 'react';
import { CharacterStudioModal } from './components/CharacterStudioModal';
import { HudOverlay } from './components/HudOverlay';
import { SocialChannelsPanel } from './components/SocialChannelsPanel';
import { AtriumEngine } from './scene/AtriumEngine';
import type { HudSnapshot } from './scene/constants';

const INITIAL_HUD: HudSnapshot = {
  simMinutes: 9 * 60 + 25,
  simRate: 4,
  timeText: '09:25',
  shiftLabel: 'Morning shift',
  statsLabel: 'Initializing office scene…',
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
        <div className="w-full h-full flex items-center justify-center bg-[#0b1322] text-slate-200 p-6">
          <div className="max-w-md border border-white/15 bg-slate-900 p-6 rounded-md shadow-2xl">
            <h1 className="text-lg font-semibold text-white">3D Viewport Recovery</h1>
            <p className="mt-2 text-sm text-slate-400">{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-sm font-medium bg-emerald-500 text-slate-950 rounded hover:bg-emerald-400 transition-colors"
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

  if (webglError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0b1322] text-slate-200 p-6">
        <div className="max-w-md border border-white/15 bg-slate-900 p-6 rounded-md shadow-2xl">
          <h1 className="text-lg font-semibold text-white">3D Viewport Unavailable</h1>
          <p className="mt-2 text-sm text-slate-400">{webglError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm font-medium bg-emerald-500 text-slate-950 rounded hover:bg-emerald-400 transition-colors"
          >
            Reload 3D Viewport
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b1322]">
      <div ref={mountRef} className="w-full h-full" />
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
      />
      <CharacterStudioModal isOpen={studioOpen} onClose={() => setStudioOpen(false)} />
      <SocialChannelsPanel
        isOpen={socialOpen}
        activeBuilding={hud.activeBuilding}
        onClose={() => setSocialOpen(false)}
        onSelectBuilding={(id) => engineRef.current?.selectBuilding(id)}
        onJobDispatched={(bId) => engineRef.current?.notifyCompanyJob(bId)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ViewportErrorBoundary>
      <AtriumApp />
    </ViewportErrorBoundary>
  );
}
