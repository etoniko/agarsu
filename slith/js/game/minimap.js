/** Размер Pixi-канваса миникарты (совпадает с #minimap-grid в CSS). */
export const MINIMAP_SIZE = 200;

/**
 * Мировые координаты → позиция маркера на миникарте.
 * border.left/top/right/bottom — с сервера (minx, miny, maxx, maxy).
 */
export function worldToMinimap(worldX, worldY, border, size = MINIMAP_SIZE) {
    if (!border?.width || !border?.height) {
        return { x: size / 2, y: size / 2 };
    }

    const nx = (worldX - border.left) / border.width;
    const ny = (worldY - border.top) / border.height;

    return {
        x: Math.max(0, Math.min(size, nx * size)),
        y: Math.max(0, Math.min(size, ny * size))
    };
}
