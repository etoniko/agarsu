/**
 * Client Friends feature (agar.su). Rollback: remove this script + HTML/CSS hooks.
 * Depends on API /api/friends* (file-backed). Does not touch game servers.
 */
(function (global) {
  "use strict";

  const API = "https://api.agar.su/api/";
  const MIN_XP = 1000;
  const PLAY_POLL_MS = 4000;
  const PRESENCE_MS = 3000;
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
  let playData = { friends: [], privacy: { shareCoords: false, sharePresence: true } };
  let friendNickSet = new Set();
  let wiredUi = false;

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
    return lsBool(LS.shareCoords, false);
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
  function getSessionId() {
    try {
      return sessionStorage.getItem("accountSessionId") || "";
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
    const sid = getSessionId();
    if (sid) headers["X-Session-Id"] = sid;
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
    return !!(S.playerCells && S.playerCells.length && S.ws && S.ws.readyState === 1);
  }

  async function sendPresence(force) {
    if (!getToken()) return;
    if ((Number(S?.accountData?.xp) || 0) < MIN_XP && !force) return;
    const playing = isPlaying();
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
    } catch (_) {}
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
    } catch (_) {}
  }

  function startLoops() {
    stopLoops();
    playTimer = setInterval(refreshPlayData, PLAY_POLL_MS);
    presenceTimer = setInterval(() => sendPresence(false), PRESENCE_MS);
    refreshPlayData();
    sendPresence(true);
  }
  function stopLoops() {
    if (playTimer) clearInterval(playTimer);
    if (presenceTimer) clearInterval(presenceTimer);
    playTimer = null;
    presenceTimer = null;
  }

  function sameServerFriendCoords() {
    const key = currentServerKey();
    if (!key || !optArrows() && !optMinimap()) return [];
    return (playData.friends || []).filter((f) => {
      if (!f.playing || !f.online) return false;
      if (!f.serverKey || String(f.serverKey) !== String(key)) return false;
      return Number.isFinite(f.x) && Number.isFinite(f.y);
    });
  }

  function worldToScreen(wx, wy) {
    if (!S) return null;
    const canvas = document.getElementById("canvas");
    if (!canvas) return null;
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;
    // Approximate using view: same as typical agar clients
    const zoom = S.viewZoom || 1;
    const sx = (wx - S.nodeX) * zoom + w / 2;
    const sy = (wy - S.nodeY) * zoom + h / 2;
    return { x: sx, y: sy, w, h };
  }

  function drawArrows() {
    const root = document.getElementById("friendArrows");
    if (!root) return;
    root.innerHTML = "";
    if (!optArrows() || !isPlaying()) return;
    const friends = sameServerFriendCoords();
    friends.forEach((f) => {
      const scr = worldToScreen(f.x, f.y);
      if (!scr) return;
      const margin = 40;
      const onScreen =
        scr.x >= margin &&
        scr.y >= margin &&
        scr.x <= scr.w - margin &&
        scr.y <= scr.h - margin;
      if (onScreen) return;
      const cx = scr.w / 2;
      const cy = scr.h / 2;
      const dx = scr.x - cx;
      const dy = scr.y - cy;
      const ang = Math.atan2(dy, dx);
      const edge = Math.min(scr.w, scr.h) * 0.42;
      const ax = cx + Math.cos(ang) * edge;
      const ay = cy + Math.sin(ang) * edge;
      const el = document.createElement("div");
      el.className = "friend-arrow";
      el.style.left = ax + "px";
      el.style.top = ay + "px";
      el.style.transform = "translate(-50%,-50%) rotate(" + (ang + Math.PI / 2) + "rad)";
      el.innerHTML =
        '<div class="friend-arrow-inner"></div><div class="friend-arrow-label">' +
        esc(f.account_name || "Друг") +
        "</div>";
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
    const tw = S.rightPos - S.leftPos;
    const th = S.bottomPos - S.topPos;
    if (tw <= 0 || th <= 0) return;
    sameServerFriendCoords().forEach((f) => {
      const mx = ((f.x - S.leftPos) / tw) * mw;
      const my = ((f.y - S.topPos) / th) * mh;
      const dot = document.createElement("span");
      dot.className = "friend-map-dot";
      dot.style.left = mx + "px";
      dot.style.top = my + "px";
      dot.title = f.account_name || "Друг";
      root.appendChild(dot);
    });
  }

  function renderFriendRow(f, mode) {
    const li = document.createElement("li");
    const left = document.createElement("div");
    const name = esc(f.account_name || "Игрок") + " <small>ID " + esc(f.uid) + "</small>";
    let meta = "";
    if (mode === "friends") {
      if (f.hidden) meta = '<div class="friends-meta online">в сети (скрыто)</div>';
      else if (f.online && f.playing && f.serverKey)
        meta =
          '<div class="friends-meta online">в игре · ' + esc(f.serverKey) + "</div>";
      else if (f.online) meta = '<div class="friends-meta online">в сети</div>';
      else meta = '<div class="friends-meta offline">не в сети</div>';
    }
    left.innerHTML = "<div>" + name + "</div>" + meta;
    const actions = document.createElement("div");
    actions.className = "friends-actions";
    if (mode === "incoming") {
      const a = document.createElement("button");
      a.className = "friends-btn";
      a.textContent = "Принять";
      a.onclick = () => act("friends/accept", f.uid);
      const r = document.createElement("button");
      r.className = "friends-btn secondary";
      r.textContent = "Отклонить";
      r.onclick = () => act("friends/reject", f.uid);
      actions.append(a, r);
    } else if (mode === "outgoing") {
      const c = document.createElement("button");
      c.className = "friends-btn secondary";
      c.textContent = "Отменить";
      c.onclick = () => act("friends/remove", f.uid);
      actions.append(c);
    } else if (mode === "friends") {
      const c = document.createElement("button");
      c.className = "friends-btn danger";
      c.textContent = "Удалить";
      c.onclick = () => {
        if (confirm("Удалить из друзей?")) act("friends/remove", f.uid);
      };
      actions.append(c);
    } else if (mode === "search") {
      const b = document.createElement("button");
      b.className = "friends-btn";
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

  async function act(path, uid) {
    try {
      const res = await api(path, "POST", { uid });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || data.error || "Ошибка");
        return;
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
    const badge = document.getElementById("badgeFriends");
    const hint = document.getElementById("friendsHint");
    if (!list) return;
    if (!getToken()) {
      list.innerHTML = "<li class='empty'>Войдите в ЛК</li>";
      return;
    }
    const xp = Number(S?.accountData?.xp) || 0;
    if (xp < MIN_XP) {
      list.innerHTML = "";
      if (incoming) incoming.innerHTML = "";
      if (outgoing) outgoing.innerHTML = "";
      if (hint) hint.textContent = "Друзья доступны от " + MIN_XP + " XP (сейчас " + xp + ").";
      if (badge) badge.textContent = "0";
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
      list.innerHTML = "";
      incoming.innerHTML = "";
      outgoing.innerHTML = "";
      (data.friends || []).forEach((f) => list.appendChild(renderFriendRow(f, "friends")));
      (data.incoming || []).forEach((f) => incoming.appendChild(renderFriendRow(f, "incoming")));
      (data.outgoing || []).forEach((f) => outgoing.appendChild(renderFriendRow(f, "outgoing")));
      if (!(data.friends || []).length) list.innerHTML = "<li class='empty'>—</li>";
      if (!(data.incoming || []).length) incoming.innerHTML = "<li class='empty'>—</li>";
      if (!(data.outgoing || []).length) outgoing.innerHTML = "<li class='empty'>—</li>";
      if (badge) badge.textContent = String((data.friends || []).length);
      if (hint) {
        hint.textContent =
          "Друзья: " +
          (data.friends || []).length +
          ". Координаты передаются только если вы включили это в настройках.";
      }
      // reflect privacy checkboxes from server if present
      if (data.privacy) {
        const sc = document.getElementById("optFriendShareCoords");
        const sp = document.getElementById("optFriendSharePresence");
        if (sc && typeof data.privacy.shareCoords === "boolean") {
          sc.checked = !!data.privacy.shareCoords;
          lsSet(LS.shareCoords, !!data.privacy.shareCoords);
        }
        if (sp && typeof data.privacy.sharePresence === "boolean") {
          sp.checked = !!data.privacy.sharePresence;
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
    try {
      const res = await api("friends/search?q=" + encodeURIComponent(q));
      const data = await res.json();
      if (!res.ok) {
        box.textContent = data.message || data.error || "Ошибка";
        return;
      }
      (data.results || []).forEach((f) => {
        const row = document.createElement("div");
        row.className = "friends-result";
        const left = document.createElement("div");
        left.innerHTML = esc(f.account_name) + " <small>ID " + esc(f.uid) + "</small>";
        const actions = document.createElement("div");
        actions.className = "friends-actions";
        const fakeLi = renderFriendRow(f, "search");
        const btns = fakeLi.querySelector(".friends-actions");
        if (btns) actions.append(...btns.childNodes);
        row.append(left, actions);
        box.appendChild(row);
      });
      if (!(data.results || []).length) box.textContent = "Никого не найдено";
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
    // restore settings checkboxes
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
    // redraw loop
    setInterval(() => {
      drawArrows();
      drawMinimapDots();
    }, 500);
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
