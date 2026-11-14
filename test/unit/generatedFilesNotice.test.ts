/**
 * Unit tests for `config/generatedFilesNotice.ts`: when the one-time
 * generated-files offer shows, and how patterns are appended to `.gitignore`.
 */

import { describe, expect, it } from 'vitest';
import {
  GENERATED_FILE_PATTERNS,
  GITIGNORE_HEADER,
  appendMissingPatterns,
  decideGeneratedFilesNotice,
  missingPatterns,
} from '../../src/config/generatedFilesNotice';

const base = { enabled: true, hasConfigFile: true, alreadyOffered: false } as const;

describe('decideGeneratedFilesNotice', () => {
  it('offers the append when a .gitignore exists and lacks the patterns', () => {
    expect(decideGeneratedFilesNotice({ ...base }, 'node_modules/\n')).toEqual({ canAppend: true });
  });

  it('gives an information-only offer when there is no .gitignore', () => {
    expect(decideGeneratedFilesNotice({ ...base }, undefined)).toEqual({ canAppend: false });
  });

  it('gives an information-only offer when the .gitignore already covers everything', () => {
    expect(decideGeneratedFilesNotice({ ...base }, GENERATED_FILE_PATTERNS.join('\n'))).toEqual({ canAppend: false });
  });

  it('never offers twice, when turned off, or outside a LoreFountain project', () => {
    expect(decideGeneratedFilesNotice({ ...base, alreadyOffered: true }, '')).toBeUndefined();
    expect(decideGeneratedFilesNotice({ ...base, enabled: false }, '')).toBeUndefined();
    expect(decideGeneratedFilesNotice({ ...base, hasConfigFile: false }, '')).toBeUndefined();
  });
});

describe('missingPatterns', () => {
  it('ignores comments and treats a leading slash as the same pattern', () => {
    const text = '# *.shots.json\n/*.cues.json\n  *.pages.json  \n';
    expect(missingPatterns(text)).toEqual(['*.shots.json', '.lorefountain/', '*.lorefountain.db', '*.lorefountain.db-journal']);
  });

  it('never includes Producer files', () => {
    expect(GENERATED_FILE_PATTERNS.some((p) => p.includes('lfp'))).toBe(false);
  });
});

describe('appendMissingPatterns', () => {
  it('appends a header and only the missing patterns, keeping existing content', () => {
    const result = appendMissingPatterns('node_modules/\n*.shots.json\n');
    expect(result.startsWith('node_modules/\n*.shots.json\n\n' + GITIGNORE_HEADER + '\n')).toBe(true);
    expect(result).toContain('*.cues.json\n');
    expect(result.match(/\*\.shots\.json/g)).toHaveLength(1);
  });

  it('is idempotent', () => {
    const once = appendMissingPatterns('node_modules/\n');
    expect(appendMissingPatterns(once)).toBe(once);
  });

  it('preserves CRLF line endings and handles a missing final newline', () => {
    const result = appendMissingPatterns('a\r\nb');
    expect(result).toBe(`a\r\nb\r\n\r\n${[GITIGNORE_HEADER, ...GENERATED_FILE_PATTERNS].join('\r\n')}\r\n`);
  });

  it('works on an empty file', () => {
    expect(appendMissingPatterns('')).toBe(`${[GITIGNORE_HEADER, ...GENERATED_FILE_PATTERNS].join('\n')}\n`);
  });
});
