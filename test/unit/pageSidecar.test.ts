/**
 * Unit tests for `comics/sidecar.ts`: the `.pages.json` file is written,
 * rewritten, removed and relocated against a real temp directory, mirroring
 * `shotSidecar.test.ts`. The page map itself is tested in LoreFountain-Core.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePageSidecarText } from 'lorefountain-core/comics/pageSidecar';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  pageSidecarPathFor,
  relocatePageSidecar,
  removePageSidecar,
  updatePageSidecar,
} from '../../src/comics/sidecar';

const COMIC = [
  'INT. THE HARBOR - DAWN',
  '',
  'PAGE: 1',
  '',
  'PANEL: Wide shot of the harbor. WINONA stands on the pier.',
  '',
  'CAPTION: Dawn, 1925.',
  '',
  'WINONA',
  'We should go.',
  '',
].join('\n');

describe('pageSidecarPathFor', () => {
  it('swaps the .fountain extension for .pages.json', () => {
    expect(pageSidecarPathFor('/scripts/issue1.fountain')).toBe('/scripts/issue1.pages.json');
  });
});

describe('updatePageSidecar', () => {
  let dir: string;
  let scriptPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lorefountain-page-sidecar-'));
    scriptPath = join(dir, 'issue1.fountain');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes a schema-valid sidecar with the standard header, totals and pages', async () => {
    const result = await updatePageSidecar(scriptPath, COMIC, [{ id: 'winona', type: 'character', names: ['Winona'] }]);
    expect(result.hasPages).toBe(true);

    const text = readFileSync(pageSidecarPathFor(scriptPath), 'utf8');
    expect(text.endsWith('\n')).toBe(true);
    const parsed = parsePageSidecarText(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.sidecar.schema_version).toBe(1);
    expect(parsed.sidecar.script).toBe('issue1.fountain');
    expect(parsed.sidecar.generated_by).toMatch(/do not edit by hand/);
    expect(parsed.sidecar.totals).toMatchObject({ pages: 1, panels: 1, balloons: 1, captions: 1 });
    expect(parsed.sidecar.pages[0]?.panels[0]?.entities).toEqual(['winona']);
  });

  it('writes nothing for a script with no explicit PAGE:', async () => {
    const result = await updatePageSidecar(scriptPath, 'INT. A - DAY\n\nSHOT: WIDE\n', []);
    expect(result.hasPages).toBe(false);
    expect(existsSync(pageSidecarPathFor(scriptPath))).toBe(false);
  });

  it('rewrites on every call and removes the file when the pages disappear', async () => {
    await updatePageSidecar(scriptPath, COMIC, []);
    await updatePageSidecar(scriptPath, `${COMIC}\nPAGE: 2\n\nPANEL: Another view.\n`, []);
    const twoPages = parsePageSidecarText(readFileSync(pageSidecarPathFor(scriptPath), 'utf8'));
    expect(twoPages.ok && twoPages.sidecar.totals.pages).toBe(2);

    await updatePageSidecar(scriptPath, 'INT. A - DAY\n\nPlain action.\n', []);
    expect(existsSync(pageSidecarPathFor(scriptPath))).toBe(false);
  });

  it('returns issues for the caller to report, without failing', async () => {
    const result = await updatePageSidecar(scriptPath, `${COMIC}\nPAGE: 1\n\nPANEL: Again.\n`, []);
    expect(result.issues.map((issue) => issue.code)).toContain('duplicate-page-number');
    expect(existsSync(pageSidecarPathFor(scriptPath))).toBe(true);
  });
});

describe('removePageSidecar', () => {
  it('is safe when there is no sidecar', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lorefountain-page-sidecar-'));
    try {
      await expect(removePageSidecar(join(dir, 'none.fountain'))).resolves.toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('relocatePageSidecar', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lorefountain-page-sidecar-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('moves the sidecar to match a renamed script', async () => {
    const oldPath = join(dir, 'old.fountain');
    const newPath = join(dir, 'new.fountain');
    writeFileSync(pageSidecarPathFor(oldPath), '{}\n');

    await relocatePageSidecar(oldPath, newPath);

    expect(existsSync(pageSidecarPathFor(oldPath))).toBe(false);
    expect(existsSync(pageSidecarPathFor(newPath))).toBe(true);
  });

  it('is safe when there is no sidecar, or the path is unchanged', async () => {
    const oldPath = join(dir, 'old.fountain');
    await expect(relocatePageSidecar(oldPath, join(dir, 'new.fountain'))).resolves.toBeUndefined();
    await expect(relocatePageSidecar(oldPath, oldPath)).resolves.toBeUndefined();
  });
});
