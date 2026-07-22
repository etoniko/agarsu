import { setCookie } from "../storage/cookies.js";
import { getAccountToken } from "../storage/local.js";
import {
  loadPassData,
  loadInvisibleSet,
  loadRotationSet,
  loadSkinListMap
} from "../storage/staticLists.js";
async function fetchNickPerksLists(S) {
  if (S.nickPerksLists) return S.nickPerksLists;
  try {
    const [passData, invisible, rotation, skin] = await Promise.all([
      loadPassData(),
      loadInvisibleSet(),
      loadRotationSet(),
      loadSkinListMap()
    ]);
    const skinMap = {};
    for (const [key, val] of Object.entries(skin.obj || {})) {
      skinMap[String(key).toLowerCase()] = val;
    }
    S.nickPerksLists = {
      pass: new Set(passData.passUsers),
      invisible,
      rotation,
      skinMap
    };
  } catch (e) {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0441\u043F\u0438\u0441\u043A\u043E\u0432 \u043F\u043E\u043A\u0443\u043F\u043E\u043A:", e);
    S.nickPerksLists = {
      pass: new Set(),
      invisible: new Set(),
      rotation: new Set(),
      skinMap: {}
    };
  }
  return S.nickPerksLists;
}
function nickInPublicSet(set, nickname) {
  const lower = String(nickname || "").toLowerCase();
  if (set.has(lower)) return true;
  const clean = lower.replace(/\[|\]/g, "").trim();
  return set.has(clean) || set.has(`[${clean}]`);
}
function getSkinUrlForNick(S, nickname) {
  try {
    if (typeof S.skinList !== "object" || !S.skinList) return null;
    const cleanKey = nickname.replace(/\[|\]/g, "").trim().toLowerCase();
    const code = S.skinList[cleanKey];
    if (code) {
      return `https://api.agar.su/skins/${code}.png`;
    }
    const withBrackets = `[${cleanKey}]`;
    const code2 = S.skinList[withBrackets];
    return code2 ? `https://api.agar.su/skins/${code2}.png` : null;
  } catch (e) {
    console.error("Skin error:", e);
    return null;
  }
}
function nickHasPurchasedSkin(S, nickname, skinMap) {
  const lower = String(nickname || "").toLowerCase();
  if (skinMap[lower]) return true;
  const clean = lower.replace(/\[|\]/g, "").trim();
  return !!(skinMap[clean] || skinMap[`[${clean}]`] || getSkinUrlForNick(S, clean));
}
function getNickPerks(S, nickname, password, lists) {
  const pass = String(password ?? "").trim();
  return {
    hasSkinPass: nickInPublicSet(lists.pass, nickname) || !!pass,
    hasSkin: nickHasPurchasedSkin(S, nickname, lists.skinMap),
    invisible: nickInPublicSet(lists.invisible, nickname),
    rotation: nickInPublicSet(lists.rotation, nickname)
  };
}
function makePerkBadge(label, active, hoverText, onBuy) {
  const span = document.createElement("span");
  span.className = "nick-perk" + (active ? " nick-perk--on" : "");
  const faces = document.createElement("span");
  faces.className = "nick-perk-faces";
  const def = document.createElement("span");
  def.className = "nick-perk-face nick-perk-face--default";
  def.textContent = label;
  faces.appendChild(def);
  if (hoverText && onBuy) {
    span.classList.add("nick-perk--action");
    const hover = document.createElement("span");
    hover.className = "nick-perk-face nick-perk-face--hover";
    hover.textContent = hoverText;
    hover.setAttribute("aria-hidden", "true");
    faces.appendChild(hover);
    span.setAttribute("role", "button");
    span.setAttribute("tabindex", "0");
    span.setAttribute("aria-label", hoverText);
    const go = (e) => {
      e.stopPropagation();
      onBuy();
    };
    span.onclick = go;
    span.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go(e);
      }
    };
  } else if (active) {
    span.title = "\u041A\u0443\u043F\u043B\u0435\u043D\u043E";
  }
  span.appendChild(faces);
  return span;
}
function openShopForNick(nickPart, hasClan, options) {
  if (typeof window.openShopPurchase === "function") {
    window.openShopPurchase(nickPart, { clan: hasClan, ...options });
  } else if (typeof showContent === "function") {
    showContent("shop");
  }
}
function parseFullNick(full) {
  const str = String(full || "").trim();
  const [nickPart, pass = ""] = str.split("#", 2);
  const hasClan = /\[[^\]]+\]/.test(nickPart);
  const cleanNick = nickPart.replace(/\[|\]/g, "").trim();
  return { str, nickPart, pass: pass.trim(), hasClan, cleanNick };
}
function makePasswordBox(pass) {
  const wrap = document.createElement("div");
  wrap.className = "passbox";
  const input = document.createElement("input");
  input.type = "password";
  input.value = pass || "";
  input.readOnly = true;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn";
  const icon = document.createElement("i");
  icon.className = "fa fa-eye";
  btn.appendChild(icon);
  btn.onclick = () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    icon.className = show ? "fa fa-eye-slash" : "fa fa-eye";
  };
  wrap.append(input, btn);
  return wrap;
}
function renderNickCard(S, list, fullNick, perks, hooks) {
  const { str, nickPart, pass, hasClan, cleanNick } = parseFullNick(fullNick);
  const label = hasClan ? nickPart : nickPart || "?";
  const p = perks || {
    hasSkinPass: false,
    hasSkin: false,
    invisible: false,
    rotation: false
  };
  const li = document.createElement("li");
  li.className = "nick-card";
  const skinUrl = getSkinUrlForNick(S, cleanNick);
  const avatar = skinUrl ? Object.assign(document.createElement("img"), { className: "skin", src: skinUrl, loading: "lazy" }) : Object.assign(document.createElement("div"), { className: "skin skin--empty", textContent: label.charAt(0).toUpperCase() });
  const body = document.createElement("div");
  body.className = "nick-card-body";
  const name = document.createElement("div");
  name.className = "nick";
  name.textContent = label;
  name.onclick = () => {
    try {
      if (typeof hooks.setNick === "function") hooks.setNick(str);
    } catch (e) {
    }
    document.getElementById("nick").value = nickPart;
    document.getElementById("pass").value = pass;
    setCookie("userPass", pass, 7);
    document.getElementById("pass").style.display = pass ? "block" : "none";
    if (typeof hooks.selectSkin === "function") hooks.selectSkin(nickPart);
  };
  const perksRow = document.createElement("div");
  perksRow.className = "nick-perks";
  const shop = (opts) => () => openShopForNick(nickPart, hasClan, opts);
  perksRow.append(
    makePerkBadge(
      "\u041F\u0430\u0440\u043E\u043B\u044C",
      p.hasSkinPass,
      p.hasSkinPass ? "\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u0430\u0441\u0441" : "\u041A\u0443\u043F\u0438\u0442\u044C \u043F\u0430\u0441\u0441",
      shop({ focusPassword: true })
    ),
    makePerkBadge(
      "\u0421\u043A\u0438\u043D",
      p.hasSkin,
      p.hasSkin ? "\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u0441\u043A\u0438\u043D" : "\u041A\u0443\u043F\u0438\u0442\u044C \u0441\u043A\u0438\u043D",
      shop({ focusSkin: true })
    ),
    makePerkBadge(
      "\u041D\u0435\u0432\u0438\u0434\u0438\u043C\u044B\u0439",
      p.invisible,
      p.invisible ? null : "\u041A\u0443\u043F\u0438\u0442\u044C",
      p.invisible ? null : shop({ invisible: true })
    ),
    makePerkBadge(
      "\u041F\u043E\u0432\u043E\u0440\u043E\u0442",
      p.rotation,
      p.rotation ? null : "\u041A\u0443\u043F\u0438\u0442\u044C",
      p.rotation ? null : shop({ rotation: true })
    )
  );
  body.append(name, perksRow);
  const passBox = makePasswordBox(pass);
  li.append(avatar, body, passBox);
  list.appendChild(li);
}
async function loadMyNicknames(S, hooks) {
  const block = document.getElementById("myNicknamesBlock");
  const nickList = document.getElementById("myNickList");
  const clanList = document.getElementById("myClanList");
  const badgeNick = document.getElementById("badgeNick");
  const badgeClan = document.getElementById("badgeClan");
  if (!getAccountToken()) return;
  if (block) block.style.display = "";
  try {
    S.nickPerksLists = null;
    const res = await hooks.accountApiGet("me/nicknames");
    if (!res.ok) {
      if (res.status === 401) {
        hooks.clearAccountToken();
        hooks.onLogout();
      }
      return;
    }
    const data = await res.json();
    const lists = await fetchNickPerksLists(S);
    if (nickList) nickList.innerHTML = "";
    if (clanList) clanList.innerHTML = "";
    let nickCount = 0;
    let clanCount = 0;
    if (Array.isArray(data?.nicknames) && data.nicknames.length) {
      data.nicknames.forEach((row) => {
        const full = String(row.nickname || "");
        const pass = (row.password ?? "").trim();
        const finalNick = pass && !full.includes("#") ? `${full}#${pass}` : full;
        const parsed = parseFullNick(finalNick);
        const perks = getNickPerks(S, full, pass, lists);
        if (parsed.hasClan) {
          if (clanList) renderNickCard(S, clanList, finalNick, perks, hooks);
          clanCount++;
        } else if (parsed.nickPart) {
          if (nickList) renderNickCard(S, nickList, finalNick, perks, hooks);
          nickCount++;
        }
      });
    } else {
      if (nickList) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "\u0412\u044B \u043D\u0435 \u043F\u043E\u043A\u0443\u043F\u0430\u043B\u0438 \u043D\u0438\u043A\u0438";
        nickList.appendChild(li);
      }
      if (clanList) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "\u0412\u044B \u043D\u0435 \u043F\u043E\u043A\u0443\u043F\u0430\u043B\u0438 \u043A\u043B\u0430\u043D\u044B";
        clanList.appendChild(li);
      }
    }
    if (badgeNick) badgeNick.textContent = String(nickCount);
    if (badgeClan) badgeClan.textContent = String(clanCount);
    if (block) block.style.display = "";
    hooks.wireTabsOnce();
    hooks.showNickClanTab("nicks");
  } catch (e) {
    console.error("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043D\u0438\u043A\u043E\u0432:", e);
    if (block) block.style.display = "";
    if (nickList && !nickList.children.length) {
      const li = document.createElement("li");
      li.className = "error";
      li.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043D\u0438\u043A\u043D\u0435\u0439\u043C\u044B";
      nickList.appendChild(li);
    }
  }
}
export {
  fetchNickPerksLists,
  getNickPerks,
  loadMyNicknames,
  parseFullNick,
  renderNickCard
};