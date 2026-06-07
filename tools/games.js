/* Games — a quick break tool. Snake (canvas) and 2048 (grid), both keyboard
   driven, with high scores saved in chrome.storage.local. Game loops and
   keydown listeners self-teardown when the tool is navigated away (a watchdog
   checks document.contains on an interval), since render() has no teardown
   hook. Does not use a `*-input` textarea, so the shell does not attach
   history/share/file-drop. */
window.ToolGames = {
  id: 'games',
  label: 'Games',
  icon: '🎮',
  description: 'Take a break — play Snake or 2048. High scores saved locally.',

  render(container) {
    let cleanup = null;     // teardown for the currently-mounted game
    let watchdog = null;    // detects navigation away and tears everything down

    container.innerHTML = `
      <div class="tool-container">
        <div class="tool-header">
          <div class="tool-title">Games</div>
          <div class="tool-desc">A quick break between tasks. Use arrow keys or WASD. Scores save locally.</div>
        </div>
        <div class="action-row" id="game-picker">
          <button data-game="snake" type="button" class="active">🐍 Snake</button>
          <button data-game="g2048" type="button">🔢 2048</button>
          <button data-game="memory" type="button">🧠 Memory</button>
          <button data-game="simon" type="button">🎵 Simon</button>
          <button data-game="slide" type="button">🧩 Slide</button>
          <button data-game="lights" type="button">💡 Lights Out</button>
          <button data-game="ttt" type="button">⭕ Tic-Tac-Toe</button>
        </div>
        <div id="game-stage" class="game-stage" tabindex="0"></div>
      </div>`;

    const picker = container.querySelector('#game-picker');
    const stage  = container.querySelector('#game-stage');

    function teardownGame() {
      if (cleanup) { try { cleanup(); } catch (_) {} cleanup = null; }
      stage.innerHTML = '';
    }

    const GAMES = {
      snake: mountSnake, g2048: mount2048, memory: mountMemory,
      simon: mountSimon, slide: mountSlide, lights: mountLights, ttt: mountTicTacToe,
    };

    function mount(game) {
      if (!GAMES[game]) game = 'snake';
      teardownGame();
      picker.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.game === game));
      cleanup = GAMES[game](stage);
      chrome.storage.local.set({ game_last: game });
      stage.focus();
    }

    picker.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-game]');
      if (btn) mount(btn.dataset.game);
    });

    // Watchdog: when the tool is unmounted, navigate() clears #content; detect
    // that and tear down the active game's loop + listeners.
    watchdog = setInterval(() => {
      if (!document.contains(stage)) {
        clearInterval(watchdog);
        teardownGame();
      }
    }, 1000);

    chrome.storage.local.get('game_last', (d) => {
      mount(d.game_last || 'snake');
    });

    // ─────────────────────────────────────────────────────────────────────
    // SNAKE
    // ─────────────────────────────────────────────────────────────────────
    function mountSnake(root) {
      const COLS = 17, ROWS = 17, CELL = 16;
      const W = COLS * CELL, H = ROWS * CELL;

      root.innerHTML = `
        <div class="game-bar">
          <span class="game-score">Score: <strong id="snake-score">0</strong></span>
          <span class="game-best">Best: <strong id="snake-best">0</strong></span>
          <span class="spacer"></span>
          <button id="snake-pause" type="button" class="game-btn">Pause</button>
          <button id="snake-restart" type="button" class="game-btn">Restart</button>
        </div>
        <div class="game-canvas-wrap">
          <canvas id="snake-canvas" width="${W}" height="${H}"></canvas>
          <div id="snake-overlay" class="game-overlay" hidden></div>
        </div>
        <div class="game-help">Arrow keys / WASD to move · Space to pause</div>`;

      const canvas  = root.querySelector('#snake-canvas');
      const ctx     = canvas.getContext('2d');
      const scoreEl = root.querySelector('#snake-score');
      const bestEl  = root.querySelector('#snake-best');
      const overlay = root.querySelector('#snake-overlay');
      const pauseBtn= root.querySelector('#snake-pause');
      const restart = root.querySelector('#snake-restart');

      let snake, dir, nextDir, food, score, best = 0, speed, timer = null, state;
      // state: 'running' | 'paused' | 'over'

      function css(varName, fallback) {
        const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        return v || fallback;
      }

      function reset() {
        snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
        dir = { x: 1, y: 0 };
        nextDir = { x: 1, y: 0 };
        score = 0;
        speed = 130;
        placeFood();
        state = 'running';
        scoreEl.textContent = '0';
        overlay.hidden = true;
        pauseBtn.textContent = 'Pause';
        startLoop();
        draw();
      }

      function placeFood() {
        do {
          food = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 };
        } while (snake.some(s => s.x === food.x && s.y === food.y));
      }

      function startLoop() {
        clearInterval(timer);
        timer = setInterval(step, speed);
      }

      function step() {
        if (state !== 'running') return;
        dir = nextDir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        // wall or self collision → game over
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
            snake.some(s => s.x === head.x && s.y === head.y)) {
          gameOver();
          return;
        }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
          score++;
          scoreEl.textContent = String(score);
          if (score > best) { best = score; bestEl.textContent = String(best); saveBest(); }
          if (speed > 60 && score % 4 === 0) { speed -= 6; startLoop(); }
          placeFood();
        } else {
          snake.pop();
        }
        draw();
      }

      function draw() {
        // dark board for strong contrast with the snake/food
        ctx.fillStyle = css('--bg', '#0f0d22');
        ctx.fillRect(0, 0, W, H);
        // food — amber, pops against violet/cyan
        ctx.fillStyle = css('--warning', '#ffc56b');
        roundCell(food.x, food.y);
        // snake — bright cyan head, violet body
        const head = css('--accent-2', '#22d3ee');
        const body = css('--accent', '#7c5cff');
        snake.forEach((s, i) => {
          ctx.fillStyle = i === 0 ? head : body;
          roundCell(s.x, s.y);
        });
      }
      function roundCell(cx, cy) {
        const pad = 1, r = 3, x = cx * CELL + pad, y = cy * CELL + pad, s = CELL - pad * 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + s, y, x + s, y + s, r);
        ctx.arcTo(x + s, y + s, x, y + s, r);
        ctx.arcTo(x, y + s, x, y, r);
        ctx.arcTo(x, y, x + s, y, r);
        ctx.closePath();
        ctx.fill();
      }

      function gameOver() {
        state = 'over';
        clearInterval(timer);
        overlay.hidden = false;
        overlay.innerHTML = `<div class="game-over-title">Game over</div>
          <div class="game-over-sub">Score ${score}${score >= best ? ' · new best!' : ''}</div>
          <button id="snake-again" type="button" class="game-btn primary">Play again</button>`;
        overlay.querySelector('#snake-again').addEventListener('click', reset);
      }

      function togglePause() {
        if (state === 'over') return;
        if (state === 'running') { state = 'paused'; pauseBtn.textContent = 'Resume'; }
        else { state = 'running'; pauseBtn.textContent = 'Pause'; }
      }

      function setDir(nx, ny) {
        // disallow reversing directly
        if (snake.length > 1 && nx === -dir.x && ny === -dir.y) return;
        nextDir = { x: nx, y: ny };
      }

      function onKey(e) {
        const k = e.key.toLowerCase();
        let handled = true;
        if (k === 'arrowup' || k === 'w') setDir(0, -1);
        else if (k === 'arrowdown' || k === 's') setDir(0, 1);
        else if (k === 'arrowleft' || k === 'a') setDir(-1, 0);
        else if (k === 'arrowright' || k === 'd') setDir(1, 0);
        else if (k === ' ') togglePause();
        else handled = false;
        if (handled) e.preventDefault();
      }

      function saveBest() { chrome.storage.local.set({ game_snake_high: best }); }

      document.addEventListener('keydown', onKey);
      pauseBtn.addEventListener('click', () => { togglePause(); stage.focus(); });
      restart.addEventListener('click', () => { reset(); stage.focus(); });

      chrome.storage.local.get('game_snake_high', (d) => {
        best = Number(d.game_snake_high) || 0;
        bestEl.textContent = String(best);
      });

      reset();

      return function teardown() {
        clearInterval(timer);
        document.removeEventListener('keydown', onKey);
      };
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2048
    // ─────────────────────────────────────────────────────────────────────
    function mount2048(root) {
      root.innerHTML = `
        <div class="game-bar">
          <span class="game-score">Score: <strong id="g2048-score">0</strong></span>
          <span class="game-best">Best: <strong id="g2048-best">0</strong></span>
          <span class="spacer"></span>
          <button id="g2048-restart" type="button" class="game-btn">New game</button>
        </div>
        <div class="g2048-board" id="g2048-board"></div>
        <div id="g2048-msg" class="g2048-msg" hidden></div>
        <div class="game-help">Arrow keys / WASD to merge tiles · join to reach 2048</div>`;

      const boardEl = root.querySelector('#g2048-board');
      const scoreEl = root.querySelector('#g2048-score');
      const bestEl  = root.querySelector('#g2048-best');
      const msgEl   = root.querySelector('#g2048-msg');
      const restart = root.querySelector('#g2048-restart');

      let board, score, best = 0, won;

      // build 16 tile cells once
      const cells = [];
      for (let i = 0; i < 16; i++) {
        const c = document.createElement('div');
        c.className = 'g2048-tile';
        boardEl.appendChild(c);
        cells.push(c);
      }

      function reset() {
        board = new Array(16).fill(0);
        score = 0; won = false;
        msgEl.hidden = true;
        spawn(); spawn();
        render();
      }

      function emptyIdx() {
        const e = [];
        for (let i = 0; i < 16; i++) if (board[i] === 0) e.push(i);
        return e;
      }
      function spawn() {
        const e = emptyIdx();
        if (!e.length) return;
        board[e[(Math.random() * e.length) | 0]] = Math.random() < 0.9 ? 2 : 4;
      }

      function render() {
        scoreEl.textContent = String(score);
        bestEl.textContent = String(best);
        for (let i = 0; i < 16; i++) {
          const v = board[i];
          const cell = cells[i];
          cell.textContent = v ? String(v) : '';
          cell.className = 'g2048-tile' + (v ? ' v' + (v > 2048 ? 'big' : v) : '');
        }
      }

      function move(dir) {
        let moved = false, gained = 0;
        const get = (r, c) => board[r * 4 + c];
        const set = (r, c, v) => { board[r * 4 + c] = v; };
        function lineCells(i) {
          const out = [];
          if (dir === 'left')  for (let c = 0; c < 4; c++) out.push([i, c]);
          if (dir === 'right') for (let c = 3; c >= 0; c--) out.push([i, c]);
          if (dir === 'up')    for (let r = 0; r < 4; r++) out.push([r, i]);
          if (dir === 'down')  for (let r = 3; r >= 0; r--) out.push([r, i]);
          return out;
        }
        for (let i = 0; i < 4; i++) {
          const lc = lineCells(i);
          const vals = lc.map(([r, c]) => get(r, c)).filter(v => v !== 0);
          const merged = [];
          for (let j = 0; j < vals.length; j++) {
            if (j < vals.length - 1 && vals[j] === vals[j + 1]) {
              const m = vals[j] * 2; merged.push(m); gained += m;
              if (m === 2048) won = true;
              j++;
            } else merged.push(vals[j]);
          }
          while (merged.length < 4) merged.push(0);
          lc.forEach(([r, c], k) => {
            if (get(r, c) !== merged[k]) moved = true;
            set(r, c, merged[k]);
          });
        }
        if (moved) {
          score += gained;
          if (score > best) { best = score; chrome.storage.local.set({ game_2048_high: best }); }
          spawn();
          render();
          if (won) { showMsg('You made 2048! 🎉 Keep going.'); won = false; }
          else if (isOver()) showMsg('No moves left — game over.');
        }
      }

      function isOver() {
        if (emptyIdx().length) return false;
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
          const v = board[r * 4 + c];
          if (c < 3 && v === board[r * 4 + c + 1]) return false;
          if (r < 3 && v === board[(r + 1) * 4 + c]) return false;
        }
        return true;
      }

      function showMsg(text) { msgEl.hidden = false; msgEl.textContent = text; }

      function onKey(e) {
        const k = e.key.toLowerCase();
        let dir = null;
        if (k === 'arrowup' || k === 'w') dir = 'up';
        else if (k === 'arrowdown' || k === 's') dir = 'down';
        else if (k === 'arrowleft' || k === 'a') dir = 'left';
        else if (k === 'arrowright' || k === 'd') dir = 'right';
        else if (k === 'r') { reset(); e.preventDefault(); return; }
        if (!dir) return;
        e.preventDefault();
        move(dir);
      }

      document.addEventListener('keydown', onKey);
      restart.addEventListener('click', () => { reset(); stage.focus(); });

      chrome.storage.local.get('game_2048_high', (d) => {
        best = Number(d.game_2048_high) || 0;
        render();
      });

      reset();

      return function teardown() {
        document.removeEventListener('keydown', onKey);
      };
    }

    // ─────────────────────────────────────────────────────────────────────
    // MEMORY (card match)
    // ─────────────────────────────────────────────────────────────────────
    function mountMemory(root) {
      const SYMBOLS = ['🐍', '🎮', '🔢', '🧠', '⚡', '🚀', '🔑', '📦'];
      let deck = [], flipped = [], matched = 0, moves = 0, best = 0, lock = false, flipTimer = null;

      root.innerHTML = `
        <div class="game-bar">
          <span class="game-score">Moves: <strong id="mem-moves">0</strong></span>
          <span class="game-best">Best: <strong id="mem-best">—</strong></span>
          <span class="spacer"></span>
          <button id="mem-restart" type="button" class="game-btn">New game</button>
        </div>
        <div id="mem-grid" class="mem-grid"></div>
        <div id="mem-msg" class="g2048-msg" hidden></div>
        <div class="game-help">Flip two cards at a time to find all matching pairs.</div>`;

      const grid    = root.querySelector('#mem-grid');
      const movesEl = root.querySelector('#mem-moves');
      const bestEl  = root.querySelector('#mem-best');
      const msgEl   = root.querySelector('#mem-msg');
      const restart = root.querySelector('#mem-restart');

      function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
          const j = (Math.random() * (i + 1)) | 0;
          const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      }
      function reset() {
        clearTimeout(flipTimer);
        deck = shuffle(SYMBOLS.concat(SYMBOLS));
        flipped = []; matched = 0; moves = 0; lock = false;
        movesEl.textContent = '0';
        msgEl.hidden = true;
        render();
      }
      function render() {
        grid.innerHTML = '';
        deck.forEach((sym, i) => {
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'mem-card';
          card.dataset.i = String(i);
          card.addEventListener('click', () => flip(i, card));
          grid.appendChild(card);
        });
      }
      function flip(i, card) {
        if (lock || card.classList.contains('matched') || card.classList.contains('flipped')) return;
        card.classList.add('flipped');
        card.textContent = deck[i];
        flipped.push({ i, card });
        if (flipped.length === 2) {
          moves++; movesEl.textContent = String(moves);
          const a = flipped[0], b = flipped[1];
          if (deck[a.i] === deck[b.i]) {
            a.card.classList.add('matched');
            b.card.classList.add('matched');
            flipped = [];
            if (++matched === SYMBOLS.length) win();
          } else {
            lock = true;
            flipTimer = setTimeout(() => {
              a.card.classList.remove('flipped'); a.card.textContent = '';
              b.card.classList.remove('flipped'); b.card.textContent = '';
              flipped = []; lock = false;
            }, 800);
          }
        }
      }
      function win() {
        if (!best || moves < best) {
          best = moves;
          chrome.storage.local.set({ game_memory_best: best });
          bestEl.textContent = String(best);
        }
        msgEl.hidden = false;
        msgEl.textContent = `Solved in ${moves} moves! 🎉`;
      }

      restart.addEventListener('click', () => { reset(); stage.focus(); });
      chrome.storage.local.get('game_memory_best', (d) => {
        best = Number(d.game_memory_best) || 0;
        bestEl.textContent = best ? String(best) : '—';
      });
      reset();

      return function teardown() { clearTimeout(flipTimer); };
    }

    // ─────────────────────────────────────────────────────────────────────
    // SIMON (repeat the growing color sequence)
    // ─────────────────────────────────────────────────────────────────────
    function mountSimon(root) {
      const PADS = ['g', 'r', 'y', 'b'];
      let seq = [], step = 0, round = 0, best = 0, accepting = false, timers = [];

      root.innerHTML = `
        <div class="game-bar">
          <span class="game-score">Round: <strong id="sim-round">0</strong></span>
          <span class="game-best">Best: <strong id="sim-best">0</strong></span>
          <span class="spacer"></span>
          <button id="sim-start" type="button" class="game-btn primary">Start</button>
        </div>
        <div id="sim-board" class="sim-board">
          <button class="sim-pad g" data-pad="g" type="button" aria-label="green"></button>
          <button class="sim-pad r" data-pad="r" type="button" aria-label="red"></button>
          <button class="sim-pad y" data-pad="y" type="button" aria-label="yellow"></button>
          <button class="sim-pad b" data-pad="b" type="button" aria-label="blue"></button>
        </div>
        <div id="sim-msg" class="g2048-msg">Press Start, then repeat the pattern.</div>
        <div class="game-help">Watch the sequence light up, then click the pads in the same order.</div>`;

      const roundEl = root.querySelector('#sim-round');
      const bestEl  = root.querySelector('#sim-best');
      const startBtn= root.querySelector('#sim-start');
      const msgEl   = root.querySelector('#sim-msg');
      const pads = {};
      root.querySelectorAll('.sim-pad').forEach(p => { pads[p.dataset.pad] = p; });

      function clearTimers() { timers.forEach(clearTimeout); timers = []; }
      function flash(pad) {
        const el = pads[pad];
        el.classList.add('lit');
        timers.push(setTimeout(() => el.classList.remove('lit'), 320));
      }
      function playSeq() {
        accepting = false;
        seq.forEach((p, idx) => {
          timers.push(setTimeout(() => {
            flash(p);
            if (idx === seq.length - 1) {
              timers.push(setTimeout(() => { accepting = true; msgEl.textContent = 'Your turn…'; }, 420));
            }
          }, 620 * (idx + 1)));
        });
      }
      function next() {
        accepting = false; step = 0; round++;
        roundEl.textContent = String(round);
        seq.push(PADS[(Math.random() * 4) | 0]);
        msgEl.textContent = 'Watch…';
        timers.push(setTimeout(playSeq, 500));
      }
      function start() { clearTimers(); seq = []; round = 0; step = 0; next(); }
      function press(pad) {
        if (!accepting) return;
        flash(pad);
        if (pad === seq[step]) {
          step++;
          if (step === seq.length) {
            accepting = false;
            if (round > best) { best = round; chrome.storage.local.set({ game_simon_best: best }); bestEl.textContent = String(best); }
            msgEl.textContent = 'Nice! Next round…';
            timers.push(setTimeout(next, 700));
          }
        } else {
          accepting = false;
          msgEl.textContent = `Wrong! You reached round ${round}. Press Start to retry.`;
        }
      }

      root.querySelectorAll('.sim-pad').forEach(p => p.addEventListener('click', () => press(p.dataset.pad)));
      startBtn.addEventListener('click', () => { start(); stage.focus(); });
      chrome.storage.local.get('game_simon_best', (d) => { best = Number(d.game_simon_best) || 0; bestEl.textContent = String(best); });

      return function teardown() { clearTimers(); };
    }

    // ─────────────────────────────────────────────────────────────────────
    // SLIDING PUZZLE (3×3, arrange 1–8)
    // ─────────────────────────────────────────────────────────────────────
    function mountSlide(root) {
      const N = 3, SIZE = N * N;
      let tiles = [], blank = SIZE - 1, moves = 0, best = 0;

      root.innerHTML = `
        <div class="game-bar">
          <span class="game-score">Moves: <strong id="slide-moves">0</strong></span>
          <span class="game-best">Best: <strong id="slide-best">—</strong></span>
          <span class="spacer"></span>
          <button id="slide-shuffle" type="button" class="game-btn">Shuffle</button>
        </div>
        <div id="slide-grid" class="slide-grid"></div>
        <div id="slide-msg" class="g2048-msg" hidden></div>
        <div class="game-help">Click a tile next to the gap to slide it. Order the tiles 1–8.</div>`;

      const grid    = root.querySelector('#slide-grid');
      const movesEl = root.querySelector('#slide-moves');
      const bestEl  = root.querySelector('#slide-best');
      const msgEl   = root.querySelector('#slide-msg');
      const shuffleBtn = root.querySelector('#slide-shuffle');

      function neighbors(i) {
        const r = (i / N) | 0, c = i % N, out = [];
        if (r > 0) out.push(i - N);
        if (r < N - 1) out.push(i + N);
        if (c > 0) out.push(i - 1);
        if (c < N - 1) out.push(i + 1);
        return out;
      }
      function solved() { for (let i = 0; i < SIZE - 1; i++) if (tiles[i] !== i + 1) return false; return true; }
      function render() {
        grid.innerHTML = '';
        tiles.forEach((v, i) => {
          const c = document.createElement('button');
          c.type = 'button';
          c.className = 'slide-tile' + (v === 0 ? ' blank' : '');
          c.textContent = v === 0 ? '' : String(v);
          if (v !== 0) c.addEventListener('click', () => move(i));
          grid.appendChild(c);
        });
      }
      function move(i) {
        if (neighbors(i).indexOf(blank) === -1) return;
        tiles[blank] = tiles[i]; tiles[i] = 0; blank = i;
        moves++; movesEl.textContent = String(moves);
        render();
        if (solved()) win();
      }
      function shuffle() {
        tiles = [];
        for (let i = 1; i < SIZE; i++) tiles.push(i);
        tiles.push(0);
        blank = SIZE - 1;
        let prev = -1;
        for (let k = 0; k < 200; k++) {
          const ns = neighbors(blank).filter(n => n !== prev);
          const pick = ns[(Math.random() * ns.length) | 0];
          tiles[blank] = tiles[pick]; tiles[pick] = 0; prev = blank; blank = pick;
        }
        moves = 0; movesEl.textContent = '0'; msgEl.hidden = true;
        render();
        if (solved()) shuffle();   // re-shuffle on the rare solved deal
      }
      function win() {
        msgEl.hidden = false;
        msgEl.textContent = `Solved in ${moves} moves! 🎉`;
        if (!best || moves < best) { best = moves; chrome.storage.local.set({ game_slide_best: best }); bestEl.textContent = String(best); }
      }

      shuffleBtn.addEventListener('click', () => { shuffle(); stage.focus(); });
      chrome.storage.local.get('game_slide_best', (d) => { best = Number(d.game_slide_best) || 0; bestEl.textContent = best ? String(best) : '—'; });
      shuffle();

      return function teardown() {};
    }

    // ─────────────────────────────────────────────────────────────────────
    // LIGHTS OUT (5×5 — turn every light off)
    // ─────────────────────────────────────────────────────────────────────
    function mountLights(root) {
      const N = 5;
      let cells = [], moves = 0, best = 0;

      root.innerHTML = `
        <div class="game-bar">
          <span class="game-score">Moves: <strong id="lights-moves">0</strong></span>
          <span class="game-best">Best: <strong id="lights-best">—</strong></span>
          <span class="spacer"></span>
          <button id="lights-new" type="button" class="game-btn">New game</button>
        </div>
        <div id="lights-grid" class="lights-grid"></div>
        <div id="lights-msg" class="g2048-msg" hidden></div>
        <div class="game-help">Click a cell to toggle it and its neighbours. Turn them all off.</div>`;

      const grid    = root.querySelector('#lights-grid');
      const movesEl = root.querySelector('#lights-moves');
      const bestEl  = root.querySelector('#lights-best');
      const msgEl   = root.querySelector('#lights-msg');
      const newBtn  = root.querySelector('#lights-new');

      function toggleAt(i) {
        const r = (i / N) | 0, c = i % N;
        cells[i] = !cells[i];
        if (r > 0) cells[i - N] = !cells[i - N];
        if (r < N - 1) cells[i + N] = !cells[i + N];
        if (c > 0) cells[i - 1] = !cells[i - 1];
        if (c < N - 1) cells[i + 1] = !cells[i + 1];
      }
      function render() {
        grid.innerHTML = '';
        cells.forEach((on, i) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'lights-cell' + (on ? ' on' : '');
          b.addEventListener('click', () => click(i));
          grid.appendChild(b);
        });
      }
      function click(i) {
        toggleAt(i);
        moves++; movesEl.textContent = String(moves);
        render();
        if (cells.every(v => !v)) win();
      }
      function newGame() {
        cells = new Array(N * N).fill(false);
        const k = 6 + ((Math.random() * 8) | 0);
        for (let n = 0; n < k; n++) toggleAt((Math.random() * N * N) | 0);
        if (cells.every(v => !v)) toggleAt(0);   // ensure not already solved
        moves = 0; movesEl.textContent = '0'; msgEl.hidden = true;
        render();
      }
      function win() {
        msgEl.hidden = false;
        msgEl.textContent = `All off in ${moves} moves! 🎉`;
        if (!best || moves < best) { best = moves; chrome.storage.local.set({ game_lights_best: best }); bestEl.textContent = String(best); }
      }

      newBtn.addEventListener('click', () => { newGame(); stage.focus(); });
      chrome.storage.local.get('game_lights_best', (d) => { best = Number(d.game_lights_best) || 0; bestEl.textContent = best ? String(best) : '—'; });
      newGame();

      return function teardown() {};
    }

    // ─────────────────────────────────────────────────────────────────────
    // TIC-TAC-TOE (vs a simple AI)
    // ─────────────────────────────────────────────────────────────────────
    function mountTicTacToe(root) {
      const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      let board, over, wld = { w: 0, l: 0, d: 0 }, aiTimer = null;

      root.innerHTML = `
        <div class="game-bar">
          <span class="game-score">You <strong id="ttt-w">0</strong> · AI <strong id="ttt-l">0</strong> · Draw <strong id="ttt-d">0</strong></span>
          <span class="spacer"></span>
          <button id="ttt-restart" type="button" class="game-btn">New game</button>
        </div>
        <div id="ttt-grid" class="ttt-grid"></div>
        <div id="ttt-msg" class="g2048-msg">You are X — your move.</div>
        <div class="game-help">Click a square to place your X.</div>`;

      const grid    = root.querySelector('#ttt-grid');
      const msgEl   = root.querySelector('#ttt-msg');
      const restart = root.querySelector('#ttt-restart');
      const wEl = root.querySelector('#ttt-w'), lEl = root.querySelector('#ttt-l'), dEl = root.querySelector('#ttt-d');

      function winner(b) {
        for (let k = 0; k < LINES.length; k++) {
          const [a, c, d] = LINES[k];
          if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
        }
        return null;
      }
      function empties(b) { const e = []; for (let i = 0; i < 9; i++) if (!b[i]) e.push(i); return e; }

      function reset() {
        clearTimeout(aiTimer);
        board = new Array(9).fill('');
        over = false;
        msgEl.textContent = 'You are X — your move.';
        render();
      }
      function render() {
        grid.innerHTML = '';
        board.forEach((v, i) => {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'ttt-cell' + (v ? ' ' + v.toLowerCase() : '');
          cell.textContent = v;
          cell.disabled = over || !!v;
          cell.addEventListener('click', () => play(i));
          grid.appendChild(cell);
        });
      }
      function play(i) {
        if (over || board[i]) return;
        board[i] = 'X';
        render();
        if (finish()) return;
        aiTimer = setTimeout(aiMove, 280);
      }
      function aiMove() {
        if (over) return;
        const i = bestMove();
        if (i != null) board[i] = 'O';
        render();
        finish();
      }
      function bestMove() {
        const e = empties(board);
        const findWin = (mark) => {
          for (let k = 0; k < e.length; k++) {
            const copy = board.slice(); copy[e[k]] = mark;
            if (winner(copy) === mark) return e[k];
          }
          return null;
        };
        let m = findWin('O'); if (m != null) return m;       // win if able
        m = findWin('X'); if (m != null) return m;            // else block
        if (!board[4]) return 4;                              // else take centre
        const corners = [0, 2, 6, 8].filter(i => !board[i]);
        if (corners.length) return corners[(Math.random() * corners.length) | 0];
        return e.length ? e[(Math.random() * e.length) | 0] : null;
      }
      function finish() {
        const w = winner(board);
        if (w === 'X') { over = true; wld.w++; msgEl.textContent = 'You win! 🎉'; done(); return true; }
        if (w === 'O') { over = true; wld.l++; msgEl.textContent = 'AI wins — try again.'; done(); return true; }
        if (empties(board).length === 0) { over = true; wld.d++; msgEl.textContent = "It's a draw."; done(); return true; }
        msgEl.textContent = 'Your move.';
        return false;
      }
      function done() {
        wEl.textContent = String(wld.w); lEl.textContent = String(wld.l); dEl.textContent = String(wld.d);
        chrome.storage.local.set({ game_ttt_wld: wld });
        render();
      }

      restart.addEventListener('click', () => { reset(); stage.focus(); });
      chrome.storage.local.get('game_ttt_wld', (d) => {
        if (d.game_ttt_wld) wld = Object.assign({ w: 0, l: 0, d: 0 }, d.game_ttt_wld);
        wEl.textContent = String(wld.w); lEl.textContent = String(wld.l); dEl.textContent = String(wld.d);
      });
      reset();

      return function teardown() { clearTimeout(aiTimer); };
    }
  }
};
