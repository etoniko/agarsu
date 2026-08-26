const getXp = level => ~~(100 * (level ** 2 / 2));

const getLevel = xp => ~~((xp / 100 * 2) ** .5);

const normalizeFractlPart = n => (n % (Math.PI * 2)) / (Math.PI * 2);


export { getXp, getLevel, normalizeFractlPart };
