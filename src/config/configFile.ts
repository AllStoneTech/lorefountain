/**
 * `lorefountain.config.json` — the project-owned config file (replaces
 * VS Code workspace settings for anything customizable). Lives at the
 * workspace root, holds every customizable option in one JSON object, and
 * doubles as the extension's primary activation signal
 * (`workspaceContains:lorefountain.config.json`) — deliberate, portable, and
 * readable by any tool or AI agent without VS Code API knowledge, matching
 * the files-as-truth principle (Spec §2.1).
 *
 * Reading is tolerant like the entity/glossary parsers (Spec §23): a missing
 * file is not an error (the extension may also activate off a bare
 * `.fountain` script with no config file yet, per ADR-0006) and malformed
 * JSON or a schema violation is reported, never thrown.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import { DEFAULT_FOLDERS, type FolderSettings } from './folders';

/** Filename of the config file, expected at the workspace root. */
export const CONFIG_FILE_NAME = 'lorefountain.config.json';

/** Zod schema for `lorefountain.config.json`'s contents. */
export const loreFountainConfigSchema = z
  .object({
    $schema: z.string().optional(),
    folders: z
      .object({
        world: z.string().optional(),
        scripts: z.string().optional(),
        imports: z.string().optional(),
        assets: z.string().optional(),
      })
      .optional(),
    world: z
      .object({
        /** World-tree category ids to hide from the World view (e.g. `"faction"`, `"arc"`, `"notes"`) — a project that doesn't use a category can declutter its sidebar without deleting anything. Loose strings, not a shared enum: an unrecognized id here is harmless, matching this file's existing tolerant-parsing posture. */
        hiddenCategories: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .catchall(z.unknown());

export type LoreFountainConfig = z.infer<typeof loreFountainConfigSchema>;

/** Outcome of {@link readLoreFountainConfig}. */
export type ReadConfigResult =
  | { ok: true; config: LoreFountainConfig; found: boolean }
  | { ok: false; reason: 'malformed-json' | 'invalid-schema'; message: string };

/**
 * Read and validate `lorefountain.config.json` from a workspace root.
 *
 * A missing file is not an error: it's reported as `{ ok: true, found: false,
 * config: {} }` so callers fall back to full defaults — a workspace may be
 * activated by a bare `.fountain` script before anyone has created a config
 * file (Spec ADR-0006).
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @returns The parsed config (or defaults), or a described non-throwing failure.
 */
export async function readLoreFountainConfig(workspaceRoot: string): Promise<ReadConfigResult> {
  const filePath = path.join(workspaceRoot, CONFIG_FILE_NAME);

  let text: string;
  try {
    text = await fsp.readFile(filePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: true, config: {}, found: false };
    }
    return { ok: false, reason: 'malformed-json', message: errorMessage(err) };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch (err) {
    return { ok: false, reason: 'malformed-json', message: `Invalid JSON: ${errorMessage(err)}` };
  }

  const parsed = loreFountainConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid-schema',
      message: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    };
  }

  return { ok: true, config: parsed.data, found: true };
}

/** Extract the `folders` section as a plain {@link FolderSettings} for {@link resolveWorkspaceFolders}. */
export function folderSettingsFromConfig(config: LoreFountainConfig): FolderSettings {
  return {
    world: config.folders?.world,
    scripts: config.folders?.scripts,
    imports: config.folders?.imports,
    assets: config.folders?.assets,
  };
}

/** Extract `world.hiddenCategories` from a parsed config, defaulting to none hidden. */
export function hiddenCategoriesFromConfig(config: LoreFountainConfig): string[] {
  return config.world?.hiddenCategories ?? [];
}

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
 * @param updates - Fields to merge in; `folders`/`world` are merged one level deep, everything else shallowly at the top level.
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
  };

  await fsp.writeFile(filePath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
}

/** Shallow-merge two optional config sub-objects, or return `undefined` if both are absent (so the merged config doesn't grow an empty `{}` section). */
function mergeSection<T extends object>(base: T | undefined, update: T | undefined): T | undefined {
  if (!base && !update) return undefined;
  return { ...base, ...update } as T;
}

/** Extract a message from an unknown thrown value. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
