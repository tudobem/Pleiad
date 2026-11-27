import { useMemo, useState } from 'preact/hooks';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { StorageNotice } from '../components/Notice.tsx';
import { UpdateNotice } from '../components/UpdateNotice.tsx';
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
      <svg class="today__sky" viewBox="0 0 240 120" aria-hidden="true">
        <circle cx="40" cy="70" r="2" class="today__star" />
        <circle cx="86" cy="34" r="1.6" class="today__star" />
        <circle cx="150" cy="82" r="1.8" class="today__star" />
        <circle cx="196" cy="40" r="1.4" class="today__star" />
        <circle cx="120" cy="56" r="4" class="today__star today__star--lit" />
      </svg>
      <UpdateNotice />
      {learning.status === 'ready' ? <StorageNotice data={learning.value.data} /> : null}
      {body}
    </main>
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
