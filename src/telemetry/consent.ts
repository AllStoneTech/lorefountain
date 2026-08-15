/**
 * One-time telemetry consent prompt. Shown at most once per install unless
 * the user picks "Learn More" without actually answering — in that case the
 * "prompted" flag is deliberately reset so the next activation asks again,
 * rather than counting a click-through as an answer.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host, same posture as
 * `commands/licensing.ts`.
 */

import * as vscode from 'vscode';
import { hasPromptedForTelemetry, setPromptedForTelemetry } from './telemetryState';

/** Anchor into README.md's telemetry section, opened by the prompt's "Learn More" button. */
const LEARN_MORE_URL = 'https://github.com/AllStoneTech/lorefountain#telemetry--feedback';

/**
 * Show the one-time consent prompt, if it hasn't been shown (and actually
 * answered) yet. Never shown at all if VS Code's own global telemetry
 * switch is off — no point asking a question whose "yes" couldn't take
 * effect anyway.
 *
 * @param context - The extension context.
 */
export async function maybeShowTelemetryConsentPrompt(context: vscode.ExtensionContext): Promise<void> {
  if (!vscode.env.isTelemetryEnabled) return;
  if (hasPromptedForTelemetry(context)) return;

  await setPromptedForTelemetry(context, true);

  const yes = 'Yes, Share Usage Data';
  const no = 'No, Thanks';
  const learnMore = 'Learn More';
  const choice = await vscode.window.showInformationMessage(
    'LoreFountain: share anonymous feature-usage data to help prioritize development? ' +
      'No file names, entity names, or story content are ever included — only which features you use.',
    yes,
    learnMore,
    no,
  );

  if (choice === yes) {
    await vscode.workspace
      .getConfiguration('lorefountain')
      .update('telemetry.enabled', true, vscode.ConfigurationTarget.Global);
  } else if (choice === learnMore) {
    await vscode.env.openExternal(vscode.Uri.parse(LEARN_MORE_URL));
    // A click-through isn't an answer — ask again next activation.
    await setPromptedForTelemetry(context, false);
  }
  // "No, Thanks" (or dismissed): leave disabled (the setting's default), don't ask again.
}
