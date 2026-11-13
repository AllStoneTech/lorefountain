/**
 * Regression test for ADR-0045's bundling gotcha: the export code is bundled
 * with esbuild exactly as `esbuild.js` bundles the extension (CommonJS,
 * Node), then run from a temporary folder with no `node_modules`. Bundling
 * `pdfkit`'s ES-module build once crashed the extension on load, because its
 * `import.meta.url` is empty in a CommonJS bundle.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildSync } from 'esbuild';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = path.join(__dirname, '..', '..');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lorefountain-export-bundle-'));

afterAll(() => {
  fs.rmSync(outDir, { recursive: true, force: true });
});

/** Bundle one source file the way the extension is bundled, and return the output path. */
function bundle(entry: string, name: string): string {
  const outfile = path.join(outDir, name);
  buildSync({ entryPoints: [path.join(ROOT, entry)], bundle: true, platform: 'node', format: 'cjs', target: 'node22', outfile, logLevel: 'silent', absWorkingDir: ROOT });
  return outfile;
}

describe('bundled export code', () => {
  it('loads and writes a PDF and a Word file with no node_modules beside it', async () => {
    const exportBundle = bundle('src/export/exportScript.ts', 'exportScript.cjs');
    const pdfBundle = bundle('src/export/pdf.ts', 'pdf.cjs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loading the freshly built CommonJS bundles is the point of the test
    const { exportScript } = require(exportBundle) as typeof import('../../src/export/exportScript');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadPdfFonts } = require(pdfBundle) as typeof import('../../src/export/pdf');

    const content = { shots: true, sound: true, pauses: true, comic: true, tags: true, notes: true, sections: true, synopses: true, boneyard: false, loreFountainTitleKeys: true, sceneNumbers: 'as-written' as const };
    const loadFonts = (): ReturnType<typeof loadPdfFonts> => loadPdfFonts(path.join(ROOT, 'resources', 'fonts'));
    const pdf = await exportScript('INT. ỌRUN - DAY\n\nṢàngó waits.\n', 's', { format: 'pdf', content, paper: 'letter', titlePage: true, layout: 'auto', comicPageSides: false, language: 'yo' }, loadFonts);
    expect((pdf.data as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const docx = await exportScript('INT. A - DAY\n\nRain.\n', 's', { format: 'docx', content, paper: 'a4', titlePage: true, layout: 'auto', comicPageSides: false, language: 'en' }, loadFonts);
    expect((docx.data as Buffer).subarray(0, 2).toString('latin1')).toBe('PK');
    const comicRequest = { format: 'pdf' as const, content, paper: 'letter' as const, titlePage: true, layout: 'comic' as const, comicPageSides: true, language: 'en' };
    const comicPdf = await exportScript('PAGE: 1\n\nPANEL: Rain.\n\nCAPTION: Night.\n', 's', comicRequest, loadFonts);
    expect((comicPdf.data as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const comicDocx = await exportScript('PAGE: 1\n\nPANEL: Rain.\n', 's', { ...comicRequest, format: 'docx' }, loadFonts);
    expect((comicDocx.data as Buffer).subarray(0, 2).toString('latin1')).toBe('PK');
  }, 60_000);
});
