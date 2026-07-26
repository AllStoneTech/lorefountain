/**
 * Vitest configuration for pure-logic unit tests (model, parsing, index).
 *
 * These tests exercise code with no `vscode` dependency. Editor-integration
 * behavior is covered separately by @vscode/test-electron in later phases.
 *
 * Also picks up `pro/test/**` — the private `lorefountain-pro` submodule's
 * own pure-logic tests, run from here since that repo has no vitest/
 * node_modules of its own (see its README). A glob matching nothing (pro/
 * absent) is not an error; `test/unit/**` alone is always enough matches
 * to avoid vitest's "no test files found" failure.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts', 'pro/test/**/*.test.ts'],
    environment: 'node',
  },
});
