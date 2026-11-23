import { Icon } from './Icon.tsx';
import { TAB_ROUTES, type Route } from '../router.ts';
import { t, type StringId } from '../strings.ts';
import './components.css';

export function TabBar({ current }: { current: Route }) {
  return (
    <nav class="tabbar" aria-label={t('tab.label')}>
      {TAB_ROUTES.map((route) => (
        <a
          key={route}
          href={`#/${route}`}
          class={`tabbar__item${route === current ? ' tabbar__item--active' : ''}`}
          aria-current={route === current ? 'page' : undefined}
        >
          <Icon name={route as 'today'} />
          <span class="tabbar__label">{t(`tab.${route}` as StringId)}</span>
        </a>
      ))}
    </nav>
  );
}
