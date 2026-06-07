/* Hex ↔ ASCII/bytes, both directions. Accepts hex with or without spaces and 0x prefixes. */
window.ToolHex = {
  id: 'hex',
  label: 'Hex ↔ ASCII',
  icon: '0x',
  description: 'Convert between hex strings and ASCII/UTF-8 text.',

  render(container) {
    let mode = 'to-hex';  // 'to-hex' | 'from-hex'
    let timer = null;

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">Hex ↔ ASCII</div>
          <div class="tool-desc">Convert text to hex bytes or decode hex back to text. Accepts spaces and 0x prefixes.</div>
        </div>
        <div class="mode-row">
          <div class="toggle-group">
            <button id="hex-to" class="active">Text → Hex</button>
            <button id="hex-from">Hex → Text</button>
          </div>
        </div>
        <div class="io-block">
          <div class="io-label">Input</div>
          <textarea id="hex-input" placeholder="Paste text here…" rows="5"></textarea>
        </div>
        <div class="io-block">
          <div class="io-label">Output</div>
          <textarea id="hex-output" readonly rows="5"></textarea>
        </div>
        <div class="action-row">
          <button id="hex-copy">Copy</button>
          <button id="hex-clear">Clear</button>
          <button id="hex-swap">⇅ Swap</button>
        </div>
      </div>`;

    const input   = container.querySelector('#hex-input');
    const output  = container.querySelector('#hex-output');
    const toBtn   = container.querySelector('#hex-to');
    const fromBtn = container.querySelector('#hex-from');
    const copyBtn = container.querySelector('#hex-copy');
    const clearBtn= container.querySelector('#hex-clear');
    const swapBtn = container.querySelector('#hex-swap');

    function textToHex(text) {
      const bytes = new TextEncoder().encode(text);
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    }

    function hexToText(hex) {
      // Strip 0x prefixes and whitespace, collapse to clean hex string
      const cleaned = hex.replace(/0x/gi, '').replace(/\s+/g, '').replace(/[^0-9a-fA-F]/g, '');
      if (cleaned.length % 2 !== 0) throw new Error('Odd number of hex digits');
      const bytes = new Uint8Array(cleaned.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
      }
      return new TextDecoder().decode(bytes);
    }

    function process() {
      output.classList.remove('error');
      if (!input.value) { output.value = ''; return; }
      try {
        output.value = mode === 'to-hex' ? textToHex(input.value) : hexToText(input.value);
      } catch (e) {
        output.classList.add('error');
        output.value = `Error: ${e.message}`;
      }
    }

    function debounce() { clearTimeout(timer); timer = setTimeout(process, 100); }

    input.addEventListener('input', () => { debounce(); chrome.storage.local.set({ tool_hex_input: input.value }); });

    toBtn.addEventListener('click', () => {
      mode = 'to-hex'; toBtn.classList.add('active'); fromBtn.classList.remove('active'); process();
    });
    fromBtn.addEventListener('click', () => {
      mode = 'from-hex'; fromBtn.classList.add('active'); toBtn.classList.remove('active'); process();
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
      chrome.storage.local.remove('tool_hex_input');
    });

    swapBtn.addEventListener('click', () => {
      input.value = output.value; output.classList.remove('error');
      if (mode === 'to-hex') { mode = 'from-hex'; fromBtn.classList.add('active'); toBtn.classList.remove('active'); }
      else { mode = 'to-hex'; toBtn.classList.add('active'); fromBtn.classList.remove('active'); }
      process();
    });

    chrome.storage.local.get('tool_hex_input', (d) => {
      if (d.tool_hex_input) { input.value = d.tool_hex_input; process(); }
    });
  }
};
