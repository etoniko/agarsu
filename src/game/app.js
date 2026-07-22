import { Vector2 } from "../lib/vector.js";
import { SERVERS, getGameServerWssUrl } from "../config/servers.js";
import { KEYBIND_DEFAULTS } from "../config/defaults.js";
import { prepareData } from "../protocol/opcodes.js";
import { normalizeNick } from "../lib/nick.js";
import {
  preloadStaticLists,
  applySkinListToState,
  applyStickerListToState,
  invalidateStatsRenderCaches,
  TTL_MS
} from "../storage/staticLists.js";
import {
  getSkinImage,
  loadCachedImage,
  getSkinImageUrl,
  setImgSrc
} from "../render/skins.js";
import { setPingDisplay } from "../render/hud.js";
import { attachScene, loadTopPlayerData as sceneLoadTopPlayer } from "../render/scene.js";
import { attachLeaderboard } from "../render/leaderboard.js";
import { updateStats as hudUpdateStats, updateShareText, initShareHandlers } from "../render/hud.js";
import { attachConnection } from "../net/connection.js";
import { attachOutbound } from "../protocol/outbound.js";
import { attachHandlers } from "../protocol/handlers.js";
import { createGameState, resetWorldContainers } from "./state.js";
import { Cell, bindCellDeps, ensureNameSets } from "./Cell.js";
import { Quad } from "./quadtree.js";
import { updateNodes, fixDead, clearWorld } from "./world.js";
import { attachInput, CELL_COLORS, loadKeybinds, bindHomeColorPicker } from "./input.js";
import {
  attachStats,
  getLevel,
  getStarClass,
  createLevelIcon,
  updateOnlineCount,
  setActiveFromHash,
  STATS_PROFILE_BASE,
  STATS_CLAN_PROFILE_BASE
} from "./stats.js";
import { attachAccountHooks } from "./accountHooks.js";
import { fetchNickPerksLists } from "./shopPerks.js";
import { attachChat, resolveClanPassIdFromName, resolvePlayerPassIdFromName } from "../ui/chat.js";
import { attachSettings } from "../ui/settings.js";
import { hideOverlays as hideLobbyOverlays, hideStatics, onReady, showStatics } from "../lib/dom.js";
import { hideReconnectPanel } from "../ui/overlays.js";

