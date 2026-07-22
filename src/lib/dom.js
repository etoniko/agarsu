let onOverlaysShowHooks = [];
let onOverlaysHideHooks = [];
import { hideStaticsHud, showStaticsHud } from "../ui/hudLazy.js";
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
function addOverlaysLifecycleHooks({ onShow, onHide } = {}) {
  if (typeof onShow === "function") onOverlaysShowHooks.push(onShow);
  if (typeof onHide === "function") onOverlaysHideHooks.push(onHide);
}
function setOverlaysLifecycleHooks({ onShow, onHide } = {}) {
  onOverlaysShowHooks = [];
  onOverlaysHideHooks = [];
  addOverlaysLifecycleHooks({ onShow, onHide });
}
function showOverlays() {
  onOverlaysShowHooks.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  });
  showElement(byId("overlays"));
}
function hideOverlays() {
  onOverlaysHideHooks.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  });
  const el = byId("overlays");
  if (el) hideElement(el);
}
function isOverlaysVisible() {
  return !!byId("overlays") && isVisible(byId("overlays"));
}
function showStatics() {
  showStaticsHud();
}
function hideStatics() {
  hideStaticsHud();
}
export {
  addOverlaysLifecycleHooks,
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
if (typeof window !== "undefined") {
  window.showOverlays = showOverlays;
  window.hideOverlays = hideOverlays;
}
