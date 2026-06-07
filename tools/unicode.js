/* Unicode escape ↔ string: é ↔ é, handles \xNN and \uNNNN */
window.ToolUnicode = {
  id: 'unicode',
  label: 'Unicode Escape',
  icon: 'Ω',
  description: 'Convert between \\uNNNN / \\xNN escape sequences and plain Unicode text.',

  render(container) {
    let mode = 'to-escape';
    let timer = null;

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">Unicode Escape ↔ String</div>
          <div class="tool-desc">Convert \\uNNNN / \\xNN escapes to text and back.</div>
        </div>
        <div class="mode-row">
          <div class="toggle-group">
            <button id="uni-to" class="active">Text → Escape</button>
            <button id="uni-from">Escape → Text</button>
          </div>
        </div>
        <div class="io-block">
          <div class="io-label">Input</div>
          <textarea id="uni-input" placeholder="Paste text here…" rows="5"></textarea>
        </div>
        <div class="io-block">
          <div class="io-label">Output</div>
          <textarea id="uni-output" readonly rows="5"></textarea>
        </div>
        <div class="action-row">
          <button id="uni-copy">Copy</button>
          <button id="uni-clear">Clear</button>
          <button id="uni-swap">⇅ Swap</button>
        </div>
      </div>`;

    const input   = container.querySelector('#uni-input');
    const output  = container.querySelector('#uni-output');
    const toBtn   = container.querySelector('#uni-to');
    const fromBtn = container.querySelector('#uni-from');
    const copyBtn = container.querySelector('#uni-copy');
    const clearBtn= container.querySelector('#uni-clear');
    const swapBtn = container.querySelector('#uni-swap');

    function toEscape(str) {
      // Convert each character to \uNNNN if outside printable ASCII
      return Array.from(str).map(ch => {
        const cp = ch.codePointAt(0);
        if (cp > 0xFFFF) return `\\u{${cp.toString(16)}}`;
        if (cp > 0x7E || cp < 0x20) return `\\u${cp.toString(16).padStart(4, '0')}`;
        return ch;
      }).join('');
    }

    function fromEscape(str) {
      // Handle \u{NNNN}, \uNNNN, \xNN, common \n \r \t \\ \"
      return str
        .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\'/g, "'");
    }

    function process() {
      output.classList.remove('error');
      if (!input.value) { output.value = ''; return; }
      try {
        output.value = mode === 'to-escape' ? toEscape(input.value) : fromEscape(input.value);
      } catch (e) {
        output.classList.add('error');
        output.value = `Error: ${e.message}`;
      }
    }

    function debounce() { clearTimeout(timer); timer = setTimeout(process, 100); }

    input.addEventListener('input', () => { debounce(); chrome.storage.local.set({ tool_uni_input: input.value }); });

    toBtn.addEventListener('click', () => {
      mode = 'to-escape'; toBtn.classList.add('active'); fromBtn.classList.remove('active'); process();
    });
    fromBtn.addEventListener('click', () => {
      mode = 'from-escape'; fromBtn.classList.add('active'); toBtn.classList.remove('active'); process();
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
      chrome.storage.local.remove('tool_uni_input');
    });

    swapBtn.addEventListener('click', () => {
      input.value = output.value; output.classList.remove('error');
      if (mode === 'to-escape') { mode = 'from-escape'; fromBtn.classList.add('active'); toBtn.classList.remove('active'); }
      else { mode = 'to-escape'; toBtn.classList.add('active'); fromBtn.classList.remove('active'); }
      process();
    });

    chrome.storage.local.get('tool_uni_input', (d) => {
      if (d.tool_uni_input) { input.value = d.tool_uni_input; process(); }
    });
  }
};
