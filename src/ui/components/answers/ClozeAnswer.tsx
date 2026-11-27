import { useState } from 'preact/hooks';
import type { ClozeQuestion } from '../../../core/content/types.ts';
import { parseCloze } from '../../../core/content/cloze.ts';
import { clozeChips, type Response } from '../../../core/session/response.ts';
import { MathText } from '../MathText.tsx';
import { t } from '../../strings.ts';
import { Mark } from './Mark.tsx';
import type { AnswerProps } from './types.ts';

export function ClozeAnswer({
  question,
  layout,
  response,
  feedback,
  grade,
  onRespond,
}: AnswerProps<ClozeQuestion>) {
  const fills = (response as Extract<Response, { type: 'cloze' }>).fills;
  const chips = clozeChips(question);
  const parts = parseCloze(question.text);
  const firstEmpty = fills.findIndex((f) => f === null);
  const [active, setActive] = useState<number | null>(null);
  const target = active !== null && fills[active] === null ? active : firstEmpty;

  const chipText = (displayIndex: number | null) =>
    displayIndex === null ? '' : (chips[layout[displayIndex] ?? -1] ?? '');

  const place = (displayIndex: number) => {
    if (target < 0) return;
    const next = [...fills];
    next[target] = displayIndex;
    onRespond({ type: 'cloze', fills: next });
    setActive(null);
  };
  const clear = (blank: number) => {
    const next = [...fills];
    next[blank] = null;
    onRespond({ type: 'cloze', fills: next });
    setActive(blank);
  };

  return (
    <div class="session__answers cloze">
      <p class="cloze__text">
        {parts.map((part, i) => {
          if (part.kind === 'text') return <MathText key={i} text={part.value} />;
          const filled = fills[part.index] ?? null;
          const label =
            filled === null
              ? t('session.blankEmpty', { n: part.index + 1 })
              : `${t('session.blank', { n: part.index + 1 })}: ${chipText(filled)}`;
          if (feedback) {
            const ok = grade?.parts[part.index] === true;
            return (
              <span key={i} class={`cloze__blank cloze__blank--${ok ? 'ok' : 'wrong'}`}>
                <Mark ok={ok} />
                {chipText(filled)}
                {!ok ? <span class="cloze__fix">{part.answer}</span> : null}
              </span>
            );
          }
          return (
            <button
              key={i}
              type="button"
              class={`cloze__blank${part.index === target ? ' cloze__blank--active' : ''}`}
              aria-label={label}
              onClick={() => (filled === null ? setActive(part.index) : clear(part.index))}
            >
              <span class="cloze__num" aria-hidden="true">
                {part.index + 1}
              </span>
              {filled === null ? ' ' : chipText(filled)}
            </button>
          );
        })}
      </p>
      {!feedback ? (
        <>
          <p class="answer__hint">{t('session.clozeHint')}</p>
          <div class="word-bank" role="group" aria-label={t('session.wordBank')}>
            {layout.map((_, displayIndex) => {
              const used = fills.includes(displayIndex);
              return (
                <button
                  key={displayIndex}
                  type="button"
                  class="word-chip"
                  disabled={used || target < 0}
                  onClick={() => place(displayIndex)}
                >
                  {chipText(displayIndex)}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
