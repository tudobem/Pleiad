import { useEffect, useRef, useState } from 'preact/hooks';
import type { RestoreMode } from '../../core/backup/restore.ts';
import { DAILY_GOAL_MAX, DAILY_GOAL_MIN, type Settings } from '../../core/settings.ts';
import { loadSettings, saveSettings, setOnboarded } from '../learning.ts';
import { PACE_NAMES, PACES, paceOf } from '../../core/onboarding/pace.ts';
import { Chip } from '../components/library/Chip.tsx';
import { href, navigate } from '../router.ts';
import { exportFlags } from '../review.ts';
import { loadIndex } from '../useContent.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { UpdateNotice } from '../components/UpdateNotice.tsx';
import {
  describeBackup,
  exportBackup,
  importBackup,
  LAST_BACKUP_KEY,
  type ImportResult,
} from '../backup.ts';
import { useServices } from '../services.ts';
import { t, type StringId } from '../strings.ts';
import './screens.css';

type Picked = { readonly text: string; readonly answers: number; readonly exportedAt: number };

export function SettingsScreen() {
  const { appVersion } = useServices();
  return (
    <main class="screen settings">
      <h1 class="screen__title">{t('settings.title')}</h1>
      <UpdateNotice />
      <GoalSection />
      <AnsweringSection />
      <BackupSection />
      <ContentSection />
      <WelcomeAgain />
      <p class="screen__muted">{t('settings.later')}</p>
      <p class="screen__muted">{t('settings.version', { version: appVersion })}</p>
    </main>
  );
}

