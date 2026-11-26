import './stats.css';

/** A topic row with a thin bar; coral when weak (DESIGN 4.6). */
export function StatBar({
  label,
  caption,
  value,
  valueText,
  detail,
  weak,
  href,
  ariaLabel,
}: {
  label: string;
  caption: string;
  /** 0..1 */
  value: number;
  valueText: string;
  detail: string;
  weak: boolean;
  href: string;
  ariaLabel: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <li>
      <a class={`stat-bar${weak ? ' stat-bar--weak' : ''}`} href={href} aria-label={ariaLabel}>
        <span class="stat-bar__line">
          <span class="stat-bar__label">{label}</span>
          <span class="stat-bar__value">{valueText}</span>
        </span>
        <span class="stat-bar__track" aria-hidden="true">
          <span class="stat-bar__fill" style={{ width: `${pct}%` }} />
        </span>
        <span class="stat-bar__caption">
          {caption} · {detail}
        </span>
      </a>
    </li>
  );
}
