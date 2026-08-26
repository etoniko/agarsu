import {
  initGame,
  initLobbyUi,
  initVkAuthModule,
  bus,
  Events,
  hydrateAccountToken,
  scheduleDeferredExternals,
  ensureVkSdk,
  log
} from "./game/engine.js";

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
  log.info("Agar.su WebGL2 client ready");
}

boot().catch((err) => {
  console.error("Boot failed:", err);
});
