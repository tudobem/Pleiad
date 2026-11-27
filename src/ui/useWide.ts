import { useEffect, useState } from 'preact/hooks';

/**
 * The wide layout (DESIGN 3: iPad landscape, desktop). Portrait tablets keep
 * the phone layout. Must match the media query in layout.css.
 */
export const WIDE_QUERY = '(min-width: 1000px) and (orientation: landscape)';

function matches(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(WIDE_QUERY).matches === true;
}

export function useWide(): boolean {
  const [wide, setWide] = useState(matches);
  useEffect(() => {
    const mq = window.matchMedia?.(WIDE_QUERY);
    if (!mq) return undefined;
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    onChange();
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}
