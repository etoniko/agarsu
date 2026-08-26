import { removeFromArray } from "../utils/array.js";

export class Cell {
    static NAME_CACHE = new Map()
    static MASS_POOL = new Array()
    static SPRITE //pixi.sprite set later


    constructor(core, id, x, y, r, sprite, name, color) {
        this.core = core
        this.sprite = sprite
        this.id = id
        this.x = this.nx = this.ox = x
        this.y = this.ny = this.oy = y
        this.r = this.nr = this.or = r
        this._color = color
        this._name = name
        this.updated = Date.now()
        this.hasChanged = true
        this.skinSprite = null;
        this.skinMask = null;
        // Кэш для оптимизации обновлений
        this._lastScale = r / 256;
        this._lastZIndex = id;
        this._visible = true;
        this.playerId = 0;
        this.segmentIndex = -1;
        this._segmentZ = id;
        this.boostEnergy = 0;
        this.boostEnergyTarget = 0;
        this.boostEnergyVisual = 0;
        this._boostBlackDrawn = -1;
        this.boostBoosting = false;
        this.boostStateKnown = false;
        this.boostAuraWrap = null;
        this.boostAuraGfx = null;
        this.boostSpeedLinesGfx = null;
        this._lastAuraFrame = -1;

        this.sprite.scale.set(r/ 256);
        this.sprite.zIndex = this._segmentZ;
        this.sprite.sortableChildren = true;
    }

    setPlayerId(playerId) {
        this.playerId = playerId | 0;
    }

    /** Порядок в цепочке сегментов (0 = голова с минимальным id). */
    setSegmentOrder(segmentIndex, segmentCount) {
        const prevIndex = this.segmentIndex;
        this.segmentIndex = segmentIndex;
        const z = segmentCount > 0 && segmentIndex >= 0
            ? 10000 + (segmentCount - segmentIndex) * 4
            : this.id;
        if (this._segmentZ !== z) {
            this._segmentZ = z;
            this.sprite.zIndex = z;
            this._lastZIndex = z;
            if (this.skinSprite) this.skinSprite.zIndex = z + 2;
            if (this.skinMask) this.skinMask.zIndex = z + 3;
        }
        if (prevIndex !== segmentIndex) {
            this.syncLabelVisibility();
        }
    }

    /** Клетка, на которой надо показывать ник/индикаторы. */
    isPrimaryDisplayCell() {
        if (!this.playerId) return true;
        const ownerId = this.core?.net?.ownerPlayerId ?? 0;
        const mainId = this.core?.app?.mainCell?.id;
        if (ownerId && this.playerId === ownerId && mainId != null) {
            return this.id === mainId;
        }
        // Для других игроков: голова/еще не разложенные сегменты.
        return this.segmentIndex <= 0;
    }

    /** Имя и масса на основной клетке. */
    shouldShowNameAndMass() {
        return this.isPrimaryDisplayCell();
    }

    getDisplayMass() {
        return this._mass ?? Math.round(this.r * this.r / 100);
    }

    /** Индикатор boost на основной клетке игрока. */
    shouldShowBoostBar() {
        return false;
    }

    /** Серверное состояние boost (источник истины). */
    setBoostState(energy, boosting) {
        const e = Math.max(0, Math.min(1, energy ?? 0));
        this.boostEnergy = e;
        this.boostEnergyTarget = e;
        this.boostEnergyVisual = e;
        this.boostBoosting = !!boosting;
        this.boostStateKnown = true;
    }

    /** Для строгого синхрона визуал всегда равен последнему серверному значению. */
    _tickBoostVisual(deltaMs) {
        void deltaMs;
        if (!this.boostStateKnown) return;
        this.boostEnergyVisual = this.boostEnergyTarget;
    }

    syncLabelVisibility() {
        if (!this.shouldShowNameAndMass()) {
            if (this.nameSprite) {
                this.nameSprite.destroy();
                this.nameSprite = null;
            }
            if (this.massSprite) {
                this.massSprite.destroy();
                this.massSprite = null;
            }
            if (this.boostBarWrap) {
                this.boostBarWrap.visible = false;
            }
            return;
        }
        if (this.core.settings.names && this._name) {
            this._setNameSprite(this._name);
        } else if (this.playerId && this._name) {
            this._setNameSprite(this._name);
        }

        const showBoost = this.shouldShowBoostBar();
        if (this.massSprite) {
            this.massSprite.destroy();
            this.massSprite = null;
        }

        if (showBoost) {
            this._ensureBoostBar();
            this.boostBarWrap.visible = true;
            this._boostBlackDrawn = -1;
            this.updateBoostBar(this.boostEnergy, this.boostBoosting);
        } else if (this.boostBarWrap) {
            this.boostBarWrap.visible = false;
        }

        this.setLabelAlpha(this.core.app.isSpectating ? 0.5 : 1);
    }

