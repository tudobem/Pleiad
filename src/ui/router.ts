import { useEffect, useState } from 'preact/hooks';

/**
 * Hash routing (#/today, #/library/<subjectId>?open=<branchId>, ...): works on
 * GitHub Pages and offline without server rewrites.
 */
export const ROUTES = ['today', 'practice', 'stats', 'library', 'settings', 'session'] as const;
export type Route = (typeof ROUTES)[number];
export const TAB_ROUTES: readonly Route[] = ['today', 'practice', 'stats', 'library', 'settings'];

export interface Location {
  readonly name: Route;
  /** Second path segment, e.g. a subject ID. */
  readonly id?: string;
  /** `open` query parameter, e.g. a branch to expand. */
  readonly open?: string;
}

const decode = (part: string | undefined): string | undefined => {
  if (!part) return undefined;
  try {
    return decodeURIComponent(part);
  } catch {
    return undefined;
  }
};

export function parseLocation(hash: string): Location {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [first = '', second] = path.split('/');
  if (!(ROUTES as readonly string[]).includes(first)) return { name: 'today' };
  const id = decode(second);
  const open = decode(new URLSearchParams(query).get('open') ?? undefined);
  return { name: first as Route, ...(id ? { id } : {}), ...(open ? { open } : {}) };
}

export function parseRoute(hash: string): Route {
  return parseLocation(hash).name;
}

export function href(name: Route, id?: string, open?: string): string {
  const path = id ? `${name}/${encodeURIComponent(id)}` : name;
  return `#/${path}${open ? `?open=${encodeURIComponent(open)}` : ''}`;
}

export function navigate(name: Route, id?: string, open?: string): void {
  window.location.hash = href(name, id, open);
}

export function useRoute(): Location {
  const [location, setLocation] = useState<Location>(() => parseLocation(window.location.hash));
  useEffect(() => {
    const onChange = () => setLocation(parseLocation(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return location;
}
