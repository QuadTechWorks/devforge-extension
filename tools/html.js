/* HTML entity encode/decode */
window.ToolHTML = {
  id: 'html',
  label: 'HTML Entities',
  icon: '&',
  description: 'Encode/decode HTML entities (&amp; &lt; &#x27; etc.).',

  render(container) {
    let mode = 'encode';
    let timer = null;

    // Map for encoding
    const ENCODE_MAP = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#x27;', '/': '&#x2F;',
      '`': '&#x60;', '=': '&#x3D;'
    };

    function htmlEncode(str) {
      return str.replace(/[&<>"'`=/]/g, ch => ENCODE_MAP[ch]);
    }

    // Use a textarea trick for decoding — safe and handles all named entities
    function htmlDecode(str) {
      const ta = document.createElement('textarea');
      ta.innerHTML = str;
      return ta.value;
    }

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">HTML Entities</div>
          <div class="tool-desc">Encode &amp; &lt; &gt; &quot; &#x27; and friends, or decode them back.</div>
        </div>
        <div class="mode-row">
          <div class="toggle-group">
            <button id="html-encode" class="active">Encode</button>
            <button id="html-decode">Decode</button>
          </div>
        </div>
        <div class="io-block">
          <div class="io-label">Input</div>
          <textarea id="html-input" placeholder="Paste text here…" rows="5"></textarea>
        </div>
        <div class="io-block">
          <div class="io-label">Output</div>
          <textarea id="html-output" readonly rows="5"></textarea>
        </div>
        <div class="action-row">
          <button id="html-copy">Copy</button>
          <button id="html-clear">Clear</button>
          <button id="html-swap">⇅ Swap</button>
        </div>
      </div>`;

    const input   = container.querySelector('#html-input');
    const output  = container.querySelector('#html-output');
    const encBtn  = container.querySelector('#html-encode');
    const decBtn  = container.querySelector('#html-decode');
    const copyBtn = container.querySelector('#html-copy');
    const clearBtn= container.querySelector('#html-clear');
    const swapBtn = container.querySelector('#html-swap');

    function process() {
      output.classList.remove('error');
      if (!input.value) { output.value = ''; return; }
      try {
        output.value = mode === 'encode' ? htmlEncode(input.value) : htmlDecode(input.value);
      } catch (e) {
        output.classList.add('error');
        output.value = `Error: ${e.message}`;
      }
    }

    function debounce() { clearTimeout(timer); timer = setTimeout(process, 100); }

    input.addEventListener('input', () => { debounce(); chrome.storage.local.set({ tool_html_input: input.value }); });

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
      chrome.storage.local.remove('tool_html_input');
    });

    swapBtn.addEventListener('click', () => {
      input.value = output.value; output.classList.remove('error');
      if (mode === 'encode') { mode = 'decode'; decBtn.classList.add('active'); encBtn.classList.remove('active'); }
      else { mode = 'encode'; encBtn.classList.add('active'); decBtn.classList.remove('active'); }
      process();
    });

    chrome.storage.local.get('tool_html_input', (d) => {
      if (d.tool_html_input) { input.value = d.tool_html_input; process(); }
    });
  }
};
