import Cell from "./Cell.js"

export default class Application {
    static SKIN_ORIGIN = "https://api.agar.su"
    static PASS_LIST_URL = "https://api.agar.su/pass.txt"
    static MINIMAP_SIZE = 170
    static SECTOR_COLS = 5
    static SECTOR_ROWS = 5
    static SECTOR_LINE_COLOR = 0x888888
    static SECTOR_LABEL_COLOR = 0x888888
    static SECTOR_ALPHA = 0.5

    static sectorAt(x, y, border) {
        const cols = Application.SECTOR_COLS
        const rows = Application.SECTOR_ROWS
        const relX = x - border.left
        const relY = y - border.top
        const col = Math.min(cols - 1, Math.max(0, Math.floor((relX / border.width) * cols)))
        const row = Math.min(rows - 1, Math.max(0, Math.floor((relY / border.height) * rows)))
        return String.fromCharCode(65 + row) + (col + 1)
    }

    static buildGrid(width, height, options = {}) {
        const cols = Application.SECTOR_COLS
        const rows = Application.SECTOR_ROWS
        const cellW = width / cols
        const cellH = height / rows
        const container = new PIXI.Container()
        container.alpha = options.alpha ?? 1

        const lineColor = options.lineColor ?? Application.SECTOR_LINE_COLOR
        const labelColor = options.labelColor ?? Application.SECTOR_LABEL_COLOR

        const lines = new PIXI.Graphics()
        const lineW = options.lineWidth ?? Math.max(1, Math.min(width, height) / 170)
        lines.lineStyle({
            width: lineW,
            color: lineColor,
            alpha: 0.55,
            alignment: 0.5,
            cap: PIXI.LINE_CAP.ROUND,
            join: PIXI.LINE_JOIN.ROUND,
            native: false
        })
        for (let i = 0; i <= cols; i++) {
            const x = i * cellW
            lines.moveTo(x, 0)
            lines.lineTo(x, height)
        }
        for (let i = 0; i <= rows; i++) {
            const y = i * cellH
            lines.moveTo(0, y)
            lines.lineTo(width, y)
        }
        container.addChild(lines)

        const fontSize = options.fontSize ?? Math.max(10, Math.min(cellW, cellH) * 0.22)
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const label = new PIXI.Text(String.fromCharCode(65 + row) + (col + 1), {
                    fontFamily: "Inter, Arial, sans-serif",
                    fontSize,
                    fontWeight: "500",
                    fill: labelColor,
                    align: "center",
                    resolution: Math.min(devicePixelRatio || 1, 2)
                })
                label.anchor.set(0.5)
                label.alpha = 0.85
                label.roundPixels = false
                label.position.set(col * cellW + cellW / 2, row * cellH + cellH / 2)
                container.addChild(label)
            }
        }

        return container
    }

    static buildSectors(width, height) {
        return Application.buildGrid(width, height, { alpha: Application.SECTOR_ALPHA })
    }

    static buildMinimapGrid(size) {
        return Application.buildGrid(size, size, {
            alpha: 1,
            lineColor: 0x5c5c5c,
            labelColor: 0x8b8b8b,
            fontSize: 11,
            lineWidth: 1
        })
    }

    constructor(core) {
        this.core = core

        this.initRenderer()
        this.initMinimap()

        this.cells = []
        this.cellsByID = new Map()
        this.ownedCells = []
        this.camera = {
            x: 1,
            y: 1,
            s: 1,
            zoom: 1,
            posSize: 1,
            score: 0,
            target: {
                x: 1,
                y: 1,
                s: 1
            }
        }

        this.loop = this.loop.bind(this)
        this.fps = { frames: 0, last: performance.now(), value: 0 }

        this.skinList = {}
        this.passUsers = new Set()
        this.mouseWorldX = -1
        this.mouseWorldY = -1
        this.loop()
    }

    static getServerKeyFromHash(servers) {
        const hash = location.hash.slice(1).split("?")[0]
        if (hash && servers[hash]) return hash
        return servers.ffa ? "ffa" : Object.keys(servers)[0] || null
    }

    static normalizeNick(nick) {
        if (!nick) return ""

        let n = nick.trim()

        if (n.startsWith("[")) {
            const endIndex = n.indexOf("]")
            if (endIndex === -1) return ""

            const innerNick = n.substring(1, endIndex).trim()
            if (!innerNick || innerNick !== n.substring(1, endIndex)) return ""

            return `[${innerNick}]`.toLowerCase()
        }

        if (!n || n.trim() !== n) return ""
        return n.toLowerCase()
    }

    getSkinId(nick) {
        if (!nick || !this.skinList) return null

        const tryLookup = (value) => {
            if (!value) return null
            const normalized = Application.normalizeNick(value)
            if (normalized && this.skinList[normalized]) return this.skinList[normalized]
            const cleanKey = value.replace(/\[|\]|<|>/g, "").trim().toLowerCase()
            if (this.skinList[cleanKey]) return this.skinList[cleanKey]
            if (this.skinList[`[${cleanKey}]`]) return this.skinList[`[${cleanKey}]`]
            const lower = value.trim().toLowerCase()
            if (this.skinList[lower]) return this.skinList[lower]
            return null
        }

        const raw = String(nick).trim()
        const noPass = raw.split("#")[0].trim()
        const noTags = noPass.replace(/<[^>]*>/g, "").trim()
        const parsed = Cell.parseName(raw).name

        return tryLookup(raw)
            || tryLookup(noPass)
            || tryLookup(noTags)
            || tryLookup(parsed)
    }

    getSkinUrl(nick) {
        const skinId = this.getSkinId(nick)
        return skinId ? `${Application.SKIN_ORIGIN}/skins/${skinId}.png` : null
    }

    getSkinUrlForCell(rawName) {
        return this.getSkinUrl(rawName)
    }

    getUniqueSkins() {
        const skins = new Map()
        for (const [nick, id] of Object.entries(this.skinList)) {
            if (!skins.has(id)) skins.set(id, nick)
        }
        return [...skins.entries()].map(([id, nick]) => ({
            id,
            nick,
            src: `${Application.SKIN_ORIGIN}/skins/${id}.png`
        }))
    }

    isPassUser(nick) {
        if (!nick || !this.passUsers?.size) return false
        const clean = String(nick).split("#")[0].trim()
        const normalized = Application.normalizeNick(clean)
        return normalized ? this.passUsers.has(normalized) : false
    }

    async loadInfos() {
        this.servers = await this.fetchServers()
        await Promise.all([this.fetchSkinList(), this.fetchPassList()])
        setInterval(() => this.fetchSkinList(), 300000)
        setInterval(() => this.fetchPassList(), 300000)
    }

    fetchPassList() {
        return fetch(Application.PASS_LIST_URL)
            .then(response => {
                if (!response.ok) throw new Error(String(response.status))
                return response.text()
            })
            .then(text => {
                this.passUsers = new Set(
                    text.split("\n")
                        .map(line => Application.normalizeNick(line.trim().replace(/\r$/, "")))
                        .filter(Boolean)
                )
            })
            .catch(() => {
                this.passUsers = new Set()
            })
    }

    drawSectors() {
        if (this.sectorContainer) this.sectorContainer.destroy({ children: true })

        const border = this.core.net.border
        this.sectorContainer = Application.buildSectors(border.width, border.height)
        this.sectorContainer.position.set(-border.width / 2, -border.height / 2)
        this.sectorContainer.visible = !!this.core.settings?.sectors

        this.stage.addChildAt(this.sectorContainer, 0)
    }

    initMinimap() {
        const size = Application.MINIMAP_SIZE
        const view = this.minimapView = document.getElementById("minimap-view")
        this.minimapCoordsEl = document.getElementById("minimap-coords")
        this.minimapRenderer = new PIXI.Renderer({
            view,
            width: size,
            height: size,
            backgroundAlpha: 0,
            antialiasing: true,
            resolution: Math.min(devicePixelRatio || 1, 2)
        })
        const stage = this.minimapStage = new PIXI.Container()
        const grid = this.minimapGrid = Application.buildMinimapGrid(size)
        stage.addChild(grid)

        const dot = this.minimapEntity = new PIXI.Graphics()
        dot.beginFill(0xff6b6b)
        dot.drawCircle(0, 0, 3.5)
        dot.endFill()
        dot.lineStyle(1, 0xffffff, 0.9)
        dot.drawCircle(0, 0, 5)
        stage.addChild(dot)
    }

    updateMinimap() {
        if (!this.minimapEntity) return

        const border = this.core.net?.border
        if (!border?.width) {
            if (this.minimapCoordsEl) this.minimapCoordsEl.textContent = "—"
            return
        }

        const mapSize = Application.MINIMAP_SIZE
        const relX = (this.camera.x - border.left) / border.width
        const relY = (this.camera.y - border.top) / border.height
        this.minimapEntity.position.set(
            Math.max(0, Math.min(mapSize, relX * mapSize)),
            Math.max(0, Math.min(mapSize, relY * mapSize))
        )

        if (this.minimapCoordsEl) {
            const x = Math.round(this.camera.x)
            const y = Math.round(this.camera.y)
            const sector = Application.sectorAt(this.camera.x, this.camera.y, border)
            this.minimapCoordsEl.textContent = `${sector} · ${x}, ${y}`
        }
    }

    initRenderer() {
        const view = this.view = document.getElementById("view")
        this.renderer = new PIXI.Renderer({ 
            view,
            width: innerWidth,
            height: innerHeight,
            antialiasing: false,
            powerPreference: 'high-performance'
        })
        this.stage = new PIXI.Container()
        this.stage.sortableChildren = true

        const circle = new PIXI.Graphics()
        circle.beginFill(0xffffff)
        circle.drawCircle(256, 256, Cell.CELL_RADIUS)
        circle.endFill();

        const cellRenderTexture = PIXI.RenderTexture.create({ width: 512, height: 512 })
        this.renderer.render(circle, { renderTexture: cellRenderTexture })
        cellRenderTexture.baseTexture.mipmap = true

        this.textures = { cell: cellRenderTexture, virus: cellRenderTexture }

        Cell.SPRITE = new PIXI.Sprite(cellRenderTexture)
        this.loadVirusTexture()

        this.fontReadyPromise = this.initCellFont()
    }

    async initCellFont() {
        const sample = 'AaBbCc АаБбВв 0123456789'
        try {
            await document.fonts.load(`60px Ubuntu`, sample)
            await document.fonts.load(`100px Ubuntu`, sample)
            await document.fonts.ready
        } catch {}
        if (!PIXI.BitmapFont.available.Ubuntu) {
            PIXI.BitmapFont.from("Ubuntu", {
                fontSize: 60,
                lineJoin: "round",
                fontFamily: "Ubuntu",
                fill: "#FFFFFF",
                stroke: "#000000",
                strokeThickness: 1
            })
        }
        this.cellFontReady = true
        Cell.refreshAllNames(this)
    }

    loadVirusTexture() {
        PIXI.Texture.fromURL("./assets/img/virus.png").then(loadedTexture => {
            const graphics = new PIXI.Graphics()
            graphics.beginTextureFill({ texture: loadedTexture })
            graphics.drawCircle(256, 256, Cell.CELL_RADIUS)
            graphics.endFill()
            Cell.SPRITE.addChild(graphics)
            const texture = this.renderer.generateTexture(Cell.SPRITE)
            Cell.SPRITE.removeChildren()
            texture.baseTexture.mipmap = true
            this.textures.virus = texture
            for (const cell of this.cells) {
                if (cell.flags.jagged) {
                    cell.bodySprite.texture = texture
                    cell.bodySprite.tint = 0xffffff
                }
            }
        }).catch(() => {})
    }

    fetchServers() {
        return new Promise((resolve, reject) => {
            fetch('./servers.json')
            .then(response => {
                if (!response.ok) reject()
                return response.json()
            })
            .then(servers => {
                resolve(servers)
            })
        })
    }

    fetchSkinList() {
        return fetch(`${Application.SKIN_ORIGIN}/skinlist.txt`)
            .then(response => {
                if (!response.ok) throw new Error(String(response.status))
                return response.text()
            })
            .then(data => {
                const skinList = {}
                data.split("\n").forEach(line => {
                    line = line.trim().replace(/\r$/, "")
                    if (!line) return
                    const sep = line.indexOf(":")
                    if (sep === -1) return
                    const rawNick = line.slice(0, sep).trim()
                    const id = line.slice(sep + 1).trim()
                    if (!rawNick || !id) return
                    const normalized = Application.normalizeNick(rawNick)
                    if (normalized) skinList[normalized] = id
                    skinList[rawNick.toLowerCase()] = id
                })
                this.skinList = skinList
                if (this.core.ui) this.core.ui.updateSkinPreview()
                Cell.refreshAllSkins(this)
            })
            .catch(() => {})
    }

    updateFps() {
        this.fps.frames++
        const now = performance.now()
        if (now < this.fps.last + 1000) return
        this.fps.value = Math.round(this.fps.frames * 1000 / (now - this.fps.last))
        this.fps.frames = 0
        this.fps.last = now
        const el = document.getElementById("fps")
        if (el) el.textContent = `${this.fps.value} FPS`
    }

    loop() {
        this.now = Date.now()
        for (let i = 0; i < this.cells.length; i++) this.cells[i].update(this.now)
        this.mouseCoordinateChange()
        this.updateCamera()
        this.updateFps()
        this.updateMinimap()

        this.renderer.render(this.stage)
        if (this.minimapRenderer) this.minimapRenderer.render(this.minimapStage)

        requestAnimationFrame(this.loop)
    }

    clear() {
        this.stage.removeChildren()
        this.cells = []
        this.cellsByID = new Map()
        this.ownedCells = []
        Cell.clearCaches()
    }

    viewRange() {
        const ratio = Math.max(innerHeight / 1080, innerWidth / 1920)
        return ratio * this.camera.zoom
    }

    mouseCoordinateChange() {
        const mouse = this.core.ui?.mouse
        const mouseX = mouse?.x ?? innerWidth / 2
        const mouseY = mouse?.y ?? innerHeight / 2
        this.mouseWorldX = (mouseX - innerWidth / 2) / this.camera.s + this.camera.x
        this.mouseWorldY = (mouseY - innerHeight / 2) / this.camera.s + this.camera.y
    }

    updateSpectateAim() {
        const border = this.core.net?.border
        if (!border?.width) return

        let x = Math.min(this.mouseWorldX, border.right)
        let y = Math.min(this.mouseWorldY, border.bottom)
        x = Math.max(x, border.left)
        y = Math.max(y, border.top)

        this.camera.target.x = x
        this.camera.target.y = y
    }

    calcViewZoom(cells) {
        let totalSize = 0
        for (const cell of cells) totalSize += cell.r
        const newViewZoom = Math.pow(Math.min(64 / totalSize, 1), 0.4) * this.viewRange()
        this.camera.s = (9 * this.camera.s + newViewZoom) / 10
    }

    updateCamera() {
        const cells = [];
        for (const id of this.ownedCells) {
            const cell = this.cellsByID.get(id);
            if (cell) cells.push(cell);
        }

        let score = 0
        for (const cell of cells) score += ~~(cell.r * cell.r / 100)

        if (cells.length > 0) {
            let sumX = 0
            let sumY = 0
            for (const cell of cells) {
                cell.updatePos(this.now)
                sumX += cell.x
                sumY += cell.y
            }
            const avgX = sumX / cells.length
            const avgY = sumY / cells.length

            this.calcViewZoom(cells)
            this.camera.posSize = this.camera.s

            this.camera.x = (this.camera.x + avgX) / 2
            this.camera.y = (this.camera.y + avgY) / 2
        } else if (this.core.net?.wantSpectate) {
            this.camera.x = (29 * this.camera.x + this.camera.target.x) / 30
            this.camera.y = (29 * this.camera.y + this.camera.target.y) / 30

            const newViewZoom = this.camera.posSize * this.viewRange()
            this.camera.s = (9 * this.camera.s + newViewZoom) / 10
        }

        this.stage.pivot.set(this.camera.x, this.camera.y)
        this.stage.scale.set(this.camera.s)
        this.stage.position.set(innerWidth / 2, innerHeight / 2)

        this.camera.score = score
    }
}
