/**
 * Disk <-> index integration: build the index by walking workspace folders,
 * and incrementally re-index or remove a single file (Spec §2.2 — "build from
 * files" + "incremental updates on file save"). Also recomputes automatic
 * mentions (Spec §4.5) and detects dangling relation targets after every
 * (re)index.
 *
 * `.fountain` scripts are indexed too (Spec §4.5/§13.6): a script is a
 * mention *source* only, never a mention *target* — nothing links "to" a
 * script the way it can to an entity or glossary term — but it is stored as
 * its own {@link ScriptRecord} (title-page metadata: title, `Order`,
 * Production Code — see `model/script.ts`), not merely a mention source,
 * so a "Scripts" tree view has something to list and sort.
 *
 * Every time a script's text is read here — full build or incremental
 * reindex — its cue sidecar (Spec §15) is also regenerated via
 * `cues/sidecar.ts`, for the same reason: the sidecar is derived data that
 * must never drift from the script it was parsed from.
 *
 * A full build never throws on a bad file: malformed YAML, schema violations,
 * and filesystem read errors are all collected and reported in the returned
 * summary so the index rebuild can skip/flag rather than crash (Spec §23).
 * The actual `vscode.FileSystemWatcher` wiring that calls {@link reindexFile}
 * and {@link removeFileFromIndex} on save/delete lives in the extension
 * activation layer, not here — this module has no `vscode` dependency.
 *
 * Mentions consistency note: a full {@link buildIndexFromDisk} always
 * recomputes every source's mentions against the complete, final candidate
 * list, so cross-file mentions are exactly correct after a full rebuild. An
 * incremental {@link reindexFile} only recomputes the *changed* file's own
 * outgoing mentions against whatever is currently known — if that file
 * introduces a brand-new entity name, files that already mention that name in
 * plain prose won't retroactively gain a mention edge until they are
 * themselves reindexed or a full rebuild runs. This is a deliberate v1
 * simplification, not an oversight: "Rebuild Index" is the always-correct
 * escape valve (ADR-0007).
 *
 * `README.md` (any case) is never treated as an entity or glossary file, even
 * when it sits directly in `world/` or `world/glossary/` — LoreFountain
 * scaffolds one into each of those folders (`readmeFiles.ts`), and without
 * this exclusion every project that adopts it would fail to index.
 *
 * Two script-specific checks run in the same full-candidate-list pass as
 * dangling relations (only from {@link buildIndexFromDisk} — see the same
 * caveat as the mentions-consistency note above; an incremental
 * {@link reindexFile} does not re-check these across every other script,
 * only `Rebuild Index`/the validator does): two scripts sharing an `Order`
 * within the same immediate subfolder of `scripts/` (its "season" by
 * convention, though this module doesn't need to know that word — grouping
 * is purely "same parent folder") are a soft, warning-level ambiguity, since
 * nothing is lost — display just falls back to filename order. Two scripts
 * sharing a Production Code, by contrast, is an identity collision reported
 * at error severity (surfaced via `duplicateProductionCodes`, and treated as
 * exit-code-worthy by `cli/validate.ts`, same as a dangling relation) —
 * Production Codes are meant to be permanent and unique, assigned once by
 * "New Script" and never recomputed.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { updateCueSidecar } from '../cues/sidecar';
import type { ValidationIssue } from '../model/errors';
import { parseEntityFile, type EntityWarning } from '../model/entity';
import { parseGlossaryFile } from '../model/glossary';
import { parseScriptTitlePage, type ScriptWarning } from '../model/script';
import { idFromFilePath } from '../model/slug';
import { extractMentionTargets, type MentionCandidate } from './mentions';
import { findDanglingRelations } from './relations';
import type { IndexStore, ScriptRecord } from './store';

/** Subfolders of `world/` that are never walked for entity files (Spec §5). */
const ENTITY_EXCLUDED_SUBDIRS = ['glossary', 'timeline', 'notes'];

/** Case-insensitive check for the scaffolded `README.md` LoreFountain writes into every folder — documentation, never an entity/glossary file. */
function isReadme(filePath: string): boolean {
  return path.basename(filePath).toLowerCase() === 'readme.md';
}

