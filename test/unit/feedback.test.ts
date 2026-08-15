/**
 * Unit tests for `feedback.ts`: payload construction, form-message
 * validation, and `submitFeedback` (hand-written `fetch` stub, no live
 * network calls — same convention as `licensing/validateLicense.ts`).
 */

import { describe, it, expect, vi } from 'vitest';
import { buildFeedbackPayload, feedbackFormMessageSchema, submitFeedback, FEEDBACK_ENDPOINT } from '../../src/telemetry/feedback';

function jsonResponse(ok = true, status = 200): Response {
  return { ok, status } as Response;
}

describe('feedbackFormMessageSchema', () => {
  it('accepts a well-formed message with no email', () => {
    const result = feedbackFormMessageSchema.safeParse({ type: 'bug', body: 'Something broke.' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty-string email (the form field left blank)', () => {
    const result = feedbackFormMessageSchema.safeParse({ type: 'general', body: 'Hello.', email: '' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid email', () => {
    const result = feedbackFormMessageSchema.safeParse({ type: 'suggestion', body: 'Idea!', email: 'writer@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(feedbackFormMessageSchema.safeParse({ type: 'bug', body: '' }).success).toBe(false);
  });

  it('rejects a body that is only whitespace', () => {
    expect(feedbackFormMessageSchema.safeParse({ type: 'bug', body: '   ' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(feedbackFormMessageSchema.safeParse({ type: 'bug', body: 'x', email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects an unrecognized type', () => {
    expect(feedbackFormMessageSchema.safeParse({ type: 'complaint', body: 'x' }).success).toBe(false);
  });
});

describe('buildFeedbackPayload', () => {
  it('omits email when the form left it blank', () => {
    const payload = buildFeedbackPayload({ type: 'bug', body: 'Broken.' }, 'device-abc', 'free', '0.11.0', 'win32');
    expect(payload.email).toBeUndefined();
  });

  it('trims and includes email when provided', () => {
    const payload = buildFeedbackPayload(
      { type: 'suggestion', body: 'Idea.', email: '  writer@example.com  ' },
      'device-abc',
      'pro',
      '0.11.0',
      'darwin',
    );
    expect(payload.email).toBe('writer@example.com');
  });

  it('carries through device id, tier, version, and platform', () => {
    const payload = buildFeedbackPayload({ type: 'general', body: 'Thoughts.' }, 'device-xyz', 'pro', '0.12.0', 'linux');
    expect(payload).toMatchObject({
      deviceId: 'device-xyz',
      type: 'general',
      body: 'Thoughts.',
      tier: 'pro',
      extensionVersion: '0.12.0',
      platform: 'linux',
    });
  });
});

describe('submitFeedback', () => {
  const payload = {
    deviceId: '123e4567-e89b-12d3-a456-426614174000',
    type: 'bug' as const,
    body: 'Something broke.',
    tier: 'free' as const,
    extensionVersion: '0.11.0',
    platform: 'win32',
  };

  it('POSTs the validated payload to the feedback endpoint', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse()));

    await submitFeedback(payload, fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith(
      FEEDBACK_ENDPOINT,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
    );
  });

  it('resolves silently on a 2xx response', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse()));
    await expect(submitFeedback(payload, fetchImpl as unknown as typeof fetch)).resolves.toBeUndefined();
  });

  it('throws on a non-2xx response', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(false, 500)));
    await expect(submitFeedback(payload, fetchImpl as unknown as typeof fetch)).rejects.toThrow(/500/);
  });

  it('throws if the payload does not match the schema (caller bug, not user input)', async () => {
    const fetchImpl = vi.fn();
    const badPayload = { ...payload, deviceId: 'not-a-uuid' };
    await expect(submitFeedback(badPayload, fetchImpl as unknown as typeof fetch)).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
