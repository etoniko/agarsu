/**
 * История poll'ов для stats/monit.
 *
 * data/monit/{serverId}.json — кольцо точек (по умолчанию ~48ч при poll 5 мин).
 * Точка: { t, ok, score, nick, id, n, top[] }
 *   score/nick/id — лидер доски (#1 масса или победы)
 *   n — сколько записей на доске
 *   top — топ-3 для подсказок
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { toNum } from "./num.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONIT_DIR = path.join(__dirname, "data", "monit");
/** 5 мин × 576 = 48 часов */
const MAX_POINTS = 576;

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data), "utf8");
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function monitFile(serverId) {
  return path.join(MONIT_DIR, `${serverId}.json`);
}

function loadSeries(serverId) {
  const data = readJson(monitFile(serverId), null);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.points)) return data.points;
  return [];
}

function saveSeries(serverId, meta, points) {
  writeJson(monitFile(serverId), {
    serverId,
    serverName: meta.serverName || serverId,
    kind: meta.kind === "score" ? "score" : "mass",
    scoreLabel: meta.kind === "score" ? "Побед" : "Масса",
    updatedAt: meta.updatedAt || new Date().toISOString(),
    points,
  });
}

function compactTop(rows, limit = 3) {
  const out = [];
  for (const row of rows || []) {
    if (!row?.nick) continue;
    const score = toNum(row.score);
    if (score <= 0) continue;
    out.push({
      nick: row.nick,
      score,
      id: row.id != null ? String(row.id) : null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Добавляет точку с каждого успешного/неуспешного poll по серверам.
 */
function appendMonitFromSnapshot(snapshot, pollAt, serverMeta = new Map()) {
  let saved = 0;
  for (const srv of snapshot?.perServer || []) {
    const meta = serverMeta.get(srv.id) || {};
    const kind = meta.kind || srv.kind || (meta.noClans || srv.noClans ? "score" : "mass");
    const rows = srv.ok ? srv.allSolo || [] : [];
    const top = compactTop(rows, 3);
    const leader = top[0] || null;

    const points = loadSeries(srv.id);
    const last = points[points.length - 1];
    // Не дублируем ту же секунду.
    if (last && last.t === pollAt) continue;

    points.push({
      t: pollAt,
      ok: srv.ok !== false,
      score: leader ? leader.score : 0,
      nick: leader ? leader.nick : null,
      id: leader ? leader.id : null,
      n: rows.length,
      top,
    });

    while (points.length > MAX_POINTS) points.shift();

    saveSeries(
      srv.id,
      {
        serverName: meta.name || srv.name || srv.id,
        kind,
        updatedAt: pollAt,
      },
      points
    );
    saved += 1;
  }
  return { saved };
}

function filterPoints(points, fromMs, toMs) {
  return (points || []).filter((p) => {
    const ms = Date.parse(p.t);
    if (!Number.isFinite(ms)) return false;
    if (fromMs != null && ms < fromMs) return false;
    if (toMs != null && ms > toMs) return false;
    return true;
  });
}

/**
 * Серии для виджетов. hours — окно от «сейчас» назад (по умолчанию 24).
 */
function getMonitOverview({ hours = 24, serverIds = null } = {}) {
  const toMs = Date.now();
  const h = Math.min(72, Math.max(1, Number(hours) || 24));
  const fromMs = toMs - h * 3600 * 1000;

  if (!fs.existsSync(MONIT_DIR)) {
    return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), hours: h, servers: [] };
  }

  const files = fs
    .readdirSync(MONIT_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));

  const ids = serverIds?.length
    ? serverIds.filter((id) => files.includes(id))
    : files;

  const servers = ids.map((serverId) => {
    const raw = readJson(monitFile(serverId), {});
    const points = filterPoints(Array.isArray(raw) ? raw : raw.points || [], fromMs, toMs);
    const first = points[0];
    const last = points[points.length - 1];
    const delta =
      first && last ? toNum(last.score) - toNum(first.score) : 0;
    return {
      id: serverId,
      name: raw.serverName || serverId,
      kind: raw.kind === "score" ? "score" : "mass",
      scoreLabel: raw.scoreLabel || (raw.kind === "score" ? "Побед" : "Масса"),
      updatedAt: raw.updatedAt || last?.t || null,
      delta,
      trend: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
      lastNick: last?.nick || null,
      lastScore: last ? toNum(last.score) : 0,
      lastN: last ? toNum(last.n) : 0,
      points: points.map((p) => ({
        t: p.t,
        ok: p.ok !== false,
        score: toNum(p.score),
        nick: p.nick || null,
        id: p.id || null,
        n: toNum(p.n),
        top: p.top || [],
      })),
    };
  });

  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    hours: h,
    servers,
  };
}

export { MONIT_DIR, appendMonitFromSnapshot, getMonitOverview };
