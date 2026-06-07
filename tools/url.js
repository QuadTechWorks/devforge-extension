/* URL encode/decode using encodeURIComponent / decodeURIComponent */
window.ToolURL = {
  id: 'url',
  label: 'URL Encode',
  icon: '🔗',
  description: 'Encode or decode URL components (encodeURIComponent / decodeURIComponent).',

  render(container) {
    let mode = 'encode';
    let timer = null;

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">URL Encode / Decode</div>
          <div class="tool-desc">Percent-encode or decode URL components.</div>
        </div>
        <div class="mode-row">
          <div class="toggle-group">
            <button id="url-encode" class="active">Encode</button>
            <button id="url-decode">Decode</button>
          </div>
        </div>
        <div class="io-block">
          <div class="io-label">Input</div>
          <textarea id="url-input" placeholder="Paste text here…" rows="5"></textarea>
        </div>
        <div class="io-block">
          <div class="io-label">Output</div>
          <textarea id="url-output" readonly rows="5"></textarea>
        </div>
        <div class="action-row">
          <button id="url-copy">Copy</button>
          <button id="url-clear">Clear</button>
          <button id="url-swap">⇅ Swap</button>
        </div>
      </div>`;

    const input   = container.querySelector('#url-input');
    const output  = container.querySelector('#url-output');
    const encBtn  = container.querySelector('#url-encode');
    const decBtn  = container.querySelector('#url-decode');
    const copyBtn = container.querySelector('#url-copy');
    const clearBtn= container.querySelector('#url-clear');
    const swapBtn = container.querySelector('#url-swap');

    function process() {
      const text = input.value;
      output.classList.remove('error');
      if (!text) { output.value = ''; return; }
      try {
        output.value = mode === 'encode' ? encodeURIComponent(text) : decodeURIComponent(text);
      } catch (e) {
        output.classList.add('error');
        output.value = `Error: ${e.message}`;
      }
    }

    function debounce() { clearTimeout(timer); timer = setTimeout(process, 100); }

    input.addEventListener('input', () => { debounce(); chrome.storage.local.set({ tool_url_input: input.value }); });

    encBtn.addEventListener('click', () => {
      mode = 'encode'; encBtn.classList.add('active'); decBtn.classList.remove('active'); process();
    });
    decBtn.addEventListener('click', () => {
      mode = 'decode'; decBtn.classList.add('active'); encBtn.classList.remove('active'); process();
    });

    copyBtn.addEventListener('click', () => {
      if (!output.value) return;
      navigator.clipboard.writeText(output.value).then(() => {
        copyBtn.textContent = 'Copied ✓'; copyBtn.classList.add('success');
        setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('success'); }, 1500);
      });
    });

    clearBtn.addEventListener('click', () => {
      input.value = ''; output.value = ''; output.classList.remove('error');
      chrome.storage.local.remove('tool_url_input');
    });

    swapBtn.addEventListener('click', () => {
      input.value = output.value; output.classList.remove('error');
      if (mode === 'encode') { mode = 'decode'; decBtn.classList.add('active'); encBtn.classList.remove('active'); }
      else { mode = 'encode'; encBtn.classList.add('active'); decBtn.classList.remove('active'); }
      process();
    });

    chrome.storage.local.get('tool_url_input', (d) => {
      if (d.tool_url_input) { input.value = d.tool_url_input; process(); }
    });
  }
};
