(function (wHandle, wjQuery) {
	
	function getStarClass(level) {
    if (level >= 1 && level < 50) return "";           // обычная
    if (level >= 50 && level < 100) return "azure";    // голубая
    if (level >= 100 && level < 150) return "red";     // красная
    if (level >= 150) return "white";                  // белая
    return "";
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
                                    const skinId = skinsMap.get(player.nick.toLowerCase()) || 'PPFtwqH'; // Используем nick напрямую для skinId
                                    player.skin = skinId; // Установка skin для игрока
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
    let SELECTED_SERVER = wHandle.CONNECTION_URL || "ffa.agar.su:6001";

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

    // Функция обновления онлайн
    async function updateOnlineCount() {
    const servers = [
        {id: 'ffa', url: 'https://ffa.agar.su:6001/process', max: 200},
		{id: 'ffasolo', url: 'https://ffa.agar.su:6008/process', max: 120},
        {id: 'ms', url: 'https://ffa.agar.su:6002/process', max: 120},
        {id: 'exp', url: 'https://ffa.agar.su:6003/process', max: 120},
		{id: 'pvp1', url: 'https://ffa.agar.su:6004/process', max: 50},
		{id: 'pvp2', url: 'https://ffa.agar.su:6005/process', max: 50},
		{id: 'tournament', url: 'https://ffa.agar.su:6006/process', max: 120}
    ];

    for (const server of servers) {
        try {
            const response = await fetch(server.url);
            if (!response.ok) continue;
            const data = await response.json();

            const playing = data.playing ?? 0;
            const noPlaying = data.no_playing ?? 0;

            const li = document.getElementById(server.id);
            if (li) {
                const spans = li.querySelectorAll('.online-count');
                if (spans.length >= 2) {
                    spans[0].textContent = noPlaying;             // ❗ Только неиграющие
                    spans[1].textContent = `${playing}/${server.max}`; // Играющих / максимум
                }
            }
        } catch (e) {
            console.error(`Ошибка обновления сервера ${server.id}:`, e);
        }
    }
}



    // Если overlay изначально видим, запускаем сразу обновление и интервал
    if (wjQuery("#overlays").is(":visible")) {
        updateOnlineCount();
        window.onlineInterval = setInterval(updateOnlineCount, 5000);
    }
	
const forbiddenChars = ["﷽", "𒐫", "𒈙", "⸻", "꧅", "ဪ", "௵", "௸", "‱", "ㅤ", "⁣","‎ ", "​", "‌", "‍", "‎", "‏", " ", " ", " ", " ", " "," ", " ", " ", " ", " ", " ", "​", "﻿", "￼", " ","⠀","ﾠ","卐","卍"]; //  ЗАПРЕЩЕНО!

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
            const domain = CONNECTION_URL || window.location.hostname; // Используем текущий домен если CONNECTION_URL не задан

            // Формируем URL для запроса статистики
            const statsUrl = `https://${domain}/checkStats`;

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

const SERVERS = {
        "ffa":   "ffa.agar.su:6001",
		"ffasolo":    "ffa.agar.su:6008",
        "ms":    "ffa.agar.su:6002",
        "exp":   "ffa.agar.su:6003",
		"pvp1":  "ffa.agar.su:6004",
		"pvp2":  "ffa.agar.su:6005",
		"tournament":  "ffa.agar.su:6006",
    };
	
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
    const hash = wHandle.location.hash.slice(1); // убираем #
    
    if (hash && SERVERS[hash]) {
        // hash совпадает с ключом
        serverKey = hash;
    } else {
        // иначе берём первый доступный сервер
        const keys = Object.keys(SERVERS);
        if (keys.length) serverKey = keys[0];
    }

    // Устанавливаем URL сервера
    CONNECTION_URL = SERVERS[serverKey];
    SELECTED_SERVER = CONNECTION_URL; // <--- синхронизируем выбор

    // Подсветим li
    document.querySelectorAll('.gamemode li').forEach(li => li.classList.remove('active'));
    const activeLi = document.getElementById(serverKey);
    if (activeLi) activeLi.classList.add('active');
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

    wHandle.onCaptchaSuccess = function (token) {
        showConnecting(token);
    };

    let captchaId = null;

    const renderCaptcha = () => {
        if (captchaId !== null) { // Сбрасываем капчу если она уже создана
            document.getElementById('captcha-overlay').style.display = '';
            turnstile.reset(captchaId);
            return;
        }

        const overlay = document.createElement("div");
        overlay.id = "captcha-overlay";

        const container = document.createElement("div");
        container.id = "captcha-container";

        overlay.appendChild(container);

        document.body.prepend(overlay);

        captchaId = turnstile.render(container, {
            sitekey: "0x4AAAAAAA0keHJ56_KNR0MU",
            callback: onCaptchaSuccess
        });

    };

    const showCaptcha = () => {
// Если у игрока ≥ 1000 XP — капча НЕ нужна вообщ
    if (accountData && accountData.xp >= 125000) {
        showConnecting("");
        return; // сразу соединяемся без капчи
    }
        // Перенаправляем на рендер если библиотека уже загружена
        if (window.turnstile) return renderCaptcha();

        // Загружаем библиотеку
        const node = document.createElement('script');
        node.setAttribute('src', 'https://challenges.cloudflare.com/turnstile/v0/api.js');
        node.setAttribute('async', 'async');
        node.setAttribute('defer', 'defer');
        node.onload = () => {
            renderCaptcha();
        };
        node.onerror = () => {
            alert("Не удалось загрузить библиотеку Captcha. Попробуйте обновить браузер");
        };

        document.head.appendChild(node);
    };

	function disableCaptcha() {
    // Убираем оверлей
    const captchaOverlay = document.getElementById('captcha-overlay');
    if (captchaOverlay) captchaOverlay.remove();

    // Убираем сам скрипт Turnstile
    const scripts = document.querySelectorAll('script[src*="challenges.cloudflare.com/turnstile"]');
    scripts.forEach(s => s.remove());

    // Чистим глобальные ссылки
    if (window.turnstile) delete window.turnstile;
    captchaId = null;
    console.log("Captcha полностью отключена до перезагрузки страницы или соединение нового сервера");
}

    // Обновляем setserver функцию для вызова showConnecting() вручную
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

        showCaptcha();
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
		
    function gameLoop() {
        ma = true;
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

            // change cords
            posX = x;
            posY = y;
        };

        mainCanvas.addEventListener("mousedown", () => {
            // Owned player count 0 -> is spectate or dead
            if (!playerCells.length) { // Update spectate position
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

        var spacePressed = false,
            cPressed = false,
            qPressed = false,
            ePressed = false,
            rPressed = false,
            tPressed = false,
            pPressed = false,
            wPressed = false,
            wInterval; // Variable to hold the interval for 'W' key press
			freeze = false;
			
        wHandle.onkeydown = function (event) {
            switch (event.keyCode) {
				 case 70: // F
  if (!isTyping && playerCells.length > 0) {  // freeze работает только если есть игроки
    freeze = !freeze;
    if (freeze) {
      // Зафиксировать текущие координаты шара
      posX = X;
      posY = Y;

      document.querySelector("#freeze").style.display = "flex";
    } else {
      document.querySelector("#freeze").style.display = "none";
    }
  }
  break;
case 13: // Enter
    if (isTyping || hideChat) {
        isTyping = false;

        const chatInput = document.getElementById("chat_textbox");
        const lsInput = document.getElementById("ls");

        // Берем текст из обоих полей
        const lsText = lsInput ? lsInput.value.trim() : "";
        const chatText = chatInput ? chatInput.value.trim() : "";

        // Объединяем, если есть текст
        let combinedText = "";
        if (lsText && chatText) {
            combinedText = lsText + " " + chatText;
        } else if (lsText) {
            combinedText = lsText;
        } else if (chatText) {
            combinedText = chatText;
        }

        if (combinedText.length > 0) sendChat(combinedText);

        // очищаем поля
        if (chatInput) chatInput.value = "";
        if (lsInput) lsInput.value = "";
        if (chatInput) chatInput.blur();
        if (lsInput) lsInput.blur();
    } else {
        document.getElementById("chat_textbox").focus();
        isTyping = true;
    }
    break;


                case 32: // space
                    if (!spacePressed && !isTyping) {
                        sendMouseMove();
                        sendUint8(17);
                        spacePressed = true;
                    }
                    break;
                case 67: // coord
                    if (!cPressed && !isTyping) {
    coord(); // coords
 cPressed = true;                   
}
                    break;
                case 87: // W
                    if (!wPressed && !isTyping) {
                        sendMouseMove();
                        sendUint8(21);
                        wPressed = true;

                        // Start the interval when 'W' is pressed
                        wInterval = setInterval(function () {
                            sendMouseMove();
                            sendUint8(21);
                        }, 100);
                    }
                    break;
                case 81: // Q
                    if (!qPressed && !isTyping) {
                        sendUint8(18);
                        qPressed = true;
                    }
                    break;
                case 69: // E
                    if (!ePressed && !isTyping) {
                        sendMouseMove();
                        sendUint8(22);
                        ePressed = true; // Added missing ePressed flag
                    }
                    break;
                case 82: // R
                    if (!rPressed && !isTyping) {
                        sendMouseMove();
                        sendUint8(23);
                        rPressed = true; // Added missing rPressed flag
                    }
                    break;
                case 84: // T
                    if (!tPressed && !isTyping) {
                        sendMouseMove();
                        sendUint8(24);
                        tPressed = true;
                    }
                    break;
                case 80: // P
                    if (!pPressed && !isTyping) {
                        sendMouseMove();
                        sendUint8(25);
                        pPressed = true;
                    }
                    break;
            }
        };

        wHandle.onkeyup = function (event) {
            switch (event.keyCode) {
                case 32: // space
                    spacePressed = false;
                    break;
                case 67: // coords
                    cPressed = false;
                    break;
                case 87: // W
                    wPressed = false;

                    // Clear the interval when 'W' is released
                    clearInterval(wInterval);
                    break;
                case 81: // Q
                    if (qPressed) {
                        sendUint8(19);
                        qPressed = false;
                    }
                    break;
                case 69: // E
                    ePressed = false;
                    break;
                case 82: // R
                    rPressed = false;
                    break;
                case 84: // T
                    tPressed = false;
                    break;
                case 80: // P
                    pPressed = false;
                    break;
            }
        };


const colorSelected = document.getElementById("selectedColor");
const colorList = document.getElementById("colorList");
const skinss = document.getElementById("skinss");


// восстановление сохранённого цвета
const colorSaved = localStorage.getItem("selectedColor");
if (colorSaved) {
  colorSelected.style.background = colorSaved;
  skinss.style.borderColor = colorSaved;
  skinss.style.backgroundColor = colorSaved;
  skinss.style.boxShadow = `0 0 10px ${colorSaved}`;
}

// открыть/закрыть панель
colorSelected.onclick = () => {
  colorList.style.display =
    colorList.style.display === "none" || colorList.style.display === ""
      ? "flex"
      : "none";
};

// выбор цвета
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

// генерация элементов
cellColors.forEach((hex) => {
  const d = document.createElement("div");
  d.className = "item";
  d.style.background = hex;
  d._cellColorHex = hex;
  colorList.appendChild(d);
});









// Убираем display: none из CSS, оставляем только стили позиционирования
const adminPanel = document.querySelector('.admin-panel');
adminPanel.style.display = ''; // по умолчанию скрыта (будет переключаться ниже)

// Функция обновления списка игроков (остаётся без изменений)
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

            if (i === 2) { // Имя — смена ника
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

            if (i === 6) { // Масса
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

        // Кнопки Kick / Ban / Kill
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

// Переключение панели (вкл/выкл по одному вызову)
const openAdminPanel = () => {
    if (adminPanel.style.display === 'block') {
        // Была открыта → закрываем
        adminPanel.style.display = '';
        delete window._updatePlayerList;
    } else {
        // Была закрыта → открываем и запрашиваем данные
        adminPanel.style.display = 'block';
        const msg = prepareData(1);
        msg.setUint8(0, 169);
        wsSend(msg);
        window._updatePlayerList = updatePlayerList;
    }
};

// Делаем функцию глобальной (например, чтобы вызвать по горячей клавише или кнопке)
wHandle.openAdminPanel = openAdminPanel;







        wHandle.onblur = function () {
            sendUint8(19);
            clearInterval(wInterval); // Ensure the interval is cleared on blur
            wPressed = spacePressed = cPressed = pPressed = qPressed = ePressed = rPressed = tPressed = pPressed = false;
        };
document.addEventListener("contextmenu", () => {
    if (wPressed) {
        wPressed = false;
        clearInterval(wInterval);
    }
});



let leftInterval = null;  // Declare leftInterval
let rightTimeout = null;  // Declare rightTimeout
let rightInterval = null; // Declare rightInterval

const clearAllIntervals = () => {
    leftDown = false;
    rightDown = false;

    if (leftInterval) {
        clearInterval(leftInterval);
        leftInterval = null;
    }
    if (rightTimeout) {
        clearTimeout(rightTimeout);
        rightTimeout = null;
    }
    if (rightInterval) {
        clearInterval(rightInterval);
        rightInterval = null;
    }
};

// при уходе с вкладки
$(window).on("blur visibilitychange", () => {
    clearAllIntervals();
});


    const handleLeft = () => sendUint8(21);  // левая кнопка
    const handleRight = () => sendUint8(17); // правая кнопка

    $(document).on("mousedown", function (event) {
        if (!enableMouseClicks || isTyping) return;

        const overlay = $('.overlays');
        if (overlay.is(':visible')) return;

        switch (event.which) {
            case 1: // левая
                if (!leftDown) {
                    leftDown = true;
                    handleLeft(); // сразу одно действие
                    leftInterval = setInterval(() => {
                        if (leftDown) handleLeft();
                    }, 100); // повтор каждые 100мс
                }
                break;
            case 3: // правая
                if (!rightDown) {
                    rightDown = true;
                    handleRight(); // сразу одно действие
                    rightTimeout = setTimeout(() => {
                        if (rightDown) {
                            rightInterval = setInterval(() => {
                                if (rightDown) handleRight();
                            }, 50); // повтор каждые 50мс
                        }
                    }, 130); // задержка перед повтором
                }
                break;
        }
    });

    $(window).on("mouseup", function (event) {
        switch (event.which) {
            case 1: // левая
                leftDown = false;
                clearInterval(leftInterval);
                leftInterval = null;
                break;
            case 3: // правая
                rightDown = false;
                clearTimeout(rightTimeout);
                rightTimeout = null;
                clearInterval(rightInterval);
                rightInterval = null;
                break;
        }
    });



$(window).on("mouseleave", () => {
    clearAllIntervals();
});

$(document).on("contextmenu", function (event) {
    if (enableMouseClicks) event.preventDefault();
});



        $(document).ready(function () {
            // Handle keydown event
            $(document).keydown(function (event) {
                if (event.keyCode === 27) { // Check if the Escape key is pressed
                    wjQuery("#statics").hide();
                    const overlay = $('#overlays');
                    if (overlay.is(':visible')) {
                        overlay.hide(); // Hide the overlay if currently visible
                    } else {
                        overlay.show(); // Show the overlay if currently hidden
                    }
                }
            });
        });


        wHandle.onresize = canvasResize;
        canvasResize();
        wHandle.requestAnimationFrame(redrawGameScene);
        setInterval(sendMouseMove, 50);
        wjQuery("#overlays").show();
		setTimeout(showCaptcha, 200);
		setInterval(updateStats, 100);
    }
	

const dpr = window.devicePixelRatio;

const joystickRadius = 360; // Максимальное расстояние точки от центра джойстика
const cursorSize = 20; // Размер квадрата курсора

let splitPressed = false;
let ejectPressed = false;

let pinchZoomStartDistance = 0;
let isPinching = false;

function onTouchStart(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
        var touch = e.changedTouches[i];

        var size = ~~(canvasWidth / 7);

        // Проверяем, касается ли нажатие кнопки "split"
        if (
            touch.clientX * dpr > canvasWidth - size &&
            touch.clientY * dpr > canvasHeight - size
        ) {
            sendMouseMove();
            sendUint8(17); // split
            splitPressed = true;
            continue;
        }

        // Проверяем, касается ли нажатие кнопки "eject"
        if (
            touch.clientX * dpr > canvasWidth - size &&
            touch.clientY * dpr > canvasHeight - 2 * size - 10 &&
            touch.clientY * dpr < canvasHeight - size - 10
        ) {
            sendMouseMove();
            sendUint8(21); // eject
            ejectPressed = true;
            continue;
        }

        // Если это не кнопка, обрабатываем как джойстик
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

    // === Пинч-зум (двумя пальцами) ===
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);

        if (!isPinching) {
            pinchZoomStartDistance = currentDistance;
            isPinching = true;
        } else {
            const delta = currentDistance - pinchZoomStartDistance;
            const zoomFactor = 1 + delta / 300; // Настройка чувствительности
            zoom *= zoomFactor;

            // Ограничения
            if (zoom < 0.3) zoom = 0.3;
            if (zoom > 4 / viewZoom) zoom = 4 / viewZoom;

            pinchZoomStartDistance = currentDistance;
        }

        return; // Не продолжаем обработку джойстика, если пинч
    }

    // === Обычное касание (джойстик) ===
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
    // Сброс пинча, если пальцев меньше двух
    if (e.touches.length < 2) {
        isPinching = false;
    }

    for (var i = 0; i < e.changedTouches.length; i++) {
        var touch = e.changedTouches[i];

        if (leftTouchID === touch.identifier) {
            leftTouchID = -1;
            leftVector.reset(0, 0);
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

    function showConnecting(token) {
    chekstats();
    const wsUrl = (useHttps ? "wss://" : "ws://") + CONNECTION_URL;

    if (ws && ws.readyState === WebSocket.OPEN && currentWebSocketUrl === wsUrl) {
        console.log("Соединение уже активно для этого URL, пропускаем повторное подключение.");
        return;
    }

    if (ma) {
        currentWebSocketUrl = wsUrl;
        wsConnect(wsUrl, token);

        // Как только пошли на соединение — сразу вырубаем капчу
        disableCaptcha();
    }
}


    function wsConnect(undefined, token) {
        if (ws) {
            ws.onopen = null;
            ws.onmessage = null;
            ws.onclose = null;
            try {
                ws.close()
            } catch (b) {
            }
            ws = null
        }
        var c = CONNECTION_URL;
        wsUrl = (useHttps ? "wss://" : "ws://") + c;

        // var c = "ws://localhost:3000/";
        // wsUrl = c;

        playerCells = [];
        nodes = {};
        nodelist = [];
        Cells = [];
        leaderBoard = [];
        log.info("Connecting to " + wsUrl + "..");

        // Передаем токен при подключении xxxevexxx
        const params = `?token=${encodeURIComponent(token)}&accountToken=${encodeURIComponent(localStorage.accountToken)}`;
        ws = new WebSocket(wsUrl + params, "eSejeKSVdysQvZs0ES1H");
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

    function httpGet(theUrl) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open("GET", theUrl, false); // false for synchronous request
        xmlHttp.send(null);
        return xmlHttp.responseText;
    }


let ping = 0;    
let pingstamp = 0;


    function onWsOpen() {
    const serverCloseDiv = document.getElementById("serverclose-overlay");
    if (serverCloseDiv) serverCloseDiv.style.display = "none";
        var msg;

        sendAccountToken();

        msg = prepareData(5);
        msg.setUint8(0, 254);
        msg.setUint32(1, 5, true); // Protocol 5
        wsSend(msg);

        msg = prepareData(5);
        msg.setUint8(0, 255);
        msg.setUint32(1, 0, true);
        wsSend(msg);
        sendNickName();
        log.info("Connection successful!");
     setInterval(() => {
        pingstamp = Date.now();        
wsSend(new Uint8Array([2])); // ping
    }, 3000);
	setTimeout(() => { sendChat("вошёл в игру!"); }, 1000);
    }

        function onWsClose(evt) {
    const serverCloseDiv = document.getElementById("serverclose-overlay");
    if (serverCloseDiv) serverCloseDiv.style.display = "block";
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
                    const level = playerXp ? getLevel(playerXp) : -1;

                    leaderBoard.push({
                        id: nodeId,
                        name: playerName,
                        level,
                        xp: playerXp
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

        const pId = view.getUint16(offset, true);  // Считываем pID
        offset += 2;
		
        color = '#' + color;
        chatBoard.push({
            "pId": pId,  // Добавляем playerPId
			"playerXp": playerXp,
			"playerLevel": playerXp ? getLevel(playerXp) : -1,
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


const admins = ["нико","^iStack","banshee"];
const moders = ["cosmos","rizwer"];
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
    const servers = ["ffa.agar.su:6004","ffa.agar.su:6005","ffa.agar.su:6006"];
    servers.forEach(s => {
        const btn = document.createElement('button');
        btn.textContent = s;
        btn.style.margin = '5px';
        btn.onclick = () => {
            sendPvPInvite(targetId, s);
            modal.remove();
        };
        box.appendChild(btn);
    });

    // Отмена
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Отмена';
    cancelBtn.style.marginTop = '10px';
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

    // --- Игнорируем игрока ---
    if (ignoredPlayers.has(lastMessage.pId)) return;

    const msgDiv = document.createElement('div');
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
    if (passUsers.includes(normalizedName)) avatarContainer.style.setProperty('--after-display', 'block');

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

    if (typeof lastMessage.playerLevel === 'number' && lastMessage.playerLevel > 0) {
        const levelContainer = document.createElement('div');
        levelContainer.className = 'star-container';

        const starIcon = document.createElement('i');
        starIcon.className = 'fas fa-star ' + getStarClass(lastMessage.playerLevel);

        const levelSpan = document.createElement('span');
        levelSpan.className = 'levelme ' + getStarClass(lastMessage.playerLevel);
        levelSpan.textContent = lastMessage.playerLevel;

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = `XP: ${lastMessage.playerXp}`;

        levelContainer.appendChild(starIcon);
        levelContainer.appendChild(levelSpan);
        levelContainer.appendChild(tooltip);
        nameContainer.appendChild(levelContainer);
    }

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
                size = foodMinSize + nodeid % ((foodMaxSize - foodMinSize) + 1);
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
            let flagEjected = !!(spiked & 0x20);
            let flagAgitated = !!(spiked & 0x10);

            const name = reader.utf8();

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

            node.isVirus = flagVirus;
            node.isEjected = flagEjected;
            node.isAgitated = flagAgitated;
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
                const isModer = moders.some(moder => lowerName.includes(moder.toLowerCase()));

                const panel = document.querySelector('.adminpanel');
                if (!panel) return; // защита

                // Сначала всегда скрываем
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
                // если обычный игрок — остаётся скрытой
            }


        }

        while (reader.canRead) {
            const node = nodes[reader.uint32()];
            if (node) node.destroy();
        }

        if (ua && playerCells.length === 0) {
    wjQuery("#statics").css("display", "flex");
    updateShareText();    // текст шаринга
	chekstats();
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

    // Обновляем HTML только раз в 500 мс (раз в полсекунды)
    if (now - fpsUpdateTime >= 500) {
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

// ==================== DEFAULT THEME ====================
function getDefaultTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'black';
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'white';
  } else {
    return 'gradient';
  }
}

// ==================== GRID DRAW ====================
function drawGrid() {
  const savedTheme = getCookie('grid_theme');
  let themeToDraw = savedTheme || getDefaultTheme();

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

  // загрузка сохранённых значений
  let savedTheme = getCookie('grid_theme');
  if (!savedTheme) {
    savedTheme = getDefaultTheme();
    setCookie('grid_theme', savedTheme, 30);
  }
  selectElement.value = savedTheme;

  // загружаем цвета
  centerColor.value = getCookie('gradient_center') || "#132745";
  edgeColor.value = getCookie('gradient_edge') || "#000000";
});

// ==================== GRADIENT ====================
function drawGradientGrid() {
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

    // Старая версия сетки
function drawBlackGrid() {
    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    ctx.scale(viewZoom, viewZoom);
    const a = canvasWidth / viewZoom;
    const b = canvasHeight / viewZoom;

    // Устанавливаем цвет линий в белый
    ctx.strokeStyle = "white";
    ctx.globalAlpha = 0.1; // Увеличил alpha чтобы лучше было видно

    ctx.beginPath();
    for (let c = -.5 + (-nodeX + a / 2) % 50; c < a; c += 50) {
        ctx.moveTo(c, 0);
        ctx.lineTo(c, b);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let c = -.5 + (-nodeY + b / 2) % 50; c < b; c += 50) {
        ctx.moveTo(0, c);
        ctx.lineTo(a, c);
    }
    ctx.stroke();
    ctx.restore();
}

function drawWhiteGrid() {
    ctx.fillStyle = "#F2FBFF";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    ctx.scale(viewZoom, viewZoom);
    const a = canvasWidth / viewZoom;
    const b = canvasHeight / viewZoom;

    // Устанавливаем цвет линий в белый
    ctx.strokeStyle = "#111111";
    ctx.globalAlpha = 0.1; // Увеличил alpha чтобы лучше было видно

    ctx.beginPath();
    for (let c = -.5 + (-nodeX + a / 2) % 50; c < a; c += 50) {
        ctx.moveTo(c, 0);
        ctx.lineTo(c, b);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let c = -.5 + (-nodeY + b / 2) % 50; c < b; c += 50) {
        ctx.moveTo(0, c);
        ctx.lineTo(a, c);
    }
    ctx.stroke();
    ctx.restore();
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

                const skinId = skinList[topPlayerNick];
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

function createLeaderboardEntry(name, level, isMe, isSystemLine, b) {
  const entryDiv = document.createElement("div");
  const lowerName = (name || "").toLowerCase();

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
  entryDiv.style.color = isMe ? "#FFAAAA" : "#FFFFFF";

  // Основной контейнер для имени
  const nameSpan = document.createElement("span");
  
  // Вставляем HTML-разметку, если она присутствует в имени
  nameSpan.innerHTML = name;  // Вставляем как HTML, а не как текст

  // Контейнер для иконок (звезда + ютуб)
  const iconsContainer = document.createElement("span");

  // Звезда с уровнем (если есть)
  if (level !== -1 && !isSystemLine) {
    const starContainer = document.createElement("div");
    starContainer.className = "star-container";
    starContainer.innerHTML = `
      <i class='fas fa-star ${getStarClass(level)}'></i>
      <span class='levelme ${getStarClass(level)}'>${level}</span>
      <div class='tooltip'>XP: ${leaderBoard[b].xp || 0}</div>
    `;
    iconsContainer.appendChild(starContainer);
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
        const entryDiv = createLeaderboardEntry(name, leaderBoard[b].level, isMe, isSystemLine, b);
        
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
      const level = leaderBoard[b].level;
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
        const entryDiv = createLeaderboardEntry(name, level, isMe, isSystemLine, b);
        toplistDiv.appendChild(entryDiv);
      }
    }

    // Показываем свой ранг, если вне топ-10
    if (myRank && myRank > displayedPlayers) {
      const level = accountData ? getLevel(accountData.xp) : -1;
      let myName = playerCells[0].name;

      const myRankDiv = createLeaderboardEntry(myName, level, true, false, myRank - 1);
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
	wHandle.setNick = function (arg) {setserver(SELECTED_SERVER); hideOverlays(); userNickName = arg; sendNickName(); wjQuery("#statics").hide(); maxScore = 0;};
    wHandle.spectate = function () { setserver(SELECTED_SERVER);  userNickName = null; hideOverlays(); wjQuery("#statics").hide();};
	
	// === Настройки по умолчанию ===
let showSkin = true,
    showName = true,
    showColor = true,
    showMass = true,
    hideChat = false,
    smoothRender = 0.4,
    closebord = false,
    enableMouseClicks = false,
    showGlow = true,
	confirmCloseTab = false;
	let showAdultContent = false; // +18: убирает антимат и блюр

// === Функции для чекбоксов ===
wHandle.setSkins = function(arg){ showSkin = arg; };
wHandle.setNames = function(arg){ showName = arg; };
wHandle.setColors = function(arg){ showColor = arg; };
wHandle.setMouseClicks = function(arg){ enableMouseClicks = arg; };
wHandle.setShowMass = function(arg){ showMass = arg; };
wHandle.setSmooth = function(arg){ smoothRender = arg ? 2 : 0.4; };
wHandle.setNoBorder = function(arg){ closebord = arg; };
wHandle.setChatHide = function(arg){ hideChat = arg; };
wHandle.setGlow = function(arg){ showGlow = arg; };
wHandle.setAdultContent = function(arg) {showAdultContent = arg;};
wHandle.setConfirmCloseTab = function(arg){confirmCloseTab = arg;};


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
                case 11: $(this).prop("checked", confirmCloseTab); break; // новый чекбокс
            }
        }
    });

    wjQuery(".save").trigger("change");

    wjQuery(".save").on("change", function(){
        const id = $(this).data("box-id");
        const value = $(this).prop("checked");
        setCookie("checkbox-" + id, value, 365);

        if (id == 10) wHandle.setAdultContent(value);
        if (id == 11) wHandle.setConfirmCloseTab(value); // применяем настройку
    });
});




const transparent = new Set(["незнакомка","bublik","liqwid","zombie","pac-man"]);
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
const rotation = new Set(["pac-man","zombie"]); //поворот скина
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
    wasSimpleDrawing: true,

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
    },

    getNameSize() {
        return Math.max(~~(0.3 * this.size), 24);
    },

    setName(name) {
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
        return showColor ? (this.color || "#FFFFFF") : "#AAAAAA";
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

        ctx.lineWidth = closebord ? 0 : 10;
        ctx.lineCap = "round";
        ctx.lineJoin = this.isVirus ? "miter" : "round";

        const isTransp = transparent.has(this.name?.toLowerCase());
        // используем единый "эффективный" цвет для fill и (при необходимости) stroke
        const cellColor = this.getEffectiveColor();

        ctx.fillStyle = isTransp ? "rgba(0,0,0,0)" : cellColor;
        ctx.strokeStyle = isTransp ? "rgba(0,0,0,0)" : (simpleRender ? cellColor : this.getStrokeColor());

        ctx.beginPath();
        if (simpleRender) {
            ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
        } else {
            this.movePoints();
            ctx.moveTo(this.points[0].x, this.points[0].y);
            this.points.forEach(p => ctx.lineTo(p.x, p.y));
        }
        ctx.closePath();

        if (!closebord) ctx.stroke();
        ctx.fill();


// === СКИН ===
if (showSkin) {
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
        skins[effectId].src = `https://api.agar.su/assets/photo/limited.png`; // теперь обычный PNG
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
    }
    const res = await fetch("https://api.agar.su/api/" + url, options);
    const data = await res.json();
    if (data.error) return alert(data.error);
    wHandle.onAccountLoggedIn(data.token);
}

// Telegram callback
wHandle.onTelegramAuth = function(user) {
    handleLogin(user, 'telegram');
};

// Google callback
wHandle.onGoogleAuth = function(response) {
    handleLogin(response.credential, 'google');
};

// --------------------- Account ---------------------
wHandle.onAccountLoggedIn = token => {
    setAccountToken(token);
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
    const tgBtn = document.getElementById("telegramLoginButton");
    const googleBtn = document.getElementById("googleLoginButton");
    if (tgBtn) tgBtn.style.display = "none";
    if (googleBtn) googleBtn.style.display = "none";
};

const showAuthButtons = () => {
    const tgBtn = document.getElementById("telegramLoginButton");
    const googleBtn = document.getElementById("googleLoginButton");
    if (tgBtn) tgBtn.style.display = "";
    if (googleBtn) googleBtn.style.display = "";
};

const setAccountData = data => {
    accountData = data;
    displayAccountData();
	loadMyNicknames();
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

const getXp = level => ~~(100 * (level ** 2 / 2));
const getLevel = xp => ~~((xp / 100 * 2) ** 0.5);

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
