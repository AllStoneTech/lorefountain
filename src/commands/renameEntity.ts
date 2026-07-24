/**
 * Entity renaming and broken-reference reporting (Spec §13.3).
 *
 * "Rename" is a single `vscode.WorkspaceEdit` covering every file touched —
 * the renamed entity's own file (moved + content updated), every other
 * entity's relation targets and wikilinked mentions, every glossary term's
 * wikilinked mentions, and every script's wikilinked mentions — applied and
 * saved as one atomic, undoable operation (mirrors the whole-document
 * `WorkspaceEdit.replace` pattern `storyCardEditorProvider.ts` already
 * uses). Bare plain-text mentions are deliberately left alone (see
 * `src/refactor/renameEntity.ts`) and reported instead; the standalone
 * "Show Broken References" command re-exposes the existing dangling-relation
 * detection (`src/index/relations.ts`, built for Phase B4) as an
 * on-demand report, satisfying the same spec bullet's "fallback/complement"
 * requirement independent of any particular rename.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite (the
 * underlying `refactor/renameEntity.ts` and `index/relations.ts` are) —
 * verify manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { listFilesWithExtension } from '../index/build';
import type { EntityRecord, IndexStore } from '../index/store';
import { findDanglingRelations } from '../index/relations';
import { serializeEntity, type Entity } from '../model/entity';
import { serializeGlossaryTerm } from '../model/glossary';
import { slugify } from '../model/slug';
import { addAliasIfMissing, renameInText, renameRelationTargets } from '../refactor/renameEntity';
import { STORY_CARD_VIEW_TYPE } from '../providers/storyCardEditorProvider';
import type { WorldTreeNode } from '../providers/worldTreeProvider';

/**
 * Register the "Rename Entity" and "Show Broken References" commands.
 *
 * @param context - The extension context to register disposables against.
 * @param outputChannel - Where to log the detailed rename/broken-reference report.
 * @param getStoreForFolder - Resolves the {@link IndexStore} for a workspace folder.
 */
export function registerReferenceCommands(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel,
  getStoreForFolder: (folder: vscode.WorkspaceFolder) => IndexStore | undefined,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lorefountain.renameEntity', (node?: WorldTreeNode) =>
      void renameEntityCommand(node, outputChannel, getStoreForFolder),
    ),
    vscode.commands.registerCommand('lorefountain.showBrokenReferences', () =>
      void showBrokenReferencesCommand(outputChannel, getStoreForFolder),
    ),
  );
}

