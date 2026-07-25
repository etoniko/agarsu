(function () {
  const SKINLIST_URL = window.SKINLIST_URL || "https://api.agar.su/skinlist.txt";
  const SKINS_BASE = (window.SKINS_BASE || "https://api.agar.su/skins").replace(/\/$/, "");
  const DEFAULT_SKIN = window.DEFAULT_SKIN_URL || SKINS_BASE + "/4.png";

  let skinMap = null;
  let loadPromise = null;

  function parseSkinlist(text) {
    const map = new Map();
    String(text || "")
      .split("\n")
      .forEach((line) => {
        const idx = line.indexOf(":");
        if (idx < 0) return;
        const nick = line.slice(0, idx).trim().toLowerCase();
        const id = line.slice(idx + 1).trim();
        if (nick && id) map.set(nick, id);
      });
    return map;
  }

  function lookupSkinId(nick) {
    if (!skinMap || !nick) return null;
    const raw = String(nick).trim();
    if (skinMap.has(raw.toLowerCase())) return skinMap.get(raw.toLowerCase());
    const m = raw.match(/^\[[^\]]+\](.+)$/);
    if (m && m[1]) {
      const base = m[1].trim().toLowerCase();
      if (skinMap.has(base)) return skinMap.get(base);
    }
    return null;
  }

  function skinUrlForNick(nick) {
    const id = lookupSkinId(nick);
    return id ? SKINS_BASE + "/" + id + ".png" : DEFAULT_SKIN;
  }

  function resolveAvatar(row) {
    if (!row) return DEFAULT_SKIN;
    const nicks = [];
    if (row.nick) nicks.push(row.nick);
    if (row.clan) nicks.push(row.clan);
    if (Array.isArray(row.nicks)) nicks.push(...row.nicks);
    if (Array.isArray(row.members)) nicks.push(...row.members);
    for (const n of nicks) {
      const id = lookupSkinId(n);
      if (id) return SKINS_BASE + "/" + id + ".png";
    }
    return DEFAULT_SKIN;
  }

  async function loadSkins(force) {
    if (!force && skinMap) return skinMap;
    if (!force && loadPromise) return loadPromise;
    loadPromise = fetch(SKINLIST_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("skinlist");
        return r.text();
      })
      .then((text) => {
        skinMap = parseSkinlist(text);
        return skinMap;
      })
      .catch(() => skinMap || new Map())
      .finally(() => {
        loadPromise = null;
      });
    return loadPromise;
  }

  window.statsSkins = { loadSkins, skinUrlForNick, resolveAvatar };
})();
