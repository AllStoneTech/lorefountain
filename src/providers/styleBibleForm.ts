/**
 * Style bible form model (ADR-0047): pure conversion between the text of a
 * `style.lf.md` document and a flat, JSON-serializable form state the guided
 * editor's webview renders, plus applying an edited form state back to text.
 * No `vscode` dependency, so it is fully unit-testable; the `vscode`-facing
 * glue is `styleBibleEditorProvider.ts`, the markup `styleBibleHtml.ts`.
 *
 * Guarantees the editor relies on:
 * - **Byte-stable:** {@link applyFormStateToText} returns the original text
 *   untouched when the form state equals the state read from it.
 * - **Minimal change:** only fields whose form value changed are rewritten;
 *   unknown frontmatter keys, per-medium `format` keys the form doesn't own,
 *   palette items the writer didn't touch, and body sections the form doesn't
 *   own (the "Additional notes" area) are carried over. A body-only change keeps
 *   the original frontmatter text, comments included. A frontmatter change
 *   re-serializes the YAML, which drops YAML comments (the scaffold's
 *   commented-out examples).
 * - **Safe hex:** palette colours are written through the YAML serializer, which
 *   quotes any string starting with `#` or containing ` #`, so the unquoted-`#`
 *   comment trap cannot happen.
 *
 * Exports {@link styleBibleToFormState}, {@link applyFormStateToText},
 * {@link styleFormStateSchema}, {@link validateFormState},
 * {@link toProjectRelativePath}, {@link BODY_SECTIONS} and the state types.
 */

import * as path from 'node:path';
import { z } from 'zod';
import { parsePaletteEntry, parseStyleBibleFile, styleBibleSchema, type StyleBibleFrontmatter } from 'lorefountain-core/model/styleBible';
import { parseMarkdownWithFrontmatter, serializeMarkdownWithFrontmatter } from '../model/frontmatter';

/** One palette row: a colour name and a hex value (either may be blank). */
export interface PaletteRow {
  name: string;
  /** `#rgb`, `#rrggbb` (or with alpha) when valid; whatever was typed otherwise. */
  hex: string;
  /** The original list item, kept so an untouched row is written back exactly as it was. */
  raw?: string;
}

/** One per-medium format row. */
export interface FormatRow {
  medium: string;
  aspectRatio: string;
  trimSize: string;
  note: string;
}

/** Keys of the body sections the form owns. */
export type SectionKey =
  | 'overall'
  | 'characters'
  | 'color'
  | 'line'
  | 'framing'
  | 'lettering'
  | 'motion'
  | 'format'
  | 'avoid';

/** The form's full, flat, editable state. */
export interface StyleFormState {
  medium: string[];
  artStyle: string;
  palette: PaletteRow[];
  referenceImages: string[];
  avoid: string[];
  format: FormatRow[];
  lettering: string[];
  eraReference: string;
  /** Body section text by key (comment-only scaffold hints show as empty). */
  sections: Record<SectionKey, string>;
  /** Every body part the form doesn't own: the intro, any other heading. */
  additional: string;
}

/** Runtime validation of a form state arriving from the webview (an external boundary). */
export const styleFormStateSchema = z.object({
  medium: z.array(z.string()),
  artStyle: z.string(),
  palette: z.array(z.object({ name: z.string(), hex: z.string(), raw: z.string().optional() })),
  referenceImages: z.array(z.string()),
  avoid: z.array(z.string()),
  format: z.array(
    z.object({ medium: z.string(), aspectRatio: z.string(), trimSize: z.string(), note: z.string() }),
  ),
  lettering: z.array(z.string()),
  eraReference: z.string(),
  sections: z.object({
    overall: z.string(),
    characters: z.string(),
    color: z.string(),
    line: z.string(),
    framing: z.string(),
    lettering: z.string(),
    motion: z.string(),
    format: z.string(),
    avoid: z.string(),
  }),
  additional: z.string(),
});

/** A body section the form owns. */
export interface BodySectionDef {
  key: SectionKey;
  /** The heading written when the form creates the section. */
  heading: string;
  /** Lower-case heading texts (without `##`) that count as this section. */
  aliases: readonly string[];
  /** A short hint shown under the label. */
  hint: string;
  /** Media this section is about; `null` means every medium. */
  appliesTo: readonly string[] | null;
}

