// =========================
// server.js — Self.PayAnyWay (MONETA.RU) + agar.su API
// ==========================
import express from "express";
import fs from "fs";
import path from "path";
import http from "http";
import bodyParser from "body-parser";
import multer from "multer";
import cors from "cors";
import crypto from "crypto";
import axios from "axios";
import mysql from "mysql";
import { fileURLToPath } from "url";
import { onRequest as handleOnlineRequest, startPolling as startOnlinePolling } from "./online.js";
import { handleRequest as handleStatsRequest, startPolling as startStatsPolling } from "./statsserver/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// allowtxt.txt в корне папки сервера (рядом с freekassa.js)
const ALLOWTXT_PATH = path.join(__dirname, "allowtxt.txt");

const ALLOWED_CHARS = new Set();
for (const line of fs.readFileSync(ALLOWTXT_PATH, "utf8").split(/\r?\n/)) {
  if (line.length > 0) ALLOWED_CHARS.add(line);
}

function isAllowedNickname(value, allowBrackets = false) {
  if (!value) return true;
  for (const char of value) {
    if (!allowBrackets && (char === "[" || char === "]")) return false;
    if (!ALLOWED_CHARS.has(char)) return false;
  }
  return true;
}

const app = express();
app.set("trust proxy", "loopback");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({ origin: "*" }));
app.use(express.static("public"));

app.get("/allowtxt.txt", (req, res) => {
  res.type("text/plain; charset=utf-8");
  res.sendFile(ALLOWTXT_PATH);
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ["https://agar.su", "https://lk.agar.su"];

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true"); // если используешь cookies в будущем

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

const allowedIPs = (process.env.USERS_P_IPS || "127.0.0.1").split(",");
const SECRET = process.env.USERS_P_SECRET || "";
// Self.PayAnyWay / MONETA.RU — данные из личного кабинета self.payanyway.ru
const PAW_MNT_ID = "26678484";
const PAW_INTEGRITY_CODE = "12345";
const PAW_TEST_MODE = "0";
const PAW_ASSISTANT_URL = "https://moneta.ru/assistant.htm";
const PAW_SUCCESS_URL = "https://agar.su/";
const PAYMENT_FILE = path.join(process.cwd(), "payment.json");
const ROOT_SKINLIST_FILE = path.join(process.cwd(), "public/skinlist.txt");
const PENDING_FILE = path.join(process.cwd(), "upload", "pending.json");
const UPLOAD_DIR = path.join(process.cwd(), "upload");
const SKINS_DIR = path.join(process.cwd(), "public/skins");
const INVISIBLE_FILE = path.join(process.cwd(), "public/invisible.txt");
const ROTATION_FILE = path.join(process.cwd(), "public/rotation.txt");
const ID_JSON_FILE = path.join(process.cwd(), "id.json");


if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(SKINS_DIR)) fs.mkdirSync(SKINS_DIR);
if (!fs.existsSync(PENDING_FILE)) {
  fs.writeFileSync(PENDING_FILE, JSON.stringify([], null, 2), "utf-8");
}
if (!fs.existsSync(ID_JSON_FILE)) {
  fs.writeFileSync(ID_JSON_FILE, JSON.stringify({}, null, 2), "utf-8");
}

if (!fs.existsSync(PAYMENT_FILE)) {
  fs.writeFileSync(PAYMENT_FILE, JSON.stringify([], null, 2), "utf-8");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Math.round(Math.random() * 1e9);
    cb(null, unique + ext);
  },
});
const upload = multer({ storage });

/** Счётчик записей в JSON (массив или объект). */
const jsonEntryCount = (data) => {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") return Object.keys(data).length;
  return 0;
};

/** Атомарная запись: tmp + rename (не оставляем полупустой файл). */
const atomicWriteFile = (filePath, content) => {
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, filePath);
};

/**
 * Безопасная запись JSON.
 * - никогда не затирает непустой файл пустым;
 * - не даёт урезать >50% записей (защита от бага parse→{}→write);
 * - при битом текущем файле копирует в .corrupt.* и не трогает оригинал, если новые данные подозрительно малы;
 * - перед успешной записью обновляет .bak.
 */
/** NickPass: одна строка на ник — `"ник": {"password":"...","role":"..."}` */
const formatNickPassCompact = (data) => {
  const entries = Object.entries(data || {}).map(
    ([key, value]) => ` ${JSON.stringify(String(key))}: ${JSON.stringify(value)}`
  );
  return `{\n${entries.join(",\n")}\n}\n`;
};

