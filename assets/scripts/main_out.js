(function (wHandle, wjQuery) {
	
	function getStarClass(level) {
    if (level >= 1 && level < 50) return "";           // обычная
    if (level >= 50 && level < 100) return "azure";    // голубая
    if (level >= 100 && level < 150) return "red";     // красная
    if (level >= 150) return "white";                  // белая
    return "";
}

const MAX_LEVEL_XP = 2000000;
const getXp = level => ~~(100 * (level ** 2 / 2));
const getLevel = xp => ~~((xp / 100 * 2) ** 0.5);
const packetXpToRealXp = packetXp => packetXp > 0 ? packetXp - 1 : 0;

function createLevelIndicator(packetXp, accountAvatar) {
    const level = packetXp ? getLevel(packetXp) : -1;
    if (level <= 0) return null;

    const realXp = packetXpToRealXp(packetXp);
    const container = document.createElement("div");
    container.className = "star-container";

    if (realXp >= MAX_LEVEL_XP && accountAvatar) {
        const img = document.createElement("img");
        img.className = "account-level-avatar";
        img.src = accountAvatar;
        img.alt = "";
        img.onerror = () => { container.style.display = "none"; };
        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.textContent = `XP: ${realXp}`;
        container.appendChild(img);
        container.appendChild(tooltip);
    } else {
        const starIcon = document.createElement("i");
        starIcon.className = "fas fa-star " + getStarClass(level);

        const levelSpan = document.createElement("span");
        levelSpan.className = "levelme " + getStarClass(level);
        levelSpan.textContent = level;

        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.textContent = `XP: ${realXp}`;

        container.appendChild(starIcon);
        container.appendChild(levelSpan);
        container.appendChild(tooltip);
    }

    return container;
}
	
	
	                        // Функция для получения данных статистики
                        async function fetchStats(stats) { // Изменяем здесь, чтобы принимать stats
                            try {
                                // Убедимся, что stats переданы и являются массивом
                                if (!Array.isArray(stats)) {
                                    throw new Error('Invalid stats data');
                                }

                                const skinsMap = await loadSkinsList(); // Загрузка skinsList

                                // Обновляем каждый player в stats
                                stats.forEach(player => {
const normalizedNick = normalizeNick(player.nick);           // ← правильно!
            const skinId = skinsMap.get(normalizedNick) || 'PPFtwqH';   // теперь ищет по нормализованному нику
            player.skin = skinId;
                                });

                                displayStats(stats);
                            } catch (error) {
                                console.error('There was a problem with the fetch operation:', error);
                            }
                        }

                        // Функция для отображения статистики
                        function displayStats(stats) {
                            const container = document.getElementById('table-containerwraper');
                            container.innerHTML = ''; // Очищаем контейнер перед добавлением новых данных


stats.forEach((player, index) => {
    const playerDiv = document.createElement('div');
    playerDiv.classList.add('top-playerwraper');
    playerDiv.setAttribute('title', player.time); // добавляем атрибут title
    playerDiv.innerHTML = `
        <div>${index + 1}</div>
        <div>${player.nick}</div>
        <div>${player.score}</div>
        <div class="skinswraper"style="background-image: url('https://api.agar.su/skins/${player.skin}.png');"></div>
    `;
    container.appendChild(playerDiv);
});
                        }
	
    // По умолчанию выбранный сервер
    let SELECTED_SERVER = wHandle.CONNECTION_URL || "ffa.agar.su";

    // --- Подсветка активного сервера из hash ---
    function setActiveFromHash() {
        const hash = location.hash.replace('#','') || 'ffa'; // по умолчанию ffa
        document.querySelectorAll('.gamemode li').forEach(li => li.classList.remove('active'));
        const activeLi = document.getElementById(hash);
		const titleEl = document.getElementById('serverTitle');
        if(activeLi) {
            activeLi.classList.add('active');
			titleEl.textContent = `Статистика ${hash}`;
            // Если сервер ещё не выбран руками — ставим его
            if (!SELECTED_SERVER) {
                SELECTED_SERVER = activeLi.dataset.ip;
            }
			chekstats();
        }
    }

// Вызывать при загрузке и при смене хэша
window.addEventListener('load', setActiveFromHash);
window.addEventListener('hashchange', setActiveFromHash);

// Обновление онлайн
// Перехват .show() / .hide() overlay для динамического запуска/остановки интервала
    (function($) {
        const oldShow = $.fn.show;
        const oldHide = $.fn.hide;

        $.fn.show = function(...args) {
            if (this.is("#overlays")) {
                // сразу обновляем онлайн
                updateOnlineCount();
                // запускаем интервал, если ещё не запущен
                if (!window.onlineInterval) {
                    window.onlineInterval = setInterval(updateOnlineCount, 5000);
                }
            }
            return oldShow.apply(this, args);
        };

        $.fn.hide = function(...args) {
            if (this.is("#overlays") && window.onlineInterval) {
                clearInterval(window.onlineInterval);
                window.onlineInterval = null;
            }
            return oldHide.apply(this, args);
        };
    })(wjQuery);

const ONLINE_HUB_URL = "https://api.agar.su:6008/online?1";

// Онлайн: клиент ← api.agar.su:6008 ← игровые серверы (POST /report)
async function updateOnlineCount() {
    let rows = [];
    try {
        const res = await fetch(ONLINE_HUB_URL, { cache: "no-store" });
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

        const playing = row.playing ?? 0;       // в игре (есть клетки)
        const observers = row.no_playing ?? 0;  // наблюдатели / в меню на сервере
        const max = row.max ?? 0;               // лимит с gameserver.ini (onlineHubMax)

        totalOnline += playing + observers;

        const li = document.getElementById(id);
        if (li) {
            const spans = li.querySelectorAll(".online-count");
            if (spans.length >= 2) {
                spans[0].textContent = observers;
                spans[1].textContent = max > 0 ? `${playing}/${max}` : String(playing);
            }
        }
    }

    const onlineElement = document.getElementById("online");
    if (onlineElement) {
        onlineElement.textContent = `Онлайн: ${totalOnline}`;
    }
}



    // Если overlay изначально видим, запускаем сразу обновление и интервал
    if (wjQuery("#overlays").is(":visible")) {
        updateOnlineCount();
        window.onlineInterval = setInterval(updateOnlineCount, 5000);
    }
	
const forbiddenChars = ["﷽", "𒐫", "𒈙", "⸻", "꧅", "ဪ", "௵", "௸", "‱", "ㅤ", "⁣","‎ ", "​", "‌", "‍", "‎", "‏", " ", " ", " ", " ", " "," ", " ", " ", " ", " ", " ", "​", "﻿", "", " ","⠀","ﾠ","卐","卍"]; //  ЗАПРЕЩЕНО!

wHandle.startGame = function () {
    let nickInput = document.getElementById('nick').value.trim();
    let passInput = document.getElementById('pass').value;

    // Удаляем запрещённые символы
    const forbiddenRegex = new RegExp(forbiddenChars.join('|'), 'g');
    nickInput = nickInput.replace(forbiddenRegex, '');
	nickInput =  censorMessage(nickInput);

    // Ограничиваем длину
    if (nickInput.length > 16) nickInput = nickInput.substring(0, 16);
    if (passInput.length > 8) passInput = passInput.substring(0, 8);

    setNick(nickInput + "#" + passInput);
};



    // Функция для загрузки данных о топ-1 игроке
    wHandle.chekstats = async function () {
        try {
            // Получаем текущий домен из CONNECTION_URL (или другого источника)
            const statsUrl = getGameServerApiBase(CONNECTION_URL) + "/checkStats";

            // Выполняем запрос
            const response = await fetch(statsUrl, { method: 'GET' });
            if (!response.ok) {
                throw new Error(`Ошибка запроса: ${response.status}`);
            }

            const stat = await response.json();

            // Выводим данные в консоль и выполняем обработку
            loadTopPlayerData(stat);
            fetchStats(stat);
        } catch (error) {
            console.error('Ошибка загрузки данных о топ-1 игроке:', error);
        }
    };

// host — для wss, api — HTTPS того же игрового сервера (клиент может быть на GitHub)
const GAME_SERVERS = {
        "ffa":        { host: "ffa.agar.su",           api: "https://ffa.agar.su" },
        "ms":         { host: "ffa.agar.su:6002",      api: "https://ffa.agar.su:6002" },
        "pvp1":       { host: "ffa.agar.su:6004",      api: "https://ffa.agar.su:6004" },
        "pvp2":       { host: "ffa.agar.su:6005",      api: "https://ffa.agar.su:6005" },
        "tournament": { host: "ffa.agar.su:6006",      api: "https://ffa.agar.su:6006" }
    };
const SERVERS = Object.fromEntries(
    Object.entries(GAME_SERVERS).map(([id, s]) => [id, s.host])
);

function getGameServerApiBase(hostOrUrl) {
    if (!hostOrUrl) return GAME_SERVERS.ffa.api;
    const entry = Object.values(GAME_SERVERS).find(s => s.host === hostOrUrl || s.api === hostOrUrl);
    if (entry) return entry.api;
    if (/^https?:\/\//i.test(hostOrUrl)) return hostOrUrl.replace(/\/$/, "");
    return "https://" + String(hostOrUrl).replace(/^wss?:\/\//i, "");
}

function getGameServerWssUrl(host) {
    const h = host || GAME_SERVERS.ffa.host;
    return "wss://" + String(h).replace(/^wss?:\/\//i, "");
}
	
wjQuery(document).ready(() => {
document.querySelectorAll('.gamemode li').forEach(li => {
    li.addEventListener('click', () => {
        const isAlreadyActive = li.classList.contains('active');
		const titleEl = document.getElementById('serverTitle');

        // Снимаем актив со всех и ставим новый
        document.querySelectorAll('.gamemode li').forEach(l => l.classList.remove('active'));
        li.classList.add('active');

        // Запоминаем выбранный сервер
        SELECTED_SERVER = li.dataset.ip;
        // Обновляем hash без дергания страницы
        history.replaceState(null, '', '#' + li.id);
titleEl.textContent = `Статистика ${li.id}`;
        // ✅ Если сервер уже был активным — сразу стартуем игру
        if(isAlreadyActive) {
            wHandle.startGame();
        }
    });
});
});


function initServers() {
    let serverKey = "ffa";
    const hash = wHandle.location.hash.slice(1);
    
    // НОВЫЙ КОД: проверяем режим
    const hashWithoutParams = hash.split('?')[0];
    const urlParams = new URLSearchParams(window.location.search);
    
    if (hash && SERVERS[hashWithoutParams]) {
        serverKey = hashWithoutParams;
    } else {
        const keys = Object.keys(SERVERS);
        if (keys.length) serverKey = keys[0];
    }

    CONNECTION_URL = SERVERS[serverKey];
    SELECTED_SERVER = CONNECTION_URL;

    document.querySelectorAll('.gamemode li').forEach(li => li.classList.remove('active'));
    const activeLi = document.getElementById(serverKey);
    if (activeLi) activeLi.classList.add('active');
    
    // НОВЫЙ КОД: автоматический запуск нужного режима через wHandle.onload
    if (urlParams.has('spect') || hash.includes('?spect')) {
        // Не трогаем zoom здесь, он установится в gameLoop
        // Просто запоминаем что нужно запустить spectate
        window._autoSpectate = true;
    }
}


    // Инициализация при загрузке
    initServers();

    // Если хэш меняется динамически
    wHandle.addEventListener('hashchange', initServers);
	


	
	
						
let skinList = {}; // Глобальный объект для скинов


// Функция нормализации ника (берёт ник внутри скобок или обрезает лишнее)
function normalizeNick(nick) {
    if (!nick) return '';

    let n = nick.trim();

    // Проверяем, начинается ли ник с открывающейся скобки
    if (n.startsWith('[')) {
        const endIndex = n.indexOf(']');
        if (endIndex === -1) return ''; // закрывающей скобки нет

        const innerNick = n.substring(1, endIndex).trim();
        if (!innerNick || innerNick !== n.substring(1, endIndex)) return ''; // проверка пробелов внутри

        // Возвращаем ник вместе со скобками, игнорируя всё после закрывающейся скобки
        return `[${innerNick}]`.toLowerCase();
    } else {
        // Ник без скобок: нельзя содержать пробелы в начале/конце
        if (!n || n.trim() !== n) return '';
        return n.toLowerCase();
    }
}

// Функция загрузки skinList.txt с нормализацией
function fetchSkinList() {
    fetch('https://api.agar.su/skinlist.txt')
        .then(response => {
            if (!response.ok) {
                throw new Error('Ошибка сети: ' + response.status);
            }
            return response.text();
        })
        .then(data => {
            skinList = {}; // Очищаем предыдущий список скинов
            data.split('\n').forEach(line => {
                let [name, id] = line.split(':');
                if (name && id) {
                    name = normalizeNick(name);
                    skinList[name] = id.trim();
                }
            });
        })
        .catch(error => {
            console.error('Ошибка загрузки skinList.txt:', error);
        });
}

// Первоначальная загрузка
fetchSkinList();

// Периодическая проверка изменений каждые 5 минут
setInterval(fetchSkinList, 300000);


    var
        // touchX, touchY,
        touchable = 'createTouch' in window || navigator.maxTouchPoints > 0,
        touches = [];

    var leftTouchID = -1,
        leftTouchPos = new Vector2(0, 0),
        leftTouchStartPos = new Vector2(0, 0),
        leftVector = new Vector2(0, 0);

    var useHttps = "https:" === wHandle.location.protocol;
wHandle.setserver = function(arg) {
    if (!SERVERS || Object.keys(SERVERS).length === 0) {
        console.warn("Серверы ещё не загружены. Подождите...");
        return;
    }

    if (arg !== CONNECTION_URL) {
        CONNECTION_URL = arg;

        const foundHash = Object.keys(SERVERS).find(key => SERVERS[key] === arg);
        if (foundHash) {
            // вместо location.hash → history.replaceState
            history.replaceState(null, "", `#${foundHash}`);
            setActiveFromHash(); // подсветим активный сервер
        } else {
            console.warn("Неизвестный сервер URL:", arg);
            history.replaceState(null, "", " ");
        }

        showConnecting();
        updateOnlineCount();
    }
};
const cellColors = [
            "#003366", "#336699", "#3366CC", "#003399", "#000099", "#0000CC", "#000066",
            "#006666", "#006699", "#0099CC", "#0066CC", "#0033CC", "#0000FF", "#3333FF", "#333399",
            "#669999", "#009999", "#33CCCC", "#00CCFF", "#0099FF", "#0066FF", "#3366FF", "#3333CC", "#666699",
            "#339966", "#00CC99", "#00FFCC", "#00FFFF", "#33CCFF", "#3399FF", "#6699FF", "#6666FF", "#6600FF", "#6600CC",
            "#339933", "#00CC66", "#00FF99", "#66FFCC", "#66FFFF", "#66CCFF", "#99CCFF", "#9999FF", "#9966FF", "#9933FF", "#9900FF",
            "#006600", "#00CC00", "#00FF00", "#66FF99", "#99FFCC", "#CCFFFF", "#CCCCFF", "#CC99FF", "#CC66FF", "#CC33FF", "#CC00FF", "#9900CC",
            "#003300", "#009933", "#33CC33", "#66FF66", "#99FF99", "#CCFFCC", "#FFCCFF", "#FF99FF", "#FF66FF", "#FF00FF", "#CC00CC", "#660066",
            "#336600", "#009900", "#66FF33", "#99FF66", "#CCFF99", "#FFFFCC", "#FFCCCC", "#FF99CC", "#FF66CC", "#FF33CC", "#CC0099", "#993399",
            "#333300", "#669900", "#99FF33", "#CCFF66", "#FFFF99", "#FFCC99", "#FF9999", "#FF6699", "#FF3399", "#CC3399", "#990099",
            "#666633", "#99CC00", "#CCFF33", "#FFFF66", "#FFCC66", "#FF9966", "#FF6666", "#FF0066", "#CC6699", "#993366",
            "#999966", "#CCCC00", "#FFFF00", "#FFCC00", "#FF9933", "#FF66000", "#FF5050", "#CC0066", "#660033",
            "#996633", "#CC9900", "#FF9900", "#CC6600", "#FF3300", "#FF0000", "#CC0000", "#990033",
            "#663300", "#996600", "#CC3300", "#993300", "#990000", "#800000", "#993333"
        ];

// ==================== KEYBINDS ====================
const KEYBIND_DEFAULTS = {
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
    sticker1: 49, sticker2: 50, sticker3: 51, sticker4: 52, sticker5: 53,
    sticker6: 54, sticker7: 55, sticker8: 56, sticker9: 57
};

const KEYBIND_LABELS = {
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
    sticker1: "Стикер 1", sticker2: "Стикер 2", sticker3: "Стикер 3",
    sticker4: "Стикер 4", sticker5: "Стикер 5", sticker6: "Стикер 6",
    sticker7: "Стикер 7", sticker8: "Стикер 8", sticker9: "Стикер 9"
};

let keyBinds = Object.assign({}, KEYBIND_DEFAULTS);
let keybindCaptureAction = null;
let ejectKeyInterval = null;

function loadKeybinds() {
    try {
        const raw = localStorage.getItem("keybinds_v1");
        if (!raw) return;
        const saved = JSON.parse(raw);
        Object.keys(KEYBIND_DEFAULTS).forEach(action => {
            if (typeof saved[action] === "number") keyBinds[action] = saved[action];
        });
    } catch (e) {}
}

function saveKeybinds() {
    try {
        localStorage.setItem("keybinds_v1", JSON.stringify(keyBinds));
    } catch (e) {}
}

function getBind(action) {
    const code = keyBinds[action];
    return typeof code === "number" ? code : KEYBIND_DEFAULTS[action];
}

function keyCodeToLabel(code) {
    const named = {
        8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
        20: "CapsLock", 27: "Esc", 32: "Space", 37: "←", 38: "↑", 39: "→", 40: "↓"
    };
    if (named[code]) return named[code];
    if (code >= 65 && code <= 90) return String.fromCharCode(code);
    if (code >= 48 && code <= 57) return String.fromCharCode(code);
    if (code >= 96 && code <= 105) return "Numpad " + (code - 96);
    return "Код " + code;
}

function assignKeybind(action, code) {
    const other = Object.keys(keyBinds).find(a => a !== action && keyBinds[a] === code);
    if (other) keyBinds[other] = keyBinds[action];
    keyBinds[action] = code;
    saveKeybinds();
    cancelKeybindCapture();
}

function resetKeybinds() {
    keyBinds = Object.assign({}, KEYBIND_DEFAULTS);
    saveKeybinds();
    mouseSplitButton = 3;
    mouseEjectButton = 1;
    saveMouseButtonSettings();
    const splitSel = document.getElementById("mouse-split-btn");
    const ejectSel = document.getElementById("mouse-eject-btn");
    if (splitSel) splitSel.value = "3";
    if (ejectSel) ejectSel.value = "1";
    renderKeybindUI();
}

wHandle.resetKeybinds = resetKeybinds;

function renderKeybindUI() {
    const list = document.getElementById("keybind-list");
    if (!list) return;
    list.querySelectorAll(".keybind-key").forEach(btn => {
        const action = btn.dataset.action;
        if (action) btn.textContent = keyCodeToLabel(getBind(action));
    });
}

let keybindUiInitialized = false;

function initKeybindSettings() {
    if (keybindUiInitialized) return;
    keybindUiInitialized = true;
    loadKeybinds();

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
        btn.textContent = keyCodeToLabel(getBind(action));
        btn.addEventListener("click", () => {
            keybindCaptureAction = action;
            btn.textContent = "…нажмите клавишу";
            btn.classList.add("listening");
        });
        row.appendChild(label);
        row.appendChild(btn);
        list.appendChild(row);
    });

    const resetBtn = document.getElementById("keybind-reset");
    if (resetBtn) resetBtn.addEventListener("click", resetKeybinds);

    initMouseButtonSettings();
}

loadKeybinds();

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
		
   function gameLoop() {
	       // Установка зума для режима наблюдения
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    
    if ((urlParams.has('spect') || hash.includes('?spect')) && typeof zoom !== 'undefined') {
        zoom = 0.5;
    }
    
    // Автоматический запуск наблюдения
    if (window._autoSpectate && typeof wHandle.spectate === 'function') {
        delete window._autoSpectate; // чтобы не запускалось дважды
        setTimeout(() => {
            wHandle.spectate();
        }, 100);
    }
	   
let stickerCooldown = false;
let stickerCooldownTimer = null;
    ma = true;
    const reconnectBtn = document.getElementById("reconnect-panel-btn");
    if (reconnectBtn && !reconnectBtn.dataset.bound) {
        reconnectBtn.dataset.bound = "1";
        reconnectBtn.addEventListener("click", reconnectToServer);
    }
    document.getElementById("canvas").focus();
    var isTyping = false;
    var txt;
    mainCanvas = nCanvas = document.getElementById("canvas");
    ctx = mainCanvas.getContext("2d");

    mainCanvas.onmousemove = function (event) {
        const dpr = window.devicePixelRatio;
        rawMouseX = event.clientX * dpr;
        rawMouseY = event.clientY * dpr;
        mouseCoordinateChange()
    };

    const updateMouseAim = () => {
        let x = X < rightPos ? X : rightPos;
        let y = Y < bottomPos ? Y : bottomPos;
        x = -rightPos > x ? -rightPos : x;
        y = -bottomPos > y ? -bottomPos : y;

        posX = x;
        posY = y;
    };

    mainCanvas.addEventListener("mousedown", () => {
        if (!playerCells.length) {
            updateMouseAim();
            sendUint8(1);
        }
    });

    if (touchable) {
        mainCanvas.addEventListener('touchstart', onTouchStart, false);
        mainCanvas.addEventListener('touchmove', onTouchMove, false);
        mainCanvas.addEventListener('touchend', onTouchEnd, false);
    }

    mainCanvas.onmouseup = function () {
    };
    if (/firefox/i.test(navigator.userAgent)) {
        document.addEventListener("DOMMouseScroll", handleWheel, false);
    } else {
        document.body.onmousewheel = handleWheel;
    }

    mainCanvas.onfocus = function () {
        isTyping = false;
    };

    document.querySelectorAll('.noPress').forEach(elem => {
        elem.onblur = () => { isTyping = false; };
        elem.onfocus = () => { isTyping = true; };
    });

    const keyPressed = {};
    freeze = false;
    
    // ========== СИСТЕМА СТИКЕРОВ (упрощённая) ==========
    let currentSticker = null;
    
    function sendSticker(stickerId, action) {
        if (wsIsOpen()) {
            const msg = prepareData(6);
            msg.setUint8(0, 200);
            msg.setUint8(1, stickerId);
            msg.setUint8(2, action ? 1 : 0);
            wsSend(msg);
        }
    }
    
    function showStickerOverCell(stickerId) {
        const cell = playerCells[0];
        if (!cell) return;
        cell.currentSticker = stickerId;
        cell.stickerActive = true;
    }
    
    function hideSticker() {
        const cell = playerCells[0];
        if (cell) {
            cell.currentSticker = null;
            cell.stickerActive = false;
        }
    }
    // ========== КОНЕЦ СИСТЕМЫ СТИКЕРОВ ==========

    function pressStickerKey(stickerId) {
        if (!showStickers || isTyping || stickerCooldown || currentSticker === stickerId) return;
        if (currentSticker !== null) {
            sendSticker(currentSticker, false);
            hideSticker();
        }
        currentSticker = stickerId;
        sendSticker(stickerId, true);
        showStickerOverCell(stickerId);
        stickerCooldown = true;
        if (stickerCooldownTimer) clearTimeout(stickerCooldownTimer);
        stickerCooldownTimer = setTimeout(() => { stickerCooldown = false; }, 500);
    }

    function releaseStickerKey(stickerId) {
        if (currentSticker === stickerId) {
            currentSticker = null;
            sendSticker(stickerId, false);
            hideSticker();
        }
    }

    wHandle.onkeydown = function (event) {
        if (keybindCaptureAction) {
            event.preventDefault();
            const code = event.keyCode;
            if (code === 27) {
                cancelKeybindCapture();
                return;
            }
            assignKeybind(keybindCaptureAction, code);
            return;
        }

        const code = event.keyCode;

        if (code === getBind("chat")) {
            if (isTyping || hideChat) {
                isTyping = false;
                const chatInput = document.getElementById("chat_textbox");
                const lsInput = document.getElementById("ls");
                let lsText = lsInput ? lsInput.value.trim() : "";
                let chatText = chatInput ? chatInput.value.trim() : "";
                let combinedText = "";
                if (lsText && chatText) combinedText = lsText + " " + chatText;
                else if (lsText) combinedText = lsText;
                else if (chatText) combinedText = chatText;
                if (combinedText.length > 0) sendChat(combinedText);
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

        if (code === getBind("freeze")) {
            if (!keyPressed.freeze && playerCells.length > 0) {
                freeze = !freeze;
                if (freeze) {
                    posX = X;
                    posY = Y;
                    document.querySelector("#freeze").style.display = "flex";
                } else {
                    document.querySelector("#freeze").style.display = "none";
                }
                keyPressed.freeze = true;
            }
            return;
        }
        if (code === getBind("split")) {
            if (!keyPressed.split) {
                sendMouseMove();
                sendUint8(17);
                keyPressed.split = true;
            }
            return;
        }
        if (code === getBind("coord")) {
            if (!keyPressed.coord) {
                coord();
                keyPressed.coord = true;
            }
            return;
        }
        if (code === getBind("eject")) {
            if (!keyPressed.eject) {
                sendMouseMove();
                sendUint8(21);
                keyPressed.eject = true;
                ejectKeyInterval = setInterval(function () {
                    sendMouseMove();
                    sendUint8(21);
                }, 100);
            }
            return;
        }
        if (code === getBind("macroQ")) {
            if (!keyPressed.macroQ) {
                sendUint8(18);
                keyPressed.macroQ = true;
            }
            return;
        }
        if (code === getBind("macroE")) {
            if (!keyPressed.macroE) {
                sendMouseMove();
                sendUint8(22);
                keyPressed.macroE = true;
            }
            return;
        }
        if (code === getBind("macroR")) {
            if (!keyPressed.macroR) {
                sendMouseMove();
                sendUint8(23);
                fixDead();
                keyPressed.macroR = true;
            }
            return;
        }
        if (code === getBind("macroT")) {
            if (!keyPressed.macroT) {
                sendMouseMove();
                sendUint8(24);
                keyPressed.macroT = true;
            }
            return;
        }
        if (code === getBind("macroP")) {
            if (!keyPressed.macroP) {
                sendMouseMove();
                sendUint8(25);
                keyPressed.macroP = true;
            }
            return;
        }
        for (let s = 1; s <= 9; s++) {
            if (code === getBind("sticker" + s)) {
                pressStickerKey(s);
                return;
            }
        }
    };

    wHandle.onkeyup = function (event) {
        const code = event.keyCode;
        if (code === getBind("freeze")) keyPressed.freeze = false;
        if (code === getBind("split")) keyPressed.split = false;
        if (code === getBind("coord")) keyPressed.coord = false;
        if (code === getBind("eject")) {
            keyPressed.eject = false;
            clearInterval(ejectKeyInterval);
            ejectKeyInterval = null;
        }
        if (code === getBind("macroQ")) {
            if (keyPressed.macroQ) {
                sendUint8(19);
                keyPressed.macroQ = false;
            }
        }
        if (code === getBind("macroE")) keyPressed.macroE = false;
        if (code === getBind("macroR")) keyPressed.macroR = false;
        if (code === getBind("macroT")) keyPressed.macroT = false;
        if (code === getBind("macroP")) keyPressed.macroP = false;
        for (let s = 1; s <= 9; s++) {
            if (code === getBind("sticker" + s)) releaseStickerKey(s);
        }
    };


    const colorSelected = document.getElementById("selectedColor");
    const colorList = document.getElementById("colorList");
    const skinss = document.getElementById("skinss");

    const colorSaved = localStorage.getItem("selectedColor");
    if (colorSaved) {
        colorSelected.style.background = colorSaved;
        skinss.style.borderColor = colorSaved;
        skinss.style.backgroundColor = colorSaved;
        skinss.style.boxShadow = `0 0 10px ${colorSaved}`;
    }

    colorSelected.onclick = () => {
        colorList.style.display =
            colorList.style.display === "none" || colorList.style.display === ""
                ? "flex"
                : "none";
    };

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

    cellColors.forEach((hex) => {
        const d = document.createElement("div");
        d.className = "item";
        d.style.background = hex;
        d._cellColorHex = hex;
        colorList.appendChild(d);
    });

    const adminPanel = document.querySelector('.admin-panel');
    adminPanel.style.display = '';

    const updatePlayerList = (players) => {
        const playerList = document.getElementById("playerList");
        playerList.innerHTML = "";
        const header = document.createElement("div");
        header.className = "infoApanel";
        ["IP", "ID", "Имя", "Клеток", "X", "Y", "Масса", "Kick", "Ban", "Kill", "Mute"].forEach(text => {
            const div = document.createElement("div");
            div.textContent = text;
            header.appendChild(div);
        });
        playerList.appendChild(header);
        players.forEach(player => {
            const row = document.createElement("div");
            row.className = "infoAplayer";
            const fields = [
                player.ip,
                player.id,
                player.name,
                player.cellCount,
                Math.round(player.x || 0),
                Math.round(player.y || 0),
                player.mass
            ];
            fields.forEach((value, i) => {
                const cell = document.createElement("div");
                cell.className = "player-cell";
                cell.textContent = value;
                if (i === 2) {
                    cell.className += " name-cell";
                    cell.title = "Клик — изменить ник";
                    cell.onclick = () => {
                        if (player.kick || player.ban) {
                            alert("Нельзя менять ник кикнутому/забаненному игроку");
                            return;
                        }
                        const newName = prompt("Новое имя:", player.name.trim());
                        if (newName && newName.trim() && newName.trim() !== player.name) {
                            sendChat(`/name ${player.id} ${newName.trim()}`);
                            cell.textContent = newName.trim();
                        }
                    };
                }
                if (i === 6) {
                    cell.className += " mass-cell";
                    if (!player.kick) {
                        cell.title = "Клик — изменить массу";
                        cell.onclick = () => {
                            const mass = prompt("Новая масса (положительное число):", player.mass);
                            if (mass && !isNaN(mass) && +mass > 0) {
                                sendChat(`/mass ${player.id} ${mass}`);
                                cell.textContent = mass;
                            }
                        };
                    } else {
                        cell.style.cursor = "default";
                        cell.title = "Кикнут — нельзя менять";
                    }
                }
                row.appendChild(cell);
            });
            const actions = [
                { prop: "kick", cmd: `/kick ${player.id}`, text: "Кик" },
                { prop: "ban",  cmd: `/ban ${player.ip}`,  text: "Бан"  },
                { prop: "kill", cmd: `/kill ${player.id}`, text: "Убить" },
                { prop: "mute", cmd: `/mute ${player.id}`, text: "Mute" },
                { prop: "unmute", cmd: `/unmute ${player.id}`, text: "unMute" }
            ];
            actions.forEach(action => {
                const cell = document.createElement("div");
                cell.className = "player-cell";
                if (player[action.prop]) {
                    cell.textContent = "—";
                    cell.className += " inactive";
                } else {
                    const btn = document.createElement("button");
                    btn.textContent = action.text;
                    btn.onclick = () => sendChat(action.cmd);
                    cell.appendChild(btn);
                }
                row.appendChild(cell);
            });
            playerList.appendChild(row);
        });
    };

    const openAdminPanel = () => {
        if (adminPanel.style.display === 'block') {
            adminPanel.style.display = '';
            delete window._updatePlayerList;
        } else {
            adminPanel.style.display = 'block';
            const msg = prepareData(1);
            msg.setUint8(0, 169);
            wsSend(msg);
            window._updatePlayerList = updatePlayerList;
        }
    };

    wHandle.openAdminPanel = openAdminPanel;

    wHandle.onblur = function () {
        sendUint8(19);
        clearInterval(ejectKeyInterval);
        ejectKeyInterval = null;
        Object.keys(keyPressed).forEach(k => { keyPressed[k] = false; });
    };
    
    document.addEventListener("contextmenu", () => {
        if (keyPressed.eject) {
            keyPressed.eject = false;
            clearInterval(ejectKeyInterval);
            ejectKeyInterval = null;
        }
    });

    const mouseHoldState = {};

    const doSplitAction = () => {
        sendMouseMove();
        sendUint8(17);
    };
    const doEjectAction = () => {
        sendMouseMove();
        sendUint8(21);
    };

    const getMouseAction = (which) => {
        if (which === mouseSplitButton) return "split";
        if (which === mouseEjectButton) return "eject";
        return null;
    };

    const clearMouseButton = (which) => {
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

    $(window).on("blur visibilitychange", () => {
        clearAllMouseHolds();
    });

    $(document).on("mousedown", function (event) {
        if (!enableMouseClicks || isTyping) return;
        const overlay = $('.overlays');
        if (overlay.is(':visible')) return;

        const which = event.which;
        const action = getMouseAction(which);
        if (!action || mouseHoldState[which]?.down) return;

        mouseHoldState[which] = { down: true, interval: null, timeout: null };

        if (action === "split") {
            doSplitAction();
            mouseHoldState[which].timeout = setTimeout(() => {
                if (mouseHoldState[which]?.down) {
                    mouseHoldState[which].interval = setInterval(() => {
                        if (mouseHoldState[which]?.down) doSplitAction();
                    }, 50);
                }
            }, 130);
        } else {
            doEjectAction();
            mouseHoldState[which].interval = setInterval(() => {
                if (mouseHoldState[which]?.down) doEjectAction();
            }, 100);
        }
    });

    $(window).on("mouseup", function (event) {
        clearMouseButton(event.which);
    });

    $(window).on("mouseleave", () => {
        clearAllMouseHolds();
    });

    $(document).on("contextmenu", function (event) {
        if (enableMouseClicks) event.preventDefault();
    });

    $(document).ready(function () {
        $(document).keydown(function (event) {
            if (event.keyCode === getBind("menu")) {
                wjQuery("#statics").hide();
                const overlay = $('#overlays');
                if (overlay.is(':visible')) {
                    overlay.hide();
                } else {
                    overlay.show();
                }
            }
        });
    });

    wHandle.onresize = canvasResize;
    canvasResize();
    wHandle.requestAnimationFrame(redrawGameScene);
    setInterval(sendMouseMove, 50);
    wjQuery("#overlays").show();
    setInterval(updateStats, 100);
}
	

const dpr = window.devicePixelRatio;

const joystickRadius = 360; // Максимальное расстояние точки от центра джойстика
const cursorSize = 20; // Размер квадрата курсора

let splitPressed = false;
let ejectPressed = false;

let pinchZoomStartDistance = 0;
let isPinching = false;
// Добавьте эти переменные в начало файла (после остальных var)
let ejectInterval = null;
let ejectPressedByTouch = false;

function onTouchStart(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
        var touch = e.changedTouches[i];

        var size = ~~(canvasWidth / 7);

        // Проверяем кнопку "split"
        if (
            touch.clientX * dpr > canvasWidth - size &&
            touch.clientY * dpr > canvasHeight - size
        ) {
            sendMouseMove();
            sendUint8(17);
            continue;
        }

        // ПРОВЕРЯЕМ КНОПКУ "EJECT" - ЗАПУСКАЕМ ИНТЕРВАЛ СРАЗУ
        if (
            touch.clientX * dpr > canvasWidth - size &&
            touch.clientY * dpr > canvasHeight - 2 * size - 10 &&
            touch.clientY * dpr < canvasHeight - size - 10
        ) {
            ejectPressedByTouch = true;
            
            // Уже стреляем? Нет - запускаем интервал
            if (!ejectInterval) {
                // Первый выстрел сразу
                sendMouseMove();
                sendUint8(21);
                
                // Запускаем интервал для непрерывной стрельбы
                ejectInterval = setInterval(() => {
                    if (ejectPressedByTouch && wsIsOpen()) {
                        sendMouseMove();
                        sendUint8(21);
                    }
                }, 80); // скорость стрельбы (чем меньше, тем быстрее)
            }
            continue;
        }

        // Джойстик
        if (leftTouchID < 0) {
            leftTouchID = touch.identifier;
            leftTouchStartPos.reset(touch.clientX * dpr, touch.clientY * dpr);
            leftTouchPos.copyFrom(leftTouchStartPos);
            leftVector.reset(0, 0);
        }
    }
    touches = e.touches;
}

function onTouchMove(e) {
    e.preventDefault();

    // Пинч-зум
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);

        if (!isPinching) {
            pinchZoomStartDistance = currentDistance;
            isPinching = true;
        } else {
            const delta = currentDistance - pinchZoomStartDistance;
            const zoomFactor = 1 + delta / 300;
            zoom *= zoomFactor;
            if (zoom < 0.3) zoom = 0.3;
            if (zoom > 4 / viewZoom) zoom = 4 / viewZoom;
            pinchZoomStartDistance = currentDistance;
        }
        return;
    }

    // Джойстик
    for (var i = 0; i < e.changedTouches.length; i++) {
        var touch = e.changedTouches[i];
        if (leftTouchID === touch.identifier) {
            leftTouchPos.reset(touch.clientX * dpr, touch.clientY * dpr);
            leftVector.copyFrom(leftTouchPos);
            leftVector.minusEq(leftTouchStartPos);
            const distance = Math.sqrt(leftVector.x ** 2 + leftVector.y ** 2);
            if (distance > joystickRadius) {
                const scale = joystickRadius / distance;
                leftVector.x *= scale;
                leftVector.y *= scale;
                leftTouchPos.x = leftTouchStartPos.x + leftVector.x;
                leftTouchPos.y = leftTouchStartPos.y + leftVector.y;
            }
            rawMouseX = leftVector.x * 3 + canvasWidth / 2;
            rawMouseY = leftVector.y * 3 + canvasHeight / 2;
            mouseCoordinateChange();
            sendMouseMove();
        }
    }
    touches = e.touches;
}

function onTouchEnd(e) {
    if (e.touches.length < 2) {
        isPinching = false;
    }

    for (var i = 0; i < e.changedTouches.length; i++) {
        var touch = e.changedTouches[i];

        if (leftTouchID === touch.identifier) {
            leftTouchID = -1;
            leftVector.reset(0, 0);
        }
        
        // ПРОВЕРЯЕМ ОТПУСКАНИЕ КНОПКИ EJECT - ОСТАНАВЛИВАЕМ СТРЕЛЬБУ
        var size = ~~(canvasWidth / 7);
        if (
            touch.clientX * dpr > canvasWidth - size &&
            touch.clientY * dpr > canvasHeight - 2 * size - 10 &&
            touch.clientY * dpr < canvasHeight - size - 10
        ) {
            ejectPressedByTouch = false;
            
            // Останавливаем интервал
            if (ejectInterval) {
                clearInterval(ejectInterval);
                ejectInterval = null;
            }
        }
    }
    
    // Если все пальцы убрали - тоже останавливаем
    if (e.touches.length === 0) {
        ejectPressedByTouch = false;
        if (ejectInterval) {
            clearInterval(ejectInterval);
            ejectInterval = null;
        }
    }
    
    touches = e.touches;
}

function handleWheel(event) {
    const overlay = $('.overlays');
    const chatContainer = $('.noscroll');

    if (overlay.is(':visible') || isMouseOverElement(chatContainer)) {
        return;
    }

    zoom *= Math.pow(.9, event.wheelDelta / -120 || event.detail || 0);
    if (zoom < 0) zoom = 1;
    if (zoom > 4 / viewZoom) zoom = 4 / viewZoom;
    if (zoom < 0.3) zoom = 0.3;
}




function isMouseOverElement(element) {
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    const offset = element.offset();

    return mouseX >= offset.left && mouseX <= offset.left + element.width() &&
           mouseY >= offset.top && mouseY <= offset.top + element.height();
}

    function buildQTree() {
        if (.4 > viewZoom) qTree = null;
        else {
            var a = Number.POSITIVE_INFINITY,
                b = Number.POSITIVE_INFINITY,
                c = Number.NEGATIVE_INFINITY,
                d = Number.NEGATIVE_INFINITY,
                e = 0;
            for (var i = 0; i < nodelist.length; i++) {
                var node = nodelist[i];
                if (node.shouldRender() && !node.prepareData && 20 < node.size * viewZoom) {
                    e = Math.max(node.size, e);
                    a = Math.min(node.x, a);
                    b = Math.min(node.y, b);
                    c = Math.max(node.x, c);
                    d = Math.max(node.y, d);
                }
            }
            qTree = Quad.init({
                minX: a - (e + 100),
                minY: b - (e + 100),
                maxX: c + (e + 100),
                maxY: d + (e + 100),
                maxChildren: 2,
                maxDepth: 4
            });
            for (i = 0; i < nodelist.length; i++) {
                node = nodelist[i];
                if (node.shouldRender() && !(20 >= node.size * viewZoom)) {
                    for (a = 0; a < node.points.length; ++a) {
                        b = node.points[a].x;
                        c = node.points[a].y;
                        b < nodeX - canvasWidth / 2 / viewZoom || c < nodeY - canvasHeight / 2 / viewZoom || b > nodeX + canvasWidth / 2 / viewZoom || c > nodeY + canvasHeight / 2 / viewZoom || qTree.insert(node.points[a]);
                    }
                }
            }
        }
    }


    function mouseCoordinateChange() {
        X = (rawMouseX - canvasWidth / 2) / viewZoom + nodeX;
        Y = (rawMouseY - canvasHeight / 2) / viewZoom + nodeY
    }

    function hideOverlays() {
        // hasOverlay = false;
        wjQuery("#overlays").hide();
    }

    function showOverlays(arg) {
        // hasOverlay = true;
        userNickName = null;
       // wjQuery("#overlays").fadeIn(arg ? 200 : 3E3);
       wjQuery("#overlays").show();
    }

let currentWebSocketUrl = null;
const HIDDEN_TAB_DISCONNECT_MS = 600000;
let hiddenTabDisconnectTimer = null;
let wsClosedByHiddenTab = false;

function isWsConnected() {
    return ws && ws.readyState === WebSocket.OPEN;
}

function clearHiddenTabDisconnectTimer() {
    if (hiddenTabDisconnectTimer) {
        clearTimeout(hiddenTabDisconnectTimer);
        hiddenTabDisconnectTimer = null;
    }
}

function scheduleHiddenTabDisconnect() {
    clearHiddenTabDisconnectTimer();
    if (!document.hidden) return;
    hiddenTabDisconnectTimer = setTimeout(() => {
        hiddenTabDisconnectTimer = null;
        if (!document.hidden || !isWsConnected()) return;
        wsClosedByHiddenTab = true;
        try { ws.close(); } catch (e) {}
    }, HIDDEN_TAB_DISCONNECT_MS);
}

function showReconnectPanel(message) {
    const panel = document.getElementById("reconnect-panel");
    const msgEl = document.getElementById("reconnect-panel-message");
    if (msgEl && message) msgEl.textContent = message;
    if (panel) panel.style.display = "flex";
}

function hideReconnectPanel() {
    const panel = document.getElementById("reconnect-panel");
    if (panel) panel.style.display = "none";
}

function reconnectToServer() {
    hideReconnectPanel();
    wsClosedByHiddenTab = false;
    if (!ma) return;
    showConnecting();
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        scheduleHiddenTabDisconnect();
    } else {
        clearHiddenTabDisconnectTimer();
    }
});

function formatBanDuration(sec) {
    if (!sec) return "навсегда";
    if (sec < 60) return sec + " сек";
    if (sec < 3600) {
        const m = Math.ceil(sec / 60);
        return m + " мин";
    }
    const h = Math.floor(sec / 3600);
    const m = Math.ceil((sec % 3600) / 60);
    return h + " ч" + (m ? " " + m + " мин" : "");
}

function showBanBanner(remainingSec, reason) {
    const banner = document.getElementById("ban-banner");
    const msgEl = document.getElementById("ban-banner-message");
    if (!banner || !msgEl) return;
    const timeText = formatBanDuration(remainingSec);
    let text = "Вы забанены (" + timeText + ")";
    if (reason) text += ". Причина: " + reason;
    msgEl.textContent = text;
    banner.style.display = "block";
}

function hideBanBanner() {
    const banner = document.getElementById("ban-banner");
    if (banner) banner.style.display = "none";
}

function showConnecting() {
    const wsUrl = getGameServerWssUrl(CONNECTION_URL);

    if (ws && ws.readyState === WebSocket.OPEN && currentWebSocketUrl === wsUrl) {
        return;
    }

    if (ma) {
        currentWebSocketUrl = wsUrl;
        wsConnect(wsUrl);
    }
}

function wsConnect(wsUrlArg) {
    hideBanBanner();

    if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        try { ws.close(); } catch (b) {}
        ws = null;
    }

    const c = CONNECTION_URL;
    wsUrl = wsUrlArg || getGameServerWssUrl(c);

    playerCells = [];
    nodes = {};
    nodelist = [];
    Cells = [];
    leaderBoard = [];

    const qs = new URLSearchParams();
    if (localStorage.accountToken) {
        qs.set("accountToken", localStorage.accountToken);
    }
    const query = qs.toString();
    ws = new WebSocket(wsUrl + (query ? "?" + query : ""), "eSejeKSVdysQvZs0ES1H");
    ws.binaryType = "arraybuffer";
    ws.onopen = onWsOpen;
    ws.onmessage = onWsMessage;
    ws.onclose = onWsClose;
}

    function prepareData(a) {
        return new DataView(new ArrayBuffer(a))
    }

    function wsSend(a) {
        ws.send(a.buffer)
    }


