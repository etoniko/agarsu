import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { toNum } from "./num.js";
import { mergeProfileRecords } from "./serverIds.js";
import { formatLeaderboards, sanitizeTotals, pointsForRank } from "./scoring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PERIODS_PATH = path.join(DATA_DIR, "periods.json");
const FEED_PATH = path.join(DATA_DIR, "records-feed.json");
const TOTALS_PATH = path.join(DATA_DIR, "totals.json");
const CONFIG_PATH = path.join(ROOT, "servers.json");
const USERS_DIR = path.join(ROOT, "users");
const CLANS_DIR = path.join(ROOT, "clans");

const TZ = "Europe/Moscow";
const MAX_STORED = 10000;
const FEED_MAX = 80;

const PERIOD_KEYS = ["today", "yesterday", "year", "alltime"];

function officialServerIds() {
  const cfg = readJson(CONFIG_PATH, { servers: [] });
  return new Set((cfg.servers || []).map((s) => s.id).filter(Boolean));
}

/**
 * Полная пересборка alltime-рекордов из профилей:
 * - serverBoards.*.alltime (масса на FFA/MS, победы на pvp/tournament)
 * - alltime.players/clans.bestScore (глобальный рекорд)
 * Очки (points) не трогаем — они из опросов FFA/MS.
 */
function rebuildAlltimeRecordsFromProfiles(state) {
  const allowed = officialServerIds();
  if (!allowed.size) return state;

  state.alltime = state.alltime || emptyBucket();
  state.alltime.players = state.alltime.players || {};
  state.alltime.clans = state.alltime.clans || {};

  function ingestDir(baseDir, isClan) {
    if (!fs.existsSync(baseDir)) return;
    let ids = [];
    try {
      ids = fs.readdirSync(baseDir);
    } catch {
      return;
    }
    for (const id of ids) {
      const file = path.join(baseDir, id, "stats.json");
      let stats;
      try {
        stats = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        continue;
      }
      const passId = String(stats.id || stats.uid || id);
      const records = stats && stats.records && typeof stats.records === "object" ? stats.records : {};
      const fallbackNick = isClan
        ? stats.clan || (Array.isArray(stats.members) ? stats.members[0] : null)
        : Array.isArray(stats.nicks) && stats.nicks[0]
          ? stats.nicks[0]
          : null;

      // Глобальный bestScore профиля
      const profileBest = toNum(stats.bestScore);
      if (isClan) {
        const key = `id:${passId}`;
        const prev = state.alltime.clans[key];
        const clanName = stats.clan || fallbackNick;
        if (clanName && profileBest > 0) {
          state.alltime.clans[key] = {
            ...(prev || {}),
            id: passId,
            clan: clanName,
            topNick: fallbackNick || prev?.topNick || null,
            points: toNum(prev?.points),
            lastPoints: toNum(prev?.lastPoints),
            polls: toNum(prev?.polls),
            bestScore: Math.max(toNum(prev?.bestScore), profileBest),
            servers: { ...(prev?.servers || {}) },
          };
        }
      } else {
        const key = `id:${passId}`;
        const prev = state.alltime.players[key];
        const nick = fallbackNick || prev?.nick;
        if (nick && profileBest > 0) {
          state.alltime.players[key] = {
            ...(prev || {}),
            id: passId,
            nick,
            playerKey: String(nick).toLowerCase(),
            points: toNum(prev?.points),
            lastPoints: toNum(prev?.lastPoints),
            polls: toNum(prev?.polls),
            bestScore: Math.max(toNum(prev?.bestScore), profileBest),
            servers: { ...(prev?.servers || {}) },
          };
        }
      }

      for (const [sid, rec] of Object.entries(records)) {
        if (!allowed.has(sid) || !rec) continue;
        const nick = rec.nick || fallbackNick;
        const score = toNum(rec.score);
        if (!nick || score <= 0) continue;
        const board = ensureServerBoard(state, sid);
        upsertServerRecord(
          board.alltime,
          {
            nick,
            score,
            id: passId,
            clan: isClan ? stats.clan || nick : null,
          },
          rec.updatedAt || null
        );
        // отметим сервер в alltime-бакете
        if (isClan) {
          const key = `id:${passId}`;
          if (state.alltime.clans[key]) {
            state.alltime.clans[key].servers = {
              ...(state.alltime.clans[key].servers || {}),
              [sid]: 1,
            };
            state.alltime.clans[key].bestScore = Math.max(
              toNum(state.alltime.clans[key].bestScore),
              score
            );
          }
        } else {
          const key = `id:${passId}`;
          if (state.alltime.players[key]) {
            state.alltime.players[key].servers = {
              ...(state.alltime.players[key].servers || {}),
              [sid]: 1,
            };
            state.alltime.players[key].bestScore = Math.max(
              toNum(state.alltime.players[key].bestScore),
              score
            );
          }
        }
      }
    }
  }

  ingestDir(USERS_DIR, false);
  ingestDir(CLANS_DIR, true);

  for (const board of Object.values(state.serverBoards || {})) {
    const entries = Object.entries(board.alltime || {})
      .sort((a, b) => toNum(b[1].score) - toNum(a[1].score))
      .slice(0, MAX_STORED);
    board.alltime = Object.fromEntries(entries);
  }

  return state;
}

