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
  var SERVERS = {};
  var REGION_CONFIGS = {};
  function readServersFromHtml() {
    const regions = {};
    document.querySelectorAll(".server-item[data-ip]").forEach(item => {
      const region = item.dataset.region || "ru";
      const key = item.dataset.serverKey || item.id;
      if (!key) return;
      if (!regions[region]) regions[region] = { label: region === "tr" ? "Турция" : region === "eu" ? "Европа" : "Россия", available: true, servers: {} };
      regions[region].servers[key] = { host: item.dataset.ip, title: item.dataset.title || item.querySelector(".server-name")?.textContent.trim() || key };
    });
    REGION_CONFIGS = regions;
    return regions;
  }
  var activeRegion = null;
  function getDefaultRegion() {
    try { let saved = localStorage.getItem("agar_region"); if (saved === "nl") saved = "tr"; if (saved && REGION_CONFIGS[saved]) return saved; } catch (e) {}
    const browserLanguage = String((navigator && (navigator.language || navigator.userLanguage)) || "").toLowerCase();
    return browserLanguage.startsWith("ru") ? "ru" : "tr";
  }
  function findGameServer(hostOrUrl) {
    if (!hostOrUrl) return null;
    return Object.values(REGION_CONFIGS).flatMap(region => Object.values(region.servers)).find(server => server.host === hostOrUrl) || null;
  }
  function getPowApiBase(hostOrUrl) {
    const entry = findGameServer(hostOrUrl);
    let host = entry ? entry.host : hostOrUrl || "ffa.agar.su";
    host = String(host || "").replace(/^wss?:\/\//i, "");
    // strip room path: xn--bdk.pw:6014/dparty → xn--bdk.pw:6014
    const slash = host.indexOf("/");
    if (slash > 0) host = host.slice(0, slash);
    if (/^https?:\/\//i.test(host)) return String(host).replace(/\/$/, "");
    return "https://" + host;
  }
  function getGameServerWssUrl(host) {
    const h = host || "ffa.agar.su";
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
  var ONLINE_HUB_URL = "https://api.agar.su/online";//2
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
    word: "https://api.agar.su/word.txt"
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
  var SKIN_IMAGE_CACHE_GEN = 4;
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
    const cacheKey = SKIN_IMAGE_CACHE_GEN + "\0" + url;
    const entry = skinImageCache.get(cacheKey);
    if (entry instanceof Image) return entry;
    if (entry === "error") {
      if (url === SKIN_FALLBACK_URL) return null;
      return loadCachedImage(SKIN_FALLBACK_URL);
    }
    const img = new Image;
    img.decoding = "async";
    if (/^https?:\/\//i.test(url)) img.crossOrigin = "anonymous";
    skinImageCache.set(cacheKey, img);
    img.onload = () => skinImageCache.set(cacheKey, img);
    img.onerror = () => {
      skinImageCache.set(cacheKey, "error");
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
  let touchDeviceDetected = false;
  function setTouchDeviceDetected(v) {
    touchDeviceDetected = v;
  }
  function updateTouchButtonsVisibility() {
    const el = byId("touch-buttons");
    if (!el) return;
    if (touchDeviceDetected && !isOverlaysVisible()) {
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }
  function showOverlays() {
    const el = byId("overlays");
    showElement(el);
    onOverlaysShow == null ? void 0 : onOverlaysShow();
    updateTouchButtonsVisibility();
  }
  function hideOverlays() {
    const el = byId("overlays");
    hideElement(el);
    onOverlaysHide == null ? void 0 : onOverlaysHide();
    updateTouchButtonsVisibility();
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
  function normalizeSpectateNick(name) {
    return String(name || "").trim().toLowerCase();
  }
  function findSpectateHit(S, wx, wy) {
    let best = null;
    let bestSize = Infinity;
    const list = S.nodelist || [];
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (!node || node.destroyed || node.isOwn || node.isFood || node.isVirus || node.isEjected) continue;
      if (!node.name && !(node.playerId > 0)) continue;
      const dx = node.x - wx;
      const dy = node.y - wy;
      const r = node.size || 0;
      if (r <= 0) continue;
      if (dx * dx + dy * dy < r * r && r < bestSize) {
        best = node;
        bestSize = r;
      }
    }
    return best;
  }
  function collectSpectateFollowCells(S) {
    const nick = S.spectateFollowNick;
    const pid = S.spectateFollowPid | 0;
    if (!nick && !pid) return [];
    const out = [];
    const list = S.nodelist || [];
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (!node || node.destroyed || node.isFood || node.isVirus || node.isEjected) continue;
      if (pid && (node.playerId | 0) === pid) {
        out.push(node);
        continue;
      }
      if (nick && normalizeSpectateNick(node.name) === nick) out.push(node);
    }
    return out;
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
    if (S.bgCanvas) {
      S.bgCanvas.width = S.canvasWidth;
      S.bgCanvas.height = S.canvasHeight;
      S.bgCanvas.style.width = `${wHandle.innerWidth}px`;
      S.bgCanvas.style.height = `${wHandle.innerHeight}px`;
    }
    if (S.glCanvas && S.webglRenderer) {
      S.webglRenderer.resize(S.canvasWidth, S.canvasHeight, wHandle.innerWidth, wHandle.innerHeight);
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
    visible: 0,
    movePoints: 0
  };
  function ensureRenderLayers(S) {
    if (S._renderLayersReady) return;
    const stage = document.getElementById("canvas-stage");
    if (!stage || !S.nCanvas) return;
    S._renderLayersReady = true;
    if (typeof createAgarWebGLRenderer !== "function") return;
    const bg = document.createElement("canvas");
    bg.id = "canvas-bg";
    stage.insertBefore(bg, S.nCanvas);
    S.bgCanvas = bg;
    S.bgCtx = bg.getContext("2d", { alpha: false });
    const glCanvas = document.createElement("canvas");
    glCanvas.id = "canvas-gl";
    stage.insertBefore(glCanvas, S.nCanvas);
    S.glCanvas = glCanvas;
    S.webglRenderer = createAgarWebGLRenderer(glCanvas);
    if (S.webglRenderer && S.webglRenderer.active) {
      S.nCanvas.style.background = "transparent";
      if (S.ctx) {
        // Re-acquire with alpha so clearRect reveals WebGL fills underneath
        S.ctx = S.nCanvas.getContext("2d", { alpha: true }) || S.ctx;
      }
      S.spatialGrid = S.webglRenderer.spatial || (typeof createAgarSpatialGrid === "function" ? createAgarSpatialGrid(512) : null);
    }
  }
  function collectVisibleNodes(S) {
    if (!S._visibleNodes) S._visibleNodes = [];
    const visible = S._visibleNodes;
    visible.length = 0;
    const list = S.nodelist;
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (!node || node.destroyed) continue;
      if (node.shouldRender()) visible.push(node);
    }
    return visible;
  }
  function sortVisibleNodes(visible) {
    // Stable z-order by target size + id (interpolated size flickered z-order every frame)
    visible.sort((a, b) => (a.nSize || a.size) - (b.nSize || b.size) || a.id - b.id);
  }
  function updateCellSkinAnim(node, S) {
    if (typeof node.skinZoom === "undefined") node.skinZoom = 1;
    if (typeof node.skinPhase === "undefined") node.skinPhase = 0;
    if (node.glowActive && S.showGlow) {
      node.skinPhase += .05;
      const targetZoom = 1 + Math.abs(Math.sin(node.skinPhase)) * .08;
      node.skinZoom += (targetZoom - node.skinZoom) * .1;
    } else {
      node.skinZoom += (1 - node.skinZoom) * .05;
      node.skinPhase = 0;
    }
  }
  function updateCellRotation(node, rotationSet, skinName) {
    if (!rotationSet.has(skinName)) return 0;
    if (!node._rot) {
      node._rot = {
        target: 0,
        current: 0,
        lastAngle: null
      };
    }
    const vx = node.nx - node.ox;
    const vy = node.ny - node.oy;
    let rawAngle;
    if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) {
      rawAngle = node._rot.lastAngle != null ? node._rot.lastAngle : node._rot.current;
    } else {
      rawAngle = Math.atan2(vy, vx);
    }
    if (node._rot.lastAngle == null) {
      node._rot.lastAngle = rawAngle;
      node._rot.target = rawAngle;
      node._rot.current = rawAngle;
    } else {
      let d = rawAngle - node._rot.lastAngle;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      node._rot.target += d;
      node._rot.lastAngle = rawAngle;
    }
    node._rot.current += (node._rot.target - node._rot.current) * .12;
    return node._rot.current;
  }
  function packWebGLFrame(S, renderer, visible, view) {
    const transparent = S.transparent || new Set;
    const invisible = S.invisible || new Set;
    const rotation = S.rotation || new Set;
    const skinList = S.skinList || {};
    const showSkin = S.showSkin;
    const showName = S.showName;
    const showMass = S.showMass && S.renderQuality !== "low";
    const noBorder = S.closebord || S.renderQuality === "low";
    const nameStroke = S.renderQuality !== "low";
    const parseColor = renderer.parseColor;
    const getSkinImage2 = getSkinImage;
    const normalizeNick2 = normalizeNick;
    const now = Date.now();
    let maxDepth = 1;
    for (let i = 0; i < visible.length; i++) {
      const sz = visible[i].nSize || visible[i].size || 1;
      if (sz > maxDepth) maxDepth = sz;
    }
    view.maxSize = maxDepth;

    for (let i = 0; i < visible.length; i++) {
      const node = visible[i];
      if (node._posFrame !== S.frameId) {
        node.updatePos();
        node._posFrame = S.frameId;
      }
      let renderSize = node.size || 20;
      const cellDepth = node.nSize || node.size || renderSize;
      const isTransp = showSkin && transparent.has(node.name);
      if (!isTransp) {
        const rgba = parseColor(node.getEffectiveColor());
        const r = rgba[0], g = rgba[1], b = rgba[2];
        if (!noBorder) {
          renderer.pushRim(node.x, node.y, renderSize + 5, r * 0.9, g * 0.9, b * 0.9, 1, cellDepth + 0.02);
        }
        renderer.pushCircle(node.x, node.y, renderSize, r, g, b, 1, cellDepth);
      } else if (!noBorder) {
        const rgba = parseColor(node.getEffectiveColor());
        renderer.pushRim(node.x, node.y, renderSize + 5, rgba[0] * 0.9, rgba[1] * 0.9, rgba[2] * 0.9, 1, cellDepth + 0.02);
      }
      if (showSkin && !node.isVirus && !node.isFood && node.name) {
        const skinName = node._skinNameKey != null ? node._skinNameKey : normalizeNick2(node.name);
        if (node._skinNameKey !== skinName) {
          node._skinNameKey = skinName;
          node._skinId = skinList[skinName] || null;
        }
        const skinId = node._skinId;
        if (skinId) {
          const skinImg = getSkinImage2(skinId);
          if (skinImg && skinImg.complete && skinImg.width > 0) {
            updateCellSkinAnim(node, S);
            const fw = skinImg.width;
            const fh = skinImg.height;
            const frame = fw > fh ? Math.floor(now / 100 % Math.floor(fw / fh)) : 0;
            const uv = renderer.ensureSkin(String(skinId), skinImg, frame);
            if (uv) {
              const angle = updateCellRotation(node, rotation, skinName);
              const z = Math.max(1, node.skinZoom || 1);
              const sz = renderSize;
              // UV zoom = old canvas clip + oversized skin draw
              const u0 = uv.u0, v0 = uv.v0, u1 = uv.u1, v1 = uv.v1;
              const uMid = (u0 + u1) * 0.5, vMid = (v0 + v1) * 0.5;
              const uHalf = (u1 - u0) * 0.5 / z, vHalf = (v1 - v0) * 0.5 / z;
              renderer.pushSkin(node.x, node.y, sz, angle, uMid - uHalf, vMid - vHalf, uMid + uHalf, vMid + vHalf, 1, cellDepth);
            }
          }
        }
      }
      if (!node.isFood && node.id !== 0) {
        const textDepth = cellDepth + 0.15;
        if (showName && node.name && node.size > 10) {
          let displayName = node.name;
          if (invisible.has(String(node.name).toLowerCase())) displayName = "";
          if (displayName) {
            const nameSize = Math.max(~~(.3 * node.size), 24);
            renderer.pushText(displayName, node.x, node.y, nameSize, node.size * 2, nameStroke, textDepth);
          }
        }
        if (showMass && !node.isVirus && !node.isEjected && !node.isAgitated && node.size > 100) {
          const massVal = String(Math.floor(node.size * node.size * .01));
          const massSize = Math.max(~~(.15 * node.size), 12);
          const nameSize = Math.max(~~(.3 * node.size), 24);
          const massLineH = massSize * 1.15;
          const massY = node.y + nameSize * 0.65 + massLineH * 0.5;
          renderer.pushText(massVal, node.x, massY, massSize, 0, true, textDepth);
        }
      }
    }
    renderer.flush(view);
  }
  function drawFoodBatch2D(ctx, S, visible) {
    const byColor = new Map;
    const showSkin = S.showSkin;
    const transparent = S.transparent || new Set;
    for (let i = 0; i < visible.length; i++) {
      const node = visible[i];
      if (!node.isFood) continue;
      if (node._posFrame !== S.frameId) node.updatePos();
      const isTransp = showSkin && transparent.has(node.name);
      const color = isTransp ? "rgba(0,0,0,0)" : node.getEffectiveColor();
      if (color === "rgba(0,0,0,0)") continue;
      let arr = byColor.get(color);
      if (!arr) {
        arr = [];
        byColor.set(color, arr);
      }
      arr.push(node);
    }
    for (const [color, nodes] of byColor) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let j = 0; j < nodes.length; j++) {
        const n = nodes[j];
        const r = n.size || 20;
        ctx.moveTo(n.x + r, n.y);
        ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      }
      ctx.fill();
    }
  }
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
    perfOverlayEl.textContent = `FPS ${S.fps}\nnodes ${perfStats.nodes} visible ${perfStats.visible} overlay ${perfStats.drawn}\nsort ${perfStats.sortMs.toFixed(2)}ms draw ${perfStats.drawMs.toFixed(2)}ms\nspatial ${S.spatialGrid ? "on" : "off"} gl ${S.webglRenderer && S.webglRenderer.active ? "on" : "off"}\nzoom ${(_a = S.viewZoom) == null ? void 0 : _a.toFixed(2)} cells ${((_b = S.playerCells) == null ? void 0 : _b.length) || 0}`;
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
  centerBackground.src = "/photo/center.png";
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
    S.qTree = null;
    if (perfEnabled) perfStats.qtreeMs = performance.now() - t0;
    return;
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
      if (S.spectateFollowNick || S.spectateFollowPid) {
        S.spectateFollowNick = null;
        S.spectateFollowPid = 0;
        if (S._spectateFollowTimer) {
          clearInterval(S._spectateFollowTimer);
          S._spectateFollowTimer = null;
        }
      }
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
      const follow = collectSpectateFollowCells(S);
      if (follow.length) {
        let sumX = 0;
        let sumY = 0;
        for (let i = 0; i < follow.length; i++) {
          const cell = follow[i];
          if (cell._posFrame !== S.frameId) cell.updatePos();
          cell._posFrame = S.frameId;
          sumX += cell.x;
          sumY += cell.y;
        }
        S.posX = sumX / follow.length;
        S.posY = sumY / follow.length;
      } else if (!S.mapBoundsReady && !S.spectateFollowNick && !S.spectateFollowPid) {
        S.posX = (S.leftPos + S.rightPos) / 2;
        S.posY = (S.topPos + S.bottomPos) / 2;
      }
      S.nodeX = (29 * S.nodeX + S.posX) / 30;
      S.nodeY = (29 * S.nodeY + S.posY) / 30;
      S.viewZoom = (9 * S.viewZoom + S.posSize * viewRange(S)) / 10;
    }
    buildQTree();
    mouseCoordinateChange(S);
    if (S.nodesSortDirty !== false) {
      const tSort = perfEnabled ? performance.now() : 0;
      if (!(S.webglRenderer && S.webglRenderer.active)) {
        S.nodelist.sort((a, b) => a.size - b.size || a.id - b.id);
      }
      S.nodesSortDirty = false;
      S._spatialDirty = true;
      if (perfEnabled) perfStats.sortMs = performance.now() - tSort;
    } else if (perfEnabled) {
      perfStats.sortMs = 0;
    }
    perfStats.nodes = S.nodelist.length;
    const visible = collectVisibleNodes(S);
    sortVisibleNodes(visible);
    perfStats.visible = visible.length;
    perfStats.drawn = 0;
    if (perfEnabled) S._perfMovePoints = 0;
    const {ctx, canvasWidth, canvasHeight, viewZoom, nodeX, nodeY} = S;
    const useWebGL = !!(S.webglRenderer && S.webglRenderer.active);
    const tDraw = perfEnabled ? performance.now() : 0;
    if (useWebGL) {
      const savedCtx = S.ctx;
      S.ctx = S.bgCtx;
      drawGrid();
      drawCenterBackground();
      S.bgCtx.save();
      S.bgCtx.translate(canvasWidth / 2, canvasHeight / 2);
      S.bgCtx.scale(viewZoom, viewZoom);
      S.bgCtx.translate(-nodeX, -nodeY);
      drawCustomMapBackground(S.bgCtx);
      S.bgCtx.restore();
      S.ctx = savedCtx;
      const gl = S.webglRenderer;
      const glView = {
        nodeX,
        nodeY,
        viewZoom,
        width: canvasWidth,
        height: canvasHeight
      };
      gl.clear();
      gl.reset();
      packWebGLFrame(S, gl, visible, glView);
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.save();
      ctx.translate(canvasWidth / 2, canvasHeight / 2);
      ctx.scale(viewZoom, viewZoom);
      ctx.translate(-nodeX, -nodeY);
      for (let i = 0; i < visible.length; i++) {
        const node = visible[i];
        if (node.isFood) continue;
        node.drawRareOverlay(ctx);
      }
      perfStats.drawn = visible.length;
      ctx.restore();
    } else {
      drawGrid();
      drawCenterBackground();
      ctx.save();
      ctx.translate(canvasWidth / 2, canvasHeight / 2);
      ctx.scale(viewZoom, viewZoom);
      ctx.translate(-nodeX, -nodeY);
      drawCustomMapBackground(ctx);
      drawFoodBatch2D(ctx, S, visible);
      for (let i = 0; i < visible.length; i++) {
        const node = visible[i];
        if (node.isFood) continue;
        node.drawOneCell(ctx, false);
        perfStats.drawn++;
      }
      ctx.restore();
    }
    if (perfEnabled) {
      perfStats.drawMs = performance.now() - tDraw;
      perfStats.movePoints = S._perfMovePoints || 0;
      perfStats.frame = S.frameId;
      updatePerfOverlay(S);
    }
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
    if (!(S == null ? void 0 : S.ctx)) return;
    // Неофициальный сервер: без center.png / рекорда в центре карты
    if (document.body.classList.contains("no-official-stats")) return;
    if (!isBackgroundLoaded) return;
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
  var TOURNAMENT_PLAYERS = ["Vaas","Mnrve"];
  var TOURNAMENT_WINNERS = ["Vaas","Mnrve"];
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
  function renderLeaderboardName(container, name) {
    const value = String(name || "");
    const streakPattern = /\*(\d+)\*/g;
    let lastIndex = 0;
    let match;
    while ((match = streakPattern.exec(value)) !== null) {
      if (match.index > lastIndex) {
        container.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
      }
      const streak = document.createElement("span");
      streak.title = "Серия побед подряд";
      streak.className = "streak";
      streak.textContent = match[1];
      container.appendChild(streak);
      lastIndex = streakPattern.lastIndex;
    }
    if (lastIndex < value.length) {
      container.appendChild(document.createTextNode(value.slice(lastIndex)));
    }
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
    const chatBackgrounds = (S == null ? void 0 : S.chatBackgrounds) || [];
    if (!isSystemLine && chatBackgrounds.includes(lowerName)) {
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
    nameSpan.className = "Lednick-name";
    renderLeaderboardName(nameSpan, name);
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
        nameSpan.dataset.hasPass = "1";
        nameSpan.dataset.passId = String(passId);
        nameSpan.dataset.passClan = clanPassId ? "1" : "0";
        nameSpan.title = clanPassId ? "ПКМ — статистика клана" : "ПКМ — статистика игрока";
        nameSpan.style.cursor = "pointer";
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
      return urlParams.has("spect") || urlParams.has("spectator") || hash.includes("?spect") || hash.includes("?spectator");
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
      const spectating = !S.playerCells.length;
      // Freeze: mouse on main cell center (0,0 of primary cell)
      if (S.freeze && !spectating && S.playerCells.length) {
        const main = S.playerCells[0];
        if (main) {
          S.posX = main.x;
          S.posY = main.y;
        }
      }
      // Spectate: overview follows camera aim (posX), not free cursor
      if (S.freeze || spectating) {
        if (!(Math.abs(S.oldX - S.posX) < .05 && Math.abs(S.oldY - S.posY) < .05)) {
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
    function isIncompletePrivateChat(str) {
      const s = String(str || "").trim();
      if (!s || !/^!ls/i.test(s)) return false;
      // Valid PM: !ls<id> <non-empty message>. Bare !ls1223 must not go to public chat.
      return !/^!ls\d+\s+\S/i.test(s);
    }
    function sendChat(str) {
      if (isIncompletePrivateChat(str)) return;
      str = appendChatLangTag(str);
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
    S._spatialDirty = true;
  }
  function ensureStickerState(S) {
    if (!S.activeStickersByNode) S.activeStickersByNode = Object.create(null);
    if (!S.activeStickersByName) S.activeStickersByName = Object.create(null);
  }
  function stickerNameKey(name) {
    return String(name || "").trim().toLowerCase();
  }
  function setNodeSticker(node, stickerId) {
    if (!node) return;
    if (stickerId) {
      node.currentSticker = stickerId;
      node.stickerActive = true;
    } else {
      node.currentSticker = null;
      node.stickerActive = false;
    }
  }
  function rememberSticker(S, nodeId, name, stickerId) {
    ensureStickerState(S);
    if (stickerId) {
      if (nodeId != null) S.activeStickersByNode[nodeId] = stickerId;
      const key = stickerNameKey(name);
      if (key) S.activeStickersByName[key] = stickerId;
    } else {
      if (nodeId != null) delete S.activeStickersByNode[nodeId];
      const key = stickerNameKey(name);
      if (key) delete S.activeStickersByName[key];
    }
  }
  function resolveRememberedSticker(S, nodeId, name) {
    ensureStickerState(S);
    if (nodeId != null && S.activeStickersByNode[nodeId]) return S.activeStickersByNode[nodeId];
    const key = stickerNameKey(name);
    if (key && S.activeStickersByName[key]) return S.activeStickersByName[key];
    return null;
  }
  /**
   * UpdateNodes хвост: FF+id = стикер вкл, 00 = выкл.
   * Свои клетки — только пока зажата клавиша (анти-мерцание/залипание у себя).
   * Чужие: 00 обязательно гасит (иначе 2-я вкладка видит стикер после отпускания).
   */
  function syncNodeStickerFromUpdate(S, node, name, stickerFromUpdate) {
    if (!node) return;
    const n = name || node.name || "";
    if (node.isOwn) {
      if (S.localStickerHeld && S.localStickerId) {
        setNodeSticker(node, S.localStickerId);
      } else {
        setNodeSticker(node, null);
      }
      return;
    }
    if (stickerFromUpdate) {
      rememberSticker(S, node.id, n, stickerFromUpdate);
      setNodeSticker(node, stickerFromUpdate);
      return;
    }
    if (stickerFromUpdate === false) {
      rememberSticker(S, node.id, n, null);
      setNodeSticker(node, null);
      return;
    }
    const remembered = resolveRememberedSticker(S, node.id, n);
    if (remembered) setNodeSticker(node, remembered);
  }
  /** Пакет STICKER — явное вкл/выкл. Для своих ignore «on», если клавиша уже отпущена (анти-залипание). */
  function applyStickerPacket(S, stickerPlayerId, stickerId, enabled) {
    ensureStickerState(S);
    let refName = null;
    let isOwnPacket = stickerPlayerId === S.ownerPlayerId;
    for (let i = 0; i < S.nodelist.length; i++) {
      const node = S.nodelist[i];
      if (node && node.id === stickerPlayerId) {
        refName = node.name || null;
        if (node.isOwn) isOwnPacket = true;
        break;
      }
    }
    if (isOwnPacket) {
      if (enabled && !S.localStickerHeld) return;
      if (!enabled) {
        S.localStickerHeld = false;
        S.localStickerId = null;
      }
      for (let i = 0; i < S.playerCells.length; i++) {
        const cell = S.playerCells[i];
        if (!cell) continue;
        if (!refName && cell.name) refName = cell.name;
        setNodeSticker(cell, enabled && S.localStickerHeld ? stickerId : null);
      }
      if (!enabled) {
        const nameKey = stickerNameKey(refName);
        delete S.activeStickersByNode[stickerPlayerId];
        if (nameKey) delete S.activeStickersByName[nameKey];
        for (let i = 0; i < S.playerCells.length; i++) {
          const cell = S.playerCells[i];
          if (cell) rememberSticker(S, cell.id, cell.name, null);
        }
      }
      return;
    }
    const nameKey = stickerNameKey(refName);
    if (enabled) {
      if (stickerPlayerId != null) S.activeStickersByNode[stickerPlayerId] = stickerId;
      if (nameKey) S.activeStickersByName[nameKey] = stickerId;
    } else {
      delete S.activeStickersByNode[stickerPlayerId];
      if (nameKey) delete S.activeStickersByName[nameKey];
    }
    for (let i = 0; i < S.nodelist.length; i++) {
      const node = S.nodelist[i];
      if (!node || node.isOwn || node.isFood || node.isVirus || node.isEjected) continue;
      const hit = node.id === stickerPlayerId || nameKey && stickerNameKey(node.name) === nameKey;
      if (!hit) continue;
      rememberSticker(S, node.id, node.name, enabled ? stickerId : null);
      setNodeSticker(node, enabled ? stickerId : null);
    }
  }
  function updateNodes(S, reader, hooks) {
    const {Cell: Cell2, onPlayerDeath} = hooks;
    S.timestamp = Date.now();
    S.ua = false;
    S.nodesSortDirty = true;
    S._spatialDirty = true;
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
      // Хвост протокола: FF+id (стикер есть) или 00 (в этом апдекте нет).
      // Источник истины — пакет STICKER + карта activeStickers*: байт 00 НЕ сбрасывает
      // активный стикер (иначе у всех мерцает главная клетка на каждом тике).
      let stickerFromUpdate = null;
      if (reader.canRead) {
        const marker = reader.uint8();
        if (marker === 255) {
          stickerFromUpdate = reader.uint8() || null;
        } else if (marker === 0) {
          stickerFromUpdate = false;
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
      if (node) {
        syncNodeStickerFromUpdate(S, node, name, stickerFromUpdate);
      }
      node.isVirus = flagVirus;
      node.isEjected = flagEjected;
      node.isAgitated = flagAgitated;
      if (type === 1 || type === 4) node.isFood = true; // type4 = AgarZ/Petri food w/ coords
      if (type === 0 && playerId) node.playerId = playerId >>> 0;
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
    S.activeStickersByNode = Object.create(null);
    S.activeStickersByName = Object.create(null);
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
        // CLEAR alone wiped playerCells without S.ua → death screen skipped (AgarZ)
        if (S.playerCells.length > 0) {
          S.ua = true;
          S.freeze = false;
          try {
            const freezeEl = document.querySelector("#freeze");
            if (freezeEl) freezeEl.style.display = "none";
          } catch (_) {}
          S.playerCells = [];
          if (S._spectateFollowTimer) {
            clearInterval(S._spectateFollowTimer);
            S._spectateFollowTimer = null;
          }
          S.spectateFollowNick = null;
          S.spectateFollowPid = 0;
          showStatics();
          if (typeof window.updateShareText === "function") {
            try { window.updateShareText(S); } catch (_) {
              try { window.updateShareText(); } catch (_) {}
            }
          }
          if (typeof window.renderDeathBanner === "function") window.renderDeathBanner();
        } else {
          S.playerCells = [];
        }
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
            S.oldX = S.posX - 999;
            S.oldY = S.posY - 999;
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
          applyStickerPacket(S, stickerPlayerId, stickerId, stickerAction === 1);
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
      spectateFollowNick: null,
      spectateFollowPid: 0,
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
        const q = readStored("render_quality", "low");
        return q === "low" || q === "medium" ? q : "high";
      })(),
      smoothRender: 2,
      closebord: false,
      enableMouseClicks: false,
      spectateAutoFollow: false,
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
      uiTouchIds: null,
      localStickerHeld: false,
      localStickerId: null,
      activeStickersByNode: Object.create(null),
      activeStickersByName: Object.create(null),
      lastStatsRenderKey: "",
      pointsLabel: null,
      Quad: null,
      donators: null,
      chatBackgrounds: null,
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
  var DEFAULT_TRANSPARENT = [ "liqwid", "⟨本⟩ Itana.", "†Ĵώâ4ќâ†","g","Uroboros","ww"];
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
      S._spatialDirty = true;
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
      return 0;
    },
    createPoints() {},

    movePoints() {},

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
    drawSkinOverlay(ctx) {
      var _a, _b;
      const S = deps3.S;
      if (this.isFood || this.isVirus || !S.showSkin || !this.name) return false;
      if (this._posFrame !== S.frameId) {
        this.updatePos();
        this._posFrame = S.frameId;
      }
      const getSkinImage2 = deps3.getSkinImage || getSkinImage;
      const normalizeNickFn = deps3.normalizeNick || normalizeNick;
      const rotation = S.rotation || new Set;
      const skinList = S.skinList || {};
      const renderSize = this.size || 20;
      const skinName = (_a = this._skinNameKey) != null ? _a : normalizeNickFn(this.name);
      if (this._skinNameKey !== skinName) {
        this._skinNameKey = skinName;
        this._skinId = skinList[skinName] || null;
      }
      const skinId = this._skinId;
      if (!skinId) return false;
      const skinImg = getSkinImage2(skinId);
      if (!skinImg || !skinImg.complete || !skinImg.width) return false;
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, renderSize, 0, 2 * Math.PI);
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
      const sz = renderSize * this.skinZoom;
      if (rotation.has(skinName)) {
        if (!this._rot) {
          this._rot = { target: 0, current: 0, lastAngle: null };
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
      return true;
    },
    drawRareOverlay(ctx) {
      const S = deps3.S;
      if (this.isFood) return false;
      if (this._posFrame !== S.frameId) {
        this.updatePos();
        this._posFrame = S.frameId;
      }
      let renderSize = this.size || 20;
      const bigPointSize = this.size;
      const transparent = S.transparent || new Set;
      const isTransp = S.showSkin && transparent.has(this.name);
      const loadCachedImage2 = deps3.loadCachedImage || loadCachedImage;
      let drew = false;
      const mass = Math.floor(this.size * this.size * .01);
      if (typeof this.glowActive === "undefined") this.glowActive = false;
      const _hostA = String(S.CONNECTION_URL || S.currentWebSocketUrl || S.wsUrl || "");
      const glowMassA = (typeof getLimitGlowMassBounds === "function")
        ? getLimitGlowMassBounds(_hostA)
        : (/megasplit5k|\/ms5k/i.test(_hostA) ? { on: 32400, off: 32300 } : { on: 22400, off: 22300 });
      if (!glowMassA) {
        this.glowActive = false;
      } else {
        if (!this.glowActive && mass >= glowMassA.on) this.glowActive = true;
        if (this.glowActive && mass <= glowMassA.off) this.glowActive = false;
      }
      if (this.isVirus && !isTransp && S.customVirusBgEnabled) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, renderSize, 0, 2 * Math.PI);
        ctx.clip();
        if (drawVirusFillBackground(ctx, this, renderSize, true, bigPointSize)) drew = true;
        ctx.restore();
      }
      if (this.glowActive && S.showGlow) {
        const effectImg = loadCachedImage2("/photo/limited.png");
        if (effectImg && effectImg.complete && effectImg.width > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(this.x, this.y, renderSize, 0, 2 * Math.PI);
          ctx.clip();
          const edrawSize = 2 * bigPointSize;
          ctx.drawImage(effectImg, this.x - edrawSize / 2, this.y - edrawSize / 2, edrawSize, edrawSize);
          ctx.restore();
          drew = true;
        }
      }
      if (S.showStickers && this.stickerActive && this.currentSticker) {
        const stickerUrl = getStickerUrl(S.stickerList, this.name, this.currentSticker);
        if (stickerUrl) {
          const stickerImg = loadCachedImage2(stickerUrl);
          if (stickerImg && stickerImg.complete && stickerImg.width > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, renderSize, 0, 2 * Math.PI);
            ctx.clip();
            const fw = stickerImg.width;
            const fh = stickerImg.height;
            const sz = this.size;
            ctx.drawImage(stickerImg, 0, 0, fw, fh, this.x - sz, this.y - sz, sz * 2, sz * 2);
            ctx.restore();
            drew = true;
          }
        }
      }
      return drew;
    },
    drawOneCell(ctx, skipBase) {
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
      const simpleRender = true;
      let bigPointSize = this.size;
      ctx.save();
      this.drawTime = S.timestamp;
      if (skipBase && this.isFood) {
        ctx.restore();
        return;
      }
      if (this._posFrame !== S.frameId) {
        this.updatePos();
      }
      let renderSize = this.size;
      if (renderSize === 0) renderSize = 20;
      const noBorder = S.closebord || S.renderQuality === "low";
      const isTransp = S.showSkin && transparent.has(this.name);
      if (!skipBase && !this.isFood) {
        ctx.lineWidth = noBorder ? 0 : 10;
        ctx.lineCap = "round";
        ctx.lineJoin = this.isVirus ? "miter" : "round";
        const cellColor = this.getEffectiveColor();
        ctx.fillStyle = isTransp ? "rgba(0,0,0,0)" : cellColor;
        ctx.strokeStyle = isTransp ? "rgba(0,0,0,0)" : simpleRender ? cellColor : this.getStrokeColor();
        ctx.beginPath();
        ctx.arc(this.x, this.y, renderSize, 0, 2 * Math.PI);
        ctx.closePath();
        const useVirusImageFill = this.isVirus && !isTransp && drawVirusFillBackground(ctx, this, renderSize, simpleRender, bigPointSize);
        if (!noBorder) ctx.stroke();
        if (!useVirusImageFill) ctx.fill();
      } else if (skipBase && !this.isFood && !noBorder) {
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.lineJoin = this.isVirus ? "miter" : "round";
        ctx.strokeStyle = isTransp ? "rgba(0,0,0,0)" : simpleRender ? this.getEffectiveColor() : this.getStrokeColor();
        ctx.beginPath();
        ctx.arc(this.x, this.y, renderSize, 0, 2 * Math.PI);
        ctx.stroke();
      }
      if (skipBase && !this.isFood) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, renderSize, 0, 2 * Math.PI);
        if (this.isVirus && !isTransp) {
          ctx.save();
          ctx.clip();
          drawVirusFillBackground(ctx, this, renderSize, simpleRender, bigPointSize);
          ctx.restore();
        }
      }
      if (S.showSkin && !this.isVirus) {
        this.drawSkinOverlay(ctx);
      }
      const mass = Math.floor(this.size * this.size * .01);
      if (typeof this.glowActive === "undefined") this.glowActive = false;
      const _hostB = String(S.CONNECTION_URL || S.currentWebSocketUrl || S.wsUrl || "");
      const glowMassB = (typeof getLimitGlowMassBounds === "function")
        ? getLimitGlowMassBounds(_hostB)
        : (/megasplit5k|\/ms5k/i.test(_hostB) ? { on: 32400, off: 32300 } : { on: 22400, off: 22300 });
      if (!glowMassB) {
        this.glowActive = false;
      } else {
        if (!this.glowActive && mass >= glowMassB.on) this.glowActive = true;
        if (this.glowActive && mass <= glowMassB.off) this.glowActive = false;
      }
      if (this.glowActive && S.showGlow) {
        const effectImg = loadCachedImage2("/photo/limited.png");
        if (effectImg && effectImg.complete && effectImg.width > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(this.x, this.y, renderSize, 0, 2 * Math.PI);
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
            ctx.beginPath();
            ctx.arc(this.x, this.y, renderSize, 0, 2 * Math.PI);
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
    const heldStickerKeys = new Set();
    let stickerGateUntil = 0;
    let stickerSyncTimer = null;
    const STICKER_ACTION_DELAY = 300;
    const keyPressed = {};
    const mouseHoldState = {};
    S.ma = true;
    S.freeze = false;
    S.localStickerHeld = false;
    S.localStickerId = null;
    ensureStickerState(S);
    const reconnectBtn = document.getElementById("connect-verify-reconnect-btn");
    if (reconnectBtn && !reconnectBtn.dataset.bound) {
      reconnectBtn.dataset.bound = "1";
      reconnectBtn.addEventListener("click", hooks.reconnectToServer);
    }
    S.mainCanvas = S.nCanvas = document.getElementById("canvas");
    S.ctx = S.mainCanvas.getContext("2d", { alpha: true });
    ensureRenderLayers(S);
    canvasResize(S);
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
      if (!S.mapBoundsReady) {
        S.posX = S.X;
        S.posY = S.Y;
        return;
      }
      S.posX = Math.max(S.leftPos, Math.min(S.rightPos, S.X));
      S.posY = Math.max(S.topPos, Math.min(S.bottomPos, S.Y));
    };
    /** Overview moves on spectate-click (op 1), not mouse alone — auto-click while following. */
    function sendSpectateAimClick() {
      if (S.playerCells.length) return;
      S.oldX = S.posX - 999;
      S.oldY = S.posY - 999;
      if (typeof hooks.sendMouseMove === "function") hooks.sendMouseMove();
      const pid = S.spectateFollowPid | 0;
      if (pid && hooks.prepareData && hooks.wsSend) {
        const msg = hooks.prepareData(5);
        msg.setUint8(0, 1);
        msg.setUint32(1, pid, true);
        hooks.wsSend(msg);
      } else if (typeof hooks.sendUint8 === "function") {
        hooks.sendUint8(1);
      }
    }
    function stopSpectateFollowAutoClick() {
      if (S._spectateFollowTimer) {
        clearInterval(S._spectateFollowTimer);
        S._spectateFollowTimer = null;
      }
    }
    function startSpectateFollowAutoClick() {
      stopSpectateFollowAutoClick();
      S._spectateFollowTimer = setInterval(() => {
        if (S.playerCells.length || !(S.spectateFollowNick || S.spectateFollowPid)) {
          stopSpectateFollowAutoClick();
          return;
        }
        const follow = collectSpectateFollowCells(S);
        if (follow.length) {
          let sx = 0;
          let sy = 0;
          for (let i = 0; i < follow.length; i++) {
            sx += follow[i].x;
            sy += follow[i].y;
          }
          S.posX = sx / follow.length;
          S.posY = sy / follow.length;
        }
        sendSpectateAimClick();
      }, 250);
    }
    S.mainCanvas.addEventListener("mousedown", () => {
      if (S.playerCells.length) return;
      const hit = findSpectateHit(S, S.X, S.Y);
      if (hit && S.spectateAutoFollow) {
        S.spectateFollowNick = normalizeSpectateNick(hit.name) || null;
        S.spectateFollowPid = hit.playerId > 0 ? hit.playerId >>> 0 : 0;
        S.posX = hit.x;
        S.posY = hit.y;
        sendSpectateAimClick();
        startSpectateFollowAutoClick();
      } else {
        S.spectateFollowNick = null;
        S.spectateFollowPid = 0;
        stopSpectateFollowAutoClick();
        // Авто-наблюдение выкл.: клик везде — точка под курсором (не центр клетки)
        updateMouseAim();
        sendSpectateAimClick();
      }
    });
    if (S.touchable) {
      S.mainCanvas.addEventListener("touchstart", onTouchStart, false);
      S.mainCanvas.addEventListener("touchmove", onTouchMove, false);
      S.mainCanvas.addEventListener("touchend", onTouchEnd, false);
    }
    bindTouchDivButtons(S, hooks);
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
      S.localStickerHeld = true;
      S.localStickerId = stickerId;
      for (let i = 0; i < S.playerCells.length; i++) {
        const cell = S.playerCells[i];
        if (!cell) continue;
        setNodeSticker(cell, stickerId);
      }
    }
    function hideSticker() {
      S.localStickerHeld = false;
      S.localStickerId = null;
      for (let i = 0; i < S.playerCells.length; i++) {
        const cell = S.playerCells[i];
        if (!cell) continue;
        rememberSticker(S, cell.id, cell.name, null);
        setNodeSticker(cell, null);
      }
    }
    function pickHeldSticker() {
      let next = null;
      heldStickerKeys.forEach(function (id) {
        next = id;
      });
      return next;
    }
    /** Применить реальное состояние зажатых клавиш (show/hide/switch). */
    function applyHeldStickerState() {
      const next = pickHeldSticker();
      if (next == null) {
        if (currentSticker !== null) {
          sendSticker(currentSticker, false);
          currentSticker = null;
        }
        hideSticker();
        return;
      }
      if (currentSticker === next) {
        showStickerOverCell(next);
        return;
      }
      if (currentSticker !== null) sendSticker(currentSticker, false);
      currentSticker = next;
      sendSticker(next, true);
      showStickerOverCell(next);
    }
    function armStickerGate() {
      stickerGateUntil = Date.now() + STICKER_ACTION_DELAY;
    }
    /** 500ms между действиями; клавиши трекаем сразу, применение — сразу или по таймеру. */
    function requestStickerSync() {
      const wait = stickerGateUntil - Date.now();
      if (wait <= 0) {
        if (stickerSyncTimer) {
          clearTimeout(stickerSyncTimer);
          stickerSyncTimer = null;
        }
        applyHeldStickerState();
        armStickerGate();
        return;
      }
      if (stickerSyncTimer) return;
      stickerSyncTimer = setTimeout(function () {
        stickerSyncTimer = null;
        applyHeldStickerState();
        armStickerGate();
        // если за ожидание снова жали/отпускали — догнать актуальное состояние
        if (pickHeldSticker() !== currentSticker || pickHeldSticker() == null && currentSticker !== null) {
          requestStickerSync();
        }
      }, wait);
    }
    function pressStickerKey(stickerId) {
      if (!S.showStickers || isTyping) return;
      if (heldStickerKeys.has(stickerId)) return;
      heldStickerKeys.add(stickerId);
      requestStickerSync();
    }
    function releaseStickerKey(stickerId) {
      if (!heldStickerKeys.has(stickerId)) return;
      heldStickerKeys.delete(stickerId);
      requestStickerSync();
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
          if (combinedText && /^!ls/i.test(combinedText) && !/^!ls\d+\s+\S/i.test(combinedText)) {
            // Incomplete PM (!ls1223 without message) — do not send, keep chat open
            isTyping = true;
            if (chatInput) chatInput.focus();
            return;
          }
          if (combinedText.length > 0) hooks.sendChat(combinedText);
          if (chatInput) chatInput.value = "";
          if (lsInput) {
            if (S.activeDialog && /^!ls\d+$/i.test(S.activeDialog)) {
              lsInput.value = S.activeDialog + " ";
            } else {
              lsInput.value = "";
            }
          }
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
            const main = S.playerCells[0];
            if (main) {
              S.posX = main.x;
              S.posY = main.y;
            }
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
    const clearAllHeldStickers = () => {
      if (stickerSyncTimer) {
        clearTimeout(stickerSyncTimer);
        stickerSyncTimer = null;
      }
      stickerGateUntil = 0;
      if (!heldStickerKeys.size && !currentSticker) return;
      heldStickerKeys.clear();
      if (currentSticker !== null) {
        sendSticker(currentSticker, false);
        currentSticker = null;
      }
      hideSticker();
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
      clearAllHeldStickers();
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
    if (!S.uiTouchIds) S.uiTouchIds = new Set();
    function isUiTouchId(id) {
      return S.uiTouchIds && S.uiTouchIds.has(id);
    }
    function collectGameTouches(touchList) {
      const out = [];
      for (let i = 0; i < touchList.length; i++) {
        const t = touchList[i];
        if (!isUiTouchId(t.identifier)) out.push(t);
      }
      return out;
    }
    function onTouchStart(e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (isUiTouchId(touch.identifier)) continue;
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
      const gameTouches = collectGameTouches(e.touches);
      // Pinch только если 2 пальца на карте/джойстике — не считая кнопок split/eject
      if (gameTouches.length === 2) {
        const dx = gameTouches[0].clientX - gameTouches[1].clientX;
        const dy = gameTouches[0].clientY - gameTouches[1].clientY;
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
      if (gameTouches.length < 2) S.isPinching = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (isUiTouchId(touch.identifier)) continue;
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
      const gameTouchesLeft = collectGameTouches(e.touches);
      if (gameTouchesLeft.length < 2) {
        S.isPinching = false;
      }
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (S.uiTouchIds) S.uiTouchIds.delete(touch.identifier);
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
        if (S.uiTouchIds) S.uiTouchIds.clear();
      }
      S.touches = e.touches;
    }
    function bindTouchDivButtons(S, hooks) {
      const ejectBtn = document.getElementById("touch-eject");
      const splitBtn = document.getElementById("touch-split");
      if (!ejectBtn || !splitBtn) return;
      if (!S.uiTouchIds) S.uiTouchIds = new Set();
      const markUiTouches = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          S.uiTouchIds.add(e.changedTouches[i].identifier);
        }
      };
      const unmarkUiTouches = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          S.uiTouchIds.delete(e.changedTouches[i].identifier);
        }
      };
      const startEject = () => {
        if (S.ejectPressedByTouch) return;
        S.ejectPressedByTouch = true;
        hooks.sendMouseMove();
        hooks.sendUint8(21);
        if (!S.ejectInterval) {
          S.ejectInterval = setInterval(() => {
            if (S.ejectPressedByTouch && hooks.wsIsOpen()) {
              hooks.sendMouseMove();
              hooks.sendUint8(21);
            }
          }, 80);
        }
      };
      const stopEject = () => {
        S.ejectPressedByTouch = false;
        if (S.ejectInterval) {
          clearInterval(S.ejectInterval);
          S.ejectInterval = null;
        }
      };
      const doSplit = () => {
        hooks.sendMouseMove();
        hooks.sendUint8(17);
      };
      ejectBtn.addEventListener("touchstart", e => {
        e.preventDefault();
        e.stopPropagation();
        markUiTouches(e);
        startEject();
      }, {passive: false});
      ejectBtn.addEventListener("touchend", e => {
        e.preventDefault();
        e.stopPropagation();
        unmarkUiTouches(e);
        stopEject();
      }, {passive: false});
      ejectBtn.addEventListener("touchcancel", e => {
        unmarkUiTouches(e);
        stopEject();
      }, {passive: false});
      ejectBtn.addEventListener("mousedown", e => {
        e.preventDefault();
        startEject();
      });
      ejectBtn.addEventListener("mouseup", stopEject);
      ejectBtn.addEventListener("mouseleave", stopEject);
      splitBtn.addEventListener("touchstart", e => {
        e.preventDefault();
        e.stopPropagation();
        markUiTouches(e);
        doSplit();
      }, {passive: false});
      splitBtn.addEventListener("touchend", e => {
        e.preventDefault();
        e.stopPropagation();
        unmarkUiTouches(e);
      }, {passive: false});
      splitBtn.addEventListener("touchcancel", e => {
        unmarkUiTouches(e);
      }, {passive: false});
      splitBtn.addEventListener("mousedown", e => {
        e.preventDefault();
        doSplit();
      });
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
  var STATS_API = "https://api.agar.su/stats-api";
  var STATS_PAGE_URL = "https://agar.su/stats/";
  var STATS_PROFILE_BASE = "https://agar.su/stats/users/?id=";
  var STATS_CLAN_PROFILE_BASE = "https://agar.su/stats/clans/?id=";
  var STATS_RECORDS_FEED = STATS_API + "/api/records/feed";
  var STATS_FEED_POLL_MS = 10000;
  var STATS_FEED_STORAGE_KEY = "agar_stats_feed_since";

  function resolveOfficialServerId(connectionUrl) {
    const host = String(connectionUrl || "").toLowerCase().replace(/^wss?:\/\//, "");
    if (!host) return null;
    if (host.includes("ffa.agar.su")) return "ffa";
    if (host.includes("ms.agar.su:6001") || host === "ms.agar.su" || host.startsWith("ms.agar.su/")) return "ms";
    if (host.includes("ms.agar.su:6004")) return "pvp1";
    if (host.includes("ms.agar.su:6005")) return "pvp2";
    if (host.includes("ms.agar.su:6002")) return "tournament";
    if (host.includes("ms.agar.su:6003")) return "tournament2";
    return null;
  }

  function updateOfficialStatsVisibility(S) {
    const serverId = resolveOfficialServerId(
      (S && (S.SELECTED_SERVER || S.CONNECTION_URL || S.wsUrl)) || ""
    );
    document.body.classList.toggle("no-official-stats", !serverId);
    return serverId;
  }

  /** FFA/MS — масса; PVP/Tournament — победы. */
  function deathScoreLabelForServer(serverId) {
    const wins = serverId === "pvp1" || serverId === "pvp2" ||
      serverId === "tournament" || serverId === "tournament2";
    if (wins) {
      return {
        ru: "Побед",
        en: "Wins",
        tr: "Galibiyet",
        zh: "胜场",
        ar: "انتصارات",
        es: "Victorias",
        pl: "Wygrane",
        de: "Siege",
        uk: "Перемог"
      };
    }
    return {
      ru: "Масса",
      en: "Mass",
      tr: "Kütle",
      zh: "质量",
      ar: "الكتلة",
      es: "Masa",
      pl: "Masa",
      de: "Masse",
      uk: "Маса"
    };
  }

  function updateDeathScoreLabel(serverId) {
    const el = document.getElementById("deathScoreLabel");
    if (!el) return;
    const labels = deathScoreLabelForServer(serverId);
    el.textContent = labels.ru;
    el.setAttribute("data-en", labels.en);
    el.setAttribute("data-tr", labels.tr);
    el.setAttribute("data-zh", labels.zh);
    el.setAttribute("data-ar", labels.ar);
    el.setAttribute("data-es", labels.es);
    el.setAttribute("data-pl", labels.pl);
    el.setAttribute("data-de", labels.de);
    el.setAttribute("data-uk", labels.uk);
  }

  function formatChatClock(date) {
    const d = date instanceof Date ? date : new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  }

  function pushStatsSystemChat(S, hooks, text) {
    if (!S || !Array.isArray(S.chatBoard) || !text) return;
    S.chatBoard.push({
      pId: 0,
      playerXp: 0,
      playerLevel: -1,
      name: "Agar.su",
      color: "#ffd54f",
      message: String(text),
      time: formatChatClock(new Date),
      isStatsRecord: true
    });
    if (typeof hooks.drawChatBoard === "function") hooks.drawChatBoard();
    else if (typeof drawChatBoard === "function") {
      try {
        drawChatBoard(S, hooks);
      } catch (_) {}
    }
  }

  function startStatsRecordFeed(S, hooks) {
    if (S.__statsFeedStarted) return;
    S.__statsFeedStarted = true;
    let sinceId = "";
    try {
      sinceId = localStorage.getItem(STATS_FEED_STORAGE_KEY) || "";
    } catch (_) {}

    async function tick() {
      try {
        const url = STATS_RECORDS_FEED + (sinceId ? "?since=" + encodeURIComponent(sinceId) : "?since=");
        const res = await fetch(url, {
          cache: "no-store"
        });
        if (!res.ok) return;
        const data = await res.json();
        const events = Array.isArray(data.events) ? data.events : [];
        if (!events.length) return;

        const currentServerId = resolveOfficialServerId(S.CONNECTION_URL || S.SELECTED_SERVER || S.wsUrl || "");

        for (const ev of events) {
          const messages = Array.isArray(ev.messages) ? ev.messages : [];
          for (const msg of messages) {
            if (!msg || !msg.text) continue;
            // PVP / tournament — не показываем рекорды дня (победы скачут)
            if (msg.server) {
              const sid = String(msg.server).toLowerCase();
              if (sid.startsWith("pvp") || sid.startsWith("tournament")) continue;
            }
            if (msg.scope === "global") {
              // Глобальные (год/alltime) с pvp/tournament тоже глушим
              const evServer = String(ev.server || "").toLowerCase();
              if (evServer.startsWith("pvp") || evServer.startsWith("tournament")) continue;
              pushStatsSystemChat(S, hooks, msg.text);
            } else if (msg.scope === "server") {
              if (currentServerId && msg.server && currentServerId === msg.server) {
                // На всякий случай: если сидим на pvp/tournament — молчим
                const cur = String(currentServerId).toLowerCase();
                if (cur.startsWith("pvp") || cur.startsWith("tournament")) continue;
                pushStatsSystemChat(S, hooks, msg.text);
              }
            }
          }
          if (ev.id) sinceId = ev.id;
        }
        try {
          localStorage.setItem(STATS_FEED_STORAGE_KEY, sinceId);
        } catch (_) {}
      } catch (_) {}
    }

    // Первый запрос только запоминает курсор, без спама старыми событиями
    (async () => {
      try {
        const res = await fetch(STATS_RECORDS_FEED, {
          cache: "no-store"
        });
        if (!res.ok) return;
        const data = await res.json();
        const events = Array.isArray(data.events) ? data.events : [];
        if (events.length) {
          sinceId = events[events.length - 1].id || sinceId;
          try {
            localStorage.setItem(STATS_FEED_STORAGE_KEY, sinceId);
          } catch (_) {}
        }
      } catch (_) {}
      setInterval(tick, STATS_FEED_POLL_MS);
    })();
  }
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
    const item = document.querySelector(`.server-item[data-server-key="${id}"]`) || document.getElementById(id);
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
  if (onlineElement) onlineElement.textContent = `Онлайн: ${totalOnline}`;
  updateRegionOnlineTotals(getRegionOnlineTotals(rows));
}
function getRegionOnlineTotals(rows) {
  const totals = Object.fromEntries(Object.keys(REGION_CONFIGS).map(key => [key, 0]));
  for (const [key, config] of Object.entries(REGION_CONFIGS)) {
    const ids = new Set(Object.keys(config.servers));
    totals[key] = rows.reduce((sum, row) => ids.has(row.id) ? sum + (Number(row.playing) || 0) + (Number(row.no_playing) || 0) : sum, 0);
  }
  return totals;
}
function updateRegionOnlineTotals(totals) {
  document.querySelectorAll("[data-region-online]").forEach(element => {
    if (totals[element.dataset.regionOnline] != null) element.textContent = String(totals[element.dataset.regionOnline]);
  });
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
    playersTitle.setAttribute("data-en", "Top players");
    playersTitle.setAttribute("data-ru", "Топ игроков");
    playersTitle.setAttribute("data-uk", "Топ гравців");
    playersTitle.setAttribute("data-tr", "En iyi oyuncular");
    playersTitle.setAttribute("data-zh", "顶级玩家");
    playersTitle.setAttribute("data-ar", "أفضل اللاعبين");
    playersTitle.setAttribute("data-es", "Mejores jugadores");
    playersTitle.setAttribute("data-pl", "Najlepsi gracze");
    playersTitle.setAttribute("data-de", "Top-Spieler");
    playersTitle.innerText = "Топ игроков";
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
    clansTitle.setAttribute("data-en", "Top Clans");
    clansTitle.setAttribute("data-ru", "Топ кланов");
    clansTitle.setAttribute("data-uk", "Топ кланів");
    clansTitle.setAttribute("data-tr", "En iyi klanlar");
    clansTitle.setAttribute("data-zh", "顶级氏族");
    clansTitle.setAttribute("data-ar", "أفضل العشائر");
    clansTitle.setAttribute("data-es", "Mejores clanes");
    clansTitle.setAttribute("data-pl", "Najlepsze klany");
    clansTitle.setAttribute("data-de", "Top-Clans");
    clansTitle.innerText = "Топ кланов";
    container.appendChild(clansTitle);
    if (!clans.length) {
      const empty = document.createElement("div");
      empty.className = "rating-row";
      empty.innerHTML = `<div></div><div>—</div><div class="rating-pts">0 очков</div><div class="avatar" style="background-image:url('https://api.agar.su/skins/4.png');"></div>`;
      container.appendChild(empty);
    } else {
      clans.forEach((c, i) => container.appendChild(createRow(c.clan, c.points, i, c.id, true)));
    }
    if (typeof window.setUiLang === "function") {
      window.setUiLang(typeof window.getUiLang === "function" ? window.getUiLang() : "ru");
    }
  }
  function installPeriodDropdowns() {
    if (window.__periodDdInstalled) return;
    window.__periodDdInstalled = true;

    function closeAll(except) {
      document.querySelectorAll(".period-dd.is-open").forEach((dd) => {
        if (except && dd === except) return;
        dd.classList.remove("is-open");
        const menu = dd.querySelector(".period-dd__menu");
        const btn = dd.querySelector(".period-dd__btn");
        if (menu) menu.hidden = true;
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    }

    function setValue(dd, value, fireChange) {
      const selectId = dd.getAttribute("data-period-for");
      const select = selectId ? document.getElementById(selectId) : null;
      const label = dd.querySelector(".period-dd__label");
      const items = dd.querySelectorAll(".period-dd__menu [data-value]");
      let text = value;
      items.forEach((li) => {
        const on = li.getAttribute("data-value") === value;
        // Текущий выбор уже на кнопке — в списке его не дублируем
        li.classList.toggle("is-current", on);
        li.setAttribute("aria-selected", on ? "true" : "false");
        if (on) text = li.textContent.trim();
      });
      if (label) label.textContent = text;
      if (select && select.value !== value) {
        select.value = value;
        if (fireChange) select.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (select && fireChange) {
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    document.querySelectorAll(".period-dd").forEach((dd) => {
      const btn = dd.querySelector(".period-dd__btn");
      const menu = dd.querySelector(".period-dd__menu");
      const selectId = dd.getAttribute("data-period-for");
      const select = selectId ? document.getElementById(selectId) : null;
      if (!btn || !menu) return;
      if (select) setValue(dd, select.value || menu.querySelector(".is-active")?.getAttribute("data-value") || "", false);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = !dd.classList.contains("is-open");
        closeAll();
        if (willOpen) {
          dd.classList.add("is-open");
          menu.hidden = false;
          btn.setAttribute("aria-expanded", "true");
        }
      });

      menu.addEventListener("click", (e) => {
        const li = e.target.closest("[data-value]");
        if (!li) return;
        e.preventDefault();
        e.stopPropagation();
        setValue(dd, li.getAttribute("data-value"), true);
        closeAll();
      });
    });

    document.addEventListener("click", () => closeAll());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAll();
    });
  }

  function installGlobalRatingHome(S) {
    let loadGlobalRatingTimer = null;
    let lastGlobalRatingKey = "";
    const ratingHome = document.getElementById("ratinghome");
    updateOfficialStatsVisibility(S);
    const ratingHeaderTitle = ratingHome && ratingHome.querySelector(".rating-header-title");
    if (ratingHeaderTitle) {
      ratingHeaderTitle.addEventListener("click", () => window.open(STATS_PAGE_URL, "_blank"));
    } else {
      const ratingHeader = ratingHome && ratingHome.querySelector(".rating-header");
      if (ratingHeader) ratingHeader.addEventListener("click", () => window.open(STATS_PAGE_URL, "_blank"));
    }
    const homePeriodSelect = document.getElementById("homePeriodSelect");
    function currentHomePeriod() {
      return (homePeriodSelect && homePeriodSelect.value) || "alltime";
    }
    function loadGlobalRatingHome() {
      updateOfficialStatsVisibility(S);
      const period = currentHomePeriod();
      fetch(STATS_API + "/rankings?limit=3&period=" + encodeURIComponent(period) + "&metric=points", {
        cache: "no-store"
      }).then(res => res.ok ? res.json() : Promise.reject()).then(data => {
        const key = JSON.stringify({
          period,
          p: data.players,
          c: data.clans,
          u: data.updatedAt
        });
        if (key === lastGlobalRatingKey) return;
        lastGlobalRatingKey = key;
        return refreshGlobalRatingHome(S, data);
      }).catch(e => console.error("Global rating load error:", e));
    }
    if (homePeriodSelect) {
      homePeriodSelect.addEventListener("change", () => {
        lastGlobalRatingKey = "";
        loadGlobalRatingHome();
      });
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
        const serverId = updateOfficialStatsVisibility(S);
        const periodEl = document.getElementById("deathPeriodSelect");
        const period = (periodEl && periodEl.value) || "today";
        if (!serverId) {
          console.warn("chekstats: unknown official server", S.SELECTED_SERVER || S.CONNECTION_URL);
          displayStats(S, []);
          return;
        }
        updateDeathScoreLabel(serverId);
        const statsUrl = STATS_API + "/api/server/" + encodeURIComponent(serverId) +
          "?period=" + encodeURIComponent(period) + "&limit=500";
        const response = await fetch(statsUrl, {
          method: "GET",
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`Ошибка запроса: ${response.status}`);
        }
        const payload = await response.json();
        if (payload && payload.scoreLabel) {
          const el = document.getElementById("deathScoreLabel");
          if (el) el.textContent = payload.scoreLabel;
        } else {
          updateDeathScoreLabel(serverId);
        }
        const stat = Array.isArray(payload.players) ? payload.players : [];
        loadTopPlayerData2(S, stat, hooks);
        invalidateStatsRenderCaches(S);
        await fetchStats(S, stat);
      } catch (error) {
        console.error("Ошибка загрузки данных о топ-1 игроке:", error);
      }
    };
    const deathPeriodSelect = document.getElementById("deathPeriodSelect");
    if (deathPeriodSelect) {
      deathPeriodSelect.addEventListener("change", () => {
        if (typeof wHandle.chekstats === "function") wHandle.chekstats();
      });
    }
    wHandle.startGame = function() {
      let nickInput = document.getElementById("nick").value.trim();
      let passInput = document.getElementById("pass").value;
      const forbiddenRegex = new RegExp(FORBIDDEN_NICK_CHARS.join("|"), "g");
      nickInput = nickInput.replace(forbiddenRegex, "");
      nickInput = hooks.censorMessage(nickInput);
      if (!nickInput) nickInput = "agarsu";
      if (nickInput.length > 16) nickInput = nickInput.substring(0, 16);
      if (passInput.length > 8) passInput = passInput.substring(0, 8);
      const nickEl = document.getElementById("nick");
      if (nickEl && !String(nickEl.value || "").trim()) nickEl.value = nickInput;
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
      installPeriodDropdowns();
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
    const applyNickFromCabinet = () => {
      try {
        if (typeof hooks.setNick === "function") hooks.setNick(str);
      } catch (e) {}
      const nickEl = document.getElementById("nick");
      const passEl = document.getElementById("pass");
      if (nickEl) nickEl.value = nickPart;
      if (passEl) {
        passEl.value = pass;
        passEl.style.display = pass ? "block" : "none";
      }
      setCookie("userPass", pass, 7);
      // Сохраняем в avatar-containers (localStorage players) — ник или клан
      const pick =
        typeof hooks.selectSkin === "function"
          ? hooks.selectSkin
          : typeof window.selectSkin === "function"
            ? window.selectSkin
            : null;
      if (pick) {
        Promise.resolve(pick(nickPart)).catch(() => {});
      } else if (typeof window.savePlayerData === "function") {
        window.savePlayerData(nickPart, "", pass);
        if (typeof window.updateAvatarDisplay === "function") window.updateAvatarDisplay();
      }
    };
    name.onclick = e => {
      e.stopPropagation();
      applyNickFromCabinet();
    };
    li.addEventListener("click", e => {
      if (e.target.closest(".nick-perks, .passbox, button, a, input")) return;
      applyNickFromCabinet();
    });
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
  var DONATORS = ["☼k☼"];
  var CHAT_BACKGROUNDS = ["bambule", "☼k☼","pulik","liquidator"];
  var ADMINS = ["нико", "banshee"];
  var YOUTUBERS = ["salruz", "morcov", "sealand"];
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
  var CHAT_LANG_CODES = new Set([ "ru", "en", "uk", "tr", "zh", "ar", "es", "pl", "de" ]);
  var CHAT_LANG_FLAG = {
    ru: "ru",
    en: "gb",
    uk: "ua",
    tr: "tr",
    zh: "cn",
    ar: "sa",
    es: "es",
    pl: "pl",
    de: "de"
  };
  var CHAT_LANG_TAG_RE = /\s*:(ru|en|uk|tr|zh|ar|es|pl|de)\s*$/i;
  function getChatUiLangCode() {
    let lang = "ru";
    try {
      if (typeof window.getUiLang === "function") lang = window.getUiLang(); else if (window.__uiLang) lang = window.__uiLang;
    } catch (e) {}
    lang = String(lang || "ru").toLowerCase();
    if (lang === "zh-cn" || lang.indexOf("zh") === 0) lang = "zh";
    if (CHAT_LANG_CODES.has(lang)) return lang;
    return "en";
  }
  function parseChatLangTag(message) {
    const raw = String(message == null ? "" : message);
    const m = raw.match(CHAT_LANG_TAG_RE);
    if (!m) return {
      text: raw,
      lang: null
    };
    return {
      text: raw.slice(0, m.index).trimEnd(),
      lang: m[1].toLowerCase()
    };
  }
  function appendChatLangTag(str) {
    let s = String(str || "").trim();
    if (!s) return s;
    if (/^!ls\d+\s+PvPInvite;/i.test(s)) return s;
    if (/вoшёл в игру/i.test(s)) return s;
    s = s.replace(CHAT_LANG_TAG_RE, "").trimEnd();
    const code = getChatUiLangCode();
    const tag = " :" + code;
    if (s.length + tag.length >= 200) {
      s = s.slice(0, Math.max(0, 199 - tag.length)).trimEnd();
    }
    return s + tag;
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
    if (lastMessage.isStatsRecord) {
      const simpleDiv = document.createElement("div");
      simpleDiv.className = "chatexit chatexit-record";
      simpleDiv.dataset.chatIdx = String(msgIndex);
      simpleDiv.textContent = lastMessage.message || "";
      document.getElementById("chatX_feed").appendChild(simpleDiv);
      if (S.chatStickToBottom !== false) scrollChatToLatest(document.getElementById("chatX_feed"));
      return;
    }
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
      msgDiv.style.backgroundColor = "rgba(194, 13, 13, 0.74)";
    }
    if (CHAT_BACKGROUNDS.includes(lowerName)) msgDiv.className = "chatX_msg " + lowerName; else msgDiv.className = "chatX_msg";
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
    const parsedLang = parseChatLangTag(messageContent);
    messageContent = parsedLang.text;
    const messageLang = parsedLang.lang;
    if (!targetDiv) targetDiv = document.getElementById("chatX_feed");
    const avatarContainer = document.createElement("div");
    avatarContainer.className = "avatarXcontainer";
    if (S.passUsers.includes(normalizedName)) {
      avatarContainer.style.setProperty("--after-display", "block");
    }
    if (messageLang && CHAT_LANG_FLAG[messageLang]) {
      const langBadge = document.createElement("span");
      langBadge.className = "chatX_lang fi fi-" + CHAT_LANG_FLAG[messageLang];
      langBadge.title = messageLang.toUpperCase();
      langBadge.setAttribute("aria-label", messageLang);
      avatarContainer.appendChild(langBadge);
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
      const playerId = lastMessage.pId;
      const menuItems = [];
      if (resolveStatsForName(S, lastMessage.name)) {
        menuItems.push({
          label: "Статистика",
          onClick: () => openStatsForName(S, lastMessage.name)
        });
      }
      menuItems.push({
        label: "Позвать на PvP",
        onClick: () => openPvPModal(S, hooks, lastMessage.pId, lastMessage.name)
      });
      menuItems.push({
        label: "Личное сообщение",
        onClick: () => {
          createDialog(S, hooks, playerId, lastMessage.name, S.skinList[normalizeNick(lastMessage.name)] ? `https://api.agar.su/skins/${S.skinList[normalizeNick(lastMessage.name)]}.png` : "https://api.agar.su/skins/4.png");
          switchToDialog(S, `!ls${playerId}`);
        }
      });
      menuItems.push({
        label: "Игнорировать",
        onClick: () => {
          S.ignoredPlayers.add(playerId);
          msgDiv.remove();
        }
      });
      menuItems.push({
        label: "Удалить всех из игнора",
        onClick: () => {
          S.ignoredPlayers.clear();
        }
      });
      menuItems.push({
        label: "Удалить сообщение",
        onClick: () => {
          msgDiv.remove();
        }
      });
      menuItems.push({
        label: "Удалить все сообщения игрока",
        onClick: () => {
          [ ...targetDiv.children ].forEach(c => {
            var _a2;
            if ((_a2 = c.querySelector(".chatX_nick")) == null ? void 0 : _a2.title.includes(playerId)) c.remove();
          });
        }
      });
      showUiContextMenu(menuItems, e.clientX, e.clientY);
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
    S.chatBackgrounds = CHAT_BACKGROUNDS;
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
      setserver: hooks.setserver,
      drawChatBoard: () => drawChatBoard(S, hooks)
    };
    startStatsRecordFeed(S, chatHooks);
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
  function resolveStatsForName(S, name) {
    const clanPassId = resolveClanPassIdFromName(S, name);
    const playerPassId = resolvePlayerPassIdFromName(S, name);
    const passId = clanPassId || playerPassId;
    if (!passId) return null;
    return {
      passId,
      isClan: !!clanPassId,
      url: (clanPassId ? STATS_CLAN_PROFILE_BASE : STATS_PROFILE_BASE) + encodeURIComponent(passId)
    };
  }
  function openStatsForName(S, name) {
    const info = resolveStatsForName(S, name);
    if (!info) return false;
    window.open(info.url, "_blank");
    return true;
  }
  function showUiContextMenu(items, x, y) {
    document.querySelectorAll(".chat-context-menu").forEach(m => m.remove());
    if (!(items && items.length)) return null;
    const menu = document.createElement("div");
    menu.className = "chat-context-menu";
    menu.style.top = y + "px";
    menu.style.left = x + "px";
    items.forEach(item => {
      const el = document.createElement("div");
      el.textContent = item.label;
      el.style.cursor = "pointer";
      el.onclick = () => {
        try {
          item.onClick && item.onClick();
        } finally {
          menu.remove();
        }
      };
      menu.appendChild(el);
    });
    document.body.appendChild(menu);
    const closeMenu = event => {
      if (!menu.contains(event.target)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    };
    setTimeout(() => document.addEventListener("click", closeMenu), 0);
    return menu;
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
      return false;

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

     case 17:
      return S.spectateAutoFollow;

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
          if (id == 17) S.wHandle.setSpectateAutoFollow(value);
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
    wHandle.setSpectateAutoFollow = function(arg) {
      S.spectateAutoFollow = !!arg;
      persistCheckbox(17, S.spectateAutoFollow);
      if (!S.spectateAutoFollow) {
        S.spectateFollowNick = null;
        S.spectateFollowPid = 0;
        if (S._spectateFollowTimer) {
          clearInterval(S._spectateFollowTimer);
          S._spectateFollowTimer = null;
        }
      }
    };
    wHandle.setShowMass = function(arg) {
      S.showMass = arg;
      persistCheckbox(5, arg);
    };
    wHandle.setSmooth = function(arg) {
      S.smoothRender = arg ? 2 : .4;
      persistCheckbox(6, arg);
    };
    wHandle.setSmooth.enabled = false;
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
        if (!S.freeze) {
          try {
            const freezeEl = document.querySelector("#freeze");
            if (freezeEl) freezeEl.style.display = "none";
          } catch (_) {}
        }
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
function getServerDomId(regionKey, serverKey) {
  return document.querySelector(`.server-item[data-region="${regionKey}"][data-server-key="${serverKey}"]`)?.id || serverKey;
}
function renderRegionServers(regionKey) {
  const config = REGION_CONFIGS[regionKey];
  if (!config) return;
  document.querySelectorAll(".server-item").forEach(item => {
    const visible = item.dataset.region === regionKey;
    item.hidden = !visible;
    item.classList.remove("active");
  });
  document.querySelectorAll(".server-group").forEach(group => {
    group.hidden = !group.querySelector(`.server-item[data-region="${regionKey}"]`);
  });
  document.querySelectorAll("[data-region]").forEach(button => button.classList.toggle("active", button.dataset.region === regionKey));
}
function applyRegion(regionKey, S, save) {
  const config = REGION_CONFIGS[regionKey];
  if (!config) return false;
  activeRegion = regionKey;
  SERVERS = Object.fromEntries(Object.entries(config.servers).map(([id, server]) => [id, server.host]));
  renderRegionServers(regionKey);
  if (save !== false) try { localStorage.setItem("agar_region", regionKey); } catch (e) {}
  if (S) {
    history.replaceState(null, "", " ");
    initServers(S);
  }
  return true;
}
function getServerHash(regionKey, serverKey) {
  return serverKey;
}
function parseServerHash(hashValue) {
  const value = String(hashValue || "").split("?")[0].toLowerCase();
  if (REGION_CONFIGS.eu?.servers[value]) return { regionKey: "eu", serverKey: value };
  if (REGION_CONFIGS.tr?.servers[value]) return { regionKey: "tr", serverKey: value };
  return { regionKey: "ru", serverKey: value };
}
function getRegionForHash(hashValue) {
  const parsed = parseServerHash(hashValue);
  return REGION_CONFIGS[parsed.regionKey]?.servers[parsed.serverKey] ? parsed.regionKey : null;
}
function initServers(S) {
  readServersFromHtml();
  let serverKey = "ffa";
  const hash = S.wHandle.location.hash.slice(1);
  const hashWithoutParams = hash.split("?")[0];
  const parsedHash = parseServerHash(hashWithoutParams);
  const hashRegion = getRegionForHash(hashWithoutParams);
  if (!activeRegion) applyRegion(hashRegion || getDefaultRegion(), null, false);
  else if (hashRegion && hashRegion !== activeRegion) applyRegion(hashRegion, null, false);
  const urlParams = new URLSearchParams(window.location.search);
  
  // Определяем сервер из URL
  if (hashRegion && parsedHash.serverKey && SERVERS[parsedHash.serverKey]) {
    serverKey = parsedHash.serverKey;
  } else {
    const keys = Object.keys(SERVERS);
    if (keys.length) serverKey = keys[0];
  }
  
  S.CONNECTION_URL = serverKey ? SERVERS[serverKey] : null;
  S.SELECTED_SERVER = S.CONNECTION_URL;
  
  // Обновляем активный класс на НОВЫХ элементах .server-item
  document.querySelectorAll(".server-item").forEach(el => el.classList.remove("active"));
  const activeItem = serverKey ? document.getElementById(getServerDomId(activeRegion, serverKey)) : null;
  if (activeItem) {
    activeItem.classList.add("active");
  }
  
  const titleEl = document.getElementById("serverTitle");
  if (titleEl) {
    const serverName = REGION_CONFIGS[activeRegion]?.servers[serverKey]?.title || serverKey;
    titleEl.textContent = `Статистика ${serverName}`;
  }

  if (typeof updateOfficialStatsVisibility === "function") updateOfficialStatsVisibility(S);
  
  if (urlParams.has("spect") || urlParams.has("spectator") || hash.includes("?spect") || hash.includes("?spectator")) {
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
    setTouchDeviceDetected(S.isTouchStart);
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
          S.freeze = false;
          try {
            const freezeEl = document.querySelector("#freeze");
            if (freezeEl) freezeEl.style.display = "none";
          } catch (_) {}
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
        const foundServerKey = Object.keys(SERVERS).find(key => SERVERS[key] === arg);
        if (foundServerKey) {
          history.replaceState(null, "", `#${getServerHash(activeRegion, foundServerKey)}`);
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
      S.spectateFollowNick = null;
      S.spectateFollowPid = 0;
      if (S._spectateFollowTimer) {
        clearInterval(S._spectateFollowTimer);
        S._spectateFollowTimer = null;
      }
      outbound.sendNickName();
      hideStatics();
      S.maxScore = 0;
    };
    wHandle.spectate = function() {
      wHandle.setserver(S.SELECTED_SERVER);
      S.userNickName = null;
      S.spectateFollowNick = null;
      S.spectateFollowPid = 0;
      if (S._spectateFollowTimer) {
        clearInterval(S._spectateFollowTimer);
        S._spectateFollowTimer = null;
      }
      hideGameOverlays();
      hideStatics();
      if (typeof wHandle.chekstats === "function") wHandle.chekstats();
    };
    wHandle.connect = connection.wsConnect;
onReady(() => {
  const serverGrid = document.querySelector(".server-grid");
  if (!serverGrid || serverGrid.dataset.serverClickBound === "1") return;
  serverGrid.dataset.serverClickBound = "1";
  serverGrid.addEventListener("click", event => {
    const item = event.target.closest(".server-item");
    if (!item || !serverGrid.contains(item)) return;
    const id = item.dataset.serverKey || item.id;
    if (!id || !REGION_CONFIGS[activeRegion]?.servers[id]) return;
    document.querySelectorAll(".server-item").forEach(el => el.classList.remove("active"));
    item.classList.add("active");
    S.SELECTED_SERVER = item.dataset.ip;
    S.CONNECTION_URL = item.dataset.ip;
    history.replaceState(null, "", "#" + getServerHash(activeRegion, id));
    const titleEl = document.getElementById("serverTitle");
    if (titleEl) titleEl.textContent = `Статистика ${REGION_CONFIGS[activeRegion].servers[id].title || id}`;
    if (typeof updateOfficialStatsVisibility === "function") updateOfficialStatsVisibility(S);
    if (typeof wHandle.chekstats === "function") wHandle.chekstats();
  });
});
    listsPromise.then(() => fetchNickPerksLists(S)).catch(() => {});
    listsPromise.then(() => initServers(S)).catch(() => initServers(S));
    onReady(() => {
      document.querySelectorAll("[data-region]").forEach(button => button.addEventListener("click", () => {
        if (applyRegion(button.dataset.region, S, true)) updateOnlineCount();
      }));
      startOnlineCountPolling();
    });
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
      selectSkin: nick => {
        if (typeof window.selectSkin === "function") return window.selectSkin(nick);
        return selectSkin(nick);
      }
    });
    initShareHandlers(S);
    connection.bindVisibilityHandlers();
    hideReconnectPanel();
    function startGameLoop() {
      const urlParams = new URLSearchParams(window.location.search);
      const hash = wHandle.location.hash;
      if (urlParams.has("spect") || urlParams.has("spectator") || hash.includes("?spect") || hash.includes("?spectator")) {
        const requestedZoom = Number.parseFloat(urlParams.get("zoom"));
        S.zoom = Number.isFinite(requestedZoom) ? Math.min(4, Math.max(.3, requestedZoom)) : .4;
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
  var MANUAL_SKINS_NICKS = [ "Муха", "Паук", "Кактус", "Могучая", "Ящерица", "Лиса", "Волк", "Мамонт", "Динозавр", "Мороженое", "Ракета", "Зая", "Фаун", "Бабушка", "Юпитер", "Марс", "Луна", "Гора", "Нептун", "Плутон", "Уран", "Венера", "Сатурн","Теннисистка", "Первобытный", "Влюблённый", "Влюблённая"];
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
    const id = skinsMap.has(normalizedNick) ? skinsMap.get(normalizedNick) : "";
    // Всегда сохраняем в avatar-containers (даже без скина / клан)
    savePlayerData(nick, id, getPassInputValue());
    currentIndex = getCurrentPlayerIndex(nick);
    if (currentIndex < 0) currentIndex = 0;
    updateAvatarDisplay();
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
  window.selectSkin = selectSkin;
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
      const nickElem = e.target.closest(".Lednick-name");
      if (!nickElem) return;
      insertNick(nickElem.textContent);
    });
    leaderboard.addEventListener("contextmenu", e => {
      e.preventDefault();
      const nickElem = e.target.closest(".Lednick-name");
      if (!nickElem) return;
      const nick = (nickElem.textContent || "").trim();
      if (!nick) return;
      const S = window.__gameState;
      if (!S) return;
      const items = [];
      if (resolveStatsForName(S, nick)) {
        items.push({
          label: "Статистика",
          onClick: () => openStatsForName(S, nick)
        });
      }
      if (!items.length) return;
      showUiContextMenu(items, e.clientX, e.clientY);
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
  function initHudEditor() {
    var STORAGE_KEY = "hud_layout_v1";
    var DEFAULTS = {
      eject: { x: 88, y: 88, scale: 100 },
      split: { x: 88, y: 72, scale: 100 },
      minimap: { x: 88, y: 64, scale: 100 }
    };
    var ELEMENTS = [
      { key: "eject", label: "Выброс", selector: "#touch-eject" },
      { key: "split", label: "Сплит", selector: "#touch-split" },
      { key: "minimap", label: "Миникарта", selector: "#map" }
    ];
    var editorEl = document.getElementById("hud-editor");
    var openBtn = document.getElementById("hud-editor-open");
    var selectEl = document.getElementById("hud-editor-select");
    var scaleInput = document.getElementById("hud-editor-scale");
    var scaleVal = document.getElementById("hud-editor-scale-val");
    var resetBtn = document.getElementById("hud-editor-reset");
    var saveBtn = document.getElementById("hud-editor-save");
    var closeBtn = document.getElementById("hud-editor-close");
    if (!editorEl || !openBtn || !selectEl || !scaleInput) return;
    var layout = loadLayout();
    var savedSnapshot = null;
    var editing = false;
    var selectedKey = null;
    var overlaysEl = document.getElementById("overlays");
    var mapPreviousStyle = null;
    ELEMENTS.forEach(function(cfg) {
      var option = document.createElement("option");
      option.value = cfg.key;
      option.textContent = cfg.label;
      selectEl.appendChild(option);
    });
    function loadLayout() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) || {};
      } catch (e) {}
      return {};
    }
    function persistLayout() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch (e) {}
    }
    function getCfg(key) {
      for (var i = 0; i < ELEMENTS.length; i++) if (ELEMENTS[i].key === key) return ELEMENTS[i];
      return null;
    }
    function getEl(cfg) { return document.querySelector(cfg.selector); }
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function applyToEl(cfg, data) {
      var el = getEl(cfg);
      if (!el || !data) return;
      el.style.position = "fixed";
      el.style.left = data.x + "%";
      el.style.top = data.y + "%";
      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.margin = "0";
      el.style.transform = "translate(-50%,-50%) scale(" + (data.scale / 100) + ")";
      el.style.transformOrigin = "center center";
    }
    function applyAll() {
      ELEMENTS.forEach(function(cfg) {
        if (layout[cfg.key]) applyToEl(cfg, layout[cfg.key]);
      });
    }
    function select(key) {
      selectedKey = key;
      if (selectEl) selectEl.value = key;
      var data = layout[key] || DEFAULTS[key];
      if (scaleInput) scaleInput.value = data.scale;
      if (scaleVal) scaleVal.textContent = data.scale + "%";
      document.querySelectorAll(".hud-editable").forEach(function(el) { el.classList.remove("hud-selected"); });
      var el = getEl(getCfg(key));
      if (el) el.classList.add("hud-selected");
    }
    function openEditor() {
      editing = true;
      savedSnapshot = clone(layout);
      mapPreviousStyle = null;
      if (typeof showContent2 === "function") showContent2("home");
      if (overlaysEl) overlaysEl.style.display = "none";
      document.body.classList.add("hud-editing");
      editorEl.hidden = false;
      var touchButtons = document.getElementById("touch-buttons");
      if (touchButtons) touchButtons.hidden = false;
      ELEMENTS.forEach(function(cfg) {
        var el = getEl(cfg);
        if (!el) return;
        if (cfg.key === "minimap") {
          mapPreviousStyle = el.getAttribute("style");
          el.style.display = "block";
        }
        if (!layout[cfg.key]) layout[cfg.key] = Object.assign({}, DEFAULTS[cfg.key]);
        el.classList.add("hud-editable");
        el.setAttribute("data-hud-key", cfg.key);
        applyToEl(cfg, layout[cfg.key]);
      });
      select(ELEMENTS[0].key);
    }
    function closeEditor(save) {
      if (save) {
        ELEMENTS.forEach(function(cfg) {
          var el = getEl(cfg);
          if (!el) return;
          if (layout[cfg.key]) applyToEl(cfg, layout[cfg.key]);
          el.classList.remove("hud-editable", "hud-selected");
          el.removeAttribute("data-hud-key");
        });
        persistLayout();
      } else {
        layout = clone(savedSnapshot || {});
        ELEMENTS.forEach(function(cfg) {
          var el = getEl(cfg);
          if (!el) return;
          el.classList.remove("hud-editable", "hud-selected");
          el.removeAttribute("data-hud-key");
          el.style.cssText = "";
        });
        applyAll();
      }
      editing = false;
      document.body.classList.remove("hud-editing");
      editorEl.hidden = true;
      if (overlaysEl) overlaysEl.style.display = "none";
      if (typeof showContent2 === "function") showContent2("home");
      applyAll();
      mapPreviousStyle = null;
      updateTouchButtonsVisibility();
      savedSnapshot = null;
    }
    openBtn.addEventListener("click", openEditor);
    if (saveBtn) saveBtn.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); closeEditor(true); });
    closeBtn.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); closeEditor(false); });
    resetBtn.addEventListener("click", function() {
      if (!selectedKey) return;
      layout[selectedKey] = Object.assign({}, DEFAULTS[selectedKey]);
      applyToEl(getCfg(selectedKey), layout[selectedKey]);
      select(selectedKey);
    });
    selectEl.addEventListener("change", function() { select(selectEl.value); });
    scaleInput.addEventListener("input", function() {
      if (!selectedKey) return;
      var data = layout[selectedKey] || Object.assign({}, DEFAULTS[selectedKey]);
      data.scale = parseInt(scaleInput.value, 10) || 100;
      layout[selectedKey] = data;
      if (scaleVal) scaleVal.textContent = data.scale + "%";
      applyToEl(getCfg(selectedKey), data);
      persistLayout();
    });
    document.addEventListener("pointerdown", function(e) {
      if (!editing) return;
      var t = e.target;
      while (t && t !== document && !(t.getAttribute && t.getAttribute("data-hud-key"))) t = t.parentNode;
      if (!t || t === document) return;
      var key = t.getAttribute("data-hud-key");
      if (!key) return;
      e.preventDefault();
      select(key);
      var data = layout[key] || Object.assign({}, DEFAULTS[key]);
      var startX = e.clientX, startY = e.clientY;
      var startPx = { x: data.x / 100 * window.innerWidth, y: data.y / 100 * window.innerHeight };
      var el = t;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      function onMove(ev) {
        var nx = startPx.x + (ev.clientX - startX);
        var ny = startPx.y + (ev.clientY - startY);
        data.x = Math.max(2, Math.min(98, Math.round(nx / window.innerWidth * 1000) / 10));
        data.y = Math.max(2, Math.min(98, Math.round(ny / window.innerHeight * 1000) / 10));
        layout[key] = data;
        applyToEl(getCfg(key), data);
        persistLayout();
      }
      function onUp() {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
      }
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    });
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape" && editing) closeEditor(true);
    });
    editorEl.addEventListener("pointerdown", function(e) {
      if (e.target === editorEl) closeEditor(true);
    });
    document.addEventListener("pointerdown", function(e) {
      if (!editing || editorEl.contains(e.target)) return;
      var t = e.target;
      while (t && t !== document && !(t.getAttribute && t.getAttribute("data-hud-key"))) t = t.parentNode;
      if (!t || t === document) closeEditor(true);
    });
    applyAll();
  }
  function initLobbyUi() {
    const {loadChatSize} = initChatResize();
    updateAccountMenuLabel();
    loadChatSize();
    initHudToggles();
    initOverlayMouseBridge();
    initChatNickInsert();
    initHudEditor();
  }
  window.showContent = showContent2;
  window.updateAccountMenuLabel = updateAccountMenuLabel;
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
      allowTxtReady = fetch("https://api.agar.su/allowtxt.txt", { cache: "no-store" }).then(r => {
        if (!r.ok) throw new Error("api allowtxt");
        return r.text();
      }).then(text => {
        if (!parseAllowTxt(text)) throw new Error("empty api allowtxt");
      });
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
  var emailInput = document.getElementById("shopEmail");
  var shopPayOverlay = document.getElementById("shopPayOverlay");
  var shopPayBackdrop = document.getElementById("shopPayBackdrop");
  var payButton = document.getElementById("payButton");
  var shopPayBack = document.getElementById("shopPayBack");
  var shopPayAmount = document.getElementById("shopPayAmount");
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var isPayStepOpen = false;
  var isSubmittingPayment = false;
  function getShopEmail() {
    return ((emailInput == null ? void 0 : emailInput.value) || "").trim().toLowerCase();
  }
  function isShopEmailValid() {
    return EMAIL_RE.test(getShopEmail());
  }
  function updatePayButtonState() {
    if (!payButton) return;
    payButton.disabled = isSubmittingPayment || !isShopEmailValid();
    if (isSubmittingPayment) return;
    payButton.textContent = "ОПЛАТИТЬ";
  }
  function trySubmitEmail() {
    if (!isPayStepOpen || isSubmittingPayment) return;
    if (!isShopEmailValid()) {
      if (getShopEmail()) showError("emailError", "Введите корректный email");
      return;
    }
    hideError("emailError");
    startPayment();
  }
  function openPayStep() {
    if (!shopPayOverlay) return;
    const totalText = (document.getElementById("totalAmount") || {}).textContent || "0 ₽";
    if (shopPayAmount) shopPayAmount.textContent = totalText;
    shopPayOverlay.hidden = false;
    shopPayOverlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => shopPayOverlay.classList.add("is-open"));
    isPayStepOpen = true;
    hideError("emailError");
    hideError("formError");
    updatePayButtonState();
    setTimeout(() => emailInput == null ? void 0 : emailInput.focus(), 60);
  }
  function closePayStep() {
    if (!shopPayOverlay || isSubmittingPayment) return;
    shopPayOverlay.classList.remove("is-open");
    shopPayOverlay.setAttribute("aria-hidden", "true");
    isPayStepOpen = false;
    hideError("emailError");
    const finishHide = () => {
      if (!isPayStepOpen) shopPayOverlay.hidden = true;
    };
    shopPayOverlay.addEventListener("transitionend", finishHide, {
      once: true
    });
    setTimeout(finishHide, 240);
  }
  loadAllowTxt().then(() => {
    blockForbiddenChars(nicknameInput);
    blockForbiddenChars(passwordInput);
  }).catch(() => {
    blockForbiddenChars(nicknameInput);
    blockForbiddenChars(passwordInput);
    showToast("Не удалось загрузить allowtxt.txt", "error");
  });
  emailInput == null ? void 0 : emailInput.addEventListener("input", () => {
    if (!getShopEmail() || isShopEmailValid()) hideError("emailError");
    updatePayButtonState();
  });
  emailInput == null ? void 0 : emailInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      trySubmitEmail();
    }
  });
  emailInput == null ? void 0 : emailInput.addEventListener("blur", () => {
    if (!isPayStepOpen || isSubmittingPayment) return;
    if (isShopEmailValid()) trySubmitEmail();
  });
  shopPayBack == null ? void 0 : shopPayBack.addEventListener("mousedown", e => {
    e.preventDefault();
  });
  shopPayBack == null ? void 0 : shopPayBack.addEventListener("click", () => closePayStep());
  shopPayBackdrop == null ? void 0 : shopPayBackdrop.addEventListener("click", () => {
    if (isSubmittingPayment) return;
    if (isShopEmailValid()) trySubmitEmail();
    else closePayStep();
  });
  payButton == null ? void 0 : payButton.addEventListener("mousedown", e => {
    e.preventDefault();
  });
  payButton == null ? void 0 : payButton.addEventListener("click", () => {
    trySubmitEmail();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && isPayStepOpen && !isSubmittingPayment) closePayStep();
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
      if (isPayStepOpen) closePayStep();
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
      if (isPayStepOpen && shopPayAmount) shopPayAmount.textContent = `${total} ₽`;
    } else {
      setReceiptVisible(false);
      buyButton.disabled = true;
      if (isPayStepOpen) closePayStep();
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
  document.getElementById("buyButton").addEventListener("click", () => {
    if (document.getElementById("buyButton").disabled) return;
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value.trim();
    const file = fileInput.files[0];
    if (!nickname) {
      showError("formError", "Введите ник/клан.");
      return;
    }
    if (isNicknameTaken) {
      showError("formError", "Ник занят");
      return;
    }
    if (!password && !file && !invisibleNickCheckbox.checked && !rotationNickCheckbox.checked) {
      showError("formError", "Выберите хотя бы пароль или скин для оплаты");
      return;
    }
    openPayStep();
  });
  document.getElementById("paymentForm").addEventListener("submit", e => {
    e.preventDefault();
    if (!document.getElementById("buyButton").disabled) openPayStep();
  });
  async function startPayment() {
    var _a;
    if (isSubmittingPayment) return;
    const rawNickname = nicknameInput.value.trim();
    const nickname = rawNickname.toLowerCase();
    const password = passwordInput.value.trim().toLowerCase();
    const email = getShopEmail();
    const file = fileInput.files[0];
    const serviceType = ((_a = document.querySelector('input[name="serviceType"]:checked')) == null ? void 0 : _a.value) || "";
    if (!nickname) {
      showError("formError", "Введите ник/клан.");
      closePayStep();
      return;
    }
    if (!email) {
      showError("emailError", "Укажите email для чека");
      emailInput == null ? void 0 : emailInput.focus();
      return;
    }
    if (!isShopEmailValid()) {
      showError("emailError", "Введите корректный email");
      emailInput == null ? void 0 : emailInput.focus();
      return;
    }
    if (!password && !file && !invisibleNickCheckbox.checked && !rotationNickCheckbox.checked) {
      showError("formError", "Выберите хотя бы пароль или скин для оплаты");
      closePayStep();
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
    formData.append("email", email);
    if (password) formData.append("password", password);
    if (invisibleNickCheckbox.checked) formData.append("invisible", "1");
    if (rotationNickCheckbox.checked) formData.append("rotation", "1");
    const headers = {};
    if (getAccountToken()) {
      headers["Authorization"] = `Game ${getAccountToken()}`;
    }
    isSubmittingPayment = true;
    updatePayButtonState();
    if (payButton) payButton.textContent = "ОПЛАТА...";
    const restorePayBtn = () => {
      isSubmittingPayment = false;
      updatePayButtonState();
    };
    try {
      if (file) {
        if (file.type === "image/gif") {
          formData.append("image", file, file.name);
          await sendForm(formData, headers);
        } else {
          await new Promise((resolve, reject) => {
            skinCanvas.toBlob(async blob => {
              if (!blob) {
                showError("formError", "Не удалось обработать изображение. Попробуйте другой файл.");
                reject(new Error("blob"));
                return;
              }
              formData.append("image", blob, "skin.png");
              try {
                await sendForm(formData, headers);
                resolve();
              } catch (err) {
                reject(err);
              }
            }, "image/png");
          });
        }
      } else {
        await sendForm(formData, headers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      restorePayBtn();
    }
  }
  async function sendForm(formData, headers = {}) {
    var _a;
    try {
      const res = await fetch("https://api.agar.su/create-payment", {
        method: "POST",
        headers,
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error && (data.error.description || data.error) || `Ошибка оплаты (${res.status})`;
        showError("formError", String(msg), true);
        throw new Error(String(msg));
      }
      if (data.warning) {
        showError("formError", data.warning, false);
        setTimeout(() => hideError("formError"), 8e3);
      }
      if ((_a = data == null ? void 0 : data.confirmation) == null ? void 0 : _a.confirmation_url) {
        showToast("Переходим к оплате...", "success");
        window.location.href = data.confirmation.confirmation_url;
        return;
      }
      if (data == null ? void 0 : data.redirect) {
        showToast("Переходим к оплате...", "success");
        window.location.href = data.redirect;
        return;
      }
      if (data == null ? void 0 : data.error) {
        showError("formError", `Ошибка: ${data.error.description || data.error}`, true);
        throw new Error(String(data.error.description || data.error));
      }
      showError("formError", "Неизвестная ошибка платежа.", true);
      throw new Error("unknown payment error");
    } catch (err) {
      console.error(err);
      if (!(err && err.message && String(err.message).includes("Ошибка"))) {
        showError("formError", "Ошибка соединения. Попробуйте позже.", true);
      }
      throw err;
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
    closePayStep();
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
      // Same normalizeNick as pass.txt: clans stay as "[isq]", not stripped "isq"
      const normalized = normalizeNick(nick);
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
