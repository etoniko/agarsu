import { ModalSystem } from "./ModalSystem.js";

import { getStarClass, MAX_LEVEL_XP, getLevel, getXp } from "../utils/math.js";
import { parseFullNick } from "../utils/nick.js";
import { getSkinUrl } from "../config/constants.js";
import { getPlayName, skinPreviewUrl } from "../utils/player.js";

export class UserInterface {

        constructor(core) {
            this.core = core
            this._minimapActiveCell = null;
            this._minimapHighlightedSpan = null;

            this.modalSystem = new ModalSystem()

            this.mouse = {
                x: 0,
                y: 0
            }

            this.keysPressed = {};
            this.ejectInterval = null;
            this.isTyping = false;

            this.menuOverlay = document.getElementById("menu-overlay");
            this.playButton = document.getElementById("play");
            this.spectateButton = document.getElementById("spectate");
            this.settingsButton = document.getElementById("settings");
            this.nameInput = document.getElementById("name");
            this.passInput = document.getElementById("pass");
            this.skinPreviewBg = document.getElementById("skin-preview-bg");
            this.serversButton = document.getElementById("servers");
            this.serverListEl = document.getElementById("server-list");
            this._selectedServerHost = null;
            this.scoreElement = document.getElementById("score");
            this.fpsElement = document.getElementById("fps");
            this.leaderboard = document.getElementById("leaderboard");
            this.chatField = document.getElementById("chat-field");
            this.chatContent = document.getElementById("chat-content");
            setInterval(() => {
                this.scoreElement.innerHTML = `Score: ${this.core.app.camera.score}`;
                // добавим FPS прямо к Ping
                const fps = this.core.stats?.fps || 0;
                this.fpsElement.innerHTML = `Ping: ${this.core.net.ping} FPS: ${fps.toFixed(0)}`;
            }, 40);
            const storedName = localStorage.getItem("cigar3-name");
            if (this.nameInput) this.nameInput.value = storedName ? storedName.trim() : "";
            if (this.passInput) {
                this.passInput.value = this.core.store.pass || "";
                this.passInput.hidden = true;
            }
            this.addEvents();
            this.initAccountUI();
            this.updateXpDisplay();
        }

        initAfterSkins() {
            this.buildServerList();
            this.updateSkinPreview();
            this.updatePassFieldVisibility();
            this.updateXpDisplay();
        }

        syncStoreFromInputs() {
            if (this.nameInput) {
                this.core.store.name = this.nameInput.value.trim();
            }
            if (this.passInput) this.core.store.pass = this.passInput.value;
        }

        getDisplayNick() {
            return getPlayName(this.nameInput?.value ?? this.core.store.name);
        }

        updateSkinPreview() {
            if (!this.skinPreviewBg) return;
            const url = skinPreviewUrl(this.core.skins, this.nameInput?.value ?? "");
            this.skinPreviewBg.style.backgroundImage = `url("${url}")`;
        }

        updatePassFieldVisibility() {
            if (!this.passInput) return;
            const requires = this.core.passList?.requiresPassword(this.nameInput?.value ?? "");
            if (requires) {
                this.passInput.hidden = false;
            } else {
                this.passInput.hidden = true;
                this.passInput.value = "";
                this.core.store.pass = "";
            }
        }

        isAccountLoggedIn() {
            return !!(this.core.accounts?.data && this.core.accounts.token);
        }

        hideAuthButtons() {
            const tg = document.getElementById("telegramLoginButton");
            const google = document.querySelector(".g_id_signin");
            const googleMeta = document.getElementById("g_id_onload");
            if (tg) tg.style.display = "none";
            if (google) google.style.display = "none";
            if (googleMeta?.parentElement === document.getElementById("authlog")) {
                googleMeta.style.display = "none";
            }
        }

