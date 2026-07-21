const _sha256K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
function sha256HexConnectSync(text) {
  const enc = new TextEncoder().encode(String(text));
  const len = enc.length;
  const bitLen = len * 8;
  const padLen = len + 9 + 63 >> 6 << 6;
  const buf = new Uint8Array(padLen);
  buf.set(enc);
  buf[len] = 128;
  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 4, bitLen, false);
  let h0 = 1779033703, h1 = 3144134277, h2 = 1013904242, h3 = 2773480762;
  let h4 = 1359893119, h5 = 2600822924, h6 = 528734635, h7 = 1541459225;
  const w = new Uint32Array(64);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = (w[i - 15] >>> 7 | w[i - 15] << 25) ^ (w[i - 15] >>> 18 | w[i - 15] << 14) ^ w[i - 15] >>> 3;
      const s1 = (w[i - 2] >>> 17 | w[i - 2] << 15) ^ (w[i - 2] >>> 19 | w[i - 2] << 13) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
      const ch = e & f ^ ~e & g;
      const t1 = h + S1 + ch + _sha256K[i] + w[i] | 0;
      const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj | 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 | 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 | 0;
    }
    h0 = h0 + a | 0;
    h1 = h1 + b | 0;
    h2 = h2 + c | 0;
    h3 = h3 + d | 0;
    h4 = h4 + e | 0;
    h5 = h5 + f | 0;
    h6 = h6 + g | 0;
    h7 = h7 + h | 0;
  }
  const out = new Uint32Array([h0, h1, h2, h3, h4, h5, h6, h7]);
  let hex = "";
  for (let i = 0; i < 8; i++) {
    const v = out[i];
    hex += (v >>> 28 & 15).toString(16) + (v >>> 24 & 15).toString(16) + (v >>> 20 & 15).toString(16) + (v >>> 16 & 15).toString(16) + (v >>> 12 & 15).toString(16) + (v >>> 8 & 15).toString(16) + (v >>> 4 & 15).toString(16) + (v & 15).toString(16);
  }
  return hex;
}
function solveConnectChallenge(challenge, ui = {}) {
  const need = "0".repeat(challenge.difficulty);
  const prefix = challenge.prefix;
  let nonce = 0;
  ui.setText?.("\u041F\u041A \u043E\u0431\u043C\u0435\u043D\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0434\u0430\u043D\u043D\u044B\u043C\u0438 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C\u2026");
  return new Promise((resolve) => {
    function step() {
      const t0 = performance.now();
      while (performance.now() - t0 < 14) {
        const input = prefix + nonce;
        const hash = sha256HexConnectSync(input);
        if (hash.startsWith(need)) {
          ui.onProgress?.(input, hash);
          resolve(`${challenge.challengeId}:${nonce}`);
          return;
        }
        nonce++;
        if (nonce % 1500 === 0) {
          ui.setText?.("\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438\u2026");
          ui.onProgress?.(input, hash);
        }
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}
const serverPowSupportCache = new Map();
async function fetchConnectToken(apiBase, ui = {}) {
  if (serverPowSupportCache.get(apiBase) === false) {
    return null;
  }
  ui.setText?.(
    serverPowSupportCache.get(apiBase) === true ? "\u0417\u0430\u043F\u0440\u043E\u0441 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438\u2026" : "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430\u2026"
  );
  let res;
  try {
    res = await fetch(apiBase + "/challenge", { cache: "no-store" });
  } catch {
    return null;
  }
  if (!res.ok) {
    if (res.status === 404) {
      serverPowSupportCache.set(apiBase, false);
    }
    return null;
  }
  let challenge;
  try {
    challenge = await res.json();
  } catch {
    return null;
  }
  if (!challenge || !challenge.challengeId || challenge.prefix == null || challenge.difficulty == null) {
    return null;
  }
  serverPowSupportCache.set(apiBase, true);
  ui.setText?.("\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0431\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438\u2026");
  const token = await solveConnectChallenge(challenge, ui);
  ui.setText?.("\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A \u0441\u0435\u0440\u0432\u0435\u0440\u0443\u2026");
  return token;
}
export {
  fetchConnectToken,
  sha256HexConnectSync,
  solveConnectChallenge
};