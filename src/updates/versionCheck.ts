/**
 * Pure logic behind "Check for LoreFountain Updates": compares the installed
 * extension version against the newest GitHub Release. No `vscode` import,
 * and `fetch` is passed in rather than imported, so the whole thing is
 * unit-testable without an extension host or a network (this project's tests
 * never make live calls).
 *
 * This only ever *reports* a newer version — it never downloads or installs
 * anything. Marketplace and Open VSX installs update themselves, and
 * side-loading a `.vsix` over a store-managed install would fight that
 * updater, so the command (`src/commands/checkForUpdates.ts`) just points the
 * writer at the release page or the Extensions view.
 *
 * Everything degrades to `unavailable` rather than throwing: a private or
 * not-yet-released repo (404), rate limiting, being offline, or an unexpected
 * response shape are all "couldn't check," not errors worth surfacing.
 */

import { z } from 'zod';

/** GitHub Releases endpoint for the newest published (non-draft, non-prerelease) release. */
export const LATEST_RELEASE_URL = 'https://api.github.com/repos/AllStoneTech/lorefountain/releases/latest';

/** The only host/path prefix a release URL from the API is allowed to point at before it's offered to the user. */
const RELEASE_URL_PREFIX = 'https://github.com/AllStoneTech/lorefountain/';

const latestReleaseSchema = z.object({
  tag_name: z.string().min(1),
  html_url: z.string().startsWith(RELEASE_URL_PREFIX),
});

/** Outcome of comparing the installed version against the latest release. */
export type VersionCheckResult =
  | { status: 'up-to-date'; installed: string; latest: string }
  | { status: 'update-available'; installed: string; latest: string; releaseUrl: string }
  | { status: 'unavailable' };

/**
 * Parse a `major.minor.patch` version (an optional leading `v` and any
 * `-prerelease`/`+build` suffix are ignored).
 *
 * @param version - A version string such as `1.2.3` or `v1.2.3-beta.1`.
 * @returns The three numeric parts, or `undefined` if it isn't in that shape.
 */
export function parseVersion(version: string): [number, number, number] | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compare two versions numerically, part by part.
 *
 * @param a - First version.
 * @param b - Second version.
 * @returns A negative number if `a < b`, positive if `a > b`, `0` if equal, or `undefined` if either can't be parsed.
 */
export function compareVersions(a: string, b: string): number | undefined {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return undefined;
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] as number) - (right[i] as number);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Ask GitHub for the latest release and compare it to the installed version.
 *
 * @param installedVersion - The running extension's version (`packageJSON.version`).
 * @param fetchImpl - `fetch`, injected so tests can stub it.
 * @returns The comparison outcome; `unavailable` on any failure to get or understand a response.
 */
export async function checkForNewerVersion(
  installedVersion: string,
  fetchImpl: typeof fetch,
): Promise<VersionCheckResult> {
  try {
    const response = await fetchImpl(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'lorefountain-vscode' },
    });
    if (!response.ok) return { status: 'unavailable' };

    const parsed = latestReleaseSchema.safeParse(await response.json());
    if (!parsed.success) return { status: 'unavailable' };

    const latest = parsed.data.tag_name.replace(/^v/, '');
    const comparison = compareVersions(latest, installedVersion);
    if (comparison === undefined) return { status: 'unavailable' };

    return comparison > 0
      ? { status: 'update-available', installed: installedVersion, latest, releaseUrl: parsed.data.html_url }
      : { status: 'up-to-date', installed: installedVersion, latest };
  } catch {
    return { status: 'unavailable' };
  }
}
