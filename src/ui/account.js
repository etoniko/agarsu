import { prefersSameWindowAuth } from "../storage/local.js";
import { deleteCookie, getCookie, setCookie } from "../storage/cookies.js";

function initVkAuthModule() {
  const PKCE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  const VK_VERIFIER_KEY = "vk_code_verifier";
  const VK_STATE_KEY = "vk_state";

  function randomString(len) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < len; i++) out += PKCE_CHARS[bytes[i] % PKCE_CHARS.length];
    return out;
  }

  function persistPkce(codeVerifier, state) {
    try {
      sessionStorage.setItem(VK_VERIFIER_KEY, codeVerifier);
      sessionStorage.setItem(VK_STATE_KEY, state);
    } catch {
    }
    try {
      localStorage.setItem(VK_VERIFIER_KEY, codeVerifier);
      localStorage.setItem(VK_STATE_KEY, state);
    } catch {
    }
    try {
      setCookie(VK_VERIFIER_KEY, codeVerifier, 1);
      setCookie(VK_STATE_KEY, state, 1);
    } catch {
    }
  }

  function readPkce() {
    const read = (getter) => {
      try {
        return getter();
      } catch {
        return null;
      }
    };
    const codeVerifier =
      read(() => sessionStorage.getItem(VK_VERIFIER_KEY)) ||
      read(() => localStorage.getItem(VK_VERIFIER_KEY)) ||
      read(() => getCookie(VK_VERIFIER_KEY));
    const state =
      read(() => sessionStorage.getItem(VK_STATE_KEY)) ||
      read(() => localStorage.getItem(VK_STATE_KEY)) ||
      read(() => getCookie(VK_STATE_KEY));
    return { codeVerifier, state };
  }

  function clearPkce() {
    for (const key of [VK_VERIFIER_KEY, VK_STATE_KEY]) {
      try {
        sessionStorage.removeItem(key);
      } catch {
      }
      try {
        localStorage.removeItem(key);
      } catch {
      }
      try {
        deleteCookie(key);
      } catch {
      }
    }
  }

  function vkidOnError(error) {
    console.error("VK ID error:", error);
    const msg = error?.error_description || error?.error || error?.text || (typeof error === "string" ? error : "\u041E\u0448\u0438\u0431\u043A\u0430 \u0432\u0445\u043E\u0434\u0430 VK");
    alert("VK: " + msg);
  }

  function sendCodeToServer(code, deviceId) {
    const { codeVerifier, state } = readPkce();
    if (!codeVerifier || !state) {
      alert("VK: \u0441\u0435\u0441\u0441\u0438\u044F \u0438\u0441\u0442\u0435\u043A\u043B\u0430, \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443");
      return;
    }
    if (typeof window.onVkAuth !== "function") {
      alert("VK: \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0433\u043E\u0442\u043E\u0432\u0430, \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0441\u043D\u043E\u0432\u0430");
      return;
    }
    clearPkce();
    window.onVkAuth({ code, device_id: deviceId, code_verifier: codeVerifier, state });
  }

  function initVkAuth() {
    if (!("VKIDSDK" in window)) return;
    const VKID = window.VKIDSDK;
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get("code");
    const deviceFromUrl = urlParams.get("device_id");
    if (codeFromUrl && deviceFromUrl) {
      sendCodeToServer(codeFromUrl, deviceFromUrl);
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      return;
    }
    const container = document.getElementById("VkIdSdkOAuthList") || document.getElementById("VkIdSdkOneTap");
    if (!container) return;
    if (container.dataset.vkWired === "1") return;
    container.dataset.vkWired = "1";
    const codeVerifier = randomString(64);
    const state = randomString(32);
    persistPkce(codeVerifier, state);
    const sameWindow = prefersSameWindowAuth();
    const config = {
      app: 54069355,
      redirectUrl: "https://agar.su",
      state,
      codeVerifier,
      responseMode: sameWindow ? VKID.ConfigResponseMode.Redirect : VKID.ConfigResponseMode.Callback,
      source: VKID.ConfigSource.LOWCODE,
      scope: ""
    };
    if (sameWindow && VKID.ConfigAuthMode?.Redirect) {
      config.mode = VKID.ConfigAuthMode.Redirect;
    }
    VKID.Config.init(config);
    const oauthListNames = [
      VKID.OAuthName.VK,
      VKID.OAuthName.MAIL,
      VKID.OAuthName.OK
    ];
    new VKID.OAuthList().render({
      container,
      oauthList: oauthListNames,
      scheme: VKID.Scheme.LIGHT,
      lang: VKID.Languages.RUS,
      styles: { height: 44, borderRadius: 8 }
    }).on(VKID.WidgetEvents.ERROR, vkidOnError).on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, function(payload) {
      sendCodeToServer(payload.code, payload.device_id);
    });
  }
  if ("VKIDSDK" in window) {
    initVkAuth();
  } else {
    document.querySelector('script[src*="vkid-sdk"]')?.addEventListener("load", initVkAuth);
  }
}
window.initVkAuthModule = initVkAuthModule;
export {
  initVkAuthModule
};