const safeWriteJson = (filePath, data, { allowShrink = false, label, format } = {}) => {
  const name = label || path.basename(filePath);
  const nextCount = jsonEntryCount(data);
  const content =
    typeof format === "function" ? format(data) : `${JSON.stringify(data, null, 2)}\n`;

  let prevCount = 0;
  let prevCorrupt = false;
  if (fs.existsSync(filePath)) {
    const prevRaw = fs.readFileSync(filePath, "utf-8");
    const trimmed = prevRaw.trim();
    if (trimmed) {
      try {
        prevCount = jsonEntryCount(JSON.parse(trimmed));
      } catch (err) {
        prevCorrupt = true;
        const emergency = `${filePath}.corrupt.${Date.now()}`;
        try {
          fs.copyFileSync(filePath, emergency);
          console.error(`CRITICAL: ${name} битый JSON, копия: ${emergency}`, err);
        } catch (copyErr) {
          console.error(`CRITICAL: не удалось скопировать битый ${name}:`, copyErr);
        }
        // Не перезаписываем битый файл «с нуля», если новых данных мало —
        // иначе снова теряем всё. Пишем только если явно много записей или allowShrink.
        if (!allowShrink && nextCount < 10) {
          console.error(
            `REFUSE write ${name}: файл битый, отказ писать ${nextCount} записей (нужен ручной restore)`
          );
          return false;
        }
      }
    }
  }

  if (prevCount > 0 && nextCount === 0) {
    console.error(`REFUSE empty write ${name}: было ${prevCount} записей`);
    return false;
  }

  if (!allowShrink && !prevCorrupt && prevCount >= 10 && nextCount < Math.ceil(prevCount * 0.5)) {
    console.error(`REFUSE shrink write ${name}: ${prevCount} → ${nextCount}`);
    try {
      fs.writeFileSync(`${filePath}.refused.${Date.now()}.json`, content, "utf-8");
    } catch {}
    return false;
  }

  try {
    if (fs.existsSync(filePath) && prevCount > 0 && !prevCorrupt) {
      fs.copyFileSync(filePath, `${filePath}.bak`);
    }
    atomicWriteFile(filePath, content);
    return true;
  } catch (err) {
    console.error(`Ошибка записи ${name}:`, err);
    return false;
  }
};

