import { useMemo, useState } from 'preact/hooks';
import { coveragePercent, findSubject, type LibrarySubject } from '../../core/library/library.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { Icon } from '../components/Icon.tsx';
import { TreeRow } from '../components/library/TreeRow.tsx';
import { type LearningData, setPacksActive, startSubjectSession, todayQueue } from '../learning.ts';
import { href, navigate } from '../router.ts';
import { useServices } from '../services.ts';
import { t } from '../strings.ts';
import { useLearning } from '../useLearning.ts';
import { useLibrary } from './LibraryScreen.tsx';
import './screens.css';

export function SubjectScreen({ subjectId, open }: { subjectId: string; open?: string }) {
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
    body = (
      <SubjectBody
        key={subjectId}
        data={learning.value.data}
        subjectId={subjectId}
        reload={learning.reload}
        {...(open ? { open } : {})}
      />
    );
  }
  return (
    <main class="screen subject">
      <a class="back-link" href={href('library')}>
        <Icon name="back" size={20} />
        {t('subject.back')}
      </a>
      {body}
    </main>
  );
}

function SubjectBody({
  data,
  subjectId,
  open,
  reload,
}: {
  data: LearningData;
  subjectId: string;
  open?: string;
  reload: () => void;
}) {
  const library = useLibrary(data);
  const subject = findSubject(library, subjectId);
  if (!subject) return <p class="screen__muted">{t('subject.notFound')}</p>;
  return (
    <SubjectDetail data={data} subject={subject} reload={reload} {...(open ? { open } : {})} />
  );
}

function SubjectDetail({
  data,
  subject,
  open,
  reload,
}: {
  data: LearningData;
  subject: LibrarySubject;
  open?: string;
  reload: () => void;
}) {
  const services = useServices();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(open ? [open] : []));
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  const queue = useMemo(
    () => (subject.active ? todayQueue(services, data, new Set(subject.questionIds)) : undefined),
    [services, data, subject],
  );
  const percent = coveragePercent(subject);
  const branches = subject.children.filter((c) => c.kind === 'branch').length;
  const stats =
    branches > 0
      ? t('subject.stats', { questions: subject.verified, branches, percent })
      : t('subject.statsOne', { questions: subject.verified, percent });
  const caption = !subject.active
    ? t('subject.captionActivate')
    : queue && queue.due.length + queue.fresh.length > 0
      ? t('subject.captionQueue', { due: queue.due.length, fresh: queue.fresh.length })
      : t('subject.captionExtra');

  const practice = async () => {
    if (busy) return;
    setBusy(true);
    setOffline(false);
    try {
      await startSubjectSession(services, data, subject);
      navigate('session');
    } catch {
      setOffline(true);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await setPacksActive(services, data.index, subject.packs, !subject.active);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <h1 class="screen__title">{subject.label}</h1>
      <p class="screen__muted subject__stats">{stats}</p>

      {subject.verified > 0 ? (
        <div class="subject__actions">
          <Button onClick={practice} disabled={busy}>
            {t('subject.practice', { subject: subject.label })}
          </Button>
          <p class="today__caption">{caption}</p>
          {offline ? (
            <p class="session__error" role="alert">
              {t('subject.offline')}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        class="switch"
        role="switch"
        aria-checked={subject.active}
        onClick={toggleActive}
        disabled={busy || subject.packs.length === 0}
      >
        <span class="switch__text">
          <span class="switch__label">{t('subject.active')}</span>
          <span class="switch__hint">{t('subject.activeHint')}</span>
        </span>
        <span class="switch__track" aria-hidden="true">
          <span class="switch__thumb" />
        </span>
      </button>

      <section aria-label={t('subject.branches')}>
        <ul class="tree">
          {subject.children.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              accent={subject.accent}
              open={expanded.has(node.id)}
              onToggle={() => toggle(node.id)}
            />
          ))}
        </ul>
      </section>
    </>
  );
}
