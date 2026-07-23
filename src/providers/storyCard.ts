/**
 * Story Card rendering (Spec §6.1): the same compact, structured summary of
 * an entity/glossary term, surfaced consistently across every UI touchpoint
 * — today, the hover preview; later, the TreeView selection and graph-node
 * click-through, per §6.1's "one consistent mental model." Returns plain
 * Markdown text (not a `vscode.MarkdownString`) so it stays unit-testable;
 * `hoverProvider.ts` wraps the result for display.
 */

import type { EntityRecord, GlossaryRecord, MentionBacklink } from '../index/store';

/**
 * Render an entity's Story Card as Markdown.
 *
 * @param entity - The entity to render.
 * @param backlinks - Sources that mention this entity (Spec §4.5), rendered as a "Mentioned in" line if non-empty.
 * @returns Markdown text for display in a hover (or, later, other Story Card surfaces).
 */
export function renderEntityStoryCard(entity: EntityRecord, backlinks: readonly MentionBacklink[] = []): string {
  const lines: string[] = [`**${entity.name}** _(${entity.type})_`];

  if (entity.data.pronunciation) {
    lines.push(`Pronounced: ${entity.data.pronunciation}`);
  }
  if (entity.data.aliases && entity.data.aliases.length > 0) {
    lines.push(`Aliases: ${entity.data.aliases.join(', ')}`);
  }
  if (entity.tags.length > 0) {
    lines.push(`Tags: ${entity.tags.map((tag) => `\`${tag}\``).join(' ')}`);
  }

  const snippet = firstNonEmptyLine(entity.body);
  if (snippet) {
    lines.push('', snippet);
  }

  appendBacklinksSection(lines, backlinks);
  return lines.join('\n\n');
}

/**
 * Render a glossary term's Story Card as Markdown.
 *
 * @param term - The glossary term to render.
 * @param backlinks - Sources that mention this term, rendered as a "Mentioned in" line if non-empty.
 * @returns Markdown text for display in a hover.
 */
export function renderGlossaryStoryCard(term: GlossaryRecord, backlinks: readonly MentionBacklink[] = []): string {
  const lines: string[] = [`**${term.term}** _(glossary)_`];

  if (term.data.gloss) {
    lines.push(term.data.gloss);
  } else {
    const snippet = firstNonEmptyLine(term.body);
    if (snippet) lines.push(snippet);
  }

  appendBacklinksSection(lines, backlinks);
  return lines.join('\n\n');
}

function appendBacklinksSection(lines: string[], backlinks: readonly MentionBacklink[]): void {
  if (backlinks.length === 0) return;
  const names = backlinks.map((backlink) => backlink.name).join(', ');
  lines.push(`Mentioned in: ${names}`);
}

/** The first non-blank line of `body`, trimmed — or `undefined` if `body` is all whitespace. */
function firstNonEmptyLine(body: string): string | undefined {
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}
