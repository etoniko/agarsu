import "./styles/main.css";
import { log } from "./lib/log.js";
import "./lib/vector.js";
import { bus, Events } from "./lib/events.js";
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
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}
async function ensureVkSdk() {
  if (window.VKIDSDK) return true;
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return false;
  const sources = [
    "https://unpkg.com/@vkid/sdk@2.6.1/dist-sdk/umd/index.js"
  ];
  for (const src of sources) {
    try {
      await loadScript(src);
      if (window.VKIDSDK) return true;
    } catch {
    }
  }
  log.warn("VK ID SDK unavailable");
  return false;
}
async function boot() {
  const vkOk = await ensureVkSdk();
  const { initGame } = await import("./game/app.js");
  const { initLobbyUi } = await import("./ui/lobby.js");
  await import("./ui/shop.js");
  await import("./ui/skinsGallery.js");
  await import("./ui/pass.js");
  await import("./ui/ratings.js");
  await import("./ui/settings.js");
  initGame(window);
  initLobbyUi();
  if (vkOk) {
    const { initVkAuthModule } = await import("./ui/account.js");
    initVkAuthModule();
  }
  bus.emit(Events.SHOW_CONTENT, { id: "home" });
  log.info("Agar.su ready");
}
boot().catch((err) => {
  console.error("Boot failed:", err);
});
