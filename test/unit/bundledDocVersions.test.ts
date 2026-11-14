/**
 * Guards the bundled templates under `resources/` against drifting from
 * their version registries: a scaffolded file's `lorefountain-docs-version`
 * marker must equal the number in `AGENT_FILE_VERSIONS` /
 * `README_TEMPLATES`, or "Check for LoreFountain File Updates" would never
 * flag (or would forever flag) the file. Also checks that the agent docs
 * carry the comic-script convention (ADR-0043).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseVersionMarker } from '../../src/config/agentFileVersions';
import { AGENT_FILE_VERSIONS } from '../../src/config/agentFiles';
import { README_TEMPLATES } from '../../src/config/readmeFiles';

const RESOURCES = join(__dirname, '..', '..', 'resources');

describe('bundled doc version markers', () => {
  it.each(Object.entries(AGENT_FILE_VERSIONS).filter(([name]) => !name.endsWith('.js')))(
    'agent file %s carries its registry version',
    (name, version) => {
      expect(parseVersionMarker(readFileSync(join(RESOURCES, name), 'utf8'))).toBe(version);
    },
  );

  it.each(README_TEMPLATES.map((template) => [template.templateName, template.version] as const))(
    'README template %s carries its registry version',
    (name, version) => {
      expect(parseVersionMarker(readFileSync(join(RESOURCES, 'readmes', name), 'utf8'))).toBe(version);
    },
  );
});

describe('every managed file is tracked by the update check', () => {
  /** Every file under `resources/` whose first line carries a docs-version marker, as a path relative to `resources/`. */
  function markedFiles(dir: string, base = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const relative = base === '' ? entry.name : join(base, entry.name);
      if (entry.isDirectory()) return markedFiles(join(dir, entry.name), relative);
      const firstLine = readFileSync(join(dir, entry.name), 'utf8').split('\n', 1)[0] ?? '';
      return /lorefountain-docs-version:/.test(firstLine) ? [relative] : [];
    });
  }

  it('no bundled file carries a version marker without being in a version table', () => {
    const tracked = new Set([...Object.keys(AGENT_FILE_VERSIONS), ...README_TEMPLATES.map((t) => join('readmes', t.templateName))]);
    const untracked = markedFiles(RESOURCES).filter((file) => !tracked.has(file));
    expect(untracked).toEqual([]);
  });

  // validate.js is a generated build output (gitignored), so it is checked only when a build has produced it.
  it.skipIf(!existsSync(join(RESOURCES, 'agents', 'validate.js')))('the built agents/validate.js carries its registry version', () => {
    const content = readFileSync(join(RESOURCES, 'agents', 'validate.js'), 'utf8');
    expect(parseVersionMarker(content)).toBe(AGENT_FILE_VERSIONS[join('agents', 'validate.js')]);
  });
});

describe('style bible documentation (ADR-0045)', () => {
  const worldBuilder = readFileSync(join(RESOURCES, 'agents', 'world-builder.md'), 'utf8');

  it('the world-builder agent doc covers the fields, the quoting trap and the per-character rule', () => {
    for (const phrase of ['## Style bible format', 'world/style.lf.md', 'art_style', 'reference_images', 'avoid', 'era_reference', 'lettering', 'QUOTE hex', 'Per-character looks stay in the character', 'node agents/validate.js']) {
      expect(worldBuilder).toContain(phrase);
    }
  });

  it('the world README and the help topic mention the style bible', () => {
    expect(readFileSync(join(RESOURCES, 'readmes', 'world.md'), 'utf8')).toContain('style.lf.md');
    expect(readFileSync(join(RESOURCES, 'help', 'styleBible.md'), 'utf8')).toContain('Open Style Bible');
  });
});

describe('comic-script documentation', () => {
  const scriptWriter = readFileSync(join(RESOURCES, 'agents', 'script-writer.md'), 'utf8');

  it('the script-writer agent doc covers the syntax, the blank-line rule, SFX and the sidecar', () => {
    for (const phrase of ['PAGE: <label>', 'PANEL: [tag] <description>', 'CAPTION:', 'LAYOUT:', 'misread-as-character', 'pages.json', 'A page is not a scene', 'SFX:` is shared with audio only by opt-in', 'comic.sfxAsCue', 'maxWordsPerBalloon']) {
      expect(scriptWriter).toContain(phrase);
    }
  });

  it('AGENTS.md points agents at the convention', () => {
    expect(readFileSync(join(RESOURCES, 'AGENTS.md'), 'utf8')).toContain('PAGE:');
  });

  it('the agent doc covers narrated comics: panelsAsShots, tags, MOVE:, DURATION:, TURN and the narrator', () => {
    for (const phrase of ['comic.panelsAsShots', 'panelsAsShots', 'MOVE: slow zoom in', 'DURATION: 4s', 'pageTurn', 'NARRATOR', 'caption: true', 'duplicate-panel-tag', 'panels-not-derived']) {
      expect(scriptWriter).toContain(phrase);
    }
  });

  it('the snippet file is valid JSON and offers the panel tag and MOVE: snippets', () => {
    const snippets = JSON.parse(readFileSync(join(RESOURCES, 'fountain-cues.code-snippets'), 'utf8')) as Record<string, { prefix: string; body: string }>;
    expect(snippets['Comic Move'].body).toContain('MOVE: ');
    expect(snippets['Comic Panel (tagged)'].body).toContain('PANEL: [');
    expect(snippets['Comic Panel'].body).toBe('PANEL: ${1:description}'+String.fromCharCode(10));
  });

  it('the tmLanguage grammar scopes the comic keywords', () => {
    const grammar = readFileSync(join(RESOURCES, 'fountain.tmLanguage.json'), 'utf8');
    expect(JSON.parse(grammar).repository['comic-prefix'].match).toContain('PAGE|CAPTION|LAYOUT|MOVE');
  });
});
