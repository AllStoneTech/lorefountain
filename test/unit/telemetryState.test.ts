/**
 * Unit tests for the pure queue-cap logic in `telemetryState.ts` — see that
 * module's doc comment for why the rest (globalState/config-backed glue)
 * stays untested here, same posture as `licenseState.ts`.
 */

import { describe, it, expect } from 'vitest';
import { appendCapped } from '../../src/telemetry/telemetryState';

describe('appendCapped', () => {
  it('appends when under the cap', () => {
    expect(appendCapped([1, 2], 3, 5)).toEqual([1, 2, 3]);
  });

  it('appends up to exactly the cap without dropping anything', () => {
    expect(appendCapped([1, 2], 3, 3)).toEqual([1, 2, 3]);
  });

  it('drops the oldest entry once the cap is exceeded', () => {
    expect(appendCapped([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  it('drops multiple oldest entries if the queue was already over cap', () => {
    expect(appendCapped([1, 2, 3, 4, 5], 6, 2)).toEqual([5, 6]);
  });

  it('handles an empty queue', () => {
    expect(appendCapped([], 1, 5)).toEqual([1]);
  });
});
