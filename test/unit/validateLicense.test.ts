/**
 * Unit tests for `validateLicense` (`src/licensing/validateLicense.ts`).
 * `fetch` is always a hand-written stub here — no live network calls.
 */

import { describe, it, expect, vi } from 'vitest';
import { validateLicense, LICENSE_ENDPOINT, LICENSE_PRODUCT_ID } from '../../src/licensing/validateLicense';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

describe('validateLicense', () => {
  it('sends the license key, product id, and device id in the request body', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse({ valid: true, tier: 'lifetime', revalidateAfter: '2026-09-01T00:00:00Z' })),
    );

    await validateLicense('KEY-123', 'device-abc', fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith(
      LICENSE_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ licenseKey: 'KEY-123', product: LICENSE_PRODUCT_ID, deviceId: 'device-abc' }),
      }),
    );
  });

  it('resolves a valid result with tier and revalidateAfter', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse({ valid: true, tier: 'annual', revalidateAfter: '2026-09-01T00:00:00Z' })),
    );

    const result = await validateLicense('KEY-123', 'device-abc', fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ valid: true, tier: 'annual', revalidateAfter: '2026-09-01T00:00:00Z' });
  });

  it('resolves an invalid result with a reason, without throwing', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ valid: false, reason: 'refunded' })));

    const result = await validateLicense('KEY-123', 'device-abc', fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ valid: false, reason: 'refunded' });
  });

  it('throws on a non-2xx response, so the caller treats it as unreachable', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ error: 'License service unavailable' }, false, 500)));

    await expect(validateLicense('KEY-123', 'device-abc', fetchImpl as unknown as typeof fetch)).rejects.toThrow(/500/);
  });

  it('throws when the response body does not match the documented shape', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ unexpected: 'shape' })));

    await expect(validateLicense('KEY-123', 'device-abc', fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      /unexpected response shape/,
    );
  });

  it('throws when a valid:true response is missing a required field', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ valid: true, tier: 'lifetime' })));

    await expect(validateLicense('KEY-123', 'device-abc', fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      /unexpected response shape/,
    );
  });
});
