import { registerSW } from 'virtual:pwa-register';
import type { Device } from '../core/device.ts';

type Updates = Pick<Device, 'onUpdateReady' | 'applyUpdate'>;

/**
 * Registers the service worker. With registerType "prompt", a new version
 * waits until the app is fully closed, so updates apply on next launch and
 * never mid-session (SPEC 18). When one is waiting, listeners are told so the
 * UI can offer to restart now; `applyUpdate` activates it and reloads.
 */
export function registerServiceWorker(): Updates {
  const listeners = new Set<() => void>();
  let ready = false;
  let update: ((reload?: boolean) => Promise<void>) | undefined;

  if ('serviceWorker' in navigator) {
    update = registerSW({
      immediate: true,
      onNeedRefresh() {
        ready = true;
        for (const listener of listeners) listener();
      },
    });
  }

  return {
    onUpdateReady(listener) {
      listeners.add(listener);
      if (ready) listener();
      return () => listeners.delete(listener);
    },
    applyUpdate() {
      if (update) void update(true);
      else window.location.reload();
    },
  };
}
