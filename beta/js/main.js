import Network from "./Network.js"
import Application from "./Application.js"
import Storage from "./Storage.js"
import UserInterface from "./UserInterface.js?2"
import Settings from "./Settings.js"

Array.prototype.remove = function (a) {
    const i = this.indexOf(a);
    return i !== -1 && this.splice(i, 1);
}

class Cigar3 {
    constructor() {
        this.init()
    }

    async init() {
        this.app = new Application(this)
        await this.app.fontReadyPromise
        this.store = new Storage()
        if (!this.store.profiles.length) {
            const name = this.store.name
            if (name && name !== "Unnamed") this.store.addProfile(name, this.store.pass)
        }
        this.settings = new Settings(this)
        await this.app.loadInfos()
        this.net = new Network(this)
        this.ui = new UserInterface(this)
        this.connectDefaultServer()
    }

    connectDefaultServer() {
        const serverKey = Application.getServerKeyFromHash(this.app.servers)
        const host = this.app.servers[serverKey].host
        this.net.connect(`wss://${host}`)
        this.ui.updateServer()
    }
}

window.CORE = new Cigar3()

addEventListener("hashchange", () => {
    if (!window.CORE?.app?.servers) return
    window.CORE.connectDefaultServer()
})
