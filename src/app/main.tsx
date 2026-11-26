import { render } from 'preact';
import '../ui/base.css';
import { App } from '../ui/App.tsx';
import { ServicesContext, type Services } from '../ui/services.ts';
import { memoryStorage } from '../core/memoryStorage.ts';
import type { StorageAdapter } from '../core/storage.ts';
import { systemClock } from '../platform/clock/systemClock.ts';
import { fetchContentSource } from '../platform/content/fetchContent.ts';
import { browserDevice, requestPersistentStorage } from '../platform/device/device.ts';
import { loadIdentity } from '../platform/identity.ts';
import { uuidIds } from '../platform/ids.ts';
import { systemRandom } from '../platform/random.ts';
import { indexedDbStorage } from '../platform/storage/indexedDbStorage.ts';
import { registerServiceWorker } from './registerServiceWorker.ts';

/** Composition root: create the platform adapters and hand them to the UI. */
async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app root element');

  let storage: StorageAdapter;
  let persistent = true;
  try {
    storage = await indexedDbStorage();
  } catch {
    // Some private browsing modes block IndexedDB; keep working in memory.
    storage = memoryStorage();
    persistent = false;
  }

  const services: Services = {
    storage,
    content: fetchContentSource(import.meta.env.BASE_URL),
    clock: systemClock,
    random: systemRandom,
    ids: uuidIds,
    identity: await loadIdentity(storage, uuidIds),
    appVersion: __APP_VERSION__,
    persistent,
    device: browserDevice,
  };
  requestPersistentStorage();

  render(
    <ServicesContext.Provider value={services}>
      <App />
    </ServicesContext.Provider>,
    root,
  );
  registerServiceWorker();
}

void main();
