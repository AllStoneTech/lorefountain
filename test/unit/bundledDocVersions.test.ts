/**
 * Guards the bundled templates under `resources/` against drifting from
 * their version registries: a scaffolded file's `lorefountain-docs-version`
 * marker must equal the number in `AGENT_FILE_VERSIONS` /
 * `README_TEMPLATES`, or "Check for LoreFountain File Updates" would never
 * flag (or would forever flag) the file. Also checks that the agent docs
 * carry the comic-script convention (ADR-0043).
 */

import { readFileSync } from 'node:fs';
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

describe('comic-script documentation', () => {
  const scriptWriter = readFileSync(join(RESOURCES, 'agents', 'script-writer.md'), 'utf8');

  it('the script-writer agent doc covers the syntax, the blank-line rule, SFX and the sidecar', () => {
    for (const phrase of ['PAGE: <label>', 'PANEL: <description>', 'CAPTION:', 'LAYOUT:', 'misread-as-character', 'pages.json', 'A page is not a scene', 'SFX:` is shared with audio only by opt-in', 'comic.sfxAsCue', 'maxWordsPerBalloon']) {
      expect(scriptWriter).toContain(phrase);
    }
  });

  it('AGENTS.md points agents at the convention', () => {
    expect(readFileSync(join(RESOURCES, 'AGENTS.md'), 'utf8')).toContain('PAGE:');
  });

  it('the tmLanguage grammar scopes the comic keywords', () => {
    const grammar = readFileSync(join(RESOURCES, 'fountain.tmLanguage.json'), 'utf8');
    expect(JSON.parse(grammar).repository['comic-prefix'].match).toContain('PAGE|PANEL|CAPTION|LAYOUT');
  });
});