        showAuthButtons() {
            const tg = document.getElementById("telegramLoginButton");
            const google = document.querySelector(".g_id_signin");
            const googleMeta = document.getElementById("g_id_onload");
            if (tg) tg.style.display = "";
            if (google) google.style.display = "";
            if (googleMeta) googleMeta.style.display = "";
        }

        /** Как displayAccountData() в main_out.js */
        updateXpDisplay() {
            const levelEl = document.getElementById("levelCircle");
            const fillEl = document.getElementById("xpProgressFill") || document.querySelector(".progress-fill");
            const textEl = document.getElementById("progressText");
            const accountIDElement = document.getElementById("accountID");
            const xpBlock = document.getElementById("xp-bar-block");
            const loggedIn = this.isAccountLoggedIn();

            if (xpBlock) xpBlock.hidden = !loggedIn;

            if (!loggedIn) {
                if (fillEl) fillEl.style.width = "0%";
                if (levelEl) levelEl.textContent = "0";
                if (textEl) textEl.textContent = "0% (0/0)";
                if (accountIDElement) accountIDElement.textContent = "";
                return;
            }

            const data = this.core.accounts.data;
            const xp = data.xp ?? this.core.account?.xp ?? 0;
            const currLevel = getLevel(xp);
            const nextXp = getXp(currLevel + 1);
            const progressPercent = nextXp > 0 ? Math.min(100, (xp / nextXp) * 100) : 0;

            if (fillEl) fillEl.style.width = `${progressPercent}%`;
            if (levelEl) levelEl.textContent = String(currLevel);
            if (textEl) {
                textEl.textContent = `${Math.round(progressPercent)}% (${xp}/${nextXp})`;
            }
            if (accountIDElement) {
                accountIDElement.textContent = `ID: ${data.uid ?? ""}`;
            }
        }

        buildServerList() {
            if (!this.serverListEl) return;
            this.serverListEl.innerHTML = "";
            const hosts = Object.keys(this.core.app.servers || {});
            const active = this._selectedServerHost || this.core.currentServerHost || hosts[0];

            for (const host of hosts) {
                const info = this.core.app.servers[host];
                const li = document.createElement("li");
                li.className = "server-item" + (host === active ? " active" : "");
                li.innerHTML = `
                    <span class="server-name">${info.name}</span>
                    <i class="fa-solid fa-list server-list-icon"></i>
                `;
                li.addEventListener("click", () => this.connectToServer(host));
                this.serverListEl.appendChild(li);
            }
        }

        async connectToServer(host) {
            this._selectedServerHost = host;
            this.buildServerList();
            const url = `ws${location.protocol === "https:" ? "s" : ""}://${host}`;
            if (this.core.net?.ws) {
                try { this.core.net.ws.close(); } catch (_) {}
                this.core.app.clear();
                this.core.net.reset();
            }
            await this.core.net.connect(url).catch(err => console.error("Connect error:", err));
        }

        initAccountUI() {
            document.getElementById("telegramLoginButton")
                ?.addEventListener("click", () => this.core.accounts.openTelegramAuth());
            document.getElementById("logoutButton")
                ?.addEventListener("click", () => this.core.accounts.logout());
            document.getElementById("tabNicknames")
                ?.addEventListener("click", () => this.showNickClanTab("nicks"));
            document.getElementById("tabClans")
                ?.addEventListener("click", () => this.showNickClanTab("clans"));

            document.querySelectorAll(".noPress").forEach(elem => {
                elem.addEventListener("focus", () => { this.isTyping = true; });
                elem.addEventListener("blur", () => { this.isTyping = false; });
            });

            this.updateAccountPanel();
        }

        isInputFocused() {
            const el = document.activeElement;
            if (!el) return false;
            if (el === this.chatField || el === this.nameInput || el === this.passInput) return true;
            const tag = el.tagName;
            return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
        }

        showNickClanTab(which) {
            const tabN = document.getElementById("tabNicknames");
            const tabC = document.getElementById("tabClans");
            const nick = document.getElementById("nickWrap");
            const clan = document.getElementById("clanWrap");
            if (!tabN || !tabC || !nick || !clan) return;
            tabN.classList.toggle("active", which === "nicks");
            tabC.classList.toggle("active", which === "clans");
            nick.hidden = which !== "nicks";
            clan.hidden = which !== "clans";
        }

