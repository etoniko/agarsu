// Проверка доступности изображения
function validateAvatar(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(url); // аватарка загрузилась
        img.onerror = () => resolve('/skins/4.png'); // ошибка → дефолт
        img.src = url;
    });
}

// Функция вычисления уровня из XP
const getLevel = xp => ~~((xp / 100 * 2) ** 0.5);

// Отображение топ-100
async function xpStats(xstats) {
    const container = document.getElementById('table-container');
    container.innerHTML = '';

    // Проверяем все аватарки параллельно
    const validatedAvatars = await Promise.all(
        xstats.map(player => validateAvatar(player.account_avatar))
    );

    // Строим список игроков
    xstats.forEach((player, i) => {
        const level = getLevel(player.xp);
        const avatar = validatedAvatars[i];

        const playerDiv = document.createElement('div');
        playerDiv.classList.add('top-player');
        playerDiv.innerHTML = `
<div class="time">${player.position}</div> 
<div class="rank">${player.uid}</div> 
<div class="nick">${player.account_name}</div> 
<div class="score">${level}</div> 
<div class="skkinn" style="background-image: url('${avatar}');"></div>
        `;
        container.appendChild(playerDiv);
    });
}

// Получение данных с сервера
async function fetchTop100() {
    try {
        const res = await fetch('https://pmori.ru:6003/api/top100');
        const data = await res.json();
        xpStats(data);
    } catch (err) {
        console.error('Error fetching top 100:', err);
    }
}

fetchTop100();
