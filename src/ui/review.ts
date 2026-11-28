import type { Question } from '../core/content/types.ts';
import { decisionsExport, isDecision, type ReviewDecision } from '../core/review/decisions.ts';
import { flagsExport } from '../core/review/flags.ts';
import type { SaveResult } from '../core/device.ts';
import type { Services } from './services.ts';
import { registerThinkers } from './thinkers.ts';
import { loadIndex } from './useContent.ts';

const DECISIONS_KEY = 'reviewDecisions';

const stamp = (services: Services): { iso: string; date: string } => {
  const now = services.clock.now();
  const shifted = now + services.clock.utcOffsetMinutes(now) * 60_000;
  return { iso: new Date(now).toISOString(), date: new Date(shifted).toISOString().slice(0, 10) };
};

/** Drafts of every pack, for review (fetched, never cached; SPEC 16.4 path B). */
export async function loadDrafts(services: Services): Promise<Question[]> {
  const index = await loadIndex(services.content);
  const load = services.content.loadDrafts;
  if (!load) return [];
  const packs = await Promise.all(index.packs.filter((p) => p.draftsFile).map((p) => load(p)));
  for (const p of packs) registerThinkers(p.thinkers);
  return packs.flatMap((p) => p.questions);
}

export async function loadDecisions(services: Services): Promise<Record<string, ReviewDecision>> {
  const raw = await services.storage.get<Record<string, unknown>>('meta', DECISIONS_KEY);
  return Object.fromEntries(
    Object.entries(raw ?? {}).filter((e): e is [string, ReviewDecision] => isDecision(e[1])),
  );
}

export function saveDecisions(
  services: Services,
  decisions: Record<string, ReviewDecision>,
): Promise<void> {
  return services.storage.put('meta', DECISIONS_KEY, decisions);
}

export async function exportDecisions(
  services: Services,
  decisions: Record<string, ReviewDecision>,
): Promise<SaveResult> {
  const { iso, date } = stamp(services);
  return services.device.saveFile(
    `review-decisions-${date}.json`,
    `${JSON.stringify(decisionsExport(Object.values(decisions), iso), null, 2)}\n`,
  );
}

export async function exportFlags(services: Services): Promise<SaveResult> {
  const { iso, date } = stamp(services);
  const flags = await services.storage.getAll<unknown>('flags');
  return services.device.saveFile(
    `flags-${date}.json`,
    `${JSON.stringify(flagsExport(flags, iso), null, 2)}\n`,
  );
}
