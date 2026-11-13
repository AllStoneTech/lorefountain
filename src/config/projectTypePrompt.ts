/**
 * The "What kind of project is this?" prompt (ADR-0051), `vscode`-free part:
 * when to ask and what the dropdown holds. The glue that shows it lives in
 * `commands/projectType.ts`.
 *
 * Exports {@link decideProjectTypePrompt}, {@link projectTypePickItems} and
 * {@link SKIP_CHOICE}. Pure and unit-tested, so the rules for never nagging
 * are checked without an extension host.
 */

import { PROJECT_TYPES, PROJECT_TYPE_PROFILES, describeProjectType, type ProjectType } from 'lorefountain-core/config/projectType';

/** What the extension knows about a project when deciding whether to ask. */
export interface ProjectTypePromptState {
  /** Whether `lorefountain.config.json` exists. Without one there's nowhere to record an answer. */
  hasConfigFile: boolean;
  /** The valid `project_type` already in the config, if any. */
  projectType?: ProjectType;
  /** Whether the user has already been asked (or skipped) for this project. */
  alreadyAsked: boolean;
  /** The `lorefountain.notifications.projectType` setting. */
  enabled: boolean;
}

/**
 * Decide whether to ask a project for its type automatically.
 *
 * Asks only when the project has a config file, no type recorded, has never
 * been asked, and the user hasn't turned the prompt off. A project that
 * skipped is never asked again automatically; the Set Project Type command
 * stays available.
 *
 * @param state - What is known about the project.
 * @returns `true` when the prompt should show.
 */
export function decideProjectTypePrompt(state: ProjectTypePromptState): boolean {
  if (!state.enabled || !state.hasConfigFile) return false;
  if (state.projectType !== undefined) return false;
  return !state.alreadyAsked;
}

/** The dropdown's "no answer" entry: leaves the config untouched. */
export const SKIP_CHOICE = 'skip';

/** One entry in the project-type dropdown. */
export interface ProjectTypePickItem {
  /** The type to record, or {@link SKIP_CHOICE}. */
  value: ProjectType | typeof SKIP_CHOICE;
  label: string;
  description: string;
  detail: string;
}

/**
 * Build the dropdown's entries: every type in order, then a skip entry.
 *
 * @param current - The project's current type, marked in the list, if it has one.
 * @returns The entries, ready for a QuickPick.
 */
export function projectTypePickItems(current?: ProjectType): ProjectTypePickItem[] {
  const items: ProjectTypePickItem[] = PROJECT_TYPES.map((type) => {
    const profile = PROJECT_TYPE_PROFILES[type];
    return {
      value: type,
      label: profile.label,
      description: current === type ? `${profile.summary} (current)` : profile.summary,
      detail: describeProjectType(type).split('\n').slice(2).join('  ·  '),
    };
  });
  items.push({
    value: SKIP_CHOICE,
    label: 'Not sure yet / Skip',
    description: 'Leave the project as it is. You can set this any time with "LoreFountain: Set Project Type".',
    detail: '',
  });
  return items;
}
