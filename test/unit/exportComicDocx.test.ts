/**
 * Unit tests for `export/comicDocx.ts` (ADR-0046): the comic script Word
 * document. The `.docx` is unzipped with `jszip` so the OOXML can be checked:
 * styles, page breaks, lettering tabs, language and page setup. How Word
 * finally lays the page out is left to a manual check in Word.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildComicScript, comicExportContent } from 'lorefountain-core/export/comic';
import { filterScript } from 'lorefountain-core/export/filter';
import { presetContent } from 'lorefountain-core/export/options';
import { buildScreenplay } from 'lorefountain-core/export/screenplay';
import { renderComicDocx } from '../../src/export/comicDocx';
import { renderScreenplayDocx } from '../../src/export/docx';

const SAMPLE = [
  'Title: Harbour',
  'Author: Ada',
  '',
  'PAGE: 1 (SPLASH)',
  '',
  'PANEL: The harbour at dawn.',
  'CAPTION: Lagos, 1897.',
  '',
  'ADÉ',
  '(quietly)',
  "They're late.",
  'Again.',
  '',
  'PAGE: 2',
  '',
  'PANEL: The door.',
  '',
  'SFX: KNOCK',
  '',
].join('\n');

/** The document body, styles and core properties of a rendered comic `.docx`. */
async function render(text: string, options: { paper?: 'letter' | 'a4'; titlePage?: boolean; lang?: string } = {}): Promise<{ body: string; styles: string; core: string }> {
  const script = buildComicScript(filterScript(text, comicExportContent(presetContent('pure'))).text);
  const buffer = await renderComicDocx(script, { paper: options.paper ?? 'letter', titlePage: options.titlePage ?? true, fallbackTitle: 'fallback', ...(options.lang ? { lang: options.lang } : {}) });
  const zip = await JSZip.loadAsync(buffer);
  const read = async (name: string): Promise<string> => (await zip.file(name)?.async('string')) ?? '';
  return { body: await read('word/document.xml'), styles: await read('word/styles.xml'), core: await read('docProps/core.xml') };
}

/** The style ids of the body's paragraphs, in order. */
function paragraphStyles(body: string): string[] {
  return [...body.matchAll(/<w:pStyle w:val="([^"]+)"\/>/g)].map((match) => match[1]);
}

describe('renderComicDocx', () => {
  it('defines a named style for every comic element', async () => {
    const { styles } = await render(SAMPLE);
    for (const name of ['Comic Page', 'Panel', 'Panel Description', 'Lettering', 'Title Page']) expect(styles).toContain(`<w:name w:val="${name}"/>`);
    expect(styles).toContain('w:ascii="Courier Prime"');
  });

  it('writes pages, panels, descriptions and lettering in order', async () => {
    const { body } = await render(SAMPLE, { titlePage: false });
    expect(paragraphStyles(body)).toEqual(['ComicPage', 'ComicPanel', 'PanelDescription', 'Lettering', 'Lettering', 'ComicPage', 'ComicPanel', 'PanelDescription', 'Lettering']);
    expect(body).toContain('PAGE ONE');
    expect(body).toContain('(SPLASH, 1 panel)');
    expect(body).toContain('PAGE TWO');
  });

  it('starts each comic page after the first on a new page', async () => {
    const { body } = await render(SAMPLE, { titlePage: false });
    expect((body.match(/<w:pageBreakBefore\/>/g) ?? []).length).toBe(1);
  });

  it('numbers lettering per page and hangs it from tab stops', async () => {
    const { body } = await render(SAMPLE, { titlePage: false });
    expect(body).toMatch(/<w:t xml:space="preserve">1\.<\/w:t><w:tab\/><w:t xml:space="preserve">CAPTION:<\/w:t><w:tab\/>/);
    expect(body).toMatch(/<w:t xml:space="preserve">1\.<\/w:t><w:tab\/><w:t xml:space="preserve">SFX:<\/w:t><w:tab\/>/);
    expect(body).toMatch(/<w:tab w:val="left" w:pos="1152"\/>/);
    expect(body).toMatch(/<w:tab w:val="left" w:pos="3456"\/>/);
    expect(body).not.toContain('\t');
    expect(body).toMatch(/\(quietly\) /);
  });

  it('sets 1 inch margins on the chosen paper, with page numbers from page 2', async () => {
    const { body } = await render(SAMPLE, { paper: 'a4' });
    expect(body).toContain('w:w="11906"');
    expect(body).toMatch(/w:left="1440"/);
    expect(body).toContain('<w:titlePg/>');
  });

  it('declares the export language and records the title and author', async () => {
    const { styles, core } = await render(SAMPLE, { lang: 'yo' });
    expect(styles).toContain('<w:lang w:val="yo"/>');
    expect(core).toContain('Harbour');
    expect(core).toContain('Ada');
    expect((await render('PAGE: 1\n\nPANEL: x\n')).core).toContain('fallback');
  });
});

describe('renderScreenplayDocx: language (ADR-0046)', () => {
  it('declares the export language, English by default', async () => {
    const read = async (lang?: string): Promise<string> => {
      const buffer = await renderScreenplayDocx(buildScreenplay('INT. A - DAY\n\nRain.\n'), { paper: 'letter', fallbackTitle: 'x', ...(lang ? { lang } : {}) });
      return (await (await JSZip.loadAsync(buffer)).file('word/styles.xml')?.async('string')) ?? '';
    };
    expect(await read()).toContain('<w:lang w:val="en"/>');
    expect(await read('en-GB')).toContain('<w:lang w:val="en-GB"/>');
  });

  it('puts the scene number after a real Word tab, not a tab character', async () => {
    const buffer = await renderScreenplayDocx(buildScreenplay('INT. A - DAY #7#\n\nRain.\n'), { paper: 'letter', fallbackTitle: 'x' });
    const body = (await (await JSZip.loadAsync(buffer)).file('word/document.xml')?.async('string')) ?? '';
    expect(body).toMatch(/<w:tab\/><w:t xml:space="preserve">7<\/w:t>/);
    expect(body).not.toContain('\t');
  });
});
