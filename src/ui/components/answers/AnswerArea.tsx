import type { Question } from '../../../core/content/types.ts';
import { ClozeAnswer } from './ClozeAnswer.tsx';
import { MatchAnswer } from './MatchAnswer.tsx';
import { McqAnswer } from './McqAnswer.tsx';
import { OrderAnswer } from './OrderAnswer.tsx';
import { RecallAnswer } from './RecallAnswer.tsx';
import { ShortAnswer } from './ShortAnswer.tsx';
import type { AnswerProps } from './types.ts';
import './answers.css';

/** The answer controls and their feedback for one question, by type. */
export function AnswerArea(props: AnswerProps<Question>) {
  const q = props.question;
  switch (q.type) {
    case 'mcq':
      return <McqAnswer {...props} question={q} />;
    case 'short':
      return <ShortAnswer {...props} question={q} />;
    case 'cloze':
      return <ClozeAnswer {...props} question={q} />;
    case 'match':
      return <MatchAnswer {...props} question={q} />;
    case 'order':
      return <OrderAnswer {...props} question={q} />;
    case 'recall':
      return <RecallAnswer {...props} question={q} />;
  }
}
