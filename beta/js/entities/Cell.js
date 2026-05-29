import { getPixi } from "../render/pixi.js";
import {
    CELL_NAME_TEX_RES,
    CELL_NAME_FONT_FAMILY,
    CELL_NAME_TEXTURE_CACHE_TAG
} from "../config/constants.js";
import { hexToPixiTint } from "../utils/color.js";

const OVERSCAN = 2;

export class Cell {
    static NAME_CACHE = new Map();
    static MASS_POOL = [];

    static NAME_TEX_BUDGET_PER_FRAME = 2;
    static _texturesThisFrame = 0;
    static _nameQueue = [];

    static beginFrame() {
        Cell._texturesThisFrame = 0;
        const q = Cell._nameQueue;
        while (q.length && Cell._texturesThisFrame < Cell.NAME_TEX_BUDGET_PER_FRAME) {
            const item = q.shift();
            const cell = item.cell;
            if (!cell || cell.destroyed || !cell.core?.settings?.names) continue;
            cell._setNameSprite(item.label);
        }
    }

    static _cancelQueuedName(cell) {
        const q = Cell._nameQueue;
        for (let i = q.length - 1; i >= 0; i--) {
            if (q[i].cell === cell) q.splice(i, 1);
        }
    }

    constructor(core, id, x, y, r, sprite, name, color, isFood = false) {
        this.core = core;
        this.sprite = sprite;
        this.id = id;
        this.isFood = isFood;
        this.isVirus = false;
        this.isEjected = false;
        this.isAgitated = false;
        this.flag = 0;
        this.points = [];
        this.pointsAcc = [];
        this.wasSimpleDrawing = true;
        this._renderSize = r;
        this._bigPointSize = r;

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

        const PIXI = getPixi();
        this.body = new PIXI.Graphics();
        this.body.zIndex = 0;
        this.sprite.addChild(this.body);
        this.sprite.sortableChildren = true;
    }

    _viewZoom() {
        const app = this.core?.app;
        if (!app) return 1;
        return app.viewZoom > 0 ? app.viewZoom : (app.camera?.s || 1);
    }

    _nameTextureCacheKey(name) {
        return `${CELL_NAME_TEXTURE_CACHE_TAG}\n${name}`;
    }

    _getNameTexture(name) {
        const PIXI = getPixi();
        const MAX_WIDTH = 640;
        let fontSize = 100;

        let text = new PIXI.Text(name, {
            fontFamily: CELL_NAME_FONT_FAMILY,
            fontSize,
            fontWeight: "700",
            lineJoin: "round",
            fill: "#ffffff",
            letterSpacing: 0.5,
            stroke: "#0a0a0c",
            strokeThickness: 3,
            dropShadow: true,
            dropShadowAlpha: 0.55,
            dropShadowAngle: Math.PI / 2,
            dropShadowBlur: 3,
            dropShadowDistance: 2,
            dropShadowColor: "#000000"
        });

        if (text.width > MAX_WIDTH) {
            fontSize = Math.max(22, (MAX_WIDTH / text.width) * fontSize);
            text.style.fontSize = fontSize;
        }

        const texture = this.core.app.renderer.generateTexture(text, {
            resolution: CELL_NAME_TEX_RES,
            scaleMode: PIXI.SCALE_MODES.LINEAR
        });

        texture.baseTexture.mipmapMode = PIXI.MIPMAP_MODES.ON;
        Cell.NAME_CACHE.set(this._nameTextureCacheKey(name), texture);
        text.destroy();
        return texture;
    }

    _applyMassFontStyle(text) {
        text.style.fontFamily = CELL_NAME_FONT_FAMILY;
        text.style.fontSize = 38;
        text.style.fontWeight = "600";
        text.style.fill = "#ffffff";
        text.style.stroke = "#0a0a0c";
        text.style.strokeThickness = 2;
        text.style.lineJoin = "round";
        text.style.dropShadow = true;
        text.style.dropShadowAlpha = 0.45;
        text.style.dropShadowBlur = 2;
        text.style.dropShadowDistance = 1.5;
        text.style.dropShadowColor = "#000000";
        text.style.resolution = CELL_NAME_TEX_RES;
    }

