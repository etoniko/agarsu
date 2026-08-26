/** Должно совпадать с server/boost.js (BOOST_SEGMENTS). */
export const BOOST_SEGMENTS = 8;

export function snapBoostEnergy(energy) {
    const e = Math.max(0, Math.min(1, energy));
    const lit = Math.round(e * BOOST_SEGMENTS);
    return lit / BOOST_SEGMENTS;
}

/** Сколько чёрных квадратов (потраченный boost) — справа налево. */
export function energyToBlackCount(energy) {
    return BOOST_SEGMENTS - Math.round(Math.max(0, Math.min(1, snapBoostEnergy(energy))) * BOOST_SEGMENTS);
}
