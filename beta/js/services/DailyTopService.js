import { getGameServerApiBase } from "../net/challenge.js";
import { normalizeNick } from "../utils/nick.js";
import { DEFAULT_SKIN_CODE, getSkinUrl } from "../config/constants.js";

export async function fetchDailyTopStats(gameHost) {
    const apiBase = getGameServerApiBase(gameHost);
    const response = await fetch(apiBase + "/checkStats", { cache: "no-store" });
    if (!response.ok) {
        throw new Error("checkStats failed: " + response.status);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

export function enrichStatsWithSkins(stats, skinManager) {
    return stats.map(player => {
        const normalizedNick = normalizeNick(player.nick);
        const skinCode =
            skinManager?.getCodeForName(normalizedNick) ||
            skinManager?.getCodeForName(player.nick) ||
            DEFAULT_SKIN_CODE;

        return {
            ...player,
            skin: skinCode
        };
    });
}

export class DailyTopService {
    constructor(core) {
        this.core = core;
        this.stats = [];
        this.topPlayer = null;
    }

    get currentHost() {
        return this.core.currentServerHost;
    }

    async refresh(host = this.currentHost) {
        if (!host) return this.stats;

        try {
            const raw = await fetchDailyTopStats(host);
            this.stats = enrichStatsWithSkins(raw, this.core.skins);
            this.topPlayer = this.stats[0] || null;
            this.core.app?.centerTop?.setTopPlayer(
                this.topPlayer,
                this.topPlayer ? getSkinUrl(this.topPlayer.skin) : null
            );
            this.core.ui?.displayDailyTopStats(this.stats);
            return this.stats;
        } catch (_) {
            this.stats = [];
            this.topPlayer = null;
            this.core.app?.centerTop?.setTopPlayer(null);
            this.core.ui?.displayDailyTopStats([]);
            return [];
        }
    }
}
