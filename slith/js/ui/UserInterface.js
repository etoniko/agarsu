import { ModalSystem } from "./ModalSystem.js";
import { getMouseWorld, centerRawMouse } from "../input/coordinates.js";

export class UserInterface {

    constructor(core) {
        this.core = core

        this.modalSystem = new ModalSystem()

        this.mouse = {
            x: 0,
            y: 0
        }

        this.keysPressed = {};
        this.ejectInterval = null;
        this.boostInterval = null;
        this._boostInput = { space: false, mouse: false };

        this.userInterface = document.getElementById("user-interface")
        this.playButton = document.getElementById("play")
        this.spectateButton = document.getElementById("spectate")
        this.settingsButton = document.getElementById("settings")
        this.nameInput = document.getElementById("name")
        this.serversButton = document.getElementById("servers")
        this.scoreElement = document.getElementById("score")
        this.fpsElement = document.getElementById("fps")
        this.leaderboard = document.getElementById("leaderboard")
        this.chatField = document.getElementById("chat-field")
        this.chatContent = document.getElementById("chat-content")
        setInterval(() => {
            this.scoreElement.innerHTML = `Score: ${this.core.app.camera.score}`;
            // добавим FPS прямо к Ping
            const fps = this.core.stats?.fps || 0;
            this.fpsElement.innerHTML = `Ping: ${this.core.net.ping} FPS: ${fps.toFixed(0)}`;
        }, 40);
        this.nameInput.value = this.core.store.name
        this.addEvents()
        centerRawMouse(this.core, this);
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
        this.onMouseDown = this.onMouseDown.bind(this)
        this.onMouseUp = this.onMouseUp.bind(this)
        this.playButton.addEventListener("click", this.onPlay)
        this.spectateButton.addEventListener("click", this.onSpectate)
        this.settingsButton.addEventListener("click", this.onSettings)
        this.serversButton.addEventListener("click", this.onServers)
        addEventListener("keydown", this.onKeyDown);
        addEventListener("keyup", this.onKeyUp);
        this.nameInput.addEventListener("change", this.onNameChange)
        this.core.app.view.addEventListener("mousemove", this.onMouseMove)
        this.core.app.view.addEventListener('wheel', this.onScroll, {
            passive: true
        })
        this.core.app.view.addEventListener("mousedown", this.onMouseDown)
        window.addEventListener("mouseup", this.onMouseUp)
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

        this._boostInput.space = false;
        this._boostInput.mouse = false;
        this.stopBoost();
    }

    isBoostWanted() {
        return this._boostInput.space || this._boostInput.mouse;
    }

    setBoostInput(source, active) {
        this._boostInput[source] = active;
        if (this.isBoostWanted()) {
            this.startBoost();
        } else {
            this.stopBoost();
        }
    }

    isBoostKey(code, keyCode) {
        return code === "Space" || keyCode === 32 || keyCode === 133;
    }

    startBoost() {
        if (!this.core.app.ownedCells.length || this.core.app.isSpectating) return;
        if (this.boostInterval) return;

        this.core.net.sendBoost(true);
        this.boostInterval = setInterval(() => {
            if (this.isBoostWanted() && this.core.app.ownedCells.length && !this.core.app.isSpectating) {
                this.core.net.sendBoost(true);
            } else {
                this.stopBoost();
            }
        }, 50);
    }

    stopBoost() {
        if (this.boostInterval) {
            clearInterval(this.boostInterval);
            this.boostInterval = null;
        }

        this.core.net.sendBoost(false);
    }

    onMouseDown(event) {
        if (event.button !== 0) return;

        if (this.core.app.isSpectating) {
            this.moveSpectateToClick();
            return;
        }

        this.setBoostInput("mouse", true);
    }

    onMouseUp(event) {
        if (event.button !== 0) return;
        this._boostInput.mouse = false;
        if (this.isBoostWanted()) {
            this.startBoost();
        } else {
            this.stopBoost();
        }
    }







    onPlay() {
        if (this.core.app.ownedCells.length > 0) {
            this.setPanelState(false);
            return;
        }
        const name = (this.nameInput.value || "").trim() || "Игрок";
        this.core.store.name = name;
        this.core.app.exitSpectateMode();
        this.core.net.spawn();
        this.setPanelState(false);
        this.updateMenuButtons();
    }

    moveSpectateToClick() {
        if (!this.core.app.isSpectating) return;
        const world = getMouseWorld(this.core);
        this.core.app.posX = world.x;
        this.core.app.posY = world.y;
        this.core.net.spectate();
    }

    followLeaderboardPlayer(playerId) {
        if (!this.core.app.isSpectating || !playerId) return;
        this.core.net.sendSpectateFollow(playerId, this.core.app.posX, this.core.app.posY, true);
    }

