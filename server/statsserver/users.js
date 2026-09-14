import fs from "fs";
import path from "path";
import { toNum } from "./num.js";
import { mergeProfileRecords, normalizeServerId } from "./serverIds.js";

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
    if (data.records) data.records = mergeProfileRecords(data.records);
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
    scoreProgress: {},
    lastPoll: null,
    lastCycleAt: null,
    updatedAt: null,
  };
}

function isScoreKind(rec) {
  if (!rec) return false;
  if (rec.kind === "score") return true;
  const sid = String(rec.serverId || "").toLowerCase();
  return sid.startsWith("pvp") || sid.startsWith("tournament");
}

function updateUserFromPoll(root, uid, payload, registry) {
  const safe = safeUid(uid);
  if (!safe) return null;
  if (registry?.isBannedPassId?.(safe)) return null;

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
  if (!stats.scoreProgress || typeof stats.scoreProgress !== "object") stats.scoreProgress = {};

  const dayKey = payload.dayKey || null;

  for (const rec of payload.records || []) {
    const sid = normalizeServerId(rec.serverId);
    if (!sid) continue;
    const score = toNum(rec.score);
    if (score <= 0) continue;
    const prev = stats.records[sid];

    if (isScoreKind({ ...rec, serverId: sid })) {
      let prog = stats.scoreProgress[sid];
      if (!prog || (dayKey && prog.dayKey !== dayKey)) {
        // После смены дня — счётчик с нуля. После деплоя / первого касания:
        // если рекорд уже был (старый Math.max), не задваиваем сегодняшний день.
        const firstTouch = !prog;
        prog = {
          dayKey: dayKey || prog?.dayKey || null,
          counted: firstTouch && prev ? score : 0,
        };
        stats.scoreProgress[sid] = prog;
        if (firstTouch && prev) {
          prev.rank = rec.rank || prev.rank;
          prev.points = toNum(rec.points);
          prev.nick = rec.nick || prev.nick;
          prev.kind = "score";
          continue;
        }
      }
      const add = Math.max(0, score - toNum(prog.counted));
      if (add > 0) {
        const nextScore = toNum(prev?.score) + add;
        stats.records[sid] = {
          serverId: sid,
          serverName: rec.serverName || sid,
          score: nextScore,
          nick: rec.nick,
          rank: rec.rank || null,
          points: toNum(rec.points),
          kind: "score",
          updatedAt: payload.at || new Date().toISOString(),
        };
        prog.counted = score;
        if (dayKey) prog.dayKey = dayKey;
        stats.bestScore = Math.max(stats.bestScore, nextScore);
      } else if (prev) {
        prev.rank = rec.rank || prev.rank;
        prev.points = toNum(rec.points);
        prev.nick = rec.nick || prev.nick;
      }
    } else if (!prev || score > toNum(prev.score)) {
      stats.records[sid] = {
        serverId: sid,
        serverName: rec.serverName || sid,
        score,
        nick: rec.nick,
        rank: rec.rank || null,
        points: toNum(rec.points),
        kind: "mass",
        updatedAt: payload.at || new Date().toISOString(),
      };
      stats.bestScore = Math.max(stats.bestScore, score);
    }
  }

  stats.records = mergeProfileRecords(stats.records);
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

function applySnapshotToUsers(root, snapshot, registry, serverMeta, pollAt, cycleId, dayKey = null) {
  if (!registry) return;

  const byUid = new Map();

  for (const player of snapshot.players || []) {
    if (!player.id) continue;
    if (registry.isBannedPassId?.(String(player.id))) continue;
    const entry = getOrCreateEntry(byUid, player.id, pollAt);
    entry.nicks.add(player.nick);
    entry.pointsDelta = toNum(entry.pointsDelta) + toNum(player.points);
    entry.bestScore = Math.max(toNum(entry.bestScore), toNum(player.bestScore));
  }

  for (const srv of snapshot.perServer || []) {
    if (!srv.ok) continue;
    const meta = serverMeta.get(srv.id) || { id: srv.id, name: srv.name };
    const kind =
      meta.kind === "score" || srv.kind === "score" || srv.noClans
        ? "score"
        : "mass";

    for (const row of srv.allSolo || []) {
      if (!row.id) continue;
      if (registry.isBannedPassId?.(String(row.id))) continue;
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
        kind,
      });
    }
  }

  for (const [uid, data] of byUid) {
    updateUserFromPoll(
      root,
      uid,
      {
        at: pollAt,
        cycleId,
        dayKey,
        nicks: [...data.nicks],
        pointsDelta: data.pointsDelta,
        bestScore: data.bestScore,
        lastPoll: data.lastPoll,
        records: data.records,
      },
      registry
    );
  }
}

function deleteUserStats(root, uid) {
  const dir = userDir(root, uid);
  if (!dir || !fs.existsSync(dir)) return false;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export {
  safeUid,
  readUserStats,
  writeUserStats,
  deleteUserStats,
  updateUserFromPoll,
  applySnapshotToUsers,
};
