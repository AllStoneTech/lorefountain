/**
 * Keeps the Fountain syntax help page (`resources/help/fountainSyntax.md`)
 * honest: every ```fountain example on it is parsed with the same code the
 * extension uses (`fountain-js`, the shot scanner, the cue and title-page
 * parsers) and checked against what the page says about it.
 *
 * Examples are found by a unique snippet of their text (see {@link example}),
 * so reordering the page doesn't break these tests, but rewording an example
 * does — on purpose, since its description probably needs re-checking too.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractCues } from '../../src/cues/parseCues';
import { matchPrefixLine } from '../../src/fountain/conventions';
import { parseFountain, type FountainToken } from '../../src/fountain/parse';
import { parseScriptTitlePage } from '../../src/model/script';
import { extractShots } from '../../src/shots/parseShots';
import { scanScript } from '../../src/shots/scanScript';
import { parseSceneHeading } from '../../src/shots/sceneHeading';
import { buildShotMap } from '../../src/shots/shotMap';

const HELP_PAGE = path.join(__dirname, '..', '..', 'resources', 'help', 'fountainSyntax.md');
const markdown = fs.readFileSync(HELP_PAGE, 'utf8').replace(/\r\n/g, '\n');

/** Every ```fountain code block on the page, in order, without its fences. */
const examples: string[] = [...markdown.matchAll(/^[ \t]*```fountain\n([\s\S]*?)^[ \t]*```[ \t]*$/gm)].map((m) => m[1]);

/**
 * The one example containing `snippet`.
 *
 * @param snippet - Text that appears in exactly one example.
 * @returns That example's text.
 * @throws If no example, or more than one, contains the snippet.
 */
function example(snippet: string): string {
  const matches = examples.filter((text) => text.includes(snippet));
  if (matches.length !== 1) throw new Error(`Expected one example containing ${JSON.stringify(snippet)}, found ${matches.length}`);
  return matches[0];
}

/** `[type, text]` pairs for an example's content-bearing tokens, for compact assertions. */
function tokensOf(text: string): [string, string][] {
  return parseFountain(text)
    .filter((token: FountainToken) => (token.text !== undefined && token.text !== '') || token.type === 'page_break')
    .map((token: FountainToken) => [token.type, token.text ?? '']);
}

/** Token types in an example, in order. */
function typesOf(text: string): string[] {
  return parseFountain(text).map((token: FountainToken) => token.type);
}

/** Title-page tokens are the only ones carrying `is_title`. */
function hasTitlePage(text: string): boolean {
  return parseFountain(text).some((token: FountainToken) => token.is_title === true);
}