/** One file that failed to parse during a build or incremental reindex. */
export interface IndexBuildIssue {
  filePath: string;
  reason: 'malformed-yaml' | 'invalid-schema' | 'read-error';
  message: string;
  issues?: ValidationIssue[];
}

/** A non-blocking warning about a script's title page changing its Production Code since it was last indexed — see the module doc comment on why this only fires for an incremental {@link reindexFile}, never a full build. */
export interface ScriptDriftWarning extends ValidationIssue {
  code: 'production-code-changed';
}

/** Every kind of non-blocking, per-file warning the index can produce. */
export type IndexWarning = EntityWarning | ScriptWarning | ScriptDriftWarning;

/** One file that parsed successfully but had a non-blocking warning (misplaced field, unusable Order/Production Code, or Production Code drift). */
export interface IndexBuildWarning {
  filePath: string;
  warnings: IndexWarning[];
}

/** One relation (Spec §4.5) whose `target` doesn't resolve to a known entity id. */
export interface IndexBuildDanglingRelation {
  filePath: string;
  target: string;
  relationType: string;
}

/** Two or more scripts in the same immediate subfolder of `scripts/` claiming the same `Order` — ambiguous display position, but nothing is lost (falls back to filename order). */
export interface IndexBuildDuplicateOrder {
  /** The shared parent folder's name, or `''` for scripts sitting directly in `scripts/`. */
  group: string;
  order: number;
  filePaths: string[];
}

/** Two or more scripts sharing the same Production Code — an identity collision, not merely a display ambiguity. */
export interface IndexBuildDuplicateProductionCode {
  productionCode: string;
  filePaths: string[];
}

/** Summary of a full {@link buildIndexFromDisk} pass. */
export interface IndexBuildSummary {
  entityCount: number;
  glossaryCount: number;
  scriptCount: number;
  malformed: IndexBuildIssue[];
  warnings: IndexBuildWarning[];
  danglingRelations: IndexBuildDanglingRelation[];
  duplicateScriptOrders: IndexBuildDuplicateOrder[];
  duplicateProductionCodes: IndexBuildDuplicateProductionCode[];
}

/** The three kinds of file the index tracks. Notes (§13.4) are never indexed. */
export type IndexableFileKind = 'entity' | 'glossary' | 'script';

/** Outcome of {@link reindexFile}. */
export type ReindexFileResult =
  | { ok: true; warnings: IndexWarning[]; danglingRelations: IndexBuildDanglingRelation[] }
  | { ok: false; reason: IndexBuildIssue['reason']; message: string; issues?: ValidationIssue[] };

/**
 * Rebuild the index by walking `folders.world` (for entities, excluding the
 * reserved `glossary/`, `timeline/`, and `notes/` subfolders), `folders.glossary`
 * (for glossary terms), and `folders.scripts` (for `.fountain` scripts as
 * mention sources), upserting/registering every file that parses/reads.
 *
 * Safe to call against a workspace where these folders don't exist yet — an
 * absent folder simply contributes zero files, not an error.
 *
 * @param store - The index to populate.
 * @param folders - Absolute paths to the `world`, `glossary`, and `scripts` folders.
 * @returns Counts of what was indexed, plus any malformed files or warnings.
 */
