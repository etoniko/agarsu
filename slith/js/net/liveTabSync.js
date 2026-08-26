/** Синхронизация позиции игрока между вкладками (игра + наблюдение). */
export const LIVE_TAB_KEY = "slither-live-v1";
export const LIVE_TAB_MAX_AGE_MS = 15000;

export function publishLivePlayerState(pID, x, y, name) {
    if (!pID) return;
    try {
        localStorage.setItem(LIVE_TAB_KEY, JSON.stringify({
            pID: pID | 0,
            x: Math.round(x),
            y: Math.round(y),
            name: name || "",
            t: Date.now()
        }));
    } catch {
        // ignore quota / private mode
    }
}

export function readLivePlayerState(maxAgeMs = LIVE_TAB_MAX_AGE_MS) {
    try {
        const raw = localStorage.getItem(LIVE_TAB_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data?.pID || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return null;
        if (Date.now() - (data.t || 0) > maxAgeMs) return null;
        return data;
    } catch {
        return null;
    }
}
