import type { ComponentChildren } from 'preact';
import './components.css';

/** Circular progress (DESIGN 5). `value` is 0..1; the label is for assistive tech. */
export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  children?: ComponentChildren;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <span
      class="ring"
      style={{ width: `${size}px`, height: `${size}px` }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle class="ring__track" cx={size / 2} cy={size / 2} r={r} stroke-width={stroke} />
        <circle
          class="ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke-width={stroke}
          stroke-dasharray={`${c} ${c}`}
          stroke-dashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children ? <span class="ring__center">{children}</span> : null}
    </span>
  );
}
