/**
 * Story Overview webview HTML (ADR-0029). A static skeleton, same posture as
 * `storyCardHtml.ts`: the client script populates every field from an
 * `init`/`update` `postMessage`, and posts an `edit` message back on every
 * field change. Deliberately simple — four short text inputs plus one large
 * body, no fieldsets or repeatable rows, since a Story Overview has no
 * type-specific variation.
 *
 * The body shows as rendered Markdown by default (the host renders it, see
 * `storyOverviewRender.ts`, and sends the HTML alongside the form state) and
 * only drops into the raw `<textarea>` when the writer clicks Edit or
 * double-clicks the text — closer to how a Markdown body reads in Notion or
 * Obsidian than an always-open text box. An empty body opens straight into
 * the textarea, since there's nothing to render yet.
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
  [hidden] { display: none !important; }
  .rendered {
    line-height: 1.6;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, transparent));
    border-radius: 2px;
    min-height: 3rem;
    cursor: text;
  }
  .rendered h1, .rendered h2, .rendered h3 { font-weight: 600; line-height: 1.3; }
  .rendered h1 { font-size: 1.2rem; margin: 1rem 0 0.5rem; }
  .rendered h2 { font-size: 1.05rem; margin: 1.2rem 0 0.4rem; }
  .rendered h3 { font-size: 1rem; margin: 1rem 0 0.3rem; }
  .rendered p { margin: 0.5rem 0; }
  .rendered ul, .rendered ol { padding-left: 1.4rem; margin: 0.5rem 0; }
  .rendered code {
    font-family: var(--vscode-editor-font-family, monospace);
    background: var(--vscode-textCodeBlock-background);
    padding: 0.1em 0.35em;
    border-radius: 3px;
  }
  .rendered pre { background: var(--vscode-textCodeBlock-background); padding: 0.6rem 0.8rem; overflow-x: auto; }
  .rendered pre code { background: none; padding: 0; }
  .rendered blockquote { margin: 0.5rem 0; padding-left: 0.8rem; border-left: 3px solid var(--vscode-textBlockQuote-border, currentColor); opacity: 0.85; }
  .rendered a { color: var(--vscode-textLink-foreground); }
  button {
    margin-top: 0.5rem;
    padding: 0.25rem 0.9rem;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 2px;
    cursor: pointer;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
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
  <div id="bodyView" class="rendered" title="Double-click to edit"></div>
  <textarea id="body"></textarea>
  <button type="button" id="toggleEdit">Edit</button>
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

      // Editing is entered by the Edit button, a double-click on the rendered
      // text, or focusing the textarea; an empty body always shows the
      // textarea (nothing to render). Leaving via Done returns to the view.
      let editing = false;

      function refreshBodyMode() {
        const empty = el('body').value.trim() === '';
        const showEditor = editing || empty;
        el('body').hidden = !showEditor;
        el('bodyView').hidden = showEditor;
        el('toggleEdit').hidden = empty && !editing;
        el('toggleEdit').textContent = editing ? 'Done' : 'Edit';
      }

      function applyFormState(formState, renderedBody) {
        el('heading').textContent = formState.title || 'Story Overview';
        el('title').value = formState.title;
        el('pitch').value = formState.pitch;
        el('tone').value = formState.tone;
        el('genre').value = formState.genre;
        el('body').value = formState.body;
        // renderedBody is HTML produced on the extension host by markdown-it
        // with raw HTML disabled (storyOverviewRender.ts) — never built here
        // from the file's text.
        el('bodyView').innerHTML = renderedBody || '';
        refreshBodyMode();
      }

      el('toggleEdit').addEventListener('click', () => {
        editing = !editing;
        refreshBodyMode();
        if (editing) el('body').focus();
      });
      el('bodyView').addEventListener('dblclick', () => {
        editing = true;
        refreshBodyMode();
        el('body').focus();
      });
      el('body').addEventListener('focus', () => {
        editing = true;
        refreshBodyMode();
      });

      for (const id of ['title', 'pitch', 'tone', 'genre', 'body']) {
        el(id).addEventListener('change', postEdit);
      }

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'init' || message.type === 'update') {
          applyFormState(message.formState, message.renderedBody);
        }
      });

      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
}
