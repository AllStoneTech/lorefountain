/**
 * LoreFountain extension entry point.
 *
 * Owns one {@link WorkspaceIndex} per open workspace folder — built from disk
 * on activation and kept current by a file watcher — the
 * `lorefountain.reindexWorkspace` command for a manual, safe full rebuild
 * (Spec §2.2, §23), the `lorefountain.initializeWorkspace` command that
 * scaffolds a brand-new project's standard folders and config file, and the
 * hover (§6) + wikilink completion (§6, §13.2) providers, each individually
 * toggleable via `lorefountain.hover.enabled`/`lorefountain.completion.enabled`
 * (ADR-0003 — never depend on Better Fountain, but let a user defer to it).
 *
 * The extension activates on `workspaceContains:**\/*.fountain`, the presence
 * of `lorefountain.config.json` (ADR-0006), or opening any document with the
 * `fountain` language id — but a completely fresh, empty workspace has none
 * of those yet. Command Palette invocation activates an extension regardless
 * of `activationEvents`, so `initializeWorkspace` is the bootstrap path for
 * that case. Multi-root workspaces get one independent index per folder.
 *
 * Also listens for `.fountain` renames/moves (`vscode.workspace.onDidRenameFiles`)
 * to relocate a script's cue sidecar alongside it — the sidecar is a
 * separate file next to the script, so a plain filesystem rename wouldn't
 * otherwise carry it along (`cues/sidecar.ts`'s `relocateCueSidecar`).
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { registerEntityCreationCommands } from './commands/createEntity';
import { registerCreateScriptCommand } from './commands/createScript';
import { registerExportTranscriptCommand } from './commands/exportTranscript';
import { registerInstallDemoCommand } from './commands/installDemo';
import { registerLicensingCommands } from './commands/licensing';
import { registerMigrateExistingLoreCommand } from './commands/migrateExistingLore';
import { registerNoteCommands } from './commands/notes';
import { registerReferenceCommands } from './commands/renameEntity';
import { registerStructuredSearchCommand } from './commands/structuredSearch';
import { registerTryLoreFountainCommand } from './commands/tryLoreFountain';
import { scaffoldAgentFilesIfAbsent } from './config/agentFiles';
import { writeDefaultConfigIfAbsent } from './config/configFile';
import { detectExistingCoreFolders } from './config/existingFolders';
import { scaffoldReadmesIfAbsent } from './config/readmeFiles';
import { scaffoldStoryOverviewIfAbsent } from './config/storyOverview';
import { getWorkspaceFolders } from './config/workspaceConfig';
import { relocateCueSidecar } from './cues/sidecar';
import { WorkspaceIndex } from './index/workspaceIndex';
import type { IndexStore } from './index/store';
import { getLicenseStatus } from './licensing/licenseState';
import { createFountainHoverProvider } from './providers/hoverProvider';
import { createWikilinkCompletionProvider } from './providers/completionProvider';
import { registerHelpCommands } from './providers/helpPanel';
import { ScriptsTreeProvider } from './providers/scriptsTreeProvider';
import { openSettingsPanel } from './providers/settingsPanel';
import { createStoryCardEditorProvider, STORY_CARD_VIEW_TYPE } from './providers/storyCardEditorProvider';
import { createStoryOverviewEditorProvider, STORY_OVERVIEW_VIEW_TYPE } from './providers/storyOverviewEditorProvider';
import { WorldTreeProvider } from './providers/worldTreeProvider';
import { checkGitSafety } from './safety/gitSafetyBanner';

let outputChannel: vscode.OutputChannel;
let extensionContext: vscode.ExtensionContext;
const indexes = new Map<string, WorkspaceIndex>();
let hoverRegistration: vscode.Disposable | undefined;
let completionRegistration: vscode.Disposable | undefined;
let treeProvider: WorldTreeProvider;
let scriptsTreeProvider: ScriptsTreeProvider;
/** Fires whenever any workspace folder's index changes — the pro module (if loaded) subscribes once via `ProActivationContext.onIndexChanged` to refresh its own views, without `extension.ts` needing to know anything about what those views are. */
const indexChangeEmitter = new vscode.EventEmitter<void>();

