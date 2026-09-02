/**
 * Shared tolerant-read helper for every file under `assets/manifests/`.
 *
 * Every manifest (`audio.json`, `characters.json`, `locations.json`,
 * `objects.json`, `voice.json`) is hand-authored by the production and
 * read-only from LoreFountain's side — never generated or overwritten except
 * through the manifest editor, which still goes through the same
 * `TextDocument`/save machinery as hand-editing. Reading is tolerant,
 * matching `config/configFile.ts`'s posture: a missing file is not a problem
 * (nothing has been mapped yet), and malformed JSON or a schema violation is
 * reported, never thrown.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { z } from 'zod';

/** Outcome of {@link readManifestFile}. */
export type ReadManifestFileResult<T> =
  | { ok: true; manifest: T; found: boolean }
  | { ok: false; reason: 'malformed-json' | 'invalid-schema'; message: string };

/**
 * Read and validate one manifest file against `schema`.
 *
 * @param assetsRoot - Absolute path to the resolved `assets` folder.
 * @param relativePathSegments - Path segments under `assetsRoot`, e.g. `['manifests', 'audio.json']`.
 * @param schema - Zod schema the parsed JSON must satisfy.
 * @param emptyValue - Value to report when the file doesn't exist yet.
 * @returns The parsed, validated manifest (or `emptyValue`), or a described non-throwing failure.
 */
export async function readManifestFile<T>(
  assetsRoot: string,
  relativePathSegments: string[],
  schema: z.ZodType<T>,
  emptyValue: T,
): Promise<ReadManifestFileResult<T>> {
  const filePath = path.join(assetsRoot, ...relativePathSegments);

  let text: string;
  try {
    text = await fsp.readFile(filePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: true, manifest: emptyValue, found: false };
    }
    return { ok: false, reason: 'malformed-json', message: errorMessage(err) };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch (err) {
    return { ok: false, reason: 'malformed-json', message: `Invalid JSON: ${errorMessage(err)}` };
  }

  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid-schema',
      message: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    };
  }

  return { ok: true, manifest: parsed.data, found: true };
}

/** Extract a message from an unknown thrown value. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
