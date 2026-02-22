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
    if (override != null) {
      setCutout(override);
      setIsDetecting(false);
      return;
    }

    let cancelled = false;
    setIsDetecting(true);

    getCutouts()
      .then((result) => {
        if (!cancelled) {
          setCutout(result);
          setIsDetecting(false);
        }
      })
      .catch(() => {
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
