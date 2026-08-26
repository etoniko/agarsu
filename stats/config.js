/** Интервал обновления (5 мин) — как на сервере */
window.STATS_REFRESH_MS = 300000;

window.STATS_API = "https://api.agar.su/stats-api";
window.ONLINE_HUB_URL = "https://api.agar.su/online";
window.SKINLIST_URL = "https://api.agar.su/skinlist.txt";
window.SKINS_BASE = "https://api.agar.su/skins";
window.DEFAULT_SKIN_URL = "https://api.agar.su/skins/4.png";

/** Корень stats/ — через pathname, без ложных совпадений с C:/Users/ */
window.statsBaseUrl = function () {
  const u = new URL(location.href);
  const path = decodeURIComponent(u.pathname).replace(/\\/g, "/");
  const statsRoot = path.match(/^(.*\/stats\/)/i);
  u.pathname = statsRoot ? statsRoot[1] : path.replace(/\/[^/]*$/, "/");
  u.search = "";
  u.hash = "";
  const href = u.href;
  return href.endsWith("/") ? href : href + "/";
};

window.statsProfileUrl = function (id, period) {
  let url = window.statsBaseUrl() + "users/?id=" + encodeURIComponent(id);
  if (period) url += "&period=" + encodeURIComponent(period);
  return url;
};

window.statsClanProfileUrl = function (id, period) {
  let url = window.statsBaseUrl() + "clans/?id=" + encodeURIComponent(id);
  if (period) url += "&period=" + encodeURIComponent(period);
  return url;
};

window.statsServerUrl = function (id) {
  return window.statsBaseUrl() + "servers/#" + encodeURIComponent(id);
};
