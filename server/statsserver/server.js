import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildSnapshotFromServers,
  mergeTotals,
  sanitizeTotals,
  formatLeaderboards,
  maxPointsPerPoll,
  RANK_POINTS,
} from "./scoring.js";
import { buildPassRegistry } from "./passlist.js";
import { safeUid, readUserStats, applySnapshotToUsers } from "./users.js";
import { readClanStats, applySnapshotToClans } from "./clans.js";
import { httpGet } from "./fetchHttp.js";
import { toNum } from "./num.js";
import {
  loadPeriodsState,
  updatePeriodsFromSnapshot,
  formatPeriodRankings,
  formatServerPeriodBoard,
  formatServerPeriodClans,
  formatServersPeriodOverview,
  getEntityPeriodStats,
  getEntityPeriodRecords,
  getFeedSince,
  PERIOD_KEYS,
} from "./periods.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, "servers.json");
const DATA_DIR = path.join(ROOT, "data");
const USERS_DIR = path.join(ROOT, "users");
const CLANS_DIR = path.join(ROOT, "clans");
const TOTALS_PATH = path.join(DATA_DIR, "totals.json");
const STATE_PATH = path.join(DATA_DIR, "state.json");

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

const config = readJson(CONFIG_PATH, {});
const POLL_MS = config.pollIntervalMs || 300000;
const PASS_POLL_MS = config.passPollMs || 60000;
const PORT = Number(process.env.STATS_PORT || config.port || 6009);
const HOST = process.env.STATS_HOST || config.host || "0.0.0.0";
const SSL_KEY = process.env.SSL_KEY || config.sslKey;
const SSL_CERT = process.env.SSL_CERT || config.sslCert;
const PASS_URL = process.env.PASS_URL || config.passUrl || "https://api.agar.su/pass.txt";
const FETCH_TIMEOUT_MS = Number(config.fetchTimeoutMs || 15000);
const INSECURE_GAME_TLS = config.insecureGameTls !== false;

let totals = sanitizeTotals(readJson(TOTALS_PATH, { players: {}, clans: {} }));
let state = readJson(STATE_PATH, {
  lastPollAt: null,
  lastPassFetchAt: null,
  lastPollOk: false,
  pollCount: 0,
  servers: [],
  lastSnapshot: null,
  passHolders: 0,
  passUids: 0,
});
let passRegistry = buildPassRegistry("");
let periodsState = loadPeriodsState();

// После перехода на «очки только FFA/MS» живой totals пересоберётся на ближайшем poll.
if (Number(periodsState.recordsLogicVersion) >= 4 && !state.massPointsOnly) {
  state.massPointsOnly = true;
  writeJson(STATE_PATH, state);
}

function massServerCount() {
  // Максимум очков за опрос = число официальных серверов × 25 (1 место)
  return (config.servers || []).length;
}

function rankingPointsForPassId(passId, isClan) {
  const key = `id:${passId}`;
  if (isClan) {
    const c = totals.clans[key];
    if (c) return { points: Number(c.points) || 0, lastPoints: Number(c.lastPoints) || 0 };
    return { points: 0, lastPoints: 0 };
  }
  const p = totals.players[key];
  if (p) return { points: Number(p.points) || 0, lastPoints: Number(p.lastPoints) || 0 };
  return { points: 0, lastPoints: 0 };
}

