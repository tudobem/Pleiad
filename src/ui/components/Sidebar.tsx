import { coveragePercent } from '../../core/library/library.ts';
import type { Location } from '../router.ts';
import { href, TAB_ROUTES } from '../router.ts';
import { useLibrary } from '../screens/LibraryScreen.tsx';
import { t, type StringId } from '../strings.ts';
import type { LearningData } from '../learning.ts';
import { useLearning } from '../useLearning.ts';
import { Icon } from './Icon.tsx';
import { ProgressBar } from './ProgressBar.tsx';
import './components.css';

/**
 * Sidebar for the wide layout (DESIGN 3): app name, the five destinations,
 * then the active subjects with their progress.
 */
export function Sidebar({ location }: { location: Location }) {
  const learning = useLearning();
  return (
    <nav class="sidebar" aria-label={t('tab.label')}>
      <p class="sidebar__name">{t('app.name')}</p>
      <ul class="sidebar__nav">
        {TAB_ROUTES.map((route) => {
          const current = route === location.name;
          return (
            <li key={route}>
              <a
                href={href(route)}
                class={`sidebar__item${current ? ' sidebar__item--active' : ''}`}
                aria-current={current ? 'page' : undefined}
              >
                <Icon name={route as 'today'} size={20} />
                {t(`tab.${route}` as StringId)}
              </a>
            </li>
          );
        })}
      </ul>
      {learning.status === 'ready' ? (
        <ActiveSubjects data={learning.value.data} location={location} />
      ) : null}
    </nav>
  );
}

function ActiveSubjects({ data, location }: { data: LearningData; location: Location }) {
  const subjects = useLibrary(data).subjects.filter((s) => s.active && s.verified > 0);
  if (subjects.length === 0) return null;
  return (
    <section class="sidebar__subjects" aria-labelledby="sidebar-subjects">
      <h2 class="sidebar__heading" id="sidebar-subjects">
        {t('sidebar.subjects')}
      </h2>
      <ul class="sidebar__nav">
        {subjects.map((s) => {
          const percent = coveragePercent(s);
          const current = location.name === 'library' && location.id === s.id;
          return (
            <li key={s.id}>
              <a
                href={href('library', s.id)}
                class={`sidebar__subject${current ? ' sidebar__subject--active' : ''}`}
                aria-current={current ? 'page' : undefined}
              >
                <span>{s.label}</span>
                <ProgressBar
                  value={percent / 100}
                  label={t('library.progressLabel', { percent })}
                  accent={s.accent}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
