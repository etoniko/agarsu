# agar.su

| Host | Role |
|------|------|
| **agar.su** | GitHub Pages — **только статика** (HTML/JS/CSS) |
| **api.agar.su** | VPS — API, pass.txt, skinlist, skins, stats-api |

**Не коммитить на GitHub:** `pass.txt`, `skinlist.txt`, `invisible.txt`, `rotation.txt`, `word.txt`, `allowtxt.txt`, `server/public/`, `NickPass.json`.
Все списки и данные игроков — **только на api.agar.su**.

## Секреты

`NickPass.json` остаётся **только на api.agar.su**. В git и в браузер не попадает.
Клиент читает `pass.txt` (список ников) и публичный `stats-api`.

## Stats

| Слой | Где | Что |
|------|-----|-----|
| UI | `stats/` → GitHub Pages | HTML/JS, без данных игроков |
| API | `server/statsserver/` → api.agar.su | poll, `users/*.json`, `data/` на диске VPS |

1. Игровые сервера отдают `checkStats` на api.
2. `server/statsserver` на VPS копит очки (`users/`, `clans/`, `data/` — **не в git**).
3. Браузер на agar.su/stats/ дергает `https://api.agar.su/stats-api/...`.

## DNS

- `agar.su` / `www.agar.su` → GitHub Pages
- `api.agar.su` → этот VPS (PM2, HTTPS :443)

## Локально / деплoy API

```bash
cd server
npm ci
pm2 start ecosystem.config.cjs
```

Node слушает **443 (HTTPS)** и **80 (редirect → HTTPS)** напрямую, без nginx.
SSL: `/etc/letsencrypt/live/api.agar.su/`.
