import { intensity, type DayActivity } from '../../../core/analytics/activity.ts';
import { t } from '../../strings.ts';
import './stats.css';

/**
 * Activity heatmap: one column per week, one cell per learning day, gold
 * intensity in five steps (DESIGN 4.6). The last cell is today.
 */
export function Heatmap({ days }: { days: readonly DayActivity[] }) {
  const max = Math.max(0, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  return (
    <div class="heatmap" role="img" aria-label={t('stats.activityLabel', { n: total })}>
      {days.map((d, i) => (
        <span
          key={d.day}
          class={`heatmap__cell heatmap__cell--${intensity(d.count, max)}${
            i === days.length - 1 ? ' heatmap__cell--today' : ''
          }`}
          title={t('stats.dayLabel', { count: d.count })}
        />
      ))}
    </div>
  );
}
