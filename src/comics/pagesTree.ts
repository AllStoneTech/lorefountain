/**
 * Pure label/node-building logic for the Scripts view's `Pages` section: turns
 * a comic script's `.pages.json` sidecar into plain display models (label,
 * description, tooltip, icon id, target line, issue flags) that
 * `providers/scriptsTreeProvider.ts` renders as `vscode.TreeItem`s. No `vscode`
 * or `fs` dependency, so it is fully unit-testable.
 *
 * Exports {@link readPagesModel} (tolerant text -> model), {@link buildPagesModel}
 * (validated sidecar -> model), the model types, and the formatting constants.
 *
 * Gotchas:
 * - Sidecar lines are 0-based, and so are the lines in the models.
 * - Issues carry only a line, so they are attributed to the page or panel whose
 *   inclusive line range contains it (a panel's issues also count for its page).
 * - Everything shown comes from the sidecar; nothing is recomputed from the script.
 */

import { parsePageSidecarText, type PageSidecar } from 'lorefountain-core/comics/pageSidecar';

/** Longest panel description shown in a label before it is cut with an ellipsis. */
export const PANEL_DESCRIPTION_MAX_CHARS = 60;

/** Codicon ids used by the Pages nodes. */
export const PAGES_ICONS = {
  section: 'book',
  page: 'file',
  panel: 'layout',
  warning: 'warning',
} as const;

/** One issue, as shown in a tooltip. */
export interface PagesIssueModel {
  severity: 'warning' | 'info';
  line: number;
  message: string;
}

/** Display model for one panel row. */
export interface PanelNodeModel {
  label: string;
  description: string;
  tooltip: string;
  /** 0-based line of the panel's first line, to open the script at. */
  line: number;
  /** Codicon id: the warning icon when any warning applies, else the panel icon. */
  iconId: string;
  /** True when a `warning` severity issue falls in this panel. */
  hasWarning: boolean;
  issues: PagesIssueModel[];
}

/** Display model for one page row and its panel children. */
export interface PageNodeModel {
  label: string;
  description: string;
  tooltip: string;
  line: number;
  iconId: string;
  hasWarning: boolean;
  issues: PagesIssueModel[];
  panels: PanelNodeModel[];
}

/** Display model for the whole `Pages` section of one script. */
export interface PagesSectionModel {
  label: string;
  description: string;
  tooltip: string;
  pages: PageNodeModel[];
}

type SidecarPage = PageSidecar['pages'][number];
type SidecarPanel = SidecarPage['panels'][number];
type SidecarIssue = PageSidecar['issues'][number];

/**
 * Parse sidecar text and build the section model. Never throws.
 *
 * @param text - The `.pages.json` file's contents.
 * @returns The model, or `undefined` when the text is malformed, newer than
 *   supported, invalid, or describes no pages (so no Pages section shows).
 */
export function readPagesModel(text: string): PagesSectionModel | undefined {
  const parsed = parsePageSidecarText(text);
  if (!parsed.ok) return undefined;
  return buildPagesModel(parsed.sidecar);
}

/**
 * Build the section model from a validated sidecar.
 *
 * @param sidecar - A validated page sidecar.
 * @returns The model, or `undefined` if the sidecar has no pages.
 */
export function buildPagesModel(sidecar: PageSidecar): PagesSectionModel | undefined {
  if (sidecar.pages.length === 0) return undefined;
  const pages = sidecar.pages.map((page) => buildPage(page, sidecar.issues));
  const summary = joinParts([
    plural(sidecar.totals.pages, 'page'),
    plural(sidecar.totals.panels, 'panel'),
    sidecar.totals.words > 0 ? plural(sidecar.totals.words, 'word') : undefined,
    issueSummary(sidecar.issues),
  ]);
  return {
    label: 'Pages',
    description: summary,
    tooltip: `${summary}\n\nDerived from the script; refreshed on save.`,
    pages,
  };
}

