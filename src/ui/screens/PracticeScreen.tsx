import { useMemo, useState } from 'preact/hooks';
import { TIERS, type Tier } from '../../core/content/types.ts';
import { findIndexNode, locateNode, questionIdsFor } from '../../core/library/drillScope.ts';
import type { LibrarySubject } from '../../core/library/library.ts';
import {
  confusableCount,
  DRILL_SIZES,
  dueToday,
  topicMatches,
  weakSpotDrill,
  type DrillSize,
  type TopicFilter,
} from '../../core/session/drill.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { Chip } from '../components/library/Chip.tsx';
import {
  drillInput,
  saveSettings,
  startDrill,
  type DrillRequest,
  type LearningData,
} from '../learning.ts';
import { href, navigate } from '../router.ts';
import { useServices } from '../services.ts';
import { t } from '../strings.ts';
import { useLearning } from '../useLearning.ts';
import { useLibrary } from './LibraryScreen.tsx';
import './screens.css';

/** Weak-spot topics named in the summary line. */
const WEAK_TOPICS_SHOWN = 2;

/** Practice (SPEC 8.2 to 8.4): weak-spot mode, confusable pairs and topic drills. */
export function PracticeScreen({ target }: { target?: string }) {
  const learning = useLearning();
  let body;
  if (learning.status === 'loading') {
    body = (
      <p class="screen__muted" aria-live="polite">
        {t('common.loading')}
      </p>
    );
  } else if (learning.status === 'error') {
    body = (
      <Card>
        <p class="screen__muted">{t('common.loadError')}</p>
        <Button variant="secondary" onClick={learning.retry}>
          {t('common.retry')}
        </Button>
      </Card>
    );
  } else {
    body = <PracticeBody data={learning.value.data} {...(target ? { target } : {})} key={target} />;
  }
  return (
    <main class="screen practice">
      <p class="screen__overline">{t('practice.overline')}</p>
      <h1 class="screen__title">{t('practice.title')}</h1>
      {body}
    </main>
  );
}

