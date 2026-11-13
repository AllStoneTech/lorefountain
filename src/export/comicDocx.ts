/**
 * The comic script `.docx` export renderer (ADR-0046): Core's comic model
 * (`lorefountain-core/export/comic`, Core ADR-0004) as a Word document laid
 * out as a comic full script, with one named paragraph style per element so
 * a writer can restyle them in Word at once.
 *
 * Exports {@link renderComicDocx} and {@link ComicDocxOptions}.
 *
 * Layout matches the comic PDF: Courier Prime 12 pt (Courier New where it
 * isn't installed), 1 inch margins, each comic page starting a new Word page
 * with its heading bold and underlined. Lettering hangs from a tab stop: the
 * number, the label, then the words at 2.4 inches, wrapping under themselves.
 * Word paginates, so a long comic page simply flows on; keep-with-next stops
 * a panel heading ending a page. Page numbers run top right from page 2; a
 * title page, if any, is its own unnumbered section.
 */

import { AlignmentType, Document, Header, Packer, PageNumber, Paragraph, Tab, TabStopType, TextRun, type IParagraphStyleOptions, type ISectionOptions } from 'docx';
import type { ComicExportPanel, ComicLettering, ComicScript } from 'lorefountain-core/export/comic';
import type { PaperSize } from 'lorefountain-core/export/layout';
import { plainText, type RunLine } from 'lorefountain-core/export/screenplay';
import { DOCX_PAGE, docxRuns, titlePageParagraphs, TWIPS } from './docx';

/** Options for {@link renderComicDocx}. */
export interface ComicDocxOptions {
  paper: PaperSize;
  /** Start with a title page when the script has one. Defaults to true. */
  titlePage?: boolean;
  /** The document's Title property when the script has no `Title:`. */
  fallbackTitle: string;
  /** The document language, as a BCP 47 tag. Defaults to `en`. */
  lang?: string;
}

/** Style ids. Word shows each style's `name` in its style gallery. */
const STYLE = {
  page: 'ComicPage',
  panel: 'ComicPanel',
  description: 'PanelDescription',
  lettering: 'Lettering',
  // Shared with the screenplay writer's title page.
  titlePage: 'TitlePageText',
} as const;

const FONT = 'Courier Prime';
const LINE = 240;
/** Where the label starts and where the words start, from the left margin. */
const LABEL_TAB = 0.8 * TWIPS;
const TEXT_TAB = 2.4 * TWIPS;
const NUMBER_INDENT = 0.4 * TWIPS;

/** Paragraph styles for every comic element. */
function paragraphStyles(): IParagraphStyleOptions[] {
  const base = (id: string, name: string, extra: Partial<IParagraphStyleOptions>): IParagraphStyleOptions => ({
    id,
    name,
    basedOn: 'Normal',
    next: STYLE.description,
    quickFormat: true,
    ...extra,
  });
  return [
    base(STYLE.page, 'Comic Page', { next: STYLE.panel, paragraph: { spacing: { before: 0, after: 0 }, keepNext: true }, run: { bold: true } }),
    base(STYLE.panel, 'Panel', { paragraph: { spacing: { before: LINE, after: 0 }, keepNext: true }, run: { bold: true } }),
    base(STYLE.description, 'Panel Description', { paragraph: { spacing: { before: 0, after: 0 } } }),
    base(STYLE.lettering, 'Lettering', {
      next: STYLE.lettering,
      paragraph: {
        spacing: { before: LINE, after: 0 },
        indent: { left: TEXT_TAB, hanging: TEXT_TAB - NUMBER_INDENT },
        keepLines: true,
      },
    }),
    base(STYLE.titlePage, 'Title Page', { paragraph: { spacing: { before: 0, after: 0 }, alignment: AlignmentType.CENTER } }),
  ];
}

/**
 * Render a comic script as a Word document.
 *
 * @param script - The comic model, built from filtered text.
 * @param options - Paper, title page, fallback title and language.
 * @returns The `.docx` file's bytes.
 */
