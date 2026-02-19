import { NativeModules, Platform, Dimensions, PixelRatio } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-edge-loader' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const EdgeLoader = NativeModules.EdgeLoader
  ? NativeModules.EdgeLoader
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

interface IPhoneEntry {
  type: 'island' | 'notch' | 'punch_hole';
  width: number;
  height: number;
  radius?: number;
}

const IPHONE_DB: Record<string, IPhoneEntry> = {
  // ── Dynamic Island ────────────────────────────────────────────────
  'iPhone15,2': { type: 'island', width: 126, height: 37, radius: 20 }, // 14 Pro
  'iPhone15,3': { type: 'island', width: 126, height: 37, radius: 20 }, // 14 Pro Max
  'iPhone16,1': { type: 'island', width: 126, height: 37, radius: 20 }, // 15 Pro
  'iPhone16,2': { type: 'island', width: 126, height: 37, radius: 20 }, // 15 Pro Max
  'iPhone17,1': { type: 'island', width: 127, height: 37, radius: 20 }, // 16 Pro
  'iPhone17,2': { type: 'island', width: 127, height: 37, radius: 20 }, // 16 Pro Max
  'iPhone18,1': { type: 'island', width: 127, height: 37, radius: 20 }, // 17 Pro (estimated)
  'iPhone18,2': { type: 'island', width: 127, height: 37, radius: 20 }, // 17 Pro Max (estimated)

  // ── Notch ─────────────────────────────────────────────────────────
  'iPhone13,1': { type: 'notch', width: 209, height: 30, radius: 6 }, // 12 mini
  'iPhone13,2': { type: 'notch', width: 209, height: 30, radius: 6 }, // 12
  'iPhone13,3': { type: 'notch', width: 209, height: 30, radius: 6 }, // 12 Pro
  'iPhone13,4': { type: 'notch', width: 230, height: 30, radius: 6 }, // 12 Pro Max
  'iPhone14,4': { type: 'notch', width: 162, height: 30, radius: 6 }, // 13 mini
  'iPhone14,5': { type: 'notch', width: 162, height: 30, radius: 6 }, // 13
  'iPhone14,2': { type: 'notch', width: 162, height: 30, radius: 6 }, // 13 Pro
  'iPhone14,3': { type: 'notch', width: 162, height: 30, radius: 6 }, // 13 Pro Max
  'iPhone14,7': { type: 'notch', width: 162, height: 30, radius: 6 }, // 14
  'iPhone14,8': { type: 'notch', width: 162, height: 30, radius: 6 }, // 14 Plus

  // ── Punch-hole pill (non-Pro 15/16/17) ───────────────────────────
  'iPhone15,4': { type: 'punch_hole', width: 11, height: 11, radius: 6 }, // 15
  'iPhone15,5': { type: 'punch_hole', width: 11, height: 11, radius: 6 }, // 15 Plus
  'iPhone16,3': { type: 'punch_hole', width: 11, height: 11, radius: 6 }, // 16
  'iPhone16,4': { type: 'punch_hole', width: 11, height: 11, radius: 6 }, // 16 Plus
  'iPhone17,3': { type: 'punch_hole', width: 11, height: 11, radius: 6 }, // 17
  'iPhone17,4': { type: 'punch_hole', width: 11, height: 11, radius: 6 }, // 17 Plus / Air
};

export interface Cutout {
  type: 'island' | 'notch' | 'punch_hole' | 'none';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  path?: string;
}

export async function getCutouts(): Promise<Cutout> {
  if (Platform.OS === 'android') {
    try {
      const cutouts = await EdgeLoader.getCutouts();
      if (cutouts && cutouts.length > 0) {
        const c = cutouts[0];
        const ratio = PixelRatio.get();
        return {
          type: 'punch_hole',
          x: c.x / ratio,
          y: c.y / ratio,
          width: c.width / ratio,
          height: c.height / ratio,
        };
      }
    } catch (e) {
      console.error(e);
    }
    return { type: 'none' };
  }

  if (Platform.OS === 'ios') {
    try {
      const modelId = await EdgeLoader.getModelID();
      const info = IPHONE_DB[modelId];

      if (info) {
        const { width } = Dimensions.get('window');
        return {
          type: info.type,
          width: info.width,
          height: info.height,
          radius: info.radius,
          x: (width - info.width) / 2,
          y: 11,
        };
      }
    } catch (e) {
      console.error(e);
    }
  }

  return { type: 'none' };
}

export { EdgeLoaderView } from './EdgeLoaderView';
export type { EdgeLoaderViewProps } from './EdgeLoaderView';