/** The scaffold's body sections, in scaffold order. */
export const BODY_SECTIONS: readonly BodySectionDef[] = [
  {
    key: 'overall',
    heading: 'Overall look',
    aliases: ['overall look'],
    hint: 'Two or three sentences: if someone saw one frame or one page, what would make them say "that is this project"?',
    appliesTo: null,
  },
  {
    key: 'characters',
    heading: 'Characters',
    aliases: ['characters'],
    hint: 'Global rules only: proportions, level of realism, how faces are drawn. Per-character looks stay in each character file.',
    appliesTo: null,
  },
  {
    key: 'color',
    heading: 'Color & light',
    aliases: ['color & light', 'colour & light', 'color and light', 'colour and light'],
    hint: 'The palette in words: dominant colours, contrast, time-of-day mood, how light behaves.',
    appliesTo: null,
  },
  {
    key: 'line',
    heading: 'Line & rendering',
    aliases: ['line & rendering', 'line and rendering'],
    hint: 'Ink, paint, pencil, 3D; line weight; texture; how much detail.',
    appliesTo: null,
  },
  {
    key: 'framing',
    heading: 'Framing & composition',
    aliases: ['framing & composition', 'framing and composition'],
    hint: 'Camera distance, angles, panel or shot rhythm, how crowded or empty frames feel.',
    appliesTo: null,
  },
  {
    key: 'lettering',
    heading: 'Lettering (comic)',
    aliases: ['lettering (comic)', 'lettering'],
    hint: 'Fonts or lettering style, balloon shapes, caption boxes, how SFX look.',
    appliesTo: ['comic'],
  },
  {
    key: 'motion',
    heading: 'Motion & pacing (video)',
    aliases: ['motion & pacing (video)', 'motion & pacing', 'motion and pacing'],
    hint: 'Cutting rhythm, camera movement, how still images move, transitions.',
    appliesTo: ['video', 'animation'],
  },
  {
    key: 'format',
    heading: 'Format notes',
    aliases: ['format notes', 'format notes per medium'],
    hint: 'Per-medium format detail beyond the Format table above: bleed, resolution, safe areas. Use a ### subheading per medium.',
    appliesTo: null,
  },
  {
    key: 'avoid',
    heading: 'What to avoid',
    aliases: ['what to avoid'],
    hint: 'Looks, clichés or details that do not belong in this project, in prose.',
    appliesTo: null,
  },
];

const EMPTY_SECTIONS: Record<SectionKey, string> = {
  overall: '',
  characters: '',
  color: '',
  line: '',
  framing: '',
  lettering: '',
  motion: '',
  format: '',
  avoid: '',
};

/** Matches a valid hex colour (3, 4, 6 or 8 digits), whole string. */
const HEX_WHOLE = /^#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})$/i;

/**
 * Whether text is a valid hex colour.
 *
 * @param text - Candidate text such as `#2a7f8e`.
 * @returns True for `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`.
 */
export function isValidHex(text: string): boolean {
  return HEX_WHOLE.test(text.trim());
}

/**
 * Normalize typed hex: add a missing `#`, lower-case a valid value, leave
 * anything else as typed.
 *
 * @param text - What the writer typed in the hex box.
 * @returns The normalized text.
 */
export function normalizeHex(text: string): string {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX_WHOLE.test(withHash) ? withHash.toLowerCase() : trimmed;
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

/** One block of a body: the text before the first `##` heading, or a `##` section. */
interface BodyBlock {
  /** `preamble` (no heading), an owned key, or `other` (a heading the form doesn't own). */
  kind: 'preamble' | SectionKey | 'other';
  /** The heading line, for non-preamble blocks. */
  headingLine?: string;
  /** Everything after the heading line, trimmed of surrounding blank lines. */
  content: string;
}

/** Split a body into blocks at level-2 headings, ignoring `##` lines inside code fences. */
function parseBlocks(body: string): BodyBlock[] {
  const lines = body.split(/\r?\n/);
  const raw: { headingLine?: string; lines: string[] }[] = [{ lines: [] }];
  let fence: string | undefined;
  for (const line of lines) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1].charAt(0);
      if (fence === undefined) fence = marker;
      else if (fence === marker) fence = undefined;
    }
    if (fence === undefined && /^##(?!#)\s+\S/.test(line)) {
      raw.push({ headingLine: line, lines: [] });
    } else {
      raw[raw.length - 1].lines.push(line);
    }
  }
  const seen = new Set<SectionKey>();
  const blocks: BodyBlock[] = [];
  for (const item of raw) {
    const content = item.lines.join('\n').trim();
    if (item.headingLine === undefined) {
      if (content !== '') blocks.push({ kind: 'preamble', content });
      continue;
    }
    const title = item.headingLine.replace(/^##\s+/, '').replace(/\s*#*\s*$/, '').trim().toLowerCase();
    const def = BODY_SECTIONS.find((section) => section.aliases.includes(title));
    if (def && !seen.has(def.key)) {
      seen.add(def.key);
      blocks.push({ kind: def.key, headingLine: item.headingLine, content });
    } else {
      blocks.push({ kind: 'other', headingLine: item.headingLine, content });
    }
  }
  return blocks;
}

