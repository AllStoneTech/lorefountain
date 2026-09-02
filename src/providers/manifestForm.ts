/**
 * Asset manifest form state: pure conversion between a manifest file's JSON
 * text and a flat, JSON-serializable form state the manifest editor's
 * webview can render and edit — plus converting an edited form state back
 * into the on-disk manifest shape. No `vscode` dependency, so this stays
 * unit-testable; `manifestEditorProvider.ts` is the thin `vscode`-facing
 * wrapper that wires it to a live webview and the underlying `TextDocument`
 * (see that module's doc comment — same whole-document-replace pattern as
 * `storyCardForm.ts`/`storyCardEditorProvider.ts`).
 *
 * Five manifest files share this one editor, distinguished by `ManifestKind`
 * (derived from the filename by the provider): `audio` is flat — one
 * `{file, source?, license?}` per cue tag, no persistent-identity concept.
 * `characters`/`locations`/`objects`/`voice` are "entity-keyed" — versions
 * (a persistent baseline) plus, for `characters`/`locations`/`objects`, a
 * named variant array (`looks` or `dressing`; `voice` has none) — see
 * `assets/entityManifest.ts` for why. Both shapes are handled by the same
 * row-based `ManifestFormState`, discriminated by `kind`, so the client
 * script's row-rendering logic doesn't need to fork per manifest file.
 *
 * A row is dropped from what gets serialized (not from the live form state —
 * the user keeps seeing what they typed) only once it's still entirely
 * blank: an entity-keyed row needs a non-empty key and at least one version
 * with *something* filled in; a flat row needs a non-empty key. This mirrors
 * `storyCardForm.ts`'s relation/episode filtering, just tuned looser for a
 * two-level nested list — filtering too eagerly here would make a
 * still-being-typed sub-row visibly vanish the instant an edit round-trips
 * through the document (see this module's test suite for the exact rule).
 */

import {
  audioManifestSchema,
  type AudioManifest,
  type AudioManifestEntry,
} from '../assets/audioManifest';
import {
  characterAssetManifestSchema,
  dressedAssetManifestSchema,
  voiceAssetManifestSchema,
  type AssetVariantEntry,
  type AssetVersionEntry,
  type CharacterAssetManifest,
  type DressedAssetManifest,
  type VoiceAssetManifest,
} from '../assets/entityManifest';

/** Which manifest file is open, derived from its filename by the provider. */
export type ManifestKind = 'audio' | 'characters' | 'locations' | 'objects' | 'voice';

/** One row in a flat manifest (`audio.json`): a cue tag mapped directly to one asset. */
export interface FlatManifestRow {
  key: string;
  file: string;
  source: string;
  license: string;
}

/** One version sub-row: the entity's asset as of a persistent baseline. */
export interface ManifestVersionRow {
  version: string;
  file: string;
  source: string;
  license: string;
}

/** One variant sub-row: a named, temporary/swappable "look" or "dressing", scoped under its entity. */
export interface ManifestVariantRow {
  label: string;
  file: string;
  source: string;
  license: string;
}

/** One row in an entity-keyed manifest (`characters`/`locations`/`objects`/`voice`): an entity slug plus its versions and (for characters/locations/objects) variants. */
export interface VersionedManifestRow {
  key: string;
  versions: ManifestVersionRow[];
  /** Always empty for `voice` — that kind has no variant axis; the webview simply never renders a section for it. */
  variants: ManifestVariantRow[];
}

/** The manifest editor's full, flat, editable state — discriminated by `kind` so the two row shapes (flat vs. entity-keyed) stay type-distinct. */
export type ManifestFormState =
  | { kind: 'audio'; rows: FlatManifestRow[] }
  | { kind: 'characters' | 'locations' | 'objects' | 'voice'; rows: VersionedManifestRow[] };

/** Which label a `VersionedManifestRow`'s variant array serializes under for a given kind, or `undefined` for a kind with no variant axis (`voice`). */
export function variantFieldNameFor(kind: ManifestKind): 'looks' | 'dressing' | undefined {
  if (kind === 'characters') return 'looks';
  if (kind === 'locations' || kind === 'objects') return 'dressing';
  return undefined;
}

/**
 * Derive a manifest's kind from its filename (`audio.json` -> `'audio'`,
 * etc.). `undefined` for anything else — the editor provider only ever
 * resolves this for the five filenames its `customEditors` selector matches.
 *
 * @param fileName - The manifest file's base name, e.g. `path.basename(uri.fsPath)`.
 */
export function manifestKindFromFileName(fileName: string): ManifestKind | undefined {
  switch (fileName) {
    case 'audio.json':
      return 'audio';
    case 'characters.json':
      return 'characters';
    case 'locations.json':
      return 'locations';
    case 'objects.json':
      return 'objects';
    case 'voice.json':
      return 'voice';
    default:
      return undefined;
  }
}

/**
 * Parse and validate a manifest file's raw text for the given kind.
 *
 * @param kind - Which manifest schema to validate against.
 * @param text - The document's current full text.
 * @returns The corresponding form state, or `undefined` if the text isn't valid JSON or fails that kind's schema — the provider shows a plain-text fallback in that case, same posture as a malformed Story Card.
 */