/** @deprecated use rebuildAlltimeRecordsFromProfiles */
function seedServerBoardsAlltimeFromProfiles(state) {
  return rebuildAlltimeRecordsFromProfiles(state);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function partsInTz(date = new Date(), timeZone = TZ) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    yearKey: parts.year,
  };
}

function emptyBucket() {
  return { players: {}, clans: {} };
}

function emptyPeriodsState() {
  return {
    tz: TZ,
    dayKey: partsInTz().dayKey,
    yearKey: partsInTz().yearKey,
    bootstrapDone: false,
    suppressNotifyUntil: null,
    today: emptyBucket(),
    yesterday: emptyBucket(),
    year: emptyBucket(),
    alltime: emptyBucket(),
    // Рекорды по каждому серверу (для экрана смерти / server page)
    serverBoards: {},
    best: {
      todayByServer: {},
      year: null,
      alltime: null,
    },
  };
}

function emptyServerPeriodBag() {
  return { today: {}, yesterday: {}, year: {}, alltime: {} };
}

function ensureServerBoard(state, serverId) {
  if (!state.serverBoards) state.serverBoards = {};
  if (!state.serverBoards[serverId]) state.serverBoards[serverId] = emptyServerPeriodBag();
  const board = state.serverBoards[serverId];
  for (const k of PERIOD_KEYS) {
    if (!board[k] || typeof board[k] !== "object") board[k] = {};
  }
  return board;
}

function upsertServerRecord(map, row, pollAt) {
  if (!row || !row.nick) return;
  const score = toNum(row.score);
  if (score <= 0) return;
  const nickKey = String(row.nick).trim().toLowerCase();
  const key = row.id ? `id:${row.id}` : `nick:${nickKey}`;
  const prev = map[key];
  if (prev && toNum(prev.score) >= score) return;
  map[key] = {
    nick: row.nick,
    score,
    id: row.id || null,
    clan: row.clan || null,
    time: pollAt,
  };
  // Один игрок — одна строка: убираем дубль по nick, если уже есть id
  if (row.id) {
    const staleNickKey = `nick:${nickKey}`;
    if (staleNickKey !== key && map[staleNickKey]) delete map[staleNickKey];
  }
}

/** Схлопывает id:* и nick:* для одного passId / ника на доске сервера. */
function dedupeBoardRows(rows) {
  const byId = new Map();
  const nickOnly = [];
  for (const row of rows || []) {
    if (!row || !row.nick || toNum(row.score) <= 0) continue;
    if (row.id) {
      const id = String(row.id);
      const prev = byId.get(id);
      if (!prev || toNum(row.score) > toNum(prev.score)) byId.set(id, row);
    } else {
      nickOnly.push(row);
    }
  }
  const out = [...byId.values()];
  const usedNicks = new Set(out.map((r) => String(r.nick).trim().toLowerCase()));
  for (const row of nickOnly) {
    const nk = String(row.nick).trim().toLowerCase();
    if (usedNicks.has(nk)) continue;
    out.push(row);
    usedNicks.add(nk);
  }
  return out;
}

function dedupeBoardMap(map) {
  return Object.fromEntries(
    dedupeBoardRows(Object.values(map || {}))
      .sort((a, b) => toNum(b.score) - toNum(a.score))
      .map((row) => {
        const nickKey = String(row.nick).trim().toLowerCase();
        const key = row.id ? `id:${row.id}` : `nick:${nickKey}`;
        return [key, row];
      })
  );
}

function dedupeScoreRankingRows(list) {
  const byNick = new Map();
  for (const row of list || []) {
    const nk = String(row.nick || "").trim().toLowerCase();
    if (!nk) continue;
    const prev = byNick.get(nk);
    if (!prev) {
      byNick.set(nk, row);
      continue;
    }
    const prevScore = toNum(prev.bestScore);
    const nextScore = toNum(row.bestScore);
    let keep = prev;
    if (nextScore > prevScore) keep = row;
    else if (nextScore === prevScore && row.id && !prev.id) keep = row;
    keep = { ...keep };
    keep.servers = { ...(prev.servers || {}), ...(row.servers || {}) };
    keep.serverCount = Object.keys(keep.servers).length;
    keep.bestScore = Math.max(prevScore, nextScore);
    if (!keep.id && row.id) keep.id = row.id;
    byNick.set(nk, keep);
  }
  return [...byNick.values()];
}

function updateServerBoardsFromSnapshot(state, snapshot, pollAt) {
  for (const srv of snapshot.perServer || []) {
    if (!srv.ok) continue;
    const board = ensureServerBoard(state, srv.id);
    for (const row of srv.allSolo || []) {
      upsertServerRecord(board.today, row, pollAt);
      upsertServerRecord(board.year, row, pollAt);
      upsertServerRecord(board.alltime, row, pollAt);
    }
    if (!srv.noClans) {
      for (const row of srv.allClans || []) {
        const clanRow = {
          nick: row.nick || row.clan,
          score: row.score,
          id: row.id,
          clan: row.clan,
        };
        upsertServerRecord(board.today, clanRow, pollAt);
        upsertServerRecord(board.year, clanRow, pollAt);
        upsertServerRecord(board.alltime, clanRow, pollAt);
      }
    }
    // trim each map to MAX_STORED
    for (const period of ["today", "year", "alltime"]) {
      const entries = Object.entries(board[period] || {})
        .sort((a, b) => toNum(b[1].score) - toNum(a[1].score))
        .slice(0, MAX_STORED);
      board[period] = Object.fromEntries(entries);
    }
  }
}

