import { getCookie, setCookie } from "../storage/cookies.js";
import {
  cancelKeybindCapture,
  initKeybindSettings,
  initSettingsNav,
  loadKeybinds,
  loadMouseButtonSettings,
  renderKeybindUI,
  syncMouseBindSettingsVisibility
} from "../game/input.js";
let settingsState = null;
const CUSTOM_BG_STORAGE_MAX = 9e5;
function loadBgImageFromDataUrl(dataUrl, onReady) {
  if (!dataUrl) {
    onReady(null);
    return;
  }
  const img = new Image();
  img.onload = () => onReady(img);
  img.onerror = () => onReady(null);
  img.src = dataUrl;
}
function saveBgImageToStorage(key, dataUrl) {
  if (!dataUrl) {
    localStorage.removeItem(key);
    return true;
  }
  if (dataUrl.length > CUSTOM_BG_STORAGE_MAX) return false;
  try {
    localStorage.setItem(key, dataUrl);
    return true;
  } catch (e) {
    return false;
  }
}
function drawCustomMapBackground(S, ctx) {
  if (!S.customMapBgEnabled || !S.mapBgImage || !S.mapBgImage.complete || !S.mapBgImage.width) return;
  const left = S.leftPos;
  const top = S.topPos;
  const right = S.rightPos;
  const bottom = S.bottomPos;
  const mapW = right - left;
  const mapH = bottom - top;
  if (mapW <= 0 || mapH <= 0) return;
  const halfW = S.canvasWidth / (2 * S.viewZoom);
  const halfH = S.canvasHeight / (2 * S.viewZoom);
  const visLeft = Math.max(left, S.nodeX - halfW);
  const visRight = Math.min(right, S.nodeX + halfW);
  const visTop = Math.max(top, S.nodeY - halfH);
  const visBottom = Math.min(bottom, S.nodeY + halfH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, mapW, mapH);
  ctx.clip();
  if (S.customMapBgMode === "repeat") {
    const tile = Math.max(32, S.customMapBgTileSize | 0);
    const startX = left + Math.floor((visLeft - left) / tile) * tile;
    const startY = top + Math.floor((visTop - top) / tile) * tile;
    for (let x = startX; x < visRight; x += tile) {
      for (let y = startY; y < visBottom; y += tile) {
        ctx.drawImage(S.mapBgImage, x, y, Math.min(tile, right - x), Math.min(tile, bottom - y));
      }
    }
  } else {
    ctx.drawImage(S.mapBgImage, left, top, mapW, mapH);
  }
  ctx.restore();
}
function drawVirusFillBackground(S, ctx, cell, renderSize, simpleRender, bigPointSize) {
  if (!S.customVirusBgEnabled || !S.virusBgImage || !S.virusBgImage.complete || !S.virusBgImage.width) return false;
  const half = (simpleRender ? renderSize : bigPointSize) * 1.15;
  ctx.save();
  ctx.clip();
  ctx.drawImage(S.virusBgImage, cell.x - half, cell.y - half, half * 2, half * 2);
  ctx.restore();
  return true;
}
function updateBgPreview(previewId, dataUrl) {
  const el = document.getElementById(previewId);
  if (!el) return;
  const clearId = previewId === "map-bg-preview" ? "map-bg-clear" : previewId === "virus-bg-preview" ? "virus-bg-clear" : null;
  const clearBtn = clearId ? document.getElementById(clearId) : null;
  if (dataUrl) {
    el.style.backgroundImage = `url("${dataUrl}")`;
    el.classList.add("has-image");
    if (clearBtn) clearBtn.hidden = false;
  } else {
    el.style.backgroundImage = "";
    el.classList.remove("has-image");
    if (clearBtn) clearBtn.hidden = true;
  }
}
function syncBgTileRows(S) {
  const mapRow = document.getElementById("map-bg-tile-row");
  if (mapRow) mapRow.style.display = S.customMapBgMode === "repeat" ? "flex" : "none";
}
function loadCustomBgState(S) {
  if (S.customBgStateLoaded) return;
  S.customBgStateLoaded = true;
  S.customMapBgMode = getCookie("custom_map_bg_mode") || "stretch";
  S.customMapBgTileSize = parseInt(getCookie("custom_map_bg_tile"), 10) || 512;
  const enabledMap = getCookie("checkbox-15");
  if (enabledMap !== void 0 && enabledMap !== null) S.customMapBgEnabled = enabledMap === "true";
  const enabledVirus = getCookie("checkbox-16");
  if (enabledVirus !== void 0 && enabledVirus !== null) S.customVirusBgEnabled = enabledVirus === "true";
  loadBgImageFromDataUrl(localStorage.getItem("custom_map_bg_image"), (img) => {
    S.mapBgImage = img;
    updateBgPreview("map-bg-preview", img ? localStorage.getItem("custom_map_bg_image") : null);
  });
  loadBgImageFromDataUrl(localStorage.getItem("custom_virus_bg_image"), (img) => {
    S.virusBgImage = img;
    updateBgPreview("virus-bg-preview", img ? localStorage.getItem("custom_virus_bg_image") : null);
  });
}
function initCustomBgSettings(S) {
  loadCustomBgState(S);
  if (S.customBgSettingsInitialized) return;
  const mapMode = document.getElementById("map-bg-mode");
  const mapTile = document.getElementById("map-bg-tile");
  if (!mapMode && !document.getElementById("map-bg-file")) return;
  S.customBgSettingsInitialized = true;
  if (mapMode) mapMode.value = S.customMapBgMode;
  if (mapTile) mapTile.value = S.customMapBgTileSize;
  syncBgTileRows(S);
  updateBgPreview("map-bg-preview", S.mapBgImage ? localStorage.getItem("custom_map_bg_image") : null);
  updateBgPreview("virus-bg-preview", S.virusBgImage ? localStorage.getItem("custom_virus_bg_image") : null);
  function bindBgFile(fileId, storageKey, previewId, setImage) {
    const input = document.getElementById(fileId);
    if (!input) return;
    input.addEventListener("change", function() {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        const dataUrl = e.target.result;
        loadBgImageFromDataUrl(dataUrl, (img) => {
          setImage(img);
          if (img && saveBgImageToStorage(storageKey, dataUrl)) {
            updateBgPreview(previewId, dataUrl);
          } else if (img) {
            updateBgPreview(previewId, dataUrl);
            alert("\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u0430, \u043D\u043E \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u0430\u044F \u0434\u043B\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F. \u041F\u043E\u0441\u043B\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u0430\u0439\u043B \u0441\u043D\u043E\u0432\u0430.");
          }
        });
      };
      reader.readAsDataURL(file);
    });
  }
  bindBgFile("map-bg-file", "custom_map_bg_image", "map-bg-preview", (img) => {
    S.mapBgImage = img;
  });
  bindBgFile("virus-bg-file", "custom_virus_bg_image", "virus-bg-preview", (img) => {
    S.virusBgImage = img;
  });
  const mapClear = document.getElementById("map-bg-clear");
  const virusClear = document.getElementById("virus-bg-clear");
  if (mapClear) mapClear.addEventListener("click", () => {
    S.mapBgImage = null;
    saveBgImageToStorage("custom_map_bg_image", null);
    updateBgPreview("map-bg-preview", null);
    const fi = document.getElementById("map-bg-file");
    if (fi) fi.value = "";
  });
  if (virusClear) virusClear.addEventListener("click", () => {
    S.virusBgImage = null;
    saveBgImageToStorage("custom_virus_bg_image", null);
    updateBgPreview("virus-bg-preview", null);
    const fi = document.getElementById("virus-bg-file");
    if (fi) fi.value = "";
  });
  if (mapMode) mapMode.addEventListener("change", function() {
    S.customMapBgMode = this.value;
    setCookie("custom_map_bg_mode", S.customMapBgMode, 365);
    syncBgTileRows(S);
  });
  if (mapTile) mapTile.addEventListener("change", function() {
    S.customMapBgTileSize = Math.max(64, parseInt(this.value, 10) || 512);
    this.value = S.customMapBgTileSize;
    setCookie("custom_map_bg_tile", S.customMapBgTileSize, 365);
  });
}
function isEjectedMass(S, cell) {
  if (!cell || cell.isVirus || cell.isFood) return false;
  if (S.playerCells.indexOf(cell) !== -1) return false;
  const flags = cell.flag | 0;
  if (flags & 32 || flags & 64 || cell.isEjected) return true;
  const sz = cell.nSize || cell.size || 0;
  if (sz <= 0 || !(S.foodMaxSize > 0)) return false;
  return sz > S.foodMaxSize && sz <= Math.max(55, S.foodMaxSize + 20);
}
function getClientCellColor(S, cell) {
  if (!S.customClientColors) return null;
  if (cell.isVirus) return S.clientColorVirus;
  if (cell.isFood) return S.clientColorFood;
  if (S.playerCells.indexOf(cell) !== -1) return S.clientColorOwn;
  if (isEjectedMass(S, cell)) return S.clientColorEject;
  if (!cell.isVirus && !cell.isFood && S.playerCells.indexOf(cell) === -1) {
    return S.clientColorEnemy;
  }
  return null;
}
function loadClientColorSettings(S) {
  const enabled = getCookie("checkbox-14");
  if (enabled !== void 0 && enabled !== null) {
    S.customClientColors = enabled === "true";
  }
  S.clientColorVirus = getCookie("client_color_virus") || S.clientColorVirus;
  S.clientColorFood = getCookie("client_color_food") || S.clientColorFood;
  S.clientColorEnemy = getCookie("client_color_enemy") || S.clientColorEnemy;
  S.clientColorOwn = getCookie("client_color_own") || S.clientColorOwn;
  S.clientColorEject = getCookie("client_color_eject") || S.clientColorEject;
}
function saveClientColorSetting(key, value) {
  setCookie(key, value, 365);
}
function wireClientColorInputs(S) {
  loadClientColorSettings(S);
  const clientColorInputs = [
    ["client-color-virus", "client_color_virus", () => S.clientColorVirus, (v) => {
      S.clientColorVirus = v;
    }],
    ["client-color-food", "client_color_food", () => S.clientColorFood, (v) => {
      S.clientColorFood = v;
    }],
    ["client-color-enemy", "client_color_enemy", () => S.clientColorEnemy, (v) => {
      S.clientColorEnemy = v;
    }],
    ["client-color-own", "client_color_own", () => S.clientColorOwn, (v) => {
      S.clientColorOwn = v;
    }],
    ["client-color-eject", "client_color_eject", () => S.clientColorEject, (v) => {
      S.clientColorEject = v;
    }]
  ];
  clientColorInputs.forEach(([id, cookieKey, getter, setter]) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = getCookie(cookieKey) || getter();
    if (input.dataset.wired === "1") return;
    input.dataset.wired = "1";
    input.addEventListener("input", function() {
      setter(input.value);
      saveClientColorSetting(cookieKey, input.value);
    });
  });
}
function getCheckboxDefaultValue(S, id) {
  switch (id) {
    case 1: return S.showSkin;
    case 2: return S.showName;
    case 3: return S.showColor;
    case 4: return S.enableMouseClicks;
    case 5: return S.showMass;
    case 6: return S.smoothRender > 0.4;
    case 7: return S.closebord;
    case 8: return S.hideChat;
    case 9: return S.showGlow;
    case 10: return S.showAdultContent;
    case 11: return S.confirmCloseTab;
    case 12: return S.fixedCell;
    case 13: return S.showStickers;
    case 14: return S.customClientColors;
    case 15: return S.customMapBgEnabled;
    case 16: return S.customVirusBgEnabled;
    default: return false;
  }
}
function applyCheckboxCookiesToState(S) {
  const w = S.wHandle;
  const apply = {
    1: (v) => w.setSkins(v),
    2: (v) => w.setNames(v),
    3: (v) => w.setColors(v),
    4: (v) => w.setMouseClicks(v),
    5: (v) => w.setShowMass(v),
    6: (v) => w.setSmooth(v),
    7: (v) => w.setNoBorder(v),
    8: (v) => w.setChatHide(v),
    9: (v) => w.setGlow(v),
    10: (v) => w.setAdultContent(v),
    11: (v) => w.setConfirmCloseTab(v),
    12: (v) => w.setFixedCell(v),
    13: (v) => w.setShowStickers(v),
    14: (v) => w.setCustomClientColors(v),
    15: (v) => w.setCustomMapBg(v),
    16: (v) => w.setCustomVirusBg(v)
  };
  for (let id = 1; id <= 16; id++) {
    const raw = getCookie("checkbox-" + id);
    const value = raw !== void 0 && raw !== null ? raw === "true" : getCheckboxDefaultValue(S, id);
    if (apply[id]) apply[id](value);
  }
}
function wireSettingsPanelDom(S) {
  const root = document.getElementById("settings");
  if (!root || root.dataset.settingsWired === "1") return;
  if (!root.querySelector(".save")) return;
  root.dataset.settingsWired = "1";
  const checkboxes = Array.from(root.querySelectorAll(".save"));
  checkboxes.forEach((input) => {
    const id = Number(input.dataset.boxId);
    const value = getCookie("checkbox-" + id);
    input.checked = value !== void 0 && value !== null ? value === "true" : getCheckboxDefaultValue(S, id);
  });
  loadClientColorSettings(S);
  loadMouseButtonSettings(S);
  S.keyBinds = loadKeybinds();
  S.keybindUiInitialized = false;
  S.customBgSettingsInitialized = false;
  wireClientColorInputs(S);
  initCustomBgSettings(S);
  initKeybindSettings(S);
  initSettingsNav();
  initMouseButtonSettings(S);
  renderKeybindUI(S);
  checkboxes.forEach((input) => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.addEventListener("change", function() {
      const id = Number(input.dataset.boxId);
      const value = input.checked;
      setCookie("checkbox-" + id, value, 365);
      if (id == 10) S.wHandle.setAdultContent(value);
      if (id == 11) S.wHandle.setConfirmCloseTab(value);
      if (id == 13) S.wHandle.setShowStickers(value);
      if (id == 14) S.wHandle.setCustomClientColors(value);
      if (id == 15) S.wHandle.setCustomMapBg(value);
      if (id == 16) S.wHandle.setCustomVirusBg(value);
    });
  });
}
async function ensureSettingsPanel() {
  const { mountPanel } = await import("./panels/mount.js");
  const settingsHtml = (await import("./panels/settings.html?raw")).default;
  mountPanel("settings", settingsHtml);
  if (settingsState) wireSettingsPanelDom(settingsState);
}
function resetSettingsPanel() {
  const root = document.getElementById("settings");
  if (root) delete root.dataset.settingsWired;
  if (settingsState) {
    settingsState.keybindUiInitialized = false;
    settingsState.customBgSettingsInitialized = false;
  }
  return import("./panels/mount.js").then(({ unmountPanel }) => unmountPanel("settings"));
}
function attachSettings(S, hooks = {}) {
  settingsState = S;
  const wHandle = S.wHandle;
  wHandle.setSkins = function(arg) {
    S.showSkin = arg;
  };
  wHandle.setNames = function(arg) {
    S.showName = arg;
  };
  wHandle.setColors = function(arg) {
    S.showColor = arg;
  };
  wHandle.setMouseClicks = function(arg) {
    S.enableMouseClicks = arg;
    syncMouseBindSettingsVisibility(S);
  };
  wHandle.setShowMass = function(arg) {
    S.showMass = arg;
  };
  wHandle.setSmooth = function(arg) {
    S.smoothRender = arg ? 2 : 0.4;
  };
  wHandle.setNoBorder = function(arg) {
    S.closebord = arg;
  };
  wHandle.setChatHide = function(arg) {
    S.hideChat = arg;
  };
  wHandle.setGlow = function(arg) {
    S.showGlow = arg;
  };
  wHandle.setAdultContent = function(arg) {
    S.showAdultContent = arg;
  };
  wHandle.setFixedCell = function(arg) {
    S.fixedCell = arg;
  };
  wHandle.setConfirmCloseTab = function(arg) {
    S.confirmCloseTab = arg;
  };
  wHandle.setShowStickers = function(arg) {
    S.showStickers = arg;
  };
  wHandle.setCustomClientColors = function(arg) {
    S.customClientColors = arg;
  };
  wHandle.setCustomMapBg = function(arg) {
    S.customMapBgEnabled = arg;
  };
  wHandle.setCustomVirusBg = function(arg) {
    S.customVirusBgEnabled = arg;
  };
  if (hooks.fixDead) {
    wHandle.fixDead = hooks.fixDead;
  }
  Object.defineProperty(wHandle, "freeze", {
    get() {
      return S.freeze;
    },
    set(v) {
      S.freeze = !!v;
    },
    configurable: true
  });
  window.addEventListener("beforeunload", function(e) {
    if (S.confirmCloseTab) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  applyCheckboxCookiesToState(S);
  loadClientColorSettings(S);
  loadMouseButtonSettings(S);
  loadCustomBgState(S);
  S.keyBinds = loadKeybinds();
  return {
    drawCustomMapBackground: (ctx) => drawCustomMapBackground(S, ctx),
    drawVirusFillBackground: (ctx, cell, renderSize, simpleRender, bigPointSize) => drawVirusFillBackground(S, ctx, cell, renderSize, simpleRender, bigPointSize),
    getClientCellColor: (cell) => getClientCellColor(S, cell),
    isEjectedMass: (cell) => isEjectedMass(S, cell),
    cancelKeybindCapture: () => cancelKeybindCapture(S)
  };
}
export {
  attachSettings,
  drawCustomMapBackground,
  drawVirusFillBackground,
  ensureSettingsPanel,
  getClientCellColor,
  initCustomBgSettings,
  initKeybindSettings,
  initSettingsNav,
  isEjectedMass,
  resetSettingsPanel
};