import { getPixi } from "./pixi.js";
import { Cell } from "../entities/Cell.js";
import { CenterTopDisplay } from "./CenterTopDisplay.js";
import { worldToMinimap } from "../utils/math.js";
import { clampToBorder } from "../utils/border.js";
import { CELL_TEX_RADIUS, SMOOTH_RENDER_THRESHOLD } from "../config/constants.js";
import {
    createMainRenderer,
    createMinimapRenderer,
    createCellTexture
} from "./RendererManager.js";

export class Application {
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
                w: 1,
                score: 0,
                target: {
                    x: 1,
                    y: 1,
                    s: 1
                }
            }

this.zoomLimits = {
  player:   { min: 0.2, max: 8 },
  spectate: { min: 0.04, max: 8 }
};
            this.zoom = 0.7;
            this.viewZoom = 1;
            this.zoomViewLerp = 0.28;
            this.zoomScaleFollow = 3;
            this.smoothRender = SMOOTH_RENDER_THRESHOLD;

            this.spectateCameraLerp = 0.075;

            this._fpsFrames = 0;
            this._fpsLast = performance.now();
            this._fpsUpdateMs = 500;
            this.core.stats = this.core.stats || {};
            this.core.stats.fps = 0;

            this._lastPivotX = 0;
            this._lastPivotY = 0;
            this._lastScale = 1;
            this.loop = this.loop.bind(this)

            this.loop()
        }
viewRange() {

  const ratio = Math.max(this.renderer.height / 1080, this.renderer.width / 1920);
  return ratio * this.zoom;
}


calcViewZoom(sumR) {
  const safeSum = Math.max(1e-6, sumR);
  const newViewZoom = Math.pow(Math.min(64 / safeSum, 1), 0.4) * this.viewRange();
  this.viewZoom += (newViewZoom - this.viewZoom) * this.zoomViewLerp;
}


        drawBorder() {
            if (this.borderGraphics) this.borderGraphics.destroy()

            const border = this.core.net.border
            this.borderGraphics = new (getPixi()).Graphics()
                .lineStyle(50, 0xffffff)
                .drawRect(-border.width / 2, -border.height / 2, border.width, border.height);
            this.borderGraphics.visible = this.core.settings.border

            this.stage.addChild(this.borderGraphics)
        }
