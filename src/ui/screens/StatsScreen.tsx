import { useMemo, useState } from 'preact/hooks';
import { activity } from '../../core/analytics/activity.ts';
import { buildStats, sortTopics, type TopicSort } from '../../core/analytics/stats.ts';
import { weakSpots } from '../../core/analytics/weakSpots.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { Icon } from '../components/Icon.tsx';
import { MathText } from '../components/MathText.tsx';
import { Chip } from '../components/library/Chip.tsx';
import { Heatmap } from '../components/stats/Heatmap.tsx';
import { StatBar } from '../components/stats/StatBar.tsx';
import { type LearningData, startDrillSession } from '../learning.ts';
import { href, navigate } from '../router.ts';
import { useServices } from '../services.ts';
import { t } from '../strings.ts';
import { useLearning } from '../useLearning.ts';
import './screens.css';

const pct = (x: number): number => Math.round(x * 100);

export function StatsScreen() {
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
  } else if (learning.value.data.events.length === 0) {
    body = (
      <Card>
        <p class="screen__muted">{t('stats.empty')}</p>
        <a class="button button--secondary" href={href('today')}>
          {t('stats.goToday')}
        </a>
      </Card>
    );
  } else {
    body = <StatsBody data={learning.value.data} />;
  }
  return (
    <main class="screen stats">
      <p class="screen__overline">{t('stats.overline')}</p>
      <h1 class="screen__title">{t('stats.title')}</h1>
      {body}
    </main>
  );
}

