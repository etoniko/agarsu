import { KEYBIND_DEFAULTS, KEYBIND_LABELS } from "../config/defaults.js";
import { getCookie, setCookie } from "../storage/cookies.js";
import { lsGetJson, lsSetJson } from "../storage/local.js";
import { hideOverlays, hideStatics, isOverlaysVisible, isPointerOverElement, onReady, showOverlays } from "../lib/dom.js";
import { mouseCoordinateChange, canvasResize } from "./camera.js";
import { getStickerPackCode } from "../storage/staticLists.js";
const KEYBINDS_KEY = "keybinds_v1";
const CELL_COLORS = [
  "#003366",
  "#336699",
  "#3366CC",
  "#003399",
  "#000099",
  "#0000CC",
  "#000066",
  "#006666",
  "#006699",
  "#0099CC",
  "#0066CC",
  "#0033CC",
  "#0000FF",
  "#3333FF",
  "#333399",
  "#669999",
  "#009999",
  "#33CCCC",
  "#00CCFF",
  "#0099FF",
  "#0066FF",
  "#3366FF",
  "#3333CC",
  "#666699",
  "#339966",
  "#00CC99",
  "#00FFCC",
  "#00FFFF",
  "#33CCFF",
  "#3399FF",
  "#6699FF",
  "#6666FF",
  "#6600FF",
  "#6600CC",
  "#339933",
  "#00CC66",
  "#00FF99",
  "#66FFCC",
  "#66FFFF",
  "#66CCFF",
  "#99CCFF",
  "#9999FF",
  "#9966FF",
  "#9933FF",
  "#9900FF",
  "#006600",
  "#00CC00",
  "#00FF00",
  "#66FF99",
  "#99FFCC",
  "#CCFFFF",
  "#CCCCFF",
  "#CC99FF",
  "#CC66FF",
  "#CC33FF",
  "#CC00FF",
  "#9900CC",
  "#003300",
  "#009933",
  "#33CC33",
  "#66FF66",
  "#99FF99",
  "#CCFFCC",
  "#FFCCFF",
  "#FF99FF",
  "#FF66FF",
  "#FF00FF",
  "#CC00CC",
  "#660066",
  "#336600",
  "#009900",
  "#66FF33",
  "#99FF66",
  "#CCFF99",
  "#FFFFCC",
  "#FFCCCC",
  "#FF99CC",
  "#FF66CC",
  "#FF33CC",
  "#CC0099",
  "#993399",
  "#333300",
  "#669900",
  "#99FF33",
  "#CCFF66",
  "#FFFF99",
  "#FFCC99",
  "#FF9999",
  "#FF6699",
  "#FF3399",
  "#CC3399",
  "#990099",
  "#666633",
  "#99CC00",
  "#CCFF33",
  "#FFFF66",
  "#FFCC66",
  "#FF9966",
  "#FF6666",
  "#FF0066",
  "#CC6699",
  "#993366",
  "#999966",
  "#CCCC00",
  "#FFFF00",
  "#FFCC00",
  "#FF9933",
  "#FF66000",
  "#FF5050",
  "#CC0066",
  "#660033",
  "#996633",
  "#CC9900",
  "#FF9900",
  "#CC6600",
  "#FF3300",
  "#FF0000",
  "#CC0000",
  "#990033",
  "#663300",
  "#996600",
  "#CC3300",
  "#993300",
  "#990000",
  "#800000",
  "#993333"
];
function loadKeybinds(defaults = KEYBIND_DEFAULTS) {
  const saved = lsGetJson(KEYBINDS_KEY, null);
  const binds = Object.assign({}, defaults);
  if (saved) {
    Object.keys(defaults).forEach((action) => {
      if (typeof saved[action] === "number") binds[action] = saved[action];
    });
  }
  return binds;
}
function saveKeybinds(binds) {
  lsSetJson(KEYBINDS_KEY, binds);
}
function keyCodeToLabel(code) {
  const named = {
    8: "Backspace",
    9: "Tab",
    13: "Enter",
    16: "Shift",
    17: "Ctrl",
    18: "Alt",
    20: "CapsLock",
    27: "Esc",
    32: "Space",
    37: "\u2190",
    38: "\u2191",
    39: "\u2192",
    40: "\u2193"
  };
  if (named[code]) return named[code];
  if (code >= 65 && code <= 90) return String.fromCharCode(code);
  if (code >= 48 && code <= 57) return String.fromCharCode(code);
  if (code >= 96 && code <= 105) return "Numpad " + (code - 96);
  return "\u041A\u043E\u0434 " + code;
}
function getBind(S, action) {
  const code = S.keyBinds[action];
  return typeof code === "number" ? code : KEYBIND_DEFAULTS[action];
}
function assignKeybind(S, action, code) {
  const other = Object.keys(S.keyBinds).find((a) => a !== action && S.keyBinds[a] === code);
  if (other) S.keyBinds[other] = S.keyBinds[action];
  S.keyBinds[action] = code;
  saveKeybinds(S.keyBinds);
  cancelKeybindCapture(S);
}
function resetKeybinds(S) {
  S.keyBinds = Object.assign({}, KEYBIND_DEFAULTS);
  saveKeybinds(S.keyBinds);
  S.mouseSplitButton = 3;
  S.mouseEjectButton = 1;
  saveMouseButtonSettings(S);
  const splitSel = document.getElementById("mouse-split-btn");
  const ejectSel = document.getElementById("mouse-eject-btn");
  if (splitSel) splitSel.value = "3";
  if (ejectSel) ejectSel.value = "1";
  renderKeybindUI(S);
}
function renderKeybindUI(S) {
  const list = document.getElementById("keybind-list");
  if (!list) return;
  list.querySelectorAll(".keybind-key").forEach((btn) => {
    const action = btn.dataset.action;
    if (action) btn.textContent = keyCodeToLabel(getBind(S, action));
  });
}
function cancelKeybindCapture(S) {
  S.keybindCaptureAction = null;
  document.querySelectorAll(".keybind-key.listening").forEach((el) => el.classList.remove("listening"));
  renderKeybindUI(S);
}
function normalizeMouseButton(btn) {
  if (btn === 0) return 0;
  return btn === 3 ? 3 : 1;
}
function syncMouseBindSettingsVisibility(S) {
  const block = document.getElementById("mouse-bind-settings");
  if (block) block.classList.toggle("visible", !!S.enableMouseClicks);
}
function loadMouseButtonSettings(S) {
  const split = parseInt(getCookie("mouse_split_btn"), 10);
  const eject = parseInt(getCookie("mouse_eject_btn"), 10);
  S.mouseSplitButton = normalizeMouseButton(split);
  S.mouseEjectButton = normalizeMouseButton(eject);
  if (S.mouseSplitButton !== 0 && S.mouseSplitButton === S.mouseEjectButton) {
    S.mouseEjectButton = S.mouseSplitButton === 1 ? 3 : 1;
  }
  const splitSel = document.getElementById("mouse-split-btn");
  const ejectSel = document.getElementById("mouse-eject-btn");
  if (splitSel) splitSel.value = String(S.mouseSplitButton);
  if (ejectSel) ejectSel.value = String(S.mouseEjectButton);
  syncMouseBindSettingsVisibility(S);
}
function saveMouseButtonSettings(S) {
  setCookie("mouse_split_btn", S.mouseSplitButton, 365);
  setCookie("mouse_eject_btn", S.mouseEjectButton, 365);
}
function initMouseButtonSettings(S) {
  loadMouseButtonSettings(S);
  const splitSel = document.getElementById("mouse-split-btn");
  const ejectSel = document.getElementById("mouse-eject-btn");
  if (!splitSel || !ejectSel) return;
  splitSel.addEventListener("change", function() {
    S.mouseSplitButton = normalizeMouseButton(parseInt(this.value, 10));
    if (S.mouseSplitButton !== 0 && S.mouseSplitButton === S.mouseEjectButton) {
      S.mouseEjectButton = S.mouseSplitButton === 1 ? 3 : 1;
      ejectSel.value = String(S.mouseEjectButton);
    }
    saveMouseButtonSettings(S);
  });
  ejectSel.addEventListener("change", function() {
    S.mouseEjectButton = normalizeMouseButton(parseInt(this.value, 10));
    if (S.mouseEjectButton !== 0 && S.mouseSplitButton === S.mouseEjectButton) {
      S.mouseSplitButton = S.mouseEjectButton === 1 ? 3 : 1;
      splitSel.value = String(S.mouseSplitButton);
    }
    saveMouseButtonSettings(S);
  });
}
function initKeybindSettings(S) {
  if (S.keybindUiInitialized) return;
  S.keybindUiInitialized = true;
  S.keyBinds = loadKeybinds();
  const list = document.getElementById("keybind-list");
  if (!list) return;
  Object.keys(KEYBIND_DEFAULTS).forEach((action) => {
    const row = document.createElement("div");
    row.className = "keybind-row";
    const label = document.createElement("span");
    label.textContent = KEYBIND_LABELS[action] || action;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "keybind-key";
    btn.dataset.action = action;
    btn.textContent = keyCodeToLabel(getBind(S, action));
    btn.addEventListener("click", () => {
      S.keybindCaptureAction = action;
      btn.textContent = "\u2026\u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u043A\u043B\u0430\u0432\u0438\u0448\u0443";
      btn.classList.add("listening");
    });
    row.appendChild(label);
    row.appendChild(btn);
    list.appendChild(row);
  });
  const resetBtn = document.getElementById("keybind-reset");
  if (resetBtn) resetBtn.addEventListener("click", () => resetKeybinds(S));
  initMouseButtonSettings(S);
}
function initSettingsNav() {
  const layout = document.querySelector(".settings-layout");
  if (!layout) return;
  const navItems = layout.querySelectorAll(".settings-nav-item");
  const panels = layout.querySelectorAll(".settings-panel");
  if (!navItems.length || !panels.length) return;
  function showSettingsPanel(panelId) {
    panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === panelId));
    navItems.forEach((btn) => btn.classList.toggle("active", btn.dataset.panel === panelId));
    try {
      localStorage.setItem("settings_active_panel", panelId);
    } catch (e) {
    }
  }
  navItems.forEach((btn) => {
    btn.addEventListener("click", () => showSettingsPanel(btn.dataset.panel));
  });
  let initial = "graphics";
  try {
    const saved = localStorage.getItem("settings_active_panel");
    if (saved && layout.querySelector(`.settings-panel[data-panel="${saved}"]`)) {
      initial = saved;
    }
  } catch (e) {
  }
  showSettingsPanel(initial);
}
function attachInput(S, hooks) {
  const wHandle = S.wHandle;
  if (!S.keyBinds) S.keyBinds = loadKeybinds();
  if (!S.cellColors) S.cellColors = CELL_COLORS;
  wHandle.resetKeybinds = () => resetKeybinds(S);
  let isTyping = false;
  let currentSticker = null;
  const keyPressed = {};
  const mouseHoldState = {};
  S.ma = true;
  S.freeze = false;
  S.stickerCooldown = false;
  const reconnectBtn = document.getElementById("connect-verify-reconnect-btn");
  if (reconnectBtn && !reconnectBtn.dataset.bound) {
    reconnectBtn.dataset.bound = "1";
    reconnectBtn.addEventListener("click", hooks.reconnectToServer);
  }
  S.mainCanvas = S.nCanvas = document.getElementById("canvas");
  S.ctx = S.mainCanvas.getContext("2d");
  function syncMouseFromEvent(event2) {
    const dpr = window.devicePixelRatio || 1;
    S.rawMouseX = event2.clientX * dpr;
    S.rawMouseY = event2.clientY * dpr;
    mouseCoordinateChange(S);
  }
  S.mainCanvas.onmousemove = syncMouseFromEvent;
  document.addEventListener("mousemove", syncMouseFromEvent, { passive: true });
  const updateMouseAim = () => {
    let x = S.X < S.rightPos ? S.X : S.rightPos;
    let y = S.Y < S.bottomPos ? S.Y : S.bottomPos;
    x = -S.rightPos > x ? -S.rightPos : x;
    y = -S.bottomPos > y ? -S.bottomPos : y;
    S.posX = x;
    S.posY = y;
  };
  S.mainCanvas.addEventListener("mousedown", () => {
    if (!S.playerCells.length) {
      updateMouseAim();
      hooks.sendUint8(1);
    }
  });
  if (S.touchable) {
    S.mainCanvas.addEventListener("touchstart", onTouchStart, false);
    S.mainCanvas.addEventListener("touchmove", onTouchMove, false);
    S.mainCanvas.addEventListener("touchend", onTouchEnd, false);
  }
  S.mainCanvas.onmouseup = function() {
  };
  function handleWheel(event2) {
    const chatContainer = document.querySelector(".noscroll");
    if (isOverlaysVisible() || isPointerOverElement(chatContainer, event2.clientX, event2.clientY)) return;
    S.zoom *= Math.pow(0.9, event2.wheelDelta / -120 || event2.detail || 0);
    if (S.zoom < 0) S.zoom = 1;
    if (S.zoom > 4 / S.viewZoom) S.zoom = 4 / S.viewZoom;
    if (S.zoom < 0.3) S.zoom = 0.3;
  }
  if (/firefox/i.test(navigator.userAgent)) {
    document.addEventListener("DOMMouseScroll", handleWheel, false);
  } else {
    document.body.onmousewheel = handleWheel;
  }
  S.mainCanvas.onfocus = () => {
    isTyping = false;
  };
  document.querySelectorAll(".noPress").forEach((elem) => {
    elem.onblur = () => {
      isTyping = false;
    };
    elem.onfocus = () => {
      isTyping = true;
    };
  });
  function getLocalStickerNick() {
    const fromCell = S.playerCells?.[0]?.name;
    if (fromCell) return fromCell;
    return document.getElementById("nick")?.value?.trim() || "";
  }
  function localHasStickerPack() {
    return !!getStickerPackCode(S.stickerList, getLocalStickerNick());
  }
  function sendSticker(stickerId, action) {
    if (hooks.wsIsOpen()) {
      const msg = hooks.prepareData(6);
      msg.setUint8(0, 200);
      msg.setUint8(1, stickerId);
      msg.setUint8(2, action ? 1 : 0);
      hooks.wsSend(msg);
    }
  }
  function showStickerOverCell(stickerId) {
    const cell = S.playerCells[0];
    if (!cell) return;
    cell.currentSticker = stickerId;
    cell.stickerActive = true;
  }
  function hideSticker() {
    const cell = S.playerCells[0];
    if (cell) {
      cell.currentSticker = null;
      cell.stickerActive = false;
    }
  }
  function pressStickerKey(stickerId) {
    if (!S.showStickers || isTyping || S.stickerCooldown || currentSticker === stickerId) return;
    if (!localHasStickerPack()) return;
    if (currentSticker !== null) {
      sendSticker(currentSticker, false);
      hideSticker();
    }
    currentSticker = stickerId;
    sendSticker(stickerId, true);
    showStickerOverCell(stickerId);
    S.stickerCooldown = true;
    if (S.stickerCooldownTimer) clearTimeout(S.stickerCooldownTimer);
    S.stickerCooldownTimer = setTimeout(() => {
      S.stickerCooldown = false;
    }, 500);
  }
  function releaseStickerKey(stickerId) {
    if (currentSticker === stickerId) {
      currentSticker = null;
      sendSticker(stickerId, false);
      hideSticker();
    }
  }
  wHandle.onkeydown = function(event2) {
    if (S.keybindCaptureAction) {
      event2.preventDefault();
      const code2 = event2.keyCode;
      if (code2 === 27) {
        cancelKeybindCapture(S);
        return;
      }
      assignKeybind(S, S.keybindCaptureAction, code2);
      return;
    }
    const code = event2.keyCode;
    if (code === getBind(S, "chat")) {
      if (isTyping || S.hideChat) {
        isTyping = false;
        const chatInput = document.getElementById("chat_textbox");
        const lsInput = document.getElementById("ls");
        const lsText = lsInput ? lsInput.value.trim() : "";
        const chatText = chatInput ? chatInput.value.trim() : "";
        let combinedText = "";
        if (lsText && chatText) combinedText = lsText + " " + chatText;
        else if (lsText) combinedText = lsText;
        else if (chatText) combinedText = chatText;
        if (combinedText.length > 0) hooks.sendChat(combinedText);
        if (chatInput) chatInput.value = "";
        if (lsInput) lsInput.value = "";
        if (chatInput) chatInput.blur();
        if (lsInput) lsInput.blur();
      } else {
        document.getElementById("chat_textbox").focus();
        isTyping = true;
      }
      return;
    }
    if (isTyping) return;
    if (code === getBind(S, "freeze")) {
      if (!keyPressed.freeze && S.playerCells.length > 0) {
        S.freeze = !S.freeze;
        if (S.freeze) {
          S.posX = S.X;
          S.posY = S.Y;
          document.querySelector("#freeze").style.display = "flex";
        } else {
          document.querySelector("#freeze").style.display = "none";
        }
        keyPressed.freeze = true;
      }
      return;
    }
    if (code === getBind(S, "split")) {
      if (!keyPressed.split) {
        hooks.sendMouseMove();
        hooks.sendUint8(17);
        keyPressed.split = true;
      }
      return;
    }
    if (code === getBind(S, "coord")) {
      if (!keyPressed.coord) {
        hooks.coord();
        keyPressed.coord = true;
      }
      return;
    }
    if (code === getBind(S, "eject")) {
      if (!keyPressed.eject) {
        hooks.sendMouseMove();
        hooks.sendUint8(21);
        keyPressed.eject = true;
        S.ejectKeyInterval = setInterval(function() {
          hooks.sendMouseMove();
          hooks.sendUint8(21);
        }, 100);
      }
      return;
    }
    if (code === getBind(S, "macroQ")) {
      if (!keyPressed.macroQ) {
        hooks.sendUint8(18);
        keyPressed.macroQ = true;
      }
      return;
    }
    if (code === getBind(S, "macroE")) {
      if (!keyPressed.macroE) {
        hooks.sendMouseMove();
        hooks.sendUint8(22);
        keyPressed.macroE = true;
      }
      return;
    }
    if (code === getBind(S, "macroR")) {
      if (!keyPressed.macroR) {
        hooks.sendMouseMove();
        hooks.sendUint8(23);
        hooks.fixDead();
        keyPressed.macroR = true;
      }
      return;
    }
    if (code === getBind(S, "macroT")) {
      if (!keyPressed.macroT) {
        hooks.sendMouseMove();
        hooks.sendUint8(24);
        keyPressed.macroT = true;
      }
      return;
    }
    if (code === getBind(S, "macroP")) {
      if (!keyPressed.macroP) {
        hooks.sendMouseMove();
        hooks.sendUint8(25);
        keyPressed.macroP = true;
      }
      return;
    }
    for (let s = 1; s <= 9; s++) {
      if (code === getBind(S, "sticker" + s)) {
        pressStickerKey(s);
        return;
      }
    }
  };
  wHandle.onkeyup = function(event2) {
    const code = event2.keyCode;
    if (code === getBind(S, "freeze")) keyPressed.freeze = false;
    if (code === getBind(S, "split")) keyPressed.split = false;
    if (code === getBind(S, "coord")) keyPressed.coord = false;
    if (code === getBind(S, "eject")) {
      keyPressed.eject = false;
      clearInterval(S.ejectKeyInterval);
      S.ejectKeyInterval = null;
    }
    if (code === getBind(S, "macroQ")) {
      if (keyPressed.macroQ) {
        hooks.sendUint8(19);
        keyPressed.macroQ = false;
      }
    }
    if (code === getBind(S, "macroE")) keyPressed.macroE = false;
    if (code === getBind(S, "macroR")) keyPressed.macroR = false;
    if (code === getBind(S, "macroT")) keyPressed.macroT = false;
    if (code === getBind(S, "macroP")) keyPressed.macroP = false;
    for (let s = 1; s <= 9; s++) {
      if (code === getBind(S, "sticker" + s)) releaseStickerKey(s);
    }
  };
  const colorSelected = document.getElementById("selectedColor");
  const colorList = document.getElementById("colorList");
  const skinss = document.getElementById("skinss");
  const colorSaved = localStorage.getItem("selectedColor");
  if (colorSaved && colorSelected) {
    colorSelected.style.background = colorSaved;
    if (skinss) {
      skinss.style.borderColor = colorSaved;
      skinss.style.backgroundColor = colorSaved;
      skinss.style.boxShadow = `0 0 10px ${colorSaved}`;
    }
  }
  if (colorSelected) {
    colorSelected.onclick = () => {
      colorList.style.display = colorList.style.display === "none" || colorList.style.display === "" ? "flex" : "none";
    };
  }
  if (colorList) {
    colorList.onclick = (evt) => {
      const hex = evt.target._cellColorHex;
      if (!hex) return;
      colorSelected.style.background = hex;
      localStorage.setItem("selectedColor", hex);
      skinss.style.borderColor = hex;
      skinss.style.backgroundColor = hex;
      skinss.style.boxShadow = `0 0 10px ${hex}`;
      colorList.style.display = "none";
    };
    S.cellColors.forEach((hex) => {
      const d = document.createElement("div");
      d.className = "item";
      d.style.background = hex;
      d._cellColorHex = hex;
      colorList.appendChild(d);
    });
  }
  wHandle.onblur = function() {
    hooks.sendUint8(19);
    clearInterval(S.ejectKeyInterval);
    S.ejectKeyInterval = null;
    Object.keys(keyPressed).forEach((k) => {
      keyPressed[k] = false;
    });
  };
  document.addEventListener("contextmenu", () => {
    if (keyPressed.eject) {
      keyPressed.eject = false;
      clearInterval(S.ejectKeyInterval);
      S.ejectKeyInterval = null;
    }
  });
  const doSplitAction = () => {
    hooks.sendMouseMove();
    hooks.sendUint8(17);
  };
  const doEjectAction = () => {
    hooks.sendMouseMove();
    hooks.sendUint8(21);
  };
  const getMouseAction = (which) => {
    if (which === S.mouseSplitButton) return "split";
    if (which === S.mouseEjectButton) return "eject";
    return null;
  };
  const clearMouseButton = (which) => {
    const st = mouseHoldState[which];
    if (!st) return;
    st.down = false;
    if (st.interval) clearInterval(st.interval);
    if (st.timeout) clearTimeout(st.timeout);
    delete mouseHoldState[which];
  };
  const clearAllMouseHolds = () => {
    Object.keys(mouseHoldState).forEach((k) => clearMouseButton(+k));
  };
  window.addEventListener("blur", clearAllMouseHolds);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearAllMouseHolds();
  });
  document.addEventListener("mousedown", function(event2) {
    if (!S.enableMouseClicks || isTyping) return;
    if (isOverlaysVisible()) return;
    const which = event2.which;
    const action = getMouseAction(which);
    if (!action || mouseHoldState[which]?.down) return;
    mouseHoldState[which] = { down: true, interval: null, timeout: null };
    if (action === "split") {
      doSplitAction();
      mouseHoldState[which].timeout = setTimeout(() => {
        if (mouseHoldState[which]?.down) {
          mouseHoldState[which].interval = setInterval(() => {
            if (mouseHoldState[which]?.down) doSplitAction();
          }, 50);
        }
      }, 130);
    } else {
      doEjectAction();
      mouseHoldState[which].interval = setInterval(() => {
        if (mouseHoldState[which]?.down) doEjectAction();
      }, 100);
    }
  });
  window.addEventListener("mouseup", function(event2) {
    clearMouseButton(event2.which);
  });
  window.addEventListener("mouseleave", () => {
    clearAllMouseHolds();
  });
  document.addEventListener("contextmenu", function(event2) {
    if (S.enableMouseClicks) event2.preventDefault();
  });
  onReady(function() {
    document.addEventListener("keydown", function(event2) {
      if (event2.keyCode === getBind(S, "menu")) {
        hideStatics();
        if (isOverlaysVisible()) {
          hideOverlays();
        } else {
          showOverlays();
        }
      }
    });
  });
  S.dpr = window.devicePixelRatio;
  function onTouchStart(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const size = ~~(S.canvasWidth / 7);
      if (touch.clientX * S.dpr > S.canvasWidth - size && touch.clientY * S.dpr > S.canvasHeight - size) {
        hooks.sendMouseMove();
        hooks.sendUint8(17);
        continue;
      }
      if (touch.clientX * S.dpr > S.canvasWidth - size && touch.clientY * S.dpr > S.canvasHeight - 2 * size - 10 && touch.clientY * S.dpr < S.canvasHeight - size - 10) {
        S.ejectPressedByTouch = true;
        if (!S.ejectInterval) {
          hooks.sendMouseMove();
          hooks.sendUint8(21);
          S.ejectInterval = setInterval(() => {
            if (S.ejectPressedByTouch && hooks.wsIsOpen()) {
              hooks.sendMouseMove();
              hooks.sendUint8(21);
            }
          }, 80);
        }
        continue;
      }
      if (S.leftTouchID < 0) {
        S.leftTouchID = touch.identifier;
        S.leftTouchStartPos.reset(touch.clientX * S.dpr, touch.clientY * S.dpr);
        S.leftTouchPos.copyFrom(S.leftTouchStartPos);
        S.leftVector.reset(0, 0);
      }
    }
    S.touches = e.touches;
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      if (!S.isPinching) {
        S.pinchZoomStartDistance = currentDistance;
        S.isPinching = true;
      } else {
        const delta = currentDistance - S.pinchZoomStartDistance;
        const zoomFactor = 1 + delta / 300;
        S.zoom *= zoomFactor;
        if (S.zoom < 0.3) S.zoom = 0.3;
        if (S.zoom > 4 / S.viewZoom) S.zoom = 4 / S.viewZoom;
        S.pinchZoomStartDistance = currentDistance;
      }
      return;
    }
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (S.leftTouchID === touch.identifier) {
        S.leftTouchPos.reset(touch.clientX * S.dpr, touch.clientY * S.dpr);
        S.leftVector.copyFrom(S.leftTouchPos);
        S.leftVector.minusEq(S.leftTouchStartPos);
        const distance = Math.sqrt(S.leftVector.x ** 2 + S.leftVector.y ** 2);
        if (distance > S.joystickRadius) {
          const scale = S.joystickRadius / distance;
          S.leftVector.x *= scale;
          S.leftVector.y *= scale;
          S.leftTouchPos.x = S.leftTouchStartPos.x + S.leftVector.x;
          S.leftTouchPos.y = S.leftTouchStartPos.y + S.leftVector.y;
        }
        S.rawMouseX = S.leftVector.x * 3 + S.canvasWidth / 2;
        S.rawMouseY = S.leftVector.y * 3 + S.canvasHeight / 2;
        mouseCoordinateChange(S);
        hooks.sendMouseMove();
      }
    }
    S.touches = e.touches;
  }
  function onTouchEnd(e) {
    if (e.touches.length < 2) {
      S.isPinching = false;
    }
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (S.leftTouchID === touch.identifier) {
        S.leftTouchID = -1;
        S.leftVector.reset(0, 0);
      }
      const size = ~~(S.canvasWidth / 7);
      if (touch.clientX * S.dpr > S.canvasWidth - size && touch.clientY * S.dpr > S.canvasHeight - 2 * size - 10 && touch.clientY * S.dpr < S.canvasHeight - size - 10) {
        S.ejectPressedByTouch = false;
        if (S.ejectInterval) {
          clearInterval(S.ejectInterval);
          S.ejectInterval = null;
        }
      }
    }
    if (e.touches.length === 0) {
      S.ejectPressedByTouch = false;
      if (S.ejectInterval) {
        clearInterval(S.ejectInterval);
        S.ejectInterval = null;
      }
    }
    S.touches = e.touches;
  }
  wHandle.onresize = () => canvasResize(S);
  canvasResize(S);
  wHandle.requestAnimationFrame(hooks.redrawGameScene);
  setInterval(hooks.sendMouseMove, 50);
  showOverlays();
  if (hooks.updateStats) setInterval(hooks.updateStats, 100);
  S.mainCanvas.focus();
  return { sendSticker, getBind: (action) => getBind(S, action) };
}
export {
  CELL_COLORS,
  attachInput,
  cancelKeybindCapture,
  initKeybindSettings,
  initMouseButtonSettings,
  initSettingsNav,
  keyCodeToLabel,
  loadKeybinds,
  loadMouseButtonSettings,
  renderKeybindUI,
  saveKeybinds,
  saveMouseButtonSettings,
  syncMouseBindSettingsVisibility
};