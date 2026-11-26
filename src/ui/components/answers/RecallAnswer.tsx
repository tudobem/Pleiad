import type { RecallQuestion } from '../../../core/content/types.ts';
import { Card } from '../Card.tsx';
import { MathText } from '../MathText.tsx';
import { t } from '../../strings.ts';
import type { AnswerProps } from './types.ts';

/** Think, then reveal (SPEC 6). Rating buttons live in the session footer. */
export function RecallAnswer({ question, feedback }: AnswerProps<RecallQuestion>) {
  if (!feedback) return <div class="session__answers" />;
  return (
    <div class="session__answers">
      <Card class="recall">
        <p class="screen__overline">{t('session.answerTitle')}</p>
        <p class="recall__answer">
          <MathText text={question.answer_text} />
        </p>
      </Card>
    </div>
  );
}
