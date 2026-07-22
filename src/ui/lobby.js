import { bus, Events } from "../lib/events.js";
import { hideStatics, showOverlays } from "../lib/dom.js";
import { getAccountToken } from "../storage/local.js";
function showContent(id) {
  document.querySelectorAll(".menu-item").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".content").forEach((content) => content.classList.remove("active"));
  const menuItem = document.querySelector(`.menu-item[onclick="showContent('${id}')"]`);
  if (menuItem) menuItem.classList.add("active");
  const panel = document.getElementById(id);
  if (panel) panel.classList.add("active");
  if (typeof window.updateShopAuthNotice === "function") window.updateShopAuthNotice();
  if (id === "skinslist" && typeof window.initSkinsGallery === "function") window.initSkinsGallery();
  bus.emit(Events.SHOW_CONTENT, { id });
}
function updateAccountMenuLabel() {
  const label = document.getElementById("accountMenuLabel");
  if (!label) return;
  label.textContent = getAccountToken() ? "\u041B\u041A" : "\u0412\u043E\u0439\u0442\u0438";
}
function showLogoutNotification() {
  const notif = document.getElementById("logout-notification");
  if (!notif) return;
  notif.style.display = "block";
  setTimeout(() => {
    notif.classList.add("show");
  }, 10);
  setTimeout(() => {
    notif.classList.remove("show");
    notif.addEventListener(
      "transitionend",
      () => {
        notif.style.display = "none";
      },
      { once: true }
    );
  }, 3e3);
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
  const onchat = document.getElementById("onchat");
  if (onchat) {
    onchat.addEventListener("click", () => {
      document.getElementById("chatX_window").style.display = "flex";
      onchat.style.display = "none";
    });
  }
  const onmap = document.getElementById("onmap");
  if (onmap) {
    onmap.addEventListener("click", () => {
      document.getElementById("map").style.display = "block";
      onmap.style.display = "none";
    });
  }
  const onleaderboard = document.getElementById("onleaderboard");
  if (onleaderboard) {
    onleaderboard.addEventListener("click", () => {
      document.getElementById("leaderboard").style.display = "block";
      onleaderboard.style.display = "none";
    });
  }
  const freezeBtn = document.getElementById("freeze");
  if (freezeBtn) {
    freezeBtn.addEventListener("click", function() {
      window.freeze = false;
      this.style.display = "none";
    });
  }
  document.querySelectorAll(".homemenu").forEach((el) => {
    el.addEventListener("click", () => {
      showOverlays();
    });
  });
  const closeStats = document.getElementById("closeStats");
  if (closeStats) {
    closeStats.addEventListener("click", () => {
      hideStatics();
      showOverlays();
    });
  }
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
  if (emojiToggle) {
    emojiToggle.addEventListener("click", () => {
      const list = document.querySelector("#chatX_window .emoji-list");
      if (!list) return;
      list.style.display = list.style.display === "flex" ? "none" : "flex";
    });
  }
  const emojiList = document.querySelector("#chatX_window .emoji-list");
  if (emojiList) {
    emojiList.addEventListener("click", (e) => {
      const emojiItem = e.target.closest(".emoji-item");
      if (!emojiItem) return;
      const emojiCode = emojiItem.dataset.code;
      const chatBox = document.getElementById("chat_textbox");
      if (chatBox) chatBox.value += emojiCode;
    });
  }
}
function initLobbyUi() {
  const { loadChatSize } = initChatResize();
  updateAccountMenuLabel();
  loadChatSize();
  initHudToggles();
  initOverlayMouseBridge();
  initChatNickInsert();
}
window.showContent = showContent;
window.updateAccountMenuLabel = updateAccountMenuLabel;
window.showLogoutNotification = showLogoutNotification;
export {
  initLobbyUi,
  showContent,
  showLogoutNotification,
  updateAccountMenuLabel
};