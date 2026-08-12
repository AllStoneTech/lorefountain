/**
 * Unit tests for the pure date-math helpers in licenseState.ts, plus
 * `getOrCreateDeviceId` (the one function here simple enough to cover with a
 * hand-written `globalState` stub rather than a full `vscode` mock) — see
 * that module's doc comment on why the rest stays thin, vscode-facing glue.
 */

import { describe, it, expect } from 'vitest';
import { isCacheFresh, isWithinGrace, getOrCreateDeviceId } from '../../src/licensing/licenseState';
import type * as vscode from 'vscode';

function fakeContext(initial: Record<string, unknown> = {}): vscode.ExtensionContext {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    globalState: {
      get: (key: string) => store.get(key),
      update: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    },
  } as unknown as vscode.ExtensionContext;
}

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

describe('getOrCreateDeviceId', () => {
  it('generates and persists a device id on first use', async () => {
    const context = fakeContext();
    const id = await getOrCreateDeviceId(context);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(context.globalState.get('lorefountain.deviceId')).toBe(id);
  });

  it('returns the same id on subsequent calls instead of regenerating', async () => {
    const context = fakeContext({ 'lorefountain.deviceId': 'existing-id' });

    const first = await getOrCreateDeviceId(context);
    const second = await getOrCreateDeviceId(context);

    expect(first).toBe('existing-id');
    expect(second).toBe('existing-id');
  });
});
