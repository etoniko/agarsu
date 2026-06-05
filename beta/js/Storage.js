export default class {
    get settings() {
        const defaultSettings = {
            skins: true,
            names: true,
            mass: true,
            sectors: false
        }

        const stored = localStorage.getItem("cigar3-settings")
        let parsedSettings
        try {
            parsedSettings = JSON.parse(stored)
        } catch {
            return defaultSettings
        }
        if (!parsedSettings || typeof parsedSettings !== "object") return defaultSettings

        if ("grid" in parsedSettings) {
            if (!("sectors" in parsedSettings)) parsedSettings.sectors = parsedSettings.grid
            delete parsedSettings.grid
        }

        delete parsedSettings.backgroundTheme
        delete parsedSettings.gradientCenter
        delete parsedSettings.gradientEdge

        return { ...defaultSettings, ...parsedSettings }
    }

    set settings(settings) {
        localStorage.setItem("cigar3-settings", JSON.stringify(settings))
    }

    get name() {
        let name = localStorage.getItem("cigar3-name") || "Unnamed"
        if (!name.includes("#")) return name

        const [nick, pass] = name.split("#", 2)
        localStorage.setItem("cigar3-name", nick || "Unnamed")
        if (pass && !localStorage.getItem("cigar3-pass")) {
            localStorage.setItem("cigar3-pass", pass)
        }
        return nick || "Unnamed"
    }

    set name(name) {
        localStorage.setItem("cigar3-name", String(name).split("#")[0].trim())
    }

    get pass() {
        return localStorage.getItem("cigar3-pass") || ""
    }

    set pass(pass) {
        localStorage.setItem("cigar3-pass", pass || "")
    }

    get skin() {
        return localStorage.getItem("cigar3-skin") || ""
    }

    set skin(skin) {
        localStorage.setItem("cigar3-skin", skin)
    }

    get profiles() {
        try {
            const raw = localStorage.getItem("cigar3-profiles")
            const list = JSON.parse(raw)
            return Array.isArray(list) ? list : []
        } catch {
            return []
        }
    }

    set profiles(profiles) {
        localStorage.setItem("cigar3-profiles", JSON.stringify(profiles))
    }

    addProfile(nick, pass = "") {
        nick = String(nick).split("#")[0].trim()
        pass = String(pass || "").trim()
        if (!nick || nick === "Unnamed") return

        const key = `${nick}#${pass}`
        let profiles = this.profiles.filter(p => `${p.nick}#${p.pass || ""}` !== key)
        profiles.unshift({ nick, pass, usedAt: Date.now() })
        if (profiles.length > 24) profiles = profiles.slice(0, 24)
        this.profiles = profiles
    }
}
