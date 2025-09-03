// Проверка аватарки с fallback
function validateAvatar(url) {
    return new Promise(resolve => {
        if (!url) return resolve('/skins/4.png'); // стандартная аватарка

        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => resolve('/skins/4.png');
        img.src = url;
    });
}

// Отображение топ-100 с параллельной проверкой аватарок
async function xpStats(xstats) {
    const container = document.getElementById('table-container');
    container.innerHTML = '';

    // Проверяем все аватарки параллельно
    const avatars = await Promise.all(xstats.map(player => validateAvatar(player.account_avatar)));

    xstats.forEach((player, i) => {
        const level = getLevel(player.xp);
        const avatar = avatars[i];

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

        await xpStats(data); // рендерим топ-100
    } catch (err) {
        console.error('Error fetching top 100:', err);
    }
}

fetchTop100();
