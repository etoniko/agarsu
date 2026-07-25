# Agar.su — Stats (клиент)

Статика для GitHub / клиентского VPS. Данные с **https://api.agar.su:6009**.

API-сервер — в папке **`../statsserver/`** (отдельный VPS).

## Файлы

| Файл | URL |
|------|-----|
| `index.html` | `/stats/` |
| `config.js` | API url |
| `users/index.html` | `/stats/users/?id=5` |

## Nginx

```nginx
location /stats/ {
    alias /var/www/agarsu/stats/;
    index index.html;
}
```

## Профили

ID = номер строки в `pass.txt`. Ссылка: `users/index.html?id=5`

Ники в топе кликабельны → профиль. Кнопка «Копировать ссылку» на странице профиля.
