/**
 * sql.js-backed implementation of {@link IndexStore} (Spec §2.2, ADR-0001).
 *
 * Strict relational columns for id/type/name/file_path/tags/schema_version,
 * plus a JSON1-backed `data` column holding the full validated frontmatter,
 * plus an FTS3 shadow table per entity type for full-text search (FTS3, not
 * FTS5 — the default sql.js build has no FTS5 module; see ADR-0005). The whole
 * database is in-memory: the index is disposable and rebuilt from disk, so
 * there is nothing to persist across sessions (see ADR-0001).
 *
 * `scripts` has no FTS shadow table and no JSON `data` column — unlike
 * entities/glossary, a script has no free-form frontmatter to preserve, just
 * the three fixed fields `parseScriptTitlePage` extracts (title, order,
 * production_code), so plain columns suffice.
 */

import { basename } from 'node:path';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import type { Entity, EntityFrontmatter, EntityType } from '../model/entity';
import type { GlossaryTerm, GlossaryTermFrontmatter } from '../model/glossary';
import type { Script } from '../model/script';
import type { TimelineEvent, TimelineEventFrontmatter } from '../model/timeline';
import type { MentionKind, MentionTarget } from './mentions';
import type {
  EntityRecord,
  EntitySearchHit,
  EventRecord,
  GlossaryRecord,
  GlossarySearchHit,
  IndexStats,
  IndexStore,
  ListEntitiesFilter,
  MentionBacklink,
  MentionEndpoint,
  MentionSource,
  ScriptRecord,
} from './store';

const SCHEMA_SQL = `
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  tags TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  data TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE VIRTUAL TABLE entities_fts USING fts3(id, name, body);

CREATE TABLE glossary (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  schema_version INTEGER NOT NULL,
  data TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE VIRTUAL TABLE glossary_fts USING fts3(id, term, body);

CREATE TABLE scripts (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  title TEXT,
  "order" INTEGER,
  production_code TEXT
);

-- No FTS shadow table: unlike glossary, events have no exposed full-text
-- search yet (IndexStore has no searchEvents) — add one if/when that's needed.
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  schema_version INTEGER NOT NULL,
  data TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE mentions (
  source_id TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_file_path TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  PRIMARY KEY (source_id, source_kind, target_id, target_kind)
);

CREATE INDEX mentions_target_idx ON mentions (target_id, target_kind);
`;

/**
 * Create a new sql.js-backed {@link IndexStore}.
 *
 * Loading the sql.js WASM module is asynchronous; every method on the
 * returned store is synchronous.
 *
 * @returns A freshly-opened, empty index store.
 */
export async function createSqlJsIndexStore(): Promise<IndexStore> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(SCHEMA_SQL);
  return new SqlJsIndexStore(db);
}

class SqlJsIndexStore implements IndexStore {
  constructor(private readonly db: Database) {}