    _ensureBoostBar() {
        if (!this.boostBarGfx) {
            if (!this.boostBarWrap) {
                this.boostBarWrap = new PIXI.Container();
                this.boostBarWrap.zIndex = 20000;
                this.sprite.addChild(this.boostBarWrap);
            }
            this.boostBarGfx = new PIXI.Graphics();
            this.boostBarWrap.addChild(this.boostBarGfx);
        }
        if (!this.sprite.sortableChildren) {
            this.sprite.sortableChildren = true;
        }
        this._bringBoostBarToFront();
    }

    _bringBoostBarToFront() {
        if (!this.boostBarWrap || !this.sprite) return;
        this.boostBarWrap.zIndex = 20000;
        if (this.sprite.sortableChildren) {
            this.sprite.setChildIndex(this.boostBarWrap, this.sprite.children.length - 1);
        }
    }

    _ensureBoostAura() {
        if (!this.boostAuraWrap) {
            this.boostAuraWrap = new PIXI.Container();
            this.boostAuraWrap.zIndex = 15000;
            this.sprite.addChild(this.boostAuraWrap);
        }
        if (!this.boostAuraGfx) {
            this.boostAuraGfx = new PIXI.Graphics();
            this.boostAuraWrap.addChild(this.boostAuraGfx);
        }
        if (!this.boostSpeedLinesGfx) {
            this.boostSpeedLinesGfx = new PIXI.Graphics();
            this.boostAuraWrap.addChild(this.boostSpeedLinesGfx);
        }
        if (!this.sprite.sortableChildren) this.sprite.sortableChildren = true;
    }

    _hideBoostAura() {
        if (!this.boostAuraWrap) return;
        this.boostAuraWrap.visible = false;
        this._lastAuraFrame = -1;
    }

    _updateBoostAura(time) {
        // "Высокая скорость" = серверный boosting (x2 speed).
        if (!this.playerId || !this.boostBoosting) {
            this._hideBoostAura();
            return;
        }
        this._ensureBoostAura();
        this.boostAuraWrap.visible = true;

        // Ограничиваем перерисовку до ~30 FPS.
        const frame = (time / 33) | 0;
        if (frame === this._lastAuraFrame) return;
        this._lastAuraFrame = frame;

        const g = this.boostAuraGfx;
        const lines = this.boostSpeedLinesGfx;
        const t = time * 0.012 + this.id * 0.35;
        const pulse = 0.55 + 0.45 * Math.sin(t);
        const pulse2 = 0.5 + 0.5 * Math.sin(t + 1.2);
        const baseR = 256;

        g.clear();
        lines.clear();

        // Неоновый внешний ореол.
        g.lineStyle(26, 0x7ad7ff, 0.18 + 0.16 * pulse);
        g.drawCircle(0, 0, baseR + 7 + pulse2 * 6);

        // Основной яркий контур клетки.
        g.lineStyle(12, 0xffffff, 0.45 + 0.28 * pulse);
        g.drawCircle(0, 0, baseR + 2);

        // Внутреннее "искрящееся" кольцо.
        g.lineStyle(5, 0xd9f5ff, 0.72 + 0.2 * pulse2);
        g.drawCircle(0, 0, baseR - 2);

        // Радиальные скоростные штрихи (ощущение ускорения как в slither.io).
        const spokeCount = 14;
        const rot = t * 0.55;
        for (let i = 0; i < spokeCount; i++) {
            const a = rot + (Math.PI * 2 * i) / spokeCount;
            const wobble = 8 * Math.sin(t * 1.8 + i * 0.9);
            const r1 = baseR + 16 + wobble;
            const len = 20 + 14 * (0.5 + 0.5 * Math.sin(t * 2.4 + i));
            const x1 = Math.cos(a) * r1;
            const y1 = Math.sin(a) * r1;
            const x2 = Math.cos(a) * (r1 + len);
            const y2 = Math.sin(a) * (r1 + len);
            lines.lineStyle(3, 0xb7ebff, 0.28 + 0.45 * pulse2);
            lines.moveTo(x1, y1);
            lines.lineTo(x2, y2);
        }
    }

  /** Позиция ряда квадратиков под name (локальные координаты, R=256). */
    _getBoostBarLayout() {
        const R = 256;
        const gap = R * 0.045;
        const segGap = R * 0.018;
        const segH = R * 0.09;
        const segW = R * 0.075;
        const barW = segW * BOOST_SEGMENTS + segGap * (BOOST_SEGMENTS - 1);
        const barH = segH + R * 0.02;

        let y = R * 0.2;
        if (this.nameSprite?.texture) {
            const nameH = this.nameSprite.texture.height;
            y = nameH / 2 + gap + barH / 2;
        }

        return { barW, barH, y, segW, segH, segGap };
    }

