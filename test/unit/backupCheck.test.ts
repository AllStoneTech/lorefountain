import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hasCloudSyncPath, hasGitAncestor, hasRecognizedBackup } from '../../src/safety/backupCheck';

describe('hasGitAncestor', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'lorefountain-backup-check-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns false when no .git directory exists at or above the folder', () => {
    const nested = join(root, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    expect(hasGitAncestor(nested)).toBe(false);
  });

  it('returns true when .git exists directly in the folder', () => {
    mkdirSync(join(root, '.git'), { recursive: true });
    expect(hasGitAncestor(root)).toBe(true);
  });

  it('returns true when .git exists in a parent directory', () => {
    mkdirSync(join(root, '.git'), { recursive: true });
    const nested = join(root, 'scripts', 'world');
    mkdirSync(nested, { recursive: true });
    expect(hasGitAncestor(nested)).toBe(true);
  });
});

describe('hasCloudSyncPath', () => {
  it.each([
    ['C:\\Users\\writer\\OneDrive\\ORUN', true],
    ['/Users/writer/Dropbox/ORUN', true],
    ['/Users/writer/Google Drive/ORUN', true],
    ['/Users/writer/Library/CloudStorage/GoogleDrive-me/ORUN', true],
    ['/Users/writer/Library/Mobile Documents/com~apple~CloudDocs/iCloud Drive/ORUN', true],
    ['C:\\Users\\writer\\Projects\\ORUN', false],
  ])('%s -> %s', (path, expected) => {
    expect(hasCloudSyncPath(path)).toBe(expected);
  });
});

describe('hasRecognizedBackup', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'lorefountain-backup-check-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns false when neither git nor a cloud-sync path is present', () => {
    expect(hasRecognizedBackup(root)).toBe(false);
  });

  it('returns true when git is present', () => {
    mkdirSync(join(root, '.git'), { recursive: true });
    expect(hasRecognizedBackup(root)).toBe(true);
  });
});
