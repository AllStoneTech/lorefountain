/**
 * Hover provider (Spec §6): shows a Story Card preview when hovering over a
 * recognized entity/glossary mention in a `.fountain` script — a character
 * cue, a name in dialogue/action, or a `[[wikilink]]`, all handled uniformly
 * by the same mention-matching used for the index (Spec §4.5). Thin
 * `vscode`-facing wrapper over the pure logic in `index/mentions.ts` and
 * `storyCard.ts`; not covered by the vitest unit suite (would require the
 * extension host) — verify manually via the F5 Extension Development Host.
 */

import * as vscode from 'vscode';
import { buildMentionCandidates } from '../index/build';
import { findMentionOccurrences } from '../index/mentions';
import type { IndexStore, MentionEndpoint } from '../index/store';
import { markFeatureUsedThisSession } from '../telemetry/events';
import { renderEntityStoryCard, renderGlossaryStoryCard } from './storyCard';

/**
 * Create a hover provider that resolves entity/glossary mentions via
 * whichever {@link IndexStore} owns the hovered document.
 *
 * @param getStoreForDocument - Resolves the index for a given document (its workspace folder), or `undefined` outside any tracked workspace.
 * @returns A `vscode.HoverProvider` to register for the `fountain` language.
 */
export function createFountainHoverProvider(
  getStoreForDocument: (document: vscode.TextDocument) => IndexStore | undefined,
): vscode.HoverProvider {
  return {
    provideHover(document, position) {
      // Synchronous, zero-I/O — hover fires far too often to record a real
      // event per call (see `telemetry/events.ts`'s `markFeatureUsedThisSession`).
      markFeatureUsedThisSession('hover');

      const store = getStoreForDocument(document);
      if (!store) return undefined;

      const text = document.getText();
      const offset = document.offsetAt(position);
      const candidates = buildMentionCandidates(store);
      const hit = findMentionOccurrences(text, candidates).find((o) => offset >= o.start && offset < o.end);
      if (!hit) return undefined;

      const sections = hit.targets
        .map((target) => renderStoryCardFor(store, target))
        .filter((section): section is string => section !== undefined);
      if (sections.length === 0) return undefined;

      const markdown = new vscode.MarkdownString(sections.join('\n\n---\n\n'));
      const range = new vscode.Range(document.positionAt(hit.start), document.positionAt(hit.end));
      return new vscode.Hover(markdown, range);
    },
  };
}

function renderStoryCardFor(store: IndexStore, target: MentionEndpoint): string | undefined {
  if (target.kind === 'entity') {
    const entity = store.getEntityById(target.id);
    return entity ? renderEntityStoryCard(entity, store.getBacklinks(target)) : undefined;
  }
  if (target.kind === 'glossary') {
    const term = store.getGlossaryTermById(target.id);
    return term ? renderGlossaryStoryCard(term, store.getBacklinks(target)) : undefined;
  }
  // Scripts are never a hover target: they contribute no mentionable names
  // (Spec §4.5 — a script is a mention source only).
  return undefined;
}
