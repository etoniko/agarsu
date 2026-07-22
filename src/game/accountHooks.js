import { clearAccountToken, setAccountToken } from "../storage/local.js";
import { getLevel, getXp } from "./stats.js";
import { loadMyNicknames } from "./shopPerks.js";
const GOOGLE_RESTORE_CLIENT_ID = "157257230972-4vh698jtf46c76sc7607oe1k9tr782je.apps.googleusercontent.com";
const RESTORED_AT_KEY = "accountRestoredAt";
function isTruthyRestoreValue(value) {
  return value !== null && value !== undefined && value !== "" && value !== false && value !== 0 && value !== "0" && value !== "false";
}
function getRestoreTimestamp(accountData) {
  const candidates = [
    accountData?.restored_at,
    accountData?.restoredAt,
    accountData?.restore_at,
    accountData?.is_restored === true ? accountData?.restored_at || Date.now() : null,
    accountData?.restored === true ? accountData?.restored_at || Date.now() : null
  ];
  for (const value of candidates) {
    if (isTruthyRestoreValue(value)) return value;
  }
  try {
    const cached = localStorage.getItem(RESTORED_AT_KEY);
    return isTruthyRestoreValue(cached) ? cached : null;
  } catch {
    return null;
  }
}
function isAccountRestored(accountData) {
  return getRestoreTimestamp(accountData) != null;
}
function persistRestoreTimestamp(value) {
  if (!isTruthyRestoreValue(value)) return;
  try {
    localStorage.setItem(RESTORED_AT_KEY, String(value));
  } catch {
  }
}
function clearRestoreTimestamp() {
  try {
    localStorage.removeItem(RESTORED_AT_KEY);
  } catch {
  }
}
function formatRestoreDate(value) {
  if (!isTruthyRestoreValue(value)) return "";
  const num = Number(value);
  const date = !Number.isNaN(num) && num > 0 ? new Date(num < 1e12 ? num * 1000 : num) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU");
}
function updateRestoreBlockVisibility(S) {
  const block = document.getElementById("restoreProgressBlock");
  const available = document.getElementById("restoreAvailableBlock");
  const done = document.getElementById("restoreDoneBlock");
  const badge = document.getElementById("restoreStateBadge");
  if (!block) return;
  const restoredAt = getRestoreTimestamp(S.accountData);
  const restored = restoredAt != null;
  if (badge) {
    const dateLabel = formatRestoreDate(restoredAt);
    badge.textContent = restored ? (dateLabel ? `\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D ${dateLabel}` : "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D") : "\u041D\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D";
    badge.className = "restore-state-badge" + (restored ? " restore-state-badge--done" : "");
  }
  if (available) available.style.display = restored ? "none" : "";
  if (done) {
    done.style.display = restored ? "" : "none";
    if (restored) {
      const dateLabel = formatRestoreDate(restoredAt);
      done.textContent = dateLabel ? `\u042D\u0442\u043E\u0442 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0443\u0436\u0435 \u0431\u044B\u043B \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D ${dateLabel}. \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F.` : "\u042D\u0442\u043E\u0442 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0443\u0436\u0435 \u0431\u044B\u043B \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D. \u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F.";
    }
  }
  block.style.display = "";
}
function showNickClanTab(S, which) {
  const tabN = document.getElementById("tabNicknames");
  const tabC = document.getElementById("tabClans");
  const tabS = document.getElementById("tabSettings");
  const nick = document.getElementById("nickWrap");
  const clan = document.getElementById("clanWrap");
  const settings = document.getElementById("settingsWrap");
  if (!tabN || !tabC || !tabS || !nick || !clan || !settings) return;
  tabN.classList.toggle("active", which === "nicks");
  tabC.classList.toggle("active", which === "clans");
  tabS.classList.toggle("active", which === "settings");
  nick.style.display = which === "nicks" ? "" : "none";
  clan.style.display = which === "clans" ? "" : "none";
  settings.style.display = which === "settings" ? "" : "none";
  updateRestoreBlockVisibility(S);
}
function wireTabsOnce(S) {
  const wrap = document.getElementById("myNickClanTabs");
  const tabN = document.getElementById("tabNicknames");
  const tabC = document.getElementById("tabClans");
  const tabS = document.getElementById("tabSettings");
  if (!wrap || !tabN || !tabC || !tabS || wrap.dataset.wired) return;
  tabN.onclick = () => showNickClanTab(S, "nicks");
  tabC.onclick = () => showNickClanTab(S, "clans");
  tabS.onclick = () => showNickClanTab(S, "settings");
  wrap.dataset.wired = "1";
}
function hideAuthButtons() {
  const vk = document.getElementById("vkAuthContainer");
  if (vk) vk.style.display = "none";
}
function showAuthButtons() {
  const vk = document.getElementById("vkAuthContainer");
  if (vk) vk.style.display = "flex";
}
function setRestoreStatus(text, type = "info") {
  const el = document.getElementById("restoreStatus");
  if (!el) return;
  el.hidden = !text;
  el.textContent = text || "";
  el.className = "restore-status" + (type ? ` restore-status--${type}` : "");
}
function attachAccountHooks(S, hooks) {
  const wHandle = S.wHandle;
  let restoreGoogleInitialized = false;
  const accountApiGet = (tag, method = "GET", body = null) => {
    const headers = { Authorization: `Game ${localStorage.accountToken}` };
    if (body) headers["Content-Type"] = "application/json";
    return fetch("https://api.agar.su/api/" + tag, { method, headers, body: body ? JSON.stringify(body) : null });
  };
  const displayAccountData = () => {
    if (!S.accountData) return;
    updateRestoreBlockVisibility(S);
    const currLevel = getLevel(S.accountData.xp);
    const nextXp = getXp(currLevel + 1);
    const progressPercent = S.accountData.xp / nextXp * 100;
    const progressBar = document.querySelector(".progress-fill");
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    const levelCircle = document.getElementById("levelCircle");
    if (levelCircle) levelCircle.textContent = currLevel;
    const progressText = document.getElementById("progressText");
    if (progressText) progressText.textContent = `${Math.round(progressPercent)}% (${S.accountData.xp}/${nextXp})`;
    const accountIDElement = document.getElementById("accountID");
    if (accountIDElement) accountIDElement.textContent = `ID: ${S.accountData.uid}`;
  };
  const nickHooks = {
    accountApiGet,
    clearAccountToken,
    onLogout: () => onLogout(),
    setNick: hooks.setNick,
    selectSkin: hooks.selectSkin,
    wireTabsOnce: () => wireTabsOnce(S),
    showNickClanTab: (which) => showNickClanTab(S, which)
  };
  const setAccountData = (data) => {
    S.accountData = data;
    persistRestoreTimestamp(getRestoreTimestamp(data));
    displayAccountData();
    loadMyNicknames(S, nickHooks);
    if (typeof window.updateAccountMenuLabel === "function") {
      window.updateAccountMenuLabel();
    }
    const logoutBtn = document.getElementById("logoutButton");
    const authlogEl = document.getElementById("authlog");
    if (logoutBtn) logoutBtn.style.display = "";
    if (authlogEl) authlogEl.style.display = "none";
    hideAuthButtons();
  };
  const onLogout = () => {
    S.accountData = null;
    localStorage.removeItem("accountData");
    clearAccountToken();
    clearRestoreTimestamp();
    const block = document.getElementById("myNicknamesBlock");
    if (block) block.style.display = "none";
    const restorePanel = document.getElementById("restorePanel");
    const restoreToggle = document.getElementById("restoreToggle");
    const settingsWrap = document.getElementById("settingsWrap");
    if (restorePanel) restorePanel.hidden = true;
    if (restoreToggle) restoreToggle.setAttribute("aria-expanded", "false");
    if (settingsWrap) settingsWrap.style.display = "none";
    setRestoreStatus("");
    const nickList = document.getElementById("myNickList");
    const clanList = document.getElementById("myClanList");
    const badgeNick = document.getElementById("badgeNick");
    const badgeClan = document.getElementById("badgeClan");
    if (nickList) nickList.innerHTML = "";
    if (clanList) clanList.innerHTML = "";
    if (badgeNick) badgeNick.textContent = "0";
    if (badgeClan) badgeClan.textContent = "0";
    const progressBar = document.querySelector(".progress-fill");
    if (progressBar) progressBar.style.width = "0%";
    const levelCircle = document.getElementById("levelCircle");
    if (levelCircle) levelCircle.textContent = "0";
    const progressText = document.getElementById("progressText");
    if (progressText) progressText.textContent = "0% (0/0)";
    const accountIDElement = document.getElementById("accountID");
    if (accountIDElement) accountIDElement.textContent = "ID: 0000";
    const authlogEl = document.getElementById("authlog");
    if (authlogEl) authlogEl.style.display = "flex";
    const logoutBtn = document.getElementById("logoutButton");
    if (logoutBtn) logoutBtn.style.display = "none";
    showAuthButtons();
    if (typeof window.updateAccountMenuLabel === "function") {
      window.updateAccountMenuLabel();
    }
  };
  const loadAccountUserData = async () => {
    const res = await accountApiGet("me/login");
    if (res.ok) {
      const data = await res.json();
      if (data.error) {
        if (401 == data.status) clearAccountToken();
        else alert(data.error);
      } else setAccountData(data);
    }
  };
  async function handleLogin(tokenOrUser, provider) {
    if (provider !== "vk") return;
    let res;
    try {
      res = await fetch("https://api.agar.su/api/auth/vk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenOrUser)
      });
    } catch (e) {
      return alert("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438 \u043F\u0440\u0438 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438");
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      return alert("\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0442\u0432\u0435\u0442\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438");
    }
    if (data.error || !data.token) return alert(data.error || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438");
    wHandle.onAccountLoggedIn(data.token);
  }
  wHandle.onVkAuth = function(payload) {
    if (!payload || !payload.code || !payload.device_id) {
      return alert("VK: \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0435\u043D \u043A\u043E\u0434 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438");
    }
    handleLogin(payload, "vk");
  };
  const handleRestoreResponse = async (res) => {
    let data;
    try {
      data = await res.json();
    } catch (e) {
      setRestoreStatus("\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0442\u0432\u0435\u0442\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430", "error");
      return;
    }
    if (!res.ok || data.error) {
      setRestoreStatus(data.error || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441", "error");
      return;
    }
    setRestoreStatus(data.message || "\u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D \u043A VK", "success");
    const restoredAt = data.restored_at || data.restoredAt || Date.now();
    persistRestoreTimestamp(restoredAt);
    if (S.accountData) S.accountData.restored_at = restoredAt;
    if (data.token) {
      setAccountToken(data.token);
      if (typeof window.updateAccountMenuLabel === "function") {
        window.updateAccountMenuLabel();
      }
      hooks.sendAccountToken();
    }
    await loadAccountUserData();
    updateRestoreBlockVisibility(S);
  };
  async function restoreProgressFromTelegram(user) {
    if (!localStorage.accountToken) {
      return alert("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u043E\u0439\u0434\u0438\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 VK");
    }
    setRestoreStatus("\u041F\u0440\u0438\u0432\u044F\u0437\u044B\u0432\u0430\u0435\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u2026", "info");
    try {
      const res = await accountApiGet("me/restore/telegram", "POST", user);
      await handleRestoreResponse(res);
    } catch (e) {
      setRestoreStatus("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438", "error");
    }
  }
  async function restoreProgressFromGoogle(credential) {
    if (!localStorage.accountToken) {
      return alert("\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u043E\u0439\u0434\u0438\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 VK");
    }
    setRestoreStatus("\u041F\u0440\u0438\u0432\u044F\u0437\u044B\u0432\u0430\u0435\u043C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u2026", "info");
    try {
      const res = await accountApiGet("me/restore/google", "POST", { credential });
      await handleRestoreResponse(res);
    } catch (e) {
      setRestoreStatus("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438", "error");
    }
  }
  wHandle.onRestoreGoogleAuth = function(response) {
    if (response?.credential) restoreProgressFromGoogle(response.credential);
  };
  function loadGoogleRestoreScript() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) return resolve();
      const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google script failed")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google script failed"));
      document.head.appendChild(script);
    });
  }
  async function initRestoreGoogleButton() {
    const container = document.getElementById("restoreGoogleContainer");
    if (!container || restoreGoogleInitialized) return;
    try {
      await loadGoogleRestoreScript();
      window.google.accounts.id.initialize({
        client_id: GOOGLE_RESTORE_CLIENT_ID,
        callback: wHandle.onRestoreGoogleAuth
      });
      window.google.accounts.id.renderButton(container, {
        type: "standard",
        size: "medium",
        theme: "outline",
        text: "continue_with",
        shape: "rectangular"
      });
      restoreGoogleInitialized = true;
    } catch (e) {
      setRestoreStatus("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C Google", "error");
    }
  }
  function wireRestoreProgressUI() {
    const toggle = document.getElementById("restoreToggle");
    const panel = document.getElementById("restorePanel");
    const tgBtn = document.getElementById("restoreTelegramBtn");
    if (!toggle || !panel || toggle.dataset.wired) return;
    toggle.dataset.wired = "1";
    toggle.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) initRestoreGoogleButton();
    });
    if (tgBtn) {
      tgBtn.addEventListener("click", () => {
        window._telegramRestoreMode = true;
        window.open("https://agar.su/telegram/", "tgRestore", "width=400,height=200");
      });
    }
  }
  window.addEventListener("message", function(event) {
    if (event.origin !== "https://agar.su") return;
    if (event.data.type === "telegram-auth" && window._telegramRestoreMode) {
      window._telegramRestoreMode = false;
      restoreProgressFromTelegram(event.data.user);
    }
  });
  function initRestoreProgressUI() {
    wireRestoreProgressUI();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRestoreProgressUI);
  } else {
    initRestoreProgressUI();
  }
  wHandle.onAccountLoggedIn = (token) => {
    setAccountToken(token);
    if (typeof window.updateAccountMenuLabel === "function") {
      window.updateAccountMenuLabel();
    }
    loadAccountUserData();
    loadMyNicknames(S, nickHooks);
    hooks.sendAccountToken();
  };
  wHandle.logoutAccount = async () => {
    if (localStorage.accountToken) {
      const res = await accountApiGet("me/logout");
      if (res.ok) {
        const data = await res.json();
        if (data.ok || 401 == data.status) onLogout();
        if (data.error) alert(data.error);
      }
    } else onLogout();
  };
  wHandle.onUpdateXp = (xp) => {
    if (S.accountData) {
      S.accountData.xp = xp;
      displayAccountData();
    }
  };
  if (localStorage.accountToken) loadAccountUserData();
  if (typeof window.updateAccountMenuLabel === "function") {
    window.updateAccountMenuLabel();
  }
  return {
    displayAccountData,
    loadAccountUserData,
    onLogout,
    updateRestoreBlockVisibility: () => updateRestoreBlockVisibility(S),
    showNickClanTab: (which) => showNickClanTab(S, which),
    wireTabsOnce: () => wireTabsOnce(S)
  };
}
export {
  attachAccountHooks
};