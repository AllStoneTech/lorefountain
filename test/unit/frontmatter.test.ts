/**
 * Unit tests for the generic Markdown-with-frontmatter parser/serializer.
 * Covers the happy path, no-frontmatter, malformed/non-mapping YAML, and
 * round-trip stability.
 */

import { describe, it, expect } from 'vitest';
import {
  parseMarkdownWithFrontmatter,
  serializeMarkdownWithFrontmatter,
} from '../../src/model/frontmatter';

describe('parseMarkdownWithFrontmatter', () => {
  it('parses a well-formed frontmatter block and body', () => {
    const text = ['---', 'name: Sango', 'type: character', '---', '', 'Body text here.'].join('\n');
    const result = parseMarkdownWithFrontmatter(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.hadFrontmatter).toBe(true);
    expect(result.value.frontmatter).toEqual({ name: 'Sango', type: 'character' });
    expect(result.value.body).toBe('Body text here.');
  });

  it('treats a document with no frontmatter as an empty mapping + full body', () => {
    const text = 'Just some notes, no frontmatter.';
    const result = parseMarkdownWithFrontmatter(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.hadFrontmatter).toBe(false);
    expect(result.value.frontmatter).toEqual({});
    expect(result.value.body).toBe(text);
  });

  it('handles CRLF line endings and a leading BOM', () => {
    const text = '﻿---\r\nname: Esu\r\ntype: character\r\n---\r\n\r\nBody.';
    const result = parseMarkdownWithFrontmatter(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter).toEqual({ name: 'Esu', type: 'character' });
  });

  it('reports malformed YAML instead of throwing', () => {
    const text = ['---', 'name: "unterminated', 'type: character', '---', '', 'body'].join('\n');
    const result = parseMarkdownWithFrontmatter(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/Invalid YAML/i);
  });

  it('rejects a frontmatter block that is not a mapping', () => {
    const text = ['---', '- just', '- a', '- list', '---', '', 'body'].join('\n');
    const result = parseMarkdownWithFrontmatter(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/mapping/i);
  });

  it('treats an empty frontmatter block as an empty mapping', () => {
    const text = ['---', '---', '', 'body'].join('\n');
    const result = parseMarkdownWithFrontmatter(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frontmatter).toEqual({});
    expect(result.value.hadFrontmatter).toBe(true);
  });
});

describe('serializeMarkdownWithFrontmatter', () => {
  it('round-trips frontmatter and body', () => {
    const original = ['---', 'name: Sango', 'type: character', '---', '', 'Body text.'].join('\n');
    const parsed = parseMarkdownWithFrontmatter(original);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const serialized = serializeMarkdownWithFrontmatter(parsed.value.frontmatter, parsed.value.body);
    const reparsed = parseMarkdownWithFrontmatter(serialized);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.value.frontmatter).toEqual(parsed.value.frontmatter);
    expect(reparsed.value.body).toBe('Body text.');
  });

  it('ends the document with a single trailing newline', () => {
    const out = serializeMarkdownWithFrontmatter({ name: 'X' }, 'body');
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });
});
