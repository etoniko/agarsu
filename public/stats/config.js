/** Интервал обновления (5 мин) — как на сервере */
window.STATS_REFRESH_MS = 300000;

window.STATS_API = "https://api.agar.su:6009";
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

window.statsProfileUrl = function (id) {
  return window.statsBaseUrl() + "users/?id=" + encodeURIComponent(id);
};

window.statsClanProfileUrl = function (id) {
  return window.statsBaseUrl() + "clans/?id=" + encodeURIComponent(id);
};

window.statsServerUrl = function (id) {
  return window.statsBaseUrl() + "servers/#" + encodeURIComponent(id);
};