/**
 * Called by VS Code when the extension is activated. Async because deciding
 * whether the pro tier activates now waits on {@link getLicenseStatus}
 * (currently instant — see `licensing/validateLicense.ts`'s stub — but
 * written so a real network-backed check drops in without restructuring
 * this function).
 *
 * @param context - The extension context provided by the VS Code host.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  extensionContext = context;
  outputChannel = vscode.window.createOutputChannel('LoreFountain');
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand('lorefountain.reindexWorkspace', () => void rebuildAllWorkspaceIndexes()),
    vscode.commands.registerCommand('lorefountain.initializeWorkspace', () => void initializeWorkspace()),
    vscode.commands.registerCommand('lorefountain.openSettings', () => void openSettings()),
  );
  registerEntityCreationCommands(context, pickTargetWorkspaceFolder);
  registerCreateScriptCommand(context, pickTargetWorkspaceFolder);
  registerNoteCommands(context, pickTargetWorkspaceFolder);
  registerReferenceCommands(context, outputChannel, findStoreForFolder);
  registerExportTranscriptCommand(context);
  registerStructuredSearchCommand(context, outputChannel, pickTargetWorkspaceFolder, findStoreForFolder);
  registerTryLoreFountainCommand(context);
  registerInstallDemoCommand(context);
  registerMigrateExistingLoreCommand(context, pickTargetWorkspaceFolder);
  registerLicensingCommands(context);
  registerHelpCommands(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      STORY_CARD_VIEW_TYPE,
      createStoryCardEditorProvider(findStoreForDocument),
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      STORY_OVERVIEW_VIEW_TYPE,
      createStoryOverviewEditorProvider(),
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  treeProvider = new WorldTreeProvider(findStoreForFolder);
  context.subscriptions.push(vscode.window.registerTreeDataProvider('lorefountain.worldView', treeProvider));

  scriptsTreeProvider = new ScriptsTreeProvider(findStoreForFolder);
  context.subscriptions.push(
    vscode.window.createTreeView('lorefountain.scriptsView', {
      treeDataProvider: scriptsTreeProvider,
      dragAndDropController: scriptsTreeProvider,
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidRenameFiles((event) => {
      for (const { oldUri, newUri } of event.files) {
        if (oldUri.fsPath.toLowerCase().endsWith('.fountain')) {
          void relocateCueSidecar(oldUri.fsPath, newUri.fsPath);
        }
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      for (const removed of event.removed) {
        disposeIndexFor(removed);
      }
      for (const added of event.added) {
        void addIndexFor(added);
      }
    }),
  );

  updateProviderRegistrations();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('lorefountain.hover') ||
        event.affectsConfiguration('lorefountain.completion')
      ) {
        updateProviderRegistrations();
      }
    }),
  );

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    void addIndexFor(folder);
  }

  context.subscriptions.push(indexChangeEmitter);

  await activateProTier(context);
}

/**
 * Decide whether the pro tier actually activates, and register it (or an
 * explanatory placeholder) accordingly. Two independent gates, both must
 * pass: the `pro/` submodule must be bundled at all (unchanged from
 * ADR-0024), and — new as of ADR-0026/this licensing work — a valid license
 * key must be on file (per {@link getLicenseStatus}, currently backed by a
 * stub that always says valid, see `licensing/validateLicense.ts`).
 *
 * @param context - The extension context to register disposables against.
 */
