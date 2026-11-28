import { issue, type Issue } from './issues.ts';
import { isCatchAllOption, jaccard, normalizeText } from './normalize.ts';
import { binOf } from './estimation.ts';
import { dateKey, parseTimelineDate, precisionOf } from './timeline.ts';
import { clozeAnswers } from './cloze.ts';
import { normalizeAnswer, parseNumber } from '../session/normalizeAnswer.ts';
import { mergeTaxonomy, type MergedTaxonomy } from './taxonomy.ts';
import type { IdLedger, LoadedPack, Question } from './types.ts';

/** Prompts at or above this token similarity are reported as near-duplicates. */
export const NEAR_DUPLICATE_THRESHOLD = 0.8;

export interface ValidateInput {
  readonly packs: readonly LoadedPack[];
  /** content/ids.json; omit to skip ledger checks (unit tests of other rules). */
  readonly ledger?: IdLedger;
  /** Color token names defined in src/ui/tokens.css (without "--"). */
  readonly accentTokens?: ReadonlySet<string>;
}

export interface ValidateResult {
  readonly issues: readonly Issue[];
  readonly taxonomy: MergedTaxonomy;
}

interface Located {
  readonly question: Question;
  readonly pack: LoadedPack;
  readonly file: string;
}

/**
 * Semantic content rules (SPEC 5.5) over already schema-valid data.
 * Pure: no file system, no clock.
 */
export function validateContent(input: ValidateInput): ValidateResult {
  const { taxonomy, issues: taxonomyIssues } = mergeTaxonomy(input.packs);
  const issues: Issue[] = [...taxonomyIssues];
  const located = collectQuestions(input.packs, issues);
  const questionIds = new Set(located.keys());
  const conceptIds = new Map<string, string>(); // concept id -> pack folder

  for (const pack of input.packs) {
    checkPackMeta(pack, taxonomy, input.accentTokens, issues);
    for (const node of pack.concepts?.nodes ?? []) {
      if (conceptIds.has(node.id)) {
        issues.push(
          issue(
            'error',
            'concept.duplicate-id',
            conceptsFile(pack),
            `Concept "${node.id}" is declared more than once.`,
            node.id,
          ),
        );
      }
      conceptIds.set(node.id, pack.folder);
    }
  }

  for (const pack of input.packs) checkConcepts(pack, taxonomy, conceptIds, issues);

  const referencedConcepts = new Set<string>();
  for (const { question, pack, file } of located.values()) {
    checkQuestion(question, pack, file, taxonomy, issues);
    checkReferences(question, file, located, questionIds, conceptIds, issues);
    for (const c of question.concepts ?? []) referencedConcepts.add(c);
    for (const p of question.prerequisites ?? []) if (conceptIds.has(p)) referencedConcepts.add(p);
  }

  for (const pack of input.packs) {
    for (const node of pack.concepts?.nodes ?? []) {
      if (!referencedConcepts.has(node.id)) {
        issues.push(
          issue(
            'warning',
            'concept.orphan',
            conceptsFile(pack),
            `Concept "${node.id}" is not used by any question.`,
            node.id,
          ),
        );
      }
    }
  }

  checkNearDuplicates([...located.values()], issues);
  if (input.ledger) checkLedger(input.ledger, located, issues);

  return { issues, taxonomy };
}

function collectQuestions(packs: readonly LoadedPack[], issues: Issue[]): Map<string, Located> {
  const located = new Map<string, Located>();
  for (const pack of packs) {
    for (const qf of pack.questionFiles) {
      for (const question of qf.questions) {
        const previous = located.get(question.id);
        if (previous) {
          issues.push(
            issue(
              'error',
              'question.duplicate-id',
              qf.path,
              `ID "${question.id}" is also used in ${previous.file}.`,
              question.id,
            ),
          );
          continue;
        }
        located.set(question.id, { question, pack, file: qf.path });
      }
    }
  }
  return located;
}

function checkPackMeta(
  pack: LoadedPack,
  taxonomy: MergedTaxonomy,
  accentTokens: ReadonlySet<string> | undefined,
  issues: Issue[],
): void {
  const file = `${pack.folder}/pack.json`;
  const { meta } = pack;
  if (meta.id !== pack.folder) {
    issues.push(
      issue(
        'error',
        'pack.id-mismatch',
        file,
        `Pack id "${meta.id}" must equal its folder name "${pack.folder}".`,
      ),
    );
  }
  let expectedParent: string | undefined;
  for (const id of meta.domainPath) {
    const node = taxonomy.nodes.get(id);
    if (!node) {
      issues.push(
        issue('error', 'pack.domain-path', file, `domainPath node "${id}" does not exist.`, id),
      );
      return;
    }
    if (node.parent !== expectedParent) {
      issues.push(
        issue(
          'error',
          'pack.domain-path',
          file,
          `domainPath is not a root-down path: "${id}" is not a child of "${expectedParent ?? '(root)'}".`,
          id,
        ),
      );
      return;
    }
    expectedParent = id;
  }
  if (accentTokens && !accentTokens.has(meta.accent)) {
    issues.push(
      issue(
        'error',
        'pack.accent',
        file,
        `Accent "${meta.accent}" is not a token in src/ui/tokens.css.`,
      ),
    );
  }
}

