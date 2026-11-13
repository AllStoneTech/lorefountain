/**
 * One script exported in one format (ADR-0050): Core's filter and writers
 * (Core ADR-0006) plus this extension's PDF and Word renderers and the
 * existing transcript. Pure apart from reading fonts, which the caller supplies.
 *
 * Exports {@link exportScript}, {@link ExportRequest}, {@link ExportOutput},
 * {@link FORMAT_DETAILS} and {@link defaultExportFileName}.
 *
 * Gotchas:
 * - The transcript ignores the content options: it is always dialogue only.
 * - An exported `.fountain` saved inside the scripts folder would be indexed as
 *   another script (and clash on its Production Code), which is why exports
 *   default to an `exports/` folder; the command warns about the scripts folder.
 */

import { writeFdx } from 'lorefountain-core/export/fdx';
import { filterScript } from 'lorefountain-core/export/filter';
import { writeFountain } from 'lorefountain-core/export/fountain';
import { writeHtml } from 'lorefountain-core/export/html';
import { layoutScreenplay, type PaperSize } from 'lorefountain-core/export/layout';
import type { ExportContent } from 'lorefountain-core/export/options';
import { buildScreenplay, plainText, type Screenplay } from 'lorefountain-core/export/screenplay';
import type { ExportFormat } from 'lorefountain-core/export/settings';
import { parseFountain } from '../fountain/parse';
import { renderScreenplayDocx } from './docx';
import { renderPdf, type PdfFonts } from './pdf';
import { buildTranscript, serializeTranscriptMarkdown } from './transcript';

/** Everything an export needs besides the script. */
export interface ExportRequest {
  format: ExportFormat;
  content: ExportContent;
  paper: PaperSize;
  titlePage: boolean;
}

/** One exported file's contents and extension. */
export interface ExportOutput {
  /** The file extension, with its dot, e.g. `.pdf` or `.transcript.md`. */
  extension: string;
  data: string | Buffer;
}

/** Each format's label, extension and save-dialog filter. */
export const FORMAT_DETAILS: Readonly<Record<ExportFormat, { label: string; extension: string; filterName: string; filterExtensions: string[] }>> = {
  pdf: { label: 'PDF', extension: '.pdf', filterName: 'PDF', filterExtensions: ['pdf'] },
  fountain: { label: 'Fountain', extension: '.fountain', filterName: 'Fountain', filterExtensions: ['fountain'] },
  fdx: { label: 'Final Draft (.fdx)', extension: '.fdx', filterName: 'Final Draft', filterExtensions: ['fdx'] },
  html: { label: 'Web page (.html)', extension: '.html', filterName: 'HTML', filterExtensions: ['html'] },
  docx: { label: 'Word (.docx)', extension: '.docx', filterName: 'Word', filterExtensions: ['docx'] },
  transcript: { label: 'Transcript (dialogue only)', extension: '.transcript.md', filterName: 'Markdown', filterExtensions: ['md'] },
};

/**
 * The default file name for an export.
 *
 * @param scriptStem - The script's file name without `.fountain`.
 * @param format - The export format.
 * @returns The file name, e.g. `1x03.pdf`.
 */
export function defaultExportFileName(scriptStem: string, format: ExportFormat): string {
  return `${scriptStem}${FORMAT_DETAILS[format].extension}`;
}

/**
 * Export one script.
 *
 * @param scriptText - The `.fountain` file's text.
 * @param scriptStem - The script's file name without `.fountain`, the title when the script has none.
 * @param request - Format, content and page options.
 * @param loadFonts - Reads the PDF fonts; called only for a PDF export.
 * @returns The exported file's contents and extension.
 * @throws {import('./pdf').PdfRenderError} When the PDF can't be produced.
 */
export async function exportScript(
  scriptText: string,
  scriptStem: string,
  request: ExportRequest,
  loadFonts: () => Promise<PdfFonts>,
): Promise<ExportOutput> {
  const { format, content } = request;
  const extension = FORMAT_DETAILS[format].extension;
  const sceneNumbers = content.sceneNumbers !== 'none';

  switch (format) {
    case 'transcript': {
      const markdown = serializeTranscriptMarkdown(scriptStem, buildTranscript(parseFountain(scriptText)));
      return { extension, data: markdown };
    }
    case 'fountain':
      return { extension, data: writeFountain(scriptText, content).text };
    default:
      break;
  }

  const screenplay = buildScreenplay(filterScript(scriptText, content).text);
  switch (format) {
    case 'html':
      return { extension, data: writeHtml(screenplay, { fallbackTitle: scriptStem, sceneNumbers }) };
    case 'fdx':
      return { extension, data: writeFdx(screenplay) };
    case 'docx':
      return { extension, data: await renderScreenplayDocx(screenplay, { paper: request.paper, titlePage: request.titlePage, sceneNumbers, fallbackTitle: scriptStem }) };
    case 'pdf': {
      const layout = layoutScreenplay(screenplay, { paper: request.paper, titlePage: request.titlePage, sceneNumbers });
      const author = titleValue(screenplay, 'author') ?? titleValue(screenplay, 'authors');
      return { extension, data: await renderPdf(layout, await loadFonts(), { title: titleValue(screenplay, 'title') ?? scriptStem, ...(author ? { author } : {}) }) };
    }
  }
}

/** A title-page value as plain text, or `undefined` when the key is absent. */
function titleValue(screenplay: Screenplay, key: string): string | undefined {
  const entry = screenplay.titlePage.find((candidate) => candidate.key === key);
  const text = entry?.lines.map(plainText).join(' ').trim();
  return text ? text : undefined;
}
