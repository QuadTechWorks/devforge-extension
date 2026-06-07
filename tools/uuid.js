/* UUID v4 generator — generate one or N, copy all. */
window.ToolUUID = {
  id: 'uuid',
  label: 'UUID v4',
  icon: '⊕',
  description: 'Generate UUID v4 values. Generate 1–100 at once.',

  render(container) {
    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">UUID v4 Generator</div>
          <div class="tool-desc">Cryptographically random UUIDs using crypto.randomUUID().</div>
        </div>
        <div class="mode-row">
          <button id="uuid-gen" class="primary">Generate</button>
          <label class="checkbox-label" style="margin-left:4px">
            Count: <input type="number" id="uuid-count" value="1" min="1" max="100" style="width:60px;margin-left:4px" />
          </label>
        </div>
        <div id="uuid-list" class="uuid-list" style="min-height:40px"></div>
        <div class="action-row">
          <button id="uuid-copy-all">Copy All</button>
          <button id="uuid-clear">Clear</button>
        </div>
      </div>`;

    const genBtn    = container.querySelector('#uuid-gen');
    const countInput= container.querySelector('#uuid-count');
    const list      = container.querySelector('#uuid-list');
    const copyAllBtn= container.querySelector('#uuid-copy-all');
    const clearBtn  = container.querySelector('#uuid-clear');

    let uuids = [];

    function generate() {
      const n = Math.min(100, Math.max(1, parseInt(countInput.value) || 1));
      uuids = Array.from({ length: n }, () => crypto.randomUUID());
      list.textContent = uuids.join('\n');
    }

    genBtn.addEventListener('click', generate);

    copyAllBtn.addEventListener('click', () => {
      if (!uuids.length) return;
      navigator.clipboard.writeText(uuids.join('\n')).then(() => {
        copyAllBtn.textContent = 'Copied ✓'; copyAllBtn.classList.add('success');
        setTimeout(() => { copyAllBtn.textContent = 'Copy All'; copyAllBtn.classList.remove('success'); }, 1500);
      });
    });

    clearBtn.addEventListener('click', () => { uuids = []; list.textContent = ''; });

    // Generate one on mount
    generate();
  }
};
