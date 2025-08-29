   let isServerOpen = false; // Переменная для отслеживания состояния сервера

                        function toggleServer() {
                            if (isServerOpen) {
                                closeServer();
                            } else {
                                openServer();
                            }
                        }

                        function openServer() {
                            const server = document.getElementById('server');
                            const avatarContainer = document.querySelector('.avatar-container');
                            const inputContainer = document.querySelector('.input-container');
                            const sgm = document.querySelector('.sgm');
                            const photoGallery = document.querySelector('.gamemode');

                            server.style.display = 'flex'; // Показать элемент сервера
                            requestAnimationFrame(() => {
                                server.classList.add('visible'); // Анимация появления сервера
                                sgm.classList.add('visible'); // Анимация появления sgm
                                photoGallery.classList.add('visible'); // Анимация появления photo-gallery
                            });

                            // Скрываем аватар и input-container
                            avatarContainer.classList.add('hidden');
                            inputContainer.classList.add('hidden');

                            isServerOpen = true; // Устанавливаем состояние сервера в открытое
                        }

                        function closeServer() {
                            const server = document.getElementById('server');
                            const avatarContainer = document.querySelector('.avatar-container');
                            const inputContainer = document.querySelector('.input-container');
                            const sgm = document.querySelector('.sgm');
                            const photoGallery = document.querySelector('.gamemode');

                            server.classList.remove('visible'); // Анимация исчезновения сервера
                            sgm.classList.remove('visible'); // Анимация исчезновения sgm
                            photoGallery.classList.remove('visible'); // Анимация исчезновения photo-gallery

                            server.addEventListener('transitionend', () => {
                                server.style.display = 'none'; // Скрыть сервер после завершения анимации
                            }, { once: true });

                            // Показываем аватар и input-container
                            avatarContainer.classList.remove('hidden');
                            inputContainer.classList.remove('hidden');

                            isServerOpen = false; // Устанавливаем состояние сервера в закрытое
                        }
						                function showContent(id) {
                    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
                    document.querySelectorAll('.content').forEach(content => content.classList.remove('active'));

                    document.querySelector(`.menu-item[onclick="showContent('${id}')"]`).classList.add('active');
                    document.getElementById(id).classList.add('active');
                }
				function showLogoutNotification() {
    const notif = document.getElementById('logout-notification');
    if (!notif) return;

    notif.style.display = 'block';

    // Чтобы сработал transition, добавляем класс с задержкой
    setTimeout(() => {
      notif.classList.add('show');
    }, 10);

    // Через 3 секунды скрываем
    setTimeout(() => {
      notif.classList.remove('show');

      // После анимации прячем полностью
      notif.addEventListener('transitionend', () => {
          notif.style.display = 'none';
      }, { once: true });

    }, 3000);
}

const chatWindow = document.getElementById('chatX_window');
const feed = document.getElementById('chatX_feed');
const burger = document.getElementById('chatX_burger');
const emojiPanel = document.getElementById('emoji_panel');

let startY = 0;
let startHeight = 0;
let startTop = 0;
let resizing = false;
let originalHeight = chatWindow.offsetHeight; // исходная высота чата

// ===== drag & touch для burger =====
function startResize(e) {
    resizing = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startHeight = chatWindow.offsetHeight;
    startTop = chatWindow.offsetTop;
    document.body.style.userSelect = 'none';
}

function doResize(e) {
    if (!resizing) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = clientY - startY;
    let newHeight = startHeight - dy;
    let newTop = startTop + dy;

    if (newHeight < 100) { newTop -= (100 - newHeight); newHeight = 100; }
    if (newHeight > 700) { newTop += (newHeight - 700); newHeight = 700; }

    chatWindow.style.height = newHeight + 'px';
    chatWindow.style.top = newTop + 'px';
    originalHeight = newHeight; // сохраняем текущую высоту
}

function stopResize() {
    resizing = false;
    document.body.style.userSelect = '';
}

burger.addEventListener('mousedown', startResize);
burger.addEventListener('touchstart', startResize, {passive: true});
document.addEventListener('mousemove', doResize);
document.addEventListener('touchmove', doResize, {passive: false});
document.addEventListener('mouseup', stopResize);
document.addEventListener('touchend', stopResize);

// ===== наблюдатель за панелью эмодзи =====
const observer = new MutationObserver(() => {
    const chatHeight = chatWindow.offsetHeight;

    if (emojiPanel.style.display !== 'none') {
        // панель видна → если чат < 300, поднимаем до 300
        if (chatHeight < 300) {
            chatWindow.style.height = '300px';
        }
    } else {
        // панель скрыта → если чат был < 300, возвращаем исходную высоту
        if (chatHeight <= 300) {
            chatWindow.style.height = originalHeight + 'px';
        }
    }
});

// следим за изменением стиля display панели
observer.observe(emojiPanel, { attributes: true, attributeFilter: ['style'] });

