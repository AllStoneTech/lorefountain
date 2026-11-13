/**
 * The `.pdf` export renderer (ADR-0045): draws Core's screenplay layout
 * (`lorefountain-core/export/layout`, Core ADR-0003) with `pdfkit`, in
 * Courier Prime, falling back to Noto Sans Mono for any character Courier
 * Prime lacks (Yoruba's ẹ, ọ, ṣ and combining tone marks, for example).
 *
 * Exports {@link renderPdf}, {@link PdfFonts}, {@link loadPdfFonts} and
 * {@link PdfRenderError}.
 *
 * Gotchas:
 * - Both fonts advance 0.6 em, so every character takes one 7.2 pt cell at
 *   12 pt and the grid Core laid out is exact. Each run is still drawn at its
 *   computed cell, so a font's tiny rounding never accumulates.
 * - Text is split into grapheme clusters, and a cluster is drawn in Courier
 *   Prime only if Courier Prime has every code point in it, so a base letter
 *   and its combining marks always come from the same font.
 * - Noto Sans Mono has no italic here; italic fallback characters print upright.
 * - `pdfkit` is told to load no default font, so it never reads its built-in
 *   Helvetica metrics (files the bundle doesn't ship).
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Font } from 'fontkit';
// `import = require` (not `import from`) makes esbuild bundle these packages'
// CommonJS builds. Their ES-module builds locate data files with
// `import.meta.url`, which is empty in the extension's CommonJS bundle and
// crashed the extension as soon as it loaded (ADR-0045).
// eslint-disable-next-line @typescript-eslint/no-require-imports -- see above: the CommonJS build is required
import fontkit = require('fontkit');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- see above: the CommonJS build is required
import PDFDocument = require('pdfkit');

const createFont = fontkit.create;
import { displayWidth, type LayoutLine, type ScreenplayLayout } from 'lorefountain-core/export/layout';
import type { TextRun } from 'lorefountain-core/export/screenplay';

/** The six font files the renderer embeds, as bytes. */
export interface PdfFonts {
  regular: Buffer;
  bold: Buffer;
  italic: Buffer;
  boldItalic: Buffer;
  fallbackRegular: Buffer;
  fallbackBold: Buffer;
}

/** Thrown when the PDF can't be produced (unreadable fonts, a `pdfkit` failure). */
export class PdfRenderError extends Error {
  /**
   * @param message - What went wrong, for the writer.
   * @param options - `cause`: the underlying error, if any.
   */
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PdfRenderError';
  }
}

/** Font file names under `resources/fonts`. */
const FONT_FILES: Readonly<Record<keyof PdfFonts, string>> = {
  regular: 'courier-prime/CourierPrime-Regular.ttf',
  bold: 'courier-prime/CourierPrime-Bold.ttf',
  italic: 'courier-prime/CourierPrime-Italic.ttf',
  boldItalic: 'courier-prime/CourierPrime-BoldItalic.ttf',
  fallbackRegular: 'noto-sans-mono/NotoSansMono-Regular.ttf',
  fallbackBold: 'noto-sans-mono/NotoSansMono-Bold.ttf',
};

/**
 * Read the bundled fonts.
 *
 * @param fontsDir - Absolute path of the extension's `resources/fonts` folder.
 * @returns The font bytes.
 * @throws {PdfRenderError} When a font file can't be read.
 */
export async function loadPdfFonts(fontsDir: string): Promise<PdfFonts> {
  try {
    const entries = await Promise.all(
      (Object.entries(FONT_FILES) as [keyof PdfFonts, string][]).map(async ([key, file]) => [key, await fs.readFile(path.join(fontsDir, file))] as const),
    );
    return Object.fromEntries(entries) as unknown as PdfFonts;
  } catch (error) {
    throw new PdfRenderError('LoreFountain could not read its PDF fonts. Reinstalling the extension should restore them.', { cause: error });
  }
}

/** Options for {@link renderPdf}. */
export interface RenderPdfOptions {
  /** The PDF's Title metadata. */
  title: string;
  /** The PDF's Author metadata, when the script has one. */
  author?: string;
}

/** `pdfkit` font names registered for the document. */
const FONT_NAMES = {
  regular: 'lf-regular',
  bold: 'lf-bold',
  italic: 'lf-italic',
  boldItalic: 'lf-bold-italic',
  fallbackRegular: 'lf-fallback',
  fallbackBold: 'lf-fallback-bold',
} as const;

const FONT_SIZE = 12;

