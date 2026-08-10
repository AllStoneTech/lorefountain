/**
 * Demo download logic (ADR-0031): recursively lists a folder in a GitHub
 * repo via the Contents API, then downloads every file it finds into a local
 * directory, preserving the folder's internal structure.
 *
 * `fetchImpl` is a parameter, not a module-level import, specifically so
 * unit tests can supply a stub instead of hitting the network (this
 * project's tests never make live external calls).
 *
 * Two API surfaces only — one directory-listing call per subdirectory
 * (`api.github.com`, rate-limited) and one plain GET per file (each file's
 * `download_url`, served from `raw.githubusercontent.com`, not subject to
 * that same limit) — deliberately not the Git Trees/Blobs API or a
 * whole-repo tarball download: a demo is a few dozen files at most, and this
 * keeps the code to two small, easily-testable functions with no new
 * dependency (no zip/tar library).
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

type FetchLike = typeof fetch;

/** One file discovered under the requested repo path. */
export interface DemoFileEntry {
  /** Path relative to the requested root folder, using `/` separators (e.g. `world/OVERVIEW.md`). */
  relativePath: string;
  /** Raw content URL (`raw.githubusercontent.com`) — no GitHub API auth needed. */
  downloadUrl: string;
}

interface GitHubContentEntry {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  download_url: string | null;
}

/**
 * Recursively list every file under `rootPath` in a GitHub repo.
 *
 * @param owner - Repo owner (e.g. `AllStoneTech`).
 * @param repo - Repo name (e.g. `lorefountain`).
 * @param ref - Branch, tag, or commit SHA to read from.
 * @param rootPath - Folder within the repo to list (e.g. `demos/Loomwake`).
 * @param fetchImpl - Injectable `fetch`, defaults to the global one.
 * @returns Every file found, flattened, with paths relative to `rootPath`.
 * @throws If any directory listing request fails (non-2xx response).
 */
export async function listDemoFiles(
  owner: string,
  repo: string,
  ref: string,
  rootPath: string,
  fetchImpl: FetchLike = fetch,
): Promise<DemoFileEntry[]> {
  const entries: DemoFileEntry[] = [];
  await walk(rootPath);
  return entries;

  async function walk(dirPath: string): Promise<void> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}?ref=${encodeURIComponent(ref)}`;
    const response = await fetchImpl(url, {
      headers: { 'User-Agent': 'LoreFountain-VSCode-Extension', Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status} listing "${dirPath}"`);
    }

    const items = (await response.json()) as GitHubContentEntry[];
    for (const item of items) {
      if (item.type === 'dir') {
        await walk(item.path);
      } else if (item.type === 'file') {
        if (!item.download_url) {
          throw new Error(`"${item.path}" has no download URL (unexpected GitHub API response)`);
        }
        entries.push({ relativePath: item.path.slice(rootPath.length + 1), downloadUrl: item.download_url });
      }
    }
  }
}

/**
 * Download every listed file into `targetDir`, preserving each file's
 * relative path (creating subdirectories as needed).
 *
 * @param files - Files to download, as returned by {@link listDemoFiles}.
 * @param targetDir - Local directory to write into (must already exist).
 * @param fetchImpl - Injectable `fetch`, defaults to the global one.
 * @param onProgress - Called after each file finishes, with the running count.
 * @throws If any file's download request fails (non-2xx response).
 */
export async function downloadDemoFiles(
  files: readonly DemoFileEntry[],
  targetDir: string,
  fetchImpl: FetchLike = fetch,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let done = 0;
  for (const file of files) {
    const destPath = path.join(targetDir, ...file.relativePath.split('/'));
    await fsp.mkdir(path.dirname(destPath), { recursive: true });

    const response = await fetchImpl(file.downloadUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} downloading "${file.relativePath}"`);
    }
    await fsp.writeFile(destPath, Buffer.from(await response.arrayBuffer()));

    done += 1;
    onProgress?.(done, files.length);
  }
}
