import { toNum } from "./num.js";

const RANK_POINTS = [
  { from: 1, to: 1, points: 25 },
  { from: 2, to: 2, points: 15 },
  { from: 3, to: 3, points: 10 },
  { from: 4, to: 10, points: 5 },
  { from: 11, to: 15, points: 3 },
  { from: 16, to: 20, points: 2 },
  { from: 21, to: 100, points: 1 },
];

function pointsForRank(rank) {
  if (!rank || rank < 1) return 0;
  for (const row of RANK_POINTS) {
    if (rank >= row.from && rank <= row.to) return row.points;
  }
  return 0;
}

function parseNick(raw) {
  const nick = String(raw || "").trim();
  if (!nick) return { full: "", display: "", clan: null, clanKey: null, playerKey: "" };

  const m = nick.match(/^\[([^\]]+)\](.*)$/);
  if (m) {
    const clan = m[1].trim();
    const rest = (m[2] || "").trim();
    return {
      full: nick,
      display: nick,
      clan,
      clanKey: `[${clan}]`,
      playerKey: nick.toLowerCase(),
      baseNick: rest || nick,
    };
  }

  return {
    full: nick,
    display: nick,
    clan: null,
    clanKey: null,
    playerKey: nick.toLowerCase(),
    baseNick: nick,
  };
}

/**
 * Игроки и кланы — отдельные зачёты на сервере.
 * Место игрока — среди игроков без [клан].
 * Место клана — среди кланов (лучший участник клана по score).
 */
function scoreServerTop(sortedRows) {
  const seenPlayers = new Set();
  const soloRaw = [];
  const clanBestMember = new Map();

  for (const row of sortedRows) {
    const parsed = parseNick(row.nick);
    if (!parsed.playerKey) continue;
    if (seenPlayers.has(parsed.playerKey)) continue;
    seenPlayers.add(parsed.playerKey);

    const score = toNum(row.score);
    const item = { parsed, row, score };

    if (parsed.clanKey) {
      const prev = clanBestMember.get(parsed.clanKey);
      if (!prev || score > prev.score) clanBestMember.set(parsed.clanKey, item);
    } else {
      soloRaw.push(item);
    }
  }

  soloRaw.sort((a, b) => b.score - a.score);
  // Очки только топ-100; остальных храним с pts=0 для рекордов/периодов (до 10000).
  const soloScored = soloRaw.slice(0, 10000).map((item, i) => {
    const rank = i + 1;
    return { ...item, rank, pts: rank <= 100 ? pointsForRank(rank) : 0 };
  });

  const clanSorted = [...clanBestMember.entries()]
    .map(([clanKey, item]) => ({ clanKey, ...item }))
    .sort((a, b) => b.score - a.score);

  const clanBest = new Map();
  clanSorted.slice(0, 10000).forEach((item, i) => {
    const rank = i + 1;
    clanBest.set(item.clanKey, {
      rank,
      pts: rank <= 100 ? pointsForRank(rank) : 0,
      parsed: item.parsed,
      score: item.score,
    });
  });

  return { soloScored, clanBest };
}

/** Сервера, где кланы не участвуют (pvp / tournament). */
function serverDisallowsClans(server) {
  if (!server) return false;
  if (server.noClans === true) return true;
  const id = String(server.id || "").toLowerCase();
  return id.startsWith("pvp") || id.startsWith("tournament");
}

/**
 * Очки рейтинга дают все официальные сервера (FFA/MS/PVP/tournament).
 * kind=score влияет только на подпись рекорда (Масса vs Побед) и алерты в чат.
 */
function serverGivesRankPoints(server) {
  return !!server;
}

