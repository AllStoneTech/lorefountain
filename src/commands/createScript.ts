/**
 * "New Script" command: scaffolds a script following the Season/Episode
 * folder convention (`scripts/Season NN/SxEE-slug/SxEE-slug.fountain`) with
 * its title page pre-filled — `Title`, `Order` (this season's next episode
 * number), and Production Code (`SxEE`, computed once and never asked for
 * by hand, so it can't be mistyped or accidentally duplicated the way a
 * free-text field could).
 *
 * The episode number (and therefore `Order`/Production Code) is derived by
 * counting existing episode folders already in that season — always
 * appends at the end. Reordering afterward is what the Scripts tree view's
 * drag-and-drop is for; this command never needs to renumber anything else.
 *
 * A project with no season structure at all still gets a Production Code —
 * "no season" is treated as season 1 for that purpose only, so Production
 * Code stays well-formed even for a single, standalone script; the file
 * itself still sits directly in `scripts/`, no season folder is created for it.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { slugify } from '../model/slug';
import { registerTrackedCommand } from '../telemetry/trackedCommands';

/**
 * Register the "New Script" command.
 *
 * @param context - The extension context to register the disposable against.
 * @param pickTargetWorkspaceFolder - Resolves which workspace folder to create the script in (prompts if more than one is open).
 */
export function registerCreateScriptCommand(
  context: vscode.ExtensionContext,
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): void {
  context.subscriptions.push(
    registerTrackedCommand(context, 'lorefountain.newScript', () => void createScriptCommand(pickTargetWorkspaceFolder)),
  );
}

async function createScriptCommand(
  pickTargetWorkspaceFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;

  const seasonInput = await vscode.window.showInputBox({
    title: 'New Script — Season',
    prompt: 'Season number (leave blank if this project has no seasons)',
    validateInput: (value) => (value.trim() === '' || /^\d+$/.test(value.trim()) ? undefined : 'Enter a whole number, or leave blank.'),
  });
  if (seasonInput === undefined) return; // cancelled
  const seasonNumber = seasonInput.trim() === '' ? undefined : Number(seasonInput.trim());

  const title = await vscode.window.showInputBox({
    title: 'New Script — Title',
    prompt: 'This episode/script\'s title',
    validateInput: (value) => (value.trim() ? undefined : 'Enter a title.'),
  });
  if (title === undefined) return;
  const trimmedTitle = title.trim();

  const { folders } = await getWorkspaceFolders(folder);
  const seasonDir = seasonNumber === undefined ? folders.scripts : path.join(folders.scripts, `Season ${pad2(seasonNumber)}`);
  const episodeNumber = (await countEpisodeFolders(seasonDir)) + 1;
  const productionCode = `${seasonNumber ?? 1}x${pad2(episodeNumber)}`;

  const slug = slugify(trimmedTitle) || 'untitled';
  const episodeFolderName = `${productionCode}-${slug}`;
  const episodeDir = path.join(seasonDir, episodeFolderName);
  const filePath = path.join(episodeDir, `${episodeFolderName}.fountain`);

  if (await fileExists(filePath)) {
    void vscode.window.showErrorMessage(`LoreFountain: "${filePath}" already exists.`);
    return;
  }

  const content = [`Title: ${trimmedTitle}`, `Order: ${episodeNumber}`, `Production Code: ${productionCode}`, '', 'INT. LOCATION - DAY', ''].join(
    '\n',
  );

  await fsp.mkdir(episodeDir, { recursive: true });
  await fsp.writeFile(filePath, content, 'utf8');
  await vscode.window.showTextDocument(vscode.Uri.file(filePath));
}

/** Count existing episode folders directly under a season (or scripts root, for a season-less project) — used to derive the next episode number. Missing folder counts as zero. */
async function countEpisodeFolders(seasonDir: string): Promise<number> {
  try {
    const entries = await fsp.readdir(seasonDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).length;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw err;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}
