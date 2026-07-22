import { ONLINE_HUB_URL, SKIN_FALLBACK_URL } from "../config/endpoints.js";
import { getGameServerApiBase } from "../config/servers.js";
import { isOverlaysVisible, onReady, addOverlaysLifecycleHooks } from "../lib/dom.js";
import { normalizeNick } from "../lib/nick.js";
import { setImgSrc } from "../render/skins.js";
import { getCookie } from "../storage/cookies.js";
import {
  loadSkinListMap,
  applySkinListToState,
  getSkinIdForNick,
  getSkinUrlForNick,
  invalidateStatsRenderCaches
} from "../storage/skinList.js";
const STATS_API = "https://api.agar.su:6009";
const STATS_PAGE_URL = "https://agar.su/stats/";
const STATS_PROFILE_BASE = "https://agar.su/stats/users/?id=";
const STATS_CLAN_PROFILE_BASE = "https://agar.su/stats/clans/?id=";
const FORBIDDEN_NICK_CHARS = ["\uFDFD", "\u{1242B}", "\u{12219}", "\u2E3B", "\uA9C5", "\u102A", "\u0BF5", "\u0BF8", "\u2031", "\u3164", "\u2063", "\u200E ", "\u200B", "\u200C", "\u200D", "\u200E", "\u200F", "\u2000", "\u2001", "\u2002", "\u2003", "\u2004", "\u2005", "\u2006", "\u2007", "\u2008", "\u2009", "\u200A", "\u200B", "\uFEFF", "", "\u2006", "\u2800", "\uFFA0", "\u5350", "\u534D"];
function getStarClass(level) {
  if (level >= 1 && level < 50) return "";
  if (level >= 50 && level < 100) return "azure";
  if (level >= 100 && level < 150) return "red";
  if (level >= 150 && level < 200) return "white";
  if (level >= 200) return "black";
  return "";
}
const getXp = (level) => ~~(100 * (level ** 2 / 2));
const getLevel = (xp) => ~~((xp / 100 * 2) ** 0.5);
function getPlayerSkinId(S, nick) {
  const normalized = normalizeNick((nick || "").replace(/<[^>]*>/g, ""));
  return normalized && S.skinList[normalized] ? S.skinList[normalized] : "4";
}
function createLevelIcon(S, level, nick, hooks) {
  const getSkinImageUrl = hooks.getSkinImageUrl;
  if (level >= 200) {
    const img = document.createElement("img");
    img.className = "account-level-avatar " + getStarClass(level);
    setImgSrc(img, getSkinImageUrl(getPlayerSkinId(S, nick)));
    img.onerror = () => {
      if (!img.dataset.fallback) {
        img.dataset.fallback = "1";
        setImgSrc(img, SKIN_FALLBACK_URL);
      }
    };
    return img;
  }
  const starIcon = document.createElement("i");
  starIcon.className = "fas fa-star " + getStarClass(level);
  return starIcon;
}
const scoreMessages = {
  low: [
    "\u041D\u0438\u0447\u0435\u0433\u043E, \u0437\u043E\u0432\u0438 \u0434\u0440\u0443\u0437\u0435\u0439 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437!",
    "\u0422\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0447\u0430\u043B\u043E! \u041F\u043E\u0434\u0435\u043B\u0438\u0441\u044C \u0441 \u0434\u0440\u0443\u0437\u044C\u044F\u043C\u0438 \u0438 \u0432\u0435\u0440\u043D\u0438\u0441\u044C \u0441\u0438\u043B\u044C\u043D\u044B\u043C!",
    "\u0411\u044B\u0441\u0442\u0440\u043E \u0443\u043C\u0435\u0440? \u0417\u043E\u0432\u0438 \u0434\u0440\u0443\u0437\u0435\u0439, \u043F\u0443\u0441\u0442\u044C \u043E\u043D\u0438 \u043F\u043E\u043A\u0430\u0436\u0443\u0442 \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u0442\u0432\u043E!",
    "\u041D\u0435 \u0440\u0430\u0441\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0439\u0441\u044F, \u043A\u0430\u0436\u0434\u0430\u044F \u0438\u0433\u0440\u0430 \u2014 \u044D\u0442\u043E \u043E\u043F\u044B\u0442. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0441\u043D\u043E\u0432\u0430!",
    "\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u043F\u043E\u043C\u0435\u043D\u044F\u0442\u044C \u0444\u043E\u043D \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u2014 \u043C\u043E\u0436\u0435\u0442, \u043F\u043E\u043C\u043E\u0436\u0435\u0442!",
    "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 F, \u0447\u0442\u043E\u0431\u044B \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C\u0441\u044F \u0438 \u043E\u0431\u0434\u0443\u043C\u0430\u0442\u044C \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044E!",
    "\u0422\u0435\u0440\u043F\u0435\u043D\u0438\u0435 \u0438 \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044F \u0432\u0430\u0436\u043D\u0435\u0435 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438!",
    "\u041D\u0430\u0436\u0438\u043C\u0430\u044F W \u2014 \u0432\u044B\u0434\u0435\u043B\u044F\u0435\u0442\u0441\u044F \u0446\u0435\u0448\u043A\u0430 (\u043C\u0430\u043B\u0435\u043D\u044C\u043A\u0430\u044F \u043C\u0430\u0441\u0441\u0430)."
  ],
  mid: [
    "\u041D\u0435\u043F\u043B\u043E\u0445\u043E! \u041F\u043E\u0437\u043E\u0432\u0438 \u0434\u0440\u0443\u0437\u0435\u0439 \u0438 \u0431\u0440\u043E\u0441\u044C\u0442\u0435 \u0434\u0440\u0443\u0433 \u0434\u0440\u0443\u0433\u0443 \u0432\u044B\u0437\u043E\u0432!",
    "\u0425\u043E\u0440\u043E\u0448\u0430\u044F \u0438\u0433\u0440\u0430! \u041F\u043E\u0434\u0435\u043B\u0438\u0441\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u043C \u0438 \u0437\u043E\u0432\u0438 \u0434\u0440\u0443\u0437\u0435\u0439!",
    "\u0422\u044B \u0443\u0436\u0435 \u043D\u0430 \u043F\u043E\u043B\u043F\u0443\u0442\u0438! \u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0439 \u0438 \u0443\u0434\u0438\u0432\u0438 \u0432\u0441\u0435\u0445!",
    "F \u2014 \u0434\u043B\u044F \u043F\u0430\u0443\u0437\u044B \u0438 \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u0438. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0441 \u0443\u043C\u043E\u043C!",
    "W \u2014 \u0446\u0435\u0448\u043A\u0430. \u041A\u043E\u0440\u043C\u0438 \u0432\u0440\u0430\u0433\u043E\u0432 \u0438\u043B\u0438 \u0437\u0430\u043C\u0430\u043D\u0438\u0432\u0430\u0439!"
  ],
  high: [
    "\u0412\u0430\u0443! \u041B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442! \u0414\u0435\u043B\u0438\u0441\u044C \u0441 \u0434\u0440\u0443\u0437\u044C\u044F\u043C\u0438!",
    "\u0422\u044B \u043D\u0430 \u0432\u0435\u0440\u0448\u0438\u043D\u0435! \u041F\u043E\u043A\u0430\u0436\u0438, \u043A\u0442\u043E \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u0439 \u0447\u0435\u043C\u043F\u0438\u043E\u043D!",
    "\u041F\u0440\u0435\u0432\u043E\u0441\u0445\u043E\u0434\u043D\u043E! \u041A\u0430\u0436\u0434\u044B\u0439 \u0448\u0430\u0433 \u2014 \u043A\u0430\u043A \u043F\u043E \u0443\u0447\u0435\u0431\u043D\u0438\u043A\u0443!",
    "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0444\u043E\u043D\u0430 \u2014 \u0442\u0432\u043E\u0439 \u0441\u0442\u0438\u043B\u044C, \u0442\u0432\u043E\u044F \u043A\u043E\u043D\u0446\u0435\u043D\u0442\u0440\u0430\u0446\u0438\u044F!",
    "F \u0432 \u043D\u0443\u0436\u043D\u044B\u0439 \u043C\u043E\u043C\u0435\u043D\u0442 \u2014 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u0434\u0430\u0436\u0435 \u043D\u0430 \u0432\u0435\u0440\u0448\u0438\u043D\u0435!",
    "\u0422\u044B \u2014 \u043C\u0430\u0441\u0442\u0435\u0440! \u0411\u0435\u0439 \u0440\u0435\u043A\u043E\u0440\u0434\u044B \u0434\u0430\u043B\u044C\u0448\u0435!"
  ]
};
function pointsLabel(n) {
  n = Math.abs(Number(n) || 0);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return n + " \u043E\u0447\u043A\u043E\u0432";
  if (mod10 === 1) return n + " \u043E\u0447\u043A\u043E";
  if (mod10 >= 2 && mod10 <= 4) return n + " \u043E\u0447\u043A\u0430";
  return n + " \u043E\u0447\u043A\u043E\u0432";
}
function displayStats(S, stats) {
  const container = document.getElementById("table-containerwraper");
  if (!container) return;
  const renderKey = JSON.stringify(stats);
  if (renderKey === S.lastStatsRenderKey && container.childElementCount) return;
  S.lastStatsRenderKey = renderKey;
  container.innerHTML = "";
  stats.forEach((player, index) => {
    const playerDiv = document.createElement("div");
    playerDiv.classList.add("top-playerwraper");
    playerDiv.setAttribute("title", player.time);
    playerDiv.innerHTML = `
        <div>${index + 1}</div>
        <div>${player.nick}</div>
        <div>${player.score}</div>
        <div class="skinswraper" style="background-image: url('${getSkinUrlForNick(S.skinList, player.nick)}');"></div>
    `;
    container.appendChild(playerDiv);
  });
}
async function fetchStats(S, stats) {
  try {
    if (!Array.isArray(stats)) {
      throw new Error("Invalid stats data");
    }
    const { map, obj } = await loadSkinListMap();
    applySkinListToState(S, { map, obj });
    stats.forEach((player) => {
      player.skin = getSkinIdForNick(map, player.nick);
    });
    displayStats(S, stats);
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
  }
}
function loadTopPlayerData(S, stat, hooks) {
  try {
    if (stat.length > 0) {
      const topPlayer = stat[0];
      S.topPlayerNick = topPlayer.nick;
      S.topPlayerScore = topPlayer.score;
      const skinId = getSkinIdForNick(S.skinList, topPlayer.nick, "4");
      if (typeof hooks?.onTopPlayer === "function") {
        hooks.onTopPlayer(topPlayer);
      } else if (hooks?.innerImage && typeof hooks.getSkinImageUrl === "function") {
        const innerImage = hooks.innerImage;
        const nextSrc = hooks.getSkinImageUrl(skinId);
        if (innerImage.dataset.skinSrc !== nextSrc) {
          innerImage.dataset.skinSrc = nextSrc;
          hooks.isInnerImageLoaded = false;
          innerImage.src = nextSrc;
        }
      }
      S.topPlayerSkin = skinId || "default";
    }
  } catch (error) {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445 \u043E \u0442\u043E\u043F-1 \u0438\u0433\u0440\u043E\u043A\u0435:", error);
  }
}
async function updateOnlineCount() {
  let rows = [];
  try {
    const res = await fetch(ONLINE_HUB_URL, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    rows = Array.isArray(data.servers) ? data.servers : [];
  } catch (_) {
    return;
  }
  let totalOnline = 0;
  for (const row of rows) {
    const id = row.id;
    if (!id) continue;
    const playing = row.playing ?? 0;
    const observers = row.no_playing ?? 0;
    const max = row.max ?? 0;
    totalOnline += playing + observers;
    const li = document.getElementById(id);
    if (li) {
      const spans = li.querySelectorAll(".online-count");
      if (spans.length >= 2) {
        spans[0].textContent = observers;
        spans[1].textContent = max > 0 ? `${playing}/${max}` : String(playing);
      }
    }
  }
  const onlineElement = document.getElementById("online");
  if (onlineElement) {
    onlineElement.textContent = `\u041E\u043D\u043B\u0430\u0439\u043D: ${totalOnline}`;
  }
}
function startOnlineCountPolling() {
  updateOnlineCount();
  if (!window.onlineInterval) {
    window.onlineInterval = setInterval(updateOnlineCount, 5e3);
  }
}
function stopOnlineCountPolling() {
  if (window.onlineInterval) {
    clearInterval(window.onlineInterval);
    window.onlineInterval = null;
  }
}
function calcUserScore(S) {
  let score = 0;
  for (let i = 0; i < S.playerCells.length; i++) {
    score += S.playerCells[i].nSize * S.playerCells[i].nSize;
  }
  return score;
}
function updateStats(S) {
  const currentScore = Math.floor(calcUserScore(S) / 100);
  const cellCount = S.playerCells.length;
  if (currentScore > S.maxScore) {
    S.maxScore = currentScore;
    const elMax = document.getElementById("score-max");
    if (elMax) elMax.innerText = "\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C: " + S.maxScore;
  }
  const elCurrent = document.getElementById("score-new");
  if (elCurrent) {
    const prevScore = parseInt(elCurrent.innerText.match(/\d+/)?.[0] || "0", 10);
    if (currentScore !== prevScore) {
      elCurrent.innerText = "\u0421\u0435\u0439\u0447\u0430\u0441: " + currentScore;
    }
  }
  const elCells = document.getElementById("cell-length");
  if (elCells) {
    const prevCells = parseInt(elCells.innerText, 10) || 0;
    if (cellCount !== prevCells) {
      elCells.innerText = cellCount;
    }
  }
}
function getShareMessage(S) {
  const max = S.maxScore;
  const messages = max < 1e3 ? scoreMessages.low : max < 1e4 ? scoreMessages.mid : scoreMessages.high;
  return messages[Math.floor(Math.random() * messages.length)];
}
function updateShareText(S) {
  const el = document.getElementById("shareText");
  if (el) el.textContent = getShareMessage(S);
}
function getStatsText(S) {
  return `\u041C\u043E\u044F \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0432 Agar.su!
\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u043C\u0430\u0441\u0441\u0430: ${S.maxScore}
\u0412\u0440\u0435\u043C\u044F \u0438\u0433\u0440\u044B: ${Date.now()}`;
}
function shareStats(S, platform) {
  const text = encodeURIComponent(getStatsText(S));
  const url = encodeURIComponent(location.href);
  const urls = {
    vk: `https://vk.com/share.php?url=${url}&title=${text}`,
    telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`,
    twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`
  };
  const w = 650;
  const h = 450;
  const left = (screen.width - w) / 2;
  const top = (screen.height - h) / 2;
  window.open(
    urls[platform] || "",
    "_blank",
    `width=${w},height=${h},top=${top},left=${left},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
  );
}
async function refreshGlobalRatingHome(S, data) {
  const container = document.getElementById("topswindow");
  if (!container) return;
  const { map, obj } = await loadSkinListMap();
  applySkinListToState(S, { map, obj });
  container.innerHTML = "";
  const players = (data.players || []).slice(0, 3);
  const clans = (data.clans || []).slice(0, 3);
  function createRow(name, points, index, passId, isClan) {
    const medal = index === 0 ? "gold" : index === 1 ? "silver" : "bronze";
    const skinUrl = getSkinUrlForNick(map, name, "4");
    const pts = Number(points) || 0;
    const row = document.createElement("div");
    row.className = "rating-row " + medal + (passId ? " rating-row--link" : "");
    row.innerHTML = `<div>${index + 1}</div><div>${name || "\u2014"}</div><div class="rating-pts">${pointsLabel(pts)}</div><div class="avatar" style="background-image: url('${skinUrl}');"></div>`;
    if (passId) {
      const profileBase = isClan ? STATS_CLAN_PROFILE_BASE : STATS_PROFILE_BASE;
      row.title = isClan ? "\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043A\u043B\u0430\u043D\u0430" : "\u041F\u0440\u043E\u0444\u0438\u043B\u044C";
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        window.open(profileBase + encodeURIComponent(passId), "_blank");
      });
    }
    return row;
  }
  const playersTitle = document.createElement("div");
  playersTitle.className = "section-title";
  playersTitle.innerText = "Top players";
  container.appendChild(playersTitle);
  if (!players.length) {
    const empty = document.createElement("div");
    empty.className = "rating-row";
    empty.innerHTML = `<div></div><div>\u2014</div><div class="rating-pts">0 \u043E\u0447\u043A\u043E\u0432</div><div class="avatar" style="background-image:url('https://api.agar.su/skins/4.png');"></div>`;
    container.appendChild(empty);
  } else {
    players.forEach((p, i) => container.appendChild(createRow(p.nick, p.points, i, p.id, false)));
  }
  const clansTitle = document.createElement("div");
  clansTitle.className = "section-title";
  clansTitle.innerText = "Top Clans";
  container.appendChild(clansTitle);
  if (!clans.length) {
    const empty = document.createElement("div");
    empty.className = "rating-row";
    empty.innerHTML = `<div></div><div>\u2014</div><div class="rating-pts">0 \u043E\u0447\u043A\u043E\u0432</div><div class="avatar" style="background-image:url('https://api.agar.su/skins/4.png');"></div>`;
    container.appendChild(empty);
  } else {
    clans.forEach((c, i) => container.appendChild(createRow(c.clan, c.points, i, c.id, true)));
  }
}
function installGlobalRatingHome(S) {
  let lastGlobalRatingKey = "";
  function bindRatingHeader() {
    const ratingHome = document.querySelector(".rating-home");
    const ratingHeader = ratingHome?.querySelector(".rating-header");
    if (!ratingHeader || ratingHeader.dataset.bound === "1") return;
    ratingHeader.dataset.bound = "1";
    ratingHeader.addEventListener("click", () => window.open(STATS_PAGE_URL, "_blank"));
  }
  function loadGlobalRatingHome(force = false) {
    fetch(STATS_API + "/api/rankings?limit=3", { cache: "no-store" }).then((res) => res.ok ? res.json() : Promise.reject()).then((data) => {
      const key = JSON.stringify({ p: data.players, c: data.clans, u: data.updatedAt });
      const container = document.getElementById("topswindow");
      const needsPaint = force || !container || !container.querySelector(".rating-row");
      if (!needsPaint && key === lastGlobalRatingKey) return;
      lastGlobalRatingKey = key;
      return refreshGlobalRatingHome(S, data);
    }).catch((e) => console.error("Global rating load error:", e));
  }
  function onOverlaysShown() {
    bindRatingHeader();
    loadGlobalRatingHome(true);
  }
  bindRatingHeader();
  if (isOverlaysVisible()) {
    loadGlobalRatingHome(true);
  }
  addOverlaysLifecycleHooks({
    onShow: onOverlaysShown
  });
  setInterval(() => {
    if (isOverlaysVisible()) loadGlobalRatingHome();
  }, 3e5);
}
function setActiveFromHash(S) {
  const hash = location.hash.replace("#", "") || "ffa";
  const hashWithoutParams = hash.split("?")[0];
  document.querySelectorAll(".gamemode li").forEach((li) => li.classList.remove("active"));
  const activeLi = document.getElementById(hashWithoutParams);
  const titleEl = document.getElementById("serverTitle");
  if (activeLi) {
    activeLi.classList.add("active");
    if (titleEl) titleEl.textContent = `\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 ${hashWithoutParams}`;
    if (!S.SELECTED_SERVER) {
      S.SELECTED_SERVER = activeLi.dataset.ip;
    }
    if (typeof S.wHandle.chekstats === "function") {
      S.wHandle.chekstats();
    }
  }
}
function attachStats(S, hooks) {
  const wHandle = S.wHandle;
  addOverlaysLifecycleHooks({
    onShow: startOnlineCountPolling,
    onHide: stopOnlineCountPolling
  });
  window.addEventListener("load", () => setActiveFromHash(S));
  window.addEventListener("hashchange", () => setActiveFromHash(S));
  if (isOverlaysVisible()) {
    startOnlineCountPolling();
  }
  wHandle.chekstats = async function() {
    try {
      const { obj } = await loadSkinListMap();
      applySkinListToState(S, { obj });
      const statsUrl = getGameServerApiBase(S.CONNECTION_URL) + "/checkStats";
      const response = await fetch(statsUrl, { method: "GET" });
      if (!response.ok) {
        throw new Error(`\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u0430: ${response.status}`);
      }
      const stat = await response.json();
      loadTopPlayerData(S, stat, hooks);
      invalidateStatsRenderCaches(S);
      await fetchStats(S, stat);
    } catch (error) {
      console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445 \u043E \u0442\u043E\u043F-1 \u0438\u0433\u0440\u043E\u043A\u0435:", error);
    }
  };
  wHandle.startGame = function() {
    const nickEl = document.getElementById("nick");
    const passEl = document.getElementById("pass");
    let nickInput = "";
    let passInput = "";
    if (nickEl) {
      nickInput = nickEl.value.trim();
      passInput = passEl ? passEl.value : "";
    } else {
      nickInput = (getCookie("userNick") || "").trim();
      passInput = getCookie("userPass") || "";
      if (!nickInput && S.userNickName) {
        const parts = String(S.userNickName).split("#");
        nickInput = (parts[0] || "").trim();
        passInput = parts[1] || "";
      }
    }
    const forbiddenRegex = new RegExp(FORBIDDEN_NICK_CHARS.join("|"), "g");
    nickInput = nickInput.replace(forbiddenRegex, "");
    nickInput = hooks.censorMessage(nickInput);
    if (nickInput.length > 16) nickInput = nickInput.substring(0, 16);
    if (passInput.length > 8) passInput = passInput.substring(0, 8);
    hooks.setNick(nickInput + "#" + passInput);
  };
  wHandle.coord = function() {
    if (S.canSendCoord) {
      if (S.lastCell) hooks.sendChat(S.lastCell);
      S.canSendCoord = false;
      setTimeout(function() {
        S.canSendCoord = true;
      }, 3e3);
    }
  };
  onReady(() => installGlobalRatingHome(S));
  window.addEventListener("load", () => {
    updateShareText(S);
    ["vk", "telegram", "whatsapp", "facebook", "twitter"].forEach((p) => {
      const btn = document.querySelector(`.${p}`);
      if (btn) btn.addEventListener("click", () => shareStats(S, p));
    });
  });
  return {
    getLevel,
    getXp,
    getStarClass,
    createLevelIcon: (level, nick) => createLevelIcon(S, level, nick, hooks),
    updateStats: () => updateStats(S),
    updateShareText: () => updateShareText(S),
    fetchStats: (stats) => fetchStats(S, stats, hooks),
    displayStats: (stats) => displayStats(S, stats),
    calcUserScore: () => calcUserScore(S)
  };
}
export {
  FORBIDDEN_NICK_CHARS,
  STATS_API,
  STATS_CLAN_PROFILE_BASE,
  STATS_PAGE_URL,
  STATS_PROFILE_BASE,
  attachStats,
  calcUserScore,
  createLevelIcon,
  fetchStats,
  getLevel,
  getPlayerSkinId,
  getStarClass,
  getXp,
  installGlobalRatingHome,
  loadTopPlayerData,
  pointsLabel,
  refreshGlobalRatingHome,
  setActiveFromHash,
  shareStats,
  updateOnlineCount,
  updateShareText,
  updateStats
};