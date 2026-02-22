import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Path,
  Defs,
  Filter,
  FeGaussianBlur,
  FeColorMatrix,
  Mask,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

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
   * Base stroke width used for the core line.
   * The glow layer will be significantly thicker.
   * Default: 2
   */
  strokeWidth?: number;
  /**
   * Fraction of the cutout perimeter that forms the visible beam arc (0–1).
   * Default: 0.3 (30% of the path is lit at any moment).
   */
  beamLength?: number;
  /** Duration of one full loop in milliseconds. Default: 2000 */
  duration?: number;
  /**
   * Blur radius for the glow.
   * Default: 4
   */
  glowRadius?: number;
  /** Opacity of the glow halo. Default: 0.8 */
  glowOpacity?: number;
  /** Extra space in DIPs added around the cutout shape (moves line away from hardware). Default: 0 */
  padding?: number;
  /** Skip auto-detection and use this cutout directly. Useful for testing. */
  cutoutOverride?: Cutout;
  /** Called once when auto-detection finishes. */
  onDetected?: (cutout: Cutout) => void;
}

export function EdgeLoaderView({
  isLoading,
  color = '#00FFFF',
  strokeWidth = 2,
  beamLength = 0.3,
  duration = 2000,
  glowRadius = 4,
  glowOpacity = 0.8,
  padding = 0,
  cutoutOverride,
  onDetected,
}: EdgeLoaderViewProps): React.ReactElement | null {
  const progress = useSharedValue(0);
  const { cutout, isDetecting } = useCutoutDetection(cutoutOverride);

  useEffect(() => {
    if (!isDetecting && cutout != null && onDetected) {
      onDetected(cutout);
    }
  }, [isDetecting, cutout, onDetected]);

  useEffect(() => {
    if (!isLoading || isDetecting || cutout == null) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }

    // Start Loop Animation (Restart Mode: 0 -> 1, then jump to 0)
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1, // Infinite
      false // Do not reverse (Restart)
    );
  }, [isLoading, isDetecting, cutout, duration, progress]);

  if (!isLoading || isDetecting || cutout == null) {
    return null;
  }

  const spec = buildPathSpec(cutout, padding);
  if (spec == null) {
    return null;
  }

  const { perimeter } = spec;

  const beamArc = beamLength * perimeter;
  // DashArray: "VisibleGap InvisibleGap"
  // Actually standard strokeDasharray="dash gap"
  // We want a segment of length `beamArc` followed by `perimeter`.
  // To simulate a moving beam, we use a huge gap.
  const dashArray = [beamArc, perimeter].join(' ');

  // Animate dashOffset from 0 to -perimeter (moves the dash forward along the path)
  // Actually, standard SVG: positive offset shifts dash "backwards" (counter-flow).
  // Negative offset shifts dash "forwards".
  // To move from Start to End, we usually decrease offset.
  return (
    <View style={styles.overlay} pointerEvents="none">
      <EdgeLoaderSvg
        spec={spec}
        color={color}
        strokeWidth={strokeWidth}
        glowRadius={glowRadius}
        glowOpacity={glowOpacity}
        dashArray={dashArray}
        perimeter={perimeter}
        progress={progress}
      />
    </View>
  );
}

// Separate component to handle Animated Props cleanly
// and avoid re-rendering the whole parent on shared value updates (though Reanimated handles that).
interface EdgeLoaderSvgProps {
  spec: any;
  color: string;
  strokeWidth: number;
  glowRadius: number;
  glowOpacity: number;
  dashArray: string;
  perimeter: number;
  progress: Animated.SharedValue<number>;
}

function EdgeLoaderSvg({
  spec,
  color,
  strokeWidth,
  glowRadius,
  glowOpacity,
  dashArray,
  perimeter,
  progress,
}: EdgeLoaderSvgProps) {
  const { pathD, maskD, maskFillRule, svgLeft, svgTop, svgWidth, svgHeight } =
    spec;

  const animatedProps = useAnimatedProps(() => {
    // Offset shifts the pattern.
    // At t=0, offset=0. Dash starts at 0.
    // At t=1, offset=-perimeter. Dash has moved full loop.
    return {
      strokeDashoffset: -perimeter * progress.value,
    };
  });

  return (
    <Svg
      style={{ position: 'absolute', left: svgLeft, top: svgTop }}
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
    >
      <Defs>
        {/* Glow Filter: Soft Blur */}
        <Filter id="glow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur
            in="SourceGraphic"
            stdDeviation={glowRadius}
            result="blur"
          />
          <FeColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 5 0" // Boost alpha a bit
          />
        </Filter>

        {/* Mask: Defines the visible area for the glow */}
        <Mask id="direction-mask">
          <Path d={maskD} fill="white" fillRule={maskFillRule} />
        </Mask>
      </Defs>

      {/*
        Layer 1: Directional Glow
        - Thick stroke
        - Blurred
        - Masked (so it only bleeds into the screen/away from hardware)
      */}
      <AnimatedPath
        d={pathD}
        stroke={color}
        strokeWidth={strokeWidth * 8} // Wide glow
        strokeLinecap="round"
        fill="none"
        opacity={glowOpacity}
        filter="url(#glow-blur)"
        mask="url(#direction-mask)"
        strokeDasharray={dashArray}
        animatedProps={animatedProps}
      />

      {/*
        Layer 2: Core Line
        - Thin, sharp stroke
        - Sits exactly on the path (boundary)
        - No mask needed (or mask it too? If we mask it, half might disappear if the path is exactly on edge)
        - Usually the core line should be fully visible.
        - The path is the boundary.
      */}
      <AnimatedPath
        d={pathD}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={dashArray}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: 'transparent',
  },
});
