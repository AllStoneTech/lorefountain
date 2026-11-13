/**
 * The screenplay `.docx` export renderer (ADR-0050): Core's screenplay model
 * (`lorefountain-core/export/screenplay`, Core ADR-0006) as a Word document
 * with one named paragraph style per screenplay element, so a writer can
 * restyle a whole element type in Word at once.
 *
 * Exports {@link renderScreenplayDocx} and {@link DocxOptions}.
 *
 * Layout matches the PDF: Courier Prime 12 pt (Word substitutes Courier New
 * where Courier Prime isn't installed), margins 1.5 in left and 1 in elsewhere,
 * dialogue at 1.0 in from the margin and 3.5 in wide, parentheticals at 1.6 in,
 * character names at 2.2 in, transitions right-aligned. Word paginates, so
 * `(MORE)`/`(CONT'D)` aren't added; keep-with-next stops a heading or name
 * ending a page. Page numbers run top right from page 2; a title page, if
 * any, is its own unnumbered section. Dual dialogue is a borderless two-column
 * table. Notes, sections and synopses are not printed, as in Fountain.
 */

import {
  AlignmentType,
  Document,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
  BorderStyle,
  type IParagraphStyleOptions,
  type ISectionOptions,
} from 'docx';
import type { PaperSize } from 'lorefountain-core/export/layout';
import { plainText, type DialogueBlock, type RunLine, type Screenplay } from 'lorefountain-core/export/screenplay';

/** Options for {@link renderScreenplayDocx}. */
export interface DocxOptions {
  paper: PaperSize;
  /** Start with a title page when the script has one. Defaults to true. */
  titlePage?: boolean;
  /** Show scene numbers after the heading text. Defaults to true. */
  sceneNumbers?: boolean;
  /** The document's Title property when the script has no `Title:`. */
  fallbackTitle: string;
}

/** Twentieths of a point per inch. */
const TWIPS = 1440;
const PAGE: Readonly<Record<PaperSize, { width: number; height: number }>> = {
  letter: { width: 12240, height: 15840 },
  a4: { width: 11906, height: 16838 },
};

/** Style ids. Word shows each style's `name` in its style gallery. */
const STYLE = {
  sceneHeading: 'SceneHeading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  lyric: 'Lyric',
  transition: 'Transition',
  centered: 'Centered',
  titlePage: 'TitlePageText',
} as const;

const FONT = 'Courier Prime';
const LINE = 240;

/** Paragraph styles for every screenplay element. */
function paragraphStyles(): IParagraphStyleOptions[] {
  const base = (id: string, name: string, extra: Partial<IParagraphStyleOptions>): IParagraphStyleOptions => ({
    id,
    name,
    basedOn: 'Normal',
    next: STYLE.action,
    quickFormat: true,
    ...extra,
  });
  return [
    base(STYLE.sceneHeading, 'Scene Heading', { paragraph: { spacing: { before: LINE, after: 0 }, keepNext: true }, run: { allCaps: true } }),
    base(STYLE.action, 'Action', { paragraph: { spacing: { before: LINE, after: 0 } } }),
    base(STYLE.character, 'Character', { next: STYLE.dialogue, paragraph: { spacing: { before: LINE, after: 0 }, indent: { left: 2.2 * TWIPS }, keepNext: true } }),
    base(STYLE.parenthetical, 'Parenthetical', { next: STYLE.dialogue, paragraph: { spacing: { before: 0, after: 0 }, indent: { left: 1.6 * TWIPS, right: 1.9 * TWIPS }, keepNext: true } }),
    base(STYLE.dialogue, 'Dialogue', { paragraph: { spacing: { before: 0, after: 0 }, indent: { left: 1.0 * TWIPS, right: 1.5 * TWIPS } } }),
    base(STYLE.lyric, 'Lyric', { paragraph: { spacing: { before: 0, after: 0 }, indent: { left: 1.0 * TWIPS, right: 1.5 * TWIPS } }, run: { italics: true } }),
    base(STYLE.transition, 'Transition', { paragraph: { spacing: { before: LINE, after: 0 }, alignment: AlignmentType.RIGHT }, run: { allCaps: true } }),
    base(STYLE.centered, 'Centered', { paragraph: { spacing: { before: LINE, after: 0 }, alignment: AlignmentType.CENTER } }),
    base(STYLE.titlePage, 'Title Page', { paragraph: { spacing: { before: 0, after: 0 }, alignment: AlignmentType.CENTER } }),
  ];
}