let ping = 0;    
let pingstamp = 0;


    let wsPingInterval = null;
    let gameHandshakeDone = false;

    function onWsOpen() {
        gameHandshakeDone = false;
        var msg;

        sendAccountToken();

        msg = prepareData(5);
        msg.setUint8(0, 254);
        msg.setUint32(1, 5, true);
        wsSend(msg);

        msg = prepareData(5);
        msg.setUint8(0, 255);
        msg.setUint32(1, 0, true);
        wsSend(msg);
    }

    function onGameHandshakeReady() {
        if (gameHandshakeDone) return;
        gameHandshakeDone = true;
        hideReconnectPanel();
        sendNickName();
        if (wsPingInterval) clearInterval(wsPingInterval);
        wsPingInterval = setInterval(() => {
            pingstamp = Date.now();
            wsSend(new Uint8Array([2]));
        }, 3000);
        sendChat("вoшёл в игру!");
    }

        function onWsClose(evt) {
    gameHandshakeDone = false;
    if (wsPingInterval) {
        clearInterval(wsPingInterval);
        wsPingInterval = null;
    }
    if (!ma) return;
    const msg = wsClosedByHiddenTab
        ? "Вкладка была неактивна более 60 секунд. Нажмите, чтобы переподключиться."
        : "Соединение с сервером потеряно. Нажмите, чтобы переподключиться.";
    wsClosedByHiddenTab = false;
    showReconnectPanel(msg);
        }


    function onWsMessage(msg) {
        handleWsMessage(new DataView(msg.data));
    }

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

    function handleWsMessage(msg) {
        let offset = 0;
        let setCustomLB = false;

        function getString() {
            let text = '';
            let char;
            while ((char = msg.getUint16(offset, true)) !== 0) {
                offset += 2;
                text += String.fromCharCode(char);
            }
            offset += 2;
            return text;
        }

        //if (msg.getUint8(offset) === 240) offset += 5;

        const messageType = msg.getUint8(offset++);
        switch (messageType) {
            case 91:
                const banRemaining = msg.getUint32(offset, true);
                offset += 4;
                const banReason = getString();
                showBanBanner(banRemaining, banReason);
                gameHandshakeDone = false;
                if (wsPingInterval) {
                    clearInterval(wsPingInterval);
                    wsPingInterval = null;
                }
                if (ws) {
                    ws.onopen = null;
                    ws.onmessage = null;
                    ws.onclose = null;
                    try { ws.close(); } catch (b) {}
                    ws = null;
                }
                break;
                 case 2:
        ping = Date.now() - pingstamp;

        // Находим элемент с id "ping" в HTML
const pingElement = document.getElementById('ping');

// Проверяем, что элемент найден (чтобы избежать ошибок, если его нет)
if (pingElement) {
    // Добавляем текст (значение ping) в элемент
    pingElement.textContent = ping; // или pingElement.innerText = ping;

    // Сначала убираем все предыдущие классы цвета
    pingElement.classList.remove('ping-green', 'ping-yellow', 'ping-red');

    // Присваиваем цвет в зависимости от значения ping
    if (ping >= 0 && ping < 50) {
        pingElement.classList.add('ping-green'); // зелёный
    } else if (ping >= 50 && ping < 150) {
        pingElement.classList.add('ping-yellow'); // жёлтый
    } else {
        pingElement.classList.add('ping-red'); // красный
    }
} else {
    console.error("Элемент с id 'ping' не найден в HTML."); // Выводим ошибку в консоль
}
        break;
            case 16:
                // Update nodes
                const reader = new BinaryReader(msg);
                reader.offset++; // skip messageType
                updateNodes(reader);
                break;
            case 17:
                // Update position
                // posX = msg.getFloat32(offset, true);
                // offset += 4;
                // posY = msg.getFloat32(offset, true);

                posSize = 0.15;

                // offset += 4;
                // posSize = msg.getFloat32(offset, true);
                // offset += 4;
                break;
            case 20:
                // Clear nodes
                playerCells = [];
                break;
case 48:
    // Update leaderboard (custom text)
    setCustomLB = true;
    noRanking = true;

    // читаем количество строк
    const count = msg.getUint32(offset, true);
    offset += 4;

    leaderBoard = [];
    for (let i = 0; i < count; i++) {
        // элемент ID (у турнира обычно 0)
        const nodeId = msg.getUint32(offset, true);
        offset += 4;

        // читаем UTF-16 строку
        const text = getString();

        leaderBoard.push({
            id: null,      // системная строка → без нумерации
            name: text,
            level: -1,
            xp: 0
        });
    }

    drawCustomLeaderBoard();
    break;

            case 49:
                // Update leaderboard (ffa)
                if (!setCustomLB) {
                    noRanking = false;
                }
                const LBplayerNum = msg.getUint32(offset, true);
                offset += 4;
                leaderBoard = [];
                for (let i = 0; i < LBplayerNum; ++i) {
                    const nodeId = msg.getUint32(offset, true);
                    offset += 4;

                    const playerName = getString();

                    const playerXp = msg.getUint32(offset, true);
                    offset += 4;

                    const avatarLen = msg.getUint16(offset, true);
                    offset += 2;
                    let accountAvatar = "";
                    for (let a = 0; a < avatarLen; a++) {
                        accountAvatar += String.fromCharCode(msg.getUint16(offset, true));
                        offset += 2;
                    }

                    leaderBoard.push({
                        id: nodeId,
                        name: playerName,
                        level: playerXp ? getLevel(playerXp) : -1,
                        xp: playerXp,
                        accountAvatar
                    });
                }
                drawLeaderBoard();
                break;
            case 64:
                // Set border
                leftPos = msg.getFloat64(offset, true);
                offset += 8;
                topPos = msg.getFloat64(offset, true);
                offset += 8;
                rightPos = msg.getFloat64(offset, true);
                offset += 8;
                bottomPos = msg.getFloat64(offset, true);
                offset += 8;
                foodMinSize = (msg.getUint16(offset, true) * 100) ** .5;
                offset += 2;
                foodMaxSize = (msg.getUint16(offset, true) * 100) ** .5;
                offset += 2;
                ownerPlayerId = msg.getUint32(offset, true);
                offset += 4;

                mapWidth = (rightPos + leftPos) / 2;
                mapHeight = (bottomPos + topPos) / 2;

                posX = (rightPos + leftPos) / 2;
                posY = (bottomPos + topPos) / 2;
                posSize = 1;

                if (playerCells.length === 0) {
                    nodeX = posX;
                    nodeY = posY;
                    viewZoom = posSize;
                }
                onGameHandshakeReady();
                break;
            case 99:
                // Add chat message
                addChat(msg, offset);
                break;
            case 114:
                // Update eXP
                const xp = msg.getUint32(offset, true);
                onUpdateXp(xp);
                break;
case 200: // Стикер от другого игрока
if (!showStickers) break;
    const stickerPlayerId = msg.getUint32(offset, true);
    offset += 4;
    const stickerId = msg.getUint8(offset++);
    const stickerAction = msg.getUint8(offset++); // 1 = показать, 0 = скрыть
    
    // Находим клетку игрока
    for (let i = 0; i < nodelist.length; i++) {
        const node = nodelist[i];
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
			case 169:
                const players = [];

                const playerReader = new BinaryReader(msg);
                playerReader.offset++; // skip messageType

                players.push({
                    ip: "IP",
                    id: "ID",
                    name: "NAME",
                    cellCount: "CELLS",
                    x: "X",
                    y: "Y",
                    mass: "MASS",
                    kick: true,
                    ban: true,
                    kill: true,
					mute: true,
					unmute: true
                });

                while (playerReader.canRead) {
                    players.push({
                        ip: playerReader.utf8(),
                        id: playerReader.uint32(),
                        name: playerReader.utf8(),
                        cellCount: playerReader.uint32(),
                        x: playerReader.int32(),
                        y: playerReader.int32(),
                        mass: playerReader.uint32()
                    });
                }

                if (window._updatePlayerList)
                    window._updatePlayerList(players);
                break;
        }
    }


function addChat(view, offset) {
        function getString() {
            var text = '',
                char;
            while ((char = view.getUint16(offset, true)) != 0) {
                offset += 2;
                text += String.fromCharCode(char);
            }
            offset += 2;
            return text;
        }

        var flags = view.getUint8(offset++);

        if (flags & 0x80) {
            // SERVER Message
        }

        if (flags & 0x40) {
            // ADMIN Message
        }

        if (flags & 0x20) {
            // MOD Message
        }

        var r = view.getUint8(offset++),
            g = view.getUint8(offset++),
            b = view.getUint8(offset++),
            color = (r << 16 | g << 8 | b).toString(16);
        while (color.length < 6) {
            color = '0' + color;
        }
		
        const playerXp = view.getUint32(offset, true);
        offset += 4;

        const avatarLen = view.getUint16(offset, true);
        offset += 2;
        let accountAvatar = "";
        for (let a = 0; a < avatarLen; a++) {
            accountAvatar += String.fromCharCode(view.getUint16(offset, true));
            offset += 2;
        }

        const pId = view.getUint16(offset, true);  // Считываем pID
        offset += 2;
		
        color = '#' + color;
        chatBoard.push({
            "pId": pId,  // Добавляем playerPId
			"playerXp": playerXp,
			"playerLevel": playerXp ? getLevel(playerXp) : -1,
            "accountAvatar": accountAvatar,
            "name": getString(),
            "color": color,
            "message": getString(),
            "time": formatTime(new Date()) // Форматируем текущее время
        });
        drawChatBoard();
    }

    function formatTime(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`; // Возвращаем строку в формате HH:MM
    }



let badWordsSet; // Используем Set вместо массива

fetch('/word.txt')
    .then(response => response.text())
    .then(text => {
        const words = text.split('\n').map(word => word.trim().toLowerCase());
        badWordsSet = new Set(words); // Создаем Set из массива
    })
    .catch(error => console.error('Ошибка загрузки списка матерных слов:', error));


function censorMessage(message) {
    if (!badWordsSet) {
        console.warn("Список матерных слов не загружен. Антимат не работает.");
        return message;
    }

    const words = message.split(' ').filter(word => word !== "");
    let censoredMessage = "";  // Собираем результат в строку
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const lowerCaseWord = word.toLowerCase();

        if (badWordsSet.has(lowerCaseWord)) {
            censoredMessage += "***";
        } else {
            censoredMessage += word;
        }

        if (i < words.length - 1) {
            censoredMessage += " "; // Добавляем пробел, если это не последнее слово
        }
    }
    return censoredMessage;
}

let currentUserRole = 'user';
const admins = ["нико","^iStack","banshee"];
const moderator = ["rizwer","pulik","могучий жидяра","salruz","morcov"];
const moders = ["cosmos","rizwer","bambule","☼k☼","pulik","могучий жидяра","salruz","morcov"];
const mod = ["☼k☼"];
const youtubers = ["salruz", "morcov","sealand"];
const url_youtubers = ["https://youtube.com/@SalRuzO", "https://www.youtube.com/@MORCCVA","https://www.youtube.com/@sealandv"];

let passUsers = [];
const ignoredPlayers = new Set();
let activeDialog = null;
const dialogs = {};
const dialogMessages = {};
const maxGlobalMessages = 50; // для глобального чата
const maxDialogMessages = 100; // для ЛС

// ==========================
// Загрузка pass.txt
// ==========================
fetch('https://api.agar.su/pass.txt')
    .then(response => {
        if (!response.ok) throw new Error('Ошибка сети: ' + response.status);
        return response.text();
    })
    .then(text => {
        passUsers = text.split('\n')
            .map(n => normalizeNick(n).toLowerCase())
            .filter(n => n.length > 0);
    })
    .catch(err => console.error('Ошибка загрузки pass.txt:', err));

// ==========================
// Подсветка упоминаний
// ==========================
// 2) Хайлайтер: разрешаем NBSP внутри упоминания
function highlightMentions(text) {
  // Экранируем HTML
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Разрешаем \u00A0 (NBSP) как «пробел внутри ника»
  return text.replace(
    /@((?:[^\s@]|\u00A0)+)/g,
    '<span class="mention">@$1</span>'
  );
}


// ==========================
// Создание личного диалога
// ==========================
function createDialog(number, senderName, senderAvatar) {
    const dialogId = `!ls${number}`;
    if (dialogs[dialogId]) return;

    const dialogDiv = document.createElement('div');
    dialogDiv.className = 'chatX_feed';
    dialogDiv.id = dialogId;
    dialogDiv.style.display = 'none';
    document.getElementById('chatX_container').appendChild(dialogDiv);

    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'chatX_top_avatar';
    const avatar = document.createElement('img');
    avatar.className = 'chatX_avatar_private';
    avatar.src = senderAvatar || 'https://api.agar.su/skins/4.png';
    avatar.onerror = () => avatar.src = 'https://api.agar.su/skins/4.png';
    avatar.title = senderName || `User ${number}`;
    avatarContainer.appendChild(avatar);

    avatarContainer.addEventListener('click', () => switchToDialog(dialogId));
    document.getElementById('chatX_top').appendChild(avatarContainer);

    dialogs[dialogId] = { div: dialogDiv, avatar: avatarContainer };
    dialogMessages[dialogId] = [];
}

function replaceEmojis(text) {
    const gifEmojis = [50, 253, 26]; // номера gif-эмодзи

    return text.replace(/:([0-9]+):/g, (match, p1) => {
        const num = Number(p1);
        const ext = gifEmojis.includes(num) ? 'gif' : 'png';
        return `<img class="chat-emoji" src="/emoji/${num}.${ext}">`;
    });
}


// ==========================
// Переключение диалога
// ==========================
wHandle.switchToDialog = function (dialogId) {
    document.getElementById('chatX_feed').style.display = 'none';
    Object.values(dialogs).forEach(d => d.div.style.display = 'none');

    if (!dialogId) {
        document.getElementById('chatX_feed').style.display = 'flex';
        activeDialog = null;
    } else {
        dialogs[dialogId].div.style.display = 'flex';
        activeDialog = dialogId;
        const dialogDiv = dialogs[dialogId].div;
        dialogDiv.innerHTML = '';
        dialogMessages[dialogId].forEach(msg => dialogDiv.appendChild(msg));
    }

    const chatInput = document.getElementById('ls');
    if (activeDialog) {
        const dialogNumberMatch = activeDialog.match(/^!ls(\d+)$/);
        chatInput.value = dialogNumberMatch ? `!ls${dialogNumberMatch[1]} ` : '';
    } else chatInput.value = '';
}

// Суммарные хиты мата по игроку с таймером сброса
// pId -> { count: number, lastTime: timestamp }
const profanityCountByPlayer = new Map();
const BLUR_THRESHOLD = 3; // после N ругательных слов начинаем блюрить
const RESET_TIME = 10000; // 10 секунд

// Функция подсчёта ругательств в сообщении
function countProfanity(message) {
    if (!badWordsSet) return 0;
    return message
        .split(/\s+/)
        .filter(Boolean)
        .reduce((n, w) => n + (badWordsSet.has(w.toLowerCase()) ? 1 : 0), 0);
}

// Проверка, нужно ли блюрить сообщение, и запись подсчёта
function shouldBlurAndRecord(pId, message) {
    // Если +18 включён — не блюрим ничего
    if (showAdultContent) return false;

    // Исключение для pId 0
    if (pId === 0 || pId === '0') return false;

    const now = Date.now();
    const hits = countProfanity(message);

    // Получаем предыдущие данные или создаём новые
    let data = profanityCountByPlayer.get(pId) || { count: 0, lastTime: now };

    // Сброс, если прошло больше RESET_TIME
    if (now - data.lastTime > RESET_TIME) {
        data.count = 0;
    }

    // Добавляем новые хиты
    data.count += hits;
    data.lastTime = now;

    // Сохраняем обратно
    profanityCountByPlayer.set(pId, data);

    // Возвращаем true, если превышен BLUR_THRESHOLD
    return data.count >= BLUR_THRESHOLD;
}


function openPvPModal(targetId, targetName) {
    // Создаём overlay
    const modal = document.createElement('div');
    modal.id = 'pvpModal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';

    const box = document.createElement('div');
    box.style.background = '#1e1e1e';
    box.style.padding = '20px';
    box.style.borderRadius = '8px';
    box.style.color = '#fff';
    box.style.minWidth = '300px';
    box.innerHTML = `<h3>Позвать ${targetName} на PvP</h3>
                     <p>Выберите сервер:</p>`;

    // Список серверов
       const servers = [
        { name: "FFA 1vs1", address: "ffa.agar.su:6004" },
        { name: "MS 2vs2", address: "ffa.agar.su:6005" },
		{ name: "Tournament", address: "ffa.agar.su:6006" }
    ];
    servers.forEach(server => {
        const btn = document.createElement('button');
        btn.textContent = server.name;
        btn.style.margin = '5px';
        btn.style.padding = '8px 16px';
        btn.style.cursor = 'pointer';
        btn.style.background = '#2c2c2c';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.color = '#fff';
        btn.onmouseover = () => btn.style.background = '#3c3c3c';
        btn.onmouseout = () => btn.style.background = '#2c2c2c';
        btn.onclick = () => {
            sendPvPInvite(targetId, server.address);
            modal.remove();
        };
        box.appendChild(btn);
    });

    // Отмена
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Отмена';
    cancelBtn.style.marginTop = '10px';
    cancelBtn.style.padding = '8px 16px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.background = '#6c6c6c';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.color = '#fff';
    cancelBtn.onclick = () => modal.remove();
    box.appendChild(cancelBtn);

    modal.appendChild(box);
    document.body.appendChild(modal);
}

function sendPvPInvite(targetId, server, isAccept = false) {
    // isAccept — true, если отправляем согласие
    const msg = isAccept ? `PvPInvite;${server};accept` : `PvPInvite;${server}`;
    sendChat(`!ls${targetId} ${msg}`);
}


function showPvPConfirm(playerId, playerName, server) {
    const modal = document.createElement('div');
    modal.id = 'pvpConfirmModal';

    const box = document.createElement('div');
    box.style.background = '#1e1e1e';
    box.style.padding = '20px';
    box.style.borderRadius = '8px';
    box.style.color = '#fff';
    box.style.minWidth = '300px';
    box.innerHTML = `<h3>${playerName} приглашает на PvP</h3>`;

    // Кнопка принять
    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Принять';
    acceptBtn.onclick = () => {
        // Отправляем обратно согласие
        sendPvPInvite(playerId, server, true); 
        // Подключаемся к серверу
        setserver(server); 
        modal.remove();
    };
    box.appendChild(acceptBtn);

    // Кнопка отказать
    const rejectBtn = document.createElement('button');
    rejectBtn.textContent = 'Отказать';
    rejectBtn.onclick = () => modal.remove();
    box.appendChild(rejectBtn);

    modal.appendChild(box);
    document.body.appendChild(modal);
}



// ==========================
// Основная функция отрисовки сообщений
// ==========================
function drawChatBoard() {
    if (hideChat) return;
    const lastMessage = chatBoard[chatBoard.length - 1];
    if (!lastMessage) return;
	
// ПРОВЕРКА НА КОМАНДУ УДАЛЕНИЯ
if (lastMessage.message && lastMessage.message.startsWith('!delet')) {
    const match = lastMessage.message.match(/!delet\s+(\d+)/);
    if (match) {
        const targetId = match[1];
        const senderName = lastMessage.name.toLowerCase();
        const senderOriginal = lastMessage.name;
        
        const isAdmin = admins.includes(senderName);
        const isModer = moders.includes(senderName);
        
        if (isAdmin || isModer) {
            // НАХОДИМ ВСЕ СООБЩЕНИЯ С ТАКИМ DATA-ID
            const targetMessages = document.querySelectorAll(`[data-id="${targetId}"]`);
            
            if (targetMessages.length > 0) {
                const role = isAdmin ? 'админом' : 'модератором';
                
                // ДЛЯ КАЖДОГО СООБЩЕНИЯ
                targetMessages.forEach(targetMsg => {
                    const notify = document.createElement('div');
                    notify.style.background = '#80808057';
                    notify.style.color = '#ff9999';
                    notify.style.fontSize = '12px';
                    notify.style.padding = '4px 8px';
                    notify.innerHTML = `[ Сообщение было удалено ${role}: ${senderOriginal} ]`;
                    
                    targetMsg.parentNode.insertBefore(notify, targetMsg);
                    targetMsg.remove();
                });
                
                console.log(`[УДАЛЕНИЕ] Удалено ${targetMessages.length} сообщений с ID ${targetId}`);
            }
        }
    }
    return;
}
	
if (lastMessage.message && lastMessage.message.toLowerCase().includes("вoшёл в игру")) {
    const simpleDiv = document.createElement('div');
    simpleDiv.className = 'chatexit';

    const nameSpan = document.createElement('span');
    nameSpan.style.color = lastMessage.color || '#b8c0cc';
    nameSpan.textContent = `${lastMessage.name}:`;

    simpleDiv.appendChild(nameSpan);
    simpleDiv.append(` ${lastMessage.message}`);

    document.getElementById('chatX_feed').appendChild(simpleDiv);

    //console.log(simpleDiv);

    return;
}

    // --- Игнорируем игрока ---
    if (ignoredPlayers.has(lastMessage.pId)) return;

    const msgDiv = document.createElement('div');
	msgDiv.setAttribute('data-id', lastMessage.pId);
    const lowerName = lastMessage.name.toLowerCase();

    if (admins.includes(lowerName)) msgDiv.className = 'chatX_msg admins';
    else if (moders.includes(lowerName)) msgDiv.className = 'chatX_msg ' + lowerName;
    else msgDiv.className = 'chatX_msg';

    const normalizedName = normalizeNick(lastMessage.name || '');
    let messageRaw = (lastMessage.message || '').trim();
    let targetDialogId = null;
    let messageContent = messageRaw;
    // Проверка на ЛС
    const privatePattern = /^!ls(\d+)\s+(.+)/i;
    const privateMatch = messageRaw.match(privatePattern);



	
if (privateMatch) {
    const number = privateMatch[1];
    messageContent = privateMatch[2];

    // Игнорируем PvP-сообщения
    if (!messageContent.startsWith('PvPInvite;')) {
        targetDialogId = `!ls${number}`;
        createDialog(number, lastMessage.name, skinList[normalizedName] ? 
            `https://api.agar.su/skins/${skinList[normalizedName]}.png` : 'https://api.agar.su/skins/4.png');
    }
}

    let targetDiv = targetDialogId ? dialogs[targetDialogId]?.div : document.getElementById('chatX_feed');
    if (!targetDiv) targetDiv = document.getElementById('chatX_feed');

    // --- Аватарка ---
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'avatarXcontainer';
    // Добавляем класс для роли
