

export function normalizeBorderBounds(border) {
    let left = border.left;
    let top = border.top;
    let right = border.right;
    let bottom = border.bottom;

    if (left === 0 && top === 0 && right > 0 && bottom > 0) {
        left = -right;
        top = -bottom;
    }

    border.left = left;
    border.top = top;
    border.right = right;
    border.bottom = bottom;
    border.width = right - left;
    border.height = bottom - top;
    border.centerX = (left + right) / 2;
    border.centerY = (top + bottom) / 2;
    return border;
}

export function clampToBorder(x, y, border) {
    if (!border?.width) return { x, y };
    return {
        x: Math.max(border.left, Math.min(border.right, x)),
        y: Math.max(border.top, Math.min(border.bottom, y))
    };
}


export function isBorderWrapJump(border, prevX, prevY, nextX, nextY) {
    if (!border?.width || !border?.height) return false;
    const dx = Math.abs(nextX - prevX);
    const dy = Math.abs(nextY - prevY);
    return dx > border.width / 2 || dy > border.height / 2;
}
