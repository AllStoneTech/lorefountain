/**
 * Feedback submission — distinct from `events.ts`/`sendTelemetry.ts` on
 * purpose. Telemetry is passive, anonymous, and silently no-ops when
 * disabled; feedback is explicit and user-composed (free text the user
 * chose to type and submit), so it doesn't share telemetry's opt-in gate —
 * it's the same posture as "contacting support," not "background usage
 * tracking" — and a failed submission must be surfaced to the user (the
 * caller shows an error and lets them retry) rather than silently dropped.
 *
 * `feedbackFormMessageSchema` validates what the feedback webview posts
 * back to the extension host — a real external-input boundary (Section 5 of
 * this project's coding standards), same as any other `postMessage` payload
 * from a webview.
 */

import { z } from 'zod';

/** Where feedback is submitted — the AllStoneTech.com endpoint mirroring `licensing/validateLicense.ts`'s `LICENSE_ENDPOINT`. */
export const FEEDBACK_ENDPOINT = 'https://allstonetech.com/api/feedback/submit';

const feedbackTypeSchema = z.enum(['bug', 'suggestion', 'general']);
export type FeedbackType = z.infer<typeof feedbackTypeSchema>;

/** What the feedback webview's form posts back — validated here rather than trusted, since a webview message is untrusted input just like any other extension-host boundary. */
export const feedbackFormMessageSchema = z.object({
  type: feedbackTypeSchema,
  body: z.string().trim().min(1, 'Enter a message before submitting.').max(4000),
  email: z.union([z.literal(''), z.string().trim().email()]).optional(),
});
export type FeedbackFormMessage = z.infer<typeof feedbackFormMessageSchema>;

/** The full payload sent to {@link FEEDBACK_ENDPOINT} — a validated form message plus context for triage. */
const feedbackPayloadSchema = z.object({
  deviceId: z.string().uuid(),
  type: feedbackTypeSchema,
  body: z.string().min(1),
  email: z.string().email().optional(),
  tier: z.enum(['free', 'pro']),
  extensionVersion: z.string().min(1),
  platform: z.string().min(1),
});
export type FeedbackPayload = z.infer<typeof feedbackPayloadSchema>;

type FetchLike = typeof fetch;

/**
 * Build the full submission payload from a validated form message plus
 * environment context. Pure — safe and cheap to unit test directly.
 *
 * @param form - The already-validated form message.
 * @param deviceId - This install's stable anonymous id.
 * @param tier - This session's license tier.
 * @param extensionVersion - This build's version.
 * @param platform - `process.platform`.
 * @returns The full payload for {@link submitFeedback}.
 */
export function buildFeedbackPayload(
  form: FeedbackFormMessage,
  deviceId: string,
  tier: 'free' | 'pro',
  extensionVersion: string,
  platform: string,
): FeedbackPayload {
  const trimmedEmail = form.email?.trim();
  return {
    deviceId,
    type: form.type,
    body: form.body,
    email: trimmedEmail ? trimmedEmail : undefined,
    tier,
    extensionVersion,
    platform,
  };
}

/**
 * Submit one feedback entry. Unlike telemetry, this is explicit and
 * user-initiated, so a failure is surfaced rather than silently dropped —
 * this throws on failure so the caller can show an error and let the user
 * retry, the same convention `licensing/validateLicense.ts` uses.
 *
 * @param payload - The feedback to submit.
 * @param fetchImpl - Injectable `fetch`, defaults to the global one.
 * @throws If the request fails outright or the endpoint responds with a non-2xx status.
 */
export async function submitFeedback(payload: FeedbackPayload, fetchImpl: FetchLike = fetch): Promise<void> {
  const validated = feedbackPayloadSchema.parse(payload);
  const response = await fetchImpl(FEEDBACK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validated),
  });
  if (!response.ok) {
    throw new Error(`Feedback endpoint returned ${response.status}`);
  }
}
