/**
 * Entity/glossary CRUD service (Spec §13.1): create, read, and write back
 * entity and glossary `.md` files on disk. No delete operation here — the
 * file is a plain file (files-as-truth), so VS Code's own file explorer
 * already covers deletion without a redundant in-extension command.
 *
 * Creation is deliberately minimal (Spec §13.1, §4.2): only `name` and `type`
 * are ever required, so a writer can create an entity mid-scene without
 * leaving the writing flow, and backfill detail later through the Story Card
 * form (Phase D3). Reading never throws — a missing or malformed file is
 * reported, not an exception (Spec §23), consistent with the rest of the
 * index/build layer.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { ValidationIssue } from '../model/errors';
import {
  entityFrontmatterSchema,
  parseEntityFile,
  serializeEntity,
  type Entity,
  type EntityType,
} from '../model/entity';
import {
  glossaryTermSchema,
  parseGlossaryFile,
  serializeGlossaryTerm,
  type GlossaryTerm,
} from '../model/glossary';
import {
  timelineEventSchema,
  parseTimelineEventFile,
  serializeTimelineEvent,
  type TimelineEvent,
} from '../model/timeline';
import { idFromFilePath, slugify } from '../model/slug';

/** Outcome of {@link createEntity}. */
export type CreateEntityResult =
  | { ok: true; entity: Entity; filePath: string }
  | { ok: false; reason: 'invalid-name'; name: string }
  | { ok: false; reason: 'already-exists'; filePath: string };

/**
 * Scaffold a new entity file with only `name` and `type` set.
 *
 * @param worldFolder - Absolute path to the workspace's `world` folder.
 * @param type - The entity type to create.
 * @param name - The entity's display name; its id is derived by slugifying this.
 * @returns The created entity and its file path, or a described, non-throwing failure.
 */
export async function createEntity(
  worldFolder: string,
  type: EntityType,
  name: string,
): Promise<CreateEntityResult> {
  const trimmedName = name.trim();
  const id = slugify(trimmedName);
  if (!trimmedName || !id) {
    return { ok: false, reason: 'invalid-name', name };
  }

  const filePath = path.join(worldFolder, `${id}.md`);
  if (await fileExists(filePath)) {
    return { ok: false, reason: 'already-exists', filePath };
  }

  const frontmatter = entityFrontmatterSchema.parse({ name: trimmedName, type });
  const entity: Entity = { id, filePath, body: '', frontmatter };

  await fsp.mkdir(worldFolder, { recursive: true });
  await fsp.writeFile(filePath, serializeEntity(entity), 'utf8');

  return { ok: true, entity, filePath };
}

/** Outcome of {@link createGlossaryTerm}. */
export type CreateGlossaryTermResult =
  | { ok: true; term: GlossaryTerm; filePath: string }
  | { ok: false; reason: 'invalid-name'; name: string }
  | { ok: false; reason: 'already-exists'; filePath: string };

/**
 * Scaffold a new glossary term file with only `term` set.
 *
 * @param glossaryFolder - Absolute path to the workspace's `world/glossary` folder.
 * @param term - The glossary term's display text; its id is derived by slugifying this.
 * @returns The created term and its file path, or a described, non-throwing failure.
 */
export async function createGlossaryTerm(
  glossaryFolder: string,
  term: string,
): Promise<CreateGlossaryTermResult> {
  const trimmedTerm = term.trim();
  const id = slugify(trimmedTerm);
  if (!trimmedTerm || !id) {
    return { ok: false, reason: 'invalid-name', name: term };
  }

  const filePath = path.join(glossaryFolder, `${id}.md`);
  if (await fileExists(filePath)) {
    return { ok: false, reason: 'already-exists', filePath };
  }

  const frontmatter = glossaryTermSchema.parse({ term: trimmedTerm });
  const glossaryTerm: GlossaryTerm = { id, filePath, body: '', frontmatter };

  await fsp.mkdir(glossaryFolder, { recursive: true });
  await fsp.writeFile(filePath, serializeGlossaryTerm(glossaryTerm), 'utf8');

  return { ok: true, term: glossaryTerm, filePath };
}

/** Outcome of {@link createTimelineEvent}. */
export type CreateTimelineEventResult =
  | { ok: true; event: TimelineEvent; filePath: string }
  | { ok: false; reason: 'invalid-name'; name: string }
  | { ok: false; reason: 'already-exists'; filePath: string };

/**
 * Scaffold a new Timeline event file with only `name` set (Spec §4.6).
 *
 * @param timelineFolder - Absolute path to the workspace's `world/timeline` folder.
 * @param name - The event's display name; its id is derived by slugifying this.
 * @returns The created event and its file path, or a described, non-throwing failure.
 */
