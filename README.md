# DevForge

**DevForge** — _by QuadTechWorks_. A Chrome side-panel extension with 16 developer utilities: 12 encode/decode tools, 3 workflow vaults (snippets, tokens, localhost ports), and a Games break room. No build step, no dependencies — pure Manifest V3 + vanilla JS.

## How to load

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `AK-extension` folder

The DevForge icon will appear in your toolbar.

## Opening the panel

| Method | Action |
|--------|--------|
| Toolbar icon | Click the `</>` icon |
| Keyboard shortcut | `Ctrl+Shift+D` (Windows/Linux) · `Cmd+Shift+D` (Mac) |
| Omnibox | Type `dt <text>` in the address bar and press Enter |

The omnibox keyword `dt` runs Auto-Detect on the text and opens the panel with the result.

## Tools

| Tool | Description |
|------|-------------|
| **Auto-Detect** | Paste anything — identifies the format (JWT, base64, hex, JSON, URL, timestamp, Unicode) and decodes it |
| **Base64** | Encode/decode Base64 with UTF-8 support and URL-safe variant; **auto-detects** whether the input is plain text or Base64 and picks the Encode/Decode tab for you (toggle the ✨ Auto button; any manual tab click turns it off) |
| **URL Encode** | Percent-encode or decode URL components (`encodeURIComponent`) |
| **HTML Entities** | Encode/decode `&amp;`, `&lt;`, `&#x27;`, etc. |
| **JWT Decode** | Split, base64url-decode, and pretty-print JWT header/payload; flags `exp` and `nbf` |
| **Hex ↔ ASCII** | Convert text to hex bytes or decode hex back to UTF-8; accepts spaces and `0x` prefixes |
| **Unicode Escape** | Convert between `\uNNNN` / `\xNN` escape sequences and plain text |
| **JSON Tools** | Prettify, minify, or escape JSON for embedding inside another JSON value |
| **Hash** | Compute MD5, SHA-1, SHA-256, SHA-512 hashes (live, updates on every keystroke) |
| **UUID v4** | Generate 1–100 cryptographically random UUIDs |
| **Timestamp** | Convert Unix timestamps (seconds or ms) to ISO dates and back; shows local + UTC |
| **Cron** | Parse 5- or 6-field cron expressions, describe them in plain English, list next 5 fire times |
| **Snippet Vault** | Saved text snippets with `{{placeholder}}` substitution, tags, search, and JSON import/export |
| **Token Vault** | Store JWTs grouped by environment; decode, track live expiry, copy as raw / Bearer / curl |
| **Port Switcher** | Jump between localhost dev ports; swap the current tab to another port on the same path |
| **Games** | Take a break — Snake, 2048, Memory, Simon, Slide puzzle, Lights Out, and Tic-Tac-Toe, with high scores saved locally |

## Features

- **Live updates** — output recalculates on every keystroke (100 ms debounce)
- **State persistence** — last-used tool and input per tool are saved in `chrome.storage.local`
- **Theme** — System / Light / Dark from the settings gear (bottom-left of the rail)
- **Palettes** — pick a colour scheme from Settings: **QuadTechWorks** (default — sampled from quadtechworks.in: navy `#0b0f19` with a cyan→blue→violet brand gradient), **Classic**, **Dracula**, **Sunset**, **Synthwave**, **Emerald**, or **Ocean**. Each is shown as a gradient swatch and re-themes the whole app (background, accents, gradients, highlights) instantly; the choice is saved.
- **Font size** — Small / Medium / Large for monospace areas
- **Copy feedback** — Copy button briefly shows "Copied ✓"
- **Error handling** — invalid input shows a friendly message inline; never throws or blanks the UI
- **Collapsible sidebar** — click the `‹` toggle to collapse the tool rail for more workspace
- **Per-tool history** — last 10 inputs per tool. Click the 🕒 clock next to the input label to revisit, restore, or delete entries (saves after 2 s of input idle time).
- **File drop** — drag a file onto any input. Text files load as UTF-8; binary files load as base64. Hard cap 5 MB.
- **Shareable links** — Share button copies a self-contained URL like `chrome-extension://<id>/sidepanel.html#tool=base64&input=<base64url>` that re-opens the tool with the same input. Inputs over 8 KB skip encoding and copy a "paste manually" note instead.
- **Find in output** — Base64, JWT Decode, and Token Vault show a 🔍 find bar over their decoded output. Type to highlight matches (themed cyan, with the active match in violet) and a running `n/m` count; `Enter` / `Shift+Enter` (or `›` / `‹`) cycle through them and scroll the active match into view. Base64 paints highlights through an aligned overlay layer; the JWT/token views highlight matches inline.
- **Expandable output** — the Base64 decoded box has an `⤢` expand toggle (and still supports the native bottom-edge drag-resize) for working with larger values.
- **Managed-store data safety** — Snippets, tokens, and ports live under their own storage keys, separate from per-tool input history. "Clear all history" in Settings does **not** touch them. A separate **Clear all stored data** button (with a "type DELETE to confirm" prompt) wipes the three vaults.

