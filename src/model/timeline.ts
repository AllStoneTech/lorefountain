/**
 * Timeline event schema and file (de)serialization (Spec §4.6, §22).
 *
 * A Timeline event is a separate layer from full entities (like the glossary,
 * Spec §4.7) — one `.md` file per event under `/world/timeline`. Every event
 * carries two independent positions, per Spec §4.6:
 *
 * - **Narrative/episode-order position** — where the event is presented to
 *   the audience. `production_code` links to the script that depicts it
 *   (resolved against that script's own, possibly-changing `Order` at query
 *   time, never duplicated here); `narrative_order` is a manual fallback
 *   integer for events with no script yet (e.g. early worldbuilding, before
 *   an episode exists to link to).
 * - **In-universe chronological position** — `chronological_order`, a
 *   relative-sequencing integer, plus an optional free-text
 *   `in_universe_date` label for human-readable context (e.g. "three years
 *   before the pilot"). Mirrors the existing `tracked_fields` entry shape
 *   (`entity.ts`'s `trackedFieldEntrySchema`), which was designed with this
 *   exact narrative-vs-chronological split in mind.
 *
 * Both positions are optional, matching the schema's optional-first
 * philosophy (Spec §4.2) — an event lacking one is simply excluded from
 * computations that need it (e.g. as-of-episode filtering, LoreFountain Pro)
 * rather than guessed at. `participants` (entity ids) is what makes
 * as-of-episode filtering meaningful per-character.
 */

import { z } from 'zod';
import type { ValidationIssue } from './errors';
import { canonStatusSchema, CURRENT_SCHEMA_VERSION } from './entity';
import {
  parseMarkdownWithFrontmatter,
  serializeMarkdownWithFrontmatter,
} from './frontmatter';

/** Timeline event frontmatter schema (Spec §4.6). */
export const timelineEventSchema = z
  .object({
    name: z.string().min(1),
    /** Permanent SxEE Production Code of the script that depicts this event, e.g. `"1x01"` — resolved against that script's current `Order` at query time. */
    production_code: z.string().optional(),
    /** Manual narrative-order fallback for events with no script to link to yet. */
    narrative_order: z.number().int().optional(),
    /** In-universe chronological position — a relative ordering, not a real date. */
    chronological_order: z.number().int().optional(),
    /** Free-text, human-readable chronological label (e.g. "three years before the pilot"). */
    in_universe_date: z.string().optional(),
    /** Entity ids of characters/locations involved in this event. */
    participants: z.array(z.string()).optional(),
    canon_status: canonStatusSchema.optional(),
    tags: z.array(z.string()).optional(),
    schema_version: z.number().int().default(CURRENT_SCHEMA_VERSION),
  })
  .catchall(z.unknown());

export type TimelineEventFrontmatter = z.infer<typeof timelineEventSchema>;

/** A fully-resolved Timeline event: validated frontmatter plus file context. */
export interface TimelineEvent {
  /** Stable slug id, derived from the filename. */
  id: string;
  /** Absolute path to the source `.md` file. */
  filePath: string;
  /** Markdown body (longer event description). */
  body: string;
  /** Validated frontmatter fields. */
  frontmatter: TimelineEventFrontmatter;
}

/** Outcome of {@link parseTimelineEventFile}. */
export type TimelineEventParseResult =
  | { ok: true; event: TimelineEvent }
  | {
      ok: false;
      reason: 'malformed-yaml' | 'invalid-schema';
      filePath: string;
      message: string;
      issues?: ValidationIssue[];
    };

/**
 * Parse a Timeline event `.md` file into a validated {@link TimelineEvent}.
 *
 * Never throws; failures are reported via the `ok: false` branch (Spec §23).
 *
 * @param fileText - Raw file contents.
 * @param opts - The derived `id` (slug) and `filePath` for the file.
 * @returns A discriminated result with the event or a described failure.
 */
export function parseTimelineEventFile(
  fileText: string,
  opts: { id: string; filePath: string },
): TimelineEventParseResult {
  const fm = parseMarkdownWithFrontmatter(fileText);
  if (!fm.ok) {
    return { ok: false, reason: 'malformed-yaml', filePath: opts.filePath, message: fm.message };
  }

  const parsed = timelineEventSchema.safeParse(fm.value.frontmatter);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid-schema',
      filePath: opts.filePath,
      message: 'Timeline event frontmatter failed validation.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    };
  }

  return {
    ok: true,
    event: {
      id: opts.id,
      filePath: opts.filePath,
      body: fm.value.body,
      frontmatter: parsed.data,
    },
  };
}

/**
 * Serialize a {@link TimelineEvent} back into `.md` file text.
 *
 * @param event - The Timeline event to serialize.
 * @returns The combined frontmatter + body document text.
 */
export function serializeTimelineEvent(event: TimelineEvent): string {
  return serializeMarkdownWithFrontmatter(event.frontmatter, event.body);
}
