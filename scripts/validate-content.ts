/**
 * Content validator entry point (`npm run validate:content`).
 *
 * M0 stub: confirms the packs directory exists and reports what is there.
 * Schema and rule checks (SPEC 5.5) are implemented in M1.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packsDir = fileURLToPath(new URL('../content/packs', import.meta.url));

if (!existsSync(packsDir)) {
  console.error(`validate:content: missing directory ${packsDir}`);
  process.exit(1);
}

const packs = readdirSync(packsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
const withoutManifest = packs.filter((p) => !existsSync(join(packsDir, p.name, 'pack.json')));

console.log(`validate:content: ${packs.length} pack(s) found.`);
if (withoutManifest.length > 0) {
  console.error(
    `validate:content: pack folder(s) without pack.json: ${withoutManifest.map((p) => p.name).join(', ')}`,
  );
  process.exit(1);
}
console.log('validate:content: OK (full schema validation arrives in M1).');
