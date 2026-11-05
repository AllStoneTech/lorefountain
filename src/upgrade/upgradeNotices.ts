/**
 * Pure decisions behind the two upgrade notices (ADR-0039):
 * - the **what's-new notice**, once per user per minor/major release; and
 * - the **post-upgrade project summary**, once per project per minor/major
 *   release, when the project has script formatting issues Fix All can fix.
 *
 * Exports {@link decideWhatsNew}, {@link whatsNewHeadline},
 * {@link projectSummaryCounts}, {@link decideProjectSummary} and
 * {@link projectSummaryMessage}. No `vscode` dependency; the glue is
 * `commands/upgradeNotices.ts`.
 *
 * Gotchas:
 * - Patch releases never notify.
 * - 1.0.0 never stored a version. An install that has 1.0's
 *   `lorefountain.deviceId` (written on every 1.0 activation) but no stored
 *   version is treated as an upgrade from 1.0.0; with neither, it's a fresh
 *   install and gets no notice. Never guessed the other way.
 */

import { compareVersions, parseVersion } from '../updates/versionCheck';

/** Facts about this install, captured at activation before anything writes to global state. */
export interface InstallState {
  /** The version currently running. */
  current: string;
  /** The version recorded on a previous activation, if any. */
  lastSeen?: string;
  /** True when 1.0-era global state (`lorefountain.deviceId`) existed before this activation. */
  hadPriorInstall: boolean;
}

/** Result of {@link decideWhatsNew}. */
export interface WhatsNewDecision {
  show: boolean;
  /** The version being upgraded from, when known. */
  previous?: string;
}

/**
 * Decide whether to show the what's-new notice.
 *
 * @param state - The install facts captured at activation.
 * @returns Whether to show it, and the version being upgraded from.
 */
export function decideWhatsNew(state: InstallState): WhatsNewDecision {
  const previous = state.lastSeen ?? (state.hadPriorInstall ? '1.0.0' : undefined);
  if (previous === undefined) return { show: false };
  return { show: isFeatureRelease(previous, state.current), previous };
}

/**
 * True when `current` is a newer minor or major release than `previous`.
 * Patch bumps, downgrades and unparseable versions are never feature releases.
 *
 * @param previous - The older version.
 * @param current - The newer version.
 * @returns Whether `current` adds a minor or major version over `previous`.
 */
export function isFeatureRelease(previous: string, current: string): boolean {
  const before = parseVersion(previous);
  const after = parseVersion(current);
  if (!before || !after || (compareVersions(current, previous) ?? 0) <= 0) return false;
  return after[0] > before[0] || (after[0] === before[0] && after[1] > before[1]);
}

/** Headlines for the what's-new notice, keyed by `major.minor`. */
const WHATS_NEW_HEADLINES: Readonly<Record<string, string>> = {
  '1.1': 'shot maps, scene pauses, and quick fixes for script formatting.',
};

/**
 * The what's-new notice text for a version.
 *
 * @param version - The running version.
 * @returns e.g. `LoreFountain 1.1: shot maps, ...`, or a generic line for a version with no headline.
 */
export function whatsNewHeadline(version: string): string {
  const parsed = parseVersion(version);
  const key = parsed ? `${parsed[0]}.${parsed[1]}` : version;
  const headline = WHATS_NEW_HEADLINES[key];
  return headline ? `LoreFountain ${key}: ${headline}` : `LoreFountain ${key} is here.`;
}

/** The counts the project summary reports. */
export interface ProjectSummaryCounts {
  orphanedParentheticals: number;
  barePauseLines: number;
  untaggedShots: number;
}

/** The parts of an index build summary the project summary reads. */
export interface SummaryLike {
  warnings: ReadonlyArray<{ warnings: ReadonlyArray<{ code?: string }> }>;
  notes: ReadonlyArray<{ notes: ReadonlyArray<{ code?: string }> }>;
  shotStats: { untagged: number };
}

/**
 * Count the project summary's numbers from a full index build.
 *
 * @param summary - The build summary.
 * @returns Fixable and informational counts.
 */
export function projectSummaryCounts(summary: SummaryLike): ProjectSummaryCounts {
  let orphanedParentheticals = 0;
  let barePauseLines = 0;
  for (const entry of summary.warnings) {
    orphanedParentheticals += entry.warnings.filter((warning) => warning.code === 'orphaned-parenthetical').length;
  }
  for (const entry of summary.notes) {
    barePauseLines += entry.notes.filter((note) => note.code === 'bare-pause-line').length;
  }
  return { orphanedParentheticals, barePauseLines, untaggedShots: summary.shotStats.untagged };
}

/**
 * Decide whether to show the project summary: only when something is
 * fixable (untagged shots alone never trigger it), and only once per
 * minor/major version per project.
 *
 * @param current - The running version.
 * @param lastShownVersion - The version this project's summary was last shown under, if ever.
 * @param counts - The project's counts.
 * @returns Whether to show it.
 */
export function decideProjectSummary(current: string, lastShownVersion: string | undefined, counts: ProjectSummaryCounts): boolean {
  if (counts.orphanedParentheticals + counts.barePauseLines === 0) return false;
  return lastShownVersion === undefined || isFeatureRelease(lastShownVersion, current);
}

/**
 * The project summary notification text.
 *
 * @param folderName - The workspace folder's name.
 * @param counts - The project's counts.
 * @returns One or two sentences naming each non-zero count.
 */
export function projectSummaryMessage(folderName: string, counts: ProjectSummaryCounts): string {
  const fixable: string[] = [];
  if (counts.orphanedParentheticals > 0) fixable.push(plural(counts.orphanedParentheticals, 'orphaned parenthetical'));
  if (counts.barePauseLines > 0) fixable.push(plural(counts.barePauseLines, 'standalone pause line'));
  let message = `"${folderName}" has ${fixable.join(' and ')} that can be fixed to standard Fountain.`;
  if (counts.untaggedShots > 0) message += ` ${plural(counts.untaggedShots, 'shot')} also ${counts.untaggedShots === 1 ? 'has' : 'have'} no [tag] yet.`;
  return message;
}

/** `1 shot`, `2 shots`. */
function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
