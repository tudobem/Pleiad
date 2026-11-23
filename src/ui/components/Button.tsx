import type { ComponentChildren } from 'preact';
import './components.css';

export interface ButtonProps {
  readonly variant?: 'primary' | 'secondary' | 'text';
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly children: ComponentChildren;
  readonly label?: string;
  readonly expanded?: boolean;
}

export function Button({
  variant = 'primary',
  onClick,
  disabled,
  children,
  label,
  expanded,
}: ButtonProps) {
  return (
    <button
      type="button"
      class={`button button--${variant}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-expanded={expanded}
    >
      {children}
    </button>
  );
}
