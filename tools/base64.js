/* Base64 encode/decode with UTF-8 support and URL-safe toggle */
window.ToolBase64 = {
  id: 'base64',
  label: 'Base64',
  icon: '64',
  description: 'Encode or decode Base64, with URL-safe variant and UTF-8 support.',

  render(container) {
    let mode = 'encode';    // 'encode' | 'decode'
    let urlSafe = false;
    let timer = null;
    let auto = true;        // auto-detect encode vs decode from the input

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">Base64</div>
          <div class="tool-desc">Encode/decode Base64 with full UTF-8 support.</div>
        </div>
        <div class="mode-row">
          <div class="toggle-group">
            <button id="b64-encode" class="active">Encode</button>
            <button id="b64-decode">Decode</button>
          </div>
          <label class="checkbox-label">
            <input type="checkbox" id="b64-urlsafe" /> URL-safe
          </label>
          <button id="b64-auto" type="button" class="b64-auto active" title="Auto-detect whether the input is plain text (Encode) or Base64 (Decode)">✨ Auto</button>
        </div>
        <div class="io-block">
          <div class="io-label">Input</div>
          <textarea id="b64-input" placeholder="Paste text here…" rows="5"></textarea>
        </div>
        <div class="io-block">
          <div class="io-label">Output<button id="b64-expand" type="button" class="expand-btn" title="Expand / collapse output" aria-label="Expand output">⤢ Expand</button></div>
          <textarea id="b64-output" readonly rows="5"></textarea>
        </div>
        <div class="action-row">
          <button id="b64-copy">Copy</button>
          <button id="b64-clear">Clear</button>
          <button id="b64-swap">⇅ Swap</button>
        </div>
      </div>`;

    const input  = container.querySelector('#b64-input');
    const output = container.querySelector('#b64-output');
    const encBtn = container.querySelector('#b64-encode');
    const decBtn = container.querySelector('#b64-decode');
    const urlCb  = container.querySelector('#b64-urlsafe');
    const copyBtn= container.querySelector('#b64-copy');
    const clearBtn= container.querySelector('#b64-clear');
    const swapBtn= container.querySelector('#b64-swap');
    const expandBtn = container.querySelector('#b64-expand');
    const autoBtn = container.querySelector('#b64-auto');

    // Find-in-output bar (sits under the Output textarea).
    const finder = window.FindBar.forTextarea(output.closest('.io-block'), output, { placeholder: 'Find in output…' });

    // Expand / collapse the decoded output box.
    expandBtn.addEventListener('click', () => {
      const tall = output.classList.toggle('tall');
      expandBtn.classList.toggle('active', tall);
      expandBtn.textContent = tall ? '⤡' : '⤢';
      finder.refresh();   // re-align highlights after the height change
    });
    function syncFinder() {
      finder.bar.hidden = !output.value || output.classList.contains('error');
      finder.refresh();
    }

    // ── Mode helpers + auto-detect ──────────────────────────────────────
    function applyMode(m) {
      mode = m;
      encBtn.classList.toggle('active', m === 'encode');
      decBtn.classList.toggle('active', m === 'decode');
    }
    function setAuto(on) {
      auto = on;
      autoBtn.classList.toggle('active', on);
    }
    // Returns { urlSafe } if the input looks like decodable Base64, else false.
    function looksLikeBase64(raw) {
      const s = raw.trim().replace(/[\r\n]+/g, '');   // unwrap PEM-style line breaks
      if (s.length < 8) return false;                 // too short to be confident
      const std = /^[A-Za-z0-9+/]+={0,2}$/;
      const url = /^[A-Za-z0-9_-]+={0,2}$/;
      const isStd = std.test(s);
      const isUrl = !isStd && url.test(s);
      if (!isStd && !isUrl) return false;             // contains spaces/other → plain text
      try {
        let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        // reject if it decodes to control characters (then it's not "text" base64)
        if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) return false;
        return { urlSafe: isUrl };
      } catch (e) {
        return false;                                  // not valid base64 / not UTF-8
      }
    }
    function maybeAutoDetect() {
      if (!auto) return;
      const text = input.value;
      if (!text.trim()) return;                        // leave mode as-is when empty
      const res = looksLikeBase64(text);
      if (res) {
        applyMode('decode');
        if (res.urlSafe && !urlCb.checked) { urlCb.checked = true; urlSafe = true; }
      } else {
        applyMode('encode');
      }
    }

    function process() {
      const text = input.value;
      output.classList.remove('error');
      if (!text) { output.value = ''; syncFinder(); return; }

      try {
        if (mode === 'encode') {
          const bytes = new TextEncoder().encode(text);
          let b64 = btoa(String.fromCharCode(...bytes));
          if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          output.value = b64;
        } else {
          let b64 = text.trim();
          if (urlSafe) {
            b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
          }
          const binary = atob(b64);
          const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
          output.value = new TextDecoder().decode(bytes);
        }
      } catch (e) {
        output.classList.add('error');
        output.value = `Error: ${e.message}`;
      }
      syncFinder();
    }

    function debounce() {
      clearTimeout(timer);
      timer = setTimeout(() => { maybeAutoDetect(); process(); }, 150);
    }

    input.addEventListener('input', () => {
      debounce();
      chrome.storage.local.set({ 'tool_base64_input': input.value });
    });

    // Manual tab clicks switch off auto-detect (so it won't fight the user).
    encBtn.addEventListener('click', () => { setAuto(false); applyMode('encode'); process(); });
    decBtn.addEventListener('click', () => { setAuto(false); applyMode('decode'); process(); });
    urlCb.addEventListener('change', () => { urlSafe = urlCb.checked; process(); });

    // Toggle auto-detect; re-enabling re-evaluates the current input immediately.
    autoBtn.addEventListener('click', () => {
      setAuto(!auto);
      if (auto) { maybeAutoDetect(); process(); }
    });

    copyBtn.addEventListener('click', () => {
      if (!output.value) return;
      navigator.clipboard.writeText(output.value).then(() => {
        copyBtn.textContent = 'Copied ✓';
        copyBtn.classList.add('success');
        setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('success'); }, 1500);
      });
    });

    clearBtn.addEventListener('click', () => {
      input.value = ''; output.value = '';
      output.classList.remove('error');
      chrome.storage.local.remove('tool_base64_input');
    });

    swapBtn.addEventListener('click', () => {
      input.value = output.value;
      output.classList.remove('error');
      setAuto(false);                 // explicit swap is a manual choice
      applyMode(mode === 'encode' ? 'decode' : 'encode');
      process();
    });

    // Restore saved input (and auto-detect its mode on load).
    chrome.storage.local.get('tool_base64_input', (data) => {
      if (data.tool_base64_input) {
        input.value = data.tool_base64_input;
        maybeAutoDetect();
        process();
      }
    });
  }
};
