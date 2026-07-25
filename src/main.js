import "./styles/main.css";
import { log } from "./lib/log.js";
import "./lib/vector.js";
import { bus, Events } from "./lib/events.js";
import { hydrateAccountToken } from "./storage/local.js";
import { initGame } from "./game/app.js";
import { initLobbyUi } from "./ui/lobby.js";
import "./ui/shop.js";
import "./ui/skinsGallery.js";
import "./ui/pass.js";
import "./ui/ratings.js";
import "./ui/settings.js";
import { initVkAuthModule } from "./ui/account.js";
import { scheduleDeferredExternals, isEmbedMode } from "./lib/deferredExternals.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (src.includes("vkid") && window.VKIDSDK) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

async function ensureVkSdk() {
  if (window.VKIDSDK) return true;
  if (isEmbedMode()) return false;
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return false;
  try {
    await loadScript("/vendor/vkid-sdk.umd.js");
    if (window.VKIDSDK) return true;
  } catch {
    /* ignore */
  }
  log.warn("VK ID SDK unavailable");
  return false;
}

async function boot() {
  window.renderDeathBanner = window.renderDeathBanner || function () {};

  hydrateAccountToken();
  const vkOk = await ensureVkSdk();

  initGame(window);
  initLobbyUi();

  if (vkOk) {
    initVkAuthModule();
  }

  bus.emit(Events.SHOW_CONTENT, { id: "home" });
  scheduleDeferredExternals();
  log.info("Agar.su low-client ready");
}

boot().catch((err) => {
  console.error("Boot failed:", err);
});
