/** Нормализация ника — как в freekassa/public/assets/scripts/pass.js */
function normalizeNick(nick) {
  const n = String(nick || "").trim();
  if (!n) return "";

  if (n.startsWith("[")) {
    const endIndex = n.indexOf("]");
    if (endIndex === -1) return "";
    const innerNick = n.substring(1, endIndex).trim();
    if (!innerNick || innerNick !== n.substring(1, endIndex)) return "";
    return `[${innerNick}]`.toLowerCase();
  }

  if (!n || n.trim() !== n) return "";
  return n.toLowerCase();
}

function isClanNorm(norm) {
  return !!norm && norm.startsWith("[") && norm.endsWith("]");
}

function parseBanSet(banText) {
  const bannedNorms = new Set();
  for (const line of String(banText || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const norm = normalizeNick(trimmed);
    if (norm) bannedNorms.add(norm);
  }
  return bannedNorms;
}

/** ID = номер строки в pass.txt (1, 2, 3 …). Одна строка = один ник.
 *  Забаненные ники остаются в pass.txt (чтобы id не съезжали),
 *  но не попадают в allowed* и не копят очки. */
function buildPassRegistry(passText, banText = "") {
  const bannedNorms = parseBanSet(banText);
  const allowedPlayerNicks = new Set();
  const allowedClanNicks = new Set();
  const playerNickToPassId = new Map();
  const clanNickToPassId = new Map();
  const passIdToEntry = new Map();
  let lineNum = 0;

  const linkNick = (passId, rawNick) => {
    const norm = normalizeNick(rawNick);
    if (!norm) return;
    const isClan = isClanNorm(norm);
    const banned = bannedNorms.has(norm);
    const entry = { id: passId, nick: rawNick, norm, isClan, banned };
    passIdToEntry.set(passId, entry);

    if (isClan) {
      if (!clanNickToPassId.has(norm)) clanNickToPassId.set(norm, passId);
      if (!banned) allowedClanNicks.add(norm);
    } else {
      if (!playerNickToPassId.has(norm)) playerNickToPassId.set(norm, passId);
      if (!banned) allowedPlayerNicks.add(norm);
    }
  };

  for (const line of String(passText || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    lineNum += 1;
    const passId = String(lineNum);
    linkNick(passId, trimmed);
  }

  function isBannedNorm(norm) {
    return !!norm && bannedNorms.has(norm);
  }

  function isBannedPassId(passId) {
    const e = passIdToEntry.get(String(passId));
    return !!(e && e.banned);
  }

  function isBannedNick(nick) {
    return isBannedNorm(normalizeNick(nick));
  }

  function resolveClanPassId(clanKey) {
    if (!clanKey) return null;
    const clanNorm = normalizeNick(clanKey);
    const id = clanNickToPassId.get(clanNorm) || null;
    if (id && isBannedPassId(id)) return null;
    return id;
  }

  function resolveNickPassId(parsed) {
    if (!parsed || parsed.clanKey) return null;
    const norm = normalizeNick(parsed.playerKey);
    if (!norm || isClanNorm(norm)) return null;
    let id = null;
    if (playerNickToPassId.has(norm)) id = playerNickToPassId.get(norm);
    else if (parsed.baseNick) {
      const base = normalizeNick(parsed.baseNick);
      if (base && !isClanNorm(base) && playerNickToPassId.has(base)) {
        id = playerNickToPassId.get(base);
      }
    }
    if (id && isBannedPassId(id)) return null;
    return id;
  }

  /** Рекорды/очки: [клан]ник → только клан; без клана → только ник */
  function resolveStatsPassId(parsed) {
    if (!parsed) return null;
    if (parsed.clanKey) return resolveClanPassId(parsed.clanKey);
    return resolveNickPassId(parsed);
  }

  function resolvePassId(parsed) {
    return resolveStatsPassId(parsed);
  }

  function isPlayerAllowed(parsed) {
    if (!parsed || !parsed.playerKey || parsed.clanKey) return false;
    const norm = normalizeNick(parsed.playerKey);
    if (!norm || isClanNorm(norm)) return false;
    if (isBannedNorm(norm)) return false;
    return allowedPlayerNicks.has(norm);
  }

  function isClanAllowed(clanKey) {
    if (!clanKey) return false;
    const norm = normalizeNick(clanKey);
    if (isBannedNorm(norm)) return false;
    return allowedClanNicks.has(norm);
  }

  function getPassEntry(passId) {
    return passIdToEntry.get(String(passId)) || null;
  }

  function getNicksForPassId(passId) {
    const e = getPassEntry(passId);
    return e ? [e.nick] : [];
  }

  return {
    lineCount: lineNum,
    allowedCount: allowedPlayerNicks.size + allowedClanNicks.size,
    bannedCount: bannedNorms.size,
    bannedNorms,
    passIdToEntry,
    allowedNicks: new Set([...allowedPlayerNicks, ...allowedClanNicks]),
    allowedPlayerNicks,
    allowedClanNicks,
    playerNickToPassId,
    clanNickToPassId,
    nickToPassId: playerNickToPassId,
    resolvePassId,
    resolveClanPassId,
    resolveNickPassId,
    resolveStatsPassId,
    isPlayerAllowed,
    isClanAllowed,
    isBannedPassId,
    isBannedNick,
    isBannedNorm,
    getPassEntry,
    getNicksForPassId,
    resolveUid: resolvePassId,
    getNicksForUid: getNicksForPassId,
    get uidCount() {
      return passIdToEntry.size;
    },
  };
}

export {
  normalizeNick,
  isClanNorm,
  parseBanSet,
  buildPassRegistry,
};
