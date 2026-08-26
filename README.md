# agar.su

| Host | Role |
|------|------|
| **agar.su** | GitHub Pages — статический клиент |
| **api.agar.su** | VPS — API, skins, pass.txt, stats-api |

## Секреты

`NickPass.json` остаётся **только на api.agar.su**. В git и в браузер не попадает.
Клиент читает `pass.txt` (список ников) и публичный `stats-api`.

## Stats

1. Игровые сервера отдают `checkStats` на api.
2. `server/statsserver` копит очки на диске API.
3. Статика на Pages дергает `https://api.agar.su/stats-api/...`.

## DNS

- `agar.su` / `www.agar.su` → GitHub Pages
- `api.agar.su` → этот VPS (`deploy/nginx-api.agar.su.conf`)

## Локально / деплой API

```bash
cd server
npm ci
# NickPass.json, payment.json, id.json — только на сервере, не из git
pm2 restart agar-app
```