function checkConcepts(
  pack: LoadedPack,
  taxonomy: MergedTaxonomy,
  conceptIds: ReadonlyMap<string, string>,
  issues: Issue[],
): void {
  if (!pack.concepts) return;
  const file = conceptsFile(pack);
  for (const node of pack.concepts.nodes) {
    if (node.topic !== undefined && taxonomy.nodes.get(node.topic)?.kind !== 'topic') {
      issues.push(
        issue(
          'error',
          'concept.topic',
          file,
          `Concept "${node.id}" points to unknown topic "${node.topic}".`,
          node.id,
        ),
      );
    }
  }
  for (const edge of pack.concepts.edges) {
    for (const end of [edge.from, edge.to]) {
      if (!conceptIds.has(end)) {
        issues.push(
          issue(
            'error',
            'concept.edge',
            file,
            `Edge ${edge.from} -> ${edge.to} references unknown concept "${end}".`,
            end,
          ),
        );
      }
    }
  }
}

function checkQuestion(
  q: Question,
  pack: LoadedPack,
  file: string,
  taxonomy: MergedTaxonomy,
  issues: Issue[],
): void {
  if (q.pack !== pack.meta.id) {
    issues.push(
      issue(
        'error',
        'question.pack',
        file,
        `"pack" is "${q.pack}" but the file is in pack "${pack.meta.id}".`,
        q.id,
      ),
    );
  }
  const topicFromName = pack.questionFiles.find((f) => f.path === file)?.topicFromName;
  if (q.topic !== topicFromName) {
    issues.push(
      issue(
        'error',
        'question.topic-file',
        file,
        `"topic" is "${q.topic}" but the file is for topic "${topicFromName}".`,
        q.id,
      ),
    );
  }
  const node = taxonomy.nodes.get(q.topic);
  if (!node) {
    issues.push(
      issue(
        'error',
        'question.topic',
        file,
        `Topic "${q.topic}" does not exist in the taxonomy.`,
        q.id,
      ),
    );
  } else if (node.kind !== 'topic') {
    issues.push(
      issue('error', 'question.topic', file, `"${q.topic}" is a ${node.kind}, not a topic.`, q.id),
    );
  }

  if (q.status === 'verified' && q.verified_on === undefined) {
    issues.push(
      issue('error', 'question.verified-on', file, 'Verified questions need "verified_on".', q.id),
    );
  }
  if (q.status !== 'verified' && q.verified_on !== undefined) {
    issues.push(
      issue(
        'error',
        'question.verified-on',
        file,
        `"verified_on" is set but status is "${q.status}".`,
        q.id,
      ),
    );
  }
  if (q.verified_on !== undefined && q.verified_on < q.created) {
    issues.push(
      issue('error', 'question.verified-on', file, '"verified_on" is before "created".', q.id),
    );
  }

  for (const m of q.media ?? []) {
    if (!pack.mediaFiles.includes(m.src)) {
      issues.push(
        issue(
          'error',
          'media.missing',
          file,
          `Media file "${m.src}" not found in pack "${pack.folder}".`,
          q.id,
        ),
      );
    }
  }

  if (q.type === 'mcq') checkMcq(q, file, issues);
  if (q.type === 'short') checkShort(q, file, issues);
  if (q.type === 'cloze') checkCloze(q, file, issues);
  if (q.type === 'match') {
    checkDistinct(
      q.pairs.map((p) => p.left),
      'match.duplicate',
      'left items',
      q,
      file,
      issues,
    );
    checkDistinct(
      q.pairs.map((p) => p.right),
      'match.duplicate',
      'right items',
      q,
      file,
      issues,
    );
  }
  if (q.type === 'order') checkDistinct(q.items, 'order.duplicate', 'items', q, file, issues);
  if (q.type === 'estimation') checkEstimation(q, file, issues);
  if (q.type === 'timeline') checkTimeline(q, file, issues);
}

