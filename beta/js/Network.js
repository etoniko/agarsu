import Cell from "./Cell.js"
import {
    fetchConnectToken,
    hideConnectVerifyOverlay,
    setConnectVerifyText,
    showConnectVerifyOverlay
} from "./ConnectPow.js"

export default class Network {
    static SERVER_TO_CLIENT = {
        PING: 2,
        BAN: 91,
        UPDATE_NODES: 16,
        SPECTATE_CAMERA: 17,
        CLEAR_OWNED_CELLS: 20,
        LEADERBOARD_CUSTOM: 48,
        LEADERBOARD_UPDATE: 49,
        BORDER: 64,
        CHAT_MESSAGE: 99,
        XP_UPDATE: 114,
        PLAYER_LIST: 169,
        STICKER: 200
    }

    static CLIENT_TO_SERVER = {
        SPAWN: 0,
        SPECTATE: 1,
        MOUSE: 16,
        SPLIT: 17,
        EJECT: 21,
        E: 22,
        R: 23,
        T: 24,
        P: 25,
        CHAT: 99,
        ACCOUNT_TOKEN: 114,
        PROTOCOL: 254,
        HANDSHAKE: 255
    }

    static WS_SUBPROTOCOL = "eSejeKSVdysQvZs0ES1H"

    constructor(core) {
        this.core = core

        this.onOpen = this.onOpen.bind(this)
        this.onMessage = this.onMessage.bind(this)
        this.onClose = this.onClose.bind(this)
        this.onError = this.onError.bind(this)

        this.minionControlled = false
        this.serverAddr = ""
        this.ping = 0
        this.leaderboardItems = []
        this.messages = []
        this.gameHandshakeReady = false
        this.wantSpawn = false
        this.wantSpectate = false
        this.ownerPlayerId = 0
        this.playerNames = new Map()
        this.foodMinSize = 0
        this.foodMaxSize = 0
        this.lastSentMouseX = -1
        this.lastSentMouseY = -1
        this.connectInProgress = false
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
    }

