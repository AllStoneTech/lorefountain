/**
 * Unit tests for `diagnostics/scriptIssues.ts`: which index issues become
 * script diagnostics, and how a save merges with the last full build.
 */

import { describe, expect, it } from 'vitest';
import { mergeSavedIssues, toScriptIssueData } from '../../src/diagnostics/scriptIssues';

describe('toScriptIssueData', () => {
  it('keeps only issues with a code and a line, sorted by line, tagged by severity and phase', () => {
    const data = toScriptIssueData(
      [
        { code: 'orphaned-parenthetical', line: 9, message: 'orphan' },
        { code: 'unmapped-shot-tag', line: 2, message: 'unmapped' },
        { code: 'invalid-order', message: 'no line' },
        { line: 4, message: 'no code' },
      ],
      [{ code: 'bare-pause-line', line: 5, message: 'beat' }],
    );
    expect(data).toEqual([
      { line: 2, code: 'unmapped-shot-tag', severity: 'warning', message: 'unmapped', phase: 'full-build' },
      { line: 5, code: 'bare-pause-line', severity: 'info', message: 'beat', phase: 'save' },
      { line: 9, code: 'orphaned-parenthetical', severity: 'warning', message: 'orphan', phase: 'save' },
    ]);
  });
});

describe('mergeSavedIssues', () => {
  it('replaces save-time issues and keeps full-build-only ones until the next rebuild', () => {
    const previous = toScriptIssueData(
      [
        { code: 'unmapped-cue-tag', line: 1, message: 'cue' },
        { code: 'orphaned-parenthetical', line: 7, message: 'old orphan' },
      ],
      [],
    );
    const fromSave = toScriptIssueData([], [{ code: 'bare-pause-line', line: 3, message: 'beat' }]);
    expect(mergeSavedIssues(previous, fromSave).map((issue) => [issue.code, issue.line])).toEqual([
      ['unmapped-cue-tag', 1],
      ['bare-pause-line', 3],
    ]);
  });

  it('ignores any full-build-only codes arriving from a save', () => {
    const fromSave = toScriptIssueData([{ code: 'unmapped-shot-tag', line: 2, message: 'x' }], []);
    expect(mergeSavedIssues([], fromSave)).toEqual([]);
  });
});
