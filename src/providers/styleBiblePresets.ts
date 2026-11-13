/**
 * Format presets for the guided style bible editor (ADR-0047): aspect ratios
 * for video/animation and trim sizes for printed or scrolling media, offered
 * as dropdown choices next to a free "Custom" entry.
 *
 * Every preset is guidance, not a rule: publishers, printers and platforms
 * vary, and the editor labels each one that way. `status` records whether the
 * numbers were checked against a published source when this list was written
 * (2026-11): `sourced` ones carry a `source` URL; `unsourced` ones are common
 * starting values that were NOT verified and should be confirmed with the
 * printer or platform. Pure data: no `vscode`, no I/O. Exports
 * {@link ASPECT_RATIO_PRESETS}, {@link TRIM_SIZE_PRESETS},
 * {@link formatKindFor}, {@link presetsFor} and {@link findPreset}.
 */

/** Whether a preset's numbers were checked against a published source. */
export type PresetStatus = 'sourced' | 'unsourced';

/** One dropdown choice. */
export interface FormatPreset {
  /** The text written to the file (e.g. `16:9`, `6.625x10.25 in`). */
  value: string;
  /** The dropdown label, naming what the numbers are for. */
  label: string;
  status: PresetStatus;
  /** A page the numbers were checked against, for `sourced` presets. */
  source?: string;
  /** Short caveat shown beside the dropdown. */
  note: string;
}

const GUIDANCE = 'Guidance only; confirm with your printer, publisher or platform.';
const UNSOURCED = 'Unsourced starting value, not verified against a specification. ' + GUIDANCE;

/** Aspect-ratio presets for video, animation and illustration frames. */
export const ASPECT_RATIO_PRESETS: readonly FormatPreset[] = [
  { value: '16:9', label: '16:9 widescreen video (HD/UHD)', status: 'unsourced', note: UNSOURCED },
  { value: '9:16', label: '9:16 vertical video (phone-first)', status: 'unsourced', note: UNSOURCED },
  { value: '1:1', label: '1:1 square', status: 'unsourced', note: UNSOURCED },
  { value: '4:3', label: '4:3 classic / standard-definition video', status: 'unsourced', note: UNSOURCED },
  { value: '4:5', label: '4:5 portrait (social feed)', status: 'unsourced', note: UNSOURCED },
  { value: '1.85:1', label: '1.85:1 theatrical flat', status: 'unsourced', note: UNSOURCED },
  { value: '2.39:1', label: '2.39:1 theatrical scope', status: 'unsourced', note: UNSOURCED },
  { value: '21:9', label: '21:9 ultra-wide', status: 'unsourced', note: UNSOURCED },
];

/** Trim-size presets for comics (printed or scrolling). */
export const COMIC_TRIM_PRESETS: readonly FormatPreset[] = [
  {
    value: '6.625x10.25 in',
    label: 'US standard comic (6.625 × 10.25 in)',
    status: 'sourced',
    source: 'https://www.printivity.com/insights/standard-comic-book-size',
    note: 'Modern US single-issue trim, consistent across printer guides. ' + GUIDANCE,
  },
  {
    value: '5x7.5 in',
    label: 'Manga tankōbon (about 5 × 7.5 in)',
    status: 'sourced',
    source: 'https://www.qinprinting.com/blog/what-size-should-a-comic-book-be/',
    note: 'English-language manga volumes; Japanese B6 is about 128 × 182 mm but sources differ. Varies by publisher. ' + GUIDANCE,
  },
  {
    value: '22x29 cm',
    label: 'European album (about 22 × 29 cm)',
    status: 'sourced',
    source: 'https://mycomicscollection.com/en/blog/comic-bag-sizes-french-vs-american-formats/',
    note: 'Franco-Belgian hardcover album; editions run from about 21 × 30 cm to 22.2 × 29.5 cm. ' + GUIDANCE,
  },
  {
    value: '800 px wide strip',
    label: 'Webtoon strip (under 800 px wide, slices under 1280 px tall)',
    status: 'sourced',
    source: 'https://webtoons-static.pstatic.net/creator101/en/pdf/Creators-Resource-Handbook-Updated.pdf',
    note: 'WEBTOON upload limit per image; many creators draw at double width and downscale. ' + GUIDANCE,
  },
  { value: '6x9 in', label: 'Graphic novel / trade paperback (6 × 9 in)', status: 'unsourced', note: UNSOURCED },
  { value: '8.5x11 in', label: 'Magazine / US letter (8.5 × 11 in)', status: 'unsourced', note: UNSOURCED },
];

/** Trim-size presets for illustrated books. */
export const BOOK_TRIM_PRESETS: readonly FormatPreset[] = [
  { value: '6x9 in', label: 'Trade book (6 × 9 in)', status: 'unsourced', note: UNSOURCED },
  { value: '8x10 in', label: 'Picture book portrait (8 × 10 in)', status: 'unsourced', note: UNSOURCED },
  { value: '8.5x11 in', label: 'Large picture book (8.5 × 11 in)', status: 'unsourced', note: UNSOURCED },
  { value: '8x8 in', label: 'Square picture book (8 × 8 in)', status: 'unsourced', note: UNSOURCED },
  { value: '8.5x8.5 in', label: 'Large square book (8.5 × 8.5 in)', status: 'unsourced', note: UNSOURCED },
  { value: '5.5x8.5 in', label: 'Digest (5.5 × 8.5 in)', status: 'unsourced', note: UNSOURCED },
];

/** Which kind of size control a medium gets in the form. */
export type FormatKind = 'aspect' | 'trim' | 'both' | 'note';

/**
 * Which controls a medium's format row shows: aspect ratio for time-based
 * media, trim size for print, both for a custom medium, a note only for audio.
 *
 * @param medium - The medium name, any case.
 * @returns The control set for that medium.
 */
export function formatKindFor(medium: string): FormatKind {
  switch (medium.trim().toLowerCase()) {
    case 'video':
    case 'animation':
      return 'aspect';
    case 'comic':
    case 'illustrated-book':
      return 'trim';
    case 'audio':
      return 'note';
    default:
      return 'both';
  }
}

/**
 * The presets for one control of one medium.
 *
 * @param medium - The medium name, any case.
 * @param field - `aspect_ratio` or `trim_size`.
 * @returns The matching preset list (empty when the medium has none).
 */
export function presetsFor(medium: string, field: 'aspect_ratio' | 'trim_size'): readonly FormatPreset[] {
  if (field === 'aspect_ratio') return ASPECT_RATIO_PRESETS;
  return medium.trim().toLowerCase() === 'illustrated-book' ? BOOK_TRIM_PRESETS : COMIC_TRIM_PRESETS;
}

/**
 * Find the preset whose value equals `value` (whitespace and case ignored).
 *
 * @param presets - A preset list.
 * @param value - The stored text.
 * @returns The preset, or `undefined` when the value is custom.
 */
export function findPreset(presets: readonly FormatPreset[], value: string): FormatPreset | undefined {
  const norm = (text: string): string => text.replace(/\s+/g, '').toLowerCase();
  return presets.find((preset) => norm(preset.value) === norm(value));
}
