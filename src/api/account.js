import { ACCOUNT_API } from "../config/endpoints.js";
import { getAccountToken, clearAccountToken } from "../storage/local.js";
function authHeaders() {
  const token = getAccountToken();
  return token ? { Authorization: `Game ${token}` } : {};
}
async function accountApiGet(path) {
  return fetch(`${ACCOUNT_API.base}/${path}`, {
    headers: { ...authHeaders() },
    cache: "no-store"
  });
}
async function accountApiPost(path, body) {
  return fetch(`${ACCOUNT_API.base}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify(body)
  });
}
async function authVk(payload) {
  return fetch(ACCOUNT_API.authVk, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
export {
  accountApiGet,
  accountApiPost,
  authVk,
  clearAccountToken,
  getAccountToken
};