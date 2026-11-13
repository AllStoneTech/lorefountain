/**
 * Style bible webview HTML (ADR-0047): the guided editor's markup, styles and
 * client script, in the same posture as `storyOverviewHtml.ts` (a static page
 * under a nonce CSP; the host posts `update` messages, the page posts `edit`
 * messages with the whole form state). All logic that decides what the file
 * says lives in `styleBibleForm.ts`; this script only draws controls, keeps a
 * local copy of the state, and posts it back.
 *
 * Client-side behaviour worth knowing:
 * - Text controls post on `change` (blur/Enter), structural controls (chips,
 *   add/remove, presets) post at once.
 * - An `update` that equals the local state (ignoring blank rows and the
 *   hidden `raw` field) only repaints messages, so focus is never stolen by
 *   the echo of the page's own edit.
 * - DOM is built with `createElement`/`textContent`, never `innerHTML`, so file
 *   text can't inject markup.
 * - The script avoids backticks and dollar-brace sequences: it lives inside a
 *   TypeScript template literal.
 */

/**
 * Build the webview's HTML document.
 *
 * @param cspSource - `webview.cspSource`, restricting resource loading to the webview's own origin.
 * @param nonce - A fresh per-load nonce, required to allow the inline `<script>` under the CSP.
 * @returns The full HTML document string.
 */
export function buildStyleBibleHtml(cspSource: string, nonce: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>Style Bible</title>
<style>
  body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 0 1.5rem 3rem; max-width: 720px; }
  .toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0; background: var(--vscode-editor-background); border-bottom: 1px solid var(--vscode-panel-border, transparent); }
  .toolbar h1 { font-size: 1.1rem; margin: 0; flex: 1; }
  h2 { font-size: 0.95rem; margin: 1.6rem 0 0.2rem; }
  h3 { font-size: 0.9rem; margin: 1rem 0 0.2rem; }
  label { display: block; margin: 0.6rem 0 0.2rem; font-size: 0.85rem; opacity: 0.9; }
  input[type="text"], textarea, select { box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; padding: 0.3rem 0.5rem; font-family: inherit; font-size: inherit; }
  input[type="text"], textarea { width: 100%; }
  select { max-width: 100%; }
  textarea { min-height: 5rem; resize: vertical; font-family: var(--vscode-editor-font-family, monospace); }
  input[type="color"] { width: 2.2rem; height: 1.9rem; padding: 0; border: 1px solid var(--vscode-input-border, transparent); background: none; cursor: pointer; }
  .hint { font-size: 0.78rem; opacity: 0.7; margin: 0.15rem 0 0.3rem; }
  .row { display: flex; gap: 0.4rem; align-items: center; margin: 0.25rem 0; }
  .row input[type="text"] { flex: 1; }
  .row .hex { flex: 0 0 7.5rem; width: 7.5rem; font-family: var(--vscode-editor-font-family, monospace); }
  .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.3rem 0; }
  .chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0.6rem; border-radius: 999px; border: 1px solid var(--vscode-button-secondaryBackground, var(--vscode-input-border, currentColor)); background: transparent; color: inherit; cursor: pointer; font-size: 0.85rem; margin: 0; }
  .chip.on { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: transparent; }
  .chip .x { opacity: 0.8; }
  button { padding: 0.25rem 0.8rem; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; cursor: pointer; margin-top: 0.3rem; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.icon { margin: 0; padding: 0.15rem 0.5rem; }
  .msg { font-size: 0.78rem; margin: 0.1rem 0 0.2rem; }
  .msg.error { color: var(--vscode-errorForeground); }
  .msg.warning { color: var(--vscode-editorWarning-foreground, var(--vscode-errorForeground)); }
  .msg.info { opacity: 0.7; }
  .banner { margin: 1rem 0; padding: 0.7rem 0.9rem; border: 1px solid var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground)); background: var(--vscode-inputValidation-errorBackground, transparent); border-radius: 2px; }
  .banner ul { margin: 0.4rem 0 0; padding-left: 1.2rem; }
  .allmedia { margin: 0.2rem 0 0.4rem; padding: 0.3rem 0.6rem; border-left: 3px solid var(--vscode-textLink-foreground); font-size: 0.85rem; background: var(--vscode-textBlockQuote-background, transparent); }
  .fmt { border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, transparent)); border-radius: 3px; padding: 0.4rem 0.7rem 0.6rem; margin: 0.5rem 0; }
  .fmt .name { font-weight: 600; text-transform: capitalize; }
  .tag { font-size: 0.7rem; padding: 0 0.35rem; border-radius: 3px; border: 1px solid currentColor; margin-left: 0.4rem; }
  .tag.unsourced { color: var(--vscode-editorWarning-foreground, currentColor); }
  [hidden] { display: none !important; }