  upsertEntity(entity: Entity): void {
    this.deleteEntityRows(entity.id, entity.filePath);
    const tags = (entity.frontmatter as { tags?: string[] }).tags ?? [];
    this.db.run(
      `INSERT INTO entities (id, type, name, file_path, tags, schema_version, data, body)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entity.id,
        entity.frontmatter.type,
        entity.frontmatter.name,
        entity.filePath,
        JSON.stringify(tags),
        entity.frontmatter.schema_version,
        JSON.stringify(entity.frontmatter),
        entity.body,
      ],
    );
    this.db.run('INSERT INTO entities_fts (id, name, body) VALUES (?, ?, ?)', [
      entity.id,
      entity.frontmatter.name,
      entity.body,
    ]);
  }

  removeEntityByPath(filePath: string): void {
    const id = this.singleValue<string>('SELECT id FROM entities WHERE file_path = ?', [filePath]);
    if (id === undefined) return;
    this.deleteEntityRows(id, filePath);
    this.removeMentionsForSource({ id, kind: 'entity' });
  }

  getEntityById(id: string): EntityRecord | undefined {
    return this.queryOneEntity('SELECT * FROM entities WHERE id = ?', [id]);
  }

  getEntityByPath(filePath: string): EntityRecord | undefined {
    return this.queryOneEntity('SELECT * FROM entities WHERE file_path = ?', [filePath]);
  }

  listEntities(filter?: ListEntitiesFilter): EntityRecord[] {
    if (filter?.type) {
      return this.queryEntities('SELECT * FROM entities WHERE type = ? ORDER BY name', [filter.type]);
    }
    return this.queryEntities('SELECT * FROM entities ORDER BY name');
  }

  searchEntities(query: string, limit = 20): EntitySearchHit[] {
    const rows = this.queryAll<{ id: string; name: string; type: string; file_path: string }>(
      `SELECT e.id AS id, e.name AS name, e.type AS type, e.file_path AS file_path
       FROM entities_fts JOIN entities e ON e.id = entities_fts.id
       WHERE entities_fts MATCH ? LIMIT ?`,
      [query, limit],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type as EntityType,
      filePath: row.file_path,
    }));
  }

  upsertGlossaryTerm(term: GlossaryTerm): void {
    this.deleteGlossaryRows(term.id, term.filePath);
    this.db.run(
      `INSERT INTO glossary (id, term, file_path, schema_version, data, body)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        term.id,
        term.frontmatter.term,
        term.filePath,
        term.frontmatter.schema_version,
        JSON.stringify(term.frontmatter),
        term.body,
      ],
    );
    this.db.run('INSERT INTO glossary_fts (id, term, body) VALUES (?, ?, ?)', [
      term.id,
      term.frontmatter.term,
      term.body,
    ]);
  }

  removeGlossaryTermByPath(filePath: string): void {
    const id = this.singleValue<string>('SELECT id FROM glossary WHERE file_path = ?', [filePath]);
    if (id === undefined) return;
    this.deleteGlossaryRows(id, filePath);
    this.removeMentionsForSource({ id, kind: 'glossary' });
  }

  getGlossaryTermById(id: string): GlossaryRecord | undefined {
    return this.queryOneGlossary('SELECT * FROM glossary WHERE id = ?', [id]);
  }

  listGlossaryTerms(): GlossaryRecord[] {
    return this.queryGlossary('SELECT * FROM glossary ORDER BY term');
  }

  searchGlossary(query: string, limit = 20): GlossarySearchHit[] {
    const rows = this.queryAll<{ id: string; term: string; file_path: string }>(
      `SELECT g.id AS id, g.term AS term, g.file_path AS file_path
       FROM glossary_fts JOIN glossary g ON g.id = glossary_fts.id
       WHERE glossary_fts MATCH ? LIMIT ?`,
      [query, limit],
    );
    return rows.map((row) => ({ id: row.id, term: row.term, filePath: row.file_path }));
  }

  upsertScript(script: Script): void {
    this.deleteScriptRows(script.id, script.filePath);
    this.db.run(
      'INSERT INTO scripts (id, file_path, title, "order", production_code) VALUES (?, ?, ?, ?, ?)',
      [
        script.id,
        script.filePath,
        script.frontmatter.title ?? null,
        script.frontmatter.order ?? null,
        script.frontmatter.productionCode ?? null,
      ],
    );
  }

  removeScriptByPath(filePath: string): void {
    const id = this.singleValue<string>('SELECT id FROM scripts WHERE file_path = ?', [filePath]);
    if (id === undefined) return;
    this.deleteScriptRows(id, filePath);
  }

  getScriptById(id: string): ScriptRecord | undefined {
    return this.queryScripts('SELECT * FROM scripts WHERE id = ?', [id])[0];
  }

  getScriptByPath(filePath: string): ScriptRecord | undefined {
    return this.queryScripts('SELECT * FROM scripts WHERE file_path = ?', [filePath])[0];
  }

  listScripts(): ScriptRecord[] {
    return this.queryScripts('SELECT * FROM scripts');
  }

  upsertEvent(event: TimelineEvent): void {
    this.deleteEventRows(event.id, event.filePath);
    this.db.run(
      `INSERT INTO events (id, name, file_path, schema_version, data, body)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.frontmatter.name,
        event.filePath,
        event.frontmatter.schema_version,
        JSON.stringify(event.frontmatter),
        event.body,
      ],
    );
  }

  removeEventByPath(filePath: string): void {
    const id = this.singleValue<string>('SELECT id FROM events WHERE file_path = ?', [filePath]);
    if (id === undefined) return;
    this.deleteEventRows(id, filePath);
    this.removeMentionsForSource({ id, kind: 'event' });
  }

  getEventById(id: string): EventRecord | undefined {
    return this.queryEvents('SELECT * FROM events WHERE id = ?', [id])[0];
  }

  listEvents(): EventRecord[] {
    return this.queryEvents('SELECT * FROM events ORDER BY name');
  }

  setMentionsForSource(source: MentionSource, targets: readonly MentionTarget[]): void {
    this.removeMentionsForSource(source);
    for (const target of targets) {
      this.db.run(
        `INSERT INTO mentions (source_id, source_kind, source_file_path, target_id, target_kind)
         VALUES (?, ?, ?, ?, ?)`,
        [source.id, source.kind, source.filePath, target.id, target.kind],
      );
    }
  }

  removeMentionsForSource(source: MentionEndpoint): void {
    this.db.run('DELETE FROM mentions WHERE source_id = ? AND source_kind = ?', [source.id, source.kind]);
  }

  getBacklinks(target: MentionEndpoint): MentionBacklink[] {
    // A script source has no entities/glossary/events row to resolve a
    // display name from — e.name/g.term/ev.name are NULL for it, so the
    // caller falls back to the file's basename.
    const rows = this.queryAll<{ id: string; kind: string; file_path: string; name: string | null }>(
      `SELECT m.source_id AS id, m.source_kind AS kind, m.source_file_path AS file_path,
              COALESCE(e.name, g.term, ev.name) AS name
       FROM mentions m
       LEFT JOIN entities e ON e.id = m.source_id AND m.source_kind = 'entity'
       LEFT JOIN glossary g ON g.id = m.source_id AND m.source_kind = 'glossary'
       LEFT JOIN events ev ON ev.id = m.source_id AND m.source_kind = 'event'
       WHERE m.target_id = ? AND m.target_kind = ?
       ORDER BY COALESCE(e.name, g.term, ev.name, m.source_file_path)`,
      [target.id, target.kind],
    );
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as MentionKind,
      name: row.name ?? basename(row.file_path),
      filePath: row.file_path,
    }));
  }

  stats(): IndexStats {
    return {
      entityCount: this.singleValue<number>('SELECT COUNT(*) FROM entities') ?? 0,
      glossaryCount: this.singleValue<number>('SELECT COUNT(*) FROM glossary') ?? 0,
      eventCount: this.singleValue<number>('SELECT COUNT(*) FROM events') ?? 0,
    };
  }

  clear(): void {
    this.db.run(
      'DELETE FROM entities; DELETE FROM entities_fts; DELETE FROM glossary; DELETE FROM glossary_fts; DELETE FROM scripts; DELETE FROM events; DELETE FROM mentions;',
    );
  }

  dispose(): void {
    this.db.close();
  }

  /** Remove any entity row matching `id` OR `filePath`, from both the entities table and its FTS shadow. */
  private deleteEntityRows(id: string, filePath: string): void {
    const staleIds = this.queryAll<{ id: string }>(
      'SELECT id FROM entities WHERE id = ? OR file_path = ?',
      [id, filePath],
    ).map((row) => row.id);
    for (const staleId of staleIds) {
      this.db.run('DELETE FROM entities WHERE id = ?', [staleId]);
      this.db.run('DELETE FROM entities_fts WHERE id = ?', [staleId]);
    }
  }

  /** Remove any glossary row matching `id` OR `filePath`, from both the glossary table and its FTS shadow. */
  private deleteGlossaryRows(id: string, filePath: string): void {
    const staleIds = this.queryAll<{ id: string }>(
      'SELECT id FROM glossary WHERE id = ? OR file_path = ?',
      [id, filePath],
    ).map((row) => row.id);
    for (const staleId of staleIds) {
      this.db.run('DELETE FROM glossary WHERE id = ?', [staleId]);
      this.db.run('DELETE FROM glossary_fts WHERE id = ?', [staleId]);
    }
  }

  /** Remove any script row matching `id` OR `filePath`. */
  private deleteScriptRows(id: string, filePath: string): void {
    this.db.run('DELETE FROM scripts WHERE id = ? OR file_path = ?', [id, filePath]);
  }

  /** Remove any event row matching `id` OR `filePath`. */
  private deleteEventRows(id: string, filePath: string): void {
    this.db.run('DELETE FROM events WHERE id = ? OR file_path = ?', [id, filePath]);
  }

  private queryScripts(sql: string, params: SqlValue[] = []): ScriptRecord[] {
    return this.queryAll<ScriptRow>(sql, params).map(rowToScriptRecord);
  }

  private queryEvents(sql: string, params: SqlValue[] = []): EventRecord[] {
    return this.queryAll<EventRow>(sql, params).map(rowToEventRecord);
  }

  private queryOneEntity(sql: string, params: SqlValue[]): EntityRecord | undefined {
    return this.queryEntities(sql, params)[0];
  }

  private queryEntities(sql: string, params: SqlValue[] = []): EntityRecord[] {
    return this.queryAll<EntityRow>(sql, params).map(rowToEntityRecord);
  }

  private queryOneGlossary(sql: string, params: SqlValue[]): GlossaryRecord | undefined {
    return this.queryGlossary(sql, params)[0];
  }

  private queryGlossary(sql: string, params: SqlValue[] = []): GlossaryRecord[] {
    return this.queryAll<GlossaryRow>(sql, params).map(rowToGlossaryRecord);
  }

  /** Run a query and return every result row as a plain object, typed by the caller. */
  private queryAll<T>(sql: string, params: SqlValue[] = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  /** Run a query expected to return at most one row with one column, and return that value. */
  private singleValue<T>(sql: string, params: SqlValue[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      if (!stmt.step()) return undefined;
      const row = stmt.getAsObject() as Record<string, unknown>;
      return Object.values(row)[0] as T;
    } finally {
      stmt.free();
    }
  }
}

interface EntityRow {
  id: string;
  type: string;
  name: string;
  file_path: string;
  tags: string;
  schema_version: number;
  data: string;
  body: string;
}

interface GlossaryRow {
  id: string;
  term: string;
  file_path: string;
  schema_version: number;
  data: string;
  body: string;
}

interface ScriptRow {
  id: string;
  file_path: string;
  title: string | null;
  order: number | null;
  production_code: string | null;
}

interface EventRow {
  id: string;
  name: string;
  file_path: string;
  schema_version: number;
  data: string;
  body: string;
}

/**
 * Map a raw entities-table row to an {@link EntityRecord}. `data` was written
 * from an already Zod-validated {@link EntityFrontmatter} at upsert time, so
 * it is trusted on read rather than re-validated.
 */
function rowToEntityRecord(row: EntityRow): EntityRecord {
  return {
    id: row.id,
    type: row.type as EntityType,
    name: row.name,
    filePath: row.file_path,
    tags: JSON.parse(row.tags) as string[],
    schemaVersion: row.schema_version,
    data: JSON.parse(row.data) as EntityFrontmatter,
    body: row.body,
  };
}

/** Map a raw glossary-table row to a {@link GlossaryRecord}. Same trust boundary as {@link rowToEntityRecord}. */
function rowToGlossaryRecord(row: GlossaryRow): GlossaryRecord {
  return {
    id: row.id,
    term: row.term,
    filePath: row.file_path,
    schemaVersion: row.schema_version,
    data: JSON.parse(row.data) as GlossaryTermFrontmatter,
    body: row.body,
  };
}

/** Map a raw scripts-table row to a {@link ScriptRecord}, converting SQL `NULL` back to `undefined`. */
function rowToScriptRecord(row: ScriptRow): ScriptRecord {
  return {
    id: row.id,
    filePath: row.file_path,
    title: row.title ?? undefined,
    order: row.order ?? undefined,
    productionCode: row.production_code ?? undefined,
  };
}

/** Map a raw events-table row to an {@link EventRecord}. Same trust boundary as {@link rowToEntityRecord}. */
function rowToEventRecord(row: EventRow): EventRecord {
  return {
    id: row.id,
    name: row.name,
    filePath: row.file_path,
    schemaVersion: row.schema_version,
    data: JSON.parse(row.data) as TimelineEventFrontmatter,
    body: row.body,
  };
}