    _getMassInstance() {
        const mass = Cell.MASS_POOL.shift();
        if (mass) {
            this._applyMassFontStyle(mass);
            return mass;
        }
        const t = new PIXI.Text("", {});
        this._applyMassFontStyle(t);
        return t;
    }

    _attachNameSprite(texture) {
        const nameSprite = new PIXI.Sprite(texture);
        if (this.nameSprite) this.nameSprite.destroy();
        nameSprite.anchor.set(0.5);
        nameSprite.zIndex = 4;
        this.sprite.addChild(nameSprite);
        this.nameSprite = nameSprite;
    }

    _setNameSprite(value) {
        const cacheKey = this._nameTextureCacheKey(value);
        if (Cell.NAME_CACHE.has(cacheKey)) {
            this._attachNameSprite(Cell.NAME_CACHE.get(cacheKey));
            return;
        }
        if (Cell._texturesThisFrame >= Cell.NAME_TEX_BUDGET_PER_FRAME) {
            Cell._nameQueue.push({ cell: this, label: value });
            return;
        }
        Cell._texturesThisFrame++;
        this._attachNameSprite(this._getNameTexture(value));
    }

    _stripDecorations() {
        if (this.nameSprite) {
            this.nameSprite.destroy();
            this.nameSprite = null;
        }
        if (this.massSprite) {
            Cell.MASS_POOL.push(this.massSprite);
            this.massSprite = null;
        }
        if (this.skinSprite) {
            this.skinSprite.destroy({ children: true });
            this.skinSprite = null;
        }
        if (this.skinMask) {
            this.skinMask.destroy();
            this.skinMask = null;
        }
    }

    getNumPoints() {
        if (this.id === 0) return 16;
        let minPoints = this.r < 20 ? 0 : 10;
        if (this.isVirus) minPoints = 30;

        const viewZoom = this._viewZoom();
        let b = this.isVirus ? this.r : this.r * viewZoom;
        if (this.flag & 32) b *= 0.25;

        return Math.max(~~b, minPoints);
    }

    createPoints() {
        const numPoints = this.getNumPoints();

        while (this.points.length > numPoints) {
            const idx = ~~(Math.random() * this.points.length);
            this.points.splice(idx, 1);
            this.pointsAcc.splice(idx, 1);
        }

        if (!this.points.length && numPoints > 0) {
            this.points.push({ size: this.r, x: 0, y: 0 });
            this.pointsAcc.push(Math.random() - 0.5);
        }

        while (this.points.length < numPoints) {
            const idx = ~~(Math.random() * this.points.length);
            const point = this.points[idx];
            this.points.splice(idx, 0, { size: point.size, x: point.x, y: point.y });
            this.pointsAcc.splice(idx, 0, this.pointsAcc[idx]);
        }
    }

    movePoints() {
        this.createPoints();
        const pts = this.points;
        const acc = this.pointsAcc;
        const n = pts.length;
        const timestamp = this.core.app.now || Date.now();

        for (let i = 0; i < n; i++) {
            const prev = acc[(i - 1 + n) % n];
            const next = acc[(i + 1) % n];
            acc[i] += (Math.random() - 0.5) * (this.isAgitated ? 3 : 1);
            acc[i] = Math.max(Math.min(acc[i] * 0.7, 10), -10);
            acc[i] = (prev + next + 8 * acc[i]) / 10;
        }

        const virusPhase = this.isVirus ? 0 : (this.id / 1e3 + timestamp / 1e4) % (2 * Math.PI);

        for (let j = 0; j < n; j++) {
            let f = pts[j].size;
            const prev = pts[(j - 1 + n) % n].size;
            const next = pts[(j + 1 + n) % n].size;

            f = Math.max(0, f + acc[j]);
            f = this.isAgitated ? (19 * f + this.r) / 20 : (12 * f + this.r) / 13;
            pts[j].size = (prev + next + 8 * f) / 10;

            const angle = (2 * Math.PI / n) * j;
            let radius = pts[j].size;
            if (this.isVirus && j % 2 === 0) radius += 5;

            pts[j].x = Math.cos(angle + virusPhase) * radius;
            pts[j].y = Math.sin(angle + virusPhase) * radius;
        }
    }