function globalRankForPassId(passId, period) {
  const entry = passRegistry.getPassEntry(passId);
  if (!entry) return { globalRank: null, globalRankTotal: null, rankBoard: null };

  const isClan = !!entry.isClan;
  if (period && PERIOD_KEYS.includes(period)) {
    const stats = getEntityPeriodStats(periodsState, passId, isClan, period);
    return {
      globalRank: stats.globalRank,
      globalRankTotal: stats.globalRankTotal,
      rankBoard: stats.rankBoard,
      periodPoints: stats.points,
      periodBestScore: stats.bestScore,
      period: stats.period,
    };
  }

  const boards = formatLeaderboards(totals, passRegistry);
  const list = isClan ? boards.clans : boards.players;
  const idx = list.findIndex((r) => String(r.id) === String(passId));

  return {
    globalRank: idx >= 0 ? idx + 1 : null,
    globalRankTotal: list.length,
    rankBoard: isClan ? "clans" : "players",
  };
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function fetchText(url) {
  const { body } = await httpGet(url, { timeoutMs: FETCH_TIMEOUT_MS, insecure: false });
  return body;
}

async function refreshPassList() {
  try {
    const passText = await fetchText(PASS_URL);
    passRegistry = buildPassRegistry(passText);
    state.lastPassFetchAt = new Date().toISOString();
    state.passHolders = passRegistry.lineCount;
    state.passUids = passRegistry.lineCount;
    console.log(`whitelist loaded: ${passRegistry.lineCount} entries`);
  } catch (err) {
    console.error("whitelist fetch failed:", err.message || err);
  }
}

async function fetchServerStats(server) {
  const insecure = server.insecureTls ?? INSECURE_GAME_TLS;
  try {
    const { body } = await httpGet(server.url, { timeoutMs: FETCH_TIMEOUT_MS, insecure });
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return { ...server, ok: false, error: "invalid json", data: null };
    }
    if (!Array.isArray(data)) {
      return { ...server, ok: false, error: "not array", data: null };
    }
    return { ...server, ok: true, error: null, data };
  } catch (err) {
    const msg = String(err.message || err);
    const hint =
      msg.includes("certificate") || msg.includes("UNABLE_TO_VERIFY")
        ? " (╨┐╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ insecureGameTls: true ╨▓ servers.json)"
        : "";
    return { ...server, ok: false, error: msg + hint, data: null };
  }
}

async function pollAll() {
  const seenUrls = new Set();
  const servers = (config.servers || []).filter((s) => {
    const url = String(s.url || "").trim();
    if (!url || seenUrls.has(url)) {
      if (url && seenUrls.has(url)) {
        console.warn(`skip duplicate server url: ${s.id} тЖТ ${url}`);
      }
      return false;
    }
    seenUrls.add(url);
    return true;
  });
  const started = Date.now();
  const results = await Promise.all(servers.map(fetchServerStats));
  const pollAt = new Date().toISOString();
  const snapshot = buildSnapshotFromServers(results, passRegistry);

  totals = sanitizeTotals(mergeTotals(totals, snapshot, pollAt));
  writeJson(TOTALS_PATH, totals);

  const periodResult = updatePeriodsFromSnapshot(periodsState, snapshot, pollAt);
  periodsState = periodResult.state;

  const serverMeta = new Map(servers.map((s) => [s.id, s]));
  applySnapshotToUsers(ROOT, snapshot, passRegistry, serverMeta, pollAt, pollAt);
  applySnapshotToClans(ROOT, snapshot, passRegistry, serverMeta, pollAt, pollAt);

  state = {
    ...state,
    lastPollAt: pollAt,
    lastPollDurationMs: Date.now() - started,
    lastPollOk: results.some((r) => r.ok),
    pollCount: (state.pollCount || 0) + 1,
    servers: snapshot.perServer,
    lastSnapshot: {
      players: snapshot.players.slice(0, 100),
      clans: snapshot.clans.slice(0, 50),
    },
  };
  writeJson(STATE_PATH, state);

  const okN = results.filter((r) => r.ok).length;
  const top = formatLeaderboards(totals, passRegistry).players[0];
  console.log(
    `[${state.lastPollAt}] poll #${state.pollCount} ok=${state.lastPollOk}` +
      ` servers=${okN}/${servers.length}` +
      ` pass=${passRegistry.lineCount}` +
      (top ? ` leader=${top.nick} (${top.points} pts)` : "")
  );
  if (okN < results.length) {
    for (const r of results) {
      if (!r.ok) console.warn(`  тЬЧ ${r.id} ${r.url} тЖТ ${r.error}`);
    }
  }
}

