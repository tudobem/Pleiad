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
export const QUESTION_TYPES: readonly QuestionType[] = ['mcq', 'recall'];

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

export type Question = McqQuestion | RecallQuestion;

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
