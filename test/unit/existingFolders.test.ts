import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectExistingCoreFolders } from '../../src/config/existingFolders';

describe('detectExistingCoreFolders', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'lorefountain-existing-folders-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports both as false when neither exists', async () => {
    const result = await detectExistingCoreFolders(join(root, 'world'), join(root, 'scripts'));
    expect(result).toEqual({ world: false, scripts: false });
  });

  it('reports world as true when only world exists', async () => {
    mkdirSync(join(root, 'world'));
    const result = await detectExistingCoreFolders(join(root, 'world'), join(root, 'scripts'));
    expect(result).toEqual({ world: true, scripts: false });
  });

  it('reports both as true when both exist', async () => {
    mkdirSync(join(root, 'world'));
    mkdirSync(join(root, 'scripts'));
    const result = await detectExistingCoreFolders(join(root, 'world'), join(root, 'scripts'));
    expect(result).toEqual({ world: true, scripts: true });
  });
});
