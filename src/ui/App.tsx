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
import './screens/screens.css';

export function App() {
  const location = useRoute();
  const route = location.name;
  const { persistent } = useServices();

  if (route === 'session') return <SessionScreen />;

  return (
    <>
      {!persistent ? (
        <p class="banner" role="alert">
          {t('common.storageUnavailable')}
        </p>
      ) : null}
      {route === 'today' ? <TodayScreen /> : null}
      {route === 'practice' ? <StubScreen title="practice.title" body="practice.body" /> : null}
      {route === 'stats' && location.id === 'rewards' ? <RewardsScreen /> : null}
      {route === 'stats' && location.id !== 'rewards' ? <StatsScreen /> : null}
      {route === 'library' && location.id ? (
        <SubjectScreen
          subjectId={location.id}
          {...(location.open ? { open: location.open } : {})}
        />
      ) : null}
      {route === 'library' && !location.id ? <LibraryScreen /> : null}
      {route === 'settings' ? <SettingsScreen /> : null}
      <TabBar current={route} />
    </>
  );
}