function PracticeBody({ data, target }: { data: LearningData; target?: string }) {
  const services = useServices();
  const library = useLibrary(data);
  const [size, setSize] = useState<DrillSize>(data.settings.drillSize);
  const [busy, setBusy] = useState(false);

  const subjects = library.subjects.filter((s) => s.active && s.verified > 0);
  const inactive = library.subjects.filter((s) => !s.active && s.verified > 0);

  // Weak spots and pairs, counted over everything that can be drilled.
  const weak = useMemo(() => weakSpotDrill(drillInput(services, data, 'all')), [services, data]);
  const pairs = useMemo(() => confusableCount(data.questions), [data]);
  const weakTopics = [...new Set(weak.map((w) => data.questions.get(w.questionId)?.topic ?? ''))]
    .filter(Boolean)
    .slice(0, WEAK_TOPICS_SHOWN)
    .map((id) => findIndexNode(data.index.tree, id)?.label ?? id);

  const chooseSize = (next: DrillSize) => {
    setSize(next);
    void saveSettings(services, { drillSize: next });
  };

  const start = async (request: DrillRequest) => {
    if (busy) return;
    setBusy(true);
    try {
      // The chosen length applies even if the settings write is still pending.
      await startDrill(
        services,
        { ...data, settings: { ...data.settings, drillSize: size } },
        request,
      );
      navigate('session');
    } finally {
      setBusy(false);
    }
  };

  if (subjects.length === 0) {
    return (
      <Card>
        <p class="screen__muted">{t('practice.noSubjects')}</p>
        <a class="button button--secondary" href={href('library')}>
          {t('practice.openLibrary')}
        </a>
      </Card>
    );
  }

  return (
    <>
      <div class="practice__intro">
        <div class="chips" role="group" aria-label={t('practice.sizeLabel')}>
          <span class="practice__label">{t('practice.sizeLabel')}</span>
          {DRILL_SIZES.map((s) => (
            <Chip key={String(s)} pressed={size === s} onClick={() => chooseSize(s)}>
              {s === 'all' ? t('practice.sizeAll') : String(s)}
            </Chip>
          ))}
        </div>
        <p class="today__caption practice__caption">{t('practice.caption')}</p>
        {data.unavailable.length > 0 ? <p class="screen__muted">{t('practice.offline')}</p> : null}
      </div>

      <div class="practice__columns">
        <div class="practice__col">
          <Card class="practice__card">
            <h2 class="screen__subtitle">{t('practice.weakTitle')}</h2>
            <p class="screen__muted">
              {weak.length === 0
                ? t('practice.weakNone')
                : weak.length === 1
                  ? t('practice.weakBodyOne', { topics: weakTopics.join(' and ') })
                  : t('practice.weakBody', { n: weak.length, topics: weakTopics.join(' and ') })}
            </p>
            {weak.length > 0 ? (
              <Button onClick={() => start({ kind: 'weak' })} disabled={busy}>
                {t('practice.weakStart')}
              </Button>
            ) : null}
          </Card>

          <Card class="practice__card">
            <h2 class="screen__subtitle">{t('practice.pairsTitle')}</h2>
            <p class="screen__muted">
              {pairs.questions === 0
                ? t('practice.pairsNone')
                : t('practice.pairsBody', { pairs: pairs.pairs, questions: pairs.questions })}
            </p>
            {pairs.questions > 0 ? (
              <Button
                variant="secondary"
                onClick={() => start({ kind: 'confusable' })}
                disabled={busy}
              >
                {t('practice.pairsStart')}
              </Button>
            ) : null}
          </Card>
        </div>

        <div class="practice__col">
          <TopicDrill
            data={data}
            subjects={subjects}
            target={target}
            busy={busy}
            onStart={(filter) => start({ kind: 'topic', filter })}
          />
          {inactive.length > 0 ? (
            <p class="screen__muted practice__inactive">
              {t('practice.inactive', { subjects: inactive.map((s) => s.label).join(', ') })}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

function TopicDrill({
  data,
  subjects,
  target,
  busy,
  onStart,
}: {
  data: LearningData;
  subjects: readonly LibrarySubject[];
  target: string | undefined;
  busy: boolean;
  onStart: (filter: TopicFilter) => void;
}) {
  const services = useServices();
  const library = useLibrary(data);
  // A Library "Drill" link pre-fills the subject and the branch or topic.
  const initial = target ? locateNode(library, target) : undefined;
  const initialSubject = subjects.find((s) => s.id === initial?.subject.id) ?? subjects[0];
  const [subjectId, setSubjectId] = useState(initialSubject?.id ?? '');
  const [nodeId, setNodeId] = useState(
    initialSubject && initial?.subject.id === initialSubject.id ? (initial.node?.id ?? '') : '',
  );
  const [tier, setTier] = useState<Tier | undefined>(undefined);
  const [tag, setTag] = useState('');

  const subject = subjects.find((s) => s.id === subjectId) ?? subjects[0];
  const scopeId = nodeId || subject?.id || '';
  const scope = useMemo(() => new Set(questionIdsFor(data.index.tree, scopeId)), [data, scopeId]);
  const inScope = useMemo(() => topicMatches(data.questions, { scope }), [data, scope]);
  const tags = useMemo(
    () => [...new Set(inScope.flatMap((q) => q.tags ?? []))].sort((a, b) => a.localeCompare(b)),
    [inScope],
  );
  const filter: TopicFilter = {
    scope,
    ...(tier ? { tier } : {}),
    ...(tag && tags.includes(tag) ? { tag } : {}),
  };
  const matches = topicMatches(data.questions, filter);
  const now = services.clock.now();
  const offset = services.clock.utcOffsetMinutes(now);
  const due = matches.filter((q) => dueToday(data.cards, q.id, now, offset)).length;

  const pickSubject = (id: string) => {
    setSubjectId(id);
    setNodeId('');
    setTag('');
  };

  return (
    <Card class="practice__card">
      <h2 class="screen__subtitle">{t('practice.topicTitle')}</h2>

      {subjects.length > 1 ? (
        <div class="chips" role="group" aria-label={t('practice.subject')}>
          {subjects.map((s) => (
            <Chip key={s.id} pressed={s.id === subject?.id} onClick={() => pickSubject(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      ) : null}

      <label class="practice__field">
        <span class="practice__label">{t('practice.scope')}</span>
        <select
          class="practice__select"
          value={nodeId}
          onChange={(e) => {
            setNodeId((e.currentTarget as HTMLSelectElement).value);
            setTag('');
          }}
        >
          <option value="">{t('practice.wholeSubject')}</option>
          {subject?.children
            .filter((b) => b.verified > 0)
            .map((b) =>
              b.children.length > 0 ? (
                <optgroup key={b.id} label={b.label}>
                  <option value={b.id}>{t('practice.wholeBranch', { branch: b.label })}</option>
                  {b.children
                    .filter((c) => c.verified > 0)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                </optgroup>
              ) : (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ),
            )}
        </select>
      </label>

      <div class="chips" role="group" aria-label={t('practice.tier')}>
        <Chip pressed={!tier} onClick={() => setTier(undefined)}>
          {t('practice.tierAll')}
        </Chip>
        {TIERS.map((x) => (
          <Chip key={x} pressed={tier === x} onClick={() => setTier(x)}>
            {t(`tier.${x}`)}
          </Chip>
        ))}
      </div>

      {tags.length > 0 ? (
        <label class="practice__field">
          <span class="practice__label">{t('practice.tag')}</span>
          <select
            class="practice__select"
            value={tags.includes(tag) ? tag : ''}
            onChange={(e) => setTag((e.currentTarget as HTMLSelectElement).value)}
          >
            <option value="">{t('practice.tagAny')}</option>
            {tags.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <p class="screen__muted" aria-live="polite">
        {matches.length === 0
          ? t('practice.matchesNone')
          : t('practice.matches', { n: matches.length, due })}
      </p>
      <Button onClick={() => onStart(filter)} disabled={busy || matches.length === 0}>
        {t('practice.topicStart')}
      </Button>
    </Card>
  );
}
