const GAME_SERVERS = {
  // FFA Moscow moved to HostKey node. /challenge returns 403 — skip PoW.
  // api must match host — ffa.agar.su/checkStats is unreachable.
  ffa: { host: "hostkey.agar.su", api: "https://hostkey.agar.su", title: "FFA - \u041C\u043E\u0441\u043A\u0432\u0430", pow: false },
  // FFA2 (6013): PoW required — api and host must both use :6013.
  ffa2: { host: "ffa.agar.su:6013", api: "https://ffa.agar.su:6013", title: "FFA - \u0410\u0433\u0430\u0440\u0438\u043E", pow: true },
  // Other game ports: /challenge returns 403 — connect without PoW (same as before ffa2 pow gate).
  ms: { host: "ffa.agar.su:6002", api: "https://ffa.agar.su:6002", title: "MegaSplit", pow: false },
  pvp1: { host: "ffa.agar.su:6004", api: "https://ffa.agar.su:6004", title: "pvp1: 1x1 ffa 1k", pow: false },
  pvp2: { host: "ffa.agar.su:6005", api: "https://ffa.agar.su:6005", title: "pvp2: 2x2 ms 1k", pow: false },
  tournament2: { host: "ffa.agar.su:6007", api: "https://ffa.agar.su:6007", title: "Tournament 2x2", pow: false },
  tournament: { host: "ffa.agar.su:6006", api: "https://ffa.agar.su:6006", title: "Tournament 3x3", pow: false }
};
const SERVERS = Object.fromEntries(
  Object.entries(GAME_SERVERS).map(([id, s]) => [id, s.host])
);
function findGameServer(hostOrUrl) {
  if (!hostOrUrl) return GAME_SERVERS.ffa;
  return Object.values(GAME_SERVERS).find(
    (s) => s.host === hostOrUrl || s.api === hostOrUrl
  ) || null;
}
function getGameServerApiBase(hostOrUrl) {
  const entry = findGameServer(hostOrUrl);
  if (entry) return entry.api;
  if (!hostOrUrl) return GAME_SERVERS.ffa.api;
  if (/^https?:\/\//i.test(hostOrUrl)) return hostOrUrl.replace(/\/$/, "");
  return "https://" + String(hostOrUrl).replace(/^wss?:\/\//i, "");
}
function getGameServerWssUrl(host) {
  const h = host || GAME_SERVERS.ffa.host;
  return "wss://" + String(h).replace(/^wss?:\/\//i, "");
}
function serverRequiresPow(hostOrUrl) {
  const entry = findGameServer(hostOrUrl);
  if (entry && typeof entry.pow === "boolean") return entry.pow;
  // Unknown hosts: try PoW if available, but do not hard-require (403/404 → connect without token).
  return false;
}
export {
  GAME_SERVERS,
  SERVERS,
  findGameServer,
  getGameServerApiBase,
  getGameServerWssUrl,
  serverRequiresPow
};
