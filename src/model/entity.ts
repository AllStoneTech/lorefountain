/**
 * Entity schema and file (de)serialization.
 *
 * Defines the LoreFountain entity data model as Zod schemas (Spec §4) and the
 * tolerant parse/serialize round-trip between an entity `.md` file and an
 * in-memory {@link Entity}. Only `name` and `type` are required; every other
 * field is optional so a writer can create an entity with just a name and
 * backfill later (Spec §4.2). Unknown frontmatter keys are preserved on
 * round-trip (files-as-truth: never silently drop a field a user or AI agent
 * added).
 *
 * The schema is a strict discriminated union on `type`: each entity type gets
 * its own Zod variant, so TypeScript forces callers to narrow `frontmatter` by
 * `type` before touching a type-specific field (e.g. `parent_location` is only
 * visible once `type === 'location'`). Entity content is produced
 * programmatically (the Story Card form, the migration command) rather than
 * hand-typed by a person, so this strictness catches real bugs without
 * punishing a human for freehand YAML. A known type-specific field placed on
 * the wrong type (e.g. `sound_motif` on a `location`) is not rejected — the
 * value is preserved via that variant's catchall — but is surfaced as a
 * non-blocking warning for a future UI/diagnostics layer to report.
 */

import { z } from 'zod';
import type { ValidationIssue } from './errors';
import {
  parseMarkdownWithFrontmatter,
  serializeMarkdownWithFrontmatter,
} from './frontmatter';

/** The six base entity types (Spec §4.2). */
export const ENTITY_TYPES = ['character', 'location', 'faction', 'object', 'concept', 'arc'] as const;
export const entityTypeSchema = z.enum(ENTITY_TYPES);
export type EntityType = z.infer<typeof entityTypeSchema>;

/** Canon status of an entity or claim (Spec §4.2, §22). */
export const canonStatusSchema = z.enum(['established', 'tentative', 'contradicted']);
export type CanonStatus = z.infer<typeof canonStatusSchema>;

/** Location mobility flag (Spec §4.4). */
export const mobilitySchema = z.enum(['fixed', 'mobile-per-episode', 'mobile-continuous']);
export type Mobility = z.infer<typeof mobilitySchema>;

/** Current frontmatter schema version, for safe future migrations (Spec §4.2, §23). */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * One ordered entry in a tracked field (Spec §4.5a).
 *
 * The generalized history-log primitive: `order` sequences the change
 * independently of `timing` (narrative vs. chronological order, Spec §4.6).
 */
export const trackedFieldEntrySchema = z.object({
  order: z.number().int(),
  value: z.string(),
  timing: z.string().optional(),
  in_universe_date: z.string().optional(),
});
export type TrackedFieldEntry = z.infer<typeof trackedFieldEntrySchema>;

/** A deliberate, typed relationship between two entities (Spec §4.5). */
export const relationSchema = z.object({
  target: z.string().min(1),
  relation_type: z.string().min(1),
  attitude: z.string().optional(),
});
export type Relation = z.infer<typeof relationSchema>;

/** Fields common to every entity type (Spec §4.2). */
const baseEntityFields = {
  name: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  pronunciation: z.string().optional(),
  tags: z.array(z.string()).optional(),
  canon_status: canonStatusSchema.optional(),
  schema_version: z.number().int().default(CURRENT_SCHEMA_VERSION),
  tracked_fields: z.record(z.string(), z.array(trackedFieldEntrySchema)).optional(),
  relations: z.array(relationSchema).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
};

/** Character-specific fields (Spec §4.3). */
const characterFrontmatterSchema = z
  .object({
    ...baseEntityFields,
    type: z.literal('character'),
    sound_motif: z.string().optional(),
    casting_notes: z.string().optional(),
    appears_in: z.array(z.string()).optional(),
    first_appearance: z.string().optional(),
    /** The actor voicing this character, if cast — free-tier data; doubling-conflict detection (LoreFountain Pro, Spec §17/§22) is what actually does something with it. */
    voice_actor: z.string().optional(),
  })
  .catchall(z.unknown());

/** Location-specific fields (Spec §4.4). */
const locationFrontmatterSchema = z
  .object({
    ...baseEntityFields,
    type: z.literal('location'),
    parent_location: z.string().optional(),
    mobility: mobilitySchema.optional(),
  })
  .catchall(z.unknown());

/** Faction: base fields only — no bespoke schema fields (Spec §4). */
const factionFrontmatterSchema = z
  .object({ ...baseEntityFields, type: z.literal('faction') })
  .catchall(z.unknown());

/** Object: base fields only — no bespoke schema fields (Spec §4). */
const objectFrontmatterSchema = z
  .object({ ...baseEntityFields, type: z.literal('object') })
  .catchall(z.unknown());

/** Concept: base fields only — no bespoke schema fields (Spec §4). */
const conceptFrontmatterSchema = z
  .object({ ...baseEntityFields, type: z.literal('concept') })
  .catchall(z.unknown());

/** Arc-specific fields. An arc's `episodes` list is a set of script Production Codes (e.g. `"1x03"`), letting it span or be confined to any subset of episodes independent of season boundaries. */
const arcFrontmatterSchema = z
  .object({
    ...baseEntityFields,
    type: z.literal('arc'),
    episodes: z.array(z.string()).optional(),
  })
  .catchall(z.unknown());

