/**
 * Agar.su — Yandex Games adapter
 * UI-правки сразу при детектe Яндекса; SDK — Game Ready / реклама / лидерборд.
 * Рейтинг = XP с игрового сервера (пакет XP) + ник клиента. ЛК и api-авторизация не используются.
 */
(function () {
  "use strict";

  var SDK_URL = "https://yandex.ru/games/sdk/v2";
  var FULL_SITE_URL = "https://agar.su/";
  /** Техническое имя в Консоли Яндекс Игр (numeric, по убыванию) */
  var LB_NAME = "playtime";
  var XP_KEY = "yg_best_xp";
  var NICK_KEY = "yg_display_nick";

  var ysdk = null;
  var gameplayActive = false;
  var sessionStartedAt = 0;
  var readySent = false;
  var lbLoading = false;
  var currentXp = 0;
  var lastSubmitAt = 0;
  var uiApplied = false;

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

  function getLevel(xp) {
    xp = Math.max(0, Number(xp) || 0);
    return Math.floor(Math.sqrt(xp / 100 * 2));
  }

  function getBestXp() {
    try {
      return Math.max(0, parseInt(localStorage.getItem(XP_KEY) || "0", 10) || 0);
    } catch (e) {
      return 0;
    }
  }

  function setBestXp(xp) {
    xp = Math.max(0, Math.floor(Number(xp) || 0));
    try {
      localStorage.setItem(XP_KEY, String(xp));
    } catch (e) {}
    if (xp > currentXp) currentXp = xp;
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

  function onServerXp(xp) {
    xp = Math.max(0, Math.floor(Number(xp) || 0));
    currentXp = xp;
    if (xp > getBestXp()) setBestXp(xp);
    refreshXpUi();
    // периодически пушим лучший XP в Яндекс
    submitXpScore(false);
  }

  function gameplayStart() {
    if (gameplayActive) return;
    gameplayActive = true;
    sessionStartedAt = Date.now();
    try {
      ysdk && ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.start();
    } catch (e) {}
    log("GameplayAPI.start");
  }

  function gameplayStop(submitScore) {
    if (!gameplayActive && !sessionStartedAt) {
      if (submitScore) submitXpScore(true);
      return;
    }
    gameplayActive = false;
    sessionStartedAt = 0;
    try {
      ysdk && ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.stop();
    } catch (e) {}
    log("GameplayAPI.stop", currentXp || getBestXp());
    if (submitScore !== false) submitXpScore(true);
  }

  function submitXpScore(force) {
    if (!ysdk || !ysdk.leaderboards) return;
    var score = Math.max(currentXp, getBestXp());
    if (score < 1) return;
    var now = Date.now();
    if (!force && now - lastSubmitAt < 2000) return;
    lastSubmitAt = now;
    var nick = getClientNick();
    var extra = JSON.stringify({
      nick: nick,
      level: getLevel(score)
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
        box.innerHTML = '<div class="yg-lb-status">Пока пусто — сыграйте, XP с сервера попадёт в топ.</div>';
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
        "</b> должен быть numeric / по убыванию.</div>";
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
      "body.yg-mode #accountID{display:none!important;}",
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
      "body.yg-mode .yg-xp-chip{display:inline-flex;align-items:center;gap:6px;}"
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

    // прячем остальное жёстко (на случай если CSS ещё не применился)
    for (var i = 0; i < shop.children.length; i++) {
      var ch = shop.children[i];
      if (ch.classList && ch.classList.contains("yg-shop-cta")) {
        ch.style.display = "flex";
      } else {
        ch.style.display = "none";
      }
    }

    var title = shop.querySelector(".top-info span");
    if (title) {
      // top-info скрыт CSS, но на всякий
      title.textContent = "Магазин Web";
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
      cells[2].setAttribute("data-ru", "Уровень");
      cells[2].setAttribute("data-en", "Level");
      cells[3].textContent = "XP";
      cells[3].setAttribute("data-ru", "XP");
      cells[3].setAttribute("data-en", "XP");
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
      return ret;
    };
    window.showContent.__ygWrapped = true;
  }

  function patchHomeHeader() {
    currentXp = Math.max(currentXp, getBestXp());
    // возвращаем прогресс-бар, заполняем XP с сервера
    var progressText = document.getElementById("progressText");
    var levelCircle = document.getElementById("levelCircle");
    if (!document.getElementById("ygXpChip")) {
      var right = document.querySelector(".home-header-right");
      if (right) {
        var chip = document.createElement("span");
        chip.id = "ygXpChip";
        chip.className = "home-header-chip yg-xp-chip";
        chip.innerHTML = '<i class="fas fa-star"></i> <span id="ygXpText">0 XP</span>';
        right.insertBefore(chip, right.firstChild);
      }
    }
    refreshXpUi();
    if (progressText || levelCircle) {
      // ok
    }
  }

  function refreshXpUi() {
    var xp = Math.max(currentXp, getBestXp());
    var level = getLevel(xp);
    var nextXp = Math.floor(Math.pow(level + 1, 2) * 100 / 2);
    if (nextXp < 1) nextXp = 100;
    var el = document.getElementById("ygXpText");
    if (el) el.textContent = xp + " XP";
    var levelCircle = document.getElementById("levelCircle");
    if (levelCircle) levelCircle.textContent = String(level);
    var progressText = document.getElementById("progressText");
    if (progressText) {
      var pct = Math.min(100, Math.round(xp / nextXp * 100));
      progressText.textContent = pct + "% (" + xp + "/" + nextXp + ")";
    }
    var fill = document.querySelector(".progress-fill");
    if (fill) fill.style.width = Math.min(100, xp / nextXp * 100) + "%";
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

  function hookServerXp() {
    var prev = window.onUpdateXp;
    if (typeof prev === "function" && prev.__ygXpWrapped) return true;
    if (typeof prev !== "function") return false;
    window.onUpdateXp = function (xp) {
      onServerXp(xp);
      return prev.apply(this, arguments);
    };
    window.onUpdateXp.__ygXpWrapped = true;
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
      hookServerXp();
      wrapShowContent();
      forceSettingsLabel();
      patchShop();
      if (++tries > 80) clearInterval(timer);
    }, 200);

    var overlays = document.getElementById("overlays");
    if (overlays && !overlays.__ygObserved) {
      overlays.__ygObserved = true;
      var obs = new MutationObserver(function () {
        var shown = overlays.style.display !== "none" && getComputedStyle(overlays).display !== "none";
        if (shown && gameplayActive) {
          gameplayStop(true);
          maybeShowFullscreenAdv();
        }
      });
      obs.observe(overlays, { attributes: true, attributeFilter: ["style", "class"] });
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && gameplayActive) gameplayStop(true);
    });
    window.addEventListener("pagehide", function () {
      gameplayStop(true);
    });
  }

  var lastFullscreenAt = 0;
  function maybeShowFullscreenAdv() {
    if (!ysdk || !ysdk.adv) return;
    var now = Date.now();
    if (now - lastFullscreenAt < 70000) return;
    lastFullscreenAt = now;
    try {
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: function () { gameplayStop(false); },
          onClose: function () {},
          onError: function () {}
        }
      });
    } catch (e) {}
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
      return;
    }
    uiApplied = true;
    document.documentElement.classList.add("yg-mode");
    if (document.body) document.body.classList.add("yg-mode");
    else document.addEventListener("DOMContentLoaded", function () {
      document.body.classList.add("yg-mode");
    });
    injectStyles();
    disableExternalAds();
    patchMenu();
    patchShop();
    patchHomeHeader();
    wrapPlayHooks();

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
      // если уже есть сохранённый XP — сразу в таблицу
      submitXpScore(true);
    });
  }

  function boot() {
    if (!isYandexCandidate()) {
      log("skip: not yandex candidate");
      return;
    }
    log("boot yandex adapter");
    // UI сразу — даже если SDK ещё грузится / упал
    applyYandexUi();
    initSdk().catch(function (err) {
      console.warn("[yandex] SDK init failed (UI уже в yg-mode)", err);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
