import {
  BG_GRADIENT_VS,
  BG_GRADIENT_FS,
  BG_CLASSIC_VS,
  BG_CLASSIC_FS,
  CIRCLE_VS,
  CIRCLE_FS,
  QUAD_VS,
  QUAD_FS,
  SCREEN_QUAD_VS,
  SCREEN_QUAD_FS
} from "./shaders.js";

const QUAD_CORNERS = new Float32Array([
  -1, -1, 1, -1, -1, 1, 1, 1
]);

function compileShader(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const msg = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(msg || "shader compile failed");
  }
  return sh;
}

function linkProgram(gl, vs, fs) {
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const msg = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(msg || "program link failed");
  }
  return prog;
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return [1, 1, 1];
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(h.substr(0, 2), 16) / 255;
  const g = parseInt(h.substr(2, 2), 16) / 255;
  const b = parseInt(h.substr(4, 2), 16) / 255;
  return [r, g, b];
}

function parseRgba(css) {
  if (!css) return [0, 0, 0, 0];
  if (css.startsWith("#")) return [...hexToRgb(css), 1];
  const m = css.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (m) {
    return [
      Number(m[1]) / 255,
      Number(m[2]) / 255,
      Number(m[3]) / 255,
      m[4] != null ? Number(m[4]) : 1
    ];
  }
  return [1, 1, 1, 1];
}

