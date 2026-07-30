/**
 * Canary test for the temporary validateLicense stub (see that module's doc
 * comment) — fails loudly if someone starts editing the stub's behavior
 * without also updating/removing this test, since the whole point is that
 * every caller currently assumes "always valid."
 */

import { describe, it, expect } from 'vitest';
import { validateLicense } from '../../src/licensing/validateLicense';

describe('validateLicense (stub)', () => {
  it('always resolves valid, regardless of the key given', async () => {
    const result = await validateLicense('literally-anything');
    expect(result.valid).toBe(true);
    expect(result.tier).toBe('pro');
  });

  it('sets a future revalidateAfter timestamp', async () => {
    const before = Date.now();
    const result = await validateLicense('key');
    expect(result.revalidateAfter).toBeDefined();
    expect(new Date(result.revalidateAfter as string).getTime()).toBeGreaterThan(before);
  });
});
