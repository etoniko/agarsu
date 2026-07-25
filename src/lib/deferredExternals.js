/**
 * Ads / counters load AFTER the game boots and never block it.
 * Mail.ru Top is skipped for authorized players.
 */
import { getAccountToken } from "../storage/local.js";

function isEmbedMode() {
  try {
    if (new URLSearchParams(location.search).has("embed")) return true;
  } catch {
    /* ignore */
  }
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isAuthorized() {
  try {
    return Boolean(getAccountToken());
  } catch {
    return false;
  }
}

function loadScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

function setupYandexAds() {
  window.yaContextCb = window.yaContextCb || [];

  function renderHomeBanner() {
    if (!document.getElementById("yandex_rtb_R-A-15699059-13")) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderHomeBanner, { once: true });
      }
      return;
    }
    try {
      Ya.Context.AdvManager.render({
        blockId: "R-A-15699059-13",
        renderTo: "yandex_rtb_R-A-15699059-13"
      });
    } catch {
      /* ignore */
    }
  }

  window.renderDeathBanner = function () {
    const el = document.getElementById("yandex_rtb_R-A-15699059-14");
    if (!el) return;
    const doRender = () => {
      try {
        el.innerHTML = "";
        Ya.Context.AdvManager.render({
          blockId: "R-A-15699059-14",
          renderTo: "yandex_rtb_R-A-15699059-14"
        });
      } catch {
        /* ignore */
      }
    };
    if (window.Ya && Ya.Context && Ya.Context.AdvManager) {
      doRender();
    } else {
      window.yaContextCb = window.yaContextCb || [];
      window.yaContextCb.push(doRender);
    }
  };

  window.yaContextCb.push(renderHomeBanner);
  return loadScript("https://yandex.ru/ads/system/context.js").catch(() => {});
}

function setupMailRuCounter() {
  window._tmr = window._tmr || [];
  window._tmr.push({
    id: "3773988",
    type: "pageView",
    start: new Date().getTime()
  });
  return loadScript("https://top-fwz1.mail.ru/js/code.js", { id: "tmr-code" }).catch(() => {});
}

export function scheduleDeferredExternals() {
  if (!window.renderDeathBanner) {
    window.renderDeathBanner = function () {};
  }

  if (isEmbedMode()) {
    document.documentElement.classList.add("agarsu-embed");
  }

  const run = () => {
    setupYandexAds();
    // Authorized players: skip Mail.ru Top counter
    if (!isAuthorized()) {
      setupMailRuCounter();
    }
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 1200);
  }
}

export { isEmbedMode, isAuthorized };
