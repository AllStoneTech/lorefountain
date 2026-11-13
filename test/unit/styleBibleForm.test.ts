/**
 * Unit tests for the guided style bible form model
 * (`src/providers/styleBibleForm.ts`) and its presets
 * (`src/providers/styleBiblePresets.ts`): reading text into form state, writing
 * it back minimally, byte-stability, preservation of unknown content, the
 * quoted-hex guarantee and the inline validation messages.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseStyleBibleFile } from 'lorefountain-core/model/styleBible';
import {
  applyFormStateToText,
  BODY_SECTIONS,
  normalizeHex,
  styleBibleToFormState,
  styleFormStateSchema,
  toProjectRelativePath,
  validateFormState,
  type StyleFormState,
} from '../../src/providers/styleBibleForm';
import {
  ASPECT_RATIO_PRESETS,
  BOOK_TRIM_PRESETS,
  COMIC_TRIM_PRESETS,
  findPreset,
  formatKindFor,
  presetsFor,
} from '../../src/providers/styleBiblePresets';

const TEMPLATE = readFileSync(join(__dirname, '..', '..', 'resources', 'style.lf.md'), 'utf8').replaceAll('{{PROJECT_NAME}}', 'Harbor');

const FULL = [
  '---',
  'medium: [comic, video]',
  'art_style: Inked 1920s pulp',
  'palette:',
  '  - "Harbor teal #2a7f8e"',
  '  - "#d9a441"',
  '  - Bone white',
  'reference_images:',
  '  - assets/style/mood.png',
  'avoid: [photorealism, 3D render]',
  'format:',
  '  comic: { trim_size: 6.625x10.25 in, bleed: 0.125 in }',
  '  video: { aspect_ratio: "16:9" }',
  'lettering: Hand-lettered caps',
  'era_reference: 1925 pulp covers',
  'custom_field: keep me',
  '---',
  '',
  '# Harbor: Style Bible',
  '',
  'Intro paragraph.',
  '',
  '## Overall look',
  '',
  'Ink and flat colour.',
  '',
  '## Lettering (comic)',
  '',
  'Rounded balloons.',
  '',
  '## Palette history',
  '',
  'Something the form does not own.',
  '',
].join('\n');

function read(text: string): StyleFormState {
  const result = styleBibleToFormState(text);
  if (!result.ok) throw new Error(`expected a readable file: ${result.message}`);
  return result.state;
}

function write(text: string, state: StyleFormState): string {
  const result = applyFormStateToText(text, state);
  if (!result.ok) throw new Error(`expected a writable change: ${result.message}`);
  return result.text;
}

describe('styleBibleToFormState', () => {
  it('reads every frontmatter field and the owned body sections', () => {
    const state = read(FULL);
    expect(state.medium).toEqual(['comic', 'video']);
    expect(state.artStyle).toBe('Inked 1920s pulp');
    expect(state.palette).toEqual([
      { name: 'Harbor teal', hex: '#2a7f8e', raw: 'Harbor teal #2a7f8e' },
      { name: '', hex: '#d9a441', raw: '#d9a441' },
      { name: 'Bone white', hex: '', raw: 'Bone white' },
    ]);
    expect(state.referenceImages).toEqual(['assets/style/mood.png']);
    expect(state.avoid).toEqual(['photorealism', '3D render']);
    expect(state.lettering).toEqual(['Hand-lettered caps']);
    expect(state.eraReference).toBe('1925 pulp covers');
    expect(state.format).toEqual([
      { medium: 'comic', aspectRatio: '', trimSize: '6.625x10.25 in', note: '' },
      { medium: 'video', aspectRatio: '16:9', trimSize: '', note: '' },
    ]);
    expect(state.sections.overall).toBe('Ink and flat colour.');
    expect(state.sections.lettering).toBe('Rounded balloons.');
    expect(state.sections.color).toBe('');
  });

  it('puts the title, intro and unknown headings in the additional notes so nothing is lost', () => {
    const { additional } = read(FULL);
    expect(additional).toContain('# Harbor: Style Bible');
    expect(additional).toContain('Intro paragraph.');
    expect(additional).toContain('## Palette history');
    expect(additional).toContain('Something the form does not own.');
    expect(additional).not.toContain('Ink and flat colour.');
  });

  it('shows scaffold hint comments as empty sections', () => {
    const state = read(TEMPLATE);
    for (const def of BODY_SECTIONS) expect(state.sections[def.key]).toBe('');
    expect(state.medium).toEqual([]);
  });

  it('treats a lone string as a list of one', () => {
    const state = read('---\nmedium: comic\navoid: gore\n---\n');
    expect(state.medium).toEqual(['comic']);
    expect(state.avoid).toEqual(['gore']);
  });

  it('reports a malformed or schema-invalid file instead of a state', () => {
    expect(styleBibleToFormState('---\nart_style: [oops\n---\n').ok).toBe(false);
    const invalid = styleBibleToFormState('---\npalette: 7\n---\n');
    expect(invalid.ok).toBe(false);
  });

  it('does not split on ## lines inside a code fence', () => {
    const state = read('---\n---\n\n## Overall look\n\n```\n## not a heading\n```\n');
    expect(state.sections.overall).toContain('## not a heading');
    expect(state.additional).toBe('');
  });
});

describe('applyFormStateToText: stability', () => {
  it('returns every kind of file byte-for-byte when nothing changed', () => {
    for (const text of [FULL, TEMPLATE, '---\nmedium: comic\n---\n', '# just prose\n', '---\n---\n\nBody\n', '---\r\nart_style: x\r\n---\r\n\r\nBody\r\n']) {
      expect(write(text, read(text))).toBe(text);
    }
  });

  it('keeps the original frontmatter text, comments included, when only the body changes', () => {
    const state = read(TEMPLATE);
    state.sections.overall = 'Soft watercolour.';
    const out = write(TEMPLATE, state);
    expect(out.startsWith(TEMPLATE.slice(0, TEMPLATE.indexOf('---\n\n') + 4))).toBe(true);
    expect(out).toContain('# medium: [comic, video]');
    expect(out).toContain('## Overall look\n\nSoft watercolour.');
    expect(out).toContain('## Characters');
    expect(read(out).sections.overall).toBe('Soft watercolour.');
  });

  it('is stable after the first write: reading and re-applying changes nothing', () => {
    const state = read(FULL);
    state.artStyle = 'Soft watercolour';
    const once = write(FULL, state);
    expect(write(once, read(once))).toBe(once);
  });
});

describe('applyFormStateToText: frontmatter', () => {
  it('preserves unknown frontmatter fields and per-medium keys the form does not own', () => {
    const state = read(FULL);
    state.artStyle = 'Soft watercolour';
    const out = write(FULL, state);
    const parsed = parseStyleBibleFile(out, 'x');
    expect(parsed.ok && parsed.style.frontmatter.custom_field).toBe('keep me');
    expect(parsed.ok && parsed.style.frontmatter.art_style).toBe('Soft watercolour');
    const comic = parsed.ok ? (parsed.style.frontmatter.format?.comic as Record<string, unknown>) : {};
    expect(comic.bleed).toBe('0.125 in');
  });

  it('leaves fields the writer did not touch exactly as written (a lone string stays a string)', () => {
    const text = '---\nmedium: comic\nlettering: Caps\nart_style: A\n---\n';
    const state = read(text);
    state.artStyle = 'B';
    const out = write(text, state);
    expect(out).toContain('medium: comic\n');
    expect(out).toContain('lettering: Caps\n');
    expect(out).toContain('art_style: B\n');
  });

  it('always writes hex colours quoted, so the # comment trap cannot happen', () => {
    const state = read('---\nart_style: x\n---\n');
    state.palette = [
      { name: '', hex: '#D9A441' },
      { name: 'Harbor teal', hex: '2A7F8E' },
      { name: 'Bone white', hex: '' },
    ];
    const out = write('---\nart_style: x\n---\n', state);
    expect(out).toMatch(/- "#d9a441"/);
    expect(out).toMatch(/- "?Harbor teal #2a7f8e"?/);
    expect(out).not.toMatch(/- #/);
    const parsed = parseStyleBibleFile(out, 'x');
    expect(parsed.ok && parsed.style.frontmatter.palette).toEqual(['#d9a441', 'Harbor teal #2a7f8e', 'Bone white']);
  });

  it('writes a typed non-hex value as part of the name rather than dropping it', () => {
    const text = '---\nart_style: x\n---\n';
    const state = read(text);
    state.palette = [{ name: 'Sea', hex: 'blue-ish' }];
    expect(parseStyleBibleFile(write(text, state), 'x')).toMatchObject({ ok: true, style: { frontmatter: { palette: ['Sea blue-ish'] } } });
  });

  it('writes back an untouched palette row exactly as it was', () => {
    const state = read(FULL);
    state.palette[2].name = 'Cream';
    const parsed = parseStyleBibleFile(write(FULL, state), 'x');
    expect(parsed.ok && parsed.style.frontmatter.palette).toEqual(['Harbor teal #2a7f8e', '#d9a441', 'Cream']);
  });

  it('removes a cleared field and the key for an empty list; no medium means all media', () => {
    const state = read(FULL);
    state.medium = [];
    state.eraReference = '';
    state.avoid = [];
    const parsed = parseStyleBibleFile(write(FULL, state), 'x');
    expect(parsed.ok && 'medium' in parsed.style.frontmatter).toBe(false);
    expect(parsed.ok && 'era_reference' in parsed.style.frontmatter).toBe(false);
    expect(parsed.ok && 'avoid' in parsed.style.frontmatter).toBe(false);
  });

  it('adds new fields to a file that had none, from a file with no frontmatter at all', () => {
    const text = '# Look\n\nWatercolour.\n';
    const state = read(text);
    state.medium = ['comic'];
    state.referenceImages = ['assets/a.png'];
    const out = write(text, state);
    expect(out.startsWith('---\n')).toBe(true);
    const parsed = parseStyleBibleFile(out, 'x');
    expect(parsed.ok && parsed.style.frontmatter.medium).toEqual(['comic']);
    expect(parsed.ok && parsed.style.body).toContain('Watercolour.');
  });

  it('builds per-medium format rows: note-only as a string, sizes as an object, blank rows dropped', () => {
    const text = '---\nart_style: x\n---\n';
    const state = read(text);
    state.format = [
      { medium: 'audio', aspectRatio: '', trimSize: '', note: 'Stereo, 48 kHz' },
      { medium: 'video', aspectRatio: '16:9', trimSize: '', note: '' },
      { medium: 'comic', aspectRatio: '', trimSize: '', note: '' },
    ];
    const parsed = parseStyleBibleFile(write(text, state), 'x');
    expect(parsed.ok && parsed.style.frontmatter.format).toEqual({ audio: 'Stereo, 48 kHz', video: { aspect_ratio: '16:9' } });
  });

  it('keeps unknown keys of a changed format object', () => {
    const state = read(FULL);
    state.format[0].trimSize = '5x7.5 in';
    const parsed = parseStyleBibleFile(write(FULL, state), 'x');
    expect(parsed.ok && parsed.style.frontmatter.format?.comic).toEqual({ trim_size: '5x7.5 in', bleed: '0.125 in' });
    expect(parsed.ok && parsed.style.frontmatter.format?.video).toEqual({ aspect_ratio: '16:9' });
  });
});

describe('applyFormStateToText: body', () => {
  it('rewrites only the edited section and keeps the rest, including unknown headings', () => {
    const state = read(FULL);
    state.sections.lettering = 'Square balloons.';
    const out = write(FULL, state);
    expect(out).toContain('## Overall look\n\nInk and flat colour.');
    expect(out).toContain('## Lettering (comic)\n\nSquare balloons.');
    expect(out).toContain('## Palette history\n\nSomething the form does not own.');
    expect(out).toContain('Intro paragraph.');
    expect(out).toContain('custom_field: keep me');
  });

  it('creates a missing section with its canonical heading and removes a cleared one', () => {
    const state = read(FULL);
    state.sections.color = 'Teal and amber.';
    state.sections.lettering = '';
    const out = write(FULL, state);
    expect(out).toContain('## Color & light\n\nTeal and amber.');
    expect(out).not.toContain('Lettering (comic)');
  });

  it('replaces the additional notes as a whole when edited, keeping the owned sections', () => {
    const state = read(FULL);
    state.additional = 'New notes only.';
    const out = write(FULL, state);
    expect(out).toContain('New notes only.');
    expect(out).not.toContain('Palette history');
    expect(out).not.toContain('Intro paragraph.');
    expect(out).toContain('## Overall look\n\nInk and flat colour.');
  });

  it('accepts heading aliases and keeps the original heading line', () => {
    const text = '---\n---\n\n## Colour & Light\n\nWarm.\n';
    const state = read(text);
    expect(state.sections.color).toBe('Warm.');
    state.sections.color = 'Cool.';
    expect(write(text, state)).toContain('## Colour & Light\n\nCool.');
  });

  it('always yields a file the Core schema accepts', () => {
    const state = read(FULL);
    state.palette.push({ name: 'x: y', hex: '' });
    state.avoid.push('a, b: c # d');
    const out = write(FULL, state);
    expect(parseStyleBibleFile(out, 'x').ok).toBe(true);
  });
});

describe('form state runtime validation', () => {
  it('accepts a real state and rejects a malformed one', () => {
    expect(styleFormStateSchema.safeParse(read(FULL)).success).toBe(true);
    expect(styleFormStateSchema.safeParse({ medium: 'comic' }).success).toBe(false);
  });
});

describe('validateFormState', () => {
  it('flags an invalid hex and notes empty rows', () => {
    const state = read('---\n---\n');
    state.palette = [
      { name: 'Sea', hex: 'blue' },
      { name: 'Ok', hex: '#fff' },
      { name: '', hex: '' },
    ];
    const issues = validateFormState(state);
    expect(issues.find((i) => i.path === 'palette.0')?.severity).toBe('error');
    expect(issues.find((i) => i.path === 'palette.1')).toBeUndefined();
    expect(issues.find((i) => i.path === 'palette.2')?.severity).toBe('info');
  });

  it('warns about a missing or outside reference image only', () => {
    const state = read('---\n---\n');
    state.referenceImages = ['a.png', 'b.png', 'c.png', 'https://x/y.png'];
    const issues = validateFormState(state, { 'a.png': 'ok', 'b.png': 'missing', 'c.png': 'outside', 'https://x/y.png': 'remote' });
    expect(issues.map((i) => [i.path, i.severity])).toEqual([
      ['reference_images.1', 'warning'],
      ['reference_images.2', 'warning'],
    ]);
  });
});

describe('helpers', () => {
  it('normalizes hex typed by hand', () => {
    expect(normalizeHex(' D9A441 ')).toBe('#d9a441');
    expect(normalizeHex('#ABC')).toBe('#abc');
    expect(normalizeHex('teal')).toBe('teal');
    expect(normalizeHex('')).toBe('');
  });

  it('makes a project-relative forward-slash path, and refuses a path outside the project', () => {
    const root = join('C:', 'proj');
    expect(toProjectRelativePath(root, join(root, 'assets', 'style', 'a.png'))).toBe('assets/style/a.png');
    expect(toProjectRelativePath(root, join('C:', 'other', 'a.png'))).toBeUndefined();
    expect(toProjectRelativePath(root, root)).toBeUndefined();
  });
});

describe('presets', () => {
  it('offers the right controls per medium', () => {
    expect(formatKindFor('video')).toBe('aspect');
    expect(formatKindFor('Comic')).toBe('trim');
    expect(formatKindFor('audio')).toBe('note');
    expect(formatKindFor('hologram')).toBe('both');
  });

  it('labels every preset as sourced (with a URL) or unsourced, and never leaves a value blank', () => {
    for (const preset of [...ASPECT_RATIO_PRESETS, ...COMIC_TRIM_PRESETS, ...BOOK_TRIM_PRESETS]) {
      expect(preset.value.trim()).not.toBe('');
      expect(preset.note).toMatch(/guidance|Guidance/);
      if (preset.status === 'sourced') expect(preset.source).toMatch(/^https:\/\//);
      else expect(preset.note).toMatch(/Unsourced/);
    }
    expect(COMIC_TRIM_PRESETS.filter((p) => p.status === 'sourced').map((p) => p.value)).toEqual([
      '6.625x10.25 in',
      '5x7.5 in',
      '22x29 cm',
      '800 px wide strip',
    ]);
  });

  it('picks the preset list by medium and field, and finds a stored value ignoring spacing and case', () => {
    expect(presetsFor('video', 'aspect_ratio')).toBe(ASPECT_RATIO_PRESETS);
    expect(presetsFor('comic', 'trim_size')).toBe(COMIC_TRIM_PRESETS);
    expect(presetsFor('illustrated-book', 'trim_size')).toBe(BOOK_TRIM_PRESETS);
    expect(findPreset(COMIC_TRIM_PRESETS, '6.625X10.25 IN')?.label).toContain('US standard comic');
    expect(findPreset(COMIC_TRIM_PRESETS, '7x7 in')).toBeUndefined();
  });
});
