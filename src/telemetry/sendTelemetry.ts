/**
 * Batches and sends locally-queued telemetry. Fire-and-forget by design:
 * never throws (a network failure here must never affect activation,
 * deactivation, or anything else), and the queue is only cleared on a
 * confirmed successful send — a failed attempt just leaves events queued
 * (already capped by `telemetryState.ts`) for the next opportunity, the
 * same "keep the last good state, don't lose anything on a network blip"
 * posture `licensing/licenseState.ts` uses for its offline-grace window.
 *
 * The endpoint doesn't exist yet (see `docs/TODO.md`) — every call here
 * will fail until `AllStoneTech.com` ships `POST /api/telemetry/ingest`,
 * and that's fine: events just keep queuing locally (capped) until it does,
 * same as `validateLicense.ts` before its own endpoint was live.
 *
 * `fetchImpl` is a parameter, not a module-level import, specifically so
 * unit tests can supply a stub instead of hitting the network — same
 * convention as `licensing/validateLicense.ts`. `isOptedIn` is a *required*
 * parameter with no default for a related but stricter reason: its only
 * real implementation (`telemetryConfig.ts`'s `isTelemetryOptedIn`) reads
 * live `vscode.env`/`vscode.workspace` globals, and even an unused default
 * *import* of it would drag that dependency into this file at module-load
 * time — defeating the point of keeping this module import-safe for the
 * unit suite (see `telemetryState.ts`'s doc comment for the same reasoning).
 * `extension.ts` — genuinely `vscode`-facing glue, never unit tested — is
 * the one real caller and always passes the genuine check explicitly.
 *
 * This module deliberately doesn't flush `events.ts`'s session-usage flags
 * itself, for the same reason: that would pull in `events.ts`'s own real
 * `vscode.env.appName` usage. Callers (`extension.ts`) call
 * `flushSessionUsageFlags` immediately before this function instead.
 */

import * as vscode from 'vscode';
import { clearQueuedEvents, getQueuedEvents } from './telemetryState';
import type { TelemetryEvent } from './eventBuilding';

type FetchLike = typeof fetch;

/** Where queued telemetry is sent — see this module's doc comment. */
export const TELEMETRY_ENDPOINT = 'https://allstonetech.com/api/telemetry/ingest';

/** How often a long-running session flushes its queue on its own, independent of activation/deactivation — 6 hours, so a session that never closes still reports periodically without polling aggressively. */
export const TELEMETRY_SEND_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Send everything currently queued in one batch. Never throws. Callers
 * should run `events.ts`'s `flushSessionUsageFlags` first if session-usage
 * flags (hover/completion) should be included in this batch.
 *
 * @param context - The extension context (for the local queue).
 * @param deviceId - This install's stable anonymous id (see `licensing/licenseState.ts`'s `getOrCreateDeviceId`).
 * @param isOptedIn - Whether telemetry is currently opted in — see this module's doc comment on why there's no default.
 * @param fetchImpl - Injectable `fetch`, defaults to the global one.
 * @returns `true` if the batch was sent and the queue cleared; `false` if there was nothing to send, or the send failed.
 */
export async function sendQueuedTelemetry(
  context: vscode.ExtensionContext,
  deviceId: string,
  isOptedIn: () => boolean,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  try {
    if (!isOptedIn()) {
      // Respect a since-opted-out user: don't hang onto (or send) whatever
      // queued up while telemetry was still enabled.
      await clearQueuedEvents(context);
      return false;
    }

    const events = getQueuedEvents<TelemetryEvent>(context);
    if (events.length === 0) return false;

    const response = await fetchImpl(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, events }),
    });
    if (!response.ok) return false;

    await clearQueuedEvents(context);
    return true;
  } catch {
    return false;
  }
}
