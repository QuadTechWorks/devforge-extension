/* Cron expression explainer — parses 5- or 6-field cron, describes it in plain English,
   and lists the next 5 fire times.

   Field order:
     5-field: minute hour dom month dow
     6-field: second minute hour dom month dow  (first field is seconds)
*/
window.ToolCron = {
  id: 'cron',
  label: 'Cron',
  icon: '⏰',
  description: 'Parse cron expressions, describe them in plain English, show next 5 fire times.',

  render(container) {
    let timer = null;

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">Cron Expression Explainer</div>
          <div class="tool-desc">5 or 6 fields (optionally with seconds). Shows next 5 fire times.</div>
        </div>
        <div class="io-block" style="flex:none">
          <div class="io-label">Cron Expression</div>
          <textarea id="cron-input" placeholder="e.g. */5 * * * * or 0 9 * * 1-5" rows="2" style="min-height:44px"></textarea>
        </div>
        <div id="cron-desc" class="cron-description" style="min-height:36px"></div>
        <div class="io-label" style="margin-top:4px">Next 5 Fire Times</div>
        <div id="cron-times" class="cron-next-times"></div>
        <div class="action-row">
          <button id="cron-clear">Clear</button>
        </div>
      </div>`;

    const input    = container.querySelector('#cron-input');
    const desc     = container.querySelector('#cron-desc');
    const times    = container.querySelector('#cron-times');
    const clearBtn = container.querySelector('#cron-clear');

    // ── Parser ──────────────────────────────────────────────────────────────

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    // Expand a single cron field to an array of matching values.
    // fieldMin/Max are the allowed range.
    function expandField(expr, fieldMin, fieldMax, names) {
      const result = new Set();

      // Handle name aliases before splitting on commas
      let e = expr;
      if (names) {
        names.forEach((n, i) => { e = e.replace(new RegExp(n, 'gi'), String(i + fieldMin)); });
      }

      for (const part of e.split(',')) {
        if (part === '*') {
          for (let v = fieldMin; v <= fieldMax; v++) result.add(v);
        } else if (part.includes('/')) {
          const [range, step] = part.split('/');
          const s = parseInt(step);
          if (isNaN(s) || s <= 0) throw new Error(`Invalid step: ${part}`);
          let start = fieldMin, end = fieldMax;
          if (range !== '*') {
            if (range.includes('-')) { [start, end] = range.split('-').map(Number); }
            else start = parseInt(range);
          }
          for (let v = start; v <= end; v += s) result.add(v);
        } else if (part.includes('-')) {
          const [lo, hi] = part.split('-').map(Number);
          for (let v = lo; v <= hi; v++) result.add(v);
        } else {
          const v = parseInt(part);
          if (isNaN(v)) throw new Error(`Invalid field value: ${part}`);
          result.add(v);
        }
      }

      return [...result].sort((a,b) => a-b);
    }

    function parseCron(expr) {
      const fields = expr.trim().split(/\s+/);
      let secExpr, minExpr, hourExpr, domExpr, monExpr, dowExpr;

      if (fields.length === 5) {
        [minExpr, hourExpr, domExpr, monExpr, dowExpr] = fields;
        secExpr = '0';
      } else if (fields.length === 6) {
        [secExpr, minExpr, hourExpr, domExpr, monExpr, dowExpr] = fields;
      } else {
        throw new Error(`Expected 5 or 6 fields, got ${fields.length}`);
      }

      return {
        secs:  expandField(secExpr,  0, 59),
        mins:  expandField(minExpr,  0, 59),
        hours: expandField(hourExpr, 0, 23),
        doms:  expandField(domExpr,  1, 31),
        mons:  expandField(monExpr,  1, 12, MONTHS),
        dows:  expandField(dowExpr,  0,  6, DAYS),
        rawFields: fields,
        hasSec: fields.length === 6,
      };
    }

    // ── Human description ────────────────────────────────────────────────────

    function listToEnglish(vals, fieldMin, fieldMax, names, unit) {
      if (vals.length === fieldMax - fieldMin + 1) return `every ${unit}`;
      if (vals.length === 1) return `at ${unit} ${names ? names[vals[0] - fieldMin] || vals[0] : vals[0]}`;

      // Detect step
      const diffs = vals.slice(1).map((v, i) => v - vals[i]);
      const allSame = diffs.every(d => d === diffs[0]);
      if (allSame && vals[0] === fieldMin) return `every ${diffs[0]} ${unit}s`;
      if (allSame) return `every ${diffs[0]} ${unit}s starting at ${vals[0]}`;

      const readable = vals.map(v => (names ? names[v - fieldMin] || v : v));
      return `${unit}s ${readable.join(', ')}`;
    }

    function describe(parsed) {
      const { secs, mins, hours, doms, mons, dows, hasSec } = parsed;

      const secPart  = hasSec  ? `second ${secs.join(',')}` : null;
      const minPart  = listToEnglish(mins,  0, 59, null, 'minute');
      const hourPart = listToEnglish(hours, 0, 23, null, 'hour');
      const domPart  = doms.length === 31 ? null : `on day-of-month ${doms.join(',')}`;
      const monPart  = mons.length === 12 ? null : `in ${mons.map(m => MONTHS[m-1]).join(', ')}`;
      const dowPart  = dows.length === 7  ? null : `on ${dows.map(d => DAYS[d]).join(', ')}`;

      const parts = [secPart, `At ${minPart} of ${hourPart}`, domPart, monPart, dowPart].filter(Boolean);
      return parts.join(', ') + '.';
    }

    // ── Next fire times ──────────────────────────────────────────────────────

    function nextFirings(parsed, count = 5) {
      const { secs, mins, hours, doms, mons, dows } = parsed;
      const results = [];

      // Start 1 second from now to avoid returning "now"
      let d = new Date(Date.now() + 1000);
      d.setMilliseconds(0);

      // Safety: max 200k iterations to avoid hangs on impossible schedules
      let safety = 200000;

      while (results.length < count && safety-- > 0) {
        const mon = d.getMonth() + 1; // 1-based
        if (!mons.includes(mon)) { d.setMonth(d.getMonth() + 1); d.setDate(1); d.setHours(0,0,0,0); continue; }
        if (!doms.includes(d.getDate()) || !dows.includes(d.getDay())) { d.setDate(d.getDate() + 1); d.setHours(0,0,0,0); continue; }
        if (!hours.includes(d.getHours())) { d.setHours(d.getHours() + 1); d.setMinutes(0,0,0); continue; }
        if (!mins.includes(d.getMinutes())) { d.setMinutes(d.getMinutes() + 1); d.setSeconds(0,0); continue; }
        if (!secs.includes(d.getSeconds())) { d.setSeconds(d.getSeconds() + 1); d.setMilliseconds(0); continue; }
        results.push(new Date(d));
        d.setSeconds(d.getSeconds() + 1);
      }

      return results;
    }

    // ── Render ───────────────────────────────────────────────────────────────

    function process() {
      desc.innerHTML = '';
      times.innerHTML = '';
      desc.style.color = '';
      const raw = input.value.trim();
      if (!raw) return;

      try {
        const parsed = parseCron(raw);
        desc.textContent = describe(parsed);

        const firings = nextFirings(parsed);
        if (!firings.length) {
          times.innerHTML = `<div class="cron-description" style="color:var(--error)">No fire times found — expression may be unsatisfiable.</div>`;
          return;
        }
        times.innerHTML = firings.map(d => `
          <div class="cron-fire">
            <span class="cron-fire-local">${d.toLocaleString()}</span>
            <span class="cron-fire-utc">${d.toISOString()}</span>
          </div>`).join('');
      } catch (e) {
        desc.style.color = 'var(--error)';
        desc.textContent = `Error: ${e.message}`;
      }
    }

    function debounce() { clearTimeout(timer); timer = setTimeout(process, 100); }

    input.addEventListener('input', () => { debounce(); chrome.storage.local.set({ tool_cron_input: input.value }); });

    clearBtn.addEventListener('click', () => {
      input.value = ''; desc.innerHTML = ''; times.innerHTML = '';
      chrome.storage.local.remove('tool_cron_input');
    });

    chrome.storage.local.get('tool_cron_input', (d) => {
      if (d.tool_cron_input) { input.value = d.tool_cron_input; process(); }
    });
  }
};
