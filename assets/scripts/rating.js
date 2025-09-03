const DEFAULT_AVATAR = '/skins/4.png';

// Функция вычисления уровня из XP
const getLevel = xp => ~~((xp / 100 * 2) ** 0.5);

// Отображение топ-100 (структура как у тебя: .skkinn с background-image)
function xpStats(xstats) {
    const container = document.getElementById('table-container');
    container.innerHTML = '';

    xstats.forEach(player => {
        const level = getLevel(player.xp);

        const playerDiv = document.createElement('div');
        playerDiv.classList.add('top-player');

        // Сразу ставим дефолтный фон — ничего в CSS не меняем
        playerDiv.innerHTML = `
<div class="time">${player.position}</div> 
<div class="rank">${player.uid}</div> 
<div class="nick">${player.account_name}</div> 
<div class="score">${level}</div> 
<div class="skkinn" style="background-image:url('${DEFAULT_AVATAR}');"></div>
        `;

        container.appendChild(playerDiv);

        // Если есть свой аватар — пробуем подгрузить, иначе остаётся дефолт
        const avatarUrl = (player.account_avatar && player.account_avatar.trim()) ? player.account_avatar : DEFAULT_AVATAR;
        if (avatarUrl !== DEFAULT_AVATAR) {
            const img = new Image();
            img.onload = () => {
                playerDiv.querySelector('.skkinn').style.backgroundImage = `url('${avatarUrl}')`;
            };
            img.onerror = () => {
                // на всякий случай оставляем дефолт
                playerDiv.querySelector('.skkinn').style.backgroundImage = `url('${DEFAULT_AVATAR}')`;
            };
            img.src = avatarUrl;
        }
    });
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
