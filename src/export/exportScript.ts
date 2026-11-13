/**
 * One script exported in one format (ADR-0045): Core's filter and writers
 * (Core ADR-0003) plus this extension's PDF and Word renderers and the
 * existing transcript. Pure apart from reading fonts, which the caller supplies.
 *
 * Exports {@link exportScript}, {@link ExportRequest}, {@link ExportOutput},
 * {@link FORMAT_DETAILS}, {@link defaultExportFileName} and {@link layoutFor}.
 *
 * Gotchas:
 * - The transcript ignores the content options: it is always dialogue only.
 * - The layout (screenplay or comic, ADR-0046) applies to PDF, Word and HTML.
 *   `auto` is resolved per script, so a season of mixed scripts exports each
 *   in its own layout. Final Draft is always a screenplay.
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
import { buildComicScript, comicExportContent, hasComicPages } from 'lorefountain-core/export/comic';
import { writeComicHtml } from 'lorefountain-core/export/comicHtml';
import { layoutComic } from 'lorefountain-core/export/comicLayout';
import { buildScreenplay, plainText, type TitlePageEntry } from 'lorefountain-core/export/screenplay';
import { resolveExportLayout, type ExportFormat, type ExportLayout, type ExportLayoutSetting } from 'lorefountain-core/export/settings';
import { parseFountain } from '../fountain/parse';
import { renderComicDocx } from './comicDocx';
import { renderScreenplayDocx } from './docx';
import { renderPdf, type PdfFonts } from './pdf';
import { buildTranscript, serializeTranscriptMarkdown } from './transcript';

/** Everything an export needs besides the script. */
export interface ExportRequest {
  format: ExportFormat;
  content: ExportContent;
  paper: PaperSize;
  titlePage: boolean;
  /** Screenplay, comic, or `auto` (decided per script). */
  layout: ExportLayoutSetting;
  /** Mark comic pages LEFT or RIGHT. */
  comicPageSides: boolean;
  /** The language the document declares, as a BCP 47 tag. */
  language: string;
  /** The project's type, when it has one; feeds the automatic layout. */
  projectType?: string;
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

  if (format !== 'fdx' && layoutFor(scriptText, request) === 'comic') {
    const comic = buildComicScript(filterScript(scriptText, comicExportContent(content)).text, { pageSides: request.comicPageSides });
    const lang = request.language;
    switch (format) {
      case 'html':
        return { extension, data: writeComicHtml(comic, { fallbackTitle: scriptStem, lang }) };
      case 'docx':
        return { extension, data: await renderComicDocx(comic, { paper: request.paper, titlePage: request.titlePage, fallbackTitle: scriptStem, lang }) };
      case 'pdf': {
        const layout = layoutComic(comic, { paper: request.paper, titlePage: request.titlePage });
        return { extension, data: await renderPdf(layout, await loadFonts(), pdfMetadata(comic.titlePage, scriptStem, lang)) };
      }
    }
  }

  const screenplay = buildScreenplay(filterScript(scriptText, content).text);
  switch (format) {
    case 'html':
      return { extension, data: writeHtml(screenplay, { fallbackTitle: scriptStem, sceneNumbers, lang: request.language }) };
    case 'fdx':
      return { extension, data: writeFdx(screenplay) };
    case 'docx':
      return {
        extension,
        data: await renderScreenplayDocx(screenplay, { paper: request.paper, titlePage: request.titlePage, sceneNumbers, fallbackTitle: scriptStem, lang: request.language }),
      };
    case 'pdf': {
      const layout = layoutScreenplay(screenplay, { paper: request.paper, titlePage: request.titlePage, sceneNumbers });
      return { extension, data: await renderPdf(layout, await loadFonts(), pdfMetadata(screenplay.titlePage, scriptStem, request.language)) };
    }
  }
}

/**
 * The layout one script exports in.
 *
 * @param scriptText - The script's text.
 * @param request - The layout setting and project type.
 * @returns `screenplay` or `comic`.
 */
export function layoutFor(scriptText: string, request: Pick<ExportRequest, 'layout' | 'projectType'>): ExportLayout {
  if (request.layout !== 'auto') return request.layout;
  return resolveExportLayout('auto', { ...(request.projectType ? { projectType: request.projectType } : {}), hasComicPages: hasComicPages(scriptText) });
}

/** The PDF's Title, Author and language. */
function pdfMetadata(titlePage: TitlePageEntry[], scriptStem: string, lang: string): { title: string; author?: string; lang: string } {
  const author = titleValue(titlePage, 'author') ?? titleValue(titlePage, 'authors');
  return { title: titleValue(titlePage, 'title') ?? scriptStem, ...(author ? { author } : {}), lang };
}

/** A title-page value as plain text, or `undefined` when the key is absent. */
function titleValue(titlePage: TitlePageEntry[], key: string): string | undefined {
  const entry = titlePage.find((candidate) => candidate.key === key);
  const text = entry?.lines.map(plainText).join(' ').trim();
  return text ? text : undefined;
}
