/* Hash generators: MD5, SHA-1, SHA-256, SHA-512.
   SHA variants use crypto.subtle; MD5 uses the standalone window.md5 from md5.js. */
window.ToolHash = {
  id: 'hash',
  label: 'Hash',
  icon: '#',
  description: 'Compute MD5, SHA-1, SHA-256, SHA-512 hashes of any text.',

  render(container) {
    let timer = null;

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">Hash Generators</div>
          <div class="tool-desc">MD5, SHA-1, SHA-256, SHA-512 — updates on every keystroke.</div>
        </div>
        <div class="io-block">
          <div class="io-label">Input</div>
          <textarea id="hash-input" placeholder="Paste text to hash…" rows="4"></textarea>
        </div>
        <div id="hash-results" class="hash-results"></div>
        <div class="action-row">
          <button id="hash-clear">Clear</button>
        </div>
      </div>`;

    const input   = container.querySelector('#hash-input');
    const results = container.querySelector('#hash-results');
    const clearBtn= container.querySelector('#hash-clear');

    async function bufToHex(buf) {
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function computeHashes(text) {
      const bytes = new TextEncoder().encode(text);
      const md5val = window.md5(bytes);
      const [sha1, sha256, sha512] = await Promise.all([
        crypto.subtle.digest('SHA-1', bytes),
        crypto.subtle.digest('SHA-256', bytes),
        crypto.subtle.digest('SHA-512', bytes),
      ]);
      return {
        MD5:    md5val,
        'SHA-1':   await bufToHex(sha1),
        'SHA-256': await bufToHex(sha256),
        'SHA-512': await bufToHex(sha512),
      };
    }

    function makeCopyBtn(id) {
      return `<button class="hash-copy" data-algo="${id}">Copy</button>`;
    }

    async function process() {
      const text = input.value;
      if (!text) { results.innerHTML = ''; return; }

      const hashes = await computeHashes(text);
      results.innerHTML = Object.entries(hashes).map(([algo, val]) => `
        <div class="hash-row">
          <span class="hash-algo">${algo}</span>
          <span class="hash-val" data-algo="${algo}">${val}</span>
          ${makeCopyBtn(algo)}
        </div>`).join('');

      results.querySelectorAll('.hash-copy').forEach(btn => {
        btn.addEventListener('click', () => {
          const algo = btn.dataset.algo;
          const val = results.querySelector(`.hash-val[data-algo="${algo}"]`).textContent;
          navigator.clipboard.writeText(val).then(() => {
            btn.textContent = 'Copied ✓'; btn.classList.add('success');
            setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('success'); }, 1500);
          });
        });
      });
    }

    function debounce() { clearTimeout(timer); timer = setTimeout(process, 100); }

    input.addEventListener('input', () => { debounce(); chrome.storage.local.set({ tool_hash_input: input.value }); });

    clearBtn.addEventListener('click', () => {
      input.value = ''; results.innerHTML = '';
      chrome.storage.local.remove('tool_hash_input');
    });

    chrome.storage.local.get('tool_hash_input', (d) => {
      if (d.tool_hash_input) { input.value = d.tool_hash_input; process(); }
    });
  }
};
