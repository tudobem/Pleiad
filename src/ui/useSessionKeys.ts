import { useEffect, useRef } from 'preact/hooks';
import { keyCommand } from '../core/session/keys.ts';
import type { SessionController } from './useSession.ts';

/** Keys belong to the element when the user is typing or a control has focus. */
function ownedByTarget(event: KeyboardEvent): boolean {
  const el = event.target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  // A focused button or link already handles Space and Enter natively.
  return (tag === 'BUTTON' || tag === 'A') && (event.key === ' ' || event.key === 'Enter');
}

/** Hardware keyboard shortcuts in a session (SPEC 17). */
export function useSessionKeys(session: SessionController): void {
  const ref = useRef(session);
  ref.current = session;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (ownedByTarget(event)) return;
      const s = ref.current;
      const { state, question } = s;
      if (!question || (state.phase !== 'question' && state.phase !== 'feedback')) return;
      const command = keyCommand(event.key, {
        phase: state.phase,
        type: question.type,
        optionCount: question.type === 'mcq' ? question.options.length : 0,
        canCheck: s.canCheck,
        busy: s.busy,
      });
      if (!command) return;
      event.preventDefault();
      switch (command.kind) {
        case 'select':
          s.respond({ type: 'mcq', choice: command.index });
          break;
        case 'check':
          s.check();
          break;
        case 'next':
          s.next();
          break;
        case 'rate':
          s.next({ rating: command.rating });
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
