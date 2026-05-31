(function () {
  function vkidOnError(error) {
    console.error("VK ID error:", error);
    const msg =
      error?.error_description ||
      error?.error ||
      error?.text ||
      (typeof error === "string" ? error : "Ошибка входа VK");
    alert("VK: " + msg);
  }

  function vkidOnSuccess(tokenData) {
    if (typeof wHandle.onVkAuth === "function") {
      wHandle.onVkAuth(tokenData);
    } else {
      alert("VK: страница ещё не готова, обновите и попробуйте снова");
    }
  }

  function exchangeAndLogin(VKID, code, deviceId) {
    return VKID.Auth.exchangeCode(code, deviceId).then(vkidOnSuccess).catch(vkidOnError);
  }

  function initVkAuth() {
    if (!("VKIDSDK" in window)) return;

    const VKID = window.VKIDSDK;
    const container = document.getElementById("VkIdSdkOneTap");
    if (!container) return;

    // Redirect URL = https://agar.su (как в кабинете VK ID, не api.agar.su)
    VKID.Config.init({
      app: 54069355,
      redirectUrl: "https://agar.su",
      responseMode: VKID.ConfigResponseMode.Callback,
      source: VKID.ConfigSource.LOWCODE,
      scope: "",
    });

    // Если VK вернул code в URL (redirect после popup)
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get("code");
    const deviceFromUrl = urlParams.get("device_id");
    if (codeFromUrl && deviceFromUrl) {
      exchangeAndLogin(VKID, codeFromUrl, deviceFromUrl).finally(() => {
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      });
      return;
    }

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
      .on(VKID.WidgetEvents.ERROR, vkidOnError)
      .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, function (payload) {
        exchangeAndLogin(VKID, payload.code, payload.device_id);
      });
  }

  if ("VKIDSDK" in window) {
    initVkAuth();
  } else {
    document.querySelector('script[src*="@vkid/sdk"]')?.addEventListener("load", initVkAuth);
  }
})();
