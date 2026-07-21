const HIDDEN_TAB_DISCONNECT_MS = 6e5;
const SPECT_RECONNECT_INTERVAL_MS = 2e3;
function createReconnectController({
  isSpectMode,
  isConnected,
  onSpectReconnect,
  onHiddenDisconnect
}) {
  let hiddenTabDisconnectTimer = null;
  let spectReconnectTimer = null;
  let wsClosedByHiddenTab = false;
  function clearHiddenTabDisconnectTimer() {
    if (hiddenTabDisconnectTimer) {
      clearTimeout(hiddenTabDisconnectTimer);
      hiddenTabDisconnectTimer = null;
    }
  }
  function clearSpectReconnectTimer() {
    if (spectReconnectTimer) {
      clearTimeout(spectReconnectTimer);
      spectReconnectTimer = null;
    }
  }
  function scheduleSpectReconnect() {
    clearSpectReconnectTimer();
    spectReconnectTimer = setTimeout(() => {
      spectReconnectTimer = null;
      onSpectReconnect?.();
    }, SPECT_RECONNECT_INTERVAL_MS);
  }
  function scheduleHiddenTabDisconnect() {
    clearHiddenTabDisconnectTimer();
    hiddenTabDisconnectTimer = setTimeout(() => {
      hiddenTabDisconnectTimer = null;
      if (!isSpectMode() && isConnected()) {
        wsClosedByHiddenTab = true;
        onHiddenDisconnect?.();
      }
    }, HIDDEN_TAB_DISCONNECT_MS);
  }
  return {
    get wsClosedByHiddenTab() {
      return wsClosedByHiddenTab;
    },
    set wsClosedByHiddenTab(v) {
      wsClosedByHiddenTab = v;
    },
    clearHiddenTabDisconnectTimer,
    clearSpectReconnectTimer,
    scheduleSpectReconnect,
    scheduleHiddenTabDisconnect
  };
}
export {
  HIDDEN_TAB_DISCONNECT_MS,
  SPECT_RECONNECT_INTERVAL_MS,
  createReconnectController
};