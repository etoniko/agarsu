import { RANKINGS_URL, TOP100_URL, ONLINE_HUB_URL } from "../config/endpoints.js";
import { getGameServerApiBase } from "../config/servers.js";
async function fetchTop100() {
  const res = await fetch(TOP100_URL, { cache: "no-store" });
  return res.json();
}
async function fetchRankings() {
  const res = await fetch(RANKINGS_URL, { cache: "no-store" });
  return res.json();
}
async function fetchOnlineHub() {
  const res = await fetch(ONLINE_HUB_URL, { cache: "no-store" });
  return res.json();
}
async function fetchServerStats(hostOrUrl) {
  const base = getGameServerApiBase(hostOrUrl);
  const res = await fetch(base + "/checkStats", { cache: "no-store" });
  return res.json();
}
export {
  fetchOnlineHub,
  fetchRankings,
  fetchServerStats,
  fetchTop100
};