/**
 * `lorefountain.config.json` — the project-owned config file (replaces
 * VS Code workspace settings for anything customizable). Lives at the
 * workspace root, holds every customizable option in one JSON object, and
 * doubles as the extension's primary activation signal
 * (`workspaceContains:lorefountain.config.json`) — deliberate, portable, and
 * readable by any tool or AI agent without VS Code API knowledge, matching
 * the files-as-truth principle (Spec §2.1).
 *
 * Reading (the schema, {@link readLoreFountainConfig} and the section
 * helpers) lives in LoreFountain-Core (`config/readConfig`, ADR-0042) and is
 * re-exported here, so existing imports keep working. Writing stays in the
 * extension, because Core never writes a LoreFountain file.
 *
 * Reading is tolerant like the entity/glossary parsers (Spec §23): a missing
 * file is not an error (the extension may also activate off a bare
 * `.fountain` script with no config file yet, per ADR-0006) and malformed
 * JSON or a schema violation is reported, never thrown.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { CONFIG_FILE_NAME, readLoreFountainConfig, type LoreFountainConfig } from 'lorefountain-core/config/readConfig';
import { DEFAULT_FOLDERS } from './folders';

export * from 'lorefountain-core/config/readConfig';

/**
 * Write a default `lorefountain.config.json` to a workspace root, unless one
 * already exists there.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @returns `true` if a file was written, `false` if one already existed (left untouched).
 */
export async function writeDefaultConfigIfAbsent(workspaceRoot: string): Promise<boolean> {
  const filePath = path.join(workspaceRoot, CONFIG_FILE_NAME);
  try {
    await fsp.access(filePath);
    return false;
  } catch {
    // Does not exist yet — proceed to write the default.
  }

  // No `$schema` field: editor validation/autocomplete for this file comes
  // from the extension's `contributes.jsonValidation` manifest entry, which
  // VS Code applies by filename match — a relative `$schema` path here would
  // point at the extension's own install directory, not the user's workspace,
  // and wouldn't resolve.
  const defaultConfig: LoreFountainConfig = {
    folders: { ...DEFAULT_FOLDERS },
  };
  await fsp.writeFile(filePath, `${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8');
  return true;
}

/**
 * Merge partial updates into `lorefountain.config.json` and write it back —
 * the general-purpose counterpart to {@link writeDefaultConfigIfAbsent}
 * (write-if-absent only). Reads the existing file first (falling back to `{}`
 * if it's missing or currently invalid) so `$schema`, unrelated top-level
 * keys, and unrelated `folders`/`world` sub-fields survive the write
 * untouched — only the fields present in `updates` change.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @param updates - Fields to merge in; `folders`/`world` are merged one level deep, `comic` two levels (so `comic.limits` keeps its other limits), everything else shallowly at the top level.
 */
export async function writeLoreFountainConfig(
  workspaceRoot: string,
  updates: LoreFountainConfig,
): Promise<void> {
  const filePath = path.join(workspaceRoot, CONFIG_FILE_NAME);
  const existing = await readLoreFountainConfig(workspaceRoot);
  const base: LoreFountainConfig = existing.ok ? existing.config : {};

  const merged: LoreFountainConfig = {
    ...base,
    ...updates,
    folders: mergeSection(base.folders, updates.folders),
    world: mergeSection(base.world, updates.world),
    comic: mergeComic(base.comic, updates.comic),
  };

  await fsp.writeFile(filePath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
}

/** A plain (non-array, non-null) object, or `undefined`. */
function asPlainObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/**
 * Merge the `comic` block (`preset`, `sfxAsCue`, `limits`): one level deep, and `limits` one more, so
 * writing one limit keeps the others. Tolerant: anything that isn't an object counts as absent, and
 * the existing value is kept if the update isn't an object either. Never throws.
 */
function mergeComic(base: unknown, update: unknown): LoreFountainConfig['comic'] {
  const baseObject = asPlainObject(base);
  const updateObject = asPlainObject(update);
  if (!baseObject && !updateObject) return update === undefined ? base : update;
  const merged: Record<string, unknown> = { ...baseObject, ...updateObject };
  const limits = { ...asPlainObject(baseObject?.limits), ...asPlainObject(updateObject?.limits) };
  if (Object.keys(limits).length > 0) merged.limits = limits;
  return merged;
}

/** Shallow-merge two optional config sub-objects, or return `undefined` if both are absent (so the merged config doesn't grow an empty `{}` section). */
function mergeSection<T extends object>(base: T | undefined, update: T | undefined): T | undefined {
  if (!base && !update) return undefined;
  return { ...base, ...update } as T;
}
