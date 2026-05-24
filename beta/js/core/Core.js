import { SERVERS, getDefaultWsUrl } from "../config/servers.js";
import { Storage } from "./Storage.js";
import { Settings } from "./Settings.js";
import { Application } from "../render/Application.js";
import { Network } from "../services/Network.js";
import { SkinManager } from "../services/SkinManager.js";
import { DailyTopService } from "../services/DailyTopService.js";
import { PassListService } from "../services/PassListService.js";
import { AccountService } from "../services/AccountService.js";
import { UserInterface } from "../ui/UserInterface.js";
import { detectWebGLCapabilities } from "../render/RendererManager.js";

export class Core {
    constructor() {
        this.stats = {};
        this.init();
    }

    async init() {
        const caps = detectWebGLCapabilities();
        if (!caps.version) {
            console.error("[Render] WebGL недоступен — игра не сможет отображаться");
        }

        this.store = new Storage();
        this.settings = new Settings(this);
        this.net = new Network(this);
        this.app = new Application(this);
        this.ui = new UserInterface(this);
        this.skins = new SkinManager(this);
        this.account = { xp: 0, uid: "", level: 0 };
        this.currentServerHost = "";

        this.app.servers = SERVERS;

        await this.skins.init();
        this.passList = new PassListService();
        await this.passList.init();
        this.dailyTop = new DailyTopService(this);
        this.accounts = new AccountService(this);
        this.accounts.init();
        this.ui.initAfterSkins();

        const url = getDefaultWsUrl();
        this.defaultServerUrl = url;
        this.currentServerHost = url.replace(/^wss?:\/\//i, "").split("/")[0].split("?")[0];
        await this.dailyTop.refresh(this.currentServerHost);
        console.log("Prepared to connect to", url);
        this.net.connect(url).catch(err => console.error("Connect error:", err));
    }
}