    /**
     * Индикатор под ником: 8 слотов.
     * Белые = доступный boost, тёмные = потраченный boost (по серверному energy).
     */
    updateBoostBar(energy, boosting = false) {
        if (!this.shouldShowBoostBar()) {
            if (this.boostBarWrap) this.boostBarWrap.visible = false;
            return;
        }
        this._ensureBoostBar();
        this.boostBarWrap.visible = true;

        const e = Math.max(0, Math.min(1, energy ?? 0));
        const layout = this._getBoostBarLayout();
        const energyKey = Math.round(e * 1000);
        const layoutKey = `${layout.y}|${layout.barW}|${this.boostStateKnown ? 1 : 0}|${energyKey}`;

        if (layoutKey === this._boostLayoutKey && boosting === this._boostBoostingDrawn) {
            return;
        }
        this._boostLayoutKey = layoutKey;
        this._boostBoostingDrawn = boosting;

        const { barW, barH, y, segW, segH, segGap } = layout;
        const left = -barW / 2;
        const top = y - barH / 2;
        const g = this.boostBarGfx;
        g.clear();

        // Поле индикатора всегда видно.
        g.lineStyle(0);
        g.beginFill(0x0f0f0f, 0.65);
        g.drawRoundedRect(left - 4, top - 4, barW + 8, barH + 8, 6);
        g.endFill();

        const litFloat = this.boostStateKnown ? (e * BOOST_SEGMENTS) : 0;
        const r = Math.min(segW, segH) * 0.22;

        for (let i = 0; i < BOOST_SEGMENTS; i++) {
            const sx = left + i * (segW + segGap);
            const sy = top + (barH - segH) / 2;
            const fill = Math.max(0, Math.min(1, litFloat - i));

            if (fill > 0) {
                g.lineStyle(0);
                g.beginFill(boosting ? 0xffffff : 0xf2f2f2, 1);
                g.drawRoundedRect(sx, sy, segW * fill, segH, r);
                g.endFill();
                g.lineStyle(2, 0xbdbdbd, 0.95);
                g.drawRoundedRect(sx, sy, segW, segH, r);
            } else {
                g.lineStyle(0);
                g.beginFill(0x161616, this.boostStateKnown ? 1 : 0.65);
                g.drawRoundedRect(sx, sy, segW, segH, r);
                g.endFill();
                g.lineStyle(2, 0x3e3e3e, 0.95);
                g.drawRoundedRect(sx, sy, segW, segH, r);
            }
        }

        this._bringBoostBarToFront();
    }

    setLabelAlpha(alpha) {
        if (this.nameSprite) this.nameSprite.alpha = alpha;
        if (this.boostBarWrap) this.boostBarWrap.alpha = alpha;
    }

    _applySkin(name) {
        if (!this.core?.skins) return;
        if (this.core.settings.skins) {
            this.core.skins.applyToCell(this, name);
            this._bringBoostBarToFront();
        } else if (this.skinSprite) {
            this.skinSprite.destroy({ children: true });
            this.skinSprite = null;
            if (this.skinMask) {
                this.skinMask.destroy();
                this.skinMask = null;
            }
        }
    }

    _getNameTexture(name) {
        const MAX_WIDTH = 512; // максимально допустимая ширина имени
        let fontSize = 100; // базовый размер шрифта

        // Создаём временный текст для измерения ширины
        let text = new PIXI.Text(name, {
            fontFamily: 'Ubuntu, Arial, sans-serif',
            fontWeight: '700',
            fontSize: fontSize,
            lineJoin: "round",
            fill: "white",
            stroke: "black",
            strokeThickness: 10
        });

        // Если текст слишком широкий, уменьшаем шрифт пропорционально
        const maxWidth = MAX_WIDTH;
        if (text.width > maxWidth) {
            fontSize = Math.max(20, (maxWidth / text.width) * fontSize);
            text.style.fontSize = fontSize;
        }

        // Генерация текстуры
        const texture = this.core.app.renderer.generateTexture(text, {
            resolution: 3,
            scaleMode: PIXI.SCALE_MODES.LINEAR
        });

        texture.baseTexture.mipmapMode = PIXI.MIPMAP_MODES.ON;
        Cell.NAME_CACHE.set(name, texture);
        text.destroy();

        return texture;
    }


    _getMassInstance() {
        const mass = Cell.MASS_POOL.shift();
        if (mass) return mass;
        return new PIXI.Text("", {
            fontFamily: 'Ubuntu, Arial, sans-serif',
            fontWeight: '700',
            fontSize: 50,
            fill: "white",
            stroke: "black",
            strokeThickness: 6,
            lineJoin: "round"
        });
    }

