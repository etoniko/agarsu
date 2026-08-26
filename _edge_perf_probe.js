/**
 * Launch Edge with remote debugging, open local game ?perf=1, spectate, sample __perfStats.
 * Usage: node _edge_perf_probe.js [seconds=12]
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const EDGE =
  process.env.EDGE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = Number(process.env.CDP_PORT || 9333);
const URL = process.env.GAME_URL || "http://127.0.0.1:8765/?perf=1";
const SECONDS = Math.max(5, Number(process.argv[2] || 12));
const PROFILE = path.join(os.tmpdir(), `edge-perf-probe-${PORT}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse failed for ${url}: ${data.slice(0, 200)}`));
          }
        });
      })
      .on("error", reject);
  });
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  ready() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", (e) => reject(e), { once: true });
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.text || "evaluate exception");
    }
    return r.result && r.result.value;
  }
  close() {
    try {
      this.ws.close();
    } catch (_) {}
  }
}

function statsSummary(samples, key) {
  const vals = samples.map((s) => s[key]).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!vals.length) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const sum = vals.reduce((a, b) => a + b, 0);
  return {
    min: sorted[0],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    max: sorted[sorted.length - 1],
    avg: sum / vals.length
  };
}

async function waitForDebugger(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ver = await httpGetJson(`http://127.0.0.1:${PORT}/json/version`);
      if (ver && ver.webSocketDebuggerUrl) return ver;
    } catch (_) {}
    await sleep(250);
  }
  throw new Error("Edge CDP not ready");
}

async function getPageTarget() {
  const list = await httpGetJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
  if (!page) throw new Error("No page target");
  return page;
}

async function main() {
  fs.mkdirSync(PROFILE, { recursive: true });
  console.log(`[edge-perf] launching Edge profile=${PROFILE}`);
  const child = spawn(
    EDGE,
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-popup-blocking",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      URL
    ],
    { detached: true, stdio: "ignore" }
  );
  child.unref();

  try {
    await waitForDebugger();
    await sleep(1500);
    let page = await getPageTarget();
    // Prefer the game tab
    const list = await httpGetJson(`http://127.0.0.1:${PORT}/json/list`);
    page =
      list.find((t) => t.type === "page" && /8765|agar/i.test(t.url || "")) ||
      list.find((t) => t.type === "page" && t.webSocketDebuggerUrl) ||
      page;

    console.log(`[edge-perf] page=${page.url}`);
    const cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");

    // Ensure URL
    if (!/8765/.test(page.url || "")) {
      await cdp.send("Page.navigate", { url: URL });
      await sleep(2500);
    } else {
      await sleep(1500);
    }

    // Spectate into live world
    const boot = await cdp.evaluate(`(async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 40; i++) {
        if (typeof spectate === 'function' || typeof startGame === 'function') break;
        await wait(250);
      }
      try { if (typeof spectate === 'function') spectate(); } catch (e) {}
      await wait(2000);
      const overlay = document.getElementById('perf-overlay');
      return {
        hasSpectate: typeof spectate === 'function',
        overlay: overlay ? overlay.textContent : null,
        href: location.href,
        readyState: document.readyState
      };
    })()`);
    console.log("[edge-perf] boot:", JSON.stringify(boot, null, 2));

    const samples = [];
    const tEnd = Date.now() + SECONDS * 1000;
    console.log(`[edge-perf] sampling ${SECONDS}s ...`);
    while (Date.now() < tEnd) {
      const s = await cdp.evaluate(`(() => {
        const p = window.__perfStats || null;
        const overlay = document.getElementById('perf-overlay');
        const S = (window.gameState || window.S || null);
        let fps = p && p.fps;
        let nodes = p && p.nodes;
        let webgl = p && p.webgl;
        let ws = null;
        try {
          const st = (typeof getGameState === 'function' && getGameState()) || window.__GAME__ || null;
        } catch (_) {}
        // try common globals used by this client
        try {
          if (overlay && overlay.textContent) {
            const m = overlay.textContent.match(/ws (worker|main)/);
            if (m) ws = m[1];
          }
        } catch (_) {}
        return p ? {
          fps: p.fps,
          nodes: p.nodes,
          drawn: p.drawn,
          preMs: p.preMs,
          gridMs: p.gridMs,
          sortMs: p.sortMs,
          drawMs: p.drawMs,
          qtreeMs: p.qtreeMs,
          miniMapMs: p.miniMapMs,
          movePoints: p.movePoints,
          viewZoom: p.viewZoom,
          webgl: !!p.webgl,
          ws,
          overlay: overlay ? overlay.textContent : null,
          t: performance.now()
        } : {
          fps: null,
          overlay: overlay ? overlay.textContent : null,
          t: performance.now()
        };
      })()`);
      if (s) samples.push(s);
      await sleep(250);
    }

    cdp.close();

    const withNodes = samples.filter((s) => (s.nodes || 0) > 0);
    const use = withNodes.length ? withNodes : samples;
    const keys = ["fps", "nodes", "drawn", "preMs", "gridMs", "sortMs", "drawMs", "qtreeMs", "miniMapMs"];
    const report = {};
    for (const k of keys) report[k] = statsSummary(use, k);

    const last = use[use.length - 1] || null;
    console.log("\n========== EDGE PERF REPORT ==========");
    console.log(`url: ${URL}`);
    console.log(`samples: ${samples.length} (in-world: ${withNodes.length})`);
    console.log(`webgl: ${last && last.webgl}`);
    console.log(`ws: ${last && last.ws}`);
    console.log(`last overlay:\n${last && last.overlay}`);
    console.log("\nstats (min / p50 / avg / p95 / max):");
    for (const k of keys) {
      const r = report[k];
      if (!r) {
        console.log(`  ${k}: n/a`);
        continue;
      }
      const fmt = (n) => (k === "fps" || k === "nodes" || k === "drawn" ? n.toFixed(0) : n.toFixed(2));
      console.log(
        `  ${k}: ${fmt(r.min)} / ${fmt(r.p50)} / ${fmt(r.avg)} / ${fmt(r.p95)} / ${fmt(r.max)}`
      );
    }
    console.log("======================================\n");

    const outPath = path.join(__dirname, "_edge_perf_report.json");
    fs.writeFileSync(
      outPath,
      JSON.stringify({ url: URL, seconds: SECONDS, samples: use, report, last }, null, 2)
    );
    console.log(`[edge-perf] wrote ${outPath}`);
  } finally {
    // kill Edge probe instance by remote port if possible
    try {
      await httpGetJson(`http://127.0.0.1:${PORT}/json/version`);
      // best-effort: taskkill only this user-data profile's edge is hard; leave running
    } catch (_) {}
  }
}

main().catch((e) => {
  console.error("[edge-perf] FAIL", e);
  process.exit(1);
});
