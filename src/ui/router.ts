import { useEffect, useState } from 'preact/hooks';

/**
 * Hash routing (#/today, #/session, ...): works on GitHub Pages and offline
 * without server rewrites.
 */
export const ROUTES = ['today', 'practice', 'stats', 'library', 'settings', 'session'] as const;
export type Route = (typeof ROUTES)[number];
export const TAB_ROUTES: readonly Route[] = ['today', 'practice', 'stats', 'library', 'settings'];

export function parseRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? '';
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'today';
}

export function navigate(route: Route): void {
  window.location.hash = `#/${route}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
