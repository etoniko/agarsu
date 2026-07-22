import staticsHtml from "./panels/statics.html?raw";

function mountHtml(html) {
  const wrap = document.createElement("div");
  wrap.innerHTML = html.trim();
  const el = wrap.firstElementChild;
  if (!el) return null;
  document.body.appendChild(el);
  return el;
}

function unmountById(id) {
  document.getElementById(id)?.remove();
}

const EMOJI_LIST_HTML = `<div class="emoji-list" id="emoji-list">
  <div class="emoji-item" data-code=":50:"><img src="/emoji/50.gif"></div>
  <div class="emoji-item" data-code=":253:"><img src="/emoji/253.gif"></div>
  <div class="emoji-item" data-code=":26:"><img src="/emoji/26.gif"></div>
  <div class="emoji-item" data-code=":104:"><img src="/emoji/104.png"></div>
  <div class="emoji-item" data-code=":105:"><img src="/emoji/105.png"></div>
  <div class="emoji-item" data-code=":92:"><img src="/emoji/92.png"></div>
  <div class="emoji-item" data-code=":5:"><img src="/emoji/5.png"></div>
</div>`;

function hideEmojiList() {
  document.getElementById("emoji-list")?.remove();
}

function showEmojiList() {
  if (document.getElementById("emoji-list")) return;
  const chat = document.getElementById("chatX_window");
  const emch = chat?.querySelector(".chatX_emch");
  if (!chat || !emch) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = EMOJI_LIST_HTML.trim();
  const list = wrap.firstElementChild;
  if (!list) return;
  chat.insertBefore(list, emch);
  list.style.display = "flex";
  list.addEventListener("click", (e) => {
    const emojiItem = e.target.closest(".emoji-item");
    if (!emojiItem) return;
    const emojiCode = emojiItem.dataset.code;
    const chatBox = document.getElementById("chat_textbox");
    if (chatBox && emojiCode) chatBox.value += emojiCode;
  });
}

function toggleEmojiList() {
  if (document.getElementById("emoji-list")) hideEmojiList();
  else showEmojiList();
}

function ensureOnChat() {
  if (document.getElementById("onchat")) return;
  const el = mountHtml('<div id="onchat"><i class="fa fa-message"></i></div>');
  if (!el) return;
  el.style.display = "flex";
  el.addEventListener("click", () => {
    const chat = document.getElementById("chatX_window");
    if (chat) chat.style.display = "flex";
    unmountById("onchat");
  });
}

function ensureOnMap() {
  if (document.getElementById("onmap")) return;
  const el = mountHtml('<div id="onmap"><i class="fa fa-compass"></i></div>');
  if (!el) return;
  el.style.display = "flex";
  el.addEventListener("click", () => {
    const map = document.getElementById("map");
    if (map) map.style.display = "block";
    unmountById("onmap");
  });
}

function ensureOnLeaderboard() {
  if (document.getElementById("onleaderboard")) return;
  const el = mountHtml('<div id="onleaderboard"><i class="fa fa-bar-chart"></i></div>');
  if (!el) return;
  el.style.display = "flex";
  el.addEventListener("click", () => {
    const lb = document.getElementById("leaderboard");
    if (lb) lb.style.display = "block";
    unmountById("onleaderboard");
  });
}

function showFreezeHud() {
  let el = document.getElementById("freeze");
  if (!el) {
    el = mountHtml('<div id="freeze">Pause <i class="fa fa-pause"></i></div>');
    el?.addEventListener("click", () => {
      if (typeof window !== "undefined") window.freeze = false;
      hideFreezeHud();
    });
  }
  if (el) el.style.display = "flex";
}

function hideFreezeHud() {
  unmountById("freeze");
}

function showBanBannerHud(remainingSec, reason, formatBanDuration) {
  let banner = document.getElementById("ban-banner");
  if (!banner) {
    banner = mountHtml(`<div id="ban-banner" class="ban-banner" role="alert">
    <div class="ban-banner-inner">
      <i class="fas fa-ban ban-banner-icon"></i>
      <div class="ban-banner-text">
        <div class="ban-banner-title">\u0414\u043E\u0441\u0442\u0443\u043F \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D</div>
        <div id="ban-banner-message"></div>
      </div>
    </div>
  </div>`);
  }
  const msgEl = document.getElementById("ban-banner-message");
  const text = `\u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C: ${formatBanDuration(remainingSec)}` + (reason ? `\n${reason}` : "");
  if (msgEl) msgEl.textContent = text;
  if (banner) banner.style.display = "block";
}

function hideBanBannerHud() {
  unmountById("ban-banner");
}

function showStaticsHud() {
  let el = document.getElementById("statics");
  if (!el) {
    el = mountHtml(staticsHtml);
    wireStaticsClose(el);
  }
  if (el) el.style.display = "flex";
  if (typeof window.__agarsuOnStaticsMounted === "function") {
    window.__agarsuOnStaticsMounted();
  }
  if (typeof window.__agarsuRepaintDeathStats === "function") {
    window.__agarsuRepaintDeathStats();
  }
  if (typeof window.chekstats === "function") {
    window.chekstats();
  }
  if (typeof window.updateShareText === "function") window.updateShareText();
  if (typeof window.renderDeathBanner === "function") window.renderDeathBanner();
}

function hideStaticsHud() {
  const el = document.getElementById("statics");
  if (el) el.style.display = "none";
}

function wireStaticsClose(root) {
  if (!root) return;
  const closeStats = root.querySelector("#closeStats, .closeStats");
  if (closeStats && closeStats.dataset.wired !== "1") {
    closeStats.dataset.wired = "1";
    closeStats.addEventListener("click", () => {
      hideStaticsHud();
      if (typeof window.showOverlays === "function") window.showOverlays();
      else {
        import("../lib/dom.js").then((m) => m.showOverlays());
      }
    });
  }
}

function initHudLazyGlobals() {
  window.showOnChat = ensureOnChat;
  window.showOnMap = ensureOnMap;
  window.showOnLeaderboard = ensureOnLeaderboard;
  window.hideOnChat = () => unmountById("onchat");
  window.hideOnMap = () => unmountById("onmap");
  window.hideOnLeaderboard = () => unmountById("onleaderboard");
  window.toggleEmojiList = toggleEmojiList;
  window.hideEmojiList = hideEmojiList;
  wireStaticsClose(document.getElementById("statics"));
}

initHudLazyGlobals();

export {
  ensureOnChat,
  ensureOnLeaderboard,
  ensureOnMap,
  hideBanBannerHud,
  hideEmojiList,
  hideFreezeHud,
  hideStaticsHud,
  initHudLazyGlobals,
  showBanBannerHud,
  showEmojiList,
  showFreezeHud,
  showStaticsHud,
  toggleEmojiList
};
