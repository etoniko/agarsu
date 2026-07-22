import { deleteCookie, getCookie, setCookie } from "./cookies.js";

const TOKEN_KEY = "accountToken";
const memory = /* @__PURE__ */ Object.create(null);

function canUseStorage(store) {
  try {
    if (!store) return false;
    const probe = "__agarsu_storage_probe__";
    store.setItem(probe, "1");
    const ok = store.getItem(probe) === "1";
    store.removeItem(probe);
    return ok;
  } catch {
    return false;
  }
}

function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw;
  } catch {
    return fallback;
  }
}
function lsGetJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function lsSetJson(key, value) {
  return lsSet(key, JSON.stringify(value));
}
function lsRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readTokenCandidates() {
  const values = [];
  try {
    const fromLs = localStorage.getItem(TOKEN_KEY);
    if (fromLs) values.push(fromLs);
  } catch {
  }
  try {
    if (localStorage[TOKEN_KEY]) values.push(localStorage[TOKEN_KEY]);
  } catch {
  }
  try {
    const fromSs = sessionStorage.getItem(TOKEN_KEY);
    if (fromSs) values.push(fromSs);
  } catch {
  }
  try {
    const fromCookie = getCookie(TOKEN_KEY);
    if (fromCookie) values.push(fromCookie);
  } catch {
  }
  if (memory[TOKEN_KEY]) values.push(memory[TOKEN_KEY]);
  return values.find((v) => typeof v === "string" && v.trim()) || null;
}

function writeTokenEverywhere(token) {
  memory[TOKEN_KEY] = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
  }
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
  }
  try {
    setCookie(TOKEN_KEY, token, 30);
  } catch {
  }
}

function clearTokenEverywhere() {
  delete memory[TOKEN_KEY];
  lsRemove(TOKEN_KEY);
  try {
    delete localStorage[TOKEN_KEY];
  } catch {
  }
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
  }
  try {
    deleteCookie(TOKEN_KEY);
  } catch {
  }
}

function getAccountToken() {
  const token = readTokenCandidates();
  if (token) {
    // Keep storages in sync for code that still reads localStorage.accountToken
    try {
      if (localStorage.getItem(TOKEN_KEY) !== token) localStorage.setItem(TOKEN_KEY, token);
    } catch {
    }
  }
  return token;
}

function setAccountToken(token) {
  if (!token) {
    clearTokenEverywhere();
    return;
  }
  writeTokenEverywhere(String(token));
}

function clearAccountToken() {
  clearTokenEverywhere();
}

function hydrateAccountToken() {
  const token = readTokenCandidates();
  if (!token) return null;
  writeTokenEverywhere(token);
  return token;
}

function isStorageReliable() {
  return canUseStorage(window.localStorage);
}

function prefersSameWindowAuth() {
  const ua = navigator.userAgent || "";
  // Cursor / VS Code Simple Browser runs in Electron and often breaks popup OAuth
  if (/\bElectron\b/i.test(ua)) return true;
  if (!isStorageReliable()) return true;
  return false;
}

export {
  clearAccountToken,
  getAccountToken,
  hydrateAccountToken,
  isStorageReliable,
  lsGet,
  lsGetJson,
  lsRemove,
  lsSet,
  lsSetJson,
  prefersSameWindowAuth,
  setAccountToken
};
