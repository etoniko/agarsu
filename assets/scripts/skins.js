// Переменные для отслеживания действий
let lastActionTime = 0; // Время последнего действия
const actionInterval = 500; // Интервал между действиями (в мс)
let actionTimeout; // Таймер для обработки ввода
let currentIndex = 0; // Индекс текущего игрока

// Функция загрузки списка скинов
async function loadSkinsList() {
    const response = await fetch('skinlist.txt?0.0.3');
    const data = await response.text();
    const skinsMap = new Map();

    data.split('\n').forEach(line => {
        const [nick, id] = line.split(':');
        if (nick && id) skinsMap.set(normalizeNick(nick), id.trim());
    });
    return skinsMap;
}

// Функция нормализации ника для поиска
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


                        // Функция выбора скина и сохранения данных игрока в localStorage
                        async function selectSkin(nick) {
                            const skinsMap = await loadSkinsList();
                            const normalizedNick = normalizeNick(nick);

                            // Проверка, если скин найден
                            if (skinsMap.has(normalizedNick)) {
                                const id = skinsMap.get(normalizedNick);

                                // Сохранение данных игрока в localStorage
                                savePlayerData(nick, id);
                                currentIndex = getCurrentPlayerIndex(nick); // Обновление индекса
                                updateAvatarDisplay(); // Обновление аватара
                            } else {
                                document.querySelector("#skinss").style.backgroundImage = ""; // Очистка фона
                            }
                        }

                        // Функция получения текущего индекса игрока из localStorage
                        function getCurrentPlayerIndex(nick) {
                            const players = JSON.parse(localStorage.getItem('players') || '[]');
                            return players.findIndex(player => normalizeNick(player.nick) === normalizeNick(nick));
                        }

                        // Функция сохранения данных игрока в localStorage
                        function savePlayerData(nick, id) {
                            const players = JSON.parse(localStorage.getItem('players') || '[]');
                            const playerData = { nick, id }; // Сохраняем ник и скин

                            // Удаление дубликатов
                            const index = players.findIndex(player => normalizeNick(player.nick) === normalizeNick(nick));
                            if (index !== -1) players.splice(index, 1);

                            // Добавление нового игрока в начало
                            players.unshift(playerData);

                            // Ограничение хранения последних 3 игроков
                            if (players.length > 3) players.pop();

                            localStorage.setItem('players', JSON.stringify(players)); // Сохранение в localStorage
                        }

                        // Функция обновления отображения аватаров
                        function updateAvatarDisplay() {
                            const players = JSON.parse(localStorage.getItem('players') || '[]');
                            const mainSkin = document.querySelector("#skinss");
                            const previousSkin = document.querySelector("#prevSkin");
                            const nextSkin = document.querySelector("#nextSkin");

                            // Очистка фонов
                            mainSkin.style.backgroundImage = "";
                            previousSkin.style.backgroundImage = "";
                            nextSkin.style.backgroundImage = "";

                            if (players.length > 0) {
                                const currentPlayer = players[currentIndex];
                                mainSkin.style.backgroundImage = `url(skins/${currentPlayer.id}.png)`; // Выставляем скин
                                document.getElementById("nick").value = currentPlayer.nick;

                                // Установка предыдущего скина
                                const prevIndex = (currentIndex - 1 + players.length) % players.length;
                                if (players[prevIndex]) {
                                    previousSkin.style.backgroundImage = `url(skins/${players[prevIndex].id}.png)`;
                                }

                                // Установка следующего скина
                                const nextIndex = (currentIndex + 1) % players.length;
                                if (players[nextIndex]) {
                                    nextSkin.style.backgroundImage = `url(skins/${players[nextIndex].id}.png)`;
                                }
                            }
                        }

                        // Показ следующего игрока
                        function showNext() {
                            const players = JSON.parse(localStorage.getItem('players') || '[]');
                            if (players.length > 0) {
                                currentIndex = (currentIndex + 1) % players.length;
                                changeSkin();
                            }
                        }

                        // Показ предыдущего игрока
                        function showPrevious() {
                            const players = JSON.parse(localStorage.getItem('players') || '[]');
                            if (players.length > 0) {
                                currentIndex = (currentIndex - 1 + players.length) % players.length;
                                changeSkin();
                            }
                        }

                        // Анимация смены скина
                        function changeSkin() {
                            const mainSkin = document.querySelector("#skinss");
                            mainSkin.classList.add("scale-down");
                            setTimeout(() => {
                                updateAvatarDisplay();
                                mainSkin.classList.remove("scale-down");
                            }, 50);
                        }

                        // Обработчик ввода ника
                        document.getElementById('nick').addEventListener('input', function () {
                            const nickname = this.value;
                            clearTimeout(actionTimeout);
                            actionTimeout = setTimeout(async () => {
                                await selectSkin(nickname);
                            }, actionInterval);
                        });

                        // Загрузка сохранённых данных при загрузке страницы
                        window.addEventListener("load", function () {
                            const players = JSON.parse(localStorage.getItem('players') || '[]');

                            if (players.length > 0) {
                                currentIndex = 0;
                                updateAvatarDisplay();
                            }
                        });
