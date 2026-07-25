import { describe, expect, it } from 'vitest';
import { parseScriptTitlePage, setTitlePageField } from '../../src/model/script';

const titlePage = (fields: Record<string, string>) =>
  Object.entries(fields)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n') + '\n\n';

describe('parseScriptTitlePage', () => {
  it('parses Title, Order, and Production Code when all present and valid', () => {
    const text = titlePage({ Title: 'Pilot', Order: '1', 'Production Code': '1x01' }) + 'INT. THE ARK - DAY\n';
    const result = parseScriptTitlePage(text, { id: '1x01-pilot', filePath: '/scripts/1x01-pilot.fountain' });

    expect(result.warnings).toEqual([]);
    expect(result.script.frontmatter).toEqual({ title: 'Pilot', order: 1, productionCode: '1x01' });
    expect(result.script.id).toBe('1x01-pilot');
  });

  it('leaves frontmatter empty and produces no warnings when there is no title page at all', () => {
    const result = parseScriptTitlePage('INT. THE ARK - DAY\n\nAction line.\n', {
      id: 'untitled',
      filePath: '/scripts/untitled.fountain',
    });

    expect(result.warnings).toEqual([]);
    expect(result.script.frontmatter).toEqual({});
  });

  it('warns and leaves order unset when Order is not a positive whole number', () => {
    const text = titlePage({ Title: 'Pilot', Order: 'first' }) + 'INT. THE ARK - DAY\n';
    const result = parseScriptTitlePage(text, { id: 'x', filePath: '/x.fountain' });

    expect(result.script.frontmatter.order).toBeUndefined();
    expect(result.warnings).toEqual([{ code: 'invalid-order', path: 'order', message: expect.stringContaining('first') }]);
  });

  it('warns and leaves order unset for a negative, zero, or fractional value', () => {
    for (const bad of ['-1', '0', '1.5']) {
      const text = titlePage({ Title: 'Pilot', Order: bad }) + 'INT. X - DAY\n';
      const result = parseScriptTitlePage(text, { id: 'x', filePath: '/x.fountain' });
      expect(result.script.frontmatter.order).toBeUndefined();
      expect(result.warnings).toHaveLength(1);
    }
  });

  it('warns and leaves productionCode unset when it does not match SxEE', () => {
    const text = titlePage({ Title: 'Pilot', 'Production Code': 'not-a-code' }) + 'INT. X - DAY\n';
    const result = parseScriptTitlePage(text, { id: 'x', filePath: '/x.fountain' });

    expect(result.script.frontmatter.productionCode).toBeUndefined();
    expect(result.warnings).toEqual([
      { code: 'invalid-production-code', path: 'production_code', message: expect.stringContaining('not-a-code') },
    ]);
  });

  it('accepts a Production Code with an uppercase X and multi-digit season/episode', () => {
    const text = titlePage({ Title: 'Pilot', 'Production Code': '12X103' }) + 'INT. X - DAY\n';
    const result = parseScriptTitlePage(text, { id: 'x', filePath: '/x.fountain' });

    expect(result.script.frontmatter.productionCode).toBe('12X103');
    expect(result.warnings).toEqual([]);
  });

  describe('setTitlePageField', () => {
    it('updates an existing field in place, leaving everything else untouched', () => {
      const text = ['Title: Pilot', 'Order: 1', '', 'INT. THE ARK - DAY'].join('\n');
      const updated = setTitlePageField(text, 'Order', '2', '/scripts/1x01.fountain');

      expect(updated).toBe(['Title: Pilot', 'Order: 2', '', 'INT. THE ARK - DAY'].join('\n'));
    });

    it('inserts a new field into an existing title page that does not have it yet', () => {
      const text = ['Title: Pilot', '', 'INT. THE ARK - DAY'].join('\n');
      const updated = setTitlePageField(text, 'Order', '1', '/scripts/1x01.fountain');

      expect(updated).toBe(['Title: Pilot', 'Order: 1', '', 'INT. THE ARK - DAY'].join('\n'));
    });

    it('is case-insensitive when matching an existing key', () => {
      const text = ['Title: Pilot', 'order: 1', '', 'INT. X - DAY'].join('\n');
      const updated = setTitlePageField(text, 'Order', '5', '/scripts/1x01.fountain');

      expect(updated).toBe(['Title: Pilot', 'Order: 5', '', 'INT. X - DAY'].join('\n'));
    });

    it('creates a minimal title page with a filename-derived Title when none exists at all', () => {
      const text = 'INT. THE ARK - DAY\n\nAction.';
      const updated = setTitlePageField(text, 'Order', '1', '/scripts/1x01-pilot.fountain');

      expect(updated).toBe('Title: 1x01 Pilot\nOrder: 1\n\nINT. THE ARK - DAY\n\nAction.');
    });
  });

  it('does not read Order/Production Code at all when the title page has no recognized starter field', () => {
    // fountain-js only recognizes a block as a title page if it opens with one
    // of its known keys (Title, Author, Credit, etc.) — a title page made up
    // only of custom keys is invisible to it, so nothing here is read, silently.
    const text = titlePage({ Order: '1', 'Production Code': '1x01' }) + 'INT. X - DAY\n';
    const result = parseScriptTitlePage(text, { id: 'x', filePath: '/x.fountain' });

    expect(result.script.frontmatter).toEqual({});
    expect(result.warnings).toEqual([]);
  });
});
