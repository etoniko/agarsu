/** API на api.agar.su:6009 */
window.STATS_API = "https://api.agar.su:6009";

/** Ссылка на профиль игрока (id = номер строки в pass.txt) */
window.statsProfileUrl = function (id) {
  const dir = location.href.replace(/[^/]*$/, "");
  return dir + "users/index.html?id=" + encodeURIComponent(id);
};