async function activateProTier(context: vscode.ExtensionContext): Promise<void> {
  const proModule = loadProModule();
  if (!proModule) {
    // No submodule access to lorefountain-pro (or nothing built there yet)
    // — nothing to click through to fix, so no command attached.
    registerProPlaceholders(context, {
      message: 'LoreFountain Pro required — Continuity Management is a paid-tier feature.',
    });
    return;
  }

  let licenseStatus: Awaited<ReturnType<typeof getLicenseStatus>>;
  try {
    licenseStatus = await getLicenseStatus(context);
  } catch (err) {
    // Never let a license-check failure take down the rest of activation —
    // same "never throw" posture as loadProModule/parseEntityFile/etc.
    // elsewhere in this codebase. Falls back to "unlicensed" so the
    // placeholder below always registers something, rather than leaving
    // lorefountain.continuityView with no provider at all.
    outputChannel.appendLine(`[LoreFountain] License check failed: ${errorMessage(err)}`);
    licenseStatus = undefined;
  }

  if (licenseStatus?.valid) {
    proModule.activate({
      extensionContext: context,
      outputChannel,
      getStoreForFolder: findStoreForFolder,
      onIndexChanged: indexChangeEmitter.event,
    });
    return;
  }

  const message = licenseStatus
    ? `LoreFountain Pro: license not valid${licenseStatus.reason ? ` (${licenseStatus.reason})` : ''} — click to enter a new key.`
    : 'LoreFountain Pro: click to enter your license key and unlock Continuity Management.';
  registerProPlaceholders(context, { message, command: 'lorefountain.enterLicenseKey' });
}

/**
 * Every plain command (not a tree view) that does nothing but explain/link
 * to licensing when the pro tier isn't active — see
 * {@link registerProPlaceholders}. Each one gets fully replaced by its real
 * registration once `proModule.activate` runs instead (never
 * double-registered: `activateProTier` only calls
 * {@link registerProPlaceholders} on the not-licensed branch).
 */
const GATED_PRO_COMMANDS: readonly string[] = [
  'lorefountain.viewAsOfEpisode',
  'lorefountain.showEntityGraph',
  'lorefountain.exportStoryBible',
  'lorefountain.exportBBCRadioScript',
];

/**
 * Register a plain explanatory placeholder instead of leaving the
 * Continuity view showing VS Code's generic "no data provider" error, plus
 * a matching placeholder for every command in {@link GATED_PRO_COMMANDS} —
 * used whenever the pro tier isn't actually active, whatever the reason.
 * When `command` is given (the "no valid license" case, where clicking
 * through actually fixes it), both the tree row and each placeholder
 * command jump straight to it instead of just describing what to do —
 * the project owner flagged the earlier text-only placeholder as unintuitive
 * (2026-07-28): the fix was findable only via the Command Palette, not
 * discoverable from the view itself.
 */
function registerProPlaceholders(context: vscode.ExtensionContext, options: { message: string; command?: string }): void {
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('lorefountain.continuityView', createContinuityPlaceholderProvider(options)),
  );
  for (const command of GATED_PRO_COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, () =>
        options.command
          ? void vscode.commands.executeCommand(options.command)
          : void vscode.window.showInformationMessage(options.message),
      ),
    );
  }
}

/** Single-leaf placeholder for the Continuity view when the pro tier isn't active — see {@link registerProPlaceholders}. */
function createContinuityPlaceholderProvider(options: { message: string; command?: string }): vscode.TreeDataProvider<string> {
  return {
    getTreeItem: (label: string) => {
      const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
      if (options.command) {
        item.command = { command: options.command, title: 'Enter License Key' };
        item.iconPath = new vscode.ThemeIcon('key');
        item.tooltip = 'Click to enter your LoreFountain Pro license key';
      }
      return item;
    },
    getChildren: () => [options.message],
  };
}

/**
 * What the free tier hands the pro module at activation — mirrors
 * `lorefountain-pro`'s own `ProActivationContext`, duplicated here rather
 * than imported since that repo isn't always present (see below). Only
 * genuine runtime state goes through this — a pure function/type from the
 * free tier (`extractScenePresence`, `IndexStore`, etc.) is something the
 * pro module can just import directly via a relative path reaching into
 * `../../src/...`, since it's always built nested inside this repo, never
 * standalone.
 */
interface ProActivationContext {
  extensionContext: vscode.ExtensionContext;
  outputChannel: vscode.OutputChannel;
  getStoreForFolder: (folder: vscode.WorkspaceFolder) => IndexStore | undefined;
  /** Fires whenever any workspace folder's index changes, so the pro module can refresh its own views. */
  onIndexChanged: vscode.Event<void>;
}

interface ProModule {
  activate(ctx: ProActivationContext): void;
}

