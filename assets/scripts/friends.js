/**
 * Client Friends feature (agar.su). Rollback: remove this script + HTML/CSS hooks.
 * Depends on API /api/friends* (file-backed). Does not touch game servers.
 */
(function (global) {
  "use strict";

  const API = "https://api.agar.su/api/";
  const MIN_XP = 1000;
  const PLAY_POLL_MS = 4000;
  const PRESENCE_MS = 2000;
  const DRAW_MS = 200;
  // ~1.25 sectors on a 5×5 minimap (E1↔C1 ≈ 2 sectors)
  const ARROW_MAP_DIST = 0.25;
  const ARROW_EDGE = 0.47;
  const LS = {
    arrows: "friends_show_arrows",
    minimap: "friends_show_minimap",
    shareCoords: "friends_share_coords",
    sharePresence: "friends_share_presence",
  };

  let S = null;
  let accountApiGet = null;
  let resolveServerId = null;
  let playTimer = null;
  let presenceTimer = null;
  let drawTimer = null;
  let playData = { friends: [], privacy: { shareCoords: false, sharePresence: true } };
  let friendNickSet = new Set();
  let wiredUi = false;
  let friendsTab = "friends";
  let lastPlayingSent = null;

  function setFriendsTab(which) {
    friendsTab = which === "incoming" || which === "outgoing" ? which : "friends";
    document.querySelectorAll(".friends-subtab").forEach((btn) => {
      const on = btn.getAttribute("data-friends-tab") === friendsTab;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll(".friends-pane").forEach((pane) => {
      const on = pane.getAttribute("data-friends-pane") === friendsTab;
      pane.classList.toggle("active", on);
      if (on) pane.removeAttribute("hidden");
      else pane.setAttribute("hidden", "");
    });
  }

  function updateFriendsCounts(friendsN, outgoingN, incomingN) {
    const set = (id, n) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(n);
    };
    set("friendsCountFriends", friendsN);
    set("friendsCountOutgoing", outgoingN);
    set("friendsCountIncoming", incomingN);
    const badge = document.getElementById("badgeFriends");
    if (badge) {
      badge.textContent = String(friendsN);
      badge.classList.toggle("badge--alert", incomingN > 0);
      if (incomingN > 0) badge.textContent = String(incomingN);
    }
    setIncomingAlerts(incomingN);
  }

  function setIncomingAlerts(incomingN) {
    const n = Math.max(0, Number(incomingN) || 0);
    const show = n > 0;
    const accountDot = document.getElementById("accountFriendsAlert");
    const tabDot = document.getElementById("tabFriendsAlert");
    const tab = document.getElementById("tabFriends");
    const accountItem = document.getElementById("accountMenuItem");
    if (accountDot) {
      accountDot.hidden = !show;
      accountDot.setAttribute("aria-hidden", show ? "false" : "true");
      if (show) accountDot.title = "Входящие заявки в друзья: " + n;
    }
    if (tabDot) {
      tabDot.hidden = !show;
      tabDot.setAttribute("aria-hidden", show ? "false" : "true");
      if (show) tabDot.title = "Входящие: " + n;
    }
    if (tab) tab.classList.toggle("has-friends-alert", show);
    if (accountItem) accountItem.classList.toggle("has-friends-alert", show);
  }

  function lsBool(key, def) {
    try {
      const v = localStorage.getItem(key);
      if (v === null || v === undefined) return def;
      return v === "1" || v === "true";
    } catch (_) {
      return def;
    }
  }
  function lsSet(key, val) {
    try {
      localStorage.setItem(key, val ? "1" : "0");
    } catch (_) {}
  }

  function optArrows() {
    return lsBool(LS.arrows, true);
  }
  function optMinimap() {
    return lsBool(LS.minimap, true);
  }
  function optShareCoords() {
    return lsBool(LS.shareCoords, true);
  }
  function optSharePresence() {
    return lsBool(LS.sharePresence, true);
  }

  global.setFriendArrows = function (v) {
    lsSet(LS.arrows, !!v);
    drawArrows();
  };
  global.setFriendMinimap = function (v) {
    lsSet(LS.minimap, !!v);
    drawMinimapDots();
  };
  global.setFriendShareCoords = function (v) {
    lsSet(LS.shareCoords, !!v);
    syncPrivacyToServer();
    sendPresence(true);
  };
  global.setFriendSharePresence = function (v) {
    lsSet(LS.sharePresence, !!v);
    syncPrivacyToServer();
  };

  function getToken() {
    try {
      return localStorage.getItem("accountToken") || "";
    } catch (_) {
      return "";
    }
  }
  async function api(tag, method, body) {
    if (typeof accountApiGet === "function") {
      return accountApiGet(tag, method || "GET", body || null);
    }
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = "Game " + token;
    if (body) headers["Content-Type"] = "application/json";
    return fetch(API + tag, {
      method: method || "GET",
      headers,
      body: body ? JSON.stringify(body) : null,
      cache: "no-store",
    });
  }

  async function syncPrivacyToServer() {
    if (!getToken()) return;
    try {
      await api("friends/privacy", "POST", {
        shareCoords: optShareCoords(),
        sharePresence: optSharePresence(),
      });
    } catch (_) {}
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rebuildNickSet() {
    const set = new Set();
    (playData.friends || []).forEach((f) => {
      if (f.account_name) set.add(String(f.account_name).toLowerCase());
      (f.nicks || []).forEach((n) => set.add(String(n).toLowerCase().split("#")[0]));
    });
    friendNickSet = set;
  }

  function isFriendName(name) {
    if (!name) return false;
    const n = String(name).toLowerCase().split("#")[0].trim();
    return friendNickSet.has(n);
  }

  function decorateLbName(name) {
    if (!isFriendName(name)) return name;
    return String(name) + ' <span class="lb-friend-mark" title="Друг">★</span>';
  }

  function currentServerKey() {
    if (!S) return "";
    try {
      if (typeof resolveServerId === "function") {
        return resolveServerId(S.CONNECTION_URL || S.SELECTED_SERVER || S.wsUrl || "") || "";
      }
    } catch (_) {}
    return "";
  }

  function isPlaying() {
    if (!S) return false;
    // Dead / spectating: 0 own cells → no arrows for me, and presence playing=false
    return !!(S.playerCells && S.playerCells.length > 0 && S.ws && S.ws.readyState === 1);
  }

  function mapNorm(x, y) {
    if (!S) return null;
    const tw = Number(S.rightPos) - Number(S.leftPos);
    const th = Number(S.bottomPos) - Number(S.topPos);
    if (!(tw > 0) || !(th > 0)) return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      nx: (x - S.leftPos) / tw,
      ny: (y - S.topPos) / th,
    };
  }

  function canvasSize() {
    const canvas = document.getElementById("canvas");
    const w = (canvas && (canvas.clientWidth || canvas.width)) || window.innerWidth || 1;
    const h = (canvas && (canvas.clientHeight || canvas.height)) || window.innerHeight || 1;
    return { w, h, cx: w / 2, cy: h / 2 };
  }

  async function sendPresence(force) {
    if (!getToken()) return;
    if ((Number(S?.accountData?.xp) || 0) < MIN_XP && !force) return;
    const playing = isPlaying();
    if (!force && lastPlayingSent === playing && !playing) {
      // already reported death; skip spam while dead
      return;
    }
    const body = {
      playing,
      serverKey: playing ? currentServerKey() : "",
      serverTitle: playing ? currentServerKey() : "",
      shareCoords: optShareCoords(),
    };
    if (playing && optShareCoords() && S) {
      body.x = S.nodeX;
      body.y = S.nodeY;
    }
    try {
      await api("friends/presence", "POST", body);
      lastPlayingSent = playing;
    } catch (_) {}
  }

  function tickPresence() {
    const playing = isPlaying();
    // Immediate push on death / respawn
    if (lastPlayingSent !== null && lastPlayingSent !== playing) {
      sendPresence(true);
      return;
    }
    sendPresence(false);
  }

  async function refreshPlayData() {
    if (!getToken()) return;
    if ((Number(S?.accountData?.xp) || 0) < MIN_XP) return;
    try {
      const res = await api("friends/play");
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.ok) return;
      playData = data;
      rebuildNickSet();
      drawArrows();
      drawMinimapDots();
      if (typeof data.incomingCount === "number") {
        setIncomingAlerts(data.incomingCount);
        const badge = document.getElementById("badgeFriends");
        if (badge && data.incomingCount > 0) {
          badge.textContent = String(data.incomingCount);
          badge.classList.add("badge--alert");
        } else if (badge && data.incomingCount === 0) {
          badge.classList.remove("badge--alert");
          const friendsPaneCount = document.getElementById("friendsCountFriends");
          if (friendsPaneCount) badge.textContent = friendsPaneCount.textContent || "0";
        }
      }
    } catch (_) {}
  }

  function startLoops() {
    stopLoops();
    playTimer = setInterval(refreshPlayData, PLAY_POLL_MS);
    presenceTimer = setInterval(tickPresence, PRESENCE_MS);
    drawTimer = setInterval(() => {
      tickPresence();
      drawArrows();
      drawMinimapDots();
    }, DRAW_MS);
    refreshPlayData();
    sendPresence(true);
  }
  function stopLoops() {
    if (playTimer) clearInterval(playTimer);
    if (presenceTimer) clearInterval(presenceTimer);
    if (drawTimer) clearInterval(drawTimer);
    playTimer = null;
    presenceTimer = null;
    drawTimer = null;
    lastPlayingSent = null;
  }

  function sameServerFriendCoords() {
    const key = currentServerKey();
    if (!key || (!optArrows() && !optMinimap())) return [];
    if (!isPlaying()) return [];
    return (playData.friends || []).filter((f) => {
      // Friend died (0 cells → playing false) → hide until they play again
      if (!f.playing || !f.online) return false;
      if (!f.serverKey || String(f.serverKey) !== String(key)) return false;
      return Number.isFinite(f.x) && Number.isFinite(f.y);
    });
  }

  function drawArrows() {
    const root = document.getElementById("friendArrows");
    if (!root) return;
    root.innerHTML = "";
    if (!optArrows() || !isPlaying()) return;
    const me = mapNorm(S.nodeX, S.nodeY);
    if (!me) return;
    const { w, h, cx, cy } = canvasSize();
    const edge = Math.min(w, h) * ARROW_EDGE;

    sameServerFriendCoords().forEach((f) => {
      const them = mapNorm(f.x, f.y);
      if (!them) return;
      const dx = them.nx - me.nx;
      const dy = them.ny - me.ny;
      const dist = Math.hypot(dx, dy);
      // Far enough on minimap (≈ >1 sector; E1↔C1 ≈ 0.4)
      if (!(dist >= ARROW_MAP_DIST)) return;

      const ang = Math.atan2(dy, dx);
      const ax = cx + Math.cos(ang) * edge;
      const ay = cy + Math.sin(ang) * edge;
      const el = document.createElement("div");
      el.className = "friend-arrow";
      el.style.left = ax + "px";
      el.style.top = ay + "px";
      el.style.transform =
        "translate(-50%,-50%) rotate(" + (ang + Math.PI / 2) + "rad)";
      el.innerHTML = '<div class="friend-arrow-inner"></div>';
      root.appendChild(el);
    });
  }

  function drawMinimapDots() {
    const root = document.getElementById("friendMapDots");
    if (!root || !S) return;
    root.innerHTML = "";
    if (!optMinimap() || !isPlaying()) return;
    const map = document.querySelector(".map-container");
    if (!map) return;
    const mw = map.offsetWidth || 0;
    const mh = map.offsetHeight || 0;
    if (!mw || !mh) return;
    sameServerFriendCoords().forEach((f) => {
      const them = mapNorm(f.x, f.y);
      if (!them) return;
      const mx = them.nx * mw;
      const my = them.ny * mh;
      if (!Number.isFinite(mx) || !Number.isFinite(my)) return;
      const dot = document.createElement("span");
      dot.className = "friend-map-dot";
      dot.style.left = mx + "px";
      dot.style.top = my + "px";
      root.appendChild(dot);
    });
  }

  function displayFriendName(f) {
    const name = String(f?.account_name || "").trim();
    if (name) return name;
    return "ID " + (f?.uid ?? "?");
  }

  function renderFriendRow(f, mode) {
    const li = document.createElement("li");
    li.className = "friends-row";
    const left = document.createElement("div");
    left.className = "friends-row-main";
    const title = document.createElement("div");
    title.className = "friends-row-title";
    const shown = displayFriendName(f);
    const hasName = !!String(f?.account_name || "").trim();
    title.innerHTML =
      '<span class="friends-row-name">' +
      esc(shown) +
      "</span>" +
      (hasName
        ? '<span class="friends-row-id">ID ' + esc(f.uid) + "</span>"
        : "");
    left.appendChild(title);
    if (mode === "friends") {
      const meta = document.createElement("div");
      if (f.hidden) {
        meta.className = "friends-meta online";
        meta.textContent = "в сети (скрыто)";
      } else if (f.online && f.playing && f.serverKey) {
        meta.className = "friends-meta online";
        meta.textContent = "в игре · " + String(f.serverKey);
      } else if (f.online) {
        meta.className = "friends-meta online";
        meta.textContent = "в сети";
      } else {
        meta.className = "friends-meta offline";
        meta.textContent = "не в сети";
      }
      left.appendChild(meta);
    } else if (mode === "incoming") {
      const meta = document.createElement("div");
      meta.className = "friends-meta";
      meta.textContent = "хочет добавить вас";
      left.appendChild(meta);
    } else if (mode === "outgoing") {
      const meta = document.createElement("div");
      meta.className = "friends-meta";
      meta.textContent = "ожидает ответа";
      left.appendChild(meta);
    }
    const actions = document.createElement("div");
    actions.className = "friends-actions";
    if (mode === "incoming") {
      const a = document.createElement("button");
      a.className = "friends-btn";
      a.type = "button";
      a.textContent = "Принять";
      a.onclick = () => act("friends/accept", f.uid);
      const r = document.createElement("button");
      r.className = "friends-btn secondary";
      r.type = "button";
      r.textContent = "Отклонить";
      r.onclick = () => act("friends/reject", f.uid);
      actions.append(a, r);
    } else if (mode === "outgoing") {
      const c = document.createElement("button");
      c.className = "friends-btn secondary";
      c.type = "button";
      c.textContent = "Отменить";
      c.onclick = () => act("friends/remove", f.uid);
      actions.append(c);
    } else if (mode === "friends") {
      const c = document.createElement("button");
      c.className = "friends-btn danger";
      c.type = "button";
      c.textContent = "Удалить";
      c.onclick = () => {
        if (confirm("Удалить из друзей?")) act("friends/remove", f.uid);
      };
      actions.append(c);
    } else if (mode === "search") {
      const b = document.createElement("button");
      b.className = "friends-btn";
      b.type = "button";
      if (f.relation === "friends") {
        b.textContent = "Друзья";
        b.disabled = true;
      } else if (f.relation === "outgoing") {
        b.textContent = "Заявка";
        b.disabled = true;
      } else if (f.relation === "incoming") {
        b.textContent = "Принять";
        b.onclick = () => act("friends/accept", f.uid);
      } else {
        b.textContent = "Добавить";
        b.onclick = () => act("friends/request", f.uid);
      }
      actions.append(b);
    }
    li.append(left, actions);
    return li;
  }

  function clearSearchResults(uid) {
    const box = document.getElementById("friendsSearchResults");
    const inp = document.getElementById("friendsSearchInput");
    if (box) {
      if (uid != null) {
        const id = String(uid);
        Array.from(box.querySelectorAll(".friends-result")).forEach((row) => {
          if (String(row.getAttribute("data-uid") || "") === id) row.remove();
        });
        if (!box.querySelector(".friends-result")) box.innerHTML = "";
      } else {
        box.innerHTML = "";
      }
    }
    if (inp && uid == null) inp.value = "";
    if (inp && uid != null && String(inp.value || "").trim() === String(uid)) inp.value = "";
  }

  async function act(path, uid) {
    try {
      const res = await api(path, "POST", { uid });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || data.error || "Ошибка");
        return;
      }
      if (path === "friends/request" || path === "friends/accept") {
        clearSearchResults(uid);
      }
      await loadFriendsPanel();
      await refreshPlayData();
    } catch (_) {
      alert("Ошибка сети");
    }
  }

  async function loadFriendsPanel() {
    const list = document.getElementById("friendsList");
    const incoming = document.getElementById("friendsIncomingList");
    const outgoing = document.getElementById("friendsOutgoingList");
    const hint = document.getElementById("friendsHint");
    if (!list) return;
    if (!getToken()) {
      list.innerHTML = "<li class='empty'>Войдите в ЛК</li>";
      updateFriendsCounts(0, 0, 0);
      return;
    }
    const xp = Number(S?.accountData?.xp) || 0;
    if (xp < MIN_XP) {
      list.innerHTML = "";
      if (incoming) incoming.innerHTML = "";
      if (outgoing) outgoing.innerHTML = "";
      updateFriendsCounts(0, 0, 0);
      if (hint) hint.textContent = "Друзья доступны от " + MIN_XP + " XP (сейчас " + xp + ").";
      return;
    }
    try {
      const res = await api("friends");
      const data = await res.json();
      if (res.status === 403) {
        if (hint) hint.textContent = data.message || "Нужно больше XP";
        return;
      }
      if (!res.ok) throw new Error("fail");
      const friends = data.friends || [];
      const incomingRows = data.incoming || [];
      const outgoingRows = data.outgoing || [];
      list.innerHTML = "";
      if (incoming) incoming.innerHTML = "";
      if (outgoing) outgoing.innerHTML = "";
      friends.forEach((f) => list.appendChild(renderFriendRow(f, "friends")));
      incomingRows.forEach((f) => incoming && incoming.appendChild(renderFriendRow(f, "incoming")));
      outgoingRows.forEach((f) => outgoing && outgoing.appendChild(renderFriendRow(f, "outgoing")));
      if (!friends.length) list.innerHTML = "<li class='empty'>Пока нет друзей — найдите игрока выше</li>";
      if (incoming && !incomingRows.length) incoming.innerHTML = "<li class='empty'>Нет входящих заявок</li>";
      if (outgoing && !outgoingRows.length) outgoing.innerHTML = "<li class='empty'>Нет исходящих заявок</li>";
      updateFriendsCounts(friends.length, outgoingRows.length, incomingRows.length);
      if (incomingRows.length) setFriendsTab("incoming");
      if (hint) {
        const leftReq = Math.max(
          0,
          (Number(data.maxRequestsPerDay) || 15) - (Number(data.requestsToday) || 0)
        );
        hint.textContent =
          "Друзья: " +
          friends.length +
          "/" +
          (data.maxFriends || 100) +
          ". Заявок сегодня: " +
          (data.requestsToday || 0) +
          "/" +
          (data.maxRequestsPerDay || 15) +
          " (осталось " +
          leftReq +
          "). Имя видно только у друзей и во входящих.";
      }
      if (data.privacy) {
        const sc = document.getElementById("optFriendShareCoords");
        const sp = document.getElementById("optFriendSharePresence");
        if (sc && typeof data.privacy.shareCoords === "boolean") {
          sc.checked = !!data.privacy.shareCoords;
          lsSet(LS.shareCoords, !!data.privacy.shareCoords);
        }
        if (sp && typeof data.privacy.sharePresence === "boolean") {
          sp.checked = data.privacy.sharePresence !== false;
          lsSet(LS.sharePresence, data.privacy.sharePresence !== false);
        }
      }
    } catch (_) {
      list.innerHTML = "<li class='empty'>Не удалось загрузить</li>";
    }
  }

  async function searchFriends() {
    const q = (document.getElementById("friendsSearchInput")?.value || "").trim();
    const box = document.getElementById("friendsSearchResults");
    if (!box) return;
    box.innerHTML = "";
    if (!q) return;
    if (!/^\d{1,12}$/.test(q)) {
      box.textContent = "Введите только ID личного кабинета (цифры)";
      return;
    }
    try {
      const res = await api("friends/search?q=" + encodeURIComponent(q));
      const data = await res.json();
      if (!res.ok) {
        box.textContent = data.message || data.error || "Ошибка";
        return;
      }
      const results = (data.results || []).filter((f) => {
        // Already friends / already sent — don't keep visible in search
        return f.relation !== "friends" && f.relation !== "outgoing";
      });
      results.forEach((f) => {
        const row = document.createElement("div");
        row.className = "friends-result";
        row.setAttribute("data-uid", String(f.uid));
        const left = document.createElement("div");
        const hasName = !!String(f?.account_name || "").trim();
        left.innerHTML = hasName
          ? esc(displayFriendName(f)) + " <small>ID " + esc(f.uid) + "</small>"
          : esc(displayFriendName(f));
        const actions = document.createElement("div");
        actions.className = "friends-actions";
        const fakeLi = renderFriendRow(f, "search");
        const btns = fakeLi.querySelector(".friends-actions");
        if (btns) actions.append(...btns.childNodes);
        row.append(left, actions);
        box.appendChild(row);
      });
      if (!(data.results || []).length) box.textContent = "Игрок с таким ID не найден";
      else if (!results.length) box.innerHTML = "";
    } catch (_) {
      box.textContent = "Ошибка сети";
    }
  }

  function wireUi() {
    if (wiredUi) return;
    wiredUi = true;
    const btn = document.getElementById("friendsSearchBtn");
    const inp = document.getElementById("friendsSearchInput");
    if (btn) btn.onclick = () => searchFriends();
    if (inp) {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") searchFriends();
      });
    }
    document.querySelectorAll(".friends-subtab").forEach((tab) => {
      tab.addEventListener("click", () => setFriendsTab(tab.getAttribute("data-friends-tab")));
    });
    setFriendsTab(friendsTab);
    const map = [
      ["optFriendArrows", optArrows()],
      ["optFriendMinimap", optMinimap()],
      ["optFriendShareCoords", optShareCoords()],
      ["optFriendSharePresence", optSharePresence()],
    ];
    map.forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    });
  }

  function patchShowTab(original) {
    return function (Sref, which) {
      const tabF = document.getElementById("tabFriends");
      const friends = document.getElementById("friendsWrap");
      if (typeof original === "function") original(Sref, which);
      if (!tabF || !friends) return;
      const isF = which === "friends";
      tabF.classList.toggle("active", isF);
      friends.style.display = isF ? "" : "none";
      if (isF) loadFriendsPanel();
    };
  }

  function init(gameS, hooks) {
    S = gameS;
    accountApiGet = hooks?.accountApiGet || null;
    resolveServerId = hooks?.resolveServerId || null;
    wireUi();
    if (getToken() && (Number(S?.accountData?.xp) || 0) >= MIN_XP) startLoops();
  }

  function onAccount(data) {
    if (S) S.accountData = data || S.accountData;
    if ((Number(S?.accountData?.xp) || 0) >= MIN_XP) {
      startLoops();
      syncPrivacyToServer();
    } else stopLoops();
  }

  function onLogout() {
    stopLoops();
    playData = { friends: [], privacy: {} };
    friendNickSet = new Set();
    updateFriendsCounts(0, 0, 0);
    setIncomingAlerts(0);
    const root = document.getElementById("friendArrows");
    if (root) root.innerHTML = "";
    const map = document.getElementById("friendMapDots");
    if (map) map.innerHTML = "";
  }

  global.AgarFriends = {
    init,
    onAccount,
    onLogout,
    decorateLbName,
    isFriendName,
    loadFriendsPanel,
    patchShowTab,
    wireFriendsTab(showNickClanTab) {
      const tabF = document.getElementById("tabFriends");
      if (!tabF || tabF.dataset.wired) return showNickClanTab;
      tabF.dataset.wired = "1";
      tabF.onclick = () => {
        // deactivate others via patched show
        if (typeof showNickClanTab === "function") showNickClanTab(S, "friends");
      };
      return patchShowTab(showNickClanTab);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
