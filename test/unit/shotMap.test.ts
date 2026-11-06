/**
 * Unit tests for `shots/shotMap.ts`: the per-shot data written to
 * `.shots.json`, and the per-script issues found while building it.
 */

import { describe, expect, it } from 'vitest';
import { buildShotMap, type ShotMapEntity } from '../../src/shots/shotMap';

const ENTITIES: ShotMapEntity[] = [
  { id: 'mara', type: 'character', names: ['Mara'] },
  { id: 'theo', type: 'character', names: ['Theo'] },
  { id: 'elias', type: 'character', names: ['Elias'] },
  { id: 'the-key', type: 'object', names: ['the Key'] },
  { id: 'hollow-house', type: 'location', names: ['Hollow House'] },
  { id: 'the-archive', type: 'concept', names: ['The Archive'] },
];

/** Lines are numbered in the comments below (0-based). */
const EXAMPLE = [
  'INT. HOLLOW HOUSE - BASEMENT - NIGHT', // 0
  '', // 1
  'AMB: [basement-drip] water dripping', // 2
  '', // 3
  'The door groans open above.', // 4
  '', // 5
  'SHOT: [1x01-basement-wide] WIDE, low angle', // 6
  'POSE: Mara on the top step', // 7
  'LIGHT: a single bare bulb', // 8
  'DURATION: 5s', // 9
  '', // 10
  'Mara comes down slowly.', // 11
  '', // 12
  'MARA', // 13
  '(whispering)', // 14
  'I found it.', // 15
  '(beat)', // 16
  'It was down here the whole time.', // 17
  '', // 18
  'SHOT: [1x01-key-insert] INSERT, the Key on a workbench', // 19
  '', // 20
  'SFX: [key-hum] a low hum from the Key', // 21
  '', // 22
  'PAUSE: 2s', // 23
  '', // 24
  'THEO (V.O.)', // 25
  "Don't touch it. Not after what happened to Elias.", // 26
  '', // 27
  'EXT. HOLLOW HOUSE - NIGHT', // 28
  '', // 29
  'SHOT: [hollow-house-exterior] WIDE, the house dark', // 30
  '', // 31
  'MUSIC: [main-theme] STING - cut hard', // 32
  '',
].join('\n');

