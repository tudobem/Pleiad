import { Sidebar } from './components/Sidebar.tsx';
import { TabBar } from './components/TabBar.tsx';
import { useRoute } from './router.ts';
import { SessionScreen } from './screens/SessionScreen.tsx';
import { LibraryScreen } from './screens/LibraryScreen.tsx';
import { RewardsScreen, StatsScreen } from './screens/StatsScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { StubScreen } from './screens/StubScreen.tsx';
import { SubjectScreen } from './screens/SubjectScreen.tsx';
import { TodayScreen } from './screens/TodayScreen.tsx';
import { useServices } from './services.ts';
import { t } from './strings.ts';
import { useWide } from './useWide.ts';
import './screens/screens.css';
import './layout.css';

export function App() {
  const location = useRoute();
  const route = location.name;
  const { persistent } = useServices();
  const wide = useWide();

  if (route === 'session') return <SessionScreen />;

  const library = location.id ? (
    <SubjectScreen subjectId={location.id} {...(location.open ? { open: location.open } : {})} />
  ) : (
    <LibraryScreen />
  );

  return (
    <div class="layout">
      {wide ? <Sidebar key={`${route}/${location.id ?? ''}`} location={location} /> : null}
      <div class="layout__content">
        {!persistent ? (
          <p class="banner" role="alert">
            {t('common.storageUnavailable')}
          </p>
        ) : null}
        {route === 'today' ? <TodayScreen /> : null}
        {route === 'practice' ? <StubScreen title="practice.title" body="practice.body" /> : null}
        {route === 'stats' && location.id === 'rewards' ? <RewardsScreen /> : null}
        {route === 'stats' && location.id !== 'rewards' ? <StatsScreen /> : null}
        {route === 'library' && wide ? (
          // Wide: the shelves stay beside the selected subject (DESIGN 3).
          <div class="split">
            <LibraryScreen />
            <div class="split__detail">
              {location.id ? (
                <SubjectScreen
                  key={location.id}
                  subjectId={location.id}
                  {...(location.open ? { open: location.open } : {})}
                />
              ) : (
                <p class="split__empty">{t('library.chooseSubject')}</p>
              )}
            </div>
          </div>
        ) : null}
        {route === 'library' && !wide ? library : null}
        {route === 'settings' ? <SettingsScreen /> : null}
      </div>
      <TabBar current={route} />
    </div>
  );
}
