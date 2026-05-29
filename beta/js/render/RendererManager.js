import { getPixi } from "./pixi.js";
import { CELL_TEX_SIZE, CELL_TEX_RADIUS, CELL_TEX_RES, getRenderDpr } from "../config/constants.js";

export function detectWebGLCapabilities() {
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2");
    if (gl2) {
        return { version: 2, gl: gl2, label: "WebGL 2" };
    }
    const gl1 = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return { version: gl1 ? 1 : 0, gl: gl1, label: gl1 ? "WebGL 1" : "none" };
}

export function createMainRenderer(view) {
    const PIXI = getPixi();
    const dpr = getRenderDpr();
    const renderer = PIXI.autoDetectRenderer({
        view,
        width: innerWidth,
        height: innerHeight,
        antialias: true,
        resolution: dpr,
        autoDensity: true,
        roundPixels: false,
        powerPreference: "high-performance",
        backgroundColor: 0x000000
    });

    return renderer;
}

export function createMinimapRenderer(view) {
    const PIXI = getPixi();
    const size = 200;
    return PIXI.autoDetectRenderer({
        view,
        width: size,
        height: size,
        backgroundAlpha: 0,
        antialias: false,
        resolution: 1,
        powerPreference: "low-power"
    });
}

export function createCellTexture(renderer) {
    const PIXI = getPixi();
    const cx = CELL_TEX_SIZE / 2;
    const circle = new PIXI.Graphics();
    circle.beginFill(0xffffff);
    circle.drawCircle(cx, cx, CELL_TEX_RADIUS - 0.5);
    circle.endFill();

    const cellRenderTexture = PIXI.RenderTexture.create({
        width: CELL_TEX_SIZE,
        height: CELL_TEX_SIZE,
        resolution: CELL_TEX_RES
    });
    cellRenderTexture.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
    cellRenderTexture.baseTexture.mipmapMode = PIXI.MIPMAP_MODES.ON;
    renderer.render(circle, { renderTexture: cellRenderTexture, clear: true });
    circle.destroy();

    return cellRenderTexture;
}
