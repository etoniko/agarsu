/* multiprotocols.js — unified client-side protocol layer for agar.su.
 *
 * Detects the upstream game protocol from the wss host and translates
 * game traffic in both directions so the existing agar.su render pipeline
 * (main.js) keeps working unchanged.
 *
 * Supported protocols: agar.su (pass-through), agarz, delta.
 * Browser-only. No Node `Buffer` — everything is Uint8Array / DataView.
 */
(function (global) {
  'use strict';

  // ==========================================================================
  // Protocol detection
  // ==========================================================================
  var PROTO = {
    AGAR_SU: 'agar.su',
    AGARZ: 'agarz',
    DELTA: 'delta'
  };

  function normalizeHost(host) {
    return String(host || '')
      .replace(/^wss?:\/\//i, '')
      .replace(/[/?].*$/, '')
      .trim()
      .toLowerCase();
  }

  function detectProtocol(host) {
    var h = normalizeHost(host);
    if (/agarz\.com$|^ws\.agarz\.com$|:10\d{2}$/.test(h)) return PROTO.AGARZ;
    if (/delt\.io$|arctida|rookery|^ffa\.delt/.test(h)) return PROTO.DELTA;
    return PROTO.AGAR_SU;
  }

  function isOfficial(protocolOrHost) {
    var p = protocolOrHost;
    if (p !== PROTO.AGAR_SU && p !== PROTO.AGARZ && p !== PROTO.DELTA) {
      p = detectProtocol(protocolOrHost);
    }
    return p === PROTO.AGAR_SU;
  }

  function sanitizeNickForHost(nick, host) {
    var proto = detectProtocol(host);
    if (proto === PROTO.AGAR_SU) return nick;
    var bare = String(nick || '')
      .split('#')[0]
      .split(':::::')[0]
      .replace(/<[^>]*>/g, '')
      .trim();
    return bare.slice(0, 15) || '';
  }

  // ==========================================================================
  // Binary helpers
  // ==========================================================================
  function Writer() {
    this.parts = [];
  }
  Writer.prototype.u8 = function (v) { this.parts.push(new Uint8Array([v & 255])); return this; };
  Writer.prototype.u16 = function (v) { var b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v & 0xffff, true); this.parts.push(b); return this; };
  Writer.prototype.u32 = function (v) { var b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); this.parts.push(b); return this; };
  Writer.prototype.i32 = function (v) { var b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v | 0, true); this.parts.push(b); return this; };
  Writer.prototype.f64 = function (v) { var b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, Number(v) || 0, true); this.parts.push(b); return this; };
  Writer.prototype.utf8 = function (s) {
    var bytes = [];
    var str = String(s == null ? '' : s);
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0xd800 || c >= 0xe000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else {
        i++;
        var c2 = str.charCodeAt(i);
        var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      }
    }
    this.parts.push(new Uint8Array(bytes));
    return this;
  };
  Writer.prototype.utf8z = function (s) { this.utf8(s); this.parts.push(new Uint8Array([0])); return this; };
  Writer.prototype.utf16 = function (s) {
    var str = String(s == null ? '' : s);
    var b = new Uint8Array(2 * str.length);
    var dv = new DataView(b.buffer);
    for (var i = 0; i < str.length; i++) dv.setUint16(i * 2, str.charCodeAt(i), true);
    this.parts.push(b);
    return this;
  };
  Writer.prototype.utf16z = function (s) { this.utf16(s); this.parts.push(new Uint8Array([0, 0])); return this; };
  Writer.prototype.out = function () {
    var len = 0;
    for (var i = 0; i < this.parts.length; i++) len += this.parts[i].length;
    var out = new Uint8Array(len);
    var off = 0;
    for (var j = 0; j < this.parts.length; j++) { out.set(this.parts[j], off); off += this.parts[j].length; }
    return out;
  };

  function Reader(buf) {
    this.buf = buf;
    this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    this.off = 0;
  }
  Reader.prototype.u8 = function () { var v = this.dv.getUint8(this.off); this.off += 1; return v; };
  Reader.prototype.u16 = function () { var v = this.dv.getUint16(this.off, true); this.off += 2; return v; };
  Reader.prototype.u32 = function () { var v = this.dv.getUint32(this.off, true); this.off += 4; return v; };
  Reader.prototype.i32 = function () { var v = this.dv.getInt32(this.off, true); this.off += 4; return v; };
  Reader.prototype.f64 = function () { var v = this.dv.getFloat64(this.off, true); this.off += 8; return v; };
  Reader.prototype.utf16z = function () {
    var s = '';
    while (this.off + 1 < this.buf.length) {
      var c = this.dv.getUint16(this.off, true);
      this.off += 2;
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  Reader.prototype.utf8z = function () {
    var start = this.off;
    while (this.off < this.buf.length && this.buf[this.off] !== 0) this.off++;
    var s = new TextDecoder().decode(this.buf.subarray(start, this.off));
    if (this.off < this.buf.length) this.off++;
    return s;
  };
  Reader.prototype.remaining = function () { return this.buf.length - this.off; };

  // ==========================================================================
  // Delta XOR crypto
  // ==========================================================================
  var DeltaCrypto = (function () {
    function versionStringToInt(v) {
      var p = String(v || '0.0.0').split('.');
      return (((+p[0] | 0) * 10000 + (+p[1] | 0) * 100 + (+p[2] | 0)) >>> 0);
    }
    function xorBuffer(buf, key) {
      var out = new Uint8Array(buf.length);
      var kb = new Uint8Array(4);
      new DataView(kb.buffer).setUint32(0, key >>> 0, true);
      for (var i = 0; i < buf.length; i++) out[i] = buf[i] ^ kb[i % 4];
      return out;
    }
    function rotateKey(key) {
      var k = key | 0;
      k = Math.imul(k, 1540483477) | 0;
      k = (Math.imul((k >>> 24) ^ k, 1540483477) | 0) ^ 114296087;
      k = Math.imul((k >>> 13) ^ k, 1540483477) | 0;
      k = (k >>> 15) ^ k;
      return k >>> 0;
    }
    function murmur2(str, seed) {
      var l = str.length;
      var h = (seed ^ l) >>> 0;
      var i = 0, k;
      while (l >= 4) {
        k = (str.charCodeAt(i) & 0xff) | ((str.charCodeAt(i + 1) & 0xff) << 8) |
          ((str.charCodeAt(i + 2) & 0xff) << 16) | ((str.charCodeAt(i + 3) & 0xff) << 24);
        k = ((k & 0xffff) * 0x5bd1e995 + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16)) | 0;
        k ^= k >>> 24;
        k = ((k & 0xffff) * 0x5bd1e995 + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16)) | 0;
        h = ((h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) ^ k;
        l -= 4; i += 4;
      }
      switch (l) {
        case 3: h ^= (str.charCodeAt(i + 2) & 0xff) << 16;
        case 2: h ^= (str.charCodeAt(i + 1) & 0xff) << 8;
        case 1:
          h ^= str.charCodeAt(i) & 0xff;
          h = ((h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) | 0;
      }
      h ^= h >>> 13;
      h = ((h & 0xffff) * 0x5bd1e995 + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) | 0;
      h ^= h >>> 15;
      return h >>> 0;
    }
    function handlePacket241(packet, versionInt, host) {
      var r = new Reader(packet);
      r.u8();
      var movementKey = r.i32() >>> 0;
      var version = r.utf8z();
      var decryptionKey = (movementKey ^ (versionInt >>> 0)) >>> 0;
      var encryptionKey = murmur2(host + version, 255);
      return { movementKey: movementKey >>> 0, decryptionKey: decryptionKey, encryptionKey: encryptionKey, version: version };
    }
    return { versionStringToInt: versionStringToInt, xorBuffer: xorBuffer, rotateKey: rotateKey, murmur2: murmur2, handlePacket241: handlePacket241 };
  })();

  // ==========================================================================
  // agar.su packet builders
  // ==========================================================================
  var AGAR = { PING: 2, UPDATE: 16, CAMERA: 17, CLEAR: 20, LB: 49, BORDER: 64, CHAT: 99 };
  var PID_PLACEHOLDER = 0xfffffffe;

  function buildAgarUpdate(cells, removes) {
    var w = new Writer();
    w.u8(AGAR.UPDATE);
    w.u32(0);
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      w.u32(c.id >>> 0);
      w.u8(c.type & 255);
      if (c.type !== 1) {
        if (c.type === 0) w.u32(c.playerId >>> 0);
        w.i32(c.x | 0);
        w.i32(c.y | 0);
        w.u16(Math.max(0, Math.min(65535, c.size | 0)));
      }
      w.u8(c.r & 255);
      w.u8(c.g & 255);
      w.u8(c.b & 255);
      w.u8(c.flags & 255);
      w.utf8z(c.name || '');
      w.u8(0);
    }
    w.u32(0);
    for (var j = 0; j < removes.length; j++) w.u32(removes[j] >>> 0);
    return w.out();
  }

  function buildAgarBorder(minx, miny, maxx, maxy, ownerPid) {
    var w = new Writer();
    w.u8(AGAR.BORDER);
    w.f64(minx);
    w.f64(miny);
    w.f64(maxx);
    w.f64(maxy);
    w.u16(4);
    w.u16(4);
    w.u32((ownerPid >>> 0) || PID_PLACEHOLDER);
    return w.out();
  }

  function buildAgarLb(items) {
    var w = new Writer();
    w.u8(AGAR.LB);
    w.u32(items.length);
    for (var i = 0; i < items.length; i++) {
      w.u32(items[i].id >>> 0);
      w.utf16z(items[i].name || 'Unnamed');
      w.u32(items[i].xp || 0);
    }
    return w.out();
  }

  function buildAgarChat(r, g, b, name, text) {
    var w = new Writer();
    w.u8(AGAR.CHAT);
    w.u8(0);
    w.u8(r & 255);
    w.u8(g & 255);
    w.u8(b & 255);
    w.utf16z(name || '');
    w.utf16z(text || '');
    return w.out();
  }

  // --------------------------------------------------------------------------
  // SHA-256 (synchronous) + AgarZ SYNC_ASSETS anti-bot PoW solver
  // --------------------------------------------------------------------------
  var sha256 = (function () {
    var K = new Uint32Array([
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    return function (bytes) {
      var len = bytes.length;
      var bitLen = len * 8;
      var padLen = (((len + 8) >> 6) + 1) << 6;
      var padded = new Uint8Array(padLen);
      padded.set(bytes);
      padded[len] = 0x80;
      var dv = new DataView(padded.buffer);
      dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000));
      dv.setUint32(padLen - 4, bitLen >>> 0);
      var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
      var w = new Uint32Array(64);
      for (var off = 0; off < padLen; off += 64) {
        for (var t = 0; t < 16; t++) w[t] = dv.getUint32(off + t * 4);
        for (var t = 16; t < 64; t++) {
          var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
          var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
          w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
        }
        var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
        for (var t = 0; t < 64; t++) {
          var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
          var ch = (e & f) ^ (~e & g);
          var temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
          var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
          var maj = (a & b) ^ (a & c) ^ (b & c);
          var temp2 = (S0 + maj) >>> 0;
          h = g; g = f; f = e; e = (d + temp1) >>> 0;
          d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
        }
        H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
        H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
      }
      var hex = '';
      for (var i = 0; i < 8; i++) hex += ('00000000' + H[i].toString(16)).slice(-8);
      return hex;
    };
  })();

  function solveAssetPow(challengeStr, difficulty) {
    var zeros = Math.floor((difficulty | 0) / 5);
    var prefix = '';
    for (var z = 0; z < zeros; z++) prefix += '0';
    for (var n = 0; n < 8000000; n++) {
      var input = challengeStr + n;
      var bytes = new Uint8Array(input.length);
      for (var i = 0; i < input.length; i++) bytes[i] = input.charCodeAt(i) & 0xff;
      if (sha256(bytes).substring(0, zeros) === prefix) return n;
    }
    return -1;
  }

  // --------------------------------------------------------------------------
  // Name rebrand: AgarZ / known bot names → agarsu (cells + leaderboard)
  // --------------------------------------------------------------------------
  function rebrandName(text) {
    var s = String(text == null ? '' : text);
    s = s.replace(/www-imsolo-pro/gi, 'agarsu');
    s = s.replace(/agarz/gi, function (m) {
      if (m === 'AGARZ') return 'AGARSU';
      if (m.charCodeAt(0) === 65) return 'AgarSu';
      return 'agarsu';
    });
    return s;
  }

  // ==========================================================================
  // agarz — builders + parsers (state lives in engine)
  // ==========================================================================
  var agarz = (function () {
    var C2S = {
      SPECTATE_REQUEST: 0x01, SET_SKIN: 0x02, SET_NAME: 0x07, PLAY_AS_GUEST_REQUEST: 0x08,
      SPAWN_PLAYER: 0x09, PING: 0x0d, MOUSE_MOVE: 0x10, SPLIT: 0x11,
      EMITFOOD_ONCE: 0x15, EMITFOOD_START: 0x16, EMITFOOD_STOP: 0x17,
      SET_LANG: 0x19, SET_TEAM: 0x1a, SET_SPECTATOR: 0x32, SOUND: 0x35,
      SCOPE_AROUND_ENABLE: 0x05, SEND_CHAT: 0x63, ASSET_VERIFIED: 0x47, BEGIN: 0xff
    };
    var S2C = {
      UPDATE_LEADERBOARD: 0x31, PLAYER_LIST: 0x34, BOARD_SIZE: 0x40, ADD_CHAT: 0x5b,
      UPDATE_NODES2: 0x64, UPDATE_NODES2_EXT: 0x65, PLAYER_ID: 0x68,
      READY_TO_START: 0x6d, INFO: 0x6f, ADD_CHAT_ADMIN: 0x74, SHOW_MESSAGE: 0x7a,
      SYNC_ASSETS: 0x7e
    };
    var CLIENT_VERSION = 0x2710;
    var INFO_READY = 0x1;

    function buildSetName(name) {
      var s = String(name || 'guest').slice(0, 15);
      var w = new Writer(); w.u8(C2S.SET_NAME); w.utf16(s); return w.out();
    }
    function buildBegin(v) {
      var w = new Writer(); w.u8(C2S.BEGIN); w.i32(v == null ? CLIENT_VERSION : v); return w.out();
    }
    function buildMouse(x, y) {
      var w = new Writer(); w.u8(C2S.MOUSE_MOVE); w.f64(x); w.f64(y); w.u32(0); return w.out();
    }
    function buildOp(op) { return new Uint8Array([op & 255]); }
    function buildPing(ts) {
      var w = new Writer(); w.u8(C2S.PING); w.i32(ts | 0); return w.out();
    }
    function buildAssetVerified(n) {
      var w = new Writer(); w.u8(C2S.ASSET_VERIFIED);
      var nBig = BigInt(n);
      w.u32(Number(nBig & 0xffffffffn));
      w.u32(Number((nBig >> 32n) & 0xffffffffn));
      return w.out();
    }
    function buildChat(msg) {
      var w = new Writer(); w.u8(C2S.SEND_CHAT); w.utf16(msg); return w.out();
    }
    function buildSetLang(code) {
      var w = new Writer(); w.u8(C2S.SET_LANG); w.u8(code | 0); return w.out();
    }
    function buildSound(on) {
      var w = new Writer(); w.u8(C2S.SOUND); w.u8(on ? 1 : 0); return w.out();
    }
    function buildSetTeam(t) {
      var w = new Writer(); w.u8(C2S.SET_TEAM); w.utf16(t || ''); return w.out();
    }
    function buildSetSkin(s) {
      var w = new Writer(); w.u8(C2S.SET_SKIN); w.utf16(s || ''); return w.out();
    }

    function parseNodesExt(buf, names) {
      if (buf.length < 5) return;
      var r = new Reader(buf); r.u8();
      if (r.remaining() < 2) return;
      r.u16();
      var count = r.u16();
      for (var i = 0; i < count && r.remaining() >= 2; i++) {
        var id = r.u16();
        var name = rebrandName(r.utf16z().replace(/\0/g, '').slice(0, 24));
        r.utf16z();
        if (id && name) names.set(id, name);
      }
    }
    function parseLb(buf, names) {
      if (buf.length < 5) return [];
      var r = new Reader(buf); r.u8();
      var count = r.u32();
      if (count > 50) count = 50;
      var items = [];
      for (var i = 0; i < count && r.remaining() >= 4; i++) {
        var id = r.u32();
        var name = rebrandName(r.utf16z().replace(/\0/g, '').slice(0, 24));
        if (!name) name = rebrandName(names.get(id) || names.get(id & 0xffff) || 'Unnamed');
        if (id && name && name !== 'Unnamed') { names.set(id, name); names.set(id & 0xffff, name); }
        items.push({ id: id, name: name || 'Unnamed', xp: 0 });
      }
      return items;
    }
    function parseNodes2(buf, names, ownPid, pendingNick) {
      var cells = [], removes = [];
      var p = 1;
      var dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      while (p + 4 <= buf.length) {
        var id = dv.getUint32(p, true); p += 4;
        if (!id) break;
        if (p + 12 > buf.length) break;
        var x = dv.getInt16(p, true); p += 2;
        var y = dv.getInt16(p, true); p += 2;
        var size = dv.getUint16(p, true); p += 2;
        size = Math.max(1, Math.min(65535, size));
        var r = buf[p++], g = buf[p++], b = buf[p++];
        var cellType = buf[p++];
        var flags16 = dv.getUint16(p, true); p += 2;

        var agarType = 4, playerId = 0, flags = 0, name = '';
        if (cellType === 1 || cellType === 4) { agarType = 4; }
        else if (cellType === 2 || cellType === 5) { agarType = 2; flags = 1; }
        else if (cellType === 3) { agarType = 3; flags = 32; }
        else {
          agarType = 0;
          var flagPid = flags16 >>> 0;
          // Own cell: stamp with the full 32-bit owner pid so it matches the border
          // ownerPlayerId. AgarZ cell flags carry only the low 16 bits when the server
          // pid exceeds 65535 — a 16-bit playerId never equals ownerPlayerId, so the
          // cell is created as foreign, never becomes isOwn, and the camera never zooms out.
          var isOwn = !!(ownPid && (flagPid === ownPid || flagPid === (ownPid & 0xffff)));
          playerId = isOwn ? (ownPid >>> 0) : flagPid;
          if (isOwn && pendingNick) name = pendingNick;
          else name = names.get(flags16) || names.get(flags16 & 0xffff) || '';
        }
        cells.push({ id: id >>> 0, type: agarType, playerId: playerId, x: x, y: y, size: size,
          r: agarType === 2 ? 51 : r, g: agarType === 2 ? 255 : g, b: agarType === 2 ? 51 : b,
          flags: flags, name: name });
      }
      if (p + 4 <= buf.length) {
        var n = dv.getUint32(p, true) >>> 0; p += 4;
        n = Math.min(n, Math.floor((buf.length - p) / 4), 20000);
        for (var i = 0; i < n; i++) { removes.push(dv.getUint32(p, true) >>> 0); p += 4; }
      }
      return { cells: cells, removes: removes };
    }
    function parseBorder(buf) {
      if (buf.length < 33) return null;
      var r = new Reader(buf); r.u8();
      return { minx: r.f64(), miny: r.f64(), maxx: r.f64(), maxy: r.f64() };
    }
    function parsePlayerId(buf) {
      if (buf.length < 5) return 0;
      return new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(1, true) >>> 0;
    }
    function parseChat(buf) {
      var r = new Reader(buf); r.u8();
      return r.utf16z().slice(0, 160);
    }
    function parseSyncAssets(buf) {
      if (!buf || buf[0] !== S2C.SYNC_ASSETS || buf.length < 10) return null;
      var dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      var difficulty = dv.getUint8(1);
      var lo = dv.getUint32(2, true) >>> 0;
      var hi = dv.getUint32(6, true) >>> 0;
      var challenge = (BigInt(hi) << 32n) | BigInt(lo);
      return { difficulty: difficulty, challengeStr: challenge.toString() };
    }

    return {
      C2S: C2S, S2C: S2C, CLIENT_VERSION: CLIENT_VERSION, INFO_READY: INFO_READY,
      buildSetName: buildSetName, buildBegin: buildBegin, buildMouse: buildMouse,
      buildOp: buildOp, buildPing: buildPing, buildChat: buildChat,
      buildSetLang: buildSetLang, buildSound: buildSound, buildSetTeam: buildSetTeam, buildSetSkin: buildSetSkin,
      parseNodesExt: parseNodesExt, parseLb: parseLb, parseNodes2: parseNodes2,
      parseBorder: parseBorder, parsePlayerId: parsePlayerId, parseChat: parseChat,
      buildAssetVerified: buildAssetVerified, parseSyncAssets: parseSyncAssets
    };
  })();

  // ==========================================================================
  // delta — builders + raw parser (color/name/own logic in engine)
  // ==========================================================================
  var delta = (function () {
    var OP = { NICK: 0, SPECTATE: 1, UPDATE: 16, CAMERA: 17, CLEAR: 20, OWN: 32, LB: 49, LB_PARTY: 53, BORDER: 64, CHAT: 99, INIT_KEY: 241 };

    function buildSpawn(nick) {
      var s = String(nick || 'agarsu').slice(0, 15);
      var w = new Writer();
      w.u8(0); w.utf8(s); w.u8(0); w.utf8('0'); w.u8(0);
      return w.out();
    }
    function buildMouse(x, y, movementKey) {
      var w = new Writer(); w.u8(16); w.i32(x | 0); w.i32(y | 0); w.u32(movementKey || 0); return w.out();
    }
    function buildProtocol(v) {
      var w = new Writer(); w.u8(254); w.u32(v >>> 0); return w.out();
    }
    function buildVersionInt(v) {
      var w = new Writer(); w.u8(255); w.u32(v >>> 0); return w.out();
    }
    function buildDeltaChat(msg) {
      var w = new Writer(); w.u8(99); w.utf8(msg); return w.out();
    }

    function encode(op, payload) {
      switch (op) {
        case 0: return [buildSpawn(readUtf16(payload, 2))];
        case 1: return [new Uint8Array([1])];
        case 2: return [];
        case 16: return [buildMouse(readF64(payload, 1), readF64(payload, 9))];
        case 17: return [new Uint8Array([17])];
        case 18: return [new Uint8Array([18])];
        case 19: return [new Uint8Array([19])];
        case 21: return [new Uint8Array([21])];
        case 99: return [buildDeltaChat(readUtf16(payload, 2))];
        default: return [];
      }
    }
    function readUtf16(u8, start) {
      var s = '';
      var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      for (var p = start; p + 1 < u8.length; p += 2) {
        var c = dv.getUint16(p, true);
        if (!c) break;
        s += String.fromCharCode(c);
      }
      return s;
    }
    function readF64(u8, start) {
      return new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getFloat64(start, true);
    }

    // Raw cell parse — color/name/own resolved in engine (needs state).
    function parseUpdate(buf) {
      var r = new Reader(buf);
      r.u8();
      if (r.remaining() < 2) return null;
      var eatN = r.u16();
      var eaten = [];
      for (var i = 0; i < eatN && r.remaining() >= 8; i++) eaten.push({ killer: r.u32(), killed: r.u32() });
      var cells = [];
      while (r.remaining() >= 4) {
        var id = r.u32();
        if (id === 0) break;
        if (r.remaining() < 11) break;
        var x = r.i32(), y = r.i32(), size = r.u16();
        var flags = r.u8();
        var ext = 0;
        if (flags & 128) { if (!r.remaining()) break; ext = r.u8(); }
        var cr = 255, cg = 255, cb = 255, hasColor = false;
        if (flags & 2) {
          if (r.remaining() < 3) break;
          cr = r.u8(); cg = r.u8(); cb = r.u8(); hasColor = true;
        }
        var skin = '';
        if (flags & 4) skin = r.utf8z();
        var name = '';
        if (flags & 8) {
          name = r.utf8z();
          try { name = decodeURIComponent(escape(name)); } catch (e) {}
          name = rebrandName(name);
        }
        if (ext & 4 && r.remaining() >= 4) r.off += 4;
        var isVirus = !!(flags & 1);
        var isPellet = !!(ext & 1);
        var isEjected = !!(flags & 32) || !!(flags & 64);
        var type = 0;
        if (isPellet) type = 4;
        else if (isVirus) type = 2;
        else if (isEjected) type = 3;
        cells.push({ id: id >>> 0, x: x, y: y, size: size, r: cr, g: cg, b: cb,
          _hasColor: hasColor, name: name || '', skin: skin, type: type,
          flags: flags & 0x7f });
      }
      var removes = [];
      if (r.remaining() >= 2) {
        var remN = r.u16();
        for (var j = 0; j < remN && r.remaining() >= 4; j++) removes.push(r.u32());
      }
      return { eaten: eaten, cells: cells, removes: removes };
    }

    function parseLb(buf) {
      var r = new Reader(buf); r.u8();
      var count = r.u32();
      var items = [];
      for (var i = 0; i < count && r.remaining() >= 4; i++) {
        var id = r.u32();
        var name = rebrandName(r.utf16z().slice(0, 24).replace(/delt\.io/gi, 'agar.su'));
        items.push({ id: id, name: name || 'Unnamed', xp: 0 });
      }
      return items;
    }

    function parsePartyLb(buf) {
      if (!buf || buf.length < 2) return [];
      var off = 1;
      if (buf[0] === 54) off = 2;
      var items = [];
      while (off < buf.length) {
        var flags = buf[off++];
        if (flags & 0x01) { if (off >= buf.length) break; off++; }
        var name = '';
        if (flags & 0x02) {
          while (off < buf.length) {
            var c = buf[off++];
            if (!c) break;
            name += String.fromCharCode(c);
          }
          try { name = decodeURIComponent(escape(name)); } catch (e) {}
        }
        var id = 0;
        if (flags & 0x04) {
          if (off + 4 > buf.length) break;
          id = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(off, true) >>> 0;
          off += 4;
        }
        name = rebrandName(String(name || '').replace(/^\s+/, '').replace(/delt\.io/gi, 'agar.su'));
        if (!name && !(flags & 0x08)) {
          if (!flags) break;
          continue;
        }
        items.push({ id: id, name: name || 'Unnamed', xp: 0 });
        if (items.length >= 10) break;
      }
      return items;
    }

    return { OP: OP, buildSpawn: buildSpawn, buildMouse: buildMouse, buildProtocol: buildProtocol,
      buildVersionInt: buildVersionInt, encode: encode, parseUpdate: parseUpdate, parseLb: parseLb, parsePartyLb: parsePartyLb };
  })();

  // ==========================================================================
  // agar.su (original) adapter — pass-through
  // ==========================================================================
  var agarSuAdapter = {
    isPassthrough: true,
    encode: function (op, payload) { return [payload]; },
    decode: function (buf) { return [buf]; }
  };

  // ==========================================================================
  // Engine
  // ==========================================================================
  function createEngine(host) {
    var proto = detectProtocol(host);
    var adapter = { 'agar.su': agarSuAdapter, 'agarz': agarz, 'delta': delta }[proto];

    var state = {
      protocol: proto,
      host: normalizeHost(host),
      rawSend: null,
      // delta crypto
      deltaKeysReady: false,
      decryptionKey: 0,
      encryptionKey: 0,
      deltaVersionInt: DeltaCrypto.versionStringToInt('25.4.1'),
      // delta world state
      deltaOwnCellIds: new Set(),
      deltaOwnerPid: 0,
      deltaColorById: new Map(),
      deltaNameById: new Map(),
      deltaBorder: null,
      deltaOwnerBorderSent: false,
      deltaMapBorderSent: false,
      deltaPlayNick: '',
      deltaGotOwnCell: false,
      // agarz state
      names: new Map(),
      ownPid: 0,
      pendingNick: '',
      langGuestSent: false,
      spawned: false,
      ejectHolding: false,
      ejectStopTimer: null,
      agarzBorderDims: null,
      agarzBorderSent: false
    };

    function sendUpstream(u8) {
      if (state.rawSend && u8) state.rawSend(u8.buffer || u8);
    }

    function onOpen(ws) {
      state.rawSend = ws.send;
      if (proto === PROTO.AGARZ) {
        sendUpstream(agarz.buildBegin());
      } else if (proto === PROTO.DELTA) {
        sendUpstream(delta.buildProtocol(22));
        sendUpstream(delta.buildVersionInt(state.deltaVersionInt));
      }
    }

    // ---- agarz ----
    function agarzSpawn() {
      var nick = state.pendingNick;
      if (!nick) return;
      state.spawned = true;
      sendUpstream(agarz.buildSound(1));
      sendUpstream(agarz.buildSetTeam(''));
      sendUpstream(agarz.buildSetSkin(''));
      sendUpstream(agarz.buildOp(agarz.C2S.SCOPE_AROUND_ENABLE));
      sendUpstream(agarz.buildSetName(nick));
      sendUpstream(agarz.buildOp(agarz.C2S.SPAWN_PLAYER));
      sendUpstream(agarz.buildSetName(nick));
    }
    // agarz W-eject: agar.su spams op 21 @100ms while held. Convert to
    // EMITFOOD_START on first press and EMITFOOD_STOP after 180ms of no repeats,
    // so hold-W continuously ejects like original agar.su.
    function agarzEject() {
      if (!state.ejectHolding) {
        state.ejectHolding = true;
        if (state.ejectStopTimer) { clearTimeout(state.ejectStopTimer); state.ejectStopTimer = null; }
        state.ejectStopTimer = setTimeout(function () {
          state.ejectHolding = false;
          state.ejectStopTimer = null;
          sendUpstream(agarz.buildOp(agarz.C2S.EMITFOOD_STOP));
        }, 180);
        return [agarz.buildOp(agarz.C2S.EMITFOOD_START)];
      }
      if (state.ejectStopTimer) clearTimeout(state.ejectStopTimer);
      state.ejectStopTimer = setTimeout(function () {
        state.ejectHolding = false;
        state.ejectStopTimer = null;
        sendUpstream(agarz.buildOp(agarz.C2S.EMITFOOD_STOP));
      }, 180);
      return [];
    }
    function agarzOnReady(u8) {
      if (!state.langGuestSent) {
        state.langGuestSent = true;
        sendUpstream(agarz.buildSetLang(1));
        sendUpstream(agarz.buildOp(agarz.C2S.PLAY_AS_GUEST_REQUEST));
      }
      var isInfoReady = false;
      if (u8[0] === agarz.S2C.INFO && u8.length >= 5) {
        var info = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(1, true);
        isInfoReady = info === agarz.INFO_READY;
      } else if (u8[0] === agarz.S2C.READY_TO_START) {
        isInfoReady = true;
      }
      if (isInfoReady && state.pendingNick && !state.spawned) agarzSpawn();
      return [];
    }

    // ---- delta helpers ----
    function stableOwnerPid(firstCellId) {
      var cell = firstCellId >>> 0;
      var pid = (0x6a000000 ^ cell ^ ((Date.now() & 0xffff) << 8)) >>> 0;
      if (!pid || pid === cell) pid = (0x6a000001 + (cell & 0xffff)) >>> 0;
      return pid;
    }
    function foreignPlayerId(cellId) {
      var pid = (cellId >>> 0) || 1;
      var owner = state.deltaOwnerPid;
      if (owner && pid === owner) pid = (pid ^ 0x00ffffff) >>> 0 || 1;
      if (!pid || pid === PID_PLACEHOLDER) pid = 1;
      return Math.max(1, pid >>> 0);
    }
    function colorForId(id) {
      var h = (id * 2654435761) >>> 0;
      return { r: 40 + (h & 127), g: 40 + ((h >>> 8) & 127), b: 40 + ((h >>> 16) & 127) };
    }

    function deltaBorder(u8) {
      var r = new Reader(u8); r.u8();
      if (r.remaining() < 32) return [];
      state.deltaBorder = { minx: r.f64(), miny: r.f64(), maxx: r.f64(), maxy: r.f64() };
      if (state.deltaPlayNick) return []; // playing: wait for OWN32
      if (state.deltaMapBorderSent) return [];
      state.deltaMapBorderSent = true;
      return [buildAgarBorder(state.deltaBorder.minx, state.deltaBorder.miny, state.deltaBorder.maxx, state.deltaBorder.maxy, PID_PLACEHOLDER)];
    }
    function deltaOwn(u8) {
      if (u8.length < 5) return [];
      var id = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(1, true) >>> 0;
      state.deltaOwnCellIds.add(id);
      if (!state.deltaOwnerPid) state.deltaOwnerPid = stableOwnerPid(id);
      state.deltaGotOwnCell = true;
      if (state.deltaBorder && !state.deltaOwnerBorderSent) {
        state.deltaOwnerBorderSent = true;
        return [buildAgarBorder(state.deltaBorder.minx, state.deltaBorder.miny, state.deltaBorder.maxx, state.deltaBorder.maxy, state.deltaOwnerPid)];
      }
      return [];
    }
    function deltaUpdate(u8) {
      var parsed = delta.parseUpdate(u8);
      if (!parsed) return buildAgarUpdate([], []);
      var owner = state.deltaOwnerPid;
      var cells = [];
      for (var i = 0; i < parsed.cells.length; i++) {
        var c = parsed.cells[i];
        // color
        var cached = state.deltaColorById.get(c.id);
        if (c._hasColor) {
          state.deltaColorById.set(c.id, { r: c.r, g: c.g, b: c.b });
        } else if (cached) {
          c.r = cached.r; c.g = cached.g; c.b = cached.b;
        } else {
          var col = colorForId(c.id);
          c.r = col.r; c.g = col.g; c.b = col.b;
          state.deltaColorById.set(c.id, col);
        }
        // name — players only; eject/food/virus stay nameless
        if (c.type === 0) {
          if (c.name) state.deltaNameById.set(c.id, c.name);
          else if (state.deltaNameById.has(c.id)) c.name = state.deltaNameById.get(c.id);
        } else {
          c.name = '';
        }
        // own / foreign player id
        if (c.type === 0) {
          if (state.deltaOwnCellIds.has(c.id)) {
            c.playerId = owner;
            if (state.deltaPlayNick) c.name = state.deltaPlayNick;
          } else {
            c.playerId = foreignPlayerId(c.id);
          }
        } else {
          c.playerId = 0;
        }
        cells.push(c);
      }
      // drop stale caches on removes
      for (var j = 0; j < parsed.removes.length; j++) {
        state.deltaColorById.delete(parsed.removes[j]);
        state.deltaNameById.delete(parsed.removes[j]);
        state.deltaOwnCellIds.delete(parsed.removes[j]);
      }
      return buildAgarUpdate(cells, parsed.removes);
    }
    function deltaLb(u8) { return buildAgarLb(delta.parseLb(u8)); }

    // ---- encode client -> upstream ----
    function encodeClientPacket(u8) {
      if (!u8 || !u8.length) return [];
      var op = u8[0];
      if (proto === PROTO.AGAR_SU) return [u8];
      if (op === 254 || op === 255 || op === 114) return [];
      if (op === 2) {
        if (proto === PROTO.AGARZ) return [agarz.buildPing(Date.now())];
        return [];
      }

      if (proto === PROTO.AGARZ) {
        switch (op) {
          case 0: {
            var nick = readUtf16From(u8, 2);
            state.pendingNick = nick;
            state.spawned = false;
            var outs = [agarz.buildSetName(nick)];
            if (state.langGuestSent && nick) agarzSpawn();
            return outs;
          }
          case 1:
            return [agarz.buildOp(agarz.C2S.SCOPE_AROUND_ENABLE), agarz.buildOp(agarz.C2S.SPECTATE_REQUEST)];
          case 16: return [agarz.buildMouse(readF64From(u8, 1), readF64From(u8, 9))];
          case 17: return [agarz.buildOp(agarz.C2S.SPLIT)];
          case 18: return [agarz.buildOp(agarz.C2S.EMITFOOD_ONCE)];
          case 21: return agarzEject();
          case 22: return [agarz.buildOp(agarz.C2S.EMITFOOD_START)];
          case 19:
          case 23: return [agarz.buildOp(agarz.C2S.EMITFOOD_STOP)];
          case 99: return [agarz.buildChat(readUtf16From(u8, 2))];
          default: return [];
        }
      }

      if (proto === PROTO.DELTA) {
        if (op === 0) {
          var nick2 = readUtf16From(u8, 2);
          state.deltaPlayNick = nick2;
          state.deltaOwnerPid = 0;
          state.deltaOwnCellIds.clear();
          state.deltaOwnerBorderSent = false;
          state.deltaMapBorderSent = false;
          state.deltaGotOwnCell = false;
        }
      }

      var out = adapter.encode(op, u8);
      if (proto === PROTO.DELTA && state.deltaKeysReady && out.length) {
        out = out.map(function (b) {
          var enc = DeltaCrypto.xorBuffer(b, state.encryptionKey);
          state.encryptionKey = DeltaCrypto.rotateKey(state.encryptionKey);
          return enc;
        });
      }
      return out;
    }

    function readUtf16From(u8, start) {
      var s = '';
      var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      for (var p = start; p + 1 < u8.length; p += 2) {
        var c = dv.getUint16(p, true);
        if (!c) break;
        s += String.fromCharCode(c);
      }
      return s;
    }
    function readF64From(u8, start) {
      return new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getFloat64(start, true);
    }

    // ---- decode upstream -> agar.su packets ----
    function decodeServerPacket(u8) {
      if (!u8 || !u8.length) return [];
      if (proto === PROTO.AGAR_SU) return [u8];

      if (proto === PROTO.DELTA) {
        if (!state.deltaKeysReady) {
          if (u8[0] === 241) {
            var k = DeltaCrypto.handlePacket241(u8, state.deltaVersionInt, state.host);
            state.decryptionKey = k.decryptionKey;
            state.encryptionKey = k.encryptionKey;
            state.deltaKeysReady = true;
          }
          return [];
        }
        var plain = DeltaCrypto.xorBuffer(u8, state.decryptionKey);
        var op = plain[0];
        switch (op) {
          case delta.OP.BORDER: return deltaBorder(plain);
          case delta.OP.OWN: return deltaOwn(plain);
          case delta.OP.UPDATE: return [deltaUpdate(plain)];
          case delta.OP.LB: return [deltaLb(plain)];
          case 53:
          case 54: return [buildAgarLb(delta.parsePartyLb(plain))];
          case delta.OP.CAMERA: return [new Uint8Array([AGAR.CAMERA])];
          case delta.OP.CHAT: {
            var rc = new Reader(plain); rc.u8();
            return [buildAgarChat(120, 200, 255, '', rc.utf16z().slice(0, 160))];
          }
          default: return [];
        }
      }

      if (proto === PROTO.AGARZ) {
        var opA = u8[0];
        switch (opA) {
          case agarz.S2C.READY_TO_START:
          case agarz.S2C.INFO: return agarzOnReady(u8);
          case agarz.S2C.UPDATE_NODES2_EXT:
            agarz.parseNodesExt(u8, state.names);
            return [];
          case agarz.S2C.UPDATE_NODES2: {
            var p = agarz.parseNodes2(u8, state.names, state.ownPid, state.pendingNick);
            return [buildAgarUpdate(p.cells, p.removes)];
          }
          case agarz.S2C.UPDATE_LEADERBOARD: {
            var items = agarz.parseLb(u8, state.names);
            return [buildAgarLb(items)];
          }
          case agarz.S2C.BOARD_SIZE: {
            var b = agarz.parseBorder(u8);
            if (!b) return [];
            var dims = { minx: b.minx, miny: b.miny, maxx: b.maxx, maxy: b.maxy };
            var prevD = state.agarzBorderDims;
            var dimsChanged = !prevD ||
              Math.abs(dims.minx - prevD.minx) > 50 ||
              Math.abs(dims.miny - prevD.miny) > 50 ||
              Math.abs(dims.maxx - prevD.maxx) > 50 ||
              Math.abs(dims.maxy - prevD.maxy) > 50;
            state.agarzBorderDims = dims;
            if (state.agarzBorderSent && !dimsChanged) return [];
            state.agarzBorderSent = true;
            var outB = [buildAgarBorder(b.minx, b.miny, b.maxx, b.maxy, state.ownPid)];
            // Border resets agar.su posSize=1 → push CAMERA so spectate stays zoomed out.
            if (!state.ownPid) outB.push(new Uint8Array([AGAR.CAMERA]));
            return outB;
          }
          case agarz.S2C.PLAYER_ID: {
            state.ownPid = agarz.parsePlayerId(u8);
            return [buildAgarBorder(0, 0, 30000, 30000, state.ownPid)];
          }
          case agarz.S2C.ADD_CHAT:
          case agarz.S2C.ADD_CHAT_ADMIN: {
            var t = agarz.parseChat(u8);
            if (t) return [buildAgarChat(255, 190, 70, '', t)];
            return [];
          }
          case agarz.S2C.SYNC_ASSETS: {
            var sy = agarz.parseSyncAssets(u8);
            if (sy) {
              var powN = solveAssetPow(sy.challengeStr, sy.difficulty);
              if (powN >= 0) sendUpstream(agarz.buildAssetVerified(powN));
            }
            return [];
          }
          default: return [];
        }
      }

      return adapter.decode(u8);
    }

    return {
      protocol: proto,
      host: state.host,
      state: state,
      adapter: adapter,
      isPassthrough: proto === PROTO.AGAR_SU,
      onOpen: onOpen,
      encodeClientPacket: encodeClientPacket,
      decodeServerPacket: decodeServerPacket
    };
  }

  global.MultiProtocols = {
    PROTO: PROTO,
    detectProtocol: detectProtocol,
    isOfficial: isOfficial,
    normalizeHost: normalizeHost,
    sanitizeNickForHost: sanitizeNickForHost,
    createEngine: createEngine,
    DeltaCrypto: DeltaCrypto,
    AGAR: AGAR,
    adapters: { agarz: agarz, delta: delta, agarSu: agarSuAdapter }
  };
})(typeof window !== 'undefined' ? window : globalThis);
