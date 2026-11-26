import { useEffect, useRef, useState } from 'preact/hooks';
import type { RestoreMode } from '../../core/backup/restore.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
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
      <BackupSection />
      <p class="screen__muted">{t('settings.later')}</p>
      <p class="screen__muted">{t('settings.version', { version: appVersion })}</p>
    </main>
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