if (admins.includes(lowerName)) {
    avatarContainer.classList.add('admin');
} else if (moderator.includes(lowerName)) {
    avatarContainer.classList.add('moderator');
} else if (passUsers.includes(normalizedName)) {
    // Только для обычных игроков из pass.txt
    avatarContainer.style.setProperty('--after-display', 'block');
}

    const avatar = document.createElement('img');
    avatar.className = 'chatX_avatar';
    const skinId = skinList[normalizedName];
    avatar.src = skinId ? `https://api.agar.su/skins/${skinId}.png` : 'https://api.agar.su/skins/4.png';
    avatar.onerror = () => avatar.src = 'https://api.agar.su/skins/4.png';
    avatarContainer.appendChild(avatar);
    msgDiv.appendChild(avatarContainer);

    // --- Имя и уровень ---
    const nameContainer = document.createElement('div');
    nameContainer.className = 'chatX_name_container';

    const levelIndicator = createLevelIndicator(lastMessage.playerXp, lastMessage.accountAvatar);
    if (levelIndicator) nameContainer.appendChild(levelIndicator);

	// --- YouTube иконка для ютуберов ---
const ytIndex = youtubers.indexOf(lowerName);
if (ytIndex !== -1 && url_youtubers[ytIndex]) {
    const ytLink = document.createElement('a');
    ytLink.href = url_youtubers[ytIndex];
    ytLink.target = '_blank';
    ytLink.innerHTML = '<i class="fab fa-youtube"></i>';
    ytLink.style.color = '#ff0000';
    ytLink.title = 'YouTube канал';
    nameContainer.appendChild(ytLink);
}

