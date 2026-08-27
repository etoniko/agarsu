export const BG_GRADIENT_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
uniform vec2 u_screen;
void main() {
  v_uv = a_pos;
  gl_Position = vec4(a_pos.x * 2.0 - 1.0, -(a_pos.y * 2.0 - 1.0), 0.0, 1.0);
}`;

export const BG_GRADIENT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 u_screen;
uniform vec2 u_center;
uniform float u_radius;
uniform vec3 u_centerColor;
uniform vec3 u_edgeColor;
void main() {
  vec2 px = v_uv * u_screen;
  float d = length(px - u_center) / max(u_radius, 1.0);
  vec3 col = mix(u_centerColor, u_edgeColor, clamp(d, 0.0, 1.0));
  outColor = vec4(col, 1.0);
}`;

export const BG_CLASSIC_VS = BG_GRADIENT_VS;

export const BG_CLASSIC_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec3 u_bgColor;
uniform vec3 u_lineColor;
uniform vec2 u_screen;
uniform vec2 u_cam;
uniform float u_zoom;
void main() {
  vec2 px = v_uv * u_screen;
  vec2 world = (px - u_screen * 0.5) / u_zoom + u_cam;
  vec3 col = u_bgColor;
  float alpha = 0.1;
  float gx = mod(world.x + 25.0, 50.0);
  float gy = mod(world.y + 25.0, 50.0);
  if (gx < 1.0 || gy < 1.0) col = mix(col, u_lineColor, alpha);
  outColor = vec4(col, 1.0);
}`;

export const CIRCLE_VS = `#version 300 es
in vec2 a_corner;
in vec2 a_center;
in float a_radius;
in vec4 a_fill;
in vec4 a_stroke;
in float a_border;
in vec2 a_uvScale;
in float a_rot;
in float a_texMode;
in float a_uvOffset;
uniform vec2 u_screen;
uniform vec2 u_cam;
uniform float u_zoom;
out vec2 v_local;
out vec4 v_fill;
out vec4 v_stroke;
out float v_border;
out vec2 v_uv;
out float v_texMode;
out float v_uvOffset;
void main() {
  vec2 world = a_center + a_corner * a_radius;
  vec2 screen = (world - u_cam) * u_zoom + u_screen * 0.5;
  vec2 ndc = screen / u_screen;
  gl_Position = vec4(ndc.x * 2.0 - 1.0, -(ndc.y * 2.0 - 1.0), 0.0, 1.0);
  v_local = a_corner;
  v_fill = a_fill;
  v_stroke = a_stroke;
  v_border = a_border;
  float c = cos(a_rot);
  float s = sin(a_rot);
  vec2 uv = a_corner;
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
  v_uv = a_uvScale;
  v_texMode = a_texMode;
  v_uvOffset = a_uvOffset;
}`;

export const CIRCLE_FS = `#version 300 es
precision highp float;
in vec2 v_local;
in vec4 v_fill;
in vec4 v_stroke;
in float v_border;
in vec2 v_uv;
in float v_texMode;
in float v_uvOffset;
out vec4 outColor;
uniform sampler2D u_tex;
void main() {
  float dist = length(v_local);
  float border = max(v_border, 0.0);
  float outer = 1.0 + border;
  if (dist > outer) discard;
  float aa = 1.5 / max(outer * 64.0, 1.0);
  vec4 col;
  if (v_texMode > 0.5) {
    if (dist > 1.0) discard;
    vec2 sampleUv = vec2(
      v_uvOffset + (v_local.x * 0.5 + 0.5) * v_uv.x,
      0.5 + v_local.y * 0.5 * v_uv.y
    );
    col = texture(u_tex, sampleUv);
    if (col.a < 0.01) discard;
  } else {
    if (dist > 1.0 - border && dist <= 1.0 + border) {
      col = v_stroke;
    } else if (dist <= 1.0 - border) {
      col = v_fill;
    } else {
      col = v_stroke;
    }
  }
  float edge = outer;
  float alpha = col.a * (1.0 - smoothstep(edge - aa, edge + aa, dist));
  if (alpha < 0.004) discard;
  outColor = vec4(col.rgb, alpha);
}`;

export const QUAD_VS = `#version 300 es
in vec2 a_corner;
in vec2 a_center;
in vec2 a_size;
in float a_rot;
uniform vec2 u_screen;
uniform vec2 u_cam;
uniform float u_zoom;
out vec2 v_uv;
void main() {
  vec2 corner = a_corner * a_size;
  float c = cos(a_rot);
  float s = sin(a_rot);
  vec2 rot = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y);
  vec2 world = a_center + rot;
  vec2 screen = (world - u_cam) * u_zoom + u_screen * 0.5;
  vec2 ndc = screen / u_screen;
  gl_Position = vec4(ndc.x * 2.0 - 1.0, -(ndc.y * 2.0 - 1.0), 0.0, 1.0);
  v_uv = a_corner + 0.5;
}`;

export const QUAD_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec4 u_tint;
void main() {
  vec4 t = texture(u_tex, v_uv);
  outColor = vec4(t.rgb * u_tint.rgb, t.a * u_tint.a);
  if (outColor.a < 0.004) discard;
}`;

export const SCREEN_QUAD_VS = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
out vec2 v_uv;
uniform vec4 u_rect;
uniform vec2 u_screen;
void main() {
  vec2 screen = vec2(u_rect.x + a_pos.x * u_rect.z, u_rect.y + a_pos.y * u_rect.w);
  vec2 ndc = screen / u_screen;
  gl_Position = vec4(ndc.x * 2.0 - 1.0, -(ndc.y * 2.0 - 1.0), 0.0, 1.0);
  v_uv = a_uv;
}`;

export const SCREEN_QUAD_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec4 u_tint;
void main() {
  vec4 t = texture(u_tex, v_uv);
  outColor = vec4(t.rgb * u_tint.rgb, t.a * u_tint.a);
}`;
