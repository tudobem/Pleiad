import { Icon } from '../Icon.tsx';
import { t } from '../../strings.ts';

/** Check or cross with a text label, so right/wrong never relies on color alone. */
export function Mark({ ok }: { ok: boolean }) {
  return (
    <span class={`mark mark--${ok ? 'ok' : 'wrong'}`}>
      <Icon name={ok ? 'check' : 'cross'} size={16} />
      <span class="visually-hidden">
        {ok ? t('session.labelCorrect') : t('session.labelYours')}
      </span>
    </span>
  );
}
