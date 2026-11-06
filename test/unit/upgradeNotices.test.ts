/**
 * Unit tests for `upgrade/upgradeNotices.ts`: when the what's-new notice
 * and the project summary show, and what they say.
 */

import { describe, expect, it } from 'vitest';
import {
  decideProjectSummary,
  decideWhatsNew,
  isFeatureRelease,
  projectSummaryCounts,
  projectSummaryMessage,
} from '../../src/upgrade/upgradeNotices';

describe('isFeatureRelease', () => {
  it.each([
    ['1.0.0', '1.1.0', true],
    ['1.0.3', '1.1.0', true],
    ['1.9.0', '2.0.0', true],
    ['1.1.0', '1.1.1', false],
    ['1.1.0', '1.1.0', false],
    ['1.2.0', '1.1.0', false],
    ['garbage', '1.1.0', false],
  ])('%s -> %s is %s', (previous, current, expected) => {
    expect(isFeatureRelease(previous, current)).toBe(expected);
  });
});

describe('decideWhatsNew', () => {
  it('shows after a minor upgrade from a recorded version', () => {
    expect(decideWhatsNew({ current: '1.2.0', lastSeen: '1.1.4', hadPriorInstall: true })).toEqual({ show: true, previous: '1.1.4' });
  });

  it('treats a 1.0 install (device id, no recorded version) as an upgrade from 1.0.0', () => {
    expect(decideWhatsNew({ current: '1.1.0', hadPriorInstall: true })).toEqual({ show: true, previous: '1.0.0' });
  });

  it('stays silent on a fresh install', () => {
    expect(decideWhatsNew({ current: '1.1.0', hadPriorInstall: false })).toEqual({ show: false });
  });

  it('stays silent for a patch release and for the same version', () => {
    expect(decideWhatsNew({ current: '1.1.1', lastSeen: '1.1.0', hadPriorInstall: true }).show).toBe(false);
    expect(decideWhatsNew({ current: '1.1.0', lastSeen: '1.1.0', hadPriorInstall: true }).show).toBe(false);
  });
});

describe('project summary', () => {
  const summary = {
    warnings: [
      { warnings: [{ code: 'orphaned-parenthetical' }, { code: 'orphaned-parenthetical' }, { code: 'unmapped-shot-tag' }] },
      { warnings: [{ code: 'orphaned-parenthetical' }, { code: 'invalid-order' }] },
    ],
    notes: [{ notes: [{ code: 'bare-pause-line' }, { code: 'ambiguous-location' }] }],
    shotStats: { untagged: 31 },
  };

  it('counts fixable issues and untagged shots', () => {
    expect(projectSummaryCounts(summary)).toEqual({ orphanedParentheticals: 3, barePauseLines: 1, untaggedShots: 31 });
  });

  it('shows once per minor/major version, only when something is fixable', () => {
    const counts = { orphanedParentheticals: 3, barePauseLines: 0, untaggedShots: 0 };
    expect(decideProjectSummary('1.1.0', undefined, counts)).toBe(true);
    expect(decideProjectSummary('1.1.0', '1.1.0', counts)).toBe(false);
    expect(decideProjectSummary('1.1.5', '1.1.0', counts)).toBe(false);
    expect(decideProjectSummary('1.2.0', '1.1.0', counts)).toBe(true);
  });

  it('never shows for untagged shots alone', () => {
    expect(decideProjectSummary('1.1.0', undefined, { orphanedParentheticals: 0, barePauseLines: 0, untaggedShots: 40 })).toBe(false);
  });

  it('names each non-zero count, with correct plurals', () => {
    expect(projectSummaryMessage('Orun', { orphanedParentheticals: 340, barePauseLines: 1, untaggedShots: 31 })).toBe(
      '"Orun" has 340 orphaned parentheticals and 1 standalone pause line that can be fixed to standard Fountain. 31 shots also have no [tag] yet.',
    );
    expect(projectSummaryMessage('Demo', { orphanedParentheticals: 0, barePauseLines: 2, untaggedShots: 1 })).toBe(
      '"Demo" has 2 standalone pause lines that can be fixed to standard Fountain. 1 shot also has no [tag] yet.',
    );
  });
});
