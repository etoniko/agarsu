import { getPixi } from "../render/pixi.js";

export class Star extends getPixi().Polygon {
    constructor(x, y, points, radius, innerRadius, rotation = 0) {
        const PIXI = getPixi();
        innerRadius = innerRadius || radius / 2;
        const startAngle = (-1 * Math.PI / 2) + rotation;
        const len = points * 2;
        const delta = PIXI.PI_2 / len;
        const polygon = [];

        for (let i = 0; i < len; i++) {
            const r = i % 2 ? innerRadius : radius;
            const angle = (i * delta) + startAngle;
            polygon.push(x + (r * Math.cos(angle)), y + (r * Math.sin(angle)));
        }

        super(polygon);
    }
}
