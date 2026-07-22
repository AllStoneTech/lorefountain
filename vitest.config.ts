/**
 * Vitest configuration for pure-logic unit tests (model, parsing, index).
 *
 * These tests exercise code with no `vscode` dependency. Editor-integration
 * behavior is covered separately by @vscode/test-electron in later phases.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
  },
});
