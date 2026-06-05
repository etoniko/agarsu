import ModalSystem from "./ModalSystem.js"
import Application from "./Application.js"

export default class UserInterface {

    constructor(core) {
        this.core = core

        this.modalSystem = new ModalSystem()

        this.mouse = {
            x: 0,
            y: 0
        }

        this.keysPressed = {};
        this.ejectInterval = null;
        this.coordCooldown = false;

        this.userInterface = document.getElementById("user-interface")
        this.playButton = document.getElementById("play")
        this.spectateButton = document.getElementById("spectate")
        this.settingsButton = document.getElementById("settings")
        this.skinButton = document.getElementById("skin")
        this.faviconLink = document.getElementById("favicon")
        this.nameInput = document.getElementById("name")
        this.passInput = document.getElementById("pass")
        this.serversButton = document.getElementById("servers")
        this.scoreElement = document.getElementById("score")
        this.pingElement = document.getElementById("ping")
        this.leaderboard = document.getElementById("leaderboard")
        this.chatField = document.getElementById("chat-field")
        this.chatContent = document.getElementById("chat-content")
        this.minionControlled = document.getElementById("minion-controlled")
        this.fpsElement = document.getElementById("fps")
        this.serverElement = document.getElementById("server")
        setInterval(() => {
            this.scoreElement.innerHTML = `Score: ${this.core.app.camera.score}`
            this.pingElement.innerHTML = `Ping: ${this.core.net?.ping ?? 0}`
            this.minionControlled.classList.toggle("stat--hidden", !this.core.net?.minionControlled)
        }, 40)

        this.nameInput.value = this.core.store.name
        this.passInput.value = this.core.store.pass
        this.updatePassFieldVisibility()
        this.updateSkinPreview()

        this.addEvents()
    }

    addEvents() {
        this.onPlay = this.onPlay.bind(this)
        this.onSpectate = this.onSpectate.bind(this)
        this.onSettings = this.onSettings.bind(this)
        this.onSkin = this.onSkin.bind(this)
        this.onKeyDown = this.onKeyDown.bind(this)
        this.onNameChange = this.onNameChange.bind(this)
        this.onPassChange = this.onPassChange.bind(this)
        this.onNameInput = this.onNameInput.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)
        this.onMouseDown = this.onMouseDown.bind(this)
        this.onResize = this.onResize.bind(this)
        this.onScroll = this.onScroll.bind(this)
        this.onServers = this.onServers.bind(this)
        this.onKeyUp = this.onKeyUp.bind(this)
        this.clearGameKeys = this.clearGameKeys.bind(this)