// --- MOD иконка ---
if (mod.includes(lowerName)) {
    const modIcon = document.createElement('div');
    modIcon.title = 'Данный игрок является спонсором Agar.su';
    modIcon.style.width = '19px';
    modIcon.style.height = '19px';
    modIcon.style.backgroundImage = 'url(./assets/photo/mod.png)';
    modIcon.style.backgroundSize = 'cover';
    modIcon.style.display = 'inline-block';

    nameContainer.appendChild(modIcon);
}

    const nameDiv = document.createElement('div');
    nameDiv.className = 'chatX_nick';
    const safeName = censorMessage(lastMessage.name);
    nameDiv.textContent = safeName + ':';

    if (admins.includes(lowerName)) {
        nameDiv.style.color = 'gold';
        nameDiv.title = `${lastMessage.pId} (Администратор)`;
    } else if (moders.includes(lowerName)) {
        nameDiv.style.color = lastMessage.color || '#b8c0cc';
        nameDiv.title = `${lastMessage.pId} (Модератор)`;
    } else if (targetDialogId) {
        nameDiv.style.color = lastMessage.color || '#b8c0cc';
        nameDiv.title = 'Личное сообщение';
    } else {
        nameDiv.style.color = lastMessage.color || '#b8c0cc';
        avatar.style.border = `2px solid ${lastMessage.color}`;
		avatar.style.background = `${lastMessage.color}`;
        nameDiv.title = `${lastMessage.pId || 0}`;
    }

    nameContainer.appendChild(nameDiv);
    msgDiv.appendChild(nameContainer);

// --- Сообщение ---
const textDiv = document.createElement('div');
textDiv.className = 'chatX_text';


// --- Проверка на PvPInvite ---
if (messageContent.startsWith('PvPInvite;') && !messageContent.endsWith(';accept')) {
    const server = messageContent.split(';')[1];
    showPvPConfirm(lastMessage.pId, lastMessage.name, server);
    return; // Прерываем отрисовку, не вставляем текст
}

// --- Проверка на согласие PvP ---
if (messageContent.startsWith('PvPInvite;') && messageContent.endsWith(';accept')) {
    const server = messageContent.split(';')[1];
    setserver(server); // Переходим на сервер
    return; // Не рисуем сообщение
}

// сначала цензурим, как у вас
const safeHtml = replaceEmojis(highlightMentions(censorMessage(messageContent)));
textDiv.innerHTML = safeHtml;


if (shouldBlurAndRecord(lastMessage.pId, messageContent)) {
    msgDiv.classList.add('blurred');
    msgDiv.title = 'Скрыто из-за токсичности. Нажмите, чтобы показать.';

    textDiv.style.cursor = 'pointer';
    textDiv.title = 'Нажмите, чтобы показать сообщение';

    // Используем addEventListener + флаг, чтобы знать — уже раскрыто или нет
    textDiv.addEventListener('click', function revealHandler(e) {
        if (msgDiv.classList.contains('blurred')) {
            // Первый клик — раскрываем
            e.stopPropagation();
            msgDiv.classList.remove('blurred');
            textDiv.classList.add('revealed');
            msgDiv.title = '';
            textDiv.title = '';
            textDiv.style.cursor = 'default'; 
        }
        // Больше ничего не делаем — дальше клики будут обрабатываться другими обработчиками (контекстное меню и т.д.)
    });
}

msgDiv.appendChild(textDiv);

    // --- Время ---
    const timeDiv = document.createElement('div');
    timeDiv.className = 'chatX_time';
    timeDiv.textContent = lastMessage.time || '';
    msgDiv.appendChild(timeDiv);

    // --- Контекстное меню ---
    msgDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        document.querySelectorAll('.chat-context-menu').forEach(m => m.remove());

        const menu = document.createElement('div');
        menu.className = 'chat-context-menu';
        menu.style.top = e.clientY + 'px';
        menu.style.left = e.clientX + 'px';

        const playerId = lastMessage.pId;
		
		const pmBtn = document.createElement('div');
pmBtn.textContent = 'Личное сообщение';
pmBtn.style.cursor = 'pointer';
pmBtn.onclick = () => {
    // Создаём ЛС диалог
    createDialog(playerId, lastMessage.name, skinList[normalizeNick(lastMessage.name)] ? 
        `https://api.agar.su/skins/${skinList[normalizeNick(lastMessage.name)]}.png` : 'https://api.agar.su/skins/4.png');
    switchToDialog(`!ls${playerId}`);
    menu.remove();
};

        const ignoreBtn = document.createElement('div');
        ignoreBtn.textContent = 'Игнорировать';
        ignoreBtn.style.cursor = 'pointer';
        ignoreBtn.onclick = () => { ignoredPlayers.add(playerId); msgDiv.remove(); menu.remove(); };

        const clearIgnoreBtn = document.createElement('div');
        clearIgnoreBtn.textContent = 'Удалить всех из игнора';
        clearIgnoreBtn.style.cursor = 'pointer';
        clearIgnoreBtn.onclick = () => { ignoredPlayers.clear(); menu.remove(); };

        const delMsgBtn = document.createElement('div');
        delMsgBtn.textContent = 'Удалить сообщение';
        delMsgBtn.style.cursor = 'pointer';
        delMsgBtn.onclick = () => { msgDiv.remove(); menu.remove(); };

        const delAllBtn = document.createElement('div');
        delAllBtn.textContent = 'Удалить все сообщения игрока';
        delAllBtn.style.cursor = 'pointer';
        delAllBtn.onclick = () => {
            [...targetDiv.children].forEach(c => {
                if (c.querySelector('.chatX_nick')?.title.includes(playerId)) c.remove();
            });
            menu.remove();
        };
if (currentUserRole === 'admin' || currentUserRole === 'moderator') {
    const muteBtn = document.createElement('div');
    muteBtn.textContent = 'Мут';
    muteBtn.style.cursor = 'pointer';
    muteBtn.style.color = '#ff6b6b';
    muteBtn.onclick = () => {
        sendChat(`/mute ${lastMessage.pId}`);
        menu.remove();
    };
    
    const unmuteBtn = document.createElement('div');
    unmuteBtn.textContent = 'Убрать мут';
    unmuteBtn.style.cursor = 'pointer';
    unmuteBtn.style.color = '#6bff6b';
    unmuteBtn.onclick = () => {
        sendChat(`/unmute ${lastMessage.pId}`);
        menu.remove();
    };
	
	    const deleteBtn = document.createElement('div');
    deleteBtn.textContent = 'Удалить сообщения';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.color = '#ff6b6b';
    deleteBtn.onclick = () => {
        sendChat(`!delet ${lastMessage.pId}`);
        menu.remove();
    };
	
		    const chatlock = document.createElement('div');
    chatlock.textContent = 'Ограничение чата XP 1000';
    chatlock.style.cursor = 'pointer';
    chatlock.style.color = '#ff6b6b';
    chatlock.onclick = () => {
        sendChat(`/chatlock 1000`);
        menu.remove();
    };
	
			    const chatlockoff = document.createElement('div');
    chatlockoff.textContent = 'Снять ограничение чата XP';
    chatlockoff.style.cursor = 'pointer';
    chatlockoff.style.color = '#6bff6b';
    chatlockoff.onclick = () => {
        sendChat(`/chatlock off`);
        menu.remove();
    };
    
    menu.appendChild(muteBtn);
    menu.appendChild(unmuteBtn);
	menu.appendChild(deleteBtn);
	menu.appendChild(chatlock);
	menu.appendChild(chatlockoff);
}

		const pvpBtn = document.createElement('div');
pvpBtn.textContent = 'Позвать на PvP';
pvpBtn.style.cursor = 'pointer';
pvpBtn.onclick = () => {
    openPvPModal(lastMessage.pId, lastMessage.name);
    menu.remove();
};
menu.appendChild(pvpBtn);
        menu.appendChild(pmBtn);
        menu.appendChild(ignoreBtn);
        menu.appendChild(clearIgnoreBtn);
        menu.appendChild(delMsgBtn);
        menu.appendChild(delAllBtn);

        document.body.appendChild(menu);
        const closeMenu = (event) => { if (!menu.contains(event.target)) menu.remove(); };
        document.addEventListener('click', closeMenu, { once: true });
    });

    targetDiv.appendChild(msgDiv);

    // --- Скролл ---
    const scrollStep = 200;
    targetDiv.scrollTop = Math.min(targetDiv.scrollTop + scrollStep, targetDiv.scrollHeight);

    // --- Хранение сообщений для ЛС ---
    if (targetDialogId && dialogs[targetDialogId]) {
        dialogMessages[targetDialogId].push(msgDiv);
        const topAvatarImg = dialogs[targetDialogId].avatar.querySelector('img');
        if (topAvatarImg) {
            topAvatarImg.src = skinList[normalizedName]
                ? `https://api.agar.su/skins/${skinList[normalizedName]}.png`
                : 'https://api.agar.su/skins/4.png';
            topAvatarImg.title = lastMessage.name || `User ${targetDialogId.replace('!ls','')}`;
        }
    }

    // --- Ограничение количества сообщений ---
    if (targetDialogId) {
        while (targetDiv.children.length > maxDialogMessages) targetDiv.removeChild(targetDiv.firstChild);
    } else {
        while (targetDiv.children.length > maxGlobalMessages) targetDiv.removeChild(targetDiv.firstChild);
    }

    // --- Обновление инпута для ЛС ---
    const chatInput = document.getElementById('ls');
    if (activeDialog) {
        const dialogNumberMatch = activeDialog.match(/^!ls(\d+)$/);
        if (dialogNumberMatch) {
            const number = dialogNumberMatch[1];
            const currentText = chatInput.value.replace(/^!ls\d+\s*/, '');
            chatInput.value = `!ls${number} ${currentText}`;
        }
    }
}















const normalizeFractlPart = n => (n % (Math.PI * 2)) / (Math.PI * 2);
function updateNodes(reader) {
        timestamp = Date.now();
        ua = false;

        for (let killedId; killedId = reader.uint32();) {
            let killer = nodes[reader.uint32()],
                killedNode = nodes[killedId];
            if (killer && killedNode) {
                killedNode.destroy();
                killedNode.ox = killedNode.x;
                killedNode.oy = killedNode.y;
                killedNode.oSize = killedNode.size;
                killedNode.nx = killer.x;
                killedNode.ny = killer.y;
                killedNode.nSize = killedNode.size;
                killedNode.updateTime = timestamp;
            }
        }

        for (let nodeid; nodeid = reader.uint32();) {
            const type = reader.uint8();

            let posX = 0;
            let posY = 0;
            let size = 0;
            let playerId = 0;

            if (type === 1) {
                posX = leftPos + (rightPos * 2) * normalizeFractlPart(nodeid);
                posY = topPos + (bottomPos * 2) * normalizeFractlPart(nodeid * nodeid);
                //size = foodMinSize + nodeid % ((foodMaxSize - foodMinSize) + 1);
            }
            else {
                if (type === 0) playerId = reader.uint32();
                posX = reader.int32();
                posY = reader.int32();
                size = reader.uint16();
            }

            const r = reader.uint8();
            const g = reader.uint8();
            const b = reader.uint8();

            let color = (r << 16 | g << 8 | b).toString(16);

            while (color.length < 6) {
                color = "0" + color;
            }

            color = "#" + color;

            let spiked = reader.uint8();
            let flagVirus = !!(spiked & 0x01);
            let flagEjected = !!(spiked & 0x20) || !!(spiked & 0x40);
            let flagAgitated = !!(spiked & 0x10);

const name = reader.utf8();

// ========== ЧТЕНИЕ СТИКЕРА ==========
let stickerData = null;
if (reader.canRead) {
    const marker = reader.uint8();
    if (marker === 0xFF) {
        stickerData = reader.uint8();
    }
}
// ===================================

let node = nodes[nodeid];
if (node) {
    node = nodes[nodeid];
    node.updatePos();
    node.ox = node.x;
    node.oy = node.y;
    node.oSize = node.size;
    node.color = color;
} else {
    node = new Cell(nodeid, posX, posY, size, color, name);
    nodelist.push(node);
    nodes[nodeid] = node;
    node.ka = posX;
    node.la = posY;
    if (playerId === ownerPlayerId) {
        document.getElementById("overlays").style.display = "none";
        playerCells.push(node);
        if (1 == playerCells.length) {
            nodeX = node.x;
            nodeY = node.y;
        }
    }
}

// ========== УСТАНОВКА СТИКЕРА ==========
if (stickerData) {
    node.currentSticker = stickerData;
    node.stickerActive = true;
}else if (node) {
     node.stickerActive = false;
     node.currentSticker = null;
}
// =======================================

            node.isVirus = flagVirus;
            node.isEjected = flagEjected;
            node.isAgitated = flagAgitated;
            if (type === 1) node.isFood = true;
            node.nx = posX;
            node.ny = posY;
            node.setSize(size);
            node.updateTime = timestamp;
            node.flag = spiked;

            if (name) node.setName(name);
			
			// ←←← ВОТ СЮДА! СРАЗУ ПОСЛЕ node.setName(name) ←←←
if (name && playerId === ownerPlayerId) {
    const lowerName = name.toLowerCase().trim();

    const isAdmin = admins.some(admin => lowerName.includes(admin.toLowerCase()));
    const isModer = moderator.some(moder => lowerName.includes(moder.toLowerCase()));

    // СОХРАНЯЕМ РОЛЬ ГЛОБАЛЬНО
    if (isAdmin) {
        currentUserRole = 'admin';
    } else if (isModer) {
        currentUserRole = 'moderator';
    } else {
        currentUserRole = 'user';
    }

    const panel = document.querySelector('.adminpanel');
    if (!panel) return;

    panel.style.display = 'none';

    if (isAdmin) {
        panel.style.display = 'flex';
        panel.style.background = 'rgb(146, 15, 15)';
        panel.textContent = 'ADMINKA';
    }
    else if (isModer) {
        panel.style.display = 'flex';
        panel.style.background = 'rgb(2, 89, 255)';
        panel.textContent = 'MODERKA';
    }
}


        }

        while (reader.canRead) {
            const node = nodes[reader.uint32()];
            if (node) node.destroy();
        }

        if (ua && playerCells.length === 0) {
    wjQuery("#statics").css("display", "flex");
    updateShareText();    // текст шаринга
        }
    }

    // Очистка зависших клеток по R (как fixDead в Petri Dish)
    function fixDead() {
        const now = Date.now();
        for (let i = nodelist.length - 1; i >= 0; i--) {
            const node = nodelist[i];
            if (!node || node.destroyed) continue;
            if (now - node.updateTime > 3000) node.destroy();
        }
    }

