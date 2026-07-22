import { normalizeNick } from "../lib/nick.js";
const TOURNAMENT_PLAYERS = [
  "khirad",
  "\u041Eblad\u0430it",
  "\u0412\u0441\u0435\u043A\u043E\u043D\u0447\u0430\u043B",
  "bl1ck",
  "newlightchild",
  "morcov",
  "\u263CK\u263C",
  "\u0430\u0443",
  "v_potoke",
  "\u041F\u0430\u043F\u0430",
  "deffka",
  "\u043F\u0440\u043E\u0448\u043A\u0430",
  "griffin",
  "some no mai",
  "\u0410\u041B\u0418\u041A ))))",
  "Jeff",
  "PULIK",
  "salruz",
  "vaas",
  "aeris",
  "sorry",
  "\u043A\u0443\u0440\u0430\u0433\u0430",
  "\u{1D4D9}\u{1D4F2}\u{1D4F7}\u{1D501}",
  "\u029F\u1D07\u0262\u1D07\u0274\u1D05",
  "\u1D0B\u026A\u1D18\u029F\u1D07\u0274\u1D0B\u1D00\u{1FA90}",
  "\u{1D4D9}\u{1D4F2}\u{1D4F7}\u{1D501}"
];
const TOURNAMENT_WINNERS = ["Vaas", "\u041Eblad\u0430it"];
let deps = { S: null, hooks: {} };
function attachLeaderboard(S, hooks = {}) {
  deps = { S, hooks };
  return {
    createLeaderboardEntry,
    drawCustomLeaderBoard,
    drawLeaderBoard,
    getLeaderBoardRenderKey
  };
}
function getLeaderBoardRenderKey() {
  const S = deps.S;
  if (!S) return "";
  return S.leaderBoard.map((e) => `${e.id}|${e.name}|${e.level}|${e.xp}`).join("\n");
}
function createLeaderboardEntry(name, level, isMe, isSystemLine, b) {
  const S = deps.S;
  const hooks = deps.hooks;
  const entryDiv = document.createElement("div");
  const lowerName = (name || "").toLowerCase();
  const cleanName = name.replace(/<[^>]*>/g, "");
  const cleanNameLower = cleanName.toLowerCase();
  const isTournamentPlayer = TOURNAMENT_PLAYERS.some(
    (tourneyName) => tourneyName.toLowerCase() === cleanNameLower
  );
  const isWinner = TOURNAMENT_WINNERS.some((w) => w.toLowerCase() === cleanNameLower);
  const donators = S?.donators || [];
  if (!isSystemLine && donators.includes(lowerName)) {
    entryDiv.className = "Lednick " + lowerName;
  } else {
    entryDiv.className = "Lednick";
  }
  const numberHtml = isSystemLine ? "" : `${b + 1}. `;
  if (isSystemLine) entryDiv.style.textAlign = "center";
  if (isMe) {
    entryDiv.classList.add("Lednick--me");
  } else if (!isSystemLine && isTournamentPlayer) {
    entryDiv.style.color = "#FFD700";
  } else if (!isSystemLine) {
    entryDiv.style.color = "#FFFFFF";
  }
  const nameSpan = document.createElement("span");
  nameSpan.className = "Lednick-name";
  nameSpan.style.fontWeight = "400";
  nameSpan.innerHTML = String(name || "")
    .replace(/font-weight\s*:\s*[^;"']+;?/gi, "")
    .replace(/<\/?(?:b|strong)(?:\s[^>]*)?>/gi, "");
  if (!isSystemLine && isTournamentPlayer && !isWinner) {
    nameSpan.title = "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A \u0442\u0443\u0440\u043D\u0438\u0440\u0430";
  }
  if (!isSystemLine) {
    const resolveClan = hooks.resolveClanPassIdFromName;
    const resolvePlayer = hooks.resolvePlayerPassIdFromName;
    const clanPassId = resolveClan ? resolveClan(cleanName) : null;
    const playerPassId = resolvePlayer ? resolvePlayer(cleanName) : null;
    const passId = clanPassId || playerPassId;
    if (passId) {
      const profileBase = clanPassId ? hooks.STATS_CLAN_PROFILE_BASE || "https://agar.su/stats/clans/?id=" : hooks.STATS_PROFILE_BASE || "https://agar.su/stats/users/?id=";
      nameSpan.title = clanPassId ? "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u043A\u043B\u0430\u043D\u0430" : "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0438\u0433\u0440\u043E\u043A\u0430";
      nameSpan.style.cursor = "pointer";
      nameSpan.onclick = function(e) {
        e.stopPropagation();
        window.open(profileBase + encodeURIComponent(passId), "_blank");
      };
    }
  }
  const iconsContainer = document.createElement("span");
  if (level !== -1 && !isSystemLine) {
    const starContainer = document.createElement("div");
    starContainer.className = "star-container";
    if (hooks.createLevelIcon) {
      starContainer.appendChild(hooks.createLevelIcon(level, cleanName));
    }
    if (level < 200 && hooks.getStarClass) {
      const levelSpan = document.createElement("span");
      levelSpan.className = "levelme " + hooks.getStarClass(level);
      levelSpan.textContent = level;
      starContainer.appendChild(levelSpan);
    }
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.textContent = "XP: " + (S?.leaderBoard[b]?.xp || 0);
    starContainer.appendChild(tooltip);
    iconsContainer.appendChild(starContainer);
  }
  const youtubers = S?.youtubers || [];
  const urlYoutubers = S?.url_youtubers || [];
  const ytIndex = youtubers.indexOf(lowerName);
  if (!isSystemLine && ytIndex !== -1 && urlYoutubers[ytIndex]) {
    const ytLink = document.createElement("a");
    ytLink.href = urlYoutubers[ytIndex];
    ytLink.target = "_blank";
    ytLink.innerHTML = '<i class="fab fa-youtube"></i>';
    ytLink.style.color = "#ff0000";
    ytLink.title = "YouTube \u043A\u0430\u043D\u0430\u043B";
    iconsContainer.appendChild(ytLink);
  }
  if (!isSystemLine && donators.includes(lowerName)) {
    const donateIcon = document.createElement("div");
    donateIcon.title = "\u0414\u0430\u043D\u043D\u044B\u0439 \u0438\u0433\u0440\u043E\u043A \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0441\u043F\u043E\u043D\u0441\u043E\u0440\u043E\u043C Agar.su";
    donateIcon.style.width = "19px";
    donateIcon.style.height = "19px";
    donateIcon.style.backgroundImage = "url(/photo/mod.png)";
    donateIcon.style.backgroundSize = "cover";
    donateIcon.style.display = "inline-block";
    iconsContainer.appendChild(donateIcon);
  }
  if (!isSystemLine && isWinner) {
    const winnerIcon = document.createElement("div");
    winnerIcon.title = "\u{1F3C6} \u041F\u041E\u0411\u0415\u0414\u0418\u0422\u0415\u041B\u042C \u0422\u0423\u0420\u041D\u0418\u0420\u0410 \u{1F3C6}";
    winnerIcon.style.width = "18px";
    winnerIcon.style.height = "18px";
    winnerIcon.style.backgroundImage = "url(/photo/trophy.png)";
    winnerIcon.style.backgroundSize = "cover";
    winnerIcon.style.display = "inline-block";
    iconsContainer.appendChild(winnerIcon);
  }
  entryDiv.innerHTML = numberHtml;
  entryDiv.appendChild(iconsContainer);
  entryDiv.appendChild(nameSpan);
  return entryDiv;
}
function drawCustomLeaderBoard() {
  const S = deps.S;
  if (!S) return;
  const renderKey = getLeaderBoardRenderKey();
  if (renderKey === S.lastLeaderBoardRenderKey) return;
  S.lastLeaderBoardRenderKey = renderKey;
  const toplistDiv = document.getElementById("toplistnow");
  if (!toplistDiv) return;
  toplistDiv.innerHTML = "";
  if (!S.leaderBoard?.length) return;
  for (let b = 0; b < S.leaderBoard.length; ++b) {
    let name = S.leaderBoard[b].name || "\u0418\u0433\u0440\u043E\u043A";
    const isSystemLine = S.leaderBoard[b].id == null;
    let isMe = false;
    if (S.noRanking && S.leaderBoard[b].name) {
      const myName = S.playerCells[0]?.name || "";
      if (myName && myName.toLowerCase() === S.leaderBoard[b].name.toLowerCase()) {
        isMe = true;
      }
    }
    if (isMe) {
      const myCell = S.playerCells.find((cell) => cell.id === S.leaderBoard[b].id);
      if (myCell?.name) name = myCell.name;
    }
    name = name.replace(/\*(\d+)\*/g, (_match, p1) => {
      return `<span title="\u0421\u0435\u0440\u0438\u044F \u043F\u043E\u0431\u0435\u0434 \u043F\u043E\u0434\u0440\u044F\u0434" class="streak">${p1}</span>`;
    });
    if (b < 10) {
      const entryDiv = createLeaderboardEntry(
        name,
        S.leaderBoard[b].level,
        isMe,
        isSystemLine,
        b
      );
      toplistDiv.insertAdjacentHTML("beforeend", entryDiv.outerHTML);
    }
  }
}
function drawLeaderBoard() {
  const S = deps.S;
  const hooks = deps.hooks;
  if (!S) return;
  const renderKey = getLeaderBoardRenderKey();
  if (renderKey === S.lastLeaderBoardRenderKey) return;
  S.lastLeaderBoardRenderKey = renderKey;
  const toplistDiv = document.getElementById("toplistnow");
  if (!toplistDiv) return;
  toplistDiv.innerHTML = "";
  const displayedPlayers = 10;
  let myRank = null;
  if (!S.leaderBoard?.length) return;
  for (let b = 0; b < S.leaderBoard.length; ++b) {
    let name = S.leaderBoard[b].name || "\u0418\u0433\u0440\u043E\u043A";
    const level = S.leaderBoard[b].level;
    const isSystemLine = S.leaderBoard[b].id == null;
    let isMe = false;
    if (!isSystemLine) {
      isMe = S.playerCells.some((cell) => cell.id === S.leaderBoard[b].id);
    }
    if (S.noRanking && S.leaderBoard[b].name) {
      const myName = S.playerCells[0]?.name || "";
      if (myName && myName.toLowerCase() === S.leaderBoard[b].name.toLowerCase()) {
        isMe = true;
      }
    }
    if (isMe) {
      myRank = b + 1;
      const myCell = S.playerCells.find((cell) => cell.id === S.leaderBoard[b].id);
      if (myCell?.name) name = myCell.name;
    }
    if (b < displayedPlayers) {
      const entryDiv = createLeaderboardEntry(name, level, isMe, isSystemLine, b);
      toplistDiv.appendChild(entryDiv);
    }
  }
  if (myRank && myRank > displayedPlayers) {
    const level = S.accountData && hooks.getLevel ? hooks.getLevel(S.accountData.xp) : -1;
    const myName = S.playerCells[0]?.name || "\u0418\u0433\u0440\u043E\u043A";
    const myRankDiv = createLeaderboardEntry(myName, level, true, false, myRank - 1);
    toplistDiv.appendChild(myRankDiv);
  }
}
export {
  attachLeaderboard,
  createLeaderboardEntry,
  drawCustomLeaderBoard,
  drawLeaderBoard,
  getLeaderBoardRenderKey
};