describe('buildShotMap', () => {
  const result = buildShotMap(EXAMPLE, ENTITIES);
  const [shot0, shot1, shot2, scene2shot1] = result.shots;

  it('reports explicit shots and keeps an implicit shot 0 for content before the first SHOT:', () => {
    expect(result.hasExplicitShots).toBe(true);
    expect(result.shots.map((shot) => [shot.scene, shot.shot])).toEqual([
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
    expect(shot0.tag).toBeUndefined();
    expect(shot0.description).toBeUndefined();
    expect(shot0.lines).toEqual({ start: 0, end: 5 });
  });

  it('carries tags without putting them in the description, plus the existing shot fields', () => {
    expect(shot1).toMatchObject({
      tag: '1x01-basement-wide',
      description: 'WIDE, low angle',
      pose: 'Mara on the top step',
      light: 'a single bare bulb',
      durationText: '5s',
      durationSeconds: 5,
    });
  });

  it('computes line ranges up to the next shot, the next heading, and the end of the file', () => {
    expect(shot1.lines).toEqual({ start: 6, end: 18 });
    expect(shot2.lines).toEqual({ start: 19, end: 27 });
    expect(scene2shot1.lines).toEqual({ start: 30, end: 32 });
  });

  it('breaks the scene heading into parts and resolves only whole location names', () => {
    expect(shot1).toMatchObject({
      sceneHeading: 'INT. HOLLOW HOUSE - BASEMENT - NIGHT',
      intExt: 'INT',
      timeOfDay: 'NIGHT',
      setting: ['HOLLOW HOUSE', 'BASEMENT'],
      locations: ['hollow-house'],
    });
  });

  it('records dialogue, directions, speaker pauses and scene pauses in order, each with its line', () => {
    expect(shot1.spoken).toEqual([
      { direction: '(whispering)', speaker: 'MARA', speakerEntity: 'mara', line: 14 },
      { speaker: 'MARA', speakerEntity: 'mara', extensions: [], text: 'I found it.', line: 15 },
      { pause: 'speaker', direction: '(beat)', speaker: 'MARA', speakerEntity: 'mara', line: 16 },
      { speaker: 'MARA', speakerEntity: 'mara', extensions: [], text: 'It was down here the whole time.', line: 17 },
    ]);
    expect(shot2.spoken).toEqual([
      { pause: 'scene', durationText: '2s', durationSeconds: 2, line: 23 },
      {
        speaker: 'THEO',
        speakerEntity: 'theo',
        extensions: ['V.O.'],
        text: "Don't touch it. Not after what happened to Elias.",
        line: 26,
      },
    ]);
  });

  it('records each action block with its first line', () => {
    expect(shot0.action).toEqual([{ text: 'The door groans open above.', line: 4 }]);
    expect(shot1.action).toEqual([{ text: 'Mara comes down slowly.', line: 11 }]);
    expect(shot2.action).toEqual([]);
  });

  it('takes entities from description, pose, action and speakers, but never dialogue or cue text', () => {
    expect(shot1.entities).toEqual(['mara']);
    // "the Key" is in the description; Elias appears only in dialogue.
    expect(shot2.entities).toEqual(['the-key', 'theo']);
    expect(shot2.entities).not.toContain('elias');
  });

  it('does not add heading locations to entities unless the shot text names them', () => {
    expect(scene2shot1.locations).toEqual(['hollow-house']);
    expect(scene2shot1.entities).toEqual([]);
  });

  it('points at cues that start inside each shot', () => {
    expect(shot0.cues).toEqual([2]);
    expect(shot1.cues).toEqual([]);
    expect(shot2.cues).toEqual([21]);
    expect(scene2shot1.cues).toEqual([32]);
  });

  it('writes entry keys in the documented order', () => {
    expect(Object.keys(shot1)).toEqual([
      'scene',
      'shot',
      'tag',
      'sceneHeading',
      'intExt',
      'timeOfDay',
      'setting',
      'locations',
      'description',
      'pose',
      'light',
      'durationText',
      'durationSeconds',
      'lines',
      'spoken',
      'action',
      'onScreen',
      'entities',
      'cues',
    ]);
  });
});

describe('buildShotMap edge cases', () => {
  it('omits shot 0 when only blank lines precede the first SHOT:', () => {
    const { shots } = buildShotMap('INT. A - DAY\n\n\nSHOT: WIDE\n', []);
    expect(shots.map((shot) => shot.shot)).toEqual([1]);
  });

  it('treats a scene with no SHOT: at all as one shot 0', () => {
    const { shots, hasExplicitShots } = buildShotMap('INT. A - DAY\n\nMARA\nHello.\n\nINT. B - DAY\n\nSHOT: WIDE\n', ENTITIES);
    expect(hasExplicitShots).toBe(true);
    // The second heading is on line 5, so shot 0 ends on line 4.
    expect(shots[0]).toMatchObject({ scene: 1, shot: 0, lines: { start: 0, end: 4 } });
    expect(shots[0].spoken).toEqual([{ speaker: 'MARA', speakerEntity: 'mara', extensions: [], text: 'Hello.', line: 3 }]);
  });

  it('puts content before the first scene heading in scene 0', () => {
    const { shots } = buildShotMap('Cold open in darkness.\n\nINT. A - DAY\n\nSHOT: WIDE\n', []);
    expect(shots[0]).toEqual({
      scene: 0,
      shot: 0,
      setting: [],
      locations: [],
      lines: { start: 0, end: 1 },
      spoken: [],
      action: [{ text: 'Cold open in darkness.', line: 0 }],
      onScreen: [],
      entities: [],
      cues: [],
    });
  });

  it('reports no explicit shots for a script with none', () => {
    expect(buildShotMap('INT. A - DAY\n\nMara waits.\n', ENTITIES).hasExplicitShots).toBe(false);
  });

  it('accepts a tag-only shot with an empty description', () => {
    const { shots } = buildShotMap('INT. A - DAY\n\nSHOT: [archive-ident]\n', []);
    expect(shots[0]).toMatchObject({ tag: 'archive-ident', description: '' });
  });

  it('handles a tagged SHOT: line Fountain misreads as a character cue', () => {
    const { shots } = buildShotMap('INT. A - DAY\n\nSHOT: [cold-open] WIDE\nPOSE: MARA STANDS\n', ENTITIES);
    expect(shots[0]).toMatchObject({ tag: 'cold-open', description: 'WIDE', pose: 'MARA STANDS', spoken: [] });
    expect(shots[0].entities).toEqual(['mara']);
  });

  it('marks overlapping dual dialogue as simultaneous', () => {
    const { shots } = buildShotMap("INT. A - DAY\n\nSHOT: TWO-SHOT\n\nMARA\nDon't—\n\nTHEO ^\nWait—\n", ENTITIES);
    expect(shots[0].spoken).toEqual([
      { speaker: 'MARA', speakerEntity: 'mara', extensions: [], text: "Don't—", line: 5 },
      { speaker: 'THEO', speakerEntity: 'theo', extensions: [], text: 'Wait—', simultaneous: true, line: 8 },
    ]);
  });

  it('keeps multiple cue-line extensions, drops CONT\'D, and keeps a parenthetical as a direction, not an extension', () => {
    const script = "INT. A - DAY\n\nSHOT: WIDE\n\nTHE ARCHIVE (V.O.) (FILTERED) (CONT'D)\n(V.O., reading)\nYou found us.\n";
    const { shots } = buildShotMap(script, ENTITIES);
    expect(shots[0].spoken).toEqual([
      { direction: '(V.O., reading)', speaker: 'THE ARCHIVE', speakerEntity: 'the-archive', line: 5 },
      { speaker: 'THE ARCHIVE', speakerEntity: 'the-archive', extensions: ['V.O.', 'FILTERED'], text: 'You found us.', line: 6 },
    ]);
  });

  it('leaves speakerEntity off when a speaker matches no entity', () => {
    const { shots } = buildShotMap('INT. A - DAY\n\nSHOT: WIDE\n\nSTRANGER\nHello.\n', ENTITIES);
    expect(shots[0].spoken).toEqual([{ speaker: 'STRANGER', extensions: [], text: 'Hello.', line: 5 }]);
  });

  it('records a bare PAUSE: and a non-numeric one without guessing seconds', () => {
    const { shots } = buildShotMap('INT. A - DAY\n\nSHOT: WIDE\n\nPAUSE:\n\nPAUSE: long\n', []);
    expect(shots[0].spoken).toEqual([
      { pause: 'scene', line: 4 },
      { pause: 'scene', durationText: 'long', line: 6 },
    ]);
  });

  it('keeps a pause parenthetical\'s wording exactly as written', () => {
    const { shots } = buildShotMap('INT. A - DAY\n\nSHOT: WIDE\n\nMARA\n(Long  Beat)\nOkay.\n', ENTITIES);
    expect(shots[0].spoken[0]).toEqual({ pause: 'speaker', direction: '(Long  Beat)', speaker: 'MARA', speakerEntity: 'mara', line: 5 });
  });

  it('records lyrics one entry per line, inside and outside dialogue', () => {
    // Speech before the lyric: fountain-js 1.2.4 throws on a lyric directly under a character cue.
    const script = 'INT. A - DAY\n\nSHOT: WIDE\n\nMARA\nListen.\n~Sing a song\n~of sixpence\n\n~A pocket full of rye\n';
    const { shots } = buildShotMap(script, ENTITIES);
    expect(shots[0].spoken).toEqual([
      { speaker: 'MARA', speakerEntity: 'mara', extensions: [], text: 'Listen.', line: 5 },
      { lyric: 'Sing a song', line: 6 },
      { lyric: 'of sixpence', line: 7 },
      { lyric: 'A pocket full of rye', line: 9 },
    ]);
  });

  it('groups action lines into blocks, splitting at blank lines and prefix lines', () => {
    const script = 'INT. A - DAY\n\nSHOT: WIDE\n\nRain hammers the glass.\nMara waits.\n\nThe phone rings.\nSFX: [ring] phone\nShe ignores it.\n';
    const { shots } = buildShotMap(script, ENTITIES);
    expect(shots[0].action).toEqual([
      { text: 'Rain hammers the glass.\nMara waits.', line: 4 },
      { text: 'The phone rings.', line: 7 },
      { text: 'She ignores it.', line: 9 },
    ]);
  });

  it('records centered text as on-screen text', () => {
    const { shots } = buildShotMap('INT. A - DAY\n\nSHOT: [end-card] BLACK\n\n> THE END <\n', []);
    expect(shots[0].onScreen).toEqual([{ kind: 'centered', text: 'THE END', line: 4 }]);
    expect(shots[0].action).toEqual([]);
  });

  it('records the last transition in a shot as Fountain reads it, without the > marker', () => {
    const script = 'INT. A - DAY\n\nSHOT: WIDE\n\nMara leaves.\n\nCUT TO:\n\n> DISSOLVE TO WHITE.\n\nINT. B - DAY\n\nSHOT: CLOSE\n';
    const { shots } = buildShotMap(script, ENTITIES);
    expect(shots[0].transition).toBe('DISSOLVE TO WHITE.');
    expect(shots[1].transition).toBeUndefined();
    expect(Object.keys(shots[0]).slice(-4)).toEqual(['onScreen', 'transition', 'entities', 'cues']);
  });

  it('recognizes every pause parenthetical, case-insensitively, and nothing else', () => {
    const lines = ['(beat)', '(A Beat)', '(long beat)', '(pause)', '(a pause)', '(long  pause)', '(silence)', '(quieter)'];
    const script = `INT. A - DAY\n\nSHOT: WIDE\n\nMARA\n${lines.map((line) => `${line}\nOkay.`).join('\n')}\n`;
    const { shots } = buildShotMap(script, ENTITIES);
    expect(shots[0].spoken.filter((entry) => 'pause' in entry)).toHaveLength(7);
  });
});

describe('buildShotMap issues', () => {
  it('warns on an orphaned parenthetical and leaves the lines as action, out of spoken', () => {
    const script = 'INT. A - DAY\n\nSHOT: WIDE\n\nMARA\nYou found us.\n\n(beat)\nYou are ready.\n';
    const { shots, issues } = buildShotMap(script, ENTITIES);
    expect(issues).toEqual([expect.objectContaining({ code: 'orphaned-parenthetical', severity: 'warning', line: 7 })]);
    expect(shots[0].spoken).toEqual([{ speaker: 'MARA', speakerEntity: 'mara', extensions: [], text: 'You found us.', line: 5 }]);
    expect(shots[0].action).toEqual([{ text: '(beat)\nYou are ready.', line: 7 }]);
  });

  it('notes unforced transitions: action that needs > and fountain-js-only transitions, never forced or TO: ones', () => {
    const script = [
      'FADE IN:', // 0
      '', // 1
      'INT. A - DAY', // 2
      '', // 3
      'SHOT: WIDE', // 4
      '', // 5
      'CUT TO BLACK.', // 6
      '', // 7
      '> FADE OUT.', // 8
      '', // 9
      'CUT TO:', // 10
      '', // 11
      'Fade in on a lighthouse:', // 12 (not uppercase)
      '', // 13
      'FADE IN:', // 14 (part of a two-line block, so > wouldn't force it)
      'The sea.', // 15
      '',
    ].join('\n');
    const { issues } = buildShotMap(script, []);
    expect(issues.map((issue) => [issue.code, issue.severity, issue.line])).toEqual([
      ['unforced-transition', 'info', 0],
      ['unforced-transition', 'info', 6],
    ]);
    expect(issues[0].message).toContain('reads this line as action');
    expect(issues[1].message).toContain('other Fountain apps read it as action');
  });

  it('notes bare pause lines but treats "Mara pauses" as ordinary action', () => {
    const script = 'INT. A - DAY\n\nSHOT: WIDE\n\nBeat.\n\nA long silence.\n\nMara pauses at the door.\n';
    const { shots, issues } = buildShotMap(script, ENTITIES);
    expect(issues.map((issue) => [issue.code, issue.severity, issue.line])).toEqual([
      ['bare-pause-line', 'info', 4],
      ['bare-pause-line', 'info', 6],
    ]);
    expect(shots[0].spoken).toEqual([]);
    expect(shots[0].entities).toEqual(['mara']);
  });

  it('leaves an ambiguous location segment unresolved and notes it', () => {
    const entities: ShotMapEntity[] = [
      { id: 'house-basement', type: 'location', names: ['Basement'] },
      { id: 'station-basement', type: 'location', names: ['basement'] },
      { id: 'hollow-house', type: 'location', names: ['Hollow House'] },
    ];
    const { shots, issues } = buildShotMap('INT. HOLLOW HOUSE - BASEMENT - NIGHT\n\nSHOT: WIDE\n', entities);
    expect(shots[0].locations).toEqual(['hollow-house']);
    expect(issues).toEqual([expect.objectContaining({ code: 'ambiguous-location', severity: 'info', line: 0 })]);
    expect(issues[0].message).toContain('house-basement, station-basement');
  });

  it('resolves heading segments only against location entities, never by substring', () => {
    // "LUCIEN'S BASEMENT" must not resolve to the character Lucien, and a
    // non-location entity named like a segment must not become a location.
    const entities: ShotMapEntity[] = [
      { id: 'lucien', type: 'character', names: ['Lucien'] },
      { id: 'the-archive', type: 'concept', names: ['The Archive'] },
    ];
    const { shots, issues } = buildShotMap("INT. THE ARCHIVE — LUCIEN'S BASEMENT — NIGHT\n\nSHOT: WIDE\n", entities);
    expect(shots[0].locations).toEqual([]);
    expect(issues).toEqual([]);
  });
});
