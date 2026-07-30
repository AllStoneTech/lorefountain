/**
 * Story Card form state (Spec §6.1): pure conversion between an {@link Entity}
 * and a flat, JSON-serializable form state the webview can render and edit —
 * plus applying an edited form state back onto the entity. No `vscode`
 * dependency, so this stays unit-testable; `storyCardEditorProvider.ts` is
 * the thin `vscode`-facing wrapper that wires it to a live webview and the
 * underlying `TextDocument`.
 *
 * Scope, deliberately: the form covers every base field, the type-specific
 * fields for Character/Location/Arc, and the relationship picker (§4.5) — not
 * `tracked_fields`'s history-log entries or `custom_fields`. Both are
 * preserved on write (never dropped), just not editable here yet; per §6.1,
 * "nothing prevents a power user from opening the raw file" for those.
 * Changing an entity's type in the form does not strip its old type-specific
 * fields — they carry over as extra data on the new type and surface as a
 * misplaced-field warning (ADR-0004) on the next index build, which is
 * correct, not a bug: files-as-truth means data is never silently discarded.
 */

import {
  entityFrontmatterSchema,
  type CanonStatus,
  type Entity,
  type EntityType,
  type Mobility,
  type Relation,
} from '../model/entity';

/** One relation row in the form's relationship picker. */
export interface RelationFormState {
  target: string;
  relationType: string;
  attitude: string;
}

/** The Story Card form's full, flat, editable state. */
export interface EntityFormState {
  id: string;
  name: string;
  type: EntityType;
  aliases: string;
  pronunciation: string;
  tags: string;
  canonStatus: CanonStatus | '';
  body: string;
  relations: RelationFormState[];
  soundMotif: string;
  castingNotes: string;
  parentLocation: string;
  mobility: Mobility | '';
  episodes: string[];
}

/**
 * Flatten an entity into form state for the webview to render.
 *
 * @param entity - The entity to render in the form.
 * @returns The corresponding flat form state.
 */
export function entityToFormState(entity: Entity): EntityFormState {
  const fm = entity.frontmatter;
  return {
    id: entity.id,
    name: fm.name,
    type: fm.type,
    aliases: joinList(fm.aliases),
    pronunciation: fm.pronunciation ?? '',
    tags: joinList(fm.tags),
    canonStatus: fm.canon_status ?? '',
    body: entity.body,
    relations: (fm.relations ?? []).map(relationToFormState),
    soundMotif: fm.type === 'character' ? fm.sound_motif ?? '' : '',
    castingNotes: fm.type === 'character' ? fm.casting_notes ?? '' : '',
    parentLocation: fm.type === 'location' ? fm.parent_location ?? '' : '',
    mobility: fm.type === 'location' ? fm.mobility ?? '' : '',
    episodes: fm.type === 'arc' ? fm.episodes ?? [] : [],
  };
}

/**
 * Apply edited form state back onto an entity, producing its new state.
 *
 * Fields the form doesn't cover (`tracked_fields`, `custom_fields`,
 * `schema_version`, `appears_in`, `first_appearance`) are preserved
 * unchanged from `entity.frontmatter`.
 *
 * @param entity - The entity being edited (for its id, file path, and any preserved fields).
 * @param formState - The current form state to apply.
 * @returns The updated entity, with `frontmatter` re-validated by {@link entityFrontmatterSchema}.
 */
export function applyFormStateToEntity(entity: Entity, formState: EntityFormState): Entity {
  const relations: Relation[] = formState.relations
    .filter((r) => r.target.trim() && r.relationType.trim())
    .map((r) => ({
      target: r.target.trim(),
      relation_type: r.relationType.trim(),
      ...(r.attitude.trim() ? { attitude: r.attitude.trim() } : {}),
    }));

  const merged: Record<string, unknown> = {
    ...entity.frontmatter,
    name: formState.name.trim(),
    type: formState.type,
    aliases: undefinedIfEmpty(splitList(formState.aliases)),
    pronunciation: undefinedIfBlank(formState.pronunciation),
    tags: undefinedIfEmpty(splitList(formState.tags)),
    canon_status: formState.canonStatus || undefined,
    relations: relations.length > 0 ? relations : undefined,
  };

  if (formState.type === 'character') {
    merged.sound_motif = undefinedIfBlank(formState.soundMotif);
    merged.casting_notes = undefinedIfBlank(formState.castingNotes);
  } else if (formState.type === 'location') {
    merged.parent_location = undefinedIfBlank(formState.parentLocation);
    merged.mobility = formState.mobility || undefined;
  } else if (formState.type === 'arc') {
    merged.episodes = undefinedIfEmpty(
      formState.episodes.map((code) => code.trim()).filter((code) => code.length > 0),
    );
  }

  return { ...entity, frontmatter: entityFrontmatterSchema.parse(merged), body: formState.body };
}

function relationToFormState(relation: Relation): RelationFormState {
  return { target: relation.target, relationType: relation.relation_type, attitude: relation.attitude ?? '' };
}

/** Join a string array for a simple comma-separated text input. */
function joinList(values: string[] | undefined): string {
  return (values ?? []).join(', ');
}

/** Split a comma-separated text input back into a trimmed, non-empty string array. */
function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function undefinedIfEmpty(values: string[]): string[] | undefined {
  return values.length > 0 ? values : undefined;
}

function undefinedIfBlank(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
