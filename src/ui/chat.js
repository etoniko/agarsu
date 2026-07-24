import { normalizeNick } from "../lib/nick.js";
import { censorText, countHits } from "../lib/antimat.js";
import { SKIN_FALLBACK_URL } from "../config/endpoints.js";
import { setImgSrc } from "../render/skins.js";
import { getLevel } from "../game/stats.js";
const DONATORS = ["bambule", "\u263Ck\u263C"];
const YOUTUBERS = ["salruz", "morcov", "sealand"];
const URL_YOUTUBERS = [
  "https://youtube.com/@SalRuzO",
  "https://www.youtube.com/@MORCCVA",
  "https://www.youtube.com/@sealandv"
];
function focusChatInput() {
  const el = document.getElementById("chat_textbox");
  if (el) el.focus();
}
function clearChatInput() {
  const el = document.getElementById("chat_textbox");
  if (el) el.value = "";
}
function getChatInputValue() {
  const el = document.getElementById("chat_textbox");
  return el ? el.value : "";
}
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
function censorMessage(S, message) {
  if (S.showAdultContent) return message;
  if (!S.badWordsSet || S.badWordsSet.size === 0) {
    console.warn("\u0421\u043F\u0438\u0441\u043E\u043A \u043C\u0430\u0442\u0435\u0440\u043D\u044B\u0445 \u0441\u043B\u043E\u0432 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D. \u0410\u043D\u0442\u0438\u043C\u0430\u0442 \u043D\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442.");
    return message;
  }
  return censorText(S.badWordsSet, message);
}
function countProfanity(S, message) {
  if (!S.badWordsSet || S.badWordsSet.size === 0) return 0;
  if (S.showAdultContent) return 0;
  return countHits(S.badWordsSet, message);
}
function shouldBlurAndRecord(S, pId, message) {
  if (S.showAdultContent) return false;
  if (pId === 0 || pId === "0") return false;
  const now = Date.now();
  const hits = countProfanity(S, message);
  let data = S.profanityCountByPlayer.get(pId) || { count: 0, lastTime: now };
  if (now - data.lastTime > S.RESET_TIME) {
    data.count = 0;
  }
  data.count += hits;
  data.lastTime = now;
  S.profanityCountByPlayer.set(pId, data);
  return data.count >= S.BLUR_THRESHOLD;
}
function highlightMentions(text) {
  text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text.replace(
    /@((?:[^\s@]|\u00A0)+)/g,
    '<span class="mention">@$1</span>'
  );
}
function replaceEmojis(text) {
  const gifEmojis = [50, 253, 26];
  return text.replace(/:([0-9]+):/g, (match, p1) => {
    const num = Number(p1);
    const ext = gifEmojis.includes(num) ? "gif" : "png";
    return `<img class="chat-emoji" src="/emoji/${num}.${ext}">`;
  });
}
function createDialog(S, hooks, number, senderName, senderAvatar) {
  const dialogId = `!ls${number}`;
  if (S.dialogs[dialogId]) return;
  const dialogDiv = document.createElement("div");
  dialogDiv.className = "chatX_feed";
  dialogDiv.id = dialogId;
  dialogDiv.style.display = "none";
  document.getElementById("chatX_container").appendChild(dialogDiv);
  const avatarContainer = document.createElement("div");
  avatarContainer.className = "chatX_top_avatar";
  const avatar = document.createElement("img");
  avatar.className = "chatX_avatar_private";
  setImgSrc(avatar, senderAvatar || SKIN_FALLBACK_URL);
  avatar.onerror = () => {
    if (!avatar.dataset.fallback) {
      avatar.dataset.fallback = "1";
      setImgSrc(avatar, SKIN_FALLBACK_URL);
    }
  };
  avatar.title = senderName || `User ${number}`;
  avatarContainer.appendChild(avatar);
  avatarContainer.addEventListener("click", () => switchToDialog(S, dialogId));
  document.getElementById("chatX_top").appendChild(avatarContainer);
  S.dialogs[dialogId] = { div: dialogDiv, avatar: avatarContainer };
  S.dialogMessages[dialogId] = [];
}
function switchToDialog(S, dialogId) {
  document.getElementById("chatX_feed").style.display = "none";
  Object.values(S.dialogs).forEach((d) => {
    d.div.style.display = "none";
  });
  if (!dialogId) {
    document.getElementById("chatX_feed").style.display = "flex";
    S.activeDialog = null;
  } else if (S.dialogs[dialogId]) {
    S.dialogs[dialogId].div.style.display = "flex";
    S.activeDialog = dialogId;
  }
  const chatInput = document.getElementById("ls");
  if (S.activeDialog) {
    const dialogNumberMatch = S.activeDialog.match(/^!ls(\d+)$/);
    chatInput.value = dialogNumberMatch ? `!ls${dialogNumberMatch[1]} ` : "";
  } else chatInput.value = "";
}
function openPvPModal(S, hooks, targetId, targetName) {
  const modal = document.createElement("div");
  modal.id = "pvpModal";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.background = "rgba(0,0,0,0.5)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "9999";
  const box = document.createElement("div");
  box.style.background = "#1e1e1e";
  box.style.padding = "20px";
  box.style.borderRadius = "8px";
  box.style.color = "#fff";
  box.style.minWidth = "300px";
  box.innerHTML = `<h3>\u041F\u043E\u0437\u0432\u0430\u0442\u044C ${targetName} \u043D\u0430 PvP</h3>
                     <p>\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0435\u0440\u0432\u0435\u0440:</p>`;
  const servers = [
    { name: "FFA 1vs1", address: "ffa.agar.su:6004" },
    { name: "MS 2vs2", address: "ffa.agar.su:6005" },
    { name: "Tournament", address: "ffa.agar.su:6006" }
  ];
  servers.forEach((server) => {
    const btn = document.createElement("button");
    btn.textContent = server.name;
    btn.style.margin = "5px";
    btn.style.padding = "8px 16px";
    btn.style.cursor = "pointer";
    btn.style.background = "#2c2c2c";
    btn.style.border = "none";
    btn.style.borderRadius = "4px";
    btn.style.color = "#fff";
    btn.onmouseover = () => {
      btn.style.background = "#3c3c3c";
    };
    btn.onmouseout = () => {
      btn.style.background = "#2c2c2c";
    };
    btn.onclick = () => {
      sendPvPInvite(S, hooks, targetId, server.address);
      modal.remove();
    };
    box.appendChild(btn);
  });
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "\u041E\u0442\u043C\u0435\u043D\u0430";
  cancelBtn.style.marginTop = "10px";
  cancelBtn.style.padding = "8px 16px";
  cancelBtn.style.cursor = "pointer";
  cancelBtn.style.background = "#6c6c6c";
  cancelBtn.style.border = "none";
  cancelBtn.style.borderRadius = "4px";
  cancelBtn.style.color = "#fff";
  cancelBtn.onclick = () => modal.remove();
  box.appendChild(cancelBtn);
  modal.appendChild(box);
  document.body.appendChild(modal);
}
function sendPvPInvite(S, hooks, targetId, server, isAccept = false) {
  const msg = isAccept ? `PvPInvite;${server};accept` : `PvPInvite;${server}`;
  hooks.sendChat(`!ls${targetId} ${msg}`);
}
function showPvPConfirm(S, hooks, playerId, playerName, server) {
  const modal = document.createElement("div");
  modal.id = "pvpConfirmModal";
  const box = document.createElement("div");
  box.style.background = "#1e1e1e";
  box.style.padding = "20px";
  box.style.borderRadius = "8px";
  box.style.color = "#fff";
  box.style.minWidth = "300px";
  box.innerHTML = `<h3>${playerName} \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0430\u0435\u0442 \u043D\u0430 PvP</h3>`;
  const acceptBtn = document.createElement("button");
  acceptBtn.textContent = "\u041F\u0440\u0438\u043D\u044F\u0442\u044C";
  acceptBtn.onclick = () => {
    sendPvPInvite(S, hooks, playerId, server, true);
    hooks.setserver(server);
    modal.remove();
  };
  box.appendChild(acceptBtn);
  const rejectBtn = document.createElement("button");
  rejectBtn.textContent = "\u041E\u0442\u043A\u0430\u0437\u0430\u0442\u044C";
  rejectBtn.onclick = () => modal.remove();
  box.appendChild(rejectBtn);
  modal.appendChild(box);
  document.body.appendChild(modal);
}
function drawChatBoard(S, hooks) {
  if (S.hideChat) return;
  const rendered = S.chatRenderedCount || 0;
  if (rendered >= S.chatBoard.length) return;
  for (let i = rendered; i < S.chatBoard.length; i++) {
    renderChatMessage(S, hooks, S.chatBoard[i], i);
  }
  S.chatRenderedCount = S.chatBoard.length;
}
function isScrollNearBottom(el) {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}
function scrollChatToLatest(targetDiv) {
  if (!targetDiv) return;
  requestAnimationFrame(() => {
    const scrollEl = (el) => {
      if (!el || el.scrollHeight <= el.clientHeight) return;
      el.scrollTop = el.scrollHeight;
    };
    scrollEl(targetDiv);
    const container = document.getElementById("chatX_container");
    if (container && container !== targetDiv) {
      if (getComputedStyle(container).flexDirection === "column-reverse") {
        container.scrollTop = 0;
      } else {
        scrollEl(container);
      }
    }
  });
}
function bindChatScrollTracking(S) {
  const feed = document.getElementById("chatX_feed");
  const container = document.getElementById("chatX_container");
  if (S.chatScrollBound) return;
  S.chatScrollBound = true;
  S.chatStickToBottom = true;
  const onScroll = (el) => {
    if (!el) return;
    S.chatStickToBottom = isScrollNearBottom(el);
  };
  feed?.addEventListener("scroll", () => onScroll(feed), { passive: true });
  container?.addEventListener("scroll", () => onScroll(container), { passive: true });
}
function renderChatMessage(S, hooks, lastMessage, msgIndex) {
  if (!lastMessage) return;
  if (lastMessage.message && lastMessage.message.toLowerCase().includes("\u0432o\u0448\u0451\u043B \u0432 \u0438\u0433\u0440\u0443")) {
    const simpleDiv = document.createElement("div");
    simpleDiv.className = "chatexit";
    const nameSpan = document.createElement("span");
    nameSpan.style.color = lastMessage.color || "#b8c0cc";
    nameSpan.textContent = `${lastMessage.name}:`;
    simpleDiv.appendChild(nameSpan);
    simpleDiv.append(` ${lastMessage.message}`);
    document.getElementById("chatX_feed").appendChild(simpleDiv);
    if (S.chatStickToBottom !== false) scrollChatToLatest(document.getElementById("chatX_feed"));
    return;
  }
  if (S.ignoredPlayers.has(lastMessage.pId)) return;
  let targetDiv = null;
  const messageRaw = (lastMessage.message || "").trim();
  const privateMatch = messageRaw.match(/^!ls(\d+)\s+(.+)/i);
  if (privateMatch && !privateMatch[2].startsWith("PvPInvite;")) {
    targetDiv = S.dialogs[`!ls${privateMatch[1]}`]?.div;
  }
  if (!targetDiv) targetDiv = document.getElementById("chatX_feed");
  if (targetDiv?.querySelector(`[data-chat-idx="${msgIndex}"]`)) return;
  const msgDiv = document.createElement("div");
  msgDiv.setAttribute("data-id", lastMessage.pId);
  msgDiv.dataset.chatIdx = String(msgIndex);
  const lowerName = lastMessage.name.toLowerCase();
  if (DONATORS.includes(lowerName)) msgDiv.className = "chatX_msg " + lowerName;
  else msgDiv.className = "chatX_msg";
  const normalizedName = normalizeNick(lastMessage.name || "");
  let targetDialogId = null;
  let messageContent = messageRaw;
  if (privateMatch) {
    const number = privateMatch[1];
    messageContent = privateMatch[2];
    if (!messageContent.startsWith("PvPInvite;")) {
      targetDialogId = `!ls${number}`;
      createDialog(
        S,
        hooks,
        number,
        lastMessage.name,
        S.skinList[normalizedName] ? `https://api.agar.su/skins/${S.skinList[normalizedName]}.png` : "https://api.agar.su/skins/4.png"
      );
      targetDiv = S.dialogs[targetDialogId]?.div || targetDiv;
    }
  }
  if (!targetDiv) targetDiv = document.getElementById("chatX_feed");
  const avatarContainer = document.createElement("div");
  avatarContainer.className = "avatarXcontainer";
  if (S.passUsers.includes(normalizedName)) {
    avatarContainer.style.setProperty("--after-display", "block");
  }
  const avatar = document.createElement("img");
  avatar.className = "chatX_avatar";
  avatar.decoding = "async";
  avatar.loading = "lazy";
  const skinId = S.skinList[normalizedName];
  setImgSrc(avatar, skinId ? hooks.getSkinImageUrl(skinId) : SKIN_FALLBACK_URL);
  avatar.onerror = () => {
    if (!avatar.dataset.fallback) {
      avatar.dataset.fallback = "1";
      setImgSrc(avatar, SKIN_FALLBACK_URL);
    }
  };
  avatarContainer.appendChild(avatar);
  msgDiv.appendChild(avatarContainer);
  const nameContainer = document.createElement("div");
  nameContainer.className = "chatX_name_container";
  if (typeof lastMessage.playerLevel === "number" && lastMessage.playerLevel > 0) {
    const levelContainer = document.createElement("div");
    levelContainer.className = "star-container";
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.textContent = `XP: ${lastMessage.playerXp}`;
    levelContainer.appendChild(hooks.createLevelIcon(lastMessage.playerLevel, lastMessage.name));
    if (lastMessage.playerLevel < 200) {
      const levelSpan = document.createElement("span");
      levelSpan.className = "levelme " + hooks.getStarClass(lastMessage.playerLevel);
      levelSpan.textContent = lastMessage.playerLevel;
      levelContainer.appendChild(levelSpan);
    }
    levelContainer.appendChild(tooltip);
    nameContainer.appendChild(levelContainer);
  }
  const ytIndex = YOUTUBERS.indexOf(lowerName);
  if (ytIndex !== -1 && URL_YOUTUBERS[ytIndex]) {
    const ytLink = document.createElement("a");
    ytLink.href = URL_YOUTUBERS[ytIndex];
    ytLink.target = "_blank";
    ytLink.innerHTML = '<i class="fab fa-youtube"></i>';
    ytLink.style.color = "#ff0000";
    ytLink.title = "YouTube \u043A\u0430\u043D\u0430\u043B";
    nameContainer.appendChild(ytLink);
  }
  if (DONATORS.includes(lowerName)) {
    const donateIcon = document.createElement("div");
    donateIcon.title = "\u0414\u0430\u043D\u043D\u044B\u0439 \u0438\u0433\u0440\u043E\u043A \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0441\u043F\u043E\u043D\u0441\u043E\u0440\u043E\u043C Agar.su";
    donateIcon.style.width = "19px";
    donateIcon.style.height = "19px";
    donateIcon.style.backgroundImage = "url(/photo/mod.png)";
    donateIcon.style.backgroundSize = "cover";
    donateIcon.style.display = "inline-block";
    nameContainer.appendChild(donateIcon);
  }
  const nameDiv = document.createElement("div");
  nameDiv.className = "chatX_nick";
  const safeName = censorMessage(S, lastMessage.name);
  nameDiv.textContent = safeName + ":";
  if (targetDialogId) {
    nameDiv.style.color = lastMessage.color || "#b8c0cc";
    nameDiv.title = "\u041B\u0438\u0447\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435";
  } else {
    nameDiv.style.color = lastMessage.color || "#b8c0cc";
    avatar.style.border = `2px solid ${lastMessage.color}`;
    avatar.style.background = `${lastMessage.color}`;
    nameDiv.title = DONATORS.includes(lowerName) ? `${lastMessage.pId} (\u0414\u043E\u043D\u0430\u0442\u0435\u0440)` : `${lastMessage.pId || 0}`;
  }
  nameContainer.appendChild(nameDiv);
  msgDiv.appendChild(nameContainer);
  const textDiv = document.createElement("div");
  textDiv.className = "chatX_text";
  if (messageContent.startsWith("PvPInvite;") && !messageContent.endsWith(";accept")) {
    const server = messageContent.split(";")[1];
    showPvPConfirm(S, hooks, lastMessage.pId, lastMessage.name, server);
    return;
  }
  if (messageContent.startsWith("PvPInvite;") && messageContent.endsWith(";accept")) {
    const server = messageContent.split(";")[1];
    hooks.setserver(server);
    return;
  }
  const safeHtml = replaceEmojis(highlightMentions(censorMessage(S, messageContent)));
  textDiv.innerHTML = safeHtml;
  if (shouldBlurAndRecord(S, lastMessage.pId, messageContent)) {
    msgDiv.classList.add("blurred");
    msgDiv.title = "\u0421\u043A\u0440\u044B\u0442\u043E \u0438\u0437-\u0437\u0430 \u0442\u043E\u043A\u0441\u0438\u0447\u043D\u043E\u0441\u0442\u0438. \u041D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C.";
    textDiv.style.cursor = "pointer";
    textDiv.title = "\u041D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435";
    textDiv.addEventListener("click", function revealHandler(e) {
      if (msgDiv.classList.contains("blurred")) {
        e.stopPropagation();
        msgDiv.classList.remove("blurred");
        textDiv.classList.add("revealed");
        msgDiv.title = "";
        textDiv.title = "";
        textDiv.style.cursor = "default";
      }
    });
  }
  msgDiv.appendChild(textDiv);
  const timeDiv = document.createElement("div");
  timeDiv.className = "chatX_time";
  timeDiv.textContent = lastMessage.time || "";
  msgDiv.appendChild(timeDiv);
  msgDiv.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    document.querySelectorAll(".chat-context-menu").forEach((m) => m.remove());
    const menu = document.createElement("div");
    menu.className = "chat-context-menu";
    menu.style.top = e.clientY + "px";
    menu.style.left = e.clientX + "px";
    const playerId = lastMessage.pId;
    const pmBtn = document.createElement("div");
    pmBtn.textContent = "\u041B\u0438\u0447\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435";
    pmBtn.style.cursor = "pointer";
    pmBtn.onclick = () => {
      createDialog(
        S,
        hooks,
        playerId,
        lastMessage.name,
        S.skinList[normalizeNick(lastMessage.name)] ? `https://api.agar.su/skins/${S.skinList[normalizeNick(lastMessage.name)]}.png` : "https://api.agar.su/skins/4.png"
      );
      switchToDialog(S, `!ls${playerId}`);
      menu.remove();
    };
    const ignoreBtn = document.createElement("div");
    ignoreBtn.textContent = "\u0418\u0433\u043D\u043E\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C";
    ignoreBtn.style.cursor = "pointer";
    ignoreBtn.onclick = () => {
      S.ignoredPlayers.add(playerId);
      msgDiv.remove();
      menu.remove();
    };
    const clearIgnoreBtn = document.createElement("div");
    clearIgnoreBtn.textContent = "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0441\u0435\u0445 \u0438\u0437 \u0438\u0433\u043D\u043E\u0440\u0430";
    clearIgnoreBtn.style.cursor = "pointer";
    clearIgnoreBtn.onclick = () => {
      S.ignoredPlayers.clear();
      menu.remove();
    };
    const delMsgBtn = document.createElement("div");
    delMsgBtn.textContent = "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435";
    delMsgBtn.style.cursor = "pointer";
    delMsgBtn.onclick = () => {
      msgDiv.remove();
      menu.remove();
    };
    const delAllBtn = document.createElement("div");
    delAllBtn.textContent = "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0441\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0438\u0433\u0440\u043E\u043A\u0430";
    delAllBtn.style.cursor = "pointer";
    delAllBtn.onclick = () => {
      [...targetDiv.children].forEach((c) => {
        if (c.querySelector(".chatX_nick")?.title.includes(playerId)) c.remove();
      });
      menu.remove();
    };
    const pvpBtn = document.createElement("div");
    pvpBtn.textContent = "\u041F\u043E\u0437\u0432\u0430\u0442\u044C \u043D\u0430 PvP";
    pvpBtn.style.cursor = "pointer";
    pvpBtn.onclick = () => {
      openPvPModal(S, hooks, lastMessage.pId, lastMessage.name);
      menu.remove();
    };
    menu.appendChild(pvpBtn);
    menu.appendChild(pmBtn);
    menu.appendChild(ignoreBtn);
    menu.appendChild(clearIgnoreBtn);
    menu.appendChild(delMsgBtn);
    menu.appendChild(delAllBtn);
    document.body.appendChild(menu);
    const closeMenu = (event) => {
      if (!menu.contains(event.target)) menu.remove();
    };
    document.addEventListener("click", closeMenu, { once: true });
  });
  targetDiv.appendChild(msgDiv);
  const stickToBottom = targetDialogId ? true : S.chatStickToBottom !== false;
  if (stickToBottom) {
    scrollChatToLatest(targetDiv);
  }
  if (targetDialogId && S.dialogs[targetDialogId]) {
    S.dialogMessages[targetDialogId].push(msgDiv);
    const topAvatarImg = S.dialogs[targetDialogId].avatar.querySelector("img");
    if (topAvatarImg) {
      const avatarUrl = S.skinList[normalizedName] ? hooks.getSkinImageUrl(S.skinList[normalizedName]) : SKIN_FALLBACK_URL;
      setImgSrc(topAvatarImg, avatarUrl);
      topAvatarImg.title = lastMessage.name || `User ${targetDialogId.replace("!ls", "")}`;
    }
  }
  if (targetDialogId) {
    while (targetDiv.children.length > S.maxDialogMessages) targetDiv.removeChild(targetDiv.firstChild);
  } else {
    while (targetDiv.children.length > S.maxGlobalMessages) targetDiv.removeChild(targetDiv.firstChild);
  }
  const chatInput = document.getElementById("ls");
  if (S.activeDialog) {
    const dialogNumberMatch = S.activeDialog.match(/^!ls(\d+)$/);
    if (dialogNumberMatch) {
      const number = dialogNumberMatch[1];
      const currentText = chatInput.value.replace(/^!ls\d+\s*/, "");
      chatInput.value = `!ls${number} ${currentText}`;
    }
  }
}
function addChat(S, hooks, view, offset) {
  function getString() {
    let text = "";
    let char;
    while ((char = view.getUint16(offset, true)) != 0) {
      offset += 2;
      text += String.fromCharCode(char);
    }
    offset += 2;
    return text;
  }
  view.getUint8(offset++);
  let r = view.getUint8(offset++);
  let g = view.getUint8(offset++);
  let b = view.getUint8(offset++);
  let color = (r << 16 | g << 8 | b).toString(16);
  while (color.length < 6) {
    color = "0" + color;
  }
  const playerXp = view.getUint32(offset, true);
  offset += 4;
  const pId = view.getUint16(offset, true);
  offset += 2;
  color = "#" + color;
  S.chatBoard.push({
    pId,
    playerXp,
    playerLevel: playerXp ? getLevel(playerXp) : -1,
    name: getString(),
    color,
    message: getString(),
    time: formatTime(new Date())
  });
  drawChatBoard(S, hooks);
  return offset;
}
function attachChat(S, hooks) {
  S.donators = DONATORS;
  S.youtubers = YOUTUBERS;
  S.url_youtubers = URL_YOUTUBERS;
  S.passUsers = S.passUsers || [];
  S.passPlayerNickToId = S.passPlayerNickToId || new Map();
  S.passClanNickToId = S.passClanNickToId || new Map();
  S.ignoredPlayers = S.ignoredPlayers || new Set();
  S.activeDialog = S.activeDialog || null;
  S.dialogs = S.dialogs || {};
  S.dialogMessages = S.dialogMessages || {};
  S.profanityCountByPlayer = S.profanityCountByPlayer || new Map();
  S.maxGlobalMessages = S.maxGlobalMessages ?? 50;
  S.maxDialogMessages = S.maxDialogMessages ?? 100;
  if (typeof S.chatRenderedCount !== "number") S.chatRenderedCount = 0;
  bindChatScrollTracking(S);
  S.wHandle.switchToDialog = (dialogId) => switchToDialog(S, dialogId);
  const chatHooks = {
    ...hooks,
    sendChat: hooks.sendChat,
    setserver: hooks.setserver
  };
  return {
    addChat: (view, offset) => addChat(S, chatHooks, view, offset),
    drawChatBoard: () => drawChatBoard(S, chatHooks),
    censorMessage: (msg) => censorMessage(S, msg),
    switchToDialog: (dialogId) => switchToDialog(S, dialogId)
  };
}
function resolveClanPassIdFromName(S, name) {
  const clean = String(name || "").replace(/<[^>]*>/g, "");
  const m = clean.match(/^\[([^\]]+)\]/);
  if (!m) return null;
  const clanKey = normalizeNick(`[${m[1]}]`);
  if (!clanKey) return null;
  return S.passClanNickToId.get(clanKey) || null;
}
function resolvePlayerPassIdFromName(S, name) {
  const clean = String(name || "").replace(/<[^>]*>/g, "");
  const m = clean.match(/^\[([^\]]+)\](.*)$/);
  if (m) return null;
  const norm = normalizeNick(clean);
  if (!norm || norm.startsWith("[")) return null;
  return S.passPlayerNickToId.get(norm) || null;
}
function resolvePassId(S, name) {
  return resolveClanPassIdFromName(S, name) || resolvePlayerPassIdFromName(S, name);
}
export {
  addChat,
  attachChat,
  censorMessage,
  clearChatInput,
  drawChatBoard,
  focusChatInput,
  getChatInputValue,
  resolveClanPassIdFromName,
  resolvePassId,
  resolvePlayerPassIdFromName,
  switchToDialog
};