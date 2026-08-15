/**
 * Telemetry recording — the `vscode`-facing glue half of event handling.
 * `eventBuilding.ts` holds the pure schema/construction logic (kept
 * import-safe for the unit suite); this file is what actually reads live
 * `vscode.env`/`context` values and writes to the local queue, so it isn't
 * unit tested directly, same posture as `commands/licensing.ts`. Re-exports
 * `eventBuilding.ts`'s public surface so every existing call site
 * (`providers/hoverProvider.ts`, `telemetry/trackedCommands.ts`, etc.) can
 * keep importing from `'../telemetry/events'` unchanged.
 */

import * as vscode from 'vscode';
import { isTelemetryOptedIn } from './telemetryConfig';
import { queueEventIfOptedIn } from './telemetryState';
import { buildTelemetryEvent, takeSessionUsageFlags } from './eventBuilding';

export * from './eventBuilding';

/**
 * Record one telemetry event, queuing it locally if (and only if) the user
 * has opted in. No-ops instantly and never throws otherwise — this must
 * never be able to affect the command/feature it's attached to.
 *
 * @param context - The extension context (for the local queue).
 * @param eventName - A stable identifier for what happened.
 */
export async function recordEvent(context: vscode.ExtensionContext, eventName: string): Promise<void> {
  try {
    const event = buildTelemetryEvent(
      eventName,
      String(context.extension.packageJSON.version ?? '0.0.0'),
      vscode.env.appName,
      process.platform,
    );
    await queueEventIfOptedIn(context, event, isTelemetryOptedIn);
  } catch {
    // Never let telemetry recording take down whatever it's attached to.
  }
}

/**
 * Convert this session's `markFeatureUsedThisSession` flags
 * (`eventBuilding.ts`) into real queued events, then clear them. Called
 * right before a send (`sendTelemetry.ts`, via `extension.ts`), never from
 * the hot path that sets the flags.
 *
 * @param context - The extension context (for the local queue).
 */
export async function flushSessionUsageFlags(context: vscode.ExtensionContext): Promise<void> {
  for (const feature of takeSessionUsageFlags()) {
    await recordEvent(context, `${feature}.usedThisSession`);
  }
}
