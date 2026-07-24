/**
 * Structured cross-episode search (Spec §13.6): "show me every scene where
 * Sango and Esu are in the same room" and "every line that mentions the
 * reactor core" — built on the same mention-matching primitives already
 * powering the index (`index/mentions.ts`), applied across every script in
 * the workspace rather than one file at a time. "Cross-episode" is read as
 * scoped to `.fountain` scripts specifically (an "episode" is a script),
 * not `world/` entity or glossary prose.
 */

import { mapTokensToPositions, parseFountain } from '../fountain/parse';
import { extractMentionTargets, findMentionOccurrences, type MentionCandidate } from '../index/mentions';

/** Every entity/glossary/script candidate mentioned within one scene of one script. */
export interface ScenePresence {
  scriptPath: string;
  /** 0-based index of this scene within its script. */
  sceneIndex: number;
  /** The scene heading's text, or a placeholder for a script with no scene headings. */
  sceneHeading: string;
  /** Ids of every candidate mentioned anywhere within this scene's text. */
  entityIds: ReadonlySet<string>;
}

/** One line, in one script, that mentions a specific candidate. */
export interface MentionLine {
  scriptPath: string;
  /** 0-based line number within the script. */
  line: number;
  /** The full (trimmed) text of that line, for display. */
  text: string;
}

/**
 * Split a script into scenes (by `scene_heading` tokens) and, for each,
 * determine every candidate mentioned anywhere within its text span.
 *
 * @param scriptPath - The script's path (carried through for reporting, not used for parsing).
 * @param scriptText - The script's raw text.
 * @param candidates - Every known entity/glossary candidate to match against.
 * @returns One entry per scene, in document order. A script with no scene headings yields a single scene spanning the whole text.
 */
export function extractScenePresence(
  scriptPath: string,
  scriptText: string,
  candidates: readonly MentionCandidate[],
): ScenePresence[] {
  const tokens = parseFountain(scriptText);
  const positioned = mapTokensToPositions(scriptText, tokens);
  const sceneHeadings = positioned.filter((p) => p.token.type === 'scene_heading');

  const bounds: { start: number; end: number; heading: string }[] =
    sceneHeadings.length === 0
      ? [{ start: 0, end: scriptText.length, heading: '(no scene heading)' }]
      : sceneHeadings.map((heading, index) => ({
          start: heading.start,
          end: index + 1 < sceneHeadings.length ? sceneHeadings[index + 1].start : scriptText.length,
          heading: (heading.token.text ?? '').trim(),
        }));

  return bounds.map((bound, sceneIndex) => {
    const sceneText = scriptText.slice(bound.start, bound.end);
    const entityIds = new Set(extractMentionTargets(sceneText, candidates).map((target) => target.id));
    return { scriptPath, sceneIndex, sceneHeading: bound.heading, entityIds };
  });
}

/**
 * Filter scenes down to ones where both given candidate ids are mentioned.
 *
 * @param scenes - Scenes from {@link extractScenePresence}, across any number of scripts.
 * @param idA - The first candidate's id.
 * @param idB - The second candidate's id.
 * @returns The subset of scenes mentioning both, in input order.
 */
export function findCoPresenceScenes(
  scenes: readonly ScenePresence[],
  idA: string,
  idB: string,
): ScenePresence[] {
  return scenes.filter((scene) => scene.entityIds.has(idA) && scene.entityIds.has(idB));
}

/**
 * Find every line in a script that mentions a specific candidate.
 *
 * @param scriptPath - The script's path (carried through for reporting).
 * @param scriptText - The script's raw text.
 * @param candidates - Every known entity/glossary candidate to match against.
 * @param targetId - The candidate id to search for.
 * @returns One entry per matching line, in document order (a line mentioning the target twice is reported once).
 */
export function findMentionLines(
  scriptPath: string,
  scriptText: string,
  candidates: readonly MentionCandidate[],
  targetId: string,
): MentionLine[] {
  const occurrences = findMentionOccurrences(scriptText, candidates).filter((occurrence) =>
    occurrence.targets.some((target) => target.id === targetId),
  );

  const seenLines = new Set<number>();
  const results: MentionLine[] = [];
  for (const occurrence of occurrences) {
    const { line, text } = lineAt(scriptText, occurrence.start);
    if (seenLines.has(line)) continue;
    seenLines.add(line);
    results.push({ scriptPath, line, text });
  }
  return results;
}

/** Resolve the 0-based line number and trimmed text of the line containing `offset`. */
function lineAt(text: string, offset: number): { line: number; text: string } {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const nextNewline = text.indexOf('\n', offset);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  let line = 0;
  for (let i = 0; i < lineStart; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) line += 1;
  }
  return { line, text: text.slice(lineStart, lineEnd).trim() };
}
