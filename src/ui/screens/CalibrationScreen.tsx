import { useMemo } from 'preact/hooks';
import {
  calibration,
  MIN_CALIBRATION_ANSWERS,
  type CalibrationRow,
} from '../../core/analytics/calibration.ts';
import { questionLookup } from '../../core/library/lookup.ts';
import { Card } from '../components/Card.tsx';
import { Icon } from '../components/Icon.tsx';
import type { LearningData } from '../learning.ts';
import { href } from '../router.ts';
import { t, type StringId } from '../strings.ts';
import { useLearning } from '../useLearning.ts';
import './screens.css';

const pct = (x: number) => Math.round(x * 100);

/** How well confidence matches results (SPEC 9). */
export function CalibrationScreen() {
  const learning = useLearning();
  return (
    <main class="screen calibration">
      <a class="back-link" href={href('stats')}>
        <Icon name="back" size={20} />
        {t('rewards.back')}
      </a>
      <h1 class="screen__title">{t('calibration.title')}</h1>
      {learning.status === 'ready' ? (
        <CalibrationBody data={learning.value.data} />
      ) : (
        <p class="screen__muted" aria-live="polite">
          {t('common.loading')}
        </p>
      )}
    </main>
  );
}

function CalibrationBody({ data }: { data: LearningData }) {
  const lookup = useMemo(() => questionLookup(data.index), [data.index]);
  const c = useMemo(
    () => calibration(data.events, { subjectOf: lookup.subjectOf, tierOf: lookup.tierOf }),
    [data.events, lookup],
  );
  if (c.answered < MIN_CALIBRATION_ANSWERS || c.brier === null || c.bias === null || !c.verdict) {
    return (
      <p class="screen__muted">
        {t('calibration.notEnough', { n: c.answered, min: MIN_CALIBRATION_ANSWERS })}
      </p>
    );
  }
  const overall = c.levels.reduce(
    (acc, l) => ({
      count: acc.count + l.count,
      right: acc.right + l.correct * l.count,
      expected: acc.expected + l.expected * l.count,
    }),
    { count: 0, right: 0, expected: 0 },
  );
  return (
    <>
      <section class="calibration__summary">
        <p class={`calibration__verdict calibration__verdict--${c.verdict}`}>
          {t(`calibration.verdict.${c.verdict}` as StringId)}
        </p>
        <p class="screen__muted calibration__line">
          {t('calibration.summary', {
            right: pct(overall.right / overall.count),
            expected: pct(overall.expected / overall.count),
            n: c.answered,
          })}
        </p>
        <p class="screen__muted calibration__line">
          {t('calibration.brier', { score: c.brier.toFixed(2) })}
        </p>
      </section>

      <section class="stats__section" aria-labelledby="calibration-levels">
        <h2 class="shelf__title" id="calibration-levels">
          {t('calibration.curve')}
        </h2>
        <ul class="calibration__levels">
          {c.levels.map((l) => (
            <li key={l.key}>
              <span class="calibration__level-line">
                <span>{t(`confidence.${l.key}` as StringId)}</span>
                <span class="screen__muted">{t('calibration.count', { n: l.count })}</span>
              </span>
              <span class="calibration__track" aria-hidden="true">
                <span class="calibration__fill" style={{ width: `${pct(l.correct)}%` }} />
                <span class="calibration__marker" style={{ left: `${pct(l.expected)}%` }} />
              </span>
              <span class="calibration__detail">
                {l.count === 0
                  ? t('calibration.none')
                  : t('calibration.rightExpected', {
                      right: pct(l.correct),
                      expected: pct(l.expected),
                    })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Breakdown
        id="calibration-subjects"
        title="calibration.bySubject"
        rows={c.bySubject}
        label={(key) => lookup.subjectLabel(key) ?? key}
      />
      <Breakdown
        id="calibration-tiers"
        title="calibration.byTier"
        rows={c.byTier}
        label={(key) => t(`tier.${key}` as StringId)}
      />
    </>
  );
}

function Breakdown({
  id,
  title,
  rows,
  label,
}: {
  id: string;
  title: StringId;
  rows: readonly CalibrationRow[];
  label: (key: string) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <section class="stats__section" aria-labelledby={id}>
      <h2 class="shelf__title" id={id}>
        {t(title)}
      </h2>
      <Card>
        <table class="calibration__table">
          <thead>
            <tr>
              <th scope="col">{t('calibration.colGroup')}</th>
              <th scope="col">{t('calibration.colAnswers')}</th>
              <th scope="col">{t('calibration.colRight')}</th>
              <th scope="col">{t('calibration.colExpected')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{label(r.key)}</th>
                <td>{r.count}</td>
                <td>{pct(r.correct)}%</td>
                <td>{pct(r.expected)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
