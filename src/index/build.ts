/**
 * Disk <-> index integration: build the index by walking workspace folders,
 * and incrementally re-index or remove a single file (Spec §2.2 — "build from
 * files" + "incremental updates on file save").
 *
 * A full build never throws on a bad file: malformed YAML, schema violations,
 * and filesystem read errors are all collected and reported in the returned
 * summary so the index rebuild can skip/flag rather than crash (Spec §23).
 * The actual `vscode.FileSystemWatcher` wiring that calls {@link reindexFile}
 * and {@link removeFileFromIndex} on save/delete lives in the extension
 * activation layer, not here — this module has no `vscode` dependency.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { ValidationIssue } from '../model/errors';
import { parseEntityFile, type EntityWarning } from '../model/entity';
import { parseGlossaryFile } from '../model/glossary';
import { idFromFilePath } from '../model/slug';
import type { IndexStore } from './store';

/** Subfolders of `world/` that are never walked for entity files (Spec §5). */
const ENTITY_EXCLUDED_SUBDIRS = ['glossary', 'timeline', 'notes'];

/** One file that failed to parse during a build or incremental reindex. */
export interface IndexBuildIssue {
  filePath: string;
  reason: 'malformed-yaml' | 'invalid-schema' | 'read-error';
  message: string;
  issues?: ValidationIssue[];
}

/** One entity file that parsed successfully but had a misplaced-field warning (Spec §4.3/§4.4, ADR-0004). */
export interface IndexBuildWarning {
  filePath: string;
  warnings: EntityWarning[];
}

/** Summary of a full {@link buildIndexFromDisk} pass. */
export interface IndexBuildSummary {
  entityCount: number;
  glossaryCount: number;
  malformed: IndexBuildIssue[];
  warnings: IndexBuildWarning[];
}

/** The two kinds of `.md` file the index tracks. Notes (§13.4) are never indexed. */
export type IndexableFileKind = 'entity' | 'glossary';

/** Outcome of {@link reindexFile}. */
export type ReindexFileResult =
  | { ok: true; warnings: EntityWarning[] }
  | { ok: false; reason: IndexBuildIssue['reason']; message: string; issues?: ValidationIssue[] };

/**
 * Rebuild the index by walking `folders.world` (for entities, excluding the
 * reserved `glossary/`, `timeline/`, and `notes/` subfolders) and
 * `folders.glossary` (for glossary terms), upserting every file that parses.
 *
 * Safe to call against a workspace where these folders don't exist yet — an
 * absent folder simply contributes zero files, not an error.
 *
 * @param store - The index to populate.
 * @param folders - Absolute paths to the `world` and `glossary` folders.
 * @returns Counts of what was indexed, plus any malformed files or warnings.
 */
export async function buildIndexFromDisk(
  store: IndexStore,
  folders: { world: string; glossary: string },
): Promise<IndexBuildSummary> {
  const summary: IndexBuildSummary = { entityCount: 0, glossaryCount: 0, malformed: [], warnings: [] };

  const entityFiles = await listMarkdownFiles(folders.world, ENTITY_EXCLUDED_SUBDIRS);
  for (const filePath of entityFiles) {
    const result = await reindexFile(store, filePath, 'entity');
    if (result.ok) {
      summary.entityCount += 1;
      if (result.warnings.length > 0) {
        summary.warnings.push({ filePath, warnings: result.warnings });
      }
    } else {
      summary.malformed.push({ filePath, reason: result.reason, message: result.message, issues: result.issues });
    }
  }

  const glossaryFiles = await listMarkdownFiles(folders.glossary);
  for (const filePath of glossaryFiles) {
    const result = await reindexFile(store, filePath, 'glossary');
    if (result.ok) {
      summary.glossaryCount += 1;
    } else {
      summary.malformed.push({ filePath, reason: result.reason, message: result.message, issues: result.issues });
    }
  }

  return summary;
}

/**
 * Re-parse a single file and upsert it into the index. Used both by the full
 * disk build and by incremental file-watcher updates on save.
 *
 * @param store - The index to update.
 * @param filePath - Absolute path to the changed file.
 * @param kind - Whether the file is an entity or a glossary term.
 * @returns Success with any warnings, or a described, non-throwing failure.
 */
export async function reindexFile(
  store: IndexStore,
  filePath: string,
  kind: IndexableFileKind,
): Promise<ReindexFileResult> {
  let text: string;
  try {
    text = await fsp.readFile(filePath, 'utf8');
  } catch (err) {
    return { ok: false, reason: 'read-error', message: errorMessage(err) };
  }

  const id = idFromFilePath(filePath);
  if (kind === 'entity') {
    const result = parseEntityFile(text, { id, filePath });
    if (!result.ok) {
      return { ok: false, reason: result.reason, message: result.message, issues: result.issues };
    }
    store.upsertEntity(result.entity);
    return { ok: true, warnings: result.warnings };
  }

  const result = parseGlossaryFile(text, { id, filePath });
  if (!result.ok) {
    return { ok: false, reason: result.reason, message: result.message, issues: result.issues };
  }
  store.upsertGlossaryTerm(result.term);
  return { ok: true, warnings: [] };
}

/**
 * Remove a deleted file's row from the index. Safe to call even if the file
 * was never indexed (e.g. it was malformed, or is outside the indexed folders).
 *
 * @param store - The index to update.
 * @param filePath - Absolute path to the deleted file.
 * @param kind - Whether the file was an entity or a glossary term.
 */
export function removeFileFromIndex(store: IndexStore, filePath: string, kind: IndexableFileKind): void {
  if (kind === 'entity') {
    store.removeEntityByPath(filePath);
  } else {
    store.removeGlossaryTermByPath(filePath);
  }
}

/**
 * Recursively collect `.md` file paths under `dir`, skipping any directory
 * whose name appears in `excludeSubdirNames` at any depth. Returns an empty
 * array if `dir` does not exist.
 */
async function listMarkdownFiles(dir: string, excludeSubdirNames: string[] = []): Promise<string[]> {
  const excluded = new Set(excludeSubdirNames);
  const results: string[] = [];
  await walk(dir, excluded, results);
  return results;
}

async function walk(dir: string, excluded: Set<string>, out: string[]): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (excluded.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), excluded, out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(path.join(dir, entry.name));
    }
  }
}

/** Extract a message from an unknown thrown value. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