/** Безопасная запись текстовых списков (pass.txt, skinlist и т.п.). */
const safeWriteLines = (filePath, lines, { allowShrink = false, label } = {}) => {
  const name = label || path.basename(filePath);
  const next = (lines || []).map((l) => String(l).trim()).filter(Boolean);
  let prev = [];
  if (fs.existsSync(filePath)) {
    prev = fs
      .readFileSync(filePath, "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }
  if (prev.length > 0 && next.length === 0) {
    console.error(`REFUSE empty write ${name}: было ${prev.length} строк`);
    return false;
  }
  if (!allowShrink && prev.length >= 10 && next.length < Math.ceil(prev.length * 0.5)) {
    console.error(`REFUSE shrink write ${name}: ${prev.length} → ${next.length}`);
    return false;
  }
  try {
    if (prev.length > 0) fs.copyFileSync(filePath, `${filePath}.bak`);
    atomicWriteFile(filePath, next.join("\n") + (next.length ? "\n" : ""));
    return true;
  } catch (err) {
    console.error(`Ошибка записи ${name}:`, err);
    return false;
  }
};

/**
 * Чтение JSON. critical=true → при битом файле бросает ошибку (чтобы вызывающий НЕ писал поверх).
 * critical=false → возвращает fallback (только для read-only ответов клиенту).
 */
const readJsonFile = (filePath, fallback, { critical = false, label } = {}) => {
  const name = label || path.basename(filePath);
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf-8").trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Ошибка парсинга ${name}:`, err);
    if (critical) {
      const e = new Error(`${name} corrupt: ${err.message}`);
      e.cause = err;
      throw e;
    }
    return fallback;
  }
};

const readPending = () => readJsonFile(PENDING_FILE, [], { label: "pending.json" });
const writePending = (data) =>
  safeWriteJson(PENDING_FILE, data, { label: "pending.json", allowShrink: true });

const findPendingByPaymentId = (paymentId) => {
  const pending = readPending();
  return pending.find((item) => item.payment_id === paymentId);
};

const isPaymentAlreadyCompleted = (paymentId) => {
  try {
    return readPayment().some((item) => item.payment_id === paymentId);
  } catch (err) {
    console.error("isPaymentAlreadyCompleted: payment.json нечитаем:", err);
    return false;
  }
};

// Функции для работы с payment.json
const readPayment = () =>
  readJsonFile(PAYMENT_FILE, [], { critical: true, label: "payment.json" });

const writePayment = (data) => safeWriteJson(PAYMENT_FILE, data, { label: "payment.json" });

const addToPayment = (paymentData) => {
  let payments;
  try {
    payments = readPayment();
  } catch (err) {
    console.error("CRITICAL: payment.json битый — платёж НЕ дописан, файл не тронут:", err);
    return false;
  }
  payments.push({
    ...paymentData,
    purchased_at: new Date().toISOString(),
    status: "completed",
  });
  return writePayment(payments);
};

const removePendingByPaymentId = (paymentId) => {
  const pending = readPending();
  const updated = pending.filter((item) => item.payment_id !== paymentId);
  writePending(updated);
};

const readIdJson = () =>
  readJsonFile(ID_JSON_FILE, {}, { critical: true, label: "id.json" });

const writeIdJson = (data) => {
  try {
    return safeWriteJson(ID_JSON_FILE, data, { label: "id.json" });
  } catch (err) {
    console.error("Ошибка записи в id.json:", err);
    return false;
  }
};

const NICKPASS_FILE = path.join(process.cwd(), "NickPass.json");
/** Read-only: при ошибке {} (не для записи!). */
const readNickPass = () =>
  readJsonFile(NICKPASS_FILE, {}, { critical: false, label: "NickPass.json" });
/** Для обновления: при битом файле throw — запись запрещена. */
const readNickPassStrict = () =>
  readJsonFile(NICKPASS_FILE, {}, { critical: true, label: "NickPass.json" });
const writeNickPass = (data) =>
  safeWriteJson(NICKPASS_FILE, data, {
    label: "NickPass.json",
    format: formatNickPassCompact,
  });

/** Ник без учёта регистра: «Ник» === «ник», «Я тебя» === «я тебя». */
const nickKey = (value) => String(value ?? "").toLowerCase();
const nicksEqual = (a, b) => nickKey(a) === nickKey(b);

/** Находит реальный ключ в NickPass.json без учёта регистра. */
const findNickPassKey = (nickPass, nickname) => {
  const raw = String(nickname ?? "");
  if (!raw) return null;
  if (Object.prototype.hasOwnProperty.call(nickPass, raw)) return raw;
  const target = nickKey(raw);
  for (const key of Object.keys(nickPass)) {
    if (nickKey(key) === target) return key;
  }
  return null;
};

const getNickPassEntry = (nickPass, nickname) => {
  const key = findNickPassKey(nickPass, nickname);
  return key ? nickPass[key] : null;
};

/**
 * Пишет пароль/роль для ника без дублей разного регистра.
 * Ключ приводится к переданному nickname (как в id.json), старый ключ удаляется.
 */
const upsertNickPassEntry = (nickPass, nickname, { password, role } = {}) => {
  const nextNick = String(nickname ?? "");
  if (!nextNick) return null;
  const existingKey = findNickPassKey(nickPass, nextNick);
  const prev = existingKey ? nickPass[existingKey] : null;
  const nextRole = role || prev?.role || "user";
  const nextPassword = password != null ? password : prev?.password ?? null;

  if (existingKey && existingKey !== nextNick) {
    delete nickPass[existingKey];
  }
  // подчистить любые другие дубли того же ника в другом регистре
  for (const key of Object.keys(nickPass)) {
    if (key !== nextNick && nicksEqual(key, nextNick)) delete nickPass[key];
  }

  nickPass[nextNick] = { password: nextPassword, role: nextRole };
  return nickPass[nextNick];
};

const addNicknameToId = (uid, nickname) => {
  try {
    if (!uid) return;
    const idStr = String(uid);
    const data = readIdJson();
    if (!data[idStr]) data[idStr] = [];
    if (!data[idStr].some((n) => nicksEqual(n, nickname))) {
      data[idStr].push(nickname);
      writeIdJson(data);
    }
  } catch (err) {
    console.error("Ошибка добавления никнейма в id.json:", err);
  }
};

// ===================== api.js SECTION =====================
const BOT_TOKEN = "8056314466:AAEZl_W6SNZKjW_axTAePBGZ6KVl0P568pM";
const GOOGLE_CLIENT_ID = "157257230972-4vh698jtf46c76sc7607oe1k9tr782je.apps.googleusercontent.com";
// VK ID — кабинет id.vk.com, приложение agar.su
const VK_APP_ID = 54069355;
const VK_CLIENT_SECRET = "wPKdbuGxJeW3h0Kg34b4";
const VK_REDIRECT_URL = "https://agar.su";
const TABLE_NAME = "users";

const VK_AVATAR_HOST_RE = /(?:^|\.)vkuserphoto\.ru$|(?:^|\.)userapi\.com$/;

const isVkAvatarUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  try {
    return VK_AVATAR_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

const avatarProxyUrl = (url, req) => {
  if (!isVkAvatarUrl(url)) return url || "";
  const base = req ? `${req.protocol}://${req.get("host")}` : "https://agar.su";
  return `${base}/api/avatar?url=${encodeURIComponent(url)}`;
};

const fetchVkAvatarUrl = async (userId, accessToken, fallback = "") => {
  try {
    const params = new URLSearchParams({
      user_ids: String(userId),
      fields: "photo_200",
      access_token: accessToken,
      v: "5.199",
    });
    const apiRes = await fetch(`https://api.vk.ru/method/users.get?${params}`);
    const apiData = await apiRes.json();
    const photo = apiData.response?.[0]?.photo_200;
    if (photo && !photo.includes("camera_")) return photo;
  } catch (err) {
    console.error("[VK auth] users.get photo failed:", err.message);
  }
  return fallback;
};

const mysqlConnection = mysql.createPool({
  host: "147.45.253.92",
  user: "gen_user",
  database: "default_db",
  password: process.env.MYSQL_PASSWORD || "",
      port: 3306,
    ssl: {
        rejectUnauthorized: false
    },
  connectionLimit: 1000,
  connectTimeout: 60 * 60 * 1000,
  acquireTimeout: 60 * 60 * 1000,
  timeout: 60 * 60 * 1000,
});
mysqlConnection.getConnection((err) => {
  if (err) console.log(`Mysql connection failed: ${err.message}`);
  else console.log("Mysql connection opened!");
});

mysqlConnection.query(
  `ALTER TABLE ${TABLE_NAME} ADD COLUMN restored_at DATETIME NULL DEFAULT NULL`,
  (alterErr) => {
    if (alterErr && alterErr.code !== "ER_DUP_FIELDNAME") {
      console.error("[users] restored_at migration:", alterErr.message);
    }
  }
);

const mysqlActions = {
  GET_USER_DATA: (from, data, cb) => {
    mysqlConnection.query(`SELECT ${data.SELECT} FROM ${from} WHERE ${data.WHERE}`, cb);
  },
  UPDATE_USER_DATA: (from, SET, WHERE, cb) => {
    mysqlConnection.query(`UPDATE ${from} SET ? WHERE ?`, [SET, WHERE], cb);
  },
  CREATE_USER_DATA: (from, data, cb) => {
    mysqlConnection.query(`INSERT INTO ${from} SET ?`, data, cb);
  },
};

const generateToken = (len = 20) => {
  let token = "";
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < len; i++)
    token += chars[~~(Math.random() * chars.length)];
  return token;
};
function formatMntAmount(amount) {
  return Number(amount).toFixed(2);
}

// Подпись платёжной формы MONETA.Assistant
function generatePayAnyWayFormSignature(mntId, transactionId, amount, currencyCode, testMode, integrityCode) {
  const signString = `${mntId}${transactionId}${formatMntAmount(amount)}${currencyCode}${testMode}${integrityCode}`;
  return crypto.createHash("md5").update(signString).digest("hex");
}

// Подпись уведомления Pay URL (документация Moneta + вариант без MNT_SUBSCRIBER_ID)
function generatePayAnyWayNotificationSignature(data, integrityCode, includeSubscriber = true) {
  const mntId = String(data.MNT_ID ?? "");
  const transactionId = String(data.MNT_TRANSACTION_ID ?? "");
  const operationId = String(data.MNT_OPERATION_ID ?? "");
  const amount = formatMntAmount(data.MNT_AMOUNT ?? "0");
  const currencyCode = String(data.MNT_CURRENCY_CODE ?? "RUB");
  const subscriberId = String(data.MNT_SUBSCRIBER_ID ?? "");
  const testMode = String(data.MNT_TEST_MODE ?? "0");
  const subscriberPart = includeSubscriber ? subscriberId : "";
  const signString = `${mntId}${transactionId}${operationId}${amount}${currencyCode}${subscriberPart}${testMode}${integrityCode}`;
  return crypto.createHash("md5").update(signString).digest("hex");
}

function isPayAnyWayNotificationSignatureValid(data, integrityCode) {
  const received = String(data.MNT_SIGNATURE ?? "").toLowerCase();
  if (!received) return false;
  const variants = [
    generatePayAnyWayNotificationSignature(data, integrityCode, true),
    generatePayAnyWayNotificationSignature(data, integrityCode, false),
  ];
  return variants.some((sign) => sign.toLowerCase() === received);
}

function getPayAnyWayWebhookData(req) {
  return { ...req.query, ...req.body };
}

function sendPayAnyWayWebhookResponse(res, text) {
  res.status(200).type("text/plain; charset=utf-8").send(text);
}

function buildPayAnyWayPaymentUrl(transactionId, amount, options = {}) {
  const currency = "RUB";
  const formattedAmount = formatMntAmount(amount);
  const email = String(options.email || "").trim().toLowerCase();
  const description = String(options.description || transactionId).slice(0, 500);
  const signature = generatePayAnyWayFormSignature(
    PAW_MNT_ID,
    transactionId,
    formattedAmount,
    currency,
    PAW_TEST_MODE,
    PAW_INTEGRITY_CODE
  );

  const params = new URLSearchParams({
    MNT_ID: PAW_MNT_ID,
    MNT_TRANSACTION_ID: transactionId,
    MNT_AMOUNT: formattedAmount,
    MNT_CURRENCY_CODE: currency,
    MNT_TEST_MODE: PAW_TEST_MODE,
    MNT_DESCRIPTION: description,
    MNT_SUCCESS_URL: PAW_SUCCESS_URL,
    MNT_SIGNATURE: signature,
  });

  // PayAnyWay / kassa: email покупателя для чека ОФД (MNT_CUSTOM2.customer)
  // https://docs.payanyway.ru/.../formirovanie-cheka-v-kkt-prodavca
  if (email) {
    params.set(
      "MNT_CUSTOM2",
      JSON.stringify({
        customer: email,
        items: [
          {
            n: description,
            p: formattedAmount,
            q: "1",
            t: "1105",
          },
        ],
      })
    );
  }

  return `${PAW_ASSISTANT_URL}?${params.toString()}`;
}

function checkTelegramAuth(data) {
  const { hash, ...userData } = data;
  const dataCheckString = Object.keys(userData)
    .sort()
    .map((k) => `${k}=${userData[k]}`)
    .join("\n");
  const secret = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  return hmac === hash;
}

const deleteUserByUid = (uid, cb) => {
  mysqlConnection.query(`DELETE FROM ${TABLE_NAME} WHERE uid = ?`, [uid], cb);
};

// Привязка старого аккаунта (Google/Telegram) к VK: тот же uid, XP и ники в id.json
const relinkAccountToVk = (vkUser, oldUser, res) => {
  if (String(vkUser.uid) === String(oldUser.uid)) {
    return res.status(400).json({ error: "Этот аккаунт уже привязан к VK" });
  }
  if (!String(vkUser.account_id).startsWith("vk_")) {
    return res.status(400).json({ error: "Сначала войдите через VK" });
  }
  if (String(oldUser.account_id).startsWith("vk_")) {
    return res.status(400).json({ error: "Можно восстановить только с Google или Telegram" });
  }
  if (oldUser.restored_at) {
    return res.status(400).json({ error: "Этот аккаунт уже был восстановлен" });
  }

  const newToken = generateToken();
  const vkAccountId = vkUser.account_id;
  const restoredAt = new Date();

  deleteUserByUid(vkUser.uid, (delErr) => {
    if (delErr) return res.status(500).json({ error: delErr.errno || delErr.message });

    mysqlActions.UPDATE_USER_DATA(
      TABLE_NAME,
      {
        account_id: vkAccountId,
        account_name: vkUser.account_name,
        account_avatar: vkUser.account_avatar,
        token: newToken,
        restored_at: restoredAt,
      },
      { uid: oldUser.uid },
      (updErr) => {
        if (updErr) return res.status(500).json({ error: updErr.errno || updErr.message });
        res.json({
          ok: true,
          token: newToken,
          uid: oldUser.uid,
          xp: oldUser.xp,
          restored_at: restoredAt,
          message: `Аккаунт привязан к VK. Ваш ID: ${oldUser.uid}`,
        });
      }
    );
  });
};

const findUserByAccountId = (account_id, cb) => {
  mysqlActions.GET_USER_DATA(
    TABLE_NAME,
    { SELECT: "*", WHERE: `account_id="${account_id}"` },
    (err, result) => {
      if (err) return cb(err);
      cb(null, result?.[0] || null);
    }
  );
};

app.get("/api/auth/vk-config", (req, res) => {
  res.json({ appId: Number(VK_APP_ID), redirectUrl: VK_REDIRECT_URL });
});

const upsertAuthUser = (account_id, account_name, account_avatar, res) => {
  const token = generateToken();
  mysqlActions.GET_USER_DATA(
    TABLE_NAME,
    { SELECT: "uid", WHERE: `account_id="${account_id}"` },
    (err, result) => {
      if (err) return res.send({ error: err.errno });
      if (result.length) {
        mysqlActions.UPDATE_USER_DATA(
          TABLE_NAME,
          { token, account_name, account_avatar },
          { account_id },
          (uErr) => {
            if (uErr) return res.send({ error: uErr.errno });
            res.json({ ok: true, token });
          }
        );
      } else {
        mysqlActions.CREATE_USER_DATA(
          TABLE_NAME,
          { account_id, account_name, account_avatar, token },
          (cErr) => {
            if (cErr) return res.send({ error: cErr.errno });
            res.json({ ok: true, token });
          }
        );
      }
    }
  );
};

app.post("/api/auth/vk", async (req, res) => {
  const { code, device_id, code_verifier, state } = req.body;
  if (!code || !device_id || !code_verifier || !state) {
    return res.status(400).json({ error: "Missing VK auth parameters" });
  }
  if (!VK_APP_ID) {
    return res.status(503).json({ error: "VK ID not configured on server" });
  }
  try {
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code_verifier: code_verifier,
      redirect_uri: VK_REDIRECT_URL,
      code,
      client_id: String(VK_APP_ID),
      client_secret: VK_CLIENT_SECRET,
      device_id,
      state,
    });
    const tokenRes = await fetch("https://id.vk.ru/oauth2/auth", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error) {
      console.error("[VK auth] token exchange failed:", tokenData);
      return res.status(403).json({
        error: tokenData.error_description || tokenData.error || "VK token exchange failed",
      });
    }
    if (tokenData.state && tokenData.state !== state) {
      return res.status(403).json({ error: "Invalid VK state" });
    }

    const userBody = new URLSearchParams({
      client_id: String(VK_APP_ID),
      access_token: tokenData.access_token,
    });
    const userRes = await fetch("https://id.vk.ru/oauth2/user_info?cs=360x360", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: userBody.toString(),
    });
    const userData = await userRes.json();
    if (!userRes.ok || !userData.user) {
      console.error("[VK auth] user_info failed:", userData);
      return res.status(403).json({ error: "Failed to get VK user info" });
    }

    const vkUser = userData.user;
    const account_id = `vk_${vkUser.user_id}`;
    const account_name = [vkUser.first_name, vkUser.last_name].filter(Boolean).join(" ").trim() || "VK User";
    const account_avatar = await fetchVkAvatarUrl(
      vkUser.user_id,
      tokenData.access_token,
      vkUser.avatar || ""
    );

    upsertAuthUser(account_id, account_name, account_avatar, res);
  } catch (error) {
    console.error("[VK auth] error:", error);
    res.status(500).json({ error: "VK authentication failed" });
  }
});

