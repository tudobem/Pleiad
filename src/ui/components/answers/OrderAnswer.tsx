import type { OrderQuestion } from '../../../core/content/types.ts';
import type { Response } from '../../../core/session/response.ts';
import { MathText } from '../MathText.tsx';
import { t } from '../../strings.ts';
import { Mark } from './Mark.tsx';
import type { AnswerProps } from './types.ts';

export function OrderAnswer({
  question,
  layout,
  response,
  feedback,
  grade,
  onRespond,
}: AnswerProps<OrderQuestion>) {
  const sequence = (response as Extract<Response, { type: 'order' }>).sequence;
  const text = (displayIndex: number | undefined) =>
    displayIndex === undefined ? '' : (question.items[layout[displayIndex] ?? -1] ?? '');

  if (feedback) {
    return (
      <div class="session__answers">
        <ol class="order-result">
          {question.items.map((item, i) => {
            const ok = grade?.parts[i] === true;
            return (
              <li key={i} class={`order-result__row order-result__row--${ok ? 'ok' : 'wrong'}`}>
                <span class="order__num">{i + 1}</span>
                <Mark ok={ok} />
                <span class="order-result__text">
                  <MathText text={text(sequence[i])} />
                  {!ok ? (
                    <span class="answer__fix">{t('session.correctIs', { text: item })}</span>
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
      type: 'order',
      sequence: at >= 0 ? sequence.filter((d) => d !== displayIndex) : [...sequence, displayIndex],
    });
  };

  return (
    <div class="session__answers">
      <p class="answer__hint">{t('session.orderHint')}</p>
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
                ? `${text(displayIndex)}, ${t('session.position', { n: position + 1 })}`
                : undefined
            }
            onClick={() => toggle(displayIndex)}
          >
            <span class="option__letter" aria-hidden="true">
              {position >= 0 ? position + 1 : ''}
            </span>
            <span class="option__body">
              <span class="option__text">
                <MathText text={text(displayIndex)} />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