/** Content tooling (SPEC 16): draft review and flags export. */
function ContentSection() {
  const services = useServices();
  const [drafts, setDrafts] = useState<number | null>(null);
  const [flags, setFlags] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void loadIndex(services.content)
      .then((index) => setDrafts(index.packs.reduce((n, p) => n + (p.draftCount ?? 0), 0)))
      .catch(() => setDrafts(null));
    void services.storage.getAll('flags').then((all) => setFlags(all.length));
  }, [services]);

  const doExport = async () => {
    const result = await exportFlags(services);
    setMessage(result === 'cancelled' ? null : t('content.flagsExported'));
  };
  const clear = async () => {
    if (!window.confirm(t('content.clearConfirm'))) return;
    for (const f of await services.storage.getAll<{ questionId: string }>('flags')) {
      await services.storage.delete('flags', f.questionId);
    }
    setFlags(0);
    setMessage(null);
  };

  return (
    <section class="settings__section" aria-labelledby="content-title">
      <h2 class="shelf__title" id="content-title">
        {t('content.title')}
      </h2>
      <a class="quiet-row" href={href('review')}>
        <span class="quiet-row__text">{t('content.review')}</span>
        <span class="quiet-row__hint">
          {drafts === null ? '' : t('content.reviewCount', { n: drafts })}
        </span>
      </a>
      <p class="settings__text">{t('content.flags', { n: flags })}</p>
      <div class="settings__row">
        <Button variant="secondary" onClick={() => void doExport()} disabled={flags === 0}>
          {t('content.exportFlags')}
        </Button>
        <Button variant="text" onClick={() => void clear()} disabled={flags === 0}>
          {t('content.clearFlags')}
        </Button>
      </div>
      {message ? (
        <p class="settings__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

/** Show the first-run welcome again (SPEC 13); nothing else is reset. */
function WelcomeAgain() {
  const services = useServices();
  const open = async () => {
    await setOnboarded(services, false);
    navigate('welcome');
  };
  return (
    <section class="settings__section">
      <Button variant="text" onClick={() => void open()}>
        {t('settings.welcomeAgain')}
      </Button>
    </section>
  );
}

function AnsweringSection() {
  const services = useServices();
  const [settings, setSettings] = useState<Settings | undefined>(undefined);
  useEffect(() => {
    void loadSettings(services).then(setSettings);
  }, [services]);
  if (!settings) return null;
  const toggle = async () =>
    setSettings(await saveSettings(services, { confidencePrompts: !settings.confidencePrompts }));
  return (
    <section class="settings__section" aria-labelledby="answering-title">
      <h2 class="shelf__title" id="answering-title">
        {t('answering.title')}
      </h2>
      <button
        type="button"
        class="switch"
        role="switch"
        aria-checked={settings.confidencePrompts}
        onClick={() => void toggle()}
      >
        <span class="switch__text">
          <span class="switch__label">{t('answering.confidence')}</span>
          <span class="switch__hint">{t('answering.confidenceHint')}</span>
        </span>
        <span class="switch__track" aria-hidden="true">
          <span class="switch__thumb" />
        </span>
      </button>
    </section>
  );
}

const GOAL_STEP = 5;
const NEW_MIN = 1;
const NEW_MAX = 50;

function GoalSection() {
  const services = useServices();
  const [settings, setSettings] = useState<Settings | undefined>(undefined);
  useEffect(() => {
    void loadSettings(services).then(setSettings);
  }, [services]);
  if (!settings) return null;

  const update = async (patch: Partial<Settings>) =>
    setSettings(await saveSettings(services, patch));
  const goal = settings.dailyGoal;
  const fresh = settings.newPerDay;
  const pace = paceOf(settings);
  return (
    <section class="settings__section" aria-labelledby="goal-title">
      <h2 class="shelf__title" id="goal-title">
        {t('goal.title')}
      </h2>
      <div class="chips" role="group" aria-label={t('settings.pace')}>
        {PACE_NAMES.map((p) => (
          <Chip key={p} pressed={pace === p} onClick={() => void update(PACES[p])}>
            {t(`pace.${p}`)}
          </Chip>
        ))}
      </div>
      <p class="today__caption settings__pace">
        {pace === 'custom'
          ? t('settings.paceCustom')
          : t('pace.detail', { fresh: PACES[pace].newPerDay, goal: PACES[pace].dailyGoal })}
      </p>
      <div class="stepper">
        <button
          type="button"
          class="stepper__button"
          aria-label={t('settings.newLess')}
          disabled={fresh <= NEW_MIN}
          onClick={() => void update({ newPerDay: fresh - 1 })}
        >
          −
        </button>
        <span class="stepper__value" aria-live="polite">
          {t('settings.newPerDay', { n: fresh })}
        </span>
        <button
          type="button"
          class="stepper__button"
          aria-label={t('settings.newMore')}
          disabled={fresh >= NEW_MAX}
          onClick={() => void update({ newPerDay: fresh + 1 })}
        >
          +
        </button>
      </div>
      <div class="stepper">
        <button
          type="button"
          class="stepper__button"
          aria-label={t('goal.less')}
          disabled={goal <= DAILY_GOAL_MIN}
          onClick={() => void update({ dailyGoal: goal - GOAL_STEP })}
        >
          −
        </button>
        <span class="stepper__value" aria-live="polite">
          {t('goal.daily', { n: goal })}
        </span>
        <button
          type="button"
          class="stepper__button"
          aria-label={t('goal.more')}
          disabled={goal >= DAILY_GOAL_MAX}
          onClick={() => void update({ dailyGoal: goal + GOAL_STEP })}
        >
          +
        </button>
      </div>
      <button
        type="button"
        class="switch"
        role="switch"
        aria-checked={settings.rewards}
        onClick={() => void update({ rewards: !settings.rewards })}
      >
        <span class="switch__text">
          <span class="switch__label">{t('goal.rewards')}</span>
          <span class="switch__hint">{t('goal.rewardsHint')}</span>
        </span>
        <span class="switch__track" aria-hidden="true">
          <span class="switch__thumb" />
        </span>
      </button>
    </section>
  );
}

function BackupSection() {
  const services = useServices();
  const fileInput = useRef<HTMLInputElement>(null);
  const [lastBackup, setLastBackup] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [picked, setPicked] = useState<Picked | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<RestoreMode | undefined>(undefined);

  useEffect(() => {
    void services.storage.get<number>('meta', LAST_BACKUP_KEY).then((v) => {
      setLastBackup(typeof v === 'number' ? v : undefined);
    });
  }, [services]);

  const date = (ts: number) =>
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(ts));

  const reset = () => {
    setMessage(undefined);
    setError(undefined);
  };

  const onExport = async () => {
    if (busy) return;
    reset();
    setBusy(true);
    try {
      const { result, answers } = await exportBackup(services);
      if (result === 'cancelled') setMessage(t('backup.exportCancelled'));
      else {
        setMessage(t('backup.exported', { n: answers }));
        setLastBackup(services.clock.now());
      }
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (event: Event) => {
    reset();
    setPicked(undefined);
    setConfirming(false);
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError(t('backup.error.read-failed'));
      return;
    }
    const info = describeBackup(text);
    if (!info.ok) {
      setError(errorText(info.error, info.detail));
      return;
    }
    setPicked({ text, answers: info.answers, exportedAt: info.exportedAt });
  };

  const run = async (mode: RestoreMode) => {
    if (!picked || busy) return;
    reset();
    setBusy(true);
    let result: ImportResult;
    try {
      result = await importBackup(services, picked.text, mode);
    } finally {
      setBusy(false);
    }
    setConfirming(false);
    if (!result.ok) {
      setError(errorText(result.error, result.detail));
      return;
    }
    setPicked(undefined);
    setDone(mode);
    const s = result.summary;
    setMessage(
      mode === 'replace'
        ? t('backup.replaced', { total: s.total })
        : t('backup.merged', { added: s.added, kept: s.kept, conflicts: s.conflicts }),
    );
  };

  return (
    <section class="settings__section" id="backup" aria-labelledby="backup-title">
      <h2 class="shelf__title" id="backup-title">
        {t('backup.title')}
      </h2>
      <p class="screen__muted settings__text">{t('backup.body')}</p>
      <p class="settings__text">
        {lastBackup === undefined
          ? t('backup.never')
          : t('backup.last', { date: date(lastBackup) })}
      </p>
      <Button onClick={onExport} disabled={busy}>
        {t('backup.export')}
      </Button>

      <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
        {t('backup.import')}
      </Button>
      <input
        ref={fileInput}
        class="visually-hidden"
        type="file"
        accept="application/json,.json"
        aria-label={t('backup.importHint')}
        onChange={onFile}
      />

      {picked ? (
        <Card class="settings__restore">
          <p class="settings__text">
            {t('backup.fileInfo', { date: date(picked.exportedAt), n: picked.answers })}
          </p>
          {confirming ? (
            <>
              <p class="settings__warning" role="alert">
                {t('backup.confirmReplace')}
              </p>
              <div class="settings__row">
                <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                  {t('backup.cancel')}
                </Button>
                <button
                  type="button"
                  class="button button--danger"
                  onClick={() => void run('replace')}
                  disabled={busy}
                >
                  {t('backup.confirm')}
                </button>
              </div>
            </>
          ) : (
            <>
              <Button onClick={() => void run('merge')} disabled={busy}>
                {t('backup.merge')}
              </Button>
              <p class="today__caption">{t('backup.mergeHint')}</p>
              <button
                type="button"
                class="button button--danger"
                onClick={() => setConfirming(true)}
                disabled={busy}
              >
                {t('backup.replace')}
              </button>
              <p class="today__caption">{t('backup.replaceHint')}</p>
            </>
          )}
        </Card>
      ) : null}

      {busy ? (
        <p class="screen__muted" aria-live="polite">
          {t('backup.working')}
        </p>
      ) : null}
      {message ? (
        <p class="settings__message" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p class="session__error" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        // Reload so every screen and the in-memory identity start from the restored data.
        <Button variant="secondary" onClick={() => services.device.reload()}>
          {t('backup.continue')}
        </Button>
      ) : null}
    </section>
  );
}

function errorText(error: string, detail?: string): string {
  return t(`backup.error.${error}` as StringId, { detail: detail ?? '' });
}
