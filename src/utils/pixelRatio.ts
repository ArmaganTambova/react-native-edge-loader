import { PixelRatio } from 'react-native';

/**
 * Converts a value from Android physical pixels to density-independent pixels (DIPs).
 * Android's DisplayCutout API returns raw pixel coordinates; React Native's layout
 * system uses DIPs. Divide by PixelRatio.get() to convert.
 */
export function toDIP(px: number): number {
  return px / PixelRatio.get();
}
