/**
 * Line-level scan of a Fountain script into the items the shot features
 * need: scene headings, LoreFountain prefix lines ("directives"), action
 * lines, and dialogue (character cues, parentheticals, spoken lines), each
 * with its 0-based physical line number.
 *
 * Exports {@link scanScript} and the {@link ScriptItem} union. Consumed by
 * `parseShots.ts` (the shot list) and `shotMap.ts` (the `.shots.json`
 * sidecar) so both walk the script identically.
 *
 * Fountain is parsed exactly as `fountain-js` parses it (ADR-0038: extend
 * Fountain, never change it). The one adjustment is the long-standing
 * LoreFountain workaround for its own convention lines: Fountain's
 * character-cue rule (an ALL-CAPS line immediately followed by non-blank
 * text) can misread an all-caps `SHOT: WIDE` line as a character cue, with
 * the lines stacked under it as "dialogue". A LoreFountain prefix line is
 * action prose by intent, so a "character cue" that is really a prefix line
 * turns its whole block back into directives and action lines. A genuine
 * character name never matches a prefix line, so real dialogue is untouched.
 * Prefix lines inside ordinary dialogue text (no blank line between) are
 * also read as directives, matching what the shot parser has always done.
 *
 * Gotchas:
 * - Title-page tokens are skipped entirely.
 * - Notes, boneyard, sections, synopses and page breaks produce no items:
 *   they're hidden or structural, never heard or seen.
 * - Positions come from `fountain/parse.ts`'s best-effort recovery; a token
 *   whose text can't be located is skipped rather than mis-positioned.
 */

import type { Token } from 'fountain-js';
import { matchPrefixLine, type PrefixKeyword } from '../fountain/conventions';
import { mapTokensToPositions, parseFountain } from '../fountain/parse';

/** A scene heading line. */
export interface HeadingItem {
  kind: 'heading';
  line: number;
  /** The heading text, trimmed. */
  text: string;
}

/** A LoreFountain prefix line (`SHOT:`, `POSE:`, `PAUSE:`, `SFX:`, ...). */
export interface DirectiveItem {
  kind: 'directive';
  line: number;
  keyword: PrefixKeyword;
  /** The text after the prefix, untrimmed at the end. */
  rest: string;
}

/** One non-blank physical line of action. */
export interface ActionItem {
  kind: 'action';
  line: number;
  /** The line's text, trimmed. */
  text: string;
  /** True when this is the first non-blank line of a Fountain action block (the line right after a blank line). */
  blockStart: boolean;
}

/** A character cue opening a dialogue block. */
export interface CharacterItem {
  kind: 'character';
  line: number;
  /** The character name without extensions, `^` or a leading `@`. */
  name: string;
  /** Parenthesized extensions on the cue line, in order, with `CONT'D` dropped. */
  extensions: string[];
  /** True for the second speaker of Fountain dual dialogue (`^`): spoken at the same time as the block before it. */
  simultaneous: boolean;
}

/** A parenthetical line inside a dialogue block. */
export interface ParentheticalItem {
  kind: 'parenthetical';
  line: number;
  /** The parenthetical text, trimmed, parentheses included. */
  text: string;
  /** The block's character cue. */
  speaker: CharacterItem;
}

/** A run of spoken text inside a dialogue block (consecutive physical lines joined with spaces). */
export interface DialogueItem {
  kind: 'dialogue';
  line: number;
  text: string;
  /** The block's character cue. */
  speaker: CharacterItem;
}

/** Visible content with no further meaning to the shot features (centered text, transitions, lyrics). */
export interface OtherContentItem {
  kind: 'other';
  line: number;
}

/** One scanned item, in document order. */
export type ScriptItem =
  | HeadingItem
  | DirectiveItem
  | ActionItem
  | CharacterItem
  | ParentheticalItem
  | DialogueItem
  | OtherContentItem;

/** Token types that belong to the script body (anything before the first one is the title page). */
const BODY_TOKEN_TYPES = new Set([
  'scene_heading',
  'action',
  'character',
  'dialogue_begin',
  'dual_dialogue_begin',
  'dialogue',
  'parenthetical',
  'centered',
  'transition',
  'lyrics',
  'section',
  'synopsis',
  'note',
  'boneyard_begin',
  'page_break',
]);

/** Token types that are visible content but carry nothing the shot features read. */
const OTHER_CONTENT_TOKEN_TYPES = new Set(['centered', 'transition', 'lyrics']);

