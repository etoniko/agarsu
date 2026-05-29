import { WS_PROTOCOL } from "../config/constants.js";
import { fetchConnectToken } from "../net/challenge.js";
import { prepareData, BinaryReader, Reader, Writer } from "../utils/binary.js";
import { getColorId, rgbToHex } from "../utils/color.js";
import { levelFromPacketXp, packetXpToRealXp, normalizeFractlPart } from "../utils/math.js";
import { readAccountAvatar } from "../utils/protocol.js";
import { tryConsumeLeaderboardTheme } from "../utils/leaderboardTheme.js";
import { buildSpawnName } from "../utils/player.js";
import { normalizeBorderBounds, isBorderWrapJump, clampToBorder } from "../utils/border.js";
import { Cell } from "../entities/Cell.js";
import { getPixi } from "../render/pixi.js";

export class Network {
        static SERVER_TO_CLIENT = {
            UPDATE_PING: 2,
            UPDATE_NODES: 16,
            SPECTATE_CAMERA: 17,

            CLEAR_OWNED_CELLS: 20,
            LEADERBOARD_UPDATE: 49,
            BORDER: 64,
            CHAT_MESSAGE: 99,
            UPDATE_EXP: 114
        }

        static CLIENT_TO_SERVER = {
            SPAWN: 0,
            SPECTATE: 0x1,
            MOUSE: 0x10,
            SPLIT_PLAYER: 0x11,
            SPLIT_MINION: 0x16,
            EJECT_PLAYER: 0x15,
            EJECT_MINION: 0x17,
            CHAT: 99
        }

