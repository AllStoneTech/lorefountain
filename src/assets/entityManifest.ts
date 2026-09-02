/**
 * Entity-keyed asset manifests: `characters.json`, `locations.json`,
 * `objects.json`, and `voice.json` under `assets/manifests/`, each mapping an
 * *existing* entity slug (a character/location/object's own id — see
 * `model/slug.ts`) to the recurring visual/audio assets that fulfill it. This
 * is the deliberate opposite of `audioManifest.ts`'s cue `[tag]` scheme: an
 * entity already has a stable, renameable-safe identity (its slug, the same
 * one `[[Wikilink]]`s and relations resolve against, kept in sync by
 * `commands/renameEntity.ts`), so a fresh tag namespace here would just be a
 * second, rename-unsafe identity for the same thing.
 *
 * Every entry separates two axes:
 *  - `versions` — the entity's persistent baseline over story-time (Lucien
 *    v1 vs. v2 once he gets a scar in Season 2). A script/scene pins a
 *    specific version, so nothing earlier in continuity retroactively
 *    changes. Required, at least one.
 *  - a named variant array, scoped *underneath* the entity (its labels only
 *    need to be unique within that one entity, not project-wide) — `looks`
 *    for a character (wardrobe + non-permanent makeup, art-department
 *    terminology) or `dressing` for a location/object (a temporary/swappable
 *    condition — "night," "broken-desk" — as opposed to a permanent change,
 *    which is a new version instead). `voice.json` has no variant axis at
 *    all: just `versions`.
 *
 * A manifest key with no matching entity (a typo, or an entity that was
 * renamed/deleted without updating the manifest) is an error-level "dangling
 * manifest entry" — see {@link findDanglingManifestEntries} — the same
 * severity as a dangling relation target (`index/relations.ts`), since it's
 * a broken reference, not a "not sourced yet" situation the way an unmapped
 * cue tag is.
 */

import { z } from 'zod';
import { readManifestFile, type ReadManifestFileResult } from './manifestFile';

/**
 * Every entry schema below is `.strict()`, deliberately unlike the tolerant,
 * catchall entity-frontmatter schema (`model/entity.ts`, ADR-0004): frontmatter
 * stays open because it's a stable, evolving per-type shape where an unknown
 * field might be a legitimately preserved `custom_fields`-style extra. A
 * manifest entry has no such concept — a stray key here is always either a
 * typo or a field from the wrong manifest kind (e.g. `dressing` pasted into
 * a `voice.json` entry), and Zod's default behavior would otherwise silently
 * drop it rather than surface the mistake.
 */

/** One version entry: the entity's asset as of a specific, persistent baseline. */
export const assetVersionEntrySchema = z
  .object({
    version: z.number().int().positive(),
    file: z.string(),
    source: z.string().optional(),
    license: z.string().optional(),
  })
  .strict();

/** One named, temporary/swappable variant (a "look" or a "dressing"), scoped under its entity. */
export const assetVariantEntrySchema = z
  .object({
    label: z.string(),
    file: z.string(),
    source: z.string().optional(),
    license: z.string().optional(),
  })
  .strict();

export type AssetVersionEntry = z.infer<typeof assetVersionEntrySchema>;
export type AssetVariantEntry = z.infer<typeof assetVariantEntrySchema>;

/** `characters.json` entry shape: versions plus `looks`. */
export const characterAssetEntrySchema = z
  .object({
    versions: z.array(assetVersionEntrySchema).min(1),
    looks: z.array(assetVariantEntrySchema).optional(),
  })
  .strict();

/** `locations.json`/`objects.json` entry shape: versions plus `dressing` — identical shape, reused for both. */
export const dressedAssetEntrySchema = z
  .object({
    versions: z.array(assetVersionEntrySchema).min(1),
    dressing: z.array(assetVariantEntrySchema).optional(),
  })
  .strict();

/** `voice.json` entry shape: versions only, no variant axis. */
export const voiceAssetEntrySchema = z
  .object({
    versions: z.array(assetVersionEntrySchema).min(1),
  })
  .strict();

