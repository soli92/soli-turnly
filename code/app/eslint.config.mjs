import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import tsParser from '@typescript-eslint/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Files excluded from all linting (non-TS configs and Next.js generated files)
  {
    ignores: ['eslint.config.mjs', 'postcss.config.js', 'next-env.d.ts', '.next/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // languageOptions with parserOptions.project is required for typed rules
    // (no-floating-promises, no-misused-promises) — without this ESLint crashes.
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce consistent imports
      'import/no-default-export': 'off',
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // Console usage
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      // Accessibility
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-props': 'error',
    },
  },
  // Playwright test fixtures use a `use` callback that react-hooks/rules-of-hooks
  // incorrectly identifies as a React Hook invocation.
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];

export default eslintConfig;
