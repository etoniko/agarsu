/**
 * Дневные архивы рекордов с игровых серверов.
 *
 * Структура:
 *   data/days/2026-09-17/pvp2.json
 *   data/days/2026-09-17/ffa.json
 *   …
 *
 * Один файл на сервер на день (dayKey = сутки с 06:05 MSK).
 * Каждый poll перезаписывает файл текущего дня актуальным снимком checkStats.
 * Старые дни не трогаем — копятся как лог для статистики.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { toNum } from "./num.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DAYS_DIR = path.join(__dirname, "data", "days");

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/** 2026-09-17 → 17.09.2026 */
function dayKeyToLabel(dayKey) {
  const m = String(dayKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(dayKey || "");
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function dayDir(dayKey) {
  return path.join(DAYS_DIR, dayKey);
}

function dayServerFile(dayKey, serverId) {
  return path.join(dayDir(dayKey), `${serverId}.json`);
}

function normalizeRows(rows) {
  const byNick = new Map();
  for (const row of rows || []) {
    const nick = String(row?.nick || "").trim();
    if (!nick) continue;
    const score = toNum(row.score);
    if (score <= 0) continue;
    const key = nick.toLowerCase();
    const prev = byNick.get(key);
    if (!prev || score > toNum(prev.score)) {
      byNick.set(key, {
        nick,
        score,
        id: row.id != null ? String(row.id) : null,
        time: row.time || null,
        clan: row.clan || null,
      });
    }
  }
  return [...byNick.values()].sort((a, b) => toNum(b.score) - toNum(a.score));
}

/**
 * Сохраняет снимок checkStats за день для одного сервера.
 * Для kind=score score = победы; для mass = масса.
 */
function saveDailyServerSnapshot({
  dayKey,
  serverId,
  serverName,
  kind,
  pollAt,
  ok,
  error,
  rows,
}) {
  if (!dayKey || !serverId) return null;

  const records = normalizeRows(rows);
  const payload = {
    dayKey,
    dateLabel: dayKeyToLabel(dayKey),
    serverId,
    serverName: serverName || serverId,
    kind: kind === "score" ? "score" : "mass",
    scoreLabel: kind === "score" ? "Побед" : "Масса",
    updatedAt: pollAt || new Date().toISOString(),
    ok: ok !== false,
    error: error || null,
    count: records.length,
    records,
  };

  writeJson(dayServerFile(dayKey, serverId), payload);
  return payload;
}

/**
 * Пишет дневные файлы по всем серверам из snapshot (результат poll).
 * Возвращает { dayKey, saved: number }.
 */
function saveDailyFromSnapshot(snapshot, pollAt, dayKey, serverMeta = new Map()) {
  if (!dayKey) return { dayKey: null, saved: 0 };
  let saved = 0;

  for (const srv of snapshot?.perServer || []) {
    const meta = serverMeta.get(srv.id) || {};
    const kind = meta.kind || srv.kind || (meta.noClans || srv.noClans ? "score" : "mass");
    saveDailyServerSnapshot({
      dayKey,
      serverId: srv.id,
      serverName: meta.name || srv.name || srv.id,
      kind,
      pollAt,
      ok: srv.ok,
      error: srv.error || null,
      rows: srv.ok ? srv.allSolo || [] : [],
    });
    saved += 1;
  }

  // Маркер дня — список серверов, чтоб было видно полный набор файлов.
  writeJson(path.join(dayDir(dayKey), "_meta.json"), {
    dayKey,
    dateLabel: dayKeyToLabel(dayKey),
    updatedAt: pollAt || new Date().toISOString(),
    servers: (snapshot?.perServer || []).map((s) => ({
      id: s.id,
      ok: !!s.ok,
      error: s.error || null,
    })),
  });

  return { dayKey, saved };
}

function listDays() {
  if (!fs.existsSync(DAYS_DIR)) return [];
  return fs
    .readdirSync(DAYS_DIR)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort();
}

function loadDailyServer(dayKey, serverId) {
  return readJson(dayServerFile(dayKey, serverId), null);
}

function listDayServers(dayKey) {
  const dir = dayDir(dayKey);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "_meta.json")
    .map((f) => f.replace(/\.json$/, ""));
}

export {
  DAYS_DIR,
  dayKeyToLabel,
  saveDailyServerSnapshot,
  saveDailyFromSnapshot,
  listDays,
  loadDailyServer,
  listDayServers,
};
