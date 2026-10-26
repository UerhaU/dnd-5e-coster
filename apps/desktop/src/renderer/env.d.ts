import type { KosterBridge } from '../shared/ipc';

declare global {
  interface Window {
    koster: KosterBridge;
  }
}
