# Changelog

All notable changes to Dev Toolbox are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] — 2026-06-05

Branding + polish release. Renames the extension to **DevForge** (by
QuadTechWorks), ships a new electric theme, fixes two bugs, and adds two games.
No tool was rebuilt — changes are additive or contained.

### Added

- **DevForge branding** — extension renamed to **DevForge**; the rail shows a
  gradient "DevForge" wordmark with a "by QuadTechWorks" subtitle, and a
  "Created by QuadTechWorks" wordmark (`icons/qtw-logo.png`) sits above Settings.
  (The wordmark is an original typeset placeholder — drop in the official asset
  by replacing that file.)
- **Colour palette picker** — a Settings row of gradient swatches: **QuadTechWorks**
  (default — sampled from quadtechworks.in: navy `#0b0f19` with a cyan `#06b6d4`
  → blue `#2563eb` → violet `#7c3aed` brand gradient and amber `#f59e0b`),
  **Classic**, **Dracula**, **Sunset**, **Synthwave**, **Emerald**, and **Ocean**.
  Each applies a full look via a `data-palette` attribute that overrides the
  colour variables (background, accents, brand gradient, find-highlights), so the
  whole UI — including the content glow and games — re-themes instantly. Saved in
  `settings.palette`.
- **Refined theming** — a brand gradient (`--brand-grad`) used by the wordmark,
  soft accent-glow gradients behind the content area, a tinted rail, and a 2px
  accent bar on the active rail item. All existing variable names are preserved,
  so every tool re-themes automatically.
- **Five more games** — **Memory** (card match), **Simon** (sequence memory),
  **Slide** (3×3 sliding puzzle), **Lights Out** (5×5 toggle puzzle), and
  **Tic-Tac-Toe** (vs a win/block/centre AI). Best scores persist under
  `game_memory_best` / `game_simon_best` / `game_slide_best` /
  `game_lights_best` / `game_ttt_wld`. All clean up their timers on unmount.
- **Expandable decoded output** — the Base64 output box gained an `⤢` expand
  toggle (native bottom-edge resize still works).
- **Base64 auto-detect** — a `✨ Auto` toggle (on by default) inspects the input
  and selects the Encode or Decode tab automatically: input that cleanly
  base64-decodes to printable UTF-8 (and matches the standard or URL-safe
  charset) switches to Decode and enables URL-safe when needed; anything else
  (text with spaces/punctuation, JSON, short words) stays on Encode. Any manual
  tab click — or Swap — turns Auto off so it never fights you.

### Changed

- `manifest.json` — name → "DevForge", version → 1.3.0, action title and command
  description updated.
- **Find-in-output highlight colors** now use theme variables (`--find-hit`
  cyan, `--find-hit-current` violet) so matches and the active match are easy to
  tell apart on either theme.
- The new "quad" app icons from 1.2.0 are retained as the DevForge mark.

### Fixed

