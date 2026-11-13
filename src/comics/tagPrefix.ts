/**
 * The prefix for a comic script's default panel tags (`<prefix>-p7-2`,
 * ADR-0046 here, ADR-0003 in LoreFountain-Core): the script's title-page
 * `Production Code`, else the script file's slug. Returns `undefined` when
 * neither is a plain ASCII slug, so the tag simply has no prefix.
 *
 * Exports {@link panelTagPrefixFor}. No `vscode` dependency; callable from the
 * headless validator.
 */

import * as path from 'node:path';
import { parseScriptTitlePage } from '../model/script';
import { idFromFilePath } from '../model/slug';

/** The shape a tag prefix must have (the same slug rule as every asset tag). */
const TAG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Work out a script's default-panel-tag prefix.
 *
 * @param scriptPath - Absolute path to the `.fountain` script.
 * @param scriptText - The script's current text (for its `Production Code:`).
 * @returns The lowercase production code when it is a slug, else the file's slug when it is one, else `undefined`.
 */
export function panelTagPrefixFor(scriptPath: string, scriptText: string): string | undefined {
  const id = idFromFilePath(scriptPath);
  const { script } = parseScriptTitlePage(scriptText, { id, filePath: path.resolve(scriptPath) });
  const code = script.frontmatter.productionCode?.trim().toLowerCase();
  if (code !== undefined && TAG_SLUG.test(code)) return code;
  return TAG_SLUG.test(id) ? id : undefined;
}
