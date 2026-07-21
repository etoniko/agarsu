import { getCookie } from "../storage/cookies.js";
import { getSkinImageUrl } from "./skins.js";
import { normalizeNick } from "../lib/nick.js";
import { calcViewZoom, mouseCoordinateChange, viewRange } from "../game/camera.js";
let deps = { S: null, hooks: {} };
let gridStyleCache = { theme: "gradient", center: "#132745", edge: "#000000", at: 0 };
const GRID_STYLE_CACHE_MS = 3e3;
let miniMapEls = null;
const MINIMAP_DOT_RADIUS = 5;
const ROW_LETTERS = ["A", "B", "C", "D", "E"];
let screenGradientCache = { key: "", gradient: null };
let perfOverlayEl = null;
const perfEnabled = typeof location !== "undefined" && new URLSearchParams(location.search).has("perf");
const perfStats = {
  frame: 0,
  sortMs: 0,
  drawMs: 0,
  qtreeMs: 0,
  miniMapMs: 0,
  nodes: 0,
  drawn: 0,
  movePoints: 0
};
function getGridStyle() {
  const now = Date.now();
  if (now - gridStyleCache.at > GRID_STYLE_CACHE_MS) {
    gridStyleCache = {
      theme: getCookie("grid_theme") || "gradient",
      center: getCookie("gradient_center") || "#132745",
      edge: getCookie("gradient_edge") || "#000000",
      at: now
    };
    screenGradientCache.key = "";
    screenGradientCache.gradient = null;
  }
  return gridStyleCache;
}
function buildMiniMapCellMap(cells) {
  const cellMap = new Map();
  if (!cells) return cellMap;
  cells.forEach((span) => {
    const key = span.textContent?.trim();
    if (key) cellMap.set(key, span);
  });
  return cellMap;
}
function initMiniMapLayout(els = miniMapEls) {
  if (!els?.dot || els.ready) return;
  els.dot.style.left = "0";
  els.dot.style.top = "0";
  els.dot.style.willChange = "transform";
  els.dot.style.transform = "translate3d(0,0,0)";
  els.ready = true;
}
function getMiniMapEls() {
  const container = document.querySelector(".map-container");
  if (!miniMapEls || miniMapEls.container !== container || !miniMapEls.dot?.isConnected) {
    const cells = container ? container.querySelectorAll("div > span") : null;
    miniMapEls = {
      mapRoot: document.getElementById("map"),
      dot: document.getElementById("mapposition"),
      container,
      cells,
      cellMap: buildMiniMapCellMap(cells),
      width: container?.offsetWidth || 0,
      height: container?.offsetHeight || 0,
      ready: false,
      visible: true,
      visibleAt: 0
    };
    initMiniMapLayout(miniMapEls);
  }
  return miniMapEls;
}
function isMiniMapOpen() {
  const els = getMiniMapEls();
  const now = Date.now();
  if (now - (els.visibleAt || 0) < 400) return els.visible;
  els.visibleAt = now;
  const mapEl = els.mapRoot || document.getElementById("map");
  els.visible = !!(mapEl && getComputedStyle(mapEl).display !== "none");
  return els.visible;
}
function ensurePerfOverlay() {
  if (!perfEnabled || perfOverlayEl) return;
  perfOverlayEl = document.createElement("div");
  perfOverlayEl.id = "perf-overlay";
  perfOverlayEl.style.cssText = "position:fixed;top:48px;left:8px;z-index:99999;background:rgba(0,0,0,.75);color:#0f0;font:12px/1.4 monospace;padding:8px 10px;border-radius:6px;pointer-events:none;white-space:pre";
  document.body.appendChild(perfOverlayEl);
}
function updatePerfOverlay(S) {
  if (!perfEnabled) return;
  ensurePerfOverlay();
  perfOverlayEl.textContent = `FPS ${S.fps}
nodes ${perfStats.nodes} drawn ${perfStats.drawn}
sort ${perfStats.sortMs.toFixed(2)}ms draw ${perfStats.drawMs.toFixed(2)}ms
qtree ${perfStats.qtreeMs.toFixed(2)}ms movePts ${perfStats.movePoints}
minimap ${perfStats.miniMapMs.toFixed(2)}ms
zoom ${S.viewZoom?.toFixed(2)} cells ${S.playerCells?.length || 0}`;
  window.__perfStats = { ...perfStats, fps: S.fps, viewZoom: S.viewZoom };
}
const centerBackground = new Image();
centerBackground.src = "/photo/center.png";
const innerImage = new Image();
innerImage.src = getSkinImageUrl("4");
let isBackgroundLoaded = false;
let isInnerImageLoaded = false;
let topPlayerNick = "";
let topPlayerScore = 0;
const backgroundWidth = 512;
const backgroundHeight = 512;
const innerImageWidth = 450;
const innerImageHeight = 450;
centerBackground.onload = () => {
  isBackgroundLoaded = true;
  if (deps.S?.ctx) drawCenterBackground();
};
innerImage.onload = () => {
  isInnerImageLoaded = true;
  if (deps.S?.ctx) drawCenterBackground();
};
function resizeCanvasToDisplaySize(canvas, dpr = window.devicePixelRatio || 1) {
  const width = Math.floor(window.innerWidth * dpr);
  const height = Math.floor(window.innerHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, dpr };
}
function clearScene(ctx, width, height, fillStyle) {
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }
}
function attachScene(S, hooks = {}) {
  deps = { S, hooks };
  requestAnimationFrame(() => initMiniMapLayout());
  return {
    redrawGameScene,
    drawGameScene,
    drawGrid,
    drawGradientGrid,
    drawClassicGrid,
    drawBlackGrid,
    drawWhiteGrid,
    drawCenterBackground,
    drawCustomMapBackground,
    updateMiniMapPosition,
    drawTouch,
    drawSplitIcon,
    loadTopPlayerData,
    buildQTree
  };
}
function loadTopPlayerData(stat) {
  const S = deps.S;
  if (!S) return;
  try {
    if (!stat?.length) return;
    const topPlayer = stat[0];
    topPlayerNick = topPlayer.nick;
    topPlayerScore = topPlayer.score;
    const skinId = S.skinList[normalizeNick(topPlayer.nick)];
    const nextSrc = getSkinImageUrl(skinId);
    if (innerImage.dataset.skinSrc !== nextSrc) {
      innerImage.dataset.skinSrc = nextSrc;
      isInnerImageLoaded = false;
      innerImage.src = nextSrc;
    }
  } catch (error) {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445 \u043E \u0442\u043E\u043F-1 \u0438\u0433\u0440\u043E\u043A\u0435:", error);
  }
}
function buildQTree() {
  const S = deps.S;
  if (!S || !S.Quad) return;
  if (deps.hooks.buildQTree) {
    deps.hooks.buildQTree(S);
    return;
  }
  const t0 = perfEnabled ? performance.now() : 0;
  if (0.4 > S.viewZoom) {
    S.qTree = null;
    if (perfEnabled) perfStats.qtreeMs = performance.now() - t0;
    return;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxSize = 0;
  for (let i = 0; i < S.nodelist.length; i++) {
    const node = S.nodelist[i];
    if (node.shouldRender() && !node.prepareData && 20 < node.size * S.viewZoom) {
      maxSize = Math.max(node.size, maxSize);
      minX = Math.min(node.x, minX);
      minY = Math.min(node.y, minY);
      maxX = Math.max(node.x, maxX);
      maxY = Math.max(node.y, maxY);
    }
  }
  S.qTree = S.Quad.init({
    minX: minX - (maxSize + 100),
    minY: minY - (maxSize + 100),
    maxX: maxX + (maxSize + 100),
    maxY: maxY + (maxSize + 100),
    maxChildren: 2,
    maxDepth: 4
  });
  for (let i = 0; i < S.nodelist.length; i++) {
    const node = S.nodelist[i];
    if (node.shouldRender() && !(20 >= node.size * S.viewZoom)) {
      for (let a = 0; a < node.points.length; ++a) {
        const px = node.points[a].x;
        const py = node.points[a].y;
        if (px < S.nodeX - S.canvasWidth / 2 / S.viewZoom || py < S.nodeY - S.canvasHeight / 2 / S.viewZoom || px > S.nodeX + S.canvasWidth / 2 / S.viewZoom || py > S.nodeY + S.canvasHeight / 2 / S.viewZoom) {
          continue;
        }
        S.qTree.insert(node.points[a]);
      }
    }
  }
  if (perfEnabled) perfStats.qtreeMs = performance.now() - t0;
}
function redrawGameScene(now) {
  const S = deps.S;
  if (!S) return;
  const delta = now - S.lastTime;
  S.lastTime = now;
  S.fps = Math.round(1e3 / delta);
  if (now - S.fpsUpdateTime >= 1e3) {
    const fpsEl = document.getElementById("fps");
    if (fpsEl) fpsEl.textContent = S.fps;
    S.fpsUpdateTime = now;
  }
  drawGameScene();
  const tMini = perfEnabled ? performance.now() : 0;
  updateMiniMapPosition();
  if (perfEnabled) perfStats.miniMapMs = performance.now() - tMini;
  (S.wHandle || window).requestAnimationFrame(redrawGameScene);
}
function drawGameScene() {
  const S = deps.S;
  if (!S?.ctx) return;
  S.frameId = (S.frameId || 0) + 1;
  S.timestamp = Date.now();
  const playerCount = S.playerCells.length;
  if (playerCount > 0) {
    calcViewZoom(S);
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < playerCount; i++) {
      const cell = S.playerCells[i];
      cell.updatePos();
      cell._posFrame = S.frameId;
      sumX += cell.x;
      sumY += cell.y;
    }
    const avgX = sumX / playerCount;
    const avgY = sumY / playerCount;
    S.posX = avgX;
    S.posY = avgY;
    S.posSize = S.viewZoom;
    S.nodeX = (S.nodeX + avgX) / 2;
    S.nodeY = (S.nodeY + avgY) / 2;
  } else {
    S.nodeX = (29 * S.nodeX + S.posX) / 30;
    S.nodeY = (29 * S.nodeY + S.posY) / 30;
    S.viewZoom = (9 * S.viewZoom + S.posSize * viewRange(S)) / 10;
  }
  buildQTree();
  mouseCoordinateChange(S);
  drawGrid();
  drawCenterBackground();
  if (S.nodesSortDirty !== false) {
    const tSort = perfEnabled ? performance.now() : 0;
    S.nodelist.sort((a, b) => a.size - b.size || a.id - b.id);
    S.nodesSortDirty = false;
    if (perfEnabled) perfStats.sortMs = performance.now() - tSort;
  } else if (perfEnabled) {
    perfStats.sortMs = 0;
  }
  perfStats.nodes = S.nodelist.length;
  if (perfEnabled) S._perfMovePoints = 0;
  const { ctx, canvasWidth, canvasHeight, viewZoom, nodeX, nodeY } = S;
  const tDraw = perfEnabled ? performance.now() : 0;
  ctx.save();
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.scale(viewZoom, viewZoom);
  ctx.translate(-nodeX, -nodeY);
  drawCustomMapBackground(ctx);
  for (let i = 0; i < S.nodelist.length; i++) {
    S.nodelist[i].drawOneCell(ctx);
  }
  ctx.restore();
  if (perfEnabled) {
    perfStats.drawMs = performance.now() - tDraw;
    perfStats.movePoints = S._perfMovePoints || 0;
    perfStats.frame = S.frameId;
    updatePerfOverlay(S);
  }
  drawSplitIcon(ctx);
  drawTouch(ctx);
}
function drawGrid() {
  const S = deps.S;
  if (!S?.ctx) return;
  const { theme } = getGridStyle();
  switch (theme) {
    case "gradient":
      drawGradientGrid();
      break;
    case "white":
      drawWhiteGrid();
      break;
    case "black":
      drawBlackGrid();
      break;
    default:
      drawGradientGrid();
  }
}
function drawGradientGrid() {
  const S = deps.S;
  if (!S?.ctx) return;
  const { center: centerColor, edge: edgeColor } = getGridStyle();
  const mapCenterX = (S.leftPos + S.rightPos) / 2;
  const mapCenterY = (S.topPos + S.bottomPos) / 2;
  const gradientRadius = Math.hypot(S.rightPos - S.leftPos, S.bottomPos - S.topPos) / 2;
  const { ctx, canvasWidth, canvasHeight, viewZoom, nodeX, nodeY } = S;
  const gx = Math.round(((mapCenterX - nodeX) * viewZoom + canvasWidth / 2) * 0.5) * 2;
  const gy = Math.round(((mapCenterY - nodeY) * viewZoom + canvasHeight / 2) * 0.5) * 2;
  const gr = Math.round(gradientRadius * viewZoom * 0.5) * 2;
  const cacheKey = `${centerColor}|${edgeColor}|${gx}|${gy}|${gr}`;
  if (screenGradientCache.key !== cacheKey) {
    screenGradientCache.key = cacheKey;
    screenGradientCache.gradient = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    screenGradientCache.gradient.addColorStop(0, centerColor);
    screenGradientCache.gradient.addColorStop(1, edgeColor);
  }
  ctx.fillStyle = screenGradientCache.gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}
