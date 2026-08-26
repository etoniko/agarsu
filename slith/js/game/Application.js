import { Cell } from "./Cell.js";
import { Star } from "./Star.js";
import { MINIMAP_SIZE, worldToMinimap } from "./minimap.js";
import { foodZIndex, getMainSegmentId, sortSegmentIds, SPECTATE_OVERVIEW_SCALE } from "./segments.js";

export class Application {
    constructor(core) {
        this.core = core

        this.initRenderer()
        this.initMinimap()

        this.cells = []
        this.cellsByID = new Map()
        this.ownedCells = []
        this.camera = {
            x: 0,
            y: 0,
            s: 1,
            w: 1,
            score: 0,
            target: {
                x: 0,
                y: 0,
                s: 1
            }
        }
        // Лимиты зума: для игры и для спектатора
        this.zoomLimits = {
            player: { min: 0.2, max: 8 }, // когда у тебя есть клетки
            spectate: { min: 0.04, max: 8 } // когда ты в спектате (без клеток)
        };
        this.zoom = 0.7;      // колесо (как старый zoom)
        this.viewZoom = 1;  // сглаженный итоговый масштаб
        // >>> Добавь это:
        this._fpsFrames = 0;
        this._fpsLast = performance.now();
        this._fpsUpdateMs = 500; // усредняем каждые ~0.5 c
        this.core.stats = this.core.stats || {};
        this.core.stats.fps = 0;
        // Кэш для оптимизации updateCamera
        this._lastPivotX = 0;
        this._lastPivotY = 0;
        this._lastScale = 1;
        this.mainCell = null;
        this.mainCellLockTime = 0;
        this.posX = 0;
        this.posY = 0;
        this.posSize = 1;
        this.isSpectating = false;
        this.boostEnergy = 1;
        this.isBoostActive = false;
        this.loop = this.loop.bind(this)

        this.loop()
    }
    enterSpectateMode() {
        this.isSpectating = true;
        this.mainCell = null;
        const border = this.core?.net?.border;
        if (border?.width) {
            this.posX = border.centerX;
            this.posY = border.centerY;
            this.posSize = SPECTATE_OVERVIEW_SCALE;
            this.viewZoom = SPECTATE_OVERVIEW_SCALE * this.viewRange();
            this.camera.x = this.posX;
            this.camera.y = this.posY;
            this.camera.s = this.viewZoom;
            this._applyCameraImmediate();
        }
        this.applySpectateLabelAlpha();
    }

    /** Камера наблюдения: центр карты + обзорный зум. */
    centerSpectateView(x, y, overviewScale = SPECTATE_OVERVIEW_SCALE) {
        this.posX = x;
        this.posY = y;
        this.posSize = overviewScale;
        this.viewZoom = overviewScale * this.viewRange();
        this.camera.x = x;
        this.camera.y = y;
        this.camera.s = this.viewZoom;
        this._applyCameraImmediate();
    }

    /** Сразу применить pivot/scale (без сглаживания). */
    _applyCameraImmediate() {
        this.stage.pivot.set(this.camera.x, this.camera.y);
        this.stage.scale.set(this.camera.s);
        this._lastPivotX = this.camera.x;
        this._lastPivotY = this.camera.y;
        this._lastScale = this.camera.s;
        const { width, height } = this.getViewportSize();
        this.stage.position.set(width / 2, height / 2);
    }

    setSpectateViewFromServer(x, y) {
        if (!this.isSpectating) return;
        this.posX = x;
        this.posY = y;
    }

    /** Позиция камеры с сервера (голова = мин. nodeId). Центрирует canvas. */
    setCameraFromServer(x, y) {
        this.posX = x;
        this.posY = y;
        this.camera.x = x;
        this.camera.y = y;
        this._applyCameraImmediate();
    }

    exitSpectateMode() {
        this.isSpectating = false;
        this.core.net._lastSpectateX = null;
        this.core.net._lastSpectateY = null;
        this.core.net._followPlayerId = 0;
        this.posSize = 1;
        this.applySpectateLabelAlpha();
    }

    setSpectateTarget(x, y, scale = null) {
        this.posX = x;
        this.posY = y;
        if (scale != null) {
            this.posSize = scale;
        }
    }