function buildPage(page: SidecarPage, allIssues: readonly SidecarIssue[]): PageNodeModel {
  const issues = issuesIn(allIssues, page.lines.start, page.lines.end);
  const hasWarning = issues.some((issue) => issue.severity === 'warning');
  const c = page.counts;
  const description = joinParts([
    ...page.modifiers,
    c.panels > 0 ? plural(c.panels, 'panel') : undefined,
    c.words > 0 ? plural(c.words, 'word') : undefined,
    issueSummary(issues),
  ]);
  const tooltip = joinLines([
    pageLabel(page),
    page.modifiers.length > 0 ? `Modifiers: ${page.modifiers.join(', ')}` : undefined,
    countsLine(c.panels, c),
    ...issueLines(issues),
  ]);
  return {
    label: pageLabel(page),
    description,
    tooltip,
    line: page.lines.start,
    iconId: hasWarning ? PAGES_ICONS.warning : PAGES_ICONS.page,
    hasWarning,
    issues,
    panels: page.panels.map((panel) => buildPanel(panel, allIssues)),
  };
}

function buildPanel(panel: SidecarPanel, allIssues: readonly SidecarIssue[]): PanelNodeModel {
  const issues = issuesIn(allIssues, panel.lines.start, panel.lines.end);
  const hasWarning = issues.some((issue) => issue.severity === 'warning');
  const c = panel.counts;
  const base = panel.number > 0 ? `Panel ${panel.number}` : 'Outside a panel';
  const snippet = truncate(panel.description ?? '', PANEL_DESCRIPTION_MAX_CHARS);
  const description = joinParts([
    c.balloons > 0 ? plural(c.balloons, 'balloon') : undefined,
    c.captions > 0 ? plural(c.captions, 'caption') : undefined,
    c.sfx > 0 ? `${c.sfx} SFX` : undefined,
    c.words > 0 ? plural(c.words, 'word') : undefined,
    issueSummary(issues),
  ]);
  const tooltip = joinLines([
    base,
    panel.description ? collapse(panel.description) : undefined,
    countsLine(undefined, c),
    ...issueLines(issues),
  ]);
  return {
    label: snippet ? `${base} — ${snippet}` : base,
    description,
    tooltip,
    line: panel.lines.start,
    iconId: hasWarning ? PAGES_ICONS.warning : PAGES_ICONS.panel,
    hasWarning,
    issues,
  };
}

/** `Page 7`, `Pages 2-3`, a text label as written, `Page` for a bare `PAGE:`, or a note for the implicit page. */
function pageLabel(page: SidecarPage): string {
  if (page.implicit) return 'Before the first PAGE:';
  const label = page.label.trim();
  if (label === '') return 'Page';
  if (page.number !== undefined) {
    return page.endNumber !== undefined && page.endNumber > page.number ? `Pages ${label}` : `Page ${label}`;
  }
  return label;
}

function countsLine(
  panels: number | undefined,
  c: { balloons: number; captions: number; sfx: number; words: number },
): string {
  return joinParts([
    panels === undefined ? undefined : plural(panels, 'panel'),
    plural(c.balloons, 'balloon'),
    plural(c.captions, 'caption'),
    plural(c.sfx, 'sound effect'),
    plural(c.words, 'word'),
  ]);
}

function issuesIn(all: readonly SidecarIssue[], start: number, end: number): PagesIssueModel[] {
  return all
    .filter((issue) => issue.line >= start && issue.line <= end)
    .map(({ severity, line, message }) => ({ severity, line, message }));
}

function issueSummary(issues: readonly { severity: 'warning' | 'info' }[]): string | undefined {
  if (issues.length === 0) return undefined;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  if (warnings > 0) return plural(warnings, 'warning');
  return plural(issues.length, 'note');
}

function issueLines(issues: readonly PagesIssueModel[]): string[] {
  if (issues.length === 0) return [];
  return ['', ...issues.map((issue) => `${issue.severity === 'warning' ? 'Warning' : 'Note'} (line ${issue.line + 1}): ${issue.message}`)];
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? noun : `${noun}s`}`;
}

function joinParts(parts: ReadonlyArray<string | undefined>): string {
  return parts.filter((part): part is string => part !== undefined && part !== '').join(' · ');
}

function joinLines(lines: ReadonlyArray<string | undefined>): string {
  return lines.filter((line): line is string => line !== undefined).join('\n');
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  const flat = collapse(text);
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).trimEnd()}…`;
}
