/**
 * Which editor opens which LoreFountain project document (ADR-0047). Pure (no
 * `vscode`), so the routing is unit-tested; the Story Card provider uses it to
 * hand a `*.lf.md` file it was wrongly given to the right editor.
 *
 * Exports {@link STYLE_BIBLE_VIEW_TYPE}, {@link STORY_OVERVIEW_VIEW_TYPE} and
 * {@link editorViewTypeForProjectDocument}.
 * A future project document with no guided editor opens as text (`default`),
 * never as an entity form.
 */

import * as path from 'node:path';
import { STYLE_BIBLE_FILE_NAME } from 'lorefountain-core/model/styleBible';
import { OVERVIEW_FILE_NAME } from 'lorefountain-core/project/storyOverview';

/** The guided style bible editor's view type (must match package.json's `customEditors`). */
export const STYLE_BIBLE_VIEW_TYPE = 'lorefountain.styleBible';

/** The Story Overview editor's view type (must match package.json's `customEditors`). */
export const STORY_OVERVIEW_VIEW_TYPE = 'lorefountain.storyOverview';

/**
 * The view type to open a project document with.
 *
 * @param filePath - Path of a `*.lf.md` file.
 * @returns The guided editor's view type for a known document, otherwise `default` (the text editor).
 */
export function editorViewTypeForProjectDocument(filePath: string): string {
  const name = path.basename(filePath).toLowerCase();
  if (name === STYLE_BIBLE_FILE_NAME) return STYLE_BIBLE_VIEW_TYPE;
  if (name === OVERVIEW_FILE_NAME) return STORY_OVERVIEW_VIEW_TYPE;
  return 'default';
}
