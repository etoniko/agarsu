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
  } catch {
  }
}
function lsSetJson(key, value) {
  lsSet(key, JSON.stringify(value));
}
function getAccountToken() {
  return localStorage.accountToken || null;
}
function setAccountToken(token) {
  if (token) localStorage.accountToken = token;
  else delete localStorage.accountToken;
}
function clearAccountToken() {
  delete localStorage.accountToken;
}
export {
  clearAccountToken,
  getAccountToken,
  lsGet,
  lsGetJson,
  lsSet,
  lsSetJson,
  setAccountToken
};