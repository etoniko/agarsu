document.addEventListener('DOMContentLoaded', () => {
    const nickInput = document.getElementById('nick');
    const passInput = document.getElementById('pass');
    let allowedNicks = [];

    // --- Универсальная функция нормализации ника ---
function normalizeNick(nick) {
    if (!nick) return '';

    let n = nick.trim();

    const brackets = { '[': ']', '{': '}', '(': ')', '|': '|' };
    const firstChar = n.charAt(0);
    const lastChar = n.charAt(n.length - 1);

    if (brackets[firstChar]) {
        const closeChar = brackets[firstChar];
        const endIndex = n.indexOf(closeChar, 1);

        // Проверяем, что закрывающая скобка есть и ник внутри не пустой
        if (endIndex === -1) return ''; 

        const innerNick = n.substring(1, endIndex);
        if (!innerNick || innerNick.trim() !== innerNick) return ''; // нет пробелов в начале/конце

        n = innerNick; 
    } else {
        // Ник без скобок: нельзя содержать пробелы в начале/конце
        if (!n || n.trim() !== n) return '';
    }

    return n.toLowerCase();
}

    // --- Работа с cookie ---
    function setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/";
    }

    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i].trim();
            if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
        }
        return null;
    }

    // --- Загрузка списка ников ---
    fetch('pass.txt?v=0.0.1')
        .then(response => {
            if (!response.ok) throw new Error('Не удалось загрузить pass.txt');
            return response.text();
        })
        .then(data => {
            allowedNicks = data.split('\n')
                               .map(n => normalizeNick(n))
                               .filter(n => n !== '');

            const savedNick = getCookie('userNick');
            const savedPass = getCookie('userPass');

            if (savedNick) {
                nickInput.value = savedNick;
                checkNickStatus(savedNick);
            }

            if (savedPass) {
                passInput.value = savedPass;
            }
        })
        .catch(error => {
            console.error('Ошибка при загрузке pass.txt:', error);
        });

    function checkNickStatus(nick) {
        const normalized = normalizeNick(nick);
        if (allowedNicks.includes(normalized)) {
            passInput.style.display = 'block';
        } else {
            passInput.style.display = 'none';
        }
    }

    // --- Сохраняем изменения в полях ---
    nickInput.addEventListener('input', () => {
        const currentNick = nickInput.value.trim();
        if (currentNick) {
            setCookie('userNick', currentNick, 7);
        } else {
            setCookie('userNick', '', -1); // Удалить cookie
            passInput.style.display = 'none';
        }
        checkNickStatus(currentNick);
    });

    passInput.addEventListener('input', () => {
        const currentPass = passInput.value.trim();
        if (currentPass) {
            setCookie('userPass', currentPass, 7);
        } else {
            setCookie('userPass', '', -1); // Удалить cookie
        }
    });
});