function buildSnapshotFromServers(serverResults, passRegistry) {
  const cyclePlayers = new Map();
  const cycleClans = new Map();
  const perServer = [];
  const allowPlayer = (parsed) => !passRegistry || passRegistry.isPlayerAllowed(parsed);
  const allowClan = (clanKey) => !passRegistry || passRegistry.isClanAllowed(clanKey);
  const statsPassId = (parsed) => (passRegistry ? passRegistry.resolveStatsPassId(parsed) : null);
  const clanPassId = (clanKey) => (passRegistry ? passRegistry.resolveClanPassId(clanKey) : null);

  for (const result of serverResults) {
    const noClans = serverDisallowsClans(result);
    const entry = {
      id: result.id,
      name: result.name,
      ok: result.ok,
      error: result.error || null,
      kind: result.kind || (noClans ? "score" : "mass"),
      noClans,
      players: 0,
      clans: 0,
      top: [],
      topClan: null,
    };

    if (!result.ok || !Array.isArray(result.data)) {
      perServer.push(entry);
      continue;
    }

    // Берём шире сырой список (до 10000) — в рейтинг очков всё равно top-100,
    // а bestScore/рекорды увидят больше pass-игроков.
    const sorted = [...result.data]
      .filter((p) => p && p.nick)
      .sort((a, b) => toNum(b.score) - toNum(a.score))
      .slice(0, 10000);

    const { soloScored, clanBest } = scoreServerTop(sorted);

    const soloPass = soloScored.filter((item) => allowPlayer(item.parsed));
    const clanRows = [];

    if (!noClans) {
      for (const [clanKey, best] of clanBest) {
        if (!allowClan(clanKey)) continue;
        clanRows.push({ clanKey, ...best });
      }
    }

    entry.players = soloPass.length;
    entry.clans = clanRows.length;

    entry.allSolo = soloPass.map((p) => ({
      rank: p.rank,
      nick: p.parsed.display,
      score: p.score,
      points: p.pts,
      id: statsPassId(p.parsed),
    }));

    entry.allClans = clanRows.map((c) => ({
      rank: c.rank,
      nick: c.parsed.display,
      clan: c.clanKey,
      score: c.score,
      points: c.pts,
      id: clanPassId(c.clanKey),
    }));

    entry.top = entry.allSolo.slice(0, 5);
    entry.topClan = entry.allClans[0] || null;
    entry.allScored = [...entry.allSolo, ...entry.allClans];

    for (const item of soloPass) {
      const passId = statsPassId(item.parsed);
      if (!passId) continue;

      const key = `id:${passId}`;
      const prevP = cyclePlayers.get(key) || {
        nick: item.parsed.display,
        playerKey: item.parsed.playerKey,
        id: passId,
        points: 0,
        servers: [],
        bestScore: 0,
      };
      prevP.points = toNum(prevP.points) + toNum(item.pts);
      prevP.bestScore = Math.max(toNum(prevP.bestScore), toNum(item.score));
      if (!prevP.servers.includes(result.id)) prevP.servers.push(result.id);
      prevP.nick = item.parsed.display;
      cyclePlayers.set(key, prevP);
    }

    for (const c of clanRows) {
      const clanId = clanPassId(c.clanKey);
      const key = clanId ? `id:${clanId}` : `clan:${c.clanKey}`;
      const prevC = cycleClans.get(key) || {
        clan: c.clanKey,
        id: clanId || null,
        points: 0,
        servers: [],
        bestScore: 0,
        topNick: c.parsed.display,
      };
      if (clanId) prevC.id = clanId;
      prevC.points = toNum(prevC.points) + toNum(c.pts);
      prevC.bestScore = Math.max(toNum(prevC.bestScore), toNum(c.score));
      prevC.topNick = c.parsed.display;
      if (!prevC.servers.includes(result.id)) prevC.servers.push(result.id);
      cycleClans.set(key, prevC);
    }

    perServer.push(entry);
  }

  return {
    perServer,
    players: [...cyclePlayers.values()].sort((a, b) => b.points - a.points || b.bestScore - a.bestScore),
    clans: [...cycleClans.values()].sort((a, b) => b.points - a.points || b.bestScore - a.bestScore),
  };
}

/** Рейтинг очков = только последний опрос. bestScore offline-игроков сохраняем. */
function mergeTotals(prevTotals, snapshot, cycleId) {
  const prevPlayers = prevTotals?.players || {};
  const prevClans = prevTotals?.clans || {};
  const players = {};
  const clans = {};

  for (const row of snapshot.players) {
    if (!row.id) continue;
    const key = `id:${row.id}`;
    const prev = prevPlayers[key];
    const servers = {};
    for (const sid of row.servers || []) servers[sid] = 1;
    players[key] = {
      nick: row.nick,
      playerKey: row.playerKey,
      id: row.id,
      points: toNum(row.points),
      lastPoints: toNum(row.points),
      polls: prev ? toNum(prev.polls) + 1 : 1,
      bestScore: Math.max(toNum(prev?.bestScore), toNum(row.bestScore)),
      servers,
      lastCycleAt: cycleId || null,
      active: true,
    };
  }

  // Игроки не в этом опросе: очки 0 (не в live-топе), рекорд массы/побед не теряем
  for (const [key, prev] of Object.entries(prevPlayers)) {
    if (players[key]) continue;
    if (!prev?.id) continue;
    players[key] = {
      ...prev,
      id: prev.id,
      points: 0,
      lastPoints: 0,
      bestScore: toNum(prev.bestScore),
      polls: toNum(prev.polls),
      active: false,
    };
  }

  for (const row of snapshot.clans) {
    const key = row.id ? `id:${row.id}` : `clan:${row.clan}`;
    const prev = prevClans[key];
    const servers = {};
    for (const sid of row.servers || []) servers[sid] = 1;
    clans[key] = {
      clan: row.clan,
      id: row.id || null,
      points: toNum(row.points),
      lastPoints: toNum(row.points),
      polls: prev ? toNum(prev.polls) + 1 : 1,
      bestScore: Math.max(toNum(prev?.bestScore), toNum(row.bestScore)),
      topNick: row.topNick || null,
      servers,
      lastCycleAt: cycleId || null,
      active: true,
    };
  }

  for (const [key, prev] of Object.entries(prevClans)) {
    if (clans[key]) continue;
    clans[key] = {
      ...prev,
      points: 0,
      lastPoints: 0,
      bestScore: toNum(prev.bestScore),
      polls: toNum(prev.polls),
      active: false,
    };
  }

  return { players, clans };
}