function bindGamemodeList(S) {
  document.querySelectorAll(".gamemode li").forEach((li) => {
    if (li.dataset.wired === "1") return;
    li.dataset.wired = "1";
    li.addEventListener("click", () => {
      document.querySelectorAll(".gamemode li").forEach((l) => l.classList.remove("active"));
      li.classList.add("active");
      S.SELECTED_SERVER = li.dataset.ip;
      history.replaceState(null, "", "#" + li.id);
      const titleEl = document.getElementById("serverTitle");
      if (titleEl) titleEl.textContent = `\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 ${li.id}`;
    });
  });
  setActiveFromHash(S);
}
function initServers(S) {
  let serverKey = "ffa";
  const hash = S.wHandle.location.hash.slice(1);
  const hashWithoutParams = hash.split("?")[0];
  const urlParams = new URLSearchParams(window.location.search);
  if (hash && SERVERS[hashWithoutParams]) {
    serverKey = hashWithoutParams;
  } else {
    const keys = Object.keys(SERVERS);
    if (keys.length) serverKey = keys[0];
  }
  S.CONNECTION_URL = SERVERS[serverKey];
  S.SELECTED_SERVER = S.CONNECTION_URL;
  document.querySelectorAll(".gamemode li").forEach((li) => li.classList.remove("active"));
  const activeLi = document.getElementById(serverKey);
  if (activeLi) activeLi.classList.add("active");
  if (urlParams.has("spect") || hash.includes("?spect")) {
    window._autoSpectate = true;
  }
  if (typeof S.wHandle.chekstats === "function") {
    S.wHandle.chekstats();
  }
}
function hideGameOverlays() {
  hideLobbyOverlays();
}
function initGame(wHandle) {
  const S = createGameState();
  S.wHandle = wHandle;
  S.keyBinds = loadKeybinds(KEYBIND_DEFAULTS);
  S.cellColors = CELL_COLORS;
  S.touchable = "createTouch" in window || navigator.maxTouchPoints > 0;
  S.leftTouchPos = new Vector2(0, 0);
  S.leftTouchStartPos = new Vector2(0, 0);
  S.leftVector = new Vector2(0, 0);
  S.joystickRadius = 360;
  S.cursorSize = 20;
  S.canSendCoord = true;
  S.splitIcon = new Image();
  S.ejectIcon = new Image();
  S.splitIcon.src = "/photo/split.png";
  S.ejectIcon.src = "/photo/eject.png";
  S.isTouchStart = "ontouchstart" in wHandle && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  S.Quad = Quad;
  S.nodesSortDirty = true;
  bindCellDeps({
    S,
    getSkinImage,
    loadCachedImage,
    normalizeNick
  });
  const listsPromise = preloadStaticLists().then(({ skin, sticker, pass, invisible, rotation, words }) => {
    applySkinListToState(S, skin);
    applyStickerListToState(S, sticker);
    S.passUsers = pass.passUsers;
    S.passPlayerNickToId = pass.passPlayerNickToId;
    S.passClanNickToId = pass.passClanNickToId;
    S.invisible = invisible;
    S.rotation = rotation;
    S.badWordsSet = words;
    ensureNameSets(S);
    invalidateStatsRenderCaches(S);
    return { skin, sticker, pass, invisible, rotation, words };
  }).catch(() => {
    ensureNameSets(S);
    return null;
  });
  const outbound = attachOutbound(S);
  const chatApi = attachChat(S, {
    sendChat: (t) => outbound.sendChat(t),
    setserver: (arg) => wHandle.setserver(arg),
    getSkinImageUrl,
    createLevelIcon: (level, nick) => createLevelIcon(S, level, nick, { getSkinImageUrl, setImgSrc }),
    getStarClass
  });
  const lbApi = attachLeaderboard(S, {
    getLevel,
    createLevelIcon: (level, nick) => createLevelIcon(S, level, nick, { getSkinImageUrl, setImgSrc }),
    getStarClass,
    resolveClanPassIdFromName: (name) => resolveClanPassIdFromName(S, name),
    resolvePlayerPassIdFromName: (name) => resolvePlayerPassIdFromName(S, name),
    STATS_PROFILE_BASE,
    STATS_CLAN_PROFILE_BASE
  });
  const sceneApi = attachScene(S, {
    sendMouseMove: () => outbound.sendMouseMove()
  });
  const statsApi = attachStats(S, {
    censorMessage: (msg) => chatApi.censorMessage(msg),
    setNick: (nick) => wHandle.setNick(nick),
    sendChat: (t) => outbound.sendChat(t),
    getSkinImageUrl,
    setImgSrc,
    onTopPlayer: (top) => sceneLoadTopPlayer([top])
  });
  const connectionHooks = {
    onMessage: null,
    sendNickName: () => outbound.sendNickName(),
    sendChat: (t) => outbound.sendChat(t),
    sendAccountToken: () => outbound.sendAccountToken(),
    clearWorld: () => {
      resetWorldContainers(S);
      clearWorld(S);
    }
  };
  const connection = attachConnection(S, connectionHooks);
  const handlers = attachHandlers(S, {
    updateNodes: (reader) => updateNodes(S, reader, {
      Cell,
      onPlayerDeath: () => {
        showStatics();
        updateShareText(S);
        if (typeof window.renderDeathBanner === "function") window.renderDeathBanner();
      }
    }),
    addChat: (view, offset) => chatApi.addChat(view, offset),
    drawLeaderBoard: () => lbApi.drawLeaderBoard(),
    drawCustomLeaderBoard: () => lbApi.drawCustomLeaderBoard(),
    onUpdateXp: (xp) => {
      if (typeof wHandle.onUpdateXp === "function") wHandle.onUpdateXp(xp);
    },
    onGameHandshakeReady: () => connection.onGameHandshakeReady(),
    getLevel,
    setPingDisplay
  });
  connectionHooks.onMessage = (dv) => handlers.handleWsMessage(dv);
  attachSettings(S, {
    fixDead: () => fixDead(S)
  });
  wHandle.setserver = function(arg) {
    if (!SERVERS || Object.keys(SERVERS).length === 0) {
      console.warn("\u0421\u0435\u0440\u0432\u0435\u0440\u044B \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u044B. \u041F\u043E\u0434\u043E\u0436\u0434\u0438\u0442\u0435...");
      return;
    }
    const wsUrl = getGameServerWssUrl(arg);
    const alreadyConnected = S.ws && S.ws.readyState === WebSocket.OPEN && S.currentWebSocketUrl === wsUrl;
    if (arg !== S.CONNECTION_URL) {
      S.CONNECTION_URL = arg;
      const foundHash = Object.keys(SERVERS).find((key) => SERVERS[key] === arg);
      if (foundHash) {
        history.replaceState(null, "", `#${foundHash}`);
        setActiveFromHash(S);
      } else {
        console.warn("\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0441\u0435\u0440\u0432\u0435\u0440 URL:", arg);
        history.replaceState(null, "", " ");
      }
    }
    if (!alreadyConnected) {
      connection.showConnecting();
      updateOnlineCount();
    }
  };
  wHandle.setNick = function(arg) {
    wHandle.setserver(S.SELECTED_SERVER);
    hideGameOverlays();
    S.userNickName = arg;
    outbound.sendNickName();
    hideStatics();
    S.maxScore = 0;
  };
  wHandle.spectate = function() {
    wHandle.setserver(S.SELECTED_SERVER);
    S.userNickName = null;
    hideGameOverlays();
    hideStatics();
    if (typeof wHandle.chekstats === "function") wHandle.chekstats();
  };
  wHandle.connect = connection.wsConnect;
  window.__agarsuOnHomeMounted = () => {
    bindGamemodeList(S);
    bindHomeColorPicker(S);
    setActiveFromHash(S);
    updateOnlineCount();
    if (S.accountData && typeof window.__agarsuRefreshHomeAccount === "function") {
      window.__agarsuRefreshHomeAccount();
    }
  };
  onReady(() => {
    bindGamemodeList(S);
  });
  listsPromise.then(() => fetchNickPerksLists(S)).catch(() => {
  });
  listsPromise.then(() => initServers(S)).catch(() => initServers(S));
  setInterval(async () => {
    const data = await preloadStaticLists(true);
    applySkinListToState(S, data.skin);
    applyStickerListToState(S, data.sticker);
    S.passUsers = data.pass.passUsers;
    S.passPlayerNickToId = data.pass.passPlayerNickToId;
    S.passClanNickToId = data.pass.passClanNickToId;
    S.invisible = data.invisible;
    S.rotation = data.rotation;
    S.badWordsSet = data.words;
    invalidateStatsRenderCaches(S);
    if (typeof wHandle.chekstats === "function") wHandle.chekstats();
  }, TTL_MS);
  wHandle.addEventListener("hashchange", () => initServers(S));
  attachAccountHooks(S, {
    sendAccountToken: () => outbound.sendAccountToken(),
    setNick: (n) => wHandle.setNick(n),
    selectSkin: null
  });
  initShareHandlers(S);
  window.__agarsuOnStaticsMounted = () => initShareHandlers(S);
  connection.bindVisibilityHandlers();
  hideReconnectPanel();
  function startGameLoop() {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = wHandle.location.hash;
    if (urlParams.has("spect") || hash.includes("?spect")) {
      S.zoom = 0.5;
    }
    if (window._autoSpectate && typeof wHandle.spectate === "function") {
      delete window._autoSpectate;
      setTimeout(() => wHandle.spectate(), 100);
    }
    attachInput(S, {
      sendUint8: (a) => outbound.sendUint8(a),
      sendMouseMove: () => outbound.sendMouseMove(),
      sendChat: (t) => outbound.sendChat(t),
      fixDead: () => fixDead(S),
      coord: () => wHandle.coord(),
      redrawGameScene: sceneApi.redrawGameScene,
      updateStats: () => {
        hudUpdateStats(S);
        statsApi.updateStats();
      },
      reconnectToServer: () => connection.reconnectToServer(),
      prepareData,
      wsSend: (v) => connection.wsSend(v),
      wsIsOpen: () => outbound.wsIsOpen(),
      showConnecting: () => connection.showConnecting()
    });
  }
  wHandle.onload = startGameLoop;
  if (document.readyState === "complete") {
    startGameLoop();
  }
  wHandle.__gameState = S;
  wHandle.__gameApi = S.api;
  return S;
}
var stdin_default = initGame;
export {
  stdin_default as default,
  initGame
};