import { getPixi } from "../render/pixi.js";
import { CELL_TEX_RADIUS } from "../config/constants.js";
import { hexToPixiTint } from "../utils/color.js";

export class Cell {
    static NAME_CACHE = new Map();
    static MASS_POOL = [];

    constructor(core, id, x, y, r, sprite, name, color) {
        this.core = core;
        this.sprite = sprite;
        this.id = id;
        this.x = this.nx = this.ox = x;
        this.y = this.ny = this.oy = y;
        this.r = this.nr = this.or = r;
        this._color = color;
        this._name = name;
        this.updated = Date.now();
        this.hasChanged = true;
        this.skinSprite = null;
        this.skinMask = null;
        this._visible = true;
        this.sprite.tint = hexToPixiTint(color);
    }

    _getNameTexture(name) {
        const PIXI = getPixi();
        const MAX_WIDTH = 512;
        let fontSize = 90;

        let text = new PIXI.Text(name, {
            fontFamily: "Arial",
            fontSize,
            lineJoin: "round",
            fill: "white",
            stroke: "black",
            strokeThickness: 3
        });

        if (text.width > MAX_WIDTH) {
            fontSize = Math.max(20, (MAX_WIDTH / text.width) * fontSize);
            text.style.fontSize = fontSize;
        }

        const texture = this.core.app.renderer.generateTexture(text, {
            resolution: 0,
            scaleMode: PIXI.SCALE_MODES.LINEAR
        });

        texture.baseTexture.mipmapMode = PIXI.MIPMAP_MODES.ON;
        Cell.NAME_CACHE.set(name, texture);
        text.destroy();
        return texture;
    }

    _getMassInstance() {
        const PIXI = getPixi();
        const mass = Cell.MASS_POOL.shift();
        if (mass) return mass;
        return new PIXI.Text("", {
            fontFamily: "Arial",
            fontSize: 38,
            fill: "white",
            stroke: "black",
            strokeThickness: 2,
            lineJoin: "round"
        });
    }

    _setNameSprite(value) {
        const PIXI = getPixi();
        let nameSprite;
        if (Cell.NAME_CACHE.has(value)) {
            nameSprite = new PIXI.Sprite(Cell.NAME_CACHE.get(value));
        } else {
            nameSprite = new PIXI.Sprite(this._getNameTexture(value));
        }
        if (this.nameSprite) this.nameSprite.destroy();
        nameSprite.anchor.set(0.5);
        this.sprite.addChild(nameSprite);
        this.nameSprite = nameSprite;
    }

    set name(value) {
        if (!this.hasChanged) return;

        if (!this.core.settings.names && this.nameSprite) {
            this.nameSprite.destroy();
            this.nameSprite = null;
        } else if (this.core.settings.names) {
            this._setNameSprite(value);
        }

        if (this.core?.skins) {
            if (this.core.settings.skins) {
                this.core.skins.applyToCell(this, value);
            } else {
                if (this.skinSprite) { this.skinSprite.destroy({ children: true }); this.skinSprite = null; }
                if (this.skinMask) { this.skinMask.destroy(); this.skinMask = null; }
            }
        }

        this._name = value;
    }

    get name() { return this._name; }

    set color(value) {
        if (value === this._color) return;
        this._color = value;
        this.sprite.tint = hexToPixiTint(value);
    }

    get color() { return this._color; }

    get mass() { return this._mass; }

    set mass(value) {
        if (this.massSprite) this.massSprite.text = value;
        this._mass = value;
        if (!this.hasChanged) return;
        if (this.massSprite && !this.core.settings.mass) {
            this.massSprite.destroy();
            this.massSprite = null;
        } else if (this.name && !this.massSprite && this.core.settings.mass) {
            this.massSprite = this._getMassInstance();
            this.massSprite.anchor.set(0.5, -0.9);
            this.sprite.addChild(this.massSprite);
        }
    }

    update(time) {
        const delta = Math.max(Math.min((time - this.updated) / 100, 1), 0);

        if (this.hasChanged) {
            this.mass = this.mass;
            this.name = this.name;
            this.hasChanged = false;
        }

        this.x = this.ox + (this.nx - this.ox) * delta;
        this.y = this.oy + (this.ny - this.oy) * delta;
        this.r = this.or + (this.nr - this.or) * delta;
        this.mass = Math.round(this.r * this.r / 100);

        this.sprite.x = this.x;
        this.sprite.y = this.y;
        this.sprite.scale.set(this.r / CELL_TEX_RADIUS);
        this.sprite.zIndex = this.r * 2;
    }

    destroy(killerId) {
        this.core.app.cellsByID.delete(this.id);
        if (this.core.app.ownedCells.remove(this.id) && this.core.app.ownedCells.length === 0) {
            this.core.ui.setPanelState(true);
        }
        this.destroyed = true;
        this.dead = this.core.net.now;

        if (killerId && !this.diedBy) {
            this.diedBy = killerId;
            this.updated = this.core.net.now;
        }

        this.core.app.cells.remove(this);
        this.sprite.destroy({ children: true });
    }
}
