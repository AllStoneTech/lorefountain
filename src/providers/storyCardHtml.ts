/**
 * Story Card webview HTML (Spec §6.1). A static skeleton — no entity-specific
 * content is baked in here; the client script populates every field from an
 * `init`/`update` `postMessage`, and posts an `edit` message back on every
 * field change. Kept in its own module so `storyCardEditorProvider.ts` (the
 * `vscode`-facing glue) stays focused on wiring, not markup.
 *
 * Styled entirely with VS Code's `--vscode-*` CSS variables, so it matches
 * the user's current theme (light/dark/high-contrast) automatically with no
 * manual theme handling.
 */

/**
 * Build the webview's HTML document.
 *
 * @param cspSource - `webview.cspSource`, restricting resource loading to the webview's own origin.
 * @param nonce - A fresh per-load nonce, required to allow the inline `<script>` under the CSP.
 * @returns The full HTML document string.
 */
export function buildStoryCardHtml(cspSource: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>Story Card</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    padding: 1rem 1.5rem 3rem;
    max-width: 640px;
  }
  h1 { font-size: 1.1rem; margin: 0 0 1rem; }
  fieldset {
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    border-radius: 4px;
    margin: 0 0 1rem;
    padding: 0.75rem 1rem 1rem;
  }
  legend { font-weight: 600; opacity: 0.85; }
  label {
    display: block;
    margin: 0.6rem 0 0.2rem;
    font-size: 0.85rem;
    opacity: 0.85;
  }
  input[type="text"], select, textarea {
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
  textarea { min-height: 8rem; resize: vertical; }
  .hint { font-size: 0.75rem; opacity: 0.65; margin-top: 0.2rem; }
  .hidden { display: none; }
  .relation-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: 0.4rem;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  button {
    background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
    color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
    border: none;
    border-radius: 2px;
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
  }
  button:hover { opacity: 0.9; }
  #addRelation { margin-top: 0.2rem; }
  .remove-relation { padding: 0.35rem 0.5rem; }
</style>
</head>
<body>
  <h1 id="heading">Story Card</h1>

  <label for="name">Name</label>
  <input type="text" id="name" />

  <label for="type">Type</label>
  <select id="type">
    <option value="character">Character</option>
    <option value="location">Location</option>
    <option value="faction">Faction</option>
    <option value="object">Object</option>
    <option value="concept">Concept</option>
  </select>

  <label for="aliases">Aliases</label>
  <input type="text" id="aliases" placeholder="comma-separated" />

  <label for="pronunciation">Pronunciation</label>
  <input type="text" id="pronunciation" />

  <label for="tags">Tags</label>
  <input type="text" id="tags" placeholder="comma-separated" />

  <label for="canonStatus">Canon status</label>
  <select id="canonStatus">
    <option value="">(unset)</option>
    <option value="established">Established</option>
    <option value="tentative">Tentative</option>
    <option value="contradicted">Contradicted</option>
  </select>

  <fieldset id="characterFields">
    <legend>Character</legend>
    <label for="soundMotif">Sound motif</label>
    <input type="text" id="soundMotif" />
    <label for="castingNotes">Casting notes</label>
    <input type="text" id="castingNotes" />
  </fieldset>

  <fieldset id="locationFields">
    <legend>Location</legend>
    <label for="parentLocation">Parent location</label>
    <select id="parentLocation"><option value="">(none)</option></select>
    <label for="mobility">Mobility</label>
    <select id="mobility">
      <option value="">(unset)</option>
      <option value="fixed">Fixed</option>
      <option value="mobile-per-episode">Mobile (per episode)</option>
      <option value="mobile-continuous">Mobile (continuous)</option>
    </select>
  </fieldset>

  <fieldset>
    <legend>Relations</legend>
    <div id="relations"></div>
    <button id="addRelation" type="button">+ Add relation</button>
    <p class="hint">Deliberate, typed links to other entities (Spec §4.5) — separate from automatic mentions.</p>
  </fieldset>

  <label for="body">Description</label>
  <textarea id="body"></textarea>
  <p class="hint">For anything beyond these fields — <code>tracked_fields</code>, <code>custom_fields</code> — open this file as text (right-click the tab &rarr; Reopen Editor With&hellip;).</p>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      let entityCandidates = [];

      const el = (id) => document.getElementById(id);

      function relationRow(row, index) {
        const wrapper = document.createElement('div');
        wrapper.className = 'relation-row';

        const targetSelect = document.createElement('select');
        targetSelect.innerHTML = '<option value="">(select entity)</option>' +
          entityCandidates.map((c) =>
            '<option value="' + escapeAttr(c.id) + '"' + (c.id === row.target ? ' selected' : '') + '>' +
            escapeHtml(c.name) + '</option>'
          ).join('');
        targetSelect.addEventListener('change', () => updateRelation(index, 'target', targetSelect.value));

        const typeInput = document.createElement('input');
        typeInput.type = 'text';
        typeInput.placeholder = 'relation type (e.g. ally)';
        typeInput.value = row.relationType;
        typeInput.addEventListener('change', () => updateRelation(index, 'relationType', typeInput.value));

        const attitudeInput = document.createElement('input');
        attitudeInput.type = 'text';
        attitudeInput.placeholder = 'attitude (optional)';
        attitudeInput.value = row.attitude;
        attitudeInput.addEventListener('change', () => updateRelation(index, 'attitude', attitudeInput.value));

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'remove-relation';
        removeButton.textContent = '\\u2715';
        removeButton.title = 'Remove relation';
        removeButton.addEventListener('click', () => removeRelation(index));

        wrapper.append(targetSelect, typeInput, attitudeInput, removeButton);
        return wrapper;
      }

      function renderRelations(relations) {
        const container = el('relations');
        container.innerHTML = '';
        relations.forEach((row, index) => container.appendChild(relationRow(row, index)));
      }

      function currentFormState() {
        return {
          id: state.id,
          name: el('name').value,
          type: el('type').value,
          aliases: el('aliases').value,
          pronunciation: el('pronunciation').value,
          tags: el('tags').value,
          canonStatus: el('canonStatus').value,
          body: el('body').value,
          relations: state.relations,
          soundMotif: el('soundMotif').value,
          castingNotes: el('castingNotes').value,
          parentLocation: el('parentLocation').value,
          mobility: el('mobility').value,
        };
      }

      function postEdit() {
        state = currentFormState();
        vscode.postMessage({ type: 'edit', formState: state });
      }

      function updateRelation(index, field, value) {
        state.relations = state.relations.map((r, i) => (i === index ? { ...r, [field]: value } : r));
        postEdit();
      }

      function removeRelation(index) {
        state.relations = state.relations.filter((_, i) => i !== index);
        renderRelations(state.relations);
        postEdit();
      }

      function updateTypeVisibility(type) {
        el('characterFields').classList.toggle('hidden', type !== 'character');
        el('locationFields').classList.toggle('hidden', type !== 'location');
      }

      function populateParentLocationOptions(currentValue) {
        const select = el('parentLocation');
        const locationCandidates = entityCandidates.filter((c) => c.kind === 'location');
        select.innerHTML = '<option value="">(none)</option>' +
          locationCandidates.map((c) =>
            '<option value="' + escapeAttr(c.id) + '"' + (c.id === currentValue ? ' selected' : '') + '>' +
            escapeHtml(c.name) + '</option>'
          ).join('');
      }

      function applyFormState(formState) {
        state = formState;
        el('heading').textContent = formState.name || '(untitled)';
        el('name').value = formState.name;
        el('type').value = formState.type;
        el('aliases').value = formState.aliases;
        el('pronunciation').value = formState.pronunciation;
        el('tags').value = formState.tags;
        el('canonStatus').value = formState.canonStatus;
        el('body').value = formState.body;
        el('soundMotif').value = formState.soundMotif;
        el('castingNotes').value = formState.castingNotes;
        populateParentLocationOptions(formState.parentLocation);
        el('mobility').value = formState.mobility;
        renderRelations(formState.relations);
        updateTypeVisibility(formState.type);
      }

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      }
      function escapeAttr(value) {
        return escapeHtml(value);
      }

      let state = {
        id: '', name: '', type: 'character', aliases: '', pronunciation: '', tags: '',
        canonStatus: '', body: '', relations: [], soundMotif: '', castingNotes: '',
        parentLocation: '', mobility: '',
      };

      for (const id of ['name', 'aliases', 'pronunciation', 'tags', 'body', 'soundMotif', 'castingNotes']) {
        el(id).addEventListener('change', postEdit);
      }
      el('type').addEventListener('change', () => {
        updateTypeVisibility(el('type').value);
        postEdit();
      });
      el('canonStatus').addEventListener('change', postEdit);
      el('parentLocation').addEventListener('change', postEdit);
      el('mobility').addEventListener('change', postEdit);
      el('addRelation').addEventListener('click', () => {
        state.relations = [...state.relations, { target: '', relationType: '', attitude: '' }];
        renderRelations(state.relations);
      });

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'init' || message.type === 'update') {
          entityCandidates = message.entityCandidates;
          applyFormState(message.formState);
        }
      });

      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
}