function sendMouseMove() {
    if (wsIsOpen()) {
        if (freeze) {
            // Отправляем зафиксированные координаты, шар не двигается
            if (!(Math.abs(oldX - posX) < 0.1 && Math.abs(oldY - posY) < 0.1)) {
                oldX = posX;
                oldY = posY;

                let msg = prepareData(21);
                msg.setUint8(0, 16);
                msg.setFloat64(1, posX, true);
                msg.setFloat64(9, posY, true);
                msg.setUint32(17, 0, true);
                wsSend(msg);
            }
        } else {
            // Шар следует за мышью
            let msgX = rawMouseX - canvasWidth / 2;
            let msgY = rawMouseY - canvasHeight / 2;

            if (64 <= msgX * msgX + msgY * msgY && !(Math.abs(oldX - X) < 0.1 && Math.abs(oldY - Y) < 0.1)) {
                oldX = X;
                oldY = Y;

                let msg = prepareData(21);
                msg.setUint8(0, 16);
                msg.setFloat64(1, X, true);
                msg.setFloat64(9, Y, true);
                msg.setUint32(17, 0, true);
                wsSend(msg);
            }
        }
    }
}
	
	

    const sendAccountToken = () => {
        const token = localStorage.accountToken;
        if (wsIsOpen() && token) {
            const msg = prepareData(1 + 2 * token.length);
            msg.setUint8(0, 114);
            for (var i = 0; i < token.length; ++i) msg.setUint16(1 + 2 * i, token.charCodeAt(i), true);
            wsSend(msg);
        }
    };

const getColorId = (hex) => {
    const index = cellColors.indexOf(hex);
    return index === -1 ? 0 : index + 1;
};
	
   function sendNickName() {
        if (wsIsOpen() && null != userNickName) {
            var msg = prepareData(1 + 2 * userNickName.length + 1);
            msg.setUint8(0, 0);
   msg.setUint8(1, getColorId(localStorage.getItem("selectedColor")));
            for (var i = 0; i < userNickName.length; ++i) msg.setUint16(1 + 2 * i + 1, userNickName.charCodeAt(i), true);
            wsSend(msg)
        }
    }



     function sendChat(str) {
        if (wsIsOpen() && (str.length < 200) && (str.length > 0) && !hideChat) {
            var msg = prepareData(2 + 2 * str.length);
            var offset = 0;
            msg.setUint8(offset++, 99);
            msg.setUint8(offset++, 0); // flags (0 for now)
            for (var i = 0; i < str.length; ++i) {
                msg.setUint16(offset, str.charCodeAt(i), true);
                offset += 2;
            }

            wsSend(msg);
        }
    }

    function wsIsOpen() {
        return null != ws && ws.readyState == ws.OPEN
    }

    function sendUint8(a) {
        if (wsIsOpen()) {
            var msg = prepareData(1);
            msg.setUint8(0, a);
            wsSend(msg)
        }
    }



    function canvasResize() {
        window.scrollTo(0, 0);

        // Используйте devicePixelRatio для корректного отображения на разных экранах
        const dpr = window.devicePixelRatio;

        // Получите размеры окна в пикселях
        canvasWidth = wHandle.innerWidth * dpr;
        canvasHeight = wHandle.innerHeight * dpr;

        // Установите размеры холста в пикселях
        nCanvas.width = canvasWidth;
        nCanvas.height = canvasHeight;

        // Масштабируйте контекст холста, чтобы изображение не размывалось
        nCanvas.style.width = `${wHandle.innerWidth}px`; // Установка стиля для правильного отображения
        nCanvas.style.height = `${wHandle.innerHeight}px`;
    }

    function viewRange() {
        var ratio;
        ratio = Math.max(canvasHeight / 1080, canvasWidth / 1920);
        return ratio * zoom;
    }


    function calcViewZoom() {
        if (0 != playerCells.length) {
            for (var newViewZoom = 0, i = 0; i < playerCells.length; i++) newViewZoom += playerCells[i].size;
            newViewZoom = Math.pow(Math.min(64 / newViewZoom, 1), .4) * viewRange();
            viewZoom = (9 * viewZoom + newViewZoom) / 10;
        }
    }


let maxScore = 0;

// ===== ОБНОВЛЕНИЕ СТАТИСТИКИ =====
function updateStats() {
    const currentScore = Math.floor(calcUserScore() / 100);
    const cellCount = playerCells.length;

    // Обновляем максимум
    if (currentScore > maxScore) {
        maxScore = currentScore;
        const elMax = document.getElementById('score-max');
        if (elMax) elMax.innerText = 'Максимум: ' + maxScore;
    }

    // Обновляем текущий счёт (всегда, если изменился)
    const elCurrent = document.getElementById('score-new');
    if (elCurrent) {
        const prevScore = parseInt(elCurrent.innerText.match(/\d+/)?.[0] || '0', 10);
        if (currentScore !== prevScore) {
            elCurrent.innerText = 'Сейчас: ' + currentScore;
        }
    }

    // Обновляем количество клеток
    const elCells = document.getElementById('cell-length');
    if (elCells) {
        const prevCells = parseInt(elCells.innerText, 10) || 0;
        if (cellCount !== prevCells) {
            elCells.innerText = cellCount;
        }
    }
}


// ===== СООБЩЕНИЯ ДЛЯ ШАРИНГА =====
const scoreMessages = {
    low: [
        "Ничего, зови друзей и попробуй ещё раз!",
        "Только начало! Поделись с друзьями и вернись сильным!",
        "Быстро умер? Зови друзей, пусть они покажут мастерство!",
        "Не расстраивайся, каждая игра — это опыт. Попробуй снова!",
        "Попробуй поменять фон в настройках — может, поможет!",
        "Используй F, чтобы остановиться и обдумать стратегию!",
        "Терпение и стратегия важнее скорости!",
        "Нажимая W — выделяется цешка (маленькая масса)."
    ],
    mid: [
        "Неплохо! Позови друзей и бросьте друг другу вызов!",
        "Хорошая игра! Поделись результатом и зови друзей!",
        "Ты уже на полпути! Продолжай и удиви всех!",
        "F — для паузы и стратегии. Используй с умом!",
        "W — цешка. Корми врагов или заманивай!"
    ],
    high: [
        "Вау! Легендарный результат! Делись с друзьями!",
        "Ты на вершине! Покажи, кто настоящий чемпион!",
        "Превосходно! Каждый шаг — как по учебнику!",
        "Настройки фона — твой стиль, твоя концентрация!",
        "F в нужный момент — контроль даже на вершине!",
        "Ты — мастер! Бей рекорды дальше!"
    ]
};

function getShareMessage() {
    const max = maxScore;
    const messages = max < 1000 ? scoreMessages.low 
                   : max < 10000 ? scoreMessages.mid 
                   : scoreMessages.high;
    return messages[Math.floor(Math.random() * messages.length)];
}

function updateShareText() {
    const el = document.getElementById('shareText');
    if (el) el.textContent = getShareMessage();
}

function getStatsText() {
    return `Моя статистика в Agar.su!\nМаксимальная масса: ${maxScore}\nВремя игры: ${Date.now()}`;
}

