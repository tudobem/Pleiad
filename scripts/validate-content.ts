/**
 * `npm run validate:content`: schema checks, semantic rules (SPEC 5.5) and a
 * count report (SPEC 5.6). Exits 1 on any error.
 */
import { loadContent, formatIssues } from './lib/content.ts';
import { validateContent } from '../src/core/content/validate.ts';
import { countContent, formatReport } from '../src/core/content/report.ts';

const loaded = loadContent();
const issues = [...loaded.issues];
if (issues.length === 0) {
  const result = validateContent({
    packs: loaded.packs,
    ...(loaded.ledger ? { ledger: loaded.ledger } : {}),
    accentTokens: loaded.accentTokens,
  });
  issues.push(...result.issues);
}

console.log(formatReport(countContent(loaded.packs)));

const errors = issues.filter((i) => i.level === 'error').length;
const warnings = issues.length - errors;
if (issues.length > 0) console.log(`\nIssues\n${formatIssues(issues)}`);
console.log(`\nvalidate:content: ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors > 0 ? 1 : 0);
