/**
 * Settings webview HTML (v1 scope: World-category visibility only). A static
 * skeleton, same split as `storyCardHtml.ts` — no project-specific content
 * baked in here; the client script populates the checkbox list from an
 * `init` `postMessage` and posts a `save` message back on click.
 *
 * Styled entirely with VS Code's `--vscode-*` CSS variables, matching the
 * user's current theme automatically, same as the Story Card webview.
 */

/** One World-tree category offered as a show/hide checkbox. */
export interface SettingsCategoryOption {
  id: string;
  label: string;
}

/**
 * Build the settings webview's HTML document.
 *
 * @param cspSource - `webview.cspSource`, restricting resource loading to the webview's own origin.
 * @param nonce - A fresh per-load nonce, required to allow the inline `<script>` under the CSP.
 * @param categories - Every World-tree category, in display order, offered as a checkbox.
 * @returns The full HTML document string.
 */
export function buildSettingsHtml(cspSource: string, nonce: string, categories: readonly SettingsCategoryOption[]): string {
  const checkboxes = categories
    .map(
      (category) =>
        `<label class="checkbox-row"><input type="checkbox" data-category="${escapeAttr(category.id)}" /> ${escapeHtml(category.label)}</label>`,
    )
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>LoreFountain Settings</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    padding: 1rem 1.5rem 3rem;
    max-width: 480px;
  }
  h1 { font-size: 1.1rem; margin: 0 0 0.25rem; }
  .hint { font-size: 0.75rem; opacity: 0.65; margin: 0 0 1rem; }
  fieldset {
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    border-radius: 4px;
    margin: 0 0 1rem;
    padding: 0.75rem 1rem 1rem;
  }
  legend { font-weight: 600; opacity: 0.85; }
  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.4rem 0;
    font-size: 0.9rem;
  }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 2px;
    padding: 0.4rem 0.9rem;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
  }
  button:hover { opacity: 0.9; }
  #status { font-size: 0.8rem; opacity: 0.7; margin-left: 0.75rem; }
</style>
</head>
<body>
  <h1>World View</h1>
  <p class="hint">Hide categories this project doesn't use. Nothing is deleted — hidden categories just don't appear in the sidebar.</p>

  <fieldset>
    <legend>Visible categories</legend>
    ${checkboxes}
  </fieldset>

  <button id="save" type="button">Save</button>
  <span id="status"></span>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const checkboxes = Array.from(document.querySelectorAll('input[data-category]'));

      function applyHidden(hiddenCategories) {
        const hidden = new Set(hiddenCategories);
        for (const box of checkboxes) {
          box.checked = !hidden.has(box.dataset.category);
        }
      }

      document.getElementById('save').addEventListener('click', () => {
        const hiddenCategories = checkboxes.filter((box) => !box.checked).map((box) => box.dataset.category);
        vscode.postMessage({ type: 'save', hiddenCategories });
        const status = document.getElementById('status');
        status.textContent = 'Saved.';
        setTimeout(() => { status.textContent = ''; }, 2000);
      });

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'init') {
          applyHidden(message.hiddenCategories);
        }
      });

      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
function escapeAttr(value: string): string {
  return escapeHtml(value);
}
