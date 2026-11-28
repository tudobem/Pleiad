import {
  binOf,
  offBy,
  sliderPosition,
  sliderValue,
  SLIDER_STEPS,
} from '../../../core/content/estimation.ts';
import type { EstimationQuestion } from '../../../core/content/types.ts';
import type { Response } from '../../../core/session/response.ts';
import { formatNumber, withUnit } from '../../format.ts';
import { t } from '../../strings.ts';
import { OptionButton, type OptionState } from '../OptionButton.tsx';
import type { AnswerProps } from './types.ts';

/** "Important numbers" (SPEC 6): tap a range, or move a log or linear slider. */
export function EstimationAnswer(props: AnswerProps<EstimationQuestion>) {
  return props.question.bins ? <BinAnswer {...props} /> : <SliderAnswer {...props} />;
}

function BinAnswer({ question, response, feedback, onRespond }: AnswerProps<EstimationQuestion>) {
  const bins = question.bins ?? [];
  const chosen = (response as Extract<Response, { type: 'estimation' }>).bin;
  const right = binOf(bins, question.value);
  return (
    <div class="session__answers">
      {!feedback ? <p class="answer__hint">{t('estimate.binHint')}</p> : null}
      {bins.map((bin, i) => {
        let state: OptionState = 'default';
        let tag: string | undefined;
        if (!feedback) {
          if (chosen === i) state = 'selected';
        } else if (i === right) {
          state = 'correct';
          tag = t('session.labelCorrect');
        } else if (i === chosen) {
          state = 'wrong';
          tag = t('session.labelYours');
        } else {
          state = 'dimmed';
        }
        const text =
          bin.label ??
          t('estimate.binRange', { min: formatNumber(bin.min), max: formatNumber(bin.max) });
        return (
          <OptionButton
            key={i}
            letter={String(i + 1)}
            text={text}
            state={state}
            {...(tag ? { tag } : {})}
            locked={feedback}
            onSelect={() => onRespond({ type: 'estimation', bin: i, value: null })}
          />
        );
      })}
      {feedback ? (
        <p class="estimate-truth">
          {t('estimate.truth', { value: withUnit(question.value, question.unit) })}
        </p>
      ) : null}
    </div>
  );
}

function SliderAnswer({
  question,
  response,
  feedback,
  onRespond,
}: AnswerProps<EstimationQuestion>) {
  const range = question.range ?? { min: 0, max: 1 };
  const value = (response as Extract<Response, { type: 'estimation' }>).value;
  const scale = question.scale;
  // Until moved, the thumb rests in the middle and nothing is chosen.
  const position = value === null ? SLIDER_STEPS / 2 : sliderPosition(value, range, scale);
  const percent = (x: number) => `${(sliderPosition(x, range, scale) / SLIDER_STEPS) * 100}%`;

  if (feedback && value !== null) {
    const off = offBy(question, value);
    const phrase =
      off.direction === 'exact'
        ? t('estimate.exact')
        : scale === 'log'
          ? t(off.direction === 'low' ? 'estimate.timesLow' : 'estimate.timesHigh', {
              n: formatNumber(off.amount),
            })
          : t(off.direction === 'low' ? 'estimate.amountLow' : 'estimate.amountHigh', {
              amount: withUnit(off.amount, question.unit),
            });
    return (
      <div class="session__answers estimate-result">
        <p class="estimate-truth">
          {t('estimate.truth', { value: withUnit(question.value, question.unit) })}
        </p>
        <p class="estimate-yours">
          {t('estimate.yours', { value: withUnit(value, question.unit) })} {phrase}
        </p>
        <div class="estimate-scale" role="img" aria-label={t('estimate.scaleLabel')}>
          <span class="estimate-scale__track" />
          <span
            class="estimate-scale__mark estimate-scale__mark--yours"
            style={{ left: percent(value) }}
          />
          <span
            class="estimate-scale__mark estimate-scale__mark--truth"
            style={{ left: percent(question.value) }}
          />
        </div>
        <div class="estimate-ends" aria-hidden="true">
          <span>{formatNumber(range.min)}</span>
          <span>{formatNumber(range.max)}</span>
        </div>
      </div>
    );
  }

  return (
    <div class="session__answers">
      <p class="answer__hint">{t('estimate.sliderHint')}</p>
      <p
        class={`estimate-readout${value === null ? ' estimate-readout--empty' : ''}`}
        aria-live="polite"
      >
        {value === null ? t('estimate.untouched') : withUnit(value, question.unit)}
      </p>
      <input
        class="estimate-slider"
        type="range"
        min={0}
        max={SLIDER_STEPS}
        step={1}
        value={position}
        aria-label={t('estimate.sliderLabel')}
        aria-valuetext={value === null ? t('estimate.untouched') : withUnit(value, question.unit)}
        onInput={(e) =>
          onRespond({
            type: 'estimation',
            bin: null,
            value: sliderValue(Number((e.currentTarget as HTMLInputElement).value), range, scale),
          })
        }
      />
      <div class="estimate-ends" aria-hidden="true">
        <span>{formatNumber(range.min)}</span>
        <span>{formatNumber(range.max)}</span>
      </div>
    </div>
  );
}
