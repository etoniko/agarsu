/**
 * ЛК: вход / регистрация / восстановление (клиент).
 * Покупки, pass.txt, NickPass — не трогает.
 */
(function () {
  const API = "https://api.agar.su/api";
  const PASS_RE = /^[0-9a-zA-Z.]{4,64}$/;

  let registerToken = null;
  let recoverToken = null;
  let providers = null;
  let googleInited = false;
  let onLoggedIn = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setErr(el, text) {
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function showView(name) {
    const login = $("authCardLogin");
    const reg = $("authCardRegister");
    const rec = $("authCardRecover");
    if (login) login.hidden = name !== "login";
    if (reg) reg.hidden = name !== "register";
    if (rec) rec.hidden = name !== "recover";
    if (name === "register") resetRegister();
    if (name === "recover") resetRecover();
  }

  function resetRegister() {
    registerToken = null;
    setErr($("authRegError"), "");
    const email = $("authRegStepEmail");
    const code = $("authRegStepCode");
    const pass = $("authRegStepPass");
    if (email) email.hidden = false;
    if (code) code.hidden = true;
    if (pass) pass.hidden = true;
    const hint = $("authRegHint");
    if (hint) hint.textContent = "Укажите почту — придёт код из 5 цифр.";
  }

  function resetRecover() {
    recoverToken = null;
    setErr($("authRecError"), "");
    const methods = $("authRecMethods");
    const code = $("authRecStepCode");
    const pass = $("authRecStepPass");
    if (methods) methods.hidden = false;
    if (code) code.hidden = true;
    if (pass) pass.hidden = true;
    const hint = $("authRecHint");
    if (hint) hint.textContent = "Через VK, Google, Telegram (VPN) или email.";
  }

  function showSetPassword(fromRecover) {
    if (fromRecover) {
      const methods = $("authRecMethods");
      const code = $("authRecStepCode");
      const pass = $("authRecStepPass");
      if (methods) methods.hidden = true;
      if (code) code.hidden = true;
      if (pass) pass.hidden = false;
      const hint = $("authRecHint");
      if (hint) hint.textContent = "Придумайте новый пароль для входа по ID ЛК.";
    }
  }

  async function api(path, body) {
    const res = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {}
    return { res, data };
  }

  async function loadProviders() {
    if (providers) return providers;
    try {
      const res = await fetch(API + "/auth/providers");
      providers = await res.json();
    } catch (_) {
      providers = {};
    }
    return providers;
  }

  function finishLogin(token) {
    if (!token) return;
    if (typeof onLoggedIn === "function") onLoggedIn(token);
    else if (window.wHandle && typeof window.wHandle.onAccountLoggedIn === "function") {
      window.wHandle.onAccountLoggedIn(token);
    }
  }

  async function doLogin(ev) {
    if (ev) ev.preventDefault();
    const err = $("authLoginError");
    const btn = $("authLoginBtn");
    const ulogin = ($("authLoginId")?.value || "").trim();
    const pass = $("authLoginPass")?.value || "";
    setErr(err, "");
    if (!/^\d{1,12}$/.test(ulogin)) return setErr(err, "Введите ID ЛК (число)");
    if (!pass) return setErr(err, "Введите пароль");
    if (btn) btn.disabled = true;
    try {
      const { res, data } = await api("/auth/login", { ulogin, pass });
      if (!res.ok || data.error || !data.token) {
        setErr(err, data.error || "Ошибка входа");
        return;
      }
      finishLogin(data.token);
    } catch (_) {
      setErr(err, "Ошибка сети");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function regSend() {
    const err = $("authRegError");
    const btn = $("authRegSendBtn");
    const email = ($("authRegEmail")?.value || "").trim();
    setErr(err, "");
    if (btn) btn.disabled = true;
    try {
      const { res, data } = await api("/auth/register/send-code", { email });
      if (!res.ok || data.error) {
        setErr(err, data.error || "Не удалось отправить код");
        return;
      }
      $("authRegStepEmail").hidden = true;
      $("authRegStepCode").hidden = false;
      $("authRegHint").textContent = "Введите код из письма.";
    } catch (_) {
      setErr(err, "Ошибка сети");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function regVerify() {
    const err = $("authRegError");
    const email = ($("authRegEmail")?.value || "").trim();
    const code = ($("authRegCode")?.value || "").trim();
    setErr(err, "");
    try {
      const { res, data } = await api("/auth/register/verify-code", { email, code });
      if (!res.ok || data.error || !data.registerToken) {
        setErr(err, data.error || "Неверный код");
        return;
      }
      registerToken = data.registerToken;
      $("authRegStepCode").hidden = true;
      $("authRegStepPass").hidden = false;
      $("authRegHint").textContent = "Придумайте пароль для ЛК.";
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function regCreate() {
    const err = $("authRegError");
    const pass = $("authRegPass")?.value || "";
    setErr(err, "");
    if (!PASS_RE.test(pass)) {
      return setErr(err, "Пароль: латиница, цифры и точка, 4–64 символа");
    }
    try {
      const { res, data } = await api("/auth/register/create", {
        registerToken,
        pass,
      });
      if (!res.ok || data.error || !data.token) {
        setErr(err, data.error || "Не удалось создать");
        return;
      }
      alert("ЛК создан! ID: " + data.uid + "\nДанные также отправлены на почту.");
      finishLogin(data.token);
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function recSend() {
    const err = $("authRecError");
    const email = ($("authRecEmail")?.value || "").trim();
    setErr(err, "");
    try {
      const { res, data } = await api("/auth/recover/send-code", { email });
      if (!res.ok || data.error) {
        setErr(err, data.error || "Не удалось отправить код");
        return;
      }
      $("authRecMethods").hidden = true;
      $("authRecStepCode").hidden = false;
      $("authRecHint").textContent = "Введите код из письма.";
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function recVerify() {
    const err = $("authRecError");
    const email = ($("authRecEmail")?.value || "").trim();
    const code = ($("authRecCode")?.value || "").trim();
    setErr(err, "");
    try {
      const { res, data } = await api("/auth/recover/verify-code", { email, code });
      if (!res.ok || data.error || !data.recoverToken) {
        setErr(err, data.error || "Неверный код");
        return;
      }
      recoverToken = data.recoverToken;
      showSetPassword(true);
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function recSetPass() {
    const err = $("authRecError");
    const pass = $("authRecPass")?.value || "";
    setErr(err, "");
    if (!PASS_RE.test(pass)) {
      return setErr(err, "Пароль: латиница, цифры и точка, 4–64 символа");
    }
    try {
      const { res, data } = await api("/auth/recover/set-password", {
        recoverToken,
        pass,
      });
      if (!res.ok || data.error || !data.token) {
        setErr(err, data.error || "Не удалось сохранить");
        return;
      }
      alert("Пароль сохранён. ID ЛК: " + data.uid);
      finishLogin(data.token);
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function applySocialRecover(path, body) {
    const err = $("authRecError");
    setErr(err, "Проверяем…");
    try {
      const { res, data } = await api(path, body);
      if (!res.ok || data.error || !data.recoverToken) {
        setErr(err, data.error || "В ЛК нет связанного аккаунта");
        return;
      }
      recoverToken = data.recoverToken;
      setErr(err, "");
      showSetPassword(true);
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("script"));
      document.head.appendChild(s);
    });
  }

  async function initGoogleRecover() {
    const cfg = await loadProviders();
    const clientId = cfg.googleClientId;
    const wrap = $("authRecGoogleWrap");
    if (!clientId || !wrap || googleInited) return;
    try {
      await loadScript("https://accounts.google.com/gsi/client");
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) {
            applySocialRecover("/auth/recover/google", {
              credential: response.credential,
            });
          }
        },
      });
      wrap.innerHTML = "";
      window.google.accounts.id.renderButton(wrap, {
        type: "standard",
        size: "medium",
        theme: "outline",
        text: "continue_with",
        shape: "rectangular",
      });
      googleInited = true;
    } catch (_) {
      setErr($("authRecError"), "Не удалось загрузить Google");
    }
  }

  // VK recovery: reuse existing onVkAuth channel with mode flag
  function startVkRecover() {
    window._lkRecoverVkMode = true;
    setErr($("authRecError"), "Откройте окно VK…");
    // Prefer dedicated VK OneTap if available via initVkAuthModule path
    if (typeof window.startVkOAuthForRecover === "function") {
      window.startVkOAuthForRecover();
      return;
    }
    // Fallback: click-like through VK ID Auth.login if SDK present
    (async () => {
      try {
        if (!window.VKIDSDK) {
          await loadScript("https://unpkg.com/@vkid/sdk@<3/dist-sdk/umd/index.js");
        }
        const VKID = window.VKIDSDK;
        if (!VKID) throw new Error("no sdk");
        const codeVerifier =
          Array.from(crypto.getRandomValues(new Uint8Array(48)))
            .map((b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"[b % 64])
            .join("");
        const state = Array.from(crypto.getRandomValues(new Uint8Array(24)))
          .map((b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"[b % 64])
          .join("");
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
        const result = VKID.Auth.login({ provider: VKID.OAuthName.VK });
        if (result && typeof result.then === "function") {
          const payload = await result;
          if (payload?.code) {
            window.onVkAuth?.({
              code: payload.code,
              device_id: payload.device_id,
              code_verifier: codeVerifier,
              state,
            });
          }
        }
      } catch (e) {
        window._lkRecoverVkMode = false;
        setErr($("authRecError"), "Не удалось открыть VK");
      }
    })();
  }

  function wire() {
    document.querySelectorAll("[data-auth-view]").forEach((btn) => {
      btn.addEventListener("click", () => showView(btn.getAttribute("data-auth-view")));
    });
    $("authLoginForm")?.addEventListener("submit", doLogin);
    $("authRegSendBtn")?.addEventListener("click", regSend);
    $("authRegVerifyBtn")?.addEventListener("click", regVerify);
    $("authRegCreateBtn")?.addEventListener("click", regCreate);
    $("authRecSendBtn")?.addEventListener("click", recSend);
    $("authRecVerifyBtn")?.addEventListener("click", recVerify);
    $("authRecSetPassBtn")?.addEventListener("click", recSetPass);
    $("authRecVkBtn")?.addEventListener("click", startVkRecover);
    $("authRecGoogleBtn")?.addEventListener("click", () => {
      initGoogleRecover();
      setErr($("authRecError"), "Нажмите кнопку Google ниже");
    });
    $("authRecTgBtn")?.addEventListener("click", () => {
      window._telegramRecoverMode = true;
      window.open("/telegram/", "tgAuth", "width=420,height=520");
    });

    window.addEventListener("message", (event) => {
      if (event.data?.type !== "telegram-auth") return;
      if (!window._telegramRecoverMode) return;
      window._telegramRecoverMode = false;
      applySocialRecover("/auth/recover/telegram", event.data.user);
    });

    document.addEventListener("lk-recover-ready", (ev) => {
      const token = ev.detail?.recoverToken;
      if (!token) return;
      recoverToken = token;
      showView("recover");
      showSetPassword(true);
    });

    // Hook VK auth for recover mode (main.js sets onVkAuth)
    const prev = window.onVkAuth;
    window.__lkAuthWrapVk = function (payload) {
      if (window._lkRecoverVkMode) {
        window._lkRecoverVkMode = false;
        applySocialRecover("/auth/recover/vk", payload);
        return;
      }
      if (typeof prev === "function") prev(payload);
    };
  }

  window.AgarLkAuth = {
    init(hooks) {
      onLoggedIn = hooks?.onLoggedIn || null;
      wire();
      showView("login");
    },
    showView,
    applyRecoverToken(token) {
      if (!token) return;
      recoverToken = token;
      showView("recover");
      showSetPassword(true);
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      /* wait for main.js hooks */
    });
  }
})();
