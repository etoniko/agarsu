(function (global) {
  "use strict";

  /* ── shaders ─────────────────────────────────────────────── */

  var CIRCLE_VERT = `#version 300 es
in vec2 a_corner;
in vec2 i_center;
in float i_radius;
in vec4 i_color;
in float i_depth;
uniform vec2 u_center;
uniform float u_zoom;
uniform vec2 u_halfRes;
uniform float u_maxSize;
out vec4 v_color;
out vec2 v_uv;
void main() {
  vec2 world = i_center + a_corner * i_radius;
  vec2 screen = (world - u_center) * u_zoom;
  float z = 1.0 - (i_depth / u_maxSize) * 1.98;
  gl_Position = vec4(screen.x / u_halfRes.x, -screen.y / u_halfRes.y, z, 1.0);
  v_color = i_color;
  v_uv = a_corner;
}`;

  var CIRCLE_FRAG = `#version 300 es
precision mediump float;
in vec4 v_color;
in vec2 v_uv;
out vec4 outColor;
void main() {
  float d = dot(v_uv, v_uv);
  if (d > 1.0) discard;
  float edge = smoothstep(1.0, 0.92, d);
  outColor = vec4(v_color.rgb, v_color.a * edge);
}`;

  var TEX_VERT = `#version 300 es
in vec2 a_corner;
in vec2 i_center;
in float i_radius;
in float i_angle;
in vec4 i_uvRect;
in float i_alpha;
in float i_depth;
uniform vec2 u_center;
uniform float u_zoom;
uniform vec2 u_halfRes;
uniform float u_maxSize;
out vec2 v_uv;
out vec2 v_local;
out float v_alpha;
void main() {
  float c = cos(i_angle);
  float s = sin(i_angle);
  vec2 local = a_corner * i_radius;
  vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec2 world = i_center + rotated;
  vec2 screen = (world - u_center) * u_zoom;
  float z = 1.0 - (i_depth / u_maxSize) * 1.98;
  gl_Position = vec4(screen.x / u_halfRes.x, -screen.y / u_halfRes.y, z, 1.0);
  v_local = a_corner;
  v_uv = mix(i_uvRect.xy, i_uvRect.zw, a_corner * 0.5 + 0.5);
  v_alpha = i_alpha;
}`;

  var TEX_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
in vec2 v_uv;
in vec2 v_local;
in float v_alpha;
out vec4 outColor;
void main() {
  float d = dot(v_local, v_local);
  if (d > 1.0) discard;
  float mask = smoothstep(1.0, 0.92, d);
  vec4 tex = texture(u_tex, v_uv);
  outColor = vec4(tex.rgb, tex.a * mask * v_alpha);
}`;

  var TEXT_VERT = `#version 300 es
in vec2 a_corner;
in vec2 i_pos;
in vec2 i_size;
in vec4 i_uvRect;
in float i_depth;
uniform vec2 u_center;
uniform float u_zoom;
uniform vec2 u_halfRes;
uniform float u_maxSize;
out vec2 v_uv;
void main() {
  vec2 world = i_pos + a_corner * i_size;
  vec2 screen = (world - u_center) * u_zoom;
  float z = 1.0 - (i_depth / u_maxSize) * 1.98;
  gl_Position = vec4(screen.x / u_halfRes.x, -screen.y / u_halfRes.y, z, 1.0);
  v_uv = mix(i_uvRect.xy, i_uvRect.zw, a_corner);
}`;

  var TEXT_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D u_tex;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec4 tex = texture(u_tex, v_uv);
  if (tex.a < 0.02) discard;
  outColor = tex;
}`;

  /* ── helpers ─────────────────────────────────────────────── */

  function compileShader(gl, type, source) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("[WebGL] shader:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function createProgram(gl, vsSrc, fsSrc) {
    var vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    var fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[WebGL] program:", gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  }

  function parseColor(hex) {
    if (!hex || typeof hex !== "string") return [0.67, 0.67, 0.67, 1];
    if (hex.charAt(0) !== "#") {
      if (hex.indexOf("rgba") === 0) {
        var m = hex.match(/[\d.]+/g);
        if (m && m.length >= 3) {
          return [(+m[0]) / 255, (+m[1]) / 255, (+m[2]) / 255, m[3] != null ? +m[3] : 1];
        }
      }
      return [0.67, 0.67, 0.67, 1];
    }
    var h = hex.length === 4
      ? "#" + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2) + hex.charAt(3) + hex.charAt(3)
      : hex;
    var n = parseInt(h.slice(1), 16);
    if (!isFinite(n)) return [0.67, 0.67, 0.67, 1];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  }

  function darkenHex(hex, factor) {
    var c = parseColor(hex);
    return [c[0] * factor, c[1] * factor, c[2] * factor, 1];
  }

  /* ── dynamic atlas ───────────────────────────────────────── */

  function createAtlas(gl, size, slotSize) {
    size = size || 2048;
    slotSize = slotSize || 128;
    var cols = Math.floor(size / slotSize);
    var rows = Math.floor(size / slotSize);
    var capacity = cols * rows;
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    var free = [];
    for (var i = 0; i < capacity; i++) free.push(i);
    var map = Object.create(null);
    var scratch = document.createElement("canvas");
    scratch.width = slotSize;
    scratch.height = slotSize;
    var sctx = scratch.getContext("2d");

    return {
      texture: tex,
      size: size,
      slotSize: slotSize,
      cols: cols,
      get: function (key) {
        return map[key] || null;
      },
      uploadImage: function (key, img, sx, sy, sw, sh) {
        var entry = map[key];
        if (entry) return entry;
        if (!free.length) {
          // LRU-ish: drop oldest half of keys
          var keys = Object.keys(map);
          var drop = Math.max(1, (keys.length / 4) | 0);
          for (var d = 0; d < drop; d++) {
            var k = keys[d];
            free.push(map[k].slot);
            delete map[k];
          }
        }
        if (!free.length) return null;
        var slot = free.pop();
        var col = slot % cols;
        var row = (slot / cols) | 0;
        var px = col * slotSize;
        var py = row * slotSize;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        var ok = false;
        try {
          if (sw && sh) {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, px, py, sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, img, sx || 0, sy || 0);
          } else {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, px, py, slotSize, slotSize, gl.RGBA, gl.UNSIGNED_BYTE, img);
          }
          ok = true;
        } catch (e) {}
        if (!ok) {
          sctx.clearRect(0, 0, slotSize, slotSize);
          try {
            if (sw && sh) {
              sctx.drawImage(img, sx || 0, sy || 0, sw, sh, 0, 0, slotSize, slotSize);
            } else {
              sctx.drawImage(img, 0, 0, slotSize, slotSize);
            }
            gl.texSubImage2D(gl.TEXTURE_2D, 0, px, py, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
            ok = true;
          } catch (e2) {
            free.push(slot);
            return null;
          }
        }
        var pad = 0.5 / size;
        entry = {
          slot: slot,
          u0: px / size + pad,
          v0: py / size + pad,
          u1: (px + slotSize) / size - pad,
          v1: (py + slotSize) / size - pad
        };
        map[key] = entry;
        return entry;
      },
      updateFrame: function (key, img, sx, sy, sw, sh) {
        var entry = map[key];
        if (!entry) return null;
        var slot = entry.slot;
        var col = slot % cols;
        var row = (slot / cols) | 0;
        var px = col * slotSize;
        var py = row * slotSize;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        try {
          if (sw && sh) {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, px, py, sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, img, sx || 0, sy || 0);
          } else {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, px, py, slotSize, slotSize, gl.RGBA, gl.UNSIGNED_BYTE, img);
          }
        } catch (e) {
          try {
            sctx.clearRect(0, 0, slotSize, slotSize);
            if (sw && sh) {
              sctx.drawImage(img, sx || 0, sy || 0, sw, sh, 0, 0, slotSize, slotSize);
            } else {
              sctx.drawImage(img, 0, 0, slotSize, slotSize);
            }
            gl.texSubImage2D(gl.TEXTURE_2D, 0, px, py, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
          } catch (e2) {
            return entry;
          }
        }
        return entry;
      },
      release: function (key) {
        var e = map[key];
        if (!e) return;
        free.push(e.slot);
        delete map[key];
      }
    };
  }

  /* ── glyph font atlas ────────────────────────────────────── */

  function createFontAtlas(gl, fontFamily) {
    var atlasSize = 1024;
    var glyphH = 64;
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlasSize, atlasSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    var glyphs = Object.create(null);
    var cursorX = 1;
    var cursorY = 1;
    var rowH = glyphH + 8;
    var fontBase = fontFamily || "Ubuntu";

    function ensureRow(w) {
      if (cursorX + w + 2 > atlasSize) {
        cursorX = 1;
        cursorY += rowH;
      }
      if (cursorY + rowH > atlasSize) return false;
      return true;
    }

    function bake(ch, withStroke) {
      var cacheKey = ch + (withStroke ? "#s" : "#n");
      if (glyphs[cacheKey]) return glyphs[cacheKey];
      var font = "700 " + glyphH + "px " + fontBase + ", Ubuntu, sans-serif";
      var probe = document.createElement("canvas").getContext("2d");
      probe.font = font;
      var metrics = probe.measureText(ch);
      var w = Math.ceil(Math.max(metrics.width, 4)) + 8;
      var h = glyphH + 8;
      if (!ensureRow(w)) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlasSize, atlasSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        for (var k in glyphs) delete glyphs[k];
        cursorX = 1;
        cursorY = 1;
        if (!ensureRow(w)) return null;
      }
      var upload = document.createElement("canvas");
      upload.width = w;
      upload.height = h;
      var uctx = upload.getContext("2d");
      uctx.font = font;
      uctx.textBaseline = "top";
      uctx.textAlign = "left";
      uctx.lineJoin = "round";
      uctx.miterLimit = 2;
      uctx.lineWidth = glyphH * 0.1;
      if (withStroke) {
        uctx.strokeStyle = "#000000";
        uctx.strokeText(ch, 4, 4);
      }
      uctx.fillStyle = "#FFFFFF";
      uctx.fillText(ch, 4, 4);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, cursorX, cursorY, gl.RGBA, gl.UNSIGNED_BYTE, upload);

      var g = {
        u0: cursorX / atlasSize,
        v0: cursorY / atlasSize,
        u1: (cursorX + w) / atlasSize,
        v1: (cursorY + h) / atlasSize,
        width: w / glyphH,
        height: h / glyphH,
        advance: metrics.width / glyphH
      };
      glyphs[cacheKey] = g;
      cursorX += w + 1;
      return g;
    }

    var common = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя!@#$%^&*()_+-=[]{}|;:',.<>?/`~№«»—–[]";
    for (var i = 0; i < common.length; i++) {
      bake(common.charAt(i), true);
      bake(common.charAt(i), false);
    }

    return {
      texture: tex,
      glyphH: glyphH,
      get: function (ch, withStroke) {
        return bake(ch, withStroke !== false);
      },
      measure: function (str, withStroke) {
        var w = 0;
        for (var i = 0; i < str.length; i++) {
          var g = bake(str.charAt(i), withStroke !== false);
          if (g) w += g.advance;
        }
        return w;
      }
    };
  }

  /* ── spatial uniform grid ────────────────────────────────── */

  function createSpatialGrid(cellSize) {
    cellSize = cellSize || 512;
    var buckets = new Map();
    var queryId = 0;

    function key(cx, cy) {
      return cx + "," + cy;
    }

    return {
      cellSize: cellSize,
      clear: function () {
        buckets.clear();
      },
      rebuild: function (list) {
        buckets.clear();
        var cs = cellSize;
        for (var i = 0; i < list.length; i++) {
          var n = list[i];
          if (!n || n.destroyed) continue;
          var r = n.nSize || n.size || 0;
          var x = n.nx != null ? n.nx : n.x;
          var y = n.ny != null ? n.ny : n.y;
          var minCX = Math.floor((x - r) / cs);
          var maxCX = Math.floor((x + r) / cs);
          var minCY = Math.floor((y - r) / cs);
          var maxCY = Math.floor((y + r) / cs);
          for (var cx = minCX; cx <= maxCX; cx++) {
            for (var cy = minCY; cy <= maxCY; cy++) {
              var k = key(cx, cy);
              var arr = buckets.get(k);
              if (!arr) {
                arr = [];
                buckets.set(k, arr);
              }
              arr.push(n);
            }
          }
        }
      },
      query: function (minX, minY, maxX, maxY, out) {
        out.length = 0;
        var cs = cellSize;
        var minCX = Math.floor(minX / cs);
        var maxCX = Math.floor(maxX / cs);
        var minCY = Math.floor(minY / cs);
        var maxCY = Math.floor(maxY / cs);
        // Unique stamp every query — reuse of rebuild version emptied the list next frame
        var stamp = ++queryId;
        for (var cx = minCX; cx <= maxCX; cx++) {
          for (var cy = minCY; cy <= maxCY; cy++) {
            var arr = buckets.get(key(cx, cy));
            if (!arr) continue;
            for (var i = 0; i < arr.length; i++) {
              var n = arr[i];
              if (n._gridStamp === stamp) continue;
              n._gridStamp = stamp;
              if (n.destroyed) continue;
              var r = (n.nSize || n.size || 0) + 40;
              var x = n.nx != null ? n.nx : n.x;
              var y = n.ny != null ? n.ny : n.y;
              if (x + r < minX || y + r < minY || x - r > maxX || y - r > maxY) continue;
              out.push(n);
            }
          }
        }
        return out;
      }
    };
  }

  /* ── main renderer ───────────────────────────────────────── */

  function createWebGLRenderer(canvas) {
    var gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance"
    });
    if (!gl) return null;

    var circleProg = createProgram(gl, CIRCLE_VERT, CIRCLE_FRAG);
    var skinProg = createProgram(gl, TEX_VERT, TEX_FRAG);
    var textProg = createProgram(gl, TEXT_VERT, TEXT_FRAG);
    if (!circleProg || !skinProg || !textProg) return null;

    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    var textQuad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textQuad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0, 1, 0, 0, 1,
      0, 1, 1, 0, 1, 1
    ]), gl.STATIC_DRAW);

    // Circle: x,y,r, r,g,b,a, depth (8 floats)
    var circleCap = 4096;
    var circleData = new Float32Array(circleCap * 8);
    var circleCount = 0;
    var circleBuf = gl.createBuffer();

    // Rim (border ring on top of skins): same layout as circles
    var rimCap = 1024;
    var rimData = new Float32Array(rimCap * 8);
    var rimCount = 0;
    var rimBuf = gl.createBuffer();

    // Skin: x,y,r,angle, u0,v0,u1,v1, alpha, depth (10 floats)
    var skinCap = 512;
    var skinData = new Float32Array(skinCap * 10);
    var skinCount = 0;
    var skinBuf = gl.createBuffer();

    // Text glyph: x,y,w,h, u0,v0,u1,v1, depth (13 floats)
    var textCap = 2048;
    var textData = new Float32Array(textCap * 13);
    var textCount = 0;
    var textBuf = gl.createBuffer();

    var skinAtlas = createAtlas(gl, 2048, 128);
    var fontAtlas = createFontAtlas(gl, "Ubuntu");
    var spatial = createSpatialGrid(512);
    var skinUploadBudget = 12;

    var locs = {
      circle: {
        corner: gl.getAttribLocation(circleProg, "a_corner"),
        center: gl.getAttribLocation(circleProg, "i_center"),
        radius: gl.getAttribLocation(circleProg, "i_radius"),
        color: gl.getAttribLocation(circleProg, "i_color"),
        depth: gl.getAttribLocation(circleProg, "i_depth"),
        uCenter: gl.getUniformLocation(circleProg, "u_center"),
        uZoom: gl.getUniformLocation(circleProg, "u_zoom"),
        uHalfRes: gl.getUniformLocation(circleProg, "u_halfRes"),
        uMaxSize: gl.getUniformLocation(circleProg, "u_maxSize")
      },
      skin: {
        corner: gl.getAttribLocation(skinProg, "a_corner"),
        center: gl.getAttribLocation(skinProg, "i_center"),
        radius: gl.getAttribLocation(skinProg, "i_radius"),
        angle: gl.getAttribLocation(skinProg, "i_angle"),
        uvRect: gl.getAttribLocation(skinProg, "i_uvRect"),
        alpha: gl.getAttribLocation(skinProg, "i_alpha"),
        depth: gl.getAttribLocation(skinProg, "i_depth"),
        uCenter: gl.getUniformLocation(skinProg, "u_center"),
        uZoom: gl.getUniformLocation(skinProg, "u_zoom"),
        uHalfRes: gl.getUniformLocation(skinProg, "u_halfRes"),
        uMaxSize: gl.getUniformLocation(skinProg, "u_maxSize"),
        uTex: gl.getUniformLocation(skinProg, "u_tex")
      },
      text: {
        corner: gl.getAttribLocation(textProg, "a_corner"),
        pos: gl.getAttribLocation(textProg, "i_pos"),
        size: gl.getAttribLocation(textProg, "i_size"),
        uvRect: gl.getAttribLocation(textProg, "i_uvRect"),
        depth: gl.getAttribLocation(textProg, "i_depth"),
        uCenter: gl.getUniformLocation(textProg, "u_center"),
        uZoom: gl.getUniformLocation(textProg, "u_zoom"),
        uHalfRes: gl.getUniformLocation(textProg, "u_halfRes"),
        uMaxSize: gl.getUniformLocation(textProg, "u_maxSize"),
        uTex: gl.getUniformLocation(textProg, "u_tex")
      }
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.CULL_FACE);

    var viewMaxSize = 50000;

    function pushCircle(x, y, radius, r, g, b, a, depth) {
      if (radius <= 0) return;
      if (circleCount >= circleCap) {
        circleCap *= 2;
        var next = new Float32Array(circleCap * 8);
        next.set(circleData);
        circleData = next;
      }
      var o = circleCount * 8;
      circleData[o] = x;
      circleData[o + 1] = y;
      circleData[o + 2] = radius;
      circleData[o + 3] = r;
      circleData[o + 4] = g;
      circleData[o + 5] = b;
      circleData[o + 6] = a == null ? 1 : a;
      circleData[o + 7] = depth || 0;
      circleCount++;
    }

    function pushRim(x, y, radius, r, g, b, a, depth) {
      if (radius <= 0) return;
      if (rimCount >= rimCap) {
        rimCap *= 2;
        var next = new Float32Array(rimCap * 8);
        next.set(rimData);
        rimData = next;
      }
      var o = rimCount * 8;
      rimData[o] = x;
      rimData[o + 1] = y;
      rimData[o + 2] = radius;
      rimData[o + 3] = r;
      rimData[o + 4] = g;
      rimData[o + 5] = b;
      rimData[o + 6] = a == null ? 1 : a;
      rimData[o + 7] = depth || 0;
      rimCount++;
    }

    function pushSkin(x, y, radius, angle, u0, v0, u1, v1, alpha, depth) {
      if (radius <= 0) return;
      if (skinCount >= skinCap) {
        skinCap *= 2;
        var next = new Float32Array(skinCap * 10);
        next.set(skinData);
        skinData = next;
      }
      var o = skinCount * 10;
      skinData[o] = x;
      skinData[o + 1] = y;
      skinData[o + 2] = radius;
      skinData[o + 3] = angle || 0;
      skinData[o + 4] = u0;
      skinData[o + 5] = v0;
      skinData[o + 6] = u1;
      skinData[o + 7] = v1;
      skinData[o + 8] = alpha == null ? 1 : alpha;
      skinData[o + 9] = depth || 0;
      skinCount++;
    }

    function pushGlyph(x, y, w, h, u0, v0, u1, v1, depth) {
      if (textCount >= textCap) {
        textCap *= 2;
        var next = new Float32Array(textCap * 13);
        next.set(textData);
        textData = next;
      }
      var o = textCount * 13;
      textData[o] = x;
      textData[o + 1] = y;
      textData[o + 2] = w;
      textData[o + 3] = h;
      textData[o + 4] = u0;
      textData[o + 5] = v0;
      textData[o + 6] = u1;
      textData[o + 7] = v1;
      textData[o + 8] = depth || 0;
      textCount++;
    }

    function pushText(str, cx, cy, fontSize, maxWidth, withStroke, depth) {
      if (!str) return;
      var scale = fontSize;
      var total = fontAtlas.measure(str, withStroke) * scale;
      if (maxWidth > 0 && total > maxWidth) {
        scale *= maxWidth / total;
        total = maxWidth;
      }
      var x = cx - total * 0.5;
      var lineH = scale * 1.15;
      var y = cy - lineH * 0.5;
      for (var i = 0; i < str.length; i++) {
        var g = fontAtlas.get(str.charAt(i), withStroke);
        if (!g) continue;
        var gw = g.width * scale;
        var gh = g.height * scale;
        pushGlyph(x, y, gw, gh, g.u0, g.v0, g.u1, g.v1, depth);
        x += g.advance * scale;
      }
    }

    function setViewUniforms(progLocs, view) {
      gl.uniform2f(progLocs.uCenter, view.nodeX, view.nodeY);
      gl.uniform1f(progLocs.uZoom, view.viewZoom);
      gl.uniform2f(progLocs.uHalfRes, view.width * 0.5, view.height * 0.5);
      gl.uniform1f(progLocs.uMaxSize, view.maxSize || viewMaxSize);
    }

    function flushCircles(view) {
      if (!circleCount) return;
      gl.depthMask(true);
      gl.depthFunc(gl.LESS);
      gl.useProgram(circleProg);
      setViewUniforms(locs.circle, view);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(locs.circle.corner);
      gl.vertexAttribPointer(locs.circle.corner, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(locs.circle.corner, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
      gl.bufferData(gl.ARRAY_BUFFER, circleData.subarray(0, circleCount * 8), gl.DYNAMIC_DRAW);
      var stride = 32;
      gl.enableVertexAttribArray(locs.circle.center);
      gl.vertexAttribPointer(locs.circle.center, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribDivisor(locs.circle.center, 1);
      gl.enableVertexAttribArray(locs.circle.radius);
      gl.vertexAttribPointer(locs.circle.radius, 1, gl.FLOAT, false, stride, 8);
      gl.vertexAttribDivisor(locs.circle.radius, 1);
      gl.enableVertexAttribArray(locs.circle.color);
      gl.vertexAttribPointer(locs.circle.color, 4, gl.FLOAT, false, stride, 12);
      gl.vertexAttribDivisor(locs.circle.color, 1);
      gl.enableVertexAttribArray(locs.circle.depth);
      gl.vertexAttribPointer(locs.circle.depth, 1, gl.FLOAT, false, stride, 28);
      gl.vertexAttribDivisor(locs.circle.depth, 1);

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, circleCount);
      circleCount = 0;
    }

    function flushSkins(view) {
      if (!skinCount) return;
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      gl.useProgram(skinProg);
      setViewUniforms(locs.skin, view);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, skinAtlas.texture);
      gl.uniform1i(locs.skin.uTex, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(locs.skin.corner);
      gl.vertexAttribPointer(locs.skin.corner, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(locs.skin.corner, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, skinBuf);
      gl.bufferData(gl.ARRAY_BUFFER, skinData.subarray(0, skinCount * 10), gl.DYNAMIC_DRAW);
      var stride = 40;
      gl.enableVertexAttribArray(locs.skin.center);
      gl.vertexAttribPointer(locs.skin.center, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribDivisor(locs.skin.center, 1);
      gl.enableVertexAttribArray(locs.skin.radius);
      gl.vertexAttribPointer(locs.skin.radius, 1, gl.FLOAT, false, stride, 8);
      gl.vertexAttribDivisor(locs.skin.radius, 1);
      gl.enableVertexAttribArray(locs.skin.angle);
      gl.vertexAttribPointer(locs.skin.angle, 1, gl.FLOAT, false, stride, 12);
      gl.vertexAttribDivisor(locs.skin.angle, 1);
      gl.enableVertexAttribArray(locs.skin.uvRect);
      gl.vertexAttribPointer(locs.skin.uvRect, 4, gl.FLOAT, false, stride, 16);
      gl.vertexAttribDivisor(locs.skin.uvRect, 1);
      gl.enableVertexAttribArray(locs.skin.alpha);
      gl.vertexAttribPointer(locs.skin.alpha, 1, gl.FLOAT, false, stride, 32);
      gl.vertexAttribDivisor(locs.skin.alpha, 1);
      gl.enableVertexAttribArray(locs.skin.depth);
      gl.vertexAttribPointer(locs.skin.depth, 1, gl.FLOAT, false, stride, 36);
      gl.vertexAttribDivisor(locs.skin.depth, 1);

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, skinCount);
      skinCount = 0;
      gl.depthMask(true);
      gl.depthFunc(gl.LESS);
    }

    function flushRims(view) {
      if (!rimCount) return;
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      gl.useProgram(circleProg);
      setViewUniforms(locs.circle, view);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(locs.circle.corner);
      gl.vertexAttribPointer(locs.circle.corner, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(locs.circle.corner, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, rimBuf);
      gl.bufferData(gl.ARRAY_BUFFER, rimData.subarray(0, rimCount * 8), gl.DYNAMIC_DRAW);
      var stride = 32;
      gl.enableVertexAttribArray(locs.circle.center);
      gl.vertexAttribPointer(locs.circle.center, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribDivisor(locs.circle.center, 1);
      gl.enableVertexAttribArray(locs.circle.radius);
      gl.vertexAttribPointer(locs.circle.radius, 1, gl.FLOAT, false, stride, 8);
      gl.vertexAttribDivisor(locs.circle.radius, 1);
      gl.enableVertexAttribArray(locs.circle.color);
      gl.vertexAttribPointer(locs.circle.color, 4, gl.FLOAT, false, stride, 12);
      gl.vertexAttribDivisor(locs.circle.color, 1);
      gl.enableVertexAttribArray(locs.circle.depth);
      gl.vertexAttribPointer(locs.circle.depth, 1, gl.FLOAT, false, stride, 28);
      gl.vertexAttribDivisor(locs.circle.depth, 1);

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, rimCount);
      rimCount = 0;
      gl.depthMask(true);
      gl.depthFunc(gl.LESS);
    }

    function flushTexts(view) {
      if (!textCount) return;
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
      gl.useProgram(textProg);
      setViewUniforms(locs.text, view);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fontAtlas.texture);
      gl.uniform1i(locs.text.uTex, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, textQuad);
      gl.enableVertexAttribArray(locs.text.corner);
      gl.vertexAttribPointer(locs.text.corner, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(locs.text.corner, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, textBuf);
      gl.bufferData(gl.ARRAY_BUFFER, textData.subarray(0, textCount * 13), gl.DYNAMIC_DRAW);
      var stride = 52;
      gl.enableVertexAttribArray(locs.text.pos);
      gl.vertexAttribPointer(locs.text.pos, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribDivisor(locs.text.pos, 1);
      gl.enableVertexAttribArray(locs.text.size);
      gl.vertexAttribPointer(locs.text.size, 2, gl.FLOAT, false, stride, 8);
      gl.vertexAttribDivisor(locs.text.size, 1);
      gl.enableVertexAttribArray(locs.text.uvRect);
      gl.vertexAttribPointer(locs.text.uvRect, 4, gl.FLOAT, false, stride, 16);
      gl.vertexAttribDivisor(locs.text.uvRect, 1);
      gl.enableVertexAttribArray(locs.text.depth);
      gl.vertexAttribPointer(locs.text.depth, 1, gl.FLOAT, false, stride, 32);
      gl.vertexAttribDivisor(locs.text.depth, 1);

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, textCount);
      textCount = 0;
      gl.depthMask(true);
      gl.depthFunc(gl.LESS);
    }

    function ensureSkin(skinId, img, frameIndex) {
      if (!img || !img.complete || !img.width) return null;
      var fw = img.width;
      var fh = img.height;
      var frames = fw > fh ? Math.floor(fw / fh) : 1;
      var frame = frames > 1 ? ((frameIndex | 0) % frames + frames) % frames : 0;
      // One atlas slot per skin; animated skins update in-place (no key per frame)
      var key = frames > 1 ? String(skinId) + "#a" : String(skinId);
      var entry = skinAtlas.get(key);
      if (entry) {
        if (frames > 1 && entry._frame !== frame) {
          if (skinUploadBudget <= 0) return entry;
          skinUploadBudget--;
          skinAtlas.updateFrame(key, img, frame * fh, 0, fh, fh);
          entry._frame = frame;
        }
        return entry;
      }
      if (skinUploadBudget <= 0) return null;
      skinUploadBudget--;
      if (frames > 1) {
        entry = skinAtlas.uploadImage(key, img, frame * fh, 0, fh, fh);
        if (entry) entry._frame = frame;
        return entry;
      }
      return skinAtlas.uploadImage(key, img);
    }

    return {
      active: true,
      gl: gl,
      canvas: canvas,
      parseColor: parseColor,
      darkenHex: darkenHex,
      spatial: spatial,
      reset: function () {
        circleCount = 0;
        rimCount = 0;
        skinCount = 0;
        textCount = 0;
        skinUploadBudget = 12;
      },
      pushCircle: pushCircle,
      pushRim: pushRim,
      pushSkin: pushSkin,
      pushText: pushText,
      ensureSkin: ensureSkin,
      measureText: function (str) {
        return fontAtlas.measure(str);
      },
      resize: function (width, height, cssWidth, cssHeight) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = cssWidth + "px";
        canvas.style.height = cssHeight + "px";
        gl.viewport(0, 0, width, height);
      },
      clear: function () {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      },
      flushNode: function (view) {
        flushCircles(view);
        flushSkins(view);
        flushRims(view);
        flushTexts(view);
      },
      flush: function (view) {
        flushCircles(view);
        flushSkins(view);
        flushRims(view);
        flushTexts(view);
      },
      flushCircles: flushCircles,
      flushRims: flushRims,
      flushSkins: flushSkins,
      flushTexts: flushTexts
    };
  }

  global.createAgarWebGLRenderer = createWebGLRenderer;
  global.createAgarSpatialGrid = createSpatialGrid;
})(typeof window !== "undefined" ? window : globalThis);
