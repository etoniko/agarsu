export class Captcha {
    constructor({ sitekey, theme = "dark" }) {
        this.sitekey = sitekey;
        this.theme = theme;
        this._widgetId = null;
        this._resolver = null;
        this.token = null;
    }

    // Показать капчу, дождаться токена. После успеха — ПОЛНЫЙ teardown.
    async getToken() {
        await this._loadScriptFresh();  // всегда новая загрузка
        this._ensureHost();
        return new Promise((resolve) => {
            this._resolver = resolve;
            this._render();
        });
    }

    // ---------- private ----------

    _loadScriptFresh() {
        // На всякий случай уберём следы прошлых загрузок перед новой
        this._hardKillTurnstile();

        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            // explicit — сами вызываем render(); добавим cache-buster, чтобы не держались соединения CDNs
            const cb = Date.now().toString(36);
            s.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&_=${cb}`;
            s.async = true; s.defer = true;
            s.onload = resolve;
            s.onerror = () => reject(new Error("Не удалось загрузить Turnstile"));
            document.head.appendChild(s);
        });
    }

    _ensureHost() {
        const ui = document.getElementById("user-interface");
        if (!ui) { console.error("Нет #user-interface"); return; }
        if (getComputedStyle(ui).position === "static") ui.style.position = "relative";

        let wrap = document.getElementById("captcha-wrapper");
        if (!wrap) {
            wrap = document.createElement("div");
            wrap.id = "captcha-wrapper";
            wrap.style.cssText = `
    position:absolute; inset:0; display:grid;
    align-items:center; justify-content:center;
    background:rgba(0,0,0,.6); z-index:99999;`;
            ui.appendChild(wrap);

            const container = document.createElement("div");
            container.id = "captcha-container";
            container.style.cssText = "background:#111;padding:24px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.5);";
            wrap.appendChild(container);
        } else {
            wrap.style.display = "grid";
        }
    }

    _render() {
        const container = document.getElementById("captcha-container");
        if (!container) return;

        // Перестраховка — если был предыдущий widgetId
        if (this._widgetId && window.turnstile) {
            try { window.turnstile.remove(this._widgetId); } catch (_) { }
            this._widgetId = null;
        }

        this._widgetId = window.turnstile.render(container, {
            sitekey: this.sitekey,
            theme: this.theme,
            callback: (token) => this._onSuccess(token),
            "error-callback": () => this._onError("captcha-error"),
            "timeout-callback": () => this._onError("captcha-timeout"),
        });
    }

    _onSuccess(token) {
        this.token = token;

        // Сначала убираем визуальный слой капчи, потом вычищаем всё, что связано с challenges.cloudflare.com
        const wrap = document.getElementById("captcha-wrapper");
        if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);

        this._hardKillTurnstile(); // ← Полный teardown

        if (this._resolver) {
            const resolve = this._resolver;
            this._resolver = null;
            resolve(token);
        }
    }

    _onError(reason) {
        console.warn("Turnstile issue:", reason);
        // В случае ошибки пробуем пересоздать с жёстким teardown
        this._hardKillTurnstile();
        this._loadScriptFresh().then(() => this._ensureHost()).then(() => this._render());
    }

    _hardKillTurnstile() {
        // 1) Удаляем виджет (iframe)
        if (this._widgetId && window.turnstile) {
            try { window.turnstile.remove(this._widgetId); } catch (_) { }
            this._widgetId = null;
        }

        // 2) Удаляем iframe'ы, связанные с challenges.cloudflare.com (перестраховка)
        document.querySelectorAll('iframe[src*="challenges.cloudflare.com"]').forEach(n => {
            if (n.parentNode) n.parentNode.removeChild(n);
        });

        // 3) Удаляем скрипты Turnstile
        document.querySelectorAll('script[src*="challenges.cloudflare.com/turnstile"]').forEach(s => {
            if (s.parentNode) s.parentNode.removeChild(s);
        });

        // 4) Чистим глобальный объект (скрипт при следующем вызове загрузится заново)
        if (window.turnstile) {
            try { delete window.turnstile; } catch (_) { window.turnstile = undefined; }
        }

        // 5) Чистим возможные дополнительные `<link>` или `<img>` на этот домен (редко, но на всякий случай)
        document.querySelectorAll('link[href*="challenges.cloudflare.com"]').forEach(n => n.parentNode && n.parentNode.removeChild(n));
        document.querySelectorAll('img[src*="challenges.cloudflare.com"]').forEach(n => n.parentNode && n.parentNode.removeChild(n));
    }
}