    async connect(addr) {
        if (this.connectInProgress) return
        this.connectInProgress = true

        if (this.ws) this.reset()

        this.serverAddr = addr.replace(/^wss?:\/\//, "")
        if (this.core.ui) this.core.ui.updateServer()

        showConnectVerifyOverlay("Подключение к серверу…")

        let connectToken = null
        try {
            connectToken = await fetchConnectToken(this.serverAddr, this.core.app.servers || {})
        } catch (err) {
            console.error("Connect token error:", err)
            this.connectInProgress = false
            setConnectVerifyText("Ошибка подключения")
            return
        }

        if (connectToken === null) {
            hideConnectVerifyOverlay()
        }

        let url = addr.startsWith("ws") ? addr : `ws${location.protocol === "https:" ? "s" : ""}://${addr}`
        const qs = new URLSearchParams()
        const accountToken = localStorage.getItem("accountToken")
        if (accountToken) qs.set("accountToken", accountToken)
        if (connectToken) qs.set("connectToken", connectToken)
        const query = qs.toString()
        if (query) url += (url.includes("?") ? "&" : "?") + query

        const ws = this.ws = new WebSocket(url, Network.WS_SUBPROTOCOL)
        ws.binaryType = "arraybuffer"
        ws.onopen = this.onOpen
        ws.onmessage = this.onMessage
        ws.onclose = this.onClose
        ws.onerror = this.onError
        this.connectInProgress = false
    }

    reset() {
        if (this.ws) this.ws.close()
        this.ws = null
        this.minionControlled = false
        this.ping = 0
        this.messages = []
        this.gameHandshakeReady = false
        this.wantSpawn = false
        this.wantSpectate = false
        this.ownerPlayerId = 0
        this.playerNames = new Map()
        this.foodMinSize = 0
        this.foodMaxSize = 0
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
        clearInterval(this.pingLoop)
        clearInterval(this.mouseMoveInterval)
    }

    send(data) {
        if (!this.ws || this.ws.readyState !== 1) return
        if (data.build) this.ws.send(data.build())
        else this.ws.send(data)
    }

    sendUint8(opcode) {
        const writer = new Writer(true)
        writer.setUint8(opcode)
        this.send(writer)
    }

    sendAccountToken() {
        const token = localStorage.getItem("accountToken")
        if (!token) return
        const writer = new Writer(true)
        writer.setUint8(Network.CLIENT_TO_SERVER.ACCOUNT_TOKEN)
        for (let i = 0; i < token.length; ++i) writer.setUint16(token.charCodeAt(i))
        this.send(writer)
    }

    onOpen() {
        hideConnectVerifyOverlay()
        this.gameHandshakeReady = false
        this.sendAccountToken()

        const protocol = new Writer(true)
        protocol.setUint8(Network.CLIENT_TO_SERVER.PROTOCOL)
        protocol.setUint32(5)
        this.send(protocol)

        const handshake = new Writer(true)
        handshake.setUint8(Network.CLIENT_TO_SERVER.HANDSHAKE)
        handshake.setUint32(0)
        this.send(handshake)
    }

    onGameHandshakeReady() {
        if (this.gameHandshakeReady) return
        this.gameHandshakeReady = true

        this.pingLoop = setInterval(() => {
            this.pingLoopTime = Date.now()
            this.sendUint8(Network.SERVER_TO_CLIENT.PING)
        }, 3000)

        this.mouseMoveInterval = setInterval(() => this.sendMouseMove(), 50)

        this.trySpawn()
        this.trySpectate()
    }

    onMessage({ data }) {
        this.now = Date.now()
        const reader = new Reader(new DataView(data), 0, true)
        const opcode = reader.getUint8()
        switch (opcode) {
            case Network.SERVER_TO_CLIENT.PING: {
                this.ping = this.now - this.pingLoopTime
                break
            }
            case Network.SERVER_TO_CLIENT.UPDATE_NODES: {
                this.onNodesUpdate(reader)
                break
            }
            case Network.SERVER_TO_CLIENT.SPECTATE_CAMERA: {
                this.onSpectateCamera(reader)
                break
            }
            case Network.SERVER_TO_CLIENT.CLEAR_OWNED_CELLS: {
                this.onClearOwnedCells()
                break
            }
            case Network.SERVER_TO_CLIENT.LEADERBOARD_CUSTOM:
            case Network.SERVER_TO_CLIENT.LEADERBOARD_UPDATE: {
                this.onLeaderboard(reader, opcode === Network.SERVER_TO_CLIENT.LEADERBOARD_CUSTOM)
                break
            }
            case Network.SERVER_TO_CLIENT.BORDER: {
                this.onBorder(reader)
                break
            }
            case Network.SERVER_TO_CLIENT.CHAT_MESSAGE: {
                this.onChatMessage(reader)
                break
            }
            case Network.SERVER_TO_CLIENT.BAN: {
                reader.getUint32()
                reader.getStringUTF16()
                break
            }
            case Network.SERVER_TO_CLIENT.XP_UPDATE: {
                reader.getUint32()
                break
            }
            case Network.SERVER_TO_CLIENT.STICKER: {
                reader.getUint32()
                reader.getUint8()
                reader.getUint8()
                break
            }
            case Network.SERVER_TO_CLIENT.PLAYER_LIST: {
                while (reader.canRead()) {
                    reader.getStringUTF8()
                    reader.getUint32()
                    reader.getStringUTF8()
                    reader.getUint32()
                    reader.getInt32()
                    reader.getInt32()
                    reader.getUint32()
                }
                break
            }
        }
    }

    onClose() {
        hideConnectVerifyOverlay()
        this.core.app.clear()
    }

    onError() {
        hideConnectVerifyOverlay()
        this.core.app.clear()
    }

    syncPlayerCells(playerId, name, skinUrl, rawName) {
        if (!playerId || !name) return

        const cached = this.playerNames.get(playerId)
        if (cached && cached.name === name && cached.skinUrl === skinUrl) return

        this.playerNames.set(playerId, { name, skinUrl, rawName })

        for (const cell of this.core.app.cells) {
            if (cell.playerId !== playerId || cell.flags.food || cell.flags.ejected) continue
            if (rawName) cell.rawName = rawName
            cell.applyName(name)
            cell.applySkin(skinUrl)
        }
    }

    addCell(id, x, y, r, name, color, skin, flags, playerId = 0) {
        let cellsByID = this.core.app.cellsByID
        let cells = this.core.app.cells

        const root = new PIXI.Container()
        root.sortableChildren = true

        const bodySprite = new PIXI.Sprite(this.core.app.textures.cell)
        bodySprite.anchor.set(0.5)

        root.addChild(bodySprite)
        this.core.app.stage.addChild(root)

        const cell = new Cell(this.core, id, x, y, r, root, bodySprite, name, color, skin, flags)
        cell.playerId = playerId
        cellsByID.set(id, cell)
        cells.push(cell)
    }

    trySpawn() {
        if (!this.gameHandshakeReady || !this.wantSpawn) return
        this.sendSpawnPacket()
    }

    trySpectate() {
        if (!this.gameHandshakeReady || !this.wantSpectate) return
        this.sendUint8(Network.CLIENT_TO_SERVER.SPECTATE)
    }

    spawn() {
        this.wantSpectate = false
        this.wantSpawn = true
        this.trySpawn()
    }

    spectate() {
        this.wantSpawn = false
        this.wantSpectate = true
        this.trySpectate()
    }

    sendSpawnPacket() {
        let nick = this.core.store.name.trim()
        let pass = (this.core.store.pass || "").trim()
        if (pass.length > 8) pass = pass.substring(0, 8)
        if (this.core.app.isPassUser(nick) || pass) nick = `${nick}#${pass}`

        const writer = new Writer(true)
        writer.setUint8(Network.CLIENT_TO_SERVER.SPAWN)
        writer.setUint8(0)
        writer.setStringUTF16(nick)
        this.send(writer)
    }

    isSpectating() {
        return this.wantSpectate && this.gameHandshakeReady && this.core.app.ownedCells.length === 0
    }

    sendMouseMove(force = false) {
        if (!this.ws || this.ws.readyState !== 1) return
        if (this.isSpectating() && !force) return

        const mouse = this.core.ui?.mouse
        if (!mouse) return

        const msgX = mouse.x - innerWidth / 2
        const msgY = mouse.y - innerHeight / 2
        if (msgX * msgX + msgY * msgY < 64) return

        const X = this.core.app.mouseWorldX
        const Y = this.core.app.mouseWorldY
        if (Math.abs(this.lastSentMouseX - X) < 0.1 && Math.abs(this.lastSentMouseY - Y) < 0.1) return

        this.lastSentMouseX = X
        this.lastSentMouseY = Y

        const writer = new Writer(true)
        writer.setUint8(Network.CLIENT_TO_SERVER.MOUSE)
        writer.setFloat64(X)
        writer.setFloat64(Y)
        writer.setUint32(0)
        this.send(writer)
    }

    sendChatMessage(text) {
        if (!text || text.length === 0 || text.length >= 200) return
        const writer = new Writer(true)
        writer.setUint8(Network.CLIENT_TO_SERVER.CHAT)
        writer.setUint8(0)
        writer.setStringUTF16(text)
        this.send(writer)
    }

    onChatMessage(reader) {
        const flagMask = reader.getUint8()
        const color = {
            r: reader.getUint8(),
            g: reader.getUint8(),
            b: reader.getUint8()
        }
        reader.getUint32()
        reader.getUint16()
        const rawName = reader.getStringUTF16()
        const content = reader.getStringUTF16()
        const name = Cell.parseName(rawName).name || "Unnamed"
        const chatNick = rawName.split("#")[0].trim()

        const server = !!(flagMask & 0x80)
        const admin = !!(flagMask & 0x40)
        const mod = !!(flagMask & 0x20)
        const hasPass = !server && !admin && !mod && this.core.app.isPassUser(chatNick)

        this.messages.push({
            server,
            admin,
            mod,
            hasPass,
            color,
            name,
            content
        })
        this.core.ui.updateChat()
        this.core.ui.chatContent.scrollTop = 9000000
    }

    onSpectateCamera(reader) {
        if (!this.wantSpectate) return

        const camera = this.core.app.camera
        if (reader.bytesRemaining() >= 12) {
            camera.target.x = reader.getFloat32()
            camera.target.y = reader.getFloat32()
            camera.target.s = reader.getFloat32()
            camera.posSize = camera.target.s
        } else {
            camera.posSize = 0.15
        }
    }

    getFoodRadius(nodeId) {
        const min = this.foodMinSize
        const max = this.foodMaxSize
        if (max <= min) return min || 10
        return min + nodeId % ((max - min) + 1)
    }

    onLeaderboard(reader, custom) {
        this.leaderboardItems = []
        const count = reader.getUint32()
        const myName = this.core.store.name?.toLowerCase()

        for (let i = 0; i < count; ++i) {
            const nodeId = reader.getUint32()
            const name = reader.getStringUTF16()
            if (!custom) reader.getUint32()

            let isMe = this.core.app.ownedCells.includes(nodeId)
            if (custom && myName && name && myName === name.toLowerCase()) {
                isMe = true
            }

            this.leaderboardItems.push({
                nodeId,
                isMe,
                name: name || "Unnamed"
            })
        }
        this.core.ui.updateLeaderboard()
    }

    onBorder(reader) {
        this.border.left = reader.getFloat64()
        this.border.top = reader.getFloat64()
        this.border.right = reader.getFloat64()
        this.border.bottom = reader.getFloat64()
        this.foodMinSize = (reader.getUint16() * 100) ** .5
        this.foodMaxSize = (reader.getUint16() * 100) ** .5
        this.ownerPlayerId = reader.getUint32()
        this.border.width = this.border.right - this.border.left
        this.border.height = this.border.bottom - this.border.top
        this.border.centerX = (this.border.left + this.border.right) / 2
        this.border.centerY = (this.border.top + this.border.bottom) / 2

        this.core.app.drawSectors()

        if (this.core.app.ownedCells.length === 0) {
            const camera = this.core.app.camera
            camera.x = camera.target.x = this.border.centerX
            camera.y = camera.target.y = this.border.centerY
            camera.s = camera.posSize = 1
        }

        this.onGameHandshakeReady()
    }

    sendSplit() {
        this.sendUint8(Network.CLIENT_TO_SERVER.SPLIT)
    }

    sendE() {
        this.sendUint8(Network.CLIENT_TO_SERVER.E)
    }

    sendR() {
        this.sendUint8(Network.CLIENT_TO_SERVER.R)
    }

    sendT() {
        this.sendUint8(Network.CLIENT_TO_SERVER.T)
    }

    sendP() {
        this.sendUint8(Network.CLIENT_TO_SERVER.P)
    }

    sendEject() {
        this.sendUint8(Network.CLIENT_TO_SERVER.EJECT)
    }

    sendMinionSwitch() {
        this.minionControlled = !this.minionControlled
        this.sendUint8(18)
    }

    onClearOwnedCells() {
        this.core.app.ownedCells = []
    }

    onClearAll() {
        this.core.app.clear()
    }

    rgbToHex(r, g, b) {
        let hex = ((r << 16) | (g << 8) | b).toString(16)
        while (hex.length < 6) hex = "0" + hex
        return `0x${hex}`
    }

    normalizeFractlPart(n) {
        return (n % (Math.PI * 2)) / (Math.PI * 2)
    }

    onNodesUpdate(reader) {
        let cellsByID = this.core.app.cellsByID

        for (let killedId; (killedId = reader.getUint32());) {
            const killerId = reader.getUint32()
            const killed = cellsByID.get(killedId)
            const killer = cellsByID.get(killerId)
            if (killer && killed) killed.destroy(killerId)
        }

        for (let nodeId; (nodeId = reader.getUint32());) {
            const type = reader.getUint8()

            let x = 0
            let y = 0
            let r = 0
            let playerId = 0

            if (type === 1) {
                x = this.border.left + (this.border.right * 2) * this.normalizeFractlPart(nodeId)
                y = this.border.top + (this.border.bottom * 2) * this.normalizeFractlPart(nodeId * nodeId)
                r = this.getFoodRadius(nodeId)
            } else {
                if (type === 0) playerId = reader.getUint32()
                x = reader.getInt32()
                y = reader.getInt32()
                r = reader.getUint16()
            }

            const color = this.rgbToHex(reader.getUint8(), reader.getUint8(), reader.getUint8())

            const spiked = reader.getUint8()
            const isNew = !cellsByID.has(nodeId)
            const flags = {
                updColor: isNew || !!(spiked & 0x02),
                updSkin: isNew || !!(spiked & 0x04),
                updName: isNew || !!(spiked & 0x08),
                jagged: !!(spiked & 0x01) || !!(spiked & 0x10),
                ejected: !!(spiked & 0x20) || !!(spiked & 0x40),
                food: type === 1
            }

            const rawName = reader.getStringUTF8()
            const parsed = Cell.parseName(type === 1 ? "" : rawName)
            const skinUrl = type === 1 ? null : this.core.app.getSkinUrlForCell(rawName)

            if (reader.canRead()) {
                const marker = reader.getUint8()
                if (marker === 0xFF) reader.getUint8()
            }

            if (isNew) {
                this.addCell(nodeId, x, y, r, parsed.name, color, skinUrl, flags, playerId)
                const cell = cellsByID.get(nodeId)
                cell.rawName = rawName
                cell.applyColor(color)
                if (parsed.name) {
                    if (type === 0 && playerId) this.syncPlayerCells(playerId, parsed.name, skinUrl, rawName)
                    else cell.applyName(parsed.name)
                }
                if (!flags.food && !flags.jagged) cell.applySkin(skinUrl)
            } else {
                const cell = cellsByID.get(nodeId)
                cell.updatePos(this.now)
                cell.ox = cell.x
                cell.oy = cell.y
                cell.or = cell.r
                cell.nx = x
                cell.ny = y
                cell.nr = r
                cell.updateTime = this.now
                cell.flags = flags
                if (type === 0) cell.playerId = playerId
                if (rawName) cell.rawName = rawName
                cell.hasChanged = true

                if (!flags.food) cell.applyColor(color)

                if (parsed.name) {
                    if (type === 0 && playerId) this.syncPlayerCells(playerId, parsed.name, skinUrl, rawName)
                    else cell.applyName(parsed.name)
                } else if (type === 0 && playerId && this.playerNames.has(playerId)) {
                    const cached = this.playerNames.get(playerId)
                    if (cell._name !== cached.name) {
                        if (cached.rawName) cell.rawName = cached.rawName
                        cell.applyName(cached.name)
                    }
                }
                if (!flags.food && !flags.jagged) cell.applySkin(skinUrl)
            }

            if (type === 0 && playerId === this.ownerPlayerId && !this.core.app.ownedCells.includes(nodeId)) {
                this.core.app.ownedCells.push(nodeId)
                if (this.core.app.ownedCells.length === 1) {
                    const camera = this.core.app.camera
                    camera.x = camera.target.x = x
                    camera.y = camera.target.y = y
                }
                this.core.ui.setPanelState(false)
            }
        }

        while (reader.canRead()) {
            const removedId = reader.getUint32()
            const cell = cellsByID.get(removedId)
            if (cell && !cell.destroyed) cell.destroy(null)
        }
    }
}

class Writer {
    constructor(littleEndian) {
        this.writer = true
        this.tmpBuf = new DataView(new ArrayBuffer(8))
        this._e = littleEndian
        this.reset()
        return this
    }

