export const CELL_TEX_SIZE = 512;
export const CELL_TEX_RADIUS = 256;
export const CELL_TEX_RES = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
export const MAX_RENDER_DPR = 2;
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
    return Math.min(window.devicePixelRatio || 1, MAX_RENDER_DPR);
}
