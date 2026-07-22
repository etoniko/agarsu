import { TOP100_URL, SKIN_FALLBACK_URL } from "../config/endpoints.js";
import { unmountPanel } from "./panels/mount.js";
const getLevel = (xp) => ~~((xp / 100 * 2) ** 0.5);
let ratingFetchStarted = false;
let ratingFetchDone = false;
let cachedRating = null;
function resolveAccountAvatar(raw) {
  if (!raw) return SKIN_FALLBACK_URL;
  const url = String(raw).trim();
  if (/^https?:\/\//i.test(url)) return url;
  return SKIN_FALLBACK_URL;
}
function mountRatingPanel() {
  const panel = document.getElementById("rating");
  if (!panel || panel.dataset.mounted === "1") return panel;
  panel.innerHTML = `
          <div class="top-info">
            <div><span>\u041B\u0443\u0447\u0448\u0438\u0435 \u0418\u0433\u0440\u043E\u043A\u0438</span></div>
          </div>
          <div class="header-row">
            <div class="cell">\u041F\u043E\u0437\u0438\u0446\u0438\u044F</div>
            <div class="cell nr">\u041D\u0438\u043A</div>
            <div class="cell">\u0423\u0440\u043E\u0432\u0435\u043D\u044C</div>
            <div class="cell">\u0410\u0432\u0430\u0442\u0430\u0440</div>
          </div>
          <div id="table-container"></div>`;
  panel.dataset.mounted = "1";
  return panel;
}
function xpStats(xstats) {
  const container = document.getElementById("table-container");
  if (!container) return;
  container.innerHTML = "";
  xstats.forEach((player) => {
    const level = getLevel(player.xp);
    const avatar = resolveAccountAvatar(player.account_avatar);
    const playerDiv = document.createElement("div");
    playerDiv.classList.add("top-player");
    playerDiv.innerHTML = `
<div class="time">${player.position}</div>
<div class="nick">${player.account_name}</div>
<div class="score">${level}</div>
<div class="skkinn" style="background-image: url('${avatar.replace(/'/g, "%27")}');"></div>
                `;
    container.appendChild(playerDiv);
  });
}
async function fetchTop100() {
  try {
    const res = await fetch(TOP100_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("top100 " + res.status);
    const data = await res.json();
    cachedRating = data;
    xpStats(data);
    ratingFetchDone = true;
  } catch (err) {
    console.error("Error fetching top 100:", err);
    const container = document.getElementById("table-container");
    if (container) container.innerHTML = `<div class="top-player"><div class="nick">\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C</div></div>`;
  } finally {
    ratingFetchStarted = false;
  }
}
async function ensureRatingPanel() {
  mountRatingPanel();
  if (cachedRating) {
    xpStats(cachedRating);
    return;
  }
  if (ratingFetchStarted) return;
  ratingFetchStarted = true;
  const container = document.getElementById("table-container");
  if (container && !container.childElementCount) {
    container.innerHTML = `<div class="top-player"><div class="nick">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</div></div>`;
  }
  await fetchTop100();
}
function resetRatingPanel() {
  unmountPanel("rating");
}
export {
  ensureRatingPanel,
  fetchTop100,
  resetRatingPanel,
  xpStats
};
