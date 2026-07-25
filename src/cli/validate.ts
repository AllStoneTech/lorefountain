/**
 * Headless validator (the project owner, 2026-07-25): the same schema and
 * dangling-relation checks the extension runs live, invocable from a plain
 * `node` process with no VS Code involved. Built for an AI coding agent (or
 * CI) working on a LoreFountain project without the extension host running
 * — most of what an AI can check about its own work today requires a human
 * to open the project in VS Code and read the Output channel.
 *
 * This is a separate esbuild entry point from the extension itself
 * (`esbuild.js`'s `cli` target) — bundled into one dependency-free script
 * with no `vscode` import, so it's scaffolded straight into a project by
 * `Initialize Workspace` and runs anywhere with `node validate.js`.
 *
 * Exit code is `0` when nothing is wrong, `1` when there's at least one
 * malformed file or dangling relation (misplaced-field warnings alone
 * don't fail the run, matching how the extension treats them as
 * non-blocking).
 */

import * as path from 'node:path';
import { folderSettingsFromConfig, readLoreFountainConfig } from '../config/configFile';
import { resolveWorkspaceFolders } from '../config/folders';
import { buildIndexFromDisk, type IndexBuildSummary } from '../index/build';
import { createMemoryIndexStore } from '../index/memoryStore';

async function main(): Promise<void> {
  const root = path.resolve(process.argv[2] ?? '.');
  const configResult = await readLoreFountainConfig(root);
  const folders = resolveWorkspaceFolders(root, configResult.ok ? folderSettingsFromConfig(configResult.config) : {});

  if (!configResult.ok) {
    console.log(`⚠ lorefountain.config.json (${configResult.reason}): ${configResult.message} — using default folder names.\n`);
  }

  const store = createMemoryIndexStore();
  const summary = await buildIndexFromDisk(store, {
    world: folders.world,
    glossary: folders.glossary,
    scripts: folders.scripts,
  });

  printReport(root, summary);
  process.exitCode = summary.malformed.length > 0 || summary.danglingRelations.length > 0 ? 1 : 0;
}

function printReport(root: string, summary: IndexBuildSummary): void {
  console.log(`${summary.entityCount} entities, ${summary.glossaryCount} glossary terms, ${summary.scriptCount} scripts parsed.\n`);

  if (summary.malformed.length === 0 && summary.warnings.length === 0 && summary.danglingRelations.length === 0) {
    console.log('All clear.');
    return;
  }

  if (summary.malformed.length > 0) {
    console.log(`✘ ${summary.malformed.length} malformed file(s):`);
    for (const issue of summary.malformed) {
      console.log(`  ${path.relative(root, issue.filePath)} — ${issue.reason}: ${issue.message}`);
    }
    console.log('');
  }

  if (summary.warnings.length > 0) {
    console.log(`⚠ ${summary.warnings.length} file(s) with misplaced-field warnings:`);
    for (const entry of summary.warnings) {
      for (const warning of entry.warnings) {
        console.log(`  ${path.relative(root, entry.filePath)} — ${warning.message}`);
      }
    }
    console.log('');
  }

  if (summary.danglingRelations.length > 0) {
    console.log(`✘ ${summary.danglingRelations.length} dangling relation(s):`);
    for (const relation of summary.danglingRelations) {
      console.log(
        `  ${path.relative(root, relation.filePath)} — relation "${relation.relationType}" targets unknown entity "${relation.target}"`,
      );
    }
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
