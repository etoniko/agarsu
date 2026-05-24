export const COLORS = [
    "#FF0000", "#FF8000", "#FFFF00", "#80FF00",
    "#00FF00", "#00FF80", "#00FFFF", "#0080FF",
    "#0000FF", "#8000FF", "#FF00FF", "#FF0080",
    "#FFFFFF", "#C0C0C0", "#808080", "#000000"
];

const COLOR_MAP = new Map();
COLORS.forEach((hex, id) => {
    COLOR_MAP.set(hex.toLowerCase(), id);
    COLOR_MAP.set(hex.replace("#", "").toLowerCase(), id);
});

export function getColorId(storedColor) {
    if (!storedColor) return 0;
    const key = storedColor.toString().toLowerCase().trim();
    return COLOR_MAP.has(key) ? COLOR_MAP.get(key) : 0;
}

export function setSelectedColor(hex) {
    if (hex && hex.startsWith("#")) {
        localStorage.setItem("selectedColor", hex.toUpperCase());
    }
}

export function rgbToHex(r, g, b) {
    const hex = ((r << 16) | (g << 8) | b);
    return "#" + ("000000" + hex.toString(16)).slice(-6).toUpperCase();
}

/** Pixi tint — число 0xRRGGBB (строка #hex не всегда работает) */
export function hexToPixiTint(color) {
    if (typeof color === "number") return color;
    if (!color) return 0xffffff;
    const hex = String(color).replace(/^#/, "");
    const n = parseInt(hex, 16);
    return Number.isNaN(n) ? 0xffffff : n;
}
