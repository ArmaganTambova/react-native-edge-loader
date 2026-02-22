import { useState, useEffect } from 'react';
import { getCutouts } from '../index';
import type { Cutout } from '../index';

export interface CutoutDetectionResult {
  cutout: Cutout | null;
  isDetecting: boolean;
}

/**
 * Hook that detects the device's screen cutout once on mount.
 * If `override` is provided it is returned immediately without calling getCutouts().
 */
export function useCutoutDetection(override?: Cutout): CutoutDetectionResult {
  const [cutout, setCutout] = useState<Cutout | null>(override ?? null);
  const [isDetecting, setIsDetecting] = useState<boolean>(override == null);

  useEffect(() => {
    // If override changes, update immediately and stop detecting
    if (override != null) {
      setCutout(override);
      setIsDetecting(false);
      return;
    }

    // If we already detected a cutout (and no override), don't detect again
    // unless we want to support dynamic rotation changes?
    // For now, let's keep it simple: one-time detection.
    // Actually, if we want to support rotation, we should listen to dimension changes?
    // But getCutouts is async native call.
    // Let's stick to mount-time detection for stability.

    let cancelled = false;
    setIsDetecting(true);

    getCutouts()
      .then((result) => {
        if (!cancelled) {
          setCutout(result);
          setIsDetecting(false);
        }
      })
      .catch((e) => {
        console.warn('[EdgeLoader] Detection failed', e);
        if (!cancelled) {
          setCutout({ type: 'none' });
          setIsDetecting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [override]);

  return { cutout, isDetecting };
}
