import type { LibraryNode } from '../../../core/library/library.ts';
import { coveragePercent } from '../../../core/library/library.ts';
import { t } from '../../strings.ts';
import { Icon } from '../Icon.tsx';
import { ProgressBar } from '../ProgressBar.tsx';
import './library.css';

function RowBody({ node, accent }: { node: LibraryNode; accent: string }) {
  const percent = coveragePercent(node);
  const empty = node.verified === 0;
  return (
    <span class="tree-row__body">
      <span class="tree-row__line">
        <span class="tree-row__label">{node.label}</span>
        {!empty && node.started === 0 ? (
          <span class="tree-row__new">{t('subject.new')}</span>
        ) : null}
        <span class="tree-row__count">
          {empty
            ? t('subject.empty')
            : t('subject.count', { started: node.started, verified: node.verified })}
        </span>
      </span>
      {empty ? null : (
        <ProgressBar
          value={percent / 100}
          label={t('library.progressLabel', { percent })}
          accent={accent}
        />
      )}
    </span>
  );
}

/**
 * A branch row that expands inline to its topics (DESIGN 4.5); a topic or an
 * empty branch is a plain row. Deeper nesting is not shown.
 */
export function TreeRow({
  node,
  accent,
  open,
  onToggle,
}: {
  node: LibraryNode;
  accent: string;
  open: boolean;
  onToggle: () => void;
}) {
  const empty = node.verified === 0;
  const expandable = node.children.length > 0;
  const panelId = `tree-${node.id}`;
  return (
    <li class={`tree-row${empty ? ' tree-row--empty' : ''}`}>
      {expandable ? (
        <button
          type="button"
          class="tree-row__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span class={`tree-row__chevron${open ? ' tree-row__chevron--open' : ''}`}>
            <Icon name="chevron" size={18} />
          </span>
          <RowBody node={node} accent={accent} />
        </button>
      ) : (
        <div class="tree-row__static">
          <RowBody node={node} accent={accent} />
        </div>
      )}
      {expandable && open ? (
        <ul class="tree-row__topics" id={panelId}>
          {node.children.map((child) => (
            <li
              key={child.id}
              class={`tree-row__topic${child.verified === 0 ? ' tree-row--empty' : ''}`}
            >
              <RowBody node={child} accent={accent} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
