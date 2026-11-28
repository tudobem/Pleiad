import { useEffect, useRef, useState } from 'preact/hooks';
import type { Question } from '../../core/content/types.ts';
import type { Rating } from '../../core/sync/reviewEvent.ts';
import { daysBetween } from '../../core/scheduler/day.ts';
import type { SessionState } from '../../core/session/reducer.ts';
import { CONFIDENCE_TYPES, itemMode, sessionScore } from '../../core/session/reducer.ts';
import type { Response } from '../../core/session/response.ts';
import { sessionXp } from '../../core/gamification/rewards.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { Icon } from '../components/Icon.tsx';
import { MathText } from '../components/MathText.tsx';
import { AnswerArea } from '../components/answers/AnswerArea.tsx';
import { ConfidenceChips } from '../components/answers/ConfidenceChips.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { savePlacement, type LearningData } from '../learning.ts';
import { PLACEMENT_LENGTH } from '../../core/session/placement.ts';
import type { Tier } from '../../core/content/types.ts';
import { navigate, navigateHash } from '../router.ts';
import { useServices } from '../services.ts';
import { t, type StringId } from '../strings.ts';
import { useLearning } from '../useLearning.ts';
import { useSession } from '../useSession.ts';
import { useSessionKeys } from '../useSessionKeys.ts';
import './screens.css';

export function SessionScreen() {
  const learning = useLearning();
  const missing = learning.status === 'ready' && !learning.value.saved;

  useEffect(() => {
    // Sessions are started from Today; without a saved one there is nothing to show.
    if (missing) navigate('today');
  }, [missing]);

  if (learning.status === 'error') {
    return (
      <main class="screen">
        <p class="screen__muted">{t('common.loadError')}</p>
        <Button variant="secondary" onClick={learning.retry}>
          {t('common.retry')}
        </Button>
      </main>
    );
  }
  if (learning.status !== 'ready' || !learning.value.saved) {
    return (
      <main class="screen">
        <p class="screen__muted" aria-live="polite">
          {t('common.loading')}
        </p>
      </main>
    );
  }
  return <Session initial={learning.value.saved} data={learning.value.data} />;
}