function isClanBoardRow(row) {
  if (!row || !row.nick) return false;
  if (row.clan) return true;
  return String(row.nick).trim().startsWith("[");
}

function formatServerPeriodBoard(state, serverId, period, limit = 100) {
  const p = PERIOD_KEYS.includes(period) ? period : "today";
  const board = ensureServerBoard(state, serverId);
  const lim = Math.min(MAX_STORED, Math.max(1, Number(limit) || 100));
  // Рекорды игроков за период (без клановых строк) + очки за место
  return dedupeBoardRows(Object.values(board[p] || {}))
    .filter((row) => row && row.nick && !isClanBoardRow(row))
    .sort((a, b) => toNum(b.score) - toNum(a.score))
    .slice(0, lim)
    .map((row, i) => {
      const rank = i + 1;
      return {
        rank,
        nick: row.nick,
        score: toNum(row.score),
        points: rank <= 100 ? pointsForRank(rank) : 0,
        id: row.id || null,
        clan: null,
        time: row.time || null,
      };
    });
}

function formatServerPeriodClans(state, serverId, period, limit = 100) {
  const p = PERIOD_KEYS.includes(period) ? period : "today";
  const board = ensureServerBoard(state, serverId);
  const lim = Math.min(MAX_STORED, Math.max(1, Number(limit) || 100));
  return dedupeBoardRows(Object.values(board[p] || {}))
    .filter((row) => row && isClanBoardRow(row))
    .sort((a, b) => toNum(b.score) - toNum(a.score))
    .slice(0, lim)
    .map((row, i) => {
      const rank = i + 1;
      const clan = row.clan || String(row.nick || "").trim();
      return {
        rank,
        clan,
        nick: row.nick,
        score: toNum(row.score),
        points: rank <= 100 ? pointsForRank(rank) : 0,
        id: row.id || null,
        time: row.time || null,
      };
    });
}

/** Сводка по серверам за период (топ игрок / топ клан) для главной stats. */
function formatServersPeriodOverview(state, period, configServers, liveSnaps = []) {
  const p = PERIOD_KEYS.includes(period) ? period : "alltime";
  const snapById = new Map((liveSnaps || []).map((s) => [s.id, s]));
  return (configServers || []).map((meta) => {
    const snap = snapById.get(meta.id);
    const players = formatServerPeriodBoard(state, meta.id, p, 10000);
    const clans = formatServerPeriodClans(state, meta.id, p, 10000);
    const topPlayer = players[0] || null;
    const topClanRow = clans[0] || null;
    return {
      id: meta.id,
      name: meta.name,
      ok: snap ? !!snap.ok : false,
      error: snap?.error || null,
      kind: meta.kind === "score" ? "score" : "mass",
      noClans:
        !!meta.noClans ||
        String(meta.id || "").startsWith("pvp") ||
        String(meta.id || "").startsWith("tournament"),
      players: players.length,
      clans: clans.length,
      top: topPlayer
        ? [
            {
              rank: topPlayer.rank,
              nick: topPlayer.nick,
              score: topPlayer.score,
              points: topPlayer.points,
              id: topPlayer.id,
            },
          ]
        : [],
      topClan: topClanRow
        ? {
            rank: topClanRow.rank,
            clan: topClanRow.clan,
            nick: topClanRow.nick,
            score: topClanRow.score,
            points: topClanRow.points,
            id: topClanRow.id,
          }
        : null,
    };
  });
}

function getEntityPeriodStats(state, passId, isClan, period, metric = "points") {
  const p = PERIOD_KEYS.includes(period) ? period : "alltime";
  const m = metric === "score" ? "score" : "points";
  const boards = formatPeriodRankings(state, p, null, MAX_STORED, m);
  const list = isClan ? boards.clans : boards.players;
  const idx = list.findIndex((r) => String(r.id) === String(passId));

  // Лучший рекорд за период — max по serverBoards (масса/победы)
  let boardBest = 0;
  for (const board of Object.values(state.serverBoards || {})) {
    const map = board?.[p] || {};
    const row =
      map[`id:${passId}`] ||
      Object.values(map).find((r) => String(r.id) === String(passId));
    if (!row) continue;
    if (isClan) {
      if (!(row.clan || String(row.nick || "").trim().startsWith("["))) continue;
    } else if (row.clan || String(row.nick || "").trim().startsWith("[")) {
      continue;
    }
    boardBest = Math.max(boardBest, toNum(row.score));
  }

  if (idx < 0) {
    return {
      period: p,
      metric: m,
      points: 0,
      bestScore: boardBest,
      globalRank: null,
      globalRankTotal: list.length,
      rankBoard: isClan ? "clans" : "players",
    };
  }
  const row = list[idx];
  return {
    period: p,
    metric: m,
    points: toNum(row.points),
    bestScore: Math.max(toNum(row.bestScore), boardBest),
    globalRank: idx + 1,
    globalRankTotal: list.length,
    rankBoard: isClan ? "clans" : "players",
    nick: row.nick || row.clan || null,
  };
}

