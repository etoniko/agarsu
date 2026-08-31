/**
 * Agar.su multi-protocol adapters.
 *
 * Native agar.su servers stay on the default path in main.js.
 * Third-party games (Bubble, …) live here and talk their own wire format.
 *
 * Security (always):
 * - nick#pass → only nick is sent to foreign servers (never password)
 * - agar.su LK / accountToken / connectToken → only for trusted agar.su projects
 * - foreign project tokens (e.g. Bubble JWT) are optional and separate
 */
(function (global) {
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
  var BUBBLE_FOOD_MIN_U16 = 12;
  var BUBBLE_FOOD_MAX_U16 = 125;
  var PID_PLACEHOLDER = 0xfffffffe;

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
    return Promise.resolve(existing);
  }

  function isBubbleAccountNick(name) {
    var d = publicNick(name).toLowerCase().replace(/\s+/g, " ");
    if (!d) return false;
    if (d === "player agarsu" || d === "[su] player agarsu") return true;
    if (/^\[su\]\s*player\s*aga/i.test(d)) return true;
    return false;
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
      var name = publicNick(it.name || "");
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
    var nm = String(name || "player").slice(0, 80);
    var tx = publicNick(text) || String(text || "");
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
    var off = start;
    if (off + 2 > buf.length) return null;
    var eatN = buf.getUint16(off, true);
    off += 2;
    var eaten = [];
    for (var i = 0; i < eatN && off + 8 <= buf.length; i++) {
      var killer = buf.getUint32(off, true);
      off += 4;
      var killed = buf.getUint32(off, true);
      off += 4;
      eaten.push({ killer: killer, killed: killed });
    }
    var cells = [];
    while (off + 4 <= buf.length) {
      var id = buf.getUint32(off, true);
      off += 4;
      if (id === 0) break;
      if (off + 11 > buf.length) break;
      var x = buf.getInt32(off, true); off += 4;
      var y = buf.getInt32(off, true); off += 4;
      var size = buf.getInt16(off, true); off += 2;
      var r = buf.getUint8(off++);
      var g = buf.getUint8(off++);
      var b = buf.getUint8(off++);
      var flags = buf.getUint8(off++);
      if (flags & 2 && off + 4 <= buf.length) off += 4;
      var skin = "";
      if (flags & 4) {
        while (off < buf.length) {
          var ch = buf.getUint8(off++);
          if (!ch) break;
          skin += String.fromCharCode(ch);
        }
      }
      var name = "";
      while (off + 1 < buf.length) {
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

      var display = name;
      if (skin && display) display = skin + "\n" + display;
      else if (skin && !display) display = skin;

      cells.push({
        id: id,
        x: x,
        y: y,
        size: size,
        r: r,
        g: g,
        b: b,
        flags: flags,
        name: display,
        type: type,
      });
    }
    var removes = [];
    if (off + 4 <= buf.length) {
      var remN = buf.getUint32(off, true) >>> 0;
      off += 4;
      var maxByBytes = Math.floor((buf.length - off) / 4);
      if (remN > maxByBytes) remN = maxByBytes;
      for (var j = 0; j < remN && off + 4 <= buf.length; j++) {
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
        playNick: "",
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
    encodeNick: function (rawNick, S) {
      var nick = publicNick(rawNick) || "agar.su";
      if (S && S.protocolState) S.protocolState.playNick = nick;
      return [utf16Packet(0, nick)];
    },
    encodeSpectate: function () {
      return [new Uint8Array([1])];
    },
    encodeChat: function (text) {
      var s = String(text || "").slice(0, 200);
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
            name: c.name || "",
            playerId: 0,
          };
          if (isOwn && owner) {
            row.type = 0;
            row.playerId = owner;
            if (state.playNick) row.name = state.playNick;
          } else if (row.type === 0) {
            row.playerId = (c.id >>> 0) || 1;
            if (owner && row.playerId === owner) row.playerId = (row.playerId ^ 0x00ffffff) >>> 0 || 1;
            if (state.playNick && isBubbleAccountNick(row.name)) row.name = state.playNick;
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
          items.push({ id: id, name: publicNick(name) });
        }
        for (var li2 = 0; li2 < items.length; li2++) {
          if (state.playNick && isBubbleAccountNick(items[li2].name)) items[li2].name = state.playNick;
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
        var chatName = publicNick(cname) || "player";
        if (state.playNick && isBubbleAccountNick(chatName)) chatName = state.playNick;
        return [buildAgarChat(r || 100, g || 200, b || 255, chatName, ctext)];
      }

      // 90 and others — ignore
      return [];
    },
  });

  global.AgarProtocols = {
    register: register,
    resolve: resolve,
    publicNick: publicNick,
    splitSkinNick: splitSkinNick,
    get: function (id) {
      return byId.get(id) || null;
    },
    list: function () {
      return list.slice();
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