function shareStats(platform) {
    const text = encodeURIComponent(getStatsText());
    const url = encodeURIComponent(location.href);
    const urls = {
        vk: `https://vk.com/share.php?url=${url}&title=${text}`,
        telegram: `https://t.me/share/url?url=${url}&text=${text}`,
        whatsapp: `https://wa.me/?text=${text}%20${url}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`,
        twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`
    };

    const w = 650, h = 450;
    const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
    window.open(urls[platform] || '', '_blank', 
        `width=${w},height=${h},top=${top},left=${left},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('load', () => {
    updateShareText();
    ['vk', 'telegram', 'whatsapp', 'facebook', 'twitter'].forEach(p => {
        const btn = document.querySelector(`.${p}`);
        if (btn) btn.addEventListener('click', () => shareStats(p));
    });
});




let lastTime = performance.now();
let fps = 0;
let fpsUpdateTime = 0; // время последнего обновления HTML

function redrawGameScene(now) {
    const delta = now - lastTime; // время кадра
    lastTime = now;
    fps = Math.round(1000 / delta);

    if (now - fpsUpdateTime >= 1000) {
        document.getElementById('fps').textContent = fps;
        fpsUpdateTime = now;
    }

    drawGameScene();

    wHandle.requestAnimationFrame(redrawGameScene);
}




function drawGameScene() {
    const oldtime = Date.now();
    timestamp = oldtime;

    const playerCount = playerCells.length;
	
    // Обновление позиции игрока и масштаба
    if (playerCount > 0) {
        calcViewZoom();
        let sumX = 0, sumY = 0;
        for (let i = 0; i < playerCount; i++) {
            const cell = playerCells[i];
            cell.updatePos();
            sumX += cell.x;
            sumY += cell.y;
        }
        const avgX = sumX / playerCount;
        const avgY = sumY / playerCount;

        posX = avgX;
        posY = avgY;
        posSize = viewZoom;

        nodeX = (nodeX + avgX) / 2;
        nodeY = (nodeY + avgY) / 2;
    } else {
        nodeX = (29 * nodeX + posX) / 30;
        nodeY = (29 * nodeY + posY) / 30;
        viewZoom = (9 * viewZoom + posSize * viewRange()) / 10;
    }

    buildQTree();
    mouseCoordinateChange();
    drawGrid();
    drawCenterBackground();
    updateMiniMapPosition();


    nodelist.sort((a, b) => a.size - b.size || a.id - b.id);

    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(viewZoom, viewZoom);
    ctx.translate(-nodeX, -nodeY);

    drawCustomMapBackground(ctx);

    for (let i = 0; i < nodelist.length; i++) nodelist[i].drawOneCell(ctx);


    ctx.restore();


    drawSplitIcon(ctx);
    drawTouch(ctx);
}



    function drawTouch(ctx) {
        ctx.save();
        if (touchable) {
            for (var i = 0; i < touches.length; i++) {
                var touch = touches[i];
                if (touch.identifier == leftTouchID) {
                    // Джойстик
                    ctx.beginPath();
                    ctx.strokeStyle = "#0096ff";
                    ctx.lineWidth = 6;
                    ctx.arc(leftTouchStartPos.x, leftTouchStartPos.y, 40, 0, Math.PI * 2, true);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.strokeStyle = "#0096ff";
                    ctx.lineWidth = 2;
                    ctx.arc(leftTouchStartPos.x, leftTouchStartPos.y, 140, 0, Math.PI * 2, true);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.strokeStyle = "#0096ff";
                    ctx.arc(leftTouchPos.x, leftTouchPos.y, 40, 0, Math.PI * 2, true);
                    ctx.stroke();

                    // Курсор
                    ctx.fillStyle = "#0096ff";
                    ctx.fillRect(
                        rawMouseX - cursorSize / 2,
                        rawMouseY - cursorSize / 2,
                        cursorSize,
                        cursorSize
                    );
                }
            }
        }
        ctx.restore();
    }


// ==================== COOKIE ====================
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}
function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

// ==================== CUSTOM MAP / VIRUS BACKGROUNDS ====================
let customMapBgEnabled = false;
let customVirusBgEnabled = false;
let customMapBgMode = "stretch";
let customMapBgTileSize = 512;
let mapBgImage = null;
let virusBgImage = null;
const CUSTOM_BG_STORAGE_MAX = 900000;

function loadBgImageFromDataUrl(dataUrl, onReady) {
    if (!dataUrl) {
        onReady(null);
        return;
    }
    const img = new Image();
    img.onload = () => onReady(img);
    img.onerror = () => onReady(null);
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

function drawCustomMapBackground(ctx) {
    if (!customMapBgEnabled || !mapBgImage || !mapBgImage.complete || !mapBgImage.width) return;
    const left = leftPos;
    const top = topPos;
    const right = rightPos;
    const bottom = bottomPos;
    const mapW = right - left;
    const mapH = bottom - top;
    if (mapW <= 0 || mapH <= 0) return;

    const halfW = canvasWidth / (2 * viewZoom);
    const halfH = canvasHeight / (2 * viewZoom);
    const visLeft = Math.max(left, nodeX - halfW);
    const visRight = Math.min(right, nodeX + halfW);
    const visTop = Math.max(top, nodeY - halfH);
    const visBottom = Math.min(bottom, nodeY + halfH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, mapW, mapH);
    ctx.clip();

    if (customMapBgMode === "repeat") {
        const tile = Math.max(32, customMapBgTileSize | 0);
        const startX = left + Math.floor((visLeft - left) / tile) * tile;
        const startY = top + Math.floor((visTop - top) / tile) * tile;
        for (let x = startX; x < visRight; x += tile) {
            for (let y = startY; y < visBottom; y += tile) {
                ctx.drawImage(mapBgImage, x, y, Math.min(tile, right - x), Math.min(tile, bottom - y));
            }
        }
    } else {
        ctx.drawImage(mapBgImage, left, top, mapW, mapH);
    }
    ctx.restore();
}

// Картинка внутри формы вируса вместо заливки цветом (одна на клетку, без плитки)
function drawVirusFillBackground(ctx, cell, renderSize, simpleRender, bigPointSize) {
    if (!customVirusBgEnabled || !virusBgImage || !virusBgImage.complete || !virusBgImage.width) return false;
    const half = (simpleRender ? renderSize : bigPointSize) * 1.15;

    ctx.save();
    ctx.clip();
    ctx.drawImage(virusBgImage, cell.x - half, cell.y - half, half * 2, half * 2);
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

function syncBgTileRows() {
    const mapRow = document.getElementById("map-bg-tile-row");
    if (mapRow) mapRow.style.display = customMapBgMode === "repeat" ? "flex" : "none";
}

let customBgSettingsInitialized = false;

function initCustomBgSettings() {
    if (customBgSettingsInitialized) return;
    customBgSettingsInitialized = true;

    customMapBgMode = getCookie("custom_map_bg_mode") || "stretch";
    customMapBgTileSize = parseInt(getCookie("custom_map_bg_tile"), 10) || 512;

    const mapMode = document.getElementById("map-bg-mode");
    const mapTile = document.getElementById("map-bg-tile");
    if (mapMode) mapMode.value = customMapBgMode;
    if (mapTile) mapTile.value = customMapBgTileSize;
    syncBgTileRows();

    const enabledMap = getCookie("checkbox-15");
    if (enabledMap !== undefined && enabledMap !== null) customMapBgEnabled = enabledMap === "true";
    const enabledVirus = getCookie("checkbox-16");
    if (enabledVirus !== undefined && enabledVirus !== null) customVirusBgEnabled = enabledVirus === "true";

    loadBgImageFromDataUrl(localStorage.getItem("custom_map_bg_image"), img => {
        mapBgImage = img;
        updateBgPreview("map-bg-preview", img ? localStorage.getItem("custom_map_bg_image") : null);
    });
    loadBgImageFromDataUrl(localStorage.getItem("custom_virus_bg_image"), img => {
        virusBgImage = img;
        updateBgPreview("virus-bg-preview", img ? localStorage.getItem("custom_virus_bg_image") : null);
    });

    function bindBgFile(fileId, storageKey, previewId, setImage) {
        const input = document.getElementById(fileId);
        if (!input) return;
        input.addEventListener("change", function() {
            const file = input.files && input.files[0];
            if (!file) return;
            const reader = new FileReader();
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

    bindBgFile("map-bg-file", "custom_map_bg_image", "map-bg-preview", img => { mapBgImage = img; });
    bindBgFile("virus-bg-file", "custom_virus_bg_image", "virus-bg-preview", img => { virusBgImage = img; });

    const mapClear = document.getElementById("map-bg-clear");
    const virusClear = document.getElementById("virus-bg-clear");
    if (mapClear) mapClear.addEventListener("click", () => {
        mapBgImage = null;
        saveBgImageToStorage("custom_map_bg_image", null);
        updateBgPreview("map-bg-preview", null);
        const fi = document.getElementById("map-bg-file");
        if (fi) fi.value = "";
    });
    if (virusClear) virusClear.addEventListener("click", () => {
        virusBgImage = null;
        saveBgImageToStorage("custom_virus_bg_image", null);
        updateBgPreview("virus-bg-preview", null);
        const fi = document.getElementById("virus-bg-file");
        if (fi) fi.value = "";
    });

    if (mapMode) mapMode.addEventListener("change", function() {
        customMapBgMode = this.value;
        setCookie("custom_map_bg_mode", customMapBgMode, 365);
        syncBgTileRows();
    });
    if (mapTile) mapTile.addEventListener("change", function() {
        customMapBgTileSize = Math.max(64, parseInt(this.value, 10) || 512);
        this.value = customMapBgTileSize;
        setCookie("custom_map_bg_tile", customMapBgTileSize, 365);
    });
}

// ==================== GRID DRAW ====================
function drawGrid() {
	  // Проверяем наличие контекста
  if (!ctx) return;
  const savedTheme = getCookie('grid_theme');
  let themeToDraw = savedTheme || 'gradient'; // по умолчанию градиент, без привязки к системе

  switch (themeToDraw) {
    case 'gradient': drawGradientGrid(); break;
    case 'white': drawWhiteGrid(); break;
    case 'black': drawBlackGrid(); break;
    default: drawGradientGrid();
  }
}

// ==================== DOM READY ====================
document.addEventListener('DOMContentLoaded', function() {
  const selectElement = document.getElementById('theme-select');
  const centerColor = document.getElementById('gradient-center');
  const edgeColor = document.getElementById('gradient-edge');

  // обработка изменения темы
  selectElement.addEventListener('change', function() {
    setCookie('grid_theme', this.value, 30);
    drawGrid();
  });

  // обработка изменения цветов
  [centerColor, edgeColor].forEach(input => {
    input.addEventListener('input', function() {
      setCookie('gradient_center', centerColor.value, 30);
      setCookie('gradient_edge', edgeColor.value, 30);
      drawGrid();
    });
  });

  // загрузка сохранённой темы (если нет сохранённой - градиент по умолчанию)
  let savedTheme = getCookie('grid_theme');
  if (!savedTheme) {
    savedTheme = 'gradient';
    setCookie('grid_theme', savedTheme, 30);
  }
  selectElement.value = savedTheme;

  // загружаем цвета
  centerColor.value = getCookie('gradient_center') || "#132745";
  edgeColor.value = getCookie('gradient_edge') || "#000000";

  loadClientColorSettings();
  const clientColorInputs = [
    ["client-color-virus", "client_color_virus", () => clientColorVirus, v => { clientColorVirus = v; }],
    ["client-color-food", "client_color_food", () => clientColorFood, v => { clientColorFood = v; }],
    ["client-color-enemy", "client_color_enemy", () => clientColorEnemy, v => { clientColorEnemy = v; }],
    ["client-color-own", "client_color_own", () => clientColorOwn, v => { clientColorOwn = v; }],
    ["client-color-eject", "client_color_eject", () => clientColorEject, v => { clientColorEject = v; }]
  ];
  clientColorInputs.forEach(([id, cookieKey, getter, setter]) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = getCookie(cookieKey) || getter();
    input.addEventListener("input", function() {
      setter(input.value);
      saveClientColorSetting(cookieKey, input.value);
    });
  });

  initCustomBgSettings();
  initKeybindSettings();
  initSettingsNav();
  
  drawGrid();
});
// ==================== GRADIENT ====================
function drawGradientGrid() {
	  // Проверяем, что контекст существует
  if (!ctx) {
    console.warn('Canvas context not ready yet');
    return;
  }
  const centerColor = getCookie('gradient_center') || "#132745";
  const edgeColor = getCookie('gradient_edge') || "#000000";

  const mapCenterX = (leftPos + rightPos) / 2;
  const mapCenterY = (topPos + bottomPos) / 2;
  const gradientRadius = Math.sqrt(Math.pow(rightPos - leftPos, 2) + Math.pow(bottomPos - topPos, 2)) / 2;

  const gradient = ctx.createRadialGradient(
      (mapCenterX - nodeX) * viewZoom + canvasWidth / 2,
      (mapCenterY - nodeY) * viewZoom + canvasHeight / 2,
      0,
      (mapCenterX - nodeX) * viewZoom + canvasWidth / 2,
      (mapCenterY - nodeY) * viewZoom + canvasHeight / 2,
      gradientRadius * viewZoom
  );

  gradient.addColorStop(0, centerColor);
  gradient.addColorStop(1, edgeColor);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

function drawClassicGrid(bgColor, lineColor) {
	if (!ctx) return;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    ctx.scale(viewZoom, viewZoom);

    const vw = canvasWidth  / viewZoom;
    const vh = canvasHeight / viewZoom;

    ctx.strokeStyle = lineColor;
    ctx.globalAlpha  = 0.1;         // чуть ярче — лучше видно
    //ctx.lineWidth    = 1; // сохраняем визуальную толщину ~1px

    ctx.beginPath();

    // вертикальные
    let x = -0.5 + (-nodeX + vw / 2) % 50;
    for (; x < vw; x += 50) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, vh);
    }

    // горизонтальные
    let y = -0.5 + (-nodeY + vh / 2) % 50;
    for (; y < vh; y += 50) {
        ctx.moveTo(0, y);
        ctx.lineTo(vw, y);
    }

    ctx.stroke();
    ctx.restore();
}

// тогда вместо двух функций:
function drawBlackGrid() {
    drawClassicGrid("#101010", "white");
}

function drawWhiteGrid() {
    drawClassicGrid("#F2FBFF", "#111111");
}


    // Инициализация изображений
    const innerImage = new Image();
    const centerBackground = new Image();
    centerBackground.src = "/assets/photo/center.png"; // Фоновое изображение

    // Переменные для хранения данных топ-1 игрока
    let topPlayerNick = '';
    let topPlayerScore = 0;
    let topPlayerSkin = '';

    // Переменные для изменения размеров изображений
    let backgroundWidth = 512;  // Ширина фонового изображения
    let backgroundHeight = 512; // Высота фонового изображения
    let innerImageWidth = 450;  // Ширина скина игрока
    let innerImageHeight = 450; // Высота скина игрока

    // Функция для загрузки данных о топ-1 игроке
    function loadTopPlayerData(stat) {
        try {
            if (stat.length > 0) {
                const topPlayer = stat[0]; // Топ-1 игрок
                topPlayerNick = topPlayer.nick;
                topPlayerScore = topPlayer.score;
            const normalizedNick = normalizeNick(topPlayer.nick);
            const skinId = skinList[normalizedNick];
                innerImage.src = skinId
                    ? `https://api.agar.su/skins/${skinId}.png`
                    : "https://api.agar.su/skins/4.png";

                topPlayerSkin = skinId || 'default';
            }
        } catch (error) {
            console.error('Ошибка обработки данных о топ-1 игроке:', error);
        }
    }

    // Загрузка изображений
    let isBackgroundLoaded = false;
    let isInnerImageLoaded = false;

    centerBackground.onload = function () {
        isBackgroundLoaded = true;
        drawCenterBackground();
    };

    innerImage.onload = function () {
        isInnerImageLoaded = true;
        drawCenterBackground();
    };

    function drawCenterBackground() {
        if (!isBackgroundLoaded || !isInnerImageLoaded) {
            return;
        }

        const mapCenterX = (leftPos + rightPos) / 2;
        const mapCenterY = (topPos + bottomPos) / 2;

        const screenX = (mapCenterX - nodeX) * viewZoom + canvasWidth / 2;
        const screenY = (mapCenterY - nodeY) * viewZoom + canvasHeight / 2;

        const scaledBackgroundWidth = backgroundWidth * viewZoom;
        const scaledBackgroundHeight = backgroundHeight * viewZoom;
        const scaledInnerImageWidth = innerImageWidth * viewZoom;
        const scaledInnerImageHeight = innerImageHeight * viewZoom;

        // Сначала рисуем внутреннее изображение (скин игрока) в виде круга
        ctx.save();
        const radius = Math.min(scaledInnerImageWidth, scaledInnerImageHeight) / 2; // Радиус круга

        // Создаём круг
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
            innerImage,
            screenX - scaledInnerImageWidth / 2,
            screenY - scaledInnerImageHeight / 2,
            scaledInnerImageWidth,
            scaledInnerImageHeight
        );

        ctx.restore();

        // Затем рисуем фон
        ctx.drawImage(
            centerBackground,
            screenX - scaledBackgroundWidth / 2,
            screenY - scaledBackgroundHeight / 2,
            scaledBackgroundWidth,
            scaledBackgroundHeight
        );

        // Устанавливаем стиль текста
        ctx.fillStyle = "white";
        ctx.font = `${22 * viewZoom}px Ubuntu`;
        ctx.textAlign = "center";

        ctx.fillText(topPlayerNick, screenX, screenY + radius - 415 * viewZoom);
        ctx.fillText(`${topPlayerScore}`, screenX, screenY + radius - 15 * viewZoom);
    }


let lastCell = '';
let lastHighlightedSpan = null;

function updateMiniMapPosition() {
    const playerDot = document.getElementById('mapposition');
    const mapContainer = document.querySelector('.map-container');
    const cells = mapContainer.querySelectorAll('div > span');

    if (!playerDot || !mapContainer) return;

    const totalMapWidth = rightPos - leftPos;
    const totalMapHeight = bottomPos - topPos;

    const miniMapWidth = mapContainer.offsetWidth;
    const miniMapHeight = mapContainer.offsetHeight;

    let relativeX = (nodeX - leftPos) / totalMapWidth;
    let relativeY = (nodeY - topPos) / totalMapHeight;

    let miniX = Math.round(relativeX * miniMapWidth);
    let miniY = Math.round(relativeY * miniMapHeight);

    const dotRadius = playerDot.offsetWidth / 2;
    playerDot.style.left = (miniX - dotRadius) + 'px';
    playerDot.style.top = (miniY - dotRadius) + 'px';

    const cols = 5;
    const rows = 5;
    const cellWidth = miniMapWidth / cols;
    const cellHeight = miniMapHeight / rows;

    const colIndex = Math.floor(miniX / cellWidth);
    const rowIndex = Math.floor(miniY / cellHeight);
    const rowLetters = ['A','B','C','D','E'];
    const currentCell = rowLetters[rowIndex] + (colIndex + 1);

    if (lastCell !== currentCell) {
        // Убираем подсветку с предыдущей клетки
        if (lastHighlightedSpan) lastHighlightedSpan.style.color = '';
        // Находим новый span
        lastHighlightedSpan = Array.from(cells).find(span => span.textContent === currentCell);
        if (lastHighlightedSpan) lastHighlightedSpan.style.color = 'gold';
        lastCell = currentCell;
    }
}


let canSendCoord = true;

wHandle.coord = function () {
    if (canSendCoord) {
        if (lastCell) sendChat(lastCell);
        canSendCoord = false;
        setTimeout(function() {
            canSendCoord = true;
        }, 3000);
    }
}



    function drawSplitIcon(ctx) {
        var size = ~~(canvasWidth / 7);
        if (isTouchStart) {  // Проверяем, что экран был сенсорным
            // Анимация для кнопки "split"
            if (splitPressed && splitIcon.width) {
                ctx.save();
                ctx.scale(1.1, 0);
            }
            if (splitIcon.width) {
                ctx.drawImage(splitIcon, canvasWidth - size, canvasHeight - size, size, size);
            }
            if (splitPressed) {
                ctx.restore();
                setTimeout(() => splitPressed = false, 150);
            }

            // Анимация для кнопки "eject"
            if (ejectPressed && ejectIcon.width) {
                ctx.save();
                ctx.scale(1.1, 0); // Увеличиваем на 10% при нажатии
            }
            if (ejectIcon.width) {
                ctx.drawImage(ejectIcon, canvasWidth - size, canvasHeight - 2 * size - 20, size, size);
            }
            if (ejectPressed) {
                ctx.restore();
                setTimeout(() => ejectPressed = false, 150); // Восстановление после анимации через 150ms
            }
        }
    }
    function calcUserScore() {
        let score = 0;
        for (let i = 0; i < playerCells.length; i++) {
            score += playerCells[i].nSize * playerCells[i].nSize;
        }
        return score;
    }

const tournament = ["𝓙𝓲𝓷𝔁","༼ᵍᵃⁿᵍ༽༼٥९९٥༽ぶ","Vaas","liquid","☼K☼","v_potoke","⧼♢ᛃ╰🎀ᵁ℘ܔ🎀╯ᛃ♢⧼","lampy","༄ۣۜL͛ᴇɢɪᴏɴ","【≽ܫ≼】█▬█ █ ▀█▀","Курага","Jeff","Morcov","SalRuz","lnvalid","Muslim95","Power girl","pac man","pulik"];

// Победитель турнира (для сравнения используем toLowerCase)
const tournamentWinner = "Vaas";

function createLeaderboardEntry(name, packetXp, accountAvatar, isMe, isSystemLine, b) {
  const entryDiv = document.createElement("div");
  const lowerName = (name || "").toLowerCase();
  
  // Очищаем имя от HTML тегов для сравнения с турнирным списком
  const cleanName = name.replace(/<[^>]*>/g, '');
  const cleanNameLower = cleanName.toLowerCase();
  
  // Сравниваем в нижнем регистре
  const isTournamentPlayer = tournament.some(tourneyName => tourneyName.toLowerCase() === cleanNameLower);
  const isWinner = (tournamentWinner.toLowerCase() === cleanNameLower);

  // Определяем класс: админ, модер, ютубер или обычный
  if (!isSystemLine && admins.includes(lowerName)) {
    entryDiv.className = "Lednick admins";
  } else if (!isSystemLine && moders.includes(lowerName)) {
    entryDiv.className = "Lednick " + lowerName;
  } else {
    entryDiv.className = "Lednick";
  }

  const numberHtml = isSystemLine ? "" : `${b + 1}. `;
  if (isSystemLine) entryDiv.style.textAlign = "center";
  
  // Устанавливаем цвет: для меня розовый, для турнирных игроков золотой, иначе белый
  if (isMe) {
    entryDiv.style.color = "#FFAAAA";
  } else if (!isSystemLine && isTournamentPlayer) {
    entryDiv.style.color = "#FFD700"; // Золотой цвет для турнирных игроков
  } else {
    entryDiv.style.color = "#FFFFFF";
  }

  // Основной контейнер для имени
  const nameSpan = document.createElement("span");
  
  // Вставляем HTML-разметку, если она присутствует в имени
  nameSpan.innerHTML = name;
  
  // Добавляем тултип и клик для турнирных игроков
  if (!isSystemLine && isTournamentPlayer) {
    nameSpan.title = isWinner ? "🏆 ПОБЕДИТЕЛЬ ТУРНИРА 🏆" : "Участник турнира";
    nameSpan.style.cursor = "pointer";
    nameSpan.onclick = function() {
      window.open("https://agar.su/tournament", "_blank");
    };
  }

  // Контейнер для иконок (звезда + ютуб + спонсор + победитель)
  const iconsContainer = document.createElement("span");

  if (!isSystemLine) {
    const levelIndicator = createLevelIndicator(packetXp, accountAvatar);
    if (levelIndicator) iconsContainer.appendChild(levelIndicator);
  }

  // Иконка YouTube для ютуберов
  const ytIndex = youtubers.indexOf(lowerName);
  if (!isSystemLine && ytIndex !== -1 && url_youtubers[ytIndex]) {
    const ytLink = document.createElement("a");
    ytLink.href = url_youtubers[ytIndex];
    ytLink.target = "_blank";
    ytLink.innerHTML = '<i class="fab fa-youtube"></i>';
    ytLink.style.color = "#ff0000";
    ytLink.title = "YouTube канал";
    iconsContainer.appendChild(ytLink);
  }
  
  // Иконка MOD (спонсор)
  if (!isSystemLine && mod.includes(lowerName)) {
    const modIcon = document.createElement("div");
    modIcon.title = "Данный игрок является спонсором Agar.su";
    modIcon.style.width = "19px";
    modIcon.style.height = "19px";
    modIcon.style.backgroundImage = "url(./assets/photo/mod.png)";
    modIcon.style.backgroundSize = "cover";
    modIcon.style.display = "inline-block";
    iconsContainer.appendChild(modIcon);
  }
  
  // Иконка ПОБЕДИТЕЛЯ для Vaas (сравниваем без учёта регистра)
  if (!isSystemLine && isWinner) {
    const winnerIcon = document.createElement("div");
    winnerIcon.title = "🏆 ПОБЕДИТЕЛЬ ТУРНИРА 🏆";
    winnerIcon.style.width = "18px";
    winnerIcon.style.height = "18px";
    winnerIcon.style.backgroundImage = "url(./assets/photo/trophy.png)";
    winnerIcon.style.backgroundSize = "cover";
    winnerIcon.style.display = "inline-block";
    iconsContainer.appendChild(winnerIcon);
  }
  
  // Собираем HTML
  entryDiv.innerHTML = numberHtml;
  entryDiv.appendChild(iconsContainer);
  entryDiv.appendChild(nameSpan);

  return entryDiv;
}

function drawCustomLeaderBoard() {
  const toplistDiv = document.getElementById("toplistnow");
  toplistDiv.innerHTML = ""; // очищаем

  if (leaderBoard && leaderBoard.length > 0) {
    for (let b = 0; b < leaderBoard.length; ++b) {
      let name = leaderBoard[b].name || "Игрок";
      const isSystemLine = leaderBoard[b].id == null; // турнир/арена строка без id

      // Для кастомного режима — сравнение по имени (если включен noRanking)
      let isMe = false;
      if (noRanking && leaderBoard[b].name) {
        const myName = playerCells[0]?.name || "";
        if (myName && myName.toLowerCase() === leaderBoard[b].name.toLowerCase()) {
          isMe = true;
        }
      }

      if (isMe) {
        const myCell = playerCells.find(cell => cell.id === leaderBoard[b].id);
        if (myCell?.name) {
          name = myCell.name;
        }
      }

      // Преобразуем имя, если оно содержит *streak*
      name = name.replace(/\*(\d+)\*/g, (match, p1) => {
        return `<span title="Серия побед подряд" class="streak">${p1}</span>`;
      });

      // Отображаем игрока в кастомном leaderboard, если он в топ-10
      if (b < 10) {
        const entryDiv = createLeaderboardEntry(name, leaderBoard[b].xp, leaderBoard[b].accountAvatar, isMe, isSystemLine, b);
        
        // Вставляем HTML-код с помощью insertAdjacentHTML
        toplistDiv.insertAdjacentHTML("beforeend", entryDiv.outerHTML);
      }
    }
  }
}

function drawLeaderBoard() {
  const toplistDiv = document.getElementById("toplistnow");
  toplistDiv.innerHTML = ""; // очищаем
  const displayedPlayers = 10;
  let myRank = null;

  if (leaderBoard && leaderBoard.length > 0) {
    for (let b = 0; b < leaderBoard.length; ++b) {
      let name = leaderBoard[b].name || "Игрок";
      const isSystemLine = leaderBoard[b].id == null; // турнир/арена строка без id

      // Определяем, если это я (сравнение по имени для кастомного режима)
      let isMe = false;
      if (!isSystemLine) {
        isMe = playerCells.some(cell => cell.id === leaderBoard[b].id);
      }

      if (noRanking && leaderBoard[b].name) {
        const myName = playerCells[0]?.name || "";
        if (myName && myName.toLowerCase() === leaderBoard[b].name.toLowerCase()) {
          isMe = true;
        }
      }

      if (isMe) {
        const myCell = playerCells.find(cell => cell.id === leaderBoard[b].id);
        if (myCell?.name) {
          name = myCell.name;
          myRank = b + 1;
        }
      }

      // Отображаем игрока, если он в топ-10
      if (b < displayedPlayers) {
        const entryDiv = createLeaderboardEntry(name, leaderBoard[b].xp, leaderBoard[b].accountAvatar, isMe, isSystemLine, b);
        toplistDiv.appendChild(entryDiv);
      }
    }

    // Показываем свой ранг, если вне топ-10
    if (myRank && myRank > displayedPlayers) {
      const myPacketXp = accountData ? accountData.xp + 1 : 0;
      const myAvatar = accountData && accountData.xp >= MAX_LEVEL_XP
        ? (accountData.account_avatar || accountData.accountAvatar || "")
        : "";
      let myName = playerCells[0].name;

      const myRankDiv = createLeaderboardEntry(myName, myPacketXp, myAvatar, true, false, myRank - 1);
      myRankDiv.style.color = "#FFAAAA"; // Для меня выделяем цветом
      toplistDiv.appendChild(myRankDiv);
    }
  }
}


    function Cell(uid, ux, uy, usize, ucolor, uname) {
        this.id = uid;
        this.ox = this.x = ux;
        this.oy = this.y = uy;
        this.oSize = this.size = usize;
        this.color = ucolor;
        this.points = [];
        this.pointsAcc = [];
        this.createPoints();
        this.setName(uname)
    }

    function UText(usize, ucolor, ustroke, ustrokecolor) {
        usize && (this._size = usize);
        ucolor && (this._color = ucolor);
        this._stroke = !!ustroke;
        ustrokecolor && (this._strokeColor = ustrokecolor)
    }

       var nCanvas, ctx, mainCanvas, canvasWidth, canvasHeight, qTree = null,
        ws = null,
        nodeX = 0,
        nodeY = 0,
        playerCells = [],
        nodes = {},
        nodelist = [],
        Cells = [],
        leaderBoard = [],
        chatBoard = [],
        rawMouseX = 0,
        rawMouseY = 0,
        X = -1,
        Y = -1,
        timestamp = 0,
        userNickName = null,
        leftPos = 0,
        topPos = 0,
        rightPos = 1E4,
        bottomPos = 1E4,
        foodMinSize = 0,
        foodMaxSize = 0,
        ownerPlayerId = -1,
        mapWidth = 0,
        mapHeight = 0,
        viewZoom = 1,
        ua = false,
        // userScore = 0,
        posX = nodeX = ~~((leftPos + rightPos) / 2),
        posY = nodeY = ~~((topPos + bottomPos) / 2),
        posSize = 1,
        ma = false,
        zoom = 1,
        isTouchStart = "ontouchstart" in wHandle && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        splitIcon = new Image,
        ejectIcon = new Image,
        noRanking = false;
    splitIcon.src = "assets/photo/split.png";
    ejectIcon.src = "assets/photo/eject.png";
    wHandle.connect = wsConnect;
	let showConnect = false;

wHandle.setNick = function (arg) {
    setserver(SELECTED_SERVER); 
    hideOverlays(); 
    userNickName = arg; 
    sendNickName(); 
    wjQuery("#statics").hide(); 
    maxScore = 0; 
    
    if (!showConnect) {
        showConnecting();
        showConnect = true;
    }
};
    wHandle.spectate = function () { setserver(SELECTED_SERVER);  userNickName = null; hideOverlays(); wjQuery("#statics").hide();    if (!showConnect) {
        showConnecting();
        showConnect = true;
    }};
	
// === Настройки по умолчанию ===
let showSkin = true,
    showName = true,
    showColor = true,
    showMass = true,
    hideChat = false,
    smoothRender = 0.4,
    closebord = false,
    enableMouseClicks = false,
    mouseSplitButton = 3,
    mouseEjectButton = 1,
    showGlow = true,
    confirmCloseTab = false,
    showAdultContent = false,
    fixedCell = false,
    showStickers = true,
    customClientColors = false,
    clientColorVirus = "#33ff33",
    clientColorFood = "#ffe066",
    clientColorEnemy = "#ff4444",
    clientColorOwn = "#4488ff",
    clientColorEject = "#ff66cc";

function isEjectedMass(cell) {
    if (!cell || cell.isVirus || cell.isFood) return false;
    if (playerCells.indexOf(cell) !== -1) return false;
    const flags = cell.flag | 0;
    if (flags & 0x20 || flags & 0x40 || cell.isEjected) return true;
    const sz = cell.nSize || cell.size || 0;
    if (sz <= 0 || !(foodMaxSize > 0)) return false;
    return sz > foodMaxSize && sz <= Math.max(55, foodMaxSize + 20);
}

function getClientCellColor(cell) {
    if (!customClientColors) return null;
    if (cell.isVirus) return clientColorVirus;
    if (cell.isFood) return clientColorFood;
    if (playerCells.indexOf(cell) !== -1) return clientColorOwn;
    if (isEjectedMass(cell)) return clientColorEject;
    if (!cell.isVirus && !cell.isFood && playerCells.indexOf(cell) === -1) {
        return clientColorEnemy;
    }
    return null;
}

function loadClientColorSettings() {
    const enabled = getCookie("checkbox-14");
    if (enabled !== undefined && enabled !== null) {
        customClientColors = enabled === "true";
    }
    clientColorVirus = getCookie("client_color_virus") || clientColorVirus;
    clientColorFood = getCookie("client_color_food") || clientColorFood;
    clientColorEnemy = getCookie("client_color_enemy") || clientColorEnemy;
    clientColorOwn = getCookie("client_color_own") || clientColorOwn;
    clientColorEject = getCookie("client_color_eject") || clientColorEject;
}

function saveClientColorSetting(key, value) {
    setCookie(key, value, 365);
}

// === Функции для чекбоксов ===
wHandle.setSkins = function(arg){ showSkin = arg; };
wHandle.setNames = function(arg){ showName = arg; };
wHandle.setColors = function(arg){ showColor = arg; };
wHandle.setMouseClicks = function(arg){
    enableMouseClicks = arg;
    syncMouseBindSettingsVisibility();
};

function syncMouseBindSettingsVisibility() {
    const block = document.getElementById("mouse-bind-settings");
    if (block) block.classList.toggle("visible", !!enableMouseClicks);
}

function cancelKeybindCapture() {
    keybindCaptureAction = null;
    document.querySelectorAll(".keybind-key.listening").forEach(el => el.classList.remove("listening"));
    renderKeybindUI();
}

function normalizeMouseButton(btn) {
    return btn === 3 ? 3 : 1;
}

function loadMouseButtonSettings() {
    const split = parseInt(getCookie("mouse_split_btn"), 10);
    const eject = parseInt(getCookie("mouse_eject_btn"), 10);
    mouseSplitButton = normalizeMouseButton(split);
    mouseEjectButton = normalizeMouseButton(eject);
    if (mouseSplitButton === mouseEjectButton) mouseEjectButton = mouseSplitButton === 1 ? 3 : 1;

    const splitSel = document.getElementById("mouse-split-btn");
    const ejectSel = document.getElementById("mouse-eject-btn");
    if (splitSel) splitSel.value = String(mouseSplitButton);
    if (ejectSel) ejectSel.value = String(mouseEjectButton);
    syncMouseBindSettingsVisibility();
}

function saveMouseButtonSettings() {
    setCookie("mouse_split_btn", mouseSplitButton, 365);
    setCookie("mouse_eject_btn", mouseEjectButton, 365);
}

function initMouseButtonSettings() {
    loadMouseButtonSettings();
    const splitSel = document.getElementById("mouse-split-btn");
    const ejectSel = document.getElementById("mouse-eject-btn");
    if (!splitSel || !ejectSel) return;

    splitSel.addEventListener("change", function() {
        mouseSplitButton = normalizeMouseButton(parseInt(this.value, 10));
        if (mouseSplitButton === mouseEjectButton) {
            mouseEjectButton = mouseSplitButton === 1 ? 3 : 1;
            ejectSel.value = String(mouseEjectButton);
        }
        saveMouseButtonSettings();
    });
    ejectSel.addEventListener("change", function() {
        mouseEjectButton = normalizeMouseButton(parseInt(this.value, 10));
        if (mouseSplitButton === mouseEjectButton) {
            mouseSplitButton = mouseEjectButton === 1 ? 3 : 1;
            splitSel.value = String(mouseSplitButton);
        }
        saveMouseButtonSettings();
    });
}
wHandle.setShowMass = function(arg){ showMass = arg; };
wHandle.setSmooth = function(arg){ smoothRender = arg ? 2 : 0.4; };
wHandle.setNoBorder = function(arg){ closebord = arg; };
wHandle.setChatHide = function(arg){ hideChat = arg; };
wHandle.setGlow = function(arg){ showGlow = arg; };
wHandle.setAdultContent = function(arg) {showAdultContent = arg;};
wHandle.setFixedCell = function(arg){fixedCell = arg;};
wHandle.setConfirmCloseTab = function(arg){confirmCloseTab = arg;};
wHandle.setShowStickers = function(arg){ showStickers = arg; };
wHandle.setCustomClientColors = function(arg){ customClientColors = arg; };
wHandle.setCustomMapBg = function(arg){ customMapBgEnabled = arg; };
wHandle.setCustomVirusBg = function(arg){ customVirusBgEnabled = arg; };
wHandle.fixDead = fixDead;

// === Обработчик закрытия вкладки ===
window.addEventListener("beforeunload", function (e) {
    if (confirmCloseTab) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// === Восстановление состояния чекбоксов из куки ===
wjQuery(window).on('load', function() {
    wjQuery(".save").each(function(){
        const id = $(this).data("box-id");
        const value = getCookie("checkbox-" + id);
        
        if (value !== undefined && value !== null) {
            $(this).prop("checked", value === "true");
        } else {
            switch(id) {
                case 1: $(this).prop("checked", showSkin); break;
                case 2: $(this).prop("checked", showName); break;
                case 3: $(this).prop("checked", showColor); break;
                case 4: $(this).prop("checked", enableMouseClicks); break;
                case 5: $(this).prop("checked", showMass); break;
                case 6: $(this).prop("checked", smoothRender > 0.4); break;
                case 7: $(this).prop("checked", closebord); break;
                case 8: $(this).prop("checked", hideChat); break;
                case 9: $(this).prop("checked", showGlow); break;
                case 10: $(this).prop("checked", showAdultContent); break;
                case 11: $(this).prop("checked", confirmCloseTab); break; 
			    case 12: $(this).prop("checked", fixedCell); break;
                case 13: $(this).prop("checked", showStickers); break;
                case 14: $(this).prop("checked", customClientColors); break;
                case 15: $(this).prop("checked", customMapBgEnabled); break;
                case 16: $(this).prop("checked", customVirusBgEnabled); break;
            }
        }
    });

    loadClientColorSettings();
    loadMouseButtonSettings();
    loadKeybinds();
    renderKeybindUI();
    wjQuery(".save").trigger("change");

    wjQuery(".save").on("change", function(){
        const id = $(this).data("box-id");
        const value = $(this).prop("checked");
        setCookie("checkbox-" + id, value, 365);

        if (id == 10) wHandle.setAdultContent(value);
        if (id == 11) wHandle.setConfirmCloseTab(value);
		if (id == 13) wHandle.setShowStickers(value);
        if (id == 14) wHandle.setCustomClientColors(value);
        if (id == 15) wHandle.setCustomMapBg(value);
        if (id == 16) wHandle.setCustomVirusBg(value);
    });
});




const transparent = new Set(["liqwid","⟨本⟩ Itana."]);
let invisible = new Set(); // сначала пустой Set
fetch("https://api.agar.su/invisible.txt")
  .then(r => r.text())
  .then(text => {
    text.split('\n').forEach(line => {
      line = line.trim().toLowerCase();
      if (line) invisible.add(line);
    });
  });
const invisible2 = new Set(["ghost", "невидимка", "shadow", "invis", "cat2","zombie"]); // невидимая масса
const rotation = new Set(); //поворот скина
fetch("https://api.agar.su/rotation.txt")
  .then(r => r.text())
  .then(text => {
    text.split('\n').forEach(line => {
      line = line.trim().toLowerCase();
      if (line) rotation.add(line);
    });
  });
let oldX = -1, oldY = -1, z = 1;
const skins = {};

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
        const tmpIndex = nodelist.indexOf(this);
        if (tmpIndex !== -1) nodelist.splice(tmpIndex, 1);
        delete nodes[this.id];

        const playerIndex = playerCells.indexOf(this);
        if (playerIndex !== -1) {
            ua = true;
            playerCells.splice(playerIndex, 1);
        }

        this.destroyed = true;
		this.fixedName = null;
        this.fixedColor = null;
    },

    getNameSize() {
        return Math.max(~~(0.3 * this.size), 24);
    },

setName(name) {
    if (fixedCell) {
        if (this.fixedName === null) {
            this.fixedName = name;   // фиксируем один раз
        }
        name = this.fixedName;
    } else {
        this.fixedName = null;       // режим выключен — сброс
    }

    this.name = name;

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
        const sizeHalf = this.getNameSize() * 0.5;
        if (!this.sizeCache) {
            this.sizeCache = new UText(sizeHalf, "#FFFFFF", true, "#000000");
        } else {
            this.sizeCache.setSize(sizeHalf);
        }
    },

    getNumPoints() {
        if (this.id === 0) return 16;
        let minPoints = this.size < 20 ? 0 : 10;
        if (this.isVirus) minPoints = 30;

        let b = this.isVirus ? this.size : this.size * viewZoom;
        b *= z;
        if (this.flag & 32) b *= 0.25;

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
            this.points.push({ ref: this, size: this.size, x: this.x, y: this.y });
            this.pointsAcc.push(Math.random() - 0.5);
        }

        while (this.points.length < numPoints) {
            const idx = ~~(Math.random() * this.points.length);
            const point = this.points[idx];
            this.points.splice(idx, 0, { ref: this, size: point.size, x: point.x, y: point.y });
            this.pointsAcc.splice(idx, 0, this.pointsAcc[idx]);
        }
    },

    movePoints() {
        this.createPoints();
        const pts = this.points;
        const acc = this.pointsAcc;
        const n = pts.length;

        for (let i = 0; i < n; i++) {
            const prev = acc[(i - 1 + n) % n];
            const next = acc[(i + 1) % n];
            acc[i] += (Math.random() - 0.5) * (this.isAgitated ? 3 : 1);
            acc[i] = Math.max(Math.min(acc[i] * 0.7, 10), -10);
            acc[i] = (prev + next + 8 * acc[i]) / 10;
        }

        const ref = this;
        const isVirus = this.isVirus ? 0 : (this.id / 1e3 + timestamp / 1e4) % (2 * Math.PI);

        for (let j = 0; j < n; j++) {
            let f = pts[j].size;
            const prev = pts[(j - 1 + n) % n].size;
            const next = pts[(j + 1) % n].size;

            if (this.size > 15 && qTree && this.size * viewZoom > 20 && this.id !== 0) {
                const x = pts[j].x, y = pts[j].y;
                let collide = false;
                qTree.retrieve2(x - 5, y - 5, 10, 10, a => {
                    if (a.ref !== ref && (x - a.x) ** 2 + (y - a.y) ** 2 < 625) collide = true;
                });
                if (!collide && (x < leftPos || y < topPos || x > rightPos || y > bottomPos)) collide = true;
                if (collide) acc[j] = Math.max(0, acc[j]) - 1;
            }

            f = Math.max(0, f + acc[j]);
            f = this.isAgitated ? (19 * f + this.size) / 20 : (12 * f + this.size) / 13;
            pts[j].size = (prev + next + 8 * f) / 10;

            const angle = (2 * Math.PI / n) * j;
            let radius = pts[j].size;
            if (this.isVirus && j % 2 === 0) radius += 5;

            pts[j].x = this.x + Math.cos(angle + isVirus) * radius;
            pts[j].y = this.y + Math.sin(angle + isVirus) * radius;
        }
    },

    updatePos() {
        if (this.id === 0) return 1;
        let a = (timestamp - this.updateTime) / 120;
        a = Math.max(0, Math.min(1, a));
        const b = a;
        this.getNameSize();
        this.x = a * (this.nx - this.ox) + this.ox;
        this.y = a * (this.ny - this.oy) + this.oy;
        this.size = b * (this.nSize - this.oSize) + this.oSize;
        return b;
    },

    shouldRender() {
        if (this.id === 0) return true;
        const margin = 40;
        return !(this.x + this.size + margin < nodeX - canvasWidth / 2 / viewZoom ||
                 this.y + this.size + margin < nodeY - canvasHeight / 2 / viewZoom ||
                 this.x - this.size - margin > nodeX + canvasWidth / 2 / viewZoom ||
                 this.y - this.size - margin > nodeY + canvasHeight / 2 / viewZoom);
    },

    // === НОВОЕ: возвращает цвет, с учётом глобальной опции showColor === false
getEffectiveColor() {
    const clientColor = getClientCellColor(this);
    if (clientColor) return clientColor;

    if (!showColor) return "#AAAAAA";

    if (fixedCell) {
        if (this.fixedColor === null) {
            this.fixedColor = this.color || "#FFFFFF";
        }
        return this.fixedColor;
    }

    this.fixedColor = null;
    return this.color || "#FFFFFF";
},

    // getStrokeColor теперь использует getEffectiveColor (чтобы обводка не показывала "старый" цвет)
    getStrokeColor() {
        const base = this.getEffectiveColor();
        // base ожидается в формате "#RRGGBB"
        const parseColor = i => {
            // безопасно дергаем подстроки, если base короткий — возвращаем "00"
            const hexPart = base && base.length >= i + 2 ? base.substr(i, 2) : "00";
            let c = Math.floor(parseInt(hexPart, 16) * 0.9).toString(16);
            return c.length === 1 ? "0" + c : c;
        };
        return `#${parseColor(1)}${parseColor(3)}${parseColor(5)}`;
    },

    drawOneCell(ctx) {
        if (!this.shouldRender()) return;

        const simpleRender = this.id !== 0 /*&& !this.isVirus*/ && !this.isAgitated && smoothRender > viewZoom || this.getNumPoints() < 10;

        if (!simpleRender && this.wasSimpleDrawing) this.points.forEach(p => p.size = this.size);

        let bigPointSize = this.size;
        if (!this.wasSimpleDrawing) this.points.forEach(p => bigPointSize = Math.max(bigPointSize, p.size));
        this.wasSimpleDrawing = simpleRender;

        ctx.save();
        this.drawTime = timestamp;
        this.updatePos();
		let renderSize = this.size;
if (renderSize === 0) renderSize = 20;

        ctx.lineWidth = closebord ? 0 : 10;
        ctx.lineCap = "round";
        ctx.lineJoin = this.isVirus ? "miter" : "round";

        const isTransp = transparent.has(this.name);
        // используем единый "эффективный" цвет для fill и (при необходимости) stroke
        const cellColor = this.getEffectiveColor();

        ctx.fillStyle = isTransp ? "rgba(0,0,0,0)" : cellColor;
        ctx.strokeStyle = isTransp ? "rgba(0,0,0,0)" : (simpleRender ? cellColor : this.getStrokeColor());

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
        if (!closebord) ctx.stroke();
        if (!useVirusImageFill) ctx.fill();



// === СКИН ===
if (showSkin && !this.isVirus) {
    const skinName = normalizeNick(this.name);
    const skinId = skinList[skinName];
    if (skinId) {
        if (!skins[skinId]) {
            skins[skinId] = new Image();
            skins[skinId].src = `https://api.agar.su/skins/${skinId}.png`;
        }
        const skinImg = skins[skinId];
        if (skinImg.complete && skinImg.width > 0) {
            ctx.save();
            ctx.clip();

            // === ПЛАВНОЕ ПРИБЛИЖЕНИЕ СКИНА ===
            if (typeof this.skinZoom === "undefined") this.skinZoom = 1;
            if (typeof this.skinPhase === "undefined") this.skinPhase = 0;

            if (this.glowActive && showGlow) {
                this.skinPhase += 0.05; // скорость приближения
                const targetZoom = 1 + Math.abs(Math.sin(this.skinPhase)) * 0.08; // только рост, ≥1
                this.skinZoom += (targetZoom - this.skinZoom) * 0.1; // плавное приближение
            } else {
                // плавный возврат к нормальному размеру
                this.skinZoom += (1 - this.skinZoom) * 0.05;
                this.skinPhase = 0;
            }

            const fw = skinImg.width, fh = skinImg.height;
            const frame = (fw > fh) ? Math.floor(Date.now() / 100 % Math.floor(fw / fh)) : 0;
            const sz = simpleRender ? this.size * this.skinZoom : (bigPointSize * this.skinZoom);

if (rotation.has(skinName)) {
    if (!this._rot) {
        this._rot = {
            target: 0,      // "развёрнутый" целевой угол (может расти бесконечно)
            current: 0,     // текущий угол, которым крутим картинку
            lastAngle: null // последний "сырой" atan2 в диапазоне [-π, π]
        };
    }

    // вектор движения клетки за последний апдейт
    const vx = this.nx - this.ox;
    const vy = this.ny - this.oy;

    // если почти не двигаемся — оставляем прежнее направление
    let rawAngle;
    if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) {
        rawAngle = this._rot.lastAngle ?? this._rot.current;
    } else {
        rawAngle = Math.atan2(vy, vx); // всегда в [-π, π]
    }

    if (this._rot.lastAngle == null) {
        // инициализация при первом кадре
        this._rot.lastAngle = rawAngle;
        this._rot.target = rawAngle;
        this._rot.current = rawAngle;
    } else {
        // считаем локальную разницу и "разворачиваем" её, чтобы не было скачков на ±π
        let d = rawAngle - this._rot.lastAngle;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;

        // накапливаем целевой угол (без лимита на количество оборотов)
        this._rot.target += d;
        this._rot.lastAngle = rawAngle;
    }

    // плавно подтягиваемся к целевому (чем больше коэффициент, тем быстрее)
    this._rot.current += (this._rot.target - this._rot.current) * 0.12;

    ctx.translate(this.x, this.y);
    ctx.rotate(this._rot.current);
    ctx.drawImage(
        skinImg,
        fw > fh ? frame * fh : 0, 0, fh, fh,
        -sz, -sz, sz * 2, sz * 2
    );
} else {
    ctx.drawImage(
        skinImg,
        fw > fh ? frame * fh : 0, 0, fh, fh,
        this.x - sz, this.y - sz, sz * 2, sz * 2
    );
}


            ctx.restore();
        }
    }
}


// === ЭФФЕКТ ПОВЕРХ СКИНА ===
const mass = Math.floor(this.size * this.size * 0.01);
if (typeof this.glowActive === 'undefined') this.glowActive = false;
if (!this.glowActive && mass >= 22400) this.glowActive = true;
if (this.glowActive && mass <= 22300) this.glowActive = false;

if (this.glowActive && showGlow) {
    const effectId = "glow"; 
    if (!skins[effectId]) {
        skins[effectId] = new Image();
        skins[effectId].src = `./assets/photo/limited.png`; // теперь обычный PNG
    }

    const effectImg = skins[effectId];
    if (effectImg.complete && effectImg.width > 0) {
        ctx.save();
        ctx.clip();

        const edrawSize = 2 * bigPointSize;

        ctx.globalAlpha = 1;
        ctx.drawImage(
            effectImg,
            this.x - edrawSize / 2,
            this.y - edrawSize / 2,
            edrawSize,
            edrawSize
        );

        ctx.restore();
    }
}

// === СТИКЕР (ОТДЕЛЬНО ОТ СКИНА) ===
if (showStickers && this.stickerActive && this.currentSticker) {
    let stickerUrl = `https://agar.su/sticker/${this.currentSticker}.png`;
    
    // Кешируем стикеры
    if (!skins[stickerUrl]) {
        skins[stickerUrl] = new Image();
        skins[stickerUrl].src = stickerUrl;
    }
    
    const stickerImg = skins[stickerUrl];
    
    if (stickerImg.complete && stickerImg.width > 0) {
        ctx.save();
        ctx.clip();
 
        
        const fw = stickerImg.width, fh = stickerImg.height;
        // ✅ ВСЕГДА используем this.size, НЕ используем bigPointSize
        const sz = this.size;
        
        // Стикер всегда рисуется без поворота поверх всего
        ctx.drawImage(
            stickerImg,
            0, 0, fw, fh,
            this.x - sz, this.y - sz, sz * 2, sz * 2
        );
        
        ctx.restore();
    }
}



// === В БЛОКЕ ОТРИСОВКИ ИМЕНИ И МАССЫ ===
if (this.id !== 0) {
    const x = (this.x), y = (this.y);
    const zoomRatio = Math.ceil(10 * viewZoom) * 0.1;
    const invZoom = 1 / zoomRatio;

    // ---- Проверяем, принадлежит ли ник invisible2 ----
    const lowerName = this.name?.toLowerCase() || "";
    const isInvisible2 = invisible2.has(lowerName);

    // === ИМЯ ===
// === ИМЯ ===
if (showName && this.name && this.nameCache && this.size > 10 && !isInvisible2) {
    let displayName = this.name;  // берём оригинал

    const lowerName = this.name.toLowerCase();
    if (invisible.has(lowerName)) displayName = "";

    this.nameCache.setValue(displayName);
    this.nameCache.setSize(this.getNameSize());
    this.nameCache.setScale(zoomRatio);

    const img = this.nameCache.render();

    // ─────────────── ОГРАНИЧЕНИЕ ШИРИНЫ ───────────────
    let drawWidth  = img.width  * invZoom;
    let drawHeight = img.height * invZoom;

    const MAX_WIDTH_FACTOR = 2;                    // ← основной параметр (подбери под себя)
    const maxAllowedWidth  = this.size * MAX_WIDTH_FACTOR;

    if (drawWidth > maxAllowedWidth) {
        const shrink = maxAllowedWidth / drawWidth;
        drawWidth  *= shrink;
        drawHeight *= shrink;
        // если хочешь не дать имени стать слишком мелким:
        // drawWidth  = Math.max(drawWidth,  this.size * 0.8);
        // drawHeight = Math.max(drawHeight, this.size * 0.25);
    }
    // ────────────────────────────────────────────────

    const drawX = x - drawWidth  / 2;
    const drawY = y - drawHeight / 2;

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

    // === МАССА ===
    if (showMass && !this.isVirus && !this.isEjected && !this.isAgitated && this.size > 100 && !isInvisible2) {
        const mass = Math.floor(this.size * this.size * 0.01);
        this.sizeCache.setValue(mass);
        this.sizeCache.setScale(zoomRatio);
        const img = this.sizeCache.render();
        ctx.drawImage(
            img,
            x - (img.width * invZoom / 2),
            y + (img.height * 0.9 * invZoom),
            (img.width * invZoom),
            (img.height * invZoom)
        );
    }
}




        ctx.restore();
    }
};

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
        setSize: function (a) {
            if (this._size != a) {
                this._size = a;
                this._dirty = true;
            }
        },
        setScale: function (a) {
            if (this._scale != a) {
                this._scale = a;
                this._dirty = true;
            }
        },
        setStrokeColor: function (a) {
            if (this._strokeColor != a) {
                this._strokeColor = a;
                this._dirty = true;
            }
        },
        setValue: function (a) {
            if (a != this._value) {
                this._value = a;
                this._dirty = true;
            }
        },
        render: function() {
            if (null == this._canvas) {
                this._canvas = document.createElement("canvas");
                this._ctx = this._canvas.getContext("2d");
            }
            if (this._dirty) {
                this._dirty = false;
                var canvas = this._canvas,
                    ctx = this._ctx,
                    value = this._value,
                    scale = this._scale,
                    fontsize = this._size,
                    font = fontsize + 'px Ubuntu';
                ctx.font = font;
                var h = ~~(.2 * fontsize),
                    wd = fontsize * 0.1;
                var h2 = h * 0.2;
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
            return this._canvas
        },
        getWidth: function() {
            return (ctx.measureText(this._value).width + 6);
        }
    };
    Date.now || (Date.now = function () {
        return (new Date).getTime()
    });
    var Quad = {
        init: function (args) {
            function Node(x, y, w, h, depth) {
                this.x = x;
                this.y = y;
                this.w = w;
                this.h = h;
                this.depth = depth;
                this.items = [];
                this.nodes = []
            }

            var c = args.maxChildren || 2,
                d = args.maxDepth || 4;
            Node.prototype = {
                x: 0,
                y: 0,
                w: 0,
                h: 0,
                depth: 0,
                items: null,
                nodes: null,
                exists: function (selector) {
                    for (var i = 0; i < this.items.length; ++i) {
                        var item = this.items[i];
                        if (item.x >= selector.x && item.y >= selector.y && item.x < selector.x + selector.w && item.y < selector.y + selector.h) return true
                    }
                    if (0 != this.nodes.length) {
                        var self = this;
                        return this.findOverlappingNodes(selector, function (dir) {
                            return self.nodes[dir].exists(selector)
                        })
                    }
                    return false;
                },
                retrieve: function (item, callback) {
                    for (var i = 0; i < this.items.length; ++i) callback(this.items[i]);
                    if (0 != this.nodes.length) {
                        var self = this;
                        this.findOverlappingNodes(item, function (dir) {
                            self.nodes[dir].retrieve(item, callback)
                        })
                    }
                },
                insert: function (a) {
                    if (0 != this.nodes.length) {
                        this.nodes[this.findInsertNode(a)].insert(a);
                    } else {
                        if (this.items.length >= c && this.depth < d) {
                            this.devide();
                            this.nodes[this.findInsertNode(a)].insert(a);
                        } else {
                            this.items.push(a);
                        }
                    }
                },
                findInsertNode: function (a) {
                    return a.x < this.x + this.w / 2 ? a.y < this.y + this.h / 2 ? 0 : 2 : a.y < this.y + this.h / 2 ? 1 : 3
                },
                findOverlappingNodes: function (a, b) {
                    return a.x < this.x + this.w / 2 && (a.y < this.y + this.h / 2 && b(0) || a.y >= this.y + this.h / 2 && b(2)) || a.x >= this.x + this.w / 2 && (a.y < this.y + this.h / 2 && b(1) || a.y >= this.y + this.h / 2 && b(3)) ? true : false
                },
                devide: function () {
                    var a = this.depth + 1,
                        c = this.w / 2,
                        d = this.h / 2;
                    this.nodes.push(new Node(this.x, this.y, c, d, a));
                    this.nodes.push(new Node(this.x + c, this.y, c, d, a));
                    this.nodes.push(new Node(this.x, this.y + d, c, d, a));
                    this.nodes.push(new Node(this.x + c, this.y + d, c, d, a));
                    a = this.items;
                    this.items = [];
                    for (c = 0; c < a.length; c++) this.insert(a[c])
                },
                clear: function () {
                    for (var a = 0; a < this.nodes.length; a++) this.nodes[a].clear();
                    this.items.length = 0;
                    this.nodes.length = 0
                }
            };
            var internalSelector = {
                x: 0,
                y: 0,
                w: 0,
                h: 0
            };
            return {
                root: new Node(args.minX, args.minY, args.maxX - args.minX, args.maxY - args.minY, 0),
                insert: function (a) {
                    this.root.insert(a)
                },
                retrieve: function (a, b) {
                    this.root.retrieve(a, b)
                },
                retrieve2: function (a, b, c, d, callback) {
                    internalSelector.x = a;
                    internalSelector.y = b;
                    internalSelector.w = c;
                    internalSelector.h = d;
                    this.root.retrieve(internalSelector, callback)
                },
                exists: function (a) {
                    return this.root.exists(a)
                },
                clear: function () {
                    this.root.clear()
                }
            }
        }
    };


	// ДОБАВИТЬ В КОНЕЦ КОДА 2 (после всех существующих функций)

// Функция для отображения ТОПа из уже загруженной статистики
function refreshTopFromStats(stats) {
    const container = document.getElementById('topswindow');
    if (!container) return;
    
    container.innerHTML = '';
    
    const isClan = nick => /^\[[^\]]+\]/.test(nick.trim());
    const players = stats.filter(p => !isClan(p.nick)).slice(0, 3);
    const clans = stats.filter(p => isClan(p.nick)).slice(0, 3);
    
    function createRow(entry, index) {
        const medal = index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze';
        const normalizedNick = normalizeNick(entry.nick);
        const skinCode = skinList?.[normalizedNick];
        const skinUrl = skinCode ? `https://api.agar.su/skins/${skinCode}.png` : 'https://api.agar.su/skins/4.png';
        
        const row = document.createElement('div');
        row.className = 'rating-row ' + medal;
        row.setAttribute('title', entry.time);
        row.innerHTML = `<div>${index + 1}</div><div>${entry.nick}</div><div>${entry.score}</div><div class="avatar" style="background-image: url('${skinUrl}');"></div>`;
        return row;
    }
    
    const playersTitle = document.createElement('div');
    playersTitle.className = 'section-title';
    playersTitle.innerText = 'Top players';
    container.appendChild(playersTitle);
    players.forEach((p, i) => container.appendChild(createRow(p, i)));
    
    const clansTitle = document.createElement('div');
    clansTitle.className = 'section-title';
    clansTitle.innerText = 'Top Clans';
    container.appendChild(clansTitle);
    clans.forEach((c, i) => container.appendChild(createRow(c, i)));
}

// Загружаем топ при открытии оверлея
$(document).ready(function() {
    function loadTopData() {
        fetch(getGameServerApiBase(CONNECTION_URL) + "/checkStats")
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(stats => refreshTopFromStats(stats))
            .catch(e => console.error('Top load error:', e));
    }
    
    if ($("#overlays").is(":visible")) {
        loadTopData();
    }
    
    // Отслеживаем открытие оверлея
    const observer = new MutationObserver(() => {
        if ($("#overlays").is(":visible")) loadTopData();
    });
    observer.observe($("#overlays")[0], { attributes: true, attributeFilter: ['style'] });
});
	
// === ПАРСИНГ НИКА ===
function parseFullNick(full) {
  const str = String(full || '').trim();
  const [nickPart, pass = ''] = str.split('#', 2);
  const hasClan = /\[[^\]]+\]/.test(nickPart);
  const cleanNick = nickPart.replace(/\[|\]/g, '').trim(); // "r2b" или "Player"
  return { str, nickPart, pass: pass.trim(), hasClan, cleanNick };
}