    _usesSimpleRender() {
        return true;
    }

    _getNameSize(r) {
        return Math.max(~~(0.3 * r), 12);
    }

    _getMassSize(r) {
        return ~~(this._getNameSize(r) * 0.5);
    }

    _labelHeight(fontSize) {
        return fontSize * 1.2;
    }

    _updateLabelLayout() {
        const r = this.r;

        if (this.nameSprite) {
            if (r <= 10 || !this.core.settings.names) {
                this.nameSprite.visible = false;
            } else {
                this.nameSprite.visible = true;
                this.nameSprite.anchor.set(0.5, 0.5);
                this.nameSprite.position.set(0, 0);
                this.nameSprite.scale.set(1);

                const fontSize = this._getNameSize(r);
                const targetH = this._labelHeight(fontSize);
                const w = this.nameSprite.width;
                const h = this.nameSprite.height;
                if (w && h) {
                    let scale = targetH / h;
                    const maxW = r * 2;
                    if (w * scale > maxW) scale = maxW / w;
                    this.nameSprite.scale.set(scale);
                }
            }
        }

        const showMass = this.core.settings.mass && r > 100 &&
            !this.isVirus && !this.isEjected && !this.isAgitated;

        if (!showMass) {
            if (this.massSprite) this.massSprite.visible = false;
            return;
        }

        if (!this.massSprite) {
            this.massSprite = this._getMassInstance();
            this.massSprite.zIndex = 5;
            this.sprite.addChild(this.massSprite);
        }

        this.massSprite.visible = true;
        const massFontSize = this._getMassSize(r);
        this.massSprite.style.fontSize = massFontSize;
        this.massSprite.style.strokeThickness = Math.max(1, massFontSize * 0.05);
        this.massSprite.text = String(this._mass ?? "");

        this.massSprite.anchor.set(0.5, 0);
        this.massSprite.scale.set(1);
        const naturalH = this.massSprite.height;
        if (naturalH) {
            this.massSprite.scale.set(this._labelHeight(massFontSize) / naturalH);
        }
        this.massSprite.x = 0;
        this.massSprite.y = this.massSprite.height * 0.9;
    }

    _updateSkinLayout(simpleRender, bigPointSize) {
        if (!this.skinSprite) return;

        const drawSize = simpleRender ? this.r : bigPointSize;
        const skinSize = Math.max(4, drawSize * 2 + OVERSCAN * 2);
        this.skinSprite.width = skinSize;
        this.skinSprite.height = skinSize;

        if (this.skinMask) {
            this.skinMask.clear();
            this.skinMask.beginFill(0xffffff);
            if (simpleRender || this.points.length < 3) {
                this.skinMask.drawCircle(0, 0, Math.max(this.r, 1));
            } else {
                this.skinMask.moveTo(this.points[0].x, this.points[0].y);
                for (let i = 1; i < this.points.length; i++) {
                    this.skinMask.lineTo(this.points[i].x, this.points[i].y);
                }
                this.skinMask.closePath();
            }
            this.skinMask.endFill();
        }
    }

