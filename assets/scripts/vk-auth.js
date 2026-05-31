(function () {
  const PKCE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";

  function randomString(len) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < len; i++) out += PKCE_CHARS[bytes[i] % PKCE_CHARS.length];
    return out;
  }

  function initVkAuth() {
    if (!("VKIDSDK" in window)) return;

    const VKID = window.VKIDSDK;
    const container = document.getElementById("VkIdSdkOneTap");
    if (!container) return;

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

    const oneTap = new VKID.OneTap();
    oneTap
      .render({
        container,
        showAlternativeLogin: true,
        oauthList: ["mail_ru", "ok_ru"],
        styles: { width: 360, height: 44, borderRadius: 8 },
        skin: VKID.OneTapSkin.Primary,
        scheme: VKID.Scheme.LIGHT,
        lang: VKID.Languages.RUS,
      })
      .on(VKID.WidgetEvents.ERROR, (err) => {
        console.error("VK ID widget error:", err);
      })
      .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload) => {
        if (typeof wHandle.onVkAuth === "function") {
          wHandle.onVkAuth(payload);
        }
      });
  }

  if ("VKIDSDK" in window) {
    initVkAuth();
  } else {
    document.querySelector('script[src*="@vkid/sdk"]')?.addEventListener("load", initVkAuth);
  }
})();
