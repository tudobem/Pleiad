import { coveragePercent, type LibrarySubject } from '../../../core/library/library.ts';
import { href } from '../../router.ts';
import { t } from '../../strings.ts';
import { ProgressBar } from '../ProgressBar.tsx';
import './library.css';

/** Subject card on a shelf: title, progress, counts. Opens the subject page. */
export function SubjectCard({ subject }: { subject: LibrarySubject }) {
  const percent = coveragePercent(subject);
  return (
    <li class="shelf__item">
      <a class="subject-card" href={href('library', subject.id)}>
        <span class="subject-card__title">{subject.label}</span>
        <ProgressBar
          value={percent / 100}
          label={t('library.progressLabel', { percent })}
          accent={subject.accent}
        />
        <span class="subject-card__meta">
          {subject.verified === 0
            ? t('library.cardEmpty')
            : t('library.cardStarted', { started: subject.started, verified: subject.verified })}
        </span>
        {subject.due > 0 ? (
          <span class="subject-card__due">{t('library.cardDue', { due: subject.due })}</span>
        ) : null}
        {!subject.active ? (
          <span class="subject-card__inactive">{t('library.notInQueue')}</span>
        ) : null}
      </a>
    </li>
  );
}
