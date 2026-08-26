import fs from "fs";
import path from "path";
import { toNum } from "./num.js";
import { mergeProfileRecords, normalizeServerId } from "./serverIds.js";

function safeUid(uid) {
  const s = String(uid || "").trim();
  if (!/^\d+$/.test(s)) return null;
  return s;
}

function clanDir(root, uid) {
  const safe = safeUid(uid);
  if (!safe) return null;
  return path.join(root, "clans", safe);
}

function readClanStats(root, uid) {
  const dir = clanDir(root, uid);
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

function writeClanStats(root, uid, data) {
  const dir = clanDir(root, uid);
  if (!dir) return false;
  data.points = toNum(data.points);
  data.polls = toNum(data.polls);
  data.bestScore = toNum(data.bestScore);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "stats.json"), JSON.stringify(data, null, 2), "utf8");
  return true;
}

function emptyClanStats(passId, clanName, members) {
  return {
    id: String(passId),
    uid: String(passId),
    clan: clanName || null,
    members: [...new Set(members || [])],
    points: 0,
    polls: 0,
    bestScore: 0,
    records: {},
    lastPoll: null,
    lastCycleAt: null,
    updatedAt: null,
  };
}

function updateClanFromPoll(root, uid, payload, registry) {
  const safe = safeUid(uid);
  if (!safe) return null;

  const entry = registry ? registry.getPassEntry(safe) : null;
  const clanName = entry && entry.isClan ? entry.nick : payload.clan || null;
  let stats = readClanStats(root, safe) || emptyClanStats(safe, clanName, []);

  if (payload.cycleId && stats.lastCycleAt === payload.cycleId) return stats;

  if (clanName) stats.clan = clanName;
  stats.members = [...new Set([...(stats.members || []), ...(payload.members || [])])];

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
    const sid = normalizeServerId(rec.serverId);
    if (!sid) continue;
    const score = toNum(rec.score);
    const prev = stats.records[sid];
    if (!prev || score > toNum(prev.score)) {
      stats.records[sid] = {
        serverId: sid,
        serverName: rec.serverName || sid,
        score,
        nick: rec.nick,
        clan: rec.clan || stats.clan,
        rank: rec.rank || null,
        points: toNum(rec.points),
        updatedAt: payload.at || new Date().toISOString(),
      };
    }
    stats.bestScore = Math.max(stats.bestScore, score);
  }

  stats.records = mergeProfileRecords(stats.records);
  writeClanStats(root, safe, stats);
  return stats;
}

function getOrCreateEntry(byUid, passId, pollAt) {
  if (!byUid.has(passId)) {
    byUid.set(passId, {
      uid: passId,
      clan: null,
      members: new Set(),
      pointsDelta: 0,
      bestScore: 0,
      records: [],
      lastPoll: { at: pollAt, servers: {} },
    });
  }
  return byUid.get(passId);
}

function applySnapshotToClans(root, snapshot, registry, serverMeta, pollAt, cycleId) {
  if (!registry) return;

  const byUid = new Map();

  for (const clan of snapshot.clans || []) {
    if (!clan.id) continue;
    const entry = getOrCreateEntry(byUid, clan.id, pollAt);
    entry.clan = clan.clan;
    if (clan.topNick) entry.members.add(clan.topNick);
    entry.pointsDelta = toNum(entry.pointsDelta) + toNum(clan.points);
    entry.bestScore = Math.max(toNum(entry.bestScore), toNum(clan.bestScore));
  }

  for (const srv of snapshot.perServer || []) {
    if (!srv.ok) continue;
    const meta = serverMeta.get(srv.id) || { id: srv.id, name: srv.name };

    for (const row of srv.allClans || []) {
      if (!row.id) continue;
      const entry = getOrCreateEntry(byUid, row.id, pollAt);
      entry.clan = row.clan;
      entry.members.add(row.nick);
      entry.bestScore = Math.max(toNum(entry.bestScore), toNum(row.score));
      entry.lastPoll.servers[srv.id] = {
        rank: row.rank,
        score: toNum(row.score),
        points: toNum(row.points),
        nick: row.nick,
        clan: row.clan,
        serverName: meta.name,
        type: "clan",
      };
      entry.records.push({
        serverId: srv.id,
        serverName: meta.name,
        score: toNum(row.score),
        nick: row.nick,
        clan: row.clan,
        rank: row.rank,
        points: toNum(row.points),
      });
    }
  }

  for (const [uid, data] of byUid) {
    updateClanFromPoll(
      root,
      uid,
      {
        at: pollAt,
        cycleId,
        clan: data.clan,
        members: [...data.members],
        pointsDelta: data.pointsDelta,
        bestScore: data.bestScore,
        lastPoll: data.lastPoll,
        records: data.records,
      },
      registry
    );
  }
}

export {
  safeUid,
  readClanStats,
  writeClanStats,
  updateClanFromPoll,
  applySnapshotToClans,
};
