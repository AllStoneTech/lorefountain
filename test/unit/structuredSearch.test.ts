import { describe, it, expect } from 'vitest';
import { extractScenePresence, findCoPresenceScenes, findMentionLines } from '../../src/search/structuredSearch';
import type { MentionCandidate } from '../../src/index/mentions';

const candidates: MentionCandidate[] = [
  { id: 'sango', kind: 'entity', names: ['Sango'] },
  { id: 'esu', kind: 'entity', names: ['Esu'] },
  { id: 'reactor-core', kind: 'entity', names: ['reactor core'] },
];

describe('extractScenePresence', () => {
  it('splits a script into scenes and reports who is mentioned in each', () => {
    const text = [
      'INT. THE ARK - BRIDGE - NIGHT',
      '',
      'SANGO',
      'Esu, where are you taking us?',
      '',
      'EXT. RIVER NIGER - DAWN',
      '',
      'SANGO',
      'Alone at last.',
    ].join('\n');

    const scenes = extractScenePresence('/scripts/1x01.fountain', text, candidates);

    expect(scenes).toHaveLength(2);
    expect(scenes[0].sceneHeading).toBe('INT. THE ARK - BRIDGE - NIGHT');
    expect([...scenes[0].entityIds].sort()).toEqual(['esu', 'sango']);
    expect(scenes[1].sceneHeading).toBe('EXT. RIVER NIGER - DAWN');
    expect([...scenes[1].entityIds].sort()).toEqual(['sango']);
  });

  it('treats a script with no scene headings as one scene', () => {
    const text = 'SANGO\nEsu, wait.';
    const scenes = extractScenePresence('/scripts/fragment.fountain', text, candidates);
    expect(scenes).toHaveLength(1);
    expect(scenes[0].sceneHeading).toBe('(no scene heading)');
    expect([...scenes[0].entityIds].sort()).toEqual(['esu', 'sango']);
  });
});

describe('findCoPresenceScenes', () => {
  it('finds only the scenes where both entities are mentioned', () => {
    const scenes = [
      { scriptPath: 'a', sceneIndex: 0, sceneHeading: 'Scene A', entityIds: new Set(['sango', 'esu']) },
      { scriptPath: 'a', sceneIndex: 1, sceneHeading: 'Scene B', entityIds: new Set(['sango']) },
      { scriptPath: 'b', sceneIndex: 0, sceneHeading: 'Scene C', entityIds: new Set(['esu', 'sango']) },
    ];

    const matches = findCoPresenceScenes(scenes, 'sango', 'esu');

    expect(matches.map((s) => s.sceneHeading)).toEqual(['Scene A', 'Scene C']);
  });

  it('returns an empty array when the two never share a scene', () => {
    const scenes = [
      { scriptPath: 'a', sceneIndex: 0, sceneHeading: 'Scene A', entityIds: new Set(['sango']) },
      { scriptPath: 'a', sceneIndex: 1, sceneHeading: 'Scene B', entityIds: new Set(['esu']) },
    ];
    expect(findCoPresenceScenes(scenes, 'sango', 'esu')).toEqual([]);
  });
});

describe('findMentionLines', () => {
  it('finds every line mentioning the target, deduplicated per line', () => {
    const text = [
      'SFX: the reactor core groans',
      '',
      'SANGO',
      'The reactor core is failing.',
      '',
      'ESU',
      'Never mind the reactor core, run!',
    ].join('\n');

    const lines = findMentionLines('/scripts/1x01.fountain', text, candidates, 'reactor-core');

    expect(lines).toEqual([
      { scriptPath: '/scripts/1x01.fountain', line: 0, text: 'SFX: the reactor core groans' },
      { scriptPath: '/scripts/1x01.fountain', line: 3, text: 'The reactor core is failing.' },
      { scriptPath: '/scripts/1x01.fountain', line: 6, text: 'Never mind the reactor core, run!' },
    ]);
  });

  it('returns an empty array when the target is never mentioned', () => {
    const text = 'SANGO\nEsu, wait.';
    expect(findMentionLines('/scripts/1x01.fountain', text, candidates, 'reactor-core')).toEqual([]);
  });
});
