(function (wHandle, wjQuery) {
let skinList = {}; // Глобальный объект для скинов

// Функция нормализации ника (берёт ник внутри скобок или обрезает лишнее)
function normalizeNick(nick) {
    if (!nick) return '';

    let n = nick.trim();

    const brackets = { '[': ']', '{': '}', '(': ')', '|': '|' };
    const firstChar = n.charAt(0);
    const lastChar = n.charAt(n.length - 1);

    if (brackets[firstChar]) {
        const closeChar = brackets[firstChar];
        const endIndex = n.indexOf(closeChar, 1);

        // Проверяем, что закрывающая скобка есть и ник внутри не пустой
        if (endIndex === -1) return ''; 

        const innerNick = n.substring(1, endIndex);
        if (!innerNick || innerNick.trim() !== innerNick) return ''; // нет пробелов в начале/конце

        n = innerNick; 
    } else {
        // Ник без скобок: нельзя содержать пробелы в начале/конце
        if (!n || n.trim() !== n) return '';
    }

    return n.toLowerCase();
}

// Функция загрузки skinList.txt с нормализацией
function fetchSkinList() {
    fetch('/skinlist.txt')
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
                    // Нормализуем ник и заменяем _ на пробелы
                    name = normalizeNick(name.replace(/_/g, ' '));
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

// ONLY_CLIENT режим
ONLY_CLIENT = false;

// Подгружаем список серверов из server.json
let SERVERS = {};
let CONNECTION_URL = "pmori.ru:6001"; // текущий сервер по умолчанию

async function loadServers() {
    try {
        const response = await fetch('/assets/scripts/server.json?v=0.0.1');
        SERVERS = await response.json();

        // Определяем сервер по hash
        const hash = location.hash;
        if (hash && SERVERS[hash.slice(1)]) {
            CONNECTION_URL = SERVERS[hash.slice(1)];
        } else {
            // Берём первый сервер по умолчанию
            const keys = Object.keys(SERVERS);
            CONNECTION_URL = keys.length ? SERVERS[keys[0]] : "";
        }

        console.log("Подключаемся к серверу:", CONNECTION_URL);
    } catch (err) {
        console.error("Не удалось загрузить серверы:", err);
    }
}
loadServers();


    var
        // touchX, touchY,
        touchable = 'createTouch' in window || navigator.maxTouchPoints > 0,
        touches = [];

    var leftTouchID = -1,
        leftTouchPos = new Vector2(0, 0),
        leftTouchStartPos = new Vector2(0, 0),
        leftVector = new Vector2(0, 0);

    var useHttps = "https:" === wHandle.location.protocol;



    // Функция получения токена капчи 
    wHandle.captchaPassed = function () {
        const captchaContainer = document.getElementById('captcha-overlay');
        captchaContainer.style.display = 'none';
    }

    wHandle.onCaptchaSuccess = function (token) {
        showConnecting(token);
        captchaPassed();
        document.getElementById("button-text").disabled = false;
        document.getElementById("button-spec").disabled = false;
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
            window.location.hash = `#${foundHash}`;
        } else {
            console.warn("Неизвестный сервер URL:", arg);
            window.location.hash = "";
        }

        showCaptcha();
    }
};
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
                case 13: // enter
                    if (isTyping || hideChat) {
                        isTyping = false;
                        document.getElementById("chat_textbox").blur();
                        chattxt = document.getElementById("chat_textbox").value;
                        if (chattxt.trim().length > 0) sendChat(chattxt); // Проверяем после trim
                        document.getElementById("chat_textbox").value = "";
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

        wHandle.onblur = function () {
            sendUint8(19);
            clearInterval(wInterval); // Ensure the interval is cleared on blur
            wPressed = spacePressed = qPressed = ePressed = rPressed = tPressed = pPressed = false;
        };


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
        if (wHandle.requestAnimationFrame) {
            wHandle.requestAnimationFrame(redrawGameScene);
        } else {
            setInterval(drawGameScene, 1E3 / 60);
        }
        setInterval(sendMouseMove, 50);

        wjQuery("#overlays").show();

        showCaptcha();
        // wsConnect("");
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
    const overlay = $('#overlays');
    const chatContainer = $('#chatX_feed');

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
        // Формируем полный URL для WebSocket
        const wsUrl = (useHttps ? "wss://" : "ws://") + CONNECTION_URL;

        // Проверяем, что соединение не установлено и что текущий URL не совпадает с уже подключенным
        if (ws && ws.readyState === WebSocket.OPEN && currentWebSocketUrl === wsUrl) {
            console.log("Соединение уже активно для этого URL, пропускаем повторное подключение.");
            return;
        }

        if (ma) {
            wjQuery("#connecting").show();
            currentWebSocketUrl = wsUrl; // Запоминаем текущий URL
            wsConnect(wsUrl, token);
        }
    };


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
        mainCanvas = teamScores = null;
        // userScore = 0;
        log.info("Connecting to " + wsUrl + "..");

        // Передаем токен при подключении xxxevexxx
        const params = `?token=${encodeURIComponent(token)}`;
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
        var msg;
        // delay = 500;
        wjQuery("#connecting").hide();

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
    }

        function onWsClose(evt) {
            let serverCloseDiv = document.getElementById("serverclose-overlay");

            if (serverCloseDiv) {
                serverCloseDiv.style.display = "block";
                startCountdown();
            } else {
                console.warn("Элемент с id 'serverclose-overlay' не найден.");
            }
        }

        function startCountdown() {
            let countdownElement = document.getElementById("countdownclose");
            let seconds = 10;

            let countdownInterval = setInterval(function() {
                seconds--;
                countdownElement.textContent = "Перезагрузка через: " + seconds;

                if (seconds <= 0) {
                    clearInterval(countdownInterval);
                    location.reload(); // Перезагружаем страницу
                }
            }, 1000); // Обновляем каждую секунду
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
            case 21:
                // Draw line
                lineX = msg.getInt16(offset, true);
                offset += 2;
                lineY = msg.getInt16(offset, true);
                offset += 2;
                if (!drawLine) {
                    drawLine = true;
                    drawLineX = lineX;
                    drawLineY = lineY;
                }
                break;
            case 48:
                // Update leaderboard (custom text)
                setCustomLB = true;
                noRanking = true;
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
                        level
                    });
                }
                drawLeaderBoard();
                break;
            case 50:
                // Update leaderboard (teams)
                teamScores = [];
                const LBteamNum = msg.getUint32(offset, true);
                offset += 4;
                for (let i = 0; i < LBteamNum; ++i) {
                    teamScores.push(msg.getFloat32(offset, true));
                    offset += 4;
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
            censoredMessage += word[0] + "***";
        } else {
            censoredMessage += word;
        }

        if (i < words.length - 1) {
            censoredMessage += " "; // Добавляем пробел, если это не последнее слово
        }
    }
    return censoredMessage;
}

