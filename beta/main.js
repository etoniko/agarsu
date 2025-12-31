(function (global) {
    const servers = { "fsb-lybanka.ru:6001": { name: "FFA - Moscow" },"ffa.agar.su:6002": { name: "MegaSplit" },"ffa.agar.su:6003": { name: "Experemental" },"ffa.agar.su:6004": { name: "pvp1: 1x1 ffa 1k" },"ffa.agar.su:6005": { name: "pvp2: 2x2 ms 1k" },"ffa.agar.su:6006": { name: "Tournament" } };
    Array.prototype.remove = function (a) {
        const i = this.indexOf(a);
        return i !== -1 && this.splice(i, 1);
    };
const COLORS = [
    "#FF0000", // красный
    "#FF8000", // оранжевый
    "#FFFF00", // жёлтый
    "#80FF00", // салатовый
    "#00FF00", // зелёный
    "#00FF80", // бирюзовый
    "#00FFFF", // голубой
    "#0080FF", // синий
    "#0000FF", // тёмно-синий
    "#8000FF", // фиолетовый
    "#FF00FF", // розовый
    "#FF0080", // малиновый
    "#FFFFFF", // белый
    "#C0C0C0", // серый
    "#808080", // тёмно-серый
    "#000000"  // чёрный
];

// Преобразуем в нижний регистр без # для удобного сравнения
const COLOR_MAP = new Map();
COLORS.forEach((hex, id) => {
    COLOR_MAP.set(hex.toLowerCase(), id);
    COLOR_MAP.set(hex.replace("#", "").toLowerCase(), id);
});

/**
 * Возвращает ID цвета (0–15) по значению из localStorage
 * Если цвет не найден — возвращает 0 (красный)
 */
function getColorId(storedColor) {
    if (!storedColor) return 0;
    const key = storedColor.toString().toLowerCase().trim();
    return COLOR_MAP.has(key) ? COLOR_MAP.get(key) : 0;
}

// === Дополнительно: сохранение выбранного цвета при смене в настройках ===
function setSelectedColor(hex) {
    if (hex && hex.startsWith("#")) {
        localStorage.setItem("selectedColor", hex.toUpperCase());
    }
}


    class Cell {
        static NAME_CACHE = new Map()
        static MASS_POOL = new Array()
        static SPRITE //pixi.sprite set later


        constructor(core, id, x, y, r, sprite, name, color) {
            this.core = core
            this.sprite = sprite
            this.id = id
            this.x = this.nx = this.ox = x
            this.y = this.ny = this.oy = y
            this.r = this.nr = this.or = r
            this._color = color
            this._name = name
            this.updated = Date.now()
            this.hasChanged = true
			this.skinSprite = null;
            this.skinMask = null;
            // Кэш для оптимизации обновлений
            this._lastScale = r / 256;
            this._lastZIndex = r * 2;
            this._visible = true; // для frustum culling
        }

        _getNameTexture(name) {
    const MAX_WIDTH = 512; // максимально допустимая ширина имени
    let fontSize = 100; // базовый размер шрифта

    // Создаём временный текст для измерения ширины
    let text = new PIXI.Text(name, {
        fontFamily: 'Ubuntu, Arial, sans-serif',
        fontWeight: '700',
        fontSize: fontSize,
        lineJoin: "round",
        fill: "white",
        stroke: "black",
        strokeThickness: 10
    });

    // Если текст слишком широкий, уменьшаем шрифт пропорционально
    const maxWidth = MAX_WIDTH;
    if (text.width > maxWidth) {
        fontSize = Math.max(20, (maxWidth / text.width) * fontSize);
        text.style.fontSize = fontSize;
    }

    // Генерация текстуры
    const texture = this.core.app.renderer.generateTexture(text, {
        resolution: 3,
        scaleMode: PIXI.SCALE_MODES.LINEAR
    });

    texture.baseTexture.mipmapMode = PIXI.MIPMAP_MODES.ON;
    Cell.NAME_CACHE.set(name, texture);
    text.destroy();

    return texture;
}


        _getMassInstance() {
            const mass = Cell.MASS_POOL.shift();
            if (mass) return mass;
            return new PIXI.Text("", {
  fontFamily: 'Ubuntu, Arial, sans-serif',
  fontWeight: '700',
  fontSize: 50,
  fill: "white",
  stroke: "black",
  strokeThickness: 6,
  lineJoin: "round"
});
        }

        _setNameSprite(value) {
            let nameSprite;
            if (Cell.NAME_CACHE.has(value)) {
                nameSprite = new PIXI.Sprite(Cell.NAME_CACHE.get(value));
            } else {
                nameSprite = new PIXI.Sprite(this._getNameTexture(value));
            }
            if (this.nameSprite) this.nameSprite.destroy();
            nameSprite.anchor.set(0.5);
            this.sprite.addChild(nameSprite);
            this.nameSprite = nameSprite;
        }

        set name(value) {
  if (!this.hasChanged) return;

  // Имя
  if (!this.core.settings.names && this.nameSprite) {
    this.nameSprite.destroy();
    this.nameSprite = null;
  } else if (this.core.settings.names) {
    this._setNameSprite(value);
  }

  // Скины
  if (this.core?.skins) {
    if (this.core.settings.skins) {
      this.core.skins.applyToCell(this, value);
    } else {
      // Настройка выключена — убедимся, что ничего не висит
      if (this.skinSprite) { this.skinSprite.destroy({ children: true }); this.skinSprite = null; }
      if (this.skinMask)   { this.skinMask.destroy(); this.skinMask = null; }
    }
  }

  this._name = value;
}


        get name() {
            return this._name
        }

        set color(value) {
            if (!this.hasChanged) return
            this._color = value
            this.sprite.tint = value
        }

        get color() {
            return this._color
        }

        get mass() {
            return this._mass
        }

        set mass(value) {
            if (this.massSprite) this.massSprite.text = value
            this._mass = value
            if (!this.hasChanged) return
            if (this.massSprite && !this.core.settings.mass) {
                this.massSprite.destroy()
                this.massSprite = null
            } else if (this.name && !this.massSprite && this.core.settings.mass) {
                this.massSprite = this._getMassInstance()
                this.massSprite.anchor.set(0.5, -0.9)
                this.sprite.addChild(this.massSprite)
            }
        }


        update(time) {
            const delta = Math.max(Math.min((time - this.updated) / 80, 1), 0)

            if (this.hasChanged) {
                this.color = this.color
                this.mass = this.mass
                this.name = this.name
                this.hasChanged = false
            }

            this.x = this.ox + (this.nx - this.ox) * delta
            this.y = this.oy + (this.ny - this.oy) * delta
            this.r = this.or + (this.nr - this.or) * delta

            this.mass = Math.round(this.r * this.r / 100)

            // Оптимизация: обновляем позицию только если изменилась
            if (this.sprite.x !== this.x || this.sprite.y !== this.y) {
                this.sprite.x = this.x;
                this.sprite.y = this.y;
            }
            
            // Оптимизация: обновляем масштаб только если изменился (кэшируем предыдущее значение)
            const s = this.r / 256; // 512px база → r/256
            if (this._lastScale !== s) {
                this.sprite.scale.set(s);
                this._lastScale = s;
            }
            
            // Оптимизация: zIndex обновляем только если радиус изменился значительно
            const newZIndex = this.r * 2;
            if (this._lastZIndex !== newZIndex) {
                this.sprite.zIndex = newZIndex;
                this._lastZIndex = newZIndex;
            }
        }


        destroy(killerId) {
            this.core.app.cellsByID.delete(this.id);
            if (this.core.app.ownedCells.remove(this.id) && this.core.app.ownedCells.length === 0) this.core.ui.setPanelState(true)
            this.destroyed = true;
            this.dead = this.core.net.now;

            if (killerId && !this.diedBy) {
                this.diedBy = killerId;
                this.updated = this.core.net.now;
            }

            this.core.app.cells.remove(this)
            this.sprite.destroy({ children: true })
        }

    }



    class ModalSystem {
        constructor() {
            this.modals = new Map()
            this.count = 0
        }

        refresh() {
            const container = document.getElementById("modals-container")
            container.style.display = "none"
            container.innerHTML = ""
            this.modals.forEach(modal => {
                container.style.display = "flex"
                const modalStr = `
            <div class="modal-background"></div>
            <div class="modal anim">
                <div class="modal-header">
                    <div id="${modal.id}-close" class="modal-close">&#10539;</div>
                </div>
                ${modal.content}
            </div>`
                container.insertAdjacentHTML('beforeend', modalStr)
                document.getElementById(`${modal.id}-close`).addEventListener("click", () => { this.removeModal(modal.id) })
            })
        }

        addModal(width, height, content) {
            this.modals.set(++this.count, { id: this.count, width, height, content })
            this.refresh()
            return this.count
        }

        removeModal(id) {
            this.modals.delete(id)
            this.refresh()
        }
    }


    class Settings {
        constructor(core) {
            this.core = core
            this._settings = this.core.store.settings
        }

        get rawSettings() {
            return this._settings
        }
		get skins() {
  return this.rawSettings.skins;
}

set skins(value) {
  this.rawSettings.skins = value;

  // Применить сразу ко всем клеткам
  for (const cell of this.core.app.cells) {
    if (!value) {
      // Выключили — убрать спрайт и маску
      if (cell.skinSprite) { cell.skinSprite.destroy({ children: true }); cell.skinSprite = null; }
      if (cell.skinMask)   { cell.skinMask.destroy(); cell.skinMask = null; }
    } else {
      // Включили — принудительно переустановить имя, чтобы SkinManager навесил скин
      cell.hasChanged = true;
      cell.name = cell.name;
    }
  }
}



        get names() {
            return this.rawSettings.names
        }

        set names(value) {
            for (const cell of this.core.app.cells) cell.hasChanged = true
            this.rawSettings.names = value
        }

        get mass() {
            return this.rawSettings.mass
        }

        set mass(value) {
            for (const cell of this.core.app.cells) cell.hasChanged = true
            this.rawSettings.mass = value
        }

        get background() {
            return this.rawSettings.background
        }

        set background(value) {
    if (this.core.app.backgroundSprite) {
        this.core.app.backgroundSprite.visible = value;
    }
    this.rawSettings.background = value;
}


        get sectors() {
            return this.rawSettings.sectors
        }

        set sectors(value) {
            this.core.app.sectorContainer.visible = value
            this.rawSettings.sectors = value
        }
    }



    class Storage {
        get settings() {
  const defaultSettings = {
	skins: true,
    names: true,
    mass: true,
    background: true,
    sectors: false
  };

  let parsedSettings = {};
  try {
    const raw = localStorage.getItem("cigar3-settings");
    if (raw) parsedSettings = JSON.parse(raw) || {};
  } catch (_) {
    parsedSettings = {};
  }

  // Всегда добавляем недостающие ключи и сохраняем обратно
  const normalized = { ...defaultSettings, ...parsedSettings };
  localStorage.setItem("cigar3-settings", JSON.stringify(normalized));
  return normalized;
}

        set settings(settings) {
            localStorage.setItem("cigar3-settings", JSON.stringify(settings))
        }

        get name() {
            return localStorage.getItem("cigar3-name")
        }

        set name(name) {
            localStorage.setItem("cigar3-name", name)
        }

    }


    const prepareData = a => new DataView(new ArrayBuffer(a));


    class BinaryReader {
        constructor(view) {
            this.view = view;
            this.byteLength = view.byteLength;
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

            for (let byte1; byte1 = this.canRead && this.view.getUint8(this.offset++);) {
                if (byte1 <= 0x7F)
                    text += String.fromCharCode(byte1);
                else if (byte1 <= 0xDF)
                    text += String.fromCharCode(((byte1 & 0x1F) << 6) | (this.view.getUint8(this.offset++) & 0x3F));
                else if (byte1 <= 0xEF)
                    text += String.fromCharCode(((byte1 & 0x0F) << 12) | ((this.view.getUint8(this.offset++) & 0x3F) << 6) | (this.view.getUint8(this.offset++) & 0x3F));
                else {
                    let codePoint = ((byte1 & 0x07) << 18) | ((this.view.getUint8(this.offset++) & 0x3F) << 12) | ((this.view.getUint8(this.offset++) & 0x3F) << 6) | (this.view.getUint8(this.offset++) & 0x3F);

                    if (codePoint >= 0x10000) {
                        codePoint -= 0x10000;
                        text += String.fromCharCode(0xD800 | (codePoint >> 10), 0xDC00 | (codePoint & 0x3FF));
                    }
                    else text += String.fromCharCode(codePoint);
                }
            }

            return text;
        }
    };
    BinaryReader.prototype.offset = 0;

    const getXp = level => ~~(100 * (level ** 2 / 2));
    const getLevel = xp => ~~((xp / 100 * 2) ** .5);

    const normalizeFractlPart = n => (n % (Math.PI * 2)) / (Math.PI * 2);
	

// Капча, которая каждый раз грузит скрипт заново и полностью вычищает его после успеха.
class Captcha {
  constructor({ sitekey, theme = "dark" }) {
    this.sitekey = sitekey;
    this.theme = theme;
    this._widgetId = null;
    this._resolver = null;
    this.token = null;
  }

  // Показать капчу, дождаться токена. После успеха — ПОЛНЫЙ teardown.
  async getToken() {
    await this._loadScriptFresh();  // всегда новая загрузка
    this._ensureHost();
    return new Promise((resolve) => {
      this._resolver = resolve;
      this._render();
    });
  }

  // ---------- private ----------

  _loadScriptFresh() {
    // На всякий случай уберём следы прошлых загрузок перед новой
    this._hardKillTurnstile();

    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      // explicit — сами вызываем render(); добавим cache-buster, чтобы не держались соединения CDNs
      const cb = Date.now().toString(36);
      s.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&_=${cb}`;
      s.async = true; s.defer = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Не удалось загрузить Turnstile"));
      document.head.appendChild(s);
    });
  }

  _ensureHost() {
    const ui = document.getElementById("user-interface");
    if (!ui) { console.error("Нет #user-interface"); return; }
    if (getComputedStyle(ui).position === "static") ui.style.position = "relative";

    let wrap = document.getElementById("captcha-wrapper");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "captcha-wrapper";
      wrap.style.cssText = `
        position:absolute; inset:0; display:grid;
        align-items:center; justify-content:center;
        background:rgba(0,0,0,.6); z-index:99999;`;
      ui.appendChild(wrap);

      const container = document.createElement("div");
      container.id = "captcha-container";
      container.style.cssText = "background:#111;padding:24px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.5);";
      wrap.appendChild(container);
    } else {
      wrap.style.display = "grid";
    }
  }

  _render() {
    const container = document.getElementById("captcha-container");
    if (!container) return;

    // Перестраховка — если был предыдущий widgetId
    if (this._widgetId && window.turnstile) {
      try { window.turnstile.remove(this._widgetId); } catch(_) {}
      this._widgetId = null;
    }

    this._widgetId = window.turnstile.render(container, {
      sitekey: this.sitekey,
      theme: this.theme,
      callback: (token) => this._onSuccess(token),
      "error-callback": () => this._onError("captcha-error"),
      "timeout-callback": () => this._onError("captcha-timeout"),
    });
  }

  _onSuccess(token) {
    this.token = token;

    // Сначала убираем визуальный слой капчи, потом вычищаем всё, что связано с challenges.cloudflare.com
    const wrap = document.getElementById("captcha-wrapper");
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);

    this._hardKillTurnstile(); // ← Полный teardown

    if (this._resolver) {
      const resolve = this._resolver;
      this._resolver = null;
      resolve(token);
    }
  }

  _onError(reason) {
    console.warn("Turnstile issue:", reason);
    // В случае ошибки пробуем пересоздать с жёстким teardown
    this._hardKillTurnstile();
    this._loadScriptFresh().then(() => this._ensureHost()).then(() => this._render());
  }

  _hardKillTurnstile() {
    // 1) Удаляем виджет (iframe)
    if (this._widgetId && window.turnstile) {
      try { window.turnstile.remove(this._widgetId); } catch(_) {}
      this._widgetId = null;
    }

    // 2) Удаляем iframe'ы, связанные с challenges.cloudflare.com (перестраховка)
    document.querySelectorAll('iframe[src*="challenges.cloudflare.com"]').forEach(n => {
      if (n.parentNode) n.parentNode.removeChild(n);
    });

    // 3) Удаляем скрипты Turnstile
    document.querySelectorAll('script[src*="challenges.cloudflare.com/turnstile"]').forEach(s => {
      if (s.parentNode) s.parentNode.removeChild(s);
    });

    // 4) Чистим глобальный объект (скрипт при следующем вызове загрузится заново)
    if (window.turnstile) {
      try { delete window.turnstile; } catch(_) { window.turnstile = undefined; }
    }

    // 5) Чистим возможные дополнительные `<link>` или `<img>` на этот домен (редко, но на всякий случай)
    document.querySelectorAll('link[href*="challenges.cloudflare.com"]').forEach(n => n.parentNode && n.parentNode.removeChild(n));
    document.querySelectorAll('img[src*="challenges.cloudflare.com"]').forEach(n => n.parentNode && n.parentNode.removeChild(n));
  }
}



class SkinManager {
  constructor(core) {
    this.core = core;
    this.nickToCode = new Map();
    this.textureCache = new Map();
    this.ready = false;
  }

  async init() {
    try {
      const res = await fetch("https://api.agar.su/skinlist.txt", { cache: "no-store" });
      const text = await res.text();
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const m = line.match(/^(.+?)[\s:]+(\d+)\s*$/);
        if (m) this.nickToCode.set(m[1].trim().toLowerCase(), m[2].trim());
      }
      this.ready = true;
    } catch (e) {
      console.warn("Не удалось загрузить список скинов:", e);
      this.ready = true;
    }
  }

  getCodeForName(name) {
    if (!name) return null;
    const explicit = String(name).match(/(?:^|\s)nick:(\d+)(?:\s|$)/i);
    if (explicit) return explicit[1];
    return this.nickToCode.get(String(name).trim().toLowerCase()) || null;
  }

  getTextureForCode(code) {
    if (!code) return null;
    if (this.textureCache.has(code)) return this.textureCache.get(code);
    const tex = PIXI.Texture.from(`https://api.agar.su/skins/${code}.png`);
    if (tex?.baseTexture) {
      tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
      tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    }
    this.textureCache.set(code, tex);
    return tex;
  }

  applyToCell(cell, name) {
    const code = this.getCodeForName(name);
    if (!code) {
      if (cell.skinSprite) { cell.skinSprite.destroy({ children: true }); cell.skinSprite = null; }
      if (cell.skinMask)   { cell.skinMask.destroy(); cell.skinMask = null; }
      return;
    }

    const tex = this.getTextureForCode(code);
    if (!tex) return;

    if (!cell.skinSprite) {
      const OVERSCAN = 2; // небольшой запас, чтобы не мелькал цветной край

      // спрайт скина фиксированного размера (масштабируется родителем через sprite.scale)
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5);
      s.width  = 512 + 2 * OVERSCAN;
      s.height = 512 + 2 * OVERSCAN;
      s.zIndex = 2;
      s.roundPixels = false; // важное: не снапать к пикселям
      cell.sprite.addChild(s);
      cell.skinSprite = s;

      // круглая маска фиксированного радиуса (тоже масштабируется родителем)
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff);
      mask.drawCircle(0, 0, 256 + OVERSCAN);
      mask.endFill();
      mask.zIndex = 3;
      mask.cacheAsBitmap = false; // на постоянно масштабируемых масках кэш не нужен
      cell.sprite.addChild(mask);

      s.mask = mask;
      cell.skinMask = mask;
    } else {
      // только меняем текстуру — размеры/маску не трогаем
      cell.skinSprite.texture = tex;
    }
  }
}




    class Network {
        static SERVER_TO_CLIENT = {
            UPDATE_PING: 2,
            UPDATE_NODES: 16,
            SPECTATE_CAMERA: 17,
            // CLEAR_ALL: 300,
            CLEAR_OWNED_CELLS: 20,
            LEADERBOARD_UPDATE: 49,
            BORDER: 64,
            CHAT_MESSAGE: 99,
            UPDATE_EXP: 114
        }

        static CLIENT_TO_SERVER = {
            SPAWN: 0,
            SPECTATE: 0x1,
            MOUSE: 0x10,
            SPLIT_PLAYER: 0x11,
            SPLIT_MINION: 0x16,
            EJECT_PLAYER: 0x15,
            EJECT_MINION: 0x17,
            CHAT: 99
        }

        constructor(core) {
            this.core = core;
			this.captcha = core.captcha;

            this.protocol = "eSejeKSVdysQvZs0ES1H";

            this.onOpen = this.onOpen.bind(this)
            this.onMessage = this.onMessage.bind(this)
            this.onClose = this.onClose.bind(this)
            this.onError = this.onError.bind(this)

            this.leaderboardItems = []
            this.messages = []
            this.border = {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                centerX: 0,
                centerY: 0,
                width: 0,
                height: 0
            }
            this.foodMinSize = 0
            this.foodMaxSize = 0
            this.ownerPlayerId = 0
			this.ping = 0
            this.pingstamp = 0
        }

connect(addr, passedToken) {
  const token = passedToken || (this.captcha && this.captcha.token) || "";
  if (!token) {
    // нет токена — попросим капчу с полным teardown после
    if (this.captcha?.getToken) {
      this.captcha.getToken().then(t => this.connect(addr, t));
    }
    return;
  }

  const params = `?token=${encodeURIComponent(token)}`;
  if (this.ws) this.reset();
  const ws = (this.ws = new WebSocket(addr + params, this.protocol));
  ws.binaryType = "arraybuffer";
  ws.onopen = this.onOpen;
  ws.onmessage = this.onMessage;
  ws.onclose = this.onClose;
  ws.onerror = this.onError;
}





        reset() {
            if (this.ws) this.ws.close()
            this.ws = null
            this.messages = []
            this.border = {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                centerX: 0,
                centerY: 0,
                width: 0,
                height: 0
            }
            this.foodMinSize = 0
            this.foodMaxSize = 0
            this.ownerPlayerId = 0
			this.ping = 0
            this.pingstamp = 0
			clearInterval(this.pingInterval)
            clearInterval(this.mouseMoveInterval)
            cancelAnimationFrame(this.core.app.hueShiftingRAF)
        }

        send(data) {
            if (!this.ws || this.ws.readyState !== 1) return
            if (data.build) this.ws.send(data.build())
            else this.ws.send(data)
        }
		
        sendUint8(a) {
            const msg = prepareData(1);
            msg.setUint8(0, a);
            this.send(msg);
        }
        sendAccountToken() {
            const token = localStorage.accountToken;
            if (token) {
                const msg = prepareData(1 + 2 * token.length);
                msg.setUint8(0, 114);
                for (var i = 0; i < token.length; ++i) msg.setUint16(1 + 2 * i, token.charCodeAt(i), true);
                this.send(msg.buffer);
            }
        }

        onOpen() {
            this.sendAccountToken();

            this.send(new Uint8Array([254, 5, 0, 0, 0]))
            this.send(new Uint8Array([255, 0, 0, 0, 0]))

            //this.spawn();
			this.core.ui.setPanelState(true);
            this.pingInterval = setInterval(() => {

                if (!document.hidden) {
                    this.pingstamp = Date.now();
                    this.send(new Uint8Array([2]).buffer); // ping
                }

            }, 3000);
            this.mouseMoveInterval = setInterval(() => {
                this.sendMouseMove(
                    (this.core.ui.mouse.x - innerWidth / 2) / this.core.app.camera.s + this.core.app.camera.x,
                    (this.core.ui.mouse.y - innerHeight / 2) / this.core.app.camera.s + this.core.app.camera.y
                );
            }, 40);
        }

        onMessage({ data }) {
            this.now = Date.now()

            const reader = new Reader(new DataView(data), 0, true)
            const opcode = reader.getUint8()

            switch (opcode) {
                case Network.SERVER_TO_CLIENT.UPDATE_PING: {
                    this.ping = Date.now() - this.pingstamp;
                    break
                }
                case Network.SERVER_TO_CLIENT.UPDATE_NODES: {
                    const reader = new BinaryReader(
                        new DataView(data)
                    );
                    reader.offset++; // skip messageType
                    this.onNodesUpdate(reader)

                    break
                }
                case Network.SERVER_TO_CLIENT.CLEAR_OWNED_CELLS: {
                    this.onClearOwnedCells()
                    break
                }
                // case Network.SERVER_TO_CLIENT.CLEAR_ALL: { // TODO
                //     this.onClearAll()
                //     break
                // }
                case Network.SERVER_TO_CLIENT.BORDER: {
                    this.onBorder(reader)
                    break
                }
                case Network.SERVER_TO_CLIENT.SPECTATE_CAMERA: {
                    this.onSpectateCamera(reader)
                    break
                }
                case Network.SERVER_TO_CLIENT.LEADERBOARD_UPDATE: {
                    this.onLoaderboard(reader)
                    break
                }
                case Network.SERVER_TO_CLIENT.CHAT_MESSAGE: {
                    this.onChatMessage(reader)
					break;
                }
            }
        }

        onClose() {
            this.core.app.clear()
        }
        onError() {
            this.core.app.clear()
        }

        addCell(id, x, y, r, name, color) {
            let cellsByID = this.core.app.cellsByID
            let cells = this.core.app.cells

            let sprite = new PIXI.Sprite(this.core.app.textures.cell)
            sprite.anchor.set(.5)
			sprite.roundPixels = false;

            this.core.app.stage.addChild(sprite)

            const cell = new Cell(this.core, id, x, y, r, sprite, name, color);
            cellsByID.set(id, cell);
            cells.push(cell);
        }

spawn() {
    const name = this.core.store.name + "#";
    const colorId = getColorId(localStorage.getItem("selectedColor")) || 0;

    const msg = prepareData(4 + 2 * name.length); // 1+1 + имя + 0x0000

    let offset = 0;
    msg.setUint8(offset++, 0);         // opcode
    msg.setUint8(offset++, colorId);   // цвет

    for (let i = 0; i < name.length; i++) {
        msg.setUint16(offset, name.charCodeAt(i), true);
        offset += 2;
    }
    msg.setUint16(offset, 0, true);    // завершающий ноль

    this.send(msg);
}
        spectate() {
            const writer = new Writer(true)
            writer.setUint8(Network.CLIENT_TO_SERVER.SPECTATE)
            this.send(writer)
        }

        sendMouseMove(x, y) {
            const writer = new Writer(true);
            writer.setUint8(Network.CLIENT_TO_SERVER.MOUSE);
            writer.setUint32(x);
            writer.setUint32(y);
            writer._b.push(0, 0, 0, 0);
            this.send(writer);
        }

        sendChatMessage(text) {
            const writer = new Writer()
            writer.setUint8(Network.CLIENT_TO_SERVER.CHAT)
            writer.setUint8(0)
            writer.setStringUTF16(text)
            this.send(writer)
        }

        onChatMessage(reader) {
            const flagMask = reader.getUint8();
            const color = {
                r: reader.getUint8(),
                g: reader.getUint8(),
                b: reader.getUint8()
            }
            const playerXp = reader.getUint32(); // TODO...

            const pId = reader.getUint16(); // TODO...

            const name = reader.getStringUTF16()
            const content = reader.getStringUTF16()
			
			 const lvl = playerXp ? getLevel(playerXp) : -1;
 const nameWithLvl = lvl >= 0 ? `${name} [Lv ${lvl}]` : name;

            this.messages.push({
                color,
                name: nameWithLvl,
                content
            });
            this.core.ui.updateChat()
            this.core.ui.chatContent.scrollTop = 9000000
        }

        onSpectateCamera(reader) {
            this.core.app.camera.target.s = 0.2;
        }

        onLoaderboard(reader) {
            this.leaderboardItems = []
            const count = reader.getUint32()
            for (let i = 0; i < count; ++i) {
                const nodeId = reader.getUint32()
                const name = reader.getStringUTF16()
                const playerXp = reader.getUint32();
                const playerLevel = playerXp ? getLevel(playerXp) : -1; // TODO...
                this.leaderboardItems.push({ id: nodeId, name: name, level: playerLevel })
            }
            this.core.ui.updateLeaderboard()
        }

        onBorder(reader) {
  this.border.left = reader.getFloat64()
  this.border.top = reader.getFloat64()
  this.border.right = reader.getFloat64()
  this.border.bottom = reader.getFloat64()
  // Вычисляем размеры еды и ограничиваем их разумными значениями
  const rawMinSize = Math.sqrt(reader.getUint16() * 100);
  const rawMaxSize = Math.sqrt(reader.getUint16() * 100);
  // Ограничение: еда обычно должна быть маленькой (5-15 пикселей в радиусе)
  const MAX_FOOD_RADIUS = 15;
  this.foodMinSize = Math.min(rawMinSize, MAX_FOOD_RADIUS);
  this.foodMaxSize = Math.min(rawMaxSize, MAX_FOOD_RADIUS);
  // Убеждаемся, что min <= max
  if (this.foodMinSize > this.foodMaxSize) {
    this.foodMaxSize = this.foodMinSize;
  }
  this.ownerPlayerId = reader.getUint32()
  this.border.width = this.border.right - this.border.left
  this.border.height = this.border.bottom - this.border.top
  this.border.centerX = (this.border.left + this.border.right) / 2
  this.border.centerY = (this.border.top + this.border.bottom) / 2
  this.core.app.drawBackground()
  this.core.app.drawGrid()
  this.core.app.drawSectors()

  // >>> ДОБАВЬ ЭТО:
  // Если мы не владеем клетками (спектатор/до спавна) — ставим камеру в центр.
  if (this.core.app.ownedCells.length === 0) {
    const cam = this.core.app.camera;
    cam.x = cam.target.x = this.border.centerX;
    cam.y = cam.target.y = this.border.centerY;

    // Чуть отдалим зум для спектатора: соответствуем логике updateCamera()
    // viewRange()*0.2 — твоя формула для spectate
    const targetZoom = this.core.app.viewRange() * 0.2;
    cam.s = cam.target.s = this.core.app.viewZoom = targetZoom;
  }
}


        sendSplit() {
            const writer = new Writer(true)
            writer.setUint8(Network.CLIENT_TO_SERVER.SPLIT_PLAYER)
            this.send(writer)
        }

        sendE() {
            const writer = new Writer(true)
            writer.setUint8(22)
            this.send(writer)
        }

        sendR() {
            const writer = new Writer(true)
            writer.setUint8(23)
            this.send(writer)
        }

        sendT() {
            const writer = new Writer(true)
            writer.setUint8(24)
            this.send(writer)
        }

        sendP() {
            const writer = new Writer(true)
            writer.setUint8(25)
            this.send(writer)
        }

        sendEject() {
            const writer = new Writer(true)
            writer.setUint8(Network.CLIENT_TO_SERVER.EJECT_PLAYER)
            this.send(writer)
        }

        onClearOwnedCells() {
            this.core.app.ownedCells = []
        }

        onClearAll() {
            this.core.app.clear()
        }

        rgbToHex(arr) {
            let hex = ""

            for (const rawColor of arr) {
                const color = rawColor.toString(16)
                hex += color.length == 1 ? `0${color}` : color
            }

            return `0x${hex}`
        }

        onNodesUpdate(reader) {
            this.core.app.minimapEntity.position.set(((this.core.app.camera.x + this.border.width / 2) / this.border.width) * 250, ((this.core.app.camera.y + this.border.height / 2) / this.border.height) * 250)
            let cellsByID = this.core.app.cellsByID

            // consume records
            for (let killed; killed = reader.uint32();) {
                const killer = reader.uint32();
                if (!cellsByID.has(killer) || !cellsByID.has(killed)) continue;
                cellsByID.get(killed).destroy(killer);
            }

            for (let id; id = reader.uint32();) {
  const type = reader.uint8();

  let posX = 0;
  let posY = 0;
  let size  = 0;      // это радиус!
  let playerId = 0;

  if (type === 1) {
    // еда
    posX = CORE.net.border.left + (CORE.net.border.right * 2) * normalizeFractlPart(id);
    posY = CORE.net.border.top  + (CORE.net.border.bottom * 2) * normalizeFractlPart(id * id);
    // Исправление: правильная формула для размера еды с защитой от деления на ноль
    const sizeRange = Math.max(1, CORE.net.foodMaxSize - CORE.net.foodMinSize);
    size = CORE.net.foodMinSize + (id % sizeRange);
    // Ограничение максимального размера еды (обычно еда должна быть маленькой)
    const MAX_FOOD_SIZE = 15; // максимальный радиус еды
    if (size > MAX_FOOD_SIZE) {
      size = MAX_FOOD_SIZE;
    }
  } else {
    if (type === 0) playerId = reader.uint32();
    posX = reader.int32();
    posY = reader.int32();
    size = reader.uint16(); // ← радиус
  }

  const r = reader.uint8();
  const g = reader.uint8();
  const b = reader.uint8();

  // Оптимизация: более быстрый способ создания hex цвета
  // Вместо toString(16) + padStart используем более эффективный метод
  const hex = ((r << 16) | (g << 8) | b);
  let color = "#" + ("000000" + hex.toString(16)).slice(-6).toUpperCase();

  const spiked = reader.uint8();
  const flagVirus    = !!(spiked & 0x01);
  const flagEjected  = !!(spiked & 0x20);
  const flagAgitated = !!(spiked & 0x10);

  const name = reader.utf8();

  if (cellsByID.has(id)) {
    // обновление существующей клетки
    const cell = cellsByID.get(id);
    cell.update(this.now);
    cell.updated = this.now;

    cell.ox = cell.x;
    cell.oy = cell.y;
    cell.or = cell.r;

    cell.nx = posX;
    cell.ny = posY;
    cell.nr = size;

if (color && color !== cell.color) {
  cell.hasChanged = true;      // ← важная строка
  cell.color = color;          // применится даже когда клетка уже отрисована
}

if (name && name !== cell.name) {
  cell.hasChanged = true;      // ← важная строка
  cell.name = name;            // перерисует текст/скин
}
  } else {
    // новая клетка
    this.addCell(id, posX, posY, size, name, color);

    // сразу применяем текущие имя/цвет через сеттеры (hasChanged уже true)
    const cell = this.core.app.cellsByID.get(id);
    if (cell) {
      cell.color = color;
      cell.name  = name;
    }

    if (playerId === CORE.net.ownerPlayerId) {
      this.core.app.ownedCells.push(id);
    }
  }
}


            // dissapear records
            while (reader.canRead) {
                const killed = reader.uint32();
                if (cellsByID.has(killed) && !cellsByID.get(killed).destroyed)
                    cellsByID.get(killed).destroy(null)
            }
        }
    }

    class Writer {
        constructor(littleEndian = true) {
            this.writer = true;
            this.tmpBuf = new DataView(new ArrayBuffer(8));
            this._e = littleEndian;
            this.reset();
            return this;
        }
        reset(littleEndian = this._e) {
            this._e = littleEndian;
            this._b = [];
            this._o = 0;
        }
        setUint8(a) {
            if (a >= 0 && a < 256) this._b.push(a);
            return this;
        }
        setInt8(a) {
            if (a >= -128 && a < 128) this._b.push(a);
            return this;
        }
        setUint16(a) {
            this.tmpBuf.setUint16(0, a, this._e);
            this._move(2);
            return this;
        }
        setInt16(a) {
            this.tmpBuf.setInt16(0, a, this._e);
            this._move(2);
            return this;
        }
        setUint32(a) {
            this.tmpBuf.setUint32(0, a, this._e);
            this._move(4);
            return this;
        }
        setInt32(a) {
            this.tmpBuf.setInt32(0, a, this._e);
            this._move(4);
            return this;
        }
        setFloat32(a) {
            this.tmpBuf.setFloat32(0, a, this._e);
            this._move(4);
            return this;
        }
        setFloat64(a) {
            this.tmpBuf.setFloat64(0, a, this._e);
            this._move(8);
            return this;
        }
        _move(b) {
            for (let i = 0; i < b; i++) this._b.push(this.tmpBuf.getUint8(i));
        }
        setStringUTF8(s) {
            const bytesStr = unescape(encodeURIComponent(s));
            for (let i = 0, l = bytesStr.length; i < l; i++) this._b.push(bytesStr.charCodeAt(i));
            this._b.push(0);
            return this;
        }

        setStringUTF16(s) {
            for (let i = 0; i < s.length; i++) {
                this.setUint16(s.charCodeAt(i));
            }
            this.setUint16(0);
            return this;
        }

        build() {
            return new Uint8Array(this._b);
        }
    }


    class Reader {
        constructor(view, offset, littleEndian) {
            this.reader = true;
            this._e = littleEndian;
            if (view) this.repurpose(view, offset);
        }
        repurpose(view, offset) {
            this.view = view;
            this._o = offset || 0;
        }
        getUint8() {
            return this.view.getUint8(this._o++, this._e);
        }
        getInt8() {
            return this.view.getInt8(this._o++, this._e);
        }
        getUint16() {
            return this.view.getUint16((this._o += 2) - 2, this._e);
        }
        getInt16() {
            return this.view.getInt16((this._o += 2) - 2, this._e);
        }
        getUint32() {
            return this.view.getUint32((this._o += 4) - 4, this._e);
        }
        getInt32() {
            return this.view.getInt32((this._o += 4) - 4, this._e);
        }
        getFloat32() {
            return this.view.getFloat32((this._o += 4) - 4, this._e);
        }
        getFloat64() {
            return this.view.getFloat64((this._o += 8) - 8, this._e);
        }
        getStringUTF8() {
            let s = '', b;
            while ((b = this.view.getUint8(this._o++)) !== 0) s += String.fromCharCode(b);
            return decodeURIComponent(escape(s));
        }
        getStringUTF16() {
            let s = '', b;
            while ((b = this.view.getUint16(this._o, true)) !== 0) {
                this._o += 2;
                s += String.fromCharCode(b);
            }
            this._o += 2;
            return s;
        }
    }


    class Application {
        constructor(core) {
            this.core = core

            this.initRenderer()
            this.initMinimap()

            this.cells = []
            this.cellsByID = new Map()
            this.ownedCells = []
            this.camera = {
                x: 1,
                y: 1,
                s: 1,
                w: 1,
                score: 0,
                target: {
                    x: 1,
                    y: 1,
                    s: 1
                }
            }
			// Лимиты зума: для игры и для спектатора
this.zoomLimits = {
  player:   { min: 0.2, max: 8 }, // когда у тебя есть клетки
  spectate: { min: 0.04, max: 8 } // когда ты в спектате (без клеток)
};
            this.zoom = 0.7;      // колесо (как старый zoom)
            this.viewZoom = 1;  // сглаженный итоговый масштаб
            // >>> Добавь это:
            this._fpsFrames = 0;
            this._fpsLast = performance.now();
            this._fpsUpdateMs = 500; // усредняем каждые ~0.5 c
            this.core.stats = this.core.stats || {};
            this.core.stats.fps = 0;
            // Кэш для оптимизации updateCamera
            this._lastPivotX = 0;
            this._lastPivotY = 0;
            this._lastScale = 1;
            this.loop = this.loop.bind(this)

            this.loop()
        }
viewRange() {
  // как в old main_out: ratio по окну * zoom
  const ratio = Math.max(this.renderer.height / 1080, this.renderer.width / 1920);
  return ratio * this.zoom; // zoom берётся из колеса
}

// sumR — сумма радиусов owned-клеток (в старом коде суммировали size=radius)
calcViewZoom(sumR) {
  // newViewZoom = (min(64/sumR,1))^0.4 * viewRange, затем сглаживание 9/10
  const safeSum = Math.max(1e-6, sumR);
  const newViewZoom = Math.pow(Math.min(64 / safeSum, 1), 0.4) * this.viewRange();
  this.viewZoom = (9 * this.viewZoom + newViewZoom) / 10;
}


        drawBorder() {
            if (this.borderGraphics) this.borderGraphics.destroy()

            const border = this.core.net.border
            this.borderGraphics = new PIXI.Graphics()
                .lineStyle(50, 0xffffff)
                .drawRect(-border.width / 2, -border.height / 2, border.width, border.height);
            this.borderGraphics.visible = this.core.settings.border

            this.stage.addChild(this.borderGraphics)
        }
drawBackground() {
  const border = this.core.net.border;
  const mapW = border.width;
  const mapH = border.height;

  const geometry = new PIXI.Geometry()
    .addAttribute('aVertexPosition', [
      -mapW / 2, -mapH / 2,
       mapW / 2, -mapH / 2,
      -mapW / 2,  mapH / 2,
       mapW / 2,  mapH / 2,
    ])
    .addAttribute('aUvs', [0, 0, 1, 0, 0, 1, 1, 1])
    .addIndex([0, 1, 2, 1, 3, 2]);

  const shader = PIXI.Shader.from(`
    precision highp float;
    attribute vec2 aVertexPosition;
    attribute vec2 aUvs;
    uniform mat3 translationMatrix;
    uniform mat3 projectionMatrix;
    varying vec2 vUvs;
    void main() {
      vUvs = aUvs;
      gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    }
  `, `
    precision highp float;
    varying vec2 vUvs;

    uniform vec2 uCenter;

    // Максимально плавный градиент
    float smoothGradient(float t) {
      t = clamp(t, 0.0, 1.0);
      return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    }

    // Дизеринг против banding
    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUvs;
      float dist = length(uv - uCenter); // 0..~0.707

      // Нормализуем расстояние: 0 = центр, 1 = угол
      float t = dist / 0.65; 

      // Инвертируем: центр = 1, края = 0
      float intensity = 0.9 - smoothGradient(t);

      // Цвета как на скрине
      vec3 centerColor = vec3(0.075, 0.153, 0.271); // #132745 — центр
      vec3 edgeColor   = vec3(0.0, 0.0, 0.0);       // #000000 - край

      vec3 color = mix(edgeColor, centerColor, intensity);

      // Дизеринг
      color += (noise(uv * 1200.0) - 0.5) * 0.018;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `, {
    uCenter: [0.5, 0.5]
  });

  const bg = new PIXI.Mesh(geometry, shader);
  bg.position.set(0, 0);
  bg.zIndex = -1000;
  bg.visible = this.core.settings.background;
  this.stage.addChild(bg);
  this.backgroundSprite = bg;
}




        performHueShifting() {
            this.hueDegree += 1
            if (this.hueDegree > 360) this.hueDegree = 0
            this.colorMatrix.hue(this.hueDegree)
            this.hueShiftingRAF = requestAnimationFrame(this.performHueShifting.bind(this))
        }

        drawGrid() {
            if (this.gridSprite) this.gridSprite.destroy()

            const border = this.core.net.border
            const g = new PIXI.Graphics()
            const width = 100
            const height = 100
            g.lineStyle(10, 0x333333, 1)
            g.moveTo(width, 0)
            g.lineTo(0, 0)
            g.moveTo(width / 2, height / 2)
            g.lineTo(width / 2, -height / 2)
            const texture = this.renderer.generateTexture(g, {
                scaleMode: PIXI.SCALE_MODES.LINEAR,
                resolution: 1,
                region: new PIXI.Rectangle(0, 0, width / 2, height / 2)
            })
            texture.baseTexture.mipmapMode = PIXI.MIPMAP_MODES.ON
            this.gridSprite = new PIXI.TilingSprite(texture, border.width, border.height)
            this.gridSprite.position.set(-border.width / 2, -border.height / 2)
            this.gridSprite.visible = this.core.settings.grid

            this.stage.addChild(this.gridSprite)
        }

        drawSectors() {
            if (this.sectorContainer) this.sectorContainer.destroy()

            const labels = []
            const rows = 5
            const cols = 5
            const sectorSize = this.core.net.border.width / 5
            this.sectorContainer = new PIXI.Container()
            for (let row = 0; row < rows; row++) {
                labels[row] = []
                for (let col = 0; col < cols; col++) {
                    const square = new PIXI.Graphics()
                    square.lineStyle(100, 0x444444)
                    square.drawRect(0, 0, sectorSize, sectorSize);
                    square.position.set(col * sectorSize, row * sectorSize)
                    const label = new PIXI.Text(String.fromCharCode(65 + row) + (col + 1), {
                          fontFamily: 'Ubuntu, Arial, sans-serif',
						  fontWeight: '700',
                        fontSize: 1024,
                        fill: 0x444444
                    })
                    label.position.set(
                        col * sectorSize + (sectorSize - label.width) / 2,
                        row * sectorSize + (sectorSize - label.height) / 2
                    )
                    const sector = new PIXI.Container()
                    sector.addChild(square, label)
                    this.sectorContainer.addChild(sector)
                }
            }
            this.sectorContainer.position.set(-1 * sectorSize * 5 / 2, -1 * sectorSize * 5 / 2)
            this.sectorContainer.visible = this.core.settings.sectors

            this.stage.addChild(this.sectorContainer)
        }

        initMinimap() {
            const view = this.minimapView = document.getElementById("minimap-view")
            this.minimapRenderer = PIXI.autoDetectRenderer({
                view,
                width: 250,
                height: 250,
                backgroundAlpha: 0,
                antialias: false
            })
            const sprite = this.minimapEntity = new PIXI.Sprite(PIXI.Texture.WHITE)
            sprite.width = 10
            sprite.height = 10
            sprite.anchor.set(.5)
            const stage = this.minimapStage = new PIXI.Container()
            stage.addChild(sprite)
        }

        initRenderer() {
            const view = this.view = document.getElementById("view")
            this.renderer = PIXI.autoDetectRenderer({
                view,
                width: innerWidth,
                height: innerHeight,
                antialias: false,
                powerPreference: 'high-performance'
            })
            this.stage = new PIXI.Container()
            this.stage.sortableChildren = true

            const circle = new PIXI.Graphics()
            circle.beginFill(0xffffff)
            circle.drawCircle(256, 256, 256)
            circle.endFill();

            const star = new PIXI.Graphics()
                .beginFill(0xffffff)
                .lineStyle(10, 0x777777, 1)
                .drawPolygon(new Star(256, 256, 30, 256, 220, 0))
                .endFill();

            const cellRenderTexture = PIXI.RenderTexture.create({ width: 512, height: 512 })
            this.renderer.render(circle, { renderTexture: cellRenderTexture })
            cellRenderTexture.baseTexture.mipmapMode = PIXI.MIPMAP_MODES.ON


            this.textures = { cell: cellRenderTexture}

            Cell.SPRITE = new PIXI.Sprite(cellRenderTexture)
        }


        loop(now = performance.now()) {
            this.now = Date.now();
            
            // Оптимизация: убрали slice(0) - итерируемся напрямую по массиву
            // Оптимизация: добавляем frustum culling для видимых клеток
            const cam = this.camera;
            const viewWidth = innerWidth / cam.s;
            const viewHeight = innerHeight / cam.s;
            const viewLeft = cam.x - viewWidth / 2;
            const viewRight = cam.x + viewWidth / 2;
            const viewTop = cam.y - viewHeight / 2;
            const viewBottom = cam.y + viewHeight / 2;
            
            // Обновляем только видимые клетки и проверяем видимость
            for (let i = 0, len = this.cells.length; i < len; i++) {
                const cell = this.cells[i];
                if (!cell || cell.destroyed) continue;
                
                // Frustum culling: проверяем видимость клетки
                const cellLeft = cell.x - cell.r;
                const cellRight = cell.x + cell.r;
                const cellTop = cell.y - cell.r;
                const cellBottom = cell.y + cell.r;
                
                const isVisible = !(cellRight < viewLeft || cellLeft > viewRight || 
                                   cellBottom < viewTop || cellTop > viewBottom);
                
                if (isVisible !== cell._visible) {
                    cell._visible = isVisible;
                    cell.sprite.visible = isVisible;
                }
                
                // Обновляем только видимые клетки
                if (isVisible) {
                    cell.update(this.now);
                }
            }
            
            this.updateCamera();

            this.renderer.render(this.stage);
            this.minimapRenderer.render(this.minimapStage);

            // >>> Подсчёт FPS
            this._fpsFrames++;
            const dt = now - this._fpsLast;
            if (dt >= this._fpsUpdateMs) {
                this.core.stats.fps = (this._fpsFrames * 1000) / dt;
                this._fpsFrames = 0;
                this._fpsLast = now;
            }

            requestAnimationFrame(this.loop);
        }


        clear() {
            this.stage.removeChildren()
            this.cells = []
            this.cellsByID = new Map()
            this.ownedCells = []
        }


updateCamera() {
	  const hasCells = this.ownedCells.length > 0;
  const lim = hasCells ? this.zoomLimits.player : this.zoomLimits.spectate;
  this.zoom = Math.max(lim.min, Math.min(lim.max, this.zoom));
  
  // Оптимизация: кэшируем ownedCells для избежания повторных обращений к Map
  const ownedCount = this.ownedCells.length;
  let score = 0;
  let sumR = 0;
  let targetX = 0;
  let targetY = 0;

  if (ownedCount > 0) {
    // --- есть клетки: оптимизированный цикл ---
    let validCells = 0;
    for (let i = 0; i < ownedCount; i++) {
      const cell = this.cellsByID.get(this.ownedCells[i]);
      if (!cell || cell.destroyed) continue;
      
      validCells++;
      const rSquared = cell.r * cell.r;
      score += ~~(rSquared / 100);
      targetX += cell.x;
      targetY += cell.y;
      sumR += cell.r;
    }
    
    if (validCells > 0) {
      this.camera.target.x = targetX / validCells;
      this.camera.target.y = targetY / validCells;
      this.calcViewZoom(sumR);
    }
  } else {
    // --- нет клеток: отдаляем зум и делаем более плавное следование ---
    let targetZoom = this.viewRange() * 0.2
    this.viewZoom = (9 * this.viewZoom + targetZoom) / 10;
  }

  // сглаживание: при клетках /2, без клеток /7
  const followDiv = (ownedCount > 0) ? 2 : 14;

  // позиция камеры — мягкое следование
  this.camera.x += (this.camera.target.x - this.camera.x) / followDiv;
  this.camera.y += (this.camera.target.y - this.camera.y) / followDiv;

  // масштаб камеры = viewZoom; сглаживаем тем же коэффициентом
  this.camera.target.s = this.viewZoom;
  this.camera.s += (this.camera.target.s - this.camera.s) / followDiv;

  // Оптимизация: обновляем stage только если значения изменились
  if (this._lastPivotX !== this.camera.x || this._lastPivotY !== this.camera.y) {
    this.stage.pivot.set(this.camera.x, this.camera.y);
    this._lastPivotX = this.camera.x;
    this._lastPivotY = this.camera.y;
  }
  
  if (this._lastScale !== this.camera.s) {
    this.stage.scale.set(this.camera.s);
    this._lastScale = this.camera.s;
  }
  
  // position всегда обновляем (может измениться размер окна)
  this.stage.position.set(innerWidth / 2, innerHeight / 2);

  this.camera.score = score;
}



    }

    class Star extends PIXI.Polygon {
        constructor(x, y, points, radius, innerRadius, rotation = 0) {
            innerRadius = innerRadius || radius / 2

            const startAngle = (-1 * Math.PI / 2) + rotation
            const len = points * 2
            const delta = PIXI.PI_2 / len
            const polygon = []

            for (let i = 0; i < len; i++) {
                const r = i % 2 ? innerRadius : radius
                const angle = (i * delta) + startAngle

                polygon.push(
                    x + (r * Math.cos(angle)),
                    y + (r * Math.sin(angle))
                );
            }

            super(polygon)
        }
    }

    class UserInterface {

        constructor(core) {
            this.core = core

            this.modalSystem = new ModalSystem()

            this.mouse = {
                x: 0,
                y: 0
            }

            this.keysPressed = {};
            this.ejectInterval = null;

            this.userInterface = document.getElementById("user-interface")
            this.playButton = document.getElementById("play")
            this.spectateButton = document.getElementById("spectate")
            this.settingsButton = document.getElementById("settings")
            this.nameInput = document.getElementById("name")
            this.serversButton = document.getElementById("servers")
            this.scoreElement = document.getElementById("score")
            this.fpsElement = document.getElementById("fps")
            this.leaderboard = document.getElementById("leaderboard")
            this.chatField = document.getElementById("chat-field")
            this.chatContent = document.getElementById("chat-content")
            setInterval(() => {
                this.scoreElement.innerHTML = `Score: ${this.core.app.camera.score}`;
                // добавим FPS прямо к Ping
                const fps = this.core.stats?.fps || 0;
                this.fpsElement.innerHTML = `Ping: ${this.core.net.ping} FPS: ${fps.toFixed(0)}`;
            }, 40);
            this.nameInput.value = this.core.store.name
            this.addEvents()
        }

        addEvents() {
            this.onPlay = this.onPlay.bind(this)
            this.onSpectate = this.onSpectate.bind(this)
            this.onSettings = this.onSettings.bind(this)
            this.onKeyDown = this.onKeyDown.bind(this)
            this.onNameChange = this.onNameChange.bind(this)
            this.onMouseMove = this.onMouseMove.bind(this)
            this.onResize = this.onResize.bind(this)
            this.onScroll = this.onScroll.bind(this)
            this.onServers = this.onServers.bind(this)
            this.onKeyUp = this.onKeyUp.bind(this)

            this.playButton.addEventListener("click", this.onPlay)
            this.spectateButton.addEventListener("click", this.onSpectate)
            this.settingsButton.addEventListener("click", this.onSettings)
            this.serversButton.addEventListener("click", this.onServers)
            addEventListener("keydown", this.onKeyDown);
            addEventListener("keyup", this.onKeyUp);
            this.nameInput.addEventListener("change", this.onNameChange)
            this.core.app.view.addEventListener("mousemove", this.onMouseMove)
            this.core.app.view.addEventListener('wheel', this.onScroll, {
                passive: true
            })
			const updateMouseAim = () => {

                const X = (CORE.ui.mouse.x - innerWidth / 2) / CORE.app.camera.s + CORE.app.camera.x;
                const Y = (CORE.ui.mouse.y - innerHeight / 2) / CORE.app.camera.s + CORE.app.camera.y;

                let x = X < CORE.net.border.right ? X : CORE.net.border.right;
                let y = Y < CORE.net.border.bottom ? Y : CORE.net.border.bottom;
                x = -CORE.net.border.right > x ? -CORE.net.border.right : x;
                y = -CORE.net.border.bottom > y ? -CORE.net.border.bottom : y;

                // change cords
                CORE.app.camera.target.x = x;
                CORE.app.camera.target.y = y;

            };

            this.core.app.view.addEventListener("mousedown", () => {
  if (!CORE.app.ownedCells.length) {
    updateMouseAim();
    CORE.net.sendUint8(1); // CLIENT_TO_SERVER.SPECTATE
  }
});
            addEventListener("resize", this.onResize)
            addEventListener("beforeunload", (event) => {
                this.core.store.settings = this.core.settings.rawSettings
                event.cancelBubble = true
                event.returnValue = 'You sure you want to leave?'
                event.preventDefault()
            })
			
			window.addEventListener("blur", () => {
    this.resetKeys();
});

// 2. Страница стала скрытой (смена вкладки, открытие devtools и т.п.)
document.addEventListener("visibilitychange", () => {
    if (document.hidden) this.resetKeys();
});

// 3. Открытие контекстного меню (ПКМ → KeyUp не приходит)
window.addEventListener("contextmenu", () => {
    this.resetKeys();
});
        }
		
		resetKeys() {
    // сбрасываем все клавиши
    for (const key in this.keysPressed) {
        this.keysPressed[key] = false;
    }

    // останавливаем W-интервал
    if (this.ejectInterval) {
        clearInterval(this.ejectInterval);
        this.ejectInterval = null;
    }
}
		






        onPlay() {
            this.core.net.spawn()
            this.setPanelState(false)
        }

        onSpectate() {
            this.setPanelState(false)
            this.core.net.spectate()
        }

        onServers() {
            let contentStr = `<div class="modal-servers-content">`
            this.modalSystem.addModal(400, 500, "")
        }

        onSettings() {
            let contentStr = `<div class="modal-settings-content">`
            const settings = this.core.settings.rawSettings
            for (const setting in settings) {
                const inputValue = setting.replace(/[A-Z]/g, char => ' ' + char.toLowerCase())
                contentStr += `
            <div class="modal-settings-tile">
            ${inputValue}<input type="checkbox" id="setting-${setting}" ${settings[setting] ? "checked" : ""}>
            </div>
            `
            }
            contentStr += `</div>`
            this.modalSystem.addModal(200, null, contentStr)

            for (const setting in settings) {
                document.getElementById(`setting-${setting}`).addEventListener("click", () => {
                    this.core.settings[setting] = !this.core.settings[setting]
                })
            }
        }

        updateLeaderboard() {
            // Оптимизация: используем DocumentFragment для батчинга DOM операций
            const leaderboard = this.core.net.leaderboardItems;
            const ownedSet = new Set(this.core.app.ownedCells); // Set для O(1) поиска вместо O(n) some()
            
            // Оптимизация: используем createDocumentFragment для батчинга
            const fragment = document.createDocumentFragment();
            const tempDiv = document.createElement('div');
            
            for (const player of leaderboard) {
                const lvl = (player.level != null && player.level >= 0) ? ` <span style="opacity:.8">[Lv ${player.level}]</span>` : "";
                const isOwned = ownedSet.has(player.id);
                tempDiv.innerHTML = `<div class="hud-leaderboard-tile ${isOwned ? "red-text" : ""}">${player.name}${lvl}</div>`;
                fragment.appendChild(tempDiv.firstElementChild);
            }
            
            this.leaderboard.innerHTML = "";
            this.leaderboard.appendChild(fragment);
        }

        updateChat() {
            // Оптимизация: используем DocumentFragment для батчинга DOM операций
            const messages = this.core.net.messages;
            const fragment = document.createDocumentFragment();
            const tempDiv = document.createElement('div');
            
            for (const message of messages) {
                tempDiv.innerHTML = `
            <div class="hud-message-tile">
                <span class="hud-message-item" style="color: rgb(${message.color.r}, ${message.color.g}, ${message.color.b})">
                    ${message.name}: <span class="hud-message">${message.content}</span>
                </span>
            </div>`;
                fragment.appendChild(tempDiv.firstElementChild);
            }
            
            this.chatContent.innerHTML = "";
            this.chatContent.appendChild(fragment);
        }

        onServers() {
  let contentStr = `<div class="modal-servers-content">`;
  for (const ip in this.core.app.servers) {
    const server = this.core.app.servers[ip];
    contentStr += `
      <div class="modal-servers-tile">
        <div class="round">${server.name} - ${ip}</div>
        <div id="server-${ip}" class="button center">Connect</div>
      </div>`;
  }
  contentStr += `</div>`;
  const modalID = this.modalSystem.addModal(300, null, contentStr);

  // обработчик подключения
for (const ip in this.core.app.servers) {
// внутри UserInterface.onServers(), обработчик клика
document.getElementById(`server-${ip}`).addEventListener("click", async () => {
  this.modalSystem.removeModal(modalID);

  const url = `ws${location.protocol === 'https:' ? 's' : ''}://${ip}`;
  console.log("Switching server to:", url);

  // закрываем старый сокет
  if (this.core.net?.ws) {
    try { this.core.net.ws.close(); } catch (e) {}
	this.core.app.clear();
    this.core.net.reset();
  }

  // КАПЧА -> КОННЕКТ (гарантированно покажется)
  const token = await this.core.captcha.getToken();
  this.core.net.connect(url, token);
});


}

}


        onMouseMove({
            clientX,
            clientY
        }) {
            this.mouse.x = clientX
            this.mouse.y = clientY
        }

onScroll({ deltaY }) {
  const app = this.core.app;
  const steps = (deltaY || 0) / 120;
  app.zoom *= Math.pow(0.9, steps);
}


        onKeyDown({
            code
        }) {
            this.keysPressed[code] = true;

            switch (code) {
                case "Escape":
                    this.setPanelState(true);
                    break;
                case "KeyW":
                    if (!this.ejectInterval) {
                        this.core.net.sendEject();
                        this.ejectInterval = setInterval(() => {
                            if (this.keysPressed["KeyW"]) this.core.net.sendEject();
                            else clearInterval(this.ejectInterval);
                        }, 50);
                    }
                    break;
                case "Space":
                    this.core.net.sendSplit();
                    break;
                case "Enter":
                    if (document.activeElement === this.chatField) {
                        const value = this.chatField.value;
                        if (value !== "") this.core.net.sendChatMessage(value);
                        this.chatField.blur();
                        this.chatField.value = "";
                    } else this.chatField.focus();
                    break;
                case "KeyE":
                    this.core.net.sendE();
                    break;
                case "KeyR":
                    this.core.net.sendR();
                    break;
                case "KeyT":
                    this.core.net.sendT();
                    break;
                case "KeyP":
                    this.core.net.sendP();
                    break;
            }
        }

        onKeyUp({
            code
        }) {
            this.keysPressed[code] = false;

            if (code === "KeyW" && this.ejectInterval) {
                clearInterval(this.ejectInterval);
                this.ejectInterval = null;
            }
        }

        onResize() {
            this.core.app.renderer.resize(innerWidth, innerHeight)
        }

        setPanelState(show) {
            if (show) this.userInterface.style.display = "grid"
            else this.userInterface.style.display = "none"
        }

        onNameChange() {
  const n = this.nameInput.value;
  this.core.store.name = n;

  // ПРОГНАТЬ НОВОЕ ИМЯ ПО ВСЕМ СВОИМ ЖИВЫМ КЛЕТКАМ
  for (const id of this.core.app.ownedCells) {
    const cell = this.core.app.cellsByID.get(id);
    if (!cell) continue;
    cell.hasChanged = true; // разрешаем сеттеру перерисовать
    cell.name = n;          // перерисует текст и скин
  }
}
    }


    class main {
        constructor() {
            this.init();
        }

async init() {
  this.app = new Application(this);
  this.store = new Storage();
  this.settings = new Settings(this);
  this.captcha = new Captcha({ sitekey: "0x4AAAAAAA0keHJ56_KNR0MU", theme: "dark" });
  this.net = new Network(this);
  this.ui = new UserInterface(this);
  this.app.servers = servers;
  this.skins = new SkinManager(this);
  this.account = { xp: 0, uid: localStorage.accountToken || "" };
  
  await this.skins.init();

  const url = `ws${location.protocol === 'https:' ? 's' : ''}://${Object.keys(servers)[0]}`;
  this.defaultServerUrl = url;
  console.log("Prepared to connect to", url);

  // капча -> токен -> коннект
  const token = await this.captcha.getToken();
  this.net.connect(url, token);
}


    }

    global.CORE = new main();
})(window);
