import { hideOverlays, showStatics } from "../lib/dom.js";
const normalizeFractlPart = (n) => n % (Math.PI * 2) / (Math.PI * 2);
function computeFoodPosition(S, nodeid) {
  return {
    x: S.leftPos + S.rightPos * 2 * normalizeFractlPart(nodeid),
    y: S.topPos + S.bottomPos * 2 * normalizeFractlPart(nodeid * nodeid)
  };
}
function repositionFoodNodes(S) {
  if (!S.mapBoundsReady) return;
  const now = Date.now();
  for (let i = 0; i < S.nodelist.length; i++) {
    const node = S.nodelist[i];
    if (!node?.isFood) continue;
    const { x, y } = computeFoodPosition(S, node.id);
    node.ox = x;
    node.oy = y;
    node.nx = x;
    node.ny = y;
    node.x = x;
    node.y = y;
    node.updateTime = now;
  }
  S.nodesSortDirty = true;
}
function updateNodes(S, reader, hooks) {
  const { Cell, onPlayerDeath } = hooks;
  S.timestamp = Date.now();
  S.ua = false;
  S.nodesSortDirty = true;
  for (let killedId; killedId = reader.uint32(); ) {
    const killer = S.nodes[reader.uint32()];
    const killedNode = S.nodes[killedId];
    if (killer && killedNode) {
      killedNode.destroy();
      killedNode.ox = killedNode.x;
      killedNode.oy = killedNode.y;
      killedNode.oSize = killedNode.size;
      killedNode.nx = killer.x;
      killedNode.ny = killer.y;
      killedNode.nSize = killedNode.size;
      killedNode.updateTime = S.timestamp;
    }
  }
  for (let nodeid; nodeid = reader.uint32(); ) {
    const type = reader.uint8();
    let posX = 0;
    let posY = 0;
    let size = 0;
    let playerId = 0;
    if (type === 1) {
      if (S.mapBoundsReady) {
        const foodPos = computeFoodPosition(S, nodeid);
        posX = foodPos.x;
        posY = foodPos.y;
      }
    } else {
      if (type === 0) playerId = reader.uint32();
      posX = reader.int32();
      posY = reader.int32();
      size = reader.uint16();
    }
    const r = reader.uint8();
    const g = reader.uint8();
    const b = reader.uint8();
    let color = "#" + (r << 16 | g << 8 | b).toString(16).padStart(6, "0");
    const spiked = reader.uint8();
    const flagVirus = !!(spiked & 1);
    const flagEjected = !!(spiked & 32) || !!(spiked & 64);
    const flagAgitated = !!(spiked & 16);
    const name = reader.utf8();
    let stickerData = null;
    if (reader.canRead) {
      const marker = reader.uint8();
      if (marker === 255) {
        stickerData = reader.uint8();
      }
    }
    if (type === 1 && !S.mapBoundsReady) {
      continue;
    }
    let node = S.nodes[nodeid];
    if (node) {
      node = S.nodes[nodeid];
      node.updatePos();
      node.ox = node.x;
      node.oy = node.y;
      node.oSize = node.size;
      node.color = color;
    } else {
      node = new Cell(nodeid, posX, posY, size, color, name);
      S.nodelist.push(node);
      S.nodes[nodeid] = node;
      node.ka = posX;
      node.la = posY;
      if (playerId === S.ownerPlayerId) {
        hideOverlays();
        node.isOwn = true;
        S.playerCells.push(node);
        if (1 == S.playerCells.length) {
          S.nodeX = node.x;
          S.nodeY = node.y;
        }
      }
    }
    if (stickerData) {
      node.currentSticker = stickerData;
      node.stickerActive = true;
    } else if (node) {
      node.stickerActive = false;
      node.currentSticker = null;
    }
    node.isVirus = flagVirus;
    node.isEjected = flagEjected;
    node.isAgitated = flagAgitated;
    if (type === 1) node.isFood = true;
    node.nx = posX;
    node.ny = posY;
    node.setSize(size);
    node.updateTime = S.timestamp;
    node.flag = spiked;
    if (name) node.setName(name);
  }
  while (reader.canRead) {
    const node = S.nodes[reader.uint32()];
    if (node) node.destroy();
  }
  if (S.ua && S.playerCells.length === 0) {
    if (typeof onPlayerDeath === "function") {
      onPlayerDeath(S);
    } else {
      showStatics();
      if (typeof window.updateShareText === "function") window.updateShareText();
      if (typeof window.renderDeathBanner === "function") window.renderDeathBanner();
    }
  }
}
function fixDead(S) {
  const now = Date.now();
  for (let i = S.nodelist.length - 1; i >= 0; i--) {
    const node = S.nodelist[i];
    if (!node || node.destroyed) continue;
    if (now - node.updateTime > 3e3) node.destroy();
  }
}
function clearPlayerCells(S) {
  S.playerCells = [];
}
function clearWorld(S) {
  S.playerCells = [];
  S.nodes = {};
  S.nodelist = [];
  S.Cells = [];
  S.leaderBoard = [];
  S.mapBoundsReady = false;
}
function createWorldState() {
  return {
    nodes: {},
    nodelist: [],
    playerCells: [],
    Cells: [],
    leaderBoard: []
  };
}
export {
  clearPlayerCells,
  clearWorld,
  computeFoodPosition,
  createWorldState,
  fixDead,
  normalizeFractlPart,
  repositionFoodNodes,
  updateNodes
};