/**
 * Load the compiled paid-tier bundle (`dist/pro.js`), if present. Built
 * from the private `lorefountain-pro` repo, consumed here as a git
 * submodule (`pro/`) — a build with no access to that repo simply never
 * produces this file (see `esbuild.js`), and this returns `undefined`
 * exactly as if no pro module existed, never throwing.
 */
function loadProModule(): ProModule | undefined {
  try {
    // A static `import` would make esbuild try to resolve dist/pro.js at
    // bundle time, defeating the whole point — it may genuinely not exist.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(path.join(__dirname, 'pro.js')) as ProModule;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') return undefined;
    outputChannel.appendLine(`[LoreFountain] Pro module failed to load: ${errorMessage(err)}`);
    return undefined;
  }
}

/**
 * Called by VS Code when the extension is deactivated. Disposes every
 * per-folder index (closing its sql.js database and file watcher) and any
 * registered providers.
 */
export function deactivate(): void {
  for (const index of indexes.values()) {
    index.dispose();
  }
  indexes.clear();
  hoverRegistration?.dispose();
  completionRegistration?.dispose();
}

/** Resolve the {@link IndexStore} for a document's workspace folder, if it has one. */
function findStoreForDocument(document: vscode.TextDocument): IndexStore | undefined {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) return undefined;
  return indexes.get(folder.uri.toString())?.store;
}

/** Resolve the {@link IndexStore} for a workspace folder directly (used by the TreeView). */
function findStoreForFolder(folder: vscode.WorkspaceFolder): IndexStore | undefined {
  return indexes.get(folder.uri.toString())?.store;
}

/**
 * (Re)register the hover and completion providers according to their current
 * `lorefountain.*.enabled` settings. Called on activation and whenever either
 * setting changes.
 */
function updateProviderRegistrations(): void {
  const config = vscode.workspace.getConfiguration('lorefountain');

  hoverRegistration?.dispose();
  hoverRegistration = config.get<boolean>('hover.enabled', true)
    ? vscode.languages.registerHoverProvider({ language: 'fountain' }, createFountainHoverProvider(findStoreForDocument))
    : undefined;

  completionRegistration?.dispose();
  completionRegistration = config.get<boolean>('completion.enabled', true)
    ? vscode.languages.registerCompletionItemProvider(
        [{ language: 'fountain' }, { language: 'markdown' }],
        createWikilinkCompletionProvider(findStoreForDocument),
        '[',
      )
    : undefined;
}

async function addIndexFor(folder: vscode.WorkspaceFolder): Promise<void> {
  try {
    const index = await WorkspaceIndex.create(folder, outputChannel);
    indexes.set(folder.uri.toString(), index);
    index.onDidChangeIndex(() => {
      treeProvider.refresh();
      scriptsTreeProvider.refresh();
      indexChangeEmitter.fire();
    });
    await index.rebuild();
    void checkGitSafetyForFolder(folder);
  } catch (err) {
    outputChannel.appendLine(
      `[LoreFountain] Failed to initialize the index for "${folder.name}": ${errorMessage(err)}`,
    );
  }
}

/**
 * Runs the Spec §13.7 git-safety check for a workspace folder, scoped to
 * folders that already have a `scripts` or `world` folder on disk.
 */
