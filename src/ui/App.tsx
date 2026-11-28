import { Sidebar } from './components/Sidebar.tsx';
import { TabBar } from './components/TabBar.tsx';
import { navigate, useRoute, type Route } from './router.ts';
import { loadOnboarded } from './learning.ts';
import { needsOnboarding } from '../core/onboarding/pace.ts';
import { useEffect } from 'preact/hooks';
import { SessionScreen } from './screens/SessionScreen.tsx';
import { CalibrationScreen } from './screens/CalibrationScreen.tsx';
import { LibraryScreen } from './screens/LibraryScreen.tsx';
import { RewardsScreen, StatsScreen } from './screens/StatsScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { PracticeScreen } from './screens/PracticeScreen.tsx';
import { SubjectScreen } from './screens/SubjectScreen.tsx';
import { TodayScreen } from './screens/TodayScreen.tsx';
import { WelcomeScreen } from './screens/WelcomeScreen.tsx';
import { useServices } from './services.ts';
import { t } from './strings.ts';
import { useWide } from './useWide.ts';
import './screens/screens.css';
import './layout.css';

/** A fresh profile opening on Today goes to the first-run welcome (SPEC 13). */
function useOnboardingRedirect(route: Route): void {
  const services = useServices();
  useEffect(() => {
    if (route !== 'today') return;
    let alive = true;
    void (async () => {
      const [onboarded, events] = await Promise.all([
        loadOnboarded(services),
        services.storage.listReviews(),
      ]);
      if (alive && needsOnboarding(events.length, onboarded)) navigate('welcome');
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
    // Checked once at startup, not on every visit to Today.
  }, []);
}

export function App() {
  const location = useRoute();
  const route = location.name;
  const { persistent } = useServices();
  const wide = useWide();

  useOnboardingRedirect(route);

  if (route === 'session') return <SessionScreen />;
  if (route === 'welcome') {
    return <WelcomeScreen {...(location.id ? { step: location.id } : {})} />;
  }

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
        {route === 'practice' ? (
          <PracticeScreen
            key={location.id ?? ''}
            {...(location.id ? { target: location.id } : {})}
          />
        ) : null}
        {route === 'stats' && location.id === 'rewards' ? <RewardsScreen /> : null}
        {route === 'stats' && location.id === 'calibration' ? <CalibrationScreen /> : null}
        {route === 'stats' && location.id !== 'rewards' && location.id !== 'calibration' ? (
          <StatsScreen />
        ) : null}
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
