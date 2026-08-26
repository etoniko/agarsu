import fs from "fs";
import path from "path";
import { toNum } from "./num.js";

function safeUid(uid) {
  const s = String(uid || "").trim();
  if (!/^\d+$/.test(s)) return null;
  return s;
}

function userDir(root, uid) {
  const safe = safeUid(uid);
  if (!safe) return null;
  return path.join(root, "users", safe);
}

function readUserStats(root, uid) {
  const dir = userDir(root, uid);
  if (!dir) return null;
  const file = path.join(dir, "stats.json");
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    data.points = toNum(data.points);
    data.polls = toNum(data.polls);
    data.bestScore = toNum(data.bestScore);
    return data;
  } catch {
    return null;
  }
}

function writeUserStats(root, uid, data) {
  const dir = userDir(root, uid);
  if (!dir) return false;
  data.points = toNum(data.points);
  data.polls = toNum(data.polls);
  data.bestScore = toNum(data.bestScore);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "stats.json"), JSON.stringify(data, null, 2), "utf8");
  return true;
}

function emptyUserStats(passId, nicks) {
  return {
    id: String(passId),
    uid: String(passId),
    nicks: [...new Set(nicks || [])],
    points: 0,
    polls: 0,
    bestScore: 0,
    records: {},
    lastPoll: null,
    lastCycleAt: null,
    updatedAt: null,
  };
}

function updateUserFromPoll(root, uid, payload, registry) {
  const safe = safeUid(uid);
  if (!safe) return null;

  const knownNicks = registry ? registry.getNicksForPassId(safe) : [];
  let stats = readUserStats(root, safe) || emptyUserStats(safe, knownNicks);

  if (payload.cycleId && stats.lastCycleAt === payload.cycleId) return stats;

  stats.nicks = [...new Set([...(stats.nicks || []), ...knownNicks, ...(payload.nicks || [])])];

  const delta = toNum(payload.pointsDelta);
  stats.points = delta;
  if (delta !== 0 || payload.cycleId) {
    stats.polls = toNum(stats.polls) + 1;
  }

  stats.bestScore = Math.max(toNum(stats.bestScore), toNum(payload.bestScore));
  stats.updatedAt = payload.at || new Date().toISOString();
  if (payload.cycleId) stats.lastCycleAt = payload.cycleId;
  if (payload.lastPoll) stats.lastPoll = payload.lastPoll;

  for (const rec of payload.records || []) {
    const sid = rec.serverId;
    if (!sid) continue;
    const score = toNum(rec.score);
    const prev = stats.records[sid];
    if (!prev || score > toNum(prev.score)) {
      stats.records[sid] = {
        serverId: sid,
        serverName: rec.serverName || sid,
        score,
        nick: rec.nick,
        rank: rec.rank || null,
        points: toNum(rec.points),
        updatedAt: payload.at || new Date().toISOString(),
      };
    }
    stats.bestScore = Math.max(stats.bestScore, score);
  }

  writeUserStats(root, safe, stats);
  return stats;
}

function getOrCreateEntry(byUid, passId, pollAt) {
  if (!byUid.has(passId)) {
    byUid.set(passId, {
      uid: passId,
      nicks: new Set(),
      pointsDelta: 0,
      bestScore: 0,
      records: [],
      lastPoll: { at: pollAt, servers: {} },
    });
  }
  return byUid.get(passId);
}

function applySnapshotToUsers(root, snapshot, registry, serverMeta, pollAt, cycleId) {
  if (!registry) return;

  const byUid = new Map();

  for (const player of snapshot.players || []) {
    if (!player.id) continue;
    const entry = getOrCreateEntry(byUid, player.id, pollAt);
    entry.nicks.add(player.nick);
    entry.pointsDelta = toNum(entry.pointsDelta) + toNum(player.points);
    entry.bestScore = Math.max(toNum(entry.bestScore), toNum(player.bestScore));
  }

  for (const srv of snapshot.perServer || []) {
    if (!srv.ok) continue;
    const meta = serverMeta.get(srv.id) || { id: srv.id, name: srv.name };

    for (const row of srv.allSolo || []) {
      if (!row.id) continue;
      const entry = getOrCreateEntry(byUid, row.id, pollAt);
      entry.nicks.add(row.nick);
      entry.bestScore = Math.max(toNum(entry.bestScore), toNum(row.score));
      entry.lastPoll.servers[srv.id] = {
        rank: row.rank,
        score: toNum(row.score),
        points: toNum(row.points),
        nick: row.nick,
        serverName: meta.name,
        type: "player",
      };
      entry.records.push({
        serverId: srv.id,
        serverName: meta.name,
        score: toNum(row.score),
        nick: row.nick,
        rank: row.rank,
        points: toNum(row.points),
      });
    }

  }

  for (const [uid, data] of byUid) {
    updateUserFromPoll(root, uid, {
      at: pollAt,
      cycleId,
      nicks: [...data.nicks],
      pointsDelta: data.pointsDelta,
      bestScore: data.bestScore,
      lastPoll: data.lastPoll,
      records: data.records,
    }, registry);
  }
}

export {
  safeUid,
  readUserStats,
  writeUserStats,
  updateUserFromPoll,
  applySnapshotToUsers,
};
