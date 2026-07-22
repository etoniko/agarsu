import { bus, Events } from "../lib/events.js";
import { showOverlays } from "../lib/dom.js";
import { getAccountToken } from "../storage/local.js";
import { unmountPanel } from "./panels/mount.js";

const MENU_PANELS = ["home", "shop", "settings", "skinslist", "rating", "store"];
let showGen = 0;

async function resetPanelModule(id) {
  switch (id) {
    case "home":
      return (await import("./homePanel.js")).resetHomePanel();
    case "shop":
      return (await import("./shop.js")).resetShopPanel();
    case "settings":
      return (await import("./settings.js")).resetSettingsPanel();
    case "skinslist":
      return (await import("./skinsGallery.js")).resetSkinsGalleryPanel();
    case "rating":
      return (await import("./ratings.js")).resetRatingPanel();
    case "store":
      return (await import("./storePanel.js")).resetStorePanel();
    default:
      unmountPanel(id);
  }
}

async function unloadOtherPanels(activeId) {
  await Promise.all(
    MENU_PANELS.filter((id) => id !== activeId).map((id) => resetPanelModule(id))
  );
}

async function ensureActivePanel(id) {
  if (id === "home") {
    await (await import("./homePanel.js")).ensureHomePanel();
    return;
  }
  if (id === "skinslist") {
    await (await import("./skinsGallery.js")).initSkinsGallery();
    return;
  }
  if (id === "rating") {
    await (await import("./ratings.js")).ensureRatingPanel();
    return;
  }
  if (id === "shop") {
    await (await import("./shop.js")).ensureShopPanel();
    return;
  }
  if (id === "settings") {
    await (await import("./settings.js")).ensureSettingsPanel();
    return;
  }
  if (id === "store") {
    await (await import("./storePanel.js")).ensureStorePanel();
    return;
  }
}

async function showContent(id) {
  const gen = ++showGen;
  document.querySelectorAll(".menu-item").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".content").forEach((content) => content.classList.remove("active"));
  const menuItem = document.querySelector(`.menu-item[onclick="showContent('${id}')"]`);
  if (menuItem) menuItem.classList.add("active");

  await unloadOtherPanels(id);
  if (gen !== showGen) return;

  const panel = document.getElementById(id);
  if (panel) panel.classList.add("active");

  try {
    await ensureActivePanel(id);
  } catch (err) {
    console.error(id + " panel:", err);
  }
  if (gen !== showGen) return;

  if (typeof window.updateShopAuthNotice === "function") window.updateShopAuthNotice();
  bus.emit(Events.SHOW_CONTENT, { id });
}

