export const CELL_TEX_SIZE = 512;
export const CELL_TEX_RADIUS = 256;
export const CELL_TEX_RES = Math.min(4, Math.max(2, window.devicePixelRatio || 1));

export const CELL_NAME_TEX_RES = Math.min(5, Math.max(3, Math.round((window.devicePixelRatio || 1) * 2)));

export const CELL_NAME_FONT_PRIMARY = "Outfit";
export const CELL_NAME_FONT_FAMILY = `"${CELL_NAME_FONT_PRIMARY}", Ubuntu, "Segoe UI", system-ui, sans-serif`;

export const CELL_NAME_TEXTURE_CACHE_TAG = "v2-outfit";
export const SMOOTH_RENDER_THRESHOLD = 0.4;
export const WS_PROTOCOL = "eSejeKSVdysQvZs0ES1H";
export const DEFAULT_SKIN_CODE = "4";
export const DEFAULT_PLAYER_NAME = "Игрок";
export const CENTER_FRAME_URL = "./photo/center.png";
export const CENTER_FRAME_SIZE = 512;
export const CENTER_SKIN_SIZE = 450;

export function getSkinUrl(skinCode) {
    return `https://api.agar.su/skins/${skinCode || DEFAULT_SKIN_CODE}.png`;
}

export function getRenderDpr() {
    return window.devicePixelRatio || 1;
}
