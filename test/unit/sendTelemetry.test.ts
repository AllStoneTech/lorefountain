/**
 * Unit tests for `sendQueuedTelemetry` (`src/telemetry/sendTelemetry.ts`).
 * `fetch` and the opted-in check are both hand-written stubs — no live
 * network calls, and no dependency on real `vscode.env`/`vscode.workspace`
 * globals (see that module's doc comment on why `isOptedIn` has no default).
 */

import { describe, it, expect, vi } from 'vitest';
import { sendQueuedTelemetry, TELEMETRY_ENDPOINT } from '../../src/telemetry/sendTelemetry';
import type * as vscode from 'vscode';

function fakeContext(initial: Record<string, unknown> = {}): vscode.ExtensionContext {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    globalState: {
      get: (key: string, fallback?: unknown) => (store.has(key) ? store.get(key) : fallback),
      update: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    },
  } as unknown as vscode.ExtensionContext;
}

function okResponse(): Response {
  return { ok: true, status: 200 } as Response;
}

const sampleEvent = {
  event: 'lorefountain.newCharacter',
  tier: 'free' as const,
  timestamp: '2026-08-12T00:00:00.000Z',
  extensionVersion: '0.11.0',
  editorProduct: 'vscode' as const,
  platform: 'win32' as const,
};

describe('sendQueuedTelemetry', () => {
  it('does nothing and clears the queue when not opted in', async () => {
    const context = fakeContext({ 'lorefountain.telemetry.queue': [sampleEvent] });
    const fetchImpl = vi.fn();

    const sent = await sendQueuedTelemetry(context, 'device-abc', () => false, fetchImpl as unknown as typeof fetch);

    expect(sent).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(context.globalState.get('lorefountain.telemetry.queue')).toEqual([]);
  });

  it('does nothing (and never calls fetch) when the queue is empty', async () => {
    const context = fakeContext();
    const fetchImpl = vi.fn();

    const sent = await sendQueuedTelemetry(context, 'device-abc', () => true, fetchImpl as unknown as typeof fetch);

    expect(sent).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends the queue as one batch and clears it on success', async () => {
    const context = fakeContext({ 'lorefountain.telemetry.queue': [sampleEvent] });
    const fetchImpl = vi.fn(() => Promise.resolve(okResponse()));

    const sent = await sendQueuedTelemetry(context, 'device-abc', () => true, fetchImpl as unknown as typeof fetch);

    expect(sent).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      TELEMETRY_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ deviceId: 'device-abc', events: [sampleEvent] }),
      }),
    );
    expect(context.globalState.get('lorefountain.telemetry.queue')).toEqual([]);
  });

  it('leaves the queue intact when the endpoint responds with a non-2xx status', async () => {
    const context = fakeContext({ 'lorefountain.telemetry.queue': [sampleEvent] });
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: false, status: 500 } as Response));

    const sent = await sendQueuedTelemetry(context, 'device-abc', () => true, fetchImpl as unknown as typeof fetch);

    expect(sent).toBe(false);
    expect(context.globalState.get('lorefountain.telemetry.queue')).toEqual([sampleEvent]);
  });

  it('leaves the queue intact and never throws when fetch itself rejects', async () => {
    const context = fakeContext({ 'lorefountain.telemetry.queue': [sampleEvent] });
    const fetchImpl = vi.fn(() => Promise.reject(new Error('network down')));

    const sent = await sendQueuedTelemetry(context, 'device-abc', () => true, fetchImpl as unknown as typeof fetch);

    expect(sent).toBe(false);
    expect(context.globalState.get('lorefountain.telemetry.queue')).toEqual([sampleEvent]);
  });
});
