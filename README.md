# Agar.su client

Клиент https://agar.su — Vite + ES modules.

## Структура

```text
repo-root/
  index.html
  public/photo/      # игровые изображения
  src/
    main.js          # boot
    config/          # servers, endpoints, keybinds
    protocol/        # BinaryReader, opcodes
    net/             # PoW challenge, WebSocket
    game/            # логика игры
    render/          # canvas, hud, skins, leaderboard
    ui/              # lobby, shop, chat, account
    api/ storage/ lib/
    styles/main.css
  .github/workflows/deploy.yml
  CNAME
```

## Команды

```bash
npm install
npm run dev
npm run build
```

## Проверено

- Boot, `startGame` / `spectate`
- Вход на FFA, WebSocket `wss://ffa.agar.su`, пакеты rx/tx
- Движение мыши по canvas
