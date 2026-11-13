/**
 * "What kind of project is this?" (ADR-0051), `vscode` side: the
 * `lorefountain.setProjectType` command, the one-time prompt for existing
 * projects after an update, and the prompt for a newly initialized project.
 *
 * The answer is recorded as `project_type` in `lorefountain.config.json`
 * through `writeLoreFountainConfig`, which leaves every other key as it was.
 * Dismissing the dropdown counts as a skip: it is remembered per project and
 * never nags, and the command stays available. The decision rules are pure
 * and unit-tested in `config/projectTypePrompt.ts`; this file is glue,
 * verified manually in the F5 Extension Development Host.
 */

import * as vscode from 'vscode';
import { projectTypeFromConfig } from 'lorefountain-core/config/projectType';
import { readLoreFountainConfig, writeLoreFountainConfig } from '../config/configFile';
import { SKIP_CHOICE, decideProjectTypePrompt, projectTypePickItems } from '../config/projectTypePrompt';
import { registerTrackedCommand } from '../telemetry/trackedCommands';

/** The Set Project Type command id. */
export const SET_PROJECT_TYPE_COMMAND = 'lorefountain.setProjectType';
/** Workspace-state key prefix recording that a folder was asked (or skipped). */
const ASKED_KEY_PREFIX = 'lorefountain.projectType.asked:';

/**
 * Register `lorefountain.setProjectType`.
 *
 * @param context - The extension context to register the disposable against.
 * @param pickFolder - Resolves which workspace folder to act on (asks when there are several).
 */
export function registerSetProjectTypeCommand(
  context: vscode.ExtensionContext,
  pickFolder: () => Promise<vscode.WorkspaceFolder | undefined>,
): void {
  context.subscriptions.push(
    registerTrackedCommand(context, SET_PROJECT_TYPE_COMMAND, async () => {
      const folder = await pickFolder();
      if (folder) await askProjectType(context, folder);
    }),
  );
}

/**
 * Ask once, after a project's first index build, when it has a config file
 * but no `project_type` and has never been asked. The prompt for projects
 * that existed before project types.
 *
 * @param context - The extension context.
 * @param folder - The workspace folder that was just indexed.
 * @returns Resolves once the prompt was answered or skipped (or wasn't needed).
 */
export async function maybePromptProjectType(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder): Promise<void> {
  const enabled = vscode.workspace.getConfiguration('lorefountain').get<boolean>('notifications.projectType', true);
  const read = await readLoreFountainConfig(folder.uri.fsPath);
  // A config with a syntax error can't be safely rewritten, so don't ask.
  if (!read.ok) return;

  const shouldAsk = decideProjectTypePrompt({
    hasConfigFile: read.found,
    projectType: projectTypeFromConfig(read.config).projectType,
    alreadyAsked: context.workspaceState.get<boolean>(askedKey(folder)) === true,
    enabled,
  });
  if (shouldAsk) await askProjectType(context, folder);
}

/**
 * Show the project-type dropdown for a folder and record the answer.
 *
 * Used by the command, the update prompt, and Initialize Workspace. Marks the
 * folder as asked whatever the answer, so a skip is never re-asked on its own.
 *
 * @param context - The extension context.
 * @param folder - The workspace folder to record the type for.
 * @returns The chosen type's id, or `undefined` if the user skipped or dismissed.
 */
export async function askProjectType(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder): Promise<string | undefined> {
  const read = await readLoreFountainConfig(folder.uri.fsPath);
  if (!read.ok) {
    void vscode.window.showErrorMessage(
      `LoreFountain: can't set the project type because lorefountain.config.json has a problem (${read.message}). Fix it and try again.`,
    );
    return undefined;
  }

  const items = projectTypePickItems(projectTypeFromConfig(read.config).projectType);
  const picked = await vscode.window.showQuickPick(
    items.map((item) => ({ label: item.label, description: item.description, detail: item.detail || undefined, value: item.value })),
    {
      title: `What kind of project is "${folder.name}"?`,
      placeHolder: 'Pick the closest match. This only records and recommends; nothing about your files changes.',
      matchOnDescription: true,
      matchOnDetail: true,
    },
  );

  await context.workspaceState.update(askedKey(folder), true);
  if (!picked || picked.value === SKIP_CHOICE) return undefined;

  try {
    await writeLoreFountainConfig(folder.uri.fsPath, { project_type: picked.value });
  } catch (err) {
    void vscode.window.showErrorMessage(`LoreFountain: couldn't save the project type — ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
  void vscode.window.showInformationMessage(`LoreFountain: "${folder.name}" is now recorded as "${picked.label}".`);
  return picked.value;
}

function askedKey(folder: vscode.WorkspaceFolder): string {
  return `${ASKED_KEY_PREFIX}${folder.uri.toString()}`;
}
