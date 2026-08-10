/**
 * Renders a bundled help Markdown doc (`resources/help/*.md`) into a themed
 * HTML document for the help webview panel (`helpPanel.ts`). Uses
 * `markdown-it` with HTML input disabled — these docs are extension-authored
 * and never contain user data, but there's still no reason to parse raw HTML
 * out of them.
 *
 * Styled entirely with VS Code's `--vscode-*` CSS variables, matching the
 * user's current theme automatically, same as the Settings and Story Card
 * webviews (`settingsHtml.ts`, `storyCardHtml.ts`).
 */

import MarkdownIt from 'markdown-it';

const renderer = new MarkdownIt({ html: false, linkify: false, typographer: true });

/**
 * Build the help webview's HTML document from a doc's raw Markdown source.
 *
 * @param cspSource - `webview.cspSource`, restricting resource loading to the webview's own origin.
 * @param title - Heading shown above the rendered content (also used as the document `<title>`).
 * @param markdown - The raw Markdown source to render.
 * @returns The full HTML document string.
 */
export function buildHelpHtml(cspSource: string, title: string, markdown: string): string {
  const body = renderer.render(markdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline';">
<title>${escapeHtml(title)}</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    line-height: 1.6;
    padding: 1rem 2rem 3rem;
    max-width: 46rem;
  }
  h1, h2, h3 { font-weight: 600; line-height: 1.3; }
  h1 { font-size: 1.4rem; margin: 0 0 1rem; }
  h2 { font-size: 1.1rem; margin: 1.75rem 0 0.5rem; border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); padding-bottom: 0.25rem; }
  h3 { font-size: 1rem; margin: 1.25rem 0 0.4rem; }
  p { margin: 0.6rem 0; }
  ul, ol { padding-left: 1.4rem; margin: 0.5rem 0; }
  li { margin: 0.35rem 0; }
  li > ul, li > ol { margin: 0.35rem 0; }
  code {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.9em;
    background: var(--vscode-textCodeBlock-background);
    padding: 0.1em 0.35em;
    border-radius: 3px;
  }
  pre {
    background: var(--vscode-textCodeBlock-background);
    padding: 0.75rem 1rem;
    border-radius: 4px;
    overflow-x: auto;
  }
  pre code { background: none; padding: 0; }
  a { color: var(--vscode-textLink-foreground); }
  a:hover { color: var(--vscode-textLink-activeForeground); }
  strong { font-weight: 600; }
  hr { border: none; border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); margin: 1.5rem 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