export async function createTimelineEvent(
  timelineFolder: string,
  name: string,
): Promise<CreateTimelineEventResult> {
  const trimmedName = name.trim();
  const id = slugify(trimmedName);
  if (!trimmedName || !id) {
    return { ok: false, reason: 'invalid-name', name };
  }

  const filePath = path.join(timelineFolder, `${id}.md`);
  if (await fileExists(filePath)) {
    return { ok: false, reason: 'already-exists', filePath };
  }

  const frontmatter = timelineEventSchema.parse({ name: trimmedName });
  const event: TimelineEvent = { id, filePath, body: '', frontmatter };

  await fsp.mkdir(timelineFolder, { recursive: true });
  await fsp.writeFile(filePath, serializeTimelineEvent(event), 'utf8');

  return { ok: true, event, filePath };
}

/** Outcome of {@link readEntity}. */
export type ReadEntityResult =
  | { ok: true; entity: Entity }
  | {
      ok: false;
      reason: 'read-error' | 'malformed-yaml' | 'invalid-schema';
      filePath: string;
      message: string;
      issues?: ValidationIssue[];
    };

/**
 * Read and validate an entity file from disk.
 *
 * @param filePath - Absolute path to the entity `.md` file.
 * @returns The parsed entity, or a described, non-throwing failure.
 */
export async function readEntity(filePath: string): Promise<ReadEntityResult> {
  let text: string;
  try {
    text = await fsp.readFile(filePath, 'utf8');
  } catch (err) {
    return { ok: false, reason: 'read-error', filePath, message: errorMessage(err) };
  }
  return parseEntityFile(text, { id: idFromFilePath(filePath), filePath });
}

/** Outcome of {@link readGlossaryTerm}. */
export type ReadGlossaryTermResult =
  | { ok: true; term: GlossaryTerm }
  | {
      ok: false;
      reason: 'read-error' | 'malformed-yaml' | 'invalid-schema';
      filePath: string;
      message: string;
      issues?: ValidationIssue[];
    };

/**
 * Read and validate a glossary term file from disk.
 *
 * @param filePath - Absolute path to the glossary term `.md` file.
 * @returns The parsed term, or a described, non-throwing failure.
 */
export async function readGlossaryTerm(filePath: string): Promise<ReadGlossaryTermResult> {
  let text: string;
  try {
    text = await fsp.readFile(filePath, 'utf8');
  } catch (err) {
    return { ok: false, reason: 'read-error', filePath, message: errorMessage(err) };
  }
  return parseGlossaryFile(text, { id: idFromFilePath(filePath), filePath });
}

/**
 * Write an entity's current state back to its file — e.g. after an edit in
 * the Story Card form. Overwrites the file at `entity.filePath` entirely.
 *
 * @param entity - The entity to persist.
 */
export async function writeEntity(entity: Entity): Promise<void> {
  await fsp.writeFile(entity.filePath, serializeEntity(entity), 'utf8');
}

/**
 * Write a glossary term's current state back to its file.
 *
 * @param term - The glossary term to persist.
 */
export async function writeGlossaryTerm(term: GlossaryTerm): Promise<void> {
  await fsp.writeFile(term.filePath, serializeGlossaryTerm(term), 'utf8');
}

/** Outcome of {@link readTimelineEvent}. */
export type ReadTimelineEventResult =
  | { ok: true; event: TimelineEvent }
  | {
      ok: false;
      reason: 'read-error' | 'malformed-yaml' | 'invalid-schema';
      filePath: string;
      message: string;
      issues?: ValidationIssue[];
    };

/**
 * Read and validate a Timeline event file from disk.
 *
 * @param filePath - Absolute path to the event `.md` file.
 * @returns The parsed event, or a described, non-throwing failure.
 */
export async function readTimelineEvent(filePath: string): Promise<ReadTimelineEventResult> {
  let text: string;
  try {
    text = await fsp.readFile(filePath, 'utf8');
  } catch (err) {
    return { ok: false, reason: 'read-error', filePath, message: errorMessage(err) };
  }
  return parseTimelineEventFile(text, { id: idFromFilePath(filePath), filePath });
}

/**
 * Write a Timeline event's current state back to its file.
 *
 * @param event - The event to persist.
 */
export async function writeTimelineEvent(event: TimelineEvent): Promise<void> {
  await fsp.writeFile(event.filePath, serializeTimelineEvent(event), 'utf8');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Extract a message from an unknown thrown value. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
