/**
 * Unit tests for `config/updateReview.ts`: one file's failure must not stop
 * the files after it (the Orun bug: validate.js failed, two READMEs after it
 * were never offered).
 */

import { describe, expect, it } from 'vitest';
import { reviewEachIsolated } from '../../src/config/updateReview';

const names = ['AGENTS.md', 'agents/world-builder.md', 'agents/script-writer.md', 'agents/initiator.md', 'agents/validate.js', 'world/README.md', 'scripts/README.md'];

describe('reviewEachIsolated', () => {
  it('still reviews the files after one that throws', async () => {
    const seen: string[] = [];
    const result = await reviewEachIsolated(
      names.map((relativePath) => ({ relativePath })),
      async (item) => {
        seen.push(item.relativePath);
        if (item.relativePath === 'agents/validate.js') throw new Error('diff failed');
      },
    );
    expect(seen).toEqual(names);
    expect(result.failed).toEqual([{ relativePath: 'agents/validate.js', message: 'diff failed' }]);
    expect(result.completed).toEqual(names.filter((n) => n !== 'agents/validate.js'));
  });

  it('reports non-Error throws and keeps order', async () => {
    const result = await reviewEachIsolated([{ relativePath: 'a' }, { relativePath: 'b' }], async (item) => {
      if (item.relativePath === 'a') throw 'boom';
    });
    expect(result.failed).toEqual([{ relativePath: 'a', message: 'boom' }]);
    expect(result.completed).toEqual(['b']);
  });

  it('handles an empty list', async () => {
    expect(await reviewEachIsolated([], async () => undefined)).toEqual({ completed: [], failed: [] });
  });
});
