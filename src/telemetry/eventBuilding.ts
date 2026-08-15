/**
 * Pure telemetry event construction: schema, environment detection, and
 * event assembly, with zero runtime `vscode` dependency — deliberately
 * split out from `events.ts` (which reads live `vscode.env`/`context`
 * values) so this half stays importable from the vitest unit suite without
 * a `vscode` mock, the same "pure logic here, thin glue there" split
 * `licensing/licenseState.ts` uses for its own date-math helpers.
 *
 * Deliberately free of anything content-shaped: no file names, entity
 * names, workspace paths, search queries, or file contents ever go into an
 * event, only which feature ran, this session's license tier, and coarse
 * environment info. `telemetryEventSchema` is the enforceable version of
 * that promise for this module's own callers; the same shape is documented
 * for `AllStoneTech.com`'s ingestion endpoint to validate again
 * server-side (never trust the client).
 */

import { z } from 'zod';
import { getSessionTier } from './telemetryState';

const editorProductSchema = z.enum(['vscode', 'cursor', 'windsurf', 'antigravity', 'other']);
const platformSchema = z.enum(['win32', 'darwin', 'linux', 'other']);
const tierSchema = z.enum(['free', 'pro']);

export const telemetryEventSchema = z.object({
  event: z.string().min(1),
  tier: tierSchema,
  timestamp: z.string().datetime(),
  extensionVersion: z.string().min(1),
  editorProduct: editorProductSchema,
  platform: platformSchema,
});

export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;
type EditorProduct = z.infer<typeof editorProductSchema>;
type TelemetryPlatform = z.infer<typeof platformSchema>;

/**
 * Every feature area's own "used at least once this session" flags — for
 * hover and completion, which fire far too often (potentially many times
 * per second while typing) to record individually. Purely in-memory;
 * flushed into the real queue once, lazily, by `events.ts`'s
 * `flushSessionUsageFlags` right before a send — never touched from the hot
 * path that sets them.
 */
const sessionUsageFlags = new Set<string>();

/**
 * Mark a feature as used at least once this session — for providers that
 * fire far too often to record individually (hover, completion). Purely
 * in-memory and synchronous: no I/O, no `await`, safe to call from a
 * latency-sensitive provider callback.
 *
 * @param feature - A stable identifier, e.g. `'hover'` or `'completion'`.
 */
export function markFeatureUsedThisSession(feature: string): void {
  sessionUsageFlags.add(feature);
}

/**
 * Take and clear this session's usage-flag set — called by `events.ts`'s
 * `flushSessionUsageFlags`, never from the hot path that sets the flags.
 */
export function takeSessionUsageFlags(): string[] {
  const flagged = [...sessionUsageFlags];
  sessionUsageFlags.clear();
  return flagged;
}

/**
 * Map VS Code's `env.appName` to a coarse editor product — the same
 * extension runs unmodified in VS Code and its forks (Cursor, Windsurf,
 * Antigravity — see `README.md`'s opening paragraph), and which one someone
 * actually writes in is itself a useful signal.
 *
 * @param appName - `vscode.env.appName`.
 */
export function detectEditorProduct(appName: string): EditorProduct {
  const lower = appName.toLowerCase();
  if (lower.includes('cursor')) return 'cursor';
  if (lower.includes('windsurf')) return 'windsurf';
  if (lower.includes('antigravity')) return 'antigravity';
  if (lower.includes('code')) return 'vscode';
  return 'other';
}

/**
 * Map Node's `process.platform` to the coarse set this event shape tracks.
 *
 * @param platform - `process.platform`.
 */
export function detectPlatform(platform: string): TelemetryPlatform {
  return platform === 'win32' || platform === 'darwin' || platform === 'linux' ? platform : 'other';
}

/**
 * Build one telemetry event. Pure aside from reading the clock and the
 * current session tier — every field is either passed in or read from a
 * module-level constant — so this is safe and cheap to call from anywhere,
 * including hot paths (it does no I/O).
 *
 * @param eventName - A stable identifier for what happened (typically a command id, or `"<feature>.usedThisSession"`).
 * @param extensionVersion - This build's version, from `context.extension.packageJSON.version`.
 * @param appName - `vscode.env.appName`.
 * @param platform - `process.platform`.
 * @param now - Injectable for testing; defaults to the real current time.
 * @returns A fully-formed, schema-valid event.
 */
export function buildTelemetryEvent(
  eventName: string,
  extensionVersion: string,
  appName: string,
  platform: string,
  now: Date = new Date(),
): TelemetryEvent {
  return {
    event: eventName,
    tier: getSessionTier(),
    timestamp: now.toISOString(),
    extensionVersion,
    editorProduct: detectEditorProduct(appName),
    platform: detectPlatform(platform),
  };
}