</style>
</head>
<body>
  <div class="toolbar">
    <h1>Style Bible</h1>
    <button type="button" id="showAll" class="secondary" aria-pressed="false">Show all sections</button>
    <button type="button" id="openText" class="secondary" title="Edit the raw file in the text editor">Open as text</button>
  </div>

  <div id="banner" class="banner" role="alert" hidden></div>

  <div id="form">
    <h2>Media</h2>
    <p class="hint">Which media this style applies to. Pick none and it applies to every medium.</p>
    <div id="mediumChips" class="chips" role="group" aria-label="Media"></div>
    <div class="row"><input type="text" id="customMedium" placeholder="Another medium, e.g. podcast" aria-label="Add a custom medium" /><button type="button" id="addMedium" class="secondary icon">Add</button></div>
    <div id="mediumNote" class="allmedia"></div>
    <div id="msg-medium"></div>

    <h2>Look</h2>
    <label for="artStyle">Art style</label>
    <input type="text" id="artStyle" placeholder="e.g. Inked 1920s pulp, flat colour, heavy blacks" />
    <label for="eraReference">Era reference</label>
    <input type="text" id="eraReference" placeholder="e.g. 1925 pulp magazine covers" />

    <h2>Palette</h2>
    <p class="hint">A name and a colour per row. Colours are saved quoted, so the # can never break the file.</p>
    <div id="palette"></div>
    <button type="button" id="addColour" class="secondary">Add colour</button>

    <h2>Reference images</h2>
    <p class="hint">Mood and style references, not character sheets. Choose a file inside the project; the path is stored relative to the project root.</p>
    <div id="refs"></div>
    <button type="button" id="pickRef" class="secondary">Choose file…</button>
    <button type="button" id="addRefText" class="secondary">Add a path or URL</button>

    <h2>Avoid</h2>
    <p class="hint">What generated or drawn images must not contain. Type and press Enter.</p>
    <div id="avoidChips" class="chips"></div>
    <input type="text" id="avoidInput" placeholder="e.g. photorealism" aria-label="Add something to avoid" />

    <h2>Format</h2>
    <p class="hint">One block per medium. Presets are guidance only; each is marked sourced or unsourced.</p>
    <div id="formats"></div>
    <div class="row"><select id="addFormatMedium" aria-label="Add a format for another medium"></select><button type="button" id="addFormat" class="secondary icon">Add format</button></div>

    <h2>Lettering</h2>
    <p class="hint">Notes for comics: font, balloon style, SFX treatment. One per row.</p>
    <div id="lettering"></div>
    <button type="button" id="addLettering" class="secondary">Add lettering note</button>

    <h2>Notes</h2>
    <p class="hint">Prose for people and for AI tools. Only sections that fit the chosen media show; use the toolbar to show all.</p>
    <div id="sections"></div>
    <label for="additional">Additional notes</label>
    <p class="hint">Everything else in the file: the title, an intro, any heading not listed above. Nothing is dropped.</p>
    <textarea id="additional"></textarea>
  </div>

  <script nonce="${nonce}">
    (function () {
      var vscode = acquireVsCodeApi();
      var S = null;            // local form state
      var ctx = null;          // sections, presets, kinds, knownMedia
      var issues = [];
      var refStatus = {};
      var showAll = false;
      var CUSTOM = '__custom__';

      function el(id) { return document.getElementById(id); }
      function h(tag, attrs) {
        var node = document.createElement(tag);
        if (attrs) for (var k in attrs) {
          if (k === 'text') node.textContent = attrs[k];
          else if (k === 'class') node.className = attrs[k];
          else node.setAttribute(k, attrs[k]);
        }
        for (var i = 2; i < arguments.length; i++) if (arguments[i]) node.appendChild(arguments[i]);
        return node;
      }
      function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
      function post() { vscode.postMessage({ type: 'edit', formState: S }); }

      function canon(state) {
        var blank = function (v) { return String(v).trim() !== ''; };
        return JSON.stringify({
          medium: state.medium, artStyle: state.artStyle, eraReference: state.eraReference,
          palette: state.palette.filter(function (r) { return blank(r.name) || blank(r.hex); }).map(function (r) { return [r.name.trim(), r.hex.trim().toLowerCase()]; }),
          referenceImages: state.referenceImages.filter(blank), avoid: state.avoid.filter(blank), lettering: state.lettering.filter(blank),
          format: state.format.filter(function (r) { return blank(r.aspectRatio) || blank(r.trimSize) || blank(r.note); }).map(function (r) { return [r.medium.toLowerCase(), r.aspectRatio, r.trimSize, r.note]; }),
          sections: state.sections, additional: state.additional.trim()
        });
      }

      function isHex(text) { return /^#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})$/i.test(text); }
      function pickerValue(hex) {
        var t = (hex || '').trim();
        if (t && t.charAt(0) !== '#') t = '#' + t;
        if (!isHex(t)) return '#000000';
        if (t.length === 4 || t.length === 5) return '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3];
        return t.slice(0, 7).toLowerCase();
      }

      function msg(path) {
        var holder = h('div', { 'data-issue': path });
        paintInto(holder, path);
        return holder;
      }
      function paintInto(holder, path) {
        clear(holder);
        issues.forEach(function (i) { if (i.path === path) holder.appendChild(h('div', { class: 'msg ' + i.severity, text: i.message })); });
      }
      function paintIssues() {
        var holders = document.querySelectorAll('[data-issue]');
        for (var i = 0; i < holders.length; i++) paintInto(holders[i], holders[i].getAttribute('data-issue'));
        el('msg-medium').setAttribute('data-issue', 'medium');
        paintInto(el('msg-medium'), 'medium');
      }

      function ensureFormatRows() {
        S.medium.forEach(function (m) {
          if (!S.format.some(function (r) { return r.medium.toLowerCase() === m; })) {
            S.format.push({ medium: m, aspectRatio: '', trimSize: '', note: '' });
          }
        });
      }

      // ---- chips ----
      function renderMedium() {
        var box = el('mediumChips'); clear(box);
        var names = ctx.knownMedia.slice();
        S.medium.forEach(function (m) { if (names.indexOf(m) < 0) names.push(m); });
        names.forEach(function (name) {
          var on = S.medium.indexOf(name) >= 0;
          var chip = h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': String(on), text: name });
          chip.addEventListener('click', function () {
            var at = S.medium.indexOf(name);
            if (at >= 0) S.medium.splice(at, 1); else S.medium.push(name);
            ensureFormatRows(); post(); render();
          });
          box.appendChild(chip);
        });
        el('mediumNote').textContent = S.medium.length === 0
          ? 'No medium selected: this style applies to all media.'
          : 'This style applies to: ' + S.medium.join(', ') + '.';
      }
      function addMedium() {
        var v = el('customMedium').value.trim().toLowerCase();
        if (!v) return;
        if (S.medium.indexOf(v) < 0) S.medium.push(v);
        el('customMedium').value = '';
        ensureFormatRows(); post(); render();
      }

      function renderChipList(boxId, list, inputId) {
        var box = el(boxId); clear(box);
        list.forEach(function (item, index) {
          var chip = h('button', { type: 'button', class: 'chip on', title: 'Remove', 'aria-label': 'Remove ' + item }, document.createTextNode(item), h('span', { class: 'x', text: '×' }));
          chip.addEventListener('click', function () { list.splice(index, 1); post(); render(); });
          box.appendChild(chip);
        });
      }

      // ---- palette ----
      function renderPalette() {
        var box = el('palette'); clear(box);
        S.palette.forEach(function (row, index) {
          var picker = h('input', { type: 'color', 'aria-label': 'Colour picker', value: pickerValue(row.hex) });
          var name = h('input', { type: 'text', placeholder: 'Colour name', 'aria-label': 'Colour name', value: row.name });
          var hex = h('input', { type: 'text', class: 'hex', placeholder: '#2a7f8e', 'aria-label': 'Hex value', value: row.hex });
          var remove = h('button', { type: 'button', class: 'secondary icon', 'aria-label': 'Remove colour', title: 'Remove', text: '×' });
          picker.addEventListener('change', function () { row.hex = picker.value; hex.value = picker.value; post(); });
          name.addEventListener('change', function () { row.name = name.value; post(); });
          hex.addEventListener('change', function () {
            var t = hex.value.trim();
            if (t && t.charAt(0) !== '#' && isHex('#' + t)) t = '#' + t;
            row.hex = t; hex.value = t;
            if (isHex(t)) picker.value = pickerValue(t);
            post();
          });
          remove.addEventListener('click', function () { S.palette.splice(index, 1); post(); render(); });
          box.appendChild(h('div', null, h('div', { class: 'row' }, picker, name, hex, remove), msg('palette.' + index)));
        });
      }

      // ---- simple string lists (reference images, lettering) ----
      function renderStringRows(boxId, list, pathPrefix, placeholder) {
        var box = el(boxId); clear(box);
        list.forEach(function (value, index) {
          var input = h('input', { type: 'text', value: value, placeholder: placeholder, 'aria-label': placeholder });
          var remove = h('button', { type: 'button', class: 'secondary icon', 'aria-label': 'Remove', title: 'Remove', text: '×' });
          input.addEventListener('change', function () { list[index] = input.value; post(); });
          remove.addEventListener('click', function () { list.splice(index, 1); post(); render(); });
          box.appendChild(h('div', null, h('div', { class: 'row' }, input, remove), msg(pathPrefix + '.' + index)));
        });
      }

      // ---- format ----
      function presetSelect(presets, current, onValue) {
        var select = h('select', { 'aria-label': 'Preset' });
        var matched = null;
        presets.forEach(function (p) { if (p.value.replace(/\\s+/g, '').toLowerCase() === current.replace(/\\s+/g, '').toLowerCase()) matched = p; });
        select.appendChild(h('option', { value: '', text: 'Not set' }));
        presets.forEach(function (p) {
          var o = h('option', { value: p.value, text: p.label + (p.status === 'unsourced' ? ' (unsourced)' : '') });
          if (matched === p) o.selected = true;
          select.appendChild(o);
        });
        var custom = h('option', { value: CUSTOM, text: 'Custom…' });
        var isCustom = current.trim() !== '' && !matched;
        if (isCustom) custom.selected = true;
        select.appendChild(custom);
        var text = h('input', { type: 'text', value: isCustom ? current : '', placeholder: 'Custom value', 'aria-label': 'Custom value' });
        text.hidden = !isCustom;
        var note = h('div', { class: 'msg info' });
        function paintNote(p) {
          clear(note);
          if (!p) return;
          note.appendChild(h('span', { text: p.note }));
          note.appendChild(h('span', { class: 'tag ' + p.status, text: p.status }));
          if (p.source) note.appendChild(h('span', { text: ' ' + p.source }));
        }
        paintNote(matched);
        select.addEventListener('change', function () {
          if (select.value === CUSTOM) { text.hidden = false; text.focus(); paintNote(null); return; }
          text.hidden = true; text.value = '';
          var p = null; presets.forEach(function (x) { if (x.value === select.value) p = x; });
          paintNote(p); onValue(select.value);
        });
        text.addEventListener('change', function () { onValue(text.value.trim()); });
        return h('div', null, h('div', { class: 'row' }, select, text), note);
      }

      function renderFormats() {
        var box = el('formats'); clear(box);
        S.format.forEach(function (row, index) {
          var kind = ctx.formatKinds[row.medium.toLowerCase()] || 'both';
          var wrap = h('div', { class: 'fmt' }, h('span', { class: 'name', text: row.medium }));
          if (kind === 'aspect' || kind === 'both') {
            wrap.appendChild(h('label', { text: 'Aspect ratio' }));
            wrap.appendChild(presetSelect(ctx.presets.aspect, row.aspectRatio, function (v) { row.aspectRatio = v; post(); }));
          }
          if (kind === 'trim' || kind === 'both') {
            wrap.appendChild(h('label', { text: 'Trim size' }));
            var list = row.medium.toLowerCase() === 'illustrated-book' ? ctx.presets.bookTrim : ctx.presets.comicTrim;
            wrap.appendChild(presetSelect(list, row.trimSize, function (v) { row.trimSize = v; post(); }));
          }
          var note = h('input', { type: 'text', value: row.note, placeholder: 'Anything else for this medium', 'aria-label': 'Format note for ' + row.medium });
          note.addEventListener('change', function () { row.note = note.value; post(); });
          wrap.appendChild(h('label', { text: 'Note' }));
          wrap.appendChild(note);
          if (S.medium.indexOf(row.medium.toLowerCase()) < 0) {
            var remove = h('button', { type: 'button', class: 'secondary', text: 'Remove this format' });
            remove.addEventListener('click', function () { S.format.splice(index, 1); post(); render(); });
            wrap.appendChild(remove);
          }
          box.appendChild(wrap);
        });
        var sel = el('addFormatMedium'); clear(sel);
        sel.appendChild(h('option', { value: '', text: 'Add a format for…' }));
        ctx.knownMedia.forEach(function (m) {
          if (!S.format.some(function (r) { return r.medium.toLowerCase() === m; })) sel.appendChild(h('option', { value: m, text: m }));
        });
      }

      // ---- body sections ----
      function sectionVisible(def) {
        if (showAll || !def.appliesTo || S.medium.length === 0) return true;
        if (S.sections[def.key].trim() !== '') return true;
        return def.appliesTo.some(function (m) { return S.medium.indexOf(m) >= 0; });
      }
      function renderSections() {
        var box = el('sections'); clear(box);
        ctx.sections.forEach(function (def) {
          if (!sectionVisible(def)) return;
          var id = 'sec-' + def.key;
          var area = h('textarea', { id: id, 'aria-describedby': id + '-hint' });
          area.value = S.sections[def.key];
          area.addEventListener('change', function () { S.sections[def.key] = area.value; post(); });
          box.appendChild(h('label', { for: id, text: def.heading }));
          box.appendChild(h('div', { class: 'hint', id: id + '-hint', text: def.hint }));
          box.appendChild(area);
        });
      }

      function render() {
        if (!S || !ctx) return;
        ensureFormatRows();
        renderMedium();
        el('artStyle').value = S.artStyle;
        el('eraReference').value = S.eraReference;
        renderPalette();
        renderStringRows('refs', S.referenceImages, 'reference_images', 'Project-relative path or URL');
        paintRefStatus();
        renderChipList('avoidChips', S.avoid);
        renderFormats();
        renderStringRows('lettering', S.lettering, 'lettering', 'e.g. Hand-lettered, all caps');
        renderSections();
        el('additional').value = S.additional;
        el('showAll').setAttribute('aria-pressed', String(showAll));
        el('showAll').textContent = showAll ? 'Show relevant sections' : 'Show all sections';
        paintIssues();
      }
      function paintRefStatus() { /* reference messages arrive as issues; nothing extra to draw */ }

      // ---- static controls ----
      el('artStyle').addEventListener('change', function () { S.artStyle = el('artStyle').value; post(); });
      el('eraReference').addEventListener('change', function () { S.eraReference = el('eraReference').value; post(); });
      el('additional').addEventListener('change', function () { S.additional = el('additional').value; post(); });
      el('addMedium').addEventListener('click', addMedium);
      el('customMedium').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addMedium(); } });
      el('addColour').addEventListener('click', function () { S.palette.push({ name: '', hex: '' }); renderPalette(); });
      el('pickRef').addEventListener('click', function () { vscode.postMessage({ type: 'pickReference' }); });
      el('addRefText').addEventListener('click', function () { S.referenceImages.push(''); render(); });
      el('addLettering').addEventListener('click', function () { S.lettering.push(''); render(); });
      el('avoidInput').addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var v = el('avoidInput').value.trim();
        if (!v) return;
        S.avoid.push(v); el('avoidInput').value = ''; post(); render();
      });
      el('addFormat').addEventListener('click', function () {
        var m = el('addFormatMedium').value;
        if (!m) return;
        S.format.push({ medium: m, aspectRatio: '', trimSize: '', note: '' });
        render();
      });
      el('showAll').addEventListener('click', function () { showAll = !showAll; render(); });
      el('openText').addEventListener('click', function () { vscode.postMessage({ type: 'openAsText' }); });

      window.addEventListener('message', function (event) {
        var m = event.data;
        if (m.type === 'referencePicked' && S) {
          if (S.referenceImages.indexOf(m.path) < 0) S.referenceImages.push(m.path);
          post(); render();
          return;
        }
        if (m.type !== 'update') return;
        ctx = { sections: m.sections, presets: m.presets, formatKinds: m.formatKinds, knownMedia: m.knownMedia };
        issues = m.issues || [];
        var banner = el('banner');
        if (m.error) {
          clear(banner);
          banner.appendChild(h('strong', { text: 'This file can not be shown as a form yet.' }));
          banner.appendChild(h('div', { text: m.error.message }));
          if (m.error.issues && m.error.issues.length) {
            var ul = h('ul');
            m.error.issues.forEach(function (i) { ul.appendChild(h('li', { text: (i.path ? i.path + ': ' : '') + i.message })); });
            banner.appendChild(ul);
          }
          banner.appendChild(h('div', { class: 'hint', text: 'Fix it with Open as text; the form returns as soon as the file is valid.' }));
          banner.hidden = false; el('form').hidden = true;
          return;
        }
        banner.hidden = true; el('form').hidden = false;
        var same = S && canon(S) === canon(m.state);
        if (same) { paintIssues(); return; }
        S = m.state;
        render();
      });

      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
}