const getValidAuthToken = (Authorization) => {
  if (typeof Authorization !== "string") return null;
  if (!Authorization.startsWith("Game ")) return null;
  const token = Authorization.slice(5).trim();
  if (!/^[A-Za-z0-9]{20}$/.test(token)) return null;
  return token;
};

const authRequired = (req, res, next) => {
  const token = getValidAuthToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: "Bad authorization token" });
  mysqlActions.GET_USER_DATA(
    TABLE_NAME,
    { SELECT: "*", WHERE: `token="${token}"` },
    (err, result) => {
      if (err) return res.status(500).json({ error: err.errno || err.message });
      if (!result || result.length !== 1)
        return res.status(401).json({ error: "Unauthorized token" });
      req.user = result[0];
      next();
    }
  );
};

app.post("/api/me/restore/telegram", authRequired, (req, res) => {
  const user = req.body;
  if (!user || !user.hash) return res.status(400).json({ error: "Нет данных Telegram" });
  if (!checkTelegramAuth(user)) return res.status(403).json({ error: "Неверная подпись Telegram" });
  findUserByAccountId(String(user.id), (err, sourceUser) => {
    if (err) return res.status(500).json({ error: err.errno || err.message });
    if (!sourceUser) {
      return res.status(404).json({ error: "Аккаунт Telegram не найден" });
    }
    relinkAccountToVk(req.user, sourceUser, res);
  });
});

