import { useEffect, useRef } from 'preact/hooks';
import type { ShortQuestion } from '../../../core/content/types.ts';
import type { Response } from '../../../core/session/response.ts';
import { Button } from '../Button.tsx';
import { t } from '../../strings.ts';
import { Mark } from './Mark.tsx';
import type { AnswerProps } from './types.ts';

export function ShortAnswer({
  question,
  response,
  feedback,
  pending,
  onRespond,
  onSubmit,
  onOverride,
}: AnswerProps<ShortQuestion>) {
  const text = (response as Extract<Response, { type: 'short' }>).text;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!feedback) input.current?.focus({ preventScroll: true });
  }, [feedback, question.id]);

  if (!feedback || !pending) {
    return (
      <form
        class="session__answers short"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label class="short__label" for="short-answer">
          {t('session.shortLabel')}
        </label>
        <input
          ref={input}
          id="short-answer"
          class="short__input"
          type="text"
          value={text}
          placeholder={t('session.shortPlaceholder')}
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          enterkeyhint="done"
          onInput={(e) => onRespond({ type: 'short', text: (e.target as HTMLInputElement).value })}
        />
      </form>
    );
  }

  const correct = pending.correct;
  return (
    <div class="session__answers short">
      <div class={`short__row short__row--${correct ? 'ok' : 'wrong'}`}>
        <Mark ok={correct} />
        <span class="short__caption">{t('session.yourAnswer')}</span>
        <span class="short__value">{text}</span>
      </div>
      <div class="short__row">
        <span class="short__caption">{t('session.acceptedAnswer')}</span>
        <span class="short__value short__value--answer">{question.answers[0]}</span>
      </div>
      <div class="short__override">
        {pending.overridden ? <span class="short__note">{t('session.overridden')}</span> : null}
        <Button variant="text" onClick={() => onOverride(!correct)}>
          {correct ? t('session.iWasWrong') : t('session.iWasRight')}
        </Button>
      </div>
    </div>
  );
}
