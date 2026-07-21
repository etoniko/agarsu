function createCameraState() {
  return {
    x: 0,
    y: 0,
    size: 1,
    targetX: 0,
    targetY: 0,
    targetSize: 1
  };
}
function lerpCamera(cam, alpha = 0.2) {
  cam.x += (cam.targetX - cam.x) * alpha;
  cam.y += (cam.targetY - cam.y) * alpha;
  cam.size += (cam.targetSize - cam.size) * alpha;
  return cam;
}
function mouseCoordinateChange(S) {
  S.X = (S.rawMouseX - S.canvasWidth / 2) / S.viewZoom + S.nodeX;
  S.Y = (S.rawMouseY - S.canvasHeight / 2) / S.viewZoom + S.nodeY;
}
function viewRange(S) {
  const ratio = Math.max(S.canvasHeight / 1080, S.canvasWidth / 1920);
  return ratio * S.zoom;
}
function calcViewZoom(S) {
  if (0 != S.playerCells.length) {
    let newViewZoom = 0;
    for (let i = 0; i < S.playerCells.length; i++) newViewZoom += S.playerCells[i].size;
    newViewZoom = Math.pow(Math.min(64 / newViewZoom, 1), 0.4) * viewRange(S);
    S.viewZoom = (9 * S.viewZoom + newViewZoom) / 10;
  }
}
function canvasResize(S) {
  const wHandle = S.wHandle || window;
  window.scrollTo(0, 0);
  const dpr = window.devicePixelRatio;
  S.dpr = dpr;
  S.canvasWidth = wHandle.innerWidth * dpr;
  S.canvasHeight = wHandle.innerHeight * dpr;
  if (S.nCanvas) {
    S.nCanvas.width = S.canvasWidth;
    S.nCanvas.height = S.canvasHeight;
    S.nCanvas.style.width = `${wHandle.innerWidth}px`;
    S.nCanvas.style.height = `${wHandle.innerHeight}px`;
  }
}
export {
  calcViewZoom,
  canvasResize,
  createCameraState,
  lerpCamera,
  mouseCoordinateChange,
  viewRange
};