app.post("/api/me/restore/google", authRequired, async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Нет данных Google" });
  try {
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
    );
    const userInfo = response.data;
    if (userInfo.aud !== GOOGLE_CLIENT_ID) {
      return res.status(403).json({ error: "Неверный Google client ID" });
    }
    findUserByAccountId(String(userInfo.sub), (err, sourceUser) => {
      if (err) return res.status(500).json({ error: err.errno || err.message });
      if (!sourceUser) {
        return res.status(404).json({ error: "Аккаунт Google не найден" });
      }
      relinkAccountToVk(req.user, sourceUser, res);
    });
  } catch (error) {
    res.status(500).json({ error: "Ошибка проверки Google" });
  }
});

app.get("/api/me/nicknames", authRequired, (req, res) => {
  try {
    const uid = String(req.user.uid);
    const idMap = readIdJson();
    const nickPass = readNickPass();
    const myList = (idMap[uid] || []).map((nick) => ({
      nickname: nick,
      // пароль ищем без учёта регистра: ник в id.json может быть «ASDAS», в NickPass — «asdas»
      password: getNickPassEntry(nickPass, nick)?.password ?? null,
    }));
    return res.json({ nicknames: myList });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.get("/api/me/login", (req, res) => {
  const token = getValidAuthToken(req.headers.authorization);
  if (!token) return res.send({ error: "Bad authorization token" });
  mysqlActions.GET_USER_DATA(
    TABLE_NAME,
    { SELECT: "*", WHERE: `token="${token}"` },
    (err, result) => {
      if (err) res.send({ error: err.errno });
      else if (result.length === 1) {
        const user = result[0];
        res.send({ ...user, account_avatar: avatarProxyUrl(user.account_avatar, req) });
      } else res.send({ error: "Unauthorized token", status: 401 });
    }
  );
});

app.get("/api/me/logout", (req, res) => {
  const token = getValidAuthToken(req.headers.authorization);
  if (!token) return res.send({ error: "Bad authorization token" });
  mysqlActions.UPDATE_USER_DATA(TABLE_NAME, { token: "" }, { token }, (err, result) => {
    if (err) res.send({ error: err.errno });
    else if (result.changedRows) res.send({ ok: true });
    else res.send({ error: "Unauthorized token", status: 401 });
  });
});

app.get("/api/top100", (req, res) => {
  const query = `
        SELECT uid, account_name, account_avatar, xp
        FROM ${TABLE_NAME}
        ORDER BY xp DESC
        LIMIT 100
    `;
  mysqlConnection.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    const top100 = results.map((user, index) => ({
      position: index + 1,
      uid: user.uid,
      account_name: user.account_name,
      account_avatar: avatarProxyUrl(user.account_avatar, req),
      xp: user.xp,
    }));
    res.json(top100);
  });
});

app.get("/api/avatar", async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== "string") return res.status(400).end();
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return res.status(400).end();
  }
  if (!VK_AVATAR_HOST_RE.test(url.hostname)) return res.status(403).end();
  try {
    const imgRes = await fetch(url.toString(), {
      headers: {
        Referer: "https://vk.ru/",
        "User-Agent": "Mozilla/5.0 (compatible; agar.su/1.0)",
      },
    });
    if (!imgRes.ok) return res.status(imgRes.status).end();
    res.set("Cache-Control", "public, max-age=3600");
    res.set("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
    res.send(Buffer.from(await imgRes.arrayBuffer()));
  } catch (err) {
    console.error("[avatar proxy] error:", err.message);
    res.status(502).end();
  }
});