        updateAccountPanel() {
            const loggedIn = this.isAccountLoggedIn();
            const authlog = document.getElementById("authlog");
            const logged = document.getElementById("account-logged");

            if (loggedIn) {
                if (authlog) authlog.style.display = "none";
                if (logged) logged.hidden = false;
                this.hideAuthButtons();
            } else {
                if (authlog) authlog.style.display = "flex";
                if (logged) logged.hidden = true;
                this.showAuthButtons();
            }

            this.updateXpDisplay();
        }

        updateAccountLevel() {
            const data = this.core.accounts?.data;
            if (data) data.xp = this.core.account.xp;
            this.updateXpDisplay();
        }

        renderAccountNicknames(data) {
            const block = document.getElementById("account-logged");
            const nickList = document.getElementById("myNickList");
            const clanList = document.getElementById("myClanList");
            const badgeNick = document.getElementById("badgeNick");
            const badgeClan = document.getElementById("badgeClan");

            if (!this.core.accounts.token) {
                this.updateAccountPanel();
                return;
            }

            this.updateAccountPanel();
            if (nickList) nickList.innerHTML = "";
            if (clanList) clanList.innerHTML = "";

            let nickCount = 0;
            let clanCount = 0;

            if (Array.isArray(data?.nicknames) && data.nicknames.length) {
                for (const row of data.nicknames) {
                    const full = String(row.nickname || "");
                    const pass = (row.password ?? "").trim();
                    const finalNick = pass && !full.includes("#") ? `${full}#${pass}` : full;
                    const parsed = parseFullNick(finalNick);

                    if (parsed.hasClan) {
                        if (clanList) this.core.accounts.renderCard(clanList, finalNick);
                        clanCount++;
                    } else if (parsed.nickPart) {
                        if (nickList) this.core.accounts.renderCard(nickList, finalNick);
                        nickCount++;
                    }
                }
            } else {
                if (nickList) {
                    const li = document.createElement("li");
                    li.className = "empty";
                    li.textContent = "Вы не покупали ники";
                    nickList.appendChild(li);
                }
                if (clanList) {
                    const li = document.createElement("li");
                    li.className = "empty";
                    li.textContent = "Вы не покупали кланы";
                    clanList.appendChild(li);
                }
            }

            if (badgeNick) badgeNick.textContent = String(nickCount);
            if (badgeClan) badgeClan.textContent = String(clanCount);
            this.showNickClanTab("nicks");
            this.updateAccountPanel();
        }

