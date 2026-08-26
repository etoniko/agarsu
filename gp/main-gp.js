/**
 * Agar.su — GamePush SDK adapter
 * Заменяет Яндекс.Игры: инициализация, GameReady, прогресс, реклама, звук, покупки, скрытие неподдерживаемых фич.
 */
(function () {
  "use strict";

  var GP_PROJECT_ID = 25200;
  var GP_PUBLIC_TOKEN = "5DXsYLvhOpBnuHjsIdeupMHEmkpKu24m";
  var FULL_SITE_URL = "https://agar.su/";

  var gp = null;
  var gpReady = false;
  var gameplayActive = false;
  var sessionStartedAt = 0;
  var sessionTimeAcc = 0;
  var sessionMaxMass = 0;
  var lastMassSeen = 0;
  var tickTimer = null;
  var deathArmed = false;
  var preloaderCalled = false;
  var uiApplied = false;
  var adAvailable = false;
  var socialSupported = false;
  var backendSupported = false;
  var purchasesSupported = false;
  var isMobilePlatform = false;

  /** Клиентская XP-статистика */
  var stats = loadStats();
  var W_TIME = 2;
  var W_MASS = 3;
  var W_KILL = 50;
  var W_DEATH = 15;
  var KILL_MASS_JUMP = 18;
  var STATS_KEY = "gp_client_stats_v1";
  var NICK_KEY = "gp_display_nick";

  function log() {
    try {
      if (window.__GP_DEBUG__) console.log.apply(console, ["[gp]"].concat([].slice.call(arguments)));
    } catch (e) {}
  }

  // ─── Статистика (localStorage) ───
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
    try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
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
    return Math.floor(Math.pow(level, 2) * 50);
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
      try { nick = localStorage.getItem(NICK_KEY) || ""; } catch (e) {}
    }
    if (nick) {
      try { localStorage.setItem(NICK_KEY, nick.slice(0, 16)); } catch (e2) {}
    }
    return nick || "Player";
  }

  function parseDomMass() {
    var maxEl = document.getElementById("score-max");
    var curEl = document.getElementById("score-new");
    var max = 0, cur = 0;
    if (maxEl) { var m = String(maxEl.textContent || "").match(/(\d+)/); if (m) max = parseInt(m[1], 10) || 0; }
    if (curEl) { var c = String(curEl.textContent || "").match(/(\d+)/); if (c) cur = parseInt(c[1], 10) || 0; }
    return { max: max, cur: cur };
  }

  // ─── Игровая сессия ───
  function flushSessionTime() {
    if (!sessionStartedAt) return;
    var delta = Math.floor((Date.now() - sessionStartedAt) / 1000);
    sessionStartedAt = gameplayActive ? Date.now() : 0;
    if (delta > 0) { sessionTimeAcc += delta; stats.timeSec += delta; }
  }

  function onMassSample(cur, max) {
    if (max > sessionMaxMass) sessionMaxMass = max;
    if (max > stats.maxMass) stats.maxMass = max;
    if (cur > lastMassSeen) {
      var jump = cur - lastMassSeen;
      if (gameplayActive && jump >= KILL_MASS_JUMP) {
        var approxKills = Math.max(1, Math.floor(jump / 40));
        stats.kills += approxKills;
      }
    }
    lastMassSeen = cur;
  }

  function onDeath() {
    stats.deaths += 1;
    flushSessionTime();
    if (sessionMaxMass > stats.maxMass) stats.maxMass = sessionMaxMass;
    recomputeXp();
    saveProgressToGp();
    refreshProgressUi();
    log("death", stats.deaths, "xp", stats.xp);
  }

  // ─── GamePush: GameReady / GameStart ───
  function gameReady() {
    if (!gp || !gpReady) return;
    try {
      if (typeof gp.gameReady === "function") gp.gameReady();
      else if (typeof gp.gameStart === "function") gp.gameStart();
      log("gameReady/gameStart called");
    } catch (e) { log("gameReady fail", e); }
    callPreloader();
  }

  function callPreloader() {
    if (preloaderCalled || !gp) return;
    preloaderCalled = true;
    try {
      if (gp.features && typeof gp.features.loadingStart === "function") {
        gp.features.loadingStart();
      }
      if (typeof gp.preloader === "function") {
        gp.preloader();
      }
      log("preloader called");
    } catch (e) { log("preloader fail", e); }
  }

  // ─── Прогресс (сохранение / загрузка через GamePush player) ───
  function saveProgressToGp() {
    if (!gp || !gp.player || typeof gp.player.set !== "function") return;
    try {
      gp.player.set("stats", stats);
      gp.player.set("savedAt", Date.now());
      log("progress saved to gp player");
    } catch (e) { log("save progress fail", e); }
  }

  function loadProgressFromGp() {
    if (!gp || !gp.player || typeof gp.player.get !== "function") return;
    try {
      var saved = gp.player.get("stats");
      if (saved && typeof saved.timeSec === "number") {
        // Берём максимум — чтобы не потерять прогресс между сессиями
        stats.timeSec = Math.max(stats.timeSec, saved.timeSec | 0);
        stats.maxMass = Math.max(stats.maxMass, saved.maxMass | 0);
        stats.kills = Math.max(stats.kills, saved.kills | 0);
        stats.deaths = Math.max(stats.deaths, saved.deaths | 0);
        stats.xp = Math.max(stats.xp, saved.xp | 0);
        recomputeXp();
        log("progress loaded from gp player", stats);
      }
    } catch (e) { log("load progress fail", e); }
    saveProgressToGp();
  }

  // ─── Gameplay API (CrazyGames / GamePush) ───
  function gameplayStart() {
    if (gameplayActive) return;
    gameplayActive = true;
    sessionStartedAt = Date.now();
    sessionTimeAcc = 0;
    sessionMaxMass = 0;
    lastMassSeen = 0;
    var m = parseDomMass();
    lastMassSeen = m.cur;
    deathArmed = true;
    try {
      if (gp && gp.features && typeof gp.features.gameplayStart === "function") {
        gp.features.gameplayStart();
      }
    } catch (e) {}
    startTicker();
    log("gameplayStart");
  }

  function gameplayStop(submitScore) {
    if (!gameplayActive && !sessionStartedAt) return;
    var wasActive = gameplayActive;
    gameplayActive = false;
    flushSessionTime();
    if (sessionMaxMass > stats.maxMass) stats.maxMass = sessionMaxMass;
    recomputeXp();
    try {
      if (gp && gp.features && typeof gp.features.gameplayStop === "function") {
        gp.features.gameplayStop();
      }
    } catch (e) {}
    stopTicker();
    refreshProgressUi();
    log("gameplayStop", stats.xp);
    if (wasActive) { deathArmed = false; }
    saveProgressToGp();
  }

  function startTicker() {
    if (tickTimer) return;
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
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  // ─── Реклама за вознаграждение (Rewarded) ───
  var rewardAdCallback = null;

  function isRewardAdAvailable() {
    if (!gp || !adAvailable) return false;
    try {
      if (gp.ads && typeof gp.ads.isRewardedAvailable === "function") {
        return gp.ads.isRewardedAvailable();
      }
      return adAvailable;
    } catch (e) { return false; }
  }

  function showRewardedAd(callback) {
    if (!isRewardAdAvailable()) {
      log("rewarded ad not available");
      if (callback) callback(false);
      return;
    }
    rewardAdCallback = callback;
    try {
      // Выключаем звук на время рекламы
      if (gp.sound && typeof gp.sound.pause === "function") gp.sound.pause();

      gp.ads.showRewardedVideo({
        callbacks: {
          onRewarded: function () {
            log("rewarded ad — rewarded");
            if (rewardAdCallback) { rewardAdCallback(true); rewardAdCallback = null; }
          },
          onClose: function (wasShown) {
            // Восстанавливаем звук
            if (gp.sound && typeof gp.sound.resume === "function") gp.sound.resume();
            if (wasShown) {
              log("rewarded ad — closed, was shown");
              if (rewardAdCallback) { rewardAdCallback(true); rewardAdCallback = null; }
            } else {
              log("rewarded ad — closed, NOT shown");
              if (rewardAdCallback) { rewardAdCallback(false); rewardAdCallback = null; }
            }
          },
          onError: function (err) {
            log("rewarded ad error", err);
            if (gp.sound && typeof gp.sound.resume === "function") gp.sound.resume();
            if (rewardAdCallback) { rewardAdCallback(false); rewardAdCallback = null; }
          }
        }
      });
    } catch (e) {
      log("showRewardedAd fail", e);
      if (gp.sound && typeof gp.sound.resume === "function") gp.sound.resume();
      if (rewardAdCallback) { rewardAdCallback(false); rewardAdCallback = null; }
    }
  }

  // ─── Покупки ───
  var pendingPurchaseCallback = null;

  function checkPurchasesSupported() {
    if (!gp) return false;
    try {
      return gp.payments && typeof gp.payments.isAvailable === "function" && gp.payments.isAvailable();
    } catch (e) { return false; }
  }

  function processUnspentPurchases() {
    if (!gp || !purchasesSupported) return;
    try {
      if (gp.payments && typeof gp.payments.getUnprocessed === "function") {
        var unprocessed = gp.payments.getUnprocessed();
        if (unprocessed && unprocessed.length) {
          for (var i = 0; i < unprocessed.length; i++) {
            var purchase = unprocessed[i];
            log("unspent purchase:", purchase);
            if (purchase.tag === "xp_bonus" || purchase.tag === "bonus") {
              stats.xp += 500;
              recomputeXp();
              refreshProgressUi();
              saveProgressToGp();
            }
            try { gp.payments.consume(purchase.id); } catch (e2) {}
          }
        }
      }
    } catch (e) { log("processUnspentPurchases fail", e); }
  }

  function buyItem(tag, callback) {
    if (!purchasesSupported || !gp) {
      if (callback) callback(false);
      return;
    }
    pendingPurchaseCallback = callback;
    try {
      gp.payments.purchase({
        tag: tag,
        callbacks: {
          onSuccess: function () {
            log("purchase success", tag);
            if (pendingPurchaseCallback) { pendingPurchaseCallback(true); pendingPurchaseCallback = null; }
          },
          onError: function (err) {
            log("purchase error", err);
            if (pendingPurchaseCallback) { pendingPurchaseCallback(false); pendingPurchaseCallback = null; }
          }
        }
      });
    } catch (e) {
      log("buyItem fail", e);
      if (pendingPurchaseCallback) { pendingPurchaseCallback(false); pendingPurchaseCallback = null; }
    }
  }

  // ─── Язык через SDK ───
  function detectLangViaSdk() {
    if (!gp) return;
    try {
      var lang = null;
      if (gp.language && typeof gp.language.get === "function") lang = gp.language.get();
      if (!lang && gp.environment && gp.environment.i18n && gp.environment.i18n.lang) lang = gp.environment.i18n.lang;
      if (!lang) return;
      var supported = ["ru", "en", "tr", "uk", "zh", "ar", "es", "pl", "de"];
      if (supported.indexOf(lang) !== -1) {
        if (typeof window.setUiLang === "function") window.setUiLang(lang);
      } else {
        // Любой неподдерживаемый → английский
        if (typeof window.setUiLang === "function") window.setUiLang("en");
      }
      log("lang detected via SDK:", lang);
    } catch (e) {}
  }

  // ─── Звук через GamePush SDK ───
  var soundOn = true;

  function initSoundControl() {
    if (!gp || !gp.sound) return;
    // GamePush SDK управляет глобальным звуком
    try {
      if (typeof gp.sound.isOn === "function") soundOn = gp.sound.isOn();
    } catch (e) {}
  }

  function toggleSound() {
    if (!gp || !gp.sound) {
      // Fallback — просто переключаем флаг
      soundOn = !soundOn;
      updateSoundButton();
      return;
    }
    try {
      soundOn = !soundOn;
      if (soundOn) {
        if (typeof gp.sound.on === "function") gp.sound.on();
      } else {
        if (typeof gp.sound.off === "function") gp.sound.off();
      }
      updateSoundButton();
    } catch (e) { log("toggleSound fail", e); }
  }

  function updateSoundButton() {
    var btn = document.getElementById("gpSoundBtn");
    if (!btn) return;
    var icon = btn.querySelector("i");
    if (icon) {
      icon.className = soundOn ? "fas fa-volume-up" : "fas fa-volume-mute";
    }
    btn.title = soundOn ? "Выключить звук" : "Включить звук";
  }

  // ─── UI — скрытие неподдерживаемых фич ───
  function applyPlatformUi() {
    if (uiApplied) return;
    uiApplied = true;

    injectStyles();

    // Социальные кнопки — скрываем, если не поддерживаются
    if (!socialSupported) {
      var socialEl = document.querySelector(".social");
      if (socialEl) socialEl.style.display = "none";
    }

    // Функции с бэкендом — скрываем, если не поддерживаются
    if (!backendSupported) {
      var footer = document.querySelector(".footer");
      if (footer) footer.style.display = "none";
      // Лидерборд, рейтинг, статистика — оставляем local
    }

    // Если реклама (rewarded) недоступна — скрываем кнопки и упоминания
    if (!adAvailable) {
      // Убираем рекламные блоки
      var addYandex = document.querySelector(".add-yandex");
      if (addYandex) addYandex.style.display = "none";
      var ratingHome = document.querySelector(".rating-home");
      if (ratingHome) ratingHome.style.display = "none";
    }

    // Патчим меню
    patchMenu();
    patchShop();
    addSoundButton();
    updateSoundButton();
    refreshProgressUi();
    wrapPlayHooks();
  }

  function injectStyles() {
    if (document.getElementById("gp-adapter-style")) return;
    var css = document.createElement("style");
    css.id = "gp-adapter-style";
    css.textContent = [
      "body.gp-mode .social{display:none!important}",
      "body.gp-mode #authlog{display:none!important}",
      "body.gp-mode #myNicknamesBlock{display:none!important}",
      "body.gp-mode #accountID{display:none!important}",
      "body.gp-mode .footer{display:none!important}",
      "body.gp-mode .add-yandex{display:none!important}",
      "body.gp-mode .death{display:block!important}",
      "body.gp-mode .rating-home{display:none!important}",
      "body.gp-mode #shop > :not(.gp-shop-cta){display:none!important}",
      "body.gp-mode #shop .gp-shop-cta,",
      "body.gp-mode .gp-shop-cta{",
      "display:flex!important;flex-direction:column;align-items:center;justify-content:center;",
      "gap:14px;padding:32px 20px;text-align:center;min-height:300px;width:100%;box-sizing:border-box;",
      "}",
      "body.gp-mode .gp-shop-cta h3{margin:0;font-size:22px;}",
      "body.gp-mode .gp-shop-cta p{margin:0;max-width:380px;opacity:.9;line-height:1.45;}",
      "body.gp-mode .gp-shop-cta .gp-web-btn{",
      "display:inline-flex;align-items:center;gap:8px;padding:14px 26px;border:0;border-radius:10px;",
      "background:#2f6fed;color:#fff;font-weight:700;cursor:pointer;font-size:16px;",
      "}",
      "body.gp-mode .gp-web-btn:hover{filter:brightness(1.08);}",
      "body.gp-mode .progress-container{display:block!important;}",
      ".gp-sound-btn{position:fixed;top:10px;left:10px;z-index:1000;width:40px;height:40px;",
      "border-radius:50%;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.15);",
      "color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;",
      "transition:background .15s;}",
      ".gp-sound-btn:hover{background:rgba(0,0,0,.75);}",
      "@media (max-width:768px){.gp-sound-btn{top:8px;left:8px;width:36px;height:36px;font-size:16px;}}"
    ].join("");
    document.head.appendChild(css);
  }

  function addSoundButton() {
    if (document.getElementById("gpSoundBtn")) return;
    var btn = document.createElement("button");
    btn.id = "gpSoundBtn";
    btn.className = "gp-sound-btn";
    btn.type = "button";
    btn.innerHTML = '<i class="fas fa-volume-up"></i>';
    btn.addEventListener("click", toggleSound);
    document.body.appendChild(btn);
  }

  function patchMenu() {
    // Меняем "Магазин" на "Настройки"
    var shopItem = document.querySelector('.menu-item[onclick="showContent(\'shop\')"]');
    if (shopItem) {
      shopItem.setAttribute("onclick", "showContent('settings')");
      var icon = shopItem.querySelector("i");
      if (icon) icon.className = "fas fa-gear";
      var label = shopItem.querySelector(".label");
      if (label) {
        label.textContent = "Настройки";
        label.setAttribute("data-ru", "Настройки");
        label.setAttribute("data-en", "Settings");
      }
      // Убираем NEW badge
      var badge = shopItem.querySelector(".badge-text");
      if (badge) badge.style.display = "none";
    }

    // Меняем "Войти" на "Настройки"
    var storeItem = document.querySelector('.menu-item[onclick="showContent(\'store\')"]');
    if (storeItem) {
      storeItem.setAttribute("onclick", "showContent('settings')");
      var sIcon = storeItem.querySelector("i");
      if (sIcon) sIcon.className = "fas fa-gear";
      forceSettingsLabel();
    }
  }

  function patchShop() {
    var shop = document.getElementById("shop");
    if (!shop) return;
    var cta = shop.querySelector(".gp-shop-cta");
    if (!cta) {
      cta = document.createElement("div");
      cta.className = "gp-shop-cta";
      cta.innerHTML =
        "<h3>Магазин на сайте</h3>" +
        "<p>Покупка скинов, паролей и доп. функций доступна только в полной версии на <b>agar.su</b>.</p>" +
        '<button type="button" class="gp-web-btn" id="gpOpenFullSite">' +
        '<i class="fas fa-globe"></i><span>Открыть Web — agar.su</span></button>' +
        "<p style=\"font-size:12px;opacity:.7\">Откроется сайт вне площадки.</p>";
      shop.appendChild(cta);
      var gpBtn = cta.querySelector("#gpOpenFullSite");
      if (gpBtn) {
        gpBtn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          try { window.open(FULL_SITE_URL, "_blank", "noopener"); } catch (e) { location.href = FULL_SITE_URL; }
        });
      }
    }
    for (var i = 0; i < shop.children.length; i++) {
      var ch = shop.children[i];
      if (ch.classList && ch.classList.contains("gp-shop-cta")) ch.style.display = "flex";
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

  function refreshProgressUi() {
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

    var progressContainer = document.querySelector(".progress-container");
    if (progressContainer) progressContainer.style.display = "";
  }

  function blockServerXpUi() {
    var prev = window.onUpdateXp;
    if (typeof prev === "function" && prev.__gpBlocked) return true;
    window.onUpdateXp = function () { refreshProgressUi(); };
    window.onUpdateXp.__gpBlocked = true;
    return true;
  }

  function wrapPlayHooks() {
    function wrap(name, afterStart) {
      var prev = window[name];
      if (typeof prev !== "function" || prev.__gpWrapped) return false;
      window[name] = function () {
        var r = prev.apply(this, arguments);
        if (afterStart) gameplayStart();
        return r;
      };
      window[name].__gpWrapped = true;
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

    // Observer на overlays — смерть / возврат в меню
    var overlays = document.getElementById("overlays");
    if (overlays && !overlays.__gpObserved) {
      overlays.__gpObserved = true;
      var obs = new MutationObserver(function () {
        var shown = overlays.style.display !== "none" && getComputedStyle(overlays).display !== "none";
        if (shown && (gameplayActive || deathArmed)) {
          if (deathArmed && (gameplayActive || sessionStartedAt)) {
            onDeath();
            deathArmed = false;
          }
          gameplayStop(true);
        }
      });
      obs.observe(overlays, { attributes: true, attributeFilter: ["style", "class"] });
    }

    // Mass observer с HUD
    ["score-max", "score-new"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.__gpMassObs) return;
      el.__gpMassObs = true;
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
    window.addEventListener("pagehide", function () { gameplayStop(true); });
  }

  function wrapShowContent() {
    var origShow = window.showContent;
    if (typeof origShow !== "function" || origShow.__gpWrapped) return;
    window.showContent = function (id) {
      if (id === "store") id = "settings";
      if (id === "shop") id = "settings";
      var ret = origShow(id);
      if (id === "home") refreshProgressUi();
      return ret;
    };
    window.showContent.__gpWrapped = true;
  }

  // ─── Определение возможностей платформы ───
  function detectPlatformFeatures() {
    if (!gp) return;
    try {
      // Социальные функции
      if (gp.socials) socialSupported = true;
      // Реклама
      if (gp.ads) adAvailable = true;
      // Покупки
      purchasesSupported = checkPurchasesSupported();
      // Мобильное устройство
      if (gp.device && typeof gp.device.isMobile === "function") {
        isMobilePlatform = gp.device.isMobile();
      }
      log("features:", { social: socialSupported, ad: adAvailable, purchases: purchasesSupported, mobile: isMobilePlatform });
    } catch (e) {}
  }

  // ─── Инициализация GamePush ───
  // Регистрируем onGPInit синхронно (SDK-лоадер вызовет его сразу после загрузки)
  window.onGPInit = function (sdk) {
    gp = sdk;
    window.gp = sdk;
    window.__AGARSU_GP__ = true;
    gpReady = true;
    log("GamePush SDK ready");

    // Отложенная инициализация UI (ждём DOM)
    function afterDom() {
      detectPlatformFeatures();
      detectLangViaSdk();
      initSoundControl();
      loadProgressFromGp();
      processUnspentPurchases();
      applyPlatformUi();
      gameReady();
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", afterDom);
    } else {
      afterDom();
    }
  };

  // ─── Экспорт API ───
  window.__GP_STATS__ = function () { return Object.assign({}, stats, { xp: calcXp(stats) }); };
  window.__GP_SHOW_REWARDED__ = showRewardedAd;
  window.__GP_BUY__ = buyItem;
  window.__GP_TOGGLE_SOUND__ = toggleSound;
  window.__GP_SOUND_ON__ = function () { return soundOn; };

  // Fallback: если SDK не загрузился за 6 секунд — запускаем без GP
  setTimeout(function () {
    if (!gpReady) {
      log("SDK не ответил — запускаем без GP");
      applyPlatformUi();
      refreshProgressUi();
    }
  }, 6000);
})();