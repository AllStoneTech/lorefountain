/**
 * Unit tests for `comics/pagesTree.ts`: sidecars are generated from real comic
 * text through Core's page map, then turned into Scripts-view display models.
 */

import { buildPageMap } from 'lorefountain-core/comics/pageMap';
import { buildPageSidecar } from 'lorefountain-core/comics/pageSidecar';
import { describe, expect, it } from 'vitest';
import { PANEL_DESCRIPTION_MAX_CHARS, buildPagesModel, readPagesModel } from '../../src/comics/pagesTree';

function modelFor(text: string) {
  const sidecar = buildPageSidecar('t.fountain', buildPageMap(text, []));
  return { sidecar, model: buildPagesModel(sidecar) };
}

const LONG = 'A very long panel description '.repeat(10).trim();

const COMIC = [
  'PAGE: 1 (SPLASH)',
  '',
  'PANEL: Wide shot of the harbor.',
  '',
  'CAPTION: Dawn, 1925.',
  '',
  'PAGE: 2-3 (SPREAD)',
  '',
  `PANEL: ${LONG}`,
  '',
  'PAGE: INSIDE FRONT COVER',
  '',
  'PANEL: Cover.',
  '',
].join('\n');

describe('pagesTree', () => {
  it('returns undefined for a script with no pages', () => {
    expect(modelFor('INT. ROOM - DAY\n\nSomeone walks in.\n').model).toBeUndefined();
  });

  it('returns undefined for missing, malformed or invalid sidecar text', () => {
    expect(readPagesModel('')).toBeUndefined();
    expect(readPagesModel('{not json')).toBeUndefined();
    expect(readPagesModel('{"schema_version":1}')).toBeUndefined();
    expect(readPagesModel('{"schema_version":99}')).toBeUndefined();
  });

  it('labels pages, with and without flags', () => {
    const { model } = modelFor(COMIC);
    expect(model?.pages.map((p) => p.label)).toEqual(['Page 1', 'Pages 2-3', 'INSIDE FRONT COVER']);
    expect(model?.pages[0].description).toMatch(/^SPLASH · 1 panel/);
    expect(model?.pages[1].description).toMatch(/^SPREAD/);
    expect(model?.pages[2].description).not.toMatch(/SPLASH|SPREAD/);
    expect(model?.label).toBe('Pages');
    expect(model?.description).toContain('3 pages');
  });

  it('points pages and panels at their 0-based first line', () => {
    const { model, sidecar } = modelFor(COMIC);
    expect(model?.pages[0].line).toBe(sidecar.pages[0].lines.start);
    expect(model?.pages[0].panels[0].line).toBe(sidecar.pages[0].panels[0].lines.start);
  });

  it('truncates long panel descriptions', () => {
    const { model } = modelFor(COMIC);
    const label = model!.pages[1].panels[0].label;
    expect(label.startsWith('Panel 1 — ')).toBe(true);
    expect(label.endsWith('…')).toBe(true);
    expect(label.length).toBeLessThanOrEqual('Panel 1 — '.length + PANEL_DESCRIPTION_MAX_CHARS + 1);
  });

  it('keeps short descriptions whole and counts lettering in the panel description', () => {
    const { model } = modelFor(COMIC);
    expect(model!.pages[0].panels[0].label).toBe('Panel 1 — Wide shot of the harbor.');
  });

  it('omits zero counts and shows a bare label when a panel has no description', () => {
    const { sidecar } = modelFor(COMIC);
    const panel = sidecar.pages[0].panels[0];
    const stripped = {
      ...sidecar,
      pages: [
        {
          ...sidecar.pages[0],
          counts: { panels: 0, balloons: 0, captions: 0, sfx: 0, words: 0 },
          panels: [{ ...panel, description: undefined, counts: { balloons: 0, captions: 0, sfx: 0, words: 0 } }],
        },
      ],
    };
    const model = buildPagesModel(stripped);
    expect(model?.pages[0].description).toBe('SPLASH');
    expect(model?.pages[0].panels[0].label).toBe('Panel 1');
    expect(model?.pages[0].panels[0].description).toBe('');
  });

  it('surfaces issues on the page and panel containing their line', () => {
    const { sidecar } = modelFor(COMIC);
    const page = sidecar.pages[1];
    const withIssue = {
      ...sidecar,
      issues: [
        { code: 'x', severity: 'warning' as const, line: page.panels[0].lines.start, path: 'lines[0]', message: 'Out of order.' },
        { code: 'y', severity: 'info' as const, line: sidecar.pages[2].lines.start, path: 'lines[0]', message: 'Gap.' },
      ],
    };
    const model = buildPagesModel(withIssue)!;
    expect(model.pages[1].hasWarning).toBe(true);
    expect(model.pages[1].iconId).toBe('warning');
    expect(model.pages[1].panels[0].hasWarning).toBe(true);
    expect(model.pages[1].tooltip).toContain('Out of order.');
    expect(model.pages[1].description).toContain('1 warning');
    expect(model.pages[0].hasWarning).toBe(false);
    expect(model.pages[2].hasWarning).toBe(false);
    expect(model.pages[2].description).toContain('1 note');
    expect(model.description).toContain('1 warning');
  });

  it('is unaffected by a long prose script with no sidecar', () => {
    const prose = Array.from({ length: 117 }, (_, i) => `CHAPTER ${i + 1}\n\nOnce upon a time.\n`).join('\n');
    expect(modelFor(prose).model).toBeUndefined();
  });
});
