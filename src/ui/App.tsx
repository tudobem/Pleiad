import { TabBar } from './components/TabBar.tsx';
import { useRoute } from './router.ts';
import { SessionScreen } from './screens/SessionScreen.tsx';
import { StubScreen } from './screens/StubScreen.tsx';
import { TodayScreen } from './screens/TodayScreen.tsx';
import { useServices } from './services.ts';
import { t } from './strings.ts';
import './screens/screens.css';

export function App() {
  const route = useRoute();
  const { appVersion, persistent } = useServices();

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
      {route === 'stats' ? <StubScreen title="stats.title" body="stats.body" /> : null}
      {route === 'library' ? <StubScreen title="library.title" body="library.body" /> : null}
      {route === 'settings' ? (
        <StubScreen title="settings.title" body="settings.body">
          <p class="screen__muted">{t('settings.version', { version: appVersion })}</p>
        </StubScreen>
      ) : null}
      <TabBar current={route} />
    </>
  );
}
