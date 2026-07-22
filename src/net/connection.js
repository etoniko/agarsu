import { getGameServerApiBase, getGameServerWssUrl } from "../config/servers.js";
import { fetchConnectToken as fetchConnectTokenFromApi } from "./challenge.js";
import { openGameSocket, safeCloseSocket } from "./wsClient.js";
import { prepareData, encodeHandshake, encodePing, ClientOpcode } from "../protocol/opcodes.js";
import { getAccountToken } from "../storage/local.js";
import {
  showConnectVerifyOverlay,
  hideConnectVerifyOverlay,
  setConnectVerifyText,
  updateConnectTransferStream,
  showReconnectPanel,
  hideReconnectPanel,
  hideBanBanner
} from "../ui/overlays.js";
function createConnection(S, hooks = {}) {
  function isSpectMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    return urlParams.has("spect") || hash.includes("?spect");
  }
  function clearSpectReconnectTimer() {
    if (S.spectReconnectTimer) {
      clearInterval(S.spectReconnectTimer);
      S.spectReconnectTimer = null;
    }
  }
  function scheduleSpectReconnect() {
    clearSpectReconnectTimer();
    if (!isSpectMode() || !S.ma) return;
    hideReconnectPanel();
    showConnectVerifyOverlay("\u041F\u0435\u0440\u0435\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A \u0441\u0435\u0440\u0432\u0435\u0440\u0443\u2026");
    const tryReconnect = () => {
      if (!S.ma || !isSpectMode()) {
        clearSpectReconnectTimer();
        return;
      }
      if (isWsConnected() || S.connectInProgress || S.ws && S.ws.readyState === WebSocket.CONNECTING) {
        return;
      }
      showConnecting();
    };
    tryReconnect();
    S.spectReconnectTimer = setInterval(tryReconnect, S.SPECT_RECONNECT_INTERVAL_MS);
  }
  function isWsConnected() {
    return !!(S.ws && S.ws.readyState === WebSocket.OPEN);
  }
  function clearHiddenTabDisconnectTimer() {
    if (S.hiddenTabDisconnectTimer) {
      clearTimeout(S.hiddenTabDisconnectTimer);
      S.hiddenTabDisconnectTimer = null;
    }
  }
  function scheduleHiddenTabDisconnect() {
    clearHiddenTabDisconnectTimer();
    if (!document.hidden) return;
    S.hiddenTabDisconnectTimer = setTimeout(() => {
      S.hiddenTabDisconnectTimer = null;
      if (!document.hidden || !isWsConnected()) return;
      S.wsClosedByHiddenTab = true;
      try {
        S.ws.close();
      } catch {
      }
    }, S.HIDDEN_TAB_DISCONNECT_MS);
  }
  function reconnectToServer() {
    hideBanBanner();
    hideReconnectPanel();
    showConnecting();
  }
  async function fetchConnectToken(gameHost) {
    const apiBase = getGameServerApiBase(gameHost);
    return fetchConnectTokenFromApi(apiBase, {
      setText: setConnectVerifyText,
      onProgress: updateConnectTransferStream
    });
  }
  function showConnecting() {
    const wsUrl = getGameServerWssUrl(S.CONNECTION_URL);
    if (S.ws && S.ws.readyState === WebSocket.OPEN && S.currentWebSocketUrl === wsUrl) {
      return;
    }
    if (S.ma) {
      S.connectAttemptId++;
      S.currentWebSocketUrl = wsUrl;
      wsConnect(wsUrl);
    }
  }
  async function wsConnect(wsUrlArg) {
    const attemptId = S.connectAttemptId;
    S.connectInProgress = true;
    hideBanBanner();
    hideReconnectPanel();
    showConnectVerifyOverlay("\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A \u0441\u0435\u0440\u0432\u0435\u0440\u0443\u2026");
    if (S.ws) {
      safeCloseSocket(S.ws);
      S.ws = null;
    }
    const host = S.CONNECTION_URL;
    S.wsUrl = wsUrlArg || getGameServerWssUrl(host);
    hooks.clearWorld?.();
    try {
      let connectToken = null;
      try {
        connectToken = await fetchConnectToken(host);
      } catch (err) {
        if (attemptId !== S.connectAttemptId) return;
        console.error("Connect token error:", err);
        if (isSpectMode()) {
          scheduleSpectReconnect();
        } else {
          showReconnectPanel("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F. \u041D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C.");
        }
        return;
      }
      if (attemptId !== S.connectAttemptId) return;
      if (connectToken === null) {
        hideConnectVerifyOverlay();
      }
      S.ws = openGameSocket(S.wsUrl, {
        accountToken: getAccountToken() || null,
        connectToken: connectToken || null
      });
      S.ws.onopen = onWsOpen;
      S.ws.onmessage = (msg) => {
        hooks.onMessage?.(new DataView(msg.data));
      };
      S.ws.onclose = onWsClose;
    } catch (err) {
      if (attemptId !== S.connectAttemptId) return;
      console.error("WebSocket connect error:", err);
      if (isSpectMode()) {
        scheduleSpectReconnect();
      } else {
        showReconnectPanel("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F. \u041D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C.");
      }
    } finally {
      if (attemptId === S.connectAttemptId) {
        S.connectInProgress = false;
      }
    }
  }
  function wsSend(dataViewOrTyped) {
    if (!S.ws) return;
    const buf = dataViewOrTyped.buffer ?? dataViewOrTyped;
    S.ws.send(buf);
  }
  function onWsOpen() {
    setConnectVerifyText("\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C\u2026");
    S.gameHandshakeDone = false;
    hooks.sendAccountToken?.();
    const [proto, key] = encodeHandshake();
    wsSend(proto);
    wsSend(key);
  }
  function onGameHandshakeReady() {
    if (S.gameHandshakeDone) return;
    S.gameHandshakeDone = true;
    clearSpectReconnectTimer();
    hideConnectVerifyOverlay();
    hideReconnectPanel();
    hooks.sendNickName?.();
    if (isSpectMode() && S.userNickName == null) {
      const spect = prepareData(1);
      spect.setUint8(0, ClientOpcode.SPECTATE);
      wsSend(spect);
    }
    if (S.wsPingInterval) clearInterval(S.wsPingInterval);
    S.wsPingInterval = setInterval(() => {
      S.pingstamp = Date.now();
      wsSend(encodePing());
    }, 3e3);
    hooks.sendChat?.("\u0432o\u0448\u0451\u043B \u0432 \u0438\u0433\u0440\u0443!");
  }
  function onWsClose() {
    S.gameHandshakeDone = false;
    if (S.wsPingInterval) {
      clearInterval(S.wsPingInterval);
      S.wsPingInterval = null;
    }
    if (S.connectInProgress) return;
    if (!S.ma) return;
    if (isSpectMode()) {
      S.wsClosedByHiddenTab = false;
      scheduleSpectReconnect();
      return;
    }
    const msg = S.wsClosedByHiddenTab ? "\u0412\u043A\u043B\u0430\u0434\u043A\u0430 \u0431\u044B\u043B\u0430 \u043D\u0435\u0430\u043A\u0442\u0438\u0432\u043D\u0430 \u0431\u043E\u043B\u0435\u0435 60 \u0441\u0435\u043A\u0443\u043D\u0434. \u041D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u0435\u0440\u0435\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F." : "\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C \u043F\u043E\u0442\u0435\u0440\u044F\u043D\u043E. \u041D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u0435\u0440\u0435\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F.";
    S.wsClosedByHiddenTab = false;
    showReconnectPanel(msg);
  }
  function bindVisibilityHandlers() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        scheduleHiddenTabDisconnect();
      } else {
        clearHiddenTabDisconnectTimer();
      }
    });
  }
  return {
    isSpectMode,
    clearSpectReconnectTimer,
    scheduleSpectReconnect,
    isWsConnected,
    clearHiddenTabDisconnectTimer,
    scheduleHiddenTabDisconnect,
    reconnectToServer,
    fetchConnectToken,
    showConnecting,
    wsConnect,
    wsSend,
    onWsOpen,
    onGameHandshakeReady,
    onWsClose,
    bindVisibilityHandlers
  };
}
function attachConnection(S, hooks = {}) {
  const api = createConnection(S, hooks);
  Object.assign(S.api, api);
  return api;
}
export {
  attachConnection,
  createConnection
};