function updateAccountMenuLabel() {
  const label = document.getElementById("accountMenuLabel");
  if (!label) return;
  label.textContent = getAccountToken() ? "\u041B\u041A" : "\u0412\u043E\u0439\u0442\u0438";
}
function initChatResize() {
  const chatWindow = document.getElementById("chatX_window");
  const chatContainer = document.getElementById("chatX_container");
  const chatBurger = document.getElementById("chatX_burger");
  const CHAT_SIZE_KEY = "chatX_size_v1";
  const CHAT_MIN_W = 220;
  const CHAT_MAX_W = 520;
  const CHAT_MIN_H = 120;
  function chatMaxHeight() {
    return Math.min(720, Math.floor(window.innerHeight * 0.85));
  }
  function applyChatSize(width, height, save) {
    if (!chatWindow) return;
    const w = Math.max(CHAT_MIN_W, Math.min(CHAT_MAX_W, width));
    const h = Math.max(CHAT_MIN_H, Math.min(chatMaxHeight(), height));
    chatWindow.style.width = w + "px";
    chatWindow.style.height = h + "px";
    if (save !== false) {
      localStorage.setItem(CHAT_SIZE_KEY, JSON.stringify({ w, h }));
    }
  }
  function loadChatSize() {
    try {
      const saved = JSON.parse(localStorage.getItem(CHAT_SIZE_KEY));
      if (saved && saved.w && saved.h) {
        applyChatSize(saved.w, saved.h, false);
      }
    } catch {
    }
  }
  function isPointerOverChat(clientX, clientY) {
    if (!chatWindow || chatWindow.style.display === "none") return false;
    const rect = chatWindow.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }
  let chatResizing = false;
  let chatResizeStartX = 0;
  let chatResizeStartY = 0;
  let chatResizeStartW = 0;
  let chatResizeStartH = 0;
  function startChatResize(e) {
    if (!chatBurger || !chatWindow) return;
    e.preventDefault();
    e.stopPropagation();
    chatResizing = true;
    chatResizeStartX = e.touches ? e.touches[0].clientX : e.clientX;
    chatResizeStartY = e.touches ? e.touches[0].clientY : e.clientY;
    chatResizeStartW = chatWindow.offsetWidth;
    chatResizeStartH = chatWindow.offsetHeight;
    document.body.style.userSelect = "none";
  }
  function doChatResize(e) {
    if (!chatResizing) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const newW = chatResizeStartW + (clientX - chatResizeStartX);
    const newH = chatResizeStartH - (clientY - chatResizeStartY);
    applyChatSize(newW, newH);
  }
  function stopChatResize() {
    chatResizing = false;
    document.body.style.userSelect = "";
  }
  if (chatBurger) {
    chatBurger.addEventListener("mousedown", startChatResize);
    chatBurger.addEventListener("touchstart", startChatResize, { passive: false });
  }
  document.addEventListener("mousemove", doChatResize);
  document.addEventListener("touchmove", doChatResize, { passive: false });
  document.addEventListener("mouseup", stopChatResize);
  document.addEventListener("touchend", stopChatResize);
  document.addEventListener(
    "wheel",
    (e) => {
      if (!isPointerOverChat(e.clientX, e.clientY) || !chatContainer) return;
      if (chatContainer.scrollHeight <= chatContainer.clientHeight) return;
      chatContainer.scrollTop += e.deltaY;
      e.preventDefault();
    },
    { passive: false }
  );
  loadChatSize();
  return { loadChatSize };
}
function initHudToggles() {
  document.querySelectorAll(".homemenu").forEach((el) => {
    el.addEventListener("click", () => {
      showOverlays();
    });
  });
}
function initOverlayMouseBridge() {
  const canvas = document.getElementById("canvas");
  const overlays = document.getElementById("overlays");
  if (!canvas || !overlays) return;
  overlays.addEventListener("mousemove", function(event) {
    const x = event.clientX - overlays.offsetLeft;
    const y = event.clientY - overlays.offsetTop;
    const canvasEvent = new MouseEvent("mousemove", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y
    });
    canvas.dispatchEvent(canvasEvent);
  });
}
function initChatNickInsert() {
  const chatFeed = document.getElementById("chatX_feed");
  const leaderboard = document.getElementById("leaderboard");
  const chatInput = document.getElementById("chat_textbox");
  if (!chatFeed || !leaderboard || !chatInput) return;
  function insertNick(nick) {
    nick = nick.trim().replace(/\s+/g, "\xA0");
    if (nick.endsWith(":")) nick = nick.slice(0, -1);
    chatInput.value = "@" + nick + " ";
    chatInput.focus();
    chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
  }
  chatFeed.addEventListener("click", (e) => {
    if (e.button !== 0) return;
    const msgElem = e.target.closest(".chatX_msg");
    if (!msgElem) return;
    const nickElem = msgElem.querySelector(".chatX_nick");
    if (!nickElem) return;
    insertNick(nickElem.textContent);
  });
  leaderboard.addEventListener("click", (e) => {
    if (e.button !== 0) return;
    const nickElem = e.target.closest(".Lednick span");
    if (!nickElem) return;
    insertNick(nickElem.textContent);
  });
  const emojiToggle = document.getElementById("emoji_toggle");
  if (emojiToggle && emojiToggle.dataset.wired !== "1") {
    emojiToggle.dataset.wired = "1";
    emojiToggle.addEventListener("click", () => {
      if (typeof window.toggleEmojiList === "function") window.toggleEmojiList();
      else import("./hudLazy.js").then((m) => m.toggleEmojiList());
    });
  }
}
async function initLobbyUi() {
  const { loadChatSize } = initChatResize();
  updateAccountMenuLabel();
  loadChatSize();
  initHudToggles();
  initOverlayMouseBridge();
  initChatNickInsert();
  const { initCenterShell } = await import("./centerShell.js");
  initCenterShell();
  const { initHudLazyGlobals } = await import("./hudLazy.js");
  initHudLazyGlobals();
}
window.showContent = showContent;
window.updateAccountMenuLabel = updateAccountMenuLabel;
export {
  initLobbyUi,
  showContent,
  updateAccountMenuLabel
};