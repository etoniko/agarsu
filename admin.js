// Agar.su admin panel — packet 169 + chat commands
(function (global) {
  "use strict";

  const OPCODE = 169;
  const REFRESH_MS = 2000;

  const ADMIN_NICK = "root";
  const STATS_USER_URL = "https://agar.su/stats/users/?id=";
  const DEFAULT_BAN_SEC = 500;
  const DEFAULT_MUTE_SEC = 300;

  const state = {
    attached: false,
    S: null,
    api: null,
    role: null,
    roleFromNick: null,
    lastCellNick: "",
    players: [],
    selectedPid: null,
    open: false,
    timer: null,
    el: null,
    filter: "",
    showIps: false,
  };

  function normalizeStaffNick(nick) {
    return String(nick || "")
      .replace(/<[^>]*>/g, "")
      .split("#")[0]
      .trim()
      .toLowerCase();
  }

  function readCurrentNick() {
    const S = state.S;
    if (!S) return state.lastCellNick || "";

    // Только ник с живой клетки (после входа в игру), не из поля ввода
    const cells = S.playerCells;
    if (cells && cells.length) {
      for (let i = 0; i < cells.length; i++) {
        const raw = cells[i] && cells[i].name;
        if (!raw) continue;
        const nick = String(raw)
          .replace(/<[^>]*>/g, "")
          .split("#")[0]
          .trim();
        if (nick) {
          state.lastCellNick = nick;
          return nick;
        }
      }
    }

    // Пока клетка есть в памяти сессии — оставляем последний ник (после смерти)
    if (S.ws && S.ws.readyState === 1) return state.lastCellNick || "";
    state.lastCellNick = "";
    return "";
  }

  function isRootNick(nick) {
    return normalizeStaffNick(nick) === ADMIN_NICK;
  }

  function roleFromNick(nick) {
    return isRootNick(nick) ? "admin" : null;
  }

  function isAdmin() {
    return state.role === "admin" && isRootLive();
  }

  function isRootLive() {
    return isRootNick(readCurrentNick());
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureStyles() {
    if (document.getElementById("agar-admin-css")) return;
    const style = document.createElement("style");
    style.id = "agar-admin-css";
    style.textContent = `
#agarAdminToggle{position:absolute;right:178px;top:10px;z-index:6;border:1px solid rgba(255,255,255,.22);background:rgba(14,18,28,.92);color:#e8f0ff;padding:8px 12px;border-radius:10px;cursor:pointer;font:600 13px/1.2 system-ui,Segoe UI,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)}
#agarAdminToggle.on{background:rgba(36,86,180,.95);border-color:rgba(140,180,255,.55)}
#agarAdminRoot{position:absolute;z-index:6;right:178px;top:52px;width:min(460px,96vw);font:13px/1.35 system-ui,Segoe UI,sans-serif;color:#e8eef8;pointer-events:none}
#agarAdminRoot *{box-sizing:border-box}
#agarAdminPanel{pointer-events:auto;display:none;max-height:min(88vh,820px);overflow:auto;background:rgba(10,14,22,.97);border:1px solid rgba(255,255,255,.12);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.45)}
#agarAdminPanel.open{display:block}
#agarAdminHead{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;background:rgba(10,14,22,.98);z-index:2}
#agarAdminHead b{font-size:14px}
#agarAdminRole{margin-left:auto;opacity:.7;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
@media (max-width:760px){
  #agarAdminToggle{
    position:fixed !important;
    right:10px !important;
    left:auto !important;
    top:auto !important;
    bottom:96px !important;
    z-index:10060 !important;
    padding:12px 16px;
    font-size:15px;
    border:2px solid rgba(150,190,255,.85);
    background:rgba(28,72,170,.98);
    box-shadow:0 6px 22px rgba(0,0,0,.55), 0 0 0 3px rgba(60,120,255,.25);
  }
  #agarAdminToggle.on{
    background:rgba(48,110,230,.98);
    border-color:#fff;
  }
  #agarAdminRoot{
    position:fixed !important;
    right:8px !important;
    left:8px !important;
    top:auto !important;
    bottom:148px !important;
    width:auto !important;
    max-width:none !important;
    z-index:10060 !important;
  }
  #agarAdminPanel{
    max-height:min(58vh,520px);
    border-width:2px;
    border-color:rgba(140,180,255,.35);
    -webkit-overflow-scrolling:touch;
  }
  .aa-btns button,.aa-row button,.aa-list .aa-kick{
    min-height:34px;
    padding:8px 12px;
    font-size:13px;
  }
  .aa-list th,.aa-list td{padding:8px 8px;font-size:13px}
  .aa-list .aa-nick{max-width:42vw}
}
.aa-sec{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.07)}
.aa-sec h4{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.55}
.aa-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}
.aa-row:last-child{margin-bottom:0}
.aa-row label{font-size:11px;opacity:.7;min-width:52px}
.aa-btns{display:flex;flex-wrap:wrap;gap:6px}
.aa-btns button,.aa-row button{font:inherit;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#eaf1ff;padding:5px 9px;border-radius:7px;cursor:pointer}
.aa-btns button:hover,.aa-row button:hover{background:rgba(80,130,220,.35)}
.aa-btns button:disabled,.aa-row button:disabled{opacity:.35;cursor:not-allowed}
.aa-btns button.warn{border-color:rgba(255,140,80,.35);background:rgba(180,70,20,.22)}
.aa-btns button.danger{border-color:rgba(255,80,80,.4);background:rgba(160,30,30,.28)}
.aa-inp{width:72px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.35);color:#eaf1ff;padding:5px 7px;border-radius:7px;font:inherit}
.aa-inp.wide{width:120px}
.aa-inp.grow{flex:1;min-width:100px;width:auto}
.aa-sel{padding:8px 12px;font-size:12px;background:rgba(40,70,140,.18);border-bottom:1px solid rgba(255,255,255,.07)}
.aa-sel strong{font-weight:600}
.aa-list{max-height:28vh;overflow:auto}
.aa-list table{width:100%;border-collapse:collapse}
.aa-list th,.aa-list td{padding:6px 8px;text-align:left;border-bottom:1px solid rgba(255,255,255,.05);white-space:nowrap}
.aa-list th{position:sticky;top:0;background:rgba(16,22,34,.98);font-size:11px;opacity:.75;font-weight:600}
.aa-list tr{cursor:pointer}
.aa-list tr:hover{background:rgba(255,255,255,.04)}
.aa-list tr.sel{background:rgba(60,110,220,.28)}
.aa-list .pid,.aa-list .score{font-variant-numeric:tabular-nums}
.aa-list .pid{opacity:.65}
.aa-list .aa-nick-cell{display:flex;align-items:center;gap:8px;min-width:0}
.aa-list .aa-nick{overflow:hidden;text-overflow:ellipsis;max-width:140px}
.aa-list .aa-kick,.aa-list .aa-ban{flex-shrink:0;font:inherit;padding:3px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600}
.aa-list .aa-kick{border:1px solid rgba(255,140,80,.4);background:rgba(180,70,20,.28);color:#ffe8d8}
.aa-list .aa-kick:hover{background:rgba(220,90,30,.45)}
.aa-list .aa-ban{border:1px solid rgba(255,80,80,.45);background:rgba(160,30,30,.32);color:#ffd0d0}
.aa-list .aa-ban:hover{background:rgba(200,40,40,.5)}
.aa-list .aa-acts{display:flex;gap:4px}
.aa-list .aa-ip{font-variant-numeric:tabular-nums;letter-spacing:.02em}
.aa-list .aa-ip.masked{opacity:.55}
.aa-ip-toggle{font:inherit;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#eaf1ff;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:11px;margin-left:auto}
.aa-ip-toggle.on{background:rgba(36,86,180,.55);border-color:rgba(140,180,255,.45)}
.aa-list-tools{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.aa-filter{flex:1;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.3);color:#eaf1ff;padding:6px 8px;border-radius:7px;font:inherit;margin-bottom:0}
.aa-hint{font-size:11px;opacity:.5;margin-top:4px}
#agarAdminFoot{padding:8px 12px;font-size:11px;opacity:.5}
`;
    document.head.appendChild(style);
  }

  function val(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const n = Number(el.value);
    return Number.isFinite(n) ? n : fallback;
  }

  function positionNearLeaderboard() {
    const lb = document.getElementById("leaderboard");
    const onLb = document.getElementById("onleaderboard");
    const toggle = document.getElementById("agarAdminToggle");
    const root = document.getElementById("agarAdminRoot");
    if (!toggle) return;

    // На телефонах позицию задаёт CSS (fixed), не перебиваем inline.
    if (window.innerWidth <= 760) {
      toggle.style.right = "";
      toggle.style.top = "";
      toggle.style.left = "";
      toggle.style.bottom = "";
      if (root) {
        root.style.right = "";
        root.style.top = "";
        root.style.left = "";
        root.style.bottom = "";
        root.style.width = "";
      }
      return;
    }

    let right = 178;
    let top = 10;
    const gap = 8;

    const anchor =
      lb && getComputedStyle(lb).display !== "none" && lb.offsetParent !== null
        ? lb
        : onLb && getComputedStyle(onLb).display !== "none"
          ? onLb
          : null;

    if (anchor) {
      const cs = getComputedStyle(anchor);
      const w = anchor.getBoundingClientRect().width || parseFloat(cs.minWidth) || 150;
      const r = parseFloat(cs.right);
      const t = parseFloat(cs.top);
      right = Math.round((Number.isFinite(r) ? r : 10) + w + gap);
      top = Number.isFinite(t) ? Math.round(t) : 10;
    }

    toggle.style.right = right + "px";
    toggle.style.top = top + "px";
    toggle.style.left = "auto";
    if (root) {
      root.style.right = right + "px";
      root.style.top = top + 42 + "px";
      root.style.left = "auto";
    }
  }

  function buildUi() {
    if (state.el) return state.el;
    ensureStyles();

    const toggle = document.createElement("button");
    toggle.id = "agarAdminToggle";
    toggle.type = "button";
    toggle.textContent = "Admin";
    toggle.title = "Админ-панель";
    toggle.style.display = "none";

    const root = document.createElement("div");
    root.id = "agarAdminRoot";
    root.innerHTML = `
      <div id="agarAdminPanel">
        <div id="agarAdminHead">
          <b>Админ · root</b>
          <span id="agarAdminRole">root</span>
        </div>

        <div class="aa-sec" id="aaGlobalSec">
          <h4>Общее · сервер</h4>
          <div class="aa-btns" id="aaGlobalLists"></div>
          <div class="aa-row" style="margin-top:8px">
            <div class="aa-btns" id="aaGlobalActs"></div>
          </div>
          <div class="aa-row" style="margin-top:8px">
            <label>ChatLock</label>
            <input class="aa-inp" id="aaChatLockSec" type="number" min="0" value="1000" title="Секунды chatlock" />
            <button type="button" id="aaChatLockBtn">ChatLock</button>
          </div>
        </div>

        <div class="aa-sec">
          <h4>Игроки онлайн</h4>
          <div class="aa-list-tools">
            <input class="aa-filter" id="aaFilter" type="search" placeholder="Фильтр: ник или ID…" />
            <button type="button" class="aa-ip-toggle" id="aaIpToggle" title="Показать / скрыть IP">IP: скрыты</button>
          </div>
          <div class="aa-list" id="agarAdminList">
            <table>
              <thead><tr><th>ID</th><th>Ник</th><th></th><th>Cells</th><th>Score</th><th>ЛК</th><th>IP</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="aa-hint">Kick / Ban в списке · ПКМ по клетке или по нику в чате · пасс только на сервер</div>
        </div>

        <div class="aa-sel" id="agarAdminSel">Игрок не выбран</div>

        <div class="aa-sec" id="aaPlayerSec">
          <h4 id="aaPlayerTitle">Действия с игроком</h4>

          <div class="aa-row">
            <label>Бан сек</label>
            <input class="aa-inp" id="aaBanSec" type="number" min="1" value="500" />
            <button type="button" class="warn" data-act="ban">Ban</button>
            <label>Mute сек</label>
            <input class="aa-inp" id="aaMuteSec" type="number" min="0" value="300" />
            <button type="button" data-act="mute">Mute</button>
            <button type="button" data-act="unmute">Unmute</button>
          </div>

          <div class="aa-row">
            <label>NickLock</label>
            <input class="aa-inp" id="aaNickLockSec" type="number" min="1" value="500" />
            <button type="button" data-act="nicklock">Lock</button>
            <button type="button" data-act="nickunlock">Unlock</button>
            <button type="button" class="warn" data-act="nickban">NickBan</button>
            <button type="button" data-act="unnickban">UnNickBan</button>
          </div>

          <div class="aa-row" id="aaLkBanRow">
            <button type="button" data-act="lk">Открыть ЛК</button>
            <button type="button" class="danger" data-act="uidban">Бан ЛК</button>
            <button type="button" data-act="uidunban">Разбан ЛК</button>
          </div>

          <div class="aa-row" id="aaAdminPlayerRows">
            <label>Масса</label>
            <input class="aa-inp" id="aaMass" type="number" min="1" value="500" />
            <button type="button" data-act="mass">Set mass</button>
            <label>Split</label>
            <input class="aa-inp" id="aaSplit" type="number" min="1" max="128" value="1" />
            <button type="button" data-act="split">Split</button>
            <button type="button" data-act="merge">Merge</button>
            <button type="button" class="danger" data-act="kill">Kill</button>
          </div>

          <div class="aa-row" id="aaTpRow">
            <label>TP X</label>
            <input class="aa-inp wide" id="aaTpX" type="number" value="0" />
            <label>Y</label>
            <input class="aa-inp wide" id="aaTpY" type="number" value="0" />
            <button type="button" data-act="tp">TP</button>
            <button type="button" data-act="tpMe">TP → я</button>
          </div>
        </div>

        <div id="agarAdminFoot">Онлайн: 0 · команды в чат · список ~2с</div>
      </div>`;

    const lb = document.getElementById("leaderboard");
    const host = (lb && lb.parentNode) || document.body;
    if (lb && lb.parentNode) {
      host.insertBefore(toggle, lb);
      host.insertBefore(root, lb);
    } else {
      document.body.appendChild(toggle);
      document.body.appendChild(root);
    }

    toggle.addEventListener("click", () => setOpen(!state.open));

    root.querySelector("#aaFilter").addEventListener("input", (e) => {
      state.filter = String(e.target.value || "").trim().toLowerCase();
      renderList();
    });

    root.querySelector("#aaIpToggle").addEventListener("click", () => {
      state.showIps = !state.showIps;
      syncIpToggleUi();
      renderList();
      renderPlayerChrome();
    });

    root.querySelector("#agarAdminList").addEventListener("click", (e) => {
      const kickBtn = e.target.closest("[data-kick-pid]");
      if (kickBtn) {
        e.preventDefault();
        e.stopPropagation();
        const pid = Number(kickBtn.getAttribute("data-kick-pid"));
        if (Number.isFinite(pid)) sendCmd(`/kick ${pid}`);
        return;
      }
      const banBtn = e.target.closest("[data-ban-pid]");
      if (banBtn) {
        e.preventDefault();
        e.stopPropagation();
        const pid = Number(banBtn.getAttribute("data-ban-pid"));
        if (Number.isFinite(pid)) sendCmd(`/ban ${pid} ${val("aaBanSec", DEFAULT_BAN_SEC)}`);
        return;
      }
      const lkBtn = e.target.closest("[data-lk-pid]");
      if (lkBtn) {
        e.preventDefault();
        e.stopPropagation();
        const pid = Number(lkBtn.getAttribute("data-lk-pid"));
        const p = state.players.find((x) => x.pid === pid);
        if (p) openPlayerLk(p);
      }
    });

    root.querySelector("#aaPlayerSec").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      runPlayerAct(btn.getAttribute("data-act"));
    });

    state.el = { root, toggle, panel: root.querySelector("#agarAdminPanel") };
    positionNearLeaderboard();
    renderGlobals();
    renderPlayerChrome();
    return state.el;
  }

  function setOpen(v) {
    state.open = !!v;
    const ui = buildUi();
    ui.panel.classList.toggle("open", state.open);
    ui.toggle.classList.toggle("on", state.open);
    if (state.open) {
      syncStaffFromNick();
      requestPanel();
      fillTpFromMe(false);
    }
  }

  function sendCmd(cmd) {
    if (!cmd || !state.api) return;
    if (typeof state.api.sendChat === "function") state.api.sendChat(cmd);
  }

  function requestPanel() {
    if (!state.api || typeof state.api.sendAdminPanel !== "function") return;
    state.api.sendAdminPanel();
  }

  function selected() {
    return state.players.find((p) => p.pid === state.selectedPid) || null;
  }

  function needPlayer() {
    const p = selected();
    if (!p) {
      const sel = document.getElementById("agarAdminSel");
      if (sel) sel.textContent = "Сначала выберите игрока в списке";
      return null;
    }
    return p;
  }

  function fillTpFromMe(writeAlways) {
    const S = state.S;
    if (!S) return;
    const x = Math.round(S.nodeX || S.posX || 0);
    const y = Math.round(S.nodeY || S.posY || 0);
    const ix = document.getElementById("aaTpX");
    const iy = document.getElementById("aaTpY");
    if (!ix || !iy) return;
    if (writeAlways || !ix.value || ix.value === "0") ix.value = String(x);
    if (writeAlways || !iy.value || iy.value === "0") iy.value = String(y);
  }

  function runPlayerAct(act) {
    const p = needPlayer();
    if (!p) return;

    switch (act) {
      case "kick":
        sendCmd(`/kick ${p.pid}`);
        break;
      case "ban":
        sendCmd(`/ban ${p.pid} ${val("aaBanSec", 500)}`);
        break;
      case "mute":
        sendCmd(`/mute ${p.pid} ${val("aaMuteSec", 300)}`);
        break;
      case "unmute":
        sendCmd(`/unmute ${p.pid}`);
        break;
      case "nicklock":
        sendCmd(`/nicklock ${p.pid} ${val("aaNickLockSec", 500)}`);
        break;
      case "nickunlock":
        sendCmd(`/nickunlock ${p.pid}`);
        break;
      case "nickban":
        if (!p.nick) return;
        sendCmd(`/nickban ${p.nick}`);
        break;
      case "unnickban":
        if (!p.nick) return;
        sendCmd(`/unnickban ${p.nick}`);
        break;
      case "uidban":
        if (!p.lkUid) return;
        sendCmd(`/uidban ${p.lkUid}`);
        break;
      case "uidunban":
        if (!p.lkUid) return;
        sendCmd(`/uidunban ${p.lkUid}`);
        break;
      case "lk":
        openPlayerLk(p);
        break;
      case "mass":
        sendCmd(`/mass ${p.pid} ${val("aaMass", 500)}`);
        break;
      case "split":
        sendCmd(`/split ${p.pid} ${val("aaSplit", 1)}`);
        break;
      case "merge":
        sendCmd(`/merge ${p.pid}`);
        break;
      case "kill":
        sendCmd(`/kill ${p.pid}`);
        break;
      case "tp":
        sendCmd(`/tp ${p.pid} ${val("aaTpX", 0)} ${val("aaTpY", 0)}`);
        break;
      case "tpMe":
        fillTpFromMe(true);
        sendCmd(`/tp ${p.pid} ${val("aaTpX", 0)} ${val("aaTpY", 0)}`);
        break;
      default:
        break;
    }
  }

  function renderGlobals() {
    const lists = document.getElementById("aaGlobalLists");
    const acts = document.getElementById("aaGlobalActs");
    if (!lists || !acts) return;
    lists.innerHTML = "";
    acts.innerHTML = "";

    const listCmds = [
      { label: "Playerlist", cmd: "/playerlist" },
      { label: "Banlist", cmd: "/banlist" },
      { label: "Nickbans", cmd: "/nickbanlist" },
      { label: "Mutelist", cmd: "/mutelist" },
      { label: "Help", cmd: "/help" },
    ];
    listCmds.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = a.label;
      b.addEventListener("click", () => sendCmd(a.cmd));
      lists.appendChild(b);
    });

    const ref = document.createElement("button");
    ref.type = "button";
    ref.textContent = "↻ Список";
    ref.addEventListener("click", () => requestPanel());
    lists.appendChild(ref);

    const serverActs = [
      { label: "Status", cmd: "/status" },
      { label: "Pause", cmd: "/pause" },
    ];
    serverActs.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = a.label;
      if (a.danger) b.className = "danger";
      b.addEventListener("click", () => sendCmd(a.cmd));
      acts.appendChild(b);
    });

    const chatLockBtn = document.getElementById("aaChatLockBtn");
    if (chatLockBtn && !chatLockBtn._aaBound) {
      chatLockBtn._aaBound = true;
      chatLockBtn.addEventListener("click", () => {
        const sec = Math.max(0, val("aaChatLockSec", 1000) | 0);
        const inp = document.getElementById("aaChatLockSec");
        if (inp) inp.value = String(sec);
        sendCmd(`/chatlock ${sec}`);
      });
    }
  }

  function formatIp(ip) {
    if (!ip || ip === "null") return "—";
    if (ip === "BOT" || ip === "***") return ip;
    if (!state.showIps) return "****";
    return ip;
  }

  function syncIpToggleUi() {
    const btn = document.getElementById("aaIpToggle");
    if (!btn) return;
    btn.classList.toggle("on", !!state.showIps);
    btn.textContent = state.showIps ? "IP: показаны" : "IP: скрыты";
    btn.style.display = "";
  }

  function renderPlayerChrome() {
    syncIpToggleUi();

    const adminRows = document.getElementById("aaAdminPlayerRows");
    const tpRow = document.getElementById("aaTpRow");
    const lkBanRow = document.getElementById("aaLkBanRow");
    if (adminRows) adminRows.style.display = "flex";
    if (tpRow) tpRow.style.display = "flex";
    if (lkBanRow) lkBanRow.style.display = "flex";

    const p = selected();
    const title = document.getElementById("aaPlayerTitle");
    if (title) {
      title.textContent = p
        ? `Действия с игроком · ${p.nick || "?"} (#${p.pid})`
        : "Действия с игроком";
    }
    const sel = document.getElementById("agarAdminSel");
    if (sel) {
      if (!p) sel.innerHTML = "Игрок не выбран";
      else {
        const ipRaw = p.ip && p.ip !== "null" ? p.ip : "";
        const ip =
          ipRaw
            ? ` · IP ${escapeHtml(state.showIps ? ipRaw : "****")}`
            : "";
        const lk = p.lkUid ? ` · ЛК ${escapeHtml(String(p.lkUid))}` : "";
        const xy =
          Number.isFinite(p.mx) && Number.isFinite(p.my)
            ? ` · ${p.mx | 0},${p.my | 0}`
            : "";
        sel.innerHTML = `Выбран: <strong>${escapeHtml(p.nick || "?")}</strong> · #${p.pid} · cells ${p.cells} · score ${p.score}${lk}${xy}${ip}`;
      }
    }

    const disabled = !p;
    document.querySelectorAll("#aaPlayerSec [data-act]").forEach((btn) => {
      btn.disabled = disabled;
    });
  }

  function renderList() {
    const tb = document.querySelector("#agarAdminList tbody");
    if (!tb) return;
    tb.innerHTML = "";
    const f = state.filter;
    const rows = state.players
      .slice()
      .filter((p) => {
        if (!f) return true;
        return String(p.pid).includes(f) || String(p.lkUid || "").includes(f) || String(p.nick || "").toLowerCase().includes(f);
      })
      .sort((a, b) => b.score - a.score || a.pid - b.pid);

    rows.forEach((p) => {
      const tr = document.createElement("tr");
      if (p.pid === state.selectedPid) tr.className = "sel";
      const ipText = formatIp(p.ip);
      const ipClass = state.showIps ? "aa-ip" : "aa-ip masked";

      const tdPid = document.createElement("td");
      tdPid.className = "pid";
      tdPid.textContent = String(p.pid);

      const tdNick = document.createElement("td");
      const nickWrap = document.createElement("div");
      nickWrap.className = "aa-nick-cell";
      const nickSpan = document.createElement("span");
      nickSpan.className = "aa-nick";
      nickSpan.textContent = p.nick || "?";
      nickWrap.appendChild(nickSpan);
      tdNick.appendChild(nickWrap);

      const tdKick = document.createElement("td");
      const acts = document.createElement("div");
      acts.className = "aa-acts";
      const kick = document.createElement("button");
      kick.type = "button";
      kick.className = "aa-kick";
      kick.textContent = "Kick";
      kick.title = `Кик ${p.nick || p.pid}`;
      kick.setAttribute("data-kick-pid", String(p.pid));
      const ban = document.createElement("button");
      ban.type = "button";
      ban.className = "aa-ban";
      ban.textContent = "Ban";
      ban.title = `Бан ${p.nick || p.pid}`;
      ban.setAttribute("data-ban-pid", String(p.pid));
      acts.appendChild(kick);
      acts.appendChild(ban);
      tdKick.appendChild(acts);

      const tdCells = document.createElement("td");
      tdCells.textContent = String(p.cells);

      const tdScore = document.createElement("td");
      tdScore.className = "score";
      tdScore.textContent = String(p.score);

      const tdLk = document.createElement("td");
      if (p.lkUid) {
        const lk = document.createElement("button");
        lk.type = "button";
        lk.className = "aa-kick";
        lk.textContent = String(p.lkUid);
        lk.title = "Открыть ЛК";
        lk.setAttribute("data-lk-pid", String(p.pid));
        tdLk.appendChild(lk);
      } else {
        tdLk.textContent = "—";
      }

      const tdIp = document.createElement("td");
      tdIp.className = ipClass;
      tdIp.textContent = ipText;

      tr.appendChild(tdPid);
      tr.appendChild(tdNick);
      tr.appendChild(tdKick);
      tr.appendChild(tdCells);
      tr.appendChild(tdScore);
      tr.appendChild(tdLk);
      tr.appendChild(tdIp);

      tr.addEventListener("click", (e) => {
        if (e.target.closest("[data-kick-pid], [data-ban-pid], [data-lk-pid]")) return;
        state.selectedPid = p.pid;
        renderList();
        renderPlayerChrome();
        fillTpFromMe(false);
      });
      tb.appendChild(tr);
    });

    const roleEl = document.getElementById("agarAdminRole");
    if (roleEl) roleEl.textContent = "root";
    const foot = document.getElementById("agarAdminFoot");
    if (foot) foot.textContent = `Онлайн: ${state.players.length} · команды в чат · список ~2с`;
    renderPlayerChrome();
  }

  function syncStaffFromNick() {
    const nickRole = roleFromNick(readCurrentNick());
    state.roleFromNick = nickRole;
    if (nickRole) {
      state.role = nickRole;
      if (!state.el) buildUi();
      state.el.toggle.style.display = "block";
      positionNearLeaderboard();
      const roleEl = document.getElementById("agarAdminRole");
      if (roleEl) roleEl.textContent = "root";
      renderGlobals();
      renderPlayerChrome();
      return;
    }
    hideStaffUi();
  }

  function applyAdminData(data) {
    if (!data) return;
    if (!isRootLive()) {
      hideStaffUi();
      return;
    }
    state.role = "admin";
    state.players = Array.isArray(data.players) ? data.players : [];
    if (!state.el) buildUi();
    state.el.toggle.style.display = "block";
    positionNearLeaderboard();
    renderGlobals();
    renderList();
  }

  function hideStaffUi() {
    state.role = null;
    state.players = [];
    if (state.el) {
      state.el.toggle.style.display = "none";
      if (state.open) setOpen(false);
    }
  }

  function onAdminData(packet) {
    applyAdminData(packet);
  }

  function onAdminPacket(view, offset) {
    const reader = {
      view,
      offset: offset | 0,
      get canRead() {
        return this.offset < this.view.byteLength;
      },
      uint8() {
        return this.view.getUint8(this.offset++);
      },
      uint16() {
        const v = this.view.getUint16(this.offset, true);
        this.offset += 2;
        return v;
      },
      uint32() {
        const v = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return v;
      },
      int32() {
        const v = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return v;
      },
      utf8() {
        let text = "";
        for (let byte1; (byte1 = this.canRead && this.view.getUint8(this.offset++)); ) {
          if (byte1 <= 127) text += String.fromCharCode(byte1);
          else if (byte1 <= 223)
            text += String.fromCharCode(((byte1 & 31) << 6) | (this.view.getUint8(this.offset++) & 63));
          else if (byte1 <= 239)
            text += String.fromCharCode(
              ((byte1 & 15) << 12) |
                ((this.view.getUint8(this.offset++) & 63) << 6) |
                (this.view.getUint8(this.offset++) & 63)
            );
          else {
            let codePoint =
              ((byte1 & 7) << 18) |
              ((this.view.getUint8(this.offset++) & 63) << 12) |
              ((this.view.getUint8(this.offset++) & 63) << 6) |
              (this.view.getUint8(this.offset++) & 63);
            if (codePoint >= 65536) {
              codePoint -= 65536;
              text += String.fromCharCode(55296 | (codePoint >> 10), 56320 | (codePoint & 1023));
            } else text += String.fromCharCode(codePoint);
          }
        }
        return text;
      },
    };

    let role = null;
    let count = -1;
    const mark = reader.offset;
    if (reader.canRead) {
      const maybeRole = reader.view.getUint8(reader.offset);
      if (maybeRole >= 1 && maybeRole <= 3 && reader.offset + 3 <= reader.view.byteLength) {
        const maybeCount = reader.view.getUint16(reader.offset + 1, true);
        if (maybeCount <= 512) {
          role = "admin";
          reader.offset += 1;
          count = reader.uint16();
        }
      }
    }
    if (count < 0) reader.offset = mark;

    const players = [];
    const readOne = () => {
      if (!reader.canRead) return false;
      const ip = reader.utf8();
      if (!reader.canRead) return false;
      players.push({
        ip,
        pid: reader.uint32(),
        nick: reader.utf8(),
        cells: reader.uint32(),
        mx: reader.int32(),
        my: reader.int32(),
        score: reader.uint32(),
      });
      return true;
    };
    if (count >= 0) {
      for (let i = 0; i < count; i++) if (!readOne()) break;
    } else {
      while (reader.canRead) if (!readOne()) break;
    }
    if (!role) role = "admin";
    for (const p of players) {
      const m = String(p.nick || "").match(/^(.*) \[лк:(\d+)\]$/);
      if (!m) {
        p.lkUid = 0;
        continue;
      }
      p.nick = m[1];
      p.lkUid = Number(m[2]);
    }
    applyAdminData({ role, players });
  }

  function findPlayerByTarget(pid, nick) {
    const id = Number(pid) || 0;
    const n = normalizeStaffNick(nick);
    if (id) {
      const byPid = state.players.find((p) => p.pid === id || (p.pid & 65535) === (id & 65535));
      if (byPid) return byPid;
    }
    if (n) {
      const byNick = state.players.find((p) => normalizeStaffNick(p.nick) === n);
      if (byNick) return byNick;
    }
    return null;
  }

  function resolvePid(pid, nick) {
    const p = findPlayerByTarget(pid, nick);
    if (p && p.pid) return p.pid;
    const id = Number(pid) || 0;
    return id || 0;
  }

  function openPlayerLk(p, nick) {
    const player = p || findPlayerByTarget(0, nick);
    const name = (player && player.nick) || nick || "";
    if (player && player.lkUid) {
      global.open(STATS_USER_URL + encodeURIComponent(player.lkUid), "_blank", "noopener");
      return;
    }
    if (state.S && typeof global.__agarsuOpenStatsForName === "function") {
      if (global.__agarsuOpenStatsForName(state.S, name)) return;
    }
    if (name) {
      global.open(STATS_USER_URL + encodeURIComponent(name), "_blank", "noopener");
    }
  }

  function selectInPanel(pid) {
    if (!isRootLive()) return;
    if (!state.el) buildUi();
    state.selectedPid = pid;
    setOpen(true);
    renderList();
    renderPlayerChrome();
  }

  function pickPlayerCell(S, wx, wy) {
    let best = null;
    let bestSize = Infinity;
    const list = (S && S.nodelist) || [];
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (!node || node.destroyed || node.isOwn || node.isFood || node.isVirus || node.isEjected) continue;
      if (!node.name && !(node.playerId > 0)) continue;
      const dx = node.x - wx;
      const dy = node.y - wy;
      const r = node.size || 0;
      if (r <= 0) continue;
      if (dx * dx + dy * dy < r * r && r < bestSize) {
        best = node;
        bestSize = r;
      }
    }
    return best;
  }

  function showMenu(items, x, y) {
    if (typeof global.__agarsuShowUiContextMenu === "function") {
      global.__agarsuShowUiContextMenu(items, x, y);
      return;
    }
    document.querySelectorAll(".chat-context-menu").forEach((m) => m.remove());
    if (!(items && items.length)) return;
    const menu = document.createElement("div");
    menu.className = "chat-context-menu";
    menu.style.position = "fixed";
    menu.style.top = y + "px";
    menu.style.left = x + "px";
    menu.style.zIndex = "10080";
    items.forEach((item) => {
      const el = document.createElement("div");
      el.textContent = item.label;
      if (item.className) el.className = item.className;
      el.onclick = () => {
        try {
          item.onClick && item.onClick();
        } finally {
          menu.remove();
        }
      };
      menu.appendChild(el);
    });
    document.body.appendChild(menu);
    const closeMenu = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    };
    setTimeout(() => document.addEventListener("click", closeMenu), 0);
  }

  function targetMenuItems(target) {
    const pid = resolvePid(target && target.pid, target && target.nick);
    const nick = String((target && target.nick) || "").replace(/<[^>]*>/g, "").split("#")[0].trim();
    const p = findPlayerByTarget(pid, nick);
    const items = [
      { label: "Админ · root", className: "chat-context-sep", onClick: () => {} },
      {
        label: pid ? `Kick #${pid}` : "Kick",
        className: "chat-context-admin",
        onClick: () => {
          if (pid) sendCmd(`/kick ${pid}`);
        },
      },
      {
        label: `Ban ${DEFAULT_BAN_SEC}с`,
        className: "chat-context-admin danger",
        onClick: () => {
          if (pid) sendCmd(`/ban ${pid} ${DEFAULT_BAN_SEC}`);
        },
      },
      {
        label: `Mute ${DEFAULT_MUTE_SEC}с`,
        className: "chat-context-admin",
        onClick: () => {
          if (pid) sendCmd(`/mute ${pid} ${DEFAULT_MUTE_SEC}`);
        },
      },
      {
        label: p && p.lkUid ? `ЛК · ${p.lkUid}` : "ЛК / статистика",
        className: "chat-context-admin",
        onClick: () => openPlayerLk(p, nick),
      },
      {
        label: "Kill",
        className: "chat-context-admin danger",
        onClick: () => {
          if (pid) sendCmd(`/kill ${pid}`);
        },
      },
      {
        label: "TP ко мне",
        className: "chat-context-admin",
        onClick: () => {
          if (!pid) return;
          fillTpFromMe(true);
          sendCmd(`/tp ${pid} ${val("aaTpX", 0)} ${val("aaTpY", 0)}`);
        },
      },
      {
        label: "Выбрать в панели",
        className: "chat-context-admin",
        onClick: () => {
          if (pid) selectInPanel(pid);
        },
      },
    ];
    if (p && Number.isFinite(p.mx) && Number.isFinite(p.my)) {
      items.splice(1, 0, {
        label: `xy ${p.mx | 0},${p.my | 0} · ${p.score || 0}`,
        className: "chat-context-pid",
        onClick: () => {
          try {
            if (navigator.clipboard) navigator.clipboard.writeText(`${p.mx | 0} ${p.my | 0}`);
          } catch (e) {}
        },
      });
    }
    return items;
  }

  function appendTargetMenuItems(items, target) {
    if (!isRootLive() || !Array.isArray(items)) return items;
    const extra = targetMenuItems(target || {});
    extra.forEach((it) => items.push(it));
    return items;
  }

  function worldFromEvent(S, e) {
    const dpr = S.dpr || 1;
    S.rawMouseX = e.clientX * dpr;
    S.rawMouseY = e.clientY * dpr;
    S.X = (S.rawMouseX - S.canvasWidth / 2) / S.viewZoom + S.nodeX;
    S.Y = (S.rawMouseY - S.canvasHeight / 2) / S.viewZoom + S.nodeY;
    return { x: S.X, y: S.Y };
  }

  function hitFromEvent(e) {
    const S = state.S;
    if (!S || !isRootLive()) return null;
    worldFromEvent(S, e);
    return pickPlayerCell(S, S.X, S.Y);
  }

  function bindCanvasMenus() {
    const canvas = document.getElementById("canvas");
    if (!canvas || canvas.dataset.aaCtx === "1") return;
    canvas.dataset.aaCtx = "1";
    canvas.addEventListener(
      "mousedown",
      (e) => {
        if (e.button !== 2) return;
        const hit = hitFromEvent(e);
        if (!hit) return;
        e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        e.stopPropagation();
      },
      true
    );
    canvas.addEventListener(
      "contextmenu",
      (e) => {
        const hit = hitFromEvent(e);
        if (!hit) return;
        e.preventDefault();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        e.stopPropagation();
        const pid = hit.playerId > 0 ? hit.playerId >>> 0 : 0;
        const nick = String(hit.name || "")
          .replace(/<[^>]*>/g, "")
          .split("#")[0]
          .trim();
        showMenu(targetMenuItems({ pid, nick, fromCell: true }), e.clientX, e.clientY);
      },
      true
    );
  }

  function attach(S, api) {
    if (!S || !api) return;
    state.S = S;
    state.api = api;
    state.attached = true;
    buildUi();
    bindCanvasMenus();
    syncStaffFromNick();

    if (state.timer) clearInterval(state.timer);
    let tick = 0;
    state.timer = setInterval(() => {
      bindCanvasMenus();
      syncStaffFromNick();
      if (state.el && state.el.toggle.style.display !== "none") positionNearLeaderboard();
      if (!api.wsIsOpen || !api.wsIsOpen()) {
        state.lastCellNick = "";
        return;
      }
      if (!state.role) return;
      tick++;
      if (state.open || tick % 4 === 0) requestPanel();
    }, REFRESH_MS);

    setTimeout(() => {
      syncStaffFromNick();
      if (state.role) requestPanel();
    }, 800);
  }

  function tryAutoAttach() {
    const S = global.__gameState || (global.wHandle && global.wHandle.__gameState);
    if (!S || !S.api || state.attached) return;
    attach(S, {
      sendChat: (t) => {
        if (S.api && typeof S.api.sendChat === "function") S.api.sendChat(t);
      },
      sendAdminPanel: () => {
        if (typeof S.api.sendAdminPanel === "function") S.api.sendAdminPanel();
        else if (typeof S.api.sendUint8 === "function") S.api.sendUint8(OPCODE);
      },
      wsIsOpen: () => !!(S.ws && S.ws.readyState === 1),
    });
  }

  global.AgarAdmin = {
    OPCODE,
    ADMIN_NICK,
    attach,
    onAdminPacket,
    onAdminData,
    tryAutoAttach,
    requestPanel,
    setOpen,
    isRootLive,
    appendTargetMenuItems,
    targetMenuItems,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(tryAutoAttach, 1500));
  } else {
    setTimeout(tryAutoAttach, 1500);
  }
  setInterval(tryAutoAttach, 4000);
})(typeof window !== "undefined" ? window : globalThis);
