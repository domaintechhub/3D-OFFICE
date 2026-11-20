import { useEffect, useRef, useState } from 'react';
import { HudOverlay } from './components/HudOverlay';
import { AtriumEngine } from './scene/AtriumEngine';
import type { HudSnapshot } from './scene/constants';

const INITIAL_HUD: HudSnapshot = {
  simMinutes: 9 * 60 + 25,
  simRate: 4,
  timeText: '09:25',
  shiftLabel: 'Morning shift',
  statsLabel: 'Initializing office scene…',
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
  audioEnabled: true,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AtriumEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    try {
      const engine = new AtriumEngine(el, (snapshot) => {
        setHud(snapshot);
      });
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
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-200 p-6">
        <div className="max-w-md border border-white/15 bg-slate-900 p-6 rounded-md">
          <h1 className="text-lg font-semibold text-white">3D Viewport Unavailable</h1>
          <p className="mt-2 text-sm text-slate-400">{webglError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b1322]">
      <div ref={mountRef} className="w-full h-full" />
      <HudOverlay
        hud={hud}
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
        onCloseMonitor={() => engineRef.current?.closeMonitorInspector()}
        getInspectedScreenCanvas={() => engineRef.current?.getInspectedScreenCanvas() ?? null}
      />
    </div>
  );
}
