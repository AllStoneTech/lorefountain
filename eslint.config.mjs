// Flat ESLint configuration for the LoreFountain extension.
// Uses the typescript-eslint recommended rule set plus a few project
// conventions aligned with the repository coding standards (single quotes,
// semicolons, discourage `any`).

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'out/', 'node_modules/', '.vscode-test/', 'resources/agents/validate.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      semi: ['error', 'always'],
      quotes: ['error', 'single', { avoidEscape: true }],
    },
  },
  {
    // Node-based build/config scripts (CommonJS), not part of the bundle.
    files: ['esbuild.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        console: 'readonly',
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
