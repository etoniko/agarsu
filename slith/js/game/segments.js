/** Сегменты игрока: id1 (мин.) — голова/камера, id2 следует за id1, id3 за id2, … */

export function sortSegmentIds(ids) {
    return ids.slice().sort((a, b) => a - b);
}

/** Главный сегмент — наименьший node id. */
export function getMainSegmentId(segmentIds) {
    if (!segmentIds.length) return null;
    return sortSegmentIds(segmentIds)[0];
}

/** Индекс сегмента в цепочке: 0 = голова, 1 = второй, … */
export function getSegmentIndex(segmentIds, cellId) {
    const sorted = sortSegmentIds(segmentIds);
    const idx = sorted.indexOf(cellId);
    return idx >= 0 ? idx : sorted.length;
}

/** Масштаб обзора в режиме наблюдения (как main.js case 17: posSize = 0.15). */
export const SPECTATE_OVERVIEW_SCALE = 0.15;

/** Еда и прочие объекты без playerId — всегда ниже сегментов змеек (от 10000). */
export const FOOD_Z_BASE = 100;
export const FOOD_Z_SPAN = 9900;

export function foodZIndex(cellNodeId) {
    return FOOD_Z_BASE + ((cellNodeId | 0) % FOOD_Z_SPAN);
}

/** z-index: голова (меньший id) поверх хвоста; не зависит от массы. */
export function segmentZIndex(segmentIndex, segmentCount, cellNodeId) {
    const base = 10000;
    if (segmentCount > 0 && segmentIndex >= 0) {
        return base + (segmentCount - segmentIndex) * 4;
    }
    return base + (cellNodeId % 1000000);
}
