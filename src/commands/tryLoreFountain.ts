/**
 * "Try LoreFountain" sample workspace (Spec §20): "a small demo world (2–3
 * example entities, one sample script), so onboarding happens by exploring
 * something real rather than reading instructions cold." Paired with the
 * Get Started walkthrough (`package.json`'s `contributes.walkthroughs`) as
 * its first step.
 *
 * The sample content is original (a small sci-fi freighter-crew setup, not
 * connected to any real project) — this scaffolds a brand-new folder on
 * disk and opens it, so it must never risk overwriting or mixing into an
 * existing workspace.
 *
 * `vscode`-facing glue; not covered by the vitest unit suite — verify
 * manually via the F5 Extension Development Host.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { writeDefaultConfigIfAbsent } from '../config/configFile';
import { resolveWorkspaceFolders } from '../config/folders';

const SAMPLE_ENTITIES: ReadonlyArray<{ fileName: string; content: string }> = [
  {
    fileName: 'nova-reyes.md',
    content: `---
name: Nova Reyes
type: character
aliases: []
tags: [pilot]
schema_version: 1
---

A quick-witted freighter pilot who talks to her ship more than her crew.
`,
  },
  {
    fileName: 'the-wayfarer.md',
    content: `---
name: The Wayfarer
type: location
schema_version: 1
---

A battered long-haul cargo ship, held together by duct tape and stubbornness.
`,
  },
];

const SAMPLE_GLOSSARY_TERM = {
  fileName: 'jump-drive.md',
  content: `---
term: Jump Drive
schema_version: 1
---

The faster-than-light engine that makes interstellar cargo runs possible — and occasionally, deeply inconvenient.
`,
};

const SAMPLE_SCRIPT = {
  fileName: 'sample-scene.fountain',
  content: `INT. THE WAYFARER - COCKPIT - NIGHT

SFX: jump drive spooling up

NOVA REYES
Come on, old girl. One more jump.

The console lights flicker across [[The Wayfarer]]'s hull.

NOVA REYES (CONT'D)
That's it. Almost there.
`,
};

/**
 * Register the "Try LoreFountain" command.
 *
 * @param context - The extension context to register the disposable against.
 */
export function registerTryLoreFountainCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('lorefountain.tryLoreFountain', () => void tryLoreFountainCommand()),
  );
}

async function tryLoreFountainCommand(): Promise<void> {
  const parentUris = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    title: 'Choose a location for the sample LoreFountain workspace',
    openLabel: 'Create Sample Workspace Here',
  });
  if (!parentUris || parentUris.length === 0) return; // cancelled

  const targetPath = path.join(parentUris[0].fsPath, 'lorefountain-sample');

  if (await pathExists(targetPath)) {
    const choice = await vscode.window.showWarningMessage(
      `LoreFountain: "${targetPath}" already exists.`,
      'Open It Anyway',
    );
    if (choice !== 'Open It Anyway') return;
  } else {
    await scaffoldSampleWorkspace(targetPath);
  }

  await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetPath));
}

/** Write the sample workspace's folders, config, entities, glossary term, and script to `root`. */
async function scaffoldSampleWorkspace(root: string): Promise<void> {
  const folders = resolveWorkspaceFolders(root);
  await Promise.all(
    [folders.scripts, folders.world, folders.glossary, folders.timeline, folders.notes, folders.imports].map((dir) =>
      fsp.mkdir(dir, { recursive: true }),
    ),
  );
  await writeDefaultConfigIfAbsent(root);

  for (const entity of SAMPLE_ENTITIES) {
    await fsp.writeFile(path.join(folders.world, entity.fileName), entity.content, 'utf8');
  }
  await fsp.writeFile(path.join(folders.glossary, SAMPLE_GLOSSARY_TERM.fileName), SAMPLE_GLOSSARY_TERM.content, 'utf8');
  await fsp.writeFile(path.join(folders.scripts, SAMPLE_SCRIPT.fileName), SAMPLE_SCRIPT.content, 'utf8');
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}
