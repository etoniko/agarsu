const DEFAULT_AVATAR = '/skins/4.png';

// Функция вычисления уровня из XP
const getLevel = xp => ~~((xp / 100 * 2) ** 0.5);

// Проверка ссылки на изображение
function checkImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => resolve(DEFAULT_AVATAR);
        img.src = url;
    });
}

// Отображение топ-100
async function xpStats(xstats) {
    const container = document.getElementById('table-container');
    container.innerHTML = '';

    for (const player of xstats) {
        const level = getLevel(player.xp);
        const avatarUrl = (player.account_avatar && player.account_avatar.trim()) 
            ? player.account_avatar 
            : DEFAULT_AVATAR;

        const validAvatar = await checkImage(avatarUrl);

        const playerDiv = document.createElement('div');
        playerDiv.classList.add('top-player');
        playerDiv.innerHTML = `
<div class="time">${player.position}</div> 
<div class="rank">${player.uid}</div> 
<div class="nick">${player.account_name}</div> 
<div class="score">${level}</div> 
<div class="skkinn" style="background-image:url('${validAvatar}');"></div>
        `;
        container.appendChild(playerDiv);
    }
}

// Получение данных с сервера
async function fetchTop100() {
    try {
        const res = await fetch('https://pmori.ru:6003/api/top100', { cache: 'no-store' });
        const data = await res.json();
        xpStats(data);
    } catch (err) {
        console.error('Error fetching top 100:', err);
    }
}

fetchTop100();