    _drawPath(simpleRender, renderSize) {
        const g = this.body;
        if (simpleRender) {
            g.drawCircle(0, 0, renderSize);
            return;
        }

        this.movePoints();
        const pts = this.points;
        if (pts.length < 3) {
            g.drawCircle(0, 0, renderSize);
            return;
        }

        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            g.lineTo(pts[i].x, pts[i].y);
        }
        g.closePath();
    }

    _drawBody() {
        const g = this.body;
        g.clear();

        if (this.isFood) {
            this._renderSize = this.r;
            this._bigPointSize = this.r;
            g.beginFill(hexToPixiTint(this._color));
            g.drawCircle(0, 0, Math.max(this.r, 1));
            g.endFill();
            return;
        }

        const simpleRender = this._usesSimpleRender();

        if (!simpleRender && this.wasSimpleDrawing) {
            for (let i = 0; i < this.points.length; i++) this.points[i].size = this.r;
        }

        let bigPointSize = this.r;
        if (!this.wasSimpleDrawing) {
            for (let i = 0; i < this.points.length; i++) {
                bigPointSize = Math.max(bigPointSize, this.points[i].size);
            }
        }
        this.wasSimpleDrawing = simpleRender;
        this._bigPointSize = bigPointSize;

        let renderSize = this.r;
        if (renderSize === 0) renderSize = 20;
        this._renderSize = renderSize;

        const fill = hexToPixiTint(this._color);

        g.lineStyle(0);
        g.beginFill(fill);
        this._drawPath(simpleRender, renderSize);
        g.endFill();

        this._updateSkinLayout(simpleRender, bigPointSize);
        this._updateLabelLayout();
    }

    set name(value) {
        if (!this.hasChanged) return;

        this._name = value;

        if (this.isFood) {
            this._stripDecorations();
            return;
        }

        const label = (value && String(value).trim()) || "";

        if (!this.core.settings.names && this.nameSprite) {
            this.nameSprite.destroy();
            this.nameSprite = null;
        } else if (this.core.settings.names && label) {
            this._setNameSprite(label);
        } else if (this.nameSprite) {
            this.nameSprite.destroy();
            this.nameSprite = null;
        }

        if (this.core?.skins) {
            if (this.core.settings.skins) {
                this.core.skins.applyToCell(this, label || value);
            } else {
                if (this.skinSprite) { this.skinSprite.destroy({ children: true }); this.skinSprite = null; }
                if (this.skinMask) { this.skinMask.destroy(); this.skinMask = null; }
            }
        }
    }

    get name() { return this._name; }

    set color(value) {
        if (value === this._color) return;
        this._color = value;
    }

    get color() { return this._color; }

    get mass() { return this._mass; }

    set mass(value) {
        if (this.isFood) return;
        if (this.massSprite) this.massSprite.text = value;
        this._mass = value;
        if (!this.hasChanged) return;
        if (this.massSprite && !this.core.settings.mass) {
            this.massSprite.destroy();
            this.massSprite = null;
        } else if (this.name && !this.massSprite && this.core.settings.mass) {
            this.massSprite = this._getMassInstance();
            this.massSprite.anchor.set(0.5, -0.9);
            this.massSprite.zIndex = 5;
            this.sprite.addChild(this.massSprite);
        }
    }

    update(time) {
        const delta = Math.max(Math.min((time - this.updated) / 120, 1), 0);

        if (this.isFood) {
            if (this.nameSprite || this.massSprite || this.skinSprite) this._stripDecorations();
            if (this.hasChanged) this.hasChanged = false;
            this.x = this.nx;
            this.y = this.ny;
            this.r = this.nr;
            this.sprite.x = this.x;
            this.sprite.y = this.y;
            this.sprite.scale.set(1);
            this._drawBody();
            this.sprite.zIndex = this.r * 2;
            return;
        }

        if (this.hasChanged) {
            this.mass = this.mass;
            this.name = this.name;
            this.hasChanged = false;
        }

        this.x = this.ox + (this.nx - this.ox) * delta;
        this.y = this.oy + (this.ny - this.oy) * delta;
        this.r = this.or + (this.nr - this.or) * delta;

        const massVal = Math.round(this.r * this.r / 100);
        if (massVal !== this._mass) this.mass = massVal;

        this.sprite.x = this.x;
        this.sprite.y = this.y;
        this.sprite.scale.set(1);
        this._drawBody();
        this.sprite.zIndex = this.r * 2;
    }

    destroy(killerId) {
        Cell._cancelQueuedName(this);
        this.core.app.cellsByID.delete(this.id);
        if (this.core.app.ownedCells.remove(this.id) && this.core.app.ownedCells.length === 0) {
            this.core.net.markAsSpectating?.();
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