    reset(littleEndian = this._e) {
        this._e = littleEndian
        this._b = []
        this._o = 0
    }

    setUint8(a) {
        if (a >= 0 && a < 256) this._b.push(a)
        return this
    }

    setInt8(a) {
        if (a >= -128 && a < 128) this._b.push(a)
        return this
    }

    setUint16(a) {
        this.tmpBuf.setUint16(0, a, this._e)
        this._move(2)
        return this
    }

    setInt16(a) {
        this.tmpBuf.setInt16(0, a, this._e)
        this._move(2)
        return this
    }

    setUint32(a) {
        this.tmpBuf.setUint32(0, a, this._e)
        this._move(4)
        return this
    }

    setInt32(a) {
        this.tmpBuf.setInt32(0, a, this._e)
        this._move(4)
        return this
    }

    setFloat32(a) {
        this.tmpBuf.setFloat32(0, a, this._e)
        this._move(4)
        return this
    }

    setFloat64(a) {
        this.tmpBuf.setFloat64(0, a, this._e)
        this._move(8)
        return this
    }

    _move(b) {
        for (let i = 0; i < b; i++) this._b.push(this.tmpBuf.getUint8(i))
    }

    setStringUTF8(s) {
        const bytesStr = unescape(encodeURIComponent(s))
        for (let i = 0, l = bytesStr.length; i < l; i++) this._b.push(bytesStr.charCodeAt(i))
        this._b.push(0)
        return this
    }