document.addEventListener('DOMContentLoaded', () => {
    // Кнопка чата
    document.getElementById('onchat').addEventListener('click', () => {
        chatWindow.style.display = 'flex';
        document.getElementById('onchat').style.display = 'none';
    });

    // Кнопка карты
    document.getElementById('onmap').addEventListener('click', () => {
        document.getElementById('map').style.display = 'block';
        document.getElementById('onmap').style.display = 'none';
    });

    // Кнопка "Pause"
    document.getElementById('freeze').addEventListener('click', function () {
        freeze = false; // предполагаю, это глобальная переменная
        this.style.display = 'none';
    });

    $('.homemenu').on('click', function () {
        $('#overlays').show();
    });
});




const observer = new MutationObserver(() => {
  document.querySelectorAll('.star-container').forEach(container => {
    const levelElem = container.querySelector('.levelme');
    if (!levelElem) return;
    const level = parseInt(levelElem.textContent, 10);
    const star = container.querySelector('.fa-star');
    if (!star) return;
    if (level >= 50) {
      star.classList.add('high-level');
    } else {
      star.classList.remove('high-level');
    }
  });
});
observer.observe(document.body, { childList: true, subtree: true });

        // Получаем элементы канваса и div-элемента overlays
        var canvas = document.getElementById('canvas');
        var overlays = document.getElementById('overlays');

        // Добавляем слушатель события мыши на div-элемент overlays
        overlays.addEventListener('mousemove', function (event) {
            // Получаем позицию курсора относительно overlays
            var x = event.clientX - overlays.offsetLeft;
            var y = event.clientY - overlays.offsetTop;

            // Создаем событие мыши для канваса
            var canvasEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y
            });

            // Передаем событие канвасу
            canvas.dispatchEvent(canvasEvent);
        });



const chatBox = document.getElementById("chat_textbox");
let originalText = "";

// Устанавливаем атрибут для contenteditable
chatBox.setAttribute("contenteditable", "true");

// Обработчик ввода текста
chatBox.addEventListener("input", () => {
    // Получаем чистый текст из содержимого
    originalText = getPlainText(chatBox).trim();

    // Ограничение длины текста
    if (originalText.length > 120) {
        originalText = originalText.slice(0, 120);
        setPlainText(chatBox, originalText); // перезаписываем содержимое
        placeCaretAtEnd(chatBox); // курсор в конец
        return; // дальнейшая обработка не нужна
    }

    // Преобразуем :code: в эмодзи (GIF с fallback на PNG)
    let html = chatBox.innerHTML;
    const newHtml = html.replace(/:([a-zA-Z0-9_]+):/g, (match, p1) => {
        return `<img src="/emoji/${p1}.gif" onerror="this.src='/emoji/${p1}.png'" alt="${p1}" class="chat-emoji">`;
    });

    // Обновляем содержимое только если изменилось
    if (newHtml !== html) {
        // Сохраняем текущую позицию курсора
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        let caretOffset = range ? getCaretOffset(chatBox, range) : null;

        chatBox.innerHTML = newHtml;

        // Восстанавливаем позицию курсора
        if (caretOffset !== null) {
            restoreCaretPosition(chatBox, caretOffset);
        } else {
            placeCaretAtEnd(chatBox);
        }
    }
});

// Обработчик клавиш
chatBox.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault(); // Предотвращаем стандартное поведение

        // если панелька открыта — закрываем её
        const emojiPanel = document.getElementById("emoji_panel");
        if (emojiPanel.classList.contains("active")) {
            emojiPanel.classList.remove("active");
        }

        if (!e.shiftKey) {
            // Отправляем, только если есть текст
            if (originalText.length > 0) {
                sendChat(originalText); // Отправляем исходный текст
                chatBox.innerHTML = ""; // Очищаем поле
                originalText = ""; // Сбрасываем
            }
        } else {
            // Shift+Enter вставляет <br>
            document.execCommand("insertHTML", false, "<br>");
            originalText = getPlainText(chatBox).trim();
        }
    }
});

// Предотвращаем создание лишних <div> при нажатии Enter
chatBox.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertParagraph" && getPlainText(chatBox).trim().length === 0) {
        e.preventDefault(); // Блокируем создание нового <div> при пустом вводе
    }
});

// Получение чистого текста из contenteditable
function getPlainText(element) {
    let text = "";
    for (let node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === "IMG" && node.classList.contains("chat-emoji")) {
                const alt = node.getAttribute("alt");
                text += `:${alt}:`;
            } else if (node.tagName === "BR") {
                text += "\n";
            } else {
                text += getPlainText(node);
            }
        }
    }
    return text;
}

// Установка чистого текста внутрь contenteditable (без форматирования)
function setPlainText(element, text) {
    element.innerText = text;
}

