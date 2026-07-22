import { mountPanel, unmountPanel } from "./panels/mount.js";
import homeHtml from "./panels/home.html?raw";

let homeBound = false;

async function resetHomePanel() {
  homeBound = false;
  try {
    const { resetPassUi } = await import("./pass.js");
    resetPassUi();
  } catch {
  }
  unmountPanel("home");
}

async function ensureHomePanel() {
  mountPanel("home", homeHtml);
  if (homeBound) {
    if (typeof window.__agarsuOnHomeMounted === "function") {
      window.__agarsuOnHomeMounted();
    }
    return;
  }
  homeBound = true;
  const { bindPassUi } = await import("./pass.js");
  bindPassUi();
  const { bindHomeAvatarUi } = await import("./skinsGallery.js");
  bindHomeAvatarUi();
  if (typeof window.__agarsuOnHomeMounted === "function") {
    window.__agarsuOnHomeMounted();
  }
}

export { ensureHomePanel, resetHomePanel };
