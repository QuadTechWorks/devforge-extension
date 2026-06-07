/* JSON tools: prettify, minify, and escape-for-embedding */
window.ToolJSON = {
  id: 'json',
  label: 'JSON Tools',
  icon: '{}',
  description: 'Prettify, minify, or escape JSON for embedding inside another JSON value.',

  render(container) {
    let timer = null;

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">JSON Tools</div>
          <div class="tool-desc">Prettify, minify, or escape JSON for embedding.</div>
        </div>
        <div class="io-block">
          <div class="io-label">Input</div>
          <textarea id="json-input" placeholder="Paste JSON here…" rows="6"></textarea>
        </div>
        <div class="io-block">
          <div class="io-label">Output</div>
          <textarea id="json-output" readonly rows="6"></textarea>
        </div>
        <div class="action-row">
          <button id="json-pretty" class="primary">Prettify</button>
          <button id="json-mini">Minify</button>
          <button id="json-escape">Escape (embed)</button>
          <span class="spacer"></span>
          <button id="json-copy">Copy</button>
          <button id="json-clear">Clear</button>
        </div>
      </div>`;

    const input    = container.querySelector('#json-input');
    const output   = container.querySelector('#json-output');
    const prettyBtn= container.querySelector('#json-pretty');
    const miniBtn  = container.querySelector('#json-mini');
    const escBtn   = container.querySelector('#json-escape');
    const copyBtn  = container.querySelector('#json-copy');
    const clearBtn = container.querySelector('#json-clear');

    let lastMode = 'pretty';

    function setActive(btn) {
      [prettyBtn, miniBtn, escBtn].forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
    }

    function process(mode) {
      lastMode = mode;
      output.classList.remove('error');
      if (!input.value.trim()) { output.value = ''; return; }

      try {
        const parsed = JSON.parse(input.value);
        if (mode === 'pretty') {
          output.value = JSON.stringify(parsed, null, 2);
        } else if (mode === 'mini') {
          output.value = JSON.stringify(parsed);
        } else {
          // Escape: stringify the JSON string itself so it can be a JSON value
          output.value = JSON.stringify(JSON.stringify(parsed));
        }
      } catch (e) {
        output.classList.add('error');
        output.value = `Parse error: ${e.message}`;
      }
    }

    function debounce() {
      clearTimeout(timer);
      timer = setTimeout(() => process(lastMode), 100);
    }

    input.addEventListener('input', () => { debounce(); chrome.storage.local.set({ tool_json_input: input.value }); });

    prettyBtn.addEventListener('click', () => { setActive(prettyBtn); process('pretty'); });
    miniBtn.addEventListener('click',   () => { setActive(miniBtn);   process('mini');   });
    escBtn.addEventListener('click',    () => { setActive(escBtn);    process('escape'); });

    copyBtn.addEventListener('click', () => {
      if (!output.value) return;
      navigator.clipboard.writeText(output.value).then(() => {
        copyBtn.textContent = 'Copied ✓'; copyBtn.classList.add('success');
        setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('success'); }, 1500);
      });
    });

    clearBtn.addEventListener('click', () => {
      input.value = ''; output.value = ''; output.classList.remove('error');
      chrome.storage.local.remove('tool_json_input');
    });

    chrome.storage.local.get('tool_json_input', (d) => {
      if (d.tool_json_input) { input.value = d.tool_json_input; process('pretty'); }
    });
  }
};