// === СКИН — РАБОТАЕТ ДЛЯ НИКОВ И КЛАНОВ (skinList — объект) ===
function getSkinUrlForNick(nickname) {
  try {
    if (typeof skinList !== 'object' || !skinList) return null;

    // Чистое имя без [] и в нижнем регистре
    const cleanKey = nickname.replace(/\[|\]/g, '').trim().toLowerCase();

    // Ищем в skinList
    const code = skinList[cleanKey];
    if (code) {
      return `https://api.agar.su/skins/${code}.png`;
    }

    // Если не нашли — пробуем с []
    const withBrackets = `[${cleanKey}]`;
    const code2 = skinList[withBrackets];
    return code2 ? `https://api.agar.su/skins/${code2}.png` : null;

  } catch (e) {
    console.error('Skin error:', e);
    return null;
  }
}

// === ПАРОЛЬ С ГЛАЗКОМ ===
function makePasswordBox(pass) {
  const wrap = document.createElement('div');
  wrap.className = 'passbox';
  const input = document.createElement('input');
  input.type = 'password';
  input.value = pass || '';
  input.readOnly = true;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'icon-btn';
  const icon = document.createElement('i'); icon.className = 'fa fa-eye';
  btn.appendChild(icon);
  btn.onclick = () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    icon.className = show ? 'fa fa-eye-slash' : 'fa fa-eye';
  };
  wrap.append(input, btn);
  return wrap;
}

