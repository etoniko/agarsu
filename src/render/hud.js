const scoreMessages = {
  low: [
    "\u041D\u0438\u0447\u0435\u0433\u043E, \u0437\u043E\u0432\u0438 \u0434\u0440\u0443\u0437\u0435\u0439 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0435\u0449\u0451 \u0440\u0430\u0437!",
    "\u0422\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0447\u0430\u043B\u043E! \u041F\u043E\u0434\u0435\u043B\u0438\u0441\u044C \u0441 \u0434\u0440\u0443\u0437\u044C\u044F\u043C\u0438 \u0438 \u0432\u0435\u0440\u043D\u0438\u0441\u044C \u0441\u0438\u043B\u044C\u043D\u044B\u043C!",
    "\u0411\u044B\u0441\u0442\u0440\u043E \u0443\u043C\u0435\u0440? \u0417\u043E\u0432\u0438 \u0434\u0440\u0443\u0437\u0435\u0439, \u043F\u0443\u0441\u0442\u044C \u043E\u043D\u0438 \u043F\u043E\u043A\u0430\u0436\u0443\u0442 \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u0442\u0432\u043E!",
    "\u041D\u0435 \u0440\u0430\u0441\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0439\u0441\u044F, \u043A\u0430\u0436\u0434\u0430\u044F \u0438\u0433\u0440\u0430 \u2014 \u044D\u0442\u043E \u043E\u043F\u044B\u0442. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0441\u043D\u043E\u0432\u0430!",
    "\u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u043F\u043E\u043C\u0435\u043D\u044F\u0442\u044C \u0444\u043E\u043D \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u2014 \u043C\u043E\u0436\u0435\u0442, \u043F\u043E\u043C\u043E\u0436\u0435\u0442!",
    "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 F, \u0447\u0442\u043E\u0431\u044B \u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C\u0441\u044F \u0438 \u043E\u0431\u0434\u0443\u043C\u0430\u0442\u044C \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044E!",
    "\u0422\u0435\u0440\u043F\u0435\u043D\u0438\u0435 \u0438 \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044F \u0432\u0430\u0436\u043D\u0435\u0435 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438!",
    "\u041D\u0430\u0436\u0438\u043C\u0430\u044F W \u2014 \u0432\u044B\u0434\u0435\u043B\u044F\u0435\u0442\u0441\u044F \u0446\u0435\u0448\u043A\u0430 (\u043C\u0430\u043B\u0435\u043D\u044C\u043A\u0430\u044F \u043C\u0430\u0441\u0441\u0430)."
  ],
  mid: [
    "\u041D\u0435\u043F\u043B\u043E\u0445\u043E! \u041F\u043E\u0437\u043E\u0432\u0438 \u0434\u0440\u0443\u0437\u0435\u0439 \u0438 \u0431\u0440\u043E\u0441\u044C\u0442\u0435 \u0434\u0440\u0443\u0433 \u0434\u0440\u0443\u0433\u0443 \u0432\u044B\u0437\u043E\u0432!",
    "\u0425\u043E\u0440\u043E\u0448\u0430\u044F \u0438\u0433\u0440\u0430! \u041F\u043E\u0434\u0435\u043B\u0438\u0441\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u043C \u0438 \u0437\u043E\u0432\u0438 \u0434\u0440\u0443\u0437\u0435\u0439!",
    "\u0422\u044B \u0443\u0436\u0435 \u043D\u0430 \u043F\u043E\u043B\u043F\u0443\u0442\u0438! \u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0439 \u0438 \u0443\u0434\u0438\u0432\u0438 \u0432\u0441\u0435\u0445!",
    "F \u2014 \u0434\u043B\u044F \u043F\u0430\u0443\u0437\u044B \u0438 \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u0438. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0441 \u0443\u043C\u043E\u043C!",
    "W \u2014 \u0446\u0435\u0448\u043A\u0430. \u041A\u043E\u0440\u043C\u0438 \u0432\u0440\u0430\u0433\u043E\u0432 \u0438\u043B\u0438 \u0437\u0430\u043C\u0430\u043D\u0438\u0432\u0430\u0439!"
  ],
  high: [
    "\u0412\u0430\u0443! \u041B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442! \u0414\u0435\u043B\u0438\u0441\u044C \u0441 \u0434\u0440\u0443\u0437\u044C\u044F\u043C\u0438!",
    "\u0422\u044B \u043D\u0430 \u0432\u0435\u0440\u0448\u0438\u043D\u0435! \u041F\u043E\u043A\u0430\u0436\u0438, \u043A\u0442\u043E \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u0439 \u0447\u0435\u043C\u043F\u0438\u043E\u043D!",
    "\u041F\u0440\u0435\u0432\u043E\u0441\u0445\u043E\u0434\u043D\u043E! \u041A\u0430\u0436\u0434\u044B\u0439 \u0448\u0430\u0433 \u2014 \u043A\u0430\u043A \u043F\u043E \u0443\u0447\u0435\u0431\u043D\u0438\u043A\u0443!",
    "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0444\u043E\u043D\u0430 \u2014 \u0442\u0432\u043E\u0439 \u0441\u0442\u0438\u043B\u044C, \u0442\u0432\u043E\u044F \u043A\u043E\u043D\u0446\u0435\u043D\u0442\u0440\u0430\u0446\u0438\u044F!",
    "F \u0432 \u043D\u0443\u0436\u043D\u044B\u0439 \u043C\u043E\u043C\u0435\u043D\u0442 \u2014 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u0434\u0430\u0436\u0435 \u043D\u0430 \u0432\u0435\u0440\u0448\u0438\u043D\u0435!",
    "\u0422\u044B \u2014 \u043C\u0430\u0441\u0442\u0435\u0440! \u0411\u0435\u0439 \u0440\u0435\u043A\u043E\u0440\u0434\u044B \u0434\u0430\u043B\u044C\u0448\u0435!"
  ]
};
function setPingDisplay(ping) {
  const pingElement = document.getElementById("ping");
  if (!pingElement) return;
  pingElement.textContent = ping;
  pingElement.classList.remove("ping-green", "ping-yellow", "ping-red");
  if (ping >= 0 && ping < 50) pingElement.classList.add("ping-green");
  else if (ping >= 50 && ping < 150) pingElement.classList.add("ping-yellow");
  else pingElement.classList.add("ping-red");
}
function setFpsDisplay(fps) {
  const el = document.getElementById("fps");
  if (el) el.textContent = fps;
}
function calcUserScore(S) {
  let score = 0;
  for (let i = 0; i < S.playerCells.length; i++) {
    score += S.playerCells[i].nSize * S.playerCells[i].nSize;
  }
  return score;
}
function updateStats(S) {
  const currentScore = Math.floor(calcUserScore(S) / 100);
  const cellCount = S.playerCells.length;
  if (currentScore > S.maxScore) {
    S.maxScore = currentScore;
    const elMax = document.getElementById("score-max");
    if (elMax) elMax.innerText = "\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C: " + S.maxScore;
  }
  const elCurrent = document.getElementById("score-new");
  if (elCurrent) {
    const prevScore = parseInt(elCurrent.innerText.match(/\d+/)?.[0] || "0", 10);
    if (currentScore !== prevScore) {
      elCurrent.innerText = "\u0421\u0435\u0439\u0447\u0430\u0441: " + currentScore;
    }
  }
  const elCells = document.getElementById("cell-length");
  if (elCells) {
    const prevCells = parseInt(elCells.innerText, 10) || 0;
    if (cellCount !== prevCells) {
      elCells.innerText = cellCount;
    }
  }
}
function getShareMessage(S) {
  const max = S.maxScore;
  const messages = max < 1e3 ? scoreMessages.low : max < 1e4 ? scoreMessages.mid : scoreMessages.high;
  return messages[Math.floor(Math.random() * messages.length)];
}
function updateShareText(S) {
  const el = document.getElementById("shareText");
  if (el) el.textContent = getShareMessage(S);
}
function getStatsText(S) {
  return `\u041C\u043E\u044F \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0432 Agar.su!
\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u043C\u0430\u0441\u0441\u0430: ${S.maxScore}
\u0412\u0440\u0435\u043C\u044F \u0438\u0433\u0440\u044B: ${Date.now()}`;
}
function shareStats(platform, S) {
  const text = encodeURIComponent(getStatsText(S));
  const url = encodeURIComponent(location.href);
  const urls = {
    vk: `https://vk.com/share.php?url=${url}&title=${text}`,
    telegram: `https://t.me/share/url?url=${url}&text=${text}`,
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`,
    twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`
  };
  const w = 650;
  const h = 450;
  const left = (screen.width - w) / 2;
  const top = (screen.height - h) / 2;
  window.open(
    urls[platform] || "",
    "_blank",
    `width=${w},height=${h},top=${top},left=${left},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
  );
}
function initShareHandlers(S) {
  updateShareText(S);
  ["vk", "telegram", "whatsapp", "facebook", "twitter"].forEach((p) => {
    const btn = document.querySelector(`.${p}`);
    if (btn) btn.addEventListener("click", () => shareStats(p, S));
  });
}
export {
  calcUserScore,
  getShareMessage,
  getStatsText,
  initShareHandlers,
  scoreMessages,
  setFpsDisplay,
  setPingDisplay,
  shareStats,
  updateShareText,
  updateStats
};