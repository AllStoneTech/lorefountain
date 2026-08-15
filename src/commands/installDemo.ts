/**
 * "Install Demo" (ADR-0031): downloads a full demo world from the
 * `AllStoneTech/lorefountain` repo's `demos/` folder and opens it in a new
 * window — for a user who wants to explore a real, finished project rather
 * than the minimal sample `lorefountain.tryLoreFountain` scaffolds.
 *
 * Always downloads into a brand-new folder and opens it in a new window
 * (never the currently open workspace) — same non-destructive posture as
 * `tryLoreFountain.ts`. Downloads to a staging folder *next to* the chosen
 * target first, then renames it into place only once every file has
 * succeeded — a same-directory rename is always atomic and same-volume, so
 * a failed or cancelled download never leaves a half-written folder at the
 * name the user actually chose.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite (would require
 * a live network call or a mocked extension host) — verify manually via the
 * F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { DEMO_CATALOG, DEMO_REPO } from '../demos/demoCatalog';
import { downloadDemoFiles, listDemoFiles } from '../demos/demoDownloader';
import { registerTrackedCommand } from '../telemetry/trackedCommands';

/**
 * Register the `lorefountain.installDemo` command.
 *
 * @param context - The extension context to register the disposable against.
 */
export function registerInstallDemoCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    registerTrackedCommand(context, 'lorefountain.installDemo', () => void installDemoCommand()),
  );
}

async function installDemoCommand(): Promise<void> {
  const picked = await vscode.window.showQuickPick(
    DEMO_CATALOG.map((demo) => ({ label: demo.label, description: demo.description, demo })),
    { title: 'Install a LoreFountain Demo World', placeHolder: 'Choose a demo to download' },
  );
  if (!picked) return; // cancelled

  const parentUris = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    title: `Choose a location for "${picked.demo.label}"`,
    openLabel: 'Install Here',
  });
  if (!parentUris || parentUris.length === 0) return; // cancelled

  const targetPath = path.join(parentUris[0].fsPath, picked.demo.id);
  if (await pathExists(targetPath)) {
    void vscode.window.showErrorMessage(
      `LoreFountain: "${targetPath}" already exists. Choose a different location and try again.`,
    );
    return;
  }

  const stagingPath = path.join(parentUris[0].fsPath, `.${picked.demo.id}-download-${Date.now()}`);
  await fsp.mkdir(stagingPath, { recursive: true });

  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Downloading "${picked.demo.label}"`, cancellable: false },
      async (progress) => {
        progress.report({ message: 'Finding files…' });
        const files = await listDemoFiles(DEMO_REPO.owner, DEMO_REPO.repo, DEMO_REPO.ref, picked.demo.repoPath);

        let reportedPercent = 0;
        await downloadDemoFiles(files, stagingPath, undefined, (done, total) => {
          const percent = Math.round((done / total) * 100);
          progress.report({ message: `${done}/${total} files`, increment: percent - reportedPercent });
          reportedPercent = percent;
        });
      },
    );
  } catch (err) {
    await fsp.rm(stagingPath, { recursive: true, force: true });
    void vscode.window.showErrorMessage(`LoreFountain: couldn't download "${picked.demo.label}" — ${errorMessage(err)}`);
    return;
  }

  await fsp.rename(stagingPath, targetPath);
  await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath), { forceNewWindow: true });
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