function Session({ initial, data }: { initial: SessionState; data: LearningData }) {
  const { clock } = useServices();
  const session = useSession(initial, data);
  // Answers logged from here on belong to this session (for the XP line).
  const [eventsAtStart] = useState(() => data.events.length);
  const { state, question, item, response, pending } = session;
  // Chips show on MCQ and short items before answering (SPEC 9).
  const asksConfidence =
    !!question &&
    data.settings.confidencePrompts &&
    state.phase === 'question' &&
    CONFIDENCE_TYPES.includes(question.type as Response['type']) &&
    !(question.type === 'image' && question.mode === 'hotspot');
  useSessionKeys({ ...session, asksConfidence });
  const total = state.placement
    ? Math.max(PLACEMENT_LENGTH, state.items.length)
    : state.items.length;
  const leave = () =>
    state.placement?.returnTo ? navigateHash(state.placement.returnTo) : navigate('today');

  if (state.placement && (state.phase === 'done' || !question || !item || !response)) {
    return <PlacementDone state={state} data={data} onLeave={leave} />;
  }

  if (state.phase === 'done' || !question || !item || !response) {
    const score = sessionScore(state);
    return (
      <main class="screen session-done">
        <h1 class="screen__title">
          {state.mode === 'scheduled' ? t('session.doneTitleToday') : t('session.doneTitle')}
        </h1>
        <p class="session-done__score">
          {t('session.doneScore', { correct: score.correct, total: score.answered })}
        </p>
        {data.settings.rewards ? (
          <p class="session-done__xp">
            {t('session.doneXp', {
              xp: sessionXp(
                data.events,
                new Set(data.events.slice(eventsAtStart).map((e) => e.eventId)),
                data.index,
              ),
            })}
          </p>
        ) : null}
        <p class="screen__muted">{t('session.doneBody')}</p>
        <div class="session__footer">
          <Button onClick={() => navigate('today')}>{t('session.backToToday')}</Button>
        </div>
      </main>
    );
  }

  const position = state.index + 1;
  const feedback = state.phase === 'feedback' && !!pending;
  const recall = question.type === 'recall';
  const mode = itemMode(state);
  const offset = (at: number) => clock.utcOffsetMinutes(at);
  const daysUntil = (due: number | null): number | null =>
    pending && due !== null
      ? daysBetween(pending.answeredAt, due, offset(pending.answeredAt))
      : null;

  let consequence: string | null = null;
  if (feedback && !recall) {
    if (state.placement) {
      consequence = t('session.placementOnly');
    } else if (mode === 'extra') {
      consequence = t('session.practiceOnly');
    } else {
      const n = daysUntil(session.nextDue());
      if (n !== null) {
        consequence =
          n <= 0
            ? t('session.nextToday')
            : n === 1
              ? t('session.nextTomorrow')
              : t('session.nextDays', { n });
      }
    }
  }

  return (
    <main class="session">
      <div class="session__main">
        <header class="session__top">
          <button
            type="button"
            class="session__close"
            aria-label={t('session.close')}
            onClick={leave}
          >
            <Icon name="close" />
          </button>
          <ProgressBar
            value={(state.index + (feedback ? 1 : 0)) / total}
            label={t('session.progressLabel', { current: position, total })}
          />
          <span class="session__count" aria-hidden="true">
            {t('session.progress', { current: position, total })}
          </span>
        </header>

        {feedback && !recall ? (
          <ResultHeader correct={pending.correct} consequence={consequence} />
        ) : null}

        <h1 class="session__prompt">
          <MathText text={question.prompt} />
        </h1>

        {asksConfidence ? (
          <ConfidenceChips value={state.confidence} onChange={session.setConfidence} />
        ) : null}
        <AnswerArea
          question={question}
          layout={item.layout}
          response={feedback ? pending.response : response}
          feedback={feedback}
          pending={pending}
          grade={session.grade}
          onRespond={session.respond}
          onSubmit={session.check}
          onOverride={session.override}
        />

        {session.saveFailed ? (
          <p class="session__error" role="alert">
            {t('common.saveError')}
          </p>
        ) : null}

        <div class="session__footer">
          {!feedback ? (
            <Button onClick={session.check} disabled={!session.canCheck}>
              {recall ? t('session.showAnswer') : t('session.check')}
            </Button>
          ) : recall ? (
            <RatingButtons
              onRate={(rating) => session.next({ rating })}
              busy={session.busy}
              daysFor={(rating) =>
                mode === 'scheduled' ? daysUntil(session.nextDue({ rating })) : null
              }
            />
          ) : (
            <>
              <Button onClick={() => session.next()} disabled={session.busy}>
                {position === total ? t('session.finish') : t('session.continue')}
              </Button>
              {mode === 'scheduled' && pending.correct ? (
                <div class="session__secondary">
                  <Button
                    variant="text"
                    onClick={() => session.next({ tooEasy: true })}
                    disabled={session.busy}
                  >
                    {t('session.tooEasy')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
          <p class="session__keys">
            {t(
              recall
                ? 'session.keysRecall'
                : question.type === 'mcq'
                  ? asksConfidence
                    ? 'session.keysMcqConfidence'
                    : 'session.keysMcq'
                  : asksConfidence
                    ? 'session.keysShortConfidence'
                    : 'session.keysOther',
            )}
          </p>
        </div>
      </div>
      <aside class="session__aside" aria-label={t('session.why')}>
        {feedback ? (
          <>
            <WhyCard question={question} />
            {pending.confidence === 'certain' && !pending.correct ? (
              <ConfidentErrorCard question={question} questions={data.questions} />
            ) : null}
          </>
        ) : (
          <p class="session__why-empty">{t('session.whyEmpty')}</p>
        )}
      </aside>
    </main>
  );
}

const RATINGS: readonly { rating: Rating; label: StringId }[] = [
  { rating: 'again', label: 'session.rateAgain' },
  { rating: 'hard', label: 'session.rateHard' },
  { rating: 'good', label: 'session.rateGood' },
  { rating: 'easy', label: 'session.rateEasy' },
];

/** Recall self-rating (SPEC 7.3), with the resulting interval in scheduled sessions. */
function RatingButtons({
  onRate,
  busy,
  daysFor,
}: {
  onRate: (rating: Rating) => void;
  busy: boolean;
  daysFor: (rating: Rating) => number | null;
}) {
  return (
    <div>
      <p class="rating__title">{t('session.rateTitle')}</p>
      <div class="rating">
        {RATINGS.map(({ rating, label }) => {
          const days = daysFor(rating);
          return (
            <button
              key={rating}
              type="button"
              class={`rating__button rating__button--${rating}`}
              disabled={busy}
              onClick={() => onRate(rating)}
            >
              {t(label)}
              {days !== null ? (
                <span class="rating__when">{t('session.inDays', { n: Math.max(days, 1) })}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultHeader({ correct, consequence }: { correct: boolean; consequence: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      class={`result result--${correct ? 'correct' : 'wrong'}`}
      role="status"
    >
      <span class="result__badge" aria-hidden="true">
        {correct ? <Icon name="check" /> : null}
      </span>
      <span class="result__text">
        <span class="result__title">{correct ? t('session.correct') : t('session.notQuite')}</span>
        {consequence ? <span class="result__consequence">{consequence}</span> : null}
      </span>
    </div>
  );
}

/** After a wrong "Certain" answer: a short prompt to reflect (SPEC 9). */
function ConfidentErrorCard({
  question,
  questions,
}: {
  question: Question;
  questions: ReadonlyMap<string, Question>;
}) {
  const confusable = (question.confusable_with ?? [])
    .map((id) => questions.get(id))
    .find((q): q is Question => q !== undefined);
  return (
    <Card class="why why--confident">
      <p class="screen__overline">{t('confidence.whyTitle')}</p>
      <p class="why__text">{t('confidence.whyBody')}</p>
      {confusable ? (
        <p class="why__source">
          {t('confidence.confusedWith')} <MathText text={confusable.prompt} />
        </p>
      ) : null}
    </Card>
  );
}

function WhyCard({ question }: { question: Question }) {
  const [open, setOpen] = useState(false);
  const deeper = question.deeper;
  return (
    <Card class="why">
      <p class="screen__overline">{t('session.why')}</p>
      <p class="why__text">
        <MathText text={question.explanation} />
      </p>
      <p class="why__source">
        <span class="visually-hidden">{t('session.source')}: </span>
        {question.sources.map((s) => s.citation).join(' · ')}
      </p>
      {deeper ? (
        <>
          <Button variant="text" onClick={() => setOpen((o) => !o)} expanded={open}>
            {open ? t('session.showLess') : t('session.goDeeper')}
          </Button>
          {open ? (
            <div class="why__deeper">
              {deeper.text ? (
                <p>
                  <MathText text={deeper.text} />
                </p>
              ) : null}
              {deeper.links?.length ? (
                <ul>
                  {deeper.links.map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {deeper.furtherReading?.length ? (
                <>
                  <p class="screen__overline">{t('session.furtherReading')}</p>
                  <ul>
                    {deeper.furtherReading.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/** End of a placement quiz: save and show the level (SPEC 13). */
function PlacementDone({
  state,
  data,
  onLeave,
}: {
  state: SessionState;
  data: LearningData;
  onLeave: () => void;
}) {
  const services = useServices();
  const [level, setLevel] = useState<Tier | null | undefined>(undefined);
  useEffect(() => {
    savePlacement(services, data, state).then(
      (l) => setLevel(l ?? null),
      () => setLevel(null),
    );
  }, [services, data, state]);
  const score = sessionScore(state);
  return (
    <main class="screen session-done">
      <p class="screen__overline">{t('placement.overline')}</p>
      <h1 class="screen__title">
        {level ? t('placement.result', { level: t(`tier.${level}`) }) : t('placement.noResult')}
      </h1>
      {score.answered > 0 ? (
        <p class="session-done__score">
          {t('session.doneScore', { correct: score.correct, total: score.answered })}
        </p>
      ) : null}
      <p class="screen__muted">
        {level ? t(`placement.meaning.${level}`) : t('placement.noResultBody')}
      </p>
      <div class="session__footer">
        <Button onClick={onLeave} disabled={level === undefined}>
          {t('placement.done')}
        </Button>
      </div>
    </main>
  );
}
