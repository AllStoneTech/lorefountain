/**
 * The "Export Script…" command and its dialog (ADR-0045): exports one script,
 * or every script in its season, to PDF, Fountain, Final Draft, HTML, Word or
 * a transcript, with the include/exclude options and presets of Core
 * ADR-0003. `vscode`-facing glue over the pure `export/exportScript.ts`,
 * checked manually in the F5 Extension Development Host.
 *
 * Exports {@link registerExportScriptCommand}.
 *
 * Gotchas:
 * - Files go to the project's `exports/` folder by default. Saving a
 *   `.fountain` export inside the scripts folder would make it another script
 *   (with a clashing Production Code), so that asks first.
 * - The dialog's choices are saved to `lorefountain.config.json`'s `export`
 *   section only after a successful export.
 * - Batch export writes into one chosen folder and asks before replacing files.
 */

import * as crypto from 'node:crypto';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { EXPORT_PRESETS, EXPORT_PRESET_IDS } from 'lorefountain-core/export/options';
import { EXPORT_FORMATS, exportSettingsFromConfig, type ExportSettings } from 'lorefountain-core/export/settings';
import { readLoreFountainConfig, writeLoreFountainConfig } from '../config/configFile';
import { getWorkspaceFolders } from '../config/workspaceConfig';
import { defaultExportFileName, exportScript, FORMAT_DETAILS, type ExportRequest } from '../export/exportScript';
import { parseExportDialogMessage, type ExportChoice, type ExportDialogInit } from '../export/exportMessages';
import { loadPdfFonts, type PdfFonts } from '../export/pdf';
import { deriveScriptGroup, listFilesWithExtension } from '../index/build';
import { buildExportHtml } from '../providers/exportHtml';
import { registerTrackedCommand } from '../telemetry/trackedCommands';

/** The command id. */
export const EXPORT_SCRIPT_COMMAND = 'lorefountain.exportScript';

/** The default folder for exports, relative to the workspace folder. */
const EXPORTS_FOLDER = 'exports';

/** What the dialog exports: a script, and the season it belongs to. */
interface ExportSubject {
  folder: vscode.WorkspaceFolder;
  scriptsRoot: string;
  scriptPath: string;
  /** The script's season and every script in it, in file-name order; absent for a script at the top of the scripts folder. */
  group?: { name: string; files: string[] };
}

/** The open dialog, if any: one at a time. */
let openPanel: vscode.WebviewPanel | undefined;

/**
 * Register the "Export Script…" command.
 *
 * @param context - The extension context, for disposables and the bundled fonts' location.
 */
export function registerExportScriptCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    registerTrackedCommand(context, EXPORT_SCRIPT_COMMAND, (target?: unknown) => {
      void runCommand(context, target).catch((error: unknown) => {
        void vscode.window.showErrorMessage(`LoreFountain: export failed. ${errorText(error)}`);
      });
    }),
  );
}

/** Resolve what to export, then open the dialog. */
async function runCommand(context: vscode.ExtensionContext, target: unknown): Promise<void> {
  const subject = await resolveSubject(target);
  if (!subject) return;
  openDialog(context, subject);
}

/**
 * Work out the script to export from the command's argument: a script's
 * `Uri`, a Scripts-view node (a script, or a season, whose first script is
 * offered), or nothing (the active editor, else a picker).
 */
async function resolveSubject(target: unknown): Promise<ExportSubject | undefined> {
  let scriptPath: string | undefined;
  let groupName: string | undefined;

  if (target instanceof vscode.Uri) {
    scriptPath = target.fsPath;
  } else if (isScriptNode(target)) {
    scriptPath = target.script.filePath;
  } else if (isGroupNode(target)) {
    groupName = target.group;
    const { folders } = await getWorkspaceFolders(target.folder);
    const files = (await listFilesWithExtension(folders.scripts, '.fountain')).filter((file) => deriveScriptGroup(folders.scripts, file) === groupName).sort();
    scriptPath = files[0];
  } else if (vscode.window.activeTextEditor?.document.languageId === 'fountain') {
    scriptPath = vscode.window.activeTextEditor.document.uri.fsPath;
  } else {
    scriptPath = await pickScript();
  }
  if (!scriptPath) {
    if (groupName !== undefined) void vscode.window.showInformationMessage('LoreFountain: that season has no scripts to export.');
    return undefined;
  }

  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(scriptPath));
  if (!folder) {
    void vscode.window.showErrorMessage('LoreFountain: the script must be inside an open workspace folder to export it.');
    return undefined;
  }
  const { folders } = await getWorkspaceFolders(folder);
  const group = deriveScriptGroup(folders.scripts, scriptPath);
  if (group === '') return { folder, scriptsRoot: folders.scripts, scriptPath };
  const files = (await listFilesWithExtension(folders.scripts, '.fountain')).filter((file) => deriveScriptGroup(folders.scripts, file) === group).sort();
  return { folder, scriptsRoot: folders.scripts, scriptPath, group: { name: group, files } };
}

