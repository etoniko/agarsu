import { servers } from "../config/servers.js";
import { Application } from "../game/Application.js";
import { Storage } from "../settings/Storage.js";
import { Settings } from "../settings/Settings.js";
import { Captcha } from "../captcha/Captcha.js";
import { Network } from "../net/Network.js";
import { UserInterface } from "../ui/UserInterface.js";
import { SkinManager } from "../skins/SkinManager.js";

export class Game {
  constructor() {
    this.init();
  }

  async init() {
    this.app = new Application(this);
    this.store = new Storage();
    this.settings = new Settings(this);
    this.captcha = new Captcha({ sitekey: "0x4AAAAAAA0keHJ56_KNR0MU", theme: "dark" });
    this.net = new Network(this);
    this.ui = new UserInterface(this);
    this.app.servers = servers;
    this.skins = new SkinManager(this);
    this.account = { xp: 0, uid: localStorage.accountToken || "" };

    await this.skins.init();

    const isLocal = !location.hostname ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";
    const url = isLocal
      ? "ws://localhost:6009/"
      : `ws${location.protocol === "https:" ? "s" : ""}://${Object.keys(servers)[0]}`;
    this.defaultServerUrl = url;
    console.log("Prepared to connect to", url);

    const token = location.hostname ? await this.captcha.getToken() : "";
    this.net.connect(url, token);
  }
}
