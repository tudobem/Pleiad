import type { McqQuestion } from '../../../core/content/types.ts';
import type { Response } from '../../../core/session/response.ts';
import { OptionButton, type OptionState } from '../OptionButton.tsx';
import { t } from '../../strings.ts';
import type { AnswerProps } from './types.ts';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function McqAnswer({
  question,
  layout,
  response,
  feedback,
  onRespond,
}: AnswerProps<McqQuestion>) {
  const choice = (response as Extract<Response, { type: 'mcq' }>).choice;
  return (
    <div class="session__answers" role="group" aria-label={t('session.optionsLabel')}>
      {layout.map((original, displayIndex) => {
        const option = question.options[original];
        if (!option) return null;
        let state: OptionState = 'default';
        let tag: string | undefined;
        if (!feedback) {
          if (choice === displayIndex) state = 'selected';
        } else if (original === question.answer) {
          state = 'correct';
          tag = t('session.labelCorrect');
        } else if (displayIndex === choice) {
          state = 'wrong';
          tag = t('session.labelYours');
        } else {
          state = 'dimmed';
        }
        return (
          <OptionButton
            key={original}
            letter={LETTERS[displayIndex] ?? ''}
            text={option.text}
            state={state}
            {...(tag ? { tag } : {})}
            {...(feedback && displayIndex === choice && option.why_wrong
              ? { note: option.why_wrong }
              : {})}
            locked={feedback}
            onSelect={() => onRespond({ type: 'mcq', choice: displayIndex })}
          />
        );
      })}
    </div>
  );
}
