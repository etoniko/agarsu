import { WS_PROTOCOL } from "../config/constants.js";
import { fetchConnectToken } from "../net/challenge.js";
import { prepareData, BinaryReader, Reader, Writer } from "../utils/binary.js";
import { getColorId, rgbToHex, hexToPixiTint } from "../utils/color.js";
import { levelFromPacketXp, packetXpToRealXp, normalizeFractlPart } from "../utils/math.js";
import { readAccountAvatar } from "../utils/protocol.js";
import { buildSpawnName } from "../utils/player.js";
import { Cell } from "../entities/Cell.js";
import { getPixi } from "../render/pixi.js";

export class Network {
        static SERVER_TO_CLIENT = {
            UPDATE_PING: 2,
            UPDATE_NODES: 16,
            SPECTATE_CAMERA: 17,
            // CLEAR_ALL: 300,
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
        }

async connect(addr) {
  if (this.connectInProgress) return;
  this.connectInProgress = true;

  if (this.ws) this.reset();

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

    const ws = (this.ws = new WebSocket(wsBase + "?" + qs.toString(), this.protocol));
    ws.binaryType = "arraybuffer";
    ws.onopen = this.onOpen;
    ws.onmessage = this.onMessage;
    ws.onclose = this.onClose;
    ws.onerror = this.onError;
  } catch (err) {
    console.error("Connect token error:", err);
  } finally {
    this.connectInProgress = false;
  }
}





        reset() {
            if (this.ws) this.ws.close()
            this.ws = null
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
			clearInterval(this.pingInterval)
            clearInterval(this.mouseMoveInterval)
            cancelAnimationFrame(this.core.app.hueShiftingRAF)
        }

        send(data) {
            if (!this.ws || this.ws.readyState !== 1) return
            if (data.build) this.ws.send(data.build())
            else this.ws.send(data)
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

        onOpen() {
            this.sendAccountToken();

            this.send(new Uint8Array([254, 5, 0, 0, 0]))
            this.send(new Uint8Array([255, 0, 0, 0, 0]))

            //this.spawn();
			this.core.ui.setPanelState(true);
            this.pingInterval = setInterval(() => {

                if (!document.hidden) {
                    this.pingstamp = Date.now();
                    this.send(new Uint8Array([2]).buffer); // ping
                }

            }, 3000);
            this.mouseMoveInterval = setInterval(() => {
                this.sendMouseMove(
                    (this.core.ui.mouse.x - innerWidth / 2) / this.core.app.camera.s + this.core.app.camera.x,
                    (this.core.ui.mouse.y - innerHeight / 2) / this.core.app.camera.s + this.core.app.camera.y
                );
            }, 40);
        }

        onMessage({ data }) {
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
                    reader.offset++; // skip messageType
                    this.onNodesUpdate(reader)

                    break
                }
                case Network.SERVER_TO_CLIENT.CLEAR_OWNED_CELLS: {
                    this.onClearOwnedCells()
                    break
                }
                // case Network.SERVER_TO_CLIENT.CLEAR_ALL: { // TODO
                //     this.onClearAll()
                //     break
                // }
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

        onClose() {
            this.core.app.clear()
        }
        onError() {
            this.core.app.clear()
        }

        addCell(id, x, y, r, name, color) {
            const cellsByID = this.core.app.cellsByID;
            const cells = this.core.app.cells;
            const PIXI = getPixi();
            const sprite = new PIXI.Sprite(this.core.app.textures.cell);
            sprite.anchor.set(0.5);
            sprite.roundPixels = false;
            sprite.tint = hexToPixiTint(color);
            this.core.app.stage.addChild(sprite);
            const cell = new Cell(this.core, id, x, y, r, sprite, name, color);
            cellsByID.set(id, cell);
            cells.push(cell);
        }

spawn() {
    const name = buildSpawnName(this.core.store);
    const colorId = getColorId(localStorage.getItem("selectedColor")) || 0;

    const msg = prepareData(4 + 2 * name.length); // 1+1 + имя + 0x0000

    let offset = 0;
    msg.setUint8(offset++, 0);         // opcode
    msg.setUint8(offset++, colorId);   // цвет

    for (let i = 0; i < name.length; i++) {
        msg.setUint16(offset, name.charCodeAt(i), true);
        offset += 2;
    }
    msg.setUint16(offset, 0, true);    // завершающий ноль

    this.send(msg);
}
        spectate() {
            const writer = new Writer(true)
            writer.setUint8(Network.CLIENT_TO_SERVER.SPECTATE)
            this.send(writer)
        }

        sendMouseMove(x, y) {
            const writer = new Writer(true);
            writer.setUint8(Network.CLIENT_TO_SERVER.MOUSE);
            writer.setUint32(x);
            writer.setUint32(y);
            writer._b.push(0, 0, 0, 0);
            this.send(writer);
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
            this.core.ui.updateChat();
            this.core.ui.chatContent.scrollTop = 9000000;
        }

        onSpectateCamera(reader) {
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
  // Размеры еды: сервер отправляет радиус напрямую (как и для клеток игроков)
  // Убираем умножение на 100 и sqrt, так как это радиус, а не масса
  const rawMinSize = reader.getUint16();
  const rawMaxSize = reader.getUint16();
  this.ownerPlayerId = reader.getUint32()
  this.border.width = this.border.right - this.border.left
  this.border.height = this.border.bottom - this.border.top
  this.border.centerX = (this.border.left + this.border.right) / 2
  this.border.centerY = (this.border.top + this.border.bottom) / 2
  this.core.app.drawBackground()
  this.core.app.drawSectors()
  this.core.app.updateCenterTopPosition()
  this.core.app.updateMinimap()

  // >>> ДОБАВЬ ЭТО:
  // Если мы не владеем клетками (спектатор/до спавна) — ставим камеру в центр.
  if (this.core.app.ownedCells.length === 0) {
    const cam = this.core.app.camera;
    cam.x = cam.target.x = this.border.centerX;
    cam.y = cam.target.y = this.border.centerY;

    // Чуть отдалим зум для спектатора: соответствуем логике updateCamera()
    // viewRange()*0.2 — твоя формула для spectate
    const targetZoom = this.core.app.viewRange() * 0.2;
    cam.s = cam.target.s = this.core.app.viewZoom = targetZoom;
  }
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
            this.core.app.ownedCells = []
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

            // consume records
            for (let killed; killed = reader.uint32();) {
                const killer = reader.uint32();
                if (!cellsByID.has(killer) || !cellsByID.has(killed)) continue;
                cellsByID.get(killed).destroy(killer);
            }

            for (let id; id = reader.uint32();) {
  const type = reader.uint8();

  let posX = 0;
  let posY = 0;
  let size  = 0;      // это радиус!
  let playerId = 0;

  if (type === 1) {
    // еда
    posX = this.border.left + (this.border.right * 2) * normalizeFractlPart(id);
    posY = this.border.top  + (this.border.bottom * 2) * normalizeFractlPart(id * id);
    size = 15;
  } else {
    if (type === 0) playerId = reader.uint32();
    posX = reader.int32();
    posY = reader.int32();
    size = reader.uint16(); // ← радиус
  }

  const r = reader.uint8();
  const g = reader.uint8();
  const b = reader.uint8();

  // Оптимизация: более быстрый способ создания hex цвета
  // Вместо toString(16) + padStart используем более эффективный метод
  let color = rgbToHex(r, g, b);

  const spiked = reader.uint8();
  const flagVirus    = !!(spiked & 0x01);
  const flagEjected  = !!(spiked & 0x20);
  const flagAgitated = !!(spiked & 0x10);

  const name = reader.utf8();

          let stickerData = null;
        if (reader.canRead) {
            const marker = reader.uint8();
            if (marker === 0xFF) {
                stickerData = reader.uint8();
            }
        }

  if (cellsByID.has(id)) {
    // обновление существующей клетки
    const cell = cellsByID.get(id);
    cell.update(this.now);
    cell.updated = this.now;

    cell.ox = cell.x;
    cell.oy = cell.y;
    cell.or = cell.r;

    cell.nx = posX;
    cell.ny = posY;
    cell.nr = size;

if (color && color !== cell.color) {
  cell.hasChanged = true;      // ← важная строка
  cell.color = color;          // применится даже когда клетка уже отрисована
}

if (name && name !== cell.name) {
  cell.hasChanged = true;      // ← важная строка
  cell.name = name;            // перерисует текст/скин
}
  } else {
    // новая клетка
    this.addCell(id, posX, posY, size, name, color);

    // сразу применяем текущие имя/цвет через сеттеры (hasChanged уже true)
    const cell = this.core.app.cellsByID.get(id);
    if (cell) {
      cell.color = color;
      cell.name  = name;
    }

    if (playerId === this.ownerPlayerId) {
      this.core.app.ownedCells.push(id);
    }
  }
}


            // dissapear records
            while (reader.canRead) {
                const killed = reader.uint32();
                if (cellsByID.has(killed) && !cellsByID.get(killed).destroyed)
                    cellsByID.get(killed).destroy(null)
            }
        }
    }