function StatsBody({ data }: { data: LearningData }) {
  const services = useServices();
  const { clock } = services;
  const [sort, setSort] = useState<TopicSort>('retention');
  const [busy, setBusy] = useState(false);

  const view = useMemo(() => {
    const now = clock.now();
    const stats = buildStats({
      index: data.index,
      cards: data.cards,
      scheduler: data.scheduler,
      now,
      desiredRetention: data.settings.desiredRetention,
    });
    return {
      stats,
      activity: activity(data.events, now, clock.utcOffsetMinutes(now)),
      weak: weakSpots({
        questions: data.questions,
        cards: data.cards,
        events: data.events,
        scheduler: data.scheduler,
        now,
      }),
    };
  }, [clock, data]);

  const { stats, weak } = view;
  const act = view.activity;
  const topics = sortTopics(stats.topics, sort);
  const notStarted = stats.topics.length - topics.length;
  const topicById = new Map(stats.topics.map((x) => [x.id, x]));

  const drill = async () => {
    if (busy || weak.length === 0) return;
    setBusy(true);
    try {
      await startDrillSession(
        services,
        data,
        weak.map((w) => w.questionId),
      );
      navigate('session');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="stats__columns">
      <div class="stats__col stats__col--main">
        <section class="stats__hero" aria-label={t('stats.retention')}>
          <p class="stats__big">
            {stats.overall.retention === null
              ? t('stats.retentionNone')
              : `${pct(stats.overall.retention)}%`}
          </p>
          <p class="stats__big-label">{t('stats.retention')}</p>
          <p class="screen__muted stats__hint">{t('stats.retentionHint')}</p>
        </section>

        <dl class="stats__tiles">
          <div class="stats__tile">
            <dt>{t('stats.coverage')}</dt>
            <dd class="stats__tile-value">
              {t('stats.coverageValue', { percent: pct(stats.overall.coverage) })}
            </dd>
            <dd class="stats__tile-detail">
              {t('stats.coverageDetail', {
                started: stats.overall.started,
                verified: stats.overall.verified,
              })}
            </dd>
          </div>
          <div class="stats__tile">
            <dt>{t('stats.streak')}</dt>
            <dd class="stats__tile-value">{t('stats.streakValue', { days: act.currentStreak })}</dd>
            <dd class="stats__tile-detail">
              {t('stats.streakDetail', { days: act.longestStreak })}
            </dd>
          </div>
          <div class="stats__tile">
            <dt>{t('stats.answers')}</dt>
            <dd class="stats__tile-value">{t('stats.answersValue', { today: act.today })}</dd>
            <dd class="stats__tile-detail">{t('stats.answersDetail', { total: act.total })}</dd>
          </div>
        </dl>

        <section class="stats__section" aria-labelledby="stats-topics">
          <h2 class="shelf__title" id="stats-topics">
            {t('stats.topics')}
          </h2>
          <div class="chips" role="group" aria-label={t('stats.sortLabel')}>
            <Chip pressed={sort === 'retention'} onClick={() => setSort('retention')}>
              {t('stats.sortRetention')}
            </Chip>
            <Chip pressed={sort === 'coverage'} onClick={() => setSort('coverage')}>
              {t('stats.sortCoverage')}
            </Chip>
          </div>
          {topics.length === 0 ? (
            <p class="screen__muted">{t('stats.noTopics')}</p>
          ) : (
            <ul class="stat-list">
              {topics.map((x) => {
                const shown = sort === 'retention' ? (x.retention ?? 0) : x.coverage;
                const detail = t('stats.topicCoverage', {
                  started: x.started,
                  verified: x.verified,
                });
                return (
                  <StatBar
                    key={x.id}
                    label={x.label}
                    caption={x.subjectLabel}
                    value={shown}
                    valueText={t('stats.topicValue', { percent: pct(shown) })}
                    detail={detail}
                    weak={x.weak}
                    href={href('library', x.subjectId, x.branchId)}
                    ariaLabel={t('stats.topicLabel', {
                      topic: x.label,
                      percent: pct(x.retention ?? 0),
                      started: x.started,
                      verified: x.verified,
                    })}
                  />
                );
              })}
            </ul>
          )}
          {notStarted > 0 ? (
            <p class="today__caption stats__left">{t('stats.notStarted', { n: notStarted })}</p>
          ) : null}
        </section>
      </div>
      <div class="stats__col stats__col--side">
        <section class="stats__section" aria-labelledby="stats-weak">
          <h2 class="shelf__title" id="stats-weak">
            {t('stats.weak')}
          </h2>
          {weak.length === 0 ? (
            <p class="screen__muted">{t('stats.weakNone')}</p>
          ) : (
            <>
              <ul class="weak-list">
                {weak.map((w) => {
                  const q = data.questions.get(w.questionId);
                  const tp = topicById.get(w.topic);
                  const reasons = [
                    w.misses > 0 ? t('stats.weakMissed', { n: w.misses }) : null,
                    w.leech ? t('stats.weakLeech') : null,
                    w.retrievability < 0.8
                      ? t('stats.weakFading', { percent: pct(w.retrievability) })
                      : null,
                    w.confidentErrors > 0
                      ? t('stats.weakConfident', { n: w.confidentErrors })
                      : null,
                  ].filter((r): r is string => r !== null);
                  return (
                    <li key={w.questionId}>
                      <a
                        class="weak-item"
                        href={tp ? href('library', tp.subjectId, tp.branchId) : href('library')}
                      >
                        <span class="weak-item__prompt">
                          <MathText text={q?.prompt ?? w.questionId} />
                        </span>
                        <span class="weak-item__meta">
                          {[tp?.label, ...reasons].filter(Boolean).join(' · ')}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
              <Button variant="secondary" onClick={drill} disabled={busy}>
                {t('stats.drill')}
              </Button>
              <p class="today__caption">{t('stats.drillCaption')}</p>
            </>
          )}
        </section>

        <section class="stats__section" aria-labelledby="stats-activity">
          <h2 class="shelf__title" id="stats-activity">
            {t('stats.activity')}
          </h2>
          <Heatmap days={act.days} />
        </section>

        <a class="quiet-row" href={href('stats', 'rewards')}>
          <span class="quiet-row__text">
            <span>{t('stats.rewards')}</span>
            <span class="quiet-row__hint">{t('stats.rewardsHint')}</span>
          </span>
          <Icon name="chevron" size={20} />
        </a>
      </div>
    </div>
  );
}

export function RewardsScreen() {
  return (
    <main class="screen">
      <a class="back-link" href={href('stats')}>
        <Icon name="back" size={20} />
        {t('rewards.back')}
      </a>
      <h1 class="screen__title">{t('rewards.title')}</h1>
      <p class="screen__muted">{t('rewards.body')}</p>
    </main>
  );
}