- **Base64 find** no longer mis-scrolls or fails to highlight the matched text.
  The textarea search was rewritten to paint highlights through an aligned
  overlay layer (mirroring the textarea's wrapped text), and the active match is
  located by its real on-screen position and scrolled into view.
- **Snake game-over overlay** stayed on screen after restarting because
  `.game-overlay { display: flex }` overrode the `hidden` attribute. Added
  `.game-overlay[hidden] { display: none }`.
- **Snake colour contrast** — on the darker theme the snake body used
  `--accent-dim`, which was nearly invisible against the board. The snake now
  draws a bright cyan head and violet body with amber food on a dark board.
- **Base64 expand** control is now a clearly-styled `⤢ Expand` button and opens
  to a taller box (`min(62vh, 540px)`).

## [1.2.0] — 2026-06-05

Workflow release. Adds four new tools (three managed-store vaults plus a Games
break room), a "find in output" bar for the decode tools, and QuadTechWorks
branding. The side-panel shell, settings, history, file drop, share links, and
command palette were extended, not rewritten; the original 12 tools are
unchanged except for the additive find bar on Base64 and JWT Decode.

### Added

- **Snippet Vault** (`tools/snippets.js`) — keyed store of text snippets with
  `{{placeholder}}` substitution.
  - Two-pane UI: searchable list (filter by text, or `tag:<name>`) + editor
    (title / comma-separated tags / body). Auto-saves on blur and after 1.5 s idle.
  - Render panel lists unique placeholders, shows live substituted output + Copy.
    Placeholder names accept `[A-Za-z0-9_.-]`; empty values keep the literal token.
  - Import / export the whole vault as a JSON array; drop a text file onto the
    body to load it. Storage key `snippets`.
- **Token Vault** (`tools/tokens.js`) — managed list of JWTs grouped by env.
  - List shows label, an env chip (color = stable hash of the env string), and a
    live expiry status (✓ / ⚠ <1h / ✗ / —) recomputed every 30 s.
  - Add by pasting a raw JWT (or dropping a file); label auto-fills from the
    payload `sub` / `email` / `name`. Detail pane reuses the shared JWT decoder,
    plus notes and three copy buttons (raw / `Authorization: Bearer …` / `curl …`).
  - Storage key `tokens`. Decoding is local; tokens are never verified or sent.
- **Port Switcher** (`tools/ports.js`) — grid of localhost dev ports.
  - Sorted ascending; click a card or **Open** to launch `http://localhost:<port><path>`.
  - When the active tab is on localhost, a banner shows the current port, the
    matching card is highlighted, and **Swap to** redirects the current tab to
    the same path on another port. Inline add form. Storage key `ports`.
- **Games** (`tools/games.js`) — a break room with **Snake** (canvas; arrows /
  WASD, Space to pause) and **2048** (arrows / WASD, R to restart). High scores
  persist under `game_snake_high` / `game_2048_high`. The game loop and key
  listeners self-teardown when the tool is unmounted (a watchdog interval checks
  `document.contains`).
- **Find in output** (`tools/_find-util.js`) — a 🔍 find bar with match count and
  next/prev (`Enter` / `Shift+Enter`):
  - Base64 output (a textarea) → native selection + scroll.
  - JWT Decode and Token Vault decoded views → inline `<mark>` highlighting,
    re-applied whenever the output re-renders.
- **Clear all stored data** — a new Settings button (separate from "Clear all
  history") that wipes the three vaults after a "type DELETE to confirm" prompt
  showing the exact counts. It sets the keys to empty arrays so first-load
  seeding does not run again, and re-renders the open tool.
- **Shared JWT utility** (`tools/_jwt-util.js`) — `decode`, `expiryStatus`, and
  the parts/badges renderers, used by both JWT Decode and Token Vault.
- **QuadTechWorks branding** — new "quad" mark icons (16/32/48/128), the rail
  now shows a QuadTechWorks wordmark, and the extension name / titles were
  updated.

### Changed

- `manifest.json` — name → "QuadTechWorks Toolbox", version → 1.2.0, new icons,
  and an inline justification comment for the `tabs` permission (used by the Port
  Switcher to read the active tab URL and to open / redirect tabs; no page
  content is accessed).
- `sidepanel.js` registers the four new tools (so they appear in the rail, search,
  and command palette) and wires the Clear-all-stored-data button.
- `sidepanel.html` loads `_find-util.js` as a shared utility and the four new tool
  modules; adds the rail wordmark.
- `sidepanel.css` adds styling for the vault layout, token/env chips, port grid,
  games, the find bar, and a `.tool-container`-scoped text-input style — all
  using the existing CSS variables and dark/light theming.
- Base64 and JWT Decode gained the find bar (the only change to the original 12
  tools); JWT Decode's decode path was refactored onto the shared JWT utility
  with identical output.

### Notes / intentional limitations

- The three vaults are **managed stores**, so they intentionally opt out of the
  shell's per-tool input history, share links, and auto file-drop (they avoid the
  `*-input` textarea id the shell keys off, and keep destructive buttons off the
  `-copy` / `-clear` / `-swap` id suffixes). History is therefore not recorded for
  them by design.
- **First-load seeding only** — a `kubectl get pods -n {{namespace}}` snippet and
  the 3000 / 4200 / 8080 port trio seed only when their storage key is absent;
  existing data is never overwritten. Token Vault seeds nothing.
- **Migrations** treat a missing or non-array storage key as an empty list, so an
  upgrade or partial data never crashes a tool.
- Game high scores live under their own keys and are **not** removed by "Clear all
  stored data" (which only targets the snippet / token / port vaults).
- `manifest.json` now contains JS-style comments (for the `tabs` justification),
  which Chrome's manifest parser tolerates but strict `JSON.parse` does not.

## [1.1.0] — 2026-05-28

Polish release. No architectural rewrites: tool modules are unchanged, all new
behavior is layered onto the existing side-panel shell, the `window.Tool*`
module pattern, and `chrome.storage.local`.

### Added

- **Settings panel** (gear in the bottom-left of the rail) with:
  - Theme override: System / Light / Dark (overrides `prefers-color-scheme`).
  - Font size: Small / Medium / Large, applied to monospace areas only via
    a `--mono-scale` CSS variable.
  - "Clear all history" button (confirms first; wipes every `history:*` key).
  - "Reset all settings" button (confirms first; restores theme + font defaults).
  - Persisted to `chrome.storage.local` under `settings`.
- **Keyboard shortcuts** wired at the side-panel level:
  - `/` — focus the rail search box (when not typing in an input).
  - `Cmd/Ctrl + K` — open the command palette from anywhere.
  - `Cmd/Ctrl + Enter` — copy output (same feedback as the Copy button).
  - `Cmd/Ctrl + Shift + Backspace` — clear input.
  - `Cmd/Ctrl + Shift + S` — swap input ↔ output (where supported).
  - `Esc` — close the top overlay, or blur the focused input.
  - `?` — toggle a keyboard cheatsheet overlay.
- **Keyboard cheatsheet** — floating `?` button (bottom-right) opens a modal
  listing every shortcut.
- **Per-tool history** — last 10 inputs per tool, stored under `history:<toolId>`.
  - Saved when input has been stable for 2 seconds and is non-empty.
  - Deduplicated against the most recent entry; capped at 10.
  - 🕒 clock icon in the input's label opens a dropdown showing entries
    (truncated to ~60 chars, full value in tooltip).
  - Click an entry to load it; `×` to delete one; "Clear history" link to clear all.
  - Closes on outside click.
- **File drop** — drag-and-drop a file onto any tool's input area:
  - Text files (`.txt`, `.json`, `.csv`, `.pem`, `.key`, `.crt`, `.log`, `.md`,
    `.xml`, `.yaml`/`.yml`, `.html`/`.htm`, `.js`/`.ts`/`.css`, or any
    `text/*` MIME, or extension-less files under 1 MB) load as UTF-8.
  - Binary files load as base64 (so Hash and Base64 work naturally on binary).
  - Files over 5 MB are rejected with an inline error toast.
  - Subtle highlight on `dragenter`; a transient toast confirms successful drops
    with filename and size.
- **Shareable links** — Share button next to Copy in every applicable tool:
  - Copies `chrome-extension://<id>/sidepanel.html#tool=<id>&input=<base64url>`.
  - On panel load, a hash with `tool=` (and optional `input=`) routes to that
    tool and overrides the last-used-tool restore (one-shot).
  - Inputs over 8 KB skip encoding and copy a "paste manually" note instead.
- **Tool search rail filter** — search box at the top of the rail filters tools
  by label + description as you type. Arrow keys move focus, Enter selects,
  Esc clears.
- **Command palette** — centered modal (Cmd/Ctrl + K) with identical filtering,
  traps focus, dismisses on Esc or backdrop click.
- **Useful empty-state placeholders** — each tool now shows a realistic
  one-line example as muted placeholder text (e.g., `*/5 * * * *` for Cron,
  `{"name": "Alice", "age": 30}` for JSON Tools).

### Changed

- `sidepanel.html` adds the new overlays (settings, palette, cheatsheet),
  the rail search box, the settings gear, and the floating help button.
- `sidepanel.css` adds explicit `[data-theme]` overrides so the user's choice
  wins over `prefers-color-scheme`, plus the `--mono-scale` variable applied
  to every monospace surface (textareas, hash rows, JWT body, detect body,
  cron fires, UUID list, timestamp grid).
- Tool switching now uses a 150 ms opacity fade (`.switching` class on
  `#content`) — calm transition, no bounce.
- README documents shortcuts, the share-link format, history, file drop,
  theme/font settings, and the command palette.

### Notes / intentional limitations

- **UUID** has no text input — it does not get a history dropdown, file drop,
  or Share button. Its keyboard shortcuts still work (`Cmd/Ctrl + Enter` →
  "Copy All", `Cmd/Ctrl + Shift + Backspace` → Clear).
- **Hash** and **Auto-Detect** have no single Copy button in the action row
  (their copy buttons live per-result), so `Cmd/Ctrl + Enter` is a no-op for
  those tools. Share and Clear still work.
- Tool modules in `tools/*.js` were not modified — all cross-cutting features
  are layered on by `sidepanel.js` after each tool's `render()`.
- When a share link routes to a tool that has a previously-saved input in
  `tool_<id>_input`, there is a ~150 ms flash of the old input before the
  shared value is applied (we wait past the tool's own async restore).
- No new permissions added to `manifest.json`. File drop uses built-in HTML5
  drag-and-drop on textareas.

## [1.0.0] — Initial release

- 12 developer encode/decode tools: Auto-Detect, Base64, URL Encode, HTML
  Entities, JWT Decode, Hex ↔ ASCII, Unicode Escape, JSON Tools, Hash,
  UUID v4, Timestamp, Cron.
- Side-panel UI (Manifest V3), no build step, no dependencies.
- Live updates (100 ms debounce), copy feedback, inline error handling.
- Per-tool input persistence in `chrome.storage.local` under `tool_<id>_input`.
- Last-used-tool restore on panel open.
- Collapsible left rail.
- Dark / light theme following `prefers-color-scheme`.
- Toolbar icon, `Ctrl/Cmd + Shift + D` shortcut, and `dt <text>` omnibox
  keyword (routes to Auto-Detect with prefilled text).
