// Переменные для отслеживания действий
let lastActionTime = 0;
const actionInterval = 500;
let actionTimeout;
let currentIndex = 0;

const MANUAL_SKINS_NICKS = ["Ленин","Сталин","Гагарин","Жуков","Хрущёв","CССР","Путин","Россия"];

const SKINS_PER_PAGE_MOBILE = 8;  /* 2×4 */
const SKINS_PER_PAGE_DESKTOP = 15; /* 5×3 */
let skinsGalleryItems = [];
let skinsGalleryPage = 1;
let skinsGalleryPerPage = SKINS_PER_PAGE_DESKTOP;
let skinsGalleryLoading = false;
let skinsGalleryLoaded = false;
let skinsGalleryResizeBound = false;
let cachedSkinsMap = null;
let cachedSkinsMapAt = 0;
const SKINS_MAP_TTL = 60000;

function getSkinExt(skinId) {
    return /anim/i.test(String(skinId || '')) ? 'gif' : 'png';
}

function getSkinPreviewUrl(skinId) {
    return skinId ? `https://api.agar.su/skins/${skinId}.${getSkinExt(skinId)}` : '';
}

function setBackgroundImageIfChanged(el, skinId) {
    if (!el) return;
    const url = getSkinPreviewUrl(skinId);
    const next = url ? `url(${url})` : '';
    if (el.dataset.bgSrc === next) return;
    el.dataset.bgSrc = next;
    el.style.backgroundImage = next;
}

function getSkinsGalleryPerPage() {
    return window.matchMedia('(max-width: 599px)').matches
        ? SKINS_PER_PAGE_MOBILE
        : SKINS_PER_PAGE_DESKTOP;
}

