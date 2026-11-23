/** In-memory content fixtures for unit tests. Not shipped. */
import type {
  LoadedPack,
  McqQuestion,
  PackMeta,
  Question,
  RecallQuestion,
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