/**
 * Entity frontmatter schema (Spec §4): a discriminated union on `type`.
 *
 * See the module doc comment for why this is strict-by-type rather than one
 * fully permissive schema, and how misplaced type-specific fields are handled.
 */
export const entityFrontmatterSchema = z.discriminatedUnion('type', [
  characterFrontmatterSchema,
  locationFrontmatterSchema,
  factionFrontmatterSchema,
  objectFrontmatterSchema,
  conceptFrontmatterSchema,
  arcFrontmatterSchema,
]);

export type CharacterFrontmatter = z.infer<typeof characterFrontmatterSchema>;
export type LocationFrontmatter = z.infer<typeof locationFrontmatterSchema>;
export type FactionFrontmatter = z.infer<typeof factionFrontmatterSchema>;
export type ObjectFrontmatter = z.infer<typeof objectFrontmatterSchema>;
export type ConceptFrontmatter = z.infer<typeof conceptFrontmatterSchema>;
export type ArcFrontmatter = z.infer<typeof arcFrontmatterSchema>;
export type EntityFrontmatter = z.infer<typeof entityFrontmatterSchema>;

/**
 * Known type-specific field names, keyed by the type they belong to (Spec §4.3,
 * §4.4). Used only to detect and warn about a field placed on the wrong type —
 * `faction`/`object`/`concept` have no bespoke fields, so they never appear as
 * the *source* of a misplaced-field warning, but can still be the type a field
 * was wrongly placed *on*.
 */
const TYPE_SPECIFIC_FIELDS: Record<EntityType, readonly string[]> = {
  character: ['sound_motif', 'casting_notes', 'appears_in', 'first_appearance', 'voice_actor'],
  location: ['parent_location', 'mobility'],
  faction: [],
  object: [],
  concept: [],
  arc: ['episodes'],
};

/** A non-blocking warning about frontmatter that parsed successfully but looks off. */
export interface EntityWarning extends ValidationIssue {
  code: 'misplaced-field';
}

/**
 * Detect known type-specific fields present on an entity of a *different*
 * type. The value is not altered or removed — it round-trips normally via the
 * matched variant's catchall — this only produces a reporting signal.
 *
 * @param raw - The raw (pre-validation) frontmatter mapping.
 * @param ownType - The entity's actual, validated type.
 * @returns Warnings for any misplaced fields found (empty if none).
 */
function detectMisplacedFields(raw: Record<string, unknown>, ownType: EntityType): EntityWarning[] {
  const warnings: EntityWarning[] = [];
  for (const otherType of ENTITY_TYPES) {
    if (otherType === ownType) continue;
    for (const field of TYPE_SPECIFIC_FIELDS[otherType]) {
      if (Object.prototype.hasOwnProperty.call(raw, field)) {
        warnings.push({
          code: 'misplaced-field',
          path: field,
          message: `"${field}" is a ${otherType}-specific field, but this entity's type is "${ownType}". The value was kept as-is; consider moving it to the correct entity or into custom_fields.`,
        });
      }
    }
  }
  return warnings;
}

/** A fully-resolved entity: validated frontmatter plus file-derived context. */
export interface Entity {
  /** Stable slug id, derived from the filename (Spec §4.2). */
  id: string;
  /** Absolute path to the source `.md` file. */
  filePath: string;
  /** Markdown body after the frontmatter block. */
  body: string;
  /** Validated frontmatter fields. */
  frontmatter: EntityFrontmatter;
}

/** Outcome of {@link parseEntityFile}. */
export type EntityParseResult =
  | { ok: true; entity: Entity; warnings: EntityWarning[] }
  | {
      ok: false;
      reason: 'malformed-yaml' | 'invalid-schema';
      filePath: string;
      message: string;
      issues?: ValidationIssue[];
    };

/**
 * Parse an entity `.md` file into a validated {@link Entity}.
 *
 * Never throws. Malformed YAML and schema violations (including an
 * unrecognized `type`, or a missing required field) are reported via the
 * `ok: false` branch so callers (the index rebuild) can skip/flag the file
 * without crashing (Spec §23). A known field placed on the wrong entity type
 * still parses successfully but is reported via `warnings`.
 *
 * @param fileText - Raw file contents.
 * @param opts - The derived `id` (slug) and `filePath` for the file.
 * @returns A discriminated result with the entity or a described failure.
 */
export function parseEntityFile(
  fileText: string,
  opts: { id: string; filePath: string },
): EntityParseResult {
  const fm = parseMarkdownWithFrontmatter(fileText);
  if (!fm.ok) {
    return { ok: false, reason: 'malformed-yaml', filePath: opts.filePath, message: fm.message };
  }

  const parsed = entityFrontmatterSchema.safeParse(fm.value.frontmatter);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid-schema',
      filePath: opts.filePath,
      message: 'Entity frontmatter failed validation.',
      issues: toIssues(parsed.error),
    };
  }

  return {
    ok: true,
    entity: {
      id: opts.id,
      filePath: opts.filePath,
      body: fm.value.body,
      frontmatter: parsed.data,
    },
    warnings: detectMisplacedFields(fm.value.frontmatter, parsed.data.type),
  };
}

/**
 * Serialize an {@link Entity} back into `.md` file text.
 *
 * @param entity - The entity to serialize.
 * @returns The combined frontmatter + body document text.
 */
export function serializeEntity(entity: Entity): string {
  return serializeMarkdownWithFrontmatter(entity.frontmatter, entity.body);
}

/** Flatten a ZodError into simple {@link ValidationIssue}s for reporting. */
function toIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}
