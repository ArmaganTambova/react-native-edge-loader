import React, { useRef, useEffect } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Path,
  Defs,
  Filter,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  FeColorMatrix,
} from 'react-native-svg';

import type { Cutout } from './index';
import { useCutoutDetection } from './hooks/useCutoutDetection';
import { buildPathSpec } from './utils/buildPath';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface EdgeLoaderViewProps {
  /** Whether the loading animation is active. */
  isLoading: boolean;
  /** Color of the beam and glow. Default: '#00FFFF' */
  color?: string;
  /**
   * Base stroke width used to scale the glow layers. Default: 1.5
   * Higher values = wider, more intense glow. No hard edge is ever visible.
   */
  strokeWidth?: number;
  /**
   * Fraction of the cutout perimeter that forms the visible beam arc (0–1).
   * Default: 0.3 (30% of the path is lit at any moment).
   */
  beamLength?: number;
  /** Duration of one full orbit in milliseconds. Default: 1800 */
  duration?: number;
  /**
   * Controls how sharply the glow fades from the edge (feGaussianBlur stdDeviation).
   * Keep this small (1–3) for a tight, crisp edge effect — larger values spread the light.
   * Default: 1.5
   */
  glowRadius?: number;
  /** Opacity of the outer glow halo. Default: 0.9 */
  glowOpacity?: number;
  /** Extra space in DIPs added around the cutout shape. Default: 0 */
  padding?: number;
  /** Skip auto-detection and use this cutout directly. Useful for testing. */
  cutoutOverride?: Cutout;
  /** Called once when auto-detection finishes. */
  onDetected?: (cutout: Cutout) => void;
  /**
   * Animation loop mode.
   * - 'restart': beam travels in one direction then resets. Best for Dot (orbit) category.
   * - 'continuous': beam ping-pongs back and forth. Best for Clear / Notch (bar) category.
   * - undefined (default): auto-selected based on cutout type.
   *   Clear/Notch → 'continuous', Dot → 'restart'.
   */
  loopMode?: 'restart' | 'continuous';
}

export function EdgeLoaderView({
  isLoading,
  color = '#00FFFF',
  strokeWidth = 1.5,
  beamLength = 0.3,
  duration = 1800,
  glowRadius = 1.5,
  glowOpacity = 0.9,
  padding = 0,
  cutoutOverride,
  onDetected,
  loopMode,
}: EdgeLoaderViewProps): React.ReactElement | null {
  const progress = useRef(new Animated.Value(0)).current;
  const { cutout, isDetecting } = useCutoutDetection(cutoutOverride);

  useEffect(() => {
    if (!isDetecting && cutout != null && onDetected) {
      onDetected(cutout);
    }
  }, [isDetecting, cutout, onDetected]);

  useEffect(() => {
    if (!isLoading || isDetecting || cutout == null) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    // Auto-select loop mode based on cutout category:
    // - Clear (none) and Notch → 'continuous' ping-pong (bar travels back and forth)
    // - Dot (punch_hole / island / teardrop) → 'restart' (orbit loops in one direction)
    const effectiveLoopMode =
      loopMode ??
      (cutout.type === 'none' || cutout.type === 'notch'
        ? 'continuous'
        : 'restart');

    let anim: Animated.CompositeAnimation;

    if (effectiveLoopMode === 'continuous') {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.timing(progress, {
            toValue: 0,
            duration,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        ])
      );
    } else {
      anim = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
    }

    // Defer one frame so the SVG has a chance to mount before animation starts.
    const raf = requestAnimationFrame(() => {
      anim.start();
    });

    return () => {
      cancelAnimationFrame(raf);
      anim.stop();
    };
  }, [isLoading, isDetecting, cutout, duration, loopMode, progress]);

  if (!isLoading || isDetecting || cutout == null) {
    return null;
  }

  const spec = buildPathSpec(cutout, padding);
  if (spec == null) {
    return null;
  }

  const { pathD, perimeter, svgLeft, svgTop, svgWidth, svgHeight } = spec;

  const beamArc = beamLength * perimeter;
  const dashArray = `${beamArc} ${perimeter - beamArc}`;

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -perimeter],
  });

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Svg
        style={{ position: 'absolute', left: svgLeft, top: svgTop }}
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      >
        <Defs>
          {/*
           * Sharp edge glow — very tight blur (1.5px stdDeviation).
           * Light peaks right at the boundary and falls off within ~2-3px.
           * No broad halo; the stroke is blurred just enough to lose its
           * hard edge while staying concentrated at the glass/screen line.
           */}
          <Filter id="edge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur
              in="SourceGraphic"
              stdDeviation={glowRadius}
              result="blur"
            />
            <FeColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 5 0"
              result="boosted"
            />
            <FeMerge>
              <FeMergeNode in="boosted" />
            </FeMerge>
          </Filter>
        </Defs>

        {/*
         * Layer 1 — Outer fringe (slightly wider stroke, same tight blur)
         * Adds a faint 1-2px halo just beyond the bright core.
         * Together with Layer 2 it creates a natural intensity drop-off:
         * bright at centre → gone within ~3px.
         */}
        <AnimatedPath
          d={pathD}
          stroke={color}
          strokeWidth={strokeWidth * 2.5}
          strokeLinecap="round"
          fill="none"
          opacity={glowOpacity * 0.45}
          filter="url(#edge-glow)"
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
        />

        {/*
         * Layer 2 — Bright core (thin stroke, fully blurred into a sharp peak)
         * This is the hottest point of the light — sits exactly on the
         * glass / screen edge and fades to nothing within 2-3px outward.
         */}
        <AnimatedPath
          d={pathD}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          opacity={glowOpacity}
          filter="url(#edge-glow)"
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: 'transparent',
  },
});
