/**
 * Координаты мыши как в smain.js:
 * - rawMouse в пикселях canvas (с учётом devicePixelRatio)
 * - на сервер: смещение от центра (dx, dy), не мировые X/Y
 * - для спектатора локально: мировые X/Y через viewZoom и nodeX/nodeY
 */

export function getRawMouse(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    rawX: (clientX - rect.left) * scaleX,
    rawY: (clientY - rect.top) * scaleY,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height
  };
}

/** Смещение от центра экрана — то, что уходит на сервер (opcode 0x10, 21 байт). */
export function getMouseDelta(core) {
  const canvas = core.app.view;
  const { x, y } = core.ui.mouse;
  const { rawX, rawY, canvasWidth, canvasHeight } = getRawMouse(canvas, x, y);
  return {
    dx: rawX - canvasWidth / 2,
    dy: rawY - canvasHeight / 2
  };
}

/** Мировые координаты под курсором (спектатор / прицел камеры, как smain X/Y). */
export function getMouseWorld(core) {
  const app = core.app;
  const canvas = app.view;
  const { x, y } = core.ui.mouse;
  const rect = canvas.getBoundingClientRect();
  const screenX = x - rect.left;
  const screenY = y - rect.top;
  const viewZoom = app.camera.s;
  const nodeX = app.camera.x;
  const nodeY = app.camera.y;

  const worldX = (screenX - rect.width / 2) / viewZoom + nodeX;
  const worldY = (screenY - rect.height / 2) / viewZoom + nodeY;

  return clampToBorder({ x: worldX, y: worldY }, core.net.border);
}

export function clampToBorder(world, border) {
  if (!border || border.right === undefined) return world;
  return {
    x: Math.max(border.left, Math.min(border.right, world.x)),
    y: Math.max(border.top, Math.min(border.bottom, world.y))
  };
}

export function centerRawMouse(core, ui = core?.ui) {
  const canvas = core?.app?.view;
  if (!canvas || !ui?.mouse) return;

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  ui.mouse.x = rect.left + cx / scaleX;
  ui.mouse.y = rect.top + cy / scaleY;
}
