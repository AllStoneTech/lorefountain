/**
 * Story Overview schema and file (de)serialization (the project owner, 2026-07-30,
 * following ADR-0029). `world/OVERVIEW.md` gets a small set of genuinely
 * universal structured fields — `title`, `pitch`, `tone`, `genre` — plus a
 * completely free Markdown body for everything else (Premise, Setting,
 * Synopsis, Themes, or whatever headers a given project's genre actually
 * calls for — a TTRPG campaign and a serialized drama don't want the same
 * sections, and nothing here should force them to).
 *
 * All frontmatter fields are optional, same posture as every other schema
 * in this project (Spec §4.2) — and deliberately so here specifically: an
 * `OVERVIEW.md` written before this schema existed (plain prose, no
 * frontmatter at all) must keep parsing cleanly, with its entire existing
 * content preserved as the body. Nothing is lost by adding structure later.
 */

import { z } from 'zod';
import type { ValidationIssue } from './errors';
import {
  parseMarkdownWithFrontmatter,
  serializeMarkdownWithFrontmatter,
} from './frontmatter';

/** Story Overview frontmatter schema. */
export const storyOverviewSchema = z
  .object({
    title: z.string().optional(),
    /** A one- or two-sentence logline. */
    pitch: z.string().optional(),
    tone: z.string().optional(),
    genre: z.string().optional(),
  })
  .catchall(z.unknown());

export type StoryOverviewFrontmatter = z.infer<typeof storyOverviewSchema>;

/** A fully-resolved Story Overview: validated frontmatter plus file context. */
export interface StoryOverview {
  /** Absolute path to `world/OVERVIEW.md`. */
  filePath: string;
  /** Markdown body — the free-form sections (Premise, Setting, Synopsis, Themes, or whatever the project actually wants). */
  body: string;
  frontmatter: StoryOverviewFrontmatter;
}

/** Outcome of {@link parseStoryOverviewFile}. */
export type StoryOverviewParseResult =
  | { ok: true; overview: StoryOverview }
  | {
      ok: false;
      reason: 'malformed-yaml' | 'invalid-schema';
      filePath: string;
      message: string;
      issues?: ValidationIssue[];
    };

/**
 * Parse a Story Overview file into a validated {@link StoryOverview}.
 *
 * Never throws; failures are reported via the `ok: false` branch (Spec §23).
 * A file with no frontmatter block at all (every `OVERVIEW.md` written
 * before this schema existed) parses successfully with every field unset
 * and its full original text as the body.
 *
 * @param fileText - Raw file contents.
 * @param filePath - Absolute path to the file (never indexed, so no `id` is needed).
 * @returns A discriminated result with the overview or a described failure.
 */
export function parseStoryOverviewFile(fileText: string, filePath: string): StoryOverviewParseResult {
  const fm = parseMarkdownWithFrontmatter(fileText);
  if (!fm.ok) {
    return { ok: false, reason: 'malformed-yaml', filePath, message: fm.message };
  }

  const parsed = storyOverviewSchema.safeParse(fm.value.frontmatter);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid-schema',
      filePath,
      message: 'Story Overview frontmatter failed validation.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    };
  }

  return {
    ok: true,
    overview: { filePath, body: fm.value.body, frontmatter: parsed.data },
  };
}

/**
 * Serialize a {@link StoryOverview} back into file text.
 *
 * @param overview - The Story Overview to serialize.
 * @returns The combined frontmatter + body document text.
 */
export function serializeStoryOverview(overview: StoryOverview): string {
  return serializeMarkdownWithFrontmatter(overview.frontmatter, overview.body);
}
