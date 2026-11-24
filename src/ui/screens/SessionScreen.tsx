import { useEffect, useRef, useState } from 'preact/hooks';
import type { McqQuestion } from '../../core/content/types.ts';
import { daysBetween } from '../../core/scheduler/day.ts';
import type { SessionState } from '../../core/session/reducer.ts';
import { sessionScore } from '../../core/session/reducer.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { Icon } from '../components/Icon.tsx';
import { MathText } from '../components/MathText.tsx';
import { OptionButton, type OptionState } from '../components/OptionButton.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import type { LearningData } from '../learning.ts';
import { navigate } from '../router.ts';
import { useServices } from '../services.ts';
import { t } from '../strings.ts';
import { useLearning } from '../useLearning.ts';
import { useSession } from '../useSession.ts';
import './screens.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

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
  const { state, question } = session;
  const total = state.items.length;

  if (state.phase === 'done' || !question) {
    const score = sessionScore(state);
    return (
      <main class="screen session-done">
        <h1 class="screen__title">
          {state.mode === 'scheduled' ? t('session.doneTitleToday') : t('session.doneTitle')}
        </h1>
        <p class="session-done__score">
          {t('session.doneScore', { correct: score.correct, total: score.answered })}
        </p>
        <p class="screen__muted">{t('session.doneBody')}</p>
        <div class="session__footer">
          <Button onClick={() => navigate('today')}>{t('session.backToToday')}</Button>
        </div>
      </main>
    );
  }

  const item = state.items[state.index];
  const position = state.index + 1;
  const feedback = state.phase === 'feedback';
  const chosen = feedback ? state.answers[state.answers.length - 1]?.chosenDisplayIndex : undefined;
  const answeredAt = feedback ? state.answers[state.answers.length - 1]?.answeredAt : undefined;

  let consequence: string | null = null;
  if (feedback && state.mode === 'extra') {
    consequence = t('session.practiceOnly');
  } else if (feedback && session.nextDue !== null && answeredAt !== undefined) {
    const n = daysBetween(answeredAt, session.nextDue, clock.utcOffsetMinutes(answeredAt));
    consequence =
      n <= 0
        ? t('session.nextToday')
        : n === 1
          ? t('session.nextTomorrow')
          : t('session.nextDays', { n });
  }

  return (
    <main class="session">
      <header class="session__top">
        <button
          type="button"
          class="session__close"
          aria-label={t('session.close')}
          onClick={() => navigate('today')}
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

      {feedback ? (
        <ResultHeader correct={session.lastAnswerCorrect === true} consequence={consequence} />
      ) : null}

      <h1 class="session__prompt">
        <MathText text={question.prompt} />
      </h1>

      <div class="session__answers" role="group" aria-label={t('session.optionsLabel')}>
        {item?.displayOrder.map((original, displayIndex) => {
          const option = question.options[original];
          if (!option) return null;
          const isAnswer = original === question.answer;
          let optionState: OptionState = 'default';
          let tag: string | undefined;
          if (!feedback) {
            if (state.selected === displayIndex) optionState = 'selected';
          } else if (isAnswer) {
            optionState = 'correct';
            tag = t('session.labelCorrect');
          } else if (displayIndex === chosen) {
            optionState = 'wrong';
            tag = t('session.labelYours');
          } else {
            optionState = 'dimmed';
          }
          return (
            <OptionButton
              key={original}
              letter={LETTERS[displayIndex] ?? ''}
              text={option.text}
              state={optionState}
              {...(tag ? { tag } : {})}
              {...(feedback && displayIndex === chosen && option.why_wrong
                ? { note: option.why_wrong }
                : {})}
              locked={feedback}
              onSelect={() => session.select(displayIndex)}
            />
          );
        })}
      </div>

      {feedback ? <WhyCard question={question} /> : null}
      {session.saveFailed ? (
        <p class="session__error" role="alert">
          {t('common.saveError')}
        </p>
      ) : null}

      <div class="session__footer">
        {feedback ? (
          <>
            <Button onClick={() => session.next()} disabled={session.busy}>
              {position === total ? t('session.finish') : t('session.continue')}
            </Button>
            {state.mode === 'scheduled' && session.lastAnswerCorrect ? (
              <div class="session__secondary">
                <Button variant="text" onClick={() => session.next(true)} disabled={session.busy}>
                  {t('session.tooEasy')}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <Button onClick={session.check} disabled={state.selected === null}>
            {t('session.check')}
          </Button>
        )}
      </div>
    </main>
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

function WhyCard({ question }: { question: McqQuestion }) {
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
