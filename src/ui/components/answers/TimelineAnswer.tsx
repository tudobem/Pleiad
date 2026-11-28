import { chronological, parseTimelineDate } from '../../../core/content/timeline.ts';
import type { TimelineQuestion } from '../../../core/content/types.ts';
import type { Response } from '../../../core/session/response.ts';
import { formatTimelineDate } from '../../format.ts';
import { t } from '../../strings.ts';
import { MathText } from '../MathText.tsx';
import { Mark } from './Mark.tsx';
import type { AnswerProps } from './types.ts';

/** Put events in date order (SPEC 6); feedback shows them on a dated line. */
export function TimelineAnswer({
  question,
  layout,
  response,
  feedback,
  grade,
  onRespond,
}: AnswerProps<TimelineQuestion>) {
  const sequence = (response as Extract<Response, { type: 'timeline' }>).sequence;
  const label = (displayIndex: number | undefined) =>
    displayIndex === undefined ? '' : (question.events[layout[displayIndex] ?? -1]?.label ?? '');

  if (feedback) {
    const order = chronological(question);
    return (
      <div class="session__answers">
        <ol class="timeline-result">
          {order.map((eventIndex, i) => {
            const event = question.events[eventIndex];
            if (!event) return null;
            const ok = grade?.parts[i] === true;
            const date = parseTimelineDate(event.date);
            return (
              <li
                key={eventIndex}
                class={`timeline-result__row timeline-result__row--${ok ? 'ok' : 'wrong'}`}
              >
                <span class="timeline-result__date">
                  {date ? formatTimelineDate(date, question.precision) : event.date}
                </span>
                <Mark ok={ok} />
                <span class="timeline-result__text">
                  <MathText text={event.label} />
                  {!ok ? (
                    <span class="answer__fix">
                      {t('timeline.yours', { text: label(sequence[i]) })}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  const toggle = (displayIndex: number) => {
    const at = sequence.indexOf(displayIndex);
    onRespond({
      type: 'timeline',
      sequence: at >= 0 ? sequence.filter((d) => d !== displayIndex) : [...sequence, displayIndex],
    });
  };

  return (
    <div class="session__answers">
      <p class="answer__hint">{t('timeline.hint')}</p>
      {layout.map((_, displayIndex) => {
        const position = sequence.indexOf(displayIndex);
        return (
          <button
            key={displayIndex}
            type="button"
            class={`option${position >= 0 ? ' option--selected' : ''}`}
            aria-pressed={position >= 0}
            aria-label={
              position >= 0
                ? `${label(displayIndex)}, ${t('session.position', { n: position + 1 })}`
                : undefined
            }
            onClick={() => toggle(displayIndex)}
          >
            <span class="option__letter" aria-hidden="true">
              {position >= 0 ? position + 1 : ''}
            </span>
            <span class="option__body">
              <span class="option__text">
                <MathText text={label(displayIndex)} />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
