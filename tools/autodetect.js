/* Auto-detect tool — inspects pasted text and guesses the encoding type.
   Conservative: only flags high-confidence matches. For ambiguous input,
   shows the top 2 candidates. */
window.ToolAutoDetect = {
  id: 'autodetect',
  label: 'Auto-Detect',
  icon: '🔍',
  description: 'Paste anything — guesses the format and shows decoded output.',

  render(container, prefillText) {
    let timer = null;

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">Auto-Detect</div>
          <div class="tool-desc">Paste any encoded value — identifies format and decodes it.</div>
        </div>
        <div class="io-block">
          <div class="io-label">Input</div>
          <textarea id="ad-input" placeholder="Paste anything here — base64, JWT, URL-encoded, hex, JSON, Unix timestamp…" rows="5"></textarea>
        </div>
        <div id="ad-results"></div>
        <div class="action-row">
          <button id="ad-clear">Clear</button>
        </div>
      </div>`;

    const input    = container.querySelector('#ad-input');
    const results  = container.querySelector('#ad-results');
    const clearBtn = container.querySelector('#ad-clear');

    // ── Detection heuristics ──────────────────────────────────────────────

    function tryJWT(text) {
      const parts = text.split('.');
      if (parts.length !== 3) return null;
      try {
        const b64d = s => { let r = s.replace(/-/g,'+').replace(/_/g,'/'); while(r.length%4)r+='='; return atob(r); };
        const h = JSON.parse(b64d(parts[0]));
        const p = JSON.parse(b64d(parts[1]));
        if (typeof h !== 'object' || typeof p !== 'object') return null;
        return { type: 'JWT', confidence: 'high', value: JSON.stringify(p, null, 2), extra: `alg: ${h.alg||'?'}, typ: ${h.typ||'?'}` };
      } catch { return null; }
    }

    function tryBase64(text) {
      const t = text.trim().replace(/\s/g, '');
      // Must be valid base64 characters and reasonable length
      if (!/^[A-Za-z0-9+/\-_]+=*$/.test(t) || t.length < 4) return null;
      try {
        let s = t.replace(/-/g,'+').replace(/_/g,'/');
        while (s.length % 4) s += '=';
        const bytes = Uint8Array.from(atob(s), c => c.charCodeAt(0));
        const decoded = new TextDecoder().decode(bytes);
        // Only report if decoded string is mostly printable
        const printable = decoded.split('').filter(c => c.charCodeAt(0) >= 32).length;
        if (printable / decoded.length < 0.85) return null;
        return { type: 'Base64', confidence: 'medium', value: decoded };
      } catch { return null; }
    }

    function tryURLEncoded(text) {
      if (!/%[0-9A-Fa-f]{2}/.test(text)) return null;
      try {
        const decoded = decodeURIComponent(text);
        if (decoded === text) return null;
        return { type: 'URL-encoded', confidence: 'high', value: decoded };
      } catch { return null; }
    }

    function tryHex(text) {
      const t = text.trim().replace(/\s+/g,'').replace(/0x/gi,'');
      if (!/^[0-9a-fA-F]+$/.test(t) || t.length < 4 || t.length % 2 !== 0) return null;
      try {
        const bytes = new Uint8Array(t.length / 2);
        for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(t.slice(i*2,i*2+2),16);
        const decoded = new TextDecoder().decode(bytes);
        const printable = decoded.split('').filter(c => c.charCodeAt(0) >= 32).length;
        if (printable / decoded.length < 0.8) return null;
        return { type: 'Hex', confidence: 'medium', value: decoded };
      } catch { return null; }
    }

    function tryJSON(text) {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed !== 'object' && typeof parsed !== 'number' && typeof parsed !== 'boolean') return null;
        return { type: 'JSON', confidence: 'high', value: JSON.stringify(parsed, null, 2) };
      } catch { return null; }
    }

    function tryTimestamp(text) {
      const t = text.trim();
      if (!/^\d{9,13}$/.test(t)) return null;
      const n = Number(t);
      const ms = n > 1e10 ? n : n * 1000;
      const d = new Date(ms);
      if (isNaN(d) || d.getFullYear() < 1970 || d.getFullYear() > 2100) return null;
      return { type: 'Unix Timestamp', confidence: 'medium', value: d.toISOString() + `\n${d.toLocaleString()}` };
    }

    function tryUnicodeEscape(text) {
      if (!/\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}/.test(text)) return null;
      const decoded = text
        .replace(/\\u([0-9a-fA-F]{4})/g, (_,h) => String.fromCharCode(parseInt(h,16)))
        .replace(/\\x([0-9a-fA-F]{2})/g, (_,h) => String.fromCharCode(parseInt(h,16)));
      if (decoded === text) return null;
      return { type: 'Unicode Escape', confidence: 'high', value: decoded };
    }

    function detect(text) {
      const candidates = [
        tryJWT(text),
        tryURLEncoded(text),
        tryJSON(text),
        tryUnicodeEscape(text),
        tryTimestamp(text),
        tryHex(text),
        tryBase64(text),
      ].filter(Boolean);

      // Deduplicate by type; high-confidence first
      const seen = new Set();
      const unique = [];
      for (const c of candidates) {
        if (!seen.has(c.type)) { seen.add(c.type); unique.push(c); }
      }

      // Return at most top 2
      return unique.slice(0, 2);
    }

    // ── Render ────────────────────────────────────────────────────────────

    function escapeHTML(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function process() {
      results.innerHTML = '';
      const text = input.value.trim();
      if (!text) return;

      const hits = detect(text);
      if (!hits.length) {
        results.innerHTML = `<div class="detect-result"><div class="detect-result-header"><span class="detect-type" style="color:var(--text-muted)">Unknown</span><span class="detect-confidence">No pattern matched</span></div></div>`;
        return;
      }

      results.innerHTML = hits.map((h, idx) => `
        <div class="detect-result" style="margin-bottom:${idx < hits.length-1 ? '8px' : '0'}">
          <div class="detect-result-header">
            <span class="detect-type">${escapeHTML(h.type)}</span>
            ${h.extra ? `<span style="font-size:11px;color:var(--text-muted)">${escapeHTML(h.extra)}</span>` : ''}
            <span class="detect-confidence">${h.confidence} confidence</span>
            <button class="hash-copy ad-copy-btn" data-val="${escapeHTML(h.value)}">Copy</button>
          </div>
          <div class="detect-body">${escapeHTML(h.value)}</div>
        </div>`).join('');

      results.querySelectorAll('.ad-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          navigator.clipboard.writeText(btn.dataset.val).then(() => {
            btn.textContent = 'Copied ✓'; btn.classList.add('success');
            setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('success'); }, 1500);
          });
        });
      });
    }

    function debounce() { clearTimeout(timer); timer = setTimeout(process, 100); }

    input.addEventListener('input', () => { debounce(); chrome.storage.local.set({ tool_ad_input: input.value }); });

    clearBtn.addEventListener('click', () => {
      input.value = ''; results.innerHTML = '';
      chrome.storage.local.remove('tool_ad_input');
    });

    // Support pre-fill from omnibox
    if (prefillText) {
      input.value = prefillText;
      process();
    } else {
      chrome.storage.local.get('tool_ad_input', (d) => {
        if (d.tool_ad_input) { input.value = d.tool_ad_input; process(); }
      });
    }
  }
};
