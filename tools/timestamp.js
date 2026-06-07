/* Timestamp ↔ ISO date — Unix seconds and milliseconds, both directions,
   shows local time and UTC side by side. */
window.ToolTimestamp = {
  id: 'timestamp',
  label: 'Timestamp',
  icon: '⏱',
  description: 'Convert Unix timestamps (seconds or ms) to human-readable dates and back.',

  render(container) {
    let mode = 'ts-to-date';
    let timer = null;

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">Timestamp ↔ ISO Date</div>
          <div class="tool-desc">Convert Unix timestamps (seconds or ms) to readable dates and back.</div>
        </div>
        <div class="mode-row">
          <div class="toggle-group">
            <button id="ts-to-date" class="active">Timestamp → Date</button>
            <button id="ts-to-ts">Date → Timestamp</button>
          </div>
          <button id="ts-now">Now</button>
        </div>
        <div class="io-block">
          <div class="io-label">Input</div>
          <textarea id="ts-input" placeholder="e.g. 1716000000 or 1716000000000" rows="2" style="min-height:44px"></textarea>
        </div>
        <div id="ts-result"></div>
        <div class="action-row">
          <button id="ts-copy">Copy</button>
          <button id="ts-clear">Clear</button>
        </div>
      </div>`;

    const input    = container.querySelector('#ts-input');
    const result   = container.querySelector('#ts-result');
    const tsToDate = container.querySelector('#ts-to-date');
    const tsToTs   = container.querySelector('#ts-to-ts');
    const nowBtn   = container.querySelector('#ts-now');
    const copyBtn  = container.querySelector('#ts-copy');
    const clearBtn = container.querySelector('#ts-clear');

    let copyValue = '';

    function pad(n) { return String(n).padStart(2, '0'); }

    function formatDate(d) {
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
             `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    function cell(label, val) {
      return `<div class="ts-cell"><div class="ts-cell-label">${label}</div><div class="ts-cell-val">${val}</div></div>`;
    }

    function processToDate(raw) {
      const n = raw.trim();
      if (!n) { result.innerHTML = ''; return; }
      const num = Number(n);
      if (!Number.isFinite(num)) throw new Error('Not a valid number');
      // Heuristic: if > 1e10 treat as milliseconds
      const ms = num > 1e10 ? num : num * 1000;
      const d = new Date(ms);
      if (isNaN(d)) throw new Error('Invalid timestamp');

      const iso = d.toISOString();
      const local = formatDate(d);
      const utcFmt = formatDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000 + d.getTimezoneOffset() * 60000));

      const tzOffset = -d.getTimezoneOffset();
      const tzSign = tzOffset >= 0 ? '+' : '-';
      const tzH = pad(Math.floor(Math.abs(tzOffset) / 60));
      const tzM = pad(Math.abs(tzOffset) % 60);
      const tzLabel = `Local (UTC${tzSign}${tzH}:${tzM})`;

      result.innerHTML = `<div class="ts-grid">
        ${cell('Unix (seconds)', Math.floor(ms / 1000))}
        ${cell('Unix (ms)', ms)}
        ${cell(tzLabel, local)}
        ${cell('UTC', d.toUTCString())}
        ${cell('ISO 8601', iso)}
        ${cell('Day of week', d.toLocaleDateString('en-US', { weekday: 'long' }))}
      </div>`;
      copyValue = iso;
    }

    function processToTimestamp(raw) {
      const str = raw.trim();
      if (!str) { result.innerHTML = ''; return; }
      const d = new Date(str);
      if (isNaN(d)) throw new Error('Could not parse date. Try ISO 8601 or a natural date string.');
      const secs = Math.floor(d.getTime() / 1000);
      const ms = d.getTime();
      result.innerHTML = `<div class="ts-grid">
        ${cell('Unix (seconds)', secs)}
        ${cell('Unix (ms)', ms)}
        ${cell('ISO 8601', d.toISOString())}
        ${cell('UTC', d.toUTCString())}
      </div>`;
      copyValue = String(secs);
    }

    function process() {
      result.innerHTML = '';
      copyValue = '';
      const raw = input.value;
      if (!raw.trim()) return;
      try {
        if (mode === 'ts-to-date') processToDate(raw);
        else processToTimestamp(raw);
      } catch (e) {
        result.innerHTML = `<div class="cron-description" style="color:var(--error)">${e.message}</div>`;
      }
    }

    function debounce() { clearTimeout(timer); timer = setTimeout(process, 100); }

    input.addEventListener('input', () => { debounce(); chrome.storage.local.set({ tool_ts_input: input.value }); });

    tsToDate.addEventListener('click', () => {
      mode = 'ts-to-date'; tsToDate.classList.add('active'); tsToTs.classList.remove('active');
      input.placeholder = 'e.g. 1716000000 or 1716000000000'; process();
    });
    tsToTs.addEventListener('click', () => {
      mode = 'to-ts'; tsToTs.classList.add('active'); tsToDate.classList.remove('active');
      input.placeholder = 'e.g. 2024-05-18T12:00:00Z'; process();
    });

    nowBtn.addEventListener('click', () => {
      if (mode === 'ts-to-date') input.value = String(Math.floor(Date.now() / 1000));
      else input.value = new Date().toISOString();
      process();
    });

    copyBtn.addEventListener('click', () => {
      if (!copyValue) return;
      navigator.clipboard.writeText(copyValue).then(() => {
        copyBtn.textContent = 'Copied ✓'; copyBtn.classList.add('success');
        setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('success'); }, 1500);
      });
    });

    clearBtn.addEventListener('click', () => {
      input.value = ''; result.innerHTML = ''; copyValue = '';
      chrome.storage.local.remove('tool_ts_input');
    });

    chrome.storage.local.get('tool_ts_input', (d) => {
      if (d.tool_ts_input) { input.value = d.tool_ts_input; process(); }
    });
  }
};
