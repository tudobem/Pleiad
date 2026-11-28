import type { AttributionQuestion } from '../../../core/content/types.ts';
import type { Response } from '../../../core/session/response.ts';
import { t } from '../../strings.ts';
import { thinker } from '../../thinkers.ts';
import { OptionButton, type OptionState } from '../OptionButton.tsx';
import type { AnswerProps } from './types.ts';

const LETTERS = 'ABCDE';

/** "Who argued this?" (SPEC 6): MCQ over thinker names; original 0 is the answer. */
export function AttributionAnswer({
  question,
  layout,
  response,
  feedback,
  onRespond,
}: AnswerProps<AttributionQuestion>) {
  const choice = (response as Extract<Response, { type: 'attribution' }>).choice;
  const ids = [question.thinker, ...question.options];
  const right = thinker(question.thinker);
  return (
    <div class="session__answers">
      {layout.map((original, displayIndex) => {
        const person = thinker(ids[original] ?? '');
        let state: OptionState = 'default';
        let tag: string | undefined;
        if (!feedback) {
          if (choice === displayIndex) state = 'selected';
        } else if (original === 0) {
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
            text={person.name}
            state={state}
            {...(tag ? { tag } : {})}
            {...(person.years ? { note: person.years } : {})}
            locked={feedback}
            onSelect={() => onRespond({ type: 'attribution', choice: displayIndex })}
          />
        );
      })}
      {feedback && right.note ? <p class="attribution-note">{right.note}</p> : null}
    </div>
  );
}
