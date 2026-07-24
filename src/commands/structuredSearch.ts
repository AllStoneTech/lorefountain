/**
 * "Structured Search" command (Spec §13.6): exposes co-presence and
 * mention-line search as their own named feature, distinct from generic
 * full-text search. `vscode`-facing glue over the pure
 * `src/search/structuredSearch.ts`; not covered by the vitest unit suite —
 * verify manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as vscode from 'vscode';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { buildMentionCandidates, listFilesWithExtension } from '../index/build';
import type { MentionCandidate } from '../index/mentions';
import type { IndexStore } from '../index/store';
import { extractScenePresence, findCoPresenceScenes, findMentionLines } from '../search/structuredSearch';

/**
 * Register the "Structured Search" command.
 *
 * @param context - The extension context to register the disposable against.
 * @param outputChannel - Where to log detailed results.
 * @param pickTargetWorkspaceFolder - Resolves which workspace folder to search (prompts if more than one is open).
 * @param getStoreForFolder - Resolves the {@link IndexStore} for a workspace folder.
 */
export function registerStructuredSearchCommand(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
  getStoreForFolder: (folder: vscode.WorkspaceFolder) => IndexStore | undefined,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lorefountain.structuredSearch', () =>
      void structuredSearchCommand(outputChannel, pickTargetWorkspaceFolder, getStoreForFolder),
    ),
  );
}

interface CandidatePick extends vscode.QuickPickItem {
  id: string;
}

async function structuredSearchCommand(
  outputChannel: vscode.OutputChannel,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
  getStoreForFolder: (folder: vscode.WorkspaceFolder) => IndexStore | undefined,
): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;

  const store = getStoreForFolder(folder);
  if (!store) {
    void vscode.window.showErrorMessage(`LoreFountain: no index is ready yet for "${folder.name}".`);
    return;
  }

  const candidates = buildMentionCandidates(store);
  if (candidates.length === 0) {
    void vscode.window.showInformationMessage('LoreFountain: no entities or glossary terms are indexed yet.');
    return;
  }

  const mode = await vscode.window.showQuickPick(
    [
      { label: 'Scenes where two entities are both present', value: 'co-presence' as const },
      { label: 'Every line that mentions an entity', value: 'mentions' as const },
    ],
    { title: 'Structured Search (Spec §13.6)' },
  );
  if (!mode) return;

  const { folders } = await getWorkspaceFolders(folder);
  const scriptPaths = await listFilesWithExtension(folders.scripts, '.fountain');
  if (scriptPaths.length === 0) {
    void vscode.window.showInformationMessage('LoreFountain: no .fountain scripts found to search.');
    return;
  }

  if (mode.value === 'co-presence') {
    await runCoPresenceSearch(outputChannel, candidates, scriptPaths);
  } else {
    await runMentionLineSearch(outputChannel, candidates, scriptPaths);
  }
}

async function runCoPresenceSearch(
  outputChannel: vscode.OutputChannel,
  candidates: readonly MentionCandidate[],
  scriptPaths: readonly string[],
): Promise<void> {
  const first = await pickCandidate(candidates, 'First entity');
  if (!first) return;
  const second = await pickCandidate(
    candidates.filter((c) => c.id !== first.id),
    `Second entity (scenes with "${first.names[0]}")`,
  );
  if (!second) return;

  const scenes = [];
  for (const scriptPath of scriptPaths) {
    const text = await fsp.readFile(scriptPath, 'utf8');
    scenes.push(...extractScenePresence(scriptPath, text, candidates));
  }
  const matches = findCoPresenceScenes(scenes, first.id, second.id);

  if (matches.length === 0) {
    void vscode.window.showInformationMessage(
      `LoreFountain: "${first.names[0]}" and "${second.names[0]}" never share a scene.`,
    );
    return;
  }

  outputChannel.appendLine(
    `[LoreFountain] Structured search — ${matches.length} scene(s) with both "${first.names[0]}" and "${second.names[0]}":`,
  );
  for (const scene of matches) {
    outputChannel.appendLine(`[LoreFountain]   ${scene.scriptPath} — ${scene.sceneHeading}`);
  }
  outputChannel.show();
  void vscode.window.showInformationMessage(
    `LoreFountain: found ${matches.length} scene(s) with both "${first.names[0]}" and "${second.names[0]}". See the "LoreFountain" output channel.`,
  );
}

async function runMentionLineSearch(
  outputChannel: vscode.OutputChannel,
  candidates: readonly MentionCandidate[],
  scriptPaths: readonly string[],
): Promise<void> {
  const target = await pickCandidate(candidates, 'Find every line mentioning');
  if (!target) return;

  const lines = [];
  for (const scriptPath of scriptPaths) {
    const text = await fsp.readFile(scriptPath, 'utf8');
    lines.push(...findMentionLines(scriptPath, text, candidates, target.id));
  }

  if (lines.length === 0) {
    void vscode.window.showInformationMessage(`LoreFountain: "${target.names[0]}" isn't mentioned in any script.`);
    return;
  }

  outputChannel.appendLine(`[LoreFountain] Structured search — ${lines.length} line(s) mentioning "${target.names[0]}":`);
  for (const match of lines) {
    outputChannel.appendLine(`[LoreFountain]   ${match.scriptPath}:${match.line + 1}: ${match.text}`);
  }
  outputChannel.show();
  void vscode.window.showInformationMessage(
    `LoreFountain: found ${lines.length} line(s) mentioning "${target.names[0]}". See the "LoreFountain" output channel.`,
  );
}

async function pickCandidate(
  candidates: readonly MentionCandidate[],
  title: string,
): Promise<MentionCandidate | undefined> {
  const picks: CandidatePick[] = candidates.map((candidate) => ({
    label: candidate.names[0],
    description: candidate.kind,
    id: candidate.id,
  }));
  const picked = await vscode.window.showQuickPick(picks, { title });
  return picked ? candidates.find((c) => c.id === picked.id) : undefined;
}
