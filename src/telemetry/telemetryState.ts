/**
 * Local telemetry state: the queued-but-unsent event batch and the "have we
 * asked yet" consent flag, both in `globalState`, the queue capped so an
 * extended offline stretch can never grow this unbounded
 * ({@link MAX_QUEUE_SIZE}, oldest events dropped first).
 *
 * The current session's license tier is tracked in a plain module variable
 * rather than re-derived per event — `extension.ts` sets it once, right
 * after the real pro-tier activation decision is made, so `events.ts`'s
 * `recordEvent` never needs an async lookup of its own on a hot path.
 *
 * Deliberately free of any real `vscode.env`/`vscode.workspace` runtime
 * call — only `context.globalState`, whose type comes from `vscode` but
 * whose calls don't touch the module at runtime — so this file's own
 * `vscode` import is fully type-only and stays elided from the bundle
 * `esbuild`/`vitest` produce, keeping it safely importable from the unit
 * suite without a `vscode` mock (see `telemetryConfig.ts`, which holds the
 * one function that genuinely needs live `vscode` globals, kept out of this
 * file specifically so it doesn't drag this one down with it).
 */

import * as vscode from 'vscode';

const TELEMETRY_QUEUE_KEY = 'lorefountain.telemetry.queue';
const TELEMETRY_PROMPTED_KEY = 'lorefountain.telemetry.prompted';

/** Hard cap on locally-queued, unsent events — oldest dropped first once exceeded, so an extended offline/disabled-endpoint stretch can't grow this file without bound. */
export const MAX_QUEUE_SIZE = 200;

export type TelemetryTier = 'free' | 'pro';

let sessionTier: TelemetryTier = 'free';

/**
 * Record this session's license tier, so {@link import('./events').recordEvent}
 * can read it synchronously instead of re-checking license state per event.
 *
 * @param tier - `'pro'` once the real pro tier (or the public-launch promo) is actually active; `'free'` otherwise.
 */
export function setSessionTier(tier: TelemetryTier): void {
  sessionTier = tier;
}

/** The current session's license tier, as last set by {@link setSessionTier}. */
export function getSessionTier(): TelemetryTier {
  return sessionTier;
}

/**
 * Append an item to a queue, dropping the oldest entries once `cap` is
 * exceeded. Pure — the one piece of this module worth unit testing directly.
 *
 * @param queue - The existing queue, oldest first.
 * @param item - The item to append.
 * @param cap - The maximum queue length to retain.
 * @returns A new array with `item` appended, trimmed to `cap` from the front if needed.
 */
export function appendCapped<T>(queue: readonly T[], item: T, cap: number): T[] {
  const next = [...queue, item];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/**
 * Whether the one-time consent prompt has already been shown and answered.
 *
 * @param context - The extension context.
 */
export function hasPromptedForTelemetry(context: vscode.ExtensionContext): boolean {
  return context.globalState.get<boolean>(TELEMETRY_PROMPTED_KEY, false);
}

/**
 * Mark the consent prompt as shown (or, after "Learn More", reset it so the
 * next activation asks again, since the user didn't actually answer yes/no).
 *
 * @param context - The extension context.
 * @param prompted - `true` once genuinely answered; `false` to ask again next activation.
 */
export async function setPromptedForTelemetry(context: vscode.ExtensionContext, prompted: boolean): Promise<void> {
  await context.globalState.update(TELEMETRY_PROMPTED_KEY, prompted);
}

/**
 * Read the locally-queued, unsent telemetry events.
 *
 * @param context - The extension context.
 */
export function getQueuedEvents<T>(context: vscode.ExtensionContext): T[] {
  return context.globalState.get<T[]>(TELEMETRY_QUEUE_KEY, []);
}

/**
 * Append one event to the queue (capped at {@link MAX_QUEUE_SIZE}), or no-op
 * if telemetry isn't currently opted in.
 *
 * `isOptedIn` has no default here on purpose — its only real implementation
 * (`telemetryConfig.ts`'s `isTelemetryOptedIn`) touches live `vscode`
 * globals, and even an unused default *import* would drag that dependency
 * into this file, defeating the whole point of keeping it out (see this
 * module's doc comment). `events.ts`'s `recordEvent` is the one real caller
 * and always passes the genuine check explicitly.
 *
 * @param context - The extension context.
 * @param event - The event to queue.
 * @param isOptedIn - Whether telemetry is currently opted in.
 */
export async function queueEventIfOptedIn<T>(context: vscode.ExtensionContext, event: T, isOptedIn: () => boolean): Promise<void> {
  if (!isOptedIn()) return;
  const queue = getQueuedEvents<T>(context);
  await context.globalState.update(TELEMETRY_QUEUE_KEY, appendCapped(queue, event, MAX_QUEUE_SIZE));
}

/**
 * Empty the queue — called after a confirmed successful send.
 *
 * @param context - The extension context.
 */
export async function clearQueuedEvents(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(TELEMETRY_QUEUE_KEY, []);
}
