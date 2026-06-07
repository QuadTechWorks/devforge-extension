/* Router and shared UI logic for Dev Toolbox side panel */
(function () {
  'use strict';

  const TOOLS = [
    window.ToolAutoDetect,
    window.ToolBase64,
    window.ToolURL,
    window.ToolHTML,
    window.ToolJWT,
    window.ToolHex,
    window.ToolUnicode,
    window.ToolJSON,
    window.ToolHash,
    window.ToolUUID,
    window.ToolTimestamp,
    window.ToolCron,
    window.ToolSnippets,
    window.ToolTokens,
    window.ToolPorts,
    window.ToolGames,
  ];

  const toolMap = {};
  TOOLS.forEach(t => { toolMap[t.id] = t; });

  // Per-tool example placeholders (shown inside empty input as muted text).
  const PLACEHOLDERS = {
    base64:    'Hello, World!',
    url:       'name=John Doe&email=user@example.com',
    html:      '<div class="foo">A & B</div>',
    jwt:       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NSJ9.sig',
    hex:       'Hello',
    unicode:   'café — résumé',
    json:      '{"name": "Alice", "age": 30}',
    hash:      'secret',
    timestamp: '1716000000',
    cron:      '*/5 * * * *',
    autodetect:'Paste anything: base64, JWT, URL-encoded, hex, JSON, timestamp…',
  };

  const rail        = document.getElementById('rail');
  const list        = document.getElementById('tool-list');
  const content     = document.getElementById('content');
  const toggle      = document.getElementById('rail-toggle');
  const railSearch  = document.getElementById('rail-search');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsClose = document.getElementById('settings-close');
  const themeGroup    = document.getElementById('theme-group');
  const fontGroup     = document.getElementById('font-group');
  const paletteGroup  = document.getElementById('palette-group');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const resetSettingsBtn= document.getElementById('reset-settings-btn');
  const clearDataBtn    = document.getElementById('clear-data-btn');
  const palette       = document.getElementById('palette-modal');
  const palInput      = document.getElementById('palette-input');
  const palList       = document.getElementById('palette-list');
  const helpBtn       = document.getElementById('help-btn');
  const cheatsheet    = document.getElementById('cheatsheet');
  const cheatClose    = document.getElementById('cheatsheet-close');

  // ── Build nav items ────────────────────────────────────────────────────

  TOOLS.forEach(tool => {
    const li = document.createElement('li');
    li.dataset.id = tool.id;
    li.dataset.search = (tool.label + ' ' + (tool.description || '')).toLowerCase();
    li.setAttribute('role', 'option');
    li.innerHTML = `<span class="tool-icon">${tool.icon}</span><span class="tool-label">${tool.label}</span>`;
    li.addEventListener('click', () => navigate(tool.id));
    list.appendChild(li);
  });

  // ── Rail collapse ──────────────────────────────────────────────────────

  toggle.addEventListener('click', () => {
    rail.classList.toggle('collapsed');
    chrome.storage.local.set({ _railCollapsed: rail.classList.contains('collapsed') });
  });

  // ── Settings ───────────────────────────────────────────────────────────

  const DEFAULT_SETTINGS = { theme: 'system', font: 'medium', palette: 'quadtech' };
  let settings = { ...DEFAULT_SETTINGS };

  // Curated colour palettes. `classic` = no override (follows light/dark theme);
  // the rest are full vibrant looks applied via the `data-palette` attribute.
  // `grad` is the swatch preview gradient (mirrors each palette's --brand-grad).
  const PALETTES = [
    { id: 'quadtech',  name: 'QuadTechWorks', grad: 'linear-gradient(135deg,#06b6d4,#2563eb 50%,#7c3aed)' },
    { id: 'classic',   name: 'Classic',   grad: 'linear-gradient(135deg,#22d3ee,#7c5cff)' },
    { id: 'dracula',   name: 'Dracula',   grad: 'linear-gradient(135deg,#8be9fd,#bd93f9 55%,#ff79c6)' },
    { id: 'sunset',    name: 'Sunset',    grad: 'linear-gradient(135deg,#ffd166,#ff7e6b 60%,#ef476f)' },
    { id: 'synthwave', name: 'Synthwave', grad: 'linear-gradient(135deg,#2de2e6,#ff2e97)' },
    { id: 'emerald',   name: 'Emerald',   grad: 'linear-gradient(135deg,#7ee787,#2dd4a7 60%,#22d3ee)' },
    { id: 'ocean',     name: 'Ocean',     grad: 'linear-gradient(135deg,#2ac3de,#7aa2f7 60%,#bb9af7)' },
  ];

  // Build palette swatches once.
  PALETTES.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'palette-swatch';
    b.dataset.palette = p.id;
    b.title = p.name;
    b.setAttribute('aria-label', p.name + ' palette');
    b.innerHTML = `<span class="sw-dot" style="background:${p.grad}"></span><span class="sw-name">${p.name}</span>`;
    paletteGroup.appendChild(b);
  });

  function applySettings() {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-font', settings.font);
    if (!settings.palette || settings.palette === 'classic') root.removeAttribute('data-palette');
    else root.setAttribute('data-palette', settings.palette);

    themeGroup.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.theme === settings.theme));
    fontGroup.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.font === settings.font));
    paletteGroup.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.palette === (settings.palette || 'classic')));
  }

  function saveSettings() {
    chrome.storage.local.set({ settings });
  }

  function loadSettings(cb) {
    chrome.storage.local.get('settings', (data) => {
      if (data.settings) settings = { ...DEFAULT_SETTINGS, ...data.settings };
      applySettings();
      if (cb) cb();
    });
  }

  settingsBtn.addEventListener('click', () => openOverlay(settingsPanel));
  settingsClose.addEventListener('click', () => closeOverlay(settingsPanel));
  settingsPanel.addEventListener('click', (e) => { if (e.target === settingsPanel) closeOverlay(settingsPanel); });

  themeGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-theme]');
    if (!btn) return;
    settings.theme = btn.dataset.theme;
    applySettings();
    saveSettings();
  });
  fontGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-font]');
    if (!btn) return;
    settings.font = btn.dataset.font;
    applySettings();
    saveSettings();
  });
  paletteGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-palette]');
    if (!btn) return;
    settings.palette = btn.dataset.palette;
    applySettings();
    saveSettings();
  });

  clearHistoryBtn.addEventListener('click', () => {
    if (!confirm('Clear input history for all tools?')) return;
    chrome.storage.local.get(null, (data) => {
      const keys = Object.keys(data).filter(k => k.startsWith('history:'));
      if (keys.length) chrome.storage.local.remove(keys);
    });
  });
  resetSettingsBtn.addEventListener('click', () => {
    if (!confirm('Reset theme and font size to defaults?')) return;
    settings = { ...DEFAULT_SETTINGS };
    applySettings();
    saveSettings();
  });

  // Clears the managed stores (snippets / tokens / ports) only — NOT input
  // history or settings. Requires typing DELETE to confirm. Sets each key to an
  // empty array (present-but-empty) so first-load seeding does not run again.
  clearDataBtn.addEventListener('click', () => {
    chrome.storage.local.get(['snippets', 'tokens', 'ports'], (data) => {
      const counts = {
        snippets: Array.isArray(data.snippets) ? data.snippets.length : 0,
        tokens:   Array.isArray(data.tokens)   ? data.tokens.length   : 0,
        ports:    Array.isArray(data.ports)    ? data.ports.length    : 0,
      };
      const total = counts.snippets + counts.tokens + counts.ports;
      if (!total) { alert('There is no stored data to clear.'); return; }
      const answer = prompt(
        `This will delete ${counts.snippets} snippet(s), ${counts.tokens} token(s), and ${counts.ports} port(s).\n` +
        `This cannot be undone. Type DELETE to confirm.`);
      if (answer !== 'DELETE') return;
      chrome.storage.local.set({ snippets: [], tokens: [], ports: [] }, () => {
        // Re-render the open tool so it reflects the cleared store immediately.
        if (activeId) navigate(activeId);
      });
    });
  });

  // ── Overlay helpers ────────────────────────────────────────────────────

  let openedOverlays = [];
  function openOverlay(el) {
    el.hidden = false;
    openedOverlays.push(el);
    if (el === palette) palInput.focus();
  }
  function closeOverlay(el) {
    el.hidden = true;
    openedOverlays = openedOverlays.filter(o => o !== el);
  }
  function closeTopOverlay() {
    const top = openedOverlays.pop();
    if (top) top.hidden = true;
  }

  // ── Tool search (rail) ────────────────────────────────────────────────

  let railFocusIdx = -1;
  function filterRail(query) {
    const q = query.trim().toLowerCase();
    let firstVisible = null;
    let visibleCount = 0;
    list.querySelectorAll('li').forEach(li => {
      const hit = !q || li.dataset.search.includes(q);
      li.classList.toggle('search-hidden', !hit);
      li.classList.remove('search-focus');
      if (hit) {
        if (!firstVisible) firstVisible = li;
        visibleCount++;
      }
    });
    if (firstVisible && q) firstVisible.classList.add('search-focus');
    railFocusIdx = firstVisible && q ? 0 : -1;
  }

  railSearch.addEventListener('input', () => filterRail(railSearch.value));
  railSearch.addEventListener('keydown', (e) => {
    const visible = [...list.querySelectorAll('li:not(.search-hidden)')];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!visible.length) return;
      railFocusIdx = Math.min(visible.length - 1, railFocusIdx + 1);
      visible.forEach(li => li.classList.remove('search-focus'));
      visible[railFocusIdx].classList.add('search-focus');
      visible[railFocusIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!visible.length) return;
      railFocusIdx = Math.max(0, railFocusIdx - 1);
      visible.forEach(li => li.classList.remove('search-focus'));
      visible[railFocusIdx].classList.add('search-focus');
      visible[railFocusIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = visible[Math.max(0, railFocusIdx)];
      if (target) {
        navigate(target.dataset.id);
        railSearch.value = '';
        filterRail('');
        railSearch.blur();
      }
    } else if (e.key === 'Escape') {
      railSearch.value = '';
      filterRail('');
      railSearch.blur();
    }
  });

  // ── Command palette ────────────────────────────────────────────────────

  let palFocusIdx = 0;

  function renderPalette(query) {
    const q = query.trim().toLowerCase();
    const hits = TOOLS.filter(t => {
      if (!q) return true;
      return (t.label + ' ' + (t.description || '')).toLowerCase().includes(q);
    });
    palList.innerHTML = '';
    if (!hits.length) {
      const div = document.createElement('li');
      div.className = 'palette-empty';
      div.textContent = 'No tools match';
      palList.appendChild(div);
      palFocusIdx = -1;
      return;
    }
    hits.forEach((t, i) => {
      const li = document.createElement('li');
      li.dataset.id = t.id;
      li.innerHTML = `
        <div class="pal-row">
          <span class="pal-icon">${t.icon}</span>
          <span class="pal-label">${t.label}</span>
        </div>
        <div class="pal-desc">${t.description || ''}</div>`;
      li.addEventListener('click', () => { selectPalette(t.id); });
      palList.appendChild(li);
    });
    palFocusIdx = 0;
    updatePaletteFocus();
  }

  function updatePaletteFocus() {
    const items = palList.querySelectorAll('li[data-id]');
    items.forEach((li, i) => li.classList.toggle('search-focus', i === palFocusIdx));
    const focused = items[palFocusIdx];
    if (focused) focused.scrollIntoView({ block: 'nearest' });
  }

  function selectPalette(id) {
    navigate(id);
    closeOverlay(palette);
  }

  function openPalette() {
    openOverlay(palette);
    palInput.value = '';
    renderPalette('');
    palInput.focus();
  }

  palInput.addEventListener('input', () => renderPalette(palInput.value));
  palInput.addEventListener('keydown', (e) => {
    const items = palList.querySelectorAll('li[data-id]');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!items.length) return;
      palFocusIdx = Math.min(items.length - 1, palFocusIdx + 1);
      updatePaletteFocus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      palFocusIdx = Math.max(0, palFocusIdx - 1);
      updatePaletteFocus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const focused = items[palFocusIdx];
      if (focused) selectPalette(focused.dataset.id);
    } else if (e.key === 'Tab') {
      // Trap focus inside palette modal
      e.preventDefault();
    }
  });
  palette.addEventListener('click', (e) => { if (e.target === palette) closeOverlay(palette); });

  // ── Cheatsheet ─────────────────────────────────────────────────────────

  helpBtn.addEventListener('click', () => {
    if (cheatsheet.hidden) openOverlay(cheatsheet); else closeOverlay(cheatsheet);
  });
  cheatClose.addEventListener('click', () => closeOverlay(cheatsheet));
  cheatsheet.addEventListener('click', (e) => { if (e.target === cheatsheet) closeOverlay(cheatsheet); });

  // ── Global keydown ─────────────────────────────────────────────────────

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  document.addEventListener('keydown', (e) => {
    const inField = isTypingTarget(e.target);

    // Cmd/Ctrl+K — open palette anywhere
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openPalette();
      return;
    }

    // Esc — close top overlay, or blur current input
    if (e.key === 'Escape') {
      if (openedOverlays.length) {
        e.preventDefault();
        closeTopOverlay();
        return;
      }
      if (inField) { e.target.blur(); return; }
    }

    // Shortcuts that require us NOT to be typing in a field
    if (!inField) {
      if (e.key === '/') {
        e.preventDefault();
        railSearch.focus();
        railSearch.select();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        if (cheatsheet.hidden) openOverlay(cheatsheet); else closeOverlay(cheatsheet);
        return;
      }
    }

    // Tool-scoped shortcuts (work whether or not focus is in the tool's inputs)
    if ((e.metaKey || e.ctrlKey)) {
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerCopy();
        return;
      }
      if (e.shiftKey && (e.key === 'Backspace')) {
        e.preventDefault();
        triggerClear();
        return;
      }
      if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        triggerSwap();
        return;
      }
    }
  });

  function findToolCopyButton() {
    // Prefer id-suffixed copy buttons in the active tool.
    const btn = content.querySelector('button[id$="-copy"], button[id$="-copy-payload"], button[id="uuid-copy-all"]');
    if (btn) return btn;
    return [...content.querySelectorAll('.action-row button')]
      .find(b => /^copy/i.test(b.textContent.trim())) || null;
  }
  function findToolClearButton() {
    return content.querySelector('button[id$="-clear"]');
  }
  function findToolSwapButton() {
    return content.querySelector('button[id$="-swap"]');
  }
  function triggerCopy()  { const b = findToolCopyButton();  if (b) b.click(); }
  function triggerClear() { const b = findToolClearButton(); if (b) b.click(); }
  function triggerSwap()  { const b = findToolSwapButton();  if (b) b.click(); }

  // ── Navigation ─────────────────────────────────────────────────────────

  let activeId = null;

  function navigate(id, prefillText) {
    const tool = toolMap[id];
    if (!tool) return;

    // Update nav highlight
    list.querySelectorAll('li').forEach(li => li.classList.toggle('active', li.dataset.id === id));

    // Transition: fade content out briefly
    content.classList.add('switching');
    setTimeout(() => {
      content.innerHTML = '';
      tool.render(content, prefillText);
      activeId = id;
      enhanceTool(tool, prefillText);
      content.classList.remove('switching');
    }, 60);

    chrome.storage.local.set({ _lastTool: id });
  }

  // ── Tool enhancement layer ─────────────────────────────────────────────
  // After a tool renders, decorate it with shared behaviors that the tool
  // itself does not implement: history dropdown, file drop, share button,
  // and improved placeholder text.

  function enhanceTool(tool, prefillText) {
    const input = content.querySelector('textarea[id$="-input"]');

    // Empty-state example placeholder
    if (input && PLACEHOLDERS[tool.id]) {
      input.placeholder = PLACEHOLDERS[tool.id];
    }

    if (input) {
      attachHistory(tool.id, input);
      attachFileDrop(input);
    }
    injectShareButton(tool, input);

    // If we have a prefill (from a share link, on first load), set it after
    // the tool's own restore-from-storage callback resolves.
    if (prefillText != null && input && tool.id !== 'autodetect') {
      // autodetect handles prefill internally
      setTimeout(() => {
        if (input.value === prefillText) return;
        input.value = prefillText;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, 150);
    }
  }

  // ── Per-tool history ──────────────────────────────────────────────────

  const HISTORY_LIMIT = 10;
  const HISTORY_DEBOUNCE_MS = 2000;

  function historyKey(toolId) { return 'history:' + toolId; }

  function getHistory(toolId, cb) {
    chrome.storage.local.get(historyKey(toolId), (data) => {
      cb(Array.isArray(data[historyKey(toolId)]) ? data[historyKey(toolId)] : []);
    });
  }
  function setHistory(toolId, items) {
    chrome.storage.local.set({ [historyKey(toolId)]: items });
  }

  function attachHistory(toolId, input) {
    // Inject a history button into the io-label adjacent to this input.
    const ioBlock = input.closest('.io-block');
    if (!ioBlock) return;
    const label = ioBlock.querySelector('.io-label');
    if (!label) return;

    // Avoid duplicate buttons if enhance runs twice
    if (label.querySelector('.history-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'history-btn';
    btn.title = 'Input history';
    btn.setAttribute('aria-label', 'Input history');
    btn.textContent = '🕒';
    label.appendChild(btn);

    let dropdown = null;
    let timer = null;

    function closeDropdown() {
      if (dropdown) { dropdown.remove(); dropdown = null; }
      document.removeEventListener('mousedown', onDocClick, true);
    }
    function onDocClick(e) {
      if (dropdown && !dropdown.contains(e.target) && e.target !== btn) closeDropdown();
    }

    function openDropdown() {
      if (dropdown) { closeDropdown(); return; }
      dropdown = document.createElement('div');
      dropdown.className = 'history-dropdown';
      ioBlock.appendChild(dropdown);
      renderDropdown();
      document.addEventListener('mousedown', onDocClick, true);
    }

    function renderDropdown() {
      if (!dropdown) return;
      getHistory(toolId, (items) => {
        if (!dropdown) return;
        if (!items.length) {
          dropdown.innerHTML = `<div class="history-empty">No history yet</div>`;
          return;
        }
        const listDiv = document.createElement('div');
        listDiv.className = 'history-list';
        items.forEach((entry, idx) => {
          const row = document.createElement('div');
          row.className = 'history-item';
          row.title = entry;
          const text = document.createElement('span');
          text.className = 'history-item-text';
          text.textContent = entry.length > 60 ? entry.slice(0, 60) + '…' : entry;
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'history-item-del';
          del.title = 'Remove from history';
          del.textContent = '×';
          row.appendChild(text);
          row.appendChild(del);
          row.addEventListener('click', (e) => {
            if (e.target === del) return;
            input.value = entry;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            closeDropdown();
          });
          del.addEventListener('click', (e) => {
            e.stopPropagation();
            getHistory(toolId, (cur) => {
              cur.splice(idx, 1);
              setHistory(toolId, cur);
              renderDropdown();
            });
          });
          listDiv.appendChild(row);
        });
        dropdown.innerHTML = '';
        dropdown.appendChild(listDiv);
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'history-clear';
        clearBtn.textContent = 'Clear history';
        clearBtn.addEventListener('click', () => {
          setHistory(toolId, []);
          renderDropdown();
        });
        dropdown.appendChild(clearBtn);
      });
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDropdown();
    });

    // Save to history when input has been stable for 2s and is non-empty.
    function maybeSave() {
      const val = input.value;
      if (!val) return;
      getHistory(toolId, (items) => {
        if (items[0] === val) return;
        const next = [val, ...items.filter(v => v !== val)].slice(0, HISTORY_LIMIT);
        setHistory(toolId, next);
      });
    }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(maybeSave, HISTORY_DEBOUNCE_MS);
    });
  }

  // ── File drop ──────────────────────────────────────────────────────────

  const MAX_SIZE_BYTES = 5 * 1024 * 1024;          // 5 MB hard cap
  const TEXT_BREAK_BYTES = 1 * 1024 * 1024;        // <1MB + no extension → text
  const TEXT_EXTS = new Set(['txt','json','csv','pem','key','crt','log','md','xml','yaml','yml','html','htm','js','ts','css']);

  function isTextFile(file) {
    const name = file.name || '';
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
    if (ext && TEXT_EXTS.has(ext)) return true;
    if ((file.type || '').startsWith('text/')) return true;
    if (!ext && file.size < TEXT_BREAK_BYTES) return true;
    return false;
  }

  function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function showToast(ioBlock, msg, isError) {
    let toast = ioBlock.querySelector('.drop-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'drop-toast';
      ioBlock.appendChild(toast);
    }
    toast.classList.toggle('error', !!isError);
    toast.textContent = msg;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { if (toast && toast.parentNode) toast.remove(); }, 200);
    }, 2500);
  }

  function attachFileDrop(input) {
    const ioBlock = input.closest('.io-block');

    function prevent(e) { e.preventDefault(); e.stopPropagation(); }

    input.addEventListener('dragenter', (e) => { prevent(e); input.classList.add('drop-active'); });
    input.addEventListener('dragover',  (e) => { prevent(e); e.dataTransfer.dropEffect = 'copy'; });
    input.addEventListener('dragleave', (e) => { prevent(e); input.classList.remove('drop-active'); });
    input.addEventListener('drop',      (e) => {
      prevent(e);
      input.classList.remove('drop-active');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;

      if (file.size > MAX_SIZE_BYTES) {
        if (ioBlock) showToast(ioBlock, `File too large (${formatBytes(file.size)}). Max 5 MB.`, true);
        return;
      }

      const reader = new FileReader();
      if (isTextFile(file)) {
        reader.onload = () => {
          input.value = reader.result;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          if (ioBlock) showToast(ioBlock, `Loaded ${file.name} (${formatBytes(file.size)})`);
        };
        reader.readAsText(file);
      } else {
        reader.onload = () => {
          const bytes = new Uint8Array(reader.result);
          input.value = bytesToBase64(bytes);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          if (ioBlock) showToast(ioBlock, `Loaded ${file.name} as base64 (${formatBytes(file.size)})`);
        };
        reader.readAsArrayBuffer(file);
      }
    });
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // ── Share link ─────────────────────────────────────────────────────────

  function injectShareButton(tool, input) {
    if (!input) return;  // no input means nothing to share
    const actionRow = content.querySelector('.action-row');
    if (!actionRow || actionRow.querySelector('.share-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'share-btn';
    btn.textContent = 'Share';
    btn.title = 'Copy a link to this input';

    // Insert after the copy button if present, else append.
    const copyBtn = actionRow.querySelector('button[id$="-copy"], button[id$="-copy-payload"]');
    if (copyBtn && copyBtn.nextSibling) actionRow.insertBefore(btn, copyBtn.nextSibling);
    else if (copyBtn) actionRow.appendChild(btn);
    else actionRow.appendChild(btn);

    btn.addEventListener('click', () => {
      const val = input.value || '';
      if (!val) return;
      const SIZE_LIMIT = 8 * 1024;
      if (new TextEncoder().encode(val).length > SIZE_LIMIT) {
        navigator.clipboard.writeText('Input too large to share via link — paste manually.').then(() => flash(btn, 'Too large — note copied'));
        return;
      }
      const base = location.href.split('#')[0];
      const url = `${base}#tool=${encodeURIComponent(tool.id)}&input=${b64urlEncode(val)}`;
      navigator.clipboard.writeText(url).then(() => flash(btn, 'Link copied ✓'));
    });
  }

  function flash(btn, msg) {
    const orig = btn.textContent;
    btn.textContent = msg;
    btn.classList.add('success');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('success'); }, 1500);
  }

  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(str) {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    try {
      const bin = atob(s);
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  }

  function parseShareHash() {
    const hash = location.hash.replace(/^#/, '');
    if (!hash) return null;
    const params = {};
    hash.split('&').forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx < 0) params[decodeURIComponent(pair)] = '';
      else params[decodeURIComponent(pair.slice(0, idx))] = pair.slice(idx + 1);
    });
    if (!params.tool || !toolMap[params.tool]) return null;
    const input = params.input ? b64urlDecode(params.input) : null;
    return { tool: params.tool, input };
  }

  // ── Boot ───────────────────────────────────────────────────────────────

  loadSettings(() => {
    // 1) Share-link routing wins.
    const share = parseShareHash();
    if (share) {
      // Clear hash so a refresh doesn't keep forcing it.
      history.replaceState(null, '', location.pathname);
      restoreRail();
      navigate(share.tool, share.input || undefined);
      return;
    }

    // 2) Omnibox prefill (within 5s).
    chrome.storage.local.get(['_omniboxInput', '_omniboxTimestamp'], (data) => {
      const age = Date.now() - (data._omniboxTimestamp || 0);
      if (data._omniboxInput && age < 5000) {
        chrome.storage.local.remove(['_omniboxInput', '_omniboxTimestamp']);
        restoreRail();
        navigate('autodetect', data._omniboxInput);
        return;
      }
      // 3) Restore last-used tool.
      restoreState();
    });
  });

  function restoreRail() {
    chrome.storage.local.get('_railCollapsed', (data) => {
      if (data._railCollapsed) rail.classList.add('collapsed');
    });
  }

  function restoreState() {
    chrome.storage.local.get(['_lastTool', '_railCollapsed'], (data) => {
      if (data._railCollapsed) rail.classList.add('collapsed');
      const id = (data._lastTool && toolMap[data._lastTool]) ? data._lastTool : 'autodetect';
      navigate(id);
    });
  }
})();
