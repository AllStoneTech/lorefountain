import { describe, expect, it } from 'vitest';
import { checkForNewerVersion, compareVersions, parseVersion } from '../../src/updates/versionCheck';

function fakeFetch(body: unknown, ok = true): typeof fetch {
  return (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
}

describe('parseVersion / compareVersions', () => {
  it('parses plain, v-prefixed, and suffixed versions', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2.3-beta.1')).toEqual([1, 2, 3]);
  });

  it('rejects a non-version string', () => {
    expect(parseVersion('latest')).toBeUndefined();
    expect(compareVersions('latest', '1.0.0')).toBeUndefined();
  });

  it('compares numerically, not lexically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });
});

describe('checkForNewerVersion', () => {
  const release = (tag: string) => ({ tag_name: tag, html_url: `https://github.com/AllStoneTech/lorefountain/releases/tag/${tag}` });

  it('reports an update when the latest release is newer', async () => {
    const result = await checkForNewerVersion('1.0.0', fakeFetch(release('v1.1.0')));
    expect(result).toEqual({
      status: 'update-available',
      installed: '1.0.0',
      latest: '1.1.0',
      releaseUrl: 'https://github.com/AllStoneTech/lorefountain/releases/tag/v1.1.0',
    });
  });

  it('reports up-to-date when versions match or the installed one is newer', async () => {
    expect((await checkForNewerVersion('1.1.0', fakeFetch(release('v1.1.0')))).status).toBe('up-to-date');
    expect((await checkForNewerVersion('1.2.0', fakeFetch(release('v1.1.0')))).status).toBe('up-to-date');
  });

  it('is unavailable on a non-OK response (e.g. a private repo returns 404)', async () => {
    expect(await checkForNewerVersion('1.0.0', fakeFetch({}, false))).toEqual({ status: 'unavailable' });
  });

  it('is unavailable when the response shape is wrong', async () => {
    expect(await checkForNewerVersion('1.0.0', fakeFetch({ nope: true }))).toEqual({ status: 'unavailable' });
  });

  it('is unavailable when the release URL points somewhere unexpected', async () => {
    const hostile = { tag_name: 'v9.9.9', html_url: 'https://evil.example.com/download' };
    expect(await checkForNewerVersion('1.0.0', fakeFetch(hostile))).toEqual({ status: 'unavailable' });
  });

  it('is unavailable when the tag is not a version', async () => {
    expect(await checkForNewerVersion('1.0.0', fakeFetch(release('nightly')))).toEqual({ status: 'unavailable' });
  });

  it('is unavailable when the request itself throws (offline)', async () => {
    const offline = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    expect(await checkForNewerVersion('1.0.0', offline)).toEqual({ status: 'unavailable' });
  });
});