export async function buildIndexFromDisk(
  store: IndexStore,
  folders: { world: string; glossary: string; scripts: string },
): Promise<IndexBuildSummary> {
  const summary: IndexBuildSummary = {
    entityCount: 0,
    glossaryCount: 0,
    scriptCount: 0,
    malformed: [],
    warnings: [],
    danglingRelations: [],
    duplicateScriptOrders: [],
    duplicateProductionCodes: [],
  };

  const entityFiles = (await listFilesWithExtension(folders.world, '.md', ENTITY_EXCLUDED_SUBDIRS)).filter(
    (filePath) => !isReadme(filePath),
  );
  for (const filePath of entityFiles) {
    const result = await reindexFile(store, filePath, 'entity', { recomputeMentions: false });
    if (result.ok) {
      summary.entityCount += 1;
      if (result.warnings.length > 0) {
        summary.warnings.push({ filePath, warnings: result.warnings });
      }
    } else {
      summary.malformed.push({ filePath, reason: result.reason, message: result.message, issues: result.issues });
    }
  }

  const glossaryFiles = (await listFilesWithExtension(folders.glossary, '.md')).filter(
    (filePath) => !isReadme(filePath),
  );
  for (const filePath of glossaryFiles) {
    const result = await reindexFile(store, filePath, 'glossary', { recomputeMentions: false });
    if (result.ok) {
      summary.glossaryCount += 1;
    } else {
      summary.malformed.push({ filePath, reason: result.reason, message: result.message, issues: result.issues });
    }
  }

  // Scripts have no schema to validate, so reading never "fails" the way
  // entity/glossary parsing can — read the text, parse the title page, and
  // upsert now, but defer mention computation to the one full pass below
  // (avoids computing against a still-partial candidate list, and avoids
  // reading each script file twice).
  const scriptFiles = await listFilesWithExtension(folders.scripts, '.fountain');
  const scriptTexts = new Map<string, string>();
  for (const filePath of scriptFiles) {
    try {
      const text = await fsp.readFile(filePath, 'utf8');
      scriptTexts.set(filePath, text);
      summary.scriptCount += 1;
      await updateCueSidecar(filePath, text);

      const { script, warnings } = parseScriptTitlePage(text, { id: idFromFilePath(filePath), filePath });
      store.upsertScript(script);
      if (warnings.length > 0) {
        summary.warnings.push({ filePath, warnings });
      }
    } catch (err) {
      summary.malformed.push({ filePath, reason: 'read-error', message: errorMessage(err) });
    }
  }

  // A single pass over the now-complete candidate list, after every file has
  // been upserted — see the module doc comment on why this differs from the
  // per-file recompute an incremental `reindexFile` call does on its own.
  const { danglingRelations, duplicateScriptOrders, duplicateProductionCodes } = recomputeMentionsAndFindIssues(
    store,
    scriptTexts,
    folders.scripts,
  );
  summary.danglingRelations = danglingRelations;
  summary.duplicateScriptOrders = duplicateScriptOrders;
  summary.duplicateProductionCodes = duplicateProductionCodes;

  return summary;
}

/**
 * Re-parse/re-read a single file and update the index accordingly. Used both
 * by the full disk build and by incremental file-watcher updates on save.
 *
 * @param store - The index to update.
 * @param filePath - Absolute path to the changed file.
 * @param kind - Whether the file is an entity, a glossary term, or a script.
 * @param options - `recomputeMentions` (default `true`) recomputes this
 *   file's own outgoing mentions and dangling relations against the store's
 *   current candidates. {@link buildIndexFromDisk} passes `false` per-file and
 *   does one correct pass over the complete set afterward instead.
 * @returns Success with any warnings/dangling relations, or a described, non-throwing failure.
 */
export async function reindexFile(
  store: IndexStore,
  filePath: string,
  kind: IndexableFileKind,
  options: { recomputeMentions?: boolean } = {},
): Promise<ReindexFileResult> {
  const recomputeMentions = options.recomputeMentions ?? true;

  let text: string;
  try {
    text = await fsp.readFile(filePath, 'utf8');
  } catch (err) {
    return { ok: false, reason: 'read-error', message: errorMessage(err) };
  }

  const id = idFromFilePath(filePath);

  if (kind === 'script') {
    await updateCueSidecar(filePath, text);

    const priorProductionCode = store.getScriptByPath(filePath)?.productionCode;
    const { script, warnings } = parseScriptTitlePage(text, { id, filePath });
    store.upsertScript(script);

    const allWarnings: IndexWarning[] = [...warnings];
    const newProductionCode = script.frontmatter.productionCode;
    if (priorProductionCode !== undefined && newProductionCode !== undefined && priorProductionCode !== newProductionCode) {
      allWarnings.push({
        code: 'production-code-changed',
        path: 'production_code',
        message: `Production Code changed from "${priorProductionCode}" to "${newProductionCode}" — production codes are meant to be permanent once assigned.`,
      });
    }

    if (recomputeMentions) {
      const candidates = buildMentionCandidates(store);
      store.setMentionsForSource({ id, kind: 'script', filePath }, extractMentionTargets(text, candidates));
    }
    return { ok: true, warnings: allWarnings, danglingRelations: [] };
  }

  if (kind === 'entity') {
    const result = parseEntityFile(text, { id, filePath });
    if (!result.ok) {
      return { ok: false, reason: result.reason, message: result.message, issues: result.issues };
    }
    store.upsertEntity(result.entity);

    let danglingRelations: IndexBuildDanglingRelation[] = [];
    if (recomputeMentions) {
      const candidates = buildMentionCandidates(store);
      store.setMentionsForSource(
        { id: result.entity.id, kind: 'entity', filePath },
        extractMentionTargets(result.entity.body, candidates, result.entity.id),
      );
      const knownEntityIds = new Set(store.listEntities().map((e) => e.id));
      danglingRelations = findDanglingRelations(result.entity.frontmatter.relations, knownEntityIds).map(
        (relation) => ({ filePath, target: relation.target, relationType: relation.relationType }),
      );
    }
    return { ok: true, warnings: result.warnings, danglingRelations };
  }

  const result = parseGlossaryFile(text, { id, filePath });
  if (!result.ok) {
    return { ok: false, reason: result.reason, message: result.message, issues: result.issues };
  }
  store.upsertGlossaryTerm(result.term);

  if (recomputeMentions) {
    const candidates = buildMentionCandidates(store);
    store.setMentionsForSource(
      { id: result.term.id, kind: 'glossary', filePath },
      extractMentionTargets(result.term.body, candidates, result.term.id),
    );
  }
  return { ok: true, warnings: [], danglingRelations: [] };
}

