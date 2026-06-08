(function () {
    const LIST_FETCH_OPTS = { cache: 'no-store' };
    let allowedNicks = new Set();
    let loadPromise = null;

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

    function nickInPassList(nick) {
        const normalized = normalizeNick(nick);
        if (!normalized) return false;
        if (allowedNicks.has(normalized)) return true;
        const clean = normalized.replace(/\[|\]/g, '').trim();
        return allowedNicks.has(clean) || allowedNicks.has(`[${clean}]`);
    }

    function setCookie(name, value, days) {
        let expires = '';
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            expires = '; expires=' + date.toUTCString();
        }
        document.cookie = name + '=' + encodeURIComponent(value || '') + expires + '; path=/';
    }

    function getCookie(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i].trim();
            if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
        }
        return null;
    }

    function getNickInput() {
        return document.getElementById('nick');
    }

    function getPassInput() {
        return document.getElementById('pass');
    }

    function updatePassFieldForNick(nick) {
        const passInput = getPassInput();
        if (!passInput) return;
        passInput.style.display = nickInPassList(nick) ? 'block' : 'none';
    }

    async function loadPassList(force) {
        if (!force && loadPromise) return loadPromise;

        loadPromise = fetch('/pass.txt', LIST_FETCH_OPTS)
            .then((response) => {
                if (!response.ok) throw new Error('Не удалось загрузить pass.txt');
                return response.text();
            })
            .then((data) => {
                allowedNicks = new Set(
                    data
                        .split('\n')
                        .map((line) => normalizeNick(line.trim()))
                        .filter(Boolean)
                );
            })
            .catch((error) => {
                console.error('Ошибка при загрузке pass.txt:', error);
            })
            .finally(() => {
                loadPromise = null;
            });

        await loadPromise;
        return allowedNicks;
    }

    async function refreshPassForCurrentNick(force) {
        await loadPassList(force);
        const nickInput = getNickInput();
        const passInput = getPassInput();
        if (!nickInput || !passInput) return;

        const currentNick = nickInput.value.trim();
        updatePassFieldForNick(currentNick);
    }

    window.reloadPassList = (force) => loadPassList(!!force);
    window.updatePassFieldForNick = updatePassFieldForNick;
    window.refreshPassForCurrentNick = refreshPassForCurrentNick;

    document.addEventListener('DOMContentLoaded', () => {
        const nickInput = getNickInput();
        const passInput = getPassInput();
        if (!nickInput || !passInput) return;

        loadPassList(true).then(() => {
            const savedNick = getCookie('userNick');
            const savedPass = getCookie('userPass');

            if (savedNick) {
                nickInput.value = savedNick;
                updatePassFieldForNick(savedNick);
            }

            if (savedPass) {
                passInput.value = savedPass;
            } else {
                updatePassFieldForNick(nickInput.value.trim());
            }
        });

        let refreshTimer;
        nickInput.addEventListener('input', () => {
            const currentNick = nickInput.value.trim();
            if (currentNick) {
                setCookie('userNick', currentNick, 7);
            } else {
                setCookie('userNick', '', -1);
                passInput.style.display = 'none';
            }

            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => {
                refreshPassForCurrentNick(true);
            }, 300);
        });

        passInput.addEventListener('input', () => {
            const currentPass = passInput.value.trim();
            if (currentPass) {
                setCookie('userPass', currentPass, 7);
            } else {
                setCookie('userPass', '', -1);
            }
        });
    });

    window.addEventListener('agar-lists-updated', () => {
        refreshPassForCurrentNick(true);
    });
})();
