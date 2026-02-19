import { NativeModules, Platform, Dimensions } from 'react-native';

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

const IPHONE_DB: Record<string, any> = {
  'iPhone15,2': { type: 'island', width: 126, height: 37, radius: 20 }, // 14 Pro
  'iPhone15,3': { type: 'island', width: 126, height: 37, radius: 20 }, // 14 Pro Max
  'iPhone16,1': { type: 'island', width: 126, height: 37, radius: 20 }, // 15 Pro
  'iPhone16,2': { type: 'island', width: 126, height: 37, radius: 20 }, // 15 Pro Max
  // Çentikli Olanlar (Örnek)
  'iPhone13,2': { type: 'notch', path: 'M 0 0 L 20 20...' }, // iPhone 12
};

export interface Cutout {
  type: 'island' | 'notch' | 'punch_hole' | 'none';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  path?: string;
}

export async function getCutouts(): Promise<Cutout> {
  if (Platform.OS === 'android') {
    try {
      const cutouts = await EdgeLoader.getCutouts();
      if (cutouts && cutouts.length > 0) {
        const c = cutouts[0];
        return {
          type: 'punch_hole',
          x: c.x,
          y: c.y,
          width: c.width,
          height: c.height,
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
          ...info,
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
