import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker. With registerType "prompt", a new version
 * waits until the app is fully closed, so updates apply on next launch and
 * never mid-session. The "Update available" prompt arrives in M8.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