    applySpectateLabelAlpha() {
        const alpha = this.isSpectating ? 0.5 : 1;
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i].setLabelAlpha(alpha);
        }
    }

    /** Логический размер canvas в CSS-пикселях (display body / #view). */
    getViewportSize() {
        const view = this.view;
        if (view) {
            const rect = view.getBoundingClientRect();
            const width = Math.round(rect.width);
            const height = Math.round(rect.height);
            if (width > 0 && height > 0) {
                return { width, height };
            }
        }

        const body = document.body;
        const doc = document.documentElement;
        return {
            width: body?.clientWidth || doc?.clientWidth || window.innerWidth,
            height: body?.clientHeight || doc?.clientHeight || window.innerHeight
        };
    }

    /** Подогнать renderer под фактический размер #view / body. */
    resizeViewport() {
        if (!this.renderer) return;

        const { width, height } = this.getViewportSize();
        if (width === this._viewportWidth && height === this._viewportHeight) return;

        this._viewportWidth = width;
        this._viewportHeight = height;
        this.renderer.resize(width, height);

        if (this.stage) {
            this.stage.position.set(width / 2, height / 2);
        }
    }

    _bindViewportResize() {
        this._onViewportResize = () => this.resizeViewport();
        window.addEventListener("resize", this._onViewportResize);
        window.addEventListener("fullscreenchange", this._onViewportResize);

        const vv = window.visualViewport;
        if (vv) {
            vv.addEventListener("resize", this._onViewportResize);
            vv.addEventListener("scroll", this._onViewportResize);
        }

        if (typeof ResizeObserver !== "undefined" && document.body) {
            this._bodyResizeObserver = new ResizeObserver(this._onViewportResize);
            this._bodyResizeObserver.observe(document.body);
        }
    }

    viewRange() {
        const { width, height } = this.getViewportSize();
        const ratio = Math.max(height / 1080, width / 1920);
        return ratio * this.zoom;
    }

    calcViewZoom() {
        if (!this.mainCell || this.mainCell.destroyed) return;
        const size = this.mainCell.r;
        const score = (size * size) / 100;
        const scale = Math.log(score + 2);
        const newViewZoom = Math.pow(1 / scale, 0.2) * this.viewRange();
        this.viewZoom = (9 * this.viewZoom + newViewZoom) / 10;
    }

    pruneOwnedCells() {
        for (let i = this.ownedCells.length - 1; i >= 0; i--) {
            const cell = this.cellsByID.get(this.ownedCells[i]);
            if (!cell || cell.destroyed) {
                this.ownedCells.splice(i, 1);
            }
        }
        if (!this.ownedCells.length) {
            this.mainCell = null;
        }
    }

    /** Главный сегмент = клетка с минимальным node id (id1). Камера следует за ней. */
    pickMainCell() {
        this.pruneOwnedCells();
        this.ownedCells = sortSegmentIds(this.ownedCells);
        const mainId = getMainSegmentId(this.ownedCells);
        this.mainCell = mainId != null ? this.cellsByID.get(mainId) : null;
        if (this.mainCell?.destroyed) {
            this.mainCell = null;
        }
    }

    /**
     * z-index по порядку id в цепочке каждого игрока (не по массе).
     * id1 — поверх, id2 ниже, id3 ниже id2…
     */
    applySegmentLayers() {
        const byPlayer = new Map();

        for (let i = 0, len = this.cells.length; i < len; i++) {
            const cell = this.cells[i];
            if (!cell || cell.destroyed || !cell.playerId) continue;
            if (!byPlayer.has(cell.playerId)) {
                byPlayer.set(cell.playerId, []);
            }
            byPlayer.get(cell.playerId).push(cell);
        }

        for (const group of byPlayer.values()) {
            group.sort((a, b) => a.id - b.id);
            const count = group.length;
            for (let s = 0; s < count; s++) {
                group[s].setSegmentOrder(s, count);
                group[s].syncLabelVisibility();
            }
        }

        for (let i = 0, len = this.cells.length; i < len; i++) {
            const cell = this.cells[i];
            if (!cell || cell.destroyed || cell.playerId) continue;
            const z = foodZIndex(cell.id);
            if (cell._segmentZ !== z) {
                cell._segmentZ = z;
                cell.sprite.zIndex = z;
                cell._lastZIndex = z;
            }
        }
    }

    /** Всегда интерполируем свои клетки — иначе камера замирает вне экрана. */
    updateOwnedCells(now) {
        for (let i = 0; i < this.ownedCells.length; i++) {
            const cell = this.cellsByID.get(this.ownedCells[i]);
            if (cell && !cell.destroyed) {
                cell.update(now);
            }
        }
    }

    /** Позиция для камеры: главный сегмент (мин. id). update() уже вызван в updateOwnedCells. */
    getCameraTargetPos() {
        this.pickMainCell();
        const main = this.mainCell;
        if (main && !main.destroyed) {
            const x = Number.isFinite(main.x) ? main.x : main.nx;
            const y = Number.isFinite(main.y) ? main.y : main.ny;
            if (Number.isFinite(x) && Number.isFinite(y)) {
                return { x, y };
            }
        }

        let sumX = 0;
        let sumY = 0;
        let count = 0;
        for (let i = 0; i < this.ownedCells.length; i++) {
            const cell = this.cellsByID.get(this.ownedCells[i]);
            if (!cell || cell.destroyed) continue;
            const px = Number.isFinite(cell.x) ? cell.x : cell.nx;
            const py = Number.isFinite(cell.y) ? cell.y : cell.ny;
            sumX += px;
            sumY += py;
            count++;
        }
        if (count > 0) {
            return { x: sumX / count, y: sumY / count };
        }
        return { x: this.posX, y: this.posY };
    }


    drawBorder() {
        if (this.borderGraphics) this.borderGraphics.destroy()

        const border = this.core.net.border
        this.borderGraphics = new PIXI.Graphics()
            .lineStyle(50, 0xffffff)
            .drawRect(-border.width / 2, -border.height / 2, border.width, border.height);
        this.borderGraphics.visible = this.core.settings.border

        this.stage.addChild(this.borderGraphics)
    }
    drawBackground() {
        const border = this.core.net.border;
        const mapW = border.width;
        const mapH = border.height;

        const geometry = new PIXI.Geometry()
            .addAttribute('aVertexPosition', [
                -mapW / 2, -mapH / 2,
                mapW / 2, -mapH / 2,
                -mapW / 2, mapH / 2,
                mapW / 2, mapH / 2,
            ])
            .addAttribute('aUvs', [0, 0, 1, 0, 0, 1, 1, 1])
            .addIndex([0, 1, 2, 1, 3, 2]);

        const shader = PIXI.Shader.from(`
precision highp float;
attribute vec2 aVertexPosition;
attribute vec2 aUvs;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
varying vec2 vUvs;
void main() {
  vUvs = aUvs;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}
  `, `
precision highp float;
varying vec2 vUvs;

uniform vec2 uCenter;

// Максимально плавный градиент
float smoothGradient(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Дизеринг против banding
float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUvs;
  float dist = length(uv - uCenter); // 0..~0.707

  // Нормализуем расстояние: 0 = центр, 1 = угол
  float t = dist / 0.65; 

  // Инвертируем: центр = 1, края = 0
  float intensity = 0.9 - smoothGradient(t);

  // Цвета как на скрине
  vec3 centerColor = vec3(0.075, 0.153, 0.271); // #132745 — центр
  vec3 edgeColor   = vec3(0.0, 0.0, 0.0);       // #000000 - край

  vec3 color = mix(edgeColor, centerColor, intensity);

  // Дизеринг
  color += (noise(uv * 1200.0) - 0.5) * 0.018;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
  `, {
            uCenter: [0.5, 0.5]
        });

        const bg = new PIXI.Mesh(geometry, shader);
        bg.position.set(0, 0);
        bg.zIndex = -1000;
        bg.visible = this.core.settings.background;
        this.stage.addChild(bg);
        this.backgroundSprite = bg;
    }




    performHueShifting() {
        this.hueDegree += 1
        if (this.hueDegree > 360) this.hueDegree = 0
        this.colorMatrix.hue(this.hueDegree)
        this.hueShiftingRAF = requestAnimationFrame(this.performHueShifting.bind(this))
    }

    drawGrid() {
        if (this.gridSprite) this.gridSprite.destroy()

        const border = this.core.net.border
        const g = new PIXI.Graphics()
        const width = 100
        const height = 100
        g.lineStyle(10, 0x333333, 1)
        g.moveTo(width, 0)
        g.lineTo(0, 0)
        g.moveTo(width / 2, height / 2)
        g.lineTo(width / 2, -height / 2)
        const texture = this.renderer.generateTexture(g, {
            scaleMode: PIXI.SCALE_MODES.LINEAR,
            resolution: 1,
            region: new PIXI.Rectangle(0, 0, width / 2, height / 2)
        })
        texture.baseTexture.mipmapMode = PIXI.MIPMAP_MODES.ON
        this.gridSprite = new PIXI.TilingSprite(texture, border.width, border.height)
        this.gridSprite.position.set(-border.width / 2, -border.height / 2)
        this.gridSprite.visible = this.core.settings.grid

        this.stage.addChild(this.gridSprite)
    }

    drawSectors() {
        if (this.sectorContainer) this.sectorContainer.destroy()

        const labels = []
        const rows = 5
        const cols = 5
        const sectorSize = this.core.net.border.width / 5
        this.sectorContainer = new PIXI.Container()
        for (let row = 0; row < rows; row++) {
            labels[row] = []
            for (let col = 0; col < cols; col++) {
                const square = new PIXI.Graphics()
                square.lineStyle(100, 0x444444)
                square.drawRect(0, 0, sectorSize, sectorSize);
                square.position.set(col * sectorSize, row * sectorSize)
                const label = new PIXI.Text(String.fromCharCode(65 + row) + (col + 1), {
                    fontFamily: 'Ubuntu, Arial, sans-serif',
                    fontWeight: '700',
                    fontSize: 1024,
                    fill: 0x444444
                })
                label.position.set(
                    col * sectorSize + (sectorSize - label.width) / 2,
                    row * sectorSize + (sectorSize - label.height) / 2
                )
                const sector = new PIXI.Container()
                sector.addChild(square, label)
                this.sectorContainer.addChild(sector)
            }
        }
        this.sectorContainer.position.set(-1 * sectorSize * 5 / 2, -1 * sectorSize * 5 / 2)
        this.sectorContainer.visible = this.core.settings.sectors

        this.stage.addChild(this.sectorContainer)
    }

    initMinimap() {
        const view = this.minimapView = document.getElementById("minimap-view");
        this.minimapRenderer = PIXI.autoDetectRenderer({
            view,
            width: MINIMAP_SIZE,
            height: MINIMAP_SIZE,
            backgroundAlpha: 0,
            antialias: false
        });

        this.minimapStage = new PIXI.Container();

        this.minimapBorderGfx = new PIXI.Graphics();
        this.minimapStage.addChild(this.minimapBorderGfx);

        const sprite = this.minimapEntity = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.width = 8;
        sprite.height = 8;
        sprite.tint = 0xff4444;
        sprite.anchor.set(0.5);
        this.minimapStage.addChild(sprite);
    }

    drawMinimapBorder() {
        if (!this.minimapBorderGfx) return;
        const border = this.core?.net?.border;
        if (!border?.width) return;

        this.minimapBorderGfx.clear();
        this.minimapBorderGfx.lineStyle(1, 0xffffff, 0.35);
        this.minimapBorderGfx.drawRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

        if (border.centerX != null && border.width) {
            const r = border.width / 2;
            const cx = ((border.centerX - border.left) / border.width) * MINIMAP_SIZE;
            const cy = ((border.centerY - border.top) / border.height) * MINIMAP_SIZE;
            const scale = MINIMAP_SIZE / border.width;
            this.minimapBorderGfx.drawCircle(cx, cy, r * scale);
        }
    }

    updateMinimap() {
        if (!this.minimapEntity) return;
        const border = this.core?.net?.border;
        if (!border?.width) return;
        const { x, y } = worldToMinimap(this.posX, this.posY, border);
        this.minimapEntity.position.set(x, y);
    }

    initRenderer() {
        const view = this.view = document.getElementById("view")
        this.renderer = PIXI.autoDetectRenderer({
            view,
            width: window.innerWidth,
            height: window.innerHeight,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            powerPreference: 'high-performance'
        })
        this.stage = new PIXI.Container()
        this.stage.sortableChildren = true

        const circle = new PIXI.Graphics()
        circle.beginFill(0xffffff)
        circle.drawCircle(256, 256, 256)
        circle.endFill();

        const star = new PIXI.Graphics()
            .beginFill(0xffffff)
            .lineStyle(10, 0x777777, 1)
            .drawPolygon(new Star(256, 256, 30, 256, 220, 0))
            .endFill();

        const cellRenderTexture = PIXI.RenderTexture.create({ width: 512, height: 512 })
        this.renderer.render(circle, { renderTexture: cellRenderTexture })
        cellRenderTexture.baseTexture.mipmapMode = PIXI.MIPMAP_MODES.ON


        this.textures = { cell: cellRenderTexture }

        Cell.SPRITE = new PIXI.Sprite(cellRenderTexture)

        this.resizeViewport();
        this._bindViewportResize();
    }


    loop(now = performance.now()) {
        this.now = Date.now();

        // Оптимизация: убрали slice(0) - итерируемся напрямую по массиву
        // Оптимизация: добавляем frustum culling для видимых клеток
        const cam = this.camera;
        const { width: vpW, height: vpH } = this.getViewportSize();
        const viewWidth = vpW / cam.s;
        const viewHeight = vpH / cam.s;
        const viewLeft = cam.x - viewWidth / 2;
        const viewRight = cam.x + viewWidth / 2;
        const viewTop = cam.y - viewHeight / 2;
        const viewBottom = cam.y + viewHeight / 2;

        const ownedSet = new Set(this.ownedCells);
        this.updateOwnedCells(this.now);

        for (let i = 0, len = this.cells.length; i < len; i++) {
            const cell = this.cells[i];
            if (!cell || cell.destroyed) continue;

            const isOwned = ownedSet.has(cell.id);

            if (isOwned || this.isSpectating) {
                cell._visible = true;
                cell.sprite.visible = true;
                cell.update(this.now);
                continue;
            }

            const cellLeft = cell.x - cell.r;
            const cellRight = cell.x + cell.r;
            const cellTop = cell.y - cell.r;
            const cellBottom = cell.y + cell.r;

            const isVisible = !(cellRight < viewLeft || cellLeft > viewRight ||
                cellBottom < viewTop || cellTop > viewBottom);

            if (isVisible !== cell._visible) {
                cell._visible = isVisible;
                cell.sprite.visible = isVisible;
            }

            if (isVisible) {
                cell.update(this.now);
            }
        }

        this.applySegmentLayers();
        this.updateCamera();

        this.renderer.render(this.stage);
        this.minimapRenderer.render(this.minimapStage);

        // >>> Подсчёт FPS
        this._fpsFrames++;
        const dt = now - this._fpsLast;
        if (dt >= this._fpsUpdateMs) {
            this.core.stats.fps = (this._fpsFrames * 1000) / dt;
            this._fpsFrames = 0;
            this._fpsLast = now;
        }

        requestAnimationFrame(this.loop);
    }


    clear(options = {}) {
        if (!options.preserveSpectate) {
            this.exitSpectateMode();
        }
        this.stage.removeChildren()
        this.cells = []
        this.cellsByID = new Map()
        this.ownedCells = []
        this.mainCell = null
    }


    updateCamera() {
        const ownedCount = this.ownedCells.length;
        let score = 0;

        if (ownedCount > 0) {
            const target = this.getCameraTargetPos();
            this.posX = target.x;
            this.posY = target.y;
            for (let i = 0; i < ownedCount; i++) {
                const cell = this.cellsByID.get(this.ownedCells[i]);
                if (cell && !cell.destroyed) {
                    score += ~~((cell.r * cell.r) / 100);
                }
            }
            this.calcViewZoom();
            // Голова строго в центре экрана (без сглаживания — иначе уезжает в угол)
            this.camera.x = this.posX;
            this.camera.y = this.posY;
            this.posSize = this.viewZoom;
        } else if (this.isSpectating) {
            this.mainCell = null;
            this.camera.x = (29 * this.camera.x + this.posX) / 30;
            this.camera.y = (29 * this.camera.y + this.posY) / 30;
            const targetZoom = this.posSize * this.viewRange();
            this.viewZoom = (9 * this.viewZoom + targetZoom) / 10;
        } else {
            this.mainCell = null;
            this.camera.x = (29 * this.camera.x + this.posX) / 30;
            this.camera.y = (29 * this.camera.y + this.posY) / 30;
            const targetZoom = this.posSize * this.viewRange();
            this.viewZoom = (9 * this.viewZoom + targetZoom) / 10;
        }

        this.camera.s = this.viewZoom;

        if (this._lastPivotX !== this.camera.x || this._lastPivotY !== this.camera.y) {
            this.stage.pivot.set(this.camera.x, this.camera.y);
            this._lastPivotX = this.camera.x;
            this._lastPivotY = this.camera.y;
        }

        if (this._lastScale !== this.camera.s) {
            this.stage.scale.set(this.camera.s);
            this._lastScale = this.camera.s;
        }

        const { width, height } = this.getViewportSize();
        this.stage.position.set(width / 2, height / 2);

        this.camera.score = score;
        this.updateMinimap();

        if (ownedCount > 0) {
            this.core.net.publishPlayingState(this.posX, this.posY);
        }
    }



}