/**
 * Render a screenplay as a Word document.
 *
 * @param screenplay - The script model, built from filtered text.
 * @param options - Paper, title page, scene numbers and fallback title.
 * @returns The `.docx` file's bytes.
 */
export async function renderScreenplayDocx(screenplay: Screenplay, options: DocxOptions): Promise<Buffer> {
  const page = PAGE[options.paper];
  const properties = {
    page: {
      size: { width: page.width, height: page.height },
      margin: { top: TWIPS, bottom: TWIPS, left: 1.5 * TWIPS, right: TWIPS, header: TWIPS / 2 },
    },
  };
  const titleEntry = screenplay.titlePage.find((entry) => entry.key === 'title');
  const title = titleEntry ? titleEntry.lines.map(plainText).join(' ').trim() : options.fallbackTitle;
  const author = screenplay.titlePage.find((entry) => entry.key === 'author' || entry.key === 'authors');

  const sections: ISectionOptions[] = [];
  if ((options.titlePage ?? true) && screenplay.titlePage.length > 0) {
    sections.push({ properties, children: titlePageParagraphs(screenplay) });
  }
  sections.push({
    properties: { ...properties, titlePage: true },
    headers: {
      first: new Header({ children: [] }),
      default: new Header({
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT, '.'] })] })],
      }),
    },
    children: bodyChildren(screenplay, options.sceneNumbers ?? true),
  });

  const doc = new Document({
    title: title || options.fallbackTitle,
    ...(author ? { creator: author.lines.map(plainText).join(' ') } : {}),
    description: 'Exported by LoreFountain',
    styles: {
      default: { document: { run: { font: FONT, size: 24 }, paragraph: { spacing: { line: LINE, before: 0, after: 0 } } } },
      paragraphStyles: paragraphStyles(),
    },
    sections,
  });
  return Packer.toBuffer(doc);
}

/** The title page: title block a third of the way down, the rest below. */
function titlePageParagraphs(screenplay: Screenplay): Paragraph[] {
  const center = ['title', 'credit', 'author', 'authors', 'source'];
  const paragraphs: Paragraph[] = [new Paragraph({ spacing: { before: 3.2 * TWIPS } })];
  for (const key of center) {
    for (const entry of screenplay.titlePage.filter((candidate) => candidate.key === key)) {
      for (const line of entry.lines) paragraphs.push(new Paragraph({ style: STYLE.titlePage, children: runs(line) }));
      paragraphs.push(new Paragraph({ style: STYLE.titlePage }));
    }
  }
  const rest = screenplay.titlePage.filter((entry) => !center.includes(entry.key));
  if (rest.length > 0) paragraphs.push(new Paragraph({ spacing: { before: 3 * TWIPS } }));
  for (const entry of rest) {
    for (const line of entry.lines) paragraphs.push(new Paragraph({ children: runs(line) }));
    paragraphs.push(new Paragraph({}));
  }
  return paragraphs;
}

