/**
 * Unit tests for `export/docx.ts` (ADR-0050): the screenplay Word document.
 * The `.docx` is unzipped (with `jszip`, which `docx` itself depends on) so
 * the OOXML can be checked: styles, page setup and paragraph order. How Word
 * finally lays the page out is left to a manual check in Word.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildScreenplay } from 'lorefountain-core/export/screenplay';
import { renderScreenplayDocx } from '../../src/export/docx';

const SAMPLE = [
  'Title: The Long Night',
  'Author: Ada',
  '',
  'INT. ARCHIVE - NIGHT #1#',
  '',
  'Sango climbs down. *Quietly*.',
  '',
  'SANGO',
  '(beat)',
  'I kept every ledger.',
  '~A song',
  '',
  'BRICK',
  'Now.',
  '',
  'STEEL ^',
  'Now.',
  '',
  '[[never printed]]',
  '',
  '===',
  '',
  'CUT TO:',
  '',
].join('\n');

/** The document body and styles XML of a rendered `.docx`. */
async function render(text: string, paper: 'letter' | 'a4' = 'letter', titlePage = true): Promise<{ body: string; styles: string; core: string }> {
  const buffer = await renderScreenplayDocx(buildScreenplay(text), { paper, fallbackTitle: 'fallback', titlePage });
  const zip = await JSZip.loadAsync(buffer);
  const read = async (name: string): Promise<string> => (await zip.file(name)?.async('string')) ?? '';
  return { body: await read('word/document.xml'), styles: await read('word/styles.xml'), core: await read('docProps/core.xml') };
}

/** The style ids of the body's paragraphs, in order. */
function paragraphStyles(body: string): string[] {
  return [...body.matchAll(/<w:pStyle w:val="([^"]+)"\/>/g)].map((match) => match[1]);
}

describe('renderScreenplayDocx', () => {
  it('defines a named style for every screenplay element, in Courier Prime 12 pt', async () => {
    const { styles } = await render(SAMPLE);
    for (const name of ['Scene Heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Lyric', 'Transition', 'Centered']) {
      expect(styles).toContain(`<w:name w:val="${name}"/>`);
    }
    expect(styles).toContain('w:ascii="Courier Prime"');
    expect(styles).toContain('<w:sz w:val="24"/>');
  });

  it('writes the paragraphs in script order with the right styles', async () => {
    const { body } = await render(SAMPLE);
    expect(paragraphStyles(body)).toEqual([
      'TitlePageText', 'TitlePageText', 'TitlePageText', 'TitlePageText',
      'SceneHeading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Lyric', 'Transition',
    ]);
    expect(body).toContain('<w:tab/><w:t xml:space="preserve">1</w:t>');
    expect(body).toContain('<w:i/>');
    expect(body).not.toContain('never printed');
  });

  it('puts dual dialogue in a table and starts a new page after a page break', async () => {
    const { body } = await render(SAMPLE);
    expect(body).toMatch(/<w:tbl>[\s\S]*BRICK[\s\S]*STEEL[\s\S]*<\/w:tbl>/);
    expect(body).toMatch(/<w:pageBreakBefore\/>[\s\S]*CUT TO:/);
  });

  it('sets the paper size and screenplay margins, with page numbers from page 2', async () => {
    const letter = await render(SAMPLE);
    expect(letter.body).toContain('w:w="12240" w:h="15840"');
    expect(letter.body).toMatch(/w:left="2160"/);
    expect(letter.body).toContain('<w:titlePg/>');
    const a4 = await render(SAMPLE, 'a4');
    expect(a4.body).toContain('w:w="11906" w:h="16838"');
  });

  it('records the title and author, falling back to the given title', async () => {
    expect((await render(SAMPLE)).core).toMatch(/<dc:title>The Long Night<\/dc:title>[\s\S]*<dc:creator>Ada<\/dc:creator>|<dc:creator>Ada<\/dc:creator>[\s\S]*<dc:title>The Long Night<\/dc:title>/);
    expect((await render('Rain.\n')).core).toContain('<dc:title>fallback</dc:title>');
  });

  it('leaves the title page out when asked', async () => {
    expect(paragraphStyles((await render(SAMPLE, 'letter', false)).body)[0]).toBe('SceneHeading');
  });
});