/**
 * Рекорды игрока/клана по каждому серверу за период.
 * Всегда возвращает полный список официальных серверов (есть / нет).
 */
function getEntityPeriodRecords(state, passId, isClan, period, serversMeta = []) {
  const p = PERIOD_KEYS.includes(period) ? period : "alltime";
  const out = {};

  for (const meta of serversMeta) {
    if (!meta?.id) continue;
    const sid = meta.id;
    const kind = meta.kind === "score" ? "score" : "mass";
    const board = ensureServerBoard(state, sid);
    const map = board[p] || {};
    const candidates = Object.values(map).filter((r) => String(r.id) === String(passId));
    let row = null;
    if (isClan) {
      row =
        candidates.find((r) => r.clan || String(r.nick || "").trim().startsWith("[")) ||
        candidates[0] ||
        null;
    } else {
      row =
        candidates.find((r) => !r.clan && !String(r.nick || "").trim().startsWith("[")) ||
        null;
    }

    const soloSorted = Object.values(map)
      .filter((r) => {
        if (!r || toNum(r.score) <= 0) return false;
        const clanish = !!(r.clan || String(r.nick || "").trim().startsWith("["));
        return isClan ? clanish : !clanish;
      })
      .sort((a, b) => toNum(b.score) - toNum(a.score));
    const rank = row
      ? soloSorted.findIndex((r) => String(r.id) === String(passId)) + 1
      : null;

    out[sid] = {
      serverId: sid,
      serverName: meta.name || sid,
      kind,
      scoreLabel: kind === "score" ? "Побед" : "Масса",
      score: row ? toNum(row.score) : 0,
      nick: row?.nick || null,
      clan: row?.clan || null,
      rank: rank > 0 ? rank : null,
      updatedAt: row?.time || null,
      hasRecord: !!(row && toNum(row.score) > 0),
      period: p,
    };
  }

  return out;
}

function trimBucket(bucket, limit = MAX_STORED) {
  const out = { players: {}, clans: {} };
  const players = Object.values(bucket.players || {})
    .sort((a, b) => toNum(b.points) - toNum(a.points) || toNum(b.bestScore) - toNum(a.bestScore))
    .slice(0, limit);
  const clans = Object.values(bucket.clans || {})
    .sort((a, b) => toNum(b.points) - toNum(a.points) || toNum(b.bestScore) - toNum(a.bestScore))
    .slice(0, limit);
  for (const p of players) out.players[`id:${p.id}`] = p;
  for (const c of clans) {
    const key = c.id ? `id:${c.id}` : `clan:${c.clan}`;
    out.clans[key] = c;
  }
  return out;
}

function mergeEntity(prev, row, pollAt, mode = "period") {
  const servers = { ...(prev?.servers || {}) };
  for (const sid of row.servers || []) servers[sid] = 1;
  const incomingPts = toNum(row.points);
  // Очки рейтинга = места на serverBoards, не сумма опросов.
  // Здесь только служебный снимок (lastPoints / bestScore); в топ не идёт.
  return {
    ...(prev || {}),
    nick: row.nick || prev?.nick,
    playerKey: row.playerKey || prev?.playerKey,
    id: row.id || prev?.id,
    clan: row.clan || prev?.clan,
    topNick: row.topNick || prev?.topNick,
    points: incomingPts,
    lastPoints: incomingPts,
    polls: prev ? toNum(prev.polls) + 1 : 1,
    bestScore: Math.max(toNum(prev?.bestScore), toNum(row.bestScore)),
    servers,
    lastCycleAt: pollAt,
  };
}

function applySnapshotToBucket(bucket, snapshot, pollAt, mode = "period") {
  const next = {
    players: { ...(bucket.players || {}) },
    clans: { ...(bucket.clans || {}) },
  };

  for (const row of snapshot.players || []) {
    if (!row.id) continue;
    const key = `id:${row.id}`;
    next.players[key] = mergeEntity(next.players[key], row, pollAt, mode);
  }
  for (const row of snapshot.clans || []) {
    const key = row.id ? `id:${row.id}` : `clan:${row.clan}`;
    next.clans[key] = mergeEntity(next.clans[key], row, pollAt, mode);
  }
  return trimBucket(next);
}

function loadFeed() {
  const data = readJson(FEED_PATH, { events: [] });
  return Array.isArray(data.events) ? data.events : [];
}

function saveFeed(events) {
  writeJson(FEED_PATH, { updatedAt: new Date().toISOString(), events: events.slice(-FEED_MAX) });
}

