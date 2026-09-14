/** Список фонов профилей статистики: nick:filename */
(function () {
  const LIST_URL = window.STATSBGLIST_URL || "https://api.agar.su/statsbglist.txt";
  const BASE = (window.STATSBG_BASE || "https://api.agar.su/statsbg").replace(/\/$/, "");

  let bgMap = null;
  let loadPromise = null;

  function parseList(text) {
    const map = new Map();
    String(text || "")
      .split("\n")
      .forEach((line) => {
        const idx = line.indexOf(":");
        if (idx < 0) return;
        const nick = line.slice(0, idx).trim().toLowerCase();
        const file = line.slice(idx + 1).trim();
        if (nick && file) map.set(nick, file);
      });
    return map;
  }

  function lookupFile(nick) {
    if (!bgMap || !nick) return null;
    const raw = String(nick).trim();
    const lower = raw.toLowerCase();
    if (bgMap.has(lower)) return bgMap.get(lower);
    const clean = lower.replace(/\[|\]/g, "").trim();
    if (bgMap.has(clean)) return bgMap.get(clean);
    if (bgMap.has(`[${clean}]`)) return bgMap.get(`[${clean}]`);
    return null;
  }

  function urlForNick(nick) {
    const file = lookupFile(nick);
    return file ? BASE + "/" + encodeURIComponent(file) : null;
  }

  async function loadStatsBg(force) {
    if (bgMap && !force) return bgMap;
    if (loadPromise && !force) return loadPromise;
    loadPromise = fetch(LIST_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => {
        bgMap = parseList(text);
        return bgMap;
      })
      .catch(() => {
        bgMap = bgMap || new Map();
        return bgMap;
      });
    return loadPromise;
  }

  function applyBodyBackground(url) {
    if (!url) {
      document.body.classList.remove("has-stats-bg");
      document.body.style.removeProperty("--stats-bg-image");
      return;
    }
    document.body.classList.add("has-stats-bg");
    document.body.style.setProperty("--stats-bg-image", `url("${url}")`);
  }

  async function applyForNick(nick) {
    await loadStatsBg();
    applyBodyBackground(urlForNick(nick));
  }

  window.loadStatsBg = loadStatsBg;
  window.statsBgUrlForNick = urlForNick;
  window.applyStatsBodyBackground = applyBodyBackground;
  window.applyStatsBgForNick = applyForNick;
})();
