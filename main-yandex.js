/**
 * Agar.su — Yandex Games adapter
 * UI при детектe Яндекса; SDK — Game Ready / реклама / лидерборд.
 * XP только клиентский: время + масса + киллы + смерти. api.agar.su XP не используется.
 */
(function () {
  "use strict";

  var SDK_URL = "https://yandex.ru/games/sdk/v2";
  var FULL_SITE_URL = "https://agar.su/";
  var LB_NAME = "playtime";
  var STATS_KEY = "yg_client_stats_v1";
  var NICK_KEY = "yg_display_nick";

  /** Клиентская формула XP (не api.agar.su) */
  var W_TIME = 2;      // за секунду игры
  var W_MASS = 3;      // за единицу лучшей массы
  var W_KILL = 50;     // за убийство игрока
  var W_DEATH = 15;    // за смерть
  var KILL_MASS_JUMP = 18; // скачок массы ≈ съел игрока (не еду)

  var ysdk = null;
  var gameplayActive = false;
  var sessionStartedAt = 0;
  var sessionTimeAcc = 0;
  var readySent = false;
  var lbLoading = false;
  var lastSubmitAt = 0;
  var uiApplied = false;
  var lastMassSeen = 0;
  var sessionMaxMass = 0;
  var tickTimer = null;
  var entryFullscreenShown = false;

  var stats = loadStats();

  function log() {
    try {
      if (window.__YG_DEBUG__) console.log.apply(console, ["[yandex]"].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  function isYandexCandidate() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get("yandex") === "1" || q.get("yg") === "1") return true;
      if (q.has("app-id") || q.has("app_id") || q.has("draft")) return true;
    } catch (e) {}
    try {
      var ref = String(document.referrer || "");
      if (/yandex\.[a-z.]+\/(?:games|app)|games\.yandex\./i.test(ref)) return true;
    } catch (e2) {}
    if (window !== window.top) {
      try {
        void window.top.location.href;
      } catch (e3) {
        return true;
      }
    }
    return !!window.__AGARSU_YANDEX_CANDIDATE__;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("SDK load failed")); };
      document.head.appendChild(s);
    });
  }

  function loadStats() {
    try {
      var raw = localStorage.getItem(STATS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        return {
          timeSec: Math.max(0, o.timeSec | 0),
          maxMass: Math.max(0, o.maxMass | 0),
          kills: Math.max(0, o.kills | 0),
          deaths: Math.max(0, o.deaths | 0),
          xp: Math.max(0, o.xp | 0)
        };
      }
    } catch (e) {}
    return { timeSec: 0, maxMass: 0, kills: 0, deaths: 0, xp: 0 };
  }

  function saveStats() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  function calcXp(s) {
    return Math.floor(
      (s.timeSec || 0) * W_TIME +
      (s.maxMass || 0) * W_MASS +
      (s.kills || 0) * W_KILL +
      (s.deaths || 0) * W_DEATH
    );
  }

  function getLevel(xp) {
    xp = Math.max(0, Number(xp) || 0);
    return Math.floor(Math.sqrt(xp / 100 * 2));
  }

  function xpForLevel(level) {
    return Math.floor(Math.pow(level, 2) * 100 / 2);
  }

  function recomputeXp() {
    stats.xp = calcXp(stats);
    saveStats();
    return stats.xp;
  }

  function getClientNick() {
    var el = document.getElementById("nick");
    var nick = el && el.value ? String(el.value).trim() : "";
    if (!nick) {
      try {
        nick = localStorage.getItem(NICK_KEY) || "";
      } catch (e) {}
    }
    if (nick) {
      try {
        localStorage.setItem(NICK_KEY, nick.slice(0, 16));
      } catch (e2) {}
    }
    return nick || "Игрок";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseDomMass() {
    var maxEl = document.getElementById("score-max");
    var curEl = document.getElementById("score-new");
    var max = 0;
    var cur = 0;
    if (maxEl) {
      var m = String(maxEl.textContent || "").match(/(\d+)/);
      if (m) max = parseInt(m[1], 10) || 0;
    }
    if (curEl) {
      var c = String(curEl.textContent || "").match(/(\d+)/);
      if (c) cur = parseInt(c[1], 10) || 0;
    }
    return { max: max, cur: cur };
  }

  function flushSessionTime() {
    if (!sessionStartedAt) return;
    var delta = Math.floor((Date.now() - sessionStartedAt) / 1000);
    sessionStartedAt = gameplayActive ? Date.now() : 0;
    if (delta > 0) {
      sessionTimeAcc += delta;
      stats.timeSec += delta;
    }
  }

  function onMassSample(cur, max) {
    if (max > sessionMaxMass) sessionMaxMass = max;
    if (max > stats.maxMass) stats.maxMass = max;
    if (cur > lastMassSeen) {
      var jump = cur - lastMassSeen;
      // резкий прирост массы ≈ килл игрока (еда даёт мелкие +1..+5)
      if (gameplayActive && jump >= KILL_MASS_JUMP) {
        var approxKills = Math.max(1, Math.floor(jump / 40));
        stats.kills += approxKills;
        log("kill+", approxKills, "jump", jump);
      }
    }
    lastMassSeen = cur;
  }

  function onDeath() {
    stats.deaths += 1;
    flushSessionTime();
    if (sessionMaxMass > stats.maxMass) stats.maxMass = sessionMaxMass;
    recomputeXp();
    refreshProgressUi();
    submitXpScore(true);
    log("death", stats.deaths, "xp", stats.xp);
  }

  function gameplayStart() {
    if (gameplayActive) return;
    gameplayActive = true;
    sessionStartedAt = Date.now();
    sessionTimeAcc = 0;
    sessionMaxMass = 0;
    lastMassSeen = 0;
    var m = parseDomMass();
    lastMassSeen = m.cur;
    hideStickyBanner();
    try {
      ysdk && ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.start();
    } catch (e) {}
    startTicker();
    log("GameplayAPI.start");
  }

  function gameplayStop(submitScore) {
    if (!gameplayActive && !sessionStartedAt) {
      if (submitScore) submitXpScore(true);
      return;
    }
    var wasActive = gameplayActive;
    gameplayActive = false;
    flushSessionTime();
    if (sessionMaxMass > stats.maxMass) stats.maxMass = sessionMaxMass;
    recomputeXp();
    try {
      ysdk && ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.stop();
    } catch (e) {}
    stopTicker();
    refreshProgressUi();
    showStickyBanner();
    log("GameplayAPI.stop", stats.xp);
    if (wasActive) onDeathCountedOnce();
    if (submitScore !== false) submitXpScore(true);
  }

  // смерть = выход в меню после игры; не двойной счёт если уже учли
  var deathArmed = false;
  function onDeathCountedOnce() {
    if (!deathArmed) return;
    deathArmed = false;
    // deaths уже через onDeath из observer — здесь только если observer не сработал
  }

  function startTicker() {
    if (tickTimer) return;
    deathArmed = true;
    tickTimer = setInterval(function () {
      if (!gameplayActive) return;
      flushSessionTime();
      var m = parseDomMass();
      onMassSample(m.cur, m.max);
      recomputeXp();
      refreshProgressUi();
    }, 1000);
  }

  function stopTicker() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function submitXpScore(force) {
    if (!ysdk || !ysdk.leaderboards) return;
    var score = recomputeXp();
    if (score < 1) return;
    var now = Date.now();
    if (!force && now - lastSubmitAt < 2000) return;
    lastSubmitAt = now;
    var nick = getClientNick();
    var extra = JSON.stringify({
      nick: nick,
      level: getLevel(score),
      mass: stats.maxMass,
      kills: stats.kills,
      deaths: stats.deaths,
      time: stats.timeSec
    });
    ysdk.isAvailableMethod("leaderboards.setScore").then(function (ok) {
      if (!ok) return;
      return ysdk.leaderboards.setScore(LB_NAME, score, extra);
    }).then(function () {
      log("setScore ok", score, nick);
    }).catch(function (err) {
      log("setScore fail", err);
    });
  }

  function parseExtraNick(entry) {
    try {
      if (entry && entry.extraData) {
        var raw = entry.extraData;
        if (typeof raw === "string") {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.nick) return String(parsed.nick).slice(0, 16);
        } else if (raw.nick) {
          return String(raw.nick).slice(0, 16);
        }
      }
    } catch (e) {}
    try {
      return (entry.player && (entry.player.publicName || entry.player.uniqueID)) || "Игрок";
    } catch (e2) {
      return "Игрок";
    }
  }

  function renderYandexLeaderboard() {
    var box = document.getElementById("table-container");
    if (!box || !ysdk || !ysdk.leaderboards || lbLoading) return;
    lbLoading = true;
    box.innerHTML = '<div class="yg-lb-status">Загрузка рейтинга Яндекс…</div>';

    ysdk.leaderboards.getEntries(LB_NAME, {
      quantityTop: 20,
      includeUser: true,
      quantityAround: 3
    }).then(function (res) {
      lbLoading = false;
      var entries = (res && res.entries) || [];
      if (!entries.length) {
        box.innerHTML = '<div class="yg-lb-status">Пока пусто — играйте: XP = время + масса + киллы + смерти.</div>';
        return;
      }
      var html = '<div class="yg-lb-list">';
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var rank = e.rank || i + 1;
        var nick = parseExtraNick(e);
        var score = e.score || 0;
        var level = getLevel(score);
        var me = !!(e.player && e.player.uniqueID && ysdk._playerId && e.player.uniqueID === ysdk._playerId);
        html +=
          '<div class="yg-lb-row' + (me ? " yg-lb-row--me" : "") + '">' +
          '<div class="cell">' + rank + "</div>" +
          '<div class="cell nr">' + escapeHtml(nick) + "</div>" +
          '<div class="cell">' + level + "</div>" +
          '<div class="cell">' + score + "</div>" +
          "</div>";
      }
      html += "</div>";
      box.innerHTML = html;
    }).catch(function (err) {
      lbLoading = false;
      log("getEntries fail", err);
      box.innerHTML =
        '<div class="yg-lb-status">Рейтинг Яндекс недоступен. Лидерборд <b>' +
        LB_NAME +
        "</b> — numeric / по убыванию.</div>";
    });
  }

  function injectStyles() {
    if (document.getElementById("yg-adapter-style")) return;
    var css = document.createElement("style");
    css.id = "yg-adapter-style";
    css.textContent = [
      "body.yg-mode .add-yandex,",
      "body.yg-mode .social,",
      "body.yg-mode #liquid-cloud-banner,",
      "body.yg-mode .death,",
      "body.yg-mode #authlog,",
      "body.yg-mode #myNicknamesBlock,",
      "body.yg-mode #accountID,",
      "body.yg-mode #ygXpChip,",
      "body.yg-mode .footer{display:none!important;}",
      "body.yg-mode #shop > :not(.yg-shop-cta){display:none!important;}",
      "body.yg-mode #shop .yg-shop-cta,",
      "body.yg-mode .yg-shop-cta{",
      "display:flex!important;flex-direction:column;align-items:center;justify-content:center;",
      "gap:14px;padding:32px 20px;text-align:center;min-height:300px;width:100%;box-sizing:border-box;",
      "}",
      "body.yg-mode .yg-shop-cta h3{margin:0;font-size:22px;}",
      "body.yg-mode .yg-shop-cta p{margin:0;max-width:380px;opacity:.9;line-height:1.45;}",
      "body.yg-mode .yg-shop-cta .yg-web-btn{",
      "display:inline-flex;align-items:center;gap:8px;padding:14px 26px;border:0;border-radius:10px;",
      "background:#2f6fed;color:#fff;font-weight:700;cursor:pointer;font-size:16px;",
      "}",
      "body.yg-mode .yg-shop-cta .yg-web-btn:hover{filter:brightness(1.08);}",
      "body.yg-mode .yg-lb-list{display:flex;flex-direction:column;gap:6px;padding:8px;}",
      "body.yg-mode .yg-lb-row{display:grid;grid-template-columns:70px 1fr 90px 100px;gap:8px;align-items:center;padding:8px 10px;background:rgba(255,255,255,.04);border-radius:8px;}",
      "body.yg-mode .yg-lb-row--me{outline:1px solid #4d7cff;}",
      "body.yg-mode .yg-lb-status{padding:24px 12px;text-align:center;opacity:.85;}",
      "body.yg-mode .progress-container{display:block!important;}"
    ].join("");
    document.head.appendChild(css);
  }

  function patchShop() {
    var shop = document.getElementById("shop");
    if (!shop) return;

    var cta = shop.querySelector(".yg-shop-cta");
    if (!cta) {
      cta = document.createElement("div");
      cta.className = "yg-shop-cta";
      cta.innerHTML =
        "<h3>Полная версия на сайте</h3>" +
        "<p>Покупки скинов, паролей и доп. функций доступны только в полном клиенте на <b>agar.su</b>.</p>" +
        '<button type="button" class="yg-web-btn" id="ygOpenFullSite">' +
        '<i class="fas fa-globe"></i><span>Открыть Web — agar.su</span></button>' +
        "<p style=\"font-size:12px;opacity:.7\">Откроется сайт вне Яндекс Игр.</p>";
      shop.appendChild(cta);
      var btn = cta.querySelector("#ygOpenFullSite");
      if (btn) {
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          try {
            window.open(FULL_SITE_URL, "_blank", "noopener");
          } catch (e) {
            location.href = FULL_SITE_URL;
          }
        });
      }
    }

    for (var i = 0; i < shop.children.length; i++) {
      var ch = shop.children[i];
      if (ch.classList && ch.classList.contains("yg-shop-cta")) ch.style.display = "flex";
      else ch.style.display = "none";
    }
  }

  function forceSettingsLabel() {
    var label = document.getElementById("accountMenuLabel");
    if (!label) return;
    label.textContent = "Настройки";
    label.setAttribute("data-ru", "Настройки");
    label.setAttribute("data-en", "Settings");
  }

  function patchMenu() {
    var accountItem =
      document.querySelector('.menu-item[onclick="showContent(\'store\')"]') ||
      document.querySelector('.menu-item[onclick="showContent(\'settings\')"]');
    if (accountItem) {
      accountItem.setAttribute("onclick", "showContent('settings')");
      var icon = accountItem.querySelector("i");
      if (icon) icon.className = "fas fa-gear";
      forceSettingsLabel();
    }

    window.updateAccountMenuLabel = function () {
      forceSettingsLabel();
    };
    forceSettingsLabel();

    var ratingHeader = document.querySelector("#rating .top-info span");
    if (ratingHeader) {
      ratingHeader.textContent = "Топ по XP";
      ratingHeader.setAttribute("data-ru", "Топ по XP");
      ratingHeader.setAttribute("data-en", "XP Top");
    }
    var cells = document.querySelectorAll("#rating .header-row .cell");
    if (cells.length >= 4) {
      cells[2].textContent = "Уровень";
      cells[3].textContent = "XP";
    }

    var shopItem = document.querySelector('.menu-item[onclick="showContent(\'shop\')"]');
    if (shopItem && !shopItem.__ygShopBound) {
      shopItem.__ygShopBound = true;
      shopItem.addEventListener("click", function () {
        setTimeout(patchShop, 0);
      });
    }

    wrapShowContent();
  }

  function wrapShowContent() {
    var origShow = window.showContent;
    if (typeof origShow !== "function" || origShow.__ygWrapped) return;
    window.showContent = function (id) {
      if (id === "store") id = "settings";
      var ret = origShow(id);
      if (id === "rating") renderYandexLeaderboard();
      if (id === "shop") patchShop();
      if (id === "home") refreshProgressUi();
      return ret;
    };
    window.showContent.__ygWrapped = true;
  }

  function removeXpChip() {
    var chip = document.getElementById("ygXpChip");
    if (chip && chip.parentNode) chip.parentNode.removeChild(chip);
  }

  function refreshProgressUi() {
    removeXpChip();
    recomputeXp();
    var xp = stats.xp;
    var level = getLevel(xp);
    var curLevelXp = xpForLevel(level);
    var nextXp = xpForLevel(level + 1);
    if (nextXp <= curLevelXp) nextXp = curLevelXp + 50;
    var span = nextXp - curLevelXp;
    var into = Math.max(0, xp - curLevelXp);
    var pct = Math.min(100, Math.round(into / span * 100));

    var levelCircle = document.getElementById("levelCircle");
    if (levelCircle) levelCircle.textContent = String(level);

    var progressText = document.getElementById("progressText");
    if (progressText) progressText.textContent = pct + "% (" + xp + "/" + nextXp + ")";

    var fill = document.querySelector(".progress-fill");
    if (fill) fill.style.width = pct + "%";

    // не даём api/account перетереть прогресс-бар своим XP
    var progressContainer = document.querySelector(".progress-container");
    if (progressContainer) progressContainer.style.display = "";
  }

  function disableExternalAds() {
    try {
      window.yaContextCb = window.yaContextCb || [];
      window.Ya = window.Ya || {};
      window.Ya.Context = window.Ya.Context || {};
      window.Ya.Context.AdvManager = { render: function () {} };
    } catch (e) {}
    ["yandex_rtb_R-A-15699059-13", "yandex_rtb_R-A-15699059-14"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });
  }

  function blockServerXpUi() {
    // api.agar.su XP / кабинет — только для обычного сайта
    var prev = window.onUpdateXp;
    if (typeof prev === "function" && prev.__ygBlocked) return true;
    window.onUpdateXp = function () {
      // игнор серверного XP в yandex-режиме
      refreshProgressUi();
    };
    window.onUpdateXp.__ygBlocked = true;

    if (typeof window.updateAccountMenuLabel === "function") {
      window.updateAccountMenuLabel = function () {
        forceSettingsLabel();
      };
    }
    return true;
  }

  function wrapPlayHooks() {
    function wrap(name, afterStart) {
      var prev = window[name];
      if (typeof prev !== "function" || prev.__ygWrapped) return false;
      window[name] = function () {
        var r = prev.apply(this, arguments);
        if (afterStart) gameplayStart();
        return r;
      };
      window[name].__ygWrapped = true;
      return true;
    }

    var tries = 0;
    var timer = setInterval(function () {
      wrap("startGame", true);
      wrap("spectate", true);
      blockServerXpUi();
      wrapShowContent();
      forceSettingsLabel();
      patchShop();
      refreshProgressUi();
      if (++tries > 80) clearInterval(timer);
    }, 200);

    var overlays = document.getElementById("overlays");
    if (overlays && !overlays.__ygObserved) {
      overlays.__ygObserved = true;
      var obs = new MutationObserver(function () {
        var shown = overlays.style.display !== "none" && getComputedStyle(overlays).display !== "none";
        if (shown && (gameplayActive || deathArmed)) {
          if (deathArmed && (gameplayActive || sessionStartedAt)) {
            onDeath();
            deathArmed = false;
          }
          gameplayStop(true);
          // fullscreen НЕ после смерти — только при первом входе
        }
      });
      obs.observe(overlays, { attributes: true, attributeFilter: ["style", "class"] });
    }

    // масса с HUD
    ["score-max", "score-new"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.__ygMassObs) return;
      el.__ygMassObs = true;
      var mo = new MutationObserver(function () {
        if (!gameplayActive) return;
        var m = parseDomMass();
        onMassSample(m.cur, m.max);
        recomputeXp();
        refreshProgressUi();
      });
      mo.observe(el, { characterData: true, childList: true, subtree: true });
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && gameplayActive) gameplayStop(true);
    });
    window.addEventListener("pagehide", function () {
      gameplayStop(true);
    });
  }

  function showStickyBanner() {
    if (!ysdk || !ysdk.adv || typeof ysdk.adv.showBannerAdv !== "function") return;
    try {
      ysdk.adv.getBannerAdvStatus().then(function (res) {
        if (res && res.stickyAdvIsShowing) return;
        if (res && res.reason) {
          log("sticky reason", res.reason);
          return;
        }
        return ysdk.adv.showBannerAdv();
      }).catch(function (e) {
        log("sticky show fail", e);
      });
    } catch (e) {
      try { ysdk.adv.showBannerAdv(); } catch (e2) {}
    }
  }

  function hideStickyBanner() {
    if (!ysdk || !ysdk.adv || typeof ysdk.adv.hideBannerAdv !== "function") return;
    try {
      ysdk.adv.hideBannerAdv();
    } catch (e) {}
  }

  /** Fullscreen один раз при входе в игру (после Game Ready), не после каждой смерти */
  function showEntryFullscreenAdv() {
    if (entryFullscreenShown || !ysdk || !ysdk.adv) return;
    entryFullscreenShown = true;
    try {
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: function () {
            try {
              ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.stop();
            } catch (e) {}
          },
          onClose: function (wasShown) {
            log("entry fullscreen close", wasShown);
            showStickyBanner();
          },
          onError: function (err) {
            log("entry fullscreen error", err);
            showStickyBanner();
          }
        }
      });
    } catch (e) {
      showStickyBanner();
    }
  }

  function gameReady() {
    if (readySent) return;
    readySent = true;
    try {
      ysdk && ysdk.features && ysdk.features.LoadingAPI && ysdk.features.LoadingAPI.ready();
      log("LoadingAPI.ready");
    } catch (e) {
      log("LoadingAPI.ready fail", e);
    }
    // чуть позже меню — показать fullscreen входа, потом sticky
    setTimeout(showEntryFullscreenAdv, 400);
  }

  function bindPlayer(player) {
    if (!player) return;
    try {
      ysdk._playerId = player.getUniqueID && player.getUniqueID();
    } catch (e) {}
  }

  function ensureAuthForLeaderboard() {
    if (!ysdk || !ysdk.getPlayer) return Promise.resolve(null);
    return ysdk.getPlayer({ scopes: false }).then(function (player) {
      bindPlayer(player);
      if (player.getMode && player.getMode() === "lite" && ysdk.auth && ysdk.auth.openAuthDialog) {
        return ysdk.auth.openAuthDialog().then(function () {
          return ysdk.getPlayer({ scopes: false }).then(function (p2) {
            bindPlayer(p2);
            return p2;
          });
        }).catch(function () { return player; });
      }
      return player;
    }).catch(function () { return null; });
  }

  function applyYandexUi() {
    if (uiApplied) {
      patchShop();
      refreshProgressUi();
      return;
    }
    uiApplied = true;
    document.documentElement.classList.add("yg-mode");
    if (document.body) document.body.classList.add("yg-mode");
    else {
      document.addEventListener("DOMContentLoaded", function () {
        document.body.classList.add("yg-mode");
      });
    }
    injectStyles();
    disableExternalAds();
    patchMenu();
    patchShop();
    removeXpChip();
    refreshProgressUi();
    wrapPlayHooks();
    blockServerXpUi();

    var ratingItem = document.querySelector('.menu-item[onclick="showContent(\'rating\')"]');
    if (ratingItem && !ratingItem.__ygBound) {
      ratingItem.__ygBound = true;
      ratingItem.addEventListener("click", function () {
        ensureAuthForLeaderboard().then(function () {
          renderYandexLeaderboard();
        });
      });
    }
  }

  function initSdk() {
    return loadScript(SDK_URL).then(function () {
      if (!window.YaGames || typeof window.YaGames.init !== "function") {
        throw new Error("YaGames missing");
      }
      return window.YaGames.init();
    }).then(function (sdk) {
      ysdk = sdk;
      window.ysdk = sdk;
      window.__AGARSU_YANDEX__ = true;

      try {
        if (sdk.environment && sdk.environment.i18n && sdk.environment.i18n.lang) {
          var lang = sdk.environment.i18n.lang;
          if (typeof window.setUiLang === "function" && ["ru", "en", "tr", "uk"].indexOf(lang) !== -1) {
            window.setUiLang(lang);
          }
        }
      } catch (e) {}

      return sdk.getPlayer({ scopes: false }).then(bindPlayer).catch(function () {});
    }).then(function () {
      setTimeout(gameReady, 50);
      submitXpScore(true);
    });
  }

  function boot() {
    if (!isYandexCandidate()) {
      log("skip: not yandex candidate");
      return;
    }
    log("boot yandex adapter (client XP)");
    applyYandexUi();
    initSdk().catch(function (err) {
      console.warn("[yandex] SDK init failed (UI уже в yg-mode)", err);
    });
  }

  // отладка формулы
  window.__YG_STATS__ = function () {
    return Object.assign({}, stats, { xp: calcXp(stats) });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