// === РЕНДЕР КАРТОЧКИ ===
function renderCard(list, fullNick) {
  const { str, nickPart, pass, hasClan, cleanNick } = parseFullNick(fullNick);
  const label = hasClan ? nickPart : (nickPart || '?');

  const li = document.createElement('li');

  const skinUrl = getSkinUrlForNick(cleanNick);
  const avatar = skinUrl
    ? Object.assign(document.createElement('img'), { className: 'skin', src: skinUrl, loading: 'lazy' })
    : Object.assign(document.createElement('div'), { className: 'skin skin--empty', textContent: label.charAt(0).toUpperCase() });

  const name = document.createElement('div');
  name.className = 'nick';
  name.textContent = label;
name.onclick = () => {
  try { if (typeof setNick === 'function') setNick(str); } catch(e) {}
  document.getElementById('nick').value = nickPart;
  document.getElementById('pass').value = pass;
  setCookie('userPass', pass, 7);
  document.getElementById('pass').style.display = pass ? 'block' : 'none';
  selectSkin(nickPart);
};

  const passBox = makePasswordBox(pass);
  li.append(avatar, name, passBox);
  list.appendChild(li);
}

// === ЗАГРУЗКА НИКОВ (С ЖЁСТКИМ СКРЫТИЕМ ПРИ НЕАВТОРИЗАЦИИ) ===
async function loadMyNicknames() {
  const block = document.getElementById('myNicknamesBlock');
  const nickList = document.getElementById('myNickList');
  const clanList = document.getElementById('myClanList');
  const badgeNick = document.getElementById('badgeNick');
  const badgeClan = document.getElementById('badgeClan');

  // Нет токена — выходим (CSS скрывает)
  if (!localStorage.accountToken) return;

  // На всякий случай покажем блок в состоянии "загружается"
  if (block) block.style.display = '';

  try {
    const res = await accountApiGet('me/nicknames');
    if (!res.ok) {
      if (res.status === 401) {
        clearAccountToken();
        onLogout();
      }
      return;
    }

    const data = await res.json();

    // ОЧИСТКА списков, если они есть
    if (nickList) nickList.innerHTML = '';
    if (clanList) clanList.innerHTML = '';

    let nickCount = 0, clanCount = 0;

    if (Array.isArray(data?.nicknames) && data.nicknames.length) {
      data.nicknames.forEach(row => {
        const full = String(row.nickname || '');
        const pass = (row.password ?? '').trim();
        const finalNick = pass && !full.includes('#') ? `${full}#${pass}` : full;
        const parsed = parseFullNick(finalNick);

        if (parsed.hasClan) {
          if (clanList) renderCard(clanList, finalNick);
          clanCount++;
        } else if (parsed.nickPart) {
          if (nickList) renderCard(nickList, finalNick);
          nickCount++;
        }
      });
    } else {
      // Пусто: плейсхолдеры
      if (nickList) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'Вы не покупали ники';
        nickList.appendChild(li);
      }
      if (clanList) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'Вы не покупали кланы';
        clanList.appendChild(li);
      }
    }

    // Бейджи
    if (badgeNick) badgeNick.textContent = String(nickCount);
    if (badgeClan) badgeClan.textContent = String(clanCount);

    // Показать блок и включить табы
    if (block) block.style.display = '';
    wireTabsOnce();
    showNickClanTab('nicks');

  } catch (e) {
    console.error('Ошибка загрузки ников:', e);
    // можно показать сообщение об ошибке вместо полного скрытия
    if (block) block.style.display = '';
    if (nickList && !nickList.children.length) {
      const li = document.createElement('li');
      li.className = 'error';
      li.textContent = 'Не удалось загрузить никнеймы';
      nickList.appendChild(li);
    }
  }
}

// === ТАБЫ ===
function showNickClanTab(which) {
  const tabN = document.getElementById('tabNicknames');
  const tabC = document.getElementById('tabClans');
  const nick = document.getElementById('nickWrap');
  const clan = document.getElementById('clanWrap');
  if (!tabN || !tabC || !nick || !clan) return;
  tabN.classList.toggle('active', which === 'nicks');
  tabC.classList.toggle('active', which === 'clans');
  nick.style.display = which === 'nicks' ? '' : 'none';
  clan.style.display = which === 'clans' ? '' : 'none';
}

function wireTabsOnce() {
  const wrap = document.getElementById('myNickClanTabs');
  const tabN = document.getElementById('tabNicknames');
  const tabC = document.getElementById('tabClans');
  if (!wrap || !tabN || !tabC || wrap.dataset.wired) return;
  tabN.onclick = () => showNickClanTab('nicks');
  tabC.onclick = () => showNickClanTab('clans');
  wrap.dataset.wired = '1';
}




// --------------------- Logout ---------------------
const onLogout = () => {
accountData = null;
  localStorage.removeItem('accountData');
  clearAccountToken();

  // === СКРЫВАЕМ БЛОК (на всякий) ===
  const block = document.getElementById('myNicknamesBlock');
  if (block) block.style.display = 'none';

  // === ОЧИСТКА (опционально) ===
  const nickList = document.getElementById('myNickList');
  const clanList = document.getElementById('myClanList');
  const badgeNick = document.getElementById('badgeNick');
  const badgeClan = document.getElementById('badgeClan');
  if (nickList) nickList.innerHTML = '';
  if (clanList) clanList.innerHTML = '';
  if (badgeNick) badgeNick.textContent = '0';
  if (badgeClan) badgeClan.textContent = '0';

  // Прогресс, UI и т.д.
  const progressBar = document.querySelector(".progress-fill");
  if (progressBar) progressBar.style.width = `0%`;
  const levelCircle = document.getElementById("levelCircle");
  if (levelCircle) levelCircle.textContent = "0";
  const progressText = document.getElementById("progressText");
  if (progressText) progressText.textContent = "0% (0/0)";
  const accountIDElement = document.getElementById("accountID");
  if (accountIDElement) accountIDElement.textContent = "ID: 0000";

  const authlog = document.getElementById("authlog");
  const logoutButton = document.getElementById("logoutButton");
  if (authlog) authlog.style.display = "flex";

  showAuthButtons();
  if (typeof window.updateAccountMenuLabel === "function") {
    window.updateAccountMenuLabel();
  }
};


// --------------------- Token ---------------------
const setAccountToken = token => { localStorage.accountToken = token; };
const clearAccountToken = () => { localStorage.removeItem('accountToken'); };

const accountApiGet = (tag, method = 'GET', body = null) => {
    const headers = { Authorization: `Game ${localStorage.accountToken}` };
    if (body) headers['Content-Type'] = 'application/json';
    return fetch("https://api.agar.su/api/" + tag, { method, headers, body: body ? JSON.stringify(body) : null });
};

// --------------------- Login via Telegram / Google ---------------------
async function handleLogin(tokenOrUser, provider) {
    let url, options;
    if (provider === 'telegram') {
        url = 'auth/telegram';
        options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tokenOrUser) };
    } else if (provider === 'google') {
        url = 'auth/google';
        options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: tokenOrUser }) };
    } else if (provider === 'vk') {
        url = 'auth/vk';
        options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tokenOrUser) };
    }
    let res;
    try {
        res = await fetch("https://api.agar.su/api/" + url, options);
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

// Telegram callback
wHandle.onTelegramAuth = function(user) {
    handleLogin(user, 'telegram');
};
// --------------------- Telegram Popup Listener ---------------------
window.addEventListener("message", function(event) {
    if (event.origin !== "https://agar.su") return;

    if (event.data.type === "telegram-auth") {
        const user = event.data.user;

        handleLogin(user, 'telegram');
    }
});

// Google callback
wHandle.onGoogleAuth = function(response) {
    handleLogin(response.credential, 'google');
};

// VK ID: Auth Code → обмен на api.agar.su (OAuth 2.1 + PKCE, см. id.vk.com/docs)
wHandle.onVkAuth = function(payload) {
    if (!payload || !payload.code || !payload.device_id) {
        return alert("VK: не получен код авторизации");
    }
    handleLogin(payload, "vk");
};

// --------------------- Account ---------------------
wHandle.onAccountLoggedIn = token => {
    setAccountToken(token);
    if (typeof window.updateAccountMenuLabel === "function") {
        window.updateAccountMenuLabel();
    }
    loadAccountUserData();
	loadMyNicknames();
    sendAccountToken();
};

wHandle.logoutAccount = async () => {
    if (localStorage.accountToken) {
        const res = await accountApiGet("me/logout");
        if (res.ok) {
            const data = await res.json();
            if (data.ok || 401 == data.status) onLogout();
            if (data.error) alert(data.error);
        }
    } else onLogout();
};

// --------------------- Load & Display Account Data ---------------------
let accountData;

const hideAuthButtons = () => {
    document.querySelectorAll("#authlog .auth-provider-vpn, #authlog .auth-divider, #vkAuthContainer").forEach(el => {
        el.style.display = "none";
    });
};

const showAuthButtons = () => {
    document.querySelectorAll("#authlog .auth-provider, #authlog .auth-divider").forEach(el => {
        el.style.display = el.classList.contains("auth-divider") ? "flex" : "flex";
    });
};

const setAccountData = data => {
    accountData = data;
    displayAccountData();
	loadMyNicknames();
    if (typeof window.updateAccountMenuLabel === "function") {
        window.updateAccountMenuLabel();
    }
    document.querySelectorAll(".menu-item")[2].click();
    logoutButton.style.display = "";
    authlog.style.display = "none";
};

const loadAccountUserData = async () => {
    const res = await accountApiGet("me/login");
    if (res.ok) {
        const data = await res.json();
        if (data.error) {
            if (401 == data.status) clearAccountToken();
            else alert(data.error);
        } else setAccountData(data);
    }
};

if (localStorage.accountToken) loadAccountUserData();
if (typeof window.updateAccountMenuLabel === "function") {
    window.updateAccountMenuLabel();
}

const displayAccountData = () => {
    if (!accountData) return;
    const currLevel = getLevel(accountData.xp);
    const nextXp = getXp(currLevel + 1);
    const progressPercent = (accountData.xp / nextXp) * 100;

    const progressBar = document.querySelector(".progress-fill");
    if (progressBar) progressBar.style.width = `${progressPercent}%`;

    const levelCircle = document.getElementById("levelCircle");
    if (levelCircle) levelCircle.textContent = currLevel;

    const progressText = document.getElementById("progressText");
    if (progressText) progressText.textContent = `${Math.round(progressPercent)}% (${accountData.xp}/${nextXp})`;

    const accountIDElement = document.getElementById("accountID");
    if (accountIDElement) accountIDElement.textContent = `ID: ${accountData.uid}`;
};

wHandle.onUpdateXp = xp => {
    if (accountData) {
        accountData.xp = xp;
        displayAccountData();
    }
};

    wHandle.onload = gameLoop;
})(window, window.jQuery);
