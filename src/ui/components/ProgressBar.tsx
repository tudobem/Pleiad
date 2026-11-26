import './components.css';

/** Thin bar. `accent` is a color token name from tokens.css (a pack accent). */
export function ProgressBar({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      class="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      style={accent ? { '--progress-fill': `var(--${accent})` } : undefined}
    >
      <div class="progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
