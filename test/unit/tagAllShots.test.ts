/**
 * Unit tests for `shots/tagAllShots.ts`: project-wide tag planning. The tag
 * generation itself is tested in LoreFountain-Core (`tagShots.test.ts`).
 */

import { describe, expect, it } from 'vitest';
import { planProjectShotTags } from '../../src/shots/tagAllShots';

const script = (code: string | undefined, ...shots: string[]): string =>
  [...(code ? ['Title: Ep', `Production Code: ${code}`, ''] : []), 'INT. A - DAY', '', ...shots.flatMap((shot) => [shot, '']), ''].join('\n');

describe('planProjectShotTags', () => {
  it('prefixes each script with its own production code', () => {
    const plans = planProjectShotTags([
      { path: '/p/a.fountain', text: script('1x01', 'SHOT: WIDE') },
      { path: '/p/b.fountain', text: script('1x02', 'SHOT: WIDE') },
    ]);
    expect(plans.map((p) => p.plan.edits.map((e) => e.tag))).toEqual([['1x01-01-01'], ['1x02-01-01']]);
  });

  it('plans only the requested scripts but still reserves tags written elsewhere', () => {
    const scripts = [
      { path: '/p/a.fountain', text: script('1x01', 'SHOT: [1x01-01-01] WIDE') },
      { path: '/p/b.fountain', text: script('1x01', 'SHOT: WIDE') },
    ];
    const plans = planProjectShotTags(scripts, new Set(['/p/b.fountain']));
    expect(plans).toHaveLength(1);
    expect(plans[0].plan.edits[0].tag).toBe('1x01-01-02');
  });

  it('never gives two scripts the same new tag', () => {
    const plans = planProjectShotTags([
      { path: '/p/a.fountain', text: script('1x01', 'SHOT: WIDE') },
      { path: '/p/b.fountain', text: script('1x01', 'SHOT: WIDE') },
    ]);
    const tags = plans.flatMap((p) => p.plan.edits.map((e) => e.tag));
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('falls back to the file slug and skips a script with neither', () => {
    const fromSlug = planProjectShotTags([{ path: '/p/1x03-title.fountain', text: script(undefined, 'SHOT: WIDE') }]);
    expect(fromSlug[0].plan.edits[0].tag).toBe('1x03-title-01-01');
    const slugged = planProjectShotTags([{ path: '/p/Bad Name!.fountain', text: script(undefined, 'SHOT: WIDE') }]);
    expect(slugged[0].plan.edits[0].tag).toBe('bad-name-01-01');
    const neither = planProjectShotTags([{ path: '/p/日本語.fountain', text: script(undefined, 'SHOT: WIDE') }]);
    expect(neither[0].plan.edits).toEqual([]);
    expect(neither[0].plan.skipped).toHaveLength(1);
  });

  it('plans nothing for a script whose shots are all tagged', () => {
    expect(planProjectShotTags([{ path: '/p/a.fountain', text: script('1x01', 'SHOT: [a-wide] WIDE') }])).toEqual([]);
  });
});
