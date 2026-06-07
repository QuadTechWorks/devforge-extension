/* JWT decoder: splits on '.', base64url-decodes header and payload, pretty-prints JSON,
   shows signature as-is, and flags exp/nbf relative to now. */
window.ToolJWT = {
  id: 'jwt',
  label: 'JWT Decode',
  icon: '🔑',
  description: 'Decode JWT header and payload, show claims, flag expiry.',

  render(container) {
    let timer = null;

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">JWT Decode</div>
          <div class="tool-desc">Decode JWT header and payload. Flags exp and nbf relative to now.</div>
        </div>
        <div class="io-block">
          <div class="io-label">JWT Input</div>
          <textarea id="jwt-input" placeholder="Paste a JWT (eyJ…) here…" rows="4"></textarea>
        </div>
        <div id="jwt-find"></div>
        <div id="jwt-result"></div>
        <div class="action-row">
          <button id="jwt-copy-payload">Copy Payload</button>
          <button id="jwt-clear">Clear</button>
        </div>
      </div>`;

    const input      = container.querySelector('#jwt-input');
    const findHost   = container.querySelector('#jwt-find');
    const result     = container.querySelector('#jwt-result');
    const copyPayBtn = container.querySelector('#jwt-copy-payload');
    const clearBtn   = container.querySelector('#jwt-clear');

    let lastPayload = '';

    // Find-in-output bar — highlights matches inside the decoded JSON.
    const finder = window.FindBar.forHtml(findHost, () => result, { placeholder: 'Find in decoded token…' });
    function syncFinder() {
      finder.bar.hidden = !result.querySelector('.jwt-parts');
      finder.refresh();
    }

    function process() {
      const text = input.value.trim();
      result.innerHTML = '';
      lastPayload = '';
      if (!text) { syncFinder(); return; }

      const parts = text.split('.');
      if (parts.length < 3) {
        result.innerHTML = `<div class="cron-description" style="color:var(--error)">Invalid JWT: expected 3 parts separated by '.'</div>`;
        syncFinder();
        return;
      }

      try {
        const decoded = window.JWTUtil.decode(text);
        lastPayload = JSON.stringify(decoded.payloadObj, null, 2);
        result.innerHTML = window.JWTUtil.renderPartsFromDecoded(decoded);
      } catch (e) {
        result.innerHTML = `<div class="cron-description" style="color:var(--error)">Parse error: ${window.JWTUtil.escapeHTML(e.message)}</div>`;
      }
      syncFinder();
    }

    function debounce() { clearTimeout(timer); timer = setTimeout(process, 100); }

    input.addEventListener('input', () => { debounce(); chrome.storage.local.set({ tool_jwt_input: input.value }); });

    copyPayBtn.addEventListener('click', () => {
      if (!lastPayload) return;
      navigator.clipboard.writeText(lastPayload).then(() => {
        copyPayBtn.textContent = 'Copied ✓'; copyPayBtn.classList.add('success');
        setTimeout(() => { copyPayBtn.textContent = 'Copy Payload'; copyPayBtn.classList.remove('success'); }, 1500);
      });
    });

    clearBtn.addEventListener('click', () => {
      input.value = ''; result.innerHTML = ''; lastPayload = '';
      finder.clear(); finder.bar.hidden = true;
      chrome.storage.local.remove('tool_jwt_input');
    });

    chrome.storage.local.get('tool_jwt_input', (d) => {
      if (d.tool_jwt_input) { input.value = d.tool_jwt_input; process(); }
    });
  }
};