    setStringUTF16(s) {
        for (let i = 0; i < s.length; i++) this.setUint16(s.charCodeAt(i))
        this.setUint16(0)
        return this
    }

    build() {
        return new Uint8Array(this._b)
    }
}

class Reader {
    constructor(view, offset, littleEndian) {
        this.reader = true
        this._e = littleEndian
        if (view) this.repurpose(view, offset)
    }

    repurpose(view, offset) {
        this.view = view
        this._o = offset || 0
    }

    canRead() {
        return this._o < this.view.byteLength
    }

    bytesRemaining() {
        return this.view.byteLength - this._o
    }

    getUint8() {
        return this.view.getUint8(this._o++, this._e)
    }

    getInt8() {
        return this.view.getInt8(this._o++, this._e)
    }

    getUint16() {
        return this.view.getUint16((this._o += 2) - 2, this._e)
    }

    getInt16() {
        return this.view.getInt16((this._o += 2) - 2, this._e)
    }

    getUint32() {
        return this.view.getUint32((this._o += 4) - 4, this._e)
    }

    getInt32() {
        return this.view.getInt32((this._o += 4) - 4, this._e)
    }

    getFloat32() {
        return this.view.getFloat32((this._o += 4) - 4, this._e)
    }

    getFloat64() {
        return this.view.getFloat64((this._o += 8) - 8, this._e)
    }