const admins = ["нико"];
const moders = ["banshee"];

let passUsers = [];

// Загружаем pass.txt и парсим ники
fetch('/pass.txt')
    .then(response => {
        if (!response.ok) {
            throw new Error('Ошибка сети: ' + response.status);
        }
        return response.text();
    })
    .then(text => {
        passUsers = text
            .split('\n')
            .map(n => normalizeNick(n).toLowerCase()) // нормализуем ник и приводим к нижнему регистру
            .filter(n => n.length > 0);

    })
    .catch(err => console.error('Ошибка загрузки pass.txt:', err))


function drawChatBoard() {
    if (hideChat) return;

    const chatDiv = document.getElementById('chatX_feed');

    const lastMessage = chatBoard[chatBoard.length - 1];
    if (!lastMessage) return;

    const msgDiv = document.createElement('div');

    // Определение класса для сообщения на основе роли
    const lowerName = lastMessage.name.toLowerCase();
    if (admins.includes(lowerName)) {
        msgDiv.className = 'chatX_msg admins';
    } else if (moders.includes(lowerName)) {
        msgDiv.className = 'chatX_msg moders';
    } else {
        msgDiv.className = 'chatX_msg';
    }

    // Контейнер для аватара
    const avatarXContainer = document.createElement('div');
    avatarXContainer.className = 'avatarXcontainer';
	const normalizedName = normalizeNick(lastMessage.name); // нормализуем точно так же, как при загрузке passUsers
if (passUsers.includes(normalizedName)) {
    avatarXContainer.style.setProperty('--after-display', 'block');
}
    // Аватар
    const avatar = document.createElement('img');
    avatar.className = 'chatX_avatar';
    const skinName = normalizeNick(lastMessage.name);
    const skinId = skinList[skinName];
    avatar.src = skinId ? `https://agar.su/skins/${skinId}.png` : 'https://agar.su/skins/4.png';
    avatar.onerror = () => avatar.src = 'https://agar.su/skins/4.png';

    // Добавляем аватар в контейнер
    avatarXContainer.appendChild(avatar);

    // Добавляем контейнер аватара в сообщение
    msgDiv.appendChild(avatarXContainer);

    // Контейнер для уровня и ника
    const nameContainer = document.createElement('div');
    nameContainer.className = 'chatX_name_container';

    // Звезда и уровень
    if (typeof lastMessage.playerLevel === 'number' && lastMessage.playerLevel > 0) {
        const levelContainer = document.createElement('div');
        levelContainer.className = 'star-container';

        const starIcon = document.createElement('i');
        starIcon.className = 'fas fa-star';

        const levelSpan = document.createElement('span');
        levelSpan.className = 'levelme';
        levelSpan.textContent = lastMessage.playerLevel;

        levelContainer.appendChild(starIcon);
        levelContainer.appendChild(levelSpan);
        nameContainer.appendChild(levelContainer);
    }

    // Имя
    const nameDiv = document.createElement('div');
    nameDiv.className = 'chatX_nick';
    nameDiv.textContent = lastMessage.name + ':';

    // Цвет ника
    if (admins.includes(lowerName)) {
        nameDiv.style.color = 'gold';
        nameDiv.title = 'Администратор';
    } else if (moders.includes(lowerName)) {
        nameDiv.title = 'Модератор';
    } else {
        nameDiv.style.color = lastMessage.color || '#b8c0cc';
        nameDiv.title = `${lastMessage.pId || 0}`; // PID только у обычных игроков
    }

    nameContainer.appendChild(nameDiv);

    // Сообщение
    const textDiv = document.createElement('div');
    textDiv.className = 'chatX_text';
    textDiv.textContent = censorMessage(lastMessage.message);

    // Время
    const timeDiv = document.createElement('div');
    timeDiv.className = 'chatX_time';
    timeDiv.textContent = lastMessage.time;

    msgDiv.appendChild(nameContainer);
    msgDiv.appendChild(textDiv);
    msgDiv.appendChild(timeDiv);

    chatDiv.prepend(msgDiv);
    chatDiv.scrollTop = chatDiv.scrollHeight;

    // Ограничение сообщений
    const maxMessages = 50;
    while (chatDiv.children.length > maxMessages) {
        chatDiv.removeChild(chatDiv.lastChild);
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
            let _skin = "";

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
                node = new Cell(nodeid, posX, posY, size, color, name, _skin);
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


        }

        while (reader.canRead) {
            const node = nodes[reader.uint32()];
            if (node) node.destroy();
        }

        if (ua && playerCells.length === 0) {
    wjQuery("#statics").show();  
    updateShareText();    // текст шаринга
    updateStats();        // обновляем UI
    drawStatsGraph();     // график
        }
    }

