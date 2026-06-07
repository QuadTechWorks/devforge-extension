/* Shared "find in output" bar. Two flavours:
     FindBar.forTextarea(host, textarea, opts)  → search a (readonly) textarea's
       value; matches are revealed via the textarea's text selection + scroll.
     FindBar.forHtml(host, getRoot, opts)        → highlight matches inside
       rendered HTML (e.g. decoded JWT JSON) by wrapping them in <mark>.
   Both return a controller exposing { bar, refresh(), clear() }. Tools call
   refresh() after they re-render their output so highlights stay in sync.

   Loaded before the tools that use it (base64.js, jwt.js, tokens.js). */
window.FindBar = (function () {

  function buildBar(host, placeholder) {
    const bar = document.createElement('div');
    bar.className = 'find-bar';
    bar.hidden = true;
    bar.innerHTML =
      `<span class="find-ico" aria-hidden="true">🔍</span>` +
      `<input type="text" class="find-input" placeholder="${placeholder}" autocomplete="off" aria-label="${placeholder}" />` +
      `<span class="find-count">0/0</span>` +
      `<button type="button" class="find-prev" title="Previous match (Shift+Enter)" aria-label="Previous match">‹</button>` +
      `<button type="button" class="find-next" title="Next match (Enter)" aria-label="Next match">›</button>`;
    host.appendChild(bar);
    return bar;
  }

  // ── HTML highlighting helpers ──────────────────────────────────────────
  function clearMarks(root) {
    root.querySelectorAll('mark.find-hit').forEach(m => {
      m.replaceWith(document.createTextNode(m.textContent));
    });
    root.normalize();
  }

  function applyMarks(root, query) {
    const marks = [];
    if (!query) return marks;
    const lc = query.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.toLowerCase().indexOf(lc) === -1) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const targets = [];
    let n; while ((n = walker.nextNode())) targets.push(n);
    targets.forEach(textNode => {
      const text = textNode.nodeValue;
      const tl = text.toLowerCase();
      const frag = document.createDocumentFragment();
      let i = 0, idx;
      while ((idx = tl.indexOf(lc, i)) !== -1) {
        if (idx > i) frag.appendChild(document.createTextNode(text.slice(i, idx)));
        const mark = document.createElement('mark');
        mark.className = 'find-hit';
        mark.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(mark);
        marks.push(mark);
        i = idx + query.length;
      }
      if (i < text.length) frag.appendChild(document.createTextNode(text.slice(i)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
    return marks;
  }

  // ── forHtml ────────────────────────────────────────────────────────────
  function forHtml(host, getRoot, opts) {
    opts = opts || {};
    const bar = buildBar(host, opts.placeholder || 'Find in output…');
    const input   = bar.querySelector('.find-input');
    const countEl = bar.querySelector('.find-count');
    let marks = [], cur = -1, query = '';

    function updateCount() { countEl.textContent = (marks.length ? cur + 1 : 0) + '/' + marks.length; }
    function setCurrent() {
      marks.forEach((m, i) => m.classList.toggle('current', i === cur));
      if (cur >= 0) marks[cur].scrollIntoView({ block: 'nearest' });
    }
    function recompute() {
      const root = getRoot();
      if (!root) { marks = []; cur = -1; updateCount(); return; }
      clearMarks(root);
      marks = applyMarks(root, query);
      cur = marks.length ? 0 : -1;
      setCurrent();
      updateCount();
    }
    function go(delta) {
      if (!marks.length) return;
      cur = (cur + delta + marks.length) % marks.length;
      setCurrent(); updateCount();
    }

    input.addEventListener('input', () => { query = input.value; recompute(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); go(e.shiftKey ? -1 : 1); }
    });
    bar.querySelector('.find-next').addEventListener('click', () => { go(1); input.focus(); });
    bar.querySelector('.find-prev').addEventListener('click', () => { go(-1); input.focus(); });

    return {
      bar,
      refresh() { if (query) recompute(); else { marks = []; cur = -1; updateCount(); } },
      clear() { query = ''; input.value = ''; const r = getRoot(); if (r) clearMarks(r); marks = []; cur = -1; updateCount(); },
    };
  }

  // ── forTextarea ────────────────────────────────────────────────────────
  // Paints highlights through a backdrop layer that exactly mirrors the
  // textarea's text, so matches line up and we can scroll to the active one by
  // reading the <mark>'s offsetTop. The textarea stays fully usable underneath.
  function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function forTextarea(host, textarea, opts) {
    opts = opts || {};

    const wrap = document.createElement('div');
    wrap.className = 'find-ta-wrap';
    textarea.parentNode.insertBefore(wrap, textarea);
    const backdrop = document.createElement('div');
    backdrop.className = 'find-backdrop';
    wrap.appendChild(backdrop);
    wrap.appendChild(textarea);
    textarea.classList.add('find-ta');

    const bar = buildBar(host, opts.placeholder || 'Find in output…');
    const input   = bar.querySelector('.find-input');
    const countEl = bar.querySelector('.find-count');
    let marks = [], cur = -1, query = '';

    function syncScroll() {
      backdrop.scrollTop = textarea.scrollTop;
      backdrop.scrollLeft = textarea.scrollLeft;
    }
    function paint() {
      const text = textarea.value;
      if (!query) { backdrop.textContent = ''; marks = []; return; }
      const lc = text.toLowerCase(), q = query.toLowerCase();
      let html = '', i = 0, idx;
      while ((idx = lc.indexOf(q, i)) !== -1) {
        html += escapeHTML(text.slice(i, idx));
        html += '<mark class="find-hit">' + escapeHTML(text.slice(idx, idx + query.length)) + '</mark>';
        i = idx + query.length;
      }
      html += escapeHTML(text.slice(i));
      if (text.charAt(text.length - 1) === '\n') html += ' ';
      backdrop.innerHTML = html;
      marks = Array.prototype.slice.call(backdrop.querySelectorAll('mark.find-hit'));
    }
    function updateCount() { countEl.textContent = (marks.length ? cur + 1 : 0) + '/' + marks.length; }
    function setCurrent() {
      marks.forEach((m, i) => m.classList.toggle('current', i === cur));
      if (cur >= 0) {
        const m = marks[cur];
        textarea.scrollTop = Math.max(0, m.offsetTop - textarea.clientHeight / 2 + m.offsetHeight / 2);
        syncScroll();
      }
    }
    function recompute(resetIdx) {
      query = input.value;
      paint();
      if (resetIdx || cur < 0 || cur >= marks.length) cur = marks.length ? 0 : -1;
      updateCount();
      setCurrent();
      syncScroll();
    }
    function go(delta) {
      if (!marks.length) return;
      cur = (cur + delta + marks.length) % marks.length;
      updateCount(); setCurrent();
    }

    input.addEventListener('input', () => recompute(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); go(e.shiftKey ? -1 : 1); }
    });
    bar.querySelector('.find-next').addEventListener('click', () => { go(1); input.focus(); });
    bar.querySelector('.find-prev').addEventListener('click', () => { go(-1); input.focus(); });
    textarea.addEventListener('scroll', syncScroll);

    return {
      bar,
      refresh() { recompute(false); },
      clear() { query = ''; input.value = ''; backdrop.textContent = ''; marks = []; cur = -1; updateCount(); },
    };
  }

  return { forHtml, forTextarea };
})();