export class WebGL2Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance"
    });
    if (!this.gl) throw new Error("WebGL2 not available");
    const gl = this.gl;
    this.width = 0;
    this.height = 0;
    this.texCache = new Map();
    this.whiteTex = this._createTextureFromSource(gl, null, 1, 1, [255, 255, 255, 255]);
    this._initPrograms(gl);
    this._initBuffers(gl);
    this.circleCapacity = 4096;
    this._growCircleCapacity(this.circleCapacity);
  }

  _initPrograms(gl) {
    this.progGradient = linkProgram(
      gl,
      compileShader(gl, gl.VERTEX_SHADER, BG_GRADIENT_VS),
      compileShader(gl, gl.FRAGMENT_SHADER, BG_GRADIENT_FS)
    );
    this.progClassic = linkProgram(
      gl,
      compileShader(gl, gl.VERTEX_SHADER, BG_CLASSIC_VS),
      compileShader(gl, gl.FRAGMENT_SHADER, BG_CLASSIC_FS)
    );
    this.progCircle = linkProgram(
      gl,
      compileShader(gl, gl.VERTEX_SHADER, CIRCLE_VS),
      compileShader(gl, gl.FRAGMENT_SHADER, CIRCLE_FS)
    );
    this.progQuad = linkProgram(
      gl,
      compileShader(gl, gl.VERTEX_SHADER, QUAD_VS),
      compileShader(gl, gl.FRAGMENT_SHADER, QUAD_FS)
    );
    this.progScreen = linkProgram(
      gl,
      compileShader(gl, gl.VERTEX_SHADER, SCREEN_QUAD_VS),
      compileShader(gl, gl.FRAGMENT_SHADER, SCREEN_QUAD_FS)
    );
  }

  _initBuffers(gl) {
    this.bgVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

    this.quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);

    this.screenVbo = gl.createBuffer();
    const screenVerts = new Float32Array([
      0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.screenVbo);
    gl.bufferData(gl.ARRAY_BUFFER, screenVerts, gl.STATIC_DRAW);
  }

  _growCircleCapacity(cap) {
    const gl = this.gl;
    this.circleCapacity = cap;
    this.circleCenter = new Float32Array(cap * 2);
    this.circleRadius = new Float32Array(cap);
    this.circleFill = new Float32Array(cap * 4);
    this.circleStroke = new Float32Array(cap * 4);
    this.circleBorder = new Float32Array(cap);
    this.circleUvScale = new Float32Array(cap * 2);
    this.circleRot = new Float32Array(cap);
    this.circleTexMode = new Float32Array(cap);
    this.circleTexKey = new Array(cap);
    this.circleUvOffset = new Float32Array(cap);

    if (this.circleVboCorner) gl.deleteBuffer(this.circleVboCorner);
    if (this.circleVboCenter) gl.deleteBuffer(this.circleVboCenter);
    if (this.circleVboRadius) gl.deleteBuffer(this.circleVboRadius);
    if (this.circleVboFill) gl.deleteBuffer(this.circleVboFill);
    if (this.circleVboStroke) gl.deleteBuffer(this.circleVboStroke);
    if (this.circleVboBorder) gl.deleteBuffer(this.circleVboBorder);
    if (this.circleVboUvScale) gl.deleteBuffer(this.circleVboUvScale);
    if (this.circleVboRot) gl.deleteBuffer(this.circleVboRot);
    if (this.circleVboTexMode) gl.deleteBuffer(this.circleVboTexMode);
    if (this.circleVboUvOffset) gl.deleteBuffer(this.circleVboUvOffset);

    this.circleVboCorner = gl.createBuffer();
    this.circleVboCenter = gl.createBuffer();
    this.circleVboRadius = gl.createBuffer();
    this.circleVboFill = gl.createBuffer();
    this.circleVboStroke = gl.createBuffer();
    this.circleVboBorder = gl.createBuffer();
    this.circleVboUvScale = gl.createBuffer();
    this.circleVboRot = gl.createBuffer();
    this.circleVboTexMode = gl.createBuffer();
    this.circleVboUvOffset = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVboCorner);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);
  }

  resize(width, height) {
    const gl = this.gl;
    this.width = width;
    this.height = height;
    gl.viewport(0, 0, width, height);
  }

  _createTextureFromSource(gl, source, w, h, rgba) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    }
    return tex;
  }

  textureFromImage(img, key) {
    if (!img || !img.width) return this.whiteTex;
    const cacheKey = key || img.src || String(img.width);
    let entry = this.texCache.get(cacheKey);
    if (entry && entry.width === img.width && entry.height === img.height) {
      return entry.tex;
    }
    const gl = this.gl;
    const tex = this._createTextureFromSource(gl, img, 0, 0, null);
    this.texCache.set(cacheKey, { tex, width: img.width, height: img.height });
    return tex;
  }

  textureFromCanvas(canvas, key) {
    if (!canvas || !canvas.width) return this.whiteTex;
    const cacheKey = key || `canvas:${canvas.width}x${canvas.height}:${canvas._textKey || ""}`;
    let entry = this.texCache.get(cacheKey);
    if (entry && entry.width === canvas.width && entry.height === canvas.height) {
      return entry.tex;
    }
    const gl = this.gl;
    const tex = this._createTextureFromSource(gl, canvas, 0, 0, null);
    this.texCache.set(cacheKey, { tex, width: canvas.width, height: canvas.height });
    return tex;
  }

  clear() {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  _bindBgFullscreen(prog) {
    const gl = this.gl;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgVbo);
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(prog, "u_screen"), this.width, this.height);
  }

  drawGradientBackground(centerColor, edgeColor, gx, gy, gr) {
    const gl = this.gl;
    this._bindBgFullscreen(this.progGradient);
    const c = hexToRgb(centerColor);
    const e = hexToRgb(edgeColor);
    gl.uniform3f(gl.getUniformLocation(this.progGradient, "u_centerColor"), c[0], c[1], c[2]);
    gl.uniform3f(gl.getUniformLocation(this.progGradient, "u_edgeColor"), e[0], e[1], e[2]);
    gl.uniform2f(gl.getUniformLocation(this.progGradient, "u_center"), gx, gy);
    gl.uniform1f(gl.getUniformLocation(this.progGradient, "u_radius"), gr);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  drawClassicBackground(bgColor, lineColor, camX, camY, zoom) {
    const gl = this.gl;
    this._bindBgFullscreen(this.progClassic);
    const bg = hexToRgb(bgColor.startsWith("#") ? bgColor : "#101010");
    const ln = hexToRgb(lineColor === "white" ? "#ffffff" : "#111111");
    gl.uniform3f(gl.getUniformLocation(this.progClassic, "u_bgColor"), bg[0], bg[1], bg[2]);
    gl.uniform3f(gl.getUniformLocation(this.progClassic, "u_lineColor"), ln[0], ln[1], ln[2]);
    gl.uniform2f(gl.getUniformLocation(this.progClassic, "u_cam"), camX, camY);
    gl.uniform1f(gl.getUniformLocation(this.progClassic, "u_zoom"), zoom);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  beginWorld(camX, camY, zoom) {
    this.camX = camX;
    this.camY = camY;
    this.zoom = zoom;
    this.circleCount = 0;
    this.quadBatch = [];
  }

  _ensureCircleRoom() {
    if (this.circleCount < this.circleCapacity) return;
    this._growCircleCapacity(this.circleCapacity * 2);
  }

  pushCircle(cx, cy, radius, fillCss, strokeCss, borderPx, texMode, uvScaleX, uvScaleY, rot, texId, uvOffset = 0) {
    if (radius <= 0) return;
    this._ensureCircleRoom();
    const i = this.circleCount++;
    const fi = i * 2;
    const fi4 = i * 4;
    this.circleCenter[fi] = cx;
    this.circleCenter[fi + 1] = cy;
    this.circleRadius[i] = radius;
    const fill = parseRgba(fillCss);
    const stroke = parseRgba(strokeCss);
    this.circleFill[fi4] = fill[0];
    this.circleFill[fi4 + 1] = fill[1];
    this.circleFill[fi4 + 2] = fill[2];
    this.circleFill[fi4 + 3] = fill[3];
    this.circleStroke[fi4] = stroke[0];
    this.circleStroke[fi4 + 1] = stroke[1];
    this.circleStroke[fi4 + 2] = stroke[2];
    this.circleStroke[fi4 + 3] = stroke[3];
    this.circleBorder[i] = borderPx > 0 ? borderPx / radius : 0;
    this.circleUvScale[fi] = uvScaleX;
    this.circleUvScale[fi + 1] = uvScaleY;
    this.circleRot[i] = rot || 0;
    this.circleTexMode[i] = texMode ? 1 : 0;
    this.circleTexKey[i] = texId || "";
    this.circleUvOffset[i] = uvOffset || 0;
  }

  pushTexturedQuad(cx, cy, w, h, rot, tex, tintAlpha = 1) {
    this.quadBatch.push({ cx, cy, w, h, rot, tex, tintAlpha });
  }

  pushScreenQuad(x, y, w, h, tex, tintAlpha = 1) {
    this.screenBatch = this.screenBatch || [];
    this.screenBatch.push({ x, y, w, h, tex, tintAlpha });
  }

  _drawCircleBatch(tex, texModeFilter) {
    const gl = this.gl;
    const count = this.circleCount;
    if (!count) return;

    gl.useProgram(this.progCircle);
    gl.uniform2f(gl.getUniformLocation(this.progCircle, "u_screen"), this.width, this.height);
    gl.uniform2f(gl.getUniformLocation(this.progCircle, "u_cam"), this.camX, this.camY);
    gl.uniform1f(gl.getUniformLocation(this.progCircle, "u_zoom"), this.zoom);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex || this.whiteTex);
    gl.uniform1i(gl.getUniformLocation(this.progCircle, "u_tex"), 0);

    const stride = 4;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVboCorner);
    const locCorner = gl.getAttribLocation(this.progCircle, "a_corner");
    gl.enableVertexAttribArray(locCorner);
    gl.vertexAttribPointer(locCorner, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(locCorner, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVboCenter);
    gl.bufferData(gl.ARRAY_BUFFER, this.circleCenter.subarray(0, count * 2), gl.DYNAMIC_DRAW);
    const locCenter = gl.getAttribLocation(this.progCircle, "a_center");
    gl.enableVertexAttribArray(locCenter);
    gl.vertexAttribPointer(locCenter, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(locCenter, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVboRadius);
    gl.bufferData(gl.ARRAY_BUFFER, this.circleRadius.subarray(0, count), gl.DYNAMIC_DRAW);
    const locRadius = gl.getAttribLocation(this.progCircle, "a_radius");
    gl.enableVertexAttribArray(locRadius);
    gl.vertexAttribPointer(locRadius, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(locRadius, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVboFill);
    gl.bufferData(gl.ARRAY_BUFFER, this.circleFill.subarray(0, count * 4), gl.DYNAMIC_DRAW);
    const locFill = gl.getAttribLocation(this.progCircle, "a_fill");
    gl.enableVertexAttribArray(locFill);
    gl.vertexAttribPointer(locFill, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(locFill, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVboStroke);
    gl.bufferData(gl.ARRAY_BUFFER, this.circleStroke.subarray(0, count * 4), gl.DYNAMIC_DRAW);
    const locStroke = gl.getAttribLocation(this.progCircle, "a_stroke");
    gl.enableVertexAttribArray(locStroke);
    gl.vertexAttribPointer(locStroke, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(locStroke, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVboBorder);
    gl.bufferData(gl.ARRAY_BUFFER, this.circleBorder.subarray(0, count), gl.DYNAMIC_DRAW);
    const locBorder = gl.getAttribLocation(this.progCircle, "a_border");
    gl.enableVertexAttribArray(locBorder);
    gl.vertexAttribPointer(locBorder, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(locBorder, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVboUvScale);
    gl.bufferData(gl.ARRAY_BUFFER, this.circleUvScale.subarray(0, count * 2), gl.DYNAMIC_DRAW);
    const locUv = gl.getAttribLocation(this.progCircle, "a_uvScale");
    gl.enableVertexAttribArray(locUv);
    gl.vertexAttribPointer(locUv, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(locUv, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVboRot);
    gl.bufferData(gl.ARRAY_BUFFER, this.circleRot.subarray(0, count), gl.DYNAMIC_DRAW);
    const locRot = gl.getAttribLocation(this.progCircle, "a_rot");
    gl.enableVertexAttribArray(locRot);
    gl.vertexAttribPointer(locRot, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(locRot, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVboTexMode);
    gl.bufferData(gl.ARRAY_BUFFER, this.circleTexMode.subarray(0, count), gl.DYNAMIC_DRAW);
    const locTexMode = gl.getAttribLocation(this.progCircle, "a_texMode");
    gl.enableVertexAttribArray(locTexMode);
    gl.vertexAttribPointer(locTexMode, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(locTexMode, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.circleVboUvOffset);
    gl.bufferData(gl.ARRAY_BUFFER, this.circleUvOffset.subarray(0, count), gl.DYNAMIC_DRAW);
    const locUvOffset = gl.getAttribLocation(this.progCircle, "a_uvOffset");
    gl.enableVertexAttribArray(locUvOffset);
    gl.vertexAttribPointer(locUvOffset, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(locUvOffset, 1);

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
  }

  flushWorld() {
    const gl = this.gl;
    const solid = [];
    const textured = new Map();
    for (let i = 0; i < this.circleCount; i++) {
      if (this.circleTexMode[i] > 0.5) {
        const id = this.circleTexKey[i];
        if (!textured.has(id)) textured.set(id, []);
        textured.get(id).push(i);
      } else {
        solid.push(i);
      }
    }

    if (solid.length) {
      const tmpCount = solid.length;
      for (let j = 0; j < tmpCount; j++) {
        const i = solid[j];
        const fi = j;
        const srcFi = i * 2;
        const srcFi4 = i * 4;
        this.circleCenter[fi * 2] = this.circleCenter[srcFi];
        this.circleCenter[fi * 2 + 1] = this.circleCenter[srcFi + 1];
        this.circleRadius[fi] = this.circleRadius[i];
        this.circleFill[fi * 4] = this.circleFill[srcFi4];
        this.circleFill[fi * 4 + 1] = this.circleFill[srcFi4 + 1];
        this.circleFill[fi * 4 + 2] = this.circleFill[srcFi4 + 2];
        this.circleFill[fi * 4 + 3] = this.circleFill[srcFi4 + 3];
        this.circleStroke[fi * 4] = this.circleStroke[srcFi4];
        this.circleStroke[fi * 4 + 1] = this.circleStroke[srcFi4 + 1];
        this.circleStroke[fi * 4 + 2] = this.circleStroke[srcFi4 + 2];
        this.circleStroke[fi * 4 + 3] = this.circleStroke[srcFi4 + 3];
        this.circleBorder[fi] = this.circleBorder[i];
        this.circleUvScale[fi * 2] = this.circleUvScale[srcFi];
        this.circleUvScale[fi * 2 + 1] = this.circleUvScale[srcFi + 1];
        this.circleRot[fi] = this.circleRot[i];
        this.circleTexMode[fi] = 0;
        this.circleUvOffset[fi] = this.circleUvOffset[i];
      }
      const prev = this.circleCount;
      this.circleCount = tmpCount;
      this._drawCircleBatch(this.whiteTex);
      this.circleCount = prev;
    }

    for (const [texId, indices] of textured) {
      const tex = this.texCache.get(texId)?.tex || this.whiteTex;
      const tmpCount = indices.length;
      for (let j = 0; j < tmpCount; j++) {
        const i = indices[j];
        const fi = j;
        const srcFi = i * 2;
        const srcFi4 = i * 4;
        this.circleCenter[fi * 2] = this.circleCenter[srcFi];
        this.circleCenter[fi * 2 + 1] = this.circleCenter[srcFi + 1];
        this.circleRadius[fi] = this.circleRadius[i];
        this.circleFill[fi * 4] = this.circleFill[srcFi4];
        this.circleFill[fi * 4 + 1] = this.circleFill[srcFi4 + 1];
        this.circleFill[fi * 4 + 2] = this.circleFill[srcFi4 + 2];
        this.circleFill[fi * 4 + 3] = this.circleFill[srcFi4 + 3];
        this.circleStroke[fi * 4] = this.circleStroke[srcFi4];
        this.circleStroke[fi * 4 + 1] = this.circleStroke[srcFi4 + 1];
        this.circleStroke[fi * 4 + 2] = this.circleStroke[srcFi4 + 2];
        this.circleStroke[fi * 4 + 3] = this.circleStroke[srcFi4 + 3];
        this.circleBorder[fi] = this.circleBorder[i];
        this.circleUvScale[fi * 2] = this.circleUvScale[srcFi];
        this.circleUvScale[fi * 2 + 1] = this.circleUvScale[srcFi + 1];
        this.circleRot[fi] = this.circleRot[i];
        this.circleTexMode[fi] = 1;
        this.circleUvOffset[fi] = this.circleUvOffset[i];
      }
      const prev = this.circleCount;
      this.circleCount = tmpCount;
      this._drawCircleBatch(tex);
      this.circleCount = prev;
    }

    if (this.quadBatch.length) {
      gl.useProgram(this.progQuad);
      gl.uniform2f(gl.getUniformLocation(this.progQuad, "u_screen"), this.width, this.height);
      gl.uniform2f(gl.getUniformLocation(this.progQuad, "u_cam"), this.camX, this.camY);
      gl.uniform1f(gl.getUniformLocation(this.progQuad, "u_zoom"), this.zoom);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      const locCorner = gl.getAttribLocation(this.progQuad, "a_corner");
      gl.enableVertexAttribArray(locCorner);
      gl.vertexAttribPointer(locCorner, 2, gl.FLOAT, false, 0, 0);

      for (const q of this.quadBatch) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, q.tex || this.whiteTex);
        gl.uniform1i(gl.getUniformLocation(this.progQuad, "u_tex"), 0);
        gl.uniform4f(gl.getUniformLocation(this.progQuad, "u_tint"), 1, 1, 1, q.tintAlpha);

        const cx = gl.getAttribLocation(this.progQuad, "a_center");
        gl.disableVertexAttribArray(cx);
        gl.vertexAttrib2f(cx, q.cx, q.cy);

        const sz = gl.getAttribLocation(this.progQuad, "a_size");
        gl.disableVertexAttribArray(sz);
        gl.vertexAttrib2f(sz, q.w / 2, q.h / 2);

        const rot = gl.getAttribLocation(this.progQuad, "a_rot");
        gl.disableVertexAttribArray(rot);
        gl.vertexAttrib1f(rot, q.rot || 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      this.quadBatch.length = 0;
    }
  }

  flushScreen() {
    const gl = this.gl;
    if (!this.screenBatch || !this.screenBatch.length) return;
    gl.useProgram(this.progScreen);
    gl.uniform2f(gl.getUniformLocation(this.progScreen, "u_screen"), this.width, this.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.screenVbo);
    const locPos = gl.getAttribLocation(this.progScreen, "a_pos");
    const locUv = gl.getAttribLocation(this.progScreen, "a_uv");
    gl.enableVertexAttribArray(locPos);
    gl.enableVertexAttribArray(locUv);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(locUv, 2, gl.FLOAT, false, 16, 8);

    for (const s of this.screenBatch) {
      gl.uniform4f(gl.getUniformLocation(this.progScreen, "u_rect"), s.x, s.y, s.w, s.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, s.tex || this.whiteTex);
      gl.uniform1i(gl.getUniformLocation(this.progScreen, "u_tex"), 0);
      gl.uniform4f(gl.getUniformLocation(this.progScreen, "u_tint"), 1, 1, 1, s.tintAlpha);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    this.screenBatch.length = 0;
  }

  drawMapBackground(img, left, top, mapW, mapH, mode, tileSize, visLeft, visRight, visTop, visBottom, right, bottom) {
    if (!img || !img.width) return;
    const texKey = `map:${img.src || img.width}`;
    const tex = this.textureFromImage(img, texKey);
    this.texCache.set(texKey, { tex, width: img.width, height: img.height });

    if (mode === "repeat") {
      const tile = Math.max(32, tileSize | 0);
      const startX = left + Math.floor((visLeft - left) / tile) * tile;
      const startY = top + Math.floor((visTop - top) / tile) * tile;
      for (let x = startX; x < visRight; x += tile) {
        for (let y = startY; y < visBottom; y += tile) {
          const tw = Math.min(tile, right - x);
          const th = Math.min(tile, bottom - y);
          this.pushTexturedQuad(x + tw / 2, y + th / 2, tw, th, 0, tex);
        }
      }
    } else {
      this.pushTexturedQuad(left + mapW / 2, top + mapH / 2, mapW, mapH, 0, tex);
    }
  }
}

export function tryCreateWebGL2Renderer(canvas) {
  try {
    return new WebGL2Renderer(canvas);
  } catch (e) {
    console.warn("[WebGL2] fallback to Canvas2D:", e);
    return null;
  }
}
