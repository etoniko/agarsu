import { MAX_LEVEL_XP, getStarClass } from "./math.js";

const TIERS = {
    "": { id: "rookie", name: "Новичок", icon: "shield" },
    azure: { id: "veteran", name: "Ветеран", icon: "workspace_premium" },
    red: { id: "elite", name: "Элита", icon: "local_fire_department" },
    white: { id: "legend", name: "Легенда", icon: "auto_awesome" },
};

export function getLevelTier(level) {
    if (level == null || level < 0) return null;
    const starClass = getStarClass(level);
    const base = TIERS[starClass] ?? TIERS[""];
    return { ...base, starClass, level };
}

function escAttr(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

/** Бейдж уровня для чата, топа и HUD */
export function buildLevelBadgeHtml(level, accountAvatar, realXp) {
    const tier = getLevelTier(level);
    if (!tier) return "";

    if (realXp >= MAX_LEVEL_XP && accountAvatar) {
        return (
            `<span class="rank-badge rank-badge--max" title="Максимальный уровень">` +
            `<img class="rank-badge__avatar" src="${escAttr(accountAvatar)}" alt="" ` +
            `onerror="this.style.display='none'">` +
            `<span class="material-symbols-outlined rank-badge__icon rank-badge__icon--verified">verified</span>` +
            `</span>`
        );
    }

    const mod = tier.starClass || "default";
    return (
        `<span class="rank-badge rank-badge--${mod}" title="${escAttr(tier.name)} · ур. ${level}">` +
        `<span class="rank-badge__ring">` +
        `<span class="material-symbols-outlined rank-badge__glyph" aria-hidden="true">${tier.icon}</span>` +
        `<span class="rank-badge__lvl">${level}</span>` +
        `</span></span>`
    );
}
