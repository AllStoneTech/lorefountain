/**
 * Unit tests for narrated comics in the extension (ADR-0046): the derived
 * `.shots.json` is written, kept in step and removed against a real temp
 * directory; the default panel-tag prefix; and the index build reports
 * `duplicate-panel-tag` and `panels-not-derived` without failing, skips the
 * manifest check for derived shots, and leaves everything unchanged with
 * `comic.panelsAsShots` off. The derivation itself is tested in LoreFountain-Core.
 */

import * as fs from 'node:fs/promises';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveComicSettings } from 'lorefountain-core/comics/limits';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { panelTagPrefixFor } from '../../src/comics/tagPrefix';
import { buildIndexFromDisk, reindexFile } from '../../src/index/build';
import { createSqlJsIndexStore } from '../../src/index/sqlJsStore';
import type { IndexStore } from '../../src/index/store';
import { shotSidecarPathFor, updateShotSidecar } from '../../src/shots/sidecar';

const NARRATED = [
  'Title: The Harbor',
  'Production Code: 1x03',
  '',
  'INT. THE HARBOR - DAWN',
  '',
  'PAGE: 1',
  '',
  'PANEL: [harbor-wide] Wide shot of the harbor.',
  'DURATION: 4s',
  'MOVE: slow zoom in',
  '',
  'CAPTION: Dawn, 1925.',
  '',
  'PANEL: Close on the pier.',
  '',
  'WINONA',
  'We should go.',
  '',
].join('\n');

describe('panelTagPrefixFor', () => {
  it('uses the Production Code, else the file slug, else nothing', () => {
    expect(panelTagPrefixFor('/s/the-reveal.fountain', 'Title: A\nProduction Code: 1x03\n\nINT. A - DAY\n')).toBe('1x03');
    expect(panelTagPrefixFor('/s/The Reveal.fountain', 'INT. A - DAY\n')).toBe('the-reveal');
    expect(panelTagPrefixFor('/s/Épisode.fountain', 'INT. A - DAY\n')).toBeUndefined();
  });
});

describe('updateShotSidecar with panelsAsShots', () => {
  let dir: string;
  let scriptPath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'lorefountain-panel-shots-'));
    scriptPath = path.join(dir, 'ep.fountain');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes a derived sidecar, one shot per panel, tagged with the production code', async () => {
    const result = await updateShotSidecar(scriptPath, NARRATED, [], { panelsAsShots: true });
    expect(result.derivedFromPanels).toBe(true);

    const sidecar = JSON.parse(readFileSync(shotSidecarPathFor(scriptPath), 'utf8')) as {
      schema_version: number;
      shots: { tag: string; motion?: string; durationSeconds?: number; spoken: { caption?: boolean; speaker: string }[] }[];
    };
    expect(sidecar.schema_version).toBe(1);
    expect(sidecar.shots.map((shot) => shot.tag)).toEqual(['harbor-wide', '1x03-p1-2']);
    expect(sidecar.shots[0]).toMatchObject({ motion: 'ken-burns-in', durationSeconds: 4 });
    expect(sidecar.shots[0].spoken[0]).toMatchObject({ speaker: 'NARRATOR', caption: true });
  });

  it('writes nothing for a comic when the setting is off (print comic unchanged)', async () => {
    await updateShotSidecar(scriptPath, NARRATED, []);
    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(false);
    await updateShotSidecar(scriptPath, NARRATED, [], { panelsAsShots: false });
    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(false);
  });

  it('removes the derived sidecar when the setting is turned off or the pages go', async () => {
    await updateShotSidecar(scriptPath, NARRATED, [], { panelsAsShots: true });
    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(true);
    await updateShotSidecar(scriptPath, NARRATED, [], { panelsAsShots: false });
    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(false);

    await updateShotSidecar(scriptPath, NARRATED, [], { panelsAsShots: true });
    await updateShotSidecar(scriptPath, 'INT. A - DAY\n\nPlain action.\n', [], { panelsAsShots: true });
    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(false);
  });

  it('lets explicit SHOT: lines win and still writes the ordinary sidecar', async () => {
    const script = `${NARRATED}\nSHOT: [one-shot] WIDE\n`;
    const result = await updateShotSidecar(scriptPath, script, [], { panelsAsShots: true });
    expect(result.derivedFromPanels).toBeUndefined();
    const sidecar = JSON.parse(readFileSync(shotSidecarPathFor(scriptPath), 'utf8')) as { shots: { tag?: string }[] };
    expect(sidecar.shots.map((shot) => shot.tag)).toContain('one-shot');
    expect(sidecar.shots.map((shot) => shot.tag)).not.toContain('1x03-p1-2');
  });

  it('leaves a screenplay exactly as before with the setting on', async () => {
    const screenplay = 'INT. A - DAY\n\nSHOT: [a-wide] WIDE\n';
    const withSetting = await updateShotSidecar(scriptPath, screenplay, [], { panelsAsShots: true });
    const withoutSetting = await updateShotSidecar(scriptPath, screenplay, []);
    expect(withSetting).toEqual(withoutSetting);
  });
});