async function renameEntityCommand(
  node: WorldTreeNode | undefined,
  outputChannel: vscode.OutputChannel,
  getStoreForFolder: (folder: vscode.WorkspaceFolder) => IndexStore | undefined,
): Promise<void> {
  const resolved = resolveTarget(node, getStoreForFolder);
  if (!resolved) {
    void vscode.window.showErrorMessage('LoreFountain: open or select an entity to rename first.');
    return;
  }
  const { store, folder, entity } = resolved;

  const newName = await vscode.window.showInputBox({
    title: `Rename "${entity.name}"`,
    prompt: 'New name for this entity',
    value: entity.name,
    validateInput: (value) => (value.trim() ? undefined : 'Enter a name.'),
  });
  if (newName === undefined) return; // cancelled

  const trimmedNewName = newName.trim();
  if (trimmedNewName === entity.name) return; // no-op

  const newId = slugify(trimmedNewName);
  if (!newId) {
    void vscode.window.showErrorMessage(`LoreFountain: "${trimmedNewName}" isn't a usable name.`);
    return;
  }

  const oldId = entity.id;
  const oldName = entity.name;
  const oldFilePath = entity.filePath;
  const worldFolder = path.dirname(oldFilePath);
  const newFilePath = path.join(worldFolder, `${newId}.md`);
  const fileMoved = newFilePath !== oldFilePath;

  if (fileMoved && (await fileExists(newFilePath))) {
    void vscode.window.showErrorMessage(`LoreFountain: "${trimmedNewName}" already exists (${newFilePath}).`);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  const touchedDocuments: vscode.TextDocument[] = [];
  let relationsUpdatedCount = 0;
  let wikilinksUpdatedCount = 0;
  const staleMentions: { filePath: string; lines: number[] }[] = [];

  // 1. The renamed entity's own file: the move first (a plain resource
  // operation on a stable URI), then the content edit targets wherever the
  // file ends up — avoids any ambiguity about whether an in-flight text
  // edit's dirty buffer carries across a rename of the same URI within one
  // WorkspaceEdit.
  const oldUri = vscode.Uri.file(oldFilePath);
  const newUri = vscode.Uri.file(newFilePath);
  const renamedContent = serializeEntity({
    id: newId,
    filePath: newFilePath,
    body: entity.body,
    frontmatter: { ...entity.data, name: trimmedNewName, aliases: addAliasIfMissing(entity.data.aliases, oldName) },
  });
  const lineCountDoc = await vscode.workspace.openTextDocument(oldUri);
  const fullRange = new vscode.Range(0, 0, lineCountDoc.lineCount, 0);
  if (fileMoved) {
    edit.renameFile(oldUri, newUri);
  }
  edit.replace(fileMoved ? newUri : oldUri, fullRange, renamedContent);

  // 2. Every other entity: rewrite relation targets + wikilinked mentions.
  for (const other of store.listEntities()) {
    if (other.id === oldId) continue;

    const updatedRelations = renameRelationTargets(other.data.relations, oldId, newId);
    const relationsChanged = updatedRelations !== other.data.relations;

    const { text: newBody, wikilinksRewritten, staleMentionLines } = renameInText(other.body, oldName, trimmedNewName);
    if (staleMentionLines.length > 0) staleMentions.push({ filePath: other.filePath, lines: staleMentionLines });

    if (relationsChanged || wikilinksRewritten > 0) {
      if (relationsChanged) relationsUpdatedCount += 1;
      if (wikilinksRewritten > 0) wikilinksUpdatedCount += 1;
      const updatedEntity: Entity = {
        id: other.id,
        filePath: other.filePath,
        body: newBody,
        frontmatter: { ...other.data, relations: updatedRelations },
      };
      touchedDocuments.push(
        await addReplaceEdit(edit, vscode.Uri.file(other.filePath), serializeEntity(updatedEntity)),
      );
    }
  }

  // 3. Every glossary term: wikilinked mentions only (no relations field).
  for (const term of store.listGlossaryTerms()) {
    const { text: newBody, wikilinksRewritten, staleMentionLines } = renameInText(term.body, oldName, trimmedNewName);
    if (staleMentionLines.length > 0) staleMentions.push({ filePath: term.filePath, lines: staleMentionLines });
    if (wikilinksRewritten > 0) {
      wikilinksUpdatedCount += 1;
      touchedDocuments.push(
        await addReplaceEdit(
          edit,
          vscode.Uri.file(term.filePath),
          serializeGlossaryTerm({ id: term.id, filePath: term.filePath, body: newBody, frontmatter: term.data }),
        ),
      );
    }
  }

  // 4. Every script: wikilinked mentions only — scripts aren't stored with
  // body text in the index (only mention edges), so read them fresh.
  const { folders } = await getWorkspaceFolders(folder);
  const scriptFiles = await listFilesWithExtension(folders.scripts, '.fountain');
  for (const scriptPath of scriptFiles) {
    const text = await fsp.readFile(scriptPath, 'utf8');
    const { text: newText, wikilinksRewritten, staleMentionLines } = renameInText(text, oldName, trimmedNewName);
    if (staleMentionLines.length > 0) staleMentions.push({ filePath: scriptPath, lines: staleMentionLines });
    if (wikilinksRewritten > 0) {
      wikilinksUpdatedCount += 1;
      touchedDocuments.push(await addReplaceEdit(edit, vscode.Uri.file(scriptPath), newText));
    }
  }

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) {
    void vscode.window.showErrorMessage('LoreFountain: the rename could not be applied.');
    return;
  }

  // Re-resolve the renamed file at its final path to save it — every other
  // touched document's path was never affected by the rename.
  const renamedDoc = await vscode.workspace.openTextDocument(newFilePath);
  await Promise.all([renamedDoc, ...touchedDocuments].map((doc) => doc.save()));

  reportRenameResult(outputChannel, oldName, trimmedNewName, relationsUpdatedCount, wikilinksUpdatedCount, staleMentions);

  await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(newFilePath), STORY_CARD_VIEW_TYPE);
}

