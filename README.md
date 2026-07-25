# Agar.su client

Клиент https://agar.su — Vite + ES modules (оптимизированная сборка).

## Что сделано

- Один JS-бандл (без code-split чанков)
- Шрифты / Font Awesome / Material Icons / флаг RU — с `/vendor` (без CDN в boot)
- Яндекс Ads и Mail.ru — после старта игры (не блокируют boot)
- Mail.ru Top **не грузится**, если игрок авторизован (`accountToken`)
- В iframe / `?embed=1` — без VK SDK
- Без unpkg

## Команды

```bash
npm install
npm run dev      # http://localhost:5175
npm run build    # → dist/
npm run preview  # http://localhost:4175
```

Embed: `/?embed=1`
