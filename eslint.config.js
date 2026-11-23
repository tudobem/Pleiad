// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

/**
 * Layering rules (SPEC 3.2, CLAUDE.md). Exported so the layering test can
 * assert each one fires.
 */
export const coreRestrictedImports = {
  patterns: [
    {
      group: ['**/platform', '**/platform/**', '**/ui', '**/ui/**', '**/app', '**/app/**'],
      message: 'src/core must not import from platform, ui or app.',
    },
    {
      group: ['preact', 'preact/**', 'idb', 'idb/**', 'node:*'],
      message: 'src/core is pure TypeScript: no UI, storage or Node libraries.',
    },
  ],
};

export const coreRestrictedGlobals = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'XMLHttpRequest',
  'location',
  'history',
  'performance',
  'requestAnimationFrame',
  'process',
].map((name) => ({ name, message: `src/core must not use the browser/runtime global "${name}".` }));

export const coreRestrictedSyntax = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'No Date.now() in src/core: use the injected Clock.',
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'No argument-less new Date() in src/core: use the injected Clock.',
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: 'No Math.random() in src/core: use the injected Random.',
  },
];

export default tseslint.config(
  { ignores: ['dist/', 'dev-dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    ignores: ['src/core/**/*.test.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': ['error', coreRestrictedImports],
      'no-restricted-globals': ['error', ...coreRestrictedGlobals],
      'no-restricted-syntax': ['error', ...coreRestrictedSyntax],
    },
  },
  {
    files: ['src/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ui', '**/ui/**', '**/app', '**/app/**'],
              message: 'src/platform must not import from ui or app.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['idb', 'idb/**'],
              message: 'UI never touches IndexedDB directly; go through StorageAdapter.',
            },
            {
              group: ['**/platform', '**/platform/**'],
              message: 'src/ui talks to core interfaces; adapters are wired in src/app.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.ts', 'src/**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
