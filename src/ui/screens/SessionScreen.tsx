import { useEffect, useRef, useState } from 'preact/hooks';
import type { McqQuestion } from '../../core/content/types.ts';
import type { SessionState } from '../../core/session/reducer.ts';
import { sessionScore } from '../../core/session/reducer.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { Icon } from '../components/Icon.tsx';
import { MathText } from '../components/MathText.tsx';
import { OptionButton, type OptionState } from '../components/OptionButton.tsx';
import { ProgressBar } from '../components/ProgressBar.tsx';
import { navigate } from '../router.ts';
import { useServices } from '../services.ts';
import { discardSession } from '../sessionStore.ts';
import { t } from '../strings.ts';
import { useEligibleQuestions } from '../useContent.ts';
import { openSession, useSession } from '../useSession.ts';
import './screens.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function SessionScreen() {
  const services = useServices();
  const questions = useEligibleQuestions();
  const [initial, setInitial] = useState<SessionState | null>(null);

  useEffect(() => {
    if (questions.status !== 'ready' || initial) return;
    openSession(services, questions.value).then(setInitial, () => setInitial(null));
  }, [questions, initial, services]);

  if (questions.status === 'error') {
    return (
      <main class="screen">
        <p class="screen__muted">{t('common.loadError')}</p>
        <Button variant="secondary" onClick={questions.retry}>
          {t('common.retry')}
        </Button>
      </main>
    );
  }
  if (questions.status !== 'ready' || !initial) {
    return (
      <main class="screen">
        <p class="screen__muted" aria-live="polite">
          {t('common.loading')}
        </p>
      </main>
    );
  }
  return <Session initial={initial} questions={questions.value} />;
}

function Session({
  initial,
  questions,
}: {
  initial: SessionState;
  questions: ReadonlyMap<string, McqQuestion>;
}) {
  const { storage } = useServices();
  const session = useSession(initial, questions);
  const { state, question } = session;
  const total = state.items.length;

  if (state.phase === 'done' || !question) {
    const score = sessionScore(state);
    const finish = async () => {
      await discardSession(storage);
      navigate('today');
    };
    return (
      <main class="screen session-done">
        <h1 class="screen__title">{t('session.doneTitle')}</h1>
        <p class="session-done__score">
          {t('session.doneScore', { correct: score.correct, total: score.answered })}
        </p>
        <p class="screen__muted">{t('session.doneBody')}</p>
        <div class="session__footer">
          <Button onClick={finish}>{t('session.backToToday')}</Button>
        </div>
      </main>
    );
  }

  const item = state.items[state.index];
  const position = state.index + 1;
  const feedback = state.phase === 'feedback';
  const chosen = feedback ? state.answers[state.answers.length - 1]?.chosenDisplayIndex : undefined;

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

      {feedback ? <ResultHeader correct={session.lastAnswerCorrect === true} /> : null}

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
          <Button onClick={session.next}>
            {position === total ? t('session.finish') : t('session.continue')}
          </Button>
        ) : (
          <Button onClick={session.check} disabled={state.selected === null}>
            {t('session.check')}
          </Button>
        )}
      </div>
    </main>
  );
}

function ResultHeader({ correct }: { correct: boolean }) {
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
      <span class="result__title">{correct ? t('session.correct') : t('session.notQuite')}</span>
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
