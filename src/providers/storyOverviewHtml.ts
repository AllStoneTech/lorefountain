/**
 * Story Overview webview HTML (ADR-0029). A static skeleton, same posture as
 * `storyCardHtml.ts`: the client script populates every field from an
 * `init`/`update` `postMessage`, and posts an `edit` message back on every
 * field change. Deliberately simple — four short text inputs plus one large
 * body textarea, no fieldsets or repeatable rows, since a Story Overview has
 * no type-specific variation.
 */

/**
 * Build the webview's HTML document.
 *
 * @param cspSource - `webview.cspSource`, restricting resource loading to the webview's own origin.
 * @param nonce - A fresh per-load nonce, required to allow the inline `<script>` under the CSP.
 * @returns The full HTML document string.
 */
export function buildStoryOverviewHtml(cspSource: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>Story Overview</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    padding: 1rem 1.5rem 3rem;
    max-width: 640px;
  }
  h1 { font-size: 1.1rem; margin: 0 0 1rem; }
  label {
    display: block;
    margin: 0.6rem 0 0.2rem;
    font-size: 0.85rem;
    opacity: 0.85;
  }
  input[type="text"], textarea {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    padding: 0.35rem 0.5rem;
    font-family: inherit;
    font-size: inherit;
  }
  textarea { min-height: 24rem; resize: vertical; font-family: var(--vscode-editor-font-family, monospace); }
  .hint { font-size: 0.75rem; opacity: 0.65; margin-top: 0.2rem; }
</style>
</head>
<body>
  <h1 id="heading">Story Overview</h1>

  <label for="title">Title</label>
  <input type="text" id="title" />

  <label for="pitch">Pitch</label>
  <input type="text" id="pitch" placeholder="One or two sentences — the logline" />

  <label for="tone">Tone</label>
  <input type="text" id="tone" placeholder="e.g. wry, elegiac, pulpy" />

  <label for="genre">Genre</label>
  <input type="text" id="genre" />

  <label for="body">Overview</label>
  <textarea id="body"></textarea>
  <p class="hint">Markdown — write whatever sections fit this project (Premise, Setting, Synopsis, Themes, or anything else). Nothing here is enforced by schema.</p>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const el = (id) => document.getElementById(id);

      function currentFormState() {
        return {
          title: el('title').value,
          pitch: el('pitch').value,
          tone: el('tone').value,
          genre: el('genre').value,
          body: el('body').value,
        };
      }

      function postEdit() {
        vscode.postMessage({ type: 'edit', formState: currentFormState() });
      }

      function applyFormState(formState) {
        el('heading').textContent = formState.title || 'Story Overview';
        el('title').value = formState.title;
        el('pitch').value = formState.pitch;
        el('tone').value = formState.tone;
        el('genre').value = formState.genre;
        el('body').value = formState.body;
      }

      for (const id of ['title', 'pitch', 'tone', 'genre', 'body']) {
        el(id).addEventListener('change', postEdit);
      }

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'init' || message.type === 'update') {
          applyFormState(message.formState);
        }
      });

      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
}