    _setNameSprite(value) {
        const fallbackName = this.core?.store?.name || "Player";
        const nameValue = (value && String(value).trim().length) ? String(value) : fallbackName;
        let nameSprite;
        if (Cell.NAME_CACHE.has(nameValue)) {
            nameSprite = new PIXI.Sprite(Cell.NAME_CACHE.get(nameValue));
        } else {
            nameSprite = new PIXI.Sprite(this._getNameTexture(nameValue));
        }
        if (this.nameSprite) this.nameSprite.destroy();
        nameSprite.anchor.set(0.5);
        nameSprite.zIndex = 25000;
        this.sprite.addChild(nameSprite);
        this.nameSprite = nameSprite;
        this._positionNameSprite();
        if (this.shouldShowBoostBar() && this.boostBarWrap?.visible) {
            this._boostBlackDrawn = -1;
            this.updateBoostBar(this.boostEnergy, this.boostBoosting);
        }
    }

    _positionNameSprite() {
        if (!this.nameSprite) return;
        // Ник внутри клетки: центр + ограниченный масштаб.
        const invScale = Math.max(0.5, Math.min(1.35, 170 / Math.max(1, this.r)));
        this.nameSprite.scale.set(invScale);
        this.nameSprite.y = 0;
        if (this.sprite.sortableChildren) {
            this.sprite.setChildIndex(this.nameSprite, this.sprite.children.length - 1);
        }
    }

    set name(value) {
        if (!this.hasChanged) return;
        this._name = value;
        this._applySkin(value);
        this.syncLabelVisibility();
    }


    get name() {
        return this._name
    }

    set color(value) {
        if (!this.hasChanged) return
        this._color = value
        this.sprite.tint = value
    }

    get color() {
        return this._color
    }

    get mass() {
        return this._mass
    }

    set mass(value) {
        this._mass = value;
        if (!this.hasChanged) return;
        if (this.shouldShowBoostBar()) {
            if (this.massSprite) {
                this.massSprite.destroy();
                this.massSprite = null;
            }
            return;
        }
        if (!this.shouldShowNameAndMass() || !this.core.settings.mass) {
            if (this.massSprite) {
                this.massSprite.destroy();
                this.massSprite = null;
            }
            return;
        }
        if (!this.massSprite) {
            this.massSprite = this._getMassInstance();
            this.massSprite.anchor.set(0.5, -0.9);
            this.sprite.addChild(this.massSprite);
        }
        this.massSprite.text = value;
    }


    update(time) {
        const delta = Math.max(Math.min((time - this.updated) / 80, 1), 0)

        if (this.hasChanged) {
            this.color = this.color;
            this.name = this.name;
            this.hasChanged = false;
        }

        this.x = this.ox + (this.nx - this.ox) * delta;
        this.y = this.oy + (this.ny - this.oy) * delta;
        this.r = this.or + (this.nr - this.or) * delta;

        const massVal = Math.round(this.r * this.r / 100);
        if (this.shouldShowNameAndMass()) {
            this.mass = massVal;
            if (this.shouldShowBoostBar()) {
                this.syncLabelVisibility();
            }
        } else {
            this._mass = massVal;
        }

        // Оптимизация: обновляем позицию только если изменилась
        if (this.sprite.x !== this.x || this.sprite.y !== this.y) {
            this.sprite.x = this.x;
            this.sprite.y = this.y;
        }

        // Оптимизация: обновляем масштаб только если изменился (кэшируем предыдущее значение)
        const s = this.r / 256; // 512px база → r/256
        if (this._lastScale !== s) {
            this.sprite.scale.set(s);
            this._lastScale = s;
        }
        this._positionNameSprite();

        if (this._lastZIndex !== this._segmentZ) {
            this.sprite.zIndex = this._segmentZ;
            this._lastZIndex = this._segmentZ;
        }

        if (this.shouldShowBoostBar()) {
            const st = this.core.net.playerBoost.get(this.playerId);
            if (st) {
                this.setBoostState(st.energy, st.boosting);
            }
            this._tickBoostVisual(0);
            this.updateBoostBar(this.boostEnergyTarget, this.boostBoosting);
        }

        this._updateBoostAura(time);
    }


    destroy(killerId) {
        this.core.app.cellsByID.delete(this.id);
        if (removeFromArray(this.core.app.ownedCells, this.id) && this.core.app.ownedCells.length === 0) this.core.ui.setPanelState(true)
        this.destroyed = true;
        this.dead = this.core.net.now;

        if (killerId && !this.diedBy) {
            this.diedBy = killerId;
            this.updated = this.core.net.now;
        }

        removeFromArray(this.core.app.cells, this)
        if (this.boostAuraWrap) {
            this.boostAuraWrap.destroy({ children: true });
            this.boostAuraWrap = null;
            this.boostAuraGfx = null;
            this.boostSpeedLinesGfx = null;
        }
        this.sprite.destroy({ children: true })
    }

}
