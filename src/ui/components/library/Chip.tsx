import type { ComponentChildren } from 'preact';
import { Icon } from '../Icon.tsx';
import './library.css';

/**
 * Toggle chip (DESIGN 5). The selected state comes from aria-pressed, shown in
 * gold with a check mark so it never depends on colour alone.
 */
export function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ComponentChildren;
}) {
  return (
    <button type="button" class="chip" aria-pressed={pressed} onClick={onClick}>
      {pressed ? (
        <span class="chip__check">
          <Icon name="check" size={16} />
        </span>
      ) : null}
      {children}
    </button>
  );
}