function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      lastPollAt: state.lastPollAt,
      pollCount: state.pollCount,
      passHolders: state.passHolders,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    return sendJson(res, 200, {
      ...state,
      pollIntervalMs: POLL_MS,
      passUrl: PASS_URL,
      scoring: RANK_POINTS,
      serverList: (config.servers || []).map((s) => ({ id: s.id, name: s.name, url: s.url })),
    });
  }

  const passMatch = url.pathname.match(/^\/api\/pass\/(\d+)$/);
  if (req.method === "GET" && passMatch) {
    const passId = safeUid(passMatch[1]);
    if (!passId) return sendJson(res, 400, { error: "invalid id" });
    const entry = passRegistry.getPassEntry(passId);
    if (!entry) return sendJson(res, 404, { error: "not found", id: passId });
    return sendJson(res, 200, {
      id: passId,
      nick: entry.nick,
      line: Number(passId),
    });
  }

  const userMatch = url.pathname.match(/^\/api\/user\/(\d+)$/);
  if (req.method === "GET" && userMatch) {
    const passId = safeUid(userMatch[1]);
    if (!passId) return sendJson(res, 400, { error: "invalid id" });
    const entry = passRegistry.getPassEntry(passId);
    if (!entry) return sendJson(res, 404, { error: "not found", id: passId });
    if (entry.isClan) {
      return sendJson(res, 404, { error: "clan entry", id: passId, clanUrl: `/api/clan/${passId}` });
    }

    const period = String(url.searchParams.get("period") || "alltime").toLowerCase();
    const usePeriod = PERIOD_KEYS.includes(period);
    const stats = readUserStats(ROOT, passId);
    const nicks = [...new Set([entry.nick, ...((stats && stats.nicks) || [])])];
    const rankPts = rankingPointsForPassId(passId, false);
    const globalRank = globalRankForPassId(passId, usePeriod ? period : null);
    const periodStats = usePeriod
      ? getEntityPeriodStats(periodsState, passId, false, period)
      : null;
    const periodRecords = getEntityPeriodRecords(
      periodsState,
      passId,
      false,
      usePeriod ? period : "alltime",
      config.servers || []
    );
    // alltime: если в доске пусто — подмешаем профильные records как fallback
    if ((!usePeriod || period === "alltime") && stats?.records) {
      for (const [sid, rec] of Object.entries(stats.records)) {
        if (!periodRecords[sid]) continue;
        if (periodRecords[sid].hasRecord) continue;
        if (!rec || toNum(rec.score) <= 0) continue;
        periodRecords[sid] = {
          ...periodRecords[sid],
          score: toNum(rec.score),
          nick: rec.nick || entry.nick,
          rank: rec.rank || null,
          updatedAt: rec.updatedAt || null,
          hasRecord: true,
          fromProfile: true,
        };
      }
    }
    const base = stats || {
      id: passId,
      uid: passId,
      nicks,
      points: 0,
      polls: 0,
      bestScore: 0,
      records: {},
      lastPoll: null,
    };
    return sendJson(res, 200, {
      ...base,
      id: passId,
      line: Number(passId),
      nick: entry.nick,
      nicks,
      points: periodStats ? periodStats.points : rankPts.points,
      lastPoints: rankPts.lastPoints,
      bestScore: periodStats ? periodStats.bestScore : toNum(base.bestScore),
      records: periodRecords,
      maxPoints: maxPointsPerPoll(massServerCount()),
      period: usePeriod ? period : "alltime",
      periods: PERIOD_KEYS,
      dayKey: periodsState.dayKey,
      yearKey: periodsState.yearKey,
      ...globalRank,
    });
  }

  const clanMatch = url.pathname.match(/^\/api\/clan\/(\d+)$/);
  if (req.method === "GET" && clanMatch) {
    const passId = safeUid(clanMatch[1]);
    if (!passId) return sendJson(res, 400, { error: "invalid id" });
    const entry = passRegistry.getPassEntry(passId);
    if (!entry) return sendJson(res, 404, { error: "not found", id: passId });
    if (!entry.isClan) {
      return sendJson(res, 404, { error: "player entry", id: passId, userUrl: `/api/user/${passId}` });
    }

    const period = String(url.searchParams.get("period") || "alltime").toLowerCase();
    const usePeriod = PERIOD_KEYS.includes(period);
    const stats = readClanStats(ROOT, passId);
    const members = [...new Set([...(stats && stats.members) || [], entry.nick])];
    const rankPts = rankingPointsForPassId(passId, true);
    const globalRank = globalRankForPassId(passId, usePeriod ? period : null);
    const periodStats = usePeriod
      ? getEntityPeriodStats(periodsState, passId, true, period)
      : null;
    const periodRecords = getEntityPeriodRecords(
      periodsState,
      passId,
      true,
      usePeriod ? period : "alltime",
      (config.servers || []).filter((s) => !s.noClans && s.kind !== "score")
    );
    if ((!usePeriod || period === "alltime") && stats?.records) {
      for (const [sid, rec] of Object.entries(stats.records)) {
        if (!periodRecords[sid]) continue;
        if (periodRecords[sid].hasRecord) continue;
        if (!rec || toNum(rec.score) <= 0) continue;
        periodRecords[sid] = {
          ...periodRecords[sid],
          score: toNum(rec.score),
          nick: rec.nick || entry.nick,
          clan: stats.clan || rec.clan || entry.nick,
          rank: rec.rank || null,
          updatedAt: rec.updatedAt || null,
          hasRecord: true,
          fromProfile: true,
        };
      }
    }
    const base = stats || {
      id: passId,
      uid: passId,
      clan: entry.nick,
      members,
      points: 0,
      polls: 0,
      bestScore: 0,
      records: {},
      lastPoll: null,
    };
    return sendJson(res, 200, {
      ...base,
      id: passId,
      line: Number(passId),
      clan: entry.nick,
      members,
      points: periodStats ? periodStats.points : rankPts.points,
      lastPoints: rankPts.lastPoints,
      bestScore: periodStats ? periodStats.bestScore : toNum(base.bestScore),
      records: periodRecords,
      maxPoints: maxPointsPerPoll(massServerCount()),
      period: usePeriod ? period : "alltime",
      periods: PERIOD_KEYS,
      dayKey: periodsState.dayKey,
      yearKey: periodsState.yearKey,
      ...globalRank,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/rankings/players") {
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const boards = formatLeaderboards(totals, passRegistry);
    return sendJson(res, 200, {
      updatedAt: state.lastPollAt,
      pollCount: state.pollCount,
      items: boards.players.slice(0, limit),
    });
  }

  if (req.method === "GET" && url.pathname === "/api/rankings/clans") {
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const boards = formatLeaderboards(totals, passRegistry);
    return sendJson(res, 200, {
      updatedAt: state.lastPollAt,
      pollCount: state.pollCount,
      items: boards.clans.slice(0, limit),
    });
  }

  if (req.method === "GET" && url.pathname === "/api/rankings") {
    const limit = Math.min(10000, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const period = String(url.searchParams.get("period") || "alltime").toLowerCase();
    const metric = String(url.searchParams.get("metric") || "points").toLowerCase() === "score"
      ? "score"
      : "points";
    const usePeriod = PERIOD_KEYS.includes(period);

    let players;
    let clans;
    let resolvedPeriod = "alltime";
    let dayKey = periodsState.dayKey || null;
    let yearKey = periodsState.yearKey || null;

    if (usePeriod) {
      // alltime + points → сохранённый periods.alltime (исторический топ, не живой totals)
      const boards = formatPeriodRankings(periodsState, period, passRegistry, limit, metric);
      players = boards.players;
      clans = boards.clans;
      resolvedPeriod = boards.period;
      dayKey = boards.dayKey;
      yearKey = boards.yearKey;
    } else {
      const boards = formatLeaderboards(totals, passRegistry);
      players = boards.players.slice(0, limit);
      clans = boards.clans.slice(0, Math.min(limit, 100));
    }

    const servers = usePeriod
      ? formatServersPeriodOverview(periodsState, resolvedPeriod, config.servers || [], state.servers || [])
      : state.servers || [];

    return sendJson(res, 200, {
      updatedAt: state.lastPollAt,
      pollCount: state.pollCount,
      memberCount: state.passHolders,
      period: resolvedPeriod,
      metric,
      dayKey,
      yearKey,
      tz: periodsState.tz || "Europe/Moscow",
      players,
      clans,
      servers,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/records/feed") {
    const since = url.searchParams.get("since") || "";
    const events = getFeedSince(since);
    return sendJson(res, 200, {
      updatedAt: state.lastPollAt,
      count: events.length,
      events,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/periods") {
    return sendJson(res, 200, {
      tz: periodsState.tz,
      dayKey: periodsState.dayKey,
      yearKey: periodsState.yearKey,
      periods: PERIOD_KEYS,
      bootstrapDone: !!periodsState.bootstrapDone,
      best: {
        year: periodsState.best?.year || null,
        alltime: periodsState.best?.alltime || null,
        todayServers: Object.keys(periodsState.best?.todayByServer || {}),
      },
    });
  }

  if (req.method === "GET" && url.pathname === "/api/servers") {
    const list = (config.servers || []).map((meta) => {
      const snap = (state.servers || []).find((s) => s.id === meta.id);
      return {
        id: meta.id,
        name: meta.name,
        ok: snap ? !!snap.ok : false,
        error: snap?.error || null,
        players: snap?.players || 0,
        clans: snap?.clans || 0,
      };
    });
    return sendJson(res, 200, {
      updatedAt: state.lastPollAt,
      pollCount: state.pollCount,
      servers: list,
    });
  }

  const serverMatch = url.pathname.match(/^\/api\/server\/([^/]+)$/);
  if (req.method === "GET" && serverMatch) {
    const id = decodeURIComponent(serverMatch[1]);
    const meta = (config.servers || []).find((s) => s.id === id);
    if (!meta) return sendJson(res, 404, { error: "server not found", id });

    const snap = (state.servers || []).find((s) => s.id === id);
    const limit = Math.min(10000, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const periodRaw = String(url.searchParams.get("period") || "alltime").toLowerCase();
    const period = PERIOD_KEYS.includes(periodRaw) ? periodRaw : "alltime";

    const players = formatServerPeriodBoard(periodsState, id, period, limit);
    const clans = formatServerPeriodClans(periodsState, id, period, limit);

    const kind = meta.kind === "score" ? "score" : "mass";
    return sendJson(res, 200, {
      id: meta.id,
      name: meta.name,
      kind,
      scoreLabel: kind === "score" ? "Побед" : "Масса",
      period,
      dayKey: periodsState.dayKey,
      yearKey: periodsState.yearKey,
      updatedAt: state.lastPollAt,
      pollCount: state.pollCount,
      ok: snap ? !!snap.ok : false,
      error: snap?.error || null,
      players,
      clans,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/reset") {
    const token = req.headers["x-admin-token"] || url.searchParams.get("token");
    if (!process.env.STATS_ADMIN_TOKEN || token !== process.env.STATS_ADMIN_TOKEN) {
      return sendJson(res, 403, { error: "forbidden" });
    }
    totals = { players: {}, clans: {} };
    writeJson(TOTALS_PATH, totals);
    return sendJson(res, 200, { ok: true, note: "totals reset; user profiles unchanged" });
  }

  sendJson(res, 404, { error: "not found" });
}

async function startPolling() {
  fs.mkdirSync(USERS_DIR, { recursive: true });
  fs.mkdirSync(CLANS_DIR, { recursive: true });
  console.log(`Stats API mounted on /stats-api`);
  console.log(`Poll interval: ${POLL_MS / 1000}s, servers: ${(config.servers || []).length}`);
  console.log(`Whitelist: ${PASS_URL}`);
  console.log(`Game TLS insecure: ${INSECURE_GAME_TLS}`);
  await refreshPassList();
  pollAll().catch((err) => console.error("Initial poll failed:", err));
  setInterval(() => pollAll().catch((err) => console.error("Poll failed:", err)), POLL_MS);
  setInterval(() => refreshPassList().catch((err) => console.error("Whitelist refresh failed:", err)), PASS_POLL_MS);
}

export { handleRequest, startPolling };
