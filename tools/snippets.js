/* Snippet Vault — a keyed store of text snippets with {{placeholder}}
   substitution. Managed store (chrome.storage.local key `snippets`); opts out
   of the shell's history/share auto-enhancement by not naming any textarea
   with the `-input` suffix. */
window.ToolSnippets = {
  id: 'snippets',
  label: 'Snippet Vault',
  icon: '📋',
  description: 'Saved text snippets with {{placeholder}} substitution, tags, and search.',

  render(container) {
    let snippets = [];
    let activeId = null;
    let saveTimer = null;
    let placeholderValues = {};

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">Snippet Vault</div>
          <div class="tool-desc">Saved snippets with {{placeholder}} substitution. Auto-saves as you type.</div>
        </div>
        <div class="action-row">
          <button id="snip-new" type="button">+ New</button>
          <button id="snip-dup" type="button">Duplicate</button>
          <button id="snip-del" type="button">Delete</button>
          <span class="spacer"></span>
          <button id="snip-export" type="button">Export</button>
          <button id="snip-import" type="button">Import</button>
        </div>
        <div class="vault-layout">
          <div class="vault-list-pane">
            <input id="snip-search" type="text" placeholder="Search… (tag:kube)" autocomplete="off" />
            <ul id="snip-list" class="vault-list"></ul>
          </div>
          <div class="vault-editor-pane">
            <div id="snip-no-selection" class="vault-editor-empty">Select a snippet, or create a New one.</div>
            <div id="snip-editor" class="vault-editor" hidden>
              <input id="snip-title" type="text" placeholder="Title" autocomplete="off" />
              <input id="snip-tags" type="text" placeholder="tags, comma, separated" autocomplete="off" />
              <textarea id="snip-body" placeholder="Body — use {{placeholders}}. Drop a text file to load." rows="6"></textarea>
              <div id="snip-render" class="snip-render"></div>
            </div>
          </div>
        </div>
      </div>`;

    const newBtn    = container.querySelector('#snip-new');
    const dupBtn    = container.querySelector('#snip-dup');
    const delBtn    = container.querySelector('#snip-del');
    const exportBtn = container.querySelector('#snip-export');
    const importBtn = container.querySelector('#snip-import');
    const searchInp = container.querySelector('#snip-search');
    const listEl    = container.querySelector('#snip-list');
    const noSel     = container.querySelector('#snip-no-selection');
    const editor    = container.querySelector('#snip-editor');
    const titleInp  = container.querySelector('#snip-title');
    const tagsInp   = container.querySelector('#snip-tags');
    const bodyInp   = container.querySelector('#snip-body');
    const renderPanel = container.querySelector('#snip-render');

    // ── Helpers ────────────────────────────────────────────────────────
    function genId() {
      return 's_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    }
    function escapeHTML(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escapeAttr(s) { return escapeHTML(s).replace(/"/g, '&quot;'); }
    function splitTags(str) {
      return String(str).split(',').map(t => t.trim()).filter(Boolean);
    }
    function sameTags(a, b) { return a.length === b.length && a.every((t, i) => t === b[i]); }
    function flash(btn, msg) {
      const orig = btn.textContent;
      btn.textContent = msg; btn.classList.add('success');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('success'); }, 1500);
    }
    function normalize(s) {
      s = s || {};
      return {
        id: s.id || genId(),
        title: typeof s.title === 'string' ? s.title : 'Untitled',
        tags: Array.isArray(s.tags) ? s.tags.map(String) : (typeof s.tags === 'string' ? splitTags(s.tags) : []),
        body: typeof s.body === 'string' ? s.body : '',
        createdAt: s.createdAt || Date.now(),
        updatedAt: s.updatedAt || Date.now(),
      };
    }
    function persist() { chrome.storage.local.set({ snippets }); }

    function seed() {
      const now = Date.now();
      return [{ id: genId(), title: 'kubectl: get pods', tags: ['kube', 'ops'],
        body: 'kubectl get pods -n {{namespace}}', createdAt: now, updatedAt: now }];
    }

    // ── Placeholders ────────────────────────────────────────────────────
    const PH_RE = /\{\{\s*([\w.\-]+)\s*\}\}/g;
    function extractPlaceholders(body) {
      const names = []; let m;
      PH_RE.lastIndex = 0;
      while ((m = PH_RE.exec(body)) !== null) { if (!names.includes(m[1])) names.push(m[1]); }
      return names;
    }
    function renderTemplate(body, values) {
      return body.replace(/\{\{\s*([\w.\-]+)\s*\}\}/g, (full, name) => {
        const v = values[name];
        return (v !== undefined && v !== '') ? v : full;
      });
    }

    // ── List ────────────────────────────────────────────────────────────
    function renderList() {
      const q = searchInp.value.trim().toLowerCase();
      let items = snippets.slice().sort((a, b) => b.updatedAt - a.updatedAt);
      if (q.startsWith('tag:')) {
        const tq = q.slice(4).trim();
        items = items.filter(s => s.tags.some(t => t.toLowerCase().includes(tq)));
      } else if (q) {
        items = items.filter(s =>
          s.title.toLowerCase().includes(q) ||
          s.body.toLowerCase().includes(q) ||
          s.tags.some(t => t.toLowerCase().includes(q)));
      }
      listEl.innerHTML = '';
      if (!items.length) {
        listEl.innerHTML = `<li class="vault-empty">No snippets match</li>`;
        return;
      }
      items.forEach(s => {
        const li = document.createElement('li');
        li.className = 'vault-list-item' + (s.id === activeId ? ' active' : '');
        li.dataset.id = s.id;
        const chips = s.tags.map(t => `<span class="tag-chip" data-tag="${escapeAttr(t)}">${escapeHTML(t)}</span>`).join('');
        li.innerHTML = `<div class="vault-item-title">${escapeHTML(s.title || 'Untitled')}</div>` +
          (chips ? `<div class="vault-item-tags">${chips}</div>` : '');
        li.addEventListener('click', (e) => {
          const chip = e.target.closest('.tag-chip');
          if (chip) { searchInp.value = 'tag:' + chip.dataset.tag; renderList(); return; }
          selectSnippet(s.id);
        });
        listEl.appendChild(li);
      });
    }

    // ── Editor ──────────────────────────────────────────────────────────
    function selectSnippet(id) {
      saveActive();
      activeId = id;
      placeholderValues = {};
      renderEditor();
      renderList();
    }

    function renderEditor() {
      const s = snippets.find(x => x.id === activeId);
      if (!s) {
        editor.hidden = true;
        noSel.hidden = false;
        return;
      }
      noSel.hidden = true;
      editor.hidden = false;
      titleInp.value = s.title;
      tagsInp.value = s.tags.join(', ');
      bodyInp.value = s.body;
      renderPlaceholderPanel();
    }

    function saveActive() {
      const s = snippets.find(x => x.id === activeId);
      if (!s) return;
      const newTitle = titleInp.value;
      const newTags = splitTags(tagsInp.value);
      const newBody = bodyInp.value;
      if (s.title === newTitle && s.body === newBody && sameTags(s.tags, newTags)) return;
      s.title = newTitle; s.tags = newTags; s.body = newBody; s.updatedAt = Date.now();
      persist();
      renderList();
    }

    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveActive, 1500);
    }

    function renderPlaceholderPanel() {
      if (!activeId) { renderPanel.innerHTML = ''; return; }
      const names = extractPlaceholders(bodyInp.value);
      if (!names.length) {
        renderPanel.innerHTML = `<div class="vault-render-empty">No {{placeholders}} in this snippet.</div>`;
        return;
      }
      renderPanel.innerHTML = `
        <div class="io-label">Render</div>
        <div class="snip-fields"></div>
        <div class="io-label">Output</div>
        <textarea class="snip-rendered" readonly rows="3"></textarea>
        <div class="action-row"><button class="snip-render-copy" type="button">Copy</button></div>`;
      const fields = renderPanel.querySelector('.snip-fields');
      names.forEach(name => {
        const row = document.createElement('div');
        row.className = 'snip-field-row';
        const label = document.createElement('label');
        label.className = 'snip-field-label';
        label.textContent = name;
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = placeholderValues[name] || '';
        inp.placeholder = name;
        inp.addEventListener('input', () => { placeholderValues[name] = inp.value; updateRendered(); });
        row.appendChild(label);
        row.appendChild(inp);
        fields.appendChild(row);
      });
      updateRendered();
      renderPanel.querySelector('.snip-render-copy').addEventListener('click', (e) => {
        const out = renderPanel.querySelector('.snip-rendered').value;
        if (!out) return;
        navigator.clipboard.writeText(out).then(() => flash(e.target, 'Copied ✓'));
      });
    }

    function updateRendered() {
      const out = renderPanel.querySelector('.snip-rendered');
      if (out) out.value = renderTemplate(bodyInp.value, placeholderValues);
    }

    // ── Actions ─────────────────────────────────────────────────────────
    function newSnippet() {
      saveActive();
      const now = Date.now();
      const s = { id: genId(), title: 'Untitled', tags: [], body: '', createdAt: now, updatedAt: now };
      snippets.unshift(s);
      persist();
      activeId = s.id;
      placeholderValues = {};
      renderList();
      renderEditor();
      titleInp.focus(); titleInp.select();
    }
    function duplicateSnippet() {
      const s = snippets.find(x => x.id === activeId);
      if (!s) return;
      saveActive();
      const now = Date.now();
      const copy = { id: genId(), title: (s.title || 'Untitled') + ' (copy)', tags: s.tags.slice(), body: s.body, createdAt: now, updatedAt: now };
      snippets.unshift(copy);
      persist();
      activeId = copy.id;
      placeholderValues = {};
      renderList();
      renderEditor();
    }
    function deleteSnippet() {
      const s = snippets.find(x => x.id === activeId);
      if (!s) return;
      if (!confirm(`Delete snippet "${s.title || 'Untitled'}"?`)) return;
      snippets = snippets.filter(x => x.id !== activeId);
      persist();
      activeId = snippets[0] ? snippets[0].id : null;
      placeholderValues = {};
      renderList();
      renderEditor();
    }
    function exportSnippets() {
      const json = JSON.stringify(snippets, null, 2);
      navigator.clipboard.writeText(json).then(() => flash(exportBtn, 'Copied JSON ✓'));
    }
    function importSnippets() {
      const fi = document.createElement('input');
      fi.type = 'file';
      fi.accept = 'application/json,.json';
      fi.addEventListener('change', () => {
        const f = fi.files && fi.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          try {
            const data = JSON.parse(r.result);
            if (!Array.isArray(data)) throw new Error('Expected a JSON array of snippets');
            if (snippets.length && !confirm(`Replace all ${snippets.length} snippet(s) with ${data.length} imported?`)) return;
            snippets = data.map(normalize);
            persist();
            activeId = snippets[0] ? snippets[0].id : null;
            placeholderValues = {};
            renderList();
            renderEditor();
          } catch (e) {
            alert('Import failed: ' + e.message);
          }
        };
        r.readAsText(f);
      });
      fi.click();
    }

    // ── Wire events ─────────────────────────────────────────────────────
    newBtn.addEventListener('click', newSnippet);
    dupBtn.addEventListener('click', duplicateSnippet);
    delBtn.addEventListener('click', deleteSnippet);
    exportBtn.addEventListener('click', exportSnippets);
    importBtn.addEventListener('click', importSnippets);

    searchInp.addEventListener('input', renderList);

    titleInp.addEventListener('input', scheduleSave);
    tagsInp.addEventListener('input', scheduleSave);
    bodyInp.addEventListener('input', () => { scheduleSave(); renderPlaceholderPanel(); });

    [titleInp, tagsInp, bodyInp].forEach(el => el.addEventListener('blur', saveActive));

    // File drop on body → load as text
    bodyInp.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); bodyInp.classList.add('drop-active'); });
    bodyInp.addEventListener('dragover',  (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; });
    bodyInp.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); bodyInp.classList.remove('drop-active'); });
    bodyInp.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      bodyInp.classList.remove('drop-active');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { alert('File too large (max 5 MB).'); return; }
      const r = new FileReader();
      r.onload = () => { bodyInp.value = r.result; scheduleSave(); renderPlaceholderPanel(); };
      r.readAsText(f);
    });

    // ── Boot ────────────────────────────────────────────────────────────
    chrome.storage.local.get('snippets', (d) => {
      if (d.snippets === undefined) {
        snippets = seed();
        persist();
      } else {
        snippets = Array.isArray(d.snippets) ? d.snippets.map(normalize) : [];
      }
      activeId = snippets[0] ? snippets[0].id : null;
      renderList();
      renderEditor();
    });
  }
};
