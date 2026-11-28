import { useState } from 'preact/hooks';
import type { Library, LibrarySubject } from '../../core/library/library.ts';
import { PACE_NAMES, PACES, paceOf, type Pace } from '../../core/onboarding/pace.ts';
import { placementEligible } from '../../core/session/placement.ts';
import { Button } from '../components/Button.tsx';
import { Card } from '../components/Card.tsx';
import { Chip } from '../components/library/Chip.tsx';
import {
  saveSettings,
  setOnboarded,
  setPacksActive,
  startPlacement,
  type LearningData,
} from '../learning.ts';
import { href, navigate } from '../router.ts';
import { useServices } from '../services.ts';
import { t } from '../strings.ts';
import { useLearning } from '../useLearning.ts';
import { useLibrary } from './LibraryScreen.tsx';
import './screens.css';

type Step = 'welcome' | 'interests' | 'pace' | 'install' | 'placement';
const STEPS: readonly Step[] = ['welcome', 'interests', 'pace', 'install', 'placement'];

/** First run (SPEC 13, DESIGN 4.8): welcome, interests, pace, install, placement. */
export function WelcomeScreen({ step: initialStep }: { step?: string }) {
  const learning = useLearning();
  const [step, setStep] = useState<Step>(
    STEPS.includes(initialStep as Step) ? (initialStep as Step) : 'welcome',
  );
  return (
    <main class="screen welcome">
      {learning.status === 'ready' ? (
        <WelcomeSteps
          data={learning.value.data}
          step={step}
          setStep={setStep}
          reload={learning.reload}
        />
      ) : learning.status === 'error' ? (
        <Card>
          <p class="screen__muted">{t('common.loadError')}</p>
          <Button variant="secondary" onClick={learning.retry}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : (
        <p class="screen__muted" aria-live="polite">
          {t('common.loading')}
        </p>
      )}
    </main>
  );
}

/** Subjects with questions, in Library order. */
const subjectsOf = (library: Library): LibrarySubject[] =>
  library.subjects.filter((s) => s.verified > 0);

function WelcomeSteps({
  data,
  step,
  setStep,
  reload,
}: {
  data: LearningData;
  step: Step;
  setStep: (s: Step) => void;
  reload: () => void;
}) {
  const services = useServices();
  const library = useLibrary(data);
  const subjects = subjectsOf(library);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(subjects.filter((s) => s.active).map((s) => s.id)),
  );
  const [pace, setPace] = useState<Pace>(() => {
    const current = paceOf(data.settings);
    return current === 'custom' ? 'steady' : current;
  });
  const [busy, setBusy] = useState(false);

  const installed = services.device.isStandalone();
  const placeable = subjects.filter(
    (s) => s.active && chosen.has(s.id) && placementEligible(s.verified),
  );
  const steps = STEPS.filter(
    (s) =>
      (s !== 'install' || !installed) &&
      (s !== 'placement' || placeable.length > 0 || step === 'placement'),
  );
  const position = steps.indexOf(step);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const finish = () =>
    run(async () => {
      await setOnboarded(services, true);
      navigate('today');
    });

  const next = () =>
    run(async () => {
      if (step === 'interests') {
        const on = subjects.filter((s) => chosen.has(s.id)).flatMap((s) => s.packs);
        const off = subjects.filter((s) => !chosen.has(s.id)).flatMap((s) => s.packs);
        await setPacksActive(services, data.index, on, true);
        if (off.length > 0) await setPacksActive(services, data.index, off, false);
        // Load the chosen subjects' questions for placement.
        reload();
      }
      if (step === 'pace') await saveSettings(services, PACES[pace]);
      const following = steps[position + 1];
      if (following) setStep(following);
      else {
        await setOnboarded(services, true);
        navigate('today');
      }
    });

  const back = () => {
    const previous = steps[position - 1];
    if (previous) setStep(previous);
  };

  const toggle = (id: string) =>
    setChosen((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });

  const place = (subject: LibrarySubject) =>
    run(async () => {
      await startPlacement(services, data, subject.packs, href('welcome', 'placement'));
      navigate('session');
    });

  const domains = library.domains
    .map((d) => ({ ...d, subjects: d.subjects.filter((s) => s.verified > 0) }))
    .filter((d) => d.subjects.length > 0);
  const isLast = position === steps.length - 1;

  return (
    <>
      <p class="screen__overline">
        {t('welcome.step', { current: position + 1, total: steps.length })}
      </p>

      {step === 'welcome' ? (
        <>
          <h1 class="screen__title">{t('welcome.title')}</h1>
          <p class="welcome__lead">{t('welcome.lead')}</p>
          <p class="screen__muted">{t('welcome.body')}</p>
        </>
      ) : null}

      {step === 'interests' ? (
        <>
          <h1 class="screen__title">{t('welcome.interestsTitle')}</h1>
          <p class="screen__muted">{t('welcome.interestsBody')}</p>
          {domains.map((d) => (
            <section key={d.id} class="welcome__group" aria-label={d.label}>
              <h2 class="welcome__group-title">{d.label}</h2>
              <div class="chips">
                {d.subjects.map((s) => (
                  <Chip key={s.id} pressed={chosen.has(s.id)} onClick={() => toggle(s.id)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </section>
          ))}
          {chosen.size === 0 ? <p class="screen__muted">{t('welcome.interestsNone')}</p> : null}
        </>
      ) : null}

      {step === 'pace' ? (
        <>
          <h1 class="screen__title">{t('welcome.paceTitle')}</h1>
          <p class="screen__muted">{t('welcome.paceBody')}</p>
          <div class="welcome__paces" role="group" aria-label={t('welcome.paceTitle')}>
            {PACE_NAMES.map((p) => (
              <button
                key={p}
                type="button"
                class="welcome-pace"
                aria-pressed={pace === p}
                onClick={() => setPace(p)}
              >
                <span class="welcome-pace__name">{t(`pace.${p}`)}</span>
                <span class="welcome-pace__detail">
                  {t('pace.detail', { fresh: PACES[p].newPerDay, goal: PACES[p].dailyGoal })}
                </span>
              </button>
            ))}
          </div>
          <p class="today__caption welcome__left">{t('welcome.paceLater')}</p>
        </>
      ) : null}

      {step === 'install' ? (
        <>
          <h1 class="screen__title">{t('welcome.installTitle')}</h1>
          <p class="screen__muted">{t('welcome.installWhy')}</p>
          <Card>
            <ol class="welcome__steps">
              <li>{t('welcome.install1')}</li>
              <li>{t('welcome.install2')}</li>
              <li>{t('welcome.install3')}</li>
            </ol>
          </Card>
          <p class="today__caption welcome__left">{t('welcome.installThen')}</p>
        </>
      ) : null}

      {step === 'placement' ? (
        <>
          <h1 class="screen__title">{t('welcome.placementTitle')}</h1>
          <p class="screen__muted">{t('welcome.placementBody')}</p>
          {placeable.map((s) => {
            const placed = s.packs.map((p) => data.settings.placements[p]).find(Boolean);
            return (
              <Card key={s.id} class="welcome__place">
                <h2 class="screen__subtitle">{s.label}</h2>
                <p class="screen__muted">
                  {placed
                    ? t('placement.current', { level: t(`tier.${placed}`) })
                    : t('placement.caption')}
                </p>
                <Button variant="secondary" onClick={() => place(s)} disabled={busy}>
                  {placed ? t('placement.again') : t('placement.find')}
                </Button>
              </Card>
            );
          })}
          <p class="today__caption welcome__left">{t('welcome.placementSkip')}</p>
        </>
      ) : null}

      <div class="welcome__footer">
        <Button
          onClick={() => void next()}
          disabled={busy || (step === 'interests' && chosen.size === 0)}
        >
          {step === 'welcome'
            ? t('welcome.begin')
            : isLast
              ? t('welcome.finish')
              : t('welcome.continue')}
        </Button>
        <div class="welcome__secondary">
          {position > 0 ? (
            <Button variant="text" onClick={back} disabled={busy}>
              {t('welcome.back')}
            </Button>
          ) : (
            <Button variant="text" onClick={() => void finish()} disabled={busy}>
              {t('welcome.skip')}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