export const characterAssetManifestSchema = z.record(z.string(), characterAssetEntrySchema);
export const dressedAssetManifestSchema = z.record(z.string(), dressedAssetEntrySchema);
export const voiceAssetManifestSchema = z.record(z.string(), voiceAssetEntrySchema);

export type CharacterAssetEntry = z.infer<typeof characterAssetEntrySchema>;
export type DressedAssetEntry = z.infer<typeof dressedAssetEntrySchema>;
export type VoiceAssetEntry = z.infer<typeof voiceAssetEntrySchema>;

export type CharacterAssetManifest = z.infer<typeof characterAssetManifestSchema>;
export type DressedAssetManifest = z.infer<typeof dressedAssetManifestSchema>;
export type VoiceAssetManifest = z.infer<typeof voiceAssetManifestSchema>;

const CHARACTER_MANIFEST_PATH = ['manifests', 'characters.json'];
const LOCATION_MANIFEST_PATH = ['manifests', 'locations.json'];
const OBJECT_MANIFEST_PATH = ['manifests', 'objects.json'];
const VOICE_MANIFEST_PATH = ['manifests', 'voice.json'];

/** Read and validate `assets/manifests/characters.json`. See `manifestFile.ts` for the tolerant-read contract. */
export async function readCharacterAssetManifest(
  assetsRoot: string,
): Promise<ReadManifestFileResult<CharacterAssetManifest>> {
  return readManifestFile(assetsRoot, CHARACTER_MANIFEST_PATH, characterAssetManifestSchema, {});
}

/** Read and validate `assets/manifests/locations.json`. See `manifestFile.ts` for the tolerant-read contract. */
export async function readLocationAssetManifest(
  assetsRoot: string,
): Promise<ReadManifestFileResult<DressedAssetManifest>> {
  return readManifestFile(assetsRoot, LOCATION_MANIFEST_PATH, dressedAssetManifestSchema, {});
}

/** Read and validate `assets/manifests/objects.json`. See `manifestFile.ts` for the tolerant-read contract. */
export async function readObjectAssetManifest(
  assetsRoot: string,
): Promise<ReadManifestFileResult<DressedAssetManifest>> {
  return readManifestFile(assetsRoot, OBJECT_MANIFEST_PATH, dressedAssetManifestSchema, {});
}

/** Read and validate `assets/manifests/voice.json`. See `manifestFile.ts` for the tolerant-read contract. */
export async function readVoiceAssetManifest(assetsRoot: string): Promise<ReadManifestFileResult<VoiceAssetManifest>> {
  return readManifestFile(assetsRoot, VOICE_MANIFEST_PATH, voiceAssetManifestSchema, {});
}

/** One manifest key with no matching entity — a stale entry (typo, or a rename/delete the manifest wasn't updated for). */
export interface DanglingManifestEntry {
  /** Project-relative manifest path, e.g. `assets/manifests/characters.json`, for the report. */
  manifestFile: string;
  /** The manifest key (entity slug) that doesn't resolve to any known entity of the expected type. */
  key: string;
}

/**
 * Find every key in an entity-keyed manifest with no matching entity in
 * `knownEntityIds` — the error-level counterpart to `index/build.ts`'s
 * dangling-relation check: unlike an unmapped cue tag (which can be
 * legitimately temporary), a manifest key that doesn't resolve is always a
 * broken reference, never a "not sourced yet" state, since the key is
 * supposed to already be an existing entity's id.
 *
 * @param manifest - A parsed entity-keyed manifest (characters/locations/objects/voice).
 * @param knownEntityIds - Every known id of the entity type this manifest is keyed against (e.g. every character id, for `characters.json`/`voice.json`).
 * @param manifestFile - Project-relative manifest path, for the report.
 * @returns One entry per dangling key, in the manifest's own key order.
 */
export function findDanglingManifestEntries(
  manifest: Readonly<Record<string, unknown>>,
  knownEntityIds: ReadonlySet<string>,
  manifestFile: string,
): DanglingManifestEntry[] {
  const dangling: DanglingManifestEntry[] = [];
  for (const key of Object.keys(manifest)) {
    if (!knownEntityIds.has(key)) dangling.push({ manifestFile, key });
  }
  return dangling;
}
