/**
 * Plans "Tag all shots" across a project's scripts (ADR-0054, built on Core's
 * `shots/tagShots`). No `vscode` dependency, so it is unit-tested and usable
 * from a headless check.
 *
 * Exports {@link planProjectShotTags}. Each script's prefix is its title-page
 * Production Code (else its file slug), as for default panel tags. Tags already
 * written anywhere in the project are reserved, and every newly planned tag is
 * reserved for the scripts after it, so a generated tag is unique across the
 * whole project, not only within its script.
 */

import { extractShots } from 'lorefountain-core/shots/parseShots';
import { planShotTags, type ShotTagPlan } from 'lorefountain-core/shots/tagShots';
import { panelTagPrefixFor } from '../comics/tagPrefix';

/** One script to consider. */
export interface ScriptSource {
  /** Absolute path to the `.fountain` file. */
  path: string;
  /** The script's current text. */
  text: string;
}

/** A script's tagging plan. */
export interface ScriptTagPlan {
  path: string;
  plan: ShotTagPlan;
}

/**
 * Plan tags for the untagged shots of some scripts.
 *
 * @param scripts - Every script in the project, so tags written anywhere are never reused.
 * @param only - Absolute paths to plan for; every script when omitted.
 * @returns One plan per script that has untagged shots, in the order given.
 */
export function planProjectShotTags(scripts: readonly ScriptSource[], only?: ReadonlySet<string>): ScriptTagPlan[] {
  const reserved = new Set<string>();
  for (const script of scripts) {
    for (const shot of extractShots(script.text)) if (shot.tag !== undefined) reserved.add(shot.tag);
  }

  const plans: ScriptTagPlan[] = [];
  for (const script of scripts) {
    if (only !== undefined && !only.has(script.path)) continue;
    const plan = planShotTags(script.text, panelTagPrefixFor(script.path, script.text), reserved);
    for (const edit of plan.edits) reserved.add(edit.tag);
    if (plan.edits.length > 0 || plan.skipped.length > 0) plans.push({ path: script.path, plan });
  }
  return plans;
}
