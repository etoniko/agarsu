export default class Cell {
    static NAME_CACHE = new Map()
    static NAME_CACHE_MAX = 400
    static SKIN_CACHE = new Object()
    static PENDING_SPRITES_SKIN_CACHE = new Map()
    static MASS_POOL = new Array()
    static SPRITE //pixi.sprite set later
    static CELL_RADIUS = 255
    static CELL_DIAMETER = 510

    static trimNameCache() {
        while (Cell.NAME_CACHE.size > Cell.NAME_CACHE_MAX) {
            const key = Cell.NAME_CACHE.keys().next().value
            const texture = Cell.NAME_CACHE.get(key)
            if (texture?.destroy) texture.destroy(true)
            Cell.NAME_CACHE.delete(key)
        }
    }

    static clearCaches() {
        for (const texture of Cell.NAME_CACHE.values()) {
            if (texture?.destroy) texture.destroy(true)
        }
        Cell.NAME_CACHE.clear()
    }

    static refreshAllSkins(app) {
        if (!app.core?.settings?.skins) return
        for (const cell of app.cells) {
            if (cell.flags.food || cell.flags.jagged || cell.flags.ejected) continue
            const rawName = cell.rawName || cell._name
            cell.applySkin(app.getSkinUrlForCell(rawName))
        }
    }

    static refreshAllNames(app) {
        Cell.NAME_CACHE.clear()
        for (const cell of app.cells) {
            if (!cell._name || !cell.core.settings.names) continue
            cell._setNameSprite(cell._name)
        }
    }

    static parseName(value) {
        let [, skin, name] = /^(?:<([^}]*)>)?([^]*)/.exec(value || '');
        name = name.trim();
        return {
            name: name,
            skin: (skin || '').trim() || name,
        }
    }

    constructor(core, id, x, y, r, root, bodySprite, name, color, skin, flags) {
        this.core = core
        this.sprite = root
        this.bodySprite = bodySprite
        this.id = id
        this.x = this.nx = this.ox = x
        this.y = this.ny = this.oy = y
        this.r = this.nr = this.or = r
        this._color = color
        this._skin = skin
        this._name = name
        this.rawName = name
        this.playerId = 0
        this.flags = flags
        this.updateTime = Date.now()
        this.hasChanged = true

        this.skinSprite = new PIXI.Sprite()
        this.skinSprite.anchor.set(0.5)
        this.skinSprite.visible = false
        this.skinSprite.zIndex = 2
        root.addChild(this.skinSprite)

        this.skinMask = new PIXI.Graphics()
        this.skinMask.beginFill(0xffffff)
        this.skinMask.drawCircle(0, 0, Cell.CELL_RADIUS)
        this.skinMask.endFill()
        root.addChild(this.skinMask)
        this.skinSprite.mask = this.skinMask
    }

    updatePos(timestamp) {
        if (this.id === 0) return 1
        let a = (timestamp - this.updateTime) / 125
        a = Math.max(0, Math.min(1, a))
        this.x = a * (this.nx - this.ox) + this.ox
        this.y = a * (this.ny - this.oy) + this.oy
        this.r = a * (this.nr - this.or) + this.or
        return a
    }

    _getSkinTexture(skin) {
        if (Cell.SKIN_CACHE[skin]?.loading) {
            const pending = Cell.PENDING_SPRITES_SKIN_CACHE.get(skin)
            if (pending && !pending.includes(this.skinSprite)) pending.push(this.skinSprite)
            return null
        }
        if (Cell.SKIN_CACHE[skin]?.loaded) return Cell.SKIN_CACHE[skin].texture

        Cell.PENDING_SPRITES_SKIN_CACHE.set(skin, [this.skinSprite])
        Cell.SKIN_CACHE[skin] = { texture: null, loading: true, loaded: false }
        PIXI.Texture.fromURL(skin, { resourceOptions: { crossorigin: "anonymous" } }).then(texture => {
            texture.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR
            Cell.PENDING_SPRITES_SKIN_CACHE.get(skin)?.forEach(sprite => {
                sprite.texture = texture
                sprite.width = Cell.CELL_DIAMETER
                sprite.height = Cell.CELL_DIAMETER
                sprite.tint = 0xffffff
                sprite.visible = true
            })
            Cell.PENDING_SPRITES_SKIN_CACHE.delete(skin)
            Cell.SKIN_CACHE[skin] = { texture, loading: false, loaded: true }
        }).catch(() => {
            Cell.PENDING_SPRITES_SKIN_CACHE.delete(skin)
            delete Cell.SKIN_CACHE[skin]
        })
        return null
    }

    _getNameTexture(name) {
        if (!this.core.app.cellFontReady) return this.core.app.textures.cell
        const texture = this.core.app.renderer.generateTexture(new PIXI.Text(name, {
            fontSize: 100,
            lineJoin: "round",
            fontFamily: "Ubuntu",
            fill: "#FFFFFF",
            stroke: "#000000",
            strokeThickness: 1
        }))
        texture.baseTexture.mipmap = true
        if (texture !== this.core.app.textures.cell) {
            Cell.NAME_CACHE.set(name, texture)
            Cell.trimNameCache()
        }
        return texture
    }

    _getMassInstance() {
        const mass = Cell.MASS_POOL.shift()
        if (mass) return mass
        return new PIXI.BitmapText("", {
            fontName: "Ubuntu"
        })
    }

    _releaseMassSprite() {
        if (!this.massSprite) return
        if (this.massSprite.parent) this.massSprite.parent.removeChild(this.massSprite)
        Cell.MASS_POOL.push(this.massSprite)
        this.massSprite = null
    }

    _setNameSprite(value) {
        if (!value) {
            if (this.nameSprite) {
                this.nameSprite.destroy()
                this.nameSprite = null
            }
            return
        }

        let nameSprite;
        if (Cell.NAME_CACHE.has(value)) nameSprite = new PIXI.Sprite(Cell.NAME_CACHE.get(value))
        else nameSprite = new PIXI.Sprite(this._getNameTexture(value))

        if (this.nameSprite) this.nameSprite.destroy()

        nameSprite.anchor.set(0.5)
        nameSprite.scale.set(1)
        nameSprite.zIndex = 3
        this.sprite.addChild(nameSprite)
        this.nameSprite = nameSprite
    }

    applyName(value) {
        if (this.flags.food) value = ""
        if (!value) return

        if (!this.core.settings.names) {
            if (this.nameSprite) {
                this.nameSprite.destroy()
                this.nameSprite = null
            }
            this._name = value
            return
        }

        if (this._name === value && this.nameSprite) return
        this._name = value
        this._setNameSprite(value)
    }

    set name(value) {
        this.applyName(value)
    }

    get name() {
        return this._name
    }

    applyColor(value) {
        this._color = value
        if (this.flags.jagged) {
            this.bodySprite.texture = this.core.app.textures.virus
            this.bodySprite.tint = 0xffffff
            if (this.skinSprite) this.skinSprite.visible = false
            return
        }
        this.bodySprite.texture = this.core.app.textures.cell
        this.bodySprite.tint = value
    }

    set color(value) {
        this.applyColor(value)
    }

    get color() {
        return this._color
    }

    get mass() {
        return this._mass
    }

    _shouldShowMass(value) {
        return this.core.settings.mass
            && !this.flags.food
            && !this.flags.jagged
            && !this.flags.ejected
            && value > 100
    }

    _updateMassDisplay(value) {
        if (this.flags.food) value = 0
        this._mass = value

        if (!this._shouldShowMass(value)) {
            this._releaseMassSprite()
            return
        }

        if (!this.massSprite) {
            this.massSprite = this._getMassInstance()
            this.massSprite.anchor.set(0.5, -1)
            this.massSprite.zIndex = 4
            this.sprite.addChild(this.massSprite)
        }
        this.massSprite.text = String(value)
    }

    set mass(value) {
        if (!this.hasChanged) return
        this._updateMassDisplay(value)
    }

    get skin() {
        return this._skin
    }

    applySkin(value) {
        if (this.flags.jagged || this.flags.food || this.flags.ejected) {
            this._skin = value
            if (this.skinSprite) this.skinSprite.visible = false
            return
        }

        if (!value || !this.core.settings.skins) {
            this._skin = value
            if (this.skinSprite) this.skinSprite.visible = false
            return
        }

        if (this._skin === value && this.skinSprite.visible) return

        this._skin = value
        this.bodySprite.texture = this.core.app.textures.cell
        this.bodySprite.tint = this._color
        const texture = this._getSkinTexture(value)
        if (texture) {
            this.skinSprite.texture = texture
            this.skinSprite.width = Cell.CELL_DIAMETER
            this.skinSprite.height = Cell.CELL_DIAMETER
            this.skinSprite.tint = 0xffffff
            this.skinSprite.visible = true
        } else {
            this.skinSprite.visible = false
        }
    }

    set skin(value) {
        this.applySkin(value)
    }

    update(timestamp) {
        this.updatePos(timestamp)

        if (this.hasChanged) {
            this.color = this.color
            this.mass = this.mass
            this.name = this.name
            this.hasChanged = false
        }

        if (!this.flags.food) this._updateMassDisplay(Math.round(this.r * this.r / 100))

        const size = this.r * 2
        const scale = size / Cell.CELL_DIAMETER
        this.sprite.position.set(this.x, this.y)
        this.sprite.scale.set(scale)
        this.sprite.zIndex = Math.floor(size)
    }


    destroy(killerId) {
        this.core.app.cellsByID.delete(this.id);
        if (this.core.app.ownedCells.remove(this.id) && this.core.app.ownedCells.length === 0) {
            this.core.net.wantSpawn = false
            this.core.net.wantSpectate = false
            this.core.ui.setPanelState(true)
        }
        this.destroyed = true;
        this.dead = this.core.net.now;

        if (killerId && !this.diedBy) {
            this.diedBy = killerId;
            this.updateTime = this.core.net.now;
        }

        this.core.app.cells.remove(this)
        this.sprite.destroy({ children: true })
    }

}
