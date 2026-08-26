import { Cell } from "../game/Cell.js";
import { getColorId } from "../utils/colors.js";
import { getLevel, normalizeFractlPart } from "../utils/math.js";
import { prepareData, Writer, Reader, BinaryReader } from "../utils/binary.js";
import { getMouseDelta, getMouseWorld } from "../input/coordinates.js";
import {
    applyServerCellState,
    isValidCellState,
    shouldSnapCell,
    snapCameraTo
} from "../game/cellSync.js";
import { foodZIndex, SPECTATE_OVERVIEW_SCALE } from "../game/segments.js";
import { publishLivePlayerState, readLivePlayerState } from "./liveTabSync.js";

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
        UPDATE_EXP: 114,
        BOOST_PLAYERS: 115
    }

    static CLIENT_TO_SERVER = {
        SPAWN: 0,
        SPECTATE: 0x1,
        MOUSE: 0x10,
        SPLIT_PLAYER: 0x11,
        BOOST_START: 17,
        BOOST_STOP: 18,
        SPLIT_MINION: 0x16,
        EJECT_PLAYER: 0x15,
        EJECT_MINION: 0x17,
        CHAT: 99
    }

    constructor(core) {
        this.core = core;
        this.captcha = core.captcha;

        this.protocol = "eSejeKSVdysQvZs0ES1H";

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
        this.foodMinSize = 0
        this.foodMaxSize = 0
        this.ownerPlayerId = 0
        this.ping = 0
        this.pingstamp = 0
        this.oldMouseDx = 0
        this.oldMouseDy = 0
        this.oldMouseWorldX = -1
        this.oldMouseWorldY = -1
        this._lastSpectateX = null
        this._lastSpectateY = null
        this._followPlayerId = 0
        this.playerBoost = new Map()
        this.mapReady = false
    }

    connect(addr, passedToken) {
        const token = passedToken || (this.captcha && this.captcha.token) || "";
        if (!token && location.hostname) {
            // нет токена — попросим капчу с полным teardown после
            if (this.captcha?.getToken) {
                this.captcha.getToken().then(t => this.connect(addr, t));
            }
            return;
        }

        const params = `?token=${encodeURIComponent(token)}`;
        if (this.ws) this.reset();
        const ws = (this.ws = new WebSocket(addr + params, this.protocol));
        ws.binaryType = "arraybuffer";
        ws.onopen = this.onOpen;
        ws.onmessage = this.onMessage;
        ws.onclose = this.onClose;
        ws.onerror = this.onError;
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
        this.foodMinSize = 0
        this.foodMaxSize = 0
        this.ownerPlayerId = 0
        this.ping = 0
        this.pingstamp = 0
        this.oldMouseDx = 0
        this.oldMouseDy = 0
        this.oldMouseWorldX = -1
        this.oldMouseWorldY = -1
        this._lastSpectateX = null
        this._lastSpectateY = null
        this._followPlayerId = 0
        this.playerBoost.clear()
        this.mapReady = false
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
        console.log("[Game] Connected to server");
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
        this.mouseMoveInterval = setInterval(() => this.sendMouseMove(), 40);
    }

    onMessage({ data }) {
        this.now = Date.now()

        let reader;
        let opcode;
        try {
            reader = new Reader(new DataView(data), 0, true);
            opcode = reader.getUint8();
        } catch (err) {
            console.warn("[Game] Bad packet header:", err);
            return;
        }

        try {
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
                this.onCameraPosition(reader)
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
            case Network.SERVER_TO_CLIENT.BOOST_PLAYERS: {
                this.onBoostPlayers(reader);
                break;
            }
            default:
                break;
        }
        } catch (err) {
            console.warn("[Game] Packet", opcode, "error:", err);
        }
    }

    onBoostPlayers(reader) {
        if (!this.mapReady || !reader?.view) return;
        const count = Math.min(reader.getUint16(), 256);
        const need = 2 + count * 7;
        if (reader._o + need > reader.view.byteLength) {
            console.warn("[Game] Boost packet truncated");
            return;
        }
        for (let i = 0; i < count; i++) {
            const pID = reader.getUint32();
            const energy = reader.getUint16() / 65535;
            const boosting = reader.getUint8() === 1;
            this.playerBoost.set(pID, { energy, boosting });
        }
        this.applyBoostToCells();
    }

    applyBoostToCells() {
        const app = this.core.app;
        for (let i = 0; i < app.cells.length; i++) {
            const cell = app.cells[i];
            if (!cell || cell.destroyed || !cell.playerId) continue;
            const st = this.playerBoost.get(cell.playerId);
            if (st) {
                if (typeof cell.setBoostState === "function") {
                    cell.setBoostState(st.energy, st.boosting);
                } else {
                    cell.boostEnergy = st.energy;
                    cell.boostBoosting = st.boosting;
                    cell.boostStateKnown = true;
                }
            }
            if (cell.shouldShowBoostBar()) {
                cell._boostBlackDrawn = -1;
                cell.updateBoostBar(cell.boostEnergy, cell.boostBoosting);
            } else {
                cell.syncLabelVisibility();
            }
        }
    }

    onClose() {
        console.warn("[Game] Disconnected from server");
        this.core.app.clear()
    }
    onError() {
        console.warn("[Game] Connection error");
        this.core.app.clear()
    }

    addCell(id, x, y, r, name, color, playerId = 0) {
        let cellsByID = this.core.app.cellsByID
        let cells = this.core.app.cells

        let sprite = new PIXI.Sprite(this.core.app.textures.cell)
        sprite.anchor.set(.5)
        sprite.roundPixels = false;

        this.core.app.stage.addChild(sprite)

        const cell = new Cell(this.core, id, x, y, r, sprite, name, color);
        if (playerId) {
            cell.setPlayerId(playerId);
        } else {
            const z = foodZIndex(id);
            cell._segmentZ = z;
            cell.sprite.zIndex = z;
            cell._lastZIndex = z;
        }
        if (this.core.app.isSpectating) {
            cell.setLabelAlpha(0.5);
        }
        cellsByID.set(id, cell);
        cells.push(cell);
    }

    spawn() {
        const name = this.core.store.name + "#";
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

    /** Точка обзора / слежение за игроком (pID в байтах 9–12 пакета 13 байт). */
    sendSpectateTarget(x, y, force = false, followPlayerId = 0) {
        if (!this.ws || this.ws.readyState !== 1) return;

        const rx = Math.round(x);
        const ry = Math.round(y);
        const followPid = followPlayerId | 0;

        if (
            !force &&
            followPid === this._followPlayerId &&
            this._lastSpectateX != null &&
            Math.abs(rx - this._lastSpectateX) < 1 &&
            Math.abs(ry - this._lastSpectateY) < 1
        ) {
            return;
        }

        this._lastSpectateX = rx;
        this._lastSpectateY = ry;
        this._followPlayerId = followPid;

        const msg = prepareData(13);
        msg.setUint8(0, Network.CLIENT_TO_SERVER.MOUSE);
        msg.setInt32(1, rx, true);
        msg.setInt32(5, ry, true);
        msg.setUint32(9, followPid >>> 0, true);
        this.send(msg.buffer);
    }

    sendSpectateFollow(playerId, x, y, force = true) {
        this.sendSpectateTarget(x, y, force, playerId);
        this.spectate();
    }

    clearSpectateFollow() {
        this._followPlayerId = 0;
    }

    /** Вторая вкладка: автоматически следить за игроком из вкладки «Играть». */
    tryFollowLiveTab() {
        if (!this.core.app.isSpectating || this._followPlayerId) return false;

        const live = readLivePlayerState();
        if (!live) return false;
        if (live.pID === this.ownerPlayerId) return false;

        this.core.app.centerSpectateView(live.x, live.y);
        this.sendSpectateFollow(live.pID, live.x, live.y, true);
        return true;
    }

    publishPlayingState(x, y) {
        if (!this.core.app.ownedCells.length) return;
        publishLivePlayerState(
            this.ownerPlayerId,
            x,
            y,
            this.core.store?.name || ""
        );
    }

    sendMouseMove() {
        if (!this.ws || this.ws.readyState !== 1) return;

        const app = this.core.app;

        // Без своих клеток — мировые X/Y в 21-байт пакете (как smain.js / main.js)
        if (app.ownedCells.length === 0) {
            const { x, y } = getMouseWorld(this.core);
            if (
                Math.abs(this.oldMouseWorldX - x) < 0.01 &&
                Math.abs(this.oldMouseWorldY - y) < 0.01
            ) {
                return;
            }
            this.oldMouseWorldX = x;
            this.oldMouseWorldY = y;

            const msg = prepareData(21);
            msg.setUint8(0, Network.CLIENT_TO_SERVER.MOUSE);
            msg.setFloat64(1, x, true);
            msg.setFloat64(9, y, true);
            msg.setUint32(17, 0, true);
            this.send(msg.buffer);
            return;
        }

        // Игра: смещение от центра экрана (направление змейки)
        const { dx, dy } = getMouseDelta(this.core);

        if (
            dx * dx + dy * dy < 64 ||
            (Math.abs(this.oldMouseDx - dx) < 0.01 && Math.abs(this.oldMouseDy - dy) < 0.01)
        ) {
            return;
        }

        this.oldMouseDx = dx;
        this.oldMouseDy = dy;

        const msg = prepareData(21);
        msg.setUint8(0, Network.CLIENT_TO_SERVER.MOUSE);
        msg.setFloat64(1, dx, true);
        msg.setFloat64(9, dy, true);
        msg.setUint32(17, 0, true);
        this.send(msg.buffer);
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
        }
        const playerXp = reader.getUint32(); // TODO...

        const pId = reader.getUint16(); // TODO...

        const name = reader.getStringUTF16()
        const content = reader.getStringUTF16()

        const lvl = playerXp ? getLevel(playerXp) : -1;
        const nameWithLvl = lvl >= 0 ? `${name} [Lv ${lvl}]` : name;

        this.messages.push({
            color,
            name: nameWithLvl,
            content
        });
        this.core.ui.updateChat()
        this.core.ui.chatContent.scrollTop = 9000000
    }

    onCameraPosition(reader) {
        const app = this.core.app;
        const view = reader.view;
        const o = reader._o;
        if (!view || o + 8 > view.byteLength) return;

        const x = reader.getInt32();
        const y = reader.getInt32();

        if (app.ownedCells.length > 0) {
            app.setCameraFromServer(x, y);
        } else if (app.isSpectating) {
            app.posSize = SPECTATE_OVERVIEW_SCALE;
        }
    }

    onLoaderboard(reader) {
        this.leaderboardItems = []
        const count = reader.getUint32()
        for (let i = 0; i < count; ++i) {
            const nodeId = reader.getUint32()
            const name = reader.getStringUTF16()
            const playerXp = reader.getUint32();
            const playerLevel = playerXp ? getLevel(playerXp) : -1; // TODO...
            this.leaderboardItems.push({ id: nodeId, name: name, level: playerLevel })
        }
        this.core.ui.updateLeaderboard()
    }

    onBorder(reader) {
        const firstBorder = !this.mapReady;
        this.mapReady = true;

        this.border.left = reader.getFloat64()
        this.border.top = reader.getFloat64()
        this.border.right = reader.getFloat64()
        this.border.bottom = reader.getFloat64()
        // Размеры еды: сервер отправляет радиус напрямую (как и для клеток игроков)
        // Убираем умножение на 100 и sqrt, так как это радиус, а не масса
        const rawMinSize = reader.getUint16();
        const rawMaxSize = reader.getUint16();
        // Ограничение: еда обычно должна быть маленькой (5-15 пикселей в радиусе)
        const MAX_FOOD_RADIUS = 15;
        this.foodMinSize = Math.min(rawMinSize, MAX_FOOD_RADIUS);
        this.foodMaxSize = Math.min(rawMaxSize, MAX_FOOD_RADIUS);
        // Убеждаемся, что min <= max
        if (this.foodMinSize > this.foodMaxSize) {
            this.foodMaxSize = this.foodMinSize;
        }
        this.ownerPlayerId = reader.getUint32()
        this.border.width = this.border.right - this.border.left
        this.border.height = this.border.bottom - this.border.top
        this.border.centerX = (this.border.left + this.border.right) / 2
        this.border.centerY = (this.border.top + this.border.bottom) / 2

        if (firstBorder) {
            this.core.app.clear({ preserveSpectate: this.core.app.isSpectating });
        }

        this.core.app.drawBackground()
        this.core.app.drawGrid()
        this.core.app.drawSectors()
        this.core.app.drawMinimapBorder()

        if (firstBorder) {
            console.log("[Game] Map loaded, playerId:", this.ownerPlayerId);
        }

        // Без клеток — камера в центре карты (меню / наблюдение).
        if (this.core.app.ownedCells.length === 0) {
            const app = this.core.app;
            if (app.isSpectating) {
                app.centerSpectateView(this.border.centerX, this.border.centerY);
                this.spectate();
            } else {
                app.posX = this.border.centerX;
                app.posY = this.border.centerY;
                app.posSize = 1;
                app.viewZoom = app.viewRange();
                app.camera.x = app.posX;
                app.camera.y = app.posY;
                app.camera.s = app.viewZoom;
                app._applyCameraImmediate();
            }
        }
    }


    sendSplit() {
        const writer = new Writer(true)
        writer.setUint8(Network.CLIENT_TO_SERVER.SPLIT_PLAYER)
        this.send(writer)
    }

    sendBoost(active) {
        const writer = new Writer(true);
        writer.setUint8(active ? Network.CLIENT_TO_SERVER.BOOST_START : Network.CLIENT_TO_SERVER.BOOST_STOP);
        this.send(writer);
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
        this.core.app.mainCell = null
        if (!this.core.app.isSpectating) {
            this.core.app.exitSpectateMode()
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
        if (!this.mapReady || !this.border.width) {
            return;
        }

        const app = this.core.app;
        const cellsByID = app.cellsByID;
        const border = this.border;
        const ownerId = this.ownerPlayerId;
        const ownedPositions = {};

        for (const oid of app.ownedCells) {
            const c = cellsByID.get(oid);
            if (c && !c.destroyed) {
                ownedPositions[oid] = { x: c.x, y: c.y };
            }
        }

        try {
            for (let killed; killed = reader.uint32();) {
                reader.uint32();
            }

            for (let id; id = reader.uint32();) {
                if (!reader.canRead) break;

                const type = reader.uint8();

                let posX = 0;
                let posY = 0;
                let size = 0;
                let playerId = 0;

                if (type === 1) {
                    const w = border.width || (border.right - border.left);
                    const h = border.height || (border.bottom - border.top);
                    posX = border.left + w * normalizeFractlPart(id);
                    posY = border.top + h * normalizeFractlPart(id * id);
                    const sizeRange = Math.max(1, this.foodMaxSize - this.foodMinSize);
                    size = this.foodMinSize + (id % sizeRange);
                } else {
                    if (type === 0) {
                        if (!reader.canRead) break;
                        playerId = reader.uint32();
                    }
                    if (!reader.canRead) break;
                    posX = reader.int32();
                    posY = reader.int32();
                    size = reader.uint16();
                }

                if (!reader.canRead) break;
                const r = reader.uint8();
                const g = reader.uint8();
                const b = reader.uint8();
                if (!reader.canRead) break;
                reader.uint8();
                if (!reader.canRead) break;
                const name = reader.utf8();

                if (!isValidCellState(posX, posY, size)) {
                    continue;
                }

                const hex = ((r << 16) | (g << 8) | b);
                const color = "#" + ("000000" + hex.toString(16)).slice(-6).toUpperCase();
                const isOwned = playerId === ownerId;

                if (cellsByID.has(id)) {
                    const cell = cellsByID.get(id);
                    if (cell.destroyed) continue;

                    if (playerId) cell.setPlayerId(playerId);

                    const instant = isOwned && (
                        shouldSnapCell(cell, posX, posY, border) ||
                        ownedPositions[id] == null
                    );

                    applyServerCellState(cell, posX, posY, size, this.now, instant);

                    if (color && color !== cell.color) {
                        cell.hasChanged = true;
                        cell.color = color;
                    }
                    if (name && name !== cell.name) {
                        cell.hasChanged = true;
                        cell.name = name;
                    }
                } else {
                    this.addCell(id, posX, posY, size, name, color, playerId);
                    const cell = cellsByID.get(id);
                    if (!cell) continue;

                    applyServerCellState(cell, posX, posY, size, this.now, true);
                    cell.color = color;
                    cell.name = name;
                    if (isOwned && !app.isSpectating) {
                        app.exitSpectateMode();
                        if (!app.ownedCells.includes(id)) {
                            app.ownedCells.push(id);
                            app.ownedCells.sort((a, b) => a - b);
                        }
                        if (app.ownedCells.length === 1) {
                            app.pickMainCell();
                            snapCameraTo(app, posX, posY);
                            app.calcViewZoom();
                            app.camera.s = app.viewZoom;
                            app._applyCameraImmediate();
                            this.core.ui.updateMenuButtons();
                        }
                    }
                }
            }

            while (reader.canRead) {
                const killed = reader.uint32();
                const cell = cellsByID.get(killed);
                if (cell && !cell.destroyed) {
                    cell.destroy(null);
                }
            }
        } catch (err) {
            console.warn("[Network] onNodesUpdate parse error:", err);
            return;
        }

        app.pickMainCell();
        app.applySegmentLayers();
        this.applyBoostToCells();
    }
}
