        // Функция вычисления уровня из XP
        const getLevel = xp => ~~((xp / 100 * 2) ** 0.5);

        // Отображение топ-100
        function xpStats(xstats) {
            const container = document.getElementById('table-container');
            container.innerHTML = '';

            xstats.forEach(player => {
                const level = getLevel(player.xp);

                const playerDiv = document.createElement('div');
                playerDiv.classList.add('top-player');
                playerDiv.innerHTML = `
<div class="time">${player.position}</div> 
<div class="rank">${player.uid}</div> 
<div class="nick">${player.account_name}</div> 
<div class="score">${level}</div> 
<div class="skkinn" style="background-image: url('${player.account_avatar}');"></div>
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