// === НОВАЯ ЛОГИКА: Покупка без авторизации ===
app.post("/create-payment", upload.single("image"), async (req, res) => {
  try {
    const { name, password, email: rawEmail } = req.body;
    const email = String(rawEmail || "").trim().toLowerCase();
    const invisible = req.body.invisible === "1";
	const rotation = req.body.rotation === "1";
    const file = req.file;
    const token = getValidAuthToken(req.headers.authorization);
    let uid = null;

if (file) {
  const filePath = path.join(UPLOAD_DIR, file.filename);
  
  // Проверка: файл существует и не пустой
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    if (file) fs.unlinkSync(filePath);
    return res.status(400).json({ error: "Файл не загрузился, попробуйте ещё раз" });
  }
}

    // === Проверка авторизации ===
    if (token) {
      const result = await new Promise((resolve) => {
        mysqlActions.GET_USER_DATA(
          TABLE_NAME,
          { SELECT: "uid", WHERE: `token="${token}"` },
          (err, result) => resolve(err ? null : result)
        );
      });
      if (!result || result.length !== 1) {
        if (file) fs.unlinkSync(file.path);
        return res.status(401).json({ error: "Неверный токен" });
      }
      uid = String(result[0].uid);
    }

    // === Валидация входных данных ===
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ error: "Введите корректный email" });
    }
    if (!name) return res.status(400).json({ error: "Введите ник" });
    if (!password && !file && !invisible && !rotation)
      return res.status(400).json({ error: "Выберите хотя бы пароль или скин" });
    if (password && password.length > 5)
      return res.status(400).json({ error: "Пароль до 5 символов" });

    const nameOk = isAllowedNickname(name, true);
    const passwordOk = !password || isAllowedNickname(password);
    if (!nameOk || !passwordOk) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ error: "Ник содержит недопустимые символы" });
    }

    const nickname = name.trim() || "Без_ника";
    const nicknameLower = nickKey(nickname);
    const regex = /^\[[^\[\]]+\]$/;
    if (nickname.includes("[") && !regex.test(nickname)) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ error: "Некорректный ник. Допустим только формат [тег]" });
    }

    // === Проверка занятости ника ===
    const idData = readIdJson();
    const allNicks = Object.values(idData).flat();
    const isTakenGlobally = allNicks.some((n) => nickKey(n) === nicknameLower);
    let isOwnNickname = false;

    if (uid && isTakenGlobally) {
      const userNicks = idData[uid] || [];
      isOwnNickname = userNicks.some((n) => nickKey(n) === nicknameLower);
    }

    // Если ник занят и НЕ твой — запрещаем
    if (isTakenGlobally && !isOwnNickname) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ error: "Этот ник уже занят" });
    }

    // === Расчёт цены ===
    let price = 0;
    let ext = null;
    const receiptParts = [];

    if (file) {
      ext = file.originalname.split(".").pop().toLowerCase();
      if (["png", "jpg"].includes(ext)) {
        price += 150;
        receiptParts.push("Скин");
      } else if (ext === "gif") {
        price += 4500;
        receiptParts.push("Скин GIF");
      } else {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: "Неверный формат файла" });
      }
    }
    if (password) {
      price += 150;
      receiptParts.push("Пароль");
    }
    if (invisible) {
      price += 500;
      receiptParts.push("Невидимый ник");
    }
	if (rotation) {
      price += 500;
      receiptParts.push("Поворот скина");
    }
    if (regex.test(nickname)) price *= 2;
    price = Number(price).toFixed(2);
    const receiptDescription = (receiptParts.length
      ? `agar.su: ${receiptParts.join(", ")}`
      : "Покупка в магазине agar.su"
    ).slice(0, 128);

    // ==============================================
    // Создание платежа через Self.PayAnyWay (MONETA.Assistant)
    // ==============================================
    const paymentId = `agar-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const confirmationUrl = buildPayAnyWayPaymentUrl(paymentId, price, {
      email,
      description: receiptDescription,
    });
    const internalId = Math.round(Math.random() * 1e9);

    // Сохраняем в pending
    const tempData = {
      nickname,
      password: password || null,
      file: file ? file.filename : null,
      ext,
      internal_id: internalId,
      payment_id: paymentId,          // совпадает с тем, что придёт в MERCHANT_ORDER_ID
      uid: uid || null,
      invisible: invisible,
	  rotation: rotation,
      email,
      amount: price,
	  ip: String(req.ip || (req.connection && req.connection.remoteAddress) || "127.0.0.1").replace(/^::ffff:/, "")
    };

    const pending = readPending();
    pending.push(tempData);
    writePending(pending);

    // Успешный ответ клиенту
    res.json({
      confirmation: {
        type: "redirect",
        confirmation_url: confirmationUrl,
      },
      id: paymentId
    });

  } catch (err) {
    console.error("Ошибка в /create-payment:", err);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

function fulfillPayment(paymentId, meta = {}) {
  if (isPaymentAlreadyCompleted(paymentId)) {
    console.log(`Платёж ${paymentId} уже был обработан ранее`);
    return true;
  }

  const pendingItem = findPendingByPaymentId(paymentId);

  if (!pendingItem) {
    console.log(`Не найден pending по MNT_TRANSACTION_ID: ${paymentId}`);
    return false;
  }

  if (pendingItem.file) {
    const oldPath = path.join(UPLOAD_DIR, pendingItem.file);
    const newPath = path.join(SKINS_DIR, `${pendingItem.internal_id}.${pendingItem.ext}`);
    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);

    let skinlist = [];
    if (fs.existsSync(ROOT_SKINLIST_FILE)) {
      skinlist = fs.readFileSync(ROOT_SKINLIST_FILE, "utf-8").split("\n").filter(Boolean);
    }
    let oldCode = null;
    skinlist = skinlist.map((line) => {
      const [nick, code] = line.split(":");
      if (nicksEqual(nick, pendingItem.nickname)) {
        oldCode = code;
        return `${nick}:${pendingItem.internal_id}`;
      }
      return line;
    });
    if (!oldCode) skinlist.push(`${pendingItem.nickname}:${pendingItem.internal_id}`);
    safeWriteLines(ROOT_SKINLIST_FILE, skinlist, { label: "skinlist.txt" });
  }

  if (pendingItem.password) {
    // НИКОГДА не пишем поверх при битом JSON и не используем ручной формат ключей
    // (баг с ником "\" затирал весь NickPass.json).
    try {
      const nickPass = readNickPassStrict();
      const prev = getNickPassEntry(nickPass, pendingItem.nickname);
      upsertNickPassEntry(nickPass, pendingItem.nickname, {
        password: pendingItem.password,
        role: prev?.role || "user",
      });
      if (!writeNickPass(nickPass)) {
        console.error(
          `CRITICAL: пароль для «${pendingItem.nickname}» НЕ записан — NickPass.json сохранён без изменений`
        );
      }
    } catch (err) {
      console.error(
        "CRITICAL: NickPass.json битый — пароль НЕ записан, файл НЕ тронут:",
        err
      );
    }

    try {
      const passFile = path.join(process.cwd(), "public/pass.txt");
      let passList = [];
      if (fs.existsSync(passFile)) {
        passList = fs
          .readFileSync(passFile, "utf-8")
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean);
      }
      if (!passList.some((n) => nicksEqual(n, pendingItem.nickname))) {
        passList.push(pendingItem.nickname);
        safeWriteLines(passFile, passList, { label: "pass.txt" });
      }
    } catch (err) {
      console.error("Ошибка при записи в pass.txt:", err);
    }
  }

  if (pendingItem.invisible) {
    let list = [];
    if (fs.existsSync(INVISIBLE_FILE)) {
      list = fs
        .readFileSync(INVISIBLE_FILE, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    }
    if (!list.some((n) => nicksEqual(n, pendingItem.nickname))) {
      list.push(pendingItem.nickname);
      safeWriteLines(INVISIBLE_FILE, list, { label: "invisible.txt" });
    }
  }

  if (pendingItem.rotation) {
    let rotationList = [];
    if (fs.existsSync(ROTATION_FILE)) {
      rotationList = fs
        .readFileSync(ROTATION_FILE, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    }
    if (!rotationList.some((n) => nicksEqual(n, pendingItem.nickname))) {
      rotationList.push(pendingItem.nickname);
      safeWriteLines(ROTATION_FILE, rotationList, { label: "rotation.txt" });
    }
  }

  if (pendingItem.uid && pendingItem.nickname) {
    addNicknameToId(pendingItem.uid, pendingItem.nickname);
  }

  const paymentRecord = {
    payment_id: paymentId,
    merchant_id: meta.mntId || PAW_MNT_ID,
    amount: meta.amount ?? pendingItem.amount,
    operation_id: meta.operationId || null,
    nickname: pendingItem.nickname,
    password: pendingItem.password,
    has_skin: !!pendingItem.file,
    skin_file: pendingItem.file ? `https://api.agar.su/skins/${pendingItem.internal_id}.${pendingItem.ext}` : null,
    skin_ext: pendingItem.ext || null,
    uid: pendingItem.uid,
    invisible: pendingItem.invisible,
    rotation: pendingItem.rotation,
    email: pendingItem.email || null,
    ip: pendingItem.ip,
    timestamp: new Date().toISOString()
  };

  addToPayment(paymentRecord);
  console.log(`✅ Платёж ${paymentId} сохранён в payment.json`);
  removePendingByPaymentId(paymentId);
  return true;
}

