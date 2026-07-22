import { TOP100_URL, SKIN_FALLBACK_URL } from "../config/endpoints.js";
const getLevel = (xp) => ~~((xp / 100 * 2) ** 0.5);
function resolveAccountAvatar(raw) {
  if (!raw) return SKIN_FALLBACK_URL;
  const url = String(raw).trim();
  if (/^https?:\/\//i.test(url)) return url;
  return SKIN_FALLBACK_URL;
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
    xpStats(data);
  } catch (err) {
    console.error("Error fetching top 100:", err);
  }
}
fetchTop100();
export {
  fetchTop100,
  xpStats
};