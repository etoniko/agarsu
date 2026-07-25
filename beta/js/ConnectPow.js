const serverPowSupportCache = new Map();

const _sha256K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

export function getGameServerApiBase(hostOrUrl, servers = {}) {
    if (!hostOrUrl) {
        const ffa = servers.ffa;
        return ffa?.api || "https://ffa.agar.su";
    }
    const host = String(hostOrUrl).replace(/^wss?:\/\//i, "");
    for (const s of Object.values(servers)) {
        if (s.host === host || s.api === hostOrUrl) return s.api;
    }
    if (/^https?:\/\//i.test(hostOrUrl)) return String(hostOrUrl).replace(/\/$/, "");
    return "https://" + host;
}

function sha256HexConnectSync(text) {
    const enc = new TextEncoder().encode(String(text));
    const len = enc.length;
    const bitLen = len * 8;
    const padLen = ((len + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(padLen);
    buf.set(enc);
    buf[len] = 0x80;
    const view = new DataView(buf.buffer);
    view.setUint32(padLen - 4, bitLen, false);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64);
    for (let off = 0; off < padLen; off += 64) {
        for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
        for (let i = 16; i < 64; i++) {
            const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3);
            const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (let i = 0; i < 64; i++) {
            const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            const ch = (e & f) ^ (~e & g);
            const t1 = (h + S1 + ch + _sha256K[i] + w[i]) | 0;
            const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) | 0;
            h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
        h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    const out = new Uint32Array([h0, h1, h2, h3, h4, h5, h6, h7]);
    let hex = "";
    for (let i = 0; i < 8; i++) {
        const v = out[i];
        hex += ((v >>> 28) & 0xf).toString(16) + ((v >>> 24) & 0xf).toString(16) +
               ((v >>> 20) & 0xf).toString(16) + ((v >>> 16) & 0xf).toString(16) +
               ((v >>> 12) & 0xf).toString(16) + ((v >>> 8) & 0xf).toString(16) +
               ((v >>> 4) & 0xf).toString(16) + (v & 0xf).toString(16);
    }
    return hex;
}

export function setConnectVerifyText(text) {
    const textEl = document.getElementById("connect-verify-text");
    if (textEl && text) textEl.textContent = text;
}

export function resetConnectVerifyStream() {
    const stream = document.getElementById("connect-verify-data-stream");
    if (stream) stream.textContent = 'sha256("…") → …';
}

export function showConnectVerifyOverlay(text) {
    const overlay = document.getElementById("connect-verify-overlay");
    const title = document.getElementById("connect-verify-title");
    if (!overlay) return;
    resetConnectVerifyStream();
    if (title) title.textContent = "Проверка безопасности";
    overlay.style.display = "flex";
    setConnectVerifyText(text);
}

export function hideConnectVerifyOverlay() {
    const overlay = document.getElementById("connect-verify-overlay");
    resetConnectVerifyStream();
    if (overlay) overlay.style.display = "none";
}

function updateConnectTransferStream(inputPreview, hashHex) {
    const stream = document.getElementById("connect-verify-data-stream");
    if (!stream) return;
    const raw = String(inputPreview);
    const tail = raw.length > 18 ? "…" + raw.slice(-14) : raw;
    const h = String(hashHex || "");
    stream.textContent = 'sha256("' + tail + '") → ' + h.slice(0, 12) + "…";
}

function solveConnectChallenge(challenge) {
    const need = "0".repeat(challenge.difficulty);
    const prefix = challenge.prefix;
    let nonce = 0;
    setConnectVerifyText("ПК обменивается данными с сервером…");

    return new Promise((resolve) => {
        function step() {
            const t0 = performance.now();
            while (performance.now() - t0 < 14) {
                const input = prefix + nonce;
                const hash = sha256HexConnectSync(input);
                if (hash.startsWith(need)) {
                    updateConnectTransferStream(input, hash);
                    resolve(`${challenge.challengeId}:${nonce}`);
                    return;
                }
                nonce++;
                if (nonce % 1500 === 0) {
                    setConnectVerifyText("Проверка безопасности…");
                    updateConnectTransferStream(input, hash);
                }
            }
            requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    });
}

export async function fetchConnectToken(gameHost, servers = {}) {
    const apiBase = getGameServerApiBase(gameHost, servers);

    if (serverPowSupportCache.get(apiBase) === false) {
        return null;
    }

    setConnectVerifyText(
        serverPowSupportCache.get(apiBase) === true ? "Запрос проверки…" : "Проверка сервера…"
    );

    let res;
    try {
        res = await fetch(apiBase + "/challenge", { cache: "no-store" });
    } catch (err) {
        serverPowSupportCache.set(apiBase, false);
        return null;
    }

    if (!res.ok) {
        serverPowSupportCache.set(apiBase, false);
        return null;
    }

    let challenge;
    try {
        challenge = await res.json();
    } catch (err) {
        serverPowSupportCache.set(apiBase, false);
        return null;
    }

    if (!challenge || !challenge.challengeId || challenge.prefix == null || challenge.difficulty == null) {
        serverPowSupportCache.set(apiBase, false);
        return null;
    }

    serverPowSupportCache.set(apiBase, true);
    setConnectVerifyText("Проверка безопасности…");
    const token = await solveConnectChallenge(challenge);
    setConnectVerifyText("Подключение к серверу…");
    return token;
}
