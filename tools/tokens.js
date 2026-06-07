/* Token Vault — a managed list of JWTs grouped by environment. Managed store
   (chrome.storage.local key `tokens`); reuses window.JWTUtil for decoding and
   expiry status. Opts out of the shell's history/share auto-enhancement by not
   naming any textarea with the `-input` suffix, and keeps copy buttons off the
   `-copy`/`-clear`/`-swap` id suffixes so global shortcuts don't grab them. */
window.ToolTokens = {
  id: 'tokens',
  label: 'Token Vault',
  icon: '🎟️',
  description: 'Store JWTs by environment; decode, track expiry, copy as Bearer or curl.',

  render(container) {
    let tokens = [];
    let activeId = null;
    let saveTimer = null;
    let statusTimer = null;

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">Token Vault</div>
          <div class="tool-desc">Saved JWTs with env labels and live expiry. Decoded locally — never verified or sent anywhere.</div>
        </div>
        <div class="action-row">
          <button id="tok-add" type="button">+ Add token</button>
        </div>
        <div id="tok-add-panel" class="tok-add-panel" hidden>
          <div class="io-label">Paste a JWT (or drop a text file)</div>
          <textarea id="tok-add-jwt" placeholder="eyJhbGciOi…" rows="3"></textarea>
          <input id="tok-add-env" type="text" placeholder="env (e.g. prod, staging) — optional" autocomplete="off" />
          <div id="tok-add-error" class="tok-add-error" hidden></div>
          <div class="action-row">
            <button id="tok-add-confirm" type="button" class="primary">Add</button>
            <button id="tok-add-cancel" type="button">Cancel</button>
          </div>
        </div>
        <div class="vault-layout">
          <div class="vault-list-pane">
            <input id="tok-search" type="text" placeholder="Search label or env…" autocomplete="off" />
            <ul id="tok-list" class="vault-list"></ul>
          </div>
          <div class="vault-editor-pane">
            <div id="tok-no-selection" class="vault-editor-empty">Add a token, or select one from the list.</div>
            <div id="tok-detail" class="vault-editor" hidden>
              <div class="tok-meta">
                <input id="tok-label" type="text" placeholder="Label" autocomplete="off" />
                <input id="tok-env" type="text" placeholder="env" autocomplete="off" />
                <button id="tok-del" type="button" title="Delete this token">Delete</button>
              </div>
              <div class="tok-copy-row">
                <button id="tok-copy-raw" type="button">Copy raw</button>
                <button id="tok-copy-bearer" type="button">Copy Bearer</button>
                <button id="tok-copy-curl" type="button">Copy curl</button>
              </div>
              <div id="tok-find"></div>
              <div id="tok-parts" class="tok-parts"></div>
              <div class="io-label">Notes</div>
              <textarea id="tok-notes" placeholder="Notes about this token…" rows="3"></textarea>
            </div>
          </div>
        </div>
      </div>`;

    const addBtn      = container.querySelector('#tok-add');
    const addPanel    = container.querySelector('#tok-add-panel');
    const addJwt      = container.querySelector('#tok-add-jwt');
    const addEnv      = container.querySelector('#tok-add-env');
    const addError    = container.querySelector('#tok-add-error');
    const addConfirm  = container.querySelector('#tok-add-confirm');
    const addCancel   = container.querySelector('#tok-add-cancel');
    const searchInp   = container.querySelector('#tok-search');
    const listEl      = container.querySelector('#tok-list');
    const noSel       = container.querySelector('#tok-no-selection');
    const detail      = container.querySelector('#tok-detail');
    const labelInp    = container.querySelector('#tok-label');
    const envInp      = container.querySelector('#tok-env');
    const delBtn      = container.querySelector('#tok-del');
    const copyRawBtn  = container.querySelector('#tok-copy-raw');
    const copyBearBtn = container.querySelector('#tok-copy-bearer');
    const copyCurlBtn = container.querySelector('#tok-copy-curl');
    const findHost    = container.querySelector('#tok-find');
    const partsBox    = container.querySelector('#tok-parts');
    const notesInp    = container.querySelector('#tok-notes');

    // Find-in-output bar — highlights matches inside the decoded token.
    const finder = window.FindBar.forHtml(findHost, () => partsBox, { placeholder: 'Find in decoded token…' });

    // ── Helpers ────────────────────────────────────────────────────────
    function genId() {
      return 't_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    }
    function escapeHTML(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escapeAttr(s) { return escapeHTML(s).replace(/"/g, '&quot;'); }
    function flash(btn, msg) {
      const orig = btn.textContent;
      btn.textContent = msg; btn.classList.add('success');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('success'); }, 1500);
    }
    function normalize(t) {
      t = t || {};
      return {
        id: t.id || genId(),
        label: typeof t.label === 'string' ? t.label : '',
        env: typeof t.env === 'string' ? t.env : '',
        token: typeof t.token === 'string' ? t.token : '',
        createdAt: t.createdAt || Date.now(),
        notes: typeof t.notes === 'string' ? t.notes : '',
      };
    }
    function persist() { chrome.storage.local.set({ tokens }); }

    // Stable hue from an env string → colored chip.
    function hashHue(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
      return h % 360;
    }
    function envChip(env) {
      if (!env) return '';
      return `<span class="env-chip" style="background:hsl(${hashHue(env)} 55% 42%)">${escapeHTML(env)}</span>`;
    }

    // Decode + expiry status, never throwing. Returns { state, symbol, label }.
    function statusFor(t) {
      try {
        const decoded = window.JWTUtil.decode(t.token);
        return window.JWTUtil.expiryStatus(decoded.payloadObj);
      } catch {
        return { state: 'invalid', symbol: '!', label: 'Not a decodable JWT' };
      }
    }

    // ── List ────────────────────────────────────────────────────────────
    function renderList() {
      const q = searchInp.value.trim().toLowerCase();
      let items = tokens.slice().sort((a, b) => b.createdAt - a.createdAt);
      if (q) {
        items = items.filter(t =>
          t.label.toLowerCase().includes(q) ||
          t.env.toLowerCase().includes(q));
      }
      listEl.innerHTML = '';
      if (!items.length) {
        listEl.innerHTML = `<li class="vault-empty">${tokens.length ? 'No tokens match' : 'No tokens yet — add one above.'}</li>`;
        return;
      }
      items.forEach(t => {
        const st = statusFor(t);
        const li = document.createElement('li');
        li.className = 'vault-list-item' + (t.id === activeId ? ' active' : '');
        li.dataset.id = t.id;
        li.innerHTML =
          `<div class="vault-item-title">` +
            `<span class="tok-status ${st.state}" title="${escapeAttr(st.label)}">${st.symbol}</span>` +
            `<span class="tok-item-label">${escapeHTML(t.label || 'Untitled')}</span>` +
          `</div>` +
          (t.env ? `<div class="vault-item-tags">${envChip(t.env)}</div>` : '');
        li.addEventListener('click', () => selectToken(t.id));
        listEl.appendChild(li);
      });
    }

    // ── Detail ──────────────────────────────────────────────────────────
    function selectToken(id) {
      saveActive();
      activeId = id;
      renderDetail();
      renderList();
    }

    function renderDetail() {
      const t = tokens.find(x => x.id === activeId);
      if (!t) { detail.hidden = true; noSel.hidden = false; return; }
      noSel.hidden = true;
      detail.hidden = false;
      labelInp.value = t.label;
      envInp.value = t.env;
      notesInp.value = t.notes;
      renderParts(t);
    }

    function renderParts(t) {
      try {
        const decoded = window.JWTUtil.decode(t.token);
        partsBox.innerHTML = window.JWTUtil.renderPartsFromDecoded(decoded);
        finder.bar.hidden = false;
      } catch (e) {
        partsBox.innerHTML = `<div class="cron-description" style="color:var(--error)">Could not decode token: ${window.JWTUtil.escapeHTML(e.message)}</div>`;
        finder.bar.hidden = true;
      }
      finder.refresh();
    }

    function saveActive() {
      const t = tokens.find(x => x.id === activeId);
      if (!t) return;
      const newLabel = labelInp.value;
      const newEnv = envInp.value.trim();
      const newNotes = notesInp.value;
      if (t.label === newLabel && t.env === newEnv && t.notes === newNotes) return;
      t.label = newLabel; t.env = newEnv; t.notes = newNotes;
      persist();
      renderList();
    }
    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveActive, 1500);
    }

    // ── Add flow ────────────────────────────────────────────────────────
    function showAddPanel() {
      addPanel.hidden = false;
      addJwt.value = ''; addEnv.value = '';
      addError.hidden = true; addError.textContent = '';
      addJwt.focus();
    }
    function hideAddPanel() {
      addPanel.hidden = true;
      addError.hidden = true; addError.textContent = '';
    }
    function confirmAdd() {
      const raw = addJwt.value.trim();
      if (!raw) { showAddError('Paste a JWT first.'); return; }
      let decoded;
      try {
        decoded = window.JWTUtil.decode(raw);
      } catch (e) {
        showAddError(e.message);
        return;
      }
      const p = decoded.payloadObj || {};
      const autoLabel = (typeof p.sub === 'string' && p.sub) ||
                        (typeof p.email === 'string' && p.email) ||
                        (typeof p.name === 'string' && p.name) || 'Untitled';
      const now = Date.now();
      const t = normalize({ id: genId(), label: autoLabel, env: addEnv.value.trim(), token: raw, createdAt: now, notes: '' });
      tokens.unshift(t);
      persist();
      activeId = t.id;
      hideAddPanel();
      renderList();
      renderDetail();
    }
    function showAddError(msg) {
      addError.hidden = false;
      addError.textContent = msg;
    }

    function deleteToken() {
      const t = tokens.find(x => x.id === activeId);
      if (!t) return;
      if (!confirm(`Delete token "${t.label || 'Untitled'}"${t.env ? ' (' + t.env + ')' : ''}?`)) return;
      tokens = tokens.filter(x => x.id !== activeId);
      persist();
      activeId = tokens[0] ? tokens[0].id : null;
      renderList();
      renderDetail();
    }

    // ── Copy actions ─────────────────────────────────────────────────────
    function activeToken() { return tokens.find(x => x.id === activeId); }
    function copyText(btn, text) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => flash(btn, 'Copied ✓'));
    }

    // ── Wire events ─────────────────────────────────────────────────────
    addBtn.addEventListener('click', () => { if (addPanel.hidden) showAddPanel(); else hideAddPanel(); });
    addConfirm.addEventListener('click', confirmAdd);
    addCancel.addEventListener('click', hideAddPanel);
    addJwt.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); confirmAdd(); }
    });

    searchInp.addEventListener('input', renderList);

    labelInp.addEventListener('input', scheduleSave);
    envInp.addEventListener('input', scheduleSave);
    notesInp.addEventListener('input', scheduleSave);
    [labelInp, envInp, notesInp].forEach(el => el.addEventListener('blur', saveActive));

    delBtn.addEventListener('click', deleteToken);
    copyRawBtn.addEventListener('click', () => { const t = activeToken(); if (t) copyText(copyRawBtn, t.token); });
    copyBearBtn.addEventListener('click', () => { const t = activeToken(); if (t) copyText(copyBearBtn, `Authorization: Bearer ${t.token}`); });
    copyCurlBtn.addEventListener('click', () => { const t = activeToken(); if (t) copyText(copyCurlBtn, `curl -H 'Authorization: Bearer ${t.token}'`); });

    // File drop on the add textarea → load JWT as text.
    addJwt.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); addJwt.classList.add('drop-active'); });
    addJwt.addEventListener('dragover',  (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; });
    addJwt.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); addJwt.classList.remove('drop-active'); });
    addJwt.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      addJwt.classList.remove('drop-active');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      if (f.size > 1024 * 1024) { showAddError('File too large (max 1 MB).'); return; }
      const r = new FileReader();
      r.onload = () => { addJwt.value = String(r.result).trim(); addError.hidden = true; };
      r.readAsText(f);
    });

    // ── Live expiry refresh (every 30s), self-teardown on unmount ─────────
    function tick() {
      if (!document.contains(listEl)) { clearInterval(statusTimer); return; }
      renderList();
      const t = activeToken();
      if (t && !detail.hidden) renderParts(t);
    }
    statusTimer = setInterval(tick, 30000);

    // ── Boot ────────────────────────────────────────────────────────────
    chrome.storage.local.get('tokens', (d) => {
      tokens = Array.isArray(d.tokens) ? d.tokens.map(normalize) : [];
      activeId = tokens[0] ? tokens[0].id : null;
      renderList();
      renderDetail();
    });
  }
};