function sendMouseMove() {
    if (wsIsOpen()) {
        if (freeze) {
            // Отправляем зафиксированные координаты, шар не двигается
            if (!(Math.abs(oldX - posX) < 0.01 && Math.abs(oldY - posY) < 0.01)) {
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

            if (64 <= msgX * msgX + msgY * msgY && !(Math.abs(oldX - X) < 0.01 && Math.abs(oldY - Y) < 0.01)) {
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

  function sendNickName() {
        if (wsIsOpen() && null != userNickName) {
            var msg = prepareData(1 + 2 * userNickName.length);
            msg.setUint8(0, 0);
            for (var i = 0; i < userNickName.length; ++i) msg.setUint16(1 + 2 * i, userNickName.charCodeAt(i), true);
            wsSend(msg)
        }
    }



    wHandle.sendChat = function(str) {
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


    function redrawGameScene() {
        drawGameScene();
        wHandle.requestAnimationFrame(redrawGameScene)
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

        // Обновите отрисовку
        drawGameScene();
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


// ===== ПЕРЕМЕННЫЕ =====
let lastDisplayedScore = 0,
    lastDisplayedMaxScore = 0,
    lastDisplayedCellCount = 0,
    maxScore = 0;

let scoreHistory = [];       // Полная история для анализа
const maxGraphPoints = 200;  // Для рисования графика
let startTime = Date.now();

let statsCanvas, statsCtx, staticsDiv;

// ===== УТИЛИТЫ =====
const formatTimeStats = ms => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m}:${s.toString().padStart(2,'0')}`;
};

const compressHistory = (history, maxLength) => {
    if (history.length <= maxLength) return history;
    const step = Math.ceil(history.length / maxLength);
    const compressed = [];
    for (let i = 0; i < history.length; i += step) compressed.push(history[i]);
    if (compressed[compressed.length - 1] !== history[history.length - 1])
        compressed.push(history[history.length - 1]);
    return compressed;
};

function drawStatsGraph() {
    if (!statsCanvas || !statsCtx) return;

    // Всегда очищаем холст
    statsCtx.clearRect(0, 0, statsCanvas.width, statsCanvas.height);

    if (scoreHistory.length < 2) return; // нечего рисовать, но холст уже чистый

    const data = compressHistory(scoreHistory, maxGraphPoints);
    const n = data.length;

    const paddingX = 5, paddingY = 5;
    const innerW = statsCanvas.width - 2 * paddingX;
    const innerH = statsCanvas.height - paddingY - 15;

    const maxScoreInHistory = Math.max(...data.map(p => p.score), 1);
    const minTime = data[0].time;
    const totalTime = Math.max(1, data[n - 1].time - minTime);

    statsCtx.beginPath();
    statsCtx.strokeStyle = 'lime';
    statsCtx.lineWidth = 2;

    data.forEach((point, i) => {
        const x = paddingX + ((point.time - minTime) / totalTime) * innerW;
        const y = paddingY + (1 - point.score / maxScoreInHistory) * innerH;
        i === 0 ? statsCtx.moveTo(x, y) : statsCtx.lineTo(x, y);
    });
    statsCtx.stroke();

    // Рамка
    statsCtx.strokeStyle = '#666';
    statsCtx.lineWidth = 1;
    statsCtx.strokeRect(0.5, 0.5, statsCanvas.width - 1, statsCanvas.height - 1);

    // Метки
    statsCtx.fillStyle = 'white';
    statsCtx.font = '10px Arial';
    statsCtx.textAlign = 'center';
    statsCtx.textBaseline = 'bottom';

    const minLabelPx = 20;
    const maxLabels = Math.max(1, Math.floor(innerW / minLabelPx));
    let step = 1;
    while (Math.ceil(n / step) > maxLabels) step *= 2;

    for (let i = 0; i < n; i += step) {
        const x = paddingX + (i / (n - 1)) * innerW;
        statsCtx.fillText(String(i + 1), x, statsCanvas.height - 2);

        statsCtx.beginPath();
        statsCtx.moveTo(x, statsCanvas.height - 14);
        statsCtx.lineTo(x, statsCanvas.height - 10);
        statsCtx.strokeStyle = '#777';
        statsCtx.lineWidth = 1;
        statsCtx.stroke();
    }

    statsCtx.fillText(String(maxScoreInHistory), 18, paddingY + 8);
}

// ===== ШАРИНГ =====
const scoreMessages = {
    low: [
        "Ничего, зови друзей и попробуй ещё раз!",
        "Только начало! Поделись с друзьями и вернись сильнее!",
        "Быстро умер? Зови друзей, пусть они покажут мастерство!",
        "Не расстраивайся, каждая игра — это опыт. Попробуй снова!",
        "Набирай очки медленно, но верно. Учись на ошибках!",
        "Попробуй поменять фон в настройках — может, поможет сосредоточиться!",
	    "Совет: маленькие шарики часто безопаснее и быстрее увеличивают массу.",
        "Не гоняйся за крупными сразу — иногда лучше подождать и перегруппироваться.",
        "Нажимай F, чтобы замедлить движение шара и точнее выбирать цель.",
        "Меняй фон в настройках — яркие или темные фоны могут влиять на видимость шариков.",
        "Следи за краями карты — там часто проще избегать врагов.",
        "Комбинируй быстрые движения с медленными, чтобы контролировать пространство.",
        "Помни: терпение и стратегия важнее, чем скорость!"
    ],
    mid: [
        "Неплохо! Позови друзей и бросьте друг другу вызов!",
        "Хорошая игра! Поделись результатом и зови друзей на битву!",
        "Ты уже середина пути! Продолжай и удиви всех!",
        "Используй кнопку F, чтобы немного остановиться и обдумать стратегию!",
        "Следи за маленькими шариками — они могут дать быстрый прирост массы!"
    ],
    high: [
        "Вау! Легендарный результат! Делись с друзьями и удиви всех!",
        "Ты на вершине! Покажи друзьям, кто настоящий чемпион!",
        "Превосходно! Каждый шаг был точен и стратегичен!",
        "Не забывай использовать настройки фона для комфортной игры!",
        "Используй кнопку F в нужный момент — контроль важен даже на вершине!",
        "Ты показываешь мастерство! Продолжай и ставь новые рекорды!"
    ]
};

function getShareMessage() {
    const max = lastDisplayedMaxScore;
    const messages = max < 1000 ? scoreMessages.low : max < 10000 ? scoreMessages.mid : scoreMessages.high;
    return messages[Math.floor(Math.random() * messages.length)];
}

function updateShareText() {
    const shareDiv = document.getElementById('shareText');
    if (shareDiv) shareDiv.textContent = getShareMessage();
}

function getStatsText() {
    return `Моя статистика в игре Agar.su!\nМаксимальная масса: ${lastDisplayedMaxScore}\nВремя игры: ${formatTimeStats(Date.now() - startTime)}`;
}

function shareStats(platform) {
    const text = encodeURIComponent(getStatsText());
    const urlToShare = encodeURIComponent(location.href);
    const urls = {
        vk: `https://vk.com/share.php?url=${urlToShare}&title=${text}`,
        telegram: `https://t.me/share/url?url=${urlToShare}&text=${text}`,
        whatsapp: `https://wa.me/?text=${text}%20${urlToShare}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${urlToShare}&quote=${text}`,
        twitter: `https://twitter.com/intent/tweet?url=${urlToShare}&text=${text}`
    };
    const w = 650, h = 450;
    const l = (screen.width - w) / 2, t = (screen.height - h) / 2;
    window.open(urls[platform] || '', '_blank', `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${w},height=${h},top=${t},left=${l}`);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.addEventListener('load', () => {
    statsCanvas = document.getElementById('statsGraph');
    statsCtx = statsCanvas?.getContext('2d');
    staticsDiv = document.getElementById('statics');

    updateShareText();

    ['vk','telegram','whatsapp','facebook','twitter'].forEach(p => {
        const btn = document.querySelector(`.${p}`);
        if (btn) btn.addEventListener('click', () => shareStats(p));
    });
});

// ===== ОБНОВЛЕНИЕ UI СТАТИСТИКИ =====
function updateStats() {
    const currentScore = Math.floor(calcUserScore() / 100);
    const cellCount = playerCells.length;
    maxScore = Math.max(maxScore, currentScore);

    if (currentScore !== lastDisplayedScore) {
        const scoreElem = document.getElementById('score-new');
        if (scoreElem) scoreElem.innerText = 'Сейчас: ' + currentScore;
        lastDisplayedScore = currentScore;
    }

    if (maxScore !== lastDisplayedMaxScore) {
        const maxElem = document.getElementById('score-max');
        if (maxElem) maxElem.innerText = 'Максимум: ' + maxScore;
        lastDisplayedMaxScore = maxScore;
    }

    if (cellCount !== lastDisplayedCellCount) {
        const cellElem = document.getElementById('cell-length');
        if (cellElem) cellElem.innerText = cellCount;
        lastDisplayedCellCount = cellCount;
    }

    // Добавляем в историю
    scoreHistory.push({ time: timestamp - startTime, score: currentScore });

    // Ограничиваем историю до 200 элементов
    if (scoreHistory.length > 200) {
        scoreHistory = compressHistory(scoreHistory, 200);
    }
}






function drawGameScene() {
    const oldtime = Date.now();
    ++cb;
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

    // Сортировка только если есть изменения (можно кэшировать состояние)
    nodelist.sort((a, b) => a.size - b.size || a.id - b.id);

    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(viewZoom, viewZoom);
    ctx.translate(-nodeX, -nodeY);

    // Рисуем все клетки
    for (let i = 0; i < Cells.length; i++) Cells[i].drawOneCell(ctx);
    for (let i = 0; i < nodelist.length; i++) nodelist[i].drawOneCell(ctx);

    // Рисуем линию
    if (drawLine && playerCount > 0) {
        drawLineX = (3 * drawLineX + lineX) / 4;
        drawLineY = (3 * drawLineY + lineY) / 4;

        ctx.save();
        ctx.strokeStyle = "#FFAAAA";
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = 0.5;
        ctx.beginPath();

        for (let i = 0; i < playerCount; i++) {
            const cell = playerCells[i];
            ctx.moveTo(cell.x, cell.y);
            ctx.lineTo(drawLineX, drawLineY);
        }

        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();

    // Рисуем UI
    if (lbCanvas?.width) ctx.drawImage(lbCanvas, canvasWidth - lbCanvas.width - 10, 10);
    if (chatCanvas) ctx.drawImage(chatCanvas, 0, canvasHeight - chatCanvas.height - 50);

    updateStats();
    drawSplitIcon(ctx);
    drawTouch(ctx);

    // Коррекция FPS
    const deltatime = Date.now() - oldtime;
    if (deltatime > 1000 / 60) z = Math.max(0.4, z - 0.01);
    else if (deltatime < 1000 / 65) z = Math.min(1, z + 0.01);
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


// Функция для получения значения куки по имени
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

// Функция для установки куки
function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

// Функция для определения темы ОС по умолчанию
function getDefaultTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'black'; // Или 'gradient'
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'white'; // Или 'gradient'
  } else {
    return 'gradient'; // Если невозможно определить
  }
}

// Функция отрисовки сетки (БЕЗ аргументов, читает тему из куки или ОС)
function drawGrid() {
  const savedTheme = getCookie('grid_theme');
  let themeToDraw = savedTheme || getDefaultTheme(); // Используем тему из куки или тему ОС

  switch (themeToDraw) {
    case 'gradient':
      drawGradientGrid();
      break;
    case 'white':
      drawWhiteGrid();
      break;
    case 'black':
      drawBlackGrid();
      break;
    default:
      drawGradientGrid(); // Обработка неизвестной темы
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const selectElement = document.getElementById('theme-select');

  // Добавляем обработчик события изменения выбранной темы
  selectElement.addEventListener('change', function() {
    const selectedTheme = this.value;
    setCookie('grid_theme', selectedTheme, 30); // Сохраняем в куки
    drawGrid(); // Отрисовываем сетку
  });

  // Проверяем, есть ли тема в куках
  let savedTheme = getCookie('grid_theme');
  if (!savedTheme) {
      // Если нет темы в куках, получаем тему ОС по умолчанию
      savedTheme = getDefaultTheme();
      setCookie('grid_theme', savedTheme, 30); // Сохраняем тему ОС в куки
  }

  // Устанавливаем выбранную тему в селекторе
  selectElement.value = savedTheme;
});



    // Новая версия с градиентом
    function drawGradientGrid() {
        // Позиции центра карты
        const mapCenterX = (leftPos + rightPos) / 2;
        const mapCenterY = (topPos + bottomPos) / 2;

        // Определяем радиус градиента, чтобы захватить всю карту
        const gradientRadius = Math.sqrt(Math.pow(rightPos - leftPos, 2) + Math.pow(bottomPos - topPos, 2)) / 2;

        // Создаем радиальный градиент, зафиксированный по карте
        const gradient = ctx.createRadialGradient(
            (mapCenterX - nodeX) * viewZoom + canvasWidth / 2, // Центр градиента по оси X
            (mapCenterY - nodeY) * viewZoom + canvasHeight / 2, // Центр градиента по оси Y
            0,                                                 // Начальный радиус градиента
            (mapCenterX - nodeX) * viewZoom + canvasWidth / 2, // Центр по X с учетом позиции игрока
            (mapCenterY - nodeY) * viewZoom + canvasHeight / 2, // Центр по Y с учетом позиции игрока
            gradientRadius * viewZoom                          // Радиус градиента
        );

        // Задаем цвета градиента
        gradient.addColorStop(0, "#132745");
        gradient.addColorStop(1, "#000000");

        // Заполняем холст градиентом
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
                    ? `skins/${skinId}.png`
                    : "skins/4.png";

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


function updateMiniMapPosition() {
    const playerDot = document.getElementById('mapposition');
    const mapContainer = document.querySelector('.map-container');
    const cells = mapContainer.querySelectorAll('div > span');

    if (!playerDot || !mapContainer) return;

    // Размеры реальной карты
    const totalMapWidth = rightPos - leftPos;
    const totalMapHeight = bottomPos - topPos;

    // Размеры мини-карты
    const miniMapWidth = mapContainer.offsetWidth;
    const miniMapHeight = mapContainer.offsetHeight;

    // Относительное положение игрока
    let relativeX = (nodeX - leftPos) / totalMapWidth;
    let relativeY = (nodeY - topPos) / totalMapHeight;

    // Переводим относительные координаты в мини-карту
    let miniX = Math.round(relativeX * miniMapWidth);
    let miniY = Math.round(relativeY * miniMapHeight);

    // Устанавливаем позицию точки
    const dotRadius = playerDot.offsetWidth / 2;
    playerDot.style.left = (miniX - dotRadius) + 'px';
    playerDot.style.top = (miniY - dotRadius) + 'px';

    // --- Определяем в какой клетке находится точка ---
    const cols = 5;
    const rows = 5;
    const cellWidth = miniMapWidth / cols;
    const cellHeight = miniMapHeight / rows;

    const colIndex = Math.floor(miniX / cellWidth); // 0..4
    const rowIndex = Math.floor(miniY / cellHeight); // 0..4
    const rowLetters = ['A','B','C','D','E'];
    const currentCell = rowLetters[rowIndex] + (colIndex + 1);

    // --- Меняем цвет клеток ---
    cells.forEach(span => {
        if (span.textContent === currentCell) {
            span.style.color = 'gold';
        } else {
            span.style.color = ''; // стандартный цвет
        }
    });
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

function drawLeaderBoard() {
    const leaderboardDiv = document.getElementById("leaderboard");
    leaderboardDiv.innerHTML = "";

    const forbiddenSymbols = ["﷽", "𒐫","𒈙","⸻","꧅","ဪ","௵","௸","‱"];
    const displayedPlayers = 10;
    let myRank = null;

    if ((teamScores && teamScores.length > 0) || (leaderBoard.length > 0)) {
        const header = document.createElement("h2");
        header.innerText = "Топ Сейчас";
        leaderboardDiv.appendChild(header);

        if (!teamScores || teamScores.length === 0) {
            for (let b = 0; b < leaderBoard.length; ++b) {
                let name = leaderBoard[b].name;
                const level = leaderBoard[b].level;

                forbiddenSymbols.forEach(symbol => {
                    if (name.includes(symbol)) name = "";
                });
                name = censorMessage(name);
                if (!showName) name = "";

                const isMe = playerCells.some(cell => cell.id === leaderBoard[b].id);
                if (isMe) {
                    const myCell = playerCells.find(cell => cell.id === leaderBoard[b].id);
                    if (myCell?.name) {
                        let myName = myCell.name;
                        forbiddenSymbols.forEach(symbol => {
                            if (myName.includes(symbol)) myName = "";
                        });
                        myName = censorMessage(myName);
                        name = myName;
                        myRank = b + 1;
                    }
                }

                if (b < displayedPlayers) {
                    const entryDiv = document.createElement("div");

                    // Определяем класс на основе роли
                    const lowerName = name.toLowerCase();
                    if (admins.includes(lowerName)) {
                        entryDiv.className = "Lednick admins";
                    } else if (moders.includes(lowerName)) {
                        entryDiv.className = "Lednick moders";
                    } else {
                        entryDiv.className = "Lednick";
                    }

                    entryDiv.style.color = isMe ? "#FFAAAA" : "#FFFFFF";
                    entryDiv.innerHTML = (!noRanking ? `${b + 1}. ` : "") +
                        (level !== -1 ? "<div class='star-container'><i class='fas fa-star'></i><span class='levelme'>" + level + "</span></div>" : "") +
                        `<span>${name}</span>`;
                    leaderboardDiv.appendChild(entryDiv);
                }
            }

            if (myRank && myRank > displayedPlayers) {
                const level = accountData ? getLevel(accountData.xp) : -1;
                let myName = playerCells[0].name;
                forbiddenSymbols.forEach(symbol => {
                    if (myName.includes(symbol)) myName = "";
                });
                myName = censorMessage(myName);

                const myRankDiv = document.createElement("div");

                const lowerName = myName.toLowerCase();
                if (admins.includes(lowerName)) {
                    myRankDiv.className = "Lednick admins";
                } else if (moders.includes(lowerName)) {
                    myRankDiv.className = "Lednick moders";
                } else {
                    myRankDiv.className = "Lednick";
                }

                myRankDiv.style.color = "#FFAAAA";
                myRankDiv.innerHTML = myRank + ". " +
                    (level !== -1 ? "<div class='star-container'><i class='fas fa-star'></i><span class='levelme'>" + level + "</span></div>" : "") +
                    `<span>${myName}</span>`;
                leaderboardDiv.appendChild(myRankDiv);
            }
        } else {
            for (let b = 0; b < teamScores.length; ++b) {
                const teamEntry = document.createElement("div");
                teamEntry.innerText = `Team ${b + 1}: ${teamScores[b]}`;
                teamEntry.style.color = teamColor[b + 1];
                leaderboardDiv.appendChild(teamEntry);
            }
        }
    }
}




    function Cell(uid, ux, uy, usize, ucolor, uname, a) {
        this.id = uid;
        this.ox = this.x = ux;
        this.oy = this.y = uy;
        this.oSize = this.size = usize;
        this.color = ucolor;
        this.points = [];
        this.pointsAcc = [];
        this.createPoints();
        this.setName(uname)
        this._skin = a;
    }

    function UText(usize, ucolor, ustroke, ustrokecolor) {
        usize && (this._size = usize);
        ucolor && (this._color = ucolor);
        this._stroke = !!ustroke;
        ustrokecolor && (this._strokeColor = ustrokecolor)
    }

    var nCanvas, ctx, mainCanvas, lbCanvas, chatCanvas, canvasWidth, canvasHeight, qTree = null,
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
        cb = 0,
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
        showSkin = true,
        showName = true,
        // showColor = false,
        ua = false,
        // userScore = 0,
        showMass = true,
        hideChat = false,
        smoothRender = .4,
        posX = nodeX = ~~((leftPos + rightPos) / 2),
        posY = nodeY = ~~((topPos + bottomPos) / 2),
        posSize = 1,
        teamScores = null,
        ma = false,
        // hasOverlay = true,
        drawLine = false,
        lineX = 0,
        lineY = 0,
        drawLineX = 0,
        drawLineY = 0,
        // Ra = 0,
        teamColor = ["#333333", "#FF3333", "#33FF33", "#3333FF"],
        xa = false,
        zoom = 1,
        isTouchStart = "ontouchstart" in wHandle && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        splitIcon = new Image,
        ejectIcon = new Image,
        noRanking = false;
    splitIcon.src = "assets/photo/split.png";
    ejectIcon.src = "assets/photo/eject.png";
    // var wCanvas = document.createElement("canvas");
    // var playerStat = null;
    //wHandle.isSpectating = false;
    // Обновленный setNick
    wHandle.setNick = function (arg) {
        $('#overlays').hide();
        userNickName = arg;
        sendNickName();
         wjQuery("#statics").hide();
		 
		     // сброс статистики для новой игры
    scoreHistory = [];
    lastDisplayedScore = 0;
    lastDisplayedMaxScore = 0;
    lastDisplayedCellCount = 0;
    maxScore = 0;
    startTime = Date.now();
    drawStatsGraph();
    };


    wHandle.setSkins = function (arg) {
        showSkin = arg
    };
    wHandle.setNames = function (arg) {
        showName = arg
    };
    wHandle.setColors = function (arg) {
        // showColor = arg
    };
    wHandle.setShowMass = function (arg) {
        showMass = arg
    };
    wHandle.setSmooth = function (arg) {
        smoothRender = arg ? 2 : .4
    };
    wHandle.setChatHide = function (arg) {
        hideChat = arg;
        if (hideChat) {
            wjQuery('#chat_textbox').hide();
        } else {
            wjQuery('#chat_textbox').show();
        }
    }
    wHandle.spectate = function () {
        userNickName = null;
        // wHandle.isSpectating = true;
        // sendUint8(1);
        hideOverlays();
		wjQuery("#statics").hide();
    };
    wHandle.setAcid = function (arg) {
        xa = arg
    };

    if (null != wHandle.localStorage) {
        wjQuery(window).load(function () {
            wjQuery(".save").each(function () {
                var id = $(this).data("box-id");
                var value = wHandle.localStorage.getItem("checkbox-" + id);
                if (value && value == "true" && 0 != id) {
                    $(this).prop("checked", "true");
                    $(this).trigger("change");
                } else if (id == 0 && value != null) {
                    $(this).val(value);
                }
            });
            wjQuery(".save").change(function () {
                var id = $(this).data('box-id');
                var value = (id == 0) ? $(this).val() : $(this).prop('checked');
                wHandle.localStorage.setItem("checkbox-" + id, value);
            });
        });
        if (null == wHandle.localStorage.AB8) {
            wHandle.localStorage.AB8 = ~~(100 * Math.random());
        }
    }

    // setTimeout(function () {
    // }, 3E5);
    // var T = {
    //     ZW: "EU-London"
    // };
    wHandle.connect = wsConnect;

    // var data = {
    //     "action": "test"
    // };
    var transparent = ["незнакомка","bublik"];
    var
        // delay = 500,
        oldX = -1,
        oldY = -1,
        // Canvas = null,
        z = 1,
        // scoreText = null,
        skins = {};
    // knownNameDict = "".split(";"),
    // knownNameDict_noDisp = [],
    // ib = ["_canvas'blob"]
    // ;
    Cell.prototype = {
        id: 0,
        points: null,
        pointsAcc: null,
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
        destroy: function () {
            var tmp;
            for (tmp = 0, len = nodelist.length; tmp < len; tmp++)
                if (nodelist[tmp] === this) {
                    nodelist.splice(tmp, 1);
                    break
                }
            delete nodes[this.id];
            tmp = playerCells.indexOf(this);
            if (-1 != tmp) {
                ua = true;
                playerCells.splice(tmp, 1);
            }
            this.destroyed = true;
            Cells.push(this)
        },
        getNameSize: function () {
            return Math.max(~~(.3 * this.size), 24)
        },
        setName: function (a) {
            this.name = a;
            if (null == this.nameCache) {
                this.nameCache = new UText(this.getNameSize(), "#FFFFFF", true, "#000000");
                this.nameCache.setValue(this.name);
            } else {
                this.nameCache.setSize(this.getNameSize());
                this.nameCache.setValue(this.name);
            }
        },
        setSize: function (a) {
            this.nSize = a;
            var m = ~~(this.size * this.size * 0.01);
            if (null === this.sizeCache)
                this.sizeCache = new UText(this.getNameSize() * 0.5, "#FFFFFF", true, "#000000");
            else this.sizeCache.setSize(this.getNameSize() * 0.5);
        },
        createPoints: function () {
            for (var samplenum = this.getNumPoints(); this.points.length > samplenum;) {
                var rand = ~~(Math.random() * this.points.length);
                this.points.splice(rand, 1);
                this.pointsAcc.splice(rand, 1)
            }
            if (0 == this.points.length && 0 < samplenum) {
                this.points.push({
                    ref: this,
                    size: this.size,
                    x: this.x,
                    y: this.y
                });
                this.pointsAcc.push(Math.random() - .5);
            }
            while (this.points.length < samplenum) {
                var rand2 = ~~(Math.random() * this.points.length),
                    point = this.points[rand2];
                this.points.splice(rand2, 0, {
                    ref: this,
                    size: point.size,
                    x: point.x,
                    y: point.y
                });
                this.pointsAcc.splice(rand2, 0, this.pointsAcc[rand2])
            }
        },
        getNumPoints: function () {
            if (0 == this.id) return 16;
            var a = 10;
            if (20 > this.size) a = 0;
            if (this.isVirus) a = 30;
            var b = this.size;
            if (!this.isVirus) (b *= viewZoom);
            b *= z;
            if (this.flag & 32) (b *= .25);
            return ~~Math.max(b, a);
        },
        movePoints: function () {
            this.createPoints();
            for (var points = this.points, pointsacc = this.pointsAcc, numpoints = points.length, i = 0; i < numpoints; ++i) {
                var pos1 = pointsacc[(i - 1 + numpoints) % numpoints],
                    pos2 = pointsacc[(i + 1) % numpoints];
                pointsacc[i] += (Math.random() - .5) * (this.isAgitated ? 3 : 1);
                pointsacc[i] *= .7;
                10 < pointsacc[i] && (pointsacc[i] = 10);
                -
                    10 > pointsacc[i] && (pointsacc[i] = -10);
                pointsacc[i] = (pos1 + pos2 + 8 * pointsacc[i]) / 10
            }
            for (var ref = this, isvirus = this.isVirus ? 0 : (this.id / 1E3 + timestamp / 1E4) % (2 * Math.PI), j = 0; j < numpoints; ++j) {
                var f = points[j].size,
                    e = points[(j - 1 + numpoints) % numpoints].size,
                    m = points[(j + 1) % numpoints].size;
                if (15 < this.size && null != qTree && 20 < this.size * viewZoom && 0 != this.id) {
                    var l = false,
                        n = points[j].x,
                        q = points[j].y;
                    qTree.retrieve2(n - 5, q - 5, 10, 10, function (a) {
                        if (a.ref != ref && 25 > (n - a.x) * (n - a.x) + (q - a.y) * (q - a.y)) {
                            l = true;
                        }
                    });
                    if (!l && points[j].x < leftPos || points[j].y < topPos || points[j].x > rightPos || points[j].y > bottomPos) {
                        l = true;
                    }
                    if (l) {
                        if (0 < pointsacc[j]) {
                            (pointsacc[j] = 0);
                        }
                        pointsacc[j] -= 1;
                    }
                }
                f += pointsacc[j];
                0 > f && (f = 0);
                f = this.isAgitated ? (19 * f + this.size) / 20 : (12 * f + this.size) / 13;
                points[j].size = (e + m + 8 * f) / 10;
                e = 2 * Math.PI / numpoints;
                m = this.points[j].size;
                this.isVirus && 0 == j % 2 && (m += 5);
                points[j].x = this.x + Math.cos(e * j + isvirus) * m;
                points[j].y = this.y + Math.sin(e * j + isvirus) * m
            }
        },
        updatePos: function () {
            if (0 == this.id) return 1;
            var a;
            a = (timestamp - this.updateTime) / 120;
            a = 0 > a ? 0 : 1 < a ? 1 : a;
            var b = 0 > a ? 0 : 1 < a ? 1 : a;
            this.getNameSize();
            if (this.destroyed && 1 <= b) {
                var c = Cells.indexOf(this);
                -
                    1 != c && Cells.splice(c, 1)
            }
            this.x = a * (this.nx - this.ox) + this.ox;
            this.y = a * (this.ny - this.oy) + this.oy;
            this.size = b * (this.nSize - this.oSize) + this.oSize;
            return b;
        },
        shouldRender: function () {
            if (0 == this.id) {
                return true
            } else {
                return !(this.x + this.size + 40 < nodeX - canvasWidth / 2 / viewZoom || this.y + this.size + 40 < nodeY - canvasHeight / 2 / viewZoom || this.x - this.size - 40 > nodeX + canvasWidth / 2 / viewZoom || this.y - this.size - 40 > nodeY + canvasHeight / 2 / viewZoom);
            }
        },
        getStrokeColor: function () {
            var r = (~~(parseInt(this.color.substr(1, 2), 16) * 0.9)).toString(16),
                g = (~~(parseInt(this.color.substr(3, 2), 16) * 0.9)).toString(16),
                b = (~~(parseInt(this.color.substr(5, 2), 16) * 0.9)).toString(16);
            if (r.length == 1) r = "0" + r;
            if (g.length == 1) g = "0" + g;
            if (b.length == 1) b = "0" + b;
            return "#" + r + g + b;
        },
        drawOneCell: function (ctx) {
            if (this.shouldRender()) {
                var isSimpleRender = (this.id !== 0 && !this.isVirus && !this.isAgitated && smoothRender > viewZoom);
                if (this.getNumPoints() < 10) isSimpleRender = true;

                if (this.wasSimpleDrawing && !isSimpleRender) {
                    for (var i = 0; i < this.points.length; i++) {
                        this.points[i].size = this.size;
                    }
                }

                var bigPointSize = this.size;
                if (!this.wasSimpleDrawing) {
                    for (var i = 0; i < this.points.length; i++) {
                        bigPointSize = Math.max(this.points[i].size, bigPointSize);
                    }
                }

                this.wasSimpleDrawing = isSimpleRender;
                ctx.save();
                this.drawTime = timestamp;
                var scale = this.updatePos();
                if (this.destroyed) ctx.globalAlpha *= 1 - scale;

                ctx.lineWidth = 10;
                ctx.lineCap = "round";
                ctx.lineJoin = this.isVirus ? "miter" : "round";

                // Определение цвета и прозрачности
                var isTransparent = transparent.includes(this.name.toLowerCase());
                if (isTransparent) {
                    ctx.fillStyle = "rgba(0, 0, 0, 0)";
                    ctx.strokeStyle = "rgba(0, 0, 0, 0)";
                } else {
                    ctx.fillStyle = this.color;
                    ctx.strokeStyle = isSimpleRender ? this.color : this.getStrokeColor();
                }

                ctx.beginPath();
                if (isSimpleRender) {
                    var lw = this.size * 0.03;
                    ctx.lineWidth = lw;
                    ctx.arc(this.x, this.y, this.size - lw * 0.5 + 5, 0, 2 * Math.PI, false);
                } else {
                    this.movePoints();
                    var d = this.getNumPoints();
                    ctx.moveTo(this.points[0].x, this.points[0].y);
                    for (var i = 1; i <= d; ++i) {
                        var p = i % d;
                        ctx.lineTo(this.points[p].x, this.points[p].y);
                    }
                }
                ctx.closePath();

                // Определение ID скина через skinList
                var skinName = normalizeNick(this.name);
                var skinId = skinList[skinName];
                var skinImage = null;

                if (skinId) {
                    // Загружаем изображение скина только если ID найден в skinList
                    if (!skins.hasOwnProperty(skinId)) {
                        skins[skinId] = new Image();
                        skins[skinId].src = `skins/${skinId}.png`;
                    }
                    if (skins[skinId].complete && skins[skinId].width > 0) {
                        skinImage = skins[skinId];
                    }
                }

                ctx.stroke();
                ctx.fill();

                // Отображение анимационного скина, если он загружен
                if (skinImage) {
                    ctx.save();
                    ctx.clip();

                    const frameWidth = skinImage.width; // Width of the sprite sheet
                    const frameHeight = skinImage.height; // Height of the sprite sheet

                    // Определение, является ли скин анимацией
                    if (frameWidth > frameHeight) {
                        // Это анимация
                        const totalFrames = Math.floor(frameWidth / frameHeight); // Total number of frames
                        const currentFrame = Math.floor((Date.now() / 100) % totalFrames); // Calculate current frame based on time

                        // Calculate source x position for the current frame
                        const sourceX = currentFrame * frameHeight;

                        // Draw the current frame
                        ctx.drawImage(skinImage, sourceX, 0, frameHeight, frameHeight,
                            this.x - bigPointSize, this.y - bigPointSize,
                            2 * bigPointSize, 2 * bigPointSize);
                    } else {
                        // Это статическое изображение
                        ctx.drawImage(skinImage, 0, 0, frameWidth, frameHeight,
                            this.x - bigPointSize, this.y - bigPointSize,
                            2 * bigPointSize, 2 * bigPointSize);
                    }

                    ctx.restore();
                }

// Отображение имени
if (this.id !== 0) {
    var x = Math.floor(this.x),
        y = Math.floor(this.y),
        nameSize = this.getNameSize(),
        zoomRatio = Math.ceil(10 * viewZoom) * 0.1,
        invZoomRatio = 1 / zoomRatio;

    // Скрываем имя, если this.size > 10
    if (showName && (this.name && this.nameCache) && this.size > 10) {
        // Проверяем запрещённые символы
        var forbiddenSymbols = ["﷽", "𒐫","𒈙","⸻","꧅","ဪ","௵","௸","‱"];
        var displayName = this.name;

        forbiddenSymbols.forEach(symbol => {
            if (displayName.includes(symbol)) displayName = "";
        });

        // Дополнительно пропускаем через функцию цензуры
        displayName = censorMessage(displayName);

        this.nameCache.setValue(displayName);
        this.nameCache.setSize(nameSize);
        this.nameCache.setScale(zoomRatio);
        var nameImage = this.nameCache.render(),
            nameWidth = Math.floor(nameImage.width * invZoomRatio),
            nameHeight = Math.floor(nameImage.height * invZoomRatio);
        ctx.drawImage(nameImage, x - Math.floor(nameWidth / 2), y - Math.floor(nameHeight / 2), nameWidth, nameHeight);
    }
                     // Отображение массы
                    //скрываем массу если this.size > 100
                    if (showMass && ((!this.isVirus && !this.isEjected && !this.isAgitated) && this.size > 100)) {
                        var mass = Math.floor(this.size * this.size * 0.01);
                        this.sizeCache.setValue(mass);
                        this.sizeCache.setScale(zoomRatio);
                        var massImage = this.sizeCache.render(),
                            massWidth = Math.floor(massImage.width * invZoomRatio),
                            massHeight = Math.floor(massImage.height * invZoomRatio);
                        ctx.drawImage(massImage, x - Math.floor(massWidth / 2), y + Math.floor(massHeight * 0.8), massWidth, massHeight);
                    }
}
                ctx.restore();
            }
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
        render: function () {
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
                var h2 = h * 0.5;
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
        getWidth: function () {
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

// --------------------- Работа с токеном ---------------------
const setAccountToken = token => { localStorage.accountToken = token; };
const clearAccountToken = () => { delete localStorage.accountToken; };

const accountApiGet = (tag, method = 'GET', body = null) => {
    const headers = { Authorization: `Game ${localStorage.accountToken}` };
    if (body) headers['Content-Type'] = 'application/json';
    return fetch("https://pmori.ru:6003/api/" + tag, { method, headers, body: body ? JSON.stringify(body) : null });
};

// --------------------- Логин через uLogin, Telegram и VKID ---------------------
async function handleLogin(tokenOrUser, type = 'ulogin') {
    // type = 'ulogin' | 'telegram' | 'vkid'
    let url, options;

    if (type === 'telegram') {
        url = 'auth/telegram';
        options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tokenOrUser) };
    } else if (type === 'vkid') {
        url = 'vk-login';
        options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tokenOrUser) };
    } else {
        // uLogin
        url = 'auth/ulogin?token=' + tokenOrUser;
        options = { method: 'GET' };
    }

    const res = await fetch("https://pmori.ru:6003/api/" + url, options);
    const data = await res.json();
    if (data.error) return alert(data.error);

    wHandle.onAccountLoggedIn(data.token);
}

// Обработчики для разных авторизаций
wHandle.onUloginToken = token => handleLogin(token, 'ulogin');
wHandle.onTelegramAuth = user => handleLogin(user, 'telegram');
wHandle.onVKLogin = user => handleLogin(user, 'vkid'); // user = { code, deviceId } от VKID

// --------------------- Работа с аккаунтом ---------------------
wHandle.onAccountLoggedIn = token => {
    setAccountToken(token);
    loadAccountUserData();
    sendAccountToken(); // твоя внутренняя логика
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

// --------------------- Логика выхода ---------------------
const onLogout = () => {
    accountData = null;
    localStorage.removeItem('accountData');
    clearAccountToken();

    document.querySelector(".progress-fill")?.style.width = `0%`;
    document.getElementById("levelCircle") && (document.getElementById("levelCircle").textContent = "0");
    document.getElementById("progressText") && (document.getElementById("progressText").textContent = "0% (0/0)");
    document.getElementById("accountID") && (document.getElementById("accountID").textContent = "ID: 0000");

    logoutButton.style.display = "none";
    loginButton.style.display = "";
    authlog.style.display = "";
    showLogoutNotification();
};

// --------------------- Загрузка и отображение данных ---------------------
let accountData;

const setAccountData = data => {
    accountData = data;
    displayAccountData();
    document.querySelectorAll(".menu-item")[2].click();
    logoutButton.style.display = "";
    loginButton.style.display = "none";
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

// --------------------- XP / Level ---------------------
const getXp = level => ~~(100 * (level ** 2 / 2));
const getLevel = xp => ~~((xp / 100 * 2) ** .5);

const displayAccountData = () => {
    if (!accountData) return;
    const currLevel = getLevel(accountData.xp);
    const nextXp = getXp(currLevel + 1);
    const progressPercent = (accountData.xp / nextXp) * 100;

    document.querySelector(".progress-fill")?.style.width = `${progressPercent}%`;
    document.getElementById("levelCircle") && (document.getElementById("levelCircle").textContent = currLevel);
    document.getElementById("progressText") && (document.getElementById("progressText").textContent = `${Math.round(progressPercent)}% (${accountData.xp}/${nextXp})`);
    document.getElementById("accountID") && (document.getElementById("accountID").textContent = `ID: ${accountData.uid}`);
};

wHandle.onUpdateXp = xp => {
    if (accountData) {
        accountData.xp = xp;
        displayAccountData();
    }
};


    wHandle.onload = gameLoop;
})(window, window.jQuery);