// Pay URL для Self.PayAnyWay — указать в личном кабинете:
// https://agar.su/webhook-payanyway
function handlePayAnyWayWebhook(req, res) {
  try {
    const data = getPayAnyWayWebhookData(req);

    // Проверочный запрос при сохранении Pay URL в кабинете Moneta
    if (!data.MNT_TRANSACTION_ID) {
      return sendPayAnyWayWebhookResponse(res, "SUCCESS");
    }

    const {
      MNT_ID,
      MNT_TRANSACTION_ID,
      MNT_OPERATION_ID,
      MNT_AMOUNT,
      MNT_SIGNATURE,
    } = data;

    console.log("[Pay URL]", MNT_TRANSACTION_ID, "op:", MNT_OPERATION_ID, "amount:", MNT_AMOUNT);

    if (!MNT_TRANSACTION_ID || !MNT_AMOUNT || !MNT_SIGNATURE) {
      console.log("Неполные данные в Pay URL webhook", data);
      return sendPayAnyWayWebhookResponse(res, "FAIL");
    }

    if (!isPayAnyWayNotificationSignatureValid(data, PAW_INTEGRITY_CODE)) {
      console.log(`Неверная подпись для заказа ${MNT_TRANSACTION_ID}`);
      console.log("Получено  :", String(MNT_SIGNATURE).toLowerCase());
      console.log("Ожидалось (с subscriber):", generatePayAnyWayNotificationSignature(data, PAW_INTEGRITY_CODE, true).toLowerCase());
      console.log("Ожидалось (без subscriber):", generatePayAnyWayNotificationSignature(data, PAW_INTEGRITY_CODE, false).toLowerCase());
      return sendPayAnyWayWebhookResponse(res, "FAIL");
    }

    const ok = fulfillPayment(MNT_TRANSACTION_ID, {
      mntId: MNT_ID,
      amount: MNT_AMOUNT,
      operationId: MNT_OPERATION_ID,
    });

    if (!ok) {
      console.log(`[Pay URL] fulfillPayment не выполнен для ${MNT_TRANSACTION_ID} — проверьте pending.json`);
    }

    return sendPayAnyWayWebhookResponse(res, ok ? "SUCCESS" : "FAIL");
  } catch (err) {
    console.error("Ошибка в Pay URL webhook:", err);
    return sendPayAnyWayWebhookResponse(res, "FAIL");
  }
}

