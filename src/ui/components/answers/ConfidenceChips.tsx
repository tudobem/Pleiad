import { CONFIDENCE_LEVELS } from '../../../core/analytics/calibration.ts';
import type { Confidence } from '../../../core/sync/reviewEvent.ts';
import { t, type StringId } from '../../strings.ts';
import { Chip } from '../library/Chip.tsx';
import './answers.css';

/**
 * Guess / Fairly sure / Certain before answering (SPEC 9). Optional: tapping
 * the selected chip clears it; the choice carries over to the next question.
 */
export function ConfidenceChips({
  value,
  onChange,
}: {
  value: Confidence | undefined;
  onChange: (confidence: Confidence | null) => void;
}) {
  return (
    <div class="confidence" role="group" aria-label={t('confidence.label')}>
      {CONFIDENCE_LEVELS.map((level) => (
        <Chip
          key={level}
          pressed={value === level}
          onClick={() => onChange(value === level ? null : level)}
        >
          {t(`confidence.${level}` as StringId)}
        </Chip>
      ))}
    </div>
  );
}
