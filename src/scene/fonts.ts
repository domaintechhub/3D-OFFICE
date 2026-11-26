/**
 * Font-readiness gate for crisp Three.js CanvasTexture typography.
 * Awaits embedded Plus Jakarta Sans and IBM Plex Mono fonts before
 * signaling all text textures to draw/redraw.
 */

let fontsReadyFlag = false;
let loadPromise: Promise<void> | null = null;
const subscribers = new Set<() => void>();

export function areAppFontsReady(): boolean {
  return fontsReadyFlag;
}

export function onAppFontsReady(cb: () => void): () => void {
  if (fontsReadyFlag) {
    cb();
    return () => {};
  }
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export async function waitForAppFonts(): Promise<void> {
  if (fontsReadyFlag) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      if (typeof document !== 'undefined' && document.fonts) {
        const loads = [
          document.fonts.load('400 18px "Plus Jakarta Sans"'),
          document.fonts.load('600 18px "Plus Jakarta Sans"'),
          document.fonts.load('700 18px "Plus Jakarta Sans"'),
          document.fonts.load('400 16px "IBM Plex Mono"'),
          document.fonts.load('600 16px "IBM Plex Mono"'),
          document.fonts.ready,
        ];
        await Promise.race([
          Promise.allSettled(loads),
          new Promise<void>((resolve) => setTimeout(resolve, 2000)),
        ]);
      }
    } catch {
      // System fallback fonts still allow deterministic canvas drawing
    }
    fontsReadyFlag = true;
    subscribers.forEach((cb) => {
      try {
        cb();
      } catch {
        // Ignore individual redraw listener errors
      }
    });
  })();

  return loadPromise;
}
