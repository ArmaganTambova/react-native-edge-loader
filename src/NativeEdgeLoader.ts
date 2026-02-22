import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getCutouts(): Promise<
    ReadonlyArray<{
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly gravity: string;
      readonly type: string;
    }>
  >;
  getModelID(): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EdgeLoader');
