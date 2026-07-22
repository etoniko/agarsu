import { mountPanel, unmountPanel } from "./panels/mount.js";
import storeHtml from "./panels/store.html?raw";

let storeVkStarted = false;

function resetStorePanel() {
  storeVkStarted = false;
  unmountPanel("store");
}

async function ensureStorePanel() {
  mountPanel("store", storeHtml);
  if (typeof window.__agarsuRefreshStoreUi === "function") {
    window.__agarsuRefreshStoreUi();
  }
  if (storeVkStarted) return;
  storeVkStarted = true;
  if (!window.VKIDSDK) return;
  const { initVkAuthModule } = await import("./account.js");
  initVkAuthModule();
}

export { ensureStorePanel, resetStorePanel };
