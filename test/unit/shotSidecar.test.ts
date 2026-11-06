/**
 * Unit tests for `shots/sidecar.ts`: the `.shots.json` file is written,
 * rewritten, removed and relocated against a real temp directory, mirroring
 * `sidecar.test.ts` for the cue sidecar.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  relocateShotSidecar,
  removeShotSidecar,
  shotSidecarPathFor,
  updateShotSidecar,
} from '../../src/shots/sidecar';

describe('shotSidecarPathFor', () => {
  it('swaps the .fountain extension for .shots.json', () => {
    expect(shotSidecarPathFor('/scripts/1x01.fountain')).toBe('/scripts/1x01.shots.json');
  });
});

describe('updateShotSidecar', () => {
  let dir: string;
  let scriptPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lorefountain-shot-sidecar-'));
    scriptPath = join(dir, '1x01.fountain');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes a sidecar with the standard header and the shots', async () => {
    const result = await updateShotSidecar(scriptPath, 'INT. A - DAY\n\nSHOT: [a-wide] WIDE\n', []);
    expect(result.shots).toHaveLength(1);

    const sidecar = JSON.parse(readFileSync(shotSidecarPathFor(scriptPath), 'utf8'));
    expect(sidecar.schema_version).toBe(1);
    expect(sidecar.script).toBe('1x01.fountain');
    expect(sidecar.generated_by).toMatch(/do not edit by hand/);
    expect(sidecar.shots).toEqual([
      {
        scene: 1,
        shot: 1,
        tag: 'a-wide',
        sceneHeading: 'INT. A - DAY',
        intExt: 'INT',
        timeOfDay: 'DAY',
        setting: ['A'],
        locations: [],
        description: 'WIDE',
        lines: { start: 2, end: 2 },
        spoken: [],
        action: [],
        onScreen: [],
        entities: [],
        cues: [],
      },
    ]);
  });

  it('overwrites a stale sidecar when the script changes', async () => {
    await updateShotSidecar(scriptPath, 'INT. A - DAY\n\nSHOT: first\n', []);
    await updateShotSidecar(scriptPath, 'INT. A - DAY\n\nSHOT: second\n', []);
    const sidecar = JSON.parse(readFileSync(shotSidecarPathFor(scriptPath), 'utf8'));
    expect(sidecar.shots.map((shot: { description: string }) => shot.description)).toEqual(['second']);
  });

  it('removes the sidecar once the script has no explicit shots', async () => {
    await updateShotSidecar(scriptPath, 'INT. A - DAY\n\nSHOT: WIDE\n', []);
    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(true);

    const result = await updateShotSidecar(scriptPath, 'INT. A - DAY\n\nMara waits.\n', []);
    expect(result.hasExplicitShots).toBe(false);
    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(false);
  });

  it('writes nothing for a script that never had shots', async () => {
    await updateShotSidecar(scriptPath, 'INT. A - DAY\n\nMara waits.\n', []);
    expect(existsSync(shotSidecarPathFor(scriptPath))).toBe(false);
  });
});

describe('removeShotSidecar / relocateShotSidecar', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lorefountain-shot-sidecar-move-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('is safe to remove a sidecar that does not exist', async () => {
    await expect(removeShotSidecar(join(dir, 'missing.fountain'))).resolves.toBeUndefined();
  });

  it('moves the sidecar to follow a renamed script', async () => {
    const oldPath = join(dir, 'old.fountain');
    const newPath = join(dir, 'new.fountain');
    await updateShotSidecar(oldPath, 'INT. A - DAY\n\nSHOT: WIDE\n', []);

    await relocateShotSidecar(oldPath, newPath);
    expect(existsSync(shotSidecarPathFor(oldPath))).toBe(false);
    expect(existsSync(shotSidecarPathFor(newPath))).toBe(true);
  });

  it('is safe to relocate when there is no sidecar', async () => {
    await expect(relocateShotSidecar(join(dir, 'a.fountain'), join(dir, 'b.fountain'))).resolves.toBeUndefined();
  });
});