        constructor(core) {
            this.core = core;

            this.protocol = WS_PROTOCOL;

            this.onOpen = this.onOpen.bind(this)
            this.onMessage = this.onMessage.bind(this)
            this.onClose = this.onClose.bind(this)
            this.onError = this.onError.bind(this)

            this.leaderboardItems = []
            this.leaderboardTheme = null
            this.messages = []
            this.border = {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                centerX: 0,
                centerY: 0,
                width: 0,
                height: 0
            }
            this.ownerPlayerId = 0
            this.ping = 0
            this.pingstamp = 0
            this.connectInProgress = false
            this._wsGeneration = 0
            this._needSpectate = false
            this._isSpectating = false
            this._lastMouseX = -1
            this._lastMouseY = -1
            this._mapKey = null
            this._pendingMapClear = true
        }

async connect(addr) {
  if (this.connectInProgress) return;
  this.connectInProgress = true;

  if (this.ws) this.reset();
  this._pendingMapClear = true;

  const wsBase = addr.split("?")[0];
  const host = wsBase.replace(/^wss?:\/\//i, "").split("/")[0];
  this.core.currentServerHost = host;
  this.core.dailyTop?.refresh(host);
  if (this.core.ui) {
    this.core.ui._selectedServerHost = host;
    this.core.ui.buildServerList?.();
  }

  try {
    const connectToken = await fetchConnectToken(host);
    const qs = new URLSearchParams();
    if (localStorage.accountToken) {
      qs.set("accountToken", localStorage.accountToken);
    }
    qs.set("connectToken", connectToken);

    const wsGeneration = ++this._wsGeneration;
    const ws = (this.ws = new WebSocket(wsBase + "?" + qs.toString(), this.protocol));
    ws.binaryType = "arraybuffer";
    ws.onopen = () => this.onOpen(wsGeneration);
    ws.onmessage = (event) => this.onMessage(event, wsGeneration);
    ws.onclose = () => this.onClose(wsGeneration);
    ws.onerror = () => this.onError(wsGeneration);
  } catch (err) {
  } finally {
    this.connectInProgress = false;
  }
}





        reset() {
            const oldWs = this.ws;
            if (oldWs) {
                oldWs.onopen = null;
                oldWs.onmessage = null;
                oldWs.onclose = null;
                oldWs.onerror = null;
                try { oldWs.close(); } catch (_) {}
            }
            this.ws = null
            this._needSpectate = false
            this._isSpectating = false
            this._lastMouseX = -1
            this._lastMouseY = -1
            this._mapKey = null
            this._pendingMapClear = true
            this.messages = []
            this.border = {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                centerX: 0,
                centerY: 0,
                width: 0,
                height: 0
            }
            this.ownerPlayerId = 0
            this.leaderboardItems = []
            this.leaderboardTheme = null
			this.ping = 0
            this.pingstamp = 0
			clearInterval(this.pingInterval)
            clearInterval(this.mouseMoveInterval)
            cancelAnimationFrame(this.core.app.hueShiftingRAF)
        }

        send(data) {
            if (!this.ws || this.ws.readyState !== 1) return;
            if (data?.build) {
                this.ws.send(data.build());
            } else if (data instanceof ArrayBuffer) {
                this.ws.send(data);
            } else if (ArrayBuffer.isView(data)) {
                this.ws.send(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
            } else {
                this.ws.send(data);
            }
        }

        sendUint8(a) {
            const msg = prepareData(1);
            msg.setUint8(0, a);
            this.send(msg);
        }
        sendAccountToken() {
            const token = localStorage.accountToken;
            if (token) {
                const msg = prepareData(1 + 2 * token.length);
                msg.setUint8(0, 114);
                for (var i = 0; i < token.length; ++i) msg.setUint16(1 + 2 * i, token.charCodeAt(i), true);
                this.send(msg.buffer);
            }
        }

        onOpen(wsGeneration) {
            if (wsGeneration !== this._wsGeneration) return;

            this.sendAccountToken();

            this.send(new Uint8Array([254, 5, 0, 0, 0]));
            this.send(new Uint8Array([255, 0, 0, 0, 0]));

            if (this.core.ui?.consumeReconnectMode?.()) {
                this.core.ui.restoreGameModeAfterConnect();
            } else {
                this.core.ui.setPanelState(true);
                this.core.ui.requestServerSpectate?.();
            }
            this.pingInterval = setInterval(() => {

                if (!document.hidden) {
                    this.pingstamp = Date.now();
                    this.send(new Uint8Array([2]).buffer);
                }

            }, 3000);
            this.mouseMoveInterval = setInterval(() => {
                const { x, y } = this.getMouseWorldCoords();
                this.sendMouseMove(x, y);
            }, 40);

            this.flushSpectate();
        }

        onMessage({ data }, wsGeneration) {
            if (wsGeneration !== undefined && wsGeneration !== this._wsGeneration) return;
            this.now = Date.now()

            const reader = new Reader(new DataView(data), 0, true)
            const opcode = reader.getUint8()

            switch (opcode) {
                case Network.SERVER_TO_CLIENT.UPDATE_PING: {
                    this.ping = Date.now() - this.pingstamp;
                    break
                }
                case Network.SERVER_TO_CLIENT.UPDATE_NODES: {
                    const reader = new BinaryReader(
                        new DataView(data)
                    );
                    reader.offset++;
                    this.onNodesUpdate(reader)

                    break
                }
                case Network.SERVER_TO_CLIENT.CLEAR_OWNED_CELLS: {
                    this.onClearOwnedCells()
                    break
                }




                case Network.SERVER_TO_CLIENT.BORDER: {
                    this.onBorder(reader)
                    break
                }
                case Network.SERVER_TO_CLIENT.SPECTATE_CAMERA: {
                    this.onSpectateCamera(reader)
                    break
                }
                case Network.SERVER_TO_CLIENT.LEADERBOARD_UPDATE: {
                    this.onLoaderboard(reader)
                    break
                }
                case Network.SERVER_TO_CLIENT.CHAT_MESSAGE: {
                    this.onChatMessage(reader)
					break;
                }
                case Network.SERVER_TO_CLIENT.UPDATE_EXP: {
                    this.onUpdateXp(reader.getUint32());
                    break;
                }
            }
        }

        onClose(wsGeneration) {
            if (wsGeneration !== this._wsGeneration) return;
            this.ws = null;
            this._needSpectate = false;
            this._isSpectating = false;
            this._mapKey = null;
            this.leaderboardItems = [];
            this.leaderboardTheme = null;
            this.core.ui?.updateLeaderboard?.();
            this.core.app.clear();
        }

        onError(wsGeneration) {
            if (wsGeneration !== this._wsGeneration) return;
            this.ws = null;
            this._needSpectate = false;
            this._isSpectating = false;
            this._mapKey = null;
            this.core.app.clear();
        }

        isBorderReady() {
            const b = this.border;
            return !!(b && (b.right !== b.left) && (b.bottom !== b.top));
        }

        getFoodPosition(id) {
            const { left, top, width, height } = this.border;
            return {
                x: left + width * normalizeFractlPart(id),
                y: top + height * normalizeFractlPart(id * id)
            };
        }

        repositionAllFood() {
            if (!this.isBorderReady()) return;
            for (const cell of this.core.app.cells) {
                if (!cell?.isFood || cell.destroyed) continue;
                const pos = this.getFoodPosition(cell.id);
                cell.nx = pos.x;
                cell.ny = pos.y;
                cell.nr = cell.r || 15;
                this.core.app.snapCellPosition(cell);
                cell.updated = this.now || Date.now();
            }
        }

        clearWorldCells() {
            const cells = [...this.core.app.cells];
            for (const cell of cells) {
                if (!cell || cell.destroyed) continue;
                cell.destroy(null);
            }
        }

        addCell(id, x, y, r, name, color, isFood = false) {
            const cellsByID = this.core.app.cellsByID;
            const cells = this.core.app.cells;
            const PIXI = getPixi();
            const sprite = new PIXI.Container();
            sprite.sortableChildren = true;
            this.core.app.stage.addChild(sprite);
            const cell = new Cell(this.core, id, x, y, r, sprite, name, color, isFood);
            cellsByID.set(id, cell);
            cells.push(cell);
        }

        get isSpectating() {
            return this._isSpectating;
        }

        markAsSpectating() {
            this._isSpectating = true;
            this._needSpectate = false;
        }

spawn() {
    this._needSpectate = false;
    this._isSpectating = false;
    this._lastMouseX = -1;
    this._lastMouseY = -1;
    const name = buildSpawnName(this.core.store);
    const colorId = getColorId(localStorage.getItem("selectedColor")) || 0;

    const msg = prepareData(4 + 2 * name.length);

    let offset = 0;
    msg.setUint8(offset++, 0);
    msg.setUint8(offset++, colorId);

    for (let i = 0; i < name.length; i++) {
        msg.setUint16(offset, name.charCodeAt(i), true);
        offset += 2;
    }
    msg.setUint16(offset, 0, true);

    this.send(msg);
}
        isSpectatorView() {
            return this.core.app.ownedCells.length === 0;
        }

        getMouseWorldCoords() {
            const cam = this.core.app.camera;
            const x = (this.core.ui.mouse.x - innerWidth / 2) / cam.s + cam.x;
            const y = (this.core.ui.mouse.y - innerHeight / 2) / cam.s + cam.y;
            return { x, y };
        }


        getSpectateClickCoords(clientX, clientY) {
            const cam = this.core.app.camera;
            let x = (clientX - innerWidth / 2) / cam.s + cam.x;
            let y = (clientY - innerHeight / 2) / cam.s + cam.y;
            if (this.border.width > 0) {
                return clampToBorder(x, y, this.border);
            }
            return { x, y };
        }

        requestSpectate() {
            if (this._isSpectating) return;
            if (this.core.app.ownedCells.length > 0) return;
            this._needSpectate = true;
            this.flushSpectate();
        }

        flushSpectate() {
            if (!this._needSpectate) return;
            if (!this.ws || this.ws.readyState !== 1) return;
            if (this.core.app.ownedCells.length > 0) {
                this._needSpectate = false;
                return;
            }

            this.sendUint8(Network.CLIENT_TO_SERVER.SPECTATE);

            if (this.border.width > 0) {
                this._needSpectate = false;
                this._isSpectating = true;
                const cx = this.border.centerX;
                const cy = this.border.centerY;
                const cam = this.core.app.camera;
                cam.target.x = cx;
                cam.target.y = cy;
                this._lastMouseX = cx;
                this._lastMouseY = cy;
                this.sendMouseMove(cx, cy);
            }
        }

        spectate() {
            this.requestSpectate();
        }

        sendMouseMove(x, y) {
            const writer = new Writer(true);
            writer.setUint8(Network.CLIENT_TO_SERVER.MOUSE);
            writer.setFloat64(x);
            writer.setFloat64(y);
            writer.setUint32(0);
            this.send(writer);
        }

        sendSpectateClick() {
            if (!this.ws || this.ws.readyState !== 1) return;
            if (this.core.app.ownedCells.length > 0) return;
            this.sendUint8(Network.CLIENT_TO_SERVER.SPECTATE);
        }

        sendChatMessage(text) {
            const writer = new Writer()
            writer.setUint8(Network.CLIENT_TO_SERVER.CHAT)
            writer.setUint8(0)
            writer.setStringUTF16(text)
            this.send(writer)
        }

        onChatMessage(reader) {
            const flagMask = reader.getUint8();
            const color = {
                r: reader.getUint8(),
                g: reader.getUint8(),
                b: reader.getUint8()
            };
            const playerXp = reader.getUint32();
            const accountAvatar = readAccountAvatar(reader);
            const pId = reader.getUint16();
            const name = reader.getStringUTF16();
            const content = reader.getStringUTF16();

            this.messages.push({
                color,
                name,
                content,
                playerXp,
                realXp: packetXpToRealXp(playerXp),
                level: levelFromPacketXp(playerXp),
                accountAvatar,
                pId
            });
            const CHAT_MAX = 100;
            if (this.messages.length > CHAT_MAX) {
                this.messages.splice(0, this.messages.length - CHAT_MAX);
            }
            this.core.ui.updateChat();
            this.core.ui.chatContent.scrollTop = 9000000;
        }

        onSpectateCamera(_reader) {
            this.core.app.camera.target.s = 0.2;
        }

        onLoaderboard(reader) {
            this.leaderboardItems = [];
            const count = reader.getUint32();
            for (let i = 0; i < count; ++i) {
                const nodeId = reader.getUint32();
                const name = reader.getStringUTF16();
                const playerXp = reader.getUint32();
                const accountAvatar = readAccountAvatar(reader);
                this.leaderboardItems.push({
                    id: nodeId,
                    name,
                    playerXp,
                    realXp: packetXpToRealXp(playerXp),
                    level: levelFromPacketXp(playerXp),
                    accountAvatar
                });
            }
            const theme = tryConsumeLeaderboardTheme(reader);
            if (theme) this.leaderboardTheme = theme;
            this.core.ui.updateLeaderboard();
        }

        onUpdateXp(packetXp) {
            const realXp = packetXpToRealXp(packetXp);
            this.core.account.xp = realXp;
            this.core.account.level = levelFromPacketXp(packetXp);
            this.core.accounts?.updateXp(realXp);
            if (this.core.ui?.updateAccountLevel) {
                this.core.ui.updateAccountLevel();
            }
        }

        onBorder(reader) {
  this.border.left = reader.getFloat64()
  this.border.top = reader.getFloat64()
  this.border.right = reader.getFloat64()
  this.border.bottom = reader.getFloat64()

  const mapKey = `${this.border.left}|${this.border.top}|${this.border.right}|${this.border.bottom}`;
  if (this._pendingMapClear || (this._mapKey !== null && this._mapKey !== mapKey)) {
      this.clearWorldCells();
  }
  this._pendingMapClear = false;
  this._mapKey = mapKey;


  const rawMinSize = reader.getUint16();
  const rawMaxSize = reader.getUint16();
  this.ownerPlayerId = reader.getUint32()
  normalizeBorderBounds(this.border)
  this.core.app.drawBackground()
  this.core.app.drawSectors()
  this.core.app.updateCenterTopPosition()
  this.core.app.updateMinimap()

  this.repositionAllFood();
  this.core.app.refreshCellsAfterMapChange();

  if (this.core.app.ownedCells.length === 0) {
      const cam = this.core.app.camera;
      cam.x = cam.target.x = this.border.centerX;
      cam.y = cam.target.y = this.border.centerY;
      const targetZoom = this.core.app.viewRange() * 0.2;
      cam.s = cam.target.s = this.core.app.viewZoom = targetZoom;
      this.core.app._lastPivotX = NaN;
      this.core.app._lastScale = NaN;
  }

  this.flushSpectate();
}


        sendSplit() {
            const writer = new Writer(true)
            writer.setUint8(Network.CLIENT_TO_SERVER.SPLIT_PLAYER)
            this.send(writer)
        }

        sendE() {
            const writer = new Writer(true)
            writer.setUint8(22)
            this.send(writer)
        }

        sendR() {
            const writer = new Writer(true)
            writer.setUint8(23)
            this.send(writer)
        }

        sendT() {
            const writer = new Writer(true)
            writer.setUint8(24)
            this.send(writer)
        }

        sendP() {
            const writer = new Writer(true)
            writer.setUint8(25)
            this.send(writer)
        }

        sendEject() {
            const writer = new Writer(true)
            writer.setUint8(Network.CLIENT_TO_SERVER.EJECT_PLAYER)
            this.send(writer)
        }

        onClearOwnedCells() {
            this.core.app.ownedCells = [];
            if (this.ws?.readyState === 1) {
                this._isSpectating = true;
            }
        }

        onClearAll() {
            this.core.app.clear()
        }

        rgbToHex(arr) {
            let hex = ""

            for (const rawColor of arr) {
                const color = rawColor.toString(16)
                hex += color.length == 1 ? `0${color}` : color
            }

            return `0x${hex}`
        }

        onNodesUpdate(reader) {
            let cellsByID = this.core.app.cellsByID

            for (let killed; killed = reader.uint32();) {
                const killer = reader.uint32();
                if (!cellsByID.has(killer) || !cellsByID.has(killed)) continue;
                cellsByID.get(killed).destroy(killer);
            }

            for (let id; id = reader.uint32();) {
                const type = reader.uint8();

                let posX = 0;
                let posY = 0;
                let size = 0;
                let playerId = 0;

                if (type === 1) {
                    size = 15;
                } else {
                    if (type === 0) playerId = reader.uint32();
                    posX = reader.int32();
                    posY = reader.int32();
                    size = reader.uint16();
                }

                const r = reader.uint8();
                const g = reader.uint8();
                const b = reader.uint8();
                const color = rgbToHex(r, g, b);

                const spiked = reader.uint8();
                const flagVirus = !!(spiked & 0x01);
                const flagEjected = !!(spiked & 0x20);
                const flagAgitated = !!(spiked & 0x10);

                const name = reader.utf8();

                if (reader.canRead) {
                    const marker = reader.uint8();
                    if (marker === 0xFF) {
                        reader.uint8();
                    }
                }

                const isFood = type === 1;
                if (isFood) {
                    if (!this.isBorderReady()) continue;
                    const foodPos = this.getFoodPosition(id);
                    posX = foodPos.x;
                    posY = foodPos.y;
                }

  if (cellsByID.has(id)) {
    const cell = cellsByID.get(id);
    const prevX = cell.x;
    const prevY = cell.y;

    cell.isFood = isFood;
    cell.isVirus = flagVirus;
    cell.isEjected = flagEjected;
    cell.isAgitated = flagAgitated;
    cell.flag = spiked;
    cell.updated = this.now;

    cell.nx = posX;
    cell.ny = posY;
    cell.nr = size;

    if (isFood) {
        this.core.app.snapCellPosition(cell);
    } else if (isBorderWrapJump(this.border, prevX, prevY, posX, posY)) {
        this.core.app.snapCellPosition(cell);
    } else {
        cell.ox = cell.x;
        cell.oy = cell.y;
        cell.or = cell.r;
    }

if (color && color !== cell.color) {
  cell.hasChanged = true;
  cell.color = color;
}

if (!isFood && name && name !== cell.name) {
  cell.hasChanged = true;
  cell.name = name;
}
  } else {
    this.addCell(id, posX, posY, size, name, color, isFood);

    const cell = this.core.app.cellsByID.get(id);
    if (cell) {
      cell.isVirus = flagVirus;
      cell.isEjected = flagEjected;
      cell.isAgitated = flagAgitated;
      cell.flag = spiked;
      cell.color = color;
      if (!isFood && name) {
        cell.hasChanged = true;
        cell.name = name;
      }
      if (isFood) this.core.app.snapCellPosition(cell);
    }

    if (playerId === this.ownerPlayerId) {
      this.core.app.ownedCells.push(id);
    }
  }
}


            while (reader.canRead) {
                const killed = reader.uint32();
                if (cellsByID.has(killed) && !cellsByID.get(killed).destroyed) {
                    cellsByID.get(killed).destroy(null);
                }
            }
        }
    }
