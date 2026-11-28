/** In-memory content fixtures for unit tests. Not shipped. */
import type {
  ClozeQuestion,
  LoadedPack,
  MatchQuestion,
  McqQuestion,
  OrderQuestion,
  EstimationQuestion,
  TimelineQuestion,
  PackMeta,
  Question,
  RecallQuestion,
  ShortQuestion,
  TaxonomyNode,
} from './types.ts';

export const NODES: TaxonomyNode[] = [
  { id: 'science', label: 'Science', kind: 'domain' },
  { id: 'cons', label: 'Consciousness', kind: 'subject', parent: 'science' },
  { id: 'theories', label: 'Theories', kind: 'branch', parent: 'cons' },
  { id: 'iit', label: 'IIT', kind: 'topic', parent: 'theories' },
  { id: 'gwt', label: 'Global workspace', kind: 'topic', parent: 'theories' },
];

export function meta(overrides: Partial<PackMeta> = {}): PackMeta {
  return {
    id: 'cons-pack',
    title: 'Consciousness',
    description: 'Test pack',
    version: '0.1.0',
    language: 'en',
    author: 'Test',
    license: 'CC-BY-4.0',
    provenance: 'Test fixture',
    created: '2026-01-01',
    domainPath: ['science', 'cons'],
    accent: 'gold',
    ...overrides,
  };
}

export function mcq(overrides: Partial<McqQuestion> = {}): McqQuestion {
  return {
    id: 'q-mcq-0001',
    pack: 'cons-pack',
    topic: 'iit',
    type: 'mcq',
    tier: 'foundational',
    tags: [],
    prompt: 'What does phi measure in integrated information theory?',
    options: [
      { text: 'Integrated information' },
      { text: 'Global broadcast' },
      { text: 'Higher-order representation' },
      { text: 'Neuron count' },
    ],
    answer: 0,
    explanation: 'Phi measures integrated information.',
    sources: [{ citation: 'Tononi 2004' }],
    status: 'draft',
    created: '2026-01-01',
    ...overrides,
  };
}

export function recall(overrides: Partial<RecallQuestion> = {}): RecallQuestion {
  return {
    id: 'q-recall-0001',
    pack: 'cons-pack',
    topic: 'gwt',
    type: 'recall',
    tier: 'foundational',
    tags: [],
    prompt: 'Who proposed global workspace theory?',
    answer_text: 'Bernard Baars',
    explanation: 'Baars, 1988.',
    sources: [{ citation: 'Baars 1988' }],
    status: 'draft',
    created: '2026-01-01',
    ...overrides,
  };
}

const base = {
  pack: 'cons-pack',
  topic: 'iit',
  tier: 'foundational' as const,
  tags: [],
  explanation: 'Because.',
  sources: [{ citation: 'Source 2020' }],
  status: 'draft' as const,
  created: '2026-01-01',
};

export function short(overrides: Partial<ShortQuestion> = {}): ShortQuestion {
  return {
    ...base,
    id: 'q-short-0001',
    type: 'short',
    prompt: 'Who proposed integrated information theory?',
    answers: ['Tononi', 'Giulio Tononi'],
    ...overrides,
  };
}

export function cloze(overrides: Partial<ClozeQuestion> = {}): ClozeQuestion {
  return {
    ...base,
    id: 'q-cloze-0001',
    type: 'cloze',
    prompt: 'Fill in the blanks.',
    text: 'IIT was proposed by {{Tononi}} in {{2004}}.',
    bank: ['Baars', '1988'],
    ...overrides,
  };
}

export function match(overrides: Partial<MatchQuestion> = {}): MatchQuestion {
  return {
    ...base,
    id: 'q-match-0001',
    type: 'match',
    prompt: 'Match each theory to its proponent.',
    pairs: [
      { left: 'IIT', right: 'Tononi' },
      { left: 'Global workspace', right: 'Baars' },
      { left: 'Higher-order thought', right: 'Rosenthal' },
    ],
    ...overrides,
  };
}

export function order(overrides: Partial<OrderQuestion> = {}): OrderQuestion {
  return {
    ...base,
    id: 'q-order-0001',
    type: 'order',
    prompt: 'Order these by year.',
    items: ['Nagel 1974', 'Jackson 1982', 'Chalmers 1995'],
    ...overrides,
  };
}

export function estimation(overrides: Partial<EstimationQuestion> = {}): EstimationQuestion {
  return {
    ...base,
    id: 'q-est-0001',
    type: 'estimation',
    prompt: 'About how many neurons are in the human brain?',
    value: 86e9,
    unit: 'neurons',
    scale: 'log',
    range: { min: 1e6, max: 1e13 },
    tolerance: 2,
    ...overrides,
  };
}

export function timeline(overrides: Partial<TimelineQuestion> = {}): TimelineQuestion {
  return {
    ...base,
    id: 'q-time-0001',
    type: 'timeline',
    prompt: 'Put these in date order.',
    events: [
      { label: 'Chalmers: the hard problem', date: '1995' },
      { label: 'Nagel: what is it like to be a bat?', date: '1974' },
      { label: 'Jackson: what Mary did not know', date: '1982' },
    ],
    ...overrides,
  };
}

/** Build a pack; questions are grouped into files by their topic. */
export function pack(
  questions: Question[],
  overrides: Partial<Omit<LoadedPack, 'questionFiles'>> = {},
): LoadedPack {
  const folder = overrides.folder ?? overrides.meta?.id ?? 'cons-pack';
  const byTopic = new Map<string, Question[]>();
  for (const q of questions) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q]);
  return {
    folder,
    meta: meta({ id: folder }),
    taxonomy: NODES,
    mediaFiles: [],
    bytes: 100,
    ...overrides,
    questionFiles: [...byTopic].map(([topic, qs]) => ({
      path: `${folder}/questions/${topic}.json`,
      topicFromName: topic,
      questions: qs,
    })),
  };
}

export function ledgerFor(...packs: LoadedPack[]): Record<string, string> {
  return Object.fromEntries(
    packs.flatMap((p) => p.questionFiles.flatMap((f) => f.questions.map((q) => [q.id, p.meta.id]))),
  );
}
