import type { ImageQuestion, McqQuestion } from '../../../core/content/types.ts';
import type { Response } from '../../../core/session/response.ts';
import { t } from '../../strings.ts';
import { McqAnswer } from './McqAnswer.tsx';
import type { AnswerProps } from './types.ts';

/** A picture with MCQ options, or a picture to tap (SPEC 6). */
export function ImageAnswer(props: AnswerProps<ImageQuestion>) {
  const { question } = props;
  const image = question.media[0];
  if (question.mode === 'hotspot') return <HotspotAnswer {...props} />;
  const r = props.response as Extract<Response, { type: 'image' }>;
  return (
    <>
      {image ? <img class="image-figure" src={image.src} alt={image.alt} /> : null}
      <McqAnswer
        {...props}
        question={question as unknown as McqQuestion}
        response={{ type: 'mcq', choice: r.choice }}
        onRespond={(next) =>
          next.type === 'mcq' &&
          props.onRespond({ type: 'image', choice: next.choice, point: null })
        }
      />
    </>
  );
}

function HotspotAnswer({
  question,
  response,
  feedback,
  grade,
  onRespond,
}: AnswerProps<ImageQuestion>) {
  if (question.mode !== 'hotspot') return null;
  const image = question.media[0];
  const point = (response as Extract<Response, { type: 'image' }>).point;
  const right = question.hotspots[question.answer];

  const tap = (e: MouseEvent) => {
    if (feedback) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    onRespond({
      type: 'image',
      choice: -1,
      point: {
        x: ((e.clientX - box.left) / box.width) * 100,
        y: ((e.clientY - box.top) / box.height) * 100,
        aspect: box.width / box.height,
      },
    });
  };

  // Circles are sized in percent of the width; the box keeps the image's own proportions.
  const circle = (x: number, y: number, r: number, cls: string, label?: string) => (
    <span
      class={`image-spot ${cls}`}
      style={{ left: `${x}%`, top: `${y}%`, width: `${2 * r}%` }}
      aria-hidden="true"
    >
      {label ? <span class="image-spot__label">{label}</span> : null}
    </span>
  );

  return (
    <div class="session__answers">
      {!feedback ? <p class="answer__hint">{t('image.tapHint')}</p> : null}
      <div
        class={`image-hotspot${feedback ? '' : ' image-hotspot--live'}`}
        onClick={tap}
        role="group"
        aria-label={t('image.tapLabel')}
      >
        {image ? (
          <img class="image-figure image-figure--tap" src={image.src} alt={image.alt} />
        ) : null}
        {feedback && right
          ? circle(right.x, right.y, right.r, 'image-spot--right', right.label)
          : null}
        {point
          ? circle(
              point.x,
              point.y,
              2.5,
              feedback && !grade?.correct ? 'image-spot--wrong' : 'image-spot--tap',
            )
          : null}
      </div>
      {!feedback ? (
        <ul class="image-choices" aria-label={t('image.keyboardLabel')}>
          {question.hotspots.map((h, i) => (
            <li key={i}>
              <button
                type="button"
                class="visually-hidden"
                onClick={() =>
                  onRespond({ type: 'image', choice: -1, point: { x: h.x, y: h.y, aspect: 1 } })
                }
              >
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="image-caption">{t('image.rightSpot', { label: right?.label ?? '' })}</p>
      )}
    </div>
  );
}
