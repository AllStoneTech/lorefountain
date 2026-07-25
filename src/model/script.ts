/**
 * Script title-page metadata: pulls `Title`, `Order`, and `Production Code`
 * out of a `.fountain` file's standard title page.
 *
 * Unlike entity/glossary frontmatter, a script's metadata block is plain
 * Fountain syntax — `Key: Value` lines at the top of the file, terminated by
 * a blank line — not YAML, so this reuses the existing `fountain-js`-backed
 * parser (`src/fountain/parse.ts`) instead of `frontmatter.ts`. `fountain-js`
 * already tags every title-page line with `is_title: true` and normalizes
 * its key to lowercase-with-underscores (`"Production Code"` becomes
 * `production_code`), so no bespoke parsing is needed here.
 *
 * A script's title page never "fails to parse" the way YAML frontmatter can
 * be malformed — there's no required field. Invalid `Order`/`Production
 * Code` values are reported as non-blocking warnings, and the script still
 * indexes with that field simply left unset (Order falls back to
 * alphabetical-by-filename; Production Code is just absent).
 *
 * Caveat inherited from `fountain-js`: it only recognizes a block as a title
 * page at all if its *first* line is one of its own known keys (`Title`,
 * `Author`, `Credit`, `Source`, `Notes`, `Draft date`, `Date`, `Contact`,
 * `Copyright`, `Revisions`) — a title page made of *only* custom keys like
 * `Order`/`Production Code` is invisible to it, silently, with no warning.
 * In practice this never bites: every script created via "New Script" gets
 * `Title:` written first, and every real screenplay has one anyway.
 */

import * as path from 'node:path';
import { parseFountain } from '../fountain/parse';
import type { ValidationIssue } from './errors';
import { titleizeSlug } from './slug';

/** Validated title-page metadata this project reads; every field is optional. */
export interface ScriptFrontmatter {
  /** From the standard Fountain `Title:` field. */
  title?: string;
  /** From `Order:` — this script's position among its season's siblings; a positive whole number. */
  order?: number;
  /**
   * From `Production Code:` — a permanent SxEE identifier (e.g. `"1x01"`),
   * assigned once (by the "New Script" command) and never recomputed, even
   * if the episode later moves to a different season, folder, or `Order` —
   * the same TV-production convention a real production code follows.
   */
  productionCode?: string;
}

/** A parsed script: its title-page metadata plus file context. */
export interface Script {
  /** Stable slug id, derived from the filename — kept safe across renames via `onDidRenameFiles`, not an alias system (scripts are never mentioned by name in prose the way entities are). */
  id: string;
  filePath: string;
  frontmatter: ScriptFrontmatter;
}

/** A non-blocking warning about a title-page field that was present but unusable. */
export interface ScriptWarning extends ValidationIssue {
  code: 'invalid-order' | 'invalid-production-code';
}

/** Outcome of {@link parseScriptTitlePage} — always succeeds; problems are warnings, not failures. */
export interface ScriptParseResult {
  script: Script;
  warnings: ScriptWarning[];
}

/** Season digit(s) + `x` + episode digits, e.g. `1x01`, `12x03`. Case-insensitive on the `x`. */
const PRODUCTION_CODE_PATTERN = /^\d{1,2}x\d{2,3}$/i;

/**
 * Parse a `.fountain` file's title page into {@link ScriptFrontmatter}.
 *
 * @param fileText - Raw `.fountain` file contents.
 * @param opts - The derived `id` (slug) and `filePath` for the file.
 * @returns The parsed script plus any non-blocking warnings about unusable field values.
 */
export function parseScriptTitlePage(fileText: string, opts: { id: string; filePath: string }): ScriptParseResult {
  const fields = new Map<string, string>();
  for (const token of parseFountain(fileText)) {
    if (token.is_title && token.text !== undefined) {
      fields.set(token.type, token.text);
    }
  }

  const warnings: ScriptWarning[] = [];
  const frontmatter: ScriptFrontmatter = {};

  const title = fields.get('title');
  if (title) frontmatter.title = title;

  const rawOrder = fields.get('order');
  if (rawOrder !== undefined) {
    const parsedOrder = Number(rawOrder.trim());
    if (Number.isInteger(parsedOrder) && parsedOrder > 0) {
      frontmatter.order = parsedOrder;
    } else {
      warnings.push({
        code: 'invalid-order',
        path: 'order',
        message: `"Order: ${rawOrder}" is not a positive whole number — ignored; this script will sort alphabetically by filename instead.`,
      });
    }
  }

  const rawCode = fields.get('production_code');
  if (rawCode !== undefined) {
    const trimmedCode = rawCode.trim();
    if (PRODUCTION_CODE_PATTERN.test(trimmedCode)) {
      frontmatter.productionCode = trimmedCode;
    } else {
      warnings.push({
        code: 'invalid-production-code',
        path: 'production_code',
        message: `"Production Code: ${rawCode}" doesn't look like SxEE (e.g. "1x01") — ignored.`,
      });
    }
  }

  return {
    script: { id: opts.id, filePath: opts.filePath, frontmatter },
    warnings,
  };
}

/** Same starter-key whitelist `fountain-js` requires before it recognizes a title page at all — see this module's doc comment. */
const TITLE_PAGE_STARTER_PATTERN = /^\s*(title|credit|authors?|source|notes|draft ?date|date|contact|copyright|revisions?)\s*:/i;

/**
 * Insert or update one `Key: Value` line in a script's title page,
 * preserving everything else in the file untouched — used by drag-to-reorder
 * (rewriting `Order`) and "New Script" (writing the initial Title/Order/
 * Production Code). If the file has no title page `fountain-js` would even
 * recognize (see this module's doc comment on that caveat), a minimal one is
 * created first with `Title:` derived from the filename, so the field being
 * written is actually readable afterward rather than silently invisible.
 *
 * Simplification: assumes every existing title-page field is a single line —
 * true for every field LoreFountain itself ever writes (Title/Order/
 * Production Code), but a title page hand-edited to spread a field (e.g. a
 * long `Notes:`) across indented continuation lines would confuse the title
 * page's detected boundary. Not a concern in practice since this function
 * only ever touches the three fields above.
 *
 * @param fileText - The script's current full text.
 * @param key - The title-page key to set, in its natural form (e.g. `"Order"`, `"Production Code"`).
 * @param value - The value to write.
 * @param filePath - The script's path, used only to derive a fallback `Title:` if none exists yet.
 * @returns The updated file text.
 */
export function setTitlePageField(fileText: string, key: string, value: string, filePath: string): string {
  const fieldLine = `${key}: ${value}`;

  if (!TITLE_PAGE_STARTER_PATTERN.test(fileText)) {
    const fallbackTitle = titleizeSlug(path.basename(filePath, path.extname(filePath)));
    return `Title: ${fallbackTitle}\n${fieldLine}\n\n${fileText}`;
  }

  const lines = fileText.split('\n');
  let titlePageEnd = 0;
  while (titlePageEnd < lines.length && lines[titlePageEnd].trim() !== '') titlePageEnd += 1;

  const titleLines = lines.slice(0, titlePageEnd);
  const rest = lines.slice(titlePageEnd);

  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:`, 'i');
  const existingIndex = titleLines.findIndex((line) => keyPattern.test(line));
  if (existingIndex >= 0) {
    titleLines[existingIndex] = fieldLine;
  } else {
    titleLines.push(fieldLine);
  }

  return [...titleLines, ...rest].join('\n');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
