/**
 * Unit tests for automatic mention detection.
 * Covers whole-word matching, case-insensitivity, Unicode names, aliases,
 * self-exclusion, genuinely overlapping candidates, and the no-candidates
 * edge case.
 */

import { describe, it, expect } from 'vitest';
import { extractMentionTargets, findMentionOccurrences, type MentionCandidate } from '../../src/index/mentions';

const candidates: MentionCandidate[] = [
  { id: 'sango', kind: 'entity', names: ['Sango', 'Shango'] },
  { id: 'esu', kind: 'entity', names: ['Esu'] },
  { id: 'the-ark', kind: 'entity', names: ['The Ark'] },
  { id: 'orunmila', kind: 'entity', names: ['Ọ̀rúnmìlà', 'Orunmila'] },
  { id: 'ase', kind: 'glossary', names: ['Ase'] },
];

describe('extractMentionTargets', () => {
  it('finds a simple mention', () => {
    const targets = extractMentionTargets('Sango spoke of the future.', candidates);
    expect(targets).toEqual([{ id: 'sango', kind: 'entity' }]);
  });

  it('finds multiple distinct mentions, in first-occurrence order', () => {
    const targets = extractMentionTargets('Sango and Esu argued on The Ark.', candidates);
    expect(targets).toEqual([
      { id: 'sango', kind: 'entity' },
      { id: 'esu', kind: 'entity' },
      { id: 'the-ark', kind: 'entity' },
    ]);
  });

  it('does not match a name embedded inside a longer word', () => {
    expect(extractMentionTargets('Sangoism is a made-up word.', candidates)).toEqual([]);
    expect(extractMentionTargets('Esux is not the same word.', candidates)).toEqual([]);
  });

  it('matches case-insensitively', () => {
    expect(extractMentionTargets('sango spoke.', candidates)).toEqual([{ id: 'sango', kind: 'entity' }]);
  });

  it('matches an alias as well as the primary name, resolving to the same id', () => {
    expect(extractMentionTargets('Shango is another name for the same orisha.', candidates)).toEqual([
      { id: 'sango', kind: 'entity' },
    ]);
  });

  it('deduplicates repeated mentions of the same target within one text', () => {
    expect(extractMentionTargets('Sango, Sango, Sango.', candidates)).toEqual([{ id: 'sango', kind: 'entity' }]);
  });

  it('matches Unicode names with combining diacritics', () => {
    expect(extractMentionTargets('Ọ̀rúnmìlà spoke of fate.', candidates)).toEqual([
      { id: 'orunmila', kind: 'entity' },
    ]);
  });

  it('matches a glossary term the same way as an entity', () => {
    expect(extractMentionTargets('This requires Ase to work.', candidates)).toEqual([
      { id: 'ase', kind: 'glossary' },
    ]);
  });

  it('excludes the given id (an entity never mentions itself)', () => {
    expect(extractMentionTargets('Sango spoke of Sango.', candidates, 'sango')).toEqual([]);
  });

  it('still matches other candidates while excluding the given id', () => {
    expect(extractMentionTargets('Sango and Esu.', candidates, 'sango')).toEqual([{ id: 'esu', kind: 'entity' }]);
  });

  it('matches two genuinely distinct candidates that overlap as substrings', () => {
    const overlapping: MentionCandidate[] = [
      { id: 'the-ark', kind: 'entity', names: ['The Ark'] },
      { id: 'ark', kind: 'entity', names: ['Ark'] },
    ];
    const targets = extractMentionTargets('The Ark sailed. Ark alone is also a candidate.', overlapping);
    expect(targets).toEqual([
      { id: 'the-ark', kind: 'entity' },
      { id: 'ark', kind: 'entity' },
    ]);
  });

  it('returns an empty array when there are no candidates', () => {
    expect(extractMentionTargets('Sango spoke.', [])).toEqual([]);
  });

  it('returns an empty array when nothing in the text matches', () => {
    expect(extractMentionTargets('No mentions here at all.', candidates)).toEqual([]);
  });

  it('ignores empty or whitespace-only names among a candidate\'s names', () => {
    const withBlank: MentionCandidate[] = [{ id: 'x', kind: 'entity', names: ['', '  ', 'Sango'] }];
    expect(extractMentionTargets('Sango spoke.', withBlank)).toEqual([{ id: 'x', kind: 'entity' }]);
  });

  it('supports a script as a mention source kind', () => {
    const scriptCandidates: MentionCandidate[] = [...candidates, { id: '1x01', kind: 'script', names: [] }];
    expect(extractMentionTargets('Sango spoke.', scriptCandidates)).toEqual([{ id: 'sango', kind: 'entity' }]);
  });
});

describe('findMentionOccurrences', () => {
  it('reports the exact character range of a match', () => {
    const text = 'Sango spoke of the future.';
    const occurrences = findMentionOccurrences(text, candidates);
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].start).toBe(0);
    expect(occurrences[0].end).toBe(5);
    expect(text.slice(occurrences[0].start, occurrences[0].end)).toBe('Sango');
    expect(occurrences[0].targets).toEqual([{ id: 'sango', kind: 'entity' }]);
  });

  it('does NOT deduplicate repeated occurrences (unlike extractMentionTargets)', () => {
    const occurrences = findMentionOccurrences('Sango, Sango, Sango.', candidates);
    expect(occurrences).toHaveLength(3);
    expect(occurrences.map((o) => o.start)).toEqual([0, 7, 14]);
  });

  it('reports a range that correctly covers a name inside a [[wikilink]]', () => {
    const text = 'He mentioned [[Sango]] in passing.';
    const occurrences = findMentionOccurrences(text, candidates);
    expect(occurrences).toHaveLength(1);
    expect(text.slice(occurrences[0].start, occurrences[0].end)).toBe('Sango');
  });

  it('reports every occurrence in document order across multiple mentions', () => {
    const text = 'Sango and Esu argued on The Ark.';
    const occurrences = findMentionOccurrences(text, candidates);
    expect(occurrences.map((o) => o.targets[0].id)).toEqual(['sango', 'esu', 'the-ark']);
    expect(occurrences.every((o, i) => i === 0 || o.start > occurrences[i - 1].start)).toBe(true);
  });

  it('returns an empty array when nothing matches', () => {
    expect(findMentionOccurrences('No mentions here.', candidates)).toEqual([]);
  });
});
