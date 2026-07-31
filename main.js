(() => {
  var log = {
    info(str) {
      console.debug("[INFO]", str);
    },
    warn(str) {
      console.warn("[WARN]", str);
    },
    err(str) {
      console.error("[ERROR] ", str);
    },
    debug(str) {
      console.info("[DEBUG] ", str);
    }
  };
  if (typeof window !== "undefined") {
    window.log = log;
  }
  function Vector2(x, y) {
    this.x = x || 0;
    this.y = y || 0;
  }
  Vector2.prototype = {
    reset(x, y) {
      this.x = x;
      this.y = y;
      return this;
    },
    toString(decPlaces) {
      decPlaces = decPlaces || 3;
      const scalar = Math.pow(10, decPlaces);
      return "[" + Math.round(this.x * scalar) / scalar + ", " + Math.round(this.y * scalar) / scalar + "]";
    },
    clone() {
      return new Vector2(this.x, this.y);
    },
    copyTo(v) {
      v.x = this.x;
      v.y = this.y;
    },
    copyFrom(v) {
      this.x = v.x;
      this.y = v.y;
    },
    magnitude() {
      return Math.sqrt(this.x * this.x + this.y * this.y);
    },
    magnitudeSquared() {
      return this.x * this.x + this.y * this.y;
    },
    normalise() {
      const m = this.magnitude();
      this.x = this.x / m;
      this.y = this.y / m;
      return this;
    },
    reverse() {
      this.x = -this.x;
      this.y = -this.y;
      return this;
    },
    plusEq(v) {
      this.x += v.x;
      this.y += v.y;
      return this;
    },
    plusNew(v) {
      return new Vector2(this.x + v.x, this.y + v.y);
    },
    minusEq(v) {
      this.x -= v.x;
      this.y -= v.y;
      return this;
    },
    minusNew(v) {
      return new Vector2(this.x - v.x, this.y - v.y);
    },
    multiplyEq(scalar) {
      this.x *= scalar;
      this.y *= scalar;
      return this;
    },
    multiplyNew(scalar) {
      return this.clone().multiplyEq(scalar);
    },
    divideEq(scalar) {
      this.x /= scalar;
      this.y /= scalar;
      return this;
    },
    divideNew(scalar) {
      return this.clone().divideEq(scalar);
    },
    dot(v) {
      return this.x * v.x + this.y * v.y;
    },
    angle(useRadians) {
      return Math.atan2(this.y, this.x) * (useRadians ? 1 : Vector2Const.TO_DEGREES);
    },
    rotate(angle, useRadians) {
      const cosRY = Math.cos(angle * (useRadians ? 1 : Vector2Const.TO_RADIANS));
      const sinRY = Math.sin(angle * (useRadians ? 1 : Vector2Const.TO_RADIANS));
      Vector2Const.temp.copyFrom(this);
      this.x = Vector2Const.temp.x * cosRY - Vector2Const.temp.y * sinRY;
      this.y = Vector2Const.temp.x * sinRY + Vector2Const.temp.y * cosRY;
      return this;
    },
    equals(v) {
      return this.x == v.x && this.y == v.x;
    },
    isCloseTo(v, tolerance) {
      if (this.equals(v)) return true;
      Vector2Const.temp.copyFrom(this);
      Vector2Const.temp.minusEq(v);
      return Vector2Const.temp.magnitudeSquared() < tolerance * tolerance;
    },
    rotateAroundPoint(point, angle, useRadians) {
      Vector2Const.temp.copyFrom(this);
      Vector2Const.temp.minusEq(point);
      Vector2Const.temp.rotate(angle, useRadians);
      Vector2Const.temp.plusEq(point);
      this.copyFrom(Vector2Const.temp);
    },
    isMagLessThan(distance) {
      return this.magnitudeSquared() < distance * distance;
    },
    isMagGreaterThan(distance) {
      return this.magnitudeSquared() > distance * distance;
    }
  };
  var Vector2Const = {
    TO_DEGREES: 180 / Math.PI,
    TO_RADIANS: Math.PI / 180,
    temp: null
  };
  Vector2Const.temp = new Vector2;
  if (typeof window !== "undefined") {
    window.Vector2 = Vector2;
    window.Vector2Const = Vector2Const;
  }
  var AppEvents = class extends EventTarget {
    emit(type, detail) {
      this.dispatchEvent(new CustomEvent(type, {
        detail
      }));
    }
    on(type, handler) {
      this.addEventListener(type, handler);
      return () => this.removeEventListener(type, handler);
    }
  };
  var bus = new AppEvents;
  var Events = {
    SHOW_CONTENT: "show-content",
    XP_UPDATE: "xp-update",
    DEATH: "death",
    BAN: "ban",
    AUTH: "auth",
    LOGOUT: "logout",
    SERVER_CHANGE: "server-change"
  };
  function getCookie(name) {
    const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : void 0;
  }
  function cookieSecurityFlags() {
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
    return `; path=/; SameSite=Lax${secure}`;
  }
  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date;
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1e3);
      expires = "; expires=" + date.toUTCString();
    }
    const encoded = encodeURIComponent(value == null ? "" : String(value));
    document.cookie = name + "=" + encoded + expires + cookieSecurityFlags();
  }
  function deleteCookie(name) {
    document.cookie = name + "=; Max-Age=0" + cookieSecurityFlags();
  }
  var TOKEN_KEY = "accountToken";
  var memory = Object.create(null);
  function canUseStorage(store) {
    try {
      if (!store) return false;
      const probe = "__agarsu_storage_probe__";
      store.setItem(probe, "1");
      const ok = store.getItem(probe) === "1";
      store.removeItem(probe);
      return ok;
    } catch (e) {
      return false;
    }
  }
  function lsGetJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function lsSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }
  function lsSetJson(key, value) {
    return lsSet(key, JSON.stringify(value));
  }
  function lsRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }
  function readTokenCandidates() {
    const values = [];
    try {
      const fromLs = localStorage.getItem(TOKEN_KEY);
      if (fromLs) values.push(fromLs);
    } catch (e) {}
    try {
      if (localStorage[TOKEN_KEY]) values.push(localStorage[TOKEN_KEY]);
    } catch (e) {}
    try {
      const fromSs = sessionStorage.getItem(TOKEN_KEY);
      if (fromSs) values.push(fromSs);
    } catch (e) {}
    try {
      const fromCookie = getCookie(TOKEN_KEY);
      if (fromCookie) values.push(fromCookie);
    } catch (e) {}
    if (memory[TOKEN_KEY]) values.push(memory[TOKEN_KEY]);
    return values.find(v => typeof v === "string" && v.trim()) || null;
  }
  function writeTokenEverywhere(token) {
    memory[TOKEN_KEY] = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {}
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch (e) {}
    try {
      setCookie(TOKEN_KEY, token, 30);
    } catch (e) {}
  }
  function clearTokenEverywhere() {
    delete memory[TOKEN_KEY];
    lsRemove(TOKEN_KEY);
    try {
      delete localStorage[TOKEN_KEY];
    } catch (e) {}
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
    try {
      deleteCookie(TOKEN_KEY);
    } catch (e) {}
  }
  function getAccountToken() {
    const token = readTokenCandidates();
    if (token) {
      try {
        if (localStorage.getItem(TOKEN_KEY) !== token) localStorage.setItem(TOKEN_KEY, token);
      } catch (e) {}
    }
    return token;
  }
  function setAccountToken(token) {
    if (!token) {
      clearTokenEverywhere();
      return;
    }
    writeTokenEverywhere(String(token));
  }
  function clearAccountToken() {
    clearTokenEverywhere();
  }
  function hydrateAccountToken() {
    const token = readTokenCandidates();
    if (!token) return null;
    writeTokenEverywhere(token);
    return token;
  }
  function isStorageReliable() {
    return canUseStorage(window.localStorage);
  }
  function prefersSameWindowAuth() {
    const ua = navigator.userAgent || "";
    if (/\bElectron\b/i.test(ua)) return true;
    if (!isStorageReliable()) return true;
    return false;
  }
  var GAME_SERVERS = {
    ffa: {
      host: "ffa.agar.su",
      title: "FFA - Москва"
    },
    ffa1: {
      host: "sixz.ru/ffa1",
      title: "FFA - Москва 2"
    },
    ms: {
      host: "ffa.agar.su:6002",
      title: "MegaSplit"
    },
    pvp1: {
      host: "ffa.agar.su:6004",
      title: "pvp1: 1x1 ffa 1k"
    },
    pvp2: {
      host: "ffa.agar.su:6005",
      title: "pvp2: 2x2 ms 1k"
    },
    tournament2: {
      host: "ffa.agar.su:6007",
      title: "Tournament 2x2"
    },
    tournament: {
      host: "ffa.agar.su:6006",
      title: "Tournament 3x3"
    }
  };
  var SERVERS = Object.fromEntries(Object.entries(GAME_SERVERS).map(([id, s]) => [ id, s.host ]));
  function findGameServer(hostOrUrl) {
    if (!hostOrUrl) return GAME_SERVERS.ffa;
    return Object.values(GAME_SERVERS).find(s => s.host === hostOrUrl) || null;
  }
  function getPowApiBase(hostOrUrl) {
    const entry = findGameServer(hostOrUrl);
    const host = entry ? entry.host : hostOrUrl || GAME_SERVERS.ffa.host;
    if (/^https?:\/\//i.test(host)) return String(host).replace(/\/$/, "");
    return "https://" + String(host).replace(/^wss?:\/\//i, "");
  }
  function getGameServerWssUrl(host) {
    const h = host || GAME_SERVERS.ffa.host;
    return "wss://" + String(h).replace(/^wss?:\/\//i, "");
  }
  var KEYBIND_DEFAULTS = {
    split: 32,
    eject: 87,
    freeze: 70,
    chat: 13,
    coord: 67,
    macroQ: 81,
    macroE: 69,
    macroR: 82,
    macroT: 84,
    macroP: 80,
    menu: 27,
    sticker1: 49,
    sticker2: 50,
    sticker3: 51,
    sticker4: 52,
    sticker5: 53,
    sticker6: 54,
    sticker7: 55,
    sticker8: 56,
    sticker9: 57
  };
  var KEYBIND_LABELS = {
    split: "Split",
    eject: "Eject (масса W)",
    freeze: "Заморозка",
    chat: "Чат",
    coord: "Координаты (C)",
    macroQ: "Q",
    macroE: "E",
    macroR: "R",
    macroT: "T",
    macroP: "P",
    menu: "Меню / пауза UI",
    sticker1: "Стикер 1",
    sticker2: "Стикер 2",
    sticker3: "Стикер 3",
    sticker4: "Стикер 4",
    sticker5: "Стикер 5",
    sticker6: "Стикер 6",
    sticker7: "Стикер 7",
    sticker8: "Стикер 8",
    sticker9: "Стикер 9"
  };
  var ClientOpcode = {
    NICK: 0,
    SPECTATE: 1,
    PING: 2,
    MOUSE: 16,
    SPLIT: 17,
    EJECT_Q: 18,
    Q_UP: 19,
    CLEAR: 20,
    EJECT: 21,
    MACRO_E: 22,
    MACRO_R: 23,
    MACRO_T: 24,
    MACRO_P: 25,
    CHAT: 99,
    STICKER: 200,
    HANDSHAKE_PROTO: 254,
    HANDSHAKE_KEY: 255
  };
  var ServerOpcode = {
    PING: 2,
    UPDATE_NODES: 16,
    UPDATE_CAMERA: 17,
    CLEAR_NODES: 20,
    CUSTOM_LB: 48,
    FFA_LB: 49,
    BORDERS: 64,
    BAN: 91,
    CHAT: 99,
    XP: 114,
    STICKER: 200
  };
  function prepareData(byteLength) {
    return new DataView(new ArrayBuffer(byteLength));
  }
  function encodeHandshake() {
    const proto = prepareData(5);
    proto.setUint8(0, ClientOpcode.HANDSHAKE_PROTO);
    proto.setUint32(1, 5, true);
    const key = prepareData(5);
    key.setUint8(0, ClientOpcode.HANDSHAKE_KEY);
    key.setUint32(1, 0, true);
    return [ proto, key ];
  }
  function encodePing() {
    return new Uint8Array([ ClientOpcode.PING ]);
  }
  function normalizeNick(nick) {
    if (!nick) return "";
    let n = nick.trim();
    if (n.startsWith("[")) {
      const endIndex = n.indexOf("]");
      if (endIndex === -1) return "";
      const innerNick = n.substring(1, endIndex).trim();
      if (!innerNick || innerNick !== n.substring(1, endIndex)) return "";
      return `[${innerNick}]`.toLowerCase();
    }
    if (!n || n.trim() !== n) return "";
    return n.toLowerCase();
  }
  var ONLINE_HUB_URL = "https://api.agar.su:6008/online?1";
  var TOP100_URL = "https://api.agar.su/api/top100";
  var SKINLIST_URL = "https://api.agar.su/skinlist.txt";
  var STICKERLIST_URL = "https://api.agar.su/stickerlist.txt";
  var SKIN_CDN = "https://api.agar.su/skins";
  var STICKER_CDN = "https://api.agar.su/stickers";
  var SKIN_FALLBACK_URL = "https://api.agar.su/skins/4.png";
  var WS_SUBPROTOCOL = "eSejeKSVdysQvZs0ES1H";
  var TTL_MS = 3e5;
  var STATIC_URLS = {
    skinlist: SKINLIST_URL,
    stickerlist: STICKERLIST_URL,
    pass: "https://api.agar.su/pass.txt",
    invisible: "https://api.agar.su/invisible.txt",
    rotation: "https://api.agar.su/rotation.txt",
    word: "/word.txt"
  };
  var cache = new Map;
  var inflight = new Map;
  var SESSION_PREFIX = "agar_static_v1:";
  function sessionKey(url) {
    return SESSION_PREFIX + url;
  }
  function readSessionEntry(url) {
    try {
      const raw = sessionStorage.getItem(sessionKey(url));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (!entry || typeof entry.text !== "string" || typeof entry.at !== "number") return null;
      if (Date.now() - entry.at >= TTL_MS) {
        sessionStorage.removeItem(sessionKey(url));
        return null;
      }
      return entry;
    } catch (e) {
      return null;
    }
  }
  function writeSessionEntry(url, text, at) {
    try {
      sessionStorage.setItem(sessionKey(url), JSON.stringify({
        text,
        at
      }));
    } catch (e) {}
  }
  function rememberText(url, text, at = Date.now()) {
    cache.set(url, {
      text,
      at
    });
    writeSessionEntry(url, text, at);
    return text;
  }
  function fetchStaticText(url, force = false) {
    const now = Date.now();
    const hit = cache.get(url);
    if (!force && hit && now - hit.at < TTL_MS) {
      return Promise.resolve(hit.text);
    }
    if (!force) {
      const stored = readSessionEntry(url);
      if (stored) {
        cache.set(url, stored);
        return Promise.resolve(stored.text);
      }
    }
    const pending = inflight.get(url);
    if (pending) return pending;
    const p = fetch(url).then(res => {
      if (!res.ok) throw new Error(`fetch failed: ${url} (${res.status})`);
      return res.text();
    }).then(text => rememberText(url, text, Date.now())).catch(err => {
      console.error("fetchStaticText:", err);
      if (hit) return hit.text;
      return "";
    }).finally(() => {
      inflight.delete(url);
    });
    inflight.set(url, p);
    return p;
  }
  function parseSkinListText(data) {
    const map = new Map;
    const obj = {};
    String(data || "").split("\n").forEach(line => {
      const idx = line.indexOf(":");
      if (idx < 0) return;
      const name = normalizeNick(line.slice(0, idx).trim());
      const id = line.slice(idx + 1).trim();
      if (!name || !id) return;
      map.set(name, id);
      obj[name] = id;
    });
    return {
      map,
      obj
    };
  }
  async function loadSkinListMap(force = false) {
    const text = await fetchStaticText(STATIC_URLS.skinlist, force);
    return parseSkinListText(text);
  }
  function parseStickerListText(data) {
    const map = new Map;
    const obj = {};
    String(data || "").split("\n").forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf(":");
      if (idx < 0) return;
      const name = normalizeNick(trimmed.slice(0, idx).trim());
      const code = trimmed.slice(idx + 1).trim();
      if (!name || !code) return;
      map.set(name, code);
      obj[name] = code;
    });
    return {
      map,
      obj
    };
  }
  async function loadStickerListMap(force = false) {
    const text = await fetchStaticText(STATIC_URLS.stickerlist, force);
    return parseStickerListText(text);
  }
  function applySkinListToState(S, bundle) {
    if (S && (bundle == null ? void 0 : bundle.obj)) S.skinList = bundle.obj;
  }
  function applyStickerListToState(S, bundle) {
    if (S && (bundle == null ? void 0 : bundle.obj)) S.stickerList = bundle.obj;
  }
  function getStickerPackCode(stickerSource, nick) {
    const key = normalizeNick(String(nick || "").replace(/<[^>]*>/g, ""));
    if (!key) return "";
    if (stickerSource instanceof Map) return stickerSource.get(key) || "";
    return (stickerSource == null ? void 0 : stickerSource[key]) || "";
  }
  function getStickerUrl(stickerSource, nick, stickerId) {
    const id = Number(stickerId);
    if (!Number.isFinite(id) || id < 1 || id > 9) return "";
    const code = getStickerPackCode(stickerSource, nick);
    if (code) return `${STICKER_CDN}/${encodeURIComponent(code)}/${id}.png`;
    return `${STICKER_CDN}/${id}.png`;
  }
  function getSkinIdForNick(skinSource, nick, fallback = "PPFtwqH") {
    const key = normalizeNick(String(nick || "").replace(/<[^>]*>/g, ""));
    if (!key) return fallback;
    if (skinSource instanceof Map) return skinSource.get(key) || fallback;
    return (skinSource == null ? void 0 : skinSource[key]) || fallback;
  }
  function getSkinUrlForNick(skinSource, nick, fallback = "4") {
    const id = getSkinIdForNick(skinSource, nick, fallback);
    return `https://api.agar.su/skins/${id}.png`;
  }
  function invalidateStatsRenderCaches(S) {
    if (S) S.lastStatsRenderKey = "";
  }
  function toLowerSet(text) {
    return new Set(String(text || "").split("\n").map(l => l.trim().toLowerCase().replace(/ё/g, "е")).filter(Boolean));
  }
  async function loadPassData(force = false) {
    const text = await fetchStaticText(STATIC_URLS.pass, force);
    const passPlayerNickToId = new Map;
    const passClanNickToId = new Map;
    const passUsers = [];
    let lineNum = 0;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      lineNum += 1;
      const norm = normalizeNick(trimmed);
      if (!norm) continue;
      passUsers.push(norm);
      const passId = String(lineNum);
      if (norm.startsWith("[") && norm.endsWith("]")) {
        if (!passClanNickToId.has(norm)) passClanNickToId.set(norm, passId);
      } else if (!passPlayerNickToId.has(norm)) {
        passPlayerNickToId.set(norm, passId);
      }
    }
    return {
      passUsers,
      passPlayerNickToId,
      passClanNickToId
    };
  }
  async function loadInvisibleSet(force = false) {
    return toLowerSet(await fetchStaticText(STATIC_URLS.invisible, force));
  }
  async function loadRotationSet(force = false) {
    return toLowerSet(await fetchStaticText(STATIC_URLS.rotation, force));
  }
  async function loadBadWordsSet(force = false) {
    return toLowerSet(await fetchStaticText(STATIC_URLS.word, force));
  }
  async function preloadStaticLists(force = false) {
    const [skin, sticker, pass, invisible, rotation, words] = await Promise.all([ loadSkinListMap(force), loadStickerListMap(force), loadPassData(force), loadInvisibleSet(force), loadRotationSet(force), loadBadWordsSet(force) ]);
    return {
      skin,
      sticker,
      pass,
      invisible,
      rotation,
      words
    };
  }
  var skinImageCache = new Map;
  function getSkinImageUrl(skinId, fallbackId = "4") {
    const id = skinId && String(skinId).trim() || fallbackId;
    return `${SKIN_CDN}/${id}.png`;
  }
  function resolveAssetUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch (e) {
      return url;
    }
  }
  function setImgSrc(img, url) {
    if (!img || !url) return;
    const resolved = resolveAssetUrl(url);
    if (img.dataset.resolvedSrc === resolved) return;
    img.dataset.resolvedSrc = resolved;
    img.src = resolved;
  }
  function loadCachedImage(url) {
    const entry = skinImageCache.get(url);
    if (entry instanceof Image) return entry;
    if (entry === "error") {
      if (url === SKIN_FALLBACK_URL) return null;
      return loadCachedImage(SKIN_FALLBACK_URL);
    }
    const img = new Image;
    img.decoding = "async";
    skinImageCache.set(url, img);
    img.onload = () => skinImageCache.set(url, img);
    img.onerror = () => {
      skinImageCache.set(url, "error");
      if (url !== SKIN_FALLBACK_URL) loadCachedImage(SKIN_FALLBACK_URL);
    };
    img.src = url;
    return img;
  }
  function getSkinImage(skinId) {
    return loadCachedImage(getSkinImageUrl(skinId));
  }
  var scoreMessages = {
    low: [ "Ничего, зови друзей и попробуй ещё раз!", "Только начало! Поделись с друзьями и вернись сильным!", "Быстро умер? Зови друзей, пусть они покажут мастерство!", "Не расстраивайся, каждая игра — это опыт. Попробуй снова!", "Попробуй поменять фон в настройках — может, поможет!", "Используй F, чтобы остановиться и обдумать стратегию!", "Терпение и стратегия важнее скорости!", "Нажимая W — выделяется цешка (маленькая масса)." ],
    mid: [ "Неплохо! Позови друзей и бросьте друг другу вызов!", "Хорошая игра! Поделись результатом и зови друзей!", "Ты уже на полпути! Продолжай и удиви всех!", "F — для паузы и стратегии. Используй с умом!", "W — цешка. Корми врагов или заманивай!" ],
    high: [ "Вау! Легендарный результат! Делись с друзьями!", "Ты на вершине! Покажи, кто настоящий чемпион!", "Превосходно! Каждый шаг — как по учебнику!", "Настройки фона — твой стиль, твоя концентрация!", "F в нужный момент — контроль даже на вершине!", "Ты — мастер! Бей рекорды дальше!" ]
  };
  function setPingDisplay(ping) {
    const pingElement = document.getElementById("ping");
    if (!pingElement) return;
    pingElement.textContent = ping;
    pingElement.classList.remove("ping-green", "ping-yellow", "ping-red");
    if (ping >= 0 && ping < 50) pingElement.classList.add("ping-green"); else if (ping >= 50 && ping < 150) pingElement.classList.add("ping-yellow"); else pingElement.classList.add("ping-red");
  }
  function calcUserScore(S) {
    let score = 0;
    for (let i = 0; i < S.playerCells.length; i++) {
      score += S.playerCells[i].nSize * S.playerCells[i].nSize;
    }
    return score;
  }
  function updateStats(S) {
    var _a;
    const currentScore = Math.floor(calcUserScore(S) / 100);
    const cellCount = S.playerCells.length;
    if (currentScore > S.maxScore) {
      S.maxScore = currentScore;
      const elMax = document.getElementById("score-max");
      if (elMax) elMax.innerText = "Максимум: " + S.maxScore;
    }
    const elCurrent = document.getElementById("score-new");
    if (elCurrent) {
      const prevScore = parseInt(((_a = elCurrent.innerText.match(/\d+/)) == null ? void 0 : _a[0]) || "0", 10);
      if (currentScore !== prevScore) {
        elCurrent.innerText = "Сейчас: " + currentScore;
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
    return `Моя статистика в Agar.su!\nМаксимальная масса: ${S.maxScore}\nВремя игры: ${Date.now()}`;
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
    window.open(urls[platform] || "", "_blank", `width=${w},height=${h},top=${top},left=${left},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`);
  }
  function initShareHandlers(S) {
    updateShareText(S);
    [ "vk", "telegram", "whatsapp", "facebook", "twitter" ].forEach(p => {
      const btn = document.querySelector(`.${p}`);
      if (btn) btn.addEventListener("click", () => shareStats(p, S));
    });
  }
  var onOverlaysShow = null;
  var onOverlaysHide = null;
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, {
        once: true
      });
    } else {
      fn();
    }
  }
  function byId(id) {
    return document.getElementById(id);
  }
  function isVisible(el) {
    if (!el) return false;
    if (el.hidden) return false;
    if (el.style.display === "none") return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }
  function showElement(el) {
    if (!el) return;
    if (el._savedDisplay != null) {
      el.style.display = el._savedDisplay;
      el._savedDisplay = null;
    } else {
      el.style.removeProperty("display");
    }
  }
  function hideElement(el) {
    if (!el) return;
    if (el.style.display !== "none") {
      el._savedDisplay = el.style.display || "";
    }
    el.style.display = "none";
  }
  function setElementDisplay(el, value) {
    if (!el) return;
    el.style.display = value;
  }
  function isPointerOverElement(el, clientX, clientY) {
    if (!el || !isVisible(el)) return false;
    const rect = el.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }
  function setOverlaysLifecycleHooks({onShow, onHide} = {}) {
    onOverlaysShow = onShow != null ? onShow : null;
    onOverlaysHide = onHide != null ? onHide : null;
  }
  function showOverlays() {
    const el = byId("overlays");
    showElement(el);
    onOverlaysShow == null ? void 0 : onOverlaysShow();
  }
  function hideOverlays() {
    const el = byId("overlays");
    hideElement(el);
    onOverlaysHide == null ? void 0 : onOverlaysHide();
  }
  function isOverlaysVisible() {
    return isVisible(byId("overlays"));
  }
  function showStatics() {
    setElementDisplay(byId("statics"), "flex");
  }
  function hideStatics() {
    hideElement(byId("statics"));
  }
  function mouseCoordinateChange(S) {
    S.X = (S.rawMouseX - S.canvasWidth / 2) / S.viewZoom + S.nodeX;
    S.Y = (S.rawMouseY - S.canvasHeight / 2) / S.viewZoom + S.nodeY;
  }
  function viewRange(S) {
    const ratio = Math.max(S.canvasHeight / 1080, S.canvasWidth / 1920);
    return ratio * S.zoom;
  }
  function calcViewZoom(S) {
    if (0 != S.playerCells.length) {
      let newViewZoom = 0;
      for (let i = 0; i < S.playerCells.length; i++) newViewZoom += S.playerCells[i].size;
      newViewZoom = Math.pow(Math.min(64 / newViewZoom, 1), .4) * viewRange(S);
      S.viewZoom = (9 * S.viewZoom + newViewZoom) / 10;
    }
  }
  function getQualityDprScale(quality) {
    if (quality === "low") return .5;
    if (quality === "medium") return .75;
    return 1;
  }
  function getEffectiveDpr(S) {
    const base = window.devicePixelRatio || 1;
    return base * getQualityDprScale(S && S.renderQuality);
  }
  function canvasResize(S) {
    const wHandle = S.wHandle || window;
    window.scrollTo(0, 0);
    const dpr = getEffectiveDpr(S);
    S.dpr = dpr;
    S.canvasWidth = wHandle.innerWidth * dpr;
    S.canvasHeight = wHandle.innerHeight * dpr;
    if (S.nCanvas) {
      S.nCanvas.width = S.canvasWidth;
      S.nCanvas.height = S.canvasHeight;
      S.nCanvas.style.width = `${wHandle.innerWidth}px`;
      S.nCanvas.style.height = `${wHandle.innerHeight}px`;
    }
  }
  var deps = {
    S: null,
    hooks: {}
  };
  var gridStyleCache = {
    theme: "gradient",
    center: "#132745",
    edge: "#000000",
    at: 0
  };
  var GRID_STYLE_CACHE_MS = 3e3;
  var miniMapEls = null;
  var MINIMAP_DOT_RADIUS = 5;
  var ROW_LETTERS = [ "A", "B", "C", "D", "E" ];
  var screenGradientCache = {
    key: "",
    gradient: null
  };
  var gridThemeSettingsBound = false;
  var perfOverlayEl = null;
  var perfEnabled = typeof location !== "undefined" && new URLSearchParams(location.search).has("perf");
  var perfStats = {
    frame: 0,
    sortMs: 0,
    drawMs: 0,
    qtreeMs: 0,
    miniMapMs: 0,
    nodes: 0,
    drawn: 0,
    movePoints: 0
  };
  function readStored(key, fallback = null) {
    const fromCookie = getCookie(key);
    if (fromCookie !== void 0 && fromCookie !== null && fromCookie !== "") return fromCookie;
    try {
      const fromLs = localStorage.getItem(key);
      if (fromLs != null && fromLs !== "") return fromLs;
    } catch (e) {}
    return fallback;
  }
  function writeStored(key, value, days = 365) {
    setCookie(key, value, days);
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }
  function invalidateGridStyleCache() {
    gridStyleCache.at = 0;
    screenGradientCache.key = "";
    screenGradientCache.gradient = null;
  }
  function getGridStyle() {
    const now = Date.now();
    if (now - gridStyleCache.at > GRID_STYLE_CACHE_MS) {
      gridStyleCache = {
        theme: readStored("grid_theme", "gradient"),
        center: readStored("gradient_center", "#132745"),
        edge: readStored("gradient_edge", "#000000"),
        at: now
      };
      screenGradientCache.key = "";
      screenGradientCache.gradient = null;
    }
    return gridStyleCache;
  }
  function syncGradientSettingsVisibility(theme) {
    const panel = document.getElementById("gradient-settings");
    if (panel) panel.style.display = theme === "gradient" ? "" : "none";
  }
  function applyGridTheme(theme, center, edge) {
    if (theme) writeStored("grid_theme", theme);
    if (center) writeStored("gradient_center", center);
    if (edge) writeStored("gradient_edge", edge);
    invalidateGridStyleCache();
    const style = getGridStyle();
    syncGradientSettingsVisibility(style.theme);
    drawGrid();
  }
  function initGridThemeSettings() {
    if (gridThemeSettingsBound) return;
    const selectElement = document.getElementById("theme-select");
    const centerColor = document.getElementById("gradient-center");
    const edgeColor = document.getElementById("gradient-edge");
    if (!selectElement || !centerColor || !edgeColor) return;
    gridThemeSettingsBound = true;
    const savedTheme = readStored("grid_theme", "gradient");
    const savedCenter = readStored("gradient_center", "#132745");
    const savedEdge = readStored("gradient_edge", "#000000");
    selectElement.value = savedTheme;
    centerColor.value = savedCenter;
    edgeColor.value = savedEdge;
    writeStored("grid_theme", savedTheme);
    writeStored("gradient_center", savedCenter);
    writeStored("gradient_edge", savedEdge);
    invalidateGridStyleCache();
    syncGradientSettingsVisibility(savedTheme);
    selectElement.addEventListener("change", function() {
      applyGridTheme(this.value, null, null);
    });
    const onColorInput = () => {
      applyGridTheme("gradient", centerColor.value, edgeColor.value);
      if (selectElement.value !== "gradient") {
        selectElement.value = "gradient";
      }
    };
    centerColor.addEventListener("input", onColorInput);
    edgeColor.addEventListener("input", onColorInput);
  }
  function buildMiniMapCellMap(cells) {
    const cellMap = new Map;
    if (!cells) return cellMap;
    cells.forEach(span => {
      var _a;
      const key = (_a = span.textContent) == null ? void 0 : _a.trim();
      if (key) cellMap.set(key, span);
    });
    return cellMap;
  }
  function initMiniMapLayout(els = miniMapEls) {
    if (!(els == null ? void 0 : els.dot) || els.ready) return;
    els.dot.style.left = "0";
    els.dot.style.top = "0";
    els.dot.style.willChange = "transform";
    els.dot.style.transform = "translate3d(0,0,0)";
    els.ready = true;
  }
  function getMiniMapEls() {
    var _a;
    const container = document.querySelector(".map-container");
    if (!miniMapEls || miniMapEls.container !== container || !((_a = miniMapEls.dot) == null ? void 0 : _a.isConnected)) {
      const cells = container ? container.querySelectorAll("div > span") : null;
      miniMapEls = {
        mapRoot: document.getElementById("map"),
        dot: document.getElementById("mapposition"),
        container,
        cells,
        cellMap: buildMiniMapCellMap(cells),
        width: (container == null ? void 0 : container.offsetWidth) || 0,
        height: (container == null ? void 0 : container.offsetHeight) || 0,
        ready: false,
        visible: true,
        visibleAt: 0
      };
      initMiniMapLayout(miniMapEls);
    }
    return miniMapEls;
  }
  function isMiniMapOpen() {
    const els = getMiniMapEls();
    const now = Date.now();
    if (now - (els.visibleAt || 0) < 400) return els.visible;
    els.visibleAt = now;
    const mapEl = els.mapRoot || document.getElementById("map");
    els.visible = !!(mapEl && getComputedStyle(mapEl).display !== "none");
    return els.visible;
  }
  function ensurePerfOverlay() {
    if (!perfEnabled || perfOverlayEl) return;
    perfOverlayEl = document.createElement("div");
    perfOverlayEl.id = "perf-overlay";
    perfOverlayEl.style.cssText = "position:fixed;top:48px;left:8px;z-index:99999;background:rgba(0,0,0,.75);color:#0f0;font:12px/1.4 monospace;padding:8px 10px;border-radius:6px;pointer-events:none;white-space:pre";
    document.body.appendChild(perfOverlayEl);
  }
  function updatePerfOverlay(S) {
    var _a, _b;
    if (!perfEnabled) return;
    ensurePerfOverlay();
    perfOverlayEl.textContent = `FPS ${S.fps}\nnodes ${perfStats.nodes} drawn ${perfStats.drawn}\nsort ${perfStats.sortMs.toFixed(2)}ms draw ${perfStats.drawMs.toFixed(2)}ms\nqtree ${perfStats.qtreeMs.toFixed(2)}ms movePts ${perfStats.movePoints}\nminimap ${perfStats.miniMapMs.toFixed(2)}ms\nzoom ${(_a = S.viewZoom) == null ? void 0 : _a.toFixed(2)} cells ${((_b = S.playerCells) == null ? void 0 : _b.length) || 0}`;
    window.__perfStats = {
      ...perfStats,
      fps: S.fps,
      viewZoom: S.viewZoom
    };
  }
  var isBackgroundLoaded = false;
  var isInnerImageLoaded = false;
  var centerBackground = new Image;
  centerBackground.onload = () => {
    var _a;
    isBackgroundLoaded = true;
    if ((_a = deps.S) == null ? void 0 : _a.ctx) drawCenterBackground();
  };
  centerBackground.src = "data:image/png;base64,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";
  var innerImage = new Image;
  innerImage.onload = () => {
    var _a;
    isInnerImageLoaded = true;
    if ((_a = deps.S) == null ? void 0 : _a.ctx) drawCenterBackground();
  };
  innerImage.src = getSkinImageUrl("4");
  var topPlayerNick = "";
  var topPlayerScore = 0;
  var backgroundWidth = 512;
  var backgroundHeight = 512;
  var innerImageWidth = 450;
  var innerImageHeight = 450;
    function attachScene(S, hooks = {}) {
    deps = {
      S,
      hooks
    };
    onReady(() => initGridThemeSettings());
    requestAnimationFrame(() => initMiniMapLayout());
    return {
      redrawGameScene,
      drawGameScene,
      drawGrid,
      drawGradientGrid,
      drawClassicGrid,
      drawBlackGrid,
      drawWhiteGrid,
      drawCenterBackground,
      drawCustomMapBackground,
      updateMiniMapPosition,
      drawTouch,
      drawSplitIcon,
      loadTopPlayerData,
      buildQTree
    };
  }
  function loadTopPlayerData(stat) {
    const S = deps.S;
    if (!S) return;
    try {
      if (!(stat == null ? void 0 : stat.length)) return;
      const topPlayer = stat[0];
      topPlayerNick = topPlayer.nick;
      topPlayerScore = topPlayer.score;
      const skinId = S.skinList[normalizeNick(topPlayer.nick)];
      const nextSrc = getSkinImageUrl(skinId);
      if (innerImage.dataset.skinSrc !== nextSrc) {
        innerImage.dataset.skinSrc = nextSrc;
        isInnerImageLoaded = false;
        innerImage.src = nextSrc;
      }
    } catch (error) {
      console.error("Ошибка обработки данных о топ-1 игроке:", error);
    }
  }
  function buildQTree() {
    const S = deps.S;
    if (!S || !S.Quad) return;
    if (deps.hooks.buildQTree) {
      deps.hooks.buildQTree(S);
      return;
    }
    const t0 = perfEnabled ? performance.now() : 0;
    if (.4 > S.viewZoom || S.renderQuality === "low" || S.renderQuality === "medium") {
      S.qTree = null;
      if (perfEnabled) perfStats.qtreeMs = performance.now() - t0;
      return;
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxSize = 0;
    for (let i = 0; i < S.nodelist.length; i++) {
      const node = S.nodelist[i];
      if (node.shouldRender() && !node.prepareData && 20 < node.size * S.viewZoom) {
        maxSize = Math.max(node.size, maxSize);
        minX = Math.min(node.x, minX);
        minY = Math.min(node.y, minY);
        maxX = Math.max(node.x, maxX);
        maxY = Math.max(node.y, maxY);
      }
    }
    S.qTree = S.Quad.init({
      minX: minX - (maxSize + 100),
      minY: minY - (maxSize + 100),
      maxX: maxX + (maxSize + 100),
      maxY: maxY + (maxSize + 100),
      maxChildren: 2,
      maxDepth: 4
    });
    for (let i = 0; i < S.nodelist.length; i++) {
      const node = S.nodelist[i];
      if (node.shouldRender() && !(20 >= node.size * S.viewZoom)) {
        for (let a = 0; a < node.points.length; ++a) {
          const px = node.points[a].x;
          const py = node.points[a].y;
          if (px < S.nodeX - S.canvasWidth / 2 / S.viewZoom || py < S.nodeY - S.canvasHeight / 2 / S.viewZoom || px > S.nodeX + S.canvasWidth / 2 / S.viewZoom || py > S.nodeY + S.canvasHeight / 2 / S.viewZoom) {
            continue;
          }
          S.qTree.insert(node.points[a]);
        }
      }
    }
    if (perfEnabled) perfStats.qtreeMs = performance.now() - t0;
  }
  function redrawGameScene(now) {
    const S = deps.S;
    if (!S) return;
    const delta = now - S.lastTime;
    S.lastTime = now;
    S.fps = Math.round(1e3 / delta);
    if (now - S.fpsUpdateTime >= 1e3) {
      const fpsEl = document.getElementById("fps");
      if (fpsEl) fpsEl.textContent = S.fps;
      S.fpsUpdateTime = now;
    }
    drawGameScene();
    const tMini = perfEnabled ? performance.now() : 0;
    updateMiniMapPosition();
    if (perfEnabled) perfStats.miniMapMs = performance.now() - tMini;
    (S.wHandle || window).requestAnimationFrame(redrawGameScene);
  }
  function drawGameScene() {
    const S = deps.S;
    if (!(S == null ? void 0 : S.ctx)) return;
    S.frameId = (S.frameId || 0) + 1;
    S.timestamp = Date.now();
    const playerCount = S.playerCells.length;
    if (playerCount > 0) {
      calcViewZoom(S);
      let sumX = 0;
      let sumY = 0;
      for (let i = 0; i < playerCount; i++) {
        const cell = S.playerCells[i];
        cell.updatePos();
        cell._posFrame = S.frameId;
        sumX += cell.x;
        sumY += cell.y;
      }
      const avgX = sumX / playerCount;
      const avgY = sumY / playerCount;
      S.posX = avgX;
      S.posY = avgY;
      S.posSize = S.viewZoom;
      S.nodeX = (S.nodeX + avgX) / 2;
      S.nodeY = (S.nodeY + avgY) / 2;
    } else {
      if (!S.mapBoundsReady) {
        S.posX = (S.leftPos + S.rightPos) / 2;
        S.posY = (S.topPos + S.bottomPos) / 2;
      }
      S.nodeX = (29 * S.nodeX + S.posX) / 30;
      S.nodeY = (29 * S.nodeY + S.posY) / 30;
      S.viewZoom = (9 * S.viewZoom + S.posSize * viewRange(S)) / 10;
    }
    buildQTree();
    mouseCoordinateChange(S);
    drawGrid();
    drawCenterBackground();
    if (S.nodesSortDirty !== false) {
      const tSort = perfEnabled ? performance.now() : 0;
      S.nodelist.sort((a, b) => a.size - b.size || a.id - b.id);
      S.nodesSortDirty = false;
      if (perfEnabled) perfStats.sortMs = performance.now() - tSort;
    } else if (perfEnabled) {
      perfStats.sortMs = 0;
    }
    perfStats.nodes = S.nodelist.length;
    if (perfEnabled) S._perfMovePoints = 0;
    const {ctx, canvasWidth, canvasHeight, viewZoom, nodeX, nodeY} = S;
    const tDraw = perfEnabled ? performance.now() : 0;
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(viewZoom, viewZoom);
    ctx.translate(-nodeX, -nodeY);
    drawCustomMapBackground(ctx);
    for (let i = 0; i < S.nodelist.length; i++) {
      S.nodelist[i].drawOneCell(ctx);
    }
    ctx.restore();
    if (perfEnabled) {
      perfStats.drawMs = performance.now() - tDraw;
      perfStats.movePoints = S._perfMovePoints || 0;
      perfStats.frame = S.frameId;
      updatePerfOverlay(S);
    }
    drawSplitIcon(ctx);
    drawTouch(ctx);
  }
  function drawGrid() {
    const S = deps.S;
    if (!(S == null ? void 0 : S.ctx)) return;
    const {theme} = getGridStyle();
    switch (theme) {
     case "gradient":
      drawGradientGrid();
      break;

     case "white":
      drawWhiteGrid();
      break;

     case "black":
      drawBlackGrid();
      break;

     default:
      drawGradientGrid();
    }
  }
  function drawGradientGrid() {
    const S = deps.S;
    if (!(S == null ? void 0 : S.ctx)) return;
    const {center: centerColor, edge: edgeColor} = getGridStyle();
    const mapCenterX = (S.leftPos + S.rightPos) / 2;
    const mapCenterY = (S.topPos + S.bottomPos) / 2;
    const gradientRadius = Math.hypot(S.rightPos - S.leftPos, S.bottomPos - S.topPos) / 2;
    const {ctx, canvasWidth, canvasHeight, viewZoom, nodeX, nodeY} = S;
    const gx = Math.round(((mapCenterX - nodeX) * viewZoom + canvasWidth / 2) * .5) * 2;
    const gy = Math.round(((mapCenterY - nodeY) * viewZoom + canvasHeight / 2) * .5) * 2;
    const gr = Math.round(gradientRadius * viewZoom * .5) * 2;
    const cacheKey = `${centerColor}|${edgeColor}|${gx}|${gy}|${gr}`;
    if (screenGradientCache.key !== cacheKey) {
      screenGradientCache.key = cacheKey;
      screenGradientCache.gradient = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      screenGradientCache.gradient.addColorStop(0, centerColor);
      screenGradientCache.gradient.addColorStop(1, edgeColor);
    }
    ctx.fillStyle = screenGradientCache.gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
  function drawClassicGrid(bgColor, lineColor) {
    const S = deps.S;
    if (!(S == null ? void 0 : S.ctx)) return;
    const {ctx, canvasWidth, canvasHeight, viewZoom, nodeX, nodeY} = S;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    ctx.scale(viewZoom, viewZoom);
    const vw = canvasWidth / viewZoom;
    const vh = canvasHeight / viewZoom;
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = .1;
    ctx.beginPath();
    let x = -.5 + (-nodeX + vw / 2) % 50;
    for (;x < vw; x += 50) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, vh);
    }
    let y = -.5 + (-nodeY + vh / 2) % 50;
    for (;y < vh; y += 50) {
      ctx.moveTo(0, y);
      ctx.lineTo(vw, y);
    }
    ctx.stroke();
    ctx.restore();
  }
  function drawBlackGrid() {
    drawClassicGrid("#101010", "white");
  }
  function drawWhiteGrid() {
    drawClassicGrid("#F2FBFF", "#111111");
  }
  function drawCenterBackground() {
    const S = deps.S;
    if (!(S == null ? void 0 : S.ctx) || !isBackgroundLoaded) return;
    const mapCenterX = (S.leftPos + S.rightPos) / 2;
    const mapCenterY = (S.topPos + S.bottomPos) / 2;
    const screenX = (mapCenterX - S.nodeX) * S.viewZoom + S.canvasWidth / 2;
    const screenY = (mapCenterY - S.nodeY) * S.viewZoom + S.canvasHeight / 2;
    const scaledBackgroundWidth = backgroundWidth * S.viewZoom;
    const scaledBackgroundHeight = backgroundHeight * S.viewZoom;
    const scaledInnerImageWidth = innerImageWidth * S.viewZoom;
    const scaledInnerImageHeight = innerImageHeight * S.viewZoom;
    const {ctx} = S;
    if (isInnerImageLoaded) {
      ctx.save();
      const radius = Math.min(scaledInnerImageWidth, scaledInnerImageHeight) / 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(innerImage, screenX - scaledInnerImageWidth / 2, screenY - scaledInnerImageHeight / 2, scaledInnerImageWidth, scaledInnerImageHeight);
      ctx.restore();
    }
    ctx.drawImage(centerBackground, screenX - scaledBackgroundWidth / 2, screenY - scaledBackgroundHeight / 2, scaledBackgroundWidth, scaledBackgroundHeight);
    if (topPlayerNick || topPlayerScore) {
      const radius = Math.min(scaledInnerImageWidth, scaledInnerImageHeight) / 2;
      ctx.fillStyle = "white";
      ctx.font = `${22 * S.viewZoom}px Ubuntu`;
      ctx.textAlign = "center";
      if (topPlayerNick) {
        ctx.fillText(topPlayerNick, screenX, screenY + radius - 415 * S.viewZoom);
      }
      if (topPlayerScore) {
        ctx.fillText(`${topPlayerScore}`, screenX, screenY + radius - 15 * S.viewZoom);
      }
    }
  }
  function drawCustomMapBackground(ctx) {
    var _a;
    const S = deps.S;
    if (!S) return;
    if (!S.customMapBgEnabled || !((_a = S.mapBgImage) == null ? void 0 : _a.complete) || !S.mapBgImage.width) return;
    const left = S.leftPos;
    const top = S.topPos;
    const right = S.rightPos;
    const bottom = S.bottomPos;
    const mapW = right - left;
    const mapH = bottom - top;
    if (mapW <= 0 || mapH <= 0) return;
    const halfW = S.canvasWidth / (2 * S.viewZoom);
    const halfH = S.canvasHeight / (2 * S.viewZoom);
    const visLeft = Math.max(left, S.nodeX - halfW);
    const visRight = Math.min(right, S.nodeX + halfW);
    const visTop = Math.max(top, S.nodeY - halfH);
    const visBottom = Math.min(bottom, S.nodeY + halfH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, mapW, mapH);
    ctx.clip();
    if (S.customMapBgMode === "repeat") {
      const tile = Math.max(32, S.customMapBgTileSize | 0);
      const startX = left + Math.floor((visLeft - left) / tile) * tile;
      const startY = top + Math.floor((visTop - top) / tile) * tile;
      for (let x = startX; x < visRight; x += tile) {
        for (let y = startY; y < visBottom; y += tile) {
          ctx.drawImage(S.mapBgImage, x, y, Math.min(tile, right - x), Math.min(tile, bottom - y));
        }
      }
    } else {
      ctx.drawImage(S.mapBgImage, left, top, mapW, mapH);
    }
    ctx.restore();
  }
  function updateMiniMapPosition() {
    const S = deps.S;
    if (!S || !isMiniMapOpen()) return;
    const els = getMiniMapEls();
    const {dot: playerDot, container: mapContainer, cellMap} = els;
    if (!playerDot || !mapContainer) return;
    const totalMapWidth = S.rightPos - S.leftPos;
    const totalMapHeight = S.bottomPos - S.topPos;
    if (totalMapWidth <= 0 || totalMapHeight <= 0) return;
    if (!els.width || !els.height) {
      els.width = mapContainer.offsetWidth;
      els.height = mapContainer.offsetHeight;
    }
    const miniMapWidth = els.width;
    const miniMapHeight = els.height;
    if (!miniMapWidth || !miniMapHeight) return;
    const miniX = Math.round((S.nodeX - S.leftPos) / totalMapWidth * miniMapWidth);
    const miniY = Math.round((S.nodeY - S.topPos) / totalMapHeight * miniMapHeight);
    const tx = miniX - MINIMAP_DOT_RADIUS;
    const ty = miniY - MINIMAP_DOT_RADIUS;
    if (S._miniMapTx !== tx || S._miniMapTy !== ty) {
      S._miniMapTx = tx;
      S._miniMapTy = ty;
      playerDot.style.transform = `translate3d(${tx}px,${ty}px,0)`;
    }
    const colIndex = Math.min(4, Math.max(0, Math.floor(miniX / (miniMapWidth / 5))));
    const rowIndex = Math.min(4, Math.max(0, Math.floor(miniY / (miniMapHeight / 5))));
    const currentCell = ROW_LETTERS[rowIndex] + (colIndex + 1);
    if (S.lastCell !== currentCell) {
      if (S.lastHighlightedSpan) S.lastHighlightedSpan.style.color = "";
      S.lastHighlightedSpan = (cellMap == null ? void 0 : cellMap.get(currentCell)) || null;
      if (S.lastHighlightedSpan) S.lastHighlightedSpan.style.color = "gold";
      S.lastCell = currentCell;
    }
  }
  function drawTouch(ctx) {
    const S = deps.S;
    if (!S) return;
    ctx.save();
    if (S.touchable) {
      for (let i = 0; i < S.touches.length; i++) {
        const touch = S.touches[i];
        if (touch.identifier === S.leftTouchID) {
          ctx.beginPath();
          ctx.strokeStyle = "#0096ff";
          ctx.lineWidth = 6;
          ctx.arc(S.leftTouchStartPos.x, S.leftTouchStartPos.y, 40, 0, Math.PI * 2, true);
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = "#0096ff";
          ctx.lineWidth = 2;
          ctx.arc(S.leftTouchStartPos.x, S.leftTouchStartPos.y, 140, 0, Math.PI * 2, true);
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = "#0096ff";
          ctx.arc(S.leftTouchPos.x, S.leftTouchPos.y, 40, 0, Math.PI * 2, true);
          ctx.stroke();
          ctx.fillStyle = "#0096ff";
          ctx.fillRect(S.rawMouseX - S.cursorSize / 2, S.rawMouseY - S.cursorSize / 2, S.cursorSize, S.cursorSize);
        }
      }
    }
    ctx.restore();
  }
  function drawSplitIcon(ctx) {
    var _a, _b, _c, _d;
    const S = deps.S;
    if (!S) return;
    const size = ~~(S.canvasWidth / 7);
    if (S.isTouchStart) {
      if (S.splitPressed && ((_a = S.splitIcon) == null ? void 0 : _a.width)) {
        ctx.save();
        ctx.scale(1.1, 0);
      }
      if ((_b = S.splitIcon) == null ? void 0 : _b.width) {
        ctx.drawImage(S.splitIcon, S.canvasWidth - size, S.canvasHeight - size, size, size);
      }
      if (S.splitPressed) {
        ctx.restore();
        setTimeout(() => {
          S.splitPressed = false;
        }, 150);
      }
      if (S.ejectPressed && ((_c = S.ejectIcon) == null ? void 0 : _c.width)) {
        ctx.save();
        ctx.scale(1.1, 0);
      }
      if ((_d = S.ejectIcon) == null ? void 0 : _d.width) {
        ctx.drawImage(S.ejectIcon, S.canvasWidth - size, S.canvasHeight - 2 * size - 20, size, size);
      }
      if (S.ejectPressed) {
        ctx.restore();
        setTimeout(() => {
          S.ejectPressed = false;
        }, 150);
      }
    }
  }
  var TOURNAMENT_PLAYERS = [ "khirad", "Оbladаit", "Всекончал", "bl1ck", "newlightchild", "morcov", "☼K☼", "ау", "v_potoke", "Папа", "deffka", "прошка", "griffin", "some no mai", "АЛИК ))))", "Jeff", "PULIK", "salruz", "vaas", "aeris", "sorry", "курага", "𝓙𝓲𝓷𝔁", "ʟᴇɢᴇɴᴅ", "ᴋɪᴘʟᴇɴᴋᴀ🪐", "𝓙𝓲𝓷𝔁" ];
  var TOURNAMENT_WINNERS = [ "Vaas", "Оbladаit" ];
  var deps2 = {
    S: null,
    hooks: {}
  };
  function attachLeaderboard(S, hooks = {}) {
    deps2 = {
      S,
      hooks
    };
    return {
      createLeaderboardEntry,
      drawCustomLeaderBoard,
      drawLeaderBoard,
      getLeaderBoardRenderKey
    };
  }
  function getLeaderBoardRenderKey() {
    const S = deps2.S;
    if (!S) return "";
    return S.leaderBoard.map(e => `${e.id}|${e.name}|${e.level}|${e.xp}`).join("\n");
  }
  function createLeaderboardEntry(name, level, isMe, isSystemLine, b) {
    var _a;
    const S = deps2.S;
    const hooks = deps2.hooks;
    const entryDiv = document.createElement("div");
    const lowerName = (name || "").toLowerCase();
    const cleanName = name.replace(/<[^>]*>/g, "");
    const cleanNameLower = cleanName.toLowerCase();
    const isTournamentPlayer = TOURNAMENT_PLAYERS.some(tourneyName => tourneyName.toLowerCase() === cleanNameLower);
    const isWinner = TOURNAMENT_WINNERS.some(w => w.toLowerCase() === cleanNameLower);
    const donators = (S == null ? void 0 : S.donators) || [];
    if (!isSystemLine && donators.includes(lowerName)) {
      entryDiv.className = "Lednick " + lowerName;
    } else {
      entryDiv.className = "Lednick";
    }
    const numberHtml = isSystemLine ? "" : `${b + 1}. `;
    if (isSystemLine) entryDiv.style.textAlign = "center";
    if (isMe) {
      entryDiv.style.color = "#FFAAAA";
    } else if (!isSystemLine && isTournamentPlayer) {
      entryDiv.style.color = "#FFD700";
    } else {
      entryDiv.style.color = "#FFFFFF";
    }
    const nameSpan = document.createElement("span");
    nameSpan.innerHTML = name;
    if (!isSystemLine && isTournamentPlayer && !isWinner) {
      nameSpan.title = "Участник турнира";
    }
    if (!isSystemLine) {
      const resolveClan = hooks.resolveClanPassIdFromName;
      const resolvePlayer = hooks.resolvePlayerPassIdFromName;
      const clanPassId = resolveClan ? resolveClan(cleanName) : null;
      const playerPassId = resolvePlayer ? resolvePlayer(cleanName) : null;
      const passId = clanPassId || playerPassId;
      if (passId) {
        const profileBase = clanPassId ? hooks.STATS_CLAN_PROFILE_BASE || "https://agar.su/stats/clans/?id=" : hooks.STATS_PROFILE_BASE || "https://agar.su/stats/users/?id=";
        nameSpan.title = clanPassId ? "Статистика клана" : "Статистика игрока";
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
      tooltip.textContent = "XP: " + (((_a = S == null ? void 0 : S.leaderBoard[b]) == null ? void 0 : _a.xp) || 0);
      starContainer.appendChild(tooltip);
      iconsContainer.appendChild(starContainer);
    }
    const youtubers = (S == null ? void 0 : S.youtubers) || [];
    const urlYoutubers = (S == null ? void 0 : S.url_youtubers) || [];
    const ytIndex = youtubers.indexOf(lowerName);
    if (!isSystemLine && ytIndex !== -1 && urlYoutubers[ytIndex]) {
      const ytLink = document.createElement("a");
      ytLink.href = urlYoutubers[ytIndex];
      ytLink.target = "_blank";
      ytLink.innerHTML = '<i class="fab fa-youtube"></i>';
      ytLink.style.color = "#ff0000";
      ytLink.title = "YouTube канал";
      iconsContainer.appendChild(ytLink);
    }
    if (!isSystemLine && donators.includes(lowerName)) {
      const donateIcon = document.createElement("div");
      donateIcon.title = "Данный игрок является спонсором Agar.su";
      donateIcon.style.width = "19px";
      donateIcon.style.height = "19px";
      donateIcon.style.backgroundImage = "url(/photo/mod.png)";
      donateIcon.style.backgroundSize = "cover";
      donateIcon.style.display = "inline-block";
      iconsContainer.appendChild(donateIcon);
    }
    if (!isSystemLine && isWinner) {
      const winnerIcon = document.createElement("div");
      winnerIcon.title = "🏆 ПОБЕДИТЕЛЬ ТУРНИРА 🏆";
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
    var _a, _b;
    const S = deps2.S;
    if (!S) return;
    const renderKey = getLeaderBoardRenderKey();
    if (renderKey === S.lastLeaderBoardRenderKey) return;
    S.lastLeaderBoardRenderKey = renderKey;
    const toplistDiv = document.getElementById("toplistnow");
    if (!toplistDiv) return;
    toplistDiv.innerHTML = "";
    if (!((_a = S.leaderBoard) == null ? void 0 : _a.length)) return;
    for (let b = 0; b < S.leaderBoard.length; ++b) {
      let name = S.leaderBoard[b].name || "Игрок";
      const isSystemLine = S.leaderBoard[b].id == null;
      let isMe = false;
      if (S.noRanking && S.leaderBoard[b].name) {
        const myName = ((_b = S.playerCells[0]) == null ? void 0 : _b.name) || "";
        if (myName && myName.toLowerCase() === S.leaderBoard[b].name.toLowerCase()) {
          isMe = true;
        }
      }
      if (isMe) {
        const myCell = S.playerCells.find(cell => cell.id === S.leaderBoard[b].id);
        if (myCell == null ? void 0 : myCell.name) name = myCell.name;
      }
      name = name.replace(/\*(\d+)\*/g, (_match, p1) => `<span title="Серия побед подряд" class="streak">${p1}</span>`);
      if (b < 10) {
        const entryDiv = createLeaderboardEntry(name, S.leaderBoard[b].level, isMe, isSystemLine, b);
        toplistDiv.insertAdjacentHTML("beforeend", entryDiv.outerHTML);
      }
    }
  }
  function drawLeaderBoard() {
    var _a, _b, _c;
    const S = deps2.S;
    const hooks = deps2.hooks;
    if (!S) return;
    const renderKey = getLeaderBoardRenderKey();
    if (renderKey === S.lastLeaderBoardRenderKey) return;
    S.lastLeaderBoardRenderKey = renderKey;
    const toplistDiv = document.getElementById("toplistnow");
    if (!toplistDiv) return;
    toplistDiv.innerHTML = "";
    const displayedPlayers = 10;
    let myRank = null;
    if (!((_a = S.leaderBoard) == null ? void 0 : _a.length)) return;
    for (let b = 0; b < S.leaderBoard.length; ++b) {
      let name = S.leaderBoard[b].name || "Игрок";
      const level = S.leaderBoard[b].level;
      const isSystemLine = S.leaderBoard[b].id == null;
      let isMe = false;
      if (!isSystemLine) {
        isMe = S.playerCells.some(cell => cell.id === S.leaderBoard[b].id);
      }
      if (S.noRanking && S.leaderBoard[b].name) {
        const myName = ((_b = S.playerCells[0]) == null ? void 0 : _b.name) || "";
        if (myName && myName.toLowerCase() === S.leaderBoard[b].name.toLowerCase()) {
          isMe = true;
        }
      }
      if (isMe) {
        const myCell = S.playerCells.find(cell => cell.id === S.leaderBoard[b].id);
        if (myCell == null ? void 0 : myCell.name) {
          name = myCell.name;
          myRank = b + 1;
        }
      }
      if (b < displayedPlayers) {
        const entryDiv = createLeaderboardEntry(name, level, isMe, isSystemLine, b);
        toplistDiv.appendChild(entryDiv);
      }
    }
    if (myRank && myRank > displayedPlayers) {
      const level = S.accountData && hooks.getLevel ? hooks.getLevel(S.accountData.xp) : -1;
      const myName = (_c = S.playerCells[0]) == null ? void 0 : _c.name;
      if (myName) {
        const myRankDiv = createLeaderboardEntry(myName, level, true, false, myRank - 1);
        myRankDiv.style.color = "#FFAAAA";
        toplistDiv.appendChild(myRankDiv);
      }
    }
  }
  var _sha256K = new Uint32Array([ 1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298 ]);
  function sha256HexConnectSync(text) {
    const enc = (new TextEncoder).encode(String(text));
    const len = enc.length;
    const bitLen = len * 8;
    const padLen = len + 9 + 63 >> 6 << 6;
    const buf = new Uint8Array(padLen);
    buf.set(enc);
    buf[len] = 128;
    const view = new DataView(buf.buffer);
    view.setUint32(padLen - 4, bitLen, false);
    let h0 = 1779033703, h1 = 3144134277, h2 = 1013904242, h3 = 2773480762;
    let h4 = 1359893119, h5 = 2600822924, h6 = 528734635, h7 = 1541459225;
    const w = new Uint32Array(64);
    for (let off = 0; off < padLen; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = (w[i - 15] >>> 7 | w[i - 15] << 25) ^ (w[i - 15] >>> 18 | w[i - 15] << 14) ^ w[i - 15] >>> 3;
        const s1 = (w[i - 2] >>> 17 | w[i - 2] << 15) ^ (w[i - 2] >>> 19 | w[i - 2] << 13) ^ w[i - 2] >>> 10;
        w[i] = w[i - 16] + s0 + w[i - 7] + s1 | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
        const ch = e & f ^ ~e & g;
        const t1 = h + S1 + ch + _sha256K[i] + w[i] | 0;
        const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
        const maj = a & b ^ a & c ^ b & c;
        const t2 = S0 + maj | 0;
        h = g;
        g = f;
        f = e;
        e = d + t1 | 0;
        d = c;
        c = b;
        b = a;
        a = t1 + t2 | 0;
      }
      h0 = h0 + a | 0;
      h1 = h1 + b | 0;
      h2 = h2 + c | 0;
      h3 = h3 + d | 0;
      h4 = h4 + e | 0;
      h5 = h5 + f | 0;
      h6 = h6 + g | 0;
      h7 = h7 + h | 0;
    }
    const out = new Uint32Array([ h0, h1, h2, h3, h4, h5, h6, h7 ]);
    let hex = "";
    for (let i = 0; i < 8; i++) {
      const v = out[i];
      hex += (v >>> 28 & 15).toString(16) + (v >>> 24 & 15).toString(16) + (v >>> 20 & 15).toString(16) + (v >>> 16 & 15).toString(16) + (v >>> 12 & 15).toString(16) + (v >>> 8 & 15).toString(16) + (v >>> 4 & 15).toString(16) + (v & 15).toString(16);
    }
    return hex;
  }
  function solveConnectChallenge(challenge, ui = {}) {
    var _a;
    const need = "0".repeat(challenge.difficulty);
    const prefix = challenge.prefix;
    let nonce = 0;
    (_a = ui.setText) == null ? void 0 : _a.call(ui, "ПК обменивается данными с сервером…");
    return new Promise(resolve => {
      function step() {
        var _a2, _b, _c;
        const t0 = performance.now();
        while (performance.now() - t0 < 14) {
          const input = prefix + nonce;
          const hash = sha256HexConnectSync(input);
          if (hash.startsWith(need)) {
            (_a2 = ui.onProgress) == null ? void 0 : _a2.call(ui, input, hash);
            resolve(`${challenge.challengeId}:${nonce}`);
            return;
          }
          nonce++;
          if (nonce % 1500 === 0) {
            (_b = ui.setText) == null ? void 0 : _b.call(ui, "Проверка безопасности…");
            (_c = ui.onProgress) == null ? void 0 : _c.call(ui, input, hash);
          }
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  var serverPowSupportCache = new Map;
  async function fetchConnectToken(apiBase, ui = {}) {
    var _a, _b, _c;
    if (serverPowSupportCache.get(apiBase) === false) {
      return null;
    }
    (_a = ui.setText) == null ? void 0 : _a.call(ui, serverPowSupportCache.get(apiBase) === true ? "Запрос проверки…" : "Проверка сервера…");
    let res;
    try {
      // Short timeout: servers without /challenge (ms/pvp) or blocked ports must not hang connect
      res = await fetch(apiBase + "/challenge", {
        cache: "no-store",
        signal: AbortSignal.timeout(3500)
      });
    } catch (e) {
      return null;
    }
    if (!res.ok) {
      if (res.status === 404 || res.status === 403) {
        serverPowSupportCache.set(apiBase, false);
      }
      return null;
    }
    let challenge;
    try {
      challenge = await res.json();
    } catch (e) {
      return null;
    }
    if (!challenge || !challenge.challengeId || challenge.prefix == null || challenge.difficulty == null) {
      return null;
    }
    serverPowSupportCache.set(apiBase, true);
    (_b = ui.setText) == null ? void 0 : _b.call(ui, "Проверка безопасности…");
    const token = await solveConnectChallenge(challenge, ui);
    (_c = ui.setText) == null ? void 0 : _c.call(ui, "Подключение к серверу…");
    return token;
  }
  function openGameSocket(wsUrl, {accountToken, connectToken} = {}) {
    const qs = new URLSearchParams;
    if (accountToken) qs.set("accountToken", accountToken);
    if (connectToken) qs.set("connectToken", connectToken);
    const ws = new WebSocket(wsUrl + "?" + qs.toString(), WS_SUBPROTOCOL);
    ws.binaryType = "arraybuffer";
    return ws;
  }
  function safeCloseSocket(ws) {
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onclose = null;
    try {
      ws.close();
    } catch (e) {}
  }
  function showConnectVerifyOverlay(text) {
    const overlay = document.getElementById("connect-verify-overlay");
    hideReconnectPanel();
    setConnectVerifyTransferVisible(true);
    if (overlay) overlay.style.display = "flex";
    setConnectVerifyText(text);
  }
  function hideConnectVerifyOverlay() {
    const overlay = document.getElementById("connect-verify-overlay");
    hideReconnectPanel();
    resetConnectVerifyStream();
    setConnectVerifyTransferVisible(true);
    if (overlay) overlay.style.display = "none";
  }
  function setConnectVerifyText(text) {
    const el = document.getElementById("connect-verify-text");
    if (el && text != null) el.textContent = text;
  }
  function setConnectVerifyTransferVisible(show) {
    const el = document.getElementById("connect-verify-transfer");
    if (el) el.style.display = show ? "" : "none";
  }
  function resetConnectVerifyStream() {
    const stream = document.getElementById("connect-verify-data-stream");
    if (stream) stream.textContent = 'sha256("…") → …';
  }
  function updateConnectTransferStream(inputPreview, hashHex) {
    const stream = document.getElementById("connect-verify-data-stream");
    if (!stream) return;
    const raw = String(inputPreview);
    const tail = raw.length > 18 ? "…" + raw.slice(-14) : raw;
    const h = String(hashHex || "");
    stream.textContent = 'sha256("' + tail + '") → ' + h.slice(0, 12) + "…";
  }
  function hideReconnectPanel() {
    const box = document.getElementById("connect-verify-reconnect");
    if (box) box.hidden = true;
  }
  function showReconnectPanel(message) {
    const overlay = document.getElementById("connect-verify-overlay");
    setConnectVerifyTransferVisible(false);
    if (overlay) overlay.style.display = "flex";
    setConnectVerifyText(message || "Соединение с сервером потеряно.");
    const box = document.getElementById("connect-verify-reconnect");
    if (box) box.hidden = false;
  }
  function formatBanDuration(sec) {
    sec = Math.max(0, sec | 0);
    const h = Math.floor(sec / 3600);
    const m = Math.floor(sec % 3600 / 60);
    const s = sec % 60;
    if (h > 0) return `${h}ч ${m}м`;
    if (m > 0) return `${m}м ${s}с`;
    return `${s}с`;
  }
  function showBanBanner(remainingSec, reason) {
    const banner = document.getElementById("ban-banner");
    if (!banner) return;
    const msgEl = document.getElementById("ban-banner-message");
    const text = `Осталось: ${formatBanDuration(remainingSec)}` + (reason ? `\n${reason}` : "");
    if (msgEl) msgEl.textContent = text;
    banner.style.display = "block";
  }
  function hideBanBanner() {
    const banner = document.getElementById("ban-banner");
    if (banner) banner.style.display = "none";
  }
  function createConnection(S, hooks = {}) {
    function isSpectMode() {
      const urlParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      return urlParams.has("spect") || hash.includes("?spect");
    }
    function clearSpectReconnectTimer() {
      if (S.spectReconnectTimer) {
        clearInterval(S.spectReconnectTimer);
        S.spectReconnectTimer = null;
      }
    }
    function scheduleSpectReconnect() {
      clearSpectReconnectTimer();
      if (!isSpectMode() || !S.ma) return;
      hideReconnectPanel();
      showConnectVerifyOverlay("Переподключение к серверу…");
      const tryReconnect = () => {
        if (!S.ma || !isSpectMode()) {
          clearSpectReconnectTimer();
          return;
        }
        if (isWsConnected() || S.connectInProgress || S.ws && S.ws.readyState === WebSocket.CONNECTING) {
          return;
        }
        showConnecting();
      };
      tryReconnect();
      S.spectReconnectTimer = setInterval(tryReconnect, S.SPECT_RECONNECT_INTERVAL_MS);
    }
    function isWsConnected() {
      return !!(S.ws && S.ws.readyState === WebSocket.OPEN);
    }
    function clearHiddenTabDisconnectTimer() {
      if (S.hiddenTabDisconnectTimer) {
        clearTimeout(S.hiddenTabDisconnectTimer);
        S.hiddenTabDisconnectTimer = null;
      }
    }
    function scheduleHiddenTabDisconnect() {
      clearHiddenTabDisconnectTimer();
      if (!document.hidden) return;
      S.hiddenTabDisconnectTimer = setTimeout(() => {
        S.hiddenTabDisconnectTimer = null;
        if (!document.hidden || !isWsConnected()) return;
        S.wsClosedByHiddenTab = true;
        try {
          S.ws.close();
        } catch (e) {}
      }, S.HIDDEN_TAB_DISCONNECT_MS);
    }
    function reconnectToServer() {
      hideBanBanner();
      hideReconnectPanel();
      showConnecting();
    }
    async function fetchConnectToken2(gameHost) {
      const apiBase = getPowApiBase(gameHost);
      return fetchConnectToken(apiBase, {
        setText: setConnectVerifyText,
        onProgress: updateConnectTransferStream
      });
    }
    function showConnecting() {
      const wsUrl = getGameServerWssUrl(S.CONNECTION_URL);
      if (S.ws && S.ws.readyState === WebSocket.OPEN && S.currentWebSocketUrl === wsUrl) {
        return;
      }
      if (S.ma) {
        S.connectAttemptId++;
        S.currentWebSocketUrl = wsUrl;
        wsConnect(wsUrl);
      }
    }
    async function wsConnect(wsUrlArg) {
      var _a;
      const attemptId = S.connectAttemptId;
      S.connectInProgress = true;
      hideBanBanner();
      hideReconnectPanel();
      showConnectVerifyOverlay("Подключение к серверу…");
      if (S.ws) {
        safeCloseSocket(S.ws);
        S.ws = null;
      }
      const host = S.CONNECTION_URL;
      S.wsUrl = wsUrlArg || getGameServerWssUrl(host);
      (_a = hooks.clearWorld) == null ? void 0 : _a.call(hooks);
      try {
        let connectToken = null;
        try {
          connectToken = await fetchConnectToken2(host);
        } catch (err) {
          if (attemptId !== S.connectAttemptId) return;
          console.error("Connect token error:", err);
          if (isSpectMode()) {
            scheduleSpectReconnect();
          } else {
            showReconnectPanel("Ошибка подключения. Нажмите, чтобы повторить.");
          }
          return;
        }
        if (attemptId !== S.connectAttemptId) return;
        if (serverPowSupportCache.get(getPowApiBase(host)) === true && !connectToken) {
          if (isSpectMode()) {
            scheduleSpectReconnect();
          } else {
            showReconnectPanel("Не удалось пройти проверку сервера. Нажмите, чтобы повторить.");
          }
          return;
        }
        if (connectToken === null) {
          hideConnectVerifyOverlay();
        }
        S.ws = openGameSocket(S.wsUrl, {
          accountToken: getAccountToken() || null,
          connectToken: connectToken || null
        });
        S.ws.onopen = onWsOpen;
        S.ws.onmessage = msg => {
          var _a2;
          (_a2 = hooks.onMessage) == null ? void 0 : _a2.call(hooks, new DataView(msg.data));
        };
        S.ws.onclose = onWsClose;
      } catch (err) {
        if (attemptId !== S.connectAttemptId) return;
        console.error("WebSocket connect error:", err);
        if (isSpectMode()) {
          scheduleSpectReconnect();
        } else {
          showReconnectPanel("Ошибка подключения. Нажмите, чтобы повторить.");
        }
      } finally {
        if (attemptId === S.connectAttemptId) {
          S.connectInProgress = false;
        }
      }
    }
    function wsSend(dataViewOrTyped) {
      var _a;
      if (!S.ws) return;
      const buf = (_a = dataViewOrTyped.buffer) != null ? _a : dataViewOrTyped;
      S.ws.send(buf);
    }
    function onWsOpen() {
      var _a;
      setConnectVerifyText("Синхронизация с сервером…");
      S.gameHandshakeDone = false;
      (_a = hooks.sendAccountToken) == null ? void 0 : _a.call(hooks);
      const [proto, key] = encodeHandshake();
      wsSend(proto);
      wsSend(key);
    }
    function onGameHandshakeReady() {
      var _a, _b;
      if (S.gameHandshakeDone) return;
      S.gameHandshakeDone = true;
      clearSpectReconnectTimer();
      hideConnectVerifyOverlay();
      hideReconnectPanel();
      (_a = hooks.sendNickName) == null ? void 0 : _a.call(hooks);
      if (isSpectMode() && S.userNickName == null) {
        const spect = prepareData(1);
        spect.setUint8(0, ClientOpcode.SPECTATE);
        wsSend(spect);
      }
      if (S.wsPingInterval) clearInterval(S.wsPingInterval);
      S.wsPingInterval = setInterval(() => {
        S.pingstamp = Date.now();
        wsSend(encodePing());
      }, 3e3);
      (_b = hooks.sendChat) == null ? void 0 : _b.call(hooks, "вoшёл в игру!");
    }
    function onWsClose() {
      S.gameHandshakeDone = false;
      if (S.wsPingInterval) {
        clearInterval(S.wsPingInterval);
        S.wsPingInterval = null;
      }
      if (S.connectInProgress) return;
      if (!S.ma) return;
      if (isSpectMode()) {
        S.wsClosedByHiddenTab = false;
        scheduleSpectReconnect();
        return;
      }
      const msg = S.wsClosedByHiddenTab ? "Вкладка была неактивна более 60 секунд. Нажмите, чтобы переподключиться." : "Соединение с сервером потеряно. Нажмите, чтобы переподключиться.";
      S.wsClosedByHiddenTab = false;
      showReconnectPanel(msg);
    }
    function bindVisibilityHandlers() {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          scheduleHiddenTabDisconnect();
        } else {
          clearHiddenTabDisconnectTimer();
        }
      });
    }
    return {
      isSpectMode,
      clearSpectReconnectTimer,
      scheduleSpectReconnect,
      isWsConnected,
      clearHiddenTabDisconnectTimer,
      scheduleHiddenTabDisconnect,
      reconnectToServer,
      fetchConnectToken: fetchConnectToken2,
      showConnecting,
      wsConnect,
      wsSend,
      onWsOpen,
      onGameHandshakeReady,
      onWsClose,
      bindVisibilityHandlers
    };
  }
  function attachConnection(S, hooks = {}) {
    const api = createConnection(S, hooks);
    Object.assign(S.api, api);
    return api;
  }
  function createOutbound(S, hooks = {}) {
    function wsIsOpen() {
      return S.ws != null && S.ws.readyState === WebSocket.OPEN;
    }
    function wsSend(view) {
      if (!S.ws) return;
      S.ws.send(view.buffer);
    }
    function getColorId(hex) {
      const colors = S.cellColors;
      if (!colors || !hex) return 0;
      const index = colors.indexOf(hex);
      return index === -1 ? 0 : index + 1;
    }
    function sendMouseMove() {
      if (!wsIsOpen()) return;
      if (S.freeze) {
        if (!(Math.abs(S.oldX - S.posX) < .1 && Math.abs(S.oldY - S.posY) < .1)) {
          S.oldX = S.posX;
          S.oldY = S.posY;
          const msg = prepareData(21);
          msg.setUint8(0, ClientOpcode.MOUSE);
          msg.setFloat64(1, S.posX, true);
          msg.setFloat64(9, S.posY, true);
          msg.setUint32(17, 0, true);
          wsSend(msg);
        }
      } else {
        const msgX = S.rawMouseX - S.canvasWidth / 2;
        const msgY = S.rawMouseY - S.canvasHeight / 2;
        if (64 <= msgX * msgX + msgY * msgY && !(Math.abs(S.oldX - S.X) < .1 && Math.abs(S.oldY - S.Y) < .1)) {
          S.oldX = S.X;
          S.oldY = S.Y;
          const msg = prepareData(21);
          msg.setUint8(0, ClientOpcode.MOUSE);
          msg.setFloat64(1, S.X, true);
          msg.setFloat64(9, S.Y, true);
          msg.setUint32(17, 0, true);
          wsSend(msg);
        }
      }
    }
    function sendUint8(a) {
      if (!wsIsOpen()) return;
      const msg = prepareData(1);
      msg.setUint8(0, a);
      wsSend(msg);
    }
    function sendNickName() {
      if (!wsIsOpen() || S.userNickName == null) return;
      const nick = S.userNickName;
      const msg = prepareData(1 + 2 * nick.length + 1);
      msg.setUint8(0, ClientOpcode.NICK);
      msg.setUint8(1, getColorId(localStorage.getItem("selectedColor")));
      for (let i = 0; i < nick.length; ++i) {
        msg.setUint16(1 + 2 * i + 1, nick.charCodeAt(i), true);
      }
      wsSend(msg);
    }
    function sendChat(str) {
      if (!wsIsOpen() || !(str.length < 200) || !(str.length > 0) || S.hideChat) return;
      const msg = prepareData(2 + 2 * str.length);
      let offset = 0;
      msg.setUint8(offset++, ClientOpcode.CHAT);
      msg.setUint8(offset++, 0);
      for (let i = 0; i < str.length; ++i) {
        msg.setUint16(offset, str.charCodeAt(i), true);
        offset += 2;
      }
      wsSend(msg);
    }
    function sendAccountToken() {
      const token = getAccountToken();
      if (!wsIsOpen() || !token) return;
      const msg = prepareData(1 + 2 * token.length);
      msg.setUint8(0, 114);
      for (let i = 0; i < token.length; ++i) {
        msg.setUint16(1 + 2 * i, token.charCodeAt(i), true);
      }
      wsSend(msg);
    }
    function sendSticker(stickerId, action) {
      if (!wsIsOpen()) return;
      const msg = prepareData(6);
      msg.setUint8(0, ClientOpcode.STICKER);
      msg.setUint8(1, stickerId);
      msg.setUint8(2, action ? 1 : 0);
      wsSend(msg);
    }
    return {
      wsIsOpen,
      sendMouseMove,
      sendUint8,
      sendNickName,
      sendChat,
      sendAccountToken,
      sendSticker,
      getColorId
    };
  }
  function attachOutbound(S, hooks = {}) {
    const api = createOutbound(S, hooks);
    Object.assign(S.api, api);
    return api;
  }
  var BinaryReader = class {
    constructor(view) {
      this.view = view;
      this.byteLength = view.byteLength;
      this.offset = 0;
    }
    get canRead() {
      return this.offset < this.byteLength;
    }
    uint8() {
      return this.view.getUint8(this.offset++);
    }
    int8() {
      return this.view.getInt8(this.offset++);
    }
    uint16() {
      return this.view.getUint16((this.offset += 2) - 2, true);
    }
    int16() {
      return this.view.getInt16((this.offset += 2) - 2, true);
    }
    uint32() {
      return this.view.getUint32((this.offset += 4) - 4, true);
    }
    int32() {
      return this.view.getInt32((this.offset += 4) - 4, true);
    }
    utf16() {
      let str = "";
      let char;
      while (this.canRead && (char = this.uint16())) str += String.fromCharCode(char);
      return str;
    }
    utf8() {
      let text = "";
      for (let byte1; byte1 = this.canRead && this.view.getUint8(this.offset++); ) {
        if (byte1 <= 127) text += String.fromCharCode(byte1); else if (byte1 <= 223) text += String.fromCharCode((byte1 & 31) << 6 | this.view.getUint8(this.offset++) & 63); else if (byte1 <= 239) text += String.fromCharCode((byte1 & 15) << 12 | (this.view.getUint8(this.offset++) & 63) << 6 | this.view.getUint8(this.offset++) & 63); else {
          let codePoint = (byte1 & 7) << 18 | (this.view.getUint8(this.offset++) & 63) << 12 | (this.view.getUint8(this.offset++) & 63) << 6 | this.view.getUint8(this.offset++) & 63;
          if (codePoint >= 65536) {
            codePoint -= 65536;
            text += String.fromCharCode(55296 | codePoint >> 10, 56320 | codePoint & 1023);
          } else text += String.fromCharCode(codePoint);
        }
      }
      return text;
    }
  };
  var normalizeFractlPart = n => n % (Math.PI * 2) / (Math.PI * 2);
  function computeFoodPosition(S, nodeid) {
    return {
      x: S.leftPos + S.rightPos * 2 * normalizeFractlPart(nodeid),
      y: S.topPos + S.bottomPos * 2 * normalizeFractlPart(nodeid * nodeid)
    };
  }
  function repositionFoodNodes(S) {
    if (!S.mapBoundsReady) return;
    const now = Date.now();
    for (let i = 0; i < S.nodelist.length; i++) {
      const node = S.nodelist[i];
      if (!(node == null ? void 0 : node.isFood)) continue;
      const {x, y} = computeFoodPosition(S, node.id);
      node.ox = x;
      node.oy = y;
      node.nx = x;
      node.ny = y;
      node.x = x;
      node.y = y;
      node.updateTime = now;
    }
    S.nodesSortDirty = true;
  }
  function updateNodes(S, reader, hooks) {
    const {Cell: Cell2, onPlayerDeath} = hooks;
    S.timestamp = Date.now();
    S.ua = false;
    S.nodesSortDirty = true;
    for (let killedId; killedId = reader.uint32(); ) {
      const killer = S.nodes[reader.uint32()];
      const killedNode = S.nodes[killedId];
      if (killer && killedNode) {
        killedNode.destroy();
        killedNode.ox = killedNode.x;
        killedNode.oy = killedNode.y;
        killedNode.oSize = killedNode.size;
        killedNode.nx = killer.x;
        killedNode.ny = killer.y;
        killedNode.nSize = killedNode.size;
        killedNode.updateTime = S.timestamp;
      }
    }
    for (let nodeid; nodeid = reader.uint32(); ) {
      const type = reader.uint8();
      let posX = 0;
      let posY = 0;
      let size = 0;
      let playerId = 0;
      if (type === 1) {
        if (S.mapBoundsReady) {
          const foodPos = computeFoodPosition(S, nodeid);
          posX = foodPos.x;
          posY = foodPos.y;
        }
      } else {
        if (type === 0) playerId = reader.uint32();
        posX = reader.int32();
        posY = reader.int32();
        size = reader.uint16();
      }
      const r = reader.uint8();
      const g = reader.uint8();
      const b = reader.uint8();
      let color = "#" + (r << 16 | g << 8 | b).toString(16).padStart(6, "0");
      const spiked = reader.uint8();
      const flagVirus = !!(spiked & 1);
      const flagEjected = !!(spiked & 32) || !!(spiked & 64);
      const flagAgitated = !!(spiked & 16);
      const name = reader.utf8();
      let stickerData = null;
      if (reader.canRead) {
        const marker = reader.uint8();
        if (marker === 255) {
          stickerData = reader.uint8();
        }
      }
      if (type === 1 && !S.mapBoundsReady) {
        continue;
      }
      let node = S.nodes[nodeid];
      if (node) {
        node = S.nodes[nodeid];
        node.updatePos();
        node.ox = node.x;
        node.oy = node.y;
        node.oSize = node.size;
        node.color = color;
      } else {
        node = new Cell2(nodeid, posX, posY, size, color, name);
        S.nodelist.push(node);
        S.nodes[nodeid] = node;
        node.ka = posX;
        node.la = posY;
        if (playerId === S.ownerPlayerId) {
          const overlays = document.getElementById("overlays");
          if (overlays) overlays.style.display = "none";
          node.isOwn = true;
          S.playerCells.push(node);
          if (1 == S.playerCells.length) {
            S.nodeX = node.x;
            S.nodeY = node.y;
          }
        }
      }
      if (stickerData) {
        node.currentSticker = stickerData;
        node.stickerActive = true;
      } else if (node) {
        node.stickerActive = false;
        node.currentSticker = null;
      }
      node.isVirus = flagVirus;
      node.isEjected = flagEjected;
      node.isAgitated = flagAgitated;
      if (type === 1) node.isFood = true;
      node.nx = posX;
      node.ny = posY;
      node.setSize(size);
      node.updateTime = S.timestamp;
      node.flag = spiked;
      if (name) node.setName(name);
    }
    while (reader.canRead) {
      const node = S.nodes[reader.uint32()];
      if (node) node.destroy();
    }
    if (S.ua && S.playerCells.length === 0) {
      if (typeof onPlayerDeath === "function") {
        onPlayerDeath(S);
      } else {
        showStatics();
        if (typeof window.updateShareText === "function") window.updateShareText();
        if (typeof window.renderDeathBanner === "function") window.renderDeathBanner();
      }
    }
  }
  function fixDead(S) {
    const now = Date.now();
    for (let i = S.nodelist.length - 1; i >= 0; i--) {
      const node = S.nodelist[i];
      if (!node || node.destroyed) continue;
      if (now - node.updateTime > 3e3) node.destroy();
    }
  }
  function clearWorld(S) {
    S.playerCells = [];
    S.nodes = {};
    S.nodelist = [];
    S.Cells = [];
    S.leaderBoard = [];
    S.mapBoundsReady = false;
  }
  function createHandlers(S, hooks = {}) {
    function handleWsMessage(msg) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      let offset = 0;
      let setCustomLB = false;
      function getString() {
        let text = "";
        let char;
        while ((char = msg.getUint16(offset, true)) !== 0) {
          offset += 2;
          text += String.fromCharCode(char);
        }
        offset += 2;
        return text;
      }
      const messageType = msg.getUint8(offset++);
      switch (messageType) {
       case ServerOpcode.BAN:
        {
          hideConnectVerifyOverlay();
          const banRemaining = msg.getUint32(offset, true);
          offset += 4;
          const banReason = getString();
          showBanBanner(banRemaining, banReason);
          S.connectInProgress = false;
          S.gameHandshakeDone = false;
          if (S.wsPingInterval) {
            clearInterval(S.wsPingInterval);
            S.wsPingInterval = null;
          }
          if (S.ws) {
            safeCloseSocket(S.ws);
            S.ws = null;
          }
          break;
        }

       case ServerOpcode.PING:
        S.ping = Date.now() - S.pingstamp;
        (_a = hooks.setPingDisplay) == null ? void 0 : _a.call(hooks, S.ping);
        break;

       case ServerOpcode.UPDATE_NODES:
        {
          const reader = new BinaryReader(msg);
          reader.offset++;
          (_b = hooks.updateNodes) == null ? void 0 : _b.call(hooks, reader);
          break;
        }

       case ServerOpcode.UPDATE_CAMERA:
        S.posSize = .15;
        break;

       case ServerOpcode.CLEAR_NODES:
        S.playerCells = [];
        break;

       case ServerOpcode.CUSTOM_LB:
        {
          setCustomLB = true;
          S.noRanking = true;
          const count = msg.getUint32(offset, true);
          offset += 4;
          S.leaderBoard = [];
          for (let i = 0; i < count; i++) {
            msg.getUint32(offset, true);
            offset += 4;
            const text = getString();
            S.leaderBoard.push({
              id: null,
              name: text,
              level: -1,
              xp: 0
            });
          }
          (_c = hooks.drawCustomLeaderBoard) == null ? void 0 : _c.call(hooks);
          break;
        }

       case ServerOpcode.FFA_LB:
        {
          if (!setCustomLB) {
            S.noRanking = false;
          }
          const LBplayerNum = msg.getUint32(offset, true);
          offset += 4;
          S.leaderBoard = [];
          for (let i = 0; i < LBplayerNum; ++i) {
            const nodeId = msg.getUint32(offset, true);
            offset += 4;
            const playerName = getString();
            const playerXp = msg.getUint32(offset, true);
            offset += 4;
            S.leaderBoard.push({
              id: nodeId,
              name: playerName,
              level: playerXp ? (_e = (_d = hooks.getLevel) == null ? void 0 : _d.call(hooks, playerXp)) != null ? _e : -1 : -1,
              xp: playerXp
            });
          }
          (_f = hooks.drawLeaderBoard) == null ? void 0 : _f.call(hooks);
          break;
        }

       case ServerOpcode.BORDERS:
        {
          S.leftPos = msg.getFloat64(offset, true);
          offset += 8;
          S.topPos = msg.getFloat64(offset, true);
          offset += 8;
          S.rightPos = msg.getFloat64(offset, true);
          offset += 8;
          S.bottomPos = msg.getFloat64(offset, true);
          offset += 8;
          S.foodMinSize = (msg.getUint16(offset, true) * 100) ** .5;
          offset += 2;
          S.foodMaxSize = (msg.getUint16(offset, true) * 100) ** .5;
          offset += 2;
          S.ownerPlayerId = msg.getUint32(offset, true);
          offset += 4;
          S.mapBoundsReady = true;
          repositionFoodNodes(S);
          S.mapWidth = (S.rightPos + S.leftPos) / 2;
          S.mapHeight = (S.bottomPos + S.topPos) / 2;
          S.posX = (S.rightPos + S.leftPos) / 2;
          S.posY = (S.bottomPos + S.topPos) / 2;
          S.posSize = 1;
          if (S.playerCells.length === 0) {
            S.nodeX = S.posX;
            S.nodeY = S.posY;
            S.viewZoom = S.posSize;
          }
          (_g = hooks.onGameHandshakeReady) == null ? void 0 : _g.call(hooks);
          break;
        }

       case ServerOpcode.CHAT:
        (_h = hooks.addChat) == null ? void 0 : _h.call(hooks, msg, offset);
        break;

       case ServerOpcode.XP:
        {
          const xp = msg.getUint32(offset, true);
          (_i = hooks.onUpdateXp) == null ? void 0 : _i.call(hooks, xp);
          break;
        }

       case ServerOpcode.STICKER:
        {
          if (!S.showStickers) break;
          const stickerPlayerId = msg.getUint32(offset, true);
          offset += 4;
          const stickerId = msg.getUint8(offset++);
          const stickerAction = msg.getUint8(offset++);
          for (let i = 0; i < S.nodelist.length; i++) {
            const node = S.nodelist[i];
            if (node.id === stickerPlayerId && node.name) {
              if (stickerAction === 1) {
                node.currentSticker = stickerId;
                node.stickerActive = true;
              } else {
                node.stickerActive = false;
                node.currentSticker = null;
              }
              break;
            }
          }
          break;
        }

       default:
        break;
      }
    }
    return {
      handleWsMessage
    };
  }
  function attachHandlers(S, hooks = {}) {
    const api = createHandlers(S, hooks);
    Object.assign(S.api, api);
    return api;
  }
  function createGameState() {
    return {
      wHandle: null,
      nCanvas: null,
      ctx: null,
      mainCanvas: null,
      canvasWidth: 0,
      canvasHeight: 0,
      qTree: null,
      ws: null,
      wsUrl: null,
      CONNECTION_URL: "ffa.agar.su",
      SELECTED_SERVER: null,
      currentWebSocketUrl: null,
      connectInProgress: false,
      connectAttemptId: 0,
      hiddenTabDisconnectTimer: null,
      wsClosedByHiddenTab: false,
      spectReconnectTimer: null,
      HIDDEN_TAB_DISCONNECT_MS: 6e5,
      SPECT_RECONNECT_INTERVAL_MS: 2e3,
      ping: 0,
      pingstamp: 0,
      wsPingInterval: null,
      gameHandshakeDone: false,
      nodeX: 5e3,
      nodeY: 5e3,
      playerCells: [],
      nodes: {},
      nodelist: [],
      Cells: [],
      leaderBoard: [],
      chatBoard: [],
      rawMouseX: 0,
      rawMouseY: 0,
      X: -1,
      Y: -1,
      timestamp: 0,
      userNickName: null,
      leftPos: 0,
      topPos: 0,
      rightPos: 1e4,
      bottomPos: 1e4,
      mapBoundsReady: false,
      foodMinSize: 0,
      foodMaxSize: 0,
      ownerPlayerId: -1,
      mapWidth: 5e3,
      mapHeight: 5e3,
      viewZoom: 1,
      ua: false,
      posX: 5e3,
      posY: 5e3,
      posSize: 1,
      ma: false,
      freeze: false,
      zoom: 1,
      isTouchStart: false,
      splitIcon: null,
      ejectIcon: null,
      noRanking: false,
      oldX: -1,
      oldY: -1,
      z: 1,
      maxScore: 0,
      touchable: false,
      touches: [],
      leftTouchID: -1,
      leftTouchPos: null,
      leftTouchStartPos: null,
      leftVector: null,
      skinList: {},
      stickerList: {},
      badWordsSet: null,
      transparent: null,
      invisible: null,
      rotation: null,
      showSkin: true,
      showName: true,
      showColor: true,
      showMass: true,
      hideChat: false,
      renderQuality: (() => {
        const q = readStored("render_quality", "high");
        return q === "low" || q === "medium" ? q : "high";
      })(),
      smoothRender: .4,
      closebord: false,
      enableMouseClicks: false,
      mouseSplitButton: 3,
      mouseEjectButton: 1,
      showGlow: true,
      confirmCloseTab: false,
      showAdultContent: false,
      fixedCell: false,
      showStickers: true,
      customClientColors: false,
      clientColorVirus: "#33ff33",
      clientColorFood: "#ffe066",
      clientColorEnemy: "#ff4444",
      clientColorOwn: "#4488ff",
      clientColorEject: "#ff66cc",
      customMapBgEnabled: false,
      customVirusBgEnabled: false,
      customMapBgMode: "cover",
      customMapBgTileSize: 512,
      mapBgImage: null,
      virusBgImage: null,
      customBgSettingsInitialized: false,
      keyBinds: null,
      keybindCaptureAction: null,
      keybindUiInitialized: false,
      ejectKeyInterval: null,
      cellColors: null,
      lastLeaderBoardRenderKey: "",
      tournament: false,
      tournamentWinner: null,
      accountData: null,
      nickPerksLists: null,
      fps: 0,
      lastTime: 0,
      fpsUpdateTime: 0,
      scoreMessages: 0,
      canSendCoord: true,
      lastCell: null,
      lastHighlightedSpan: null,
      dpr: 1,
      joystickRadius: 60,
      cursorSize: 20,
      splitPressed: false,
      ejectPressed: false,
      ejectInterval: null,
      ejectPressedByTouch: false,
      pinchZoomStartDistance: 0,
      isPinching: false,
      stickerCooldown: false,
      stickerCooldownTimer: null,
      lastStatsRenderKey: "",
      pointsLabel: null,
      Quad: null,
      donators: null,
      admins: null,
      youtubers: null,
      url_youtubers: null,
      passUsers: null,
      passPlayerNickToId: null,
      passClanNickToId: null,
      ignoredPlayers: null,
      activeDialog: null,
      dialogs: null,
      dialogMessages: null,
      maxGlobalMessages: 100,
      maxDialogMessages: 50,
      profanityCountByPlayer: null,
      BLUR_THRESHOLD: 10,
      RESET_TIME: 6e4,
      api: {}
    };
  }
  function resetWorldContainers(S) {
    S.playerCells = [];
    S.nodes = {};
    S.nodelist = [];
    S.Cells = [];
    S.leaderBoard = [];
  }
  var deps3 = {
    S: null,
    getSkinImage,
    loadCachedImage,
    normalizeNick
  };
  function bindCellDeps(d) {
    deps3 = {
      ...deps3,
      ...d
    };
  }
  var DEFAULT_TRANSPARENT = [ "liqwid", "⟨本⟩ Itana.", "†Ĵώâ4ќâ†" ];
  function ensureNameSets(S) {
    if (!S.transparent) S.transparent = new Set(DEFAULT_TRANSPARENT);
    if (!S.invisible) {
      S.invisible = new Set;
      loadInvisibleSet().then(set => {
        S.invisible = set;
      }).catch(() => {});
    }
    if (!S.rotation) {
      S.rotation = new Set;
      loadRotationSet().then(set => {
        S.rotation = set;
      }).catch(() => {});
    }
  }
  function isEjectedMass(cell) {
    const S = deps3.S;
    if (!cell || cell.isVirus || cell.isFood) return false;
    if (cell.isOwn) return false;
    const flags = cell.flag | 0;
    if (flags & 32 || flags & 64 || cell.isEjected) return true;
    const sz = cell.nSize || cell.size || 0;
    if (sz <= 0 || !(S.foodMaxSize > 0)) return false;
    return sz > S.foodMaxSize && sz <= Math.max(55, S.foodMaxSize + 20);
  }
  function getClientCellColor(cell) {
    const S = deps3.S;
    if (!S.customClientColors) return null;
    if (cell.isVirus) return S.clientColorVirus;
    if (cell.isFood) return S.clientColorFood;
    if (cell.isOwn) return S.clientColorOwn;
    if (isEjectedMass(cell)) return S.clientColorEject;
    if (!cell.isVirus && !cell.isFood && !cell.isOwn) {
      return S.clientColorEnemy;
    }
    return null;
  }
  function drawVirusFillBackground(ctx, cell, renderSize, simpleRender, bigPointSize) {
    const S = deps3.S;
    if (!S.customVirusBgEnabled || !S.virusBgImage || !S.virusBgImage.complete || !S.virusBgImage.width) {
      return false;
    }
    const half = (simpleRender ? renderSize : bigPointSize) * 1.15;
    ctx.save();
    ctx.clip();
    ctx.drawImage(S.virusBgImage, cell.x - half, cell.y - half, half * 2, half * 2);
    ctx.restore();
    return true;
  }
  function UText(usize, ucolor, ustroke, ustrokecolor) {
    usize && (this._size = usize);
    ucolor && (this._color = ucolor);
    this._stroke = !!ustroke;
    ustrokecolor && (this._strokeColor = ustrokecolor);
  }
  UText.prototype = {
    _value: "",
    _color: "#000000",
    _stroke: false,
    _strokeColor: "#000000",
    _size: 16,
    _canvas: null,
    _ctx: null,
    _dirty: false,
    _scale: 1,
    setSize(a) {
      if (this._size != a) {
        this._size = a;
        this._dirty = true;
      }
    },
    setScale(a) {
      if (this._scale != a) {
        this._scale = a;
        this._dirty = true;
      }
    },
    setStrokeColor(a) {
      if (this._strokeColor != a) {
        this._strokeColor = a;
        this._dirty = true;
      }
    },
    setStroke(a) {
      const next = !!a;
      if (this._stroke !== next) {
        this._stroke = next;
        this._dirty = true;
      }
    },
    setValue(a) {
      if (a != this._value) {
        this._value = a;
        this._dirty = true;
      }
    },
    render() {
      if (null == this._canvas) {
        this._canvas = document.createElement("canvas");
        this._ctx = this._canvas.getContext("2d");
      }
      if (this._dirty) {
        this._dirty = false;
        const canvas = this._canvas;
        const ctx = this._ctx;
        const value = this._value;
        const scale = this._scale;
        const fontsize = this._size;
        const font = fontsize + "px Ubuntu";
        ctx.font = font;
        const h = ~~(.2 * fontsize);
        const wd = fontsize * .1;
        const h2 = h * .2;
        canvas.width = ctx.measureText(value).width * scale + 3;
        canvas.height = (fontsize + h) * scale;
        ctx.font = font;
        ctx.globalAlpha = 1;
        ctx.lineWidth = wd;
        ctx.strokeStyle = this._strokeColor;
        ctx.fillStyle = this._color;
        ctx.scale(scale, scale);
        this._stroke && ctx.strokeText(value, 0, fontsize - h2);
        ctx.fillText(value, 0, fontsize - h2);
      }
      return this._canvas;
    },
    getWidth() {
      const ctx = deps3.S && deps3.S.ctx;
      if (!ctx) return 0;
      return ctx.measureText(this._value).width + 6;
    }
  };
  function Cell(uid, ux, uy, usize, ucolor, uname) {
    this.id = uid;
    this.ox = this.x = ux;
    this.oy = this.y = uy;
    this.oSize = this.size = usize;
    this.color = ucolor;
    this.points = [];
    this.pointsAcc = [];
    this.createPoints();
    this.setName(uname);
  }
  Cell.prototype = {
    id: 0,
    points: [],
    pointsAcc: [],
    name: null,
    nameCache: null,
    sizeCache: null,
    x: 0,
    y: 0,
    size: 0,
    ox: 0,
    oy: 0,
    oSize: 0,
    nx: 0,
    ny: 0,
    nSize: 0,
    flag: 0,
    updateTime: 0,
    drawTime: 0,
    destroyed: false,
    isVirus: false,
    isEjected: false,
    isAgitated: false,
    isFood: false,
    wasSimpleDrawing: true,
    fixedName: null,
    fixedColor: null,
    destroy() {
      const S = deps3.S;
      S.nodesSortDirty = true;
      const tmpIndex = S.nodelist.indexOf(this);
      if (tmpIndex !== -1) S.nodelist.splice(tmpIndex, 1);
      delete S.nodes[this.id];
      const playerIndex = S.playerCells.indexOf(this);
      if (playerIndex !== -1) {
        S.ua = true;
        S.playerCells.splice(playerIndex, 1);
      }
      this.destroyed = true;
      this.fixedName = null;
      this.fixedColor = null;
    },
    getNameSize() {
      return Math.max(~~(.3 * this.size), 24);
    },
    setName(name) {
      const S = deps3.S;
      if (S.fixedCell) {
        if (this.fixedName === null) {
          this.fixedName = name;
        }
        name = this.fixedName;
      } else {
        this.fixedName = null;
      }
      this.name = name;
      this._skinNameKey = null;
      this._skinId = null;
      const size = this.getNameSize();
      if (!this.nameCache) {
        this.nameCache = new UText(size, "#FFFFFF", true, "#000000");
      } else {
        this.nameCache.setSize(size);
      }
      this.nameCache.setValue(name);
    },
    setSize(size) {
      this.nSize = size;
      const sizeHalf = this.getNameSize() * .5;
      if (!this.sizeCache) {
        this.sizeCache = new UText(sizeHalf, "#FFFFFF", true, "#000000");
      } else {
        this.sizeCache.setSize(sizeHalf);
      }
    },
    getNumPoints() {
      const S = deps3.S;
      if (S.renderQuality === "low" || S.renderQuality === "medium") return 0;
      if (this.id === 0) return 16;
      let minPoints = this.size < 20 ? 0 : 10;
      if (this.isVirus) minPoints = 30;
      let b = this.isVirus ? this.size : this.size * S.viewZoom;
      b *= S.z;
      if (this.flag & 32) b *= .25;
      return ~~Math.max(b, minPoints);
    },
    createPoints() {
      const numPoints = this.getNumPoints();
      while (this.points.length > numPoints) {
        const idx = ~~(Math.random() * this.points.length);
        this.points.splice(idx, 1);
        this.pointsAcc.splice(idx, 1);
      }
      if (!this.points.length && numPoints > 0) {
        this.points.push({
          ref: this,
          size: this.size,
          x: this.x,
          y: this.y
        });
        this.pointsAcc.push(Math.random() - .5);
      }
      while (this.points.length < numPoints) {
        const idx = ~~(Math.random() * this.points.length);
        const point = this.points[idx];
        this.points.splice(idx, 0, {
          ref: this,
          size: point.size,
          x: point.x,
          y: point.y
        });
        this.pointsAcc.splice(idx, 0, this.pointsAcc[idx]);
      }
    },
    movePoints() {
      const S = deps3.S;
      if (S._perfMovePoints) S._perfMovePoints += 1;
      this.createPoints();
      const pts = this.points;
      const acc = this.pointsAcc;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const prev = acc[(i - 1 + n) % n];
        const next = acc[(i + 1) % n];
        acc[i] += (Math.random() - .5) * (this.isAgitated ? 3 : 1);
        acc[i] = Math.max(Math.min(acc[i] * .7, 10), -10);
        acc[i] = (prev + next + 8 * acc[i]) / 10;
      }
      const ref = this;
      const isVirus = this.isVirus ? 0 : (this.id / 1e3 + S.timestamp / 1e4) % (2 * Math.PI);
      for (let j = 0; j < n; j++) {
        let f = pts[j].size;
        const prev = pts[(j - 1 + n) % n].size;
        const next = pts[(j + 1) % n].size;
        if (this.size > 15 && S.qTree && this.size * S.viewZoom > 20 && this.id !== 0) {
          const x = pts[j].x;
          const y = pts[j].y;
          let collide = false;
          S.qTree.retrieve2(x - 5, y - 5, 10, 10, a => {
            if (a.ref !== ref && (x - a.x) ** 2 + (y - a.y) ** 2 < 625) collide = true;
          });
          if (!collide && (x < S.leftPos || y < S.topPos || x > S.rightPos || y > S.bottomPos)) {
            collide = true;
          }
          if (collide) acc[j] = Math.max(0, acc[j]) - 1;
        }
        f = Math.max(0, f + acc[j]);
        f = this.isAgitated ? (19 * f + this.size) / 20 : (12 * f + this.size) / 13;
        pts[j].size = (prev + next + 8 * f) / 10;
        const angle = 2 * Math.PI / n * j;
        let radius = pts[j].size;
        if (this.isVirus && j % 2 === 0) radius += 5;
        pts[j].x = this.x + Math.cos(angle + isVirus) * radius;
        pts[j].y = this.y + Math.sin(angle + isVirus) * radius;
      }
    },
    updatePos() {
      const S = deps3.S;
      if (this.id === 0) return 1;
      let a = (S.timestamp - this.updateTime) / 120;
      a = Math.max(0, Math.min(1, a));
      const b = a;
      this.x = a * (this.nx - this.ox) + this.ox;
      this.y = a * (this.ny - this.oy) + this.oy;
      this.size = b * (this.nSize - this.oSize) + this.oSize;
      return b;
    },
    shouldRender() {
      const S = deps3.S;
      if (this.id === 0) return true;
      const margin = 40;
      return !(this.x + this.size + margin < S.nodeX - S.canvasWidth / 2 / S.viewZoom || this.y + this.size + margin < S.nodeY - S.canvasHeight / 2 / S.viewZoom || this.x - this.size - margin > S.nodeX + S.canvasWidth / 2 / S.viewZoom || this.y - this.size - margin > S.nodeY + S.canvasHeight / 2 / S.viewZoom);
    },
    getEffectiveColor() {
      const S = deps3.S;
      const clientColor = getClientCellColor(this);
      if (clientColor) return clientColor;
      if (!S.showColor) return "#AAAAAA";
      if (S.fixedCell) {
        if (this.fixedColor === null) {
          this.fixedColor = this.color || "#FFFFFF";
        }
        return this.fixedColor;
      }
      this.fixedColor = null;
      return this.color || "#FFFFFF";
    },
    getStrokeColor() {
      const base = this.getEffectiveColor();
      const parseColor = i => {
        const hexPart = base && base.length >= i + 2 ? base.substr(i, 2) : "00";
        let c = Math.floor(parseInt(hexPart, 16) * .9).toString(16);
        return c.length === 1 ? "0" + c : c;
      };
      return `#${parseColor(1)}${parseColor(3)}${parseColor(5)}`;
    },
    drawOneCell(ctx) {
      var _a, _b;
      if (!this.shouldRender()) return;
      const S = deps3.S;
      const getSkinImage2 = deps3.getSkinImage || getSkinImage;
      const loadCachedImage2 = deps3.loadCachedImage || loadCachedImage;
      const normalizeNick2 = deps3.normalizeNick || normalizeNick;
      const transparent = S.transparent || new Set;
      const invisible = S.invisible || new Set;
      const rotation = S.rotation || new Set;
      const skinList = S.skinList || {};
      const qualitySimple = S.renderQuality === "low" || S.renderQuality === "medium";
      const simpleRender = qualitySimple || this.id !== 0 && !this.isAgitated && S.smoothRender > S.viewZoom || this.getNumPoints() < 10;
      if (!simpleRender && this.wasSimpleDrawing) this.points.forEach(p => p.size = this.size);
      let bigPointSize = this.size;
      if (!this.wasSimpleDrawing) this.points.forEach(p => bigPointSize = Math.max(bigPointSize, p.size));
      this.wasSimpleDrawing = simpleRender;
      ctx.save();
      this.drawTime = S.timestamp;
      if (this._posFrame !== S.frameId) {
        this.updatePos();
      }
      let renderSize = this.size;
      if (renderSize === 0) renderSize = 20;
      const noBorder = S.closebord || S.renderQuality === "low";
      ctx.lineWidth = noBorder ? 0 : 10;
      ctx.lineCap = "round";
      ctx.lineJoin = this.isVirus ? "miter" : "round";
      const isTransp = transparent.has(this.name);
      const cellColor = this.getEffectiveColor();
      ctx.fillStyle = isTransp ? "rgba(0,0,0,0)" : cellColor;
      ctx.strokeStyle = isTransp ? "rgba(0,0,0,0)" : simpleRender ? cellColor : this.getStrokeColor();
      ctx.beginPath();
      if (simpleRender) {
        ctx.arc(this.x, this.y, renderSize, 0, 2 * Math.PI);
      } else {
        this.movePoints();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        this.points.forEach(p => ctx.lineTo(p.x, p.y));
      }
      ctx.closePath();
      const useVirusImageFill = this.isVirus && !isTransp && drawVirusFillBackground(ctx, this, renderSize, simpleRender, bigPointSize);
      if (!noBorder) ctx.stroke();
      if (!useVirusImageFill) ctx.fill();
      if (S.showSkin && !this.isVirus) {
        const normalizeNickFn = deps3.normalizeNick || normalizeNick;
        const skinName = (_a = this._skinNameKey) != null ? _a : normalizeNickFn(this.name);
        if (this._skinNameKey !== skinName) {
          this._skinNameKey = skinName;
          this._skinId = skinList[skinName] || null;
        }
        const skinId = this._skinId;
        if (skinId) {
          const skinImg = getSkinImage2(skinId);
          if (skinImg && skinImg.complete && skinImg.width > 0) {
            ctx.save();
            ctx.clip();
            if (typeof this.skinZoom === "undefined") this.skinZoom = 1;
            if (typeof this.skinPhase === "undefined") this.skinPhase = 0;
            if (this.glowActive && S.showGlow) {
              this.skinPhase += .05;
              const targetZoom = 1 + Math.abs(Math.sin(this.skinPhase)) * .08;
              this.skinZoom += (targetZoom - this.skinZoom) * .1;
            } else {
              this.skinZoom += (1 - this.skinZoom) * .05;
              this.skinPhase = 0;
            }
            const fw = skinImg.width;
            const fh = skinImg.height;
            const frame = fw > fh ? Math.floor(Date.now() / 100 % Math.floor(fw / fh)) : 0;
            const sz = simpleRender ? this.size * this.skinZoom : bigPointSize * this.skinZoom;
            if (rotation.has(skinName)) {
              if (!this._rot) {
                this._rot = {
                  target: 0,
                  current: 0,
                  lastAngle: null
                };
              }
              const vx = this.nx - this.ox;
              const vy = this.ny - this.oy;
              let rawAngle;
              if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) {
                rawAngle = (_b = this._rot.lastAngle) != null ? _b : this._rot.current;
              } else {
                rawAngle = Math.atan2(vy, vx);
              }
              if (this._rot.lastAngle == null) {
                this._rot.lastAngle = rawAngle;
                this._rot.target = rawAngle;
                this._rot.current = rawAngle;
              } else {
                let d = rawAngle - this._rot.lastAngle;
                if (d > Math.PI) d -= 2 * Math.PI;
                if (d < -Math.PI) d += 2 * Math.PI;
                this._rot.target += d;
                this._rot.lastAngle = rawAngle;
              }
              this._rot.current += (this._rot.target - this._rot.current) * .12;
              ctx.translate(this.x, this.y);
              ctx.rotate(this._rot.current);
              ctx.drawImage(skinImg, fw > fh ? frame * fh : 0, 0, fh, fh, -sz, -sz, sz * 2, sz * 2);
            } else {
              ctx.drawImage(skinImg, fw > fh ? frame * fh : 0, 0, fh, fh, this.x - sz, this.y - sz, sz * 2, sz * 2);
            }
            ctx.restore();
          }
        }
      }
      const mass = Math.floor(this.size * this.size * .01);
      if (typeof this.glowActive === "undefined") this.glowActive = false;
      if (!this.glowActive && mass >= 22400) this.glowActive = true;
      if (this.glowActive && mass <= 22300) this.glowActive = false;
      if (this.glowActive && S.showGlow) {
        const effectImg = loadCachedImage2("/photo/limited.png");
        if (effectImg && effectImg.complete && effectImg.width > 0) {
          ctx.save();
          ctx.clip();
          const edrawSize = 2 * bigPointSize;
          ctx.globalAlpha = 1;
          ctx.drawImage(effectImg, this.x - edrawSize / 2, this.y - edrawSize / 2, edrawSize, edrawSize);
          ctx.restore();
        }
      }
      if (S.showStickers && this.stickerActive && this.currentSticker) {
        const stickerUrl = getStickerUrl(S.stickerList, this.name, this.currentSticker);
        if (stickerUrl) {
          const stickerImg = loadCachedImage2(stickerUrl);
          if (stickerImg && stickerImg.complete && stickerImg.width > 0) {
            ctx.save();
            ctx.clip();
            const fw = stickerImg.width;
            const fh = stickerImg.height;
            const sz = this.size;
            ctx.drawImage(stickerImg, 0, 0, fw, fh, this.x - sz, this.y - sz, sz * 2, sz * 2);
            ctx.restore();
          }
        }
      }
      if (this.id !== 0) {
        const x = this.x;
        const y = this.y;
        const zoomRatio = Math.ceil(10 * S.viewZoom) * .1;
        const invZoom = 1 / zoomRatio;
        if (S.showName && this.name && this.nameCache && this.size > 10) {
          let displayName = this.name;
          const lowerName = this.name.toLowerCase();
          if (invisible.has(lowerName)) displayName = "";
          this.nameCache.setValue(displayName);
          this.nameCache.setSize(this.getNameSize());
          this.nameCache.setScale(zoomRatio);
          this.nameCache.setStroke(S.renderQuality !== "low");
          const img = this.nameCache.render();
          let drawWidth = img.width * invZoom;
          let drawHeight = img.height * invZoom;
          const MAX_WIDTH_FACTOR = 2;
          const maxAllowedWidth = this.size * MAX_WIDTH_FACTOR;
          if (drawWidth > maxAllowedWidth) {
            const shrink = maxAllowedWidth / drawWidth;
            drawWidth *= shrink;
            drawHeight *= shrink;
          }
          const drawX = x - drawWidth / 2;
          const drawY = y - drawHeight / 2;
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        }
        if (S.renderQuality !== "low" && S.showMass && !this.isVirus && !this.isEjected && !this.isAgitated && this.size > 100) {
          const massVal = Math.floor(this.size * this.size * .01);
          this.sizeCache.setValue(massVal);
          this.sizeCache.setScale(zoomRatio);
          const img = this.sizeCache.render();
          ctx.drawImage(img, x - img.width * invZoom / 2, y + img.height * .9 * invZoom, img.width * invZoom, img.height * invZoom);
        }
      }
      ctx.restore();
    }
  };
  var Quad = {
    init(args) {
      const maxChildren = args.maxChildren || 2;
      const maxDepth = args.maxDepth || 4;
      function Node(x, y, w, h, depth) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.depth = depth;
        this.items = [];
        this.nodes = [];
      }
      Node.prototype = {
        exists(selector) {
          for (let i = 0; i < this.items.length; ++i) {
            const item = this.items[i];
            if (item.x >= selector.x && item.y >= selector.y && item.x < selector.x + selector.w && item.y < selector.y + selector.h) {
              return true;
            }
          }
          if (this.nodes.length) {
            const self = this;
            return this.findOverlappingNodes(selector, dir => self.nodes[dir].exists(selector));
          }
          return false;
        },
        retrieve(item, callback) {
          for (let i = 0; i < this.items.length; ++i) callback(this.items[i]);
          if (this.nodes.length) {
            const self = this;
            this.findOverlappingNodes(item, dir => {
              self.nodes[dir].retrieve(item, callback);
            });
          }
        },
        insert(a) {
          if (this.nodes.length) {
            this.nodes[this.findInsertNode(a)].insert(a);
          } else if (this.items.length >= maxChildren && this.depth < maxDepth) {
            this.devide();
            this.nodes[this.findInsertNode(a)].insert(a);
          } else {
            this.items.push(a);
          }
        },
        findInsertNode(a) {
          return a.x < this.x + this.w / 2 ? a.y < this.y + this.h / 2 ? 0 : 2 : a.y < this.y + this.h / 2 ? 1 : 3;
        },
        findOverlappingNodes(a, b) {
          return a.x < this.x + this.w / 2 && (a.y < this.y + this.h / 2 && b(0) || a.y >= this.y + this.h / 2 && b(2)) || a.x >= this.x + this.w / 2 && (a.y < this.y + this.h / 2 && b(1) || a.y >= this.y + this.h / 2 && b(3));
        },
        devide() {
          const depth = this.depth + 1;
          const hw = this.w / 2;
          const hh = this.h / 2;
          this.nodes.push(new Node(this.x, this.y, hw, hh, depth));
          this.nodes.push(new Node(this.x + hw, this.y, hw, hh, depth));
          this.nodes.push(new Node(this.x, this.y + hh, hw, hh, depth));
          this.nodes.push(new Node(this.x + hw, this.y + hh, hw, hh, depth));
          const items = this.items;
          this.items = [];
          for (let i = 0; i < items.length; i++) this.insert(items[i]);
        },
        clear() {
          for (let i = 0; i < this.nodes.length; i++) this.nodes[i].clear();
          this.items.length = 0;
          this.nodes.length = 0;
        }
      };
      const internalSelector = {
        x: 0,
        y: 0,
        w: 0,
        h: 0
      };
      return {
        root: new Node(args.minX, args.minY, args.maxX - args.minX, args.maxY - args.minY, 0),
        insert(a) {
          this.root.insert(a);
        },
        retrieve(a, b) {
          this.root.retrieve(a, b);
        },
        retrieve2(a, b, c, d, callback) {
          internalSelector.x = a;
          internalSelector.y = b;
          internalSelector.w = c;
          internalSelector.h = d;
          this.root.retrieve(internalSelector, callback);
        },
        exists(a) {
          return this.root.exists(a);
        },
        clear() {
          this.root.clear();
        }
      };
    }
  };
  var KEYBINDS_KEY = "keybinds_v1";
  var CELL_COLORS = [ "#003366", "#336699", "#3366CC", "#003399", "#000099", "#0000CC", "#000066", "#006666", "#006699", "#0099CC", "#0066CC", "#0033CC", "#0000FF", "#3333FF", "#333399", "#669999", "#009999", "#33CCCC", "#00CCFF", "#0099FF", "#0066FF", "#3366FF", "#3333CC", "#666699", "#339966", "#00CC99", "#00FFCC", "#00FFFF", "#33CCFF", "#3399FF", "#6699FF", "#6666FF", "#6600FF", "#6600CC", "#339933", "#00CC66", "#00FF99", "#66FFCC", "#66FFFF", "#66CCFF", "#99CCFF", "#9999FF", "#9966FF", "#9933FF", "#9900FF", "#006600", "#00CC00", "#00FF00", "#66FF99", "#99FFCC", "#CCFFFF", "#CCCCFF", "#CC99FF", "#CC66FF", "#CC33FF", "#CC00FF", "#9900CC", "#003300", "#009933", "#33CC33", "#66FF66", "#99FF99", "#CCFFCC", "#FFCCFF", "#FF99FF", "#FF66FF", "#FF00FF", "#CC00CC", "#660066", "#336600", "#009900", "#66FF33", "#99FF66", "#CCFF99", "#FFFFCC", "#FFCCCC", "#FF99CC", "#FF66CC", "#FF33CC", "#CC0099", "#993399", "#333300", "#669900", "#99FF33", "#CCFF66", "#FFFF99", "#FFCC99", "#FF9999", "#FF6699", "#FF3399", "#CC3399", "#990099", "#666633", "#99CC00", "#CCFF33", "#FFFF66", "#FFCC66", "#FF9966", "#FF6666", "#FF0066", "#CC6699", "#993366", "#999966", "#CCCC00", "#FFFF00", "#FFCC00", "#FF9933", "#FF66000", "#FF5050", "#CC0066", "#660033", "#996633", "#CC9900", "#FF9900", "#CC6600", "#FF3300", "#FF0000", "#CC0000", "#990033", "#663300", "#996600", "#CC3300", "#993300", "#990000", "#800000", "#993333" ];
  function loadKeybinds(defaults = KEYBIND_DEFAULTS) {
    const saved = lsGetJson(KEYBINDS_KEY, null);
    const binds = Object.assign({}, defaults);
    if (saved) {
      Object.keys(defaults).forEach(action => {
        if (typeof saved[action] === "number") binds[action] = saved[action];
      });
    }
    return binds;
  }
  function saveKeybinds(binds) {
    lsSetJson(KEYBINDS_KEY, binds);
  }
  function keyCodeToLabel(code) {
    const named = {
      8: "Backspace",
      9: "Tab",
      13: "Enter",
      16: "Shift",
      17: "Ctrl",
      18: "Alt",
      20: "CapsLock",
      27: "Esc",
      32: "Space",
      37: "←",
      38: "↑",
      39: "→",
      40: "↓"
    };
    if (named[code]) return named[code];
    if (code >= 65 && code <= 90) return String.fromCharCode(code);
    if (code >= 48 && code <= 57) return String.fromCharCode(code);
    if (code >= 96 && code <= 105) return "Numpad " + (code - 96);
    return "Код " + code;
  }
  function getBind(S, action) {
    const code = S.keyBinds[action];
    return typeof code === "number" ? code : KEYBIND_DEFAULTS[action];
  }
  function assignKeybind(S, action, code) {
    const other = Object.keys(S.keyBinds).find(a => a !== action && S.keyBinds[a] === code);
    if (other) S.keyBinds[other] = S.keyBinds[action];
    S.keyBinds[action] = code;
    saveKeybinds(S.keyBinds);
    cancelKeybindCapture(S);
  }
  function resetKeybinds(S) {
    S.keyBinds = Object.assign({}, KEYBIND_DEFAULTS);
    saveKeybinds(S.keyBinds);
    S.mouseSplitButton = 3;
    S.mouseEjectButton = 1;
    saveMouseButtonSettings(S);
    const splitSel = document.getElementById("mouse-split-btn");
    const ejectSel = document.getElementById("mouse-eject-btn");
    if (splitSel) splitSel.value = "3";
    if (ejectSel) ejectSel.value = "1";
    renderKeybindUI(S);
  }
  function renderKeybindUI(S) {
    const list = document.getElementById("keybind-list");
    if (!list) return;
    list.querySelectorAll(".keybind-key").forEach(btn => {
      const action = btn.dataset.action;
      if (action) btn.textContent = keyCodeToLabel(getBind(S, action));
    });
  }
  function cancelKeybindCapture(S) {
    S.keybindCaptureAction = null;
    document.querySelectorAll(".keybind-key.listening").forEach(el => el.classList.remove("listening"));
    renderKeybindUI(S);
  }
  function normalizeMouseButton(btn) {
    if (btn === 0) return 0;
    return btn === 3 ? 3 : 1;
  }
  function syncMouseBindSettingsVisibility(S) {
    const block = document.getElementById("mouse-bind-settings");
    if (block) block.classList.toggle("visible", !!S.enableMouseClicks);
  }
  function loadMouseButtonSettings(S) {
    const split = parseInt(getCookie("mouse_split_btn"), 10);
    const eject = parseInt(getCookie("mouse_eject_btn"), 10);
    S.mouseSplitButton = normalizeMouseButton(split);
    S.mouseEjectButton = normalizeMouseButton(eject);
    if (S.mouseSplitButton !== 0 && S.mouseSplitButton === S.mouseEjectButton) {
      S.mouseEjectButton = S.mouseSplitButton === 1 ? 3 : 1;
    }
    const splitSel = document.getElementById("mouse-split-btn");
    const ejectSel = document.getElementById("mouse-eject-btn");
    if (splitSel) splitSel.value = String(S.mouseSplitButton);
    if (ejectSel) ejectSel.value = String(S.mouseEjectButton);
    syncMouseBindSettingsVisibility(S);
  }
  function saveMouseButtonSettings(S) {
    setCookie("mouse_split_btn", S.mouseSplitButton, 365);
    setCookie("mouse_eject_btn", S.mouseEjectButton, 365);
  }
  function initMouseButtonSettings(S) {
    loadMouseButtonSettings(S);
    const splitSel = document.getElementById("mouse-split-btn");
    const ejectSel = document.getElementById("mouse-eject-btn");
    if (!splitSel || !ejectSel) return;
    splitSel.addEventListener("change", function() {
      S.mouseSplitButton = normalizeMouseButton(parseInt(this.value, 10));
      if (S.mouseSplitButton !== 0 && S.mouseSplitButton === S.mouseEjectButton) {
        S.mouseEjectButton = S.mouseSplitButton === 1 ? 3 : 1;
        ejectSel.value = String(S.mouseEjectButton);
      }
      saveMouseButtonSettings(S);
    });
    ejectSel.addEventListener("change", function() {
      S.mouseEjectButton = normalizeMouseButton(parseInt(this.value, 10));
      if (S.mouseEjectButton !== 0 && S.mouseSplitButton === S.mouseEjectButton) {
        S.mouseSplitButton = S.mouseEjectButton === 1 ? 3 : 1;
        splitSel.value = String(S.mouseSplitButton);
      }
      saveMouseButtonSettings(S);
    });
  }
  function initKeybindSettings(S) {
    if (S.keybindUiInitialized) return;
    S.keybindUiInitialized = true;
    S.keyBinds = loadKeybinds();
    const list = document.getElementById("keybind-list");
    if (!list) return;
    Object.keys(KEYBIND_DEFAULTS).forEach(action => {
      const row = document.createElement("div");
      row.className = "keybind-row";
      const label = document.createElement("span");
      label.textContent = KEYBIND_LABELS[action] || action;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "keybind-key";
      btn.dataset.action = action;
      btn.textContent = keyCodeToLabel(getBind(S, action));
      btn.addEventListener("click", () => {
        S.keybindCaptureAction = action;
        btn.textContent = "…нажмите клавишу";
        btn.classList.add("listening");
      });
      row.appendChild(label);
      row.appendChild(btn);
      list.appendChild(row);
    });
    const resetBtn = document.getElementById("keybind-reset");
    if (resetBtn) resetBtn.addEventListener("click", () => resetKeybinds(S));
    initMouseButtonSettings(S);
  }
  function initSettingsNav() {
    const layout = document.querySelector(".settings-layout");
    if (!layout) return;
    const navItems = layout.querySelectorAll(".settings-nav-item");
    const panels = layout.querySelectorAll(".settings-panel");
    if (!navItems.length || !panels.length) return;
    function showSettingsPanel(panelId) {
      panels.forEach(p => p.classList.toggle("active", p.dataset.panel === panelId));
      navItems.forEach(btn => btn.classList.toggle("active", btn.dataset.panel === panelId));
      try {
        localStorage.setItem("settings_active_panel", panelId);
      } catch (e) {}
    }
    navItems.forEach(btn => {
      btn.addEventListener("click", () => showSettingsPanel(btn.dataset.panel));
    });
    let initial = "graphics";
    try {
      const saved = localStorage.getItem("settings_active_panel");
      if (saved && layout.querySelector(`.settings-panel[data-panel="${saved}"]`)) {
        initial = saved;
      }
    } catch (e) {}
    showSettingsPanel(initial);
  }
  function attachInput(S, hooks) {
    const wHandle = S.wHandle;
    if (!S.keyBinds) S.keyBinds = loadKeybinds();
    if (!S.cellColors) S.cellColors = CELL_COLORS;
    wHandle.resetKeybinds = () => resetKeybinds(S);
    let isTyping = false;
    let currentSticker = null;
    const keyPressed = {};
    const mouseHoldState = {};
    S.ma = true;
    S.freeze = false;
    S.stickerCooldown = false;
    const reconnectBtn = document.getElementById("connect-verify-reconnect-btn");
    if (reconnectBtn && !reconnectBtn.dataset.bound) {
      reconnectBtn.dataset.bound = "1";
      reconnectBtn.addEventListener("click", hooks.reconnectToServer);
    }
    S.mainCanvas = S.nCanvas = document.getElementById("canvas");
    S.ctx = S.mainCanvas.getContext("2d");
    function syncMouseFromEvent(event2) {
      const dpr = S.dpr || getEffectiveDpr(S);
      S.rawMouseX = event2.clientX * dpr;
      S.rawMouseY = event2.clientY * dpr;
      mouseCoordinateChange(S);
    }
    S.mainCanvas.onmousemove = syncMouseFromEvent;
    document.addEventListener("mousemove", syncMouseFromEvent, {
      passive: true
    });
    const updateMouseAim = () => {
      let x = S.X < S.rightPos ? S.X : S.rightPos;
      let y = S.Y < S.bottomPos ? S.Y : S.bottomPos;
      x = -S.rightPos > x ? -S.rightPos : x;
      y = -S.bottomPos > y ? -S.bottomPos : y;
      S.posX = x;
      S.posY = y;
    };
    S.mainCanvas.addEventListener("mousedown", () => {
      if (!S.playerCells.length) {
        updateMouseAim();
        hooks.sendUint8(1);
      }
    });
    if (S.touchable) {
      S.mainCanvas.addEventListener("touchstart", onTouchStart, false);
      S.mainCanvas.addEventListener("touchmove", onTouchMove, false);
      S.mainCanvas.addEventListener("touchend", onTouchEnd, false);
    }
    S.mainCanvas.onmouseup = function() {};
    function handleWheel(event2) {
      const chatContainer = document.querySelector(".noscroll");
      if (isOverlaysVisible() || isPointerOverElement(chatContainer, event2.clientX, event2.clientY)) return;
      S.zoom *= Math.pow(.9, event2.wheelDelta / -120 || event2.detail || 0);
      if (S.zoom < 0) S.zoom = 1;
      if (S.zoom > 4 / S.viewZoom) S.zoom = 4 / S.viewZoom;
      if (S.zoom < .3) S.zoom = .3;
    }
    if (/firefox/i.test(navigator.userAgent)) {
      document.addEventListener("DOMMouseScroll", handleWheel, false);
    } else {
      document.body.onmousewheel = handleWheel;
    }
    S.mainCanvas.onfocus = () => {
      isTyping = false;
    };
    document.querySelectorAll(".noPress").forEach(elem => {
      elem.onblur = () => {
        isTyping = false;
      };
      elem.onfocus = () => {
        isTyping = true;
      };
    });
    function sendSticker(stickerId, action) {
      if (hooks.wsIsOpen()) {
        const msg = hooks.prepareData(6);
        msg.setUint8(0, 200);
        msg.setUint8(1, stickerId);
        msg.setUint8(2, action ? 1 : 0);
        hooks.wsSend(msg);
      }
    }
    function showStickerOverCell(stickerId) {
      const cell = S.playerCells[0];
      if (!cell) return;
      cell.currentSticker = stickerId;
      cell.stickerActive = true;
    }
    function hideSticker() {
      const cell = S.playerCells[0];
      if (cell) {
        cell.currentSticker = null;
        cell.stickerActive = false;
      }
    }
    function pressStickerKey(stickerId) {
      if (!S.showStickers || isTyping || S.stickerCooldown || currentSticker === stickerId) return;
      if (currentSticker !== null) {
        sendSticker(currentSticker, false);
        hideSticker();
      }
      currentSticker = stickerId;
      sendSticker(stickerId, true);
      showStickerOverCell(stickerId);
      S.stickerCooldown = true;
      if (S.stickerCooldownTimer) clearTimeout(S.stickerCooldownTimer);
      S.stickerCooldownTimer = setTimeout(() => {
        S.stickerCooldown = false;
      }, 500);
    }
    function releaseStickerKey(stickerId) {
      if (currentSticker === stickerId) {
        currentSticker = null;
        sendSticker(stickerId, false);
        hideSticker();
      }
    }
    wHandle.onkeydown = function(event2) {
      if (S.keybindCaptureAction) {
        event2.preventDefault();
        const code2 = event2.keyCode;
        if (code2 === 27) {
          cancelKeybindCapture(S);
          return;
        }
        assignKeybind(S, S.keybindCaptureAction, code2);
        return;
      }
      const code = event2.keyCode;
      if (code === getBind(S, "chat")) {
        if (isTyping || S.hideChat) {
          isTyping = false;
          const chatInput = document.getElementById("chat_textbox");
          const lsInput = document.getElementById("ls");
          const lsText = lsInput ? lsInput.value.trim() : "";
          const chatText = chatInput ? chatInput.value.trim() : "";
          let combinedText = "";
          if (lsText && chatText) combinedText = lsText + " " + chatText; else if (lsText) combinedText = lsText; else if (chatText) combinedText = chatText;
          if (combinedText.length > 0) hooks.sendChat(combinedText);
          if (chatInput) chatInput.value = "";
          if (lsInput) lsInput.value = "";
          if (chatInput) chatInput.blur();
          if (lsInput) lsInput.blur();
        } else {
          document.getElementById("chat_textbox").focus();
          isTyping = true;
        }
        return;
      }
      if (isTyping) return;
      if (code === getBind(S, "freeze")) {
        if (!keyPressed.freeze && S.playerCells.length > 0) {
          S.freeze = !S.freeze;
          if (S.freeze) {
            S.posX = S.X;
            S.posY = S.Y;
            document.querySelector("#freeze").style.display = "flex";
          } else {
            document.querySelector("#freeze").style.display = "none";
          }
          keyPressed.freeze = true;
        }
        return;
      }
      if (code === getBind(S, "split")) {
        if (!keyPressed.split) {
          hooks.sendMouseMove();
          hooks.sendUint8(17);
          keyPressed.split = true;
        }
        return;
      }
      if (code === getBind(S, "coord")) {
        if (!keyPressed.coord) {
          hooks.coord();
          keyPressed.coord = true;
        }
        return;
      }
      if (code === getBind(S, "eject")) {
        if (!keyPressed.eject) {
          hooks.sendMouseMove();
          hooks.sendUint8(21);
          keyPressed.eject = true;
          S.ejectKeyInterval = setInterval(function() {
            hooks.sendMouseMove();
            hooks.sendUint8(21);
          }, 100);
        }
        return;
      }
      if (code === getBind(S, "macroQ")) {
        if (!keyPressed.macroQ) {
          hooks.sendUint8(18);
          keyPressed.macroQ = true;
        }
        return;
      }
      if (code === getBind(S, "macroE")) {
        if (!keyPressed.macroE) {
          hooks.sendMouseMove();
          hooks.sendUint8(22);
          keyPressed.macroE = true;
        }
        return;
      }
      if (code === getBind(S, "macroR")) {
        if (!keyPressed.macroR) {
          hooks.sendMouseMove();
          hooks.sendUint8(23);
          hooks.fixDead();
          keyPressed.macroR = true;
        }
        return;
      }
      if (code === getBind(S, "macroT")) {
        if (!keyPressed.macroT) {
          hooks.sendMouseMove();
          hooks.sendUint8(24);
          keyPressed.macroT = true;
        }
        return;
      }
      if (code === getBind(S, "macroP")) {
        if (!keyPressed.macroP) {
          hooks.sendMouseMove();
          hooks.sendUint8(25);
          keyPressed.macroP = true;
        }
        return;
      }
      for (let s = 1; s <= 9; s++) {
        if (code === getBind(S, "sticker" + s)) {
          pressStickerKey(s);
          return;
        }
      }
    };
    wHandle.onkeyup = function(event2) {
      const code = event2.keyCode;
      if (code === getBind(S, "freeze")) keyPressed.freeze = false;
      if (code === getBind(S, "split")) keyPressed.split = false;
      if (code === getBind(S, "coord")) keyPressed.coord = false;
      if (code === getBind(S, "eject")) {
        keyPressed.eject = false;
        clearInterval(S.ejectKeyInterval);
        S.ejectKeyInterval = null;
      }
      if (code === getBind(S, "macroQ")) {
        if (keyPressed.macroQ) {
          hooks.sendUint8(19);
          keyPressed.macroQ = false;
        }
      }
      if (code === getBind(S, "macroE")) keyPressed.macroE = false;
      if (code === getBind(S, "macroR")) keyPressed.macroR = false;
      if (code === getBind(S, "macroT")) keyPressed.macroT = false;
      if (code === getBind(S, "macroP")) keyPressed.macroP = false;
      for (let s = 1; s <= 9; s++) {
        if (code === getBind(S, "sticker" + s)) releaseStickerKey(s);
      }
    };
    const colorSelected = document.getElementById("selectedColor");
    const colorList = document.getElementById("colorList");
    const skinss = document.getElementById("skinss");
    const colorSaved = localStorage.getItem("selectedColor");
    if (colorSaved && colorSelected) {
      colorSelected.style.background = colorSaved;
      if (skinss) {
        skinss.style.borderColor = colorSaved;
        skinss.style.backgroundColor = colorSaved;
        skinss.style.boxShadow = `0 0 10px ${colorSaved}`;
      }
    }
    if (colorSelected) {
      colorSelected.onclick = () => {
        colorList.style.display = colorList.style.display === "none" || colorList.style.display === "" ? "flex" : "none";
      };
    }
    if (colorList) {
      colorList.onclick = evt => {
        const hex = evt.target._cellColorHex;
        if (!hex) return;
        colorSelected.style.background = hex;
        localStorage.setItem("selectedColor", hex);
        skinss.style.borderColor = hex;
        skinss.style.backgroundColor = hex;
        skinss.style.boxShadow = `0 0 10px ${hex}`;
        colorList.style.display = "none";
      };
      S.cellColors.forEach(hex => {
        const d = document.createElement("div");
        d.className = "item";
        d.style.background = hex;
        d._cellColorHex = hex;
        colorList.appendChild(d);
      });
    }
    wHandle.onblur = function() {
      hooks.sendUint8(19);
      clearInterval(S.ejectKeyInterval);
      S.ejectKeyInterval = null;
      Object.keys(keyPressed).forEach(k => {
        keyPressed[k] = false;
      });
    };
    document.addEventListener("contextmenu", () => {
      if (keyPressed.eject) {
        keyPressed.eject = false;
        clearInterval(S.ejectKeyInterval);
        S.ejectKeyInterval = null;
      }
    });
    const doSplitAction = () => {
      hooks.sendMouseMove();
      hooks.sendUint8(17);
    };
    const doEjectAction = () => {
      hooks.sendMouseMove();
      hooks.sendUint8(21);
    };
    const getMouseAction = which => {
      if (which === S.mouseSplitButton) return "split";
      if (which === S.mouseEjectButton) return "eject";
      return null;
    };
    const clearMouseButton = which => {
      const st = mouseHoldState[which];
      if (!st) return;
      st.down = false;
      if (st.interval) clearInterval(st.interval);
      if (st.timeout) clearTimeout(st.timeout);
      delete mouseHoldState[which];
    };
    const clearAllMouseHolds = () => {
      Object.keys(mouseHoldState).forEach(k => clearMouseButton(+k));
    };
    window.addEventListener("blur", clearAllMouseHolds);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearAllMouseHolds();
    });
    document.addEventListener("mousedown", function(event2) {
      var _a;
      if (!S.enableMouseClicks || isTyping) return;
      if (isOverlaysVisible()) return;
      const which = event2.which;
      const action = getMouseAction(which);
      if (!action || ((_a = mouseHoldState[which]) == null ? void 0 : _a.down)) return;
      mouseHoldState[which] = {
        down: true,
        interval: null,
        timeout: null
      };
      if (action === "split") {
        doSplitAction();
        mouseHoldState[which].timeout = setTimeout(() => {
          var _a2;
          if ((_a2 = mouseHoldState[which]) == null ? void 0 : _a2.down) {
            mouseHoldState[which].interval = setInterval(() => {
              var _a3;
              if ((_a3 = mouseHoldState[which]) == null ? void 0 : _a3.down) doSplitAction();
            }, 50);
          }
        }, 130);
      } else {
        doEjectAction();
        mouseHoldState[which].interval = setInterval(() => {
          var _a2;
          if ((_a2 = mouseHoldState[which]) == null ? void 0 : _a2.down) doEjectAction();
        }, 100);
      }
    });
    window.addEventListener("mouseup", function(event2) {
      clearMouseButton(event2.which);
    });
    window.addEventListener("mouseleave", () => {
      clearAllMouseHolds();
    });
    document.addEventListener("contextmenu", function(event2) {
      if (S.enableMouseClicks) event2.preventDefault();
    });
    onReady(function() {
      document.addEventListener("keydown", function(event2) {
        if (event2.keyCode === getBind(S, "menu")) {
          hideStatics();
          if (isOverlaysVisible()) {
            hideOverlays();
          } else {
            showOverlays();
          }
        }
      });
    });
    S.dpr = getEffectiveDpr(S);
    function onTouchStart(e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const size = ~~(S.canvasWidth / 7);
        if (touch.clientX * S.dpr > S.canvasWidth - size && touch.clientY * S.dpr > S.canvasHeight - size) {
          hooks.sendMouseMove();
          hooks.sendUint8(17);
          continue;
        }
        if (touch.clientX * S.dpr > S.canvasWidth - size && touch.clientY * S.dpr > S.canvasHeight - 2 * size - 10 && touch.clientY * S.dpr < S.canvasHeight - size - 10) {
          S.ejectPressedByTouch = true;
          if (!S.ejectInterval) {
            hooks.sendMouseMove();
            hooks.sendUint8(21);
            S.ejectInterval = setInterval(() => {
              if (S.ejectPressedByTouch && hooks.wsIsOpen()) {
                hooks.sendMouseMove();
                hooks.sendUint8(21);
              }
            }, 80);
          }
          continue;
        }
        if (S.leftTouchID < 0) {
          S.leftTouchID = touch.identifier;
          S.leftTouchStartPos.reset(touch.clientX * S.dpr, touch.clientY * S.dpr);
          S.leftTouchPos.copyFrom(S.leftTouchStartPos);
          S.leftVector.reset(0, 0);
        }
      }
      S.touches = e.touches;
    }
    function onTouchMove(e) {
      e.preventDefault();
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        if (!S.isPinching) {
          S.pinchZoomStartDistance = currentDistance;
          S.isPinching = true;
        } else {
          const delta = currentDistance - S.pinchZoomStartDistance;
          const zoomFactor = 1 + delta / 300;
          S.zoom *= zoomFactor;
          if (S.zoom < .3) S.zoom = .3;
          if (S.zoom > 4 / S.viewZoom) S.zoom = 4 / S.viewZoom;
          S.pinchZoomStartDistance = currentDistance;
        }
        return;
      }
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (S.leftTouchID === touch.identifier) {
          S.leftTouchPos.reset(touch.clientX * S.dpr, touch.clientY * S.dpr);
          S.leftVector.copyFrom(S.leftTouchPos);
          S.leftVector.minusEq(S.leftTouchStartPos);
          const distance = Math.sqrt(S.leftVector.x ** 2 + S.leftVector.y ** 2);
          if (distance > S.joystickRadius) {
            const scale = S.joystickRadius / distance;
            S.leftVector.x *= scale;
            S.leftVector.y *= scale;
            S.leftTouchPos.x = S.leftTouchStartPos.x + S.leftVector.x;
            S.leftTouchPos.y = S.leftTouchStartPos.y + S.leftVector.y;
          }
          S.rawMouseX = S.leftVector.x * 3 + S.canvasWidth / 2;
          S.rawMouseY = S.leftVector.y * 3 + S.canvasHeight / 2;
          mouseCoordinateChange(S);
          hooks.sendMouseMove();
        }
      }
      S.touches = e.touches;
    }
    function onTouchEnd(e) {
      if (e.touches.length < 2) {
        S.isPinching = false;
      }
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (S.leftTouchID === touch.identifier) {
          S.leftTouchID = -1;
          S.leftVector.reset(0, 0);
        }
        const size = ~~(S.canvasWidth / 7);
        if (touch.clientX * S.dpr > S.canvasWidth - size && touch.clientY * S.dpr > S.canvasHeight - 2 * size - 10 && touch.clientY * S.dpr < S.canvasHeight - size - 10) {
          S.ejectPressedByTouch = false;
          if (S.ejectInterval) {
            clearInterval(S.ejectInterval);
            S.ejectInterval = null;
          }
        }
      }
      if (e.touches.length === 0) {
        S.ejectPressedByTouch = false;
        if (S.ejectInterval) {
          clearInterval(S.ejectInterval);
          S.ejectInterval = null;
        }
      }
      S.touches = e.touches;
    }
    wHandle.onresize = () => canvasResize(S);
    canvasResize(S);
    wHandle.requestAnimationFrame(hooks.redrawGameScene);
    setInterval(hooks.sendMouseMove, 50);
    showOverlays();
    if (hooks.updateStats) setInterval(hooks.updateStats, 100);
    S.mainCanvas.focus();
    return {
      sendSticker,
      getBind: action => getBind(S, action)
    };
  }
  var STATS_API = "https://api.agar.su:6009";
  var STATS_PAGE_URL = "https://agar.su/stats/";
  var STATS_PROFILE_BASE = "https://agar.su/stats/users/?id=";
  var STATS_CLAN_PROFILE_BASE = "https://agar.su/stats/clans/?id=";
  var FORBIDDEN_NICK_CHARS = [ "﷽", "𒐫", "𒈙", "⸻", "꧅", "ဪ", "௵", "௸", "‱", "ㅤ", "⁣", "‎ ", "​", "‌", "‍", "‎", "‏", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", " ", "​", "\ufeff", "", " ", "⠀", "ﾠ", "卐", "卍" ];
  function getStarClass(level) {
    if (level >= 1 && level < 50) return "";
    if (level >= 50 && level < 100) return "azure";
    if (level >= 100 && level < 150) return "red";
    if (level >= 150 && level < 200) return "white";
    if (level >= 200) return "black";
    return "";
  }
  var getXp = level => ~~(100 * (level ** 2 / 2));
  var getLevel = xp => ~~((xp / 100 * 2) ** .5);
  function getPlayerSkinId(S, nick) {
    const normalized = normalizeNick((nick || "").replace(/<[^>]*>/g, ""));
    return normalized && S.skinList[normalized] ? S.skinList[normalized] : "4";
  }
  function createLevelIcon(S, level, nick, hooks) {
    const getSkinImageUrl2 = hooks.getSkinImageUrl;
    if (level >= 200) {
      const img = document.createElement("img");
      img.className = "account-level-avatar " + getStarClass(level);
      setImgSrc(img, getSkinImageUrl2(getPlayerSkinId(S, nick)));
      img.onerror = () => {
        if (!img.dataset.fallback) {
          img.dataset.fallback = "1";
          setImgSrc(img, SKIN_FALLBACK_URL);
        }
      };
      return img;
    }
    const starIcon = document.createElement("i");
    starIcon.className = "fas fa-star " + getStarClass(level);
    return starIcon;
  }
  var scoreMessages2 = {
    low: [ "Ничего, зови друзей и попробуй ещё раз!", "Только начало! Поделись с друзьями и вернись сильным!", "Быстро умер? Зови друзей, пусть они покажут мастерство!", "Не расстраивайся, каждая игра — это опыт. Попробуй снова!", "Попробуй поменять фон в настройках — может, поможет!", "Используй F, чтобы остановиться и обдумать стратегию!", "Терпение и стратегия важнее скорости!", "Нажимая W — выделяется цешка (маленькая масса)." ],
    mid: [ "Неплохо! Позови друзей и бросьте друг другу вызов!", "Хорошая игра! Поделись результатом и зови друзей!", "Ты уже на полпути! Продолжай и удиви всех!", "F — для паузы и стратегии. Используй с умом!", "W — цешка. Корми врагов или заманивай!" ],
    high: [ "Вау! Легендарный результат! Делись с друзьями!", "Ты на вершине! Покажи, кто настоящий чемпион!", "Превосходно! Каждый шаг — как по учебнику!", "Настройки фона — твой стиль, твоя концентрация!", "F в нужный момент — контроль даже на вершине!", "Ты — мастер! Бей рекорды дальше!" ]
  };
  function pointsLabel(n) {
    n = Math.abs(Number(n) || 0);
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return n + " очков";
    if (mod10 === 1) return n + " очко";
    if (mod10 >= 2 && mod10 <= 4) return n + " очка";
    return n + " очков";
  }
  function displayStats(S, stats) {
    const renderKey = JSON.stringify(stats);
    if (renderKey === S.lastStatsRenderKey) return;
    S.lastStatsRenderKey = renderKey;
    const container = document.getElementById("table-containerwraper");
    if (!container) return;
    container.innerHTML = "";
    stats.forEach((player, index) => {
      const playerDiv = document.createElement("div");
      playerDiv.classList.add("top-playerwraper");
      playerDiv.setAttribute("title", player.time);
      playerDiv.innerHTML = `\n        <div>${index + 1}</div>\n        <div>${player.nick}</div>\n        <div>${player.score}</div>\n        <div class="skinswraper" style="background-image: url('${getSkinUrlForNick(S.skinList, player.nick)}');"></div>\n    `;
      container.appendChild(playerDiv);
    });
  }
  async function fetchStats(S, stats) {
    try {
      if (!Array.isArray(stats)) {
        throw new Error("Invalid stats data");
      }
      const {map, obj} = await loadSkinListMap();
      applySkinListToState(S, {
        map,
        obj
      });
      stats.forEach(player => {
        player.skin = getSkinIdForNick(map, player.nick);
      });
      displayStats(S, stats);
    } catch (error) {
      console.error("There was a problem with the fetch operation:", error);
    }
  }
  function loadTopPlayerData2(S, stat, hooks) {
    try {
      if (stat.length > 0) {
        const topPlayer = stat[0];
        S.topPlayerNick = topPlayer.nick;
        S.topPlayerScore = topPlayer.score;
        const skinId = getSkinIdForNick(S.skinList, topPlayer.nick, "4");
        if (typeof (hooks == null ? void 0 : hooks.onTopPlayer) === "function") {
          hooks.onTopPlayer(topPlayer);
        } else if ((hooks == null ? void 0 : hooks.innerImage) && typeof hooks.getSkinImageUrl === "function") {
          const innerImage2 = hooks.innerImage;
          const nextSrc = hooks.getSkinImageUrl(skinId);
          if (innerImage2.dataset.skinSrc !== nextSrc) {
            innerImage2.dataset.skinSrc = nextSrc;
            hooks.isInnerImageLoaded = false;
            innerImage2.src = nextSrc;
          }
        }
        S.topPlayerSkin = skinId || "default";
      }
    } catch (error) {
      console.error("Ошибка обработки данных о топ-1 игроке:", error);
    }
  }
async function updateOnlineCount() {
  var _a, _b, _c;
  let rows = [];
  try {
    const res = await fetch(ONLINE_HUB_URL, {
      cache: "no-store"
    });
    if (!res.ok) return;
    const data = await res.json();
    rows = Array.isArray(data.servers) ? data.servers : [];
  } catch (_) {
    return;
  }
  
  let totalOnline = 0;
  for (const row of rows) {
    const id = row.id;
    if (!id) continue;
    const playing = (_a = row.playing) != null ? _a : 0;
    const observers = (_b = row.no_playing) != null ? _b : 0;
    const max = (_c = row.max) != null ? _c : 0;
    totalOnline += playing + observers;
    
    // Ищем элемент .server-item с нужным id
    const item = document.getElementById(id);
    if (item) {
      const spans = item.querySelectorAll(".online-count");
      if (spans.length >= 2) {
        spans[0].textContent = observers;
        spans[1].textContent = max > 0 ? `${playing}/${max}` : String(playing);
        
        // Обновляем цвет (зелёный/серый)
        spans.forEach(span => {
          const num = parseInt(span.textContent, 10);
          if (!isNaN(num)) {
            span.classList.remove('has-online', 'no-online');
            span.classList.add(num > 0 ? 'has-online' : 'no-online');
          }
        });
      }
    }
  }
  
  const onlineElement = document.getElementById("online");
  if (onlineElement) {
    onlineElement.textContent = `Онлайн: ${totalOnline}`;
  }
}
  function startOnlineCountPolling() {
    updateOnlineCount();
    if (!window.onlineInterval) {
      window.onlineInterval = setInterval(updateOnlineCount, 5e3);
    }
  }
  function stopOnlineCountPolling() {
    if (window.onlineInterval) {
      clearInterval(window.onlineInterval);
      window.onlineInterval = null;
    }
  }
  function calcUserScore2(S) {
    let score = 0;
    for (let i = 0; i < S.playerCells.length; i++) {
      score += S.playerCells[i].nSize * S.playerCells[i].nSize;
    }
    return score;
  }
  function updateStats2(S) {
    var _a;
    const currentScore = Math.floor(calcUserScore2(S) / 100);
    const cellCount = S.playerCells.length;
    if (currentScore > S.maxScore) {
      S.maxScore = currentScore;
      const elMax = document.getElementById("score-max");
      if (elMax) elMax.innerText = "Максимум: " + S.maxScore;
    }
    const elCurrent = document.getElementById("score-new");
    if (elCurrent) {
      const prevScore = parseInt(((_a = elCurrent.innerText.match(/\d+/)) == null ? void 0 : _a[0]) || "0", 10);
      if (currentScore !== prevScore) {
        elCurrent.innerText = "Сейчас: " + currentScore;
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
  function getShareMessage2(S) {
    const max = S.maxScore;
    const messages = max < 1e3 ? scoreMessages2.low : max < 1e4 ? scoreMessages2.mid : scoreMessages2.high;
    return messages[Math.floor(Math.random() * messages.length)];
  }
  function updateShareText2(S) {
    const el = document.getElementById("shareText");
    if (el) el.textContent = getShareMessage2(S);
  }
  function getStatsText2(S) {
    return `Моя статистика в Agar.su!\nМаксимальная масса: ${S.maxScore}\nВремя игры: ${Date.now()}`;
  }
  function shareStats2(S, platform) {
    const text = encodeURIComponent(getStatsText2(S));
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
    window.open(urls[platform] || "", "_blank", `width=${w},height=${h},top=${top},left=${left},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`);
  }
  async function refreshGlobalRatingHome(S, data) {
    const container = document.getElementById("topswindow");
    if (!container) return;
    const {map, obj} = await loadSkinListMap();
    applySkinListToState(S, {
      map,
      obj
    });
    container.innerHTML = "";
    const players = (data.players || []).slice(0, 3);
    const clans = (data.clans || []).slice(0, 3);
    function createRow(name, points, index, passId, isClan) {
      const medal = index === 0 ? "gold" : index === 1 ? "silver" : "bronze";
      const skinUrl = getSkinUrlForNick(map, name, "4");
      const pts = Number(points) || 0;
      const row = document.createElement("div");
      row.className = "rating-row " + medal + (passId ? " rating-row--link" : "");
      row.innerHTML = `<div>${index + 1}</div><div>${name || "—"}</div><div class="rating-pts">${pointsLabel(pts)}</div><div class="avatar" style="background-image: url('${skinUrl}');"></div>`;
      if (passId) {
        const profileBase = isClan ? STATS_CLAN_PROFILE_BASE : STATS_PROFILE_BASE;
        row.title = isClan ? "Профиль клана" : "Профиль";
        row.addEventListener("click", e => {
          e.stopPropagation();
          window.open(profileBase + encodeURIComponent(passId), "_blank");
        });
      }
      return row;
    }
    const playersTitle = document.createElement("div");
    playersTitle.className = "section-title";
    playersTitle.innerText = "Top players";
    container.appendChild(playersTitle);
    if (!players.length) {
      const empty = document.createElement("div");
      empty.className = "rating-row";
      empty.innerHTML = `<div></div><div>—</div><div class="rating-pts">0 очков</div><div class="avatar" style="background-image:url('https://api.agar.su/skins/4.png');"></div>`;
      container.appendChild(empty);
    } else {
      players.forEach((p, i) => container.appendChild(createRow(p.nick, p.points, i, p.id, false)));
    }
    const clansTitle = document.createElement("div");
    clansTitle.className = "section-title";
    clansTitle.innerText = "Top Clans";
    container.appendChild(clansTitle);
    if (!clans.length) {
      const empty = document.createElement("div");
      empty.className = "rating-row";
      empty.innerHTML = `<div></div><div>—</div><div class="rating-pts">0 очков</div><div class="avatar" style="background-image:url('https://api.agar.su/skins/4.png');"></div>`;
      container.appendChild(empty);
    } else {
      clans.forEach((c, i) => container.appendChild(createRow(c.clan, c.points, i, c.id, true)));
    }
  }
  function installGlobalRatingHome(S) {
    let loadGlobalRatingTimer = null;
    let lastGlobalRatingKey = "";
    const ratingHome = document.getElementById("ratinghome");
    const ratingHeader = ratingHome && ratingHome.querySelector(".rating-header");
    if (ratingHeader) {
      ratingHeader.addEventListener("click", () => window.open(STATS_PAGE_URL, "_blank"));
    }
    function loadGlobalRatingHome() {
      fetch(STATS_API + "/api/rankings?limit=3", {
        cache: "no-store"
      }).then(res => res.ok ? res.json() : Promise.reject()).then(data => {
        const key = JSON.stringify({
          p: data.players,
          c: data.clans,
          u: data.updatedAt
        });
        if (key === lastGlobalRatingKey) return;
        lastGlobalRatingKey = key;
        return refreshGlobalRatingHome(S, data);
      }).catch(e => console.error("Global rating load error:", e));
    }
    function scheduleLoadGlobalRatingHome() {
      clearTimeout(loadGlobalRatingTimer);
      loadGlobalRatingTimer = setTimeout(() => {
        loadGlobalRatingTimer = null;
        if (isOverlaysVisible()) loadGlobalRatingHome();
      }, 300);
    }
    if (isOverlaysVisible()) {
      loadGlobalRatingHome();
    }
    const overlayEl = document.getElementById("overlays");
    if (overlayEl) {
      const observer = new MutationObserver(() => scheduleLoadGlobalRatingHome());
      observer.observe(overlayEl, {
        attributes: true,
        attributeFilter: [ "style" ]
      });
    }
    setInterval(() => {
      if (isOverlaysVisible()) loadGlobalRatingHome();
    }, 3e5);
  }
  function setActiveFromHash(S) {
    const hash = location.hash.replace("#", "") || "ffa";
    const hashWithoutParams = hash.split("?")[0];
    document.querySelectorAll(".gamemode li").forEach(li => li.classList.remove("active"));
    const activeLi = document.getElementById(hashWithoutParams);
    const titleEl = document.getElementById("serverTitle");
    if (activeLi) {
      activeLi.classList.add("active");
      if (titleEl) titleEl.textContent = `Статистика ${hashWithoutParams}`;
      if (activeLi.dataset.ip) {
        S.SELECTED_SERVER = activeLi.dataset.ip;
      }
      if (typeof S.wHandle.chekstats === "function") {
        S.wHandle.chekstats();
      }
    }
  }
  function attachStats(S, hooks) {
    const wHandle = S.wHandle;
    setOverlaysLifecycleHooks({
      onShow: startOnlineCountPolling,
      onHide: stopOnlineCountPolling
    });
    
    if (isOverlaysVisible()) {
      startOnlineCountPolling();
    }
    wHandle.chekstats = async function() {
      try {
        const {obj} = await loadSkinListMap();
        applySkinListToState(S, {
          obj
        });
        const statsUrl = getPowApiBase(S.SELECTED_SERVER || S.CONNECTION_URL) + "/checkStats";
        const response = await fetch(statsUrl, {
          method: "GET"
        });
        if (!response.ok) {
          throw new Error(`Ошибка запроса: ${response.status}`);
        }
        const stat = await response.json();
        loadTopPlayerData2(S, stat, hooks);
        invalidateStatsRenderCaches(S);
        await fetchStats(S, stat);
      } catch (error) {
        console.error("Ошибка загрузки данных о топ-1 игроке:", error);
      }
    };
    wHandle.startGame = function() {
      let nickInput = document.getElementById("nick").value.trim();
      let passInput = document.getElementById("pass").value;
      const forbiddenRegex = new RegExp(FORBIDDEN_NICK_CHARS.join("|"), "g");
      nickInput = nickInput.replace(forbiddenRegex, "");
      nickInput = hooks.censorMessage(nickInput);
      if (nickInput.length > 16) nickInput = nickInput.substring(0, 16);
      if (passInput.length > 8) passInput = passInput.substring(0, 8);
      hooks.setNick(nickInput + "#" + passInput);
    };
    wHandle.coord = function() {
      if (S.canSendCoord) {
        if (S.lastCell) hooks.sendChat(S.lastCell);
        S.canSendCoord = false;
        setTimeout(function() {
          S.canSendCoord = true;
        }, 3e3);
      }
    };
    onReady(() => {
      installGlobalRatingHome(S);
      updateShareText2(S);
      [ "vk", "telegram", "whatsapp", "facebook", "twitter" ].forEach(p => {
        const btn = document.querySelector(`.${p}`);
        if (btn) btn.addEventListener("click", () => shareStats2(S, p));
      });
    });
    return {
      getLevel,
      getXp,
      getStarClass,
      createLevelIcon: (level, nick) => createLevelIcon(S, level, nick, hooks),
      updateStats: () => updateStats2(S),
      updateShareText: () => updateShareText2(S),
      fetchStats: stats => fetchStats(S, stats, hooks),
      displayStats: stats => displayStats(S, stats),
      calcUserScore: () => calcUserScore2(S)
    };
  }
  async function fetchNickPerksLists(S) {
    if (S.nickPerksLists) return S.nickPerksLists;
    try {
      const [passData, invisible, rotation, skin] = await Promise.all([ loadPassData(), loadInvisibleSet(), loadRotationSet(), loadSkinListMap() ]);
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
      console.error("Ошибка загрузки списков покупок:", e);
      S.nickPerksLists = {
        pass: new Set,
        invisible: new Set,
        rotation: new Set,
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
  function getSkinUrlForNick2(S, nickname) {
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
    return !!(skinMap[clean] || skinMap[`[${clean}]`] || getSkinUrlForNick2(S, clean));
  }
  function getNickPerks(S, nickname, password, lists) {
    const pass = String(password != null ? password : "").trim();
    return {
      hasSkinPass: nickInPublicSet(lists.pass, nickname) || !!pass,
      hasSkin: nickHasPurchasedSkin(S, nickname, lists.skinMap),
      invisible: nickInPublicSet(lists.invisible, nickname),
      rotation: nickInPublicSet(lists.rotation, nickname)
    };
  }
  function makePerkBadge(label, active, hoverText, onBuy) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nick-perk" + (active ? " nick-perk--on" : "");
    const text = document.createElement("span");
    text.className = "nick-perk-label";
    text.textContent = label;
    btn.appendChild(text);
    if (hoverText && onBuy) {
      btn.classList.add("nick-perk--action");
      btn.setAttribute("aria-label", hoverText);
      let leaveTimer = null;
      const showHover = () => {
        if (leaveTimer) {
          clearTimeout(leaveTimer);
          leaveTimer = null;
        }
        if (btn.classList.contains("is-hover")) return;
        btn.style.minWidth = `${btn.offsetWidth}px`;
        text.textContent = hoverText;
        btn.classList.add("is-hover");
      };
      const showDefault = () => {
        text.textContent = label;
        btn.classList.remove("is-hover");
        btn.style.minWidth = "";
      };
      btn.addEventListener("pointerenter", showHover);
      btn.addEventListener("pointerleave", () => {
        if (leaveTimer) clearTimeout(leaveTimer);
        leaveTimer = setTimeout(() => {
          leaveTimer = null;
          showDefault();
        }, 30);
      });
      btn.addEventListener("focus", showHover);
      btn.addEventListener("blur", showDefault);
      btn.addEventListener("click", e => {
        e.stopPropagation();
        onBuy();
      });
    } else if (active) {
      btn.title = "Куплено";
      btn.tabIndex = -1;
    } else {
      btn.tabIndex = -1;
    }
    return btn;
  }
  function openShopForNick(nickPart, hasClan, options) {
    if (typeof window.openShopPurchase === "function") {
      window.openShopPurchase(nickPart, {
        clan: hasClan,
        ...options
      });
    } else if (typeof showContent === "function") {
      showContent("shop");
    }
  }
  function parseFullNick(full) {
    const str = String(full || "").trim();
    const [nickPart, pass = ""] = str.split("#", 2);
    const hasClan = /\[[^\]]+\]/.test(nickPart);
    const cleanNick = nickPart.replace(/\[|\]/g, "").trim();
    return {
      str,
      nickPart,
      pass: pass.trim(),
      hasClan,
      cleanNick
    };
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
    const {str, nickPart, pass, hasClan, cleanNick} = parseFullNick(fullNick);
    const label = hasClan ? nickPart : nickPart || "?";
    const p = perks || {
      hasSkinPass: false,
      hasSkin: false,
      invisible: false,
      rotation: false
    };
    const li = document.createElement("li");
    li.className = "nick-card";
    const skinUrl = getSkinUrlForNick2(S, cleanNick);
    const avatar = skinUrl ? Object.assign(document.createElement("img"), {
      className: "skin",
      src: skinUrl,
      loading: "lazy"
    }) : Object.assign(document.createElement("div"), {
      className: "skin skin--empty",
      textContent: label.charAt(0).toUpperCase()
    });
    const body = document.createElement("div");
    body.className = "nick-card-body";
    const name = document.createElement("div");
    name.className = "nick";
    name.textContent = label;
    name.onclick = () => {
      try {
        if (typeof hooks.setNick === "function") hooks.setNick(str);
      } catch (e) {}
      document.getElementById("nick").value = nickPart;
      document.getElementById("pass").value = pass;
      setCookie("userPass", pass, 7);
      document.getElementById("pass").style.display = pass ? "block" : "none";
      if (typeof hooks.selectSkin === "function") hooks.selectSkin(nickPart);
    };
    const perksRow = document.createElement("div");
    perksRow.className = "nick-perks";
    const shop = opts => () => openShopForNick(nickPart, hasClan, opts);
    perksRow.append(makePerkBadge("Пароль", p.hasSkinPass, p.hasSkinPass ? "Сменить" : "Купить", shop({
      focusPassword: true
    })), makePerkBadge("Скин", p.hasSkin, p.hasSkin ? "Сменить" : "Купить", shop({
      focusSkin: true
    })), makePerkBadge("Невидимый", p.invisible, p.invisible ? null : "Купить", p.invisible ? null : shop({
      invisible: true
    })), makePerkBadge("Поворот", p.rotation, p.rotation ? null : "Купить", p.rotation ? null : shop({
      rotation: true
    })));
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
      if (Array.isArray(data == null ? void 0 : data.nicknames) && data.nicknames.length) {
        data.nicknames.forEach(row => {
          var _a;
          const full = String(row.nickname || "");
          const pass = ((_a = row.password) != null ? _a : "").trim();
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
          li.textContent = "Вы не покупали ники";
          nickList.appendChild(li);
        }
        if (clanList) {
          const li = document.createElement("li");
          li.className = "empty";
          li.textContent = "Вы не покупали кланы";
          clanList.appendChild(li);
        }
      }
      if (badgeNick) badgeNick.textContent = String(nickCount);
      if (badgeClan) badgeClan.textContent = String(clanCount);
      if (block) block.style.display = "";
      hooks.wireTabsOnce();
      hooks.showNickClanTab("nicks");
    } catch (e) {
      console.error("Ошибка загрузки ников:", e);
      if (block) block.style.display = "";
      if (nickList && !nickList.children.length) {
        const li = document.createElement("li");
        li.className = "error";
        li.textContent = "Не удалось загрузить никнеймы";
        nickList.appendChild(li);
      }
    }
  }
  var GOOGLE_RESTORE_CLIENT_ID = "157257230972-4vh698jtf46c76sc7607oe1k9tr782je.apps.googleusercontent.com";
  var RESTORED_AT_KEY = "accountRestoredAt";
  function isTruthyRestoreValue(value) {
    return value !== null && value !== void 0 && value !== "" && value !== false && value !== 0 && value !== "0" && value !== "false";
  }
  function getRestoreTimestamp(accountData) {
    const candidates = [ accountData == null ? void 0 : accountData.restored_at, accountData == null ? void 0 : accountData.restoredAt, accountData == null ? void 0 : accountData.restore_at, (accountData == null ? void 0 : accountData.is_restored) === true ? (accountData == null ? void 0 : accountData.restored_at) || Date.now() : null, (accountData == null ? void 0 : accountData.restored) === true ? (accountData == null ? void 0 : accountData.restored_at) || Date.now() : null ];
    for (const value of candidates) {
      if (isTruthyRestoreValue(value)) return value;
    }
    try {
      const cached = localStorage.getItem(RESTORED_AT_KEY);
      return isTruthyRestoreValue(cached) ? cached : null;
    } catch (e) {
      return null;
    }
  }
  function persistRestoreTimestamp(value) {
    if (!isTruthyRestoreValue(value)) return;
    try {
      localStorage.setItem(RESTORED_AT_KEY, String(value));
    } catch (e) {}
  }
  function clearRestoreTimestamp() {
    try {
      localStorage.removeItem(RESTORED_AT_KEY);
    } catch (e) {}
  }
  function formatRestoreDate(value) {
    if (!isTruthyRestoreValue(value)) return "";
    const num = Number(value);
    const date = !Number.isNaN(num) && num > 0 ? new Date(num < 1e12 ? num * 1e3 : num) : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("ru-RU");
  }
  function updateRestoreBlockVisibility(S) {
    const block = document.getElementById("restoreProgressBlock");
    const available = document.getElementById("restoreAvailableBlock");
    const done = document.getElementById("restoreDoneBlock");
    const badge = document.getElementById("restoreStateBadge");
    if (!block) return;
    const restoredAt = getRestoreTimestamp(S.accountData);
    const restored = restoredAt != null;
    if (badge) {
      const dateLabel = formatRestoreDate(restoredAt);
      badge.textContent = restored ? dateLabel ? `Восстановлен ${dateLabel}` : "Восстановлен" : "Не восстановлен";
      badge.className = "restore-state-badge" + (restored ? " restore-state-badge--done" : "");
    }
    if (available) available.style.display = restored ? "none" : "";
    if (done) {
      done.style.display = restored ? "" : "none";
      if (restored) {
        const dateLabel = formatRestoreDate(restoredAt);
        done.textContent = dateLabel ? `Этот аккаунт уже был восстановлен ${dateLabel}. Повторное восстановление не требуется.` : "Этот аккаунт уже был восстановлен. Повторное восстановление не требуется.";
      }
    }
    block.style.display = "";
  }
  function showNickClanTab(S, which) {
    const tabN = document.getElementById("tabNicknames");
    const tabC = document.getElementById("tabClans");
    const tabS = document.getElementById("tabSettings");
    const nick = document.getElementById("nickWrap");
    const clan = document.getElementById("clanWrap");
    const settings = document.getElementById("settingsWrap");
    if (!tabN || !tabC || !tabS || !nick || !clan || !settings) return;
    tabN.classList.toggle("active", which === "nicks");
    tabC.classList.toggle("active", which === "clans");
    tabS.classList.toggle("active", which === "settings");
    nick.style.display = which === "nicks" ? "" : "none";
    clan.style.display = which === "clans" ? "" : "none";
    settings.style.display = which === "settings" ? "" : "none";
    updateRestoreBlockVisibility(S);
  }
  function wireTabsOnce(S) {
    const wrap = document.getElementById("myNickClanTabs");
    const tabN = document.getElementById("tabNicknames");
    const tabC = document.getElementById("tabClans");
    const tabS = document.getElementById("tabSettings");
    if (!wrap || !tabN || !tabC || !tabS || wrap.dataset.wired) return;
    tabN.onclick = () => showNickClanTab(S, "nicks");
    tabC.onclick = () => showNickClanTab(S, "clans");
    tabS.onclick = () => showNickClanTab(S, "settings");
    wrap.dataset.wired = "1";
  }
  function hideAuthButtons() {
    const vk = document.getElementById("vkAuthContainer");
    if (vk) vk.style.display = "none";
  }
  function showAuthButtons() {
    const vk = document.getElementById("vkAuthContainer");
    if (vk) vk.style.display = "flex";
  }
  function setRestoreStatus(text, type = "info") {
    const el = document.getElementById("restoreStatus");
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
    el.className = "restore-status" + (type ? ` restore-status--${type}` : "");
  }
  function attachAccountHooks(S, hooks) {
    const wHandle = S.wHandle;
    let restoreGoogleInitialized = false;
    const accountApiGet = (tag, method = "GET", body = null) => {
      const headers = {
        Authorization: `Game ${getAccountToken() || ""}`
      };
      if (body) headers["Content-Type"] = "application/json";
      return fetch("https://api.agar.su/api/" + tag, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
      });
    };
    const displayAccountData = () => {
      if (!S.accountData) return;
      updateRestoreBlockVisibility(S);
      const currLevel = getLevel(S.accountData.xp);
      const nextXp = getXp(currLevel + 1);
      const progressPercent = S.accountData.xp / nextXp * 100;
      const progressBar = document.querySelector(".progress-fill");
      if (progressBar) progressBar.style.width = `${progressPercent}%`;
      const levelCircle = document.getElementById("levelCircle");
      if (levelCircle) levelCircle.textContent = currLevel;
      const progressText = document.getElementById("progressText");
      if (progressText) progressText.textContent = `${Math.round(progressPercent)}% (${S.accountData.xp}/${nextXp})`;
      const accountIDElement = document.getElementById("accountID");
      if (accountIDElement) accountIDElement.textContent = `ID: ${S.accountData.uid}`;
    };
    const nickHooks = {
      accountApiGet,
      clearAccountToken,
      onLogout: () => onLogout(),
      setNick: hooks.setNick,
      selectSkin: hooks.selectSkin,
      wireTabsOnce: () => wireTabsOnce(S),
      showNickClanTab: which => showNickClanTab(S, which)
    };
    const setAccountData = data => {
      S.accountData = data;
      persistRestoreTimestamp(getRestoreTimestamp(data));
      displayAccountData();
      loadMyNicknames(S, nickHooks);
      if (typeof window.updateAccountMenuLabel === "function") {
        window.updateAccountMenuLabel();
      }
      const logoutBtn = document.getElementById("logoutButton");
      const authlogEl = document.getElementById("authlog");
      if (logoutBtn) logoutBtn.style.display = "";
      if (authlogEl) authlogEl.style.display = "none";
      hideAuthButtons();
    };
    const onLogout = () => {
      S.accountData = null;
      localStorage.removeItem("accountData");
      clearAccountToken();
      clearRestoreTimestamp();
      const block = document.getElementById("myNicknamesBlock");
      if (block) block.style.display = "none";
      const restorePanel = document.getElementById("restorePanel");
      const restoreToggle = document.getElementById("restoreToggle");
      const settingsWrap = document.getElementById("settingsWrap");
      if (restorePanel) restorePanel.hidden = true;
      if (restoreToggle) restoreToggle.setAttribute("aria-expanded", "false");
      if (settingsWrap) settingsWrap.style.display = "none";
      setRestoreStatus("");
      const nickList = document.getElementById("myNickList");
      const clanList = document.getElementById("myClanList");
      const badgeNick = document.getElementById("badgeNick");
      const badgeClan = document.getElementById("badgeClan");
      if (nickList) nickList.innerHTML = "";
      if (clanList) clanList.innerHTML = "";
      if (badgeNick) badgeNick.textContent = "0";
      if (badgeClan) badgeClan.textContent = "0";
      const progressBar = document.querySelector(".progress-fill");
      if (progressBar) progressBar.style.width = "0%";
      const levelCircle = document.getElementById("levelCircle");
      if (levelCircle) levelCircle.textContent = "0";
      const progressText = document.getElementById("progressText");
      if (progressText) progressText.textContent = "0% (0/0)";
      const accountIDElement = document.getElementById("accountID");
      if (accountIDElement) accountIDElement.textContent = "ID: 0000";
      const authlogEl = document.getElementById("authlog");
      if (authlogEl) authlogEl.style.display = "flex";
      const logoutBtn = document.getElementById("logoutButton");
      if (logoutBtn) logoutBtn.style.display = "none";
      showAuthButtons();
      if (typeof window.updateAccountMenuLabel === "function") {
        window.updateAccountMenuLabel();
      }
    };
    const loadAccountUserData = async () => {
      const res = await accountApiGet("me/login");
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          if (401 == data.status) clearAccountToken(); else alert(data.error);
        } else setAccountData(data);
      }
    };
    async function handleLogin(tokenOrUser, provider) {
      if (provider !== "vk") return;
      let res;
      try {
        res = await fetch("https://api.agar.su/api/auth/vk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(tokenOrUser)
        });
      } catch (e) {
        return alert("Ошибка сети при авторизации");
      }
      let data;
      try {
        data = await res.json();
      } catch (e) {
        return alert("Ошибка ответа сервера авторизации");
      }
      if (data.error || !data.token) return alert(data.error || "Ошибка авторизации");
      wHandle.onAccountLoggedIn(data.token);
    }
    wHandle.onVkAuth = function(payload) {
      if (!payload || !payload.code || !payload.device_id) {
        return alert("VK: не получен код авторизации");
      }
      handleLogin(payload, "vk");
    };
    const handleRestoreResponse = async res => {
      let data;
      try {
        data = await res.json();
      } catch (e) {
        setRestoreStatus("Ошибка ответа сервера", "error");
        return;
      }
      if (!res.ok || data.error) {
        setRestoreStatus(data.error || "Не удалось восстановить прогресс", "error");
        return;
      }
      setRestoreStatus(data.message || "Аккаунт привязан к VK", "success");
      const restoredAt = data.restored_at || data.restoredAt || Date.now();
      persistRestoreTimestamp(restoredAt);
      if (S.accountData) S.accountData.restored_at = restoredAt;
      if (data.token) {
        setAccountToken(data.token);
        if (typeof window.updateAccountMenuLabel === "function") {
          window.updateAccountMenuLabel();
        }
        hooks.sendAccountToken();
      }
      await loadAccountUserData();
      updateRestoreBlockVisibility(S);
    };
    async function restoreProgressFromTelegram(user) {
      if (!getAccountToken()) {
        return alert("Сначала войдите через VK");
      }
      setRestoreStatus("Привязываем аккаунт…", "info");
      try {
        const res = await accountApiGet("me/restore/telegram", "POST", user);
        await handleRestoreResponse(res);
      } catch (e) {
        setRestoreStatus("Ошибка сети", "error");
      }
    }
    async function restoreProgressFromGoogle(credential) {
      if (!getAccountToken()) {
        return alert("Сначала войдите через VK");
      }
      setRestoreStatus("Привязываем аккаунт…", "info");
      try {
        const res = await accountApiGet("me/restore/google", "POST", {
          credential
        });
        await handleRestoreResponse(res);
      } catch (e) {
        setRestoreStatus("Ошибка сети", "error");
      }
    }
    wHandle.onRestoreGoogleAuth = function(response) {
      if (response == null ? void 0 : response.credential) restoreProgressFromGoogle(response.credential);
    };
    function loadGoogleRestoreScript() {
      return new Promise((resolve, reject) => {
        var _a, _b;
        if ((_b = (_a = window.google) == null ? void 0 : _a.accounts) == null ? void 0 : _b.id) return resolve();
        const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
        if (existing) {
          existing.addEventListener("load", () => resolve(), {
            once: true
          });
          existing.addEventListener("error", () => reject(new Error("Google script failed")), {
            once: true
          });
          return;
        }
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Google script failed"));
        document.head.appendChild(script);
      });
    }
    async function initRestoreGoogleButton() {
      const container = document.getElementById("restoreGoogleContainer");
      if (!container || restoreGoogleInitialized) return;
      try {
        await loadGoogleRestoreScript();
        window.google.accounts.id.initialize({
          client_id: GOOGLE_RESTORE_CLIENT_ID,
          callback: wHandle.onRestoreGoogleAuth
        });
        window.google.accounts.id.renderButton(container, {
          type: "standard",
          size: "medium",
          theme: "outline",
          text: "continue_with",
          shape: "rectangular"
        });
        restoreGoogleInitialized = true;
      } catch (e) {
        setRestoreStatus("Не удалось загрузить Google", "error");
      }
    }
    function wireRestoreProgressUI() {
      const toggle = document.getElementById("restoreToggle");
      const panel = document.getElementById("restorePanel");
      const tgBtn = document.getElementById("restoreTelegramBtn");
      if (!toggle || !panel || toggle.dataset.wired) return;
      toggle.dataset.wired = "1";
      toggle.addEventListener("click", () => {
        const open = panel.hidden;
        panel.hidden = !open;
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) initRestoreGoogleButton();
      });
      if (tgBtn) {
        tgBtn.addEventListener("click", () => {
          window._telegramRestoreMode = true;
          window.open("https://agar.su/telegram/", "tgRestore", "width=400,height=200");
        });
      }
    }
    window.addEventListener("message", function(event) {
      if (event.origin !== "https://agar.su") return;
      if (event.data.type === "telegram-auth" && window._telegramRestoreMode) {
        window._telegramRestoreMode = false;
        restoreProgressFromTelegram(event.data.user);
      }
    });
    function initRestoreProgressUI() {
      wireRestoreProgressUI();
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initRestoreProgressUI);
    } else {
      initRestoreProgressUI();
    }
    wHandle.onAccountLoggedIn = token => {
      setAccountToken(token);
      if (typeof window.updateAccountMenuLabel === "function") {
        window.updateAccountMenuLabel();
      }
      loadAccountUserData();
      loadMyNicknames(S, nickHooks);
      hooks.sendAccountToken();
    };
    wHandle.logoutAccount = async () => {
      if (getAccountToken()) {
        const res = await accountApiGet("me/logout");
        if (res.ok) {
          const data = await res.json();
          if (data.ok || 401 == data.status) onLogout();
          if (data.error) alert(data.error);
        }
      } else onLogout();
    };
    wHandle.onUpdateXp = xp => {
      if (S.accountData) {
        S.accountData.xp = xp;
        displayAccountData();
      }
    };
    if (getAccountToken()) loadAccountUserData();
    if (typeof window.updateAccountMenuLabel === "function") {
      window.updateAccountMenuLabel();
    }
    return {
      displayAccountData,
      loadAccountUserData,
      onLogout,
      updateRestoreBlockVisibility: () => updateRestoreBlockVisibility(S),
      showNickClanTab: which => showNickClanTab(S, which),
      wireTabsOnce: () => wireTabsOnce(S)
    };
  }
  function normalize(text) {
    return String(text || "").toLowerCase().replace(/ё/g, "е").replace(/Ё/g, "е");
  }
  function cleanEntry(raw) {
    let s = normalize(raw).trim();
    if (!s) return "";
    if (/\s/.test(s)) {
      return s.replace(/[^a-zа-я0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
    }
    return s.replace(/[^a-zа-я0-9]+/g, "");
  }
  function compileDictionary(rawSet) {
    const words = new Set;
    const phrases = [];
    const seenPhrase = new Set;
    for (const raw of rawSet) {
      const key = cleanEntry(raw);
      if (key.length < 2) continue;
      if (key.includes(" ")) {
        if (seenPhrase.has(key)) continue;
        seenPhrase.add(key);
        phrases.push(key);
      } else {
        words.add(key);
      }
    }
    phrases.sort((a, b) => b.length - a.length);
    return {
      words,
      phrases
    };
  }
  function getDict(badWordsSet) {
    let dict = badWordsSet._antimatDict;
    if (!dict || dict.from !== badWordsSet) {
      dict = compileDictionary(badWordsSet);
      dict.from = badWordsSet;
      try {
        badWordsSet._antimatDict = dict;
      } catch (e) {}
    }
    return dict;
  }
  var TOKEN_RE = /[a-zа-я0-9]+/g;
  function collectHits(norm, dict) {
    const hits = [];
    const used = new Uint8Array(norm.length);
    const mark = (start, end) => {
      if (end <= start) return false;
      for (let i = start; i < end; i++) {
        if (used[i]) return false;
      }
      for (let i = start; i < end; i++) used[i] = 1;
      hits.push({
        start,
        end
      });
      return true;
    };
    for (const phrase of dict.phrases) {
      let from = 0;
      while (from <= norm.length - phrase.length) {
        const idx = norm.indexOf(phrase, from);
        if (idx === -1) break;
        mark(idx, idx + phrase.length);
        from = idx + phrase.length;
      }
    }
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(norm)) !== null) {
      const token = m[0];
      if (dict.words.has(token)) {
        mark(m.index, m.index + token.length);
      }
    }
    hits.sort((a, b) => a.start - b.start);
    return hits;
  }
  function censorText(badWordsSet, message) {
    if (!badWordsSet || badWordsSet.size === 0) return message;
    const text = String(message || "");
    if (!text) return text;
    const dict = getDict(badWordsSet);
    const norm = normalize(text);
    if (!norm) return text;
    const hits = collectHits(norm, dict);
    if (!hits.length) return text;
    const chars = Array.from(text);
    const normChars = Array.from(norm);
    if (chars.length !== normChars.length) {
      let out = text;
      for (const phrase of dict.phrases) {
        const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        out = out.replace(re, "***");
      }
      out = out.replace(TOKEN_RE, tok => dict.words.has(normalize(tok)) ? "***" : tok);
      return out;
    }
    let result = "";
    let cursor = 0;
    for (const hit of hits) {
      if (hit.start < cursor) continue;
      result += chars.slice(cursor, hit.start).join("");
      result += "***";
      cursor = hit.end;
    }
    result += chars.slice(cursor).join("");
    return result;
  }
  function countHits(badWordsSet, message) {
    if (!badWordsSet || badWordsSet.size === 0) return 0;
    const text = String(message || "");
    if (!text) return 0;
    return collectHits(normalize(text), getDict(badWordsSet)).length;
  }
  function attachSmoothScroll(el, opts = {}) {
    var _a;
    if (!el) return null;
    if (el._smoothScroll) return el._smoothScroll;
    const ease = (_a = opts.ease) != null ? _a : .22;
    const state = {
      target: el.scrollTop,
      raf: 0
    };
    const maxScroll = () => Math.max(0, el.scrollHeight - el.clientHeight);
    const tick = () => {
      const cur = el.scrollTop;
      const capped = Math.max(0, Math.min(maxScroll(), state.target));
      state.target = capped;
      const diff = capped - cur;
      if (Math.abs(diff) < .5) {
        el.scrollTop = capped;
        state.raf = 0;
        return;
      }
      el.scrollTop = cur + diff * ease;
      state.raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!state.raf) state.raf = requestAnimationFrame(tick);
    };
    const api = {
      by(delta) {
        const base = state.raf ? state.target : el.scrollTop;
        state.target = Math.max(0, Math.min(maxScroll(), base + delta));
        start();
      },
      to(top) {
        state.target = Math.max(0, Math.min(maxScroll(), top));
        start();
      },
      toEnd() {
        state.target = maxScroll();
        start();
      },
      syncFromDom() {
        if (!state.raf) state.target = el.scrollTop;
      },
      stop() {
        if (state.raf) cancelAnimationFrame(state.raf);
        state.raf = 0;
        state.target = el.scrollTop;
      }
    };
    el._smoothScroll = api;
    el.addEventListener("scroll", () => {
      if (!state.raf) state.target = el.scrollTop;
    }, {
      passive: true
    });
    return api;
  }
  var DONATORS = [ "bambule", "☼k☼" ];
  var ADMINS = [ "нико", "banshee" ];
  var YOUTUBERS = [ "salruz", "morcov", "sealand" ];
  var URL_YOUTUBERS = [ "https://youtube.com/@SalRuzO", "https://www.youtube.com/@MORCCVA", "https://www.youtube.com/@sealandv" ];
  function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
  function censorMessage(S, message) {
    if (S.showAdultContent) return message;
    if (!S.badWordsSet || S.badWordsSet.size === 0) {
      console.warn("Список матерных слов не загружен. Антимат не работает.");
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
    let data = S.profanityCountByPlayer.get(pId) || {
      count: 0,
      lastTime: now
    };
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
    return text.replace(/@((?:[^\s@]|\u00A0)+)/g, '<span class="mention">@$1</span>');
  }
  function replaceEmojis(text) {
    const gifEmojis = [ 50, 253, 26 ];
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
    S.dialogs[dialogId] = {
      div: dialogDiv,
      avatar: avatarContainer
    };
    S.dialogMessages[dialogId] = [];
  }
  function switchToDialog(S, dialogId) {
    document.getElementById("chatX_feed").style.display = "none";
    Object.values(S.dialogs).forEach(d => {
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
    box.innerHTML = `<h3>Позвать ${targetName} на PvP</h3>\n                     <p>Выберите сервер:</p>`;
    const servers = [ {
      name: "FFA 1vs1",
      address: "ffa.agar.su:6004"
    }, {
      name: "MS 2vs2",
      address: "ffa.agar.su:6005"
    }, {
      name: "Tournament",
      address: "ffa.agar.su:6006"
    } ];
    servers.forEach(server => {
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
    cancelBtn.textContent = "Отмена";
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
    box.innerHTML = `<h3>${playerName} приглашает на PvP</h3>`;
    const acceptBtn = document.createElement("button");
    acceptBtn.textContent = "Принять";
    acceptBtn.onclick = () => {
      sendPvPInvite(S, hooks, playerId, server, true);
      hooks.setserver(server);
      modal.remove();
    };
    box.appendChild(acceptBtn);
    const rejectBtn = document.createElement("button");
    rejectBtn.textContent = "Отказать";
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
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }
  var chatScrollLockUntil = 0;
  function scrollChatToLatest(targetDiv) {
    const el = targetDiv || document.getElementById("chatX_feed");
    if (!el) return;
    const go = () => {
      chatScrollLockUntil = performance.now() + 480;
      const scroller = attachSmoothScroll(el);
      scroller.toEnd();
    };
    requestAnimationFrame(go);
  }
  function bindChatScrollTracking(S) {
    var _a;
    if (S.chatScrollBound) return;
    S.chatScrollBound = true;
    S.chatStickToBottom = true;
    const feed = document.getElementById("chatX_feed");
    if (feed) attachSmoothScroll(feed);
    const onScroll = el => {
      if (!el) return;
      if (performance.now() < chatScrollLockUntil) {
        S.chatStickToBottom = true;
        return;
      }
      S.chatStickToBottom = isScrollNearBottom(el);
    };
    feed == null ? void 0 : feed.addEventListener("scroll", e => onScroll(e.currentTarget), {
      passive: true
    });
    (_a = document.getElementById("chatX_container")) == null ? void 0 : _a.addEventListener("scroll", e => {
      var _a2;
      const t = e.target;
      if (t && ((_a2 = t.classList) == null ? void 0 : _a2.contains("chatX_feed"))) onScroll(t);
    }, {
      passive: true,
      capture: true
    });
  }
  function renderChatMessage(S, hooks, lastMessage, msgIndex) {
    var _a, _b;
    if (!lastMessage) return;
    if (lastMessage.message && lastMessage.message.toLowerCase().includes("вoшёл в игру")) {
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
      targetDiv = (_a = S.dialogs[`!ls${privateMatch[1]}`]) == null ? void 0 : _a.div;
    }
    if (!targetDiv) targetDiv = document.getElementById("chatX_feed");
    if (targetDiv == null ? void 0 : targetDiv.querySelector(`[data-chat-idx="${msgIndex}"]`)) return;
    const msgDiv = document.createElement("div");
    msgDiv.setAttribute("data-id", lastMessage.pId);
    msgDiv.dataset.chatIdx = String(msgIndex);
    const lowerName = lastMessage.name.toLowerCase();
    if (ADMINS.some(admin => admin.toLowerCase() === lowerName)) {
    msgDiv.style.backgroundColor = "#FF0000";
}
    if (DONATORS.includes(lowerName)) msgDiv.className = "chatX_msg " + lowerName; else msgDiv.className = "chatX_msg";
    const normalizedName = normalizeNick(lastMessage.name || "");
    let targetDialogId = null;
    let messageContent = messageRaw;
    if (privateMatch) {
      const number = privateMatch[1];
      messageContent = privateMatch[2];
      if (!messageContent.startsWith("PvPInvite;")) {
        targetDialogId = `!ls${number}`;
        createDialog(S, hooks, number, lastMessage.name, S.skinList[normalizedName] ? `https://api.agar.su/skins/${S.skinList[normalizedName]}.png` : "https://api.agar.su/skins/4.png");
        targetDiv = ((_b = S.dialogs[targetDialogId]) == null ? void 0 : _b.div) || targetDiv;
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
      ytLink.title = "YouTube канал";
      nameContainer.appendChild(ytLink);
    }
    if (DONATORS.includes(lowerName)) {
      const donateIcon = document.createElement("div");
      donateIcon.title = "Данный игрок является спонсором Agar.su";
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
      nameDiv.title = "Личное сообщение";
    } else {
      nameDiv.style.color = lastMessage.color || "#b8c0cc";
      avatar.style.border = `2px solid ${lastMessage.color}`;
      avatar.style.background = `${lastMessage.color}`;
      nameDiv.title = DONATORS.includes(lowerName) ? `${lastMessage.pId} (Донатер)` : `${lastMessage.pId || 0}`;
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
      msgDiv.title = "Скрыто из-за токсичности. Нажмите, чтобы показать.";
      textDiv.style.cursor = "pointer";
      textDiv.title = "Нажмите, чтобы показать сообщение";
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
    msgDiv.addEventListener("contextmenu", e => {
      e.preventDefault();
      document.querySelectorAll(".chat-context-menu").forEach(m => m.remove());
      const menu = document.createElement("div");
      menu.className = "chat-context-menu";
      menu.style.top = e.clientY + "px";
      menu.style.left = e.clientX + "px";
      const playerId = lastMessage.pId;
      const pmBtn = document.createElement("div");
      pmBtn.textContent = "Личное сообщение";
      pmBtn.style.cursor = "pointer";
      pmBtn.onclick = () => {
        createDialog(S, hooks, playerId, lastMessage.name, S.skinList[normalizeNick(lastMessage.name)] ? `https://api.agar.su/skins/${S.skinList[normalizeNick(lastMessage.name)]}.png` : "https://api.agar.su/skins/4.png");
        switchToDialog(S, `!ls${playerId}`);
        menu.remove();
      };
      const ignoreBtn = document.createElement("div");
      ignoreBtn.textContent = "Игнорировать";
      ignoreBtn.style.cursor = "pointer";
      ignoreBtn.onclick = () => {
        S.ignoredPlayers.add(playerId);
        msgDiv.remove();
        menu.remove();
      };
      const clearIgnoreBtn = document.createElement("div");
      clearIgnoreBtn.textContent = "Удалить всех из игнора";
      clearIgnoreBtn.style.cursor = "pointer";
      clearIgnoreBtn.onclick = () => {
        S.ignoredPlayers.clear();
        menu.remove();
      };
      const delMsgBtn = document.createElement("div");
      delMsgBtn.textContent = "Удалить сообщение";
      delMsgBtn.style.cursor = "pointer";
      delMsgBtn.onclick = () => {
        msgDiv.remove();
        menu.remove();
      };
      const delAllBtn = document.createElement("div");
      delAllBtn.textContent = "Удалить все сообщения игрока";
      delAllBtn.style.cursor = "pointer";
      delAllBtn.onclick = () => {
        [ ...targetDiv.children ].forEach(c => {
          var _a2;
          if ((_a2 = c.querySelector(".chatX_nick")) == null ? void 0 : _a2.title.includes(playerId)) c.remove();
        });
        menu.remove();
      };
      const pvpBtn = document.createElement("div");
      pvpBtn.textContent = "Позвать на PvP";
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
      const closeMenu = event => {
        if (!menu.contains(event.target)) menu.remove();
      };
      document.addEventListener("click", closeMenu, {
        once: true
      });
    });
    targetDiv.appendChild(msgDiv);
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
    const stickToBottom = targetDialogId ? true : S.chatStickToBottom !== false;
    if (stickToBottom) {
      S.chatStickToBottom = true;
      scrollChatToLatest(targetDiv);
      const avatarImg = msgDiv.querySelector("img.chatX_avatar");
      if (avatarImg && !avatarImg.complete) {
        avatarImg.addEventListener("load", () => {
          scrollChatToLatest(targetDiv);
        }, {
          once: true
        });
      }
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
      time: formatTime(new Date)
    });
    drawChatBoard(S, hooks);
    return offset;
  }
  function attachChat(S, hooks) {
    var _a, _b;
    S.donators = DONATORS;
    S.youtubers = YOUTUBERS;
    S.url_youtubers = URL_YOUTUBERS;
    S.passUsers = S.passUsers || [];
    S.passPlayerNickToId = S.passPlayerNickToId || new Map;
    S.passClanNickToId = S.passClanNickToId || new Map;
    S.ignoredPlayers = S.ignoredPlayers || new Set;
    S.activeDialog = S.activeDialog || null;
    S.dialogs = S.dialogs || {};
    S.dialogMessages = S.dialogMessages || {};
    S.profanityCountByPlayer = S.profanityCountByPlayer || new Map;
    S.maxGlobalMessages = (_a = S.maxGlobalMessages) != null ? _a : 50;
    S.maxDialogMessages = (_b = S.maxDialogMessages) != null ? _b : 100;
    if (typeof S.chatRenderedCount !== "number") S.chatRenderedCount = 0;
    bindChatScrollTracking(S);
    S.wHandle.switchToDialog = dialogId => switchToDialog(S, dialogId);
    const chatHooks = {
      ...hooks,
      sendChat: hooks.sendChat,
      setserver: hooks.setserver
    };
    return {
      addChat: (view, offset) => addChat(S, chatHooks, view, offset),
      drawChatBoard: () => drawChatBoard(S, chatHooks),
      censorMessage: msg => censorMessage(S, msg),
      switchToDialog: dialogId => switchToDialog(S, dialogId)
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
  var CUSTOM_BG_STORAGE_MAX = 9e5;
  function loadBgImageFromDataUrl(dataUrl, onReady2) {
    if (!dataUrl) {
      onReady2(null);
      return;
    }
    const img = new Image;
    img.onload = () => onReady2(img);
    img.onerror = () => onReady2(null);
    img.src = dataUrl;
  }
  function saveBgImageToStorage(key, dataUrl) {
    if (!dataUrl) {
      localStorage.removeItem(key);
      return true;
    }
    if (dataUrl.length > CUSTOM_BG_STORAGE_MAX) return false;
    try {
      localStorage.setItem(key, dataUrl);
      return true;
    } catch (e) {
      return false;
    }
  }
  function drawCustomMapBackground2(S, ctx) {
    if (!S.customMapBgEnabled || !S.mapBgImage || !S.mapBgImage.complete || !S.mapBgImage.width) return;
    const left = S.leftPos;
    const top = S.topPos;
    const right = S.rightPos;
    const bottom = S.bottomPos;
    const mapW = right - left;
    const mapH = bottom - top;
    if (mapW <= 0 || mapH <= 0) return;
    const halfW = S.canvasWidth / (2 * S.viewZoom);
    const halfH = S.canvasHeight / (2 * S.viewZoom);
    const visLeft = Math.max(left, S.nodeX - halfW);
    const visRight = Math.min(right, S.nodeX + halfW);
    const visTop = Math.max(top, S.nodeY - halfH);
    const visBottom = Math.min(bottom, S.nodeY + halfH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, mapW, mapH);
    ctx.clip();
    if (S.customMapBgMode === "repeat") {
      const tile = Math.max(32, S.customMapBgTileSize | 0);
      const startX = left + Math.floor((visLeft - left) / tile) * tile;
      const startY = top + Math.floor((visTop - top) / tile) * tile;
      for (let x = startX; x < visRight; x += tile) {
        for (let y = startY; y < visBottom; y += tile) {
          ctx.drawImage(S.mapBgImage, x, y, Math.min(tile, right - x), Math.min(tile, bottom - y));
        }
      }
    } else {
      ctx.drawImage(S.mapBgImage, left, top, mapW, mapH);
    }
    ctx.restore();
  }
  function drawVirusFillBackground2(S, ctx, cell, renderSize, simpleRender, bigPointSize) {
    if (!S.customVirusBgEnabled || !S.virusBgImage || !S.virusBgImage.complete || !S.virusBgImage.width) return false;
    const half = (simpleRender ? renderSize : bigPointSize) * 1.15;
    ctx.save();
    ctx.clip();
    ctx.drawImage(S.virusBgImage, cell.x - half, cell.y - half, half * 2, half * 2);
    ctx.restore();
    return true;
  }
  function updateBgPreview(previewId, dataUrl) {
    const el = document.getElementById(previewId);
    if (!el) return;
    if (dataUrl) {
      el.style.backgroundImage = `url("${dataUrl}")`;
      el.classList.add("has-image");
    } else {
      el.style.backgroundImage = "";
      el.classList.remove("has-image");
    }
  }
  function syncBgTileRows(S) {
    const mapRow = document.getElementById("map-bg-tile-row");
    if (mapRow) mapRow.style.display = S.customMapBgMode === "repeat" ? "flex" : "none";
  }
  function initCustomBgSettings(S) {
    if (S.customBgSettingsInitialized) return;
    S.customBgSettingsInitialized = true;
    S.customMapBgMode = getCookie("custom_map_bg_mode") || "stretch";
    S.customMapBgTileSize = parseInt(getCookie("custom_map_bg_tile"), 10) || 512;
    const mapMode = document.getElementById("map-bg-mode");
    const mapTile = document.getElementById("map-bg-tile");
    if (mapMode) mapMode.value = S.customMapBgMode;
    if (mapTile) mapTile.value = S.customMapBgTileSize;
    syncBgTileRows(S);
    const enabledMap = readCheckboxSaved(15);
    if (enabledMap !== null) S.customMapBgEnabled = enabledMap;
    const enabledVirus = readCheckboxSaved(16);
    if (enabledVirus !== null) S.customVirusBgEnabled = enabledVirus;
    loadBgImageFromDataUrl(localStorage.getItem("custom_map_bg_image"), img => {
      S.mapBgImage = img;
      updateBgPreview("map-bg-preview", img ? localStorage.getItem("custom_map_bg_image") : null);
    });
    loadBgImageFromDataUrl(localStorage.getItem("custom_virus_bg_image"), img => {
      S.virusBgImage = img;
      updateBgPreview("virus-bg-preview", img ? localStorage.getItem("custom_virus_bg_image") : null);
    });
    function bindBgFile(fileId, storageKey, previewId, setImage) {
      const input = document.getElementById(fileId);
      if (!input) return;
      input.addEventListener("change", function() {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader;
        reader.onload = function(e) {
          const dataUrl = e.target.result;
          loadBgImageFromDataUrl(dataUrl, img => {
            setImage(img);
            if (img && saveBgImageToStorage(storageKey, dataUrl)) {
              updateBgPreview(previewId, dataUrl);
            } else if (img) {
              updateBgPreview(previewId, dataUrl);
              alert("Картинка загружена, но слишком большая для сохранения. После перезагрузки выберите файл снова.");
            }
          });
        };
        reader.readAsDataURL(file);
      });
    }
    bindBgFile("map-bg-file", "custom_map_bg_image", "map-bg-preview", img => {
      S.mapBgImage = img;
    });
    bindBgFile("virus-bg-file", "custom_virus_bg_image", "virus-bg-preview", img => {
      S.virusBgImage = img;
    });
    const mapClear = document.getElementById("map-bg-clear");
    const virusClear = document.getElementById("virus-bg-clear");
    if (mapClear) mapClear.addEventListener("click", () => {
      S.mapBgImage = null;
      saveBgImageToStorage("custom_map_bg_image", null);
      updateBgPreview("map-bg-preview", null);
      const fi = document.getElementById("map-bg-file");
      if (fi) fi.value = "";
    });
    if (virusClear) virusClear.addEventListener("click", () => {
      S.virusBgImage = null;
      saveBgImageToStorage("custom_virus_bg_image", null);
      updateBgPreview("virus-bg-preview", null);
      const fi = document.getElementById("virus-bg-file");
      if (fi) fi.value = "";
    });
    if (mapMode) mapMode.addEventListener("change", function() {
      S.customMapBgMode = this.value;
      setCookie("custom_map_bg_mode", S.customMapBgMode, 365);
      syncBgTileRows(S);
    });
    if (mapTile) mapTile.addEventListener("change", function() {
      S.customMapBgTileSize = Math.max(64, parseInt(this.value, 10) || 512);
      this.value = S.customMapBgTileSize;
      setCookie("custom_map_bg_tile", S.customMapBgTileSize, 365);
    });
  }
  function isEjectedMass2(S, cell) {
    if (!cell || cell.isVirus || cell.isFood) return false;
    if (S.playerCells.indexOf(cell) !== -1) return false;
    const flags = cell.flag | 0;
    if (flags & 32 || flags & 64 || cell.isEjected) return true;
    const sz = cell.nSize || cell.size || 0;
    if (sz <= 0 || !(S.foodMaxSize > 0)) return false;
    return sz > S.foodMaxSize && sz <= Math.max(55, S.foodMaxSize + 20);
  }
  function getClientCellColor2(S, cell) {
    if (!S.customClientColors) return null;
    if (cell.isVirus) return S.clientColorVirus;
    if (cell.isFood) return S.clientColorFood;
    if (S.playerCells.indexOf(cell) !== -1) return S.clientColorOwn;
    if (isEjectedMass2(S, cell)) return S.clientColorEject;
    if (!cell.isVirus && !cell.isFood && S.playerCells.indexOf(cell) === -1) {
      return S.clientColorEnemy;
    }
    return null;
  }
  function loadClientColorSettings(S) {
    const enabled = readCheckboxSaved(14);
    if (enabled !== null) {
      S.customClientColors = enabled;
    }
    S.clientColorVirus = getCookie("client_color_virus") || S.clientColorVirus;
    S.clientColorFood = getCookie("client_color_food") || S.clientColorFood;
    S.clientColorEnemy = getCookie("client_color_enemy") || S.clientColorEnemy;
    S.clientColorOwn = getCookie("client_color_own") || S.clientColorOwn;
    S.clientColorEject = getCookie("client_color_eject") || S.clientColorEject;
  }
  function saveClientColorSetting(key, value) {
    setCookie(key, value, 365);
  }
  function wireClientColorInputs(S) {
    loadClientColorSettings(S);
    const clientColorInputs = [ [ "client-color-virus", "client_color_virus", () => S.clientColorVirus, v => {
      S.clientColorVirus = v;
    } ], [ "client-color-food", "client_color_food", () => S.clientColorFood, v => {
      S.clientColorFood = v;
    } ], [ "client-color-enemy", "client_color_enemy", () => S.clientColorEnemy, v => {
      S.clientColorEnemy = v;
    } ], [ "client-color-own", "client_color_own", () => S.clientColorOwn, v => {
      S.clientColorOwn = v;
    } ], [ "client-color-eject", "client_color_eject", () => S.clientColorEject, v => {
      S.clientColorEject = v;
    } ] ];
    clientColorInputs.forEach(([id, cookieKey, getter, setter]) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.value = getCookie(cookieKey) || getter();
      input.addEventListener("input", function() {
        setter(input.value);
        saveClientColorSetting(cookieKey, input.value);
      });
    });
  }
  function getCheckboxDefaultValue(S, id) {
    switch (id) {
     case 1:
      return S.showSkin;

     case 2:
      return S.showName;

     case 3:
      return S.showColor;

     case 4:
      return S.enableMouseClicks;

     case 5:
      return S.showMass;

     case 6:
      return S.smoothRender > .4;

     case 7:
      return S.closebord;

     case 8:
      return S.hideChat;

     case 9:
      return S.showGlow;

     case 10:
      return S.showAdultContent;

     case 11:
      return S.confirmCloseTab;

     case 12:
      return S.fixedCell;

     case 13:
      return S.showStickers;

     case 14:
      return S.customClientColors;

     case 15:
      return S.customMapBgEnabled;

     case 16:
      return S.customVirusBgEnabled;

     default:
      return false;
    }
  }
  function persistCheckbox(id, value) {
    setCookie("checkbox-" + id, value ? "true" : "false", 365);
    try {
      localStorage.setItem("checkbox-" + id, value ? "true" : "false");
    } catch (e) {}
  }
  function readCheckboxSaved(id) {
    const fromCookie = getCookie("checkbox-" + id);
    if (fromCookie !== void 0 && fromCookie !== null && fromCookie !== "") {
      return fromCookie === "true";
    }
    try {
      const fromLs = localStorage.getItem("checkbox-" + id);
      if (fromLs === "true" || fromLs === "false") return fromLs === "true";
    } catch (e) {}
    return null;
  }
  function restoreCheckboxCookies(S) {
    onReady(function() {
      const qualitySelect = document.getElementById("quality-select");
      const savedQuality = readStored("render_quality", "high");
      const quality = savedQuality === "low" || savedQuality === "medium" ? savedQuality : "high";
      S.renderQuality = quality;
      if (qualitySelect) qualitySelect.value = quality;
      if (S.nCanvas) canvasResize(S);
      const checkboxes = Array.from(document.querySelectorAll(".save"));
      checkboxes.forEach(input => {
        const id = Number(input.dataset.boxId);
        const saved = readCheckboxSaved(id);
        input.checked = saved !== null ? saved : getCheckboxDefaultValue(S, id);
      });
      loadClientColorSettings(S);
      loadMouseButtonSettings(S);
      S.keyBinds = loadKeybinds();
      renderKeybindUI(S);
      checkboxes.forEach(input => {
        input.dispatchEvent(new Event("change", {
          bubbles: true
        }));
        if (input.dataset.persistBound === "1") return;
        input.dataset.persistBound = "1";
        input.addEventListener("change", function() {
          const id = Number(input.dataset.boxId);
          const value = input.checked;
          persistCheckbox(id, value);
          if (id == 10) S.wHandle.setAdultContent(value);
          if (id == 11) S.wHandle.setConfirmCloseTab(value);
          if (id == 13) S.wHandle.setShowStickers(value);
          if (id == 14) S.wHandle.setCustomClientColors(value);
          if (id == 15) S.wHandle.setCustomMapBg(value);
          if (id == 16) S.wHandle.setCustomVirusBg(value);
        });
      });
    });
  }
  function attachSettings(S, hooks = {}) {
    const wHandle = S.wHandle;
    wHandle.setSkins = function(arg) {
      S.showSkin = arg;
      persistCheckbox(1, arg);
    };
    wHandle.setNames = function(arg) {
      S.showName = arg;
      persistCheckbox(2, arg);
    };
    wHandle.setColors = function(arg) {
      S.showColor = arg;
      persistCheckbox(3, arg);
    };
    wHandle.setMouseClicks = function(arg) {
      S.enableMouseClicks = arg;
      persistCheckbox(4, arg);
      syncMouseBindSettingsVisibility(S);
    };
    wHandle.setShowMass = function(arg) {
      S.showMass = arg;
      persistCheckbox(5, arg);
    };
    wHandle.setSmooth = function(arg) {
      S.smoothRender = arg ? 2 : .4;
      persistCheckbox(6, arg);
    };
    wHandle.setRenderQuality = function(arg) {
      const q = arg === "low" || arg === "medium" ? arg : "high";
      S.renderQuality = q;
      writeStored("render_quality", q);
      const select = document.getElementById("quality-select");
      if (select && select.value !== q) select.value = q;
      canvasResize(S);
    };
    wHandle.setNoBorder = function(arg) {
      S.closebord = arg;
      persistCheckbox(7, arg);
    };
    wHandle.setChatHide = function(arg) {
      S.hideChat = arg;
      persistCheckbox(8, arg);
    };
    wHandle.setGlow = function(arg) {
      S.showGlow = arg;
      persistCheckbox(9, arg);
    };
    wHandle.setAdultContent = function(arg) {
      S.showAdultContent = arg;
      persistCheckbox(10, arg);
    };
    wHandle.setConfirmCloseTab = function(arg) {
      S.confirmCloseTab = arg;
      persistCheckbox(11, arg);
    };
    wHandle.setFixedCell = function(arg) {
      S.fixedCell = arg;
      persistCheckbox(12, arg);
    };
    wHandle.setShowStickers = function(arg) {
      S.showStickers = arg;
      persistCheckbox(13, arg);
    };
    wHandle.setCustomClientColors = function(arg) {
      S.customClientColors = arg;
      persistCheckbox(14, arg);
    };
    wHandle.setCustomMapBg = function(arg) {
      S.customMapBgEnabled = arg;
      persistCheckbox(15, arg);
    };
    wHandle.setCustomVirusBg = function(arg) {
      S.customVirusBgEnabled = arg;
      persistCheckbox(16, arg);
    };
    if (hooks.fixDead) {
      wHandle.fixDead = hooks.fixDead;
    }
    Object.defineProperty(wHandle, "freeze", {
      get() {
        return S.freeze;
      },
      set(v) {
        S.freeze = !!v;
      },
      configurable: true
    });
    window.addEventListener("beforeunload", function(e) {
      if (S.confirmCloseTab) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    restoreCheckboxCookies(S);
    onReady(function() {
      wireClientColorInputs(S);
      initCustomBgSettings(S);
      initKeybindSettings(S);
      initSettingsNav();
    });
    return {
      drawCustomMapBackground: ctx => drawCustomMapBackground2(S, ctx),
      drawVirusFillBackground: (ctx, cell, renderSize, simpleRender, bigPointSize) => drawVirusFillBackground2(S, ctx, cell, renderSize, simpleRender, bigPointSize),
      getClientCellColor: cell => getClientCellColor2(S, cell),
      isEjectedMass: cell => isEjectedMass2(S, cell),
      cancelKeybindCapture: () => cancelKeybindCapture(S)
    };
  }
function initServers(S) {
  let serverKey = "ffa";
  const hash = S.wHandle.location.hash.slice(1);
  const hashWithoutParams = hash.split("?")[0];
  const urlParams = new URLSearchParams(window.location.search);
  
  // Определяем сервер из URL
  if (hash && SERVERS[hashWithoutParams]) {
    serverKey = hashWithoutParams;
  } else {
    const keys = Object.keys(SERVERS);
    if (keys.length) serverKey = keys[0];
  }
  
  S.CONNECTION_URL = SERVERS[serverKey];
  S.SELECTED_SERVER = S.CONNECTION_URL;
  
  // Обновляем активный класс на НОВЫХ элементах .server-item
  document.querySelectorAll(".server-item").forEach(el => el.classList.remove("active"));
  const activeItem = document.getElementById(serverKey);
  if (activeItem) {
    activeItem.classList.add("active");
  }
  
  const titleEl = document.getElementById("serverTitle");
  if (titleEl) {
    const serverName = GAME_SERVERS[serverKey]?.title || serverKey;
    titleEl.textContent = `Статистика ${serverName}`;
  }
  
  if (urlParams.has("spect") || hash.includes("?spect")) {
    window._autoSpectate = true;
  }
  
  if (typeof S.wHandle.chekstats === "function") {
    S.wHandle.chekstats();
  }
}
  function hideGameOverlays() {
    hideOverlays();
  }
  function initGame(wHandle) {
    const S = createGameState();
    S.wHandle = wHandle;
    S.keyBinds = loadKeybinds(KEYBIND_DEFAULTS);
    S.cellColors = CELL_COLORS;
    S.touchable = "createTouch" in window || navigator.maxTouchPoints > 0;
    S.leftTouchPos = new Vector2(0, 0);
    S.leftTouchStartPos = new Vector2(0, 0);
    S.leftVector = new Vector2(0, 0);
    S.joystickRadius = 360;
    S.cursorSize = 20;
    S.canSendCoord = true;
    S.splitIcon = new Image;
    S.ejectIcon = new Image;
    S.splitIcon.src = "/photo/split.png";
    S.ejectIcon.src = "/photo/eject.png";
    S.isTouchStart = "ontouchstart" in wHandle && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    S.Quad = Quad;
    S.nodesSortDirty = true;
    bindCellDeps({
      S,
      getSkinImage,
      loadCachedImage,
      normalizeNick
    });
    const listsPromise = preloadStaticLists().then(({skin, sticker, pass, invisible, rotation, words}) => {
      applySkinListToState(S, skin);
      applyStickerListToState(S, sticker);
      S.passUsers = pass.passUsers;
      S.passPlayerNickToId = pass.passPlayerNickToId;
      S.passClanNickToId = pass.passClanNickToId;
      S.invisible = invisible;
      S.rotation = rotation;
      S.badWordsSet = words;
      ensureNameSets(S);
      invalidateStatsRenderCaches(S);
      return {
        skin,
        sticker,
        pass,
        invisible,
        rotation,
        words
      };
    }).catch(() => {
      ensureNameSets(S);
      return null;
    });
    const outbound = attachOutbound(S);
    const chatApi = attachChat(S, {
      sendChat: t => outbound.sendChat(t),
      setserver: arg => wHandle.setserver(arg),
      getSkinImageUrl,
      createLevelIcon: (level, nick) => createLevelIcon(S, level, nick, {
        getSkinImageUrl,
        setImgSrc
      }),
      getStarClass
    });
    const lbApi = attachLeaderboard(S, {
      getLevel,
      createLevelIcon: (level, nick) => createLevelIcon(S, level, nick, {
        getSkinImageUrl,
        setImgSrc
      }),
      getStarClass,
      resolveClanPassIdFromName: name => resolveClanPassIdFromName(S, name),
      resolvePlayerPassIdFromName: name => resolvePlayerPassIdFromName(S, name),
      STATS_PROFILE_BASE,
      STATS_CLAN_PROFILE_BASE
    });
    const sceneApi = attachScene(S, {
      sendMouseMove: () => outbound.sendMouseMove()
    });
    const statsApi = attachStats(S, {
      censorMessage: msg => chatApi.censorMessage(msg),
      setNick: nick => wHandle.setNick(nick),
      sendChat: t => outbound.sendChat(t),
      getSkinImageUrl,
      setImgSrc,
      onTopPlayer: top => loadTopPlayerData([ top ])
    });
    const connectionHooks = {
      onMessage: null,
      sendNickName: () => outbound.sendNickName(),
      sendChat: t => outbound.sendChat(t),
      sendAccountToken: () => outbound.sendAccountToken(),
      clearWorld: () => {
        resetWorldContainers(S);
        clearWorld(S);
      }
    };
    const connection = attachConnection(S, connectionHooks);
    const handlers = attachHandlers(S, {
      updateNodes: reader => updateNodes(S, reader, {
        Cell,
        onPlayerDeath: () => {
          showStatics();
          updateShareText(S);
          if (typeof window.renderDeathBanner === "function") window.renderDeathBanner();
        }
      }),
      addChat: (view, offset) => chatApi.addChat(view, offset),
      drawLeaderBoard: () => lbApi.drawLeaderBoard(),
      drawCustomLeaderBoard: () => lbApi.drawCustomLeaderBoard(),
      onUpdateXp: xp => {
        if (typeof wHandle.onUpdateXp === "function") wHandle.onUpdateXp(xp);
      },
      onGameHandshakeReady: () => connection.onGameHandshakeReady(),
      getLevel,
      setPingDisplay
    });
    connectionHooks.onMessage = dv => handlers.handleWsMessage(dv);
    attachSettings(S, {
      fixDead: () => fixDead(S)
    });
    const bootSettingsUi = () => {
      initKeybindSettings(S);
      initSettingsNav();
      initMouseButtonSettings(S);
      initCustomBgSettings(S);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootSettingsUi);
    } else {
      bootSettingsUi();
    }
    wHandle.setserver = function(arg) {
      if (!SERVERS || Object.keys(SERVERS).length === 0) {
        console.warn("Серверы ещё не загружены. Подождите...");
        return;
      }
      const wsUrl = getGameServerWssUrl(arg);
      const alreadyConnected = S.ws && S.ws.readyState === WebSocket.OPEN && S.currentWebSocketUrl === wsUrl;
      if (arg !== S.CONNECTION_URL) {
        S.CONNECTION_URL = arg;
        const foundHash = Object.keys(SERVERS).find(key => SERVERS[key] === arg);
        if (foundHash) {
          history.replaceState(null, "", `#${foundHash}`);
          setActiveFromHash(S);
        } else {
          console.warn("Неизвестный сервер URL:", arg);
          history.replaceState(null, "", " ");
        }
      }
      if (!alreadyConnected) {
        connection.showConnecting();
        updateOnlineCount();
      }
    };
    wHandle.setNick = function(arg) {
      wHandle.setserver(S.SELECTED_SERVER);
      hideGameOverlays();
      S.userNickName = arg;
      outbound.sendNickName();
      hideStatics();
      S.maxScore = 0;
    };
    wHandle.spectate = function() {
      wHandle.setserver(S.SELECTED_SERVER);
      S.userNickName = null;
      hideGameOverlays();
      hideStatics();
      if (typeof wHandle.chekstats === "function") wHandle.chekstats();
    };
    wHandle.connect = connection.wsConnect;
onReady(() => {
  // Обработчики для НОВЫХ элементов .server-item
  document.querySelectorAll(".server-item").forEach(item => {
    item.addEventListener("click", function() {
      // Убираем активный класс у всех
      document.querySelectorAll(".server-item").forEach(el => el.classList.remove("active"));
      // Добавляем активный класс нажатому
      this.classList.add("active");
      
      // ✅ ТОЛЬКО СОХРАНЯЕМ ВЫБРАННЫЙ СЕРВЕР
      const id = this.id;
      if (id) {
        S.SELECTED_SERVER = this.dataset.ip;
        S.CONNECTION_URL = this.dataset.ip;
        history.replaceState(null, "", "#" + id);
      }
      
      // Обновляем заголовок статистики
      const titleEl = document.getElementById("serverTitle");
      if (titleEl) {
        const serverName = GAME_SERVERS[id]?.title || id || "FFA";
        titleEl.textContent = `Статистика ${serverName}`;
      }
      
      // Обновляем статистику
      if (typeof wHandle.chekstats === "function") {
        wHandle.chekstats();
      }
      
      // ❌ НЕ КОННЕКТИМСЯ К СЕРВЕРУ!
      // ❌ НЕ ЗАКРЫВАЕМ ВЕБСОКЕТ!
      // ❌ НЕ ВЫЗЫВАЕМ setserver!
    });
  });
});
    listsPromise.then(() => fetchNickPerksLists(S)).catch(() => {});
    listsPromise.then(() => initServers(S)).catch(() => initServers(S));
    setInterval(async () => {
      const data = await preloadStaticLists(true);
      applySkinListToState(S, data.skin);
      applyStickerListToState(S, data.sticker);
      S.passUsers = data.pass.passUsers;
      S.passPlayerNickToId = data.pass.passPlayerNickToId;
      S.passClanNickToId = data.pass.passClanNickToId;
      S.invisible = data.invisible;
      S.rotation = data.rotation;
      S.badWordsSet = data.words;
      invalidateStatsRenderCaches(S);
      if (typeof wHandle.chekstats === "function") wHandle.chekstats();
    }, TTL_MS);
    wHandle.addEventListener("hashchange", () => initServers(S));
    attachAccountHooks(S, {
      sendAccountToken: () => outbound.sendAccountToken(),
      setNick: n => wHandle.setNick(n),
      selectSkin: null
    });
    initShareHandlers(S);
    connection.bindVisibilityHandlers();
    hideReconnectPanel();
    function startGameLoop() {
      const urlParams = new URLSearchParams(window.location.search);
      const hash = wHandle.location.hash;
      if (urlParams.has("spect") || hash.includes("?spect")) {
        S.zoom = .5;
      }
      if (window._autoSpectate && typeof wHandle.spectate === "function") {
        delete window._autoSpectate;
        setTimeout(() => wHandle.spectate(), 100);
      }
      attachInput(S, {
        sendUint8: a => outbound.sendUint8(a),
        sendMouseMove: () => outbound.sendMouseMove(),
        sendChat: t => outbound.sendChat(t),
        fixDead: () => fixDead(S),
        coord: () => wHandle.coord(),
        redrawGameScene: sceneApi.redrawGameScene,
        updateStats: () => {
          updateStats(S);
          statsApi.updateStats();
        },
        reconnectToServer: () => connection.reconnectToServer(),
        prepareData,
        wsSend: v => connection.wsSend(v),
        wsIsOpen: () => outbound.wsIsOpen(),
        showConnecting: () => connection.showConnecting()
      });
    }
    wHandle.onload = startGameLoop;
    if (document.readyState === "complete") {
      startGameLoop();
    }
    wHandle.__gameState = S;
    wHandle.__gameApi = S.api;
    return S;
  }
  var actionInterval = 500;
  var actionTimeout;
  var currentIndex = 0;
  var MANUAL_SKINS_NICKS = [ "Ленин", "Сталин", "Гагарин", "Жуков", "Хрущёв", "CССР", "Путин", "Россия" ];
  var SKINS_PER_PAGE_MOBILE = 8;
  var SKINS_PER_PAGE_DESKTOP = 14;
  var PLAYERS_KEY = "players";
  var MAX_PLAYERS = 3;
  var skinsGalleryItems = [];
  var skinsGalleryPage = 1;
  var skinsGalleryPerPage = SKINS_PER_PAGE_DESKTOP;
  var skinsGalleryLoading = false;
  var skinsGalleryLoaded = false;
  var skinsGalleryResizeBound = false;
  var cachedSkinsMap = null;
  var cachedSkinsMapAt = 0;
  var avatarCtxMenu = null;
  function getSkinPreviewUrl(skinId) {
    return skinId ? `https://api.agar.su/skins/${skinId}.png` : "";
  }
  function setBackgroundImageIfChanged(el, skinId) {
    if (!el) return;
    const url = getSkinPreviewUrl(skinId);
    const next = url ? `url(${url})` : "";
    if (el.dataset.bgSrc === next) return;
    el.dataset.bgSrc = next;
    el.style.backgroundImage = next;
  }
  function getPlayers() {
    try {
      const players = JSON.parse(localStorage.getItem(PLAYERS_KEY) || "[]");
      return Array.isArray(players) ? players : [];
    } catch (e) {
      return [];
    }
  }
  function setPlayers(players) {
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
  }
  function getPassInputValue() {
    const passInput = document.getElementById("pass");
    return passInput ? String(passInput.value || "").trim() : "";
  }
  function setFormNickPass(nick, pass) {
    const nickInput = document.getElementById("nick");
    const passInput = document.getElementById("pass");
    if (nickInput && nick != null) nickInput.value = nick;
    if (passInput) {
      passInput.value = pass || "";
      if (typeof window.__agarsuCheckNickStatus === "function") {
        window.__agarsuCheckNickStatus(nick || "");
      }
    }
    if (typeof window.__agarsuSyncNickPassCookies === "function") {
      window.__agarsuSyncNickPassCookies(nick || "", pass || "");
    }
  }
  function getSkinsGalleryPerPage() {
    return window.matchMedia("(max-width: 599px)").matches ? SKINS_PER_PAGE_MOBILE : SKINS_PER_PAGE_DESKTOP;
  }
  function bindSkinsGalleryResize() {
    if (skinsGalleryResizeBound) return;
    skinsGalleryResizeBound = true;
    let lastPerPage = getSkinsGalleryPerPage();
    window.addEventListener("resize", () => {
      const next = getSkinsGalleryPerPage();
      if (next === lastPerPage || !skinsGalleryLoaded) return;
      lastPerPage = next;
      skinsGalleryPerPage = next;
      const totalPages = Math.max(1, Math.ceil(skinsGalleryItems.length / skinsGalleryPerPage));
      if (skinsGalleryPage > totalPages) skinsGalleryPage = totalPages;
      renderSkinsGalleryPage(skinsGalleryPage);
    });
  }
  async function loadSkinsGalleryData() {
    const {map: skinMap} = await loadSkinListMap();
    const items = [];
    for (const nick of MANUAL_SKINS_NICKS) {
      const code = skinMap.get(normalizeNick(nick));
      if (code) {
        items.push({
          nick,
          code
        });
      }
    }
    skinsGalleryItems = items;
    skinsGalleryLoaded = true;
  }
  function setSkinsGalleryStatus(text, isError) {
    const el = document.getElementById("skinsGalleryStatus");
    if (!el) return;
    const textEl = el.querySelector(".skins-gallery-status-text");
    if (textEl) textEl.textContent = text || ""; else el.textContent = text || "";
    el.classList.toggle("is-error", !!isError);
    const createBtn = el.querySelector(".skins-gallery-shop-btn");
    if (createBtn) createBtn.hidden = !!isError;
  }
  function mountSkinsGalleryPanel() {
    var _a;
    const panel = document.getElementById("skinslist");
    if (!panel) return null;
    if (!panel.querySelector("#skinsGalleryGrid")) {
      panel.innerHTML = `\n          <div class="skins-gallery-wrap">\n            <div class="skins-gallery-header">\n              <span class="skins-gallery-title">Галерея бесплатных скинов</span>\n            </div>\n            <div id="skinsGalleryGrid" class="skins-gallery-grid"></div>\n            <div id="skinsGalleryPagination" class="skins-gallery-pagination"></div>\n            <p id="skinsGalleryStatus" class="skins-gallery-status">\n              <span class="skins-gallery-status-text"></span>\n              <button type="button" class="skins-gallery-shop-btn" onclick="showContent('shop')">Создать скин</button>\n            </p>\n          </div>`;
    } else {
      (_a = panel.querySelector(".skins-gallery-header .skins-gallery-shop-btn")) == null ? void 0 : _a.remove();
      const status = panel.querySelector("#skinsGalleryStatus");
      if (status && !status.querySelector(".skins-gallery-shop-btn")) {
        status.innerHTML = `\n              <span class="skins-gallery-status-text"></span>\n              <button type="button" class="skins-gallery-shop-btn" onclick="showContent('shop')">Создать скин</button>`;
      }
    }
    panel.dataset.mounted = "1";
    return panel;
  }
  function renderSkinsGalleryPagination(totalPages, pagination) {
    pagination.innerHTML = "";
    if (totalPages <= 1) return;
    const addBtn = (label, p, extraClass) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.className = extraClass || "page-num";
      if (p === skinsGalleryPage) btn.classList.add("active");
      if (p != null) {
        btn.addEventListener("click", () => renderSkinsGalleryPage(p));
      } else {
        btn.disabled = true;
      }
      pagination.appendChild(btn);
    };
    if (skinsGalleryPage > 1) {
      addBtn("‹", skinsGalleryPage - 1, "page-nav");
    }
    const windowSize = 5;
    let start = Math.max(1, skinsGalleryPage - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    for (let i = start; i <= end; i++) {
      addBtn(String(i), i, "page-num");
    }
    if (skinsGalleryPage < totalPages) {
      addBtn("›", skinsGalleryPage + 1, "page-nav");
    }
  }
  function renderSkinsGalleryPage(page) {
    const grid = document.getElementById("skinsGalleryGrid");
    const pagination = document.getElementById("skinsGalleryPagination");
    if (!grid || !pagination) return;
    skinsGalleryPerPage = getSkinsGalleryPerPage();
    bindSkinsGalleryResize();
    grid.setAttribute("data-per-page", String(skinsGalleryPerPage));
    grid.innerHTML = "";
    const totalPages = Math.max(1, Math.ceil(skinsGalleryItems.length / skinsGalleryPerPage));
    skinsGalleryPage = Math.min(Math.max(1, page), totalPages);
    const start = (skinsGalleryPage - 1) * skinsGalleryPerPage;
    const pageSkins = skinsGalleryItems.slice(start, start + skinsGalleryPerPage);
    pageSkins.forEach(skin => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "skins-gallery-card";
      card.innerHTML = `\n            <img src="https://api.agar.su/skins/${skin.code}.png" alt="" loading="lazy">\n            <h4>${escapeHtml(skin.nick)}</h4>\n        `;
      card.addEventListener("click", async () => {
        await selectSkin(skin.nick);
        showContent("home");
      });
      grid.appendChild(card);
    });
    renderSkinsGalleryPagination(totalPages, pagination);
    if (!skinsGalleryItems.length) {
      setSkinsGalleryStatus("Нет скинов. Добавьте ники в MANUAL_SKINS_NICKS", false);
    } else if (totalPages <= 1) {
      setSkinsGalleryStatus(`${skinsGalleryItems.length} скинов`, false);
    } else {
      setSkinsGalleryStatus(`${skinsGalleryItems.length} · ${skinsGalleryPage} / ${totalPages}`, false);
    }
  }
  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  async function initSkinsGallery() {
    mountSkinsGalleryPanel();
    const grid = document.getElementById("skinsGalleryGrid");
    if (!grid || skinsGalleryLoading) return;
    if (skinsGalleryLoaded && skinsGalleryItems.length) {
      renderSkinsGalleryPage(skinsGalleryPage);
      return;
    }
    skinsGalleryLoading = true;
    setSkinsGalleryStatus("Загрузка…");
    grid.innerHTML = "";
    try {
      await loadSkinsGalleryData();
      renderSkinsGalleryPage(1);
    } catch (e) {
      console.error("Галерея скинов:", e);
      setSkinsGalleryStatus("Не удалось загрузить галерею. Попробуйте позже.", true);
    } finally {
      skinsGalleryLoading = false;
    }
  }
  async function loadSkinsList(force) {
    const {map} = await loadSkinListMap(force);
    cachedSkinsMap = map;
    cachedSkinsMapAt = Date.now();
    return map;
  }
  async function selectSkin(nick) {
    const skinsMap = await loadSkinsList();
    const normalizedNick = normalizeNick(nick);
    if (skinsMap.has(normalizedNick)) {
      const id = skinsMap.get(normalizedNick);
      savePlayerData(nick, id, getPassInputValue());
      currentIndex = getCurrentPlayerIndex(nick);
      updateAvatarDisplay();
    } else {
      const skinss = document.querySelector("#skinss");
      if (skinss) setBackgroundImageIfChanged(skinss, "");
    }
  }
  function getCurrentPlayerIndex(nick) {
    const players = getPlayers();
    return players.findIndex(player => normalizeNick(player.nick) === normalizeNick(nick));
  }
  function savePlayerData(nick, id, pass) {
    const players = getPlayers();
    const passValue = pass != null ? String(pass).trim() : getPassInputValue();
    const playerData = {
      nick,
      id,
      pass: passValue || ""
    };
    const index = players.findIndex(player => normalizeNick(player.nick) === normalizeNick(nick));
    if (index !== -1) {
      const prevPass = players[index].pass || "";
      if (!playerData.pass && prevPass) playerData.pass = prevPass;
      players.splice(index, 1);
    }
    players.unshift(playerData);
    if (players.length > MAX_PLAYERS) players.pop();
    setPlayers(players);
    currentIndex = 0;
  }
  function updateCurrentPlayerPass(pass) {
    const players = getPlayers();
    if (!players.length || currentIndex < 0 || currentIndex >= players.length) return;
    players[currentIndex] = {
      ...players[currentIndex],
      pass: String(pass || "").trim()
    };
    setPlayers(players);
  }
  function updateAvatarDisplay() {
    const players = getPlayers();
    const mainSkin = document.querySelector("#skinss");
    const previousSkin = document.querySelector("#prevSkin");
    const nextSkin = document.querySelector("#nextSkin");
    if (!mainSkin) return;
    if (players.length > 0) {
      if (currentIndex < 0 || currentIndex >= players.length) currentIndex = 0;
      const currentPlayer = players[currentIndex];
      setBackgroundImageIfChanged(mainSkin, currentPlayer.id);
      setFormNickPass(currentPlayer.nick, currentPlayer.pass || "");
      const prevIndex = (currentIndex - 1 + players.length) % players.length;
      if (previousSkin && players[prevIndex] && players.length > 1) {
        setBackgroundImageIfChanged(previousSkin, players[prevIndex].id);
      } else if (previousSkin) {
        setBackgroundImageIfChanged(previousSkin, "");
      }
      const nextIndex = (currentIndex + 1) % players.length;
      if (nextSkin && players[nextIndex] && players.length > 1) {
        setBackgroundImageIfChanged(nextSkin, players[nextIndex].id);
      } else if (nextSkin) {
        setBackgroundImageIfChanged(nextSkin, "");
      }
    } else {
      setBackgroundImageIfChanged(mainSkin, "");
      setBackgroundImageIfChanged(previousSkin, "");
      setBackgroundImageIfChanged(nextSkin, "");
    }
  }
  function showNext() {
    const players = getPlayers();
    if (players.length > 0) {
      currentIndex = (currentIndex + 1) % players.length;
      changeSkin();
    }
  }
  function showPrevious() {
    const players = getPlayers();
    if (players.length > 0) {
      currentIndex = (currentIndex - 1 + players.length) % players.length;
      changeSkin();
    }
  }
  function changeSkin() {
    const mainSkin = document.querySelector("#skinss");
    if (!mainSkin) return;
    mainSkin.classList.add("scale-down");
    setTimeout(() => {
      updateAvatarDisplay();
      mainSkin.classList.remove("scale-down");
    }, 50);
  }
  function resolveSlotIndexFromTarget(target) {
    const players = getPlayers();
    if (!players.length) return -1;
    if (target.closest("#skinss")) return currentIndex;
    if (target.closest("#prevSkin") || target.closest("#previous")) {
      return players.length > 1 ? (currentIndex - 1 + players.length) % players.length : currentIndex;
    }
    if (target.closest("#nextSkin") || target.closest("#next")) {
      return players.length > 1 ? (currentIndex + 1) % players.length : currentIndex;
    }
    return currentIndex;
  }
  function hideAvatarContextMenu() {
    if (avatarCtxMenu) {
      avatarCtxMenu.remove();
      avatarCtxMenu = null;
    }
  }
  function deletePlayerAt(index) {
    const players = getPlayers();
    if (index < 0 || index >= players.length) return;
    const removed = players.splice(index, 1)[0];
    setPlayers(players);
    if (!players.length) {
      currentIndex = 0;
      setFormNickPass("", "");
      updateAvatarDisplay();
      return;
    }
    if (index < currentIndex) currentIndex -= 1; else if (index === currentIndex) currentIndex = Math.min(currentIndex, players.length - 1);
    updateAvatarDisplay();
    return removed;
  }
  function clearAllPlayers() {
    setPlayers([]);
    currentIndex = 0;
    setFormNickPass("", "");
    updateAvatarDisplay();
  }
  function showAvatarContextMenu(e, slotIndex) {
    hideAvatarContextMenu();
    const players = getPlayers();
    if (!players.length) return;
    const menu = document.createElement("div");
    menu.className = "avatar-context-menu";
    const slot = players[slotIndex];
    const nickLabel = (slot == null ? void 0 : slot.nick) ? ` «${slot.nick}»` : "";
    const delBtn = document.createElement("div");
    delBtn.textContent = `Удалить${nickLabel}`;
    delBtn.addEventListener("click", ev => {
      ev.stopPropagation();
      deletePlayerAt(slotIndex);
      hideAvatarContextMenu();
    });
    const clearBtn = document.createElement("div");
    clearBtn.textContent = "Очистить всё";
    clearBtn.addEventListener("click", ev => {
      ev.stopPropagation();
      clearAllPlayers();
      hideAvatarContextMenu();
    });
    menu.appendChild(delBtn);
    menu.appendChild(clearBtn);
    document.body.appendChild(menu);
    avatarCtxMenu = menu;
    const x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = `${Math.max(8, x)}px`;
    menu.style.top = `${Math.max(8, y)}px`;
  }
  function bindAvatarContextMenu() {
    const root = document.querySelector(".avatar-containers");
    if (!root || root.dataset.ctxBound === "1") return;
    root.dataset.ctxBound = "1";
    root.addEventListener("contextmenu", e => {
      if (!e.target.closest("#skinss, #prevSkin, #nextSkin, #previous, #next")) return;
      e.preventDefault();
      const slotIndex = resolveSlotIndexFromTarget(e.target);
      if (slotIndex < 0) return;
      showAvatarContextMenu(e, slotIndex);
    });
    if (!window.__agarsuAvatarDocBound) {
      window.__agarsuAvatarDocBound = true;
      document.addEventListener("click", hideAvatarContextMenu);
      document.addEventListener("keydown", e => {
        if (e.key === "Escape") hideAvatarContextMenu();
      });
    }
  }
  function bindHomeAvatarUi() {
    const nickInput = document.getElementById("nick");
    const passInput = document.getElementById("pass");
    if (nickInput && nickInput.dataset.homeWired !== "1") {
      nickInput.dataset.homeWired = "1";
      nickInput.addEventListener("input", function() {
        const nickname = this.value;
        clearTimeout(actionTimeout);
        actionTimeout = setTimeout(async () => {
          await selectSkin(nickname);
        }, actionInterval);
      });
    }
    if (passInput && passInput.dataset.homeWired !== "1") {
      passInput.dataset.homeWired = "1";
      passInput.addEventListener("input", function() {
        updateCurrentPlayerPass(this.value);
      });
    }
    bindAvatarContextMenu();
    const players = getPlayers();
    if (players.length > 0) {
      if (currentIndex < 0 || currentIndex >= players.length) currentIndex = 0;
      updateAvatarDisplay();
    }
  }
  window.initSkinsGallery = initSkinsGallery;
  window.showNext = showNext;
  window.showPrevious = showPrevious;
  window.savePlayerData = savePlayerData;
  window.updateAvatarDisplay = updateAvatarDisplay;
  window.__agarsuUpdatePlayerPass = updateCurrentPlayerPass;
  window.__agarsuGetPlayers = getPlayers;
  window.loadSkinsList = loadSkinsList;
  onReady(() => {
    bindHomeAvatarUi();
  });
  function showContent2(id) {
    document.querySelectorAll(".menu-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".content").forEach(content => content.classList.remove("active"));
    const menuItem = document.querySelector(`.menu-item[onclick="showContent('${id}')"]`);
    if (menuItem) menuItem.classList.add("active");
    const panel = document.getElementById(id);
    if (panel) panel.classList.add("active");
    if (typeof window.updateShopAuthNotice === "function") window.updateShopAuthNotice();
    if (id === "skinslist" && typeof window.initSkinsGallery === "function") window.initSkinsGallery();
    if (id === "home") {
      try {
        bindHomeAvatarUi();
      } catch (e) {}
    }
    bus.emit(Events.SHOW_CONTENT, {
      id
    });
  }
  function updateAccountMenuLabel() {
    const label = document.getElementById("accountMenuLabel");
    if (!label) return;
    label.textContent = getAccountToken() ? "ЛК" : "Войти";
  }
  function initChatResize() {
    const chatWindow = document.getElementById("chatX_window");
    const chatContainer = document.getElementById("chatX_container");
    const chatBurger = document.getElementById("chatX_burger");
    const CHAT_SIZE_KEY = "chatX_size_v1";
    const CHAT_MIN_W = 220;
    const CHAT_MAX_W = 520;
    const CHAT_MIN_H = 120;
    function chatMaxHeight() {
      return Math.min(720, Math.floor(window.innerHeight * .85));
    }
    function applyChatSize(width, height, save) {
      if (!chatWindow) return;
      const w = Math.max(CHAT_MIN_W, Math.min(CHAT_MAX_W, width));
      const h = Math.max(CHAT_MIN_H, Math.min(chatMaxHeight(), height));
      chatWindow.style.width = w + "px";
      chatWindow.style.height = h + "px";
      if (save !== false) {
        localStorage.setItem(CHAT_SIZE_KEY, JSON.stringify({
          w,
          h
        }));
      }
    }
    function loadChatSize() {
      try {
        const saved = JSON.parse(localStorage.getItem(CHAT_SIZE_KEY));
        if (saved && saved.w && saved.h) {
          applyChatSize(saved.w, saved.h, false);
        }
      } catch (e) {}
    }
    function isPointerOverChat(clientX, clientY) {
      if (!chatWindow || chatWindow.style.display === "none") return false;
      const rect = chatWindow.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }
    let chatResizing = false;
    let chatResizeStartX = 0;
    let chatResizeStartY = 0;
    let chatResizeStartW = 0;
    let chatResizeStartH = 0;
    function startChatResize(e) {
      if (!chatBurger || !chatWindow) return;
      e.preventDefault();
      e.stopPropagation();
      chatResizing = true;
      chatResizeStartX = e.touches ? e.touches[0].clientX : e.clientX;
      chatResizeStartY = e.touches ? e.touches[0].clientY : e.clientY;
      chatResizeStartW = chatWindow.offsetWidth;
      chatResizeStartH = chatWindow.offsetHeight;
      document.body.style.userSelect = "none";
    }
    function doChatResize(e) {
      if (!chatResizing) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const newW = chatResizeStartW + (clientX - chatResizeStartX);
      const newH = chatResizeStartH - (clientY - chatResizeStartY);
      applyChatSize(newW, newH);
    }
    function stopChatResize() {
      chatResizing = false;
      document.body.style.userSelect = "";
    }
    if (chatBurger) {
      chatBurger.addEventListener("mousedown", startChatResize);
      chatBurger.addEventListener("touchstart", startChatResize, {
        passive: false
      });
    }
    document.addEventListener("mousemove", doChatResize);
    document.addEventListener("touchmove", doChatResize, {
      passive: false
    });
    document.addEventListener("mouseup", stopChatResize);
    document.addEventListener("touchend", stopChatResize);
    document.addEventListener("wheel", e => {
      if (!isPointerOverChat(e.clientX, e.clientY)) return;
      const feed = document.querySelector("#chatX_container .chatX_feed:not([style*='display: none'])") || document.getElementById("chatX_feed");
      if (!feed || feed.scrollHeight <= feed.clientHeight + 1) return;
      e.preventDefault();
      const scroller = attachSmoothScroll(feed, {
        ease: .18
      });
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= feed.clientHeight;
      scroller.by(dy);
    }, {
      passive: false
    });
    loadChatSize();
    return {
      loadChatSize
    };
  }
  function initHudToggles() {
    const onchat = document.getElementById("onchat");
    if (onchat) {
      onchat.addEventListener("click", () => {
        document.getElementById("chatX_window").style.display = "flex";
        onchat.style.display = "none";
      });
    }
    const onmap = document.getElementById("onmap");
    if (onmap) {
      onmap.addEventListener("click", () => {
        document.getElementById("map").style.display = "block";
        onmap.style.display = "none";
      });
    }
    const onleaderboard = document.getElementById("onleaderboard");
    if (onleaderboard) {
      onleaderboard.addEventListener("click", () => {
        document.getElementById("leaderboard").style.display = "block";
        onleaderboard.style.display = "none";
      });
    }
    const freezeBtn = document.getElementById("freeze");
    if (freezeBtn) {
      freezeBtn.addEventListener("click", function() {
        window.freeze = false;
        this.style.display = "none";
      });
    }
    document.querySelectorAll(".homemenu").forEach(el => {
      el.addEventListener("click", () => {
        showOverlays();
      });
    });
    const closeStats = document.getElementById("closeStats");
    if (closeStats) {
      closeStats.addEventListener("click", () => {
        hideStatics();
        showOverlays();
      });
    }
  }
  function initOverlayMouseBridge() {
    const canvas = document.getElementById("canvas");
    const overlays = document.getElementById("overlays");
    if (!canvas || !overlays) return;
    overlays.addEventListener("mousemove", function(event) {
      const x = event.clientX - overlays.offsetLeft;
      const y = event.clientY - overlays.offsetTop;
      const canvasEvent = new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      });
      canvas.dispatchEvent(canvasEvent);
    });
  }
  function initChatNickInsert() {
    const chatFeed = document.getElementById("chatX_feed");
    const leaderboard = document.getElementById("leaderboard");
    const chatInput = document.getElementById("chat_textbox");
    if (!chatFeed || !leaderboard || !chatInput) return;
    function insertNick(nick) {
      nick = nick.trim().replace(/\s+/g, " ");
      if (nick.endsWith(":")) nick = nick.slice(0, -1);
      chatInput.value = "@" + nick + " ";
      chatInput.focus();
      chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
    }
    chatFeed.addEventListener("click", e => {
      if (e.button !== 0) return;
      const msgElem = e.target.closest(".chatX_msg");
      if (!msgElem) return;
      const nickElem = msgElem.querySelector(".chatX_nick");
      if (!nickElem) return;
      insertNick(nickElem.textContent);
    });
    leaderboard.addEventListener("click", e => {
      if (e.button !== 0) return;
      const nickElem = e.target.closest(".Lednick span");
      if (!nickElem) return;
      insertNick(nickElem.textContent);
    });
    const emojiToggle = document.getElementById("emoji_toggle");
    if (emojiToggle) {
      emojiToggle.addEventListener("click", () => {
        const list = document.querySelector("#chatX_window .emoji-list");
        if (!list) return;
        list.style.display = list.style.display === "flex" ? "none" : "flex";
      });
    }
    const emojiList = document.querySelector("#chatX_window .emoji-list");
    if (emojiList) {
      emojiList.addEventListener("click", e => {
        const emojiItem = e.target.closest(".emoji-item");
        if (!emojiItem) return;
        const emojiCode = emojiItem.dataset.code;
        const chatBox = document.getElementById("chat_textbox");
        if (chatBox) chatBox.value += emojiCode;
      });
    }
  }
  function initLobbyUi() {
    const {loadChatSize} = initChatResize();
    updateAccountMenuLabel();
    loadChatSize();
    initHudToggles();
    initOverlayMouseBridge();
    initChatNickInsert();
  }
  window.showContent = showContent2;
  window.updateAccountMenuLabel = updateAccountMenuLabel;
  var ALLOWTXT_LOCAL = "/allowtxt.txt";
  var ALLOWTXT_API = "https://api.agar.su/allowtxt.txt";
  var ALLOWED_CHARS = new Set;
  var allowTxtReady = null;
  function parseAllowTxt(text) {
    ALLOWED_CHARS.clear();
    for (const line of String(text || "").split(/\r?\n/)) {
      if (line.length === 1) ALLOWED_CHARS.add(line);
    }
    return ALLOWED_CHARS.size > 0;
  }
  function loadAllowTxt() {
    if (!allowTxtReady) {
      allowTxtReady = fetch(ALLOWTXT_LOCAL).then(r => {
        if (!r.ok) throw new Error("local allowtxt");
        return r.text();
      }).then(text => {
        if (!parseAllowTxt(text)) throw new Error("empty allowtxt");
      }).catch(() => fetch(ALLOWTXT_API).then(r => {
        if (!r.ok) throw new Error("api allowtxt");
        return r.text();
      }).then(text => {
        if (!parseAllowTxt(text)) throw new Error("empty api allowtxt");
      }));
    }
    return allowTxtReady;
  }
  function isNicknameCharAllowed(char, allowBrackets) {
    if (!allowBrackets && (char === "[" || char === "]")) return false;
    if (ALLOWED_CHARS.size === 0) return true;
    return ALLOWED_CHARS.has(char);
  }
  function isAllowedNickname(value, allowBrackets) {
    if (!value) return true;
    for (const char of value) {
      if (!isNicknameCharAllowed(char, allowBrackets)) return false;
    }
    return true;
  }
  function stripInvalidNicknameChars(value, allowBrackets) {
    if (ALLOWED_CHARS.size === 0) return value;
    return [ ...value ].filter(char => isNicknameCharAllowed(char, allowBrackets)).join("");
  }
  var allowedPattern = {
    test: v => isAllowedNickname(v, false)
  };
  var allowedWithBracketsPattern = {
    test: v => isAllowedNickname(v, true)
  };
  var paymentRules = {
    maxFileSize: 5 * 1024 * 1024
  };
  var isNicknameTaken = false;
  var SHOP_TOAST_TIMEOUT = 4500;
  var errorCooldownMs = 1400;
  var errorCache = new Map;
  function showShopFloatAlert(el, duration = 5e3) {
    if (!el) return;
    clearTimeout(el._hideTimer);
    el.classList.remove("is-hiding");
    el.hidden = false;
    el.style.display = "block";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add("is-visible"));
    });
    el._hideTimer = setTimeout(() => dismissShopFloatAlert(el), duration);
  }
  function dismissShopFloatAlert(el) {
    if (!el || !el.classList.contains("is-visible")) {
      if (el) {
        el.classList.remove("is-visible", "is-hiding");
        el.style.display = "none";
        el.hidden = true;
      }
      return;
    }
    el.classList.remove("is-visible");
    el.classList.add("is-hiding");
    const onEnd = e => {
      if (e.propertyName !== "opacity") return;
      el.classList.remove("is-hiding");
      el.style.display = "none";
      el.hidden = true;
      el.removeEventListener("transitionend", onEnd);
    };
    el.addEventListener("transitionend", onEnd);
    clearTimeout(el._dismissFallback);
    el._dismissFallback = setTimeout(() => {
      if (!el.classList.contains("is-hiding")) return;
      el.classList.remove("is-hiding", "is-visible");
      el.style.display = "none";
      el.hidden = true;
    }, 450);
  }
  function showError(elementId, message, withToast = false) {
    const errorEl = document.getElementById(elementId);
    if (!errorEl) return;
    const cacheKey = `${elementId}:${message}`;
    const now = Date.now();
    const lastShownAt = errorCache.get(cacheKey) || 0;
    if (now - lastShownAt < errorCooldownMs) return;
    errorCache.set(cacheKey, now);
    errorEl.textContent = message;
    showShopFloatAlert(errorEl, 5e3);
    if (withToast) showToast(message, "error");
  }
  function hideError(elementId) {
    dismissShopFloatAlert(document.getElementById(elementId));
  }
  function showToast(message, type = "info") {
    const container = document.getElementById("shopToastContainer");
    if (!container || !message) return;
    const toast = document.createElement("div");
    toast.className = `shop-toast shop-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 260);
    }, SHOP_TOAST_TIMEOUT);
  }
  function updateShopAuthNotice() {
    const notice = document.getElementById("shopAuthNotice");
    const shop = document.getElementById("shop");
    if (!notice || !shop) return;
    const onShop = shop.classList.contains("active");
    if (!onShop || getAccountToken()) {
      dismissShopFloatAlert(notice);
      notice.textContent = "";
      return;
    }
    notice.innerHTML = "Вы не авторизованы.<br>Покупки не будут привязаны к аккаунту.";
    showShopFloatAlert(notice, 6e3);
  }
  function updateCharCount() {
    const input = document.getElementById("nickname");
    const max = document.getElementById("clan").checked ? 6 : 16;
    const length = input.value.length;
    document.getElementById("charCount").textContent = `${length}/${max}`;
  }
  function updateNicknameDisplay() {
    const isClan = document.getElementById("clan").checked;
    const input = document.getElementById("nickname");
    input.value = "";
    if (isClan) {
      input.placeholder = "[клан]";
      input.maxLength = 6;
    } else {
      input.placeholder = "Ваш ник";
      input.maxLength = 16;
    }
    updateCharCount();
  }
  function blockForbiddenChars(input) {
    input.addEventListener("input", () => {
      const isClan = document.getElementById("clan").checked;
      let value = input.value;
      if (value && !allowedWithBracketsPattern.test(value)) {
        const cleaned = stripInvalidNicknameChars(value, true);
        if (cleaned !== value) {
          input.value = cleaned;
          showError(input.id + "Error", "Недопустимые символы в нике");
        }
      }
      if (input.id === "nickname") {
        if (!isClan && /[\[\]]/.test(input.value)) {
          input.value = input.value.replace(/[\[\]]/g, "");
          showError("nicknameError", "Скобки [] запрещены для личного ника");
        }
        updateCharCount();
      }
    });
  }
  var nicknameInput = document.getElementById("nickname");
  var passwordInput = document.getElementById("password");
  loadAllowTxt().then(() => {
    blockForbiddenChars(nicknameInput);
    blockForbiddenChars(passwordInput);
  }).catch(() => {
    blockForbiddenChars(nicknameInput);
    blockForbiddenChars(passwordInput);
    showToast("Не удалось загрузить allowtxt.txt", "error");
  });
  nicknameInput.addEventListener("blur", async () => {
    const isClan = document.getElementById("clan").checked;
    let value = nicknameInput.value.trim();
    if (isClan) {
      let innerText = value.replace(/^\[|\]$/g, "");
      innerText = innerText.replace(/[\[\]]/g, "");
      if (innerText.length > 4) {
        innerText = innerText.substring(0, 4);
        setTimeout(() => {
          showError("nicknameError", "Текст обрезан до 4 символов");
        }, 100);
      }
      nicknameInput.value = `[${innerText}]`;
    } else {
      if (value && !allowedPattern.test(value)) {
        value = stripInvalidNicknameChars(value);
        showError("nicknameError", "Недопустимые символы в нике");
      }
      if (/[\[\]]/.test(value)) {
        value = value.replace(/[\[\]]/g, "");
        showError("nicknameError", "Скобки [] запрещены для личного ника");
      }
      if (value.length > 16) {
        value = value.substring(0, 16);
        setTimeout(() => {
          showError("nicknameError", `Личный ник обрезан до 16 символов`);
        }, 100);
      }
      nicknameInput.value = value;
    }
    updateCharCount();
    try {
      const headers = {
        "Content-Type": "application/json"
      };
      if (getAccountToken()) {
        headers["Authorization"] = `Game ${getAccountToken()}`;
      }
      const res = await fetch("https://api.agar.su/check-nickname", {
        method: "POST",
        headers,
        body: JSON.stringify({
          nickname: nicknameInput.value.trim()
        })
      });
      const data = await res.json();
      if (getAccountToken() && data.taken) {
        const meRes = await fetch("https://api.agar.su/api/me/nicknames", {
          headers: {
            Authorization: `Game ${getAccountToken()}`
          }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          const myNicks = (meData.nicknames || []).map(n => n.nickname.toLowerCase());
          const currentNick = nicknameInput.value.trim().toLowerCase();
          if (myNicks.includes(currentNick)) {
            hideError("nicknameError");
            nicknameInput.setCustomValidity("");
            isNicknameTaken = false;
            calculateCost();
            return;
          }
        }
      }
      if (data.taken) {
        showError("nicknameError", data.error || "Ник занят");
        nicknameInput.setCustomValidity("Ник занят");
        isNicknameTaken = true;
      } else {
        hideError("nicknameError");
        nicknameInput.setCustomValidity("");
        isNicknameTaken = false;
      }
    } catch (err) {
      console.error("Ошибка проверки ника:", err);
      isNicknameTaken = false;
      hideError("nicknameError");
    }
    calculateCost();
  });
  nicknameInput.addEventListener("input", () => {
    updateCharCount();
    calculateCost();
  });
  var invisibleNickCheckbox = document.getElementById("invisibleNick");
  var rotationNickCheckbox = document.getElementById("rotationNick");
  passwordInput.addEventListener("input", () => {
    if (passwordInput.value.length > 5) {
      passwordInput.value = passwordInput.value.substring(0, 5);
      showError("passwordError", "Пароль не может быть длиннее 5 символов");
    } else {
      hideError("passwordError");
    }
    calculateCost();
  });
  var previewContainer = document.getElementById("previewContainer");
  var fileInput = document.getElementById("fileInput");
  var skinCanvas = document.getElementById("previewCanvas");
  var skinCtx = skinCanvas.getContext("2d");
  var gifPreview = document.getElementById("previewGif");
  fileInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > paymentRules.maxFileSize) {
      fileInput.value = "";
      showError("fileError", "Файл слишком большой (макс. 5MB)");
      return;
    }
    if (![ "image/png", "image/jpeg", "image/gif" ].includes(file.type)) {
      fileInput.value = "";
      showError("fileError", "Неподдерживаемый формат. Только PNG, JPG, GIF");
      return;
    }
    previewSkin(file);
    previewContainer.classList.add("has-image");
    calculateCost();
  });
  function previewSkin(file) {
    const url = URL.createObjectURL(file);
    const isGif = file.type === "image/gif";
    if (isGif) {
      skinCanvas.style.display = "none";
      gifPreview.style.display = "block";
      gifPreview.src = url;
    } else {
      gifPreview.style.display = "none";
      skinCanvas.style.display = "block";
      const img = new Image;
      img.onload = () => {
        skinCtx.clearRect(0, 0, skinCanvas.width, skinCanvas.height);
        skinCtx.save();
        skinCtx.beginPath();
        skinCtx.arc(skinCanvas.width / 2, skinCanvas.height / 2, skinCanvas.width / 2, 0, Math.PI * 2);
        skinCtx.closePath();
        skinCtx.clip();
        const scale = Math.max(512 / img.width, 512 / img.height);
        const x = (512 - img.width * scale) / 2;
        const y = (512 - img.height * scale) / 2;
        skinCtx.drawImage(img, x, y, img.width * scale, img.height * scale);
        skinCtx.restore();
      };
      img.onerror = () => {
        skinCtx.fillStyle = "#ccc";
        skinCtx.fillRect(0, 0, skinCanvas.width, skinCanvas.height);
        skinCtx.fillStyle = "#666";
        skinCtx.font = "20px Arial";
        skinCtx.textAlign = "center";
        skinCtx.fillText("Ошибка загрузки", 256, 256);
      };
      img.src = url;
    }
  }
  function getMultiplier() {
    return document.getElementById("clan").checked ? 2 : 1;
  }
  function setPriceRow(rowId, label, amount) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const labelEl = row.querySelector("span");
    const amountEl = row.querySelector("strong");
    if (labelEl && label) labelEl.textContent = label;
    if (amountEl) amountEl.textContent = amount;
  }
  function setReceiptVisible(show) {
    const calculator = document.getElementById("calculator");
    if (calculator) calculator.hidden = !show;
  }
  function calculateCost() {
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value.trim();
    const file = fileInput.files[0];
    const multiplier = getMultiplier();
    const buyButton = document.getElementById("buyButton");
    const totalEl = document.getElementById("totalAmount");
    const hasOrderItem = !!(password || file || invisibleNickCheckbox.checked || rotationNickCheckbox.checked);
    if (!nickname || isNicknameTaken || !hasOrderItem) {
      setReceiptVisible(false);
      buyButton.disabled = true;
      return;
    }
    const passwordCost = password ? 150 : 0;
    const invisibleCost = invisibleNickCheckbox.checked ? 500 : 0;
    const rotationCost = rotationNickCheckbox.checked ? 500 : 0;
    let skinCost = 0;
    let skinLabel = "Скин";
    if (file) {
      skinCost = file.type === "image/gif" ? 4500 : 150;
      skinLabel = file.type === "image/gif" ? "Скин GIF" : "Скин PNG";
    }
    const total = (passwordCost + skinCost + invisibleCost + rotationCost) * multiplier;
    setReceiptVisible(true);
    document.getElementById("multiplierText").textContent = multiplier === 2 ? "2x" : "1x";
    setPriceRow("passwordCost", "Пароль", password ? `${passwordCost * multiplier} ₽` : "0 ₽");
    setPriceRow("skinCost", skinLabel, file ? `${skinCost * multiplier} ₽` : "0 ₽");
    const invisibleRow = document.getElementById("invisibleCost");
    if (invisibleNickCheckbox.checked) {
      setPriceRow("invisibleCost", "Невидимый ник", `${invisibleCost * multiplier} ₽`);
      invisibleRow.style.display = "flex";
    } else {
      invisibleRow.style.display = "none";
    }
    const rotationRow = document.getElementById("rotationCost");
    if (rotationNickCheckbox.checked) {
      setPriceRow("rotationCost", "Поворот скина", `${rotationCost * multiplier} ₽`);
      rotationRow.style.display = "flex";
    } else {
      rotationRow.style.display = "none";
    }
    if (total > 0) {
      totalEl.textContent = `${total} ₽`;
      buyButton.disabled = false;
    } else {
      setReceiptVisible(false);
      buyButton.disabled = true;
    }
  }
  document.querySelectorAll('input[name="serviceType"]').forEach(radio => {
    radio.addEventListener("change", () => {
      updateNicknameDisplay();
      calculateCost();
    });
  });
  updateNicknameDisplay();
  calculateCost();
  updateShopAuthNotice();
  document.getElementById("paymentForm").addEventListener("submit", async e => {
    var _a;
    e.preventDefault();
    const rawNickname = nicknameInput.value.trim();
    const nickname = rawNickname.toLowerCase();
    const password = passwordInput.value.trim().toLowerCase();
    const file = fileInput.files[0];
    const serviceType = ((_a = document.querySelector('input[name="serviceType"]:checked')) == null ? void 0 : _a.value) || "";
    if (!nickname) {
      showError("formError", "Введите ник/клан.");
      return;
    }
    if (!password && !file && !invisibleNickCheckbox.checked && !rotationNickCheckbox.checked) {
      showError("formError", "Выберите хотя бы пароль или скин для оплаты");
      return;
    }
    const multiplier = getMultiplier();
    const passwordCost = password ? 1 : 0;
    const skinCost = file ? file.type === "image/gif" ? 2 : 1 : 0;
    const amount = (passwordCost + skinCost) * multiplier;
    const formData = new FormData;
    formData.append("name", nickname);
    formData.append("amount", amount);
    formData.append("serviceType", serviceType);
    if (password) formData.append("password", password);
    if (invisibleNickCheckbox.checked) formData.append("invisible", "1");
    if (rotationNickCheckbox.checked) formData.append("rotation", "1");
    const headers = {};
    if (getAccountToken()) {
      headers["Authorization"] = `Game ${getAccountToken()}`;
    }
    if (file) {
      if (file.type === "image/gif") {
        formData.append("image", file, file.name);
        await sendForm(formData, headers);
      } else {
        skinCanvas.toBlob(async blob => {
          if (!blob) {
            showError("formError", "Не удалось обработать изображение. Попробуйте другой файл.");
            return;
          }
          formData.append("image", blob, "skin.png");
          await sendForm(formData, headers);
        }, "image/png");
      }
    } else {
      await sendForm(formData, headers);
    }
  });
  async function sendForm(formData, headers = {}) {
    var _a;
    try {
      const res = await fetch("https://api.agar.su/create-payment", {
        method: "POST",
        headers,
        body: formData
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.warning) {
        showError("formError", data.warning, false);
        setTimeout(() => hideError("formError"), 8e3);
      }
      if ((_a = data == null ? void 0 : data.confirmation) == null ? void 0 : _a.confirmation_url) {
        showToast("Переходим к оплате...", "success");
        window.location.href = data.confirmation.confirmation_url;
      } else if (data == null ? void 0 : data.redirect) {
        showToast("Переходим к оплате...", "success");
        window.location.href = data.redirect;
      } else if (data == null ? void 0 : data.error) {
        showError("formError", `Ошибка: ${data.error.description || data.error}`, true);
      } else {
        showError("formError", "Неизвестная ошибка платежа.", true);
      }
    } catch (err) {
      console.error(err);
      showError("formError", "Ошибка соединения. Попробуйте позже.", true);
    }
  }
  var togglePassword = document.getElementById("togglePassword");
  var togglePasswordIcon = togglePassword == null ? void 0 : togglePassword.querySelector("i");
  togglePassword == null ? void 0 : togglePassword.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    togglePasswordIcon == null ? void 0 : togglePasswordIcon.classList.toggle("fa-eye");
    togglePasswordIcon == null ? void 0 : togglePasswordIcon.classList.toggle("fa-eye-slash");
  });
  invisibleNickCheckbox.addEventListener("change", calculateCost);
  rotationNickCheckbox.addEventListener("change", calculateCost);
  window.addEventListener("storage", event => {
    if (event.key === "accountToken") updateShopAuthNotice();
  });
  function openShopPurchase(nickname, options = {}) {
    if (typeof showContent === "function") showContent("shop");
    const isClan = !!options.clan;
    const personal = document.getElementById("personal");
    const clan = document.getElementById("clan");
    if (personal) personal.checked = !isClan;
    if (clan) clan.checked = isClan;
    updateNicknameDisplay();
    nicknameInput.value = String(nickname || "").trim();
    updateCharCount();
    hideError("nicknameError");
    nicknameInput.setCustomValidity("");
    isNicknameTaken = false;
    invisibleNickCheckbox.checked = !!options.invisible;
    rotationNickCheckbox.checked = !!options.rotation;
    if (options.focusPassword) {
      passwordInput.focus();
    } else {
      passwordInput.value = "";
      hideError("passwordError");
    }
    if (options.focusSkin) {
      fileInput.click();
    }
    calculateCost();
    nicknameInput.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
  window.openShopPurchase = openShopPurchase;
  window.updateShopAuthNotice = updateShopAuthNotice;
  onReady(() => {
    const nickInput = document.getElementById("nick");
    const passInput = document.getElementById("pass");
    if (!nickInput || !passInput) return;
    let allowedNicks = [];
    function normalizeNick2(nick) {
      if (!nick) return "";
      let n = nick.trim();
      const brackets = {
        "[": "]",
        "{": "}",
        "(": ")",
        "|": "|"
      };
      const firstChar = n.charAt(0);
      const lastChar = n.charAt(n.length - 1);
      if (brackets[firstChar]) {
        const closeChar = brackets[firstChar];
        const endIndex = n.indexOf(closeChar, 1);
        if (endIndex === -1) return "";
        const innerNick = n.substring(1, endIndex);
        if (!innerNick || innerNick.trim() !== innerNick) return "";
        n = innerNick;
      } else {
        if (!n || n.trim() !== n) return "";
      }
      return n.toLowerCase();
    }
    function setCookie2(name, value, days) {
      let expires = "";
      if (days) {
        const date = new Date;
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1e3);
        expires = "; expires=" + date.toUTCString();
      }
      document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/";
    }
    function getCookie2(name) {
      const nameEQ = name + "=";
      const ca = document.cookie.split(";");
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
      }
      return null;
    }
    function syncNickPassCookies(nick, pass) {
      if (nick) setCookie2("userNick", nick, 7); else setCookie2("userNick", "", -1);
      if (pass) setCookie2("userPass", pass, 7); else setCookie2("userPass", "", -1);
    }
    function checkNickStatus(nick) {
      const normalized = normalizeNick2(nick);
      if (allowedNicks.includes(normalized)) {
        passInput.style.display = "block";
      } else {
        passInput.style.display = "none";
      }
    }
    window.__agarsuCheckNickStatus = checkNickStatus;
    window.__agarsuSyncNickPassCookies = syncNickPassCookies;
    loadPassData().then(data => {
      allowedNicks = data.passUsers || [];
      const players = typeof window.__agarsuGetPlayers === "function" ? window.__agarsuGetPlayers() : [];
      if (players.length > 0) {
        checkNickStatus(nickInput.value.trim());
        return;
      }
      const savedNick = getCookie2("userNick");
      const savedPass = getCookie2("userPass");
      if (savedNick) {
        nickInput.value = savedNick;
        checkNickStatus(savedNick);
      }
      if (savedPass) {
        passInput.value = savedPass;
      }
    }).catch(error => {
      console.error("Ошибка при загрузке pass.txt:", error);
    });
    nickInput.addEventListener("input", () => {
      const currentNick = nickInput.value.trim();
      if (currentNick) {
        setCookie2("userNick", currentNick, 7);
      } else {
        setCookie2("userNick", "", -1);
        passInput.style.display = "none";
      }
      checkNickStatus(currentNick);
    });
    passInput.addEventListener("input", () => {
      const currentPass = passInput.value.trim();
      if (currentPass) {
        setCookie2("userPass", currentPass, 7);
      } else {
        setCookie2("userPass", "", -1);
      }
      if (typeof window.__agarsuUpdatePlayerPass === "function") {
        window.__agarsuUpdatePlayerPass(currentPass);
      }
    });
  });
  var getLevel2 = xp => ~~((xp / 100 * 2) ** .5);
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
    xstats.forEach(player => {
      const level = getLevel2(player.xp);
      const avatar = resolveAccountAvatar(player.account_avatar);
      const playerDiv = document.createElement("div");
      playerDiv.classList.add("top-player");
      playerDiv.innerHTML = `\n<div class="time">${player.position}</div>\n<div class="nick">${player.account_name}</div>\n<div class="score">${level}</div>\n<div class="skkinn" style="background-image: url('${avatar.replace(/'/g, "%27")}');"></div>\n                `;
      container.appendChild(playerDiv);
    });
  }
  async function fetchTop100() {
    try {
      const res = await fetch(TOP100_URL, {
        cache: "no-store"
      });
      if (!res.ok) throw new Error("top100 " + res.status);
      const data = await res.json();
      xpStats(data);
    } catch (err) {
      console.error("Error fetching top 100:", err);
    }
  }
  fetchTop100();
  function initVkAuthModule() {
    var _a;
    const PKCE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
    const VK_VERIFIER_KEY = "vk_code_verifier";
    const VK_STATE_KEY = "vk_state";
    function randomString(len) {
      const bytes = new Uint8Array(len);
      crypto.getRandomValues(bytes);
      let out = "";
      for (let i = 0; i < len; i++) out += PKCE_CHARS[bytes[i] % PKCE_CHARS.length];
      return out;
    }
    function persistPkce(codeVerifier, state) {
      try {
        sessionStorage.setItem(VK_VERIFIER_KEY, codeVerifier);
        sessionStorage.setItem(VK_STATE_KEY, state);
      } catch (e) {}
      try {
        localStorage.setItem(VK_VERIFIER_KEY, codeVerifier);
        localStorage.setItem(VK_STATE_KEY, state);
      } catch (e) {}
      try {
        setCookie(VK_VERIFIER_KEY, codeVerifier, 1);
        setCookie(VK_STATE_KEY, state, 1);
      } catch (e) {}
    }
    function readPkce() {
      const read = getter => {
        try {
          return getter();
        } catch (e) {
          return null;
        }
      };
      const codeVerifier = read(() => sessionStorage.getItem(VK_VERIFIER_KEY)) || read(() => localStorage.getItem(VK_VERIFIER_KEY)) || read(() => getCookie(VK_VERIFIER_KEY));
      const state = read(() => sessionStorage.getItem(VK_STATE_KEY)) || read(() => localStorage.getItem(VK_STATE_KEY)) || read(() => getCookie(VK_STATE_KEY));
      return {
        codeVerifier,
        state
      };
    }
    function clearPkce() {
      for (const key of [ VK_VERIFIER_KEY, VK_STATE_KEY ]) {
        try {
          sessionStorage.removeItem(key);
        } catch (e) {}
        try {
          localStorage.removeItem(key);
        } catch (e) {}
        try {
          deleteCookie(key);
        } catch (e) {}
      }
    }
    function vkidOnError(error) {
      console.error("VK ID error:", error);
      const msg = (error == null ? void 0 : error.error_description) || (error == null ? void 0 : error.error) || (error == null ? void 0 : error.text) || (typeof error === "string" ? error : "Ошибка входа VK");
      alert("VK: " + msg);
    }
    function sendCodeToServer(code, deviceId) {
      const {codeVerifier, state} = readPkce();
      if (!codeVerifier || !state) {
        alert("VK: сессия истекла, обновите страницу");
        return;
      }
      if (typeof window.onVkAuth !== "function") {
        alert("VK: страница ещё не готова, обновите и попробуйте снова");
        return;
      }
      clearPkce();
      window.onVkAuth({
        code,
        device_id: deviceId,
        code_verifier: codeVerifier,
        state
      });
    }
    function initVkAuth() {
      var _a2;
      if (!("VKIDSDK" in window)) return;
      const VKID = window.VKIDSDK;
      const container = document.getElementById("VkIdSdkOAuthList") || document.getElementById("VkIdSdkOneTap");
      if (!container) return;
      const urlParams = new URLSearchParams(window.location.search);
      const codeFromUrl = urlParams.get("code");
      const deviceFromUrl = urlParams.get("device_id");
      if (codeFromUrl && deviceFromUrl) {
        sendCodeToServer(codeFromUrl, deviceFromUrl);
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
        return;
      }
      const codeVerifier = randomString(64);
      const state = randomString(32);
      persistPkce(codeVerifier, state);
      const sameWindow = prefersSameWindowAuth();
      const config = {
        app: 54069355,
        redirectUrl: "https://agar.su",
        state,
        codeVerifier,
        responseMode: sameWindow ? VKID.ConfigResponseMode.Redirect : VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: ""
      };
      if (sameWindow && ((_a2 = VKID.ConfigAuthMode) == null ? void 0 : _a2.Redirect)) {
        config.mode = VKID.ConfigAuthMode.Redirect;
      }
      VKID.Config.init(config);
      const oauthListNames = [ VKID.OAuthName.VK, VKID.OAuthName.MAIL, VKID.OAuthName.OK ];
      (new VKID.OAuthList).render({
        container,
        oauthList: oauthListNames,
        scheme: VKID.Scheme.LIGHT,
        lang: VKID.Languages.RUS,
        styles: {
          height: 44,
          borderRadius: 8
        }
      }).on(VKID.WidgetEvents.ERROR, vkidOnError).on(VKID.OAuthListInternalEvents.LOGIN_SUCCESS, function(payload) {
        sendCodeToServer(payload.code, payload.device_id);
      });
    }
    if ("VKIDSDK" in window) {
      initVkAuth();
    } else {
      (_a = document.querySelector('script[src*="vkid-sdk"]')) == null ? void 0 : _a.addEventListener("load", initVkAuth);
    }
  }
  window.initVkAuthModule = initVkAuthModule;
  function isEmbedMode() {
    try {
      if (new URLSearchParams(location.search).has("embed")) return true;
    } catch (e) {}
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }
  function isAuthorized() {
    try {
      return Boolean(getAccountToken());
    } catch (e) {
      return false;
    }
  }
  function loadScript(src, attrs = {}) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }
  function setupYandexAds() {
    window.yaContextCb = window.yaContextCb || [];
    function renderHomeBanner() {
      if (!document.getElementById("yandex_rtb_R-A-15699059-13")) {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", renderHomeBanner, {
            once: true
          });
        }
        return;
      }
      try {
        Ya.Context.AdvManager.render({
          blockId: "R-A-15699059-13",
          renderTo: "yandex_rtb_R-A-15699059-13"
        });
      } catch (e) {}
    }
    window.renderDeathBanner = function() {
      const el = document.getElementById("yandex_rtb_R-A-15699059-14");
      if (!el) return;
      const doRender = () => {
        try {
          el.innerHTML = "";
          Ya.Context.AdvManager.render({
            blockId: "R-A-15699059-14",
            renderTo: "yandex_rtb_R-A-15699059-14"
          });
        } catch (e) {}
      };
      if (window.Ya && Ya.Context && Ya.Context.AdvManager) {
        doRender();
      } else {
        window.yaContextCb = window.yaContextCb || [];
        window.yaContextCb.push(doRender);
      }
    };
    window.yaContextCb.push(renderHomeBanner);
    return loadScript("https://yandex.ru/ads/system/context.js").catch(() => {});
  }
  function setupMailRuCounter() {
    window._tmr = window._tmr || [];
    window._tmr.push({
      id: "3773988",
      type: "pageView",
      start: (new Date).getTime()
    });
    return loadScript("https://top-fwz1.mail.ru/js/code.js", {
      id: "tmr-code"
    }).catch(() => {});
  }
  function scheduleDeferredExternals() {
    if (!window.renderDeathBanner) {
      window.renderDeathBanner = function() {};
    }
    if (isEmbedMode()) {
      document.documentElement.classList.add("agarsu-embed");
    }
    const run = () => {
      setupYandexAds();
      if (!isAuthorized()) {
        setupMailRuCounter();
      }
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, {
        timeout: 2500
      });
    } else {
      setTimeout(run, 1200);
    }
  }
  function loadScript2(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (src.includes("vkid") && window.VKIDSDK) return resolve();
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", reject);
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.crossOrigin = "anonymous";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }
  async function ensureVkSdk() {
    if (window.VKIDSDK) return true;
    if (isEmbedMode()) return false;
    const host = location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return false;
    try {
      await loadScript2("/vendor/vkid-sdk.umd.js");
      if (window.VKIDSDK) return true;
    } catch (e) {}
    log.warn("VK ID SDK unavailable");
    return false;
  }
  async function boot() {
    window.renderDeathBanner = window.renderDeathBanner || function() {};
    hydrateAccountToken();
    const vkOk = await ensureVkSdk();
    initGame(window);
    initLobbyUi();
    if (vkOk) {
      initVkAuthModule();
    }
    bus.emit(Events.SHOW_CONTENT, {
      id: "home"
    });
    scheduleDeferredExternals();
    log.info("Agar.su low-client ready");
  }
  boot().catch(err => {
    console.error("Boot failed:", err);
  });
})();