// Получение позиции курсора
function getCaretOffset(element, range) {
    let offset = 0;
    let found = false;

    function traverseNodes(node) {
        if (found) return;

        if (node === range.startContainer) {
            offset += range.startOffset;
            found = true;
            return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
            offset += node.length;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === "IMG" && node.classList.contains("chat-emoji")) {
                offset += 1;
            } else if (node.tagName === "BR") {
                offset += 1;
            } else {
                for (let child of node.childNodes) {
                    traverseNodes(child);
                }
            }
        }
    }

    for (let child of element.childNodes) {
        traverseNodes(child);
    }

    return found ? offset : null;
}

// Восстановление позиции курсора
function restoreCaretPosition(element, offset) {
    element.focus();
    const range = document.createRange();
    let currentOffset = 0;
    let found = false;

    function traverseNodes(node) {
        if (found) return;

        if (node.nodeType === Node.TEXT_NODE) {
            if (currentOffset + node.length >= offset) {
                range.setStart(node, offset - currentOffset);
                range.setEnd(node, offset - currentOffset);
                found = true;
            } else {
                currentOffset += node.length;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === "IMG" && node.classList.contains("chat-emoji")) {
                if (currentOffset + 1 >= offset) {
                    range.setStartAfter(node);
                    range.setEndAfter(node);
                    found = true;
                } else {
                    currentOffset += 1;
                }
            } else if (node.tagName === "BR") {
                if (currentOffset + 1 >= offset) {
                    range.setStartAfter(node);
                    range.setEndAfter(node);
                    found = true;
                } else {
                    currentOffset += 1;
                }
            } else {
                for (let child of node.childNodes) {
                    traverseNodes(child);
                }
            }
        }
    }

    for (let child of element.childNodes) {
        traverseNodes(child);
    }

    if (!found) {
        range.selectNodeContents(element);
        range.collapse(false);
    }

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

// Установка курсора в конец
function placeCaretAtEnd(element) {
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}





const emojiBtn = document.getElementById("emoji_btn");
const emojiPanel = document.getElementById("emoji_panel");
const chatBoxEl = document.getElementById("chat_textbox");
const container = document.getElementById('emojiContainer');

let emojiLoaded = false; // Чтобы панель загружала эмодзи только один раз

// хранилище для счётчиков использования
function getEmojiStats() {
    const raw = document.cookie.replace(/(?:(?:^|.*;\s*)emojiStats\s*\=\s*([^;]*).*$)|^.*$/, "$1");
    return raw ? JSON.parse(raw) : {};
}
function saveEmojiStats(stats) {
    document.cookie = "emojiStats=" + JSON.stringify(stats) + "; path=/; max-age=" + (60*60*24*365);
}

// Переключатель панели
emojiBtn.addEventListener("click", () => {
    emojiPanel.classList.toggle("active");

    // Если эмодзи ещё не загружены, грузим их
    if (!emojiLoaded) {
        loadEmojis();
        emojiLoaded = true;
    }
});

// Вставка текста в contenteditable с сохранением курсора
function insertTextAtCursor(el, text) {
    el.focus();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);

    sel.removeAllRanges();
    sel.addRange(range);

    const event = new Event("input", { bubbles: true });
    el.dispatchEvent(event);
}

// клик по эмодзи
emojiPanel.addEventListener("click", (e) => {
    const item = e.target.closest(".emoji-item");
    if (item) {
        const code = item.dataset.code;
        insertTextAtCursor(chatBoxEl, code);

        // увеличиваем счётчик
        const stats = getEmojiStats();
        stats[code] = (stats[code] || 0) + 1;
        saveEmojiStats(stats);

        // пересортируем
        sortEmojiPanel();
    }
});

// Функция загрузки эмодзи
function loadEmojis() {
    const stats = getEmojiStats();
    for (let i = 1; i <= 290; i++) {
        const gifPath = `/emoji/${i}.gif`;
        const pngPath = `/emoji/${i}.png`;
        checkImageExists(gifPath, (exists) => {
            const finalPath = exists ? gifPath : pngPath;
            checkImageExists(finalPath, (exists2) => {
                if (!exists2) return;
                const item = document.createElement('div');
                item.className = 'emoji-item';
                item.dataset.code = `:${i}:`;
                const img = document.createElement('img');
                img.src = finalPath;
                img.alt = i;
                img.className = 'chat-emoji';
                item.appendChild(img);
                container.appendChild(item);
                sortEmojiPanel();
            });
        });
    }
}

function sortEmojiPanel() {
    const stats = getEmojiStats();
    const items = Array.from(container.children);
    items.sort((a, b) => {
        const ca = stats[a.dataset.code] || 0;
        const cb = stats[b.dataset.code] || 0;
        return cb - ca;
    });
    container.innerHTML = "";
    items.forEach(el => container.appendChild(el));
}

// Проверка существования изображения
function checkImageExists(url, callback) {
    const img = new Image();
    img.onload = () => callback(true);
    img.onerror = () => callback(false);
    img.src = url;
}



