import type { ContentIndex } from '../core/content/contentIndex.ts';
import type { Question } from '../core/content/types.ts';
import { fsrsScheduler } from '../core/scheduler/fsrsScheduler.ts';
import { learningDay } from '../core/scheduler/day.ts';
import type { Scheduler } from '../core/scheduler/scheduler.ts';
import { reviewForAnswer, subjectFor } from '../core/session/commit.ts';
import { buildDailyQueue, type DailyQueue } from '../core/session/dailyQueue.ts';
import {
  finalizeAnswer,
  migrateSession,
  pendingAnswer,
  type LeaveOptions,
  sessionReducer,
  startSession,
  type SessionState,
} from '../core/session/reducer.ts';
import { buildSession, toSessionItems } from '../core/session/session.ts';
import { slowThresholds, type SlowThresholds } from '../core/session/slow.ts';
import {
  normalizeSettings,
  resolveActivePacks,
  type Settings,
  withPacksActive,
} from '../core/settings.ts';
import { replayCards, type CardState } from '../core/sync/replay.ts';
import type { ReviewEvent } from '../core/sync/reviewEvent.ts';
import type { Services } from './services.ts';
import { activeFiles, loadIndex, loadQuestions } from './useContent.ts';

/** Size of a "Practice anyway" session (extra practice, SPEC 7.6). */
export const PRACTICE_SIZE = 10;
const SESSION_KEY = 'activeSession';
const SETTINGS_KEY = 'learning';

/** What content the profile is working with (SPEC 5.3). */
export interface ContentState {
  readonly index: ContentIndex;
  /** Active pack IDs (the Daily queue draws only from these). */
  readonly activePacks: readonly string[];
  /** Active packs that could not be loaded (offline and not cached). */
  readonly unavailable: readonly string[];
}

export const EMPTY_CONTENT: ContentState = {
  index: { version: 3, packs: [], tree: [] },
  activePacks: [],
  unavailable: [],
};

/** Everything derived from the log that sessions and Today need. */
export interface LearningData extends ContentState {
  /** Questions of the active packs. */
  readonly questions: ReadonlyMap<string, Question>;
  readonly settings: Settings;
  readonly scheduler: Scheduler;
  /** Mutable so answers committed during a session update it in place. */
  readonly events: ReviewEvent[];
  readonly cards: Map<string, CardState>;
  readonly thresholds: SlowThresholds;
}

export async function loadSettings(services: Services): Promise<Settings> {
  return normalizeSettings(await services.storage.get('settings', SETTINGS_KEY));
}

/** Change some settings, keeping the rest as stored. */
export async function saveSettings(
  services: Services,
  patch: Partial<Settings>,
): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings(services)), ...patch });
  await services.storage.put('settings', SETTINGS_KEY, next);
  return next;
}

export async function loadLearningData(
  services: Services,
  questions: ReadonlyMap<string, Question>,
  content: ContentState = EMPTY_CONTENT,
): Promise<LearningData> {
  const settings = await loadSettings(services);
  const scheduler = fsrsScheduler(settings.desiredRetention);
  const events = await services.storage.listReviews();
  return {
    ...content,
    questions,
    settings,
    scheduler,
    events,
    cards: replayCards(events, scheduler),
    thresholds: slowThresholds(events, (id) => questions.get(id)?.tier),
  };
}

/**
 * Index, settings, the active packs' questions (lazily fetched) and the
 * replayed log. Active pack files are kept offline; others are dropped.
 */
export async function loadActiveLearning(services: Services): Promise<LearningData> {
  const index = await loadIndex(services.content);
  const settings = await loadSettings(services);
  const activePacks = resolveActivePacks(
    settings,
    index.packs.map((p) => p.id),
  );
  const { questions, unavailable } = await loadQuestions(services.content, index, activePacks);
  void services.content.keepOffline(activeFiles(index, activePacks));
  return loadLearningData(services, questions, { index, activePacks, unavailable });
}

/** Turn packs on or off for the Daily queue (SPEC 5.3). */
export async function setPacksActive(
  services: Services,
  index: ContentIndex,
  packIds: readonly string[],
  on: boolean,
): Promise<void> {
  const settings = await loadSettings(services);
  const next = withPacksActive(
    settings,
    index.packs.map((p) => p.id),
    packIds,
    on,
  );
  await services.storage.put('settings', SETTINGS_KEY, next);
  const active = next.activePacks ?? [];
  void services.content.keepOffline(activeFiles(index, active));
}

export function today(services: Services): number {
  const now = services.clock.now();
  return learningDay(now, services.clock.utcOffsetMinutes(now));
}

export function todayQueue(
  services: Services,
  data: LearningData,
  scope?: ReadonlySet<string>,
): DailyQueue {
  const now = services.clock.now();
  return buildDailyQueue({
    questions: [...data.questions.values()],
    cards: data.cards,
    events: data.events,
    settings: data.settings,
    now,
    offsetMinutes: services.clock.utcOffsetMinutes(now),
    ...(scope ? { scope } : {}),
  });
}

