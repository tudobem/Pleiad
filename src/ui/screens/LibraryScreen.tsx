import { useMemo, useState } from 'preact/hooks';
import {
  buildLibrary,
  continueShelf,
  LIBRARY_FILTERS,
  type Library,
  type LibraryFilter,
  matchesFilter,
} from '../../core/library/library.ts';
import { searchLibrary } from '../../core/library/search.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { Icon } from '../components/Icon.tsx';
import { Chip } from '../components/library/Chip.tsx';
import { ShelfRow } from '../components/library/ShelfRow.tsx';
import { SubjectCard } from '../components/library/SubjectCard.tsx';
import type { LearningData } from '../learning.ts';
import { href } from '../router.ts';
import { useServices } from '../services.ts';
import { t, type StringId } from '../strings.ts';
import { useLearning } from '../useLearning.ts';
import './screens.css';

/** Library model for the current moment, from the index and replayed cards. */
export function useLibrary(data: LearningData): Library {
  const { clock } = useServices();
  return useMemo(() => {
    const now = clock.now();
    return buildLibrary({
      index: data.index,
      cards: data.cards,
      activePacks: data.activePacks,
      now,
      offsetMinutes: clock.utcOffsetMinutes(now),
    });
  }, [clock, data]);
}

export function LibraryScreen() {
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
    body = <LibraryBody data={learning.value.data} />;
  }
  return (
    <main class="screen library">
      <h1 class="screen__title">{t('library.title')}</h1>
      {body}
    </main>
  );
}

function LibraryBody({ data }: { data: LearningData }) {
  const library = useLibrary(data);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const results = useMemo(() => searchLibrary(data.index, query), [data.index, query]);
  const searching = query.trim() !== '';

  const keep = (s: Library['subjects'][number]) => matchesFilter(s, filter);
  const recent = continueShelf(library).filter(keep);
  const domains = library.domains
    .map((d) => ({ ...d, subjects: d.subjects.filter(keep) }))
    .filter((d) => d.subjects.length > 0);

  return (
    <>
      <label class="search">
        <span class="visually-hidden">{t('library.searchLabel')}</span>
        <Icon name="search" size={20} />
        <input
          class="search__input"
          type="search"
          placeholder={t('library.search')}
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          autocomplete="off"
          enterkeyhint="search"
        />
      </label>

      {searching ? (
        results.length === 0 ? (
          <p class="screen__muted" aria-live="polite">
            {t('library.noResults', { query: query.trim() })}
          </p>
        ) : (
          <ul class="search-results" aria-live="polite">
            {results.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <a
                  class="search-result"
                  href={href('library', r.subjectId, r.kind === 'subject' ? undefined : r.branchId)}
                >
                  <span class="search-result__label">{r.label}</span>
                  <span class="search-result__path">
                    {[...r.path, ...(r.tag ? [t('library.resultTag', { tag: r.tag })] : [])].join(
                      ' · ',
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <div class="chips" role="group" aria-label={t('library.filtersLabel')}>
            {LIBRARY_FILTERS.map((f) => (
              <Chip key={f} pressed={filter === f} onClick={() => setFilter(f)}>
                {t(`library.filter.${f}` as StringId)}
              </Chip>
            ))}
          </div>
          {recent.length > 0 ? (
            <ShelfRow title={t('library.continue')}>
              {recent.map((s) => (
                <SubjectCard key={s.id} subject={s} />
              ))}
            </ShelfRow>
          ) : null}
          {domains.map((d) => (
            <ShelfRow key={d.id} title={d.label}>
              {d.subjects.map((s) => (
                <SubjectCard key={s.id} subject={s} />
              ))}
            </ShelfRow>
          ))}
          {domains.length === 0 ? <p class="screen__muted">{t('library.noSubjects')}</p> : null}
        </>
      )}
    </>
  );
}
