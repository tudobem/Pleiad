import { useEffect, useState } from 'preact/hooks';
import { currentNotice, TAB_NOTICE_KEY, type Notice } from '../backup.ts';
import type { LearningData } from '../learning.ts';
import { href } from '../router.ts';
import { useServices } from '../services.ts';
import { t } from '../strings.ts';
import './components.css';

/** The one storage notice Today shows (SPEC 18, 19): calm, never blocking. */
export function StorageNotice({ data }: { data: LearningData }) {
  const services = useServices();
  const [notice, setNotice] = useState<Notice | undefined>(undefined);
  const answers = data.events.length;
  const first = data.events.reduce<number | undefined>(
    (min, e) => (min === undefined || e.ts < min ? e.ts : min),
    undefined,
  );

  useEffect(() => {
    let alive = true;
    void currentNotice(services, answers, first).then((n) => alive && setNotice(n));
    return () => {
      alive = false;
    };
  }, [services, answers, first]);

  if (!notice) return null;
  if (notice === 'browser-tab') {
    const dismiss = async () => {
      await services.storage.put('meta', TAB_NOTICE_KEY, true);
      setNotice(await currentNotice(services, answers, first));
    };
    return (
      <div class="notice" role="note">
        <p class="notice__text">{t('notice.browserTab')}</p>
        <button type="button" class="notice__action" onClick={() => void dismiss()}>
          {t('notice.dismiss')}
        </button>
      </div>
    );
  }
  const loss = notice === 'data-loss';
  return (
    <div class={`notice${loss ? ' notice--alert' : ''}`} role={loss ? 'alert' : 'note'}>
      <p class="notice__text">{t(loss ? 'notice.dataLoss' : 'notice.backupDue')}</p>
      <a class="notice__action" href={href('settings')}>
        {t(loss ? 'notice.dataLossAction' : 'notice.backupAction')}
      </a>
    </div>
  );
}
