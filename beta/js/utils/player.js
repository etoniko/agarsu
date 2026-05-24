import { DEFAULT_PLAYER_NAME } from "../config/constants.js";
import { getSkinUrl } from "../config/constants.js";
import { normalizeNick } from "./nick.js";

export function getPlayName(rawName) {
    const trimmed = String(rawName ?? "").trim();
    return trimmed || DEFAULT_PLAYER_NAME;
}

export function buildSpawnName(store) {
    const base = getPlayName(store?.name);
    const pass = (store?.pass || "").trim();
    return pass ? `${base}#${pass}` : `${base}#`;
}

export function resolveSkinCodeForNick(skinManager, rawNick) {
    const playName = getPlayName(rawNick);
    const normalized = normalizeNick(playName) || playName.toLowerCase();
    return (
        skinManager?.getCodeForName(normalized) ||
        skinManager?.getCodeForName(playName) ||
        skinManager?.getCodeForName(DEFAULT_PLAYER_NAME.toLowerCase()) ||
        "4"
    );
}

export function skinPreviewUrl(skinManager, rawNick) {
    return getSkinUrl(resolveSkinCodeForNick(skinManager, rawNick));
}
