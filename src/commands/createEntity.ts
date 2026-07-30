/**
 * Instant entity/glossary creation commands (Spec §13.1): "a writer invents a
 * character mid-scene and needs a file to exist immediately, without leaving
 * the writing flow to hand-write YAML frontmatter." Each command prompts for
 * a name only, scaffolds the file via `entities/service.ts`, and opens it —
 * through the Story Card custom editor for entities, so creation flows
 * straight into the authoring surface (Spec §6.1) rather than a raw text view.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite (the underlying
 * `entities/service.ts` is) — verify manually via the F5 Extension
 * Development Host.
 */

import * as vscode from 'vscode';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { createEntity, createGlossaryTerm, createTimelineEvent } from '../entities/service';
import type { EntityType } from '../model/entity';
import { STORY_CARD_VIEW_TYPE } from '../providers/storyCardEditorProvider';

/** Exported for reuse by other commands that need the same type/label pairing (e.g. note promotion). */
export const ENTITY_TYPE_COMMANDS: ReadonlyArray<{ commandId: string; type: EntityType; label: string }> = [
  { commandId: 'lorefountain.newCharacter', type: 'character', label: 'Character' },
  { commandId: 'lorefountain.newLocation', type: 'location', label: 'Location' },
  { commandId: 'lorefountain.newFaction', type: 'faction', label: 'Faction' },
  { commandId: 'lorefountain.newObject', type: 'object', label: 'Object' },
  { commandId: 'lorefountain.newConcept', type: 'concept', label: 'Concept' },
  { commandId: 'lorefountain.newArc', type: 'arc', label: 'Arc' },
];

/**
 * Register the "New Character/Location/Faction/Object/Concept/Arc" and "New
 * Glossary Term" commands.
 *
 * @param context - The extension context to register disposables against.
 * @param pickTargetWorkspaceFolder - Resolves which workspace folder a command should target (prompts if there's more than one open).
 */
export function registerEntityCreationCommands(
  context: vscode.ExtensionContext,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): void {
  for (const { commandId, type, label } of ENTITY_TYPE_COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, () => void createEntityCommand(type, label, pickTargetWorkspaceFolder)),
    );
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('lorefountain.newGlossaryTerm', () => void createGlossaryTermCommand(pickTargetWorkspaceFolder)),
    vscode.commands.registerCommand('lorefountain.newEvent', () => void createTimelineEventCommand(pickTargetWorkspaceFolder)),
  );
}

async function createEntityCommand(
  type: EntityType,
  label: string,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;

  const name = await vscode.window.showInputBox({
    title: `New ${label}`,
    prompt: `Name for the new ${label.toLowerCase()}`,
    validateInput: (value) => (value.trim() ? undefined : 'Enter a name.'),
  });
  if (name === undefined) return; // cancelled

  const { folders } = await getWorkspaceFolders(folder);
  const result = await createEntity(folders.world, type, name);

  if (!result.ok) {
    const message =
      result.reason === 'already-exists'
        ? `LoreFountain: "${name}" already exists (${result.filePath}).`
        : `LoreFountain: "${name}" isn't a usable name.`;
    void vscode.window.showErrorMessage(message);
    return;
  }

  await vscode.commands.executeCommand(
    'vscode.openWith',
    vscode.Uri.file(result.filePath),
    STORY_CARD_VIEW_TYPE,
  );
}

async function createGlossaryTermCommand(
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;

  const term = await vscode.window.showInputBox({
    title: 'New Glossary Term',
    prompt: 'The term to define',
    validateInput: (value) => (value.trim() ? undefined : 'Enter a term.'),
  });
  if (term === undefined) return;

  const { folders } = await getWorkspaceFolders(folder);
  const result = await createGlossaryTerm(folders.glossary, term);

  if (!result.ok) {
    const message =
      result.reason === 'already-exists'
        ? `LoreFountain: "${term}" already exists (${result.filePath}).`
        : `LoreFountain: "${term}" isn't a usable term.`;
    void vscode.window.showErrorMessage(message);
    return;
  }

  // Glossary terms stay plain Markdown (Spec §4.7 — lightweight, no Story
  // Card editor): open with the standard text editor.
  await vscode.window.showTextDocument(vscode.Uri.file(result.filePath));
}

async function createTimelineEventCommand(
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;

  const name = await vscode.window.showInputBox({
    title: 'New Event',
    prompt: 'Name for the new Timeline event',
    validateInput: (value) => (value.trim() ? undefined : 'Enter a name.'),
  });
  if (name === undefined) return;

  const { folders } = await getWorkspaceFolders(folder);
  const result = await createTimelineEvent(folders.timeline, name);

  if (!result.ok) {
    const message =
      result.reason === 'already-exists'
        ? `LoreFountain: "${name}" already exists (${result.filePath}).`
        : `LoreFountain: "${name}" isn't a usable name.`;
    void vscode.window.showErrorMessage(message);
    return;
  }

  // Timeline events stay plain Markdown for v1, same posture as glossary
  // terms (Spec §4.7) — no Story Card editor.
  await vscode.window.showTextDocument(vscode.Uri.file(result.filePath));
}