/** A block's content as the form shows it: scaffold hints (HTML comments only) show as empty. */
function displayContent(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, '').trim() === '' ? '' : content.trim();
}

/** The raw text of a block, heading included. */
function blockText(block: BodyBlock): string {
  if (block.headingLine === undefined) return block.content;
  return block.content === '' ? block.headingLine : `${block.headingLine}\n\n${block.content}`;
}

/** The non-owned blocks of a body joined as the "Additional notes" text. */
function additionalOf(blocks: readonly BodyBlock[]): string {
  return blocks
    .filter((block) => block.kind === 'preamble' || block.kind === 'other')
    .map(blockText)
    .join('\n\n')
    .trim();
}

/**
 * Rebuild a body from its original blocks and the form's section and
 * additional text, changing only what differs.
 */
function applyBody(originalBody: string, state: StyleFormState): string {
  const blocks = parseBlocks(originalBody);
  const originalAdditional = additionalOf(blocks);
  const additionalChanged = state.additional.trim() !== originalAdditional;

  const out: string[] = [];
  if (additionalChanged && state.additional.trim() !== '') out.push(state.additional.trim());

  const present = new Set<SectionKey>();
  for (const block of blocks) {
    if (block.kind === 'preamble' || block.kind === 'other') {
      if (!additionalChanged) out.push(blockText(block));
      continue;
    }
    present.add(block.kind);
    const wanted = state.sections[block.kind].trim();
    if (wanted === displayContent(block.content)) {
      out.push(blockText(block));
    } else if (wanted !== '') {
      out.push(`${block.headingLine}\n\n${wanted}`);
    }
  }
  for (const def of BODY_SECTIONS) {
    const wanted = state.sections[def.key].trim();
    if (!present.has(def.key) && wanted !== '') out.push(`## ${def.heading}\n\n${wanted}`);
  }
  return out.join('\n\n');
}

// ---------------------------------------------------------------------------
// Frontmatter <-> form state
// ---------------------------------------------------------------------------

/** A string-or-list field as trimmed, non-empty items. */
function listOf(value: string | string[] | undefined): string[] {
  const items = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return items.map((item) => item.trim()).filter((item) => item !== '');
}

/** Read a `format` value as a form row. */
function formatRowFrom(medium: string, value: unknown): FormatRow {
  if (typeof value === 'string') return { medium, aspectRatio: '', trimSize: '', note: value.trim() };
  const object = (value ?? {}) as Record<string, unknown>;
  const text = (key: string): string => (object[key] === undefined || object[key] === null ? '' : String(object[key]).trim());
  return { medium, aspectRatio: text('aspect_ratio'), trimSize: text('trim_size'), note: text('note') };
}

/**
 * Read the text of a style bible into form state.
 *
 * @param text - The document text.
 * @param filePath - The document's path (only used in parse results).
 * @returns The form state, or the failure message when the file can't be parsed or fails the schema.
 */
export function styleBibleToFormState(
  text: string,
  filePath = 'style.lf.md',
): { ok: true; state: StyleFormState } | { ok: false; message: string; issues: { path: string; message: string }[] } {
  const parsed = parseStyleBibleFile(text, filePath);
  if (!parsed.ok) return { ok: false, message: parsed.message, issues: parsed.issues ?? [] };
  const fm = parsed.style.frontmatter;
  const blocks = parseBlocks(parsed.style.body);
  const sections = { ...EMPTY_SECTIONS };
  for (const block of blocks) {
    if (block.kind !== 'preamble' && block.kind !== 'other') sections[block.kind] = displayContent(block.content);
  }
  const format: FormatRow[] = Object.entries(fm.format ?? {}).map(([medium, value]) => formatRowFrom(medium, value));
  return {
    ok: true,
    state: {
      medium: [...new Set(listOf(fm.medium).map((item) => item.toLowerCase()))],
      artStyle: fm.art_style?.trim() ?? '',
      palette: listOf(fm.palette).map((raw) => {
        const entry = parsePaletteEntry(raw);
        return { name: entry.name ?? '', hex: entry.hex ?? '', raw };
      }),
      referenceImages: listOf(fm.reference_images),
      avoid: listOf(fm.avoid),
      format,
      lettering: listOf(fm.lettering),
      eraReference: fm.era_reference?.trim() ?? '',
      sections,
      additional: additionalOf(blocks),
    },
  };
}