        addEvents() {
            this.onPlay = this.onPlay.bind(this)
            this.onSpectate = this.onSpectate.bind(this)
            this.onSettings = this.onSettings.bind(this)
            this.onKeyDown = this.onKeyDown.bind(this)
            this.onNameChange = this.onNameChange.bind(this)
            this.onMouseMove = this.onMouseMove.bind(this)
            this.onResize = this.onResize.bind(this)
            this.onScroll = this.onScroll.bind(this)
            this.onServers = this.onServers.bind(this)
            this.onKeyUp = this.onKeyUp.bind(this)

            this.playButton.addEventListener("click", this.onPlay);
            this.spectateButton.addEventListener("click", this.onSpectate);
            this.settingsButton.addEventListener("click", this.onSettings);
            this.serversButton.addEventListener("click", () => {
                this.core.dailyTop?.refresh();
                this.updateSkinPreview();
            });
            document.getElementById("btn-refresh")?.addEventListener("click", () => {
                this.core.dailyTop?.refresh();
                this.updateSkinPreview();
                this.updatePassFieldVisibility();
                this.updateXpDisplay();
            });
            document.getElementById("open-stats-side")?.addEventListener("click", e => {
                e.preventDefault();
                document.querySelector(".stats-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
            document.getElementById("open-account-footer")?.addEventListener("click", () => {
                document.getElementById("right-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
            this.nameInput.addEventListener("input", () => {
                this.updateSkinPreview();
                this.updatePassFieldVisibility();
            });
            this.nameInput.addEventListener("change", this.onNameChange);
            this.passInput?.addEventListener("input", () => this.syncStoreFromInputs());
            addEventListener("keydown", this.onKeyDown);
            addEventListener("keyup", this.onKeyUp);
            window.addEventListener("mousemove", this.onMouseMove);
            this.core.app.view.addEventListener("wheel", this.onScroll, { passive: true });
			const updateMouseAim = () => {

                const X = (this.core.ui.mouse.x - innerWidth / 2) / this.core.app.camera.s + this.core.app.camera.x;
                const Y = (this.core.ui.mouse.y - innerHeight / 2) / this.core.app.camera.s + this.core.app.camera.y;

                let x = X < this.core.net.border.right ? X : this.core.net.border.right;
                let y = Y < this.core.net.border.bottom ? Y : this.core.net.border.bottom;
                x = -this.core.net.border.right > x ? -this.core.net.border.right : x;
                y = -this.core.net.border.bottom > y ? -this.core.net.border.bottom : y;

                // change cords
                this.core.app.camera.target.x = x;
                this.core.app.camera.target.y = y;

            };

            this.core.app.view.addEventListener("mousedown", () => {
  if (!this.core.app.ownedCells.length) {
    updateMouseAim();
    this.core.net.sendUint8(1); // CLIENT_TO_SERVER.SPECTATE
  }
});
            addEventListener("resize", this.onResize)
            addEventListener("beforeunload", (event) => {
                this.core.store.settings = this.core.settings.rawSettings
                event.cancelBubble = true
                event.returnValue = 'You sure you want to leave?'
                event.preventDefault()
            })
			
			window.addEventListener("blur", () => {
    this.resetKeys();
});

// 2. Страница стала скрытой (смена вкладки, открытие devtools и т.п.)
document.addEventListener("visibilitychange", () => {
    if (document.hidden) this.resetKeys();
});

// 3. Открытие контекстного меню (ПКМ → KeyUp не приходит)
window.addEventListener("contextmenu", () => {
    this.resetKeys();
});
        }
		
		resetKeys() {
    // сбрасываем все клавиши
    for (const key in this.keysPressed) {
        this.keysPressed[key] = false;
    }

    // останавливаем W-интервал
    if (this.ejectInterval) {
        clearInterval(this.ejectInterval);
        this.ejectInterval = null;
    }
}
		






        onPlay() {
            this.syncStoreFromInputs();
            this.core.net.spawn();
            this.setPanelState(false);
        }

        onSpectate() {
            this.syncStoreFromInputs();
            this.setPanelState(false);
            this.core.net.spectate();
        }

        

        onSettings() {
            let contentStr = `<div class="modal-settings-content">`
            const settings = this.core.settings.rawSettings
            for (const setting in settings) {
                const inputValue = setting.replace(/[A-Z]/g, char => ' ' + char.toLowerCase())
                contentStr += `
            <div class="modal-settings-tile">
            ${inputValue}<input type="checkbox" id="setting-${setting}" ${settings[setting] ? "checked" : ""}>
            </div>
            `
            }
            contentStr += `</div>`
            this.modalSystem.addModal(200, null, contentStr)

            for (const setting in settings) {
                document.getElementById(`setting-${setting}`).addEventListener("click", () => {
                    this.core.settings[setting] = !this.core.settings[setting]
                })
            }
        }

        highlightMinimapCell(cellLabel) {
            if (!cellLabel || this._minimapActiveCell === cellLabel) return;
            this._minimapActiveCell = cellLabel;
            if (this._minimapHighlightedSpan) this._minimapHighlightedSpan.style.color = "";
            const grid = document.getElementById("minimap-grid");
            if (!grid) return;
            for (const span of grid.querySelectorAll(".cell")) {
                if (span.textContent === cellLabel) {
                    span.style.color = "#ffd700";
                    this._minimapHighlightedSpan = span;
                    break;
                }
            }
        }

        updateServerStatsTitle(host) {
            const title = document.getElementById("serverTitle");
            if (!title) return;
            const server = this.core.app?.servers?.[host];
            title.textContent = server
                ? `Топ — ${server.name}`
                : `Топ за сегодня`;
        }

        displayDailyTopStats(stats) {
            this.updateServerStatsTitle(this.core.currentServerHost);
            const container = document.getElementById("table-containerwraper");
            if (!container) return;

            container.innerHTML = "";
            for (let index = 0; index < stats.length; index++) {
                const player = stats[index];
                const row = document.createElement("div");
                row.className = "top-playerwraper";
                if (player.time) row.title = player.time;
                row.innerHTML = `
                    <div>${index + 1}</div>
                    <div>${player.nick || ""}</div>
                    <div>${player.score ?? 0}</div>
                    <div class="skinswraper" style="background-image: url('${getSkinUrl(player.skin)}');"></div>
                `;
                container.appendChild(row);
            }
        }

        formatLevelBadge(level, accountAvatar, realXp) {
            if (level == null || level < 0) return "";
            const starClass = getStarClass(level);
            const colorMap = { "": "#cccccc", azure: "#5eb8ff", red: "#ff6666", white: "#ffffff" };
            const color = colorMap[starClass] || "#cccccc";
            if (realXp >= MAX_LEVEL_XP && accountAvatar) {
                return `<img src="${accountAvatar}" alt="" style="width:14px;height:14px;border-radius:50%;vertical-align:middle;margin-right:4px;" onerror="this.style.display='none'">`;
            }
            return `<span style="color:${color};opacity:.9;margin-right:4px;">★${level}</span>`;
        }

        updateLeaderboard() {
            // Оптимизация: используем DocumentFragment для батчинга DOM операций
            const leaderboard = this.core.net.leaderboardItems;
            const ownedSet = new Set(this.core.app.ownedCells); // Set для O(1) поиска вместо O(n) some()
            
            // Оптимизация: используем createDocumentFragment для батчинга
            const fragment = document.createDocumentFragment();
            const tempDiv = document.createElement('div');
            
            for (const player of leaderboard) {
                const badge = this.formatLevelBadge(player.level, player.accountAvatar, player.realXp);
                const isOwned = ownedSet.has(player.id);
                const tile = document.createElement("div");
                tile.className = "hud-leaderboard-tile" + (isOwned ? " red-text" : "");
                tile.innerHTML = badge + player.name;
                fragment.appendChild(tile);
            }
            
            this.leaderboard.innerHTML = "";
            this.leaderboard.appendChild(fragment);
        }

        updateChat() {
            // Оптимизация: используем DocumentFragment для батчинга DOM операций
            const messages = this.core.net.messages;
            const fragment = document.createDocumentFragment();
            const tempDiv = document.createElement('div');
            
            for (const message of messages) {
                const badge = this.formatLevelBadge(message.level, message.accountAvatar, message.realXp);
                const row = document.createElement("div");
                row.className = "hud-message-tile";
                row.innerHTML = '<span class="hud-message-item" style="color: rgb(' + message.color.r + ', ' + message.color.g + ', ' + message.color.b + ')">' + badge + message.name + ': <span class="hud-message">' + message.content + '</span></span>';
                fragment.appendChild(row);
            }
            
            this.chatContent.innerHTML = "";
            this.chatContent.appendChild(fragment);
        }

        onServers() {
  let contentStr = `<div class="modal-servers-content">`;
  for (const ip in this.core.app.servers) {
    const server = this.core.app.servers[ip];
    contentStr += `
      <div class="modal-servers-tile">
        <div class="round">${server.name} - ${ip}</div>
        <div id="server-${ip}" class="button center">Connect</div>
      </div>`;
  }
  contentStr += `</div>`;
  const modalID = this.modalSystem.addModal(300, null, contentStr);

  // обработчик подключения
for (const ip in this.core.app.servers) {
// внутри UserInterface.onServers(), обработчик клика
document.getElementById(`server-${ip}`).addEventListener("click", async () => {
  this.modalSystem.removeModal(modalID);

  const url = `ws${location.protocol === 'https:' ? 's' : ''}://${ip}`;
  console.log("Switching server to:", url);

  // закрываем старый сокет
  if (this.core.net?.ws) {
    try { this.core.net.ws.close(); } catch (e) {}
	this.core.app.clear();
    this.core.net.reset();
  }

  // подключаемся с sha256 challenge-токеном
  this.core.net.connect(url).catch(err => console.error("Connect error:", err));
});


}

}


        onMouseMove({
            clientX,
            clientY
        }) {
            this.mouse.x = clientX
            this.mouse.y = clientY
        }

onScroll(event) {
  if (this.isInputFocused() || this.isTyping || this.isMenuOpen()) return;
  const app = this.core.app;
  const steps = (event.deltaY || 0) / 120;
  app.zoom *= Math.pow(0.9, steps);
}

        isMenuOpen() {
            return this.menuOverlay && this.menuOverlay.style.display !== "none";
        }


        onKeyDown(event) {
            const { code } = event;

            if (this.isInputFocused() || this.isTyping) {
                if (code === "Enter" && document.activeElement === this.chatField) {
                    const value = this.chatField.value;
                    if (value !== "") this.core.net.sendChatMessage(value);
                    this.chatField.blur();
                    this.chatField.value = "";
                }
                return;
            }

            this.keysPressed[code] = true;

            switch (code) {
                case "Escape":
                    this.setPanelState(true);
                    break;
                case "KeyW":
                    if (!this.ejectInterval) {
                        this.core.net.sendEject();
                        this.ejectInterval = setInterval(() => {
                            if (this.keysPressed["KeyW"]) this.core.net.sendEject();
                            else clearInterval(this.ejectInterval);
                        }, 50);
                    }
                    break;
                case "Space":
                    event.preventDefault();
                    this.core.net.sendSplit();
                    break;
                case "Enter":
                    this.chatField.focus();
                    break;
                case "KeyE":
                    this.core.net.sendE();
                    break;
                case "KeyR":
                    this.core.net.sendR();
                    break;
                case "KeyT":
                    this.core.net.sendT();
                    break;
                case "KeyP":
                    this.core.net.sendP();
                    break;
            }
        }

        onKeyUp({
            code
        }) {
            this.keysPressed[code] = false;

            if (code === "KeyW" && this.ejectInterval) {
                clearInterval(this.ejectInterval);
                this.ejectInterval = null;
            }
        }

        onResize() {
            this.core.app.renderer.resize(innerWidth, innerHeight)
        }

        setPanelState(show) {
            if (show) {
                if (this.menuOverlay) this.menuOverlay.style.display = "flex";
                this.core.dailyTop?.refresh();
                this.updateSkinPreview();
                this.updatePassFieldVisibility();
                this.updateXpDisplay();
                this.buildServerList();
            } else if (this.menuOverlay) {
                this.menuOverlay.style.display = "none";
            }
        }

        onNameChange() {
            this.syncStoreFromInputs();
            const n = this.getDisplayNick();
  if (this.passInput) this.core.store.pass = this.passInput.value;

  // ПРОГНАТЬ НОВОЕ ИМЯ ПО ВСЕМ СВОИМ ЖИВЫМ КЛЕТКАМ
  for (const id of this.core.app.ownedCells) {
    const cell = this.core.app.cellsByID.get(id);
    if (!cell) continue;
    cell.hasChanged = true; // разрешаем сеттеру перерисовать
    cell.name = n;          // перерисует текст и скин
  }
}
}