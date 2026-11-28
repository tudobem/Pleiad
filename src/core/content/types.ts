/**
 * Content model types (SPEC 5 and 6). They mirror the JSON Schemas in
 * /schema; field names follow the SPEC (snake_case where it uses it).
 * Data reaching these types has already passed schema validation.
 */

export type NodeKind = 'domain' | 'subject' | 'branch' | 'topic';
export type Tier = 'foundational' | 'advanced' | 'expert';
export type QuestionStatus = 'draft' | 'verified' | 'retired';
export type QuestionType = Question['type'];

export const TIERS: readonly Tier[] = ['foundational', 'advanced', 'expert'];
export const STATUSES: readonly QuestionStatus[] = ['draft', 'verified', 'retired'];
export const QUESTION_TYPES: readonly QuestionType[] = [
  'mcq',
  'recall',
  'short',
  'cloze',
  'match',
  'order',
  'estimation',
  'timeline',
];

export interface PackMeta {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly version: string;
  readonly language: string;
  readonly author: string;
  readonly license: string;
  readonly provenance: string;
  readonly created: string;
  readonly domainPath: readonly string[];
  readonly accent: string;
}

export interface TaxonomyNode {
  readonly id: string;
  readonly label: string;
  readonly kind: NodeKind;
  readonly parent?: string;
  /**
   * Position among siblings, ascending (for example chronological or book
   * order). Nodes without one come after those with one, sorted by label.
   */
  readonly order?: number;
}

export interface Source {
  readonly citation: string;
  readonly url?: string;
}

export interface Deeper {
  readonly text?: string;
  readonly links?: readonly { readonly label: string; readonly url: string }[];
  readonly furtherReading?: readonly string[];
}

export interface Media {
  readonly src: string;
  readonly alt: string;
  readonly credit?: string;
  readonly license: string;
}

interface QuestionBase {
  readonly id: string;
  readonly pack: string;
  readonly topic: string;
  readonly tier: Tier;
  readonly tags: readonly string[];
  readonly prompt: string;
  readonly explanation: string;
  readonly sources: readonly Source[];
  readonly status: QuestionStatus;
  readonly created: string;
  readonly verified_on?: string;
  readonly deeper?: Deeper;
  readonly media?: readonly Media[];
  readonly confusable_with?: readonly string[];
  readonly concepts?: readonly string[];
  readonly prerequisites?: readonly string[];
  readonly lang?: string;
}

export interface McqOption {
  readonly text: string;
  readonly why_wrong?: string;
}

export interface McqQuestion extends QuestionBase {
  readonly type: 'mcq';
  readonly options: readonly McqOption[];
  /** Index into options of the single correct answer. */
  readonly answer: number;
}

export interface RecallQuestion extends QuestionBase {
  readonly type: 'recall';
  /** Short model answer shown on reveal. */
  readonly answer_text: string;
}

/** One word, term or number typed (or dictated); normalized comparison (SPEC 6). */
export interface ShortQuestion extends QuestionBase {
  readonly type: 'short';
  /** First is canonical; the rest are accepted variants. */
  readonly answers: readonly string[];
  readonly numeric?: { readonly value: number; readonly tolerance: number };
}

/** Sentence with blanks written as {{answer}}; filled by tapping chips. */
export interface ClozeQuestion extends QuestionBase {
  readonly type: 'cloze';
  readonly text: string;
  /** Distractor chips shown together with the answers. */
  readonly bank?: readonly string[];
}

/** Tap pairs; every pair must be right. */
export interface MatchQuestion extends QuestionBase {
  readonly type: 'match';
  readonly pairs: readonly { readonly left: string; readonly right: string }[];
}

/** Tap items into sequence; `items` is the correct order. */
export interface OrderQuestion extends QuestionBase {
  readonly type: 'order';
  readonly items: readonly string[];
}

/** A range to tap in an estimation question; `max` is exclusive. */
export interface EstimationBin {
  readonly min: number;
  readonly max: number;
  readonly label?: string;
}

/**
 * "Important numbers" (SPEC 6): tap a bin, or move a slider graded by
 * tolerance (a factor on a log scale, an amount on a linear one).
 */
export interface EstimationQuestion extends QuestionBase {
  readonly type: 'estimation';
  readonly value: number;
  /** Shown with numbers ("86 billion neurons"); left out for years. */
  readonly unit?: string;
  readonly scale: 'linear' | 'log';
  readonly bins?: readonly EstimationBin[];
  readonly range?: { readonly min: number; readonly max: number };
  readonly tolerance?: number;
}

export type DatePrecision = 'year' | 'month' | 'day';

/** Put events in date order (SPEC 6, "order by date"). */
export interface TimelineQuestion extends QuestionBase {
  readonly type: 'timeline';
  /** `date`: YYYY, YYYY-MM or YYYY-MM-DD; a leading - for BCE years. */
  readonly events: readonly { readonly label: string; readonly date: string }[];
  readonly precision?: DatePrecision;
}

export type Question =
  | McqQuestion
  | RecallQuestion
  | ShortQuestion
  | ClozeQuestion
  | MatchQuestion
  | OrderQuestion
  | EstimationQuestion
  | TimelineQuestion;

export interface ConceptNode {
  readonly id: string;
  readonly label: string;
  readonly summary?: string;
  readonly topic?: string;
}

export interface ConceptEdge {
  readonly from: string;
  readonly to: string;
  readonly relation: 'prerequisite' | 'related' | 'contrasts_with' | 'part_of';
}

export interface Concepts {
  readonly nodes: readonly ConceptNode[];
  readonly edges: readonly ConceptEdge[];
}

/** A question file as loaded: its path (for messages) and topic from the file name. */
export interface QuestionFile {
  readonly path: string;
  readonly topicFromName: string;
  readonly questions: readonly Question[];
}

/** One pack as read from disk and parsed (I/O happens outside core). */
export interface LoadedPack {
  /** Folder name; must equal meta.id. */
  readonly folder: string;
  readonly meta: PackMeta;
  readonly taxonomy: readonly TaxonomyNode[];
  readonly questionFiles: readonly QuestionFile[];
  readonly concepts?: Concepts;
  /** Media paths present on disk, relative to the pack folder (e.g. "media/x.png"). */
  readonly mediaFiles: readonly string[];
  /** Total bytes of the pack's JSON files (for the content index). */
  readonly bytes: number;
}

/** content/ids.json: every question ID ever registered, mapped to its pack. */
export type IdLedger = Readonly<Record<string, string>>;