    getStringUTF8() {
        let text = ""
        for (let byte1; (byte1 = this.canRead() && this.view.getUint8(this._o++));) {
            if (byte1 <= 0x7F) text += String.fromCharCode(byte1)
            else if (byte1 <= 0xDF) text += String.fromCharCode(((byte1 & 0x1F) << 6) | (this.view.getUint8(this._o++) & 0x3F))
            else if (byte1 <= 0xEF) text += String.fromCharCode(((byte1 & 0x0F) << 12) | ((this.view.getUint8(this._o++) & 0x3F) << 6) | (this.view.getUint8(this._o++) & 0x3F))
            else {
                let codePoint = ((byte1 & 0x07) << 18) | ((this.view.getUint8(this._o++) & 0x3F) << 12) | ((this.view.getUint8(this._o++) & 0x3F) << 6) | (this.view.getUint8(this._o++) & 0x3F)
                if (codePoint >= 0x10000) {
                    codePoint -= 0x10000
                    text += String.fromCharCode(0xD800 | (codePoint >> 10), 0xDC00 | (codePoint & 0x3FF))
                } else text += String.fromCharCode(codePoint)
            }
        }
        return text
    }

    getStringUTF16() {
        let s = ""
        let char
        while ((char = this.getUint16()) !== 0) s += String.fromCharCode(char)
        return s
    }
}