/**
 * Remove a deleted file's row/mentions from the index. Safe to call even if
 * the file was never indexed (e.g. it was malformed, or is outside the
 * indexed folders).
 *
 * @param store - The index to update.
 * @param filePath - Absolute path to the deleted file.
 * @param kind - Whether the file was an entity, a glossary term, or a script.
 */
export function removeFileFromIndex(store: IndexStore, filePath: string, kind: IndexableFileKind): void {
  if (kind === 'entity') {
    store.removeEntityByPath(filePath);
  } else if (kind === 'glossary') {
    store.removeGlossaryTermByPath(filePath);
  } else {
    store.removeScriptByPath(filePath);
    store.removeMentionsForSource({ id: idFromFilePath(filePath), kind: 'script' });
  }
}

/**
 * Build the full mention-candidate list from every entity and glossary term
 * currently in the store. Exported for the hover/completion providers
 * (Phase C), which need the same candidate list to match against.
 */
export function buildMentionCandidates(store: IndexStore): MentionCandidate[] {
  const candidates: MentionCandidate[] = [];
  for (const entity of store.listEntities()) {
    candidates.push({ id: entity.id, kind: 'entity', names: [entity.name, ...(entity.data.aliases ?? [])] });
  }
  for (const term of store.listGlossaryTerms()) {
    candidates.push({ id: term.id, kind: 'glossary', names: [term.term, ...(term.data.aliases ?? [])] });
  }
  return candidates;
}

/** Result of {@link recomputeMentionsAndFindIssues}. */
interface CrossFileIssues {
  danglingRelations: IndexBuildDanglingRelation[];
  duplicateScriptOrders: IndexBuildDuplicateOrder[];
  duplicateProductionCodes: IndexBuildDuplicateProductionCode[];
}

/**
 * Recompute every entity's, glossary term's, and script's outgoing mentions
 * against the store's complete, current candidate list, and detect dangling
 * relation targets and script Order/Production Code collisions across the
 * whole project. Intended to run once, after every file in a full disk build
 * has already been upserted/read (see the module doc comment).
 */
function recomputeMentionsAndFindIssues(
  store: IndexStore,
  scriptTexts: ReadonlyMap<string, string>,
  scriptsRoot: string,
): CrossFileIssues {
  const candidates = buildMentionCandidates(store);
  const entities = store.listEntities();
  const knownEntityIds = new Set(entities.map((entity) => entity.id));
  const danglingRelations: IndexBuildDanglingRelation[] = [];

  for (const entity of entities) {
    store.setMentionsForSource(
      { id: entity.id, kind: 'entity', filePath: entity.filePath },
      extractMentionTargets(entity.body, candidates, entity.id),
    );
    for (const relation of findDanglingRelations(entity.data.relations, knownEntityIds)) {
      danglingRelations.push({
        filePath: entity.filePath,
        target: relation.target,
        relationType: relation.relationType,
      });
    }
  }

  for (const term of store.listGlossaryTerms()) {
    store.setMentionsForSource(
      { id: term.id, kind: 'glossary', filePath: term.filePath },
      extractMentionTargets(term.body, candidates, term.id),
    );
  }

  for (const [filePath, text] of scriptTexts) {
    store.setMentionsForSource(
      { id: idFromFilePath(filePath), kind: 'script', filePath },
      extractMentionTargets(text, candidates),
    );
  }

  const { duplicateScriptOrders, duplicateProductionCodes } = findScriptIssues(store.listScripts(), scriptsRoot);
  return { danglingRelations, duplicateScriptOrders, duplicateProductionCodes };
}

