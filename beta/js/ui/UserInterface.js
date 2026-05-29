import { ModalSystem } from "./ModalSystem.js";

import { getLevel, getXp } from "../utils/math.js";
import { buildLevelBadgeHtml, getLevelTier } from "../utils/levelBadge.js";
import { parseFullNick } from "../utils/nick.js";
import { getSkinUrl, getRenderDpr } from "../config/constants.js";
import { getPlayName, skinPreviewUrl } from "../utils/player.js";
import { LEADERBOARD_THEME_CSS_VARS } from "../utils/leaderboardTheme.js";

const HUD_COLLAPSE_STORAGE_KEY = "agar-hud-collapsed";

export class UserInterface {

        constructor(core) {
            this.core = core
            this._minimapActiveCell = null;
            this._minimapHighlightedSpan = null;
            this._cPressed = false;
            this._coordCooldown = false;

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
            this._pendingReconnectMode = null;
            this.scoreElement = document.getElementById("score");
            this.fpsElement = document.getElementById("fps");
            this.leaderboard = document.getElementById("leaderboard-list");
            this.leaderboardPanel = document.getElementById("leaderboard");
            this.leaderboardTitleEl = document.querySelector("#leaderboard .hud-leaderboard-title");
            this.leaderboardSubtitleEl = document.querySelector("#leaderboard .hud-leaderboard-subtitle");
            this._leaderboardDefaultTitle = this.leaderboardTitleEl?.textContent ?? "";
            this._leaderboardDefaultSubtitle = this.leaderboardSubtitleEl?.textContent ?? "";
            this.chatField = document.getElementById("chat-field");
            this.chatContent = document.getElementById("chat-content");
            this._lastHudScore = -1;
            this._lastHudFpsLine = "";
            setInterval(() => this.refreshHudStats(), 100);
            const storedName = localStorage.getItem("cigar3-name");
            if (this.nameInput) this.nameInput.value = storedName ? storedName.trim() : "";
            if (this.passInput) {
                this.passInput.value = this.core.store.pass || "";
                this.passInput.hidden = true;
            }
            this.addEvents();
            this.initHudPanels();
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

        refreshHudStats() {
            if (!this.scoreElement || !this.fpsElement) return;
            const score = this.core.app.camera.score;
            if (score !== this._lastHudScore) {
                this._lastHudScore = score;
                this.scoreElement.textContent = `Score: ${score}`;
            }
            const fps = Math.round(this.core.stats?.fps || 0);
            const line = `Ping: ${this.core.net.ping} FPS: ${fps}`;
            if (line !== this._lastHudFpsLine) {
                this._lastHudFpsLine = line;
                this.fpsElement.textContent = line;
            }
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


        applyLevelBadgeToMenu(level) {
            const levelBadge = document.getElementById("levelCircle");
            const levelNum = document.getElementById("levelCircleNum");
            const levelIcon = levelBadge?.querySelector(".level-badge__icon");
            const tier = getLevelTier(level) ?? getLevelTier(0);
            const mod = tier?.starClass || "default";

            if (levelBadge) {
                levelBadge.className = `level-badge rank-badge--${mod}`;
                levelBadge.title = tier ? `${tier.name} · уровень ${level}` : "Уровень";
            }
            if (levelNum) levelNum.textContent = String(level);
            if (levelIcon && tier) levelIcon.textContent = tier.icon;
        }

        updateXpDisplay() {
            const fillEl = document.getElementById("xpProgressFill") || document.querySelector(".progress-fill");
            const textEl = document.getElementById("progressText");
            const tierLabel = document.getElementById("xpTierLabel");
            const levelNext = document.getElementById("xpLevelNext");
            const accountIDElement = document.getElementById("accountID");
            const xpBlock = document.getElementById("xp-bar-block");
            const loggedIn = this.isAccountLoggedIn();

            if (xpBlock) xpBlock.hidden = !loggedIn;

            if (!loggedIn) {
                if (fillEl) fillEl.style.width = "0%";
                this.applyLevelBadgeToMenu(0);
                if (tierLabel) tierLabel.textContent = "—";
                if (levelNext) levelNext.textContent = "";
                if (textEl) textEl.textContent = "Войдите, чтобы копить уровень";
                if (accountIDElement) accountIDElement.textContent = "";
                return;
            }

            const data = this.core.accounts.data;
            const xp = data.xp ?? this.core.account?.xp ?? 0;
            const currLevel = getLevel(xp);
            const nextXp = getXp(currLevel + 1);
            const remaining = Math.max(0, nextXp - xp);
            const progressPercent = nextXp > 0 ? Math.min(100, (xp / nextXp) * 100) : 0;
            const tier = getLevelTier(currLevel) ?? getLevelTier(0);
            const mod = tier?.starClass || "default";

            if (fillEl) {
                fillEl.style.width = `${progressPercent}%`;
                fillEl.dataset.tier = mod;
            }
            this.applyLevelBadgeToMenu(currLevel);
            if (tierLabel) tierLabel.textContent = tier?.name ?? "—";
            if (levelNext) {
                levelNext.textContent = `ещё ${remaining.toLocaleString("ru")} XP → ур. ${currLevel + 1}`;
            }
            if (textEl) {
                textEl.textContent =
                    `${Math.round(progressPercent)}% · ${xp.toLocaleString("ru")} / ${nextXp.toLocaleString("ru")} XP`;
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

        rememberReconnectMode(nextHost) {
            const prev = String(this.core.currentServerHost || this._selectedServerHost || "").toLowerCase();
            const next = String(nextHost || "").toLowerCase();
            if (next && prev && next !== prev) {
                this._pendingReconnectMode = "spectate";
                return;
            }
            if (this.isMenuOpen()) {
                this._pendingReconnectMode = "play";
                return;
            }
            this._pendingReconnectMode =
                this.core.app.ownedCells.length > 0 ? "play" : "spectate";
        }

        isNetConnected() {
            return this.core.net?.ws?.readyState === WebSocket.OPEN;
        }

        applyNickToLiveCells() {
            const n = this.getDisplayNick();
            for (const id of this.core.app.ownedCells) {
                const cell = this.core.app.cellsByID.get(id);
                if (!cell) continue;
                cell.hasChanged = true;
                cell.name = n;
            }
        }

        consumeReconnectMode() {
            return this._pendingReconnectMode;
        }

        restoreGameModeAfterConnect() {
            const mode = this._pendingReconnectMode;
            this._pendingReconnectMode = null;

            if (mode === "spectate") {
                this.setPanelState(false);
                this.enterSpectate();
                return;
            }
            if (mode === "play") {
                this.setPanelState(false);
                this.syncStoreFromInputs();
                this.core.net.spawn();
                return;
            }
            this.setPanelState(true);
        }

        updateSpectateMouseAim(clientX, clientY) {
            const cx = clientX ?? this.mouse.x;
            const cy = clientY ?? this.mouse.y;
            const pos = this.core.net.getSpectateClickCoords(cx, cy);
            const cam = this.core.app.camera;
            cam.target.x = pos.x;
            cam.target.y = pos.y;
            return pos;
        }

        requestServerSpectate() {
            if (this.core.app.ownedCells.length > 0) return;
            this.core.net?.requestSpectate?.();
        }

        enterSpectate() {
            if (this.core.app.ownedCells.length > 0) return;
            this._pendingReconnectMode = "spectate";
            this.setPanelState(false);
            this.requestServerSpectate();
        }

        async connectToServer(host) {
            this.rememberReconnectMode(host);
            this._selectedServerHost = host;
            this.buildServerList();
            const url = `ws${location.protocol === "https:" ? "s" : ""}://${host}`;
            this.core.net.reset();
            this.core.app.clear();
            await this.core.net.connect(url).catch(() => {});
        }

        getCurrentServerHost() {
            return (
                this.core.currentServerHost ||
                this._selectedServerHost ||
                Object.keys(this.core.app.servers || {})[0] ||
                null
            );
        }

        async reconnectCurrentServer() {
            const host = this.getCurrentServerHost();
            if (!host) return;
            this.syncStoreFromInputs();
            await this.connectToServer(host);
            this.core.dailyTop?.refresh(host);
            this.updateSkinPreview();
            this.updatePassFieldVisibility();
            this.updateXpDisplay();
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

        initHudPanels() {
            let saved = {};
            try {
                saved = JSON.parse(localStorage.getItem(HUD_COLLAPSE_STORAGE_KEY) || "{}");
            } catch {
                saved = {};
            }

            this.hudPanels = [];
            document.querySelectorAll(".hud-panel[data-hud-id]").forEach(panel => {
                const id = panel.dataset.hudId;
                const toggle = panel.querySelector(".hud-panel-toggle");
                const collapsed = !!saved[id];
                panel.classList.toggle("hud-panel--collapsed", collapsed);
                this.updateHudToggleState(panel, toggle, collapsed);

                toggle?.addEventListener("click", e => {
                    e.stopPropagation();
                    const nowCollapsed = panel.classList.toggle("hud-panel--collapsed");
                    saved[id] = nowCollapsed;
                    localStorage.setItem(HUD_COLLAPSE_STORAGE_KEY, JSON.stringify(saved));
                    this.updateHudToggleState(panel, toggle, nowCollapsed);
                });

                this.hudPanels.push(panel);
            });
        }

        updateHudToggleState(panel, toggle, collapsed) {
            if (!toggle) return;
            const title = panel.querySelector(".hud-panel-title")?.textContent?.trim() || "панель";
            toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
            toggle.title = collapsed ? "Развернуть" : "Свернуть";
            toggle.setAttribute(
                "aria-label",
                (collapsed ? "Развернуть " : "Свернуть ") + title.toLowerCase()
            );
        }

        isPointerOverHud(x, y) {
            if (this.isMenuOpen()) return false;
            const px = x ?? this.mouse.x;
            const py = y ?? this.mouse.y;
            for (const panel of this.hudPanels || []) {
                const r = panel.getBoundingClientRect();
                if (r.width <= 0 || r.height <= 0) continue;
                if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) return true;
            }
            return false;
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
            const prevLevel = data ? getLevel(data.xp ?? 0) : 0;
            if (data) data.xp = this.core.account.xp;
            const newLevel = getLevel(this.core.account.xp ?? 0);
            this.updateXpDisplay();
            if (newLevel > prevLevel) {
                const levelBadge = document.getElementById("levelCircle");
                levelBadge?.classList.add("level-badge--level-up");
                setTimeout(() => levelBadge?.classList.remove("level-badge--level-up"), 900);
            }
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
                this.reconnectCurrentServer();
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
            this.core.app.view.addEventListener("click", (e) => {
                if (e.button !== 0) return;
                if (this.isMenuOpen()) return;
                if (this.isPointerOverHud(e.clientX, e.clientY)) return;
                if (this.core.app.ownedCells.length > 0) return;

                this.mouse.x = e.clientX;
                this.mouse.y = e.clientY;
                const pos = this.updateSpectateMouseAim();
                this.core.net.sendSpectateClick();
                this.core.net.sendMouseMove(pos.x, pos.y);
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


document.addEventListener("visibilitychange", () => {
    if (document.hidden) this.resetKeys();
});


window.addEventListener("contextmenu", () => {
    this.resetKeys();
});
        }

		resetKeys() {

    for (const key in this.keysPressed) {
        this.keysPressed[key] = false;
    }


    this._cPressed = false;

    if (this.ejectInterval) {
        clearInterval(this.ejectInterval);
        this.ejectInterval = null;
    }
}







        onPlay() {
            if (!this.isMenuOpen() && this.core.app.ownedCells.length > 0) return;

            this.syncStoreFromInputs();
            this.applyNickToLiveCells();
            this._pendingReconnectMode = "play";

            if (!this.isNetConnected()) {
                const host = this._selectedServerHost || this.core.currentServerHost;
                if (host) this.connectToServer(host);
                return;
            }

            this.core.net.spawn();
            this.setPanelState(false);
        }

        onSpectate() {
            if (!this.isMenuOpen() && this.core.app.ownedCells.length > 0) return;
            this.syncStoreFromInputs();
            this._pendingReconnectMode = "spectate";

            if (!this.isNetConnected()) {
                const host = this._selectedServerHost || this.core.currentServerHost;
                if (host) this.connectToServer(host);
                return;
            }

            this.enterSpectate();
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

        sendMapCellCoord() {
            if (this._coordCooldown) return;
            const cell = this._minimapActiveCell;
            if (!cell) return;
            this.core.net.sendChatMessage(cell);
            this._coordCooldown = true;
            setTimeout(() => {
                this._coordCooldown = false;
            }, 3000);
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
            if (!stats.length) {
                const empty = document.createElement("div");
                empty.className = "stats-empty";
                empty.textContent = "Нет данных за сегодня";
                container.appendChild(empty);
                return;
            }

            for (let index = 0; index < stats.length; index++) {
                const player = stats[index];
                const rank = index + 1;
                const row = document.createElement("div");
                row.className = "stats-row";
                if (rank <= 3) row.classList.add("stats-row--top" + rank);
                if (player.time) row.title = player.time;
                row.innerHTML =
                    '<span class="stats-rank">' + rank + '</span>' +
                    '<span class="stats-nick">' + (player.nick || "") + '</span>' +
                    '<span class="stats-score">' + (player.score ?? 0) + '</span>' +
                    '<span class="stats-skin skinswraper" style="background-image:url(\'' + getSkinUrl(player.skin) + '\')"></span>';
                container.appendChild(row);
            }
        }

        formatLevelBadge(level, accountAvatar, realXp) {
            return buildLevelBadgeHtml(level, accountAvatar, realXp);
        }

        applyLeaderboardTheme(theme) {
            const panel = this.leaderboardPanel;
            if (!panel) return;

            if (!theme) {
                panel.classList.remove("hud-leaderboard--themed", "hud-leaderboard--hide-mark");
                for (const key of LEADERBOARD_THEME_CSS_VARS) panel.style.removeProperty(key);
                if (this.leaderboardTitleEl) {
                    this.leaderboardTitleEl.textContent = this._leaderboardDefaultTitle;
                    this.leaderboardTitleEl.hidden = false;
                }
                if (this.leaderboardSubtitleEl) {
                    this.leaderboardSubtitleEl.textContent = this._leaderboardDefaultSubtitle;
                    this.leaderboardSubtitleEl.hidden = false;
                }
                return;
            }

            panel.classList.add("hud-leaderboard--themed");
            panel.classList.toggle("hud-leaderboard--hide-mark", !!theme.hideHeaderMark);

            for (const key of LEADERBOARD_THEME_CSS_VARS) panel.style.removeProperty(key);
            if (theme.vars) {
                for (const key of Object.keys(theme.vars)) {
                    panel.style.setProperty(key, theme.vars[key]);
                }
            }

            if (this.leaderboardTitleEl) {
                if (theme.title === null) this.leaderboardTitleEl.hidden = true;
                else if (theme.title !== undefined) {
                    this.leaderboardTitleEl.hidden = false;
                    this.leaderboardTitleEl.textContent = theme.title;
                } else {
                    this.leaderboardTitleEl.hidden = false;
                    this.leaderboardTitleEl.textContent = this._leaderboardDefaultTitle;
                }
            }
            if (this.leaderboardSubtitleEl) {
                if (theme.subtitle === null) this.leaderboardSubtitleEl.hidden = true;
                else if (theme.subtitle !== undefined) {
                    this.leaderboardSubtitleEl.hidden = false;
                    this.leaderboardSubtitleEl.textContent = theme.subtitle;
                } else {
                    this.leaderboardSubtitleEl.hidden = false;
                    this.leaderboardSubtitleEl.textContent = this._leaderboardDefaultSubtitle;
                }
            }
        }

        updateLeaderboard() {
            this.applyLeaderboardTheme(this.core.net.leaderboardTheme);
            const leaderboard = this.core.net.leaderboardItems;
            const ownedSet = new Set(this.core.app.ownedCells);
            const TOP = 10;
            const fragment = document.createDocumentFragment();

            const appendRow = (player, rank, isOwned) => {
                const badge = this.formatLevelBadge(player.level, player.accountAvatar, player.realXp);
                const row = document.createElement("div");
                row.className = "hud-leaderboard-row";
                row.setAttribute("role", "listitem");
                if (rank <= 3) row.classList.add("hud-leaderboard-row--top" + rank);
                if (isOwned) row.classList.add("hud-leaderboard-row--me");
                row.innerHTML =
                    '<span class="hud-leaderboard-rank">' + rank + '</span>' +
                    '<span class="hud-leaderboard-name">' + badge +
                    '<span class="hud-leaderboard-nick">' + player.name + '</span></span>' +
                    (isOwned ? '<span class="hud-leaderboard-you">вы</span>' : "");
                fragment.appendChild(row);
            };

            if (leaderboard.length === 0) {
                const empty = document.createElement("div");
                empty.className = "hud-leaderboard-empty";
                empty.textContent = "Ожидание игроков…";
                fragment.appendChild(empty);
            } else {
                const topCount = Math.min(TOP, leaderboard.length);
                for (let i = 0; i < topCount; i++) {
                    const player = leaderboard[i];
                    appendRow(player, i + 1, ownedSet.has(player.id));
                }

                if (ownedSet.size > 0) {
                    let selfIndex = -1;
                    for (let i = TOP; i < leaderboard.length; i++) {
                        if (ownedSet.has(leaderboard[i].id)) {
                            selfIndex = i;
                            break;
                        }
                    }
                    if (selfIndex >= 0) {
                        const divider = document.createElement("div");
                        divider.className = "hud-leaderboard-divider";
                        divider.innerHTML = "<span>Ваше место</span>";
                        fragment.appendChild(divider);
                        appendRow(leaderboard[selfIndex], selfIndex + 1, true);
                    }
                }
            }

            if (!this.leaderboard) return;
            this.leaderboard.innerHTML = "";
            this.leaderboard.appendChild(fragment);
        }

        updateChat() {

            const messages = this.core.net.messages;
            const fragment = document.createDocumentFragment();
            const tempDiv = document.createElement('div');

            for (const message of messages) {
                const badge = this.formatLevelBadge(message.level, message.accountAvatar, message.realXp);
                const row = document.createElement("div");
                row.className = "hud-message-tile";
                row.innerHTML = '<span class="hud-message-item">' + badge + '<span class="hud-message-nick" style="color: rgb(' + message.color.r + ', ' + message.color.g + ', ' + message.color.b + ')">' + message.name + '</span>: <span class="hud-message">' + message.content + '</span></span>';
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


for (const ip in this.core.app.servers) {

document.getElementById(`server-${ip}`).addEventListener("click", async () => {
  this.modalSystem.removeModal(modalID);
  this.rememberReconnectMode(ip);

  const url = `ws${location.protocol === 'https:' ? 's' : ''}://${ip}`;

  this.core.net.reset();
  this.core.app.clear();
  this.core.net.connect(url).catch(() => {});
});


}

}


        onMouseMove({
            clientX,
            clientY
        }) {
            this.mouse.x = clientX;
            this.mouse.y = clientY;
        }

onScroll(event) {
  if (this.isInputFocused() || this.isTyping || this.isMenuOpen()) return;
  if (this.isPointerOverHud(event.clientX, event.clientY)) return;
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
                    event.preventDefault();
                    this.setPanelState(!this.isMenuOpen());
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
                case "KeyC":
                    if (!this._cPressed) {
                        this.sendMapCellCoord();
                        this._cPressed = true;
                    }
                    break;
                case "KeyR":
                    this.core.net.sendR();
                    this.core.app.fixDeadCells();
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

            if (code === "KeyC") this._cPressed = false;

            if (code === "KeyW" && this.ejectInterval) {
                clearInterval(this.ejectInterval);
                this.ejectInterval = null;
            }
        }

        onResize() {
            const renderer = this.core.app.renderer;
            const dpr = getRenderDpr();
            if (renderer.resolution !== dpr) renderer.resolution = dpr;
            renderer.resize(innerWidth, innerHeight);
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
            this.applyNickToLiveCells();
        }
}