function drawClassicGrid(bgColor, lineColor) {
  const S = deps.S;
  if (!S?.ctx) return;
  const { ctx, canvasWidth, canvasHeight, viewZoom, nodeX, nodeY } = S;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.save();
  ctx.scale(viewZoom, viewZoom);
  const vw = canvasWidth / viewZoom;
  const vh = canvasHeight / viewZoom;
  ctx.strokeStyle = lineColor;
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  let x = -0.5 + (-nodeX + vw / 2) % 50;
  for (; x < vw; x += 50) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, vh);
  }
  let y = -0.5 + (-nodeY + vh / 2) % 50;
  for (; y < vh; y += 50) {
    ctx.moveTo(0, y);
    ctx.lineTo(vw, y);
  }
  ctx.stroke();
  ctx.restore();
}
function drawBlackGrid() {
  drawClassicGrid("#101010", "white");
}
function drawWhiteGrid() {
  drawClassicGrid("#F2FBFF", "#111111");
}
function drawCenterBackground() {
  const S = deps.S;
  if (!S?.ctx || !isBackgroundLoaded) return;
  const mapCenterX = (S.leftPos + S.rightPos) / 2;
  const mapCenterY = (S.topPos + S.bottomPos) / 2;
  const screenX = (mapCenterX - S.nodeX) * S.viewZoom + S.canvasWidth / 2;
  const screenY = (mapCenterY - S.nodeY) * S.viewZoom + S.canvasHeight / 2;
  const scaledBackgroundWidth = backgroundWidth * S.viewZoom;
  const scaledBackgroundHeight = backgroundHeight * S.viewZoom;
  const scaledInnerImageWidth = innerImageWidth * S.viewZoom;
  const scaledInnerImageHeight = innerImageHeight * S.viewZoom;
  const { ctx } = S;
  if (isInnerImageLoaded) {
    ctx.save();
    const radius = Math.min(scaledInnerImageWidth, scaledInnerImageHeight) / 2;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      innerImage,
      screenX - scaledInnerImageWidth / 2,
      screenY - scaledInnerImageHeight / 2,
      scaledInnerImageWidth,
      scaledInnerImageHeight
    );
    ctx.restore();
  }
  ctx.drawImage(
    centerBackground,
    screenX - scaledBackgroundWidth / 2,
    screenY - scaledBackgroundHeight / 2,
    scaledBackgroundWidth,
    scaledBackgroundHeight
  );
  if (topPlayerNick || topPlayerScore) {
    const radius = Math.min(scaledInnerImageWidth, scaledInnerImageHeight) / 2;
    ctx.fillStyle = "white";
    ctx.font = `${22 * S.viewZoom}px Ubuntu`;
    ctx.textAlign = "center";
    if (topPlayerNick) {
      ctx.fillText(topPlayerNick, screenX, screenY + radius - 415 * S.viewZoom);
    }
    if (topPlayerScore) {
      ctx.fillText(`${topPlayerScore}`, screenX, screenY + radius - 15 * S.viewZoom);
    }
  }
}
function drawCustomMapBackground(ctx) {
  const S = deps.S;
  if (!S) return;
  if (!S.customMapBgEnabled || !S.mapBgImage?.complete || !S.mapBgImage.width) return;
  const left = S.leftPos;
  const top = S.topPos;
  const right = S.rightPos;
  const bottom = S.bottomPos;
  const mapW = right - left;
  const mapH = bottom - top;
  if (mapW <= 0 || mapH <= 0) return;
  const halfW = S.canvasWidth / (2 * S.viewZoom);
  const halfH = S.canvasHeight / (2 * S.viewZoom);
  const visLeft = Math.max(left, S.nodeX - halfW);
  const visRight = Math.min(right, S.nodeX + halfW);
  const visTop = Math.max(top, S.nodeY - halfH);
  const visBottom = Math.min(bottom, S.nodeY + halfH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, mapW, mapH);
  ctx.clip();
  if (S.customMapBgMode === "repeat") {
    const tile = Math.max(32, S.customMapBgTileSize | 0);
    const startX = left + Math.floor((visLeft - left) / tile) * tile;
    const startY = top + Math.floor((visTop - top) / tile) * tile;
    for (let x = startX; x < visRight; x += tile) {
      for (let y = startY; y < visBottom; y += tile) {
        ctx.drawImage(
          S.mapBgImage,
          x,
          y,
          Math.min(tile, right - x),
          Math.min(tile, bottom - y)
        );
      }
    }
  } else {
    ctx.drawImage(S.mapBgImage, left, top, mapW, mapH);
  }
  ctx.restore();
}
function updateMiniMapPosition() {
  const S = deps.S;
  if (!S || !isMiniMapOpen()) return;
  const els = getMiniMapEls();
  const { dot: playerDot, container: mapContainer, cellMap } = els;
  if (!playerDot || !mapContainer) return;
  const totalMapWidth = S.rightPos - S.leftPos;
  const totalMapHeight = S.bottomPos - S.topPos;
  if (totalMapWidth <= 0 || totalMapHeight <= 0) return;
  if (!els.width || !els.height) {
    els.width = mapContainer.offsetWidth;
    els.height = mapContainer.offsetHeight;
  }
  const miniMapWidth = els.width;
  const miniMapHeight = els.height;
  if (!miniMapWidth || !miniMapHeight) return;
  const miniX = Math.round((S.nodeX - S.leftPos) / totalMapWidth * miniMapWidth);
  const miniY = Math.round((S.nodeY - S.topPos) / totalMapHeight * miniMapHeight);
  const tx = miniX - MINIMAP_DOT_RADIUS;
  const ty = miniY - MINIMAP_DOT_RADIUS;
  if (S._miniMapTx !== tx || S._miniMapTy !== ty) {
    S._miniMapTx = tx;
    S._miniMapTy = ty;
    playerDot.style.transform = `translate3d(${tx}px,${ty}px,0)`;
  }
  const colIndex = Math.min(4, Math.max(0, Math.floor(miniX / (miniMapWidth / 5))));
  const rowIndex = Math.min(4, Math.max(0, Math.floor(miniY / (miniMapHeight / 5))));
  const currentCell = ROW_LETTERS[rowIndex] + (colIndex + 1);
  if (S.lastCell !== currentCell) {
    if (S.lastHighlightedSpan) S.lastHighlightedSpan.style.color = "";
    S.lastHighlightedSpan = cellMap?.get(currentCell) || null;
    if (S.lastHighlightedSpan) S.lastHighlightedSpan.style.color = "gold";
    S.lastCell = currentCell;
  }
}
function createCoordHandler(hooks = {}) {
  return function coord() {
    const S = deps.S;
    if (!S?.canSendCoord) return;
    if (S.lastCell) hooks.sendChat?.(S.lastCell);
    S.canSendCoord = false;
    setTimeout(() => {
      S.canSendCoord = true;
    }, 3e3);
  };
}
function drawTouch(ctx) {
  const S = deps.S;
  if (!S) return;
  ctx.save();
  if (S.touchable) {
    for (let i = 0; i < S.touches.length; i++) {
      const touch = S.touches[i];
      if (touch.identifier === S.leftTouchID) {
        ctx.beginPath();
        ctx.strokeStyle = "#0096ff";
        ctx.lineWidth = 6;
        ctx.arc(S.leftTouchStartPos.x, S.leftTouchStartPos.y, 40, 0, Math.PI * 2, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = "#0096ff";
        ctx.lineWidth = 2;
        ctx.arc(S.leftTouchStartPos.x, S.leftTouchStartPos.y, 140, 0, Math.PI * 2, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = "#0096ff";
        ctx.arc(S.leftTouchPos.x, S.leftTouchPos.y, 40, 0, Math.PI * 2, true);
        ctx.stroke();
        ctx.fillStyle = "#0096ff";
        ctx.fillRect(
          S.rawMouseX - S.cursorSize / 2,
          S.rawMouseY - S.cursorSize / 2,
          S.cursorSize,
          S.cursorSize
        );
      }
    }
  }
  ctx.restore();
}
function drawSplitIcon(ctx) {
  const S = deps.S;
  if (!S) return;
  const size = ~~(S.canvasWidth / 7);
  if (S.isTouchStart) {
    if (S.splitPressed && S.splitIcon?.width) {
      ctx.save();
      ctx.scale(1.1, 0);
    }
    if (S.splitIcon?.width) {
      ctx.drawImage(S.splitIcon, S.canvasWidth - size, S.canvasHeight - size, size, size);
    }
    if (S.splitPressed) {
      ctx.restore();
      setTimeout(() => {
        S.splitPressed = false;
      }, 150);
    }
    if (S.ejectPressed && S.ejectIcon?.width) {
      ctx.save();
      ctx.scale(1.1, 0);
    }
    if (S.ejectIcon?.width) {
      ctx.drawImage(
        S.ejectIcon,
        S.canvasWidth - size,
        S.canvasHeight - 2 * size - 20,
        size,
        size
      );
    }
    if (S.ejectPressed) {
      ctx.restore();
      setTimeout(() => {
        S.ejectPressed = false;
      }, 150);
    }
  }
}
export {
  attachScene,
  buildQTree,
  clearScene,
  createCoordHandler,
  drawBlackGrid,
  drawCenterBackground,
  drawClassicGrid,
  drawCustomMapBackground,
  drawGameScene,
  drawGradientGrid,
  drawGrid,
  drawSplitIcon,
  drawTouch,
  drawWhiteGrid,
  loadTopPlayerData,
  redrawGameScene,
  resizeCanvasToDisplaySize,
  updateMiniMapPosition
};