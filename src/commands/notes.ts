/**
 * Scratch-note commands (Spec §13.4): "not every idea starts as a
 * fully-formed entity." `/world/notes` already holds free-form Markdown
 * outside the entity system (never indexed/validated — `ENTITY_EXCLUDED_SUBDIRS`
 * in `src/index/build.ts`); this module adds the two writer-facing actions
 * the spec implies around that folder: creating a note without friction, and
 * promoting one into a real entity file once it's ready.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as vscode from 'vscode';
import { ENTITY_TYPE_COMMANDS } from './createEntity';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { createEntity, writeEntity } from '../entities/service';
import { slugify, titleizeSlug } from '../model/slug';
import { STORY_CARD_VIEW_TYPE } from '../providers/storyCardEditorProvider';
import type { WorldTreeNode } from '../providers/worldTreeProvider';

/**
 * Register the "New Note" and "Promote Note to Entity" commands.
 *
 * @param context - The extension context to register disposables against.
 * @param pickTargetWorkspaceFolder - Resolves which workspace folder a command should target (prompts if there's more than one open).
 */
export function registerNoteCommands(
  context: vscode.ExtensionContext,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lorefountain.newNote', () => void newNoteCommand(pickTargetWorkspaceFolder)),
    vscode.commands.registerCommand('lorefountain.promoteNoteToEntity', (node?: WorldTreeNode) =>
      void promoteNoteToEntityCommand(node, pickTargetWorkspaceFolder),
    ),
  );
}

async function newNoteCommand(
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;

  const title = await vscode.window.showInputBox({
    title: 'New Note',
    prompt: 'A short title for this idea — no structure required, jot it down and refine later',
    validateInput: (value) => (value.trim() ? undefined : 'Enter a title.'),
  });
  if (title === undefined) return; // cancelled

  const id = slugify(title);
  if (!id) {
    void vscode.window.showErrorMessage(`LoreFountain: "${title}" isn't a usable title.`);
    return;
  }

  const { folders } = await getWorkspaceFolders(folder);
  const filePath = vscode.Uri.joinPath(vscode.Uri.file(folders.notes), `${id}.md`);

  if (await fileExists(filePath.fsPath)) {
    void vscode.window.showErrorMessage(`LoreFountain: a note named "${title}" already exists.`);
    return;
  }

  await fsp.mkdir(folders.notes, { recursive: true });
  await fsp.writeFile(filePath.fsPath, `# ${title.trim()}\n\n`, 'utf8');
  await vscode.window.showTextDocument(filePath);
}

async function promoteNoteToEntityCommand(
  node: WorldTreeNode | undefined,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): Promise<void> {
  const notePath = node?.kind === 'note' ? node.filePath : vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!notePath) {
    void vscode.window.showErrorMessage('LoreFountain: open or select a note to promote first.');
    return;
  }

  const folder = node?.kind === 'note' ? node.folder : await pickTargetWorkspaceFolder();
  if (!folder) return;

  const picked = await vscode.window.showQuickPick(
    ENTITY_TYPE_COMMANDS.map(({ type, label }) => ({ label, type })),
    { title: 'Promote Note to Entity', placeHolder: 'What kind of entity is this?' },
  );
  if (!picked) return; // cancelled

  const defaultName = titleFromNoteFileName(notePath);
  const name = await vscode.window.showInputBox({
    title: `Promote Note to ${picked.label}`,
    prompt: `Name for the new ${picked.label.toLowerCase()}`,
    value: defaultName,
    validateInput: (value) => (value.trim() ? undefined : 'Enter a name.'),
  });
  if (name === undefined) return; // cancelled

  let noteText: string;
  try {
    noteText = await fsp.readFile(notePath, 'utf8');
  } catch (err) {
    void vscode.window.showErrorMessage(`LoreFountain: couldn't read the note (${errorMessage(err)}).`);
    return;
  }

  const { folders } = await getWorkspaceFolders(folder);
  const result = await createEntity(folders.world, picked.type, name);
  if (!result.ok) {
    const message =
      result.reason === 'already-exists'
        ? `LoreFountain: "${name}" already exists (${result.filePath}).`
        : `LoreFountain: "${name}" isn't a usable name.`;
    void vscode.window.showErrorMessage(message);
    return;
  }

  result.entity.body = noteText;
  await writeEntity(result.entity);

  void vscode.window.showInformationMessage(
    `LoreFountain: promoted "${name}" to a new ${picked.label} entity. ` +
      "The original note is unchanged — delete it once you're happy with the result.",
  );
  await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(result.filePath), STORY_CARD_VIEW_TYPE);
}

/** Derive a human-readable default name from a note's filename (its slug). */
function titleFromNoteFileName(filePath: string): string {
  const stem = filePath.split(/[\\/]/).pop()?.replace(/\.md$/, '') ?? '';
  return titleizeSlug(stem);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Extract a message from an unknown thrown value. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
