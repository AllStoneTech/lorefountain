/**
 * Renders a Story Overview's Markdown body to HTML for the read-only view in
 * the Story Overview editor (`storyOverviewHtml.ts`). Pure — no `vscode`
 * import — so it's unit-testable on its own.
 *
 * The body is user-authored (and may have been written by an AI agent), so
 * unlike the bundled help docs (`helpHtml.ts`) it is treated as untrusted:
 * `html: false` makes markdown-it escape any raw HTML in the source instead
 * of passing it through, and markdown-it's own link validation already
 * rejects `javascript:`, `vbscript:`, `file:` and non-image `data:` URLs.
 * The webview's CSP additionally forbids scripts other than the editor's own
 * nonce'd one, so even a rendering bug couldn't execute injected script.
 */

import MarkdownIt from 'markdown-it';

const renderer = new MarkdownIt({ html: false, linkify: true, typographer: true });

/**
 * Render a Story Overview body from Markdown to an HTML fragment.
 *
 * @param markdown - The raw Markdown body, exactly as stored in `world/OVERVIEW.md`.
 * @returns A sanitized HTML fragment (no `<html>`/`<body>` wrapper), or an empty string for a blank body.
 */
export function renderStoryOverviewBody(markdown: string): string {
  if (markdown.trim() === '') return '';
  return renderer.render(markdown);
}