function reportRenameResult(
  outputChannel: vscode.OutputChannel,
  oldName: string,
  newName: string,
  relationsUpdatedCount: number,
  wikilinksUpdatedCount: number,
  staleMentions: ReadonlyArray<{ filePath: string; lines: number[] }>,
): void {
  outputChannel.appendLine(`[LoreFountain] Renamed "${oldName}" -> "${newName}".`);
  outputChannel.appendLine(
    `[LoreFountain]   Updated ${relationsUpdatedCount} relation target(s) and ${wikilinksUpdatedCount} file(s) with wikilinked mentions.`,
  );
  if (staleMentions.length > 0) {
    outputChannel.appendLine(
      `[LoreFountain]   ${staleMentions.length} file(s) still use "${oldName}" as plain text (still recognized — "${oldName}" was kept as an alias):`,
    );
    for (const { filePath, lines } of staleMentions) {
      outputChannel.appendLine(`[LoreFountain]     ${filePath} (line ${lines.map((l) => l + 1).join(', ')})`);
    }
  }
  outputChannel.show();

  void vscode.window.showInformationMessage(
    staleMentions.length > 0
      ? `LoreFountain: renamed "${oldName}" to "${newName}". ${staleMentions.length} file(s) still use the old name as plain text — see the "LoreFountain" output channel.`
      : `LoreFountain: renamed "${oldName}" to "${newName}".`,
  );
}

async function showBrokenReferencesCommand(
  outputChannel: vscode.OutputChannel,
  getStoreForFolder: (folder: vscode.WorkspaceFolder) => IndexStore | undefined,
): Promise<void> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const dangling: { folderName: string; filePath: string; name: string; target: string; relationType: string }[] = [];

  for (const folder of folders) {
    const store = getStoreForFolder(folder);
    if (!store) continue;
    const entities = store.listEntities();
    const knownIds = new Set(entities.map((e) => e.id));
    for (const entity of entities) {
      for (const relation of findDanglingRelations(entity.data.relations, knownIds)) {
        dangling.push({
          folderName: folder.name,
          filePath: entity.filePath,
          name: entity.name,
          target: relation.target,
          relationType: relation.relationType,
        });
      }
    }
  }

  if (dangling.length === 0) {
    void vscode.window.showInformationMessage(
      'LoreFountain: no broken references found — every relation target resolves to a known entity.',
    );
    return;
  }

  outputChannel.appendLine(`[LoreFountain] Broken reference report — ${dangling.length} dangling relation(s):`);
  for (const item of dangling) {
    outputChannel.appendLine(
      `[LoreFountain]   [${item.folderName}] "${item.name}" (${item.filePath}) -> relation "${item.relationType}" targets unknown entity "${item.target}"`,
    );
  }
  outputChannel.show();

  void vscode.window.showWarningMessage(
    `LoreFountain: found ${dangling.length} broken relation(s). See the "LoreFountain" output channel for details.`,
  );
}

/** Resolve the entity to rename from a tree node, or fall back to the active editor's document. */
function resolveTarget(
  node: WorldTreeNode | undefined,
  getStoreForFolder: (folder: vscode.WorkspaceFolder) => IndexStore | undefined,
): { store: IndexStore; folder: vscode.WorkspaceFolder; entity: EntityRecord } | undefined {
  if (node?.kind === 'entity') {
    const store = getStoreForFolder(node.folder);
    const entity = store?.getEntityByPath(node.filePath);
    return store && entity ? { store, folder: node.folder, entity } : undefined;
  }

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (!activeUri) return undefined;

  const folder = vscode.workspace.getWorkspaceFolder(activeUri);
  const store = folder && getStoreForFolder(folder);
  const entity = store?.getEntityByPath(activeUri.fsPath);
  return folder && store && entity ? { store, folder, entity } : undefined;
}

/** Open `uri`, queue a whole-document replace with `newText` on `edit`, and return the opened document (for saving later). */
async function addReplaceEdit(edit: vscode.WorkspaceEdit, uri: vscode.Uri, newText: string): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(uri);
  edit.replace(uri, new vscode.Range(0, 0, document.lineCount, 0), newText);
  return document;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}
