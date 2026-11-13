/**
 * Unit tests for `export/pdf.ts` (ADR-0045): the PDF renderer over Core's
 * layout, with the bundled fonts. Set `LOREFOUNTAIN_PDF_SAMPLE` to a file path
 * to also save the sample PDF for a visual check.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { layoutScreenplay } from 'lorefountain-core/export/layout';
import { buildScreenplay } from 'lorefountain-core/export/screenplay';
import { loadPdfFonts, PdfRenderError, renderPdf } from '../../src/export/pdf';

const FONTS_DIR = path.join(__dirname, '..', '..', 'resources', 'fonts');

const SAMPLE = [
  'Title: The Long Night',
  'Author: Ada',
  'Draft date: 13 November 2026',
  '',
  'INT. ỌRUN ARCHIVE - NIGHT #1#',
  '',
  'Ọ̀rúnmìlà waits. *Italic*, **bold**, _underline_ and ***both***.',
  '',
  'ṢÀNGÓ (V.O.)',
  '(quietly)',
  'Ẹ ṣé. I kept every ledger.',
  '',
  'CUT TO:',
  '',
].join('\n');

/** The number of pages in a PDF, from its page objects. */
function pageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
}

describe('renderPdf', () => {
  it('renders a PDF with every page, embedding Courier Prime and the Noto fallback only where needed', async () => {
    const fonts = await loadPdfFonts(FONTS_DIR);
    const layout = layoutScreenplay(buildScreenplay(SAMPLE), { paper: 'letter' });
    const pdf = await renderPdf(layout, fonts, { title: 'The Long Night', author: 'Ada' });

    expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.7');
    expect(pageCount(pdf)).toBe(layout.pages.length);
    const raw = pdf.toString('latin1');
    expect(raw).toMatch(/CourierPrime/);
    expect(raw).toMatch(/NotoSansMono/);
    expect(raw).not.toMatch(/Helvetica/);

    const sample = process.env.LOREFOUNTAIN_PDF_SAMPLE;
    if (sample) fs.writeFileSync(sample, pdf);
  });

  it('does not embed the fallback font when every character is in Courier Prime', async () => {
    const fonts = await loadPdfFonts(FONTS_DIR);
    const pdf = await renderPdf(layoutScreenplay(buildScreenplay('INT. A - DAY\n\nRain.\n'), { paper: 'a4' }), fonts, { title: 'x' });
    expect(pdf.toString('latin1')).not.toMatch(/NotoSansMono/);
  });

  it('renders one blank page for an empty script', async () => {
    const fonts = await loadPdfFonts(FONTS_DIR);
    const pdf = await renderPdf(layoutScreenplay(buildScreenplay(''), { paper: 'letter' }), fonts, { title: 'empty' });
    expect(pageCount(pdf)).toBe(1);
  });

  it('reports missing fonts as a PdfRenderError', async () => {
    await expect(loadPdfFonts(path.join(FONTS_DIR, 'nope'))).rejects.toBeInstanceOf(PdfRenderError);
  });
});