/** Схлопывает дубли по id (старые ключи playerKey + id:) */
function collapseTotalsById(totals) {
  const players = {};
  const clans = {};

  for (const [, p] of Object.entries(totals.players || {})) {
    if (!p.id) continue;
    const key = `id:${p.id}`;
    if (!players[key]) {
      players[key] = { ...p, points: toNum(p.points), polls: toNum(p.polls), bestScore: toNum(p.bestScore) };
    } else {
      const prev = players[key];
      const next = toNum(p.points) > toNum(prev.points) ? { ...p } : { ...prev };
      next.points = Math.max(toNum(prev.points), toNum(p.points));
      next.polls = Math.max(toNum(prev.polls), toNum(p.polls));
      next.bestScore = Math.max(toNum(prev.bestScore), toNum(p.bestScore));
      players[key] = next;
    }
  }

  for (const [, c] of Object.entries(totals.clans || {})) {
    const key = c.id ? `id:${c.id}` : `clan:${c.clan}`;
    if (!clans[key]) {
      clans[key] = { ...c, points: toNum(c.points), polls: toNum(c.polls), bestScore: toNum(c.bestScore) };
    } else {
      const prev = clans[key];
      if (toNum(c.points) > toNum(prev.points)) {
        clans[key] = { ...c, points: toNum(c.points), polls: toNum(c.polls), bestScore: toNum(c.bestScore) };
      }
    }
  }

  return { players, clans };
}

function sanitizeTotals(totals) {
  const collapsed = collapseTotalsById(totals);
  for (const p of Object.values(collapsed.players)) {
    p.points = toNum(p.points);
    p.polls = toNum(p.polls);
    p.bestScore = toNum(p.bestScore);
    p.lastPoints = toNum(p.lastPoints);
  }
  for (const c of Object.values(collapsed.clans)) {
    c.points = toNum(c.points);
    c.polls = toNum(c.polls);
    c.bestScore = toNum(c.bestScore);
    c.lastPoints = toNum(c.lastPoints);
  }
  return collapsed;
}

function formatLeaderboards(totals, passRegistry) {
  const allowPlayerKey = (playerKey, nick) => {
    if (!passRegistry) return true;
    return passRegistry.isPlayerAllowed({ playerKey, baseNick: nick });
  };
  const allowClanKey = (clanKey) => !passRegistry || passRegistry.isClanAllowed(clanKey);

  const players = Object.values(totals.players || {})
    .filter((p) => p.id && allowPlayerKey(p.playerKey, p.nick) && toNum(p.points) > 0)
    .map((p) => ({
      nick: p.nick,
      id: p.id,
      points: toNum(p.points),
      lastPoints: toNum(p.lastPoints),
      polls: toNum(p.polls),
      bestScore: toNum(p.bestScore),
      servers: p.servers || {},
      serverCount: Object.keys(p.servers || {}).length,
    }))
    .sort((a, b) => b.points - a.points || b.bestScore - a.bestScore);

  const clans = Object.values(totals.clans || {})
    .filter((c) => allowClanKey(c.clan) && toNum(c.points) > 0)
    .map((c) => ({
      clan: c.clan,
      id: c.id || null,
      points: toNum(c.points),
      lastPoints: toNum(c.lastPoints),
      polls: toNum(c.polls),
      bestScore: toNum(c.bestScore),
      servers: c.servers || {},
      serverCount: Object.keys(c.servers || {}).length,
    }))
    .sort((a, b) => b.points - a.points || b.bestScore - a.bestScore);

  return { players, clans };
}

function maxPointsPerPoll(serverCount) {
  const n = Math.max(0, Number(serverCount) || 0);
  return n * pointsForRank(1);
}

export {
  pointsForRank,
  maxPointsPerPoll,
  parseNick,
  scoreServerTop,
  buildSnapshotFromServers,
  mergeTotals,
  sanitizeTotals,
  formatLeaderboards,
  serverDisallowsClans,
  serverGivesRankPoints,
  RANK_POINTS,
  toNum,
};
