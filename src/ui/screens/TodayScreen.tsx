import { useEffect, useState } from 'preact/hooks';
import type { SessionState } from '../../core/session/reducer.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { navigate } from '../router.ts';
import { useServices } from '../services.ts';
import { discardSession, loadSavedSession } from '../sessionStore.ts';
import { t } from '../strings.ts';
import { useEligibleQuestions } from '../useContent.ts';
import './screens.css';

export function TodayScreen() {
  const { storage } = useServices();
  const questions = useEligibleQuestions();
  const [saved, setSaved] = useState<SessionState | undefined | null>(null);

  useEffect(() => {
    loadSavedSession(storage).then(setSaved, () => setSaved(undefined));
  }, [storage]);

  const startNew = async () => {
    await discardSession(storage);
    navigate('session');
  };

  let body;
  if (questions.status === 'loading' || saved === null) {
    body = (
      <p class="screen__muted" aria-live="polite">
        {t('common.loading')}
      </p>
    );
  } else if (questions.status === 'error') {
    body = (
      <Card>
        <p class="screen__muted">{t('common.loadError')}</p>
        <Button variant="secondary" onClick={questions.retry}>
          {t('common.retry')}
        </Button>
      </Card>
    );
  } else if (questions.value.size === 0) {
    body = (
      <Card>
        <h2 class="screen__subtitle">{t('today.emptyTitle')}</h2>
        <p class="screen__muted">{t('today.emptyBody')}</p>
      </Card>
    );
  } else {
    const n = questions.value.size;
    body = (
      <div class="today__actions">
        {saved ? (
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
        ) : null}
        <Button variant={saved ? 'secondary' : 'primary'} onClick={startNew}>
          {saved ? t('today.startNew') : t('today.start')}
        </Button>
        <p class="today__caption">{n === 1 ? t('today.readyOne') : t('today.ready', { n })}</p>
      </div>
    );
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
      {body}
    </main>
  );
}
