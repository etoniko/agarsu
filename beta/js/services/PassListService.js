import { normalizeNick } from "../utils/nick.js";
import { getPlayName } from "../utils/player.js";

const PASS_LIST_URL = "https://api.agar.su/pass.txt";

export class PassListService {
    constructor() {
        this.nicks = new Set();
        this.ready = false;
    }

    async init() {
        try {
            const response = await fetch(PASS_LIST_URL, { cache: "no-store" });
            if (!response.ok) throw new Error("pass.txt: " + response.status);
            const text = await response.text();
            for (const line of text.split(/\r?\n/)) {
                const normalized = normalizeNick(line);
                if (normalized) this.nicks.add(normalized);
            }
        } catch (error) {
            console.warn("Не удалось загрузить pass.txt:", error);
        } finally {
            this.ready = true;
        }
    }

    requiresPassword(nick) {
        const normalized = normalizeNick(getPlayName(nick));
        if (!normalized) return false;
        return this.nicks.has(normalized);
    }
}