export function parseManifestText(kind: ManifestKind, text: string): ManifestFormState | undefined {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }

  if (kind === 'audio') {
    const result = audioManifestSchema.safeParse(json);
    return result.success ? { kind, rows: audioManifestToRows(result.data) } : undefined;
  }

  const schema = kind === 'characters' ? characterAssetManifestSchema : kind === 'voice' ? voiceAssetManifestSchema : dressedAssetManifestSchema;
  const result = schema.safeParse(json);
  if (!result.success) return undefined;
  return { kind, rows: entityManifestToRows(result.data) };
}

function audioManifestToRows(manifest: AudioManifest): FlatManifestRow[] {
  return Object.entries(manifest).map(([key, entry]) => entryToFlatRow(key, entry));
}

function entryToFlatRow(key: string, entry: AudioManifestEntry): FlatManifestRow {
  return { key, file: entry.file, source: entry.source ?? '', license: entry.license ?? '' };
}

/** An entity-keyed manifest entry, loosened to its two possible optional variant fields for uniform reading regardless of which manifest kind produced it. */
interface AnyEntityAssetEntry {
  versions: AssetVersionEntry[];
  looks?: AssetVariantEntry[];
  dressing?: AssetVariantEntry[];
}

function entityManifestToRows(
  manifest: CharacterAssetManifest | DressedAssetManifest | VoiceAssetManifest,
): VersionedManifestRow[] {
  return Object.entries(manifest as Record<string, AnyEntityAssetEntry>).map(([key, entry]) => ({
    key,
    versions: entry.versions.map(versionToRow),
    variants: (entry.looks ?? entry.dressing ?? []).map(variantToRow),
  }));
}

function versionToRow(version: AssetVersionEntry): ManifestVersionRow {
  return { version: String(version.version), file: version.file, source: version.source ?? '', license: version.license ?? '' };
}

function variantToRow(variant: AssetVariantEntry): ManifestVariantRow {
  return { label: variant.label, file: variant.file, source: variant.source ?? '', license: variant.license ?? '' };
}

/**
 * Convert an edited form state back into the plain object `JSON.stringify`d
 * to disk. Rows that are still entirely blank are dropped — see the module
 * doc comment for exactly what "blank" means for each row kind.
 *
 * @param formState - The current form state to serialize.
 * @returns The on-disk manifest object (not yet stringified).
 */
export function applyFormStateToManifest(
  formState: ManifestFormState,
): AudioManifest | CharacterAssetManifest | DressedAssetManifest | VoiceAssetManifest {
  if (formState.kind === 'audio') {
    const manifest: AudioManifest = {};
    for (const row of formState.rows) {
      const key = row.key.trim();
      if (!key || !row.file.trim()) continue;
      manifest[key] = { file: row.file.trim(), ...optionalField('source', row.source), ...optionalField('license', row.license) };
    }
    return manifest;
  }

  const variantFieldName = variantFieldNameFor(formState.kind);
  const manifest: Record<string, { versions: AssetVersionEntry[] } & Record<string, unknown>> = {};
  for (const row of formState.rows) {
    const key = row.key.trim();
    const versions = row.versions
      .filter((v) => v.file.trim() || v.version.trim())
      .map(rowToVersion);
    if (!key || versions.length === 0) continue;

    const entry: { versions: AssetVersionEntry[] } & Record<string, unknown> = { versions };
    if (variantFieldName) {
      const variants = row.variants.filter((v) => v.file.trim() || v.label.trim()).map(rowToVariant);
      if (variants.length > 0) entry[variantFieldName] = variants;
    }
    manifest[key] = entry;
  }
  return manifest as CharacterAssetManifest | DressedAssetManifest | VoiceAssetManifest;
}

/** Serialize a form state straight to the file text `manifestEditorProvider.ts` writes back, matching every other JSON writer in this codebase (2-space indent, trailing newline). */
export function serializeManifestFormState(formState: ManifestFormState): string {
  return `${JSON.stringify(applyFormStateToManifest(formState), null, 2)}\n`;
}

function rowToVersion(row: ManifestVersionRow): AssetVersionEntry {
  return {
    version: parseVersionNumber(row.version),
    file: row.file.trim(),
    ...optionalField('source', row.source),
    ...optionalField('license', row.license),
  } as AssetVersionEntry;
}

function rowToVariant(row: ManifestVariantRow): AssetVariantEntry {
  return {
    label: row.label.trim(),
    file: row.file.trim(),
    ...optionalField('source', row.source),
    ...optionalField('license', row.license),
  };
}

/**
 * Parse a version row's free-text input into the number the schema expects.
 * A blank or non-positive-integer value is passed through as the raw trimmed
 * string instead of guessed at or dropped — the next `validate.js`/index
 * build then reports a clear schema-violation error, rather than the editor
 * silently defaulting to some made-up version number.
 */
function parseVersionNumber(raw: string): number | string {
  const trimmed = raw.trim();
  const parsed = Number(trimmed);
  return trimmed !== '' && Number.isInteger(parsed) && parsed > 0 ? parsed : trimmed;
}

function optionalField(name: 'source' | 'license', value: string): Record<string, string> {
  const trimmed = value.trim();
  return trimmed ? { [name]: trimmed } : {};
}
