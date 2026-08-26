# Agar.su — Stats API (api.agar.su:6009)

Сервер для отдельного VPS. Раз в 5 минут опрашивает `/checkStats` на игровых серверах, хранит кэш и отдаёт JSON клиентам.

Фронт лежит в соседней папке **`../stats/`** (другой VPS / GitHub).

## Установка

```bash
cd /opt/statsserver
node server.js
```

Или systemd:

```ini
[Unit]
Description=Agar.su stats API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/statsserver
Environment=STATS_ADMIN_TOKEN=ваш-секрет
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## Файлы

| Файл | Назначение |
|------|------------|
| `server.js` | HTTPS API, опрос серверов |
| `scoring.js` | Очки, дедуп, клан/ник |
| `passlist.js` | pass.txt, id = номер строки |
| `users.js` | Профили `users/{id}/stats.json` |
| `servers.json` | Список серверов, SSL, порт |

Автоматически создаются: `data/`, `users/{id}/`.

## API

| Путь | Описание |
|------|----------|
| `GET /api/rankings` | Топ игроков и кланов |
| `GET /api/user/5` | Профиль (строка 5 в pass.txt) |
| `GET /api/pass/5` | Ник из pass.txt |
| `GET /api/health` | Живость |

CORS: `*`

## pass.txt

Читается с `https://api.agar.su/pass.txt`. ID = номер строки (1, 2, 3…).

`[клан]ник` → очки и рекорды клану. Без клана → нику.

## Очки

Места на доске рекордов **каждого** сервера за выбранный период:

1→25 · 2→15 · 3→10 · 4–10→5 · 11–15→3 · 16–20→2 · 21–100→1

Итоговые очки = сумма мест по серверам. Повторный топ‑1 на том же сервере в том же периоде **не** добавляет очки снова.
