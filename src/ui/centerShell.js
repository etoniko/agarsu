import { addOverlaysLifecycleHooks } from "../lib/dom.js";
import overlaysHtml from "./panels/overlays.html?raw";

const MENU_PANELS = ["home", "shop", "settings", "skinslist", "rating", "store"];
const RATING_HOME_HTML = `<div class="rating-home" id="home-stats">
    <div class="rating-header">Статистика</div>
    <div class="rating-content" id="topswindow"></div>
</div>`;

let overlaysPlaceholder = null;
let parkedRatingHome = null;
let lastMenuId = "home";
let detaching = false;
let attaching = false;
let hooksInstalled = false;

async function resetAllMenuPanels() {
  await Promise.all(MENU_PANELS.map(async (id) => {
    try {
      if (id === "home") return (await import("./homePanel.js")).resetHomePanel();
      if (id === "shop") return (await import("./shop.js")).resetShopPanel();
      if (id === "settings") return (await import("./settings.js")).resetSettingsPanel();
      if (id === "skinslist") return (await import("./skinsGallery.js")).resetSkinsGalleryPanel();
      if (id === "rating") return (await import("./ratings.js")).resetRatingPanel();
      if (id === "store") return (await import("./storePanel.js")).resetStorePanel();
    } catch (err) {
      console.error("reset panel", id, err);
    }
  }));
}

function rememberActiveMenu() {
  const active = document.querySelector("#overlays .content.active");
  if (active?.id) lastMenuId = active.id;
}

function parkRatingHome(overlays) {
  const ratingHome = overlays?.querySelector(".rating-home");
  if (!ratingHome) return;
  ratingHome.style.display = "none";
  parkedRatingHome = ratingHome;
  document.body.appendChild(ratingHome);
}

function restoreRatingHome(overlays) {
  if (!overlays) return;
  let ratingHome = parkedRatingHome;
  if (!ratingHome || !ratingHome.isConnected) {
    ratingHome = document.querySelector("body > .rating-home");
  }
  if (!ratingHome) {
    const wrap = document.createElement("div");
    wrap.innerHTML = RATING_HOME_HTML.trim();
    ratingHome = wrap.firstElementChild;
  }
  if (!ratingHome) return;
  ratingHome.style.display = "";
  const footer = overlays.querySelector("footer.footer");
  if (footer) overlays.insertBefore(ratingHome, footer);
  else overlays.appendChild(ratingHome);
  parkedRatingHome = null;
}

async function detachOverlays() {
  if (detaching) return;
  const overlays = document.getElementById("overlays");
  if (!overlays) return;
  detaching = true;
  try {
    rememberActiveMenu();
    parkRatingHome(overlays);
    overlaysPlaceholder = document.createComment("agarsu-overlays");
    overlays.replaceWith(overlaysPlaceholder);
    await resetAllMenuPanels();
  } finally {
    detaching = false;
  }
}

function remountYandexHomeBanner() {
  const renderTo = "yandex_rtb_R-A-15699059-13";
  if (!document.getElementById(renderTo)) return;
  const doRender = () => {
    try {
      window.Ya?.Context?.AdvManager?.render?.({
        blockId: "R-A-15699059-13",
        renderTo
      });
    } catch (err) {
      console.error(err);
    }
  };
  if (window.Ya?.Context?.AdvManager) doRender();
  else {
    window.yaContextCb = window.yaContextCb || [];
    window.yaContextCb.push(doRender);
  }
}

function attachOverlays() {
  if (attaching) return;
  if (document.getElementById("overlays")) return;
  attaching = true;
  try {
    const wrap = document.createElement("div");
    wrap.innerHTML = overlaysHtml.trim();
    const overlays = wrap.firstElementChild;
    if (!overlays) return;
    if (overlaysPlaceholder?.parentNode) {
      overlaysPlaceholder.replaceWith(overlays);
    } else {
      document.body.insertBefore(overlays, document.body.firstChild);
    }
    overlaysPlaceholder = null;
    restoreRatingHome(overlays);
    if (typeof window.updateAccountMenuLabel === "function") {
      window.updateAccountMenuLabel();
    }
    remountYandexHomeBanner();
    if (typeof window.showContent === "function") {
      window.showContent(lastMenuId || "home").catch((err) => console.error(err));
    }
  } finally {
    attaching = false;
  }
}

function initCenterShell() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  addOverlaysLifecycleHooks({
    onHide: () => {
      detachOverlays().catch((err) => console.error("detach overlays:", err));
    },
    onShow: () => {
      try {
        attachOverlays();
      } catch (err) {
        console.error("attach overlays:", err);
      }
    }
  });
}

export { attachOverlays as attachCenter, detachOverlays as detachCenter, initCenterShell };
