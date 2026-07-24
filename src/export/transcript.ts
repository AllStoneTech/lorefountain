/**
 * Transcript/accessibility export (Spec §16): "Fountain parse tree, dialogue
 * only, cues stripped... kept free-tier: it is nearly zero marginal
 * engineering cost once the parser exists, and accessibility should not be
 * a paywalled feature."
 *
 * "Dialogue only" is read literally: only `character`/`dialogue` token
 * pairs become transcript content. Everything else a listener never
 * actually *hears* — scene headings, action lines (which is where the
 * SFX:/MUSIC:/AMB: convention lives, Spec §15), transitions, and
 * parentheticals (performance direction, not spoken text) — is stripped.
 * Scene headings are the one exception kept in the output, not as spoken
 * content but as lightweight section breaks for readability (Spec §16's
 * named audiences — accessibility, publishing, show notes — all benefit
 * from knowing where one scene ends and the next begins).
 */

import type { FountainToken } from '../fountain/parse';

/** One entry in a built transcript: a scene-break heading, or one character's speaking turn. */
export type TranscriptEntry =
  | { kind: 'heading'; text: string }
  | { kind: 'line'; character: string; text: string };

/**
 * Build a transcript from a script's already-parsed token stream.
 *
 * Consecutive `dialogue` tokens for the same character (e.g. dialogue split
 * across lines by a parenthetical) are merged into a single speaking-turn
 * entry.
 *
 * @param tokens - The token stream from {@link parseFountain}.
 * @returns Transcript entries, in document order.
 */
export function buildTranscript(tokens: readonly FountainToken[]): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  let currentCharacter: string | undefined;
  let currentLine: string[] = [];

  const flush = (): void => {
    if (currentCharacter && currentLine.length > 0) {
      entries.push({ kind: 'line', character: currentCharacter, text: currentLine.join(' ').trim() });
    }
    currentLine = [];
  };

  for (const token of tokens) {
    switch (token.type) {
      case 'scene_heading':
        flush();
        currentCharacter = undefined;
        entries.push({ kind: 'heading', text: (token.text ?? '').trim() });
        break;
      case 'character':
        flush();
        currentCharacter = (token.text ?? '').trim();
        break;
      case 'dialogue':
        if (currentCharacter && token.text) {
          currentLine.push(token.text.trim());
        }
        break;
      case 'dialogue_end':
        flush();
        currentCharacter = undefined;
        break;
      default:
        // action (incl. SFX:/MUSIC:/AMB: cues), transitions, parentheticals,
        // notes, boneyard, etc. — never spoken content, never part of the transcript.
        break;
    }
  }
  flush();

  return entries;
}

/**
 * Serialize transcript entries to readable Markdown.
 *
 * @param title - A title for the transcript (typically the script's filename stem).
 * @param entries - Entries from {@link buildTranscript}.
 * @returns Markdown text, ready to write to a `.transcript.md` file.
 */
export function serializeTranscriptMarkdown(title: string, entries: readonly TranscriptEntry[]): string {
  const lines: string[] = [`# ${title}`, ''];

  for (const entry of entries) {
    if (entry.kind === 'heading') {
      lines.push(`## ${entry.text}`, '');
    } else {
      lines.push(`**${entry.character}:** ${entry.text}`, '');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
