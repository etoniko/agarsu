import { normalizeNick } from "./passlist.js";

function buildSkinRegistry(text) {
  const nickToSkinId = new Map();

  for (const line of String(text || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx < 0) continue;
    const nick = trimmed.slice(0, idx).trim();
    const skinId = trimmed.slice(idx + 1).trim();
    if (!nick || !skinId) continue;
    nickToSkinId.set(nick.toLowerCase(), skinId);
  }

  function resolveSkinId(nick) {
    if (!nick) return null;
    const raw = String(nick).trim();
    const lower = raw.toLowerCase();
    if (nickToSkinId.has(lower)) return nickToSkinId.get(lower);

    const norm = normalizeNick(raw);
    if (norm && nickToSkinId.has(norm)) return nickToSkinId.get(norm);

    const m = raw.match(/^\[[^\]]+\](.+)$/);
    if (m && m[1]) {
      const base = m[1].trim().toLowerCase();
      if (nickToSkinId.has(base)) return nickToSkinId.get(base);
    }
    return null;
  }

  function avatarUrl(nick, baseUrl) {
    const id = resolveSkinId(nick);
    if (!id || !baseUrl) return null;
    return `${baseUrl.replace(/\/$/, "")}/${id}.png`;
  }

  return { nickToSkinId, resolveSkinId, avatarUrl, count: nickToSkinId.size };
}

export { buildSkinRegistry };
