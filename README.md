# Agar.su client (`agarsu`)

Клиент https://agar.su — Vite + ES modules.

> Папка называется **`agarsu`** латиницей: Vite 6 ломает `build` на кириллическом пути (`агарсу`).

## Структура

```
agarsu/
  index.html
  public/photo/      # игровые изображения
  src/
    main.js          # boot
    config/          # servers, endpoints, keybinds
    protocol/        # BinaryReader, opcodes
    net/             # PoW challenge, WebSocket
    game/            # engine (логика игры)
    render/          # skins, hud
    ui/              # lobby, shop, skins, account, ratings
    api/ storage/ lib/
    styles/main.css
  dist/              # npm run build → деплой на GitHub Pages / agar.su
```

## Команды

```bash
cd agarsu
npm install
npm run dev      # http://localhost:5174
npm run build    # → dist/
```

## Проверено

- Boot, `startGame` / `spectate`
- Вход на FFA, WebSocket `wss://ffa.agar.su`, пакеты rx/tx
- Движение мыши по canvas
