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

    // Кнопка топ лист
  document.getElementById('onleaderboard').addEventListener('click', () => {
    document.getElementById('leaderboard').style.display = 'block';
    document.getElementById('onleaderboard').style.display = 'none';
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
    star.classList.remove('high-level', 'ultra-level', 'old-level');
    levelElem.style.color = '';

    if (level >= 100) {
      star.classList.add('old-level');   // новый класс для 100+
      levelElem.style.color = 'black';   // цвет черный
    } else if (level >= 70) {
      star.classList.add('ultra-level'); // 70-99
      levelElem.style.color = 'gold';
    } else if (level >= 50) {
      star.classList.add('high-level');  // 50-69
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
    chatInput.value = '@'+ nick + ' ';
    chatInput.focus();
    chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
}

// Левый клик по сообщению в чате
chatFeed.addEventListener('click', function(e) {
    if (e.button !== 0) return; // только левая кнопка
    let msgElem = e.target.closest('.chatX_msg');
    if (!msgElem) return;

    const nickElem = msgElem.querySelector('.chatX_nick');
    if (!nickElem) return;

    insertNick(nickElem.textContent.trim());
});

// Левый клик по нику в лидерборде
leaderboard.addEventListener('click', function(e) {
    if (e.button !== 0) return;
    let nickElem = e.target.closest('.Lednick span');
    if (!nickElem) return;

    insertNick(nickElem.textContent.trim());
});



(() => {
  const FPS = 12;
  const FRAME_MS = Math.max(16, Math.floor(1000 / FPS));

  // Глобальное состояние
  const sprites = (window.__chatxSprites ||= new Set());
  let tickerId = null;

  // Наблюдатели
  let io = null;   // IntersectionObserver
  let ro = null;   // ResizeObserver

  // Утилиты
  const parseBgUrl = (val) => {
    if (!val || !val.includes("url(")) return null;
    // выдёргиваем URL из background-image: url("...")/url('...')/url(...)
    return val.replace(/^.*url\(\s*["']?/, "").replace(/["']?\s*\).*/, "");
  };

  const ensureObservers = () => {
    if (!io && "IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const s = e.target.__chatxState;
          if (!s) continue;
          s.visible = e.isIntersecting;
        }
      }, { root: null, rootMargin: "0px", threshold: 0 });
    }
    if (!ro && "ResizeObserver" in window) {
      ro = new ResizeObserver((entries) => {
        for (const e of entries) {
          const el = e.target;
          const s = el.__chatxState;
          if (!s) continue;
          // Пересчитываем ширину шага по текущей высоте виджета
          s.framePx = Math.max(1, Math.round(el.clientHeight || el.offsetHeight || s.framePx));
        }
      });
    }
  };

  const startTickerIfNeeded = () => {
    if (tickerId || sprites.size === 0) return;
    tickerId = setInterval(() => {
      // Если вкладка скрыта — пропускаем тик
      if (document.hidden) return;
      // Быстрый проход: удаляем отвалившиеся
      for (const s of Array.from(sprites)) {
        if (!document.body.contains(s.el)) sprites.delete(s);
      }
      if (sprites.size === 0) {
        stopTicker();
        return;
      }
      // Обновляем только видимые
      for (const s of sprites) {
        if (!s.visible) continue;
        s.frame = (s.frame + 1) % s.frames;
        const x = -(s.frame * s.framePx);
        s.el.style.backgroundPosition = `${x}px 0`;
      }
    }, FRAME_MS);
  };

  const stopTicker = () => {
    if (tickerId) {
      clearInterval(tickerId);
      tickerId = null;
    }
  };

  document.addEventListener("visibilitychange", () => {
    // ничего не делаем — просто пропускаем тики, когда hidden
    // но если вернулись и ничего не осталось — остановим цикл
    if (!document.hidden && sprites.size === 0) stopTicker();
  });

  const finalizeDivSprite = (div, imgWidth, imgHeight, src) => {
    if (!src || imgWidth <= 0 || imgHeight <= 0 || imgWidth <= imgHeight) return;

    // Кол-во кадров и ширина шага
    const frames = Math.max(1, Math.floor(imgWidth / imgHeight));
    const framePx = Math.max(1, Math.round(div.clientHeight || imgHeight));

    // Состояние спрайта
    const state = {
      el: div,
      src,
      frame: 0,
      frames,
      framePx,
      visible: true,
    };

    // Навесить “will-change” для композитинга
    const prevWC = div.style.willChange || "";
    div.style.willChange = prevWC.includes("background-position") ? prevWC : (prevWC ? prevWC + ", background-position" : "background-position");

    // Пометить и сохранить
    div.dataset.spriteified = "1";
    div.__chatxState = state;
    sprites.add(state);

    // Наблюдатели за видимостью и размером
    ensureObservers();
    io && io.observe(div);
    ro && ro.observe(div);

    startTickerIfNeeded();
  };

  const imgToDiv = (imgEl, naturalW, naturalH) => {
    const rect = imgEl.getBoundingClientRect();
    const computed = getComputedStyle(imgEl);
    const widthPx  = rect.width  || parseFloat(computed.width)  || naturalH || 50;
    const heightPx = rect.height || parseFloat(computed.height) || naturalH || 50;

    const div = document.createElement("div");
    div.className = (imgEl.className ? imgEl.className + " " : "") + "anims_animated";
    const inline = imgEl.getAttribute("style");
    if (inline) div.setAttribute("style", inline);

    div.style.backgroundImage = `url("${imgEl.src}")`;
    div.style.backgroundRepeat = "no-repeat";
    div.style.backgroundSize = "auto 100%";
    div.style.backgroundPosition = "0 0";
    div.style.width = Math.round(widthPx) + "px";
    div.style.height = Math.round(heightPx) + "px";
    // если исходный был круглым
    if (!div.style.borderRadius) div.style.borderRadius = "100%";

    imgEl.replaceWith(div);
    return div;
  };

  const makeAnimatedSprite = (el) => {
    if (!el || el.dataset.spriteified === "1") return;

    // Ветка IMG
    if (el.tagName === "IMG") {
      if (!el.complete) {
        el.addEventListener("load", () => makeAnimatedSprite(el), { once: true });
        return;
      }
      const w = el.naturalWidth || 0;
      const h = el.naturalHeight || 0;
      if (w <= h || w === 0 || h === 0) {
        el.dataset.spriteified = "1"; // помечаем, чтобы больше не трогать
        return;
      }
      const div = imgToDiv(el, w, h);
      finalizeDivSprite(div, w, h, div.style.backgroundImage ? parseBgUrl(div.style.backgroundImage) : el.src);
      return;
    }

    // Ветка DIV с background-image
    const style = getComputedStyle(el);
    const bg = style.backgroundImage;
    const src = parseBgUrl(bg);
    if (!src) {
      // Возможно, фон появится позже (через класс). Поставим «ленивую» проверку.
      const once = new MutationObserver((muts, obs) => {
        const nowBg = getComputedStyle(el).backgroundImage;
        const nowSrc = parseBgUrl(nowBg);
        if (nowSrc) {
          obs.disconnect();
          loadImageAndFinalize(el, nowSrc);
        }
      });
      once.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
      return;
    }
    loadImageAndFinalize(el, src);
  };

  const loadImageAndFinalize = (el, src) => {
    const img = new Image();
    img.onload = () => {
      if (img.width > img.height) {
        // убедимся, что это «квадратный кадр в ряд»
        // если элемент ещё не размечен, выставим базовые стили
        if (!el.dataset.spriteified) {
          if (!el.style.backgroundImage) el.style.backgroundImage = `url("${src}")`;
          if (!el.style.backgroundRepeat) el.style.backgroundRepeat = "no-repeat";
          if (!el.style.backgroundSize) el.style.backgroundSize = "auto 100%";
          if (!el.style.backgroundPosition) el.style.backgroundPosition = "0 0";
          if (!el.style.width) el.style.width = (el.clientHeight || img.height || 50) + "px";
          if (!el.style.height) el.style.height = (el.clientHeight || img.height || 50) + "px";
          if (!el.style.borderRadius) el.style.borderRadius = "100%";
        }
        finalizeDivSprite(el, img.width, img.height, src);
      } else {
        el.dataset.spriteified = "1"; // не мультиспрайт — больше не трогаем
      }
    };
    img.onerror = () => {
      el.dataset.spriteified = "1";
    };
    img.src = src;
  };

  // Стартовая инициализация (если элементы появились раньше скрипта)
  const bootstrap = () => {
    document.querySelectorAll(".anims").forEach(makeAnimatedSprite);
  };
  bootstrap();

  // Наблюдение за добавлением новых элементов
  if (!window.__chatxSpriteObserver) {
    window.__chatxSpriteObserver = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n && n.nodeType === 1) {
            if (n.classList?.contains("anims")) makeAnimatedSprite(n);
            // быстрый поиск внутрь только при необходимости
            const inner = n.querySelectorAll?.(".anims");
            if (inner && inner.length) inner.forEach(makeAnimatedSprite);
          }
        }
      }
    });
    window.__chatxSpriteObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  console.log("[chatX sprite] активировано — оптимизированный рендер спрайтов @", FPS, "FPS");
})();