function formatScore(n) {
  return String(Math.round(toNum(n))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function buildMessages(event) {
  const nick = event.nick;
  const score = formatScore(event.score);
  const serverName = event.serverName || event.server || "сервере";
  const periods = event.periods || [];
  const msgs = [];

  const hasYear = periods.includes("year");
  const hasAll = periods.includes("alltime");
  const hasToday = periods.includes("today");

  if (hasYear && hasAll) {
    msgs.push({
      scope: "global",
      text: `Внимание! На сервере ${serverName} игроком ${nick} был установлен новый рекорд года и за всё время — ${score}! Поздравляем!`,
    });
  } else if (hasAll) {
    msgs.push({
      scope: "global",
      text: `Внимание! На сервере ${serverName} игроком ${nick} был установлен новый рекорд за всё время — ${score}! Поздравляем!`,
    });
  } else if (hasYear) {
    msgs.push({
      scope: "global",
      text: `Внимание! На сервере ${serverName} игроком ${nick} был установлен новый рекорд года — ${score}! Поздравляем!`,
    });
  }

  if (hasToday) {
    msgs.push({
      scope: "server",
      server: event.server,
      text: `Новый рекорд дня: ${nick} — ${score}! Поздравляем!`,
    });
  }

  return msgs;
}

function pushFeedEvent(events, event) {
  const messages = buildMessages(event);
  if (!messages.length) return events;
  const full = {
    ...event,
    id: `${event.at}-${event.server}-${event.nickKey || "x"}-${(event.periods || []).join(".")}`,
    messages,
  };
  const next = events.filter((e) => e.id !== full.id);
  next.push(full);
  return next.slice(-FEED_MAX);
}

/**
 * Ищем абсолютный лучший score среди solo с паролем на каждом mass-сервере.
 * PVP / tournament пропускаем — победы скачут каждый матч, рекорды не анонсируем.
 */
function findServerBests(snapshot) {
  const byServer = {};
  for (const srv of snapshot.perServer || []) {
    if (!srv.ok) continue;
    const id = String(srv.id || "").toLowerCase();
    if (srv.kind === "score" || srv.noClans === true || id.startsWith("pvp") || id.startsWith("tournament")) {
      continue;
    }
    let best = null;
    for (const row of srv.allSolo || []) {
      if (!row.id || !row.nick) continue;
      const score = toNum(row.score);
      if (!best || score > best.score) {
        best = {
          nick: row.nick,
          nickKey: String(row.nick).trim().toLowerCase(),
          score,
          passId: row.id,
          server: srv.id,
          serverName: srv.name,
        };
      }
    }
    if (best) byServer[srv.id] = best;
  }
  return byServer;
}

function betterThan(prev, cand) {
  if (!cand) return false;
  if (!prev) return true;
  return toNum(cand.score) > toNum(prev.score);
}

function rotatePeriodsIfNeeded(state, now = new Date()) {
  const { dayKey, yearKey } = partsInTz(now);
  let changed = false;

  if (state.dayKey !== dayKey) {
    state.yesterday = trimBucket(state.today || emptyBucket());
    state.today = emptyBucket();
    state.best.todayByServer = {};
    if (state.serverBoards) {
      for (const board of Object.values(state.serverBoards)) {
        board.yesterday = { ...(board.today || {}) };
        board.today = {};
      }
    }
    state.dayKey = dayKey;
    changed = true;
  }

  if (state.yearKey !== yearKey) {
    state.year = emptyBucket();
    state.best.year = null;
    if (state.serverBoards) {
      for (const board of Object.values(state.serverBoards)) {
        board.year = {};
      }
    }
    state.yearKey = yearKey;
    changed = true;
  }

  return changed;
}

function seedAlltimeFromTotals(state) {
  const totals = sanitizeTotals(readJson(TOTALS_PATH, { players: {}, clans: {} }));
  state.alltime = trimBucket(totals);
  state.today = emptyBucket();
  state.yesterday = emptyBucket();
  state.year = emptyBucket();
  state.best.todayByServer = {};
  state.serverBoards = state.serverBoards || {};
  // today/year серверных досок стартуют пустыми; alltime наполнится с poll
  for (const board of Object.values(state.serverBoards)) {
    board.today = {};
    board.yesterday = {};
    board.year = {};
    if (!board.alltime) board.alltime = {};
  }
  state.best.year = null;

  let best = null;
  for (const p of Object.values(state.alltime.players || {})) {
    const score = toNum(p.bestScore);
    if (!best || score > best.score) {
      best = {
        nick: p.nick,
        nickKey: String(p.nick || "").trim().toLowerCase(),
        score,
        passId: p.id,
        server: Object.keys(p.servers || {})[0] || null,
        serverName: null,
      };
    }
  }
  state.best.alltime = best;
  state.bootstrapDone = true;
  // Не спамить чат при первом запуске / переносе в alltime
  state.suppressNotifyUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  return state;
}

function loadPeriodsState() {
  let state = readJson(PERIODS_PATH, null);
  if (!state || typeof state !== "object") {
    state = emptyPeriodsState();
    state = seedAlltimeFromTotals(state);
    writeJson(PERIODS_PATH, state);
    return state;
  }

  for (const k of PERIOD_KEYS) {
    if (!state[k]) state[k] = emptyBucket();
  }
  if (!state.best) state.best = { todayByServer: {}, year: null, alltime: null };
  if (!state.best.todayByServer) state.best.todayByServer = {};
  if (!state.serverBoards) state.serverBoards = {};
  if (!state.tz) state.tz = TZ;

  if (!state.bootstrapDone) {
    state = seedAlltimeFromTotals(state);
  }
  state = migrateRecordsLogic(state);
  writeJson(PERIODS_PATH, state);

  return state;
}

function savePeriodsState(state) {
  writeJson(PERIODS_PATH, state);
}

/**
 * Обновляет периоды после poll и возвращает новые события рекордов.
 */
function updatePeriodsFromSnapshot(state, snapshot, pollAt) {
  rotatePeriodsIfNeeded(state);

  state.today = applySnapshotToBucket(state.today, snapshot, pollAt, "period");
  state.year = applySnapshotToBucket(state.year, snapshot, pollAt, "period");
  state.alltime = applySnapshotToBucket(state.alltime, snapshot, pollAt, "alltime");
  updateServerBoardsFromSnapshot(state, snapshot, pollAt);

  const serverBests = findServerBests(snapshot);
  let events = loadFeed();
  const suppress =
    state.suppressNotifyUntil && new Date(pollAt) < new Date(state.suppressNotifyUntil);

  // Глобальный лучший среди серверов в этом poll
  let pollGlobal = null;
  for (const cand of Object.values(serverBests)) {
    if (!pollGlobal || cand.score > pollGlobal.score) pollGlobal = cand;
  }

  const broken = {
    today: [],
    year: false,
    alltime: false,
  };

  for (const [serverId, cand] of Object.entries(serverBests)) {
    const prev = state.best.todayByServer[serverId];
    if (betterThan(prev, cand)) {
      state.best.todayByServer[serverId] = { ...cand };
      broken.today.push(cand);
    }
  }

  if (betterThan(state.best.year, pollGlobal)) {
    state.best.year = { ...pollGlobal };
    broken.year = true;
  }
  if (betterThan(state.best.alltime, pollGlobal)) {
    state.best.alltime = { ...pollGlobal };
    broken.alltime = true;
  }

  if (!suppress) {
    // События: группируем по нику+серверу
    const byKey = new Map();

    for (const cand of broken.today) {
      const key = `${cand.server}|${cand.nickKey}`;
      const ev = byKey.get(key) || {
        at: pollAt,
        nick: cand.nick,
        nickKey: cand.nickKey,
        score: cand.score,
        passId: cand.passId,
        server: cand.server,
        serverName: cand.serverName,
        periods: [],
      };
      if (!ev.periods.includes("today")) ev.periods.push("today");
      ev.score = Math.max(ev.score, cand.score);
      byKey.set(key, ev);
    }

    if (broken.year && pollGlobal) {
      const key = `${pollGlobal.server}|${pollGlobal.nickKey}`;
      const ev = byKey.get(key) || {
        at: pollAt,
        nick: pollGlobal.nick,
        nickKey: pollGlobal.nickKey,
        score: pollGlobal.score,
        passId: pollGlobal.passId,
        server: pollGlobal.server,
        serverName: pollGlobal.serverName,
        periods: [],
      };
      if (!ev.periods.includes("year")) ev.periods.push("year");
      ev.score = Math.max(ev.score, pollGlobal.score);
      byKey.set(key, ev);
    }

    if (broken.alltime && pollGlobal) {
      const key = `${pollGlobal.server}|${pollGlobal.nickKey}`;
      const ev = byKey.get(key) || {
        at: pollAt,
        nick: pollGlobal.nick,
        nickKey: pollGlobal.nickKey,
        score: pollGlobal.score,
        passId: pollGlobal.passId,
        server: pollGlobal.server,
        serverName: pollGlobal.serverName,
        periods: [],
      };
      if (!ev.periods.includes("alltime")) ev.periods.push("alltime");
      ev.score = Math.max(ev.score, pollGlobal.score);
      byKey.set(key, ev);
    }

    for (const ev of byKey.values()) {
      events = pushFeedEvent(events, ev);
    }
    saveFeed(events);
  }

  savePeriodsState(state);
  return { state, events, broken };
}

function getPeriodBucket(state, period) {
  const key = PERIOD_KEYS.includes(period) ? period : "alltime";
  return state[key] || emptyBucket();
}

/**
 * Глобальный топ по рекорду (массе/score) из serverBoards за период.
 * Для alltime дополнительно подмешиваем bestScore из alltime-бакета (история до очистки GS).
 */
function formatScoreRankings(state, period, limit = 100) {
  const p = PERIOD_KEYS.includes(period) ? period : "alltime";
  const byKey = new Map();

  function upsert(row, serverId) {
    if (!row || !row.nick) return;
    const score = toNum(row.score ?? row.bestScore);
    if (score <= 0) return;
    const id = row.id || null;
    const key = id ? `id:${id}` : `nick:${String(row.nick).trim().toLowerCase()}`;
    const prev = byKey.get(key);
    const servers = { ...(prev?.servers || {}) };
    if (serverId) servers[serverId] = 1;
    if (!prev || score > toNum(prev.bestScore)) {
      byKey.set(key, {
        nick: row.nick,
        id,
        points: toNum(prev?.points),
        lastPoints: toNum(prev?.lastPoints),
        polls: toNum(prev?.polls),
        bestScore: score,
        servers,
        serverCount: Object.keys(servers).length,
      });
    } else {
      prev.servers = servers;
      prev.serverCount = Object.keys(servers).length;
      byKey.set(key, prev);
    }
  }

  for (const [serverId, board] of Object.entries(state.serverBoards || {})) {
    for (const row of Object.values(board?.[p] || {})) {
      upsert(row, serverId);
    }
  }

  if (p === "alltime") {
    for (const row of Object.values(state.alltime?.players || {})) {
      upsert({ nick: row.nick, id: row.id, score: row.bestScore }, null);
    }
    for (const row of Object.values(state.alltime?.clans || {})) {
      upsert({ nick: row.clan || row.topNick, id: row.id, score: row.bestScore, clan: row.clan }, null);
    }
  }

  const lim = Math.min(MAX_STORED, Math.max(1, Number(limit) || 100));
  const isClanRow = (r) => !!(r.clan || /^\[/.test(String(r.nick || "").trim()));
  let players = dedupeScoreRankingRows(
    [...byKey.values()].filter((r) => r.id && !isClanRow(r))
  )
    .sort((a, b) => toNum(b.bestScore) - toNum(a.bestScore))
    .slice(0, lim);

  let clans = dedupeScoreRankingRows(
    [...byKey.values()].filter((r) => r.id && isClanRow(r))
  )
    .sort((a, b) => toNum(b.bestScore) - toNum(a.bestScore))
    .slice(0, Math.min(lim, 200))
    .map((r) => ({
      ...r,
      clan: r.clan || r.nick,
    }));

  return {
    period: p,
    metric: "score",
    dayKey: state.dayKey,
    yearKey: state.yearKey,
    tz: state.tz || TZ,
    players,
    clans,
  };
}

/**
 * Очки за период = места на досках рекордов серверов (не сумма опросов).
 * 1 место на сервере = 25, 2 = 15, … Сумма только по разным серверам.
 * Повторный топ-1 на том же сервере в том же периоде не даёт +25 снова.
 */
function formatPointsRankingsFromBoards(state, period, limit = 100) {
  const p = PERIOD_KEYS.includes(period) ? period : "alltime";
  const byPlayer = new Map();
  const byClan = new Map();

  function isClanRow(row) {
    if (!row) return false;
    if (row.clan) return true;
    return String(row.nick || "").trim().startsWith("[");
  }

  function bump(map, row, serverId, pts) {
    if (!row?.id) return;
    const key = `id:${row.id}`;
    const prev = map.get(key) || {
      nick: row.nick,
      id: row.id,
      clan: row.clan || null,
      points: 0,
      lastPoints: 0,
      polls: 0,
      bestScore: 0,
      servers: {},
    };
    prev.points = toNum(prev.points) + toNum(pts);
    prev.lastPoints = toNum(pts);
    prev.bestScore = Math.max(toNum(prev.bestScore), toNum(row.score));
    prev.servers[serverId] = 1;
    prev.nick = row.nick || prev.nick;
    if (row.clan) prev.clan = row.clan;
    map.set(key, prev);
  }

  for (const [serverId, board] of Object.entries(state.serverBoards || {})) {
    const rows = Object.values(board?.[p] || {}).filter(
      (row) => row && row.nick && toNum(row.score) > 0
    );
    const players = rows.filter((r) => !isClanRow(r)).sort((a, b) => toNum(b.score) - toNum(a.score));
    const clans = rows.filter((r) => isClanRow(r)).sort((a, b) => toNum(b.score) - toNum(a.score));

    players.forEach((row, i) => {
      const rank = i + 1;
      bump(byPlayer, row, serverId, rank <= 100 ? pointsForRank(rank) : 0);
    });
    clans.forEach((row, i) => {
      const rank = i + 1;
      bump(byClan, row, serverId, rank <= 100 ? pointsForRank(rank) : 0);
    });
  }

  const lim = Math.min(MAX_STORED, Math.max(1, Number(limit) || 100));
  const players = [...byPlayer.values()]
    .filter((r) => r.id && toNum(r.points) > 0)
    .map((r) => ({
      nick: r.nick,
      id: r.id,
      points: toNum(r.points),
      lastPoints: toNum(r.lastPoints),
      polls: toNum(r.polls),
      bestScore: toNum(r.bestScore),
      servers: r.servers || {},
      serverCount: Object.keys(r.servers || {}).length,
    }))
    .sort((a, b) => b.points - a.points || b.bestScore - a.bestScore)
    .slice(0, lim);

  const clans = [...byClan.values()]
    .filter((r) => r.id && toNum(r.points) > 0)
    .map((r) => ({
      clan: r.clan || r.nick,
      nick: r.nick,
      id: r.id,
      points: toNum(r.points),
      lastPoints: toNum(r.lastPoints),
      polls: toNum(r.polls),
      bestScore: toNum(r.bestScore),
      servers: r.servers || {},
      serverCount: Object.keys(r.servers || {}).length,
    }))
    .sort((a, b) => b.points - a.points || b.bestScore - a.bestScore)
    .slice(0, Math.min(lim, 200));

  return {
    period: p,
    metric: "points",
    dayKey: state.dayKey,
    yearKey: state.yearKey,
    tz: state.tz || TZ,
    players,
    clans,
  };
}

function formatPeriodRankings(state, period, passRegistry, limit = 100, metric = "points") {
  const p = PERIOD_KEYS.includes(period) ? period : "alltime";
  const m = metric === "score" ? "score" : "points";

  if (m === "score") {
    return formatScoreRankings(state, p, limit);
  }

  // Очки = места на serverBoards периода (1→25 …), не накопление опросов
  return formatPointsRankingsFromBoards(state, p, limit);
}

/** Миграция: сброс залипших today/year после старой логики Math.max(bestScore). */
function migrateRecordsLogic(state) {
  if (Number(state.recordsLogicVersion) < 2) {
    state.today = emptyBucket();
    state.yesterday = emptyBucket();
    state.year = emptyBucket();
    state.best.todayByServer = {};
    state.best.year = null;
    // serverBoards today/year уже относительно свежие после очистки GS — оставляем
    // alltime serverBoards тоже относительно свежие; исторический alltime score — в alltime bucket
    state.recordsLogicVersion = 2;
    state.suppressNotifyUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  }
  // v3: восстановить serverBoards.alltime из профильных records (история до wipe GS)
  if (Number(state.recordsLogicVersion) < 3) {
    seedServerBoardsAlltimeFromProfiles(state);
    state.recordsLogicVersion = 3;
    state.suppressNotifyUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  }
  // v4: очки только с FFA/MS — сбросить суммы today/year, раздутые pvp/tournament
  if (Number(state.recordsLogicVersion) < 4) {
    state.today = emptyBucket();
    state.yesterday = emptyBucket();
    state.year = emptyBucket();
    state.best.todayByServer = {};
    state.best.year = null;
    // alltime.points не трогаем (исторический пик); дальше Math.max только с mass-очков
    state.recordsLogicVersion = 4;
    state.suppressNotifyUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  }
  // v5: полная пересборка alltime массы/побед из всех профилей
  if (Number(state.recordsLogicVersion) < 5) {
    rebuildAlltimeRecordsFromProfiles(state);
    state.recordsLogicVersion = 5;
    state.suppressNotifyUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  }
  // v6: очки = места на досках, не сумма опросов (сброс раздутых today/year/…)
  if (Number(state.recordsLogicVersion) < 6) {
    state.today = emptyBucket();
    state.yesterday = emptyBucket();
    state.year = emptyBucket();
    // alltime.points больше не источник рейтинга — обнуляем раздутые суммы,
    // bestScore в профилях/досках не трогаем
    if (state.alltime?.players) {
      for (const p of Object.values(state.alltime.players)) {
        p.points = 0;
        p.lastPoints = 0;
      }
    }
    if (state.alltime?.clans) {
      for (const c of Object.values(state.alltime.clans)) {
        c.points = 0;
        c.lastPoints = 0;
      }
    }
    state.recordsLogicVersion = 6;
    state.suppressNotifyUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  }
  // v7: dedupe server boards + profile ffa1→ffa, stop replaying old feed events
  if (Number(state.recordsLogicVersion) < 7) {
    for (const board of Object.values(state.serverBoards || {})) {
      for (const period of PERIOD_KEYS) {
        board[period] = dedupeBoardMap(board[period] || {});
      }
    }
    migrateProfileRecordFiles();
    state.recordsLogicVersion = 7;
    state.suppressNotifyUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    writeJson(FEED_PATH, { updatedAt: new Date().toISOString(), events: [] });
  }
  return state;
}

function migrateProfileRecordFiles() {
  for (const baseDir of [USERS_DIR, CLANS_DIR]) {
    if (!fs.existsSync(baseDir)) continue;
    let ids = [];
    try {
      ids = fs.readdirSync(baseDir);
    } catch {
      continue;
    }
    for (const id of ids) {
      const file = path.join(baseDir, id, "stats.json");
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        if (!data.records) continue;
        const merged = mergeProfileRecords(data.records);
        if (JSON.stringify(merged) === JSON.stringify(data.records)) continue;
        data.records = merged;
        fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
      } catch {
        /* skip broken profile */
      }
    }
  }
}

function getFeedSince(sinceId) {
  const events = loadFeed();
  if (!sinceId) return [];
  const idx = events.findIndex((e) => e.id === sinceId);
  if (idx < 0) return [];
  return events.slice(idx + 1);
}

export {
  TZ,
  MAX_STORED,
  PERIOD_KEYS,
  PERIODS_PATH,
  FEED_PATH,
  loadPeriodsState,
  savePeriodsState,
  updatePeriodsFromSnapshot,
  formatPeriodRankings,
  formatServerPeriodBoard,
  formatServerPeriodClans,
  formatServersPeriodOverview,
  getEntityPeriodStats,
  getEntityPeriodRecords,
  getFeedSince,
  partsInTz,
  rotatePeriodsIfNeeded,
};
