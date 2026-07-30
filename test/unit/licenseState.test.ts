/**
 * Unit tests for the pure date-math helpers in licenseState.ts — the parts
 * worth testing without a vscode.ExtensionContext mock (see that module's
 * doc comment on why the rest stays thin, vscode-facing glue).
 */

import { describe, it, expect } from 'vitest';
import { isCacheFresh, isWithinGrace } from '../../src/licensing/licenseState';

describe('isCacheFresh', () => {
  const now = new Date('2026-07-28T00:00:00Z');

  it('is fresh when revalidateAfter is in the future', () => {
    expect(isCacheFresh({ revalidateAfter: '2026-08-01T00:00:00Z' }, now)).toBe(true);
  });

  it('is stale when revalidateAfter is in the past', () => {
    expect(isCacheFresh({ revalidateAfter: '2026-07-01T00:00:00Z' }, now)).toBe(false);
  });

  it('is stale when there is no cached entry at all', () => {
    expect(isCacheFresh(undefined, now)).toBe(false);
  });

  it('is stale when revalidateAfter was never set', () => {
    expect(isCacheFresh({ revalidateAfter: undefined }, now)).toBe(false);
  });
});

describe('isWithinGrace', () => {
  const now = new Date('2026-07-28T00:00:00Z');

  it('is within grace for a result validated a few days ago', () => {
    expect(isWithinGrace({ validatedAt: '2026-07-20T00:00:00Z' }, now)).toBe(true);
  });

  it('is not within grace once the 30-day offline window has passed', () => {
    expect(isWithinGrace({ validatedAt: '2026-06-01T00:00:00Z' }, now)).toBe(false);
  });

  it('is not within grace when there is no cached entry at all', () => {
    expect(isWithinGrace(undefined, now)).toBe(false);
  });
});
