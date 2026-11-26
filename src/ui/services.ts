import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Clock } from '../core/clock.ts';
import type { ContentSource } from '../core/content/source.ts';
import type { IdGenerator } from '../core/ids.ts';
import type { Random } from '../core/random.ts';
import type { StorageAdapter } from '../core/storage.ts';
import type { Device } from '../core/device.ts';

/**
 * Everything the UI needs from the outside world, typed by core interfaces.
 * Concrete adapters are created in src/app (the composition root).
 */
export interface Services {
  readonly storage: StorageAdapter;
  readonly content: ContentSource;
  readonly clock: Clock;
  readonly random: Random;
  readonly ids: IdGenerator;
  readonly identity: { readonly deviceId: string; readonly profileId: string };
  readonly appVersion: string;
  /** False when IndexedDB is unavailable and data lives in memory only. */
  readonly persistent: boolean;
  readonly device: Device;
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('ServicesContext is missing');
  return services;
}
