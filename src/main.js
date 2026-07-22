import "./styles/main.css";
import { log } from "./lib/log.js";
import "./lib/vector.js";
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
  const { hydrateAccountToken } = await import("./storage/local.js");
  hydrateAccountToken();
  const vkOk = await ensureVkSdk();
  const { initLobbyUi, showContent } = await import("./ui/lobby.js");
  const { initGame } = await import("./game/app.js");
  await initLobbyUi();
  initGame(window);
  await showContent("home");
  // Handle VK OAuth redirect callback even before cabinet is opened
  if (vkOk) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("code") && params.get("device_id")) {
      const { initVkAuthModule } = await import("./ui/account.js");
      initVkAuthModule();
    }
  }
  log.info("Agar.su ready");
}
boot().catch((err) => {
  console.error("Boot failed:", err);
});
