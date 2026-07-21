import { WS_SUBPROTOCOL } from "../config/endpoints.js";
function openGameSocket(wsUrl, { accountToken, connectToken } = {}) {
  const qs = new URLSearchParams();
  if (accountToken) qs.set("accountToken", accountToken);
  if (connectToken) qs.set("connectToken", connectToken);
  const ws = new WebSocket(wsUrl + "?" + qs.toString(), WS_SUBPROTOCOL);
  ws.binaryType = "arraybuffer";
  return ws;
}
function safeCloseSocket(ws) {
  if (!ws) return;
  ws.onopen = null;
  ws.onmessage = null;
  ws.onclose = null;
  try {
    ws.close();
  } catch {
  }
}
export {
  openGameSocket,
  safeCloseSocket
};