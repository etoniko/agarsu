import { parseFullNick } from "../utils/nick.js";
import { getSkinUrl } from "../config/constants.js";

const API_BASE = "https://api.agar.su/api/";

export class AccountService {
    constructor(core) {
        this.core = core;
        this.data = null;
    }

    init() {
        window.onGoogleAuth = response => this.onGoogleAuth(response);
        window.openTelegramAuth = () => this.openTelegramAuth();
        window.logoutAccount = () => this.logout();

        window.addEventListener("message", event => {
            if (event.origin !== "https://agar.su") return;
            if (event.data?.type === "telegram-auth") {
                this.handleLogin(event.data.user, "telegram");
            }
        });

        if (localStorage.accountToken) {
            this.loadAccountUserData();
        }
    }

    get token() {
        return localStorage.accountToken || "";
    }

    setToken(token) {
        localStorage.accountToken = token;
    }

    clearToken() {
        localStorage.removeItem("accountToken");
    }

    async api(tag, method = "GET", body = null) {
        const headers = {};
        if (this.token) headers.Authorization = `Game ${this.token}`;
        if (body) headers["Content-Type"] = "application/json";
        const res = await fetch(API_BASE + tag, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });
        return res;
    }

    openTelegramAuth() {
        window.open("https://agar.su/telegram/", "tgAuth", "width=400,height=200");
    }

    onGoogleAuth(response) {
        this.handleLogin(response.credential, "google");
    }

    async handleLogin(tokenOrUser, provider) {
        let url;
        let options;
        if (provider === "telegram") {
            url = API_BASE + "auth/telegram";
            options = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(tokenOrUser)
            };
        } else {
            url = API_BASE + "auth/google";
            options = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential: tokenOrUser })
            };
        }

        try {
            const res = await fetch(url, options);
            const data = await res.json();
            if (data.error) {
                alert(data.error);
                return;
            }
            this.onAccountLoggedIn(data.token);
        } catch (error) {
            console.error("Login error:", error);
        }
    }

    onAccountLoggedIn(token) {
        this.setToken(token);
        this.loadAccountUserData();
        this.loadMyNicknames();
        this.core.net?.sendAccountToken();
    }

    async loadAccountUserData() {
        if (!this.token) return;

        try {
            const res = await this.api("me/login");
            if (!res.ok) return;

            const data = await res.json();
            if (data.error) {
                if (data.status === 401) this.clearToken();
                else alert(data.error);
                this.onLogout();
                return;
            }

            this.setAccountData(data);
        } catch (error) {
            console.error("Account load error:", error);
        }
    }

    setAccountData(data) {
        this.data = data;
        this.core.account.xp = data.xp ?? 0;
        this.core.account.uid = data.uid ?? "";
        this.core.ui?.updateAccountPanel?.();
        this.core.ui?.updateXpDisplay?.();
        this.loadMyNicknames();
    }

    async loadMyNicknames() {
        const ui = this.core.ui;
        if (!ui?.renderAccountNicknames) return;
        if (!this.token) {
            ui.renderAccountNicknames(null);
            return;
        }

        try {
            const res = await this.api("me/nicknames");
            if (!res.ok) {
                if (res.status === 401) {
                    this.clearToken();
                    this.onLogout();
                }
                return;
            }
            const data = await res.json();
            ui.renderAccountNicknames(data);
        } catch (error) {
            console.error("Nicknames load error:", error);
        }
    }

    async logout() {
        if (this.token) {
            try {
                const res = await this.api("me/logout");
                if (res.ok) {
                    const data = await res.json();
                    if (data.ok || data.status === 401) this.onLogout();
                    if (data.error) alert(data.error);
                    return;
                }
            } catch (error) {
                console.error("Logout error:", error);
            }
        }
        this.onLogout();
    }

    onLogout() {
        this.data = null;
        this.clearToken();
        this.core.account.xp = 0;
        this.core.account.uid = "";
        this.core.ui?.updateAccountPanel?.();
        this.core.ui?.renderAccountNicknames?.(null);
    }

    updateXp(xp) {
        if (!this.data) return;
        this.data.xp = xp;
        this.core.account.xp = xp;
        this.core.ui?.updateXpDisplay?.();
    }

    getSkinUrlForNick(nickname) {
        const code = this.core.skins?.getCodeForName(nickname);
        return code ? getSkinUrl(code) : null;
    }

    selectNickname(fullNick) {
        const { nickPart, pass } = parseFullNick(fullNick);
        const ui = this.core.ui;
        if (ui?.nameInput) ui.nameInput.value = nickPart;
        if (ui?.passInput) {
            ui.passInput.value = pass;
            ui.updatePassFieldVisibility?.();
        }
        this.core.store.name = nickPart;
        this.core.store.pass = pass;
        this.core.ui?.updateSkinPreview?.();
    }

    static makePasswordBox(pass) {
        const wrap = document.createElement("div");
        wrap.className = "passbox";
        const input = document.createElement("input");
        input.type = "password";
        input.value = pass || "";
        input.readOnly = true;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "icon-btn";
        btn.textContent = "👁";
        btn.onclick = () => {
            input.type = input.type === "password" ? "text" : "password";
        };
        wrap.append(input, btn);
        return wrap;
    }

    renderCard(list, fullNick) {
        const { str, nickPart, pass, hasClan, cleanNick } = parseFullNick(fullNick);
        const label = hasClan ? nickPart : (nickPart || "?");

        const li = document.createElement("li");
        const skinUrl = this.getSkinUrlForNick(cleanNick);

        const avatar = skinUrl
            ? Object.assign(document.createElement("img"), { className: "skin", src: skinUrl, loading: "lazy" })
            : Object.assign(document.createElement("div"), {
                className: "skin skin--empty",
                textContent: label.charAt(0).toUpperCase()
            });

        const name = document.createElement("div");
        name.className = "nick";
        name.textContent = label;
        name.onclick = () => this.selectNickname(str);

        li.append(avatar, name, AccountService.makePasswordBox(pass));
        list.appendChild(li);
    }
}
