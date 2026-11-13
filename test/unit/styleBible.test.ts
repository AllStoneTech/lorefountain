/**
 * Tests for the style bible (ADR-0045): the scaffold (`src/config/styleBible.ts`),
 * the bundled template, the validator/Output-channel check
 * (`src/index/styleCheck.ts`), and that `*.lf.md` project documents are never indexed as an entity.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseStyleBibleFile } from 'lorefountain-core/model/styleBible';
import { scaffoldStyleBibleIfAbsent } from '../../src/config/styleBible';
import { buildIndexFromDisk } from '../../src/index/build';
import { createMemoryIndexStore } from '../../src/index/memoryStore';
import { checkStyleBible } from '../../src/index/styleCheck';

const RESOURCES = join(__dirname, '..', '..', 'resources');

let root: string;
let world: string;

/** Write `text` to `relativePath` under the project root, creating folders. */
function put(relativePath: string, text: string): void {
  const filePath = join(root, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, 'utf8');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lorefountain-style-'));
  world = join(root, 'world');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('scaffoldStyleBibleIfAbsent', () => {
  it('writes world/style.lf.md from the bundled template with the project name, creating the folder', async () => {
    const result = await scaffoldStyleBibleIfAbsent(RESOURCES, world, 'Winona');

    expect(result).toEqual({ filePath: join(world, 'style.lf.md'), created: true });
    const text = readFileSync(result.filePath, 'utf8');
    expect(text).toContain('# Winona: Style Bible');
    expect(text).not.toContain('{{PROJECT_NAME}}');
  });

  it('produces a file that validates, with every field unset', async () => {
    const { filePath } = await scaffoldStyleBibleIfAbsent(RESOURCES, world, 'Winona');
    const parsed = parseStyleBibleFile(readFileSync(filePath, 'utf8'), filePath);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.style.frontmatter).toEqual({});
    expect(parsed.style.body).toContain('## Overall look');
    expect(parsed.style.body).toContain('## What to avoid');
    expect(await checkStyleBible(world, root)).toEqual({ status: 'ok', filePath, notes: [] });
  });

  it('never overwrites an existing file, whatever its letter case', async () => {
    mkdirSync(world, { recursive: true });
    writeFileSync(join(world, 'Style.LF.md'), 'A writer already wrote this.\n');

    const result = await scaffoldStyleBibleIfAbsent(RESOURCES, world, 'Winona');

    expect(result).toEqual({ filePath: join(world, 'Style.LF.md'), created: false });
    expect(readFileSync(join(world, 'Style.LF.md'), 'utf8')).toBe('A writer already wrote this.\n');
  });

  it('is not blocked by a real entity called Style (world/style.md)', async () => {
    mkdirSync(world, { recursive: true });
    writeFileSync(join(world, 'style.md'), '---\nname: Style\ntype: concept\n---\nAn idea.\n');

    const result = await scaffoldStyleBibleIfAbsent(RESOURCES, world, 'Winona');

    expect(result.created).toBe(true);
    expect(readFileSync(join(world, 'style.md'), 'utf8')).toContain('An idea.');
  });
});

describe('checkStyleBible', () => {
  it('reports nothing for a project with no style bible', async () => {
    expect(await checkStyleBible(world, root)).toEqual({ status: 'absent' });
  });

  it('notes a missing reference image and one outside the project, but not an existing one or a URL', async () => {
    put(
      'world/style.lf.md',
      [
        '---',
        'reference_images:',
        '  - assets/style/here.png',
        '  - assets/style/missing.png',
        '  - ../elsewhere.png',
        '  - https://example.com/x.png',
        '---',
        '',
        'Body',
      ].join('\n'),
    );
    put('assets/style/here.png', 'png');

    const report = await checkStyleBible(world, root);

    expect(report.status).toBe('ok');
    if (report.status !== 'ok') return;
    expect(report.notes).toEqual([
      'reference image "assets/style/missing.png" doesn\'t exist yet',
      'reference image "../elsewhere.png" is outside the project, so it won\'t travel with it',
    ]);
  });

  it('reports a malformed file with the reason and each invalid field', async () => {
    put('world/style.lf.md', '---\nart_style: [oops\n---\n');
    const yamlReport = await checkStyleBible(world, root);
    expect(yamlReport).toMatchObject({ status: 'malformed', reason: 'malformed-yaml' });

    put('world/style.lf.md', '---\npalette:\n  - #2a7f8e\nart_style: 3\nformat:\n  comic: [a]\n---\n');
    const schemaReport = await checkStyleBible(world, root);
    expect(schemaReport.status).toBe('malformed');
    if (schemaReport.status !== 'malformed') return;
    expect(schemaReport.reason).toBe('invalid-schema');
    expect(schemaReport.message).toContain('palette:');
    expect(schemaReport.message).toContain('quote hex colours');
    expect(schemaReport.message).toContain('art_style:');
    expect(schemaReport.message).toContain('format.comic:');
  });
});

describe('index handling', () => {
  it('never indexes a *.lf.md as an entity, glossary term or event, but does index a real entity called Style', async () => {
    put('world/sango.md', '---\nname: Sango\ntype: character\n---\nA scout.\n');
    put('world/style.lf.md', '---\npalette: 7\n---\nnot an entity\n');
    put('world/style.md', '---\nname: Style\ntype: concept\n---\nA real entity.\n');
    put('world/glossary/terms.lf.md', 'not a glossary term');
    put('world/timeline/era.lf.md', 'not an event');

    const summary = await buildIndexFromDisk(createMemoryIndexStore(), {
      world,
      glossary: join(world, 'glossary'),
      timeline: join(world, 'timeline'),
      scripts: join(root, 'scripts'),
    });

    expect(summary.entityCount).toBe(2);
    expect(summary.glossaryCount).toBe(0);
    expect(summary.eventCount).toBe(0);
    expect(summary.malformed).toEqual([]);
  });
});
