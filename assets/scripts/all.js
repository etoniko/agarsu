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

let startY = 0;
let startHeight = 0;
let startTop = 0;
let resizing = false;

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

    if (newHeight < 100) { newTop -= (100-newHeight); newHeight = 100; }
    if (newHeight > 700) { newTop += (newHeight-700); newHeight = 700; }

    chatWindow.style.height = newHeight + 'px';
    chatWindow.style.top = newTop + 'px';
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


document.addEventListener('DOMContentLoaded', () => {
  // Кнопка чата
  document.getElementById('onchat').addEventListener('click', () => {
    document.getElementById('chatX_window').style.display = 'flex';
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

    // Сброс классов и цвета
    star.classList.remove('high-level', 'ultra-level');
    levelElem.style.color = '';

    if (level >= 70) {
      star.classList.add('ultra-level'); // можно оставить для визуального эффекта
      levelElem.style.color = 'gold';
    } else if (level >= 50) {
      star.classList.add('high-level');
    }
  });
});

// Запуск наблюдателя
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

$('#closeStats').on('click', function() {
   document.getElementById('statics').style.display = 'none';
    $('#overlays').show();    // показать overlays
});

const chatFeed = document.getElementById('chatX_feed');
const leaderboard = document.getElementById('leaderboard');
const chatInput = document.getElementById('chat_textbox');

// Общая функция для вставки ника в чат
function insertNick(nick) {
    if (nick.endsWith(':')) nick = nick.slice(0, -1); // убираем двоеточие
    chatInput.value = nick + ' << ';
    chatInput.focus();
    chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
}

// Клик по сообщению в чате
chatFeed.addEventListener('click', function(e) {
    if (e.button !== 0) return; // только левая кнопка
    let msgElem = e.target.closest('.chatX_msg');
    if (!msgElem) return;

    const nickElem = msgElem.querySelector('.chatX_nick');
    if (!nickElem) return;

    insertNick(nickElem.textContent.trim());
});

// Клик по нику в лидерборде
leaderboard.addEventListener('click', function(e) {
    if (e.button !== 0) return;
    let nickElem = e.target.closest('.Lednick span');
    if (!nickElem) return;

    insertNick(nickElem.textContent.trim());
});


document.querySelectorAll('.chatX_msg').forEach(msg => {
    msg.addEventListener('contextmenu', function(e) {
        e.preventDefault(); // отключаем стандартное меню
        const number = msg.querySelector('.chatX_nick').getAttribute('title');
        chatInput.value += `!ls${number} `;
    });
});





