function validateAvatar(url) {
    if (!url) return Promise.resolve('/skins/4.png');

    // если картинка уже проверена — вернуть результат из кэша
    if (avatarCache.has(url)) return avatarCache.get(url);

    const promise = new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(url);            // картинка доступна
        img.onerror = () => resolve('/skins/4.png'); // ошибка → дефолт
        img.src = url;
    });

    avatarCache.set(url, promise);
    return promise;
}

async function xpStats(xstats) {
    const container = document.getElementById('table-container');
    container.innerHTML = '';

    // проверяем все аватарки **до вставки в DOM**
    const avatars = await Promise.all(
        xstats.map(player => validateAvatar(player.account_avatar))
    );

    xstats.forEach((player, i) => {
        const level = ~~((player.xp / 100 * 2) ** 0.5);
        const avatar = avatars[i]; // сюда попадёт только рабочий URL

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
