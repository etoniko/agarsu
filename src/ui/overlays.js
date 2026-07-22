import connectVerifyHtml from "./panels/connectVerify.html?raw";

let reconnectHandler = null;

function setConnectVerifyReconnectHandler(fn) {
  reconnectHandler = typeof fn === "function" ? fn : null;
}

function bindReconnectBtn() {
  const btn = document.getElementById("connect-verify-reconnect-btn");
  if (!btn || btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => {
    if (typeof reconnectHandler === "function") reconnectHandler();
  });
}

function ensureConnectVerifyOverlay() {
  let overlay = document.getElementById("connect-verify-overlay");
  if (overlay) {
    bindReconnectBtn();
    return overlay;
  }
  const stage = document.getElementById("canvas-stage");
  if (!stage) return null;
  const wrap = document.createElement("div");
  wrap.innerHTML = connectVerifyHtml.trim();
  overlay = wrap.firstElementChild;
  if (!overlay) return null;
  stage.appendChild(overlay);
  bindReconnectBtn();
  return overlay;
}

function removeConnectVerifyOverlay() {
  document.getElementById("connect-verify-overlay")?.remove();
}

function showConnectVerifyOverlay(text) {
  const overlay = ensureConnectVerifyOverlay();
  hideReconnectPanel();
  setConnectVerifyTransferVisible(true);
  if (overlay) overlay.style.display = "flex";
  setConnectVerifyText(text);
}

function hideConnectVerifyOverlay() {
  hideReconnectPanel();
  resetConnectVerifyStream();
  setConnectVerifyTransferVisible(true);
  removeConnectVerifyOverlay();
}

function setConnectVerifyText(text) {
  const el = document.getElementById("connect-verify-text");
  if (el && text != null) el.textContent = text;
}

function setConnectVerifyTransferVisible(show) {
  const el = document.getElementById("connect-verify-transfer");
  if (el) el.style.display = show ? "" : "none";
}

function resetConnectVerifyStream() {
  const stream = document.getElementById("connect-verify-data-stream");
  if (stream) stream.textContent = 'sha256("\u2026") \u2192 \u2026';
}

function updateConnectTransferStream(inputPreview, hashHex) {
  const stream = document.getElementById("connect-verify-data-stream");
  if (!stream) return;
  const raw = String(inputPreview);
  const tail = raw.length > 18 ? "\u2026" + raw.slice(-14) : raw;
  const h = String(hashHex || "");
  stream.textContent = 'sha256("' + tail + '") \u2192 ' + h.slice(0, 12) + "\u2026";
}

function hideReconnectPanel() {
  const box = document.getElementById("connect-verify-reconnect");
  if (box) box.hidden = true;
}

function showReconnectPanel(message) {
  const overlay = ensureConnectVerifyOverlay();
  setConnectVerifyTransferVisible(false);
  if (overlay) overlay.style.display = "flex";
  setConnectVerifyText(message || "\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C \u043F\u043E\u0442\u0435\u0440\u044F\u043D\u043E.");
  const box = document.getElementById("connect-verify-reconnect");
  if (box) box.hidden = false;
}

function formatBanDuration(sec) {
  sec = Math.max(0, sec | 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor(sec % 3600 / 60);
  const s = sec % 60;
  if (h > 0) return `${h}\u0447 ${m}\u043C`;
  if (m > 0) return `${m}\u043C ${s}\u0441`;
  return `${s}\u0441`;
}

function showBanBanner(remainingSec, reason) {
  import("./hudLazy.js").then((m) => {
    m.showBanBannerHud(remainingSec, reason, formatBanDuration);
  }).catch((err) => console.error(err));
}

function hideBanBanner() {
  import("./hudLazy.js").then((m) => m.hideBanBannerHud()).catch((err) => {
    document.getElementById("ban-banner")?.remove();
  });
}

export {
  formatBanDuration,
  hideBanBanner,
  hideConnectVerifyOverlay,
  hideReconnectPanel,
  resetConnectVerifyStream,
  setConnectVerifyReconnectHandler,
  setConnectVerifyText,
  setConnectVerifyTransferVisible,
  showBanBanner,
  showConnectVerifyOverlay,
  showReconnectPanel,
  updateConnectTransferStream
};
