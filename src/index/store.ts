/**
 * Storage-agnostic contract for the local LoreFountain index (Spec §2.2).
 *
 * The index is a derived, disposable cache built by parsing on-disk entity and
 * glossary files — it is never authoritative, and deleting/rebuilding it must
 * always be safe and lossless. This interface exists so the concrete engine
 * (sql.js today; `node:sqlite` or Postgres potentially later, see ADR-0001) can
 * be swapped without touching callers. All methods are synchronous, matching
 * both sql.js and `node:sqlite`'s APIs; only acquiring/opening a store is async
 * (loading the sql.js WASM module).
 */

import type { Entity, EntityType, EntityFrontmatter } from '../model/entity';
import type { GlossaryTerm, GlossaryTermFrontmatter } from '../model/glossary';
import type { Script } from '../model/script';
import type { TimelineEvent, TimelineEventFrontmatter } from '../model/timeline';
import type { MentionKind, MentionTarget } from './mentions';

/** A stored, indexed entity row plus its full validated frontmatter. */
export interface EntityRecord {
  id: string;
  type: EntityType;
  name: string;
  filePath: string;
  tags: string[];
  schemaVersion: number;
  /** Full validated frontmatter, the JSON1-backed column (Spec §2.2). */
  data: EntityFrontmatter;
  body: string;
}

/** A stored, indexed glossary term row plus its full validated frontmatter. */
export interface GlossaryRecord {
  id: string;
  term: string;
  filePath: string;
  schemaVersion: number;
  data: GlossaryTermFrontmatter;
  body: string;
}

/**
 * A stored, indexed script row: title-page metadata plus file context.
 * Never a mention *target* — see {@link MentionEndpoint}'s doc comment;
 * scripts only ever appear as a mention source.
 */
export interface ScriptRecord {
  id: string;
  filePath: string;
  title?: string;
  /** This script's position among its season's siblings, from `Order:`. Absent means "sort by filename instead." */
  order?: number;
  /** Permanent SxEE identifier from `Production Code:` (e.g. `"1x01"`) — never recomputed once assigned. */
  productionCode?: string;
}

/** A stored, indexed Timeline event row plus its full validated frontmatter (Spec §4.6). */
export interface EventRecord {
  id: string;
  name: string;
  filePath: string;
  schemaVersion: number;
  /** Full validated frontmatter, the JSON1-backed column (Spec §2.2). */
  data: TimelineEventFrontmatter;
  body: string;
}

/** One full-text search match against entities. */
export interface EntitySearchHit {
  id: string;
  name: string;
  type: EntityType;
  filePath: string;
}

/** One full-text search match against glossary terms. */
export interface GlossarySearchHit {
  id: string;
  term: string;
  filePath: string;
}

/** Optional filters for {@link IndexStore.listEntities}. */
export interface ListEntitiesFilter {
  type?: EntityType;
}

/**
 * A mention edge's target — which entity/glossary record it points at.
 * Scripts are only ever a mention *source*, never a target: nothing links
 * "to" a script.
 */
export interface MentionEndpoint {
  id: string;
  kind: MentionKind;
}

/**
 * A mention edge's source, for writing (Spec §4.5). Carries `filePath`
 * because a script source has no other table row to resolve display info
 * from — unlike an entity/glossary source, whose name is looked up via a
 * join at read time (Spec §2.2).
 */
export interface MentionSource {
  id: string;
  kind: MentionKind;
  filePath: string;
}

/** One resolved backlink: a source that mentions the queried target, with display info. */
export interface MentionBacklink {
  id: string;
  kind: MentionKind;
  /** Display name: the entity's `name` or the glossary term's `term`. */
  name: string;
  filePath: string;
}

/** Aggregate counts for the current index contents. */
export interface IndexStats {
  entityCount: number;
  glossaryCount: number;
  eventCount: number;
}

/**
 * The local index's storage contract (Spec §2.2). Every write is an upsert
 * keyed by file path — re-indexing the same file replaces its prior row,
 * matching the file-watcher incremental-update model where a save always
 * re-parses and re-upserts, never appends a duplicate.
 */
export interface IndexStore {
  /**
   * Insert or replace an entity row.
   *
   * Matched (and replaced) by *either* `entity.filePath` or `entity.id` —
   * covering both the normal re-save case and a rename, where the file path
   * is unchanged but the id changes, or vice versa.
   */
  upsertEntity(entity: Entity): void;

  /** Remove the entity row for a given file path, if any. Safe to call when absent. */
  removeEntityByPath(filePath: string): void;

  getEntityById(id: string): EntityRecord | undefined;
  getEntityByPath(filePath: string): EntityRecord | undefined;
  listEntities(filter?: ListEntitiesFilter): EntityRecord[];

  /**
   * Full-text search over entity name + body (Spec §2.2). Backed by FTS3
   * rather than FTS5 for v1 — see ADR-0005.
   */
  searchEntities(query: string, limit?: number): EntitySearchHit[];

  /** Insert or replace a glossary term row, matched by either `term.filePath` or `term.id`. */
  upsertGlossaryTerm(term: GlossaryTerm): void;

  /** Remove the glossary row for a given file path, if any. Safe to call when absent. */
  removeGlossaryTermByPath(filePath: string): void;

  getGlossaryTermById(id: string): GlossaryRecord | undefined;
  listGlossaryTerms(): GlossaryRecord[];

  /** Full-text search over glossary term + gloss + body. See ADR-0005 (FTS3, not FTS5). */
  searchGlossary(query: string, limit?: number): GlossarySearchHit[];

  /** Insert or replace a script row, matched by either `script.filePath` or `script.id`. */
  upsertScript(script: Script): void;

  /** Remove the script row for a given file path, if any. Safe to call when absent. */
  removeScriptByPath(filePath: string): void;

  getScriptById(id: string): ScriptRecord | undefined;
  getScriptByPath(filePath: string): ScriptRecord | undefined;

  /** Every indexed script, in no particular order — callers sort by season/`order`/filename themselves. */
  listScripts(): ScriptRecord[];

  /** Insert or replace a Timeline event row, matched by either `event.filePath` or `event.id`. */
  upsertEvent(event: TimelineEvent): void;

  /** Remove the event row for a given file path, if any. Safe to call when absent. */
  removeEventByPath(filePath: string): void;

  getEventById(id: string): EventRecord | undefined;

  /** Every indexed Timeline event, in no particular order — callers sort by narrative/chronological order themselves. */
  listEvents(): EventRecord[];

  /**
   * Replace every outgoing mention edge for a source (Spec §4.5) — an
   * entity's or glossary term's automatically-detected references to other
   * entities/glossary terms. Call after (re)computing a file's mentions;
   * always replaces the full set for that source, never appends.
   */
  setMentionsForSource(source: MentionSource, targets: readonly MentionTarget[]): void;

  /** Remove every outgoing mention edge for a source. Used when its file is removed from the index. */
  removeMentionsForSource(source: MentionEndpoint): void;

  /** Every source that mentions `target` — the reverse lookup, resolved with display info. */
  getBacklinks(target: MentionEndpoint): MentionBacklink[];

  stats(): IndexStats;

  /** Remove every row, without recreating the schema. Used before a full rebuild. */
  clear(): void;

  /** Release underlying engine resources (e.g. close the sql.js database). */
  dispose(): void;
}
