/**
 * The Export Script dialog's webview HTML (ADR-0050). A static skeleton, the
 * same split as `settingsHtml.ts`: nothing project-specific is baked in. The
 * client script builds the form from the host's `init` message and posts an
 * `export` or `cancel` message back.
 *
 * Exports {@link buildExportHtml}.
 *
 * Behaviour:
 * - Picking a preset fills the checkboxes; changing any checkbox switches the
 *   preset to Custom, which is saved as the project's Custom preset.
 * - The content options are disabled for the transcript (always dialogue
 *   only); paper and title page apply to PDF and Word only.
 * - Styled with VS Code's `--vscode-*` variables, so it follows the theme.
 *   Every control has a label, and related controls sit in a fieldset.
 */

/**
 * Build the dialog's HTML document.
 *
 * @param cspSource - `webview.cspSource`, restricting resource loading to the webview's own origin.
 * @param nonce - A fresh per-load nonce, required to allow the inline `<script>` under the CSP.
 * @returns The full HTML document string.
 */
export function buildExportHtml(cspSource: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>Export Script</title>
<style>
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 1rem 1.5rem 3rem; max-width: 560px; }
  h1 { font-size: 1.1rem; margin: 0 0 0.25rem; }
  .hint { font-size: 0.8rem; opacity: 0.75; margin: 0.25rem 0 0.75rem; }
  fieldset { border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); border-radius: 4px; margin: 0 0 1rem; padding: 0.75rem 1rem 1rem; }
  fieldset:disabled { opacity: 0.55; }
  legend { font-weight: 600; }
  .row { display: flex; align-items: center; gap: 0.5rem; margin: 0.35rem 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
  select { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border, transparent); padding: 0.2rem; font-family: inherit; }
  input:focus-visible, select:focus-visible, button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
  .actions { display: flex; gap: 0.5rem; }
  button { border: none; border-radius: 2px; padding: 0.4rem 0.9rem; cursor: pointer; font-family: inherit; font-size: 0.85rem; }
  #export { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  #cancel { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  @media (max-width: 420px) { .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
  <h1>Export Script</h1>
  <p class="hint" id="subject"></p>

  <fieldset>
    <legend>Format</legend>
    <div id="formats" role="radiogroup" aria-label="Format"></div>
  </fieldset>

  <fieldset id="content-options">
    <legend>What to include</legend>
    <div class="row">
      <label for="preset">Preset</label>
      <select id="preset"></select>
    </div>
    <p class="hint" id="preset-description"></p>
    <div class="grid" id="checkboxes"></div>
    <div class="row">
      <label for="scene-numbers">Scene numbers</label>
      <select id="scene-numbers">
        <option value="as-written">As written</option>
        <option value="auto">Number every scene</option>
        <option value="none">None</option>
      </select>
    </div>
    <p class="hint">Changing a box switches to Custom, which is saved for this project.</p>
  </fieldset>

  <fieldset id="page-options">
    <legend>Page (PDF and Word)</legend>
    <div class="row" role="radiogroup" aria-label="Paper size">
      <label class="row"><input type="radio" name="paper" value="letter"> US Letter</label>
      <label class="row"><input type="radio" name="paper" value="a4"> A4</label>
    </div>
    <label class="row"><input type="checkbox" id="title-page"> Start with the title page</label>
  </fieldset>

  <fieldset id="scope-options">
    <legend>Scripts</legend>
    <label class="row"><input type="radio" name="scope" value="script" checked> <span id="scope-script"></span></label>
    <label class="row" id="scope-group-row"><input type="radio" name="scope" value="group"> <span id="scope-group"></span></label>
  </fieldset>

  <div class="actions">
    <button id="export" type="button">Export…</button>
    <button id="cancel" type="button">Cancel</button>
  </div>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const CONTENT_LABELS = {
        shots: 'Shot lines (SHOT:, POSE:, LIGHT:, DURATION:)',
        sound: 'Sound cues (SFX:, MUSIC:, AMB:)',
        pauses: 'Scene pauses (PAUSE:)',
        comic: 'Comic lines (PAGE:, PANEL:, LAYOUT:, CAPTION:)',
        tags: 'Asset [tags]',
        notes: 'Notes [[...]]',
        sections: 'Sections (#)',
        synopses: 'Synopses (=)',
        boneyard: 'Boneyard (cut text)',
        loreFountainTitleKeys: 'Order: and Production Code:',
      };
      let presets = [];

      const byId = (id) => document.getElementById(id);
      const contentBoxes = () => Array.from(document.querySelectorAll('input[data-content]'));
      const selectedFormat = () => (document.querySelector('input[name="format"]:checked') || {}).value;

      function setContent(content) {
        for (const box of contentBoxes()) box.checked = Boolean(content[box.dataset.content]);
        byId('scene-numbers').value = content.sceneNumbers;
      }
      function readContent() {
        const content = {};
        for (const box of contentBoxes()) content[box.dataset.content] = box.checked;
        content.sceneNumbers = byId('scene-numbers').value;
        return content;
      }
      function describePreset() {
        const preset = presets.find((candidate) => candidate.id === byId('preset').value);
        byId('preset-description').textContent = preset ? preset.description : '';
      }
      function applyFormat() {
        const format = selectedFormat();
        byId('content-options').disabled = format === 'transcript';
        byId('page-options').disabled = format !== 'pdf' && format !== 'docx';
      }
      function el(tag, attributes, text) {
        const node = document.createElement(tag);
        for (const [key, value] of Object.entries(attributes || {})) node.setAttribute(key, value);
        if (text !== undefined) node.textContent = text;
        return node;
      }

      function init(message) {
        presets = message.presets;
        const formats = byId('formats');
        for (const format of message.formats) {
          const label = el('label', { class: 'row' });
          const input = el('input', { type: 'radio', name: 'format', value: format.id });
          if (format.id === message.settings.format) input.checked = true;
          input.addEventListener('change', applyFormat);
          label.append(input, document.createTextNode(' ' + format.label));
          formats.append(label);
        }

        const select = byId('preset');
        for (const preset of presets) select.append(el('option', { value: preset.id }, preset.label));
        select.value = message.settings.preset;
        select.addEventListener('change', () => {
          const preset = presets.find((candidate) => candidate.id === select.value);
          setContent(preset.id === 'custom' ? message.settings.custom : preset.content);
          describePreset();
        });

        const grid = byId('checkboxes');
        for (const [key, text] of Object.entries(CONTENT_LABELS)) {
          const label = el('label', { class: 'row' });
          const box = el('input', { type: 'checkbox', 'data-content': key });
          box.addEventListener('change', () => { select.value = 'custom'; describePreset(); });
          label.append(box, document.createTextNode(' ' + text));
          grid.append(label);
        }
        byId('scene-numbers').addEventListener('change', () => { select.value = 'custom'; describePreset(); });

        const start = presets.find((candidate) => candidate.id === message.settings.preset);
        setContent(message.settings.preset === 'custom' ? message.settings.custom : start.content);
        describePreset();

        document.querySelector('input[name="paper"][value="' + message.settings.paper + '"]').checked = true;
        byId('title-page').checked = message.settings.titlePage;

        byId('subject').textContent = 'Exporting ' + message.scope.script;
        byId('scope-script').textContent = 'This script (' + message.scope.script + ')';
        if (message.scope.group) {
          byId('scope-group').textContent = 'All ' + message.scope.group.count + ' scripts in ' + message.scope.group.name;
        } else {
          byId('scope-group-row').hidden = true;
        }
        applyFormat();
      }

      byId('export').addEventListener('click', () => {
        vscode.postMessage({
          type: 'export',
          format: selectedFormat(),
          preset: byId('preset').value,
          content: readContent(),
          paper: document.querySelector('input[name="paper"]:checked').value,
          titlePage: byId('title-page').checked,
          scope: document.querySelector('input[name="scope"]:checked').value,
        });
      });
      byId('cancel').addEventListener('click', () => vscode.postMessage({ type: 'cancel' }));

      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'init') init(event.data);
      });
      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
}
