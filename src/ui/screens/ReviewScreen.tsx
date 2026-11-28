import { useEffect, useState } from 'preact/hooks';
import type { Question } from '../../core/content/types.ts';
import { DECISIONS, type Decision, type ReviewDecision } from '../../core/review/decisions.ts';
import { answerKey, distractors } from '../answerKey.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { Chip } from '../components/library/Chip.tsx';
import { MathText } from '../components/MathText.tsx';
import { exportDecisions, loadDecisions, loadDrafts, saveDecisions } from '../review.ts';
import { href } from '../router.ts';
import { useServices } from '../services.ts';
import { t } from '../strings.ts';
import './screens.css';

type Filter = 'open' | 'all';

/** Draft review (SPEC 16.4 path B): approve, ask for an edit or reject; export for apply-decisions. */
export function ReviewScreen() {
  const services = useServices();
  const [drafts, setDrafts] = useState<Question[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [filter, setFilter] = useState<Filter>('open');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadDrafts(services), loadDecisions(services)]).then(
      ([d, dec]) => {
        if (!alive) return;
        setDrafts(d.sort((a, b) => (a.pack + a.topic + a.id < b.pack + b.topic + b.id ? -1 : 1)));
        setDecisions(dec);
      },
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [services]);

  const decide = (id: string, decision: Decision | null, note?: string) => {
    const next = { ...decisions };
    if (decision === null) delete next[id];
    else {
      const n = note?.trim();
      next[id] = { questionId: id, decision, ts: services.clock.now(), ...(n ? { note: n } : {}) };
    }
    setDecisions(next);
    void saveDecisions(services, next);
  };

  const doExport = async () => {
    const result = await exportDecisions(services, decisions);
    setMessage(result === 'cancelled' ? null : t('review.exported'));
  };

  const clear = async () => {
    if (!window.confirm(t('review.clearConfirm'))) return;
    setDecisions({});
    await saveDecisions(services, {});
    setMessage(null);
  };

  const count = Object.keys(decisions).length;
  const shown = (drafts ?? []).filter((q) => filter === 'all' || !decisions[q.id]);

  return (
    <main class="screen review">
      <a class="back-link" href={href('settings')}>
        {t('review.back')}
      </a>
      <h1 class="screen__title">{t('review.title')}</h1>
      <p class="screen__muted">{t('review.body')}</p>
      {failed ? <p class="session__error">{t('review.offline')}</p> : null}
      {drafts === null && !failed ? <p class="screen__muted">{t('common.loading')}</p> : null}
      {drafts !== null ? (
        <>
          <div class="review__bar">
            <p class="review__count">
              {t('review.counts', { decided: count, total: drafts.length })}
            </p>
            <div class="chips" role="group" aria-label={t('review.filter')}>
              <Chip pressed={filter === 'open'} onClick={() => setFilter('open')}>
                {t('review.filterOpen')}
              </Chip>
              <Chip pressed={filter === 'all'} onClick={() => setFilter('all')}>
                {t('review.filterAll')}
              </Chip>
            </div>
            <div class="review__actions">
              <Button onClick={() => void doExport()} disabled={count === 0}>
                {t('review.export')}
              </Button>
              <Button variant="text" onClick={() => void clear()} disabled={count === 0}>
                {t('review.clear')}
              </Button>
            </div>
            {message ? (
              <p class="screen__muted" role="status">
                {message}
              </p>
            ) : null}
          </div>
          {shown.length === 0 ? (
            <p class="screen__muted">
              {drafts.length === 0 ? t('review.none') : t('review.allDecided')}
            </p>
          ) : null}
          {shown.map((q) => (
            <DraftCard key={q.id} question={q} decision={decisions[q.id]} onDecide={decide} />
          ))}
        </>
      ) : null}
    </main>
  );
}

function DraftCard({
  question: q,
  decision,
  onDecide,
}: {
  question: Question;
  decision: ReviewDecision | undefined;
  onDecide: (id: string, d: Decision | null, note?: string) => void;
}) {
  const [note, setNote] = useState(decision?.note ?? '');
  const [noteError, setNoteError] = useState(false);
  const image = q.media?.[0];
  const others = distractors(q);

  const choose = (d: Decision) => {
    if (decision?.decision === d) return onDecide(q.id, null);
    if (d === 'edit' && note.trim() === '') return setNoteError(true);
    setNoteError(false);
    onDecide(q.id, d, note);
  };

  return (
    <Card class={`review-card${decision ? ` review-card--${decision.decision}` : ''}`}>
      <p class="review-card__meta">
        {q.id} · {t(`review.type.${q.type}`)} · {t(`tier.${q.tier}`)}
      </p>
      <h2 class="review-card__prompt">
        <MathText text={q.prompt} />
      </h2>
      {image ? <img class="image-figure" src={image.src} alt={image.alt} /> : null}
      <p class="review-card__label">{t('review.answer')}</p>
      <ul class="review-card__list review-card__list--key">
        {answerKey(q).map((line, i) => (
          <li key={i}>
            <MathText text={line} />
          </li>
        ))}
      </ul>
      {others.length > 0 ? (
        <>
          <p class="review-card__label">{t('review.others')}</p>
          <ul class="review-card__list">
            {others.map((line, i) => (
              <li key={i}>
                <MathText text={line} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p class="review-card__label">{t('session.why')}</p>
      <p class="review-card__text">
        <MathText text={q.explanation} />
      </p>
      <p class="review-card__source">{q.sources.map((s) => s.citation).join(' · ')}</p>
      <label class="tools__label" for={`note-${q.id}`}>
        {t('review.note')}
      </label>
      <textarea
        id={`note-${q.id}`}
        class="tools__text"
        rows={2}
        value={note}
        onInput={(e) => setNote((e.currentTarget as HTMLTextAreaElement).value)}
      />
      {noteError ? (
        <p class="session__error" role="alert">
          {t('review.noteNeeded')}
        </p>
      ) : null}
      <div class="chips" role="group" aria-label={t('review.decision')}>
        {DECISIONS.map((d) => (
          <Chip key={d} pressed={decision?.decision === d} onClick={() => choose(d)}>
            {t(`review.decision.${d}`)}
          </Chip>
        ))}
      </div>
    </Card>
  );
}