/** The script body. */
function bodyChildren(screenplay: Screenplay, sceneNumbers: boolean): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];
  let pageBreakBefore = false;
  const add = (paragraph: { style: string; children: TextRun[] }): void => {
    children.push(new Paragraph({ ...paragraph, pageBreakBefore }));
    pageBreakBefore = false;
  };

  for (const element of screenplay.elements) {
    switch (element.kind) {
      case 'scene-heading': {
        // A right tab stop at the text edge holds the scene number, which follows a tab.
        const number = sceneNumbers && element.number ? [new TextRun({ text: `\t${element.number}` })] : [];
        children.push(
          new Paragraph({
            style: STYLE.sceneHeading,
            children: [...runs(element.runs), ...number],
            tabStops: [{ type: TabStopType.RIGHT, position: 6 * TWIPS }],
            pageBreakBefore,
          }),
        );
        pageBreakBefore = false;
        break;
      }
      case 'action':
        // Each Fountain line is a line in Word; the block keeps its blank line before.
        element.lines.forEach((line, index) => {
          const printed = runs(line.runs);
          if (printed.length === 0 && line.runs.length > 0) return;
          children.push(new Paragraph({ style: STYLE.action, children: printed, pageBreakBefore, ...(index > 0 ? { spacing: { before: 0 } } : {}) }));
          pageBreakBefore = false;
        });
        break;
      case 'dialogue':
        for (const paragraph of speechParagraphs(element.block)) {
          children.push(pageBreakBefore ? new Paragraph({ ...paragraph, pageBreakBefore: true }) : new Paragraph(paragraph));
          pageBreakBefore = false;
        }
        break;
      case 'dual-dialogue':
        children.push(dualTable(element.left, element.right));
        pageBreakBefore = false;
        break;
      case 'lyric':
        for (const line of element.lines) add({ style: STYLE.action, children: runs(line, { italics: true }) });
        break;
      case 'transition':
        add({ style: STYLE.transition, children: runs(element.runs) });
        break;
      case 'centered':
        for (const line of element.lines) add({ style: STYLE.centered, children: runs(line) });
        break;
      case 'page-break':
        pageBreakBefore = true;
        break;
      case 'section':
      case 'synopsis':
      case 'note':
        break;
    }
  }
  return children;
}

/** Paragraph options for a speech, in order. */
function speechParagraphs(block: DialogueBlock): { style: string; children: TextRun[] }[] {
  const paragraphs: { style: string; children: TextRun[] }[] = [{ style: STYLE.character, children: runs(block.cue) }];
  for (const part of block.parts) {
    if (part.kind === 'parenthetical') {
      paragraphs.push({ style: STYLE.parenthetical, children: runs(part.runs) });
    } else {
      const style = part.kind === 'lyric' ? STYLE.lyric : STYLE.dialogue;
      for (const line of part.lines) paragraphs.push({ style, children: runs(line) });
    }
  }
  return paragraphs;
}

/** Dual dialogue as a borderless two-column table, each speech in its own cell. */
function dualTable(left: DialogueBlock, right: DialogueBlock): Table {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const borders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
  const cell = (block: DialogueBlock): TableCell =>
    new TableCell({
      width: { size: 50, type: WidthType.PERCENTAGE },
      borders: { top: none, bottom: none, left: none, right: none },
      children: speechParagraphs(block).map(
        ({ style, children }) =>
          new Paragraph({ children, keepNext: true, spacing: { before: style === STYLE.character ? LINE : 0 }, ...(style === STYLE.character ? { alignment: AlignmentType.CENTER } : {}), ...(style === STYLE.lyric ? { style } : {}) }),
      ),
    });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: [new TableRow({ cantSplit: true, children: [cell(left), cell(right)] })] });
}

/**
 * A line's printed runs as Word runs (notes are never printed).
 *
 * @param line - The runs.
 * @param extra - Styling added to every run, such as italics for a lyric.
 * @returns Word text runs.
 */
function runs(line: RunLine, extra: { italics?: boolean } = {}): TextRun[] {
  return line
    .filter((run) => !run.note)
    .map(
      (run) =>
        new TextRun({
          text: run.text,
          ...(run.bold ? { bold: true } : {}),
          ...(run.italic || extra.italics ? { italics: true } : {}),
          ...(run.underline ? { underline: {} } : {}),
        }),
    );
}