async function checkGitSafetyForFolder(folder: vscode.WorkspaceFolder): Promise<void> {
  const { folders } = await getWorkspaceFolders(folder);
  const hasWorldOrScripts = (await pathExists(folders.scripts)) || (await pathExists(folders.world));
  await checkGitSafety(extensionContext, folder, hasWorldOrScripts);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

function disposeIndexFor(folder: vscode.WorkspaceFolder): void {
  const key = folder.uri.toString();
  indexes.get(key)?.dispose();
  indexes.delete(key);
}

async function rebuildAllWorkspaceIndexes(): Promise<void> {
  if (indexes.size === 0) {
    void vscode.window.showInformationMessage('LoreFountain: no workspace folder is open.');
    return;
  }

  let entityCount = 0;
  let glossaryCount = 0;
  let scriptCount = 0;
  for (const index of indexes.values()) {
    const summary = await index.rebuild();
    entityCount += summary.entityCount;
    glossaryCount += summary.glossaryCount;
    scriptCount += summary.scriptCount;
  }

  void vscode.window.showInformationMessage(
    `LoreFountain: indexed ${entityCount} entities, ${glossaryCount} glossary terms, and ${scriptCount} scripts. ` +
      'See the "LoreFountain" output channel for details.',
  );
}

/**
 * Scaffold a workspace folder's standard folder structure (Spec §5) and write
 * a default `lorefountain.config.json` if one doesn't already exist. This is
 * the bootstrap path for a brand-new project with no config file and no
 * `.fountain` script yet — reachable via the Command Palette even before the
 * extension would otherwise activate.
 *
 * Never touches anything outside `world/` (and its `glossary`/`timeline`/
 * `notes` subfolders), `scripts/`, `imports/` (created empty, never written
 * into again — Spec §13.5's drop-zone is user-owned), and the root config
 * file. If `world` or `scripts` already exists — a workspace pointed at an
 * existing project, not a blank one — this asks before proceeding, since
 * LoreFountain didn't create that folder and shouldn't silently assume
 * ownership of whatever's already in it (the project owner, 2026-07-24).
 */
async function initializeWorkspace(): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;

  const { folders } = await getWorkspaceFolders(folder);

  const existingFolders = await detectExistingCoreFolders(folders.world, folders.scripts);
  if (existingFolders.world || existingFolders.scripts) {
    const names = [
      existingFolders.world ? path.basename(folders.world) : undefined,
      existingFolders.scripts ? path.basename(folders.scripts) : undefined,
    ].filter((name): name is string => name !== undefined);

    const proceed = 'Use Existing Folder(s)';
    const choice = await vscode.window.showWarningMessage(
      `LoreFountain found an existing "${names.join('" and "')}" folder in "${folder.name}". ` +
        "LoreFountain never touches anything outside its own folders — proceeding will index what's already there and add only what's missing (a config file, agent instructions and a validator for AI coding tools, READMEs, a Story Overview template, and any of glossary/timeline/notes/imports that don't exist yet).",
      { modal: true },
      proceed,
    );
    if (choice !== proceed) return; // cancelled — nothing written
  }

  await Promise.all(
    [folders.scripts, folders.world, folders.glossary, folders.timeline, folders.notes, folders.imports].map(
      (dir) => fsp.mkdir(dir, { recursive: true }),
    ),
  );
  const wroteConfig = await writeDefaultConfigIfAbsent(folder.uri.fsPath);

  const resourcesPath = path.join(extensionContext.extensionPath, 'resources');
  const folderNames = {
    world: path.relative(folder.uri.fsPath, folders.world) || 'world',
    scripts: path.relative(folder.uri.fsPath, folders.scripts) || 'scripts',
    imports: path.relative(folder.uri.fsPath, folders.imports) || 'imports',
  };
  await scaffoldAgentFilesIfAbsent(resourcesPath, folder.uri.fsPath);
  await scaffoldReadmesIfAbsent(resourcesPath, folder.uri.fsPath, folderNames, folder.name);
  await scaffoldStoryOverviewIfAbsent(resourcesPath, folders.world, folder.name);

  const existingIndex = indexes.get(folder.uri.toString());
  if (existingIndex) {
    await existingIndex.rebuild();
  } else {
    await addIndexFor(folder);
  }

  void vscode.window.showInformationMessage(
    wroteConfig
      ? `LoreFountain: initialized "${folder.name}" — created lorefountain.config.json and the standard folders.`
      : `LoreFountain: standard folders ensured for "${folder.name}" (lorefountain.config.json already existed).`,
  );
}

/** Open the settings webview panel for a target workspace folder, refreshing the World tree after a save. */
async function openSettings(): Promise<void> {
  const folder = await pickTargetWorkspaceFolder();
  if (!folder) return;
  openSettingsPanel(folder, () => treeProvider.refresh());
}

/** Resolve which workspace folder a workspace-scoped command should target. */
async function pickTargetWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showErrorMessage('LoreFountain: open a folder or workspace first.');
    return undefined;
  }
  if (folders.length === 1) {
    return folders[0];
  }
  return vscode.window.showWorkspaceFolderPick({ placeHolder: 'Select a workspace folder to initialize' });
}

/** Extract a message from an unknown thrown value. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