/** Key-order-independent JSON for comparing form states. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}

/** Drop blank items and trim the rest. */
function cleanList(items: readonly string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => item !== '');
}

/** A palette row as the string written to the file, or `undefined` for an empty row. */
function paletteItem(row: PaletteRow): string | undefined {
  const name = row.name.trim();
  const hex = normalizeHex(row.hex);
  if (row.raw !== undefined) {
    const original = parsePaletteEntry(row.raw);
    if ((original.name ?? '') === name && (original.hex ?? '') === hex) return row.raw;
  }
  const item = [name, hex].filter((part) => part !== '').join(' ');
  return item === '' ? undefined : item;
}

/** Build the YAML value for a changed format row, starting from the original value so unknown keys survive. */
function formatValueFor(row: FormatRow, original: unknown): unknown {
  const base = original !== null && typeof original === 'object' ? { ...(original as Record<string, unknown>) } : {};
  const setOrDelete = (key: string, value: string): void => {
    if (value.trim() === '') delete base[key];
    else base[key] = value.trim();
  };
  setOrDelete('aspect_ratio', row.aspectRatio);
  setOrDelete('trim_size', row.trimSize);
  const isObject = original !== null && typeof original === 'object';
  const onlyNote = row.aspectRatio.trim() === '' && row.trimSize.trim() === '' && Object.keys(base).filter((k) => k !== 'note').length === 0;
  if (!isObject && onlyNote) return row.note.trim() === '' ? undefined : row.note.trim();
  setOrDelete('note', row.note);
  return Object.keys(base).length === 0 ? undefined : base;
}

/** Apply the form's changed frontmatter fields onto a copy of the original frontmatter. */
function applyFrontmatter(
  original: StyleBibleFrontmatter,
  baseline: StyleFormState,
  state: StyleFormState,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...original };
  const set = (key: string, value: unknown): void => {
    if (value === undefined || (Array.isArray(value) && value.length === 0)) delete next[key];
    else next[key] = value;
  };
  const changed = (a: unknown, b: unknown): boolean => stable(a) !== stable(b);

  if (changed(state.medium, baseline.medium)) set('medium', cleanList(state.medium).map((item) => item.toLowerCase()));
  if (changed(state.artStyle, baseline.artStyle)) set('art_style', state.artStyle.trim() || undefined);
  if (changed(state.palette, baseline.palette)) {
    set('palette', state.palette.map(paletteItem).filter((item): item is string => item !== undefined));
  }
  if (changed(state.referenceImages, baseline.referenceImages)) set('reference_images', cleanList(state.referenceImages));
  if (changed(state.avoid, baseline.avoid)) set('avoid', cleanList(state.avoid));
  if (changed(state.lettering, baseline.lettering)) set('lettering', cleanList(state.lettering));
  if (changed(state.eraReference, baseline.eraReference)) set('era_reference', state.eraReference.trim() || undefined);

  if (changed(state.format, baseline.format)) {
    const originalFormat = (original.format ?? {}) as Record<string, unknown>;
    const next_format: Record<string, unknown> = {};
    const baselineByMedium = new Map(baseline.format.map((row) => [row.medium.toLowerCase(), row]));
    const originalKeyFor = (medium: string): string | undefined =>
      Object.keys(originalFormat).find((key) => key.toLowerCase() === medium.toLowerCase());
    const done = new Set<string>();
    for (const row of state.format) {
      const medium = row.medium.trim();
      if (medium === '' || done.has(medium.toLowerCase())) continue;
      done.add(medium.toLowerCase());
      const originalKey = originalKeyFor(medium);
      const before = baselineByMedium.get(medium.toLowerCase());
      if (originalKey !== undefined && before !== undefined && !changed(before, row)) {
        next_format[originalKey] = originalFormat[originalKey];
        continue;
      }
      const value = formatValueFor(row, originalKey === undefined ? undefined : originalFormat[originalKey]);
      if (value !== undefined) next_format[originalKey ?? medium.toLowerCase()] = value;
    }
    set('format', Object.keys(next_format).length === 0 ? undefined : next_format);
  }
  return next;
}

