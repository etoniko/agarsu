function showConnectVerifyOverlay(text) {
  const overlay = document.getElementById("connect-verify-overlay");
  hideReconnectPanel();
  setConnectVerifyTransferVisible(true);
  if (overlay) overlay.style.display = "flex";
  setConnectVerifyText(text);
}
function hideConnectVerifyOverlay() {
  const overlay = document.getElementById("connect-verify-overlay");
  hideReconnectPanel();
  resetConnectVerifyStream();
  setConnectVerifyTransferVisible(true);
  if (overlay) overlay.style.display = "none";
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
  const overlay = document.getElementById("connect-verify-overlay");
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
  const banner = document.getElementById("ban-banner");
  if (!banner) return;
  const msgEl = document.getElementById("ban-banner-message");
  const text = `\u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C: ${formatBanDuration(remainingSec)}` + (reason ? `
${reason}` : "");
  if (msgEl) msgEl.textContent = text;
  banner.style.display = "block";
}
function hideBanBanner() {
  const banner = document.getElementById("ban-banner");
  if (banner) banner.style.display = "none";
}
export {
  formatBanDuration,
  hideBanBanner,
  hideConnectVerifyOverlay,
  hideReconnectPanel,
  resetConnectVerifyStream,
  setConnectVerifyText,
  setConnectVerifyTransferVisible,
  showBanBanner,
  showConnectVerifyOverlay,
  showReconnectPanel,
  updateConnectTransferStream
};