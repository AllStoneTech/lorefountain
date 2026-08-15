/**
 * Feedback webview HTML. Same split as `settingsHtml.ts` — a static
 * skeleton with no project-specific content baked in; the client script
 * posts a `submit` message back with the form's contents and shows whatever
 * status message the extension host posts back in reply.
 *
 * Styled entirely with VS Code's `--vscode-*` CSS variables, matching the
 * user's current theme automatically, same as every other webview here.
 */

/**
 * Build the feedback webview's HTML document.
 *
 * @param cspSource - `webview.cspSource`, restricting resource loading to the webview's own origin.
 * @param nonce - A fresh per-load nonce, required to allow the inline `<script>` under the CSP.
 * @returns The full HTML document string.
 */
export function buildFeedbackHtml(cspSource: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>LoreFountain Feedback</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    padding: 1rem 1.5rem 3rem;
    max-width: 560px;
  }
  h1 { font-size: 1.1rem; margin: 0 0 0.25rem; }
  .hint { font-size: 0.8rem; opacity: 0.75; margin: 0 0 1.25rem; line-height: 1.4; }
  label { display: block; font-weight: 600; font-size: 0.85rem; margin: 0 0 0.3rem; }
  select, textarea, input[type="email"] {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-widget-border, transparent));
    border-radius: 2px;
    padding: 0.4rem 0.5rem;
    font-family: inherit;
    font-size: 0.85rem;
  }
  textarea { min-height: 8rem; resize: vertical; }
  .field { margin: 0 0 1rem; }
  .field-hint { font-size: 0.75rem; opacity: 0.65; margin: 0.25rem 0 0; }
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
  button:disabled { opacity: 0.5; cursor: default; }
  #status { font-size: 0.8rem; opacity: 0.8; margin-left: 0.75rem; }
  #status.error { color: var(--vscode-errorForeground); opacity: 1; }
</style>
</head>
<body>
  <h1>Send Feedback</h1>
  <p class="hint">
    Bug, feature suggestion, or just how you use LoreFountain — all welcome.
    We'll also include your license tier, extension version, and OS to help
    investigate. Please don't paste story content — just describe what
    happened.
  </p>

  <div class="field">
    <label for="type">Type</label>
    <select id="type">
      <option value="suggestion">Feature suggestion</option>
      <option value="bug">Bug</option>
      <option value="general">General thoughts</option>
    </select>
  </div>

  <div class="field">
    <label for="body">Message</label>
    <textarea id="body" placeholder="What's on your mind?"></textarea>
  </div>

  <div class="field">
    <label for="email">Email (optional)</label>
    <input type="email" id="email" placeholder="you@example.com" />
    <p class="field-hint">Only if you'd like a reply.</p>
  </div>

  <button id="submit" type="button">Submit</button>
  <span id="status"></span>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const typeField = document.getElementById('type');
      const bodyField = document.getElementById('body');
      const emailField = document.getElementById('email');
      const submitButton = document.getElementById('submit');
      const status = document.getElementById('status');

      submitButton.addEventListener('click', () => {
        status.className = '';
        status.textContent = 'Sending…';
        submitButton.disabled = true;
        vscode.postMessage({
          type: 'submit',
          feedback: { type: typeField.value, body: bodyField.value, email: emailField.value },
        });
      });

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'result') {
          submitButton.disabled = false;
          if (message.ok) {
            status.className = '';
            status.textContent = 'Sent — thank you!';
            bodyField.value = '';
            emailField.value = '';
          } else {
            status.className = 'error';
            status.textContent = message.error || 'Could not send — try again later.';
          }
        }
      });
    })();
  </script>
</body>
</html>`;
}
