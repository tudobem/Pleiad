/**
 * File-system side of the content pipeline: read packs, parse JSON, run the
 * JSON Schemas (ajv). Semantic rules live in src/core/content.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import { issue, type Issue } from '../../src/core/content/issues.ts';
import type {
  Concepts,
  IdLedger,
  LoadedPack,
  PackMeta,
  QuestionFile,
  TaxonomyNode,
} from '../../src/core/content/types.ts';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

export interface ContentPaths {
  readonly root: string;
  readonly packsDir: string;
  readonly ledgerFile: string;
  readonly schemaDir: string;
  readonly tokensFile: string;
}

export function contentPaths(root = ROOT): ContentPaths {
  return {
    root,
    packsDir: join(root, 'content', 'packs'),
    ledgerFile: join(root, 'content', 'ids.json'),
    schemaDir: join(root, 'schema'),
    tokensFile: join(root, 'src', 'ui', 'tokens.css'),
  };
}

export interface LoadResult {
  readonly packs: LoadedPack[];
  readonly ledger: IdLedger | undefined;
  readonly accentTokens: ReadonlySet<string>;
  /** Parse and schema errors. If non-empty, semantic checks should not run. */
  readonly issues: Issue[];
}

type SchemaName = 'pack' | 'taxonomy' | 'questions-file' | 'concepts' | 'id-ledger';

function loadSchemas(schemaDir: string): Record<SchemaName, ValidateFunction> {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const file of readdirSync(schemaDir).filter((f) => f.endsWith('.schema.json'))) {
    ajv.addSchema(JSON.parse(readFileSync(join(schemaDir, file), 'utf8')) as object, file);
  }
  const get = (name: SchemaName): ValidateFunction => {
    const fn = ajv.getSchema(`${name}.schema.json`);
    if (!fn) throw new Error(`Schema ${name}.schema.json not found in ${schemaDir}`);
    return fn;
  };
  return {
    pack: get('pack'),
    taxonomy: get('taxonomy'),
    'questions-file': get('questions-file'),
    concepts: get('concepts'),
    'id-ledger': get('id-ledger'),
  };
}

/** Color token names (without "--") declared in tokens.css. */
export function readTokenNames(tokensFile: string): Set<string> {
  const css = readFileSync(tokensFile, 'utf8');
  return new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1] ?? ''));
}

export function loadContent(paths: ContentPaths = contentPaths()): LoadResult {
  const schemas = loadSchemas(paths.schemaDir);
  const issues: Issue[] = [];
  const rel = (abs: string): string => relative(paths.packsDir, abs);

  const readJson = <T>(
    abs: string,
    schema: SchemaName,
  ): { value: T; bytes: number } | undefined => {
    let text: string;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      issues.push(issue('error', 'file.missing', rel(abs), 'File is missing.'));
      return undefined;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (e) {
      issues.push(issue('error', 'file.json', rel(abs), `Invalid JSON: ${(e as Error).message}`));
      return undefined;
    }
    const validate = schemas[schema];
    if (!validate(value)) {
      for (const error of validate.errors ?? []) {
        const where = error.instancePath || '(root)';
        issues.push(
          issue('error', 'schema', rel(abs), `${where} ${error.message ?? 'is invalid'}`),
        );
      }
      return undefined;
    }
    return { value: value as T, bytes: Buffer.byteLength(text) };
  };

  const packs: LoadedPack[] = [];
  const folders = existsSync(paths.packsDir)
    ? readdirSync(paths.packsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];

  for (const folder of folders) {
    const dir = join(paths.packsDir, folder);
    const meta = readJson<PackMeta>(join(dir, 'pack.json'), 'pack');
    const taxonomy = readJson<{ nodes: TaxonomyNode[] }>(join(dir, 'taxonomy.json'), 'taxonomy');
    let bytes = (meta?.bytes ?? 0) + (taxonomy?.bytes ?? 0);

    const questionFiles: QuestionFile[] = [];
    const questionsDir = join(dir, 'questions');
    if (existsSync(questionsDir)) {
      for (const name of readdirSync(questionsDir).sort()) {
        if (!name.endsWith('.json')) {
          issues.push(
            issue(
              'error',
              'file.unexpected',
              rel(join(questionsDir, name)),
              'Only .json files belong in questions/.',
            ),
          );
          continue;
        }
        const abs = join(questionsDir, name);
        const parsed = readJson<{ questions: QuestionFile['questions'] }>(abs, 'questions-file');
        if (!parsed) continue;
        bytes += parsed.bytes;
        questionFiles.push({
          path: rel(abs),
          topicFromName: name.slice(0, -'.json'.length),
          questions: parsed.value.questions,
        });
      }
    }

    let concepts: Concepts | undefined;
    const conceptsFile = join(dir, 'concepts.json');
    if (existsSync(conceptsFile)) {
      const parsed = readJson<Concepts>(conceptsFile, 'concepts');
      if (parsed) {
        concepts = parsed.value;
        bytes += parsed.bytes;
      }
    }

    const mediaDir = join(dir, 'media');
    const mediaFiles = existsSync(mediaDir) ? listFiles(mediaDir).map((f) => relative(dir, f)) : [];

    if (meta && taxonomy) {
      packs.push({
        folder,
        meta: meta.value,
        taxonomy: taxonomy.value.nodes,
        questionFiles,
        ...(concepts ? { concepts } : {}),
        mediaFiles,
        bytes,
      });
    }
  }

  let ledger: IdLedger | undefined;
  if (existsSync(paths.ledgerFile)) {
    ledger = readJson<{ ids: IdLedger }>(paths.ledgerFile, 'id-ledger')?.value.ids;
  } else {
    issues.push(
      issue(
        'error',
        'file.missing',
        'ids.json',
        'content/ids.json is missing. Run: npm run content:register',
      ),
    );
  }

  return { packs, ledger, accentTokens: readTokenNames(paths.tokensFile), issues };
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    return statSync(abs).isDirectory() ? listFiles(abs) : [abs];
  });
}

export function formatIssues(issues: readonly Issue[]): string {
  return [...issues]
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))
    .map(
      (i) =>
        `  ${i.level === 'error' ? 'ERROR' : 'warn '} ${i.file}${i.id ? ` [${i.id}]` : ''}: ${i.message} (${i.code})`,
    )
    .join('\n');
}