/** `CONT'D` and its common spellings: a continuation marker, not an extension. */
const CONTINUED_EXTENSION = /^CONT(?:'|’)?D\.?$|^CONT\.?$|^CONTINUED$/i;

/**
 * Split a character cue's text into its name and cue-line extensions.
 *
 * @param text - The `character` token text, e.g. `LUCIEN (V.O.) (CONT'D)`.
 * @returns The bare name and the extensions, with `CONT'D` dropped.
 */
export function parseCharacterCue(text: string): { name: string; extensions: string[] } {
  let remaining = text.trim().replace(/\s*\^$/, '');
  const extensions: string[] = [];
  const trailingExtension = /\s*\(([^()]*)\)\s*$/;
  for (let match = trailingExtension.exec(remaining); match; match = trailingExtension.exec(remaining)) {
    const extension = match[1].trim();
    if (extension && !CONTINUED_EXTENSION.test(extension)) extensions.unshift(extension);
    remaining = remaining.slice(0, match.index);
  }
  const name = remaining.trim().replace(/^@/, '');
  return { name, extensions };
}

/**
 * Scan a script's raw text into {@link ScriptItem}s, in document order.
 *
 * @param scriptText - The `.fountain` file's full text.
 * @returns Every heading, directive, action line and dialogue item found.
 */
export function scanScript(scriptText: string): ScriptItem[] {
  const tokens = parseFountain(scriptText);
  const positions = new Map<Token, number>();
  for (const positioned of mapTokensToPositions(scriptText, tokens)) {
    positions.set(positioned.token, positioned.line);
  }

  const items: ScriptItem[] = [];
  let inBody = false;
  let nextIsSimultaneous = false;
  /** The open dialogue block's cue, or `null` while inside a block that is really a misread prefix line. */
  let block: CharacterItem | null | undefined;

  for (const token of tokens) {
    if (!inBody) {
      if (!BODY_TOKEN_TYPES.has(token.type)) continue;
      inBody = true;
    }

    if (token.type === 'dialogue_begin') {
      nextIsSimultaneous = (token as Token & { dual?: string }).dual === 'right';
      continue;
    }
    if (token.type === 'dialogue_end') {
      block = undefined;
      continue;
    }

    const line = positions.get(token);
    if (line === undefined) continue;
    const physicalLines = (token.text ?? '').split('\n');

    switch (token.type) {
      case 'scene_heading':
        items.push({ kind: 'heading', line, text: (token.text ?? '').trim() });
        break;

      case 'action':
        pushActionLines(items, physicalLines, line, true);
        break;

      case 'character': {
        const directive = matchPrefixLine(physicalLines[0]);
        if (directive) {
          // A misread prefix line: the whole block is directives and action.
          items.push({ kind: 'directive', line, keyword: directive.keyword, rest: directive.rest });
          block = null;
          break;
        }
        const { name, extensions } = parseCharacterCue(token.text ?? '');
        block = { kind: 'character', line, name, extensions, simultaneous: nextIsSimultaneous };
        nextIsSimultaneous = false;
        items.push(block);
        break;
      }

      case 'parenthetical':
      case 'dialogue':
        if (!block) {
          pushActionLines(items, physicalLines, line, false);
        } else if (token.type === 'parenthetical') {
          items.push({ kind: 'parenthetical', line, text: (token.text ?? '').trim(), speaker: block });
        } else {
          pushDialogueLines(items, physicalLines, line, block);
        }
        break;

      default:
        if (OTHER_CONTENT_TOKEN_TYPES.has(token.type)) items.push({ kind: 'other', line });
        break;
    }
  }

  return items;
}

/** Push each non-blank physical line of an action block as a directive or an action line. */
function pushActionLines(items: ScriptItem[], physicalLines: string[], firstLine: number, isBlock: boolean): void {
  let seenContent = false;
  physicalLines.forEach((lineText, index) => {
    const line = firstLine + index;
    const directive = matchPrefixLine(lineText);
    if (directive) {
      items.push({ kind: 'directive', line, keyword: directive.keyword, rest: directive.rest });
      seenContent = true;
      return;
    }
    const text = lineText.trim();
    if (!text) return;
    items.push({ kind: 'action', line, text, blockStart: isBlock && !seenContent });
    seenContent = true;
  });
}

/** Push a dialogue token's lines: runs of spoken lines become one dialogue item, prefix lines become directives. */
function pushDialogueLines(items: ScriptItem[], physicalLines: string[], firstLine: number, speaker: CharacterItem): void {
  let run: { line: number; parts: string[] } | undefined;
  const flush = (): void => {
    if (run && run.parts.length > 0) {
      items.push({ kind: 'dialogue', line: run.line, text: run.parts.join(' '), speaker });
    }
    run = undefined;
  };

  physicalLines.forEach((lineText, index) => {
    const line = firstLine + index;
    const directive = matchPrefixLine(lineText);
    if (directive) {
      flush();
      items.push({ kind: 'directive', line, keyword: directive.keyword, rest: directive.rest });
      return;
    }
    const text = lineText.trim();
    if (!text) return;
    if (!run) run = { line, parts: [] };
    run.parts.push(text);
  });
  flush();
}
