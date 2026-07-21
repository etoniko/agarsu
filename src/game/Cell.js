import { getSkinImage as defaultGetSkinImage, loadCachedImage as defaultLoadCachedImage } from "../render/skins.js";
import { normalizeNick as defaultNormalizeNick } from "../lib/nick.js";
import { loadInvisibleSet, loadRotationSet } from "../storage/staticLists.js";
let deps = {
  S: null,
  getSkinImage: defaultGetSkinImage,
  loadCachedImage: defaultLoadCachedImage,
  normalizeNick: defaultNormalizeNick
};
function bindCellDeps(d) {
  deps = { ...deps, ...d };
}
function getCellDeps() {
  return deps;
}
const DEFAULT_TRANSPARENT = ["liqwid", "\u27E8\u672C\u27E9 Itana.", "\u2020\u0134\u03CE\xE24\u045C\xE2\u2020"];
function ensureNameSets(S) {
  if (!S.transparent) S.transparent = new Set(DEFAULT_TRANSPARENT);
  if (!S.invisible) {
    S.invisible = new Set();
    loadInvisibleSet().then((set) => {
      S.invisible = set;
    }).catch(() => {
    });
  }
  if (!S.rotation) {
    S.rotation = new Set();
    loadRotationSet().then((set) => {
      S.rotation = set;
    }).catch(() => {
    });
  }
}
function isEjectedMass(cell) {
  const S = deps.S;
  if (!cell || cell.isVirus || cell.isFood) return false;
  if (cell.isOwn) return false;
  const flags = cell.flag | 0;
  if (flags & 32 || flags & 64 || cell.isEjected) return true;
  const sz = cell.nSize || cell.size || 0;
  if (sz <= 0 || !(S.foodMaxSize > 0)) return false;
  return sz > S.foodMaxSize && sz <= Math.max(55, S.foodMaxSize + 20);
}
function getClientCellColor(cell) {
  const S = deps.S;
  if (!S.customClientColors) return null;
  if (cell.isVirus) return S.clientColorVirus;
  if (cell.isFood) return S.clientColorFood;
  if (cell.isOwn) return S.clientColorOwn;
  if (isEjectedMass(cell)) return S.clientColorEject;
  if (!cell.isVirus && !cell.isFood && !cell.isOwn) {
    return S.clientColorEnemy;
  }
  return null;
}
function drawVirusFillBackground(ctx, cell, renderSize, simpleRender, bigPointSize) {
  const S = deps.S;
  if (!S.customVirusBgEnabled || !S.virusBgImage || !S.virusBgImage.complete || !S.virusBgImage.width) {
    return false;
  }
  const half = (simpleRender ? renderSize : bigPointSize) * 1.15;
  ctx.save();
  ctx.clip();
  ctx.drawImage(S.virusBgImage, cell.x - half, cell.y - half, half * 2, half * 2);
  ctx.restore();
  return true;
}
function UText(usize, ucolor, ustroke, ustrokecolor) {
  usize && (this._size = usize);
  ucolor && (this._color = ucolor);
  this._stroke = !!ustroke;
  ustrokecolor && (this._strokeColor = ustrokecolor);
}
UText.prototype = {
  _value: "",
  _color: "#000000",
  _stroke: false,
  _strokeColor: "#000000",
  _size: 16,
  _canvas: null,
  _ctx: null,
  _dirty: false,
  _scale: 1,
  setSize(a) {
    if (this._size != a) {
      this._size = a;
      this._dirty = true;
    }
  },
  setScale(a) {
    if (this._scale != a) {
      this._scale = a;
      this._dirty = true;
    }
  },
  setStrokeColor(a) {
    if (this._strokeColor != a) {
      this._strokeColor = a;
      this._dirty = true;
    }
  },
  setValue(a) {
    if (a != this._value) {
      this._value = a;
      this._dirty = true;
    }
  },
  render() {
    if (null == this._canvas) {
      this._canvas = document.createElement("canvas");
      this._ctx = this._canvas.getContext("2d");
    }
    if (this._dirty) {
      this._dirty = false;
      const canvas = this._canvas;
      const ctx = this._ctx;
      const value = this._value;
      const scale = this._scale;
      const fontsize = this._size;
      const font = fontsize + "px Ubuntu";
      ctx.font = font;
      const h = ~~(0.2 * fontsize);
      const wd = fontsize * 0.1;
      const h2 = h * 0.2;
      canvas.width = ctx.measureText(value).width * scale + 3;
      canvas.height = (fontsize + h) * scale;
      ctx.font = font;
      ctx.globalAlpha = 1;
      ctx.lineWidth = wd;
      ctx.strokeStyle = this._strokeColor;
      ctx.fillStyle = this._color;
      ctx.scale(scale, scale);
      this._stroke && ctx.strokeText(value, 0, fontsize - h2);
      ctx.fillText(value, 0, fontsize - h2);
    }
    return this._canvas;
  },
  getWidth() {
    const ctx = deps.S && deps.S.ctx;
    if (!ctx) return 0;
    return ctx.measureText(this._value).width + 6;
  }
};
function Cell(uid, ux, uy, usize, ucolor, uname) {
  this.id = uid;
  this.ox = this.x = ux;
  this.oy = this.y = uy;
  this.oSize = this.size = usize;
  this.color = ucolor;
  this.points = [];
  this.pointsAcc = [];
  this.createPoints();
  this.setName(uname);
}
Cell.prototype = {
  id: 0,
  points: [],
  pointsAcc: [],
  name: null,
  nameCache: null,
  sizeCache: null,
  x: 0,
  y: 0,
  size: 0,
  ox: 0,
  oy: 0,
  oSize: 0,
  nx: 0,
  ny: 0,
  nSize: 0,
  flag: 0,
  updateTime: 0,
  drawTime: 0,
  destroyed: false,
  isVirus: false,
  isEjected: false,
  isAgitated: false,
  isFood: false,
  wasSimpleDrawing: true,
  fixedName: null,
  fixedColor: null,
  destroy() {
    const S = deps.S;
    S.nodesSortDirty = true;
    const tmpIndex = S.nodelist.indexOf(this);
    if (tmpIndex !== -1) S.nodelist.splice(tmpIndex, 1);
    delete S.nodes[this.id];
    const playerIndex = S.playerCells.indexOf(this);
    if (playerIndex !== -1) {
      S.ua = true;
      S.playerCells.splice(playerIndex, 1);
    }
    this.destroyed = true;
    this.fixedName = null;
    this.fixedColor = null;
  },
  getNameSize() {
    return Math.max(~~(0.3 * this.size), 24);
  },
  setName(name) {
    const S = deps.S;
    if (S.fixedCell) {
      if (this.fixedName === null) {
        this.fixedName = name;
      }
      name = this.fixedName;
    } else {
      this.fixedName = null;
    }
    this.name = name;
    this._skinNameKey = null;
    this._skinId = null;
    const size = this.getNameSize();
    if (!this.nameCache) {
      this.nameCache = new UText(size, "#FFFFFF", true, "#000000");
    } else {
      this.nameCache.setSize(size);
    }
    this.nameCache.setValue(name);
  },
  setSize(size) {
    this.nSize = size;
    const sizeHalf = this.getNameSize() * 0.5;
    if (!this.sizeCache) {
      this.sizeCache = new UText(sizeHalf, "#FFFFFF", true, "#000000");
    } else {
      this.sizeCache.setSize(sizeHalf);
    }
  },
  getNumPoints() {
    const S = deps.S;
    if (this.id === 0) return 16;
    let minPoints = this.size < 20 ? 0 : 10;
    if (this.isVirus) minPoints = 30;
    let b = this.isVirus ? this.size : this.size * S.viewZoom;
    b *= S.z;
    if (this.flag & 32) b *= 0.25;
    return ~~Math.max(b, minPoints);
  },
  createPoints() {
    const numPoints = this.getNumPoints();
    while (this.points.length > numPoints) {
      const idx = ~~(Math.random() * this.points.length);
      this.points.splice(idx, 1);
      this.pointsAcc.splice(idx, 1);
    }
    if (!this.points.length && numPoints > 0) {
      this.points.push({ ref: this, size: this.size, x: this.x, y: this.y });
      this.pointsAcc.push(Math.random() - 0.5);
    }
    while (this.points.length < numPoints) {
      const idx = ~~(Math.random() * this.points.length);
      const point = this.points[idx];
      this.points.splice(idx, 0, { ref: this, size: point.size, x: point.x, y: point.y });
      this.pointsAcc.splice(idx, 0, this.pointsAcc[idx]);
    }
  },
  movePoints() {
    const S = deps.S;
    if (S._perfMovePoints) S._perfMovePoints += 1;
    this.createPoints();
    const pts = this.points;
    const acc = this.pointsAcc;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const prev = acc[(i - 1 + n) % n];
      const next = acc[(i + 1) % n];
      acc[i] += (Math.random() - 0.5) * (this.isAgitated ? 3 : 1);
      acc[i] = Math.max(Math.min(acc[i] * 0.7, 10), -10);
      acc[i] = (prev + next + 8 * acc[i]) / 10;
    }
    const ref = this;
    const isVirus = this.isVirus ? 0 : (this.id / 1e3 + S.timestamp / 1e4) % (2 * Math.PI);
    for (let j = 0; j < n; j++) {
      let f = pts[j].size;
      const prev = pts[(j - 1 + n) % n].size;
      const next = pts[(j + 1) % n].size;
      if (this.size > 15 && S.qTree && this.size * S.viewZoom > 20 && this.id !== 0) {
        const x = pts[j].x;
        const y = pts[j].y;
        let collide = false;
        S.qTree.retrieve2(x - 5, y - 5, 10, 10, (a) => {
          if (a.ref !== ref && (x - a.x) ** 2 + (y - a.y) ** 2 < 625) collide = true;
        });
        if (!collide && (x < S.leftPos || y < S.topPos || x > S.rightPos || y > S.bottomPos)) {
          collide = true;
        }
        if (collide) acc[j] = Math.max(0, acc[j]) - 1;
      }
      f = Math.max(0, f + acc[j]);
      f = this.isAgitated ? (19 * f + this.size) / 20 : (12 * f + this.size) / 13;
      pts[j].size = (prev + next + 8 * f) / 10;
      const angle = 2 * Math.PI / n * j;
      let radius = pts[j].size;
      if (this.isVirus && j % 2 === 0) radius += 5;
      pts[j].x = this.x + Math.cos(angle + isVirus) * radius;
      pts[j].y = this.y + Math.sin(angle + isVirus) * radius;
    }
  },
  updatePos() {
    const S = deps.S;
    if (this.id === 0) return 1;
    let a = (S.timestamp - this.updateTime) / 120;
    a = Math.max(0, Math.min(1, a));
    const b = a;
    this.x = a * (this.nx - this.ox) + this.ox;
    this.y = a * (this.ny - this.oy) + this.oy;
    this.size = b * (this.nSize - this.oSize) + this.oSize;
    return b;
  },
  shouldRender() {
    const S = deps.S;
    if (this.id === 0) return true;
    const margin = 40;
    return !(this.x + this.size + margin < S.nodeX - S.canvasWidth / 2 / S.viewZoom || this.y + this.size + margin < S.nodeY - S.canvasHeight / 2 / S.viewZoom || this.x - this.size - margin > S.nodeX + S.canvasWidth / 2 / S.viewZoom || this.y - this.size - margin > S.nodeY + S.canvasHeight / 2 / S.viewZoom);
  },
  getEffectiveColor() {
    const S = deps.S;
    const clientColor = getClientCellColor(this);
    if (clientColor) return clientColor;
    if (!S.showColor) return "#AAAAAA";
    if (S.fixedCell) {
      if (this.fixedColor === null) {
        this.fixedColor = this.color || "#FFFFFF";
      }
      return this.fixedColor;
    }
    this.fixedColor = null;
    return this.color || "#FFFFFF";
  },
  getStrokeColor() {
    const base = this.getEffectiveColor();
    const parseColor = (i) => {
      const hexPart = base && base.length >= i + 2 ? base.substr(i, 2) : "00";
      let c = Math.floor(parseInt(hexPart, 16) * 0.9).toString(16);
      return c.length === 1 ? "0" + c : c;
    };
    return `#${parseColor(1)}${parseColor(3)}${parseColor(5)}`;
  },
  drawOneCell(ctx) {
    if (!this.shouldRender()) return;
    const S = deps.S;
    const getSkinImage = deps.getSkinImage || defaultGetSkinImage;
    const loadCachedImage = deps.loadCachedImage || defaultLoadCachedImage;
    const normalizeNick = deps.normalizeNick || defaultNormalizeNick;
    const transparent = S.transparent || new Set();
    const invisible = S.invisible || new Set();
    const rotation = S.rotation || new Set();
    const skinList = S.skinList || {};
    const simpleRender = this.id !== 0 && !this.isAgitated && S.smoothRender > S.viewZoom || this.getNumPoints() < 10;
    if (!simpleRender && this.wasSimpleDrawing) this.points.forEach((p) => p.size = this.size);
    let bigPointSize = this.size;
    if (!this.wasSimpleDrawing) this.points.forEach((p) => bigPointSize = Math.max(bigPointSize, p.size));
    this.wasSimpleDrawing = simpleRender;
    ctx.save();
    this.drawTime = S.timestamp;
    if (this._posFrame !== S.frameId) {
      this.updatePos();
    }
    let renderSize = this.size;
    if (renderSize === 0) renderSize = 20;
    ctx.lineWidth = S.closebord ? 0 : 10;
    ctx.lineCap = "round";
    ctx.lineJoin = this.isVirus ? "miter" : "round";
    const isTransp = transparent.has(this.name);
    const cellColor = this.getEffectiveColor();
    ctx.fillStyle = isTransp ? "rgba(0,0,0,0)" : cellColor;
    ctx.strokeStyle = isTransp ? "rgba(0,0,0,0)" : simpleRender ? cellColor : this.getStrokeColor();
    ctx.beginPath();
    if (simpleRender) {
      ctx.arc(this.x, this.y, renderSize, 0, 2 * Math.PI);
    } else {
      this.movePoints();
      ctx.moveTo(this.points[0].x, this.points[0].y);
      this.points.forEach((p) => ctx.lineTo(p.x, p.y));
    }
    ctx.closePath();
    const useVirusImageFill = this.isVirus && !isTransp && drawVirusFillBackground(ctx, this, renderSize, simpleRender, bigPointSize);
    if (!S.closebord) ctx.stroke();
    if (!useVirusImageFill) ctx.fill();
    if (S.showSkin && !this.isVirus) {
      const normalizeNickFn = deps.normalizeNick || defaultNormalizeNick;
      const skinName = this._skinNameKey ?? normalizeNickFn(this.name);
      if (this._skinNameKey !== skinName) {
        this._skinNameKey = skinName;
        this._skinId = skinList[skinName] || null;
      }
      const skinId = this._skinId;
      if (skinId) {
        const skinImg = getSkinImage(skinId);
        if (skinImg && skinImg.complete && skinImg.width > 0) {
          ctx.save();
          ctx.clip();
          if (typeof this.skinZoom === "undefined") this.skinZoom = 1;
          if (typeof this.skinPhase === "undefined") this.skinPhase = 0;
          if (this.glowActive && S.showGlow) {
            this.skinPhase += 0.05;
            const targetZoom = 1 + Math.abs(Math.sin(this.skinPhase)) * 0.08;
            this.skinZoom += (targetZoom - this.skinZoom) * 0.1;
          } else {
            this.skinZoom += (1 - this.skinZoom) * 0.05;
            this.skinPhase = 0;
          }
          const fw = skinImg.width;
          const fh = skinImg.height;
          const frame = fw > fh ? Math.floor(Date.now() / 100 % Math.floor(fw / fh)) : 0;
          const sz = simpleRender ? this.size * this.skinZoom : bigPointSize * this.skinZoom;
          if (rotation.has(skinName)) {
            if (!this._rot) {
              this._rot = {
                target: 0,
                current: 0,
                lastAngle: null
              };
            }
            const vx = this.nx - this.ox;
            const vy = this.ny - this.oy;
            let rawAngle;
            if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) {
              rawAngle = this._rot.lastAngle ?? this._rot.current;
            } else {
              rawAngle = Math.atan2(vy, vx);
            }
            if (this._rot.lastAngle == null) {
              this._rot.lastAngle = rawAngle;
              this._rot.target = rawAngle;
              this._rot.current = rawAngle;
            } else {
              let d = rawAngle - this._rot.lastAngle;
              if (d > Math.PI) d -= 2 * Math.PI;
              if (d < -Math.PI) d += 2 * Math.PI;
              this._rot.target += d;
              this._rot.lastAngle = rawAngle;
            }
            this._rot.current += (this._rot.target - this._rot.current) * 0.12;
            ctx.translate(this.x, this.y);
            ctx.rotate(this._rot.current);
            ctx.drawImage(
              skinImg,
              fw > fh ? frame * fh : 0,
              0,
              fh,
              fh,
              -sz,
              -sz,
              sz * 2,
              sz * 2
            );
          } else {
            ctx.drawImage(
              skinImg,
              fw > fh ? frame * fh : 0,
              0,
              fh,
              fh,
              this.x - sz,
              this.y - sz,
              sz * 2,
              sz * 2
            );
          }
          ctx.restore();
        }
      }
    }
    const mass = Math.floor(this.size * this.size * 0.01);
    if (typeof this.glowActive === "undefined") this.glowActive = false;
    if (!this.glowActive && mass >= 22400) this.glowActive = true;
    if (this.glowActive && mass <= 22300) this.glowActive = false;
    if (this.glowActive && S.showGlow) {
      const effectImg = loadCachedImage("/photo/limited.png");
      if (effectImg && effectImg.complete && effectImg.width > 0) {
        ctx.save();
        ctx.clip();
        const edrawSize = 2 * bigPointSize;
        ctx.globalAlpha = 1;
        ctx.drawImage(effectImg, this.x - edrawSize / 2, this.y - edrawSize / 2, edrawSize, edrawSize);
        ctx.restore();
      }
    }
    if (S.showStickers && this.stickerActive && this.currentSticker) {
      const stickerUrl = `https://agar.su/sticker/${this.currentSticker}.png`;
      const stickerImg = loadCachedImage(stickerUrl);
      if (stickerImg && stickerImg.complete && stickerImg.width > 0) {
        ctx.save();
        ctx.clip();
        const fw = stickerImg.width;
        const fh = stickerImg.height;
        const sz = this.size;
        ctx.drawImage(stickerImg, 0, 0, fw, fh, this.x - sz, this.y - sz, sz * 2, sz * 2);
        ctx.restore();
      }
    }
    if (this.id !== 0) {
      const x = this.x;
      const y = this.y;
      const zoomRatio = Math.ceil(10 * S.viewZoom) * 0.1;
      const invZoom = 1 / zoomRatio;
      if (S.showName && this.name && this.nameCache && this.size > 10) {
        let displayName = this.name;
        const lowerName = this.name.toLowerCase();
        if (invisible.has(lowerName)) displayName = "";
        this.nameCache.setValue(displayName);
        this.nameCache.setSize(this.getNameSize());
        this.nameCache.setScale(zoomRatio);
        const img = this.nameCache.render();
        let drawWidth = img.width * invZoom;
        let drawHeight = img.height * invZoom;
        const MAX_WIDTH_FACTOR = 2;
        const maxAllowedWidth = this.size * MAX_WIDTH_FACTOR;
        if (drawWidth > maxAllowedWidth) {
          const shrink = maxAllowedWidth / drawWidth;
          drawWidth *= shrink;
          drawHeight *= shrink;
        }
        const drawX = x - drawWidth / 2;
        const drawY = y - drawHeight / 2;
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      }
      if (S.showMass && !this.isVirus && !this.isEjected && !this.isAgitated && this.size > 100) {
        const massVal = Math.floor(this.size * this.size * 0.01);
        this.sizeCache.setValue(massVal);
        this.sizeCache.setScale(zoomRatio);
        const img = this.sizeCache.render();
        ctx.drawImage(
          img,
          x - img.width * invZoom / 2,
          y + img.height * 0.9 * invZoom,
          img.width * invZoom,
          img.height * invZoom
        );
      }
    }
    ctx.restore();
  }
};
export {
  Cell,
  UText,
  bindCellDeps,
  ensureNameSets,
  getCellDeps,
  getClientCellColor,
  isEjectedMass
};