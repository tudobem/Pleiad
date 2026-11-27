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
import { ProgressBar } from '../components/ProgressBar.tsx';
import { ProgressRing } from '../components/ProgressRing.tsx';
import { useRewards } from '../rewards.ts';
import { StatBar } from '../components/stats/StatBar.tsx';
import { type LearningData, startDrillSession } from '../learning.ts';
import { href, navigate } from '../router.ts';
import { useServices } from '../services.ts';
import { t, type StringId } from '../strings.ts';
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
  const [sort, setSort] = useState<TopicSort>('accuracy');
  const [busy, setBusy] = useState(false);

  const view = useMemo(() => {
    const now = clock.now();
    const stats = buildStats({
      index: data.index,
      cards: data.cards,
      scheduler: data.scheduler,
      now,
      events: data.events,
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
  const rewards = useRewards(data);
  const showRewards = data.settings.rewards;
  // With rewards on, the streak counts days that met the goal (SPEC 15).
  const streak = showRewards
    ? rewards.streak
    : { current: act.currentStreak, longest: act.longestStreak };
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
        <section class="stats__hero" aria-label={t('stats.accuracy')}>
          <p class="stats__big">
            {stats.overall.accuracy.share === null
              ? t('stats.retentionNone')
              : `${pct(stats.overall.accuracy.share)}%`}
          </p>
          <p class="stats__big-label">{t('stats.accuracy')}</p>
          <p class="screen__muted stats__hint">
            {t('stats.accuracyHint', {
              right: stats.overall.accuracy.right,
              answered: stats.overall.accuracy.answered,
            })}
          </p>
        </section>

        <dl class="stats__tiles">
          <div class="stats__tile">
            <dt>{t('stats.recall')}</dt>
            <dd class="stats__tile-value">
              {stats.overall.retention === null
                ? t('stats.retentionNone')
                : `${pct(stats.overall.retention)}%`}
            </dd>
            <dd class="stats__tile-detail">{t('stats.recallDetail')}</dd>
          </div>
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
            <dd class="stats__tile-value">{t('stats.streakValue', { days: streak.current })}</dd>
            <dd class="stats__tile-detail">{t('stats.streakDetail', { days: streak.longest })}</dd>
          </div>
          <div class="stats__tile">
            <dt>{t('stats.answers')}</dt>
            <dd class="stats__tile-value">{t('stats.answersValue', { today: act.today })}</dd>
            <dd class="stats__tile-detail">{t('stats.answersDetail', { total: act.total })}</dd>
          </div>
        </dl>
        <p class="screen__muted stats__hint">{t('stats.recallHint')}</p>

        <section class="stats__section" aria-labelledby="stats-topics">
          <h2 class="shelf__title" id="stats-topics">
            {t('stats.topics')}
          </h2>
          <div class="chips" role="group" aria-label={t('stats.sortLabel')}>
            <Chip pressed={sort === 'accuracy'} onClick={() => setSort('accuracy')}>
              {t('stats.sortAccuracy')}
            </Chip>
            <Chip pressed={sort === 'retention'} onClick={() => setSort('retention')}>
              {t('stats.sortRetention')}
            </Chip>
            <Chip pressed={sort === 'coverage'} onClick={() => setSort('coverage')}>
              {t('stats.sortCoverage')}
            </Chip>
          </div>
          <p class="screen__muted stats__hint">{t(`stats.sortIntro.${sort}` as StringId)}</p>
          {topics.length === 0 ? (
            <p class="screen__muted">{t('stats.noTopics')}</p>
          ) : (
            <ul class="stat-list">
              {topics.map((x) => {
                const share = x.accuracy.share;
                const shown =
                  sort === 'accuracy'
                    ? (share ?? 0)
                    : sort === 'retention'
                      ? (x.retention ?? 0)
                      : x.coverage;
                const valueText =
                  sort === 'accuracy' && share === null
                    ? t('stats.noRecent')
                    : t('stats.topicValue', { percent: pct(shown) });
                const detail =
                  sort === 'accuracy'
                    ? t('stats.topicAnswers', { n: x.accuracy.answered })
                    : t('stats.topicCoverage', { started: x.started, verified: x.verified });
                return (
                  <StatBar
                    key={x.id}
                    label={x.label}
                    caption={x.subjectLabel}
                    value={shown}
                    valueText={valueText}
                    detail={detail}
                    weak={x.weak}
                    href={href('library', x.subjectId, x.branchId)}
                    ariaLabel={t('stats.topicLabel', {
                      topic: x.label,
                      value: valueText,
                      detail,
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

        <a class="quiet-row" href={href('stats', 'calibration')}>
          <span class="quiet-row__text">
            <span>{t('calibration.row')}</span>
            <span class="quiet-row__hint">{t('calibration.rowHint')}</span>
          </span>
          <Icon name="chevron" size={20} />
        </a>
        {showRewards ? (
          <a class="quiet-row" href={href('stats', 'rewards')}>
            <span class="quiet-row__text">
              <span>{t('stats.rewards')}</span>
              <span class="quiet-row__hint">
                {t('rewards.level', { level: rewards.level.level, title: rewards.level.title })}
              </span>
            </span>
            <Icon name="chevron" size={20} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function RewardsScreen() {
  const learning = useLearning();
  return (
    <main class="screen rewards">
      <a class="back-link" href={href('stats')}>
        <Icon name="back" size={20} />
        {t('rewards.back')}
      </a>
      <h1 class="screen__title">{t('rewards.title')}</h1>
      {learning.status === 'ready' ? (
        learning.value.data.settings.rewards ? (
          <RewardsBody data={learning.value.data} />
        ) : (
          <p class="screen__muted">{t('rewards.off')}</p>
        )
      ) : (
        <p class="screen__muted" aria-live="polite">
          {t('common.loading')}
        </p>
      )}
    </main>
  );
}

function RewardsBody({ data }: { data: LearningData }) {
  const { level, xp, challenge, subjects, badges } = useRewards(data);
  return (
    <>
      <section class="rewards__level">
        <ProgressRing
          value={level.into / level.span}
          size={96}
          stroke={6}
          label={t('rewards.levelLabel', {
            level: level.level,
            into: level.into,
            span: level.span,
          })}
        >
          <span class="rewards__level-number" aria-hidden="true">
            {level.level}
          </span>
        </ProgressRing>
        <div class="rewards__level-text">
          <p class="screen__subtitle">
            {t('rewards.level', { level: level.level, title: level.title })}
          </p>
          <p class="screen__muted rewards__line">{t('rewards.xp', { xp })}</p>
          <p class="screen__muted rewards__line">{t('rewards.toNext', { n: level.toNext })}</p>
        </div>
      </section>

      <section class="stats__section" aria-labelledby="rewards-week">
        <h2 class="shelf__title" id="rewards-week">
          {t('rewards.week')}
        </h2>
        <Card class="rewards__challenge">
          <p class="rewards__line">
            {t(`rewards.challenge.${challenge.id}` as StringId, { target: challenge.target })}
          </p>
          <ProgressBar
            value={Math.min(1, challenge.value / challenge.target)}
            label={t('rewards.challengeProgress', {
              value: challenge.value,
              target: challenge.target,
              reward: challenge.reward,
            })}
          />
          <p class="screen__muted rewards__line">
            {challenge.done
              ? t('rewards.challengeDone', { reward: challenge.reward })
              : t('rewards.challengeProgress', {
                  value: challenge.value,
                  target: challenge.target,
                  reward: challenge.reward,
                })}
          </p>
        </Card>
      </section>

      <section class="stats__section" aria-labelledby="rewards-subjects">
        <h2 class="shelf__title" id="rewards-subjects">
          {t('rewards.subjects')}
        </h2>
        <ul class="rewards__subjects">
          {subjects.map((s) => (
            <li key={s.id}>
              <span>{s.label}</span>
              <span class="screen__muted">
                {t('rewards.subjectXp', { title: s.title, xp: s.xp })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section class="stats__section" aria-labelledby="rewards-badges">
        <h2 class="shelf__title" id="rewards-badges">
          {t('rewards.badges')}
        </h2>
        <ul class="badges">
          {badges.map((b) => (
            <li key={b.id} class={`badge${b.earned ? ' badge--earned' : ''}`}>
              <Icon name="today" size={28} />
              <span class="badge__name">{t(`badge.${b.id}.name` as StringId)}</span>
              <span class="badge__how">{t(`badge.${b.id}.how` as StringId)}</span>
              <span class="visually-hidden">
                {b.earned ? t('rewards.earned') : t('rewards.notYet')}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