describe('index build with panelsAsShots', () => {
  let tmpRoot: string;
  let store: IndexStore;
  const folders = (root: string) => ({
    world: path.join(root, 'world'),
    glossary: path.join(root, 'world', 'glossary'),
    timeline: path.join(root, 'world', 'timeline'),
    scripts: path.join(root, 'scripts'),
  });

  async function write(relativePath: string, content: string): Promise<string> {
    const full = path.join(tmpRoot, relativePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
    return full;
  }

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lorefountain-panel-build-'));
    store = await createSqlJsIndexStore();
  });

  afterEach(async () => {
    store.dispose();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('writes the derived sidecar, counts the shots, and does not warn about unmapped panel tags', async () => {
    const scriptPath = await write('scripts/ep.fountain', NARRATED);
    const summary = await buildIndexFromDisk(store, folders(tmpRoot), { shots: {} }, resolveComicSettings({ panelsAsShots: true }));

    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(true);
    expect(summary.shotStats).toEqual({ shots: 2, untagged: 0 });
    const warnings = summary.warnings.find((entry) => entry.filePath === scriptPath)?.warnings ?? [];
    expect(warnings.map((w) => w.message).join('\n')).not.toContain('has no matching entry');
  });

  it('does not write a shot sidecar for the same comic with the default settings', async () => {
    const scriptPath = await write('scripts/ep.fountain', NARRATED);
    const summary = await buildIndexFromDisk(store, folders(tmpRoot));
    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(false);
    expect(summary.shotStats).toEqual({ shots: 0, untagged: 0 });
  });

  it('warns about a repeated panel tag and notes an empty panel description, neither failing', async () => {
    const script = ['PAGE: 1', '', 'PANEL: [dup-a] one', '', 'PANEL: [dup-a] two', '', 'PANEL:', ''].join('\n');
    const scriptPath = await write('scripts/ep.fountain', script);
    const summary = await buildIndexFromDisk(store, folders(tmpRoot), {}, resolveComicSettings({ panelsAsShots: true }));

    const warnings = summary.warnings.find((entry) => entry.filePath === scriptPath)?.warnings ?? [];
    expect(warnings.some((w) => 'code' in w && w.code === 'duplicate-panel-tag')).toBe(true);
    const notes = summary.notes.find((entry) => entry.filePath === scriptPath)?.notes ?? [];
    const missing = notes.find((n) => 'code' in n && n.code === 'missing-panel-description');
    expect(missing?.message).toContain('comic.panelsAsShots');
    expect(summary.malformed).toEqual([]);
  });

  it('notes that panels are not derived when explicit SHOT: lines exist', async () => {
    const scriptPath = await write('scripts/ep.fountain', `${NARRATED}\nSHOT: [only] WIDE\n`);
    const summary = await buildIndexFromDisk(store, folders(tmpRoot), {}, resolveComicSettings({ panelsAsShots: true }));
    const notes = summary.notes.find((entry) => entry.filePath === scriptPath)?.notes ?? [];
    expect(notes.some((n) => 'code' in n && n.code === 'panels-not-derived')).toBe(true);
  });

  it('reindexFile on save follows the setting it is given', async () => {
    const scriptPath = await write('scripts/ep.fountain', NARRATED);
    await reindexFile(store, scriptPath, 'script', { comic: resolveComicSettings({ panelsAsShots: true }) });
    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(true);
    await reindexFile(store, scriptPath, 'script');
    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(false);
  });
});
