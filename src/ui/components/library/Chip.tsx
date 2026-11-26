import type { ComponentChildren } from 'preact';
import './library.css';

/** Toggle chip (DESIGN 5). Pressed state is announced via aria-pressed. */
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
    <button
      type="button"
      class={`chip${pressed ? ' chip--pressed' : ''}`}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