## Workflow tools

### Snippet Vault

A keyed store of reusable text snippets, each with a title, comma-separated tags, and a body. Two-pane layout: a searchable list on the left, an editor on the right that auto-saves on blur and after 1.5 s idle.

- **Placeholders** — write `{{name}}` anywhere in a body. The Render panel lists every unique placeholder with an input field and shows live substituted output you can copy. Allowed characters inside the braces: letters, digits, `_`, `.`, and `-` (e.g. `{{db.host}}`, `{{api-key}}`). An empty value leaves the literal `{{token}}` in place.
- **Tags** — free-form, comma-separated. Click a tag chip (or type `tag:kube` in search) to filter by tag.
- **Import / export** — Export copies the whole vault to the clipboard as a JSON array of `{ id, title, tags, body, createdAt, updatedAt }`. Import reads a `.json` file of the same shape and replaces the vault (after confirmation).
- **File drop** — drop a text file onto the body to load it as the snippet body.

### Token Vault

A managed list of JWTs grouped by a free-form `env` label (rendered as a color chip whose hue is a stable hash of the env string). The list shows each token's label, env chip, and a live expiry indicator (✓ valid · ⚠ expiring within the hour · ✗ expired · — no `exp`), refreshed every 30 s while the panel is open.

- **Add** — click **+ Add token**, paste a raw JWT (or drop a file containing one), optionally set an env. The label auto-fills from the payload's `sub`, `email`, or `name`.
- **Detail** — decoded header + payload (shared with the JWT Decode tool), an editable label/env, a notes field, and three copy buttons: raw token, `Authorization: Bearer <token>`, and `curl -H 'Authorization: Bearer <token>'`.
- Stored as `{ id, label, env, token, createdAt, notes }`. Decoding is local only — tokens are never verified or sent anywhere.

### Port Switcher

A grid of your common localhost dev ports, sorted ascending. Click a card (or **Open**) to open `http://localhost:<port><path>` in a new tab.

- If the active tab is already on `localhost`, a banner shows the current port and the matching card is highlighted; a **Swap to** button navigates the current tab to the same path on another port.
- Add ports inline (port number, label, optional path). Stored as `{ id, port, label, path }` (path defaults to `/`).
- Requires the **`tabs`** permission — used only to read the active tab's URL (for the banner and swap) and to open/redirect tabs. No page content is read or injected. The justification is documented inline in `manifest.json`.

### Games

A small break room with seven games:

- **Snake** — canvas; arrow keys / WASD, `Space` to pause.
- **2048** — arrow keys / WASD, `R` for a new game.
- **Memory** — flip cards two at a time to find all 8 pairs; tracks fewest moves.
- **Simon** — repeat the growing colour sequence; tracks the best round reached.
- **Slide** — 3×3 sliding puzzle; arrange the tiles 1–8 in the fewest moves.
- **Lights Out** — 5×5 grid; clicking a cell toggles it and its neighbours — turn them all off.
- **Tic-Tac-Toe** — you're X against a simple AI (win / block / centre heuristic); keeps a win/loss/draw tally.

High scores persist locally and are independent of the data vaults. Game loops, timers, and key listeners tear themselves down when you switch tools.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus tool search box (when not typing in an input) |
| `Cmd/Ctrl + K` | Open command palette (works anywhere) |
| `Cmd/Ctrl + Enter` | Copy output (matches Copy button feedback) |
| `Cmd/Ctrl + Shift + Backspace` | Clear input |
| `Cmd/Ctrl + Shift + S` | Swap input ↔ output (where supported) |
| `Esc` | Close overlay, or blur the current input |
| `?` | Toggle the keyboard cheatsheet (also via the bottom-right `?` button) |

### Command palette

Press `Cmd/Ctrl + K` from anywhere to open a centered palette. Type to filter tools by label or description, arrow keys to navigate, Enter to select, Esc to dismiss.

### Tool search

The search box at the top of the left rail filters tools as you type. Press `/` to jump to it.
