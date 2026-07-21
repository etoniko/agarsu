function initVkAuthModule() {
  const PKCE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  function randomString(len) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < len; i++) out += PKCE_CHARS[bytes[i] % PKCE_CHARS.length];
    return out;
  }
  function vkidOnError(error) {
    console.error("VK ID error:", error);
    const msg = error?.error_description || error?.error || error?.text || (typeof error === "string" ? error : "\u041E\u0448\u0438\u0431\u043A\u0430 \u0432\u0445\u043E\u0434\u0430 VK");
    alert("VK: " + msg);
  }
  function sendCodeToServer(code, deviceId) {
    const codeVerifier = sessionStorage.getItem("vk_code_verifier");
    const state = sessionStorage.getItem("vk_state");
    if (!codeVerifier || !state) {
      alert("VK: \u0441\u0435\u0441\u0441\u0438\u044F \u0438\u0441\u0442\u0435\u043A\u043B\u0430, \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443");
      return;
    }
    if (typeof window.onVkAuth !== "function") {
      alert("VK: \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0433\u043E\u0442\u043E\u0432\u0430, \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0441\u043D\u043E\u0432\u0430");
      return;
    }
    window.onVkAuth({ code, device_id: deviceId, code_verifier: codeVerifier, state });
  }
  function initVkAuth() {
    if (!("VKIDSDK" in window)) return;
    const VKID = window.VKIDSDK;
    const container = document.getElementById("VkIdSdkOAuthList") || document.getElementById("VkIdSdkOneTap");
    if (!container) return;
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get("code");
    const deviceFromUrl = urlParams.get("device_id");
    if (codeFromUrl && deviceFromUrl) {
      sendCodeToServer(codeFromUrl, deviceFromUrl);
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      return;
    }
    const codeVerifier = randomString(64);
    const state = randomString(32);
    sessionStorage.setItem("vk_code_verifier", codeVerifier);
    sessionStorage.setItem("vk_state", state);
    VKID.Config.init({
      app: 54069355,
      redirectUrl: "https://agar.su",
      state,
      codeVerifier,
      responseMode: VKID.ConfigResponseMode.Callback,
      source: VKID.ConfigSource.LOWCODE,
      scope: ""
    });
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