drawBackground() {
  const border = this.core.net.border;
  const mapW = border.width;
  const mapH = border.height;

  const geometry = new (getPixi()).Geometry()
    .addAttribute('aVertexPosition', [
      -mapW / 2, -mapH / 2,
       mapW / 2, -mapH / 2,
      -mapW / 2,  mapH / 2,
       mapW / 2,  mapH / 2,
    ])
    .addAttribute('aUvs', [0, 0, 1, 0, 0, 1, 1, 1])
    .addIndex([0, 1, 2, 1, 3, 2]);

  const shader = getPixi().Shader.from(`
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

    float smoothGradient(float t) {
      t = clamp(t, 0.0, 1.0);
      return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    }

    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUvs;
      float dist = length(uv - uCenter);

      float t = dist / 0.65;

      float intensity = 0.9 - smoothGradient(t);

      vec3 centerColor = vec3(0.075, 0.153, 0.271);
      vec3 edgeColor   = vec3(0.0, 0.0, 0.0);

      vec3 color = mix(edgeColor, centerColor, intensity);

      color += (noise(uv * 1200.0) - 0.5) * 0.018;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `, {
    uCenter: [0.5, 0.5]
  });

  const bg = new (getPixi()).Mesh(geometry, shader);
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

        drawSectors() {
            if (this.sectorContainer) this.sectorContainer.destroy()

            const labels = []
            const rows = 5
            const cols = 5
            const sectorSize = this.core.net.border.width / 5
            this.sectorContainer = new (getPixi()).Container()
            for (let row = 0; row < rows; row++) {
                labels[row] = []
                for (let col = 0; col < cols; col++) {
                    const square = new (getPixi()).Graphics()
                    square.lineStyle(100, 0x444444)
                    square.drawRect(0, 0, sectorSize, sectorSize);
                    square.position.set(col * sectorSize, row * sectorSize)
                    const label = new (getPixi()).Text(String.fromCharCode(65 + row) + (col + 1), {
                          fontFamily: 'Ubuntu, Arial, sans-serif',
						  fontWeight: '700',
                        fontSize: 1024,
                        fill: 0x444444
                    })
                    label.position.set(
                        col * sectorSize + (sectorSize - label.width) / 2,
                        row * sectorSize + (sectorSize - label.height) / 2
                    )
                    const sector = new (getPixi()).Container()
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
            this.minimapRenderer = createMinimapRenderer(view);
            const PIXI = getPixi();
            const sprite = this.minimapEntity = new PIXI.Sprite(PIXI.Texture.WHITE);
            sprite.width = 10;
            sprite.height = 10;
            sprite.anchor.set(0.5);
            const stage = this.minimapStage = new PIXI.Container();
            stage.addChild(sprite);
        }

        initRenderer() {
            const view = this.view = document.getElementById("view");
            this.renderer = createMainRenderer(view);
            this.stage = new (getPixi()).Container();
            this.stage.sortableChildren = true;

            const cellRenderTexture = createCellTexture(this.renderer);
            this.textures = { cell: cellRenderTexture };

            this.centerTop = new CenterTopDisplay();
            this.centerTop.attachTo(this.stage);
        }


        loop(now = performance.now()) {
            Cell.beginFrame();
            this.now = Date.now();

            const cam = this.camera;
            const viewWidth = innerWidth / cam.s;
            const viewHeight = innerHeight / cam.s;
            const viewLeft = cam.x - viewWidth / 2;
            const viewRight = cam.x + viewWidth / 2;
            const viewTop = cam.y - viewHeight / 2;
            const viewBottom = cam.y + viewHeight / 2;

            for (let i = 0, len = this.cells.length; i < len; i++) {
                const cell = this.cells[i];
                if (!cell || cell.destroyed) continue;

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

                if (!isVisible) continue;

                cell.update(this.now);
            }

            this.updateCamera();

            this.renderer.render(this.stage);
            this.minimapRenderer.render(this.minimapStage);

            this._fpsFrames++;
            const dt = now - this._fpsLast;
            if (dt >= this._fpsUpdateMs) {
                this.core.stats.fps = (this._fpsFrames * 1000) / dt;
                this._fpsFrames = 0;
                this._fpsLast = now;
            }

            requestAnimationFrame(this.loop);
        }


        snapCellPosition(cell) {
            if (!cell || cell.destroyed) return;
            cell.x = cell.nx;
            cell.y = cell.ny;
            cell.r = cell.nr;
            cell.ox = cell.nx;
            cell.oy = cell.ny;
            cell.or = cell.nr;
            cell.sprite.x = cell.x;
            cell.sprite.y = cell.y;
            cell.sprite.scale.set(1);
            cell._drawBody?.();
        }

        resetCameraToMapCenter() {
            const border = this.core.net?.border;
            if (!border?.width) return;
            const cam = this.camera;
            cam.x = cam.target.x = border.centerX;
            cam.y = cam.target.y = border.centerY;
            this._lastPivotX = NaN;
            this._lastPivotY = NaN;
            this._lastScale = NaN;
        }

        refreshCellsAfterMapChange() {
            const now = Date.now();
            for (let i = 0, len = this.cells.length; i < len; i++) {
                const cell = this.cells[i];
                if (!cell || cell.destroyed) continue;
                cell._visible = true;
                if (cell.sprite) cell.sprite.visible = true;
                cell.update(now);
            }
            if (!this.core.net?.isSpectating) {
                this.resetCameraToMapCenter();
            }
        }

        fixDeadCells() {
            const now = Date.now();
            for (let i = this.cells.length - 1; i >= 0; i--) {
                const cell = this.cells[i];
                if (!cell || cell.destroyed) continue;
                if (now - cell.updated > 3000) cell.destroy(null);
            }
        }

        clear() {
            for (let i = 0, len = this.cells.length; i < len; i++) {
                const cell = this.cells[i];
                if (!cell || cell.destroyed) continue;
                cell.destroyed = true;
                try {
                    cell.sprite?.destroy({ children: true });
                } catch (_) {}
            }
            this.cells = [];
            this.cellsByID = new Map();
            this.ownedCells = [];
            this.resetCameraToMapCenter();
            this.stage.removeChildren();
            this.backgroundSprite = null;
            this.sectorContainer = null;
            if (this.centerTop) {
                this.centerTop.attachTo(this.stage);
            }
        }

        updateCenterTopPosition() {
            const border = this.core?.net?.border;
            if (!border?.width || !this.centerTop) return;
            this.centerTop.setMapPosition(border.centerX, border.centerY);
        }


updateCamera() {
	  const hasCells = this.ownedCells.length > 0;
  const lim = hasCells ? this.zoomLimits.player : this.zoomLimits.spectate;
  this.zoom = Math.max(lim.min, Math.min(lim.max, this.zoom));

  const ownedCount = this.ownedCells.length;
  let score = 0;
  let sumR = 0;
  let targetX = 0;
  let targetY = 0;

  if (ownedCount > 0) {
    let validCells = 0;
    for (let i = 0; i < ownedCount; i++) {
      const cell = this.cellsByID.get(this.ownedCells[i]);
      if (!cell || cell.destroyed) continue;

      validCells++;
      const rSquared = cell.r * cell.r;
      score += ~~(rSquared / 100);
      targetX += cell.x;
      targetY += cell.y;
      sumR += cell.r;
    }

    if (validCells > 0) {
      this.camera.target.x = targetX / validCells;
      this.camera.target.y = targetY / validCells;
      this.calcViewZoom(sumR);
    }
  } else {
    const targetZoom = this.viewRange() * 0.2;
    this.viewZoom += (targetZoom - this.viewZoom) * this.zoomViewLerp;
  }

  const followDiv = ownedCount > 0 ? 2 : 14;
  const zoomFollowDiv = this.zoomScaleFollow;

  if (ownedCount === 0) {
    const border = this.core.net?.border;
    if (border?.width) {
      const t = clampToBorder(this.camera.target.x, this.camera.target.y, border);
      this.camera.target.x = t.x;
      this.camera.target.y = t.y;
    }

    const dx = this.camera.target.x - this.camera.x;
    const dy = this.camera.target.y - this.camera.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.8 / Math.max(this.camera.s, 0.2)) {
      this.camera.x = this.camera.target.x;
      this.camera.y = this.camera.target.y;
    } else {
      const base = this.spectateCameraLerp;
      const k = Math.min(0.16, base + dist / 12000);
      this.camera.x += dx * k;
      this.camera.y += dy * k;
    }

    if (border?.width) {
      const c = clampToBorder(this.camera.x, this.camera.y, border);
      this.camera.x = c.x;
      this.camera.y = c.y;
    }
  } else {
    this.camera.x += (this.camera.target.x - this.camera.x) / followDiv;
    this.camera.y += (this.camera.target.y - this.camera.y) / followDiv;
  }

  this.camera.target.s = this.viewZoom;
  this.camera.s += (this.camera.target.s - this.camera.s) / zoomFollowDiv;


  if (this._lastPivotX !== this.camera.x || this._lastPivotY !== this.camera.y) {
    this.stage.pivot.set(this.camera.x, this.camera.y);
    this._lastPivotX = this.camera.x;
    this._lastPivotY = this.camera.y;
  }

  if (this._lastScale !== this.camera.s) {
    this.stage.scale.set(this.camera.s);
    this._lastScale = this.camera.s;
  }


  this.stage.position.set(innerWidth / 2, innerHeight / 2);

  this.camera.score = score;
  this.updateMinimap();
}

        updateMinimap() {
            if (!this.minimapEntity || !this.core?.net?.border) return;
            const border = this.core.net.border;
            const miniW = this.minimapRenderer.width;
            const miniH = this.minimapRenderer.height;
            const pos = worldToMinimap(this.camera.x, this.camera.y, border, miniW, miniH);
            this.minimapEntity.position.set(pos.x, pos.y);
            if (this.core.ui?.highlightMinimapCell) {
                this.core.ui.highlightMinimapCell(pos.cell);
            }
        }

}
