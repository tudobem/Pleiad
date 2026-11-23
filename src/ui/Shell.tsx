import { t } from './strings.ts';
import './Shell.css';

/** M0 placeholder screen. Routing and the five tabs arrive in M2. */
export function Shell() {
  return (
    <main class="shell">
      <p class="shell__overline">{t('shell.overline')}</p>
      <h1 class="shell__title">{t('app.name')}</h1>
      <p class="shell__tagline">{t('shell.tagline')}</p>
      <p class="shell__card">{t('shell.status')}</p>
    </main>
  );
}
