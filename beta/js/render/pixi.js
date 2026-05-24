export function getPixi() {
    if (!globalThis.PIXI) {
        throw new Error("PIXI is not loaded. Include pixi.js before the game modules.");
    }
    return globalThis.PIXI;
}