function checkEstimation(
  q: Extract<Question, { type: 'estimation' }>,
  file: string,
  issues: Issue[],
): void {
  const err = (code: string, message: string) =>
    issues.push(issue('error', code, file, message, q.id));
  const numbers = [
    q.value,
    ...(q.bins ?? []).flatMap((b) => [b.min, b.max]),
    ...(q.range ? [q.range.min, q.range.max] : []),
  ];
  if (q.scale === 'log' && numbers.some((n) => n <= 0)) {
    err('estimation.log', 'A log scale needs positive numbers only.');
  }
  if (q.bins) {
    q.bins.forEach((b, i) => {
      if (b.min >= b.max) err('estimation.bin', `Bin ${i + 1} has min >= max.`);
      const prev = q.bins?.[i - 1];
      if (prev && b.min < prev.max) {
        err('estimation.bins', `Bin ${i + 1} overlaps or comes before bin ${i}.`);
      }
    });
    if (binOf(q.bins, q.value) < 0) {
      err('estimation.value', 'No bin contains the value (max is exclusive).');
    }
  } else if (q.range) {
    if (q.range.min >= q.range.max) err('estimation.range', 'Range min must be below max.');
    if (q.value < q.range.min || q.value > q.range.max) {
      err('estimation.value', 'The value lies outside the slider range.');
    }
    if (q.scale === 'log' && (q.tolerance ?? 0) < 1) {
      err('estimation.tolerance', 'On a log scale the tolerance is a factor of at least 1.');
    }
  }
}

function checkTimeline(
  q: Extract<Question, { type: 'timeline' }>,
  file: string,
  issues: Issue[],
): void {
  const precision = q.precision ?? 'year';
  const keys = new Set<number>();
  for (const e of q.events) {
    const d = parseTimelineDate(e.date);
    if (!d) {
      issues.push(issue('error', 'timeline.date', file, `"${e.date}" is not a valid date.`, q.id));
      continue;
    }
    if (precisionOf(d) !== precision) {
      issues.push(
        issue(
          'error',
          'timeline.precision',
          file,
          `"${e.date}" does not match the precision "${precision}".`,
          q.id,
        ),
      );
    }
    const key = dateKey(d);
    if (keys.has(key)) {
      issues.push(
        issue('error', 'timeline.tie', file, `Two events share the date ${e.date}.`, q.id),
      );
    }
    keys.add(key);
  }
  checkDistinct(
    q.events.map((e) => e.label),
    'timeline.duplicate',
    'events',
    q,
    file,
    issues,
  );
}

function checkDistinct(
  values: readonly string[],
  code: string,
  what: string,
  q: Question,
  file: string,
  issues: Issue[],
): void {
  const seen = new Set<string>();
  for (const v of values) {
    const key = normalizeText(v);
    if (seen.has(key)) {
      issues.push(issue('error', code, file, `Two ${what} are the same: "${v}".`, q.id));
    }
    seen.add(key);
  }
}

function checkShort(q: Extract<Question, { type: 'short' }>, file: string, issues: Issue[]): void {
  const seen = new Set<string>();
  for (const a of q.answers) {
    const key = normalizeAnswer(a);
    if (key === '') {
      issues.push(
        issue('error', 'short.empty', file, `Answer "${a}" is empty after normalization.`, q.id),
      );
    } else if (seen.has(key)) {
      issues.push(
        issue(
          'error',
          'short.duplicate',
          file,
          `Answers repeat after normalization: "${a}".`,
          q.id,
        ),
      );
    }
    seen.add(key);
  }
  if (q.numeric) {
    const canonical = parseNumber(q.answers[0] ?? '');
    if (canonical === null || Math.abs(canonical - q.numeric.value) > q.numeric.tolerance) {
      issues.push(
        issue(
          'error',
          'short.numeric',
          file,
          'The first answer must be a number within the numeric tolerance.',
          q.id,
        ),
      );
    }
  }
}

function checkCloze(q: Extract<Question, { type: 'cloze' }>, file: string, issues: Issue[]): void {
  const answers = clozeAnswers(q.text);
  if (answers.length === 0) {
    issues.push(
      issue('error', 'cloze.no-blank', file, 'The text needs at least one {{blank}}.', q.id),
    );
  }
  if (answers.some((a) => normalizeText(a) === '')) {
    issues.push(issue('error', 'cloze.empty-blank', file, 'A blank has no answer.', q.id));
  }
  const answerKeys = new Set(answers.map(normalizeText));
  const seen = new Set<string>();
  for (const d of q.bank ?? []) {
    const key = normalizeText(d);
    if (answerKeys.has(key)) {
      issues.push(issue('error', 'cloze.bank', file, `Distractor "${d}" is also an answer.`, q.id));
    } else if (seen.has(key)) {
      issues.push(issue('error', 'cloze.bank', file, `Distractor "${d}" appears twice.`, q.id));
    }
    seen.add(key);
  }
}

