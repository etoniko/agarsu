function showContent(id) {
                    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
                    document.querySelectorAll('.content').forEach(content => content.classList.remove('active'));

                    document.querySelector(`.menu-item[onclick="showContent('${id}')"]`).classList.add('active');
                    document.getElementById(id).classList.add('active');
                    if (typeof updateShopAuthNotice === 'function') updateShopAuthNotice();
                    if (id === 'skinslist' && typeof initSkinsGallery === 'function') initSkinsGallery();
                }

function updateAccountMenuLabel() {
  const label = document.getElementById('accountMenuLabel');
  if (!label) return;
  label.textContent = localStorage.accountToken ? 'ЛК' : 'Войти';
}

function showLogoutNotification() {
    const notif = document.getElementById('logout-notification');
    if (!notif) return;

    notif.style.display = 'block';

    setTimeout(() => {
      notif.classList.add('show');
    }, 10);

    setTimeout(() => {
      notif.classList.remove('show');

      notif.addEventListener('transitionend', () => {
          notif.style.display = 'none';
      }, { once: true });

    }, 3000);
}

const chatWindow = document.getElementById('chatX_window');
const chatContainer = document.getElementById('chatX_container');
const chatBurger = document.getElementById('chatX_burger');
const CHAT_SIZE_KEY = 'chatX_size_v1';
const CHAT_MIN_W = 220;
const CHAT_MAX_W = 520;
const CHAT_MIN_H = 120;

function chatMaxHeight() {
    return Math.min(720, Math.floor(window.innerHeight * 0.85));
}

function applyChatSize(width, height, save) {
    if (!chatWindow) return;
    const w = Math.max(CHAT_MIN_W, Math.min(CHAT_MAX_W, width));
    const h = Math.max(CHAT_MIN_H, Math.min(chatMaxHeight(), height));
    chatWindow.style.width = w + 'px';
    chatWindow.style.height = h + 'px';
    if (save !== false) {
        localStorage.setItem(CHAT_SIZE_KEY, JSON.stringify({ w, h }));
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
    if (!chatWindow || chatWindow.style.display === 'none') return false;
    const rect = chatWindow.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top && clientY <= rect.bottom;
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
    document.body.style.userSelect = 'none';
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
    document.body.style.userSelect = '';
}

if (chatBurger) {
    chatBurger.addEventListener('mousedown', startChatResize);
    chatBurger.addEventListener('touchstart', startChatResize, { passive: false });
}
document.addEventListener('mousemove', doChatResize);
document.addEventListener('touchmove', doChatResize, { passive: false });
document.addEventListener('mouseup', stopChatResize);
document.addEventListener('touchend', stopChatResize);

document.addEventListener('wheel', (e) => {
    if (!isPointerOverChat(e.clientX, e.clientY) || !chatContainer) return;
    if (chatContainer.scrollHeight <= chatContainer.clientHeight) return;
    chatContainer.scrollTop += e.deltaY;
    e.preventDefault();
}, { passive: false });

loadChatSize();

document.addEventListener('DOMContentLoaded', () => {
  updateAccountMenuLabel();
  loadChatSize();

  document.getElementById('onchat').addEventListener('click', () => {
    document.getElementById('chatX_window').style.display = 'flex';
    document.getElementById('onchat').style.display = 'none';
  });

  document.getElementById('onmap').addEventListener('click', () => {
    document.getElementById('map').style.display = 'block';
    document.getElementById('onmap').style.display = 'none';
  });

  document.getElementById('onleaderboard').addEventListener('click', () => {
    document.getElementById('leaderboard').style.display = 'block';
    document.getElementById('onleaderboard').style.display = 'none';
  });

  document.getElementById('freeze').addEventListener('click', function () {
    freeze = false;
    this.style.display = 'none';
  });
  $('.homemenu').on('click', function () {
    $('#overlays').show();
  });
});

        var canvas = document.getElementById('canvas');
        var overlays = document.getElementById('overlays');

        overlays.addEventListener('mousemove', function (event) {
            var x = event.clientX - overlays.offsetLeft;
            var y = event.clientY - overlays.offsetTop;

            var canvasEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y
            });

            canvas.dispatchEvent(canvasEvent);
        });

$('#closeStats').on('click', function() {
   document.getElementById('statics').style.display = 'none';
    $('#overlays').show();
});

const chatFeed = document.getElementById('chatX_feed');
const leaderboard = document.getElementById('leaderboard');
const chatInput = document.getElementById('chat_textbox');

function insertNick(nick) {
  nick = nick.trim().replace(/\s+/g, '\u00A0');
  if (nick.endsWith(':')) nick = nick.slice(0, -1);
  chatInput.value = '@' + nick + ' ';
  chatInput.focus();
  chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
}

chatFeed.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    const msgElem = e.target.closest('.chatX_msg');
    if (!msgElem) return;
    const nickElem = msgElem.querySelector('.chatX_nick');
    if (!nickElem) return;
    insertNick(nickElem.textContent);
});

leaderboard.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    const nickElem = e.target.closest('.Lednick span');
    if (!nickElem) return;
    insertNick(nickElem.textContent);
});

document.getElementById('emoji_toggle').addEventListener('click', () => {
  const list = document.querySelector('#chatX_window .emoji-list');
  list.style.display = (list.style.display === 'flex') ? 'none' : 'flex';
});

document.querySelector('#chatX_window .emoji-list').addEventListener('click', (e) => {
  const emojiItem = e.target.closest('.emoji-item');
  if (!emojiItem) return;

  const emojiCode = emojiItem.dataset.code;
  const chatBox = document.getElementById('chat_textbox');

  chatBox.value += emojiCode;
});
