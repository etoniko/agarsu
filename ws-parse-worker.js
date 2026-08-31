/**
 * WS binary parse worker — no DOM, no Cell objects.
 * Main thread applies structured packets to game state / UI.
 */
(function () {
  "use strict";

  const OP = {
    PING: 2,
    UPDATE_NODES: 16,
    UPDATE_CAMERA: 17,
    CLEAR_NODES: 20,
    CUSTOM_LB: 48,
    FFA_LB: 49,
    BORDERS: 64,
    BAN: 91,
    CHAT: 99,
    XP: 114,
    STICKER: 200
  };

  let mapBounds = {
    ready: false,
    left: 0,
    top: 0,
    right: 10000,
    bottom: 10000
  };

  function BinaryReader(view) {
    this.view = view;
    this.byteLength = view.byteLength;
    this.offset = 0;
  }
  BinaryReader.prototype = {
    get canRead() {
      return this.offset < this.byteLength;
    },
    uint8() {
      return this.view.getUint8(this.offset++);
    },
    int8() {
      return this.view.getInt8(this.offset++);
    },
    uint16() {
      return this.view.getUint16((this.offset += 2) - 2, true);
    },
    int16() {
      return this.view.getInt16((this.offset += 2) - 2, true);
    },
    uint32() {
      return this.view.getUint32((this.offset += 4) - 4, true);
    },
    int32() {
      return this.view.getInt32((this.offset += 4) - 4, true);
    },
    float64() {
      return this.view.getFloat64((this.offset += 8) - 8, true);
    },
    utf16() {
      let str = "";
      let char;
      while (this.canRead && (char = this.uint16())) str += String.fromCharCode(char);
      return str;
    },
    utf8() {
      let text = "";
      const view = this.view;
      for (let byte1; (byte1 = this.canRead && view.getUint8(this.offset++)); ) {
        if (byte1 <= 127) text += String.fromCharCode(byte1);
        else if (byte1 <= 223) {
          text += String.fromCharCode(((byte1 & 31) << 6) | (view.getUint8(this.offset++) & 63));
        } else if (byte1 <= 239) {
          text += String.fromCharCode(
            ((byte1 & 15) << 12) |
              ((view.getUint8(this.offset++) & 63) << 6) |
              (view.getUint8(this.offset++) & 63)
          );
        } else {
          let codePoint =
            ((byte1 & 7) << 18) |
            ((view.getUint8(this.offset++) & 63) << 12) |
            ((view.getUint8(this.offset++) & 63) << 6) |
            (view.getUint8(this.offset++) & 63);
          if (codePoint >= 65536) {
            codePoint -= 65536;
            text += String.fromCharCode(55296 | (codePoint >> 10), 56320 | (codePoint & 1023));
          } else text += String.fromCharCode(codePoint);
        }
      }
      return text;
    }
  };

  function normalizeFractlPart(n) {
    return (n % (Math.PI * 2)) / (Math.PI * 2);
  }

  function computeFoodPosition(nodeid) {
    return {
      x: mapBounds.left + mapBounds.right * 2 * normalizeFractlPart(nodeid),
      y: mapBounds.top + mapBounds.bottom * 2 * normalizeFractlPart(nodeid * nodeid)
    };
  }

  function readUtf16At(view, offset) {
    let text = "";
    let o = offset;
    let char;
    while ((char = view.getUint16(o, true)) !== 0) {
      o += 2;
      text += String.fromCharCode(char);
    }
    o += 2;
    return { text, offset: o };
  }

  function parseUpdateNodes(view) {
    const reader = new BinaryReader(view);
    reader.offset = 1; // skip opcode
    const kills = [];
    for (let killedId; (killedId = reader.uint32()); ) {
      kills.push({ killedId, killerId: reader.uint32() });
    }
    const upserts = [];
    for (let nodeid; (nodeid = reader.uint32()); ) {
      const type = reader.uint8();
      let posX = 0;
      let posY = 0;
      let size = 0;
      let playerId = 0;
      let skip = false;
      if (type === 1) {
        if (mapBounds.ready) {
          const foodPos = computeFoodPosition(nodeid);
          posX = foodPos.x;
          posY = foodPos.y;
        } else {
          skip = true;
        }
      } else {
        if (type === 0) playerId = reader.uint32();
        posX = reader.int32();
        posY = reader.int32();
        size = reader.uint16();
      }
      const r = reader.uint8();
      const g = reader.uint8();
      const b = reader.uint8();
      const color = "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
      const spiked = reader.uint8();
      const name = reader.utf8();
      let stickerFromUpdate = null;
      if (reader.canRead) {
        const marker = reader.uint8();
        if (marker === 255) stickerFromUpdate = reader.uint8() || null;
        else if (marker === 0) stickerFromUpdate = false;
      }
      if (skip) continue;
      upserts.push({
        id: nodeid,
        type,
        playerId,
        x: posX,
        y: posY,
        size,
        color,
        spiked,
        flagVirus: !!(spiked & 1),
        flagEjected: !!(spiked & 32) || !!(spiked & 64),
        flagAgitated: !!(spiked & 16),
        isFood: type === 1 || type === 4,
        name,
        stickerFromUpdate
      });
    }
    const destroys = [];
    while (reader.canRead) {
      destroys.push(reader.uint32());
    }
    return { type: "updateNodes", kills, upserts, destroys };
  }

  function parsePacket(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 1) return { type: "empty" };
    const messageType = view.getUint8(0);
    let offset = 1;

    switch (messageType) {
      case OP.BAN: {
        const banRemaining = view.getUint32(offset, true);
        offset += 4;
        const reason = readUtf16At(view, offset);
        return { type: "ban", banRemaining, banReason: reason.text };
      }
      case OP.PING:
        return { type: "ping" };
      case OP.UPDATE_NODES:
        return parseUpdateNodes(view);
      case OP.UPDATE_CAMERA:
        if (view.byteLength >= offset + 12) {
          const x = view.getFloat32(offset, true);
          const y = view.getFloat32(offset + 4, true);
          const size = view.getFloat32(offset + 8, true);
          return { type: "updateCamera", x, y, size };
        }
        return { type: "updateCamera" };
      case OP.CLEAR_NODES:
        return { type: "clearNodes" };
      case OP.CUSTOM_LB: {
        const count = view.getUint32(offset, true);
        offset += 4;
        const entries = [];
        for (let i = 0; i < count; i++) {
          offset += 4; // unused id
          const s = readUtf16At(view, offset);
          offset = s.offset;
          entries.push({ id: null, name: s.text, level: -1, xp: 0 });
        }
        return { type: "customLb", entries };
      }
      case OP.FFA_LB: {
        const count = view.getUint32(offset, true);
        offset += 4;
        const entries = [];
        for (let i = 0; i < count; i++) {
          const nodeId = view.getUint32(offset, true);
          offset += 4;
          const s = readUtf16At(view, offset);
          offset = s.offset;
          const xp = view.getUint32(offset, true);
          offset += 4;
          entries.push({ id: nodeId, name: s.text, xp });
        }
        return { type: "ffaLb", entries };
      }
      case OP.BORDERS: {
        const left = view.getFloat64(offset, true); offset += 8;
        const top = view.getFloat64(offset, true); offset += 8;
        const right = view.getFloat64(offset, true); offset += 8;
        const bottom = view.getFloat64(offset, true); offset += 8;
        const foodMinMass = view.getUint16(offset, true); offset += 2;
        const foodMaxMass = view.getUint16(offset, true); offset += 2;
        const ownerPlayerId = view.getUint32(offset, true); offset += 4;
        return {
          type: "borders",
          left, top, right, bottom,
          foodMinSize: (foodMinMass * 100) ** 0.5,
          foodMaxSize: (foodMaxMass * 100) ** 0.5,
          ownerPlayerId
        };
      }
      case OP.CHAT: {
        // mirror addChat layout
        offset++; // skip one uint8
        const r = view.getUint8(offset++);
        const g = view.getUint8(offset++);
        const b = view.getUint8(offset++);
        let color = ((r << 16) | (g << 8) | b).toString(16);
        while (color.length < 6) color = "0" + color;
        const playerXp = view.getUint32(offset, true); offset += 4;
        const pId = view.getUint16(offset, true); offset += 2;
        const name = readUtf16At(view, offset); offset = name.offset;
        const message = readUtf16At(view, offset);
        return {
          type: "chat",
          pId,
          playerXp,
          color: "#" + color,
          name: name.text,
          message: message.text
        };
      }
      case OP.XP:
        return { type: "xp", xp: view.getUint32(offset, true) };
      case OP.STICKER: {
        const stickerPlayerId = view.getUint32(offset, true); offset += 4;
        const stickerId = view.getUint8(offset++);
        const stickerAction = view.getUint8(offset++);
        return {
          type: "sticker",
          stickerPlayerId,
          stickerId,
          enabled: stickerAction === 1
        };
      }
      default:
        return { type: "unknown", messageType };
    }
  }

  self.onmessage = function (ev) {
    const data = ev.data || {};
    if (data.cmd === "setBounds") {
      mapBounds = {
        ready: !!data.ready,
        left: data.left,
        top: data.top,
        right: data.right,
        bottom: data.bottom
      };
      return;
    }
    if (data.cmd === "parse") {
      try {
        const packet = parsePacket(data.buffer);
        self.postMessage({ id: data.id, ok: true, packet });
      } catch (err) {
        self.postMessage({
          id: data.id,
          ok: false,
          error: String((err && err.message) || err)
        });
      }
    }
  };
})();
