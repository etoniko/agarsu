const getLevel = xp => ~~((xp / 100 * 2) ** 0.5);

function xpStats(xstats) {
    const container = document.getElementById('table-container');
    container.innerHTML = ''; // Clear container

    xstats.forEach(player => {
        // Validate avatar URL; use fallback if invalid or empty
        const avatar = isValidUrl(player.account_avatar) && player.account_avatar.trim() !== '' 
            ? player.account_avatar 
            : '/skins/4.png';

        const playerDiv = document.createElement('div');
        playerDiv.classList.add('top-player');
        playerDiv.innerHTML = `
            <div class="time">${player.position}</div> 
            <div class="rank">${player.uid}</div> 
            <div class="nick">${player.account_name}</div> 
            <div class="score">${getLevel(player.xp)}</div> 
            <div class="skkinn"><img src="${avatar}" alt="Player avatar" /></div>
        `;
        container.appendChild(playerDiv);

        // Add event listener for image error after appending to DOM
        const img = playerDiv.querySelector('img');
        img.onerror = () => {
            img.src = '/skins/4.png'; // Fallback image
        };
    });
}

// Helper function to validate URL
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

async function fetchTop100() {
    try {
        const res = await fetch('https://pmori.ru:6003/api/top100');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        xpStats(data);
    } catch (err) {
        console.error('Error fetching top 100:', err);
    }
}

fetchTop100();
