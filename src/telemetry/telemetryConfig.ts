/**
 * The one real `vscode.env`/`vscode.workspace`-touching telemetry check,
 * deliberately isolated in its own file: `telemetryState.ts` and
 * `eventBuilding.ts` need to stay free of any transitive import that
 * resolves to a real `vscode` runtime call, or vitest can't load them at
 * all (a static `import` executes unconditionally, regardless of whether
 * the imported binding is ever called) — see those modules' doc comments.
 * This file is the deliberate exception: genuine `vscode`-facing glue, not
 * covered by the vitest unit suite, same posture as `commands/licensing.ts`.
 */

import * as vscode from 'vscode';

/**
 * Whether telemetry may be sent at all: both VS Code's own global kill
 * switch and this extension's own opt-in setting must agree. Never
 * overrides the user's global choice — if `vscode.env.isTelemetryEnabled`
 * is `false`, this is `false` regardless of `lorefountain.telemetry.enabled`.
 *
 * @returns Whether an event may be queued/sent right now.
 */
export function isTelemetryOptedIn(): boolean {
  if (!vscode.env.isTelemetryEnabled) return false;
  return vscode.workspace.getConfiguration('lorefountain').get<boolean>('telemetry.enabled', false);
}
