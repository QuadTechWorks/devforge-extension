/* Standalone MD5 implementation — crypto.subtle does not support MD5.
   RFC 1321, adapted from a compact public-domain implementation.
   Operates on Uint8Array input, returns lowercase hex string. */
(function() {
  // Per-round shift amounts
  const S = [
    7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
    5, 9,14,20, 5, 9,14,20, 5, 9,14,20, 5, 9,14,20,
    4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
    6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21
  ];

  // Precomputed table of abs(sin(i+1)) * 2^32
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = (Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;

  function md5(bytes) {
    // Pre-processing: pad message
    const origLen = bytes.length;
    const bitLen = origLen * 8;

    // Append 0x80, then zeros, then 64-bit length (little-endian)
    const padLen = ((origLen + 8) & ~63) + 56 - origLen;
    const padded = new Uint8Array(origLen + padLen + 8);
    padded.set(bytes);
    padded[origLen] = 0x80;
    // Encode bit length as two 32-bit LE words
    const dv = new DataView(padded.buffer);
    dv.setUint32(origLen + padLen,     bitLen & 0xFFFFFFFF, true);
    dv.setUint32(origLen + padLen + 4, Math.floor(bitLen / 0x100000000), true);

    // Initial hash state
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

    // Process each 512-bit (64-byte) block
    for (let offset = 0; offset < padded.length; offset += 64) {
      const M = new Uint32Array(16);
      for (let j = 0; j < 16; j++) M[j] = dv.getUint32(offset + j * 4, true);

      let A = a0, B = b0, C = c0, D = d0;

      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16)      { F = (B & C) | (~B & D);      g = i; }
        else if (i < 32) { F = (D & B) | (~D & C);      g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D;               g = (3 * i + 5) % 16; }
        else             { F = C ^ (B | ~D);             g = (7 * i) % 16; }

        F = (F + A + K[i] + M[g]) >>> 0;
        A = D; D = C; C = B;
        B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
      }

      a0 = (a0 + A) >>> 0;
      b0 = (b0 + B) >>> 0;
      c0 = (c0 + C) >>> 0;
      d0 = (d0 + D) >>> 0;
    }

    // Output as little-endian hex
    return [a0, b0, c0, d0].map(w => {
      // Convert each 32-bit word to 4 bytes LE, then to hex
      return Array.from(new Uint8Array(new Uint32Array([w]).buffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    }).join('');
  }

  window.md5 = function(input) {
    const bytes = typeof input === 'string'
      ? new TextEncoder().encode(input)
      : input;
    return md5(bytes);
  };
})();