        this.playButton.addEventListener("click", this.onPlay)
        this.spectateButton.addEventListener("click", this.onSpectate)
        this.settingsButton.addEventListener("click", this.onSettings)
        this.serversButton.addEventListener("click", this.onServers)
        this.skinButton.addEventListener("click", this.onSkin)
        addEventListener("keydown", this.onKeyDown);
        addEventListener("keyup", this.onKeyUp);
        this.nameInput.addEventListener("change", this.onNameChange)
        this.nameInput.addEventListener("input", this.onNameInput)
        this.passInput.addEventListener("change", this.onPassChange)
        this.passInput.addEventListener("input", this.onPassChange)
        this.nameInput.addEventListener("focus", this.clearGameKeys)
        this.passInput.addEventListener("focus", this.clearGameKeys)
        this.chatField.addEventListener("focus", this.clearGameKeys)
        this.core.app.view.addEventListener("mousemove", this.onMouseMove)
        this.core.app.view.addEventListener("mousedown", this.onMouseDown)
        this.core.app.view.addEventListener('wheel', this.onScroll, {
            passive: true
        })
        addEventListener("resize", this.onResize)
        addEventListener("beforeunload", (event) => {
            this.core.store.settings = this.core.settings.rawSettings
            event.cancelBubble = true
            event.returnValue = 'You sure you want to leave?'
            event.preventDefault()
        })
    }

    onPlay() {
        this.core.store.addProfile(this.core.store.name, this.core.store.pass)
        this.core.net.spawn()
        this.setPanelState(false)
    }

    onSpectate() {
        this.setPanelState(false)
        this.core.net.spectate()
    }

    onSettings() {
        const settingLabels = { sectors: "sector" }
        let contentStr = `<div class="modal-settings-content">`
        const settings = this.core.settings.rawSettings
        for (const setting in settings) {
            if (setting === "backgroundTheme" || setting === "gradientCenter" || setting === "gradientEdge") continue
            const inputValue = settingLabels[setting]
                || setting.replace(/[A-Z]/g, char => " " + char.toLowerCase())
            contentStr += `
            <div class="modal-settings-tile">
            ${inputValue}<input type="checkbox" id="setting-${setting}" ${this.core.settings[setting] ? "checked" : ""}>
            </div>
            `
        }
        contentStr += `</div>`
        this.modalSystem.addModal(280, 360, contentStr)

        for (const setting in settings) {
            if (setting === "backgroundTheme" || setting === "gradientCenter" || setting === "gradientEdge") continue
            document.getElementById(`setting-${setting}`).addEventListener("click", () => {
                this.core.settings[setting] = !this.core.settings[setting]
            })
        }
    }

    updateLeaderboard() {
        const TOP = 10
        const leaderboard = this.core.net.leaderboardItems
        let myRank = null
        let myName = null
        let contentStr = ""

        for (let i = 0; i < leaderboard.length; i++) {
            const player = leaderboard[i]
            if (player.isMe) {
                myRank = i + 1
                myName = player.name
            }
            if (i < TOP) {
                contentStr += `<div class="leaderboard-tile ${player.isMe ? "leaderboard-tile--me" : ""}">${i + 1}. ${player.name}</div>`
            }
        }

        contentStr = `<div class="leaderboard-tile">Leaderboard</div>` + contentStr

        if (myRank > TOP) {
            contentStr += `<div class="leaderboard-tile leaderboard-tile--me">${myRank}. ${myName}</div>`
        }

        this.leaderboard.innerHTML = contentStr
    }

    updateChat() {
        let contentStr = ""
        for (const message of this.core.net.messages) {
            const passMark = message.hasPass
                ? `<span class="chat-pass" title="pass"><span class="material-symbols-outlined">check</span></span>`
                : ""
            contentStr += `
            <div class="message-tile">
                <span class="message-item" style="color: rgb(${message.color.r}, ${message.color.g}, ${message.color.b})">
                    ${(message.server || message.admin || message.mod) ? (message.server ? "[SERVER]" : message.admin ? "[ADMIN]" : "[MOD]") : ""}${passMark}${message.name}: <span class="message-text">${message.content}</span>
                </span>
            </div>`
        }
        this.chatContent.innerHTML = ""
        this.chatContent.insertAdjacentHTML('beforeend', contentStr)
    }

    updateServer() {
        if (!this.serverElement || !this.core.net?.serverAddr) return
        const addr = this.core.net.serverAddr
        const servers = this.core.app.servers || {}
        const entry = Object.values(servers).find(server => server.host === addr)
        this.serverElement.textContent = entry ? entry.name : addr
    }

    updateSkinPreview() {
        const nick = this.core.store.name?.trim()
        const skinUrl = this.core.app.getSkinUrl(this.core.store.name) || "/skins/4.png"
        this.skinButton.style.backgroundImage = `url("${skinUrl}")`
        this.skinButton.style.backgroundSize = "contain"
        this.skinButton.style.backgroundRepeat = "no-repeat"
        this.skinButton.style.backgroundPosition = "center"
        if (this.faviconLink) this.faviconLink.href = skinUrl
        document.title = nick && nick !== "Unnamed" ? nick : "Beta"
    }

    onServers() {
        let contentStr = `<div class="modal-servers-content">`
        for (const id in this.core.app.servers) {
            const server = this.core.app.servers[id]
            contentStr += `
            <div class="server-item">
                <div class="server-item-info">
                    <div class="server-item-name">${server.name}</div>
                    <div class="server-item-host">${server.host}</div>
                </div>
                <div id="server-${id}" class="server-item-connect center">Join</div>
            </div>
            `
        }
        contentStr += `</div>`
        const modalID = this.modalSystem.addModal(300, 360, contentStr)

        for (const id in this.core.app.servers) {
            document.getElementById(`server-${id}`).addEventListener("click", () => {
                this.modalSystem.removeModal(modalID)
                history.replaceState(null, "", `#${id}`)
                this.core.net.connect(`wss://${this.core.app.servers[id].host}`)
                this.updateServer()
            })
        }
    }

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
    }

    applyProfile(profile) {
        this.nameInput.value = profile.nick
        this.passInput.value = profile.pass || ""
        this.core.store.name = profile.nick
        this.core.store.pass = profile.pass || ""
        this.updatePassFieldVisibility()
        this.updateSkinPreview()
    }

    onSkin() {
        const profiles = this.core.store.profiles
        let contentStr = `<div class="modal-profiles-content">`
        contentStr += `<div class="modal-profiles-title">Saved profiles</div>`

        if (!profiles.length) {
            contentStr += `<div class="profile-empty">Play once to save nick, pass and skin here.</div>`
        } else {
            for (let i = 0; i < profiles.length; i++) {
                const profile = profiles[i]
                const skinUrl = this.core.app.getSkinUrl(profile.nick) || "/skins/4.png"
                const isActive = profile.nick === this.core.store.name
                    && (profile.pass || "") === (this.core.store.pass || "")
                const passLabel = profile.pass
                    ? `<span class="profile-pass">*****</span>`
                    : ""

                contentStr += `
                <div class="profile-card ${isActive ? "profile-card--active" : ""}" data-profile-index="${i}">
                    <div class="profile-avatar round" style="background-image:url('${skinUrl}')"></div>
                    <div class="profile-info">
                        <div class="profile-nick">${this.escapeHtml(profile.nick)}</div>
                        <div class="profile-meta">${passLabel || `<span class="profile-no-pass">no pass</span>`}</div>
                    </div>
                </div>`
            }
        }

        contentStr += `</div>`
        const modalID = this.modalSystem.addModal(300, 400, contentStr)

        for (const card of document.querySelectorAll("[data-profile-index]")) {
            card.addEventListener("click", () => {
                const index = Number(card.dataset.profileIndex)
                const profile = this.core.store.profiles[index]
                if (!profile) return
                this.applyProfile(profile)
                this.modalSystem.removeModal(modalID)
            })
        }
    }

    onMouseMove({
        clientX,
        clientY
    }) {
        this.mouse.x = clientX
        this.mouse.y = clientY
        this.core.app.mouseCoordinateChange()
    }

    onMouseDown() {
        if (!this.core.net.wantSpectate || this.core.app.ownedCells.length > 0) return
        this.core.app.mouseCoordinateChange()
        this.core.app.updateSpectateAim()
        this.core.net.sendMouseMove(true)
        this.core.net.sendUint8(1)
    }

    onScroll(event) {
        const camera = this.core.app.camera
        const delta = event.wheelDelta / -120 || event.deltaY / 100 || event.detail || 0
        camera.zoom *= Math.pow(0.9, delta)
        if (camera.zoom < 0.3) camera.zoom = 0.3
        const viewZoom = Math.max(camera.s, 0.001)
        if (camera.zoom > 4 / viewZoom) camera.zoom = 4 / viewZoom
    }

    isTextInputFocused() {
        const el = document.activeElement
        if (!el) return false
        const tag = el.tagName
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
    }

    clearGameKeys() {
        this.keysPressed = {}
        if (this.ejectInterval) {
            clearInterval(this.ejectInterval)
            this.ejectInterval = null
        }
    }

    onKeyDown(event) {
        const { code } = event

        if (this.isTextInputFocused()) {
            if (code === "Enter" && document.activeElement === this.chatField) {
                const value = this.chatField.value
                if (value !== "") this.core.net.sendChatMessage(value)
                this.chatField.blur()
                this.chatField.value = ""
            }
            return
        }

        this.keysPressed[code] = true

        switch (code) {
            case "Escape":
                this.setPanelState(true)
                break
            case "KeyW":
                if (!this.ejectInterval) {
                    this.core.net.sendMouseMove()
                    this.core.net.sendEject()
                    this.ejectInterval = setInterval(() => {
                        if (this.keysPressed["KeyW"]) this.core.net.sendEject()
                        else clearInterval(this.ejectInterval)
                    }, 50)
                }
                break
            case "Space":
                this.core.net.sendMouseMove()
                this.core.net.sendSplit()
                break
            case "KeyQ":
                this.core.net.sendMinionSwitch()
                break
            case "Enter":
                this.chatField.focus()
                break
            case "KeyE":
                this.core.net.sendE()
                break
            case "KeyR":
                this.core.net.sendR()
                break
            case "KeyT":
                this.core.net.sendT()
                break
            case "KeyP":
                this.core.net.sendP()
                break
            case "KeyC":
                this.sendChatCoord()
                break
        }

        if ((event.key === "с" || event.key === "С") && code !== "KeyC") {
            this.sendChatCoord()
        }
    }

    sendChatCoord() {
        if (this.coordCooldown || this.isTextInputFocused()) return

        const border = this.core.net?.border
        if (!border?.width) return

        const coord = Application.sectorAt(
            this.core.app.camera.x,
            this.core.app.camera.y,
            border
        )
        if (!coord) return

        this.core.net.sendChatMessage(coord)
        this.coordCooldown = true
        setTimeout(() => { this.coordCooldown = false }, 3000)
    }

    onKeyUp(event) {
        if (this.isTextInputFocused()) return

        const { code } = event
        this.keysPressed[code] = false

        if (code === "KeyW" && this.ejectInterval) {
            clearInterval(this.ejectInterval)
            this.ejectInterval = null
        }
    }

    onResize() {
        this.core.app.renderer.resize(innerWidth, innerHeight)
    }

    setPanelState(show) {
        if (show) this.userInterface.style.display = "flex"
        else this.userInterface.style.display = "none"
    }

    onNameChange() {
        this.core.store.name = this.nameInput.value
        this.updatePassFieldVisibility()
        this.updateSkinPreview()
    }

    onNameInput() {
        this.core.store.name = this.nameInput.value
        this.updatePassFieldVisibility()
        this.updateSkinPreview()
    }

    onPassChange() {
        this.core.store.pass = this.passInput.value
    }

    updatePassFieldVisibility() {
        if (!this.passInput) return
        const show = this.core.app.isPassUser(this.nameInput.value)
        this.passInput.style.display = show ? "" : "none"
        if (!show) {
            this.passInput.value = ""
            this.core.store.pass = ""
        }
    }
}
