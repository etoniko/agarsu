#!/usr/bin/env node
/** https://api.agar.su/online — читает online.json, опрос domain/process каждые 15 сек */
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// bots — вычесть из playing (не показывать в онлайне)
// splitSpect: true — нет раздельного spect (Petri и т.п.): 40% → no_playing, 60% → playing
const SERVERS = [
  { id: "hardcore", domain: "sixz.ru:6017/hc", max: 600, bots: 0 },

  { id: "ffa", domain: "ffa.agar.su", max: 200, bots: 5 },
  { id: "ms", domain: "ms.agar.su:6001", max: 120, bots: 20 },
  { id: "pvp1", domain: "ms.agar.su:6004", max: 50, bots: 0 },
  { id: "pvp2", domain: "ms.agar.su:6005", max: 50, bots: 0 },
  { id: "tournament", domain: "ms.agar.su:6002", max: 100, bots: 0 },
  { id: "tournament2", domain: "ms.agar.su:6003", max: 100, bots: 0 },
  { id: "hardcore9", domain: "sixz.ru:6011/hardcore9", max: 200, bots: 20, splitSpect: true },
  { id: "megasplit5k1", domain: "sixz.ru:6011/megasplit5k1", max: 250, bots: 0, splitSpect: true },
  { id: "tatil", domain: "sixz.ru:6013/tatil", max: 200, bots: 0 },
  { id: "gsz1", domain: "sixz.ru:6013/gsz1", max: 200, bots: 0 },
  { id: "ffa1", domain: "sixz.ru:6013/ffa1", max: 200, bots: 0 },
  { id: "ffa4", domain: "sixz.ru:6013/ffa4", max: 200, bots: 0 },
  { id: "ffa5", domain: "sixz.ru:6013/ffa5", max: 200, bots: 0 },
  { id: "ffa57", domain: "sixz.ru:6013/ffa57", max: 200, bots: 0 },
  { id: "ffa21", domain: "sixz.ru:6013/ffa21", max: 200, bots: 0 },
  { id: "ffa54", domain: "sixz.ru:6013/ffa54", max: 200, bots: 0 },
  // Europe — working only (agar.live via sixz + delta)
  { id: "ultra", domain: "xn--bdk.pw:6015/pop2", max: 200, bots: 0 },
  { id: "pop1", domain: "xn--bdk.pw:6015/pop1", max: 200, bots: 0 },
  { id: "liveffa1", domain: "xn--bdk.pw:6015/ffa1", max: 200, bots: 0 },
  { id: "liveffa2", domain: "xn--bdk.pw:6015/ffa2", max: 200, bots: 0 },
  { id: "darctida", domain: "xn--bdk.pw:6014/darctida", max: 200, bots: 0 },
  { id: "dffa", domain: "xn--bdk.pw:6014/dffa", max: 200, bots: 0 },
  { id: "drookery", domain: "xn--bdk.pw:6014/drookery", max: 200, bots: 0 },
];

const SPECT_RATIO = 0.4; // только для splitSpect

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POLL_MS = 15000;
const DATA_FILE = path.join(__dirname, "online.json");
const SSL_KEY = "/etc/letsencrypt/live/agar.su/privkey.pem";
const SSL_CERT = "/etc/letsencrypt/live/agar.su/fullchain.pem";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function readOnline() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { servers: [], updatedAt: 0 };
  }
}

function writeOnline(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/** Общий онлайн без spect → 60% playing + 40% no_playing */
function splitOnline(rawTotal) {
  const total = Math.max(0, rawTotal | 0);
  const no_playing = Math.round(total * SPECT_RATIO);
  const playing = Math.max(0, total - no_playing);
  return { playing, no_playing };
}

function fetchProcess(domain) {
  return new Promise((resolve, reject) => {
    const u = new URL(/^https?:\/\//i.test(domain) ? domain : "https://" + domain);
    const basePath = (u.pathname || "/").replace(/\/+$/, "") || "";
    u.pathname = basePath + "/process";

    const opts = {
      timeout: 8000,
      headers: { Host: u.hostname, Accept: "application/json" },
      agent: u.protocol === "https:" ? httpsAgent : undefined,
    };

    const req = (u.protocol === "http:" ? http : https).get(u, opts, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error("HTTP " + res.statusCode + " " + raw.slice(0, 100)));
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error("bad json: " + raw.slice(0, 100)));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function poll() {
  const servers = [];
  for (const s of SERVERS) {
    try {
      const d = await fetchProcess(s.domain);
      const bots = Math.max(0, s.bots | 0);
      let playing;
      let no_playing;

      if (s.splitSpect) {
        // hardcore / megasplit: только общее число → 40% глаза
        const rawTotal = Math.max(0, (d.playing | 0) + (d.no_playing | 0) - bots);
        ({ playing, no_playing } = splitOnline(rawTotal));
      } else {
        // AgarZ и остальные: реальные play / spect
        playing = Math.max(0, (d.playing | 0) - bots);
        no_playing = Math.max(0, d.no_playing | 0);
      }

      servers.push({
        id: s.id,
        name: s.name || s.id,
        playing,
        no_playing,
        connected: playing + no_playing,
        max: s.max | 0,
        bots,
      });
    } catch (e) {
      // skip offline / unreachable
    }
  }
  servers.sort((a, b) => a.id.localeCompare(b.id));
  const data = { servers, updatedAt: Date.now() };
  writeOnline(data);
}

function onRequest(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const p = (req.url || "/").split("?")[0];
  if (req.method === "GET" && p === "/online") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(readOnline()));
    return;
  }
  res.writeHead(404);
  res.end();
}

function startPolling() {
  poll();
  setInterval(poll, POLL_MS);
}

export { onRequest, startPolling, SERVERS, splitOnline };
