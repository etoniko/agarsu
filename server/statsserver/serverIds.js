/** Legacy game-server ids → current stats server ids. */
export const SERVER_ID_ALIASES = {
  ffa1: "ffa",
};

export function normalizeServerId(sid) {
  const s = String(sid || "").trim();
  return SERVER_ID_ALIASES[s] || s;
}

/** Merge duplicate profile record keys (ffa + ffa1, etc.). */
export function mergeProfileRecords(records) {
  const out = {};
  for (const [sid, rec] of Object.entries(records || {})) {
    if (!rec || typeof rec !== "object") continue;
    const ns = normalizeServerId(rec.serverId || sid);
    const score = Number(rec.score) || 0;
    const prev = out[ns];
    if (!prev || score > (Number(prev.score) || 0)) {
      out[ns] = { ...rec, serverId: ns, serverName: rec.serverName || prev?.serverName || ns };
    }
  }
  return out;
}
