import { SKINLIST_URL, STICKERLIST_URL, STICKER_CDN } from "../config/endpoints.js";
import { normalizeNick } from "../lib/nick.js";
const TTL_MS = 3e5;
const STATIC_URLS = {
  skinlist: SKINLIST_URL,
  stickerlist: STICKERLIST_URL,
  pass: "https://api.agar.su/pass.txt",
  invisible: "https://api.agar.su/invisible.txt",
  rotation: "https://api.agar.su/rotation.txt",
  word: "/word.txt"
};
const cache = new Map();
const inflight = new Map();
const SESSION_PREFIX = "agar_static_v1:";
function sessionKey(url) {
  return SESSION_PREFIX + url;
}
function readSessionEntry(url) {
  try {
    const raw = sessionStorage.getItem(sessionKey(url));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.text !== "string" || typeof entry.at !== "number") return null;
    if (Date.now() - entry.at >= TTL_MS) {
      sessionStorage.removeItem(sessionKey(url));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}
function writeSessionEntry(url, text, at) {
  try {
    sessionStorage.setItem(sessionKey(url), JSON.stringify({ text, at }));
  } catch {
  }
}
function rememberText(url, text, at = Date.now()) {
  cache.set(url, { text, at });
  writeSessionEntry(url, text, at);
  return text;
}
function fetchStaticText(url, force = false) {
  const now = Date.now();
  const hit = cache.get(url);
  if (!force && hit && now - hit.at < TTL_MS) {
    return Promise.resolve(hit.text);
  }
  if (!force) {
    const stored = readSessionEntry(url);
    if (stored) {
      cache.set(url, stored);
      return Promise.resolve(stored.text);
    }
  }
  const pending = inflight.get(url);
  if (pending) return pending;
  const p = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
    return res.text();
  }).then((text) => rememberText(url, text, Date.now())).catch((err) => {
    console.error("fetchStaticText:", err);
    if (hit) return hit.text;
    return "";
  }).finally(() => {
    inflight.delete(url);
  });
  inflight.set(url, p);
  return p;
}
function parseSkinListText(data) {
  const map = new Map();
  const obj = {};
  String(data || "").split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx < 0) return;
    const name = normalizeNick(line.slice(0, idx).trim());
    const id = line.slice(idx + 1).trim();
    if (!name || !id) return;
    map.set(name, id);
    obj[name] = id;
  });
  return { map, obj };
}
async function loadSkinListMap(force = false) {
  const text = await fetchStaticText(STATIC_URLS.skinlist, force);
  return parseSkinListText(text);
}
function parseStickerListText(data) {
  const map = new Map();
  const obj = {};
  String(data || "").split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf(":");
    if (idx < 0) return;
    const name = normalizeNick(trimmed.slice(0, idx).trim());
    const code = trimmed.slice(idx + 1).trim();
    if (!name || !code) return;
    map.set(name, code);
    obj[name] = code;
  });
  return { map, obj };
}
async function loadStickerListMap(force = false) {
  const text = await fetchStaticText(STATIC_URLS.stickerlist, force);
  return parseStickerListText(text);
}
function applySkinListToState(S, bundle) {
  if (S && bundle?.obj) S.skinList = bundle.obj;
}
function applyStickerListToState(S, bundle) {
  if (S && bundle?.obj) S.stickerList = bundle.obj;
}
function getStickerPackCode(stickerSource, nick) {
  const key = normalizeNick(String(nick || "").replace(/<[^>]*>/g, ""));
  if (!key) return "";
  if (stickerSource instanceof Map) return stickerSource.get(key) || "";
  return stickerSource?.[key] || "";
}
function getStickerUrl(stickerSource, nick, stickerId) {
  const id = Number(stickerId);
  if (!Number.isFinite(id) || id < 1 || id > 9) return "";
  const code = getStickerPackCode(stickerSource, nick);
  // Custom pack: /stickers/{code}/1.png — default for everyone else: /stickers/1.png
  if (code) return `${STICKER_CDN}/${encodeURIComponent(code)}/${id}.png`;
  return `${STICKER_CDN}/${id}.png`;
}
function getSkinIdForNick(skinSource, nick, fallback = "PPFtwqH") {
  const key = normalizeNick(String(nick || "").replace(/<[^>]*>/g, ""));
  if (!key) return fallback;
  if (skinSource instanceof Map) return skinSource.get(key) || fallback;
  return skinSource?.[key] || fallback;
}
function getSkinUrlForNick(skinSource, nick, fallback = "4") {
  const id = getSkinIdForNick(skinSource, nick, fallback);
  return `https://api.agar.su/skins/${id}.png`;
}
function invalidateStatsRenderCaches(S) {
  if (S) S.lastStatsRenderKey = "";
}
function toLowerSet(text) {
  return new Set(
    String(text || "")
      .split("\n")
      .map((l) => l.trim().toLowerCase().replace(/ё/g, "е"))
      .filter(Boolean)
  );
}
async function loadPassData(force = false) {
  const text = await fetchStaticText(STATIC_URLS.pass, force);
  const passPlayerNickToId = new Map();
  const passClanNickToId = new Map();
  const passUsers = [];
  let lineNum = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    lineNum += 1;
    const norm = normalizeNick(trimmed);
    if (!norm) continue;
    passUsers.push(norm);
    const passId = String(lineNum);
    if (norm.startsWith("[") && norm.endsWith("]")) {
      if (!passClanNickToId.has(norm)) passClanNickToId.set(norm, passId);
    } else if (!passPlayerNickToId.has(norm)) {
      passPlayerNickToId.set(norm, passId);
    }
  }
  return { passUsers, passPlayerNickToId, passClanNickToId };
}
async function loadInvisibleSet(force = false) {
  return toLowerSet(await fetchStaticText(STATIC_URLS.invisible, force));
}
async function loadRotationSet(force = false) {
  return toLowerSet(await fetchStaticText(STATIC_URLS.rotation, force));
}
async function loadBadWordsSet(force = false) {
  return toLowerSet(await fetchStaticText(STATIC_URLS.word, force));
}
async function preloadStaticLists(force = false) {
  const [skin, sticker, pass, invisible, rotation, words] = await Promise.all([
    loadSkinListMap(force),
    loadStickerListMap(force),
    loadPassData(force),
    loadInvisibleSet(force),
    loadRotationSet(force),
    loadBadWordsSet(force)
  ]);
  return { skin, sticker, pass, invisible, rotation, words };
}
export {
  STATIC_URLS,
  TTL_MS,
  applySkinListToState,
  applyStickerListToState,
  fetchStaticText,
  getSkinIdForNick,
  getSkinUrlForNick,
  getStickerPackCode,
  getStickerUrl,
  invalidateStatsRenderCaches,
  loadBadWordsSet,
  loadInvisibleSet,
  loadPassData,
  loadRotationSet,
  loadSkinListMap,
  loadStickerListMap,
  parseSkinListText,
  parseStickerListText,
  preloadStaticLists
};