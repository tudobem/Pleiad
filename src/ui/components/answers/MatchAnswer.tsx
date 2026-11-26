import { useState } from 'preact/hooks';
import type { MatchQuestion } from '../../../core/content/types.ts';
import type { Response } from '../../../core/session/response.ts';
import { MathText } from '../MathText.tsx';
import { t } from '../../strings.ts';
import { Mark } from './Mark.tsx';
import type { AnswerProps } from './types.ts';

export function MatchAnswer({
  question,
  layout,
  response,
  feedback,
  grade,
  onRespond,
}: AnswerProps<MatchQuestion>) {
  const pairs = (response as Extract<Response, { type: 'match' }>).pairs;
  const [active, setActive] = useState<number | null>(null);
  const rightText = (displayIndex: number | null) =>
    displayIndex === null ? '' : (question.pairs[layout[displayIndex] ?? -1]?.right ?? '');

  if (feedback) {
    return (
      <ul class="session__answers match-result">
        {question.pairs.map((pair, i) => {
          const ok = grade?.parts[i] === true;
          return (
            <li key={i} class={`match-result__row match-result__row--${ok ? 'ok' : 'wrong'}`}>
              <Mark ok={ok} />
              <span class="match-result__left">
                <MathText text={pair.left} />
              </span>
              <span class="match-result__right">
                <MathText text={rightText(pairs[i] ?? null)} />
                {!ok ? (
                  <span class="answer__fix">{t('session.correctIs', { text: pair.right })}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  const leftFor = (displayIndex: number) => pairs.findIndex((p) => p === displayIndex);
  const tapLeft = (i: number) => {
    if (pairs[i] !== null) {
      const next = [...pairs];
      next[i] = null;
      onRespond({ type: 'match', pairs: next });
    }
    setActive(active === i ? null : i);
  };
  const tapRight = (displayIndex: number) => {
    const owner = leftFor(displayIndex);
    if (active === null) {
      if (owner >= 0) {
        const next = [...pairs];
        next[owner] = null;
        onRespond({ type: 'match', pairs: next });
      }
      return;
    }
    const next = pairs.map((p) => (p === displayIndex ? null : p));
    next[active] = displayIndex;
    onRespond({ type: 'match', pairs: next });
    setActive(null);
  };

  return (
    <div class="session__answers">
      <p class="answer__hint">{t('session.matchHint')}</p>
      <div class="match">
        <div class="match__col" role="group" aria-label={t('session.matchLeft')}>
          {question.pairs.map((pair, i) => (
            <button
              key={i}
              type="button"
              class={`match__item${active === i ? ' match__item--active' : ''}${pairs[i] !== null ? ' match__item--paired' : ''}`}
              aria-pressed={active === i}
              onClick={() => tapLeft(i)}
            >
              {pairs[i] !== null ? <span class="match__badge">{i + 1}</span> : null}
              <MathText text={pair.left} />
            </button>
          ))}
        </div>
        <div class="match__col" role="group" aria-label={t('session.matchRight')}>
          {layout.map((_, displayIndex) => {
            const owner = leftFor(displayIndex);
            return (
              <button
                key={displayIndex}
                type="button"
                class={`match__item${owner >= 0 ? ' match__item--paired' : ''}`}
                aria-label={
                  owner >= 0
                    ? `${rightText(displayIndex)}, ${t('session.pairedWith', { n: owner + 1 })}`
                    : undefined
                }
                onClick={() => tapRight(displayIndex)}
              >
                {owner >= 0 ? <span class="match__badge">{owner + 1}</span> : null}
                <MathText text={rightText(displayIndex)} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
