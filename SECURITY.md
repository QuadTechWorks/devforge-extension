# Security Policy

## Supported versions

DevForge is distributed as an unpacked / side-loaded Chrome extension. Security
fixes are applied to the latest `main` and the most recent tagged release.

| Version | Supported |
| ------- | --------- |
| 1.3.x   | ✅        |
| < 1.3   | ❌        |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via either:

- GitHub's **[Private vulnerability reporting](https://github.com/QuadTechWorks/devforge-extension/security/advisories/new)** (Security tab → "Report a vulnerability"), or
- Email **security@quadtechworks.in**.

Please include reproduction steps and the affected file(s)/version. We aim to
acknowledge within 5 business days and to provide a fix or mitigation timeline
after triage.

## Data & privacy notes (by design)

DevForge runs entirely locally and makes **no network requests**. Be aware:

- **Token Vault** stores JWTs in `chrome.storage.local` in **plaintext** (the
  same browser-profile storage other extension data uses). They are never
  transmitted or verified remotely — decoding is done locally. Treat the browser
  profile as the trust boundary, and use **Settings → Clear all stored data** to
  remove stored snippets, tokens, and ports.
- **JWT Decode / Token Vault** never verify signatures and never send tokens
  anywhere.
- The **`tabs`** permission is used only to read the active tab's URL (for the
  Port Switcher banner/swap) and to open/redirect tabs. No page content is read
  or injected.

If you find behaviour that contradicts the above, that's a security issue —
please report it.
