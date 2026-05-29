export const MAX_LEVEL_XP = 2000000;

export const getXp = level => ~~(100 * (level ** 2 / 2));
export const getLevel = xp => ~~((xp / 100 * 2) ** 0.5);
export const normalizeFractlPart = n => (n % (Math.PI * 2)) / (Math.PI * 2);


export const packetXpToRealXp = packetXp => (packetXp > 0 ? packetXp - 1 : 0);

export function levelFromPacketXp(packetXp) {
    if (!packetXp) return -1;
    const level = getLevel(packetXp);
    return level > 0 ? level : (packetXpToRealXp(packetXp) > 0 ? 1 : -1);
}

export function getStarClass(level) {
    if (level >= 1 && level < 50) return "";
    if (level >= 50 && level < 100) return "azure";
    if (level >= 100 && level < 150) return "red";
    if (level >= 150) return "white";
    return "";
}

export function worldToMinimap(worldX, worldY, border, miniW, miniH) {
    if (!border?.width || !border?.height) {
        return { x: miniW / 2, y: miniH / 2, cell: "" };
    }

    const relativeX = (worldX - border.left) / border.width;
    const relativeY = (worldY - border.top) / border.height;

    const x = Math.max(0, Math.min(miniW, relativeX * miniW));
    const y = Math.max(0, Math.min(miniH, relativeY * miniH));

    const cols = 5;
    const rows = 5;
    const colIndex = Math.min(cols - 1, Math.max(0, Math.floor(relativeX * cols)));
    const rowIndex = Math.min(rows - 1, Math.max(0, Math.floor(relativeY * rows)));
    const cell = String.fromCharCode(65 + rowIndex) + (colIndex + 1);

    return { x, y, cell };
}