app.get("/webhook-payanyway", handlePayAnyWayWebhook);
app.post("/webhook-payanyway", handlePayAnyWayWebhook);

// Проверка ника — теперь и без авторизации
app.post("/check-nickname", (req, res) => {
  try {
    const { nickname } = req.body;
    if (!nickname) return res.json({ taken: false, error: "Ник пустой" });
    const forbidden = /[`'";:ㅤ⁣]/;
    if (forbidden.test(nickname)) {
      return res.json({ taken: true, error: "Запрещённые символы" });
    }
    const idData = readIdJson();
    const nickTrimmed = nickKey(nickname.trim());
    const taken = Object.values(idData)
      .flat()
      .some((n) => nickKey(n) === nickTrimmed);
    return res.json({ taken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ taken: true, error: "Ошибка сервера" });
  }
});

app.get("/online", (req, res) => {
  handleOnlineRequest(req, res);
});

app.use("/stats-api", (req, res) => {
  const requestUrl = req.url || "/";
  req.url = requestUrl.startsWith("/api/") || requestUrl === "/api"
    ? requestUrl
    : "/api" + requestUrl;
  handleStatsRequest(req, res);
});

app.get("/usersp", (req, res) => {
  const clientIP = req.ip.replace("::ffff:", "");
  if (!allowedIPs.includes(clientIP)) {
    return res.status(403).send("Forbidden: IP не разрешён");
  }
  if (req.headers["x-auth-token"] !== SECRET) {
    return res.status(403).send("Forbidden: неверный токен");
  }
  fs.readFile("./NickPass.json", "utf8", (err, data) => {
    if (err) return res.status(500).send("Ошибка сервера");
    res.setHeader("Content-Type", "application/json");
    // Отдаём и оригинальный ключ, и lower-case — «Ник» и «ник» оба найдут пароль
    try {
      const parsed = JSON.parse(data);
      const out = {};
      for (const [key, value] of Object.entries(parsed)) {
        out[key] = value;
        const lower = nickKey(key);
        if (!Object.prototype.hasOwnProperty.call(out, lower)) {
          out[lower] = value;
        }
      }
      return res.send(JSON.stringify(out));
    } catch {
      return res.send(data);
    }
  });
});

startOnlinePolling();
startStatsPolling().catch((err) => console.error("Stats init failed:", err));

http.createServer(app).listen(Number(process.env.PORT || 8080), "127.0.0.1", () => {
  console.log(`Server running on http://127.0.0.1:${process.env.PORT || 8080}`);
}); 