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
 * malformed file, dangling relation, dangling asset-manifest entry, or
 * duplicate Production Code (all identity collisions/broken references, not
 * just a display ambiguity). Plain warnings — misplaced fields, an unusable
 * `Order`/Production Code value, Production Code drift, two scripts in the
 * same season sharing an `Order`, or a tagged SFX/MUSIC/AMB cue with no
 * matching `assets/manifests/audio.json` entry — don't fail the run, matching
 * how the extension treats them as non-blocking.
 */

import * as path from 'node:path';
import { readAudioManifest } from '../assets/audioManifest';
import { folderSettingsFromConfig, readLoreFountainConfig } from '../config/configFile';
import { resolveWorkspaceFolders } from '../config/folders';
import {
  readCharacterAssetManifest,
  readLocationAssetManifest,
  readObjectAssetManifest,
  readVoiceAssetManifest,
} from '../assets/entityManifest';
import type { ReadManifestFileResult } from '../assets/manifestFile';
import { buildIndexFromDisk, type IndexBuildSummary, type ProjectAssetManifests } from '../index/build';
import { createMemoryIndexStore } from '../index/memoryStore';

async function main(): Promise<void> {
  const root = path.resolve(process.argv[2] ?? '.');
  const configResult = await readLoreFountainConfig(root);
  const folders = resolveWorkspaceFolders(root, configResult.ok ? folderSettingsFromConfig(configResult.config) : {});

  if (!configResult.ok) {
    console.log(`⚠ lorefountain.config.json (${configResult.reason}): ${configResult.message} — using default folder names.\n`);
  }

  const [audio, characters, locations, objects, voice] = await Promise.all([
    readAudioManifest(folders.assets),
    readCharacterAssetManifest(folders.assets),
    readLocationAssetManifest(folders.assets),
    readObjectAssetManifest(folders.assets),
    readVoiceAssetManifest(folders.assets),
  ]);
  reportManifestIssue('assets/manifests/audio.json', audio);
  reportManifestIssue('assets/manifests/characters.json', characters);
  reportManifestIssue('assets/manifests/locations.json', locations);
  reportManifestIssue('assets/manifests/objects.json', objects);
  reportManifestIssue('assets/manifests/voice.json', voice);

  const assetManifests: ProjectAssetManifests = {
    audio: audio.ok ? audio.manifest : {},
    characters: characters.ok ? characters.manifest : {},
    locations: locations.ok ? locations.manifest : {},
    objects: objects.ok ? objects.manifest : {},
    voice: voice.ok ? voice.manifest : {},
  };

  const store = createMemoryIndexStore();
  const summary = await buildIndexFromDisk(
    store,
    {
      world: folders.world,
      glossary: folders.glossary,
      timeline: folders.timeline,
      scripts: folders.scripts,
    },
    assetManifests,
  );

  printReport(root, summary);
  process.exitCode =
    summary.malformed.length > 0 ||
    summary.danglingRelations.length > 0 ||
    summary.danglingEpisodes.length > 0 ||
    summary.duplicateProductionCodes.length > 0 ||
    summary.danglingAssetManifestEntries.length > 0
      ? 1
      : 0;
}

/** Print a one-line notice when a manifest failed to read, matching the config-file issue notice above. A missing manifest is not reported — it's the expected starting state. */
function reportManifestIssue(label: string, result: ReadManifestFileResult<unknown>): void {
  if (result.ok) return;
  console.log(`⚠ ${label} (${result.reason}): ${result.message} — treating it as empty.\n`);
}

function printReport(root: string, summary: IndexBuildSummary): void {
  console.log(
    `${summary.entityCount} entities, ${summary.glossaryCount} glossary terms, ${summary.eventCount} Timeline events, ${summary.scriptCount} scripts parsed.\n`,
  );

  const nothingToReport =
    summary.malformed.length === 0 &&
    summary.warnings.length === 0 &&
    summary.danglingRelations.length === 0 &&
    summary.danglingEpisodes.length === 0 &&
    summary.duplicateScriptOrders.length === 0 &&
    summary.duplicateProductionCodes.length === 0 &&
    summary.danglingAssetManifestEntries.length === 0;
  if (nothingToReport) {
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
    console.log(`⚠ ${summary.warnings.length} file(s) with non-blocking warnings:`);
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
    console.log('');
  }

  if (summary.danglingEpisodes.length > 0) {
    console.log(`✘ ${summary.danglingEpisodes.length} dangling arc episode(s):`);
    for (const episode of summary.danglingEpisodes) {
      console.log(`  ${path.relative(root, episode.filePath)} — arc references unknown episode "${episode.code}"`);
    }
    console.log('');
  }

  if (summary.duplicateScriptOrders.length > 0) {
    console.log(`⚠ ${summary.duplicateScriptOrders.length} duplicate script Order(s):`);
    for (const duplicate of summary.duplicateScriptOrders) {
      const where = duplicate.group ? `"${duplicate.group}"` : 'scripts/';
      console.log(`  Order ${duplicate.order} in ${where} is claimed by ${duplicate.filePaths.length} scripts:`);
      for (const filePath of duplicate.filePaths) {
        console.log(`    ${path.relative(root, filePath)}`);
      }
    }
    console.log('');
  }

  if (summary.duplicateProductionCodes.length > 0) {
    console.log(`✘ ${summary.duplicateProductionCodes.length} duplicate Production Code(s):`);
    for (const duplicate of summary.duplicateProductionCodes) {
      console.log(`  Production Code "${duplicate.productionCode}" is claimed by ${duplicate.filePaths.length} scripts:`);
      for (const filePath of duplicate.filePaths) {
        console.log(`    ${path.relative(root, filePath)}`);
      }
    }
    console.log('');
  }

  if (summary.danglingAssetManifestEntries.length > 0) {
    console.log(`✘ ${summary.danglingAssetManifestEntries.length} dangling asset-manifest entry(s):`);
    for (const entry of summary.danglingAssetManifestEntries) {
      console.log(`  ${entry.manifestFile} — "${entry.key}" doesn't match any known entity`);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
