import type { Question } from '../../../core/content/types.ts';
import { AttributionAnswer } from './AttributionAnswer.tsx';
import { ClozeAnswer } from './ClozeAnswer.tsx';
import { ImageAnswer } from './ImageAnswer.tsx';
import { EstimationAnswer } from './EstimationAnswer.tsx';
import { TimelineAnswer } from './TimelineAnswer.tsx';
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
    case 'estimation':
      return <EstimationAnswer {...props} question={q} />;
    case 'timeline':
      return <TimelineAnswer {...props} question={q} />;
    case 'image':
      return <ImageAnswer {...props} question={q} />;
    case 'attribution':
      return <AttributionAnswer {...props} question={q} />;
    case 'recall':
      return <RecallAnswer {...props} question={q} />;
  }
}
