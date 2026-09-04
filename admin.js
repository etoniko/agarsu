// Agar.su admin panel — packet 169 + chat commands
(function (global) {
  "use strict";

  const OPCODE = 169;
  const REFRESH_MS = 2000;

  const STAFF_BY_NICK = {
    нико: "admin",
    niko: "admin",
    banshee: "admin",
    pulik: "moder",
  };

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

  function roleFromNick(nick) {
    return STAFF_BY_NICK[normalizeStaffNick(nick)] || null;
  }

  function isAdmin() {
    return state.role === "admin";
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
.aa-filter{width:100%;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.3);color:#eaf1ff;padding:6px 8px;border-radius:7px;font:inherit;margin-bottom:8px}
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
          <b>Панель управления</b>
          <span id="agarAdminRole">—</span>
        </div>

        <div class="aa-sec" id="aaGlobalSec">
          <h4>Общее · сервер</h4>
          <div class="aa-btns" id="aaGlobalLists"></div>
          <div class="aa-row" style="margin-top:8px">
            <div class="aa-btns" id="aaGlobalActs"></div>
          </div>
        </div>

        <div class="aa-sec">
          <h4>Игроки онлайн</h4>
          <input class="aa-filter" id="aaFilter" type="search" placeholder="Фильтр: ник или ID…" />
          <div class="aa-list" id="agarAdminList">
            <table>
              <thead><tr><th>ID</th><th>Ник</th><th>Cells</th><th>Score</th><th>IP</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="aa-hint">Клик по строке — выбрать игрока</div>
        </div>

        <div class="aa-sel" id="agarAdminSel">Игрок не выбран</div>

        <div class="aa-sec" id="aaPlayerSec">
          <h4 id="aaPlayerTitle">Действия с игроком</h4>

          <div class="aa-row">
            <div class="aa-btns" id="aaPlayerQuick"></div>
          </div>

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

          <div class="aa-row" id="aaAdminPlayerRows" style="display:none">
            <label>Масса</label>
            <input class="aa-inp" id="aaMass" type="number" min="1" value="500" />
            <button type="button" data-act="mass">Set mass</button>
            <label>Split</label>
            <input class="aa-inp" id="aaSplit" type="number" min="1" max="128" value="1" />
            <button type="button" data-act="split">Split</button>
            <button type="button" data-act="merge">Merge</button>
            <button type="button" class="danger" data-act="kill">Kill</button>
          </div>

          <div class="aa-row" id="aaTpRow" style="display:none">
            <label>TP X</label>
            <input class="aa-inp wide" id="aaTpX" type="number" value="0" />
            <label>Y</label>
            <input class="aa-inp wide" id="aaTpY" type="number" value="0" />
            <button type="button" data-act="tp">TP</button>
            <button type="button" data-act="tpMe">TP → я</button>
          </div>
        </div>

        <div id="agarAdminFoot">Команды уходят в чат · список ~2с</div>
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
      case "mass":
        if (!isAdmin()) return;
        sendCmd(`/mass ${p.pid} ${val("aaMass", 500)}`);
        break;
      case "split":
        if (!isAdmin()) return;
        sendCmd(`/split ${p.pid} ${val("aaSplit", 1)}`);
        break;
      case "merge":
        if (!isAdmin()) return;
        sendCmd(`/merge ${p.pid}`);
        break;
      case "kill":
        if (!isAdmin()) return;
        sendCmd(`/kill ${p.pid}`);
        break;
      case "tp":
        if (!isAdmin()) return;
        sendCmd(`/tp ${p.pid} ${val("aaTpX", 0)} ${val("aaTpY", 0)}`);
        break;
      case "tpMe":
        if (!isAdmin()) return;
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

    const serverActs = [{ label: "ChatLock", cmd: "/chatlock", admin: false }];
    if (isAdmin()) {
      serverActs.push(
        { label: "Status", cmd: "/status", admin: true },
        { label: "Pause", cmd: "/pause", admin: true }
      );
    }
    serverActs.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = a.label;
      if (a.danger) b.className = "danger";
      b.addEventListener("click", () => sendCmd(a.cmd));
      acts.appendChild(b);
    });
  }

  function renderPlayerChrome() {
    const quick = document.getElementById("aaPlayerQuick");
    if (quick) {
      quick.innerHTML = "";
      const kick = document.createElement("button");
      kick.type = "button";
      kick.textContent = "Kick";
      kick.className = "warn";
      kick.setAttribute("data-act", "kick");
      quick.appendChild(kick);
    }

    const adminRows = document.getElementById("aaAdminPlayerRows");
    const tpRow = document.getElementById("aaTpRow");
    if (adminRows) adminRows.style.display = isAdmin() ? "flex" : "none";
    if (tpRow) tpRow.style.display = isAdmin() ? "flex" : "none";

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
        const ip = isAdmin() && p.ip && p.ip !== "null" ? ` · IP ${escapeHtml(p.ip)}` : "";
        sel.innerHTML = `Выбран: <strong>${escapeHtml(p.nick || "?")}</strong> · #${p.pid} · cells ${p.cells} · score ${p.score}${ip}`;
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
        return String(p.pid).includes(f) || String(p.nick || "").toLowerCase().includes(f);
      })
      .sort((a, b) => b.score - a.score || a.pid - b.pid);

    rows.forEach((p) => {
      const tr = document.createElement("tr");
      if (p.pid === state.selectedPid) tr.className = "sel";
      const ip = isAdmin() ? p.ip || "—" : "—";
      tr.innerHTML = `<td class="pid">${p.pid}</td><td></td><td>${p.cells}</td><td class="score">${p.score}</td><td>${escapeHtml(ip)}</td>`;
      tr.children[1].textContent = p.nick || "?";
      tr.addEventListener("click", () => {
        state.selectedPid = p.pid;
        renderList();
        renderPlayerChrome();
        fillTpFromMe(false);
      });
      tb.appendChild(tr);
    });

    const roleEl = document.getElementById("agarAdminRole");
    if (roleEl) roleEl.textContent = state.role || "staff";
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
      if (roleEl) roleEl.textContent = nickRole;
      renderGlobals();
      renderPlayerChrome();
      return;
    }
    if (!state.players.length) {
      state.role = null;
      if (state.el) {
        state.el.toggle.style.display = "none";
        if (state.open) setOpen(false);
      }
    }
  }

  function applyAdminData(data) {
    if (!data) return;
    const nickRole = roleFromNick(readCurrentNick()) || state.roleFromNick;
    state.role = nickRole || data.role || "moder";
    state.players = Array.isArray(data.players) ? data.players : [];
    if (!state.el) buildUi();
    if (nickRole || state.role) state.el.toggle.style.display = "block";
    positionNearLeaderboard();
    renderGlobals();
    renderList();
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
          role = maybeRole === 1 ? "admin" : maybeRole === 2 ? "moder" : "jmod";
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
    if (!role) {
      const hasRealIp = players.some((p) => p.ip && p.ip !== "null" && p.ip !== "***" && p.ip !== "BOT");
      role = hasRealIp ? "admin" : "moder";
    }
    applyAdminData({ role, players });
  }

  function attach(S, api) {
    if (!S || !api) return;
    state.S = S;
    state.api = api;
    state.attached = true;
    buildUi();
    syncStaffFromNick();

    if (state.timer) clearInterval(state.timer);
    let tick = 0;
    state.timer = setInterval(() => {
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
    attach,
    onAdminPacket,
    onAdminData,
    tryAutoAttach,
    requestPanel,
    setOpen,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(tryAutoAttach, 1500));
  } else {
    setTimeout(tryAutoAttach, 1500);
  }
  setInterval(tryAutoAttach, 4000);
})(typeof window !== "undefined" ? window : globalThis);
