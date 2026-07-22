import { loadSkinListMap } from "../storage/staticLists.js";
import { normalizeNick } from "../lib/nick.js";
let lastActionTime = 0;
const actionInterval = 500;
let actionTimeout;
let currentIndex = 0;
const MANUAL_SKINS_NICKS = ["\u041B\u0435\u043D\u0438\u043D", "\u0421\u0442\u0430\u043B\u0438\u043D", "\u0413\u0430\u0433\u0430\u0440\u0438\u043D", "\u0416\u0443\u043A\u043E\u0432", "\u0425\u0440\u0443\u0449\u0451\u0432", "C\u0421\u0421\u0420", "\u041F\u0443\u0442\u0438\u043D", "\u0420\u043E\u0441\u0441\u0438\u044F"];
const SKINS_PER_PAGE_MOBILE = 8;
const SKINS_PER_PAGE_DESKTOP = 14;
const PLAYERS_KEY = "players";
const MAX_PLAYERS = 3;
let skinsGalleryItems = [];
let skinsGalleryPage = 1;
let skinsGalleryPerPage = SKINS_PER_PAGE_DESKTOP;
let skinsGalleryLoading = false;
let skinsGalleryLoaded = false;
let skinsGalleryResizeBound = false;
let cachedSkinsMap = null;
let cachedSkinsMapAt = 0;
const SKINS_MAP_TTL = 6e4;
let avatarCtxMenu = null;
function getSkinPreviewUrl(skinId) {
  return skinId ? `https://api.agar.su/skins/${skinId}.png` : "";
}
function setBackgroundImageIfChanged(el, skinId) {
  if (!el) return;
  const url = getSkinPreviewUrl(skinId);
  const next = url ? `url(${url})` : "";
  if (el.dataset.bgSrc === next) return;
  el.dataset.bgSrc = next;
  el.style.backgroundImage = next;
}
function getPlayers() {
  try {
    const players = JSON.parse(localStorage.getItem(PLAYERS_KEY) || "[]");
    return Array.isArray(players) ? players : [];
  } catch {
    return [];
  }
}
function setPlayers(players) {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
}
function getPassInputValue() {
  const passInput = document.getElementById("pass");
  return passInput ? String(passInput.value || "").trim() : "";
}
function setFormNickPass(nick, pass) {
  const nickInput = document.getElementById("nick");
  const passInput = document.getElementById("pass");
  if (nickInput && nick != null) nickInput.value = nick;
  if (passInput) {
    passInput.value = pass || "";
    if (typeof window.__agarsuCheckNickStatus === "function") {
      window.__agarsuCheckNickStatus(nick || "");
    }
  }
  if (typeof window.__agarsuSyncNickPassCookies === "function") {
    window.__agarsuSyncNickPassCookies(nick || "", pass || "");
  }
}
function getSkinsGalleryPerPage() {
  return window.matchMedia("(max-width: 599px)").matches ? SKINS_PER_PAGE_MOBILE : SKINS_PER_PAGE_DESKTOP;
}
function bindSkinsGalleryResize() {
  if (skinsGalleryResizeBound) return;
  skinsGalleryResizeBound = true;
  let lastPerPage = getSkinsGalleryPerPage();
  window.addEventListener("resize", () => {
    const next = getSkinsGalleryPerPage();
    if (next === lastPerPage || !skinsGalleryLoaded) return;
    lastPerPage = next;
    skinsGalleryPerPage = next;
    const totalPages = Math.max(1, Math.ceil(skinsGalleryItems.length / skinsGalleryPerPage));
    if (skinsGalleryPage > totalPages) skinsGalleryPage = totalPages;
    renderSkinsGalleryPage(skinsGalleryPage);
  });
}
async function loadSkinsGalleryData() {
  const { map: skinMap } = await loadSkinListMap();
  const items = [];
  for (const nick of MANUAL_SKINS_NICKS) {
    const code = skinMap.get(nick.toLowerCase());
    if (code) {
      items.push({ nick, code });
    }
  }
  skinsGalleryItems = items;
  skinsGalleryLoaded = true;
}
function setSkinsGalleryStatus(text, isError) {
  const el = document.getElementById("skinsGalleryStatus");
  if (!el) return;
  const textEl = el.querySelector(".skins-gallery-status-text");
  if (textEl) textEl.textContent = text || "";
  else el.textContent = text || "";
  el.classList.toggle("is-error", !!isError);
  const createBtn = el.querySelector(".skins-gallery-shop-btn");
  if (createBtn) createBtn.hidden = !!isError;
}
function mountSkinsGalleryPanel() {
  const panel = document.getElementById("skinslist");
  if (!panel) return null;
  if (!panel.querySelector("#skinsGalleryGrid")) {
    panel.innerHTML = `
          <div class="skins-gallery-wrap">
            <div class="skins-gallery-header">
              <span class="skins-gallery-title">\u0413\u0430\u043B\u0435\u0440\u0435\u044F \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0445 \u0441\u043A\u0438\u043D\u043E\u0432</span>
            </div>
            <div id="skinsGalleryGrid" class="skins-gallery-grid"></div>
            <div id="skinsGalleryPagination" class="skins-gallery-pagination"></div>
            <p id="skinsGalleryStatus" class="skins-gallery-status">
              <span class="skins-gallery-status-text"></span>
              <button type="button" class="skins-gallery-shop-btn" onclick="showContent('shop')">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0441\u043A\u0438\u043D</button>
            </p>
          </div>`;
  } else {
    panel.querySelector(".skins-gallery-header .skins-gallery-shop-btn")?.remove();
    const status = panel.querySelector("#skinsGalleryStatus");
    if (status && !status.querySelector(".skins-gallery-shop-btn")) {
      status.innerHTML = `
              <span class="skins-gallery-status-text"></span>
              <button type="button" class="skins-gallery-shop-btn" onclick="showContent('shop')">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0441\u043A\u0438\u043D</button>`;
    }
  }
  panel.dataset.mounted = "1";
  return panel;
}
function renderSkinsGalleryPagination(totalPages, pagination) {
  pagination.innerHTML = "";
  if (totalPages <= 1) return;
  const addBtn = (label, p, extraClass) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = extraClass || "page-num";
    if (p === skinsGalleryPage) btn.classList.add("active");
    if (p != null) {
      btn.addEventListener("click", () => renderSkinsGalleryPage(p));
    } else {
      btn.disabled = true;
    }
    pagination.appendChild(btn);
  };
  if (skinsGalleryPage > 1) {
    addBtn("\u2039", skinsGalleryPage - 1, "page-nav");
  }
  const windowSize = 5;
  let start = Math.max(1, skinsGalleryPage - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  for (let i = start; i <= end; i++) {
    addBtn(String(i), i, "page-num");
  }
  if (skinsGalleryPage < totalPages) {
    addBtn("\u203A", skinsGalleryPage + 1, "page-nav");
  }
}
function renderSkinsGalleryPage(page) {
  const grid = document.getElementById("skinsGalleryGrid");
  const pagination = document.getElementById("skinsGalleryPagination");
  if (!grid || !pagination) return;
  skinsGalleryPerPage = getSkinsGalleryPerPage();
  bindSkinsGalleryResize();
  grid.setAttribute("data-per-page", String(skinsGalleryPerPage));
  grid.innerHTML = "";
  const totalPages = Math.max(1, Math.ceil(skinsGalleryItems.length / skinsGalleryPerPage));
  skinsGalleryPage = Math.min(Math.max(1, page), totalPages);
  const start = (skinsGalleryPage - 1) * skinsGalleryPerPage;
  const pageSkins = skinsGalleryItems.slice(start, start + skinsGalleryPerPage);
  pageSkins.forEach((skin) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "skins-gallery-card";
    card.innerHTML = `
            <img src="https://api.agar.su/skins/${skin.code}.png" alt="" loading="lazy">
            <h4>${escapeHtml(skin.nick)}</h4>
        `;
    card.addEventListener("click", async () => {
      await selectSkin(skin.nick);
      showContent("home");
    });
    grid.appendChild(card);
  });
  renderSkinsGalleryPagination(totalPages, pagination);
  if (!skinsGalleryItems.length) {
    setSkinsGalleryStatus("\u041D\u0435\u0442 \u0441\u043A\u0438\u043D\u043E\u0432. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043D\u0438\u043A\u0438 \u0432 MANUAL_SKINS_NICKS", false);
  } else if (totalPages <= 1) {
    setSkinsGalleryStatus(`${skinsGalleryItems.length} \u0441\u043A\u0438\u043D\u043E\u0432`, false);
  } else {
    setSkinsGalleryStatus(
      `${skinsGalleryItems.length} \xB7 ${skinsGalleryPage} / ${totalPages}`,
      false
    );
  }
}
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
async function initSkinsGallery() {
  mountSkinsGalleryPanel();
  const grid = document.getElementById("skinsGalleryGrid");
  if (!grid || skinsGalleryLoading) return;
  if (skinsGalleryLoaded && skinsGalleryItems.length) {
    renderSkinsGalleryPage(skinsGalleryPage);
    return;
  }
  skinsGalleryLoading = true;
  setSkinsGalleryStatus("\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026");
  grid.innerHTML = "";
  try {
    await loadSkinsGalleryData();
    renderSkinsGalleryPage(1);
  } catch (e) {
    console.error("\u0413\u0430\u043B\u0435\u0440\u0435\u044F \u0441\u043A\u0438\u043D\u043E\u0432:", e);
    setSkinsGalleryStatus("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0433\u0430\u043B\u0435\u0440\u0435\u044E. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435.", true);
  } finally {
    skinsGalleryLoading = false;
  }
}
async function loadSkinsList(force) {
  const { map } = await loadSkinListMap(force);
  cachedSkinsMap = map;
  cachedSkinsMapAt = Date.now();
  return map;
}
async function selectSkin(nick) {
  const skinsMap = await loadSkinsList();
  const normalizedNick = normalizeNick(nick);
  if (skinsMap.has(normalizedNick)) {
    const id = skinsMap.get(normalizedNick);
    savePlayerData(nick, id, getPassInputValue());
    currentIndex = getCurrentPlayerIndex(nick);
    updateAvatarDisplay();
  } else {
    const skinss = document.querySelector("#skinss");
    if (skinss) setBackgroundImageIfChanged(skinss, "");
  }
}
function getCurrentPlayerIndex(nick) {
  const players = getPlayers();
  return players.findIndex((player) => normalizeNick(player.nick) === normalizeNick(nick));
}
/** Saves slot as nick + skin id + optional pass. Max 3 slots. */
function savePlayerData(nick, id, pass) {
  const players = getPlayers();
  const passValue = pass != null ? String(pass).trim() : getPassInputValue();
  const playerData = { nick, id, pass: passValue || "" };
  const index = players.findIndex((player) => normalizeNick(player.nick) === normalizeNick(nick));
  if (index !== -1) {
    const prevPass = players[index].pass || "";
    if (!playerData.pass && prevPass) playerData.pass = prevPass;
    players.splice(index, 1);
  }
  players.unshift(playerData);
  if (players.length > MAX_PLAYERS) players.pop();
  setPlayers(players);
  currentIndex = 0;
}
function updateCurrentPlayerPass(pass) {
  const players = getPlayers();
  if (!players.length || currentIndex < 0 || currentIndex >= players.length) return;
  players[currentIndex] = {
    ...players[currentIndex],
    pass: String(pass || "").trim()
  };
  setPlayers(players);
}
function updateAvatarDisplay() {
  const players = getPlayers();
  const mainSkin = document.querySelector("#skinss");
  const previousSkin = document.querySelector("#prevSkin");
  const nextSkin = document.querySelector("#nextSkin");
  if (!mainSkin) return;
  if (players.length > 0) {
    if (currentIndex < 0 || currentIndex >= players.length) currentIndex = 0;
    const currentPlayer = players[currentIndex];
    setBackgroundImageIfChanged(mainSkin, currentPlayer.id);
    setFormNickPass(currentPlayer.nick, currentPlayer.pass || "");
    const prevIndex = (currentIndex - 1 + players.length) % players.length;
    if (previousSkin && players[prevIndex] && players.length > 1) {
      setBackgroundImageIfChanged(previousSkin, players[prevIndex].id);
    } else if (previousSkin) {
      setBackgroundImageIfChanged(previousSkin, "");
    }
    const nextIndex = (currentIndex + 1) % players.length;
    if (nextSkin && players[nextIndex] && players.length > 1) {
      setBackgroundImageIfChanged(nextSkin, players[nextIndex].id);
    } else if (nextSkin) {
      setBackgroundImageIfChanged(nextSkin, "");
    }
  } else {
    setBackgroundImageIfChanged(mainSkin, "");
    setBackgroundImageIfChanged(previousSkin, "");
    setBackgroundImageIfChanged(nextSkin, "");
  }
}
function showNext() {
  const players = getPlayers();
  if (players.length > 0) {
    currentIndex = (currentIndex + 1) % players.length;
    changeSkin();
  }
}
function showPrevious() {
  const players = getPlayers();
  if (players.length > 0) {
    currentIndex = (currentIndex - 1 + players.length) % players.length;
    changeSkin();
  }
}
function changeSkin() {
  const mainSkin = document.querySelector("#skinss");
  if (!mainSkin) return;
  mainSkin.classList.add("scale-down");
  setTimeout(() => {
    updateAvatarDisplay();
    mainSkin.classList.remove("scale-down");
  }, 50);
}
function resolveSlotIndexFromTarget(target) {
  const players = getPlayers();
  if (!players.length) return -1;
  if (target.closest("#skinss")) return currentIndex;
  if (target.closest("#prevSkin") || target.closest("#previous")) {
    return players.length > 1 ? (currentIndex - 1 + players.length) % players.length : currentIndex;
  }
  if (target.closest("#nextSkin") || target.closest("#next")) {
    return players.length > 1 ? (currentIndex + 1) % players.length : currentIndex;
  }
  return currentIndex;
}
function hideAvatarContextMenu() {
  if (avatarCtxMenu) {
    avatarCtxMenu.remove();
    avatarCtxMenu = null;
  }
}
function deletePlayerAt(index) {
  const players = getPlayers();
  if (index < 0 || index >= players.length) return;
  const removed = players.splice(index, 1)[0];
  setPlayers(players);
  if (!players.length) {
    currentIndex = 0;
    setFormNickPass("", "");
    updateAvatarDisplay();
    return;
  }
  if (index < currentIndex) currentIndex -= 1;
  else if (index === currentIndex) currentIndex = Math.min(currentIndex, players.length - 1);
  updateAvatarDisplay();
  return removed;
}
function clearAllPlayers() {
  setPlayers([]);
  currentIndex = 0;
  setFormNickPass("", "");
  updateAvatarDisplay();
}
function showAvatarContextMenu(e, slotIndex) {
  hideAvatarContextMenu();
  const players = getPlayers();
  if (!players.length) return;
  const menu = document.createElement("div");
  menu.className = "avatar-context-menu";
  const slot = players[slotIndex];
  const nickLabel = slot?.nick ? ` \u00AB${slot.nick}\u00BB` : "";
  const delBtn = document.createElement("div");
  delBtn.textContent = `\u0423\u0434\u0430\u043B\u0438\u0442\u044C${nickLabel}`;
  delBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    deletePlayerAt(slotIndex);
    hideAvatarContextMenu();
  });
  const clearBtn = document.createElement("div");
  clearBtn.textContent = "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u0432\u0441\u0451";
  clearBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    clearAllPlayers();
    hideAvatarContextMenu();
  });
  menu.appendChild(delBtn);
  menu.appendChild(clearBtn);
  document.body.appendChild(menu);
  avatarCtxMenu = menu;
  const x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8);
  const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8);
  menu.style.left = `${Math.max(8, x)}px`;
  menu.style.top = `${Math.max(8, y)}px`;
}
function bindAvatarContextMenu() {
  const root = document.querySelector(".avatar-containers");
  if (!root || root.dataset.ctxBound === "1") return;
  root.dataset.ctxBound = "1";
  root.addEventListener("contextmenu", (e) => {
    if (!e.target.closest("#skinss, #prevSkin, #nextSkin, #previous, #next")) return;
    e.preventDefault();
    const slotIndex = resolveSlotIndexFromTarget(e.target);
    if (slotIndex < 0) return;
    showAvatarContextMenu(e, slotIndex);
  });
  if (!window.__agarsuAvatarDocBound) {
    window.__agarsuAvatarDocBound = true;
    document.addEventListener("click", hideAvatarContextMenu);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideAvatarContextMenu();
    });
  }
}
function bindHomeAvatarUi() {
  const nickInput = document.getElementById("nick");
  const passInput = document.getElementById("pass");
  if (nickInput && nickInput.dataset.homeWired !== "1") {
    nickInput.dataset.homeWired = "1";
    nickInput.addEventListener("input", function() {
      const nickname = this.value;
      clearTimeout(actionTimeout);
      actionTimeout = setTimeout(async () => {
        await selectSkin(nickname);
      }, actionInterval);
    });
  }
  if (passInput && passInput.dataset.homeWired !== "1") {
    passInput.dataset.homeWired = "1";
    passInput.addEventListener("input", function() {
      updateCurrentPlayerPass(this.value);
    });
  }
  bindAvatarContextMenu();
  const players = getPlayers();
  if (players.length > 0) {
    if (currentIndex < 0 || currentIndex >= players.length) currentIndex = 0;
    updateAvatarDisplay();
  }
}
function resetSkinsGalleryPanel() {
  const panel = document.getElementById("skinslist");
  if (panel) delete panel.dataset.mounted;
}
window.initSkinsGallery = initSkinsGallery;
window.showNext = showNext;
window.showPrevious = showPrevious;
window.savePlayerData = savePlayerData;
window.updateAvatarDisplay = updateAvatarDisplay;
window.__agarsuUpdatePlayerPass = updateCurrentPlayerPass;
window.__agarsuGetPlayers = getPlayers;
if (typeof loadSkinsList === "function") window.loadSkinsList = loadSkinsList;
export {
  bindHomeAvatarUi,
  initSkinsGallery,
  mountSkinsGalleryPanel,
  resetSkinsGalleryPanel,
  showNext,
  showPrevious,
  savePlayerData,
  updateAvatarDisplay,
  updateCurrentPlayerPass,
  getPlayers
};
