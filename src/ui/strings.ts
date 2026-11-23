/**
 * All user-facing UI strings, keyed by ID (SPEC 3.4). Components never inline
 * copy. English only in v1. Tone: short, warm, plain (DESIGN.md 6).
 */
export const strings = {
  'app.name': 'Pleiad',
  'shell.overline': 'Coming together',
  'shell.tagline': 'A calm place to remember what matters to you.',
  'shell.status': 'This is an early version. Questions arrive in a later update.',
} as const;

export type StringId = keyof typeof strings;

export function t(id: StringId): string {
  return strings[id];
}
