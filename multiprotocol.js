/**
 * Agar.su multi-protocol adapters (browser).
 *
 * - Native agar.su: trusted marker (main.js default path)
 * - Bubble.am: classic Ogar protocol 5
 * - Agar.live Bomb: UI pop*.agar.live → bridge xn--bdk.pw:6015 (agar.su wire pass-through)
 * - AgarZ: direct wss://ws.agarz.com — binary translated ↔ agar.su
 * - Delta: direct wss://*.delt.io — XOR crypto + modern agar ↔ agar.su
 *
 * Security:
 * - nick#pass → only public nick to foreign servers
 * - never send agar.su LK / accountToken / connectToken to AgarZ / Delta
 */
(function (global) {
  "use strict";

  // ═══════════════════════════════════════════════════════════════
  // Minimal Buffer shim (Node API subset for MultiProtocol)
  // ═══════════════════════════════════════════════════════════════
  function _u8(view) {
    if (view instanceof Uint8Array) return view;
    if (view instanceof ArrayBuffer) return new Uint8Array(view);
    if (view && view.buffer instanceof ArrayBuffer)
      return new Uint8Array(view.buffer, view.byteOffset || 0, view.byteLength != null ? view.byteLength : view.length);
    return new Uint8Array(0);
  }

  function BufferFrom(input, encOrOffset, length) {
    if (input == null) return new Buf(0);
    if (typeof input === "number") return BufferAlloc(input);
    if (typeof input === "string") {
      if (encOrOffset === "hex") {
        var hex = input.replace(/[^0-9a-fA-F]/g, "");
        if (hex.length % 2) hex = "0" + hex;
        var hb = new Uint8Array(hex.length / 2);
        for (var hi = 0; hi < hb.length; hi++) hb[hi] = parseInt(hex.substr(hi * 2, 2), 16);
        return wrapU8(hb);
      }
      var enc = new TextEncoder().encode(String(input));
      return wrapU8(enc);
    }
    if (Array.isArray(input) || input instanceof Uint8Array || ArrayBuffer.isView(input)) {
      return wrapU8(new Uint8Array(input));
    }
    if (input instanceof ArrayBuffer) return wrapU8(new Uint8Array(input));
    if (Buffer.isBuffer(input)) return wrapU8(new Uint8Array(input));
    return wrapU8(new Uint8Array(0));
  }

  function BufferAlloc(n) {
    return wrapU8(new Uint8Array(n | 0));
  }

  function BufferAllocUnsafe(n) {
    return BufferAlloc(n);
  }

  function BufferConcat(list, totalLen) {
    var parts = list || [];
    var len = 0;
    if (typeof totalLen === "number") len = totalLen;
    else for (var i = 0; i < parts.length; i++) len += parts[i].length;
    var out = new Uint8Array(len);
    var o = 0;
    for (var j = 0; j < parts.length; j++) {
      var p = _u8(parts[j]);
      out.set(p, o);
      o += p.length;
      if (o >= len) break;
    }
    return wrapU8(out.subarray(0, len));
  }

  function wrapU8(u8) {
    var b = u8;
    if (!(b instanceof Uint8Array)) b = new Uint8Array(b);
    // Attach Buffer methods onto the Uint8Array instance
    Object.setPrototypeOf(b, Buf.prototype);
    return b;
  }

  function Buf(n) {
    var u = new Uint8Array(n | 0);
    Object.setPrototypeOf(u, Buf.prototype);
    return u;
  }
  Buf.prototype = Object.create(Uint8Array.prototype);
  Buf.prototype.constructor = Buf;

  Buf.prototype.slice = function (start, end) {
    var s = start | 0;
    var e = end == null ? this.length : end | 0;
    return wrapU8(Uint8Array.prototype.slice.call(this, s, e));
  };
  Buf.prototype.subarray = function (start, end) {
    return wrapU8(Uint8Array.prototype.subarray.call(this, start, end));
  };
  Buf.prototype.copy = function (target, targetStart, sourceStart, sourceEnd) {
    var ts = targetStart | 0;
    var ss = sourceStart | 0;
    var se = sourceEnd == null ? this.length : sourceEnd | 0;
    var n = Math.min(se - ss, target.length - ts);
    for (var i = 0; i < n; i++) target[ts + i] = this[ss + i];
    return n;
  };
  Buf.prototype.toString = function (enc) {
    if (enc === "hex") {
      var hex = "";
      for (var i = 0; i < this.length; i++) hex += (this[i] + 256).toString(16).slice(1);
      return hex;
    }
    return new TextDecoder().decode(this);
  };
  Buf.prototype.writeUInt8 = function (v, o) {
    this[o] = v & 255;
    return o + 1;
  };
  Buf.prototype.writeUInt16LE = function (v, o) {
    this[o] = v & 255;
    this[o + 1] = (v >>> 8) & 255;
    return o + 2;
  };
  Buf.prototype.writeUInt32LE = function (v, o) {
    this[o] = v & 255;
    this[o + 1] = (v >>> 8) & 255;
    this[o + 2] = (v >>> 16) & 255;
    this[o + 3] = (v >>> 24) & 255;
    return o + 4;
  };
  Buf.prototype.writeInt32LE = function (v, o) {
    return this.writeUInt32LE(v | 0, o);
  };
  Buf.prototype.writeFloatLE = function (v, o) {
    new DataView(this.buffer, this.byteOffset + o, 4).setFloat32(0, Number(v) || 0, true);
    return o + 4;
  };
  Buf.prototype.writeDoubleLE = function (v, o) {
    new DataView(this.buffer, this.byteOffset + o, 8).setFloat64(0, Number(v) || 0, true);
    return o + 8;
  };
  Buf.prototype.writeBigUInt64LE = function (v, o) {
    var n = typeof v === "bigint" ? v : BigInt(v || 0);
    var lo = Number(n & 0xffffffffn);
    var hi = Number((n >> 32n) & 0xffffffffn);
    this.writeUInt32LE(lo >>> 0, o);
    this.writeUInt32LE(hi >>> 0, o + 4);
    return o + 8;
  };
  Buf.prototype.readUInt8 = function (o) {
    return this[o];
  };
  Buf.prototype.readUInt16LE = function (o) {
    return this[o] | (this[o + 1] << 8);
  };
  Buf.prototype.readInt16LE = function (o) {
    var v = this.readUInt16LE(o);
    return v & 0x8000 ? v - 0x10000 : v;
  };
  Buf.prototype.readUInt32LE = function (o) {
    return (
      (this[o] | (this[o + 1] << 8) | (this[o + 2] << 16) | (this[o + 3] << 24)) >>> 0
    );
  };
  Buf.prototype.readInt32LE = function (o) {
    return this.readUInt32LE(o) | 0;
  };
  Buf.prototype.readDoubleLE = function (o) {
    return new DataView(this.buffer, this.byteOffset + o, 8).getFloat64(0, true);
  };
  Buf.prototype.readBigUInt64LE = function (o) {
    var lo = BigInt(this.readUInt32LE(o));
    var hi = BigInt(this.readUInt32LE(o + 4));
    return (hi << 32n) | lo;
  };

  var Buffer = {
    from: BufferFrom,
    alloc: BufferAlloc,
    allocUnsafe: BufferAllocUnsafe,
    concat: BufferConcat,
    isBuffer: function (b) {
      return b instanceof Uint8Array && typeof b.readUInt32LE === "function";
    },
  };

  function toDataView(buf) {
    if (!buf) return new DataView(new ArrayBuffer(0));
    if (buf instanceof DataView) return buf;
    if (buf instanceof ArrayBuffer) return new DataView(buf);
    var u = _u8(buf);
    return new DataView(u.buffer, u.byteOffset, u.byteLength);
  }

  function toSendBytes(buf) {
    return _u8(buf);
  }

  // ═══════════════════════════════════════════════════════════════
  // Sync SHA-256 (utf8 string → hex) for AgarZ SYNC_ASSETS PoW
  // ═══════════════════════════════════════════════════════════════
  function sha256Hex(str) {
    function rotr(n, x) {
      return (x >>> n) | (x << (32 - n));
    }
    function utf8Bytes(s) {
      return Array.from(new TextEncoder().encode(String(s)));
    }
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var bytes = utf8Bytes(str);
    var l = bytes.length;
    var bitLen = l * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (var i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);
    for (var chunk = 0; chunk < bytes.length; chunk += 64) {
      var w = new Array(64);
      for (var j = 0; j < 16; j++) {
        var o = chunk + j * 4;
        w[j] = ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
      }
      for (var j2 = 16; j2 < 64; j2++) {
        var s0 = rotr(7, w[j2 - 15]) ^ rotr(18, w[j2 - 15]) ^ (w[j2 - 15] >>> 3);
        var s1 = rotr(17, w[j2 - 2]) ^ rotr(19, w[j2 - 2]) ^ (w[j2 - 2] >>> 10);
        w[j2] = (w[j2 - 16] + s0 + w[j2 - 7] + s1) >>> 0;
      }
      var a = H[0],
        b = H[1],
        c = H[2],
        d = H[3],
        e = H[4],
        f = H[5],
        g = H[6],
        h = H[7];
      for (var j3 = 0; j3 < 64; j3++) {
        var S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[j3] + w[j3]) >>> 0;
        var S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + h) >>> 0;
    }
    var hex = "";
    for (var hi = 0; hi < 8; hi++) {
      var v = H[hi] >>> 0;
      hex += ("00000000" + v.toString(16)).slice(-8);
    }
    return hex;
  }



  // ═══════════════════════════════════════════════════════════════
  // AgarZ wire opcodes / builders / PoW
  // ═══════════════════════════════════════════════════════════════
  var AGARZ_C2S = {
    SPECTATE_REQUEST: 0x01,
    SET_SKIN: 0x02,
    SET_TOKEN: 0x03,
    SCOPE_AROUND_ENABLE: 0x05,
    SCOPE_AROUND_DISABLE: 0x06,
    SET_NAME: 0x07,
    PLAY_AS_GUEST_REQUEST: 0x08,
    SPAWN_PLAYER: 0x09,
    PING: 0x0d,
    MOUSE_MOVE: 0x10,
    SPLIT: 0x11,
    EMITFOOD_ONCE: 0x15,
    EMITFOOD_START: 0x16,
    EMITFOOD_STOP: 0x17,
    SET_LANG: 0x19,
    SET_TEAM: 0x1a,
    SET_SPECTATOR: 0x32,
    SOUND: 0x35,
    PINGLOG: 0x46,
    ASSET_VERIFIED: 0x47,
    SEND_CHAT: 0x63,
    BEGIN: 0xff,
  };

  var AGARZ_S2C = {
    UPDATE_LEADERBOARD: 0x31,
    UPDATE_LEADERBOARD_EXT: 0x33,
    BOARD_SIZE: 0x40,
    ADD_CHAT: 0x5b,
    ADD_CHAT_ADMIN: 0x74,
    UPDATE_NODES2: 0x64,
    UPDATE_NODES2_EXT: 0x65,
    SPECTATE_ID: 0x67,
    PLAYER_ID: 0x68,
    IPSAFE_FAIL: 0x69,
    READY_TO_START: 0x6d,
    SERVER_VERSION: 0x6e,
    INFO: 0x6f,
    VALUE_UINT32: 0x71,
    CONSOLE_LOG: 0x78,
    SHOW_MESSAGE: 0x7a,
    SYNC_ASSETS: 0x7e,
  };

  var AGARZ_INFO = {
    SHOW_MAINMENU: 0x0,
    READY_TO_PLAY_OR_SPECTATE: 0x1,
    TOKEN_IS_INCORRECT: 0x3,
    LOGIN_COMPLETED: 0x4,
    YOU_DEAD: 0x10,
    PLAY_BEGIN: 0x12,
  };

  var AGARZ_CLIENT_VERSION = 0x2710;

  function agarzWriteUtf16(buf, offset, str) {
    var s = String(str || "");
    for (var i = 0; i < s.length; i++) buf.writeUInt16LE(s.charCodeAt(i), offset + 2 * i);
    return offset + 2 * s.length;
  }

  function agarzReadUtf16(buf, pos) {
    var s = "";
    var p = pos;
    while (p + 1 < buf.length) {
      var c = buf.readUInt16LE(p);
      p += 2;
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return { s: s, p: p };
  }

  function agarzBuildSetName(name) {
    var s = String(name || "guest").slice(0, 15);
    var buf = Buffer.allocUnsafe(1 + 2 * s.length);
    buf[0] = AGARZ_C2S.SET_NAME;
    agarzWriteUtf16(buf, 1, s);
    return buf;
  }

  function agarzBuildSetSkin(skin) {
    var s = String(skin || "");
    var buf = Buffer.allocUnsafe(1 + 2 * s.length);
    buf[0] = AGARZ_C2S.SET_SKIN;
    agarzWriteUtf16(buf, 1, s);
    return buf;
  }

  function agarzBuildSetLang(langCode) {
    var map = { tr: 1, en: 2, es: 3, de: 4, ru: 2, fr: 5 };
    var code = typeof langCode === "number" ? langCode : map[String(langCode || "en").toLowerCase()] || 2;
    var buf = Buffer.allocUnsafe(2);
    buf[0] = AGARZ_C2S.SET_LANG;
    buf[1] = code & 255;
    return buf;
  }

  function agarzBuildPing(elapsedMs) {
    var buf = Buffer.allocUnsafe(5);
    buf[0] = AGARZ_C2S.PING;
    buf.writeInt32LE((elapsedMs | 0) || 0, 1);
    return buf;
  }

  function agarzBuildMouse(x, y) {
    var buf = Buffer.allocUnsafe(21);
    buf[0] = AGARZ_C2S.MOUSE_MOVE;
    buf.writeDoubleLE(Number(x) || 0, 1);
    buf.writeDoubleLE(Number(y) || 0, 9);
    buf.writeUInt32LE(0, 17);
    return buf;
  }

  function agarzBuildOp(op) {
    return Buffer.from([op & 255]);
  }

  function agarzBuildBegin(version) {
    var buf = Buffer.allocUnsafe(5);
    buf[0] = AGARZ_C2S.BEGIN;
    buf.writeInt32LE((version == null ? AGARZ_CLIENT_VERSION : version) | 0, 1);
    return buf;
  }

  function agarzBuildSound(on) {
    var buf = Buffer.allocUnsafe(2);
    buf[0] = AGARZ_C2S.SOUND;
    buf[1] = on ? 1 : 0;
    return buf;
  }

  function agarzBuildAssetVerified(n) {
    var buf = Buffer.allocUnsafe(9);
    buf[0] = AGARZ_C2S.ASSET_VERIFIED;
    buf.writeBigUInt64LE(BigInt(n || 0), 1);
    return buf;
  }

  function agarzBuildPingLog(rttMs) {
    var buf = Buffer.allocUnsafe(5);
    buf[0] = AGARZ_C2S.PINGLOG;
    buf.writeInt32LE((rttMs | 0) || 0, 1);
    return buf;
  }

  function agarzBuildSetTeam(team) {
    var s = String(team || "");
    var buf = Buffer.allocUnsafe(1 + 2 * s.length);
    buf[0] = AGARZ_C2S.SET_TEAM;
    agarzWriteUtf16(buf, 1, s);
    return buf;
  }

  function agarzBuildSetSpectator(playerId) {
    var buf = Buffer.allocUnsafe(5);
    buf[0] = AGARZ_C2S.SET_SPECTATOR;
    buf.writeUInt32LE((playerId >>> 0) || 0, 1);
    return buf;
  }

  function agarzSolveAssetPow(challenge, difficulty) {
    var zeros = Math.floor((difficulty | 0) / 5);
    var prefix = "";
    for (var z = 0; z < zeros; z++) prefix += "0";
    var challengeStr = typeof challenge === "bigint" ? challenge.toString() : String(challenge);
    var n = 0;
    for (;;) {
      var hash = sha256Hex(challengeStr + n);
      if (hash.indexOf(prefix) === 0) return n;
      n++;
      if (n > 8000000) throw new Error("asset PoW too hard");
    }
  }

  function agarzReplySyncAssets(buf) {
    if (!buf || buf[0] !== AGARZ_S2C.SYNC_ASSETS || buf.length < 10) return null;
    var difficulty = buf[1];
    var challenge = buf.readBigUInt64LE(2);
    var n = agarzSolveAssetPow(challenge, difficulty);
    return agarzBuildAssetVerified(n);
  }

  // Fake proto module API for MultiProtocol (matches Node require('./protocol'))
  var proto = {
    C2S: AGARZ_C2S,
    S2C: AGARZ_S2C,
    INFO: AGARZ_INFO,
    CLIENT_VERSION: AGARZ_CLIENT_VERSION,
    buildSetName: agarzBuildSetName,
    buildSetSkin: agarzBuildSetSkin,
    buildSetLang: agarzBuildSetLang,
    buildPing: agarzBuildPing,
    buildMouse: agarzBuildMouse,
    buildOp: agarzBuildOp,
    buildBegin: agarzBuildBegin,
    buildSound: agarzBuildSound,
    buildSetTeam: agarzBuildSetTeam,
    buildSetSpectator: agarzBuildSetSpectator,
    buildAssetVerified: agarzBuildAssetVerified,
    buildPingLog: agarzBuildPingLog,
    solveAssetPow: agarzSolveAssetPow,
    replySyncAssets: agarzReplySyncAssets,
    readUtf16: agarzReadUtf16,
    writeUtf16: agarzWriteUtf16,
  };



  // ═══════════════════════════════════════════════════════════════
  // Chat bridge agar.su ↔ AgarZ
  // ═══════════════════════════════════════════════════════════════
  var AGAR_CHAT_OP = 99;
  var AGARZ_LANG_TAG_RE = /\s+:[a-z]{2}$/i;

  function chatReadUtf16Fixed(buf, pos) {
    var s = "";
    var p = pos;
    while (p + 1 < buf.length) {
      var c = buf.readUInt16LE(p);
      p += 2;
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return { s: s, p: p };
  }

  function chatReadUtf16Rest(buf, pos) {
    var s = "";
    var p = pos;
    while (p + 1 < buf.length) {
      s += String.fromCharCode(buf.readUInt16LE(p));
      p += 2;
    }
    return s;
  }

  function chatStripLangTag(text) {
    return String(text || "")
      .trim()
      .replace(AGARZ_LANG_TAG_RE, "")
      .trim();
  }

  function chatRebrand(text) {
    return String(text || "").replace(/agarz/gi, function (m) {
      if (m === "AGARZ") return "AGARSU";
      if (m[0] === "A") return "AgarSu";
      return "agarsu";
    });
  }

  function chatIsJoinLine(text) {
    var body = chatStripLangTag(text);
    return /в[oо]ш[её]л\s+в\s+игру/i.test(body) || /^\*\*\*playerenter\*\*\*/i.test(body);
  }

  function chatWriteUtf16Z(str) {
    var s = String(str || "");
    var b = Buffer.allocUnsafe(2 * (s.length + 1));
    for (var i = 0; i < s.length; i++) b.writeUInt16LE(s.charCodeAt(i), i * 2);
    b.writeUInt16LE(0, s.length * 2);
    return b;
  }

  function chatBuildAgarPacket(rgb, uid, name, message) {
    var r = (rgb && rgb.r) || 200;
    var g = (rgb && rgb.g) || 200;
    var b = (rgb && rgb.b) || 200;
    var nick = String(name || "player").slice(0, 24);
    var text = String(message || "").slice(0, 200);
    if (!text) return null;
    var parts = [];
    parts.push(Buffer.from([AGAR_CHAT_OP, 0, r & 255, g & 255, b & 255]));
    parts.push(Buffer.alloc(4));
    var pid = Buffer.allocUnsafe(2);
    pid.writeUInt16LE((uid >>> 0) & 0xffff, 0);
    parts.push(pid);
    parts.push(chatWriteUtf16Z(nick));
    parts.push(chatWriteUtf16Z(text));
    return Buffer.concat(parts);
  }

  function chatAgarToAgarz(buf) {
    if (!buf || buf.length < 2 || buf[0] !== AGAR_CHAT_OP) return [];
    var rawText = "";
    if (buf[1] === 0) rawText = chatReadUtf16Rest(buf, 2);
    else {
      var p = 1;
      var flags = buf[p++];
      if (flags & 2) p += 4;
      if (flags & 4) p += 8;
      if (flags & 8) p += 16;
      rawText = chatReadUtf16Fixed(buf, p).s || "";
    }
    var text = chatStripLangTag(rawText);
    if (!text) return [];
    if (chatIsJoinLine(text)) return [];
    return null; // disabled — local notice
  }

  function chatAgarzToAgar(buf) {
    if (!buf || buf.length < 8) return [];
    var op = buf[0];
    var p = 1;
    var r = buf[p++];
    var g = buf[p++];
    var b = buf[p++];
    if (p + 4 > buf.length) return [];
    var uid = buf.readUInt32LE(p) >>> 0;
    p += 4;
    if (op === 0x74) {
      if (p + 4 > buf.length) return [];
      p += 4;
    }
    var name = chatReadUtf16Fixed(buf, p);
    p = name.p;
    var msg = chatReadUtf16Fixed(buf, p);
    var nick = chatRebrand(String(name.s || "player").slice(0, 24));
    var text = chatRebrand(chatStripLangTag(msg.s || ""));
    if (!text) return [];
    if (/sohbete\s+kat/i.test(text) || /kay[ıi1]t\s+olmal/i.test(text) || /register.*(chat|to\s+chat)/i.test(text)) {
      return [
        chatSystem(
          "Тут пока нельзя писать в чат. Но можете менять ники — вас так поймут =)",
          { r: 255, g: 180, b: 70 }
        ),
      ];
    }
    var pkt = chatBuildAgarPacket({ r: r, g: g, b: b }, uid, nick || "player", text);
    return pkt ? [pkt] : [];
  }

  function chatSystem(message, color) {
    var pkt = chatBuildAgarPacket(color || { r: 160, g: 160, b: 160 }, 0, "console", chatRebrand(message));
    return pkt || Buffer.alloc(0);
  }

  var chatBridge = {
    agarChatToAgarz: chatAgarToAgarz,
    agarzChatToAgar: chatAgarzToAgar,
    systemChat: chatSystem,
    rebrand: chatRebrand,
    stripLangTag: chatStripLangTag,
  };



  // ═══════════════════════════════════════════════════════════════
  // MultiProtocol — AgarZ ↔ agar.su translator
  // ═══════════════════════════════════════════════════════════════

const AGAR = {
  PING: 2,
  UPDATE_NODES: 16,
  CAMERA: 17,
  CLEAR: 20,
  LB: 49,
  BORDER: 64,
  CHAT: 99,
};

const CELL = {
  PLAYER: 0,
  FOOD: 1,
  VIRUS: 2,
  EJECTED: 3,
  GOLD: 4,
  RED_VIRUS: 5,
};

class Writer {
  constructor() {
    this.parts = [];
  }
  raw(b) {
    this.parts.push(Buffer.isBuffer(b) ? b : Buffer.from(b));
    return this;
  }
  u8(v) {
    this.parts.push(Buffer.from([v & 255]));
    return this;
  }
  u16(v) {
    const b = Buffer.allocUnsafe(2);
    b.writeUInt16LE(v >>> 0, 0);
    return this.raw(b);
  }
  u32(v) {
    const b = Buffer.allocUnsafe(4);
    b.writeUInt32LE(v >>> 0, 0);
    return this.raw(b);
  }
  i32(v) {
    const b = Buffer.allocUnsafe(4);
    b.writeInt32LE(v | 0, 0);
    return this.raw(b);
  }
  f32(v) {
    const b = Buffer.allocUnsafe(4);
    b.writeFloatLE(Number(v) || 0, 0);
    return this.raw(b);
  }
  f64(v) {
    const b = Buffer.allocUnsafe(8);
    b.writeDoubleLE(Number(v) || 0, 0);
    return this.raw(b);
  }
  utf8(s) {
    return this.raw(Buffer.concat([Buffer.from(String(s || ''), 'utf8'), Buffer.from([0])]));
  }
  utf16(s) {
    const t = String(s || '');
    const b = Buffer.allocUnsafe(2 * t.length + 2);
    for (let i = 0; i < t.length; i++) b.writeUInt16LE(t.charCodeAt(i), i * 2);
    b.writeUInt16LE(0, t.length * 2);
    return this.raw(b);
  }
  out() {
    return Buffer.concat(this.parts);
  }
}

function resolveTarget(roomKey) {
  const key = String(roomKey || config.DEFAULT_TARGET).toLowerCase();
  if (config.TARGETS[key]) return { key, url: config.TARGETS[key] };
  if (/^wss?:\/\//i.test(key)) return { key: 'custom', url: key };
  if (/^\d+$/.test(key)) return { key, url: 'wss://ws.agarz.com:' + key };
  return { key: config.DEFAULT_TARGET, url: config.TARGETS[config.DEFAULT_TARGET] };
}

class MultiProtocol {
  constructor() {
    this.mode = 'auto';
    this.pid = 0;
    this.border = { minx: 0, miny: 0, maxx: 30000, maxy: 30000 };
    this.sentBorder = false;
    this.gotOwnCell = false;
    this.agarHandshake = false;
    this.spectateZoom = true;
    this.names = new Map();
    this._pendingNick = '';
    this._lastCell = new Map();
    this.known = new Set();
    this._ready = false;
    this._spawned = false;
    this._lastCamAt = 0;
    this._noticeOnce = false;
    this._spectateArmed = false;
    this._lastMouse = null;
    this._borderFromServer = false;
    this.spectateTargetId = 0;
    this._ownCellIds = new Set();
    this._borderClientSent = false;
    this._ownMissingTicks = 0;
    this._lastOwnPos = null;
    this._lastBorderEmitAt = 0;
    this._lastLiveOwnAt = 0;
    this._hintPid = 0;
    this._ownerBorderOk = false;
    this._ownerLocked = false;
    /** agar.su camera owner — must match playerId on first create of each cell */
    this._clientOwnerPid = 0;
    this._holdWorldUntilOwner = false;
    this._ejectHolding = false;
    this._ejectStopTimer = null;
    this._ownCellServerAt = new Map();
  }

  markAgar() {
    this.mode = 'agar';
  }

  isAgar() {
    return this.mode === 'agar';
  }

  /**
   * agar.su camera follows cells where playerId === border.ownerPlayerId.
   * NEVER return placeholder while we have a real pid — that makes camera lose the player.
   */
  ownerPid() {
    if (this._clientOwnerPid > 0) return this._clientOwnerPid >>> 0;
    if (this.pid > 0) return this.pid >>> 0;
    if (this._spectateArmed) return PID_PLACEHOLDER;
    return PID_PLACEHOLDER;
  }

  /**
   * agar.su only marks isOwn when a node is FIRST created with
   * playerId === ownerPlayerId. Wrong order = camera never follows.
   * Always CLEAR + border when owner identity changes.
   */
  _adoptOwner(pid, why) {
    pid = pid >>> 0;
    if (!pid || pid === PID_PLACEHOLDER) return null;

    const prevClient = this._clientOwnerPid >>> 0;
    const identityChanged = !prevClient || prevClient !== pid;

    this.pid = pid;
    this._hintPid = pid;
    this._clientOwnerPid = pid;
    this._holdWorldUntilOwner = false;

    if (why !== 'PLAYER_ID') {
      this.gotOwnCell = true;
      this.spectateZoom = false;
      this._spectateArmed = false;
    }
    this._ownMissingTicks = 0;
    if (this._pendingNick) this.names.set(pid, this._pendingNick);

    // Same owner already bound — no CLEAR/border spam (that resets camera)
    if (!identityChanged && this._ownerBorderOk) return null;

    this._ownerBorderOk = true;
    this.sentBorder = true;
    this._borderClientSent = true;
    this._lastBorderEmitAt = Date.now();
    console.log('[proto] ownerPid=%d (%s) changed=%s', pid, why, identityChanged);

    const out = [];
    // Only CLEAR on owner *change* (auto-respawn). First spawn: holdWorld prevented foreign cells.
    if (identityChanged && prevClient) {
      this._wipeTrackedCells();
      out.push(Buffer.from([AGAR.CLEAR]));
    }
    out.push(this._buildBorder());
    return out;
  }

  /** Drop bridge cell cache so client CLEAR is not followed by re-inject phantoms. */
  _wipeTrackedCells() {
    this._lastCell.clear();
    this.known.clear();
    if (this._ownCellIds) this._ownCellIds.clear();
    if (this._ownCellServerAt) this._ownCellServerAt.clear();
  }

  _nickMatch(flags16) {
    const want = String(this._pendingNick || '')
      .trim()
      .toLowerCase();
    if (!want) return false;
    const n1 = String(this.names.get(flags16) || '')
      .trim()
      .toLowerCase();
    const n2 = String(this.names.get(flags16 & 0xffff) || '')
      .trim()
      .toLowerCase();
    return n1 === want || n2 === want;
  }

  onAgarHandshake() {
    this.agarHandshake = true;
    this.markAgar();
    const out = [];
    if (!this.sentBorder) {
      this.sentBorder = true;
      out.push(this._buildBorder());
    }
    if (!this._noticeOnce) {
      this._noticeOnce = true;
      out.push(chatBridge.systemChat('AgarZ bridge connected', { r: 80, g: 220, b: 120 }));
    }
    return out;
  }

  agarPong() {
    return Buffer.from([AGAR.PING]);
  }

  systemNotice(message, kind) {
    const colors = {
      info: { r: 160, g: 160, b: 160 },
      ok: { r: 80, g: 220, b: 120 },
      warn: { r: 255, g: 190, b: 70 },
      error: { r: 255, g: 90, b: 90 },
    };
    return chatBridge.systemChat(message, colors[kind] || colors.info);
  }

  /** agar.su → AgarZ */
  agarToAgarz(buf, bot) {
    if (!buf || !buf.length) return [];
    const op = buf[0];
    if (op === 254 || op === 255 || op === 253 || op === 114) return [];
    if (op === 2) return [];
    if (op === 0) return this._agarNick(buf, bot);
    if (op === 1) return this._agarSpectate(bot, buf);
    if (op === 16) return this._agarMouse(buf, bot);
    if (op === 17) return [proto.buildOp(proto.C2S.SPLIT)];
    // W/eject: agar.su spams 21 @100ms while held; AgarZ wants START/STOP (or ONCE tap)
    if (op === 21) return this._agarEject(bot);
    if (op === 18) return [proto.buildOp(proto.C2S.EMITFOOD_ONCE)]; // Q tap
    if (op === 22) return [proto.buildOp(proto.C2S.EMITFOOD_START)]; // macro E
    if (op === 19 || op === 23) return [proto.buildOp(proto.C2S.EMITFOOD_STOP)];
    if (op === 99) return this._agarChat(buf, bot);
    return [];
  }

  /**
   * Convert agar.su hold-W (repeated 21) into AgarZ EMITFOOD_START/STOP.
   * Spamming ONCE is rate-limited by AgarZ → "W идёт очень долго".
   */
  _agarEject(bot) {
    const self = this;
    if (!this._ejectHolding) {
      this._ejectHolding = true;
      if (this._ejectStopTimer) {
        clearTimeout(this._ejectStopTimer);
        this._ejectStopTimer = null;
      }
      this._ejectStopTimer = setTimeout(() => {
        self._ejectHolding = false;
        self._ejectStopTimer = null;
        if (bot && typeof bot._sendGame === 'function') {
          bot._sendGame(proto.buildOp(proto.C2S.EMITFOOD_STOP));
        }
      }, 180);
      return [proto.buildOp(proto.C2S.EMITFOOD_START)];
    }
    // Already holding — refresh stop timer, don't spam START/ONCE
    if (this._ejectStopTimer) clearTimeout(this._ejectStopTimer);
    this._ejectStopTimer = setTimeout(() => {
      self._ejectHolding = false;
      self._ejectStopTimer = null;
      if (bot && typeof bot._sendGame === 'function') {
        bot._sendGame(proto.buildOp(proto.C2S.EMITFOOD_STOP));
      }
    }, 180);
    return [];
  }

  /**
   * agar.su mouse is already [16][f64 x][f64 y][u32] — same as AgarZ 0x10.
   */
  _agarMouse(buf, bot) {
    let packet = null;
    if (buf.length >= 21) {
      packet = Buffer.from(buf.slice(0, 21));
      packet[0] = proto.C2S.MOUSE_MOVE;
    } else if (buf.length >= 13) {
      packet = proto.buildMouse(buf.readInt32LE(1), buf.readInt32LE(5));
    }
    if (!packet) return [];

    const spectating =
      bot && (bot._mode === 'spectate' || bot._mode === 'connect' || bot._wantSpectate || this._spectateArmed);

    // Spectate/connect: clamp to map for server overview; client camera may still fly outside
    if (spectating) {
      packet = this._clampMouseForServer(packet) || packet;
    }

    if (bot) bot._lastMouse = packet;
    this._lastMouse = packet;
    this._lastMouseAt = Date.now();

    if (bot && bot._mode === 'play') {
      if (!this._ownerLocked) return [];
      return [packet];
    }
    if (spectating) return [packet];
    return [];
  }

  /**
   * Spectate click (agar.su op 1):
   *  - [1]          free overview (click empty) — mouse + SCOPE, camera follows cursor
   *  - [1][u32 pid] lock AgarZ overview on that player (SET_SPECTATOR), like agarz.com
   * Client also follows by nick locally so camera sticks after death/respawn.
   */
  _agarSpectate(bot, buf) {
    if (bot && (bot._mode === 'play' || bot._wantPlay)) return [];
    if (this._ownerLocked || (this._ownCellIds && this._ownCellIds.size)) return [];

    let targetPid = 0;
    if (buf && buf.length >= 5) {
      targetPid = buf.readUInt32LE(1) >>> 0;
    }

    this.spectateZoom = true;
    this.gotOwnCell = false;
    this._pendingNick = '';
    this.spectateTargetId = targetPid;
    if (bot) {
      bot._mode = 'spectate';
      bot._wantPlay = false;
      bot._wantSpectate = true;
      bot._spectateArmed = true;
    }
    this._spectateArmed = true;

    const out = [];
    const mouse = this._clampMouseForServer((bot && bot._lastMouse) || this._lastMouse);
    if (mouse) {
      if (bot) bot._lastMouse = mouse;
      this._lastMouse = mouse;
      out.push(mouse);
    }
    out.push(proto.buildOp(proto.C2S.SCOPE_AROUND_ENABLE));

    if (targetPid) {
      // AgarZ: bind overview to player (same as tryClickChangeSpectator)
      out.push(proto.buildSetSpectator(targetPid));
    } else if (bot && !bot._spectateSent) {
      bot._spectateSent = true;
      out.push(proto.buildOp(proto.C2S.SPECTATE_REQUEST));
    } else if (!bot) {
      out.push(proto.buildOp(proto.C2S.SPECTATE_REQUEST));
    }

    out.push(Buffer.from([AGAR.CAMERA]));
    return out;
  }

  /** Clamp mouse to map so AgarZ still streams edge overview when camera flies off-map. */
  _clampMouseForServer(packet) {
    if (!packet || packet.length < 21) return null;
    const b = this.border || { minx: 0, miny: 0, maxx: 30000, maxy: 30000 };
    let x = packet.readDoubleLE(1);
    let y = packet.readDoubleLE(9);
    const pad = 100;
    const minx = b.minx + pad;
    const miny = b.miny + pad;
    const maxx = b.maxx - pad;
    const maxy = b.maxy - pad;
    const cx = Math.max(minx, Math.min(maxx, x));
    const cy = Math.max(miny, Math.min(maxy, y));
    if (cx === x && cy === y && packet[0] === proto.C2S.MOUSE_MOVE) {
      return Buffer.from(packet.slice(0, 21));
    }
    return proto.buildMouse(cx, cy);
  }

  _agarNick(buf, bot) {
    // agar.su: [0][color u8][utf16 nick#pass…] — foreign: public nick only
    let text = '';
    for (let p = 2; p + 1 < buf.length; p += 2) {
      const c = buf.readUInt16LE(p);
      if (!c) break;
      text += String.fromCharCode(c);
    }
    let wire = String(text.split(':::::')[0] || '').trim();
    if (wire.indexOf('\n') >= 0) wire = wire.slice(wire.indexOf('\n') + 1);
    if (wire.charCodeAt(0) === 4) wire = wire.slice(1);
    const hash = wire.indexOf('#');
    if (hash >= 0) wire = wire.slice(0, hash);
    const nick = wire.trim().slice(0, 15) || 'Player Agarsu';
    this._pendingNick = nick;
    this._spawnNick = nick;
    this.spectateZoom = false;
    this._spectateArmed = false;
    this.spectateTargetId = 0;
    if (bot) {
      bot._agarzNick = nick;
      bot._displayNick = nick;
      bot._authOk = true;
    }
    this._spawned = false;
    return [];
  }

  _agarChat(buf, bot) {
    const out = chatBridge.agarChatToAgarz(buf, bot, this);
    // null = chat disabled locally (don't hit AgarZ)
    if (out === null) {
      return [
        chatBridge.systemChat(
          'Тут пока нельзя писать в чат. Но можете менять ники — вас так поймут =)',
          { r: 255, g: 180, b: 70 }
        ),
      ];
    }
    return out || [];
  }

  /** AgarZ → agar.su */
  agarzToAgar(buf) {
    if (!buf || !buf.length) return [];
    const op = buf[0];
    try {
      switch (op) {
        case proto.S2C.BOARD_SIZE:
          return this._border(buf);
        case proto.S2C.UPDATE_NODES2:
          return this._nodes2(buf);
        case proto.S2C.UPDATE_NODES2_EXT:
          return this._nodesExt(buf);
        case proto.S2C.UPDATE_LEADERBOARD:
          return this._lb(buf);
        case proto.S2C.UPDATE_LEADERBOARD_EXT:
          // EXT layout is unstable — only learn ids, never emit broken 49 (crashes agar.su getString)
          return this._lbExtLearn(buf);
        case proto.S2C.PLAYER_ID:
          if (buf.length >= 5) {
            const id = buf.readUInt32LE(1) >>> 0;
            this._hintPid = id;
            if (this._pendingNick && id) this.names.set(id, this._pendingNick);
            // Always rebind camera owner to THIS AgarZ id (auto-respawn / reconnect)
            const pkts = this._adoptOwner(id, 'PLAYER_ID');
            return pkts || [];
          }
          return [];
        case proto.S2C.SPECTATE_ID:
          if (this.gotOwnCell || this.pid > 0 || (this._ownCellIds && this._ownCellIds.size)) return [];
          return [];
        case proto.S2C.ADD_CHAT:
        case proto.S2C.ADD_CHAT_ADMIN:
          return chatBridge.agarzChatToAgar(buf);
        case proto.S2C.SHOW_MESSAGE: {
          const t = proto.readUtf16(buf, 1).s;
          if (t) return [chatBridge.systemChat(t.slice(0, 160), { r: 255, g: 190, b: 70 })];
          return [];
        }
        case proto.S2C.READY_TO_START:
          this._ready = true;
          return [];
        case proto.S2C.CONSOLE_LOG:
        case proto.S2C.TOPMSG:
          return [];
        case proto.S2C.IPSAFE_FAIL:
          return [chatBridge.systemChat('IP check failed', { r: 255, g: 90, b: 90 })];
        default:
          return [];
      }
    } catch (_) {
      return [];
    }
  }

  _buildBorder() {
    const b = this.border;
    const w = new Writer();
    w.u8(AGAR.BORDER);
    w.f64(b.minx);
    w.f64(b.miny);
    w.f64(b.maxx);
    w.f64(b.maxy);
    w.u16(4);
    w.u16(4);
    w.u32(this.ownerPid());
    const out = w.out();
    if (out.length < 44) {
      const padded = Buffer.alloc(44);
      out.copy(padded);
      return padded;
    }
    return out;
  }

  _border(buf) {
    const now = Date.now();
    let dimsChanged = false;
    if (buf.length >= 33) {
      const next = {
        minx: buf.readDoubleLE(1),
        miny: buf.readDoubleLE(9),
        maxx: buf.readDoubleLE(17),
        maxy: buf.readDoubleLE(25),
      };
      const prev = this.border;
      dimsChanged =
        !this._borderFromServer ||
        Math.abs(next.minx - prev.minx) > 50 ||
        Math.abs(next.miny - prev.miny) > 50 ||
        Math.abs(next.maxx - prev.maxx) > 50 ||
        Math.abs(next.maxy - prev.maxy) > 50;
      this.border = next;
      this._borderFromServer = true;
    }
    this.sentBorder = true;
    // CRITICAL: each agar.su border (64) resets camera/cursor math AND posSize=1
    // (kills spectate zoom-out). After first border, only re-emit on map change.
    // Never spam border while free-spectating — follow with CAMERA to restore zoom.
    if (this._borderClientSent) {
      if (this._spectateArmed && !this._clientOwnerPid && !dimsChanged) return [];
      if (this._clientOwnerPid > 0 && !dimsChanged) return [];
      if (!dimsChanged && now - (this._lastBorderEmitAt || 0) < 30000) return [];
      if (dimsChanged && now - (this._lastBorderEmitAt || 0) < 2000) return [];
    }
    this._borderClientSent = true;
    this._lastBorderEmitAt = now;
    const out = [this._buildBorder()];
    // Border sets client posSize=1 — push CAMERA so spectate stays zoomed out
    if (this._spectateArmed && !this._clientOwnerPid) {
      out.push(Buffer.from([AGAR.CAMERA]));
    }
    return out;
  }

  _nodesExt(buf) {
    if (buf.length < 5) return [];
    let p = 1;
    p += 2;
    const count = buf.readUInt16LE(p);
    p += 2;
    for (let i = 0; i < count && p + 2 <= buf.length; i++) {
      const id = buf.readUInt16LE(p);
      p += 2;
      const name = proto.readUtf16(buf, p);
      p = name.p;
      const skin = proto.readUtf16(buf, p);
      p = skin.p;
      if (id && name.s) {
        const nm = chatBridge.rebrand(String(name.s).slice(0, 24));
        this.names.set(id, nm);
        if (skin.s) {
          if (!this.skins) this.skins = new Map();
          this.skins.set(id, skin.s);
        }
      }
    }
    return [];
  }

  _nodes2(buf) {
    // Drop world until camera owner is known — otherwise agar.su creates the cell
    // as foreign and NEVER attaches camera (isOwn only on first create).
    if (this._holdWorldUntilOwner && !this._clientOwnerPid) return [];
    if (!this.sentBorder) {
      this.sentBorder = true;
      return [this._buildBorder(), ...this._nodes2Body(buf)];
    }
    return this._nodes2Body(buf);
  }

  _nodes2Body(buf) {
    let p = 1;
    const cells = [];
    let expand = false;
    while (p + 4 <= buf.length) {
      const id = buf.readUInt32LE(p);
      p += 4;
      if (!id) break;
      if (p + 12 > buf.length) break;
      const x = buf.readInt16LE(p);
      p += 2;
      const y = buf.readInt16LE(p);
      p += 2;
      // Size: treat as unsigned — large mass must not wrap to tiny size (zoom/mouse break)
      let size = buf.readUInt16LE(p);
      p += 2;
      size = Math.max(1, Math.min(65535, size));
      const r = buf[p++];
      const g = buf[p++];
      const b = buf[p++];
      const cellType = buf[p++];
      const flags16 = buf.readUInt16LE(p);
      p += 2;

      // Only heuristic-expand before we know the real board / have a player id.
      // After death gotOwnCell goes false — must NOT resume border spam.
      if (!this._borderFromServer && this.pid === 0) {
        const pad = Math.max(200, size * 2);
        if (x - pad < this.border.minx) {
          this.border.minx = x - pad;
          expand = true;
        }
        if (y - pad < this.border.miny) {
          this.border.miny = y - pad;
          expand = true;
        }
        if (x + pad > this.border.maxx) {
          this.border.maxx = x + pad;
          expand = true;
        }
        if (y + pad > this.border.maxy) {
          this.border.maxy = y + pad;
          expand = true;
        }
      }

      let agarType = 4;
      let playerId = 0;
      let flags = 0;
      let name = '';
      let borderPkt = null;

      if (cellType === CELL.FOOD || cellType === CELL.GOLD) {
        agarType = 4;
      } else if (cellType === CELL.VIRUS || cellType === CELL.RED_VIRUS) {
        agarType = 2;
        flags = 1;
      } else if (cellType === CELL.EJECTED) {
        agarType = 3;
        flags = 32;
      } else {
        agarType = 0;
        const flagPid = flags16 >>> 0;
        playerId = flagPid;

        const knownOwn = this._ownCellIds && this._ownCellIds.has(id);
        const matchHint =
          this._hintPid > 0 &&
          (flagPid === this._hintPid || flagPid === (this._hintPid & 0xffff));
        const matchPid =
          this.pid > 0 && (flagPid === this.pid || flagPid === (this.pid & 0xffff));
        const matchClient =
          this._clientOwnerPid > 0 &&
          (flagPid === this._clientOwnerPid || flagPid === (this._clientOwnerPid & 0xffff));

        if (!this._spectateArmed && (knownOwn || matchHint || matchPid || matchClient)) {
          if (!this._clientOwnerPid || flagPid === this._hintPid || flagPid === (this.pid & 0xffff)) {
            const adopt = this._adoptOwner(flagPid || this._hintPid || this.pid, 'cell');
            if (adopt && adopt.length) borderPkt = adopt; // may be [CLEAR, BORDER]
          }
          // Always stamp with current camera owner
          playerId = this.ownerPid();
          this.gotOwnCell = true;
          this.spectateZoom = false;
          this._lastLiveOwnAt = Date.now();
          this._lastOwnPos = { x, y };
          this._ownerLocked = true;
          if (!this._ownCellIds) this._ownCellIds = new Set();
          this._ownCellIds.add(id);
          if (!this._ownCellServerAt) this._ownCellServerAt = new Map();
          this._ownCellServerAt.set(id, Date.now());
          if (this._pendingNick) {
            name = this._pendingNick;
            this.names.set(playerId, name);
          }
        }

        if (!name) name = this.names.get(playerId) || this.names.get(flagPid) || '';
        name = chatBridge.rebrand(name);
        // Already-tracked own cells always carry border owner id
        if (this._ownCellIds && this._ownCellIds.has(id) && this.ownerPid() !== PID_PLACEHOLDER) {
          playerId = this.ownerPid();
        }
      }

      cells.push({
        id,
        type: agarType,
        playerId,
        x,
        y,
        size: size,
        r: agarType === 2 ? 51 : r,
        g: agarType === 2 ? 255 : g,
        b: agarType === 2 ? 51 : b,
        flags,
        name: agarType === 0 ? name : '',
        _borderPkt: borderPkt,
      });
    }

    const removes = [];
    if (p + 4 <= buf.length) {
      let n = buf.readUInt32LE(p) >>> 0;
      p += 4;
      // Never drop the whole remove list (old n>2000→0 caused mass phantoms).
      // Clamp to what the packet can actually hold.
      const maxByBytes = Math.floor((buf.length - p) / 4);
      if (n > maxByBytes) n = maxByBytes;
      if (n > 20000) n = 20000;
      for (let i = 0; i < n; i++) {
        removes.push(buf.readUInt32LE(p) >>> 0);
        p += 4;
      }
    }

    let ownerPkts = null;
    for (const c of cells) {
      if (c._borderPkt) {
        ownerPkts = c._borderPkt;
        delete c._borderPkt;
      }
    }

    const out = this._finishWorld(cells, removes);
    if (ownerPkts && ownerPkts.length) {
      // CLEAR+BORDER must precede cell updates so isOwn attaches on create
      out.unshift(...ownerPkts);
    }

    // Death: require many ticks without own cells (AOI gaps shouldn't drop play state)
    if (this.ownerPid() !== PID_PLACEHOLDER && this.gotOwnCell && !this._spectateArmed) {
      let alive = false;
      let ox = 0,
        oy = 0,
        n = 0;
      const own = this.ownerPid();
      for (const c of this._lastCell.values()) {
        if (c.type === 0 && c.playerId === own) {
          alive = true;
          ox += c.x;
          oy += c.y;
          n++;
        }
      }
      if (alive && n) {
        this._ownMissingTicks = 0;
        this._lastOwnPos = { x: ox / n, y: oy / n };
      } else {
        this._ownMissingTicks++;
        if (this._ownMissingTicks > 90) {
          this.gotOwnCell = false;
          // Allow respawn nick after death — keep _clientOwnerPid for camera
          this._ownerLocked = false;
        }
      }
    }
    return out;
  }

  _writeAgarCell(w, cell) {
    let playerId = cell.playerId >>> 0;
    // Camera lock: own cells MUST use border owner id
    if (cell.type === 0 && this._ownCellIds && this._ownCellIds.has(cell.id >>> 0) && this.pid > 0) {
      playerId = this.ownerPid();
    }
    w.u32(cell.id >>> 0);
    w.u8(cell.type & 255);
    if (cell.type !== 1) {
      if (cell.type === 0) w.u32(playerId);
      w.i32(cell.x | 0);
      w.i32(cell.y | 0);
      w.u16(Math.max(0, Math.min(65535, cell.size | 0)));
    }
    w.u8(cell.r & 255);
    w.u8(cell.g & 255);
    w.u8(cell.b & 255);
    w.u8(cell.flags & 255);
    w.utf8(cell.name || '');
    w.u8(0);
  }

  _finishWorld(cells, removes) {
    const now = Date.now();
    const remOut = [];
    const removed = new Set();
    const cellIds = new Set(cells.map((c) => c.id >>> 0));

    for (const id of removes) {
      const rid = id >>> 0;
      // Same-tick update beats destroy (AgarZ sometimes lists both)
      if (cellIds.has(rid)) continue;
      // Never destroy own cell unless AgarZ really removed it and it's not updating
      this.known.delete(rid);
      this._lastCell.delete(rid);
      if (this._ownCellIds) this._ownCellIds.delete(rid);
      remOut.push(rid);
      removed.add(rid);
    }

    const changed = [];
    const seen = new Set();
    for (const c of cells) {
      const id = c.id >>> 0;
      seen.add(id);
      this.known.add(id);
      const prev = this._lastCell.get(id);
      const isOwn =
        c.type === 0 &&
        ((this._ownCellIds && this._ownCellIds.has(id)) ||
          (this.ownerPid() !== PID_PLACEHOLDER && c.playerId === this.ownerPid()));
      if (isOwn) c.playerId = this.ownerPid();
      const same =
        prev &&
        prev.x === c.x &&
        prev.y === c.y &&
        prev.size === c.size &&
        prev.r === c.r &&
        prev.g === c.g &&
        prev.b === c.b &&
        prev.type === c.type &&
        prev.playerId === c.playerId &&
        prev.name === c.name &&
        prev.flags === c.flags;
      // Own cells: always refresh at least every ~80ms (agar.su fixDead = 3s)
      if (same && !(isOwn && now - (prev.sentAt || 0) > 80)) {
        // Still alive on AgarZ this tick — don't age out for stale purge
        prev.lastSeenAt = now;
        continue;
      }
      this._lastCell.set(id, { ...c, sentAt: now, lastSeenAt: now });
      changed.push(c);
    }

    // AgarZ may omit own cell for 1 tick — inject briefly only.
    // Long inject = phantom cells at old coords. Prefer AgarZ destroy list.
    if (this._ownCellIds && this.pid > 0 && !this._spectateArmed) {
      const ghostKill = [];
      for (const id of this._ownCellIds) {
        if (seen.has(id) || removed.has(id)) continue;
        const prev = this._lastCell.get(id);
        if (!prev || prev.type !== 0) continue;
        const lastSrv = (this._ownCellServerAt && this._ownCellServerAt.get(id)) || 0;
        const age = now - lastSrv;
        // Gone from AgarZ world too long → force client destroy
        if (age > 450) {
          ghostKill.push(id);
          continue;
        }
        // Bridge gap only (~2–3 ticks); do not keep stale positions alive
        if (age > 180) continue;
        if (now - (prev.sentAt || 0) <= 80) continue;
        const c = { ...prev, playerId: this.ownerPid(), type: 0, sentAt: now, lastSeenAt: now };
        this._lastCell.set(id, c);
        changed.push(c);
      }
      for (const id of ghostKill) {
        this._ownCellIds.delete(id);
        this._lastCell.delete(id);
        this.known.delete(id);
        if (this._ownCellServerAt) this._ownCellServerAt.delete(id);
        remOut.push(id);
      }
    }

    // AgarZ world is a delta: food/virus/eject appear once and only leave via remove list.
    // Never invent destroys for them. Heartbeat so agar.su fixDead(3s) doesn't wipe food.
    // Foreign players: longer AOI timeout only.
    if (this._lastCell.size) {
      for (const [id, prev] of this._lastCell) {
        if (seen.has(id) || removed.has(id)) continue;
        if (this._ownCellIds && this._ownCellIds.has(id)) continue;
        const t = prev.type | 0;
        const isFoodish = t === 1 || t === 2 || t === 3 || t === 4;
        const sinceSent = now - (prev.sentAt || 0);
        if (isFoodish) {
          if (sinceSent > 1800) {
            const c = { ...prev, sentAt: now, lastSeenAt: prev.lastSeenAt || now };
            this._lastCell.set(id, c);
            changed.push(c);
          }
          continue;
        }
        // type 0 foreign player — gone from packets too long → drop
        const sinceSeen = now - (prev.lastSeenAt || prev.sentAt || 0);
        if (sinceSeen > 5000) {
          this._lastCell.delete(id);
          this.known.delete(id);
          remOut.push(id >>> 0);
        }
      }
    }

    if (!changed.length && !remOut.length) return [];

    const w = new Writer();
    w.u8(AGAR.UPDATE_NODES);
    w.u32(0);
    for (const c of changed) this._writeAgarCell(w, c);
    w.u32(0);
    for (const id of remOut) w.u32(id);
    const out = [w.out()];

    if (this.spectateZoom && this._spectateArmed && !this.gotOwnCell && this.pid === 0 && now - this._lastCamAt > 800) {
      this._lastCamAt = now;
      // Keep posSize=0.15 so wheel can zoom out further (border would reset to 1)
      out.push(Buffer.from([AGAR.CAMERA]));
    }
    return out;
  }

  _lb(buf) {
    // AgarZ 0x31: [count u32][ id u32, utf16z name ]*count  (NO score between)
    if (buf.length < 5) return [];
    const count = buf.readUInt32LE(1);
    if (count > 50) return [];
    let p = 5;
    const items = [];
    for (let i = 0; i < count && p + 4 <= buf.length; i++) {
      const id = buf.readUInt32LE(p) >>> 0;
      p += 4;
      const nm = proto.readUtf16(buf, p);
      p = nm.p;
      let name = String(nm.s || '').replace(/\0/g, '').slice(0, 24);
      name = chatBridge.rebrand(name);
      if (!name) name = this.names.get(id) || this.names.get(id & 0xffff) || 'Unnamed';
      name = chatBridge.rebrand(name);
      // Own free-nick: LB shows typed display, not guest spawn
      const spawn = String(this._spawnNick || '').trim().toLowerCase();
      const display = String(this._pendingNick || '').trim();
      if (display && spawn && name.toLowerCase() === spawn) name = display;
      this.names.set(id, name);
      if (id <= 0xffff) this.names.set(id & 0xffff, name);
      items.push({ id, name });
    }
    return [this._buildLb(items)];
  }

  _lbExtLearn(buf) {
    // Best-effort: count u8 + id u32 … — store ids only
    if (buf.length < 2) return [];
    const count = Math.min(50, buf[1] | 0);
    let p = 2;
    for (let i = 0; i < count && p + 4 <= buf.length; i++) {
      const id = buf.readUInt32LE(p) >>> 0;
      p += 4;
      if (p + 6 <= buf.length) p += 6;
      if (!this.names.has(id)) this.names.set(id, 'Unnamed');
    }
    return [];
  }

  _buildLb(items) {
    const w = new Writer();
    w.u8(AGAR.LB);
    w.u32(items.length);
    for (const it of items) {
      w.u32(it.id >>> 0);
      w.utf16(it.name || 'Unnamed');
      w.u32(0);
    }
    return w.out();
  }
}





  // ═══════════════════════════════════════════════════════════════
  // Delta (delt.io) — XOR crypto + modern agar ↔ agar.su translator
  // ═══════════════════════════════════════════════════════════════

  var DELTA_PROTOCOL = 22;
  var DELTA_VERSION = "25.4.1";
  var DELTA_GUEST_NICK = "Player Agar.su";
  var deltaLastOpenUrl = "";
  /** Shared account for Delta LK — only used on delt.io path, never agar.su. */
  var DELTA_BEARER_DEFAULT =
    "ric76rBrNz0EdhqeEdzoTrHsBOPws7zw.AQcqVJc3zJai/yYLeYS+bX7BdY1Posz+GvQ4W1o+YqY=";
  var DELTA_LS_BEARER = "delta_bearer_token";
  /** @type {{bearer:string, sessionToken:string, userId:string, ok:boolean, checkedAt:number}} */
  var deltaAuthCache = {
    bearer: "",
    sessionToken: "",
    userId: "",
    ok: false,
    checkedAt: 0,
  };

  function deltaReadStoredBearer() {
    try {
      if (typeof localStorage === "undefined") return "";
      var v = localStorage.getItem(DELTA_LS_BEARER) || localStorage.getItem("bearer_token") || "";
      return String(v || "").trim();
    } catch (_) {
      return "";
    }
  }

  function deltaWriteStoredBearer(token) {
    try {
      if (typeof localStorage === "undefined") return;
      if (token) localStorage.setItem(DELTA_LS_BEARER, String(token));
    } catch (_) {}
  }

  function deltaResolveBearer() {
    var stored = deltaReadStoredBearer();
    if (stored) return stored;
    if (DELTA_BEARER_DEFAULT) {
      deltaWriteStoredBearer(DELTA_BEARER_DEFAULT);
      return DELTA_BEARER_DEFAULT;
    }
    return "";
  }

  /** Official Delta: [100][UTF-8 token…][0] after handshake when logged in. */
  function deltaAuthTokenPkt(token) {
    var t = Buffer.from(String(token || ""), "utf8");
    var b = Buffer.allocUnsafe(1 + t.length + 1);
    b[0] = 100;
    t.copy(b, 1);
    b[b.length - 1] = 0;
    return b;
  }

  function deltaSendAuthToken(state) {
    if (!state || !state.mp || !state.mp._keysReady) return false;
    var tok = (state.authToken || deltaAuthCache.bearer || deltaResolveBearer() || "").trim();
    if (!tok) return false;
    if (state._authSent) return false;
    state._authSent = true;
    state.authToken = tok;
    deltaSend(state, deltaAuthTokenPkt(tok));
    return true;
  }

  function deltaEnsureAuth() {
    var bearer = deltaResolveBearer();
    if (!bearer) {
      deltaAuthCache = { bearer: "", sessionToken: "", userId: "", ok: false, checkedAt: Date.now() };
      return Promise.resolve(null);
    }
    if (deltaAuthCache.ok && deltaAuthCache.bearer === bearer && Date.now() - deltaAuthCache.checkedAt < 600000) {
      return Promise.resolve(deltaAuthCache);
    }
    // api.delt.io/get-session is CORS-locked to delt.io origin — from agar.su it always fails.
    // LK bind on the game socket is op 100 with the bearer (official sendToken). Skip HTTP.
    deltaAuthCache = {
      bearer: bearer,
      sessionToken: bearer.split(".")[0] || bearer,
      userId: "",
      ok: true,
      checkedAt: Date.now(),
    };
    deltaWriteStoredBearer(bearer);
    return Promise.resolve(deltaAuthCache);
  }

  function deltaVersionStringToInt(versionString) {
    var p = String(versionString || "0.0.0").split(".");
    return ((+p[0] | 0) * 10000 + (+p[1] | 0) * 100 + (+p[2] | 0)) >>> 0;
  }

  function deltaXorBuffer(packet, key) {
    var buf = Buffer.isBuffer(packet) ? packet : Buffer.from(packet);
    var kb = Buffer.allocUnsafe(4);
    kb.writeUInt32LE(key >>> 0, 0);
    for (var i = 0; i < buf.length; i++) buf[i] ^= kb[i % 4];
    return buf;
  }

  function deltaRotateKey(key) {
    var k = key | 0;
    k = (Math.imul(k, 1540483477) | 0);
    k = (Math.imul((k >>> 24) ^ k, 1540483477) | 0) ^ 114296087;
    k = Math.imul((k >>> 13) ^ k, 1540483477) | 0;
    k = (k >>> 15) ^ k;
    return k >>> 0;
  }

  function deltaMurmur2(str, seed) {
    var l = str.length;
    var h = seed ^ l;
    var i = 0;
    var k;
    while (l >= 4) {
      k =
        (str.charCodeAt(i) & 0xff) |
        ((str.charCodeAt(++i) & 0xff) << 8) |
        ((str.charCodeAt(++i) & 0xff) << 16) |
        ((str.charCodeAt(++i) & 0xff) << 24);
      k = ((k & 0xffff) * 0x5bd1e995 + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16)) | 0;
      k ^= k >>> 24;
      k = ((k & 0xffff) * 0x5bd1e995 + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16)) | 0;
      h = ((h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) ^ k;
      l -= 4;
      ++i;
    }
    switch (l) {
      case 3:
        h ^= (str.charCodeAt(i + 2) & 0xff) << 16;
      // fallthrough
      case 2:
        h ^= (str.charCodeAt(i + 1) & 0xff) << 8;
      // fallthrough
      case 1:
        h ^= str.charCodeAt(i) & 0xff;
        h = ((h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) | 0;
    }
    h ^= h >>> 13;
    h = ((h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) | 0;
    h ^= h >>> 15;
    return h >>> 0;
  }

  function deltaHandlePacket241(packet, versionInt, host) {
    var off = 1;
    var movementKey = packet.readInt32LE(off);
    off += 4;
    var version = "";
    while (off < packet.length) {
      var c = packet[off++];
      if (!c) break;
      version += String.fromCharCode(c);
    }
    var decryptionKey = (movementKey ^ (versionInt >>> 0)) >>> 0;
    var encryptionKey = deltaMurmur2(String(host || "") + version, 255);
    return {
      movementKey: movementKey >>> 0,
      decryptionKey: decryptionKey,
      encryptionKey: encryptionKey,
      version: version,
    };
  }

  /** Opcode 255: [255][u32 uncompressedSize LE][compressed…] — AgarRepacker LZ4-ish. */
  function deltaUncompressMessage(input, output) {
    if (!output) output = [];
    var i = 0;
    var j = 0;
    var n = input.length;
    while (i < n) {
      var token = input[i++];
      var literalsLength = token >> 4;
      if (literalsLength > 0) {
        var length = literalsLength + 240;
        while (length === 255) {
          length = input[i++];
          literalsLength += length;
        }
        var end = i + literalsLength;
        while (i < end) output[j++] = input[i++];
        if (i === n) return Buffer.from(output);
      }
      if (i + 1 >= n) return Buffer.from(output);
      var offset = input[i++] | (input[i++] << 8);
      if (offset === 0 || offset > j) return -(i - 2);
      var matchLength = token & 15;
      length = matchLength + 240;
      while (length === 255) {
        length = input[i++];
        matchLength += length;
      }
      var pos = j - offset;
      end = j + matchLength + 4;
      while (j < end) output[j++] = output[pos++];
    }
    return Buffer.from(output);
  }

  function deltaDecompress255(packet) {
    if (!packet || packet[0] !== 255 || packet.length < 6) return null;
    var size = packet.readUInt32LE(1);
    var compressed = packet.subarray(5);
    var out = [];
    var result = deltaUncompressMessage(compressed, out);
    if (typeof result === "number" && result < 0) return null;
    var buf = Buffer.isBuffer(result) ? result : Buffer.from(out);
    if (size > 0 && buf.length > size) return buf.subarray(0, size);
    return buf;
  }

  var DELTA_OP = {
    NICK: 0,
    SPECTATE: 1,
    UPDATE: 16,
    CAMERA: 17,
    SPLIT: 17,
    CLEAR: 20,
    EJECT: 21,
    OWN_CELL: 32,
    LB: 49,
    LB_PARTY: 53,
    BORDER: 64,
    CHAT: 99,
    INIT_KEY: 241,
  };

  function deltaProtocolVersion(n) {
    var b = Buffer.allocUnsafe(5);
    b[0] = 254;
    b.writeUInt32LE(n >>> 0, 1);
    return b;
  }

  function deltaVersionIntPkt(n) {
    var b = Buffer.allocUnsafe(5);
    b[0] = 255;
    b.writeUInt32LE(n >>> 0, 1);
    return b;
  }

  /** Spawn nick UTF-8: [0][nick][0]["0"][0] */
  function deltaSpawnNick(nick) {
    var s = String(nick || DELTA_GUEST_NICK).slice(0, 15);
    var nickBuf = Buffer.from(s, "utf8");
    var tagBuf = Buffer.from("0", "utf8");
    var b = Buffer.allocUnsafe(1 + nickBuf.length + 1 + tagBuf.length + 1);
    var o = 0;
    b[o++] = 0;
    nickBuf.copy(b, o);
    o += nickBuf.length;
    b[o++] = 0;
    tagBuf.copy(b, o);
    o += tagBuf.length;
    b[o++] = 0;
    return b;
  }

  function deltaSpectatePkt() {
    return Buffer.from([1]);
  }

  function deltaSplitPkt() {
    return Buffer.from([17]);
  }

  function deltaEjectPkt() {
    return Buffer.from([21]);
  }

  function deltaQDownPkt() {
    return Buffer.from([18]);
  }

  function deltaQUpPkt() {
    return Buffer.from([19]);
  }

  /** Multibox: ask server for another unit (Tab). */
  function deltaRequestUnitPkt() {
    return Buffer.from([62]);
  }

  /** Multibox: mark unit active/inactive — [20][u16 tabId][u8 active]. */
  function deltaActivateUnitPkt(tabId, active) {
    var b = Buffer.allocUnsafe(4);
    b[0] = 20;
    b.writeUInt16LE((tabId >>> 0) & 0xffff, 1);
    b[3] = active ? 1 : 0;
    return b;
  }

  /** Parse agar.su outbound chat → plain text (strip :ru etc). */
  function deltaParseAgarChatOut(buf) {
    if (!buf || buf.length < 2 || buf[0] !== 99) return "";
    var raw = "";
    if (buf[1] === 0) {
      for (var p = 2; p + 1 < buf.length; p += 2) {
        var ch = buf.readUInt16LE(p);
        if (!ch) break;
        raw += String.fromCharCode(ch);
      }
    } else {
      var o = 1;
      var flags = buf[o++];
      if (flags & 2) o += 4;
      if (flags & 4) o += 8;
      if (flags & 8) o += 16;
      while (o + 1 < buf.length) {
        var c2 = buf.readUInt16LE(o);
        o += 2;
        if (!c2) break;
        raw += String.fromCharCode(c2);
      }
    }
    return String(raw || "")
      .replace(/\s*:(ru|en|uk|tr|zh|ar|es|pl|de)\s*$/i, "")
      .trim();
  }

  /** Delta C2S chat: [99][utf8 message][0] */
  function deltaChatOutPkt(text) {
    var t = String(text || "").slice(0, 120);
    if (!t) return null;
    var body = Buffer.from(t, "utf8");
    var b = Buffer.allocUnsafe(1 + body.length + 1);
    b[0] = 99;
    body.copy(b, 1);
    b[b.length - 1] = 0;
    return b;
  }

  function deltaReadUtf8Z(buf, pos) {
    var end = pos;
    while (end < buf.length && buf[end]) end++;
    var s = buf.slice(pos, end).toString("utf8");
    return { s: s, p: end < buf.length ? end + 1 : end };
  }

  /**
   * Delta S2C chat → agar.su chat packets.
   * Official: [99][flags][rgb…][name utf8z][msg utf8z]
   * Also accept simple: [99][utf8z message]
   */
  function deltaChatToAgar(buf) {
    if (!buf || buf.length < 3 || buf[0] !== 99) return [];

    // Official layout (flags + colors + two ZT strings)
    try {
      var p = 1;
      var flags = buf[p++];
      var r = 180,
        g = 220,
        bcol = 255;
      if (flags & 4) {
        if (p + 7 > buf.length) throw new Error("short");
        p += 3;
        r = buf[p++];
        g = buf[p++];
        bcol = buf[p++];
        p += 1;
      } else {
        if (p + 3 > buf.length) throw new Error("short");
        r = buf[p++];
        g = buf[p++];
        bcol = buf[p++];
      }
      var name = deltaReadUtf8Z(buf, p);
      p = name.p;
      var msg = deltaReadUtf8Z(buf, p);
      var nick = String(name.s || "player")
        .replace(/delt\.io/gi, "agar.su")
        .trim()
        .slice(0, 24);
      var text = String(msg.s || "")
        .replace(/delt\.io/gi, "agar.su")
        .trim();
      if (text) {
        var pkt = chatBuildAgarPacket({ r: r, g: g, b: bcol }, 0, nick || "player", text);
        if (pkt) return [pkt];
      }
    } catch (_) {}

    // Simple utf8 broadcast
    var simple = deltaReadUtf8Z(buf, 1);
    if (simple.s && !/[\x00-\x08]/.test(simple.s)) {
      var sp = chatBuildAgarPacket({ r: 180, g: 220, b: 255 }, 0, "player", simple.s.replace(/delt\.io/gi, "agar.su"));
      return sp ? [sp] : [];
    }
    return [];
  }

  /** Mouse 13 bytes: [16][i32 x][i32 y][u32 movementKey] */
  function deltaMousePkt(x, y, movementKey) {
    var b = Buffer.allocUnsafe(13);
    b[0] = 16;
    var xi = Number.isFinite(x) ? x | 0 : 0;
    var yi = Number.isFinite(y) ? y | 0 : 0;
    b.writeInt32LE(xi, 1);
    b.writeInt32LE(yi, 5);
    b.writeUInt32LE((movementKey || 0) >>> 0, 9);
    return b;
  }

  function deltaHostFromUrl(url) {
    try {
      return new URL(String(url || ""), "wss://x").hostname;
    } catch (e) {
      var s = String(url || "").replace(/^wss?:\/\//i, "");
      return s.split("/")[0].split(":")[0] || "";
    }
  }

  function deltaWireNameWithSkin(name, skin) {
    var display = String(name || "").trim();
    var sk = String(skin || "").trim();
    if (display.indexOf("\n") >= 0) {
      display = display.slice(display.indexOf("\n") + 1).trim();
    }
    if (sk && display) return sk + "\n" + display;
    return display || sk || "";
  }

  function deltaParseModernUpdate(buf) {
    var off = 1;
    if (off + 2 > buf.length) return null;
    var eatN = buf.readUInt16LE(off);
    off += 2;
    var eaten = [];
    for (var i = 0; i < eatN && off + 8 <= buf.length; i++) {
      var killer = buf.readUInt32LE(off);
      off += 4;
      var killed = buf.readUInt32LE(off);
      off += 4;
      eaten.push({ killer: killer, killed: killed });
    }
    var cells = [];
    while (off + 4 <= buf.length) {
      var id = buf.readUInt32LE(off);
      off += 4;
      if (id === 0) break;
      if (off + 11 > buf.length) break;
      var x = buf.readInt32LE(off);
      off += 4;
      var y = buf.readInt32LE(off);
      off += 4;
      var size = buf.readUInt16LE(off);
      off += 2;
      var flags = buf[off++];
      var ext = 0;
      if (flags & 128) {
        if (off >= buf.length) break;
        ext = buf[off++];
      }
      var r = 255,
        g = 255,
        b = 255,
        hasColor = false;
      if (flags & 2) {
        if (off + 3 > buf.length) break;
        r = buf[off++];
        g = buf[off++];
        b = buf[off++];
        hasColor = true;
      }
      var skin = "";
      if (flags & 4) {
        while (off < buf.length) {
          var sc = buf[off++];
          if (!sc) break;
          skin += String.fromCharCode(sc);
        }
      }
      var name = "";
      if (flags & 8) {
        while (off < buf.length) {
          var nc = buf[off++];
          if (!nc) break;
          name += String.fromCharCode(nc);
        }
        try {
          name = decodeURIComponent(escape(name));
        } catch (_) {}
      }
      if (ext & 4 && off + 4 <= buf.length) off += 4;
      var isVirus = !!(flags & 1);
      var isPellet = !!(ext & 1);
      var isEjected = !!(flags & 32);
      var type = 0;
      if (isPellet) type = 4;
      else if (isVirus) type = 2;
      else if (isEjected) type = 3;
      cells.push({
        id: id,
        x: x,
        y: y,
        size: size,
        r: r,
        g: g,
        b: b,
        _hasColor: hasColor,
        flags: flags & 0x7f,
        name: name || "",
        skin: skin,
        type: type,
        playerId: isPellet || isVirus || isEjected ? 0 : id,
      });
    }
    var removes = [];
    if (off + 2 <= buf.length) {
      var remN = buf.readUInt16LE(off);
      off += 2;
      for (var j = 0; j < remN && off + 4 <= buf.length; j++) {
        removes.push(buf.readUInt32LE(off));
        off += 4;
      }
    }
    return { eaten: eaten, cells: cells, removes: removes };
  }

  function deltaBuildAgarUpdate(eaten, cells, removes) {
    var w = new Writer();
    w.u8(AGAR.UPDATE_NODES);
    for (var ei = 0; ei < eaten.length; ei++) {
      w.u32(eaten[ei].killed >>> 0);
      w.u32(eaten[ei].killer >>> 0);
    }
    w.u32(0);
    for (var ci = 0; ci < cells.length; ci++) {
      var c = cells[ci];
      w.u32(c.id >>> 0);
      w.u8(c.type & 255);
      if (c.type !== 1) {
        if (c.type === 0) w.u32((c.playerId || c.id) >>> 0);
        w.i32(c.x | 0);
        w.i32(c.y | 0);
        w.u16(Math.max(0, Math.min(65535, c.size | 0)));
      }
      w.u8(c.r & 255);
      w.u8(c.g & 255);
      w.u8(c.b & 255);
      var spiked = 0;
      if (c.type === 2 || (c.flags & 1)) spiked |= 1;
      if (c.type === 3 || (c.flags & 32)) spiked |= 32;
      if (c.flags & 16) spiked |= 16;
      w.u8(spiked);
      w.utf8(c.name || "");
      w.u8(0);
    }
    w.u32(0);
    for (var ri = 0; ri < removes.length; ri++) w.u32(removes[ri] >>> 0);
    return w.out();
  }

  function deltaBuildAgarBorder(minx, miny, maxx, maxy, ownerPid) {
    var w = new Writer();
    w.u8(AGAR.BORDER);
    w.f64(minx);
    w.f64(miny);
    w.f64(maxx);
    w.f64(maxy);
    w.u16(4);
    w.u16(4);
    w.u32(ownerPid >>> 0);
    var out = w.out();
    if (out.length < 44) {
      var padded = Buffer.alloc(44);
      out.copy(padded);
      return padded;
    }
    return out;
  }

  function deltaBuildAgarLb(items) {
    var list = (items || []).slice(0, 10);
    var w = new Writer();
    w.u8(AGAR.LB);
    w.u32(list.length);
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var name = typeof it === "string" ? it : (it && it.name) || "";
      var id = typeof it === "object" && it ? it.id >>> 0 : 0;
      w.u32(id);
      w.utf16(String(name || "").replace(/delt\.io/gi, "agar.su"));
      w.u32(0);
    }
    return w.out();
  }

  function deltaParsePartyLb(buf) {
    if (!buf || buf.length < 2) return [];
    var off = 1;
    if (buf[0] === 54) off = 2;
    var items = [];
    while (off < buf.length) {
      var flags = buf[off++];
      if (flags & 0x01) {
        if (off >= buf.length) break;
        off++;
      }
      var name = "";
      if (flags & 0x02) {
        while (off < buf.length) {
          var c = buf[off++];
          if (!c) break;
          name += String.fromCharCode(c);
        }
        try {
          name = decodeURIComponent(escape(name));
        } catch (_) {}
      }
      var id = 0;
      if (flags & 0x04) {
        if (off + 4 > buf.length) break;
        id = buf.readUInt32LE(off) >>> 0;
        off += 4;
      }
      name = String(name || "")
        .replace(/^\s+/, "")
        .replace(/delt\.io/gi, "agar.su");
      if (!name && !(flags & 0x08)) {
        if (!flags) break;
        continue;
      }
      items.push({ id: id, name: name || "Unnamed" });
      if (items.length >= 10) break;
    }
    return items;
  }

  function deltaParseModernLb(buf) {
    if (buf.length < 5) return [];
    var n = Math.min(buf.readUInt32LE(1), 20);
    var off = 5;
    var items = [];
    for (var i = 0; i < n && off + 6 <= buf.length; i++) {
      var id = buf.readUInt32LE(off);
      off += 4;
      var name = "";
      while (off + 1 < buf.length) {
        var c = buf.readUInt16LE(off);
        off += 2;
        if (!c) break;
        name += String.fromCharCode(c);
      }
      items.push({ id: id, name: name.replace(/delt\.io/gi, "agar.su") });
    }
    return items;
  }

  class DeltaMultiProtocol {
    constructor() {
      this.pid = 0;
      this._clientOwnerPid = 0;
      this._ownerBorderOk = false;
      this.gotOwnCell = false;
      this._ready = false;
      this.spectateZoom = true;
      this._ownCellIds = new Set();
      this._border = null;
      this.movementKey = 0;
      this.decryptionKey = 0;
      this.encryptionKey = 0;
      this.versionStr = "";
      this._keysReady = false;
      this.versionInt = deltaVersionStringToInt(DELTA_VERSION);
      this._colorById = new Map();
      this._nameById = new Map();
      this._playNick = "";
      this._displayNick = "";
      this._ownMissingTicks = 0;
      this._clientSeeded = false;
      this._agarOwnCreated = new Set();
      this._sentCellIds = new Set();
      this._heldWorld = [];
      this._mapBorderSent = false;
      this._cellSnap = new Map();
      this._spectating = true;
      this._spectateSentToDelta = false;
      this._lastMouse = null;
      this._lastCamEmitAt = 0;
      this._unitIds = [];
      this._activeUnitIdx = 0;
      this._activeTabId = 0;
      this._mbDenied = false;
      this._mbPendingSpawn = false;
    }

    activeTabId() {
      if (this._unitIds && this._unitIds.length) {
        var id = this._unitIds[this._activeUnitIdx] || this._unitIds[0] || 0;
        return id >>> 0;
      }
      return (this._activeTabId || 0) >>> 0;
    }

    setUnitIds(ids) {
      var prev = (this._unitIds || []).slice();
      this._unitIds = (ids || []).map(function (x) {
        return x >>> 0;
      });
      if (!this._unitIds.length) {
        this._activeUnitIdx = 0;
        this._activeTabId = 0;
        return { added: [], rotated: false };
      }
      if (this._activeUnitIdx >= this._unitIds.length) this._activeUnitIdx = 0;
      var cur = this._unitIds[this._activeUnitIdx];
      if (cur != null) this._activeTabId = cur >>> 0;
      var added = [];
      for (var i = 0; i < this._unitIds.length; i++) {
        if (prev.indexOf(this._unitIds[i]) < 0) added.push(this._unitIds[i]);
      }
      return { added: added, rotated: false };
    }

    /** Local rotate like delt.io Tab — server told via op 20 which unit is active. */
    rotateUnit() {
      if (!this._unitIds || this._unitIds.length < 2) return null;
      this._activeUnitIdx = (this._activeUnitIdx + 1) % this._unitIds.length;
      this._activeTabId = this._unitIds[this._activeUnitIdx] >>> 0;
      return this._activeTabId;
    }

    ownerPid() {
      return (this._clientOwnerPid || 0) >>> 0;
    }

    _clampMouseXY(x, y) {
      var xi = Number(x);
      var yi = Number(y);
      if (!Number.isFinite(xi)) xi = 0;
      if (!Number.isFinite(yi)) yi = 0;
      xi = Math.round(xi);
      yi = Math.round(yi);
      var LIM = 0x70000000;
      if (xi > LIM) xi = LIM;
      if (xi < -LIM) xi = -LIM;
      if (yi > LIM) yi = LIM;
      if (yi < -LIM) yi = -LIM;
      if (!this._border) return { x: xi, y: yi };
      var b = this._border;
      // Native Delta lets the cursor go slightly past the wall so you can press the edge.
      var over = 1200;
      return {
        x: Math.max(b.minx - over, Math.min(b.maxx + over, xi)),
        y: Math.max(b.miny - over, Math.min(b.maxy + over, yi)),
      };
    }

    resetOwner() {
      this.pid = 0;
      this._clientOwnerPid = 0;
      this._ownerBorderOk = false;
      this.gotOwnCell = false;
      this._ownCellIds.clear();
      this._agarOwnCreated.clear();
      this._sentCellIds.clear();
      this._heldWorld = [];
      this._clientSeeded = false;
      this._ownMissingTicks = 0;
    }

    /**
     * After death: keep watching the map. Must clear play nick / enter spectate,
     * otherwise UPDATE packets are held forever (!_ownerBorderOk && _playNick)
     * and the client freezes / empties ("вылетает всё").
     * Returns agar CLEAR so death menu (statics) shows — CLEAR on agar.su only
     * drops playerCells, it does NOT wipe the world.
     */
    _markDead() {
      var hadOwn = this.gotOwnCell || this._ownCellIds.size > 0 || this._ownerBorderOk;
      this.resetOwner();
      this._playNick = "";
      this._displayNick = "";
      this._spectating = true;
      this.spectateZoom = true;
      this.gotOwnCell = false;
      this._deathClear = !!hadOwn;
      // Stay dead until the user presses Play (encodeNick). No auto-respawn.
      this._spawnLock = true;
    }

    /** Consume one-shot death CLEAR flag. */
    _takeDeathClear() {
      if (!this._deathClear) return null;
      this._deathClear = false;
      return Buffer.from([AGAR.CLEAR]);
    }

    enterSpectate(resetDeltaSpectate) {
      if (resetDeltaSpectate === undefined) resetDeltaSpectate = true;
      this.resetOwner();
      this._playNick = "";
      this._displayNick = "";
      this._spectating = true;
      this.spectateZoom = true;
      this.gotOwnCell = false;
      if (resetDeltaSpectate) {
        this._mapBorderSent = false;
        this._spectateSentToDelta = false;
      }
    }

    enterPlay(nick, displayNick) {
      this._spectating = false;
      this.spectateZoom = false;
      this._playNick =
        String(nick || DELTA_GUEST_NICK)
          .trim()
          .slice(0, 15) || DELTA_GUEST_NICK;
      this._displayNick =
        String(displayNick || nick || this._playNick)
          .trim()
          .slice(0, 15) || this._playNick;
      this._spectateSentToDelta = false;
      this._mapBorderSent = false;
      this.resetOwner();
    }

    _foreignPlayerId(cellId) {
      var pid = (cellId >>> 0) || 1;
      var owner = this.ownerPid();
      if (owner && pid === owner) pid = (pid ^ 0x00ffffff) >>> 0 || 1;
      if (!pid || pid === PID_PLACEHOLDER) pid = 1;
      return Math.max(1, pid >>> 0);
    }

    _snap(c) {
      if (!c || !c.id) return;
      this._cellSnap.set(c.id >>> 0, {
        x: c.x | 0,
        y: c.y | 0,
        size: c.size | 0,
        r: c.r & 255,
        g: c.g & 255,
        b: c.b & 255,
        name: c.name || this._playNick || "",
      });
    }

    _ensureStableOwnerPid(firstCellId) {
      if (this._clientOwnerPid) return this._clientOwnerPid >>> 0;
      var cell = firstCellId >>> 0;
      var pid = (0x6a000000 ^ cell ^ ((Date.now() & 0xffff) << 8)) >>> 0;
      if (!pid || pid === cell) pid = (0x6a000001 + (cell & 0xffff)) >>> 0;
      this._clientOwnerPid = pid;
      this.pid = cell;
      return pid;
    }

    _borderWithOwnerOnce() {
      if (this._ownerBorderOk || !this._border) return [];
      var owner = this.ownerPid();
      if (!owner) return [];
      this._ownerBorderOk = true;
      return [
        deltaBuildAgarBorder(
          this._border.minx,
          this._border.miny,
          this._border.maxx,
          this._border.maxy,
          owner
        ),
      ];
    }

    _ensureClientOwn(cellId) {
      if (this._spectating) return [];
      var id = cellId >>> 0;
      if (!id || this._agarOwnCreated.has(id)) return [];
      var snap = this._cellSnap.get(id);
      if (!snap || (snap.size | 0) < 10) return [];
      if ((snap.x | 0) === 0 && (snap.y | 0) === 0 && (snap.size | 0) < 20) return [];

      var owner = this._ensureStableOwnerPid(id);
      var out = this._borderWithOwnerOnce();
      this._clientSeeded = true;

      var wasForeign = this._sentCellIds.has(id);
      this._agarOwnCreated.add(id);
      this._sentCellIds.add(id);

      if (!wasForeign) return out;

      out.push(deltaBuildAgarUpdate([], [], [id]));
      out.push(
        deltaBuildAgarUpdate(
          [],
          [
            {
              id: id,
              type: 0,
              playerId: owner,
              x: snap.x,
              y: snap.y,
              size: snap.size,
              r: snap.r,
              g: snap.g,
              b: snap.b,
              flags: 0,
              name: this._displayNick || this._playNick || snap.name || "",
            },
          ],
          []
        )
      );
      return out;
    }

    _adoptOwner(cellId) {
      if (this._spectating) return [];
      var id = cellId >>> 0;
      if (!id) return [];
      this._ownCellIds.add(id);
      if (this._displayNick || this._playNick) this._nameById.set(id, this._displayNick || this._playNick);
      this._ensureStableOwnerPid(id);
      this.gotOwnCell = true;
      this.spectateZoom = false;
      this._ownMissingTicks = 0;
      return this._ensureClientOwn(id);
    }

    resetCrypto() {
      this.movementKey = 0;
      this.decryptionKey = 0;
      this.encryptionKey = 0;
      this.versionStr = "";
      this._keysReady = false;
      this._unitIds = [];
      this._activeUnitIdx = 0;
      this._activeTabId = 0;
      this._mbDenied = false;
      this._mbPendingSpawn = false;
    }

    applyPacket241(buf, host) {
      var r = deltaHandlePacket241(buf, this.versionInt, host);
      this.movementKey = r.movementKey;
      this.decryptionKey = r.decryptionKey;
      this.encryptionKey = r.encryptionKey;
      this.versionStr = r.version;
      this._keysReady = true;
      return r;
    }

    decryptIncoming(buf) {
      if (!this._keysReady) return Buffer.from(buf);
      return deltaXorBuffer(Buffer.from(buf), this.decryptionKey);
    }

    encryptOutgoing(plain) {
      var p = Buffer.from(plain);
      if (!this._keysReady) return p;
      deltaXorBuffer(p, this.encryptionKey);
      this.encryptionKey = deltaRotateKey(this.encryptionKey);
      return p;
    }

    deltaToAgar(buf) {
      if (!buf || !buf.length) return [];
      try {
        return this._deltaToAgarInner(buf);
      } catch (_) {
        return [];
      }
    }

    _deltaToAgarInner(buf) {
      var op = buf[0];
      if (op === DELTA_OP.INIT_KEY) return [];
      if (op === 255) {
        var inner = deltaDecompress255(buf);
        if (!inner || !inner.length) return [];
        return this._deltaToAgarInner(inner);
      }
      if (op === DELTA_OP.BORDER) {
        if (buf.length < 33) return [];
        var minx = buf.readDoubleLE(1);
        var miny = buf.readDoubleLE(9);
        var maxx = buf.readDoubleLE(17);
        var maxy = buf.readDoubleLE(25);
        this._border = { minx: minx, miny: miny, maxx: maxx, maxy: maxy };
        // Keep borders ordered — flipped min/max breaks sectors / minimap coords
        if (this._border.minx > this._border.maxx) {
          var tx = this._border.minx;
          this._border.minx = this._border.maxx;
          this._border.maxx = tx;
        }
        if (this._border.miny > this._border.maxy) {
          var ty = this._border.miny;
          this._border.miny = this._border.maxy;
          this._border.maxy = ty;
        }
        minx = this._border.minx;
        miny = this._border.miny;
        maxx = this._border.maxx;
        maxy = this._border.maxy;
        if (this._ownerBorderOk) return [];
        if (this._spectating || !this._playNick) {
          if (!this._mapBorderSent) {
            this._mapBorderSent = true;
            var bout = [deltaBuildAgarBorder(minx, miny, maxx, maxy, PID_PLACEHOLDER)];
            bout.push(Buffer.from([AGAR.CAMERA]));
            return bout;
          }
          return [];
        }
        if (this.ownerPid()) return this._borderWithOwnerOnce();
        return [];
      }
      if (op === DELTA_OP.OWN_CELL && buf.length >= 5) {
        // Ignore server auto-give cells while death-locked / spectating
        if (this._spectating || this._spawnLock) return [];
        var oid = buf.readUInt32LE(1) >>> 0;
        var oout = this._adoptOwner(oid);
        if (this._heldWorld.length) {
          for (var hi = 0; hi < this._heldWorld.length; hi++) oout.push(this._heldWorld[hi]);
          this._heldWorld = [];
        }
        return oout;
      }
      if (op === DELTA_OP.CAMERA) {
        if (this._spectating) return [];
        if (this.gotOwnCell) return [];
        var now = Date.now();
        if (now - (this._lastCamEmitAt || 0) < 800) return [];
        this._lastCamEmitAt = now;
        return [Buffer.from([AGAR.CAMERA])];
      }
      if (op === DELTA_OP.UPDATE) {
        var parsed = deltaParseModernUpdate(buf);
        if (!parsed) return [];
        var owner = this.ownerPid();
        var seedExtra = [];

        for (var ci = 0; ci < parsed.cells.length; ci++) {
          var c = parsed.cells[ci];
          var cached = this._colorById.get(c.id);
          if (c._hasColor) {
            this._colorById.set(c.id, { r: c.r, g: c.g, b: c.b });
          } else if (cached) {
            c.r = cached.r;
            c.g = cached.g;
            c.b = cached.b;
          } else {
            var h = (c.id * 2654435761) >>> 0;
            c.r = 40 + (h & 127);
            c.g = 40 + ((h >>> 8) & 127);
            c.b = 40 + ((h >>> 16) & 127);
            this._colorById.set(c.id, { r: c.r, g: c.g, b: c.b });
          }

          if (c.name) this._nameById.set(c.id, c.name);
          else if (this._nameById.has(c.id)) c.name = this._nameById.get(c.id);

          if (c.type === 0 && c.skin) {
            var display =
              String(c.name || "").indexOf("\n") >= 0
                ? String(c.name).slice(String(c.name).indexOf("\n") + 1)
                : String(c.name || "").trim();
            c.name = deltaWireNameWithSkin(c.name || display || "player", c.skin);
          }

          var isEject = c.type === 3 || !!(c.flags & 32);
          if (isEject) {
            c.type = 3;
            c.playerId = 0;
            c.name = "";
            this._snap(c);
            this._sentCellIds.add(c.id >>> 0);
            continue;
          }
          if (c.type === 1 || c.type === 2 || c.type === 4) {
            this._snap(c);
            this._sentCellIds.add(c.id >>> 0);
            continue;
          }

          if (this._spectating) {
            if (c.type === 0) c.playerId = this._foreignPlayerId(c.id);
            this._snap(c);
            this._sentCellIds.add(c.id >>> 0);
            continue;
          }

          var isOwn = this._ownCellIds.has(c.id >>> 0);
          if (isOwn && owner) {
            c.playerId = owner;
            c.type = 0;
            this.gotOwnCell = true;
            if (this._displayNick || this._playNick) {
              var skinKeep =
                (c.skin && String(c.skin).trim()) ||
                (String(c.name || "").indexOf("\n") >= 0 ? String(c.name).split("\n")[0].trim() : "");
              var shown = this._displayNick || this._playNick;
              c.name = skinKeep ? deltaWireNameWithSkin(shown, skinKeep) : shown;
              this._nameById.set(c.id, c.name);
            }
            this._snap(c);
            var extra = this._ensureClientOwn(c.id);
            for (var xi = 0; xi < extra.length; xi++) seedExtra.push(extra[xi]);
            this._sentCellIds.add(c.id >>> 0);
          } else if (c.type === 0) {
            c.playerId = this._foreignPlayerId(c.id);
            this._snap(c);
            this._sentCellIds.add(c.id >>> 0);
          }
        }

        for (var ri = 0; ri < parsed.removes.length; ri++) {
          var rid = parsed.removes[ri];
          this._colorById.delete(rid);
          this._nameById.delete(rid);
          this._ownCellIds.delete(rid);
          this._agarOwnCreated.delete(rid);
          this._sentCellIds.delete(rid);
          this._cellSnap.delete(rid);
        }
        for (var ei = 0; ei < parsed.eaten.length; ei++) {
          var kid = parsed.eaten[ei].killed;
          this._colorById.delete(kid);
          this._nameById.delete(kid);
          this._ownCellIds.delete(kid);
          this._agarOwnCreated.delete(kid);
          this._sentCellIds.delete(kid);
          this._cellSnap.delete(kid);
        }

        if (this.gotOwnCell && this._ownCellIds.size === 0) {
          this._ownMissingTicks++;
          if (this._ownMissingTicks >= 2) this._markDead();
        } else {
          this._ownMissingTicks = 0;
        }

        var out = seedExtra.length ? seedExtra.slice() : [];
        var deathClr = this._takeDeathClear();
        if (deathClr) out.push(deathClr);
        out.push(deltaBuildAgarUpdate(parsed.eaten, parsed.cells, parsed.removes));
        // Hold only while waiting for first owner border after spawn — never after death.
        if (!this._spectating && this._playNick && !this._ownerBorderOk) {
          for (var wi = 0; wi < out.length; wi++) this._heldWorld.push(out[wi]);
          return [];
        }
        return out;
      }
      if (op === DELTA_OP.LB) {
        return [deltaBuildAgarLb(deltaParseModernLb(buf))];
      }
      if (op === DELTA_OP.LB_PARTY || op === 54) {
        var items = deltaParsePartyLb(buf);
        if (!items.length) return [];
        return [deltaBuildAgarLb(items)];
      }
      if (op === DELTA_OP.CHAT) {
        return deltaChatToAgar(buf);
      }
      // Multibox unit list — same socket, units share one camera (delt.io style).
      if (op === 161) {
        if (buf.length < 2) return [];
        var nUnits = buf[1];
        var ids = [];
        var uoff = 2;
        for (var ui = 0; ui < nUnits && uoff + 4 <= buf.length; ui++) {
          ids.push(buf.readUInt32LE(uoff) >>> 0);
          uoff += 4;
        }
        var unitChange = this.setUnitIds(ids);
        this._mbDenied = false;
        if (!ids.length) return [];
        // Keep _mbPendingSpawn as set by Tab; do not auto-flag on first unit list.
        void unitChange;
        var notice161 = chatSystem(
          "Мультибокс: " + ids.length + " юнит(ов). Tab — переключить.",
          { r: 120, g: 220, b: 160 }
        );
        return notice161 && notice161.length ? [notice161] : [];
      }
      if (op === 162) {
        this._mbDenied = true;
        var notice162 = chatSystem("Мультибокс недоступен на этом сервере.", {
          r: 255,
          g: 120,
          b: 90,
        });
        return notice162 && notice162.length ? [notice162] : [];
      }
      // Do not swallow CLEAR forever — agar.su CLEAR only clears playerCells + death UI.
      if (op === 20) {
        this._markDead();
        var clr = this._takeDeathClear();
        return clr ? [clr] : [Buffer.from([AGAR.CLEAR])];
      }
      return [];
    }

    /** agar.su C2S → Delta plaintext (encrypt in adapter) */
    agarToDelta(buf) {
      if (!buf || !buf.length) return { packets: [], meta: {} };
      var op = buf[0];
      if (op === 254 || op === 255 || op === 253) return { packets: [], meta: {} };
      if (op === AGAR.PING) return { packets: [], meta: {} };

      if (op === 0) {
        var text = "";
        var off = buf.length >= 3 ? 2 : 1;
        while (off + 1 < buf.length) {
          var ch = buf.readUInt16LE(off);
          off += 2;
          if (!ch) break;
          text += String.fromCharCode(ch);
        }
        var wire = String(text.split(":::::")[0] || "").trim();
        // public nick only — never #password / account tokens
        var nick = publicNick(wire) || DELTA_GUEST_NICK;
        if (!nick) {
          this.enterSpectate();
          return { packets: [], meta: { spectate: true } };
        }
        // Alive only while we still have OWN cells — empty set = dead, allow Play respawn.
        if (this.gotOwnCell && this._ownCellIds.size > 0 && !this._spectating) {
          return { packets: [], meta: {} };
        }
        // Death-lock: nick packets while locked are ignored here; encodeNick clears the lock.
        if (this._spawnLock) {
          return { packets: [], meta: {} };
        }
        this.enterPlay(nick, nick);
        return {
          packets: [],
          meta: { play: true, nick: nick, displayNick: nick, authOk: true },
        };
      }
      if (op === 1) {
        if (this._ownCellIds.size > 0 && !this._spectating) {
          return { packets: [], meta: {} };
        }
        this.enterSpectate(false);
        var packets = [];
        if (this._lastMouse) {
          var c1 = this._clampMouseXY(this._lastMouse.x, this._lastMouse.y);
          packets.push(deltaMousePkt(c1.x, c1.y, this.movementKey));
        }
        if (!this._spectateSentToDelta) {
          this._spectateSentToDelta = true;
          packets.push(deltaSpectatePkt());
        }
        return { packets: packets, meta: { spectate: true, spectateClick: true } };
      }
      if (op === 16) {
        var x = 0,
          y = 0;
        if (buf.length >= 17) {
          x = buf.readDoubleLE(1);
          y = buf.readDoubleLE(9);
        } else if (buf.length >= 13) {
          x = buf.readInt32LE(1);
          y = buf.readInt32LE(5);
        } else if (buf.length >= 9) {
          x = buf.readInt32LE(1);
          y = buf.readInt32LE(5);
        }
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return { packets: [], meta: {} };
        }
        var c = this._clampMouseXY(x, y);
        this._lastMouse = { x: c.x, y: c.y };
        return {
          packets: [deltaMousePkt(c.x, c.y, this.movementKey)],
          meta: { mouse: { x: c.x, y: c.y } },
        };
      }
      // Opcode 17 = agar.su CAMERA locally, but client SPLIT uses same opcode outbound.
      // Adapter handles SPLIT specially; this path is fallback only.
      if (op === 17) return { packets: [deltaSplitPkt()], meta: { split: true } };
      // Q (18/19): Delta free-spectate toggle (official client: 18 then 19 ~100ms).
      // Must work in spectate — that is free-cam ("tab"/Q in overview).
      if (op === 18) {
        return { packets: [deltaQDownPkt()], meta: { q: true } };
      }
      if (op === 19) {
        return { packets: [deltaQUpPkt()], meta: { q: false } };
      }
      if (op === 21) return { packets: [deltaEjectPkt()], meta: { eject: true } };
      if (op === 99) {
        var chatText = deltaParseAgarChatOut(buf);
        if (!chatText) return { packets: [], meta: {} };
        // RootSocket path handles real chat — no local fake echo.
        return { packets: [], meta: { chatText: chatText } };
      }
      // Synthetic: Tab multibox (main.js sends op 62 for delta only)
      if (op === 62) {
        return { packets: [deltaRequestUnitPkt()], meta: { requestUnit: true } };
      }
      return { packets: [], meta: {} };
    }
  }

  function deltaSend(state, plain) {
    if (!state || !plain) return;
    if (!state.mp || !state.mp._keysReady) {
      if (!state._pending) state._pending = [];
      state._pending.push(Buffer.from(plain));
      return;
    }
    if (typeof state._send !== "function") return;
    try {
      state._send(toSendBytes(state.mp.encryptOutgoing(plain)));
    } catch (e) {}
  }

  function deltaFlushPending(state) {
    if (!state || !state._pending || !state._pending.length) return;
    var q = state._pending.splice(0);
    for (var i = 0; i < q.length; i++) deltaSend(state, q[i]);
  }

  function deltaSendSpawn(state, nick) {
    if (!state || !state.mp) return false;
    // After death: ignore any spawn until Play (encodeNick clears _spawnLock).
    if (state.mp._spawnLock) return false;
    var now = Date.now();
    // agar.su death/play menu can spam op0 — flooding Delta nick packets kicks the socket.
    if (state._spawnAt && now - state._spawnAt < 2000) return false;
    state._spawnAt = now;
    var n = nick || state.nick || DELTA_GUEST_NICK;
    state.nick = n;
    deltaSend(state, deltaSpawnNick(n));
    var mouse = state.mp._lastMouse;
    if (mouse) deltaSend(state, deltaMousePkt(mouse.x, mouse.y, state.mp.movementKey));
    else deltaSend(state, deltaMousePkt(0, 0, state.mp.movementKey));
    return true;
  }

  /** True if a spawn was sent recently (caller must not resetOwner/enterPlay). */
  function deltaSpawnThrottled(state) {
    if (!state || !state._spawnAt) return false;
    return Date.now() - state._spawnAt < 2000;
  }


  // ═══════════════════════════════════════════════════════════════
  // Shared registry + Bubble (from protocols.js)
  // ═══════════════════════════════════════════════════════════════


  "use strict";

  /** @type {Map<string, object>} */
  const byId = new Map();
  /** @type {object[]} */
  const list = [];

  function register(proto) {
    if (!proto || !proto.id) throw new Error("protocol needs id");
    byId.set(proto.id, proto);
    list.push(proto);
    return proto;
  }

  function resolve(host) {
    const h = String(host || "");
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.id === "agar") continue;
      if (typeof p.match === "function" && p.match(h)) return p;
    }
    return byId.get("agar") || null;
  }

  /** Strip skin line + #password — safe public nick for foreign games. */
  function publicNick(raw) {
    let s = String(raw || "");
    if (s.indexOf("\n") >= 0) s = s.slice(s.indexOf("\n") + 1);
    if (s.charCodeAt(0) === 4) s = s.slice(1);
    const hash = s.indexOf("#");
    if (hash >= 0) s = s.slice(0, hash);
    return s.trim().slice(0, 15);
  }

  function splitSkinNick(raw) {
    const s = String(raw || "");
    if (s.indexOf("\n") < 0) return { skin: "", nick: publicNick(s) };
    const i = s.indexOf("\n");
    return {
      skin: s.slice(0, i).trim().replace(/^%/, ""),
      nick: publicNick(s.slice(i + 1)),
    };
  }

  function prep(n) {
    return new DataView(new ArrayBuffer(n));
  }

  function concatBytes(parts) {
    let len = 0;
    for (let i = 0; i < parts.length; i++) len += parts[i].byteLength || parts[i].length || 0;
    const out = new Uint8Array(len);
    let o = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const u = p instanceof ArrayBuffer ? new Uint8Array(p) : p instanceof DataView ? new Uint8Array(p.buffer, p.byteOffset, p.byteLength) : p;
      out.set(u, o);
      o += u.length;
    }
    return out;
  }

  function writeUtf16(view, offset, str) {
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) view.setUint16(offset + i * 2, s.charCodeAt(i), true);
    view.setUint16(offset + s.length * 2, 0, true);
    return offset + s.length * 2 + 2;
  }

  function utf16Packet(op, str) {
    const s = String(str || "");
    const msg = prep(1 + 2 * s.length + 2);
    msg.setUint8(0, op);
    writeUtf16(msg, 1, s);
    return msg;
  }

  function utf8z(str) {
    const enc = new TextEncoder();
    const raw = enc.encode(String(str || ""));
    const out = new Uint8Array(raw.length + 1);
    out.set(raw, 0);
    return out;
  }

  // —— Agar.su native (trusted) — main.js keeps most logic; this is the fallback marker ——
  register({
    id: "agar",
    label: "Agar.su",
    trusted: true,
    usePow: true,
    useAgarAccountToken: true,
    match: function () {
      return false;
    },
    openSocket: null,
    createState: function () {
      return null;
    },
    onOpen: null,
    encodeNick: null,
    encodeChat: null,
    translateInbound: null,
  });

  // —— Bubble.am (classic Ogar protocol 5) ——
  //
  // Skins (see buble.am main_out.js updateNodes):
  //   flags&0x04 → UTF-8/Latin-1 skin path + 0x00 (NOT in the name field)
  //   name       → UTF-16LE display nick + 0x0000
  // Native draw: node._skin → ./skins/{path}.png  (% prefix stripped at load)
  // Agar.su bridge: merge to "skinPath\nNick" in cell UTF-8 name for our skin loader.
  var BUBBLE_FOOD_MIN_U16 = 12;
  var BUBBLE_FOOD_MAX_U16 = 125;
  var PID_PLACEHOLDER = 0xfffffffe;
  var BUBBLE_SKIN_CDN = "https://buble.am/skins";
  /** Same palette as buble.am account (CONFIG.ACCOUNT_COLORS). */
  var BUBBLE_ACCOUNT_COLORS = [
    "#7bd148", "#5484ed", "#a4bdfc", "#6fe75f", "#51b749",
    "#fbd75b", "#ffb878", "#dc2127", "#dbadff",
  ];
  var BUBBLE_CHAT_LANG_TAG_RE = /\s*:(ru|en|uk|tr|zh|ar|es|pl|de)\s*$/i;

  function bubbleSkinCdnPath(key) {
    return String(key || "")
      .replace(/\.png$/i, "")
      .split("/")
      .map(function (part) {
        return encodeURIComponent(part);
      })
      .join("/");
  }

  /** buble.am display nick from UTF-16 name field (or legacy skin\\nnick in name). */
  function bubbleNickDisplay(rawName) {
    var s = String(rawName || "");
    if (s.indexOf("\n") >= 0) s = s.slice(s.indexOf("\n") + 1);
    if (s.charCodeAt(0) === 4) s = s.slice(1);
    if (s.indexOf(":::") >= 0) s = s.split(":::")[0];
    return s.split("#")[0].replace(/<[^>]*>/g, "").trim();
  }

  /** Normalize skin bytes from flags&4 (buble: mask 0x7F, skip \\x01 sentinel). */
  function normalizeBubbleSkin(rawSkin) {
    var sk = String(rawSkin || "").replace(/\0/g, "").trim();
    if (!sk || sk.charCodeAt(0) === 1) return "";
    if (sk.charCodeAt(0) === 2) return "";
    return sk.replace(/^\/+/, "");
  }

  /** Skin path for CDN — mirrors buble Cell.draw (% stripped, i/ → imgur). */
  function bubbleSkinLoadKey(skinPath) {
    var sk = normalizeBubbleSkin(skinPath);
    if (!sk) return "";
    if (sk.charCodeAt(0) === 37) sk = sk.slice(1);
    return sk.trim();
  }

  function bubbleSkinCdnUrl(skinPath) {
    var key = bubbleSkinLoadKey(skinPath);
    if (!key) return "";
    if (/^i\//i.test(key)) {
      var id = key.slice(2).split(/[\s\n/]/)[0];
      return id ? "https://i.imgur.com/" + id + ".png" : "";
    }
    return BUBBLE_SKIN_CDN + "/" + bubbleSkinCdnPath(key) + ".png";
  }

  /** Prefer flags&4 skin; else first line of skin\\nnick (personal skins use username). */
  function extractBubbleSkin(rawName, skinFromFlags) {
    var fromFlags = bubbleSkinLoadKey(skinFromFlags);
    if (fromFlags) return fromFlags;
    var s = String(rawName || "");
    if (s.indexOf("\n") >= 0) {
      var first = s.split("\n")[0].trim();
      if (first && first.charCodeAt(0) !== 4) return bubbleSkinLoadKey(first);
    }
    return "";
  }

  function stripBubbleChatLangTag(text) {
    return String(text || "").replace(BUBBLE_CHAT_LANG_TAG_RE, "").trimEnd();
  }

  function pickRandomBubbleAccountColor() {
    return BUBBLE_ACCOUNT_COLORS[(Math.random() * BUBBLE_ACCOUNT_COLORS.length) | 0];
  }

  /** POST /api/setcolor — random account color each spawn (like buble.am LK). */
  function setBubbleAccountColor(hex) {
    var color = String(hex || "").trim();
    var tok = bubbleProjectToken();
    if (!color || !tok || typeof fetch !== "function") return Promise.resolve(false);
    return fetch("https://buble.am/api/setcolor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + tok,
      },
      body: JSON.stringify({ color: color }),
    })
      .then(function (r) {
        return !!(r && r.ok);
      })
      .catch(function () {
        return false;
      });
  }

  function rotateBubbleSpawnColor() {
    return setBubbleAccountColor(pickRandomBubbleAccountColor());
  }

  /** Agar.su cell wire name: "{skinPath}\\n{DisplayNick}" (skin from flags, nick from UTF-16). */
  function bubbleWireName(rawName, skinFromFlags) {
    var skinKey = extractBubbleSkin(rawName, skinFromFlags);
    var display = bubbleNickDisplay(rawName);
    if (skinKey && display) return skinKey + "\n" + display;
    if (display) return display;
    return skinKey || String(rawName || "");
  }

  function rememberBubbleSkin(state, displayNick, skinPath) {
    var key = bubbleSkinLoadKey(skinPath);
    var nick = String(displayNick || "").trim().toLowerCase();
    if (!state || !nick || !key) return;
    if (!state.skinByNick) state.skinByNick = Object.create(null);
    state.skinByNick[nick] = key;
  }

  /** Chat/LB label — display nick only (no skin line, avoids double name in UI). */
  function chatBubbleWireName(state, rawName) {
    var display = bubbleNickDisplay(rawName) || "player";
    return display;
  }

  /** Embedded Bubble project JWT. Login API is CORS-blocked from agar.su. */
  var BUBBLE_TOKEN_DEFAULT =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjYxNTMsImlhdCI6MTc4Nzk1MzgwOSwiZXhwIjoxNzg4NTU4NjA5fQ.UuaFOzhOrc_adwJ2bqOvhp5Vb-OcGKxKYjeYTJR7Vg8";

  function bubbleProjectToken() {
    try {
      if (global.BUBBLE_TOKEN) return String(global.BUBBLE_TOKEN).trim();
      var t = localStorage.getItem("bubble_token");
      if (t) return String(t).trim();
    } catch (e) {}
    return BUBBLE_TOKEN_DEFAULT;
  }

  function saveBubbleToken(tok) {
    var clean = String(tok || "").trim();
    try {
      if (clean) localStorage.setItem("bubble_token", clean);
    } catch (e) {}
    global.BUBBLE_TOKEN = clean;
  }

  /** Bubble requires project JWT — guests are kicked. Never uses agar.su LK. */
  function ensureBubbleAuth() {
    var existing = bubbleProjectToken();
    saveBubbleToken(existing);
    return rotateBubbleSpawnColor().then(function () {
      return existing;
    });
  }

  function bubbleAuthPacket(token) {
    var t = String(token || "").trim();
    var bytes = new Uint8Array(1 + t.length + 1);
    bytes[0] = 200;
    for (var i = 0; i < t.length; i++) bytes[1 + i] = t.charCodeAt(i) & 255;
    bytes[1 + t.length] = 0;
    return bytes;
  }

  function buildAgarBorder(minx, miny, maxx, maxy, ownerPid) {
    var msg = prep(1 + 32 + 2 + 2 + 4);
    var o = 0;
    msg.setUint8(o++, 64);
    msg.setFloat64(o, minx, true); o += 8;
    msg.setFloat64(o, miny, true); o += 8;
    msg.setFloat64(o, maxx, true); o += 8;
    msg.setFloat64(o, maxy, true); o += 8;
    msg.setUint16(o, BUBBLE_FOOD_MIN_U16, true); o += 2;
    msg.setUint16(o, BUBBLE_FOOD_MAX_U16, true); o += 2;
    msg.setUint32(o, ownerPid >>> 0, true);
    return msg;
  }

  function buildAgarCamera(x, y, size) {
    var msg = prep(13);
    msg.setUint8(0, 17);
    msg.setFloat32(1, x, true);
    msg.setFloat32(5, y, true);
    msg.setFloat32(9, size || 1, true);
    return msg;
  }

  function buildAgarLb(items) {
    var parts = [new Uint8Array([49])];
    var n = Math.min((items || []).length, 10);
    var count = prep(4);
    count.setUint32(0, n, true);
    parts.push(count);
    for (var i = 0; i < n; i++) {
      var it = items[i];
      var idv = prep(4);
      idv.setUint32(0, (it.id || 0) >>> 0, true);
      parts.push(idv);
      var name = bubbleNickDisplay(it.name || "");
      var nv = prep(2 * name.length + 2);
      writeUtf16(nv, 0, name);
      parts.push(nv);
      var xp = prep(4);
      xp.setUint32(0, 0, true);
      parts.push(xp);
    }
    return new DataView(concatBytes(parts).buffer);
  }

  function buildAgarChat(r, g, b, name, text) {
    var nm = bubbleNickDisplay(name) || String(name || "player").slice(0, 80);
    var tx = stripBubbleChatLangTag(String(text || "")).slice(0, 200);
    var msg = prep(1 + 1 + 3 + 4 + 2 + 2 * nm.length + 2 + 2 * tx.length + 2);
    var o = 0;
    msg.setUint8(o++, 99);
    msg.setUint8(o++, 0);
    msg.setUint8(o++, r & 255);
    msg.setUint8(o++, g & 255);
    msg.setUint8(o++, b & 255);
    msg.setUint32(o, 0, true); o += 4; // xp
    msg.setUint16(o, 0, true); o += 2; // pid
    o = writeUtf16(msg, o, nm);
    writeUtf16(msg, o, tx);
    return msg;
  }

  function buildAgarUpdate(eaten, cells, removes) {
    var parts = [new Uint8Array([16])];
    for (var i = 0; i < eaten.length; i++) {
      var e = eaten[i];
      var ev = prep(8);
      ev.setUint32(0, e.killed >>> 0, true);
      ev.setUint32(4, e.killer >>> 0, true);
      parts.push(ev);
    }
    var z = prep(4);
    z.setUint32(0, 0, true);
    parts.push(z);

    for (var c = 0; c < cells.length; c++) {
      var cell = cells[c];
      var head = prep(4 + 1);
      head.setUint32(0, cell.id >>> 0, true);
      head.setUint8(4, cell.type & 255);
      parts.push(head);
      if (cell.type !== 1) {
        if (cell.type === 0) {
          var pid = prep(4);
          pid.setUint32(0, (cell.playerId || cell.id) >>> 0, true);
          parts.push(pid);
        }
        var body = prep(4 + 4 + 2);
        body.setInt32(0, cell.x | 0, true);
        body.setInt32(4, cell.y | 0, true);
        body.setUint16(8, Math.max(0, Math.min(65535, cell.size | 0)), true);
        parts.push(body);
      }
      var rgb = new Uint8Array([cell.r & 255, cell.g & 255, cell.b & 255, cell.spiked & 255]);
      parts.push(rgb);
      parts.push(utf8z(cell.name || ""));
      parts.push(new Uint8Array([0])); // no sticker marker
    }
    var z2 = prep(4);
    z2.setUint32(0, 0, true);
    parts.push(z2);
    for (var r = 0; r < removes.length; r++) {
      var rv = prep(4);
      rv.setUint32(0, removes[r] >>> 0, true);
      parts.push(rv);
    }
    return new DataView(concatBytes(parts).buffer);
  }

  function parseClassicUpdate(buf, start) {
    var len = buf.byteLength;
    var off = start;
    if (off + 2 > len) return null;
    var eatN = buf.getUint16(off, true);
    off += 2;
    var eaten = [];
    for (var i = 0; i < eatN && off + 8 <= len; i++) {
      var killer = buf.getUint32(off, true);
      off += 4;
      var killed = buf.getUint32(off, true);
      off += 4;
      eaten.push({ killer: killer, killed: killed });
    }
    var cells = [];
    while (off + 4 <= len) {
      var id = buf.getUint32(off, true);
      off += 4;
      if (id === 0) break;
      if (off + 11 > len) break;
      var x = buf.getInt32(off, true); off += 4;
      var y = buf.getInt32(off, true); off += 4;
      var size = buf.getInt16(off, true); off += 2;
      var r = buf.getUint8(off++);
      var g = buf.getUint8(off++);
      var b = buf.getUint8(off++);
      var flags = buf.getUint8(off++);
      if (flags & 2 && off + 4 <= len) off += 4;
      var skin = "";
      if (flags & 4) {
        while (off < len) {
          var ch = buf.getUint8(off++) & 0x7f;
          if (!ch) break;
          skin += String.fromCharCode(ch);
        }
      }
      var name = "";
      while (off + 1 < len) {
        var c = buf.getUint16(off, true);
        off += 2;
        if (!c) break;
        name += String.fromCharCode(c);
      }
      var isVirus = !!(flags & 1);
      var isEjected = !!(flags & 32);
      var type = 0;
      if (isVirus) type = 2;
      else if (isEjected) type = 3;
      else if (!String(name || "").trim()) type = 4;

      cells.push({
        id: id,
        x: x,
        y: y,
        size: size,
        r: r,
        g: g,
        b: b,
        flags: flags,
        name: name,
        skin: skin,
        type: type,
      });
    }
    var removes = [];
    if (off + 4 <= len) {
      var remN = buf.getUint32(off, true) >>> 0;
      off += 4;
      var maxByBytes = Math.floor((len - off) / 4);
      if (remN > maxByBytes) remN = maxByBytes;
      if (remN > 20000) remN = 20000;
      for (var j = 0; j < remN && off + 4 <= len; j++) {
        removes.push(buf.getUint32(off, true) >>> 0);
        off += 4;
      }
    }
    return { eaten: eaten, cells: cells, removes: removes };
  }

  function ensureOwnerPid(state, cellId) {
    if (state.ownerPid) return state.ownerPid >>> 0;
    var cell = cellId >>> 0;
    var pid = (0xbb000000 ^ cell ^ ((Date.now() & 0xffff) << 8)) >>> 0;
    if (!pid || pid === cell) pid = (0xbb000001 + (cell & 0xffff)) >>> 0;
    state.ownerPid = pid;
    return pid;
  }

  function borderPackets(state) {
    if (!state.border) return [];
    var owner = state.ownerPid || PID_PLACEHOLDER;
    if (state.ownerBorderOk && owner === state.borderOwnerSent) return [];
    state.ownerBorderOk = true;
    state.borderOwnerSent = owner;
    return [
      buildAgarBorder(
        state.border.minx,
        state.border.miny,
        state.border.maxx,
        state.border.maxy,
        owner
      ),
    ];
  }

  register({
    id: "bubble",
    label: "Bubble.am",
    trusted: false,
    usePow: false,
    useAgarAccountToken: false,
    match: function (host) {
      return /buble\.am|bubble\.am/i.test(String(host || ""));
    },
    /** Bubble needs ~150ms after JWT before spawn is accepted. */
    spawnDelayMs: 150,
    openSocket: function (wsUrl) {
      // Plain WS — no agar.su subprotocol, no query tokens.
      var ws = new WebSocket(String(wsUrl).split("?")[0]);
      ws.binaryType = "arraybuffer";
      return ws;
    },
    /** Prefetch Bubble JWT before WS open (required — guest get kicked). */
    ensureAuth: function () {
      return ensureBubbleAuth();
    },
    createState: function () {
      return {
        ownCells: new Set(),
        ownerPid: 0,
        border: null,
        ownerBorderOk: false,
        borderOwnerSent: 0,
        mapBorderSent: false,
        skinByNick: Object.create(null),
      };
    },
    onOpen: function (send) {
      var proto = prep(5);
      proto.setUint8(0, 254);
      proto.setUint32(1, 5, true);
      send(proto);
      var key = prep(5);
      key.setUint8(0, 255);
      key.setUint32(1, 0, true);
      send(key);
      // Required Bubble project JWT (not agar.su LK).
      var tok = bubbleProjectToken();
      if (tok) send(bubbleAuthPacket(tok));
      else console.warn("[bubble] no project token — server will kick guest");
    },
    /** Always public nick only — strips #pass / agar credentials. */
    encodeNick: function (rawNick) {
      rotateBubbleSpawnColor();
      var nick = publicNick(rawNick) || "agar.su";
      return [utf16Packet(0, nick)];
    },
    encodeSpectate: function () {
      // Bubble: op 2 (spectate nick) + op 1 (enter overview) — same as buble.am client.
      var nick = "Spectator";
      try {
        var el = typeof document !== "undefined" ? document.getElementById("nick") : null;
        if (el && el.value) nick = publicNick(el.value) || nick;
      } catch (e) {}
      return [utf16Packet(2, nick), new Uint8Array([1])];
    },
    encodeChat: function (text) {
      var s = stripBubbleChatLangTag(String(text || "")).slice(0, 200);
      if (!s) return [];
      // Bubble: [99][0][utf16…] — needs Bubble project token for delivery, never agar.su LK.
      var msg = prep(2 + 2 * s.length);
      msg.setUint8(0, 99);
      msg.setUint8(1, 0);
      for (var i = 0; i < s.length; i++) msg.setUint16(2 + 2 * i, s.charCodeAt(i), true);
      return [msg];
    },
    encodeMouse: function (x, y) {
      var msg = prep(21);
      msg.setUint8(0, 16);
      msg.setFloat64(1, Number(x) || 0, true);
      msg.setFloat64(9, Number(y) || 0, true);
      msg.setUint32(17, 0, true);
      return [msg];
    },
    translateInbound: function (dataView, state) {
      if (!state) state = this.createState();
      var buf = dataView;
      var off = 0;
      if (buf.byteLength < 1) return [];
      if (buf.getUint8(0) === 240 && buf.byteLength >= 5) off = 5;
      var op = buf.getUint8(off++);
      var out = [];

      if (op === 64) {
        if (buf.byteLength < off + 32) return [];
        state.border = {
          minx: buf.getFloat64(off, true),
          miny: buf.getFloat64(off + 8, true),
          maxx: buf.getFloat64(off + 16, true),
          maxy: buf.getFloat64(off + 24, true),
        };
        // First map border → unlock agar.su handshake / nick send.
        if (!state.mapBorderSent) {
          state.mapBorderSent = true;
          out.push(
            buildAgarBorder(
              state.border.minx,
              state.border.miny,
              state.border.maxx,
              state.border.maxy,
              state.ownerPid || PID_PLACEHOLDER
            )
          );
          out.push(new DataView(new Uint8Array([17]).buffer)); // camera stub → agar uses posSize
        }
        return out;
      }

      if (op === 32) {
        if (buf.byteLength < off + 4) return [];
        var ownId = buf.getUint32(off, true) >>> 0;
        state.ownCells.add(ownId);
        ensureOwnerPid(state, ownId);
        return borderPackets(state);
      }

      if (op === 17) {
        // Bubble camera every tick — ignore while we have own cells (agar.su locks zoom otherwise).
        if (state.ownCells.size > 0) return [];
        if (buf.byteLength < off + 12) return [];
        return [
          buildAgarCamera(
            buf.getFloat32(off, true),
            buf.getFloat32(off + 4, true),
            buf.getFloat32(off + 8, true)
          ),
        ];
      }

      if (op === 20) {
        // Per-socket death only (direct Bubble). Forward CLEAR.
        state.ownCells.clear();
        state.ownerPid = 0;
        state.ownerBorderOk = false;
        state.borderOwnerSent = 0;
        state.skinByNick = Object.create(null);
        return [new DataView(new Uint8Array([20]).buffer)];
      }

      if (op === 16) {
        var parsed = parseClassicUpdate(buf, off);
        if (!parsed) return [];
        var owner = state.ownerPid >>> 0;
        var cells = [];
        for (var i = 0; i < parsed.cells.length; i++) {
          var c = parsed.cells[i];
          var size = c.size | 0;
          if (size < 1 || size > 8000) continue;
          var rawName = c.name || "";
          var skinRaw = c.skin || "";
          var skinKey = extractBubbleSkin(rawName, skinRaw);
          var displayNick = bubbleNickDisplay(rawName);
          var wireName = skinKey && displayNick ? skinKey + "\n" + displayNick : displayNick || skinKey || rawName;
          if (skinKey && displayNick && c.type === 0) {
            rememberBubbleSkin(state, displayNick, skinKey);
          }
          var isOwn = state.ownCells.has(c.id >>> 0);
          var spiked = 0;
          if (c.type === 2 || (c.flags & 1)) spiked |= 1;
          if (c.type === 3 || (c.flags & 32)) spiked |= 32;
          if (c.flags & 16) spiked |= 16;
          var row = {
            id: c.id,
            type: c.type,
            x: c.x,
            y: c.y,
            size: size,
            r: c.type === 2 ? 255 : c.r,
            g: c.type === 2 ? 153 : c.g,
            b: c.type === 2 ? 0 : c.b,
            spiked: spiked,
            name: wireName,
            playerId: 0,
          };
          if (isOwn && owner) {
            row.type = 0;
            row.playerId = owner;
          } else if (row.type === 0) {
            row.playerId = (c.id >>> 0) || 1;
            if (owner && row.playerId === owner) row.playerId = (row.playerId ^ 0x00ffffff) >>> 0 || 1;
          }
          cells.push(row);
        }
        for (var k = 0; k < parsed.removes.length; k++) state.ownCells.delete(parsed.removes[k]);
        for (var e = 0; e < parsed.eaten.length; e++) state.ownCells.delete(parsed.eaten[e].killed);

        out.push(buildAgarUpdate(parsed.eaten, cells, parsed.removes));
        if (state.ownCells.size > 0 && owner && !state.ownerBorderOk) {
          out = borderPackets(state).concat(out);
        }
        return out;
      }

      if (op === 49) {
        if (buf.byteLength < off + 4) return [];
        var n = Math.min(buf.getUint32(off, true), 20);
        off += 4;
        var items = [];
        for (var li = 0; li < n && off + 6 <= buf.byteLength; li++) {
          var id = buf.getUint32(off, true);
          off += 4;
          var name = "";
          while (off + 1 < buf.byteLength) {
            var ch2 = buf.getUint16(off, true);
            off += 2;
            if (!ch2) break;
            name += String.fromCharCode(ch2);
          }
          items.push({ id: id, name: bubbleNickDisplay(name) || name });
        }
        return [buildAgarLb(items)];
      }

      if (op === 99) {
        if (buf.byteLength < off + 4) return [];
        var flags = buf.getUint8(off++);
        var r = buf.getUint8(off++);
        var g = buf.getUint8(off++);
        var b = buf.getUint8(off++);
        var cname = "";
        while (off + 1 < buf.byteLength) {
          var cn = buf.getUint16(off, true);
          off += 2;
          if (!cn) break;
          cname += String.fromCharCode(cn);
        }
        var ctext = "";
        while (off + 1 < buf.byteLength) {
          var ct = buf.getUint16(off, true);
          off += 2;
          if (!ct) break;
          ctext += String.fromCharCode(ct);
        }
        if (flags & 0x80) return [];
        return [buildAgarChat(r || 100, g || 200, b || 255, chatBubbleWireName(state, cname), ctext)];
      }

      // 90 and others — ignore
      return [];
    },
  });

  // —— Agar.live via agarlivebot bridge (xn--bdk.pw:6015) ——
  // Bot speaks live upstream (proto v4, nick 107, token 200, subprotocol binary)
  // and already converts ↔ agar.su. Browser must NOT re-parse as classic Ogar —
  // that caused RangeError in updateNodes / parseClassicUpdate.
  // Client: remap UI host pop1.agar.live → wss://xn--bdk.pw:6015/pop1, pass-through wire.
  var AGARLIVE_PROXY = "wss://xn--bdk.pw:6015";

  function agarliveRoomFromHost(hostOrUrl) {
    var h = String(hostOrUrl || "")
      .replace(/^wss?:\/\//i, "")
      .split("?")[0]
      .toLowerCase();
    var m = h.match(/xn--bdk\.pw:6015\/(pop\d+|ffa\d+)/);
    if (m) return m[1];
    m = h.match(/^(pop\d+|ffa\d+)\.agar\.live/);
    if (m) return m[1];
    return "";
  }

  function agarliveWsUrl(wsUrl) {
    var room = agarliveRoomFromHost(wsUrl);
    if (room) return AGARLIVE_PROXY + "/" + room;
    var h = String(wsUrl || "").replace(/^wss?:\/\//i, "").split("?")[0];
    return "wss://" + h;
  }

  register({
    id: "agarlive",
    label: "Agar.live",
    trusted: false,
    usePow: false,
    useAgarAccountToken: false,
    match: function (host) {
      var h = String(host || "");
      return /(?:^|[.\/])agar\.live(?::|\/|$)/i.test(h) || /xn--bdk\.pw:6015\b/i.test(h);
    },
    openSocket: function (wsUrl) {
      // Bridge accepts plain WS (no agar.su subprotocol) — same as bot smoke tests.
      var ws = new WebSocket(agarliveWsUrl(wsUrl));
      ws.binaryType = "arraybuffer";
      return ws;
    },
    createState: function () {
      return {
        destroy: function () {},
      };
    },
    // Pass-through: main.js agar handshake + packets; bridge translates to live.
    onOpen: null,
    encodeOutbound: null,
    translateInbound: null,
  });


  // ═══════════════════════════════════════════════════════════════
  // AgarZ rooms (optional helpers)
  // ═══════════════════════════════════════════════════════════════
  var AGARZ_ROOMS = {
    tatil: 1013,
    gsz1: 1271,
    ffa1: 1042,
    ffa4: 1004,
    ffa5: 1005,
    ffa57: 1224,
    ffa21: 1232,
    ffa54: 1242,
  };

  function agarzWsUrl(portOrKey) {
    var k = String(portOrKey || "").toLowerCase();
    if (AGARZ_ROOMS[k]) return "wss://ws.agarz.com:" + AGARZ_ROOMS[k];
    if (/^\d+$/.test(k)) return "wss://ws.agarz.com:" + k;
    if (/^wss?:\/\//i.test(k)) return k;
    return "wss://ws.agarz.com:" + (AGARZ_ROOMS.tatil || 1013);
  }

  function agarzSend(state, buf) {
    if (!state || typeof state._send !== "function" || !buf) return;
    try {
      state._send(toSendBytes(buf));
    } catch (e) {}
  }

  function agarzStopPing(state) {
    if (state && state._pingTimer) {
      clearInterval(state._pingTimer);
      state._pingTimer = null;
    }
  }

  function agarzStartPing(state) {
    if (!state || state._pingTimer) return;
    state._pingTimer = setInterval(function () {
      if (!state._send) return;
      var elapsed = Date.now() - (state.sessionStartAt || Date.now());
      agarzSend(state, agarzBuildPing(elapsed));
    }, 3000);
  }

  function agarzFinishSpawn(state) {
    if (!state || state.spawnQueued) return;
    var nick = state.agarzNick || state._agarzNick;
    if (!nick) return;
    state.spawnQueued = true;
    state._spawnQueued = true;
    agarzSend(state, agarzBuildSound(1));
    agarzSend(state, agarzBuildSetTeam(""));
    agarzSend(state, agarzBuildSetSkin(""));
    agarzSend(state, agarzBuildOp(AGARZ_C2S.SCOPE_AROUND_ENABLE));
    agarzSend(state, agarzBuildSetName(nick));
    agarzSend(state, agarzBuildOp(AGARZ_C2S.SPAWN_PLAYER));
    agarzSend(state, agarzBuildSetName(nick));
    state.spawnedAt = Date.now();
  }

  function agarzOnReadyOrOpen(state) {
    if (!state || !state.ready) return;
    if (!state.langSent) {
      state.langSent = true;
      agarzSend(state, agarzBuildSetLang("tr"));
    }
    if (state.mode === "play" && state.wantPlay && (state.agarzNick || state._agarzNick)) {
      if (state.needsNickToRespawn) return;
      if (state.guestSent) return;
      state.guestSent = true;
      state._guestSent = true;
      state.authPacketSent = true;
      agarzSend(state, agarzBuildOp(AGARZ_C2S.PLAY_AS_GUEST_REQUEST));
      return;
    }
    if (state.mode === "spectate" || state.wantSpectate || state.mode === "connect") {
      if (!state.spectateSent) {
        state.spectateSent = true;
        state._spectateSent = true;
        state.guestSent = true;
        state._guestSent = true;
        agarzSend(state, agarzBuildOp(AGARZ_C2S.SCOPE_AROUND_ENABLE));
        agarzSend(state, agarzBuildOp(AGARZ_C2S.SPECTATE_REQUEST));
      }
    }
  }

  function agarzOnInfoReady(state) {
    if (!state) return;
    if (state.mode === "spectate" || state.wantSpectate) {
      var sn = state.agarzNick || state._agarzNick;
      if (sn) agarzSend(state, agarzBuildSetName(sn));
      agarzSend(state, agarzBuildOp(AGARZ_C2S.SPECTATE_REQUEST));
      return;
    }
    if (!(state.mode === "play" && state.wantPlay && (state.agarzNick || state._agarzNick))) return;
    if (state.needsNickToRespawn) return;
    if (state.spawnQueued) return;
    agarzFinishSpawn(state);
  }

  function agarzDeathPackets(state) {
    var out = [];
    var mp = state.mp;
    var killIds = [];
    if (mp && mp._ownCellIds && mp._ownCellIds.size) {
      mp._ownCellIds.forEach(function (id) {
        killIds.push(id >>> 0);
      });
    }
    if (killIds.length) {
      var buf = Buffer.allocUnsafe(1 + 4 + 4 + killIds.length * 4);
      var o = 0;
      buf[o++] = 16;
      buf.writeUInt32LE(0, o);
      o += 4;
      buf.writeUInt32LE(0, o);
      o += 4;
      for (var i = 0; i < killIds.length; i++) {
        buf.writeUInt32LE(killIds[i], o);
        o += 4;
      }
      out.push(toDataView(buf));
    }
    out.push(new DataView(new Uint8Array([20]).buffer));
    return out;
  }

  function agarzMapOutbound(packets, state) {
    var up = [];
    var local = [];
    for (var i = 0; i < packets.length; i++) {
      var pkt = packets[i];
      if (!pkt || !pkt.length) continue;
      // Opcode 17: local CAMERA stubs only (from spectate). Client SPLIT is handled in encodeOutbound.
      // Chat notices (99) stay local.
      if (pkt[0] === 99 || (pkt[0] === AGAR.CAMERA && pkt.length === 1)) {
        local.push(toDataView(pkt));
      } else {
        up.push(toSendBytes(pkt));
      }
    }
    for (var u = 0; u < up.length; u++) agarzSend(state, up[u]);
    return local;
  }

  register({
    id: "agarz",
    label: "AgarZ",
    trusted: false,
    usePow: false,
    useAgarAccountToken: false,
    match: function (host) {
      var h = String(host || "").toLowerCase();
      // Direct AgarZ game hosts — NOT legacy sixz.ru bot proxy
      if (/sixz\.ru/.test(h)) return false;
      return /(?:^|[.\/])agarz\.com(?::|\/|$)/.test(h) || /ws\.agarz\.com/.test(h);
    },
    openSocket: function (wsUrl) {
      var ws = new WebSocket(String(wsUrl).split("?")[0]);
      ws.binaryType = "arraybuffer";
      return ws;
    },
    ensureAuth: function () {
      return Promise.resolve(null);
    },
    createState: function () {
      var mp = new MultiProtocol();
      mp.markAgar();
      mp.agarHandshake = true;
      var state = {
        mp: mp,
        mode: "connect",
        ready: false,
        guestSent: false,
        spawnQueued: false,
        sessionStartAt: Date.now(),
        langSent: false,
        spectateSent: false,
        authPacketSent: false,
        pendingInfoReady: false,
        agarzNick: "",
        displayNick: "",
        wantPlay: false,
        wantSpectate: false,
        needsNickToRespawn: false,
        _send: null,
        _pingTimer: null,
        // bot-shaped fields for MultiProtocol.agarToAgarz
        _mode: "connect",
        _wantPlay: false,
        _wantSpectate: false,
        _spectateArmed: false,
        _spectateSent: false,
        _agarzNick: "",
        _displayNick: "",
        _lastMouse: null,
        _guestSent: false,
        _spawnQueued: false,
        _authOk: true,
        _sendGame: null,
        destroy: function () {
          agarzStopPing(this);
          if (this.mp && this.mp._ejectStopTimer) {
            clearTimeout(this.mp._ejectStopTimer);
            this.mp._ejectStopTimer = null;
          }
          this._send = null;
        },
      };
      state._sendGame = function (buf) {
        agarzSend(state, buf);
      };
      return state;
    },
    onOpen: function (send, state) {
      if (!state) return;
      state._send = send;
      state._sendGame = function (buf) {
        agarzSend(state, buf);
      };
      state.sessionStartAt = Date.now();
      state.langSent = false;
      state.ready = false;
      if (state.mp) state.mp._ready = false;
      agarzSend(state, agarzBuildBegin(AGARZ_CLIENT_VERSION));
      agarzStartPing(state);
    },
    encodeNick: function (rawNick, state) {
      if (!state) return [];
      var nick = publicNick(rawNick) || "Player Agarsu";
      nick = nick.slice(0, 15);
      state.agarzNick = nick;
      state.displayNick = nick;
      state._agarzNick = nick;
      state._displayNick = nick;
      state.mp._pendingNick = nick;
      state.mp._spawnNick = nick;
      state.mp.spectateZoom = false;
      state.mp._spectateArmed = false;
      state.mp.spectateTargetId = 0;
      state.mp._holdWorldUntilOwner = true;
      state.mode = "play";
      state._mode = "play";
      state.wantPlay = true;
      state._wantPlay = true;
      state.wantSpectate = false;
      state._wantSpectate = false;
      state.needsNickToRespawn = false;
      state.spawnQueued = false;
      state._spawnQueued = false;
      state.guestSent = false;
      state._guestSent = false;
      state.mp.gotOwnCell = false;
      state.mp._ownerLocked = false;
      if (typeof state.mp._wipeTrackedCells === "function") state.mp._wipeTrackedCells();
      if (state.ready) agarzOnReadyOrOpen(state);
      return [];
    },
    encodeSpectate: function (state, optionalBuf) {
      if (!state) return [];
      if (state.mode === "play" || state.wantPlay) return [];
      state.mode = "spectate";
      state._mode = "spectate";
      state.wantPlay = false;
      state._wantPlay = false;
      state.wantSpectate = true;
      state._wantSpectate = true;
      state.spawnQueued = false;
      state.mp.spectateZoom = true;
      state.mp.gotOwnCell = false;
      state.mp._ownerLocked = false;
      state.mp._spectateArmed = true;
      state._spectateArmed = true;
      var buf = optionalBuf
        ? Buffer.from(
            optionalBuf instanceof DataView
              ? new Uint8Array(optionalBuf.buffer, optionalBuf.byteOffset, optionalBuf.byteLength)
              : optionalBuf
          )
        : Buffer.from([1]);
      var pkts = state.mp._agarSpectate(state, buf);
      var local = agarzMapOutbound(pkts, state);
      local.push(new DataView(new Uint8Array([17]).buffer));
      return local;
    },
    encodeChat: function (text, state) {
      // Same UX as bot — local notice, do not hit AgarZ
      var notice = chatSystem(
        "Тут пока нельзя писать в чат. Но можете менять ники — вас так поймут =)",
        { r: 255, g: 180, b: 70 }
      );
      return notice && notice.length ? [toDataView(notice)] : [];
    },
    encodeOutbound: function (buf, state) {
      if (!state || !buf) return [];
      var u8 =
        buf instanceof DataView
          ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
          : buf instanceof ArrayBuffer
            ? new Uint8Array(buf)
            : buf;
      var packet = Buffer.from(u8);
      if (!packet.length) return [];
      var op = packet[0];
      if (op === 254 || op === 255) {
        state.mp.markAgar();
        if (op === 255) {
          var hs = state.mp.onAgarHandshake() || [];
          return hs.map(toDataView);
        }
        return [];
      }
      if (op === 2) return [toDataView(state.mp.agarPong())];
      if (op === 0) {
        this.encodeNick(
          (function () {
            var text = "";
            for (var p = 2; p + 1 < packet.length; p += 2) {
              var c = packet.readUInt16LE(p);
              if (!c) break;
              text += String.fromCharCode(c);
            }
            return text;
          })(),
          state
        );
        return [];
      }
      if (op === 1) return this.encodeSpectate(state, packet);
      // agar.su SPLIT (17) == AgarZ SPLIT (0x11) == AGAR.CAMERA (17).
      // Must send upstream here — agarzMapOutbound treats bare [17] as local camera stub.
      if (op === 17) {
        agarzSend(state, agarzBuildOp(AGARZ_C2S.SPLIT));
        return [];
      }
      var out = state.mp.agarToAgarz(packet, state) || [];
      return agarzMapOutbound(out, state);
    },
    translateInbound: function (dataView, state) {
      if (!state) state = this.createState();
      if (!dataView || dataView.byteLength < 1) return [];
      var raw = Buffer.from(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength));
      var op = raw[0];
      var out = [];

      // —— Control plane ——
      if (op === AGARZ_S2C.SYNC_ASSETS) {
        try {
          var reply = agarzReplySyncAssets(raw);
          if (reply) agarzSend(state, reply);
        } catch (e) {
          console.warn("[agarz] ASSET PoW fail", e && e.message);
        }
        return [];
      }

      if (op === AGARZ_S2C.READY_TO_START) {
        state.ready = true;
        state.mp._ready = true;
        agarzOnReadyOrOpen(state);
        return [];
      }

      if (op === AGARZ_S2C.INFO && raw.length >= 2) {
        var info = raw.length >= 5 ? raw.readUInt32LE(1) : raw[1];
        if (info === AGARZ_INFO.READY_TO_PLAY_OR_SPECTATE) {
          state.ready = true;
          state.mp._ready = true;
          agarzOnInfoReady(state);
        }
        if (info === AGARZ_INFO.PLAY_BEGIN) {
          var pn = state.agarzNick || state._agarzNick;
          if (pn && state.mode === "play") agarzSend(state, agarzBuildSetName(pn));
        }
        if (info === AGARZ_INFO.YOU_DEAD) {
          agarzSend(state, agarzBuildOp(AGARZ_C2S.EMITFOOD_STOP));
          state.mp.gotOwnCell = false;
          state.mp._ownerLocked = false;
          state.spawnQueued = false;
          state._spawnQueued = false;
          state.guestSent = false;
          state._guestSent = false;
          state.needsNickToRespawn = true;
          state.wantPlay = false;
          state._wantPlay = false;
          state.wantSpectate = true;
          state._wantSpectate = true;
          state.mode = "spectate";
          state._mode = "spectate";
          out = out.concat(agarzDeathPackets(state));
          if (typeof state.mp._wipeTrackedCells === "function") state.mp._wipeTrackedCells();
          state.mp._clientOwnerPid = 0;
          state.mp.pid = 0;
          state.mp._spectateArmed = true;
          state._spectateArmed = true;
          agarzSend(state, agarzBuildOp(AGARZ_C2S.SPECTATE_REQUEST));
          return out;
        }
        return out;
      }

      if (op === AGARZ_S2C.VALUE_UINT32 && raw.length >= 7) {
        var key = raw.readUInt16LE(1);
        var val = raw.readUInt32LE(3);
        if (key === 0xa) {
          var elapsed = Date.now() - (state.sessionStartAt || Date.now());
          var rtt = elapsed - val;
          if (rtt > 500) agarzSend(state, agarzBuildPingLog(rtt));
        }
        return [];
      }

      if (op === AGARZ_S2C.SERVER_VERSION && raw.length >= 5) {
        var ver = raw.readInt32LE(1);
        if (ver === 1332175218) {
          var notice = state.mp.systemNotice("AgarZ room updating — try later", "error");
          return notice && notice.length ? [toDataView(notice)] : [];
        }
        return [];
      }

      // —— World / LB / chat ——
      var translated = state.mp.agarzToAgar(raw) || [];
      for (var i = 0; i < translated.length; i++) out.push(toDataView(translated[i]));
      return out;
    },
  });

  // —— Delta RootSocket chat (wss://chat.delt.io/ws) ——
  // Official client never writes game-op 99 for C2S; chat goes through this relay.
  // writeUTF16StringLength = u8 length + utf16 chars (NOT u16 length).
  var DELTA_CHAT_WS = "wss://chat.delt.io/ws";
  var deltaRootChat = {
    ws: null,
    ready: false,
    connectionID: 0,
    playerID: 0,
    roomHost: "",
    deliver: null,
    nick: "",
    _tabId: 0,
    _openedAt: 0,
  };

  function deltaUtf16Len(str) {
    var s = String(str || "").slice(0, 255);
    var b = Buffer.allocUnsafe(1 + 2 * s.length);
    b[0] = s.length;
    for (var i = 0; i < s.length; i++) b.writeUInt16LE(s.charCodeAt(i), 1 + 2 * i);
    return b;
  }

  function deltaUtf16Z(str) {
    var s = String(str || "");
    var b = Buffer.allocUnsafe(2 * (s.length + 1));
    for (var i = 0; i < s.length; i++) b.writeUInt16LE(s.charCodeAt(i), i * 2);
    b.writeUInt16LE(0, s.length * 2);
    return b;
  }

  function deltaRootSend(buf) {
    if (!deltaRootChat.ws || deltaRootChat.ws.readyState !== 1) return false;
    try {
      deltaRootChat.ws.send(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      return true;
    } catch (_) {
      return false;
    }
  }

  /** serverToken = btoa(hostname) — see delt.io sourceToToken. */
  function deltaRootServerToken(host) {
    var h = String(host || "").replace(/^wss?:\/\//i, "").split(/[/?]/)[0];
    if (!h) h = "ffa.delt.io";
    try {
      if (typeof btoa === "function") return btoa(h);
    } catch (_) {}
    return Buffer.from(h, "utf8").toString("base64");
  }

  function deltaRootSendRoom(host) {
    var h = String(host || "").replace(/^wss?:\/\//i, "").split(/[/?]/)[0] || "ffa.delt.io";
    deltaRootChat.roomHost = h;
    // sendRoom(serverToken, clanTag, gameMode, region, partyToken)
    // wire flags: 1 token, 2 clan, 4 gameMode, 8 region, 16 party
    var parts = [Buffer.from([9, 0])];
    var flags = 0;
    function add(bit, str) {
      flags |= bit;
      parts.push(deltaUtf16Z(str));
    }
    add(1, deltaRootServerToken(h));
    add(2, "");
    add(4, /party/i.test(h) ? ":party" : ":ffa");
    add(8, "EU");
    var pkt = Buffer.concat(parts);
    pkt[1] = flags;
    deltaRootSend(pkt);
  }

  function deltaRootSendPlayerUpdate(nick) {
    var pid = (deltaRootChat.playerID || deltaRootChat.connectionID || 0) & 0xffff;
    if (!pid) return false;
    var n = String(nick || deltaRootChat.nick || "Player").slice(0, 24);
    deltaRootChat.nick = n;
    var id = Buffer.alloc(2);
    id.writeUInt16LE(pid, 0);
    var pkt = Buffer.concat([Buffer.from([10]), id, Buffer.from([1]), deltaUtf16Len(n), Buffer.alloc(2)]);
    return deltaRootSend(pkt);
  }

  function deltaRootRegisterTab() {
    if (!deltaRootChat._tabId) deltaRootChat._tabId = (Math.floor(Math.random() * 12345) + 1) >>> 0;
    var reg = Buffer.alloc(5);
    reg[0] = 1;
    reg.writeUInt32LE(deltaRootChat._tabId >>> 0, 1);
    deltaRootSend(reg);
  }

  function deltaRootHandleMessage(raw) {
    if (!raw || !raw.length) return;
    var buf = Buffer.from(raw);
    var op = buf[0];
    if (op === 0 && buf.length >= 3) {
      deltaRootChat.connectionID = buf.readUInt16LE(1);
      deltaRootChat.ready = true;
      if (deltaRootChat.roomHost) deltaRootSendRoom(deltaRootChat.roomHost);
      setTimeout(function () {
        deltaRootRegisterTab();
      }, 100);
      return;
    }
    if (op === 1) {
      if (buf.length >= 7) {
        deltaRootChat.playerID = buf.readUInt16LE(5);
      } else if (!deltaRootChat.playerID) {
        // Short ACK — use connectionID as tab playerID (server often omits body).
        deltaRootChat.playerID = deltaRootChat.connectionID || 1;
      }
      if (deltaRootChat.nick) deltaRootSendPlayerUpdate(deltaRootChat.nick);
      deltaRootFlushPendingChat();
      return;
    }
    if (op === 25 && buf.length > 8) {
      try {
        var o = 2; // op + type
        o += 6; // userID, playerID, targetID
        // writeUTF16StringLength = u8 len + utf16
        var nickLen = buf[o++];
        var nick = "";
        for (var i = 0; i < nickLen && o + 1 < buf.length; i++, o += 2) {
          nick += String.fromCharCode(buf.readUInt16LE(o));
        }
        var msgLen = buf[o++];
        var text = "";
        for (var j = 0; j < msgLen && o + 1 < buf.length; j++, o += 2) {
          text += String.fromCharCode(buf.readUInt16LE(o));
        }
        text = String(text || "")
          .replace(/delt\.io/gi, "agar.su")
          .trim();
        nick = String(nick || "player")
          .replace(/delt\.io/gi, "agar.su")
          .slice(0, 24);
        if (!text) return;
        var pkt = chatBuildAgarPacket({ r: 180, g: 220, b: 255 }, 0, nick || "player", text);
        if (pkt && typeof deltaRootChat.deliver === "function") {
          deltaRootChat.deliver(toDataView(pkt));
        }
      } catch (_) {}
    }
  }

  function deltaRootEnsure(host, deliver) {
    if (deliver) deltaRootChat.deliver = deliver;
    if (host) deltaRootChat.roomHost = String(host || "").replace(/^wss?:\/\//i, "").split(/[/?]/)[0];
    if (deltaRootChat.ws && (deltaRootChat.ws.readyState === 0 || deltaRootChat.ws.readyState === 1)) {
      if (deltaRootChat.ready && deltaRootChat.roomHost) deltaRootSendRoom(deltaRootChat.roomHost);
      return;
    }
    try {
      var ws = new WebSocket(DELTA_CHAT_WS);
      ws.binaryType = "arraybuffer";
      deltaRootChat.ws = ws;
      deltaRootChat.ready = false;
      deltaRootChat.connectionID = 0;
      deltaRootChat.playerID = 0;
      deltaRootChat._openedAt = Date.now();
      ws.onopen = function () {
        var a = Buffer.alloc(3);
        a[0] = 0;
        a.writeUInt16LE(0, 1);
        deltaRootSend(a);
      };
      ws.onmessage = function (ev) {
        var data = ev.data;
        if (data instanceof ArrayBuffer) deltaRootHandleMessage(new Uint8Array(data));
        else if (data && data.buffer) deltaRootHandleMessage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      };
      ws.onclose = function () {
        deltaRootChat.ws = null;
        deltaRootChat.ready = false;
      };
      ws.onerror = function () {};
    } catch (e) {
      console.warn("[delta] root chat", e && e.message ? e.message : e);
    }
  }

  function deltaRootSendChat(nick, text) {
    var t = String(text || "").trim();
    if (!t) return false;
    deltaRootChat.nick = String(nick || deltaRootChat.nick || "Player").slice(0, 24);
    if (!deltaRootChat.ready || !deltaRootChat.ws || deltaRootChat.ws.readyState !== 1) {
      deltaRootChat._pendingChat = { nick: deltaRootChat.nick, text: t };
      return false;
    }
    var conn = deltaRootChat.connectionID || 0;
    var pid = deltaRootChat.playerID || 0;
    if (!conn || !pid) {
      deltaRootChat._pendingChat = { nick: deltaRootChat.nick, text: t };
      return false;
    }
    deltaRootSendPlayerUpdate(deltaRootChat.nick);
    var ids = Buffer.alloc(6);
    ids.writeUInt16LE(conn & 0xffff, 0);
    ids.writeUInt16LE(pid & 0xffff, 2);
    ids.writeUInt16LE(0, 4);
    var pkt = Buffer.concat([
      Buffer.from([25, 1]),
      ids,
      deltaUtf16Len(deltaRootChat.nick),
      deltaUtf16Len(t.slice(0, 120)),
    ]);
    return deltaRootSend(pkt);
  }

  function deltaRootFlushPendingChat() {
    var p = deltaRootChat._pendingChat;
    if (!p) return;
    deltaRootChat._pendingChat = null;
    deltaRootSendChat(p.nick, p.text);
  }

  // Dual-WS multibox removed. Tab = same-socket units (requestUnit 62 / rotate + op 20).

  // —— Delta (delt.io direct) ——
  register({
    id: "delta",
    label: "Delta",
    trusted: false,
    usePow: false,
    useAgarAccountToken: false,
    match: function (host) {
      var h = String(host || "");
      // Direct delt.io only — NOT legacy xn--bdk.pw:6014 bot proxy
      if (/xn--bdk\.pw|:6014\b/i.test(h)) return false;
      return /delt\.io/i.test(h);
    },
    openSocket: function (wsUrl) {
      var clean = String(wsUrl).split("?")[0];
      deltaLastOpenUrl = clean;
      var ws = new WebSocket(clean);
      ws.binaryType = "arraybuffer";
      return ws;
    },
    ensureAuth: function () {
      // Delta LK only — native agar.su account path untouched (useAgarAccountToken: false).
      return deltaEnsureAuth();
    },
    createState: function () {
      var mp = new DeltaMultiProtocol();
      return {
        mp: mp,
        host: "",
        wsUrl: "",
        keysReady: false,
        mode: "connect",
        nick: "",
        displayNick: "",
        wantPlay: false,
        wantSpectate: false,
        authToken: deltaAuthCache.bearer || deltaResolveBearer() || "",
        _authSent: false,
        _send: null,
        _pending: [],
        _spawnAt: 0,
        destroy: function () {
          this._send = null;
          this._pending = [];
          this._authSent = false;
          if (this.mp) this.mp.resetCrypto();
        },
      };
    },
    onOpen: function (send, state) {
      if (!state) return;
      state._send = send;
      state.wsUrl = deltaLastOpenUrl || state.wsUrl || "";
      state.host = deltaHostFromUrl(state.wsUrl) || state.host || "";
      state.keysReady = false;
      state._pending = [];
      state._authSent = false;
      if (!state.authToken) state.authToken = deltaAuthCache.bearer || deltaResolveBearer() || "";
      if (state.mp) {
        state.mp.resetCrypto();
        state.mp.versionInt = deltaVersionStringToInt(DELTA_VERSION);
      }
      // Handshake plaintext before keys
      try {
        send(toSendBytes(deltaProtocolVersion(DELTA_PROTOCOL)));
        send(toSendBytes(deltaVersionIntPkt(deltaVersionStringToInt(DELTA_VERSION))));
      } catch (e) {}
      // RootSocket chat relay (official path — not game op 99)
      try {
        deltaRootEnsure(state.host || state.wsUrl, function (pkt) {
          if (state && typeof state._deliver === "function") state._deliver(pkt);
        });
      } catch (_) {}
    },
    encodeNick: function (rawNick, state) {
      if (!state || !state.mp) return [];
      var nick = publicNick(rawNick) || DELTA_GUEST_NICK;
      nick = nick.slice(0, 15) || DELTA_GUEST_NICK;
      // Ignore nick spam while still alive with OWN cells.
      if (state.mp.gotOwnCell && state.mp._ownCellIds.size > 0 && !state.mp._spectating) {
        return [];
      }
      // Explicit Play after death — unlock spawn.
      if (state.mp._spawnLock) state.mp._spawnLock = false;
      state.nick = nick;
      state.displayNick = nick;
      state.mode = "play";
      state.wantPlay = true;
      state.wantSpectate = false;
      // Throttled: remember nick but do NOT enterPlay/resetOwner (freezes world / kicks).
      if (deltaSpawnThrottled(state)) return [];
      state.mp.enterPlay(nick, nick);
      if (state.mp._keysReady) deltaSendSpawn(state, nick);
      return [];
    },
    encodeSpectate: function (state) {
      if (!state || !state.mp) return [];
      if (state.mode === "play" && state.wantPlay && state.mp.gotOwnCell && state.mp._ownCellIds.size > 0) {
        return [];
      }
      state.mode = "spectate";
      state.wantPlay = false;
      state.wantSpectate = true;
      state.mp.enterSpectate(true);
      if (state.mp._keysReady) {
        if (state.mp._lastMouse) {
          var c = state.mp._clampMouseXY(state.mp._lastMouse.x, state.mp._lastMouse.y);
          deltaSend(state, deltaMousePkt(c.x, c.y, state.mp.movementKey));
        }
        if (!state.mp._spectateSentToDelta) {
          state.mp._spectateSentToDelta = true;
          deltaSend(state, deltaSpectatePkt());
        }
      } else {
        // Queue spectate for after 241
        if (!state.mp._spectateSentToDelta) {
          state.mp._spectateSentToDelta = true;
          deltaSend(state, deltaSpectatePkt());
        }
      }
      return [new DataView(new Uint8Array([17]).buffer)];
    },
    encodeChat: function (text, state) {
      var t = String(text || "")
        .replace(/\s*:(ru|en|uk|tr|zh|ar|es|pl|de)\s*$/i, "")
        .trim();
      if (!t || !state) return [];
      var nick = state.displayNick || state.nick || "Player";
      // Official Delta chat = RootSocket only. No local fake echo.
      try {
        if (typeof state._deliver === "function") {
          deltaRootEnsure(state.host || state.wsUrl, function (pkt) {
            state._deliver(pkt);
          });
        } else {
          deltaRootEnsure(state.host || state.wsUrl, null);
        }
        deltaRootChat.nick = nick;
        deltaRootSendChat(nick, t);
      } catch (_) {}
      return [];
    },
    /**
     * Tab = delt.io same-socket multibox (NOT a second WebSocket).
     * 1 unit → requestUnit(62); 2+ units → rotate active + op 20; spawn new unit when 161 adds one.
     */
    onSwitchPlayer: function (state, ctx) {
      if (!state || !state.mp || !state.mp._keysReady) return;
      if (ctx && typeof ctx.deliver === "function") state._deliver = ctx.deliver;
      if (state.mp._mbDenied) {
        var denied = chatSystem("Мультибокс недоступен на этом сервере.", {
          r: 255,
          g: 120,
          b: 90,
        });
        if (denied && ctx && typeof ctx.deliver === "function") ctx.deliver(toDataView(denied));
        return;
      }
      var units = state.mp._unitIds || [];
      if (units.length >= 2) {
        var next = state.mp.rotateUnit();
        if (next != null) {
          deltaSend(state, deltaActivateUnitPkt(next, 1));
          if (state.mp._lastMouse) {
            var c = state.mp._clampMouseXY(state.mp._lastMouse.x, state.mp._lastMouse.y);
            deltaSend(state, deltaMousePkt(c.x, c.y, state.mp.movementKey));
          }
        }
        return;
      }
      // Need a second unit from the server (spawns beside you on multibox-capable rooms).
      state.mp._mbPendingSpawn = true;
      deltaSend(state, deltaRequestUnitPkt());
    },
    /** After 161 adds a unit — activate it and spawn once. */
    _deltaFinishMultiboxSpawn: function (state) {
      if (!state || !state.mp || !state.mp._mbPendingSpawn) return;
      var ids = state.mp._unitIds || [];
      if (ids.length < 2) return;
      state.mp._mbPendingSpawn = false;
      state.mp._activeUnitIdx = ids.length - 1;
      state.mp._activeTabId = ids[state.mp._activeUnitIdx] >>> 0;
      deltaSend(state, deltaActivateUnitPkt(state.mp._activeTabId, 1));
      if (state.mode === "play" && state.nick && !state.mp._spawnLock) {
        deltaSendSpawn(state, state.nick);
      }
    },
    encodeOutbound: function (buf, state) {
      if (!state || !buf || !state.mp) return [];
      var u8 =
        buf instanceof DataView
          ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
          : buf instanceof ArrayBuffer
            ? new Uint8Array(buf)
            : buf;
      var packet = Buffer.from(u8);
      if (!packet.length) return [];
      var op = packet[0];
      // Ignore agar.su handshake (main.js still emits it for foreign protos)
      if (op === 254 || op === 255 || op === 253) return [];
      // Local ping/pong — do not hit Delta
      if (op === 2) return [new DataView(new Uint8Array([2]).buffer)];
      if (op === 0) {
        var text = "";
        for (var p = 2; p + 1 < packet.length; p += 2) {
          var ch = packet.readUInt16LE(p);
          if (!ch) break;
          text += String.fromCharCode(ch);
        }
        this.encodeNick(text, state);
        return [];
      }
      if (op === 1) return this.encodeSpectate(state);
      // Opcode 17: agar.su CAMERA locally vs SPLIT outbound — same AgarZ fix
      if (op === 17) {
        deltaSend(state, deltaSplitPkt());
        return [];
      }
      // Tab multibox (synthetic from main.js)
      if (op === 62) {
        this.onSwitchPlayer(state);
        return [];
      }
      if (op === 99) {
        return this.encodeChat(
          (function () {
            try {
              return deltaParseAgarChatOut(packet);
            } catch (_) {
              return "";
            }
          })(),
          state
        );
      }
      var result = state.mp.agarToDelta(packet) || { packets: [], meta: {} };
      var local = [];
      if (result.meta) {
        if (result.meta.play) {
          state.nick = result.meta.nick || state.nick || DELTA_GUEST_NICK;
          state.displayNick = result.meta.displayNick || state.nick;
          state.mode = "play";
          state.wantPlay = true;
          state.wantSpectate = false;
          // enterPlay already ran in agarToDelta — still respect spawn throttle.
          if (state.mp._keysReady && !deltaSpawnThrottled(state)) {
            deltaSendSpawn(state, state.nick);
          }
        }
        if (result.meta.spectate) {
          state.mode = "spectate";
          state.wantPlay = false;
          state.wantSpectate = true;
        }
        if (result.meta.spectateClick) {
          local.push(new DataView(new Uint8Array([17]).buffer));
        }
        if (result.meta.mouse) {
          state.mp._lastMouse = result.meta.mouse;
        }
        if (result.meta.chatText) {
          this.encodeChat(result.meta.chatText, state);
        }
      }
      var pkts = result.packets || [];
      for (var i = 0; i < pkts.length; i++) deltaSend(state, pkts[i]);
      return local;
    },
    translateInbound: function (dataView, state) {
      if (!state) state = this.createState();
      if (!dataView || dataView.byteLength < 1) return [];
      var raw = Buffer.from(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength));
      if (!raw.length) return [];

      if (!state.mp._keysReady) {
        if (raw[0] === DELTA_OP.INIT_KEY) {
          var host = state.host || deltaHostFromUrl(state.wsUrl || deltaLastOpenUrl);
          state.host = host;
          state.mp.applyPacket241(raw, host);
          state.keysReady = true;
          deltaFlushPending(state);
          if (!state.authToken) state.authToken = deltaAuthCache.bearer || deltaResolveBearer() || "";
          deltaSendAuthToken(state);
          deltaRootEnsure(host, function (pkt) {
            if (state && typeof state._deliver === "function") state._deliver(pkt);
          });
          if (state.mode === "play" && state.nick) deltaSendSpawn(state, state.nick);
          else if (state.mode === "spectate" || state.wantSpectate) {
            if (!state.mp._spectateSentToDelta) {
              state.mp._spectateSentToDelta = true;
              deltaSend(state, deltaSpectatePkt());
            }
          }
        }
        return [];
      }

      var plain = state.mp.decryptIncoming(raw);
      var translated = state.mp.deltaToAgar(plain) || [];
      // After unit list 161 — finish second-unit spawn on same socket.
      if (state.mp._mbPendingSpawn && state.mp._unitIds && state.mp._unitIds.length >= 2) {
        try {
          this._deltaFinishMultiboxSpawn(state);
        } catch (_) {}
      }
      // On death CLEAR: stop wantPlay + ask Delta for spectate once (no auto-respawn).
      if (state.mp._spawnLock && !state._deathSpectateSent) {
        state._deathSpectateSent = true;
        state.wantPlay = false;
        state.wantSpectate = true;
        state.mode = "spectate";
        if (!state.mp._spectateSentToDelta) {
          state.mp._spectateSentToDelta = true;
          deltaSend(state, deltaSpectatePkt());
        } else {
          deltaSend(state, deltaSpectatePkt());
        }
      }
      if (!state.mp._spawnLock) state._deathSpectateSent = false;
      var out = [];
      for (var i = 0; i < translated.length; i++) out.push(toDataView(translated[i]));
      return out;
    },
  });

  global.AgarProtocols = {
    register: register,
    resolve: resolve,
    publicNick: publicNick,
    splitSkinNick: splitSkinNick,
    bubbleNickDisplay: bubbleNickDisplay,
    bubbleSkinLoadKey: bubbleSkinLoadKey,
    bubbleSkinCdnUrl: bubbleSkinCdnUrl,
    bubbleWireName: bubbleWireName,
    AGARZ_ROOMS: AGARZ_ROOMS,
    agarzWsUrl: agarzWsUrl,
    MultiProtocol: MultiProtocol,
    DeltaMultiProtocol: DeltaMultiProtocol,
    deltaEnsureAuth: deltaEnsureAuth,
    deltaAuthCache: function () {
      return deltaAuthCache;
    },
    get: function (id) {
      return byId.get(id) || null;
    },
    list: function () {
      return list.slice();
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
