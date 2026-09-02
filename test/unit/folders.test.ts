/**
 * Unit tests for workspace folder-path resolution.
 * Covers defaults, overrides, whitespace/empty-string fallback, and the fixed
 * world/{glossary,timeline,notes} subfolder relationship.
 */

import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { resolveWorkspaceFolders, DEFAULT_FOLDERS } from '../../src/config/folders';

const ROOT = path.join('C:', 'writers', 'orun');

describe('resolveWorkspaceFolders', () => {
  it('applies documented defaults when no settings are given', () => {
    const folders = resolveWorkspaceFolders(ROOT);
    expect(folders.scripts).toBe(path.join(ROOT, DEFAULT_FOLDERS.scripts));
    expect(folders.world).toBe(path.join(ROOT, DEFAULT_FOLDERS.world));
    expect(folders.imports).toBe(path.join(ROOT, DEFAULT_FOLDERS.imports));
    expect(folders.assets).toBe(path.join(ROOT, DEFAULT_FOLDERS.assets));
  });

  it('derives glossary, timeline, and notes as fixed subfolders of world', () => {
    const folders = resolveWorkspaceFolders(ROOT, { world: 'lore' });
    expect(folders.glossary).toBe(path.join(ROOT, 'lore', 'glossary'));
    expect(folders.timeline).toBe(path.join(ROOT, 'lore', 'timeline'));
    expect(folders.notes).toBe(path.join(ROOT, 'lore', 'notes'));
  });

  it('honors overrides for scripts, world, imports, and assets independently', () => {
    const folders = resolveWorkspaceFolders(ROOT, {
      scripts: 'screenplays',
      world: 'bible',
      imports: 'source-docs',
      assets: 'production-assets',
    });
    expect(folders.scripts).toBe(path.join(ROOT, 'screenplays'));
    expect(folders.world).toBe(path.join(ROOT, 'bible'));
    expect(folders.imports).toBe(path.join(ROOT, 'source-docs'));
    expect(folders.assets).toBe(path.join(ROOT, 'production-assets'));
  });

  it('falls back to defaults for empty or whitespace-only overrides', () => {
    const folders = resolveWorkspaceFolders(ROOT, { scripts: '  ', world: '', imports: undefined, assets: '  ' });
    expect(folders.scripts).toBe(path.join(ROOT, DEFAULT_FOLDERS.scripts));
    expect(folders.world).toBe(path.join(ROOT, DEFAULT_FOLDERS.world));
    expect(folders.imports).toBe(path.join(ROOT, DEFAULT_FOLDERS.imports));
    expect(folders.assets).toBe(path.join(ROOT, DEFAULT_FOLDERS.assets));
  });
});
