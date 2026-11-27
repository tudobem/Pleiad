import { useEffect, useState } from 'preact/hooks';
import { useServices } from '../services.ts';
import { t } from '../strings.ts';
import './components.css';

/**
 * "Update available" (SPEC 18). Shown on Today and Settings only, never in a
 * session; ignoring it is fine, the update applies on next launch.
 */
export function UpdateNotice() {
  const { device } = useServices();
  const [ready, setReady] = useState(false);
  useEffect(() => device.onUpdateReady(() => setReady(true)), [device]);
  if (!ready) return null;
  return (
    <div class="notice" role="status">
      <p class="notice__text">{t('update.ready')}</p>
      <button type="button" class="notice__action" onClick={() => device.applyUpdate()}>
        {t('update.restart')}
      </button>
    </div>
  );
}
