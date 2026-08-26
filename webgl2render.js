/**
 * Batched WebGL2 renderer: cells, skins, name, mass.
 * Canvas 2D keeps grid / map / touch; this canvas is composited on top.
 */
(function (global) {
  "use strict";

  const MAX_CIRCLES = 8192;
  const MAX_LABELS = 4096;
  const MAX_TEX = 8192;
  const LABEL_STRIDE = 5; // cx cy halfW halfH depth
  const TEX_STRIDE = 12; // cx cy r rot | u0 v0 u1 v1 | depth pad pad pad

  const FS_CIRCLE = `#version 300 es
precision mediump float;
in vec2 vLocal;
in vec4 vFill;
in vec4 vStroke;
in float vStrokeNorm;
out vec4 outColor;
void main() {
  float d = length(vLocal);
  if (d > 1.0) discard;
  outColor = vFill;
}`;

  const VS_CIRCLE = `#version 300 es
layout(location=0) in vec2 aUnit;
layout(location=1) in vec4 aData0; // cx cy radius strokeNorm
layout(location=2) in vec4 aFill;
layout(location=3) in vec4 aStroke;
layout(location=4) in float aDepth;
uniform vec2 uNode;
uniform float uZoom;
uniform vec2 uView;
out vec2 vLocal;
out vec4 vFill;
out vec4 vStroke;
out float vStrokeNorm;
void main() {
  vLocal = aUnit;
  vFill = aFill;
  vStroke = aStroke;
  vStrokeNorm = aData0.w;
  vec2 world = aData0.xy + aUnit * aData0.z;
  vec2 screen = (world - uNode) * uZoom + uView * 0.5;
  vec2 clip = vec2(screen.x / uView.x * 2.0 - 1.0, 1.0 - screen.y / uView.y * 2.0);
  gl_Position = vec4(clip, aDepth, 1.0);
}`;

  const VS_TEX = `#version 300 es
layout(location=0) in vec2 aUnit;
layout(location=1) in vec4 aData0; // cx cy radius rot
layout(location=2) in vec4 aUv;
layout(location=3) in float aDepth;
uniform vec2 uNode;
uniform float uZoom;
uniform vec2 uView;
out vec2 vLocal;
out vec2 vUv;
void main() {
  float c = cos(aData0.w), s = sin(aData0.w);
  vec2 rotated = vec2(c * aUnit.x - s * aUnit.y, s * aUnit.x + c * aUnit.y);
  vLocal = rotated;
  vUv = mix(aUv.xy, aUv.zw, aUnit * 0.5 + 0.5);
  vec2 world = aData0.xy + rotated * aData0.z;
  vec2 screen = (world - uNode) * uZoom + uView * 0.5;
  vec2 clip = vec2(screen.x / uView.x * 2.0 - 1.0, 1.0 - screen.y / uView.y * 2.0);
  gl_Position = vec4(clip, aDepth, 1.0);
}`;

  const FS_TEX = `#version 300 es
precision mediump float;
in vec2 vLocal;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uCircleClip;
out vec4 outColor;
void main() {
  if (uCircleClip > 0.5 && length(vLocal) > 1.0) discard;
  vec4 c = texture(uTex, vUv);
  if (c.a < 0.01) discard;
  outColor = c;
}`;

  const VS_LABEL = `#version 300 es
layout(location=0) in vec2 aUnit;
layout(location=1) in vec4 aData0; // cx cy halfW halfH
layout(location=2) in float aDepth;
uniform vec2 uNode;
uniform float uZoom;
uniform vec2 uView;
out vec2 vUv;
void main() {
  // Canvas textures: (0,0)=top-left. World +Y is down, so unit.y=-1 is visual top.
  vUv = vec2(aUnit.x * 0.5 + 0.5, aUnit.y * 0.5 + 0.5);
  vec2 world = aData0.xy + aUnit * aData0.zw;
  vec2 screen = (world - uNode) * uZoom + uView * 0.5;
  vec2 clip = vec2(screen.x / uView.x * 2.0 - 1.0, 1.0 - screen.y / uView.y * 2.0);
  gl_Position = vec4(clip, aDepth, 1.0);
}`;

  const FS_LABEL = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUv);
  if (c.a < 0.01) discard;
  outColor = c;
}`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(sh) || "compile failed";
      gl.deleteShader(sh);
      throw new Error(info);
    }
    return sh;
  }

  function program(gl, vs, fs) {
    const p = gl.createProgram();
    const v = compile(gl, gl.VERTEX_SHADER, vs);
    const f = compile(gl, gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(p) || "link failed";
      gl.deleteProgram(p);
      throw new Error(info);
    }
    return p;
  }

  function U(gl, p, n) {
    return gl.getUniformLocation(p, n);
  }

  function parseHex(hex) {
    if (!hex || typeof hex !== "string") return [1, 1, 1, 1];
    if (hex.charAt(0) === "r") {
      const m = hex.match(/[\d.]+/g);
      if (m && m.length >= 3) {
        return [(+m[0]) / 255, (+m[1]) / 255, (+m[2]) / 255, m[3] != null ? +m[3] : 1];
      }
    }
    let h = hex.charAt(0) === "#" ? hex.slice(1) : hex;
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return [1, 1, 1, 1];
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, 1];
  }

  var skinFrameCanvas = null;
  /** Wide strip skins (e.g. 10400×400) exceed MAX_TEXTURE_SIZE — upload one frame only. */
  function prepareSkinGpuSource(gl, img, frameIndex) {
    const fw = img.naturalWidth || img.width || 0;
    const fh = img.naturalHeight || img.height || 0;
    if (!fw || !fh) return null;
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 8192;
    const isStrip = fw > fh;
    const frameCount = isStrip ? Math.max(1, Math.floor(fw / fh)) : 1;
    const frame = ((frameIndex | 0) % frameCount + frameCount) % frameCount;
    const sw = isStrip ? fh : fw;
    const sh = fh;
    const sx = isStrip ? frame * fh : 0;
    const version = fw * 1009 + fh + frame * 7919;

    if (fw <= maxTex && fh <= maxTex) {
      return {
        source: img,
        u0: isStrip ? sx / fw : 0,
        u1: isStrip ? (sx + sw) / fw : 1,
        version
      };
    }

    if (!skinFrameCanvas) skinFrameCanvas = document.createElement("canvas");
    if (skinFrameCanvas.width !== sw || skinFrameCanvas.height !== sh) {
      skinFrameCanvas.width = sw;
      skinFrameCanvas.height = sh;
    }
    const ctx = skinFrameCanvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(img, sx, 0, sw, sh, 0, 0, sw, sh);
    return { source: skinFrameCanvas, u0: 0, u1: 1, version };
  }

  class TextureCache {
    constructor(gl, maxEntries) {
      this.gl = gl;
      this.map = new Map();
      this.maxEntries = maxEntries || 512;
      this.frame = 0;
    }
    beginFrame() {
      this.frame++;
    }
    get(key, source, version) {
      if (!source) return null;
      const w = source.width | 0;
      const h = source.height | 0;
      if (!w || !h) return null;
      let e = this.map.get(key);
      const gl = this.gl;
      if (!e) {
        if (this.map.size >= this.maxEntries) this._evict();
        e = { tex: gl.createTexture(), w: 0, h: 0, version: -1, used: this.frame };
        this.map.set(key, e);
      }
      e.used = this.frame;
      if (e.w !== w || e.h !== h || e.version !== version) {
        gl.bindTexture(gl.TEXTURE_2D, e.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        } catch (err) {
          return null;
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        e.w = w;
        e.h = h;
        e.version = version;
      }
      // touch for LRU order
      this.map.delete(key);
      this.map.set(key, e);
      return e;
    }
    _evict() {
      const gl = this.gl;
      const target = Math.floor(this.maxEntries * 0.75);
      while (this.map.size > target) {
        const oldest = this.map.keys().next().value;
        const e = this.map.get(oldest);
        if (e && e.tex) gl.deleteTexture(e.tex);
        this.map.delete(oldest);
      }
    }
    destroy() {
      this.map.forEach((e) => this.gl.deleteTexture(e.tex));
      this.map.clear();
    }
  }

  function WebGL2Renderer(canvas) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    if (!gl) throw new Error("WebGL2 unavailable");

    this.canvas = canvas;
    this.gl = gl;
    this.ready = false;
    this.drawn = 0;
    // Separate pools: label churn (mass) must not evict skins
    this.texMedia = new TextureCache(gl, 512);  // skins / stickers / glow / virus
    this.texLabels = new TextureCache(gl, 384); // nick (shared) + mass (per-cell)

    const STRIDE = 16;
    this.CIRCLE_STRIDE = STRIDE;
    this.TEX_STRIDE = TEX_STRIDE;
    this.circleData = new Float32Array(MAX_CIRCLES * STRIDE);
    this.texData = new Float32Array(MAX_TEX * TEX_STRIDE);
    this.texScratch = new Float32Array(TEX_STRIDE);
    this.labelData = new Float32Array(MAX_LABELS * LABEL_STRIDE);
    this._labelBatches = new Map();
    this._texBatches = new Map(); // glTexture -> { entry, clip, floats[] }
    this._labelFlat = [];

    const unit = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.unitBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.unitBuf);
    gl.bufferData(gl.ARRAY_BUFFER, unit, gl.STATIC_DRAW);

    this.circleBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.circleData.byteLength, gl.DYNAMIC_DRAW);

    this.texBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.texData.byteLength, gl.DYNAMIC_DRAW);

    this.labelBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.labelBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.labelData.byteLength, gl.DYNAMIC_DRAW);

    this.progCircle = program(gl, VS_CIRCLE, FS_CIRCLE);
    this.progTex = program(gl, VS_TEX, FS_TEX);
    this.progLabel = program(gl, VS_LABEL, FS_LABEL);

    this.uC = {
      node: U(gl, this.progCircle, "uNode"),
      zoom: U(gl, this.progCircle, "uZoom"),
      view: U(gl, this.progCircle, "uView")
    };
    this.uT = {
      node: U(gl, this.progTex, "uNode"),
      zoom: U(gl, this.progTex, "uZoom"),
      view: U(gl, this.progTex, "uView"),
      tex: U(gl, this.progTex, "uTex"),
      clip: U(gl, this.progTex, "uCircleClip")
    };
    this.uL = {
      node: U(gl, this.progLabel, "uNode"),
      zoom: U(gl, this.progLabel, "uZoom"),
      view: U(gl, this.progLabel, "uView"),
      tex: U(gl, this.progLabel, "uTex")
    };

    this.vaoCircle = gl.createVertexArray();
    gl.bindVertexArray(this.vaoCircle);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.unitBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleBuf);
    const cs = STRIDE * 4;
    // aData0: cx cy radius strokeNorm
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, cs, 0);
    gl.vertexAttribDivisor(1, 1);
    // aFill
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, cs, 16);
    gl.vertexAttribDivisor(2, 1);
    // aStroke
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, cs, 32);
    gl.vertexAttribDivisor(3, 1);
    // aDepth
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, cs, 48);
    gl.vertexAttribDivisor(4, 1);

    this.vaoTex = gl.createVertexArray();
    gl.bindVertexArray(this.vaoTex);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.unitBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuf);
    const ts = TEX_STRIDE * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, ts, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, ts, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, ts, 32);
    gl.vertexAttribDivisor(3, 1);

    this.vaoLabel = gl.createVertexArray();
    gl.bindVertexArray(this.vaoLabel);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.unitBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.labelBuf);
    const ls = LABEL_STRIDE * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, ls, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, ls, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0, 0, 0, 0);
    this.ready = true;
  }

  WebGL2Renderer.prototype.resize = function (w, h) {
    w = Math.max(1, w | 0);
    h = Math.max(1, h | 0);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  };

  WebGL2Renderer.prototype.destroy = function () {
    const gl = this.gl;
    this.texMedia.destroy();
    this.texLabels.destroy();
    [this.unitBuf, this.circleBuf, this.texBuf, this.labelBuf].forEach((b) => gl.deleteBuffer(b));
    [this.vaoCircle, this.vaoTex, this.vaoLabel].forEach((v) => gl.deleteVertexArray(v));
    [this.progCircle, this.progTex, this.progLabel].forEach((p) => gl.deleteProgram(p));
    this.ready = false;
  };

  WebGL2Renderer.prototype._queueTex = function (entry, x, y, r, rot, u0, v0, u1, v1, depth, clip) {
    if (!entry || !entry.tex) return;
    const key = entry.tex;
    let batch = this._texBatches.get(key);
    if (!batch) {
      batch = { entry, clip: clip ? 1 : 0, floats: [] };
      this._texBatches.set(key, batch);
    }
    const f = batch.floats;
    f.push(x, y, r, rot || 0, u0, v0, u1, v1, depth, 0, 0, 0);
  };

  WebGL2Renderer.prototype._flushTex = function (cam) {
    const gl = this.gl;
    if (!this._texBatches.size) return;
    const stride = this.TEX_STRIDE;
    const buf = this.texData;
    const maxInst = (buf.length / stride) | 0;

    gl.useProgram(this.progTex);
    gl.bindVertexArray(this.vaoTex);
    gl.uniform2f(this.uT.node, cam.nodeX, cam.nodeY);
    gl.uniform1f(this.uT.zoom, cam.zoom);
    gl.uniform2f(this.uT.view, cam.w, cam.h);
    gl.uniform1i(this.uT.tex, 0);
    gl.activeTexture(gl.TEXTURE0);

    this._texBatches.forEach((batch) => {
      const items = batch.floats;
      const total = (items.length / stride) | 0;
      if (!total) return;
      gl.uniform1f(this.uT.clip, batch.clip);
      gl.bindTexture(gl.TEXTURE_2D, batch.entry.tex);
      let offset = 0;
      while (offset < total) {
        const count = Math.min(maxInst, total - offset);
        const floatCount = count * stride;
        const srcStart = offset * stride;
        buf.set(items.slice(srcStart, srcStart + floatCount));
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf.subarray(0, floatCount));
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
        offset += count;
      }
    });
    this._texBatches.clear();
  };

  // Immediate path (rare): queue + flush one
  WebGL2Renderer.prototype._drawTex = function (entry, x, y, r, rot, u0, v0, u1, v1, depth, clip, cam) {
    this._queueTex(entry, x, y, r, rot, u0, v0, u1, v1, depth, clip);
    this._flushTex(cam);
  };

  WebGL2Renderer.prototype._queueLabel = function (entry, cx, cy, halfW, halfH, depth) {
    if (!entry || !(halfW > 0) || !(halfH > 0)) return;
    let batch = this._labelBatches.get(entry.tex);
    if (!batch) {
      batch = [];
      this._labelBatches.set(entry.tex, batch);
    }
    batch.push(cx, cy, halfW, halfH, depth);
  };

  WebGL2Renderer.prototype._flushLabels = function (cam) {
    const gl = this.gl;
    if (!this._labelBatches.size) return;
    gl.useProgram(this.progLabel);
    gl.bindVertexArray(this.vaoLabel);
    gl.uniform2f(this.uL.node, cam.nodeX, cam.nodeY);
    gl.uniform1f(this.uL.zoom, cam.zoom);
    gl.uniform2f(this.uL.view, cam.w, cam.h);
    gl.uniform1i(this.uL.tex, 0);
    gl.activeTexture(gl.TEXTURE0);

    this._labelBatches.forEach((items, tex) => {
      const count = (items.length / LABEL_STRIDE) | 0;
      if (!count) return;
      const need = count * LABEL_STRIDE;
      if (need > this.labelData.length) {
        // draw in chunks
        let offset = 0;
        while (offset < items.length) {
          const chunkFloats = Math.min(this.labelData.length, items.length - offset);
          const chunkCount = (chunkFloats / LABEL_STRIDE) | 0;
          this.labelData.set(items.slice(offset, offset + chunkCount * LABEL_STRIDE));
          gl.bindBuffer(gl.ARRAY_BUFFER, this.labelBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.labelData.subarray(0, chunkCount * LABEL_STRIDE));
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, chunkCount);
          offset += chunkCount * LABEL_STRIDE;
        }
        return;
      }
      this.labelData.set(items);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.labelBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.labelData.subarray(0, need));
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    });
    this._labelBatches.clear();
  };

  WebGL2Renderer.prototype._drawLabel = function (entry, cx, cy, halfW, halfH, depth, cam) {
    // backward-compat immediate path
    this._queueLabel(entry, cx, cy, halfW, halfH, depth);
    this._flushLabels(cam);
  };

  WebGL2Renderer.prototype.renderCells = function (S, nodelist, deps) {
    if (!this.ready || !S) return false;
    const gl = this.gl;
    const w = S.canvasWidth | 0;
    const h = S.canvasHeight | 0;
    this.resize(w, h);
    this.texMedia.beginFrame();
    this.texLabels.beginFrame();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const list = nodelist || S.nodelist || [];
    const total = list.length;
    if (!total) {
      this.drawn = 0;
      return true;
    }

    const getSkinImage = deps && deps.getSkinImage;
    const getOwnedSkinDrawable = deps && deps.getOwnedSkinDrawable;
    const isSkinImageReady =
      (deps && deps.isSkinImageReady) ||
      ((img) => !!(img && img.complete && (img.naturalWidth || img.width) > 0));
    const loadCachedImage = deps && deps.loadCachedImage;
    const normalizeNick = (deps && deps.normalizeNick) || ((x) => (x || "").toLowerCase());
    const getStickerUrl = deps && deps.getStickerUrl;

    const transparent = S.transparent || new Set();
    const invisible = S.invisible || new Set();
    const rotation = S.rotation || new Set();
    const skinList = S.skinList || {};
    const viewZoom = S.viewZoom || 1;
    const textZoomRatio = S.textZoomRatio || Math.ceil(10 * viewZoom) * 0.1;
    const invZoom = S.textInvZoom || 1 / Math.max(textZoomRatio, 0.001);
    const host = String(S.CONNECTION_URL || S.currentWebSocketUrl || S.wsUrl || "");
    const noMassLimitGlow = /megasplit|:6013\/|sixz\.ru:6013|:6014\/|sixz\.ru:6017|:6017\/|\/d(?:ffa|rookery|arctida)/i.test(host);

    const cam = { nodeX: S.nodeX, nodeY: S.nodeY, zoom: viewZoom, w, h };
    // Layer spacing: larger nodelist index = closer. Labels sit just in front of own cell,
    // but behind any larger cell that covers them (same as canvas draw order).
    const layerStep = 1.0 / (total + 2);
    const depthFill = (i) => 1.0 - (i + 1) * layerStep;
    const depthSkin = (i) => depthFill(i) - layerStep * 0.25;
    const depthLabel = (i) => depthFill(i) - layerStep * 0.5;
    const skinFrameBase = ((S.timestamp || Date.now()) / 100) | 0;
    this._labelBatches.clear();
    this._texBatches.clear();

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);

    const data = this.circleData;
    const stride = this.CIRCLE_STRIDE;
    let cN = 0;
    let drawn = 0;
    const visible = [];

    for (let i = 0; i < total; i++) {
      const cell = list[i];
      if (!cell || (typeof cell.shouldRender === "function" && !cell.shouldRender())) continue;
      if (cell._posFrame !== S.frameId && typeof cell.updatePos === "function") {
        cell.updatePos();
        cell._posFrame = S.frameId;
      }
      cell.drawTime = S.timestamp;

      let renderSize = cell.size;
      if (renderSize === 0) renderSize = 20;

      const skinName = normalizeNick(cell.name);
      if (cell._skinNameKey !== skinName) {
        cell._skinNameKey = skinName;
        cell._skinId = null;
      }
      const skinId = skinList[skinName] || null;
      if (cell._skinId !== skinId) cell._skinId = skinId;

      const wantTransp = !!(S.showSkin && !cell.isVirus && transparent.has(cell.name));
      let ownedSkinImg = null;
      if (wantTransp && skinId) {
        ownedSkinImg = typeof getOwnedSkinDrawable === "function"
          ? getOwnedSkinDrawable(skinId)
          : null;
      }
      // Transparent fill only when real skin is drawable — otherwise keep cell color.
      const isTransp = !!(wantTransp && ownedSkinImg);
      const cellColor = typeof cell.getEffectiveColor === "function" ? cell.getEffectiveColor() : (cell.color || "#FFFFFF");
      const fill = isTransp ? [0, 0, 0, 0] : parseHex(cellColor);
      const stroke = [0, 0, 0, 0];
      const strokeNorm = 0;

      let skipFill = false;
      if (cell.isVirus && !isTransp && S.customVirusBgEnabled && S.virusBgImage && S.virusBgImage.complete && S.virusBgImage.width) {
        skipFill = true;
        fill[3] = 0;
      }

      if (cN < MAX_CIRCLES) {
        const o = cN * stride;
        const rad = renderSize + 1 / Math.max(viewZoom, 0.001);
        data[o] = cell.x;
        data[o + 1] = cell.y;
        data[o + 2] = rad;
        data[o + 3] = strokeNorm;
        data[o + 4] = fill[0];
        data[o + 5] = fill[1];
        data[o + 6] = fill[2];
        data[o + 7] = skipFill ? 0 : fill[3];
        data[o + 8] = stroke[0];
        data[o + 9] = stroke[1];
        data[o + 10] = stroke[2];
        data[o + 11] = stroke[3];
        data[o + 12] = depthFill(i);
        cN++;
      }

      visible.push({ i, cell, renderSize, isTransp, skipFill, skinName, skinId, ownedSkinImg });
      drawn++;
    }

    if (cN > 0) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.useProgram(this.progCircle);
      gl.bindVertexArray(this.vaoCircle);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.circleBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, cN * stride));
      gl.uniform2f(this.uC.node, cam.nodeX, cam.nodeY);
      gl.uniform1f(this.uC.zoom, cam.zoom);
      gl.uniform2f(this.uC.view, cam.w, cam.h);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cN);
    }

    for (let v = 0; v < visible.length; v++) {
      const { i, cell, renderSize, isTransp, skipFill, skinName, skinId, ownedSkinImg } = visible[v];
      const dSkin = depthSkin(i);

      if (skipFill && S.virusBgImage) {
        const half = renderSize * 1.15;
        const entry = this.texMedia.get("virus", S.virusBgImage, S.virusBgImage.width);
        this._queueTex(entry, cell.x, cell.y, half, 0, 0, 0, 1, 1, dSkin, true);
      }

      if (S.showSkin && !cell.isVirus) {
        let skinImg = null;
        let petriSkinKey = null;
        if (isTransp) {
          skinImg = ownedSkinImg;
        } else if (skinId && getSkinImage) {
          skinImg = getSkinImage(skinId);
        } else if (!skinId && loadCachedImage && /sixz\.ru:6011|:6011\/|megasplit|hardcore9|sixz\.ru:6013|:6013\/|sixz\.ru:6017|:6017\//i.test(host) && cell.name) {
          let skinUrl = null;
          if (/sixz\.ru:6017|:6017\b/i.test(String(host || ""))) {
            const raw = String(cell.name || "");
            const nl = raw.indexOf("\n");
            if (nl > 0) {
              const skinPath = raw.slice(0, nl).trim();
              let display = raw.slice(nl + 1);
              if (display.charCodeAt(0) === 4) display = display.slice(1);
              display = display.split("#")[0].replace(/<[^>]*>/g, "").trim();
              if (skinPath && display) {
                petriSkinKey = (skinPath + "|" + display).toLowerCase();
                skinUrl = "https://xn--bdk.pw:6016/api/getSkin?bridge=bubble&username=" + encodeURIComponent(display) + "&skin=" + encodeURIComponent(skinPath);
              }
            }
          } else {
            const bare = String(cell.name).split("#")[0].replace(/<[^>]*>/g, "").trim();
            if (bare) {
              petriSkinKey = bare.toLowerCase();
              const bridge = /sixz\.ru:6013|:6013\b/i.test(String(host || "")) ? "agarz" : "petri";
              skinUrl = "https://xn--bdk.pw:6016/api/getSkin?bridge=" + bridge + "&username=" + encodeURIComponent(bare);
            }
          }
          if (skinUrl) skinImg = loadCachedImage(skinUrl);
        }
        if (skinImg && isSkinImageReady(skinImg)) {
            if (typeof cell.skinZoom === "undefined") cell.skinZoom = 1;
            if (typeof cell.skinPhase === "undefined") cell.skinPhase = 0;
            if (cell.glowActive && S.showGlow) {
              cell.skinPhase += 0.05;
              const targetZoom = 1 + Math.abs(Math.sin(cell.skinPhase)) * 0.08;
              cell.skinZoom += (targetZoom - cell.skinZoom) * 0.1;
            } else {
              cell.skinZoom += (1 - cell.skinZoom) * 0.05;
              cell.skinPhase = 0;
            }
            const fw = skinImg.naturalWidth || skinImg.width;
            const fh = skinImg.naturalHeight || skinImg.height;
            const frame = fw > fh ? skinFrameBase % Math.floor(fw / fh) : 0;
            const sz = cell.size * cell.skinZoom;
            let rot = 0;
            if (rotation.has(skinName)) {
              if (!cell._rot) cell._rot = { target: 0, current: 0, lastAngle: null };
              const vx = cell.nx - cell.ox;
              const vy = cell.ny - cell.oy;
              let rawAngle = Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6
                ? (cell._rot.lastAngle != null ? cell._rot.lastAngle : cell._rot.current)
                : Math.atan2(vy, vx);
              if (cell._rot.lastAngle == null) {
                cell._rot.lastAngle = rawAngle;
                cell._rot.target = rawAngle;
                cell._rot.current = rawAngle;
              } else {
                let dd = rawAngle - cell._rot.lastAngle;
                if (dd > Math.PI) dd -= 2 * Math.PI;
                if (dd < -Math.PI) dd += 2 * Math.PI;
                cell._rot.target += dd;
                cell._rot.lastAngle = rawAngle;
              }
              cell._rot.current += (cell._rot.target - cell._rot.current) * 0.12;
              rot = cell._rot.current;
            }
            const gpu = prepareSkinGpuSource(gl, skinImg, frame);
            if (gpu) {
              const entry = this.texMedia.get("skin:" + (skinId || ("petri:" + (petriSkinKey || cell.name || "x"))) + ":f" + frame, gpu.source, gpu.version);
              if (entry) this._queueTex(entry, cell.x, cell.y, sz, rot, gpu.u0, 0, gpu.u1, 1, dSkin, true);
            }
          }
      }

      const mass = Math.floor(cell.size * cell.size * 0.01);
      if (typeof cell.glowActive === "undefined") cell.glowActive = false;
      if (noMassLimitGlow) cell.glowActive = false;
      else {
        if (!cell.glowActive && mass >= 22400) cell.glowActive = true;
        if (cell.glowActive && mass <= 22300) cell.glowActive = false;
      }
      if (cell.glowActive && S.showGlow && loadCachedImage) {
        const effectImg = loadCachedImage("/photo/limited.png");
        if (effectImg && effectImg.complete && effectImg.width > 0) {
          const entry = this.texMedia.get("glow", effectImg, effectImg.width);
          this._queueTex(entry, cell.x, cell.y, cell.size, 0, 0, 0, 1, 1, depthSkin(i), true);
        }
      }

      if (S.showStickers && cell.stickerActive && cell.currentSticker && getStickerUrl && loadCachedImage) {
        const stickerUrl = getStickerUrl(S.stickerList, cell.name, cell.currentSticker);
        if (stickerUrl) {
          const stickerImg = loadCachedImage(stickerUrl);
          if (stickerImg && stickerImg.complete && stickerImg.width > 0) {
            const entry = this.texMedia.get("stk:" + stickerUrl, stickerImg, stickerImg.width);
            this._queueTex(entry, cell.x, cell.y, cell.size, 0, 0, 0, 1, 1, depthSkin(i), true);
          }
        }
      }

      if (cell.id === 0) continue;

      const screenSize = cell.size * viewZoom;
      const dLabel = depthLabel(i);
      // Names always (any zoom); mass still gated by on-screen size
      const showMassLabels = screenSize > 28;

      if (textZoomRatio !== cell._txtZoom) {
        cell._txtZoom = textZoomRatio;
        if (cell.nameCache) cell.nameCache.setScale(textZoomRatio);
        if (cell.sizeCache) cell.sizeCache.setScale(textZoomRatio);
      }

      if (S.showName && cell.name && cell.nameCache && cell.size > 10) {
        let displayName = cell.name;
        if (/sixz\.ru:6017|:6017\b/i.test(host)) {
          const raw = String(cell.name || "");
          if (raw.indexOf("\n") >= 0) displayName = raw.slice(raw.indexOf("\n") + 1);
          if (displayName.charCodeAt(0) === 4) displayName = displayName.slice(1);
          displayName = displayName.split("#")[0].replace(/<[^>]*>/g, "").trim();
        } else if (!/sixz\.ru:6011|:6011\/|megasplit|hardcore9/i.test(host) && invisible.has(cell._nameLower)) {
          displayName = "";
        }
        if (displayName) {
          const nameSizeRaw = typeof cell.getNameSize === "function" ? cell.getNameSize() : Math.max(~~(0.3 * cell.size), 24);
          // Quantize font size so split-cells share one texture (visual snap ≤4px)
          const nameSize = Math.max(24, (nameSizeRaw + 2) & ~3);
          const region = S.playRegion || "ru";
          const light = region === "tr" || region === "eu" || region === "en";
          const wantsStroke = !light && S.renderQuality !== "low";
          const labelFont = light ? "Arial" : "Ubuntu";
          if (displayName !== cell._txtNameVal) {
            cell._txtNameVal = displayName;
            cell.nameCache.setValue(displayName);
          }
          if (nameSize !== cell._txtNameSize) {
            cell._txtNameSize = nameSize;
            cell.nameCache.setSize(nameSize);
          }
          if (wantsStroke !== cell._txtNameStroke) {
            cell._txtNameStroke = wantsStroke;
            cell.nameCache.setStroke(wantsStroke);
          }
          if (labelFont !== cell._txtNameFont) {
            cell._txtNameFont = labelFont;
            if (typeof cell.nameCache.setFont === "function") cell.nameCache.setFont(labelFont);
          }
          const img = cell.nameCache.render();
          let drawWidth = img.width * invZoom;
          let drawHeight = img.height * invZoom;
          const maxAllowedWidth = cell.size * 2;
          if (drawWidth > maxAllowedWidth) {
            const shrink = maxAllowedWidth / drawWidth;
            drawWidth *= shrink;
            drawHeight *= shrink;
          }
          // Shared by nick+size (splits / same nick reuse one GL texture)
          const qZoom = textZoomRatio * 10 | 0;
          const entry = this.texLabels.get(
            "n:" + displayName + ":" + nameSize + ":" + qZoom + ":" + (wantsStroke ? 1 : 0) + ":" + labelFont,
            img,
            img.width * 10007 + img.height
          );
          this._queueLabel(entry, cell.x, cell.y, drawWidth * 0.5, drawHeight * 0.5, dLabel);
        }
      }

      if (
        S.renderQuality !== "low" &&
        S.showMass &&
        showMassLabels &&
        !cell.isVirus &&
        !cell.isEjected &&
        !cell.isAgitated &&
        cell.size > 100 &&
        cell.sizeCache
      ) {
        const massSizeRaw = typeof cell.getNameSize === "function" ? cell.getNameSize() * 0.5 : 12;
        const massSize = Math.max(12, (massSizeRaw + 1) & ~1);
        if (massSize !== cell.sizeCache._size) cell.sizeCache.setSize(massSize);
        // EN(EU)/TR: "1.2k" / "1,2k" + quantized updates (less text churn)
        const region = S.playRegion || "ru";
        const light = region === "tr" || region === "eu" || region === "en";
        const massFont = light ? "Arial" : "Ubuntu";
        const wantsMassStroke = !light;
        if (cell._txtMassStroke !== wantsMassStroke) {
          cell._txtMassStroke = wantsMassStroke;
          cell.sizeCache.setStroke(wantsMassStroke);
        }
        if (cell._txtMassFont !== massFont) {
          cell._txtMassFont = massFont;
          if (typeof cell.sizeCache.setFont === "function") cell.sizeCache.setFont(massFont);
        }
        const massLabel = (typeof S.formatMassLabel === "function")
          ? S.formatMassLabel(mass, region, host)
          : String(mass | 0);
        if (massLabel !== cell._txtMassVal) {
          cell._txtMassVal = massLabel;
          cell.sizeCache.setValue(massLabel);
        }
        const img = cell.sizeCache.render();
        const massW = img.width * invZoom;
        const massH = img.height * invZoom;
        // Mass changes often — keep one GL slot per cell, reupload via _ver (no key spam)
        const entry = this.texLabels.get(
          "mc:" + cell.id,
          img,
          cell.sizeCache._ver || 1
        );
        const massCy = cell.y + massH * 0.9 + massH * 0.5;
        this._queueLabel(entry, cell.x, massCy, massW * 0.5, massH * 0.5, dLabel - layerStep * 0.05);
      }
    }

    this._flushTex(cam);
    this._flushLabels(cam);
    gl.bindVertexArray(null);
    this.drawn = drawn;
    return true;
  };

  function createWebGL2Renderer() {
    const canvas = document.createElement("canvas");
    canvas.id = "webgl-canvas";
    canvas.width = 1;
    canvas.height = 1;
    try {
      return new WebGL2Renderer(canvas);
    } catch (e) {
      console.warn("[webgl2render]", e);
      return null;
    }
  }

  global.createWebGL2Renderer = createWebGL2Renderer;
})(typeof window !== "undefined" ? window : globalThis);
