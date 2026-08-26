/** Синхронизация позиции клетки с сервером (без поломки интерполяции). */

export function isValidCellCoord(n) {
    return typeof n === "number" && Number.isFinite(n);
}

export function isValidCellState(posX, posY, size) {
    return isValidCellCoord(posX) && isValidCellCoord(posY) && isValidCellCoord(size) && size >= 0 && size < 100000;
}

/** Резкий скачок координат (спавн, граница карты). */
export function shouldSnapCell(cell, posX, posY, border) {
    if (!cell || !border?.width) return false;
    const dx = Math.abs(posX - cell.x);
    const dy = Math.abs(posY - cell.y);
    return dx > border.width * 0.45 || dy > border.height * 0.45;
}

/**
 * @param {boolean} instant — сразу x/y/r без интерполяции
 */
export function applyServerCellState(cell, posX, posY, size, now, instant = false) {
    if (!isValidCellState(posX, posY, size)) {
        return false;
    }

    if (instant) {
        cell.x = cell.ox = cell.nx = posX;
        cell.y = cell.oy = cell.ny = posY;
        cell.r = cell.or = cell.nr = size;
    } else {
        cell.ox = cell.x;
        cell.oy = cell.y;
        cell.or = cell.r;
        cell.nx = posX;
        cell.ny = posY;
        cell.nr = size;
    }

    cell.updated = now;
    cell.sprite.x = cell.x;
    cell.sprite.y = cell.y;
    const s = cell.r / 256;
    cell.sprite.scale.set(s);
    cell._lastScale = s;
    return true;
}

export function snapCameraTo(app, x, y) {
    app.posX = x;
    app.posY = y;
    app.camera.x = x;
    app.camera.y = y;
    app.camera.target = app.camera.target || { x: 0, y: 0, s: 1 };
    app.camera.target.x = x;
    app.camera.target.y = y;
    if (typeof app._applyCameraImmediate === "function") {
        app._applyCameraImmediate();
    }
}