/** Commit the answer on the feedback screen, if any: log first, then the cards cache. */
export async function commitPending(
  services: Services,
  data: LearningData,
  session: SessionState,
  options: LeaveOptions = {},
): Promise<void> {
  const raw = pendingAnswer(session);
  if (!raw) return;
  // The question may no longer be served (retired since the session started);
  // the answer is still logged from what the answer record itself holds.
  const question = subjectFor(raw, data.questions.get(raw.questionId));
  const answer = finalizeAnswer(raw, options);
  // A recall answer that was shown but never rated carries no information.
  if (answer.response.type === 'recall' && !answer.selfRating) return;
  const { clock, ids, identity, appVersion } = services;
  const { event, card } = reviewForAnswer(
    { clock, ids, appVersion, ...identity },
    {
      question,
      answer,
      mode: session.mode,
      card: data.cards.get(question.id),
      scheduler: data.scheduler,
      thresholds: data.thresholds,
    },
  );
  await services.storage.appendReview(event);
  data.events.push(event);
  data.cards.set(question.id, card);
  await services.storage.put('cards', question.id, card);
}

/**
 * The saved session if it can be resumed today. A session from an earlier
 * day, from an older app version, or referring to removed questions is
 * closed: its pending answer is committed, then it is discarded.
 */
export async function loadResumableSession(
  services: Services,
  data: LearningData,
): Promise<SessionState | undefined> {
  const raw: unknown = await services.storage.get('meta', SESSION_KEY);
  if (!raw) return undefined;
  const saved = migrateSession(raw);
  if (!saved) {
    await discardSession(services);
    return undefined;
  }
  const valid = saved.items.every((item) => data.questions.has(item.questionId));
  if (saved.phase === 'done' || saved.day !== today(services) || !valid) {
    await closeSession(services, data, saved);
    return undefined;
  }
  return sessionReducer(saved, { type: 'resume', now: services.clock.now() });
}

export function saveSession(services: Services, state: SessionState): Promise<void> {
  return state.phase === 'done'
    ? discardSession(services)
    : services.storage.put('meta', SESSION_KEY, state);
}

export function discardSession(services: Services): Promise<void> {
  return services.storage.delete('meta', SESSION_KEY);
}

/** End a session for good, keeping an answer the user already gave. */
export async function closeSession(
  services: Services,
  data: LearningData,
  session: SessionState,
): Promise<void> {
  await commitPending(services, data, session);
  await discardSession(services);
}

async function begin(services: Services, state: SessionState): Promise<SessionState> {
  await saveSession(services, state);
  return state;
}

/** Today's Daily queue as a session: due reviews first, then new items (SPEC 7.5). */
export function startScheduledSession(
  services: Services,
  data: LearningData,
): Promise<SessionState> {
  const queue = todayQueue(services, data);
  const items = toSessionItems([...queue.due, ...queue.fresh], data.questions, services.random);
  return begin(
    services,
    startSession(services.ids.newId(), items, services.clock.now(), {
      mode: 'scheduled',
      day: queue.day,
    }),
  );
}

/** Extra practice: does not change the schedule (SPEC 7.6). */
export function startPracticeSession(
  services: Services,
  data: LearningData,
): Promise<SessionState> {
  const items = buildSession([...data.questions.values()], {
    size: PRACTICE_SIZE,
    random: services.random,
  });
  return begin(
    services,
    startSession(services.ids.newId(), items, services.clock.now(), {
      mode: 'extra',
      day: today(services),
    }),
  );
}

/** What a subject's questions look like for Practice <Subject>. */
export interface SubjectTarget {
  readonly packs: readonly string[];
  readonly questionIds: readonly string[];
}

/**
 * Practice <Subject> (DESIGN 4.5): activates the subject's packs if needed,
 * then starts its part of the Daily queue, or extra practice when nothing of
 * it is due or new. Throws, changing nothing, if a pack cannot be fetched.
 */
export async function startSubjectSession(
  services: Services,
  data: LearningData,
  subject: SubjectTarget,
): Promise<SessionState> {
  const inactive = subject.packs.filter((id) => !data.activePacks.includes(id));
  let questions = data.questions;
  if (inactive.length > 0) {
    const loaded = await loadQuestions(services.content, data.index, inactive);
    if (loaded.unavailable.length > 0) throw new Error('Pack unavailable offline');
    questions = new Map([...data.questions, ...loaded.questions]);
    await setPacksActive(services, data.index, inactive, true);
  }
  const withSubject: LearningData = { ...data, questions };
  const scope = new Set(subject.questionIds);
  const queue = todayQueue(services, withSubject, scope);
  const day = queue.day;
  if (queue.due.length + queue.fresh.length > 0) {
    const items = toSessionItems([...queue.due, ...queue.fresh], questions, services.random);
    return begin(
      services,
      startSession(services.ids.newId(), items, services.clock.now(), { mode: 'scheduled', day }),
    );
  }
  const pool = [...questions.values()].filter((q) => scope.has(q.id));
  const items = buildSession(pool, { size: PRACTICE_SIZE, random: services.random });
  return begin(
    services,
    startSession(services.ids.newId(), items, services.clock.now(), { mode: 'extra', day }),
  );
}

/** Drill the given questions as extra practice (SPEC 7.6: no FSRS change). */
export function startDrillSession(
  services: Services,
  data: LearningData,
  ids: readonly string[],
): Promise<SessionState> {
  const items = toSessionItems(ids, data.questions, services.random);
  return begin(
    services,
    startSession(services.ids.newId(), items, services.clock.now(), {
      mode: 'extra',
      day: today(services),
    }),
  );
}