    onSpectate() {
        if (this.core.app.ownedCells.length > 0) {
            return;
        }
        if (!this.core.net.mapReady) {
            console.warn("[Game] Карта ещё не загружена, подождите подключения");
            return;
        }
        if (!this.core.app.isSpectating) {
            centerRawMouse(this.core);
            this.core.app.enterSpectateMode();
        }
        this.core.net.spectate();
        this.setPanelState(false);
        this.updateMenuButtons();
    }

    onServers() {
        let contentStr = `<div class="modal-servers-content">`
        this.modalSystem.addModal(400, 500, "")
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

    updateLeaderboard() {
        const leaderboard = this.core.net.leaderboardItems;
        const ownerId = this.core.net.ownerPlayerId;
        const spectating = this.core.app.isSpectating;

        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');

        for (const player of leaderboard) {
            const lvl = (player.level != null && player.level >= 0) ? ` <span style="opacity:.8">[Lv ${player.level}]</span>` : "";
            const isOwned = player.id === ownerId;
            const followHint = spectating ? ' title="Наблюдать за игроком"' : "";
            const followClass = spectating ? " hud-leaderboard-follow" : "";
            tempDiv.innerHTML = `<div class="hud-leaderboard-tile${followClass} ${isOwned ? "red-text" : ""}" data-player-id="${player.id}"${followHint}>${player.name}${lvl}</div>`;
            const tile = tempDiv.firstElementChild;
            if (spectating) {
                tile.style.cursor = "pointer";
                tile.addEventListener("click", () => this.followLeaderboardPlayer(player.id));
            }
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
            tempDiv.innerHTML = `
        <div class="hud-message-tile">
            <span class="hud-message-item" style="color: rgb(${message.color.r}, ${message.color.g}, ${message.color.b})">
                ${message.name}: <span class="hud-message">${message.content}</span>
            </span>
        </div>`;
            fragment.appendChild(tempDiv.firstElementChild);
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
                    try { this.core.net.ws.close(); } catch (e) { }
                    this.core.app.clear();
                    this.core.net.reset();
                }

                // КАПЧА -> КОННЕКТ (гарантированно покажется)
                const token = await this.core.captcha.getToken();
                this.core.net.connect(url, token);
            });


        }

    }


        onMouseMove({ clientX, clientY }) {
            this.mouse.x = clientX;
            this.mouse.y = clientY;
        }

        getMouseWorld() {
            return getMouseWorld(this.core);
        }

    onScroll({ deltaY }) {
        const app = this.core.app;
        const steps = (deltaY || 0) / 120;
        app.zoom *= Math.pow(0.9, steps);
    }


    onKeyDown(event) {
        const { code, keyCode } = event;
        this.keysPressed[code] = true;

        if (this.isBoostKey(code, keyCode)) {
            event.preventDefault();
            this.setBoostInput("space", true);
            return;
        }

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
            case "Enter":
                if (document.activeElement === this.chatField) {
                    const value = this.chatField.value;
                    if (value !== "") this.core.net.sendChatMessage(value);
                    this.chatField.blur();
                    this.chatField.value = "";
                } else this.chatField.focus();
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

    onKeyUp(event) {
        const { code, keyCode } = event;
        this.keysPressed[code] = false;

        if (this.isBoostKey(code, keyCode)) {
            this._boostInput.space = false;
            if (this.isBoostWanted()) {
                this.startBoost();
            } else {
                this.stopBoost();
            }
        }

        if (code === "KeyW" && this.ejectInterval) {
            clearInterval(this.ejectInterval);
            this.ejectInterval = null;
        }
    }

    onResize() {
        this.core.app.resizeViewport();
        centerRawMouse(this.core);
    }

    updateMenuButtons() {
        const playing = this.core.app.ownedCells.length > 0;
        const spectating = this.core.app.isSpectating;

        if (playing) {
            this.spectateButton.style.display = "";
            this.spectateButton.style.opacity = "0.5";
            this.spectateButton.style.pointerEvents = "none";
        } else {
            this.spectateButton.style.display = "";
            this.spectateButton.style.opacity = "";
            this.spectateButton.style.pointerEvents = "";
        }
        this.playButton.style.display = "";
    }

    setPanelState(show) {
        if (show) {
            this.userInterface.style.display = "grid";
            this.updateMenuButtons();
        } else {
            this.userInterface.style.display = "none";
        }
    }

    onNameChange() {
        const n = this.nameInput.value;
        this.core.store.name = n;

        // ПРОГНАТЬ НОВОЕ ИМЯ ПО ВСЕМ СВОИМ ЖИВЫМ КЛЕТКАМ
        for (const id of this.core.app.ownedCells) {
            const cell = this.core.app.cellsByID.get(id);
            if (!cell) continue;
            cell.hasChanged = true; // разрешаем сеттеру перерисовать
            cell.name = n;          // перерисует текст и скин
        }
    }
}
