/**
 * Asset manifest webview HTML (see `manifestEditorProvider.ts`). A static
 * skeleton — no manifest-specific content is baked in here; the client
 * script renders every row from an `update` `postMessage` and posts an
 * `edit` message back on every change. Kept in its own module so
 * `manifestEditorProvider.ts` (the `vscode`-facing glue) stays focused on
 * wiring, not markup — same split as `storyCardHtml.ts`/`storyCardEditorProvider.ts`.
 *
 * One HTML/JS payload serves all five manifest kinds — `kind` is baked in at
 * build time (it can't change without closing and reopening a different
 * file) and drives two things client-side: whether a row is flat (`audio`)
 * or versioned (`characters`/`locations`/`objects`/`voice`), and — for a
 * versioned kind — whether it has a variant sub-list at all, and what to
 * call it ("Looks" for characters, "Dressing" for locations/objects, none
 * for voice).
 *
 * Styled entirely with VS Code's `--vscode-*` CSS variables, so it matches
 * the user's current theme automatically, same as the Story Card editor.
 */

import type { ManifestKind } from './manifestForm';

/** Human-facing title and a one-line explanation per manifest kind, shown at the top of the form. */
const KIND_INFO: Record<ManifestKind, { title: string; hint: string }> = {
  audio: {
    title: 'Audio Manifest',
    hint: 'Maps a tagged SFX:/MUSIC:/AMB: cue (e.g. "SFX: [kola-nuts-clatter] ...") to the file that fulfills it, so the same sound is reused everywhere that tag recurs.',
  },
  characters: {
    title: 'Character Asset Manifest',
    hint: 'Each entry keys off an existing character entity. Versions are the character\'s persistent baseline over story-time (a scar in Season 2 stays in every later version); Looks are temporary, swappable variants (wardrobe, non-permanent makeup) layered on top of whichever version is active.',
  },
  locations: {
    title: 'Location Asset Manifest',
    hint: 'Each entry keys off an existing location entity. Versions are the location\'s persistent baseline (a renovated office); Dressing is a temporary, swappable condition (night vs. day, a one-off broken desk).',
  },
  objects: {
    title: 'Object Asset Manifest',
    hint: 'Each entry keys off an existing object (prop) entity. Versions are the object\'s persistent baseline (a permanently burned letter); Dressing is a temporary, swappable condition.',
  },
  voice: {
    title: 'Voice Asset Manifest',
    hint: 'Each entry keys off an existing character entity, mapping to the voice model/reference that speaks their lines. Versions only — no temporary variant layer.',
  },
};

/** For a versioned kind, the label its variant sub-list is shown under, or `undefined` for a kind with no variant axis. */
function variantLabelFor(kind: ManifestKind): string | undefined {
  if (kind === 'characters') return 'Looks';
  if (kind === 'locations' || kind === 'objects') return 'Dressing';
  return undefined;
}

/**
 * Build the webview's HTML document.
 *
 * @param cspSource - `webview.cspSource`, restricting resource loading to the webview's own origin.
 * @param nonce - A fresh per-load nonce, required to allow the inline `<script>` under the CSP.
 * @param kind - Which of the five manifest files this webview instance is editing.
 * @returns The full HTML document string.
 */
