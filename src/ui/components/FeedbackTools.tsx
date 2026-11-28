import { useEffect, useState } from 'preact/hooks';
import {
  FLAG_KINDS,
  isFlag,
  makeFlag,
  makeNote,
  NOTE_MAX,
  type Flag,
  type FlagKind,
  type Note,
} from '../../core/review/flags.ts';
import { useServices } from '../services.ts';
import { t } from '../strings.ts';
import { Button } from './Button.tsx';
import { Icon } from './Icon.tsx';
import { Chip } from './library/Chip.tsx';

type Panel = 'none' | 'note' | 'flag';

/**
 * Note and Flag on the feedback screen (DESIGN 4.3, SPEC 10.2, 16.5). Both are
 * stored on-device (and in backups) and never change scheduling.
 */
export function FeedbackTools({ questionId }: { questionId: string }) {
  const services = useServices();
  const { storage, clock, appVersion } = services;
  const [panel, setPanel] = useState<Panel>('none');
  const [note, setNote] = useState<Note | null>(null);
  const [flag, setFlag] = useState<Flag | null>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<FlagKind>('wrong');
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setPanel('none');
    setSaved(null);
    void Promise.all([
      storage.get<Note>('notes', questionId),
      storage.get<unknown>('flags', questionId),
    ]).then(([n, f]) => {
      if (!alive) return;
      setNote(n ?? null);
      setFlag(isFlag(f) ? f : null);
    });
    return () => {
      alive = false;
    };
  }, [storage, questionId]);

  const open = (p: Panel) => {
    setSaved(null);
    if (p === panel) return setPanel('none');
    setPanel(p);
    setText(p === 'note' ? (note?.text ?? '') : (flag?.note ?? ''));
    if (p === 'flag') setKind(flag?.kind ?? 'wrong');
  };

  const saveNote = async () => {
    const next = makeNote(text, clock.now());
    if (next) await storage.put('notes', questionId, next);
    else await storage.delete('notes', questionId);
    setNote(next);
    setPanel('none');
    setSaved(next ? t('tools.noteSaved') : t('tools.noteRemoved'));
  };

  const saveFlag = async () => {
    const next = makeFlag(questionId, kind, text, clock.now(), appVersion);
    await storage.put('flags', questionId, next);
    setFlag(next);
    setPanel('none');
    setSaved(t('tools.flagSaved'));
  };

  const removeFlag = async () => {
    await storage.delete('flags', questionId);
    setFlag(null);
    setPanel('none');
    setSaved(t('tools.flagRemoved'));
  };

  return (
    <div class="tools">
      <div class="tools__row">
        <Button variant="text" onClick={() => open('note')} expanded={panel === 'note'}>
          {note ? t('tools.editNote') : t('tools.note')}
        </Button>
        <button
          type="button"
          class={`tools__flag${flag ? ' tools__flag--on' : ''}`}
          aria-label={flag ? t('tools.flagged') : t('tools.flag')}
          aria-expanded={panel === 'flag'}
          onClick={() => open('flag')}
        >
          <Icon name="flag" size={20} />
        </button>
      </div>
      {note && panel !== 'note' ? <p class="tools__note">{note.text}</p> : null}
      {saved ? (
        <p class="tools__saved" role="status">
          {saved}
        </p>
      ) : null}

      {panel === 'note' ? (
        <div class="tools__panel">
          <label class="tools__label" for="tools-note">
            {t('tools.noteLabel')}
          </label>
          <textarea
            id="tools-note"
            class="tools__text"
            maxLength={NOTE_MAX}
            rows={3}
            value={text}
            onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
          />
          <Button variant="secondary" onClick={() => void saveNote()}>
            {t('tools.save')}
          </Button>
        </div>
      ) : null}

      {panel === 'flag' ? (
        <div class="tools__panel">
          <p class="tools__label">{t('tools.flagWhat')}</p>
          <div class="chips" role="group" aria-label={t('tools.flagWhat')}>
            {FLAG_KINDS.map((k) => (
              <Chip key={k} pressed={kind === k} onClick={() => setKind(k)}>
                {t(`tools.kind.${k}`)}
              </Chip>
            ))}
          </div>
          <label class="tools__label" for="tools-flag">
            {t('tools.flagNote')}
          </label>
          <textarea
            id="tools-flag"
            class="tools__text"
            maxLength={NOTE_MAX}
            rows={2}
            value={text}
            onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
          />
          <Button variant="secondary" onClick={() => void saveFlag()}>
            {t('tools.saveFlag')}
          </Button>
          {flag ? (
            <Button variant="text" onClick={() => void removeFlag()}>
              {t('tools.removeFlag')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
