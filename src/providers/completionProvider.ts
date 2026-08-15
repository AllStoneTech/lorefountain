/**
 * Wikilink completion provider (Spec §6, §13.2): typing `[[` offers
 * autocomplete against every known entity/glossary name and alias, inside
 * `.fountain` scripts and world Markdown files alike. Thin `vscode`-facing
 * wrapper over the pure logic in `wikilink.ts` and `index/build.ts`'s
 * candidate list; not covered by the vitest unit suite (would require the
 * extension host) — verify manually via the F5 Extension Development Host.
 */

import * as vscode from 'vscode';
import { buildMentionCandidates } from '../index/build';
import type { IndexStore } from '../index/store';
import { markFeatureUsedThisSession } from '../telemetry/events';
import { computeWikilinkContext } from './wikilink';

/**
 * Create a completion provider that offers entity/glossary names after an
 * open `[[`, resolved via whichever {@link IndexStore} owns the document.
 *
 * @param getStoreForDocument - Resolves the index for a given document (its workspace folder), or `undefined` outside any tracked workspace.
 * @returns A `vscode.CompletionItemProvider` to register for the `fountain` and `markdown` languages.
 */
export function createWikilinkCompletionProvider(
  getStoreForDocument: (document: vscode.TextDocument) => IndexStore | undefined,
): vscode.CompletionItemProvider {
  return {
    provideCompletionItems(document, position) {
      const store = getStoreForDocument(document);
      if (!store) return undefined;

      const linePrefix = document.lineAt(position).text.slice(0, position.character);
      const context = computeWikilinkContext(linePrefix);
      if (!context) return undefined;

      // Synchronous, zero-I/O, and only reached once `[[` context is
      // confirmed — not on every keystroke (see `telemetry/events.ts`'s
      // `markFeatureUsedThisSession`).
      markFeatureUsedThisSession('completion');

      const range = new vscode.Range(position.line, context.typedStartColumn, position.line, position.character);
      const items: vscode.CompletionItem[] = [];
      const seen = new Set<string>();

      for (const candidate of buildMentionCandidates(store)) {
        for (const name of candidate.names) {
          const key = `${candidate.kind}:${candidate.id}:${name}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const item = new vscode.CompletionItem(
            name,
            candidate.kind === 'entity' ? vscode.CompletionItemKind.Class : vscode.CompletionItemKind.Reference,
          );
          item.filterText = name;
          // The user already typed `[[`; complete the name and the closing brackets.
          item.insertText = `${name}]]`;
          item.range = range;
          items.push(item);
        }
      }
      return items;
    },
  };
}