/** The leading frontmatter block of `text` (BOM stripped, ends with exactly one newline), if any. */
function originalHeader(text: string): string | undefined {
  const match = /^\uFEFF?(---[ \t]*\r?\n[\s\S]*?(?:\r?\n)?---)[ \t]*(?:\r?\n|$)/.exec(text);
  return match ? `${match[1]}\n` : undefined;
}

/**
 * Apply an edited form state to the document text.
 *
 * Returns the original text when nothing changed, keeps the original
 * frontmatter text when only the body changed, and refuses to produce text
 * that fails the style bible schema.
 *
 * @param text - The document's current text.
 * @param state - The form state to apply.
 * @returns The new text, or why it could not be produced.
 */
export function applyFormStateToText(text: string, state: StyleFormState): { ok: true; text: string } | { ok: false; message: string } {
  const read = styleBibleToFormState(text);
  if (!read.ok) return { ok: false, message: read.message };
  if (stable(read.state) === stable(state)) return { ok: true, text };

  const parsed = parseMarkdownWithFrontmatter(text);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const original = styleBibleSchema.parse(parsed.value.frontmatter);

  const frontmatter = applyFrontmatter(original, read.state, state);
  const validated = styleBibleSchema.safeParse(frontmatter);
  if (!validated.success) return { ok: false, message: 'The change would not pass the style bible schema.' };

  const body = applyBody(parsed.value.body, state);
  const frontmatterChanged = stable(frontmatter) !== stable(parsed.value.frontmatter);
  const header = originalHeader(text);

  let next: string;
  if (!frontmatterChanged && header !== undefined) {
    next = body === '' ? header : `${header}\n${body}\n`;
  } else if (Object.keys(frontmatter).length === 0 && header === undefined) {
    next = body === '' ? '' : `${body}\n`;
  } else {
    next =
      Object.keys(frontmatter).length === 0
        ? `---\n---\n${body === '' ? '' : `\n${body}\n`}`
        : serializeMarkdownWithFrontmatter(frontmatter, body);
    if (body === '') next = next.replace(/\n\n\n$/, '\n');
  }

  const check = parseStyleBibleFile(next, 'style.lf.md');
  if (!check.ok) return { ok: false, message: check.message };
  return { ok: true, text: next };
}

// ---------------------------------------------------------------------------
// Validation messages for the form
// ---------------------------------------------------------------------------

/** One inline message for a field. */
export interface FieldIssue {
  /** Where it shows: `palette.2`, `reference_images.0`, `medium`, ... */
  path: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

/** What the host learned about each reference image path. */
export type ReferenceStatus = 'ok' | 'missing' | 'outside' | 'remote';

/**
 * Messages the form shows next to fields.
 *
 * @param state - The current form state.
 * @param referenceStatus - Existence/location of each reference image path, by path.
 * @returns The messages, in field order.
 */
export function validateFormState(state: StyleFormState, referenceStatus: Readonly<Record<string, ReferenceStatus>> = {}): FieldIssue[] {
  const issues: FieldIssue[] = [];
  state.palette.forEach((row, index) => {
    const hex = row.hex.trim();
    if (hex !== '' && !isValidHex(normalizeHex(hex))) {
      issues.push({ path: `palette.${index}`, severity: 'error', message: `"${hex}" is not a hex colour like #2a7f8e. It will be saved as part of the name.` });
    } else if (hex === '' && row.name.trim() === '') {
      issues.push({ path: `palette.${index}`, severity: 'info', message: 'Empty rows are not saved.' });
    }
  });
  state.referenceImages.forEach((entry, index) => {
    const status = referenceStatus[entry];
    if (status === 'missing') issues.push({ path: `reference_images.${index}`, severity: 'warning', message: `File not found in the project: ${entry}` });
    else if (status === 'outside') issues.push({ path: `reference_images.${index}`, severity: 'warning', message: 'This path is outside the project, so it will not travel with it.' });
  });
  const seen = new Set<string>();
  for (const medium of state.medium) {
    if (seen.has(medium)) issues.push({ path: 'medium', severity: 'info', message: `"${medium}" is listed twice.` });
    seen.add(medium);
  }
  return issues;
}

/**
 * A file's path relative to the project root, with forward slashes, or
 * `undefined` when it is outside the project.
 *
 * @param projectRoot - Absolute project root.
 * @param absolutePath - Absolute path of the picked file.
 * @returns The project-relative path, or `undefined` if the file is not inside the project.
 */
export function toProjectRelativePath(projectRoot: string, absolutePath: string): string | undefined {
  const relative = path.relative(path.resolve(projectRoot), path.resolve(absolutePath));
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return undefined;
  return relative.split(path.sep).join('/');
}
