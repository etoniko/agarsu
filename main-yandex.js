/**
 * Agar.su — Yandex Games adapter
 * Активируется только внутри Яндекс Игр (iframe / ?yandex=1).
 * Не трогает api.agar.su: ЛК выключен, магазин → полный сайт, рейтинг = время игры.
 */
(function () {
  "use strict";

  var SDK_URL = "https://yandex.ru/games/sdk/v2";
  var FULL_SITE_URL = "https://agar.su/";
  /** Имя таблицы в Консоли Яндекс Игр (создайте лидерборд с типом «число», больше — лучше) */
  var LB_NAME = "playtime";
  var PLAYTIME_KEY = "yg_playtime_sec";
  var NICK_KEY = "yg_display_nick";

  var ysdk = null;
  var gameplayActive = false;
  var sessionStartedAt = 0;
  var readySent = false;
  var lbLoading = false;

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

  function getStoredPlaytime() {
    try {
      return Math.max(0, parseInt(localStorage.getItem(PLAYTIME_KEY) || "0", 10) || 0);
    } catch (e) {
      return 0;
    }
  }

  function setStoredPlaytime(sec) {
    try {
      localStorage.setItem(PLAYTIME_KEY, String(Math.max(0, Math.floor(sec))));
    } catch (e) {}
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

  function flushSessionPlaytime() {
    if (!sessionStartedAt) return getStoredPlaytime();
    var delta = Math.floor((Date.now() - sessionStartedAt) / 1000);
    sessionStartedAt = 0;
    if (delta < 1) return getStoredPlaytime();
    var total = getStoredPlaytime() + delta;
    setStoredPlaytime(total);
    return total;
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
      if (submitScore) submitPlaytimeScore();
      return;
    }
    gameplayActive = false;
    var total = flushSessionPlaytime();
    try {
      ysdk && ysdk.features && ysdk.features.GameplayAPI && ysdk.features.GameplayAPI.stop();
    } catch (e) {}
    log("GameplayAPI.stop", total);
    if (submitScore !== false) submitPlaytimeScore(total);
  }

  function submitPlaytimeScore(total) {
    if (!ysdk || !ysdk.leaderboards) return;
    var score = typeof total === "number" ? total : getStoredPlaytime();
    if (score < 1) return;
    var nick = getClientNick();
    var extra = JSON.stringify({ nick: nick });
    ysdk.isAvailableMethod("leaderboards.setScore").then(function (ok) {
      if (!ok) return;
      return ysdk.leaderboards.setScore(LB_NAME, score, extra);
    }).then(function () {
      log("setScore ok", score, nick);
    }).catch(function (err) {
      log("setScore fail", err);
    });
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor(sec % 3600 / 60);
    var s = sec % 60;
    if (h > 0) return h + "ч " + m + "м";
    if (m > 0) return m + "м " + s + "с";
    return s + "с";
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
        box.innerHTML = '<div class="yg-lb-status">Пока пусто — сыграйте, чтобы попасть в топ по времени.</div>';
        return;
      }
      var html = '<div class="yg-lb-list">';
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var rank = e.rank || i + 1;
        var nick = parseExtraNick(e);
        var score = e.score || 0;
        var me = e.player && e.player.uniqueID && ysdk._playerId && e.player.uniqueID === ysdk._playerId;
        html +=
          '<div class="yg-lb-row' + (me ? " yg-lb-row--me" : "") + '">' +
          '<div class="cell">' + rank + "</div>" +
          '<div class="cell nr">' + escapeHtml(nick) + "</div>" +
          '<div class="cell">' + formatTime(score) + "</div>" +
          '<div class="cell">' + score + " XP</div>" +
          "</div>";
      }
      html += "</div>";
      box.innerHTML = html;
    }).catch(function (err) {
      lbLoading = false;
      log("getEntries fail", err);
      box.innerHTML =
        '<div class="yg-lb-status">Рейтинг Яндекс недоступен. Создайте лидерборд <b>' +
        LB_NAME +
        "</b> в консоли (число, по убыванию).</div>";
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function injectStyles() {
    if (document.getElementById("yg-adapter-style")) return;
    var css = document.createElement("style");
    css.id = "yg-adapter-style";
    css.textContent =
      "body.yg-mode .add-yandex," +
      "body.yg-mode .social," +
      "body.yg-mode #liquid-cloud-banner," +
      "body.yg-mode .death," +
      "body.yg-mode #authlog," +
      "body.yg-mode #myNicknamesBlock," +
      "body.yg-mode .progress-container," +
      "body.yg-mode #accountID{display:none!important;}" +
      "body.yg-mode .yg-shop-cta{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:28px 18px;text-align:center;min-height:280px;}" +
      "body.yg-mode .yg-shop-cta h3{margin:0;font-size:20px;}" +
      "body.yg-mode .yg-shop-cta p{margin:0;max-width:360px;opacity:.85;line-height:1.4;}" +
      "body.yg-mode .yg-shop-cta .yg-web-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border:0;border-radius:10px;background:#2f6fed;color:#fff;font-weight:700;cursor:pointer;font-size:15px;}" +
      "body.yg-mode .yg-shop-cta .yg-web-btn:hover{filter:brightness(1.08);}" +
      "body.yg-mode .shop-container," +
      "body.yg-mode #shopToastContainer," +
      "body.yg-mode #shopInfo{display:none!important;}" +
      "body.yg-mode .yg-lb-list{display:flex;flex-direction:column;gap:6px;padding:8px;}" +
      "body.yg-mode .yg-lb-row{display:grid;grid-template-columns:70px 1fr 90px 90px;gap:8px;align-items:center;padding:8px 10px;background:rgba(255,255,255,.04);border-radius:8px;}" +
      "body.yg-mode .yg-lb-row--me{outline:1px solid #4d7cff;}" +
      "body.yg-mode .yg-lb-status{padding:24px 12px;text-align:center;opacity:.85;}" +
      "body.yg-mode .yg-playtime-chip{display:inline-flex;align-items:center;gap:6px;}" +
      "body.yg-mode .rating .header-row .cell:nth-child(3)," +
      "body.yg-mode .rating .header-row .cell:nth-child(4){}" +
      "body.yg-mode #shop.yg-shop-ready .yg-shop-cta{display:flex;}";
    document.head.appendChild(css);
  }

  function patchShop() {
    var shop = document.getElementById("shop");
    if (!shop || shop.querySelector(".yg-shop-cta")) return;
    shop.classList.add("yg-shop-ready");
    var cta = document.createElement("div");
    cta.className = "yg-shop-cta";
    cta.innerHTML =
      "<h3>Полный пакет на сайте</h3>" +
      "<p>Скины, пароли на ник, невидимый ник и остальные покупки доступны в полной версии игры на <b>agar.su</b>.</p>" +
      '<button type="button" class="yg-web-btn" id="ygOpenFullSite">' +
      '<i class="fas fa-external-link-alt"></i><span>Открыть Web</span></button>' +
      "<p style=\"font-size:12px;opacity:.7\">Нажимая «Web», вы переходите на полный сайт игры вне Яндекс Игр.</p>";
    var top = shop.querySelector(".top-info");
    if (top && top.nextSibling) shop.insertBefore(cta, top.nextSibling);
    else shop.appendChild(cta);
    var btn = document.getElementById("ygOpenFullSite");
    if (btn) {
      btn.addEventListener("click", function () {
        try {
          window.open(FULL_SITE_URL, "_blank", "noopener");
        } catch (e) {
          location.href = FULL_SITE_URL;
        }
      });
    }
  }

  function forceSettingsLabel() {
    var label = document.getElementById("accountMenuLabel");
    if (!label) return;
    label.textContent = "Настройки";
    label.setAttribute("data-ru", "Настройки");
    label.setAttribute("data-en", "Settings");
    label.setAttribute("data-uk", "Налаштування");
    label.setAttribute("data-tr", "Ayarlar");
    label.setAttribute("data-zh", "设置");
    label.setAttribute("data-ar", "الإعدادات");
    label.setAttribute("data-es", "Ajustes");
    label.setAttribute("data-pl", "Ustawienia");
    label.setAttribute("data-de", "Einstellungen");
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
      ratingHeader.textContent = "Топ по времени игры";
      ratingHeader.setAttribute("data-ru", "Топ по времени игры");
      ratingHeader.setAttribute("data-en", "Playtime top");
    }
    var cells = document.querySelectorAll("#rating .header-row .cell");
    if (cells.length >= 4) {
      cells[2].textContent = "Время";
      cells[2].setAttribute("data-ru", "Время");
      cells[2].setAttribute("data-en", "Time");
      cells[3].textContent = "XP";
      cells[3].setAttribute("data-ru", "XP");
      cells[3].setAttribute("data-en", "XP");
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
    var right = document.querySelector(".home-header-right");
    if (!right || document.getElementById("ygPlaytimeChip")) return;
    var chip = document.createElement("span");
    chip.id = "ygPlaytimeChip";
    chip.className = "home-header-chip yg-playtime-chip";
    chip.innerHTML = '<i class="fas fa-clock"></i> <span id="ygPlaytimeText">0с</span>';
    right.insertBefore(chip, right.firstChild);
    refreshPlaytimeChip();
  }

  function refreshPlaytimeChip() {
    var el = document.getElementById("ygPlaytimeText");
    if (!el) return;
    var live = getStoredPlaytime();
    if (sessionStartedAt) live += Math.floor((Date.now() - sessionStartedAt) / 1000);
    el.textContent = formatTime(live);
  }

  function disableExternalAds() {
    try {
      window.yaContextCb = window.yaContextCb || [];
      window.Ya = window.Ya || {};
      window.Ya.Context = window.Ya.Context || {};
      window.Ya.Context.AdvManager = {
        render: function () {}
      };
    } catch (e) {}
    ["yandex_rtb_R-A-15699059-13", "yandex_rtb_R-A-15699059-14"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });
  }

  function wrapPlayHooks() {
    function wrap(name, afterStart) {
      var prev = window[name];
      if (typeof prev !== "function" || prev.__ygWrapped) return false;
      window[name] = function () {
        var r = prev.apply(this, arguments);
        if (afterStart) {
          gameplayStart();
          tryShowFullscreenAdvOnStart();
        }
        return r;
      };
      window[name].__ygWrapped = true;
      return true;
    }

    var tries = 0;
    var timer = setInterval(function () {
      var a = wrap("startGame", true);
      var b = wrap("spectate", true);
      wrapShowContent();
      forceSettingsLabel();
      if ((a && b && window.showContent && window.showContent.__ygWrapped) || ++tries > 60) {
        clearInterval(timer);
      }
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
      if (document.hidden) {
        if (gameplayActive) gameplayStop(true);
      } else if (!document.hidden && overlays && overlays.style.display === "none" && !gameplayActive) {
        // вкладка снова активна во время матча — resume по желанию платформы
      }
    });

    window.addEventListener("pagehide", function () {
      gameplayStop(true);
    });

    setInterval(refreshPlaytimeChip, 5000);
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
          onOpen: function () {
            gameplayStop(false);
          },
          onClose: function () {},
          onError: function () {}
        }
      });
    } catch (e) {}
  }

  var startAdvShown = false;
  function tryShowFullscreenAdvOnStart() {
    if (startAdvShown) return;
    startAdvShown = true;
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
    try {
      if (player.getMode && player.getMode() === "lite") {
        // гость — setScore может быть недоступен; попытка auth по клику рейтинга
      }
    } catch (e2) {}
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
        }).catch(function () {
          return player;
        });
      }
      return player;
    }).catch(function () {
      return null;
    });
  }

  function applyYandexUi() {
    document.documentElement.classList.add("yg-mode");
    document.body.classList.add("yg-mode");
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
      applyYandexUi();

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
      // Game Ready: меню уже в DOM (defer), можно сигналить сразу
      if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(gameReady, 50);
      } else {
        document.addEventListener("DOMContentLoaded", function () {
          setTimeout(gameReady, 50);
        });
      }
    });
  }

  function boot() {
    if (!isYandexCandidate()) {
      log("skip: not yandex candidate");
      return;
    }
    log("boot yandex adapter");
    initSdk().catch(function (err) {
      console.warn("[yandex] SDK init failed, staying in web mode", err);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