/**
 * Detect two script-level collisions across the whole project: two scripts
 * in the same immediate subfolder of `scripts/` sharing an `Order` (warning —
 * see {@link IndexBuildDuplicateOrder}), and two scripts anywhere sharing a
 * Production Code (error — see {@link IndexBuildDuplicateProductionCode}).
 */
function findScriptIssues(
  scripts: readonly ScriptRecord[],
  scriptsRoot: string,
): Pick<CrossFileIssues, 'duplicateScriptOrders' | 'duplicateProductionCodes'> {
  // Keyed by group name, one inner map per group from order -> file paths --
  // avoids encoding (group, order) into a single delimited string, since a
  // group name (a folder name, e.g. "Season 01") may itself contain spaces
  // that would make a flat key ambiguous to split back apart.
  const byGroupThenOrder = new Map<string, Map<number, string[]>>();
  const byProductionCode = new Map<string, string[]>();

  for (const script of scripts) {
    if (script.order !== undefined) {
      const group = deriveScriptGroup(scriptsRoot, script.filePath);
      const byOrder = byGroupThenOrder.get(group) ?? new Map<number, string[]>();
      const filePaths = byOrder.get(script.order) ?? [];
      filePaths.push(script.filePath);
      byOrder.set(script.order, filePaths);
      byGroupThenOrder.set(group, byOrder);
    }
    if (script.productionCode !== undefined) {
      const filePaths = byProductionCode.get(script.productionCode) ?? [];
      filePaths.push(script.filePath);
      byProductionCode.set(script.productionCode, filePaths);
    }
  }

  const duplicateScriptOrders: IndexBuildDuplicateOrder[] = [];
  for (const [group, byOrder] of byGroupThenOrder) {
    for (const [order, filePaths] of byOrder) {
      if (filePaths.length < 2) continue;
      duplicateScriptOrders.push({ group, order, filePaths });
    }
  }

  const duplicateProductionCodes: IndexBuildDuplicateProductionCode[] = [];
  for (const [productionCode, filePaths] of byProductionCode) {
    if (filePaths.length < 2) continue;
    duplicateProductionCodes.push({ productionCode, filePaths });
  }

  return { duplicateScriptOrders, duplicateProductionCodes };
}

/**
 * The shared grouping key for {@link IndexBuildDuplicateOrder}: the script's
 * immediate parent subfolder of `scripts/`, or `''` if it sits directly in
 * `scripts/`. Exported for the Scripts tree view, which groups its top level
 * the same way.
 */
export function deriveScriptGroup(scriptsRoot: string, filePath: string): string {
  const relative = path.relative(scriptsRoot, path.dirname(filePath));
  if (relative === '') return '';
  return relative.split(path.sep)[0];
}

/**
 * Recursively collect file paths under `dir` whose name ends with `extension`,
 * skipping any directory whose name appears in `excludeSubdirNames` at any
 * depth. Returns an empty array if `dir` does not exist.
 *
 * Exported for reuse by anything else that needs the same file-discovery
 * logic (e.g. the entity rename command scanning `.fountain` scripts).
 */
export async function listFilesWithExtension(
  dir: string,
  extension: string,
  excludeSubdirNames: string[] = [],
): Promise<string[]> {
  const excluded = new Set(excludeSubdirNames);
  const results: string[] = [];
  await walk(dir, extension, excluded, results);
  return results;
}

async function walk(dir: string, extension: string, excluded: Set<string>, out: string[]): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (excluded.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), extension, excluded, out);
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      out.push(path.join(dir, entry.name));
    }
  }
}

/** Extract a message from an unknown thrown value. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