function bindSkinsGalleryResize() {
    if (skinsGalleryResizeBound) return;
    skinsGalleryResizeBound = true;
    let lastPerPage = getSkinsGalleryPerPage();
    window.addEventListener('resize', () => {
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
    // Загружаем skinlist.txt для получения ID по никам
    const skinRes = await fetch('https://api.agar.su/skinlist.txt');
    if (!skinRes.ok) throw new Error('skinlist');
    const skinText = await skinRes.text();
    
    // Создаём мапу ник -> код
    const skinMap = new Map();
    skinText.split('\n').forEach((line) => {
        const idx = line.indexOf(':');
        if (idx < 0) return;
        const nick = line.slice(0, idx).trim();
        const code = line.slice(idx + 1).trim();
        if (nick && code) {
            skinMap.set(nick.toLowerCase(), code);
        }
    });
    
    // Собираем галерею только из ручного списка ников
    const items = [];
    for (const nick of MANUAL_SKINS_NICKS) {
        const code = skinMap.get(nick.toLowerCase());
        if (code) {
            items.push({ nick: nick, code: code });
        }
    }
    
    skinsGalleryItems = items;
    skinsGalleryLoaded = true;
}

function setSkinsGalleryStatus(text, isError) {
    const el = document.getElementById('skinsGalleryStatus');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-error', !!isError);
}

function renderSkinsGalleryPagination(totalPages, pagination) {
    pagination.innerHTML = '';
    if (totalPages <= 1) return;

    const addBtn = (label, p, extraClass) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.className = extraClass || 'page-num';
        if (p === skinsGalleryPage) btn.classList.add('active');
        if (p != null) {
            btn.addEventListener('click', () => renderSkinsGalleryPage(p));
        } else {
            btn.disabled = true;
        }
        pagination.appendChild(btn);
    };

    if (skinsGalleryPage > 1) {
        addBtn('‹', skinsGalleryPage - 1, 'page-nav');
    }

    const windowSize = 5;
    let start = Math.max(1, skinsGalleryPage - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);

    for (let i = start; i <= end; i++) {
        addBtn(String(i), i, 'page-num');
    }

    if (skinsGalleryPage < totalPages) {
        addBtn('›', skinsGalleryPage + 1, 'page-nav');
    }
}

function renderSkinsGalleryPage(page) {
    const grid = document.getElementById('skinsGalleryGrid');
    const pagination = document.getElementById('skinsGalleryPagination');
    if (!grid || !pagination) return;

    skinsGalleryPerPage = getSkinsGalleryPerPage();
    bindSkinsGalleryResize();
    grid.setAttribute('data-per-page', String(skinsGalleryPerPage));

    grid.innerHTML = '';
    const totalPages = Math.max(1, Math.ceil(skinsGalleryItems.length / skinsGalleryPerPage));
    skinsGalleryPage = Math.min(Math.max(1, page), totalPages);

    const start = (skinsGalleryPage - 1) * skinsGalleryPerPage;
    const pageSkins = skinsGalleryItems.slice(start, start + skinsGalleryPerPage);

    pageSkins.forEach((skin) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'skins-gallery-card';
        card.innerHTML = `
            <img src="https://api.agar.su/skins/${skin.code}.${getSkinExt(skin.code)}" alt="" loading="lazy">
            <h4>${escapeHtml(skin.nick)}</h4>
        `;
        card.addEventListener('click', async () => {
            await selectSkin(skin.nick);
            showContent('home');
        });
        grid.appendChild(card);
    });

    renderSkinsGalleryPagination(totalPages, pagination);

    if (!skinsGalleryItems.length) {
        setSkinsGalleryStatus('Нет скинов. Добавьте ники в MANUAL_SKINS_NICKS', false);
    } else if (totalPages <= 1) {
        setSkinsGalleryStatus(`${skinsGalleryItems.length} скинов`, false);
    } else {
        setSkinsGalleryStatus(
            `${skinsGalleryItems.length} · ${skinsGalleryPage} / ${totalPages}`,
            false
        );
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function initSkinsGallery() {
    const grid = document.getElementById('skinsGalleryGrid');
    if (!grid || skinsGalleryLoading) return;

    if (skinsGalleryLoaded && skinsGalleryItems.length) {
        renderSkinsGalleryPage(skinsGalleryPage);
        return;
    }

    skinsGalleryLoading = true;
    setSkinsGalleryStatus('Загрузка…');
    grid.innerHTML = '';

    try {
        await loadSkinsGalleryData();
        renderSkinsGalleryPage(1);
    } catch (e) {
        console.error('Галерея скинов:', e);
        setSkinsGalleryStatus('Не удалось загрузить галерею. Попробуйте позже.', true);
    } finally {
        skinsGalleryLoading = false;
    }
}

// Функция загрузки списка скинов
async function loadSkinsList(force) {
    if (!force && cachedSkinsMap && Date.now() - cachedSkinsMapAt < SKINS_MAP_TTL) {
        return cachedSkinsMap;
    }
    const response = await fetch('https://api.agar.su/skinlist.txt');
    const data = await response.text();
    const skinsMap = new Map();

    data.split('\n').forEach((line) => {
        const [nick, id] = line.split(':');
        if (nick && id) skinsMap.set(normalizeNick(nick), id.trim());
    });
    cachedSkinsMap = skinsMap;
    cachedSkinsMapAt = Date.now();
    return skinsMap;
}

function normalizeNick(nick) {
    if (!nick) return '';

    let n = nick.trim();

    if (n.startsWith('[')) {
        const endIndex = n.indexOf(']');
        if (endIndex === -1) return '';

        const innerNick = n.substring(1, endIndex).trim();
        if (!innerNick || innerNick !== n.substring(1, endIndex)) return '';

        return `[${innerNick}]`.toLowerCase();
    }
    if (!n || n.trim() !== n) return '';
    return n.toLowerCase();
}

async function selectSkin(nick) {
    const skinsMap = await loadSkinsList();
    const normalizedNick = normalizeNick(nick);

    if (skinsMap.has(normalizedNick)) {
        const id = skinsMap.get(normalizedNick);
        savePlayerData(nick, id);
        currentIndex = getCurrentPlayerIndex(nick);
        updateAvatarDisplay();
    } else {
        const skinss = document.querySelector('#skinss');
        if (skinss) setBackgroundImageIfChanged(skinss, '');
    }
}

function getCurrentPlayerIndex(nick) {
    const players = JSON.parse(localStorage.getItem('players') || '[]');
    return players.findIndex((player) => normalizeNick(player.nick) === normalizeNick(nick));
}

function savePlayerData(nick, id) {
    const players = JSON.parse(localStorage.getItem('players') || '[]');
    const playerData = { nick, id };

    const index = players.findIndex((player) => normalizeNick(player.nick) === normalizeNick(nick));
    if (index !== -1) players.splice(index, 1);

    players.unshift(playerData);

    if (players.length > 3) players.pop();

    localStorage.setItem('players', JSON.stringify(players));
}

function updateAvatarDisplay() {
    const players = JSON.parse(localStorage.getItem('players') || '[]');
    const mainSkin = document.querySelector('#skinss');
    const previousSkin = document.querySelector('#prevSkin');
    const nextSkin = document.querySelector('#nextSkin');
    if (!mainSkin) return;

    if (players.length > 0) {
        const currentPlayer = players[currentIndex];
        setBackgroundImageIfChanged(mainSkin, currentPlayer.id);
        const nickInput = document.getElementById('nick');
        if (nickInput) nickInput.value = currentPlayer.nick;

        const prevIndex = (currentIndex - 1 + players.length) % players.length;
        if (previousSkin && players[prevIndex]) {
            setBackgroundImageIfChanged(previousSkin, players[prevIndex].id);
        } else if (previousSkin) {
            setBackgroundImageIfChanged(previousSkin, '');
        }

        const nextIndex = (currentIndex + 1) % players.length;
        if (nextSkin && players[nextIndex]) {
            setBackgroundImageIfChanged(nextSkin, players[nextIndex].id);
        } else if (nextSkin) {
            setBackgroundImageIfChanged(nextSkin, '');
        }
    } else {
        setBackgroundImageIfChanged(mainSkin, '');
        setBackgroundImageIfChanged(previousSkin, '');
        setBackgroundImageIfChanged(nextSkin, '');
    }
}

function showNext() {
    const players = JSON.parse(localStorage.getItem('players') || '[]');
    if (players.length > 0) {
        currentIndex = (currentIndex + 1) % players.length;
        changeSkin();
    }
}

function showPrevious() {
    const players = JSON.parse(localStorage.getItem('players') || '[]');
    if (players.length > 0) {
        currentIndex = (currentIndex - 1 + players.length) % players.length;
        changeSkin();
    }
}

function changeSkin() {
    const mainSkin = document.querySelector('#skinss');
    if (!mainSkin) return;
    mainSkin.classList.add('scale-down');
    setTimeout(() => {
        updateAvatarDisplay();
        mainSkin.classList.remove('scale-down');
    }, 50);
}

document.addEventListener('DOMContentLoaded', () => {
    const nickInput = document.getElementById('nick');
    if (nickInput) {
        nickInput.addEventListener('input', function () {
            const nickname = this.value;
            clearTimeout(actionTimeout);
            actionTimeout = setTimeout(async () => {
                await selectSkin(nickname);
            }, actionInterval);
        });
    }

    const players = JSON.parse(localStorage.getItem('players') || '[]');
    if (players.length > 0) {
        currentIndex = 0;
        updateAvatarDisplay();
    }
});