/** Offer every script in the workspace. */
async function pickScript(): Promise<string | undefined> {
  const picks: { label: string; description: string; filePath: string }[] = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const { folders } = await getWorkspaceFolders(folder);
    for (const filePath of await listFilesWithExtension(folders.scripts, '.fountain')) {
      picks.push({ label: path.relative(folder.uri.fsPath, filePath), description: folder.name, filePath });
    }
  }
  if (picks.length === 0) {
    void vscode.window.showErrorMessage('LoreFountain: no .fountain scripts found to export.');
    return undefined;
  }
  if (picks.length === 1) return picks[0].filePath;
  const picked = await vscode.window.showQuickPick(picks, { title: 'Export Script', placeHolder: 'Choose a script to export' });
  return picked?.filePath;
}

/** Open (or replace) the dialog for a subject. */
function openDialog(context: vscode.ExtensionContext, subject: ExportSubject): void {
  openPanel?.dispose();
  const panel = vscode.window.createWebviewPanel('lorefountain.exportScript', 'Export Script', vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  openPanel = panel;
  const nonce = crypto.randomBytes(16).toString('base64');
  panel.webview.html = buildExportHtml(panel.webview.cspSource, nonce);

  let fonts: Promise<PdfFonts> | undefined;
  const loadFonts = (): Promise<PdfFonts> => (fonts ??= loadPdfFonts(path.join(context.extensionPath, 'resources', 'fonts')));
  let busy = false;

  const subscription = panel.webview.onDidReceiveMessage(async (raw: unknown) => {
    const message = parseExportDialogMessage(raw);
    if (!message) return;
    if (message.type === 'cancel') {
      panel.dispose();
      return;
    }
    if (message.type === 'ready') {
      void panel.webview.postMessage(await initMessage(subject));
      return;
    }
    if (busy) return;
    busy = true;
    try {
      const done = await runExport(subject, message, loadFonts);
      if (done) panel.dispose();
    } catch (error) {
      void vscode.window.showErrorMessage(`LoreFountain: export failed. ${errorText(error)}`);
    } finally {
      busy = false;
    }
  });
  panel.onDidDispose(() => {
    subscription.dispose();
    if (openPanel === panel) openPanel = undefined;
  });
}

/** The dialog's initial state: formats, presets, saved settings and the scope. */
async function initMessage(subject: ExportSubject): Promise<ExportDialogInit> {
  const config = await readLoreFountainConfig(subject.folder.uri.fsPath);
  const settings = config.ok ? exportSettingsFromConfig(config.config) : exportSettingsFromConfig({});
  return {
    type: 'init',
    formats: EXPORT_FORMATS.map((id) => ({ id, label: FORMAT_DETAILS[id].label })),
    presets: EXPORT_PRESET_IDS.map((id) => ({ id, label: EXPORT_PRESETS[id].label, description: EXPORT_PRESETS[id].description, content: EXPORT_PRESETS[id].content })),
    settings,
    scope: {
      script: path.basename(subject.scriptPath),
      ...(subject.group && subject.group.files.length > 1 ? { group: { name: subject.group.name, count: subject.group.files.length } } : {}),
    },
  };
}

/**
 * Export with the writer's choices: ask where, write, save the settings, report.
 *
 * @returns True when files were written (the dialog then closes); false when the writer cancelled a prompt.
 */
async function runExport(subject: ExportSubject, choice: ExportChoice, loadFonts: () => Promise<PdfFonts>): Promise<boolean> {
  const request: ExportRequest = { format: choice.format, content: choice.content, paper: choice.paper, titlePage: choice.titlePage };
  const root = subject.folder.uri.fsPath;
  const exportsDir = path.join(root, EXPORTS_FOLDER);
  const files = choice.scope === 'group' && subject.group ? subject.group.files : [subject.scriptPath];
  const stem = (file: string): string => path.basename(file, '.fountain');

  let targets: { source: string; target: string }[];
  if (files.length === 1) {
    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(exportsDir, defaultExportFileName(stem(files[0]), choice.format))),
      filters: { [FORMAT_DETAILS[choice.format].filterName]: FORMAT_DETAILS[choice.format].filterExtensions },
      title: 'Export Script',
    });
    if (!target) return false;
    targets = [{ source: files[0], target: target.fsPath }];
  } else {
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: vscode.Uri.file((await exists(exportsDir)) ? exportsDir : root),
      openLabel: 'Export Here',
      title: `Export ${files.length} scripts`,
    });
    if (!picked?.[0]) return false;
    targets = files.map((source) => ({ source, target: path.join(picked[0].fsPath, defaultExportFileName(stem(source), choice.format)) }));
    const existing = (await Promise.all(targets.map(async ({ target }) => ((await exists(target)) ? target : undefined)))).filter(Boolean);
    if (existing.length > 0) {
      const replace = await vscode.window.showWarningMessage(`Replace ${existing.length} existing file(s) in that folder?`, { modal: true }, 'Replace');
      if (replace !== 'Replace') return false;
    }
  }

  if (choice.format === 'fountain' && targets.some(({ target }) => isInside(target, subject.scriptsRoot))) {
    const answer = await vscode.window.showWarningMessage(
      'A .fountain export saved inside your scripts folder is read as another script, and its Production Code would clash with the original. Save it there anyway?',
      { modal: true },
      'Save Anyway',
    );
    if (answer !== 'Save Anyway') return false;
  }

  await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'LoreFountain: exporting', cancellable: false }, async (progress) => {
    for (const { source, target } of targets) {
      progress.report({ message: path.basename(source), increment: 100 / targets.length });
      const text = await fsp.readFile(source, 'utf8');
      const output = await exportScript(text, stem(source), request, loadFonts);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, output.data);
    }
  });

  await saveSettings(root, choice);
  await reportDone(targets.map(({ target }) => target), choice);
  return true;
}

