import { useMemo, useState } from 'preact/hooks';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { StorageNotice } from '../components/Notice.tsx';
import { UpdateNotice } from '../components/UpdateNotice.tsx';
import { ProgressRing } from '../components/ProgressRing.tsx';
import { useRewards } from '../rewards.ts';
import {
  closeSession,
  startPracticeSession,
  startScheduledSession,
  todayQueue,
  type LearningData,
} from '../learning.ts';
import { href, navigate } from '../router.ts';
import { useServices } from '../services.ts';
import { t } from '../strings.ts';
import { useLearning, type Learning } from '../useLearning.ts';
import './screens.css';

export function TodayScreen() {
  const learning = useLearning();

  let body;
  if (learning.status === 'loading') {
    body = (
      <p class="screen__muted" aria-live="polite">
        {t('common.loading')}
      </p>
    );
  } else if (learning.status === 'error') {
    body = (
      <Card>
        <p class="screen__muted">{t('common.loadError')}</p>
        <Button variant="secondary" onClick={learning.retry}>
          {t('common.retry')}
        </Button>
      </Card>
    );
  } else if (
    learning.value.data.activePacks.length === 0 &&
    learning.value.data.index.packs.length > 0
  ) {
    body = (
      <Card>
        <h2 class="screen__subtitle">{t('today.pickTitle')}</h2>
        <p class="screen__muted">{t('today.pickBody')}</p>
        <a class="button button--primary" href={href('library')}>
          {t('today.openLibrary')}
        </a>
      </Card>
    );
  } else if (
    learning.value.data.questions.size === 0 &&
    learning.value.data.unavailable.length > 0
  ) {
    body = (
      <Card>
        <p class="screen__muted">{t('today.unavailable')}</p>
        <Button variant="secondary" onClick={learning.reload}>
          {t('common.retry')}
        </Button>
      </Card>
    );
  } else if (learning.value.data.questions.size === 0) {
    body = (
      <Card>
        <h2 class="screen__subtitle">{t('today.emptyTitle')}</h2>
        <p class="screen__muted">{t('today.emptyBody')}</p>
      </Card>
    );
  } else {
    body = <TodayActions learning={learning.value} />;
  }

  return (
    <main class="screen today">
      <p class="screen__overline">{t('today.overline')}</p>
      <h1 class="screen__title">{t('today.title')}</h1>
      {learning.status === 'ready' && learning.value.data.settings.rewards ? (
        <GoalSky data={learning.value.data} />
      ) : (
        <Sky lit={1} />
      )}
      <UpdateNotice />
      {learning.status === 'ready' ? <StorageNotice data={learning.value.data} /> : null}
      {body}
    </main>
  );
}

/** Hero stars: the centre star first, then the others (DESIGN 4.1). */
const STARS = [
  { cx: 120, cy: 56, r: 4 },
  { cx: 40, cy: 70, r: 2 },
  { cx: 86, cy: 34, r: 1.6 },
  { cx: 150, cy: 82, r: 1.8 },
  { cx: 196, cy: 40, r: 1.4 },
];

/** The hero sky with the first `lit` stars lit. */
function Sky({ lit }: { lit: number }) {
  return (
    <svg class="today__sky" viewBox="0 0 240 120" aria-hidden="true">
      {STARS.map((s, i) => (
        <circle
          key={i}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          class={`today__star${i < lit ? ' today__star--lit' : ''}`}
        />
      ))}
    </svg>
  );
}

/** Goal ring and streak above the sky; one star lights per fifth of the goal (SPEC 15). */
function GoalSky({ data }: { data: LearningData }) {
  const rewards = useRewards(data);
  const { goal, streak } = rewards;
  const lit = Math.floor(goal.ratio * STARS.length + 1e-9);
  return (
    <>
      <div class="today__goal">
        <ProgressRing
          value={goal.ratio}
          size={48}
          label={t('today.goalLabel', { done: goal.done, goal: goal.goal })}
        >
          <span aria-hidden="true">{goal.done}</span>
        </ProgressRing>
        <span class="today__goal-text">
          <span>{t('today.goal', { done: goal.done, goal: goal.goal })}</span>
          <span class="today__goal-streak">{t('today.streak', { days: streak.current })}</span>
        </span>
      </div>
      <Sky lit={lit} />
    </>
  );
}

function TodayActions({ learning }: { learning: Learning }) {
  const services = useServices();
  const { data, saved } = learning;
  const queue = useMemo(() => todayQueue(services, data), [services, data]);
  const [busy, setBusy] = useState(false);

  const go = (start: (data: LearningData) => Promise<unknown>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await start(data);
      navigate('session');
    } finally {
      setBusy(false);
    }
  };
  const startScheduled = go((d) => startScheduledSession(services, d));
  const startPractice = go((d) => startPracticeSession(services, d));
  const startOver = go(async (d) => {
    if (saved) await closeSession(services, d, saved);
    return saved?.mode === 'extra'
      ? startPracticeSession(services, d)
      : startScheduledSession(services, d);
  });

  const due = queue.due.length;
  const fresh = queue.fresh.length;

  if (saved) {
    return (
      <div class="today__actions">
        <Card class="today__resume">
          <h2 class="screen__subtitle">{t('today.resumeTitle')}</h2>
          <p class="screen__muted">
            {t('today.resumeBody', {
              current: Math.min(saved.index + 1, saved.items.length),
              total: saved.items.length,
            })}
          </p>
          <Button onClick={() => navigate('session')}>{t('today.resume')}</Button>
        </Card>
        <Button variant="secondary" onClick={startOver} disabled={busy}>
          {t('today.startOver')}
        </Button>
      </div>
    );
  }

  if (due + fresh === 0) {
    return (
      <div class="today__actions">
        <Card>
          <h2 class="screen__subtitle">{t('today.doneTitle')}</h2>
          <p class="screen__muted">{t('today.doneBody')}</p>
        </Card>
        <Button variant="secondary" onClick={startPractice} disabled={busy}>
          {t('today.practiceAnyway')}
        </Button>
      </div>
    );
  }

  return (
    <div class="today__actions">
      <Button onClick={startScheduled} disabled={busy}>
        {t('today.startToday')}
      </Button>
      <p class="today__caption">{t('today.counts', { due, fresh })}</p>
      {data.unavailable.length > 0 ? <p class="today__caption">{t('today.unavailable')}</p> : null}
    </div>
  );
}
