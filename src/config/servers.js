const GAME_SERVERS = {
  ffa: { host: "ffa.agar.su", api: "https://ffa.agar.su", title: "FFA - \u041C\u043E\u0441\u043A\u0432\u0430" },
  ms: { host: "ffa.agar.su:6002", api: "https://ffa.agar.su:6002", title: "MegaSplit" },
  pvp1: { host: "ffa.agar.su:6004", api: "https://ffa.agar.su:6004", title: "pvp1: 1x1 ffa 1k" },
  pvp2: { host: "ffa.agar.su:6005", api: "https://ffa.agar.su:6005", title: "pvp2: 2x2 ms 1k" },
  tournament2: { host: "ffa.agar.su:6007", api: "https://ffa.agar.su:6007", title: "Tournament 2x2" },
  tournament: { host: "ffa.agar.su:6006", api: "https://ffa.agar.su:6006", title: "Tournament 3x3" }
};
const SERVERS = Object.fromEntries(
  Object.entries(GAME_SERVERS).map(([id, s]) => [id, s.host])
);
function getGameServerApiBase(hostOrUrl) {
  if (!hostOrUrl) return GAME_SERVERS.ffa.api;
  const entry = Object.values(GAME_SERVERS).find(
    (s) => s.host === hostOrUrl || s.api === hostOrUrl
  );
  if (entry) return entry.api;
  if (/^https?:\/\//i.test(hostOrUrl)) return hostOrUrl.replace(/\/$/, "");
  return "https://" + String(hostOrUrl).replace(/^wss?:\/\//i, "");
}
function getGameServerWssUrl(host) {
  const h = host || GAME_SERVERS.ffa.host;
  return "wss://" + String(h).replace(/^wss?:\/\//i, "");
}
export {
  GAME_SERVERS,
  SERVERS,
  getGameServerApiBase,
  getGameServerWssUrl
};