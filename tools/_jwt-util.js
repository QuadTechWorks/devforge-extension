/* Shared JWT helpers used by the JWT Decode tool (jwt.js) and the Token
   Vault (tokens.js). Pure functions on window.JWTUtil — no DOM side effects
   except the renderParts* helpers which return HTML strings.

   Loaded before jwt.js and tokens.js in sidepanel.html. */
window.JWTUtil = (function () {

  function b64urlDecode(str) {
    // Normalise base64url to base64, then decode as UTF-8.
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const binary = atob(s);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Decode a JWT into its parts. Throws on structural / parse errors.
  function decode(token) {
    const parts = String(token).trim().split('.');
    if (parts.length < 3) throw new Error("Invalid JWT: expected 3 parts separated by '.'");
    const headerObj = JSON.parse(b64urlDecode(parts[0]));
    const payloadObj = JSON.parse(b64urlDecode(parts[1]));
    return { headerObj, payloadObj, signature: parts[2] };
  }

  // exp/nbf badges (HTML) — preserves the original jwt.js behavior exactly.
  function renderBadges(claims) {
    const now = Math.floor(Date.now() / 1000);
    const badges = [];
    if (claims && claims.exp !== undefined) {
      if (claims.exp < now) badges.push({ cls: 'expired', text: 'Expired' });
      else badges.push({ cls: 'valid', text: `Expires in ${Math.round((claims.exp - now) / 60)}m` });
    }
    if (claims && claims.nbf !== undefined && claims.nbf > now) {
      badges.push({ cls: 'future', text: `Not valid yet (nbf)` });
    }
    return badges.map(b => `<span class="jwt-badge ${b.cls}">${b.text}</span>`).join('');
  }

  // Compact status used by the Token Vault list.
  // Returns { state, symbol, label } where state ∈ valid|expiring|expired|none.
  function expiryStatus(payloadObj) {
    const now = Math.floor(Date.now() / 1000);
    if (!payloadObj || payloadObj.exp === undefined) {
      return { state: 'none', symbol: '—', label: 'No exp claim' };
    }
    const exp = payloadObj.exp;
    if (exp < now) return { state: 'expired', symbol: '✗', label: 'Expired' };
    if (exp - now < 3600) return { state: 'expiring', symbol: '⚠', label: `Expiring in ${Math.round((exp - now) / 60)}m` };
    return { state: 'valid', symbol: '✓', label: 'Valid' };
  }

  function renderPartsFromDecoded(decoded) {
    const { headerObj, payloadObj, signature } = decoded;
    const payloadBadges = renderBadges(payloadObj);
    return `
      <div class="jwt-parts">
        <div class="jwt-part">
          <div class="jwt-part-header">
            <span class="jwt-part-label header">Header</span>
          </div>
          <div class="jwt-part-body">${escapeHTML(JSON.stringify(headerObj, null, 2))}</div>
        </div>
        <div class="jwt-part">
          <div class="jwt-part-header">
            <span class="jwt-part-label payload">Payload</span>
            ${payloadBadges}
          </div>
          <div class="jwt-part-body">${escapeHTML(JSON.stringify(payloadObj, null, 2))}</div>
        </div>
        <div class="jwt-part">
          <div class="jwt-part-header">
            <span class="jwt-part-label signature">Signature</span>
            <span style="font-size:10px;color:var(--text-muted);margin-left:auto">Not verified</span>
          </div>
          <div class="jwt-part-body">${escapeHTML(signature)}</div>
        </div>
      </div>`;
  }

  function renderParts(token) {
    return renderPartsFromDecoded(decode(token));
  }

  return { b64urlDecode, escapeHTML, decode, renderBadges, expiryStatus, renderPartsFromDecoded, renderParts };
})();
