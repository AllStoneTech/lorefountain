/**
 * Glossary term schema and file (de)serialization.
 *
 * The glossary is a deliberately lightweight layer, separate from full entities
 * (Spec §4.7): invented terminology or setting-specific vocabulary (e.g. ORUN's
 * Yoruba terms) that needs a term + short gloss, not relationships or a
 * timeline. One term per `.md` file under `/world/glossary`, mirroring the
 * entity storage model. Parsing is tolerant, like entities (Spec §23).
 */

import { z } from 'zod';
import type { ValidationIssue } from './errors';
import { CURRENT_SCHEMA_VERSION } from './entity';
import {
  parseMarkdownWithFrontmatter,
  serializeMarkdownWithFrontmatter,
} from './frontmatter';

/** Glossary term frontmatter schema (Spec §4.7). */
export const glossaryTermSchema = z
  .object({
    term: z.string().min(1),
    /** Short first-use gloss; longer definitions can go in the Markdown body. */
    gloss: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    schema_version: z.number().int().default(CURRENT_SCHEMA_VERSION),
  })
  .catchall(z.unknown());

export type GlossaryTermFrontmatter = z.infer<typeof glossaryTermSchema>;

/** A fully-resolved glossary term: validated frontmatter plus file context. */
export interface GlossaryTerm {
  /** Stable slug id, derived from the filename. */
  id: string;
  /** Absolute path to the source `.md` file. */
  filePath: string;
  /** Markdown body (optional longer definition). */
  body: string;
  /** Validated frontmatter fields. */
  frontmatter: GlossaryTermFrontmatter;
}

/** Outcome of {@link parseGlossaryFile}. */
export type GlossaryParseResult =
  | { ok: true; term: GlossaryTerm }
  | {
      ok: false;
      reason: 'malformed-yaml' | 'invalid-schema';
      filePath: string;
      message: string;
      issues?: ValidationIssue[];
    };

/**
 * Parse a glossary `.md` file into a validated {@link GlossaryTerm}.
 *
 * Never throws; failures are reported via the `ok: false` branch (Spec §23).
 *
 * @param fileText - Raw file contents.
 * @param opts - The derived `id` (slug) and `filePath` for the file.
 * @returns A discriminated result with the term or a described failure.
 */
export function parseGlossaryFile(
  fileText: string,
  opts: { id: string; filePath: string },
): GlossaryParseResult {
  const fm = parseMarkdownWithFrontmatter(fileText);
  if (!fm.ok) {
    return { ok: false, reason: 'malformed-yaml', filePath: opts.filePath, message: fm.message };
  }

  const parsed = glossaryTermSchema.safeParse(fm.value.frontmatter);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid-schema',
      filePath: opts.filePath,
      message: 'Glossary frontmatter failed validation.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    };
  }

  return {
    ok: true,
    term: {
      id: opts.id,
      filePath: opts.filePath,
      body: fm.value.body,
      frontmatter: parsed.data,
    },
  };
}

/**
 * Serialize a {@link GlossaryTerm} back into `.md` file text.
 *
 * @param term - The glossary term to serialize.
 * @returns The combined frontmatter + body document text.
 */
export function serializeGlossaryTerm(term: GlossaryTerm): string {
  return serializeMarkdownWithFrontmatter(term.frontmatter, term.body);
}
