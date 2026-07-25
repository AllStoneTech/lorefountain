import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cueSidecarPathFor, relocateCueSidecar, removeCueSidecar, updateCueSidecar } from '../../src/cues/sidecar';

describe('cueSidecarPathFor', () => {
  it('swaps the .fountain extension for .cues.json', () => {
    expect(cueSidecarPathFor('/scripts/1x01.fountain')).toBe('/scripts/1x01.cues.json');
  });
});

describe('updateCueSidecar', () => {
  let dir: string;
  let scriptPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lorefountain-sidecar-'));
    scriptPath = join(dir, '1x01.fountain');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes a sidecar file with the extracted cues', async () => {
    writeFileSync(scriptPath, 'SFX: metal groaning\n');
    await updateCueSidecar(scriptPath, 'SFX: metal groaning\n');

    const sidecarPath = cueSidecarPathFor(scriptPath);
    expect(existsSync(sidecarPath)).toBe(true);
    const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8'));
    expect(sidecar.script).toBe('1x01.fountain');
    expect(sidecar.cues).toEqual([{ type: 'sfx', description: 'metal groaning', line: 0 }]);
  });

  it('overwrites a stale sidecar when the script changes', async () => {
    await updateCueSidecar(scriptPath, 'SFX: first version\n');
    await updateCueSidecar(scriptPath, 'SFX: second version\n');

    const sidecar = JSON.parse(readFileSync(cueSidecarPathFor(scriptPath), 'utf8'));
    expect(sidecar.cues).toEqual([{ type: 'sfx', description: 'second version', line: 0 }]);
  });

  it('removes an existing sidecar once the script has no cues left', async () => {
    await updateCueSidecar(scriptPath, 'SFX: metal groaning\n');
    expect(existsSync(cueSidecarPathFor(scriptPath))).toBe(true);

    await updateCueSidecar(scriptPath, 'No cues here anymore.\n');
    expect(existsSync(cueSidecarPathFor(scriptPath))).toBe(false);
  });

  it('does not create a sidecar for a script with no cues', async () => {
    await updateCueSidecar(scriptPath, 'INT. THE ARK - NIGHT\n\nSANGO\nNo cues here.\n');
    expect(existsSync(cueSidecarPathFor(scriptPath))).toBe(false);
  });
});

describe('removeCueSidecar', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lorefountain-sidecar-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('is a no-op when no sidecar exists', async () => {
    await expect(removeCueSidecar(join(dir, '1x01.fountain'))).resolves.toBeUndefined();
  });
});

describe('relocateCueSidecar', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'lorefountain-sidecar-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('moves an existing sidecar to match the script\'s new path', async () => {
    const oldScriptPath = join(dir, '1x01.fountain');
    const newScriptPath = join(dir, '1x01-pilot.fountain');
    await updateCueSidecar(oldScriptPath, 'SFX: metal groaning\n');

    await relocateCueSidecar(oldScriptPath, newScriptPath);

    expect(existsSync(cueSidecarPathFor(oldScriptPath))).toBe(false);
    expect(existsSync(cueSidecarPathFor(newScriptPath))).toBe(true);
  });

  it('is a no-op when the script had no sidecar to begin with', async () => {
    const oldScriptPath = join(dir, '1x01.fountain');
    const newScriptPath = join(dir, '1x01-pilot.fountain');

    await expect(relocateCueSidecar(oldScriptPath, newScriptPath)).resolves.toBeUndefined();
    expect(existsSync(cueSidecarPathFor(newScriptPath))).toBe(false);
  });

  it('is a no-op when the rename does not change the sidecar path (e.g. only the folder moved is unrelated)', async () => {
    const scriptPath = join(dir, '1x01.fountain');
    await updateCueSidecar(scriptPath, 'SFX: metal groaning\n');

    await relocateCueSidecar(scriptPath, scriptPath);

    expect(existsSync(cueSidecarPathFor(scriptPath))).toBe(true);
  });
});
