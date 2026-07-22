from pathlib import Path

remote = Path("src/ui/lobby.remote.js").read_text(encoding="utf-8")
idx = remote.find("function updateAccountMenuLabel")
helpers = remote[idx:]
head = r'''import { bus, Events } from "../lib/events.js";
import { hideStatics, showOverlays } from "../lib/dom.js";
import { getAccountToken } from "../storage/local.js";
import { unmountPanel } from "./panels/mount.js";

const MENU_PANELS = ["home", "shop", "settings", "skinslist", "rating", "store"];
let showGen = 0;

async function resetPanelModule(id) {
  switch (id) {
    case "home":
      return (await import("./homePanel.js")).resetHomePanel();
    case "shop":
      return (await import("./shop.js")).resetShopPanel();
    case "settings":
      return (await import("./settings.js")).resetSettingsPanel();
    case "skinslist":
      return (await import("./skinsGallery.js")).resetSkinsGalleryPanel();
    case "rating":
      return (await import("./ratings.js")).resetRatingPanel();
    case "store":
      return (await import("./storePanel.js")).resetStorePanel();
    default:
      unmountPanel(id);
  }
}

async function unloadOtherPanels(activeId) {
  await Promise.all(
    MENU_PANELS.filter((id) => id !== activeId).map((id) => resetPanelModule(id))
  );
}

async function ensureActivePanel(id) {
  if (id === "home") {
    await (await import("./homePanel.js")).ensureHomePanel();
    return;
  }
  if (id === "skinslist") {
    await (await import("./skinsGallery.js")).initSkinsGallery();
    return;
  }
  if (id === "rating") {
    await (await import("./ratings.js")).ensureRatingPanel();
    return;
  }
  if (id === "shop") {
    await (await import("./shop.js")).ensureShopPanel();
    return;
  }
  if (id === "settings") {
    await (await import("./settings.js")).ensureSettingsPanel();
    return;
  }
  if (id === "store") {
    await (await import("./storePanel.js")).ensureStorePanel();
    return;
  }
}

async function showContent(id) {
  const gen = ++showGen;
  document.querySelectorAll(".menu-item").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".content").forEach((content) => content.classList.remove("active"));
  const menuItem = document.querySelector(`.menu-item[onclick="showContent('${id}')"]`);
  if (menuItem) menuItem.classList.add("active");

  await unloadOtherPanels(id);
  if (gen !== showGen) return;

  const panel = document.getElementById(id);
  if (panel) panel.classList.add("active");

  try {
    await ensureActivePanel(id);
  } catch (err) {
    console.error(id + " panel:", err);
  }
  if (gen !== showGen) return;

  if (typeof window.updateShopAuthNotice === "function") window.updateShopAuthNotice();
  bus.emit(Events.SHOW_CONTENT, { id });
}

'''
Path("src/ui/lobby.js").write_text(head + helpers, encoding="utf-8")
print("ok", len(head + helpers))
