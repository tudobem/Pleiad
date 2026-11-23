import { Icon } from './Icon.tsx';
import { MathText } from './MathText.tsx';
import './components.css';

export type OptionState = 'default' | 'selected' | 'correct' | 'wrong' | 'dimmed';

export interface OptionButtonProps {
  readonly letter: string;
  readonly text: string;
  readonly state: OptionState;
  /** Shown next to correct/wrong options so meaning never relies on color alone. */
  readonly tag?: string;
  readonly note?: string;
  readonly onSelect?: () => void;
  readonly locked: boolean;
}

export function OptionButton({
  letter,
  text,
  state,
  tag,
  note,
  onSelect,
  locked,
}: OptionButtonProps) {
  const icon = state === 'correct' ? 'check' : state === 'wrong' ? 'cross' : null;
  return (
    <button
      type="button"
      class={`option option--${state}`}
      aria-pressed={!locked ? state === 'selected' : undefined}
      aria-disabled={locked}
      onClick={locked ? undefined : onSelect}
    >
      <span class="option__letter" aria-hidden="true">
        {icon ? <Icon name={icon} size={18} /> : letter}
      </span>
      <span class="option__body">
        <span class="option__text">
          <MathText text={text} />
        </span>
        {note ? <span class="option__note">{note}</span> : null}
      </span>
      {tag ? <span class="option__tag">{tag}</span> : null}
    </button>
  );
}
