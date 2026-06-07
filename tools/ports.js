/* Localhost Port Switcher — quick-jump between common local dev ports.
   Managed store (chrome.storage.local key `ports`). Reads the active tab URL
   (requires the `tabs` permission) to show a "currently on" banner and to
   power "Swap to" (navigate the current tab to the same path on another port). */
window.ToolPorts = {
  id: 'ports',
  label: 'Port Switcher',
  icon: '🚪',
  description: 'Jump between localhost dev ports; swap the current tab to another port on the same path.',

  render(container) {
    let ports = [];
    let current = null; // { id, port, path, host } of the active localhost tab, or null

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">Localhost Port Switcher</div>
          <div class="tool-desc">Open or swap between your local dev servers.</div>
        </div>
        <div id="port-banner" class="port-banner" hidden></div>
        <div id="port-grid" class="port-grid"></div>
        <form id="port-add" class="port-add-form">
          <input type="number" id="port-num" placeholder="3000" min="1" max="65535" />
          <input type="text" id="port-label" placeholder="Label (e.g. Frontend)" autocomplete="off" />
          <input type="text" id="port-path" placeholder="/path (optional)" autocomplete="off" />
          <button type="submit" id="port-add-btn">Add</button>
        </form>
      </div>`;

    const banner   = container.querySelector('#port-banner');
    const grid      = container.querySelector('#port-grid');
    const form      = container.querySelector('#port-add');
    const numInp    = container.querySelector('#port-num');
    const labelInp  = container.querySelector('#port-label');
    const pathInp   = container.querySelector('#port-path');

    // ── Helpers ────────────────────────────────────────────────────────
    function genId() {
      return 'p_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    }
    function escapeHTML(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function normalize(p) {
      p = p || {};
      let path = typeof p.path === 'string' && p.path ? p.path : '/';
      if (!path.startsWith('/')) path = '/' + path;
      return {
        id: p.id || genId(),
        port: String(p.port != null ? p.port : ''),
        label: typeof p.label === 'string' ? p.label : '',
        path,
      };
    }
    function persist() { chrome.storage.local.set({ ports }); }
    function seed() {
      return [
        normalize({ port: 3000, label: 'Frontend', path: '/' }),
        normalize({ port: 4200, label: 'Angular',  path: '/' }),
        normalize({ port: 8080, label: 'Backend',  path: '/' }),
      ];
    }

    // ── Active tab detection ────────────────────────────────────────────
    function detectCurrent(cb) {
      if (!chrome.tabs || !chrome.tabs.query) { cb(null); return; }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.url) { cb(null); return; }
        try {
          const u = new URL(tab.url);
          if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
            const port = u.port || (u.protocol === 'https:' ? '443' : '80');
            cb({ id: tab.id, port, path: (u.pathname + u.search + u.hash) || '/', host: u.hostname });
          } else cb(null);
        } catch { cb(null); }
      });
    }

    function renderBanner() {
      if (current) {
        banner.hidden = false;
        const pathSuffix = (current.path && current.path !== '/')
          ? ` <span class="port-banner-path">${escapeHTML(current.path)}</span>` : '';
        banner.innerHTML = `Currently on: <strong>${escapeHTML(current.host)}:${escapeHTML(String(current.port))}</strong>${pathSuffix}`;
      } else {
        banner.hidden = true;
        banner.innerHTML = '';
      }
    }

    // ── Grid ────────────────────────────────────────────────────────────
    function renderGrid() {
      const sorted = ports.slice().sort((a, b) => Number(a.port) - Number(b.port));
      grid.innerHTML = '';
      if (!sorted.length) {
        grid.innerHTML = `<div class="port-empty">No ports yet — add one below.</div>`;
        return;
      }
      sorted.forEach(p => {
        const card = document.createElement('div');
        card.className = 'port-card';
        const isCurrent = current && String(current.port) === String(p.port);
        if (isCurrent) card.classList.add('current');
        card.innerHTML = `
          <div class="port-card-main">
            <div class="port-num">:${escapeHTML(String(p.port))}</div>
            <div class="port-label">${escapeHTML(p.label || '')}</div>
            <div class="port-path">${escapeHTML(p.path || '/')}</div>
          </div>
          <div class="port-card-actions">
            <button class="port-open" type="button">Open</button>
            ${current && !isCurrent ? `<button class="port-swap" type="button">Swap to</button>` : ''}
            <button class="port-del" type="button" title="Remove port">×</button>
          </div>`;
        card.querySelector('.port-open').addEventListener('click', (e) => { e.stopPropagation(); openPort(p); });
        const swap = card.querySelector('.port-swap');
        if (swap) swap.addEventListener('click', (e) => { e.stopPropagation(); swapTo(p); });
        card.querySelector('.port-del').addEventListener('click', (e) => { e.stopPropagation(); removePort(p.id, p); });
        card.addEventListener('click', () => openPort(p));
        grid.appendChild(card);
      });
    }

    function urlFor(port, path) {
      return `http://localhost:${port}${path || '/'}`;
    }

    function openPort(p) {
      if (!chrome.tabs || !chrome.tabs.create) return;
      chrome.tabs.create({ url: urlFor(p.port, p.path) });
    }

    function swapTo(p) {
      if (!current || !chrome.tabs || !chrome.tabs.update) return;
      const path = current.path || '/';
      chrome.tabs.update(current.id, { url: urlFor(p.port, path) }, () => {
        // Optimistically reflect the change, then re-detect once the tab settles.
        current = { ...current, port: String(p.port) };
        renderBanner(); renderGrid();
        setTimeout(refresh, 400);
      });
    }

    function removePort(id, p) {
      if (!confirm(`Remove port :${p.port}${p.label ? ' (' + p.label + ')' : ''}?`)) return;
      ports = ports.filter(x => x.id !== id);
      persist();
      renderGrid();
    }

    function addPort(e) {
      e.preventDefault();
      const port = parseInt(numInp.value, 10);
      if (!port || port < 1 || port > 65535) { numInp.focus(); return; }
      let path = pathInp.value.trim();
      if (path && !path.startsWith('/')) path = '/' + path;
      if (!path) path = '/';
      ports.push({ id: genId(), port: String(port), label: labelInp.value.trim(), path });
      persist();
      numInp.value = ''; labelInp.value = ''; pathInp.value = '';
      renderGrid();
      numInp.focus();
    }

    // ── Live banner: react to active-tab changes, self-teardown on unmount ─
    function refresh() {
      detectCurrent((c) => { current = c; renderBanner(); renderGrid(); });
    }
    function onTabActivated() {
      if (!document.contains(grid)) { teardown(); return; }
      refresh();
    }
    function onTabUpdated(_tabId, changeInfo) {
      if (!document.contains(grid)) { teardown(); return; }
      if (changeInfo.url || changeInfo.status === 'complete') refresh();
    }
    function teardown() {
      if (chrome.tabs && chrome.tabs.onActivated) chrome.tabs.onActivated.removeListener(onTabActivated);
      if (chrome.tabs && chrome.tabs.onUpdated) chrome.tabs.onUpdated.removeListener(onTabUpdated);
    }
    if (chrome.tabs && chrome.tabs.onActivated) chrome.tabs.onActivated.addListener(onTabActivated);
    if (chrome.tabs && chrome.tabs.onUpdated) chrome.tabs.onUpdated.addListener(onTabUpdated);

    form.addEventListener('submit', addPort);

    // ── Boot ────────────────────────────────────────────────────────────
    chrome.storage.local.get('ports', (d) => {
      if (d.ports === undefined) {
        ports = seed();
        persist();
      } else {
        ports = Array.isArray(d.ports) ? d.ports.map(normalize) : [];
      }
      detectCurrent((c) => { current = c; renderBanner(); renderGrid(); });
    });
  }
};
