# Stats UI (GitHub Pages)

Только **статика** — HTML/JS. Никаких данных игроков в git.

| Где | Что |
|-----|-----|
| **agar.su/stats/** | UI (этот каталог) |
| **api.agar.su/stats-api/** | Данные: рейтинги, профили, users/*.json на диске VPS |

## Файлы здесь (UI)

| Файл | URL |
|------|-----|
| `index.html` | `/stats/` |
| `config.js` | URL API (`STATS_API`) |
| `users/index.html` | `/stats/users/?id=8&period=alltime` |
| `clans/index.html` | `/stats/clans/?id=…` |
| `servers/index.html` | `/stats/servers/#ffa` |

Страницы делают `fetch('https://api.agar.su/stats-api/...')` из браузера.

## Код stats-сервера (не UI)

Лежит в **`../server/statsserver/`** — деплой только на **api.agar.su**.
Папки `users/`, `clans/`, `data/` создаются на VPS при работе poll — **в git не коммитятся**.

## Профили

ID = номер строки в `pass.txt` на API. Ссылка: `/stats/users/?id=5`
