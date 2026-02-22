import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  Group,
  Mask,
  Blur,
  DashPathEffect,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  useDerivedValue,
} from 'react-native-reanimated';

import type { Cutout } from './index';
import { useCutoutDetection } from './hooks/useCutoutDetection';
import { buildPathSpec } from './utils/buildPath';

export interface EdgeLoaderViewProps {
  isLoading: boolean;
  color?: string;
  strokeWidth?: number;
  beamLength?: number;
  duration?: number;
  glowRadius?: number;
  glowOpacity?: number;
  padding?: number;
  cutoutOverride?: Cutout;
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

    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.linear }),
      -1,
      false
    );
  }, [isLoading, isDetecting, cutout, duration, progress]);

  if (!isLoading || isDetecting || cutout == null) {
    return null;
  }

  const spec = buildPathSpec(cutout, padding);
  if (spec == null) {
    return null;
  }

  const { pathD, maskD, svgLeft, svgTop, svgWidth, svgHeight, perimeter } =
    spec;

  // Convert SVG path strings to Skia Path objects
  const skiaPath = Skia.Path.MakeFromSVGString(pathD);
  const skiaMaskPath = Skia.Path.MakeFromSVGString(maskD);

  if (!skiaPath || !skiaMaskPath) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="none">
      <EdgeLoaderCanvas
        path={skiaPath}
        maskPath={skiaMaskPath}
        svgLeft={svgLeft}
        svgTop={svgTop}
        svgWidth={svgWidth}
        svgHeight={svgHeight}
        perimeter={perimeter}
        progress={progress}
        color={color}
        strokeWidth={strokeWidth}
        beamLength={beamLength}
        glowRadius={glowRadius}
        glowOpacity={glowOpacity}
      />
    </View>
  );
}

interface EdgeLoaderCanvasProps {
  path: import('@shopify/react-native-skia').SkPath;
  maskPath: import('@shopify/react-native-skia').SkPath;
  svgLeft: number;
  svgTop: number;
  svgWidth: number;
  svgHeight: number;
  perimeter: number;
  progress: import('react-native-reanimated').SharedValue<number>;
  color: string;
  strokeWidth: number;
  beamLength: number;
  glowRadius: number;
  glowOpacity: number;
}

function EdgeLoaderCanvas({
  path,
  maskPath,
  svgLeft,
  svgTop,
  svgWidth,
  svgHeight,
  perimeter,
  progress,
  color,
  strokeWidth,
  beamLength,
  glowRadius,
  glowOpacity,
}: EdgeLoaderCanvasProps) {
  const beamArc = beamLength * perimeter;
  const intervals = [beamArc, perimeter];

  // Animated Phase Value
  const phase = useDerivedValue(() => {
    return -perimeter * progress.value;
  }, [perimeter, progress]);

  return (
    <Canvas
      style={{
        position: 'absolute',
        left: svgLeft,
        top: svgTop,
        width: svgWidth,
        height: svgHeight,
      }}
    >
      {/*
        Layer 1: Directional Glow
        Masked so it only shows "outwards" (or wherever maskD allows)
      */}
      <Group>
        <Mask mode="luminance" mask={<Path path={maskPath} color="white" />}>
          {/* The Glow Path */}
          <Path
            path={path}
            color={color}
            style="stroke"
            strokeWidth={strokeWidth * 8}
            strokeJoin="round"
            strokeCap="round"
            opacity={glowOpacity}
          >
            <DashPathEffect intervals={intervals} phase={phase} />
            <Blur blur={glowRadius} />
          </Path>
        </Mask>
      </Group>

      {/*
        Layer 2: Core Line (Bright, Sharp)
      */}
      <Path
        path={path}
        color={color}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeJoin="round"
        strokeCap="round"
      >
        <DashPathEffect intervals={intervals} phase={phase} />
      </Path>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: 'transparent',
  },
});