describe('fountainSyntax.md examples', () => {
  it('finds the examples', () => {
    expect(examples.length).toBeGreaterThanOrEqual(30);
  });

  it('never lets a LoreFountain convention line become a character cue or dialogue in plain Fountain', () => {
    for (const text of examples) {
      for (const token of parseFountain(text)) {
        if (token.type !== 'character' && token.type !== 'dialogue') continue;
        for (const line of (token.text ?? '').split('\n')) {
          expect(matchPrefixLine(line), `in example:\n${text}`).toBeUndefined();
        }
      }
    }
  });

  it('reads every convention line as a LoreFountain directive', () => {
    for (const text of examples) {
      const expected = text.split('\n').filter((line) => matchPrefixLine(line) !== undefined).length;
      const directives = scanScript(text).filter((item) => item.kind === 'directive').length;
      expect(directives, `in example:\n${text}`).toBe(expected);
    }
  });

  it('never writes an unforced FADE OUT.-style transition', () => {
    for (const text of examples) {
      for (const line of text.split('\n')) {
        expect(/^(FADE OUT|FADE TO BLACK|CUT TO BLACK)\.$/.test(line.trim()), line).toBe(false);
      }
    }
  });

  it('starts every title page with Title:', () => {
    for (const text of examples.filter(hasTitlePage)) {
      expect(text.startsWith('Title:'), text).toBe(true);
    }
  });

  it('first scene: heading, action, character, parenthetical, dialogue, transition', () => {
    const tokens = tokensOf(example('Forty years, and nobody asked'));
    expect(tokens.map(([type]) => type)).toEqual([
      'title',
      'author',
      'scene_heading',
      'action',
      'character',
      'parenthetical',
      'dialogue',
      'action',
      'transition',
      'scene_heading',
      'action',
    ]);
  });

  it('title page: standard keys and an indented multi-line value', () => {
    const tokens = parseFountain(example('Draft date: 2026-11-05'));
    const title = Object.fromEntries(tokens.filter((t) => t.is_title).map((t) => [t.type, t.text]));
    expect(title).toEqual({
      title: 'The Long Night',
      credit: 'Written by',
      author: 'Ada Okafor',
      source: 'Based on a story by Kemi Adeyemi',
      draft_date: '2026-11-05',
      contact: 'ada@example.com\n555-0100',
    });
    expect(tokens.some((t) => t.type === 'scene_heading')).toBe(true);
  });

  it('scene headings: every prefix form is a heading, and the parts are read', () => {
    const tokens = tokensOf(example('I/E. TRUCK - NIGHT'));
    expect(tokens).toEqual([
      ['scene_heading', 'INT. KITCHEN - NIGHT'],
      ['scene_heading', 'EXT. DOCK - DAWN'],
      ['scene_heading', 'INT./EXT. MOVING CAR - DAY'],
      ['scene_heading', 'I/E. TRUCK - NIGHT'],
    ]);
    expect(parseSceneHeading('INT./EXT. MOVING CAR - DAY')).toEqual({ intExt: 'INT/EXT', timeOfDay: 'DAY', setting: ['MOVING CAR'] });
  });

  it('scene headings: a leading . forces a heading; ... does not', () => {
    expect(tokensOf(example('.FLASHBACK'))[0]).toEqual(['scene_heading', 'FLASHBACK - THE DOCK, 1925']);
    expect(tokensOf('...and then.')).toEqual([['action', '...and then.']]);
  });

  it('scene headings: scene numbers', () => {
    const headings = parseFountain(example('#12A#')).filter((t) => t.type === 'scene_heading');
    expect(headings.map((t) => t.scene_number)).toEqual(['12', '12A']);
  });

  it('action: plain paragraphs', () => {
    expect(typesOf(example('Rain hammers the window.'))).toEqual(['action', 'action']);
  });

  it('action: ! forces action, and without it the line is a character', () => {
    const forced = example('!SCREAMS.');
    expect(tokensOf(forced)).toEqual([['action', 'SCREAMS.\nThe lights die.']]);
    expect(tokensOf(forced.replace('!', ''))).toEqual([
      ['character', 'SCREAMS.'],
      ['dialogue', 'The lights die.'],
    ]);
  });

  it('characters: a cue with dialogue under it', () => {
    expect(tokensOf(example('I told you not to come back'))).toEqual([
      ['character', 'SANGO'],
      ['dialogue', 'I told you not to come back here.'],
    ]);
  });

  it('characters: extensions in any case', () => {
    const cues = tokensOf(example('MOTHER (on the radio)')).filter(([type]) => type === 'character');
    expect(cues.map(([, text]) => text)).toEqual(['SANGO (V.O.)', 'MOTHER (on the radio)', "SANGO (CONT'D)"]);
  });

  it('characters: @ forces a mixed-case name', () => {
    expect(tokensOf(example('@McCLANE'))).toEqual([
      ['character', 'McCLANE'],
      ['dialogue', 'Come out to the coast.'],
    ]);
  });

  it('dialogue: several lines in one speech', () => {
    expect(tokensOf(example('I kept every ledger.\nEvery single one.'))).toEqual([
      ['character', 'SANGO'],
      ['dialogue', 'I kept every ledger.\nEvery single one.'],
    ]);
  });

  it('parentheticals: under the cue and between lines of dialogue', () => {
    expect(tokensOf(example('(quietly)'))).toEqual([
      ['character', 'SANGO'],
      ['parenthetical', '(quietly)'],
      ['dialogue', 'I kept every ledger.'],
      ['parenthetical', '(beat)'],
      ['dialogue', 'Every single one.'],
    ]);
  });

  it('dual dialogue: ^ makes the second speech simultaneous', () => {
    const text = example('STEEL ^');
    expect(typesOf(text)).toContain('dual_dialogue_begin');
    const steel = scanScript(text).find((item) => item.kind === 'character' && item.name === 'STEEL');
    expect(steel).toMatchObject({ simultaneous: true });
  });

  it('lyrics', () => {
    expect(tokensOf(example('~Down by the water'))).toEqual([['lyrics', 'Down by the water\nwhere the ledgers sleep']]);
  });

  it('transitions: lines ending in TO:', () => {
    const transitions = tokensOf(example('SMASH CUT TO:')).filter(([type]) => type === 'transition');
    expect(transitions).toEqual([
      ['transition', 'CUT TO:'],
      ['transition', 'SMASH CUT TO:'],
    ]);
  });

  it('transitions: > forces FADE OUT.', () => {
    expect(tokensOf(example('> FADE OUT.'))).toEqual([
      ['action', 'She turns off the lamp.'],
      ['transition', 'FADE OUT.'],
    ]);
  });

  it('centered text', () => {
    expect(tokensOf(example('>THE END<'))).toEqual([
      ['centered', 'THE END'],
      ['centered', 'ONE YEAR LATER'],
    ]);
  });

  it('emphasis: stays action', () => {
    expect(typesOf(example('***both***'))).toEqual(['action', 'action', 'action']);
  });

  it('page break', () => {
    expect(typesOf(example('==='))).toEqual(['action', 'page_break', 'scene_heading', 'action']);
  });

  it('notes: inline and on their own line', () => {
    expect(tokensOf(example('[[Is it 1925 or 1926?]]'))).toEqual([
      ['action', 'Sango opens the ledger. [[Is it 1925 or 1926?]]'],
      ['note', 'Ask the props team for a real ledger.'],
    ]);
  });

  it('notes: a [[Name]] link sits beside the visible wording', () => {
    expect(tokensOf(example('The old man [[Sango]]'))).toEqual([['action', 'The old man [[Sango]] climbs the ladder.']]);
  });

  it('boneyard: hidden entirely, even across blank lines', () => {
    const tokens = tokensOf(example('by candlelight'));
    expect(tokens).toEqual([
      ['scene_heading', 'INT. KITCHEN - NIGHT'],
      ['action', 'He is home.'],
    ]);
  });

  it('sections and synopses', () => {
    const tokens = parseFountain(example('# Act One'));
    expect(tokens.slice(0, 3).map((t) => [t.type, t.text, t.depth])).toEqual([
      ['section', 'Act One', 1],
      ['section', 'The Archive', 2],
      ['synopsis', 'Sango finds a ledger that should not exist.', undefined],
    ]);
  });

  it('convention lines: re-cueing with (CONT\'D) around a SHOT: line', () => {
    const items = scanScript(example("SANGO (CONT'D)\nEvery single one."));
    expect(items.map((item) => item.kind)).toEqual(['character', 'dialogue', 'directive', 'character', 'dialogue']);
  });

  it('convention lines: a lowercase word or a blank line keeps all-caps shots as action', () => {
    const text = example("POSE: Sango's hands, shaking");
    expect(typesOf(text).every((type) => type === 'action')).toBe(true);
    expect(extractShots(text).map((shot) => [shot.description, shot.pose])).toEqual([
      ['WIDE on the dock', 'Sango kneels by the water'],
      ['CLOSE-UP', "Sango's hands, shaking"],
    ]);
  });

  it('convention lines: the counter-example really is a character cue in plain Fountain', () => {
    expect(tokensOf('SHOT: CLOSE-UP\nPOSE: SANGO KNEELS')).toEqual([
      ['character', 'SHOT: CLOSE-UP'],
      ['dialogue', 'POSE: SANGO KNEELS'],
    ]);
  });

  it('shots: fields, numbering and durations', () => {
    expect(extractShots(example('SHOT: WIDE, establishing\nLIGHT: Cold blue'))).toEqual([
      {
        sceneNumber: 1,
        sceneHeadingText: 'INT. ARCHIVE - NIGHT',
        shotNumber: 1,
        description: 'WIDE, establishing',
        light: 'Cold blue moonlight through high windows',
        durationText: '4s',
        durationSeconds: 4,
      },
      {
        sceneNumber: 1,
        sceneHeadingText: 'INT. ARCHIVE - NIGHT',
        shotNumber: 2,
        description: 'CLOSE-UP on Sango',
        pose: 'Sango grips the ladder, jaw tight',
        light: 'Warm lamplight from below',
        durationText: 'about 3 seconds',
        durationSeconds: 3,
      },
    ]);
  });

  it('pauses: a speaker pause, then scene pauses with and without a length', () => {
    const { shots } = buildShotMap(example('PAUSE: 2s'), []);
    const spoken = shots.flatMap((shot) => shot.spoken);
    // Subset match: only what the page claims (kinds, order, lengths), not every sidecar field.
    expect(spoken).toMatchObject([
      { speaker: 'SANGO', extensions: [], text: 'I kept every ledger.' },
      { pause: 'speaker', speaker: 'SANGO' },
      { speaker: 'SANGO', extensions: [], text: 'Every single one.' },
      { pause: 'scene', durationText: '2s', durationSeconds: 2 },
      { pause: 'scene' },
    ]);
  });

  it('pauses: a plain-action Beat. gets a note', () => {
    const { issues } = buildShotMap('INT. ARCHIVE - NIGHT\n\nBeat.\n', []);
    expect(issues.map((issue) => issue.code)).toEqual(['bare-pause-line']);
  });

  it('sound cues: types, MUSIC role and timing', () => {
    const cues = extractCues(example('MUSIC: BED IN - low, patient'));
    expect(cues.map(({ type, role, timing, description }) => ({ type, role, timing, description }))).toEqual([
      { type: 'amb', role: undefined, timing: undefined, description: 'rain on a tin roof, distant thunder' },
      { type: 'sfx', role: undefined, timing: undefined, description: 'a ladder creaks' },
      { type: 'music', role: 'BED', timing: 'IN', description: 'low, patient, unresolved' },
      { type: 'music', role: 'STING', timing: undefined, description: 'the ledger is blank' },
      { type: 'music', role: undefined, timing: 'OUT', description: '' },
    ]);
  });

  it('sound cues: the hyphen after MUSIC keywords is optional', () => {
    const [withDash, withoutDash] = extractCues('MUSIC: STING - the reveal\nMUSIC: STING the reveal');
    expect(withDash.description).toBe(withoutDash.description);
  });

  it('boneyard: cues inside one are ignored, as the page says', () => {
    expect(extractCues('/*\nSFX: thunder\n*/\n')).toEqual([]);
  });

  it('boneyard: an unclosed /* hides nothing, as the page says', () => {
    expect(extractCues('/*\nSFX: thunder\n')).toHaveLength(1);
  });

  it('tags: on SHOT: and every cue type, before a MUSIC role', () => {
    const text = example('[door-slam]');
    expect(extractShots(text).map((shot) => [shot.tag, shot.description])).toEqual([['1x03-archive-wide', 'WIDE, establishing']]);
    expect(extractCues(text).map(({ tag, role, timing, description }) => ({ tag, role, timing, description }))).toEqual([
      { tag: 'door-slam', role: undefined, timing: undefined, description: 'the archive door slams' },
      { tag: 'archive-theme', role: 'BED', timing: 'IN', description: 'low strings' },
      { tag: 'rain-tin-roof', role: undefined, timing: undefined, description: 'steady rain' },
    ]);
  });

  it('tags: a non-slug [Door Slam] is part of the description', () => {
    expect(extractCues('SFX: [Door Slam] a door slams')[0]).toMatchObject({ tag: undefined, description: '[Door Slam] a door slams' });
  });

  it('episode keys: Order and Production Code', () => {
    const { script, warnings } = parseScriptTitlePage(example('Production Code: 1x03'), { id: 'x', filePath: 'x.fountain' });
    expect(script.frontmatter).toEqual({ title: 'The Long Night', order: 3, productionCode: '1x03' });
    expect(warnings).toEqual([]);
    expect(parseScriptTitlePage('Title: X\nProduction Code: 12x105\n', { id: 'x', filePath: 'x.fountain' }).script.frontmatter.productionCode).toBe('12x105');
  });
});
