/**
 * Unit tests for the Install Demo download logic (`src/demos/demoDownloader.ts`).
 * `fetch` is always a hand-written stub here — no live network calls.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadDemoFiles, listDemoFiles } from '../../src/demos/demoDownloader';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

function bytesResponse(text: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(text).buffer),
  } as unknown as Response;
}

describe('listDemoFiles', () => {
  it('recursively flattens files across nested directories', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url.includes('contents/demos/Fixture?')) {
        return Promise.resolve(
          jsonResponse([
            { name: 'README.md', path: 'demos/Fixture/README.md', type: 'file', download_url: 'https://raw/README.md' },
            { name: 'world', path: 'demos/Fixture/world', type: 'dir', download_url: null },
          ]),
        );
      }
      if (url.includes('contents/demos/Fixture/world?')) {
        return Promise.resolve(
          jsonResponse([
            { name: 'hero.md', path: 'demos/Fixture/world/hero.md', type: 'file', download_url: 'https://raw/hero.md' },
          ]),
        );
      }
      throw new Error(`unexpected URL: ${url}`);
    });

    const files = await listDemoFiles('Owner', 'Repo', 'main', 'demos/Fixture', fetchImpl as unknown as typeof fetch);

    expect(files).toEqual(
      expect.arrayContaining([
        { relativePath: 'README.md', downloadUrl: 'https://raw/README.md' },
        { relativePath: 'world/hero.md', downloadUrl: 'https://raw/hero.md' },
      ]),
    );
    expect(files).toHaveLength(2);
  });

  it('throws when a directory listing request fails', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ message: 'Not Found' }, false, 404)));

    await expect(
      listDemoFiles('Owner', 'Repo', 'main', 'demos/Missing', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow(/404/);
  });

  it('throws if a file entry is missing a download URL', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse([{ name: 'weird', path: 'demos/Fixture/weird', type: 'file', download_url: null }])),
    );

    await expect(
      listDemoFiles('Owner', 'Repo', 'main', 'demos/Fixture', fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow(/download URL/);
  });
});

describe('downloadDemoFiles', () => {
  let targetDir: string;

  beforeEach(() => {
    targetDir = mkdtempSync(join(tmpdir(), 'lorefountain-demo-download-'));
  });

  afterEach(() => {
    rmSync(targetDir, { recursive: true, force: true });
  });

  it('writes every file, creating nested directories as needed', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === 'https://raw/README.md') return Promise.resolve(bytesResponse('hello'));
      if (url === 'https://raw/hero.md') return Promise.resolve(bytesResponse('---\nname: Hero\n---\n'));
      throw new Error(`unexpected URL: ${url}`);
    });

    const onProgress = vi.fn();
    await downloadDemoFiles(
      [
        { relativePath: 'README.md', downloadUrl: 'https://raw/README.md' },
        { relativePath: 'world/hero.md', downloadUrl: 'https://raw/hero.md' },
      ],
      targetDir,
      fetchImpl as unknown as typeof fetch,
      onProgress,
    );

    expect(readFileSync(join(targetDir, 'README.md'), 'utf8')).toBe('hello');
    expect(existsSync(join(targetDir, 'world', 'hero.md'))).toBe(true);
    expect(readFileSync(join(targetDir, 'world', 'hero.md'), 'utf8')).toBe('---\nname: Hero\n---\n');
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it('throws when a file download fails, without silently skipping it', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(bytesResponse('', false, 500)));

    await expect(
      downloadDemoFiles(
        [{ relativePath: 'broken.md', downloadUrl: 'https://raw/broken.md' }],
        targetDir,
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/500/);
  });
});
