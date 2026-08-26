import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const RECORDS_DIR = path.join(ROOT, "data", "records");
const TODAY_DIR = path.join(RECORDS_DIR, "today");
const LEGACY_RATING_DIR = path.join(ROOT, "..", "rating");

// Соответствие старых файлов рейтинга (../rating/*.txt) id серверов из servers.json.
const LEGACY_SERVER_MAP = {
  "ffa.agar.su.txt": "ffa",
  "ffa.agar.su6001.txt": "ffa1",
  "ms.agar.su6001.txt": "ms",
  "ms.agar.su6002.txt": "tournament",
  "ms.agar.su6003.txt": "tournament2",
  "ms.agar.su6004.txt": "pvp1",
  "ms.agar.su6005.txt": "pvp2",
};

// Разделитель составного ключа "serverId + nick" — символ, который не встречается в никах.
const KEY_SEP = "\u0000";

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

function hasClanTag(nick) {
  return /^\[[^\]]+\]/.test(nick);
}

function normalizeNick(nick) {
  return String(nick || "").trim().toLowerCase();
}

function parseLegacyTime(time) {
  if (!time) return null;
  const m = String(time).match(/(\d{1,2}):(\d{2})\s+(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  const [, hh, mm, dd, MM] = m;
  const year = Number(MM) > 8 ? 2025 : 2026;
  const date = new Date(year, Number(MM) - 1, Number(dd), Number(hh), Number(mm));
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function serverFile(serverId) {
  return path.join(RECORDS_DIR, `${serverId}.json`);
}

function todayFile(todayKey) {
  return path.join(TODAY_DIR, `${todayKey}.json`);
}

function keyFor(serverId, nickKey) {
  return `${serverId}${KEY_SEP}${nickKey}`;
}

/**
 * Загружает все рекорды за всё время.
 * Ключ — "serverId + nick", значение — { nick, score, serverId, recordedAt }.
 */
function loadRecords() {
  const records = new Map();
  if (!fs.existsSync(RECORDS_DIR)) return records;
  for (const file of fs.readdirSync(RECORDS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const serverId = file.replace(/\.json$/, "");
    if (serverId === "today") continue;
    const data = readJson(path.join(RECORDS_DIR, file), {});
    for (const [nickKey, row] of Object.entries(data)) {
      if (row && row.nick) records.set(keyFor(serverId, nickKey), { ...row, serverId });
    }
  }
  return records;
}

/**
 * Сохраняет рекорды по одному файлу на сервер:
 * data/records/{serverId}.json = { "<nick>": { nick, score, serverId, recordedAt } }.
 */
function saveRecords(records) {
  const byServer = new Map();
  for (const [key, row] of records.entries()) {
    const serverId = row.serverId;
    if (!serverId) continue;
    const nickKey = key.slice(key.indexOf(KEY_SEP) + KEY_SEP.length);
    if (!byServer.has(serverId)) byServer.set(serverId, {});
    byServer.get(serverId)[nickKey] = row;
  }
  for (const [serverId, data] of byServer) {
    writeJson(serverFile(serverId), data);
  }
}

function loadToday(todayKey) {
  const data = readJson(todayFile(todayKey), {});
  const map = new Map();
  for (const [key, row] of Object.entries(data)) {
    if (row && row.nick) map.set(key, row);
  }
  return map;
}

function saveToday(todayKey, map) {
  const data = {};
  for (const [key, row] of map.entries()) data[key] = row;
  writeJson(todayFile(todayKey), data);
}

/**
 * Одноразовая конвертация старых ../rating/*.txt в data/records/{serverId}.json.
 * Возвращает число добавленных/обновлённых рекордов.
 */
function mergeLegacyIntoRecords(records) {
  if (!fs.existsSync(LEGACY_RATING_DIR)) return 0;
  let added = 0;
  for (const file of fs.readdirSync(LEGACY_RATING_DIR)) {
    if (!file.endsWith(".txt")) continue;
    const serverId = LEGACY_SERVER_MAP[file];
    if (!serverId) continue;
    const raw = readJson(path.join(LEGACY_RATING_DIR, file), []);
    if (!Array.isArray(raw)) continue;

    for (const row of raw) {
      const nick = String(row?.nick || "").trim();
      if (!nick || hasClanTag(nick)) continue;
      const score = Number(row?.score) || 0;
      if (score <= 0) continue;

      const key = keyFor(serverId, normalizeNick(nick));
      const prev = records.get(key);
      if (!prev || score > Number(prev.score)) {
        records.set(key, {
          nick,
          score,
          serverId,
          recordedAt: parseLegacyTime(row?.time) || null,
        });
        added += 1;
      }
    }
  }
  if (added > 0) saveRecords(records);
  return added;
}

/**
 * Обновляет рекорды за всё время по каждому серверу и наполняет дневной JSON.
 * - all-time обновляется только если score стал больше прошлого рекорда;
 * - в today попадают только те, кто действительно побил исторический рекорд;
 * - повторные опросы не дублируют запись в today (первая запись дня сохраняется);
 * - новый дневной JSON начинается автоматически при смене todayKey (06:00).
 */
function updateRecordsFromSnapshot(records, snapshot, pollAt, todayKey) {
  let updated = 0;
  let todayAdded = 0;
  const today = loadToday(todayKey);

  for (const srv of snapshot.perServer || []) {
    if (!srv.ok) continue;
    const serverId = srv.id;
    for (const row of srv.allSolo || []) {
      if (!row.id || !row.nick) continue;
      const score = Number(row.score) || 0;
      if (score <= 0) continue;

      const key = keyFor(serverId, normalizeNick(row.nick));
      const prev = records.get(key);
      if (!prev || score > Number(prev.score)) {
        records.set(key, {
          nick: row.nick,
          score,
          serverId,
          recordedAt: pollAt,
        });
        updated += 1;

        // Побил исторический рекорд — добавляем в today (без дублей).
        const nickKey = normalizeNick(row.nick);
        if (!today.has(nickKey)) {
          today.set(nickKey, {
            nick: row.nick,
            score,
            serverId,
            recordedAt: pollAt,
          });
          todayAdded += 1;
        }
      }
    }
  }

  if (updated > 0) saveRecords(records);
  if (todayAdded > 0) saveToday(todayKey, today);
  return { updated, todayAdded };
}

function formatRecords(records) {
  return [...records.values()]
    .sort((a, b) => Number(b.score) - Number(a.score))
    .map((row, index) => ({
      rank: index + 1,
      nick: row.nick,
      score: Number(row.score),
      serverId: row.serverId || null,
      recordedAt: row.recordedAt || null,
    }));
}

function formatTodayRecords(todayKey) {
  return [...loadToday(todayKey).values()]
    .sort((a, b) => Number(b.score) - Number(a.score))
    .map((row, index) => ({
      rank: index + 1,
      nick: row.nick,
      score: Number(row.score),
      serverId: row.serverId || null,
      recordedAt: row.recordedAt || null,
    }));
}

export {
  RECORDS_DIR,
  loadRecords,
  saveRecords,
  mergeLegacyIntoRecords,
  updateRecordsFromSnapshot,
  formatRecords,
  formatTodayRecords,
};