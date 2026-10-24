# Stats UI (GitHub Pages)

Только статика — HTML/JS. Данные игроков в git не хранятся.

| Где | Что |
|-----|-----|
| **agar.su/stats/** | UI (этот каталог) |
| **api.agar.su/stats-api/** | Данные: рейтинги, профили |

## Файлы UI

| Файл | URL |
|------|-----|
| `index.html` | `/stats/` |
| `config.js` | URL API (`STATS_API`) |
| `users/index.html` | `/stats/users/?id=…` |
| `clans/index.html` | `/stats/clans/?id=…` |
| `servers/index.html` | `/stats/servers/#…` |

Страницы запрашивают `https://api.agar.su/stats-api/…` из браузера.

## Профили

Ссылка: `/stats/users/?id=5`
