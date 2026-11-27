import type { Device } from '../../core/device.ts';
import { saveFile } from '../share/shareFile.ts';

const USAGE_KEY = 'pleiad.usage';

/** The browser parts of Device; the service worker parts are added in src/app. */
export const browserDevice: Omit<Device, 'onUpdateReady' | 'applyUpdate'> = {
  saveFile: (name, text) => saveFile(name, text),
  isStandalone: () =>
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true,
  readUsage: () => {
    try {
      const n = Number(localStorage.getItem(USAGE_KEY));
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  },
  writeUsage: (answers) => {
    try {
      localStorage.setItem(USAGE_KEY, String(answers));
    } catch {
      // Storage blocked: data-loss detection is best effort.
    }
  },
  reload: () => window.location.reload(),
};

/** Ask the browser to keep our storage; never relied on (SPEC 18). */
export function requestPersistentStorage(): void {
  void navigator.storage?.persist?.().catch(() => false);
}
