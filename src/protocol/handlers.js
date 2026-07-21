import { BinaryReader } from "./BinaryReader.js";
import { repositionFoodNodes } from "../game/world.js";
import { ServerOpcode } from "./opcodes.js";
import { safeCloseSocket } from "../net/wsClient.js";
import { hideConnectVerifyOverlay, showBanBanner } from "../ui/overlays.js";
function createHandlers(S, hooks = {}) {
  function handleWsMessage(msg) {
    let offset = 0;
    let setCustomLB = false;
    function getString() {
      let text = "";
      let char;
      while ((char = msg.getUint16(offset, true)) !== 0) {
        offset += 2;
        text += String.fromCharCode(char);
      }
      offset += 2;
      return text;
    }
    const messageType = msg.getUint8(offset++);
    switch (messageType) {
      case ServerOpcode.BAN: {
        hideConnectVerifyOverlay();
        const banRemaining = msg.getUint32(offset, true);
        offset += 4;
        const banReason = getString();
        showBanBanner(banRemaining, banReason);
        S.connectInProgress = false;
        S.gameHandshakeDone = false;
        if (S.wsPingInterval) {
          clearInterval(S.wsPingInterval);
          S.wsPingInterval = null;
        }
        if (S.ws) {
          safeCloseSocket(S.ws);
          S.ws = null;
        }
        break;
      }
      case ServerOpcode.PING:
        S.ping = Date.now() - S.pingstamp;
        hooks.setPingDisplay?.(S.ping);
        break;
      case ServerOpcode.UPDATE_NODES: {
        const reader = new BinaryReader(msg);
        reader.offset++;
        hooks.updateNodes?.(reader);
        break;
      }
      case ServerOpcode.UPDATE_CAMERA:
        S.posSize = 0.15;
        break;
      case ServerOpcode.CLEAR_NODES:
        S.playerCells = [];
        break;
      case ServerOpcode.CUSTOM_LB: {
        setCustomLB = true;
        S.noRanking = true;
        const count = msg.getUint32(offset, true);
        offset += 4;
        S.leaderBoard = [];
        for (let i = 0; i < count; i++) {
          msg.getUint32(offset, true);
          offset += 4;
          const text = getString();
          S.leaderBoard.push({
            id: null,
            name: text,
            level: -1,
            xp: 0
          });
        }
        hooks.drawCustomLeaderBoard?.();
        break;
      }
      case ServerOpcode.FFA_LB: {
        if (!setCustomLB) {
          S.noRanking = false;
        }
        const LBplayerNum = msg.getUint32(offset, true);
        offset += 4;
        S.leaderBoard = [];
        for (let i = 0; i < LBplayerNum; ++i) {
          const nodeId = msg.getUint32(offset, true);
          offset += 4;
          const playerName = getString();
          const playerXp = msg.getUint32(offset, true);
          offset += 4;
          S.leaderBoard.push({
            id: nodeId,
            name: playerName,
            level: playerXp ? hooks.getLevel?.(playerXp) ?? -1 : -1,
            xp: playerXp
          });
        }
        hooks.drawLeaderBoard?.();
        break;
      }
      case ServerOpcode.BORDERS: {
        S.leftPos = msg.getFloat64(offset, true);
        offset += 8;
        S.topPos = msg.getFloat64(offset, true);
        offset += 8;
        S.rightPos = msg.getFloat64(offset, true);
        offset += 8;
        S.bottomPos = msg.getFloat64(offset, true);
        offset += 8;
        S.foodMinSize = (msg.getUint16(offset, true) * 100) ** 0.5;
        offset += 2;
        S.foodMaxSize = (msg.getUint16(offset, true) * 100) ** 0.5;
        offset += 2;
        S.ownerPlayerId = msg.getUint32(offset, true);
        offset += 4;
        S.mapBoundsReady = true;
        repositionFoodNodes(S);
        S.mapWidth = (S.rightPos + S.leftPos) / 2;
        S.mapHeight = (S.bottomPos + S.topPos) / 2;
        S.posX = (S.rightPos + S.leftPos) / 2;
        S.posY = (S.bottomPos + S.topPos) / 2;
        S.posSize = 1;
        if (S.playerCells.length === 0) {
          S.nodeX = S.posX;
          S.nodeY = S.posY;
          S.viewZoom = S.posSize;
        }
        hooks.onGameHandshakeReady?.();
        break;
      }
      case ServerOpcode.CHAT:
        hooks.addChat?.(msg, offset);
        break;
      case ServerOpcode.XP: {
        const xp = msg.getUint32(offset, true);
        hooks.onUpdateXp?.(xp);
        break;
      }
      case ServerOpcode.STICKER: {
        if (!S.showStickers) break;
        const stickerPlayerId = msg.getUint32(offset, true);
        offset += 4;
        const stickerId = msg.getUint8(offset++);
        const stickerAction = msg.getUint8(offset++);
        for (let i = 0; i < S.nodelist.length; i++) {
          const node = S.nodelist[i];
          if (node.id === stickerPlayerId && node.name) {
            if (stickerAction === 1) {
              node.currentSticker = stickerId;
              node.stickerActive = true;
            } else {
              node.stickerActive = false;
              node.currentSticker = null;
            }
            break;
          }
        }
        break;
      }
      default:
        break;
    }
  }
  return { handleWsMessage };
}
function attachHandlers(S, hooks = {}) {
  const api = createHandlers(S, hooks);
  Object.assign(S.api, api);
  return api;
}
export {
  attachHandlers,
  createHandlers
};