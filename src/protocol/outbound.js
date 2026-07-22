import { prepareData, ClientOpcode } from "./opcodes.js";
import { getAccountToken } from "../storage/local.js";
function createOutbound(S, hooks = {}) {
  function wsIsOpen() {
    return S.ws != null && S.ws.readyState === WebSocket.OPEN;
  }
  function wsSend(view) {
    if (!S.ws) return;
    S.ws.send(view.buffer);
  }
  function getColorId(hex) {
    const colors = S.cellColors;
    if (!colors || !hex) return 0;
    const index = colors.indexOf(hex);
    return index === -1 ? 0 : index + 1;
  }
  function sendMouseMove() {
    if (!wsIsOpen()) return;
    if (S.freeze) {
      if (!(Math.abs(S.oldX - S.posX) < 0.1 && Math.abs(S.oldY - S.posY) < 0.1)) {
        S.oldX = S.posX;
        S.oldY = S.posY;
        const msg = prepareData(21);
        msg.setUint8(0, ClientOpcode.MOUSE);
        msg.setFloat64(1, S.posX, true);
        msg.setFloat64(9, S.posY, true);
        msg.setUint32(17, 0, true);
        wsSend(msg);
      }
    } else {
      const msgX = S.rawMouseX - S.canvasWidth / 2;
      const msgY = S.rawMouseY - S.canvasHeight / 2;
      if (64 <= msgX * msgX + msgY * msgY && !(Math.abs(S.oldX - S.X) < 0.1 && Math.abs(S.oldY - S.Y) < 0.1)) {
        S.oldX = S.X;
        S.oldY = S.Y;
        const msg = prepareData(21);
        msg.setUint8(0, ClientOpcode.MOUSE);
        msg.setFloat64(1, S.X, true);
        msg.setFloat64(9, S.Y, true);
        msg.setUint32(17, 0, true);
        wsSend(msg);
      }
    }
  }
  function sendUint8(a) {
    if (!wsIsOpen()) return;
    const msg = prepareData(1);
    msg.setUint8(0, a);
    wsSend(msg);
  }
  function sendNickName() {
    if (!wsIsOpen() || S.userNickName == null) return;
    const nick = S.userNickName;
    const msg = prepareData(1 + 2 * nick.length + 1);
    msg.setUint8(0, ClientOpcode.NICK);
    msg.setUint8(1, getColorId(localStorage.getItem("selectedColor")));
    for (let i = 0; i < nick.length; ++i) {
      msg.setUint16(1 + 2 * i + 1, nick.charCodeAt(i), true);
    }
    wsSend(msg);
  }
  function sendChat(str) {
    if (!wsIsOpen() || !(str.length < 200) || !(str.length > 0) || S.hideChat) return;
    const msg = prepareData(2 + 2 * str.length);
    let offset = 0;
    msg.setUint8(offset++, ClientOpcode.CHAT);
    msg.setUint8(offset++, 0);
    for (let i = 0; i < str.length; ++i) {
      msg.setUint16(offset, str.charCodeAt(i), true);
      offset += 2;
    }
    wsSend(msg);
  }
  function sendAccountToken() {
    const token = getAccountToken();
    if (!wsIsOpen() || !token) return;
    const msg = prepareData(1 + 2 * token.length);
    msg.setUint8(0, 114);
    for (let i = 0; i < token.length; ++i) {
      msg.setUint16(1 + 2 * i, token.charCodeAt(i), true);
    }
    wsSend(msg);
  }
  function sendSticker(stickerId, action) {
    if (!wsIsOpen()) return;
    const msg = prepareData(6);
    msg.setUint8(0, ClientOpcode.STICKER);
    msg.setUint8(1, stickerId);
    msg.setUint8(2, action ? 1 : 0);
    wsSend(msg);
  }
  return {
    wsIsOpen,
    sendMouseMove,
    sendUint8,
    sendNickName,
    sendChat,
    sendAccountToken,
    sendSticker,
    getColorId
  };
}
function attachOutbound(S, hooks = {}) {
  const api = createOutbound(S, hooks);
  Object.assign(S.api, api);
  return api;
}
export {
  attachOutbound,
  createOutbound
};