/** Remember the dialog's choices for next time. */
async function saveSettings(root: string, choice: ExportChoice): Promise<void> {
  const config = await readLoreFountainConfig(root);
  const previous = config.ok ? exportSettingsFromConfig(config.config) : exportSettingsFromConfig({});
  const settings: ExportSettings = {
    preset: choice.preset,
    format: choice.format,
    paper: choice.paper,
    titlePage: choice.titlePage,
    custom: choice.preset === 'custom' ? choice.content : previous.custom,
  };
  try {
    await writeLoreFountainConfig(root, { export: settings });
  } catch (error) {
    void vscode.window.showWarningMessage(`LoreFountain: exported, but couldn't save your export choices to lorefountain.config.json. ${errorText(error)}`);
  }
}

/** Tell the writer what was written, offering to open or reveal it. */
async function reportDone(targets: readonly string[], choice: ExportChoice): Promise<void> {
  const first = targets[0];
  const message = targets.length === 1 ? `LoreFountain: exported ${path.basename(first)}.` : `LoreFountain: exported ${targets.length} scripts.`;
  const openLabel = targets.length === 1 ? 'Open' : undefined;
  const actions = [openLabel, process.platform === 'darwin' ? 'Reveal in Finder' : 'Reveal in File Explorer'].filter((action): action is string => Boolean(action));
  const picked = await vscode.window.showInformationMessage(message, ...actions);
  if (!picked) return;
  const uri = vscode.Uri.file(first);
  if (picked === 'Open') {
    const binary = choice.format === 'pdf' || choice.format === 'docx';
    if (binary) await vscode.env.openExternal(uri);
    else await vscode.window.showTextDocument(uri);
  } else {
    await vscode.commands.executeCommand('revealFileInOS', uri);
  }
}

/** True when `target` is inside `folder`. */
function isInside(target: string, folder: string): boolean {
  const relative = path.relative(folder, target);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/** True when a path exists. */
async function exists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** A Scripts-view script node: `{ kind: 'script', script: { filePath } }`. */
function isScriptNode(value: unknown): value is { kind: 'script'; script: { filePath: string } } {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as { kind?: unknown; script?: { filePath?: unknown } };
  return node.kind === 'script' && typeof node.script?.filePath === 'string';
}

/** A Scripts-view season node: `{ kind: 'group', group, folder }`. */
function isGroupNode(value: unknown): value is { kind: 'group'; group: string; folder: vscode.WorkspaceFolder } {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as { kind?: unknown; group?: unknown; folder?: unknown };
  return node.kind === 'group' && typeof node.group === 'string' && typeof node.folder === 'object' && node.folder !== null;
}

/** A readable message for an error, without a stack trace. */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
