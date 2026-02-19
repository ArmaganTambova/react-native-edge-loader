import React, { useRef, useEffect } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Path,
  Defs,
  Filter,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
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
  /** Width of the sharp core beam stroke in DIPs. Default: 3 */
  strokeWidth?: number;
  /**
   * Fraction of the cutout perimeter that forms the visible beam arc (0–1).
   * Default: 0.25 (one quarter of the path).
   */
  beamLength?: number;
  /** Duration of one full orbit in milliseconds. Default: 1800 */
  duration?: number;
  /** SVG feGaussianBlur stdDeviation for the glow halo. Default: 6 */
  glowRadius?: number;
  /** Opacity of the blurred glow underlay layer. Default: 0.8 */
  glowOpacity?: number;
  /** Extra space in DIPs added around the cutout shape. Default: 4 */
  padding?: number;
  /** Skip auto-detection and use this cutout directly. Useful for testing. */
  cutoutOverride?: Cutout;
  /** Called once when auto-detection finishes. */
  onDetected?: (cutout: Cutout) => void;
}

/**
 * EdgeLoaderView renders a glowing "light beam" that orbits the device's
 * screen cutout (Dynamic Island, notch, or punch-hole camera).
 *
 * Place this at the root of your component tree so it sits above all other content:
 *
 * ```tsx
 * <View style={{ flex: 1 }}>
 *   <YourApp />
 *   <EdgeLoaderView isLoading={isFetching} color="#00FFFF" />
 * </View>
 * ```
 */
export function EdgeLoaderView({
  isLoading,
  color = '#00FFFF',
  strokeWidth = 3,
  beamLength = 0.25,
  duration = 1800,
  glowRadius = 6,
  glowOpacity = 0.8,
  padding = 4,
  cutoutOverride,
  onDetected,
}: EdgeLoaderViewProps): React.ReactElement | null {
  const progress = useRef(new Animated.Value(0)).current;
  const { cutout, isDetecting } = useCutoutDetection(cutoutOverride);

  // Notify parent when detection completes
  useEffect(() => {
    if (!isDetecting && cutout != null && onDetected) {
      onDetected(cutout);
    }
  }, [isDetecting, cutout, onDetected]);

  // Drive animation loop
  useEffect(() => {
    if (!isLoading || isDetecting || cutout == null) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    const anim = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        // SVG strokeDashoffset is not a native-composited prop → JS thread
        useNativeDriver: false,
      })
    );
    anim.start();

    return () => anim.stop();
  }, [isLoading, isDetecting, cutout, duration, progress]);

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

  // Animate from offset 0 (beam at path start) to -perimeter (one full orbit)
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
        viewBox={`${svgLeft} ${svgTop} ${svgWidth} ${svgHeight}`}
      >
        <Defs>
          {/* Large filter region prevents glow from being clipped at path edges */}
          <Filter id="beam-glow" x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur
              in="SourceGraphic"
              stdDeviation={glowRadius}
              result="blur"
            />
            <FeMerge>
              <FeMergeNode in="blur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
        </Defs>

        {/* Layer 1: Wide blurred underlay — the glow halo */}
        <AnimatedPath
          d={pathD}
          stroke={color}
          strokeWidth={strokeWidth * 4}
          strokeLinecap="round"
          fill="none"
          opacity={glowOpacity}
          filter="url(#beam-glow)"
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
        />

        {/* Layer 2: Thin sharp core — the bright leading edge */}
        <AnimatedPath
          d={pathD}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
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