/** Where a row's text sits: its baseline, this far below the top of the 12 pt row. */
const BASELINE_OFFSET_PT = 9;

/**
 * Render a laid-out screenplay as a PDF.
 *
 * @param layout - Core's page layout.
 * @param fonts - The font bytes from {@link loadPdfFonts}.
 * @param options - Document metadata.
 * @returns The PDF file's bytes.
 * @throws {PdfRenderError} When `pdfkit` fails.
 */
export async function renderPdf(layout: ScreenplayLayout, fonts: PdfFonts, options: RenderPdfOptions): Promise<Buffer> {
  let primary: Font;
  try {
    primary = asSingleFont(createFont(fonts.regular));
  } catch (error) {
    throw new PdfRenderError('LoreFountain could not read its PDF font.', { cause: error });
  }
  const covered = (cluster: string): boolean => Array.from(cluster).every((char) => primary.hasGlyphForCodePoint(char.codePointAt(0) ?? 0));

  const { geometry } = layout;
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [geometry.widthPt, geometry.heightPt],
        margin: 0,
        autoFirstPage: false,
        // An empty name makes pdfkit skip its default Helvetica, whose metrics files
        // the bundle doesn't ship; every line sets a registered embedded font itself.
        font: '',
        info: { Title: options.title, ...(options.author ? { Author: options.author } : {}), Creator: 'LoreFountain' },
        pdfVersion: '1.7',
        lang: 'en',
        displayTitle: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error: unknown) => reject(new PdfRenderError('LoreFountain could not write the PDF.', { cause: error })));

      for (const [key, name] of Object.entries(FONT_NAMES) as [keyof PdfFonts, string][]) doc.registerFont(name, fonts[key]);

      const pages = layout.pages.length > 0 ? layout.pages : [{ number: 1, lines: [] }];
      for (const page of pages) {
        doc.addPage({ size: [geometry.widthPt, geometry.heightPt], margin: 0 });
        for (const line of page.lines) drawLine(doc, line, geometry.colPt, geometry.rowPt, covered);
      }
      doc.end();
    } catch (error) {
      reject(new PdfRenderError('LoreFountain could not write the PDF.', { cause: error }));
    }
  });
}

/** Draw one laid-out line, run by run, each cluster group in its cell. */
function drawLine(doc: PDFKit.PDFDocument, line: LayoutLine, colPt: number, rowPt: number, covered: (cluster: string) => boolean): void {
  let col = line.col;
  // Draw on a shared alphabetic baseline: the two fonts have different ascents,
  // so top-aligned text would put fallback letters lower than their neighbours.
  const baseline = line.row * rowPt + BASELINE_OFFSET_PT;
  for (const run of line.runs) {
    for (const group of clusterGroups(run.text, covered)) {
      const x = col * colPt;
      const width = displayWidth(group.text);
      doc.font(fontFor(run, group.fallback)).fontSize(FONT_SIZE).text(group.text, x, baseline, { lineBreak: false, underline: false, baseline: 'alphabetic' });
      if (run.underline) {
        const underlineY = baseline + 1.5;
        doc.save().moveTo(x, underlineY).lineTo(x + width * colPt, underlineY).lineWidth(0.6).stroke().restore();
      }
      col += width;
    }
  }
}

/** Consecutive grapheme clusters grouped by whether Courier Prime covers them. */
function clusterGroups(text: string, covered: (cluster: string) => boolean): { text: string; fallback: boolean }[] {
  const groups: { text: string; fallback: boolean }[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const { segment } of segmenter.segment(text.normalize('NFC'))) {
    const fallback = !covered(segment);
    const last = groups[groups.length - 1];
    if (last && last.fallback === fallback) last.text += segment;
    else groups.push({ text: segment, fallback });
  }
  return groups;
}

/** The registered font name for a run's style. */
function fontFor(run: TextRun, fallback: boolean): string {
  if (fallback) return run.bold ? FONT_NAMES.fallbackBold : FONT_NAMES.fallbackRegular;
  if (run.bold && run.italic) return FONT_NAMES.boldItalic;
  if (run.bold) return FONT_NAMES.bold;
  if (run.italic) return FONT_NAMES.italic;
  return FONT_NAMES.regular;
}

/**
 * Narrow fontkit's result to a single font: `create` returns a collection for
 * `.ttc`/`.dfont` files, which the bundled `.ttf` never is.
 */
function asSingleFont(font: ReturnType<typeof createFont>): Font {
  if ('fonts' in font) throw new PdfRenderError('LoreFountain expected a single font, not a font collection.');
  return font;
}
