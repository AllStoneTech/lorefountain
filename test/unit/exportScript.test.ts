/**
 * Unit tests for `export/exportScript.ts` and `export/exportMessages.ts`
 * (ADR-0050): every format through one entry point, and validation of the
 * dialog's messages.
 */

import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { presetContent } from 'lorefountain-core/export/options';
import { parseExportDialogMessage } from '../../src/export/exportMessages';
import { defaultExportFileName, exportScript, FORMAT_DETAILS, type ExportRequest } from '../../src/export/exportScript';
import { loadPdfFonts } from '../../src/export/pdf';

const FONTS_DIR = path.join(__dirname, '..', '..', 'resources', 'fonts');
const SCRIPT = 'Title: Night\n\nINT. A - DAY #3#\n\nSHOT: [a-wide] WIDE\nSFX: thunder\n\nMARA\nHello.\n';

const request = (format: ExportRequest['format'], preset: 'pure' | 'production' = 'production'): ExportRequest => ({
  format,
  content: presetContent(preset),
  paper: 'letter',
  titlePage: true,
});

const noFonts = vi.fn(() => Promise.reject(new Error('fonts should not be read')));

describe('exportScript', () => {
  it('writes Fountain through the filter', async () => {
    const output = await exportScript(SCRIPT, '1x01', request('fountain', 'pure'), noFonts);
    expect(output.extension).toBe('.fountain');
    expect(output.data).toBe('Title: Night\n\nINT. A - DAY #3#\n\nMARA\nHello.\n');
  });

  it('writes HTML and Final Draft from the filtered script', async () => {
    const html = await exportScript(SCRIPT, '1x01', request('html', 'pure'), noFonts);
    expect(html.data).toContain('<title>Night</title>');
    expect(html.data).not.toContain('SHOT:');
    const fdx = await exportScript(SCRIPT, '1x01', request('fdx'), noFonts);
    expect(fdx.data).toContain('<Paragraph Type="Shot">');
    expect(fdx.data).toContain('<Paragraph Number="3" Type="Scene Heading">');
  });

  it('writes a Word document', async () => {
    const docx = await exportScript(SCRIPT, '1x01', request('docx'), noFonts);
    expect(Buffer.isBuffer(docx.data)).toBe(true);
    expect((docx.data as Buffer).subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('writes a PDF, reading the fonts only then', async () => {
    const loadFonts = vi.fn(() => loadPdfFonts(FONTS_DIR));
    const pdf = await exportScript(SCRIPT, '1x01', request('pdf'), loadFonts);
    expect(loadFonts).toHaveBeenCalledTimes(1);
    expect((pdf.data as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(noFonts).not.toHaveBeenCalled();
  });

  it('writes the transcript, dialogue only, ignoring the content options', async () => {
    const output = await exportScript(SCRIPT, '1x01', request('transcript'), noFonts);
    expect(output.extension).toBe('.transcript.md');
    expect(output.data).toContain('# 1x01');
    expect(output.data).toContain('Hello.');
    expect(output.data).not.toContain('thunder');
  });

  it('numbers scenes automatically or drops them, through the filter', async () => {
    const auto = await exportScript('INT. A - DAY\n\nX.\n\nINT. B - DAY\n\nY.\n', 's', { ...request('fountain'), content: { ...presetContent('production'), sceneNumbers: 'auto' } }, noFonts);
    expect(auto.data).toContain('INT. B - DAY #2#');
    const none = await exportScript(SCRIPT, 's', { ...request('html'), content: { ...presetContent('production'), sceneNumbers: 'none' } }, noFonts);
    expect(none.data).not.toContain('<span class="scene-heading__number"');
  });

  it('names files after the script, with each format extension', () => {
    expect(defaultExportFileName('1x03', 'pdf')).toBe('1x03.pdf');
    expect(defaultExportFileName('1x03', 'transcript')).toBe('1x03.transcript.md');
    expect(Object.keys(FORMAT_DETAILS)).toEqual(['pdf', 'fountain', 'fdx', 'html', 'docx', 'transcript']);
  });
});

describe('parseExportDialogMessage', () => {
  const valid = {
    type: 'export',
    format: 'pdf',
    preset: 'custom',
    content: presetContent('custom'),
    paper: 'a4',
    titlePage: false,
    scope: 'group',
  };

  it('accepts the dialog messages', () => {
    expect(parseExportDialogMessage({ type: 'ready' })).toEqual({ type: 'ready' });
    expect(parseExportDialogMessage({ type: 'cancel' })).toEqual({ type: 'cancel' });
    expect(parseExportDialogMessage(valid)).toEqual(valid);
  });

  it('rejects anything else', () => {
    expect(parseExportDialogMessage(null)).toBeUndefined();
    expect(parseExportDialogMessage({ type: 'delete' })).toBeUndefined();
    expect(parseExportDialogMessage({ ...valid, format: 'exe' })).toBeUndefined();
    expect(parseExportDialogMessage({ ...valid, extra: true })).toBeUndefined();
    expect(parseExportDialogMessage({ ...valid, content: { ...valid.content, shots: 'yes' } })).toBeUndefined();
  });
});
