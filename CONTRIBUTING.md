# Contributing to DevForge

Thanks for your interest in improving DevForge! It's a Manifest V3 Chrome
extension written in **vanilla JavaScript with no build step and no
dependencies** — please keep it that way.

## Getting started

```bash
git clone https://github.com/QuadTechWorks/devforge-extension.git
```

Load it in Chrome via `chrome://extensions` → enable **Developer mode** →
**Load unpacked** → select the folder. After changes, click the refresh icon on
the extension card to reload.

## Project layout

See the **Project structure** and **Architecture** sections of the
[README](README.md). In short: each tool is a `window.Tool<Name>` object with a
`render(container)` method, listed in `sidepanel.html` and registered in the
`TOOLS` array in `sidepanel.js`.

## Adding a tool

1. Create `tools/<name>.js` exporting:
   ```js
   window.ToolExample = {
     id: 'example',
     label: 'Example',
     icon: '🔧',
     description: '…',
     render(container) { /* build UI into container */ },
   };
   ```
2. Add `<script src="tools/<name>.js"></script>` in `sidepanel.html` (before `sidepanel.js`).
3. Add `window.ToolExample` to the `TOOLS` array in `sidepanel.js`.
4. Reuse the existing CSS variables (`--bg`, `--accent`, `--text`, …) so the tool
   inherits theming and every palette automatically.

## Conventions

- **No dependencies, no build step, no frameworks.** Plain ES that runs directly.
- **Match the surrounding style** — naming, comment density, and idioms.
- Persist data in `chrome.storage.local`; treat missing keys as empty/defaults
  (never crash on first run).
- Tools that manage their own store (vaults) should **not** name a textarea
  `id="*-input"`, to opt out of the shell's history/file-drop/share layer.

## Before opening a PR

- Syntax-check changed files: `node --check tools/<name>.js`
- Manually verify in Chrome (load unpacked, exercise the tool, check light/dark
  and a couple of palettes).
- Update `CHANGELOG.md` and bump the version in `manifest.json` if appropriate.
- Keep PRs focused; describe what you changed and how you tested it.

## Reporting bugs / requesting features

Use the issue templates under **New issue**. For security problems, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.

By contributing, you agree your contributions are licensed under the
[Apache License 2.0](LICENSE).
