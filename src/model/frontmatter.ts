/**
 * Generic Markdown-with-YAML-frontmatter parsing and serialization.
 *
 * Entity and glossary files are plain Markdown with a leading Jekyll-style
 * `---` YAML frontmatter block (Spec §2.1, §18). This module isolates the
 * split/parse/serialize mechanics from the entity/glossary schemas layered on
 * top. Parsing is tolerant: malformed YAML is reported, never thrown (Spec §23).
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

/**
 * Leading frontmatter block: `---` ... `---`, tolerating a BOM, CRLF, and an
 * empty block. The optional inner newline lets a `---`/`---` pair with no
 * content match.
 */
const FRONTMATTER_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)(?:\r?\n)?---[ \t]*(?:\r?\n|$)/;

/** The result of splitting a Markdown document into frontmatter + body. */
export interface ParsedMarkdown {
  /** Parsed frontmatter mapping (empty object when there is no block). */
  frontmatter: Record<string, unknown>;
  /** Document body after the frontmatter block. */
  body: string;
  /** Whether a frontmatter block was actually present. */
  hadFrontmatter: boolean;
}

/** Outcome of {@link parseMarkdownWithFrontmatter}. */
export type FrontmatterResult =
  | { ok: true; value: ParsedMarkdown }
  | { ok: false; message: string };

/**
 * Split a Markdown document into its frontmatter mapping and body.
 *
 * Never throws. A document with no frontmatter block yields an empty mapping
 * and the full text as the body. Invalid YAML, or a frontmatter block that is
 * not a mapping, is reported via the `ok: false` branch.
 *
 * @param text - Raw file contents.
 * @returns A discriminated result with the parsed value or an error message.
 */
export function parseMarkdownWithFrontmatter(text: string): FrontmatterResult {
  const match = FRONTMATTER_RE.exec(text);
  if (!match) {
    return { ok: true, value: { frontmatter: {}, body: stripBom(text), hadFrontmatter: false } };
  }

  const body = normalizeBody(text.slice(match[0].length));
  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]);
  } catch (err) {
    return { ok: false, message: `Invalid YAML frontmatter: ${errorMessage(err)}` };
  }

  if (parsed === null || parsed === undefined) {
    return { ok: true, value: { frontmatter: {}, body, hadFrontmatter: true } };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, message: 'Frontmatter must be a YAML mapping (key/value pairs).' };
  }

  return {
    ok: true,
    value: { frontmatter: parsed as Record<string, unknown>, body, hadFrontmatter: true },
  };
}

/**
 * Serialize a frontmatter mapping and body back into a Markdown document.
 *
 * Produces a `---`-delimited YAML block followed by a blank line and the body,
 * with a single trailing newline.
 *
 * @param frontmatter - The mapping to serialize as YAML.
 * @param body - The Markdown body to append.
 * @returns The combined document text.
 */
export function serializeMarkdownWithFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const yaml = stringifyYaml(frontmatter).trimEnd();
  const trimmedBody = body.replace(/^\s*\n/, '').trimEnd();
  return `---\n${yaml}\n---\n\n${trimmedBody}\n`;
}

/** Strip a leading UTF-8 BOM if present. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Normalize a body extracted after a frontmatter block: drop the single blank
 * separator line and trailing whitespace, so a write/read round-trip is stable.
 */
function normalizeBody(text: string): string {
  return text.replace(/^\r?\n/, '').trimEnd();
}

/** Extract a message from an unknown thrown value. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
