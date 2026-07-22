let onOverlaysShow = null;
let onOverlaysHide = null;
function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}
function byId(id) {
  return document.getElementById(id);
}
function isVisible(el) {
  if (!el) return false;
  if (el.hidden) return false;
  if (el.style.display === "none") return false;
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}
function showElement(el) {
  if (!el) return;
  if (el._savedDisplay != null) {
    el.style.display = el._savedDisplay;
    el._savedDisplay = null;
  } else {
    el.style.removeProperty("display");
  }
}
function hideElement(el) {
  if (!el) return;
  if (el.style.display !== "none") {
    el._savedDisplay = el.style.display || "";
  }
  el.style.display = "none";
}
function setElementDisplay(el, value) {
  if (!el) return;
  el.style.display = value;
}
function isPointerOverElement(el, clientX, clientY) {
  if (!el || !isVisible(el)) return false;
  const rect = el.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}
function setOverlaysLifecycleHooks({ onShow, onHide } = {}) {
  onOverlaysShow = onShow ?? null;
  onOverlaysHide = onHide ?? null;
}
function showOverlays() {
  const el = byId("overlays");
  showElement(el);
  onOverlaysShow?.();
}
function hideOverlays() {
  const el = byId("overlays");
  hideElement(el);
  onOverlaysHide?.();
}
function isOverlaysVisible() {
  return isVisible(byId("overlays"));
}
function showStatics() {
  setElementDisplay(byId("statics"), "flex");
}
function hideStatics() {
  hideElement(byId("statics"));
}
export {
  byId,
  hideElement,
  hideOverlays,
  hideStatics,
  isOverlaysVisible,
  isPointerOverElement,
  isVisible,
  onReady,
  setElementDisplay,
  setOverlaysLifecycleHooks,
  showElement,
  showOverlays,
  showStatics
};
