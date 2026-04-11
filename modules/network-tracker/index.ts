import { requireNativeModule } from 'expo-modules-core';

export interface NetworkTrackerProps {
  requestPermissions(): Promise<boolean>;
  startProxy(): Promise<void>;
  getNetworkUsage(): Promise<{ mobileRxBytes: number; mobileTxBytes: number }>;
}

export const NetworkTracker = requireNativeModule<NetworkTrackerProps>('NetworkTracker');
