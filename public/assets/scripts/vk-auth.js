(function () {
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
    const msg =
      error?.error_description ||
      error?.error ||
      error?.text ||
      (typeof error === "string" ? error : "Ошибка входа VK");
    alert("VK: " + msg);
  }

  // Auth Code → на бэкенд api.agar.su (обмен code→token по документации VK ID Web)
  function sendCodeToServer(code, deviceId) {
    const codeVerifier = sessionStorage.getItem("vk_code_verifier");
    const state = sessionStorage.getItem("vk_state");
    if (!codeVerifier || !state) {
      alert("VK: сессия истекла, обновите страницу");
      return;
    }
    if (typeof window.onVkAuth !== "function") {
      alert("VK: страница ещё не готова, обновите и попробуйте снова");
      return;
    }
    window.onVkAuth({ code, device_id: deviceId, code_verifier: codeVerifier, state });
  }

  function initVkAuth() {
    if (!("VKIDSDK" in window)) return;

    const VKID = window.VKIDSDK;
    const container =
      document.getElementById("VkIdSdkOAuthList") ||
      document.getElementById("VkIdSdkOneTap");
    if (!container) return;

    // Redirect fallback: обработать code ДО генерации нового PKCE
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get("code");
    const deviceFromUrl = urlParams.get("device_id");
    if (codeFromUrl && deviceFromUrl) {
      sendCodeToServer(codeFromUrl, deviceFromUrl);
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      return;
    }

    // PKCE: code_verifier генерируем сами → обмен на бэкенде (id.vk.ru/oauth2/auth)
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
      scope: "",
    });

    // Виджет 3 в 1: чистые кнопки VK / Mail / OK
    const oauthListNames = [
      VKID.OAuthName.VK,
      VKID.OAuthName.MAIL,
      VKID.OAuthName.OK,
    ];

    new VKID.OAuthList()
      .render({
        container,
        oauthList: oauthListNames,
        scheme: VKID.Scheme.LIGHT,
        lang: VKID.Languages.RUS,
        styles: { height: 44, borderRadius: 8 },
      })
      .on(VKID.WidgetEvents.ERROR, vkidOnError)
      .on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, function (payload) {
        sendCodeToServer(payload.code, payload.device_id);
      });
  }

  if ("VKIDSDK" in window) {
    initVkAuth();
  } else {
    document.querySelector('script[src*="vkid-sdk"]')?.addEventListener("load", initVkAuth);
  }
})();