function checkMcq(q: Extract<Question, { type: 'mcq' }>, file: string, issues: Issue[]): void {
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
    issues.push(
      issue(
        'error',
        'mcq.answer-range',
        file,
        `"answer" ${q.answer} is not a valid option index.`,
        q.id,
      ),
    );
  }
  const seen = new Map<string, number>();
  q.options.forEach((option, index) => {
    if (isCatchAllOption(option.text)) {
      issues.push(
        issue(
          'error',
          'mcq.catch-all',
          file,
          `Option ${index} ("${option.text}") is a catch-all; use a real alternative.`,
          q.id,
        ),
      );
    }
    const key = normalizeText(option.text);
    const first = seen.get(key);
    if (first !== undefined) {
      issues.push(
        issue(
          'error',
          'mcq.duplicate-option',
          file,
          `Options ${first} and ${index} are the same.`,
          q.id,
        ),
      );
    } else {
      seen.set(key, index);
    }
  });
  const correct = q.options[q.answer];
  if (correct?.why_wrong !== undefined) {
    issues.push(
      issue(
        'error',
        'mcq.why-wrong-on-answer',
        file,
        'The correct option must not have "why_wrong".',
        q.id,
      ),
    );
  }
}

function checkReferences(
  q: Question,
  file: string,
  located: ReadonlyMap<string, Located>,
  questionIds: ReadonlySet<string>,
  conceptIds: ReadonlyMap<string, string>,
  issues: Issue[],
): void {
  for (const ref of q.confusable_with ?? []) {
    if (ref === q.id) {
      issues.push(
        issue('error', 'ref.confusable', file, 'An item cannot be confusable with itself.', q.id),
      );
    } else if (!questionIds.has(ref)) {
      issues.push(
        issue(
          'error',
          'ref.confusable',
          file,
          `confusable_with "${ref}" is not a question ID.`,
          q.id,
        ),
      );
    } else if (located.get(ref)?.question.status === 'retired' && q.status !== 'retired') {
      issues.push(
        issue('warning', 'ref.retired', file, `confusable_with "${ref}" is retired.`, q.id),
      );
    }
  }
  for (const ref of q.prerequisites ?? []) {
    if (ref === q.id || (!questionIds.has(ref) && !conceptIds.has(ref))) {
      issues.push(
        issue(
          'error',
          'ref.prerequisite',
          file,
          `Prerequisite "${ref}" is not a question or concept ID.`,
          q.id,
        ),
      );
    }
  }
  for (const ref of q.concepts ?? []) {
    if (!conceptIds.has(ref)) {
      issues.push(
        issue(
          'error',
          'ref.concept',
          file,
          `Concept "${ref}" is not defined in any concepts.json.`,
          q.id,
        ),
      );
    }
  }
}

function checkNearDuplicates(all: readonly Located[], issues: Issue[]): void {
  const active = all.filter((l) => l.question.status !== 'retired');
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i];
      const b = active[j];
      if (!a || !b) continue;
      const score = jaccard(a.question.prompt, b.question.prompt);
      if (score >= NEAR_DUPLICATE_THRESHOLD) {
        issues.push(
          issue(
            'warning',
            'question.near-duplicate',
            b.file,
            `Prompt is very similar to "${a.question.id}" (${Math.round(score * 100)}% token overlap).`,
            b.question.id,
          ),
        );
      }
    }
  }
}

function checkLedger(
  ledger: IdLedger,
  located: ReadonlyMap<string, Located>,
  issues: Issue[],
): void {
  for (const [id, pack] of Object.entries(ledger)) {
    const found = located.get(id);
    if (!found) {
      issues.push(
        issue(
          'error',
          'ledger.deleted',
          'ids.json',
          `Question "${id}" (pack "${pack}") was deleted. IDs are never removed: set status "retired" instead.`,
          id,
        ),
      );
    } else if (found.pack.meta.id !== pack) {
      issues.push(
        issue(
          'error',
          'ledger.moved',
          found.file,
          `Question "${id}" is registered to pack "${pack}".`,
          id,
        ),
      );
    }
  }
  for (const [id, { file }] of located) {
    if (!(id in ledger)) {
      issues.push(
        issue(
          'error',
          'ledger.unregistered',
          file,
          `Question "${id}" is not registered. Run: npm run content:register`,
          id,
        ),
      );
    }
  }
}

function conceptsFile(pack: LoadedPack): string {
  return `${pack.folder}/concepts.json`;
}