export function buildManifestHtml(cspSource: string, nonce: string, kind: ManifestKind): string {
  const info = KIND_INFO[kind];
  const isFlat = kind === 'audio';
  const variantLabel = variantLabelFor(kind);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>${escapeHtmlStatic(info.title)}</title>
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    padding: 1rem 1.5rem 3rem;
    max-width: 760px;
  }
  h1 { font-size: 1.1rem; margin: 0 0 0.3rem; }
  p.hint { font-size: 0.8rem; opacity: 0.7; margin: 0 0 1rem; }
  fieldset {
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    border-radius: 4px;
    margin: 0 0 1rem;
    padding: 0.75rem 1rem 1rem;
  }
  fieldset fieldset { background: var(--vscode-editorWidget-background, transparent); margin-top: 0.6rem; }
  legend { font-weight: 600; opacity: 0.85; }
  label {
    display: block;
    margin: 0.6rem 0 0.2rem;
    font-size: 0.85rem;
    opacity: 0.85;
  }
  input[type="text"], select {
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
  button {
    background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
    color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
    border: none;
    border-radius: 2px;
    padding: 0.35rem 0.7rem;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
    margin-top: 0.4rem;
  }
  button:hover { opacity: 0.9; }
  .entry-row { margin-bottom: 1rem; }
  .entry-row-header { display: grid; grid-template-columns: 1fr auto; gap: 0.4rem; align-items: end; }
  .sub-row {
    display: grid;
    grid-template-columns: 1fr 2fr 1.5fr 1.5fr auto;
    gap: 0.4rem;
    align-items: center;
    margin-bottom: 0.4rem;
  }
  .sub-row input { margin: 0; }
  .flat-row {
    display: grid;
    grid-template-columns: 1.5fr 2fr 1.5fr 1.5fr auto;
    gap: 0.4rem;
    align-items: center;
    margin-bottom: 0.6rem;
  }
  .flat-row input { margin: 0; }
  .remove-btn { padding: 0.35rem 0.5rem; margin-top: 0; }
  .sub-legend { font-size: 0.85rem; opacity: 0.85; margin: 0.4rem 0 0.3rem; font-weight: 600; }
  .empty-hint { font-size: 0.8rem; opacity: 0.6; margin: 0.3rem 0; }
</style>
</head>
<body>
  <h1>${escapeHtmlStatic(info.title)}</h1>
  <p class="hint">${escapeHtmlStatic(info.hint)}</p>

  <div id="rows"></div>
  <button id="addRow" type="button">+ Add Entry</button>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const kind = ${JSON.stringify(kind)};
      const isFlat = ${JSON.stringify(isFlat)};
      const variantLabel = ${JSON.stringify(variantLabel ?? null)};
      let entityCandidates = [];
      let state = { kind, rows: [] };

      const el = (id) => document.getElementById(id);

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      }

      function postEdit() {
        vscode.postMessage({ type: 'edit', formState: state });
      }

      function emptyVersionRow() { return { version: '', file: '', source: '', license: '' }; }
      function emptyVariantRow() { return { label: '', file: '', source: '', license: '' }; }
      function emptyFlatRow() { return { key: '', file: '', source: '', license: '' }; }
      function emptyVersionedRow() { return { key: '', versions: [emptyVersionRow()], variants: [] }; }

      // --- key picker (entity-keyed kinds only) ---

      function keySelect(currentValue, rowIndex, onChange) {
        const select = document.createElement('select');
        const usedElsewhere = new Set(
          state.rows.filter((_, i) => i !== rowIndex).map((r) => r.key).filter(Boolean),
        );
        const available = entityCandidates.filter((c) => c.id === currentValue || !usedElsewhere.has(c.id));
        select.innerHTML = '<option value="">(select entity)</option>' +
          available.map((c) =>
            '<option value="' + escapeHtml(c.id) + '"' + (c.id === currentValue ? ' selected' : '') + '>' +
            escapeHtml(c.name) + ' (' + escapeHtml(c.id) + ')</option>'
          ).join('');
        select.addEventListener('change', () => onChange(select.value));
        return select;
      }

      // --- sub-rows: versions and variants ---

      function subRow(row, labelPlaceholder, labelField, onFieldChange, onRemove) {
        const wrapper = document.createElement('div');
        wrapper.className = 'sub-row';

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.placeholder = labelPlaceholder;
        labelInput.value = row[labelField];
        labelInput.addEventListener('change', () => onFieldChange(labelField, labelInput.value));

        const fileInput = document.createElement('input');
        fileInput.type = 'text';
        fileInput.placeholder = 'file path';
        fileInput.value = row.file;
        fileInput.addEventListener('change', () => onFieldChange('file', fileInput.value));

        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.placeholder = 'source (optional)';
        sourceInput.value = row.source;
        sourceInput.addEventListener('change', () => onFieldChange('source', sourceInput.value));

        const licenseInput = document.createElement('input');
        licenseInput.type = 'text';
        licenseInput.placeholder = 'license (optional)';
        licenseInput.value = row.license;
        licenseInput.addEventListener('change', () => onFieldChange('license', licenseInput.value));

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'remove-btn';
        removeButton.textContent = '\\u2715';
        removeButton.title = 'Remove';
        removeButton.addEventListener('click', onRemove);

        wrapper.append(labelInput, fileInput, sourceInput, licenseInput, removeButton);
        return wrapper;
      }

      function renderVersions(container, rowIndex) {
        container.innerHTML = '';
        state.rows[rowIndex].versions.forEach((version, versionIndex) => {
          container.appendChild(subRow(
            version, 'version (e.g. 1)', 'version',
            (field, value) => updateVersionField(rowIndex, versionIndex, field, value),
            () => removeVersion(rowIndex, versionIndex),
          ));
        });
      }

      function renderVariants(container, rowIndex) {
        container.innerHTML = '';
        state.rows[rowIndex].variants.forEach((variant, variantIndex) => {
          container.appendChild(subRow(
            variant, 'label (e.g. night)', 'label',
            (field, value) => updateVariantField(rowIndex, variantIndex, field, value),
            () => removeVariant(rowIndex, variantIndex),
          ));
        });
      }

      function updateVersionField(rowIndex, versionIndex, field, value) {
        state.rows = state.rows.map((r, i) => i !== rowIndex ? r : {
          ...r, versions: r.versions.map((v, vi) => vi === versionIndex ? { ...v, [field]: value } : v),
        });
        postEdit();
      }

      function removeVersion(rowIndex, versionIndex) {
        state.rows = state.rows.map((r, i) => i !== rowIndex ? r : {
          ...r, versions: r.versions.filter((_, vi) => vi !== versionIndex),
        });
        renderRows();
        postEdit();
      }

      function updateVariantField(rowIndex, variantIndex, field, value) {
        state.rows = state.rows.map((r, i) => i !== rowIndex ? r : {
          ...r, variants: r.variants.map((v, vi) => vi === variantIndex ? { ...v, [field]: value } : v),
        });
        postEdit();
      }

      function removeVariant(rowIndex, variantIndex) {
        state.rows = state.rows.map((r, i) => i !== rowIndex ? r : {
          ...r, variants: r.variants.filter((_, vi) => vi !== variantIndex),
        });
        renderRows();
        postEdit();
      }

      // --- top-level rows ---

      function updateRowField(rowIndex, field, value) {
        state.rows = state.rows.map((r, i) => i === rowIndex ? { ...r, [field]: value } : r);
        postEdit();
      }

      function removeRow(rowIndex) {
        state.rows = state.rows.filter((_, i) => i !== rowIndex);
        renderRows();
        postEdit();
      }

      function flatRowElement(row, rowIndex) {
        const wrapper = document.createElement('div');
        wrapper.className = 'flat-row';

        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.placeholder = 'cue tag';
        keyInput.value = row.key;
        keyInput.addEventListener('change', () => updateRowField(rowIndex, 'key', keyInput.value));

        const fileInput = document.createElement('input');
        fileInput.type = 'text';
        fileInput.placeholder = 'file path';
        fileInput.value = row.file;
        fileInput.addEventListener('change', () => updateRowField(rowIndex, 'file', fileInput.value));

        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.placeholder = 'source (optional)';
        sourceInput.value = row.source;
        sourceInput.addEventListener('change', () => updateRowField(rowIndex, 'source', sourceInput.value));

        const licenseInput = document.createElement('input');
        licenseInput.type = 'text';
        licenseInput.placeholder = 'license (optional)';
        licenseInput.value = row.license;
        licenseInput.addEventListener('change', () => updateRowField(rowIndex, 'license', licenseInput.value));

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'remove-btn';
        removeButton.textContent = '\\u2715 Remove';
        removeButton.addEventListener('click', () => removeRow(rowIndex));

        wrapper.append(keyInput, fileInput, sourceInput, licenseInput, removeButton);
        return wrapper;
      }

      function versionedRowElement(row, rowIndex) {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'entry-row';

        const header = document.createElement('div');
        header.className = 'entry-row-header';

        const keyWrapper = document.createElement('div');
        const keyLabel = document.createElement('label');
        keyLabel.textContent = 'Entity';
        const select = keySelect(row.key, rowIndex, (value) => updateRowField(rowIndex, 'key', value));
        keyWrapper.append(keyLabel, select);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = '\\u2715 Remove entry';
        removeButton.addEventListener('click', () => removeRow(rowIndex));

        header.append(keyWrapper, removeButton);
        fieldset.appendChild(header);

        const versionsLegend = document.createElement('div');
        versionsLegend.className = 'sub-legend';
        versionsLegend.textContent = 'Versions';
        fieldset.appendChild(versionsLegend);

        const versionsContainer = document.createElement('div');
        fieldset.appendChild(versionsContainer);
        renderVersions(versionsContainer, rowIndex);

        const addVersionButton = document.createElement('button');
        addVersionButton.type = 'button';
        addVersionButton.textContent = '+ Add version';
        addVersionButton.addEventListener('click', () => {
          state.rows = state.rows.map((r, i) => i !== rowIndex ? r : { ...r, versions: [...r.versions, emptyVersionRow()] });
          renderVersions(versionsContainer, rowIndex);
        });
        fieldset.appendChild(addVersionButton);

        if (variantLabel) {
          const variantsLegend = document.createElement('div');
          variantsLegend.className = 'sub-legend';
          variantsLegend.textContent = variantLabel;
          fieldset.appendChild(variantsLegend);

          const variantsContainer = document.createElement('div');
          fieldset.appendChild(variantsContainer);
          renderVariants(variantsContainer, rowIndex);

          const addVariantButton = document.createElement('button');
          addVariantButton.type = 'button';
          addVariantButton.textContent = '+ Add ' + variantLabel.toLowerCase();
          addVariantButton.addEventListener('click', () => {
            state.rows = state.rows.map((r, i) => i !== rowIndex ? r : { ...r, variants: [...r.variants, emptyVariantRow()] });
            renderVariants(variantsContainer, rowIndex);
          });
          fieldset.appendChild(addVariantButton);
        }

        return fieldset;
      }

      function renderRows() {
        const container = el('rows');
        container.innerHTML = '';
        if (state.rows.length === 0) {
          const hint = document.createElement('p');
          hint.className = 'empty-hint';
          hint.textContent = 'No entries yet.';
          container.appendChild(hint);
        }
        state.rows.forEach((row, index) => {
          container.appendChild(isFlat ? flatRowElement(row, index) : versionedRowElement(row, index));
        });
      }

      el('addRow').addEventListener('click', () => {
        state.rows = [...state.rows, isFlat ? emptyFlatRow() : emptyVersionedRow()];
        renderRows();
      });

      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.type === 'update') {
          entityCandidates = message.entityCandidates;
          state = message.formState;
          renderRows();
        }
      });

      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
}

/** Escape text interpolated into the static (non-templated) parts of the HTML shell — the title and hint, both fixed per kind, never user data. */
function escapeHtmlStatic(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