export async function renderComicDocx(script: ComicScript, options: ComicDocxOptions): Promise<Buffer> {
  const page = DOCX_PAGE[options.paper];
  const properties = {
    page: {
      size: { width: page.width, height: page.height },
      margin: { top: TWIPS, bottom: TWIPS, left: TWIPS, right: TWIPS, header: TWIPS / 2 },
    },
  };
  const titleEntry = script.titlePage.find((entry) => entry.key === 'title');
  const title = titleEntry ? titleEntry.lines.map(plainText).join(' ').trim() : options.fallbackTitle;
  const author = script.titlePage.find((entry) => entry.key === 'author' || entry.key === 'authors');

  const sections: ISectionOptions[] = [];
  if ((options.titlePage ?? true) && script.titlePage.length > 0) {
    sections.push({ properties, children: titlePageParagraphs(script) });
  }
  sections.push({
    properties: { ...properties, titlePage: true },
    headers: {
      first: new Header({ children: [] }),
      default: new Header({
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT, '.'] })] })],
      }),
    },
    children: bodyParagraphs(script),
  });

  const doc = new Document({
    title: title || options.fallbackTitle,
    ...(author ? { creator: author.lines.map(plainText).join(' ') } : {}),
    description: 'Exported by LoreFountain',
    styles: {
      default: { document: { run: { font: FONT, size: 24, language: { value: options.lang ?? 'en' } }, paragraph: { spacing: { line: LINE, before: 0, after: 0 } } } },
      paragraphStyles: paragraphStyles(),
    },
    sections,
  });
  return Packer.toBuffer(doc);
}

/** Every comic page, each after a page break. */
function bodyParagraphs(script: ComicScript): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  script.pages.forEach((page, index) => {
    paragraphs.push(
      new Paragraph({
        style: STYLE.page,
        pageBreakBefore: index > 0,
        children: [new TextRun({ text: page.heading, underline: {} }), new TextRun({ text: ` ${page.details}`, bold: false })],
      }),
    );
    if (page.layout) paragraphs.push(descriptionParagraph(labelled('Layout', page.layout)));
    for (const note of page.notes) note.forEach((line, lineIndex) => paragraphs.push(descriptionParagraph(line, lineIndex === 0)));
    for (const panel of page.panels) paragraphs.push(...panelParagraphs(panel));
  });
  return paragraphs;
}

/** One panel: heading, direction, then lettering. */
function panelParagraphs(panel: ComicExportPanel): Paragraph[] {
  const heading = panel.number > 0 ? `PANEL ${panel.number}` : 'LETTERING BEFORE THE FIRST PANEL';
  const paragraphs = [new Paragraph({ style: STYLE.panel, children: [new TextRun(heading)] })];
  const direction: RunLine[] = [];
  if (panel.layout) direction.push(labelled('Layout', panel.layout));
  if (panel.description) direction.push(panel.description);
  for (const line of panel.directions) direction.push(labelled(line.label, line.runs));
  for (const line of direction) paragraphs.push(descriptionParagraph(line, false));
  for (const action of panel.action) action.forEach((line, index) => paragraphs.push(descriptionParagraph(line, index === 0)));
  for (const entry of panel.lettering) paragraphs.push(letteringParagraph(entry));
  return paragraphs;
}

/** A description or direction line; `spaced` puts a blank line before it. */
function descriptionParagraph(line: RunLine, spaced = true): Paragraph {
  return new Paragraph({ style: STYLE.description, children: docxRuns(line), ...(spaced ? { spacing: { before: LINE } } : {}) });
}

/** A lettering entry: number, tab, label, tab, words (later lines as line breaks, under the words). */
function letteringParagraph(entry: ComicLettering): Paragraph {
  // Word tab elements: a tab character inside the text is only whitespace to Word.
  const children: TextRun[] = [new TextRun({ children: [`${entry.number}.`, new Tab(), `${entry.label}:`, new Tab()] })];
  entry.lines.forEach((line, index) => {
    if (index > 0) children.push(new TextRun({ text: '', break: 1 }));
    children.push(...docxRuns(line));
  });
  // Word styles can't hold tab stops here, so each lettering paragraph carries them.
  return new Paragraph({
    style: STYLE.lettering,
    tabStops: [
      { type: TabStopType.LEFT, position: LABEL_TAB },
      { type: TabStopType.LEFT, position: TEXT_TAB },
    ],
    children,
  });
}

/** `Label: text` runs. */
function labelled(label: string, runs: RunLine): RunLine {
  return [{ text: `${label}: ` }, ...runs];
}
