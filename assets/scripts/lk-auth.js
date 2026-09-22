/**
 * ЛК: вход / регистрация / восстановление (клиент).
 * Пошаговый UI — на экране только текущий шаг.
 */
(function () {
  const API = "https://api.agar.su/api";
  const PASS_RE = /^[0-9a-zA-Z.]{4,64}$/;

  let registerToken = null;
  let recoverToken = null;
  let providers = null;
  let googleInited = false;
  let onLoggedIn = null;
  let wired = false;
  let regTimerId = null;
  let recTimerId = null;
  /** @type {{ token: string, uid: string, pass: string, fromRegister: boolean } | null} */
  let pendingSave = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setErr(el, text) {
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function clearRecErr() {
    setErr($("authRecError"), "");
    setErr($("authRecErrorEmail"), "");
    setErr($("authRecErrorCode"), "");
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  function stopTimer(kind) {
    if (kind === "reg" && regTimerId) {
      clearInterval(regTimerId);
      regTimerId = null;
    }
    if (kind === "rec" && recTimerId) {
      clearInterval(recTimerId);
      recTimerId = null;
    }
  }

  function startCooldown(kind, sec) {
    const total = Math.max(1, Number(sec) || 300);
    const timerEl = $(kind === "reg" ? "authRegTimer" : "authRecTimer");
    const resendBtn = $(kind === "reg" ? "authRegResendBtn" : "authRecResendBtn");
    stopTimer(kind);
    if (timerEl) {
      timerEl.hidden = false;
      timerEl.innerHTML = "Новый код через <b>" + fmtTime(total) + "</b>";
    }
    if (resendBtn) resendBtn.hidden = true;

    let left = total;
    const tick = () => {
      left -= 1;
      if (left <= 0) {
        stopTimer(kind);
        if (timerEl) {
          timerEl.hidden = true;
          timerEl.innerHTML = "";
        }
        if (resendBtn) resendBtn.hidden = false;
        return;
      }
      if (timerEl) timerEl.innerHTML = "Новый код через <b>" + fmtTime(left) + "</b>";
    };
    const id = setInterval(tick, 1000);
    if (kind === "reg") regTimerId = id;
    else recTimerId = id;
  }

  function setRegStep(n) {
    document.querySelectorAll("#authRegSteps .lk-auth-step").forEach((el) => {
      el.classList.toggle("is-on", Number(el.getAttribute("data-step")) <= n);
    });
  }

  function hideAll(ids) {
    ids.forEach((id) => {
      const el = $(id);
      if (el) el.hidden = true;
    });
  }

  function showView(name) {
    const login = $("authCardLogin");
    const reg = $("authCardRegister");
    const rec = $("authCardRecover");
    const save = $("authCardSave");
    if (login) login.hidden = name !== "login";
    if (reg) reg.hidden = name !== "register";
    if (rec) rec.hidden = name !== "recover";
    if (save) save.hidden = name !== "save";
    if (name !== "save") {
      pendingSave = null;
      disarmSaveForm();
    }
    if (name === "register") resetRegister();
    if (name === "recover") resetRecover();
  }

  function resetRegister() {
    registerToken = null;
    stopTimer("reg");
    setErr($("authRegError"), "");
    setErr($("authRegErrorCode"), "");
    setErr($("authRegErrorPass"), "");
    hideAll(["authRegStepCode", "authRegStepPass"]);
    const email = $("authRegStepEmail");
    if (email) email.hidden = false;
    setRegStep(1);
    const hint = $("authRegHint");
    if (hint) hint.textContent = "Укажите почту";
    const resend = $("authRegResendBtn");
    if (resend) resend.hidden = true;
    const timer = $("authRegTimer");
    if (timer) timer.hidden = true;
  }

  function resetRecover() {
    persistRecoverToken(null);
    stopTimer("rec");
    clearRecErr();
    hideAll([
      "authRecStepEmail",
      "authRecStepGoogle",
      "authRecStepCode",
      "authRecStepPass",
    ]);
    const pick = $("authRecPick");
    if (pick) pick.hidden = false;
    const hint = $("authRecHint");
    if (hint) hint.textContent = "Выберите способ";
    const resend = $("authRecResendBtn");
    if (resend) resend.hidden = true;
    const timer = $("authRecTimer");
    if (timer) timer.hidden = true;
  }

  function showRecOnly(stepId, hintText) {
    hideAll([
      "authRecPick",
      "authRecStepEmail",
      "authRecStepGoogle",
      "authRecStepCode",
      "authRecStepPass",
    ]);
    const step = $(stepId);
    if (step) step.hidden = false;
    const hint = $("authRecHint");
    if (hint && hintText) hint.textContent = hintText;
  }

  function persistRecoverToken(token) {
    recoverToken = token || null;
    try {
      if (token) sessionStorage.setItem("lk_recover_token", token);
      else sessionStorage.removeItem("lk_recover_token");
    } catch (_) {}
  }

  function loadRecoverToken() {
    if (recoverToken) return recoverToken;
    try {
      recoverToken = sessionStorage.getItem("lk_recover_token");
    } catch (_) {}
    return recoverToken;
  }

  function showSetPassword() {
    clearRecErr();
    showRecOnly("authRecStepPass", "Придумайте новый пароль");
  }

  function openRecoverPassword(token) {
    if (!token) return;
    const login = $("authCardLogin");
    const reg = $("authCardRegister");
    const rec = $("authCardRecover");
    const save = $("authCardSave");
    if (login) login.hidden = true;
    if (reg) reg.hidden = true;
    if (save) save.hidden = true;
    if (rec) rec.hidden = false;
    persistRecoverToken(token);
    showSetPassword();
  }

  async function api(path, body, timeoutMs = 25000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(API + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
        signal: ctrl.signal,
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_) {}
      return { res, data };
    } catch (e) {
      if (e && e.name === "AbortError") {
        return {
          res: { ok: false, status: 408 },
          data: { error: "Сервер не ответил. Попробуйте ещё раз." },
        };
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
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
    pendingSave = null;
    disarmSaveForm();
    if (typeof onLoggedIn === "function") onLoggedIn(token);
    else if (window.wHandle && typeof window.wHandle.onAccountLoggedIn === "function") {
      window.wHandle.onAccountLoggedIn(token);
    }
  }

  /** LK login id from API (uid / ulogin / id) — never email. */
  function resolveLkUid(data) {
    const raw = data && (data.uid ?? data.ulogin ?? data.id);
    const uid = String(raw == null ? "" : raw).trim();
    return /^\d{1,12}$/.test(uid) ? uid : "";
  }

  /**
   * Save form stays "disarmed" in DOM so Chrome/Safari/iOS don't prompt
   * before the LK id exists. Arm only on the dedicated save step.
   */
  function disarmSaveForm() {
    const form = $("authSaveForm");
    const idEl = $("authSaveId");
    const passEl = $("authSavePass");
    if (form) form.setAttribute("autocomplete", "off");
    if (idEl) {
      idEl.value = "";
      idEl.removeAttribute("name");
      idEl.setAttribute("autocomplete", "off");
      idEl.setAttribute("data-lpignore", "true");
      idEl.setAttribute("data-1p-ignore", "true");
      idEl.setAttribute("data-form-type", "other");
    }
    if (passEl) {
      passEl.value = "";
      passEl.type = "text";
      passEl.removeAttribute("name");
      passEl.setAttribute("autocomplete", "off");
      passEl.setAttribute("data-lpignore", "true");
      passEl.setAttribute("data-1p-ignore", "true");
      passEl.setAttribute("data-form-type", "other");
      passEl.classList.add("lk-auth-input--secret");
    }
  }

  function armSaveForm(uid, pass) {
    const form = $("authSaveForm");
    const idEl = $("authSaveId");
    const passEl = $("authSavePass");
    if (form) form.setAttribute("autocomplete", "on");
    if (idEl) {
      idEl.name = "username";
      idEl.setAttribute("autocomplete", "username");
      idEl.removeAttribute("data-lpignore");
      idEl.removeAttribute("data-1p-ignore");
      idEl.removeAttribute("data-form-type");
      idEl.value = String(uid);
    }
    if (passEl) {
      passEl.name = "password";
      passEl.type = "password";
      passEl.setAttribute("autocomplete", "new-password");
      passEl.removeAttribute("data-lpignore");
      passEl.removeAttribute("data-1p-ignore");
      passEl.removeAttribute("data-form-type");
      passEl.classList.remove("lk-auth-input--secret");
      passEl.value = String(pass || "");
    }
  }

  /**
   * Show official save form: username=ID, password=pass.
   * Only here (after create/recover) we arm autocomplete for OS managers.
   */
  function showSaveCredentials(uid, pass, token, fromRegister) {
    const id = resolveLkUid({ uid });
    if (!token) return;
    if (!id) {
      finishLogin(token);
      return;
    }
    pendingSave = { token, uid: id, pass: String(pass || ""), fromRegister: !!fromRegister };

    // Do NOT fill login password yet — that triggers early Save on some browsers.
    const loginId = $("authLoginId");
    if (loginId) loginId.value = id;

    armSaveForm(id, pass);

    const mailHint = $("authSaveMailHint");
    if (mailHint) mailHint.hidden = !fromRegister;

    const hint = $("authSaveHint");
    if (hint) {
      hint.textContent = fromRegister
        ? "ЛК создан. Логин — ID, пароль — ваш пароль. Сохраните в менеджере паролей."
        : "Пароль обновлён. Логин — ID, пароль — новый пароль. Сохраните в менеджере паролей.";
    }

    showView("save");
  }

  async function storeOfficialPassword(uid, pass) {
    const id = String(uid || "").trim();
    const password = String(pass || "");
    if (!id || !password) return false;
    try {
      if (typeof PasswordCredential === "function" && navigator.credentials?.store) {
        const cred = new PasswordCredential({
          id,
          password,
          name: id,
        });
        await navigator.credentials.store(cred);
        return true;
      }
    } catch (_) {}
    return false;
  }

  async function completeSaveAndLogin(ev) {
    if (ev) ev.preventDefault();
    const pending = pendingSave;
    if (!pending || !pending.token) return;

    const idEl = $("authSaveId");
    const passEl = $("authSavePass");
    const uid = resolveLkUid({ uid: (idEl && idEl.value) || pending.uid });
    const pass = (passEl && passEl.value) || pending.pass;
    if (!uid || !pass) {
      disarmSaveForm();
      finishLogin(pending.token);
      return;
    }

    armSaveForm(uid, pass);

    const loginId = $("authLoginId");
    const loginPass = $("authLoginPass");
    if (loginId) loginId.value = uid;
    if (loginPass) loginPass.value = pass;

    const btn = $("authSaveBtn");
    if (btn) btn.disabled = true;
    try {
      await storeOfficialPassword(uid, pass);
      await new Promise((r) => setTimeout(r, 120));
    } finally {
      if (btn) btn.disabled = false;
    }
    disarmSaveForm();
    finishLogin(pending.token);
  }

  function skipSaveAndLogin() {
    const pending = pendingSave;
    if (!pending || !pending.token) return;
    const loginId = $("authLoginId");
    if (loginId) loginId.value = pending.uid;
    disarmSaveForm();
    finishLogin(pending.token);
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

  async function regSend(isResend) {
    const err = isResend ? $("authRegErrorCode") : $("authRegError");
    const btn = isResend ? $("authRegResendBtn") : $("authRegSendBtn");
    const email = ($("authRegEmail")?.value || "").trim();
    setErr(err, "");
    if (btn) btn.disabled = true;
    if (err) {
      err.hidden = false;
      err.textContent = "Отправляем код…";
    }
    try {
      const { res, data } = await api("/auth/register/send-code", { email }, 28000);
      if (!res.ok || data.error) {
        setErr(err, data.error || "Не удалось отправить код");
        if (data.cooldownSec) startCooldown("reg", data.cooldownSec);
        return;
      }
      $("authRegStepEmail").hidden = true;
      $("authRegStepCode").hidden = false;
      setRegStep(2);
      $("authRegHint").textContent = "Код из письма";
      startCooldown("reg", data.cooldownSec || 300);
    } catch (_) {
      setErr(err, "Ошибка сети");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function regVerify() {
    const err = $("authRegErrorCode") || $("authRegError");
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
      stopTimer("reg");
      $("authRegStepCode").hidden = true;
      $("authRegStepPass").hidden = false;
      setRegStep(3);
      $("authRegHint").textContent = "Придумайте пароль";
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function regCreate() {
    const err = $("authRegErrorPass") || $("authRegError");
    const pass = $("authRegPass")?.value || "";
    setErr(err, "");
    if (!PASS_RE.test(pass)) {
      return setErr(err, "Пароль: латиница, цифры и точка, 4–64");
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
      const uid = resolveLkUid(data);
      showSaveCredentials(uid, pass, data.token, true);
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function recSend(isResend) {
    const err = isResend
      ? $("authRecErrorCode") || $("authRecError")
      : $("authRecErrorEmail") || $("authRecError");
    const email = ($("authRecEmail")?.value || "").trim();
    setErr(err, "");
    try {
      const { res, data } = await api("/auth/recover/send-code", { email });
      if (!res.ok || data.error) {
        setErr(err, data.error || "Не удалось отправить код");
        if (data.cooldownSec) startCooldown("rec", data.cooldownSec);
        return;
      }
      showRecOnly("authRecStepCode", "Код из письма");
      startCooldown("rec", data.cooldownSec || 300);
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function recVerify() {
    const err = $("authRecErrorCode") || $("authRecError");
    const email = ($("authRecEmail")?.value || "").trim();
    const code = ($("authRecCode")?.value || "").trim();
    setErr(err, "");
    try {
      const { res, data } = await api("/auth/recover/verify-code", { email, code });
      if (!res.ok || data.error || !data.recoverToken) {
        setErr(err, data.error || "Неверный код");
        return;
      }
      stopTimer("rec");
      openRecoverPassword(data.recoverToken);
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function recSetPass() {
    const pass = $("authRecPass")?.value || "";
    const token = loadRecoverToken();
    if (!token) {
      const hint = $("authRecHint");
      if (hint) hint.textContent = "Сессия сброшена. Выберите способ заново.";
      resetRecover();
      return;
    }
    if (!PASS_RE.test(pass)) {
      const hint = $("authRecHint");
      if (hint) hint.textContent = "Пароль: латиница, цифры и точка, 4–64";
      return;
    }
    try {
      const { res, data } = await api("/auth/recover/set-password", {
        recoverToken: token,
        pass,
      });
      if (!res.ok || data.error || !data.token) {
        const hint = $("authRecHint");
        if (hint) hint.textContent = data.error || "Не удалось сохранить";
        return;
      }
      persistRecoverToken(null);
      const uid = resolveLkUid(data);
      showSaveCredentials(uid, pass, data.token, false);
    } catch (_) {
      const hint = $("authRecHint");
      if (hint) hint.textContent = "Ошибка сети";
    }
  }

  async function applySocialRecover(path, body) {
    clearRecErr();
    const hint = $("authRecHint");
    if (hint) hint.textContent = "Проверяем…";
    try {
      const { res, data } = await api(path, body);
      if (!res.ok || data.error || !data.recoverToken) {
        resetRecover();
        setErr($("authRecError"), data.error || "В ЛК нет связанного аккаунта");
        return;
      }
      openRecoverPassword(data.recoverToken);
    } catch (_) {
      resetRecover();
      setErr($("authRecError"), "Ошибка сети");
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
    if (!clientId || !wrap) return;
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
      if (!googleInited) {
        wrap.innerHTML = "";
        window.google.accounts.id.renderButton(wrap, {
          type: "standard",
          size: "medium",
          theme: "outline",
          text: "continue_with",
          shape: "rectangular",
          width: 280,
        });
        googleInited = true;
      }
    } catch (_) {
      setErr($("authRecError"), "Не удалось загрузить Google");
      resetRecover();
    }
  }

  function startVkRecover() {
    window._lkRecoverVkMode = true;
    const hint = $("authRecHint");
    if (hint) hint.textContent = "Откройте окно VK…";
    hideAll([
      "authRecPick",
      "authRecStepEmail",
      "authRecStepGoogle",
      "authRecStepCode",
      "authRecStepPass",
    ]);
    (async () => {
      try {
        if (!window.VKIDSDK) {
          await loadScript("https://unpkg.com/@vkid/sdk@<3/dist-sdk/umd/index.js");
        }
        const VKID = window.VKIDSDK;
        if (!VKID) throw new Error("no sdk");
        const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(48)))
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
        resetRecover();
        setErr($("authRecError"), "Не удалось открыть VK");
      }
    })();
  }

  function pickRecoverMethod(method) {
    clearRecErr();
    if (method === "email") {
      showRecOnly("authRecStepEmail", "Email аккаунта");
      return;
    }
    if (method === "google") {
      showRecOnly("authRecStepGoogle", "Войдите через Google");
      initGoogleRecover();
      return;
    }
    if (method === "vk") {
      startVkRecover();
      return;
    }
    if (method === "telegram") {
      const hint = $("authRecHint");
      if (hint) hint.textContent = "Откройте Telegram…";
      hideAll([
        "authRecPick",
        "authRecStepEmail",
        "authRecStepGoogle",
        "authRecStepCode",
        "authRecStepPass",
      ]);
      window._telegramRecoverMode = true;
      window.open("/telegram/", "tgAuth", "width=420,height=520");
    }
  }

  function wire() {
    if (wired) return;
    wired = true;

    document.querySelectorAll("[data-auth-view]").forEach((btn) => {
      btn.addEventListener("click", () => showView(btn.getAttribute("data-auth-view")));
    });

    const idInput = $("authLoginId");
    if (idInput) {
      idInput.addEventListener("input", () => {
        const digits = idInput.value.replace(/\D/g, "").slice(0, 12);
        if (idInput.value !== digits) idInput.value = digits;
      });
    }
    $("authLoginForm")?.addEventListener("submit", doLogin);
    $("authSaveForm")?.addEventListener("submit", completeSaveAndLogin);
    $("authSaveSkipBtn")?.addEventListener("click", skipSaveAndLogin);
    const saveIdInput = $("authSaveId");
    if (saveIdInput) {
      saveIdInput.addEventListener("input", () => {
        const digits = saveIdInput.value.replace(/\D/g, "").slice(0, 12);
        if (saveIdInput.value !== digits) saveIdInput.value = digits;
      });
    }
    $("authRegSendBtn")?.addEventListener("click", () => regSend(false));
    $("authRegResendBtn")?.addEventListener("click", () => regSend(true));
    $("authRegVerifyBtn")?.addEventListener("click", regVerify);
    $("authRegCreateBtn")?.addEventListener("click", regCreate);
    $("authRecSendBtn")?.addEventListener("click", () => recSend(false));
    $("authRecResendBtn")?.addEventListener("click", () => recSend(true));
    $("authRecVerifyBtn")?.addEventListener("click", recVerify);
    $("authRecSetPassBtn")?.addEventListener("click", recSetPass);

    document.querySelectorAll("[data-rec-method]").forEach((btn) => {
      btn.addEventListener("click", () => pickRecoverMethod(btn.getAttribute("data-rec-method")));
    });

    $("authRecBackPick")?.addEventListener("click", resetRecover);
    document.querySelectorAll("[data-rec-back]").forEach((btn) => {
      btn.addEventListener("click", resetRecover);
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
      // НЕ вызывать showView("recover") — он делает resetRecover() и убивает токен
      openRecoverPassword(token);
    });
  }

  window.AgarLkAuth = {
    init(hooks) {
      onLoggedIn = hooks?.onLoggedIn || null;
      wire();
      disarmSaveForm();
      showView("login");
    },
    showView,
    applyRecoverToken(token) {
      openRecoverPassword(token);
    },
  };
})();
